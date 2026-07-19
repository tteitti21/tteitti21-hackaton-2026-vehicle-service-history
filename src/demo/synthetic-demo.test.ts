import { describe, expect, it } from "vitest";

import { maintenanceResearchSchema } from "@/domain/schemas/maintenance-research";
import { serviceHistorySchema } from "@/domain/schemas/service-history";
import { vehicleResolutionSchema } from "@/domain/schemas/vehicle-resolution";
import { confirmedVehicleInputSchema } from "@/domain/vehicle/vehicle-input";
import { syntheticDemoSession } from "./synthetic-demo";

describe("synthetic demo fixture", () => {
  it("matches every runtime schema and contains three synthetic documents", () => {
    expect(() =>
      confirmedVehicleInputSchema.parse(syntheticDemoSession.vehicle),
    ).not.toThrow();
    expect(() =>
      serviceHistorySchema.parse(syntheticDemoSession.serviceHistory),
    ).not.toThrow();
    expect(() =>
      vehicleResolutionSchema.parse(syntheticDemoSession.vehicleResolution),
    ).not.toThrow();
    expect(() =>
      maintenanceResearchSchema.parse(
        syntheticDemoSession.maintenanceResearch,
      ),
    ).not.toThrow();
    expect(syntheticDemoSession.serviceHistory.images).toHaveLength(3);
  });

  it("covers conversion, ambiguity, source conflict, and missing evidence", () => {
    const oilEvent = syntheticDemoSession.serviceHistory.events[0];
    const oilClaim =
      syntheticDemoSession.maintenanceResearch.components[0].interval_claims[0];

    expect(oilEvent.odometer).toMatchObject({
      value: 100_000,
      unit: "mi",
    });
    expect(100_000 * 1.609344).toBeCloseTo(160_934.4, 8);
    expect(oilClaim).toMatchObject({
      original_value: 10_000,
      original_unit: "mi",
      interval_km: 16_093,
    });
    expect(
      syntheticDemoSession.serviceHistory.events.some(
        (event) => event.ambiguities.length > 0,
      ),
    ).toBe(true);
    expect(
      syntheticDemoSession.maintenanceResearch.components.some(
        (component) => component.resolution === "conflicting_sources",
      ),
    ).toBe(true);
    expect(
      syntheticDemoSession.maintenanceResearch.components.some(
        (component) => component.resolution === "insufficient_evidence",
      ),
    ).toBe(true);
    const historyComponentCodes: string[] =
      syntheticDemoSession.serviceHistory.events.flatMap((event) =>
        event.actions.map((action) => action.component_code),
      );
    expect(historyComponentCodes).not.toContain("air_filter");
  });
});
