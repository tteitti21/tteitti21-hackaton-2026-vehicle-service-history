"use client";

import { useMemo } from "react";

import { useAnalysisSession } from "@/components/session/analysis-session-provider";
import type {
  ComponentStatus,
  ComponentStatusReasonCode,
  ComponentStatusValue,
} from "@/domain/schemas/component-status";
import type { ComponentResearch } from "@/domain/schemas/maintenance-research";
import { calculateComponentStatusSummary } from "@/domain/status-engine/status-engine";

const statusLabels: Record<ComponentStatusValue, string> = {
  ok: "OK",
  due_soon: "Due soon",
  due: "Due",
  overdue: "Overdue",
  unknown: "Unknown",
  insufficient_evidence: "Insufficient evidence",
  conflicting_sources: "Conflicting sources",
};

const reasonLabels: Record<ComponentStatusReasonCode, string> = {
  source_conflict: "Reliable sources report different maintenance intervals.",
  insufficient_source_evidence:
    "No sufficiently reliable maintenance interval compatible with the variant was found.",
  interval_claim_missing: "The selected maintenance interval claim was not found.",
  no_service_history_entry: "No service-history entry was found.",
  no_qualifying_service_event:
    "The entry could not be used as the starting point for the maintenance interval.",
  inspection_only: "The history contains only an inspection, not a replacement or service.",
  low_confidence_service_event:
    "The service record match was below the confidence threshold.",
  ambiguous_last_service:
    "The latest applicable service could not be selected unambiguously.",
  future_service_date: "The service record date is in the future.",
  service_odometer_above_current:
    "The service record odometer reading exceeds the current reading.",
  odometer_chronology_conflict:
    "The odometer readings in the component service records conflict.",
  missing_service_date: "The service date is missing.",
  imprecise_service_date:
    "The service date is not precise enough for month calculations.",
  invalid_service_date: "The service date is invalid.",
  unverified_service_date: "The service date could not be verified.",
  missing_service_odometer: "The service odometer reading is missing.",
  invalid_service_odometer: "The service odometer reading is invalid.",
  unverified_service_odometer:
    "The service odometer unit could not be verified.",
  distance_overdue: "The distance interval has been exceeded.",
  time_overdue: "The time interval has been exceeded.",
  distance_due: "The distance interval has been reached or is within the immediate threshold.",
  time_due: "The time interval has been reached or is within one month.",
  distance_due_soon: "The distance interval is approaching.",
  time_due_soon: "The time interval is approaching.",
  within_interval: "The known calculation thresholds have not been reached.",
};

const visibleStatusOrder: readonly ComponentStatusValue[] = [
  "overdue",
  "due",
  "due_soon",
  "unknown",
  "conflicting_sources",
  "insufficient_evidence",
  "ok",
];

export function ComponentStatusSummaryPanel() {
  const { state } = useAnalysisSession();
  const summary = useMemo(() => {
    if (
      state.maintenanceResearch === null ||
      state.serviceHistory === null ||
      state.confirmedVehicle === null
    ) {
      return null;
    }

    return calculateComponentStatusSummary({
      research: state.maintenanceResearch,
      serviceHistory: state.serviceHistory,
      currentOdometerKm: state.confirmedVehicle.currentOdometerKm,
      analysisDate: new Date(state.maintenanceResearch.researched_at),
    });
  }, [
    state.confirmedVehicle,
    state.maintenanceResearch,
    state.serviceHistory,
  ]);

  const componentByCode = useMemo(
    () =>
      new Map(
        state.maintenanceResearch?.components.map((component) => [
          component.component_code,
          component,
        ]) ?? [],
      ),
    [state.maintenanceResearch],
  );

  return (
    <section
      className="componentStatusSection"
      aria-labelledby="component-status-heading"
    >
      <div className="componentStatusHeading">
        <div>
          <p className="sectionLabel">Phase 7 / Deterministic status calculation</p>
          <h2 id="component-status-heading">
            Maintenance status is calculated from verified evidence.
          </h2>
        </div>
        <div className="calculationNotice">
          <strong>Status is not an AI opinion</strong>
          <p>
            Application code uses the confirmed service history, selected
            source interval, current odometer reading, and calculation date.
            Source text cannot change the result.
          </p>
        </div>
      </div>

      {summary === null ? (
        <div className="emptyResolutionState">
          <span aria-hidden="true">07</span>
          <div>
            <strong>Status calculation is waiting for maintenance interval research.</strong>
            <p>
              When Phase 6 is complete, results are calculated locally without
              a new network request.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="statusCountGrid" aria-label="Status summary">
            {visibleStatusOrder.map((status) => (
              <div key={status} className={`statusCount status-${status}`}>
                <strong>{summary.counts[status]}</strong>
                <span>{statusLabels[status]}</span>
              </div>
            ))}
          </div>
          <p className="calculationTimestamp">
            Calculation date{" "}
            <time dateTime={summary.analysisDate}>
              {formatFinnishDate(summary.analysisDate)}
            </time>
          </p>
          <div className="componentStatusList">
            {summary.statuses.map((status) => {
              const component = componentByCode.get(status.component_code);
              return component ? (
                <StatusCard
                  key={status.component_code}
                  status={status}
                  component={component}
                />
              ) : null;
            })}
          </div>
        </>
      )}
    </section>
  );
}

function StatusCard({
  status,
  component,
}: Readonly<{
  status: ComponentStatus;
  component: ComponentResearch;
}>) {
  return (
    <article className="componentStatusCard">
      <header>
        <div>
          <span className={`calculatedStatus status-${status.status}`}>
            {statusLabels[status.status]}
          </span>
          <h3>{component.component_label}</h3>
        </div>
        <span className="calculatedByCode">Calculated by application code</span>
      </header>

      <ul className="statusReasons">
        {status.reason_codes.map((reason) => (
          <li key={reason}>{reasonLabels[reason]}</li>
        ))}
      </ul>

      <dl className="statusMetrics">
        <StatusMetric
          label="Distance used"
          value={formatKilometres(status.distance_used_km)}
        />
        <StatusMetric
          label="Distance remaining"
          value={formatKilometres(status.distance_remaining_km)}
        />
        <StatusMetric
          label="Time used"
          value={formatMonths(status.months_used)}
        />
        <StatusMetric
          label="Time remaining"
          value={formatMonths(status.months_remaining)}
        />
        <StatusMetric
          label="Estimated due odometer"
          value={formatKilometres(status.due_odometer_km)}
        />
        <StatusMetric
          label="Estimated due date"
          value={
            status.due_date === null
              ? "Cannot be calculated"
              : formatFinnishDate(status.due_date)
          }
        />
      </dl>

      <p className="statusEvidenceIds">
        Service record: {status.last_service_event_id ?? "no selected record"}
        {" · "}
        Source claim: {status.interval_claim_id ?? "no selected claim"}
      </p>
    </article>
  );
}

function StatusMetric({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatKilometres(value: number | null): string {
  return value === null
    ? "Cannot be calculated"
    : `${new Intl.NumberFormat("fi-FI").format(value)} km`;
}

function formatMonths(value: number | null): string {
  return value === null ? "Cannot be calculated" : `${value} months`;
}

function formatFinnishDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("fi-FI").format(
    new Date(Date.UTC(year!, month! - 1, day!)),
  );
}
