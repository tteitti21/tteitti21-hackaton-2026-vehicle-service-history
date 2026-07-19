import { describe, expect, it, vi } from "vitest";

import {
  confirmedVehicleFixture,
  vehicleResolutionFixture,
} from "@/test/vehicle-resolution-fixture";

import {
  resolveVehicle,
  VehicleResolutionOutputValidationError,
} from "./resolve-vehicle";

describe("resolveVehicle", () => {
  it("returns a strictly validated source-backed result", async () => {
    const provider = {
      resolve: vi.fn().mockResolvedValue(vehicleResolutionFixture),
    };

    await expect(
      resolveVehicle(
        provider,
        confirmedVehicleFixture,
        new AbortController().signal,
      ),
    ).resolves.toEqual(vehicleResolutionFixture);
  });

  it("rejects candidate links not present in preserved search sources", async () => {
    const invalid = structuredClone(vehicleResolutionFixture);
    invalid.candidates[0].sources[0].url =
      "https://fabricated.example/not-searched";

    await expect(
      resolveVehicle(
        { resolve: vi.fn().mockResolvedValue(invalid) },
        confirmedVehicleFixture,
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(VehicleResolutionOutputValidationError);
  });

  it("rejects duplicate candidate IDs and duplicate candidate sources", async () => {
    const invalid = structuredClone(vehicleResolutionFixture);
    invalid.candidates[1].candidate_id = "candidate-1";
    invalid.candidates[0].sources.push(invalid.candidates[0].sources[0]);

    await expect(
      resolveVehicle(
        { resolve: vi.fn().mockResolvedValue(invalid) },
        confirmedVehicleFixture,
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(VehicleResolutionOutputValidationError);
  });
});
