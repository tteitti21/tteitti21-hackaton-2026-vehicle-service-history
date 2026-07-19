import type { VehicleResolution } from "@/domain/schemas/vehicle-resolution";
import { vehicleResolutionSchema } from "@/domain/schemas/vehicle-resolution";
import type { VehicleInput } from "@/domain/vehicle/vehicle-input";

export interface VehicleResolutionProvider {
  resolve(vehicle: VehicleInput, signal: AbortSignal): Promise<unknown>;
}

export class VehicleResolutionOutputValidationError extends Error {
  constructor() {
    super("The vehicle-resolution provider returned invalid structured output.");
    this.name = "VehicleResolutionOutputValidationError";
  }
}

export async function resolveVehicle(
  provider: VehicleResolutionProvider,
  vehicle: VehicleInput,
  signal: AbortSignal,
): Promise<VehicleResolution> {
  const result = vehicleResolutionSchema.safeParse(
    await provider.resolve(vehicle, signal),
  );

  if (!result.success || !hasConsistentSources(result.data)) {
    throw new VehicleResolutionOutputValidationError();
  }

  return result.data;
}

function hasConsistentSources(resolution: VehicleResolution): boolean {
  const sourceUrls = new Set(resolution.sources.map((source) => source.url));
  const candidateIds = new Set<string>();

  if (sourceUrls.size !== resolution.sources.length) {
    return false;
  }

  for (const candidate of resolution.candidates) {
    if (candidateIds.has(candidate.candidate_id)) {
      return false;
    }
    candidateIds.add(candidate.candidate_id);

    const candidateSourceUrls = new Set<string>();
    for (const source of candidate.sources) {
      if (
        !sourceUrls.has(source.url) ||
        candidateSourceUrls.has(source.url)
      ) {
        return false;
      }
      candidateSourceUrls.add(source.url);
    }
  }

  return true;
}
