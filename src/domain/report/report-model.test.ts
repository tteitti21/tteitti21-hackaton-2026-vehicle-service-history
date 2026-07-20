import { describe, expect, it } from "vitest";

import type { ServiceHistory } from "@/domain/schemas/service-history";
import { maintenanceResearchFixture } from "@/test/maintenance-research-fixture";
import {
  confirmedVehicleFixture,
  vehicleResolutionFixture,
} from "@/test/vehicle-resolution-fixture";
import { createVehicleReportModel } from "./report-model";

const reviewedHistory: ServiceHistory = {
  images: [
    {
      image_id: "sanitized-image-1",
      readability: 1,
      notes: "This image metadata must not be exported.",
    },
  ],
  events: [
    {
      event_id: "event-1",
      source_image_ids: ["sanitized-image-1"],
      raw_evidence: "=HYPERLINK(\"https://attacker.example\")",
      service_date: {
        value: "2026-01-15",
        precision: "day",
        confidence: 1,
      },
      odometer: {
        value: 100,
        unit: "mi",
        confidence: 1,
      },
      actions: [
        {
          component_code: "engine_oil",
          component_label: "Engine oil",
          action_type: "replaced",
          description: "Replacement confirmed by the user",
          confidence: 1,
        },
      ],
      workshop: "@untrusted-workshop",
      notes: "+untrusted-note",
      confidence: 1,
      ambiguities: ["-untrusted-ambiguity"],
    },
  ],
  warnings: ["=untrusted-warning"],
};

describe("createVehicleReportModel", () => {
  it("exports the reviewed state, normalized kilometres, sources, and uncertainty", () => {
    const report = createReport();

    expect(report.metadata).toMatchObject({
      schema_version: "1.1",
      generated_at: "2026-07-19T14:30:00.000Z",
      analysis_date: "2026-07-19",
      distance_unit: "km",
      local_export: true,
      images_included: false,
    });
    expect(report.vehicle).toMatchObject({
      make: "Toyota",
      model: "Avensis",
      current_odometer_km: 184_000,
      resolved_variant: { engine: "2.0 D-4D (1AD-FTV), 91 kW" },
      resolution: {
        candidate_id: "candidate-1",
        compatibility: "strong",
        missing_distinguishing_fields: ["transmission code"],
      },
    });
    expect(report.service_history[0]).toMatchObject({
      event_id: "event-1",
      source_image_ids: ["sanitized-image-1"],
      raw_evidence: "=HYPERLINK(\"https://attacker.example\")",
      odometer_km: 160.9344,
      original_odometer_value: 100,
      original_odometer_unit: "mi",
    });
    expect(report.components).toHaveLength(16);
    expect(report.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ component_code: "transmission_fluid" }),
        expect.objectContaining({ component_code: "oil_filter" }),
        expect.objectContaining({ component_code: "brake_fluid" }),
        expect.objectContaining({ component_code: "fuel_filter" }),
        expect.objectContaining({ component_code: "cabin_filter" }),
        expect.objectContaining({ component_code: "coolant" }),
      ]),
    );
    expect(
      report.components.find(
        ({ component_code }) => component_code === "timing_belt",
      ),
    ).toMatchObject({
      component_code: "timing_belt",
      status: "conflicting_sources",
      interval_claim_count: 2,
      conflict_summary: expect.stringContaining("conflicting"),
      trustworthiness_level: "low",
      maintenance_suggestion_fi: expect.stringContaining("claim-2"),
    });
    expect(
      report.components.find(
        ({ component_code }) => component_code === "air_filter",
      ),
    ).toMatchObject({
      component_code: "air_filter",
      status: "insufficient_evidence",
      service_history_note_fi:
        "No service-history entry was found.",
    });
    expect(report.sources).toHaveLength(4);
    expect(report.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_scope: "vehicle_resolution",
          url: "https://toyota.example/avensis-t27",
        }),
        expect.objectContaining({
          source_scope: "maintenance_interval",
          claim_id: "claim-3",
          interval_km: 120_000,
          recommended: false,
          trustworthiness_level: "high",
        }),
      ]),
    );
    expect(report.warnings).toMatchObject({
      service_history: ["=untrusted-warning"],
      vehicle_resolution: vehicleResolutionFixture.warnings,
      maintenance_research: expect.arrayContaining(
        maintenanceResearchFixture.global_warnings,
      ),
    });
    expect(report.warnings.maintenance_research).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Transmission fluid"),
        expect.stringContaining("Brake fluid"),
      ]),
    );
  });

  it("never includes image objects, filenames, bytes, or data URLs", () => {
    const serialized = JSON.stringify(createReport());

    expect(serialized).not.toContain('"images":');
    expect(serialized).not.toContain("This image metadata must not be exported.");
    expect(serialized).not.toContain("data:image/");
    expect(serialized).not.toContain("base64");
    expect(serialized).toContain('"source_image_ids"');
  });

  it("rejects an invalid generation date or unavailable candidate", () => {
    expect(() =>
      createVehicleReportModel({
        ...createInput(),
        generatedAt: new Date("invalid"),
      }),
    ).toThrow(RangeError);
    expect(() =>
      createVehicleReportModel({
        ...createInput(),
        confirmedVehicleCandidateId: "candidate-999",
      }),
    ).toThrow(RangeError);
  });
});

function createReport() {
  return createVehicleReportModel(createInput());
}

function createInput() {
  return {
    confirmedVehicle: confirmedVehicleFixture,
    confirmedVehicleCandidateId: "candidate-1",
    vehicleResolution: vehicleResolutionFixture,
    serviceHistory: reviewedHistory,
    maintenanceResearch: maintenanceResearchFixture,
    generatedAt: new Date("2026-07-19T14:30:00.000Z"),
  };
}
