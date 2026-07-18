import { z } from "zod";

export const componentCodeSchema = z.enum([
  "engine_oil",
  "oil_filter",
  "air_filter",
  "cabin_filter",
  "fuel_filter",
  "spark_plugs",
  "timing_belt",
  "timing_chain",
  "water_pump",
  "transmission_fluid",
  "transmission_filter",
  "brake_fluid",
  "coolant",
  "brakes",
  "suspension",
  "battery",
  "tires",
  "inspection",
  "other",
]);

export const serviceImageSchema = z.strictObject({
  image_id: z.string().min(1),
  readability: z.number().min(0).max(1),
  notes: z.string().nullable(),
});

export const serviceDateSchema = z.strictObject({
  value: z.string(),
  precision: z.enum(["day", "month", "year", "unknown"]),
  confidence: z.number().min(0).max(1),
});

export const odometerEvidenceSchema = z.strictObject({
  value: z.number().int().nonnegative(),
  unit: z.enum(["km", "mi", "unknown"]),
  confidence: z.number().min(0).max(1),
});

export const serviceActionSchema = z.strictObject({
  component_code: componentCodeSchema,
  component_label: z.string(),
  action_type: z.enum([
    "replaced",
    "serviced",
    "repaired",
    "inspected",
    "adjusted",
    "unknown",
  ]),
  description: z.string(),
  confidence: z.number().min(0).max(1),
});

export const serviceEventSchema = z.strictObject({
  event_id: z.string().min(1),
  source_image_ids: z.array(z.string()).min(1),
  raw_evidence: z.string(),
  service_date: serviceDateSchema.nullable(),
  odometer: odometerEvidenceSchema.nullable(),
  actions: z.array(serviceActionSchema),
  workshop: z.string().nullable(),
  notes: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  ambiguities: z.array(z.string()),
});

export const serviceHistorySchema = z.strictObject({
  images: z.array(serviceImageSchema),
  events: z.array(serviceEventSchema),
  warnings: z.array(z.string()),
});

export type ComponentCode = z.infer<typeof componentCodeSchema>;
export type ServiceImage = z.infer<typeof serviceImageSchema>;
export type ServiceAction = z.infer<typeof serviceActionSchema>;
export type ServiceEvent = z.infer<typeof serviceEventSchema>;
export type ServiceHistory = z.infer<typeof serviceHistorySchema>;
