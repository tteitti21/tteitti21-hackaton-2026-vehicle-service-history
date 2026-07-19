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
      serviceHistory: null,
      serviceHistoryReviewConfirmed: false,
      extractionStatus: "idle",
      extractionError: null,
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

  it("tracks extraction progress, result, safe failure, and clearing in memory", () => {
    const serviceHistory = {
      images: [{ image_id: "image-1", readability: 0, notes: null }],
      events: [],
      warnings: [],
    };
    const submitting = analysisSessionReducer(createInitialAnalysisSession(), {
      type: "begin_extraction",
    });
    const completed = analysisSessionReducer(submitting, {
      type: "complete_extraction",
      serviceHistory,
    });
    const failed = analysisSessionReducer(completed, {
      type: "fail_extraction",
      message: "Safe error",
    });
    const cleared = analysisSessionReducer(failed, {
      type: "clear_extraction",
    });

    expect(submitting.extractionStatus).toBe("submitting");
    expect(completed).toMatchObject({
      extractionStatus: "success",
      serviceHistory,
      extractionError: null,
    });
    expect(failed).toMatchObject({
      extractionStatus: "error",
      extractionError: "Safe error",
      serviceHistory,
    });
    expect(cleared).toMatchObject({
      extractionStatus: "idle",
      extractionError: null,
      serviceHistory: null,
      serviceHistoryReviewConfirmed: false,
    });
  });

  it("requires review confirmation again after any service-history edit", () => {
    const serviceHistory = {
      images: [{ image_id: "image-1", readability: 1, notes: null }],
      events: [],
      warnings: [],
    };
    const completed = analysisSessionReducer(createInitialAnalysisSession(), {
      type: "complete_extraction",
      serviceHistory,
    });
    const confirmed = analysisSessionReducer(completed, {
      type: "confirm_service_history_review",
    });
    const edited = analysisSessionReducer(confirmed, {
      type: "replace_service_history",
      serviceHistory: {
        ...serviceHistory,
        warnings: ["Reviewed warning"],
      },
    });

    expect(completed.serviceHistoryReviewConfirmed).toBe(false);
    expect(confirmed.serviceHistoryReviewConfirmed).toBe(true);
    expect(edited.serviceHistoryReviewConfirmed).toBe(false);
  });

  it("cannot confirm a review before extraction exists", () => {
    const initial = createInitialAnalysisSession();

    expect(
      analysisSessionReducer(initial, {
        type: "confirm_service_history_review",
      }),
    ).toBe(initial);
  });

  it("invalidates review confirmation when vehicle data changes", () => {
    const serviceHistory = {
      images: [{ image_id: "image-1", readability: 1, notes: null }],
      events: [],
      warnings: [],
    };
    const confirmedReview = analysisSessionReducer(
      analysisSessionReducer(
        createInitialAnalysisSession(),
        { type: "complete_extraction", serviceHistory },
      ),
      { type: "confirm_service_history_review" },
    );
    const vehicleConfirmed = analysisSessionReducer(confirmedReview, {
      type: "confirm_vehicle",
      vehicle: confirmedVehicle,
    });
    const vehicleEdited = analysisSessionReducer(vehicleConfirmed, {
      type: "update_vehicle_field",
      field: "currentOdometerKm",
      value: "185000",
    });

    expect(vehicleConfirmed.serviceHistoryReviewConfirmed).toBe(false);
    expect(vehicleEdited.serviceHistoryReviewConfirmed).toBe(false);
  });
});
