import type { ServiceEvent } from "@/domain/schemas/service-history";
import { resolveActionComponentCode } from "./component-taxonomy";
import {
  normalizeOdometer,
  normalizeServiceDate,
  normalizeServiceEvent,
  type NormalizedServiceEvent,
} from "./normalization";

export type ReviewIssueSeverity = "error" | "warning";

export interface ReviewIssue {
  id: string;
  code:
    | "invalid_date"
    | "unverified_date"
    | "invalid_odometer"
    | "unverified_odometer_unit"
    | "possible_duplicate"
    | "odometer_decreases"
    | "future_service_date"
    | "odometer_above_current";
  severity: ReviewIssueSeverity;
  eventIds: string[];
  message: string;
}

export interface ServiceHistoryReviewAnalysis {
  errors: ReviewIssue[];
  warnings: ReviewIssue[];
}

export interface ReviewAnalysisOptions {
  currentOdometerKm?: number;
  analysisDate?: Date;
}

export function analyzeServiceEvents(
  events: readonly ServiceEvent[],
  options: ReviewAnalysisOptions = {},
): ServiceHistoryReviewAnalysis {
  const issues = [
    ...validateEventValues(events),
    ...detectDuplicateEvents(events),
    ...detectChronologyWarnings(events, options),
  ];

  return {
    errors: issues.filter((issue) => issue.severity === "error"),
    warnings: issues.filter((issue) => issue.severity === "warning"),
  };
}

export function validateEventValues(
  events: readonly ServiceEvent[],
): ReviewIssue[] {
  return events.flatMap((event) => {
    const issues: ReviewIssue[] = [];
    const date = normalizeServiceDate(event.service_date);
    const odometer = normalizeOdometer(event.odometer);

    if (date.status === "invalid") {
      issues.push({
        id: `invalid-date:${event.event_id}`,
        code: "invalid_date",
        severity: "error",
        eventIds: [event.event_id],
        message: `Tapahtuman ${event.event_id} päivämäärä ei ole mahdollinen tai vastaa tuettua muotoa.`,
      });
    } else if (date.status === "unverified") {
      issues.push({
        id: `unverified-date:${event.event_id}`,
        code: "unverified_date",
        severity: "warning",
        eventIds: [event.event_id],
        message: `Tapahtuman ${event.event_id} päivämäärän tarkkuutta ei voitu päätellä syötetystä muodosta.`,
      });
    }

    if (odometer.status === "invalid") {
      issues.push({
        id: `invalid-odometer:${event.event_id}`,
        code: "invalid_odometer",
        severity: "error",
        eventIds: [event.event_id],
        message: `Tapahtuman ${event.event_id} matkamittarilukeman on oltava nolla tai positiivinen kokonaisluku.`,
      });
    } else if (odometer.status === "unverified") {
      issues.push({
        id: `unverified-odometer:${event.event_id}`,
        code: "unverified_odometer_unit",
        severity: "warning",
        eventIds: [event.event_id],
        message: `Tapahtuman ${event.event_id} matkamittarin yksikkö on epäselvä, joten lukemaa ei käytetä kilometrilaskennassa.`,
      });
    }

    return issues;
  });
}

export function detectDuplicateEvents(
  events: readonly ServiceEvent[],
): ReviewIssue[] {
  const normalizedEvents = events.map(normalizeServiceEvent);
  const issues: ReviewIssue[] = [];

  for (let leftIndex = 0; leftIndex < normalizedEvents.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < normalizedEvents.length;
      rightIndex += 1
    ) {
      const left = normalizedEvents[leftIndex];
      const right = normalizedEvents[rightIndex];
      const signals = duplicateSignals(left, right);

      if (signals.length < 2) {
        continue;
      }

      issues.push({
        id: `possible-duplicate:${left.event.event_id}:${right.event.event_id}`,
        code: "possible_duplicate",
        severity: "warning",
        eventIds: [left.event.event_id, right.event.event_id],
        message: `Tapahtumat ${left.event.event_id} ja ${right.event.event_id} voivat kuvata samaa huoltokäyntiä (${signals.join(", ")}). Tarkista ja yhdistä tarvittaessa.`,
      });
    }
  }

  return issues;
}

export function detectChronologyWarnings(
  events: readonly ServiceEvent[],
  {
    currentOdometerKm,
    analysisDate = new Date(),
  }: ReviewAnalysisOptions = {},
): ReviewIssue[] {
  const normalizedEvents = events.map(normalizeServiceEvent);
  const issues: ReviewIssue[] = [];
  const analysisDayEnd = Date.UTC(
    analysisDate.getUTCFullYear(),
    analysisDate.getUTCMonth(),
    analysisDate.getUTCDate(),
    23,
    59,
    59,
    999,
  );

  for (const normalized of normalizedEvents) {
    if (
      normalized.date.status === "valid" &&
      normalized.date.earliestUtc !== null &&
      normalized.date.earliestUtc > analysisDayEnd
    ) {
      issues.push({
        id: `future-date:${normalized.event.event_id}`,
        code: "future_service_date",
        severity: "warning",
        eventIds: [normalized.event.event_id],
        message: `Tapahtuman ${normalized.event.event_id} päivämäärä on tulevaisuudessa.`,
      });
    }

    if (
      currentOdometerKm !== undefined &&
      normalized.odometer.status === "valid" &&
      normalized.odometer.kilometres !== null &&
      normalized.odometer.kilometres > currentOdometerKm
    ) {
      issues.push({
        id: `above-current-odometer:${normalized.event.event_id}`,
        code: "odometer_above_current",
        severity: "warning",
        eventIds: [normalized.event.event_id],
        message: `Tapahtuman ${normalized.event.event_id} normalisoitu mittarilukema ylittää ajoneuvon nykyisen lukeman.`,
      });
    }
  }

  for (let leftIndex = 0; leftIndex < normalizedEvents.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < normalizedEvents.length;
      rightIndex += 1
    ) {
      const first = normalizedEvents[leftIndex];
      const second = normalizedEvents[rightIndex];
      const ordered = orderDefinitively(first, second);

      if (
        ordered === null ||
        ordered.earlier.odometer.status !== "valid" ||
        ordered.later.odometer.status !== "valid" ||
        ordered.earlier.odometer.kilometres === null ||
        ordered.later.odometer.kilometres === null ||
        ordered.earlier.odometer.kilometres <=
          ordered.later.odometer.kilometres
      ) {
        continue;
      }

      issues.push({
        id: `odometer-decreases:${ordered.earlier.event.event_id}:${ordered.later.event.event_id}`,
        code: "odometer_decreases",
        severity: "warning",
        eventIds: [
          ordered.earlier.event.event_id,
          ordered.later.event.event_id,
        ],
        message: `Mittarilukema pienenee tapahtumasta ${ordered.earlier.event.event_id} myöhempään tapahtumaan ${ordered.later.event.event_id}. Tarkista päivämäärät, yksiköt ja lukemat.`,
      });
    }
  }

  return issues;
}

function duplicateSignals(
  left: NormalizedServiceEvent,
  right: NormalizedServiceEvent,
): string[] {
  const signals: string[] = [];

  if (
    left.date.status === "valid" &&
    right.date.status === "valid" &&
    left.date.earliestUtc === right.date.earliestUtc &&
    left.date.latestUtc === right.date.latestUtc
  ) {
    signals.push("sama päivämäärä");
  }

  if (
    left.odometer.status === "valid" &&
    right.odometer.status === "valid" &&
    left.odometer.kilometres !== null &&
    right.odometer.kilometres !== null &&
    Math.abs(left.odometer.kilometres - right.odometer.kilometres) <= 10
  ) {
    signals.push("sama mittarilukema");
  }

  const leftComponents = resolvedComponentCodes(left.event);
  const rightComponents = resolvedComponentCodes(right.event);

  if (
    [...leftComponents].some((component) => rightComponents.has(component))
  ) {
    signals.push("sama komponentti");
  }

  return signals;
}

function resolvedComponentCodes(event: ServiceEvent): Set<string> {
  return new Set(
    event.actions
      .map((action) => resolveActionComponentCode(action, event.raw_evidence))
      .filter((componentCode) => componentCode !== "other"),
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
