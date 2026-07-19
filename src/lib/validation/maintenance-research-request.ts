import { z } from "zod";

import { vehicleVariantSchema } from "@/domain/schemas/maintenance-research";
import { componentCodeSchema } from "@/domain/schemas/service-history";
import { countryCodes } from "@/domain/vehicle/vehicle-input";

export const MAX_MAINTENANCE_RESEARCH_REQUEST_BYTES = 64 * 1_024;

export const researchComponentRequestSchema = z.strictObject({
  component_code: componentCodeSchema,
  component_label: z.string().trim().min(1).max(160),
});

export const maintenanceResearchRequestSchema = z
  .strictObject({
    vehicle_variant: vehicleVariantSchema,
    current_odometer_km: z.number().int().nonnegative().max(10_000_000),
    country: z.enum(countryCodes).nullable(),
    market: z.string().trim().min(1).max(160).nullable(),
    components: z.array(researchComponentRequestSchema).min(1).max(19),
  })
  .superRefine((request, context) => {
    const codes = new Set<string>();
    for (const component of request.components) {
      if (codes.has(component.component_code)) {
        context.addIssue({
          code: "custom",
          path: ["components"],
          message: "Component codes must be unique.",
        });
      }
      codes.add(component.component_code);
    }
  });

export type MaintenanceResearchRequest = z.infer<
  typeof maintenanceResearchRequestSchema
>;

export class MaintenanceResearchRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = "MaintenanceResearchRequestError";
  }
}

export async function parseMaintenanceResearchRequest(
  request: Request,
): Promise<MaintenanceResearchRequest> {
  if (!isJsonContentType(request.headers.get("content-type"))) {
    throw new MaintenanceResearchRequestError(
      415,
      "unsupported_media_type",
    );
  }

  const declaredLength = parseDeclaredLength(
    request.headers.get("content-length"),
  );
  if (
    declaredLength !== null &&
    declaredLength > MAX_MAINTENANCE_RESEARCH_REQUEST_BYTES
  ) {
    throw new MaintenanceResearchRequestError(413, "payload_too_large");
  }

  const body = await request.text();
  if (body.length === 0) {
    throw new MaintenanceResearchRequestError(400, "invalid_request");
  }
  if (
    new TextEncoder().encode(body).byteLength >
    MAX_MAINTENANCE_RESEARCH_REQUEST_BYTES
  ) {
    throw new MaintenanceResearchRequestError(413, "payload_too_large");
  }

  try {
    return maintenanceResearchRequestSchema.parse(JSON.parse(body));
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      throw new MaintenanceResearchRequestError(400, "invalid_request");
    }
    throw error;
  }
}

function isJsonContentType(value: string | null): boolean {
  return (
    value?.split(";", 1)[0]?.trim().toLowerCase() === "application/json"
  );
}

function parseDeclaredLength(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  if (!/^\d+$/.test(value)) {
    throw new MaintenanceResearchRequestError(400, "invalid_request");
  }

  const length = Number(value);
  if (!Number.isSafeInteger(length)) {
    throw new MaintenanceResearchRequestError(413, "payload_too_large");
  }
  return length;
}
