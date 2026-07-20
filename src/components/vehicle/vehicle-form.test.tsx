import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AnalysisSessionProvider } from "@/components/session/analysis-session-provider";

import { VehicleForm } from "./vehicle-form";

function renderVehicleForm() {
  return render(
    <AnalysisSessionProvider>
      <VehicleForm />
    </AnalysisSessionProvider>,
  );
}

async function fillRequiredFields() {
  const user = userEvent.setup();
  await user.type(
    screen.getByRole("textbox", { name: "Make" }),
    "Toyota",
  );
  await user.type(
    screen.getByRole("textbox", { name: "Model" }),
    "Avensis",
  );
  await user.type(
    screen.getByRole("spinbutton", {
      name: "Current odometer reading",
    }),
    "184000",
  );
  return user;
}

describe("VehicleForm", () => {
  it("shows the in-memory boundary and no image controls", () => {
    renderVehicleForm();

    expect(
      screen.getByText(/Only in this tab's memory/),
    ).toBeVisible();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(
      screen.getByRole("button", { name: "Clear session" }),
    ).toBeDisabled();
  });

  it("validates required fields before confirming", async () => {
    const user = userEvent.setup();
    renderVehicleForm();

    await user.click(
      screen.getByRole("button", { name: "Confirm vehicle details" }),
    );

    expect(screen.getByText("Make is required.")).toBeVisible();
    expect(screen.getByText("Model is required.")).toBeVisible();
    expect(
      screen.getByText("The current odometer reading is required."),
    ).toBeVisible();
    expect(screen.queryByTestId("confirmed-vehicle")).not.toBeInTheDocument();
  });

  it("confirms and summarizes a valid vehicle", async () => {
    renderVehicleForm();
    const user = await fillRequiredFields();
    await user.type(screen.getByLabelText("Model year"), "2015");
    await user.selectOptions(screen.getByLabelText("Fuel type"), "diesel");

    await user.click(
      screen.getByRole("button", { name: "Confirm vehicle details" }),
    );

    const summary = screen.getByTestId("confirmed-vehicle");
    expect(within(summary).getByText("Toyota Avensis")).toBeVisible();
    expect(within(summary).getByText("model year 2015")).toBeVisible();
    expect(within(summary).getByText("Diesel")).toBeVisible();
    expect(within(summary).getByText(/184.?000 km/)).toBeVisible();
    expect(screen.getByText("Vehicle confirmed")).toBeVisible();
  });

  it("rejects contradictory years", async () => {
    renderVehicleForm();
    const user = await fillRequiredFields();
    await user.type(screen.getByLabelText("Model year"), "2020");
    await user.type(screen.getByLabelText("First registration year"), "2017");

    await user.click(
      screen.getByRole("button", { name: "Confirm vehicle details" }),
    );

    expect(
      screen.getByText(
        "The first registration year cannot be more than one year before the model year.",
      ),
    ).toBeVisible();
    expect(screen.queryByTestId("confirmed-vehicle")).not.toBeInTheDocument();
  });

  it("clears draft and confirmed values with the reset action", async () => {
    renderVehicleForm();
    const user = await fillRequiredFields();
    await user.click(
      screen.getByRole("button", { name: "Confirm vehicle details" }),
    );

    await user.click(
      screen.getByRole("button", { name: "Clear session" }),
    );

    expect(
      screen.getByRole("textbox", { name: "Make" }),
    ).toHaveValue("");
    expect(
      screen.getByRole("textbox", { name: "Model" }),
    ).toHaveValue("");
    expect(
      screen.getByRole("spinbutton", {
        name: "Current odometer reading",
      }),
    ).toHaveValue(null);
    expect(screen.queryByTestId("confirmed-vehicle")).not.toBeInTheDocument();
    expect(screen.getByText("Session cleared")).toBeVisible();
  });
});
