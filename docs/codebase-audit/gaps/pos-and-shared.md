# pos/ and shared/ — contract-gap inventory (2026-09-09, read-only)

Source: `docs/BUILD-AGAINST-THE-SOURCE.md` §3, `contracts/index.js` ENUMS/SCHEMAS.

## 1. Enum literals

- **Role** — `pos/app.jsx:160` `role: 'Floor Manager'`; second copy `pos/data.jsx:170`
  `STATS.associate.role:'Floor Manager'`; consumed as `a.role === 'Floor Manager'` in
  `pos/screen-aov.jsx:111`, `pos/screen-incentives-card.jsx:96` (comment: "same exact check
  pos/screen-aov.jsx uses"), `pos/screen-register.jsx` (grep -c 1). All map to contract `Role`
  via `ROLE_MAP['floor manager'] = 'manager'` — none call `roleFrom()`.
- **Store id/name** — three incompatible shapes coexist: `pos/app.jsx:161` / `pos/data.jsx:170`
  `storeId:'elsinore'` (slug), `pos/data.jsx:136` `STORE.id:'HW-00001-101'` (vendor-looking
  code), `pos/data.jsx:136` `STORE.name:'Hyperwolf Lake Elsinore'` (display string used as if
  an id in `shared/merch-store.js`, `shared/demo-seed.js`, `shared/hw-live.js`,
  `shared/hw-live-checkin.js`, and `pos/screen-city-listing.jsx`, `pos/screen-publish-gate.jsx`,
  `pos/verification.jsx`). NO CONTRACT ENUM YET → propose `Store` registry lookup (contract
  already has a `Store` schema at `contracts/index.js:272`, but nothing here reads from a
  registry — every file hardcodes one of the three shapes).
- **Order fulfillment stage** — `pos/screen-orders.jsx:4-9` `STAGES` = `['verify','pack',
  'packing','ready','done']`, consumed at lines 1022, 2564, 3718-3745 (`stageOrder`). Does not
  match contract `OrderStatus` (`pending|confirmed|packed|out_for_delivery|completed|cancelled|
  refunded`) or `TaskStatus`. NO CONTRACT ENUM YET → propose `OrderFulfillmentStage: ['verify',
  'pack','packing','ready','done']`, distinct from `OrderStatus`.
- **Map-pin "role"** (`'storefront'|'delivery'`) in `pos/screen-catalog.jsx:738,1343,1906` and
  `shared/hw-live-regions.js:354-760` (grep -c 8) is a different vocabulary from person `Role`
  — false-positive on naming only. NO CONTRACT ENUM YET → propose `FulfillmentChannel:
  ['storefront','delivery']` if this estate wants it closed.
- **Platform** (`hyperwolf|hemp|stilo`) — zero literal hits in pos/ or shared/; `'weedmaps'` is
  used instead as a channel/vendor concept (`pos/screen-orders.jsx` grep -c 7, e.g. line 3285
  `lineSource === 'weedmaps'`), which is in contract `IdSource` but not `Platform`. Gap: no
  screen reads `Platform` from anywhere — order/channel literals are ad hoc strings.
- **TxnType** (`sale|refund|void`) — only a UI filter chip `'sale'` (`screen-orders.jsx:2289`,
  meaning "on sale", unrelated) and `settle.direction === 'refund'` (`screen-orders.jsx:2157`).
  Real sale/refund/void decisioning lives in the pricing block below, as float math, not as a
  `TxnType`-tagged record.
- **Brands** — clean: `shared/brands.js` is the one list (16 entries); `pos/pricing-shared.jsx`
  `BRAND_ALIASES` (lines 105-125+) maps scraped vendor strings onto `brands.js` keys only, never
  reintroduces a literal name. No violation found.

## 2. Money

Nothing in `pos/` calls `contracts/index.js` `money()`/`centsFromDollars()`. Three independent
formatters exist:
- `pos/data.jsx:424-427` `fmt.money`/`fmt.money0` (dollars-in, `Number.toLocaleString`) — exposed
  as `window.HW.fmt`, called via local `_money()` aliases in `pos/customer-extras.jsx:5`,
  `pos/payment.jsx:4`, and `_money0()` in `pos/screen-aov.jsx:97`, `pos/screen-incentives-card.jsx:25`.
- `shared/hd-format.jsx:31-33` `formatCurrency`/`formatCents` (the only one that is actually
  cents-in) — grep shows **zero** callers in `pos/` or the rest of `shared/`. Dead relative to
  this scope.
- `shared/commerce-adapter.js:21` `cents = (dollars) => Math.round(+dollars*100)` — the one real
  dollars→cents boundary named in BUILD-AGAINST-THE-SOURCE, used only inside the commerce-engine
  bridge (lines 74, 80), not from any `pos/` screen.
- Ad hoc float math with `.toFixed(2)`/`*100`/`/100`, no formatter at all: heaviest in
  `pos/screen-orders.jsx` (25 `toFixed` + 6 `*100`/`/100`, e.g. lines 3083-3513, the entire
  cart/refund/tender pricing block) and `pos/sales-panel.jsx` (4 `toFixed`, lines 53-118, its
  own sales-tax total independent of `pos/data.jsx`'s tax calc at lines ~415-422). Also
  `pos/screen-brands.jsx` (8), `pos/screen-catalog.jsx` (2 toFixed + 18 `*100`/`/100`).

## 3. Time

- `Date.now()` bare epoch: `pos/screen-orders.jsx` (8), `pos/store.jsx` (3),
  `pos/screen-publish-gate.jsx` (4), `pos/screen-register.jsx` (2), plus 10 more files at 1-2
  each. None pass through `contracts.toIso()`/`isoFromEpoch()`.
- `toISOString()` used directly (bypassing `isoNow()`'s ms-trim): `pos/screen-orders.jsx:1`,
  `pos/checkin-verify-seam.jsx:1`, `shared/commerce-governance.js` (5), `shared/notes.js` (7),
  `shared/commerce-engine.js` (4). These will carry `.123Z` where the contract's `isoNow()`
  strips milliseconds — a wire-format mismatch, not just a style one.
- No bare `YYYY-MM-DD` day-key misuse found as a full timestamp in this scope (not chased past
  a spot check — flag for follow-up if a screen keys off a bare date as a moment).

## 4. Ids

- Store ids: see §1 (three shapes, no registry read).
- Person id: `'manisha-saini'` slug (`pos/app.jsx:161`, `pos/data.jsx:170`) — display key today,
  consistent with contract intent, but nothing marks it `associate_id` vs a foreign key; it's
  just `USER.id`.
- Vendor ids: `weedmaps` appears only as a brand-color token (`P.brand.weedmaps*`, ~15 refs in
  `pos/screen-orders.jsx`) and once as a bare string comparison (`lineSource === 'weedmaps'`,
  line 3285) — never wrapped in `externalId('weedmaps', …)`. Blaze/Meadow/Treez: no direct id
  literals found in this scope (13+ files matched on the word "blaze" etc. but as prose/labels,
  e.g. `pos/tokens.jsx`, `pos/screen-brands.jsx` — not bare id usage; not itemized further here,
  worth a targeted follow-up pass if vendor ids do flow through `pos/`).

## 5. Store/person/brand literals

Covered under §1 (store/person) and brands (clean, §1). No additional literal brand names found
outside `shared/brands.js` and its alias table.

## 6. Second copies

- **Role check** `a.role === 'Floor Manager'` — `pos/screen-aov.jsx:111` and
  `pos/screen-incentives-card.jsx:96` (latter's own comment admits the duplication).
- **Person/role/store record** — `pos/app.jsx:160-161` `USER` and `pos/data.jsx:170`
  `STATS.associate` are two independently-maintained copies of the same logged-in person (the
  file's own comment at `data.jsx:162-164` acknowledges a third copy in `wmdemo/associates.py`).
- **Money formatter** — three (see §2): `pos/data.jsx` `fmt`, `shared/hd-format.jsx` `HD`
  (currently unused from this scope), and inline `toFixed` arithmetic.
- **Order stage list** — `STAGES` array duplicated conceptually via `stageOrder` at
  `pos/screen-orders.jsx:3745`; single file, not cross-file, so lower priority.
- **Wait formatter** — checked, NOT duplicated: `shared/hw-wait.js` `HW_WAIT.shortWait` is
  correctly the only implementation, called inline (never aliased) from
  `pos/screen-register.jsx:1509,1656` and `pos/screen-orders.jsx:452`, matching its own
  header comment's instruction.

## 7. Estimate to put each file group on the contract

| File group | Size | Est. | Reason |
|---|---|---|---|
| `contracts/index.js` role/store adoption in `pos/app.jsx` + `pos/data.jsx` | ~15 lines touched | **S** | Two literal blocks, swap for `HWContracts.roleFrom()` + a store lookup; both already load in browser via UMD global. |
| `pos/screen-aov.jsx` + `pos/screen-incentives-card.jsx` role checks | 2 lines | **S** | Replace `a.role === 'Floor Manager'` with `HWContracts.roleAtLeast(a.role, 'manager')`; deletes the acknowledged duplicate. |
| Money formatters (`pos/data.jsx` `fmt`, callers in customer-extras/payment/screen-aov/screen-incentives-card) | ~6 files, formatter + call sites | **M** | Formatter itself is small, but every caller assumes dollars-in; must decide the storage boundary (keep dollars display-only, add `centsFromDollars` at data entry) before touching call sites. |
| `pos/screen-orders.jsx` pricing/refund block (lines ~3030-3520) | ~500 lines of float math | **L** | Largest, highest-risk block: cart totals, tax, tender, refund cap all chained float `toFixed`; needs a real cents-based rewrite plus test coverage before it's safe, and it also owns the `STAGES`/`stageOrder` enum. |
| Store id unification (`pos/data.jsx` `STORE`, `pos/app.jsx` `USER.storeId`, `shared/merch-store.js`, `shared/demo-seed.js`, `shared/hw-live*.js`) | 6+ files | **L** | Three incompatible id shapes already in production paths; needs a single `Store` registry read (contract schema exists) before any file can be converted individually, or conversions will disagree with each other mid-migration. |
| Time (`Date.now()` / raw `toISOString()`) across ~15 files | many, 1-8 hits each | **M** | Mechanical swap to `toIso()`/`isoNow()` per call site, but wide (15+ files) so budget half a day to touch and spot-check them all. |
| `pos/screen-register.jsx` (FROZEN) | 2360 lines | — | Every finding above that also appears here (role literal, store literal, `Date.now()` x2, `toFixed` x1) is **frozen: integrate via a card, never edit** — do not touch this file directly; wrap/replace at the shell level. |

**Recommended order**: (1) role — smallest, unblocks the two duplicate-check files; (2) store-id
registry — blocks everything else that reads a store shape, so do it before money/time work
touches the same files; (3) money formatter consolidation; (4) time sweep (mechanical, can run
in parallel with anything once contracts are loaded); (5) `screen-orders.jsx` pricing block last
— largest blast radius, wants the store/money primitives settled first so it converts once.
