# AutoHuolto AI

AutoHuolto AI is a privacy-first, stateless vehicle service-history analyzer.
Used-car maintenance evidence is commonly scattered across handwritten
service-book entries, workshop receipts, inspection papers, and photographs.
Understanding it requires the buyer or owner to reconcile dates, odometer
readings, component terminology, uncertain vehicle variants, and
model-specific maintenance intervals by hand.

The application turns user-redacted document images into an editable service
timeline, helps the user confirm the correct vehicle variant, researches
maintenance intervals with visible sources, calculates component status, and
exports a local report. It is intended to make fragmented records easier to
review without hiding uncertainty or treating AI output as mechanical advice.

## What the application does

1. Collects make, model, year, engine, transmission, market, and current
   odometer details.
2. Opens service-book and receipt images only in browser memory.
3. Lets the user redact identifiers, crop, and rotate images with a local
   Canvas editor.
4. Creates new sanitized PNG blobs and submits only the versions the user
   explicitly approves.
5. Extracts schema-validated maintenance events that the user can edit, add,
   remove, merge, and confirm.
6. Detects possible duplicates, invalid values, and chronological conflicts.
7. Finds source-backed vehicle candidates without auto-selecting an ambiguous
   variant.
8. Researches maintenance intervals using a source hierarchy and preserves
   conflicts, compatibility notes, original units, and insufficient-evidence
   results.
9. Calculates due and overdue status deterministically in application code.
10. Generates JSON and Excel reports locally without including image bytes.

There is no user account, application database, object store, persistent
cache, or background job. The complete product narrative is also available in
[`demo-vid/narration.txt`](demo-vid/narration.txt).

## How Codex and GPT-5.6 were used

### Codex: development acceleration

Codex was used as a development agent, not as the runtime maintenance
analyzer. Working from the phased MVP specification, it accelerated:

- scaffolding the Next.js, React, and TypeScript application;
- implementing browser-side upload, Canvas redaction, sanitized PNG creation,
  and approval controls;
- defining Zod schemas, API boundaries, normalization rules, and pure status
  functions;
- building vehicle-resolution, maintenance-research, report, JSON, and Excel
  workflows;
- writing unit, component, privacy, and Playwright end-to-end tests;
- diagnosing request-size, timeout, CI, responsive-layout, and development
  server failures from supplied logs;
- reviewing privacy boundaries, source traceability, error handling, and
  spreadsheet formula-injection protection.

The human developer defined the scope, supplied test observations and error
logs, reviewed behavior, requested changes, and verified each phase. Codex is
not part of the deployed request path and does not receive uploaded user
documents when the application runs.

### GPT-5.6: specification and runtime evidence processing

GPT-5.6 Sol in ChatGPT was used during planning to turn the original idea into
the MVP specification. The development process also used GPT-5.6 Sol through
Codex. At runtime, the model is selected through environment variables rather
than hard-coded. The checked-in `.env.example` uses `gpt-5.6-terra` as the
default extraction model, and vehicle resolution and research use the
configured research model or inherit that default.

GPT-5.6, or another configured model with the required Responses API features,
is used in three bounded product workflows:

| Workflow | Model input | Structured or validated output |
|---|---|---|
| Service-event extraction | User-approved sanitized PNG blobs and client-generated image IDs. Original files are not included. | Service events, raw evidence, normalized dates and odometers, actions, image references, confidence, and ambiguities. Output is checked with Zod; one bounded repair attempt is allowed after invalid structured output. |
| Vehicle-variant identification | Confirmed make, model, year, engine, transmission, country, and market fields. Images and current odometer are excluded from the web-search request. | Up to five candidates with matching, conflicting, and missing distinguishing fields plus preserved source links. Candidate normalization is schema-validated, and the user must explicitly select one. |
| Maintenance research | Confirmed variant, country, market, and component categories. Images, service-history contents, and current odometer are not sent to the research model. | A source-backed research memo followed by a separate strict normalized result containing intervals, compatibility, source authority, original units, conflicts, and insufficient-evidence outcomes. Source identifiers must trace back to the web-search response. |

Every OpenAI Responses API call keeps the API key on the server, uses
`store: false`, and returns data that is validated before entering application
state. Model output supplies evidence; it does **not** decide whether a
component is due or overdue. Pure TypeScript functions calculate status from
the reviewed service history, confirmed interval, current odometer, and
analysis date, so the same validated inputs produce the same result.

Model IDs remain configurable because deployments must choose a current model
that supports the required image input, web search, and Structured Outputs
features.

## Continuing development with Codex

Open `AGENTS.md` in the project root and follow it. Then read:

1. `CODEX_BUILD_SPEC.md`
2. `docs/05_IMPLEMENTATION_PHASES.md`
3. `docs/06_TESTING_AND_ACCEPTANCE.md`
4. `docs/07_PRIVACY_AND_SECURITY.md`

Build one phase at a time. Do not skip tests or privacy requirements.

## Architecture at a glance

- Next.js, TypeScript, and App Router
- one deployable web application
- server route APIs for OpenAI calls
- no database
- session state kept in browser memory
- manual image redaction with canvas before submission
- OpenAI Responses API:
  - image analysis
  - Structured Outputs
  - web search
- browser-side Excel export

The technical specification is in English because it is less ambiguous for Codex and source-code generation. The default user-interface language is English.

## Current implementation phase

Phase 9 completes the MVP with hardened browser headers, bounded in-process abuse
prevention, safe error states, an automated privacy audit, responsive mobile
views, browser accessibility checks, and a comprehensive Playwright workflow.
The built-in Nordica Aurora demo is entirely fictional, works without API calls,
and includes three synthetic document references, a mileage conversion, an
ambiguous event, a source conflict, and a missing service-history entry.

The MVP includes the vehicle form from earlier phases, browser-side image
redaction, and the stateless `/api/extract` endpoint. New PNG images explicitly
approved by the user are sent as request-scoped image content to the OpenAI
Responses API. `store: false`, a server-side API key, structured output, schema
validation, one bounded schema-repair attempt, a request timeout, and in-memory
rate limiting protect the workflow.

Extracted events, source-image references, readability, and confidence are shown
in an editable review table. The user can edit, add, remove, and merge events.
Empty or unreadable material is presented as an honest empty result, and a
provider error preserves local images for another attempt. The editable event
is identified by highlighting the entire row, an active button state, and a
sticky heading in the edit form.

The review view displays the normalized date, odometer reading converted to
kilometres, and canonical component classification beside the original image
evidence. Miles are converted for calculations with the exact factor `1.609344`,
while the original value and unit are preserved. Date precision is inferred
automatically from the input: `DD.MM.YYYY`, `MM.YYYY`, and `YYYY` correspond to
day, month, and year precision. Application code detects invalid dates and
odometer readings, possible duplicates, and chronology conflicts. The user must
correct errors, acknowledge visible uncertainties, and confirm the service
history separately. Every edit automatically removes confirmation.

`/api/extract` bypasses request-body buffering in the Next.js proxy. The endpoint
itself validates up to 10 images, 20 MiB per image, and an approximately 201 MiB
total multipart request with default settings. The submission preview displays
the byte sizes of sanitized PNG images, the HTTP request-body size received by
the server, and the applied total limit. Image or request contents are never
written to logs. The default image-extraction timeout is 180 seconds and can be
set from 5–240 seconds with `OPENAI_EXTRACTION_TIMEOUT_MS`. The extraction route
advertises a 300-second maximum execution time to the platform so that the
application can return a controlled timeout error.

After the service history is reviewed, `/api/resolve-vehicle` searches the web
for possible vehicle variants with the OpenAI Responses API web search tool.
The first request preserves the URLs used in the search, and a separate
Structured Outputs request normalizes up to five candidates. A candidate source
reference is accepted only when its server-generated source identifier belongs
to the original web search. Both requests use `store: false`, and no background
jobs are used.

The interface displays compatibility, matching and conflicting details, missing
disambiguating fields, and clickable sources. A candidate is never selected
automatically regardless of confidence: the user must select and confirm the
variant explicitly. The “None of these” path leaves the confirmed variant empty.
Candidates, sources, and the selected exact variant remain only in React memory
for the lifetime of the current tab.

Vehicle resolution uses `OPENAI_RESEARCH_MODEL` and the
`OPENAI_RESEARCH_TIMEOUT_MS` timeout. When they are empty, the settings inherit
the corresponding extraction environment variables and finally safe defaults.

For a confirmed vehicle variant, `/api/research` performs two-stage maintenance
interval research. The first OpenAI Responses API request uses the required web
search tool and produces a research memo that cites sources. The second
Structured Outputs request runs without web tools and receives only the memo
and the source list captured by the server. A normalized claim is accepted only
when its `source_id` belongs to that web search. Both requests use
`store: false`.

Application code selects the maintenance interval deterministically from the
source hierarchy: official manufacturer material has priority, and a weaker
source cannot silently override stronger compatible evidence. Different
intervals from the same best source tier are displayed as a conflict without
automatic selection. When reliable, variant-compatible evidence is unavailable,
the result is `insufficient_evidence`. Miles are converted to kilometres with
`1.609344`, while the original value and unit are preserved in the source
evidence.

Images, service-history contents, and the current odometer reading are not sent
to the research model. The research memo, sources, and result are request-scoped
and remain in the interface only in React memory for the current tab.

After maintenance interval research, component statuses are calculated in the
browser with pure TypeScript functions. Text returned by AI is not interpreted
as a status. The calculation selects the latest sufficiently reliable
replacement or service record, rejects future dates and impossible odometer
ordering, and applies source-conflict and insufficient-evidence states before
numeric calculation.

Distance and month thresholds use configurable immediate-need, warning, and
overdue-tolerance boundaries. When enough data is available, the result includes
used and remaining distance/time plus the estimated due odometer and date. If no
service record is found, the interface says “No service-history entry was found”
and does not claim that the service was not performed.

The completed report view combines the confirmed vehicle variant, reviewed
service history, deterministically calculated component statuses, and every
vehicle and maintenance-interval source with its uncertainty. The report can be
downloaded locally as a JSON or Excel file without a new network request.

The Excel export contains separate summary, service-history, component, and
source sheets. External text content is protected against formula injection
before it is written to cells. Images and their contents are excluded from both
export formats; only the session identifiers of service-event source images are
preserved as text for traceability.

## Prerequisites

- Node.js **20.9 or newer**; Node.js 22 LTS is recommended.
- npm; the repository records `npm@10.9.2` as its package manager.
- An OpenAI API key for live extraction, vehicle search, and maintenance
  research. The built-in synthetic demo and mocked tests do not require live
  API calls.
- Chromium for Playwright browser tests.

## Installation and startup

Install the exact dependency versions in `package-lock.json`:

```bash
npm ci
```

For live OpenAI workflows, copy `.env.example` to `.env.local` and add the API
key only to that local file. For example:

```powershell
Copy-Item .env.example .env.local
```

On macOS or Linux, use:

```bash
cp .env.example .env.local
```

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000`. To run the production build locally:

```bash
npm run build
npm start
```

Never commit `.env.local`, place a real key in `.env.example`, or expose the
key through a `NEXT_PUBLIC_` variable.

## Environment variables

`.env.example` is the authoritative secret-free template:

```dotenv
OPENAI_API_KEY=
OPENAI_EXTRACTION_MODEL=gpt-5.6-terra
OPENAI_EXTRACTION_TIMEOUT_MS=180000
OPENAI_RESEARCH_MODEL=
OPENAI_RESEARCH_TIMEOUT_MS=180000
MAX_UPLOAD_FILES=10
MAX_UPLOAD_BYTES_PER_FILE=20971520
```

| Variable | Required | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | Yes for live AI requests | Server-only credential used by `/api/extract`, `/api/resolve-vehicle`, and `/api/research`. It is not needed to browse the UI or load the built-in synthetic demo. |
| `OPENAI_EXTRACTION_MODEL` | No | Image-capable Responses API model used for structured service-event extraction. Blank or missing values fall back to `gpt-5.6-terra`. |
| `OPENAI_EXTRACTION_TIMEOUT_MS` | No | Extraction timeout in milliseconds. The accepted range is 5,000–240,000; the default is 180,000. |
| `OPENAI_RESEARCH_MODEL` | No | Model used for vehicle web search, candidate normalization, maintenance research, and research normalization. A blank value inherits the extraction model and then the application default. |
| `OPENAI_RESEARCH_TIMEOUT_MS` | No | Vehicle-resolution and maintenance-research timeout. It inherits the extraction timeout when blank and otherwise accepts 5,000–240,000 milliseconds. |
| `MAX_UPLOAD_FILES` | No | Maximum sanitized images per extraction request. The default is 10. |
| `MAX_UPLOAD_BYTES_PER_FILE` | No | Maximum bytes per sanitized PNG. The default is 20,971,520 bytes, or 20 MiB. |

The total multipart request limit is derived as
`MAX_UPLOAD_FILES × MAX_UPLOAD_BYTES_PER_FILE + 1 MiB` for multipart overhead.
The hosting platform or reverse proxy may impose a smaller independent limit.

## Safe demo workflow

The safest manual demonstration uses the built-in completed analysis and makes
no `/api/*` request:

1. Start the application with `npm run dev`.
2. Open the home page and read the privacy notice.
3. Select **Load synthetic demo** in the **Phase 9 / Synthetic demo** panel.
4. Review the fictional vehicle, editable service events, candidate variants,
   research conflicts, insufficient-evidence result, deterministic statuses,
   and source-backed report.
5. Download JSON and Excel locally.
6. Reload the page and confirm that the session disappears.

The demo uses reserved `.invalid` source domains. They are deliberately
non-resolving citations and must not be represented as real manufacturer
pages.

To demonstrate upload and redaction, use the identifier-free samples in
[`maintenance-image-samples/`](maintenance-image-samples/) or generated
fictional images in a test or non-production environment. Create the exact
submission preview, review it, and submit only if exercising the live API is
intentional. Never use a real registration, VIN, name, address, invoice, or
workshop customer record for a smoke test.

### Maintenance image samples

The root-level `maintenance-image-samples/` directory is intentionally easy to
reach from the browser file picker:

| File | Demonstration content |
|---|---|
| [`maintenance-demo-1.png`](maintenance-image-samples/maintenance-demo-1.png) | An anonymized maintenance table with dates, kilometre readings, and Finnish service descriptions from 2015–2020. |
| [`maintenance-demo-2.png`](maintenance-image-samples/maintenance-demo-2.png) | The continuation of the anonymized table with entries from 2021–2025. |

These PNGs contain no visible name, registration number, VIN, address, or
customer number, and no embedded text or EXIF metadata. They can be selected
together to demonstrate multi-image upload, local Canvas editing, sanitized
preview creation, structured extraction, and event review.

The files do not identify a vehicle variant, so pair them with fictional
vehicle-form data rather than presenting a guessed make or model as fact. If
the sanitized previews are submitted, they are transmitted to OpenAI and the
configured provider-retention policies and API costs apply. The no-network
**Load synthetic demo** workflow above remains the safest general smoke test.

## Synthetic sample data and fixtures

The built-in sample is defined in
[`src/demo/synthetic-demo.ts`](src/demo/synthetic-demo.ts):

| Field | Synthetic value |
|---|---|
| Vehicle | Nordica Aurora N2 |
| Model and registration year | 2021 |
| Powertrain | 1.8 hybrid, engine code N18-X, 110 kW, CVT/e-CVT, front-wheel drive |
| Market | Finland / Europe |
| Current odometer | 180,000 km |

Its three fictional service-document references contain:

- an engine-oil replacement on 10 January 2025 at `100000 mi`, normalized
  exactly to `160934.4 km`;
- an ambiguous June 2024 brake-fluid/brakes entry with no odometer;
- a timing-belt inspection on 14 February 2026 at `176000 km`, with no
  replacement claim.

The research fixture includes two candidate variants, conflicting timing-belt
intervals, an interval originally expressed in miles, and insufficient
evidence for engine coolant. This deliberately exercises uncertainty instead
of presenting a perfectly complete history.

The root-level PNGs are anonymized demonstration inputs, not application
fixtures containing personal data. Playwright separately creates fully
synthetic PNGs in browser memory:

- [`tests/e2e/full-workflow.spec.ts`](tests/e2e/full-workflow.spec.ts) generates
  three service-document images and runs the complete mocked workflow;
- [`tests/e2e/redaction.spec.ts`](tests/e2e/redaction.spec.ts) generates an
  image with a visible synthetic identifier, redacts it, intercepts the
  multipart request, and verifies that neither the original file nor its bytes
  were transmitted;
- [`src/test/extraction-request-fixture.ts`](src/test/extraction-request-fixture.ts)
  builds synthetic multipart API requests for route tests.

## Tests and quality gates

Install Playwright's Chromium build once:

```bash
npx playwright install chromium
```

Run the checks individually:

```bash
npm run lint
npm run privacy:audit
npm run typecheck
npm test
npm run test:e2e
npm run build
```

The commands cover:

- `npm run lint` — ESLint with zero warnings allowed;
- `npm run privacy:audit` — repository privacy and secret-pattern guardrails;
- `npm run typecheck` — TypeScript validation without emitting files;
- `npm test` — Vitest unit and React component tests;
- `npm run test:e2e` — a production build followed by the Playwright desktop
  and mobile workflows;
- `npm run build` — the production Next.js build.

Use `npm run test:watch` for local Vitest watch mode.

## Privacy model

AutoHuolto AI is application-stateless, not a claim of provider-side zero data
retention.

- Original image files remain in browser memory. The user manually redacts
  identifiers before submission.
- The browser renders the edited pixels into new sanitized PNG blobs. The
  original file and its EXIF metadata are not used in the multipart submission
  package.
- The user sees the exact sanitized previews, confirms that identifiers have
  been covered, and explicitly approves them. Only those approved sanitized
  blobs are submitted to OpenAI for extraction.
- The vehicle-resolution model receives confirmed variant fields, not document
  images or the current odometer. The maintenance-research model receives the
  confirmed variant, country, market, and component categories, not images,
  service-history text, or the odometer.
- Vehicle details, images, extracted events, candidates, research, statuses,
  and reports remain in React memory for the current tab. The application has
  no account, database, file bucket, persistent cache, localStorage, or
  IndexedDB for analysis data.
- JSON and Excel exports are generated locally. Images are excluded from both
  formats.
- OpenAI Responses API calls use `store: false`; background mode and persistent
  OpenAI file resources are not used.
- Request bodies, image bytes, extracted text, vehicle identifiers, and report
  contents must not be logged. Only non-sensitive operational metadata may be
  recorded.
- Closing or reloading the page clears the application session. Provider and
  hosting-platform retention or abuse-monitoring policies may still apply to
  transmitted sanitized content, so the project does not claim that nothing
  is retained anywhere.

See [`docs/07_PRIVACY_AND_SECURITY.md`](docs/07_PRIVACY_AND_SECURITY.md) for
the complete privacy and threat model.

## Limitations and uncertainty handling

- Redaction is manual. The application does not promise automatic detection of
  every name, registration number, VIN, address, or other identifier.
- Image extraction depends on legibility and document quality. Empty,
  illegible, low-confidence, or ambiguous evidence is reported honestly and
  remains editable by the user.
- A normalized event does not erase its raw evidence. Date precision,
  confidence, original odometer value, and original unit remain visible.
- Candidate vehicles are suggestions. Matching power alone is insufficient,
  ambiguous candidates are never selected automatically, and unresolved
  engine, transmission, year, or market details remain visible.
- Maintenance intervals vary by model year, engine, transmission, market, and
  operating conditions. Official compatible sources outrank weaker sources;
  credible conflicts are preserved rather than averaged.
- When a credible compatible interval cannot be found, the result is
  `insufficient_evidence`. Conflicting best-tier sources produce
  `conflicting_sources`. The analyzer does not invent a source or interval to
  fill a blank.
- Missing service-history evidence means only that no entry was found. It is
  not proof that maintenance was not performed.
- Statuses are limited to **OK**, **Due soon**, **Due**, **Overdue**,
  **Unknown**, **Insufficient evidence**, and **Conflicting sources**. They are
  deterministic calculations from the reviewed data and configured thresholds,
  not mechanical diagnoses or language-model opinions.
- The report does not replace a physical inspection, manufacturer schedule,
  workshop diagnosis, or professional advice.
- The session cannot be recovered after a reload or closed tab. Export the
  report before leaving if it should be kept.
- Live extraction and web research depend on OpenAI availability, source
  availability, request limits, timeouts, and deployment-platform constraints.
  The application cannot guarantee reliable maintenance evidence for every
  vehicle variant.

Production requirements, proxy privacy constraints, the synthetic smoke test,
and operating limits are documented in
[`docs/09_DEPLOYMENT.md`](docs/09_DEPLOYMENT.md).
