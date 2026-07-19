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
    market: "Eurooppa",
    currentOdometerKm: 180_000,
    additionalDetails:
      "SYNTEETTINEN DEMO – tiedot eivät kuvaa todellista ajoneuvoa.",
  },
  serviceHistory: {
    images: [
      {
        image_id: "synthetic-document-1",
        readability: 0.97,
        notes: "SYNTEETTINEN huoltokortti 1/3",
      },
      {
        image_id: "synthetic-document-2",
        readability: 0.78,
        notes: "SYNTEETTINEN huoltokortti 2/3",
      },
      {
        image_id: "synthetic-document-3",
        readability: 0.92,
        notes: "SYNTEETTINEN huoltokortti 3/3",
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
            component_label: "Moottoriöljy",
            action_type: "replaced",
            description: "Moottoriöljy vaihdettu",
            confidence: 0.98,
          },
        ],
        workshop: null,
        notes: "Mailit muunnetaan tarkalla kertoimella 1.609344.",
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
            component_label: "Jarruneste",
            action_type: "unknown",
            description: "Merkintä voi tarkoittaa vaihtoa tai tarkastusta",
            confidence: 0.52,
          },
        ],
        workshop: null,
        notes: null,
        confidence: 0.55,
        ambiguities: [
          "Toimenpiteen laji on epäselvä: vaihto vai tarkastus.",
          "Mittarilukemaa ei ole merkitty.",
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
            component_label: "Jakohihna",
            action_type: "inspected",
            description: "Jakohihna tarkastettu, ei vaihtomerkintää",
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
      "Synteettisen jarrunestemerkinnän toimenpide on tarkistettava.",
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
          market: "Eurooppa",
          confidence: 0.91,
          unresolved_fields: ["vaihteistokoodi"],
        },
        compatibility: "strong",
        compatibility_explanation:
          "Sukupolvi, mallivuosi, moottorikoodi ja teho täsmäävät, mutta vaihteistokoodi puuttuu.",
        matching_fields: ["N2", "2021", "N18-X", "110 kW", "hybrid"],
        conflicting_fields: [],
        missing_distinguishing_fields: ["vaihteistokoodi"],
        sources: [
          {
            title: "SYNTHETIC Nordica Aurora N2 specifications",
            publisher: "demo.invalid",
            url: "https://vehicles.demo.invalid/nordica-aurora-n2",
            evidence:
              "Synteettinen lähde yhdistää N18-X-moottorin N2-sukupolveen.",
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
          transmission: "8-vaihteinen automaatti",
          market: "Eurooppa",
          confidence: 0.58,
          unresolved_fields: [],
        },
        compatibility: "partial",
        compatibility_explanation:
          "Sukupolvi ja mallivuosi täsmäävät, mutta moottori, teho ja vaihteisto poikkeavat.",
        matching_fields: ["N2", "2021"],
        conflicting_fields: [
          "N20-P vs. N18-X",
          "125 kW vs. 110 kW",
          "automaatti vs. CVT",
        ],
        missing_distinguishing_fields: [],
        sources: [
          {
            title: "SYNTHETIC Nordica Aurora engine catalogue",
            publisher: "demo.invalid",
            url: "https://vehicles.demo.invalid/nordica-aurora-engines",
            evidence:
              "Synteettinen luettelo sisältää vaihtoehtoisen bensiinimoottorin.",
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
      "Demo sisältää kaksi ehdokasta havainnollistamaan pakollista käyttäjävalintaa.",
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
      market: "Eurooppa",
      confidence: 0.91,
      unresolved_fields: ["vaihteistokoodi"],
    },
    components: [
      {
        component_code: "engine_oil",
        component_label: "Moottoriöljy",
        resolution: "resolved",
        interval_claims: [
          {
            claim_id: "claim-1",
            interval_km: 16_093,
            interval_months: null,
            whichever_first: false,
            conditions: "Normaali käyttö",
            original_value: 10_000,
            original_unit: "mi",
            source: {
              title: "SYNTHETIC official maintenance schedule",
              publisher: "demo.invalid",
              url: "https://maintenance.demo.invalid/nordica-aurora",
              retrieved_at: "2026-07-19",
              evidence:
                "Synteettinen ohjelma ilmoittaa moottoriöljylle 10 000 mailin vaihtovälin.",
            },
            authority_rank: 1,
            compatibility: "exact",
            compatibility_notes:
              "Moottori, mallivuosi ja Euroopan markkina täsmäävät.",
          },
        ],
        recommended_claim_id: "claim-1",
        conflict_summary: null,
      },
      {
        component_code: "timing_belt",
        component_label: "Jakohihna",
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
                "Synteettinen korjaamokäsikirja ilmoittaa 160 000 kilometriä.",
            },
            authority_rank: 1,
            compatibility: "exact",
            compatibility_notes: "N18-X-moottorikoodi täsmää.",
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
                "Synteettinen markkinatiedote ilmoittaa 90 000 mailia.",
            },
            authority_rank: 1,
            compatibility: "exact",
            compatibility_notes: "N18-X-moottorikoodi täsmää.",
          },
        ],
        recommended_claim_id: null,
        conflict_summary:
          "Kaksi yhtä vahvaa synteettistä valmistajalähdettä ilmoittaa eri vaihtovälin. Väliä ei valittu automaattisesti.",
      },
      {
        component_code: "air_filter",
        component_label: "Ilmansuodatin",
        resolution: "resolved",
        interval_claims: [
          {
            claim_id: "claim-4",
            interval_km: 30_000,
            interval_months: null,
            whichever_first: false,
            conditions: "Normaali käyttö",
            original_value: 30_000,
            original_unit: "km",
            source: {
              title: "SYNTHETIC official filter schedule",
              publisher: "demo.invalid",
              url: "https://maintenance.demo.invalid/nordica-filters",
              retrieved_at: "2026-07-19",
              evidence:
                "Synteettinen ohjelma ilmoittaa ilmansuodattimelle 30 000 kilometriä.",
            },
            authority_rank: 1,
            compatibility: "exact",
            compatibility_notes: "Ajoneuvoversio ja markkina täsmäävät.",
          },
        ],
        recommended_claim_id: "claim-4",
        conflict_summary: null,
      },
      {
        component_code: "coolant",
        component_label: "Jäähdytysneste",
        resolution: "insufficient_evidence",
        interval_claims: [],
        recommended_claim_id: null,
        conflict_summary: null,
      },
    ],
    global_warnings: [
      "Jäähdytysnesteelle ei löytynyt riittävää, varianttiin sopivaa näyttöä.",
    ],
    researched_at: "2026-07-19T12:00:00.000Z",
  },
} satisfies DemoSessionData;
