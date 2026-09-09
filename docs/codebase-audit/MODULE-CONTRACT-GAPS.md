# Module contract gaps — what it takes to put each module on `@hyper-tech/contracts`

Compiled 2026-09-09 from five direct inventories in `gaps/` (each with `path:line` and real
`grep -c` counts) and seven earlier partial passes kept in `gaps/_orphans/`. Read this file for
the decisions and the order; read the per-group file for the citations.

| Group | File | Estimate | Order |
|---|---|---|---|
| pos/ + shared/ | `gaps/pos-and-shared.md` | pos L · shared M | 3 (shared first, screen-orders pricing block last) |
| engage/ pweb/ promo/ | `gaps/engage-and-promotions.md` | promo S–M · pweb L · engage M | 2 (promo → pweb → engage) |
| delivery/ logistics/ mobile/ terminals/ | `gaps/delivery-logistics-driver-terminals.md` | logistics L · delivery M · mobile L · terminals M | 5 |
| shop/ athome/ pipeline/ rfid*/ | `gaps/shop-athome-pipeline.md` | shop S · athome L · pipeline M · rfid L (archival) | 4 (shop first, it is nearly there) |
| wm-demo backend | `gaps/wm-demo-backend.md` | pricing+order_lines S · pos_sales S · checkin M · server/engine L | 1 (the backend vocabulary is what every screen reads) |

Bounty and Verify are not in this table: Bounty is being moved now (register → `POST
/api/contracts/orders`, enum lists from the contract), Verify through JT's active session.

## 1. What every module has in common

1. **Money is a dollar float everywhere except Bounty, `shop/`, `screen-task.jsx` and parts of
   `pipeline/`.** Six independent formatters in `shared/` alone (`commerce-engine.js:344,1381`,
   `commerce-governance.js:51`, `hd-format.jsx:32`, `hw-live-lines.js:365`, `demo-seed.js:34`), a
   second `cents()` (`commerce-governance.js:220` vs `commerce-adapter.js:21`), a different rounding
   mode in `hw-live.js:510` (half-even), and five inline `Math.round(n*100)/100` helpers in `pos/`.
   The backend has two dollars↔cents boundaries (`pricing.py:39-42` vs `order_lines.py:102-114`).
   *Decision:* one formatter (`hd-format.jsx`, Intl-based, cents in) and one boundary
   (`commerce-adapter.js` in the browser, `pricing.py` on the server); every other copy becomes an
   alias of those two, then is deleted.
2. **Time is whatever `Date.now()` produced.** 26 raw epoch-ms stores in `pos/`, three ad hoc
   `*1000` conversions, a pseudo-ISO in `hw-live-identity.js:389`, three hardcoded "now" literals in
   `pipeline/`, bare `'7:52 PM'` strings across logistics/delivery/mobile/terminals. The backend
   mixes epoch REAL and ISO text per table (`gaps/wm-demo-backend.md` §3 lists every column).
   *Decision:* `HWContracts.toIso()` / `contracts.to_iso()` at every store or wire site; display
   formatting stays in `hd-format.jsx`.
3. **Ids are bare strings with an assumed prefix.** `wm_brand_id` bare at 40+ sites in
   `pos/screen-brands.jsx` and `shared/hw-live-mapping.js:1028-1074`; `wm_order_id` bare at 129
   backend sites; region ids in three incompatible shapes (`LA-01`, `RC5`, city names); `metrc`
   is missing from `IdSource`. *Decision:* `externalId()` at ingest, `external_ids[]` on records,
   `IdSource` gains `metrc` and `onfleet`; region ids standardise on the `LA-01` shape (2 of 4
   groups already use it).
4. **Roles and store names are literals.** `'Floor Manager'` compared at `pos/screen-aov.jsx:111`,
   `pos/screen-incentives-card.jsx:96`, `delivery/ddata.jsx:119` (`role === 'driver'` — a
   Classification read through a Role field); store slug maps in three `pos/` files plus
   `shared/merch-store.js:49`; `roleFrom()` has zero call sites outside Bounty/Verify.
   *Decision:* `HWInc`-style `role()` on every client; a `stores` registry endpoint
   (`/api/contracts/bounty/stores` already serves contract `Store` rows) replaces every slug map.
5. **Status vocabularies exist per screen.** 98 status comparisons in `pos/`, 85 in `shared/`,
   none through `isEnum`. Three incompatible order-stage lists (contract `OrderStatus`, the
   POS/Weedmaps `FulfillmentStage` verify|pack|packing|ready|done|canceled, and Weedmaps' own
   `DRAFT|PENDING|IN_PROGRESS|READY_FOR_ATTAINMENT|COMPLETE`); four driver-status vocabularies;
   promo status `live` vs `active` between `pweb/` and `promo/`. *Decision:* §2 below.

## 2. Contract additions for v0.2.0 (additive; the drift tests keep the JSON and Python in step)

Proposed from the inventories. Values are the ones the code uses today, lower-case with
underscores where the module and the backend disagree only on punctuation.

| Enum | Values | Source today |
|---|---|---|
| `FulfillmentStage` | verify, pack, packing, ready, done, canceled | `pos/data.jsx:955`, `wmdemo/fulfillment.py:168` (identical) |
| `WeedmapsOrderStatus` | DRAFT, PENDING, IN_PROGRESS, READY_FOR_ATTAINMENT, COMPLETE, CANCELED_SELLER | `pos/data.jsx:300-306`, `fulfillment.py:129` |
| `DriverDutyState` | duty, idle, break, meal, oos, offline, on_route | logistics/pos/delivery/mobile (four lists reconciled) |
| `CalloffStatus` | open, covered | `delivery/ddata.jsx:141` |
| `RegionShiftStatus` | on, off | `delivery/ddata.jsx:18-26` |
| `TerminalKind` | station, mobile | `terminals/tdata.jsx` (wizard emits `driver` — bug) |
| `DrawerState` | open, closed | `terminals/tdata.jsx` |
| `CloseoutDestination` | safe, bank, hand | `terminals/tdrawer.jsx:223` |
| `PaymentMethod` | cash, card, split, cod, prepaid | shop/mobile/pos |
| `Lane` | express, scheduled | `shop/`, `cities.py:214` |
| `CheckinState` | waiting, bound, served, left | `checkin_api.py:101-102` |
| `NotificationChannel` | sms, email, push, wallet | `engage/data.jsx:37` |
| `PromoRelation` | mirrors, supersedes, conflict | `store.py:237-241` |
| `BatchStage` | incoming … destroyed (10) | `pipeline/domain.jsx:24` |
| `LoyaltyTier` | bronze, silver, gold, platinum | `athome/`, `crm.jsx` |
| `PromotionStatus` (widen) | draft, scheduled, active, paused, ended, inactive | `pweb`, `promo`, promotion-backend |
| `IdSource` (widen) | + metrc, onfleet | `pipeline/`, hyperwolf-backend |

Not added on purpose: `TaskStatus` stays underscore (`mobile/` hyphenates and must convert);
`Role` is not widened with display titles (that is what `roleFrom()` is for); `Platform.labels`
is a display concern served by the stores registry, not an enum.

## 3. Real bugs found on the way (fix regardless of the contract work)

- `pipeline/domain.jsx:286-295` overwrites `window.HD` formatters for every page loaded after it,
  while `shared/hd-format.jsx:4-5` says it does not.
- `terminals/tshared.jsx:189-197` creates terminals with `kind:'driver'`; the model uses `mobile`.
- `delivery/dapp.jsx:258` reuses the char-code-sum hash that `ddata.jsx:56-58` documents as a
  prior collision bug; `test/governance.test.mjs` does not cover it.
- `logistics/ldata.jsx:30-44` carries real driver names and phone numbers as fixture data.
- `engage/screen-analytics.jsx:298` divides by 100 before `HD.formatCurrency` (possible double
  conversion); `screen-analytics2.jsx:24` has dead `/100*100/100*100` arithmetic.
- `server.py:3113-3131` re-implements the associate/store ownership check that
  `pos_sales.py:113-118` owns; 169 ad hoc `{"error": …}` literals in `server.py`.
- Global collisions `DRIVERS`/`REGIONS`/`ORDERS` remain live (`test/global-collisions.test.mjs`
  debt register).

## 4. The waves

1. **Backend vocabulary (S–M):** merge the two money boundaries into `pricing.py`; `pos_sales.py`
   and `fulfillment.py` read `TxnType`/`FulfillmentStage` from `contracts.py`; `server.py` error
   literals through `contracts.error()` one route family at a time.
2. **promo/ then pweb/ (S then L):** delete `PLATFORMS` and read `Platform`; one promo status
   vocabulary; one brand registry (`shared/brands.js`); `RuleType` gets its `time`/`payment` UI.
3. **shared/ then pos/ (M then L):** collapse the formatters and `cents()`; `role()` on the POS
   client; stores registry replaces the slug maps; `screen-orders.jsx` pricing block last, and
   `screen-register.jsx` only via a card.
4. **shop/ (S), athome/ (L), pipeline/ (M):** shop's one `*100` moves to the adapter; athome's
   three account screens become one with a variant switch; pipeline stops overriding `window.HD`.
5. **logistics/ delivery/ mobile/ terminals/:** region id shape first, then driver duty state,
   then the money in the drawer math. logistics needs an order-state model before enums help.
6. **rfid*/:** archive the three direction studies; the shipped `rfid/` follows wave 4's rules.

Each wave: contract enums added first (v0.2.0), a probe or test per module before the edit, the
collision test and the module's own probes green, one live check on a fresh port, three refuter
lenses, then commit with explicit paths.
