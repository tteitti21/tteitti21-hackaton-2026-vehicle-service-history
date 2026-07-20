import type {
  MaintenanceResearch,
} from "@/domain/schemas/maintenance-research";
import type {
  ComponentCode,
  ServiceHistory,
} from "@/domain/schemas/service-history";
import { getComponentLabel } from "@/domain/service-events/component-taxonomy";
import type { VehicleInput } from "@/domain/vehicle/vehicle-input";

export interface ResearchComponent {
  component_code: ComponentCode;
  component_label: string;
}

const COMBUSTION_COMPONENTS: readonly ComponentCode[] = [
  "engine_oil",
  "oil_filter",
  "air_filter",
  "fuel_filter",
  "timing_belt",
  "timing_chain",
  "water_pump",
];

const COMMON_COMPONENTS: readonly ComponentCode[] = [
  "cabin_filter",
  "brake_fluid",
  "coolant",
  "brakes",
  "suspension",
  "battery",
  "tires",
  "inspection",
];

const AUTOMATIC_TRANSMISSION_TYPES = new Set([
  "automatic",
  "cvt",
  "dual_clutch",
  "automated_manual",
  "other",
]);

const COMBUSTION_FUEL_TYPES = new Set([
  "petrol",
  "diesel",
  "hybrid",
  "plug_in_hybrid",
  "lpg",
  "cng",
  "other",
]);

const SPARK_IGNITION_FUEL_TYPES = new Set([
  "petrol",
  "hybrid",
  "plug_in_hybrid",
  "lpg",
  "cng",
  "other",
]);

const LEGACY_COMPLETE_COMPONENTS: readonly ComponentCode[] = [
  ...COMBUSTION_COMPONENTS,
  "spark_plugs",
  "transmission_fluid",
  "transmission_filter",
  ...COMMON_COMPONENTS,
];

export function deriveResearchComponents(
  history: ServiceHistory,
  vehicle?: Pick<VehicleInput, "fuelType" | "transmissionType">,
): ResearchComponent[] {
  const labels = new Map<ComponentCode, string>(
    deriveStandardComponentCodes(vehicle).map((code) => [
      code,
      getPowertrainComponentLabel(code, vehicle),
    ]),
  );

  for (const event of history.events) {
    for (const action of event.actions) {
      if (!labels.has(action.component_code)) {
        labels.set(
          action.component_code,
          action.component_label.trim() ||
            getComponentLabel(action.component_code),
        );
      }
    }
  }

  return [...labels].map(([component_code, component_label]) => ({
    component_code,
    component_label,
  }));
}

export function ensureMaintenanceResearchCoverage(
  research: MaintenanceResearch,
  history: ServiceHistory,
  vehicle: Pick<VehicleInput, "fuelType" | "transmissionType">,
): MaintenanceResearch {
  const required = deriveResearchComponents(history, vehicle);
  const existingByCode = new Map(
    research.components.map((component) => [
      component.component_code,
      component,
    ]),
  );
  const requiredCodes = new Set(
    required.map((component) => component.component_code),
  );
  const addedLabels: string[] = [];
  const components = required.map((component) => {
    const existing = existingByCode.get(component.component_code);
    if (existing !== undefined) {
      return existing;
    }

    addedLabels.push(component.component_label);
    return {
      ...component,
      resolution: "insufficient_evidence" as const,
      interval_claims: [],
      recommended_claim_id: null,
      conflict_summary: null,
    };
  });

  for (const component of research.components) {
    if (!requiredCodes.has(component.component_code)) {
      components.push(component);
    }
  }

  if (addedLabels.length === 0) {
    return research;
  }

  return {
    ...research,
    components,
    global_warnings: [
      ...research.global_warnings,
      `${addedLabels.length} items were added to the vehicle's standard component inventory without a verified maintenance interval: ${addedLabels.join(", ")}.`,
    ],
  };
}

function deriveStandardComponentCodes(
  vehicle:
    | Pick<VehicleInput, "fuelType" | "transmissionType">
    | undefined,
): ComponentCode[] {
  if (vehicle === undefined) {
    return [...LEGACY_COMPLETE_COMPONENTS];
  }

  const fuelType = vehicle.fuelType;
  const transmissionType = vehicle.transmissionType;
  const combustionPowertrain =
    fuelType === undefined || COMBUSTION_FUEL_TYPES.has(fuelType);
  const sparkIgnition =
    fuelType === undefined || SPARK_IGNITION_FUEL_TYPES.has(fuelType);
  const automaticTransmission =
    transmissionType === undefined ||
    AUTOMATIC_TRANSMISSION_TYPES.has(transmissionType);

  return [
    ...(combustionPowertrain
      ? ([
          "engine_oil",
          "oil_filter",
        ] satisfies ComponentCode[])
      : []),
    "transmission_fluid",
    ...(combustionPowertrain
      ? ([
          "timing_belt",
          "timing_chain",
          "brake_fluid",
          "fuel_filter",
          "air_filter",
        ] satisfies ComponentCode[])
      : (["brake_fluid"] satisfies ComponentCode[])),
    "cabin_filter",
    "coolant",
    ...(sparkIgnition ? (["spark_plugs"] satisfies ComponentCode[]) : []),
    ...(combustionPowertrain ? (["water_pump"] satisfies ComponentCode[]) : []),
    ...(automaticTransmission
      ? (["transmission_filter"] satisfies ComponentCode[])
      : []),
    "brakes",
    "suspension",
    "battery",
    "tires",
    "inspection",
  ];
}

function getPowertrainComponentLabel(
  code: ComponentCode,
  vehicle:
    | Pick<VehicleInput, "fuelType" | "transmissionType">
    | undefined,
): string {
  if (
    vehicle?.transmissionType !== undefined &&
    AUTOMATIC_TRANSMISSION_TYPES.has(vehicle.transmissionType)
  ) {
    if (code === "transmission_fluid") {
      return "Automatic transmission fluid";
    }
    if (code === "transmission_filter") {
      return "Automatic transmission filter";
    }
  }

  return getComponentLabel(code);
}
