import {
  maintenanceResearchSchema,
  type MaintenanceResearch,
} from "@/domain/schemas/maintenance-research";
import type { MaintenanceResearchRequest } from "@/lib/validation/maintenance-research-request";

export interface MaintenanceResearchProvider {
  research(
    request: MaintenanceResearchRequest,
    signal: AbortSignal,
  ): Promise<unknown>;
}

export class MaintenanceResearchOutputValidationError extends Error {
  constructor() {
    super("The maintenance research provider returned invalid output.");
    this.name = "MaintenanceResearchOutputValidationError";
  }
}

export async function researchMaintenance(
  provider: MaintenanceResearchProvider,
  request: MaintenanceResearchRequest,
  signal: AbortSignal,
): Promise<MaintenanceResearch> {
  const parsed = maintenanceResearchSchema.safeParse(
    await provider.research(request, signal),
  );

  if (!parsed.success || !hasConsistentResult(parsed.data, request)) {
    throw new MaintenanceResearchOutputValidationError();
  }

  return parsed.data;
}

function hasConsistentResult(
  result: MaintenanceResearch,
  request: MaintenanceResearchRequest,
): boolean {
  if (
    JSON.stringify(result.vehicle_variant) !==
      JSON.stringify(request.vehicle_variant) ||
    result.components.length !== request.components.length
  ) {
    return false;
  }

  const claimIds = new Set<string>();
  for (let index = 0; index < request.components.length; index += 1) {
    const requested = request.components[index];
    const component = result.components[index];
    if (
      component === undefined ||
      requested === undefined ||
      component.component_code !== requested.component_code
    ) {
      return false;
    }

    const ids = new Set(component.interval_claims.map((claim) => claim.claim_id));
    if (
      ids.size !== component.interval_claims.length ||
      component.interval_claims.some((claim) => claimIds.has(claim.claim_id))
    ) {
      return false;
    }
    for (const id of ids) {
      claimIds.add(id);
    }

    if (
      component.resolution === "resolved" &&
      (component.recommended_claim_id === null ||
        !ids.has(component.recommended_claim_id) ||
        component.conflict_summary !== null)
    ) {
      return false;
    }
    if (
      component.resolution !== "resolved" &&
      component.recommended_claim_id !== null
    ) {
      return false;
    }
    if (
      component.resolution === "conflicting_sources" &&
      component.conflict_summary === null
    ) {
      return false;
    }
    if (
      component.resolution === "insufficient_evidence" &&
      component.conflict_summary !== null
    ) {
      return false;
    }
  }

  return true;
}
