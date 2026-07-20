"use client";

import { useState } from "react";

import { useAnalysisSession } from "@/components/session/analysis-session-provider";
import type {
  VehicleCandidate,
  VehicleResolution,
} from "@/domain/schemas/vehicle-resolution";
import { vehicleResolutionSchema } from "@/domain/schemas/vehicle-resolution";
import type { VehicleVariant } from "@/domain/schemas/maintenance-research";
import { readSafeApiError } from "@/lib/http/safe-client-error";

const compatibilityLabels: Record<
  VehicleCandidate["compatibility"],
  string
> = {
  exact: "Exact match",
  strong: "Strong match",
  partial: "Partial match",
  weak: "Weak match",
  unknown: "Compatibility unknown",
};

const vehicleResolutionErrorMessages = {
  forbidden: "The vehicle search request was blocked. Refresh the page and try again.",
  rate_limited:
    "Too many vehicle searches have been made. Wait a moment and try again.",
  provider_timeout:
    "Vehicle-variant web search timed out. You can try again.",
  invalid_provider_output:
    "Candidates or sources returned by vehicle search could not be verified.",
  provider_error:
    "Vehicle-variant web search failed at the provider.",
  service_unavailable:
    "Vehicle-variant web search is currently unavailable.",
  payload_too_large: "The vehicle details request exceeds the allowed size limit.",
  unsupported_media_type: "Vehicle details must be submitted as JSON.",
  invalid_request: "Vehicle details could not be processed.",
} as const;

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
        failVehicleResolution(
          readSafeApiError(
            payload,
            vehicleResolutionErrorMessages,
            "Vehicle variants could not be retrieved. Try again.",
          ),
        );
        return;
      }

      const resolution = vehicleResolutionSchema.safeParse(payload);
      if (!resolution.success) {
        failVehicleResolution(
          "The vehicle search response could not be verified safely.",
        );
        return;
      }

      completeVehicleResolution(resolution.data);
    } catch {
      failVehicleResolution(
        "Vehicle search could not be reached. Check your network connection and try again.",
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
          <p className="sectionLabel">Phase 5 / Vehicle variant verification</p>
          <h2 id="vehicle-resolution-heading">
            Narrow down the exact vehicle variant using sources.
          </h2>
        </div>
        <div className="webSearchNotice">
          <strong>Web search starts only from the button</strong>
          <p>
            Confirmed variant details are sent to OpenAI for web search. The
            odometer reading and images are not sent to this search. Search
            results are not stored in the application database.
          </p>
        </div>
      </div>

      {!prerequisitesMet ? (
        <div className="emptyResolutionState">
          <span aria-hidden="true">05</span>
          <div>
            <strong>Vehicle search is waiting for confirmation of earlier phases.</strong>
            <p>
              {state.confirmedVehicle === null
                ? "Confirm the vehicle details first."
                : "Confirm the edited service history before searching for a vehicle variant."}
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
                ? "Searching for vehicle variants…"
                : state.vehicleResolution === null
                  ? "Search the web for vehicle variants"
                  : "Search for vehicle variants again"}
            </button>
            <p>
              A candidate is never selected automatically, even for a strong match.
            </p>
          </div>

          {state.vehicleResolutionStatus === "submitting" ? (
            <div className="resolutionProgress" role="status">
              <span aria-hidden="true" />
              <div>
                <strong>Searching for distinguishing variant details and sources</strong>
                <p>Web search may take a few minutes.</p>
              </div>
            </div>
          ) : null}

          {state.vehicleResolutionStatus === "error" ? (
            <div className="resolutionError" role="alert">
              <strong>Vehicle variants could not be retrieved.</strong>
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
            ? "No verifiable candidate was found."
            : `${resolution.candidates.length} ${
                resolution.candidates.length === 1
                  ? "candidate found"
                  : "candidates found"
              }`}
        </strong>
        <p>
          Review the engine, transmission, model year, market, and source
          compatibility before making a selection.
        </p>
      </div>

      {resolution.warnings.length > 0 ? (
        <div className="resolutionWarnings" role="status">
          <strong>Search uncertainties</strong>
          <ul>
            {resolution.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {resolution.candidates.length > 0 ? (
        <fieldset className="candidateList">
          <legend>Select a candidate only after reviewing the sources</legend>
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
          <strong>An exact variant was not inferred from incomplete evidence.</strong>
          <p>
            Add an engine or transmission code, chassis code, or more precise
            market to the form, for example, and start the search again.
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
          Confirm selected vehicle variant
        </button>
        <button className="secondaryButton" type="button" onClick={onReject}>
          None of these matches the vehicle
        </button>
      </div>

      {confirmedVariant !== null ? (
        <div className="confirmedVariant" role="status">
          <strong>Vehicle variant confirmed for later research</strong>
          <p>{formatVariantTitle(confirmedVariant)}</p>
          {confirmedVariant.unresolved_fields.length > 0 ? (
            <p>
              Unresolved details: {confirmedVariant.unresolved_fields.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {rejected ? (
        <div className="rejectedCandidates" role="status">
          <strong>Candidates rejected.</strong>
          <p>
            Correct or complete the vehicle details. Later maintenance interval
            research will not start without an explicitly confirmed variant.
          </p>
        </div>
      ) : null}

      <details className="searchedSources">
        <summary>
          All sources used in web search ({resolution.sources.length})
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
          <p>The search returned no source list that could be preserved.</p>
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
          <p>Confidence {formatConfidence(candidate.variant.confidence)}</p>
        </div>
      </label>

      <p className="compatibilityExplanation">
        {candidate.compatibility_explanation}
      </p>

      <div className="candidateEvidenceGrid">
        <EvidenceList
          title="Matching details"
          values={candidate.matching_fields}
          emptyText="No separately verified matches"
        />
        <EvidenceList
          title="Conflicts"
          values={candidate.conflicting_fields}
          emptyText="No detected conflicts"
        />
        <EvidenceList
          title="Missing distinguishing details"
          values={candidate.missing_distinguishing_fields}
          emptyText="No reported distinguishing gaps"
        />
      </div>

      <div className="candidateSources">
        <strong>Sources and evidence supporting the candidate</strong>
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
