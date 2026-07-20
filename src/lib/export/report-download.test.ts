import { afterEach, describe, expect, it, vi } from "vitest";

import type { VehicleReportModel } from "@/domain/report/report-model";
import {
  createJsonReportBlob,
  createReportFilename,
  downloadBlobLocally,
  serializeVehicleReportJson,
} from "./report-download";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("local report download helpers", () => {
  it("serializes valid UTF-8 JSON with a stable trailing newline", async () => {
    const report = minimalReport();
    const serialized = serializeVehicleReportJson(report);
    const blob = createJsonReportBlob(report);

    expect(serialized.endsWith("\n")).toBe(true);
    expect(JSON.parse(serialized)).toEqual(report);
    expect(blob.type).toBe("application/json;charset=utf-8");
    expect(await blob.text()).toBe(serialized);
  });

  it("creates a filesystem-safe vehicle and analysis-date filename", () => {
    const report = minimalReport();
    report.vehicle.make = "Škoda / Auto";
    report.vehicle.model = "@Enyaq?";

    expect(createReportFilename(report, "xlsx")).toBe(
      "autohuolto-skoda-auto-enyaq-2026-07-19.xlsx",
    );
  });

  it("uses an object URL and anchor without a network request", () => {
    vi.useFakeTimers();
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:local-report");
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    downloadBlobLocally(new Blob(["local"]), "report.json");
    vi.runAllTimers();

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-report");
    expect(document.querySelector('a[download="report.json"]')).toBeNull();
  });
});

function minimalReport(): VehicleReportModel {
  return {
    metadata: {
      schema_version: "1.1",
      generated_at: "2026-07-19T12:00:00.000Z",
      analysis_date: "2026-07-19",
      distance_unit: "km",
      local_export: true,
      images_included: false,
      disclaimer_fi: "Test",
    },
    vehicle: {
      make: "Toyota",
      model: "Avensis",
      generation: null,
      model_year: null,
      first_registration_year: null,
      engine_displacement_litres: null,
      engine_code: null,
      power_kw: null,
      fuel_type: null,
      transmission_type: null,
      transmission_code: null,
      drivetrain: null,
      country: "FI",
      market: null,
      current_odometer_km: 1,
      additional_details: null,
      resolved_variant: {
        make: "Toyota",
        model: "Avensis",
        generation: null,
        model_year: null,
        engine: null,
        transmission: null,
        market: null,
        confidence: 1,
        unresolved_fields: [],
      },
      resolution: {
        candidate_id: "candidate-1",
        compatibility: "exact",
        compatibility_explanation: "Test",
        matching_fields: [],
        conflicting_fields: [],
        missing_distinguishing_fields: [],
        unresolved_variant_fields: [],
        sources: [],
      },
    },
    summary: {
      service_event_count: 0,
      component_count: 0,
      source_count: 0,
      highest_priority_status: null,
      status_counts: {
        ok: 0,
        due_soon: 0,
        due: 0,
        overdue: 0,
        unknown: 0,
        insufficient_evidence: 0,
        conflicting_sources: 0,
      },
    },
    service_history: [],
    components: [],
    sources: [],
    warnings: {
      service_history: [],
      vehicle_resolution: [],
      maintenance_research: [],
    },
  };
}
