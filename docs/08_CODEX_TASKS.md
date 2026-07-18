# Codex task prompts

Use these as separate Codex requests. Do not paste all tasks at once if working interactively.

## Task 1

Read `AGENTS.md` and all referenced specification files. Scaffold Phase 0 only. Do not implement OpenAI calls yet. Run all available checks and report exact commands and results.

## Task 2

Implement Phase 1: vehicle form and in-memory session state. Do not use localStorage, IndexedDB, cookies, or a database. Add tests.

## Task 3

Implement Phase 2: browser-only upload and redaction. Ensure outgoing data is a newly rendered sanitized Blob and not the original File. Add the network interception test.

## Task 4

Implement Phase 3: `/api/extract` using the official OpenAI SDK, request-scoped image input, `store: false`, and strict schema validation. Use a mocked provider in tests.

## Task 5

Implement Phase 4: editable review, normalization, component mapping, chronology warnings, and unit conversion.

## Task 6

Implement Phase 5: web-search-backed vehicle candidate resolution. Never auto-select an ambiguous variant. Preserve sources.

## Task 7

Implement Phase 6: two-stage maintenance research and strict normalization. Follow the source hierarchy and return insufficient evidence instead of guessing.

## Task 8

Implement Phase 7: deterministic component status engine as pure functions. Add complete boundary tests.

## Task 9

Implement Phase 8: report UI plus local JSON and Excel export. Prevent spreadsheet formula injection.

## Task 10

Implement Phase 9: hardening, privacy checks, responsive UI, synthetic demo data, deployment documentation, and full end-to-end tests.
