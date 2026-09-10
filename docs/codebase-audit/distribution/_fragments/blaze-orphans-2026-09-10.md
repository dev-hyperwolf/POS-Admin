# Blaze touchpoints — fragments from a fanned-out agent (cross-check against BLAZE-DEPENDENCY-MAP.md)

## Our estate (POS-Admin + wm-demo)
Only ONE real Blaze network integration: `wm-demo/wmdemo/incentives/blaze_client.py` (BASE
`https://api.blaze.me/api/v1/partner`, :68; urllib request/retry :199-269; `get_transactions`
:294+), driven by `incentives/sync_blaze.py:131-314`. Auth from env `BLAZE_PARTNER_KEY` /
`BLAZE_AUTH_KEY_<slug>` (:184-186). Everything else is vocabulary: `contracts/index.js:93,95,97`
(ProductSource / PosVendor / IdSource include `blaze`), `contracts.py:443,520` (ExternalId source
"blaze" from stored `blaze_shop_id` / `blaze_member_id`), `idv_store.py` column `blaze_member_id`,
demo names in `pos/data.jsx:332,348` and `shared/demo-seed.js:114`. `catalog.py`, `engine.py`,
`inventory.py`, `pricing.py`, `order_lines.py`, `pos_sales.py`: no Blaze; their "batch"/"terminal"
are our own FIFO lot tracking and IDV terminal status.

## hyperdrive-backend
Wrapper `common/util.js:35-125` (+ `combineBaseurl` :20-29) prepends `BLAZE_BASE_URL`; per-call
auth headers. Retail/session API uses a Bearer token from `generateBlazeRetailToken`
(`common/util.js:352-387`, `POST {BLAZE_RETAIL_BASE_URL}/api/v1/mgmt/session`, token cached in
`Miscellaneous{uniqueId:"blazeToken"}`, refreshed only when absent, not on 401 — UNVERIFIED).
| # | file:line | endpoint | dir | use | if Blaze down |
| 1 | `admin/controllers/headQuarter-controller.js:279` | `GET /partner/regions` | read | regions → ReturnToHQ tasks | 400 WRONG_ERROR |
| 2 | `admin/controllers/task-controller.js:254` | `GET /partner/members/search/phone` | read | member lookup by phone for ID photo + consumerUserId | swallowed (`catch {}` :261) |
| 3 | `admin/controllers/task-controller.js:1993-2020` `reassignOrderInBlaze` | `POST {retail}/pos/shops/transactions/{id}/employee` | write | reassign transaction's employee/terminal on driver reassignment | no try/catch inside (`// try {` :1994 commented); callers catch → 400 |
| 4 | `admin/controllers/task-controller.js:2023-2049` `fetchEmployeeAndInvId` | `GET /partner/store/inventory/terminals` | read | terminal → employee/inventory ids | returns undefined silently |
| 5 | `controllers/tasks/task-controller.js:1007-1029` `blazeCancelledOrderStatus` | `DELETE /partner/transactions/{id}` | write | cancel the Blaze transaction when a task fails (:961) | console.log only |
| 6 | `controllers/tasks/task-controller.js:782-822` | members/active, transactions/complete | — | dead (commented out) | — |
Metrc: zero hits in hyperdrive-backend.

## hyperwolf-backend (109 call sites through `common/utils.js:134/164/188/208`, base `:78-79`; plus a "Blaze Retail" direct-axios track with a cached bearer token `common/utils.js:641`, refreshed by cron every 3 days `startup/nodeCrons.js:114`)
Concepts: product catalog pull + local upsert (`controllers/blaze/integration/blaze-integration-controllers.js:343,401`, cron `nodeCrons.js:13-17`); batches/terpenoids (`:378`; `product-controllers.js:990,1722`); product create in Blaze (`admin/product-controllers.js:40`); categories (`admin/category-controllers.js:186`); brands delete (`admin/brand-controllers.js:275`); terminals (`common-controllers.js:541,867`, `truck-controllers.js:61,76`, `common/utils.js:1409`); regions sync (`common-controllers.js:546,585,763`, `region-controller.js:11,37`, cron `nodeCrons.js:117`); promotions/rewards (`other-blaze-controllers.js:9,22`, email templates, optin, herbpixel); **members read+write** during ID verification and auth (`persona/personaController.js:147,275,319`, `berbix-controller.js:139`, `user-auth-controllers.js:181,242,264,343`); **consumer users: login, register, find-by-phone/email, DL photo upload** (`user-auth-controllers.js:27..495`, `auth-controllers.js:29..207`); **cart/checkout: active cart, add, finalize, submit (creates the Blaze order), cancel, history** (`user-cart-controllers.js:65,428,477,490,506,600,606,735,932`); transactions lookup/cancel (`common-controllers.js:1027`, `canpay-controllers.js:311`); employees/drivers (`common-controllers.js:379,1267`, `fhl/driver-controllers.js:22,33`, intercom); store payment options (`payment-options.js:13`).
Bugs noted: `common/utils.js:696` catch references undefined `ex` → callers of `acceptMember` hang; `:1441` catch calls `res.send` with no `res` in scope → ReferenceError masks the Blaze error; retail token errors reject with the string "error".
Metrc: zero hits in hyperwolf-backend.
**Meaning:** the consumer storefront (hyperwolf-frontend-nextjs via hyperwolf-backend) is a thin shell over Blaze for accounts, carts, orders and loyalty — leaving Blaze is a storefront replatform, not only an inventory one.

## The other nine repos
- hemp-backend: 6 real calls (`common/utils.js:59,589` session token; `intercom-controllers.js:19` employees; `weedmap-controllers.js:24,101` user/cart; `persona/personaController.js:204,248` member read/PUT); token refresh cron `nodeCrons.js:69`. Metrc: none.
- stilo-backend: same patterns (`common/utils.js:66/123`) + `common-controllers.js:1967` product by id. **Metrc: REAL — `controllers/metrc-controllers.js:1-75` `createSales()` POSTs sales (Order + batches) to Metrc with Basic auth; `METRC_BASE_URL/USERNAME/PASSWORD` in `common/utils.js:60,92-93`.** So Stilo reports to Metrc in its own code; Hyperwolf has no Metrc code → Blaze does it for Hyperwolf.
- hemp-frontend-nextjs, hyperwolf-frontend-nextjs: no direct Blaze calls; every `partner/...` call goes through their own backend. hyperwolf-frontend has one dead devtunnel stub (`lib/api/services/common.ts:231-235`, zero callers).
- hyperwolf-super-admin: proxied through hyperwolf-backend (`axiosClient/index.js:250`); "Sync products from blaze" button (`layouts/hyperwolf/products/index.jsx:199,538,575`); Metrc-named admin CRUD via stilo-backend (`redux/apis/metrc.js:5-38`) — templates/receipts, not track-and-trace calls.
- hemp-retailer-admin: every Blaze-shaped call commented out; `blazeCategories` field name only.
- promotion-backend: name only ("Welcome to Blaze middleware APIs").
- promotion-engine: REAL direct — `utils/common.js:1023` product by id (region max qty), `:1121-1146` products by ids (allSettled), used by BOGO evaluator `rule-types/bogo/evaluator.js:267-270,460`.
- stilo-frontend-nextjs: none.
