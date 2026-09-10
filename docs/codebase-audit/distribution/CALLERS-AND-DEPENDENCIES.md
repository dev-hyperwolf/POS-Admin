# distribution-backend — callers and dependencies

Read-only cross-repo study, done before any change to kit build/dispatch, refill, closure, or
report logic. Every claim carries `repo/path:line`. Repos read: the twelve clones under
`/Users/jt/hyper-tech/`. Nothing in that tree was edited. Sources read first, per instructions:
`/Users/jt/POS-Admin/docs/codebase-audit/repos/distribution-backend.md` §1/§3/§10 and
`DEPLOY-MAP-FROM-REPOS.md`.

---

## 1. Routes inventory

Mounted in `distribution-backend/startup/routes.js:19-31`. All 13 groups, `admin` = JWT middleware
(`middlewares/admin.js`); `—` = no middleware (unauthenticated).

Format per group: `METHOD path → controllerFn (line)`; `admin` = JWT middleware, `—` = none.

**`/api/v1/admin/boxes`** (`routes/boxes/boxes-routes.js`, all `admin`): POST `/add`→`addBox`(7); GET `/list`→`listBoxes`(8); GET `/detail/:id`→`getBoxesDetail`(9); DELETE `/delete/:id`→`deleteBoxes`(10); PUT `/update/:id`→`updateBoxes`(11); GET `/unassigned/products`→`getUnassignedProducts`(12); GET `/unassign/products`→`getUnassignProducts`(13); POST `/assign/products`→`productsAssigned`(14).

**`/api/v1`** (`routes/common-routes.js`, **all unauthenticated**): POST `/upload/image`→`uploadIdProof`(6); POST `/upload/multiImages`→`uploadMultipleImages`(7); POST `/blaze/brands`→`saveBrands`(8); GET `/brands/list`→`listBrands`(9); POST `/product/batches`→`saveProductBatches`(10); GET `/sync/sold/qty`→`syncSoldQty`(11).

**`/api/v1/admin/distribution`** (`routes/distribution/distribution-routes.js`): POST `/add`→`addDistributionGlobalSettings`, admin, validation(7); GET `/view`→`getDistributionGlobalSettings`, no auth(8).

**`/api/v1/admin/aging/rules`** (`routes/distribution/aging-rules-routes.js`, all `admin`): POST `/add`→`addAgingRules`(7); GET `/list`→`getAgingRules`(8); GET `/show/:id`→`showAgingRules`(9); PUT `/update/:id`→`updateAgingRules`(10); DELETE `/delete/:id`→`deleteAgingRules`(11); GET `/products`→`getAgingProducts`(12); GET `/boxes`→`getAgingBoxes`(13); GET `/promotion/products`→`getPromotionsProducts`(14); GET `/get/category`→`getAgingRulesCategory`(15); GET `/box/products`→`getAgingRulesProduct`(16); GET `/box/promotions/products`→`getAgingRulesPromotionsProduct`(17).

**`/api/v1/admin/region`** (`routes/regions/region-routes.js`, all `admin` except `/list`): POST `/add/sub`→`addSubRegions`(9); GET `/sub/list`→`getSubRegions`(10); DELETE `/sub/delete/:id`→`deleteSubRegionRules`(11); GET `/sub/show/:id`→`showSubRegion`(12); PUT `/sub/edit/:id`→`editSubRegion`(13); POST `/add`→`addRegion`(15); GET `/list`→`listRegions`, **no auth**(16); GET `/get/:regionId`→`getRegionDetail`(17); PUT `/update/:regionId`→`updateRegion`(18); DELETE `/delete/:regionId`→`deleteRegion`(19); PUT `/update/sub/assign/driver/`→`updateSubRegionDriverAssign`(21); DELETE `/delete/sub/assign/driver`→`deleteSubRegionDriverAssign`(22); GET `/get/unassigned/drivers`→`getUnassignedDrivers`(24); GET `/get/unassigned/subRegions`→`getUnassignedSubRegions`(26); GET `/bulk/unassign/driver`→`getBulkUnassignment`(27).

**`/api/v1/admin/template`** (`routes/kitTemplate/kit-template-routes.js`, all `admin` except the two noted): POST `/add`→`addKitTemplate`(8); POST `/copy/distribution-to-refill`→`copyDistributionToRefill`(9); GET `/get/products`→`getTemplateProducts`(10); GET `/detail/product/sku/list/:id`→`detailTemplateProductSku`(11); GET `/list`→`listKitTemplate`, **no auth**(12); DELETE `/delete/:id`→`deleteKitTemplate`(13); PUT `/update/:id`→`updateKitTemplate`(14); GET `/get/:id`→`getKitTemplate`(15); GET `/product/sku`→`getProducts`(17); POST `/product/sku`→`addTemplateSku`(18); GET `/product/sku/list/:id`→`listTemplateProductSku`(19); PUT `/product/sku`→`updateTemplateProductSku`(20); POST `/product/sku/delete`→`deleteTemplateProductSku`(21); GET `/get/plannerNotes/:id`→`getPlannerOverrideNotes`(23); GET `/get/unassigned/region`→`getUnassignedRegions`, **no auth**(24); GET `/get/template/subregions`→`getTemplateSubRegions`, **no auth**(25).

**`/api/v1/admin/manage-distributions`** (`routes/manageDistributions/manage-distributions-routes.js`, all `admin` except `/reports/download`): POST `/cron`→`kitDistributed`(6); GET `/list`→`listDistributions`(7); GET `/detail`→`detailDistributions`(8); DELETE `/delete`→`deleteDistributions`(9); GET `/get/region`→`getDistributionsRegions`(10); GET `/get/boxes`→`getDistributedBoxes`(11); GET `/get/distributed/products`→`distributedProductList`(12); GET `/get/products`→`getDistributedProducts`(13); POST `/freeze`→`freezeDistribution`(14); GET `/get/freeze/distribution`→`getDistributionBoxes`(15); GET `/low/stock/products`→`lowStockProductsList`(16); GET `/low-stock/products`→`lowStockProduct`(17); GET `/low-stock/boxes`→`lowStockProductBoxes`(18); POST `/add/region`→`addRegion`(19); POST `/add/product`→`addProduct`(20); POST `/bulk/delete`→`bulkProductDelete`(21); POST `/bulk/product/edit`→`bulkProductEdit`(22); POST `/bulk/product/refill/edit`→`bulkRefillProductEdit`(23); DELETE `/delete/region`→`deleteRegion`(24); POST `/box/products`→`getBoxesUnassignedProducts`(25); GET `/fleets`→`getfleets`(26); GET `/box/pdf`→`boxPdfDownload`(27); GET `/driver/kit/pdf`→`driverKitPdfDownload`(28); GET `/get/regions`→`getRegions`(29); GET `/reset`→`resetDistribution`(30); POST `/use/qty`→`distributionUsedQty`(31); GET `/reports/download`→`downloadReport`, **no auth**(32).

**`/api/v1/admin/kit-refill`** (`routes/kitRefill/kit-refill-routes.js`, all `admin` except `/reports/download`): GET `/list`→`listRefillLogs`(6); GET `/logs`→`listKitRefillAuditLogs`(7); GET `/logs/:refillId`→`getKitRefillAuditLog`(8); GET `/get/regions`→`getRegions`(9); GET `/get/products`→`getProducts`(10); POST `/cron`→`dailyRefillKit`(11); DELETE `/delete/:refillId`→`deleteRefillLog`(12); GET `/use/qty`→`useDistributedProductQty`(13); GET `/low/stock`→`getRefillLowStockProduct`(14); GET `/box/pdf`→`boxPdfDownload`(15); POST `/delete/product`→`deleteRefillProduct`(16); GET `/region/pdf`→`boxRegionPdfDownload`(17); GET `/reports/download`→`downloadReport`, **no auth**(18); POST `/bulk/delete`→`bulkRefillProductDelete`(19); POST `/bulk/add/product`→`bulkRefillProductAdd`(20); POST `/box/products`→`getRefillBoxesUnassignedProducts`(21).

**`/api/v1/admin/driver-kit-verification`** (`routes/driverKitVerification/driver-kit-verification-routes.js`, all `admin` except the two PIN-recovery routes): GET `/list`→`listDistributions`(6); GET `/view/kit`→`getDriversKit`(7); GET `/driver/product/list`→`driverProductList`(8); POST `/dispatch`→`driverKitDispatch`(9); POST `/scan/items`→`scanItems`(10); GET `/report`→`kitReport`(11); GET `/reset`→`resetVerification`(12); POST `/reset/product`→`resetProduct`(13); POST `/keep`→`keepProductAsNew`(14); GET `/onHold`→`onHoldVerification`(15); GET `/product/detail`→`getProductDetail`(16); POST `/discrepancy`→`addDiscrepancy`(17); PUT `/discrepancy/:id`→`updateDiscrepancy`(18); GET `/discrepancy/:id`→`detailDiscrepancy`(19); DELETE `/discrepancy/:id`→`deleteDiscrepancy`(20); POST `/pin/login`→`pinLogin`, admin(22); POST `/user/reset/pin`→`resetPIN`, **no auth**(23); POST `/user/forgot/pin`→`forgotPIN`, **no auth**(24); GET `/onhold/report`→`onHoldAndReport`(26).

**`/api/v1/admin/discrepancy-management`** (`routes/discrepancyManagement/discrepancy-management-routes.js`, all `admin`): GET `/approvals`→`getDiscrepancyApprovals`(7); GET `/approvals/:id`→`getDiscrepancyApprovalDetail`(8); PUT `/approvals/:id/action`→`updateDiscrepancyApproval`(9); GET `/list`→`getDiscrepancyData`(11); GET `/:id`→`getDiscrepancyDetail`(12); PUT `/:id/status`→`updateDiscrepancyStatus`(13); POST `/:id/comment`→`addDiscrepancyComment`(14); GET `/:id/logs`→`getDiscrepancyLogs`(15); POST `/scan/items`→`discrepancyScanItems`(16); GET `/inventory/managers`→`getInventoryManagers`(18).

**`/api/v1/admin/closure-overview`** (`routes/closureOverview/closure-overview-routes.js`, all `admin`): GET `/list`→`getData`(6); GET `/drivers`→`getDrivers`(7); GET `/detail`→`getClosureDetail`(8); POST `/approve`→`approveClosure`(9); GET `/revenue`→`getRevenueReconciliation`(10); POST `/discrepancy`→`addDiscrepancy`(11); GET `/discrepancy/:id`→`detailDiscrepancy`(12); PUT `/discrepancy/:id`→`updateDiscrepancy`(13); DELETE `/discrepancy/:id`→`deleteDiscrepancy`(14); POST `/force/closure`→`forceClosure`(15); GET `/report`→`viewReport`(17).

**`/api/v1/admin/waste-inventory`** (`routes/wasteInventory/waste-inventory-routes.js`, all `admin`): GET `/list`→`listWasteInventory`(6); GET `/get/:id`→`getWasteInventoryById`(7).

**`/api/v1/blaze/distribution`** (`routes/blaze/blaze-syncing-routes.js`, **all unauthenticated**): GET `/sync/blaze/inventory`→`syncInventory`(5); POST `/inventory`→`createBulkInventoryTransfer`(6); POST `/refill/inventory`→`createRefillTransfers`(7); POST `/driver/syncing`→`bulkInventoryTransferSubRegionWise`(8); POST `/driver/refill/syncing`→`transferInventoryBySubRegionRefill`(9); POST `/check/inventory`→`checkSafeInventory`(10); GET `/check/sold`→`checkInvnetoryTerminalWise`(12); GET `/check/sold/driver`→`checkSoldQtyByDriver`(13).

**140 routes total.** The whole `blaze-syncing-routes.js` group (8 routes) and all 6
`common-routes.js` routes carry **no** auth middleware — matches `distribution-backend.md` §6.

---

## 2. Frontend callers

Grepped all four frontends for the distribution base-URL env var and for each route path
string.

- **hyperwolf-super-admin**: `REACT_APP_DISTRIBUTION_API_BASE_URL`, used in
  `src/axiosClient/indexDistribution.js:7` (axios instance, JWT `Authorization` header injected in
  the request interceptor, `:22`) and `src/socket.js:4,6` (Socket.IO client). This is the **only**
  real caller in the estate.
- **hyperwolf-frontend-nextjs**: `NEXT_PUBLIC_DISTRIBUTION_API_BASE_URL` is wired into
  `lib/api/client.ts:6,43-46` (`distributionClient`, base URL falls back to
  `https://distribution-backend.js.thcs.in` — the real prod host, `client.ts:6`) and imported into
  `lib/api/services/products.ts:1` and `lib/api/services/common.ts:1` — but **never called**
  (`grep -arn "distributionClient\.\(get\|post\|put\|delete\)" hyperwolf-frontend-nextjs` → zero
  hits). Dead wiring, not a live caller.
- **hemp-retailer-admin**, **stilo-frontend-nextjs**: no distribution env var anywhere in
  `.env.example`, no reference to `distribution-backend` or its route strings. Confirmed by
  grepping every route-path substring from §1 across the whole tree (see below) — zero hits in
  either repo.

All real traffic to distribution-backend from the twelve repos comes from one file tree:
`hyperwolf-super-admin/src/redux/{apis,slices}/hyperwolf/*` and `src/redux/apis/{auth,common}.js`.

**Route → caller table** (file:line in `hyperwolf-super-admin`, screen inferred from folder/thunk name):

| Route | Caller file:line | Screen |
|---|---|---|
| boxes: add/list/detail/delete/update/unassign(ed)/assign | `redux/slices/hyperwolf/inventoryDistribution.js:11,22,34,45,57,70,82,93` | Boxes management |
| distribution: add/view | `:107,118` | Distribution global settings |
| aging/rules: add/update/list/delete/boxes/get-category/box-products/box-promo-products | `:142,154,165,176,189,131,211,233` | Aging rules |
| aging/rules: `show/:id`, `products`, `promotion/products` | none found (`show/:id` uncalled; the other two calls exist but are **commented out**, `:200,222`) | dead FE code paths |
| template: add/list/copy-to-refill/delete/get/update/get-products/planner-notes/unassigned-region/template-subregions/product-sku(PUT,POST,delete) | `:246,257,268,279,291,303,325,551,393,650,360,371,382` | Kit template builder |
| template: `product/sku` GET, `product/sku/list/:id` GET | none live — both calls **commented out** (`:314,337`) | dead FE code paths |
| manage-distributions: cron/list/detail/delete/get-region/get-boxes/get-distributed-products/freeze/get-freeze/low-stock(products,boxes)/add-region/add-product/bulk-delete/bulk-edit/bulk-refill-edit/delete-region/box-products/fleets/box-pdf/driver-kit-pdf/get-regions/reset | `:661,419,738,452,430,441,485,694,683,518,496,540,628,562,716,727,672,606,595,749,782,584,793` | Manage distributions dashboard |
| manage-distributions: `get/products`, `low-stock/products` (both) | none live — commented out (`:474,507,529`) | dead FE code paths |
| manage-distributions: `use/qty`, `reports/download` | **no caller found** | — |
| kit-refill: list/get-regions/get-products/cron/delete/use-qty/low-stock/box-pdf/delete-product/region-pdf/bulk-delete/bulk-add-product/box-products/logs | `:806,828,817,839,885,861,850,760,896,771,573,639,617,907` | Kit refill dashboard |
| kit-refill: `logs/:refillId`, `reports/download` | **no caller found** | — |
| driver-kit-verification: list/view-kit/driver-product-list/dispatch/scan-items/report/reset/reset-product/keep/onHold/product-detail/discrepancy(add,put,get,delete)/pin-login/forgot-pin/onhold-report | `:920,931,942,964,1108,953,986,997,1008,1019,1030,1041,1097,1052,1063,1074,1085,1395` | Driver kit verification screen |
| driver-kit-verification: `user/reset/pin` | `redux/apis/auth.js:30` | Driver-kit reset-PIN flow |
| discrepancy-management: approvals/list/comment/logs/scan-items/inventory-managers/status/approval-detail/approval-action/detail | `:1279,1234,1268,1256,1313,1324,1336,1290,1302,1245` | Discrepancy management |
| closure-overview: list/drivers/detail/revenue/report/approve/discrepancy(add,put,delete)/force-closure | `:1121,1132,1143,1154,1165,1176,1187,1199,1210,1221` | Store closure overview |
| closure-overview: `discrepancy/:id` GET (detail) | **no caller found** | — |
| waste-inventory: list/get | `:1349,1360` | Waste inventory |
| blaze/distribution: `inventory`, `check/inventory`, `check/sold/driver` | `:705,975`, `apis/hyperwolf/kitRefillLogs.js:5` | Manage distributions (bulk transfer), driver verification (safe-inventory check), kit-refill logs |
| blaze/distribution: `sync/blaze/inventory`, `refill/inventory`, `driver/syncing`, `driver/refill/syncing`, `check/sold` (terminal-wise) | **no caller found anywhere in the twelve repos** | — |
| common: `upload/multiImages`, `blaze/brands`, `sync/sold/qty` | **no caller found** | — |
| common: `upload/image` | `redux/apis/common.js:170` | generic file upload widget |
| common: `brands/list` | `:406` | Kit template builder (brand filter) |

**14 routes with no caller found anywhere in the twelve repos**: `manage-distributions/use/qty`,
`manage-distributions/reports/download`, `kit-refill/logs/:refillId`, `kit-refill/reports/download`,
`closure-overview/discrepancy/:id` (GET), `blaze/distribution/sync/blaze/inventory`,
`blaze/distribution/refill/inventory`, `blaze/distribution/driver/syncing`,
`blaze/distribution/driver/refill/syncing`, `blaze/distribution/check/sold`,
`common/upload/multiImages`, `common/blaze/brands`, `common/sync/sold/qty`,
`aging/rules/show/:id`. The `reports/download` and Blaze-sync-only endpoints are plausibly hit by
a script, a cron/GAS trigger, or a browser-opened link rather than the SPA's axios client — none
of that is visible from these twelve repos. The 5 template/manage-distributions routes called only
from **commented-out** FE code (§2 table) are effectively dead on the live client today even
though the route itself is live.

No server-to-server caller exists either: grepped `hemp-backend`, `hyperdrive-backend`,
`hyperwolf-backend`, `promotion-backend`, `promotion-engine`, `stilo-backend` for
`distribution-backend`/the base-URL var/host string — zero hits in all six.

---

## 3. The driver client

**There is no separate driver-facing app in the twelve repos.** The PIN-login, scan, and
Socket.IO flow that the repo doc (`distribution-backend.md` §1) speculated might belong to "a
driver-facing mobile/PWA client" is in fact implemented **inside `hyperwolf-super-admin`** — the
same admin web app — as one screen:

- `hyperwolf-super-admin/src/components/distributionSetting/driverKitVerification/components/driverKitDetails.js:31` calls `useSocket()` (`src/HOC/useSocket.jsx`), which connects the shared `socket` (`src/socket.js:6`) on mount.
- `driverKitDetails.js:526` emits `socket.emit('scanProduct', payload, (response) => {...})` — the only client→server event distribution-backend's `common/socket.js:20` listens for. The server never emits back (`grep -arn "io.emit|socket.emit" distribution-backend` → zero hits outside `common/socket.js`'s own listener); the response comes back only via the ack callback.
- `src/common/CommonModal/Hyperwolf/pinCodeModal.jsx` and `driverKitDetails.js` call `verifyPin` → `POST /api/v1/admin/driver-kit-verification/pin/login` (`inventoryDistribution.js:1074`).

**And the PIN itself is not a driver credential.** `pinLogin` (`driver-kit-verification-controller.js:5163-5187`) checks the PIN against the **`Admin`** model (conn2, hemp-backend's DB) and requires `user.userRoles.includes("Super Admin")` (`:5173`) — it is a step-up re-auth for a super-admin operator using this screen, not a delivery-driver login. This corrects the repo doc's "driver-facing" framing: the intended user is warehouse/admin staff running the verification screen (plausibly on a tablet at the warehouse), authenticated first by their normal admin JWT and then re-confirmed by PIN before scanning.

**Socket auth is not enforced either way**: server CORS is `origin: "*"` (`common/socket.js:12`, cited in the repo doc §8) and the client's own `socket.auth = { token }` line is commented out (`useSocket.jsx:17`) — the connection carries no token at all today.

If a genuinely separate driver mobile app exists, it is **outside the twelve-repo estate** and
would need to implement, verbatim:
- `POST /api/v1/admin/driver-kit-verification/pin/login` `{ pin, email }` (admin JWT required first)
- `POST /api/v1/admin/driver-kit-verification/scan/items` `{ productBatchId, distributionId, driverId, regionId, subRegionId, userId }` (via `discrepancyManagement` and `driverKitVerification` scan endpoints share the same shape, see `services/scanItems.service.js`)
- Socket.IO event `scanProduct` with payload `{ productBatchId, distributionId, driverId, regionId, subRegionId, userId }` and an ack callback (`common/scanHandler.js:4-22`), no other events exist.

---

## 4. Cross-database reach

`startup/db.js:18-24` opens three Mongoose connections at boot, stored on `global.dbConnections`;
any failure calls `process.exit(1)` (`:27`).

- **conn1** = `DATABASE_URL`, own DB. 18 models — the kit/refill/closure transactional core
  (`KitDistributed`, `KitDispatch`, `KitTemplate`, `KitRefill`, `Discrepancy`, `Regions`,
  `SubRegions`, `Boxes`, `AgingRules`, etc.). All reads and writes stay local.
- **conn2** = `HEMP_DATABASE_URL`, hemp-backend's DB. 2 models: `Admin`, `ResetRequest` — **read
  and write**. `Admin` backs the JWT auth (`middlewares/admin.js:13`) and the PIN re-auth (§3);
  `resetPIN` (`driver-kit-verification-controller.js:5205`) writes `storeUser.pin` directly onto
  hemp-backend's `Admin` document via `.save()`.
- **conn3** = `HYPERWOLF_DATABASE_URL`, hyperwolf-backend's DB. 11 models. Read-mostly, with two
  confirmed cross-service **writes**:
  - `ProductBatch.bulkWrite(operations, { ordered: false })` — `controllers/common-controllers.js:823`, inside `saveProductBatches` (the unauthenticated `POST /api/v1/product/batches`, §1). Upserts `{ productId, batchData, updatedDate, safeInventory }` per product (`:793-806`) — a full-document `$set` on a collection hyperwolf-backend's own `Product`/batch code also owns.
  - `FleetOffDutyCloseout.findOneAndUpdate(filter, { $set: { status: "approved", closedBy, updatedDate } })` — `controllers/closureOverview/closure-overview-controller.js:1060`, inside `approveClosure` (`POST /api/v1/admin/closure-overview/approve`). Flips a driver's end-of-shift closeout to `approved` on hyperwolf-backend's collection. `FleetOffDutyCloseout` is also read at `:59,501,801,1431,1606,1797` throughout the closure-overview flow.
  - Everything else on conn3 (`Fleets`, `Order`, `Brand`, `Category`, `Closeout`, `FleetOnDutyChecklists`, `OnDutyChecklists`, `Miscellaneous`, `Products`) is read-only from this repo — no `.save()`/`updateOne`/`bulkWrite` found against them (`grep -arn` for those verbs on each model name → zero hits beyond the two above).

**Flow dependency**: kit dispatch/refill (`manageDistributions.repository.js`, `kitRefill`
controllers) read `Products`/`ProductBatch`/`Fleets` from conn3 to build kit contents and driver
lists, but their writes stay on conn1. Only **closure approval** and the **product-batch sync
job** write into another service's database — those two are the actual cross-service blast points,
not the kit/refill build path itself.

Per `distribution-backend.md` §3: `models/Fleets.js` here is an independently-drifting 0.82
near-duplicate of hyperwolf-backend's own `Fleets` schema; a schema change on either side does not
propagate to the other — re-verified true, no shared schema package exists.

---

## 5. Blaze

All calls go through `common/utils.js:15-40` (`getRequest`/`postRequest`, generic axios wrapper
keyed by `platform: 'blaze'|'stageblaze'`) or, for transfer creation, the retry/rate-limit wrapper
`makeApiRequest` in `controllers/blaze/blaze-syncing-controller.js:244-275`.

| Endpoint | Method | Env var(s) | Used for | Blaze-down behavior |
|---|---|---|---|---|
| `/api/v1/partner/store/inventory/inventories` | GET | `BLAZE_BASE_URL` | List Blaze inventory locations, map region→inventoryId (`blaze-syncing-controller.js:47,3760`) | Uncaught in these two call sites → propagates to the route's own try/catch → HTTP 400 (no `asyncMiddleware`, see repo doc §6) |
| `/api/v1/partner/store/inventory/terminals` | GET | `BLAZE_BASE_URL` | Terminal→region map (`:3661`, `common-controllers.js:87`) | Same as above |
| `/api/v1/partner/transactions` | GET | `BLAZE_BASE_URL` | Sold-quantity sync (`common-controllers.js:179`) | Caught locally, returns partial response |
| `/api/v1/partner/store/inventory/brands` | GET | `BLAZE_BASE_URL` | Brand list sync (`common-controllers.js:440`) | `.then/.catch` — logged, does not crash the request |
| `/api/v1/partner/store/batches?productId=` | GET | `BLAZE_BASE_URL` | Fetch batch/lot detail for a product, repeated at 5 call sites in the discrepancy/refill flow (`:1957,2071,2686,2785`) | Uncaught at call site → bubbles to route handler |
| `/api/v1/partner/products/:productId` | GET | `BLAZE_BASE_URL` | Product detail lookup (`:3295`) | Same |
| `/api/v1/partner/store/batches` (product batches by id) | GET | `BLAZE_BASE_URL` | `:3519` | Same |
| `/api/v1/partner/store/batches/transferInventory` | POST | `BLAZE_BASE_URL`, `BLAZE_API_KEY`, `BLAZE_API_KEY_TOKEN` | **Create** an inventory transfer — the actual kit-dispatch/refill Blaze write, called per-batch inside a `Promise.all` with concurrency 3 (`:503-508`, repeated at 8 call sites) | Per-batch `try/catch` (`:488-...`) — a failed transfer is recorded as `{success:false}` in the batch result array, does **not** abort sibling batches or the whole distribution run |
| `/api/v1/partner/store/batches/transferInventory/:id/accept` | POST | same | **Accept** the transfer just created (2-step transfer protocol) | Same per-batch isolation |

`makeApiRequest` (`:244-275`) retries only on HTTP 429 (waits `retry-after` seconds and
recurses); any other error (Blaze down, 5xx, timeout at 30s) is thrown and caught by the
per-batch wrapper described above — so a Blaze outage during dispatch produces partial failures
(some transfers succeed, some fail and are reported), not a full abort or duplicate-transfer risk,
since retries only fire for the 429 case, never for a failed create/accept pair.

`RATE_LIMITS`/`processingState.dailyRequestCount` (`:20-46`, not fully read) impose a daily
request budget shared across the whole process (global mutable counter) — a large distribution
run and a concurrent manual retry can exhaust that budget for every other Blaze-dependent route in
the same process, including unrelated ones like `check/sold/driver`.

---

## 6. Env vars and hosts

Every var in `.env.example` is referenced in code and vice versa (`grep -aroh
"process\.env\.[A-Z_]*"` → 27 distinct vars, all present in `.env.example`; the repo doc's "28"
count in §8 is off by one, not a real gap).

Kit/refill/closure/Blaze-relevant vars: `DATABASE_URL`, `HEMP_DATABASE_URL`,
`HYPERWOLF_DATABASE_URL` (§4), `BLAZE_BASE_URL`, `RETAIL_BLAZE_BASE_URL`, `BLAZE_API_KEY`,
`BLAZE_API_KEY_TOKEN`, `BLAZE_SAFE_INVENTORY`, `CURRENT_EMP_ID` (§5), `JWT_ADMIN_PRIVATE_KEY`,
`PUBLIC_TOKEN` (dead, §6 of repo doc), `AWS_ACCESS_KEY`/`AWS_SECRET_ACCESS_KEY`/`AWS_REGION`/
`AWS_S3_BUCKET`/`S3_BRAND_BASE_URL` (uploads), `SENDGRID_*`, `SENTRY_DSN` (dead).

**Host**: `DEPLOY-MAP-FROM-REPOS.md:7` — `development` branch push → self-hosted runner →
`docker compose up --build` → deploys to `/var/www/html/node-js/distribution-backend`, no
hostname/IP given for the runner. `hyperwolf-frontend-nextjs/lib/api/client.ts:6` gives the real
prod host as a fallback constant: `https://distribution-backend.js.thcs.in`.

Cross-checked against `AWS-INVENTORY-2026-09-10.md`: no EC2 instance is named
`distribution-backend` or `thcs`. **Unknown** — the inventory cannot tie the `thcs.in` domain or
the self-hosted runner to a specific instance by name. The closest candidates by role are
`hyperwolf-backend-apps-production` (34.236.60.155, described in the inventory itself as
"production, other backends (which ones: A2)") or `hyperwolf-main-backend-production-template`
(13.220.1.36) — neither is confirmed. This matches the inventory's own open item A2.

---

## 7. Blast radius

If kit build/dispatch, refill, or closure logic changes:

1. **`hyperwolf-super-admin`** breaks first and hardest — it is the *only* live caller (§2) of
   essentially every route in §1, and the only client of the `scanProduct` socket event (§3). Any
   response-shape change (field renamed/removed) needs a matching change in
   `redux/slices/hyperwolf/inventoryDistribution.js` (1497 lines, one file, ~120 call sites).
2. **hyperwolf-backend's own database** — `Fleets`, `Order`, `Products`, `ProductBatch`,
   `FleetOffDutyCloseout`, etc. (§4) are read directly out of conn3 with a hand-maintained,
   independently-drifting schema copy. Changing a kit/refill query shape here does not touch
   hyperwolf-backend's code, but changing what gets **written** — `ProductBatch.bulkWrite` (product
   sync) or `FleetOffDutyCloseout` (closure approval) — lands directly in a collection
   hyperwolf-backend and/or hyperdrive-backend also own. No contract test, no shared schema
   package, and no code in this repo would tell you if hyperwolf-backend's `Product`/`Closeout`
   code disagreed with the new write shape.
3. **hemp-backend's `Admin`/`ResetRequest`** collections back both the primary JWT auth (§4) and
   the PIN-login re-auth gate (§3) used by the verification screen — a change to `Admin`'s schema
   or role strings (`userRoles.includes("Super Admin")`, `driver-kit-verification-controller.js:5173`)
   breaks login/PIN-gate for this app without touching a line of hemp-backend code.
4. **Blaze** (§5) — kit dispatch/refill's actual side effect on the outside world is the
   create+accept transfer pair. Changing dispatch logic changes what physically moves in Blaze's
   own inventory ledger; per-batch isolation limits blast radius to the batches touched by a given
   run, not the whole distribution, but the daily rate-limit counter is process-global and shared
   with unrelated Blaze routes.
5. **No test suite exists** (`distribution-backend.md` §9) — any change to kit/refill/closure
   logic has zero automated regression coverage; verification is manual, through the same
   `hyperwolf-super-admin` UI that is the only caller.
6. **Reports** (`kit-refill/reports/download`, `manage-distributions/reports/download`,
   `driver-kit-verification` PDF endpoints) have no caller found in any of the twelve repos (§2) —
   changing their output format has no known blast radius inside this estate, but they are live,
   unauthenticated-in-one-case (`kit-refill/reports/download` — no `[admin]`, §1) endpoints that
   something outside the estate may still hit.
7. **The driver-facing surface is `hyperwolf-super-admin` itself** (§3) — there is no separate
   mobile client in the twelve repos to coordinate a breaking change with; the entire blast radius
   for the scan/PIN/dispatch flow is contained in this one estate, contingent on nothing outside it
   existing that the twelve-repo grep cannot see.
