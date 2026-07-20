import { describe, expect, it } from "vitest";

import { readSafeApiError } from "./safe-client-error";

const messages = {
  rate_limited: "Wait a moment and try again.",
  provider_error: "The service request failed safely.",
} as const;

describe("readSafeApiError", () => {
  it("returns a reviewed local message for a known code", () => {
    expect(
      readSafeApiError(
        {
          error: {
            code: "rate_limited",
            message: "Untrusted response text",
          },
        },
        messages,
        "The request failed.",
      ),
    ).toBe("Wait a moment and try again.");
  });

  it("does not expose unknown or markup-bearing response messages", () => {
    expect(
      readSafeApiError(
        {
          error: {
            code: "unknown",
            message: "<script>sendSensitiveData()</script>",
          },
        },
        messages,
        "The request failed.",
      ),
    ).toBe("The request failed.");
  });
});
