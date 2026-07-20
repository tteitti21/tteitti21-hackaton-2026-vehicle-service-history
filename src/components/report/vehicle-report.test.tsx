import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AnalysisSessionProvider,
  useAnalysisSession,
} from "@/components/session/analysis-session-provider";
import { maintenanceResearchFixture } from "@/test/maintenance-research-fixture";
import {
  confirmedVehicleFixture,
  vehicleResolutionFixture,
} from "@/test/vehicle-resolution-fixture";
import { VehicleReportPanel } from "./vehicle-report";

const createExcelReportBlob = vi.hoisted(() =>
  vi.fn(async () => {
    return new Blob(["synthetic-excel"], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }),
);

vi.mock("@/lib/export/excel-export", () => ({
  createExcelReportBlob,
}));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("VehicleReportPanel", () => {
  it("renders summary, service-history, component, and source tables from reviewed state", async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(
      screen.getByText("Raportti odottaa valmista tilalaskentaa."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Valmistele raportti" }));

    expect(
      screen.getByRole("heading", { name: "Toyota Avensis", level: 3 }),
    ).toBeVisible();
    expect(screen.getByText("1", { selector: ".reportSummaryGrid strong" })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Tarkistettu huoltohistoria" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Komponenttien laskettu tila" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Lähteet ja yhteensopivuus" }),
    ).toBeVisible();
    expect(screen.getByText("160,9344 km")).toBeVisible();
    expect(screen.getAllByText("Lähteissä ristiriita")).not.toHaveLength(0);
    expect(screen.getAllByText("Ei riittävää tietoa")).not.toHaveLength(0);
    expect(
      screen.getAllByText(/Luotettavuus: Matala \(low\)/).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", {
        name: "Toyota Avensis technical specifications",
      })[0],
    ).toHaveAttribute("href", "https://toyota.example/avensis-t27");
    expect(screen.queryByText("original-image.png")).not.toBeInTheDocument();
  });

  it("downloads JSON and Excel locally without a network request", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const blobs: Blob[] = [];
    const filenames: string[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return `blob:report-${blobs.length}`;
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function click(this: HTMLAnchorElement) {
        filenames.push(this.download);
      },
    );
    const fetchMock = vi.spyOn(globalThis, "fetch");
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Valmistele raportti" }));
    await user.click(screen.getByRole("button", { name: "Lataa JSON" }));

    expect(filenames[0]).toBe("autohuolto-toyota-avensis-2026-07-19.json");
    expect(blobs[0]?.type).toBe("application/json;charset=utf-8");
    const json = JSON.parse(await blobs[0]!.text());
    expect(json.service_history[0]).toMatchObject({
      raw_evidence: "=HYPERLINK(\"https://attacker.example\")",
      odometer_km: 160.9344,
    });
    expect(JSON.stringify(json)).not.toContain('"images":');

    await user.click(screen.getByRole("button", { name: "Lataa Excel" }));
    await vi.waitFor(() => expect(createExcelReportBlob).toHaveBeenCalledOnce());
    expect(filenames[1]).toBe("autohuolto-toyota-avensis-2026-07-19.xlsx");
    expect(blobs[1]?.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function renderPanel() {
  return render(
    <AnalysisSessionProvider>
      <SetupButton />
      <VehicleReportPanel />
    </AnalysisSessionProvider>,
  );
}

function SetupButton() {
  const {
    confirmVehicle,
    completeExtraction,
    confirmServiceHistoryReview,
    completeVehicleResolution,
    confirmVehicleCandidate,
    completeMaintenanceResearch,
  } = useAnalysisSession();

  return (
    <button
      type="button"
      onClick={() => {
        confirmVehicle(confirmedVehicleFixture);
        completeExtraction({
          images: [
            {
              image_id: "image-1",
              readability: 1,
              notes: "original-image.png",
            },
          ],
          events: [
            {
              event_id: "event-1",
              source_image_ids: ["image-1"],
              raw_evidence: "=HYPERLINK(\"https://attacker.example\")",
              service_date: {
                value: "2026-01-15",
                precision: "day",
                confidence: 1,
              },
              odometer: { value: 100, unit: "mi", confidence: 1 },
              actions: [
                {
                  component_code: "engine_oil",
                  component_label: "Moottoriöljy",
                  action_type: "replaced",
                  description: "Öljy vaihdettu",
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
        completeMaintenanceResearch(maintenanceResearchFixture);
      }}
    >
      Valmistele raportti
    </button>
  );
}
