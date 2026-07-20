# Data model and deterministic status rules

The canonical schemas are in `schemas/`.

## Vehicle identity

A maintenance interval is only as reliable as the vehicle match. Capture:

- make,
- model,
- generation or platform when known,
- model year,
- first registration year when distinct,
- engine displacement,
- engine code when known,
- power in kW,
- fuel type,
- transmission type and code when known,
- drivetrain,
- country/market,
- current odometer in kilometres.

Do not infer an exact variant from power alone when multiple combinations exist.

## Service-event normalisation

The extraction model returns both evidence as read from the document and normalized fields. Never discard the raw evidence. A user must be able to compare a normalized event with the recognized wording.

Examples:

- “jakopää”, “jakohihnasarja”, and “timing belt kit” can map to `timing_belt`,
- “ATF”, “automaattiöljy”, and “gearbox oil” can map to `transmission_fluid`,
- uncertain wording maps to `other` plus a label.

## Unit conversion

All UI calculations use kilometres and months.

Use exact conversion:

```text
kilometres = miles × 1.609344
```

Rules:

- keep the source’s original value/unit in evidence,
- round displayed maintenance intervals sensibly, normally to the nearest 1,000 km,
- do not round odometer evidence from a document,
- never accidentally treat miles as kilometres.

## Selecting the last relevant service

For each component:

1. include only events that confidently correspond to the component,
2. prefer a complete replacement/service over an inspection,
3. choose the latest event by date when available,
4. use odometer as a secondary ordering signal,
5. flag contradictions instead of silently choosing an impossible sequence.

## Interval representation

An interval may contain:

- `interval_km`,
- `interval_months`,
- both,
- operating-condition notes,
- a year/engine/transmission applicability range,
- source confidence,
- conflicts.

“Whichever comes first” applies when both distance and time are present.

## Deterministic calculation

Do not ask a model to decide whether a component is overdue.

For a confirmed interval and latest service:

```text
distance_used = current_odometer_km - last_service_odometer_km
months_used = months_between(last_service_date, analysis_date)

distance_remaining = interval_km - distance_used
months_remaining = interval_months - months_used
```

Evaluate only dimensions with known inputs.

### Status priority

1. `conflicting_sources` when credible compatible sources materially disagree and no rule resolves the conflict.
2. `insufficient_evidence` when no credible compatible interval exists.
3. `unknown` when the interval exists but required service evidence is missing or contradictory.
4. `overdue` when a known dimension exceeds its interval by more than the tolerance.
5. `due` when a dimension has reached the interval or is within the immediate-due threshold.
6. `due_soon` when within the warning threshold.
7. `ok` otherwise.

### Default thresholds

Keep thresholds configurable:

- immediate distance threshold: max(1,000 km, 2% of interval),
- warning distance threshold: max(5,000 km, 10% of interval),
- immediate time threshold: 1 month,
- warning time threshold: 3 months,
- overdue tolerance: 0 by default.

When one dimension is overdue and another is not, overdue wins.

## Missing service history

Absence of a row is not proof that work was not performed. Wording must be:

- “Huoltohistoriasta ei löytynyt merkintää”
- not “Huoltoa ei ole tehty”.

## Powertrain component inventory

Every status view and exported report must contain a complete standard
component inventory for the confirmed powertrain, including components with no
service-history event or verified interval. Missing entries use
`insufficient_evidence`; they must never be omitted or populated with a guessed
interval.

For a combustion vehicle with an automatic, CVT, dual-clutch, or automated
manual transmission, the inventory must include at least:

- engine oil and oil filter,
- automatic transmission fluid,
- timing belt and/or timing chain,
- brake fluid,
- fuel filter,
- engine air filter,
- cabin air filter,
- engine coolant.

Standard brakes, suspension, battery, tires, inspection, and other
powertrain-relevant schedule items remain visible as separate records. Pure
electric powertrains omit combustion-only items while retaining their relevant
cooling, transmission, cabin, chassis, and inspection records.

## Conflicting sources

Preserve every credible claim. Do not average intervals.

Show:

- source,
- claimed interval,
- matching vehicle attributes,
- mismatch or uncertainty,
- conservative interpretation if one is justified.

If the conflict cannot be resolved, status is `conflicting_sources`.

Each preserved claim and report source includes a deterministic
`trustworthiness_level` (`high`, `medium`, or `low`) derived from source
authority and vehicle compatibility. Component-level suggestion
trustworthiness is `low` for unresolved conflicts or insufficient evidence,
even when individual conflicting sources are high quality. The report must
provide a non-empty Finnish explanation for that level.

## Source-quality hierarchy

1. Manufacturer owner’s manual, service schedule, technical bulletin, or official documentation.
2. Manufacturer/importer/dealer documentation that clearly identifies the variant.
3. Reputable technical/service database or repair manual.
4. Established parts catalogue with explicit fitment and interval data.
5. Workshop article.
6. Forum, video, marketplace, or unsourced summary.

Lower-level sources may support discovery but must not silently override a higher-level compatible source.
