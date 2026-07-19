# Deployment

This guide deploys the Phase 9 MVP as one stateless Next.js application. The
application must not be connected to a database, object store, persistent
cache, analytics recorder, or session-replay service.

## 1. Runtime requirements

- Node.js 22 LTS is recommended; `package.json` requires Node.js 20.9 or newer.
- Install exactly the committed dependency graph with `npm ci`.
- The runtime must support Next.js Node routes and requests that can run for up
  to 300 seconds.
- Production traffic must use HTTPS from the browser to the application.
- The deployment platform and every proxy in front of it must support the
  configured multipart request size. Many serverless and managed proxies impose
  a smaller request limit than this application.

The application is stateless. Scaling to multiple instances is safe for user
data, but the built-in coarse rate limiter is process-local and intentionally
non-persistent.

## 2. Environment

Copy `.env.example` into the deployment platform's secret configuration. Never
commit an environment file or expose the API key through a `NEXT_PUBLIC_`
variable.

```dotenv
OPENAI_API_KEY=
OPENAI_EXTRACTION_MODEL=
OPENAI_EXTRACTION_TIMEOUT_MS=180000
OPENAI_RESEARCH_MODEL=
OPENAI_RESEARCH_TIMEOUT_MS=180000
MAX_UPLOAD_FILES=10
MAX_UPLOAD_BYTES_PER_FILE=20971520
MAX_UPLOAD_REQUEST_BYTES=210763776
```

Choose configurable models that support the Responses API features used by the
corresponding workflow. The server sets `store: false` on every OpenAI Responses
API request. This application does not promise provider-side zero retention;
the Finnish privacy page deliberately points users to the provider's applicable
policies.

## 3. Build and verify

Run all gates from a clean checkout:

```bash
npm ci
npm run lint
npm run privacy:audit
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser suite builds the production application and exercises the desktop
and mobile projects. It includes the three-document synthetic workflow from
upload through JSON and Excel export. No real document is required.

## 4. Start

For a plain Node deployment:

```bash
npm run build
npm start
```

Bind the application to a private interface when a reverse proxy terminates
TLS. Configure the proxy to forward the original `Origin` and a trusted
`X-Forwarded-For` value. Do not accept client-supplied forwarding headers unless
the trusted ingress replaces them.

## 5. Ingress and platform policy

Configure the ingress, WAF, or platform with these rules:

- Enforce HTTPS and redirect HTTP before application traffic.
- Do not cache HTML, API responses, or downloads generated in the browser.
- Do not log request or response bodies for `/api/extract`,
  `/api/resolve-vehicle`, or `/api/research`.
- Do not enable payload capture, session replay, or automatic form-field
  collection.
- Redact query strings and sensitive headers in infrastructure logs.
- Permit the configured multipart size for `/api/extract`; reject larger bodies
  before buffering them where the platform supports streaming limits.
- Allow at least the configured OpenAI timeout plus platform overhead. The app
  route advertises a 300-second maximum duration.
- Add deployment-level IP or network rate limits. The application limits are a
  bounded, coarse, process-local safety layer and are not a distributed abuse
  control.

The application uses same-origin checks on mutating API routes. If a gateway
rewrites the public host or scheme, preserve enough forwarding information for
Next.js to construct the same public origin.

## 6. Security headers

The production build sends:

- `Cache-Control: no-store` and `Pragma: no-cache`
- a restrictive Content Security Policy
- `Permissions-Policy` with camera, location, microphone, payment, USB, and
  browsing-topics disabled
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- frame, MIME-sniffing, referrer, and DNS-prefetch protections
- HSTS in production

The current static Next.js Content Security Policy allows inline scripts and
styles for framework hydration and component styling. It still restricts
scripts, network connections, frames, objects, fonts, and media to the
application origin, while allowing local `blob:` connections and
`blob:`/`data:` image previews. A
nonce-based policy would be a future defense-in-depth improvement.

## 7. Smoke test after deployment

Use only the built-in synthetic demo for the first production verification:

1. Open the home page and verify the privacy statement and Phase 9 indicator.
2. Load the synthetic demo. Confirm that no `/api/*` request is made.
3. Inspect the conflicting-source and insufficient-evidence states.
4. Download JSON and Excel and verify both open locally.
5. Reload the page and verify that the vehicle, events, research, and report are
   gone.
6. Upload generated synthetic test images in a non-production test environment
   to verify the configured request size and provider timeouts.

Never use real personal documents for a deployment smoke test.

## 8. Operational boundaries

- There is no application database, account, queue, background job, or
  persistent cache.
- A process restart loses only rate-limit counters; user analysis is already
  confined to browser memory.
- Local browser exports are controlled by the user after download.
- Infrastructure and OpenAI provider retention are outside the application's
  in-memory boundary and must be described accurately in the deployment's
  privacy notice.
- If an incident could have exposed request content, disable the affected API
  route or deployment, rotate the server-side OpenAI key, inspect only
  metadata-safe infrastructure logs, and do not copy request bodies into an
  incident ticket.

## 9. Rollback

Deploy the previously verified immutable build. A rollback needs no data
migration because the application has no persistent application data. Re-run
the privacy audit and synthetic browser smoke test after rollback.
