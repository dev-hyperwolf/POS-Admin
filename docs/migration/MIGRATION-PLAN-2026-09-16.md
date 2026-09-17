# LP + HR Dashboard Migration Plan — 2026-09-16

Team 3a (migration planner). Paper plan only — no Airtable calls made or required to build this;
all facts below come from `LP-DASHBOARD-INVENTORY.md`, `HR-DASHBOARD-INVENTORY.md`,
`LP-AIRTABLE-SCHEMA.md`, `GAS-ESTATE-INVENTORY.md`, `FORM-GENERATOR-PROPOSAL.md`, the wm-demo
`forms.py`/`forms_api.py`/`forms_seed.py` docstrings, `shared/hd-form.jsx:20-40`, and a direct
read of `writeup-pipeline/ConfigReader.js` + `SignaturePortal.js`. Phases M0–M5 are as defined in
`BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md` §4.1; this document does not redefine them, only fills
them in with screens, reads/writes, roles, PII, and the GAS→Render/wm-demo re-homing.

Companion doc: `OWNER-DECISIONS-NEEDED.md` — read that first if you are JT; it collapses the
16 inventory questions into 12 and tells you which of them actually block a phase start.

**Owner decisions already assumed (do not re-litigate here):** D1 Airtable stays system of
record through M2, our admin is a server-side read adapter over it (API key from env,
server-only); roles are server-side scopes `admin/manager/hr/lp`; PIN second factor for SSN
reveal and approve; write-up ladder (attendance/accuracy separate, 90-day window, dismissed never
count, one ledger, AI capped at Second Warning, step-ups via approve-and-send stamp).

---

## 0. The one fact that shapes every phase below

`shared/hd-form.jsx:26-33` documents its own `evalShowWhen`: any `showWhen` condition shape the
v1 renderer doesn't recognize — including the FORM-GENERATOR-PROPOSAL's own abridged
`{"role_gte":"manager"}` examples — is **treated as always-visible**, i.e. it fails open on
*visibility*. The comment is explicit that this is deliberate for the client (validation still
runs server-side), but it means: **no screen in this migration may rely on a client-side
`showWhen`/role condition to hide a sensitive field or control.** Every restriction in the tables
below is a server-side filter (the adapter strips the field/route before it reaches the client),
never a client condition. This is restated in §2.

---

## 1. Scope per phase

Legend for PII class (per this task's rule): **restricted** = SSN/DL/passport/home address/cash
figures; **internal** = contact info (email/phone/emergency contact); **normal** = everything
else (names, statuses, dates, non-monetary counts).

### M0 — Foundations (this program)

No screens ship. Deliverables: this doc + `OWNER-DECISIONS-NEEDED.md`; contracts for `Employee`,
`Incident`, `WriteUp`, `CallOff`, `CloserReport`, `LossLedgerEntry` (entity-scoped); `authz.py`
scopes `admin/manager/hr/lp` + PIN step-up primitive; the Airtable read adapter
(`wmdemo/hr/airtable_read.py`, server-side key, never client) with a stub server and probe in
`qa/` so nothing here ever touches the live base. No reads or writes to the live base happen in
M0 — the adapter is proven against the stub only.

### M1 — HR read-only screens (after D1; blocked on OWNER-DECISIONS #1 and #3)

| Screen | Source GAS screen (file:line) | Reads (base/table/fields, via adapter) | Writes | Role/scope | Sensitive controls |
|---|---|---|---|---|---|
| Overview | `onboarding/Index.html:621-629,833-841` nav → `#screen-overview`; server `_overviewForScope_` (per HR-DASHBOARD-INVENTORY §5) | `app8mI9K1lS1D3Uhk/tblDtY9WsQGQOgHgw` Employees (aggregate counts only — no per-employee PII fields), risk/rank summaries from `RiskScoring.js:94`/`Server.js:5494` (ported logic, computed server-side in wm-demo, not read from Airtable) | none | `hr`, `admin` read | none — aggregate only, no restricted/internal fields in payload |
| People | `Index.html:621-629` nav → `#screen-people`, `renderRecList` (`Index.html:2346`) | Employees: identity, employment, doc-status **summary** (expiry flags, not raw doc text), manager/reports-to. Excludes SSN/DL/passport/home-address fields entirely from the list/detail response. | none | `hr`, `admin` read; `manager` read scoped to own reports (via `assignManager` reports-to graph, `Server.js:5384`) | Contact fields (email/phone) = internal, redacted in list view (detail only); restricted fields never returned by this route at all, not even to admin — SSN reveal is its own gated action, not part of this screen's payload (see M4) |
| Compliance | `#screen-compliance` shared renderer (`Index.html:1858`) | `tblRTJHawNT8jzJML` Compliance Log (read), `timesheet-audit` violation summaries (read via adapter, no write) | none | `hr`, `admin`, `manager` (scoped) | normal — behavioral record dates/types, no PII beyond employee name/id already visible in People |
| Policies | `#screen-generic` w/ `renderFlatList` (`Index.html:1858`) | `tblcTvJ2GLSsKWzmt` Table A (Policies & Documents), `tblzjGHylQ5xCC2BX` Table B (Required Doc Set), `tblqVBc1RqHbB4q4c` Table C (Renewal Checkpoints) — **read through the fixed doc-expiry logic** (§5 bug fix below), not Table A's raw (stale) status field | none | `hr`, `admin` | Document *type/expiry-status* = normal; the document *attachment itself* = restricted, never fetched by this screen (link-out only, gated separately) |

No write routes exist anywhere in M1 — every route above is `GET` only, enforced by
`ROUTE_POLICY` (`auth: session|key, scope: hr:read`, no `hr:write` scope exists yet).

### M2 — LP Triage + Decision slice (next program; fixes LossLedger stale-driver bug)

| Screen | Source (file:line) | Reads | Writes | Role/scope | Sensitive controls |
|---|---|---|---|---|---|
| Triage (Tab 1: KPIs, filter, table, drawer) | `LpDashboard.html:134-170`, `Dashboard.gs:39-54` | `appouBkOofOK3zjN8/tblRDz09UwZdkDnoZ` Closer Reports (cash/discrepancy/case fields — **restricted**: cash $ amounts; driver identity — internal), `tbl8mI9K1lS1D3Uhk/tblGkzrBFpSo2EqzP` Incidents (join) | LP Disposition (`Dashboard.gs:689-757`) via `/lp/incidents/{id}/decision` | `lp`, `admin` write; `lp`,`hr`,`admin` read | Cash figures = restricted → masked/rounded in list, exact cents only in detail drawer for `lp`/`admin`; disposition write requires idempotency key + row lock (fixes `Dashboard.gs:829-831` re-fire bug, see §5) |
| Manager Decision block | same screen, `ManagerDecision.gs:347-404` | same Closer Reports row | `RESOLUTION_STATUS`, `MANAGER_DECISION`, escalation flag, via `/lp/incidents/{id}/decision` (same endpoint, decision kind discriminates LP vs manager) | `manager`, `admin` write (discipline decisions are a manager action, distinct actor from `lp` adjudication per LP-AIRTABLE-SCHEMA "Rules the fields encode") | Approve-Write-Up branch emits a `ContractEvent`, does not touch Airtable's write-up escalation checkbox directly — see GAS plumbing table §3 |
| By Day (Tab 2) | `LpDashboard.html:177-189`, `Dashboard.gs:775-813` | same Closer Reports table, filtered by date not status | Re-audit status/notes via `/lp/reports/{id}/reaudit` | `lp`, `admin` write; `lp`,`hr` read | unifies the two incompatible note-author formats noted in LP inventory §4 — fixed here, not carried |
| Store Close-Outs (Tab 3, HWR) | `LpDashboard.html:200-204`, `RetailEngine.gs` verify/dispute/reopen | Closer Reports (retail mode), store/register, SLA clocks | Verify/Dispute/Re-open via `/lp/closeouts/{id}/verify` etc. | `lp` (verify/dispute), store-lead scope (new — see OWNER-DECISIONS #5 on roster), `admin` | carries the 2026-09-07 UX-audit fixes (urgency ordering, keyboard access) into the rebuild rather than patching GAS first — OWNER-DECISIONS #10 |
| Driver response portal | `ResponsePortal.gs` | single Closer Report row by HMAC token | `DRIVER_RESPONSE` field via token-gated route | none (anonymous, token = auth) | token single-use, expiring — see GAS plumbing table |

LossLedger mirror is **retired** in M2, replaced by a live wm-demo query (§5) — this removes the
30-minute-stale write path entirely rather than porting it.

### M3 — Write forms on the form generator

| Form | Source (file:line) | Reads | Writes (table + route) | Role/scope | PII |
|---|---|---|---|---|---|
| Incident report | `writeup-pipeline/IncidentPortal.js:227` | employee/submitter lookup (Employees, id+name only) | `tblGkzrBFpSo2EqzP` Incidents via `POST /api/forms/incident/submit` → `contracts.py` re-validates server-side (severity required server-side, per `IncidentPortal.js:248-253` — this rule must survive the port literally) | any authenticated staff (`fillRoles`), `hr`/`manager`/`admin` review | attachments (up to 20) = restricted, stored via wm-demo attachment path, never inlined in list responses |
| Call-off | `writeup-pipeline/CalloffPortal.js:350` | employee dropdown (id+name only, no auth on this form today — kept open per inventory, but submit is server-validated against the picked id) | `tbl9FPOZp6Y0dmUPl` Call Offs via `POST /api/forms/calloff/submit`; optional doctor's note upload → object storage, not Drive (§3) | open submit (no session required — matches current GAS behavior), `hr`/`manager` review | doctor's note attachment = restricted |
| Closer Report (delivery+retail) | `end-of-shift-portal/Form.html` | store/register list, driver/closer roster | `tblRDz09UwZdkDnoZ` Closer Reports via `POST /api/forms/closeout/submit` (cents, never floats; denominations as `repeating_group` per `forms_seed.py` `CLOSEOUT`) | store staff (`fillRoles`), `lp` review | cash figures = restricted from submit through storage; the "blank ≠ zero" rule for expected-cash fields (LP-AIRTABLE-SCHEMA §3) must be encoded as `nullable`, not a default of 0 |

### M4 — Write-up draft + ladder + approve + SSN reveal (highest blast radius, most testing)

| Screen/action | Source | Reads | Writes | Role/scope | PII / step-up |
|---|---|---|---|---|---|
| Write-up draft (AI) | `writeup-pipeline/Aiwriteupdrafter.js:670-736,891-901` (port verbatim) | Incidents, Call-Offs, prior write-ups (for ladder calc) | draft `WriteUp` record, `status=draft` | `manager`,`admin` trigger; AI service itself is not a role, runs server-side | ladder-cap re-validation is server-side post-generation, not just prompt-side — carried over exactly |
| Approve & send | `onboarding/Server.js:4631` `approveAndSendWriteUp` | draft WriteUp, delivery state | stamps `approvedBy`, flips to `sent`, fires signed outbound event (replaces `SEND_WRITEUP` HTTP call — §3) | `manager`,`admin` write, **PIN step-up required** (this is the step-up mechanic the ladder decision names) | delivery-keyed idempotency (2026-09-08 fix) carried over |
| Ack / Sign | `writeup-pipeline/SignaturePortal.js` (`SP Documents` `tblHkOhNjMnTIWRPy`, `SP Document Versions` `tbl04ryJbMMpnkT5d`, `SP Signature Requests` `tblhsaAJ5FFevfEFF`, `SP Signatures` `tbliBEzgE4y95RKUE`) | document version by request token | signature capture record | none (anonymous, HMAC token) | signature image = restricted; document version is immutable once signed (versioning pattern already in `forms.py` reused here) |
| SSN reveal | `onboarding/Server.js:7608` `revealSsn` | single field, single employee | none (read-only) but **logs who looked**, never the value | `admin` only, **PIN step-up required every time** (not session-cached) | restricted — the one field this whole program treats as maximum sensitivity; see OWNER-DECISIONS #2 for at-rest question |

### M5 — Background jobs re-homed; unmapped tables read first (done in this pass, §3)

Timesheet engine, LossLedger replacement (already retired at M2, this phase is cleanup of any
remaining GAS-side triggers), daniel-hr. No screens. See §3 for the full trigger re-homing table.

**Out of program scope, not in M0–M5:** Resolution Log (waste/credit-memo/warranty) — different
domain (inventory `Product`/`Batch`/`Movement` contracts), lowest priority per LP inventory §5;
park it for a future inventory-migration program, do not fold into Track 3.

---

## 2. Auth and role model

**Server-side only, no exceptions.** Scopes: `admin`, `manager`, `hr`, `lp` (from
`BUILD-PROGRAM-MASTER-PLAN` §1 `authz.py`). A screen or route declares its required scope(s) in
`ROUTE_POLICY`; the dispatcher refuses to serve an unregistered route in strict mode (same gate
Team 0 builds for Track 1, reused verbatim — one gate for the whole admin, not a second one for
HR/LP).

| Scope | Screens | Sensitive controls it unlocks |
|---|---|---|
| `admin` | all HR + LP screens | SSN reveal (+PIN), approve & send (+PIN), reassign/release (fixes the no-ownership-check gap, `Dashboard.gs:873-906`) |
| `manager` | Compliance, Manager Decision, write-up draft/approve (own reports only, via reports-to graph) | approve & send (+PIN) for own reports |
| `hr` | Overview, People, Compliance, Policies, Incidents/Call-offs (read) | none restricted-tier; internal-tier contact fields in detail view only |
| `lp` | Triage, By Day, Store Close-Outs, LP Disposition | disposition write, cash-figure detail view |

**PIN step-up points** (second factor, re-entered per action, never session-cached): SSN reveal
(every call), Approve & send write-up, LP Disposition on rows above `HIGH_RISK_LOSS_THRESHOLD`
(carries forward the "shoulder-surfing on an already-signed-in device" threat model from
`onboarding/PinGate.js:1-40` — HR-DASHBOARD-INVENTORY §4 flags this rationale as worth preserving
even though the mechanism itself is retired).

**Eliminating client trust:** the live HR dashboard hardcodes `state.isAdmin = true` client-side
(`onboarding/Index.html:451`, cross-referenced from LP inventory §4 too — it's cited from two
directions, so it's real) and never gates anything on it server-side. The rebuild has **no
client-side role state at all** — every screen calls its route, the route's response is already
filtered to what that caller may see, and a client that lies about its own role gets exactly the
same (already-filtered) response as one that doesn't. There is nothing for a compromised client
to escalate *to*.

**Fixing `hd-form`'s fail-open `showWhen`:** per §0, the client renderer's condition evaluator
fails open on any condition shape it doesn't recognize (`shared/hd-form.jsx:26-33`), and the
FormDef vocabulary itself has no server-enforced field-visibility keyword yet — `showWhen` is
documented as a *visibility* hint only, with validation running separately. The fix is **not** in
the renderer: it is that **every FormDef response the server sends is pre-filtered** — a field the
caller's role may not see or fill is never present in the compiled schema or the initial payload
the server hands the client for that role, so there is nothing for the client to fail open
*about*. `role_gte`-style conditions (the ladder-step example in `forms_seed.py` `WRITEUP`) become
server-side: the adapter omits `ladderStep` from the schema entirely for non-manager callers,
rather than sending it and trusting `showWhen` to hide it. This is a form-generator change (owned
by Team 3b/3c, flagged here because M3/M4 forms depend on it), not a client patch.

---

## 3. GAS plumbing re-homing table

| GAS mechanism | Project:file:line | Replacement | Phase |
|---|---|---|---|
| `sendEosDailyDigest` (daily 8am), `checkIncidentAging` (4h) | `end-of-shift-portal/ManagerDigest.gs:1335-1339` | Render scheduled task, same cadence, reads wm-demo directly (no Airtable round-trip needed once M2 ships) | M2 |
| `mirrorLossToDirectory` (30 min, HR-base write) | `end-of-shift-portal/LossLedger.gs:343` | **Retired**, not re-homed — replaced by a live wm-demo query joining Closer Reports + Employees at read time (LP-AIRTABLE-SCHEMA "Rules the fields encode"; fixes the never-clears bug, §5) | M2 |
| `RETAIL_AGING_TRIGGER_FN`/`_DISPUTE_AGING_TRIGGER_FN` (4h) | `RetailEngine.gs:7079,7288` | Render scheduled task; **verify actual install status first** (OWNER-DECISIONS #11) before assuming parity | M2 |
| `RETAIL_DIGEST_TRIGGER_FN`/`_FINDINGS_DIGEST_TRIGGER_FN` | `RetailEngine.gs:7525,7676` | Render scheduled task | M2 |
| HMAC magic link — driver response | `ResponsePortal.gs` | wm-demo signed link minted server-side, expiry + single-use, same shape | M2 |
| HMAC magic link — retail verify | `LeadVerify.html` | wm-demo signed link, expiry + single-use | M2 |
| Escalate-to-write-up (Airtable checkbox → 15-min poller) | `ManagerDecision.gs:347-404` → `writeup-pipeline/AiDraftPoller.js:523` | direct outbound event/API call from the LP decision route — removes the poll entirely (no more 15-minute lag) | M2 |
| `_phase3PipelinePost_`/`handlePhase3PipelinePost_` signed HTTP (HR↔writeup-pipeline) | `onboarding/Server.js` ↔ `writeup-pipeline/Webapp.js:355-413` | direct in-process call within wm-demo (both live in the same backend once migrated — no more cross-script signed HTTP) | M4 |
| `AiDraftPoller.js` (15 min) | `writeup-pipeline/AiDraftPoller.js:568` | replaced by the direct call above; poller itself retired | M4 |
| Doctor's-note / incident-attachment Drive upload | `CalloffPortal.js` `uploadDoctorsNoteToDrive_`, `IncidentPortal.js` `uploadIncidentAttachment_` | wm-demo `forms.py` attachment storage (disk, referenced by path — same pattern IDV already uses) | M3 |
| Signature/document Drive + tokenized template Google Docs | `WriteUpPdfGenerator.js`, `onboarding/TemplateTokenizer.js`, `SignaturePortal.js` (4 SP tables) | object storage for the rendered document + wm-demo `forms.py` versioning (already builds this: "a later edit to the definition never rewrites history") instead of Drive tokenization | M4 |
| Discord webhook alerting | multiple projects | outbound adapter (single shared module, not per-project) — consolidates the estate's "no centralized library" gap noted in GAS-ESTATE-INVENTORY §(A) | M2/M4 as each screen ships |
| ConnecTeam Chat messaging (compliance engine) | `timesheet-audit/*` | outbound adapter, same target API | M5 |
| ClickUp webhook + task creation | `daniel-hr/Webhook.js:23,27` | Render scheduled task (renewal tracker/overdue checker/digest) + ClickUp webhook route on wm-demo | M5 |
| Timesheet audit triggers (6am/Mon7am/8am/10am, + inventory-team variant) | `timesheet-audit/TimesheetAudit.js:4324-4381,5076-5098` | Render scheduled task, same cadences, fixes the attendance false-positive gaps in the rewrite (not ported as-is, per HR inventory §5) | M5 |
| Break dispute portal (`doGet`/`doPost`) | `timesheet-audit/BreakDisputeLoop.js:1611,1625` | wm-demo signed link route | M5 |
| Doc-expiry sweep / offboarding sweeps (7am/6am/4h) | `onboarding/DocExpirySweep.js:722`, `OffboardingReadiness.js:1092`, `OffboardingBounceSweep.js:592`, `OffboardingDrift.js:1791` | Render scheduled tasks, same cadences | M5 |
| Cache-warm (every 10 min) | `onboarding/Server.js:2379` | not needed — wm-demo reads are fast enough directly; drop rather than re-home | M1 |

---

## 4. Data flow diagrams (text)

**M1 read screen — HR People list:**
```
Browser (POS-Admin People screen)
  → GET /api/hr/employees?scope=<caller's entity/store scope>   [session token, scope=hr:read]
  → wmdemo route: authz.gate(scope="hr:read") 
      → 401 if no/invalid token, 403 if wrong scope
  → wmdemo/hr/airtable_read.py: fetch Employees from Airtable (server-side API key from env)
      → in qa/, this hits qa/hr_airtable_stub.py instead of the live base
  → field-level filter: strip SSN/DL/passport/home-address (restricted) entirely;
    contact fields (internal) included only if caller scope == hr|admin, else stripped too
  → response: {employees: [{id, name, status, doc_flags, ...}]}   — no restricted PII, ever,
    at this route, for any role
  ← Browser renders list; detail drawer makes a second scoped request per employee, same filter
```

**M3 write form — Closer Report (closeout) submit:**
```
Browser (HDForm, def=FORMS.closeout, mode=fill)
  → client-side validate via HWContracts.validate() (same keyword set as server — advisory only)
  → POST /api/forms/closeout/submit  {data, station_id, actor}   [session token]
  → wmdemo/forms_api.py: _write_gated (write token required, no loopback exemption)
  → wmdemo/forms.py submit(): re-validate against contracts.py's subset — SERVER is the real gate,
    browser pass is never trusted (forms.py docstring, explicit)
  → over-posting check: additionalProperties:false on the compiled schema → 400 on unknown key
  → cash fields stored as integer cents; "expected cash" fields stay null if unset (never 0)
  → row insert: form_submissions (form_id, form_version frozen, data_json, submitted_by, status)
  → LP disposition/escalation is a SEPARATE later action (§1 M2), not part of this submit
  ← 200 {submission} or 400 {error:{code,message,details}} with field-level errors
```

---

## 5. Bugs fixed in the rebuild (not carried forward)

| Bug | Where it lives today | Fixed in |
|---|---|---|
| Table-A doc-expiry false positives (13 of 18) | `onboarding/Server.js:1584-1591`; Table A never repatched by renewals | M1 Policies screen — read renewals directly, not the stale Table A status field (OWNER-DECISIONS #3 picks GAS-side vs. rebuild-side fix location) |
| LossLedger stale driver (mirror never clears a driver who drops off the rollup) | `end-of-shift-portal/LossLedger.gs:63-64,166` | M2 — mirror retired outright, replaced by a live query (§3) |
| `state.isAdmin` client hardcode | `onboarding/Index.html:451` | Eliminated by construction — see §2, no client role state exists at all |
| LP decision re-fire (`submitLpDecision`/`submitLpDisposition` no lock) | `Dashboard.gs:829-831` | M2 — decision route takes an idempotency key + row lock |
| Reassign/Release no ownership check | `Dashboard.gs:873-906` | M2 — `admin`-only, ownership validated server-side |
| "Other…" reassign accepts any syntactically valid email | `Dashboard.gs:853` | M2 — reassign target must resolve to a known employee record, not free text |
| hd-form `showWhen` fail-open (role conditions) | `shared/hd-form.jsx:26-33` | §2 — server pre-filters the schema per role; nothing to fail open about |
| Retail duplicate close-out has no hard server block | `LP-DUPLICATE-BLOCK-2026-08-19.md` "SCOPE" | M2, if OWNER-DECISIONS #4 picks "build now"; otherwise explicitly carried with a tracked gap, not silently dropped |
| Two incompatible note-author formats in `AUDITOR_NOTES` | LP inventory §4 | M2 By Day — unified format |

---

## 6. Test strategy

**Stub Airtable server** (`qa/hr_airtable_stub.py`, `qa/lp_airtable_stub.py`): fixtures built from
`LP-AIRTABLE-SCHEMA.md` field groups + the HR table list in `HR-DASHBOARD-INVENTORY.md` §3 — real
field names/types, synthetic data, no PII. Every probe in every phase runs against this stub or a
scratch DB; **the live base is never called by any automated test**, per the hard rule for this
program.

**Probe names per phase** (extends Team 0's `qa/security_gate_probe.py` pattern):
- M0: `qa/hr_airtable_read_probe.py` — adapter reads only from stub, never live; key never in a
  client-visible response.
- M1: `qa/hr_read_probe.py` — per screen: 401 no token, 403 wrong scope, restricted PII absent
  from every response body (grep the JSON for known restricted field names), foreign entity id →
  404.
- M2: `qa/lp_decision_probe.py` — idempotency (double-submit same decision → one write),
  ownership check on reassign, cash figures masked in list/exact in detail for `lp`/`admin` only.
- M3: `qa/forms_submit_probe.py` — over-posting → 400, severity-required-server-side still holds
  even if client omits it, CSV export cells never start with `= + - @` (reuse `forms._csv_safe`).
- M4: `qa/writeup_approve_probe.py` — PIN step-up enforced (no cached bypass), ladder cap
  re-validated server-side even if a crafted request claims a higher level, SSN reveal logs the
  looker and never returns the value in any non-reveal route.
- M5: `qa/scheduled_job_probe.py` — job idempotent on double-fire, checkpoint/resume for anything
  near the 30-minute Workspace cap (per CLAUDE.md §4.2 — confirm the real cap from a timeout in
  this program's own logs before assuming 30, not 6).

**Security-gate checks each phase must pass** (from the master plan §1, applied per phase): writes
401 without token; wrong scope 403; foreign entity id 404 (never 403, to avoid confirming
existence); over-posting 400; no restricted PII in list responses; CSV cells guarded. Every new
route registers into `ROUTE_POLICY` and the refuter swarm runs its 7-point brief (master plan §1)
against it before the phase is handed to JT.

---

## 7. Estimates and risks

| Phase | Elite-dev hrs (source) | Agent-runs (rough, Haiku mechanical / Sonnet design-audit) | Calendar order |
|---|---|---|---|
| M0 | contracts+middleware ~20-30h (HR inventory §5) + adapter/stub | ~8 Sonnet, ~4 Haiku | 1st |
| M1 | read screens 40-60h (HR §5) | ~10 Sonnet (4-concepts Overview per HR-DASHBOARD-INVENTORY roster), ~6 Haiku | 2nd, after D1 |
| M2 | Triage+Decision 40-60h + By Day 15-20h + Store Close-Outs 35-50h (LP §5) | ~14 Sonnet, ~10 Haiku | 3rd |
| M3 | incident/call-off forms 25-35h + Closer Report 30-40h *after* generator (generator itself: 6+14+10+16+8=54h, FORM-GENERATOR-PROPOSAL §7) | ~12 Sonnet, ~8 Haiku | 4th |
| M4 | write-up pipeline 50-70h (HR §5) | ~16 Sonnet (highest scrutiny), refuter mandatory | 5th, most testing |
| M5 | timesheet 40-60h + daniel-hr 8-12h (HR §5) | ~8 Sonnet, ~6 Haiku | 6th |

Total ex-Resolution-Log, ex-generator-build: roughly **215-305h** (HR) + **150-200h** (LP) +
**54h** (form generator, shared cost counted once) ≈ **420-560h** across the whole track.

**Risks / mitigations:**
- *Ladder-cap regression*: the AI drafter's cap-then-recheck (`Aiwriteupdrafter.js:670-736,
  891-901`) is the single piece of logic where a subtle port error has discipline consequences →
  port verbatim, add the server-side re-validation probe (§6 M4) before any real write-up ships.
- *SSN exposure surface*: every new route is a new place SSN *could* leak if the field-filter is
  missed once → the M1 read screen never even requests the SSN field from the adapter (not just
  filters it post-fetch) — smallest possible blast radius.
- *writeup-pipeline's 4 Signature-Portal tables* (`tblHkOhNjMnTIWRPy`, `tbl04ryJbMMpnkT5d`,
  `tblhsaAJ5FFevfEFF`, `tbliBEzgE4y95RKUE`, all confirmed this pass via `SignaturePortal.js:13-24`)
  carry signed-document and signature-image PII and were previously unmapped — now scoped into
  M4, not a surprise mid-build.
- *Trigger-count collapse*: end-of-shift-portal alone has 114 triggers (GAS-ESTATE-INVENTORY);
  collapsing to Render scheduled tasks 1:1 first (§3), then consolidating cadences, avoids
  changing behavior and scheduling risk in the same step.
- *Airtable stays system of record through M2*: every phase's read adapter must tolerate the
  live base's existing data quality (e.g., Table A staleness) without new code assuming the fix
  already happened upstream — this is why §5's fixes are read-time, not write-time, until a later
  program revisits write-back.
