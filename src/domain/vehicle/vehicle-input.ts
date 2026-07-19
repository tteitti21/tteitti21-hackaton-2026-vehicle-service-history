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
    .min(1, `${label} on pakollinen.`)
    .max(maximumLength, `${label} on liian pitkä.`);

const optionalText = (label: string, maximumLength: number) =>
  z
    .string()
    .trim()
    .max(maximumLength, `${label} on liian pitkä.`)
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
      make: requiredText("Merkki", 80),
      model: requiredText("Malli", 80),
      generation: optionalText("Sukupolvi tai alustakoodi", 80),
      modelYear: optionalInteger(
        "Anna mallivuosi nelinumeroisena kokonaislukuna.",
        1886,
        currentYear + 1,
        `Mallivuoden on oltava välillä 1886–${currentYear + 1}.`,
      ),
      firstRegistrationYear: optionalInteger(
        "Anna ensirekisteröintivuosi nelinumeroisena kokonaislukuna.",
        1886,
        currentYear,
        `Ensirekisteröintivuoden on oltava välillä 1886–${currentYear}.`,
      ),
      engineDisplacementLitres: optionalDecimal(
        "Anna moottorin tilavuus numerona, esimerkiksi 2,0.",
        0.1,
        20,
        "Moottorin tilavuuden on oltava välillä 0,1–20 litraa.",
      ),
      engineCode: optionalText("Moottorikoodi", 40),
      powerKw: optionalInteger(
        "Anna teho kokonaisina kilowatteina.",
        1,
        2_000,
        "Tehon on oltava välillä 1–2 000 kW.",
      ),
      fuelType: optionalEnum(fuelTypes, "Valitse luettelossa oleva käyttövoima."),
      transmissionType: optionalEnum(
        transmissionTypes,
        "Valitse luettelossa oleva vaihteistotyyppi.",
      ),
      transmissionCode: optionalText("Vaihteistokoodi", 40),
      drivetrain: optionalEnum(
        drivetrainTypes,
        "Valitse luettelossa oleva vetotapa.",
      ),
      country: z.enum(countryCodes, {
        error: "Valitse ajoneuvon maa.",
      }),
      market: optionalText("Markkina-alue", 80),
      currentOdometerKm: requiredInteger(
        "Nykyinen matkamittarilukema on pakollinen.",
        "Anna matkamittarilukema kokonaisina kilometreinä.",
        0,
        10_000_000,
        "Matkamittarilukeman on oltava välillä 0–10 000 000 km.",
      ),
      additionalDetails: optionalText("Lisätiedot", 1_000),
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
            "Ensirekisteröintivuosi ei voi olla yli vuotta mallivuotta aikaisempi.",
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
            "Ensirekisteröintivuosi ei voi olla yli vuotta mallivuotta aikaisempi.",
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
    market: "Eurooppa",
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
