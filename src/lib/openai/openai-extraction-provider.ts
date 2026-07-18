import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";

import { serviceHistorySchema } from "@/domain/schemas/service-history";
import type {
  ExtractionAttemptInput,
  ExtractionAttemptProvider,
} from "@/lib/openai/extract-service-history";
import type { OpenAIExtractionConfig } from "@/lib/openai/extraction-config";
import {
  EXTRACTION_RETRY_INSTRUCTION,
  EXTRACTION_SYSTEM_PROMPT,
} from "@/lib/openai/extraction-prompt";

type ParsedExtractionResponse = Awaited<
  ReturnType<OpenAI["responses"]["parse"]>
>;

interface ResponsesParser {
  parse(
    body: ResponseCreateParamsNonStreaming,
    options?: { signal?: AbortSignal },
  ): Promise<ParsedExtractionResponse>;
}

interface OpenAIExtractionClient {
  responses: ResponsesParser;
}

export class OpenAIExtractionProvider implements ExtractionAttemptProvider {
  private readonly client: OpenAIExtractionClient;
  private readonly model: string;

  constructor(
    config: OpenAIExtractionConfig,
    client: OpenAIExtractionClient = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeoutMs,
      maxRetries: 0,
    }),
  ) {
    this.client = client;
    this.model = config.model;
  }

  async extract(input: ExtractionAttemptInput): Promise<unknown> {
    const response = await this.client.responses.parse(
      buildOpenAIExtractionRequest(this.model, input),
      { signal: input.signal },
    );

    return response.output_parsed;
  }
}

export function buildOpenAIExtractionRequest(
  model: string,
  input: Pick<ExtractionAttemptInput, "images" | "retry">,
): ResponseCreateParamsNonStreaming {
  const imageContent = input.images.flatMap((image) => [
    {
      type: "input_text" as const,
      text: `Source image ID: ${image.imageId}`,
    },
    {
      type: "input_image" as const,
      detail: "high" as const,
      image_url: `data:${image.mediaType};base64,${Buffer.from(image.bytes).toString("base64")}`,
    },
  ]);

  return {
    model,
    store: false,
    max_output_tokens: 12_000,
    input: [
      {
        role: "system",
        content: EXTRACTION_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: input.retry
              ? EXTRACTION_RETRY_INSTRUCTION
              : "Extract supported service-history evidence from the supplied sanitized images.",
          },
          ...imageContent,
        ],
      },
    ],
    text: {
      format: zodTextFormat(serviceHistorySchema, "service_history_extraction"),
    },
  };
}
