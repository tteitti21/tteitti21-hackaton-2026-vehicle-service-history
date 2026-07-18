# AGENTS.md

## Mission

Build the privacy-first, stateless vehicle service-history analyzer described in `CODEX_BUILD_SPEC.md`.

The product language is Finnish. Code, type names, comments, tests, and technical documentation should be English unless a user-facing Finnish string is required.

## Mandatory reading order

Before changing code, read:

1. `CODEX_BUILD_SPEC.md`
2. `docs/01_PRODUCT_SCOPE.md`
3. `docs/02_ARCHITECTURE.md`
4. `docs/03_DATA_AND_STATUS_RULES.md`
5. `docs/04_OPENAI_WORKFLOWS.md`
6. `docs/05_IMPLEMENTATION_PHASES.md`
7. `docs/06_TESTING_AND_ACCEPTANCE.md`
8. `docs/07_PRIVACY_AND_SECURITY.md`

Read JSON Schemas from `schemas/` before implementing API contracts.

## Non-negotiable constraints

- Do not add a database.
- Do not add user accounts.
- Do not persist uploaded images, extracted events, vehicle details, research results, or reports.
- Do not send the original image to the backend after redaction. Generate a new sanitized image blob in the browser and send only that blob.
- Do not log request bodies, image bytes, extracted OCR text, vehicle registration numbers, VINs, names, addresses, or report contents.
- Keep the OpenAI API key server-side.
- Set `store: false` on OpenAI Responses API requests.
- Do not claim zero retention by the model provider. The app itself must be stateless, while the UI must disclose that provider retention policies may still apply.
- Use OpenAI Structured Outputs or schema validation for machine-readable model output.
- AI may extract evidence and research intervals. Application code must calculate due/overdue statuses.
- Never invent a maintenance interval or source. Return `insufficient_evidence` when credible evidence is unavailable.
- Every maintenance recommendation shown to the user must be traceable to one or more sources.
- Treat exact model/year/engine/transmission/market compatibility as a first-class uncertainty.
- Convert imperial distances to kilometres before presenting or calculating. Preserve the original unit and value in source evidence when useful.
- Do not implement background jobs, queues, or persistent caches in the MVP.

## Working method

Implement phases in the order defined in `docs/05_IMPLEMENTATION_PHASES.md`.

For each phase:

1. State the phase goal.
2. Inspect the existing code.
3. Make the smallest coherent implementation.
4. Add or update tests.
5. Run lint, type-check, unit tests, and relevant end-to-end tests.
6. Report files changed, commands run, and remaining limitations.
7. Stop after the phase if the user asked for phase-by-phase execution.

Do not silently widen the scope.

## Technology defaults

Unless the repository already has an equivalent stack:

- Next.js with TypeScript and App Router
- React
- Zod for runtime validation
- Vitest and React Testing Library
- Playwright for critical browser flows
- Official OpenAI JavaScript/TypeScript SDK
- `exceljs` or an equivalent browser-compatible library for client-side Excel export
- Native Canvas APIs for redaction
- CSS Modules or the project’s existing styling solution

Pin compatible dependency versions in the lockfile. Keep the OpenAI model configurable with environment variables instead of hard-coding it.

## Required environment variables

Create `.env.example`, never commit secrets:

```dotenv
OPENAI_API_KEY=
OPENAI_EXTRACTION_MODEL=
OPENAI_RESEARCH_MODEL=
MAX_UPLOAD_FILES=10
MAX_UPLOAD_BYTES_PER_FILE=20971520
```

Use a current OpenAI model that supports image input, Structured Outputs, and the Responses API. The exact model must remain configurable.

## Definition of done

The MVP is done only when:

- a user can enter a vehicle description,
- upload multiple images,
- redact them locally,
- verify that only sanitized blobs are submitted,
- extract editable service events,
- confirm or correct the vehicle variant,
- run source-backed web research for that variant,
- calculate component statuses deterministically,
- inspect source links and uncertainty,
- export JSON and Excel,
- reload the page and confirm that no previous analysis remains,
- pass privacy, schema, calculation, and end-to-end acceptance tests.
