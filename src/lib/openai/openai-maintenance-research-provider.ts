import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type {
  Response as OpenAIResponse,
  ResponseCreateParamsNonStreaming,
} from "openai/resources/responses/responses";
import { z } from "zod";

import { resolveComponentEvidence } from "@/domain/maintenance/source-hierarchy";
import {
  maintenanceResearchSchema,
  type IntervalClaim,
  type MaintenanceResearch,
} from "@/domain/schemas/maintenance-research";
import { componentCodeSchema } from "@/domain/schemas/service-history";
import {
  collectTrustedWebSources,
  type TrustedWebSource,
} from "@/lib/openai/openai-vehicle-resolution-provider";
import type { OpenAIVehicleResolutionConfig } from "@/lib/openai/vehicle-resolution-config";
import type { MaintenanceResearchRequest } from "@/lib/validation/maintenance-research-request";
import {
  MaintenanceResearchOutputValidationError,
  type MaintenanceResearchProvider,
} from "./research-maintenance";
import {
  buildMaintenanceNormalizationInput,
  buildMaintenanceSearchInput,
  MAINTENANCE_NORMALIZATION_SYSTEM_PROMPT,
  MAINTENANCE_SEARCH_SYSTEM_PROMPT,
} from "./maintenance-research-prompt";

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

interface OpenAIMaintenanceResearchClient {
  responses: ResponsesClient;
}

const boundedText = (maximumLength: number) =>
  z.string().trim().min(1).max(maximumLength);

const normalizedIntervalClaimSchema = z.strictObject({
  interval_km: z.number().int().positive().max(10_000_000).nullable(),
  interval_months: z.number().int().positive().max(1_200).nullable(),
  whichever_first: z.boolean(),
  conditions: boundedText(1_000).nullable(),
  original_value: z.number().positive().max(10_000_000).nullable(),
  original_unit: z
    .enum(["km", "mi", "months", "years", "mixed"])
    .nullable(),
  source_id: z.string().regex(/^source-[1-9]\d*$/),
  evidence: boundedText(2_000),
  authority_rank: z.number().int().min(1).max(6),
  compatibility: z.enum(["exact", "strong", "partial", "weak", "unknown"]),
  compatibility_notes: boundedText(1_000),
});

export const maintenanceResearchNormalizationSchema = z.strictObject({
  components: z
    .array(
      z.strictObject({
        component_code: componentCodeSchema,
        component_label: boundedText(160),
        interval_claims: z.array(normalizedIntervalClaimSchema).max(30),
      }),
    )
    .max(19),
  global_warnings: z.array(boundedText(1_000)).max(50),
});

type NormalizedMaintenanceResearch = z.infer<
  typeof maintenanceResearchNormalizationSchema
>;

export class OpenAIMaintenanceResearchProvider
  implements MaintenanceResearchProvider
{
  private readonly client: OpenAIMaintenanceResearchClient;
  private readonly model: string;
  private readonly now: () => Date;

  constructor(
    config: OpenAIVehicleResolutionConfig,
    client: OpenAIMaintenanceResearchClient = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeoutMs,
      maxRetries: 0,
    }) as unknown as OpenAIMaintenanceResearchClient,
    now: () => Date = () => new Date(),
  ) {
    this.client = client;
    this.model = config.model;
    this.now = now;
  }

  async research(
    request: MaintenanceResearchRequest,
    signal: AbortSignal,
  ): Promise<MaintenanceResearch> {
    const searchResponse = await this.client.responses.create(
      buildOpenAIMaintenanceSearchRequest(this.model, request),
      { signal },
    );
    const sources = collectTrustedWebSources(searchResponse);

    if (searchResponse.output_text.trim() === "" || sources.length === 0) {
      throw new MaintenanceResearchOutputValidationError();
    }

    const normalizationResponse = await this.client.responses.parse(
      buildOpenAIMaintenanceNormalizationRequest(
        this.model,
        request,
        searchResponse.output_text,
        sources,
      ),
      { signal },
    );
    const normalized = maintenanceResearchNormalizationSchema.safeParse(
      normalizationResponse.output_parsed,
    );

    if (!normalized.success) {
      throw new MaintenanceResearchOutputValidationError();
    }

    return hydrateMaintenanceResearch(
      normalized.data,
      request,
      sources,
      this.now(),
    );
  }
}

export function buildOpenAIMaintenanceSearchRequest(
  model: string,
  request: MaintenanceResearchRequest,
): ResponseCreateParamsNonStreaming {
  return {
    model,
    stream: false,
    store: false,
    max_output_tokens: 12_000,
    tools: [{ type: "web_search", search_context_size: "high" }],
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
    input: [
      { role: "system", content: MAINTENANCE_SEARCH_SYSTEM_PROMPT },
      { role: "user", content: buildMaintenanceSearchInput(request) },
    ],
  };
}

export function buildOpenAIMaintenanceNormalizationRequest(
  model: string,
  request: MaintenanceResearchRequest,
  memo: string,
  sources: ReadonlyArray<TrustedWebSource>,
): ResponseCreateParamsNonStreaming {
  return {
    model,
    stream: false,
    store: false,
    max_output_tokens: 12_000,
    input: [
      { role: "system", content: MAINTENANCE_NORMALIZATION_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildMaintenanceNormalizationInput(request, memo, sources),
      },
    ],
    text: {
      format: zodTextFormat(
        maintenanceResearchNormalizationSchema,
        "maintenance_research_normalization",
      ),
    },
  };
}

function hydrateMaintenanceResearch(
  normalized: NormalizedMaintenanceResearch,
  request: MaintenanceResearchRequest,
  sources: ReadonlyArray<TrustedWebSource>,
  researchedAt: Date,
): MaintenanceResearch {
  const requestedCodes = new Set(
    request.components.map((component) => component.component_code),
  );
  const normalizedByCode = new Map<
    string,
    NormalizedMaintenanceResearch["components"][number]
  >();

  for (const component of normalized.components) {
    if (
      !requestedCodes.has(component.component_code) ||
      normalizedByCode.has(component.component_code)
    ) {
      throw new MaintenanceResearchOutputValidationError();
    }
    normalizedByCode.set(component.component_code, component);
  }

  const sourceById = new Map(sources.map((source) => [source.sourceId, source]));
  const retrievalDate = researchedAt.toISOString().slice(0, 10);
  let claimNumber = 0;
  const missingLabels: string[] = [];

  const components = request.components.map((requested) => {
    const component = normalizedByCode.get(requested.component_code);
    if (component === undefined || component.interval_claims.length === 0) {
      missingLabels.push(requested.component_label);
      return resolveComponentEvidence({
        ...requested,
        interval_claims: [],
      });
    }

    const intervalClaims = component.interval_claims.map((claim) => {
      const source = sourceById.get(claim.source_id);
      if (source === undefined || !hasValidNormalizedUnits(claim)) {
        throw new MaintenanceResearchOutputValidationError();
      }

      claimNumber += 1;
      return {
        claim_id: `claim-${claimNumber}`,
        interval_km: claim.interval_km,
        interval_months: claim.interval_months,
        whichever_first: claim.whichever_first,
        conditions: claim.conditions,
        original_value: claim.original_value,
        original_unit: claim.original_unit,
        source: {
          title: source.title,
          publisher: source.publisher,
          url: source.url,
          retrieved_at: retrievalDate,
          evidence: claim.evidence,
        },
        authority_rank: claim.authority_rank,
        compatibility: claim.compatibility,
        compatibility_notes: claim.compatibility_notes,
      } satisfies IntervalClaim;
    });

    return resolveComponentEvidence({
      component_code: requested.component_code,
      component_label: requested.component_label,
      interval_claims: intervalClaims,
    });
  });

  const result = {
    vehicle_variant: request.vehicle_variant,
    components,
    global_warnings: [
      ...normalized.global_warnings,
      ...missingLabels.map(
        (label) =>
          `${label}: the exact replacement interval could not be verified from sufficiently reliable sources compatible with this vehicle variant.`,
      ),
    ],
    researched_at: researchedAt.toISOString(),
  };
  const parsed = maintenanceResearchSchema.safeParse(result);
  if (!parsed.success) {
    throw new MaintenanceResearchOutputValidationError();
  }
  return parsed.data;
}

function hasValidNormalizedUnits(
  claim: z.infer<typeof normalizedIntervalClaimSchema>,
): boolean {
  const hasDistance = claim.interval_km !== null;
  const hasTime = claim.interval_months !== null;

  if (!hasDistance && !hasTime) {
    return false;
  }

  if (hasDistance && hasTime) {
    return (
      claim.whichever_first &&
      claim.original_unit === "mixed" &&
      claim.original_value === null
    );
  }

  if (
    claim.whichever_first ||
    claim.original_value === null ||
    claim.original_unit === null ||
    claim.original_unit === "mixed"
  ) {
    return false;
  }

  if (hasDistance) {
    if (!["km", "mi"].includes(claim.original_unit)) {
      return false;
    }
    const expectedKilometres =
      claim.original_unit === "mi"
        ? Math.round(claim.original_value * 1.609344)
        : Math.round(claim.original_value);
    return claim.interval_km === expectedKilometres;
  }

  if (!["months", "years"].includes(claim.original_unit)) {
    return false;
  }
  const expectedMonths =
    claim.original_unit === "years"
      ? Math.round(claim.original_value * 12)
      : Math.round(claim.original_value);
  return claim.interval_months === expectedMonths;
}
