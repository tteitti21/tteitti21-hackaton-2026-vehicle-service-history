export type SafeErrorMessages = Readonly<Record<string, string>>;

/**
 * Selects a local, reviewed message by machine-readable error code.
 *
 * API and intermediary response text is intentionally ignored. React escapes
 * text by default, but allowlisting the code also prevents an upstream service
 * from showing unreviewed or sensitive details to the user.
 */
export function readSafeApiError(
  payload: unknown,
  messages: SafeErrorMessages,
  fallback: string,
): string {
  const code = readErrorCode(payload);

  return code === null ? fallback : (messages[code] ?? fallback);
}

function readErrorCode(payload: unknown): string | null {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("error" in payload) ||
    typeof payload.error !== "object" ||
    payload.error === null ||
    !("code" in payload.error) ||
    typeof payload.error.code !== "string"
  ) {
    return null;
  }

  return payload.error.code;
}
