import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AnalysisSessionProvider,
  useAnalysisSession,
} from "@/components/session/analysis-session-provider";
import type { MaintenanceResearch } from "@/domain/schemas/maintenance-research";
import { maintenanceResearchFixture } from "@/test/maintenance-research-fixture";
import { confirmedVehicleFixture } from "@/test/vehicle-resolution-fixture";
import { ComponentStatusSummaryPanel } from "./component-status-summary";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ComponentStatusSummaryPanel", () => {
  it("derives due, conflict, and insufficient statuses without a network call", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderPanel("full");

    expect(
      screen.getByText("Status calculation is waiting for maintenance interval research."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Prepare statuses" }));

    const oilCard = screen.getByRole("heading", {
      name: "Engine oil",
    }).closest("article");
    expect(oilCard).not.toBeNull();
    expect(within(oilCard!).getByText("Due")).toBeVisible();
    expect(within(oilCard!).getByText("184 000 km")).toBeVisible();
    expect(within(oilCard!).getByText("Calculated by application code")).toBeVisible();
    expect(screen.getAllByText("Conflicting sources")).not.toHaveLength(0);
    expect(screen.getAllByText("Insufficient evidence")).not.toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses truthful missing-history wording instead of claiming non-service", async () => {
    const user = userEvent.setup();
    renderPanel("missing");
    await user.click(screen.getByRole("button", { name: "Prepare statuses" }));

    expect(
      screen.getByText("No service-history entry was found."),
    ).toBeVisible();
    expect(screen.queryByText("Maintenance was not performed.")).not.toBeInTheDocument();
    expect(screen.getAllByText("Unknown")).not.toHaveLength(0);
  });
});

function renderPanel(mode: "full" | "missing") {
  return render(
    <AnalysisSessionProvider>
      <SetupButton mode={mode} />
      <ComponentStatusSummaryPanel />
    </AnalysisSessionProvider>,
  );
}

function SetupButton({ mode }: Readonly<{ mode: "full" | "missing" }>) {
  const {
    confirmVehicle,
    completeExtraction,
    completeMaintenanceResearch,
  } = useAnalysisSession();

  return (
    <button
      type="button"
      onClick={() => {
        confirmVehicle(confirmedVehicleFixture);
        completeExtraction({
          images: [{ image_id: "image-1", readability: 1, notes: null }],
          events:
            mode === "full"
              ? [
                  {
                    event_id: "event-oil",
                    source_image_ids: ["image-1"],
                    raw_evidence: "Engine oil replaced",
                    service_date: {
                      value: "2026-01-01",
                      precision: "day",
                      confidence: 1,
                    },
                    odometer: {
                      value: 169_000,
                      unit: "km",
                      confidence: 1,
                    },
                    actions: [
                      {
                        component_code: "engine_oil",
                        component_label: "Engine oil",
                        action_type: "replaced",
                        description: "Engine oil replaced",
                        confidence: 1,
                      },
                    ],
                    workshop: null,
                    notes: null,
                    confidence: 1,
                    ambiguities: [],
                  },
                ]
              : [],
          warnings: [],
        });
        completeMaintenanceResearch(
          mode === "full"
            ? maintenanceResearchFixture
            : missingHistoryResearch(),
        );
      }}
    >
      Prepare statuses
    </button>
  );
}

function missingHistoryResearch(): MaintenanceResearch {
  return {
    ...maintenanceResearchFixture,
    components: [maintenanceResearchFixture.components[0]!],
  };
}
