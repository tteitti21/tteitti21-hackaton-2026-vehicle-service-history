import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type {
  Response as OpenAIResponse,
  ResponseCreateParamsNonStreaming,
} from "openai/resources/responses/responses";
import { z } from "zod";

import {
  vehicleResolutionSchema,
  type VehicleResolution,
  type VehicleResolutionSource,
} from "@/domain/schemas/vehicle-resolution";
import { vehicleVariantSchema } from "@/domain/schemas/maintenance-research";
import type { VehicleInput } from "@/domain/vehicle/vehicle-input";
import type { OpenAIVehicleResolutionConfig } from "@/lib/openai/vehicle-resolution-config";
import {
  VehicleResolutionOutputValidationError,
  type VehicleResolutionProvider,
} from "@/lib/openai/resolve-vehicle";
import {
  buildVehicleNormalizationInput,
  buildVehicleSearchInput,
  VEHICLE_NORMALIZATION_SYSTEM_PROMPT,
  VEHICLE_SEARCH_SYSTEM_PROMPT,
} from "@/lib/openai/vehicle-resolution-prompt";

interface ResponsesClient {
  create(
    body: ResponseCreateParamsNonStreaming,
    options?: { signal?: AbortSignal },
  ): Promise<OpenAIResponse>;
  parse(
    body: ResponseCreateParamsNonStreaming,
    options?: { signal?: AbortSignal },
  ): Promise<{ output_parsed: unknown }>;
}

interface OpenAIVehicleResolutionClient {
  responses: ResponsesClient;
}

interface TrustedWebSource extends VehicleResolutionSource {
  sourceId: string;
}

const boundedText = (maximumLength: number) =>
  z.string().trim().min(1).max(maximumLength);

const normalizedSourceEvidenceSchema = z.strictObject({
  source_id: z.string().regex(/^source-[1-9]\d*$/),
  evidence: boundedText(2_000),
});

export const vehicleResolutionNormalizationSchema = z.strictObject({
  candidates: z
    .array(
      z.strictObject({
        variant: vehicleVariantSchema,
        compatibility: z.enum([
          "exact",
          "strong",
          "partial",
          "weak",
          "unknown",
        ]),
        compatibility_explanation: boundedText(2_000),
        matching_fields: z.array(boundedText(120)).max(20),
        conflicting_fields: z.array(boundedText(120)).max(20),
        missing_distinguishing_fields: z.array(boundedText(120)).max(20),
        source_evidence: z.array(normalizedSourceEvidenceSchema).min(1).max(10),
      }),
    )
    .max(5),
  warnings: z.array(boundedText(1_000)).max(20),
});

type NormalizedVehicleResolution = z.infer<
  typeof vehicleResolutionNormalizationSchema
>;

export class OpenAIVehicleResolutionProvider
  implements VehicleResolutionProvider
{
  private readonly client: OpenAIVehicleResolutionClient;
  private readonly model: string;
  private readonly now: () => Date;

  constructor(
    config: OpenAIVehicleResolutionConfig,
    client: OpenAIVehicleResolutionClient = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeoutMs,
      maxRetries: 0,
    }) as unknown as OpenAIVehicleResolutionClient,
    now: () => Date = () => new Date(),
  ) {
    this.client = client;
    this.model = config.model;
    this.now = now;
  }

  async resolve(
    vehicle: VehicleInput,
    signal: AbortSignal,
  ): Promise<VehicleResolution> {
    const searchResponse = await this.client.responses.create(
      buildOpenAIVehicleSearchRequest(this.model, vehicle),
      { signal },
    );
    const sources = collectTrustedWebSources(searchResponse as OpenAIResponse);

    if (searchResponse.output_text.trim() === "" || sources.length === 0) {
      throw new VehicleResolutionOutputValidationError();
    }

    const normalizationResponse = await this.client.responses.parse(
      buildOpenAIVehicleNormalizationRequest(
        this.model,
        vehicle,
        searchResponse.output_text,
        sources,
      ),
      { signal },
    );
    const normalized = vehicleResolutionNormalizationSchema.safeParse(
      normalizationResponse.output_parsed,
    );

    if (!normalized.success) {
      throw new VehicleResolutionOutputValidationError();
    }

    return hydrateResolution(normalized.data, sources, this.now());
  }
}

export function buildOpenAIVehicleSearchRequest(
  model: string,
  vehicle: VehicleInput,
): ResponseCreateParamsNonStreaming {
  return {
    model,
    stream: false,
    store: false,
    max_output_tokens: 6_000,
    tools: [
      {
        type: "web_search",
        search_context_size: "high",
      },
    ],
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
    input: [
      {
        role: "system",
        content: VEHICLE_SEARCH_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: buildVehicleSearchInput(vehicle),
      },
    ],
  };
}

export function buildOpenAIVehicleNormalizationRequest(
  model: string,
  vehicle: VehicleInput,
  memo: string,
  sources: ReadonlyArray<TrustedWebSource>,
): ResponseCreateParamsNonStreaming {
  return {
    model,
    stream: false,
    store: false,
    max_output_tokens: 6_000,
    input: [
      {
        role: "system",
        content: VEHICLE_NORMALIZATION_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: buildVehicleNormalizationInput(vehicle, memo, sources),
      },
    ],
    text: {
      format: zodTextFormat(
        vehicleResolutionNormalizationSchema,
        "vehicle_resolution",
      ),
    },
  };
}

export function collectTrustedWebSources(
  response: Pick<OpenAIResponse, "output">,
): TrustedWebSource[] {
  const sources = new Map<
    string,
    Omit<TrustedWebSource, "sourceId">
  >();

  const addSource = (rawUrl: string, title?: string) => {
    const url = normalizeHttpUrl(rawUrl);
    if (url === null) {
      return;
    }

    const publisher = new URL(url).hostname.replace(/^www\./, "");
    const current = sources.get(url);
    sources.set(url, {
      url,
      title: title?.trim() || current?.title || publisher,
      publisher,
    });
  };

  for (const item of response.output) {
    if (item.type === "web_search_call") {
      if (item.action.type === "search") {
        for (const source of item.action.sources ?? []) {
          addSource(source.url);
        }
      } else if (item.action.type === "open_page" && item.action.url) {
        addSource(item.action.url);
      } else if (item.action.type === "find_in_page") {
        addSource(item.action.url);
      }
      continue;
    }

    if (item.type !== "message") {
      continue;
    }

    for (const content of item.content) {
      if (content.type !== "output_text") {
        continue;
      }

      for (const annotation of content.annotations) {
        if (annotation.type === "url_citation") {
          addSource(annotation.url, annotation.title);
        }
      }
    }
  }

  return [...sources.values()].slice(0, 50).map((source, index) => ({
    sourceId: `source-${index + 1}`,
    ...source,
  }));
}

function hydrateResolution(
  normalized: NormalizedVehicleResolution,
  sources: ReadonlyArray<TrustedWebSource>,
  resolvedAt: Date,
): VehicleResolution {
  const sourceById = new Map(sources.map((source) => [source.sourceId, source]));
  const candidates = normalized.candidates.map((candidate, index) => {
    const usedSourceIds = new Set<string>();
    const candidateSources = candidate.source_evidence.map((reference) => {
      const source = sourceById.get(reference.source_id);

      if (source === undefined || usedSourceIds.has(reference.source_id)) {
        throw new VehicleResolutionOutputValidationError();
      }
      usedSourceIds.add(reference.source_id);

      return {
        title: source.title,
        publisher: source.publisher,
        url: source.url,
        evidence: reference.evidence,
      };
    });

    return {
      candidate_id: `candidate-${index + 1}`,
      variant: candidate.variant,
      compatibility: candidate.compatibility,
      compatibility_explanation: candidate.compatibility_explanation,
      matching_fields: candidate.matching_fields,
      conflicting_fields: candidate.conflicting_fields,
      missing_distinguishing_fields:
        candidate.missing_distinguishing_fields,
      sources: candidateSources,
    };
  });

  const resolution = {
    candidates,
    sources: sources.map((source) => ({
      title: source.title,
      publisher: source.publisher,
      url: source.url,
    })),
    warnings: normalized.warnings,
    resolved_at: resolvedAt.toISOString(),
  };
  const parsed = vehicleResolutionSchema.safeParse(resolution);

  if (!parsed.success) {
    throw new VehicleResolutionOutputValidationError();
  }

  return parsed.data;
}

function normalizeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
