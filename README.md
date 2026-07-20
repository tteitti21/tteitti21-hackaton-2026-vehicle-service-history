# AutoHuolto AI – Codex implementation package

This package defines a privacy-first, stateless web application that:

1. accepts service-book and receipt images anonymized in the user's browser,
2. extracts a structured service history from the images with OpenAI API image analysis,
3. lets the user review and correct the extracted rows,
4. searches the web for maintenance and replacement intervals related to the vehicle variant,
5. calculates maintenance status deterministically in application code,
6. displays sources and uncertainties,
7. exports the result as JSON and Excel files,
8. does not use its own database or permanently store the user's images or reports.

## Starting instructions for Codex

Open `AGENTS.md` in the project root and follow it. Then read:

1. `CODEX_BUILD_SPEC.md`
2. `docs/05_IMPLEMENTATION_PHASES.md`
3. `docs/06_TESTING_AND_ACCEPTANCE.md`
4. `docs/07_PRIVACY_AND_SECURITY.md`

Build one phase at a time. Do not skip tests or privacy requirements.

## Recommended implementation

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

## Local development

Requirements:

- Node.js 20.9 or newer
- npm

Install dependencies and start the development server:

```bash
npm ci
npm run dev
```

If necessary, copy `.env.example` to `.env.local`. Do not store the API key in
source code or in a browser-visible `NEXT_PUBLIC_` variable.

## Quality gates

```bash
npm run lint
npm run privacy:audit
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Playwright requires a local Chromium installation:

```bash
npx playwright install chromium
```

Production environment requirements, proxy privacy constraints, environment
variables, the synthetic smoke test, and known operating limits are documented
in [`docs/09_DEPLOYMENT.md`](docs/09_DEPLOYMENT.md).
