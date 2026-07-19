import { z } from "zod";

import { vehicleVariantSchema } from "./maintenance-research";

const boundedText = (maximumLength: number) =>
  z.string().trim().min(1).max(maximumLength);

const httpUrlSchema = z
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol));

export const vehicleResolutionSourceSchema = z.strictObject({
  title: boundedText(500),
  publisher: boundedText(200).nullable(),
  url: httpUrlSchema,
});

export const vehicleCandidateSourceSchema =
  vehicleResolutionSourceSchema.extend({
    evidence: boundedText(2_000),
  });

const vehicleResolutionFieldListSchema = z
  .array(boundedText(120))
  .max(20);

export const vehicleCandidateSchema = z.strictObject({
  candidate_id: z.string().regex(/^candidate-[1-9]\d*$/),
  variant: vehicleVariantSchema,
  compatibility: z.enum(["exact", "strong", "partial", "weak", "unknown"]),
  compatibility_explanation: boundedText(2_000),
  matching_fields: vehicleResolutionFieldListSchema,
  conflicting_fields: vehicleResolutionFieldListSchema,
  missing_distinguishing_fields: vehicleResolutionFieldListSchema,
  sources: z.array(vehicleCandidateSourceSchema).min(1).max(10),
});

export const vehicleResolutionSchema = z.strictObject({
  candidates: z.array(vehicleCandidateSchema).max(5),
  sources: z.array(vehicleResolutionSourceSchema).max(50),
  warnings: z.array(boundedText(1_000)).max(20),
  resolved_at: z.iso.datetime({ offset: true }),
});

export type VehicleResolutionSource = z.infer<
  typeof vehicleResolutionSourceSchema
>;
export type VehicleCandidate = z.infer<typeof vehicleCandidateSchema>;
export type VehicleResolution = z.infer<typeof vehicleResolutionSchema>;
