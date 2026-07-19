import { z } from "zod";

const DEFAULT_RESEARCH_MODEL = "gpt-5.6-terra";
const DEFAULT_RESEARCH_TIMEOUT_MS = 180_000;

const vehicleResolutionEnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1),
  OPENAI_RESEARCH_MODEL: z.string().trim().optional(),
  OPENAI_EXTRACTION_MODEL: z.string().trim().optional(),
  OPENAI_RESEARCH_TIMEOUT_MS: z.string().trim().optional(),
  OPENAI_EXTRACTION_TIMEOUT_MS: z.string().trim().optional(),
});

export interface OpenAIVehicleResolutionConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export function readOpenAIVehicleResolutionConfig(
  environment: Record<string, string | undefined> = process.env,
): OpenAIVehicleResolutionConfig {
  const values = vehicleResolutionEnvironmentSchema.parse(environment);
  const model =
    nonEmpty(values.OPENAI_RESEARCH_MODEL) ??
    nonEmpty(values.OPENAI_EXTRACTION_MODEL) ??
    DEFAULT_RESEARCH_MODEL;
  const timeoutMs = parseTimeout(
    nonEmpty(values.OPENAI_RESEARCH_TIMEOUT_MS) ??
      nonEmpty(values.OPENAI_EXTRACTION_TIMEOUT_MS),
  );

  return {
    apiKey: values.OPENAI_API_KEY,
    model,
    timeoutMs,
  };
}

function nonEmpty(value: string | undefined): string | undefined {
  return value === undefined || value === "" ? undefined : value;
}

function parseTimeout(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_RESEARCH_TIMEOUT_MS;
  }

  return z.coerce.number().int().min(5_000).max(240_000).parse(value);
}
