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
