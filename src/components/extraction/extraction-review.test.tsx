import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  AnalysisSessionProvider,
  useAnalysisSession,
} from "@/components/session/analysis-session-provider";
import type { ServiceHistory } from "@/domain/schemas/service-history";

import { ExtractionReview } from "./extraction-review";

const history: ServiceHistory = {
  images: [
    {
      image_id: "synthetic-image-1",
      readability: 0.92,
      notes: "Printed text is clear.",
    },
  ],
  events: [
    {
      event_id: "event-1",
      source_image_ids: ["synthetic-image-1"],
      raw_evidence: "Oil and filter 120000 km",
      service_date: {
        value: "2024-03-12",
        precision: "day",
        confidence: 0.94,
      },
      odometer: { value: 120_000, unit: "km", confidence: 0.91 },
      actions: [
        {
          component_code: "engine_oil",
          component_label: "Moottoriöljy",
          action_type: "replaced",
          description: "Öljy vaihdettu",
          confidence: 0.9,
        },
      ],
      workshop: null,
      notes: null,
      confidence: 0.88,
      ambiguities: [],
    },
  ],
  warnings: ["Synthetic warning"],
};

describe("ExtractionReview", () => {
  it("shows confidence and references and allows editing, adding, and deleting", async () => {
    const user = userEvent.setup();
    render(
      <AnalysisSessionProvider>
        <SessionControls history={history} />
        <ExtractionReview />
      </AnalysisSessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Lataa tulos" }));

    expect(screen.getAllByText("synthetic-image-1")[0]).toBeVisible();
    expect(screen.getAllByText(/Korkea \(88 %\)/)[0]).toBeVisible();
    expect(screen.getByText("Synthetic warning")).toBeVisible();

    const evidence = screen.getByLabelText("Raaka kuvasta luettu näyttö");
    await user.clear(evidence);
    await user.type(evidence, "Käyttäjän tarkistama näyttö");
    expect(evidence).toHaveValue("Käyttäjän tarkistama näyttö");

    await user.click(screen.getByRole("button", { name: "Lisää tapahtuma" }));
    expect(screen.getAllByRole("row")).toHaveLength(3);

    const bodyRows = screen.getAllByRole("row").slice(1);
    await user.click(
      within(bodyRows[1]).getByRole("button", { name: "Poista" }),
    );
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("keeps the active event identifiable and derives date precision from the input", async () => {
    const user = userEvent.setup();
    const multiEventHistory = structuredClone(history);
    multiEventHistory.events.push({
      ...structuredClone(multiEventHistory.events[0]),
      event_id: "event-7",
      service_date: {
        value: "2024-03-12",
        precision: "unknown",
        confidence: 0.7,
      },
    });

    render(
      <AnalysisSessionProvider>
        <SessionControls history={multiEventHistory} />
        <ExtractionReview />
      </AnalysisSessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Lataa tulos" }));
    const bodyRows = screen.getAllByRole("row").slice(1);

    expect(bodyRows[0]).toHaveAttribute("aria-current", "true");
    expect(
      within(bodyRows[0]).getByRole("button", {
        name: "Tapahtuma event-1 on muokattavana",
      }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(
      within(bodyRows[1]).getByRole("button", {
        name: "Muokkaa tapahtumaa event-7",
      }),
    );

    expect(bodyRows[0]).not.toHaveAttribute("aria-current");
    expect(bodyRows[1]).toHaveAttribute("aria-current", "true");
    expect(bodyRows[1]).toHaveClass("reviewTableRowActive");
    expect(
      within(bodyRows[1]).getByRole("button", {
        name: "Tapahtuma event-7 on muokattavana",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("heading", { name: "event-7", level: 3 }),
    ).toBeVisible();
    expect(document.getElementById("event-editor")).toHaveAttribute(
      "data-active-event",
      "event-7",
    );

    const dateInput = screen.getByLabelText("Päivämäärä");
    expect(dateInput).toHaveValue("12.03.2024");
    expect(screen.getByText("Automaattinen tarkkuus")).toBeVisible();
    expect(screen.getByText("Päivä", { selector: "strong" })).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: "Päivämäärän tarkkuus" }),
    ).not.toBeInTheDocument();

    await user.clear(dateInput);
    await user.type(dateInput, "03.2024");
    expect(dateInput).toHaveValue("03.2024");
    expect(screen.getByText("Kuukausi", { selector: "strong" })).toBeVisible();
  });

  it("presents an honest result when no event was evidenced", async () => {
    const user = userEvent.setup();
    render(
      <AnalysisSessionProvider>
        <SessionControls history={{ ...history, events: [] }} />
        <ExtractionReview />
      </AnalysisSessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Lataa tulos" }));

    expect(
      screen.getByText(/Kuvista ei löytynyt varmistettavaa huoltotapahtumaa/),
    ).toBeVisible();
    expect(screen.getByText(/ei tarkoita, ettei huoltoja olisi tehty/i)).toBeVisible();
  });

  it("shows a safe error without discarding the surrounding session", async () => {
    const user = userEvent.setup();
    render(
      <AnalysisSessionProvider>
        <SessionControls history={history} />
        <ExtractionReview />
      </AnalysisSessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Aseta virhe" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Kuvat säilyvät selaimen muistissa.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Turvallinen virheilmoitus",
    );
  });

  it("shows exact mile normalization and applies a taxonomy suggestion", async () => {
    const user = userEvent.setup();
    const mileHistory = structuredClone(history);
    mileHistory.warnings = [];
    mileHistory.events[0].odometer = {
      value: 100,
      unit: "mi",
      confidence: 0.91,
    };
    mileHistory.events[0].actions[0] = {
      ...mileHistory.events[0].actions[0],
      component_code: "other",
      component_label: "ATF",
      description: "ATF vaihdettu",
    };

    render(
      <AnalysisSessionProvider>
        <SessionControls history={mileHistory} />
        <ExtractionReview />
      </AnalysisSessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Lataa tulos" }));

    expect(
      within(screen.getByRole("complementary", { name: "Normalisoidut arvot" }))
        .getByText("160,9344 km"),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: "Käytä ehdotusta Vaihteistoöljy",
      }),
    );

    expect(screen.getByLabelText("Komponentti")).toHaveValue(
      "transmission_fluid",
    );
  });

  it("blocks confirmation for invalid values and invalidates confirmation after an edit", async () => {
    const user = userEvent.setup();
    render(
      <AnalysisSessionProvider>
        <SessionControls history={{ ...history, warnings: [] }} />
        <ExtractionReview />
      </AnalysisSessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Lataa tulos" }));

    const dateInput = screen.getByLabelText("Päivämäärä");
    await user.clear(dateInput);
    await user.type(dateInput, "31.02.2024");

    expect(dateInput).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByRole("button", {
        name: "Vahvista tarkistettu huoltohistoria",
      }),
    ).toBeDisabled();

    await user.clear(dateInput);
    await user.type(dateInput, "29.02.2024");
    await user.click(
      screen.getByRole("button", {
        name: "Vahvista tarkistettu huoltohistoria",
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "Huoltohistoria on vahvistettu.",
      }),
    ).toBeVisible();

    await user.type(screen.getByLabelText("Muistiinpanot"), "Tarkistettu");

    expect(
      screen.getByRole("button", {
        name: "Vahvista tarkistettu huoltohistoria",
      }),
    ).toBeEnabled();
  });

  it("requires chronology and duplicate warnings to be acknowledged", async () => {
    const user = userEvent.setup();
    const duplicateHistory = structuredClone(history);
    duplicateHistory.warnings = [];
    duplicateHistory.events.push({
      ...structuredClone(duplicateHistory.events[0]),
      event_id: "event-2",
      source_image_ids: ["synthetic-image-1"],
    });

    render(
      <AnalysisSessionProvider>
        <SessionControls history={duplicateHistory} />
        <ExtractionReview />
      </AnalysisSessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Lataa tulos" }));

    expect(screen.getByText(/voivat kuvata samaa huoltokäyntiä/)).toBeVisible();
    const confirmButton = screen.getByRole("button", {
      name: "Vahvista tarkistettu huoltohistoria",
    });
    expect(confirmButton).toBeDisabled();

    await user.click(
      screen.getByRole("checkbox", {
        name: /Olen tarkistanut 1 varoituksen/,
      }),
    );

    expect(confirmButton).toBeEnabled();
  });
});

function SessionControls({ history: result }: Readonly<{ history: ServiceHistory }>) {
  const { completeExtraction, failExtraction } = useAnalysisSession();

  return (
    <>
      <button type="button" onClick={() => completeExtraction(result)}>
        Lataa tulos
      </button>
      <button type="button" onClick={() => failExtraction("Turvallinen virheilmoitus")}>
        Aseta virhe
      </button>
    </>
  );
}
