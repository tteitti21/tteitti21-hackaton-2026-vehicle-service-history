import {
  createEmptyVehicleDraft,
  type VehicleFieldName,
  type VehicleFormDraft,
  type VehicleInput,
} from "@/domain/vehicle/vehicle-input";
import type {
  ServiceEvent,
  ServiceHistory,
} from "@/domain/schemas/service-history";

export type SessionStatus = "empty" | "editing" | "confirmed" | "reset";
export type ExtractionStatus = "idle" | "submitting" | "success" | "error";

export interface AnalysisSessionState {
  vehicleDraft: VehicleFormDraft;
  confirmedVehicle: VehicleInput | null;
  status: SessionStatus;
  resetVersion: number;
  serviceHistory: ServiceHistory | null;
  extractionStatus: ExtractionStatus;
  extractionError: string | null;
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
    extractionStatus: "idle",
    extractionError: null,
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
        status: "editing",
      };
    case "confirm_vehicle":
      return {
        ...state,
        confirmedVehicle: action.vehicle,
        status: "confirmed",
      };
    case "reset_session":
      return createInitialAnalysisSession("reset", state.resetVersion + 1);
    case "begin_extraction":
      return {
        ...state,
        extractionStatus: "submitting",
        extractionError: null,
      };
    case "complete_extraction":
      return {
        ...state,
        serviceHistory: action.serviceHistory,
        extractionStatus: "success",
        extractionError: null,
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
        extractionStatus: "idle",
        extractionError: null,
      };
    case "replace_service_history":
      return {
        ...state,
        serviceHistory: action.serviceHistory,
      };
    case "update_service_event":
      if (state.serviceHistory === null) {
        return state;
      }
      return {
        ...state,
        serviceHistory: {
          ...state.serviceHistory,
          events: state.serviceHistory.events.map((event) =>
            event.event_id === action.event.event_id ? action.event : event,
          ),
        },
      };
  }
}
