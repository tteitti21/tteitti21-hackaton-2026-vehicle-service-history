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
  replaced: "Vaihdettu",
  serviced: "Huollettu",
  repaired: "Korjattu",
  inspected: "Tarkastettu",
  adjusted: "Säädetty",
  unknown: "Epäselvä",
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
        "Excel-raporttia ei voitu muodostaa selaimessa. JSON-vienti on edelleen käytettävissä.",
      );
    } finally {
      setExcelExporting(false);
    }
  };

  return (
    <section className="reportSection" aria-labelledby="report-heading">
      <div className="reportHeading">
        <div>
          <p className="sectionLabel">Vaihe 8 / Raportti ja paikallinen vienti</p>
          <h2 id="report-heading">
            Tarkista raportti ja tallenna se omalle laitteellesi.
          </h2>
        </div>
        <div className="localExportNotice">
          <strong>Vienti tapahtuu vain selaimessa</strong>
          <p>
            JSON- ja Excel-tiedostot muodostetaan tästä tarkistetusta
            istuntotilasta ilman uutta verkkopyyntöä. Kuvat eivät sisälly
            raporttiin.
          </p>
        </div>
      </div>

      {report === null ? (
        <div className="emptyResolutionState">
          <span aria-hidden="true">08</span>
          <div>
            <strong>Raportti odottaa valmista tilalaskentaa.</strong>
            <p>
              Vahvista huoltohistoria ja ajoneuvoversio sekä suorita
              huoltovälitutkimus.
            </p>
          </div>
        </div>
      ) : (
        <div className="reportWorkspace">
          <div className="reportSnapshotHeader">
            <div>
              <p className="reportKicker">Paikallinen raporttinäkymä</p>
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
                <dt>Nykyinen mittarilukema</dt>
                <dd>{formatKilometres(report.vehicle.current_odometer_km)}</dd>
              </div>
              <div>
                <dt>Laskentapäivä</dt>
                <dd>{formatFinnishDate(report.metadata.analysis_date)}</dd>
              </div>
              <div>
                <dt>Variantin yhteensopivuus</dt>
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
              <strong>Vie tarkistettu raportti</strong>
              <p>
                Excel-solujen ulkoinen tekstisisältö suojataan kaavojen
                suorittamiselta.
              </p>
            </div>
            <div className="reportExportButtons">
              <button
                className="secondaryButton"
                type="button"
                onClick={downloadJson}
              >
                Lataa JSON
              </button>
              <button
                className="primaryButton"
                type="button"
                disabled={excelExporting}
                onClick={downloadExcel}
              >
                {excelExporting ? "Luodaan Exceliä…" : "Lataa Excel"}
              </button>
            </div>
          </div>

          {exportError !== null ? (
            <div className="reportExportError" role="alert">
              {exportError}
            </div>
          ) : null}

          <div className="reportSummaryGrid" aria-label="Raportin yhteenveto">
            <ReportSummaryMetric
              value={report.summary.service_event_count}
              label="huoltotapahtumaa"
            />
            <ReportSummaryMetric
              value={report.summary.component_count}
              label="komponenttia"
            />
            <ReportSummaryMetric
              value={report.summary.source_count}
              label="lähderiviä"
            />
            <ReportSummaryMetric
              value={
                report.summary.highest_priority_status === null
                  ? "–"
                  : REPORT_STATUS_LABELS_FI[
                      report.summary.highest_priority_status
                    ]
              }
              label="korkein tilaprioriteetti"
            />
          </div>

          <div className="reportUncertainty">
            <strong>Ajoneuvoversion epävarmuus</strong>
            <p>{report.vehicle.resolution.compatibility_explanation}</p>
            {report.vehicle.resolution.missing_distinguishing_fields.length >
            0 ? (
              <p>
                Puuttuvat erottelutiedot:{" "}
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
            <strong>Rajaus</strong>
            <p>{report.metadata.disclaimer_fi}</p>
            <p>
              Raportti vastaa yllä näkyvää tarkistettua selaintilaa.
              Latauksen jälkeen tiedosto on käyttäjän hallinnassa.
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
      <summary>Raportin varoitukset ({warnings.length})</summary>
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
      title="Tarkistettu huoltohistoria"
      description="Arvot vastaavat selaimessa tarkistettua historiaa. Mittarilukema esitetään kilometreinä."
    >
      {events.length === 0 ? (
        <p className="reportEmptyTable">
          Huoltohistoriasta ei löytynyt merkintää.
        </p>
      ) : (
        <div className="reportTableFrame">
          <table className="reportTable">
            <thead>
              <tr>
                <th>Päivä</th>
                <th>Mittarilukema</th>
                <th>Toimenpiteet</th>
                <th>Raaka näyttö ja epävarmuus</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.event_id}>
                  <td>
                    <strong>{event.service_date?.value ?? "Ei tiedossa"}</strong>
                    <span>{event.service_date?.precision ?? "puuttuu"}</span>
                  </td>
                  <td>
                    <strong>
                      {event.odometer_km === null
                        ? "Ei tiedossa"
                        : formatKilometres(event.odometer_km)}
                    </strong>
                    {event.original_odometer_unit !== null ? (
                      <span>
                        Alkuperäinen: {event.original_odometer_value}{" "}
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
                    <p>{event.raw_evidence || "Ei raakatekstiä"}</p>
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
      title="Komponenttien laskettu tila"
      description="Tilat ja erääntymisarviot ovat sovelluskoodin laskemia. Lähdekonflikteja ei ole keskiarvoistettu."
    >
      <div className="reportTableFrame">
        <table className="reportTable reportComponentTable">
          <thead>
            <tr>
              <th>Komponentti</th>
              <th>Tila ja syyt</th>
              <th>Huoltoväli</th>
              <th>Laskettu jäljellä</th>
              <th>Epävarmuus</th>
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
                      ? "Aika ei laskettavissa"
                      : `${component.months_remaining} kk`}
                  </span>
                  <span>
                    Erääntyy:{" "}
                    {component.due_date === null
                      ? "–"
                      : formatFinnishDate(component.due_date)}
                  </span>
                </td>
                <td>
                  {component.conflict_summary ??
                    component.conditions ??
                    "Ei erillistä ehtoa"}
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
      title="Lähteet ja yhteensopivuus"
      description="Mukana ovat valitun ajoneuvoversion lähteet sekä jokainen huoltoväliväite, myös ristiriitaiset väitteet."
    >
      <div className="reportTableFrame">
        <table className="reportTable reportSourceTable">
          <thead>
            <tr>
              <th>Rooli</th>
              <th>Kohde ja väli</th>
              <th>Yhteensopivuus</th>
              <th>Lähde</th>
              <th>Näyttö</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.source_id}>
                <td>
                  {source.source_scope === "vehicle_resolution"
                    ? "Ajoneuvoversio"
                    : "Huoltoväli"}
                  {source.recommended === true ? (
                    <span>Valittu näyttö</span>
                  ) : null}
                </td>
                <td>
                  <strong>{source.component_label ?? "Ajoneuvo"}</strong>
                  <span>{formatSourceInterval(source)}</span>
                  <code>{source.claim_id ?? source.source_id}</code>
                </td>
                <td>
                  <strong>
                    {REPORT_COMPATIBILITY_LABELS_FI[source.compatibility]}
                  </strong>
                  <span>{source.compatibility_notes}</span>
                  {source.authority_rank !== null ? (
                    <span>Lähdetaso {source.authority_rank}</span>
                  ) : null}
                </td>
                <td>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title}
                  </a>
                  <span>{source.publisher ?? "Julkaisija ei tiedossa"}</span>
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
      : `${component.recommended_interval_months} kk`,
  ].filter((value): value is string => value !== null);

  if (values.length === 0) {
    return "Ei varmennettua väliä";
  }
  return values.join(component.whichever_first ? " tai " : " + ");
}

function formatSourceInterval(source: ReportSource): string {
  const values = [
    source.interval_km === null ? null : formatKilometres(source.interval_km),
    source.interval_months === null ? null : `${source.interval_months} kk`,
  ].filter((value): value is string => value !== null);
  const normalized =
    values.length === 0
      ? "Ei huoltoväliväitettä"
      : values.join(source.whichever_first ? " tai " : " + ");
  const original =
    source.original_value === null || source.original_unit === null
      ? ""
      : ` (alkuperäinen ${source.original_value} ${source.original_unit})`;
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
