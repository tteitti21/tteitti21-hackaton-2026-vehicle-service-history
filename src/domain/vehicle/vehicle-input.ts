import { z } from "zod";

export const fuelTypes = [
  "petrol",
  "diesel",
  "hybrid",
  "plug_in_hybrid",
  "electric",
  "lpg",
  "cng",
  "hydrogen",
  "other",
] as const;

export const transmissionTypes = [
  "manual",
  "automatic",
  "cvt",
  "dual_clutch",
  "automated_manual",
  "other",
] as const;

export const drivetrainTypes = [
  "front_wheel_drive",
  "rear_wheel_drive",
  "all_wheel_drive",
  "four_wheel_drive",
  "other",
] as const;

export const countryCodes = [
  "FI",
  "SE",
  "NO",
  "DK",
  "DE",
  "EE",
  "FR",
  "GB",
  "US",
  "JP",
  "OTHER",
] as const;

export interface VehicleFormDraft {
  make: string;
  model: string;
  generation: string;
  modelYear: string;
  firstRegistrationYear: string;
  engineDisplacementLitres: string;
  engineCode: string;
  powerKw: string;
  fuelType: string;
  transmissionType: string;
  transmissionCode: string;
  drivetrain: string;
  country: string;
  market: string;
  currentOdometerKm: string;
  additionalDetails: string;
}

const requiredText = (label: string, maximumLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(maximumLength, `${label} is too long.`);

const optionalText = (label: string, maximumLength: number) =>
  z
    .string()
    .trim()
    .max(maximumLength, `${label} is too long.`)
    .transform((value) => (value === "" ? undefined : value));

const requiredInteger = (
  requiredMessage: string,
  integerMessage: string,
  minimum: number,
  maximum: number,
  rangeMessage: string,
) =>
  z
    .string()
    .trim()
    .min(1, requiredMessage)
    .regex(/^\d+$/, integerMessage)
    .transform(Number)
    .pipe(z.number().int().min(minimum, rangeMessage).max(maximum, rangeMessage));

const optionalInteger = (
  integerMessage: string,
  minimum: number,
  maximum: number,
  rangeMessage: string,
) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d+$/.test(value), integerMessage)
    .transform((value) => (value === "" ? undefined : Number(value)))
    .pipe(
      z
        .number()
        .int()
        .min(minimum, rangeMessage)
        .max(maximum, rangeMessage)
        .optional(),
    );

const optionalDecimal = (
  numberMessage: string,
  minimum: number,
  maximum: number,
  rangeMessage: string,
) =>
  z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^\d+(?:[.,]\d{1,2})?$/.test(value),
      numberMessage,
    )
    .transform((value) =>
      value === "" ? undefined : Number(value.replace(",", ".")),
    )
    .pipe(z.number().min(minimum, rangeMessage).max(maximum, rangeMessage).optional());

const optionalEnum = <TValues extends readonly [string, ...string[]]>(
  values: TValues,
  message: string,
) =>
  z
    .union([z.literal(""), z.enum(values, { error: message })])
    .transform((value) => (value === "" ? undefined : value));

export function createVehicleInputSchema(
  currentYear = new Date().getFullYear(),
) {
  return z
    .strictObject({
      make: requiredText("Make", 80),
      model: requiredText("Model", 80),
      generation: optionalText("Generation or chassis code", 80),
      modelYear: optionalInteger(
        "Enter the model year as a four-digit integer.",
        1886,
        currentYear + 1,
        `The model year must be between 1886 and ${currentYear + 1}.`,
      ),
      firstRegistrationYear: optionalInteger(
        "Enter the first registration year as a four-digit integer.",
        1886,
        currentYear,
        `The first registration year must be between 1886 and ${currentYear}.`,
      ),
      engineDisplacementLitres: optionalDecimal(
        "Enter the engine displacement as a number, for example 2.0.",
        0.1,
        20,
        "The engine displacement must be between 0.1 and 20 litres.",
      ),
      engineCode: optionalText("Engine code", 40),
      powerKw: optionalInteger(
        "Enter power as whole kilowatts.",
        1,
        2_000,
        "Power must be between 1 and 2,000 kW.",
      ),
      fuelType: optionalEnum(fuelTypes, "Select a fuel type from the list."),
      transmissionType: optionalEnum(
        transmissionTypes,
        "Select a transmission type from the list.",
      ),
      transmissionCode: optionalText("Transmission code", 40),
      drivetrain: optionalEnum(
        drivetrainTypes,
        "Select a drivetrain from the list.",
      ),
      country: z.enum(countryCodes, {
        error: "Select the vehicle country.",
      }),
      market: optionalText("Market", 80),
      currentOdometerKm: requiredInteger(
        "The current odometer reading is required.",
        "Enter the odometer reading as whole kilometres.",
        0,
        10_000_000,
        "The odometer reading must be between 0 and 10,000,000 km.",
      ),
      additionalDetails: optionalText("Additional details", 1_000),
    })
    .superRefine((vehicle, context) => {
      if (
        vehicle.modelYear !== undefined &&
        vehicle.firstRegistrationYear !== undefined &&
        vehicle.firstRegistrationYear < vehicle.modelYear - 1
      ) {
        context.addIssue({
          code: "custom",
          path: ["firstRegistrationYear"],
          message:
            "The first registration year cannot be more than one year before the model year.",
        });
      }
    });
}

export const vehicleInputSchema = createVehicleInputSchema();

export type VehicleFieldName = keyof VehicleFormDraft;
export type VehicleFieldErrors = Partial<
  Record<VehicleFieldName, string>
>;

export function createConfirmedVehicleInputSchema(
  currentYear = new Date().getFullYear(),
) {
  return z
    .strictObject({
      make: z.string().trim().min(1).max(80),
      model: z.string().trim().min(1).max(80),
      generation: z.string().trim().min(1).max(80).optional(),
      modelYear: z.number().int().min(1886).max(currentYear + 1).optional(),
      firstRegistrationYear: z
        .number()
        .int()
        .min(1886)
        .max(currentYear)
        .optional(),
      engineDisplacementLitres: z.number().min(0.1).max(20).optional(),
      engineCode: z.string().trim().min(1).max(40).optional(),
      powerKw: z.number().int().min(1).max(2_000).optional(),
      fuelType: z.enum(fuelTypes).optional(),
      transmissionType: z.enum(transmissionTypes).optional(),
      transmissionCode: z.string().trim().min(1).max(40).optional(),
      drivetrain: z.enum(drivetrainTypes).optional(),
      country: z.enum(countryCodes),
      market: z.string().trim().min(1).max(80).optional(),
      currentOdometerKm: z.number().int().min(0).max(10_000_000),
      additionalDetails: z.string().trim().min(1).max(1_000).optional(),
    })
    .superRefine((vehicle, context) => {
      if (
        vehicle.modelYear !== undefined &&
        vehicle.firstRegistrationYear !== undefined &&
        vehicle.firstRegistrationYear < vehicle.modelYear - 1
      ) {
        context.addIssue({
          code: "custom",
          path: ["firstRegistrationYear"],
          message:
            "The first registration year cannot be more than one year before the model year.",
        });
      }
    });
}

export const confirmedVehicleInputSchema = createConfirmedVehicleInputSchema();
export type VehicleInput = z.output<typeof confirmedVehicleInputSchema>;

export function createEmptyVehicleDraft(): VehicleFormDraft {
  return {
    make: "",
    model: "",
    generation: "",
    modelYear: "",
    firstRegistrationYear: "",
    engineDisplacementLitres: "",
    engineCode: "",
    powerKw: "",
    fuelType: "",
    transmissionType: "",
    transmissionCode: "",
    drivetrain: "",
    country: "FI",
    market: "Europe",
    currentOdometerKm: "",
    additionalDetails: "",
  };
}

export function collectVehicleFieldErrors(
  error: z.ZodError,
): VehicleFieldErrors {
  const errors: VehicleFieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];

    if (typeof field === "string" && errors[field as VehicleFieldName] === undefined) {
      errors[field as VehicleFieldName] = issue.message;
    }
  }

  return errors;
}
