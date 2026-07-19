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
      screen.getByText(/Huoltovälitutkimus odottaa vahvistettua versiota/),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Tutki huoltovälit verkosta" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Valmistele vaihe 6" }));
    expect(
      screen.getByRole("button", { name: "Tutki huoltovälit verkosta" }),
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
    await user.click(screen.getByRole("button", { name: "Valmistele vaihe 6" }));
    await user.click(
      screen.getByRole("button", { name: "Tutki huoltovälit verkosta" }),
    );

    expect(await screen.findByText("Lähde löytyi")).toBeVisible();
    expect(screen.getByText("Lähteissä ristiriita")).toBeVisible();
    expect(screen.getByText("Ei riittävää tietoa")).toBeVisible();
    expect(
      screen.getByText(/Väliä ei valittu automaattisesti/),
    ).toBeVisible();
    expect(
      screen.getByText(/Tarkkaa vaihtoväliä ei voitu varmistaa/),
    ).toBeVisible();
    expect(
      screen.getAllByRole("link", {
        name: "Official maintenance schedule",
      })[0],
    ).toHaveAttribute("href", "https://manufacturer.example/maintenance");

    const body = JSON.parse(
      vi.mocked(fetchMock).mock.calls[0]?.[1]?.body as string,
    ) as Record<string, unknown>;
    expect(body.current_odometer_km).toBe(184_000);
    expect(JSON.stringify(body)).not.toContain("Akku vaihdettu 2024");
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
              raw_evidence: "Akku vaihdettu 2024",
              service_date: null,
              odometer: null,
              actions: [
                {
                  component_code: "battery",
                  component_label: "Akku",
                  action_type: "replaced",
                  description: "Akku vaihdettu",
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
      Valmistele vaihe 6
    </button>
  );
}
