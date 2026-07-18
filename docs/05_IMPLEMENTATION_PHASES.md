# Implementation phases

Build in order. Each phase must leave the project runnable.

## Phase 0 – scaffold and guardrails

Deliver:

- Next.js TypeScript project,
- lint, type-check, test, and Playwright commands,
- `.env.example`,
- Zod schemas/types,
- Finnish shell UI,
- no-store headers,
- request size validation,
- basic rate limiting abstraction,
- privacy disclosure page/panel,
- CI workflow.

Acceptance:

- no API key in browser bundle,
- no database package,
- all checks pass.

## Phase 1 – vehicle form and session model

Deliver:

- vehicle form,
- current odometer,
- country/market,
- validation,
- in-memory session state,
- reset-session action.

Acceptance:

- reload clears all data,
- invalid odometer/year combinations are rejected,
- no browser storage is used unless explicitly documented and disabled by default.

## Phase 2 – upload and client-side redaction

Deliver:

- 1–10 image upload,
- image previews,
- rotate and crop,
- rectangle redaction tool,
- undo/redo and reset,
- exact sanitized preview,
- sanitized Blob generation.

Acceptance:

- network test proves original file bytes are never posted,
- redacted pixels are permanently flattened into the outgoing image,
- metadata is stripped where practical,
- unsupported/oversized files are rejected before upload.

## Phase 3 – image extraction

Deliver:

- `/api/extract`,
- OpenAI image request,
- Structured Output parsing,
- retry/validation,
- extraction review table,
- confidence indicators,
- source-image references,
- edit/add/delete/merge controls.

Acceptance:

- model output cannot bypass schema validation,
- empty/illegible images produce an honest result,
- no user content appears in logs,
- provider error is handled without losing local images.

## Phase 4 – event normalization and review

Deliver:

- component taxonomy,
- raw evidence alongside normalized values,
- kilometre/date validation,
- duplicate detection,
- chronology warnings,
- explicit user confirmation.

Acceptance:

- user can correct every material extracted value,
- absence is never represented as proof of non-service,
- miles in evidence are converted correctly for calculations.

## Phase 5 – vehicle resolution

Deliver:

- `/api/resolve-vehicle`,
- web-search-backed candidates,
- compatibility explanation,
- user confirmation UI,
- “none of these” path.

Acceptance:

- ambiguous candidates are not auto-selected,
- source links are visible,
- exact selected variant is included in later research requests.

## Phase 6 – maintenance research

Deliver:

- `/api/research`,
- source hierarchy,
- research memo,
- strict normalized result,
- source and conflict UI,
- kilometre conversion.

Acceptance:

- every interval has traceable evidence,
- unsupported claims are rejected,
- conflicting sources remain visible,
- insufficient evidence is a normal supported outcome,
- no research result is cached persistently.

## Phase 7 – deterministic status engine

Deliver:

- pure functions for interval calculations,
- status categories,
- due-date/due-odometer projections,
- reason codes,
- component summary.

Acceptance:

- calculation tests cover kilometres, months, whichever-first, missing fields, future dates, chronology errors, source conflicts, and exact threshold boundaries,
- AI text cannot alter statuses.

## Phase 8 – report and export

Deliver:

- summary view,
- service-history table,
- component table,
- sources table,
- JSON export,
- Excel export generated locally.

Acceptance:

- export contains no hidden original images,
- exported content matches reviewed browser state,
- all distances are shown in kilometres,
- sources and uncertainty are preserved.

## Phase 9 – hardening and demo

Deliver:

- Playwright end-to-end test,
- accessibility review,
- responsive mobile UI,
- abuse/rate-limit behavior,
- safe error states,
- demo fixtures using synthetic documents,
- deployment instructions.

Acceptance:

- no real personal documents in repository or test fixtures,
- privacy statement is accurate,
- page reload erases the session,
- demo works from upload through export.
