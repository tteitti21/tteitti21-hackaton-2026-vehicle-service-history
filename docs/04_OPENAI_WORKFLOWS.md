# OpenAI workflows

Use the official OpenAI SDK and Responses API. Keep model IDs configurable.

## Workflow A: document extraction

Purpose: read sanitized document images and return service events.

Requirements:

- input images are sanitized browser-generated blobs,
- no web search,
- `store: false`,
- strict output validation against `service-history.schema.json`,
- one retry after a schema/validation failure,
- return per-field confidence and image reference,
- do not infer a maintenance event that is not evidenced by the images,
- preserve ambiguity and illegible text.

Prompt source: `prompts/EXTRACTION_SYSTEM_PROMPT.md`.

Suggested model class: a current model supporting image input and Structured Outputs. Use a cost-balanced model by default and allow environment-variable override.

## Workflow B: vehicle-variant resolution

Purpose: identify plausible exact variants before researching intervals.

Input includes the user-entered vehicle attributes. Use web search.

Return:

- candidate variants,
- match confidence,
- fields that match,
- fields that conflict,
- missing distinguishing fields,
- source links.

Rules:

- do not auto-confirm a candidate below the configured confidence threshold,
- do not treat registration year and model year as automatically identical,
- power output alone is insufficient when multiple engines/transmissions match,
- prefer the user’s explicit engine/transmission code,
- ask the UI to obtain confirmation when ambiguous.

## Workflow C: maintenance research

A robust implementation uses two calls.

### C1: source-backed research memo

Use web search and ask the model to find maintenance intervals for the confirmed variant.

The memo must:

- search first for official manufacturer documentation,
- include exact variant applicability,
- identify market differences,
- preserve original units,
- include source URLs and titles,
- quote only short necessary evidence,
- identify conflicts,
- say when evidence is insufficient.

Do not calculate current status here.

Prompt source: `prompts/RESEARCH_SYSTEM_PROMPT.md`.

### C2: strict normalization

Send the research memo and captured source metadata to a second Responses API call without web search.

The normalizer must:

- use only the supplied memo and source metadata,
- return `maintenance-research.schema.json`,
- never add a source or interval,
- convert miles to kilometres using 1.609344,
- preserve original values,
- mark compatibility and authority,
- mark unresolved conflicts.

This two-step design separates web browsing/citations from strict machine-readable output. A one-call implementation is acceptable only when it reliably preserves citations and passes the same validation tests.

## Workflow D: report explanation

Optional. Generate concise Finnish explanations only after deterministic statuses exist.

The model may explain:

- why a component has a status,
- what source uncertainty means,
- what the user should verify.

It must not change the status or interval.

## OpenAI request settings

- Use `store: false`.
- Do not use background mode.
- Do not upload images to a persistent OpenAI file resource for the MVP; send request-scoped image input.
- Add timeouts and abort handling.
- Apply rate limiting.
- Return safe user-facing errors without exposing provider payloads or secrets.
- Record only non-sensitive operational metrics, such as duration and success/failure category.

## Provider disclosure

The UI and privacy text must distinguish:

1. the application does not persist user content in its own database/storage,
2. sanitized content is transmitted to OpenAI for processing,
3. API inputs/outputs are not used to train OpenAI models by default,
4. provider retention and abuse-monitoring policies may still apply,
5. zero data retention must not be claimed unless the API organization is actually approved and configured for it.

## Current official references

Verify API syntax against current documentation during implementation:

- https://platform.openai.com/docs/quickstart
- https://developers.openai.com/api/docs/models
- https://platform.openai.com/docs/guides/images-vision
- https://platform.openai.com/docs/guides/tools-web-search
- https://platform.openai.com/docs/guides/structured-outputs
- https://platform.openai.com/docs/models/default-usage-policies-by-endpoint
- https://openai.com/enterprise-privacy/
