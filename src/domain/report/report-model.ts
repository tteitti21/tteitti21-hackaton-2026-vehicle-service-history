import type {
  ComponentStatusReasonCode,
  ComponentStatusValue,
} from "@/domain/schemas/component-status";
import { ensureMaintenanceResearchCoverage } from "@/domain/maintenance/research-components";
import {
  assessComponentTrustworthiness,
  assessSourceTrustworthiness,
  TRUSTWORTHINESS_LABELS_FI,
  type TrustworthinessLevel,
} from "@/domain/maintenance/source-hierarchy";
import type {
  MaintenanceResearch,
  VehicleVariant,
} from "@/domain/schemas/maintenance-research";
import type {
  ComponentCode,
  ServiceAction,
  ServiceHistory,
} from "@/domain/schemas/service-history";
import type {
  VehicleCandidate,
  VehicleResolution,
} from "@/domain/schemas/vehicle-resolution";
import { normalizeOdometer } from "@/domain/service-events/normalization";
import { calculateComponentStatusSummary } from "@/domain/status-engine/status-engine";
import type { VehicleInput } from "@/domain/vehicle/vehicle-input";

export const REPORT_SCHEMA_VERSION = "1.1";

export const REPORT_STATUS_LABELS_FI: Record<ComponentStatusValue, string> = {
  ok: "Kunnossa",
  due_soon: "Lähestyy",
  due: "Ajankohtainen",
  overdue: "Myöhässä",
  unknown: "Epäselvä",
  insufficient_evidence: "Ei riittävää tietoa",
  conflicting_sources: "Lähteissä ristiriita",
};

export const REPORT_COMPATIBILITY_LABELS_FI = {
  exact: "Tarkka",
  strong: "Vahva",
  partial: "Osittainen",
  weak: "Heikko",
  unknown: "Tuntematon",
} as const;

export const REPORT_RESOLUTION_LABELS_FI = {
  resolved: "Lähde varmennettu",
  conflicting_sources: "Lähteissä ristiriita",
  insufficient_evidence: "Ei riittävää tietoa",
} as const;

export interface ReportModelInput {
  confirmedVehicle: VehicleInput;
  confirmedVehicleCandidateId: string;
  vehicleResolution: VehicleResolution;
  serviceHistory: ServiceHistory;
  maintenanceResearch: MaintenanceResearch;
  generatedAt: Date;
}

export interface VehicleReportModel {
  metadata: {
    schema_version: typeof REPORT_SCHEMA_VERSION;
    generated_at: string;
    analysis_date: string;
    distance_unit: "km";
    local_export: true;
    images_included: false;
    disclaimer_fi: string;
  };
  vehicle: {
    make: string;
    model: string;
    generation: string | null;
    model_year: number | null;
    first_registration_year: number | null;
    engine_displacement_litres: number | null;
    engine_code: string | null;
    power_kw: number | null;
    fuel_type: string | null;
    transmission_type: string | null;
    transmission_code: string | null;
    drivetrain: string | null;
    country: string;
    market: string | null;
    current_odometer_km: number;
    additional_details: string | null;
    resolved_variant: VehicleVariant;
    resolution: ReportVehicleResolution;
  };
  summary: {
    service_event_count: number;
    component_count: number;
    source_count: number;
    highest_priority_status: ComponentStatusValue | null;
    status_counts: Record<ComponentStatusValue, number>;
  };
  service_history: ReportServiceEvent[];
  components: ReportComponent[];
  sources: ReportSource[];
  warnings: {
    service_history: string[];
    vehicle_resolution: string[];
    maintenance_research: string[];
  };
}

export interface ReportVehicleResolution {
  candidate_id: string;
  compatibility: VehicleCandidate["compatibility"];
  compatibility_explanation: string;
  matching_fields: string[];
  conflicting_fields: string[];
  missing_distinguishing_fields: string[];
  unresolved_variant_fields: string[];
  sources: Array<{
    title: string;
    publisher: string | null;
    url: string;
    evidence: string;
  }>;
}

export interface ReportServiceEvent {
  event_id: string;
  source_image_ids: string[];
  raw_evidence: string;
  service_date: {
    value: string;
    precision: "day" | "month" | "year" | "unknown";
    confidence: number;
  } | null;
  odometer_km: number | null;
  original_odometer_value: number | null;
  original_odometer_unit: "km" | "mi" | "unknown" | null;
  odometer_confidence: number | null;
  actions: ServiceAction[];
  workshop: string | null;
  notes: string | null;
  confidence: number;
  ambiguities: string[];
}

export interface ReportComponent {
  component_code: ComponentCode;
  component_label: string;
  status: ComponentStatusValue;
  status_label_fi: string;
  reason_codes: ComponentStatusReasonCode[];
  resolution: "resolved" | "conflicting_sources" | "insufficient_evidence";
  conflict_summary: string | null;
  trustworthiness_level: TrustworthinessLevel;
  trustworthiness_label_fi: string;
  trustworthiness_note_fi: string;
  maintenance_suggestion_fi: string;
  service_history_note_fi: string;
  interval_claim_count: number;
  recommended_claim_id: string | null;
  recommended_interval_km: number | null;
  recommended_interval_months: number | null;
  whichever_first: boolean | null;
  conditions: string | null;
  last_service_event_id: string | null;
  distance_used_km: number | null;
  distance_remaining_km: number | null;
  months_used: number | null;
  months_remaining: number | null;
  due_odometer_km: number | null;
  due_date: string | null;
}

export interface ReportSource {
  source_id: string;
  source_scope: "vehicle_resolution" | "maintenance_interval";
  component_code: ComponentCode | null;
  component_label: string | null;
  claim_id: string | null;
  recommended: boolean | null;
  interval_km: number | null;
  interval_months: number | null;
  whichever_first: boolean | null;
  conditions: string | null;
  original_value: number | null;
  original_unit: "km" | "mi" | "months" | "years" | "mixed" | null;
  authority_rank: number | null;
  trustworthiness_level: TrustworthinessLevel;
  trustworthiness_label_fi: string;
  trustworthiness_note_fi: string;
  compatibility:
    | "exact"
    | "strong"
    | "partial"
    | "weak"
    | "unknown";
  compatibility_notes: string;
  title: string;
  publisher: string | null;
  url: string;
  retrieved_at: string | null;
  evidence: string;
}

export function createVehicleReportModel(
  input: ReportModelInput,
): VehicleReportModel {
  if (Number.isNaN(input.generatedAt.getTime())) {
    throw new RangeError("Report generation date must be valid.");
  }

  const candidate = input.vehicleResolution.candidates.find(
    (item) => item.candidate_id === input.confirmedVehicleCandidateId,
  );
  if (candidate === undefined) {
    throw new RangeError("Confirmed vehicle candidate is unavailable.");
  }

  const maintenanceResearch = ensureMaintenanceResearchCoverage(
    input.maintenanceResearch,
    input.serviceHistory,
    input.confirmedVehicle,
  );
  const statusSummary = calculateComponentStatusSummary({
    research: maintenanceResearch,
    serviceHistory: input.serviceHistory,
    currentOdometerKm: input.confirmedVehicle.currentOdometerKm,
    analysisDate: new Date(maintenanceResearch.researched_at),
  });
  const statusByComponent = new Map(
    statusSummary.statuses.map((status) => [status.component_code, status]),
  );
  const sources = createReportSources(candidate, maintenanceResearch);

  return {
    metadata: {
      schema_version: REPORT_SCHEMA_VERSION,
      generated_at: input.generatedAt.toISOString(),
      analysis_date: statusSummary.analysisDate,
      distance_unit: "km",
      local_export: true,
      images_included: false,
      disclaimer_fi:
        "Raportti ei korvaa valmistajan huolto-ohjelmaa, kuntotarkastusta tai ammattilaisen arviota.",
    },
    vehicle: {
      make: input.confirmedVehicle.make,
      model: input.confirmedVehicle.model,
      generation: input.confirmedVehicle.generation ?? null,
      model_year: input.confirmedVehicle.modelYear ?? null,
      first_registration_year:
        input.confirmedVehicle.firstRegistrationYear ?? null,
      engine_displacement_litres:
        input.confirmedVehicle.engineDisplacementLitres ?? null,
      engine_code: input.confirmedVehicle.engineCode ?? null,
      power_kw: input.confirmedVehicle.powerKw ?? null,
      fuel_type: input.confirmedVehicle.fuelType ?? null,
      transmission_type: input.confirmedVehicle.transmissionType ?? null,
      transmission_code: input.confirmedVehicle.transmissionCode ?? null,
      drivetrain: input.confirmedVehicle.drivetrain ?? null,
      country: input.confirmedVehicle.country,
      market: input.confirmedVehicle.market ?? null,
      current_odometer_km: input.confirmedVehicle.currentOdometerKm,
      additional_details: input.confirmedVehicle.additionalDetails ?? null,
      resolved_variant: cloneVehicleVariant(candidate.variant),
      resolution: {
        candidate_id: candidate.candidate_id,
        compatibility: candidate.compatibility,
        compatibility_explanation: candidate.compatibility_explanation,
        matching_fields: [...candidate.matching_fields],
        conflicting_fields: [...candidate.conflicting_fields],
        missing_distinguishing_fields: [
          ...candidate.missing_distinguishing_fields,
        ],
        unresolved_variant_fields: [...candidate.variant.unresolved_fields],
        sources: candidate.sources.map((source) => ({ ...source })),
      },
    },
    summary: {
      service_event_count: input.serviceHistory.events.length,
      component_count: maintenanceResearch.components.length,
      source_count: sources.length,
      highest_priority_status: statusSummary.highestPriorityStatus,
      status_counts: { ...statusSummary.counts },
    },
    service_history: input.serviceHistory.events.map((event) => {
      const odometer = normalizeOdometer(event.odometer);
      return {
        event_id: event.event_id,
        source_image_ids: [...event.source_image_ids],
        raw_evidence: event.raw_evidence,
        service_date:
          event.service_date === null ? null : { ...event.service_date },
        odometer_km:
          odometer.status === "valid" ? odometer.kilometres : null,
        original_odometer_value: odometer.originalValue,
        original_odometer_unit: odometer.originalUnit,
        odometer_confidence: event.odometer?.confidence ?? null,
        actions: event.actions.map((action) => ({ ...action })),
        workshop: event.workshop,
        notes: event.notes,
        confidence: event.confidence,
        ambiguities: [...event.ambiguities],
      };
    }),
    components: maintenanceResearch.components.map((component) => {
      const status = statusByComponent.get(component.component_code);
      if (status === undefined) {
        throw new RangeError(
          `Status is unavailable for ${component.component_code}.`,
        );
      }
      const recommendedClaim = component.interval_claims.find(
        (claim) => claim.claim_id === component.recommended_claim_id,
      );
      const trustworthiness = assessComponentTrustworthiness(component);

      return {
        component_code: component.component_code,
        component_label: component.component_label,
        status: status.status,
        status_label_fi: REPORT_STATUS_LABELS_FI[status.status],
        reason_codes: [...status.reason_codes],
        resolution: component.resolution,
        conflict_summary: component.conflict_summary,
        trustworthiness_level: trustworthiness.level,
        trustworthiness_label_fi:
          TRUSTWORTHINESS_LABELS_FI[trustworthiness.level],
        trustworthiness_note_fi: trustworthiness.note_fi,
        maintenance_suggestion_fi:
          createMaintenanceSuggestion(component),
        service_history_note_fi:
          status.last_service_event_id === null
            ? "Huoltohistoriasta ei löytynyt merkintää."
            : `Viimeisin laskennassa käytetty merkintä: ${status.last_service_event_id}.`,
        interval_claim_count: component.interval_claims.length,
        recommended_claim_id: component.recommended_claim_id,
        recommended_interval_km: recommendedClaim?.interval_km ?? null,
        recommended_interval_months:
          recommendedClaim?.interval_months ?? null,
        whichever_first: recommendedClaim?.whichever_first ?? null,
        conditions: recommendedClaim?.conditions ?? null,
        last_service_event_id: status.last_service_event_id,
        distance_used_km: status.distance_used_km,
        distance_remaining_km: status.distance_remaining_km,
        months_used: status.months_used,
        months_remaining: status.months_remaining,
        due_odometer_km: status.due_odometer_km,
        due_date: status.due_date,
      };
    }),
    sources,
    warnings: {
      service_history: [...input.serviceHistory.warnings],
      vehicle_resolution: [...input.vehicleResolution.warnings],
      maintenance_research: [...maintenanceResearch.global_warnings],
    },
  };
}

function createReportSources(
  candidate: VehicleCandidate,
  research: MaintenanceResearch,
): ReportSource[] {
  const vehicleTrustworthiness = assessSourceTrustworthiness(
    null,
    candidate.compatibility,
  );
  const vehicleSources: ReportSource[] = candidate.sources.map(
    (source, index) => ({
      source_id: `vehicle-${candidate.candidate_id}-${index + 1}`,
      source_scope: "vehicle_resolution",
      component_code: null,
      component_label: null,
      claim_id: null,
      recommended: null,
      interval_km: null,
      interval_months: null,
      whichever_first: null,
      conditions: null,
      original_value: null,
      original_unit: null,
      authority_rank: null,
      trustworthiness_level: vehicleTrustworthiness.level,
      trustworthiness_label_fi:
        TRUSTWORTHINESS_LABELS_FI[vehicleTrustworthiness.level],
      trustworthiness_note_fi: vehicleTrustworthiness.note_fi,
      compatibility: candidate.compatibility,
      compatibility_notes: candidate.compatibility_explanation,
      title: source.title,
      publisher: source.publisher,
      url: source.url,
      retrieved_at: null,
      evidence: source.evidence,
    }),
  );
  const maintenanceSources = research.components.flatMap((component) =>
    component.interval_claims.map(
      (claim): ReportSource => {
        const trustworthiness = assessSourceTrustworthiness(
          claim.authority_rank,
          claim.compatibility,
        );
        return {
          source_id: `maintenance-${claim.claim_id}`,
          source_scope: "maintenance_interval",
          component_code: component.component_code,
          component_label: component.component_label,
          claim_id: claim.claim_id,
          recommended: component.recommended_claim_id === claim.claim_id,
          interval_km: claim.interval_km,
          interval_months: claim.interval_months,
          whichever_first: claim.whichever_first,
          conditions: claim.conditions,
          original_value: claim.original_value,
          original_unit: claim.original_unit,
          authority_rank: claim.authority_rank,
          trustworthiness_level: trustworthiness.level,
          trustworthiness_label_fi:
            TRUSTWORTHINESS_LABELS_FI[trustworthiness.level],
          trustworthiness_note_fi: trustworthiness.note_fi,
          compatibility: claim.compatibility,
          compatibility_notes: claim.compatibility_notes,
          title: claim.source.title,
          publisher: claim.source.publisher,
          url: claim.source.url,
          retrieved_at: claim.source.retrieved_at,
          evidence: claim.source.evidence,
        };
      },
    ),
  );

  return [...vehicleSources, ...maintenanceSources];
}

function createMaintenanceSuggestion(
  component: MaintenanceResearch["components"][number],
): string {
  if (component.resolution === "insufficient_evidence") {
    return "Tarkkaa vaihtoväliä ei voitu varmistaa riittävän luotettavista, tähän ajoneuvovarianttiin sopivista lähteistä.";
  }

  if (component.resolution === "conflicting_sources") {
    const claims = component.interval_claims
      .map(
        (claim) =>
          `${claim.claim_id}: ${formatClaimInterval(claim.interval_km, claim.interval_months, claim.whichever_first)}`,
      )
      .join(" | ");
    return `${component.conflict_summary ?? "Lähteissä on ratkaisematon ristiriita."} Säilytetyt väitteet: ${claims}.`;
  }

  const claim = component.interval_claims.find(
    (candidate) => candidate.claim_id === component.recommended_claim_id,
  );
  if (claim === undefined) {
    return "Valittua huoltoväliväitettä ei löytynyt.";
  }

  const conditions =
    claim.conditions === null ? "Ei erillisiä käyttöehtoja." : claim.conditions;
  return `${formatClaimInterval(claim.interval_km, claim.interval_months, claim.whichever_first)}. ${conditions}`;
}

function formatClaimInterval(
  intervalKm: number | null,
  intervalMonths: number | null,
  whicheverFirst: boolean,
): string {
  const values = [
    intervalKm === null ? null : `${intervalKm} km`,
    intervalMonths === null ? null : `${intervalMonths} kk`,
  ].filter((value): value is string => value !== null);

  return values.join(whicheverFirst ? " tai " : " + ");
}

function cloneVehicleVariant(variant: VehicleVariant): VehicleVariant {
  return {
    ...variant,
    unresolved_fields: [...variant.unresolved_fields],
  };
}
