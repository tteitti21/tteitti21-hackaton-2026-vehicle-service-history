export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
} as const;

export function withNoStoreHeaders(
  headers: HeadersInit = {},
): Headers {
  const result = new Headers(headers);

  for (const [name, value] of Object.entries(NO_STORE_HEADERS)) {
    result.set(name, value);
  }

  return result;
}
