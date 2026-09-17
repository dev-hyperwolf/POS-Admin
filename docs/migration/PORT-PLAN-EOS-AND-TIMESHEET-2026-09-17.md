# Port Plan: End-of-Shift/Close-out Portal + Timesheet Audit — 2026-09-17

Status: COMPLETE (first pass). INFERRED/UNVERIFIED marks anything not directly confirmed by
reading the cited line or by documentary evidence; both parts carry open BLOCKING items for JT
that need either live Apps Script access or an owner decision (see §1.6 and §2.7).

Scope note: `end-of-shift-portal/` also contains BlazePos.gs (185 KB), LeisurePayCardLane.gs
(52 KB), LpDashboard.html (208 KB), FormServer.gs (266 KB), Dashboard.gs (199 KB) — this port
covers close-outs / retail float / closer reports / LP triage-decision / loss ledger only.
Everything else in that project is explicitly OUT (listed below with one line each).

---

## Part 1 — End-of-Shift / Close-out Portal

### 1.0 Out of scope (same repo, not touched by this port)

**OUT — Blaze POS / delivery integration** (own future port, not this slice):
`BlazePos.gs` (185KB), `BlazeDelivery.gs`, `BlazeDeliverySetup.gs`, `BlazeDiagnostics.gs`,
`BlazeKeySetup.gs`, `BlazeReferenceSync.gs`, `BlazeTenderReport.gs`, `ProductCatalog.gs`,
`ProductPicker.html` — Blaze API calls (auth, catalog, tender/reference sync) unrelated to
close-out arithmetic.

**OUT — LeisurePay card-processor integration** (own future port):
`LeisurePayCardLane.gs` (52KB), `LeisurePay.gs`, `LeisurePayAssociateSync.gs`,
`LeisurePayAuthProbe.gs`, `LeisurePayKeySetup.gs`, `LeisurePayReferenceSync.gs` — only the
*card-count/card-total fields already asserted onto a Closer Report* (LP Card Count/Total,
LP vs Blaze Status) are in scope; the sync jobs that populate LeisurePay reference data are not.

**OUT — Resolution/Warranty side-portal** (separate feature, not close-out/loss-ledger):
`ResolutionForm.html`, `ResolutionFormServer.gs` (waste/credit-memo/warranty log),
`WarrantyWeeklyReport.gs` (weekly warranty report email), `ProductPicker.html`.

**OUT — LpDashboard.html (208KB) / FormServer.gs (266KB) / Dashboard.gs (199KB), bulk**: only
the LP-triage, By-Day, Store-Close-Outs (HWR) and close-out-submission slices of these three
giant files are in scope (see §1.1/§1.2 below for exact anchors); the rest — warranty routing,
product picker wiring, dead legacy screens — is out.

**Shared dependencies (read-only; not ported as owning files, but the in-scope code calls
them)**: `Airtable.gs` (REST wrapper), `Config.gs` (CR field-id constants — `AT_TABLE_*`
definitions live here; not located in this pass, see §1.6 risk #4), `EntityRegistry.gs`,
`DuplicateGuard.gs` (`EOS_DUP_STATUS`), `IncidentEngine.gs` (`computeDiscrepancyType_`,
`computeSeverity_`), `ResponsePortal.gs` (driver HMAC response — small enough to port, see
§1.2), `HmacToken.gs`, `ZZ_MailIdentity.gs` (`hwSendMail_`), `ContextReminderEngine.gs` (24h
reminder cadence on open incidents — coupled to the case lifecycle but not in the task's
named-file list; flagged as a likely 8th in-scope trigger, see §1.6 risk #1), `Poller.gs`.

### 1.1 What it does today

**Entry points** (`FormServer.gs:24` `doGet(e)` is the single web-app router; `WebhookHandler.gs:8`
has the 2 `doPost` handlers) — INFERRED file:line from the fact-finding pass, re-verify before
building:
- Default / `?entity=<slug>` → `Form.html` closer-report submission (delivery + retail modes),
  validated `FormServer.gs:2174-2199`, sanitized `:2209-2295`, submitted `:1636-1717` (delivery)
  / `:2387-2419` (retail) → `createCloserReport` writes Closer Reports
  (`appouBkOofOK3zjN8/tblRDz09UwZdkDnoZ`).
- `?page=lp` → `Dashboard.gs:39-54` `handleLpDashboardGet` → `LpDashboard.html` (LP auditor/
  manager/store-verifier surface, domain-session auth only, no role check `Dashboard.gs:29-36`).
- `?action=respond` (HMAC magic link) → `ResponsePortal.gs`, driver response form,
  `:101-102,163-191` writes `DRIVER_RESPONSE` + timestamp.
- `?action=verify` → `FormServer.gs:90` `eosFormVerifyRouteGet_`, Team Lead HMAC magic link
  (Store Close-Outs two-stage verify).
- `?action=queue` → `FormServer.gs:94` `eosFormQueueRouteGet_`, store-lead retail queue.
- `?action=managerDecision` / legacy email buttons → `ManagerDecision.gs`, **dead**
  (`WALKTHROUGH-NOTES-LP.md:632-639`) — confirmed for DROP, `OWNER-DECISIONS-NEEDED.md` item 6.
- `?action=warranty` — inert per its own comment (OUT, §1.0).

**Triggers + schedules** — re-derived census (`grep -a -n "ScriptApp.newTrigger"` across live,
non-`_backups` files): **15 install sites project-wide, 7 in-scope**:

| Function | File:line | Schedule | Purpose |
|---|---|---|---|
| `mirrorLossToDirectory` | LossLedger.gs:343 | every 30 min | mirrors loss rollups into the HR Employee Directory base — **RETIRED in the port**, see §1.3 |
| `sendEosDailyDigest` | ManagerDigest.gs:1335 | daily, 8am PT | manager digest email (not previously enumerated in the task's brief — a real 5th/6th in-scope trigger) |
| `checkIncidentAging` | ManagerDigest.gs:1338 | every 4h | sweeps aging incidents |
| `RETAIL_AGING_TRIGGER_FN` | RetailEngine.gs:7079 | every 4h | sweeps Verify Deadline (retail two-stage verification) |
| `RETAIL_DISPUTE_AGING_TRIGGER_FN` | RetailEngine.gs:7288 | every 4h | sweeps Disputed rows only, escalates past `RETAIL_DISPUTE_MAX` |
| `RETAIL_DIGEST_TRIGGER_FN` | RetailEngine.gs:7525 | weekly, Monday 8am PT | retail weekly digest |
| `RETAIL_FINDINGS_DIGEST_TRIGGER_FN` | RetailEngine.gs:7676 | daily, 8pm PT | retail findings digest |

**UNVERIFIED — trigger-count contradiction**: `GAS-PORT-LIST-2026-09-17.md:37` claims "114"
triggers for this project; the direct `ScriptApp.newTrigger` code-site census above finds 15
total (7 in-scope). Not resolved in this pass — see §1.6 risk #1.

**Side effects** (in-scope code): Airtable writes to Closer Reports
(`appouBkOofOK3zjN8/tblRDz09UwZdkDnoZ`) and Daily Summaries (`tblIfKfmpKfxUjpd1`); HR-base
mirror writes via `mirrorLossToDirectory` (retired, not ported); email via `hwSendMail_`
(`ZZ_MailIdentity.gs:29`, Gmail API) for all retail/EOS digests — **no Discord webhook calls
found in in-scope files** (zero grep hits in `ManagerDigest.gs`/`RetailEngine.gs`); no PDF
generation in-scope.

**Airtable tables/fields** (full field-group inventory: `LP-AIRTABLE-SCHEMA.md`, base
`appouBkOofOK3zjN8`): Closer Reports `tblRDz09UwZdkDnoZ` (shift identity, cash count, expected
figures with receipt>pos>typed precedence — blank never coerced to 0, card reconciliation, LP
Batch Audited gate, discrepancy/incident fields, case lifecycle — Resolution Status/EOS Incident
ID/Response Deadline/Driver Response/Manager Decision/LP Disposition/Amount Recovered/Final
Loss/Severity/Pattern Flag, retail two-stage verification — Verification Status/Verified
By/Verify Deadline/Dispute Count/Closing Checklist, cash-carryover claims — Linked
Shift/Claim Status, human-confirmed only); Daily Summaries `tblIfKfmpKfxUjpd1` (day rollups);
staff link tables `tbloZmrKDWEQpR5v9`/`tblYWqhKR2rJqXBGR` (PII — home address/DOB/phone — never
migrate into the closeout data, per `LP-AIRTABLE-SCHEMA.md` "Rules the fields encode").
`AT_TABLE_*` constant definitions (base/table ids as GAS code symbols) live in `Config.gs`,
not located in this pass — see §1.6 risk #4.

**Timing/lock hazards**: `mirrorLossToDirectory` (LossLedger.gs:204-330) batches ≤10 rows via
`atBatchUpdate_` with per-batch (not whole-function) retry and 3 abort guards — **no
`LockService` usage anywhere in LossLedger.gs / RetailFloatPlan.gs / ManagerDigest.gs**
(grepped, zero hits); these three files are Airtable-only (no Sheets), so the row-index/lock
hazard class in CLAUDE.md §4 mostly does not apply here. The real hazard in this slice is
**not** locking but a **known unpatched bug**: `RetailFloatPlan.gs:293`
`RETAIL_FLOAT_ROLL_COMBO_CAP = 256` silently drops rolls from consideration above that
combination count, producing false "drawer doesn't balance" blocks on otherwise-correct counts
— documented, reproduced, and a tested patch was **deliberately not applied**
(`RETAIL-FLOAT-D1-FALSE-BLOCK-2026-08-16.md` §1–§4). This bug is **not carried into the port**
because the roll-solver itself is not carried over (§1.3).

**Also confirmed** (LP disposition re-fire bug, cited by `MIGRATION-PLAN-2026-09-16.md` §5):
`Dashboard.gs:829-831` `submitLpDecision`/`submitLpDisposition` has no lock — a double-click or
retried POST can re-fire a decision write. Fixed in the port by an idempotency key + row lock
on the new decision route (§1.2).

### 1.2 Function → our module map

| GAS function (file:line) | Our module / route | Spec |
|---|---|---|
| `FormServer.gs` closer-report submit (delivery `:1636-1717`, retail `:2387-2419`) | `POST /api/forms/closeout/submit` (`wmdemo/forms.py::submit`, `wmdemo/forms_api.py`) | **BUILT** — generic form pipeline already ports this exact flow (`MIGRATION-PLAN-2026-09-16.md` pseudocode): client validate (advisory) → server re-validate against `contracts.py`'s compiled schema (real gate) → over-posting 400 on unknown key → cash fields as integer cents → expected-cash fields null if unset, never 0 → `form_submissions` row. LP disposition/escalation is a separate later action, not part of this submit. |
| `Dashboard.gs:39-54` `handleLpDashboardGet` (Triage/By Day tabs) | `GET /api/lp/incidents`, `GET /api/lp/reports?date=` | **NEW** — `lp_api.py`. Reads Closer Reports (cash/discrepancy fields **restricted** — masked/rounded in list, exact cents in detail for `lp`/`admin` only) joined to Incidents. Role/scope: `lp`,`hr`,`admin` read (`MIGRATION-PLAN-2026-09-16.md` §M2 table). |
| `Dashboard.gs:689-757` LP Disposition write | `POST /api/lp/incidents/{id}/decision` (kind=`lp_disposition`) | **NEW** — idempotency key + row lock (fixes the `:829-831` re-fire bug). Values: `LpDisposition` enum (`explained`/`process_fix`/`true_loss`, `POS-Admin/contracts/index.js:282-283`). `true_loss` requires Final Loss set. Write scope: `lp`,`admin`. |
| `ManagerDecision.gs:347-404` | same route, kind=`manager_decision` | **NEW** — same endpoint, decision kind discriminates LP vs manager (separate actor per `LP-AIRTABLE-SCHEMA.md` "Rules the fields encode"). Values: `ManagerDecision` enum (`approve_write_up`/`dismiss_coaching`). Approve-write-up emits a `ContractEvent`, does **not** touch a legacy Airtable escalation checkbox directly. Write scope: `manager`,`admin`. Legacy email-button path (`ManagerDecision.gs`'s mail flow) is **DROPPED**, confirmed dead (`OWNER-DECISIONS-NEEDED.md` item 6). |
| `Dashboard.gs:775-813` Re-audit (By Day) | `POST /api/lp/reports/{id}/reaudit` | **NEW** — `rastat` (6-value server whitelist) + optional append-only note; unifies the two incompatible note-author formats currently in `AUDITOR_NOTES` (`LP-DASHBOARD-INVENTORY.md` §4). Write scope: `lp`,`admin`. |
| `Dashboard.gs:853,873-906` Reassign/Release | `POST /api/lp/incidents/{id}/reassign` | **NEW** — `admin`-only, target must resolve to a known employee record (fixes "Other…" free-text email accept, `Dashboard.gs:853`) and ownership is validated server-side (fixes no-ownership-check, `:873-906`). |
| RetailEngine.gs Tab-3 (HWR) verify/dispute/reopen | `POST /api/lp/closeouts/{id}/verify` / `/dispute` / `/reopen` | **NEW** — `lp` (verify/dispute) + new store-lead scope + `admin`. Carries the 2026-09-07 UX-audit MUST-DOs (urgency-order default, combined "needs a decision" filter, verify-and-advance, keyboard access) into the build rather than patching GAS first (`LP-DASHBOARD-STORE-CLOSEOUTS-UX-AUDIT-2026-09-07.md`). |
| RetailFloatPlan.gs cash-count arithmetic (`retailComputeVariance_`, `parseCashDiscrepancy_`) | `wmdemo/register.py` expected-cash formula | **BUILT, REPLACES** — `expected_cash_cents = opening_float + cash_sales + drops(paid_in/float_adjust) - drops(drop/paid_out)`, `variance = counted - expected`, computed once at close from a real closing count (`docs/REGISTER.md` §"The expected-cash formula"). See §1.3 for what does *not* carry over. |
| `RetailFloatPlan.gs:293` `RETAIL_FLOAT_ROLL_COMBO_CAP` roll-solver | — | **DROPPED**, not ported (see §1.1 hazard, §1.3). |
| `LossLedger.gs` `mirrorLossToDirectory` (trigger) + `computeLossRollups_`/`lossChipData_` (Dashboard.gs:104-133, 45min `CacheService` TTL) | `GET /api/lp/loss-ledger?window=` | **NEW, REPLACES** — live query over Closer Reports with `final_loss` populated (any report, not just True-Loss disposition — `LossLedger.gs:9-15` SCOPE [LOCKED]), `net_loss = max(0, final_loss - amount_recovered)` (`LossLedger.gs:9-10` [LOCKED]), `shift_date` via the `lossShiftDay_` logic (`:83-98`). Retires the 30-min-stale mirror and its stale-driver bug (`LossLedger.gs:63-64,166`) outright (`OWNER-DECISIONS-NEEDED.md` item 8, `MIGRATION-PLAN-2026-09-16.md` §5). Contract: `LossLedgerEntry` (`POS-Admin/contracts/index.js:979-990`). |
| `ManagerDigest.gs:1335` `sendEosDailyDigest` | `jobs.register("eos_daily_digest", schedule="daily:HH:MM")` | **NEW** job, body calls `wmdemo/outbound/email.py::send`. PT→UTC conversion needed at registration time. |
| `ManagerDigest.gs:1338` `checkIncidentAging` | `jobs.register("eos_incident_aging", schedule="every:14400")` | **NEW** job. |
| `RetailEngine.gs:7079` `RETAIL_AGING_TRIGGER_FN` | `jobs.register("retail_verify_aging", schedule="every:14400")` | **NEW** job — sweeps Verify Deadline. |
| `RetailEngine.gs:7288` `RETAIL_DISPUTE_AGING_TRIGGER_FN` | `jobs.register("retail_dispute_aging", schedule="every:14400")` | **NEW** job — escalates past `RETAIL_DISPUTE_MAX`. |
| `RetailEngine.gs:7525` `RETAIL_DIGEST_TRIGGER_FN` | `jobs.register("retail_weekly_digest", ...)` | **NEW job, gap**: `jobs.py`'s `schedule` grammar (`docs/JOBS.md` §Schema) only has `manual`/`every:<seconds>`/`daily:HH:MM` — no weekly kind. Either add a `weekly:DOW:HH:MM` schedule kind to `jobs.py`, or run `daily:08:00` and no-op inside the job body on non-Monday. Small addition, flagged for the build-order task. |
| `RetailEngine.gs:7676` `RETAIL_FINDINGS_DIGEST_TRIGGER_FN` | `jobs.register("retail_findings_digest", schedule="daily:HH:MM")` | **NEW** job (PT 8pm → UTC). |
| `ResponsePortal.gs:101-102,163-191` driver response | `POST /api/lp/respond/{token}` | **NEW**, small — HMAC single-use expiring token verify (model on `wmdemo/idv_webhooks.py`'s SSRF/HMAC discipline, `docs/OUTBOUND.md`'s "fails loud" precedent), writes `DRIVER_RESPONSE` + timestamp. No session auth; token is the auth. |

### 1.3 Engine spec

**Expected-cash reconciliation vs. the drawer module.** `wmdemo/register.py` (BUILT,
`docs/REGISTER.md`) already replaces the GAS/Airtable CR/CRX model for the arithmetic itself:

| GAS/Airtable | Kept in this port? |
|---|---|
| `Float Amount` (per-entity, e.g. Corona $100/Long Beach $50/West Hollywood $200, drivers $60) | Replaced by `register_sessions.opening_float_cents` (per-session, not per-entity-config) |
| `expectedCashValue` (hand-typed) | Replaced by `expected_cash_cents`, computed from real `pos_sales` rows — closes the exact gap `BLAZE-EXPECTED-CASH-BRIEF.md` named |
| `Safe Drop Amount` / `Cash Dropped/Deposited (Counted)` | Replaced by `cash_drops` ledger rows — `CASH-DROPPED-COUNTED-VERDICT-2026-08-17.md` retired the Airtable field for being a transcribed copy of its own input |
| `Deposit Variance` | Replaced by `variance_cents`, both sides independently sourced (not a tautology) |
| `RETAIL_FLOAT_ROLL_COMBO_CAP` / roll-solver | **NOT carried over** — different question (float composition, not "was today's drawer balanced"); this is also where the D1 false-block bug lived, so dropping it also drops the bug |
| `posCardTotalKnown`/`posCardCountKnown` presence flags | **NOT carried over** — no card-total ingestion path built yet |

The D1 **never-block rule** carries forward as policy, not just as a register.py implementation
detail: a variance past `HW_REGISTER_VARIANCE_ALERT_CENTS` (default $20) sets `needs_review`,
**never blocks the close** (`docs/REGISTER.md` §"The never-block rule (D1)"). The LP
close-out/CloserReport flow inherits this same posture — a flagged variance routes to LP triage
for a human decision, it does not stop the associate from closing.

**Open design question** (not yet decided — §1.6 risk #3): today's retail `CloserReport` is a
manually-entered denomination form (`LP-AIRTABLE-SCHEMA.md` §1, "Register/Till: free text
today"), separate from a `register.py` `RegisterSession`. This port does not merge them — the
`CloserReport` contract stays its own record, fed by the closeout form submission (§1.2). Once
POS terminals exist, wiring `CloserReport.cash` to read from a real closed `RegisterSession`
instead of re-asking the associate to retype counts is a natural follow-on, not built here.

**Incident/dispute aging sweeps → jobs.** All 4 four-hour/daily/weekly sweeps (§1.2 table)
become `jobs.py` registrations per `docs/JOBS.md`'s GAS-pattern table: `everyHours(4)` →
`schedule="every:14400"`, `atHour(H)` → `schedule="daily:%02d:00"`. Each job body follows
`jobs.py`'s own discipline (batch reads/writes, `ctx.checkpoint()` if a sweep grows large,
`ctx.retry()` on the individual email/Airtable call — never the whole sweep). None of the
in-scope sweeps found a `LockService` dependency to preserve (§1.1), so no lease/lock porting
is needed beyond `jobs.py`'s own per-job lease.

**LP triage-decision engine.** State/actor model, unchanged from GAS (kept because it encodes a
real policy split, not an accident): `CloserReportResolutionStatus` (10 values incl.
`submit_for_review`/`unresolved`/`resolved`/`pending_driver_response`/`closed_duplicate_archived`
— `contracts/index.js:277-281`) is the case-lifecycle status; `LpDisposition`
(`explained`/`process_fix`/`true_loss`) is the **LP adjudication** decision, a separate field/
actor/time from `ManagerDecision` (`approve_write_up`/`dismiss_coaching`), the **discipline**
decision — `LP-AIRTABLE-SCHEMA.md`'s "Rules the fields encode" states this split explicitly and
it must not be collapsed into one field in the rebuild. Both decisions write through the same
`/api/lp/incidents/{id}/decision` route (§1.2), discriminated by `kind`, both behind an
idempotency key + row lock. Visibility: cash-discrepancy history is `lp`+`admin` scope only by
default (`hr`/`manager` excluded) — an explicitly narrow default the owner may widen later,
never the reverse (`OWNER-DECISIONS-NEEDED.md` item 5).

### 1.4 Goldens (10 scenarios)

1. Retail close-out, `|variance| ≤ $20` → `needs_review=false`, no incident created, close
   returns 200 (`docs/REGISTER.md` D1; `RetailFloatPlan.gs` precedent).
2. Retail close-out, `|variance| > $20` → `needs_review=true`, close still returns 200 (never
   blocks), `CloserReport.discrepancy.has_discrepancy=true`, an Incident is opened.
3. `expectedCashValue` left blank at submission → stored/returned as `null`, never coerced to
   `0`, and LP triage renders "unknown", not "$0" (`LP-AIRTABLE-SCHEMA.md` §3).
4. LP disposition = `explained` → `final_loss`/`amount_recovered` may stay unset; no
   `LossLedgerEntry` row appears in the live loss-ledger query (only rows with `final_loss`
   populated appear, `LossLedger.gs:9-15` [LOCKED]).
5. LP disposition = `true_loss` with `final_loss=$150`, `amount_recovered=$50` → loss-ledger
   query returns `net_loss=$100` (`max(0, final_loss - amount_recovered)`, [LOCKED]).
6. Manager decision = `approve_write_up` → a `ContractEvent` is emitted; no legacy Airtable
   write-up-escalation checkbox is touched directly (`MIGRATION-PLAN-2026-09-16.md` §M2 row).
7. Same decision POSTed twice with the same idempotency key (simulating a double-click/retry)
   → second call is a no-op, returns the first result, no duplicate write (fixes
   `Dashboard.gs:829-831`).
8. A retail report's Verify Deadline passes with `Verification Status=pending` →
   `retail_verify_aging` job flags/notifies within its 4h sweep window.
9. A retail report's Dispute Count exceeds `RETAIL_DISPUTE_MAX` → `retail_dispute_aging` job
   escalates it to manager triage (status change, not silently re-aged forever).
10. A cash-carryover claim with no human-confirmed `Linked Shift` → prior-date amount is shown
    as an available claim, never auto-linked into the current report's totals
    (`LP-AIRTABLE-SCHEMA.md` §8, "human-confirmed only").

### 1.5 Build order

| # | Task | Model | Depends on | Probe |
|---|---|---|---|---|
| 1 | Locate `Config.gs`'s `AT_TABLE_*`/`AT_BASE_*` constants; confirm base/table ids against `LP-AIRTABLE-SCHEMA.md`; write the read-only Airtable→wm-demo backfill for historical Closer Reports | Haiku | none | `qa/lp_backfill_probe.py` |
| 2 | `lp_api.py`: Triage + By Day read routes, LP Disposition / Manager Decision / Re-audit / Reassign write routes, idempotency key + row lock | Sonnet | task 1, `contracts/index.js` CloserReport | `qa/lp_decision_probe.py` |
| 3 | Live loss-ledger query endpoint (replaces `mirrorLossToDirectory`) | Sonnet | task 2 | `qa/loss_ledger_probe.py` |
| 4 | Register the 6 EOS/retail jobs (2 digests, 2 four-hour aging sweeps, 1 weekly digest needing the `jobs.py` weekly-schedule gap closed first, 1 findings digest) on `jobs.py`, wired to `outbound/email.py` | Haiku | `jobs.py`/`outbound` (built); small `jobs.py` schedule-kind addition | `qa/eos_jobs_probe.py` |
| 5 | Store Close-Outs verify/dispute/reopen routes; confirm retail variance arithmetic delegates to `register.py`'s formula, not a re-implementation | Sonnet | `register.py` (built), task 2 | `qa/retail_closeout_probe.py` |
| 6 | Driver-response HMAC token route (port `ResponsePortal.gs`) | Haiku | `idv_webhooks.py` pattern | `qa/driver_response_probe.py` |
| 7 | Wire one of the 4 LP-Triage frontend concepts (`explorations/LP-TRIAGE-CONCEPTS.md`) to the new routes, carrying the 2026-09-07 UX-audit MUST-DOs | Sonnet | tasks 2–3 | manual + accessibility pass on UX-audit items #7/#9 |

### 1.6 Risks + questions for JT (≤ 6)

1. **BLOCKING** — trigger-count contradiction: `GAS-PORT-LIST-2026-09-17.md` claims 114 triggers
   for this project; direct code census finds 15 (7 in-scope). Resolving which figure is real
   needs a live `ScriptApp.getProjectTriggers()` check inside the Apps Script editor (only the
   owner has that session) — needed before build order §1.5 can be called complete.
2. `ContextReminderEngine.gs`'s 24h reminder cadence (escalates at ≥3 reminders) is coupled to
   the same case lifecycle as the in-scope files but wasn't in the task's named-file list —
   confirm whether it's an 8th in-scope trigger or genuinely out of scope for this port.
3. Should the retail `CloserReport.cash` section eventually read from a real `register.py`
   `RegisterSession` instead of a separately-typed denomination form once POS terminals exist?
   Not built in this port either way — decide direction before task 5 designs the field mapping
   permanently.
4. `Config.gs`'s `AT_TABLE_CLOSER_REPORTS`/`AT_BASE_EOS` constant definitions were not located
   this pass (likely a restricted/hidden-permission file) — task 1 needs them before it can
   write a real backfill; low risk, one more grep pass resolves it.
5. **Escalate** — the legacy email-button `ManagerDecision.gs` path is confirmed dead code but
   still technically reachable; retiring it during the cutover window touches a live,
   already-sent-email surface (old emails may still contain the link) — needs an owner decision
   on communication/timing, not just a code deletion.
6. Cash-discrepancy history visibility defaults to `lp`+`admin` only (`hr`/`manager` excluded) —
   restating the still-open question from `OWNER-DECISIONS-NEEDED.md` item 5: does JT want to
   widen this before or after the M2 build, given it can't be cleanly walked back once shipped?

---

## Part 2 — Timesheet Audit

### 2.1 Live-engine determination

**LIVE: `Phase2_ComplianceEngine.js:1014` `runAllEntitiesDailyAudit_v2`**, installed as the
6:00 AM Pacific daily trigger (`:1848-1854`, `.timeBased().everyDays(1).atHour(6)...
inTimezone(CONFIG.TIMEZONE)`). Confirmed by **documentary evidence, not code inference**:
`HANDOFF-2026-08-06-R2.5.md:3249` records seven Compliance Log rows stamped
`2026-08-01T13:06:19.930Z` (06:06 PDT) and states "daily cadence unbroken 07-29 → 08-06." This
is an actual observed run history, the strongest evidence class available short of a live
`ScriptApp.getProjectTriggers()` call.

**Correction to the task's 3-way framing** (the three files are layers of one live project, not
three competing near-duplicates):
- `TimesheetAudit.js` — the **core detection engine** (`auditDay_` at `:706`), depended on by
  Phase2 (`Phase2_ComplianceEngine.js:5-8` declares `DEPENDS ON: TimesheetAudit.gs (auditDay_,
  logInfractions_, sendDriverMessage_, getUsers_, CONFIG, getEscalationTier_)`). Its own
  `runDailyAudit` trigger target (`:4230`, install `:4324`) is the **retired v1, single-entity**
  entry point — present in code, not what fires.
- `MultiEntityRefactor.js` — entity config (`ENTITY_CONFIG` THC/CCTG/PM/AHC/HTS, `:17-51`) plus
  a **v1 multi-entity orchestrator** (`runAllEntitiesDailyAudit()`, no `_v2`, `:399`) and a
  trigger-install/dedup helper (`setupMultiEntityDailyTrigger_`, `:1294-1319`) whose own comment
  records that a prior install once left both a v1 and v2 trigger active simultaneously.
- `Phase2_ComplianceEngine.js` — the **live v2 orchestrator**, layering per-entity ConnecTeam
  API-key swap (`swapApiKey_`/`restoreApiKey_`, `:827`/`:884`), geofence toggles, Airtable
  Compliance Log writes and write-up creation on top of `TimesheetAudit.js`'s detection
  functions. `grep -n "^function runAllEntitiesDailyAudit_v2"` finds exactly one definition, at
  `:1014` — there is no second `_v2` implementation to disambiguate.

A port built against `TimesheetAudit.js` alone (as the task's framing initially suggested) would
silently omit per-entity ConnecTeam key rotation, Compliance Log writes, and write-up creation —
reverting to single-entity v1 behavior. Confidence: READ (trigger schedule, dependency
declaration, run-history evidence) / INFERRED (the "layers not duplicates" conclusion, from
reading the dependency chain rather than a live trigger list).

### 2.2 What it does today

**Entry point**: `Phase2_ComplianceEngine.js:1848-1854`, daily 6:00 AM Pacific (`CONFIG.TIMEZONE`).
No web app surface for this project (`OWNER-DECISIONS-NEEDED.md` item 12: "no UI today").

**External calls**: ConnecTeam API — `getUsers_`/`getTimeActivities_`/`getScheduledShifts_`
(`TimesheetAudit.js`), with the API key swapped per entity before each entity's pass
(`Phase2_ComplianceEngine.js:827` `swapApiKey_`, restored `:884`). Airtable base
`app8mI9K1lS1D3Uhk` (confirmed at `Phase2_ComplianceEngine.js:13,88,1646,1896,2035,2612`),
Compliance table `tblDtY9WsQGQOgHgw` (`:50,88`) — the same base/table the `airtable` skill
already documents for the Timesheet Audit base.

**Side effects**: Airtable Compliance Log writes (`logComplianceToAirtable_`, `:180`); Employee
Write-Up/Incident records (`createComplianceIncidents_`, `:2694`; `createLateClockInWriteUps_`,
`:2010` and v2 variant `:2314`; `createBreakViolationWriteUps_`, `:1871` and v2 variant
`:2455`); ConnecTeam Chat messages (`sendDriverMessage_`, in `TimesheetAudit.js`, called from
Phase2's per-entity pass); back-writes to the infraction sheet's status cells.

**Lock/write hazard — the exact §4.1 pattern, split across two files**:
- `TimesheetAudit.js` has **18 `.setValue(` sites**, confirmed count, all per-row inside
  issue-processing loops, no batched `setValues()`: lines 1664, 1672, 1695, 1809, 1811, 1822,
  1823, 1843, 2064, 2121, 3207, 3208, 3223, 3232, 3235, 3243, 3253, 3275. **One** `LockService`
  use in the whole file: `:2133` `LockService.getScriptLock()` inside
  `tsaMarkCorrectionStatusForIssue_`, protecting exactly the row-index write CLAUDE.md §4.4
  warns about — and its own comment at `:2127-2135` cites §4.4 by name and deliberately uses
  `tryLock(10000)`, not `tryLock(0)` (this is a correction/admin action, not a short frequent
  mutator, so the longer wait is the right call per §4.4's own distinction).
- `Phase2_ComplianceEngine.js` — **the live daily-trigger file** — has **8 more `.setValue(`
  sites** (`:1377,1386,1408,1545,1547,1554,1555,1577`), all per-row in
  `runTeamAuditWithEntityMessaging_`'s issue loop, and **zero `LockService` hits** anywhere in
  the file. This is CLAUDE.md §4.1 pattern #1 (per-cell writes in a loop) on the file that
  actually runs every morning, with none of the lock discipline the retired v1 file's one
  writer has. Not yet a reported incident — a latent gap, not a live failure — but it is exactly
  the shape of the 2026-08-16 driver-mgmt failures CLAUDE.md §4 was written from.
- Retry pattern is correct throughout: `TimesheetAudit.js:290-358` retries individual HTTP
  fetches (429/502-504), never the whole function; `:1410` is a smaller per-call retry loop —
  both match §4.5.
- One `.clear()` hit, `TimesheetAudit.js:5172`, in inventory-audit code unrelated to the daily
  audit loop — not a §4.6 hazard for this engine.

**Unverified live-incident note**: `Phase2_ComplianceEngine.js:845-859` documents (in a comment)
a real past incident where CCTG/AHC ConnecTeam API keys were rejected, silently failing every
CCTG (271/271) and AHC chat send. A code comment is not evidence of *current* state — confirm
against a live ConnecTeam call before assuming this channel works today (§2.7 risk #3).

### 2.3 Function → our module map

| GAS function (file:line) | Our module / route | Spec |
|---|---|---|
| `getUsers_`/`getTimeActivities_`/`getScheduledShifts_` (`TimesheetAudit.js`) | **NEW** — `wmdemo/hr/connecteam_read.py` | No ConnecTeam *read* adapter exists in wm-demo today — `wmdemo/outbound/connecteam.py` only **sends** chat/shift-notes (`docs/OUTBOUND.md`). This is genuinely net-new infrastructure, not a reuse. |
| `swapApiKey_`/`restoreApiKey_` (`Phase2_ComplianceEngine.js:827,884`) | reuse the existing `HW_CONNECTEAM_API_KEY_<COMPANY>` env-var convention (`docs/OUTBOUND.md` §"Env names") | No per-entity key "swap" needed in our stack — each entity's read call simply selects its own env var; there is no shared mutable key to restore. |
| `auditDay_` (`TimesheetAudit.js:706`, core detection) | **NEW** — `wmdemo/hr/timesheet_audit.py::audit_day()` | Re-implements the meal/rest-break + late-clock-in thresholds verbatim (§2.4 decision tables); writes via one batched `setValues()`-equivalent (a single bulk `UPDATE`/insert) per audit run, never per-row (fixes the §2.2 hazard). |
| `ENTITY_CONFIG` (`MultiEntityRefactor.js:17-51`) | **NEW** — `wmdemo/hr/entity_config.py` | THC/PM/CCTG/AHC/HTS, per-entity manager and `geofenceEnabled` (false for CCTG/AHC — "own facility iPad", `Phase2_ComplianceEngine.js:793,807`). |
| `logComplianceToAirtable_` (`Phase2_ComplianceEngine.js:180`) | `wmdemo/hr/airtable_write.py::create`/`update` (**BUILT**) | Writes to Compliance Log `app8mI9K1lS1D3Uhk/tblDtY9WsQGQOgHgw` — reuse the existing idempotency-keyed, rate-limited writer rather than a bespoke Airtable call. |
| `sendDriverMessage_` (Tier-2 warning) | `wmdemo/outbound/connecteam.py::chat()` (**BUILT**) | Reuse as-is; the queue/retry/rate-limit discipline in `docs/OUTBOUND.md` already supersedes whatever ad hoc retry `TimesheetAudit.js` had around its own message sends. |
| `createComplianceIncidents_`/`createLateClockInWriteUps_`/`createBreakViolationWriteUps_` (`Phase2_ComplianceEngine.js:2694,2010/2314,1871/2455`) | **DO NOT port literally** — build against the incident-pipeline's `Incident`/`WriteUp` contracts, and align with the **decided-but-unbuilt** attendance/accuracy write-up ladder (see §2.7 risk #1) | Two efforts cover the same ground: this port's escalation and the 2026-09-16 "Write-up ladder decisions" (separate attendance/accuracy ladder, 90-day window, dismissed never count, total ledger). Building this port's Tier2/Tier3 counters as a one-off risks a second, inconsistent ladder. |
| `getEscalationTier_` (referenced dependency, `TimesheetAudit.js`) | superseded by the ladder engine above, not ported literally | |
| `tsaMarkCorrectionStatusForIssue_` (`TimesheetAudit.js:2127-2135`, the one correctly-locked writer) | ordinary single-writer SQLite transaction | Our stack's one-writer-per-DB discipline (already the pattern `jobs.py`'s `_claim()` uses, `docs/JOBS.md`) achieves the same row-safety `LockService.getScriptLock()` gave here, without needing an explicit lock object. |
| Daily 6am PT trigger (`Phase2_ComplianceEngine.js:1848-1854`) | `jobs.register("timesheet_daily_audit", schedule="daily:HH:MM")` | **Gap**: `jobs.py`'s `daily:HH:MM` is UTC-fixed (`docs/JOBS.md` §Schema); "6am Pacific" drifts by an hour across DST twice a year under a hardcoded UTC time. Flagged, not resolved — see §2.7 risk #2. |

### 2.4 Engine spec (decision tables)

**Violation thresholds** (all from `TimesheetAudit.js`, the dependency the live v2 engine
calls into — presumed-live in the sense that Phase2 depends on these exact constants, not a
separate copy):

| Rule | Threshold | Source |
|---|---|---|
| Meal break required | shift length ≥ 5 hours | `:35` `MEAL_BREAK_THRESHOLD_HOURS` |
| Meal break minimum length | 30 min, ±1 min tolerance | `:37-38` |
| Meal break late grace | 0 min (comment: "fixed 2026-06-04") | `:39` `MEAL_BREAK_LATE_GRACE_MINUTES` |
| Rest break minimum length | 10 min, ±1 min tolerance | `:40-41` |
| Accidental break (not counted as a break at all) | < 3 min | `:47` `ACCIDENTAL_BREAK_THRESHOLD_MINUTES` |
| Short-break message threshold | 8 min | `:52` |
| Late clock-in grace | 7 min, both late and early | `:65` `LATE_CLOCKIN_GRACE_MINUTES` |
| Escalation Tier 2 | 2 occurrences in window | `:198` `ESCALATION.TIER_2_THRESHOLD` |
| Escalation Tier 3 | 3 occurrences in window | `:199` `ESCALATION.TIER_3_THRESHOLD` |
| Rolling window | 90 days (default) | `:2352` `windowDays\|\|90` |
| Tier 2 action | warning message via ConnecTeam chat | `:2447-2465` |
| Tier 3 action | write-up notice | `:2447-2465` |

**Entity branching**: `ENTITY_CONFIG` defines THC/PM/CCTG/AHC/HTS (`MultiEntityRefactor.js:17-51`
— per-entity manager names not extracted in this pass, INFERRED that all 5 exist from the
config keys only). Geofence enforcement is toggled off for CCTG and AHC ("own facility iPad",
`Phase2_ComplianceEngine.js:793,807`) — those two entities never raise a geofence-based
violation regardless of clock-in location.

**Messaging/escalation flow**: detection (`auditDay_`) → tier lookup against the 90-day rolling
window (`getEscalationTier_`) → Tier 2 sends a ConnecTeam chat warning, Tier 3 creates a
write-up notice and an Airtable Compliance Log row. This flow should **not** be ported as its
own parallel ladder — see the module-map row above and risk #1: the 90-day-window / Tier2-Tier3
shape here is the same problem the 2026-09-16 "attendance/accuracy ladder" decision already
addressed (separate ladder, 90-day window, dismissed entries never count toward escalation,
one total ledger per employee) but that ladder is **decided, not built**. This port is a natural
place to build it once, not a second time.

### 2.5 Goldens (10 scenarios)

1. 6-hour shift, 32-minute meal break taken within grace → no violation.
2. 6-hour shift, no meal break taken → meal-break violation logged.
3. A 9-minute break (rest break, under the 10-min−1-min-tolerance floor) → violation; a
   3-minutes-or-less break → accidental, never counted at all (`:47`).
4. Clock-in 8 minutes late (past the 7-minute grace) → late-clock-in violation logged.
5. Clock-in 5 minutes late (inside the 7-minute grace) → no violation.
6. Employee's 2nd violation inside the 90-day window → Tier 2 ConnecTeam warning sent.
7. Employee's 3rd violation inside the 90-day window → Tier 3 write-up notice created +
   Compliance Log row written.
8. Employee has one violation from 95 days ago and one new one → under the LIVE (GAS) 90-day
   rolling window, only the new one counts toward tier; if the port instead builds against the
   decided total-ledger ladder (§2.4), this golden's expected result changes — pin whichever
   model actually ships, and note the discrepancy explicitly rather than silently picking one.
9. A CCTG employee clocks in from off-site → no geofence violation is raised for that entity
   (`geofenceEnabled=false`), regardless of location.
10. A shift already resolved by the shipped cover-shift reply path (16-hour last-minute-shift
    rule, `cover-shift-late-clockin-gap` decision) must not be independently re-flagged as late
    by this engine — cross-system consistency, not just a threshold check.

### 2.6 Build order

| # | Task | Model | Depends on | Probe |
|---|---|---|---|---|
| 1 | ConnecTeam read adapter (`getUsers`/`getTimeActivities`/`getScheduledShifts`), per-entity via existing `HW_CONNECTEAM_API_KEY_<COMPANY>` env convention | Haiku | none (net-new) | `qa/connecteam_read_probe.py` (against a stub, never live ConnecTeam) |
| 2 | `wmdemo/hr/entity_config.py` — THC/PM/CCTG/AHC/HTS + geofence toggle | Haiku | none | `qa/entity_config_probe.py` |
| 3 | `wmdemo/hr/timesheet_audit.py::audit_day()` — port the decision tables (§2.4) verbatim, batched writes only (fixes §2.2 hazard) | Sonnet | task 1 | `qa/timesheet_audit_probe.py` |
| 4 | Escalation: build (not port) against the decided attendance/accuracy ladder (90-day window / dismissed-never-count / total ledger) | Sonnet | task 3; coordinate with whoever owns the ladder decision — currently unbuilt | `qa/escalation_ladder_probe.py` |
| 5 | `jobs.register("timesheet_daily_audit", ...)` with the DST caveat resolved (§2.7 risk #2), Compliance Log write via `hr/airtable_write.py` (**BUILT**) | Haiku | tasks 3–4 | `qa/timesheet_daily_job_probe.py` |
| 6 | Tier-2 messaging via `wmdemo/outbound/connecteam.py::chat()` (**BUILT**) | Haiku | task 4 | `qa/timesheet_messaging_probe.py` |

### 2.7 Risks + questions for JT (≤ 6)

1. This port's escalation logic and the 2026-09-16 "attendance/accuracy ladder" decision
   (90-day window, dismissed never count, total ledger — **decided, not built**) are the same
   feature. Recommend treating build-order task 4 above as *the* ladder build, not a second,
   parallel implementation — confirm ownership/sequencing with whoever was tracking that
   decision.
2. `jobs.py`'s `daily:HH:MM` schedule is UTC-fixed; the live trigger is "6am Pacific," which
   drifts an hour across DST. Decide: hardcode a UTC time and accept ~1hr seasonal drift twice a
   year, or add timezone-aware daily scheduling to `jobs.py` before this port's job registers.
3. `Phase2_ComplianceEngine.js:845-859`'s CCTG/AHC ConnecTeam API-key rejection is documented
   only in a code comment describing a past incident — confirm against a live ConnecTeam call
   whether those two entities' driver messaging channel currently works at all before assuming
   it's safe to port as-is.
4. The live daily-audit file (`Phase2_ComplianceEngine.js`) has 8 per-row `.setValue(` sites
   with **zero** `LockService` usage — CLAUDE.md §4.1 pattern #1, latent but not yet a reported
   incident. Confirm this hasn't already caused a wrong-row write in production (check failure
   emails) before assuming it's safe to leave running in GAS during the migration window.
5. `CoverShiftClaim.js` (same directory) implements the shipped 16-hour last-minute-shift rule
   and reply path that changes what counts as "late" for a covered shift — it was not deep-audited
   in this pass. Confirm the ported `audit_day()` (task 3) reads whatever state CoverShiftClaim
   already resolved, rather than re-detecting lateness independently (golden #10).
6. Per-entity manager names in `ENTITY_CONFIG` (`MultiEntityRefactor.js:17-51`) were not
   extracted in this research pass (keys/entities confirmed, manager values are not) — needed
   before task 2 can be considered complete.

---

## Sources

**GAS projects** (`.../gas-projects/`): `end-of-shift-portal/{FormServer,Dashboard,LossLedger,
RetailEngine,RetailFloatPlan,ManagerDigest,ManagerDecision,ResponsePortal,WebhookHandler,
LpDashboard.html,Form.html}.gs`; `timesheet-audit/{TimesheetAudit,MultiEntityRefactor,
Phase2_ComplianceEngine}.js`; `HANDOFF-2026-08-06-R2.5.md:3249`.

**Repo-root briefs** (`.../gas-projects/`): `RETAIL-FLOAT-D1-FALSE-BLOCK-2026-08-16.md`,
`CASH-DROPPED-COUNTED-VERDICT-2026-08-17.md`, `BLAZE-EXPECTED-CASH-BRIEF.md`,
`LP-DASHBOARD-STORE-CLOSEOUTS-UX-AUDIT-2026-09-07.md`.

**POS-Admin migration docs**: `docs/migration/{LP-DASHBOARD-INVENTORY,LP-AIRTABLE-SCHEMA,
GAS-PORT-LIST-2026-09-17,MIGRATION-PLAN-2026-09-16,OWNER-DECISIONS-NEEDED}.md`,
`explorations/LP-TRIAGE-CONCEPTS.md`, `contracts/index.js` (`CloserReport`, `LossLedgerEntry`,
their enums, and field-map comments citing GAS line numbers directly).

**wm-demo building blocks** (`/Users/jt/wm-demo/`): `docs/{REGISTER,JOBS,OUTBOUND,TAX}.md`,
`wmdemo/{register.py, jobs.py, reports.py, forms.py, forms_api.py, hr/airtable_write.py,
outbound/{connecteam,discord,email,queue}.py}`.

**Standing rules applied throughout**: `~/.claude/CLAUDE.md` §4 (four-point pre-flight, 30-min
execution cap, batch writes, lock scoping, smallest-unit retry, checkpoint/destructive-last,
watch-the-output) and the repo `CLAUDE.md` (grep -a, quoted globs, no `_reference/` cover-to-
cover reads).

**Research method**: two background read-only fact-finding passes (one per project) plus direct
grep/read of the contracts file and wm-demo docs by the writing pass itself; no files other than
this one were created, edited, or deleted, no git writes, no clasp, no `.env` access.
