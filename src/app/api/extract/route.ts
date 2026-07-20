import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import type { ServiceHistory } from "@/domain/schemas/service-history";
import { createExtractionTimeoutResponseHeader } from "@/lib/http/extraction-timeout-header";
import { withNoStoreHeaders } from "@/lib/http/no-store";
import { createRequestSizeResponseHeaders } from "@/lib/http/request-size-headers";
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
export const maxDuration = 300;

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

    let limits: ReturnType<typeof readUploadLimits>;
    try {
      limits = readUploadLimits(environment);
    } catch {
      return errorResponse(500, "internal_error", requestId);
    }

    const requestSizeDiagnosticsHeaders = createRequestSizeResponseHeaders(
      request.headers,
      limits.maxRequestBytes,
    );

    let images: ExtractionInputImage[];

    try {
      images = await parseExtractionRequest(request, limits);
    } catch (error) {
      if (error instanceof ExtractionRequestError) {
        return errorResponse(
          error.status,
          error.code,
          requestId,
          requestSizeDiagnosticsHeaders,
        );
      }

      return errorResponse(
        400,
        "invalid_request",
        requestId,
        requestSizeDiagnosticsHeaders,
      );
    }

    let config: OpenAIExtractionConfig;
    try {
      config = readOpenAIExtractionConfig(environment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse(
          503,
          "service_unavailable",
          requestId,
          requestSizeDiagnosticsHeaders,
        );
      }
      return errorResponse(
        500,
        "internal_error",
        requestId,
        requestSizeDiagnosticsHeaders,
      );
    }

    const extractionDiagnosticsHeaders = {
      ...requestSizeDiagnosticsHeaders,
      ...createExtractionTimeoutResponseHeader(config.timeoutMs),
    };
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
        headers: withNoStoreHeaders(extractionDiagnosticsHeaders),
      });
    } catch (error) {
      if (controller.signal.aborted) {
        return errorResponse(
          504,
          "provider_timeout",
          requestId,
          extractionDiagnosticsHeaders,
          `Image processing exceeded the ${formatTimeoutSeconds(config.timeoutMs)}-second timeout. Images remain in the browser for another attempt.`,
        );
      }

      if (error instanceof ExtractionOutputValidationError) {
        return errorResponse(
          502,
          "invalid_provider_output",
          requestId,
          extractionDiagnosticsHeaders,
        );
      }

      return errorResponse(
        502,
        "provider_error",
        requestId,
        extractionDiagnosticsHeaders,
      );
    } finally {
      clearTimeout(timeout);
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
  message?: string,
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message: message ?? userFacingErrorMessage(code),
        request_id: requestId,
      },
    },
    {
      status,
      headers: withNoStoreHeaders(headers),
    },
  );
}

function formatTimeoutSeconds(timeoutMs: number): string {
  return new Intl.NumberFormat("fi-FI", {
    maximumFractionDigits: 1,
  }).format(timeoutMs / 1_000);
}

function userFacingErrorMessage(code: string): string {
  switch (code) {
    case "payload_too_large":
      return "The submission package exceeds the allowed size limit.";
    case "unsupported_media_type":
      return "The submission package contains an unsupported file format.";
    case "rate_limited":
      return "Too many extraction requests have been made. Try again in a moment.";
    case "provider_timeout":
      return "Image processing timed out. Images remain in the browser for another attempt.";
    case "invalid_provider_output":
      return "The response from the images was not in a safely processable format. Images remain in the browser.";
    case "provider_error":
      return "Image processing failed at the provider. Images remain in the browser for another attempt.";
    case "service_unavailable":
      return "The image extraction service is currently unavailable.";
    case "forbidden":
      return "The request could not be accepted.";
    default:
      return "The submission package could not be processed.";
  }
}
