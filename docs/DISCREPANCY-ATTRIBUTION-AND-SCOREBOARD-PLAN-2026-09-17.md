# Inventory Discrepancy → Attribution → Employee Scoreboard — Plan (2026-09-17)

**Owner's brief, verbatim (2026-09-17):** "we want to flag and measure these incidents where
there are discrepancies with inventory. Who was assigned to fill this inventory, and was it
scanned using the RFID module? Did the driver lose it if it was scanned? Did the driver correct
the correct 'box' that the SKU is assigned to and located within? Then we want to configure these
things into the 'scoreboard' for each employee and figure out what's happening — is this person
under-performing? Do they need to be retrained? Documenting the employee is critical to how we
improve and survive."

**Scope boundary.** A sibling document, `docs/SWAP-RECOVERY-FLOW-PLAN-2026-09-17.md`, plans the
customer-facing recovery when a driver's kit is short at the door. That plan's §2 step 1 already
commits to **emitting one inventory-discrepancy incident** the moment a mis-stock is detected
(`orderId`, `driverId`/kit id, `boxId`, `sku`/`batchId`/unit, door-scan evidence) and its §2 step
14 already scopes a **new `lp/cases.py` case kind** for the resulting investigation. This document
is the other half: what happens to that incident (and every other discrepancy-detection point,
not just the door) — the full custody chain, the attribution logic that turns evidence into a
finding, and the employee scoreboard the owner asked for. Where the two plans touch, this
document defers to the swap plan's field shapes rather than inventing a second one.

---

## 0. Owner summary (read this first)

**What exists today**: nothing that does this. The GAS "scoreboard" project is retired
(Onfleet-only, deleted triggers, `scoreboard-legacy/DEPRECATED.js:1-8`); its live successor
(`scoreboard/`) tracks driver break/mileage compliance only — no inventory metric anywhere in it.
The only real inventory-shrink workflow in production is `distribution-backend`'s `Discrepancy`
model (barcode scan mismatches, `open→pending→pendingApproval→resolved→rejected`) — it records an
amount and an assignee but never asks *why* (no fill-scan check, no box-placement check, no
handover-acceptance check) and stores its dollar amount as a **String**, a known data-quality bug.
RFID kit verification (`rfid/screen-kits.jsx`) is a **UI mockup with no backend** — nothing is
persisted. The new platform (`wm-demo`) has the right-shaped pieces already built for a *different*
kind of discrepancy (cash/register, `wmdemo/lp/cases.py`) and for counting (`wmdemo/inventory.py`
count sessions, `wmdemo/rfid_count.py` RFID-to-count bridge) — but nothing today connects an RFID
read, a box assignment, and a person into a finding.

**The custody chain** (§2) is nine append-only event types from kit build through Sunday
breakdown, each carrying actor/device/method/evidence — most already exist as real code
(`inventory.py` receipts/moves/counts), three do not exist anywhere (box-placement assertion,
handover-acceptance scan, driver custody-loss report) and must be built.

**Attribution** (§4) is a decision table, not a model: no fill scan → builder finding; wrong box →
placement error by whoever placed it; accepted-then-missing → driver custody; never accepted →
upstream; anything ambiguous → `unattributed`, never a guess. Every finding carries its evidence
and a confidence level.

**The scoreboard** (§5) is per-role, denominator-based (errors per 1,000 units, not raw counts),
with minimum sample sizes, confidence bands, and peer comparison — it produces a **coaching
recommendation for a manager**, never an automatic write-up. An attributed incident above
threshold becomes a **draft** accuracy-ladder incident, capped at Second Warning, approved only by
a human — reusing the ladder machinery already built (`wmdemo/writeups/ladder.py`) exactly as
decided.

**Owner questions**: seven, at the end of §8, one at a time.

---

## 1. What exists today (cite file:line)

### 1.1 GAS estate — no inventory scoreboard exists

- **`scoreboard-legacy/`** (the original "Hyperwolf_Scoreboard" project) is formally retired —
  `scoreboard-legacy/DEPRECATED.js:1-27`: triggers deleted 2026-07-18, Onfleet webhook traffic
  ended 2024-07-03, all installer functions stubbed to throw. It never measured inventory; its
  tables were break/mileage/roster sync (`2_ConnecTeam.js`, `5_DriverRosterSync.js`,
  `3_OnfleetFunctions.js`).
- **`scoreboard/`** (the live successor) is break automation + ConnecTeam sync + Onfleet task
  timing — `0_ScoreboardConfig.js:6-38` (feature flags: `AUTO_BREAK_ENABLED`, `CT_*` keys,
  `BREAK_LOG_SHEET`) and `0_ScoreboardOrchestrator.js` (lock-guarded trigger orchestration, added
  2026-07-01 to fix trigger-collision failures). Its one discrepancy concept is **mileage**, not
  inventory: `mileage_pipeline.js:41` `DISCREPANCY_FLAG_THRESHOLD_PCT = 0.15`, computed as
  `(onfleet − gmaps)` road-miles delta (`:916-935`) — a driving-distance check, unrelated to SKUs,
  boxes, or kits. This mileage teardown was explicitly declined by the owner (see memory); it is
  cited here only to establish that "discrepancy" in this codebase has, until now, never meant
  inventory.
- Per `docs/migration/GAS-PORT-LIST-2026-09-17.md:43`, `scoreboard` is "Live ops KPI (Onfleet)," 318
  Onfleet refs, **Wave 3 (PORT LATER)** — confirmed live 2026-09-10 per that doc's own spot-check,
  but its KPI surface has never included inventory accuracy.
- **`writeup-pipeline/Webapp.js:786-801`** (`mapIncidentTypeToViolationCategory`) is the one place
  GAS already tags something "Inventory Discrepancies" as a violation category — three existing
  incident types: `'Did not return proper change (+-$)'`, `'Over / Under charged'`, `'Failure to
  confirm inventory resulting in customer cancellation/dissatisfaction'` (lines 790-792). These are
  **cash-handling and confirmation-failure** errors, not physical shrink/custody-loss — but they
  establish that "inventory discrepancy → write-up" is an existing, already-ported concept (see
  §1.2), just not the physical-custody kind the owner is asking about now.

### 1.2 End-of-shift portal — the LP case machine (real, and the one to reuse)

`end-of-shift-portal/` runs a genuine incident lifecycle for **cash/card** discrepancies —
`IncidentEngine.gs:112,127,491,519,775` (`computeSeverity_`, status set to `'Open'` at creation),
`Dashboard.gs:1012` (severity from `cashDelta`/`ccDollarDelta`), `RiskEngine.gs:25-26,90` (risk
tiers: High = lifetime loss ≥ $50 OR a pattern flag OR ≥4 incidents in 30 days; Medium ≥ 2).
Thresholds: Low ≤ $10 / Med ≤ $50 / High else (`Config.gs:247-248`, confirmed in
`docs/migration/LP-DASHBOARD-INVENTORY.md` §4). The Airtable schema
(`docs/migration/LP-AIRTABLE-SCHEMA.md` §"Closer Reports") already separates **LP Disposition**
(adjudication: Explained / Process Fix / True Loss) from **Manager Decision** (discipline: Approve
Write-Up / Dismiss-Coaching) — the same separation this plan needs between "what happened to the
inventory" and "does this become a write-up." It also already keeps a **Driver History Snapshot**
JSON (incidents 7/30/90 days, total amount 30d, common type) per person — the direct ancestor of
the scoreboard's rolling window in §5.

This machine has already been ported to `wm-demo`: `wmdemo/lp/cases.py:80`
(`STATUSES = ("new", "awaiting_driver", "awaiting_manager", "decided", "corrected", "reopened")`),
with `decide()`, `reopen()`, `correct()`, `void()`, `reassign()`, `record_dispute()`, and a
`loss_ledger()`/`person_open_loss_totals()` rollup (`cases.py:1213-1246`). Cases are typed by a
`kind` (`"retail"` / `"delivery"` today, `cases.py:352-354`) and an optional `case_kind`
(`"variance"` vs `"closeout"`, a `$0`-variance retail row that still needs verification but isn't
an LP incident candidate — `cases.py:462-470`). Every case is deduplicated by a `dedupe_key`
(`_case_exists`, `:333`) and every decision carries an idempotency key (`_closeout_idempotency_*`,
`:810-839`). **This is the machinery §3 reuses for inventory discrepancies — not a new state
machine.**

### 1.3 Legacy distribution backend — a discrepancy model that already tracks the wrong things

`hyper-tech/distribution-backend/models/Discrepancy.js` (read-only, 44 lines) is the one place the
legacy estate models physical inventory shrink directly:

```
distributionId, regionId, subRegionId, driverId, productId, boxId, type, discrepancyAmount,
closureType, isStopScan, isExtra, isNewProduct,
discrepancyBatches: [{batchNo, sku, productBatchId, qty, wholeSaleValue, retailValue,
                       scannedQty, isExtra, scannedStatus}],
status: open|pending|pendingApproval|resolved|rejected,
assignedTo, dueDate, amount, activityLogs: [...], comments: [...]
```

It already carries `driverId`, `boxId`, `assignedTo` and a batch-level breakdown — genuinely close
to what this plan needs — but it answers none of the owner's four questions: no fill-scan field,
no RFID-vs-manual method field, no "assigned box vs. read box" comparison, no handover-acceptance
flag. It also has a known data bug: **`discrepancyAmount` is typed `String`, not `Number`**
(`Discrepancy.js:12`; catalogued in `docs/migration/LEGACY-DATA-MODEL-INVENTORY-2026-09-17.md:266,
380` as "typed String despite being an amount" — do not port this field's type as-is). The
controller behind it (`driver-kit-verification-controller.js`, 224 KB, read-only) exposes
`addDiscrepancy`/`updateDiscrepancy`/`detailDiscrepancy`/`deleteDiscrepancy`/`resetVerification`/
`onHoldVerification` (exports at lines 3241, 3700, 4030, 4116, 4287, 4773) — a real approvals
workflow, but a **person-driven closure workflow**, not an evidence-driven attribution engine; a
supervisor picks the resolution, nothing computes who is actually responsible from the scan trail.

`KitDistributed.js` and `KitRefill.js` (also read-only) confirm the Region → Kit → Box → Batch
shape this plan must fit: `KitDistributed.regionData[].items[].productBatches[]` carries
`assignedQty`/`expectedQty`/`scannedQty`/`scannedStatus` per batch per box per driver, and
`isRefill` flags an overnight-restock line distinctly from an original build line. Neither model
carries a fill-time actor or an RFID/manual method flag.

### 1.4 RFID module — real engine, no backend, and two undesigned verification moments

Per `docs/codebase-audit/distribution/RFID-FOR-DISTRIBUTION.md` (read 2026-09-17): the shipped
direction (`rfid/`) has a real reconciliation engine ported from `rfid-middleware` (argmax-over-RSSI
box assignment, −62 dBm gate, per-box SKU diff — `rfid/data.jsx:1-9,47`, `rfid-middleware/src/
reconciliation/engine.ts:29-51`) and a genuine decision-rights split (handheld **asserts**,
supervisor **approves and posts** — `rfid/data.jsx:517-527`, `ui.jsx:33-116`). But **it is a static
mockup**: `rfid/screen-kits.jsx`'s "Kit posted" toast was rewritten to say "Kit posted — not written
to inventory" (commit `ca8cf3e`, 2026-08-28) because its decision store is `React.useState` that
"resets on reload and is never persisted anywhere." Tag identity is real and batch-aware: EPCs bind
1:1 to a **required, non-nullable** `batchId` at commissioning (`rfid-middleware/src/ports.ts:
18-20`) — exactly the "unit of allocation is the batch" requirement — but the reconciliation
engine's own output (`KitReconResult`/`SkuLine`) is keyed by SKU only, not batch
(`rfid-middleware/src/types.ts:52-58`), so it cannot yet flag a mixed-batch box.

Two gaps matter most for this plan's custody chain (§2):
- **No refill mode.** `#/kits` only diffs the *cumulative* build plan; the overnight restock
  (owner fact: kits are restocked from what a driver sold plus new receipts) has no per-box,
  per-batch *delta* plan to scan against (`RFID-FOR-DISTRIBUTION.md` §4b).
- **No return/handover-verify screen anywhere**, in any direction study. The tag lifecycle already
  names the states this needs (`DISPATCHED → SOLD/RETURNED`, `rfid-middleware/src/lifecycle/
  tagState.ts:19-30`) but nothing calls `transitionTag` from a driver-acceptance or end-of-shift
  scan. The owner's own prior note is on record: "Two new verification moments… pack verify… and
  return verify… Both belong on the timeline." **This is why "did the driver accept it at
  handover" is unanswerable from any system today** (§2 event 4, §4 rule 3).

The existing barcode scan path (`scanItems.service.js:183-188`, cited in the RFID audit) matches a
scan to a batch by `productBatchId` **OR falls back to `sku`** — a real ambiguity bug: a SKU-only
fallback can silently match the *wrong batch*, exactly what RFID's required `batchId` is meant to
close. Any attribution logic built on top of manual/barcode scans must treat SKU-fallback matches
as lower-confidence evidence than an RFID or exact-batch-id match (§4).

### 1.5 wm-demo — the building blocks this plan assembles, not a discrepancy engine

- **`wmdemo/inventory.py`** already has real cycle-count machinery: `open_count`/`submit_count`/
  `approve_count` (lines 1937-2103). `submit_count` computes `variance = counted − expected` per
  (location, sku, batch) and marks each line `recount_required` (|variance| > 2 units **or** > 2%
  of expected — env-tunable `HW_COUNT_RECOUNT_UNITS`/`HW_COUNT_RECOUNT_PCT`) or
  `awaiting_approval` otherwise; `approve_count` refuses while any line still needs a recount and
  is idempotent against double-approval. This is the **count/variance primitive** this plan's
  detection points reuse — it is not itself an attribution or scoreboard engine.
- **`wmdemo/rfid_count.py`** (152 lines) is the real RFID-to-count bridge, and its own docstring
  states the design constraint this plan must respect: *"RFID reads PROPOSE, never write stock...
  attribution on every step — actor is required, and the raw read is kept for audit."*
  `submit_read()` resolves EPCs against `inventory_units`, groups by (sku, batch) into count
  lines, and hands them to `inventory.submit_count()` **unchanged** — same variance ladder a
  keyboard count gets. It separately classifies every scanned tag as `unknown` (not in
  `inventory_units` at all), `foreign` (a real unit, but recorded at a different location), or
  `missing` (expected here, not seen) — **this three-way split is the direct evidence source for
  §4's fill-scan and box-placement rules.** Raw reads are kept in a lazily-created `rfid_reads`
  table for audit only.
- **`wmdemo/lp/cases.py`** — see §1.2. This is the case machine §3 extends.
- **`wmdemo/writeups/ladder.py`** — see §1.1/§5 for the accuracy ladder this feeds.
- **`platform/modules/dispatch/kit-ledger.ts`** — an in-memory, event-sourced, idempotent reducer
  (`reserve`/`consume`/`release`/`restock`, one event kind per intent, `apply()` idempotent by
  `eventId`) tracking what is in each vehicle. It is Phase 1 only (not persisted —
  `kit-ledger.ts:16-19`) and has **no event kind for a handover-acceptance scan or a custody-loss
  report** — both new event kinds this plan needs (§2), following the same pattern the sibling
  swap-recovery plan already scoped new `hold`/`expire` kinds onto the same reducer for a different
  purpose (`SWAP-RECOVERY-FLOW-PLAN-2026-09-17.md` §2 step 2).
- **Contracts** (`POS-Admin/contracts/enums.json`, `schema/Incident.json`): `IncidentType` is a
  closed enum (`additionalProperties: false` on `Incident.json`) with **no physical-custody-loss
  value** — the three inventory-adjacent values that exist (`change_not_returned`,
  `over_under_charged`, `inventory_confirmation_failure`) are cash/confirmation errors, already
  classified `accuracy` in `wmdemo/writeups/ladder.py:117-123`. New enum values are required (§4,
  §7). `Role` enum today is `viewer/associate/manager/admin/superadmin` — an **access** role, not
  a job-function role; there is no `kit_builder`/`restocker`/`driver`/`receiver`/`budtender` job
  taxonomy anywhere in the estate yet (§5 introduces one as scoreboard metadata, not a new access
  role).
- **`authz.py`** scope convention (`OPERATOR_SCOPES`/`_ADMIN_ONLY_SCOPES`, lines 168-281): every
  module follows `{domain}:read` / `{domain}:write` for operator-tier actions and `{domain}:admin`
  / a named decide-scope (`lp:decide`) for manager-tier ones. §6 follows this exactly.

### 1.6 Mobile — a driver-facing card that already promises more than it delivers

`mobile/screen-discrepancy.jsx` (186 lines) already renders an "Inventory" tab
(`window.MD.INV_DISCREPANCY`) showing expected-vs-counted per SKU/box and the orders it may have
affected, with a driver response (`found`/`still missing`/`damaged` + note). Its own comments are
explicit about what it is **not**: *"Nothing in this app transmits: there is no loss-prevention
endpoint on the device... 'Save response' used to fire the toast 'Response saved for loss
prevention' and write NOTHING, anywhere."* The response is now honestly written to
`localStorage` only (`INV_RESP_KEY`) and never reaches any backend. **This is the client half of
event 8 in §2 (driver custody-loss report) with no server half yet** — building that server route
is this plan's job, not a rebuild of this screen.

### 1.7 What ports vs. what is net-new

| Piece | Port (reuse as-is) | Extend | Build from scratch |
|---|---|---|---|
| Case state machine | `wmdemo/lp/cases.py` lifecycle/dedupe/idempotency | add `kind="inventory"`, new fields | — |
| Count/variance math | `wmdemo/inventory.py` count sessions | — | — |
| RFID read classification | `wmdemo/rfid_count.py` unknown/foreign/missing | feed into attribution, not just count | — |
| Write-up ladder | `wmdemo/writeups/ladder.py` (90-day, dismissed, AI cap) | add new `IncidentType` values, map to `accuracy` | — |
| Kit ledger | `platform/modules/dispatch/kit-ledger.ts` reducer | new `handover_accept`/`custody_loss` event kinds | — |
| Scopes | `authz.py` OPERATOR/_ADMIN split | add `discrepancy:*`/`scoreboard:*` | — |
| Box-placement assertion | — | — | new event + table (no prior art) |
| Handover-acceptance scan | — | — | new event + screen (no prior art anywhere, per RFID audit §1.4) |
| Attribution engine | — | — | new (§4) |
| Employee scoreboard | — | — | new (§5) |
| Discrepancy model itself | — | `distribution-backend/Discrepancy.js` shape as a **reference**, not a migration source (fix the String-typed amount, add missing fields) | mostly new persisted shape in `wm-demo` |

---

## 2. The chain of custody — an append-only event model

Every event below is **immutable once written** (the same discipline `wmdemo/metrc/ledger.py`
already uses: corrections insert a new row and mark the old one `superseded_by`, never edit in
place) and carries four required fields on top of its own payload: **actor** (person or system),
**device** (which scanner/terminal/phone, or `null` for a system-computed event), **method**
(`rfid` | `barcode` | `manual` | `none`), and **evidence** (a reference to the raw read/photo/note
that backs it — never just a bare claim).

| # | Event | Who/what | Existing code | Status |
|---|---|---|---|---|
| 1 | **Build assigned** — kit/box/SKU/batch/unit assigned to a builder for a driver | Kit builder assignment, by a manager or auto-scheduler | `KitDistributed.regionData[].items[]` shape (`assignedQty`/`expectedQty` per batch); `wmdemo/inventory.py` has no kit concept yet | **[EXTEND]** — map onto `inventory.py` locations (kit = a location `kind="kit"`, per driver) |
| 2 | **Fill scan** — one unit scanned into a box | Builder, RFID handheld or barcode or (fallback) manual tally | `wmdemo/rfid_count.py:submit_read` (RFID); `scanItems.service.js` (barcode, with the SKU-fallback ambiguity, §1.4) | **[REAL for RFID/barcode as count evidence]**, but neither is wired to a *fill* event distinct from a *cycle count* today — **[BUILD]** the fill-scan wrapper around the same primitives |
| 3 | **Box placement** — which box a unit was actually read in vs. which box the plan assigned it to | System-derived from event 2 | `rfid/data.jsx:reconcileKit` argmax (mockup only, §1.4); no persisted comparison exists | **[BUILD]** — this is new: persist `assigned_box_id` alongside `read_box_id` per unit, both nullable, so a mismatch is a first-class fact, not something recomputed from logs after the fact |
| 4 | **Kit sealed / handover** — builder→driver acceptance scan | Driver, RFID or barcode scan of the sealed kit, or (documented gap) no scan at all | **Does not exist anywhere** — `RFID-FOR-DISTRIBUTION.md` §1.1,§6: "no return/handover-verify screen exists... the owner's own notes already flag this as undesigned." `kit-ledger.ts` has no `handover_accept` event kind | **[BUILD]** — new event kind on `kit-ledger.ts` (`reserve`/`consume`/`release`/`restock` today, add `handover_accept`), new driver-facing accept screen, honest `method:"none"` when a driver takes a kit with no scan at all (must be recorded as a fact, not silently skipped) |
| 5 | **In-shift events** — sale scan at the door, swap, return, damage | Driver, RFID/barcode at the door | `mobile/screen-task.jsx` scan flow (real, §1.4 "REAL"); swap emits the sibling plan's detection-time incident (`SWAP-RECOVERY-FLOW-PLAN §2` step 1) | **[REAL]** for scan-at-door and swap; damage/return scans are the same shape, reuse the swap incident's evidence fields |
| 6 | **End-of-shift reconciliation** — driver's own count/response | Driver, manual (phone) | `mobile/screen-discrepancy.jsx` UI real, backend **absent** (§1.6) | **[BUILD]** — the missing server route; the client already knows what shape to send (`{status, note, at}` per unit) |
| 7 | **Overnight restock** — new receipts + driver's remaining stock reconciled into next-day kit | Restocker, RFID/barcode/manual | `KitRefill.js` (`refillId`, `qty`, `changes: {previousQty, updatedQty, totalQty}`) — real legacy shape, no RFID method field; `wmdemo/inventory.py:record_receipt`/`move` are the real primitives to build this on | **[EXTEND]** — same fill-scan/box-placement events (2,3) apply to a refill, tagged `is_refill:true`, against the refill's own *delta* plan (RFID audit §4b's exact ask) |
| 8 | **Sunday breakdown count** — kit torn down, every remaining unit counted | Restocker/kit builder, RFID/barcode/manual | `wmdemo/inventory.py:open_count`/`submit_count`/`approve_count` (real, generic count session) | **[REAL as a mechanism]** — a breakdown count is just a count session at the kit location; no new backend needed, only the operational convention of running one every Sunday night |
| 9 | **Driver custody-loss report** | Driver, manual note | `mobile/screen-discrepancy.jsx` client-only today (§1.6) | **[BUILD]** — same missing route as event 6; this is the driver's *own* claim, which is evidence, not a finding (§4 never treats a self-report as proof either way) |

**Design rule carried over from `rfid_count.py`'s own docstring**: RFID/barcode reads **propose**,
they never directly adjust stock or close a case. Every event above writes to its own append-only
event log; a `location_stock`/`kit_ledger` adjustment only ever happens through the existing
`inventory.approve_count()` gate (a human, or the box-placement engine's read-only comparison,
never a raw scan). This keeps the custody model consistent with the one already-decided rule for
counts in this codebase.

---

## 3. Discrepancy incidents — reusing the LP case machine, exactly how

**Detection points** (each produces a candidate incident, deduplicated by its own key):

| Detection point | Trigger | Dedupe key |
|---|---|---|
| Door scan fails / mis-stock at delivery | Swap-recovery flow's step-1 emission (sibling plan) | `order:<orderId>` |
| Kit-ledger mismatch | `approve_count()` on a kit location produces a nonzero-variance line with no fill-scan evidence for that unit | `kit:<kit_id>:sku:<sku>:batch:<batch_id>:cycle:<date>` |
| End-of-shift count | Driver's own reconciliation (event 6) reports `missing`/`damaged` | `shift:<driver_id>:<date>:sku:<sku>` |
| Breakdown count | Sunday `approve_count()` on the kit location | `breakdown:<kit_id>:<week>:sku:<sku>:batch:<batch_id>` |
| Metrc recon variance | `wmdemo/metrc/recon.py` (existing Metrc exception queue, `wmdemo/metrc/exceptions.py`) flags a quantity mismatch traceable to a specific kit/box | `metrc:<licence>:<business_day>:<package_tag>` |
| Customer report | Support opens a case manually from an order (sibling plan §2 step 1, "customer report" source) | `order:<orderId>` (same key as door-scan — same underlying event, different discovery path, must collapse to one case) |

**The record.** A new `case_kind="inventory"` (sibling to today's `"variance"`/`"closeout"`) on
`wmdemo/lp/cases.py`'s existing `lp_cases` table, using the same `_insert_case`/`decide`/
`_dedup_conflict`/`reassign`/`loss_ledger` functions. New columns needed on top of the existing
`kind`, `store_id`, `person_ref`, `day`, `discrepancy_cents`: `sku`, `batch_id`, `unit_id`
(nullable — a batch-level shrink may not resolve to one physical unit), `kit_id`, `assigned_box_id`,
`read_box_id`, `evidence_ref` (points at the custody event(s) in §2 that justify the case), and
`attribution` (the §4 output: `{finding, confidence, actor_person_ref}` — nullable until
attribution runs). **This does not become a second incident system**: it is the same table, the
same status enum, the same decision/reopen/void functions — only a new `case_kind` value and a
handful of inventory-specific columns, exactly as the sibling swap-recovery plan already scoped
it (`SWAP-RECOVERY-FLOW-PLAN-2026-09-17.md` §2 step 14).

**Severity.** Reuse the existing three-tier shape (`computeSeverity_` precedent, §1.2) but on
**unit count and cost**, not cash delta: Low = ≤2 units **and** ≤$25 cost; Medium = ≤10 units
**or** ≤$100 cost; High = anything above, **or** a compliance-impact flag (a Metrc-tagged package
short — always High regardless of dollar value, since a regulatory discrepancy is not just a money
problem). These numbers are a starting proposal, not a final decision — see Owner Question 1.

**State machine — reused verbatim**: `new → awaiting_driver → awaiting_manager → decided →
corrected | reopened`, exactly `wmdemo/lp/cases.py:80`'s existing `STATUSES`. Mapping:
`new` = detected, unattributed evidence gathering. `awaiting_driver` = a custody-loss question was
put to the driver (reuses the existing `request_driver_response`/`consume_driver_response`
signed-link pattern, `cases.py:1123-1213`, and the RFID audit's own note that `mobile/
screen-discrepancy.jsx`'s response UI already exists client-side, §1.6). `awaiting_manager` =
attribution engine (§4) has a finding, needs a human disposition (same LP-vs-Manager-Decision
split as cash cases: adjudication first, discipline second). `decided` = disposition recorded,
optionally with `escalate_to_writeup`. `disputed` is **not a separate status** — it is
`record_dispute()` on a `decided` case, exactly the retail-closeout dispute path
(`cases.py:893-964`), pausing any ladder escalation the same way a cash dispute does today.
`corrected`/`reopened`/`void` — verbatim reuse (`cases.py:1081-1123`).

---

## 4. Attribution rules — evidence, never a guess

Every rule below produces `{finding, confidence: high|medium|low|unattributed, evidence: [event
ids]}`. **`unattributed` is a legitimate, final output**, not a placeholder for more digging — a
case can close as `unattributed` with a documented reason, and the scoreboard (§5) never charges
an unattributed loss to any individual.

| # | Owner's question | Rule | Evidence required | Confidence |
|---|---|---|---|---|
| 1 | Was the unit ever filled? | No fill-scan event (§2 event 2) for this unit/sku-batch at build or refill time → **builder/no-scan finding** against whoever was assigned to that kit/box at that time (event 1's actor) | Absence of event 2 within the build/refill window; event 1 (assignment) present | **Medium** — absence of a scan is not proof no one filled it (a scan can fail to register); never High without a corroborating count |
| 2 | RFID-scanned or keyed by hand? | Method on event 2 is `rfid`/`barcode`(exact batch id match)/`barcode`(SKU-fallback, §1.4 ambiguity)/`manual`/`none` — this is not itself a finding, it is a **confidence multiplier** on every other rule: an RFID-backed rule 1/3/4 finding is High confidence; a SKU-fallback-barcode or manual-tally-backed one is capped at Medium; `none` caps at Low | The method field on the cited event | Modifies, not a rule of its own |
| 3 | Was it in the right box? | `assigned_box_id != read_box_id` on event 3 (both present) → **placement error, attributed to whoever placed it** — the actor on the fill-scan event (2) for that unit, not the kit's overall builder-of-record if a different person handled that specific box | Event 3 with both fields populated and unequal | **High** if RFID-backed, **Medium** if barcode |
| 4 | Did the driver accept it at handover? | Event 4 (handover-acceptance) present and the unit was in the accepted set, but the unit is later missing with no in-shift event (5) explaining it → **driver custody finding**. Event 4 **absent or `method:"none"`** (kit handed over with no scan at all — currently the norm, §2 event 4) and the unit is missing → **upstream finding** (cannot be the driver's custody loss if custody was never verified transferred) | Event 4 (or its documented absence) + absence of any event-5 disposition for the unit | **High** if event 4 was itself RFID-scanned; **unattributed**, not "driver," if event 4 never happened — this is the single most important fail-safe rule in this table, because today event 4 does not exist anywhere (§2), so **every custody-loss case is `unattributed` by rule until the handover-acceptance scan is built** |
| 5 | Shared/ambiguous custody | More than one person's fill-scan events touch the same unit/box in a way that cannot be sequenced (e.g., two builders logged into the same station, or a refill overlaps an unclosed build) | Conflicting or overlapping event-2 actors with no clean time ordering | **unattributed**, always — the table's explicit instruction: never blame a guess |

**Decision table, condensed** (evidence present → finding):

| Fill scan? | Box match? | Handover scan? | Missing at | → Finding |
|---|---|---|---|---|
| No | — | — | any point | Builder/no-scan (Medium) |
| Yes | Wrong box | — | before handover | Placement error, the placer (High/Medium by method) |
| Yes | Right box | Yes, accepted | after handover, no event-5 | Driver custody (High if event 4 RFID-backed) |
| Yes | Right box | No scan / absent | after handover | Upstream — unattributed as "driver" (custody never verified transferred) |
| Yes | Right box | Yes | in-shift event-5 exists (swap/return/damage logged) | Not a discrepancy — already explained |
| conflicting actors | — | — | — | Unattributed (shared custody) |

**A discrepancy that resolves to `unattributed` still closes the case** (disposition =
"Process Fix" or "Explained," same LP-disposition vocabulary as cash cases, §1.2) — it simply
never appears as a finding against a person in §5.

---

## 5. The employee scoreboard

**Roles.** No job-function taxonomy exists in the estate today (§1.5) — this plan introduces one
as scoreboard metadata only (not a new `Role` access-control value): `kit_builder`, `restocker`,
`driver`, `receiver`, `budtender`. A person can hold more than one role concurrently or by shift;
every metric below is computed **per role the person acted in during that period**, never blended
across roles, so a driver who also builds kits on Sundays gets two separate scorelines.

**Metrics, per role** (denominator always stated — a flat count is never shown alone):

| Role | Metric | Denominator | Source |
|---|---|---|---|
| Kit builder | Fill-scan compliance % | units they filled | event 2 method != `none` ÷ total units assigned |
| Kit builder / Restocker | Errors per 1,000 units handled | units filled/refilled | rule-1/rule-3 findings attributed to them ÷ units × 1000 |
| Kit builder / Restocker | Wrong-box rate | units they placed | rule-3 findings ÷ units placed |
| Driver | Custody-loss rate and value | units accepted at handover | rule-4 driver-custody findings ÷ units accepted; $ value alongside, not instead of, the rate |
| Driver | Handover-scan compliance % | kits received | event-4 present-and-scanned ÷ kits received (this metric itself pressures the §2 gap closed — a driver who never scans handover cannot be cleared of custody findings, so their own compliance number is the lever) |
| Receiver | Receiving-count accuracy | units received | `record_receipt` variance vs. Metrc/PO-expected qty ÷ units received |
| Budtender | Retail shrink rate | units sold + counted | ties to `GAP-CLOSURE-PLAN §2.8 T4` (Discrepancy Management/Waste Inventory) — a separate, store-side count discrepancy, same denominator discipline |
| All roles | Time-to-correct | attributed incidents | median hours from case `new` to `decided` for their attributed cases |
| All roles | Repeat-error rate | their own trailing findings | attributed findings in the last 90 days that recur on the same SKU/box-role pattern |
| All roles | Trend | — | 4-period rolling comparison of the above (not a new metric, a display of the same ones over time) |

**Fairness mechanics**:
- **Minimum sample size**: no rate is displayed until the denominator crosses a floor (proposed:
  50 units handled, or 5 shifts, whichever is role-appropriate — Owner Question 2). Below the
  floor, the screen shows "not enough data yet," never a rate computed on 3 units.
- **Confidence bands**: every displayed rate carries a Wilson-interval-style band computed from the
  denominator, not a bare point estimate — a 2/50 rate and a 2/500 rate must not render as the same
  confident number.
- **Peer comparison**: within the same role, same store, same shift pattern (day/night, weekday/
  weekend) — never a driver compared to a budtender, never a small store compared to a flagship.
- **"Needs retraining" signal**: a threshold crossing (e.g., wrong-box rate > 2× the peer-group
  median **and** past the minimum sample size **and** sustained across ≥2 rolling periods) opens a
  **coaching recommendation** in a manager's queue. It is a recommendation, never an automatic
  write-up — matching the standing rule that judgment calls about a person always stay with a
  human.

**Feeding the accuracy ladder.** An attributed incident (§4, confidence ≥ Medium) above the
severity threshold (§3) becomes a **draft** `IncidentType` record. Two new enum values are needed
on `Incident.json`'s closed `IncidentType` enum (§1.5): proposed `inventory_placement_error`
(rule 3) and `inventory_custody_loss` (rule 4) — both classified `accuracy` in
`wmdemo/writeups/ladder.py` alongside the existing `change_not_returned`/`over_under_charged`/
`inventory_confirmation_failure` (`ladder.py:117-123`). From there, every existing rule applies
unchanged: 90-day window, dismissed-never-counts (checked first, unconditionally —
`ladder.py:225-235`), AI draft capped at Second Warning
(`AI_CAP_LEVEL = "second_warning"`, `ladder.py:138`), step-ups only through
`approve_and_send`'s `step_up_allowed()` gate requiring `hr:admin`
(`wmdemo/writeups/send.py:28-34,179-180`). A `record_dispute()` on the underlying LP case (§3)
pauses the draft the same way a disputed cash case does. **Builder/no-scan findings (rule 1) and
unattributed cases never feed the ladder at all** — only placement-error and custody-loss findings
with at least Medium confidence do, because those are the two rules that name a specific
individual with evidence, not an absence.

---

## 6. Fairness, privacy and security

**Visibility tiers** (following the existing `lp:read`/`lp:decide`/`lp:admin` and
`hr:read`/`hr:draft`/`hr:approve`/`hr:admin` split, `authz.py:168-281`):
- **Self**: an employee sees their own scoreboard (`scoreboard:read:self`, always granted) and
  every case that names them, with a dispute path (reuses `record_dispute()`, §3).
- **Direct manager**: sees their team's scoreboard and coaching queue (`scoreboard:read`,
  `OPERATOR_SCOPES`-tier, store-scoped — never cross-store, matching every other module's
  store-scoping posture).
- **HR / LP**: sees cross-store aggregates and the underlying evidence chain
  (`scoreboard:admin` + existing `hr:read`/`lp:read`).
- **Owner**: full visibility, no new scope beyond `hr:admin`/`lp:admin` already carrying it.
- **Peer rankings** (raw ranked list, not just "you vs. median"): **not built by default** — see
  Owner Question 3; the metric design in §5 works without ever showing a named leaderboard.

**Audit**: every view of another person's individual record (not the aggregate) is logged —
same precedent as `reports:pii` (`authz.py:_ADMIN_ONLY_SCOPES`).

**Immutable evidence**: every event in §2 and every case decision in §3 is append-only (metrc/lp
precedent, §2). A dispute or correction inserts a new record; nothing is ever edited in place.

**No customer PII in incidents**: the sibling swap-recovery plan's incident already scopes to
`orderId`/`driverId`/`sku`/`batchId` — no customer name/address should ever be added to an
inventory-discrepancy case; if a customer report is the detection source, only the order id is
carried, not the customer record.

**Retention**: proposed 3 years for closed cases (Metrc/tax-adjacent record-keeping norms) and 90
days rolling for the ladder-feeding window specifically (already decided) — final retention period
is Owner Question 4.

**Gaming protections** (refuter attack list for the build):
1. **Manual-entry spikes** — a builder who stops using RFID right before a bad week to suppress
   evidence quality; mitigated by making method itself a tracked compliance metric (§5) so a drop
   in scan-rate is its own signal, not a way to escape one.
2. **Scan-then-remove** — scanning a unit into a box, then physically moving it without a
   corresponding event; mitigated only by the eventual RFID portal/cycle-count coverage (§1.4's
   own open item 3 — a refuter should confirm this plan does not claim to solve it before that
   hardware exists).
3. **Handover scan skipped to avoid custody attribution** — since a missing handover scan resolves
   to `unattributed` (rule 4), a driver has a perverse incentive never to scan; countered by making
   handover-scan compliance % itself a scored, denominator-based metric (§5) — skipping it is
   visible and coachable on its own, even though it also means no custody finding can stick.
4. **Threshold-hugging** — someone with exactly the minimum sample size and a rate just under the
   retraining trigger; mitigated by the ≥2-rolling-period sustained requirement (§5), not a single
   snapshot.
5. **Case reassignment abuse** — `reassign()` already exists on `lp/cases.py` (`:1010-1053`) with
   no ownership check documented for the cash-case version either (`LP-DASHBOARD-INVENTORY.md` §4
   "Reassign/Release have no ownership check" — a known, carried-forward defect). **This plan's
   build must fix that gap for the inventory case kind at minimum**, not inherit it silently.

---

## 7. Build plan

**Contracts** (`POS-Admin/contracts/`): bump `enums.json` `IncidentType` with
`inventory_placement_error`/`inventory_custody_loss`; add a `CustodyEvent` schema (actor, device,
method, evidence_ref, event_kind, at) and an `InventoryDiscrepancyCase` schema extending the shape
`lp/cases.py` already returns (`_row_out`) with the new columns from §3.

**Tables** (`wm-demo`): `custody_events` (append-only, per §2's nine event kinds), new columns on
`lp_cases` for `case_kind="inventory"` (§3), a `scoreboard_metrics` materialized rollup (recomputed
on a job, not live-queried per view — same pattern as `mirrorLossToDirectory`'s cadence, but
without that function's known "never clears" bug, §1.2 lesson carried forward), a `role_periods`
table (person, role, store, period) since role is time-varying (§5).

**Routes/scopes**: `POST /api/custody-events` (`inventory:write`), `GET /api/discrepancy/cases`
(`discrepancy:read`, new scope family mirroring `lp:read`), `POST /api/discrepancy/cases/{id}/
decide` (`discrepancy:decide`), `GET /api/scoreboard/{person_id}` (`scoreboard:read:self` or
`scoreboard:read` for a manager, store-scoped), `GET /api/scoreboard/coaching-queue`
(`scoreboard:admin`).

**Jobs**: nightly scoreboard rollup (via `wmdemo/jobs.py`, following the `EXPIRING_LEASE` pattern
already generalized there per `GAP-CLOSURE-PLAN §2.4` card D2); a periodic attribution sweep that
re-runs §4's rules against any case still `new` after N hours (catches evidence that arrived late,
e.g., a handover scan logged after the case opened).

**Realtime events**: `discrepancy.case.opened`/`discrepancy.case.decided` on a new channel family
(`discrepancy.store.<store_id>`), following the registration pattern the swap-recovery plan already
flags as currently unused infrastructure (`realtime_channels.py`, `register_channel_family()` has
no live call sites yet — this plan's build is a candidate first real caller).

**Screens** (each new screen needs four concepts, desktop and phone, per standing rule):
1. **Discrepancy case queue/triage** — LP-Triage-shaped (reuse that screen's 4-concept work once
   chosen, `GAP-CLOSURE-PLAN` item 26, as a starting layout), filtered to `case_kind="inventory"`.
2. **Attribution/evidence review** — the custody-event timeline for one case (build assigned → fill
   scan → box placement → handover → in-shift → reconciliation), the decision table from §4
   rendered against this case's actual evidence, and the disposition action.
3. **Coaching queue** — manager-facing list of retraining signals (§5), each linking to the
   evidence behind it, with a "start coaching conversation" action that is explicitly *not* a
   write-up trigger.
4. **My record** (employee self-view) — their own scoreboard, their own open/closed cases, and the
   dispute action.
5. **Handover-acceptance scan** (driver, phone) — the net-new screen closing §2 event 4's gap;
   this is the single highest-leverage screen in this whole plan, since almost every rule-4
   finding is `unattributed` without it.

**Phases** (sizes per the estate's own S/M/L convention):
- **Phase 1 (S–M)**: contracts + `custody_events` table + the four existing event kinds that are
  really just wrappers on real code (fill scan via `rfid_count.py`/barcode, breakdown count via
  `inventory.py`, receiving via `record_receipt`, driver reconciliation route for events 6/9).
  Unlocks rule 1 (no-fill-scan) and gives real data to design against for everything else.
- **Phase 2 (M)**: box-placement event + comparison (event 3, rule 3) — needs the RFID reconcile
  engine wired to a real backend (a dependency this plan shares with, not duplicates,
  `RFID-FOR-DISTRIBUTION.md` §5's own recommended `POST /kits/:kitId/rfid-reconcile` endpoint).
- **Phase 3 (M–L)**: handover-acceptance event + screen (event 4, rule 4) — the biggest single
  unlock, since it is the only thing that turns "driver custody" from permanently `unattributed`
  into an actual, evidence-backed finding.
- **Phase 4 (S–M)**: the `lp/cases.py` `case_kind="inventory"` extension (§3) and attribution
  engine (§4) — can start once Phase 1 data exists, does not need to wait for Phase 3 (it will
  simply produce more `unattributed` results until Phase 3 lands, which is the correct, honest
  behavior, not a blocker).
- **Phase 5 (M)**: scoreboard rollup + screens (§5, §7 screens 1-4).
- **Phase 6 (S)**: ladder wiring (§5 last paragraph) + gaming-protection metrics (§6).

**Probes**: `qa/custody_events_probe.py` (event integrity, append-only enforcement),
`qa/discrepancy_attribution_probe.py` (every §4 rule, including the conflicting-actor and
absent-handover-scan paths — these are the ones most likely to be gamed if under-tested),
`qa/scoreboard_probe.py` (denominator/minimum-sample/confidence-band math, peer-group scoping),
a refuter pass specifically on the reassignment-ownership gap (§6 item 5) before this ships, since
it is a known, named, carried-forward defect, not a hypothetical.

---

## 8. Owner questions

1. **Severity thresholds** (§3) — recommended: Low ≤2 units/≤$25, Medium ≤10 units/≤$100, High
   above or any compliance flag. **Pros**: mirrors the existing cash-case Low/Med/High shape,
   easy to explain. **Cons**: a $100 flower discrepancy and a $100 concentrate discrepancy are very
   different unit counts — a pure-dollar band alone would under-flag high-unit/low-price shrink.

2. **Minimum sample size before a scoreboard rate displays** (§5) — recommended: 50 units handled
   or 5 shifts, whichever the role reaches first. **Pros**: prevents a brand-new hire's first bad
   day from becoming a visible rate. **Cons**: a slow store may take weeks for any driver to cross
   the floor, delaying legitimate early coaching signals.

3. **Peer rankings visibility** (§6) — recommended: no raw ranked leaderboard, only "you vs. your
   peer-group median/band." **Pros**: avoids public shaming and gaming-toward-rank behavior.
   **Cons**: some managers may want to see a real ranked list to prioritize coaching time, and a
   band-only view makes "who's worst" a manual cross-reference instead of a sort.

4. **Retention period for closed inventory-discrepancy cases** (§6) — recommended: 3 years,
   matching Metrc/tax record-keeping norms, independent of the 90-day ladder window. **Pros**:
   defensible in an audit; consistent with compliance-adjacent data elsewhere in the estate.
   **Cons**: 3 years of per-unit evidence (photos, scan logs) is real storage cost, and nobody has
   sized it yet.

5. **Should a driver see their own scoreboard live, or only after a manager review** (§6 "self"
   tier) — recommended: live, since the write-up path already requires manager approval regardless
   (the scoreboard itself can never discipline anyone). **Pros**: transparency, and a driver who
   sees their own handover-scan compliance dropping can self-correct before it becomes a coaching
   conversation. **Cons**: a live number a driver disagrees with, before any human has reviewed the
   underlying evidence, could generate disputes on cases that would have resolved to
   `unattributed` anyway.

6. **How should shared/ambiguous custody be handled operationally** (§4 rule 5) — recommended:
   always `unattributed`, with the case still closed via a "Process Fix" disposition (e.g.,
   "two builders logged into one station — assign one login per station going forward") so the
   *process* gets fixed even though no *person* is charged. **Pros**: consistent with "never guess
   a name onto a finding." **Cons**: a genuinely repeat offender who always works in a shared-login
   pair could hide behind this rule indefinitely — worth a periodic manual review of
   `unattributed`-heavy pairs, which is a person-judgment call this plan deliberately does not
   automate.

7. **Two new `IncidentType` enum values** (§5: `inventory_placement_error`,
   `inventory_custody_loss`) require a contract version bump on a closed schema
   (`Incident.json`'s `additionalProperties: false`) — confirm these are the right two names and
   that both classify `accuracy`, not a third new ladder category. **Pros**: keeps the two-ladder
   design (attendance/accuracy) intact, no new ladder to design or explain. **Cons**: lumping
   placement errors (a training/skill issue) and custody loss (potentially a trust/integrity issue)
   into the same `accuracy` ladder treats two different kinds of problem identically for
   escalation purposes.
