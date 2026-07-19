import { z } from "zod";

import {
  confirmedVehicleInputSchema,
  type VehicleInput,
} from "@/domain/vehicle/vehicle-input";

export const MAX_VEHICLE_RESOLUTION_REQUEST_BYTES = 32 * 1_024;

export class VehicleResolutionRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = "VehicleResolutionRequestError";
  }
}

export async function parseVehicleResolutionRequest(
  request: Request,
): Promise<VehicleInput> {
  if (!isJsonContentType(request.headers.get("content-type"))) {
    throw new VehicleResolutionRequestError(415, "unsupported_media_type");
  }

  const declaredLength = parseDeclaredLength(
    request.headers.get("content-length"),
  );
  if (declaredLength !== null && declaredLength > MAX_VEHICLE_RESOLUTION_REQUEST_BYTES) {
    throw new VehicleResolutionRequestError(413, "payload_too_large");
  }

  const body = await request.text();
  if (
    body.length === 0 ||
    new TextEncoder().encode(body).byteLength >
      MAX_VEHICLE_RESOLUTION_REQUEST_BYTES
  ) {
    throw new VehicleResolutionRequestError(
      body.length === 0 ? 400 : 413,
      body.length === 0 ? "invalid_request" : "payload_too_large",
    );
  }

  try {
    return confirmedVehicleInputSchema.parse(JSON.parse(body));
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      throw new VehicleResolutionRequestError(400, "invalid_request");
    }
    throw error;
  }
}

function isJsonContentType(value: string | null): boolean {
  if (value === null) {
    return false;
  }

  return value.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

function parseDeclaredLength(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  if (!/^\d+$/.test(value)) {
    throw new VehicleResolutionRequestError(400, "invalid_request");
  }

  const length = Number(value);
  if (!Number.isSafeInteger(length)) {
    throw new VehicleResolutionRequestError(413, "payload_too_large");
  }

  return length;
}
