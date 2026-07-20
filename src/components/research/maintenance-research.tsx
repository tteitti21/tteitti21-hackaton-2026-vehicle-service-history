"use client";

import { useAnalysisSession } from "@/components/session/analysis-session-provider";
import { deriveResearchComponents } from "@/domain/maintenance/research-components";
import {
  assessSourceTrustworthiness,
  SOURCE_AUTHORITY_LABELS,
  TRUSTWORTHINESS_LABELS_FI,
} from "@/domain/maintenance/source-hierarchy";
import {
  maintenanceResearchSchema,
  type ComponentResearch,
  type IntervalClaim,
} from "@/domain/schemas/maintenance-research";
import { readSafeApiError } from "@/lib/http/safe-client-error";

const resolutionLabels: Record<ComponentResearch["resolution"], string> = {
  resolved: "Source found",
  conflicting_sources: "Conflicting sources",
  insufficient_evidence: "Insufficient evidence",
};

const compatibilityLabels: Record<IntervalClaim["compatibility"], string> = {
  exact: "Exact compatibility",
  strong: "Strong compatibility",
  partial: "Partial compatibility",
  weak: "Weak compatibility",
  unknown: "Compatibility unknown",
};

const maintenanceResearchErrorMessages = {
  forbidden: "The research request was blocked. Refresh the page and try again.",
  rate_limited:
    "Too many maintenance interval research requests have been made. Wait a moment and try again.",
  provider_timeout:
    "Maintenance interval web research timed out. You can try again.",
  invalid_provider_output:
    "The research result or its sources could not be verified safely.",
  provider_error:
    "Maintenance interval web research failed at the provider.",
  service_unavailable:
    "Maintenance interval web research is currently unavailable.",
  payload_too_large: "The research request exceeds the allowed size limit.",
  unsupported_media_type: "The research request must be submitted as JSON.",
  invalid_request: "The research request could not be processed.",
} as const;

export function MaintenanceResearchPanel() {
  const {
    state,
    beginMaintenanceResearch,
    completeMaintenanceResearch,
    failMaintenanceResearch,
  } = useAnalysisSession();
  const prerequisitesMet =
    state.confirmedVehicle !== null &&
    state.serviceHistory !== null &&
    state.serviceHistoryReviewConfirmed &&
    state.confirmedVehicleVariant !== null;

  const startResearch = async () => {
    if (
      state.confirmedVehicle === null ||
      state.serviceHistory === null ||
      !state.serviceHistoryReviewConfirmed ||
      state.confirmedVehicleVariant === null
    ) {
      return;
    }

    const request = {
      vehicle_variant: state.confirmedVehicleVariant,
      current_odometer_km: state.confirmedVehicle.currentOdometerKm,
      country: state.confirmedVehicle.country ?? null,
      market:
        state.confirmedVehicleVariant.market ??
        state.confirmedVehicle.market ??
        null,
      components: deriveResearchComponents(
        state.serviceHistory,
        state.confirmedVehicle,
      ),
    };

    beginMaintenanceResearch();
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        cache: "no-store",
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        failMaintenanceResearch(
          readSafeApiError(
            payload,
            maintenanceResearchErrorMessages,
            "Maintenance interval research failed. Try again.",
          ),
        );
        return;
      }

      const parsed = maintenanceResearchSchema.safeParse(payload);
      if (!parsed.success) {
        failMaintenanceResearch(
          "The research response could not be verified safely.",
        );
        return;
      }
      completeMaintenanceResearch(parsed.data);
    } catch {
      failMaintenanceResearch(
        "Maintenance interval research could not be reached. Check your network connection and try again.",
      );
    }
  };

  return (
    <section
      className="maintenanceResearchSection"
      aria-labelledby="maintenance-research-heading"
    >
      <div className="maintenanceResearchHeading">
        <div>
          <p className="sectionLabel">Phase 6 / Maintenance interval research</p>
          <h2 id="maintenance-research-heading">
            Review maintenance intervals one source at a time.
          </h2>
        </div>
        <div className="webSearchNotice">
          <strong>Two-stage, source-backed search</strong>
          <p>
            Only the confirmed vehicle variant, country, market, and component
            categories being researched are sent to OpenAI. Images, service
            history, and the odometer reading are not sent to the research
            model.
          </p>
        </div>
      </div>

      {!prerequisitesMet ? (
        <div className="emptyResolutionState">
          <span aria-hidden="true">06</span>
          <div>
            <strong>Maintenance interval research is waiting for a confirmed variant.</strong>
            <p>
              First confirm the vehicle details, reviewed service history, and
              one vehicle variant.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="resolutionSearchActions">
            <button
              className="primaryButton"
              type="button"
              disabled={state.maintenanceResearchStatus === "submitting"}
              onClick={startResearch}
            >
              {state.maintenanceResearchStatus === "submitting"
                ? "Researching maintenance intervals…"
                : state.maintenanceResearch === null
                  ? "Research maintenance intervals online"
                  : "Research maintenance intervals again"}
            </button>
            <p>
              The application does not guess a missing interval or calculate
              maintenance timing yet.
            </p>
          </div>

          {state.maintenanceResearchStatus === "submitting" ? (
            <div className="resolutionProgress" role="status">
              <span aria-hidden="true" />
              <div>
                <strong>Retrieving and normalizing source evidence</strong>
                <p>Two-stage web research may take a few minutes.</p>
              </div>
            </div>
          ) : null}

          {state.maintenanceResearchStatus === "error" ? (
            <div className="resolutionError" role="alert">
              <strong>Maintenance interval research failed.</strong>
              <p>{state.maintenanceResearchError}</p>
            </div>
          ) : null}

          {state.maintenanceResearch !== null &&
          state.maintenanceResearchStatus !== "submitting" ? (
            <ResearchResults
              components={state.maintenanceResearch.components}
              warnings={state.maintenanceResearch.global_warnings}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

function ResearchResults({
  components,
  warnings,
}: Readonly<{
  components: ComponentResearch[];
  warnings: string[];
}>) {
  const counts = components.reduce(
    (result, component) => {
      result[component.resolution] += 1;
      return result;
    },
    {
      resolved: 0,
      conflicting_sources: 0,
      insufficient_evidence: 0,
    },
  );

  return (
    <div className="researchResults">
      <div className="researchSummary" role="status">
        <div>
          <strong>{counts.resolved}</strong>
          <span>verified</span>
        </div>
        <div>
          <strong>{counts.conflicting_sources}</strong>
          <span>conflicts</span>
        </div>
        <div>
          <strong>{counts.insufficient_evidence}</strong>
          <span>without sufficient evidence</span>
        </div>
      </div>

      {warnings.length > 0 ? (
        <details className="researchWarnings">
          <summary>Research warnings ({warnings.length})</summary>
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="componentResearchList">
        {components.map((component) => (
          <ComponentResearchCard
            key={component.component_code}
            component={component}
          />
        ))}
      </div>
    </div>
  );
}

function ComponentResearchCard({
  component,
}: Readonly<{ component: ComponentResearch }>) {
  return (
    <article className="componentResearchCard">
      <header>
        <div>
          <span
            className={`researchResolution researchResolution-${component.resolution}`}
          >
            {resolutionLabels[component.resolution]}
          </span>
          <h3>{component.component_label}</h3>
        </div>
        <code>{component.component_code}</code>
      </header>

      {component.resolution === "insufficient_evidence" ? (
        <p className="insufficientEvidence">
          The exact replacement interval could not be verified from
          sufficiently reliable sources compatible with this vehicle variant.
        </p>
      ) : null}

      {component.conflict_summary ? (
        <p className="conflictSummary">{component.conflict_summary}</p>
      ) : null}

      {component.interval_claims.length > 0 ? (
        <ul className="intervalClaimList">
          {component.interval_claims.map((claim) => (
            <IntervalClaimCard
              key={claim.claim_id}
              claim={claim}
              recommended={component.recommended_claim_id === claim.claim_id}
            />
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function IntervalClaimCard({
  claim,
  recommended,
}: Readonly<{ claim: IntervalClaim; recommended: boolean }>) {
  const trustworthiness = assessSourceTrustworthiness(
    claim.authority_rank,
    claim.compatibility,
  );

  return (
    <li className={recommended ? "recommendedClaim" : undefined}>
      <div className="claimHeading">
        <strong>{formatInterval(claim)}</strong>
        {recommended ? <span>Best evidence selected by the application</span> : null}
      </div>
      {claim.conditions ? <p>{claim.conditions}</p> : null}
      <dl>
        <div>
          <dt>Original value</dt>
          <dd>{formatOriginalValue(claim)}</dd>
        </div>
        <div>
          <dt>Source tier</dt>
          <dd>
            {claim.authority_rank}.{" "}
            {SOURCE_AUTHORITY_LABELS[claim.authority_rank]}
          </dd>
        </div>
        <div>
          <dt>Compatibility</dt>
          <dd>{compatibilityLabels[claim.compatibility]}</dd>
        </div>
        <div>
          <dt>Trustworthiness level</dt>
          <dd>
            {TRUSTWORTHINESS_LABELS_FI[trustworthiness.level]} (
            {trustworthiness.level})
          </dd>
        </div>
      </dl>
      <p className="compatibilityNotes">{claim.compatibility_notes}</p>
      <p className="compatibilityNotes">{trustworthiness.note_fi}</p>
      <div className="claimSource">
        <a href={claim.source.url} target="_blank" rel="noreferrer">
          {claim.source.title}
        </a>
        {claim.source.publisher ? <span>{claim.source.publisher}</span> : null}
        <p>{claim.source.evidence}</p>
      </div>
    </li>
  );
}

function formatInterval(claim: IntervalClaim): string {
  const values = [
    claim.interval_km === null
      ? null
      : `${new Intl.NumberFormat("fi-FI").format(claim.interval_km)} km`,
    claim.interval_months === null
      ? null
      : `${claim.interval_months} months`,
  ].filter((value): value is string => value !== null);

  return values.join(claim.whichever_first ? " or " : " + ");
}

function formatOriginalValue(claim: IntervalClaim): string {
  if (claim.original_unit === "mixed") {
    return "Combined distance and time interval; original values are in the source evidence";
  }
  if (claim.original_value === null || claim.original_unit === null) {
    return "Not reported";
  }
  return `${claim.original_value} ${claim.original_unit}`;
}
