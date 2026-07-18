import type {
  ServiceAction,
  ServiceEvent,
  ServiceHistory,
} from "@/domain/schemas/service-history";

export function createManualServiceEvent(
  eventId: string,
  sourceImageId: string,
): ServiceEvent {
  return {
    event_id: eventId,
    source_image_ids: [sourceImageId],
    raw_evidence: "",
    service_date: null,
    odometer: null,
    actions: [],
    workshop: null,
    notes: null,
    confidence: 0,
    ambiguities: ["Käyttäjän lisäämä tapahtuma."],
  };
}

export function createManualServiceAction(): ServiceAction {
  return {
    component_code: "other",
    component_label: "",
    action_type: "unknown",
    description: "",
    confidence: 0,
  };
}

export function replaceServiceEvent(
  history: ServiceHistory,
  event: ServiceEvent,
): ServiceHistory {
  return {
    ...history,
    events: history.events.map((current) =>
      current.event_id === event.event_id ? event : current,
    ),
  };
}

export function appendServiceEvent(
  history: ServiceHistory,
  event: ServiceEvent,
): ServiceHistory {
  return {
    ...history,
    events: [...history.events, event],
  };
}

export function removeServiceEvent(
  history: ServiceHistory,
  eventId: string,
): ServiceHistory {
  return {
    ...history,
    events: history.events.filter((event) => event.event_id !== eventId),
  };
}

export function mergeSelectedServiceEvents(
  history: ServiceHistory,
  eventIds: ReadonlySet<string>,
): ServiceHistory {
  const selected = history.events.filter((event) =>
    eventIds.has(event.event_id),
  );

  if (selected.length < 2) {
    return history;
  }

  const [primary, ...rest] = selected;
  const merged: ServiceEvent = {
    ...primary,
    source_image_ids: unique(
      selected.flatMap((event) => event.source_image_ids),
    ),
    raw_evidence: unique(
      selected.map((event) => event.raw_evidence).filter(Boolean),
    ).join("\n---\n"),
    service_date: selectHighestConfidence(
      selected.map((event) => event.service_date),
    ),
    odometer: selectHighestConfidence(
      selected.map((event) => event.odometer),
    ),
    actions: selected.flatMap((event) => event.actions),
    workshop: firstNonNull(selected.map((event) => event.workshop)),
    notes: unique(
      selected
        .map((event) => event.notes)
        .filter((value): value is string => value !== null && value !== ""),
    ).join("\n") || null,
    confidence: Math.min(...selected.map((event) => event.confidence)),
    ambiguities: unique([
      ...selected.flatMap((event) => event.ambiguities),
      `Yhdistetty ${selected.length} poimitusta tapahtumasta.`,
    ]),
  };
  const removedIds = new Set(rest.map((event) => event.event_id));

  return {
    ...history,
    events: history.events
      .filter((event) => !removedIds.has(event.event_id))
      .map((event) => (event.event_id === primary.event_id ? merged : event)),
  };
}

function selectHighestConfidence<
  TValue extends { confidence: number } | null,
>(values: TValue[]): TValue {
  return values.reduce<TValue>((best, value) => {
    if (value === null) {
      return best;
    }
    if (best === null || value.confidence > best.confidence) {
      return value;
    }
    return best;
  }, null as TValue);
}

function firstNonNull(values: Array<string | null>): string | null {
  return values.find((value) => value !== null) ?? null;
}

function unique<TValue>(values: TValue[]): TValue[] {
  return [...new Set(values)];
}
