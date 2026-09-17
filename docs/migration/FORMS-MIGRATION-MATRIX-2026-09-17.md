# Forms Migration Matrix — 2026-09-17

Read-only. Sources cited inline as `path:line`. `[INFERRED]` marks a conclusion drawn from
cited lines rather than a line itself. Builds on `docs/migration/HR-DASHBOARD-INVENTORY.md` and
`docs/migration/LP-DASHBOARD-INVENTORY.md` (2026-09-10) — their form rows are treated as READ
citations here (re-spot-checked, not re-derived line by line, to stay in budget); anything new
this pass is marked "new".

Generator sources read: `/Users/jt/wm-demo/wmdemo/forms.py` (schema/compiler/backend, 759 ln),
`forms_seed.py` (3 seeded FormDefs), `forms_api.py` (287 ln, routes), renderer
`/Users/jt/POS-Admin/shared/hd-form.jsx` (682 ln), shell `POS-Admin/forms-app/app.jsx` +
`review.jsx`, `POS-Admin/docs/FORM-GENERATOR-PROPOSAL.md`.

## A. Form catalogue

Legend PII: R=restricted, I=internal, N=normal.

| # | Form | Source | Submitter | Trigger | Fields (types) | showWhen | Writes | Validation | PII | Freq |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Employee edit (`updateEmployeeDetails`) | `onboarding/Server.js:5182`, whitelist `Server.js:5153` | HR/manager (dashboard) | dashboard dialog | ~10-15 whitelisted fields (text/email/multiselect) | none seen | Airtable Employees, whitelisted fields only (`airtablePatchRecord_`) | field must be in whitelist; email regex; unchanged values never PATCHed | R (touches SSN-adjacent employee record) | ad hoc |
| 2 | Assign manager | `Server.js:5384` | HR/manager | dashboard dialog | managerId (person, `rec…` regex) or empty | none | Employees `REPORTS_TO` | must resolve in viewer scope, Active, no self-assign | I | ad hoc |
| 3 | Upload employee doc | `Server.js:5316`, whitelist `Server.js:5284` | HR/manager | dashboard dialog | doc key (select) + file | none | attachment field on Employees | whitelist | R (documents) | per doc |
| 4 | Escalate to write-up | `Server.js:4131` | manager | dashboard dialog | reason (text, req), category (select, opt), evidence (ids) | none | signed POST → writeup-pipeline `ESCALATE_TO_WRITEUP` | reason non-empty, category whitelisted, evidence same-employee/not-dismissed (`Server.js:4053`) | R (discipline) | per incident |
| 5 | Approve & send write-up | `Server.js:4631` | manager (PIN-gated) | dashboard button | writeUpId + approvedBy stamp | none | signed POST `SEND_WRITEUP` | not already acked/dismissed/sent, delivery-keyed | R | per write-up |
| 6 | Employee notes | `Server.js:7754-8111` | HR | dashboard dialog | note body, author | none | per-employee notes table (soft-delete) | author-scoped mutate (`Server.js:7886`) | R | ad hoc |
| 7 | Onboarding journey | `onboarding_session.html`, `OnboardingPortal.js` | new hire (anon, token link) | onboarding email link | multi-step (I-9-style personal/employment fields) — not field-enumerated this pass, budget | [INFERRED] step-gated | Employees directory | token/session-scoped | R | per hire |
| 8 | Signature capture | `signature_portal.html`, `SignatureEngine.js`/`SignaturePortal.js` | new hire/staff | magic link, HMAC | signature (signature type) + doc ref | none | Employees doc/signature fields | HMAC link validity, sweep every 15 min (`SignaturePortal.js:264,307`) | R | per doc |
| 9 | SSN backfill | `SsnCollect.js:259-300` "one-field SSN form" | new hire (anon, token) | 72h-expiring link | ssn (text, 1 field) | none | Employees SSN field + SSN_LAST4 always (`SsnCollect.js:195-213`) | token TTL (`_obSsnTtlLabel_:118`), purpose-literal `ssncollect` (`:99`) | **R (SSN plaintext)** | once/hire |
| 10 | Document re-upload | `Server.js:6549` `obDocUpdateServePage_`, submit `:6901` | departing/current staff (anon, 7-day link) | link | one named document (file) | none | Employees doc attachment | **vision-model scan check before accept** (`_obDocVisionExtract_:6755`) | R | per request |
| 11 | Incident report | `writeup-pipeline/IncidentPortal.js:227` `handleIncidentPost_` | any staff | portal link | submitterId, employeeId, dateOfIncident, incidentType(select), issueCategory(select), severity(select), customerName, orderNumber, description(textarea), isDriverInvolved(bool), escalateToWriteUp(bool), up to **20 attachments** | none | Incidents table | severity enforced server-side (`:248-253`), submitter re-validated (`lookupAuthorizedSubmitter_`) | R (discipline) | per incident |
| 12 | Call-off | `CalloffPortal.js:350` `handleCallOffPost_` | any staff, open/no auth | portal link | team, employeeId, type(select), date, shiftStartTime, reason, notes, expectedArrivalTime (req only when type=Late), doctor's-note file (opt, →Drive) | expectedArrivalTime/shiftStartTime required when type=Late | Call Offs table + Drive | server conditional-required | I | per call-off |
| 13 | Ack / Sign (write-up) | `Webapp.js` `handleVerifyAck`/`handleSubmitAck`, `handleSignRequest`/`handleSubmitSign` | cited employee | magic link, single-purpose | ack/sign confirmation, minimal fields | none | Write-Ups delivery state | link single-purpose per write-up/doc | R | per write-up |
| 14 | Closer Report — delivery | `end-of-shift-portal/Form.html`; validate `FormServer.gs:2174-2199`, sanitise `:2209-2295`, submit `:1636-1717` | driver | in-cab, default route | ~25 fields incl. money (lpCardTotal, expectedCashValue, closerCountedTotal, ccSalesTotal), int counts, cash denominations + rolled/loose coin, bool flags, conditional-required notes (cancelledItemsResult, expectedCashXrefFlag+Explanation), attestation checkbox | multiple: notes required when unverified/flagged | Closer Reports (`appouBkOofOK3zjN8`/`tblRDz09UwZdkDnoZ`) | duplicate block one/driver/shift-day (`DuplicateGuard.gs`) | I (money) + R (driver identity) | per shift |
| 15 | Closer Report — retail | `Form.html` mode=retail; `FormServer.gs:2387-2419` | store associate | in-store | register(select), expectedCashValue, coin counts (int, whole-number), **float-adequacy subset-sum check (server-enforced)** | expectedCashXrefFlag+Explanation | same table, Mode=Retail | subset-sum validator | I + R | per shift |
| 16 | Driver response | `ResponsePortal.gs:101-102,163-191` | flagged driver | HMAC magic link | responseText (textarea, req) | none | Closer Report response fields | HMAC | R | per flag |
| 17 | LP Disposition | `Dashboard.gs:689-757`, `LpDashboard.html:570-624` | LP auditor | dashboard drawer | disposition(select, req), Recovered $/Final Loss $ (3-state) | True Loss requires Final Loss | Closer Report disposition fields | none seen (no lock — `Dashboard.gs:829-831` re-fire risk) | I (money) | per flagged report |
| 18 | Manager Decision | `ManagerDecision.gs:347-404` | LP manager | dashboard, bare `confirm()` | choice only (Approve Write-Up / Dismiss) | none | RESOLUTION_STATUS, MANAGER_DECISION, Incidents STATUS | none | R (discipline) | per flagged report |
| 19 | Re-audit | `Dashboard.gs:775-813` | LP auditor | By Day tab | rastat(select, 6-value whitelist, req), ranote(text, opt, append) | none | RESOLUTION_STATUS, AUDITOR_NOTES | server whitelist | I | ad hoc |
| 20 | Retail Verify/Dispute | `RetailEngine.gs:1322,1775-1789` | store lead | HMAC link `?action=verify` | Cash counted $, Terminal card total $, Terminal card count (blank≠0), note (req to dispute) | note required when disputing | close-out status, AUDITOR_NOTES | HMAC + SLA (24h/72h) | I (money) | per close-out |
| 21 | Retail Re-open | `RetailEngine.gs:2216-2280` | store lead | `?action=queue` | note (req) | none | status→Pending Verification | re-arms 24h SLA | I | ad hoc |
| 22 | Resolution Log | `ResolutionFormServer.gs:449-793` | staff | `?action=resolution` | Amount(>0,req), Employee(req), Order#(req), Reason(req), Submitted by(req) + inventory block (Brand/Product, support-mgr approval, weight, qty≥1, METRC tag req) | inventory block conditional on type | Expected Adjustments/Waste Log (`app3JjiGtCwWFpula`) | numeric >0, required set | I (money) | ad hoc |
| 23 | Doc Note Upload (new, this pass) | `delivery-ops/DocNoteUpload.html:147` | [INFERRED] driver, dispute-note context | link (not further traced this pass — see Q4) | one file input, `accept=".pdf,.jpg,.jpeg,.png"` | none | [INFERRED, not traced] | client `accept=` only, no server check read | R (attachment) | ad hoc |

Note: `delivery-ops/CloserAudits.js` and `EOSMatchHook.js` **consume** Closer Report fields for
cross-base reconciliation — they define no form of their own; confirmed by grep, no `doPost`/form
markup in either file (`delivery-ops/EOSMatchHook.js:1-300` scanned).

**Count**: 23 distinct forms/portal pages re-derived above (7 HR-dashboard dialog-forms + 4
onboarding self-service forms + 3 writeup-pipeline forms + 9 LP/EOS forms + 1 newly-found
delivery-ops upload). The HR/LP inventory docs (2026-09-10) did not total a single number, so
this is a fresh count, not a re-quote.

## B. Form-generator fit

Backend field-type vocabulary (`wm-demo/wmdemo/forms.py:113-115` `FIELD_TYPES`): text, textarea,
number, money, date, time, datetime, select, multiselect, boolean, person, store, photo,
signature, checklist, repeating_group, computed.

Renderer (`POS-Admin/shared/hd-form.jsx:52-87`) additionally **cases** `checkbox`, `pin_required`,
`pin_stepup`, `section` — none of which exist in `forms.py`'s `FIELD_TYPES` or in
`_field_schema()`'s branches (`forms.py:269-318`). **Contradiction, not a stale doc**: this is
code vs. code. A FormDef using `type:"section"` or `type:"pin_stepup"` renders client-side
(`hd-form.jsx:76,132`) but `_field_schema` falls through to its `else: s["type"]="string"`
default (`forms.py:317`) server-side — silently wrong compiled schema, not a rejection. VERDICT
on this alone: WARN — don't ship a FormDef using either type until the backend gets a matching
branch.

**MISSING types / features** (each listed once, forms that need it):
1. **`address`** (composite street/city/state/zip) — Employee edit (#1), onboarding journey (#7).
   No composite type exists; workaround is N separate `text` fields, loses single-field validation.
2. **Restricted/PII field with masked display + reveal-audit** — SSN backfill (#9), Employee edit
   SSN/DL fields (#1), document re-upload (#10). Nothing in `FIELD_SCHEMA`
   (`forms.py:132-153`) expresses "masked unless re-authed, log every reveal" — the closest
   existing precedent is `onboarding/Server.js:7608` `revealSsn`'s PIN-token-gated read, which the
   generator has no equivalent for.
3. **Multi-file / N-attachment-per-field as first class** — Incident report (#11, up to 20
   attachments). Workaround exists (`repeating_group` of `photo` fields) but is unproven; also
   `ATTACHMENT_CONTENT_TYPES` (`forms.py:619`) is image+PDF only, matches these forms' needs.
4. **Subset-sum / float-adequacy validated field** — Retail Closer Report (#15). Server-enforced
   in GAS (`RetailFloatPlan.gs`, `FormServer.gs:2420-2440`); no custom-validator hook exists in
   `contracts.py`'s keyword subset the compiler reuses (`forms.py:11-18`).
5. **`pin_stepup` as a real shared component** — Discrepancy example already ships a
   `boolean`+`showWhen` stand-in (`forms_seed.py:12-16,76`); still not real for #4/#5/#18 above,
   which need actual re-auth, not just a visible checkbox.
6. **Anonymous/magic-link auth as a form-level mode** — 9 of 23 forms (#7,8,9,10,12,13,16,20,21)
   are reached by anonymous or HMAC-token link, never an authenticated `actor`. `forms.py`'s
   `permissions.fillRoles`/`_actor_role()` (`forms.py:166-172,240-248`) assumes a resolvable
   associate; `forms_api.py`'s gate is a single global write-token (`forms_api.py:8-11`), not a
   per-record signed link with its own expiry. This is the single largest generator gap by form
   count.
7. **Submit-time side effects never fire** — `SUBMIT_KINDS` = event/table/webhook
   (`forms.py:120`) is validated into every FormDef, but `forms.submit()` (`forms.py:508-539`)
   only ever inserts a `form_submissions` row; `forms_api.py:275` calls `forms.submit` with no
   dispatch step. **No Discord/Connecteam/email/Airtable write-back exists today** for any
   generator-hosted form — every GAS form in this catalogue has at least one such side effect
   (Airtable write at minimum; several also fire Discord/email). This blocks every LP/writeup form
   from being a true 1:1 port, not just a UI port.

   **PARTIALLY RESOLVED, 2026-09-17 (session task) — the Discord/email half was fixed first**
   (`wmdemo/forms.py`'s FIX 1: `_dispatch_explicit_entry`, per-kind explicit payload shapes
   through `outbound/discord.py`/`outbound/email.py`/`outbound/connecteam.py`, verified over real
   HTTP by `qa/forms_batch2_hr_probe.py`'s `FB2-http-discord-*`/`FB2-gap-*` checks) **and the
   Airtable half is now wired for 10 of the 12 forms whose `submit` declares
   `target:"airtable"`** across the three Batch 2/3 modules, via a per-form `dispatch_<slug>`
   function each calls `wmdemo/hr/airtable_write.py` directly (`forms.py`'s own generic
   `kind:"table"` dispatch is unchanged and still only ever records `pending_airtable` — see
   `docs/AIRTABLE-ADAPTER.md`'s "First real caller" section for the exact pattern and the field
   maps, cited line-by-line to this same GAS source):
   - **Wired**: hr_incident_report, hr_calloff (`forms_batch2_hr.py`); lp_retail_verify_dispute,
     lp_closer_report_delivery, lp_closer_report_retail (`forms_batch2_lp.py`);
     onb_journey_step_1/2/3, hr_ssn_backfill, onb_ack_sign (`forms_batch3_onboarding.py`).
   - **Still `pending_airtable`, genuinely blocked** (not merely undone): ops_doc_note_upload,
     hr_doc_reupload — both forms' only real content is a `files`-typed attachment, and this
     module has no fetchable-URL/attachment-upload path to Airtable's `attach()` shape yet (GAP,
     unchanged from finding B.3's own multi-attachment note).
   - `pii`-typed fields (ssn/dlNumber/passportNumber) are never sent to Airtable by any wired
     form — `hr_ssn_backfill` sends only the derived last-4 digits — a deliberate divergence from
     live GAS (which writes SSN_PLAIN by 2026-08-09 owner decision) documented in
     `forms_batch3_onboarding.py`'s own SECURITY NOTE and its "Airtable write-back" section.
   - Probed by `FB2-AT-*` (`forms_batch2_hr_probe.py`, `forms_batch2_lp_probe.py`) and `FB3-AT-*`
     (`forms_batch3_probe.py`) against a real `qa/hr_airtable_stub.py` subprocess per suite.
8. **`showWhen` not evaluated inside `repeating_group` rows** — `_field_schema`'s
   `repeating_group` branch calls `compile_schema({"fields": f.get("fields") or []})` with no
   `data`/`actor_role` args (`forms.py:311`), so nested-row conditional-required (Closer Report
   #14's cancelled-item-note-required-when-unverified pattern, if modeled as a repeating group) is
   silently ignored — the row field's static `required` always applies regardless of showWhen.
   Confirmed by reading `compile_schema`'s signature (`forms.py:321-344`): `data=None` default.

**Fit grades**:
- **A** (port now, Haiku): #2 assign-manager, #6 employee notes, #17 LP Disposition, #18 Manager
  Decision, #19 Re-audit, #21 Retail Re-open, #16 Driver response, #22 Resolution Log — all plain
  text/select/money/boolean, authenticated actor, no missing type.
- **B** (needs one generator feature, Sonnet): #1 Employee edit & #3 upload-doc (need PII-masked
  field, gap 2), #11 Incident report & #23 Doc Note Upload (need multi-attachment, gap 3), #12
  Call-off (needs magic-link mode, gap 6, fields otherwise fine), #14 Closer Report-delivery and
  #15 -retail (need subset-sum validator, gap 4, plus side-effect dispatch, gap 7), #20 Retail
  Verify/Dispute (magic-link + SLA clock, gaps 6+ new feature not enumerated — SLA timer).
- **C** (new module): #4 escalate-to-write-up & #5 approve-and-send (need side-effect dispatch to
  a second live GAS pipeline, gap 7, plus the ladder-cap business logic per
  `HR-DASHBOARD-INVENTORY.md` §4, out of generator scope entirely), #7 onboarding journey, #8
  signature capture, #9 SSN backfill, #10 doc re-upload, #13 ack/sign (all need magic-link auth,
  gap 6, several also need PII masking, gap 2, and #10 needs a vision-OCR accept hook this
  generator has no equivalent of at all).

## C. Port plan

**Batch 1 (A-grade, Haiku, no generator changes)**: #2, #6, #16, #17, #18, #19, #21, #22.
Seed definitions to add to `forms_seed.py` (pattern: `WRITEUP`/`CLOSEOUT` already there). Probe:
extend an existing wmdemo test (pattern: whatever asserts `seed_examples()` round-trips) to submit
+ validate each new slug. No generator feature required first — these can start today.
Agent-run estimate: ~0.5-1h each (8 forms) = 4-6h Haiku.

**Batch 2 (B-grade, Sonnet, one feature each)**: build order — (a) multi-attachment first
(`repeating_group` of `photo`, gap 3) unblocks #11, #23; (b) magic-link auth mode (gap 6) unblocks
#12, #20 and is the prerequisite for all of Batch 3; (c) PII-masked field type (gap 2) unblocks
#1, #3. Subset-sum validator (gap 4) and side-effect dispatch (gap 7) are the two hardest — do
dispatch (7) before attempting #14/#15 at all, since a Closer Report with no Airtable/Discord
write-back is not a usable port regardless of field-type coverage. Estimate: multi-attachment
~6-8h, magic-link mode ~10-14h, PII field ~4-6h, dispatch ~10-16h (event/table already
half-designed, webhook needs a retry/backoff story per this repo's own writeup-pipeline pattern),
subset-sum ~4-6h. Then #1,3,11,12,20,23 ~2-4h each Sonnet; #14/#15 ~8-12h each (highest field-type
density in the whole catalogue, matches `LP-DASHBOARD-INVENTORY.md`'s own call-out).

**Batch 3 (C-grade, new module, after Batch 2's magic-link + dispatch land)**: #7, #8, #9, #10,
#13 (new-hire/self-service cluster — build together, they share the token/expiry plumbing), then
#4/#5 (write-up escalate/approve — depends on dispatch to the *second* live pipeline, highest
blast radius per `HR-DASHBOARD-INVENTORY.md` §5 "do last with the most testing"). No hour estimate
given — proposal itself scopes builder/Phase-3 work separately (`FORM-GENERATOR-PROPOSAL.md` §7)
and this cluster is bigger than a per-form estimate.

## D. Questions for JT

1. Side-effect dispatch (finding B.7) is a hard blocker for every LP/writeup form and most of HR's
   dialog-forms — build it as part of this migration, or is it already planned elsewhere
   (`FORM-GENERATOR-PROPOSAL.md` doesn't mention it)?
2. Magic-link/anonymous auth (finding B.6) covers 9 of 23 forms — same question as HR inventory
   Q1/Q4 territory: does POS-Admin's own auth get an equivalent token-link mode, or does this stay
   a GAS-only pattern indefinitely?
3. PII-masked field (finding B.2): keep the current plaintext-with-PIN-gate-and-audit-log design
   (per `HR-DASHBOARD-INVENTORY.md` Q4), or does the generator need real encryption-at-rest before
   any SSN-bearing form is ported?
4. `delivery-ops/DocNoteUpload.html` (#23) — new find, not in the 2026-09-10 LP inventory. Who
   reaches this link and what does the server side do with the upload? Not traced this pass.
5. Subset-sum float-adequacy validator (finding B.4) — worth generalizing as a reusable generator
   feature, or is Closer Report-retail special-cased outside the generator (per
   `LP-DASHBOARD-INVENTORY.md` Q6, still open)?
6. Batch order assumes A-grade-first regardless of usage volume — Closer Report (#14/#15, daily,
   highest volume) lands in Batch 2 under this plan. Confirm, or reprioritize Batch 2's build
   order to hit Closer Report sooner even though it needs 2 new features?
