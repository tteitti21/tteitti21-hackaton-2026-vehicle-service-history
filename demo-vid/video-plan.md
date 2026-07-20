# AutoHuolto AI demonstration video plan

## Synchronization source

- Requested source paths: `demo/narration.mp3` and `demo/narration.txt`
- Actual source paths found in this checkout: `demo-vid/narration.mp3` and `demo-vid/narration.txt`
- Audio used for this plan: `demo-vid/narration.mp3`
- Exact media duration: **00:02:53.184** (**173.184 seconds**)
- Last recognized spoken word ends at **00:02:52.880**, leaving approximately **304 ms** of trailing silence.
- Timing method: Chromium decoded the MP3 to obtain its media duration. The MP3 was independently transcribed in English with word-level speech-recognition timestamps. Scene cuts below use recognized word starts from the audio, not timings estimated from the text file.
- Speech recognition also reported a rounded duration of 173.180 seconds. The decoded MP3 duration, 173.184 seconds, is used as the authoritative endpoint.

The requested `demo/` output directory is used for this plan. The narration inputs have not been moved or modified.

## Application flow verified in the repository

The implementation supports this sequence:

1. Enter and confirm make, model, generation, year, engine, transmission, market, country, and current odometer reading.
2. Select multiple maintenance-record images. They remain in browser memory.
3. Redact, crop, and rotate images with the browser Canvas APIs, then generate new sanitized PNG blobs without the original EXIF metadata.
4. Review the exact PNG submission previews, explicitly approve them, and submit only those blobs for structured extraction.
5. Review editable service events, normalized dates and odometers, automatic date precision, component mappings, ambiguities, possible duplicates, and chronological conflicts.
6. Confirm the reviewed history, search for vehicle candidates, inspect candidate evidence and sources, and explicitly select a variant. No candidate is auto-selected.
7. Run two-stage maintenance research for the confirmed variant. The UI preserves source hierarchy, compatibility, trustworthiness, conflicts, original units, and insufficient-evidence results.
8. Calculate component statuses in deterministic application code from the reviewed events, current odometer, analysis date, and normalized research.
9. Inspect a source-backed report and download JSON and Excel locally. Images are excluded, and external spreadsheet text is protected from formula execution.
10. Clear or refresh the page to remove the in-memory session. There is no account or application database. The UI accurately discloses that provider retention policies may still apply.

The built-in synthetic demo is useful for pre-staging review, research, status, and report scenes without API latency. It uses a fictional Nordica Aurora, three synthetic document references, two vehicle candidates, unit conversion, conflicting sources, and insufficient evidence.

## Recording preparation

- Record at 1920×1080, with the browser at 80–90% zoom so one component remains readable for at least several seconds.
- Hide bookmarks, notifications, API keys, `.env` files, personal paths, and unrelated browser tabs.
- Use a visible pointer and restrained cursor emphasis. Do not add animated zooms that obscure the UI.
- Pre-stage separate tabs so model latency and the long one-page layout do not force rushed scrolling:
  - **Tab A:** clean home page for the opening and workflow overview.
  - **Tab B:** vehicle form completed except for the last field, followed by the upload/redaction workspace.
  - **Tab C:** extracted review state with a duplicate and a chronology warning prepared through the UI.
  - **Tab D:** pristine built-in synthetic demo for candidate, research, status, and report scenes.
  - **Tab E:** privacy page.
  - **Development view:** the MVP specification and this Codex task, with no secrets visible.
- Before recording, supply three obviously fictional maintenance-record images. This checkout currently has no PNG, JPG, JPEG, or WebP demo assets. Suggested safe content:
  - one oil-change card with a fictional name, registration number, and `100000 mi`;
  - one ambiguous brake-fluid/brakes note with a month-only date;
  - one timing-belt inspection with a kilometre reading.
- Run live extraction before the take and keep the completed result in Tab C. During the take, briefly show the real submitting state, then use a gentle dissolve to the completed result rather than waiting unpredictably.
- In Tab C, prepare warnings through the existing UI: add one event duplicating the oil-change date/component/odometer, and another older event with a higher odometer. Leave the warning diagnostics and relevant rows visible.
- In Tab D, click **Load synthetic demo** before the take. Keep the vehicle-candidate radio buttons above the fold and the already-confirmed callout below the fold until the explicit selection is shown.

This setup keeps the application visible for approximately 90% of the runtime, including in the split-screen development scene.

## Timestamped transcript from the MP3

These transcript blocks follow word-level timestamps recognized from the audio. Product-name spelling and punctuation are normalized to the paired script only after the comparison documented below.

| Start | End | Transcript |
|---|---|---|
| 00:00.000 | 00:20.640 | The idea for AutoHuolto AI grew from a problem I had already encountered. I had used AI assistance to organize vehicle maintenance information into an Excel-based service record. That experience showed me the value of structured maintenance data, but also how difficult it can be to interpret invoices, service-book entries, handwritten notes, and photographs. |
| 00:20.640 | 00:30.680 | To turn the idea into a working application, I first used the GPT-5.6 Sol model in ChatGPT to define the project and create an MVP specification. |
| 00:30.680 | 00:44.560 | The plan described a privacy-focused web application that could extract maintenance events from images, let the user review the results, identify the correct vehicle variant, research maintenance intervals from reliable sources, and calculate the current maintenance status. |
| 00:44.560 | 00:53.660 | It also set clear constraints: no permanent accounts, no database, no unnecessary storage of sensitive documents, and no unsupported recommendations presented as facts. |
| 00:53.660 | 01:13.380 | I then implemented the application with Codex, again using GPT-5.6 Sol. Codex produced the project code and helped resolve technical errors during development. My role was to guide and verify the process. I tested each workflow, supplied error logs, reviewed the results, and requested functional or visual changes whenever the application did not behave as intended. |
| 01:13.380 | 01:23.660 | The completed application begins by collecting the vehicle’s make, model, year, engine, transmission, market, and current odometer reading. The user then uploads photographs of maintenance records. |
| 01:23.660 | 01:37.500 | Before an image leaves the browser, names, addresses, registration numbers, vehicle identification numbers, and other sensitive details can be covered. The application creates new sanitized PNG files, and only the versions approved by the user are submitted. |
| 01:37.500 | 01:51.760 | OpenAI extracts the visible maintenance events into a strict structured format. The user can compare each event with the original evidence, correct dates and odometer readings, adjust component mappings, add or remove records, and resolve duplicate or chronological warnings. |
| 01:51.760 | 02:03.960 | After the history is confirmed, the application searches for possible vehicle variants. Ambiguous results are never selected automatically. The sources remain visible, and the user explicitly confirms the correct vehicle before maintenance research continues. |
| 02:03.960 | 02:20.960 | The research stage prioritizes manufacturer manuals and official technical sources. Evidence is converted into a validated structure, conflicting claims remain visible, and every recommendation retains its source. When evidence is insufficient, the application reports that limitation instead of inventing an interval. |
| 02:20.960 | 02:35.880 | The final maintenance status is calculated by deterministic functions rather than by the language model. Each component is classified as okay, approaching its interval, due, overdue, unknown, conflicting, or unsupported. This makes the results repeatable and testable. |
| 02:35.880 | 02:44.260 | Finally, the reviewed history, maintenance statuses, uncertainty, compatibility notes, and source links can be downloaded locally as JSON or Excel. |
| 02:44.260 | 02:53.184 | AutoHuolto AI turns fragmented vehicle records into transparent, source-backed maintenance guidance while keeping the user in control of both the conclusions and their data. |

## Transcript comparison with `demo-vid/narration.txt`

No substantive spoken additions, omissions, or reordered clauses were detected. After case, punctuation, apostrophe, and compound-word normalization, the audio follows the paired narration text.

The raw speech recognizer produced these non-substantive differences:

| Script | Raw recognition | Assessment |
|---|---|---|
| `AutoHuolto AI` | `AutoVolto AI`, `Auto-Holto AI`, or `Auto Volto AI` | Proper-name recognition variation; the TTS input and paired script use `AutoHuolto AI`. |
| `GPT-5.6 Sol` | `GPT 5.6 Sol` | Hyphenation only. |
| `Excel-based`, `service-book`, `privacy-focused`, `source-backed` | The same words without some hyphens | Orthographic only. |
| Sentence break after “selected automatically.” | Recognized as a comma in one pass | Punctuation inference only; spoken word order is unchanged. |
| Colon after “clear constraints:” | Recognized as a period | Punctuation inference only. |

## Detailed visual scene plan

### Scene 01 — The fragmented-record problem

- **Start:** 00:00.000
- **End:** 00:20.640
- **Duration:** 20.640 seconds
- **Spoken narration:** “The idea for AutoHuolto AI grew from a problem I had already encountered. I had used AI assistance to organize vehicle maintenance information into an Excel-based service record. That experience showed me the value of structured maintenance data, but also how difficult it can be to interpret invoices, service-book entries, handwritten notes, and photographs.”
- **Page/component:** AutoHuolto AI home-page hero, then the empty image-upload workspace.
- **Exact actions:** Hold the hero and product name for the first 4.8 seconds. Slowly scroll to the synthetic-demo summary while the narration mentions structured maintenance data. At about 12.5 seconds, continue to **Phases 2–3 / Images and extraction** and rest on the empty state, “Images do not leave the device at this stage.”
- **Important UI emphasis:** The privacy-first hero, the completed-analysis promise, supported image formats, and the fact that fragmented documents enter one controlled workflow.
- **Optional overlay:** `Invoices • service-book entries • handwritten notes • photographs`
- **Transition:** A slow cross-dissolve from the upload workspace to the rendered MVP specification at 00:20.640.
- **Demonstrability:** Fully demonstrable with the current application; no uploaded image is needed yet.

### Scene 02 — From idea to MVP specification

- **Start:** 00:20.640
- **End:** 00:30.680
- **Duration:** 10.040 seconds
- **Spoken narration:** “To turn the idea into a working application, I first used the GPT-5.6 Sol model in ChatGPT to define the project and create an MVP specification.”
- **Page/component:** Rendered preview of `CODEX_BUILD_SPEC.md`; use the original ChatGPT conversation instead only if it is available and safe to show.
- **Exact actions:** Show the specification title, then gently pan across the mission and workflow bullets. Do not display code, `.env`, API keys, or private prompt history. Keep a small live application preview visible in the corner.
- **Important UI emphasis:** The transition from an observed maintenance-data problem to a bounded MVP.
- **Optional overlay:** `GPT-5.6 Sol → privacy-first MVP specification`
- **Transition:** Expand the application preview to full screen and land on **Four controlled steps**.
- **Demonstrability:** Partially demonstrable. The repository contains the resulting specification but not an exported copy of the original ChatGPT conversation.

### Scene 03 — The planned end-to-end workflow

- **Start:** 00:30.680
- **End:** 00:44.560
- **Duration:** 13.880 seconds
- **Spoken narration:** “The plan described a privacy-focused web application that could extract maintenance events from images, let the user review the results, identify the correct vehicle variant, research maintenance intervals from reliable sources, and calculate the current maintenance status.”
- **Page/component:** Home page, **Designed workflow / Four controlled steps**, followed by a controlled vertical pan over the phase labels.
- **Exact actions:** Hold the four workflow cards for six seconds. Move the pointer across **Describe**, **Redact**, **Review**, and **Inspect results and sources** without clicking. Then make one slow vertical pan showing the Phase 5–8 headings in the long page.
- **Important UI emphasis:** This is one connected user flow, and status calculation is separate from extraction and research.
- **Optional overlay:** `Extract → Review → Resolve variant → Research → Calculate`
- **Transition:** Click the header’s **Privacy** link at the scene boundary.
- **Demonstrability:** Fully demonstrable.

### Scene 04 — Product constraints and privacy boundary

- **Start:** 00:44.560
- **End:** 00:53.660
- **Duration:** 9.100 seconds
- **Spoken narration:** “It also set clear constraints: no permanent accounts, no database, no unnecessary storage of sensitive documents, and no unsupported recommendations presented as facts.”
- **Page/component:** Privacy page intro and **Built-in data minimization** protection cards.
- **Exact actions:** Hold on “Data handling is limited to one session.” Scroll just enough to show **No permanent application storage**, **Redaction happens in the browser**, and **The session ends when the page closes**. Keep the provider-retention qualification visible if framing permits.
- **Important UI emphasis:** Application-level statelessness, local redaction, session-only memory, and the explicit refusal to claim provider zero retention.
- **Optional overlay:** `No accounts • No database • Session memory only`
- **Transition:** Cross-dissolve into a Codex/app split view.
- **Demonstrability:** Fully demonstrable.

### Scene 05 — Implementation and verification with Codex

- **Start:** 00:53.660
- **End:** 01:13.380
- **Duration:** 19.720 seconds
- **Spoken narration:** “I then implemented the application with Codex, again using GPT-5.6 Sol. Codex produced the project code and helped resolve technical errors during development. My role was to guide and verify the process. I tested each workflow, supplied error logs, reviewed the results, and requested functional or visual changes whenever the application did not behave as intended.”
- **Page/component:** Codex task history on the left and the running AutoHuolto AI application on the right.
- **Exact actions:** Slowly scroll past representative phase requests and an error-log/fix exchange. At about 01:04, show a concise terminal result or CI view with passing lint, type-check, unit, and end-to-end checks. At 01:10, enlarge the running application to full screen. Do not show source code, secrets, raw customer data, or an `.env` file.
- **Important UI emphasis:** Human guidance and verification around the implementation, not autonomous acceptance of generated code.
- **Optional overlay:** `Specify → Implement → Test → Review`
- **Transition:** The browser grows to full screen on the vehicle form; avoid a hard cut.
- **Demonstrability:** Demonstrable with the current Codex task and repository history. An independently archived record of every historical Codex interaction is not stored in the repository.

### Scene 06 — Vehicle details and document upload

- **Start:** 01:13.380
- **End:** 01:23.660
- **Duration:** 10.280 seconds
- **Spoken narration:** “The completed application begins by collecting the vehicle’s make, model, year, engine, transmission, market, and current odometer reading. The user then uploads photographs of maintenance records.”
- **Page/component:** **Phase 1 / Vehicle** form, confirmed-vehicle summary, and the top of **Phases 2–3 / Images and extraction**.
- **Exact actions:** Begin with the fictional Nordica Aurora form already filled except for the odometer. Type `180000`, briefly point to `N18-X`, `Hybrid`, `CVT`, and `Europe`, then click **Confirm vehicle details**. Show the in-memory vehicle summary. At 01:20.960, scroll to **Select images**, choose the three prepared fictional records, and finish on the `3/10 in memory` queue.
- **Important UI emphasis:** Variant-defining engine/transmission fields, current odometer, and “Only in this tab’s memory.”
- **Optional overlay:** `Vehicle details remain in this tab’s memory`
- **Transition:** Smoothly scroll from the selected image queue into the Canvas editor.
- **Demonstrability:** The form is fully demonstrable. Upload is blocked by a recording-asset gap until safe synthetic image files are supplied; none are present in this checkout.

### Scene 07 — Browser-side sanitization and explicit approval

- **Start:** 01:23.660
- **End:** 01:37.500
- **Duration:** 13.840 seconds
- **Spoken narration:** “Before an image leaves the browser, names, addresses, registration numbers, vehicle identification numbers, and other sensitive details can be covered. The application creates new sanitized PNG files, and only the versions approved by the user are submitted.”
- **Page/component:** Image queue, **Edit the selected image** Canvas, **Exact sanitized preview**, diagnostics, and consent panel.
- **Exact actions:** Select the first fictional record. Keep **Redact area** active and drag a black rectangle over a fictional name and registration number. Click **Create submission preview**. Scroll to the new PNG preview, pause on the visible black pixels and file-size diagnostics, check the review confirmation, and click **Approve sanitized images**. Do not press the separate extraction button until the next scene.
- **Important UI emphasis:** The redaction is rendered as pixels into a new PNG; EXIF is not transferred; preview, approval, and submission are separate steps; the original file is excluded.
- **Optional overlay:** `Original stays local • New PNG only • EXIF removed`
- **Transition:** Hold the enabled **Submit to OpenAI and extract events** button, then click it exactly at 01:37.500.
- **Demonstrability:** Fully implemented, but requires the synthetic image assets noted in Scene 06.

### Scene 08 — Structured extraction, editing, and warnings

- **Start:** 01:37.500
- **End:** 01:51.760
- **Duration:** 14.260 seconds
- **Spoken narration:** “OpenAI extracts the visible maintenance events into a strict structured format. The user can compare each event with the original evidence, correct dates and odometer readings, adjust component mappings, add or remove records, and resolve duplicate or chronological warnings.”
- **Page/component:** Extraction progress, **Review, normalize, and confirm the service history**, review diagnostics, active event row, and event editor.
- **Exact actions:** Show the real **Extracting the visible service history** state for roughly 1.5 seconds, then dissolve to the pre-extracted Tab C. Pause on the duplicate and chronology warning diagnostics. Click **Edit** on `event-demo-ambiguous`; keep the highlighted full row and `Editing` badge visible. Scroll to **Currently being edited** and point to raw evidence, the automatically inferred month precision, normalized odometer, component selector, **Add event**, **Remove**, and **Merge selected** controls. End with the warning-acknowledgement area visible.
- **Important UI emphasis:** Strict structured fields remain editable; the active row remains visually recognizable; miles normalize to kilometres; date precision is inferred from the entered date; warnings must be reviewed before confirmation.
- **Optional overlay:** `Editable structured events • duplicate and chronology checks`
- **Transition:** Click or show **Confirm reviewed service history**, then use a restrained vertical wipe to the vehicle-candidate section.
- **Demonstrability:** Editing and warning logic are implemented. Live extraction cannot reliably finish inside this 14-second scene, so the completed result must be pre-run. The built-in demo does not itself contain duplicate or chronology warnings; prepare them through the UI as described.

### Scene 09 — Explicit vehicle-variant selection

- **Start:** 01:51.760
- **End:** 02:03.960
- **Duration:** 12.200 seconds
- **Spoken narration:** “After the history is confirmed, the application searches for possible vehicle variants. Ambiguous results are never selected automatically. The sources remain visible, and the user explicitly confirms the correct vehicle before maintenance research continues.”
- **Page/component:** **Phase 5 / Vehicle variant verification**, candidate cards, source evidence, and confirmation controls.
- **Exact actions:** Start with both candidate radio buttons visibly unselected and **Confirm selected vehicle variant** disabled. Hold on the strong and partial match cards and their source/evidence areas. Select the fictional N18-X/e-CVT candidate, show the button becoming enabled, and click **Confirm selected vehicle variant**. Finish on the confirmation and unresolved transmission-code note.
- **Important UI emphasis:** No auto-selection, compatibility differences, source preservation, and explicit user confirmation.
- **Optional overlay:** `Ambiguous ≠ auto-selected`
- **Transition:** Continue the same controlled downward scroll into Phase 6.
- **Demonstrability:** Fully demonstrable with the built-in synthetic demo. Keep the pre-existing confirmation callout below the fold until after the explicit selection to avoid visual contradiction.

### Scene 10 — Two-stage, source-backed maintenance research

- **Start:** 02:03.960
- **End:** 02:20.960
- **Duration:** 17.000 seconds
- **Spoken narration:** “The research stage prioritizes manufacturer manuals and official technical sources. Evidence is converted into a validated structure, conflicting claims remain visible, and every recommendation retains its source. When evidence is insufficient, the application reports that limitation instead of inventing an interval.”
- **Page/component:** **Phase 6 / Maintenance interval research**, research summary, interval claim cards, conflicts, sources, trustworthiness, and insufficient evidence.
- **Exact actions:** Begin on **Two-stage, source-backed search** and the result counts. Slowly pan through the engine-oil claim, showing the original `10,000 mi`, normalized kilometre interval, source tier, compatibility, trustworthiness, and source link. Continue to the timing-belt card with both preserved conflicting claims and no selected interval. End on engine coolant’s **Insufficient evidence** message.
- **Important UI emphasis:** Source hierarchy, exact-variant compatibility, original-unit preservation, visible conflicts, and honest absence of an interval.
- **Optional overlay:** `Preserve the source • Preserve the conflict • Never guess`
- **Transition:** A slow scroll reveals the Phase 7 heading and “Status is not an AI opinion.”
- **Demonstrability:** The UI and normalization are fully demonstrable. The built-in demo uses reserved `.invalid` source domains, so its links cannot open to live manuals. Use a pre-run live research result if reachable source pages must be shown.

### Scene 11 — Deterministic component status

- **Start:** 02:20.960
- **End:** 02:35.880
- **Duration:** 14.920 seconds
- **Spoken narration:** “The final maintenance status is calculated by deterministic functions rather than by the language model. Each component is classified as okay, approaching its interval, due, overdue, unknown, conflicting, or unsupported. This makes the results repeatable and testable.”
- **Page/component:** **Phase 7 / Deterministic status calculation**, status-count grid, and component status cards.
- **Exact actions:** Hold on **Status is not an AI opinion**. Show the count grid, then slowly pan across the engine-oil **Overdue**, timing-belt **Conflicting sources**, engine-air-filter **Unknown**, and coolant **Insufficient evidence** cards. Point to “Calculated by application code,” reason codes, remaining distance, selected service-record ID, and source-claim ID.
- **Important UI emphasis:** The language model supplies evidence; pure application functions determine status from the same inputs every time.
- **Optional overlay:** `Same inputs → same result`
- **Transition:** Continue directly to the report heading; do not switch applications.
- **Demonstrability:** Partially demonstrable as narrated. The current status schema has `OK`, `Due soon`, `Due`, `Overdue`, `Unknown`, `Conflicting sources`, and `Insufficient evidence`; it has no literal `unsupported` status. Do not fabricate an unsupported badge in the video.

### Scene 12 — Local JSON and Excel export

- **Start:** 02:35.880
- **End:** 02:44.260
- **Duration:** 8.380 seconds
- **Spoken narration:** “Finally, the reviewed history, maintenance statuses, uncertainty, compatibility notes, and source links can be downloaded locally as JSON or Excel.”
- **Page/component:** **Phase 8 / Report and local export**, report snapshot, summary, and export buttons.
- **Exact actions:** Hold briefly on the report summary and vehicle-variant uncertainty. Click **Download JSON** at about 02:39, then **Download Excel** at about 02:41. Show the browser download confirmation without opening another application.
- **Important UI emphasis:** Files are generated locally without a new network request, images are excluded, and spreadsheet text is protected from formula execution.
- **Optional overlay:** `Generated locally • Images excluded`
- **Transition:** Slowly pan from the download buttons into the report’s source-backed component/source sections.
- **Demonstrability:** Fully demonstrable.

### Scene 13 — Value proposition and closing frame

- **Start:** 02:44.260
- **End:** 02:53.184
- **Duration:** 8.924 seconds
- **Spoken narration:** “AutoHuolto AI turns fragmented vehicle records into transparent, source-backed maintenance guidance while keeping the user in control of both the conclusions and their data.”
- **Page/component:** Report **Sources and compatibility** table, followed by the AutoHuolto AI hero as the final frame.
- **Exact actions:** Hold on a report row where status, trustworthiness, compatibility, and source are simultaneously visible. At about 02:49, dissolve to the clean hero tab. Let the product name and privacy-first statement remain still through the 304 ms trailing silence.
- **Important UI emphasis:** Traceability from a maintenance conclusion to evidence, plus explicit user control.
- **Optional overlay:** `Transparent • Source-backed • User-controlled`
- **Transition:** Gentle fade to black after 02:53.184.
- **Demonstrability:** Fully demonstrable. In synthetic mode, source rows are illustrative rather than live external pages.

## Scenes or claims not currently demonstrable exactly as narrated

1. **Scenes 06–08 need image assets.** The redaction and extraction implementation exists, but this checkout contains no demo image files. Safe fictional images must be supplied before the manual recording.
2. **Scene 11 cannot show an `unsupported` status.** The deterministic engine uses `insufficient_evidence` instead. Record the real UI and flag the wording discrepancy; do not create a fake badge.
3. **Scene 10 cannot open built-in demo sources.** Synthetic citations deliberately use reserved `.invalid` domains. A live, pre-run research result is needed to demonstrate opening a real manufacturer or official technical source.
4. **Scene 02 cannot prove the original ChatGPT interaction from repository content alone.** The resulting MVP specification is present, but an exported ChatGPT conversation is not.
5. **Live extraction and web research are not guaranteed to finish within their narration windows.** Their real initiating/progress states can be shown, followed by a gentle transition to results prepared earlier through the same application flow.

No application-code changes or video edits are part of this plan.
