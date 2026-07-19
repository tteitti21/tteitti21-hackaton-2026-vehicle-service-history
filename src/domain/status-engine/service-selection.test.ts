import { describe, expect, it } from "vitest";

import type { ServiceEvent } from "@/domain/schemas/service-history";
import { selectLastRelevantService } from "./service-selection";

const baseEvent: ServiceEvent = {
  event_id: "event-1",
  source_image_ids: ["image-1"],
  raw_evidence: "Moottoriöljy vaihdettu",
  service_date: {
    value: "2024-01-15",
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

const options = {
  currentOdometerKm: 160_000,
  analysisDate: new Date("2026-07-19T12:00:00Z"),
  minimumConfidence: 0.6,
};

describe("selectLastRelevantService", () => {
  it("prefers a definitively later replacement by date", () => {
    const later: ServiceEvent = {
      ...baseEvent,
      event_id: "event-2",
      service_date: {
        value: "2025-01-15",
        precision: "day",
        confidence: 0.9,
      },
      odometer: { value: 130_000, unit: "km", confidence: 0.9 },
    };

    expect(
      selectLastRelevantService(
        [later, baseEvent],
        "engine_oil",
        options,
      ).event?.event_id,
    ).toBe("event-2");
  });

  it("uses odometer as a secondary signal for overlapping partial dates", () => {
    const laterByOdometer: ServiceEvent = {
      ...baseEvent,
      event_id: "event-2",
      service_date: {
        value: "2024",
        precision: "year",
        confidence: 0.7,
      },
      odometer: { value: 120_000, unit: "km", confidence: 0.9 },
    };
    const overlapping: ServiceEvent = {
      ...baseEvent,
      service_date: {
        value: "2024-06",
        precision: "month",
        confidence: 0.7,
      },
    };

    expect(
      selectLastRelevantService(
        [overlapping, laterByOdometer],
        "engine_oil",
        options,
      ).event?.event_id,
    ).toBe("event-2");
  });

  it("does not treat inspection or low-confidence extraction as interval reset", () => {
    const inspection: ServiceEvent = {
      ...baseEvent,
      actions: [
        {
          ...baseEvent.actions[0]!,
          action_type: "inspected",
        },
      ],
    };
    const lowConfidence: ServiceEvent = {
      ...baseEvent,
      event_id: "event-2",
      confidence: 0.4,
    };

    expect(
      selectLastRelevantService([inspection], "engine_oil", options),
    ).toMatchObject({
      event: null,
      reasonCodes: ["inspection_only", "no_qualifying_service_event"],
    });
    expect(
      selectLastRelevantService([lowConfidence], "engine_oil", options),
    ).toMatchObject({
      event: null,
      reasonCodes: [
        "low_confidence_service_event",
        "no_qualifying_service_event",
      ],
    });
  });

  it("keeps an older completed service instead of a newer inspection", () => {
    const newerInspection: ServiceEvent = {
      ...baseEvent,
      event_id: "event-2",
      service_date: {
        value: "2025-06-15",
        precision: "day",
        confidence: 1,
      },
      odometer: { value: 140_000, unit: "km", confidence: 1 },
      actions: [
        {
          ...baseEvent.actions[0]!,
          action_type: "inspected",
        },
      ],
    };

    expect(
      selectLastRelevantService(
        [baseEvent, newerInspection],
        "engine_oil",
        options,
      ).event?.event_id,
    ).toBe("event-1");
  });

  it("distinguishes absent history from ambiguous last-service evidence", () => {
    const undated: ServiceEvent = {
      ...baseEvent,
      event_id: "event-2",
      service_date: null,
    };
    const alsoUndated: ServiceEvent = {
      ...undated,
      event_id: "event-3",
      odometer: null,
    };

    expect(
      selectLastRelevantService([], "engine_oil", options).reasonCodes,
    ).toEqual(["no_service_history_entry"]);
    expect(
      selectLastRelevantService(
        [undated, alsoUndated],
        "engine_oil",
        options,
      ).reasonCodes,
    ).toEqual(["ambiguous_last_service"]);
  });

  it.each([
    [
      "future date",
      {
        ...baseEvent,
        service_date: {
          value: "2027-01-01",
          precision: "day" as const,
          confidence: 0.9,
        },
      },
      "future_service_date",
    ],
    [
      "odometer above current",
      {
        ...baseEvent,
        odometer: { value: 170_000, unit: "km" as const, confidence: 0.9 },
      },
      "service_odometer_above_current",
    ],
  ])("rejects %s as contradictory", (_label, event, reasonCode) => {
    expect(
      selectLastRelevantService([event], "engine_oil", options),
    ).toMatchObject({ event: null, reasonCodes: [reasonCode] });
  });

  it("rejects decreasing odometer chronology instead of choosing silently", () => {
    const later: ServiceEvent = {
      ...baseEvent,
      event_id: "event-2",
      service_date: {
        value: "2025-01-15",
        precision: "day",
        confidence: 0.9,
      },
      odometer: { value: 90_000, unit: "km", confidence: 0.9 },
    };

    expect(
      selectLastRelevantService([baseEvent, later], "engine_oil", options),
    ).toMatchObject({
      event: null,
      reasonCodes: ["odometer_chronology_conflict"],
    });
  });
});
