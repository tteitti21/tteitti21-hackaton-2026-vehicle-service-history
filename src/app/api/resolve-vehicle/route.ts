import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import type { VehicleResolution } from "@/domain/schemas/vehicle-resolution";
import type { VehicleInput } from "@/domain/vehicle/vehicle-input";
import { withNoStoreHeaders } from "@/lib/http/no-store";
import { OpenAIVehicleResolutionProvider } from "@/lib/openai/openai-vehicle-resolution-provider";
import {
  resolveVehicle,
  VehicleResolutionOutputValidationError,
} from "@/lib/openai/resolve-vehicle";
import {
  readOpenAIVehicleResolutionConfig,
  type OpenAIVehicleResolutionConfig,
} from "@/lib/openai/vehicle-resolution-config";
import {
  InMemoryRateLimiter,
  type RateLimiter,
} from "@/lib/rate-limit/rate-limiter";
import {
  parseVehicleResolutionRequest,
  VehicleResolutionRequestError,
} from "@/lib/validation/vehicle-resolution-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VEHICLE_RESOLUTION_RATE_LIMIT = {
  limit: 3,
  windowMs: 60_000,
} as const;
const defaultRateLimiter = new InMemoryRateLimiter();

type ExecuteResolution = (
  vehicle: VehicleInput,
  config: OpenAIVehicleResolutionConfig,
  signal: AbortSignal,
) => Promise<VehicleResolution>;

interface ResolveVehicleRouteDependencies {
  environment?: Record<string, string | undefined>;
  rateLimiter?: RateLimiter;
  executeResolution?: ExecuteResolution;
}

export function createResolveVehiclePostHandler(
  dependencies: ResolveVehicleRouteDependencies = {},
) {
  const environment = dependencies.environment ?? process.env;
  const rateLimiter = dependencies.rateLimiter ?? defaultRateLimiter;
  const executeResolution =
    dependencies.executeResolution ?? executeWithOpenAI;

  return async function POST(request: Request): Promise<NextResponse> {
    const requestId = randomUUID();

    if (!isSameOriginRequest(request)) {
      return errorResponse(403, "forbidden", requestId);
    }

    const rateLimit = rateLimiter.consume(
      getCoarseRateLimitKey(request),
      VEHICLE_RESOLUTION_RATE_LIMIT,
    );
    if (!rateLimit.allowed) {
      return errorResponse(429, "rate_limited", requestId, {
        "Retry-After": String(
          Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1_000)),
        ),
      });
    }

    let vehicle: VehicleInput;
    try {
      vehicle = await parseVehicleResolutionRequest(request);
    } catch (error) {
      if (error instanceof VehicleResolutionRequestError) {
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
      const resolution = await executeResolution(
        vehicle,
        config,
        controller.signal,
      );

      return NextResponse.json(resolution, {
        status: 200,
        headers: withNoStoreHeaders(),
      });
    } catch (error) {
      if (controller.signal.aborted) {
        return errorResponse(504, "provider_timeout", requestId);
      }

      if (error instanceof VehicleResolutionOutputValidationError) {
        return errorResponse(502, "invalid_provider_output", requestId);
      }

      return errorResponse(502, "provider_error", requestId);
    } finally {
      clearTimeout(timeout);
    }
  };
}

export const POST = createResolveVehiclePostHandler();

async function executeWithOpenAI(
  vehicle: VehicleInput,
  config: OpenAIVehicleResolutionConfig,
  signal: AbortSignal,
): Promise<VehicleResolution> {
  return resolveVehicle(
    new OpenAIVehicleResolutionProvider(config),
    vehicle,
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
  const forwardedAddress = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();

  if (!forwardedAddress) {
    return "unknown";
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(forwardedAddress)) {
    return `ipv4:${forwardedAddress.split(".").slice(0, 3).join(".")}`;
  }

  if (forwardedAddress.includes(":")) {
    return `ipv6:${forwardedAddress.split(":").slice(0, 4).join(":")}`;
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
    {
      status,
      headers: withNoStoreHeaders(headers),
    },
  );
}

function userFacingErrorMessage(code: string): string {
  switch (code) {
    case "payload_too_large":
      return "Ajoneuvotietojen pyyntö ylittää sallitun kokorajan.";
    case "unsupported_media_type":
      return "Ajoneuvotiedot on lähetettävä JSON-muodossa.";
    case "rate_limited":
      return "Ajoneuvohakuja on tehty liian monta. Yritä hetken kuluttua uudelleen.";
    case "provider_timeout":
      return "Ajoneuvoversion verkkohaku aikakatkaistiin. Voit yrittää uudelleen.";
    case "invalid_provider_output":
      return "Ajoneuvohausta saatuja ehdokkaita tai lähteitä ei voitu varmistaa.";
    case "provider_error":
      return "Ajoneuvoversion verkkohaku epäonnistui palveluntarjoajalla.";
    case "service_unavailable":
      return "Ajoneuvoversion verkkohaku ei ole tällä hetkellä käytettävissä.";
    case "forbidden":
      return "Pyyntöä ei voitu hyväksyä.";
    default:
      return "Ajoneuvotietoja ei voitu käsitellä.";
  }
}
