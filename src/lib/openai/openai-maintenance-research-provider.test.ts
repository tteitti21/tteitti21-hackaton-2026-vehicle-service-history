import { describe, expect, it, vi } from "vitest";

import { maintenanceResearchRequestFixture } from "@/test/maintenance-research-fixture";
import {
  buildOpenAIMaintenanceNormalizationRequest,
  buildOpenAIMaintenanceSearchRequest,
  OpenAIMaintenanceResearchProvider,
} from "./openai-maintenance-research-provider";
import { MaintenanceResearchOutputValidationError } from "./research-maintenance";

const sources = [
  {
    sourceId: "source-1",
    title: "Official schedule",
    publisher: "manufacturer.example",
    url: "https://manufacturer.example/schedule",
  },
];

const normalized = {
  components: [
    {
      component_code: "engine_oil",
      component_label: "Moottoriöljy",
      interval_claims: [
        {
          interval_km: 16_093,
          interval_months: null,
          whichever_first: false,
          conditions: "Normaali käyttö",
          original_value: 10_000,
          original_unit: "mi",
          source_id: "source-1",
          evidence: "Alkuperäinen taulukko ilmoittaa 10 000 mi.",
          authority_rank: 1,
          compatibility: "exact",
          compatibility_notes: "Moottori, vuosimalli ja markkina täsmäävät.",
        },
      ],
    },
  ],
  global_warnings: [],
};

describe("OpenAI maintenance research request builders", () => {
  it("requires web search, preserves all sources, and excludes odometer data", () => {
    const request = buildOpenAIMaintenanceSearchRequest(
      "test-model",
      maintenanceResearchRequestFixture,
    );
    const serialized = JSON.stringify(request);

    expect(request).toMatchObject({
      model: "test-model",
      stream: false,
      store: false,
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      tools: [{ type: "web_search", search_context_size: "high" }],
    });
    expect(serialized).toContain("Manufacturer manuals");
    expect(serialized).toContain("insufficient evidence");
    expect(serialized).not.toContain("184000");
    expect(request).not.toHaveProperty("background");
  });

  it("normalizes without tools or odometer and with strict Structured Outputs", () => {
    const request = buildOpenAIMaintenanceNormalizationRequest(
      "test-model",
      maintenanceResearchRequestFixture,
      "Untrusted memo",
      sources,
    );
    const serialized = JSON.stringify(request);

    expect(request.store).toBe(false);
    expect(request).not.toHaveProperty("tools");
    expect(request).not.toHaveProperty("background");
    expect(request.text?.format).toMatchObject({
      type: "json_schema",
      name: "maintenance_research_normalization",
      strict: true,
    });
    expect(serialized).toContain("source-1");
    expect(serialized).not.toContain("184000");
  });
});

describe("OpenAIMaintenanceResearchProvider", () => {
  it("hydrates captured sources, converts miles strictly, and fills missing components honestly", async () => {
    const signal = new AbortController().signal;
    const create = vi.fn().mockResolvedValue({
      output_text: "Evidence memo",
      output: [
        {
          type: "web_search_call",
          action: {
            type: "search",
            sources: [
              {
                type: "url",
                url: "https://manufacturer.example/schedule",
              },
            ],
          },
        },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "Evidence memo",
              annotations: [
                {
                  type: "url_citation",
                  url: "https://manufacturer.example/schedule",
                  title: "Official schedule",
                  start_index: 0,
                  end_index: 8,
                },
              ],
            },
          ],
        },
      ],
    });
    const parse = vi.fn().mockResolvedValue({ output_parsed: normalized });
    const provider = new OpenAIMaintenanceResearchProvider(
      {
        apiKey: "server-only-key",
        model: "test-model",
        timeoutMs: 10_000,
      },
      { responses: { create, parse } } as never,
      () => new Date("2026-07-19T12:00:00.000Z"),
    );

    const result = await provider.research(
      maintenanceResearchRequestFixture,
      signal,
    );

    expect(result.components[0]).toMatchObject({
      resolution: "resolved",
      recommended_claim_id: "claim-1",
      interval_claims: [
        {
          interval_km: 16_093,
          original_value: 10_000,
          original_unit: "mi",
          source: {
            url: "https://manufacturer.example/schedule",
            retrieved_at: "2026-07-19",
          },
        },
      ],
    });
    expect(result.components.slice(1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resolution: "insufficient_evidence",
          interval_claims: [],
        }),
      ]),
    );
    expect(result.global_warnings).toHaveLength(2);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ store: false }),
      { signal },
    );
    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({ store: false }),
      { signal },
    );
  });

  it.each([
    [
      "unknown source",
      {
        ...normalized,
        components: [
          {
            ...normalized.components[0],
            interval_claims: [
              {
                ...normalized.components[0].interval_claims[0],
                source_id: "source-999",
              },
            ],
          },
        ],
      },
    ],
    [
      "incorrect mile conversion",
      {
        ...normalized,
        components: [
          {
            ...normalized.components[0],
            interval_claims: [
              {
                ...normalized.components[0].interval_claims[0],
                interval_km: 16_000,
              },
            ],
          },
        ],
      },
    ],
    [
      "unsupported component",
      {
        ...normalized,
        components: [
          {
            ...normalized.components[0],
            component_code: "battery",
          },
        ],
      },
    ],
  ])("rejects %s instead of guessing", async (_label, outputParsed) => {
    const provider = createProvider(outputParsed);

    await expect(
      provider.research(
        maintenanceResearchRequestFixture,
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(MaintenanceResearchOutputValidationError);
  });
});

function createProvider(outputParsed: unknown) {
  return new OpenAIMaintenanceResearchProvider(
    {
      apiKey: "server-only-key",
      model: "test-model",
      timeoutMs: 10_000,
    },
    {
      responses: {
        create: vi.fn().mockResolvedValue({
          output_text: "Memo",
          output: [
            {
              type: "web_search_call",
              action: {
                type: "search",
                sources: [
                  {
                    type: "url",
                    url: "https://manufacturer.example/schedule",
                  },
                ],
              },
            },
          ],
        }),
        parse: vi.fn().mockResolvedValue({ output_parsed: outputParsed }),
      },
    } as never,
  );
}
