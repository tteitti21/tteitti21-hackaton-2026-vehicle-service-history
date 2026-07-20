import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import type { MaintenanceResearch } from "@/domain/schemas/maintenance-research";
import { withNoStoreHeaders } from "@/lib/http/no-store";
import { OpenAIMaintenanceResearchProvider } from "@/lib/openai/openai-maintenance-research-provider";
import {
  MaintenanceResearchOutputValidationError,
  researchMaintenance,
} from "@/lib/openai/research-maintenance";
import {
  readOpenAIVehicleResolutionConfig,
  type OpenAIVehicleResolutionConfig,
} from "@/lib/openai/vehicle-resolution-config";
import {
  InMemoryRateLimiter,
  type RateLimiter,
} from "@/lib/rate-limit/rate-limiter";
import {
  parseMaintenanceResearchRequest,
  MaintenanceResearchRequestError,
  type MaintenanceResearchRequest,
} from "@/lib/validation/maintenance-research-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const RESEARCH_RATE_LIMIT = { limit: 2, windowMs: 60_000 } as const;
const defaultRateLimiter = new InMemoryRateLimiter();

type ExecuteResearch = (
  request: MaintenanceResearchRequest,
  config: OpenAIVehicleResolutionConfig,
  signal: AbortSignal,
) => Promise<MaintenanceResearch>;

interface ResearchRouteDependencies {
  environment?: Record<string, string | undefined>;
  rateLimiter?: RateLimiter;
  executeResearch?: ExecuteResearch;
}

export function createResearchPostHandler(
  dependencies: ResearchRouteDependencies = {},
) {
  const environment = dependencies.environment ?? process.env;
  const rateLimiter = dependencies.rateLimiter ?? defaultRateLimiter;
  const executeResearch =
    dependencies.executeResearch ?? executeWithOpenAI;

  return async function POST(request: Request): Promise<NextResponse> {
    const requestId = randomUUID();

    if (!isSameOriginRequest(request)) {
      return errorResponse(403, "forbidden", requestId);
    }

    const rateLimit = rateLimiter.consume(
      getCoarseRateLimitKey(request),
      RESEARCH_RATE_LIMIT,
    );
    if (!rateLimit.allowed) {
      return errorResponse(429, "rate_limited", requestId, {
        "Retry-After": String(
          Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1_000)),
        ),
      });
    }

    let researchRequest: MaintenanceResearchRequest;
    try {
      researchRequest = await parseMaintenanceResearchRequest(request);
    } catch (error) {
      if (error instanceof MaintenanceResearchRequestError) {
        return errorResponse(error.status, error.code, requestId);
      }
      return errorResponse(400, "invalid_request", requestId);
    }

    let config: OpenAIVehicleResolutionConfig;
    try {
      config = readOpenAIVehicleResolutionConfig(environment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse(503, "service_unavailable", requestId);
      }
      return errorResponse(500, "internal_error", requestId);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const result = await executeResearch(
        researchRequest,
        config,
        controller.signal,
      );
      return NextResponse.json(result, {
        status: 200,
        headers: withNoStoreHeaders(),
      });
    } catch (error) {
      if (controller.signal.aborted) {
        return errorResponse(504, "provider_timeout", requestId);
      }
      if (error instanceof MaintenanceResearchOutputValidationError) {
        return errorResponse(502, "invalid_provider_output", requestId);
      }
      return errorResponse(502, "provider_error", requestId);
    } finally {
      clearTimeout(timeout);
    }
  };
}

export const POST = createResearchPostHandler();

async function executeWithOpenAI(
  request: MaintenanceResearchRequest,
  config: OpenAIVehicleResolutionConfig,
  signal: AbortSignal,
): Promise<MaintenanceResearch> {
  return researchMaintenance(
    new OpenAIMaintenanceResearchProvider(config),
    request,
    signal,
  );
}

function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) {
    return true;
  }
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function getCoarseRateLimitKey(request: Request): string {
  const address = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  if (!address) {
    return "unknown";
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)) {
    return `ipv4:${address.split(".").slice(0, 3).join(".")}`;
  }
  if (address.includes(":")) {
    return `ipv6:${address.split(":").slice(0, 4).join(":")}`;
  }
  return "unknown";
}

function errorResponse(
  status: number,
  code: string,
  requestId: string,
  headers: HeadersInit = {},
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message: userFacingErrorMessage(code),
        request_id: requestId,
      },
    },
    { status, headers: withNoStoreHeaders(headers) },
  );
}

function userFacingErrorMessage(code: string): string {
  switch (code) {
    case "payload_too_large":
      return "The maintenance research request exceeds the allowed size limit.";
    case "unsupported_media_type":
      return "Maintenance research must be submitted as JSON.";
    case "rate_limited":
      return "Too many maintenance research requests have been made. Try again in a moment.";
    case "provider_timeout":
      return "Maintenance interval web search timed out. You can try again.";
    case "invalid_provider_output":
      return "The researched maintenance intervals or sources could not be verified safely.";
    case "provider_error":
      return "Maintenance interval web search failed at the provider.";
    case "service_unavailable":
      return "Maintenance interval web search is currently unavailable.";
    case "forbidden":
      return "The request could not be accepted.";
    default:
      return "The maintenance research request could not be processed.";
  }
}
