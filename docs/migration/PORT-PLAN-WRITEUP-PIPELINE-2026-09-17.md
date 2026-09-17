# Port plan — writeup-pipeline (Apps Script → our estate)

2026-09-17. Sections 3 and 5 are from the read-only pass (path:line cited); sections 1, 2, 4 and 6
are to be filled by the first builder as its step 0 (read-only, from the same sources).

**Governing rule:** the port implements the owner's 2026-09-16 ladder decision (attendance and
accuracy ladders tracked separately, 90-day window, dismissed never count, one total ledger, AI
drafts capped at Second Warning, step-ups only through a manager's approve-and-send stamp) — NOT
the live GAS behaviour where it differs. "Port verbatim" in HR-DASHBOARD-INVENTORY.md:99 applies to
the AI cap re-validation only.

## 1. Entry points, triggers, side effects, Airtable tables (READ, step-2 builder pass)

**Entry points.** `doGet(e)`/`doPost(e)` (Webapp.js:355,359) is the project's one web-app
endpoint. `doPost` dispatches on `params.action` for the public-facing calls
(`draftWriteUp`, `generatePdf`, `sendConnecteam`, `buildAckUrl`, `sendWriteUp` —
Webapp.js:401-405) and separately on `body.action` for the HMAC-signed, cross-project
Phase-3 channel (`ESCALATE_TO_WRITEUP` :1446, `REQUEST_POLICY_UPDATE` :1476,
`SEND_WRITEUP` :1536, `REQUEST_DOC_UPDATE` :1609). `CalloffPortal.js` and
`IncidentPortal.js` each serve their own public intake form through the same web app.

**Scheduled triggers:**

| Function | Cadence | Purpose |
|---|---|---|
| `pollPendingAiDrafts` | every 15 min (AiDraftPoller.js:568) | drafts AI write-ups for escalated incidents — the fetch-and-filter pipeline this engine's `counts_toward()`/`ladder_state()` replace |
| `sendDailyReminders` | daily 10:00 America/Los_Angeles (ReminderEngine.js:938-943) | reminder chase; channel `'reminder'` is permanently excluded from the manager-approval step-up path (Connecteammessenger.js:285) |
| `sendWeeklyDigest` | Monday 09:00 America/Los_Angeles (DigestReports.js:373-378) | HR digest email |
| `sendMonthlyDigest` | 1st of month 09:00 America/Los_Angeles (DigestReports.js:382-387) | HR digest email |
| `wpX_pollOffboarding` | hourly (DocExpiryNotices.js:670-673) | offboarding poll (doc-expiry notices themselves are retired, per the installer's own log line) |
| doc-update-request handler | every 4h (DocUpdateRequests.js:1287) | doc-update follow-up |

**Side effects a live run produces:** Airtable record creates/patches on Incidents /
Employee Write-Ups / Call Offs (`airtableCreate`/`airtablePatch_`, gated by `guardWrite_`/
`ALLOW_WRITES`); outbound Connecteam messages, email, Discord embeds
(`CalloffDiscordRoutes.js`); PDF generation (`WriteUpPdfGenerator.js`); HMAC-signed
acknowledgment magic links (`buildAckUrlForRecord`, Webapp.js:1192-1200). None of this
module's own functions (`wmdemo/writeups/ladder.py`) perform any of it — it is pure.

**Airtable tables/fields relevant to the ladder** (base `app8mI9K1lS1D3Uhk`, confirmed HR
base per `anthropic-skills:employee-sync` and `wmdemo/hr/airtable_read.py`'s own citation):

| Table | Table id | Ladder-relevant fields |
|---|---|---|
| Incidents | `tblGkzrBFpSo2EqzP` (AiDraftPoller.js:50) | `fldYwcrDp5oznm0Z1` Source (corrected-incident marker), `fldYbGQsMoI2kqFlO` HR Dismissed, `fldTC8Sfzv9EKPwlp` Date |
| Employee Write-Ups | `tbliVQNsfTdPr7uEl` (AiDraftPoller.js:51) | `fldRNvfDQ9dUggbFN` HR Dismissed, `fldQHQKKMGQRZO0VK` Write-Up Level ("DIRTY: legacy options — normalize", onboarding/Config.js:366), `fldYZidppdD5e8nh8` Date, `fldHMLeyO6LzqtlCm`/`fld8uFGl3LTpAYDEP` Manager Approved By/At |
| Call Offs | `tbl9FPOZp6Y0dmUPl` (CalloffPortal.js:21) | — |
| Employees | `tblDtY9WsQGQOgHgw` (CalloffPortal.js:22) | — |
| Entities | `tblBsO7YhDMQSiO9t` (CalloffPortal.js:23) | — |

**GAP, confirmed two ways** (contracts/index.js:854 and independently
`wmdemo/hr/airtable_read.py`'s own docstring): `WriteUp.ladder` / `window_days` /
`dismissed` / `counts_toward_ladder` have **no Airtable column at all** — the
attendance/accuracy split and the 90-day window do not exist anywhere in Airtable or GAS
today. This engine is the first place these concepts exist in the estate. §6 asks who
computes/stores them when this goes live.

## 2. Function -> module map

| GAS function (file:lines) | wmdemo module / function |
|---|---|
| `fetchEmployeeWriteUpHistory` (Aiwriteupdrafter.js:432-473) | superseded by `ladder_state()`'s per-record `counts_toward()` filter; the Airtable fetch itself is step 3's job, not this module's |
| `fetchEmployeeIncidents` (Aiwriteupdrafter.js:482-531) | superseded, same as above, for the incident side |
| `aidFetchByRecordIds_`/`aidEmployeeLinkedIds_` (Aiwriteupdrafter.js:349-430) | not ported here — no Airtable I/O in this package; `wmdemo/hr/airtable_read.py` has no WriteUp/Incident read path yet (flagged in its own docstring) |
| level-cap block inside `generateAiDraft` (Aiwriteupdrafter.js:880-910) | `wmdemo/writeups/ladder.py::ai_draft_cap()` |
| PROGRESSIVE DISCIPLINE RULES prompt text (Aiwriteupdrafter.js:670-675) | `wmdemo/writeups/ladder.py::LEVELS` — hardened into a table, SEMI-INFERRED (see that constant's docstring and §6) |
| `mapIncidentTypeToViolationCategory` (Webapp.js:782-804) | evidence only, inlined into `classify()`'s docstring table — not called at runtime; `classify()` derives straight from `type` |
| `wpIsRescinded_` (Connecteammessenger.js:199-216) | `ladder.py::counts_toward()`'s `status == RESCINDED_STATUS` check |
| `wpAssertAutoDeliverable_` (Connecteammessenger.js:231-291+) | `ladder.py::step_up_allowed()` — NEW one-level-per-stamp cap added, see that function's docstring |
| SEND_WRITEUP manager-approval stamp (Webapp.js:1536-1599) | `ladder.py::step_up_allowed()`/`next_level()`; the HTTP route + signed-link verification is step 4, not built here |
| `WP_CORRECTED_SOURCE` filter (CorrectionSweep.js:58, Aiwriteupdrafter.js:502-524) | `ladder.py::CORRECTED_SOURCE_MARKER` / `counts_toward()` |
| *(no GAS equivalent — GAS has one combined ladder)* | `ladder.py::classify()` — NEW attendance/accuracy split |
| *(no GAS equivalent)* | `ladder.py::ladder_state()` — NEW 90-day window, per-ladder count/level/history, total ledger |

## 3. The ladder engine spec

**As coded today (GAS, READ):**

| Aspect | Value | Evidence |
|---|---|---|
| AI-writable levels | `First Warning`, `Second Warning` only | Aiwriteupdrafter.js:891 |
| Recommendation field (unenforced) | First/Second Warning, Final Warning, Termination | Aiwriteupdrafter.js:892 |
| Cap enforcement | post-response re-validation; out-of-set output forced to Second Warning, opinion kept in `severity_recommendation` | Aiwriteupdrafter.js:893-903 |
| Step-up mechanism | HMAC-signed `SEND_WRITEUP` POST from the HR Dashboard carrying `approvedBy`; stamps `Manager Approved By` | Webapp.js:1536-1599 (1580-1585) |
| Step-up gates | `PHASE3_ACTIONS_ENABLED` script property must be 'true'; `ALLOW_WRITES` kill switch | Webapp.js:1551-1564 |
| Write-up history window | 24 months | Aiwriteupdrafter.js:432-436 |
| Incident history window | 12 months | Aiwriteupdrafter.js:482-486 |
| Dismissed | HR-dismissed write-ups AND incidents excluded (field id and name key both checked) | Aiwriteupdrafter.js:463-465, 517-520 |
| Rescinded | excluded via `wpIsRescinded_` (fail-closed) | Aiwriteupdrafter.js:459-468 |
| Corrected incidents | excluded (`Source !== WP_CORRECTED_SOURCE`) | Aiwriteupdrafter.js:517-528 |
| Ladder shape | ONE combined write-up + incident count | same functions, no category split |
| Lookup failure | fails closed (`null`, never `[]`) so an outage never reads as "no priors" | Aiwriteupdrafter.js:400-411 |

**Decision table — GAS vs the decided target:**

| Rule | GAS today | Target (decided 2026-09-16) | Port action |
|---|---|---|---|
| AI cap | Second Warning, hard | same | carry forward, incl. the post-response re-validation |
| Step-up | manager stamp via signed channel | manager approve-and-send stamp | carry forward (signed links + session principal) |
| Ladder scope | one combined ladder | attendance and accuracy SEPARATE | build new |
| Window | 24 mo write-ups / 12 mo incidents | 90 days | build new |
| Dismissed | never count | never count | carry forward |
| Fail-closed lookups | yes | yes | carry forward |

Field ids: `fldRNvfDQ9dUggbFN` HR Dismissed (write-up), `fldYbGQsMoI2kqFlO` HR Dismissed (incident),
`fldQHQKKMGQRZO0VK` Write-Up Level.

## 4. Goldens (qa/fixtures/writeups/goldens.json, 15; run by qa/writeup_ladder_probe.py)

| id | scenario | derivation | expected |
|---|---|---|---|
| G1 | 3rd attendance incident in 90d, one dismissed | owner rule (dismissed never counts) + `LEVELS` | count 2, `second_warning` |
| G2 | accuracy incident does not advance attendance | owner rule (ladders separate) | attendance 1/`first_warning`, accuracy 2/`second_warning` |
| G3 | 91-day-old incident drops out | owner rule (90-day window) | count 0, `none` |
| G4 | rescinded write-up drops out | Connecteammessenger.js:199-216 | count 0, `none` |
| G5 | corrected incident drops out | Aiwriteupdrafter.js:502-524 / CorrectionSweep.js:58 | count 0, `none` |
| G6 | AI recommends Final -> capped to Second, recommendation kept | Aiwriteupdrafter.js:880-910 | `{level: second_warning, severity_recommendation: final_warning}` |
| G7 | manager stamp steps up to Final | Webapp.js:1569-1593 + task brief step-up rule | `step_up_allowed` ok=True |
| G8 | non-manager stamp refused | task brief (hr:approve scope required) | ok=False |
| G9 | voided write-up drops out (status only, dismissed=false) | Webapp.js:2025-2026 "void"/"withdrawn" — same predicate as G4, independent trigger path | count 0, `none` |
| G10 | two ladders active -> total ledger sums | owner rule (one total ledger) | attendance 2, accuracy 1, total_ledger 3 |
| G11 | DST/timezone boundary (spring-forward) | `_ensure_aware`/`_parse_iso` UTC-instant arithmetic | count 0, `none` (age 90d6h30m, just past the boundary) |
| G12 | unknown type -> reported not counted | task brief + `classify()` | 2 unclassified, 0 counted |
| G13 | `late_delivery` does not count as attendance | closest classify() judgment call — see §6 Q1 | 1 unclassified |
| G14 | future-dated record does not count yet | `counts_toward()` age >= 0 | count 0, `none` |
| G15 | missing date fails closed, not counted | `counts_toward()` fail-closed default — see §6 Q5 | count 0, `none` |

Plus (not separately goldened, but probe-asserted): a full 17-value `IncidentType` enum
sweep against the classify() table in the module docstring; property checks named in the
task brief (counts never negative, dismissed never counts regardless of other flags, the
AI cap is idempotent, step-up is monotonic in the approver's authority); `next_level()`
combining both actors; and edge cases (naive `now` rejected, the 90-day boundary is
exclusive, `ai_draft_cap`/`step_up_allowed` reject an unrecognised level). 83 checks total,
`python3 qa/battery.py --only=writeup_ladder_probe` — 83/83 measured on a scratch DB/server
(WM_DEMO_DB + a boot on 8931 with WM_DISABLE_BACKGROUND=1 WM_API_READONLY=1).

## 5. Build order

1. **Contract fixtures** — `WriteUp`/`Incident`/`CallOff` against the field-id map. Haiku. No dependency.
2. **Ladder engine (pure, no I/O)** — the decided rules: per-ladder counts within 90 days, dismissed/rescinded/corrected excluded, level derivation, step-up eligibility. Sonnet. Depends on 1. Probe `writeup_ladder_probe` fed by the §4 goldens.
3. **AI draft adapter** — wraps the docs app's `llm_adapter`, reproduces the Aiwriteupdrafter.js:893-903 cap re-validation exactly. Sonnet. Depends on 2 and on `wmdemo/hr/airtable_read.py` (landed) + `airtable_write.py` (in progress).
4. **Approve-and-send route** — signed-link + session principal, replay guard (Webapp.js:1195-1207 pattern: ±300 s window, constant-time compare), stamps the approver, sends via `wmdemo/outbound`. Sonnet (security-sensitive). Depends on 3, `signed_links.py`, `outbound/`.
5. **Call-off Discord/Connecteam routing** — already shipped in GAS (per team/entity via Entities); reuse the outbound adapters' routing map, do not re-port; check CLAUDE.md §4.8 for duplicate fetches. Haiku.
6. **Goldens + cutover gate** — the 10 §4 scenarios run against the new engine (and against GAS read-only where `ContractTest.js` can run standalone); any mismatch blocks cutover. Sonnet.

Sections 1 (entry points, triggers, side effects, Airtable tables), 2 (function → module map), 4 (10
goldens with expected outcomes) and 6 (risks; people-judgement questions for JT) — to be written by
the step-2 builder before coding, from the same sources, with path:line.

## 6. Risks + questions for JT

**Risks.**
- `wmdemo/writeups/ladder.py` is pure and untested against real Airtable data — every
  classification and boundary is only as good as the goldens; step 3's real-data run should
  re-check counts against a live employee's actual history before anyone trusts a draft.
- The count -> level table (`LEVELS`) has never existed as code anywhere in this estate; it
  is a hardening of natural-language prompt text an LLM used to interpret loosely (see Q2).
- `step_up_allowed()`'s one-level-per-stamp cap is new behavior with no GAS precedent (see
  Q4) — a real HR Dashboard flow that currently jumps straight from Second Warning to
  Termination in one manager action would be refused by this engine unless the approver is
  admin.
- No Airtable column exists yet for `ladder`/`window_days`/`dismissed`/`counts_toward_ladder`
  (§1 GAP) — step 3/4 cannot store or re-read this engine's output without either new Airtable
  fields or a decision to compute them at read time, every time.

**Questions (≤6):**
1. `classify()`'s closest call: `late_delivery` (driver lateness on an order) is currently kept
   OUT of the attendance ladder because it is not the employee being late/absent for their own
   shift, unlike `late_or_no_show`. Confirm, or fold it into attendance.
2. Is the count -> level table (`none/1/2/3/4+` -> `none, First, Second, Final, Termination`)
   actually wanted as a deterministic rule, or should the engine only ever report a `count` per
   ladder and leave level selection to the AI draft / a human, as GAS effectively does today (no
   code table, only prompt guidance)?
3. No `IncidentType` for "call-off" exists (§1/classify() docstring) — should repeated call-offs
   feed the attendance ladder at all, and if so, through what event (a synthesized Incident? a
   new IncidentType?), since `CallOff` records never reach this engine today?
4. `step_up_allowed()`'s "never more than one level per stamp unless the approver is admin" rule
   is new, not carried from GAS. Confirm it's wanted, and confirm what "admin" should mean for a
   real approver principal (a scope? a role? — this module accepts either `is_admin=True` or an
   `"admin"` scope, whichever step 4 ends up minting).
5. `counts_toward()` fails closed toward NOT counting a record with a missing/unparsable
   `date_of_incident`/`created_at` (undercounting a disciplinary record) — the opposite direction
   from GAS's own fail-closed choice (Aiwriteupdrafter.js:404-413 blocks the whole draft rather
   than silently dropping one record). Confirm undercounting is the safer default here, or say
   which direction is wanted.
6. When step 3/4 land, do `ladder`/`window_days`/`dismissed`/`counts_toward_ladder` get real
   Airtable columns (so a person can see them in the base), or are they always derived at read
   time from existing fields (Incident Type, dates, HR-Dismissed, rescission)? This decides
   whether step 3's adapter writes anything back to Airtable at all.
