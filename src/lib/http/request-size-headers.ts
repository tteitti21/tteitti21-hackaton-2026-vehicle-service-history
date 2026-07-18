export const REQUEST_BODY_BYTES_HEADER =
  "X-AutoHuolto-Request-Body-Bytes";
export const REQUEST_BODY_LIMIT_HEADER =
  "X-AutoHuolto-Request-Body-Limit-Bytes";

export interface RequestSizeResponseDetails {
  requestBodyBytes: number | null;
  maximumRequestBytes: number | null;
}

export function createRequestSizeResponseHeaders(
  requestHeaders: Pick<Headers, "get">,
  maximumRequestBytes: number,
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (
    Number.isSafeInteger(maximumRequestBytes) &&
    maximumRequestBytes > 0
  ) {
    headers[REQUEST_BODY_LIMIT_HEADER] = String(maximumRequestBytes);
  }

  const contentLength = parseSafeByteCount(
    requestHeaders.get("content-length"),
  );

  if (contentLength !== null) {
    headers[REQUEST_BODY_BYTES_HEADER] = String(contentLength);
  }

  return headers;
}

export function readRequestSizeResponseHeaders(
  responseHeaders: Pick<Headers, "get">,
): RequestSizeResponseDetails {
  return {
    requestBodyBytes: parseSafeByteCount(
      responseHeaders.get(REQUEST_BODY_BYTES_HEADER),
    ),
    maximumRequestBytes: parseSafeByteCount(
      responseHeaders.get(REQUEST_BODY_LIMIT_HEADER),
    ),
  };
}

function parseSafeByteCount(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) {
    return null;
  }

  const bytes = Number(value);
  return Number.isSafeInteger(bytes) ? bytes : null;
}
