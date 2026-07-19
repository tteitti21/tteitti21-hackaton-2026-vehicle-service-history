import { z } from "zod";

export const vehicleVariantSchema = z.strictObject({
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  generation: z.string().trim().min(1).max(160).nullable(),
  model_year: z.number().int().min(1886).max(3000).nullable(),
  engine: z.string().trim().min(1).max(240).nullable(),
  transmission: z.string().trim().min(1).max(240).nullable(),
  market: z.string().trim().min(1).max(160).nullable(),
  confidence: z.number().min(0).max(1),
  unresolved_fields: z.array(z.string().trim().min(1).max(120)).max(20),
});

export const researchSourceSchema = z.strictObject({
  title: z.string(),
  publisher: z.string().nullable(),
  url: z.url(),
  retrieved_at: z.iso.date(),
  evidence: z.string(),
});

export const intervalClaimSchema = z.strictObject({
  claim_id: z.string(),
  interval_km: z.number().int().nonnegative().nullable(),
  interval_months: z.number().int().nonnegative().nullable(),
  whichever_first: z.boolean(),
  conditions: z.string().nullable(),
  original_value: z.number().nullable(),
  original_unit: z
    .enum(["km", "mi", "months", "years", "mixed"])
    .nullable(),
  source: researchSourceSchema,
  authority_rank: z.number().int().min(1).max(6),
  compatibility: z.enum(["exact", "strong", "partial", "weak", "unknown"]),
  compatibility_notes: z.string(),
});

export const componentResearchSchema = z.strictObject({
  component_code: z.string(),
  component_label: z.string(),
  resolution: z.enum([
    "resolved",
    "conflicting_sources",
    "insufficient_evidence",
  ]),
  interval_claims: z.array(intervalClaimSchema),
  recommended_claim_id: z.string().nullable(),
  conflict_summary: z.string().nullable(),
});

export const maintenanceResearchSchema = z.strictObject({
  vehicle_variant: vehicleVariantSchema,
  components: z.array(componentResearchSchema),
  global_warnings: z.array(z.string()),
  researched_at: z.iso.datetime({ offset: true }),
});

export type VehicleVariant = z.infer<typeof vehicleVariantSchema>;
export type ResearchSource = z.infer<typeof researchSourceSchema>;
export type IntervalClaim = z.infer<typeof intervalClaimSchema>;
export type ComponentResearch = z.infer<typeof componentResearchSchema>;
export type MaintenanceResearch = z.infer<typeof maintenanceResearchSchema>;
