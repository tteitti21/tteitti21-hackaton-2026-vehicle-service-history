import { describe, expect, it } from "vitest";

import { readOpenAIExtractionConfig } from "./extraction-config";

describe("readOpenAIExtractionConfig", () => {
  it("uses the cost-balanced default model without exposing the key", () => {
    const config = readOpenAIExtractionConfig({
      OPENAI_API_KEY: "test-secret",
      OPENAI_EXTRACTION_MODEL: "  ",
    });

    expect(config).toEqual({
      apiKey: "test-secret",
      model: "gpt-5.6-terra",
      timeoutMs: 60_000,
    });
  });

  it("accepts model and timeout overrides", () => {
    expect(
      readOpenAIExtractionConfig({
        OPENAI_API_KEY: "test-secret",
        OPENAI_EXTRACTION_MODEL: "vision-capable-test-model",
        OPENAI_EXTRACTION_TIMEOUT_MS: "15000",
      }),
    ).toEqual({
      apiKey: "test-secret",
      model: "vision-capable-test-model",
      timeoutMs: 15_000,
    });
  });

  it("rejects a missing API key and unsafe timeout", () => {
    expect(() => readOpenAIExtractionConfig({})).toThrow();
    expect(() =>
      readOpenAIExtractionConfig({
        OPENAI_API_KEY: "test-secret",
        OPENAI_EXTRACTION_TIMEOUT_MS: "1000",
      }),
    ).toThrow();
  });
});
