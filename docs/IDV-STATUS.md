# Hyperwolf Verify — build status

Updated 2026-09-09 (evening) after a day of live iPhone tests, for JT. First written the same morning. Nothing has been pushed: both repos auto-deploy on
push and you push. wm-demo's unpushed history was rewritten tonight to drop a 115 MB weights file
and vendored licensed code (largest object now 1.4 MB); it is safe to push.

## What shipped

**Backend (`/Users/jt/wm-demo`)**
- `wmdemo/idv_store.py` — 26 tables (sessions, events, decisions, people, face templates,
  documents, media, reviews, lists, keys, webhooks, audit, import runs, usage, consents, deletion
  requests, questionnaires, customization), version counter, sweeper, calibrated-threshold migration.
- `wmdemo/idv_rules.py` — pure autonomous decision rules: approve / ask the guest to fix one step /
  decline with a path; barcode is the data source; medical recommendation step; engine outage is a
  pause, never a guest retake; reads the engine's real node shapes (real callback fixture).
- `wmdemo/idv_api.py` — console `/api/idv/*` (every read needs an actor, every admin write is gated),
  public `/v3/*` with scopes, the `/v2` Didit-compatibility facade the site calls today (key
  required), capture API (consent, challenge, media, submit, status, abandon), engine job submit with
  a job-scoped media token committed before the engine is called, signed callback receiver with
  transition guard and replay dedupe, outbound webhooks, media route (forced MIME, nosniff), PDF,
  internal templates endpoint for 1:N face search.
- `wmdemo/idv_webhooks.py`, `idv_media.py`, `idv_pdf.py`, `idv_import_didit.py` (Didit history
  importer with run reports), `server.py` mount + PATCH/PUT/DELETE under the public write gate,
  `render.yaml` (media on the persistent disk, engine vars declared).
- `idv-engine/` — own ML service (FastAPI, Python 3.11, onnxruntime): PDF417 + AAMVA parser, OCR,
  fuzzy cross-check, quality, tilt-frame OVI check, YuNet + SFace face match and 1:N, MiniFASNet
  passive liveness (wiring fixed tonight: 0.03 → 97.9 on a live face), MediaPipe active challenge
  bound to the server nonce, clean-room MiVOLO age hint (non-blocking), medical-recommendation
  reader, open-data IP risk, signed jobs and callbacks with a 1 s–10 min retry ladder and
  redelivery, `/health` listing every model with its licence. Dockerfile for Render/AWS (x86-64).

**Frontend (`/Users/jt/POS-Admin`)**
- `Hyperwolf Verify.html` + `idv/` — app shell, client (`HWIdv`), shared components, nine console
  screens (Home, Customers file, Verifications, Session detail with the pinned action bar,
  Workflows builder, Lists, Integrate, Usage, Settings with team/audit/retention/import/
  questionnaires/customization), Terms & Conditions link + legalese modal with the developer banner.
- `idv/capture.jsx` + `idv/capture.html` — guest capture: one-checkbox consent with the T&C link,
  no buttons on camera screens, on-device gates (sharpness, glare, exposure, card fill,
  steadiness), PDF417 auto-snap where the browser supports it, MediaPipe face gating and verified
  liveness prompts that start by themselves, live one-line guidance, medical-recommendation step,
  guided retries, code-free outcomes. `vendor/mediapipe/` (Apache-2.0, served from our origin).
- `pos/checkin-verify-seam.jsx` + 23 lines in `pos/checkin.jsx` — POS check-in path with associate
  override. `pos/screen-register.jsx` untouched. Registered in nav, switcher, hub card, POS page.
- Docs: `IDV-PLAN-2026-09-08.md` (approved), `IDV-API-CONTRACT.md` (+ dated addenda),
  `IDV-TERMS-CLAUSE-DRAFT-2026-09-08.md` (for counsel), `IDV-SITE-INTEGRATION.md` (for your devs),
  four concepts in `explorations/`, research and calibration digests in `scratch/idv-*.md`.

## Today's live rounds (2026-09-09) — what real guests taught us
Eleven real sessions on two iPhones (the owner and a colleague) over a temporary tunnel. Every
decline of a real person was a Hyperwolf bug, never their ID. In order found and fixed:
media token sent before commit (engine got 403 on every image) · feature-name vocabulary
mismatch (every pipeline stage skipped) · template `quality` dict binding error (every callback
500'd) · rules reading Score objects / null node status · auto-zoom magnifying hand shake ·
optional 4K record upload blocking the step over a flaky tunnel · MediaPipe download failure with
a black selfie in the fallback · print OCR (40% confidence garbage) out-voting a decoded barcode ·
challenge prompts matched on the wrong wire shape + inverted yaw sign · late extras flipping a
verdict back to "checking" · the portrait finder's size ceiling rejecting a 2400 px licence photo ·
a 15 fps canvas clip flagged as injected video · OCR run on a squashed frame (0 lines) · the first
front judged on every retake · exposure measured on the room, not the card.
Result at close: owner Approved in 32 s (quality 92.9/96.9, barcode 27 fields, liveness 99.98,
face 76.1); colleague Approved in 21 s (face 72.9 multi-frame; 57.5 single-frame before).
Capture now: one-checkbox consent; PDF417 decoded on-device from native video on every browser
(zxing-wasm; floor 1.6 px/module), no buttons on camera screens, blink-only challenge (workflow
setting), ~200 KB liveness clip, evidence-only uploads block, resume strictly from the server,
wake lock, Persona-style selfie. Engine now: portrait by detection with a card-relative ceiling,
OCR on the card region trying every front, newest front judged, exposure on the card, replay
needs two independent signals, face match over every selfie frame and the clip with mirrored
templates, every uploaded back tried, blink judged in its own window, callback ladder + redeliver.
Rules now: the numbers decide (an engine reason is dropped when our own read passes), barcode
authoritative (print disagreement only counts when confident on DOB/licence number), engine
outage pauses and re-enqueues, a session belongs to a person from its first decoded barcode.

## What was verified live (not just by probes)
- Your own photos replayed through the real routes after the fixes: 3.0 s to a verdict; document
  quality 96.8 / 97.4, passive liveness 97.9, face match 84.3; barcode not decodable from that
  webcam frame (region sharpness 175 vs the measured floor of 340) → the guest is asked to redo
  the back, not told the ID is unreadable. The auto-capture gate now refuses to snap that frame.
- Didit history imported: 2,135 sessions read = 2,120 inserted + 15 unchanged + 0 conflicts +
  0 rejected; 9,583 media files; all 4 Didit workflows duplicated; 956 people resolved (994
  sessions unresolved — Didit sessions carried no customer key).
- Every console screen against the seeded dev backend with the engine up; engine badge states;
  T&C modal; capture flow end to end in Chrome (synthetic camera) with consent rows, uploads,
  auto-started challenge; POS override contract; `/v2` facade shapes the site reads.
- Three adversarial refuters (numbers, safety, blast radius): 7 blockers found, all fixed the
  same night (unauthenticated `/v2`, ungated console reads, session-scoped media token, bare-date
  window dropping the last day, PATCH/PUT/DELETE outside the public write gate, media on the
  ephemeral disk, the 115 MB blob in history).

## Facts you should know
- Didit's usage numbers are lifetime: real volume is ~150 sessions a month, inside its free tier.
- Nobody can check a California licence against the DMV; Didit does document forensics, as we do.
- The passive liveness score is an open model, uncertified; the challenge, the barcode chain, the
  face reuse across our own history and the associate at the door are the real controls.
- Barcode decode on the imported Didit images is 52% (up from 42% tonight); on our own capture
  the auto-snap gate on barcode sharpness is what makes it reliable. Passports have no barcode
  and are approved on OCR + face; US licences are barcode-or-retake.
- Face-match threshold is 60 (calibrated on 582 real pairs: 26% false-decline at 60, 87% at
  Didit's 75); 1:N duplicate threshold 80. Both provisional until measured on real capture selfies.
- `In Review` never happens for native sessions. Imported Didit rows keep their literal.
- Civil Code § 1798.90.1 has no time window: licence data is kept for verification and fraud
  prevention only; the returning-guest face check uses the selfie template under biometric consent.

## Waiting on you
1. Push: the owner asked Claude to push both repos on 2026-09-09 after the final refuter pass
   (wm-demo history is clean; POS-Admin carries 22 MB of MediaPipe + 1 MB zxing assets the hosted
   page needs).
1b. For the first feedback round the engine runs from this Mac through a tunnel; set in the Render
   dashboard: `IDV_ENGINE_URL` (the engine tunnel URL), `IDV_ENGINE_SECRET` (the same value the
   engine runs with), `IDV_PUBLIC_BASE` (the Render URL), `IDV_MEDIA_DIR=/var/data/idv_media`.
   Then the proper engine service (Docker, x86-64) replaces the tunnel.
2. Counsel sign-off on `IDV-TERMS-CLAUSE-DRAFT-2026-09-08.md`, then the production Terms page.
3. Render: the engine needs its own service (Docker, ~600 MB image, x86-64) with
   `IDV_ENGINE_SECRET`, `IDV_ENGINE_URL`, `IDV_PUBLIC_BASE` set in the dashboard; and a decision on
   `WM_DEMO_PUBLIC` — the demo URL has open writes and no login, which was fine for Weedmaps test
   listings and is not fine for identity documents. Do not put real guest data behind it.
4. Your devs: `docs/IDV-SITE-INTEGRATION.md` (three env vars, CSP host, `x-api-key` now required,
   `In Review` branches removed, optional signed webhook).
5. Deleting the Didit history at the source is yours to trigger; the importer never deletes.

## Run it
```
cd /Users/jt/wm-demo && idv-engine/run_local.sh                 # engine on 8797
WM_DEMO_PORT=8793 WM_DEMO_STATIC_DIR=/Users/jt/POS-Admin WM_DEMO_DB=/Users/jt/wm-demo/scratch/idv-dev/wmdemo-idv-dev.sqlite3 \
IDV_MEDIA_DIR=/Users/jt/wm-demo/scratch/idv-dev/media IDV_ENGINE_URL=http://127.0.0.1:8797 \
IDV_ENGINE_SECRET=dev-secret IDV_PUBLIC_BASE=http://127.0.0.1:8793 python3 scratch/idv-dev/run_idv_backend.py
open "http://127.0.0.1:8793/Hyperwolf%20Verify.html"
```
The dev database holds the real imported Didit history; keep it local.

## Open (known, not fixed tonight)
- Capture round 3 (2026-09-09): in-browser PDF417 decode on every browser (vendored zxing-wasm,
  MIT wrapper + Apache-2.0 core), document bounding-box framing, resume strictly from state, wake
  lock, Persona-grade selfie/liveness, single-checkbox consent. The live camera path was only
  exercised synthetically; the owner's iPhone run is the first real test.
- Challenge pass (2026-09-09): prompts matched on the real wire shape, turn-left yaw sign fixed on
  measured data, `challenge.result` taxonomy — a failed challenge is a guided retry, only
  `replay_suspected` declines; the window is measured against upload time; the backend asks the
  engine to redeliver a stuck verdict.
- Barcode decode ladder: 52% on Didit's compressed images; needs real capture data to measure.
- Passive liveness has no certification path; face thresholds are provisional (no capture-path
  selfies in the corpus yet).
- Returning-guest face-only re-check (Didit's Biometric Authentication) is not built.
- Engine image is x86-64 only until the MediaPipe arm64 Linux wheel is re-verified.
- Console has no login; roles come from the client-set actor header (platform decision, §11.5).
- Importer field-mapping traps (Didit `issuing_state` holds the country, prose document types,
  dict-shaped quality scores) are documented, not normalised.
- `users:read` scope is not offered in the Integrate key dialog; `ImportedTag` lacks the import date.
- Other sessions' restart scripts kill processes named `wmdemo.server`; run Verify backends via
  `scratch/idv-dev/run_idv_backend.py`.

## Verification summary (final run, scratch databases)
| Suite | Checks |
|---|---|
| `qa/idv_rules_probe.py` | 413 / 413 |
| `qa/idv_store_probe.py` | 77 / 77 |
| `qa/idv_api_probe.py` | 181 / 181 |
| `qa/idv_import_probe.py` | 78 / 78 |
| `idv-engine` pytest | 342 passed, 2 skipped |
| `test/global-collisions.test.mjs` | green (16 pages) |
| **Total probe checks** | **749 + 342 engine tests** |

## Pushed to production — 2026-09-09 evening
Pushed `POS-Admin` (`4a5c32c`) then `wm-demo` (`da547c2`) to `origin/main`; both pushes also carried
other sessions' contracts/engage/incentives commits. Included since the last status: console PIN gate
(r4), workflow version pinned per session, liveness clip fingerprints (`known_clips`), similar-faces
PII analyst-only, 409 on uploads after a verdict, hosted-link 503 + Host fallback, tombstone-free
`sessions_count` (r5), tamper gate on the recogniser's own `ocr_confidence` / `ocr_field_confidence`
with field provenance and DAC+DAD given-name matching (r6). Render env still to be set by the owner:
`IDV_CONSOLE_PIN`, `IDV_ENGINE_URL`, `IDV_ENGINE_SECRET`, `IDV_PUBLIC_BASE`.

Open after this push (documented in the r5/r6 addenda): the importer writes Didit's
`workflow_version` onto Verify workflow ids; resubmit links on Declined sessions dead-end with an
honest 409; person ids still appear in the AMBIGUOUS warning and `person.resolved` audit detail;
the engine surface ranker still prefers session 9's 51-line nav-screen frame (now yields nothing
instead of a wrong name); `_read_dob` has no shape guard for a non-dict barcode.
