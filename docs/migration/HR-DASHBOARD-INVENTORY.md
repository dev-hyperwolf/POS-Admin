# HR Group — Migration Inventory

Read-only audit, 2026-09-10. Repo: `gas-projects/` (GAS). Extends
`_fragments/hr-notes-digest-2026-09-10.md` (already read `WALKTHROUGH-NOTES-HR.md`,
`HR-DASHBOARD-EXPIRED-DOC-FALSE-POSITIVES-2026-09-03.md`, the attendance brief) — this pass
re-derives structure by grep/read of the actual `.js`/`.html`, not the notes. Four projects:
`onboarding/` (the "HR Dashboard", 9 screens, 22 files, ~34k ln), `daniel-hr/` (license/renewal
backend, no UI), `writeup-pipeline/` (incident/write-up/call-off portals + AI drafting), and
`timesheet-audit/` (compliance engine, no dashboard, one dispute portal). All four share Airtable
base `app8mI9K1lS1D3Uhk` and cross-call each other over signed HTTP (`_phase3PipelinePost_` /
`handlePhase3PipelinePost_`) — this is one system operationally, four GAS projects for deploy
isolation.

## 1. Projects — purpose / users / reach / cadence

| Project | Purpose | Users | Reached via | Cadence (verified `ScriptApp.newTrigger`) |
|---|---|---|---|---|
| `onboarding/` | HR Dashboard (read+Phase-3 actions) + new-hire onboarding + offboarding + document/SSN self-service | HR/managers (domain deployment @141), new hires/departing staff (anonymous @142) | `onboarding/Server.js:24` `doGet` router — `?portal=onboard\|session\|sign\|docupdate\|ssn`, else the dashboard (`Index.html`) | `DocExpirySweep.js:722` daily 7am; `OffboardingReadiness.js:1092` daily 7am; `OffboardingBounceSweep.js:592` every 4h; `OffboardingDrift.js:1791` daily 6am; `SignaturePortal.js:264,307` +30s once / every 15min sweep; `OnboardingPortal.js:2301-2304` daily 9am stale-reminder; `TemplateAudit.js:393-396` Mon 7am; `Server.js:2379` cache-warm every 10min |
| `daniel-hr/` | License/regulatory-doc renewal tracking → ClickUp tasks; no employee-facing UI | Daniel (ops), via ClickUp + email digest | `Webhook.js:23,27` `doGet`/`doPost` — ClickUp `taskStatusUpdated` webhook only | `Setup.js:31-49`: `runRenewalTracker` daily 8am, `runOverdueChecker` daily 4pm, `runDanielDigest` daily 7am (all America/Los_Angeles) |
| `writeup-pipeline/` | Incident intake, AI-drafted write-ups, ack/signature delivery, call-off portal, doc-update/reminder/digest jobs | Managers (draft/approve, driven from `onboarding` dashboard), any staff (incident/call-off forms), the cited employee (ack/sign links) | `Webapp.js:355-413` `doGet`/`doPost` → `handleRequest`, action-keyed router; unkeyed signed POST → `handlePhase3PipelinePost_` (HR Dashboard escalation channel) | `AiDraftPoller.js:568` every 15min; `DocExpiryNotices.js:670-672` `wpX_pollOffboarding` every 1h; `DocUpdateRequests.js:1287` every 4h; `DigestReports.js:373-385` weekly Mon 9am + monthly 9am; `ReminderEngine.js:938-941` daily 10am |
| `timesheet-audit/` | ConnecTeam clock-data compliance engine (late/break/meal violations → messages/escalation/write-up), call-off reporting; **no dashboard UI** | Compliance/ops (digest emails), drivers (ConnecTeam Chat messages, dispute portal) | `BreakDisputeLoop.js:1611,1625` `doGet`/`doPost` — the *only* web entry point in this project (break dispute link) | `TimesheetAudit.js:4324-4381` daily audit 6am, weekly report Mon 7am, monthly 8am, `checkUnresolved_` daily 10am; `TimesheetAudit.js:5076-5098` Inventory-team variant (Mon 7:30am / daily 6:30am — later shift start, same audit, not dead code); `Phase2_ComplianceEngine.js:1848` / `MultiEntityRefactor.js:1307` `runAllEntitiesDailyAudit_v2`; `BreakDisputeLoop.js:2099-2102` Sunday re-audit 11pm; `DailyCallOffReport.js:832-871` weekly Mon 6am, monthly, daily 7am |

Auth model (`onboarding/PinGate.js:1-40`): primary gate is the Google Workspace domain
deployment (`access:DOMAIN`); a PIN second factor gates 27+5 RPCs server-side
(`_hrPinGate_(arguments)` on the first line of each) because **both** the dashboard and the
anonymous new-hire portal are served from one script — every non-`_`-suffixed top-level function
is a reachable RPC regardless of which deployment loaded the page.

## 2. Screens, dialogs, forms

**HR Dashboard nav** (`onboarding/Index.html:621-629,833-841`): Overview, People, Onboarding,
Incidents, Write-Ups, Call-Offs, Compliance, Policies, Settings — rendered into 2 static
containers (`#screen-overview`, `#screen-people`) plus a shared `#screen-compliance` /
`#screen-generic` driven by `renderFlatList`/`renderRecList` (`Index.html:1858,2346`); Onboarding
has its own `renderOnboarding` (`Index.html:3275`).

Write actions exposed as `google.script.run` RPCs from the dashboard (all in `Server.js` unless
noted; gated by `_hrPinGate_`):

| Action | Fields / inputs | Validation | Writes |
|---|---|---|---|
| `escalateToWriteup(payload)` — `Server.js:4131` | reason (required text), category (optional, whitelisted `HR_WRITEUP_CATEGORIES`), evidence (incident/call-off ids) | reason non-empty; category must be in list if present; evidence must belong to the same employee, not dismissed (`_validateEvidenceSelection_:4053`) | signed POST → `writeup-pipeline` `ESCALATE_TO_WRITEUP` |
| `requestPolicyUpdate(payload)` — `Server.js:4360` | policy/doc type, employee | scope + entity-slug checks | signed POST → `writeup-pipeline` |
| `updateEmployeeDetails(payload)` — `Server.js:5182` | `changes{}` keyed to a whitelist (`_waveBEditFields_:5153`); text (max len by kind), email regex, multiselect arrays | field must be in whitelist or throws; unchanged values are never PATCHed | ONE `airtablePatchRecord_` to `TBL.EMPLOYEES`, whitelisted fields only |
| `assignManager(payload)` — `Server.js:5384` | `managerId` (`rec…` regex) or empty to clear | manager must resolve in viewer scope, must be Active, cannot self-assign | patches `F_EMP.REPORTS_TO` |
| `uploadEmployeeDoc(payload)` — `Server.js:5316` | doc key, file | `_waveBDocFields_:5284` whitelist | attachment field on Employees |
| `dismissRecord(table, recordId, on)` — `Server.js:5077` | table + record id + bool | table must be in `_dismissTableCfg_:5024`; refuses rows with no Employee link (per digest) | 3 additive fields + cache bust |
| `resendAckLink` / `approveAndSendWriteUp(writeUpId)` — `Server.js:4555,4631` | write-up record id | must not be already acked/dismissed/sent (delivery-keyed, not link-keyed, since 2026-09-08); `PHASE3_ACTIONS_ENABLED` flag | signed POST `SEND_WRITEUP` with `approvedBy` — this is the ladder step-up mechanic (manager stamp lets Final/Suspension/Termination past the AI's auto-send ceiling) |
| `revealSsn(recordId, entity, pinToken)` — `Server.js:7608` | record id, bearer PIN token | admin-only (`_isAdmin`); plaintext-only since cipher removed 2026-08-10 | none (read); logs "who looked," never the value |
| `employeeNotes(req)` family — `Server.js:7754-8111` | note body, author | author-scoped edit/delete (`_hrNoteMayMutate_:7886`) | per-employee notes table, soft-delete |
| `saveMatrixColumnOrder(order)` — `Server.js:5718` | column order array | — | UI preference, not employee data |

**New-hire / offboarding forms** (anonymous deployment, HMAC/token-authenticated, no Google
account required): onboarding journey (`onboarding_session.html`, `OnboardingPortal.js`),
signature capture (`signature_portal.html`, `SignatureEngine.js`/`SignaturePortal.js`), SSN
backfill — single field, 72h-expiring link, purpose-literal separate from doc-update
(`SsnCollect.js`, `Server.js:6-7 header note`), document re-upload — one named document, 7-day
link (`Server.js:6549` `obDocUpdateServePage_`, `obDocUpdateSubmit:6901` — vision-model scan
check before accept, `_obDocVisionExtract_:6755`).

**writeup-pipeline forms** (`Webapp.js` action router):
- **Incident report** (`IncidentPortal.js:227` `handleIncidentPost_`) — fields: submitterId,
  employeeId, dateOfIncident, incidentType, issueCategory, severity, customerName, orderNumber,
  description, isDriverInvolved (bool), escalateToWriteUp (bool), up to 20 attachments
  (`attachmentBase64_N`/`FileName_N`/`MimeType_N`). Required: submitterId, employeeId,
  dateOfIncident, incidentType, severity, description — severity is enforced **server-side**
  because a blank Severity silently drops the Airtable automation that fires escalation
  (`IncidentPortal.js:248-253`, incident P0-B 2026-08-07). Submitter re-validated server-side
  against `lookupAuthorizedSubmitter_` (defense-in-depth vs. tampered POST).
- **Call-off** (`CalloffPortal.js:350` `handleCallOffPost_`) — team, employeeId, type, date,
  shiftStartTime, reason, notes, expectedArrivalTime (required only when type=Late, plus
  shiftStartTime required for lateness math), optional doctor's-note upload to Drive. **Open
  access, no auth** — Submitted-By is derived from the employee picked in the dropdown.
- **Ack / Sign** (`handleVerifyAck`/`handleSubmitAck`, `handleSignRequest`/`handleSubmitSign`) —
  magic-link, single-purpose per write-up/document.

## 3. Data stores (read/write, per job) — PII and money flagged

| Store | What | Used by | Flag |
|---|---|---|---|
| Airtable `app8mI9K1lS1D3Uhk` `tblDtY9WsQGQOgHgw` Employees | canonical directory: identity, employment, docs, SSN/DL/vehicle, emergency contact (`onboarding/Config.js:89-311`, ~230 fields) | all 4 projects, R/W | **PII** (SSN plaintext `fldEw1uLp6v48uV9C`, DL, passport, home address, EC info) |
| `tblGkzrBFpSo2EqzP` Incidents, `tbliVQNsfTdPr7uEl` Employee Write-Ups, `tbl9FPOZp6Y0dmUPl` Call Offs, `tblRTJHawNT8jzJML` Compliance Log | discipline/attendance history | onboarding (R), writeup-pipeline (R/W), timesheet-audit (R/W), daniel-hr (R) | PII (behavioral record) |
| `tblcTvJ2GLSsKWzmt`/`tblzjGHylQ5xCC2BX`/`tblqVBc1RqHbB4q4c` (Tables A/B/C: Policies & Documents, Required Doc Set, Employee Renewal Checkpoints) | per-employee document tracking, config of which docs per role/entity | onboarding R/W | PII (documents) |
| `tblM2GhLLyIIpe83m` Offboarding, `tblzxovtHZGl5oKVs` Separation Deliveries | offboarding workflow state | onboarding R/W | PII |
| `tbl8fuGfIyGP4Pk75` Licenses, `tbl1YS5ka0qS65Uww` Renewal Checkpoints, `tblbBxgIDgWVrKSkC` License Types | **business/regulatory** licenses (3 rows) — not employee-scoped | daniel-hr R/W | none (not employee data) |
| writeup-pipeline-only tables (`tbl04ryJbMMpnkT5d`, `tblHkOhNjMnTIWRPy`, `tblIbgNErKciEQUwq`, `tblNlJ5SMVhFSnMPO`, `tblXanlCkdowcfLq7`, `tblfbgCw0eP1XXY9D`, `tblhsaAJ5FFevfEFF`, `tbliBEzgE4y95RKUE`, `tblnqXC1Jl7mCQvWx`, `tblylGhQ6jHKepdor`) | not individually named-mapped in this pass (budget) — grep `writeup-pipeline/ConfigReader.js` before build | writeup-pipeline | unknown, verify |
| Drive | doctor's notes, incident attachments, generated write-up PDFs, template Google Docs (tokenized) | `CalloffPortal.js` `uploadDoctorsNoteToDrive_`, `IncidentPortal.js` `uploadIncidentAttachment_`, `WriteUpPdfGenerator.js`, `onboarding/TemplateTokenizer.js` | PII (attachments) |
| Script Properties | `AIRTABLE_API_KEY`/`AIRTABLE_PAT`, `ANTHROPIC_API_KEY`, `DISCORD_WEBHOOK_URL`, `ENTITY_CONFIG`, `OB_DOC_VISION`/`_MODEL`, `OB_DX_MAX_SENDS`, `OB_INSCARD_OCR`, `ONBOARDING_DRYRUN`, `ONBOARDING_MANAGER_TITLES`, `ONBOARDING_ROLES`, `ONBOARDING_SESSION_SECRET`, `ONBOARDING_STEP_FIELD_ID`, `PORTAL_EXEC_URL`, `SIGNATURE_HMAC_SECRET`, `TEMPLATE_AUDIT_ALERT_TO`, `WRITEUP_PIPELINE_EXEC_URL`/`_HMAC_SECRET` (onboarding); `CLICKUP_API_TOKEN`, `CLICKUP_RENEWAL_LIST_ID`, `DANIEL_EMAIL` (daniel-hr, `Setup.js:8-11`) | secrets — never surfaced to client | secret |
| External APIs | Airtable REST (all 4), Anthropic (`onboarding`, `writeup-pipeline` — AI drafting/digests), ConnecTeam (`writeup-pipeline`, `timesheet-audit` — clock data, Chat messages), ClickUp (`daniel-hr` — renewal tasks + webhook), Discord webhook (alerting) | | money-adjacent: none direct (no payroll/POS $ in this group) |

## 4. Logic worth keeping (file:line) + defects

- **Risk score** `scoreEmployee()` (`onboarding/RiskScoring.js:94`) — verified against source,
  matches digest exactly: decay buckets ≤7d/8-30d/31-90d/>90d, severity/ack weights, level
  escalation bonuses, bands Low/Watch/Elevated/High. Deterministic, fully auditable
  (`reasons[]` sums to score).
- **Rank score** `scoreEmployeeRank()` (`onboarding/Server.js:5494`) — 100 minus penalties, mean
  of Compliance/LP/Attendance; `_annotateRanks_:5587`, determinism test at `:5614`.
- **Write-up ladder cap** — enforced in the AI prompt *and* re-validated after the model
  response: `writeup-pipeline/Aiwriteupdrafter.js:670-736` (prompt: level capped at "Second
  Warning", `severity_recommendation` carries the real opinion) + `:891-901`
  (`allowedLevels`/`allowedRecs` whitelist, force-corrects any out-of-band `level`). Step-up path
  is `onboarding/Server.js:4631` `approveAndSendWriteUp` — first-send-only gated on actual
  delivery (`EMAIL_SENT`/`CT_SENT`, fixed 2026-09-08 after being keyed on link-presence, which
  wrongly blocked rows the ceiling had held), stamps `approvedBy` into the signed pipeline call.
- **Document expiry** — Table A (`tblcTvJ2GLSsKWzmt`) is the read source
  (`Server.js:1417,1578` `_policyCellsFromTableA`/`_computeDocs`), but per the digest it was
  backfilled once (2026-07-12) and renewals only patch the directory, not Table A
  (`Server.js:1584-1591` cited in digest) — **13 of 18 "Expired" rows are false positives**,
  unfixed as of this pass.
- **Attendance / held clock-ins** — the false-positive engine gap (ConnecTeam per-company user
  ids, pending edit requests ignored) is in the digest's attendance brief summary, not re-derived
  here; `timesheet-audit/RunTonight.gs` is a one-time remediation script (36 pre-verified false
  positives voided 2026-08-27/28) — **not** live logic, safe to leave behind at migration.
- **Timesheet thresholds** — `timesheet-audit/TimesheetAudit.js:36-68`: meal break required after
  5h (`MEAL_BREAK_THRESHOLD_HOURS`), 2nd meal after 10h (defined but its enforcement is
  commented out at `:1028`— **dead rule, flag for owner**), zero grace on meal lateness
  (`MEAL_BREAK_LATE_GRACE_MINUTES:40`, "fixed 2026-06-04"), late clock-in grace 7 min (`:68`),
  escalation tiers 2nd/3rd same-type offense → warning/write-up (`:198-199`).
- **PIN second-factor** design rationale (`onboarding/PinGate.js:1-40`) is worth preserving
  conceptually even if the admin's own auth replaces it: the threat model is shoulder-surfing on
  an already-signed-in device, not a hostile domain account — POS-Admin's auth may already cover
  this differently, confirm before assuming a PIN is still needed.
- **Live defects not to carry forward** (digest, re-confirmed): `state.isAdmin` hardcoded true
  client-side (`Index.html:451`) — auth must be server-only in the rebuild; dead
  `insuranceCard(e)`, a Dismiss button that only toasts, 3 KPI chips that just reload, unfiltered
  `callOffs7d`, one modal reused for two purposes.
- **New finding this pass**: `writeup-pipeline` has 10 Airtable tables not yet named/mapped here
  (§3) — budget did not allow reading `ConfigReader.js` in full; do this before scoping the
  write-up/incident portal rebuild, not after.

## 5. Migration map

| Screen / form | Target | Notes |
|---|---|---|
| Overview, People, Compliance, Policies, Settings (read) | POS-Admin React app, new "HR" module | pure read + risk/rank display; port `_overviewForScope_`/`_policiesForScope_` server logic to a wm-demo (Python) HR API, keep entity-scoping server-side |
| Incidents / Write-Ups / Call-Offs lists + escalate/approve/dismiss actions | POS-Admin HR module | these are the highest-risk actions (SSN reveal, write-up send) — needs equivalent PIN-or-better second factor |
| Onboarding screen + new-hire portal (`onboarding_session.html`, SSN/doc-update magic links) | **form generator** (planned) + wm-demo route | good first candidate for the generator: field-whitelist pattern (`_waveBEditFields_`) already exists and maps cleanly to a schema-driven form |
| Incident report / Call-off forms (`writeup-pipeline`) | form generator + wm-demo route | server-side-required-field pattern (severity gate) must survive the port literally, not just client-side |
| AI write-up drafting + ladder cap | wm-demo (Python) service calling the model directly, or keep as a GAS-free Node/Python job | the cap-then-recommend pattern (§4) is the one piece of business logic to preserve exactly, including the post-response re-validation |
| Timesheet compliance engine | wm-demo scheduled job (no UI to port — it has none) | ConnecTeam-fetch + threshold logic only; the false-positive gaps (attendance brief) should be fixed in the rewrite, not ported as-is |
| daniel-hr | fold into wm-demo as a scheduled job + ClickUp webhook route | smallest project, no UI, straightforward lift |

**Person contract gap** (`/Users/jt/POS-Admin/contracts/types.d.ts:58`): current `Person` has
`id, kind, display_name, role, classification, store_id, email, phone, external_ids, verified,
created_at` — a POS/verify-oriented shape. Missing for HR entirely: employment (status,
title/location, manager/reports-to, tenure, employer/entity), documents (type, expiry,
attachment, per-doc status), discipline history (incidents, write-ups w/ level + ack state,
call-offs, compliance points), computed risk/rank scores, and the SSN/DL/vehicle/emergency-contact
PII block. Recommend a separate `HrEmployee` contract that references `Person.id` rather than
overloading `Person` — the two have different access-control needs (SSN access is far more
restrictive than anything Person-shaped needs today).

**Build vs. retire**: build — HR module screens, `HrEmployee`/`Document`/`WriteUp` contracts,
risk/rank/ladder-cap logic (port verbatim), entity-scoping middleware. Retire outright — the PIN
gate (if POS-Admin auth is equivalent-or-better), the dead 2nd-meal rule, the `isAdmin`
client hardcode, the reused modal. **Order**: (1) contracts + entity-scoping middleware, (2) read
screens (Overview/People/Compliance/Policies), (3) document tracking (fix the Table-A gap during
the port, don't carry it), (4) incident/call-off forms via the generator, (5) write-up
draft+ladder+approve flow (highest blast radius, do last with the most testing), (6) timesheet
engine as a background job, (7) daniel-hr. Rough elite-dev estimate: contracts+middleware 20-30h,
read screens 40-60h, documents 30-40h, incident/call-off forms 25-35h (less if generator lands
first), write-up pipeline 50-70h (AI drafting + ladder + delivery-state machine is the hard part),
timesheet engine 40-60h, daniel-hr 8-12h. Total ~215-305h before QA/rollout.

## 6. Owner questions

1. Is the PIN second-factor (`PinGate.js`) still needed once HR lives inside POS-Admin's own
   auth, or does POS-Admin already have an equivalent "re-auth for sensitive data" pattern?
2. Table-A document-expiry fix (13 false-positive rows, `Server.js:1584-1591`): fix pre-migration
   in GAS, or carry the correction into the rebuild's data model instead?
3. Should `HrEmployee` be a new contract referencing `Person.id`, or should `Person` itself grow
   an optional HR extension block? (Affects who can read what.)
4. SSN handling: keep plaintext-with-admin-gate-and-audit-log (current design), or does the
   rebuild get a real encryption-at-rest requirement?
5. `writeup-pipeline`'s 10 unmapped Airtable tables (§3) — worth a follow-up read of
   `ConfigReader.js` before scoping, or is the write-up pipeline being redesigned enough that the
   old schema doesn't matter?
6. Does the AI write-up drafter's ladder cap (Second Warning max, manager step-up) stay exactly
   as-is, or is this an opportunity to revisit the rule itself during the rewrite?
7. Timesheet compliance engine has no UI today — does the rebuild get one (a compliance
   dashboard), or does it stay a background job with digest emails only?
8. Priority order in §5 assumes read screens before write actions — confirm, or is there a
   business reason (e.g., an active incident backlog) to prioritize write-ups/incidents sooner?
