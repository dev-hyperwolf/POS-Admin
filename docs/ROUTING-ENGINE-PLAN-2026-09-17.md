# Routing engine plan — dispatch brain, solver choice, and the shadow test

**Date:** 2026-09-17 · **Status:** plan for owner review — nothing here is built or deployed.
**Scope:** how Hyperwolf assigns and sequences deliveries on the new platform; which optimiser runs
behind it; how we decide between the GraphHopper account and a self-hosted solver **with data**.
**Supersedes:** the solver table in `REALTIME-ARCHITECTURE-2026-09-17.md` Part 4 (that table predates
the owner's decision to keep GraphHopper and shadow-test; its Google cost line is also ~10× too low,
see §3.3). Everything else in that document (queue, debounce, plan versions, duty-flag gate) stands
and is built on here.

**Already decided by the owner — not re-opened here:** keep the GraphHopper account, called through
ONE solver interface; shadow-test a self-hosted solver on the same real orders and decide with data;
a dispatcher's pin (stop or driver) always beats re-optimisation; raw driver trails 90 days then
summaries; off-duty pings ignored server-side; Aurora PostgreSQL + Valkey on AWS; TypeScript
services; WebSockets to the dispatcher map and driver app.

**Evidence labels used throughout:** `CONFIRMED` = read in code/docs today with a file:line;
`ASSUMED` = a working number nobody has measured yet; `UNVERIFIED` = a vendor fact I could not
confirm from the vendor's own page today. Every vendor fact carries a URL; all were read 2026-09-17.

---

## Executive summary (one page, plain language)

**What runs today is not route optimisation.** When an order comes in, the legacy system asks HERE
Maps for the drive time of each leg of each on-duty driver's list, **adds the new order to the END
of a list**, and picks the closest driver; ties go to whoever has fewer stops. Scheduled orders go to
*the first driver the database returns* for that region. Re-assignment only fires when an order is
already about 85 minutes old. The GraphHopper key exists in the config template and the README says
GraphHopper does "route optimization / VRP" — but **no code in any of the twelve legacy repos ever
calls GraphHopper**. So anything we build that actually sequences stops is a step up, and "the
GraphHopper account we already pay for" has never been exercised by dispatch.

**The recommendation, in four parts:**

1. **Build our own "dispatch brain" first — it is the part that matters and no vendor sells it.**
   It owns the rules (licensed hours, zones, the $10,000 vehicle cap, cash cap, kit stock, breaks,
   pins), gives an instant driver-and-ETA answer for every new ASAP order in under 0.2 seconds
   using our own insertion logic, checks every plan from any optimiser before a driver sees it, and
   publishes only what changed. The optimiser behind it becomes a replaceable part.
2. **Plug GraphHopper (hosted) in first as the background optimiser**, exactly as decided. It
   supports what we need on paper: pick-up-then-deliver pairs, multiple capacity dimensions, skills,
   breaks, "this stop must be on this vehicle", and it accepts our own travel-time table.
3. **Stand up VROOM + OSRM (open source, runs in our AWS account) as the shadow challenger.**
   Cheapest to run, millisecond solves, and no customer address ever leaves our systems.
   OR-Tools is the named reserve if VROOM cannot express something we turn out to need.
4. **Decide with the shadow test in §4**: six weeks of real orders replayed with their true arrival
   times, then four weeks running silently beside production. The pass/fail numbers are in §4.6 for
   you to approve **before** we look at any results.

**Why not just pick one now.** Three things are genuinely unknown and only our own orders can answer
them: (a) neither engine understands a kit natively — both need the same workaround, and we need to
see it hold up; (b) both treat a delivery deadline as all-or-nothing (an order that would be 4
minutes late is *dropped from the plan*, not delivered 4 minutes late), so our brain has to manage
that, and it matters most on exactly the nights that matter most; (c) solution quality differences
between engines on small, fast-changing problems like ours are usually a few percent — worth
measuring, not worth guessing.

**The cost finding that should shape the decision.** Vendors bill **every re-plan for every open
stop in it**, not once per order. We will re-plan a busy area hundreds of times a day. So vendor cost
grows roughly with the *square* of order volume:

| | Today (300/day) | 3× | 10× |
|---|---|---|---|
| GraphHopper hosted | ~56,000 credits/day → just over the top published plan (Premium, €479/mo, 50,000/day) | ~400,000/day → custom contract | ~2.1M/day → custom contract |
| Google Route Optimization | ≈ $3,900/mo | ≈ $12,000/mo | ≈ $24,000/mo |
| Self-hosted VROOM + OSRM | ≈ $300/mo of AWS, flat | ≈ $450/mo | ≈ $900/mo |

(Arithmetic in §3.3. GraphHopper's custom prices are not published — that is a phone call.)
At today's volume GraphHopper is affordable and the least work. **At 3× and beyond, a self-hosted
engine that merely *ties* on quality wins on cost and privacy** — which is why the shadow test is a
tie-goes-to-self-hosted test at 3×+, and a GraphHopper-keeps-the-job test at today's volume.

**What I need from you:** (1) the eight questions in §7, one at a time; (2) approval of the §4.6
thresholds; (3) one fact only you can look up — **which GraphHopper plan the account is on**
(Basic allows 2 vehicles per request, Standard 10, Premium 20; below Premium it cannot plan even one
of today's areas in one call).

---

## 0. What the code says today (so the plan replaces reality, not the README)

All paths under `/Users/jt/hyper-tech/hyperdrive-backend` (read-only; nothing edited; no `.env` read).

| Finding | Evidence |
|---|---|
| Travel time comes from **HERE Routing v8**, one HTTP call **per leg**, sequentially, with the API key in the query string | `driverAssignment/assignment/hereMapsLogic.js:6-12`; loop at `regionAssignmentRule.js:268-285` |
| New order is **appended to the end** of each candidate's existing stops (sorted by a stored distance), never inserted mid-route | `regionAssignmentRule.js:211-235` |
| Candidate pool = **every** active on-duty driver estate-wide — despite the filename there is **no region filter** | `regionAssignmentRule.js:36-43` |
| Drivers on a break in progress are excluded — and so is any driver whose break task was *updated* today | `regionAssignmentRule.js:53-77` |
| Selection rule: ETA ≤ 80 min → nearest by miles (2-mile tie band) → fastest (5-min tie band) → **fewest stops** (the only fairness term) | `regionAssignmentRule.js:238-265`; constants `:8-11` (service 3, packing 2, process 1, limit 80) |
| A unit bug: the 80-"minute" limit is compared against **miles** | `hereMapsLogic.js:3,20` |
| No driver qualifies → a driver whose email matches `/default/i` | `regionAssignmentRule.js:287-289` |
| Kit check on re-assignment passes if **any one** ordered product has **any** quantity row for the driver's Blaze terminal — quantity ordered is never compared | `reAssignment/reAssignTaskAuto.js:83-98` |
| Re-assignment trigger: projected arrival more than **85 min** after order creation; "out for delivery" when within 150 m | `monitoring/monitoringCron.js:12,36-40,45` |
| Scheduled orders: `Fleets.findOne({regionData.regionId})` — first match, no optimisation, no load check | `scheduleAssignment/assignToDriver.js:13,77-85` |
| Task vocabulary already has what the model needs: `deliveryTask`, `pickUpTask`, `returnToHeadquarterTask`, `breakTask`, `startTask`; modes `auto/manual/driver/region` | `models/TasksModel.js:7-11` |
| Timestamps that make a replay possible: `createdDate`, `taskStartTime`, `actualTaskStartTime`, `actualArrivalTime`, `actualTaskEndTime`, `expectedArrivalTime`, `serviceTime`, `slotDetails`, `dispatchRegionId` | `models/TasksModel.js:84-89,120,124-129,140-141` |
| Driver record: one vehicle type ref, one region, **one Blaze terminal (= the kit)**, latest + previous position only — **no trail** | `models/Fleets.js:26,31-41,58-61` |
| Region record: open/close times, days of operation, `kmlEdges` polygon, zip codes, min order, fees | `models/Region.js:49-61,69,94,125,129` |
| Breaks are fixed clock-time templates (`fromTime`/`toTime`/`duration`/`sendBreakAt`) | `models/Breaks.js:7-12` |
| **GraphHopper: keys in the template and a README claim — zero call sites in all 12 repos** (case-insensitive search for `graphhopper|grasshopper`) | `.env.example:47-48`; `README.md:34,194`; no other hit |
| Kit value limits exist on the distribution side (per box min/max product value; per-region/box product counts) | `distribution-backend/models/KitBoxes.js:8-9`; `DistributionGlobalSettings.js:5-10` |
| Two-level geography with KML on the child, plus a driver→sub-region mapping | `LEGACY-DATA-MODEL-INVENTORY-2026-09-17.md` rows `Regions`/`SubRegions`/`RegionDriverAssign` (lines 284-290) |

What the mockups say dispatchers and drivers need (`/Users/jt/POS-Admin`, static demo data):

- **Routing Config** screen already exists as a concept: SLA 90 min, SLA buffer 10, risk OK ≥ 0.85 /
  BAD < 0.70, idle start 10 min, KM cap 20, **load spread cap 4**, buffer penalty −0.35
  (`logistics/ldata.jsx:20`, `logistics/lviews.jsx:170`). **Buffer Spillover Rules**: 4000 m per
  region (`lviews.jsx:174`). This is where the owner-tunable weights in §1.4 belong.
- Dispatcher verbs: Reassign (ranked candidate list with ETA / distance / score / stock-ok),
  Bump priority, Rebalance / "Rebalance all", drag an order onto a driver
  (`logistics/lparts.jsx:36-96`, `lparts2.jsx:54-70`, `lviews.jsx:334`). A "no candidate" reason is
  shown in words (`ldata.jsx` order 1012/1000) — the engine must **explain** an unassigned order.
- A **Floater** region/driver (RC8) that absorbs overflow (`ldata.jsx` REGIONS, alert a6); scheduled
  orders "auto-assign ~30 min before the window" (`ldata.jsx` orders 1102/1104, `lorder.jsx:249`).
- Kit awareness at **category/box** level in the mock (`ldata.jsx` `stockCheck`, `BOX_TYPE`); the real
  engine must go to SKU × quantity.
- Driver app: ordered stop list with ETA, window end ("latest arrival"), slack minutes (late ≤ −3,
  ahead ≥ 8), break cards in the same timeline, pack/scan-from-box before departure, door dwell
  176–342 s with first-time customers slowest, Shop@Home **appointments** with 1-hour windows
  (`mobile/data.jsx:56-104`, `mobile/screen-home.jsx:98-282`).

---

## 1. Formal problem statement

### 1.1 The variant

A **dynamic (online), multi-depot, heterogeneous-fleet pickup-and-delivery problem with time
windows, inventory on board, open routes and driver breaks** — in the literature's shorthand a
*DPDPTW* with a multi-commodity load and side constraints, solved on a **rolling horizon**.
Decomposed by dispatch area, each instance is small (tens of vehicles, tens of open stops) but is
re-solved hundreds of times a day. That shape drives everything: **latency, stability and
constraint fidelity matter more than the last 1% of optimality**, and billing-per-solve is the
dominant vendor cost.

Two order classes, which is the cannabis-specific twist:

- **Kit order** — every line can be filled from stock already in a vehicle. To the solver it is a
  plain *service* stop, but only vehicles whose kit covers it are eligible, and assigning it
  **consumes** that stock for every later decision.
- **Hub order** — at least one line is not in any eligible kit. It is a *shipment*: pick up at the
  hub (packing/hand-off dwell), then deliver, same vehicle, pickup first.

### 1.2 Sets and data

| Symbol | Meaning | Source |
|---|---|---|
| Areas `a` | A dispatch area = one hub + its KML regions/sub-regions; solved independently, with a spillover band | CONFIRMED two-level geography; **ASSUMED 4 areas today** |
| Vehicles `v` | On-duty driver+vehicle: current position, shift end, vehicle type (Car/Bike/Bicycle → speed profile + capacity), home sub-region, kit ledger `inv[v][sku]`, value on board, cash on hand, break obligations | CONFIRMED fields; kit ledger must be **built** (legacy only has a Blaze terminal cache) |
| Orders `o` | Location, class (kit/hub), lines `(sku, qty)`, retail value, cash to collect, window `[e,l]`, promised-ETA window if the customer has been told one, dwell estimate, priority, pin | CONFIRMED fields except promise window (new) |
| Hubs `h` | Location, open hours, hand-off dwell | CONFIRMED (`startLocationName`, ReturnToHQ) |
| `t(i,j,τ)` | Travel time i→j departing at time-of-day τ | §2.5 |

### 1.3 Constraints

**Hard (a plan violating any of these is never published — enforced by OUR feasibility checker on
every plan from every solver, not trusted to the solver):**

| # | Constraint | Basis |
|---|---|---|
| H1 | Pins: a pinned stop stays on its driver; a pinned position stays in sequence | Owner decision |
| H2 | Kit stock: Σ qty of `sku` over kit orders assigned to `v` ≤ `inv[v][sku]` (after reservations) | Business; legacy check is unsound (§0) |
| H3 | **Retail value on board ≤ $10,000 at every moment**, valued at current retail price | 4 CCR §15418(a),(b) — CONFIRMED, [law.cornell.edu/regulations/california/4-CCR-15418](https://www.law.cornell.edu/regulations/california/4-CCR-15418) |
| H4 | Cash on hand ≤ company cash cap (per vehicle type) | Company policy — **ASSUMED to exist; number needed** |
| H5 | Delivery only inside the licensed area polygon and inside licensed hours; **6:00 a.m.–10:00 p.m.** state outer bound, local may be stricter | Hours: secondary sources only today — UNVERIFIED against the primary text (§15403); per-region hours CONFIRMED in `Region.js:49-61` |
| H6 | Prohibited address types are rejected **at order intake** by geofence/denylist, never reach the solver | **ASSUMED** (4 CCR §15416 public land etc. — not re-read today; counsel to confirm the list) |
| H7 | Hub order: pickup before delivery, same vehicle | Definition |
| H8 | Shift end: last stop completes (and, if required, vehicle is back at hub) before shift end / licensed close | Business + H5 |
| H9 | Frozen prefix: the stop in progress and the next committed stop are immutable except by a dispatcher | §2.3 |
| H10 | Vehicle type eligibility (e.g. bicycle radius, no hub shipments above a size on a bike) | CONFIRMED vehicle types; rules ASSUMED |
| H11 | **Idle return rule:** a driver with no delivery request for 30 minutes makes no further deliveries and returns to the premises | 4 CCR §15418(h) — CONFIRMED (same URL). This is a routing rule, not just compliance: the brain must keep a useful driver "requested" or send them home |

**Soft (priced in the objective):** lateness against the window/promise; drive time; load fairness;
value-and-cash exposure; plan churn; zone affinity (a driver outside home sub-region pays the
"buffer penalty" the mock already names); meal/rest break placement inside its legal window.

**Breaks (California) — modelled as flexible breaks with a time window, hard once the window is
about to close:** 30-minute meal starting before the end of the 5th hour of work; second meal before
the end of the 10th hour; 10-minute paid rest per 4 hours or major fraction. **ASSUMED from general
knowledge of Labor Code §512 / IWC wage orders — not re-read today**; the numbers must be taken from
the same source the estate's break-compliance engine uses, so dispatch and audit can never disagree.
A legacy fixed clock-time break (`Breaks.js`) becomes a window, which is what lets the optimiser put
the break where it costs least.

### 1.4 Objective — candidates, recommended weights, and how the owner tunes them

One scalar, in **minute-equivalents** (so every weight answers "how many minutes of driving is this
worth?"), computed by **our scorer** on any plan from any solver:

```
score(plan) =  w_late_asap   · Σ minutes past ASAP promise
             + w_late_sched  · Σ minutes past scheduled-window end
             + w_drive       · Σ drive minutes
             + w_unassigned  · #orders left unassigned
             + w_fair        · Σ_v |stops_v − area mean|           (load spread)
             + w_zone        · Σ stops served outside home sub-region
             + w_exposure    · Σ_v ∫ max(0, value_v(t) − $5k)/$1k dt   (hours·$k above a comfort level)
             + w_cash        · Σ_v ∫ max(0, cash_v(t) − ½cap) dt
             + w_churn_move  · #stops moved to a different driver vs. the live plan
             + w_churn_seq   · #told-ETA stops whose order changed
```

| Weight | "Balanced" (recommended default) | "Customer first" | "Miles saver" | Meaning |
|---|---|---|---|---|
| `w_drive` | 1 | 1 | 1 | the unit |
| `w_late_asap` | 8 / min | 15 | 4 | one minute late = 8 minutes of driving |
| `w_late_sched` | 12 / min | 20 | 6 | a booked window is a firmer promise than ASAP |
| `w_unassigned` | 600 | 900 | 400 | effectively "never, if any feasible driver exists" |
| `w_fair` | 3 / stop | 2 | 1 | mock's "load spread cap 4" becomes a hard ceiling on top |
| `w_zone` | 4 / stop | 2 | 6 | the mock's "buffer penalty" |
| `w_exposure` | 2 | 2 | 2 | keeps high-value hub pickups late in a route |
| `w_cash` | 2 | 2 | 2 | nudges a cash drop before the cap forces one |
| `w_churn_move` | 6 | 4 | 8 | a re-plan must beat the live plan by more than it disrupts |
| `w_churn_seq` | 3 | 3 | 3 | — |

All numbers are **ASSUMED starting points**; the replay in §4 is what calibrates them.

**How the owner tunes without code.** The existing *Routing Config* settings panel gets (1) three
**presets** above, (2) four sliders in plain words — *On-time ↔ Fewer miles*, *Even workload*,
*Keep drivers in their zone*, *Don't reshuffle drivers* — which map to the weights, and (3) hard
numbers already on that panel (SLA minutes, buffer, KM cap, load spread cap, spillover metres).
**Every change is a new, versioned `dispatch_policy` row; before it goes live the replay harness
re-runs the last 7 days under the new policy and shows the owner the before/after** (on-time %,
miles, moves per driver). Nothing takes effect until "Apply" is pressed; one click reverts. The
policy is data, the solvers never see it directly (§2.2) — so tuning behaves the same whichever
engine is primary.

### 1.5 Planning assumptions (each to be replaced by a measurement)

| Assumption | Value | Label |
|---|---|---|
| Orders/day | 300 today; design for 3,000 | CONFIRMED (brief) |
| Drivers on shift, whole estate | 20–60 today, 200–600 at 10× | CONFIRMED (`REALTIME-ARCHITECTURE` Part 3 arithmetic) |
| Dispatch areas | 4 | ASSUMED |
| Operating day | 14 h | ASSUMED |
| Order lifetime (created → delivered) | 75 min mean | ASSUMED (SLA 90 in mock) |
| Open stops per area at once | ≈ 7 / 20 / 67 (today / 3× / 10×); peak ≈ 2× | derived: `N/areas × 75/840` |
| Vehicles per area | ≈ 10 / 30 / 100 | derived from mid-range |
| Re-plan-worthy events per order | 3 (create, complete, one change/cancel/driver event) | ASSUMED |
| Full re-plans per area per day after coalescing | ≈ 200 / 500 / 800 | ASSUMED (hard ceiling 840 = one per minute) |
| Door dwell | 4 min regular, 6 min first-time (ID check + signature); hub hand-off 5 min | ASSUMED (mock 176–342 s; legacy constant 3) |
| Share of hub orders | 15% | ASSUMED — **a number the owner/ops should supply** |

---

## 2. Architecture

```
 order / driver / pin events ──► dispatch-core (TypeScript, in our VPC) ──► WebSocket diffs
                                   │  state: Aurora (plans, pins, policy)      (dispatcher map,
                                   │  hot:   Valkey (positions, matrix cache)    driver app)
                                   │
        ┌──────────────────────────┼─────────────────────────────┐
        ▼                          ▼                             ▼
  Insertion engine           Re-opt orchestrator           ETA service
  (in-process, <200 ms)      (pg-boss, per-area debounce)  (solver time × learned correction)
                                   │
                         RouteSolver interface  ── one contract, many adapters
                   ┌───────────────┼───────────────────┬──────────────────┐
                   ▼               ▼                   ▼                  ▼
          GraphHopperHosted   VroomSelfHosted     (reserve) OrTools    InsertionOnly
          adapter (primary)   adapter (shadow)    adapter              (always-available fallback)
                   │               │
            payload minimiser   OSRM (SoCal extract) in our VPC
                   ▼
           Feasibility checker + Scorer  ◄── every plan from every adapter passes through here
```

The design rule: **solvers propose; our checker and scorer dispose.** No solver is trusted to
enforce a hard constraint, none of them sees the owner's weights directly, and none of them is on
the path of an instant quote. That is what makes the primary swappable on a Tuesday afternoon.

### 2.1 The `RouteSolver` interface

```ts
interface RouteSolver {
  readonly id: 'graphhopper-hosted' | 'vroom-osrm' | 'ortools' | 'insertion-only';
  capabilities(): SolverCapabilities;   // shipments, multiDimCapacity, softWindows, breaks, customMatrix, warmStart…
  solve(req: SolveRequest, opts: { deadlineMs: number; signal: AbortSignal }): Promise<SolveResult>;
}

type SolveRequest = {
  requestId: string;            // uuid — idempotency key; same id ⇒ same cached result
  areaId: string;
  basisPlanVersion: number;     // the live plan this snapshot was cut from
  snapshotHash: string;         // sha256 of the canonical JSON below; identical hash ⇒ skip the solve
  now: string;                  // ISO instant the snapshot represents
  horizonEnd: string;           // rolling-horizon cut-off (orders starting later are excluded)
  vehicles: Array<{
    ref: string;                // OPAQUE per-request token — never a driver id, name or phone
    start: LatLng;              // current position, or where the frozen prefix ends
    startAvailableAt: string;   // when the frozen prefix is expected to finish
    end?: LatLng;               // hub, only if the vehicle must return
    shiftEnd: string;
    profile: 'car' | 'bike' | 'bicycle';
    capacity: number[];         // dimension order given by `dimensions`
    breaks: Array<{ ref: string; earliest: string; latest: string; durationSec: number }>;
    skills: string[];           // opaque tags: zone eligibility, vehicle rules
  }>;
  stops: Array<{
    ref: string;                // OPAQUE per-request token — never an order number
    kind: 'service' | 'pickup' | 'delivery';
    pairRef?: string;           // links pickup↔delivery of one hub order
    at: LatLng;
    windows: Array<{ earliest: string; latest: string }>;   // hard, already laddered (§2.4)
    dwellSec: number;
    load: number[];             // + picks up / − drops, per dimension
    requiredSkills: string[];
    allowedVehicles?: string[]; // kit eligibility, computed by us
    pinnedVehicle?: string;     // H1 — hard
    priority: number;           // 0–100
  }>;
  sequencePins: Array<{ vehicle: string; ordered: string[] }>;  // "these stops, in this order, on this vehicle"
  dimensions: Array<'value' | 'cash' | `sku:${number}`>;        // sku:N are anonymous contested-SKU indices
  matrix?: { profile: string; durationsSec: number[][]; distancesM: number[][]; index: string[] };
  warmStart?: Array<{ vehicle: string; ordered: string[] }>;    // the live plan, for solvers that accept one
};

type SolveResult = {
  requestId: string; solver: string; solveMs: number;
  routes: Array<{ vehicle: string; steps: Array<{ ref: string; arrive: string; depart: string }> }>;
  unassigned: Array<{ ref: string; reason?: string }>;
  solverObjective?: number;     // informational only — OUR scorer decides
  rawBilling?: { units: number; unit: 'credits' | 'shipments' | 'none' };
};
```

Properties that matter:

- **Idempotent and versioned.** `requestId` + `snapshotHash` make a retried call free and a duplicate
  call a no-op. Results are stored in `solver_runs`; an adopted result becomes a new immutable
  `route_plan_versions` row (populate-then-swap, never edit-in-place).
- **Pins are constraints in the input, not memory in the solver.** `pinnedVehicle` and
  `sequencePins` are re-sent on every solve until a dispatcher clears them. Adapters map them to
  the engine's own mechanism (GraphHopper `allowed_vehicles` + `relations`; VROOM `skills` unique to
  one vehicle + vehicle `steps`; OR-Tools `SetAllowedVehiclesForIndex` + locked routes). The checker
  rejects any returned plan that breaks one — so an adapter bug cannot override a dispatcher.
- **Opaque references.** The mapping `ref → order/driver` lives only in dispatch-core memory for the
  life of the request. See §5 for what may and may not cross the boundary.
- **Diffs out, not plans.** `diff(planN, planN+1)` yields
  `[{op:'assign'|'move'|'resequence'|'unassign'|'eta', stop, fromDriver?, toDriver?, pos?, etaP50?, etaP80?}]`.
  Dispatcher channels get every op; a driver gets only ops touching their own route; an `eta` op is
  emitted to dispatchers when |Δ| ≥ 3 min, and to the customer only when the new ETA leaves the
  promised window.

### 2.2 Kit inventory, value cap and cash cap — how they are modelled

No candidate has a "kit" concept. All of them have **multi-dimensional capacity**, and that is
enough if we encode carefully — identically for every engine, which is also what keeps the shadow
test fair:

1. **Reservation ledger (ours).** `kit_ledger(vehicle, sku) = on_hand − reserved`. Assigning a kit
   order reserves its lines in the same DB transaction as the plan swap; delivery converts the
   reservation to a decrement; cancel releases it. This is the source of truth the legacy never had.
2. **Eligibility first.** For each kit order we compute `allowedVehicles` = vehicles whose ledger
   covers **every line at the ordered quantity**. Most orders end here: the solver just sees a
   service stop restricted to some vehicles.
3. **Contested-SKU dimensions.** Eligibility alone over-promises when two open orders want the last
   unit on the same vehicle. For exactly those SKUs (open demand on a vehicle's eligible orders >
   that vehicle's available qty) we add a capacity dimension `sku:N`: vehicle capacity = available
   qty, stop load = ordered qty. Typically a handful of dimensions per solve, not the catalogue.
4. **Value (H3).** Dimension `value` in scaled integer units. Vehicle capacity =
   `$10,000 − retail value of kit stock NOT allocated to any open order` (that stock stays on board
   all shift, so it is a constant deduction). Kit orders count as load present from the start and
   released at their stop; hub shipments add at pickup and release at delivery. All candidates
   evaluate capacity along the route, so "at any time" is honoured natively.
5. **Cash (H4).** Dimension `cash`: capacity = cap − cash on hand; each cash-on-delivery stop is a
   *pickup* of its amount. When the scorer sees a vehicle within 20% of the cap, the brain inserts a
   **cash-drop** hub visit (the legacy `returnToHeadquarterTask`), exactly like a restock.
6. **Hub orders** are shipments (H7). **Restock** is a hub visit that raises `on_hand`; how it is
   triggered is owner question 5.

If no vehicle is eligible the order becomes a hub order automatically (or follows owner question 7).

### 2.3 Event-driven re-optimisation, rolling horizon, and not whipsawing drivers

**Triggers** (each enqueues `recompute-area` with pg-boss `singletonKey = areaId`):
order created (after its instant insertion — this pass *improves*, it does not block the quote) ·
cancelled · changed (address / window / lines) · stop completed or failed **when it deviates > 4 min
from plan** · driver on/off duty, break start/end, out-of-service · position drift (a sampled
breadcrumb implies next-stop ETA has slipped > 5 min) · pin set/cleared · kit restocked or
discrepancy recorded · policy applied · a 5-minute heartbeat while the area has open stops.

**Coalescing.** Trailing debounce **15 s**, maximum wait **45 s**, **one in-flight solve per area**.
Events during a solve set a dirty flag → one follow-up run. Minimum spacing between *vendor* solves
60 s (cost guard, §3.3); self-hosted has no such floor.

**Rolling horizon.** A solve contains: every open ASAP order; scheduled orders whose window opens
within **90 min** (the mock's "auto-assign ~30 min before" becomes *plan at 90, commit at 30*);
breaks falling inside the horizon. Later orders sit in a capacity forecast only.

**Freeze (H9).** Per driver: the stop in progress and the next committed stop are frozen
(`start`/`startAvailableAt` of the vehicle are set to where/when that prefix ends). Stops with a
customer-told ETA carry their **promise window** as the hard window (owner question 6). Everything
after that is free to move — but moving costs `w_churn_*`.

**Adoption rule (hysteresis).** A candidate plan replaces the live plan only if (a) it passes the
feasibility checker against the **current** state — orders cancelled or completed mid-solve are
rebased out; if the rebase touches more than 20% of stops the result is discarded — and (b) its
score beats the live plan's by **≥ max(2%, 3 minute-equivalents)**, or it repairs a hard violation
or a projected late stop. Most re-plans therefore change nothing, by design.

**Explainability.** For every unassigned order the checker records *which* constraint removed each
candidate vehicle ("kit lacks SKU", "value cap", "shift ends 8:40", "outside spillover band") — the
"no candidate" sentence the dispatcher mock already shows.

### 2.4 Instant ASAP quotes: insertion now, optimisation later

Budget **< 200 ms p99**, all in-process, no vendor on the path:

1. Eligible vehicles (zone + spillover band, kit, value/cash headroom, shift end, vehicle rules): < 5 ms.
2. Travel times for the new location: one `1×K` and one `K×1` table call to the self-hosted matrix
   service (10–40 ms; 80 ms budget). On timeout: haversine × circuity factor ÷ time-of-day speed
   from the learned table (§2.5) — a degraded but never-blocking answer.
3. **Cheapest feasible insertion** over every position after each vehicle's frozen prefix, using
   forward-time-slack so each position is O(1): ≤ 100 vehicles × ~10 positions ≈ 1,000 evaluations
   ≈ 1–3 ms. Hub orders try pickup/delivery position pairs (O(n²), still < 10 ms). Tie-break by the
   same scorer as §1.4 so the quote and the later re-plan agree about what "good" means.
4. Return `{driver, position, etaP50, etaP80}`; reserve kit lines; publish one `assign` diff;
   enqueue the background improve.

This alone — mid-route insertion, real kit check, zone rules — is a larger improvement over the
legacy append-to-end logic than any choice between optimisers.

**The deadline ladder (because every practical candidate has hard-only windows).** GraphHopper and
VROOM drop a stop that cannot meet its window rather than serve it late. So dispatch-core sends
`latest = promise`, and if stops come back unassigned **for time reasons** re-sends just those with
`latest + 10`, `+ 20`, `+ 40 min` tiers at falling priority. Our scorer prices the lateness; the
dispatcher sees "projected 12 min late", never a silently dropped order. (Google, OR-Tools and
Timefold have native soft windows — a real point in their favour, see §3.)

### 2.5 Travel-time matrix strategy

| Layer | What | Cost |
|---|---|---|
| **Base matrix** | Free-flow durations/distances from a road-network engine. Primary arm: GraphHopper computes its own. Shadow arm and the quote path: **self-hosted OSRM, Southern-California OSM extract**, `table` service | Self-hosted: flat infra. GraphHopper Matrix API: `min(origins × destinations ÷ 2, max(o,d) × 10)` credits — [support.graphhopper.com …what-is-one-credit](https://support.graphhopper.com/support/solutions/articles/44000718211-what-is-one-credit-) |
| **Cache** | Valkey, key = `(profile, snapped-node A, snapped-node B)`, TTL = until the nightly OSM rebuild. Customer locations repeat (regulars) and hubs are fixed, so hit rates climb quickly. Driver-position rows are never cached | negligible |
| **Time-of-day profile** | Multiplier `m(area, hour-of-week, distance band)` **learned from our own completed legs** (planned free-flow vs. actual), refreshed nightly, shrunk toward 1.0 where data is thin. Applied to the matrix before it is handed to *any* solver | free, private |
| **Live traffic (optional, later)** | Only for legs that matter: the active leg of a driver whose next stop has < 10 min slack. **Never** full live-traffic matrices — a 17×17 matrix per re-plan at ~800 re-plans/day is ~7M elements/month, and Google's traffic-aware matrix is $10 → $0.75 per 1,000 elements ([developers.google.com/maps/billing-and-pricing/pricing](https://developers.google.com/maps/billing-and-pricing/pricing)) | at-risk legs only: low hundreds of $/mo (ASSUMED volume) |

Traffic options compared: **(a) own history** — recommended first, costs nothing, improves with
volume, keeps location data in-house; **(b) GraphHopper + TomTom add-on** — historical
time-of-day speeds via `network_data_provider: tomtom`, `consider_traffic: true`; it is a paid
add-on and **the price is not published** (UNVERIFIED —
[graphhopper.com/blog/2017/11/06/time-dependent-optimization](https://www.graphhopper.com/blog/2017/11/06/time-dependent-optimization/),
[docs.graphhopper.com …/tomtom-multinet](https://docs.graphhopper.com/openapi/map-data-and-routing-profiles/tomtom-multinet));
**(c) Valhalla** self-hosted — the only open engine with true time-dependent routing and a live
traffic overlay ([github.com/valhalla/valhalla](https://github.com/valhalla/valhalla),
[valhalla.github.io/valhalla/api/matrix](https://valhalla.github.io/valhalla/api/matrix/)) — but it
still needs a traffic **feed**, which is a separate purchase; **(d) OSRM** can re-weight edges from
a speed file via `osrm-customize` on the MLD pipeline in minutes, but has no time-of-day dimension
([github.com/Project-OSRM/osrm-backend/wiki/Traffic](https://github.com/Project-OSRM/osrm-backend/wiki/Traffic));
**(e) Amazon Location Service** route matrix — on our cloud, priced per 1,000 matrix elements; exact
rate not shown on the page I could read (UNVERIFIED — [aws.amazon.com/location/pricing](https://aws.amazon.com/location/pricing/)).

### 2.6 ETA model

`ETA = departure + Σ leg(base × m(area, hour-of-week, band)) + Σ dwell(visit type, tender, dwelling
type, first-time?) + break time on the way` — then a **learned residual correction** from our own
history. Start deliberately simple: bucketed robust medians with shrinkage (works from week one);
move to quantile gradient-boosting once there are ≥ 20,000 completed stops with trustworthy
arrive/depart stamps. Publish two numbers: **P50** to dispatchers and drivers, **P80** as the
customer promise (under-promise by construction). Track **calibration** weekly: about 80% of
deliveries should arrive before their P80; if it is 65%, the promise is dishonest; if 95%, we are
turning away business. Door dwell — the ID check — is the largest single controllable error term,
so arrive/verify/complete timestamps from the driver app are first-class inputs.

### 2.7 Fallback ladder — drivers and customers never feel a vendor outage

| Level | Condition | Behaviour |
|---|---|---|
| L0 | Normal | Primary solver improves plans in the background |
| L1 | Primary fails 3× in 60 s, or p95 > 8 s → circuit open 2 min | The other adapter takes over (once both exist, each is the other's hot spare) |
| L2 | No solver reachable | **Insertion-only mode** + in-process 2-opt/or-opt inside each route. Orders keep flowing; only cross-driver rebalancing is lost. Banner on the dispatcher screen |
| L3 | dispatch-core degraded | Manual dispatch with the ranked candidate list (the Reassign panel), plans frozen as last published |
| Matrix | Matrix service slow/down | Cache → haversine × circuity × learned speed |

---

## 3. Candidate evaluation

All vendor facts read 2026-09-17 at the URL given; `UNVERIFIED` where I could not confirm on the
vendor's own page. "Our sizes" = per-area instances of ~10 vehicles × 7–14 open stops today, up to
~100 × 134 at the 10× peak (§1.5).

### 3.1 Fit — quality, speed, dynamics, traffic, expressiveness

| Candidate | Solution quality for *this* variant (pairs + inventory + pins) | Latency at our sizes | Dynamic re-optimisation | Traffic awareness | Kit inventory / value & cash caps |
|---|---|---|---|---|---|
| **GraphHopper hosted** (Route Optimization API; jsprit-family ruin-and-recreate) | Good. `shipments`, multi-dimensional `size`/`capacity`, `required_skills`, `allowed_vehicles`/`disallowed_vehicles`, `relations` (in_same_route / in_sequence / in_direct_sequence), vehicle `break`, `priority`, `max_jobs`, objectives `min` / `min-max` on transport or completion time, vehicles, activities ([docs.graphhopper.com …/solvevrp](https://docs.graphhopper.com/openapi/route-optimization/solvevrp.md)). **Windows are hard**; no warm-start field found in the schema | Network round trip + solve; synchronous endpoint is limited to problems that solve in ≤ 10 s (same URL). Expect 0.5–3 s (ASSUMED — the shadow test measures it) | Stateless re-solve each time; pins via `allowed_vehicles` + `relations`; every re-solve is billed | OSM free-flow by default. Historical time-of-day via the **TomTom add-on** (`consider_traffic`) — price unpublished. Accepts **our own matrix** via `cost_matrices` | **Workaround (§2.2), natively supported primitives**: capacity dimensions for value, cash and contested SKUs |
| **GraphHopper engine self-hosted + jsprit** | Potentially the most faithful: jsprit lets you write custom hard/soft constraints and state in Java, so a kit ledger could be a first-class constraint. Pairs, time windows, heterogeneous fleet, time-dependent costs listed ([github.com/graphhopper/jsprit](https://github.com/graphhopper/jsprit)) | In-VPC; seconds, iteration-budget driven | Initial routes for en-route vehicles exist in jsprit (from prior knowledge — UNVERIFIED today) | Whatever the matrix says; time-dependent cost hook exists | **Native if we code it** (Java) — otherwise the same workaround |
| **VROOM + OSRM** | Good for its speed class. Jobs **and shipments**, multi-dimensional capacity, skills, time windows, **breaks with `max_load`**, priorities, `max_tasks`, per-vehicle fixed/hour/km costs, custom matrices, **vehicle `steps`** to force or warm-start a route ([VROOM API.md](https://github.com/VROOM-Project/vroom/blob/master/docs/API.md)). Solves TSP→PDPTW families ([github.com/VROOM-Project/vroom](https://github.com/VROOM-Project/vroom)). **Windows are hard; objective is cost only** — lateness, fairness, churn live in our scorer | "Milliseconds" is the project's own claim; tens of ms to ~2 s at our sizes (ASSUMED until measured). No network hop | Stateless, fast enough to re-solve on every coalesced event at zero marginal cost; `steps` carry the live plan in | None in OSRM beyond re-weighting from a speed file; **we supply time-of-day via the matrix** (§2.5) | **Workaround (§2.2)**, same primitives as GraphHopper — which is what makes the head-to-head fair |
| **VROOM + Valhalla** | Same solver | Valhalla's time-dependent matrix is "exact but slower" than its fast matrix ([valhalla matrix API](https://valhalla.github.io/valhalla/api/matrix/)); fine at our sizes | Same | **Best open option**: time-dependent routing + live-traffic overlay — but a traffic *feed* must still be bought | Same |
| **OR-Tools** (routing library) | Very good, and the most controllable: `AddPickupAndDelivery`, same-vehicle and precedence via dimensions ([developers.google.com/optimization/routing/pickup_delivery](https://developers.google.com/optimization/routing/pickup_delivery)); arbitrary dimensions, **soft time-window bounds**, allowed-vehicle sets, breaks, locked partial routes (last four from prior knowledge — UNVERIFIED today) | You set the time limit (1–5 s typical); quality rises with time | Warm start from current routes; we own the loop | Matrix-driven | Dimensions per contested SKU + value + cash — **native**, plus soft lateness natively |
| **PyVRP** (ILS; formerly HGS) | Research-grade, state of the art on academic benchmarks (INFORMS J. Computing 2024 paper cited on the repo). Lists "pickup and delivery VRP" but **one-to-one paired support is not clearly documented** (UNVERIFIED); **breaks, vehicle–client compatibility and fairness are Enterprise-only**; version read was **1.0.0a0 (alpha)** ([pyvrp.org](https://pyvrp.org/), [github.com/PyVRP/PyVRP](https://github.com/PyVRP/PyVRP)) | Batch-oriented; shines with 10–60 s budgets | No pin / rolling-horizon primitives (UNVERIFIED) | Matrix-driven | Multiple load dimensions unclear (UNVERIFIED) |
| **Google Route Optimization API** | Very good and the richest hosted model: named load types/limits per vehicle (a clean fit for SKU dimensions), pickups+deliveries, **soft windows with a cost per hour**, breaks, injected routes/constraints for re-planning (from prior knowledge — UNVERIFIED today) | Managed; 60 queries/minute quota ([usage-and-billing](https://developers.google.com/maps/documentation/route-optimization/usage-and-billing)) | Designed for it, but **billed per shipment per request** | **Live traffic available** | **Closest to native** among hosted options |
| **Timefold** | Constraint solver, not a routing product: you model vehicles/visits and write hard/medium/soft constraints. **Real-time planning and pinning are first-class**; fairness and breaks are natural. Hosted "Pickup & Delivery Routing" API also exists ([timefold.ai/pricing](https://timefold.ai/pricing)) | Anytime algorithm; seconds. Multi-threaded incremental solving is Enterprise-only | Best-in-class conceptually (continuous planning, pinned entities) | Matrix-driven (hosted tier lists real-time traffic) | **Native if we model it** (Java/Kotlin) |

### 3.2 Ownership — licence, operations, cost, privacy, continuity

| Candidate | Licence | Ops burden | Cost today / 3× / 10× (arithmetic in §3.3) | Addresses leaving our systems | Vendor / continuity risk |
|---|---|---|---|---|---|
| GraphHopper hosted | Commercial SaaS. Plans: Basic €69 (5k credits/day, **2 vehicles**, 30 locations), Standard €199 (15k, **10 vehicles**, 80), Premium €479 (50k, **20 vehicles**, 200), Custom (to 200 vehicles / 10k locations). Premium rate limit 10 req/s and **1,000 credits/minute** ([graphhopper.com/pricing](https://www.graphhopper.com/pricing/)) | Lowest: one adapter, one secret | ~56k credits/day (**just over Premium**) / ~400k (**custom**; ≤ ~€3.8k/mo if priced linearly — UNVERIFIED upper bound) / ~2.1M (**custom**; ≤ ~€20k linear upper bound). At 3× an area exceeds **20 vehicles/request** regardless of credits | **Yes** — coordinates + windows to GraphHopper GmbH (Germany). Needs a DPA; the account name alone tells the vendor these are cannabis deliveries | Small private company, but **open core**: the engine and jsprit are Apache-2.0, so there is an exit path that keeps our adapter's shape |
| GH engine + jsprit self-hosted | Apache-2.0 both ([github.com/graphhopper/graphhopper](https://github.com/graphhopper/graphhopper)). The hosted **fast Matrix API is not part of the open-source engine** (community forks exist) — UNVERIFIED in detail | High: JVM services (Java 21) in a TypeScript shop; we write and own constraint code | Infra ≈ self-hosted VROOM + more RAM; mostly **engineering time** | None | jsprit's status is ambiguous: README advertises 2.0.0, but the GitHub releases page lists only `1.9.0-beta.x` pre-releases with an expired signing key ([releases](https://github.com/graphhopper/jsprit/releases)) |
| VROOM + OSRM | BSD-2-Clause (VROOM v1.14, 2024); OSRM BSD-2 | Medium-low: two containers, nightly OSM rebuild, health checks. C++ black box — we cannot add a constraint it lacks | ≈ **$310 / $450 / $900 per month**, flat in order volume | **None** | Community projects, no SLA; mitigated by being stateless behind our interface and by L2 insertion-only mode |
| VROOM + Valhalla | BSD-2 + MIT | Medium: heavier graph build, traffic tile plumbing | Same infra + **traffic feed licence (price unknown)** | None (feed is inbound) | Same |
| OR-Tools | Apache-2.0 | Medium-high: no TypeScript binding → a small Python (or C++) service; we own model code and tuning | Infra ≈ $150–600/mo + **2–4 build-weeks** | None | Google-maintained open source; low |
| PyVRP | MIT (core); Enterprise features via Applied Routing, price unpublished | Medium: Python service; alpha API | Infra only, as a test yardstick | None | Academic project; alpha |
| Google Route Optimization | Commercial. Fleet Routing (2+ vehicles) **$30 / 1,000 shipments** to 100k, then $14, $6, $2.40, $2.10; 1,000 free/month; **charged per shipment in each request** ([pricing](https://developers.google.com/maps/billing-and-pricing/pricing), [billing](https://developers.google.com/maps/documentation/route-optimization/usage-and-billing)) | Lowest | ≈ **$3,900 / $12,000 / $24,000 per month** under event-driven re-planning | **Yes** — to Google | Low outage risk; product-continuity caution: its predecessor (Cloud Fleet Routing) was retired in 2024 (per `REALTIME-ARCHITECTURE` Part 4) |
| Timefold | Community: Apache-2.0. Enterprise solver and hosted API (Spark / Flow / Horizon tiers): **prices not published** (UNVERIFIED) | High for self-modelled (JVM + model code); low for hosted | Unknown (hosted) / infra + 3–5 build-weeks (self) | Hosted: yes. Self: none | VC-backed company around an Apache-2.0 core — exit path exists |

**Considered and set aside** (not solvers we can drive from our own dispatch state, or no public
price): **NextBillion.ai** — per-order / per-asset / per-call pricing, all by quote
([nextbillion.ai/pricing](https://nextbillion.ai/pricing)) — UNVERIFIED numbers. **Routific** — a
dispatch *product* priced per order: $150 to 1,000 orders/month, then $0.15 → $0.03 per order;
≈ $950/mo at 9,000 orders, ≈ $1,740 at 27,000, custom above 50,000
([routific.com/pricing](https://www.routific.com/pricing)); it brings its own driver app, which we
are building, and its batch planner is not a rolling-horizon engine. **Onfleet's optimiser** — the
platform this migration is leaving; plans reported at $619/mo (2,500 tasks), $1,349 (5,000),
$3,099 Enterprise — **secondary sources only**
([upperinc.com/blog/onfleet-pricing](https://www.upperinc.com/blog/onfleet-pricing/)) — and 9,000
tasks/month is already past the mid tier.

### 3.3 Cost arithmetic (so it can be checked and re-run with real numbers)

Inputs from §1.5: areas `A = 4`; re-plans per area per day `S = 200 / 500 / 800`; open stops per
re-plan `L = 7 / 20 / 67`; vehicles per area `V = 10 / 30 / 100`.

**GraphHopper.** A Route Optimization request costs `vehicles × locations` credits, **minimum 10,
maximum 10 × locations** ([what is one credit](https://support.graphhopper.com/support/solutions/articles/44000718211-what-is-one-credit-)).

```
credits per re-plan  c = min(V·L, 10·L)   →  70  /  200  /  670
credits per day        = A · S · c        →  4·200·70  = 56,000
                                             4·500·200 = 400,000
                                             4·800·670 = 2,144,000
```

Premium is 50,000/day for €479 → €9.58 per 1,000 daily credits per month; linear extrapolation
(an **upper bound** — custom plans advertise a bulk discount, real price UNVERIFIED) gives
≈ €3,800/mo at 3× and ≈ €20,500/mo at 10×. **Cost guard:** cap vendor re-plans at one per area per
5 minutes (`S = 168`) and let our insertion engine carry the gaps → 47,000 / 134,000 / 450,000
credits/day. Whether the slower cadence costs on-time performance is itself a shadow-test arm (§4.4).
Matrix and routing calls are extra (small next to the above).

**Google Fleet Routing.** Shipments billed per month `= 30 · A · S · L`:

```
today   168,000  → 99,000·$0.030 + 68,000·$0.014                                   = $3,922
3×    1,200,000  → $2,970 + 400,000·$0.014 + 500,000·$0.006 + 200,000·$0.0024      = $12,050
10×   6,432,000  → $2,970 + $5,600 + $3,000 + 4,000,000·$0.0024 + 1,432,000·$0.0021 = $24,177
```

(The earlier $900–2,700/mo estimate for 10× assumed one solve per order. Re-planning is what makes
this a dynamic system, and re-planning is what is billed.)

**Self-hosted VROOM + OSRM.** Fargate list prices ≈ $0.0405 per vCPU-hour and $0.0044 per GB-hour
(**ASSUMED from memory, not re-read today**): OSRM 2 tasks × (2 vCPU, 8 GB) ≈ $170/mo; VROOM 2 tasks ×
(2 vCPU, 4 GB) ≈ $144/mo → **≈ $310/mo today**. 3×: a third VROOM task → ≈ $450. 10×: 3 OSRM + 3
VROOM at 4 vCPU → **≈ $700–1,100**. Flat in order volume; the real cost is roughly half a day a
month of upkeep and the build in §5.

**The pattern:** hosted cost ∝ (re-plans) × (open stops) ∝ volume²; self-hosted cost ∝ peak
instance size. They cross somewhere between today and 3×.

---

## 4. The shadow-test protocol — the decision instrument

Pre-registered: the metrics, margins and decision rule below are fixed and owner-approved **before**
any result is looked at. Changing them afterwards requires writing down why.

### 4.1 Dataset

- **Six consecutive weeks (42 days) minimum** of real history, every area, replayed event by event
  with **true timestamps**: order created / changed / cancelled; scheduled-window bookings; driver
  on-duty, off-duty, break start/end, out-of-service; actual arrive and complete times; manual
  reassignments. Legacy sources: `TasksModel` timestamps (§0), `FleetActivityLogs`,
  `FleetBreakLogs`, `FleetTaskActivityLogs` (models present in `hyperdrive-backend/models/`).
  The export is a dev-team job against a read replica — this plan touched no production system.
- Must contain **at least one peak day** (4/20, the day before Thanksgiving, a holiday Friday). If
  the window has none, build one by superposition (below) and label it synthetic.
- **Scale arms:** 3× and 10× days are made by overlaying 3 or 10 *different real days of the same
  weekday* onto one day and scaling driver shifts proportionally — real places, real arrival
  patterns, no invented geography.
- **Kit state** is the weak spot: history of what was on each vehicle is probably not recoverable.
  Primary analysis uses start-of-shift kit = that day's kit template (ASSUMED) with sales
  decrementing it; a sensitivity arm randomly removes 20% of kit lines to see whether rankings hold.
- **From go-live onward dispatch-core writes its own append-only `dispatch_events` log** — after a
  few weeks the test can be re-run on first-party data, and re-run again whenever a vendor, a
  policy or our volume changes. Build that log first (§5, Phase 0).
- **Privacy:** the replay set is pseudonymised (hashed order/driver ids, no names, phones, item
  names) but keeps coordinates, so it is still personal data: stays in our VPC, 90-day retention
  like trails, access-logged. The GraphHopper arm sends exactly the production-minimised payload
  (§5.2) and needs the DPA in place **before** the first replay call.
- **Vendor-arm budget:** 42 replayed days ≈ 2.35M GraphHopper credits — 47 days of Premium quota.
  So the GraphHopper arm replays a **stratified 14-day subset** (two of each weekday, peaks
  included) ≈ 784k credits ≈ 16 days of quota that is currently idle, since nothing in production
  calls GraphHopper today. Self-hosted arms run all 42 days + scale arms. **Paired comparisons use
  the common 14 days.** GraphHopper cannot run the 10× arm on a published plan (20-vehicle limit)
  unless they grant trial limits — ask.

### 4.2 Arms

| Arm | Purpose |
|---|---|
| A0 Legacy rule (append-to-end, nearest, fewest stops — re-implemented from §0) | Shows the owner what changes versus today |
| A1 Insertion-only (our brain, no optimiser) | Isolates what any optimiser adds |
| A2 Brain + GraphHopper hosted | The incumbent |
| A3 Brain + VROOM/OSRM | The challenger |
| A4 Yardstick: long-run (60 s) OR-Tools or PyVRP on **static snapshots** sampled from the replay | How far A2/A3 are from near-optimal; tells us whether a "better solver" could even matter |
| A2′/A3′ Same as A2/A3 at a 5-minute vendor cadence | Prices the cost guard in on-time terms |

### 4.3 Making it fair

1. **Same brain, same policy, same checker, same scorer** for A1–A3. Only the adapter differs.
2. **Same travel times in, same travel times out.** *Controlled arm:* both solvers receive the
   identical matrix (OSRM base × learned multipliers) — GraphHopper via `cost_matrices`, VROOM via
   custom matrices — so the comparison is solver vs. solver. *End-to-end arm:* each uses its native
   road data, so the comparison is product vs. product. Report both; **decide on the controlled
   arm, sanity-check on the end-to-end arm.**
3. **Plans are judged by the simulator, never by the solver's own ETA.** The simulator executes each
   plan against a ground-truth travel-time model fitted on a **held-out** half of history (so no
   arm is graded by the matrix it planned with), with door dwell drawn from the empirical
   distribution. **Common random numbers:** identical seeds across arms, so the same traffic luck
   and the same slow customer hit every arm.
4. **Same constraints**, encoded by the one shared snapshot builder; **same deadline per solve**
   (5 s) and same ladder; vendor network latency counts against the vendor (it is real).
5. **Pins:** primary analysis replays no manual pins (pure engine comparison); a separate arm
   replays the historical manual reassignments as pins to test G5.
6. Drivers are assumed to follow the plan (ASSUMED). Live shadow (§4.5) is where that assumption
   meets reality.

### 4.4 Metrics (definitions fixed here)

| Metric | Definition | Role |
|---|---|---|
| **On-time %** | Delivered ≤ promise (ASAP: quoted P80; scheduled: window end) ÷ delivered | **Primary** |
| **Lateness, mean and P95** | Minutes past promise, over late orders and over all orders | **Primary (P95)** |
| **Drive minutes per order** | Total simulated drive minutes ÷ delivered orders | **Primary** |
| Orders per driver-hour | Delivered ÷ on-duty hours | Secondary |
| Unassigned-while-feasible | Orders left out that the checker proves insertable | Gate |
| **Plan churn** | Per driver-hour: stops moved between drivers; told-ETA stops re-sequenced; customer ETA changes > 10 min | Secondary + gate |
| Fairness | Coefficient of variation of stops per driver-hour within an area-day | Secondary |
| Solve time | P50 / P95 / P99 wall-clock, including network | Gate |
| Quote latency | P99 of the insertion quote | Gate (brain, not solver) |
| Hard-constraint violations | Plans rejected by the checker ÷ solves; pins broken | Gate |
| Exposure | Vehicle-hours above $5k on board; above ½ cash cap | Secondary |
| **Cost per 1,000 delivered stops** | Vendor billing units × list price, or infra $ ÷ stops — at today, 3×, 10× | Decision input |

### 4.5 Statistical treatment

- **Unit of analysis: the area-day; pairing: same area-day, same seeds, arm vs. arm.** Days are the
  independent blocks (areas within a day share weather and traffic), so effective n = days.
- **Block bootstrap over days**, 10,000 resamples, 95% confidence interval on the paired difference
  for each primary metric; Holm correction across the three primaries.
- **Non-inferiority, not "is it different":** margins in §4.6. With 42 days and a day-level SD of
  the paired on-time difference near 2 points (ASSUMED; re-estimated from the first week) the
  interval half-width is ≈ 0.6 points — tight enough for a 1-point margin. With the 14-day
  GraphHopper subset it is ≈ 1.0 point: adequate, and the reason the margin is not smaller.
- Report peak days and the 3×/10× arms **separately** as well as pooled — an engine that wins on
  average and collapses on 4/20 has not won.
- **Live shadow (4 weeks after go-live):** both adapters receive every real snapshot; only the
  primary's plans are published; the shadow's plans are checked, scored and then simulated forward
  using what actually happened next as the ground truth. Gates G1–G3 are measured on live traffic.

### 4.6 Pass / fail thresholds — for owner approval in advance

**Gates (either engine must pass all to be eligible as primary):**

| Gate | Threshold |
|---|---|
| G1 Hard constraints | **0** published violations; ≤ 0.5% of solves rejected by the checker |
| G2 Solve time | P95 ≤ 5 s at today's peak; ≤ 15 s at the synthetic 10× peak |
| G3 Reliability | ≥ 99.5% of live-shadow solves answered inside the deadline over 4 weeks |
| G4 Coverage | Unassigned-while-feasible ≤ 0.2% of orders (after the deadline ladder) |
| G5 Pins | 100% honoured |
| G6 Brain (applies to us, not the solver) | Quote P99 < 200 ms; replay on-time % ≥ legacy arm A0 **+ 5 points** — if not, the problem is the brain and the solver question is paused |

**Decision rule:**

- **At today's volume** hosted and self-hosted cost about the same and hosted is less upkeep, so
  **GraphHopper keeps the job unless the challenger is better**: superior on at least one primary
  metric (95% CI excludes zero) and non-inferior on the other two. Otherwise the challenger stays
  deployed as the hot spare (L1).
- **From 3× — defined as a 30-day average above 700 orders/day, or a GraphHopper custom-plan quote
  above $1,500/month, whichever comes first — a tie goes to self-hosted:** it becomes primary if it
  is **non-inferior** on all three primaries and churn is not more than 10% higher.
- **Non-inferiority margins:** on-time % — lower CI bound above **−1.0 point**; P95 lateness —
  upper CI bound below **+2.0 minutes**; drive minutes per order — upper CI bound below **+3%**.
- If GraphHopper fails a gate → challenger is primary. If both fail → run whichever scores better
  with L2 behind it and build the OR-Tools adapter (the reserve).
- If yardstick A4 shows both within ~3% of near-optimal on drive time, **stop shopping for solvers**
  — remaining gains are in the ETA model, kit accuracy and dispatch policy, not the engine.

### 4.7 Go / no-go checklist

- [ ] Thresholds in §4.6 approved by the owner, dated, before any replay result is opened
- [ ] DPA with GraphHopper signed; plan tier and limits confirmed from the account dashboard
- [ ] Replay set: ≥ 42 days, ≥ 1 peak day, pseudonymised, in-VPC, retention set
- [ ] Simulator validated: replaying **what actually happened** reproduces actual on-time % within ±2 points
- [ ] Checker proven by refuter tests: each hard constraint has a deliberately-violating plan that is rejected
- [ ] A0–A4 run; controlled and end-to-end arms both reported; peak and scale arms reported separately
- [ ] Cost per 1,000 stops computed from **billed** units (GraphHopper dashboard), not only from the formula
- [ ] 4-week live shadow complete; G1–G3 measured on live traffic
- [ ] Outage drill done: primary adapter killed mid-shift; L1 then L2 took over; no driver-visible gap
- [ ] Decision recorded with the numbers; loser kept as hot spare; re-test date set (every 6 months or at each volume step)

---

## 5. Build plan — phases, sizes, and the security requirement of each piece

Sizes are build-days for the owner + Claude operating model with refuter QA: **S** ≤ 3, **M** 4–8,
**L** 9–15. Phases 0–3 + 6 give a working dispatch system on GraphHopper; 4–5 run in parallel and
produce the decision.

| # | Piece | Size | Depends on | Security requirements specific to this piece |
|---|---|---|---|---|
| 0 | **`dispatch_events` append-only log + legacy replay export spec** (start now — the test's clock starts when data starts) | S | — | Pseudonymise at export (salted hashes; salt in Secrets Manager); coordinates retained ⇒ treat as PII: in-VPC only, 90-day retention, access-logged; the export spec goes to the dev team (`TEAM-TODO.md`), legacy repos stay read-only |
| 1 | **Dispatch core**: schema (`route_plan_versions`, `route_stops`, `dispatch_pins`, `dispatch_policy`, `solver_runs`, `kit_ledger`), snapshot builder, **feasibility checker**, scorer, plan diff | L | 0 | **Per-store/area scoping on every query and every API** (RLS + route policy; a dispatcher for one store can never read another store's drivers, orders or plans); plan rows hold order ids, never names/phones; checker is the single enforcement point for H1–H11 and has refuter tests per constraint |
| 2 | **Insertion engine + quote API** (< 200 ms) + matrix cache in Valkey | M | 1 | Quote API is customer-reachable ⇒ returns a window only — **never** a driver identity, position or route; rate-limited per session and per address to stop it being used as a driver-locator or a coverage-probing oracle; cache keys are snapped road nodes, not addresses |
| 3 | **GraphHopper adapter** + payload minimiser + circuit breaker + billing meter | M | 1 | §5.2 in full; API key in Secrets Manager, **sent as a header, never in a URL** (the legacy HERE call puts its key in the query string — do not copy that); egress allow-list to GraphHopper's host only; request/response bodies logged with coordinates **redacted**; DPA before first call |
| 4 | **Self-hosted stack**: OSRM (SoCal extract, nightly rebuild, populate-then-swap) + VROOM on Fargate + adapter | M | 1 | Private subnets, no public ingress, security-group access from dispatch-core only; images pinned by digest and scanned; OSM extract checksum-verified; no customer data at rest in these containers (stateless) |
| 5 | **Replay simulator + metrics + report** (the decision instrument, §4) | L | 0, 1, 3, 4 | Runs in an isolated account/VPC segment with read-only access to the replay set; vendor arm uses the production minimiser — no "test mode" that sends more; results contain no PII |
| 6 | **Re-opt orchestrator**: triggers, pg-boss singleton per area, debounce, freeze horizon, adoption rule, WebSocket diffs; dispatcher **pin / reassign / bump / rebalance** wiring | L | 1, 2, 3 | **Audit of every override**: who, when, what (order, from-driver, to-driver, pin type), stated reason, plan version before/after — append-only, not editable by dispatchers, visible to admins; pins expire at shift end unless renewed; WebSocket channels authorised per area on subscribe **and** on every message; a driver's socket receives only that driver's route |
| 7 | **ETA model + customer promise** (P50/P80, calibration dashboard, promise-window policy) | M | 6 + 4 weeks of data | Customer-facing ETA page exposes driver position only while that customer's stop is the driver's **next** stop, coarsened, never the rest of the route or other customers' stops; training data = legs and dwell times keyed by pseudonymous ids |
| 8 | **Live shadow (4 weeks) → go/no-go** | S (+ elapsed time) | 5, 6 | Shadow plans are never published or pushed to any device; the shadow adapter has no write path to plans |
| 9 | **Breaks, restock, cash-drop, 30-minute idle-return rule** as first-class plan steps | M | 6 | Break placement must agree with the timesheet/break-compliance engine's rule source; a break the driver app shows is a record with labour-law weight — immutable history |
| 10 | Owner tuning UI (presets, sliders, 7-day what-if) in Routing Config | M | 5, 6 | Policy changes restricted to admin role, versioned, audited, one-click revert |

### 5.1 Data-classification rules for the whole module

- **Driver location is sensitive employee data.** Collected only while `duty_active` (server-side
  gate, already decided). Visible to dispatchers of that area and to admins; every historical-trail
  read is logged with a purpose. Raw 90 days, then summaries. **Never sent to any solver vendor as
  a trail** — a solve request contains one current coordinate per vehicle under an opaque,
  per-request token, which cannot be joined across requests by the vendor.
- **Customer addresses are PII — and here they also imply a cannabis purchase.** Minimise, scope
  and log as above. Geocoding is a second outbound channel that carries the *text* of addresses and
  must be held to the same standard (one provider, DPA, no names).
- **Solver-bound payloads carry coordinates, time windows, durations and unit-less integers.
  Nothing else.**

### 5.2 Vendor payload minimiser (Phase 3) — the allow-list

| Sent | Never sent |
|---|---|
| Latitude/longitude per stop and per vehicle start/end (full precision — rounding breaks routing; this is the residual exposure and the reason a DPA is mandatory) | Customer or driver **names, phones, emails, ids**, order or transaction numbers |
| Time windows, dwell seconds, break windows, shift end | Order **contents** — product names, categories, SKUs (contested SKUs become anonymous indices `sku:0…n`, re-numbered per request) |
| Capacity/load integers, **rescaled by a per-request secret factor** so dollars and units are unreadable | Dollar values, cash amounts, payment type |
| Opaque per-request tokens for vehicles and stops | Anything stable across requests that would let the vendor build a customer or driver history |
| Skill tags as opaque strings | Store names, region names, licence numbers, free-text notes |

Enforced in code as an **allow-list serializer** (unknown fields are dropped, not passed through)
with a test that fails the build if a new field reaches the wire unreviewed. The mapping from
tokens back to orders and drivers exists only in dispatch-core memory for the life of the request.

---

## 6. Risks, and what would change the recommendation

| Risk / unknown | Why it matters | What would change |
|---|---|---|
| **The GraphHopper plan tier is unknown, and legacy dispatch never called GraphHopper** (§0) | Basic = 2 vehicles per request, Standard = 10, Premium = 20. Below Premium it cannot plan one of today's areas in one call | If the account is Basic/Standard: either upgrade to Premium (€479/mo) for the test period, or promote self-hosted to primary from day one with GraphHopper as the comparison arm. "We already pay for it" should not anchor the decision — what is paid for today may be a tier that cannot do this job |
| **Hard-only time windows** (GraphHopper, VROOM) | On surge nights orders drop out of plans instead of running late; the deadline ladder multiplies solves (and vendor credits) exactly when load peaks | If ladder re-solves exceed ~25% of solves in replay, native soft windows become worth paying for → promote **OR-Tools** (self-hosted) or **Google** (hosted) into the test |
| **Kit ledger accuracy** | The best optimiser assigns orders a driver cannot fill if on-vehicle stock is wrong; the legacy check is unsound and history may be unrecoverable | If the ledger cannot be made trustworthy (scan-from-box at pack time, Blaze terminal sync), fall back to category-level eligibility + a driver "can't fill" button that triggers instant re-insertion — and fix inventory before tuning routing |
| **Volume path** | Hosted cost grows ~quadratically (§3.3) | Stays ≤ 1.5× for a year → hosted is fine, keep self-hosted as hot spare. Heads to 3×+ → self-hosted primary unless it loses the test |
| **Live traffic turns out to matter** (freeways, 4–7 pm) | OSRM/VROOM and default GraphHopper are free-flow; learned multipliers may not capture incident days | If ETA calibration stays poor after the learned profile (P80 coverage < 70%): buy GraphHopper's TomTom add-on (get the quote now), or use Google traffic on at-risk legs only, or move the matrix to Valhalla + a feed |
| **VROOM is a black box** | A constraint it lacks cannot be added | A must-have that fails encoding (e.g. multi-trip restock planning inside the solve, time-dependent matrices) → OR-Tools reserve; if fairness/breaks/continuous planning dominate → Timefold |
| **Small-vendor continuity** (GraphHopper GmbH) / **community-project continuity** (VROOM, OSRM, jsprit) | Multi-year system | Mitigated structurally: one interface, two live adapters, in-process L2. No single engine's disappearance stops deliveries |
| **Owner weights are guesses until replayed** | A bad `w_fair` or `w_churn` produces plans drivers hate | The 7-day what-if before every policy change; driver-visible churn is a tracked metric with a gate |
| **Regulatory inputs not primary-sourced today** | Hours (6 am–10 pm), prohibited address types, California meal/rest rules were not re-read from primary text in this pass; §15418 (value cap, 30-minute return) was | Counsel/HR confirm H5, H6 and break windows before Phase 9; they are configuration, not code |
| **Simulator realism** | If the simulator is wrong, the test crowns the wrong engine | The validation gate in §4.7 (replaying reality reproduces reality within ±2 points) and the live shadow |
| **Two incompatible region taxonomies** (bare `RC5` codes vs. `LA-01` shape; four in the estate per `ldata.jsx`) | Areas, spillover bands and driver home zones all key on region ids | Canonical region ids are a precondition of Phase 1 (gap card D1), not something routing should paper over |

---

## 7. Questions for the owner

At most eight, each changes the design. One at a time; recommended option first.

**Q1. When they conflict, what wins?**
- **A. On-time first (recommended)** — late deliveries lose customers and ID-check dwell already eats slack; costs more miles.
- B. Balanced — the default weights in §1.4; nobody's favourite, nobody's disaster.
- C. Fewer driver miles first — cheapest to run; customers wait longer on busy nights.
- D. Even workload first — drivers' earnings and fatigue stay level; both lateness and miles get worse.

**Q2. What do we promise an ASAP customer?**
- **A. A live quoted window per order, e.g. "45–70 min", from our own ETA (recommended)** — honest, and lets us accept orders we can actually serve; customers see different numbers at different times.
- B. One fixed promise, 90 minutes (today's SLA) — simple to market; over-promises on surge nights and under-sells quiet ones.
- C. One fixed promise, 60 minutes — competitive; needs more drivers or will be missed often.
- D. Fixed promise by zone (near 60 / far 90) — simple and fairer than one number; still blind to load.

**Q3. How long is a scheduled delivery window?**
- **A. 1 hour (recommended)** — what the driver-app mock shows; enough room to fit scheduled stops around ASAP work.
- B. 30 minutes — what the dispatcher mock shows; nicer for customers, roughly halves the optimiser's freedom and raises lateness.
- C. 2 hours — cheapest to serve; feels like the cable company.
- D. Customer chooses; shorter windows cost more or need a minimum order — best economics; more checkout complexity.

**Q4. Do drivers keep a zone or float?**
- **A. Home zone, with automatic spillover into neighbouring zones when a zone is at risk (recommended)** — matches the "Buffer Spillover Rules" already in the mock; local knowledge most of the time, relief when needed.
- B. Strictly fixed zones — simplest for drivers and kits; a busy zone runs late while the next one idles.
- C. Fully floating within a hub's whole area — best on-time and miles on paper; kits must be uniform and drivers lose familiarity.
- D. Fixed zones plus dedicated floaters only — what the mock's "RC8 Floater" implies; pays for drivers who are idle on quiet nights.

**Q5. How is a kit restock trip triggered?**
- **A. The system proposes it, the dispatcher confirms (recommended)** — uses demand and kit data, keeps a human on a trip that takes a driver off the road for 30+ minutes.
- B. Fully automatic when the kit can no longer cover forecast demand — fastest; a bad forecast sends drivers home needlessly.
- C. Fixed times only (e.g. mid-shift) — predictable for the hub; ignores what is actually selling.
- D. The driver asks — no system work; relies on drivers noticing, and they notice late.

**Q6. After a customer has been told an ETA, may we re-sequence them?**
- **A. Yes, but only if the new ETA stays inside the window we promised (recommended)** — keeps the promise and most of the optimiser's freedom.
- B. Yes, freely, with an automatic text when it moves more than 10 minutes — best efficiency; customers feel jerked around.
- C. No, never once told — most trustworthy; every new order gets a worse slot and late risk rises through the evening.
- D. Only a dispatcher may — safe; adds manual work at the busiest moments.

**Q7. An order includes something no nearby kit carries. What happens?**
- **A. The best-placed driver swings by the hub to pick it up, then delivers (recommended)** — no extra staff; adds a detour and raises value on board for that leg.
- B. Dedicated hub runners handle all hub orders — kit drivers never detour; runners idle when hub orders are few.
- C. It waits for a driver's next scheduled restock — no detours at all; slow, fits scheduled orders only.
- D. Offer the customer a substitute or a later window at checkout — protects the network; some lost sales.

**Q8. How much of a driver's list may change without a dispatcher?**
- **A. Current stop and the next stop are locked; the rest may change (recommended)** — drivers always know where they are going next; the optimiser keeps most of its freedom.
- B. Only the current stop is locked — best optimisation; "next stop" can change while a driver is walking back to the car.
- C. The whole list is locked once dispatched — calmest for drivers; new urgent orders can only go to the end of someone's list (today's behaviour).
- D. Everything in the next 30 minutes is locked — a middle path; on short routes it is effectively option C.

**Facts to look up rather than decide:** the GraphHopper plan tier and current daily credit use;
the company cash-carried cap per vehicle type; today's share of orders that need a hub pick-up;
whether GraphHopper will quote the TomTom add-on and a custom plan at 3×/10× limits.

---

## Appendix — sources (all read 2026-09-17)

| Topic | URL | Note |
|---|---|---|
| GraphHopper plans, limits, rate limits | https://www.graphhopper.com/pricing/ | Plan table and rate limits as read; TomTom add-on and on-premise pricing **not on the page** |
| GraphHopper credit formulas | https://support.graphhopper.com/support/solutions/articles/44000718211-what-is-one-credit- | Route optimisation, matrix, routing, geocoding |
| GraphHopper Route Optimization schema | https://docs.graphhopper.com/openapi/route-optimization/solvevrp.md | Field names in §3.1; no warm-start field found |
| GraphHopper traffic (TomTom) | https://www.graphhopper.com/blog/2017/11/06/time-dependent-optimization/ · https://docs.graphhopper.com/openapi/map-data-and-routing-profiles/tomtom-multinet | Add-on; price UNVERIFIED |
| GraphHopper open-source engine | https://github.com/graphhopper/graphhopper | Apache-2.0 |
| jsprit | https://github.com/graphhopper/jsprit · https://github.com/graphhopper/jsprit/releases | README says 2.0.0 / Java 21; releases page shows only 1.9.0-beta.x — conflict noted |
| VROOM | https://github.com/VROOM-Project/vroom · https://github.com/VROOM-Project/vroom/blob/master/docs/API.md | BSD-2; v1.14 (2024) |
| OSRM traffic updates | https://github.com/Project-OSRM/osrm-backend/wiki/Traffic | Speed-file re-weighting, MLD |
| Valhalla | https://github.com/valhalla/valhalla · https://valhalla.github.io/valhalla/api/matrix/ | Time-dependent matrix; live + predicted traffic |
| OR-Tools pickup & delivery | https://developers.google.com/optimization/routing/pickup_delivery | Apache-2.0; Python/C++/Java/C# |
| PyVRP | https://pyvrp.org/ · https://github.com/PyVRP/PyVRP | MIT; 1.0.0a0; Enterprise-only features listed |
| Google Route Optimization | https://developers.google.com/maps/billing-and-pricing/pricing · https://developers.google.com/maps/documentation/route-optimization/usage-and-billing | Tiers, per-shipment-per-request billing, 60 QPM |
| Timefold | https://timefold.ai/pricing | Tiers named; **no prices shown** |
| NextBillion.ai | https://nextbillion.ai/pricing | By quote — UNVERIFIED |
| Routific | https://www.routific.com/pricing | Per-order tiers |
| Onfleet | https://www.upperinc.com/blog/onfleet-pricing/ | **Secondary source**; Onfleet's own page not read |
| Amazon Location Service | https://aws.amazon.com/location/pricing/ | Matrix priced per 1,000 elements; rate not visible — UNVERIFIED |
| 4 CCR §15418 (value cap, 30-minute return, request-before-arrival) | https://www.law.cornell.edu/regulations/california/4-CCR-15418 | Primary text via LII; $10,000 at any time; no separate un-ordered-goods cap in current text |

**Not verified today (stated from prior knowledge, flagged inline):** AWS Fargate unit prices;
OR-Tools soft bounds / breaks / route locking API names; Google Route Optimization soft windows and
injected-route fields; jsprit initial-route support; PyVRP competition record and one-to-one
pickup-delivery support; California retail delivery hours (§15403), prohibited delivery locations
(§15416) and Labor Code meal/rest rules; GraphHopper hosting region and network latency from
us-west-2.
