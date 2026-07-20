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
          component_label: "Engine oil",
          action_type: "replaced",
          description: "Oil replaced",
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

    await user.click(screen.getByRole("button", { name: "Load result" }));

    expect(screen.getAllByText("synthetic-image-1")[0]).toBeVisible();
    expect(screen.getAllByText(/High \(88 %\)/)[0]).toBeVisible();
    expect(screen.getByText("Synthetic warning")).toBeVisible();

    const evidence = screen.getByLabelText("Raw evidence read from the image");
    await user.clear(evidence);
    await user.type(evidence, "Evidence reviewed by the user");
    expect(evidence).toHaveValue("Evidence reviewed by the user");

    await user.click(screen.getByRole("button", { name: "Add event" }));
    expect(screen.getAllByRole("row")).toHaveLength(3);

    const bodyRows = screen.getAllByRole("row").slice(1);
    await user.click(
      within(bodyRows[1]).getByRole("button", { name: "Remove" }),
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

    await user.click(screen.getByRole("button", { name: "Load result" }));
    const bodyRows = screen.getAllByRole("row").slice(1);

    expect(bodyRows[0]).toHaveAttribute("aria-current", "true");
    expect(
      within(bodyRows[0]).getByRole("button", {
        name: "Event event-1 is being edited",
      }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(
      within(bodyRows[1]).getByRole("button", {
        name: "Edit event event-7",
      }),
    );

    expect(bodyRows[0]).not.toHaveAttribute("aria-current");
    expect(bodyRows[1]).toHaveAttribute("aria-current", "true");
    expect(bodyRows[1]).toHaveClass("reviewTableRowActive");
    expect(
      within(bodyRows[1]).getByRole("button", {
        name: "Event event-7 is being edited",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("heading", { name: "event-7", level: 3 }),
    ).toBeVisible();
    expect(document.getElementById("event-editor")).toHaveAttribute(
      "data-active-event",
      "event-7",
    );

    const dateInput = screen.getByLabelText("Date");
    expect(dateInput).toHaveValue("12.03.2024");
    expect(screen.getByText("Automatic precision")).toBeVisible();
    expect(screen.getByText("Day", { selector: "strong" })).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: "Date precision" }),
    ).not.toBeInTheDocument();

    await user.clear(dateInput);
    await user.type(dateInput, "03.2024");
    expect(dateInput).toHaveValue("03.2024");
    expect(screen.getByText("Month", { selector: "strong" })).toBeVisible();
  });

  it("presents an honest result when no event was evidenced", async () => {
    const user = userEvent.setup();
    render(
      <AnalysisSessionProvider>
        <SessionControls history={{ ...history, events: [] }} />
        <ExtractionReview />
      </AnalysisSessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Load result" }));

    expect(
      screen.getByText(/No verifiable service event was found in the images/),
    ).toBeVisible();
    expect(screen.getByText(/does not mean no maintenance was performed/i)).toBeVisible();
  });

  it("shows a safe error without discarding the surrounding session", async () => {
    const user = userEvent.setup();
    render(
      <AnalysisSessionProvider>
        <SessionControls history={history} />
        <ExtractionReview />
      </AnalysisSessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Set error" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Images remain in browser memory.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Safe error message",
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
      description: "ATF replaced",
    };

    render(
      <AnalysisSessionProvider>
        <SessionControls history={mileHistory} />
        <ExtractionReview />
      </AnalysisSessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Load result" }));

    expect(
      within(screen.getByRole("complementary", { name: "Normalized values" }))
        .getByText("160,9344 km"),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: "Use suggestion Transmission fluid",
      }),
    );

    expect(screen.getByLabelText("Component")).toHaveValue(
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

    await user.click(screen.getByRole("button", { name: "Load result" }));

    const dateInput = screen.getByLabelText("Date");
    await user.clear(dateInput);
    await user.type(dateInput, "31.02.2024");

    expect(dateInput).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByRole("button", {
        name: "Confirm reviewed service history",
      }),
    ).toBeDisabled();

    await user.clear(dateInput);
    await user.type(dateInput, "29.02.2024");
    await user.click(
      screen.getByRole("button", {
        name: "Confirm reviewed service history",
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "The service history is confirmed.",
      }),
    ).toBeVisible();

    await user.type(screen.getByLabelText("Notes"), "Reviewed");

    expect(
      screen.getByRole("button", {
        name: "Confirm reviewed service history",
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

    await user.click(screen.getByRole("button", { name: "Load result" }));

    expect(screen.getByText(/may describe the same service visit/)).toBeVisible();
    const confirmButton = screen.getByRole("button", {
      name: "Confirm reviewed service history",
    });
    expect(confirmButton).toBeDisabled();

    await user.click(
      screen.getByRole("checkbox", {
        name: /I have reviewed 1 warning/,
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
        Load result
      </button>
      <button type="button" onClick={() => failExtraction("Safe error message")}>
        Set error
      </button>
    </>
  );
}
