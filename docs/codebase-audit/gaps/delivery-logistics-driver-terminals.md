# Gap audit — delivery/, logistics/, mobile/ (Driver App), terminals/

Read-only inventory. Contract source: `contracts/index.js` (386 lines). Datamodel source:
`docs/codebase-audit/repos/hyperdrive-backend.datamodel.md`.

## 1. Enum literals

**Region ids — three incompatible taxonomies, none contract-backed.**
- `delivery/ddata.jsx:18-26` (`SUBREGIONS`): `LA-01, LA-02, SB-01, SB-02, OC-01, OC-02, RC-01, RC-02, RC-03` — county-prefixed, dash, 2-digit.
- `logistics/ldata.jsx:30-43` (driver rows) and `:50-64` (`ORDERS`): `RC1..RC5, RC8, SB1..SB3` — no dash, different county set (RC8 doesn't exist in delivery's scheme; SB only goes to 3 vs delivery's SB-02 cap).
- `mobile/data.jsx:147`: `DRIVER.regionId: 'RC-01'` — matches delivery's dash format but is the only mobile instance.
- `pos/data.jsx:139`: `REGIONS = ['Lake Elsinore','Wildomar','Lakeland Vlg','Temescal','Murrieta']` — plain city names, no ids at all.
NO CONTRACT ENUM YET → propose `RegionId` as a format contract (not a fixed value list — real regions), pick one shape (`LA-01` style already used by 2/4 groups) and require it project-wide.

**Driver/fleet status — four vocabularies, zero overlap with `FleetStatus`/`FleetVerificationStatus`.**
- `logistics/ldata.jsx:30-43`: `status: 'duty'|'idle'|'oos'|'break'|'meal'` (11 rows carry one of these values).
- `pos/data.jsx:141-146`: `status:'on-route'|'idle'|'offline'` — only `idle` overlaps logistics.
- `delivery/ddata.jsx:18-26` (`SUBREGIONS.status`): `'on'|'off'` — region-coverage, not driver duty, but shares the field name `status`.
- Contract `FleetStatus.values = ['active','inactive']` (`contracts/index.js:79-80`) and `FleetVerificationStatus.values = ['pending','verified']` (`:81-82`) map to none of the above — these are operational on-shift states, a different concern than the contract enum, and hyperdrive-backend's real `Fleets.fleetStatus` (`hyperdrive-backend.datamodel.md:353`) is also just `inactive, active`, confirming none of the three UI vocabularies trace back to the backend model either.
NO CONTRACT ENUM YET → propose `DriverDutyState: [duty, idle, oos, break, meal, offline, on-route]` and reconcile to one list, separate from `FleetStatus`.

**Task status — mobile hyphenates; contract and backend both use underscores.**
- `mobile/data.jsx:238-243` (`STATUS` map keys): `'not-started', 'in-progress', 'completed', 'cancelled'`. Used at `mobile/data.jsx:86,88,90,92` (task rows), `mobile/screen-home.jsx:99,281`, `mobile/screen-activity.jsx:47`, `mobile/screen-task.jsx:562`. `'not-started'` appears 5x across mobile/*.jsx.
- Contract `TaskStatus.values = ['not_started','unassigned','in_progress','completed','cancelled']` (`contracts/index.js:75-76`, sourced from `hyperdrive-backend/models/TasksModel.js validTaskStatus`).
- Backend `TasksModel.js` schema default is also `'not_started'` per `hyperdrive-backend.datamodel.md:613` (`taskStatus | String | No | 'not_started'` — though the doc flags the schema itself declares no enum, a separate bug).
- **Disagreement**: mobile's hyphens (`not-started`) never match the contract's or the backend default's underscores (`not_started`) — a literal string comparison against a contract-shaped payload would always fail. Also mobile has no `unassigned` state at all.

**Call-off status — undocumented, 2-value, local to delivery.**
- `delivery/ddata.jsx:141-143` (`CALLOFFS`): `status: 'open'|'covered'` (3 rows). NO CONTRACT ENUM YET → propose `CalloffStatus: [open, covered]`.

**Closeout destination kind — undocumented, terminals-only.**
- `terminals/tdrawer.jsx:223-226` (`DESTS`): `v: 'safe'|'bank'|'hand'` (3 literal rows). No `CloseoutKind`/`CloseoutDestination` enum exists anywhere in `contracts/index.js`. NO CONTRACT ENUM YET → propose `CloseoutDestination: [safe, bank, hand]`.

**Terminal kind — 2-value, undocumented, but internally consistent.**
- `terminals/tdata.jsx:18,23,28,33,38` (`kind:'station'`, 5 rows) and `:78` (`kind:'mobile'`, 1 row) — used consistently as `t.kind !== 'station'` in `terminals/tdrawer.jsx:227`. NO CONTRACT ENUM YET → propose `TerminalKind: [station, mobile]` (low priority — only 2 values, one file group).

**Vehicle type — free text, not an enum anywhere.**
- `logistics/ldata.jsx`: `vehicle: 'Car'` (rows 30,32-36,38-43 = 9), `'Bike'` (row 37), `'Bicycle'` (row 41).
- `mobile/data.jsx:147`: `vehicle: 'Van · 7HWL294'` — full free-text string (model + plate), not a type at all.
- No `Vehicle`/`VehicleType` key in `contracts/index.js`. Backend `Fleets.fleetTransportationTypeId` refs a `TransportationTypes` collection (`hyperdrive-backend.datamodel.md:341`) — an id lookup, not a literal — so neither UI copy matches the backend's own representation. NO CONTRACT ENUM YET → propose `VehicleType` once TransportationTypes' real values are pulled from hyperdrive-backend.

**Order status — absent.** `logistics/ldata.jsx` `ORDERS` (rows 50-64, 15 orders) has no `status` field at all; state is inferred from `driver` (null/assigned), `sched`, `future`, `late`. Contract `OrderStatus.values = ['pending','confirmed','packed','out_for_delivery','completed','cancelled','refunded']` (`:73-74`) is never referenced in this file group. Not a disagreement (nothing to disagree with) but a **coverage gap** — any consumer of this table cannot reconstruct a contract-shaped `OrderStatus`.

## 2. Money

Floats throughout every group; contract's `Money` schema is cents (integer) + `MoneyBasis` enum (`contracts/index.js:266`, values `ex_tax_net|ex_tax_gross|inc_tax` at `:59`). No file in scope uses cents or `MoneyBasis`.
- `pos/data.jsx:424-427` defines the one shared formatter, `fmt.money`, on **float dollars**: `'$'+Number(n).toLocaleString(...)`. Re-exposed as `window.HW.fmt.money`.
- `terminals/tshared.jsx:4`, `terminals/tdrawer.jsx:7`, `terminals/v2.jsx:7`: each redeclares `const money = window.HW.fmt.money;` — a local alias repeated 3x (harmless per the collision test's own carve-out, but still 3 copies of a one-liner).
- `delivery/dapp.jsx:6`: same alias.
- `logistics/lorder.jsx:4`: **diverges** — `const money = (n) => window.HW ? window.HW.fmt.money(n) : '$' + Number(n).toFixed(2);` — a fallback path with its own float-to-string formatting, a second implementation, not just an alias.
- `terminals/tdrawer.jsx` cash-counting: `DENOM_COINS`/`DENOM_ROLLS` (`:10-11`) use fractional-dollar floats (`0.25, 0.10, 0.05, 0.01`) rather than integer cents — classic float-accumulation risk in exactly the drawer-reconciliation math the file exists for (`variance` computed at lines 164/188/209/220/255-263/319-321; 9 `toFixed(2)` call sites).
- `terminals/tdata.jsx` seed data: `expected:1240.50, cardSales:3120.75` etc. (`:18-40`) — float dollars baked into demo data too.
- `logistics/ldata.jsx` `ORDERS.cash` field (rows 50-64): bare integer/float dollar amounts (e.g. `cash: 64`), no currency/basis tagging.
- No file in scope calls `MoneyBasis` or builds a contract `Money` object — this is a systemic gap, not a per-file bug.

## 3. Time

No file in scope imports or references `shared/hw-wait.js` (confirmed: `grep -rn "hw-wait"` across the whole repo returns only comments in `pos/screen-register.jsx:1562` and `pos/screen-orders.jsx:444` — the wait format is used in `pos/` and nowhere else in the audited scope).
- **Bare human-formatted-string times, not epoch/ISO**, baked directly into data: `logistics/ldata.jsx` `ORDERS` rows 50-64 — `placed: '7:40 PM'`, `deadline: '7:58 PM'`, `eta: '8:14 PM'`, `win: 'Today 8:30–9:00 PM'`. None of these are machine-comparable without re-parsing a 12-hour string; `late` is a separately-maintained derived integer (minutes), not computed from the two timestamps.
- `delivery/ddata.jsx:139-143` `CALLOFFS.at`: `'7:42 AM'` / `'Yesterday 6:10 PM'` — same bare-string pattern, plus a relative-day prefix with no defined vocabulary (`Yesterday`, presumably also `Today`/weekday names elsewhere, unverified in this pass).
- **Second copy of time formatting**: `delivery/dapp.jsx:140-141` defines its own `fmtTime`/`fmtHrs` (regex-parses `H:MMa`/`H:MMp` into `H:MM AM/PM`) — a bespoke parser independent of `shared/hw-wait.js`, the one file the codebase names as canonical for wait/time format.
- `logistics/ldata.jsx:29` driver rows use `etaNext: 7.6` (bare float minutes, 10 rows carry this field) and `since: '5:02 PM'` (bare string) side by side — two different time representations in the same object.
- `mobile/data.jsx:73` `etaStatus(slack)` and `:65` `latestArrival(t)` are mobile's own ETA/slack logic, independent of both `shared/hw-wait.js` and logistics's `etaNext` — a third, unrelated ETA implementation.
- `Date.now()` appears only incidentally (`delivery/dapp.jsx` x2, `mobile/screen-task.jsx` x1) — not used as the basis for any of the above computations.

## 4. Ids

- **Driver ids**: `logistics/ldata.jsx` bare integers (`id: 1193`, rows 30-43); `mobile/data.jsx:147` prefixed string `'DRV-2291'`; `delivery/ddata.jsx` driver identity is by `name` string only (no id field on `SUBREGIONS`/`CALLOFFS` driver entries) — three shapes, one of which (delivery) has no id at all, only a name, making driver identity in that file group unjoinable without a name-match.
- **Order ids**: `logistics/ldata.jsx` `id` (bare int, e.g. `1012`) plus a separate `txn` string (`'1284420'`) on the same row — two identifiers per order, relationship between them undocumented.
- **Region ids**: see §1 — three shapes/taxonomies.
- **Store/terminal ids**: `terminals/tdata.jsx:12` `STORE_T.code: 'HW-00001-101'`; `STATIONS[].id: 'ST1'..'ST5'` (`:18-40`) — internal, not tied to any Blaze store id format seen in scope.
- **Blaze/Onfleet bare ids**: none found used directly in this scope — `delivery/ddata.jsx:46` has only a comment referencing "Blaze region rooms," no live Blaze id is read or written by these four file groups. (Scope is clean here; not a finding, but confirms the estate's Blaze/Onfleet id risk lives outside delivery/logistics/mobile/terminals.)

## 5. Store/person/region names as literals — KNOWN collisions

Per `test/global-collisions.test.mjs` `KNOWN` register (lines 108-123), confirmed by direct `const` declaration search:
- `DRIVERS`: `pos/data.jsx:140` (6 rows) vs `delivery/ddata.jsx:119` (1-line derived filter, not a literal array) vs `logistics/ldata.jsx:29` (14 rows). Usage counts: `delivery/ddata.jsx` DRIVERS=3, `logistics/ldata.jsx` DRIVERS=7, `logistics/lviews.jsx` DRIVERS=1.
- `REGIONS`: `pos/data.jsx:139` (5 city-name strings) vs `logistics/ldata.jsx:12` (region-object array). Usage: `delivery/ddata.jsx` REGIONS=5 (its own `COUNTIES`/`SUBREGIONS`, not the colliding global — file doesn't declare `REGIONS` itself), `delivery/dapp.jsx` REGIONS=3, `delivery/dmap.jsx` REGIONS=1, `logistics/ldata.jsx` REGIONS=5, `logistics/lorder.jsx` REGIONS=1, `logistics/lviews.jsx` REGIONS=3.
- `ORDERS`: `pos/data.jsx:124` vs `logistics/ldata.jsx:50` (15 rows). Usage: `logistics/ldata.jsx` ORDERS=5, `logistics/lorder.jsx` ORDERS=1, `logistics/lviews.jsx` ORDERS=1.
- `L`: `logistics/lparts.jsx` then `lparts2.jsx`, `lorder.jsx`, `lviews.jsx` (3 clobbers, all within `logistics/`, already in `KNOWN`).
- `D`: `delivery/dmap.jsx` then `delivery/dapp.jsx` (within `delivery/`, already in `KNOWN`).
- `money`: `terminals/tshared.jsx` then `tdrawer.jsx` and `v2.jsx` (already in `KNOWN`; per §2 these are identical-value aliases, the harmless case the test's own comment carves out).

## 6. Second copies (helpers defined more than once)

- `money`/`fmtMoney` wrapper: 5 declarations across scope (`terminals/tshared.jsx:4`, `terminals/tdrawer.jsx:7`, `terminals/v2.jsx:7`, `delivery/dapp.jsx:6` — all identical aliases to `window.HW.fmt.money`) plus one **divergent** reimplementation with its own fallback formatting at `logistics/lorder.jsx:4`.
- Time formatting: `delivery/dapp.jsx:140-141` (`fmtTime`/`fmtHrs`) is a standalone reimplementation not shared with `shared/hw-wait.js` or with logistics'/mobile's own ETA code (`logistics/ldata.jsx` `etaNext` numeric field, `mobile/data.jsx:65,73` `latestArrival`/`etaStatus`) — three unrelated time/ETA mechanisms, zero code reuse between them.
- Region/county lookup helpers: `delivery/ddata.jsx:29-31` `effSettings`/`overriddenKeys`/`COUNTY_BY_ID` have no counterpart in `logistics/ldata.jsx`'s `RMAP` (`:66`) — same conceptual need (region → display/settings lookup), two independent shapes, not literally duplicated code but duplicated concern with zero shared contract.

## 7. Size estimate, order, reasons

| File group | Size | Order | Reason |
|---|---|---|---|
| `delivery/` (ddata.jsx, dapp.jsx, dmap.jsx) | M | 2nd | Region-id taxonomy is the one delivery/mobile agree on — fix here first as the anchor, then reconcile logistics to it; also owns the only call-off enum and its own time-parsing second copy. |
| `logistics/` (ldata.jsx, lorder.jsx, lparts.jsx, lparts2.jsx, lviews.jsx) | L | 1st | Largest surface (5 files, ~161KB), owns the incompatible region-id set, the undocumented driver-duty vocabulary, the divergent `money()` reimplementation, and the `ORDERS` table with no `OrderStatus` at all — highest concentration of contract gaps, and other groups' fixes depend on knowing which region-id shape wins. |
| `mobile/` (Driver App, 18 files) | L | 3rd | Largest file count but the task-status hyphen/underscore mismatch is a single, mechanical, low-risk rename (`STATUS` map + 3 call sites); do after region/driver-status is settled so mobile's `regionId: 'RC-01'` has a confirmed target format to conform to. |
| `terminals/` | M | 4th | Cash-closeout float math (`tdrawer.jsx`) is real risk but self-contained (one file) and has no cross-group enum dependency other than the shared `money()` alias — safe to do last and independently. |

---
Non-goals verified out of scope: no bare Blaze/Onfleet ids found in these four groups; `OrderStatus`/`TaskAssignmentMode`/`PromotionStatus` contract enums are simply unused here rather than contradicted.
