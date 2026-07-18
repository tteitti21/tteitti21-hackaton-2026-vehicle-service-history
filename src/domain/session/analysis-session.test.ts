import { describe, expect, it } from "vitest";

import {
  analysisSessionReducer,
  createInitialAnalysisSession,
} from "./analysis-session";
import {
  createEmptyVehicleDraft,
  createVehicleInputSchema,
} from "../vehicle/vehicle-input";

const confirmedVehicle = createVehicleInputSchema(2026).parse({
  ...createEmptyVehicleDraft(),
  make: "Toyota",
  model: "Avensis",
  currentOdometerKm: "184000",
});

describe("analysis session reducer", () => {
  it("starts with only default in-memory draft values", () => {
    expect(createInitialAnalysisSession()).toEqual({
      vehicleDraft: createEmptyVehicleDraft(),
      confirmedVehicle: null,
      status: "empty",
      resetVersion: 0,
    });
  });

  it("updates the draft and invalidates an earlier confirmation", () => {
    const confirmedState = analysisSessionReducer(
      createInitialAnalysisSession(),
      { type: "confirm_vehicle", vehicle: confirmedVehicle },
    );
    const editedState = analysisSessionReducer(confirmedState, {
      type: "update_vehicle_field",
      field: "model",
      value: "Corolla",
    });

    expect(editedState.vehicleDraft.model).toBe("Corolla");
    expect(editedState.confirmedVehicle).toBeNull();
    expect(editedState.status).toBe("editing");
  });

  it("stores a validated vehicle in the current memory state", () => {
    const state = analysisSessionReducer(createInitialAnalysisSession(), {
      type: "confirm_vehicle",
      vehicle: confirmedVehicle,
    });

    expect(state.confirmedVehicle).toEqual(confirmedVehicle);
    expect(state.status).toBe("confirmed");
  });

  it("resets all session values without a persistent fallback", () => {
    const editedState = analysisSessionReducer(createInitialAnalysisSession(), {
      type: "update_vehicle_field",
      field: "make",
      value: "Toyota",
    });
    const resetState = analysisSessionReducer(editedState, {
      type: "reset_session",
    });

    expect(resetState).toEqual(createInitialAnalysisSession("reset", 1));
  });
});
