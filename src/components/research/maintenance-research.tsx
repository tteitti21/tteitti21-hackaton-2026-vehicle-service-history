"use client";

import { useAnalysisSession } from "@/components/session/analysis-session-provider";
import { deriveResearchComponents } from "@/domain/maintenance/research-components";
import { SOURCE_AUTHORITY_LABELS } from "@/domain/maintenance/source-hierarchy";
import {
  maintenanceResearchSchema,
  type ComponentResearch,
  type IntervalClaim,
} from "@/domain/schemas/maintenance-research";
import { readSafeApiError } from "@/lib/http/safe-client-error";

const resolutionLabels: Record<ComponentResearch["resolution"], string> = {
  resolved: "Lähde löytyi",
  conflicting_sources: "Lähteissä ristiriita",
  insufficient_evidence: "Ei riittävää tietoa",
};

const compatibilityLabels: Record<IntervalClaim["compatibility"], string> = {
  exact: "Tarkka yhteensopivuus",
  strong: "Vahva yhteensopivuus",
  partial: "Osittainen yhteensopivuus",
  weak: "Heikko yhteensopivuus",
  unknown: "Yhteensopivuus tuntematon",
};

const maintenanceResearchErrorMessages = {
  forbidden: "Tutkimuspyyntö estettiin. Päivitä sivu ja yritä uudelleen.",
  rate_limited:
    "Huoltovälitutkimuksia on tehty liian monta. Odota hetki ja yritä uudelleen.",
  provider_timeout:
    "Huoltovälien verkkotutkimus aikakatkaistiin. Voit yrittää uudelleen.",
  invalid_provider_output:
    "Tutkimustulosta tai sen lähteitä ei voitu varmistaa turvallisesti.",
  provider_error:
    "Huoltovälien verkkotutkimus epäonnistui palveluntarjoajalla.",
  service_unavailable:
    "Huoltovälien verkkotutkimus ei ole tällä hetkellä käytettävissä.",
  payload_too_large: "Tutkimuspyyntö ylittää sallitun kokorajan.",
  unsupported_media_type: "Tutkimuspyyntö on lähetettävä JSON-muodossa.",
  invalid_request: "Tutkimuspyyntöä ei voitu käsitellä.",
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
      components: deriveResearchComponents(state.serviceHistory),
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
            "Huoltovälitutkimus epäonnistui. Yritä uudelleen.",
          ),
        );
        return;
      }

      const parsed = maintenanceResearchSchema.safeParse(payload);
      if (!parsed.success) {
        failMaintenanceResearch(
          "Tutkimuksen vastausta ei voitu varmistaa turvallisesti.",
        );
        return;
      }
      completeMaintenanceResearch(parsed.data);
    } catch {
      failMaintenanceResearch(
        "Huoltovälitutkimukseen ei saatu yhteyttä. Tarkista verkkoyhteys ja yritä uudelleen.",
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
          <p className="sectionLabel">Vaihe 6 / Huoltovälien tutkimus</p>
          <h2 id="maintenance-research-heading">
            Tarkista huoltovälit lähde kerrallaan.
          </h2>
        </div>
        <div className="webSearchNotice">
          <strong>Kaksivaiheinen, lähteisiin sidottu haku</strong>
          <p>
            OpenAI:lle välitetään vain vahvistettu ajoneuvoversio, maa ja
            markkina sekä tutkittavat komponenttiluokat. Kuvia,
            huoltohistoriaa tai matkamittarilukemaa ei välitetä tutkimusmallille.
          </p>
        </div>
      </div>

      {!prerequisitesMet ? (
        <div className="emptyResolutionState">
          <span aria-hidden="true">06</span>
          <div>
            <strong>Huoltovälitutkimus odottaa vahvistettua versiota.</strong>
            <p>
              Vahvista ensin ajoneuvotiedot, tarkistettu huoltohistoria ja yksi
              ajoneuvoversio.
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
                ? "Tutkitaan huoltovälejä…"
                : state.maintenanceResearch === null
                  ? "Tutki huoltovälit verkosta"
                  : "Tutki huoltovälit uudelleen"}
            </button>
            <p>
              Sovellus ei arvaa puuttuvaa väliä eikä laske vielä huollon
              ajankohtaisuutta.
            </p>
          </div>

          {state.maintenanceResearchStatus === "submitting" ? (
            <div className="resolutionProgress" role="status">
              <span aria-hidden="true" />
              <div>
                <strong>Haetaan ja normalisoidaan lähdenäyttöä</strong>
                <p>Kaksivaiheinen verkkotutkimus voi kestää muutaman minuutin.</p>
              </div>
            </div>
          ) : null}

          {state.maintenanceResearchStatus === "error" ? (
            <div className="resolutionError" role="alert">
              <strong>Huoltovälitutkimus epäonnistui.</strong>
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
          <span>varmennettua</span>
        </div>
        <div>
          <strong>{counts.conflicting_sources}</strong>
          <span>ristiriitaa</span>
        </div>
        <div>
          <strong>{counts.insufficient_evidence}</strong>
          <span>ilman riittävää näyttöä</span>
        </div>
      </div>

      {warnings.length > 0 ? (
        <details className="researchWarnings">
          <summary>Tutkimuksen varoitukset ({warnings.length})</summary>
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
          Tarkkaa vaihtoväliä ei voitu varmistaa riittävän luotettavista, tähän
          ajoneuvovarianttiin sopivista lähteistä.
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
  return (
    <li className={recommended ? "recommendedClaim" : undefined}>
      <div className="claimHeading">
        <strong>{formatInterval(claim)}</strong>
        {recommended ? <span>Sovelluksen valitsema paras näyttö</span> : null}
      </div>
      {claim.conditions ? <p>{claim.conditions}</p> : null}
      <dl>
        <div>
          <dt>Alkuperäinen arvo</dt>
          <dd>{formatOriginalValue(claim)}</dd>
        </div>
        <div>
          <dt>Lähdetaso</dt>
          <dd>
            {claim.authority_rank}.{" "}
            {SOURCE_AUTHORITY_LABELS[claim.authority_rank]}
          </dd>
        </div>
        <div>
          <dt>Yhteensopivuus</dt>
          <dd>{compatibilityLabels[claim.compatibility]}</dd>
        </div>
      </dl>
      <p className="compatibilityNotes">{claim.compatibility_notes}</p>
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
      : `${claim.interval_months} kk`,
  ].filter((value): value is string => value !== null);

  return values.join(claim.whichever_first ? " tai " : " + ");
}

function formatOriginalValue(claim: IntervalClaim): string {
  if (claim.original_unit === "mixed") {
    return "Yhdistetty etäisyys- ja aikaväli; alkuperäiset arvot lähdenäytössä";
  }
  if (claim.original_value === null || claim.original_unit === null) {
    return "Ei ilmoitettu";
  }
  return `${claim.original_value} ${claim.original_unit}`;
}
