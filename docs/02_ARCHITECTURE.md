# Architecture

## Recommended shape

Use one deployable Next.js application:

```text
Browser
  ├─ vehicle form and in-memory session state
  ├─ image upload
  ├─ Canvas-based manual redaction
  ├─ sanitized Blob generation
  ├─ editable extraction result
  ├─ deterministic status calculations
  └─ local JSON/Excel export
        │
        ├── POST /api/extract
        │      └─ OpenAI Responses API: image input + Structured Outputs
        │
        ├── POST /api/resolve-vehicle
        │      └─ OpenAI Responses API: web search
        │
        └── POST /api/research
               ├─ OpenAI Responses API: web search research memo
               └─ OpenAI Responses API: strict normalization of the memo
```

No database, file bucket, queue, or background worker is required.

## Why a server route still exists

The OpenAI API key must not be exposed to the browser. Server routes are a security boundary and API adapter, not a persistence layer.

## State ownership

| Data | Owner | Lifetime |
|---|---|---|
| Original images | Browser only | Until user removes them or closes/reloads |
| Redaction rectangles | Browser only | Current session |
| Sanitized image blobs | Browser, then transient request body | Current request |
| Extracted events | Browser state | Current session |
| Vehicle candidates | Browser state | Current session |
| Research results | Browser state | Current session |
| Export file | Generated locally | User-controlled download |
| Server logs | Operational metadata only | Hosting-provider policy |

## Suggested module boundaries

```text
src/
  app/
    page.tsx
    api/
      extract/route.ts
      resolve-vehicle/route.ts
      research/route.ts
  components/
    vehicle/
    upload/
    redaction/
    extraction-review/
    research/
    report/
  domain/
    schemas/
    service-events/
    maintenance/
    status-engine/
    units/
    sources/
  lib/
    openai/
    privacy/
    export/
    validation/
  tests/
```

## API contracts

### `POST /api/extract`

Input: multipart form data containing sanitized image files only, an image manifest with client-generated IDs, and optional vehicle hints.

Output: `service-history.schema.json`.

### `POST /api/resolve-vehicle`

Input: `VehicleInput`.

Output: zero or more candidate variants with confidence, distinguishing evidence, and sources. When confidence is insufficient, require user confirmation instead of auto-selecting.

### `POST /api/research`

Input:

- confirmed `VehicleVariant`,
- current odometer,
- optional market/country,
- relevant component list derived from extracted events and standard maintenance categories.

Output: `maintenance-research.schema.json`.

## Response headers

API routes should use:

```http
Cache-Control: no-store, max-age=0
Pragma: no-cache
X-Content-Type-Options: nosniff
```

Configure the hosting platform not to cache request bodies or API responses.

## Deployment

A serverless deployment is acceptable if:

- request and response body logging is disabled,
- no persistent filesystem assumption is made,
- file sizes fit platform limits,
- execution time is sufficient for web search,
- temporary files are not written unless unavoidable and are deleted in `finally`.

Prefer in-memory buffers.
