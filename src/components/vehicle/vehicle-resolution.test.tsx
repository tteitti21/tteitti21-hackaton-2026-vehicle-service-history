import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AnalysisSessionProvider,
  useAnalysisSession,
} from "@/components/session/analysis-session-provider";
import {
  confirmedVehicleFixture,
  vehicleResolutionFixture,
} from "@/test/vehicle-resolution-fixture";

import { VehicleResolutionPanel } from "./vehicle-resolution";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("VehicleResolutionPanel", () => {
  it("waits for confirmed vehicle and reviewed history", async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(
      screen.getByText(/Vehicle search is waiting for confirmation of earlier phases/),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: "Search the web for vehicle variants",
      }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Prepare session" }));

    expect(
      screen.getByRole("button", {
        name: "Search the web for vehicle variants",
      }),
    ).toBeEnabled();
  });

  it("shows ambiguous candidates and sources without auto-selecting either", async () => {
    const user = userEvent.setup();
    const fetchMock = mockResolution(vehicleResolutionFixture);
    renderPanel();
    await prepareAndSearch(user);

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios.every((radio) => !(radio as HTMLInputElement).checked)).toBe(
      true,
    );
    expect(
      screen.getByRole("button", {
        name: "Confirm selected vehicle variant",
      }),
    ).toBeDisabled();
    const sourceLinks = screen.getAllByRole("link", {
      name: "Toyota Avensis technical specifications",
    });
    expect(sourceLinks[0]).toHaveAttribute(
      "href",
      "https://toyota.example/avensis-t27",
    );
    expect(sourceLinks[0]).toHaveAttribute("rel", "noreferrer");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/resolve-vehicle",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        body: JSON.stringify(confirmedVehicleFixture),
      }),
    );
  });

  it("confirms only the candidate explicitly selected by the user", async () => {
    const user = userEvent.setup();
    mockResolution(vehicleResolutionFixture);
    renderPanel();
    await prepareAndSearch(user);

    const secondCandidate = screen.getByRole("radio", {
      name: /2\.0 D-4D \(2WW\), 105 kW/,
    });
    await user.click(secondCandidate);
    await user.click(
      screen.getByRole("button", {
        name: "Confirm selected vehicle variant",
      }),
    );

    const confirmation = screen.getByText(
      "Vehicle variant confirmed for later research",
    ).parentElement;
    expect(confirmation).not.toBeNull();
    expect(within(confirmation!).getByText(/2WW/)).toBeVisible();
    expect(within(confirmation!).queryByText(/1AD-FTV/)).not.toBeInTheDocument();
  });

  it("supports none-of-these without retaining a prior selection", async () => {
    const user = userEvent.setup();
    mockResolution(vehicleResolutionFixture);
    renderPanel();
    await prepareAndSearch(user);

    await user.click(
      screen.getByRole("radio", {
        name: /2\.0 D-4D \(1AD-FTV\), 91 kW/,
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Confirm selected vehicle variant",
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "None of these matches the vehicle",
      }),
    );

    expect(screen.getByText("Candidates rejected.")).toBeVisible();
    expect(
      screen.queryByText(
        "Vehicle variant confirmed for later research",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("radio").every(
        (radio) => !(radio as HTMLInputElement).checked,
      ),
    ).toBe(true);
  });

  it("shows an honest empty result and safe provider failure", async () => {
    const user = userEvent.setup();
    mockResolution({
      ...vehicleResolutionFixture,
      candidates: [],
      warnings: ["The engine or chassis code is missing."],
    });
    renderPanel();
    await prepareAndSearch(user, "No verifiable candidate was found.");

    expect(
      screen.getByText("No verifiable candidate was found."),
    ).toBeVisible();
    expect(
      screen.getByText(/An exact variant was not inferred from incomplete evidence/),
    ).toBeVisible();

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "provider_error",
            message: "<script>untrusted response detail</script>",
          },
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    await user.click(
      screen.getByRole("button", { name: "Search for vehicle variants again" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Vehicle-variant web search failed at the provider.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("<script>");
  });
});

function renderPanel() {
  return render(
    <AnalysisSessionProvider>
      <SessionControls />
      <VehicleResolutionPanel />
    </AnalysisSessionProvider>,
  );
}

async function prepareAndSearch(
  user: ReturnType<typeof userEvent.setup>,
  completedText = "2 candidates found",
) {
  await user.click(screen.getByRole("button", { name: "Prepare session" }));
  await user.click(
    screen.getByRole("button", { name: "Search the web for vehicle variants" }),
  );
  await screen.findByText(completedText);
}

function mockResolution(result: typeof vehicleResolutionFixture) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function SessionControls() {
  const {
    confirmVehicle,
    completeExtraction,
    confirmServiceHistoryReview,
  } = useAnalysisSession();

  return (
    <button
      type="button"
      onClick={() => {
        confirmVehicle(confirmedVehicleFixture);
        completeExtraction({
          images: [
            {
              image_id: "synthetic-image",
              readability: 1,
              notes: null,
            },
          ],
          events: [],
          warnings: [],
        });
        confirmServiceHistoryReview();
      }}
    >
      Prepare session
    </button>
  );
}
