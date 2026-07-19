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
      screen.getByText("Tilalaskenta odottaa huoltovälitutkimusta."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Valmistele tilat" }));

    const oilCard = screen.getByRole("heading", {
      name: "Moottoriöljy",
    }).closest("article");
    expect(oilCard).not.toBeNull();
    expect(within(oilCard!).getByText("Ajankohtainen")).toBeVisible();
    expect(within(oilCard!).getByText("184 000 km")).toBeVisible();
    expect(within(oilCard!).getByText("Sovelluskoodin laskema")).toBeVisible();
    expect(screen.getAllByText("Lähteissä ristiriita")).not.toHaveLength(0);
    expect(screen.getAllByText("Ei riittävää tietoa")).not.toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses truthful missing-history wording instead of claiming non-service", async () => {
    const user = userEvent.setup();
    renderPanel("missing");
    await user.click(screen.getByRole("button", { name: "Valmistele tilat" }));

    expect(
      screen.getByText("Huoltohistoriasta ei löytynyt merkintää."),
    ).toBeVisible();
    expect(screen.queryByText("Huoltoa ei ole tehty.")).not.toBeInTheDocument();
    expect(screen.getAllByText("Epäselvä")).not.toHaveLength(0);
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
                    raw_evidence: "Moottoriöljy vaihdettu",
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
                        component_label: "Moottoriöljy",
                        action_type: "replaced",
                        description: "Moottoriöljy vaihdettu",
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
      Valmistele tilat
    </button>
  );
}

function missingHistoryResearch(): MaintenanceResearch {
  return {
    ...maintenanceResearchFixture,
    components: [maintenanceResearchFixture.components[0]!],
  };
}
