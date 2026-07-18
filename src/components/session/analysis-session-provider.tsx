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

interface AnalysisSessionContextValue {
  state: AnalysisSessionState;
  updateVehicleField: (field: VehicleFieldName, value: string) => void;
  confirmVehicle: (vehicle: VehicleInput) => void;
  resetSession: () => void;
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

  const value = useMemo(
    () => ({
      state,
      updateVehicleField,
      confirmVehicle,
      resetSession,
    }),
    [confirmVehicle, resetSession, state, updateVehicleField],
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
