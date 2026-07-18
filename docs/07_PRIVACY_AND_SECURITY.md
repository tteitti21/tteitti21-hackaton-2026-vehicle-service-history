# Privacy and security

## Privacy model

The application is **application-stateless**, not “zero data retention”.

Accurate claim:

> The application does not intentionally persist uploaded images, extracted service events, vehicle details, research results, or reports in its own database or file storage. Sanitized images and analysis inputs are transmitted to OpenAI for request processing. OpenAI provider retention and abuse-monitoring policies may apply.

Do not claim:

- “The image never leaves your device” after the user starts analysis.
- “Nothing is stored anywhere.”
- “Zero data retention” unless the OpenAI organization has verified ZDR approval and configuration.

## Before upload

The user must see:

- that only the sanitized preview is transmitted,
- which provider receives the sanitized image,
- that registration number/VIN are not required for normal analysis,
- a reminder to redact personal and vehicle identifiers.

Require an explicit checkbox before the first analysis request.

## Data minimisation

Send only:

- sanitized images,
- user-entered vehicle fields necessary for the task,
- reviewed service events needed for research/status.

Do not send:

- original images,
- unnecessary EXIF metadata,
- browser identifiers,
- account identifiers,
- exact location,
- unrelated form fields.

## Server handling

- Stream or buffer request-scoped content in memory.
- Do not write temporary files unless required.
- If a temp file is unavoidable, use a random name, restrictive permissions, and delete it in `finally`.
- Disable body logging in framework, reverse proxy, and hosting platform where configurable.
- Sanitize thrown errors.
- Use request IDs unrelated to user data.
- Set timeouts.
- Reject excessive dimensions, decompression bombs, and unsupported formats.

## OpenAI handling

- Use the server-side SDK.
- Set `store: false`.
- Do not use background mode.
- Do not create persistent OpenAI file objects for images in the MVP.
- Document current provider data controls and link to official policy.
- Keep any optional data-sharing/feedback setting disabled.

## Browser state

Default:

- React memory only,
- no localStorage,
- no IndexedDB,
- no service-worker cache of analysis pages,
- no analytics replay.

A user-triggered local draft feature may be added later, but it is not MVP and must be opt-in and encrypted or clearly disclosed.

## Network and content security

- HTTPS only in production.
- Content Security Policy.
- Restrict image sources.
- Validate all outbound source URLs.
- Never render model-generated HTML.
- Escape spreadsheet values and prevent formulas beginning with `=`, `+`, `-`, or `@`.
- Rate-limit by a privacy-preserving coarse key.
- Add CSRF protections appropriate to the deployment architecture.
- Consider same-origin API routes.

## Threats to cover

- API-key theft,
- sensitive logging,
- original-file upload despite redaction,
- prompt injection in documents,
- prompt injection on researched web pages,
- fabricated URLs,
- wrong vehicle-variant match,
- malicious oversized image,
- spreadsheet formula injection,
- cross-user cache leakage,
- accidental server/CDN caching,
- model output displayed as trusted HTML.

## User control

Provide:

- remove-image button,
- reset-analysis button,
- visible “session not saved” state,
- export-before-leaving reminder,
- no automatic background submission.
