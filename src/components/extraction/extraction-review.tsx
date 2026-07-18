"use client";

import { useState } from "react";

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
  type ServiceAction,
  type ServiceEvent,
} from "@/domain/schemas/service-history";

const actionTypes = [
  "replaced",
  "serviced",
  "repaired",
  "inspected",
  "adjusted",
  "unknown",
] as const;

const precisionOptions = ["day", "month", "year", "unknown"] as const;
const odometerUnits = ["km", "mi", "unknown"] as const;

const actionTypeLabels: Record<(typeof actionTypes)[number], string> = {
  replaced: "Vaihdettu",
  serviced: "Huollettu",
  repaired: "Korjattu",
  inspected: "Tarkastettu",
  adjusted: "Säädetty",
  unknown: "Epäselvä",
};

const precisionLabels: Record<(typeof precisionOptions)[number], string> = {
  day: "Päivä",
  month: "Kuukausi",
  year: "Vuosi",
  unknown: "Epäselvä",
};

export function ExtractionReview() {
  const {
    state,
    replaceServiceHistory,
    updateServiceEvent,
  } = useAnalysisSession();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [mergeSelection, setMergeSelection] = useState<Set<string>>(new Set());
  const history = state.serviceHistory;

  if (state.extractionStatus === "idle" && history === null) {
    return (
      <section
        className="extractionSection"
        aria-labelledby="extraction-review-heading"
      >
        <p className="sectionLabel">Vaihe 3 / Poiminnan tarkistus</p>
        <h2 id="extraction-review-heading">
          Poimitut huoltotapahtumat näkyvät tässä.
        </h2>
        <div className="emptyExtractionState">
          <span aria-hidden="true">03</span>
          <p>
            Luo ja hyväksy peitetyt lähetysversiot yllä. Poiminta käynnistyy
            vain erillisestä painikkeesta, eikä tulosta tallenneta pysyvästi.
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
        <p className="sectionLabel">Vaihe 3 / Poiminnan tarkistus</p>
        <h2 id="extraction-review-heading">Kuvia käsitellään OpenAI:lla…</h2>
        <div className="extractionProgress" role="status" aria-live="polite">
          <span aria-hidden="true" />
          <div>
            <strong>Poimitaan näkyvää huoltohistoriaa</strong>
            <p>
              Selaimen paikalliset kuvat ja lähetysversiot säilyvät muistissa
              myös virheen aikana.
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
        <p className="sectionLabel">Vaihe 3 / Poiminnan tarkistus</p>
        <h2 id="extraction-review-heading">Poiminta ei onnistunut.</h2>
        <div className="extractionError" role="alert">
          <strong>Kuvat säilyvät selaimen muistissa.</strong>
          <p>{state.extractionError}</p>
          <p>Voit tarkistaa lähetysversiot ja yrittää uudelleen yllä.</p>
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
          <p className="sectionLabel">Vaihe 3 / Poiminnan tarkistus</p>
          <h2 id="extraction-review-heading">
            Tarkista jokainen kuvista poimittu tapahtuma.
          </h2>
        </div>
        <div className="extractionSummary">
          <strong>{history.events.length}</strong>
          <span>
            {history.events.length === 1 ? "tapahtuma" : "tapahtumaa"}
          </span>
        </div>
      </div>

      <ImageReadability history={history} />

      {history.warnings.length > 0 ? (
        <div className="extractionWarnings" role="status">
          <strong>Poiminnan varoitukset</strong>
          <ul>
            {history.warnings.map((warning, index) => (
              <li key={`${index}-${warning}`}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="reviewActions">
        <button className="primaryButton" type="button" onClick={addManualEvent}>
          Lisää tapahtuma
        </button>
        <button
          className="secondaryButton"
          type="button"
          disabled={mergeSelection.size < 2}
          onClick={mergeEvents}
        >
          Yhdistä valitut ({mergeSelection.size})
        </button>
      </div>

      {history.events.length === 0 ? (
        <div className="honestEmptyResult">
          <strong>Kuvista ei löytynyt varmistettavaa huoltotapahtumaa.</strong>
          <p>
            Tämä ei tarkoita, ettei huoltoja olisi tehty. Tarkista kuvien
            luettavuus ja lisää tarvittaessa käyttäjän tiedossa oleva tapahtuma
            itse.
          </p>
        </div>
      ) : (
        <div className="reviewTableFrame">
          <table className="reviewTable">
            <thead>
              <tr>
                <th scope="col">Yhdistä</th>
                <th scope="col">Lähdekuva</th>
                <th scope="col">Päivä</th>
                <th scope="col">Mittari</th>
                <th scope="col">Toimenpiteet</th>
                <th scope="col">Luottamus</th>
                <th scope="col">
                  <span className="visuallyHidden">Toiminnot</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {history.events.map((event) => (
                <tr key={event.event_id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Valitse tapahtuma ${event.event_id} yhdistettäväksi`}
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
                    <div className="sourceReferences">
                      {event.source_image_ids.map((imageId) => (
                        <code key={imageId}>{imageId}</code>
                      ))}
                    </div>
                  </td>
                  <td>{event.service_date?.value || "Ei tiedossa"}</td>
                  <td>
                    {event.odometer
                      ? `${event.odometer.value.toLocaleString("fi-FI")} ${event.odometer.unit}`
                      : "Ei tiedossa"}
                  </td>
                  <td>
                    {event.actions.length > 0
                      ? event.actions
                          .map((action) => action.description)
                          .join(", ")
                      : "Ei tunnistettu"}
                  </td>
                  <td>
                    <ConfidenceBadge value={event.confidence} />
                  </td>
                  <td>
                    <div className="rowActions">
                      <button
                        type="button"
                        onClick={() => setSelectedEventId(event.event_id)}
                      >
                        Muokkaa
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteEvent(event.event_id)}
                      >
                        Poista
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
    </section>
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
    <div className="readabilityGrid" aria-label="Lähdekuvien luettavuus">
      {history.images.map((image) => (
        <article key={image.image_id}>
          <code>{image.image_id}</code>
          <ConfidenceBadge value={image.readability} label="Luettavuus" />
          <p>{image.notes ?? "Ei erillistä huomiota."}</p>
        </article>
      ))}
    </div>
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

  return (
    <div className="eventEditor" aria-labelledby="event-editor-heading">
      <div className="eventEditorHeading">
        <div>
          <p className="sectionLabel">Tapahtuman muokkaus</p>
          <h3 id="event-editor-heading">{event.event_id}</h3>
        </div>
        <ConfidenceBadge value={event.confidence} label="Kokonaisluottamus" />
      </div>

      <div className="eventEditorGrid">
        <label className="wideEditorField">
          <span>Raaka kuvasta luettu näyttö</span>
          <textarea
            value={event.raw_evidence}
            rows={3}
            onChange={(changeEvent) =>
              patchEvent({ raw_evidence: changeEvent.target.value })
            }
          />
        </label>

        <label>
          <span>Päivämäärä</span>
          <input
            value={event.service_date?.value ?? ""}
            placeholder="VVVV-KK-PP tai osittainen arvo"
            onChange={(changeEvent) =>
              patchEvent({
                service_date:
                  changeEvent.target.value === ""
                    ? null
                    : {
                        value: changeEvent.target.value,
                        precision: event.service_date?.precision ?? "unknown",
                        confidence: event.service_date?.confidence ?? 0.5,
                      },
              })
            }
          />
        </label>

        <label>
          <span>Päivämäärän tarkkuus</span>
          <select
            value={event.service_date?.precision ?? "unknown"}
            disabled={event.service_date === null}
            onChange={(changeEvent) => {
              if (event.service_date !== null) {
                patchEvent({
                  service_date: {
                    ...event.service_date,
                    precision: changeEvent.target
                      .value as (typeof precisionOptions)[number],
                  },
                });
              }
            }}
          >
            {precisionOptions.map((precision) => (
              <option key={precision} value={precision}>
                {precisionLabels[precision]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Matkamittarilukema</span>
          <input
            type="number"
            min="0"
            step="1"
            value={event.odometer?.value ?? ""}
            onChange={(changeEvent) =>
              patchEvent({
                odometer:
                  changeEvent.target.value === ""
                    ? null
                    : {
                        value: Math.max(0, Number(changeEvent.target.value)),
                        unit: event.odometer?.unit ?? "unknown",
                        confidence: event.odometer?.confidence ?? 0.5,
                      },
              })
            }
          />
        </label>

        <label>
          <span>Mittarin yksikkö</span>
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
          <span>Korjaamo</span>
          <input
            value={event.workshop ?? ""}
            onChange={(changeEvent) =>
              patchEvent({ workshop: changeEvent.target.value || null })
            }
          />
        </label>

        <label>
          <span>Tapahtuman luottamus 0–1</span>
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
          <span>Muistiinpanot</span>
          <textarea
            value={event.notes ?? ""}
            rows={2}
            onChange={(changeEvent) =>
              patchEvent({ notes: changeEvent.target.value || null })
            }
          />
        </label>
      </div>

      <fieldset className="sourceSelector">
        <legend>Lähdekuvat</legend>
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
          <h4>Toimenpiteet</h4>
          <button
            className="secondaryButton"
            type="button"
            onClick={() =>
              patchEvent({
                actions: [...event.actions, createManualServiceAction()],
              })
            }
          >
            Lisää toimenpide
          </button>
        </div>

        {event.actions.map((action, index) => (
          <div className="actionEditorRow" key={`${event.event_id}-${index}`}>
            <label>
              <span>Komponentti</span>
              <select
                value={action.component_code}
                onChange={(changeEvent) =>
                  updateAction(index, {
                    ...action,
                    component_code: componentCodeSchema.parse(
                      changeEvent.target.value,
                    ),
                  })
                }
              >
                {componentCodeSchema.options.map((componentCode) => (
                  <option key={componentCode} value={componentCode}>
                    {componentCode}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Nimi</span>
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
              <span>Toiminto</span>
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
              <span>Kuvaus</span>
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
              <span>Luottamus</span>
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
              Poista toimenpide
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfidenceBadge({
  value,
  label,
}: Readonly<{ value: number; label?: string }>) {
  const level = value >= 0.8 ? "high" : value >= 0.5 ? "medium" : "low";
  const text =
    level === "high" ? "Korkea" : level === "medium" ? "Keskitaso" : "Matala";

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
