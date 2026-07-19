import type { ComponentStatusReasonCode } from "@/domain/schemas/component-status";
import type {
  ComponentCode,
  ServiceEvent,
} from "@/domain/schemas/service-history";
import { resolveActionComponentCode } from "@/domain/service-events/component-taxonomy";
import {
  normalizeServiceEvent,
  type NormalizedServiceEvent,
} from "@/domain/service-events/normalization";
import { toUtcDateOnly } from "./calendar";

const RESETTING_ACTIONS = new Set(["replaced", "serviced"]);

export interface ServiceSelectionOptions {
  currentOdometerKm: number;
  analysisDate: Date;
  minimumConfidence: number;
}

export interface LastServiceSelection {
  event: ServiceEvent | null;
  normalized: NormalizedServiceEvent | null;
  reasonCodes: ComponentStatusReasonCode[];
}

export function selectLastRelevantService(
  events: readonly ServiceEvent[],
  componentCode: ComponentCode,
  options: ServiceSelectionOptions,
): LastServiceSelection {
  const relevant = events.filter((event) =>
    event.actions.some(
      (action) =>
        resolveActionComponentCode(action, event.raw_evidence) ===
        componentCode,
    ),
  );

  if (relevant.length === 0) {
    return emptySelection(["no_service_history_entry"]);
  }

  const qualifying = relevant.filter(
    (event) =>
      event.confidence >= options.minimumConfidence &&
      event.actions.some(
        (action) =>
          resolveActionComponentCode(action, event.raw_evidence) ===
            componentCode &&
          RESETTING_ACTIONS.has(action.action_type) &&
          action.confidence >= options.minimumConfidence,
      ),
  );

  if (qualifying.length === 0) {
    const reasons: ComponentStatusReasonCode[] = [];
    if (
      relevant.every((event) =>
        event.actions
          .filter(
            (action) =>
              resolveActionComponentCode(action, event.raw_evidence) ===
              componentCode,
          )
          .every((action) => action.action_type === "inspected"),
      )
    ) {
      reasons.push("inspection_only");
    }
    if (
      relevant.some(
        (event) =>
          event.confidence < options.minimumConfidence ||
          event.actions.some(
            (action) =>
              resolveActionComponentCode(action, event.raw_evidence) ===
                componentCode &&
              action.confidence < options.minimumConfidence,
          ),
      )
    ) {
      reasons.push("low_confidence_service_event");
    }
    reasons.push("no_qualifying_service_event");
    return emptySelection(reasons);
  }

  const normalized = qualifying.map((event) =>
    normalizeServiceEvidence(event, options.minimumConfidence),
  );
  const chronologyReasons = validateChronology(normalized, options);
  if (chronologyReasons.length > 0) {
    return emptySelection(chronologyReasons);
  }

  const selected = chooseLatest(normalized);
  if (selected === null) {
    return emptySelection(["ambiguous_last_service"]);
  }

  return {
    event: selected.event,
    normalized: selected,
    reasonCodes: [],
  };
}

function normalizeServiceEvidence(
  event: ServiceEvent,
  minimumConfidence: number,
): NormalizedServiceEvent {
  const normalized = normalizeServiceEvent(event);

  return {
    ...normalized,
    date:
      event.service_date !== null &&
      event.service_date.confidence < minimumConfidence
        ? {
            status: "unverified",
            value: event.service_date.value,
            earliestUtc: null,
            latestUtc: null,
          }
        : normalized.date,
    odometer:
      event.odometer !== null &&
      event.odometer.confidence < minimumConfidence
        ? {
            status: "unverified",
            originalValue: event.odometer.value,
            originalUnit: event.odometer.unit,
            kilometres: null,
          }
        : normalized.odometer,
  };
}

function validateChronology(
  events: readonly NormalizedServiceEvent[],
  options: ServiceSelectionOptions,
): ComponentStatusReasonCode[] {
  const reasons = new Set<ComponentStatusReasonCode>();
  const analysisDay = toUtcDateOnly(options.analysisDate).getTime();

  for (const event of events) {
    if (
      event.date.status === "valid" &&
      event.date.earliestUtc !== null &&
      event.date.earliestUtc > analysisDay
    ) {
      reasons.add("future_service_date");
    }
    if (
      event.odometer.status === "valid" &&
      event.odometer.kilometres !== null &&
      event.odometer.kilometres > options.currentOdometerKm
    ) {
      reasons.add("service_odometer_above_current");
    }
  }

  for (let leftIndex = 0; leftIndex < events.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < events.length;
      rightIndex += 1
    ) {
      const left = events[leftIndex];
      const right = events[rightIndex];
      if (left === undefined || right === undefined) {
        continue;
      }
      const ordered = orderDefinitively(left, right);
      if (
        ordered !== null &&
        ordered.earlier.odometer.status === "valid" &&
        ordered.later.odometer.status === "valid" &&
        ordered.earlier.odometer.kilometres !== null &&
        ordered.later.odometer.kilometres !== null &&
        ordered.earlier.odometer.kilometres >
          ordered.later.odometer.kilometres
      ) {
        reasons.add("odometer_chronology_conflict");
      }
    }
  }

  return [...reasons];
}

function chooseLatest(
  events: readonly NormalizedServiceEvent[],
): NormalizedServiceEvent | null {
  if (events.length === 1) {
    return events[0] ?? null;
  }

  const definitivelyLatest = events.filter(
    (candidate) =>
      candidate.date.status === "valid" &&
      candidate.date.earliestUtc !== null &&
      events.every(
        (other) =>
          other === candidate ||
          (other.date.status === "valid" &&
            other.date.latestUtc !== null &&
            candidate.date.earliestUtc! > other.date.latestUtc),
      ),
  );
  if (definitivelyLatest.length === 1) {
    return definitivelyLatest[0] ?? null;
  }

  if (
    events.every(
      (event) =>
        event.odometer.status === "valid" &&
        event.odometer.kilometres !== null,
    )
  ) {
    const greatest = Math.max(
      ...events.map((event) => event.odometer.kilometres!),
    );
    const atGreatest = events.filter(
      (event) => event.odometer.kilometres === greatest,
    );
    if (atGreatest.length === 1) {
      return atGreatest[0] ?? null;
    }
  }

  if (haveIdenticalOrderingEvidence(events)) {
    return [...events].sort((left, right) =>
      left.event.event_id.localeCompare(right.event.event_id),
    )[0] ?? null;
  }

  return null;
}

function haveIdenticalOrderingEvidence(
  events: readonly NormalizedServiceEvent[],
): boolean {
  const first = events[0];
  if (first === undefined) {
    return false;
  }
  return events.every(
    (event) =>
      event.date.earliestUtc === first.date.earliestUtc &&
      event.date.latestUtc === first.date.latestUtc &&
      event.odometer.kilometres === first.odometer.kilometres,
  );
}

function orderDefinitively(
  left: NormalizedServiceEvent,
  right: NormalizedServiceEvent,
): {
  earlier: NormalizedServiceEvent;
  later: NormalizedServiceEvent;
} | null {
  if (
    left.date.status !== "valid" ||
    right.date.status !== "valid" ||
    left.date.earliestUtc === null ||
    left.date.latestUtc === null ||
    right.date.earliestUtc === null ||
    right.date.latestUtc === null
  ) {
    return null;
  }
  if (left.date.latestUtc < right.date.earliestUtc) {
    return { earlier: left, later: right };
  }
  if (right.date.latestUtc < left.date.earliestUtc) {
    return { earlier: right, later: left };
  }
  return null;
}

function emptySelection(
  reasonCodes: ComponentStatusReasonCode[],
): LastServiceSelection {
  return { event: null, normalized: null, reasonCodes };
}
