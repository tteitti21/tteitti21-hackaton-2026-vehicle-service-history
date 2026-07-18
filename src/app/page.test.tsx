import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisSessionProvider } from "@/components/session/analysis-session-provider";

import Home from "./page";
import PrivacyPage from "./tietosuoja/page";

describe("Phase 2 shell", () => {
  it("renders the Finnish product shell, vehicle form, and image privacy workflow", () => {
    render(
      <AnalysisSessionProvider>
        <Home />
      </AnalysisSessionProvider>,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Huoltohistoria selkeäksi/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Vaihe 2 käytössä")).toBeVisible();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /Kuvaile ajoneuvo mahdollisimman tarkasti/,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /Peitä tunnisteet ennen kuin kuva voi lähteä selaimesta/,
      }),
    ).toBeVisible();
    expect(screen.getByLabelText("Valitse kuvat")).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp",
    );
    expect(
      screen.getByRole("link", { name: /Miten tietoja käsitellään/ }),
    ).toHaveAttribute("href", "/tietosuoja");
  });

  it("renders an accurate provider-retention disclosure", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Tietojen käsittely on rajattu yhteen istuntoon/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ei tarkoita palveluntarjoajan varmennettua nollasäilytystä/i),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /OpenAI Enterprise Privacy/ }),
    ).toHaveAttribute("rel", "noreferrer");
  });
});
