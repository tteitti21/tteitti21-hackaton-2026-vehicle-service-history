import { describe, expect, it } from "vitest";

import {
  confirmedVehicleInputSchema,
  createEmptyVehicleDraft,
  createVehicleInputSchema,
} from "./vehicle-input";

function validDraft() {
  return {
    ...createEmptyVehicleDraft(),
    make: "Toyota",
    model: "Avensis",
    currentOdometerKm: "184000",
  };
}

describe("vehicle input schema", () => {
  it("parses and normalizes a valid vehicle", () => {
    const result = createVehicleInputSchema(2026).parse({
      ...validDraft(),
      make: "  Toyota ",
      modelYear: "2015",
      firstRegistrationYear: "2015",
      engineDisplacementLitres: "2,0",
      powerKw: "93",
      fuelType: "diesel",
    });

    expect(result).toMatchObject({
      make: "Toyota",
      model: "Avensis",
      modelYear: 2015,
      firstRegistrationYear: 2015,
      engineDisplacementLitres: 2,
      powerKw: 93,
      fuelType: "diesel",
      currentOdometerKm: 184_000,
      country: "FI",
    });
  });

  it("keeps optional unknown values undefined", () => {
    const result = createVehicleInputSchema(2026).parse(validDraft());

    expect(result.generation).toBeUndefined();
    expect(result.engineCode).toBeUndefined();
    expect(result.transmissionType).toBeUndefined();
  });

  it.each(["-1", "1.5", "120 000", "abc"])(
    "rejects an invalid odometer: %s",
    (currentOdometerKm) => {
      const result = createVehicleInputSchema(2026).safeParse({
        ...validDraft(),
        currentOdometerKm,
      });

      expect(result.success).toBe(false);
    },
  );

  it("rejects an odometer above the configured sanity limit", () => {
    const result = createVehicleInputSchema(2026).safeParse({
      ...validDraft(),
      currentOdometerKm: "10000001",
    });

    expect(result.success).toBe(false);
  });

  it("rejects future model and registration years", () => {
    const schema = createVehicleInputSchema(2026);

    expect(
      schema.safeParse({ ...validDraft(), modelYear: "2028" }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        ...validDraft(),
        firstRegistrationYear: "2027",
      }).success,
    ).toBe(false);
  });

  it("rejects a registration year that contradicts the model year", () => {
    const result = createVehicleInputSchema(2026).safeParse({
      ...validDraft(),
      modelYear: "2020",
      firstRegistrationYear: "2017",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ["firstRegistrationYear"],
          message:
            "Ensirekisteröintivuosi ei voi olla yli vuotta mallivuotta aikaisempi.",
        }),
      );
    }
  });

  it("allows first registration one year before the stated model year", () => {
    const result = createVehicleInputSchema(2026).safeParse({
      ...validDraft(),
      modelYear: "2020",
      firstRegistrationYear: "2019",
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing make and model", () => {
    const result = createVehicleInputSchema(2026).safeParse({
      ...validDraft(),
      make: "",
      model: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.make).toContain(
        "Merkki on pakollinen.",
      );
      expect(result.error.flatten().fieldErrors.model).toContain(
        "Malli on pakollinen.",
      );
    }
  });

  it("validates the parsed API representation without accepting extra fields", () => {
    const vehicle = createVehicleInputSchema(2026).parse(validDraft());

    expect(confirmedVehicleInputSchema.parse(vehicle)).toEqual(vehicle);
    expect(
      confirmedVehicleInputSchema.safeParse({
        ...vehicle,
        registrationNumber: "SECRET-123",
      }).success,
    ).toBe(false);
  });
});
