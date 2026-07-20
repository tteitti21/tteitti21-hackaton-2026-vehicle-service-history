import { describe, expect, it } from "vitest";

import type { IntervalClaim } from "@/domain/schemas/maintenance-research";
import {
  assessComponentTrustworthiness,
  assessSourceTrustworthiness,
  resolveComponentEvidence,
} from "./source-hierarchy";

const baseClaim: IntervalClaim = {
  claim_id: "claim-1",
  interval_km: 15_000,
  interval_months: null,
  whichever_first: false,
  conditions: null,
  original_value: 15_000,
  original_unit: "km",
  source: {
    title: "Source",
    publisher: "manufacturer.example",
    url: "https://manufacturer.example/schedule",
    retrieved_at: "2026-07-19",
    evidence: "15 000 km",
  },
  authority_rank: 1,
  compatibility: "exact",
  compatibility_notes: "Täsmää.",
};

describe("resolveComponentEvidence", () => {
  it("selects the strongest compatible source without a model decision", () => {
    const result = resolveComponentEvidence({
      component_code: "engine_oil",
      component_label: "Moottoriöljy",
      interval_claims: [
        {
          ...baseClaim,
          authority_rank: 4,
          claim_id: "claim-1",
          interval_km: 20_000,
          original_value: 20_000,
        },
        { ...baseClaim, authority_rank: 1, claim_id: "claim-2" },
      ],
    });

    expect(result).toMatchObject({
      resolution: "resolved",
      recommended_claim_id: "claim-2",
      conflict_summary: null,
    });
  });

  it("exposes conflicts at the best rank and never silently chooses", () => {
    const result = resolveComponentEvidence({
      component_code: "timing_belt",
      component_label: "Jakohihna",
      interval_claims: [
        baseClaim,
        {
          ...baseClaim,
          claim_id: "claim-2",
          interval_km: 20_000,
          original_value: 20_000,
        },
      ],
    });

    expect(result.resolution).toBe("conflicting_sources");
    expect(result.recommended_claim_id).toBeNull();
    expect(result.conflict_summary).toContain("ristiriitaisia");
  });

  it("returns insufficient evidence for weak, partial, or low-authority claims", () => {
    const result = resolveComponentEvidence({
      component_code: "air_filter",
      component_label: "Ilmansuodatin",
      interval_claims: [
        {
          ...baseClaim,
          compatibility: "partial",
          authority_rank: 2,
        },
        {
          ...baseClaim,
          claim_id: "claim-2",
          compatibility: "exact",
          authority_rank: 5,
        },
      ],
    });

    expect(result).toMatchObject({
      resolution: "insufficient_evidence",
      recommended_claim_id: null,
    });
  });

  it("scores source quality and lowers the suggestion score for conflicts", () => {
    expect(assessSourceTrustworthiness(1, "exact")).toMatchObject({
      level: "high",
    });
    expect(assessSourceTrustworthiness(4, "strong")).toMatchObject({
      level: "medium",
    });
    expect(assessSourceTrustworthiness(6, "weak")).toMatchObject({
      level: "low",
    });

    const conflict = resolveComponentEvidence({
      component_code: "timing_belt",
      component_label: "Jakohihna",
      interval_claims: [
        baseClaim,
        {
          ...baseClaim,
          claim_id: "claim-2",
          interval_km: 20_000,
          original_value: 20_000,
        },
      ],
    });
    expect(assessComponentTrustworthiness(conflict)).toMatchObject({
      level: "low",
      note_fi: expect.stringContaining("eri huoltovälejä"),
    });
  });
});
