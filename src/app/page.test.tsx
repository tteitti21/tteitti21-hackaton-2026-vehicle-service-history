import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";
import PrivacyPage from "./tietosuoja/page";

describe("Phase 0 shell", () => {
  it("renders the Finnish product shell and marks analysis unavailable", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Huoltohistoria selkeäksi/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Analyysi ei ole vielä käytössä\./),
    ).toBeVisible();
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
