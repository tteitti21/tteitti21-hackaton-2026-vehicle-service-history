import { z } from "zod";

import { componentCodeSchema } from "./service-history";

const boundedText = (maximumLength: number) =>
  z.string().trim().min(1).max(maximumLength);
const httpUrlSchema = z
  .url()
  .refine((value) => /^https?:\/\//i.test(value));

export const vehicleVariantSchema = z.strictObject({
  make: boundedText(80),
  model: boundedText(80),
  generation: boundedText(160).nullable(),
  model_year: z.number().int().min(1886).max(3000).nullable(),
  engine: boundedText(240).nullable(),
  transmission: boundedText(240).nullable(),
  market: boundedText(160).nullable(),
  confidence: z.number().min(0).max(1),
  unresolved_fields: z.array(boundedText(120)).max(20),
});

export const researchSourceSchema = z.strictObject({
  title: boundedText(500),
  publisher: boundedText(240).nullable(),
  url: httpUrlSchema,
  retrieved_at: z.iso.date(),
  evidence: boundedText(2_000),
});

export const intervalClaimSchema = z
  .strictObject({
    claim_id: z.string().regex(/^claim-[1-9]\d*$/),
    interval_km: z.number().int().positive().max(10_000_000).nullable(),
    interval_months: z.number().int().positive().max(1_200).nullable(),
    whichever_first: z.boolean(),
    conditions: boundedText(1_000).nullable(),
    original_value: z.number().positive().max(10_000_000).nullable(),
    original_unit: z
      .enum(["km", "mi", "months", "years", "mixed"])
      .nullable(),
    source: researchSourceSchema,
    authority_rank: z.number().int().min(1).max(6),
    compatibility: z.enum(["exact", "strong", "partial", "weak", "unknown"]),
    compatibility_notes: boundedText(1_000),
  })
  .superRefine((claim, context) => {
    const hasDistance = claim.interval_km !== null;
    const hasTime = claim.interval_months !== null;
    let valid = true;

    if (!hasDistance && !hasTime) {
      valid = false;
    } else if (hasDistance && hasTime) {
      valid =
        claim.whichever_first &&
        claim.original_unit === "mixed" &&
        claim.original_value === null;
    } else if (
      claim.whichever_first ||
      claim.original_value === null ||
      claim.original_unit === null ||
      claim.original_unit === "mixed"
    ) {
      valid = false;
    } else if (hasDistance) {
      const multiplier =
        claim.original_unit === "mi"
          ? 1.609344
          : claim.original_unit === "km"
            ? 1
            : null;
      valid =
        multiplier !== null &&
        claim.interval_km === Math.round(claim.original_value * multiplier);
    } else {
      const multiplier =
        claim.original_unit === "years"
          ? 12
          : claim.original_unit === "months"
            ? 1
            : null;
      valid =
        multiplier !== null &&
        claim.interval_months ===
          Math.round(claim.original_value * multiplier);
    }

    if (!valid) {
      context.addIssue({
        code: "custom",
        message: "Interval values and original units are inconsistent.",
      });
    }
  });

export const componentResearchSchema = z
  .strictObject({
    component_code: componentCodeSchema,
    component_label: boundedText(160),
    resolution: z.enum([
      "resolved",
      "conflicting_sources",
      "insufficient_evidence",
    ]),
    interval_claims: z.array(intervalClaimSchema).max(30),
    recommended_claim_id: z.string().regex(/^claim-[1-9]\d*$/).nullable(),
    conflict_summary: boundedText(1_000).nullable(),
  })
  .superRefine((component, context) => {
    const claimIds = new Set(
      component.interval_claims.map((claim) => claim.claim_id),
    );
    const valid =
      claimIds.size === component.interval_claims.length &&
      (component.resolution === "resolved"
        ? component.recommended_claim_id !== null &&
          claimIds.has(component.recommended_claim_id) &&
          component.conflict_summary === null
        : component.recommended_claim_id === null &&
          (component.resolution === "conflicting_sources"
            ? component.conflict_summary !== null
            : component.conflict_summary === null));

    if (!valid) {
      context.addIssue({
        code: "custom",
        message: "Component resolution and interval claims are inconsistent.",
      });
    }
  });

export const maintenanceResearchSchema = z
  .strictObject({
    vehicle_variant: vehicleVariantSchema,
    components: z.array(componentResearchSchema).min(1).max(19),
    global_warnings: z.array(boundedText(1_000)).max(50),
    researched_at: z.iso.datetime({ offset: true }),
  })
  .superRefine((research, context) => {
    const componentCodes = new Set(
      research.components.map((component) => component.component_code),
    );
    const claimIds = research.components.flatMap((component) =>
      component.interval_claims.map((claim) => claim.claim_id),
    );

    if (
      componentCodes.size !== research.components.length ||
      new Set(claimIds).size !== claimIds.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Component codes and claim IDs must be globally unique.",
      });
    }
  });

export type VehicleVariant = z.infer<typeof vehicleVariantSchema>;
export type ResearchSource = z.infer<typeof researchSourceSchema>;
export type IntervalClaim = z.infer<typeof intervalClaimSchema>;
export type ComponentResearch = z.infer<typeof componentResearchSchema>;
export type MaintenanceResearch = z.infer<typeof maintenanceResearchSchema>;
