# Logistics wiring plan — connecting the dispatch core to the designed screens

**Date:** 2026-09-17 · **Status:** plan for owner review — nothing here is built. **Read-only
research**: no existing file was edited to produce this document.

**Trigger:** owner instruction 2026-09-17 — when an order's live estimate exceeds the zone's
advertised promise (e.g. Express 90 min), the customer keeps seeing the zone promise, and
"the Hyperdrive logistics module in the admin needs to quickly flag these things for our team to
address ASAP — typically our team will call the customer." This document treats the designs the
owner already approved (`Hyperdrive Logistics.html` + `logistics/*.jsx`, `Hyperwolf Delivery.html`
+ `delivery/*.jsx`, `Hyperwolf Driver App.html` + `mobile/*.jsx`) as the **source of truth for the
experience** and wires the dispatch core (`/Users/jt/wm-demo/platform/modules/dispatch/`) into the
elements that already exist. It does not redesign anything.

**Sources read (all read-only):** `POS-Admin/Hyperdrive Logistics.html`, `logistics/{lviews,lorder,
lparts,lparts2,ldata}.jsx`, `Hyperwolf Delivery.html`, `delivery/{dapp,dmap,ddata}.jsx`, `Hyperwolf
Driver App.html`, `mobile/{app,chrome,data,store,screen-task,screen-discrepancy,screen-activity}.jsx`,
`shared/tour-steps.js` (Logistics + Driver app walkthroughs), `docs/{DRIVER-ASSIGNMENT-MODEL,
ROUTING-ENGINE-PLAN,REALTIME-ARCHITECTURE,SWAP-RECOVERY-FLOW-PLAN,HANDOFF-TO-CODEX}-2026-09-17.md`,
`wm-demo/platform/modules/dispatch/{README.md,types.ts,config.ts,score.ts,quote.ts,holds.ts,
staging.ts,release.ts,budget.ts,insertion.ts,constraints.ts}`.

---

## 1. What the designs already contain

### 1.1 Board view (`logistics/lviews.jsx::BoardView`, `Hyperdrive Logistics.html` default entry)

| Element | File:line | Labels as written | Static mock or has logic? |
|---|---|---|---|
| Hero strip (6 tiles) | `lviews.jsx:141-151`, `lparts.jsx:6-33` | "At risk of breach" / "Understaffed regions" / "Unassigned" / "Idle drivers" / "Scheduled" / "On-time" | **Has logic** — `L.HERO(orders, drivers)` (`ldata.jsx:201-215`) derives every number from the live `orders`/`drivers` arrays client-side; three tiles are clickable filters (`onClick`→`pick(k)`) |
| Region command board (cards) | `lviews.jsx:229-262`, `lparts.jsx:111-175` (`LRegionCard`) | "Region command board", per-card "Healthy"/"Tight"/"Surge" pill, "Riskiest order" %, "on-time chance" | **Has logic** — `L.allRegionStats` (`ldata.jsx:151-167`) computes `worst` (min risk in region), `health`, `demand`/`capacity` from live orders/drivers |
| Live alerts panel | `lviews.jsx:248-260`, `lparts.jsx:92-108` (`LAlertRow`) | "Live alerts" / "Flagged the moment it happens"; filter chips All/Unassigned/SLA risk/Capacity/Drivers | **Static mock data** — `L.ALERTS` is a **hard-coded array of 6 rows** (`ldata.jsx:192-199`), not derived from `orders`/`drivers`. Each alert already carries `sev` (bad/warn/info), `type` (unassigned/capacity/sla/driver), `icon`, `title`, `body`, `region`/`order`/`driver`, `acts` (action keys), `at`. This is the exact shape the wiring plan reuses (§2) |
| Alert row actions | `lparts.jsx:96-97`, `lviews.jsx:30-40` (`makeAlertHandler`) | Buttons: "Assign driver", "Rebalance", "Reassign", "Bump", "Message", "End break", "View run" | **Has logic for local demo state only** — clicking calls `s.reassign`/`s.setFlash`, no backend call, no "Call customer" action anywhere in the codebase |
| Unassigned banner (page-level) | `lviews.jsx:403-409` | "N orders unassigned — need a driver now" + chips + "Review all" | **Has logic** — derived live from `orders.filter(o => !o.driver && !o.sched)` |

### 1.2 Map view (`lviews.jsx::MapView`, `lorder.jsx::LLiveMap`)

| Element | File:line | Labels | Static or logic |
|---|---|---|---|
| Pin color/shape | `lorder.jsx:71-80` | Red teardrop `!` = unassigned, colored by risk band otherwise | **Has logic** — `L.riskBand`/`L.riskColor` (`ldata.jsx:145-147`) — `ok` ≥0.85, `warn` ≥0.70, else `bad` |
| Legend | `lorder.jsx:85-88` | "Unassigned / at risk" / "Tight SLA" / "On track" / "driver route" | Static labels, colors driven by the same risk bands |
| Order popover/sheet | `lorder.jsx:81-83`, `LOrderDetail` (`lorder.jsx:305+`) | See §1.3 | Mixed |
| Order list rail (right) | `lviews.jsx:295-319` | Sort options: "Worst SLA", "Unassigned first", "By region", "By driver", "By county" | Has logic, client-side sort |
| Driver route paths | `lorder.jsx:44-58` | dashed line + direction arrows | Has logic — drawn from `d.mx/my` to each assigned order in risk order |

### 1.3 Order detail / sheet (`logistics/lorder.jsx::LOrderDetail`, used by Board/Map/Lanes/New-order)

| Field | File:line | Label as written | Static or logic |
|---|---|---|---|
| Header risk chip | `lorder.jsx:335` | `{risk%}` + `· +{late}m` | Has logic — `o.risk`, `o.late` are per-order mock fields, not computed against a "zone promise"; there is **no zone-promise concept anywhere in this file** (see §1.6 gap) |
| Driver / "No driver assigned" reason | `lorder.jsx:366` | "Why: {o.noCandReason}" | Static string per mock order (`ldata.jsx:80-97`, `noCandReason` field) — e.g. *"All RC5 Redlands drivers are over SLA capacity..."* — this is exactly the shape an engine `InsertionInfeasibility.reasons[]` (§5) should fill |
| Schedule tiles | `lorder.jsx:372-379` | "ETA" / "SLA deadline" / "Placed" | Has logic, reads `o.eta`/`o.deadline`/`o.placed` |
| Items + swap + add | `lorder.jsx:381-396` | "Items · {count}", "Add items" | Has logic against mock catalog (`window.HW.PRODUCTS`) |
| Payment / promo | `lorder.jsx:398-413` | "Payment", promo code entry | Has logic (mock) |
| Activity log | `lorder.jsx:414-420` | "Activity log" · "{n} events" | Has logic — `L.activityFor(o)` (`ldata.jsx:250-260`) synthesizes events from order fields; **always open, never collapsed** per `tour-steps.js:349` ("the record ... if there is ever a dispute, this is what settles it") |
| Footer actions | `lorder.jsx:423-428` | "Reschedule" / "Cancel" / "Save" | Has logic (local state only) |
| Customer profile (inline + modal) | `lorder.jsx:339-357`, `LCustomerProfile` (`lorder.jsx:275-302`) | Phone shown **unmasked** (`cust.phone`), tier badge, "Behaviour flags", "Call" / "Message" buttons | Has logic for tier/notes; **"Call" button only does `onFlash('Calling {name}…')` — no real call, no outcome logging, no masking** (`lorder.jsx:295-296`) |

### 1.4 Lanes view (`lviews.jsx::LanesView`, `lparts2.jsx::LDriverLane`)

| Element | File:line | Label | Static/logic |
|---|---|---|---|
| Driver lane header | `lparts2.jsx:52-61` | Pill: "On duty"/"Idle"/"On break"/"On meal"/"Out of service" | Has logic, from `driver.status` |
| Load bar | `lparts2.jsx:62-66` | "Load {n}/4" | Has logic — `stops.length` vs hard-coded cap 4 |
| Idle callout | `lparts2.jsx:70` | "Idle {n} min" / "Available — drag an order here" | Has logic |
| Break/meal callout | `lparts2.jsx:69` | "{n} min break" / "{n} of {plan} min · over plan" | Has logic — flags over-plan breaks already, no alert wired to it though |
| Stop card | `lparts2.jsx:71-84` | ETA / SLA / Total, VIP/NEW badge, ★ high-value | Has logic |
| Lane footer | `lparts2.jsx:86-91` | "Call" / "Message" / "Status" | "Call"/"Message" are `onFlash` no-ops; "Status" opens a real (mock) menu |

### 1.5 Settings modal (`lviews.jsx::SettingsModal`, lines 163-188)

Categories (tab list, `lviews.jsx:165`): **Failure Reason, Announcements, Transportation,
Checklist, Checkout, Out of Service, Buffer Spillover Rules, Routing Config**. Only three
categories have real field bodies today; the rest render a placeholder string
(`lviews.jsx:175`, *"{cat} settings · configure and save from here"*):

| Category | Fields (as written) | File:line |
|---|---|---|
| **Routing Config** | SLA (90 min), SLA buffer (10 min), Risk OK ≥ (0.85), Risk BAD < (0.70), Idle start (10 min), KM cap (20), Load spread cap (4), Buffer penalty (−0.35) | `lviews.jsx:169-171`, values from `ldata.jsx:20` (`CFG`) |
| **Transportation** | Bicycle / Bike / Car toggles | `lviews.jsx:172` |
| **Out of Service** | Route Issue/Delay, Family emergency, Paperwork pending, Failure, Accident, Maintenance (edit only, not wired) | `lviews.jsx:173` |
| **Buffer Spillover Rules** | Per-region "4000 m" (hard-coded, not per-region in the mock) | `lviews.jsx:174` |
| Failure Reason, Announcements, Checklist, Checkout | Placeholder body only | `lviews.jsx:175` |

### 1.6 Delivery module (`delivery/dapp.jsx`, `ddata.jsx`, `dmap.jsx`)

Region settings (Hours, Min order, Delivery fee, Buffer) cascade county → sub-region with an
"Override"/"Central" tag (`dapp.jsx:145-166`, `413-426`). **There is no "advertised promise" /
zone SLA-ceiling field anywhere in the Delivery module or the Logistics Routing Config** — the
only per-region timing concept in the whole front end is the KML **buffer distance** (miles), a
geographic spillover radius, not a delivery-time promise. **This is the design gap the owner's
trigger scenario needs** — see §2's "no fit" row and §6 Q1.

### 1.7 Driver app (`mobile/*.jsx`)

| State | File:line | Notes |
|---|---|---|
| On/off duty | `mobile/store.jsx:11`, `chrome.jsx:6-33` (`DutySwitch`/`DutyToggle`) | Real toggle, persisted to `localStorage` |
| Break active | `mobile/store.jsx:14,48-49`, `chrome.jsx:73-93` (`BreakBanner`) | `{label, endsAt}`, banner counts down |
| Task status | `mobile/data.jsx:23,250-254` — contract enum `TaskStatus`: `not_started`/`in_progress`/`completed`/`cancelled` | Drives `screen-task.jsx` |
| Mis-stock / discrepancy | `mobile/screen-discrepancy.jsx:33-88` (`InvCard`) | Driver-filed count/damage/refusal, status + note — this is the **existing discrepancy filing surface** |
| In-task governed swap | `mobile/screen-task.jsx:283-507` (`MGovernedSwapSheet`), `test/driver-governed-swap.test.mjs` (891 lines) | Per `SWAP-RECOVERY-FLOW-PLAN-2026-09-17.md` §1.4, this is **"the most complete implementation of the recovery scenario, on the wrong screen"** — it is a driver self-service flow, not the admin-side "flag it, call the customer" flow the owner is asking for here |
| ETA slack chip | `mobile/data.jsx:86-89` | "{n} min late" / "{n} min ahead" / "On time" — driver-side equivalent of the risk chip |

---

## 2. Signal map — engine output → existing UI element

Severity: **P0** bad/red, **P1** warn/amber, **P2** info/blue — matches `LAlertRow`'s existing
`sev` values (`lparts.jsx:94-95`) and `riskBand`'s `bad`/`warn`/`ok` (`ldata.jsx:145-147`).

| Engine signal | Existing UI element | Sev | Wording (drop-in `LAlertRow`/chip copy) | One-tap actions | Realtime channel/event |
|---|---|---|---|---|---|
| **At-risk order** — `quote.ts`/`sequence.ts` P80 ETA beyond `expressCeilingSec` (region override) or `promiseWindow.latest` (`types.ts:74-78`, `H12_PROMISE_WINDOW`) | New alert type in **Live alerts panel** (`lparts.jsx:92`) — extend `type` enum with `'promise'`; order-row risk chip (`lorder.jsx:335`) gains a **minutes-over** suffix | **P0** | *"Order #{id} is {n} min over the {zone} promise"* — body: *"Live estimate {etaP80}, promised by {latest}. {driver} is {load} stops deep."* | **Call customer** (new, see §3), Reassign, Bump | `hw:<stage>:store:<store_id>:dispatch-alerts`, event `promise_breach` |
| **At-risk zone** — `score.ts::homeZoneAtRisk` (every home-region non-floater vehicle late-risk, or none exists) | **Region command board** card (`lparts.jsx:111-175`) — health pill already has "Surge"; add a **promise-risk** reason line under it, distinct from today's capacity-only "Surge" | **P0/P1** | *"{region} — every driver is running behind the {zone} promise"* | Rebalance, Pull floater (new) | same channel, event `zone_at_risk` |
| **Driver starving/idle** | Existing "Idle drivers" hero tile (`lparts.jsx:29`) and `LDriverLane`'s idle callout (`lparts2.jsx:70`) — already wired to `driver.status==='idle'`/`d.idle` | P2 | unchanged | Assign (existing), Rebalance | `driver-positions` channel already defined (`REALTIME-ARCHITECTURE.md:177`) carries status; no new channel needed |
| **Driver overloaded** | `LDriverLane` load bar (`lparts2.jsx:62-66`), already flags `over = stops.length>=3` | P1 | unchanged | Rebalance | plan-diff channel (§5) |
| **Soft holds outstanding** | **No existing element.** Closest: none — holds are invisible today | — | *(design gap — §2 "no fit")* | | |
| **Staged orders waiting + release reason** | **No existing element.** The Board/Map/Lanes views show only `driver: null` (unassigned) or `driver: name` (assigned) — there is no third "staged, pencilled but not yet shown to driver" state anywhere in the mock | — | *(design gap — §2 "no fit")* | | |
| **Pinned stops** | **No existing element.** `LOrderActions`/`InlineReassign` have no pin affordance; `types.ts::Pin` (engine) has no UI counterpart | — | *(design gap — §2 "no fit")* | | |
| **Re-sequence events** | **Activity log** (`lorder.jsx:414-420`, `L.activityFor`) — already a generic append-only event list; add an event kind `resequenced` | P2 | *"Re-sequenced by dispatch engine — ETA moved from {old} to {new}"* | (none, informational) | plan-diff channel, event `resequence` |
| **Vendor-credit budget state** | **No existing element** — Routing Config has no vendor line at all | — | *(design gap — §2 "no fit")* | | |
| **Mis-stock / swap recovery in progress** | Driver: `DiscrepancyScreen`/`InvCard` (`mobile/screen-discrepancy.jsx`) already exists for filing. Admin: **no existing element** shows an in-progress recovery swap on the order sheet | P1 | Order sheet: add a banner *"Recovery swap in progress — {driver} at the door, item #{sku} short"* above `OrderActionModal` | Open swap (new — deep-link to admin governed-swap surface, `SWAP-RECOVERY-FLOW-PLAN §5` names none exists yet either) | fire-and-forget inventory-discrepancy incident per `SWAP-RECOVERY-FLOW-PLAN-2026-09-17.md:20-21` |
| **Off-duty / break states** | `LDriverLane` pill + break callout (`lparts2.jsx:49,69`) — already correct; only gap is the **over-plan break** (`driver.brk > driver.brkPlan`) is displayed but never raises an alert row | P1 (over-plan only) | *"{driver} over break — {taken} min taken, {planned} planned"* (mirrors existing mock alert `a4`, `ldata.jsx:196`) | Message, End break (both exist already) | `driver-positions`/presence channel (`REALTIME-ARCHITECTURE.md:362-365`) |
| **Stale location** | **No existing element.** Map pins never show a "last seen" age | — | *(design gap — §2 "no fit")* — recommend reusing the existing pin styling with a dimmed/dashed outline once built | | presence heartbeat TTL already designed (`REALTIME-ARCHITECTURE.md §Part 6 presence.ts`) |

**Design gaps requiring four concepts (desktop + phone) before build**, per standing rule:
1. Soft-hold visibility (dispatcher-facing — is there any UI need at all, or is this purely internal?).
2. Staged-but-not-released order state (a real UI state distinct from "assigned"/"unassigned").
3. Pin affordance (pin/unpin control + "pinned orphan" alert, `DRIVER-ASSIGNMENT-MODEL.md:722-725`).
4. Vendor-budget dashboard (today's usage vs. `vendorDailyCreditBudget`, §7 of that doc already names this as an owner-facing screen row).
5. Admin-side mis-stock/swap-recovery banner + "Open swap" action (today's admin swap surfaces are POS-only, per `SWAP-RECOVERY-FLOW-PLAN-2026-09-17.md` §1.5's own verdict that neither existing admin swap screen fits).
6. Stale-location pin treatment.

None of these six are designed today — they are listed, not designed, per the task's instruction.

---

## 3. The "call the customer" loop

**What the alert shows** (extends the existing `LAlertRow`/order-sheet banner, no new component
family): order id, promised time (zone ceiling or `promiseWindow.latest`), live P80 estimate,
minutes over, driver name, reason (`InsertionInfeasibility.reasons[]` or `homeZoneAtRisk`
explanation), and the customer's phone **masked** (`(951) •••-0211`, tap to reveal) — the existing
`LCustomerProfile`/`LOrderDetail` show `cust.phone` **unmasked today** (`lorder.jsx:345`,
`lorder.jsx:285`), which is the one existing behavior this plan must correct, not just add to.

**Recording the outcome.** A new small modal off the existing "Call customer" button (same visual
language as `OrderActionModal`, `lorder.jsx:202-272`) with outcome radio buttons: **Reached —
accepts new estimate** / **Reached — wants to cancel** / **Reached — wants a scheduled slot** /
**Voicemail / no answer**. Each outcome:
- writes one `dispatch_decision`-shaped audit row (same append-only shape already specified for
  re-assignment, `DRIVER-ASSIGNMENT-MODEL.md:718-720`: trigger code, actor, timestamp, before/after)
  extended with `outcome`, `revealedPhoneAt` (audit for the phone-reveal, per the PII rule below);
- feeds the existing **activity log** (`L.activityFor`, `ldata.jsx:250-260`) as a new event kind
  `promise_call` so it shows in the order sheet without a new panel;
- **"wants a scheduled slot"** routes into the existing `OrderActionModal` reschedule flow
  (`lorder.jsx:202-272`) rather than inventing a second reschedule UI;
- **"wants to cancel"** routes into the existing cancel flow, which already supports a hot-note
  (`lorder.jsx:227`) — reuse it, tag the cancellation reason as promise-breach-driven.

**Clear / re-fire.** The alert clears when (a) the live P80 drops back under the ceiling on a
later re-sequence, or (b) an outcome is recorded. It re-fires if the estimate crosses the ceiling
again after a "Reached — accepts new estimate" outcome and the gap grows past
`etaChangeNoticeMinutes` (3 min, `config.ts:340`) beyond what was told on the call — mirroring the
existing re-assignment "no return within 30 min unless a dispatcher says so" hysteresis
(`DRIVER-ASSIGNMENT-MODEL.md:703`), applied here to re-alerting instead of re-assigning.

**SLA timers for the team.** Flag within a configurable N seconds of the estimate crossing the
ceiling (recommend reusing `etaChangeNoticeMinutes`'s existing 3-minute debounce logic, not a new
number, to avoid a second copy of the same knob — `BUILD-AGAINST-THE-SOURCE.md` §3 posture already
applied elsewhere in this codebase, e.g. `ldata.jsx:120-129`'s own tax-formula consolidation
comment). Escalate (bump severity P1→P0, or widen from dispatcher-only to a supervisor view) if
unacknowledged after a second configurable window — no existing UI concept for "acknowledged" vs.
"unacknowledged" alert state, so this needs a small addition to `LAlertRow` (a dismiss/ack control)
rather than a new screen.

**Audit trail.** Every step (flag raised, call attempted, outcome recorded, alert cleared/re-fired)
is one row in the same audit mechanism `DRIVER-ASSIGNMENT-MODEL.md §5` already specifies for
re-assignment decisions — this is additive to an existing mechanism, not a new one.

---

## 4. Settings reconciliation

Three columns: designed `SettingsModal` field (`lviews.jsx:169-174`) ↔ dispatch-core config key
(`wm-demo/.../dispatch/config.ts`) ↔ legacy Hyperdrive admin tunable (from
`DRIVER-ASSIGNMENT-MODEL.md` §6.1, which already reconciled legacy → new-model; this table adds the
third column, the mock UI).

| Designed field (Routing Config tab) | Dispatch-core config key | Legacy tunable (verdict in `DRIVER-ASSIGNMENT-MODEL.md`) | Status |
|---|---|---|---|
| SLA (90 min) | `expressCeilingSec` (90×60) + per-region `LicensedRegion.expressCeilingSec` override | SLA (90) — **Kept, per zone** | **Renamed** — mock's single global number becomes a per-zone override; UI needs a per-region row (Buffer Spillover Rules tab already has a per-region list pattern, `lviews.jsx:174`, reuse it) |
| SLA buffer (10 min) | *(removed — replaced by the on-time guard)* | SLA Buffer (10) — **Replaced** by `guard.maxLateProb` + P80 quote | **Missing on new side as a literal field** — UI field becomes "On-time guard %" (`lateRiskProbabilityThreshold`, default 0.20 in `config.ts:383`, though `DRIVER-ASSIGNMENT-MODEL.md:780` recommends 0.10/0.05/0.15 per preset) |
| Risk OK ≥ (0.85) / Risk BAD < (0.70) | *(removed — replaced by probability bands)* | **Replaced** by `riskBands.tight` 0.10 / `riskBands.atRisk` 0.35 | **Renamed + re-scaled** — mock's 0..1 "confidence" score inverts to a 0..1 "late probability"; a straight relabel will invert the direction of every existing color rule (`ldata.jsx:145-147`) if not done carefully |
| Idle start (10 min) | `idle.startMin`/`idle.maxMin` (10/25, new keys, not yet in `config.ts` — `DRIVER-ASSIGNMENT-MODEL.md:796`) | Idle Start / Idle Max — **Kept** | **Kept**, needs the second (`idleMax`) field added to the modal, which mock currently omits |
| KM cap (20) | *(not in `config.ts` today — `vehicleProfile[*].maxApproachKm`, new)* | KM Cap (20) — **Kept** | **Kept**, needs per-vehicle-profile split (car 20 / bike 12 / bicycle 5 per the doc) vs. today's single flat number |
| Load spread cap (4) | `loadSpreadCapStops` — **in `DRIVER-ASSIGNMENT-MODEL.md` table as new, not yet in `config.ts`** | Load Spread Cap (4) — **Kept** | **Kept**, same default, needs adding to `config.ts` |
| Buffer penalty (−0.35) | *(removed — replaced by graded zone-distance weight)* | Buffer Region Penalty — **Replaced** by `w_zone` × boundary-distance ratio | **Removed as a literal field**, replaced by the "Keep drivers in their zone" slider named in `DRIVER-ASSIGNMENT-MODEL.md:793` |
| *(no field today)* | `weights.wLateAsap`/`wLateSched`, `wFair`, `wZone`, `wDrive`, etc. (`config.ts:130-322`, all present) | Weight → ETA/Load/Risk/Buf — **Replaced** | **New** — six plain-word sliders per `DRIVER-ASSIGNMENT-MODEL.md:816-818`: On-time, Fewer miles, Even workload, Don't disturb customers, Don't reshuffle drivers, Keep drivers in zone |
| Buffer Spillover Rules (per-region "4000 m", hard-coded in mock) | `spilloverBandMeters` (global, `config.ts:333`) / `spilloverBandMeters[region]` (per-region, recommended new) | Buffer Spillover distance — **Kept**, needs per-region map | **Kept**, mock is closer to the target shape here than Routing Config is (already a per-region list) |
| *(no field today)* | `holdTtlSec` (10 min), `sequenceTimeBoxMs`/`sequenceTotalBudgetMs`, `releaseBatchFullSize`/`releasePrepBufferSec` | *(no legacy equivalent — new pipeline, §4-5 of the doc)* | **New**, engineering-only (`E` in the doc's who-sees-it column) — do not surface in the owner-facing modal |
| *(no field today)* | `vendorDailyCreditBudget`/`vendorRegionDebounceSec` | *(no legacy equivalent)* | **New**, owner sees the cap only per `DRIVER-ASSIGNMENT-MODEL.md:811,819` |
| Transportation (Bicycle/Bike/Car toggles) | `Vehicle.profile` enum (`types.ts:46-47`, `["car","bike","bicycle"]`) | Transportation types — **Kept, made real** | **Kept** — mock already matches the engine's enum values |
| Out of Service reasons | *(driver state, not a `DispatchConfig` field — `Vehicle.onDuty`/trigger T1)* | Out-of-service reasons — **Kept** | **Kept**, this is driver-state data, not a routing weight; stays as-is |
| Failure Reason / Announcements / Checklist / Checkout tabs | *(no dispatch-core equivalent — these are POS/onboarding concerns, not routing)* | *(not covered by either plan)* | **Out of scope for this wiring** — leave as placeholder tabs, not part of the dispatch core |

---

## 5. API + events the screens need

**Scopes**: `dispatch:read` (Board/Map/Lanes/alerts, all GET), `dispatch:write` (reassign, pin,
release-now, call-outcome, settings edits) — following the existing `authz.requireStore`/
`requireEntity` pattern named in `REALTIME-ARCHITECTURE-2026-09-17.md:282-288`; a
`dispatch:admin` scope for the vendor-budget cap and per-preset schedule (owner-only fields per
`DRIVER-ASSIGNMENT-MODEL.md §6.2`'s **O** column). All routes store-scoped (`store_id` from the
Principal, never client-supplied) per the same doc's security posture.

| Route | Method | Scope | Payload contract (shape) | Backs |
|---|---|---|---|---|
| `/api/dispatch/alerts` | GET | `dispatch:read` | `{id, sev, type, icon, title, body, region?, order?, driver?, acts[], at, ackedAt?, clearedAt?}[]` — same shape as today's mock `L.ALERTS` (`ldata.jsx:192-199`) plus `ackedAt`/`clearedAt` (§3) | Live alerts panel |
| `/api/dispatch/orders/:id/promise-status` | GET | `dispatch:read` | `{promised: IsoInstant, ceilingSec, etaP50, etaP80, minutesOver, driverId, reasons: string[]}` | Order-sheet risk chip, alert body |
| `/api/dispatch/orders/:id/call` | POST | `dispatch:write` | request `{outcome: 'reached_accepts'|'reached_cancel'|'reached_scheduled'|'voicemail', note?}`; response `{auditId, activityEvent}` | "Call customer" modal (§3) |
| `/api/dispatch/orders/:id/reveal-phone` | POST | `dispatch:write` | `{}` → `{phone, revealedAt, auditId}` — **audited every time**, per PII rule below | Masked-phone reveal |
| `/api/dispatch/orders/:id/reassign` | POST | `dispatch:write` | `{toDriverId, reason?}` → `PlanDiffOp` (`types.ts:240-245`) | Existing reassign UI (`InlineReassign`, `LReassign`) |
| `/api/dispatch/orders/:id/pin` | POST | `dispatch:write` | `{position?, expiresAt}` → `Pin` (`types.ts:146-157`) | New pin control (design gap §2) |
| `/api/dispatch/regions/:id/rebalance` | POST | `dispatch:write` | `{}` → `PlanDiff` | Existing "Rebalance" buttons |
| `/api/dispatch/staged/:regionId` | GET | `dispatch:read` | `StagedOrder[]` (`staging.ts:17-32`) | New staged-queue view (design gap §2) |
| `/api/dispatch/staged/:orderId/release` | POST | `dispatch:write` | `{}` → `ReleaseDecision` (`release.ts:19-24`) | New "Release now" action |
| `/api/dispatch/config` | GET/PUT | `dispatch:read`/`dispatch:admin` | `DispatchConfig` subset matching §4's **O** rows only | Settings modal |
| `/api/dispatch/vendor-budget` | GET | `dispatch:admin` | `{creditsUsedToday, dailyCap, callsToday}` (`budget.ts::creditsUsedToday/callsToday`) | New vendor-budget row (design gap §2) |

**Realtime**: ids-only push, gated refetch — per `REALTIME-ARCHITECTURE-2026-09-17.md` Part 4's
own rule ("publish only the delta ... never the whole plan"). Channel naming follows the **actual**
convention already specified there (`hw:<stage>:store:<store_id>:<topic>`, `REALTIME-
ARCHITECTURE.md:177,360-361`) — not the `dispatch.store.:storeId` shorthand used to brief this
task, which does not match any file read. Recommended topics: `driver-positions` (already
specified), `dispatch-alerts` (new — `{alertId}` on raise/clear, client refetches
`/api/dispatch/alerts`), `plan-deltas` (new — `{orderId, op}` per `PlanDiffOp`, client refetches
the one affected order/region, never the whole board).

**Phased build order:**
1. **XS** — `/api/dispatch/orders/:id/promise-status` read-only + wire the existing risk chip to show minutes-over. Probe: does an order whose P80 crosses the ceiling show the new suffix within one poll cycle.
2. **S** — Live-alerts panel reads from a real feed instead of `L.ALERTS`; add `type: 'promise'`. Probe: an order crossing its ceiling produces exactly one new alert row, not a duplicate on every poll.
3. **S** — "Call customer" modal + `/orders/:id/call` + masked phone + `/reveal-phone` audit. Probe: reveal is logged even when the call is never actually placed; masked number never appears in any network payload before reveal.
4. **M** — `dispatch-alerts` realtime channel wired to the panel (replace polling). Probe: kill the socket mid-session, confirm the panel falls back to polling rather than going silent.
5. **M** — Settings-modal Routing Config tab rewired to real `DispatchConfig` (§4's renamed/kept fields only — do not ship the removed fields as dead UI). Probe: editing a slider round-trips through `PUT /api/dispatch/config` and the board's own live numbers change on the next poll.
6. **L** — Staged-queue view, pin control, vendor-budget row (the three design-gap items with the clearest existing engine support) — **blocked on the four-concepts design pass**, not on backend work.

**Security notes** (restating, not inventing, per `REALTIME-ARCHITECTURE-2026-09-17.md` Part 5 and
`DRIVER-ASSIGNMENT-MODEL.md`'s own audit posture):
- Customer phone and address are PII: **masked by default** everywhere they render (the one place
  the current mock violates this, `lorder.jsx:285,345`); every reveal is an audited write, not a
  read, because it is a decision to expose PII, not a passive display.
- Driver location is visible only while `onDuty` — `REALTIME-ARCHITECTURE-2026-09-17.md:189`
  ("PII and off-shift tracking — impossible by construction, not by policy") already commits to
  this at the pipeline level; the UI must not add a code path that queries a driver's last known
  position after clock-out.
- Every dispatcher action (reassign, pin, release-now, call outcome, settings edit) is audited —
  reuses the existing `dispatch_decision` audit shape (`DRIVER-ASSIGNMENT-MODEL.md:718-720`)
  rather than a second audit table.

---

## 6. Owner questions

**Q1 (recommended first).** The zone "advertised promise" (Express 90 min, or a per-zone override)
does not exist as a concept anywhere in the current Logistics/Delivery mock — Routing Config has
one global "SLA (90 min)" number, and Delivery's per-region settings only cover hours/min-order/
fee/buffer-distance, not a delivery-time promise. Where should the team see and edit the per-zone
promise ceiling?
- A. A new field inside the existing per-region list on the Buffer Spillover Rules tab (recommended — that tab is already the one per-region settings list in the mock).
- B. A new dedicated "Zone promises" tab in the same Settings modal.
- C. Move it into the Delivery module's per-region settings instead (`delivery/dapp.jsx` `SettingRow`/`EditableSetting`), since that is where hours/fee/buffer already live.
- D. Both B and C, kept in sync automatically.

**Q2.** The "call the customer" alert needs to show the customer's phone. Today the mock shows it
unmasked everywhere (order sheet, customer profile). Should the masked-until-tapped rule apply
only to this new promise-breach alert, or should it also retroactively mask the phone in the
existing customer-profile and order-sheet views this plan does not otherwise touch?
- A. Mask everywhere the phone renders, including the two existing unmasked spots (recommended — one PII rule, not two).
- B. Mask only in the new alert; leave the existing order-sheet/profile views unmasked as designed.
- C. Mask everywhere except for dispatchers with a specific elevated role.
- D. No masking anywhere — treat this as out of scope for this wiring pass.

**Q3.** `DRIVER-ASSIGNMENT-MODEL-2026-09-17.md` §8 Q3 already asks a closely related but distinct
question — what the *customer* sees when a zone is overloaded (its recommended answer: the honest
longer window with a one-tap scheduled-slot offer). That question is still open and is not
re-asked here. Given Q3's answer will decide whether the customer ever sees a longer window at
all, should the internal alert in this plan fire on *every* promise breach regardless of what the
customer is shown, or only on breaches the customer was NOT already warned about (i.e., only when
Q3 resolves to option C, "keep showing the zone promise and accept the risk")?
- A. Fire on every breach regardless of customer-facing behavior (recommended — the team needs to know either way, since even a warned customer may want a call).
- B. Fire only when the customer was not proactively told (i.e., only matters if Q3 = C).
- C. Fire on every breach, but only enable "Call customer" as the primary action when the customer was not told; otherwise default to a lower-severity "FYI" tier.
- D. Defer this decision entirely until Q3 is answered.

**Q4.** Should the escalation-if-unacknowledged step (§3) page a supervisor, or only raise the
alert's severity within the same Live Alerts panel the dispatch team already watches?
- A. Raise severity in-panel only, no separate paging (recommended — matches how every other alert in the mock already works, no new notification channel).
- B. Also send a Discord alert (the estate already has a call-off Discord routing precedent, `calloff-discord-routing` memory) to a dispatch channel.
- C. Also send an SMS/push to a named on-call dispatcher.
- D. Both B and C.

**Q5.** The six design-gap items in §2 (soft holds, staged-queue state, pin control, vendor-budget
row, admin swap-recovery banner, stale-location pin) all need four concepts (desktop + phone)
before any is built, per the standing rule. Should all six go into one combined design pass, or
should the swap-recovery banner (tied to this week's `SWAP-RECOVERY-FLOW-PLAN` work) be split out
and prioritized first since it already has open owner questions of its own?
- A. Split the swap-recovery banner out and prioritize it with that plan's own owner questions (recommended — avoids two teams designing overlapping surfaces independently).
- B. One combined pass across all six.
- C. Prioritize whichever the dispatch build reaches first, decided at build time.
- D. Defer all six until after the promise-breach alert (§2's core signal map) ships and is validated.
