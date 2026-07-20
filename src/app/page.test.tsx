import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnalysisSessionProvider } from "@/components/session/analysis-session-provider";

import Home from "./page";
import PrivacyPage from "./tietosuoja/page";

describe("Phase 9 shell", () => {
  it("renders the English product shell, vehicle form, and image privacy workflow", () => {
    render(
      <AnalysisSessionProvider>
        <Home />
      </AnalysisSessionProvider>,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /A clear service history/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Phase 9 / MVP available")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Load synthetic demo" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /Describe the vehicle as precisely as possible/,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /Redact identifiers before an image can leave the browser/,
      }),
    ).toBeVisible();
    expect(screen.getByLabelText("Select images")).toHaveAttribute(
      "accept",
      "image/jpeg,image/png,image/webp",
    );
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /Extracted service events are normalized here/,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /Narrow down the exact vehicle variant using sources/,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /Review maintenance intervals one source at a time/,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /Maintenance status is calculated from verified evidence/,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /Review the report and save it to your device/,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /How data is handled/ }),
    ).toHaveAttribute("href", "/tietosuoja");
  });

  it("renders an accurate provider-retention disclosure", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Data handling is limited to one session/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not mean verified zero retention by the provider/i),
    ).toBeVisible();
    expect(
      screen.getByText(/confirmed vehicle details needed to distinguish the variant/i),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /OpenAI Enterprise Privacy/ }),
    ).toHaveAttribute("rel", "noreferrer");
  });
});
