import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  AnalysisSessionProvider,
  useAnalysisSession,
} from "@/components/session/analysis-session-provider";
import { SyntheticDemoPanel } from "./synthetic-demo-panel";

describe("SyntheticDemoPanel", () => {
  it("loads and clears a complete fictional session in memory", async () => {
    const user = userEvent.setup();
    render(
      <AnalysisSessionProvider>
        <SyntheticDemoPanel />
        <SessionProbe />
      </AnalysisSessionProvider>,
    );

    await user.click(
      screen.getByRole("button", { name: "Load synthetic demo" }),
    );

    expect(screen.getByTestId("demo-vehicle")).toHaveTextContent(
      "Nordica Aurora",
    );
    expect(screen.getByTestId("demo-images")).toHaveTextContent("3");
    expect(screen.getByTestId("demo-candidate")).toHaveTextContent(
      "candidate-1",
    );
    expect(screen.getByText(/The demo is loaded/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Clear demo" }));
    expect(screen.getByTestId("demo-vehicle")).toHaveTextContent("empty");
    expect(screen.getByTestId("demo-images")).toHaveTextContent("0");
  });
});

function SessionProbe() {
  const { state } = useAnalysisSession();

  return (
    <>
      <output data-testid="demo-vehicle">
        {state.confirmedVehicle === null
          ? "empty"
          : `${state.confirmedVehicle.make} ${state.confirmedVehicle.model}`}
      </output>
      <output data-testid="demo-images">
        {state.serviceHistory?.images.length ?? 0}
      </output>
      <output data-testid="demo-candidate">
        {state.confirmedVehicleCandidateId ?? "none"}
      </output>
    </>
  );
}
