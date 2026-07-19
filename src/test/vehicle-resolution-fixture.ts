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
  market: "Eurooppa",
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
        transmission: "6-vaihteinen manuaali",
        market: "Eurooppa",
        confidence: 0.93,
        unresolved_fields: ["vaihteistokoodi"],
      },
      compatibility: "strong",
      compatibility_explanation:
        "Mallisarja, moottorin teho ja markkina täsmäävät, mutta vaihteistokoodi puuttuu.",
      matching_fields: ["T27", "2015", "diesel", "91 kW"],
      conflicting_fields: [],
      missing_distinguishing_fields: ["vaihteistokoodi"],
      sources: [
        {
          title: "Toyota Avensis technical specifications",
          publisher: "toyota.example",
          url: "https://toyota.example/avensis-t27",
          evidence: "Lähde yhdistää 91 kW dieselmoottorin T27-mallisarjaan.",
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
        transmission: "6-vaihteinen manuaali",
        market: "Eurooppa",
        confidence: 0.61,
        unresolved_fields: ["moottorikoodi"],
      },
      compatibility: "partial",
      compatibility_explanation:
        "Mallisarja ja vuosi sopivat, mutta lähteen teho poikkeaa käyttäjän tiedosta.",
      matching_fields: ["T27", "2015", "diesel"],
      conflicting_fields: ["teho: 105 kW vs. 91 kW"],
      missing_distinguishing_fields: ["moottorikoodi"],
      sources: [
        {
          title: "European Avensis engine catalogue",
          publisher: "catalogue.example",
          url: "https://catalogue.example/avensis-engines",
          evidence: "Lähde listaa 2WW-moottorin vuoden 2015 T27-malliin.",
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
    "Moottorikoodi tarvitaan kahden samanikäisen dieselversion erottamiseen.",
  ],
  resolved_at: "2026-07-19T10:00:00.000Z",
};
