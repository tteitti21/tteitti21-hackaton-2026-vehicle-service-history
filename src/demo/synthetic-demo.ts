import type { DemoSessionData } from "@/domain/session/analysis-session";

/**
 * Fully fictional Phase 9 demo data.
 *
 * The image IDs describe three synthetic documents; no image bytes, people,
 * registration numbers, VINs, addresses, invoices, or customer data are
 * included. Reserved `.invalid` source domains cannot resolve on the public
 * internet and make it clear that these are preserved demo citations.
 */
export const syntheticDemoSession = {
  vehicle: {
    make: "Nordica",
    model: "Aurora",
    generation: "N2",
    modelYear: 2021,
    firstRegistrationYear: 2021,
    engineDisplacementLitres: 1.8,
    engineCode: "N18-X",
    powerKw: 110,
    fuelType: "hybrid",
    transmissionType: "cvt",
    drivetrain: "front_wheel_drive",
    country: "FI",
    market: "Europe",
    currentOdometerKm: 180_000,
    additionalDetails:
      "SYNTHETIC DEMO – the details do not describe a real vehicle.",
  },
  serviceHistory: {
    images: [
      {
        image_id: "synthetic-document-1",
        readability: 0.97,
        notes: "SYNTHETIC service card 1/3",
      },
      {
        image_id: "synthetic-document-2",
        readability: 0.78,
        notes: "SYNTHETIC service card 2/3",
      },
      {
        image_id: "synthetic-document-3",
        readability: 0.92,
        notes: "SYNTHETIC service card 3/3",
      },
    ],
    events: [
      {
        event_id: "event-demo-oil",
        source_image_ids: ["synthetic-document-1"],
        raw_evidence:
          "SYNTHETIC SERVICE CARD: engine oil replaced, 100000 mi, 10.01.2025",
        service_date: {
          value: "2025-01-10",
          precision: "day",
          confidence: 0.98,
        },
        odometer: {
          value: 100_000,
          unit: "mi",
          confidence: 0.97,
        },
        actions: [
          {
            component_code: "engine_oil",
            component_label: "Engine oil",
            action_type: "replaced",
            description: "Engine oil replaced",
            confidence: 0.98,
          },
        ],
        workshop: null,
        notes: "Miles are converted using the exact factor 1.609344.",
        confidence: 0.97,
        ambiguities: [],
      },
      {
        event_id: "event-demo-ambiguous",
        source_image_ids: ["synthetic-document-2"],
        raw_evidence:
          "SYNTHETIC SERVICE CARD: brake fluid / brakes? 06.2024",
        service_date: {
          value: "2024-06",
          precision: "month",
          confidence: 0.72,
        },
        odometer: null,
        actions: [
          {
            component_code: "brake_fluid",
            component_label: "Brake fluid",
            action_type: "unknown",
            description: "The entry may mean replacement or inspection",
            confidence: 0.52,
          },
        ],
        workshop: null,
        notes: null,
        confidence: 0.55,
        ambiguities: [
          "The action type is unclear: replacement or inspection.",
          "The odometer reading is not recorded.",
        ],
      },
      {
        event_id: "event-demo-belt",
        source_image_ids: ["synthetic-document-3"],
        raw_evidence:
          "SYNTHETIC SERVICE CARD: timing belt inspected 14.02.2026, 176000 km",
        service_date: {
          value: "2026-02-14",
          precision: "day",
          confidence: 0.95,
        },
        odometer: {
          value: 176_000,
          unit: "km",
          confidence: 0.96,
        },
        actions: [
          {
            component_code: "timing_belt",
            component_label: "Timing belt",
            action_type: "inspected",
            description: "Timing belt inspected, no replacement record",
            confidence: 0.95,
          },
        ],
        workshop: null,
        notes: null,
        confidence: 0.94,
        ambiguities: [],
      },
    ],
    warnings: [
      "The action in the synthetic brake fluid entry must be reviewed.",
    ],
  },
  vehicleResolution: {
    candidates: [
      {
        candidate_id: "candidate-1",
        variant: {
          make: "Nordica",
          model: "Aurora",
          generation: "N2",
          model_year: 2021,
          engine: "1.8 hybrid N18-X, 110 kW",
          transmission: "e-CVT",
          market: "Europe",
          confidence: 0.91,
          unresolved_fields: ["transmission code"],
        },
        compatibility: "strong",
        compatibility_explanation:
          "The generation, model year, engine code, and power match, but the transmission code is missing.",
        matching_fields: ["N2", "2021", "N18-X", "110 kW", "hybrid"],
        conflicting_fields: [],
        missing_distinguishing_fields: ["transmission code"],
        sources: [
          {
            title: "SYNTHETIC Nordica Aurora N2 specifications",
            publisher: "demo.invalid",
            url: "https://vehicles.demo.invalid/nordica-aurora-n2",
            evidence:
              "The synthetic source links the N18-X engine to the N2 generation.",
          },
        ],
      },
      {
        candidate_id: "candidate-2",
        variant: {
          make: "Nordica",
          model: "Aurora",
          generation: "N2",
          model_year: 2021,
          engine: "2.0 petrol N20-P, 125 kW",
          transmission: "8-speed automatic",
          market: "Europe",
          confidence: 0.58,
          unresolved_fields: [],
        },
        compatibility: "partial",
        compatibility_explanation:
          "The generation and model year match, but the engine, power, and transmission differ.",
        matching_fields: ["N2", "2021"],
        conflicting_fields: [
          "N20-P vs. N18-X",
          "125 kW vs. 110 kW",
          "automatic vs. CVT",
        ],
        missing_distinguishing_fields: [],
        sources: [
          {
            title: "SYNTHETIC Nordica Aurora engine catalogue",
            publisher: "demo.invalid",
            url: "https://vehicles.demo.invalid/nordica-aurora-engines",
            evidence:
              "The synthetic catalogue contains an alternative petrol engine.",
          },
        ],
      },
    ],
    sources: [
      {
        title: "SYNTHETIC Nordica Aurora N2 specifications",
        publisher: "demo.invalid",
        url: "https://vehicles.demo.invalid/nordica-aurora-n2",
      },
      {
        title: "SYNTHETIC Nordica Aurora engine catalogue",
        publisher: "demo.invalid",
        url: "https://vehicles.demo.invalid/nordica-aurora-engines",
      },
    ],
    warnings: [
      "The demo contains two candidates to illustrate mandatory user selection.",
    ],
    resolved_at: "2026-07-19T10:00:00.000Z",
  },
  confirmedVehicleCandidateId: "candidate-1",
  maintenanceResearch: {
    vehicle_variant: {
      make: "Nordica",
      model: "Aurora",
      generation: "N2",
      model_year: 2021,
      engine: "1.8 hybrid N18-X, 110 kW",
      transmission: "e-CVT",
      market: "Europe",
      confidence: 0.91,
      unresolved_fields: ["transmission code"],
    },
    components: [
      {
        component_code: "engine_oil",
        component_label: "Engine oil",
        resolution: "resolved",
        interval_claims: [
          {
            claim_id: "claim-1",
            interval_km: 16_093,
            interval_months: null,
            whichever_first: false,
            conditions: "Normal use",
            original_value: 10_000,
            original_unit: "mi",
            source: {
              title: "SYNTHETIC official maintenance schedule",
              publisher: "demo.invalid",
              url: "https://maintenance.demo.invalid/nordica-aurora",
              retrieved_at: "2026-07-19",
              evidence:
                "The synthetic schedule states a 10,000-mile replacement interval for engine oil.",
            },
            authority_rank: 1,
            compatibility: "exact",
            compatibility_notes:
              "The engine, model year, and European market match.",
          },
        ],
        recommended_claim_id: "claim-1",
        conflict_summary: null,
      },
      {
        component_code: "timing_belt",
        component_label: "Timing belt",
        resolution: "conflicting_sources",
        interval_claims: [
          {
            claim_id: "claim-2",
            interval_km: 160_000,
            interval_months: null,
            whichever_first: false,
            conditions: null,
            original_value: 160_000,
            original_unit: "km",
            source: {
              title: "SYNTHETIC official workshop manual",
              publisher: "demo.invalid",
              url: "https://maintenance.demo.invalid/nordica-workshop-manual",
              retrieved_at: "2026-07-19",
              evidence:
                "The synthetic workshop manual states 160,000 kilometres.",
            },
            authority_rank: 1,
            compatibility: "exact",
            compatibility_notes: "The N18-X engine code matches.",
          },
          {
            claim_id: "claim-3",
            interval_km: 144_841,
            interval_months: null,
            whichever_first: false,
            conditions: null,
            original_value: 90_000,
            original_unit: "mi",
            source: {
              title: "SYNTHETIC official market bulletin",
              publisher: "demo.invalid",
              url: "https://maintenance.demo.invalid/nordica-bulletin",
              retrieved_at: "2026-07-19",
              evidence:
                "The synthetic market bulletin states 90,000 miles.",
            },
            authority_rank: 1,
            compatibility: "exact",
            compatibility_notes: "The N18-X engine code matches.",
          },
        ],
        recommended_claim_id: null,
        conflict_summary:
          "Two equally strong synthetic manufacturer sources state different replacement intervals. No interval was selected automatically.",
      },
      {
        component_code: "air_filter",
        component_label: "Engine air filter",
        resolution: "resolved",
        interval_claims: [
          {
            claim_id: "claim-4",
            interval_km: 30_000,
            interval_months: null,
            whichever_first: false,
            conditions: "Normal use",
            original_value: 30_000,
            original_unit: "km",
            source: {
              title: "SYNTHETIC official filter schedule",
              publisher: "demo.invalid",
              url: "https://maintenance.demo.invalid/nordica-filters",
              retrieved_at: "2026-07-19",
              evidence:
                "The synthetic schedule states 30,000 kilometres for the engine air filter.",
            },
            authority_rank: 1,
            compatibility: "exact",
            compatibility_notes: "The vehicle variant and market match.",
          },
        ],
        recommended_claim_id: "claim-4",
        conflict_summary: null,
      },
      {
        component_code: "coolant",
        component_label: "Engine coolant",
        resolution: "insufficient_evidence",
        interval_claims: [],
        recommended_claim_id: null,
        conflict_summary: null,
      },
    ],
    global_warnings: [
      "Sufficient variant-compatible evidence was not found for engine coolant.",
    ],
    researched_at: "2026-07-19T12:00:00.000Z",
  },
} satisfies DemoSessionData;
