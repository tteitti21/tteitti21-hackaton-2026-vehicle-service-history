import { z } from "zod";

const DEFAULT_MAX_UPLOAD_FILES = 10;
const DEFAULT_MAX_UPLOAD_BYTES_PER_FILE = 20_971_520;
const MULTIPART_OVERHEAD_ALLOWANCE_BYTES = 1_048_576;

const positiveIntegerFromEnvironment = (fallback: number) =>
  z.preprocess(
    (value) => (value === undefined || value === "" ? fallback : value),
    z.coerce.number().int().positive().safe(),
  );

const uploadEnvironmentSchema = z.object({
  MAX_UPLOAD_FILES: positiveIntegerFromEnvironment(DEFAULT_MAX_UPLOAD_FILES),
  MAX_UPLOAD_BYTES_PER_FILE: positiveIntegerFromEnvironment(
    DEFAULT_MAX_UPLOAD_BYTES_PER_FILE,
  ),
});

export interface UploadLimits {
  maxFiles: number;
  maxBytesPerFile: number;
  maxRequestBytes: number;
}

export type RequestSizeValidation =
  | {
      ok: true;
      contentLength: number | null;
    }
  | {
      ok: false;
      code: "invalid_content_length" | "request_too_large";
      maximumBytes: number;
    };

export function readUploadLimits(
  environment: Record<string, string | undefined> = process.env,
): UploadLimits {
  const values = uploadEnvironmentSchema.parse(environment);
  const payloadBytes = values.MAX_UPLOAD_FILES * values.MAX_UPLOAD_BYTES_PER_FILE;
  const maxRequestBytes = payloadBytes + MULTIPART_OVERHEAD_ALLOWANCE_BYTES;

  if (!Number.isSafeInteger(maxRequestBytes)) {
    throw new Error("Configured upload limits exceed the safe integer range.");
  }

  return {
    maxFiles: values.MAX_UPLOAD_FILES,
    maxBytesPerFile: values.MAX_UPLOAD_BYTES_PER_FILE,
    maxRequestBytes,
  };
}

export function validateRequestContentLength(
  headers: Pick<Headers, "get">,
  maximumBytes: number,
): RequestSizeValidation {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
    throw new Error("maximumBytes must be a positive safe integer.");
  }

  const rawContentLength = headers.get("content-length");

  // HTTP requests can omit Content-Length. The eventual route must also enforce
  // the measured body size while parsing instead of relying only on this check.
  if (rawContentLength === null) {
    return { ok: true, contentLength: null };
  }

  if (!/^\d+$/.test(rawContentLength)) {
    return {
      ok: false,
      code: "invalid_content_length",
      maximumBytes,
    };
  }

  const contentLength = Number(rawContentLength);

  if (!Number.isSafeInteger(contentLength)) {
    return {
      ok: false,
      code: "invalid_content_length",
      maximumBytes,
    };
  }

  if (contentLength > maximumBytes) {
    return {
      ok: false,
      code: "request_too_large",
      maximumBytes,
    };
  }

  return { ok: true, contentLength };
}
