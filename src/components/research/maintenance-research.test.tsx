import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AnalysisSessionProvider,
  useAnalysisSession,
} from "@/components/session/analysis-session-provider";
import {
  maintenanceResearchFixture,
} from "@/test/maintenance-research-fixture";
import {
  confirmedVehicleFixture,
  vehicleResolutionFixture,
} from "@/test/vehicle-resolution-fixture";
import { MaintenanceResearchPanel } from "./maintenance-research";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MaintenanceResearchPanel", () => {
  it("waits for an explicitly confirmed vehicle variant", async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(
      screen.getByText(/Maintenance interval research is waiting for a confirmed variant/),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Research maintenance intervals online" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Prepare Phase 6" }));
    expect(
      screen.getByRole("button", { name: "Research maintenance intervals online" }),
    ).toBeEnabled();
  });

  it("shows preserved sources, conflicts, and insufficient evidence", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(maintenanceResearchFixture), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Prepare Phase 6" }));
    await user.click(
      screen.getByRole("button", { name: "Research maintenance intervals online" }),
    );

    expect(await screen.findByText("Source found")).toBeVisible();
    expect(screen.getByText("Conflicting sources")).toBeVisible();
    expect(screen.getAllByText("Insufficient evidence")[0]).toBeVisible();
    expect(
      screen.getByText(/No interval was selected automatically/),
    ).toBeVisible();
    expect(
      screen.getAllByText(/The exact replacement interval could not be verified/)[0],
    ).toBeVisible();
    expect(
      screen.getAllByRole("link", {
        name: "Official maintenance schedule",
      })[0],
    ).toHaveAttribute("href", "https://manufacturer.example/maintenance");
    expect(screen.getAllByText("High (high)")[0]).toBeVisible();

    const body = JSON.parse(
      vi.mocked(fetchMock).mock.calls[0]?.[1]?.body as string,
    ) as Record<string, unknown>;
    expect(body.current_odometer_km).toBe(184_000);
    expect(body.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ component_code: "engine_oil" }),
        expect.objectContaining({ component_code: "oil_filter" }),
        expect.objectContaining({ component_code: "transmission_fluid" }),
        expect.objectContaining({ component_code: "brake_fluid" }),
        expect.objectContaining({ component_code: "fuel_filter" }),
        expect.objectContaining({ component_code: "air_filter" }),
        expect.objectContaining({ component_code: "cabin_filter" }),
        expect.objectContaining({ component_code: "coolant" }),
      ]),
    );
    expect(JSON.stringify(body)).not.toContain("Battery replaced in 2024");
    expect(JSON.stringify(body)).not.toContain("image-1");
  });
});

function renderPanel() {
  return render(
    <AnalysisSessionProvider>
      <SessionControls />
      <MaintenanceResearchPanel />
    </AnalysisSessionProvider>,
  );
}

function SessionControls() {
  const {
    confirmVehicle,
    completeExtraction,
    confirmServiceHistoryReview,
    completeVehicleResolution,
    confirmVehicleCandidate,
  } = useAnalysisSession();

  return (
    <button
      type="button"
      onClick={() => {
        confirmVehicle(confirmedVehicleFixture);
        completeExtraction({
          images: [
            { image_id: "image-1", readability: 1, notes: null },
          ],
          events: [
            {
              event_id: "event-1",
              source_image_ids: ["image-1"],
              raw_evidence: "Battery replaced in 2024",
              service_date: null,
              odometer: null,
              actions: [
                {
                  component_code: "battery",
                  component_label: "Battery",
                  action_type: "replaced",
                  description: "Battery replaced",
                  confidence: 1,
                },
              ],
              workshop: null,
              notes: null,
              confidence: 1,
              ambiguities: [],
            },
          ],
          warnings: [],
        });
        confirmServiceHistoryReview();
        completeVehicleResolution(vehicleResolutionFixture);
        confirmVehicleCandidate("candidate-1");
      }}
    >
      Prepare Phase 6
    </button>
  );
}
