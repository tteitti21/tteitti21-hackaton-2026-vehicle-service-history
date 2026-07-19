import type {
  MaintenanceResearch,
  VehicleVariant,
} from "@/domain/schemas/maintenance-research";
import type {
  ServiceEvent,
  ServiceHistory,
} from "@/domain/schemas/service-history";
import type { VehicleResolution } from "@/domain/schemas/vehicle-resolution";
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
        ...emptyMaintenanceResearch(),
      };
    case "complete_extraction":
      return {
        ...state,
        serviceHistory: action.serviceHistory,
        serviceHistoryReviewConfirmed: false,
        extractionStatus: "success",
        extractionError: null,
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
        serviceHistory: action.serviceHistory,
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
            event.event_id === action.event.event_id ? action.event : event,
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
        maintenanceResearch: action.research,
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
  }
}

function emptyMaintenanceResearch() {
  return {
    maintenanceResearch: null,
    maintenanceResearchStatus: "idle" as const,
    maintenanceResearchError: null,
  };
}
