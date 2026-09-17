# Gap-Closure Build Plan — 2026-09-17

**What this is.** A buildable, ordered plan to close every gap between (a) the production
admin at admin.hyperwolf.com + Blaze POS, and (b) the new platform being built (`wm-demo`
backend + `POS-Admin` frontend). It does not redo the audit — it starts from
`ADMIN-GAP-LIST-2026-09-17.md` and `ADMIN-LIVE-AUDIT-2026-09-17.md`, adds the domains those two
docs deliberately deferred (they only went deep on Tax/Regions/Cash Drawer), and **trues
everything up against what was actually built overnight** (2026-09-16 night into 2026-09-17
morning — see `BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md` §9 and `MORNING-PACKET-2026-09-17.md`).

**The single most important true-up finding**: several items both gap docs list as
MISSING/PARTIAL were built the same night those docs were written and are now DONE (behind
feature flags in one case). Cash drawers, the tax-rate table, delivery regions with KML,
reports, and Loss-Prevention triage all shipped between the gap census and this plan. Reading
those two docs alone today would over-state the remaining work. This plan reflects the current
state, not the stale one.

**A word of honesty up front.** Everything marked BUILT below is committed locally and passed
its own probe suite (8,553 checks estate-wide, 8,409 passing, per the morning packet) — but as
of this writing it is **not pushed, not deployed, and not connected to real production data**
(real tax rates, live AWS/Postgres, real payment/Metrc credentials). "Built" means the code and
its tests exist and are refuted; it does not mean a store can use it today. Turning "built"
into "live" is itself real, scoped work, called out card-by-card below.

Sources read for this plan: `ADMIN-GAP-LIST-2026-09-17.md`, `ADMIN-LIVE-AUDIT-2026-09-17.md`,
`BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md` §9, `MORNING-PACKET-2026-09-17.md`,
`PLATFORM-AND-CUTOVER-PLAN-2026-09-16.md`, `migration/GAS-PORT-LIST-2026-09-17.md`,
`migration/OWNER-DECISIONS-NEEDED.md`, `ENGAGE-STATUS.md`, `SHELLS-STATUS.md`,
`BOUNTY-STATUS.md`, and (in `wm-demo`) `docs/SECURITY-GATE.md`, `docs/REGISTER.md`,
`docs/TAX.md`, `docs/REPORTS.md`, `docs/LP.md`, `docs/JOBS.md`, `docs/OUTBOUND.md`,
`docs/WRITEUPS.md`, `docs/TIMESHEET.md`, `docs/SIGNED-LINKS.md`, `docs/WHAT-THE-DEMO-DOES.md`,
`docs/SCOREBOARD.md`, `docs/DECISIONS.md`, plus direct reads of `wmdemo/catalog.py`,
`wmdemo/inventory.py`, `POS-Admin/pos/app.jsx`, `POS-Admin/shared/*.js*`, and a READ-ONLY grep
census of `/Users/jt/hyper-tech` (12 production repos, untouched).

**A note on jargon.** "Contract" means a written, agreed shape for a piece of data — like a
form template both sides promise to fill in the same way. "Scope" means a specific permission
a login can be granted (e.g. "can read tax rates" without "can change them"). "Idempotent"
means doing it twice by accident has the same effect as doing it once — nothing doubles up.
These are used throughout because the underlying build already uses them consistently.

---

## 1. Scoreboard

**Totals**: 67 gaps tracked. **Fully built and refuted**: 24. **Built but needs
wiring/decision/data before it's usable**: 15. **Partly built**: 11. **Not started**: 17.
By size: **S** (≤1 agent-day) 22 · **M** (2–3 days) 28 · **L** (a week+) 17.

Status legend: **BUILT** = shipped + probed, no further backend work, may still need a UI or a
real-data decision (see the "needs" note). **PARTIAL** = some of it exists, real work remains.
**NOT STARTED** = no code for this yet. **BLOCKED** = waiting on someone outside this build
(Weedmaps, an owner decision, an AWS account).

| # | Gap | Source | Status today | Size | Phase |
|---|---|---|---|---|---|
| 1 | Per-store tax rate table | prod admin | **BUILT** — `wmdemo/tax.py`+`tax_api.py`, 81 checks. Off by default (`WM_TAX_TABLE`) pending real rates | S (turn on) | 1 |
| 2 | Tax calc per member-type/cannabis split | prod admin | **BUILT** — server-resolved, data-driven, not code-branched | — | 1 |
| 3 | Federal tax tier | prod admin | **BUILT** (schema slot `kind:"other"`) — usage unconfirmed | S | 1 (decision) |
| 4 | Tax operator-visible screen | prod admin + Blaze | NOT STARTED — no admin has ever shown one; backend ready | S–M | 1 |
| 5 | Persisted tax breakdown on sale (audit) | prod admin | **BUILT** — `pos_sales.tax_breakdown_json` | — | done |
| 6 | Cash drawer open/close/float | prod admin (GAS) + Blaze | **BUILT** — `wmdemo/register.py`, 104 checks | S (wire UI) | 1 |
| 7 | Cash drop / paid-in / paid-out | Blaze | **BUILT** — `cash_drops` table, 4 reasons | — | done |
| 8 | Blind cash counts / require-drawer-for-sale policy toggles | Blaze | **BUILT** — `register_policy`, off by default | S (decision: default) | 1 |
| 9 | Discrepancy/variance audit view | prod admin | **BUILT** — `GET /api/register/variance` | S (screen) | 1 |
| 10 | Register-Home-card UI integration | — | NOT STARTED — `pos/screen-register.jsx` untouched by design | S | 1 |
| 11 | Tie register close to Blaze's closing receipt | Blaze | NOT STARTED, needs Blaze read adapter | M–L | 3 |
| 12 | Roll/coin-denomination float solver ("tomorrow's float") | GAS (RetailFloatPlan) | NOT CARRIED OVER (denominations model built, solver isn't) | M | 3 (optional) |
| 13 | Region model (delivery zone, KML, hours) | prod admin + Blaze | **BUILT overnight** — `wmdemo/catalog.py`/`geo.py`, 86 checks: KML (XML-bomb-safe), contains/open/hours, sub-regions, archive | S (screen) | 1 |
| 14 | Region CRUD screen (list, sub-regions tab, bulk unassign driver) | prod admin | NOT STARTED | M | 1 |
| 15 | Sub-region/driver assignment | prod admin | **BUILT** (part of #13) | — | done |
| 16 | Region↔driver lookup | Blaze/prod | **BUILT** — `catalog.py::driver_region` | — | done |
| 17 | Reports module (12 Blaze-parity reports) | Blaze | **BUILT** — `wmdemo/reports.py`, 71+20 checks | M (screen) | 1 |
| 18 | Reports screen | Blaze | NOT STARTED — no `screen-reports.jsx`; client layer exists (`hw-reports.js`) with no UI | M | 1 |
| 19 | Delivery Sales Report | Blaze | NOT STARTED (separate order table, not joined) | M | 2 |
| 20 | Employee × Product cross-report | Blaze | NOT STARTED | S | 2 |
| 21 | Export Product Batch tool | Blaze | NOT STARTED | S | 2 |
| 22 | Real COGS source for Profit & Loss | Blaze | PARTIAL — report computes honestly, `unit_cost_cents` mostly unpopulated | M | 2 (decision) |
| 23 | LP triage/case state machine (cash variance) | GAS (end-of-shift-portal) | **BUILT** — `wmdemo/lp/`, 110 checks | — | done |
| 24 | Store Close-Outs verify/dispute/reopen/reassign | GAS | **BUILT** | — | done |
| 25 | Live loss-ledger (replaces 30-min Airtable mirror) | GAS | **BUILT** | — | done |
| 26 | LP Triage screen | — | 4 concepts drafted, none built/chosen | M | 1 (decision then build) |
| 27 | Discrepancy Management / Approvals (inventory shrink) | prod admin | NOT STARTED — distinct from cash-variance LP above | M–L | 2 |
| 28 | Waste Inventory | prod admin | NOT STARTED | M | 2 |
| 29 | Write-up ladder engine + AI drafts + approve-and-send | GAS (writeup-pipeline) | **BUILT** — `wmdemo/writeups/`, 83+49 checks | — | done |
| 30 | Employee e-signature on write-ups | GAS | **BUILT**, but signing page wiring incomplete | S | 1 |
| 31 | Timesheet compliance audit engine | GAS (timesheet-audit) | **BUILT** — 101 checks | — | done |
| 32 | Timesheet Tier-2 messaging (employee note + manager digest) | GAS | **BUILT** | — | done |
| 33 | HR Overview / employee directory screen | prod admin | 4 concepts drafted, none built/chosen | M | 1 (decision then build) |
| 34 | Roles & Permissions admin screen + real per-operator RBAC | prod admin + Blaze | PARTIAL — scopes exist, no per-operator login UI, shared token still primary | L | 2 |
| 35 | Employee time clock surface | Blaze | PARTIAL — audit exists (background), no clock-in screen (by design, GAS never had one either) | — | not planned |
| 36 | Catalog: Formats/Shells/naming engine | vendor | **BUILT** Phase 1 — 634 products, 74 shells | — | done |
| 37 | Catalog Phase 2: apply names live + remaining 76 brands | — | NOT STARTED | L | 2 |
| 38 | Weedmaps taxonomy mapping (sub-cat → WM node) | — | **BUILT and LIVE** (real Weedmaps API) | — | done |
| 39 | Product↔Weedmaps SKU mapping (bulk view, import, rescore) | — | **BUILT and LIVE** | — | done |
| 40 | Publish gate (blocks SKUs failing WM sync) | — | **BUILT and LIVE** | — | done |
| 41 | Cross-source pricing comparison screen | — | **BUILT** — `screen-pricing.jsx` | — | done |
| 42 | Distribution: Boxes / Kit Template / Distribution Mgmt / Refill Logs / Driver Kit Verification | prod admin | NOT STARTED as UI (maps to Shells rework decision) | L | 2 |
| 43 | Aging & Promotional Products screen | prod admin | NOT STARTED | S–M | 2 |
| 44 | Inventory locations/batches/movements/receiving/put-away | Blaze | **BUILT** — `wmdemo/inventory.py` | — | done |
| 45 | Channel binding (pickup/express/scheduled) + publish gate | — | **BUILT** | — | done |
| 46 | Floor Restock screen | — | **BUILT** (Store Concept A) | — | done |
| 47 | Manage shelf pars | Blaze | NOT STARTED (no par table) | S–M | 2 |
| 48 | Cycle Counts / Inventory Reconciliation screen | Blaze | PARTIAL — counts exist server-side, no dedicated UI | M | 2 |
| 49 | Print Labels | Blaze | NOT STARTED | S | 3 |
| 50 | Metrc integration (packages/sales/items/strains/tags/compliance sync) | Blaze + prod admin | NOT STARTED — largest single gap; no Metrc client anywhere in wm-demo | L | 2–3 |
| 51 | Order lifecycle / stage machine / reservations | — | **BUILT and LIVE** against real Weedmaps sandbox | — | done |
| 52 | Region-based inventory pools (soft-hold, sweeper) | — | **BUILT** | — | done |
| 53 | Check-in / arrival matching | — | **BUILT and LIVE** | — | done |
| 54 | Weedmaps Orders-API status push | — | **BLOCKED on Weedmaps** — orders scope not granted to our token | — | 3 (escalate to WM) |
| 55 | Delivery ETA/distance/map pins | — | NOT STARTED — invented placeholder data today | L | 3 |
| 56 | Identity/fraud engine (fingerprint merge, tier graduation) | — | **BUILT and LIVE** | — | done |
| 57 | Engage: customers, consent, tags, merge | — | **BUILT** | — | done |
| 58 | Loyalty points/programs/tiers/rewards | prod admin | **BUILT** schema+CRUD; **tier ladder undecided** (4 disagreeing live ladders) | M | 1 (decision) |
| 59 | Members screen — real backend wiring + License # field | Blaze | PARTIAL — screen exists, still mock data (`window.HW.MEMBERS`) | M | 1 |
| 60 | Messaging providers (Twilio/SendGrid) live | — | BUILT, keys not configured | S | 2 (owner action) |
| 61 | Alpine IQ real cutover import | — | BUILT as dry-run only | S | 3 (decision) |
| 62 | Promotions: legacy WM-mirror + registry overlap detection | — | **BUILT** | — | done |
| 63 | Promotions: Engage `engage_promotions` (audience/channel rules) | — | **BUILT** | — | done |
| 64 | Promotions: `hw.rule.v1` batch-rule engine (THC%, category) | — | **BUILT**, security-hardened | — | done |
| 65 | Promotions UI screen (rule builder) | Blaze | 4 concepts drafted, none built/chosen; backend ahead of UI | M–L | 1 (decision then build) |
| 66 | Reconcile 3 coexisting promo engines into one operator model | — | NOT STARTED (design/product decision) | M | 2 |
| 67 | Bundle offers / points-multiplier promo support | — | PARTIAL — schema ready, editor doesn't supply the fields yet | M | 2 |

*(Settings/integrations and notifications gaps are tracked in their own domain sections below —
they are almost entirely NOT STARTED or PARTIAL "shared plumbing" items rather than discrete
feature parity rows, so they are enumerated as build cards directly rather than padded into this
table.)*

---

## 2. Per-gap build cards

Only gaps that are **not fully built** get a card. Fully-built items are in the scoreboard
above with their proof (probe count); re-reading their design here would not help you decide
anything.

Each card's **security requirements** section is deliberately concrete — it names the misuse a
refuter should actually try, not a generic checklist. See §5 for the baseline that applies to
*every* card in addition to what's listed here.

### 2.1 Catalog and menus

#### C1 — Shells Phase 2: apply derived names live + remaining 76 brands
- **What the user gets**: every product's name on the live site matches the naming-engine's
  derived name, for all ~110 brands, not just the 10 done in Phase 1.
- **Data**: `wmdemo/shell_naming.py` (naming engine, already agreed on 87 fixture cases with
  `shared/hw-naming.js`); production catalog collections it must reconcile against —
  `hemp-backend/models/HempProducts.js:1-37`, `hyperwolf-backend/models/Products.js:1-33`,
  `stilo-backend/models/StiloProducts.js:1-38` (three different shapes — flat fields on two,
  an opaque `productData: Object` blob on the third; a real sync must handle all three or pick
  one system of record).
- **API routes**: extends `/api/shells/*`, `/api/catalog/import`.
- **UI**: Catalog → Shells (existing screen), no new screen — this is a data-correctness pass,
  not a UI build.
- **Dependencies**: owner approval of the Phase 1 derivation report before touching real names
  (per `SHELLS-STATUS.md` "Open (known)").
- **Security**: format/shell writes are manager-gated already (`_is_manager` → real principal
  scope check, not self-reported actor); a refuter should try renaming a format with 600+
  products attached and confirm the preview still lists every one before Apply is enabled.
- **Testing**: `qa/shells_probe.py`, `qa/shells_naming_probe.py`, re-run the 87-case fixture
  against the full (not just Phase-1) brand set.
- **Owner decision**: none blocking — Phase 1's own two open items (Premium Oil Vapes naming,
  Heavy Hitters missing weight) should be confirmed before Phase 2 starts.

#### C2 — Distribution: Boxes / Kit Template / Distribution Mgmt / Refill Logs / Driver Kit Verification
- **What the user gets**: the same Region → Kit (per driver) → Boxes workflow the production
  admin already has (`hyperwolf-super-admin/src/layouts/{boxes,kit-template,distribution-management,refill-logs,driver-kit-verification}`),
  built against wm-demo's own inventory/channel model instead of the vendor's.
- **Data**: production model family is `distribution-backend/models/{Boxes,KitBoxes,KitDispatch,
  KitDistributed,KitRefill,KitTemplate,ProductBatch,boxProduct}.js` (not fully diffed this pass —
  flag for a follow-up read before locking the schema). wm-demo side: `wmdemo/inventory.py`'s
  locations/channel-binding/publish-matrix functions are the real foundation already built.
- **API routes**: new — `/api/kit/*` template CRUD, `/api/distribution/*` run tracking,
  `/api/kit-verification/*` scan intake. `wmdemo/inventory.py`'s existing `arm_channel`/
  `publish_matrix` are the pieces to build on, not replace.
- **UI**: net-new screens. **Four distinct concepts required** (owner's standing rule for any
  new screen) — the live-audit's own note (§4 bullet 10) already proposes reusing the vendor's
  field set (Min/Max Products Per Region, Kit Value, Verified Kit Status counts) as a starting
  spec, not a blank page.
- **Dependencies**: Shells Phase 1 (done) for the box/format vocabulary; a decision on whether
  Distribution rebuild owns box CRUD or Shells does (per `shells-module-decisions` memory: "Phase
  1 = Hyperwolf + top 10 brands then approval").
- **Security**: kit/box writes are money-adjacent (kit value, refill quantities) — require
  `shells:admin`/new `distribution:admin` scope, never a self-reported actor; a refuter should
  try refilling a kit past its declared capacity and confirm the server refuses, not just the UI.
- **Testing**: new probe suite, `qa/distribution_probe.py`, following the `shells_probe.py`
  convention (own scratch DB, own server subprocess).
- **Owner decision**: #4 below (which of the four concepts).

#### C3 — Aging & Promotional Products screen
- **What the user gets**: a filterable list (by Box/Category/Brand) of products flagged as
  aging stock or currently on a promotional discount, mirroring `hyperwolf/aging-discounted-products`.
- **Data**: needs an `aging`/`discount_flag` concept on the catalog row — doesn't exist yet in
  `wmdemo/catalog.py`. Production: embedded fields on `hemp-backend/models/HempProducts.js`
  (not itemized this pass — a follow-up grep for `aging`/`discount` fields is needed before
  scoping this precisely; flag as the open question).
- **API routes**: new `/api/catalog/aging`, extends `/api/product`.
- **UI**: one filtered list screen, reusing Catalog's existing table component.
- **Dependencies**: none blocking; can run in parallel with C1/C2.
- **Security**: read-mostly; write path (marking a product "aging") should require `catalog:write`.
- **Testing**: a probe asserting the filter combinations (Box × Category × Brand) return the
  right rows against a seeded fixture.
- **Owner decision**: what "aging" means numerically (days on shelf? a manual flag?) — the
  production screen's own filters don't reveal its business rule; ask before building the query.

---

### 2.2 Inventory

#### I1 — Manage shelf pars
- **What the user gets**: set a target on-hand quantity ("par") per SKU per location; Floor
  Restock already tells you what's short, this tells it *how* short relative to a real target
  instead of a hand-typed number each time.
- **Data**: new `shelf_pars(location_id, sku, par_qty, updated_by)` table, sibling to
  `wmdemo/inventory.py`'s existing `location_stock`.
- **API routes**: `GET/POST /api/inventory/pars`.
- **UI**: a small settings panel inside Floor Restock (`pos/screen-floor-restock.jsx`) — not a
  new top-level screen.
- **Dependencies**: none — additive to the already-built restock flow.
- **Security**: `inventory:restock`-scoped write, store-scoped (404 not 403 outside a
  restricted principal's stores, matching every other module's posture).
- **Testing**: extend `qa/restock_api_probe.py`.
- **Owner decision**: none.

#### I2 — Cycle Counts / Inventory Reconciliation screen
- **What the user gets**: Blaze's "count what's actually on the shelf and see the variance"
  workflow, using the counts/movements machinery that already exists server-side.
- **Data**: `wmdemo/inventory.py`'s `movements`/`received_ledger`/count-family routes (already
  built per Team 2b's own inventory API — `_restock_apply`, `movements()`, `received_ledger()`).
- **API routes**: mostly exist; a `GET /api/inventory/counts/variance` rollup is the one new
  piece.
- **UI**: new screen, or a tab inside Floor Restock. Not a from-scratch data model — this is a
  UI-only gap on top of an already-built backend.
- **Dependencies**: I1 (pars) is a natural neighbor but not a blocker.
- **Security**: read is `inventory:read`-scoped (not registered strict yet — see SI3); a
  refuter should try reading another store's count variance through this new rollup route,
  since the underlying family currently has a **documented, deliberate** exclusion from
  route-policy registration (see `docs/SECURITY-GATE.md` "Deliberately NOT registered").
- **Testing**: `qa/inventory_v040_probe.py` extension.
- **Owner decision**: none.

#### I3 — Print Labels
- **What the user gets**: print a shelf/product label from the catalog or restock screen.
- **Data**: none new — pulls from existing catalog/batch rows.
- **API routes**: none — this can likely be a pure client-side render-to-PDF/print-dialog
  feature with no new backend route at all.
- **UI**: a button on Catalog and/or Floor Restock.
- **Dependencies**: label template/format — ask the owner what a real label needs to show
  (price? THC%? batch/Metrc tag? — the last one is blocked on the Metrc card, T3).
- **Security**: none beyond existing read scopes — printing is not a write.
- **Testing**: a UI smoke test; no probe needed unless a template-rendering route is added.
- **Owner decision**: what fields a label must carry (blocks nothing else, but blocks this
  card's own scope).

---

### 2.3 Orders and fulfilment

#### O1 — Delivery ETA/distance/map pins
- **What the user gets**: real distance/ETA numbers and map pins on the dispatch/orders screen,
  replacing the "—" / 0.0 mi / same-pin-everywhere placeholders documented in
  `WHAT-THE-DEMO-DOES.md`.
- **Data**: needs a geocoding provider and either a live driver-location feed or a
  route-distance calculation. Production reference: `hyperdrive-backend/models/Fleets.js`
  (vehicle/fleet fields) — not itself a location feed; the live location source is more likely
  Onfleet, per `driver-mgmt`'s own GAS integration (`GAS-PORT-LIST-2026-09-17.md`).
- **API routes**: new — `/api/delivery/eta`, `/api/delivery/route`.
- **UI**: `pos/screen-orders.jsx`'s dispatch view; no new screen, an enhancement.
- **Dependencies**: a decision on geocoding provider (Google Maps? Mapbox? whatever Onfleet
  already provides) and on whether Onfleet itself is the source of truth for driver location
  (it already is for `driver-mgmt`/`scoreboard`, per GAS-PORT-LIST — reuse before rebuilding,
  per the estate's duplicate-fetch rule).
- **Security**: driver location is real-time PII-adjacent (reveals where an employee is) —
  scope this to `orders:read`/dispatcher roles only, never expose to a customer-facing surface,
  log every read for audit.
- **Testing**: a probe against a stubbed geocoding/Onfleet response, plus a manual check that
  two different orders never render the same pin.
- **Owner decision**: geocoding provider choice; whether to reuse Onfleet's existing feed
  (recommended) or build a second one.

#### O2 — Weedmaps Orders-API status push (partner-side block)
- **What the user gets**: once Weedmaps grants the `orders` scope, order status pushes (READY,
  etc.) actually reach Weedmaps instead of failing with HTTP 400 "permanent, will not retry."
- **Data**: no schema change — `wmdemo/wm_client.py`/`engine.py` already build and send the
  correct payload; it 400s purely because the token lacks the scope.
- **API routes**: none new.
- **UI**: none — this is invisible to an operator except that the Weedmaps status block starts
  saying "delivered" instead of "FAILED."
- **Dependencies**: **Weedmaps must grant the scope.** Not ours to fix — flagged already in
  `docs/WM-REPLY-2026-08-18-MIKE-HALL.md`.
- **Security**: none new.
- **Testing**: `qa/cycle3_probe.py`'s existing live-status assertions will start passing
  end-to-end once the scope lands; no new test needed.
- **Owner decision**: none — this is a vendor follow-up, not a build decision. Track it as an
  external dependency on the AWS/Integrations cutover phase (§3), since order-status parity is
  part of what "the platform actually works" means for stores using Weedmaps delivery.

#### O3 — Real cost/margin figures on Home and Orders screens
- **What the user gets**: the "margin" numbers shown throughout the POS stop being arithmetic
  on a hashed, made-up SKU number (`shared/hw-live.js:285-296`) and reflect real cost of goods.
- **Data**: this is the same underlying gap as Reporting's Profit & Loss card (R5) — one real
  COGS source of truth (`batch_meta.unit_cost_cents`, populated) fixes both. Do not build this
  twice; whichever team picks up R5 should also wire this card's screens.
- **Dependencies**: R5's owner decision (COGS source) must land first.
- **Owner decision**: see R5.

---

### 2.4 Delivery and drivers

#### D1 — Region CRUD screen
- **What the user gets**: the Region list/Sub Regions tab/Bulk Unassign Driver workflow the
  production admin already has at `/regions`, now against wm-demo's own (already built)
  region+KML+hours+sub-region model.
- **Data**: `wmdemo/catalog.py` — `regions()`, `create_region()`, `set_region_geo()`,
  `sub_regions()`, `archive_region()`, `unassign_drivers()` are all already built and
  store-scoped. This card is UI-only.
- **API routes**: all exist (`/api/region*`) — confirm the archive/unassign endpoints are wired
  the way the screen needs; no new backend work expected.
- **UI**: net-new screen — Region list, a Sub Regions tab, a KML/hours editor panel, a Bulk
  Unassign Driver action. **Four concepts required** (new screen).
- **Dependencies**: none — the hardest part (the data model) is done.
- **Security**: `catalog:write` for edits; archiving a region with active sub-regions must show
  the reference count before allowing it (the backend already returns "archive with reference
  counts" per the morning packet — the screen must surface that count, not hide it behind a
  bare confirm dialog).
- **Testing**: a UI-level probe plus the existing 86 backend checks already cover the logic
  this screen calls.
- **Owner decision**: whether to keep KML sourced from wm-demo's own model (current) or import
  it from the existing GAS/Airtable zone lookup (per `ADMIN-GAP-LIST-2026-09-17.md` §D
  question 3) — **this needs re-asking now that the KML model is already built in wm-demo**;
  the estate's duplicate-fetch rule (CLAUDE.md §4.8) says verify params before merging two
  sources, and nobody has verified whether the GAS zones and the new KML rows agree.

#### D2 — driver-mgmt / delivery-ops GAS port
- **What the user gets**: mileage/breaks/dispatch logic currently running as GAS triggers moves
  onto the new platform's `jobs.py` runner, gaining checkpointing, leases, and cancel that GAS
  triggers never had.
- **Data**: `driver-mgmt` (273 Blaze refs, has the EXPIRING_LEASE lock pattern already —
  `jobs.py` was explicitly built to generalize this exact pattern) and `delivery-ops`
  (call-off intake/terminal retries). Both are "PORT NOW" per `GAS-PORT-LIST-2026-09-17.md`
  Wave 2, and both are still live on GAS today — not yet moved.
- **API routes**: new jobs registered via `jobs.register(...)`, reusing the pattern
  `docs/JOBS.md` already documents ("GAS pattern → jobs API" table).
- **UI**: none required for the port itself; a later card could add an ops view.
- **Dependencies**: `jobs.py`/`outbound/`/Airtable adapter (all built) are the shared plumbing
  this depends on — already done, this is "just" the port work per project.
- **Security**: this is the highest-risk class of port per CLAUDE.md §4 (external side effects
  — Onfleet task creation, driver messages) — retry the smallest failing unit only, never the
  whole job (§4.5); a refuter should specifically try killing a job mid-run and confirm no
  duplicate Onfleet task or duplicate driver message results.
- **Testing**: a dedicated probe per ported function, following `qa/timesheet_probe.py`'s
  convention (own scratch DB + subprocess server + stubbed externals).
- **Owner decision**: none blocking — already decided PORT NOW in the GAS port list.

#### D3 — Onfleet dispatch/scoreboard port
- **What the user gets**: the driver KPI scoreboard, currently GAS, ported onto the new
  platform.
- **Data**: `scoreboard` GAS project (318 Onfleet refs) — the port list's own spot-check found
  this **verified live/active**, overturning an earlier draft assumption that it was stale.
- **Dependencies**: D2 (shares the Onfleet read path) — do these together, not separately, to
  avoid two Onfleet adapters.
- **Owner decision**: PORT LATER per the GAS port list (Wave 3) — sequencing is already decided,
  just not yet started.

---

### 2.5 Customers and loyalty

#### CL1 — Loyalty tier ladder decision + wire Engage points/tiers to the POS
- **What the user gets**: the "Rewards" panel on the POS home screen shows a real tier/points
  balance instead of the invented number `pos/data.jsx` currently renders.
- **Data**: `wmdemo/engage/*` — `loy_tiers`, `loy_ledger` are real tables with real CRUD
  already built; what's missing is which ladder (bronze/silver/gold/platinum, or something
  else) is the *real* one. `ENGAGE-COMPAT.md` gap #14 documents **four already-live,
  disagreeing ladders** across the register, the consumer app, this Engage draft, and the
  contract doc.
- **API routes**: `GET /api/engage/loyalty/*` already exist.
- **UI**: replace the mock `REWARDS` block in `pos/data.jsx`'s consumer with a real
  `HW_LIVE`-backed read, once the ladder is picked.
- **Dependencies**: the tier-ladder decision (owner decision #4 below) is the only blocker.
- **Security**: points adjustments are money-adjacent — already scoped `engage:points`/
  `engage:admin` per the W3 batch1 security pass, with the self-reported-actor bug already
  fixed (principal-bound, not body-supplied).
- **Testing**: `qa/engage_ledger_probe.py`/`engage_rewards_probe.py` already exist (30+21
  checks) — no new suite needed, just a UI wiring test.
- **Owner decision**: #4 below.

#### CL2 — Members screen: real backend wiring + License # field
- **What the user gets**: the Members screen shows real customers (from Engage's real
  `customers` table and the identity ledger) instead of 5 fake people, and gains the License #
  column Blaze's own Members screen has (relevant for age/medical verification, not just
  display).
- **Data**: `wmdemo/engage/api.py`'s customers list/get/edit routes are already built and real.
  `hw_identities` (the fraud/identity ledger) is the other real source. License # itself is new
  — needs a column on whichever table becomes the system of record (`engage` customers, most
  likely, since it already has the CRUD surface).
- **API routes**: mostly exist (`GET/POST /api/engage/customers*`); add a `license_number`
  field to the contract and to `customer_member_types` if that's where medical-member-type
  verification (tax.py's own dependency, see T1) should live too — **this card and the tax
  member-type card share a real data need; solve them together.**
- **UI**: `pos/screen-stubs.jsx`'s `MembersScreen` needs to move off `window.HW.MEMBERS` mock
  data onto `window.HW_LIVE`/Engage calls.
- **Dependencies**: none blocking.
- **Security**: a government ID/license number is a PII field — same class as SSN handling
  elsewhere in this estate (plaintext + audit + PIN-gated reveal is the existing precedent,
  per `OWNER-DECISIONS-NEEDED.md` item 2). Do not render it in a plain list column the way
  Blaze does today (the live audit flagged Blaze's own plaintext, no-mask display of 196,853
  license numbers as a real blast-radius concern) — mask by default, reveal on click with an
  audit row.
- **Testing**: extend `qa/engage_api_probe.py`; add a masking/reveal-audit probe modeled on the
  SSN reveal pattern already proven elsewhere.
- **Owner decision**: should License # be verified (a real gate) or just stored as text? Blaze
  stores it as text with no visible verification step — recommend matching that for parity,
  escalate later if compliance needs more.

#### CL3 — Messaging providers live (Twilio/SendGrid)
- **What the user gets**: consent-gated SMS/email campaigns actually send, instead of running
  through `NullAdapter` (no network call).
- **Data**: no schema change — `wmdemo/engage/msg_adapter.py` already speaks both providers'
  wire formats; only real API keys are missing.
- **Dependencies**: owner supplies `TWILIO_*`/`SENDGRID_*` keys on Render.
- **Security**: the inbound webhook signature check (Twilio/SendGrid HMAC) is real-time
  verified against a **re-serialized** JSON body, not the provider's original raw bytes — flag
  this as a pre-existing, documented wiring gap (`server.py` parses every POST to JSON before
  any route sees it) that should be fixed before this goes live with a real SendGrid webhook,
  or an attacker-crafted body could pass signature verification differently than SendGrid's own
  check would.
- **Testing**: `qa/engage_adapter_probe.py` already covers the adapter logic; a live send
  against a real (non-production) Twilio/SendGrid sandbox number should be the go-live gate.
- **Owner decision**: none beyond supplying keys — flagged as owner action, not a build task,
  in the morning packet.

#### CL4 — Alpine IQ real cutover import
- **What the user gets**: the one-time real pull of Alpine IQ contacts/balances/history into
  the new platform, replacing the dry-run-only stub.
- **Data**: `POST /api/engage/import/alpine` already exists and does the dry run; the real run
  needs `confirm: "cutover"` and a manager actor, already gated.
- **Dependencies**: CL1 (tier ladder) should land first — importing loyalty balances onto an
  undecided ladder would need re-mapping later.
- **Security**: writes identities only through the real identity writer, consent through
  `consent.record`, never a plain email/name as the external key (already built this way) —
  a refuter should try a double-run and confirm `rows_read == inserted + unchanged + conflicts
  + rejected` holds exactly (already asserted by design, verify it holds against real data
  volume, not just the dry-run fixture).
- **Testing**: run the dry run against real (read-only) Alpine IQ data first, review the report,
  then approve the real run.
- **Owner decision**: when to pull the trigger — this is explicitly a one-time, owner-approved
  cutover action, not a recurring sync.

---

### 2.6 Promotions

#### P1 — Promotions UI screen (rule builder)
- **What the user gets**: an operator can create/edit/activate a promotion without an API call
  — today the backend (three engines, see P2) is real and live but has zero UI in `pos/app.jsx`.
- **Data**: `wmdemo/engage/promotions.py` (`engage_promotions`) and
  `wmdemo/engage/batch_rules.py` (`hw.rule.v1`) both have full CRUD already.
- **API routes**: exist — `/api/promos/internal`, `/api/promos/rules*`, `/api/promos/eligible`.
- **UI**: net-new screen. **Four concepts already drafted** per the morning packet ("four
  concepts each for rule builder... Review rounds are live at `/explorations/review/`") — this
  is a pick-and-build card, not a from-scratch design card.
- **Dependencies**: P2 (engine reconciliation) should at least be *decided* (even if not fully
  executed) before the screen locks its data model, or the screen will need to be rebuilt when
  the three engines are reconciled.
- **Security**: promotion activation is the D4-hardened path already — `promos:activate`
  requires a distinct scope from `promos:write`, and the fix that closed the
  self-reported-`meta.source` hole (an agent key claiming `"ui"` to bypass the draft-only rule)
  is already live. A refuter building this screen should re-confirm the UI's own write calls
  go through the same authenticated-principal binding, not a client-side "source" flag.
- **Testing**: `qa/promo_rules_probe.py` (289 checks) already covers the API; add a UI-level
  smoke test for the chosen concept.
- **Owner decision**: #5 below (which concept).

#### P2 — Reconcile three coexisting promotion engines
- **What the user gets**: nothing directly — this is groundwork so P1's screen (and any future
  screen) has one coherent place to create a promotion, instead of an operator needing to know
  which of three systems a given promo type lives in.
- **Data**: (1) the legacy WM-mirror `internal_promos` + registry/overlap-detection (built,
  detects collisions between our promos and Weedmaps's own); (2) Engage's `engage_promotions`
  (audience/channel/store-scoped, stacking by priority); (3) `hw.rule.v1` batch rules
  (THC%/packaged_at/category conditions, agent-draftable). All three are real, all three are
  live, none of them currently talk to each other.
- **Dependencies**: none technical — this is a product-shape decision.
- **Security**: n/a (design work).
- **Testing**: once reconciled, a cross-engine probe should confirm a promo created in the
  chosen shape can't silently collide with one still living in a different engine (the registry
  already does this for the WM-mirror vs internal case — extend it to cover all three).
- **Owner decision**: which engine is the system of record for NEW promotions going forward
  (recommend `hw.rule.v1` for its agent-draftable/human-activate split, with `engage_promotions`
  staying the audience/loyalty-tied special case, and the legacy WM-mirror staying exactly what
  it is — a read-only mirror of what Weedmaps itself has, never a place to originate a promo).

#### P3 — Bundle offers / points-multiplier promo support
- **What the user gets**: a "buy this bundle for $X" or "2× points this weekend" promotion
  actually computes a discount instead of reporting `unsupported`.
- **Data**: `engage_promotions`' bundle action needs `bundle_skus`/`bundle_price_cents`; the
  points action needs to support a multiplier, not just a flat award.
- **Dependencies**: a real bundle/points editor UI (ties to P1).
- **Security**: same as any promotion write — `promos:activate` gate applies identically once
  built.
- **Testing**: extend `qa/engage_promotions_probe.py`.
- **Owner decision**: none — this is additive, single-function work once the editor exists.

---

### 2.7 Payments and cash

#### PC1 — Wire the Register screen to the real backend
- **What the user gets**: closing a register produces a real, permanent record instead of
  something that vanishes when the browser tab closes.
- **Data**: `wmdemo/register.py`/`register_api.py` — fully built, 104 checks, contract-shaped.
  `shared/hw-register.js` is the client wrapper, already built with every function the screen
  needs (`open`, `drop`, `count`, `close`, `void`, `session`, `sessions`, `variance`,
  `getPolicy`, `setPolicy`) except `reopenCount`, which still needs adding.
- **API routes**: all exist.
- **UI**: per the owner's standing rule, `pos/screen-register.jsx` is never modified directly —
  integrate through the Home card, the pattern this estate already uses for exactly this
  situation.
- **Dependencies**: none.
- **Security**: already built — store-scoped (404 not 403), `register:admin` required for
  void/reopen-count/policy changes, denomination totals always server-computed (a
  client-supplied total is refused, closing the exact "a number the screen computes and asks
  you to retype is not a control" finding).
- **Testing**: `qa/register_probe.py` (104/104) already covers the backend; add a
  `hw-register.js` UI-integration test plus the missing `reopenCount` client function.
- **Owner decision**: none.

#### PC2 — Tie register close-out to Blaze's closing receipt
- **What the user gets**: instead of the count/expected/variance figures being entirely
  self-contained, a manager can see Blaze's own printed closing total alongside ours, for
  stores that still run Blaze as the register.
- **Data**: needs a Blaze READ adapter (closing-receipt totals) — no such adapter exists in
  wm-demo today. `pos_card_total_known`/`pos_card_count_known` presence-tracking (from the old
  Airtable model) was deliberately not carried over — this card should re-introduce that "blank
  is not zero" discipline once the Blaze read path exists.
- **API routes**: new `/api/register/{id}/blaze-reconcile`.
- **UI**: an addition to the variance screen (once built, see #9 in the scoreboard).
- **Dependencies**: a Blaze API adapter — check first whether one already exists elsewhere in
  the estate (Bounty's own Blaze sync, `BOUNTY-STATUS.md`, already polls Blaze every 5 minutes
  for sales data) before building a second one. **This is exactly the estate's duplicate-fetch
  rule (CLAUDE.md §4.8) — verify Bounty's existing Blaze adapter's params before reusing it**;
  it currently pulls sales exports, not closing-drawer totals, so it may be the same endpoint
  family with a different report type, or a genuinely different question.
- **Security**: a second, vendor-sourced number feeding a reconciliation view is not itself
  authoritative — never let a Blaze-reported figure silently override the locally-computed
  `variance_cents`; surface both, flag disagreement, let a human decide (same "never-block"
  philosophy already built into D1's variance rule).
- **Testing**: a probe against a stubbed Blaze closing-receipt response.
- **Owner decision**: #6 below (does Blaze's number become authoritative, or stay a
  cross-check?).

#### PC3 — Credit Card Fee Settings screen
- **What the user gets**: per-store configuration of a card-processing fee, mirroring the
  production admin's own settings screen.
- **Data**: no dedicated production model found for this (grepped — likely a field on
  `PaymentSetting.js`, not itemized this pass). wm-demo already has a flat `CARD_FEE_CENTS`
  constant (`pricing.py`, proven at $3.50/card order in `qa/pricing_probe.py` PR-2) — this card
  is "make it a per-store setting," the same shape of upgrade Tax already went through (flat
  constant → real table).
- **API routes**: new `/api/settings/card-fee`.
- **UI**: small settings screen or a Home-card panel.
- **Dependencies**: none.
- **Security**: `settings:admin`-scoped write; a fee change is money-adjacent — append-only
  history the same way tax rates are (never edit in place, close-and-replace).
- **Testing**: extend `qa/pricing_probe.py`.
- **Owner decision**: is a flat per-store fee enough, or does it need the vendor's
  card-brand-specific breakdown? (Ask before building — the production screen's exact field set
  wasn't read this pass.)

#### PC4 — Payment gateway settings (NMI) admin screen
- **What the user gets**: per-store payment-processor credentials/mode (test/live) configurable
  in the new admin, mirroring `PaymentSetting.js` (hemp/stilo, near-identical, NMI gateway
  fields: `paymentClientId`, `paymentSecretId`, `paymentMode`).
- **Data**: new `payment_settings(store_id, gateway, client_id, secret_id_ref, mode)` table —
  **never store the secret itself in this table**, only a reference to wherever real secrets
  live (env/secrets manager); this is explicitly one of the security-baseline rules in §5.
- **API routes**: new `/api/settings/payment-gateway`.
- **UI**: settings screen, `settings:admin`-scoped.
- **Dependencies**: a secrets-manager decision (this can't ship against plain env vars per
  store the way a single-tenant deployment does — multi-store secrets need a real vault).
- **Security**: this is the single highest-blast-radius settings card in this whole plan — a
  leaked payment credential is a direct financial exposure. A refuter must specifically try:
  reading the settings row as a `settings:read`-only principal and confirming the secret
  reference (not the secret) is all that comes back; and confirming no log line anywhere
  emits the raw secret during a save.
- **Testing**: a dedicated probe with an adversarial "read this row with every scope except
  admin" matrix.
- **Owner decision**: which secrets manager (AWS Secrets Manager, given the D5/D6 AWS/Postgres
  decision already made, is the natural choice) — recommend deciding this alongside the AWS
  cutover work (Phase 4), not before.

#### PC5 — Roll-combination float-recommendation solver
- **What the user gets**: "here's how to break tomorrow's float from today's take" — a nicety,
  not a control.
- **Data**: the GAS `RetailFloatPlan.gs` DP-solve logic is portable per `docs/REGISTER.md`'s own
  note; it answers a different question (float composition) from what's built (was today's
  drawer balanced), so it was deliberately not carried over.
- **Dependencies**: PC1 (register UI) should ship first — this is additive to it.
- **Security**: none beyond existing register scopes.
- **Testing**: port the GAS algorithm's own test cases.
- **Owner decision**: is this worth building at all, or does a manager doing this by hand
  remain fine? Recommend deferring — flagged as optional in the scoreboard.

---

### 2.8 Tax and compliance (incl. Metrc)

#### T1 — Confirm real per-store tax rates and turn on `WM_TAX_TABLE`
- **What the user gets**: the register actually charges the real tax rate instead of the
  hardcoded 2.22%/15%/6% constants in `pos/data.jsx:428-438`.
- **Data**: `wmdemo/tax.py`'s `tax_rates` table is built and tested (81 checks); it ships with
  **no seed data on purpose** — every row must be entered as a real, confirmed rate.
- **API routes**: `POST /api/tax/rates` (exists).
- **UI**: none required to turn the flag on — this is a data-entry + flag-flip task, though
  T2 (the screen) makes data entry sane instead of a raw API call.
- **Dependencies**: the owner must supply five real numbers per store (state excise, state
  sales, local cannabis business tax, whether medical exemptions apply, whether a federal tier
  is real) — see `docs/TAX.md`'s own "JT must confirm" list.
- **Security**: already hardened — `is_cannabis`/`category`/`member_type` are all
  server-resolved from the product/customer record, never a request-body claim (this closed a
  CRITICAL finding where a `tax:read`-scoped caller could zero out cannabis tax by claiming
  `is_cannabis: false`). Rate history is append-only; overlapping same-slot rates are refused.
- **Testing**: `qa/tax_probe.py` (81/81) already covers this; the go-live gate is a manual
  side-by-side of the old flat-constant total vs. the new table's total on a handful of real
  carts, signed off by the owner before flipping the flag in production.
- **Owner decision**: #1, #2, #3 below.

#### T2 — Tax operator-visible screen
- **What the user gets**: someone can look up and manage tax rates without an API call —
  closes the live-audit's own finding that **no admin anywhere, Hyperwolf or Blaze, has ever
  shown a tax screen** (§3 "Tax (both admins)").
- **Data**: `GET/POST /api/tax/rates`, `GET /api/tax/audit` all exist.
- **UI**: net-new screen, `settings`-adjacent. **Four concepts required.**
- **Dependencies**: T1 (needs real rates to be meaningful, though the screen itself can be
  built against EXAMPLE rows first).
- **Security**: `tax:admin` write, `tax:read` read; rate history already append-only.
- **Testing**: `qa/tax_probe.py` covers the API; add a UI smoke test.
- **Owner decision**: none beyond T1's.

#### T3 — Metrc integration (seed-to-sale compliance)
- **What the user gets**: package/sale/item/strain tracking and compliance sync/discrepancy
  handling, matching Blaze's own extensive Metrc-family screens (Packages, Sales, Items,
  Strains, Category, Available Metrc Tags, Retail Deliveries, Compliance Difference/Task
  Manager/Pending Transactions/Transfers/Sync Jobs/Issues — 10+ distinct screens in Blaze
  alone) and the production admin's own `hyperwolf-super-admin/src/layouts/Metrc/*`.
- **Data**: **no Metrc API client and no Metrc-specific persisted model exist anywhere in
  wm-demo today.** Production itself has no dedicated Metrc Mongoose model either — Metrc data
  is fetched live via `stilo-backend/controllers/metrc-controllers.js` and folded into the Tax
  model, not stored as its own schema. wm-demo's own `inventory.py` has exactly one Metrc-shaped
  field today: `batch_meta.metrc_tag`, a free-text column with no API behind it.
- **API routes**: entirely new — this is the single largest gap in this whole plan.
- **UI**: multiple new screens (Packages, Sales, Items, Strains, Compliance queue at minimum).
  **Four concepts required per new screen**, or at minimum per screen family.
- **Dependencies**: a Metrc API account/credentials (state-issued, per-license) — this is a
  regulatory integration, not an internal build choice.
- **Security**: this is a **compliance-critical** integration — a wrong or missing Metrc report
  is a licensing risk, not just a bug. Every write to Metrc needs an append-only local audit
  row independent of Metrc's own record (so a dispute doesn't rely solely on the state's
  system), and every read needs to be store/license-scoped (a multi-license operator must never
  see another license's package data through a shared credential).
- **Testing**: this needs its own probe suite from scratch, plus (given the compliance stakes)
  a manual reconciliation against a real Metrc sandbox account before go-live, not just unit
  tests against a stub.
- **Owner decision**: #7 below (sequencing — this is large enough that it likely needs to be
  its own mini-program, not a card squeezed into a phase; see §3).

#### T4 — Loss Prevention: Discrepancy Management / Waste Inventory
- **What the user gets**: the production admin's separate inventory-shrink workflow (Product
  Name/SKU, Sub Category, Brand, Weight, Batch, Scanned Qty, Discrepancy Type — for
  approvals/rejections, and a parallel Waste log) — **distinct from the cash-variance LP module
  already built** (that one handles register/drawer discrepancies; this one handles physical
  inventory shrink/waste).
- **Data**: no equivalent model exists in wm-demo. This likely wants to live near
  `wmdemo/inventory.py`'s movement/count family (a discrepancy is a count that didn't match,
  same as a register variance is a count that didn't match cash) rather than in `wmdemo/lp/`,
  which is scoped to cash/HR incidents specifically.
- **API routes**: new `/api/inventory/discrepancy/*`, `/api/inventory/waste/*`.
- **UI**: two new screens (or tabs on one). **Four concepts required.**
- **Dependencies**: T3 (Metrc) is a natural neighbor — waste/discrepancy reporting is often a
  regulatory requirement too (product must be accounted for from seed to disposal) — sequence
  these together if Metrc lands first.
- **Security**: shrink/waste data can reveal theft patterns — same visibility-tiering precedent
  as the cash-variance LP module (`lp:read`/`hr:read` split) should apply here too; a refuter
  should try reading another store's discrepancy history through a store-restricted key.
- **Testing**: new probe suite, `qa/discrepancy_probe.py`.
- **Owner decision**: does this need to feed the write-up ladder the way cash variance and
  timesheet violations both already do (i.e., is chronic shrink an attendance/accuracy-style
  disciplinary signal)? Recommend yes, by analogy, but this is a real people-policy question,
  not a mechanic — escalate rather than assume.

---

### 2.9 Reporting

#### R1 — Reports screen
- **What the user gets**: the 12 already-built, already-tested Blaze-parity reports (Sales
  Summary, by Product/Category/Brand/Employee, Cancelation & Void, Discounts & Promotions, Cash
  Drawer, Inventory Movements/Valuation, Tax Collected, Profit & Loss) become visible without an
  API call.
- **Data**: `wmdemo/reports.py`'s `REPORTS` registry — fully built, 71+20 checks, CSV export
  with formula-injection guarding already in place.
- **API routes**: `GET /api/reports`, `GET /api/reports/{name}`, `GET /api/reports/{name}.csv` —
  all exist.
- **UI**: net-new screen. **Four concepts required.** `shared/hw-reports.js` is the client
  layer, already built, explicitly waiting on a screen (its own docstring: "a future Reports
  screen calls it the way `pos/screen-floor-restock.jsx` calls `shared/hw-restock.js`").
- **Dependencies**: none — this is purely a UI build on a finished backend, the single
  highest-value/lowest-risk card in this entire plan.
- **Security**: `reports:read` base scope, `reports:pii` additionally required for the Employee
  Activity report (has employee names), `reports:export` additionally required for CSV
  download. All three already enforced server-side — the screen just needs to hide/disable
  controls a given login can't use, not re-implement the gate.
- **Testing**: `qa/reports_probe.py` (71 checks) already covers correctness; add a UI-level
  smoke test per report type.
- **Owner decision**: none — build this first (see §3).

#### R2 — Delivery Sales Report
- **What the user gets**: a sales report scoped to delivery orders specifically, matching
  Blaze's own named report.
- **Data**: this ledger (`inc_txns`/`inc_lines`) is in-store POS only; Weedmaps delivery orders
  live in `wmdemo/store.py`'s separate `orders` table — a join this pass did not attempt.
- **API routes**: new report entry in `wmdemo/reports.REPORTS`.
- **UI**: appears automatically in R1's screen once built (same registry-driven pattern).
- **Dependencies**: R1.
- **Security**: same `reports:read` gate as every other report.
- **Testing**: extend `qa/reports_probe.py`.
- **Owner decision**: none.

#### R3 — Employee × Product cross-report
- **What the user gets**: "who sold what" — a two-axis cross of the existing Sales-by-Employee
  and Sales-by-Product reports.
- **Data**: same ledger as every other sales report; this is a query-shape addition, not new
  data.
- **Dependencies**: R1.
- **Security**: `reports:pii` (it names employees), same as Sales by Employee.
- **Owner decision**: none — deferred in the original build only for time, per `REPORTS.md`'s
  own "Not built this pass" note; build when a manager actually asks, per that note's own
  framing.

#### R4 — Export Product Batch tool
- **What the user gets**: a catalogue/inventory export, distinct from the sales/financial
  reports — arguably belongs next to Inventory Valuation.
- **Dependencies**: R1's registry pattern.
- **Owner decision**: none.

#### R5 — Real COGS source of truth for Profit & Loss
- **What the user gets**: the P&L report (and, per O3, the POS's own margin figures) stop being
  honestly-flagged estimates and become real numbers.
- **Data**: `unit_cost_cents` lives only on `wmdemo/inventory.py`'s `batch_meta` table (from
  Hyperdrive's own batch-receiving flow) and is unpopulated for most real sales, because
  `inc_lines` (the register ledger) doesn't carry a `sku` on most posts, and Blaze's own
  per-item cost isn't synced anywhere.
- **Dependencies**: two candidate fixes, either (a) require `sku` on every register post and
  backfill `batch_meta.unit_cost_cents` for the real catalogue, or (b) pull per-item cost
  directly from Blaze's product/batch API — see owner decision #8.
- **Security**: cost data is commercially sensitive (margin exposure) — scope it no more
  broadly than the P&L report itself already is.
- **Testing**: `qa/reports_probe.py`'s existing P&L assertions already prove the arithmetic is
  honest about its own gaps (`unpriced_lines` counted, never hidden) — once real data flows in,
  re-run against a period with known real COGS and confirm to the cent.
- **Owner decision**: #8 below.

---

### 2.10 Staff and permissions

#### S1 — Roles & Permissions admin screen + real per-operator RBAC
- **What the user gets**: each staff login is its own account with its own permissions,
  instead of every console operator sharing one write-token (or, since D2, one improved-but-
  still-not-fully-personal session model).
- **Data**: `authz.SESSION_SCOPES`/`route_policy.py` already model scopes richly (per-route,
  per-action); what's missing is a real user-account layer that maps a real person to a subset
  of those scopes, plus a UI to manage that mapping. Production reference:
  `hemp-backend/models/RoleAndPermissions.js` (nested role/platform/permission arrays) and
  `UserRolesPermissions.js` (a flatter, **competing** shape in the same repo) — even production
  hasn't settled on one RBAC shape; don't copy either verbatim.
- **API routes**: new `/api/staff/*` (accounts), `/api/roles/*` (role definitions).
- **UI**: net-new screen. **Four concepts required.**
- **Dependencies**: this is the natural next step after D2 (per-operator sessions, already
  built) — D2 built the mechanism (a session can carry restricted scopes); this card builds the
  *management* of who gets which scopes.
- **Security**: this IS the security model for everything else in this plan — get it wrong and
  every other card's scope check is only as good as who holds which key. A refuter's job here
  is adversarial by definition: try granting a role no scopes and confirm it truly can do
  nothing; try revoking a role mid-session and confirm the next request (not just the next
  login) is refused.
- **Testing**: a dedicated, adversarial-first probe suite — this is the one card in this plan
  where "write the happy path, then refute" is backwards; write the refusal cases first.
- **Owner decision**: none blocking design, but this is large enough (L) that it should be
  staffed with a security-literate reviewer, not a cheap-model agent alone.

#### S2 — HR Overview / employee directory screen
- **What the user gets**: a real employee directory (roster, compliance/doc-expiry status,
  incidents, call-offs) — the read-only backend (`wmdemo/hr/api.py`, 5 routes, PII deliberately
  excluded from every response) is already built and PII-clean.
- **Data**: `GET /api/hr/employees[/{id}]`, `/compliance/expiring`, `/incidents`, `/calloffs` —
  all exist.
- **UI**: net-new screen. **Four concepts already drafted** per the morning packet ("HR
  Overview... Review rounds are live").
- **Dependencies**: none technical.
- **Security**: read-only by design (`hr:read`); this module deliberately carries no SSN/DL/
  bank fields — do not add a "quick view" that reaches into a different table to backfill them.
- **Testing**: existing HR probe suite covers the API; add a UI smoke test for the chosen
  concept.
- **Owner decision**: #5 below (which concept — grouped with the other three concept-picks).

#### S3 — LP Triage screen
- **What the user gets**: a real screen for the already-built LP case state machine (110
  checks) — currently API-only.
- **Data**: `/api/lp/*` — fully built.
- **UI**: net-new screen. **Four concepts already drafted.**
- **Dependencies**: none technical.
- **Security**: the two-tier visibility filter (restricted vs. full, based on `hr:read` vs
  `lp:admin`) is already built server-side — the screen must respect whichever tier the logged-
  in session actually has, never assume full tier client-side.
- **Testing**: existing `qa/lp_probe.py` (110 checks) covers the API.
- **Owner decision**: #5 below.

#### S4 — Write-up signing page wiring
- **What the user gets**: an employee's signature link actually opens the right page and
  submits to the right route — today it does neither correctly.
- **Data**: no schema change.
- **API routes**: `POST /api/writeups/{id}/sign` already exists and works; two wiring bugs
  block reaching it: (1) `wmdemo/writeups/send.py` builds the recipient URL as
  `/writeups/sign?token=...`, a path nothing in this estate serves — the correct form is
  `<POS-Admin origin>/sign.html#<token>`; (2) `POS-Admin/sign.html`'s current submit call always
  posts to `/api/forms/onb_ack_sign/submit` regardless of purpose, which 403s for a
  `writeups:sign` link.
- **UI**: `shared/hw-sign-page.jsx` needs a dedicated `HWLinkClient.sign(...)` call for
  `subject_kind === "writeup"`, reading the richer `resolve()` payload (level/date/summary/ack
  text) instead of generic house copy.
- **Dependencies**: none — both fixes are small and independent.
- **Security**: already hardened — binding-before-existence closes an ID-enumeration oracle (a
  wrong write-up id and a wrong-subject link now both return an identical 403, not a
  distinguishable 404), single-use claim happens before the write, not after.
- **Testing**: `qa/writeups_probe.py`/`qa/signed_links_probe.py` already cover the backend;
  add an end-to-end test that follows a real minted link through the real page.
- **Owner decision**: none.

#### S5 — Confirm two unverified assumptions before they matter
- **What the user gets**: nothing directly — this is a verification task that de-risks S2/T3-
  adjacent work.
- Two specific items: (1) `PM`/`AHC`'s Airtable `entity_slug` (`pleasure-med`/`alternate-health`)
  is unconfirmed against a live Airtable read — `highest-craft`/`circle-city` are directly
  grepped from real fixtures, the other two are not; (2) `connecteam.shift_note()`'s write shape
  (`PATCH .../shifts/{id}` with `{"notes":[{"type":"text","html":...}]}`) is inferred from a
  READ-only code path elsewhere in the estate and has never been confirmed against a real
  Connecteam response.
- **Dependencies**: neither blocks anything already built, but both should be confirmed before
  Timesheet Tier-2 messaging or any Connecteam-writing feature goes live for PM/AHC entities.
- **Owner decision**: neither is a real decision — both are "go check," assignable to whoever
  has Airtable/Connecteam access.

---

### 2.11 Settings and integrations

#### SI1 — Shop/Company settings screen
- **What the user gets**: the ~70 operational toggles Blaze's own Shop/Company Information
  screens expose (cash round-off, purchase floor, age limits, enforce-drawer-for-sales,
  enforce-blind-counts, restricted views, terminal sales allocation, queue management,
  dispatch auto-assign-by-region) become configurable in the new admin.
- **Data**: some of these already have a real backing field (`register_policy`'s
  `require_drawer_for_sales`/`blind_counts` are two of the ~70, already built). The rest need a
  general-purpose `store_settings(store_id, key, value)` table rather than 68 more one-off
  columns.
- **API routes**: `GET/POST /api/settings/{store_id}`.
- **UI**: net-new, large screen (or several tabs). Given its size, treat each toggle GROUP
  (cash handling, age/compliance, dispatch, queue management) as its own build unit within one
  screen, not one giant form.
- **Dependencies**: none blocking, but this is large (L) — sequence after the higher-value
  Reports/Register/Tax UI cards.
- **Security**: several of these toggles ARE security controls (enforce-blind-counts,
  restricted-views) — changing them should itself be audited (who turned off blind counts, and
  when) the same way a tax-rate close is audited.
- **Testing**: a probe per toggle group, following `register.py`'s own policy-toggle pattern.
- **Owner decision**: none for the build; the two toggles already built (blind_counts,
  require_drawer_for_sales) have their OWN owner decision already on record — see §4 item 9.

#### SI2 — Google SSO + audit table
- **What the user gets**: staff log into the new admin with their real Google account instead
  of a shared token; every login is audited.
- **Data**: new `login_audit(user_email, at, ip, outcome)` table.
- **Dependencies**: this is an explicit AWS Phase 1 gating requirement per
  `PLATFORM-AND-CUTOVER-PLAN-2026-09-16.md` §7/§8 — it does not have to wait for AWS
  infrastructure itself, but it is on that phase's own exit checklist.
- **Security**: this is core authentication — a refuter should confirm a revoked Google account
  is refused on its very next request, not just its next login, and that the audit table itself
  is append-only (no one can quietly edit their own login history).
- **Testing**: dedicated probe against a stubbed OAuth provider.
- **Owner decision**: none — already implied by the D5 (AWS) decision; this is one of its
  concrete prerequisites.

#### SI3 — Strict route-policy mode, to 100%
- **What the user gets**: nothing visible — this is the difference between "every route is
  explicitly declared safe or refused" and "an unregistered route defaults to a warning log,"
  which is the current state for the deliberately-excluded inventory/idv families.
- **Data**: no schema change.
- **Dependencies**: I2 (Cycle Counts screen) touches exactly the family currently excluded from
  strict mode — resolve the inventory-family registration question (see `docs/SECURITY-GATE.md`
  "Deliberately NOT registered") before or alongside I2, not after.
- **Security**: this IS a security card — registering the remaining ~14 uncovered path
  literals and flipping `WM_ROUTE_POLICY_STRICT=1` estate-wide closes the last "some routes are
  warn-only" gap. A refuter's job: confirm every currently-excluded route either gets a
  compatible registration or a documented, deliberate reason it can't (the inventory family
  already has one — extend that same rigor to whatever's left).
- **Testing**: `qa/security_gate_probe.py`'s own registry-wide walk is the acceptance test —
  it should report 100% coverage with zero `SG-input-overpost-*` fails once this and the
  remaining overpost-hardening items (7 currently red, all explained, in `docs/SECURITY-GATE.md`)
  are closed.
- **Owner decision**: none — this is "finish what's already 87% done," not a design question.

#### SI4 — AWS/Postgres cutover execution
- **What the user gets**: the platform runs on real infrastructure (AWS, managed Postgres,
  automated backups with a proven restore drill) instead of a single SQLite file on a free-tier
  Render instance that spins down after inactivity.
- **Data**: the foundational work is already BUILT (Track 4: AWS CDK — 5 stacks, 51 assertions;
  container image; Postgres schema + data export covering 125 tables; a TypeScript strangler
  kit with a first ported module — promotion rules, 48/48 goldens).
- **Dependencies**: **an AWS account** — this is explicitly an owner action, not a code gap.
- **Security**: this phase's own exit criteria (per the cutover plan) already require the
  restore drill to pass and the security-gate probe to be green in strict mode before
  proceeding — do not skip that gate to hit a deadline.
- **Testing**: the restore drill itself is the test.
- **Owner decision**: none beyond providing the account — already decided (D5/D6/D7/D8) per
  `PLATFORM-AND-CUTOVER-PLAN-2026-09-16.md` §8.

#### SI5 — Blaze read adapter (shared plumbing)
- **What the user gets**: nothing directly — this is infrastructure two other cards (PC2, and
  potentially R5/O3's COGS source) both need.
- **Dependencies**: check `wm-demo`'s own Bounty module first — it already polls Blaze's API
  every 5 minutes for sales export data (`BOUNTY-STATUS.md`). Before building a second Blaze
  adapter, verify whether Bounty's existing one can be extended (different report type, same
  auth/endpoint family) or whether closing-drawer-totals and per-item-cost genuinely need a
  different call — **per the estate's duplicate-fetch rule, this verification is required, not
  optional**, before writing new Blaze integration code.
- **Owner decision**: none — this is a "go check first" item, assign it before PC2 or R5(b)
  starts.

#### SI6 — Storefront redesign: locate the files
- **What the user gets**: nothing directly — the morning packet itself flagged "I could not
  find the redesigned UI files; point me at them" as an open item.
- **Owner decision**: #9 below — this blocks nothing else in this plan, but it's a real,
  outstanding question with no code-side answer.

---

### 2.12 Notifications

#### N1 — Member-facing notifications
- **What the user gets**: customers receive order-status/promo notifications — today the
  entire outbound system (Discord/Connecteam/email/webhook, fully built and tested) is
  staff-facing only (call-offs, write-ups, timesheet violations, LP driver responses).
- **Data**: `wmdemo/outbound/*` already has the queue, retry/backoff, dedupe, and SSRF
  discipline built — this card is "point it at customers too," which mostly means wiring
  Engage's own messaging (CL3) to real order/promo events, not building new plumbing.
- **API routes**: reuse `outbound.enqueue()`.
- **Dependencies**: CL3 (real messaging provider keys) — this can't go live without those.
- **Security**: customer-facing sends need consent-checking on every send (Engage's own
  `consent.check()` already exists and is proven — STOP via inbound SMS genuinely blocks the
  next send). A refuter should confirm a STOP is honored across BOTH channels (SMS and email),
  not just the one it arrived on.
- **Testing**: extend `qa/engage_api_probe.py`'s consent tests to cover order/promo triggers.
- **Owner decision**: which events warrant a customer notification (order ready? promo
  launched? both?) — a product decision, not a technical one.

#### N2 — Centralized Banner Management / Product Carousels
- **What the user gets**: the production admin's own customer-facing content management
  (banners, product carousels) becomes available in the new admin.
- **Data**: no equivalent exists in wm-demo. Needs its own small content model
  (`banners(id, image_ref, link, active_from, active_to, placement)`).
- **API routes**: new `/api/content/banners`, `/api/content/carousels`.
- **UI**: a settings-adjacent screen. **Four concepts required.**
- **Dependencies**: none blocking; low priority (customer storefront polish, not an operator
  pain point).
- **Security**: `catalog:write`-adjacent scope; image uploads need the same allowlist/byte-
  sniffing discipline Bounty's own media upload already proved out (`BOUNTY-STATUS.md`'s
  "media allowlist with byte sniffing and nosniff").
- **Testing**: new small probe suite.
- **Owner decision**: low priority — sequence last (Phase 3+).

#### N3 — Outbound provider credentials on Render
- **What the user gets**: real Discord/Connecteam/email/Airtable sends instead of everything
  answering 503 or recording a failed job run.
- **Data**: no code change — `HW_DISCORD_WEBHOOK_*`, `HW_CONNECTEAM_API_KEY_<COMPANY>`,
  `HW_AIRTABLE_KEY`, `HW_EMAIL_API_KEY`, `WM_DEMO_ADMIN_TOKEN` all need to be set.
- **Dependencies**: none technical — pure owner action, already flagged in the morning packet
  §3 item 1 as the single most urgent "needs you."
- **Owner decision**: none — just do it. This is the cheapest, highest-leverage single action
  in this entire plan: without `WM_DEMO_ADMIN_TOKEN`, admin console sessions (the whole D2
  per-operator security improvement) cannot exist at all yet.

---

## 3. Order of work

**Rationale for the shape of this ordering**: (1) don't rebuild what's already built — every
phase below assumes the BUILT items in §1 stay built and only need wiring/data/decisions; (2)
unblock stores first — Register/Tax/Reports UI wiring (Phase 1) turns already-tested backends
into something a floor manager can actually use, with almost no new backend risk; (3) the AWS
cutover (Phase 4) has its own hard prerequisites (Google SSO, strict route policy, a restore
drill) that are cheap to do now and expensive to retrofit later, so they're pulled forward
into Phase 1–2 rather than parked at the end; (4) Metrc (T3) and full RBAC (S1) are both large
enough and different enough in kind (regulatory integration; security-critical redesign) that
they get their own phase rather than being squeezed alongside UI-wiring work.

**Parallel-safety note for the PM**: cards in the same phase that touch *different* files can
run concurrently on cheap-model agents. Cards that touch the *same* file must not — see the
file list after each phase.

### Phase 0 — Owner actions (no agent time, do first, unblocks everything)
- N3 (env vars on Render) — unblocks admin sessions, backups, HR reads, Connecteam, Discord.
- Owner decisions #1–#3 (real tax rates) — unblocks T1.
- Owner decision #4 (loyalty ladder) — unblocks CL1.
- Owner decision #5 (four concept picks) — unblocks R1/D1/S2/S3/T2/P1's UI builds.

### Phase 1 — Wire the built backends to a screen (store-facing, low risk)
Cards: R1 (Reports screen), PC1 (Register UI wiring), T1+T2 (Tax rates + screen), D1 (Region
screen), CL2 (Members real data), CL1 (Rewards wiring, once #4 decided), S2 (HR Overview), S3
(LP Triage), S4 (write-up signing fix), P1 (Promotions screen, once P2 at least decided), SI2
(Google SSO), SI3 (strict route-policy finish).

Files touched (for PM scheduling — these do NOT overlap, safe to run all in parallel):
`pos/screen-reports.jsx` (new), `shared/hw-reports.js` (read-only reference), Home-card
integration for register (`pos/screen-home.jsx` + `shared/hw-register.js`), a new
`pos/screen-tax.jsx`, a new `pos/screen-regions.jsx`, `pos/screen-stubs.jsx` (Members —
**note**: S2/S3 are new files, do not touch this one), `pos/screen-hr-overview.jsx` (new),
`pos/screen-lp-triage.jsx` (new), `POS-Admin/sign.html` + `shared/hw-sign-page.jsx` (S4 only),
`pos/screen-promotions.jsx` (new). `wmdemo/authz.py`/`sessions.py` (SI2) should NOT be touched
by any other Phase-1 card at the same time — it was already flagged mid-build as a
concurrent-edit hazard once this cycle; keep that discipline.

### Phase 2 — Domain completion (compliance, catalog depth, loyalty/promo consolidation)
Cards: T3 (Metrc — start early, it's the longest), T4 (Discrepancy/Waste), C1 (Shells Phase 2),
C2 (Distribution UI), C3 (Aging screen), I1 (pars), I2 (Cycle Counts), P2 (engine reconciliation
— should have been *decided* in Phase 0/1, executed here), P3 (bundle/points), R2–R5 (remaining
reports + COGS decision), SI1 (Shop settings), CL3–CL4 (messaging live, Alpine cutover).

Rationale for grouping: these are the "make the built platform match the full breadth of what
Blaze/production admin already do" items — necessary before cutover, but none of them block
Phase 1's store-facing wins.

### Phase 3 — Cross-system reconciliation (needs another system's data)
Cards: PC2 (Blaze closing-receipt tie-in), SI5 (Blaze read adapter — do this FIRST within this
phase, PC2 depends on it), O1 (delivery ETA/maps), D2 (driver-mgmt/delivery-ops GAS port), D3
(Onfleet scoreboard port), O2 (Weedmaps orders-scope — track, don't build, it's a vendor ask),
PC5 (float solver, optional), N1 (member notifications), N2 (banners/carousels, low priority).

### Phase 4 — Platform cutover (AWS/Postgres/security-critical)
Cards: S1 (Roles & Permissions/full RBAC — do this HERE, not earlier, because AWS's own Google
SSO work in Phase 1 is a prerequisite for it), SI4 (AWS/Postgres execution — needs the account,
which is an owner action that can happen any time; the ENGINEERING work of executing the
already-built Track 4 artifacts belongs here), PC4 (payment gateway settings — sequence with
SI4's secrets-manager decision).

Everything in Phase 4 is either genuinely large (S1, SI4) or depends on a decision/account this
plan cannot manufacture — this phase is where "buildable" gives way to "waits on the owner and
on infrastructure," which is honest, not a stall.

---

## 4. Owner decisions

1. **Are the real per-store tax rates (state excise, state sales, local cannabis business tax,
   per store) ready to hand over?** Recommend: yes, provide them now — `WM_TAX_TABLE` cannot go
   live without them and everything else in the Tax card is already built and waiting.
2. **Do medical-member exemptions apply at any Hyperwolf store?** Recommend: assume no until
   told otherwise — the schema already supports it as data (no code change needed either way),
   so saying "no" costs nothing and saying "yes" just means entering more rate rows later.
3. **Is the federal tax tier (`kind: "other"`) a real requirement, or vendor-only cruft never
   actually used?** Recommend: treat as unused — the production schema field has no controller
   reference beyond its own existence.
4. **Which loyalty tier ladder is the real one** — the register's, the consumer app's, this
   Engage draft's, or the contract doc's (four different, currently-live definitions)?
   Recommend: pick the Engage draft's shape now, since it's the one with real, tested CRUD
   already built (`loy_tiers`/`loy_ledger`) — the other three would each need their own new
   build.
5. **Which of the four drafted UI concepts wins**, for each of: the promotions rule builder, HR
   Overview, LP Triage, and Refill Day? Recommend: the team's own stated lean (B's kit column +
   D's box panel, per the morning packet) for Refill Day; the other three await your own
   review at `/explorations/review/`.
6. **Should Blaze's printed closing receipt become the register close-out's ground truth, or
   should wm-demo's own counted/expected/variance stay authoritative?** Recommend: keep ours
   authoritative, surface Blaze's number as a cross-check only, for stores still running Blaze
   registers — a second, vendor-sourced number should never silently override a locally
   server-computed one.
7. **How should Metrc integration be staffed and sequenced** — as one more card in Phase 2, or
   as its own dedicated mini-program given its regulatory stakes and size? Recommend: its own
   mini-program, kicked off in parallel with Phase 2 rather than waiting for Phase 2 to reach
   it in order, given how long a real state-integration credentialing process typically takes.
8. **Real COGS source of truth for Profit & Loss and on-screen margin figures**: (a) require a
   `sku` on every register post and backfill `batch_meta.unit_cost_cents` from the real
   catalogue, or (b) pull per-item cost directly from Blaze's own product/batch API? Recommend
   (a) — it's the smaller, one-time lift and doesn't create an ongoing dependency on a Blaze
   read path for every report render.
9. **Should blind cash counts default ON for any store with more than one register operator?**
   (This was already recommended by the build team on 2026-09-17 and you kept the estate-wide
   default OFF at the time — re-flagging here only because this plan's per-store settings
   screen (SI1) will make that per-store choice visible for the first time; confirm the default
   still stands.) Recommend: leave as previously decided (OFF estate-wide, ON per-store as an
   owner-configurable default going forward via SI1).
10. **Where are the redesigned storefront UI files** the morning packet couldn't locate?
    Recommend: point the build team at them directly, or confirm none exist yet and this is
    future scope, not a lost asset.

---

## 5. Security baseline (applies to every card above, in addition to what each card states)

This is already how the built modules work — restated here as the standard every NEW card
must meet, not a new policy.

- **Per-user auth on every write.** No write route trusts a self-reported `actor`/`reviewer`/
  `by` body field for authorization — the write is bound to the AUTHENTICATED credential
  (session or API key), and a body field that disagrees is logged once as a warning, never
  trusted. (This exact bug — an agent key claiming `meta.source: "ui"` to bypass a draft-only
  rule — was found and fixed live in this build; treat it as a real, not theoretical, class of
  mistake.)
- **Contract validation on every input.** Every route rejects an unknown top-level (or nested,
  for the promotion-rule shape) body key with a 400 BEFORE touching the database — a schema
  a client didn't expect to be enforced is not a schema.
- **Store/entity scoping from the credential, never the body.** A restricted principal naming a
  store/entity outside its own set gets **404, never 403** — a restricted caller must never
  learn that something outside its scope even exists.
- **No secrets in code or responses.** Payment credentials, API keys, webhook secrets — never
  in a git-tracked file, never echoed back in a response body (a 403 names the missing scope,
  never the presented credential), never in a log line.
- **Signed, single-use links are claimed before the write, not consumed after it.** Two
  concurrent requests bearing the same single-use token must not both succeed — the atomic
  claim, not a post-write check, is what arbitrates.
- **Integer cents, always.** No money value is ever a float anywhere in this platform — tax
  rates are basis points, prices and totals are integer cents. A new card that introduces a
  dollar-and-cents float anywhere is a defect on sight.
- **Append-only audit for anything money- or discipline-adjacent.** Tax rate changes, register
  variance, LP case decisions, write-up approvals — none of these are ever edited in place; a
  change closes the old row and creates a new one, so a dispute can always be resolved from
  history, not from the current state alone.
- **Strict route registration.** Every `/api/` route is explicitly declared safe (with its own
  auth mode and scope) or explicitly refused — an unregistered route should 404 in strict mode,
  not silently pass through to old, ungated dispatch code. (Currently ~87% there — see SI3.)
- **The refute → fix → re-refute loop, for every card, not just the ones in this plan that
  already went through it.** Every BUILT item in §1 shipped with an adversarial pass that found
  and fixed at least one real hole (a client-controlled tax flag, a shared-scope token, a
  post-count drop laundering a shortfall, an unrestricted link-minting path). Treat that as the
  expected shape of the work, not an optional QA step: build it, then have someone try to break
  it the way an operator or an attacker actually would, then fix what they find, then check
  again.

---

*End of plan. Next update should happen the next time a build wave lands or an owner decision
above is answered — re-read this file's own §1 before assuming anything in it is still
accurate, the same discipline this plan itself had to apply to the two docs it started from.*
