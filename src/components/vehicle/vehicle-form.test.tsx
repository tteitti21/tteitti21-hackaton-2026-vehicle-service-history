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
    screen.getByRole("textbox", { name: "Merkki" }),
    "Toyota",
  );
  await user.type(
    screen.getByRole("textbox", { name: "Malli" }),
    "Avensis",
  );
  await user.type(
    screen.getByRole("spinbutton", {
      name: "Nykyinen matkamittarilukema",
    }),
    "184000",
  );
  return user;
}

describe("VehicleForm", () => {
  it("shows the in-memory boundary and no image controls", () => {
    renderVehicleForm();

    expect(
      screen.getByText(/Vain tämän välilehden muistissa/),
    ).toBeVisible();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(
      screen.getByRole("button", { name: "Tyhjennä istunto" }),
    ).toBeDisabled();
  });

  it("validates required fields before confirming", async () => {
    const user = userEvent.setup();
    renderVehicleForm();

    await user.click(
      screen.getByRole("button", { name: "Vahvista ajoneuvotiedot" }),
    );

    expect(screen.getByText("Merkki on pakollinen.")).toBeVisible();
    expect(screen.getByText("Malli on pakollinen.")).toBeVisible();
    expect(
      screen.getByText("Nykyinen matkamittarilukema on pakollinen."),
    ).toBeVisible();
    expect(screen.queryByTestId("confirmed-vehicle")).not.toBeInTheDocument();
  });

  it("confirms and summarizes a valid vehicle", async () => {
    renderVehicleForm();
    const user = await fillRequiredFields();
    await user.type(screen.getByLabelText("Mallivuosi"), "2015");
    await user.selectOptions(screen.getByLabelText("Käyttövoima"), "diesel");

    await user.click(
      screen.getByRole("button", { name: "Vahvista ajoneuvotiedot" }),
    );

    const summary = screen.getByTestId("confirmed-vehicle");
    expect(within(summary).getByText("Toyota Avensis")).toBeVisible();
    expect(within(summary).getByText("mallivuosi 2015")).toBeVisible();
    expect(within(summary).getByText("Diesel")).toBeVisible();
    expect(within(summary).getByText(/184.?000 km/)).toBeVisible();
    expect(screen.getByText("Ajoneuvo vahvistettu")).toBeVisible();
  });

  it("rejects contradictory years", async () => {
    renderVehicleForm();
    const user = await fillRequiredFields();
    await user.type(screen.getByLabelText("Mallivuosi"), "2020");
    await user.type(screen.getByLabelText("Ensirekisteröintivuosi"), "2017");

    await user.click(
      screen.getByRole("button", { name: "Vahvista ajoneuvotiedot" }),
    );

    expect(
      screen.getByText(
        "Ensirekisteröintivuosi ei voi olla yli vuotta mallivuotta aikaisempi.",
      ),
    ).toBeVisible();
    expect(screen.queryByTestId("confirmed-vehicle")).not.toBeInTheDocument();
  });

  it("clears draft and confirmed values with the reset action", async () => {
    renderVehicleForm();
    const user = await fillRequiredFields();
    await user.click(
      screen.getByRole("button", { name: "Vahvista ajoneuvotiedot" }),
    );

    await user.click(
      screen.getByRole("button", { name: "Tyhjennä istunto" }),
    );

    expect(
      screen.getByRole("textbox", { name: "Merkki" }),
    ).toHaveValue("");
    expect(
      screen.getByRole("textbox", { name: "Malli" }),
    ).toHaveValue("");
    expect(
      screen.getByRole("spinbutton", {
        name: "Nykyinen matkamittarilukema",
      }),
    ).toHaveValue(null);
    expect(screen.queryByTestId("confirmed-vehicle")).not.toBeInTheDocument();
    expect(screen.getByText("Istunto on tyhjennetty")).toBeVisible();
  });
});
