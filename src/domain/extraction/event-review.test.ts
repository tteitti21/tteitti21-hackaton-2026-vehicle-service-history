import { describe, expect, it } from "vitest";

import type { ServiceHistory } from "@/domain/schemas/service-history";

import {
  appendServiceEvent,
  createManualServiceEvent,
  mergeSelectedServiceEvents,
  removeServiceEvent,
  replaceServiceEvent,
} from "./event-review";

const history: ServiceHistory = {
  images: [
    { image_id: "image-1", readability: 1, notes: null },
    { image_id: "image-2", readability: 0.8, notes: null },
  ],
  events: [
    {
      event_id: "event-1",
      source_image_ids: ["image-1"],
      raw_evidence: "Oil changed",
      service_date: {
        value: "2024-01",
        precision: "month",
        confidence: 0.7,
      },
      odometer: null,
      actions: [],
      workshop: null,
      notes: null,
      confidence: 0.8,
      ambiguities: [],
    },
    {
      event_id: "event-2",
      source_image_ids: ["image-2"],
      raw_evidence: "120000 km",
      service_date: null,
      odometer: { value: 120_000, unit: "km", confidence: 0.9 },
      actions: [],
      workshop: "Synthetic workshop",
      notes: "Same visit",
      confidence: 0.6,
      ambiguities: ["Date unclear"],
    },
  ],
  warnings: [],
};

describe("event review operations", () => {
  it("adds, replaces, and removes an event immutably", () => {
    const manual = createManualServiceEvent("manual-1", "image-1");
    const appended = appendServiceEvent(history, manual);
    const edited = { ...manual, notes: "Reviewed" };
    const replaced = replaceServiceEvent(appended, edited);
    const removed = removeServiceEvent(replaced, "manual-1");

    expect(appended.events).toHaveLength(3);
    expect(replaced.events[2].notes).toBe("Reviewed");
    expect(removed.events).toEqual(history.events);
    expect(history.events).toHaveLength(2);
  });

  it("merges evidence while preserving source references and uncertainty", () => {
    const merged = mergeSelectedServiceEvents(
      history,
      new Set(["event-1", "event-2"]),
    );

    expect(merged.events).toHaveLength(1);
    expect(merged.events[0]).toMatchObject({
      event_id: "event-1",
      source_image_ids: ["image-1", "image-2"],
      service_date: history.events[0].service_date,
      odometer: history.events[1].odometer,
      confidence: 0.6,
      workshop: "Synthetic workshop",
    });
    expect(merged.events[0].raw_evidence).toContain("Oil changed");
    expect(merged.events[0].raw_evidence).toContain("120000 km");
    expect(merged.events[0].ambiguities).toContain(
      "Merged from 2 extracted events.",
    );
  });

  it("does nothing when fewer than two events are selected", () => {
    expect(
      mergeSelectedServiceEvents(history, new Set(["event-1"])),
    ).toBe(history);
  });
});
