import { describe, expect, it } from "vitest";

import { readOpenAIVehicleResolutionConfig } from "./vehicle-resolution-config";

describe("readOpenAIVehicleResolutionConfig", () => {
  it("prefers the research model and timeout", () => {
    expect(
      readOpenAIVehicleResolutionConfig({
        OPENAI_API_KEY: "server-key",
        OPENAI_RESEARCH_MODEL: "research-model",
        OPENAI_EXTRACTION_MODEL: "extraction-model",
        OPENAI_RESEARCH_TIMEOUT_MS: "90000",
        OPENAI_EXTRACTION_TIMEOUT_MS: "60000",
      }),
    ).toEqual({
      apiKey: "server-key",
      model: "research-model",
      timeoutMs: 90_000,
    });
  });

  it("falls back to extraction settings and safe defaults", () => {
    expect(
      readOpenAIVehicleResolutionConfig({
        OPENAI_API_KEY: "server-key",
        OPENAI_RESEARCH_MODEL: "",
        OPENAI_EXTRACTION_MODEL: "shared-model",
        OPENAI_EXTRACTION_TIMEOUT_MS: "120000",
      }),
    ).toEqual({
      apiKey: "server-key",
      model: "shared-model",
      timeoutMs: 120_000,
    });

    expect(
      readOpenAIVehicleResolutionConfig({
        OPENAI_API_KEY: "server-key",
      }),
    ).toMatchObject({
      model: "gpt-5.6-terra",
      timeoutMs: 180_000,
    });
  });

  it("rejects missing keys and unsafe timeouts", () => {
    expect(() => readOpenAIVehicleResolutionConfig({})).toThrow();
    expect(() =>
      readOpenAIVehicleResolutionConfig({
        OPENAI_API_KEY: "server-key",
        OPENAI_RESEARCH_TIMEOUT_MS: "1000",
      }),
    ).toThrow();
  });
});
