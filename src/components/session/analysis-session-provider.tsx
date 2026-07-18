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
    }),
    [
      beginExtraction,
      clearExtraction,
      completeExtraction,
      confirmVehicle,
      failExtraction,
      replaceServiceHistory,
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
