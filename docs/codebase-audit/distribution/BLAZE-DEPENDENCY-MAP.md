# Blaze dependency map — every touchpoint, what breaks without it

Read-only. Repos read: the twelve clones under `/Users/jt/hyper-tech/` (nothing edited) plus our
own estate (`/Users/jt/POS-Admin`, `/Users/jt/wm-demo`). `distribution-backend`'s Blaze table is
not redone — reused verbatim from `CALLERS-AND-DEPENDENCIES.md` §5, cited here as such. Grep
counts (`grep -arln -i "blaze" --include='*.js' --include='*.ts' --include='*.jsx' --include='*.tsx'`,
node_modules/.next excluded): hyperwolf-backend 59, hyperwolf-super-admin 41, distribution-backend
22, hemp-frontend-nextjs 20, hemp-backend 11, hyperwolf-frontend-nextjs 11, stilo-backend 11,
hyperdrive-backend 5, hemp-retailer-admin 5, promotion-engine 6, promotion-backend 1,
stilo-frontend-nextjs 0.

---

## 1. Every Blaze touchpoint

### 1a. distribution-backend — see `CALLERS-AND-DEPENDENCIES.md` §5 (not repeated in full)

Kit dispatch/refill's real side effect: `POST .../batches/transferInventory` then
`.../transferInventory/:id/accept` (`blaze-syncing-controller.js:503-508`, 8 call sites) — the
inventory-transfer write. Reads: inventories/locations, terminals, transactions (sold-qty sync),
brands, batches, product detail. Per-batch isolated failure (no full-abort). Concept: **transfers
create/accept**, **inventories/locations**, **terminals**, **transactions**.

### 1b. hyperwolf-backend — the storefront's Blaze integration (heaviest, ~110+ call sites)

All calls go through `common/utils.js` (`getRequest`/`postRequest`/`putRequest`/`deleteRequest`,
platform-keyed wrapper) or a second "Blaze Retail" axios track using a cached bearer token
(`generateBlazeRetailToken`, `common/utils.js:1410+`, token stored in `Miscellaneous{uniqueId:
"blazeToken"}`, refreshed by cron every 3 days — `startup/nodeCrons.js:114`).

| Concept | file:line | R/W | What it does | Breaks without Blaze |
|---|---|---|---|---|
| Products (catalog pull) | `blaze-integration-controllers.js:343` (`/inventory/products`), cron-driven `updateAllProducts` (`nodeCrons.js:2`) | R | Nightly sync of Blaze's product catalog into local `Product` collection | No new/changed products ever reach the storefront menu |
| Products (create/update) | `admin/product-controllers.js:40,42,105` | W | Admin creates/updates a product; Blaze is system of record, local mirror follows | Product edits from this admin screen have nowhere to write |
| Batches | `product-controllers.js:990,1722`; `blaze-integration-controllers.js:381` | R | Batch/lot detail for a product (THC, qty) | Batch-level pricing/availability info goes stale |
| Categories | `admin/category-controllers.js:186` | R | Category list sync | Category filters on storefront freeze |
| Brands | `admin/brand-controllers.js:275` (delete), `:74,360` | R/W | Brand list + delete-in-Blaze | Brand admin screen breaks |
| Inventories/terminals/regions | `common-controllers.js:541,546,585,763,867`, `admin/truck-controllers.js:61,76`, `common/utils.js:1409` | R | Terminal↔region mapping, region list, terminal↔employee/inventory lookup | Order routing to the right terminal/region fails |
| Transactions | `common-controllers.js:1027`, `canpay-controllers.js:311` (cancel), `user-cart-controllers.js:606,932` | R/W | Look up / cancel a Blaze transaction; order history | Cash/CanPay cancellation flow and order history break |
| Employees/drivers | `common-controllers.js:379,1267`, `blaze/other-blaze-controllers.js:109,117` | R | Employee/driver roster, nearby drivers | Driver-nearby lookups return nothing |
| Members/loyalty | `user-auth-controllers.js:181,242,264,343,590`; `persona/personaController.js:147,275,319`; `berbix/berbix-controller.js:139`; `blaze/other-blaze-controllers.js:9,22` (loyalty promotions/rewards) | R/W | Member record CRUD during ID-verification (Persona/Berbix) and account update; loyalty promos/rewards list | Member profile edits and loyalty display break; ID-verification vendor call chain half-completes |
| Consumer users (login/register/find/DL photo) | `user-auth-controllers.js:27..495`, `auth-controllers.js:29..207` | R/W | Full consumer account lifecycle — Blaze is the identity store for the storefront login | **No account creation, login, or password reset at all** |
| Cart/checkout | `user-cart-controllers.js:65,211,214,320,428,477,490,506,600,735` | R/W | Active cart, add item, finalize, `submitCart` (creates the Blaze order), cancel, public-cart dispatch link | **No checkout can complete** — this is the actual order-placement call |
| Local BlazeUser mirror | `models/BlazeUser.js`; `member/member-controllers.js:2,18`; `fhl/fhl-controller.js:3,99,162,182` | R (local Mongo, not Blaze) | Local cache of member/consumer fields (`blockOnlinePayments`, `idImage`, `selfiePhotoUrl`) keyed by email/phone | Local-only fields still work; anything needing the live Blaze record does not |

**Confirmed bugs, not hypothetical (relevant to Blaze-down behavior):**
- `common/utils.js:696` — catch block does `Sentry.captureException(ex)` but the caught variable is
  named `error`; `ex` is undefined, so the catch itself throws, masking the real Blaze error.
- `common/utils.js:1436-1441` (`exports.blazeMembers`, `req`-only signature) — catch block does
  `return res.send(error)` with no `res` in scope → `ReferenceError`, again masking the original
  failure. So a Blaze member-search outage surfaces as an unrelated crash, not a clean error.

### 1c. hemp-backend, stilo-backend — same storefront pattern, lighter weight

Both mirror hyperwolf-backend's `common/utils.js` platform wrapper (`hemp-backend/common/utils.js:11,15-17,58-59,105`;
`stilo-backend/common/utils.js:10,14-16,66-67,123`) and the same `generateBlazeRetailToken` /
`blazeToken` Miscellaneous-cache pattern. Confirmed call sites: consumer/cuid lookup + cart-by-id
(`weedmap-controllers.js:24,101` in both repos) — the Weedmaps public-order integration path.
stilo-backend additionally pulls brand name for a product during catalog build
(`controllers/common-controllers.js:1967-1970`) and computes Blaze-vs-local safe-quantity diffs
(`common/utils.js:492-498` in both repos, `checkIfDifferenceInQuantities`). Concept: **products,
inventories, transactions (Weedmaps order path)**.

### 1d. hyperdrive-backend — driver/dispatch side of the same order

Wrapper `common/util.js:10,16-18,21-22,47` (`BLAZE_BASE_URL` / `BLAZE_RETAIL_BASE_URL` +
`generateBlazeRetailToken`, `:352-387`, token cached the same way).

| file:line | Endpoint | R/W | Use | Blaze-down behavior |
|---|---|---|---|---|
| `admin/controllers/headQuarter-controller.js:279` | `GET /partner/regions` | R | Region list for Return-to-HQ tasks | Uncaught — the route's own try/catch returns an error |
| `admin/controllers/task-controller.js:254` | `GET /partner/members/search/phone` | R | Member lookup by phone for the ID-photo/consumer flow | Caught, swallowed (empty catch) |
| `admin/controllers/task-controller.js:1993-2020` (`reassignOrderInBlaze`) | `POST {retail}/pos/shops/transactions/:id/employee` | W | Reassign a transaction's employee/terminal when a driver is reassigned | No inner try/catch (commented out at `:1994`) — propagates to caller |
| `admin/controllers/task-controller.js:2023+` (`fetchEmployeeAndInvId`) | `GET /partner/store/inventory/terminals` | R | Terminal → employee/inventory id lookup | Returns `undefined` silently |
| `controllers/tasks/task-controller.js:1007-1023` (`blazeCancelledOrderStatus`) | `DELETE /partner/transactions/:id` | W | Cancel the Blaze transaction when a delivery task fails | Logged only, not surfaced |

Concept: **transactions (order cancel/reassign)**, **inventories/terminals**, **members**.

### 1e. promotion-engine — reads Blaze for promo eligibility

`utils/common.js:12` (`BLAZE_BASE_URL` as `blazeRetailBaseUrl`), `:1019-1030`
(`getRegionsMaxQuantity`) — `GET /api/v1/partner/products/:productId`, extracts
`sellableQuantities` per region to cap a promotion's max-quantity rule by live Blaze stock.
Also reads a `blazeusers` Mongo collection directly (`:265,295,371,379,820,879,919,940`) for
building promo user-facts (membership group, DOB) — a **local mirror read**, not a live Blaze
call. Concept: **products (pricing/inventory-by-region)**, **members (local mirror)**.

### 1f. promotion-backend — vocabulary only

Single hit is a comment/reference, not a call site (`grep -arln` found 1 file; no
`getRequest('blaze'` pattern present). **Not found** as a real integration.

### 1g. hyperwolf-super-admin, hyperwolf-frontend-nextjs, hemp-frontend-nextjs, hemp-retailer-admin — frontends, indirect only

Frontend axios clients whose paths look like Blaze's own (`/api/v1/partner/store/...`) all point
at `REACT_APP_HYPERWOLF_API_BASE_URL` / equivalent backend base URLs
(`hyperwolf-super-admin/src/axiosClient/index.js:250-259`), i.e. **hyperwolf-backend/hemp-backend
proxying Blaze**, not a direct frontend→Blaze call. Confirmed for `redux/apis/products.js:118`,
`redux/apis/hyperwolf/Driver/driverTerminal.js:8`, `redux/apis/brand.js:41`,
`redux/apis/hyperdrive/setting.js:139`. No direct frontend-to-Blaze network call found in any of
the four frontends.

### 1h. Metrc / track-and-trace

Two distinct things share the name "Metrc" in this estate — do not conflate them:
- **Real state Metrc API integration**: `stilo-backend/controllers/metrc-controllers.js` —
  `getActivePackages` (`:93-108`, `GET /packages/v1/active?licenseNumber=...` via platform
  `"metrc"`, `common/utils.js:60` `METRC_BASE_URL`) and `createSales` (`:22-88`, `POST
  /sales/v2/receipts?licenseNumber=...`) which builds a sales-receipt payload **from stilo's own
  local `Order` DB** (not from Blaze) and reports it directly to Metrc. This is compliance
  reporting that runs **independently of Blaze** today.
- **`hyperwolf-super-admin` "Metrc" admin tabs** (`src/layouts/Metrc/*.js`,
  `src/redux/apis/metrc.js`): despite the name, these are promotion/reward/tax/compliance-fee/
  delivery-fee **settings screens** hitting `stilo-backend`'s `/api/v1/metrc/...` routes — not the
  state track-and-trace API. Naming collision only.

No Metrc reference found in `hyperwolf-backend`, `hemp-backend`, `hyperdrive-backend`,
`distribution-backend`, or our own estate's server code (`grep -i metrc` hits in our estate are
all docs, comments, or the `BatchStage`/`IdSource` enum vocabulary in `contracts/index.js:97`,
`pipeline/domain.jsx`).

### 1i. Our estate

| File | Real call? | What |
|---|---|---|
| `wm-demo/wmdemo/incentives/blaze_client.py` (773 lines) | **Yes — the only real network call in our estate** | Stdlib-only client, `BASE = https://api.blaze.me/api/v1/partner` (`:68`); `get_transactions` (`:294-347`), `get_employees` (`:384-421`); auth via `BLAZE_PARTNER_KEY` / `BLAZE_AUTH_KEY_<store>` (`:154-186`) |
| `wm-demo/wmdemo/incentives/sync_blaze.py` (702 lines) | Driver of the above | `configured_stores()`/`probe()`/`run_pass()` — pulls Blaze transactions+employees per store per day, normalizes, resolves identity, writes to the incentives ledger (`:1-40`). Read-only against Blaze; writes stay local |
| `contracts/index.js:93-97` | No — enum vocabulary | `ProductSource`, `PosVendor`, `IdSource` list `'blaze'` as one allowed value |
| `contracts.py:443,520` | No — mapping helper | Builds an `ExternalId {source:'blaze', id:...}` from stored `blaze_shop_id`/`blaze_member_id` fields; does not call Blaze |
| `idv_store.py:108-109,2010,2028,2038,2067`; `idv_api.py:918,3524` | No — a stored correlation field | `blaze_member_id` column on `idv_people`, for cross-referencing a verified identity to a Blaze member; no outbound call |
| `pos/data.jsx:332,348`; `shared/demo-seed.js:114` | No — sample data noise | "blaze" appears only inside fictitious customer usernames (`xXblaze420Xx`, `blaze_ranger`) |
| `catalog.py:851,902`; `engine.py:4994`; `inventory.py:19-21`; `shells.py:1778` | No — comments/vocabulary | Note the field-alias tolerance for Blaze-shaped exports, or explicitly say "NOT Blaze" (`inventory.py:21`: the location primitive is Hyperdrive's own ledger) |
| `pos_sales.py`, `order_lines.py`, `pricing.py` | **Not found** | Zero Blaze references — these are already Blaze-independent |

---

## 2. What Blaze is for this business today

| Capability | Blaze concept | Consumed by | Our POS equivalent |
|---|---|---|---|
| Product catalog, pricing, brands/categories | products, pricing | hyperwolf/hemp/stilo-backend storefronts, distribution-backend, promotion-engine | **Partial** — `wm-demo/wmdemo/catalog.py` (own catalog, 1872 lines) is real and Blaze-independent, but does not sync from Blaze; it is a separate, parallel catalog, not a mirror |
| Batches/lots, THC%, arrival date | batches | hyperwolf-backend, distribution-backend (kit build/refill FEFO) | **We already have this** — `wm-demo/wmdemo/inventory.py:139-147` `batch_meta(batch_id, sku, thc_pct, price_cents, received_at)` with a FIFO index; more complete on THC/date than what OWNER-NOTES.md found in Blaze's own `ProductBatch` (batchNo/purchaseDate/expiration/qty only, no confirmed THC field — see `OWNER-NOTES.md` Q2, still open) |
| Inventory locations (safe/kit/shelf) | inventories | distribution-backend, hyperwolf-backend | **We already have this** — `inventory.py:130-138` `location_stock(location_id, sku, batch_id, qty)`, generalized past Blaze's single-inventory-per-region model |
| Terminals (POS registers/trucks) | terminals | hyperwolf-backend, distribution-backend, hyperdrive-backend | **None real** — `TerminalKind` enum's only source is `POS-Admin/terminals/tdata.jsx`, a frontend mock; no backend terminal record in wm-demo |
| Order placement / checkout | transactions, order tags asap/scheduled | hyperwolf/hemp/stilo-backend (`submitCart`), distribution-backend (ASAP vs scheduled fulfillment split, `common-controllers.js:125` per `OWNER-NOTES.md`) | **Partial** — `wm-demo/server.py` has `/api/pos/sale`, `/api/order/stage`, `/api/order/lines`, `/api/orders/held`, `/api/order/release-hold`; no explicit asap/scheduled tag equivalent found — closest is `Lane` enum (`express`/`scheduled`, `contracts/index.js:114`) |
| Inventory transfers (create/accept) | transfers | distribution-backend only | **None** — no transfer/2-step-accept concept anywhere in wm-demo |
| Members / consumer accounts | members | hyperwolf/hemp/stilo-backend (login, register, profile) | **None** — `idv_*` tracks verification identity, not a purchasing account; no cart/account model tied to a customer in wm-demo |
| Loyalty / rewards | loyalty, promotions | hyperwolf-backend (`other-blaze-controllers.js:9,22`), hyperwolf-super-admin | **None in wm-demo** — customer loyalty is AlpineIQ's domain per the `alpineiq-hyperwolf-marketing-analytics` skill, not Blaze and not our POS; `incentives/rewards.py` is staff incentive points, a different concept (`PointsKind` enum) |
| Sales data for commission/incentives | transactions | wm-demo `incentives/blaze_client.py` | **N/A — this direction already works without touching Blaze's POS role**, it only reads sales history |
| Metrc / track-and-trace reporting | (Blaze normally reports Metrc itself for stores that use it) | stilo-backend reports **directly** to Metrc, bypassing Blaze (`metrc-controllers.js:22-108`) | Confirms Metrc reporting is **not exclusively tied to Blaze** in this estate — one store already reports independently |

---

## 3. The POS adapter boundary — `PosProvider` port

Following the contract shapes in `contracts/index.js` (`Product`, `Order`, `OrderLine`, `Store`,
`Money`, `ExternalId`). `ExternalId.source` for our POS should be `'hwpos'` — that is the value
already reserved in the `PosVendor`/`IdSource` enums (`contracts/index.js:95,97`); there is no
`'hyperwolf-pos'` value today, and introducing one would fork the enum instead of reusing it.

```
PosProvider {
  // Catalog
  listProducts(storeId)                    -> Product[]
  getProduct(productId)                    -> Product
  getBatches(productId)                    -> { batchId, thcPct, priceCents, receivedAt, qty }[]

  // Inventory
  getLocationStock(locationId)             -> { sku, batchId, qty }[]
  moveBatch(fromLocationId, toLocationId, sku, batchId, qty) -> void

  // Orders
  createOrder(cart: OrderLine[], storeId, customerId?) -> Order
  getOrder(orderId)                        -> Order
  cancelOrder(orderId, reason)             -> void

  // Terminals (not yet real anywhere)
  listTerminals(storeId)                   -> { terminalId, kind, regionId }[]

  // Transfers (distribution-backend only today)
  createTransfer(fromLocationId, toLocationId, lines) -> Transfer
  acceptTransfer(transferId)               -> void

  // Members (storefront only today)
  findMember(query: {email|phone|id})      -> Person | null
  updateMember(memberId, patch)            -> Person
}
```

- **`BlazeProvider`** maps `listProducts`→`GET /partner/store/inventory/products`,
  `getBatches`→`GET /partner/store/batches`, `createOrder`→`POST
  /partner/store/cart/submitCart/:cartId` (the actual hyperwolf-backend flow,
  `user-cart-controllers.js:600`), `createTransfer`/`acceptTransfer`→distribution-backend's
  `transferInventory` pair, `findMember`→`GET /partner/members/...`. `listTerminals`→`GET
  /partner/store/inventory/terminals`.
- **`HyperwolfPosProvider`** maps `listProducts`/`getProduct`→`wm-demo` `catalog.py` +
  `/api/catalog/import`, `getBatches`/`getLocationStock`/`moveBatch`→`inventory.py`'s
  `batch_meta`/`location_stock`/`move_batch` directly, `createOrder`→`POST /api/pos/sale` +
  `/api/order/stage`, `cancelOrder`→`/api/order/release-hold` (closest existing verb; no direct
  cancel endpoint found — **gap**). `listTerminals`, `createTransfer`/`acceptTransfer`,
  `findMember`/`updateMember` have **no implementation to map to** — see below.
- **Operations our POS cannot serve yet**: terminals (no model at all), transfers (no
  create/accept concept), members/loyalty (no account or points-balance concept — that domain
  today is AlpineIQ + Blaze, not our POS or wm-demo).
- **What no provider should own**: Metrc reporting stays a separate `ComplianceReporter` concern
  (stilo-backend already proves it does not have to route through the POS provider — it reads the
  local `Order` table directly); RFID verification stays out of the port too, per
  `OWNER-NOTES.md`'s explicit rule that RFID output must never be wired into `/api/kit` (the public
  Weedmaps menu write path) — RFID is a verification layer that reads a provider's plan, not a
  provider operation itself.

---

## 4. Migration order

1. **Dual-write period**: keep `BlazeProvider` as the only writer for orders/transfers/members
   while `HyperwolfPosProvider` comes up read-only against a shadow copy of the catalog/inventory,
   so discrepancies surface before anything depends on it.
2. **Cut catalog/pricing first** — lowest risk, already has a real local implementation
   (`catalog.py`, `inventory.py`'s batch/location model). No dependency on terminals or members.
3. **Cut inventory locations/batches next** — `inventory.py` is already more expressive than
   Blaze's own `ProductBatch` on THC/date fields (§2); this is a genuine upgrade, not a
   downgrade, once storage-location field is added (open question, `OWNER-NOTES.md` Q1).
4. **Terminals and transfers must be built before they can cut** — no existing implementation to
   fail over to; these need new wm-demo tables/routes before distribution-backend's transfer flow
   or hyperwolf-backend's terminal routing can move.
5. **Orders/checkout and members/loyalty cut last** — the storefront's entire consumer-facing
   surface (`user-cart-controllers.js`, `user-auth-controllers.js`) depends on Blaze as the
   identity and transaction system of record; no local equivalent exists at all today.
6. **Metrc reporting is decoupled already** — stilo-backend's direct integration proves the
   compliance-reporting cutover does not have to wait on any of the above.

**Data to migrate**: batches (THC/date/qty per location — richer target schema already exists),
locations (safe/kit/shelf/vehicle — target schema already exists), terminals (no target schema —
must be designed), open transfers (in-flight `transferInventory` pairs at cutover must be drained
or dual-tracked, not dropped).

---

## 5. Open questions for the owner

1. Does Blaze's own `ProductBatch` record storage location, THC%, and package date the way
   `wm-demo/inventory.py`'s `batch_meta` already does? (Same open question as `OWNER-NOTES.md`
   Q1/Q2 — answering it tells us whether migrating batch data is a straight copy or a backfill.)
2. Is `PosVendor`/`IdSource`'s existing `'hwpos'` value the intended `ExternalId.source` for our
   POS, or should a distinct `'hyperwolf-pos'` value be added to the enum before any provider
   code ships?
3. Terminals have no backend model anywhere in wm-demo — is a terminal, for our own POS, a
   physical register, a driver's phone, or both? This decides the shape before `listTerminals` can
   be built.
4. Members/loyalty: does "leaving Blaze" include replacing Blaze's member/loyalty system, or is
   AlpineIQ meant to absorb that role entirely (per the `alpineiq-hyperwolf-marketing-analytics`
   skill's framing as "Hyperwolf's loyalty and CRM platform")? The migration order above assumes
   the latter but it changes what `PosProvider.findMember`/`updateMember` need to do.
5. Transfers/create-accept: should the two-step protocol (create, then a separate accept call)
   be preserved in `HyperwolfPosProvider`, or was that shape only ever a Blaze API constraint we
   don't need to reproduce?
6. Is stilo-backend's direct-to-Metrc reporting (`metrc-controllers.js`) meant to become the
   pattern for every store, replacing Blaze's own Metrc reporting store-by-store, or is it a
   one-off for stilo?
7. `common/utils.js:696` and `:1436-1441` in hyperwolf-backend mask real Blaze errors behind
   `ReferenceError`s today — worth a standing fix regardless of the Blaze exit, since any
   `BlazeProvider` adapter built on top of this file inherits the same silent-failure behavior.
8. Promotion-engine reads a live Blaze `sellableQuantities` figure per region to cap promo
   quantity (`utils/common.js:1019-1030`) — does that rule need to keep reading live stock during
   dual-write, or is a periodic snapshot acceptable?
