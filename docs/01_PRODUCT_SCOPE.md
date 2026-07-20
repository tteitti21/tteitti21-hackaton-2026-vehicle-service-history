# Product scope

## Product name

Working name: **AutoHuolto AI**

## Problem

Used-car service histories are often distributed across handwritten service-book pages, workshop receipts, inspection papers, and seller-provided photographs. The buyer must manually interpret dates, odometer readings, components, terminology, and model-specific maintenance intervals.

## MVP outcome

The application converts user-redacted document images into an editable service-history timeline, researches maintenance intervals for the identified vehicle variant, calculates component status, and exports a report.

## Primary users

- a private used-car buyer,
- an owner organising an old vehicle’s service history,
- a seller preparing transparent documentation.

## Core user journey

1. Read the privacy disclosure.
2. Enter available vehicle information.
3. Upload 1–10 JPG, PNG, or WebP images.
4. Redact registration number, VIN, owner details, address, phone number, email, customer number, or other sensitive content locally in the browser.
5. Preview the exact sanitized images that will be transmitted.
6. Submit only the sanitized images for extraction.
7. Review, edit, add, delete, and merge extracted service events.
8. Resolve or confirm the exact vehicle variant.
9. Start web research for maintenance intervals.
10. Review evidence, source compatibility, and conflicts.
11. View deterministic component statuses.
12. Export JSON and Excel to the local device.
13. Close or reload the page; the session disappears.

## In scope

- Finnish UI.
- Any passenger-car make/model/variant for which web evidence can be found.
- Graceful failure when exact information cannot be verified.
- Multiple service-history images.
- Handwritten and printed documents.
- Editable extracted fields.
- Web search at analysis time.
- Source hierarchy and compatibility scoring.
- Kilometre-based presentation.
- Stateless server routes.
- Local report export.

## Out of scope for MVP

- User accounts.
- Database or cloud object storage.
- Payment handling.
- Automatic vehicle-registry lookup.
- Persistent report links.
- Dealer integrations.
- Automatic PII detection/redaction.
- Native mobile application.
- Guaranteed support for every vehicle.
- Mechanical diagnosis.
- A claim that the report replaces an inspection, workshop opinion, manufacturer schedule, or professional advice.

## Product truthfulness

The product may support arbitrary vehicle inputs, but it must not promise that reliable maintenance data exists for every variation. The correct fallback is:

> “The exact replacement interval could not be verified from sufficiently reliable sources compatible with this vehicle variant.”

## User-facing status categories

- **OK**
- **Due soon**
- **Due**
- **Overdue**
- **Unknown**
- **Insufficient evidence**
- **Conflicting sources**

The UI must distinguish calculated status from AI-generated explanation.
