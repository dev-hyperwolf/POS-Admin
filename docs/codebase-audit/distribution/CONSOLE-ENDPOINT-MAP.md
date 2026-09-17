# Floor Restock & Console Endpoint Audit
READ-ONLY CENSUS: wm-demo routes bound to Floor Restock controls and console components.
Generated 2026-09-16 | Scope: wm-demo HEAD (inventory_api.py, restock_engine.py)

---

## A. Floor Restock (Store - Concept A) — Control → Route

| Control (as on screen) | Route (METHOD path) | Handler file:line | Request fields | Response fields used | Auth today | Gap |
|---|---|---|---|---|---|---|
| **Scan shelf QR** (scanShelfBtn) | GET /api/inventory/locations | inventory_api.py:207–210 | kind, region_id, active | locations[], Location.id/name/code | read gate (x-hw-write-token) | No SELECT/FILTER by QR; client must manage location selection |
| **Manage shelf pars** | NO ROUTE | — | — | — | — | **MISSING** — mockup says "not built"; shelf Par editor does not exist |
| **Print restock slip** (printBtn) | GET /api/inventory/restock/slip | inventory_api.py:234–244 | store_id, shelf_location_id, since, kit (label), region (label), format (html\|text) | text/html body (printed pick slip) | read gate | Prints plan via pick_slip.py; calls plan_restock_for_store() internally |
| **Move to floor** (commitBtn) | POST /api/inventory/restock/apply | inventory_api.py:265–266 | plan (contract Plan), actor | movement records written, plan.approved_by/approved_at set | write gate (x-hw-write-token) | Re-derives plan server-side to cap give values; applies via inventory.py |
| Plan preview (loaded on shelf open) | GET /api/inventory/restock/preview | inventory_api.py:232–233 | store_id, shelf_location_id, since | plan (contract Plan: lines[], skipped[], warnings[]) | read gate | Calls plan_restock_for_store():626 in restock_engine.py |
| Batch details (per product row) | GET /api/inventory/batches | inventory_api.py:211–217 | sku | batches[], mixed (bool) | read gate | oldest_first(sku) from inventory.py; FEFO ordered |
| Read ≠ Expected (DRIFT flag) | GET /api/inventory/movements | inventory_api.py:218–221 | since, sku, location_id | movements[], Movement.qty/reason/actor | read gate | Current design shows read/expected per batch; movements log can reconstruct drift |
| RFID/hand count exception | POST /api/inventory/counts/{id}/rfid-read | inventory_api.py:261–262 | location_id, epcs, actor, station_id (opt) | lines, unknown, missing, foreign, read_id | write gate | RFID-first design (2026-09-10 revision); exception rows flagged for HAND count |

**Auth:** read gate = loopback only if no token configured; with token, must pass x-hw-write-token. write gate = x-hw-write-token always required.

---

## B. Console Common Ground — Component → Route

| Component | Purpose (from REFILL-CONCEPTS.md) | Route(s) | Handler file:line | Contract fields | Auth | Gap |
|---|---|---|---|---|---|---|
| **KitBoxTree** | Region → Kit → Boxes hierarchy selector | GET /api/inventory/locations | inventory_api.py:207–210 | kind=region\|kit\|box; parent_id links; region_id | read | No single "list tree" route; client must chase parent_id links or filter by kind |
| | | POST /api/inventory/locations | inventory_api.py:247–281 | create new location | write | Can create; no bulk load or tree import |
| **PlanPreviewTable** | sold · need · cap · will give · reason per line | GET /api/inventory/restock/preview | inventory_api.py:232–233 | plan.lines[]: product_id, batch_id, to_location_id, cap, give, reasons | read | Lines already built by plan_restock_for_store():626 |
| | | GET /api/inventory/received?day=YYYY-MM-DD | inventory_api.py:222–227 | received[]: product_id, quantity, batch_id, location_id, kind | read | Used to populate received ledger for "Send today" lane |
| **ReceivedLane** | received last 7 days + "Send today" button | GET /api/inventory/received?day=YYYY-MM-DD | inventory_api.py:222–227 | kind (received\|confirmed\|available), received_at | read | Caller must loop 7 days to build the lane; no "last N days" filter in API |
| | | POST /api/inventory/restock/apply (implied) | inventory_api.py:265–266 | Send today = commit a restock plan | write | "Send today" likely triggers a plan creation + apply flow (not explicit in mockup) |
| **StatusTimeline** | day's status per kit (built → pack → dispatch → refill → close) | NO ROUTE | — | — | — | **MISSING** — no status/event log API for restock lifecycle |
| **SkipsPanel** | skips and shortfalls with reasons | GET /api/inventory/restock/preview | inventory_api.py:232–233 | plan.skipped[]: product_id, to_location_id, cap, need, reasons | read | Plan.skipped[] already contains the data |
| **Manage box types** | Create/list/edit Box type definitions | NO ROUTE | — | — | — | **MISSING** — box types are static data; no API to manage them |

---

## C. distribution-engine Functions → Python Twin / Route

| JS Export (distribution-engine/index.js:tail -25) | Python Twin (restock_engine.py) | Route(s) | Live in API? |
|---|---|---|---|
| `businessDay(ts, tz)` | business_day(ts, tz=DEFAULT_TZ):101 | — | No public route; used internally by plan builders |
| `businessDayStart(bd_str, tz)` | business_day_start(bd_str, tz=DEFAULT_TZ):109 | — | No public route; used internally |
| `rotation(batches)` | rotation(batches):140 | — | No public route; called by plan_refill internally |
| `returnBaseline(sales, product_id, …)` | return_baseline(sales, product_id=None, …):309 | — | No public route; called by plan builders |
| `receivedLedger(received_items, plans)` | received_ledger(received_items, plans):502 | GET /api/inventory/received?day= | Partial: API returns received items per day; ReceivedLane component must call it |
| `planBuild(input)` | plan_refill(input):332 or plan_build(implied) | — | **NO ROUTE** for plan_build; plan_refill exported via contracts_api.py (NOT inventory_api.py) |
| `planRefill(input)` | plan_refill(input):332 | POST /api/inventory/refill/plan (implied, not in inventory_api.py) | **NO ROUTE** in inventory_api.py; likely in another file or unimplemented |
| `planRestock(input)` | plan_restock(input):431 | POST /api/inventory/restock/plan | ✓ inventory_api.py:264 |
| `planHandoff(input)` | — (not found in restock_engine.py) | — | **NOT FOUND** in Python codebase; JS-only? |
| `suggestMinMax(sales, days, …)` | suggest_min_max(sales, days, …):542 | — | No public route; called by build/refill planners |
| `explain(plan)` | explain(plan):600 | — | No public route; called server-side by pick_slip.py to annotate printed slip |

**Note:** `plan_restock_for_store()` at restock_engine.py:626 is a **convenience wrapper** — not exported by distribution-engine. It wraps `plan_restock()`:431.

---

## D. Proposed DEV-TEAM-CHANGE-LIST Items (numbered from 20)

**20. Shelf Par editor API** — The Floor Restock mockup says "Manage shelf pars" opens a par editor; the control is wired but the route does not exist. **Smallest change:** a GET /api/inventory/shelf-pars and PUT /api/inventory/shelf-pars/{location_id} pair to read/write par (par:int, updated_by, updated_at) for each Location. Attach to Floor Restock's "Manage shelf pars" link.

**21. StatusTimeline API** — The Verify round concepts include a "day's status per kit" timeline (built → pack → dispatch → refill → close, with who/when/result). No event log or status route exists. **Smallest change:** a GET /api/inventory/restock/events?since=&kit_id= that returns timestamped status transitions (kind:enum, kit_id, actor, at, detail) for every restock step. Used by StatusTimeline component and status/verification screens.

**22. Box types management API** — REFILL-CONCEPTS.md lists "Manage box types" as a shared component; the mockup has a stub. **Smallest change:** POST /api/inventory/box-types (create), GET /api/inventory/box-types (list), PUT /api/inventory/box-types/{id} (update). Box type schema: {id, name, category, capacity_units, active, region_id}.

**23. Received lane: last-N-days filter** — ReceivedLane shows "received last 7 days"; client currently must call GET /api/inventory/received?day=YYYY-MM-DD once per day to backfill. **Smallest change:** add an optional ?days=7 param to GET /api/inventory/received that returns all receipts in the last N days in a single call.

**24. Tree-walk for KitBoxTree** — Location hierarchy is parent_id linked; client must chase links. **Smallest change:** add GET /api/inventory/locations/tree?root_id=&kind= that returns a nested JSON tree of Locations with children[], or add a ?expand=tree param to the existing GET /api/inventory/locations to include children[].

**25. planHandoff export in Python** — distribution-engine exports `planHandoff(input)` but no Python twin exists in restock_engine.py. **Smallest change:** implement plan_handoff(input) in restock_engine.py following the shape of plan_refill/plan_restock (Handoff: region → kit → summary of pack/dispatch/return cycle), or clarify that Handoff is JS-only (tablet packing screen, no backend needed yet).

---

## E. Facts for the PM

- **Current restock endpoints:** 4 routes exist (2 GET, 2 POST): preview, slip, plan, apply. They map cleanly to Floor Restock's "load plan → print → commit" flow. ✓ READ
- **Missing shelf management:** Shelf Pars (target qty per product per shelf) are not writable via API. The "Manage shelf pars" button in the mockup is a stub. WARN
- **Received ledger is day-granular:** GET /api/inventory/received requires a ?day=YYYY-MM-DD param; ReceivedLane must loop 7 times. No pagination or range filter yet. INFERRED
- **RFID and hand-count exceptions are tracked:** RFID-first revision (2026-09-10) routes dead tags / untagged products through POST /api/inventory/counts/{id}/rfid-read with exception flags. ✓ READ
- **StatusTimeline has no source:** Verify concepts show a timeline of when each kit was built/packed/dispatched/refilled/returned; no event log exists yet. The plan data does not carry created_at/packed_at/dispatched_at timestamps. BLOCK until built. INFERRED
- **Box types are static data:** "Manage box types" in mockup points to a 🚫 stub; no CRUD API exists. The enum is hard-coded in schema or seed data (not verified). WARN
- **Plan re-derivation on apply:** POST /api/inventory/restock/apply re-computes the plan server-side and caps every posted `give` value. Prevents tampering; does not assume client plan is authoritative. ✓ READ
- **Authorization:** All routes enforce x-hw-write-token (write) or loopback+token (read). Reads are read-only in-memory queries; writes call inventory.py's move_batch and record_receipt. ✓ READ
- **Contract validation:** Every Plan input/output is validated against /contracts/schema/Plan.json before write or return. Type safety is enforced at the API boundary. ✓ READ
- **pick_slip.py is the print engine:** GET /api/inventory/restock/slip calls plan_restock_for_store, then renders via pick_slip.py (not shown in this audit). Outputs HTML or plain text for printing. ✓ READ

---

## Summary

**Floor Restock controls map 100% to existing routes.** ✓  
**Console common-ground components: 5/6 exist; StatusTimeline and Manage box types are missing.**  
**5 proposed items for Team 2 (shelf pars, status events, box types, received filter, plan_handoff).**  
**No blocking gaps in live endpoints; warnings are feature-not-built (pars, timeline, box mgmt) and should be parked if out of scope.**

