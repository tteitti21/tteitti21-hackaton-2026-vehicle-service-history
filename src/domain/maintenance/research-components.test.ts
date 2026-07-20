import { describe, expect, it } from "vitest";

import type { MaintenanceResearch } from "@/domain/schemas/maintenance-research";
import type { ServiceHistory } from "@/domain/schemas/service-history";
import {
  deriveResearchComponents,
  ensureMaintenanceResearchCoverage,
} from "./research-components";

const emptyHistory: ServiceHistory = {
  images: [],
  events: [],
  warnings: [],
};

describe("deriveResearchComponents", () => {
  it("combines standard schedule categories with reviewed history actions", () => {
    const components = deriveResearchComponents({
      images: [],
      events: [
        {
          event_id: "event-1",
          source_image_ids: ["image-1"],
          raw_evidence: "Battery replaced",
          service_date: null,
          odometer: null,
          actions: [
            {
              component_code: "battery",
              component_label: "Starter battery",
              action_type: "replaced",
              description: "Battery replaced",
              confidence: 1,
            },
          ],
          workshop: null,
          notes: null,
          confidence: 1,
          ambiguities: [],
        },
      ],
      warnings: [],
    });

    expect(components).toContainEqual({
      component_code: "engine_oil",
      component_label: expect.any(String),
    });
    expect(components).toContainEqual({
      component_code: "battery",
      component_label: "Battery",
    });
    expect(
      components.filter(({ component_code }) => component_code === "battery"),
    ).toHaveLength(1);
  });

  it("includes every mandatory automatic-powertrain component without history", () => {
    const components = deriveResearchComponents(emptyHistory, {
      fuelType: "diesel",
      transmissionType: "automatic",
    });
    const codes = components.map(({ component_code }) => component_code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "engine_oil",
        "oil_filter",
        "transmission_fluid",
        "timing_belt",
        "timing_chain",
        "brake_fluid",
        "fuel_filter",
        "air_filter",
        "cabin_filter",
        "coolant",
      ]),
    );
    expect(new Set(codes).size).toBe(codes.length);
    expect(components).toContainEqual({
      component_code: "transmission_fluid",
      component_label: "Automatic transmission fluid",
    });
  });

  it("keeps the inventory powertrain-specific and fills omitted rows honestly", () => {
    const research: MaintenanceResearch = {
      vehicle_variant: {
        make: "Synthetic",
        model: "EV",
        generation: null,
        model_year: 2026,
        engine: "electric",
        transmission: "single-speed",
        market: "EU",
        confidence: 1,
        unresolved_fields: [],
      },
      components: [
        {
          component_code: "cabin_filter",
          component_label: "Cabin air filter",
          resolution: "insufficient_evidence",
          interval_claims: [],
          recommended_claim_id: null,
          conflict_summary: null,
        },
      ],
      global_warnings: [],
      researched_at: "2026-07-20T00:00:00.000Z",
    };
    const completed = ensureMaintenanceResearchCoverage(
      research,
      emptyHistory,
      { fuelType: "electric", transmissionType: "automatic" },
    );
    const codes = completed.components.map(
      ({ component_code }) => component_code,
    );

    expect(codes).toContain("transmission_fluid");
    expect(codes).toContain("brake_fluid");
    expect(codes).toContain("coolant");
    expect(codes).not.toContain("engine_oil");
    expect(codes).not.toContain("fuel_filter");
    expect(
      completed.components.find(
        ({ component_code }) => component_code === "brake_fluid",
      ),
    ).toMatchObject({
      resolution: "insufficient_evidence",
      interval_claims: [],
      recommended_claim_id: null,
    });
    expect(completed.global_warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Brake fluid"),
      ]),
    );
  });
});
