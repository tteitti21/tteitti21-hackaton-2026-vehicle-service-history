"use client";

import { useMemo, useState } from "react";

import { useAnalysisSession } from "@/components/session/analysis-session-provider";
import {
  appendServiceEvent,
  createManualServiceAction,
  createManualServiceEvent,
  mergeSelectedServiceEvents,
  removeServiceEvent,
} from "@/domain/extraction/event-review";
import {
  componentCodeSchema,
  type ComponentCode,
  type ServiceAction,
  type ServiceEvent,
} from "@/domain/schemas/service-history";
import {
  COMPONENT_TAXONOMY,
  getComponentLabel,
  resolveActionComponentCode,
} from "@/domain/service-events/component-taxonomy";
import {
  createServiceDateFromInput,
  formatServiceDateInput,
  normalizeOdometer,
  normalizeServiceDate,
} from "@/domain/service-events/normalization";
import {
  analyzeServiceEvents,
  type ReviewIssue,
} from "@/domain/service-events/review-analysis";

const actionTypes = [
  "replaced",
  "serviced",
  "repaired",
  "inspected",
  "adjusted",
  "unknown",
] as const;

const odometerUnits = ["km", "mi", "unknown"] as const;

const actionTypeLabels: Record<(typeof actionTypes)[number], string> = {
  replaced: "Replaced",
  serviced: "Serviced",
  repaired: "Repaired",
  inspected: "Inspected",
  adjusted: "Adjusted",
  unknown: "Unknown",
};

const precisionLabels: Record<
  NonNullable<ServiceEvent["service_date"]>["precision"],
  string
> = {
  day: "Day",
  month: "Month",
  year: "Year",
  unknown: "Unknown",
};

export function ExtractionReview() {
  const {
    state,
    confirmServiceHistoryReview,
    replaceServiceHistory,
    updateServiceEvent,
  } = useAnalysisSession();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [mergeSelection, setMergeSelection] = useState<Set<string>>(new Set());
  const [warningAcknowledgement, setWarningAcknowledgement] = useState<{
    history: NonNullable<typeof state.serviceHistory>;
    currentOdometerKm: number | undefined;
    warningSignature: string;
  } | null>(null);
  const history = state.serviceHistory;
  const reviewAnalysis = useMemo(
    () =>
      history === null
        ? { errors: [], warnings: [] }
        : analyzeServiceEvents(history.events, {
            currentOdometerKm: state.confirmedVehicle?.currentOdometerKm,
          }),
    [history, state.confirmedVehicle?.currentOdometerKm],
  );
  const warningSignature = [
    ...reviewAnalysis.warnings.map((warning) => warning.id),
    ...(history?.warnings.map(
      (warning, index) => `provider:${index}:${warning}`,
    ) ?? []),
  ].join("\u0000");
  const warningsAcknowledged =
    history !== null &&
    warningAcknowledgement?.history === history &&
    warningAcknowledgement.currentOdometerKm ===
      state.confirmedVehicle?.currentOdometerKm &&
    warningAcknowledgement.warningSignature === warningSignature;

  if (state.extractionStatus === "idle" && history === null) {
    return (
      <section
        className="extractionSection"
        aria-labelledby="extraction-review-heading"
      >
        <p className="sectionLabel">Phase 4 / Normalization and confirmation</p>
        <h2 id="extraction-review-heading">
          Extracted service events are normalized here.
        </h2>
        <div className="emptyExtractionState">
          <span aria-hidden="true">03</span>
          <p>
            Create and approve the sanitized submission versions above.
            Extraction starts only from a separate button, and the result is
            not stored permanently.
          </p>
        </div>
      </section>
    );
  }

  if (state.extractionStatus === "submitting") {
    return (
      <section
        className="extractionSection"
        aria-labelledby="extraction-review-heading"
      >
        <p className="sectionLabel">Phase 4 / Normalization and confirmation</p>
        <h2 id="extraction-review-heading">Images are being processed by OpenAI…</h2>
        <div className="extractionProgress" role="status" aria-live="polite">
          <span aria-hidden="true" />
          <div>
            <strong>Extracting the visible service history</strong>
            <p>
              Processing several large images may take a few minutes. Local
              browser images and submission versions remain in memory even if
              an error occurs.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (state.extractionStatus === "error" && history === null) {
    return (
      <section
        className="extractionSection"
        aria-labelledby="extraction-review-heading"
      >
        <p className="sectionLabel">Phase 4 / Normalization and confirmation</p>
        <h2 id="extraction-review-heading">Extraction failed.</h2>
        <div className="extractionError" role="alert">
          <strong>Images remain in browser memory.</strong>
          <p>{state.extractionError}</p>
          <p>You can review the submission versions and try again above.</p>
        </div>
      </section>
    );
  }

  if (history === null) {
    return null;
  }

  const activeEvent =
    history.events.find((event) => event.event_id === selectedEventId) ??
    history.events[0] ??
    null;

  const addManualEvent = () => {
    const event = createManualServiceEvent(
      crypto.randomUUID(),
      history.images[0]?.image_id ?? "manual-entry",
    );
    replaceServiceHistory(appendServiceEvent(history, event));
    setSelectedEventId(event.event_id);
  };

  const deleteEvent = (eventId: string) => {
    replaceServiceHistory(removeServiceEvent(history, eventId));
    setMergeSelection((current) => {
      const next = new Set(current);
      next.delete(eventId);
      return next;
    });
    if (selectedEventId === eventId) {
      setSelectedEventId(null);
    }
  };

  const mergeEvents = () => {
    replaceServiceHistory(
      mergeSelectedServiceEvents(history, mergeSelection),
    );
    setSelectedEventId(
      history.events.find((event) => mergeSelection.has(event.event_id))
        ?.event_id ?? null,
    );
    setMergeSelection(new Set());
  };

  return (
    <section
      className="extractionSection"
      aria-labelledby="extraction-review-heading"
    >
      <div className="extractionHeading">
        <div>
          <p className="sectionLabel">Phase 4 / Normalization and confirmation</p>
          <h2 id="extraction-review-heading">
            Review, normalize, and confirm the service history.
          </h2>
        </div>
        <div className="extractionSummary">
          <strong>{history.events.length}</strong>
          <span>
            {history.events.length === 1 ? "event" : "events"}
          </span>
        </div>
      </div>

      <ImageReadability history={history} />

      {history.warnings.length > 0 ? (
        <div className="extractionWarnings" role="status">
          <strong>Extraction warnings</strong>
          <ul>
            {history.warnings.map((warning, index) => (
              <li key={`${index}-${warning}`}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <ReviewDiagnostics
        errors={reviewAnalysis.errors}
        warnings={reviewAnalysis.warnings}
      />

      <div className="reviewActions">
        <button className="primaryButton" type="button" onClick={addManualEvent}>
          Add event
        </button>
        <button
          className="secondaryButton"
          type="button"
          disabled={mergeSelection.size < 2}
          onClick={mergeEvents}
        >
          Merge selected ({mergeSelection.size})
        </button>
      </div>

      {history.events.length === 0 ? (
        <div className="honestEmptyResult">
          <strong>No verifiable service event was found in the images.</strong>
          <p>
            This does not mean no maintenance was performed. Check image
            readability and manually add an event known to the user if needed.
          </p>
        </div>
      ) : (
        <div className="reviewTableFrame">
          <table className="reviewTable">
            <thead>
              <tr>
                <th scope="col">Merge</th>
                <th scope="col">Event</th>
                <th scope="col">Source image</th>
                <th scope="col">Date</th>
                <th scope="col">Odometer</th>
                <th scope="col">Actions</th>
                <th scope="col">Confidence</th>
                <th scope="col">
                  <span className="visuallyHidden">Controls</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {history.events.map((event) => {
                const isActive = activeEvent?.event_id === event.event_id;
                return (
                  <tr
                    className={
                      isActive
                        ? "reviewTableRow reviewTableRowActive"
                        : "reviewTableRow"
                    }
                    aria-current={isActive ? "true" : undefined}
                    data-active={isActive ? "true" : "false"}
                    key={event.event_id}
                  >
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select event ${event.event_id} for merging`}
                        checked={mergeSelection.has(event.event_id)}
                        onChange={(changeEvent) =>
                          setMergeSelection((current) => {
                            const next = new Set(current);
                            if (changeEvent.target.checked) {
                              next.add(event.event_id);
                            } else {
                              next.delete(event.event_id);
                            }
                            return next;
                          })
                        }
                      />
                    </td>
                    <td>
                      <div className="eventIdentity">
                        <code>{event.event_id}</code>
                        {isActive ? (
                          <span className="activeEventBadge">
                            Editing
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div className="sourceReferences">
                        {event.source_image_ids.map((imageId) => (
                          <code key={imageId}>{imageId}</code>
                        ))}
                      </div>
                    </td>
                    <td>
                      {formatServiceDateInput(event.service_date) ||
                        "Unknown"}
                    </td>
                    <td>
                      <OdometerSummary event={event} />
                    </td>
                    <td>
                      {event.actions.length > 0
                        ? event.actions
                            .map(
                              (action) =>
                                `${getComponentLabel(
                                  resolveActionComponentCode(
                                    action,
                                    event.raw_evidence,
                                  ),
                                )}: ${action.description}`,
                            )
                            .join(", ")
                        : "Not identified"}
                    </td>
                    <td>
                      <ConfidenceBadge value={event.confidence} />
                    </td>
                    <td>
                      <div className="rowActions">
                        <button
                          aria-controls="event-editor"
                          aria-label={
                            isActive
                              ? `Event ${event.event_id} is being edited`
                              : `Edit event ${event.event_id}`
                          }
                          aria-pressed={isActive}
                          className={
                            isActive
                              ? "rowEditButton rowEditButtonActive"
                              : "rowEditButton"
                          }
                          type="button"
                          onClick={() => setSelectedEventId(event.event_id)}
                        >
                          {isActive ? "Editing" : "Edit"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteEvent(event.event_id)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeEvent !== null ? (
        <EventEditor
          event={activeEvent}
          availableImageIds={history.images.map((image) => image.image_id)}
          onChange={updateServiceEvent}
        />
      ) : null}

      <ReviewConfirmation
        confirmed={state.serviceHistoryReviewConfirmed}
        errors={reviewAnalysis.errors}
        warningCount={
          reviewAnalysis.warnings.length + history.warnings.length
        }
        warningsAcknowledged={warningsAcknowledged}
        onWarningsAcknowledged={(acknowledged) =>
          setWarningAcknowledgement(
            acknowledged
              ? {
                  history,
                  currentOdometerKm:
                    state.confirmedVehicle?.currentOdometerKm,
                  warningSignature,
                }
              : null,
          )
        }
        onConfirm={confirmServiceHistoryReview}
      />
    </section>
  );
}

function ReviewDiagnostics({
  errors,
  warnings,
}: Readonly<{ errors: ReviewIssue[]; warnings: ReviewIssue[] }>) {
  if (errors.length === 0 && warnings.length === 0) {
    return (
      <div className="reviewDiagnostics reviewDiagnosticsClean" role="status">
        <strong>No structural conflicts.</strong>
        <p>
          Dates and odometer readings are in a valid format, and no possible
          duplicates or chronology conflicts were found.
        </p>
      </div>
    );
  }

  return (
    <div className="reviewDiagnostics" aria-label="Review findings">
      {errors.length > 0 ? (
        <div className="reviewIssueGroup reviewIssueErrors" role="alert">
          <strong>
            Correct before confirmation ({errors.length})
          </strong>
          <ul>
            {errors.map((issue) => (
              <li key={issue.id}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div className="reviewIssueGroup reviewIssueWarnings" role="status">
          <strong>
            Review and acknowledge ({warnings.length})
          </strong>
          <ul>
            {warnings.map((issue) => (
              <li key={issue.id}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function OdometerSummary({ event }: Readonly<{ event: ServiceEvent }>) {
  const normalized = normalizeOdometer(event.odometer);

  if (event.odometer === null) {
    return <>Unknown</>;
  }

  return (
    <span className="odometerSummary">
      <span>
        {event.odometer.value.toLocaleString("fi-FI")} {event.odometer.unit}
      </span>
      {normalized.status === "valid" &&
      normalized.kilometres !== null &&
      event.odometer.unit === "mi" ? (
        <small>{formatKilometres(normalized.kilometres)} km for calculations</small>
      ) : null}
      {normalized.status === "unverified" ? (
        <small>Unit must be reviewed</small>
      ) : null}
      {normalized.status === "invalid" ? (
        <small>Invalid reading</small>
      ) : null}
    </span>
  );
}

function ImageReadability({
  history,
}: Readonly<{
  history: NonNullable<
    ReturnType<typeof useAnalysisSession>["state"]["serviceHistory"]
  >;
}>) {
  return (
    <div className="readabilityGrid" aria-label="Source image readability">
      {history.images.map((image) => (
        <article key={image.image_id}>
          <code>{image.image_id}</code>
          <ConfidenceBadge value={image.readability} label="Readability" />
          <p>{image.notes ?? "No separate note."}</p>
        </article>
      ))}
    </div>
  );
}

function NormalizationPreview({ event }: Readonly<{ event: ServiceEvent }>) {
  const date = normalizeServiceDate(event.service_date);
  const odometer = normalizeOdometer(event.odometer);
  const components = event.actions.map((action) => {
    const resolvedCode = resolveActionComponentCode(
      action,
      event.raw_evidence,
    );

    return {
      originalCode: action.component_code,
      resolvedCode,
      label: getComponentLabel(resolvedCode),
    };
  });

  return (
    <aside className="normalizationPreview" aria-label="Normalized values">
      <strong>Normalized values for calculations</strong>
      <dl>
        <div>
          <dt>Date</dt>
          <dd>{normalizedDateDescription(date)}</dd>
        </div>
        <div>
          <dt>Odometer</dt>
          <dd>
            {odometer.kilometres === null
              ? odometer.status === "missing"
                ? "Unknown"
                : "Not used until the unit or value is corrected"
              : `${formatKilometres(odometer.kilometres)} km`}
          </dd>
        </div>
        <div>
          <dt>Components</dt>
          <dd>
            {components.length === 0
              ? "No identified component"
              : components
                  .map(({ label, originalCode, resolvedCode }) =>
                    originalCode === resolvedCode
                      ? label
                      : `${label} (text suggestion)`,
                  )
                  .join(", ")}
          </dd>
        </div>
      </dl>
      <p>
        The original evidence, reading, and unit are preserved in the event.
        Conversion does not change the source value.
      </p>
    </aside>
  );
}

function EventEditor({
  event,
  availableImageIds,
  onChange,
}: Readonly<{
  event: ServiceEvent;
  availableImageIds: string[];
  onChange: (event: ServiceEvent) => void;
}>) {
  const patchEvent = (patch: Partial<ServiceEvent>) =>
    onChange({ ...event, ...patch });

  const updateAction = (index: number, action: ServiceAction) => {
    const actions = event.actions.map((current, currentIndex) =>
      currentIndex === index ? action : current,
    );
    patchEvent({ actions });
  };
  const normalizedDate = normalizeServiceDate(event.service_date);
  const normalizedOdometer = normalizeOdometer(event.odometer);

  return (
    <div
      className="eventEditor eventEditorActive"
      id="event-editor"
      aria-labelledby="event-editor-heading"
      data-active-event={event.event_id}
    >
      <div className="eventEditorHeading">
        <div>
          <p className="sectionLabel">Currently being edited</p>
          <h3 id="event-editor-heading">{event.event_id}</h3>
        </div>
        <div className="activeEditorStatus">
          <span className="activeEditIndicator">
            <span aria-hidden="true" />
            Active edit
          </span>
          <ConfidenceBadge
            value={event.confidence}
            label="Overall confidence"
          />
        </div>
      </div>

      <div className="evidenceComparison">
        <label className="wideEditorField">
          <span>Raw evidence read from the image</span>
          <textarea
            value={event.raw_evidence}
            rows={3}
            onChange={(changeEvent) =>
              patchEvent({ raw_evidence: changeEvent.target.value })
            }
          />
        </label>
        <NormalizationPreview event={event} />
      </div>

      <div className="eventEditorGrid">
        <label>
          <span>Date</span>
          <input
            aria-label="Date"
            value={formatServiceDateInput(event.service_date)}
            placeholder="DD.MM.YYYY, MM.YYYY, or YYYY"
            aria-invalid={
              normalizedDate.status === "invalid" ? "true" : undefined
            }
            aria-describedby={
              normalizedDate.status === "invalid"
                ? "service-date-input-help service-date-validation-error"
                : "service-date-input-help"
            }
            onChange={(changeEvent) =>
              patchEvent({
                service_date: createServiceDateFromInput(
                  changeEvent.target.value,
                  event.service_date?.confidence ?? 0.5,
                ),
              })
            }
          />
          <small className="dateInputHelp" id="service-date-input-help">
            Precision is inferred automatically from the entered format. ISO
            formats YYYY-MM-DD and YYYY-MM are also accepted.
          </small>
          {normalizedDate.status === "invalid" ? (
            <span
              className="fieldError"
              id="service-date-validation-error"
            >
              Check that the date is possible and uses the specified format.
            </span>
          ) : null}
        </label>

        <div
          className={`datePrecisionStatus datePrecision-${event.service_date?.precision ?? "missing"}`}
          role="status"
          aria-live="polite"
        >
          <span>Automatic precision</span>
          <strong>
            {event.service_date === null
              ? "No date"
              : precisionLabels[event.service_date.precision]}
          </strong>
          <small>
            {datePrecisionDescription(event.service_date?.precision)}
          </small>
        </div>

        <label>
          <span>Date confidence 0–1</span>
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={event.service_date?.confidence ?? ""}
            disabled={event.service_date === null}
            onChange={(changeEvent) => {
              if (event.service_date !== null) {
                patchEvent({
                  service_date: {
                    ...event.service_date,
                    confidence: clampConfidence(
                      Number(changeEvent.target.value),
                    ),
                  },
                });
              }
            }}
          />
        </label>

        <label>
          <span>Odometer reading</span>
          <input
            type="number"
            min="0"
            step="1"
            value={
              event.odometer === null ||
              Number.isNaN(event.odometer.value)
                ? ""
                : event.odometer.value
            }
            aria-invalid={
              normalizedOdometer.status === "invalid" ? "true" : undefined
            }
            aria-describedby={
              normalizedOdometer.status === "invalid"
                ? "odometer-validation-error"
                : undefined
            }
            onChange={(changeEvent) =>
              patchEvent({
                odometer:
                  changeEvent.target.value === ""
                    ? {
                        value: Number.NaN,
                        unit: event.odometer?.unit ?? "unknown",
                        confidence: event.odometer?.confidence ?? 0.5,
                      }
                    : {
                        value: Number(changeEvent.target.value),
                        unit: event.odometer?.unit ?? "unknown",
                        confidence: event.odometer?.confidence ?? 0.5,
                      },
              })
            }
            onBlur={() => {
              if (
                event.odometer !== null &&
                Number.isNaN(event.odometer.value)
              ) {
                patchEvent({ odometer: null });
              }
            }}
          />
          {normalizedOdometer.status === "invalid" ? (
            <span className="fieldError" id="odometer-validation-error">
              Enter zero or a positive integer.
            </span>
          ) : null}
        </label>

        <label>
          <span>Odometer unit</span>
          <select
            value={event.odometer?.unit ?? "unknown"}
            disabled={event.odometer === null}
            onChange={(changeEvent) => {
              if (event.odometer !== null) {
                patchEvent({
                  odometer: {
                    ...event.odometer,
                    unit: changeEvent.target
                      .value as (typeof odometerUnits)[number],
                  },
                });
              }
            }}
          >
            {odometerUnits.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Odometer confidence 0–1</span>
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={event.odometer?.confidence ?? ""}
            disabled={event.odometer === null}
            onChange={(changeEvent) => {
              if (event.odometer !== null) {
                patchEvent({
                  odometer: {
                    ...event.odometer,
                    confidence: clampConfidence(
                      Number(changeEvent.target.value),
                    ),
                  },
                });
              }
            }}
          />
        </label>

        <label>
          <span>Workshop</span>
          <input
            value={event.workshop ?? ""}
            onChange={(changeEvent) =>
              patchEvent({ workshop: changeEvent.target.value || null })
            }
          />
        </label>

        <label>
          <span>Event confidence 0–1</span>
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={event.confidence}
            onChange={(changeEvent) =>
              patchEvent({
                confidence: clampConfidence(Number(changeEvent.target.value)),
              })
            }
          />
        </label>

        <label className="wideEditorField">
          <span>Notes</span>
          <textarea
            value={event.notes ?? ""}
            rows={2}
            onChange={(changeEvent) =>
              patchEvent({ notes: changeEvent.target.value || null })
            }
          />
        </label>

        <label className="wideEditorField">
          <span>Ambiguities, one observation per line</span>
          <textarea
            value={event.ambiguities.join("\n")}
            rows={2}
            onChange={(changeEvent) =>
              patchEvent({
                ambiguities: changeEvent.target.value
                  .split("\n")
                  .map((value) => value.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
      </div>

      <fieldset className="sourceSelector">
        <legend>Source images</legend>
        {availableImageIds.map((imageId) => (
          <label key={imageId}>
            <input
              type="checkbox"
              checked={event.source_image_ids.includes(imageId)}
              onChange={(changeEvent) => {
                const sourceImageIds = changeEvent.target.checked
                  ? [...event.source_image_ids, imageId]
                  : event.source_image_ids.filter(
                      (current) => current !== imageId,
                    );

                if (sourceImageIds.length > 0) {
                  patchEvent({ source_image_ids: [...new Set(sourceImageIds)] });
                }
              }}
            />
            <code>{imageId}</code>
          </label>
        ))}
      </fieldset>

      <div className="actionEditor">
        <div className="actionEditorHeading">
          <h4>Actions</h4>
          <button
            className="secondaryButton"
            type="button"
            onClick={() =>
              patchEvent({
                actions: [...event.actions, createManualServiceAction()],
              })
            }
          >
            Add action
          </button>
        </div>

        {event.actions.map((action, index) => (
          <div className="actionEditorRow" key={`${event.event_id}-${index}`}>
            <label>
              <span>Component</span>
              <select
                value={action.component_code}
                onChange={(changeEvent) =>
                  updateAction(
                    index,
                    updateActionComponent(
                      action,
                      componentCodeSchema.parse(changeEvent.target.value),
                    ),
                  )
                }
              >
                {COMPONENT_TAXONOMY.map((component) => (
                  <option key={component.code} value={component.code}>
                    {component.label} ({component.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Name</span>
              <input
                value={action.component_label}
                onChange={(changeEvent) =>
                  updateAction(index, {
                    ...action,
                    component_label: changeEvent.target.value,
                  })
                }
              />
            </label>
            <label>
              <span>Action</span>
              <select
                value={action.action_type}
                onChange={(changeEvent) =>
                  updateAction(index, {
                    ...action,
                    action_type: changeEvent.target
                      .value as (typeof actionTypes)[number],
                  })
                }
              >
                {actionTypes.map((actionType) => (
                  <option key={actionType} value={actionType}>
                    {actionTypeLabels[actionType]}
                  </option>
                ))}
              </select>
            </label>
            <label className="actionDescription">
              <span>Description</span>
              <input
                value={action.description}
                onChange={(changeEvent) =>
                  updateAction(index, {
                    ...action,
                    description: changeEvent.target.value,
                  })
                }
              />
            </label>
            <label>
              <span>Confidence</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={action.confidence}
                onChange={(changeEvent) =>
                  updateAction(index, {
                    ...action,
                    confidence: clampConfidence(
                      Number(changeEvent.target.value),
                    ),
                  })
                }
              />
            </label>
            <button
              className="dangerButton"
              type="button"
              onClick={() =>
                patchEvent({
                  actions: event.actions.filter(
                    (_, currentIndex) => currentIndex !== index,
                  ),
                })
              }
            >
              Remove action
            </button>
            <ComponentMappingSuggestion
              action={action}
              rawEvidence={event.raw_evidence}
              onApply={(componentCode) =>
                updateAction(
                  index,
                  updateActionComponent(action, componentCode),
                )
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ComponentMappingSuggestion({
  action,
  rawEvidence,
  onApply,
}: Readonly<{
  action: ServiceAction;
  rawEvidence: string;
  onApply: (componentCode: ComponentCode) => void;
}>) {
  const suggestion = resolveActionComponentCode(action, rawEvidence);

  if (
    suggestion === "other" ||
    suggestion === action.component_code
  ) {
    return null;
  }

  const label = getComponentLabel(suggestion);

  return (
    <div className="componentSuggestion">
      <span>The text matches component: {label}</span>
      <button type="button" onClick={() => onApply(suggestion)}>
        Use suggestion {label}
      </button>
    </div>
  );
}

function ReviewConfirmation({
  confirmed,
  errors,
  warningCount,
  warningsAcknowledged,
  onWarningsAcknowledged,
  onConfirm,
}: Readonly<{
  confirmed: boolean;
  errors: ReviewIssue[];
  warningCount: number;
  warningsAcknowledged: boolean;
  onWarningsAcknowledged: (acknowledged: boolean) => void;
  onConfirm: () => void;
}>) {
  const needsAcknowledgement = warningCount > 0;
  const blocked =
    errors.length > 0 ||
    (needsAcknowledgement && !warningsAcknowledged);

  return (
    <div
      className={`reviewConfirmation ${
        confirmed ? "reviewConfirmationConfirmed" : ""
      }`}
      aria-labelledby="review-confirmation-heading"
    >
      <div>
        <p className="sectionLabel">User confirmation</p>
        <h3 id="review-confirmation-heading">
          {confirmed
            ? "The service history is confirmed."
            : "Confirm the details before the next phase."}
        </h3>
        <p>
          Confirmation applies only to the reviewed service history in this
          tab&apos;s memory. Editing automatically removes confirmation.
        </p>
      </div>

      {needsAcknowledgement ? (
        <label className="warningAcknowledgement">
          <input
            type="checkbox"
            checked={warningsAcknowledged}
            disabled={confirmed}
            onChange={(event) =>
              onWarningsAcknowledged(event.target.checked)
            }
          />
          I have reviewed {warningCount}{" "}
          {warningCount === 1 ? "warning" : "warnings"} and accept preserving
          the uncertainties.
        </label>
      ) : null}

      <button
        className="primaryButton"
        type="button"
        disabled={confirmed || blocked}
        onClick={onConfirm}
      >
        {confirmed
          ? "Service history confirmed"
          : "Confirm reviewed service history"}
      </button>

      {errors.length > 0 ? (
        <p className="confirmationBlocker" role="alert">
          Correct {errors.length}{" "}
          {errors.length === 1 ? "error" : "errors"} before confirmation.
        </p>
      ) : null}
    </div>
  );
}

function ConfidenceBadge({
  value,
  label,
}: Readonly<{ value: number; label?: string }>) {
  const level = value >= 0.8 ? "high" : value >= 0.5 ? "medium" : "low";
  const text =
    level === "high" ? "High" : level === "medium" ? "Medium" : "Low";

  return (
    <span className={`confidenceBadge confidence-${level}`}>
      {label ? `${label}: ` : ""}
      {text} ({Math.round(value * 100)} %)
    </span>
  );
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function updateActionComponent(
  action: ServiceAction,
  componentCode: ComponentCode,
): ServiceAction {
  const currentTaxonomyLabel = getComponentLabel(action.component_code);
  const shouldUpdateLabel =
    action.component_label.trim() === "" ||
    action.component_label === currentTaxonomyLabel;

  return {
    ...action,
    component_code: componentCode,
    component_label: shouldUpdateLabel
      ? getComponentLabel(componentCode)
      : action.component_label,
  };
}

function normalizedDateDescription(
  date: ReturnType<typeof normalizeServiceDate>,
): string {
  switch (date.status) {
    case "missing":
      return "Unknown";
    case "valid":
      return date.value ?? "Unknown";
    case "unverified":
      return `${date.value ?? "Unknown"} (precision unclear)`;
    case "invalid":
      return "Invalid date";
  }
}

function datePrecisionDescription(
  precision:
    | NonNullable<ServiceEvent["service_date"]>["precision"]
    | undefined,
): string {
  switch (precision) {
    case "day":
      return "Day, month, and year were identified.";
    case "month":
      return "Month and year were identified.";
    case "year":
      return "Only the year was identified.";
    case "unknown":
      return "Complete the date in a supported format.";
    default:
      return "Enter the date if it is known.";
  }
}

function formatKilometres(value: number): string {
  return new Intl.NumberFormat("fi-FI", {
    maximumFractionDigits: 6,
  }).format(value);
}
