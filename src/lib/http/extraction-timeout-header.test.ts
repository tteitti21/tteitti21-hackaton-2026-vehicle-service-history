import { describe, expect, it } from "vitest";

import {
  createExtractionTimeoutResponseHeader,
  readExtractionTimeoutResponseHeader,
} from "./extraction-timeout-header";

describe("extraction timeout response header", () => {
  it("round-trips a safe timeout without exposing request content", () => {
    const headers = new Headers(
      createExtractionTimeoutResponseHeader(180_000),
    );

    expect(readExtractionTimeoutResponseHeader(headers)).toBe(180_000);
  });

  it("ignores missing, invalid, and unsafe values", () => {
    expect(readExtractionTimeoutResponseHeader(new Headers())).toBeNull();
    expect(
      readExtractionTimeoutResponseHeader(
        new Headers({ "X-AutoHuolto-Extraction-Timeout-Ms": "invalid" }),
      ),
    ).toBeNull();
    expect(() => createExtractionTimeoutResponseHeader(0)).toThrow();
  });
});
