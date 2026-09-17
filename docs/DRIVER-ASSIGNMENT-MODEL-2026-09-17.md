# Driver assignment model — how the best driver is picked today, and the scoring model for the new dispatch core

**Date:** 2026-09-17 · **Status:** design for owner review — nothing here is built, deployed or pushed.
**Companion to:** `ROUTING-ENGINE-PLAN-2026-09-17.md` (solver choice, shadow test). This document is
the layer above it: **who gets the order, where in their list, when it reaches their phone, and when
it may move.** Units, weights and thresholds are kept consistent with that plan (§1.4, §2.3, §4.4–4.6).
**Owner inputs this answers:** "favour ALL FOUR — on-time, balanced, even workload, fewer miles";
"look at the Hyperdrive logistics admin settings"; plus the 2026-09-17 additions — best driver fetched
at **address selection**, order **staged** before it reaches a driver, staged orders considered
**jointly**, **fast and no vendor-usage burn**, and the ASAP promise = **live quoted window inside a
fixed zone ceiling**.

**Evidence labels:** `CONFIRMED` = read in code today, file:line given · `UI-ONLY` = the field exists on
an admin screen but the server code behind it is **not in our clones**, so its effect is inferred ·
`ASSUMED` = a starting number nobody has measured · `SCREENSHOT` = a value transcribed into the mock
from a July 2026 screenshot, not re-verified today. Repos (all read-only, no `.env` read):
`HB` = `/Users/jt/hyper-tech/hyperdrive-backend`, `WB` = `/Users/jt/hyper-tech/hyperwolf-backend`,
`SA` = `/Users/jt/hyper-tech/hyperwolf-super-admin`, `DB` = `/Users/jt/hyper-tech/distribution-backend`,
`CORE` = `/Users/jt/wm-demo/platform/modules/dispatch`, `MOCK` = `/Users/jt/POS-Admin/logistics`.

---

## Owner summary (one page, plain language)

**1. The most important finding: the engine that picks drivers in production today is not in the code
we were given.** The Hyperdrive admin has a *Routing Config* screen with 34 settings on it (weights for
ETA, distance, idle time, load, risk, buffer zone, schedule; an "outage" mode; scheduling look-ahead
and freeze). That screen saves to a server address (`/api/v1/admin/rankConfig`) that **does not exist
in any of the twelve repositories we cloned**. The backend's own README describes a folder called
`swiftAssign/` — "weighted driver-ranking + reassignment engine" — and that folder is missing from the
clone too. So there are two "todays": the **older helper code we can read** (nearest driver, new order
added to the end of the list), and the **live scoring engine we can only see through its settings
screen**. Everything below is labelled accordingly, and §1.6 lists the exact screens to screenshot so
the live values can be filled in.

**2. What we can say about today with confidence.** The driver is chosen **before checkout** — when the
customer's address is known the website asks Hyperdrive for a "recommended driver" and then shows that
one driver's kit as the menu. The readable code filters to on-duty, not-on-break drivers anywhere in
the company (no region check), estimates arrival by driving through the driver's whole list and then
to the new address, rejects anyone over 80 minutes, and picks nearest → fastest → fewest stops. It
never looks at the cart, the kit quantity, cash, the $10,000 cap, shift end, or fairness over the day.
The live engine adds weights, an idle bonus, a load penalty and a buffer-zone penalty — a real
improvement — but it is still **one order at a time, one number per driver**: no insertion into the
middle of a route, no joint look at several waiting orders, no memory of who has had a fair share
today, and no price on miles over a shift.

**3. How "all four" can be true at once.** They only conflict if they are all thrown into one blender.
The proposal separates them:

- **Laws and physical limits are never traded** (licensed hours and zones, on duty, breaks, kit stock,
  $10,000 value cap, cash cap, pins).
- **On-time is a guard, not a weight.** For every possible (driver, position-in-their-list) we estimate
  the *chance* the delivery misses the promised window. If that chance is above a set level (10% in
  normal hours) the option is simply **off the table** — unless every option is, in which case we take
  the safest and tell the dispatcher. 
- **Among the on-time-safe options only**, we pick the best blend of fewer miles, even workload,
  not disturbing customers who already have an ETA, and not whiplashing drivers. That blend is what
  the owner tunes.

So on-time is protected first, and balance / fairness / miles are optimised inside the safe set. On a
quiet afternoon almost every option is safe, so miles and fairness decide. On 4/20 few options are
safe, so on-time decides. Nobody has to flip a switch for that to happen.

**4. Four presets, chosen per region and time of day:** **Peak: on-time** · **Normal: balanced** ·
**Slow: save miles** · **Fair share**. Each is just a row of numbers (§3.6). A schedule picks the preset
(e.g. Fri–Sat 5–10 pm = Peak); the system can also step up to Peak by itself when a region starts
running late and step back down when it recovers.

**5. The order does not go straight to a driver's phone.** Address selected → instant quote (our own
code, a few milliseconds, **no vendor call**) → a **soft hold** on that driver's spare capacity so two
customers are never promised the same gap → order placed → **staged**: pencilled onto a driver but not
yet shown to them → all staged orders for an area are re-shuffled **together** every few seconds by
our own local search (still no vendor call; staged orders cost nothing to move because nobody has seen
them) → **released** to the phone when the driver actually needs to know (time to leave, their batch
is full, they are idle, or a dispatcher says so). An idle driver is never kept waiting by staging.

**6. Vendor usage drops from ~800 optimiser calls a day to ~25.** Hosted GraphHopper is kept, as
decided, but only as an *exception and audit* tool with a hard daily credit cap and automatic fallback
to our own solver (§4.5). Today's readable code is the opposite: it makes a separate paid HERE Maps
call for **every leg of every on-duty driver's list on every menu load**.

**7. Every decision explains itself.** The dispatcher sees, per order: who was ruled out and why ("kit
lacks 2× SKU", "shift ends 8:40", "late risk 34%"), the top candidates with each factor's contribution,
and one sentence: *"Chosen over Miles A.: 9 min less late-risk, 4 fewer drive minutes; despite being
18% above fair share."*

**What I need from you:** the six questions in §8 (one at a time); screenshots in §1.6; and — a task
for the dev team, not a decision — **the missing `swiftAssign/` source**, because the shadow test's
"today" baseline must be the real engine, not the older helper code (§7.3).

---

## 1. How it works today

### 1.0 Two layers of "today"

| Layer | What it is | How we know | Status |
|---|---|---|---|
| **A. Readable helper code** | `HB/driverAssignment/` — nearest/fastest/fewest-stops, append-to-end ETA, 85-minute drift re-assign | Source read line by line | CONFIRMED as code; **mostly not wired**: every assignment cron is commented out (`HB/startup/cronJobs.js:16-32`); only the duty-status cron runs (`:11-14`). The one live entry point is the HTTP route `GET /api/v1/fleet/recommend` (`HB/routes/fleets/fleet-routes.js:34`). |
| **B. Live scoring engine ("swiftAssign")** | Weighted ranking: ETA, distance, idle, load, risk, buffer, schedule; outage mode; background rescue crons | README only: `HB/README.md:58` (folder listed), `:173-175` (description), `:225-236` (eight crons listed). Settings screen `SA/src/components/hyperdrive/settings/RoutingConfig/index.js`. Score matrix in the admin's test panel `SA/src/layouts/hyperwolf/HyperdriveTestingPanel.js/WebFlow.js:1190-1300`. | **Source absent from all 12 clones** (repo-wide search for `swiftAssign`, `rankConfig`, `driver/score`, `scoreInfo`, `coreRegion`, `IDLE_BONUS`: zero backend hits). The clone is a single "Initial commit" (`afa975b`, 2026-09-09) with 28 models where the README says "~40+", no `startup/socket.js`, no `routes/common`. |

Consequence for the routing plan: its §0 ("what the code says today") and shadow arm **A0** describe
layer A. Layer A is a fair *lower bound*; it is probably **not** what assigns orders in production.

### 1.1 When the driver is chosen — at address time, before the cart (CONFIRMED)

- The storefront product listing calls Hyperdrive with only latitude/longitude the moment it has an
  address and no terminal yet: `WB/controllers/blaze/product-controllers.js:2291-2301`. The returned
  driver's **Blaze terminal id becomes the menu** (`:2306` fetches that terminal's inventory).
  If no driver comes back, two **hard-coded ids** are used (`:2295`, `:2299`).
- `dispatchRegionId` is sent by the storefront and accepted by validation
  (`HB/models/Fleets.js:259-292`) but **dropped** by the handler, which passes latitude and longitude
  only (`HB/driverAssignment/main.js:13-18`).
- At order save the storefront simply trusts the `fleetId` the browser sends back
  (`WB/controllers/order-controllers.js:238`); the server-side re-check is commented out (`:222-236`,
  `:243-255`). Creating the Hyperdrive task from the storefront is commented out
  (`WB/controllers/blaze/user-cart-controllers.js:634-646`, `:649-723`), and Hyperdrive's own
  create-task refuses `auto` mode (`HB/admin/controllers/task-controller.js:231-233`) — more evidence
  that the live path runs through code we do not have.
- Scheduled orders: a storefront job assigns today's slot orders (slots 1–8) to **whichever Blaze
  terminal in the order's region currently has an employee logged in** —
  `WB/controllers/common-controllers.js:768-838`, lookup `:861-873`. Its two cron schedules are
  **commented out** (`WB/startup/nodeCrons.js:99-112`); what remains is an HTTP route anyone can call,
  `GET /reassign/drivers` (`WB/routes/common-routes.js:27`) — so in the clone it runs only if something
  outside the code calls it.
  Layer A's equivalent is "first driver the database returns for that region"
  (`HB/driverAssignment/scheduleAssignment/assignToDriver.js:13`, query `:77-85`). Slot capacity is a
  per-slot **order cap, default 3** (`WB/controllers/blaze/user-cart-controllers.js:747-749`, enforced
  `:807`).

### 1.2 The readable algorithm (layer A), step by step (CONFIRMED)

`HB/driverAssignment/assignment/regionAssignmentRule.js`

| Step | Rule | Line |
|---|---|---|
| Pool | `fleetStatus='active'`, `fleetOnDutyStatus=true`, `isDeleted=false` — **company-wide, no region / sub-region / zone filter** despite the file name | `:36-43` |
| Break filter | Drop a driver with a break `in_progress`, **and** any driver whose break task was *rescheduled* today (`isBreakTaskUpdated`) — for the rest of the day | `:53-77` |
| Workload considered | Today's delivery tasks that are `not_started` or `in_progress` | `:80-107` |
| Route guess | Driver position → existing stops sorted by a stored distance → **new order appended last** | `:216-229` |
| ETA | 2 (packing) + Σ HERE leg times + (3 service + 1 process, **added once, not per stop**) | `:8-11`, `:232`, `:270-281` |
| Distance | Only the **final leg** (last stop → new order), in miles | `:282`, `HB/.../hereMapsLogic.js:16` |
| Eligibility | ETA ≤ 80 min **and** distance > 0 | `:238-241` |
| Rank 1 | Nearest by that final-leg distance; keep everyone within **2 miles** of the nearest | `:245-249` |
| Rank 2 | Fastest ETA; keep everyone within **5 minutes** of the fastest | `:252-262` |
| Rank 3 (the only fairness) | Fewest open stops **right now** | `:264-265` |
| Nobody qualifies | A driver whose e-mail contains "default" | `:26-27`, `:287-289` |
| Rotation that was switched off | "not picked in the last 4 minutes" (`lastFleetCheck`) | commented `:20-22`, `:253-258` |

**Filters that do not exist in layer A:** region/sub-region or KML zone; vehicle/transport type
(`TransportationTypes` has only `name`/`isActive` — `HB/models/TransportationTypes.js:4-9` — and is never
read by assignment); kit contents at assignment time; maximum concurrent orders; distance radius (the
"80" in `hereMapsLogic.js:3,20` is compared against **miles**, a unit slip); cash; value on board; shift
end; licensed hours.

**Stop order on the driver's phone:** tasks are sorted by `taskOrderDistance`
(`HB/controllers/tasks/task-controller.js:383-391`). That number is each stop's **straight driving
distance from wherever the driver was when the last task was created** — a radial "nearest to me first"
sort, not a route (`HB/admin/controllers/task-controller.js:2129-2170`; the chained-start branch at
`:2149` tests `task.length`, which is always undefined, so it never runs). It is recomputed only when
a task is created (`:115`).

### 1.3 The live scoring engine (layer B) — what its screens reveal (UI-ONLY)

The test panel renders, per candidate driver, a **score** and five terms each with its own `score` and
`weight`: `ETA_TERM`, `DISTANCE_TERM`, `BUFFER_PENALTY`, `IDLE_BONUS`, `LOAD_PENALTY`
(a sixth, `REGION_RISK_PENALTY`, is commented out of the display) plus `eta` (min), `mapDistance` (km)
and a free-text `reason` log — `SA/.../WebFlow.js:1210-1215`, `:1233-1290`. Orders
carry a **core region** (`SA/src/layouts/Hyperdrive/Table/index.jsx:127-132`), and *Buffer Spillover
Rules* stores one **distance in metres per region** (`SA/.../settings/BufferRules/index.js:64-69`, saved
to `PUT api/v1/hyperdrive/assign/distance`, `SA/src/redux/apis/hyperdrive/setting.js:105-111`). Reading
those together: a driver may take an order in a neighbouring region if within that region's buffer
distance, and pays a *buffer penalty* for it. The mock's description of "risk" is "share of the SLA
window remaining after projected ETA" (`MOCK/ldata.jsx:77`), with OK ≥ 0.85 and BAD < 0.70.

What cannot be known without the source: the formula that turns minutes/km into term scores, whether
the terms are normalised, whether kit stock is checked, whether it inserts or appends, and what the
eight README crons actually do.

### 1.4 What triggers re-assignment today

| Trigger | Exists? | Evidence |
|---|---|---|
| Driver rejects / accept timeout | **No.** The driver app has no accept or reject call at all | `HB/routes/tasks/task-routes.js:8-20` |
| Driver goes off duty / logs out | **No** in readable code: the duty toggle and logout just flip the flag | `HB/controllers/fleets/fleet-controller.js:398-414`, `:498-504`. README claims an "off-duty driver task rescue" cron (`HB/README.md:232`) — UI-ONLY |
| ETA drift | Layer A: every 5 min (cron **commented out**, `HB/startup/cronJobs.js:16-20`), ASAP tasks only (`monitoringCron.js:234-239`); if the fresh ETA is later than the stored one it overwrites it (`:224-226`, `:31-33`); if fresh ETA is more than **85 min after order creation** it re-assigns (`:12`, `:36-40`). Slot orders get +1 day (`:16-18`) | CONFIRMED as code, dormant |
| Manual, "Automatic" radio | Dispatcher → `PUT /admin/tasks/reassignTask/:taskId` (**no auth middleware**, `HB/routes/admin/tasks/tasks-routes.js:34`) → best driver by a *different* rule (fastest first, then nearest — `HB/driverAssignment/commonFunc.js:120-132`), first one passing the kit check, then Blaze is re-pointed (`reAssignTaskAuto.js:16-27`) | CONFIRMED; UI at `SA/src/components/hyperdrive/Tasks/TaskDetails.js:382-389` |
| Manual, pick a driver | `POST /admin/tasks/update/reassignment` — **no eligibility checks of any kind** (duty, break, kit, region); re-points Blaze, writes an activity log, notifies both drivers | `HB/admin/controllers/task-controller.js:1871-1991` (log `:1929-1941`) |

Re-assignment defects in the readable code (all CONFIRMED): the kit check passes if **any one** ordered
product has **any** quantity row for the new driver's terminal — quantities are never compared
(`reAssignTaskAuto.js:83-98`); the monitoring path moves the task in Hyperdrive but **never tells
Blaze** (`monitoringCron.js:60-117` — no `reassignOrderInBlaze`), so the two systems disagree about who
has the order; it then calls `Fleets` and `Break` which that file never imports (`:1-10` vs `:121-122`);
the auto path's error branch references an undefined `res` (`reAssignTaskAuto.js:64`, `:68`); the
re-assign pool has **no break filter** (commented out, `commonFunc.js:57-71`) and, when only one driver
is on duty, returns them **without any ETA check** (`:53-55`); and there is **no cool-down** — every
5-minute pass may move the same order again.

### 1.5 What a dispatcher can override today

Pick any driver for any task (no checks, above); choose "Automatic" re-assign; create break,
start-of-day and return-to-HQ tasks for drivers or whole regions (`HB/admin/controllers/task-controller.js:281-560`);
see idle drivers — on duty, no task `in_progress`, not inside a logged break (`:2078-2126`); edit the
settings below. There is no pin: nothing stops the next automatic pass undoing a manual move.

### 1.6 Every tunable parameter found

**A. Routing Config screen** — Hyperdrive → Settings (gear) → *Routing Config*
(`SA/src/layouts/Hyperdrive/SiteSetting/index.jsx:139-146`). One document, read with
`GET api/v1/admin/rankConfig`, saved whole with `POST` (`SA/src/redux/apis/hyperdrive/setting.js:114-120`).
Anyone whose role has Hyperdrive *Settings → Edit* can change it (`SA/src/sideMenus.js:726` block). 33 of
the 34 are required text fields (the 34th is a switch); none has a client-side range check
(`RoutingConfig/index.js:18-157`). **Stored
in the live Hyperdrive database; defaults live in code we do not have.** "Used by code?" is therefore
UI-ONLY for every row; the test panel proves five weight terms reach a score.

| # | Label on screen (unit) | API field | Line | Value seen | What it appears to affect |
|---|---|---|---|---|---|
| 1 | SLA (min) | `slaMinutes` | `:212` | 90 SCREENSHOT | The delivery promise; base for "risk" |
| 2 | SLA Buffer (min) | `slaBufferMinutes` | `:231` | 10 SCREENSHOT | Safety margin inside the SLA |
| 3 | ETA on time Min | `etaOnTimeMin` | `:250` | ? | Band edges that tag an order on-time / buffer / late (task tags are `critical/onTime/delayed`, `HB/models/TasksModel.js:9`) |
| 4 | ETA on time Max | `etaOnTimeMax` | `:262` | ? | 〃 |
| 5 | ETA Buffer Min | `etaBufferMin` | `:275` | ? | 〃 |
| 6 | ETA Buffer Max | `etaBufferMax` | `:287` | ? | 〃 |
| 7 | ETA Late | `etaLate` | `:299` | ? | 〃 |
| 8 | KM Cap | `kmCap` | `:311` | 20 SCREENSHOT | Maximum driver-to-order distance to be a candidate |
| 9 | Idle Start (min) | `idleStart` | `:324` | 10 SCREENSHOT | Idle minutes before the idle bonus begins |
| 10 | Idle Max (min) | `idleMaxMinutes` | `:343` | ? | Idle minutes at which the bonus stops growing |
| 11 | Load Spread Cap | `loadSpreadCap` | `:362` | 4 SCREENSHOT | Max gap in open stops between drivers |
| 12 | Buffer Region Penalty | `bufferRegionPenalty` | `:374` | −0.35 SCREENSHOT | Score deduction for serving outside the core region |
| 13 | Risk Thresholds → OK | `riskThreshold.ok` | `:395` | 0.85 SCREENSHOT | Green/amber boundary |
| 14 | Risk Thresholds → BAD | `riskThreshold.bad` | `:410` | 0.70 SCREENSHOT | Amber/red boundary; probably the rescue trigger |
| 15 | Outage → enabled (switch) | `outage.enabled` | `:431` | ? | Turns on outage weighting |
| 16 | Outage Buffer Penalty | `outage.outageBufferPenalty` | `:452` | ? | Softer buffer penalty while a region is short of drivers |
| 17 | Decay (min) | `outage.decayMinutes` | `:469` | ? | How long outage weighting takes to fade |
| 18 | Curve (Linear / Exp) | `outage.curve` | `:497` | ? | Shape of that fade |
| 19 | Weight Overrides (Outage) → ETA | `outage.weightOverrides.eta` | `:551` | ? | ETA weight during outage |
| 20 | Weight Overrides (Outage) → BUF | `outage.weightOverrides.buf` | `:575` | ? | Buffer weight during outage |
| 21 | Schedule → Lookahead (min) | `schedule.lookAheadMinute` | `:605` | ? | How far ahead scheduled orders are considered |
| 22 | Pre-window Buffer (min) | `schedule.preWindowBufferMinute` | `:634` | ? | How early a scheduled arrival may be |
| 23 | Post-window Buffer (min) | `schedule.postWindowBufferMinute` | `:662` | ? | How late before it counts as missed |
| 24 | Target Slack (min) | `schedule.targetSlackMinute` | `:687` | ? | Desired spare time before the window closes |
| 25 | Freeze (min) | `schedule.freezeMinute` | `:715` | ? | Minutes before the window when the driver is locked in |
| 26 | Corridor Radius (km) | `schedule.corridorRadius` | `:742` | ? | How far off a driver's path a scheduled stop may be |
| 27 | Schedule → Weight | `schedule.weight` | `:771` | ? | Importance of schedule fit |
| 28 | Weight → ETA | `weights.eta` | `:797` | ? | **Confirmed to reach the score** (`ETA_TERM`) |
| 29 | Weight → Distance | `weights.dist` | `:818` | ? | Confirmed (`DISTANCE_TERM`) |
| 30 | Weight → Idle | `weights.idle` | `:838` | ? | Confirmed (`IDLE_BONUS`) |
| 31 | Weight → Load | `weights.load` | `:858` | ? | Confirmed (`LOAD_PENALTY`) |
| 32 | Weight → Risk | `weights.risk` | `:878` | ? | **Possibly dead**: the matching score row is commented out of the test panel (`WebFlow.js:1213`) |
| 33 | Weight → Buf | `weights.buf` | `:898` | ? | Confirmed (`BUFFER_PENALTY`) |
| 34 | Weight → Schedule | `weights.schedule` | `:918` | ? | No matching row in the score matrix — unknown |

**B. Other settings that affect who can take an order**

| Setting | Where stored | Default | Who / where in admin | Affects | Used by assignment code? |
|---|---|---|---|---|---|
| Buffer Spillover distance, per region (m) | Storefront DB via `api/v1/hyperdrive/assign/distance` | 4000 SCREENSHOT (demo fallback in the UI is 400, `BufferRules/index.js:16-31`) | Settings → *Buffer Spillover Rules* | How far outside its core region a driver may serve | UI-ONLY |
| Driver: region, Blaze terminal, transportation type | `Fleets.regionData / terminalData / fleetTransportationTypeId` (`HB/models/Fleets.js:26-42`) | — | Hyperwolf → *Drivers/Breaks* → add/edit driver (required: `SA/src/validations/hyperwolf/driver.js`) | Terminal = the kit = the menu | Terminal: **yes** (kit check). Region: only by the scheduled-order helper (`assignToDriver.js:13`). Transport type: **dead for assignment** |
| Transportation types on/off (Bicycle, Bike, Car) | `TransportationTypes` | `isActive:false` | Settings → *Transportation* | Which types can be chosen for a driver | **Dead for assignment** |
| Break templates: name, from, to, duration, send-at | `Break` (`HB/models/Breaks.js:6-17`) | `active` | Hyperwolf → *Drivers/Breaks* → Break; Create Task → Break task | Driver excluded while on break; break pushed to 5 min after the ETA of a newly created order (`HB/admin/controllers/task-controller.js:181-209`) | **Yes** (layer A) |
| On-duty checklist items on/off | `OnDutyChecklists` | — | Settings → *Checklist* | Gate to going on duty | Not assignment |
| Out-of-service reasons | via `api/v1/admin/outOfService/*` | — | Settings → *Out of Service* | Driver unavailable | UI-ONLY (route absent from clone) |
| Failure reasons, Announcements, Checkout (close-out) items | respective models | — | Settings | Not assignment | — |
| Service time | `Miscellaneous{uniqueId:'servicetime'}` (`WB/controllers/common-controllers.js:430-454`) | 0 | The Hyperdrive settings component is an unfinished stub (`SA/.../settings/ServiceTime/index.jsx:1-9`) | Intended dwell per stop | **Dead**: layer A hard-codes 3 minutes |
| Scheduled slot order cap | `TimeSlot.overallOrderLimit` | 3 | Hyperwolf → Time-slot management | How many orders a slot accepts per region | Yes (storefront) |
| Daily forced off-duty time | env `CRON_TIME` (`HB/startup/cronJobs.js:11-14`) | — | Developers only | Sets every driver off duty, closes open breaks | Yes |
| Driver ↔ sub-region pairing; kit dispatched to driver | `RegionDriverAssign` (`DB/models/regionDriverAssignment.js`), `KitDispatch` (`DB/models/KitDispatch.js`) | `status:false` | Inventory Distribution screens | Which sub-region's kit a driver carries | Not read by Hyperdrive assignment in the clone |
| Box value limits; products per region/box | `KitBoxes.min/maxProductValuePerBox` (`DB/models/KitBoxes.js:8-9`); `DistributionGlobalSettings` (`:5-10`) | — | Inventory Distribution → settings | What goes in a kit | Not assignment |

**C. Numbers frozen in code (layer A) — tunable only by a developer**

| Constant | Value | Line |
|---|---|---|
| Service / packing / process minutes | 3 / 2 / 1 | `regionAssignmentRule.js:8-10` |
| Max ETA to be a candidate | 80 min | `:11`, `:240` |
| Nearest tie band / fastest tie band | 2 miles / 5 min | `:248`, `:261` |
| Re-assign when ETA − created > | 85 min | `monitoringCron.js:12` |
| "Out for delivery" geofence | 150 m | `monitoringCron.js:45` |
| Scheduled stops counted in a driver's route if starting within | 2 h | `commonFunc.js:98` |
| Scheduled task becomes an ASAP task when its start is within | 90 min (variable is named `next30Minutes`) | `updateOrderTask.js:68-76` |
| Break pushed to | ETA + 5 min | `task-controller.js:187-188` |

**Screens to screenshot so every "?" above can be filled** (values live only in the production
database): ① Hyperdrive → Settings → **Routing Config** — all five sections, scrolled to the Save
button; ② Settings → **Buffer Spillover Rules** — every region row; ③ Settings → **Transportation**;
④ Settings → **Out of Service**; ⑤ Hyperwolf → **Drivers/Breaks** → Break list; ⑥ one driver's edit
form (region, terminal, transportation type); ⑦ Hyperwolf → **Hyperdrive Testing Panel** after placing
a test order, showing the **Driver Scores Matrix** with at least three drivers — this single screenshot
reveals how each term is scaled; ⑧ Time-slot management for one region (order caps).

---

## 2. What is missing or broken today, against the four goals

| Goal | Gap | Evidence |
|---|---|---|
| **On-time** | ETA ignores dwell at every intermediate stop (service time added once, not per stop), so a driver with four stops looks ~10–15 min faster than they are | `regionAssignmentRule.js:232` |
| | A failed HERE call silently **deletes that leg** from the route and carries on — the ETA shrinks when the map service hiccups | `:275-279`; errors swallowed `hereMapsLogic.js:30-32` |
| | No promise window per order: one global 80/85/90-minute number; nothing is probabilistic; "risk" is a ratio of minutes, blind to how uncertain a long multi-stop ETA is | `:11`; `monitoringCron.js:12`; Routing Config rows 1–2, 13–14 |
| | When the ETA slips the system **overwrites the stored ETA** — the clock is moved, the promise is not tracked | `monitoringCron.js:31-33` |
| | A driver already heading to the same address (final-leg distance 0) is **excluded** by `distance > 0` | `regionAssignmentRule.js:240` |
| **Balanced** | One order at a time, one score per driver: no insertion mid-route (append-to-end), no joint look at several waiting orders, no re-sequencing | `:216-229`; driver list order is a radial sort `task-controller.js:2129-2170` |
| | Assign and re-assign use **different ranking rules** (nearest-first vs fastest-first) | `regionAssignmentRule.js:245-262` vs `commonFunc.js:120-132` |
| | The menu is one driver's kit, chosen before the cart exists — the cart can never influence who is best, and a better-stocked neighbour is invisible | `product-controllers.js:2293-2306` |
| **Even workload** | Only "fewest open stops *right now*", and only as the third tie-break; nothing accumulates over the shift; no notion of earnings opportunity or drive burden; the rotation rule was switched off | `:264-265`; `:253-258`. Live engine: `LOAD_PENALTY` + Load Spread Cap are still instantaneous (UI-ONLY) |
| **Fewer miles** | Distance = the last leg only; total route miles are never computed; a far driver with a short last leg wins; nothing is priced over a shift | `:282` |
| | **Vendor usage:** one paid HERE request per leg, per driver, sequentially, on **every menu load without a terminal** — e.g. 30 on-duty drivers × 3 legs ≈ 90 HERE calls per address lookup, and the API key travels in the URL | `:268-285`; `hereMapsLogic.js:9`; caller `product-controllers.js:2293` |
| **Safety / law** (not one of the four, but never tradeable) | No zone or hours filter; no $10,000 value check; no cash check; no shift-end check; kit check ignores quantities and only exists on re-assign; manual re-assign has no checks; two unauthenticated routes can trigger assignment jobs | `:36-43`; `reAssignTaskAuto.js:83-98`; `task-controller.js:1871-1926`; `fleet-routes.js:35-37`, `tasks-routes.js:34` |
| **Stability** | No cool-down, no frozen stops, no pin; monitoring re-assign does not update Blaze; two reference errors in the re-assign paths | §1.4 |
| **Explainability** | Layer A logs one CSV line per pick (`main.js:19-32`). Layer B has a good idea — the score matrix — but only inside a test panel, not on the dispatcher's order screen | `WebFlow.js:1190` |

The dispatch core being built (`CORE`) already fixes the first-order problems — real insertion at every
position (`CORE/insertion.ts:160-195`), hard-constraint checks per position (`:168-174`), reasons for
every rejected driver (`:31-34`, `:198`). What it does **not** yet have, and this document specifies:
the quote scores **only added drive minutes and deterministic lateness** (`CORE/insertion.ts:99-104` —
its own comment says fairness/zone terms are left to the background pass); fairness is
Σ|open stops − mean| at this instant (`CORE/plan.ts:212-213`), not over the shift; there is no
late-probability guard, no miles term, no idle term, no soft hold, no staged state, no release policy,
no vendor budget cap, and three presets where four are needed (`CORE/config.ts:35-72`).

---

## 3. The proposed model

A **candidate** is a pair *(driver d, position p in d's unfrozen list)* — for a hub order, a triple
*(d, pickup position, delivery position)*. For each new or re-considered order the engine:
**filters** (3.1) → applies the **on-time guard** (3.2) → **scores** what is left (3.3) → records **why** (3.7).
The same scorer is used by the address-time quote, the staged-queue optimiser, re-assignment and the
shadow test, so they can never disagree about what "best" means.

### 3.1 Hard filters — never traded off

Each filter returns a plain-language reason that is stored and shown. `CORE` constraint ids in brackets.

| # | Filter | Rule |
|---|---|---|
| F1 | On duty and in service | Duty flag on, not out-of-service, app heartbeat < 5 min old. Off-duty pings are ignored server-side (owner decision) |
| F2 | Licensed zone and hours [H5] | Order inside a licensed polygon; arrival inside region hours and the state 6 am–10 pm bound |
| F3 | Zone eligibility | Order's sub-region ∈ driver's `eligibleRegionIds` = home sub-region + neighbours within that region's spillover band (per-region metres — today's *Buffer Spillover Rules*) under the chosen `zoneMode` |
| F4 | Kit stock [H2] | Every line covered at the **ordered quantity** by `onHand − reserved − checkout-holds`; otherwise the order is a **hub order** and needs a feasible hub pickup before delivery [H7] |
| F5 | Value cap [H3] | Retail value on board ≤ $10,000 at every moment along the candidate route |
| F6 | Cash cap [H4] | Cash on hand ≤ cap at every moment; a cash-drop visit is inserted before the cap forces one |
| F7 | Pins [H1] | An order pinned to a driver has exactly one candidate driver; a pinned position is fixed. A manual move is an implicit 30-minute pin |
| F8 | Frozen prefix [H9] | Position must be after the in-progress stop and the next committed stop; goods already picked up never change vehicle |
| F9 | Breaks | The driver's legal meal/rest window must still be placeable after the insertion; a driver on break is a candidate only for positions after the break ends |
| F10 | Shift end [H8] | Last stop (and hub return if required) completes before shift end and licensed close |
| F11 | Vehicle rules [H10] | Per vehicle profile: max approach distance (legacy **KM Cap**), no oversized hub shipment on a bicycle, etc. |
| F12 | Promises already made | Under the recommended re-sequencing mode, the insertion may not push any customer who has been told an ETA past the end of **their** window (`resequenceAfterPromiseMode = within_promise_window`, `CORE/config.ts:203`) |
| F13 | Load ceiling | Driver's open stops may not exceed the area's least-loaded eligible driver by more than **Load Spread Cap** (kept from today, default 4). Relaxed only if it would leave no candidate |

If **no** driver passes F1–F12 the order is *unassigned with reasons*, the dispatcher is alerted at once,
and the floater/hub-runner options are offered. There is no silent "default driver".

### 3.2 The on-time guard — how "all four" holds

**Arrival model.** For candidate *c*, simulate the route (travel from our own matrix × the learned
time-of-day multiplier, plus dwell per stop, plus any break) to get the median arrival μ at the new stop
and at every later stop. Arrival uncertainty is modelled as Normal(μ, σ²) with

```
σ(stop) = sqrt( σ0² + Σ_legs (cv_drive · leg_minutes)² + Σ_earlier_stops σ_dwell² )
defaults: σ0 = 3 min, cv_drive = 0.18, σ_dwell = 2.5 min (first-time customer 4 min)      — all ASSUMED
```

Until real data calibrates it, σ is floored so that the published P80 matches the core's present
placeholder (`P80 = P50 + max(5 min, 20% of elapsed)`, `CORE/insertion.ts:233-236`), i.e.
`σ ≥ max(5, 0.2·minutes_until_arrival) / 0.84`. From week one the three constants are refit nightly from
completed stops, per area and hour-of-week; the weekly **calibration check** from the routing plan §2.6
(≈80% of deliveries arrive before their P80) is the test that σ is honest.

**Late probability and expected lateness** against the promised window end *L* (ASAP: the end of the
live window quoted to that customer, never beyond the zone ceiling; scheduled: window end):

```
z        = (μ − L) / σ
P_late   = Φ(z)                                   chance of missing the promise      [0..1]
E_late   = σ·φ(z) + (μ − L)·Φ(z)                  expected minutes late               [minutes]
```

**The guard.** Candidate *c* is **on-time-safe** when both hold:

1. `P_late(new order | c) ≤ X` — X is the preset's guard level (10% normal, 5% peak, 15% slow);
2. for every later stop *j* on that route that already has a promise:
   `P_late_j(after) ≤ max(X_existing, P_late_j(before) + 2 points)` with `X_existing = 15%` — we may not
   make an already-promised customer materially more likely to be late.

Let **S** be the safe set. **If S is not empty, only S is scored** — miles, fairness and the rest are
optimised strictly *inside* the on-time-safe options. **If S is empty** the guard relaxes one rung at a
time — X → 20% → 35% → "everyone" — and at the first rung with any candidate it picks by the score with
the lateness weight multiplied by 3. The order is flagged **at risk**, the rung used is stored, and if
the last rung was needed the dispatcher gets an alert with the floater / hub / "offer scheduled"
choices. That is the lexicographic rule: *on-time first as a constraint, the other three as the
objective, and never an unassigned order just because everyone is busy.*

Why a probability and not "SLA minus 10 minutes": a 10-minute buffer is too much for an idle driver two
miles away and far too little for the fifth stop on a Friday-night list. The guard scales with how
uncertain that particular ETA is — which is exactly what today's *SLA Buffer* and *Risk OK/BAD* numbers
are reaching for.

### 3.3 The score — minute-equivalents, lower is better

Every term is expressed in **minutes** (or a dimensionless share multiplied by a reference number of
minutes), so every weight reads as *"how many minutes of driving is one unit of this worth?"* — the same
convention as the routing plan §1.4 and `CORE/plan.ts:156-240`.

```
J(c) =   w_late   · ΔE_late(c)          lateness risk
       + w_drive  · ΔDriveMin(c)        added drive minutes            (w_drive ≡ 1, the unit)
       + w_mile   · ΔMiles(c)           added miles
       + w_fair   · FairPen(c)          workload balance               (signed: a credit for under-loaded drivers)
       + w_push   · EtaPushMin(c)       customers already told an ETA
       + w_seq    · ToldResequenced(c)
       + w_zone   · ZonePen(c)          driver leaves home zone
       + w_whip   · WhipPen(c)          driver whiplash
       + w_restock· RestockPen(c)       restock / stock-out / cash-drop proximity
       + w_expo   · ΔExposure(c) + w_cash · ΔCashExposure(c)           (unchanged from routing plan §1.4)
       − w_idle   · IdleCredit(d)
       [ + w_move · 1   when c moves an order the driver has already been shown — §5 ]
```

| Term | Definition | Unit |
|---|---|---|
| `ΔE_late` | Σ over the new stop and every later promised stop on the route of `E_late(after) − E_late(before)`. Scheduled stops use `w_late_sched`, ASAP `w_late_asap` | minutes |
| `ΔDriveMin` | Route drive minutes after − before the insertion (hub orders include the hub detour) | minutes |
| `ΔMiles` | Route miles after − before. Drive minutes price the driver's time; miles price fuel, wear and reimbursement. `w_mile` = (vehicle cost per mile) ÷ (loaded driver cost per minute); with $0.70/mi and $0.45/min ≈ **1.5** (ASSUMED — the two dollar figures are for the owner to supply) | miles |
| `FairPen` | `SSD_d(after) · τ_stop` — §3.4 | minutes |
| `EtaPushMin` | Σ over later stops whose customer has been told an ETA of `max(0, ΔETA − 3 min)`. Earlier is free | minutes |
| `ToldResequenced` | Count of told-ETA stops whose order in the list changes (`wChurnSeq` in `CORE`) | stops |
| `ZonePen` | 0 inside home sub-region; otherwise `0.5 + 0.5 · (metres beyond the home boundary ÷ spillover band)`, so just over the line costs half, the far edge of the band costs the full weight. Replaces **Buffer Region Penalty** | 0.5–1 |
| `WhipPen` | 1 if the driver's **next unfrozen stop** changes + 1 if the new leg reverses heading by > 120° + `max(0, list changes in the last 15 min − 2)` | count |
| `RestockPen` | `need_d · max(0, t(new stop→hub) − t(previous last stop→hub))` + `5 · Σ_lines qty ÷ (available after)` capped at 10. `need_d ∈ [0,1]` = the larger of kit-depletion need (1 − forecast coverage ÷ headroom) and cash need (cash on hand ÷ cap, above 50%). Delivering *towards* the hub when a restock or cash drop is coming is free; using a driver's last unit of a scarce SKU costs a little | minutes |
| `IdleCredit` | 0 below **Idle Start** (10 min); then rises linearly to 1 at **Idle Max** (25 min) and to 2 at the 30-minute legal idle-return threshold [H11] — a driver about to be sent home by the rule is strongly preferred | 0–2 |

### 3.4 The fairness measure — **Shift Share Deviation (SSD)**

Fairness is judged **over the shift, per hour on duty**, not by who has the fewest stops this minute.
For each on-duty driver *d* in the area, over *completed + committed + staged* work today:

```
s_d = stops               ÷ hours on duty (breaks excluded)
e_d = earnings opportunity ÷ hours on duty      earnings opportunity = Σ order subtotals (proxy for tips);
                                                 switchable to "orders" or "tip history" — owner question 2
b_d = drive minutes        ÷ hours on duty

Each is divided by the area mean to become a share with mean 1 (ŝ, ê, b̂), after shrinkage:
a driver on duty < 1 hour is blended with the area mean (pseudo-count = 1 hour) so a fresh driver is
neither flooded nor ignored.

W_d   = 0.4·ŝ_d + 0.3·ê_d + 0.3·b̂_d            workload index, mean 1
SSD_d = W_d − 1                                   +0.25 = "25% above a fair share so far today"
```

**In the score:** `FairPen(c) = SSD_d(after the insertion) · τ_stop`, where `τ_stop` is the area's
average minutes of work per stop (drive + dwell, ≈ 18 min ASSUMED, refit nightly). Giving a stop to a
driver 25% over their share costs `0.25 × 18 = 4.5` minute-equivalents; giving it to a driver 25% under
earns a 4.5-minute credit. With `w_fair = 1` the engine will therefore accept up to ~9 extra drive
minutes to move a stop from the most-loaded to the least-loaded of those two — and **never** if that
would break the on-time guard.

**As a metric:** area unfairness `U = mean |SSD_d|` (0 = perfectly even), reported per area-day beside
the routing plan's coefficient of variation of stops per driver-hour (§4.4 there) so the two documents
stay comparable. Load Spread Cap (F13) remains as the hard ceiling on top.

### 3.5 Normalisation — making weights comparable and honest

1. **Same unit.** Every term is minutes, or a share/count times a stated number of minutes. A weight of
   2 always means "worth two minutes of driving per unit".
2. **Typical size.** For each term *k* the nightly job stores `scale_k` = the median absolute value of
   that term among feasible candidates over the trailing 7 days, per area. The settings screen shows each
   weight's **influence share** `w_k·scale_k ÷ Σ w·scale` — e.g. "with these settings late-risk drives
   46% of decisions, miles 22%, fairness 14%…". This is what stops a slider from being secretly inert
   (today nobody can tell whether *Weight → Risk* does anything).
3. **Sliders.** Owner-facing sliders run 0–100 and map geometrically onto each weight's allowed range
   (§6.2), so the middle of the slider is the default and each step changes influence by a similar ratio.
4. **Guard first.** Because on-time is enforced by the guard, the lateness weight only has to order
   candidates that are *all* acceptably safe; it cannot be "outvoted" into a late delivery by a large
   fairness or miles weight. That is the property a single weighted sum cannot give.

### 3.6 Presets — one weight vector each, picked per region and time of day

| | **Peak: on-time** | **Normal: balanced** | **Slow: save miles** | **Fair share** |
|---|---|---|---|---|
| Guard X (max late chance) | **5%** | 10% | 15% | 10% |
| `w_late_asap` / `w_late_sched` (per expected minute late) | **15 / 20** | 8 / 12 | 4 / 6 | 8 / 12 |
| `w_drive` (per minute) | 1 | 1 | 1 | 1 |
| `w_mile` (per mile) | 0.5 | 1.5 | **3.0** | 1.0 |
| `w_fair` (× SSD·τ) | 0.5 | 1.0 | 0.5 | **3.0** |
| `w_push` (per told-minute pushed) | 0.5 | 0.5 | 0.5 | 0.5 |
| `w_seq` (per told stop re-ordered) | 3 | 3 | 3 | 3 |
| `w_move` (per shown stop moved to another driver) | 4 | 6 | 8 | 6 |
| `w_zone` | 2 | 4 | 6 | 2 |
| `w_whip` | 2 | 3 | 3 | 3 |
| `w_restock` | 0.5 | 0.5 | 1.0 | 0.5 |
| `w_idle` (× IdleCredit, minutes) | 2 | 4 | 3 | **6** |
| `w_expo` / `w_cash` | 2 / 2 | 2 / 2 | 2 / 2 | 2 / 2 |
| Max automatic moves per order (§5) | 2 | 1 | 1 | 1 |
| Max staging time, ASAP (§4.6) | 3 min | 6 min | 8 min | 6 min |

All numbers are **ASSUMED starting points** to be calibrated by replay (§7). *Peak*, *Normal* and *Slow*
are deliberately the core's existing `CUSTOMER_FIRST`, `BALANCED` and `MILES_SAVER` vectors
(`CORE/config.ts:35-72`) with the new terms added; **Fair share is new**.

**Choosing the preset.** A schedule table `(region | all, days, from–to) → preset`, e.g. *all regions,
Fri–Sat 17:00–22:00 → Peak*; *Mon–Thu 10:00–15:00 → Slow*; default *Normal*. **Automatic step-up:** if
more than 20% of an area's open orders have `P_late > X` for 5 minutes, the area moves to *Peak* by
itself; it steps back when that share is under 10% for 15 minutes (two thresholds so it cannot flap).
This replaces today's **Outage** block: `outage.enabled` → auto step-up on/off; `weightOverrides` → the
Peak vector; `decayMinutes` + `curve` → the step-down blends weights back linearly or exponentially over
that many minutes. Every preset or schedule change is a new versioned policy row, replayed over the last
7 days before "Apply" (routing plan §1.4), one click to revert.

### 3.7 Explaining every decision

One `dispatch_decision` record per decision, append-only:

- order, time, area, policy version, preset, **guard rung used**, trigger (quote / staged re-sequence /
  release / re-assign + trigger code / dispatcher);
- **ruled out:** each driver removed by a filter with its sentence ("kit lacks 2 × SKU 4471",
  "shift ends 8:40 pm", "late risk 34% > 10%");
- **top five candidates:** driver, position, P50, P80, `P_late`, and for every term its raw value,
  weight and contribution — the same matrix today's test panel shows, on the real order screen;
- **the sentence:** the largest contribution differences against the runner-up, signs included:
  *"Chosen over Miles A.: 9 min less late-risk (−72), 4 fewer drive minutes (−4); despite 18% above fair
  share (+3)."* If the guard decided it: *"Only on-time-safe option."* If a pin decided it:
  *"Pinned by J. Ortiz 7:41 pm."*

The dispatcher's Reassign panel lists candidates in this order with the same factors, so a manual
choice is an informed one and its cost ("+6 drive minutes, late risk 8% → 14%") is visible before the tap.

---

## 4. From address to driver's phone: quote → soft hold → staged queue → release

Owner requirements (2026-09-17): best driver fetched when the **address is selected**; the order is
then **staged**, not pushed; staged orders for the same driver are considered **jointly**; it stays
**fast** and does **not burn vendor usage**; ASAP promise = **live window inside a fixed zone ceiling**.

### 4.1 The pipeline at a glance

| # | Stage | Starts when | Runs on | Vendor calls | Budget |
|---|---|---|---|---|---|
| 1 | **Quote** | Address selected; again on each cart change | In-process insertion over *committed + staged + held* stops; travel times from our own matrix/cache, fallback straight-line × circuity (`CORE/geo.ts`) | **0** | < 200 ms p99 (`insertionQuoteBudgetMs`) |
| 2 | **Soft hold** | Quote returned | In-process; one writer per area | **0** | < 5 ms |
| 3 | **Staged** | Order placed | Hold becomes a firm reservation; order is *pencilled* on a driver, invisible to them | **0** | < 50 ms |
| 4 | **Joint sequencing** | 3 s after any staged/hold/driver event in the area (max wait 10 s) | In-process **local search** over all staged + unfrozen stops of the area | **0** | 50–150 ms per area |
| 5 | **Release** | Time-to-leave, batch full, driver idle, max staging age, or dispatcher | In-process; writes the plan diff; pushes to the phone; re-points Blaze | **0** | < 100 ms + push |
| 6 | **Exception optimise** | Only the triggers in §4.5 | Hosted solver on the affected cluster, result checked and scored by us | **≤ daily cap** | 5 s deadline, never blocks 1–5 |

Nothing a customer or driver waits on ever depends on a vendor.

### 4.2 The quote and the promise

- **Input:** address (→ zone), and the cart once it exists. **Output:** the zone's advertised ceiling
  (e.g. "within 90 min"), the **live window** `[P50 rounded down to 5 min, P80 rounded up to 5 min]`
  (e.g. "35–50 min"), the hold id, and — internal only — the primary and backup driver.
- **The promise the guard protects** is the *end of the live window actually shown to that customer*,
  never later than the zone ceiling. The zone ceiling is the advertised maximum and the fallback if the
  live path is degraded (`asapPromiseMode`, `asapFixedPromiseSec` in `CORE/config.ts:99-100` — a new mode
  value `live_window_within_zone_ceiling` plus a per-zone ceiling table are needed).
- **When the live P80 is beyond the zone ceiling** the area is over capacity. What the customer sees then
  is owner question 3; the engine's default is to quote honestly and offer a scheduled slot.
- **The menu.** Today the menu *is* one driver's kit. New rule: the menu is the **union of the kits of
  the on-time-safe drivers** for that address (usually 1–3), with hub-only items marked "adds ~N min".
  Each add-to-cart narrows the candidate set (F4) and refreshes the window — a few milliseconds, no
  vendor. If the cart leaves no kit driver, it becomes a hub order under the routing plan's Q7 answer.

### 4.3 The soft hold — how two customers are never promised the same gap

A driver's spare capacity is the **slack in their route**. The hold makes that slack visible to the
next quote:

- A hold is a **phantom stop** inserted at the quoted position on the primary driver
  `{holdId, session, location, stage, expiresAt, planVersion}`. Every later quote simulates routes
  **with** phantoms in place, so the second customer sees the first customer's gap as taken and is
  quoted the next-best gap — possibly the same driver one position later, possibly another driver.
- **Two stages, so abandoned carts do not strangle capacity.**
  *Browsing* (address chosen, no checkout): the phantom counts in the **P80** (conservative end of the
  window) but not in the P50, and does not count against the hard guard — roughly a third of these
  convert (ASSUMED; learned per hour-of-week). *Checkout started:* the phantom counts **in full**,
  guard included, and the cart's **kit lines are held** in the kit ledger. Kit lines are *not* held
  while browsing — that would empty the menu for everyone else.
- **TTL.** Browsing: 10 min sliding on cart activity, hard maximum 25 min. Checkout: 5 min, renewed once
  during payment. **Released immediately** on: TTL expiry, address change, cart emptied, session end,
  order placed (converted), payment failure after the renewal. A sweeper runs every 15 s; expiry is
  also enforced lazily on read, so a missed sweep never leaves a ghost hold.
- **Atomicity.** Holds for an area are created through a **single writer per area** (database advisory
  lock or a Valkey script — the lock is held for the ~3 ms quote, never longer). Each hold carries the
  plan version it was computed on. At order placement the engine does a compare-and-swap: if the
  version is still current the hold converts; if not, it **re-quotes in-process** and converts on the
  fresh result. The customer's promise is a *window*, not a driver, so a changed driver is invisible;
  only if the fresh P80 falls outside the promised window is the customer told — **before payment,
  never after**.
- **Bound on over-booking:** full-weight (checkout) holds + committed + staged work must satisfy the
  guard; expected-weight (browsing) holds may exceed it by design, and the window shown widens as they
  accumulate. A `dispatch_metric` counts *double-promise incidents* (two firm holds that could not both
  be honoured); the target is zero.
- **Needed in `CORE`:** kit-ledger event kinds `hold` and `expire` beside `reserve/consume/release/restock`
  (`CORE/kit-ledger.ts:24`); a `Hold` type; phantom stops in `VehicleWithRoute.tail` (`CORE/insertion.ts:24-29`).

### 4.4 The staged queue — joint sequencing with our own local search

A staged order has a promise and a firm reservation, but **no driver has seen it and no customer has
been told a driver**. Moving it therefore costs *nothing* in churn — which is exactly why staging makes
joint optimisation cheap and safe.

- **Problem solved each run:** all staged orders + all unfrozen committed stops of one area, all
  on-duty drivers of that area and its spillover neighbours; objective = Σ J over the plan (§3.3) with
  guard violations priced at a large constant so the search drives them to zero first; hard filters
  enforced on every move by the same checker (`CORE/constraints.ts:376`).
- **Start** from the pencilled solution (each order's best insertion). **Moves:** relocate one stop to
  any driver/position; swap two stops; *or-opt* (move a chain of 2–3 consecutive stops); 2-opt within a
  route; cross-exchange of route tails between two drivers. First-improvement descent, then a short
  ruin-and-recreate (remove the 3–5 worst-placed stops, re-insert best-first) until the time budget.
  Committed (already shown) stops may move only if the gain beats `w_move` / `w_seq`; staged ones move
  freely. Deterministic seed per run so a replay reproduces a decision exactly.
- **Size and speed.** Today ≈ 7 open stops and 1–3 staged per area; at 3,000 orders/day ≈ 67 open and
  5–15 staged. A relocate evaluation is a route-suffix simulation (microseconds); 50–150 ms gives
  10⁴–10⁵ evaluations — enough to reach a local optimum at these sizes on every event. `CORE` today has
  single-order insertion and a greedy batch solver (`CORE/solvers/greedy.ts`); the local-search
  improvement loop is the missing piece and belongs beside them as the **default** solver, not a fallback.
- **Self-hosted VROOM**, if stood up for the shadow test, is a free-per-call middle tier: usable every
  run at no usage cost. It is optional; nothing here depends on it.

### 4.5 When a hosted-vendor solve is justified — and the cap that guarantees it stays cheap

The routing plan estimated ~200 re-plans per area per day → 4 × 200 × 70 = **56,000 GraphHopper credits
a day today and 2.1 million at 10×** (its §3.3). Under the owner's "don't burn usage" instruction the
hosted solver is reconfigured from *background optimiser on every event* to **exception and audit tool**:

| Trigger (all subject to debounce and budget) | Why a bigger solver can help | Expected/day today → at 3,000 |
|---|---|---|
| V1 **Scheduled wave**: ≥ 8 scheduled orders for one area enter the 90-min plan horizon together | Many time windows at once is where global search beats local moves | 4 → 12 |
| V2 **Rescue**: after two consecutive local-search runs the area still has a guard violation, or > 15% of open orders at `P_late > X`, and ≥ 12 unfrozen stops across ≥ 3 drivers | Local search is stuck in a bad basin | 8 → 24 |
| V3 **Mass disruption**: a driver with ≥ 4 open stops drops (off duty, breakdown), or a region closes early | Large simultaneous redistribution | 2 → 8 |
| V4 **Audit sample** (shadow only, never adopted): a random snapshot, to measure how far our local plan is from the vendor's | Keeps the "is the vendor worth it?" number current | 12 → 24 |
| **Total calls** | | **≈ 26 → ≈ 68** |

- **Scope:** only the affected **cluster** is sent (≤ 10 vehicles, ≤ 25 stops), never the whole area, so
  a call costs `min(V·L, 10·L)` ≤ 250 credits. Expected **≈ 1,800 credits/day today** (3% of the earlier
  estimate) and **≈ 17,000/day at 3,000 orders** (under 1%).
- **Per-area debounce:** at most one hosted call per area per **10 minutes** (V3 may jump the queue once
  per hour).
- **Daily credit budget with a hard cap:** `vendor.dailyCreditCap` default **5,000** today, **25,000** at
  10× — both inside a published plan tier. Credits are estimated **before** sending with the formula
  above; a call that would cross the cap is not sent. 30% of the day's budget is reserved for V2/V3 after
  5 pm. `CORE` already has the accounting hook and the fallback wrapper
  (`CORE/solver.ts:141` `withCostAccounting`, `:216` `withFallback`); the cap and pre-flight estimate are new.
- **Automatic fallback:** cap reached, vendor slow (> 5 s), vendor down, or payload refused by the
  minimiser → the local solver's plan simply stands. No alert storm: one banner, one metric.
- **Adoption:** a vendor plan is checked by our checker, scored by our scorer, and adopted only if it
  beats the live plan by ≥ max(2%, 3 minute-equivalents) (`CORE/plan.ts:280-298`). Most will not.
- **Exit rule:** if four weeks of V4 audits show the hosted plan is < 3% better than ours on the primary
  metrics, set the cap to audit-only. If it is consistently > 5% better during peaks, raise the V2 budget
  for peak hours only. Either way the decision is made with our own numbers.
- **Accuracy is bought elsewhere:** the big accuracy levers are the travel-time multipliers learned from
  our own completed legs, per-stop dwell, and the calibrated σ — all in-house and free per use.

### 4.6 Release policy — when a staged order reaches the driver

A staged order is released at the **earliest** of:

| Rule | Definition | Default |
|---|---|---|
| R1 **Driver needs work** | The target driver's visible list has fewer than `minVisibleStops` | 2 → an idle driver gets the order **immediately**; staging never makes a driver wait, and the 30-minute idle-return rule is never triggered by us |
| R2 **Time to leave** | `now ≥ planned departure for this stop − releaseLead` (pack/scan + notice) | lead 8 min |
| R3 **Batch full** | The driver's next run (consecutive stops in one direction) has reached `maxBatchStops`, or the next insertion would hit the value/cash cap | 4 stops |
| R4 **Max staging age** | ASAP order staged longer than the preset allows | 3 / 6 / 8 min (Peak / Normal / Slow) |
| R5 **Dispatcher** | "Release now", a pin (pin = release to that driver), or "keep staged" (≤ 15 min, then R4 applies) | — |
| R6 **Scheduled orders** | Planned from 90 min before the window, released at the commit horizon | 30 min (`commitHorizonSec`) |

On release the order becomes **committed**: the driver is notified once, Blaze is re-pointed to that
driver's terminal (today's monitoring path forgets this — §1.4), the customer sees "driver assigned",
and from then on moving it is governed by §5. A driver sees a **stable next two stops** plus whatever
has been released behind them; the unseen tail keeps improving.

---

## 5. Re-assignment policy

**What may trigger an automatic move of an order a driver has already been shown:**

| Code | Trigger | Condition |
|---|---|---|
| T1 | Driver cannot serve | Off duty, out of service, logged out, or heartbeat lost > 5 min with open stops |
| T2 | Kit shortfall | Pack/scan failure or a recorded discrepancy removes the stock |
| T3 | **Late risk** | `P_late > 35%` on two consecutive evaluations ≥ 3 min apart, **and** a candidate exists with `P_late ≤ 15%` **and** ≥ 8 expected minutes better |
| T4 | Legal limit ahead | Break window, shift end, value cap or cash cap would otherwise be broken |
| T5 | Failed attempt | Re-delivery after a failed stop |
| T6 | Dispatcher | Always allowed. Soft costs are shown, not enforced. Legal filters (F2, F5, F6, F10) cannot be overridden; the others need a reason |

**Not triggers:** saving miles or evening out workload. Those goals act on *staged* orders and on
re-sequencing within a driver's own unfrozen tail, where nobody is disturbed (owner question 6 offers
the alternative).

**What stops orders bouncing (hysteresis):**
1. **Price of a move:** the new placement must beat the current one by `w_move` (6) **plus**
   max(2%, 3 minute-equivalents) — the core's adoption rule (`CORE/config.ts:223-225`).
2. **Persistence:** T3 needs two consecutive bad readings, so one GPS glitch or one red light moves nothing.
3. **Cool-down:** 10 minutes after any move, that order cannot be moved automatically again.
4. **Move limit:** 1 automatic move per order (2 in Peak); after that only a dispatcher can move it.
5. **No return:** an order never goes back to a driver it left within 30 minutes (unless a dispatcher says so).
6. **Driver whiplash budget:** at most 2 list changes per driver per 15 minutes from non-urgent causes;
   T1, T2 and T4 are exempt.

**Frozen horizon:** the stop in progress and the next committed stop never change automatically
(`frozenStopCount = 2`, `CORE/config.ts:208`); a stop inside the 150 m arrival geofence is frozen; goods
already picked up at the hub never change vehicle; for a kit order the receiving driver must hold the
stock (F4), which in practice limits moves to neighbours with similar kits.

**The customer's promised ETA:** the promised window **never changes because we moved the order**. The
live ETA inside it updates silently. If the new P80 falls outside the promise, the customer gets **one**
proactive message with the new window, and the delivery still counts as **late** in every metric —
no resetting the clock (today's code overwrites the ETA, §2). ETA changes under `etaChangeNoticeMinutes`
(3) are never messaged.

**Audit trail:** every move writes a `dispatch_decision` (§3.7) with trigger code, from/to driver,
before/after `P_late` and score, policy version, actor (engine or dispatcher id), override reason, and
the result of the Blaze re-point. Append-only; this is also the replay log for §7.

**Pins:** a pin always beats the engine (owner decision). A pinned order is never moved automatically —
including under T1/T2: it becomes a **pinned orphan** with a loud alert to the person who pinned it and
the area dispatcher. Pins carry an expiry (`CORE/types.ts:128-139`); a manual re-assignment is an
implicit 30-minute pin so the engine cannot immediately undo it. The decision record says "pinned by …".

---

## 6. Parameter map

### 6.1 Every legacy tunable → its place in the new model

| Legacy | Verdict | New equivalent | Reason |
|---|---|---|---|
| SLA (90) | **Kept**, per zone | `zonePromiseCeilingMin[zone]` | The advertised ceiling and the fallback promise |
| SLA Buffer (10) | **Replaced** | Guard `maxLateProb` + P80 quote | A fixed buffer is too big for short trips and too small for long lists |
| ETA on-time Min/Max, ETA Buffer Min/Max, ETA Late | **Replaced** | Risk bands from `P_late`: on track < 10%, tight 10–35%, at risk > 35% | Five hand-set minute bands → one calibrated probability |
| Risk OK / BAD (0.85 / 0.70) | **Replaced** | `riskBands.tight` 0.10, `riskBands.atRisk` 0.35 | Same purpose, honest units |
| KM Cap (20) | **Kept** | `vehicleProfile[*].maxApproachKm` (car 20, bike 12, bicycle 5) | Hard filter F11 |
| Idle Start (10) / Idle Max | **Kept** | `idle.startMin` 10, `idle.maxMin` 25 | Feeds `IdleCredit`, tied to the 30-min legal idle rule |
| Load Spread Cap (4) | **Kept** | `loadSpreadCapStops` 4 | Hard ceiling F13 above the fairness term |
| Buffer Region Penalty (−0.35) | **Replaced** | `w_zone` × boundary-distance ratio | Minute-equivalent, graded by how far out of zone |
| Buffer Spillover distance per region (4000 m) | **Kept** | `spilloverBandMeters[region]` | `CORE` has one global value (`config.ts:107`); needs a per-region map |
| Outage: enabled / penalty / decay / curve / overrides | **Replaced** | Auto step-up to *Peak* with two-threshold hysteresis; `surge.decayMin`, `surge.curve` | Same intent, triggered by measured late-risk rather than a manual switch |
| Schedule Lookahead | **Kept** | `planHorizonSec` (90 min) | |
| Schedule Freeze | **Kept** | `commitHorizonSec` (30 min) | = release rule R6 |
| Pre- / Post-window Buffer | **Kept** | `sched.earlyToleranceMin` 0, `sched.lateToleranceMin` 0 | Arrive-early wait is modelled; "late tolerance" defaults to none |
| Target Slack | **Replaced** | The guard on scheduled stops | Slack in minutes → late probability |
| Corridor Radius (km) | **Kept** as a pre-filter | `sched.corridorKm` 5 | Cheap pruning before scoring |
| Schedule Weight, Weight → Schedule | **Replaced** | `w_late_sched` | |
| Weight → ETA | **Replaced** | Guard + `w_late_asap` | Raw ETA is not the goal; lateness against the promise is |
| Weight → Distance | **Replaced** | `w_drive` + `w_mile` | Whole-route marginal cost, not one leg |
| Weight → Idle | **Kept** | `w_idle` | |
| Weight → Load | **Replaced** | `w_fair` on SSD | Over the shift, per hour, three components |
| Weight → Risk | **Replaced** | The guard | Suspected dead today |
| Weight → Buf | **Replaced** | `w_zone` | |
| Service 3 / packing 2 / process 1 min; service-time setting | **Replaced** | `dwell.regularSec` 240, `dwell.firstTimeSec` 360, `dwell.hubHandoffSec` 300, learned per stop type | Per stop, not once per route |
| 80-min candidate limit, 85-min re-assign | **Replaced** | Guard; T3 | |
| 2-mile / 5-minute tie bands | **Dropped** | — | A continuous score needs no bands |
| 150 m "out for delivery" | **Kept** | `arrivalGeofenceM` 150 | Also freezes the stop |
| Monitoring every 5 min | **Replaced** | Event-driven + 5-min heartbeat | |
| "default" driver fallback; hard-coded terminal/fleet ids | **Dropped** | Unassigned-with-reasons + floater | A silent fallback hides a staffing problem |
| Break templates (from/to/duration/send-at; ETA + 5 min push) | **Replaced** | Break **windows** from labour rules, F9 | Lets the break sit where it costs least |
| Transportation types | **Kept, made real** | Vehicle profile: speed, approach cap, rules | Dead for assignment today |
| Driver region + terminal | **Kept** | `homeRegionId`, `eligibleRegionIds`, kit ledger | Seeded from `RegionDriverAssign` and `KitDispatch` |
| Out-of-service reasons | **Kept** | Driver state → F1, trigger T1 | |
| Slot order cap (3) | **Kept as an override** | Slot availability computed by the same quote engine; manual cap on top | Capacity-aware instead of a fixed count |
| Daily forced off-duty cron | **Kept** | Shift end per driver; safety sweep at licensed close | |
| Box value limits, products per region/box | **Out of scope** | Kit design (distribution module) | Inputs to the value cap only |

### 6.2 New parameters — defaults, allowed ranges, and who sees them

**O** = owner-facing settings screen · **D** = dispatcher lead · **E** = engineering only.
"In core?" = already a key in `CORE/config.ts`.

| Key | Default | Range | Who | In core? |
|---|---|---|---|---|
| `presetSchedule[]` (region, days, from–to → preset) | Normal always | — | **O** | new |
| `autoStepUp.enabled` / up share / up minutes / down share / down minutes | on / 20% / 5 / 10% / 15 | 10–40% / 2–15 / 5–20% / 5–30 | **O** | new |
| `guard.maxLateProb` (per preset) | 0.10 (0.05 / 0.15) | 0.02–0.25 | **O** | new |
| `guard.existingMaxLateProb` / `existingDeltaPts` | 0.15 / 2 | 0.05–0.30 / 0–5 | D | new |
| `guard.relaxLadder` | [0.20, 0.35, 1] | — | E | new |
| `weights.wLateAsap` / `wLateSched` | 8 / 12 | 2–30 / 3–40 | **O** (one slider "On-time") | yes |
| `weights.wDrive` | 1 | fixed | — | yes |
| `weights.wMile` | 1.5 | 0–5 | **O** ("Fewer miles") | new |
| `weights.wFair` | 1.0 | 0–5 | **O** ("Even workload") | yes — meaning changes to SSD·τ |
| `fairness.mix` (stops / earnings / drive) | 0.4 / 0.3 / 0.3 | sums to 1 | **O** (owner question 2) | new |
| `fairness.earningsProxy` | `subtotal` | `orders` · `subtotal` · `tip_history` | **O** | new |
| `fairness.newDriverPriorHours` | 1 | 0–3 | E | new |
| `weights.wEtaPush` / `wChurnSeq` | 0.5 / 3 | 0–3 / 0–10 | **O** ("Don't disturb customers") | new / yes |
| `weights.wChurnMove` | 6 | 2–15 | **O** ("Don't reshuffle drivers") | yes |
| `weights.wWhiplash` / `whiplash.changesPer15Min` | 3 / 2 | 0–10 / 1–5 | D | new |
| `weights.wZone` | 4 | 0–10 | **O** ("Keep drivers in their zone") | yes |
| `spilloverBandMeters[region]` | 4000 | 0–10,000 | **O** | yes (single value) |
| `weights.wRestock` | 0.5 | 0–3 | D | new |
| `weights.wIdle`, `idle.startMin`, `idle.maxMin` | 4 / 10 / 25 | 0–10 / 0–20 / 15–29 | D | new |
| `weights.wExposure` / `wCash` | 2 / 2 | 0–10 | E | yes |
| `loadSpreadCapStops` | 4 | 2–8 | **O** | new |
| `zonePromiseCeilingMin[zone]` | 90 | 45–120 | **O** | new (`asapFixedPromiseSec` is global) |
| `asapPromiseMode` | `live_window_within_zone_ceiling` | + existing four | **O** | new value |
| `quote.roundToMin` / `overCeilingMode` | 5 / `quote_honestly_offer_scheduled` | 1–10 / see question 3 | **O** | new |
| `hold.browseTtlSec` / `browseMaxSec` / `checkoutTtlSec` | 600 / 1500 / 300 | 300–1200 / 900–2400 / 120–600 | D | new |
| `hold.browseCountsInGuard` | false | bool (question 5) | **O** | new |
| `stage.debounceSec` / `maxWaitSec` / `searchBudgetMs` | 3 / 10 / 100 | 1–10 / 5–30 / 25–500 | E | new |
| `release.minVisibleStops` / `leadSec` / `maxBatchStops` | 2 / 480 / 4 | 1–3 / 180–900 / 2–8 | D | new |
| `release.maxStageSec` (per preset) | 360 (180 / 480) | 0–900 (question 4) | **O** | new |
| `frozenStopCount` / `frozenHorizonSec` | 2 / 0 | 1–99 / 0–1800 | **O** (routing plan Q8) | yes |
| `reassign.lateProbTrigger` / `targetLateProb` / `minGainMin` | 0.35 / 0.15 / 8 | 0.2–0.6 / 0.05–0.25 / 3–20 | D | new |
| `reassign.persistEvaluations` / `cooldownSec` / `maxAutoMoves` / `noReturnSec` | 2 / 600 / 1 / 1800 | 1–4 / 300–1800 / 0–3 / 0–3600 | **O** (question 6) / D | new |
| `pin.manualMoveTtlSec` | 1800 | 600–7200 | D | new |
| `vendor.dailyCreditCap` / `perAreaDebounceSec` / `eveningReserveFraction` / `clusterMaxVehicles` / `clusterMaxStops` | 5,000 / 600 / 0.3 / 10 / 25 | 0–50,000 / 300–3600 / 0–0.5 / 5–20 / 10–50 | **O** (cap only) / E | new |
| `vendor.auditSamplesPerDay` | 12 | 0–50 | E | new |
| `sigma.base` / `cvDrive` / `dwell` | 3 / 0.18 / 2.5 | learned nightly | E | new |
| `etaChangeNoticeMinutes`, `adoptionMin*`, `planHorizonSec`, `commitHorizonSec`, caps, hours, idle-return | as in `CORE/config.ts:188-232` | unchanged | as today | yes |

**The owner-facing screen** carries only the **O** rows: preset schedule and auto step-up; the guard
level; six plain-word sliders (On-time · Fewer miles · Even workload · Don't disturb customers · Don't
reshuffle drivers · Keep drivers in their zone) each showing its **influence share**; zone ceilings and
spillover distances; load spread cap; max staging time; automatic-move limit; the vendor daily cap with
today's usage; and the **7-day replay preview** before Apply. Per the standing rule this screen needs
**four distinct design concepts, each at desktop and phone width**, before anything is built.

---

## 7. How we will know it is better

### 7.1 Metrics (additions to routing plan §4.4; its definitions stand)

| Metric | Definition | Role |
|---|---|---|
| On-time %, lateness mean/P95, drive minutes per order | As routing plan §4.4 | **Primary** (unchanged) |
| **Miles per order** | Simulated route miles ÷ delivered orders | Primary for the *Slow* preset |
| **Unfairness U** | Mean \|SSD\| per area-day; reported beside the plan's CV of stops per driver-hour | Primary for *Fair share* |
| Guard pressure | Share of decisions where the safe set was empty, by rung | Capacity signal (staffing, not tuning) |
| Promise calibration | Share of deliveries arriving before their quoted P80 (target 78–85%) | Gate on the quote |
| Quote stability | Share of orders whose window at placement differs from the window first shown | Secondary |
| **Double-promise incidents** | Firm holds that could not both be honoured | Gate: **0** |
| Staging delay | Median/P95 minutes staged; **staged while the target driver was idle** | Gate: the latter **0** |
| Re-assignments per 100 orders; **bounces** (orders moved ≥ 2 times); told-ETA pushes > 10 min | | Gate: bounces ≤ 0.5 per 100 |
| Driver whiplash | List changes per driver-hour after release | Secondary |
| Vendor credits per day vs cap; local-vs-vendor gap from V4 audits | | Decision input for §4.5 exit rule |
| Quote latency P99; staged-run latency P95 | | Gate: < 200 ms; < 250 ms |

### 7.2 Replay and shadow, consistent with the pre-agreed thresholds

Same dataset, simulator, common random numbers, block bootstrap over area-days and non-inferiority
margins as routing plan §4.1–4.6. Arms specific to this document:

| Arm | What it isolates |
|---|---|
| **B0-hist** Historical assignments exactly as they happened | The true "today" (see 7.3) |
| **B0-rule** Layer-A rule re-implemented (append-to-end, nearest, fewest stops) | Lower bound; = routing plan arm A0 |
| **B1** Insertion + hard filters, no guard, drive+lateness score only (what `CORE/insertion.ts` does now) | Value of insertion alone |
| **B2** B1 + the guard | Value of the lexicographic rule |
| **B3** B2 + full score, *Normal* preset | Value of fairness / miles / CX / DX terms |
| **B4** B3 + soft holds + staging + joint local search + release policy | Value of the pipeline in §4 |
| **B5** B4 + hosted exception calls under the cap | Value of the vendor, at its real usage |
| **P-peak / P-slow / P-fair** B4 under each other preset | Does each preset move its own headline metric the intended way |

**Pass conditions, fixed in advance:**
1. **Routing plan gate G6 stands:** B4 on-time % ≥ baseline **+ 5 points** and quote P99 < 200 ms.
2. **Guard works:** B2 vs B1 — on-time % up (95% CI excludes 0) with drive minutes per order not worse than **+3%**.
3. **"All four" holds:** B3 vs B2 — on-time lower CI bound above **−1.0 point**, P95 lateness upper bound
   below **+2.0 min** (the plan's non-inferiority margins), **and** unfairness U down ≥ 20% **and** miles
   per order not worse than +3%. If fairness can only be bought outside those margins, `w_fair` comes
   down until it cannot.
4. **Staging pays for itself:** B4 vs B3 — drive minutes per order down ≥ 3% or on-time up ≥ 1 point, with
   zero idle-while-staged and zero double-promise incidents.
5. **Presets are real:** each preset beats *Normal* on its own headline metric (Peak: on-time; Slow:
   miles per order; Fair share: U) with 95% confidence, and breaches no gate. A preset that fails is re-tuned
   or removed — not shipped as a label.
6. **Vendor earns its cap:** B5 vs B4 — if no primary metric improves with 95% confidence, the cap goes to
   audit-only.
7. **Live shadow, 4 weeks:** decisions are computed silently beside production; calibration, double-promise,
   bounce and latency gates are measured on live traffic before any driver sees a plan from this engine.

### 7.3 A correction the shadow test needs

Routing plan arm **A0** re-implements the append-to-end rule as "today". §1.0 shows that rule is
probably **not** what assigns orders in production. Two actions: (1) **B0-hist** — replay what actually
happened — becomes the baseline for G6; B0-rule stays as a lower bound and is labelled as such;
(2) the dev team is asked (via `TEAM-TODO.md`, read-only repos) for the `swiftAssign/` source and the
current `rankConfig` document, so the live engine can be re-implemented as its own arm and its 34
settings mapped with certainty instead of inference.

---

## 8. Questions for the owner

Six, each changes the design. One at a time; recommended option first. None repeats the routing plan's
questions (its Q1 "all four" and Q2 "live window inside a zone ceiling" are taken as answered).

**Q1. How strict is the on-time guard — what chance of a late delivery rules a driver out?**
- **A. 1 in 10 normally, 1 in 20 at peak, about 1 in 7 in slow hours (recommended)** — strict when it matters, leaves room to save miles when it does not; three numbers to understand instead of one.
- B. 1 in 10 always — simplest to explain; slightly wasteful at quiet times and slightly loose on 4/20.
- C. 1 in 20 always — best on-time record; more miles, less even workload, and the "nobody is safe" alarm sounds more often.
- D. 1 in 5 always — cheapest and most even; roughly twice as many late deliveries as option B.

**Q2. When we say "even workload", what should be evened out across drivers?**
- **A. A blend: stops, earnings opportunity and drive time, each per hour on duty (recommended)** — nobody gets all the long hauls or all the small orders; needs order value (or tips) as an input.
- B. Number of stops only — easiest to see and explain; ignores who got the long drives and the big tickets.
- C. Earnings opportunity only — fairest on pay if tips matter most; can hand one driver all the far, heavy runs.
- D. Drive time and miles only — evens fatigue and vehicle wear; ignores earnings entirely.

**Q3. An area is overloaded and the live quote would be longer than the zone's advertised promise. What does the customer see?**
- **A. The honest longer window, with a one-tap offer of a scheduled slot (recommended)** — no broken promises and no lost sale; some customers will see a number above the advertised one.
- B. ASAP switches off for that zone until it recovers; scheduled only — the advertised promise is never exceeded; loses impulse orders exactly when demand is highest.
- C. Keep showing the zone promise and accept the risk — best conversion tonight; this is how promises get broken.
- D. Hold the quote and alert a dispatcher to decide (pull a floater, extend the promise) — human judgement at the key moment; adds work at the busiest time and delays the customer.

**Q4. How long may an order wait, unseen, before it reaches the driver's phone?**
- **A. Until the driver needs it, at most 6 minutes (3 at peak), and never while that driver is idle (recommended)** — lets waiting orders be combined into better runs at no cost to the customer; drivers see orders a few minutes later than today.
- B. No waiting: release at once, keep improving only the part of the list the driver has not reached — most familiar to drivers; much less room to combine orders.
- C. Up to 10 minutes — best batching and fewest miles; visibly slower to "driver assigned" for the customer.
- D. Automatic normally, dispatcher releases by hand at peak — maximum control; a bottleneck when it is busiest.

**Q5. How firmly do we hold a driver's capacity for someone who has picked an address but not yet ordered?**
- **A. A light hold while browsing, a firm hold from the start of checkout, released after 10 quiet minutes (recommended)** — no double-promising at the moment it matters, and abandoned carts do not block real customers.
- B. A firm hold from address selection — the quote never changes; abandoned carts make everyone else's quote worse.
- C. No hold until the order is placed — maximum capacity; the quote can change at checkout, which feels like bait-and-switch.
- D. Firm hold only for signed-in returning customers, light for everyone else — rewards regulars; two behaviours to explain.

**Q6. May the system move an order that is already on a driver's phone, without a dispatcher?**
- **A. Only to prevent a late delivery or when the driver cannot do it; once per order, with a 10-minute cool-down (recommended)** — protects the promise without whiplash.
- B. Also to save miles or even out workload when the gain is large (8+ minute-equivalents) — more efficient; drivers see more changes to their list.
- C. Never automatically: the system proposes, a dispatcher approves with one tap — calmest for drivers; slow when many orders are at risk at once.
- D. Automatic only while the *Peak* preset is active — a middle path; behaviour changes with the time of day, which drivers may find unpredictable.

**Facts to look up rather than decide:** the eight screenshots in §1.6; the `swiftAssign/` source and the
live `rankConfig` document (dev team); vehicle cost per mile and loaded driver cost per hour (sets `w_mile`);
whether drivers keep tips and how they are paid (sets the fairness mix in Q2); today's share of address
selections that become orders (sets the browsing-hold weight).

---

## Appendix — sources read 2026-09-17 (all read-only)

`HB/driverAssignment/` (all 8 files) · `HB/startup/cronJobs.js` · `HB/startup/routes.js` ·
`HB/routes/fleets/fleet-routes.js` · `HB/routes/admin/tasks/tasks-routes.js` · `HB/routes/tasks/task-routes.js` ·
`HB/admin/controllers/task-controller.js` (createTask, reassignDriver, reassignOrderInBlaze, getIdleFleets,
setOrderRouteLogic, breakTaskCron) · `HB/controllers/fleets/fleet-controller.js` · `HB/controllers/tasks/task-controller.js` ·
`HB/models/{Fleets,TasksModel,Breaks,TransportationTypes,Miscellaneous,Region}.js` · `HB/README.md` · `HB/.env.example` (names only) ·
`WB/controllers/blaze/product-controllers.js` · `WB/controllers/blaze/user-cart-controllers.js` · `WB/controllers/order-controllers.js` ·
`WB/controllers/common-controllers.js` · `WB/startup/nodeCrons.js` · `WB/routes/hyperdrive/hyperdrive-routes.js` ·
`SA/src/layouts/Hyperdrive/SiteSetting/index.jsx` · `SA/src/components/hyperdrive/settings/{RoutingConfig,BufferRules,ServiceTime}` ·
`SA/src/redux/apis/hyperdrive/{setting,drivers}.js` · `SA/src/layouts/hyperwolf/HyperdriveTestingPanel.js/WebFlow.js` ·
`SA/src/components/hyperdrive/Tasks/TaskDetails.js` · `SA/src/sideMenus.js` ·
`DB/models/{Regions,SubRegions,regionDriverAssignment,KitBoxes,KitDispatch,DistributionGlobalSettings}.js` ·
`MOCK/lviews.jsx` (SettingsModal `:163-185`) · `MOCK/ldata.jsx` (`:1-20`, `:77`, `:170-188`) ·
`POS-Admin/docs/ROUTING-ENGINE-PLAN-2026-09-17.md` · `CORE/{config,insertion,plan,types,solver,kit-ledger}.ts`, `CORE/solvers/greedy.ts`.
No `.env` file was opened; no system was contacted; no repository was modified; this is the only file created.
