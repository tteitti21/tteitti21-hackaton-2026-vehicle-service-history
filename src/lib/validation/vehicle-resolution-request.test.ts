import { describe, expect, it } from "vitest";

import { confirmedVehicleFixture } from "@/test/vehicle-resolution-fixture";

import {
  MAX_VEHICLE_RESOLUTION_REQUEST_BYTES,
  parseVehicleResolutionRequest,
  VehicleResolutionRequestError,
} from "./vehicle-resolution-request";

describe("parseVehicleResolutionRequest", () => {
  it("accepts only the strict parsed VehicleInput JSON contract", async () => {
    await expect(
      parseVehicleResolutionRequest(createRequest(confirmedVehicleFixture)),
    ).resolves.toEqual(confirmedVehicleFixture);
  });

  it("rejects non-JSON, malformed JSON, and unknown sensitive fields", async () => {
    await expect(
      parseVehicleResolutionRequest(
        new Request("http://localhost/api/resolve-vehicle", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: "{}",
        }),
      ),
    ).rejects.toMatchObject({ status: 415, code: "unsupported_media_type" });

    await expect(
      parseVehicleResolutionRequest(createRequest("{", true)),
    ).rejects.toMatchObject({ status: 400, code: "invalid_request" });

    await expect(
      parseVehicleResolutionRequest(
        createRequest({
          ...confirmedVehicleFixture,
          registrationNumber: "SECRET-123",
        }),
      ),
    ).rejects.toBeInstanceOf(VehicleResolutionRequestError);
  });

  it("rejects declared and measured oversized bodies", async () => {
    await expect(
      parseVehicleResolutionRequest(
        new Request("http://localhost/api/resolve-vehicle", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(
              MAX_VEHICLE_RESOLUTION_REQUEST_BYTES + 1,
            ),
          },
          body: "{}",
        }),
      ),
    ).rejects.toMatchObject({ status: 413, code: "payload_too_large" });

    await expect(
      parseVehicleResolutionRequest(
        createRequest({
          ...confirmedVehicleFixture,
          additionalDetails: "x".repeat(
            MAX_VEHICLE_RESOLUTION_REQUEST_BYTES,
          ),
        }),
      ),
    ).rejects.toMatchObject({ status: 413, code: "payload_too_large" });
  });
});

function createRequest(body: unknown, raw = false): Request {
  return new Request("http://localhost/api/resolve-vehicle", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: raw ? String(body) : JSON.stringify(body),
  });
}
