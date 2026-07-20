import type {
  MaintenanceResearch,
  VehicleVariant,
} from "@/domain/schemas/maintenance-research";
import { ensureMaintenanceResearchCoverage } from "@/domain/maintenance/research-components";
import type {
  ServiceEvent,
  ServiceHistory,
} from "@/domain/schemas/service-history";
import type { VehicleResolution } from "@/domain/schemas/vehicle-resolution";
import {
  reconcileServiceDatePrecision,
  reconcileServiceHistoryDatePrecisions,
} from "@/domain/service-events/normalization";
import {
  createEmptyVehicleDraft,
  type VehicleFieldName,
  type VehicleFormDraft,
  type VehicleInput,
} from "@/domain/vehicle/vehicle-input";

export type SessionStatus = "empty" | "editing" | "confirmed" | "reset";
export type ExtractionStatus = "idle" | "submitting" | "success" | "error";
export type VehicleResolutionStatus =
  | "idle"
  | "submitting"
  | "success"
  | "error";
export type MaintenanceResearchStatus =
  | "idle"
  | "submitting"
  | "success"
  | "error";

export interface AnalysisSessionState {
  vehicleDraft: VehicleFormDraft;
  confirmedVehicle: VehicleInput | null;
  status: SessionStatus;
  resetVersion: number;
  serviceHistory: ServiceHistory | null;
  serviceHistoryReviewConfirmed: boolean;
  extractionStatus: ExtractionStatus;
  extractionError: string | null;
  vehicleResolution: VehicleResolution | null;
  vehicleResolutionStatus: VehicleResolutionStatus;
  vehicleResolutionError: string | null;
  confirmedVehicleCandidateId: string | null;
  confirmedVehicleVariant: VehicleVariant | null;
  vehicleResolutionRejected: boolean;
  maintenanceResearch: MaintenanceResearch | null;
  maintenanceResearchStatus: MaintenanceResearchStatus;
  maintenanceResearchError: string | null;
  demoMode: boolean;
}

export interface DemoSessionData {
  vehicle: VehicleInput;
  serviceHistory: ServiceHistory;
  vehicleResolution: VehicleResolution;
  confirmedVehicleCandidateId: string;
  maintenanceResearch: MaintenanceResearch;
}

export type AnalysisSessionAction =
  | {
      type: "update_vehicle_field";
      field: VehicleFieldName;
      value: string;
    }
  | {
      type: "confirm_vehicle";
      vehicle: VehicleInput;
    }
  | {
      type: "reset_session";
    }
  | {
      type: "begin_extraction";
    }
  | {
      type: "complete_extraction";
      serviceHistory: ServiceHistory;
    }
  | {
      type: "fail_extraction";
      message: string;
    }
  | {
      type: "clear_extraction";
    }
  | {
      type: "replace_service_history";
      serviceHistory: ServiceHistory;
    }
  | {
      type: "update_service_event";
      event: ServiceEvent;
    }
  | {
      type: "confirm_service_history_review";
    }
  | {
      type: "begin_vehicle_resolution";
    }
  | {
      type: "complete_vehicle_resolution";
      resolution: VehicleResolution;
    }
  | {
      type: "fail_vehicle_resolution";
      message: string;
    }
  | {
      type: "confirm_vehicle_candidate";
      candidateId: string;
    }
  | {
      type: "reject_vehicle_candidates";
    }
  | {
      type: "begin_maintenance_research";
    }
  | {
      type: "complete_maintenance_research";
      research: MaintenanceResearch;
    }
  | {
      type: "fail_maintenance_research";
      message: string;
    }
  | {
      type: "load_demo_session";
      demo: DemoSessionData;
    };

export function createInitialAnalysisSession(
  status: SessionStatus = "empty",
  resetVersion = 0,
): AnalysisSessionState {
  return {
    vehicleDraft: createEmptyVehicleDraft(),
    confirmedVehicle: null,
    status,
    resetVersion,
    serviceHistory: null,
    serviceHistoryReviewConfirmed: false,
    extractionStatus: "idle",
    extractionError: null,
    vehicleResolution: null,
    vehicleResolutionStatus: "idle",
    vehicleResolutionError: null,
    confirmedVehicleCandidateId: null,
    confirmedVehicleVariant: null,
    vehicleResolutionRejected: false,
    maintenanceResearch: null,
    maintenanceResearchStatus: "idle",
    maintenanceResearchError: null,
    demoMode: false,
  };
}

export function analysisSessionReducer(
  state: AnalysisSessionState,
  action: AnalysisSessionAction,
): AnalysisSessionState {
  switch (action.type) {
    case "update_vehicle_field":
      return {
        ...state,
        vehicleDraft: {
          ...state.vehicleDraft,
          [action.field]: action.value,
        },
        confirmedVehicle: null,
        serviceHistoryReviewConfirmed: false,
        status: "editing",
        vehicleResolution: null,
        vehicleResolutionStatus: "idle",
        vehicleResolutionError: null,
        confirmedVehicleCandidateId: null,
        confirmedVehicleVariant: null,
        vehicleResolutionRejected: false,
        demoMode: false,
        ...emptyMaintenanceResearch(),
      };
    case "confirm_vehicle":
      return {
        ...state,
        confirmedVehicle: action.vehicle,
        serviceHistoryReviewConfirmed: false,
        status: "confirmed",
        vehicleResolution: null,
        vehicleResolutionStatus: "idle",
        vehicleResolutionError: null,
        confirmedVehicleCandidateId: null,
        confirmedVehicleVariant: null,
        vehicleResolutionRejected: false,
        demoMode: false,
        ...emptyMaintenanceResearch(),
      };
    case "reset_session":
      return createInitialAnalysisSession("reset", state.resetVersion + 1);
    case "begin_extraction":
      return {
        ...state,
        serviceHistoryReviewConfirmed: false,
        extractionStatus: "submitting",
        extractionError: null,
        demoMode: false,
        ...emptyMaintenanceResearch(),
      };
    case "complete_extraction":
      return {
        ...state,
        serviceHistory: reconcileServiceHistoryDatePrecisions(
          action.serviceHistory,
        ),
        serviceHistoryReviewConfirmed: false,
        extractionStatus: "success",
        extractionError: null,
        demoMode: false,
        ...emptyMaintenanceResearch(),
      };
    case "fail_extraction":
      return {
        ...state,
        extractionStatus: "error",
        extractionError: action.message,
      };
    case "clear_extraction":
      return {
        ...state,
        serviceHistory: null,
        serviceHistoryReviewConfirmed: false,
        extractionStatus: "idle",
        extractionError: null,
        ...emptyMaintenanceResearch(),
      };
    case "replace_service_history":
      return {
        ...state,
        serviceHistory: reconcileServiceHistoryDatePrecisions(
          action.serviceHistory,
        ),
        serviceHistoryReviewConfirmed: false,
        ...emptyMaintenanceResearch(),
      };
    case "update_service_event":
      if (state.serviceHistory === null) {
        return state;
      }
      return {
        ...state,
        serviceHistoryReviewConfirmed: false,
        ...emptyMaintenanceResearch(),
        serviceHistory: {
          ...state.serviceHistory,
          events: state.serviceHistory.events.map((event) =>
            event.event_id === action.event.event_id
              ? {
                  ...action.event,
                  service_date: reconcileServiceDatePrecision(
                    action.event.service_date,
                  ),
                }
              : event,
          ),
        },
      };
    case "confirm_service_history_review":
      if (state.serviceHistory === null) {
        return state;
      }
      return {
        ...state,
        serviceHistoryReviewConfirmed: true,
      };
    case "begin_vehicle_resolution":
      return {
        ...state,
        vehicleResolutionStatus: "submitting",
        vehicleResolutionError: null,
        confirmedVehicleCandidateId: null,
        confirmedVehicleVariant: null,
        vehicleResolutionRejected: false,
        ...emptyMaintenanceResearch(),
      };
    case "complete_vehicle_resolution":
      return {
        ...state,
        vehicleResolution: action.resolution,
        vehicleResolutionStatus: "success",
        vehicleResolutionError: null,
        confirmedVehicleCandidateId: null,
        confirmedVehicleVariant: null,
        vehicleResolutionRejected: false,
        ...emptyMaintenanceResearch(),
      };
    case "fail_vehicle_resolution":
      return {
        ...state,
        vehicleResolutionStatus: "error",
        vehicleResolutionError: action.message,
        confirmedVehicleCandidateId: null,
        confirmedVehicleVariant: null,
        ...emptyMaintenanceResearch(),
      };
    case "confirm_vehicle_candidate": {
      const candidate = state.vehicleResolution?.candidates.find(
        (item) => item.candidate_id === action.candidateId,
      );

      if (candidate === undefined) {
        return state;
      }

      return {
        ...state,
        confirmedVehicleCandidateId: candidate.candidate_id,
        confirmedVehicleVariant: candidate.variant,
        vehicleResolutionRejected: false,
        ...emptyMaintenanceResearch(),
      };
    }
    case "reject_vehicle_candidates":
      return {
        ...state,
        confirmedVehicleCandidateId: null,
        confirmedVehicleVariant: null,
        vehicleResolutionRejected: true,
        ...emptyMaintenanceResearch(),
      };
    case "begin_maintenance_research":
      return {
        ...state,
        maintenanceResearch: null,
        maintenanceResearchStatus: "submitting",
        maintenanceResearchError: null,
      };
    case "complete_maintenance_research":
      return {
        ...state,
        maintenanceResearch:
          state.confirmedVehicle === null || state.serviceHistory === null
            ? action.research
            : ensureMaintenanceResearchCoverage(
                action.research,
                state.serviceHistory,
                state.confirmedVehicle,
              ),
        maintenanceResearchStatus: "success",
        maintenanceResearchError: null,
      };
    case "fail_maintenance_research":
      return {
        ...state,
        maintenanceResearch: null,
        maintenanceResearchStatus: "error",
        maintenanceResearchError: action.message,
      };
    case "load_demo_session": {
      const candidate = action.demo.vehicleResolution.candidates.find(
        (item) =>
          item.candidate_id === action.demo.confirmedVehicleCandidateId,
      );

      if (candidate === undefined) {
        return state;
      }

      return {
        ...createInitialAnalysisSession("confirmed", state.resetVersion),
        vehicleDraft: createVehicleDraft(action.demo.vehicle),
        confirmedVehicle: action.demo.vehicle,
        serviceHistory: reconcileServiceHistoryDatePrecisions(
          action.demo.serviceHistory,
        ),
        serviceHistoryReviewConfirmed: true,
        extractionStatus: "success",
        vehicleResolution: action.demo.vehicleResolution,
        vehicleResolutionStatus: "success",
        confirmedVehicleCandidateId: candidate.candidate_id,
        confirmedVehicleVariant: candidate.variant,
        maintenanceResearch: ensureMaintenanceResearchCoverage(
          action.demo.maintenanceResearch,
          action.demo.serviceHistory,
          action.demo.vehicle,
        ),
        maintenanceResearchStatus: "success",
        demoMode: true,
      };
    }
  }
}

function createVehicleDraft(vehicle: VehicleInput): VehicleFormDraft {
  return {
    make: vehicle.make,
    model: vehicle.model,
    generation: vehicle.generation ?? "",
    modelYear: vehicle.modelYear?.toString() ?? "",
    firstRegistrationYear: vehicle.firstRegistrationYear?.toString() ?? "",
    engineDisplacementLitres:
      vehicle.engineDisplacementLitres?.toString() ?? "",
    engineCode: vehicle.engineCode ?? "",
    powerKw: vehicle.powerKw?.toString() ?? "",
    fuelType: vehicle.fuelType ?? "",
    transmissionType: vehicle.transmissionType ?? "",
    transmissionCode: vehicle.transmissionCode ?? "",
    drivetrain: vehicle.drivetrain ?? "",
    country: vehicle.country,
    market: vehicle.market ?? "",
    currentOdometerKm: vehicle.currentOdometerKm.toString(),
    additionalDetails: vehicle.additionalDetails ?? "",
  };
}

function emptyMaintenanceResearch() {
  return {
    maintenanceResearch: null,
    maintenanceResearchStatus: "idle" as const,
    maintenanceResearchError: null,
  };
}
