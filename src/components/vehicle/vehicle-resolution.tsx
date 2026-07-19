"use client";

import { useState } from "react";

import { useAnalysisSession } from "@/components/session/analysis-session-provider";
import type {
  VehicleCandidate,
  VehicleResolution,
} from "@/domain/schemas/vehicle-resolution";
import { vehicleResolutionSchema } from "@/domain/schemas/vehicle-resolution";
import type { VehicleVariant } from "@/domain/schemas/maintenance-research";

const compatibilityLabels: Record<
  VehicleCandidate["compatibility"],
  string
> = {
  exact: "Tarkka osuma",
  strong: "Vahva osuma",
  partial: "Osittainen osuma",
  weak: "Heikko osuma",
  unknown: "Yhteensopivuus epäselvä",
};

export function VehicleResolutionPanel() {
  const {
    state,
    beginVehicleResolution,
    completeVehicleResolution,
    failVehicleResolution,
    confirmVehicleCandidate,
    rejectVehicleCandidates,
  } = useAnalysisSession();
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null,
  );

  const prerequisitesMet =
    state.confirmedVehicle !== null &&
    state.serviceHistoryReviewConfirmed;

  const startResolution = async () => {
    if (state.confirmedVehicle === null || !state.serviceHistoryReviewConfirmed) {
      return;
    }

    beginVehicleResolution();
    setSelectedCandidateId(null);

    try {
      const response = await fetch("/api/resolve-vehicle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(state.confirmedVehicle),
        cache: "no-store",
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        failVehicleResolution(readSafeError(payload));
        return;
      }

      const resolution = vehicleResolutionSchema.safeParse(payload);
      if (!resolution.success) {
        failVehicleResolution(
          "Ajoneuvohaun vastausta ei voitu varmistaa turvallisesti.",
        );
        return;
      }

      completeVehicleResolution(resolution.data);
    } catch {
      failVehicleResolution(
        "Ajoneuvohakuun ei saatu yhteyttä. Tarkista verkkoyhteys ja yritä uudelleen.",
      );
    }
  };

  return (
    <section
      className="vehicleResolutionSection"
      aria-labelledby="vehicle-resolution-heading"
    >
      <div className="vehicleResolutionHeading">
        <div>
          <p className="sectionLabel">Vaihe 5 / Ajoneuvoversion varmennus</p>
          <h2 id="vehicle-resolution-heading">
            Rajaa tarkka ajoneuvoversio lähteiden avulla.
          </h2>
        </div>
        <div className="webSearchNotice">
          <strong>Verkkohaku käynnistyy vain painikkeesta</strong>
          <p>
            Vahvistetut versiotiedot lähetetään OpenAI:lle verkkohakua varten.
            Matkamittarilukemaa tai kuvia ei välitetä tähän hakuun. Hakutulosta
            ei tallenneta sovelluksen tietokantaan.
          </p>
        </div>
      </div>

      {!prerequisitesMet ? (
        <div className="emptyResolutionState">
          <span aria-hidden="true">05</span>
          <div>
            <strong>Ajoneuvohaku odottaa aiempien vaiheiden vahvistusta.</strong>
            <p>
              {state.confirmedVehicle === null
                ? "Vahvista ensin ajoneuvotiedot."
                : "Vahvista muokattu huoltohistoria ennen ajoneuvoversion hakua."}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="resolutionSearchActions">
            <button
              className="primaryButton"
              type="button"
              disabled={state.vehicleResolutionStatus === "submitting"}
              onClick={startResolution}
            >
              {state.vehicleResolutionStatus === "submitting"
                ? "Haetaan ajoneuvoversioita…"
                : state.vehicleResolution === null
                  ? "Etsi ajoneuvoversiot verkosta"
                  : "Hae ajoneuvoversiot uudelleen"}
            </button>
            <p>
              Ehdokasta ei valita automaattisesti, vaikka osuma olisi vahva.
            </p>
          </div>

          {state.vehicleResolutionStatus === "submitting" ? (
            <div className="resolutionProgress" role="status">
              <span aria-hidden="true" />
              <div>
                <strong>Haetaan erottavia versiotietoja ja lähteitä</strong>
                <p>Verkkohaku voi kestää muutaman minuutin.</p>
              </div>
            </div>
          ) : null}

          {state.vehicleResolutionStatus === "error" ? (
            <div className="resolutionError" role="alert">
              <strong>Ajoneuvoversioita ei voitu hakea.</strong>
              <p>{state.vehicleResolutionError}</p>
            </div>
          ) : null}

          {state.vehicleResolution !== null &&
          state.vehicleResolutionStatus !== "submitting" ? (
            <ResolutionResults
              resolution={state.vehicleResolution}
              selectedCandidateId={selectedCandidateId}
              confirmedVariant={state.confirmedVehicleVariant}
              rejected={state.vehicleResolutionRejected}
              onSelect={setSelectedCandidateId}
              onConfirm={() => {
                if (selectedCandidateId !== null) {
                  confirmVehicleCandidate(selectedCandidateId);
                }
              }}
              onReject={() => {
                setSelectedCandidateId(null);
                rejectVehicleCandidates();
              }}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

function ResolutionResults({
  resolution,
  selectedCandidateId,
  confirmedVariant,
  rejected,
  onSelect,
  onConfirm,
  onReject,
}: Readonly<{
  resolution: VehicleResolution;
  selectedCandidateId: string | null;
  confirmedVariant: VehicleVariant | null;
  rejected: boolean;
  onSelect: (candidateId: string) => void;
  onConfirm: () => void;
  onReject: () => void;
}>) {
  return (
    <div className="resolutionResults">
      <div className="resolutionResultSummary" role="status">
        <strong>
          {resolution.candidates.length === 0
            ? "Varmennettavaa ehdokasta ei löytynyt."
            : `${resolution.candidates.length} ${
                resolution.candidates.length === 1
                  ? "ehdokas löytyi"
                  : "ehdokasta löytyi"
              }`}
        </strong>
        <p>
          Tarkista moottori, vaihteisto, mallivuosi, markkina ja lähteiden
          yhteensopivuus ennen valintaa.
        </p>
      </div>

      {resolution.warnings.length > 0 ? (
        <div className="resolutionWarnings" role="status">
          <strong>Haun epävarmuudet</strong>
          <ul>
            {resolution.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {resolution.candidates.length > 0 ? (
        <fieldset className="candidateList">
          <legend>Valitse ehdokas vasta tarkistettuasi lähteet</legend>
          {resolution.candidates.map((candidate) => (
            <CandidateCard
              key={candidate.candidate_id}
              candidate={candidate}
              selected={selectedCandidateId === candidate.candidate_id}
              onSelect={() => onSelect(candidate.candidate_id)}
            />
          ))}
        </fieldset>
      ) : (
        <div className="honestEmptyResult">
          <strong>Tarkkaa versiota ei päätelty puutteellisesta näytöstä.</strong>
          <p>
            Lisää lomakkeelle esimerkiksi moottori- tai vaihteistokoodi,
            alustakoodi tai tarkempi markkina-alue ja käynnistä haku uudelleen.
          </p>
        </div>
      )}

      <div className="candidateConfirmation">
        <button
          className="primaryButton"
          type="button"
          disabled={selectedCandidateId === null}
          onClick={onConfirm}
        >
          Vahvista valittu ajoneuvoversio
        </button>
        <button className="secondaryButton" type="button" onClick={onReject}>
          Mikään näistä ei vastaa ajoneuvoa
        </button>
      </div>

      {confirmedVariant !== null ? (
        <div className="confirmedVariant" role="status">
          <strong>Ajoneuvoversio vahvistettu myöhempää tutkimusta varten</strong>
          <p>{formatVariantTitle(confirmedVariant)}</p>
          {confirmedVariant.unresolved_fields.length > 0 ? (
            <p>
              Avoimet tiedot: {confirmedVariant.unresolved_fields.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {rejected ? (
        <div className="rejectedCandidates" role="status">
          <strong>Ehdokkaat hylättiin.</strong>
          <p>
            Korjaa tai täydennä ajoneuvotietoja. Myöhempää huoltovälitutkimusta
            ei käynnistetä ilman erikseen vahvistettua versiota.
          </p>
        </div>
      ) : null}

      <details className="searchedSources">
        <summary>
          Kaikki verkkohaussa käytetyt lähteet ({resolution.sources.length})
        </summary>
        {resolution.sources.length > 0 ? (
          <ul>
            {resolution.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
                {source.publisher ? <span>{source.publisher}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>Hausta ei saatu säilytettävää lähdeluetteloa.</p>
        )}
      </details>
    </div>
  );
}

function CandidateCard({
  candidate,
  selected,
  onSelect,
}: Readonly<{
  candidate: VehicleCandidate;
  selected: boolean;
  onSelect: () => void;
}>) {
  return (
    <article
      className={`candidateCard ${selected ? "candidateCardSelected" : ""}`}
    >
      <label className="candidateChoice">
        <input
          type="radio"
          name="vehicle-candidate"
          value={candidate.candidate_id}
          checked={selected}
          onChange={onSelect}
        />
        <div>
          <span
            className={`compatibilityBadge compatibility-${candidate.compatibility}`}
          >
            {compatibilityLabels[candidate.compatibility]}
          </span>
          <h3>{formatVariantTitle(candidate.variant)}</h3>
          <p>Luottamus {formatConfidence(candidate.variant.confidence)}</p>
        </div>
      </label>

      <p className="compatibilityExplanation">
        {candidate.compatibility_explanation}
      </p>

      <div className="candidateEvidenceGrid">
        <EvidenceList
          title="Täsmäävät tiedot"
          values={candidate.matching_fields}
          emptyText="Ei erikseen varmennettuja täsmäyksiä"
        />
        <EvidenceList
          title="Ristiriidat"
          values={candidate.conflicting_fields}
          emptyText="Ei havaittuja ristiriitoja"
        />
        <EvidenceList
          title="Puuttuvat erottavat tiedot"
          values={candidate.missing_distinguishing_fields}
          emptyText="Ei ilmoitettuja erottavia puutteita"
        />
      </div>

      <div className="candidateSources">
        <strong>Lähteet ja ehdokasta tukeva näyttö</strong>
        <ul>
          {candidate.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title}
              </a>
              {source.publisher ? <span>{source.publisher}</span> : null}
              <p>{source.evidence}</p>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function EvidenceList({
  title,
  values,
  emptyText,
}: Readonly<{ title: string; values: string[]; emptyText: string }>) {
  return (
    <div>
      <strong>{title}</strong>
      {values.length > 0 ? (
        <ul>
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </div>
  );
}

function formatVariantTitle(variant: VehicleVariant): string {
  return [
    variant.make,
    variant.model,
    variant.generation,
    variant.model_year,
    variant.engine,
    variant.transmission,
    variant.market,
  ]
    .filter(
      (value): value is string | number =>
        value !== null && value !== "",
    )
    .join(" · ");
}

function formatConfidence(value: number): string {
  return new Intl.NumberFormat("fi-FI", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}

function readSafeError(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return "Ajoneuvoversioita ei voitu hakea. Yritä uudelleen.";
}
