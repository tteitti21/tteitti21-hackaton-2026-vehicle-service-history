"use client";

import { useMemo, useState } from "react";

import { useAnalysisSession } from "@/components/session/analysis-session-provider";
import {
  createVehicleReportModel,
  REPORT_COMPATIBILITY_LABELS_FI,
  REPORT_STATUS_LABELS_FI,
  type ReportComponent,
  type ReportServiceEvent,
  type ReportSource,
} from "@/domain/report/report-model";
import type { ServiceAction } from "@/domain/schemas/service-history";
import {
  createJsonReportBlob,
  createReportFilename,
  downloadBlobLocally,
} from "@/lib/export/report-download";
import { createExcelReportBlob } from "@/lib/export/excel-export";

const actionLabels: Record<ServiceAction["action_type"], string> = {
  replaced: "Replaced",
  serviced: "Serviced",
  repaired: "Repaired",
  inspected: "Inspected",
  adjusted: "Adjusted",
  unknown: "Unknown",
};

export function VehicleReportPanel() {
  const { state } = useAnalysisSession();
  const [excelExporting, setExcelExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const report = useMemo(() => {
    if (
      state.confirmedVehicle === null ||
      state.confirmedVehicleCandidateId === null ||
      state.vehicleResolution === null ||
      state.serviceHistory === null ||
      !state.serviceHistoryReviewConfirmed ||
      state.maintenanceResearch === null
    ) {
      return null;
    }

    return createVehicleReportModel({
      confirmedVehicle: state.confirmedVehicle,
      confirmedVehicleCandidateId: state.confirmedVehicleCandidateId,
      vehicleResolution: state.vehicleResolution,
      serviceHistory: state.serviceHistory,
      maintenanceResearch: state.maintenanceResearch,
      generatedAt: new Date(),
    });
  }, [
    state.confirmedVehicle,
    state.confirmedVehicleCandidateId,
    state.maintenanceResearch,
    state.serviceHistory,
    state.serviceHistoryReviewConfirmed,
    state.vehicleResolution,
  ]);

  const downloadJson = () => {
    if (report === null) {
      return;
    }
    setExportError(null);
    downloadBlobLocally(
      createJsonReportBlob(report),
      createReportFilename(report, "json"),
    );
  };

  const downloadExcel = async () => {
    if (report === null || excelExporting) {
      return;
    }
    setExcelExporting(true);
    setExportError(null);
    try {
      const blob = await createExcelReportBlob(report);
      downloadBlobLocally(blob, createReportFilename(report, "xlsx"));
    } catch {
      setExportError(
        "The Excel report could not be generated in the browser. JSON export is still available.",
      );
    } finally {
      setExcelExporting(false);
    }
  };

  return (
    <section className="reportSection" aria-labelledby="report-heading">
      <div className="reportHeading">
        <div>
          <p className="sectionLabel">Phase 8 / Report and local export</p>
          <h2 id="report-heading">
            Review the report and save it to your device.
          </h2>
        </div>
        <div className="localExportNotice">
          <strong>Export happens only in the browser</strong>
          <p>
            JSON and Excel files are generated from this reviewed session state
            without a new network request. Images are not included in the
            report.
          </p>
        </div>
      </div>

      {report === null ? (
        <div className="emptyResolutionState">
          <span aria-hidden="true">08</span>
          <div>
            <strong>The report is waiting for completed status calculation.</strong>
            <p>
              Confirm the service history and vehicle variant, then run
              maintenance interval research.
            </p>
          </div>
        </div>
      ) : (
        <div className="reportWorkspace">
          <div className="reportSnapshotHeader">
            <div>
              <p className="reportKicker">Local report view</p>
              <h3>
                {report.vehicle.make} {report.vehicle.model}
              </h3>
              <p>
                {[
                  report.vehicle.resolved_variant.generation,
                  report.vehicle.resolved_variant.model_year,
                  report.vehicle.resolved_variant.engine,
                  report.vehicle.resolved_variant.transmission,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <dl>
              <div>
                <dt>Current odometer reading</dt>
                <dd>{formatKilometres(report.vehicle.current_odometer_km)}</dd>
              </div>
              <div>
                <dt>Calculation date</dt>
                <dd>{formatFinnishDate(report.metadata.analysis_date)}</dd>
              </div>
              <div>
                <dt>Variant compatibility</dt>
                <dd>
                  {
                    REPORT_COMPATIBILITY_LABELS_FI[
                      report.vehicle.resolution.compatibility
                    ]
                  }
                </dd>
              </div>
            </dl>
          </div>

          <div className="reportExportActions">
            <div>
              <strong>Export the reviewed report</strong>
              <p>
                External text content in Excel cells is protected from formula
                execution.
              </p>
            </div>
            <div className="reportExportButtons">
              <button
                className="secondaryButton"
                type="button"
                onClick={downloadJson}
              >
                Download JSON
              </button>
              <button
                className="primaryButton"
                type="button"
                disabled={excelExporting}
                onClick={downloadExcel}
              >
                {excelExporting ? "Creating Excel…" : "Download Excel"}
              </button>
            </div>
          </div>

          {exportError !== null ? (
            <div className="reportExportError" role="alert">
              {exportError}
            </div>
          ) : null}

          <div className="reportSummaryGrid" aria-label="Report summary">
            <ReportSummaryMetric
              value={report.summary.service_event_count}
              label="service events"
            />
            <ReportSummaryMetric
              value={report.summary.component_count}
              label="components"
            />
            <ReportSummaryMetric
              value={report.summary.source_count}
              label="source rows"
            />
            <ReportSummaryMetric
              value={
                report.summary.highest_priority_status === null
                  ? "–"
                  : REPORT_STATUS_LABELS_FI[
                      report.summary.highest_priority_status
                    ]
              }
              label="highest status priority"
            />
          </div>

          <div className="reportUncertainty">
            <strong>Vehicle variant uncertainty</strong>
            <p>{report.vehicle.resolution.compatibility_explanation}</p>
            {report.vehicle.resolution.missing_distinguishing_fields.length >
            0 ? (
              <p>
                Missing distinguishing details:{" "}
                {report.vehicle.resolution.missing_distinguishing_fields.join(
                  ", ",
                )}
              </p>
            ) : null}
          </div>

          <ReportWarnings
            warnings={[
              ...report.warnings.service_history,
              ...report.warnings.vehicle_resolution,
              ...report.warnings.maintenance_research,
            ]}
          />

          <ReportServiceHistoryTable events={report.service_history} />
          <ReportComponentTable components={report.components} />
          <ReportSourceTable sources={report.sources} />

          <div className="reportDisclaimer">
            <strong>Scope</strong>
            <p>{report.metadata.disclaimer_fi}</p>
            <p>
              The report reflects the reviewed browser state shown above. After
              download, the file is under the user&apos;s control.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function ReportWarnings({ warnings }: Readonly<{ warnings: string[] }>) {
  if (warnings.length === 0) {
    return null;
  }
  return (
    <details className="reportWarnings">
      <summary>Report warnings ({warnings.length})</summary>
      <ul>
        {warnings.map((warning, index) => (
          <li key={`${index}-${warning}`}>{warning}</li>
        ))}
      </ul>
    </details>
  );
}

function ReportSummaryMetric({
  value,
  label,
}: Readonly<{ value: number | string; label: string }>) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ReportServiceHistoryTable({
  events,
}: Readonly<{ events: ReportServiceEvent[] }>) {
  return (
    <ReportTableSection
      title="Reviewed service history"
      description="Values correspond to the history reviewed in the browser. The odometer reading is shown in kilometres."
    >
      {events.length === 0 ? (
        <p className="reportEmptyTable">
          No service-history entry was found.
        </p>
      ) : (
        <div className="reportTableFrame">
          <table className="reportTable">
            <thead>
              <tr>
                <th>Date</th>
                <th>Odometer reading</th>
                <th>Actions</th>
                <th>Raw evidence and uncertainty</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.event_id}>
                  <td>
                    <strong>{event.service_date?.value ?? "Unknown"}</strong>
                    <span>{event.service_date?.precision ?? "missing"}</span>
                  </td>
                  <td>
                    <strong>
                      {event.odometer_km === null
                        ? "Unknown"
                        : formatKilometres(event.odometer_km)}
                    </strong>
                    {event.original_odometer_unit !== null ? (
                      <span>
                        Original: {event.original_odometer_value}{" "}
                        {event.original_odometer_unit}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <ul>
                      {event.actions.map((action, index) => (
                        <li key={`${event.event_id}-${index}`}>
                          <strong>{action.component_label}</strong>{" "}
                          {actionLabels[action.action_type]} –{" "}
                          {action.description}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>
                    <p>{event.raw_evidence || "No raw text"}</p>
                    {event.ambiguities.length > 0 ? (
                      <span>{event.ambiguities.join(" · ")}</span>
                    ) : null}
                    <code>{event.source_image_ids.join(", ")}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportTableSection>
  );
}

function ReportComponentTable({
  components,
}: Readonly<{ components: ReportComponent[] }>) {
  return (
    <ReportTableSection
      title="Calculated component status"
      description="Statuses and due estimates are calculated by application code. Source conflicts have not been averaged."
    >
      <div className="reportTableFrame">
        <table className="reportTable reportComponentTable">
          <thead>
            <tr>
              <th>Component</th>
              <th>Status and reasons</th>
              <th>Maintenance interval</th>
              <th>Calculated remaining</th>
              <th>Uncertainty</th>
            </tr>
          </thead>
          <tbody>
            {components.map((component) => (
              <tr key={component.component_code}>
                <td>
                  <strong>{component.component_label}</strong>
                  <code>{component.component_code}</code>
                </td>
                <td>
                  <span
                    className={`calculatedStatus status-${component.status}`}
                  >
                    {component.status_label_fi}
                  </span>
                  <small>{component.reason_codes.join(" · ")}</small>
                </td>
                <td>{formatComponentInterval(component)}</td>
                <td>
                  <strong>
                    {component.distance_remaining_km === null
                      ? "–"
                      : formatKilometres(component.distance_remaining_km)}
                  </strong>
                  <span>
                    {component.months_remaining === null
                      ? "Time cannot be calculated"
                      : `${component.months_remaining} months`}
                  </span>
                  <span>
                    Due:{" "}
                    {component.due_date === null
                      ? "–"
                      : formatFinnishDate(component.due_date)}
                  </span>
                </td>
                <td>
                  <strong>
                    Trustworthiness: {component.trustworthiness_label_fi} (
                    {component.trustworthiness_level})
                  </strong>
                  <span>{component.trustworthiness_note_fi}</span>
                  <span>{component.maintenance_suggestion_fi}</span>
                  <span>{component.service_history_note_fi}</span>
                  <span>
                    {component.conflict_summary ??
                      component.conditions ??
                      "No separate condition"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportTableSection>
  );
}

function ReportSourceTable({
  sources,
}: Readonly<{ sources: ReportSource[] }>) {
  return (
    <ReportTableSection
      title="Sources and compatibility"
      description="Includes sources for the selected vehicle variant and every maintenance interval claim, including conflicting claims."
    >
      <div className="reportTableFrame">
        <table className="reportTable reportSourceTable">
          <thead>
            <tr>
              <th>Role</th>
              <th>Subject and interval</th>
              <th>Compatibility</th>
              <th>Source</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.source_id}>
                <td>
                  {source.source_scope === "vehicle_resolution"
                    ? "Vehicle variant"
                    : "Maintenance interval"}
                  {source.recommended === true ? (
                    <span>Selected evidence</span>
                  ) : null}
                </td>
                <td>
                  <strong>{source.component_label ?? "Vehicle"}</strong>
                  <span>{formatSourceInterval(source)}</span>
                  <code>{source.claim_id ?? source.source_id}</code>
                </td>
                <td>
                  <strong>
                    {REPORT_COMPATIBILITY_LABELS_FI[source.compatibility]}
                  </strong>
                  <span>{source.compatibility_notes}</span>
                  {source.authority_rank !== null ? (
                    <span>Source tier {source.authority_rank}</span>
                  ) : null}
                  <span>
                    Trustworthiness: {source.trustworthiness_label_fi} (
                    {source.trustworthiness_level})
                  </span>
                  <span>{source.trustworthiness_note_fi}</span>
                </td>
                <td>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title}
                  </a>
                  <span>{source.publisher ?? "Publisher unknown"}</span>
                  <code>{source.url}</code>
                </td>
                <td>{source.evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportTableSection>
  );
}

function ReportTableSection({
  title,
  description,
  children,
}: Readonly<{
  title: string;
  description: string;
  children: React.ReactNode;
}>) {
  return (
    <section className="reportTableSection">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {children}
    </section>
  );
}

function formatComponentInterval(component: ReportComponent): string {
  const values = [
    component.recommended_interval_km === null
      ? null
      : formatKilometres(component.recommended_interval_km),
    component.recommended_interval_months === null
      ? null
      : `${component.recommended_interval_months} months`,
  ].filter((value): value is string => value !== null);

  if (values.length === 0) {
    return "No verified interval";
  }
  return values.join(component.whichever_first ? " or " : " + ");
}

function formatSourceInterval(source: ReportSource): string {
  const values = [
    source.interval_km === null ? null : formatKilometres(source.interval_km),
    source.interval_months === null ? null : `${source.interval_months} months`,
  ].filter((value): value is string => value !== null);
  const normalized =
    values.length === 0
      ? "No maintenance interval claim"
      : values.join(source.whichever_first ? " or " : " + ");
  const original =
    source.original_value === null || source.original_unit === null
      ? ""
      : ` (original ${source.original_value} ${source.original_unit})`;
  return `${normalized}${original}`;
}

function formatKilometres(value: number): string {
  return `${new Intl.NumberFormat("fi-FI", {
    maximumFractionDigits: 4,
  }).format(value)} km`;
}

function formatFinnishDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("fi-FI").format(
    new Date(Date.UTC(year!, month! - 1, day!)),
  );
}
