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

interface ComponentEvidence {
  component_code: ComponentCode;
  component_label: string;
  interval_claims: IntervalClaim[];
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
