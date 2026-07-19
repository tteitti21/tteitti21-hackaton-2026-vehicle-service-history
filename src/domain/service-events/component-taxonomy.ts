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
    label: "Moottoriöljy",
    aliases: ["moottoriöljy", "engine oil", "motor oil"],
  },
  {
    code: "oil_filter",
    label: "Öljynsuodatin",
    aliases: ["öljynsuodatin", "oil filter"],
  },
  {
    code: "air_filter",
    label: "Ilmansuodatin",
    aliases: ["ilmansuodatin", "air filter"],
  },
  {
    code: "cabin_filter",
    label: "Raitisilmasuodatin",
    aliases: [
      "raitisilmasuodatin",
      "sisäilmansuodatin",
      "cabin filter",
      "pollen filter",
    ],
  },
  {
    code: "fuel_filter",
    label: "Polttoainesuodatin",
    aliases: ["polttoainesuodatin", "dieselsuodatin", "fuel filter"],
  },
  {
    code: "spark_plugs",
    label: "Sytytystulpat",
    aliases: ["sytytystulpat", "sytytystulppa", "spark plugs", "spark plug"],
  },
  {
    code: "timing_belt",
    label: "Jakohihna",
    aliases: [
      "jakohihnasarja",
      "jakohihna",
      "jakopää",
      "timing belt kit",
      "timing belt",
    ],
  },
  {
    code: "timing_chain",
    label: "Jakoketju",
    aliases: ["jakoketju", "timing chain"],
  },
  {
    code: "water_pump",
    label: "Vesipumppu",
    aliases: ["vesipumppu", "water pump"],
  },
  {
    code: "transmission_fluid",
    label: "Vaihteistoöljy",
    aliases: [
      "automaattivaihteistoöljy",
      "automaattiöljy",
      "vaihteistoöljy",
      "transmission fluid",
      "gearbox oil",
      "atf",
    ],
  },
  {
    code: "transmission_filter",
    label: "Vaihteiston suodatin",
    aliases: ["vaihteistosuodatin", "vaihteiston suodatin", "transmission filter"],
  },
  {
    code: "brake_fluid",
    label: "Jarruneste",
    aliases: ["jarruneste", "brake fluid"],
  },
  {
    code: "coolant",
    label: "Jäähdytysneste",
    aliases: ["jäähdytysneste", "pakkasneste", "coolant", "antifreeze"],
  },
  {
    code: "brakes",
    label: "Jarrut",
    aliases: [
      "jarrupalat",
      "jarrulevyt",
      "jarrukengät",
      "brake pads",
      "brake discs",
      "brakes",
    ],
  },
  {
    code: "suspension",
    label: "Jousitus",
    aliases: [
      "iskunvaimennin",
      "iskunvaimentimet",
      "jousitus",
      "suspension",
      "shock absorber",
    ],
  },
  {
    code: "battery",
    label: "Akku",
    aliases: ["akku", "battery"],
  },
  {
    code: "tires",
    label: "Renkaat",
    aliases: ["renkaat", "rengas", "tyres", "tyre", "tires", "tire"],
  },
  {
    code: "inspection",
    label: "Katsastus tai tarkastus",
    aliases: ["määräaikaiskatsastus", "katsastus", "inspection"],
  },
  {
    code: "other",
    label: "Muu komponentti",
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
