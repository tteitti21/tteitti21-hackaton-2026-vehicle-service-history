import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import type { ServiceHistory } from "@/domain/schemas/service-history";
import { withNoStoreHeaders } from "@/lib/http/no-store";
import {
  extractServiceHistoryWithRetry,
  ExtractionOutputValidationError,
  type ExtractionInputImage,
} from "@/lib/openai/extract-service-history";
import {
  readOpenAIExtractionConfig,
  type OpenAIExtractionConfig,
} from "@/lib/openai/extraction-config";
import { OpenAIExtractionProvider } from "@/lib/openai/openai-extraction-provider";
import {
  InMemoryRateLimiter,
  type RateLimiter,
} from "@/lib/rate-limit/rate-limiter";
import {
  ExtractionRequestError,
  parseExtractionRequest,
} from "@/lib/validation/extraction-request";
import { readUploadLimits } from "@/lib/validation/request-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXTRACTION_RATE_LIMIT = {
  limit: 5,
  windowMs: 60_000,
} as const;
const defaultRateLimiter = new InMemoryRateLimiter();

type ExecuteExtraction = (
  images: ReadonlyArray<ExtractionInputImage>,
  config: OpenAIExtractionConfig,
  signal: AbortSignal,
) => Promise<ServiceHistory>;

interface ExtractRouteDependencies {
  environment?: Record<string, string | undefined>;
  rateLimiter?: RateLimiter;
  executeExtraction?: ExecuteExtraction;
}

export function createExtractPostHandler(
  dependencies: ExtractRouteDependencies = {},
) {
  const environment = dependencies.environment ?? process.env;
  const rateLimiter = dependencies.rateLimiter ?? defaultRateLimiter;
  const executeExtraction =
    dependencies.executeExtraction ?? executeWithOpenAI;

  return async function POST(request: Request): Promise<NextResponse> {
    const requestId = randomUUID();

    if (!isSameOriginRequest(request)) {
      return errorResponse(403, "forbidden", requestId);
    }

    const rateLimit = rateLimiter.consume(
      getCoarseRateLimitKey(request),
      EXTRACTION_RATE_LIMIT,
    );

    if (!rateLimit.allowed) {
      return errorResponse(429, "rate_limited", requestId, {
        "Retry-After": String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000))),
      });
    }

    let config: OpenAIExtractionConfig;
    try {
      config = readOpenAIExtractionConfig(environment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse(503, "service_unavailable", requestId);
      }
      return errorResponse(500, "internal_error", requestId);
    }

    try {
      const limits = readUploadLimits(environment);
      const images = await parseExtractionRequest(request, limits);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const serviceHistory = await executeExtraction(
          images,
          config,
          controller.signal,
        );

        return NextResponse.json(serviceHistory, {
          status: 200,
          headers: withNoStoreHeaders(),
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return errorResponse(504, "provider_timeout", requestId);
        }

        if (error instanceof ExtractionOutputValidationError) {
          return errorResponse(502, "invalid_provider_output", requestId);
        }

        return errorResponse(502, "provider_error", requestId);
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      if (error instanceof ExtractionRequestError) {
        return errorResponse(error.status, error.code, requestId);
      }

      return errorResponse(400, "invalid_request", requestId);
    }
  };
}

export const POST = createExtractPostHandler();

async function executeWithOpenAI(
  images: ReadonlyArray<ExtractionInputImage>,
  config: OpenAIExtractionConfig,
  signal: AbortSignal,
): Promise<ServiceHistory> {
  return extractServiceHistoryWithRetry(
    new OpenAIExtractionProvider(config),
    images,
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
      return "Lähetyspaketti ylittää sallitun kokorajan.";
    case "unsupported_media_type":
      return "Lähetyspaketti sisältää tiedostomuodon, jota ei hyväksytä.";
    case "rate_limited":
      return "Poimintapyyntöjä on tehty liian monta. Yritä hetken kuluttua uudelleen.";
    case "provider_timeout":
      return "Kuvien käsittely aikakatkaistiin. Kuvat säilyvät selaimessa uutta yritystä varten.";
    case "invalid_provider_output":
      return "Kuvista saatu vastaus ei ollut turvallisesti käsiteltävässä muodossa. Kuvat säilyvät selaimessa.";
    case "provider_error":
      return "Kuvien käsittely epäonnistui palveluntarjoajalla. Kuvat säilyvät selaimessa uutta yritystä varten.";
    case "service_unavailable":
      return "Kuvien poimintapalvelu ei ole tällä hetkellä käytettävissä.";
    case "forbidden":
      return "Pyyntöä ei voitu hyväksyä.";
    default:
      return "Lähetyspakettia ei voitu käsitellä.";
  }
}
