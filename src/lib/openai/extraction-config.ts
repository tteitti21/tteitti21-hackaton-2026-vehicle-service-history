import { z } from "zod";

const DEFAULT_EXTRACTION_MODEL = "gpt-5.6-terra";
const DEFAULT_EXTRACTION_TIMEOUT_MS = 180_000;

const extractionEnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1),
  OPENAI_EXTRACTION_MODEL: z.preprocess(
    (value) =>
      value === undefined ||
      (typeof value === "string" && value.trim() === "")
        ? DEFAULT_EXTRACTION_MODEL
        : value,
    z.string().trim().min(1),
  ),
  OPENAI_EXTRACTION_TIMEOUT_MS: z
    .preprocess(
      (value) =>
        value === undefined || value === ""
          ? DEFAULT_EXTRACTION_TIMEOUT_MS
          : value,
      z.coerce.number().int().min(5_000).max(240_000),
    ),
});

export interface OpenAIExtractionConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export function readOpenAIExtractionConfig(
  environment: Record<string, string | undefined> = process.env,
): OpenAIExtractionConfig {
  const values = extractionEnvironmentSchema.parse(environment);

  return {
    apiKey: values.OPENAI_API_KEY,
    model: values.OPENAI_EXTRACTION_MODEL,
    timeoutMs: values.OPENAI_EXTRACTION_TIMEOUT_MS,
  };
}
