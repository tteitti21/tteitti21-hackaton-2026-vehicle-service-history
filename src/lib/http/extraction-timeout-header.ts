export const EXTRACTION_TIMEOUT_MS_HEADER =
  "X-AutoHuolto-Extraction-Timeout-Ms";

export function createExtractionTimeoutResponseHeader(
  timeoutMs: number,
): Record<string, string> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Extraction timeout must be a positive safe integer.");
  }

  return {
    [EXTRACTION_TIMEOUT_MS_HEADER]: String(timeoutMs),
  };
}

export function readExtractionTimeoutResponseHeader(
  headers: Pick<Headers, "get">,
): number | null {
  const value = headers.get(EXTRACTION_TIMEOUT_MS_HEADER);

  if (value === null || !/^\d+$/.test(value)) {
    return null;
  }

  const timeoutMs = Number(value);
  return Number.isSafeInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : null;
}
