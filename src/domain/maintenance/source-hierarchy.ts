import type {
  ComponentResearch,
  IntervalClaim,
} from "@/domain/schemas/maintenance-research";
import type { ComponentCode } from "@/domain/schemas/service-history";

export const SOURCE_AUTHORITY_LABELS: Readonly<Record<number, string>> = {
  1: "Valmistajan virallinen dokumentaatio",
  2: "Valmistajan, maahantuojan tai jälleenmyyjän dokumentaatio",
  3: "Tekninen tietokanta tai korjausopas",
  4: "Osaluettelo soveltuvuustiedolla",
  5: "Korjaamon tekninen artikkeli",
  6: "Heikko täydentävä lähde",
};

export type TrustworthinessLevel = "high" | "medium" | "low";

export const TRUSTWORTHINESS_LABELS_FI: Readonly<
  Record<TrustworthinessLevel, string>
> = {
  high: "Korkea",
  medium: "Keskitaso",
  low: "Matala",
};

export interface TrustworthinessAssessment {
  level: TrustworthinessLevel;
  note_fi: string;
}

interface ComponentEvidence {
  component_code: ComponentCode;
  component_label: string;
  interval_claims: IntervalClaim[];
}

export function assessSourceTrustworthiness(
  authorityRank: number | null,
  compatibility: IntervalClaim["compatibility"],
): TrustworthinessAssessment {
  if (
    (authorityRank === null || authorityRank <= 2) &&
    (compatibility === "exact" || compatibility === "strong")
  ) {
    return {
      level: "high",
      note_fi:
        "Lähde on ensisijainen ja sen yhteensopivuus ajoneuvoversioon on vahva.",
    };
  }

  if (
    (authorityRank === null && compatibility === "partial") ||
    (authorityRank !== null &&
      authorityRank <= 4 &&
      (compatibility === "exact" ||
        compatibility === "strong" ||
        (authorityRank <= 2 && compatibility === "partial")))
  ) {
    return {
      level: "medium",
      note_fi:
        "Lähde on käyttökelpoinen, mutta lähdetaso tai ajoneuvoyhteensopivuus sisältää epävarmuutta.",
    };
  }

  return {
    level: "low",
    note_fi:
      "Lähdetaso tai ajoneuvoyhteensopivuus ei riitä yksin vahvaan huoltosuositukseen.",
  };
}

export function assessComponentTrustworthiness(
  component: ComponentResearch,
): TrustworthinessAssessment {
  if (component.resolution === "conflicting_sources") {
    return {
      level: "low",
      note_fi:
        "Huoltosuosituksen luotettavuus on matala, koska yhteensopivat lähteet ilmoittavat eri huoltovälejä. Jokaisen väitteen oma luotettavuus näytetään lähdetiedoissa.",
    };
  }

  if (component.resolution === "insufficient_evidence") {
    return {
      level: "low",
      note_fi:
        "Huoltosuositusta ei voitu varmistaa riittävästä ajoneuvoversioon sopivasta lähdenäytöstä.",
    };
  }

  const claim = component.interval_claims.find(
    (candidate) => candidate.claim_id === component.recommended_claim_id,
  );
  if (claim === undefined) {
    return {
      level: "low",
      note_fi: "Valittua huoltoväliväitettä ei löytynyt.",
    };
  }

  return assessSourceTrustworthiness(
    claim.authority_rank,
    claim.compatibility,
  );
}

export function resolveComponentEvidence(
  evidence: ComponentEvidence,
): ComponentResearch {
  const credibleClaims = evidence.interval_claims.filter(
    (claim) =>
      claim.authority_rank <= 4 &&
      (claim.compatibility === "exact" || claim.compatibility === "strong"),
  );

  if (credibleClaims.length === 0) {
    return {
      ...evidence,
      resolution: "insufficient_evidence",
      recommended_claim_id: null,
      conflict_summary: null,
    };
  }

  const bestRank = Math.min(
    ...credibleClaims.map((claim) => claim.authority_rank),
  );
  const bestClaims = credibleClaims.filter(
    (claim) => claim.authority_rank === bestRank,
  );
  const intervalSignatures = new Set(bestClaims.map(intervalSignature));

  if (intervalSignatures.size > 1) {
    return {
      ...evidence,
      resolution: "conflicting_sources",
      recommended_claim_id: null,
      conflict_summary:
        "Parhaan lähdetason kesken on ristiriitaisia huoltovälejä. Väliä ei valittu automaattisesti.",
    };
  }

  return {
    ...evidence,
    resolution: "resolved",
    recommended_claim_id: bestClaims[0]?.claim_id ?? null,
    conflict_summary: null,
  };
}

function intervalSignature(claim: IntervalClaim): string {
  return [
    claim.interval_km ?? "none",
    claim.interval_months ?? "none",
    claim.whichever_first,
  ].join(":");
}
