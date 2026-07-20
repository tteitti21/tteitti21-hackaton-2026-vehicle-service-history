import type { VehicleResolution } from "@/domain/schemas/vehicle-resolution";
import type { VehicleInput } from "@/domain/vehicle/vehicle-input";

export const confirmedVehicleFixture: VehicleInput = {
  make: "Toyota",
  model: "Avensis",
  generation: "T27",
  modelYear: 2015,
  firstRegistrationYear: 2015,
  engineDisplacementLitres: 2,
  engineCode: undefined,
  powerKw: 91,
  fuelType: "diesel",
  transmissionType: "manual",
  transmissionCode: undefined,
  drivetrain: "front_wheel_drive",
  country: "FI",
  market: "Europe",
  currentOdometerKm: 184_000,
  additionalDetails: undefined,
};

export const vehicleResolutionFixture: VehicleResolution = {
  candidates: [
    {
      candidate_id: "candidate-1",
      variant: {
        make: "Toyota",
        model: "Avensis",
        generation: "T27",
        model_year: 2015,
        engine: "2.0 D-4D (1AD-FTV), 91 kW",
        transmission: "6-speed manual",
        market: "Europe",
        confidence: 0.93,
        unresolved_fields: ["transmission code"],
      },
      compatibility: "strong",
      compatibility_explanation:
        "The model series, engine power, and market match, but the transmission code is missing.",
      matching_fields: ["T27", "2015", "diesel", "91 kW"],
      conflicting_fields: [],
      missing_distinguishing_fields: ["transmission code"],
      sources: [
        {
          title: "Toyota Avensis technical specifications",
          publisher: "toyota.example",
          url: "https://toyota.example/avensis-t27",
          evidence: "The source links the 91 kW diesel engine to the T27 model series.",
        },
      ],
    },
    {
      candidate_id: "candidate-2",
      variant: {
        make: "Toyota",
        model: "Avensis",
        generation: "T27",
        model_year: 2015,
        engine: "2.0 D-4D (2WW), 105 kW",
        transmission: "6-speed manual",
        market: "Europe",
        confidence: 0.61,
        unresolved_fields: ["engine code"],
      },
      compatibility: "partial",
      compatibility_explanation:
        "The model series and year match, but the source power differs from the user's information.",
      matching_fields: ["T27", "2015", "diesel"],
      conflicting_fields: ["power: 105 kW vs. 91 kW"],
      missing_distinguishing_fields: ["engine code"],
      sources: [
        {
          title: "European Avensis engine catalogue",
          publisher: "catalogue.example",
          url: "https://catalogue.example/avensis-engines",
          evidence: "The source lists the 2WW engine for the 2015 T27 model.",
        },
      ],
    },
  ],
  sources: [
    {
      title: "Toyota Avensis technical specifications",
      publisher: "toyota.example",
      url: "https://toyota.example/avensis-t27",
    },
    {
      title: "European Avensis engine catalogue",
      publisher: "catalogue.example",
      url: "https://catalogue.example/avensis-engines",
    },
  ],
  warnings: [
    "The engine code is needed to distinguish two diesel variants of the same age.",
  ],
  resolved_at: "2026-07-19T10:00:00.000Z",
};
