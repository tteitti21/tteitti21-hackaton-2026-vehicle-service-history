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
  ok: "Kunnossa",
  due_soon: "Lähestyy",
  due: "Ajankohtainen",
  overdue: "Myöhässä",
  unknown: "Epäselvä",
  insufficient_evidence: "Ei riittävää tietoa",
  conflicting_sources: "Lähteissä ristiriita",
};

const reasonLabels: Record<ComponentStatusReasonCode, string> = {
  source_conflict: "Luotettavat lähteet ilmoittavat eri huoltovälit.",
  insufficient_source_evidence:
    "Varianttiin sopivaa, riittävän luotettavaa huoltoväliä ei löytynyt.",
  interval_claim_missing: "Valittua huoltoväliväitettä ei löytynyt.",
  no_service_history_entry: "Huoltohistoriasta ei löytynyt merkintää.",
  no_qualifying_service_event:
    "Merkintää ei voitu käyttää huoltovälin aloituspisteenä.",
  inspection_only: "Historiassa on vain tarkastus, ei vaihtoa tai huoltoa.",
  low_confidence_service_event:
    "Huoltomerkinnän vastaavuus jäi luottamusrajan alle.",
  ambiguous_last_service:
    "Viimeisintä soveltuvaa huoltoa ei voitu valita yksiselitteisesti.",
  future_service_date: "Huoltomerkinnän päivämäärä on tulevaisuudessa.",
  service_odometer_above_current:
    "Huoltomerkinnän mittarilukema ylittää nykyisen lukeman.",
  odometer_chronology_conflict:
    "Komponentin huoltomerkintöjen mittarilukemat ovat ristiriidassa.",
  missing_service_date: "Huollon päivämäärä puuttuu.",
  imprecise_service_date:
    "Huollon päivämäärä ei ole riittävän tarkka kuukausilaskentaan.",
  invalid_service_date: "Huollon päivämäärä on virheellinen.",
  unverified_service_date: "Huollon päivämäärää ei voitu varmistaa.",
  missing_service_odometer: "Huollon mittarilukema puuttuu.",
  invalid_service_odometer: "Huollon mittarilukema on virheellinen.",
  unverified_service_odometer:
    "Huollon mittarilukeman yksikköä ei voitu varmistaa.",
  distance_overdue: "Kilometriväli on ylitetty.",
  time_overdue: "Aikaväli on ylitetty.",
  distance_due: "Kilometriväli on saavutettu tai välittömässä rajassa.",
  time_due: "Aikaväli on saavutettu tai kuukauden sisällä.",
  distance_due_soon: "Kilometriväli lähestyy.",
  time_due_soon: "Aikaväli lähestyy.",
  within_interval: "Tunnetut laskentamittojen rajat eivät ole täyttyneet.",
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
          <p className="sectionLabel">Vaihe 7 / Deterministinen tilalaskenta</p>
          <h2 id="component-status-heading">
            Huoltojen tila lasketaan todennetusta näytöstä.
          </h2>
        </div>
        <div className="calculationNotice">
          <strong>Tila ei ole tekoälyn mielipide</strong>
          <p>
            Sovelluskoodi käyttää vahvistettua huoltohistoriaa, valittua
            lähdeväliä, nykyistä mittarilukemaa ja laskentapäivää. Lähdeteksti
            ei voi muuttaa tulosta.
          </p>
        </div>
      </div>

      {summary === null ? (
        <div className="emptyResolutionState">
          <span aria-hidden="true">07</span>
          <div>
            <strong>Tilalaskenta odottaa huoltovälitutkimusta.</strong>
            <p>
              Kun vaihe 6 valmistuu, tulokset lasketaan paikallisesti ilman
              uutta verkkopyyntöä.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="statusCountGrid" aria-label="Tilojen yhteenveto">
            {visibleStatusOrder.map((status) => (
              <div key={status} className={`statusCount status-${status}`}>
                <strong>{summary.counts[status]}</strong>
                <span>{statusLabels[status]}</span>
              </div>
            ))}
          </div>
          <p className="calculationTimestamp">
            Laskentapäivä{" "}
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
        <span className="calculatedByCode">Sovelluskoodin laskema</span>
      </header>

      <ul className="statusReasons">
        {status.reason_codes.map((reason) => (
          <li key={reason}>{reasonLabels[reason]}</li>
        ))}
      </ul>

      <dl className="statusMetrics">
        <StatusMetric
          label="Käytetty matka"
          value={formatKilometres(status.distance_used_km)}
        />
        <StatusMetric
          label="Matkaa jäljellä"
          value={formatKilometres(status.distance_remaining_km)}
        />
        <StatusMetric
          label="Käytetty aika"
          value={formatMonths(status.months_used)}
        />
        <StatusMetric
          label="Aikaa jäljellä"
          value={formatMonths(status.months_remaining)}
        />
        <StatusMetric
          label="Arvioitu erääntymislukema"
          value={formatKilometres(status.due_odometer_km)}
        />
        <StatusMetric
          label="Arvioitu erääntymispäivä"
          value={
            status.due_date === null
              ? "Ei laskettavissa"
              : formatFinnishDate(status.due_date)
          }
        />
      </dl>

      <p className="statusEvidenceIds">
        Huoltomerkintä: {status.last_service_event_id ?? "ei valittua merkintää"}
        {" · "}
        Lähdeväite: {status.interval_claim_id ?? "ei valittua väitettä"}
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
    ? "Ei laskettavissa"
    : `${new Intl.NumberFormat("fi-FI").format(value)} km`;
}

function formatMonths(value: number | null): string {
  return value === null ? "Ei laskettavissa" : `${value} kk`;
}

function formatFinnishDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("fi-FI").format(
    new Date(Date.UTC(year!, month! - 1, day!)),
  );
}
