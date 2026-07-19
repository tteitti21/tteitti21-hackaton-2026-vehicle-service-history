import type {
  ComponentStatus,
  ComponentStatusReasonCode,
  ComponentStatusValue,
} from "@/domain/schemas/component-status";
import type {
  ComponentResearch,
  MaintenanceResearch,
} from "@/domain/schemas/maintenance-research";
import type { ServiceHistory } from "@/domain/schemas/service-history";
import {
  addCalendarMonths,
  completeCalendarMonthsBetween,
  formatIsoDate,
  toUtcDateOnly,
} from "./calendar";
import { selectLastRelevantService } from "./service-selection";

export interface StatusEngineThresholds {
  immediateDistanceMinimumKm: number;
  immediateDistanceFraction: number;
  warningDistanceMinimumKm: number;
  warningDistanceFraction: number;
  immediateTimeMonths: number;
  warningTimeMonths: number;
  overdueDistanceToleranceKm: number;
  overdueTimeToleranceMonths: number;
  minimumServiceConfidence: number;
}

export const DEFAULT_STATUS_THRESHOLDS: Readonly<StatusEngineThresholds> = {
  immediateDistanceMinimumKm: 1_000,
  immediateDistanceFraction: 0.02,
  warningDistanceMinimumKm: 5_000,
  warningDistanceFraction: 0.1,
  immediateTimeMonths: 1,
  warningTimeMonths: 3,
  overdueDistanceToleranceKm: 0,
  overdueTimeToleranceMonths: 0,
  minimumServiceConfidence: 0.6,
};

export interface StatusEngineInput {
  research: MaintenanceResearch;
  serviceHistory: ServiceHistory;
  currentOdometerKm: number;
  analysisDate: Date;
  thresholds?: Partial<StatusEngineThresholds>;
}

export interface ComponentStatusSummary {
  statuses: ComponentStatus[];
  counts: Record<ComponentStatusValue, number>;
  highestPriorityStatus: ComponentStatusValue | null;
  analysisDate: string;
}

interface DimensionEvaluation {
  status: Extract<
    ComponentStatusValue,
    "ok" | "due_soon" | "due" | "overdue"
  >;
  reasonCode:
    | "distance_overdue"
    | "time_overdue"
    | "distance_due"
    | "time_due"
    | "distance_due_soon"
    | "time_due_soon"
    | null;
}

const STATUS_PRIORITY: Record<ComponentStatusValue, number> = {
  conflicting_sources: 7,
  insufficient_evidence: 6,
  unknown: 5,
  overdue: 4,
  due: 3,
  due_soon: 2,
  ok: 1,
};

export function calculateComponentStatusSummary(
  input: StatusEngineInput,
): ComponentStatusSummary {
  assertEngineInput(input);
  const thresholds = resolveThresholds(input.thresholds);
  const statuses = input.research.components.map((component) =>
    calculateComponentStatus(component, input, thresholds),
  );
  const counts = createEmptyCounts();
  for (const status of statuses) {
    counts[status.status] += 1;
  }

  return {
    statuses,
    counts,
    highestPriorityStatus:
      statuses.reduce<ComponentStatusValue | null>(
        (highest, status) =>
          highest === null ||
          STATUS_PRIORITY[status.status] > STATUS_PRIORITY[highest]
            ? status.status
            : highest,
        null,
      ),
    analysisDate: formatIsoDate(input.analysisDate),
  };
}

export function calculateComponentStatus(
  component: ComponentResearch,
  input: Omit<StatusEngineInput, "thresholds">,
  thresholds: StatusEngineThresholds = DEFAULT_STATUS_THRESHOLDS,
): ComponentStatus {
  if (component.resolution === "conflicting_sources") {
    return emptyStatus(component, "conflicting_sources", ["source_conflict"]);
  }
  if (component.resolution === "insufficient_evidence") {
    return emptyStatus(component, "insufficient_evidence", [
      "insufficient_source_evidence",
    ]);
  }

  const claim = component.interval_claims.find(
    (candidate) => candidate.claim_id === component.recommended_claim_id,
  );
  if (claim === undefined) {
    return emptyStatus(component, "unknown", ["interval_claim_missing"]);
  }

  const selection = selectLastRelevantService(
    input.serviceHistory.events,
    component.component_code,
    {
      currentOdometerKm: input.currentOdometerKm,
      analysisDate: input.analysisDate,
      minimumConfidence: thresholds.minimumServiceConfidence,
    },
  );
  if (selection.event === null || selection.normalized === null) {
    return {
      ...emptyStatus(component, "unknown", selection.reasonCodes),
      interval_claim_id: claim.claim_id,
    };
  }

  const reasons: ComponentStatusReasonCode[] = [];
  const evaluations: DimensionEvaluation[] = [];
  let distanceUsedKm: number | null = null;
  let distanceRemainingKm: number | null = null;
  let dueOdometerKm: number | null = null;
  let monthsUsed: number | null = null;
  let monthsRemaining: number | null = null;
  let dueDate: string | null = null;

  if (claim.interval_km !== null) {
    const odometer = selection.normalized.odometer;
    if (odometer.status === "valid" && odometer.kilometres !== null) {
      const exactDistanceUsed =
        input.currentOdometerKm - odometer.kilometres;
      const exactRemaining = claim.interval_km - exactDistanceUsed;
      distanceUsedKm = Math.round(exactDistanceUsed);
      distanceRemainingKm = Math.round(exactRemaining);
      dueOdometerKm = Math.round(odometer.kilometres + claim.interval_km);
      evaluations.push(
        evaluateDistance(exactRemaining, claim.interval_km, thresholds),
      );
    } else {
      reasons.push(odometerReason(odometer.status));
    }
  }

  if (claim.interval_months !== null) {
    const date = selection.normalized.date;
    if (
      date.status === "valid" &&
      selection.event.service_date?.precision === "day" &&
      date.earliestUtc !== null
    ) {
      const serviceDate = new Date(date.earliestUtc);
      monthsUsed = completeCalendarMonthsBetween(
        serviceDate,
        toUtcDateOnly(input.analysisDate),
      );
      monthsRemaining = claim.interval_months - monthsUsed;
      dueDate = formatIsoDate(
        addCalendarMonths(serviceDate, claim.interval_months),
      );
      evaluations.push(
        evaluateTime(monthsRemaining, thresholds),
      );
    } else {
      reasons.push(dateReason(date.status, selection.event.service_date?.precision));
    }
  }

  if (evaluations.length === 0) {
    return {
      component_code: component.component_code,
      status: "unknown",
      reason_codes: uniqueReasons(reasons),
      last_service_event_id: selection.event.event_id,
      interval_claim_id: claim.claim_id,
      distance_used_km: distanceUsedKm,
      distance_remaining_km: distanceRemainingKm,
      months_used: monthsUsed,
      months_remaining: monthsRemaining,
      due_odometer_km: dueOdometerKm,
      due_date: dueDate,
    };
  }

  const status = evaluations.reduce(
    (highest, evaluation) =>
      STATUS_PRIORITY[evaluation.status] > STATUS_PRIORITY[highest.status]
        ? evaluation
        : highest,
  ).status;
  reasons.push(
    ...evaluations.flatMap((evaluation) =>
      evaluation.reasonCode === null ? [] : [evaluation.reasonCode],
    ),
  );
  if (status === "ok") {
    reasons.push("within_interval");
  }

  return {
    component_code: component.component_code,
    status,
    reason_codes: uniqueReasons(reasons),
    last_service_event_id: selection.event.event_id,
    interval_claim_id: claim.claim_id,
    distance_used_km: distanceUsedKm,
    distance_remaining_km: distanceRemainingKm,
    months_used: monthsUsed,
    months_remaining: monthsRemaining,
    due_odometer_km: dueOdometerKm,
    due_date: dueDate,
  };
}

function evaluateDistance(
  remainingKm: number,
  intervalKm: number,
  thresholds: StatusEngineThresholds,
): DimensionEvaluation {
  if (remainingKm < -thresholds.overdueDistanceToleranceKm) {
    return { status: "overdue", reasonCode: "distance_overdue" };
  }
  const immediateThreshold = Math.max(
    thresholds.immediateDistanceMinimumKm,
    intervalKm * thresholds.immediateDistanceFraction,
  );
  if (remainingKm <= immediateThreshold) {
    return { status: "due", reasonCode: "distance_due" };
  }
  const warningThreshold = Math.max(
    thresholds.warningDistanceMinimumKm,
    intervalKm * thresholds.warningDistanceFraction,
  );
  if (remainingKm <= warningThreshold) {
    return { status: "due_soon", reasonCode: "distance_due_soon" };
  }
  return { status: "ok", reasonCode: null };
}

function evaluateTime(
  remainingMonths: number,
  thresholds: StatusEngineThresholds,
): DimensionEvaluation {
  if (remainingMonths < -thresholds.overdueTimeToleranceMonths) {
    return { status: "overdue", reasonCode: "time_overdue" };
  }
  if (remainingMonths <= thresholds.immediateTimeMonths) {
    return { status: "due", reasonCode: "time_due" };
  }
  if (remainingMonths <= thresholds.warningTimeMonths) {
    return { status: "due_soon", reasonCode: "time_due_soon" };
  }
  return { status: "ok", reasonCode: null };
}

function odometerReason(
  status: "missing" | "valid" | "unverified" | "invalid",
): ComponentStatusReasonCode {
  if (status === "invalid") {
    return "invalid_service_odometer";
  }
  if (status === "unverified") {
    return "unverified_service_odometer";
  }
  return "missing_service_odometer";
}

function dateReason(
  status: "missing" | "valid" | "unverified" | "invalid",
  precision: "day" | "month" | "year" | "unknown" | undefined,
): ComponentStatusReasonCode {
  if (status === "invalid") {
    return "invalid_service_date";
  }
  if (status === "unverified") {
    return "unverified_service_date";
  }
  if (status === "valid" && precision !== "day") {
    return "imprecise_service_date";
  }
  return "missing_service_date";
}

function emptyStatus(
  component: ComponentResearch,
  status: ComponentStatusValue,
  reasonCodes: ComponentStatusReasonCode[],
): ComponentStatus {
  return {
    component_code: component.component_code,
    status,
    reason_codes: uniqueReasons(reasonCodes),
    last_service_event_id: null,
    interval_claim_id: null,
    distance_used_km: null,
    distance_remaining_km: null,
    months_used: null,
    months_remaining: null,
    due_odometer_km: null,
    due_date: null,
  };
}

function uniqueReasons(
  reasons: ComponentStatusReasonCode[],
): ComponentStatusReasonCode[] {
  const safeReasons: ComponentStatusReasonCode[] =
    reasons.length > 0 ? reasons : ["interval_claim_missing"];
  return [...new Set<ComponentStatusReasonCode>(safeReasons)];
}

function resolveThresholds(
  thresholds: Partial<StatusEngineThresholds> | undefined,
): StatusEngineThresholds {
  const resolved = { ...DEFAULT_STATUS_THRESHOLDS, ...thresholds };
  for (const [key, value] of Object.entries(resolved)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`Invalid status threshold: ${key}.`);
    }
  }
  if (resolved.minimumServiceConfidence > 1) {
    throw new RangeError("Minimum service confidence must not exceed one.");
  }
  if (
    resolved.warningDistanceMinimumKm <
      resolved.immediateDistanceMinimumKm ||
    resolved.warningDistanceFraction <
      resolved.immediateDistanceFraction ||
    resolved.warningTimeMonths < resolved.immediateTimeMonths
  ) {
    throw new RangeError("Warning thresholds must not be below due thresholds.");
  }
  return resolved;
}

function assertEngineInput(input: StatusEngineInput): void {
  if (
    !Number.isSafeInteger(input.currentOdometerKm) ||
    input.currentOdometerKm < 0 ||
    Number.isNaN(input.analysisDate.getTime())
  ) {
    throw new RangeError("Status engine input is invalid.");
  }
}

function createEmptyCounts(): Record<ComponentStatusValue, number> {
  return {
    ok: 0,
    due_soon: 0,
    due: 0,
    overdue: 0,
    unknown: 0,
    insufficient_evidence: 0,
    conflicting_sources: 0,
  };
}
