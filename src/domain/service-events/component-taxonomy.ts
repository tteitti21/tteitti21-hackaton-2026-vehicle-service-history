import type {
  ComponentCode,
  ServiceAction,
} from "@/domain/schemas/service-history";

export interface ComponentTaxonomyEntry {
  code: ComponentCode;
  label: string;
  aliases: readonly string[];
}

export const COMPONENT_TAXONOMY: readonly ComponentTaxonomyEntry[] = [
  {
    code: "engine_oil",
    label: "Engine oil",
    aliases: ["engine lubricant", "engine oil", "motor oil"],
  },
  {
    code: "oil_filter",
    label: "Oil filter",
    aliases: ["engine oil filter", "oil filter"],
  },
  {
    code: "air_filter",
    label: "Engine air filter",
    aliases: ["engine air filter", "air filter"],
  },
  {
    code: "cabin_filter",
    label: "Cabin air filter",
    aliases: [
      "interior air filter",
      "cabin air filter",
      "cabin filter",
      "pollen filter",
    ],
  },
  {
    code: "fuel_filter",
    label: "Fuel filter",
    aliases: ["fuel filter", "diesel filter", "fuel strainer"],
  },
  {
    code: "spark_plugs",
    label: "Spark plugs",
    aliases: ["ignition plugs", "ignition plug", "spark plugs", "spark plug"],
  },
  {
    code: "timing_belt",
    label: "Timing belt",
    aliases: [
      "timing belt set",
      "cam belt",
      "timing drive",
      "timing belt kit",
      "timing belt",
    ],
  },
  {
    code: "timing_chain",
    label: "Timing chain",
    aliases: ["cam chain", "timing chain"],
  },
  {
    code: "water_pump",
    label: "Water pump",
    aliases: ["coolant pump", "water pump"],
  },
  {
    code: "transmission_fluid",
    label: "Transmission fluid",
    aliases: [
      "automatic transmission fluid",
      "automatic transmission oil",
      "transmission oil",
      "transmission fluid",
      "gearbox oil",
      "atf",
    ],
  },
  {
    code: "transmission_filter",
    label: "Transmission filter",
    aliases: ["gearbox filter", "automatic transmission filter", "transmission filter"],
  },
  {
    code: "brake_fluid",
    label: "Brake fluid",
    aliases: ["hydraulic brake fluid", "brake fluid"],
  },
  {
    code: "coolant",
    label: "Engine coolant",
    aliases: ["engine coolant", "cooling fluid", "coolant", "antifreeze"],
  },
  {
    code: "brakes",
    label: "Brakes",
    aliases: [
      "brake pads",
      "brake rotors",
      "brake shoes",
      "brake pads",
      "brake discs",
      "brakes",
    ],
  },
  {
    code: "suspension",
    label: "Suspension",
    aliases: [
      "shock absorber",
      "shock absorbers",
      "suspension",
      "suspension",
      "shock absorber",
    ],
  },
  {
    code: "battery",
    label: "Battery",
    aliases: ["starter battery", "battery"],
  },
  {
    code: "tires",
    label: "Tires",
    aliases: ["road tires", "road tire", "tyres", "tyre", "tires", "tire"],
  },
  {
    code: "inspection",
    label: "Inspection",
    aliases: ["periodic inspection", "vehicle inspection", "inspection"],
  },
  {
    code: "other",
    label: "Other component",
    aliases: [],
  },
] as const;

const taxonomyByCode = new Map(
  COMPONENT_TAXONOMY.map((entry) => [entry.code, entry]),
);

const searchableAliases = COMPONENT_TAXONOMY.flatMap((entry) =>
  entry.aliases.map((alias) => ({
    code: entry.code,
    normalizedAlias: normalizeSearchText(alias),
  })),
).sort(
  (left, right) =>
    right.normalizedAlias.length - left.normalizedAlias.length,
);

export function getComponentLabel(code: ComponentCode): string {
  return taxonomyByCode.get(code)?.label ?? code;
}

export function inferComponentCode(
  ...evidenceParts: ReadonlyArray<string | null | undefined>
): ComponentCode {
  const evidence = normalizeSearchText(
    evidenceParts.filter(Boolean).join(" "),
  );

  if (evidence === "") {
    return "other";
  }

  const paddedEvidence = ` ${evidence} `;

  return (
    searchableAliases.find(({ normalizedAlias }) =>
      paddedEvidence.includes(` ${normalizedAlias} `),
    )?.code ?? "other"
  );
}

export function resolveActionComponentCode(
  action: ServiceAction,
  rawEvidence: string,
): ComponentCode {
  if (action.component_code !== "other") {
    return action.component_code;
  }

  const actionSpecificCode = inferComponentCode(
    action.component_label,
    action.description,
  );

  return actionSpecificCode === "other"
    ? inferComponentCode(rawEvidence)
    : actionSpecificCode;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fi-FI")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
