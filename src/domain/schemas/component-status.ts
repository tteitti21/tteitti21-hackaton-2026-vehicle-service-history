import { z } from "zod";

export const componentStatusValueSchema = z.enum([
  "ok",
  "due_soon",
  "due",
  "overdue",
  "unknown",
  "insufficient_evidence",
  "conflicting_sources",
]);

export const componentStatusSchema = z.strictObject({
  component_code: z.string(),
  status: componentStatusValueSchema,
  reason_codes: z.array(z.string()),
  last_service_event_id: z.string().nullable(),
  interval_claim_id: z.string().nullable(),
  distance_used_km: z.number().int().nullable(),
  distance_remaining_km: z.number().int().nullable(),
  months_used: z.number().int().nullable(),
  months_remaining: z.number().int().nullable(),
});

export type ComponentStatusValue = z.infer<
  typeof componentStatusValueSchema
>;
export type ComponentStatus = z.infer<typeof componentStatusSchema>;
