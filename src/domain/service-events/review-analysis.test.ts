import { describe, expect, it } from "vitest";

import type { ServiceEvent } from "@/domain/schemas/service-history";
import {
  analyzeServiceEvents,
  detectChronologyWarnings,
  detectDuplicateEvents,
} from "./review-analysis";

const baseEvent: ServiceEvent = {
  event_id: "event-1",
  source_image_ids: ["image-1"],
  raw_evidence: "Moottoriöljy vaihdettu",
  service_date: {
    value: "2024-01-10",
    precision: "day",
    confidence: 0.9,
  },
  odometer: { value: 100_000, unit: "km", confidence: 0.9 },
  actions: [
    {
      component_code: "engine_oil",
      component_label: "Moottoriöljy",
      action_type: "replaced",
      description: "Öljy vaihdettu",
      confidence: 0.9,
    },
  ],
  workshop: null,
  notes: null,
  confidence: 0.9,
  ambiguities: [],
};

describe("service-history review analysis", () => {
  it("reports invalid dates and odometers as confirmation-blocking errors", () => {
    const invalid: ServiceEvent = {
      ...baseEvent,
      service_date: {
        value: "2024-02-31",
        precision: "day",
        confidence: 0.5,
      },
      odometer: { value: -1, unit: "km", confidence: 0.5 },
    };

    const analysis = analyzeServiceEvents([invalid]);

    expect(analysis.errors.map((issue) => issue.code)).toEqual([
      "invalid_date",
      "invalid_odometer",
    ]);
  });

  it("flags likely duplicates using two independent matching signals", () => {
    const duplicate: ServiceEvent = {
      ...baseEvent,
      event_id: "event-2",
      source_image_ids: ["image-2"],
      odometer: { value: 101_000, unit: "km", confidence: 0.8 },
    };

    expect(detectDuplicateEvents([baseEvent, duplicate])).toMatchObject([
      {
        code: "possible_duplicate",
        eventIds: ["event-1", "event-2"],
      },
    ]);
  });

  it("does not flag two events based only on a shared component", () => {
    const later: ServiceEvent = {
      ...baseEvent,
      event_id: "event-2",
      service_date: {
        value: "2025-01-10",
        precision: "day",
        confidence: 0.9,
      },
      odometer: { value: 120_000, unit: "km", confidence: 0.9 },
    };

    expect(detectDuplicateEvents([baseEvent, later])).toEqual([]);
  });

  it("detects decreasing chronology, future dates, and values above the current odometer", () => {
    const earlier: ServiceEvent = {
      ...baseEvent,
      odometer: { value: 160_000, unit: "km", confidence: 0.9 },
    };
    const later: ServiceEvent = {
      ...baseEvent,
      event_id: "event-2",
      service_date: {
        value: "2027-02",
        precision: "month",
        confidence: 0.8,
      },
      odometer: { value: 90_000, unit: "mi", confidence: 0.8 },
    };

    const warnings = detectChronologyWarnings([earlier, later], {
      currentOdometerKm: 150_000,
      analysisDate: new Date("2026-07-19T12:00:00Z"),
    });

    expect(warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "future_service_date",
        "odometer_above_current",
        "odometer_decreases",
      ]),
    );
  });

  it("does not impose an order on overlapping partial date ranges", () => {
    const sameYear: ServiceEvent = {
      ...baseEvent,
      event_id: "event-2",
      service_date: {
        value: "2024",
        precision: "year",
        confidence: 0.5,
      },
      odometer: { value: 90_000, unit: "km", confidence: 0.5 },
    };

    expect(
      detectChronologyWarnings([baseEvent, sameYear], {
        analysisDate: new Date("2026-07-19T12:00:00Z"),
      }).filter((warning) => warning.code === "odometer_decreases"),
    ).toEqual([]);
  });
});
