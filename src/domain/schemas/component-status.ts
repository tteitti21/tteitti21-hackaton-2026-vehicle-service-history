import { z } from "zod";

import { componentCodeSchema } from "./service-history";

export const componentStatusValueSchema = z.enum([
  "ok",
  "due_soon",
  "due",
  "overdue",
  "unknown",
  "insufficient_evidence",
  "conflicting_sources",
]);

export const componentStatusReasonCodeSchema = z.enum([
  "source_conflict",
  "insufficient_source_evidence",
  "interval_claim_missing",
  "no_service_history_entry",
  "no_qualifying_service_event",
  "inspection_only",
  "low_confidence_service_event",
  "ambiguous_last_service",
  "future_service_date",
  "service_odometer_above_current",
  "odometer_chronology_conflict",
  "missing_service_date",
  "imprecise_service_date",
  "invalid_service_date",
  "unverified_service_date",
  "missing_service_odometer",
  "invalid_service_odometer",
  "unverified_service_odometer",
  "distance_overdue",
  "time_overdue",
  "distance_due",
  "time_due",
  "distance_due_soon",
  "time_due_soon",
  "within_interval",
]);

export const componentStatusSchema = z
  .strictObject({
    component_code: componentCodeSchema,
    status: componentStatusValueSchema,
    reason_codes: z.array(componentStatusReasonCodeSchema).min(1),
    last_service_event_id: z.string().trim().min(1).nullable(),
    interval_claim_id: z.string().regex(/^claim-[1-9]\d*$/).nullable(),
    distance_used_km: z.number().int().nonnegative().nullable(),
    distance_remaining_km: z.number().int().nullable(),
    months_used: z.number().int().nonnegative().nullable(),
    months_remaining: z.number().int().nullable(),
    due_odometer_km: z.number().int().nonnegative().nullable(),
    due_date: z.iso.date().nullable(),
  })
  .superRefine((status, context) => {
    if (new Set(status.reason_codes).size !== status.reason_codes.length) {
      context.addIssue({
        code: "custom",
        path: ["reason_codes"],
        message: "Reason codes must be unique.",
      });
    }

    if (
      ["ok", "due_soon", "due", "overdue"].includes(status.status) &&
      (status.last_service_event_id === null ||
        status.interval_claim_id === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Calculated statuses require service and interval evidence.",
      });
    }
  });

export type ComponentStatusValue = z.infer<
  typeof componentStatusValueSchema
>;
export type ComponentStatus = z.infer<typeof componentStatusSchema>;
export type ComponentStatusReasonCode = z.infer<
  typeof componentStatusReasonCodeSchema
>;
