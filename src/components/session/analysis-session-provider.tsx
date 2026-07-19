"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

import {
  analysisSessionReducer,
  createInitialAnalysisSession,
  type AnalysisSessionState,
} from "@/domain/session/analysis-session";
import type {
  VehicleFieldName,
  VehicleInput,
} from "@/domain/vehicle/vehicle-input";
import type {
  ServiceEvent,
  ServiceHistory,
} from "@/domain/schemas/service-history";
import type { VehicleResolution } from "@/domain/schemas/vehicle-resolution";

interface AnalysisSessionContextValue {
  state: AnalysisSessionState;
  updateVehicleField: (field: VehicleFieldName, value: string) => void;
  confirmVehicle: (vehicle: VehicleInput) => void;
  resetSession: () => void;
  beginExtraction: () => void;
  completeExtraction: (serviceHistory: ServiceHistory) => void;
  failExtraction: (message: string) => void;
  clearExtraction: () => void;
  replaceServiceHistory: (serviceHistory: ServiceHistory) => void;
  updateServiceEvent: (event: ServiceEvent) => void;
  confirmServiceHistoryReview: () => void;
  beginVehicleResolution: () => void;
  completeVehicleResolution: (resolution: VehicleResolution) => void;
  failVehicleResolution: (message: string) => void;
  confirmVehicleCandidate: (candidateId: string) => void;
  rejectVehicleCandidates: () => void;
}

const AnalysisSessionContext =
  createContext<AnalysisSessionContextValue | null>(null);

export function AnalysisSessionProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [state, dispatch] = useReducer(
    analysisSessionReducer,
    undefined,
    createInitialAnalysisSession,
  );

  const updateVehicleField = useCallback(
    (field: VehicleFieldName, value: string) => {
      dispatch({ type: "update_vehicle_field", field, value });
    },
    [],
  );

  const confirmVehicle = useCallback((vehicle: VehicleInput) => {
    dispatch({ type: "confirm_vehicle", vehicle });
  }, []);

  const resetSession = useCallback(() => {
    dispatch({ type: "reset_session" });
  }, []);

  const beginExtraction = useCallback(() => {
    dispatch({ type: "begin_extraction" });
  }, []);

  const completeExtraction = useCallback((serviceHistory: ServiceHistory) => {
    dispatch({ type: "complete_extraction", serviceHistory });
  }, []);

  const failExtraction = useCallback((message: string) => {
    dispatch({ type: "fail_extraction", message });
  }, []);

  const clearExtraction = useCallback(() => {
    dispatch({ type: "clear_extraction" });
  }, []);

  const replaceServiceHistory = useCallback(
    (serviceHistory: ServiceHistory) => {
      dispatch({ type: "replace_service_history", serviceHistory });
    },
    [],
  );

  const updateServiceEvent = useCallback((event: ServiceEvent) => {
    dispatch({ type: "update_service_event", event });
  }, []);

  const confirmServiceHistoryReview = useCallback(() => {
    dispatch({ type: "confirm_service_history_review" });
  }, []);

  const beginVehicleResolution = useCallback(() => {
    dispatch({ type: "begin_vehicle_resolution" });
  }, []);

  const completeVehicleResolution = useCallback(
    (resolution: VehicleResolution) => {
      dispatch({ type: "complete_vehicle_resolution", resolution });
    },
    [],
  );

  const failVehicleResolution = useCallback((message: string) => {
    dispatch({ type: "fail_vehicle_resolution", message });
  }, []);

  const confirmVehicleCandidate = useCallback((candidateId: string) => {
    dispatch({ type: "confirm_vehicle_candidate", candidateId });
  }, []);

  const rejectVehicleCandidates = useCallback(() => {
    dispatch({ type: "reject_vehicle_candidates" });
  }, []);

  const value = useMemo(
    () => ({
      state,
      updateVehicleField,
      confirmVehicle,
      resetSession,
      beginExtraction,
      completeExtraction,
      failExtraction,
      clearExtraction,
      replaceServiceHistory,
      updateServiceEvent,
      confirmServiceHistoryReview,
      beginVehicleResolution,
      completeVehicleResolution,
      failVehicleResolution,
      confirmVehicleCandidate,
      rejectVehicleCandidates,
    }),
    [
      beginVehicleResolution,
      beginExtraction,
      clearExtraction,
      completeExtraction,
      completeVehicleResolution,
      confirmServiceHistoryReview,
      confirmVehicleCandidate,
      confirmVehicle,
      failExtraction,
      failVehicleResolution,
      replaceServiceHistory,
      rejectVehicleCandidates,
      resetSession,
      state,
      updateServiceEvent,
      updateVehicleField,
    ],
  );

  return (
    <AnalysisSessionContext.Provider value={value}>
      {children}
    </AnalysisSessionContext.Provider>
  );
}

export function useAnalysisSession(): AnalysisSessionContextValue {
  const context = useContext(AnalysisSessionContext);

  if (context === null) {
    throw new Error(
      "useAnalysisSession must be used inside AnalysisSessionProvider.",
    );
  }

  return context;
}
