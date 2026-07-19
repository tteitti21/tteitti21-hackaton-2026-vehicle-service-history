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
  replaced: "Vaihdettu",
  serviced: "Huollettu",
  repaired: "Korjattu",
  inspected: "Tarkastettu",
  adjusted: "Säädetty",
  unknown: "Epäselvä",
};

const precisionLabels: Record<
  NonNullable<ServiceEvent["service_date"]>["precision"],
  string
> = {
  day: "Päivä",
  month: "Kuukausi",
  year: "Vuosi",
  unknown: "Epäselvä",
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
        <p className="sectionLabel">Vaihe 4 / Normalisointi ja vahvistus</p>
        <h2 id="extraction-review-heading">
          Poimitut huoltotapahtumat normalisoidaan tässä.
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
        <p className="sectionLabel">Vaihe 4 / Normalisointi ja vahvistus</p>
        <h2 id="extraction-review-heading">Kuvia käsitellään OpenAI:lla…</h2>
        <div className="extractionProgress" role="status" aria-live="polite">
          <span aria-hidden="true" />
          <div>
            <strong>Poimitaan näkyvää huoltohistoriaa</strong>
            <p>
              Usean suuren kuvan käsittely voi kestää muutaman minuutin.
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
        <p className="sectionLabel">Vaihe 4 / Normalisointi ja vahvistus</p>
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
          <p className="sectionLabel">Vaihe 4 / Normalisointi ja vahvistus</p>
          <h2 id="extraction-review-heading">
            Tarkista, normalisoi ja vahvista huoltohistoria.
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

      <ReviewDiagnostics
        errors={reviewAnalysis.errors}
        warnings={reviewAnalysis.warnings}
      />

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
                <th scope="col">Tapahtuma</th>
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
                      <div className="eventIdentity">
                        <code>{event.event_id}</code>
                        {isActive ? (
                          <span className="activeEventBadge">
                            Muokattavana
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
                        "Ei tiedossa"}
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
                        : "Ei tunnistettu"}
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
                              ? `Tapahtuma ${event.event_id} on muokattavana`
                              : `Muokkaa tapahtumaa ${event.event_id}`
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
                          {isActive ? "Muokattavana" : "Muokkaa"}
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
        <strong>Ei rakenteellisia ristiriitoja.</strong>
        <p>
          Päivämäärät ja mittarilukemat ovat validissa muodossa, eikä
          mahdollisia kaksoiskappaleita tai aikajärjestyksen ristiriitoja
          löytynyt.
        </p>
      </div>
    );
  }

  return (
    <div className="reviewDiagnostics" aria-label="Tarkistuksen havainnot">
      {errors.length > 0 ? (
        <div className="reviewIssueGroup reviewIssueErrors" role="alert">
          <strong>
            Korjaa ennen vahvistusta ({errors.length})
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
            Tarkista ja kuittaa ({warnings.length})
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
    return <>Ei tiedossa</>;
  }

  return (
    <span className="odometerSummary">
      <span>
        {event.odometer.value.toLocaleString("fi-FI")} {event.odometer.unit}
      </span>
      {normalized.status === "valid" &&
      normalized.kilometres !== null &&
      event.odometer.unit === "mi" ? (
        <small>{formatKilometres(normalized.kilometres)} km laskentaan</small>
      ) : null}
      {normalized.status === "unverified" ? (
        <small>Yksikkö tarkistettava</small>
      ) : null}
      {normalized.status === "invalid" ? (
        <small>Virheellinen lukema</small>
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
    <aside className="normalizationPreview" aria-label="Normalisoidut arvot">
      <strong>Normalisoidut arvot laskentaa varten</strong>
      <dl>
        <div>
          <dt>Päivämäärä</dt>
          <dd>{normalizedDateDescription(date)}</dd>
        </div>
        <div>
          <dt>Matkamittari</dt>
          <dd>
            {odometer.kilometres === null
              ? odometer.status === "missing"
                ? "Ei tiedossa"
                : "Ei käytetä ennen yksikön tai arvon korjausta"
              : `${formatKilometres(odometer.kilometres)} km`}
          </dd>
        </div>
        <div>
          <dt>Komponentit</dt>
          <dd>
            {components.length === 0
              ? "Ei tunnistettua komponenttia"
              : components
                  .map(({ label, originalCode, resolvedCode }) =>
                    originalCode === resolvedCode
                      ? label
                      : `${label} (tekstiehdotus)`,
                  )
                  .join(", ")}
          </dd>
        </div>
      </dl>
      <p>
        Alkuperäinen näyttö, lukema ja yksikkö säilyvät tapahtumassa.
        Muunnos ei muuta lähdearvoa.
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
          <p className="sectionLabel">Muokattavana juuri nyt</p>
          <h3 id="event-editor-heading">{event.event_id}</h3>
        </div>
        <div className="activeEditorStatus">
          <span className="activeEditIndicator">
            <span aria-hidden="true" />
            Aktiivinen muokkaus
          </span>
          <ConfidenceBadge
            value={event.confidence}
            label="Kokonaisluottamus"
          />
        </div>
      </div>

      <div className="evidenceComparison">
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
        <NormalizationPreview event={event} />
      </div>

      <div className="eventEditorGrid">
        <label>
          <span>Päivämäärä</span>
          <input
            aria-label="Päivämäärä"
            value={formatServiceDateInput(event.service_date)}
            placeholder="PP.KK.VVVV, KK.VVVV tai VVVV"
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
            Tarkkuus päätellään automaattisesti syötetystä muodosta. Myös
            ISO-muodot VVVV-KK-PP ja VVVV-KK hyväksytään.
          </small>
          {normalizedDate.status === "invalid" ? (
            <span
              className="fieldError"
              id="service-date-validation-error"
            >
              Tarkista, että päivämäärä on mahdollinen ja käyttää annettua
              muotoa.
            </span>
          ) : null}
        </label>

        <div
          className={`datePrecisionStatus datePrecision-${event.service_date?.precision ?? "missing"}`}
          role="status"
          aria-live="polite"
        >
          <span>Automaattinen tarkkuus</span>
          <strong>
            {event.service_date === null
              ? "Ei päivämäärää"
              : precisionLabels[event.service_date.precision]}
          </strong>
          <small>
            {datePrecisionDescription(event.service_date?.precision)}
          </small>
        </div>

        <label>
          <span>Päivämäärän luottamus 0–1</span>
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
          <span>Matkamittarilukema</span>
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
              Anna nolla tai positiivinen kokonaisluku.
            </span>
          ) : null}
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
          <span>Mittarilukeman luottamus 0–1</span>
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

        <label className="wideEditorField">
          <span>Epäselvyydet, yksi rivi kutakin huomiota kohti</span>
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
      <span>Teksti vastaa komponenttia: {label}</span>
      <button type="button" onClick={() => onApply(suggestion)}>
        Käytä ehdotusta {label}
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
        <p className="sectionLabel">Käyttäjän vahvistus</p>
        <h3 id="review-confirmation-heading">
          {confirmed
            ? "Huoltohistoria on vahvistettu."
            : "Vahvista tiedot ennen seuraavaa vaihetta."}
        </h3>
        <p>
          Vahvistus koskee vain tämän välilehden muistissa olevaa,
          tarkistettua huoltohistoriaa. Muokkaus poistaa vahvistuksen
          automaattisesti.
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
          Olen tarkistanut {warningCount}{" "}
          {warningCount === 1 ? "varoituksen" : "varoitusta"} ja hyväksyn
          epävarmuuksien säilyttämisen.
        </label>
      ) : null}

      <button
        className="primaryButton"
        type="button"
        disabled={confirmed || blocked}
        onClick={onConfirm}
      >
        {confirmed
          ? "Huoltohistoria vahvistettu"
          : "Vahvista tarkistettu huoltohistoria"}
      </button>

      {errors.length > 0 ? (
        <p className="confirmationBlocker" role="alert">
          Korjaa {errors.length}{" "}
          {errors.length === 1 ? "virhe" : "virhettä"} ennen vahvistusta.
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
      return "Ei tiedossa";
    case "valid":
      return date.value ?? "Ei tiedossa";
    case "unverified":
      return `${date.value ?? "Ei tiedossa"} (tarkkuus epäselvä)`;
    case "invalid":
      return "Virheellinen päivämäärä";
  }
}

function datePrecisionDescription(
  precision:
    | NonNullable<ServiceEvent["service_date"]>["precision"]
    | undefined,
): string {
  switch (precision) {
    case "day":
      return "Päivä, kuukausi ja vuosi tunnistettiin.";
    case "month":
      return "Kuukausi ja vuosi tunnistettiin.";
    case "year":
      return "Vain vuosi tunnistettiin.";
    case "unknown":
      return "Täydennä päivämäärä tuettuun muotoon.";
    default:
      return "Syötä päivämäärä, jos se on tiedossa.";
  }
}

function formatKilometres(value: number): string {
  return new Intl.NumberFormat("fi-FI", {
    maximumFractionDigits: 6,
  }).format(value);
}
