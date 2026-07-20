import type {
  ComponentResearch,
  IntervalClaim,
} from "@/domain/schemas/maintenance-research";
import type { ComponentCode } from "@/domain/schemas/service-history";

export const SOURCE_AUTHORITY_LABELS: Readonly<Record<number, string>> = {
  1: "Official manufacturer documentation",
  2: "Manufacturer, importer, or dealer documentation",
  3: "Technical database or repair guide",
  4: "Parts catalogue with compatibility information",
  5: "Workshop technical article",
  6: "Weak supplementary source",
};

export type TrustworthinessLevel = "high" | "medium" | "low";

export const TRUSTWORTHINESS_LABELS_FI: Readonly<
  Record<TrustworthinessLevel, string>
> = {
  high: "High",
  medium: "Medium",
  low: "Low",
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
        "The source is primary and has strong compatibility with the vehicle variant.",
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
        "The source is usable, but its source tier or vehicle compatibility contains uncertainty.",
    };
  }

  return {
    level: "low",
    note_fi:
      "The source tier or vehicle compatibility is not sufficient on its own for a strong maintenance recommendation.",
  };
}

export function assessComponentTrustworthiness(
  component: ComponentResearch,
): TrustworthinessAssessment {
  if (component.resolution === "conflicting_sources") {
    return {
      level: "low",
      note_fi:
        "The maintenance recommendation has low trustworthiness because compatible sources report different maintenance intervals. Each claim's trustworthiness is shown in the source details.",
    };
  }

  if (component.resolution === "insufficient_evidence") {
    return {
      level: "low",
      note_fi:
        "The maintenance recommendation could not be verified from sufficient source evidence compatible with the vehicle variant.",
    };
  }

  const claim = component.interval_claims.find(
    (candidate) => candidate.claim_id === component.recommended_claim_id,
  );
  if (claim === undefined) {
    return {
      level: "low",
      note_fi: "The selected maintenance interval claim was not found.",
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
        "The best source tier contains conflicting maintenance intervals. No interval was selected automatically.",
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
