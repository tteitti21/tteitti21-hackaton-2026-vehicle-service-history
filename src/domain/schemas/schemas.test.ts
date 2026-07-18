import { describe, expect, it } from "vitest";

import { componentStatusSchema } from "./component-status";
import { maintenanceResearchSchema } from "./maintenance-research";
import { serviceHistorySchema } from "./service-history";

const validServiceHistory = {
  images: [
    {
      image_id: "image-1",
      readability: 0.92,
      notes: null,
    },
  ],
  events: [
    {
      event_id: "event-1",
      source_image_ids: ["image-1"],
      raw_evidence: "Öljy ja suodatin vaihdettu 12.3.2024, 120000 km",
      service_date: {
        value: "2024-03-12",
        precision: "day",
        confidence: 0.96,
      },
      odometer: {
        value: 120_000,
        unit: "km",
        confidence: 0.95,
      },
      actions: [
        {
          component_code: "engine_oil",
          component_label: "Moottoriöljy",
          action_type: "replaced",
          description: "Moottoriöljy vaihdettu",
          confidence: 0.94,
        },
      ],
      workshop: null,
      notes: null,
      confidence: 0.93,
      ambiguities: [],
    },
  ],
  warnings: [],
};

const validMaintenanceResearch = {
  vehicle_variant: {
    make: "Example",
    model: "Tourer",
    generation: "X1",
    model_year: 2020,
    engine: "2.0",
    transmission: "automatic",
    market: "FI",
    confidence: 0.9,
    unresolved_fields: [],
  },
  components: [
    {
      component_code: "engine_oil",
      component_label: "Moottoriöljy",
      resolution: "resolved",
      interval_claims: [
        {
          claim_id: "claim-1",
          interval_km: 15_000,
          interval_months: 12,
          whichever_first: true,
          conditions: "Normal use",
          original_value: 15_000,
          original_unit: "km",
          source: {
            title: "Synthetic maintenance schedule",
            publisher: "Example Motors",
            url: "https://example.com/maintenance",
            retrieved_at: "2026-07-18",
            evidence: "Replace every 15,000 km or 12 months.",
          },
          authority_rank: 1,
          compatibility: "exact",
          compatibility_notes: "Exact synthetic variant match.",
        },
      ],
      recommended_claim_id: "claim-1",
      conflict_summary: null,
    },
  ],
  global_warnings: [],
  researched_at: "2026-07-18T10:00:00Z",
};

const validComponentStatus = {
  component_code: "engine_oil",
  status: "ok",
  reason_codes: ["within_interval"],
  last_service_event_id: "event-1",
  interval_claim_id: "claim-1",
  distance_used_km: 5_000,
  distance_remaining_km: 10_000,
  months_used: 4,
  months_remaining: 8,
};

describe("serviceHistorySchema", () => {
  it("accepts a valid extraction", () => {
    expect(serviceHistorySchema.parse(validServiceHistory)).toEqual(
      validServiceHistory,
    );
  });

  it("rejects missing required fields", () => {
    expect(
      serviceHistorySchema.safeParse({
        images: validServiceHistory.images,
        events: validServiceHistory.events,
      }).success,
    ).toBe(false);
  });

  it("rejects unexpected fields", () => {
    expect(
      serviceHistorySchema.safeParse({
        ...validServiceHistory,
        persisted: true,
      }).success,
    ).toBe(false);
  });

  it("rejects invalid enum values and negative odometers", () => {
    const invalid = structuredClone(validServiceHistory);
    invalid.events[0].odometer = {
      value: -1,
      unit: "yards",
      confidence: 0.95,
    } as never;

    expect(serviceHistorySchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects confidence outside zero and one", () => {
    const invalid = structuredClone(validServiceHistory);
    invalid.images[0].readability = 1.01;

    expect(serviceHistorySchema.safeParse(invalid).success).toBe(false);
  });
});

describe("maintenanceResearchSchema", () => {
  it("accepts a valid source-backed result", () => {
    expect(maintenanceResearchSchema.parse(validMaintenanceResearch)).toEqual(
      validMaintenanceResearch,
    );
  });

  it("rejects malformed source URLs", () => {
    const invalid = structuredClone(validMaintenanceResearch);
    invalid.components[0].interval_claims[0].source.url = "not-a-url";

    expect(maintenanceResearchSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects unsupported interval-unit representations", () => {
    const invalid = structuredClone(validMaintenanceResearch);
    invalid.components[0].interval_claims[0].original_unit = "miles";

    expect(maintenanceResearchSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects invalid timestamps", () => {
    expect(
      maintenanceResearchSchema.safeParse({
        ...validMaintenanceResearch,
        researched_at: "today",
      }).success,
    ).toBe(false);
  });
});

describe("componentStatusSchema", () => {
  it("accepts deterministic status output", () => {
    expect(componentStatusSchema.parse(validComponentStatus)).toEqual(
      validComponentStatus,
    );
  });

  it("rejects model-invented status categories", () => {
    expect(
      componentStatusSchema.safeParse({
        ...validComponentStatus,
        status: "probably_ok",
      }).success,
    ).toBe(false);
  });
});
