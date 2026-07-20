import type { MaintenanceResearch } from "@/domain/schemas/maintenance-research";
import type { MaintenanceResearchRequest } from "@/lib/validation/maintenance-research-request";
import { vehicleResolutionFixture } from "./vehicle-resolution-fixture";

export const maintenanceResearchRequestFixture: MaintenanceResearchRequest = {
  vehicle_variant: vehicleResolutionFixture.candidates[0].variant,
  current_odometer_km: 184_000,
  country: "FI",
  market: "Europe",
  components: [
    { component_code: "engine_oil", component_label: "Engine oil" },
    { component_code: "timing_belt", component_label: "Timing belt" },
    { component_code: "air_filter", component_label: "Engine air filter" },
  ],
};

const source = {
  title: "Official maintenance schedule",
  publisher: "manufacturer.example",
  url: "https://manufacturer.example/maintenance",
  retrieved_at: "2026-07-19",
};

export const maintenanceResearchFixture: MaintenanceResearch = {
  vehicle_variant: maintenanceResearchRequestFixture.vehicle_variant,
  components: [
    {
      component_code: "engine_oil",
      component_label: "Engine oil",
      resolution: "resolved",
      interval_claims: [
        {
          claim_id: "claim-1",
          interval_km: 15_000,
          interval_months: null,
          whichever_first: false,
          conditions: "Normal use",
          original_value: 15_000,
          original_unit: "km",
          source: {
            ...source,
            evidence: "The manufacturer table states a 15,000 km replacement interval.",
          },
          authority_rank: 1,
          compatibility: "exact",
          compatibility_notes: "The vehicle variant and market match.",
        },
      ],
      recommended_claim_id: "claim-1",
      conflict_summary: null,
    },
    {
      component_code: "timing_belt",
      component_label: "Timing belt",
      resolution: "conflicting_sources",
      interval_claims: [
        {
          claim_id: "claim-2",
          interval_km: 100_000,
          interval_months: null,
          whichever_first: false,
          conditions: null,
          original_value: 100_000,
          original_unit: "km",
          source: {
            ...source,
            evidence: "One official table states 100,000 km.",
          },
          authority_rank: 1,
          compatibility: "exact",
          compatibility_notes: "The engine code matches.",
        },
        {
          claim_id: "claim-3",
          interval_km: 120_000,
          interval_months: null,
          whichever_first: false,
          conditions: null,
          original_value: 120_000,
          original_unit: "km",
          source: {
            ...source,
            url: "https://manufacturer.example/bulletin",
            title: "Official maintenance bulletin",
            evidence: "Another official bulletin states 120,000 km.",
          },
          authority_rank: 1,
          compatibility: "exact",
          compatibility_notes: "The engine code matches.",
        },
      ],
      recommended_claim_id: null,
      conflict_summary:
        "The best source tier contains conflicting maintenance intervals. No interval was selected automatically.",
    },
    {
      component_code: "air_filter",
      component_label: "Engine air filter",
      resolution: "insufficient_evidence",
      interval_claims: [],
      recommended_claim_id: null,
      conflict_summary: null,
    },
  ],
  global_warnings: [
    "Engine air filter: the exact replacement interval could not be verified.",
  ],
  researched_at: "2026-07-19T12:00:00.000Z",
};
