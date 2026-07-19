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
      screen.getByText(/Ajoneuvohaku odottaa aiempien vaiheiden vahvistusta/),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: "Etsi ajoneuvoversiot verkosta",
      }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Valmistele istunto" }));

    expect(
      screen.getByRole("button", {
        name: "Etsi ajoneuvoversiot verkosta",
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
        name: "Vahvista valittu ajoneuvoversio",
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
        name: "Vahvista valittu ajoneuvoversio",
      }),
    );

    const confirmation = screen.getByText(
      "Ajoneuvoversio vahvistettu myöhempää tutkimusta varten",
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
        name: "Vahvista valittu ajoneuvoversio",
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Mikään näistä ei vastaa ajoneuvoa",
      }),
    );

    expect(screen.getByText("Ehdokkaat hylättiin.")).toBeVisible();
    expect(
      screen.queryByText(
        "Ajoneuvoversio vahvistettu myöhempää tutkimusta varten",
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
      warnings: ["Moottori- tai alustakoodi puuttuu."],
    });
    renderPanel();
    await prepareAndSearch(user, "Varmennettavaa ehdokasta ei löytynyt.");

    expect(
      screen.getByText("Varmennettavaa ehdokasta ei löytynyt."),
    ).toBeVisible();
    expect(
      screen.getByText(/Tarkkaa versiota ei päätelty puutteellisesta näytöstä/),
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
      screen.getByRole("button", { name: "Hae ajoneuvoversiot uudelleen" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ajoneuvoversion verkkohaku epäonnistui palveluntarjoajalla.",
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
  completedText = "2 ehdokasta löytyi",
) {
  await user.click(screen.getByRole("button", { name: "Valmistele istunto" }));
  await user.click(
    screen.getByRole("button", { name: "Etsi ajoneuvoversiot verkosta" }),
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
      Valmistele istunto
    </button>
  );
}
