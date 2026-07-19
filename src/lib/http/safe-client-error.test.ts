import { describe, expect, it } from "vitest";

import { readSafeApiError } from "./safe-client-error";

const messages = {
  rate_limited: "Odota hetki ja yritä uudelleen.",
  provider_error: "Palvelupyyntö epäonnistui turvallisesti.",
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
        "Pyyntö epäonnistui.",
      ),
    ).toBe("Odota hetki ja yritä uudelleen.");
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
        "Pyyntö epäonnistui.",
      ),
    ).toBe("Pyyntö epäonnistui.");
  });
});
