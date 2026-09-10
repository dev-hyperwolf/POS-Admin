# Kit Build & Dispatch — logic-depth audit

Repo: `/Users/jt/hyper-tech/distribution-backend` (read-only clone). Builds on, and does not repeat,
`/Users/jt/POS-Admin/docs/codebase-audit/repos/distribution-backend.md` (§1,3,5,7) and
`distribution-backend.datamodel.md`. This document is the LOGIC underneath those survey findings.

---

## 1. The pipeline as code actually runs it

Mount points (`startup/routes.js:19-31`): `boxes`→`/api/v1/admin/boxes`, `region`→`/api/v1/admin/region`,
`template`→`/api/v1/admin/template`, `manage-distributions`→`/api/v1/admin/manage-distributions`,
`kit-refill`→`/api/v1/admin/kit-refill`, `driver-kit-verification`→`/api/v1/admin/driver-kit-verification`,
`blaze/distribution`→`/api/v1/blaze/distribution` (unauthenticated, `routes/blaze/blaze-syncing-routes.js`).
Every route below is `[admin]` (JWT, `middlewares/admin.js`) unless marked otherwise.

### Step 1 — Template setup (one-time/admin config)
1. `POST /template/add` → `middlewares` none besides `[admin]` → Joi `addKitTemplateValidation`
   (`models/KitTemplate.js:37-115`) → `kitTemplateController.addKitTemplate` (`controllers/kitTemplate/kit-template-controller.js`).
   Writes `KitTemplate` (unique compound index `{regionId:1, templateType:1}`, `models/KitTemplate.js:33` —
   only one `distribution` template and one `refill` template per region), plus child `KitBoxes` and
   `KitTemplateSku` documents (per-box min/max product-value rules and per-SKU min/max quantity rules).
2. `POST /region/add`, `POST /region/add/sub`, `PUT /region/update/sub/assign/driver/` — `Regions`/`SubRegions`/
   `RegionDriverAssign` CRUD (`controllers/region/region-controller.js`, `sub-region-controller.js`). This is
   the table the whole pipeline joins against to find "who drives this subregion."
3. `POST /boxes/add`, `PUT /boxes/update/:id` (`controllers/boxes/boxes-controller.js`) — `Boxes`/`boxProduct`.

### Step 2 — Build the daily distribution (`KitDistributed`)
4. `POST /manage-distributions/cron` (admin-JWT, despite the name — this is the manual/cron trigger,
   `routes/manageDistributions/manage-distributions-routes.js:6`) → `manageDistributionsController.kitDistributed`
   (`controllers/manageDistributions/manage-distributions-controller.js:175`, wrapped in `asyncMiddleware`)
   → `manageDistributionsRepository.kitDistributed()` (`repositories/manageDistributions.repository.js:45-1311`).
   Sequence inside (all against `conn1` unless noted):
   - `saveProductBatches()` (`:47`, cross-repo call into `controllers/common-controllers.js` — pulls Blaze
     product/batch data into `ProductBatch` on `conn1`/`conn3`).
   - Compute `distributedRegionIds` for today via an aggregate on `KitDistributed` (`:125-142`) — skipped
     entirely if `subRegionIds` was passed explicitly (`:124`).
   - Read `DistributionGlobalSettings.findOne()` **with no filter** (`:162`) for min/max quantity-per-product
     and min/max value-per-box defaults.
   - Read `KitTemplate` (`templateType:"distribution"`), `KitBoxes`, `KitTemplateSku` for the templates still
     needing today's distribution (`:179-197`).
   - Read `Product` to filter to active, in-stock products (`:210-232`), then `ProductBatch` to build a
     per-product FEFO batch map capped at `safeInventory` (`:234-316`).
   - Round-robin allocate 1 unit/subregion/round across boxes until stock or box/template limits are hit
     (`:702-824`, algorithm detail in §2), with rollback passes for per-product min (`:832-887`), per-box
     min value (`:890-958`), and per-template min product count (`:960-1015`).
   - `KitDistributed.insertMany(docsToSave, {ordered:false})` (`:1213`) — **only reached if zero templates
     failed the min-product check** (`:1020-1027`, see §5 finding B).
   - `DistributedProductLogs.deleteMany()` then `.insertMany(...)` (`:1296-1297`, unconditional collection wipe).
5. `GET /manage-distributions/list` / `/detail` — read-only views over `KitDistributed`.
6. `POST /manage-distributions/freeze` → `manageDistributionsRepository.freezeDistribution` (`:1318-1367`) —
   re-syncs `regionData[].driverId`/`backupRegionData[].driverId` against current `RegionDriverAssign`, and
   **only if a driver actually changed** sets `dist.status = 'freeze'` (`:1358-1364`).

### Step 3 — Daily refill (`KitRefill` + `KitDistributed.regionData[].items[].refillLogs[]`)
7. `POST /kit-refill/cron` → `kitRefillController.dailyRefillKit` (`controllers/kitRefill/kit-refill-controller.js:851-2630`,
   `asyncMiddleware`). Sequence: dedup-guard via `ActivityLog` on `action:"DAILY_REFILL"` + `details.refillDay`
   (`:903-941`, day key computed with a hardcoded +5.5h offset, §5 finding C) → `cleanupOrphanDailyRefillLogs`
   (`:865`) → `saveProductBatches()` (`:870`) → `syncSoldQty({preserveExistingUsedQty:true})` (`:874-877`, pulls
   Blaze sold-qty into `item.usedQty`) → `getNextRefillDistributionType()` (`:952`) → `loadDistributedRecordsForRefill`
   (`:956`, reads today's `KitDistributed` regions) → **Pass A** (sold-qty-driven refill, `getRefillNeededQty` =
   `min(soldQty, capQty)`, `:990-1046`, FEFO-allocates from `ProductBatch` the same way as step 4) → **Pass B**
   (`newProductDistributionCore`, adds new products to boxes that have a `refill`-type `KitTemplate`, creates
   fresh `KitDistributed` docs at `status:"freeze"` directly, `:1943-1960`). Writes: `KitDistributed` (embedded
   `refillLogs[]` via positional/`arrayFilters` updates), `KitRefill` (summary row per `refillId`, via
   `recordKitRefillUpdate`, `:745-799`), `ActivityLog`, `DistributionRefillLogs`.

### Step 4 — Dispatch to driver
8. `POST /driver-kit-verification/dispatch` → `driverKitVerificationController.driverKitDispatch`
   (`controllers/driverKitVerification/driver-kit-verification-controller.js:2211-2491`, plain
   `async (req,res)`, not `asyncMiddleware`). Reads `KitDistributed` matching `driverId`/`regionId`/
   `subRegionId`/`distributionId` (`:2224-2239`, tries main distribution first, then falls back to matching a
   `refillLogs[].refillId`, setting `isRefill=true`). Calls into `blaze-syncing-controller.js`'s
   `bulkInventoryTransferSubRegionWise`/`bulkInventoryTransferSubRegionWiseScan`/`transferInventoryBySubRegionRefill`
   **via a hand-rolled `mockRes` shim** (`:2280-2293`) so those Express-shaped handlers can be called as
   functions — see §5 finding F for the bug this introduces. On success: `KitDistributed.updateMany`/
   `findOneAndUpdate` sets `regionData[].status="dispatched"` and, once every region on the doc is dispatched,
   top-level `status="distributed"` (`:2311-2434`); `recordKitDispatches()` (`:2163-2209`) **deletes every
   `KitDispatch` row for that `subRegionId`** (`:2175`, no dispatchType/distributionId/driver filter) then
   upserts the new one(s) — see §5 finding G.
9. `POST /driver-kit-verification/scan/items` → `driverKitVerificationController.scanItems` → delegates to
   `services/scanItems.service.js` (the actual scan-reconciliation engine — not traced line-by-line here,
   scope is kit build/dispatch, but it is the thing that finally populates `productBatchesBlaze[]`, see §5-E).
10. `GET /driver-kit-verification/onHold`, `POST /discrepancy` — pause/resume and discrepancy creation
    (`:4773-4970`, `:3241`), writes `Discrepancy` and mutates `region.status`/`refillLogs[].status`.

Validation is inline Joi on the *template* and *box* create/update routes only (`models/KitTemplate.js`,
`models/Boxes.js`); `manage-distributions-routes.js`, `kit-refill-routes.js`, and
`driver-kit-verification-routes.js` have **zero Joi** anywhere — every controller in the build/refill/dispatch
chain reads `req.body`/`req.query` directly with ad-hoc `if (!x) return res.status(400)` checks (e.g.
`driverKitDispatch:2215-2220`). Responses are ad-hoc JSON (`{success, message, ...}` on most; `{message}` only
via `asyncMiddleware`'s catch) — no shared response envelope.

## 2. The algorithm

**Distribution (kit build).** For each `KitTemplate`, for each `KitBoxes` row under it, build one
`KitDistributed` doc per box per driver-assigned subregion (`repositories/manageDistributions.repository.js:605-657`).
Per-product min/max come from `KitTemplateSku` rows merged with `DistributionGlobalSettings` fallbacks
(`buildRulesForBox`, `:480-501`). Allocation is **round-robin, 1 unit per subregion per pass**
(`qtyToGive = Math.min(1, productRemainingCapacity, region.maxCapRemaining, fefoNode.total)`, `:770-775`),
repeated until no pass makes progress (`while(progress)`, `:702-824`). A product is only *eligible* for a
pass at all if `fefoNode.total >= totalSubregions` (`:722`, `:745`) — **a product with less total stock than
the number of subregions being served is never distributed at all**, not even partially, to the subregions
that could have received it. Batches are picked FEFO (earliest `expirationDate` first,
`node.batches.sort(...)`, `:277-281`, consumed via `takeFromBatchesMutating`, `:321-347`). After allocation,
three rollback passes can *undo* what was just given: per-product min not met in a subregion → remove that
item and restore its batches to the FEFO pool (`restoreItemToFolder... restoreItemToFefo`, `:849`); per-box
min value not met in a subregion → clear that entire region's items (`:912-950`); per-template min distinct
product count not met → **clear every region in every box under that template** (`:968-999`) and mark the
whole template `failedTemplates` (`:1007-1011`). Unit costs are then re-averaged per product across every
region that received it (`:1158-1199`, weighted by `assignedQty`).

**Refill.** Two passes, both quantity-capped by what was originally distributed (§1 step 7): Pass A refills
existing items up to `min(soldQtySinceLastRefill, previousRefillOrDistributedQty)` (`getRefillNeededQty`,
`kit-refill-controller.js:1038-1046`) using a fresh FEFO map built the same way as the build step
(`:1105-1139`, explicitly commented "kitDistributed parity" at `:1111`). Pass B (`newProductDistributionCore`)
adds brand-new products to boxes governed by a `templateType:"refill"` `KitTemplate`.

**Dispatch confirmation.** Not itself an allocation algorithm — it is a status flip (§1 step 8) gated on the
Blaze inventory-transfer call succeeding. No substitution logic exists anywhere in the dispatch path; a
transfer failure is not retried, only (attempted to be) reported back to the caller (see §5-F for why that
reporting is broken).

## 3. State

| Model.field | Enum values | Set by | Read by |
|---|---|---|---|
| `KitDistributed.status` | `splitting` (default), `freeze`, `distributed` | `splitting`: doc creation (`manageDistributions.repository.js:640`, `:3485`, `:3568`). `freeze`: `freezeDistribution()` **only if a driver assignment changed** (`:1358-1364`); also set directly at creation by Pass-B new-product docs (`kit-refill-controller.js:1957`). `distributed`: `driverKitDispatch` once every region is dispatched (`driver-kit-verification-controller.js:2347-2352`, `:2428-2432`). | `kitTemplate-controller.js:80`, `sub-region-controller.js:128` (`{$in:["splitting","freeze"]}` — active-distribution filter); **`blaze-syncing-controller.js:597`, `:1177`** (`createRefillTransfers`/`createBulkInventoryTransfer` — the two Blaze bulk-transfer builders — only ever query `status:'freeze'`); `manageDistributions.repository.js:2077`. |
| `KitDistributed.verificationStatus` | `pending` (default), `completed` | Not found being set to `completed` anywhere in `driverKitVerification`/`kitRefill`/`manageDistributions` controllers (`grep -n "verificationStatus" controllers/ repositories/` — only reads and the schema default). **Dead-end transition**: declared, defaulted, filtered on nowhere found, never advanced. |
| `regionData[].status` | `pending` (default), `dispatched`, `hold`, `paused` | `pending`→`dispatched`: `driverKitDispatch` (`:2406`, `:2321` for refill). `hold`/`paused`: `onHoldVerification`/`onHoldNewVerification` (`:4773-4970`, `:5264+`). Back to `pending`: `onHoldVerification` status `"pending"` or `"resumed"` (`:4949` — `"resumed"` is a controller-only input alias that maps to `pending`, it is never itself persisted, so it does **not** violate the schema enum at `models/KitDistributed.js:25,141` despite not being in that enum). |
| `refillLogs[].status` | `packed` (default), `verifying`, `verified`, `dispatched`, `hold`, `paused`, `pending` | `dispatched` via `driverKitDispatch` refill branch (`:2320`). `verifying`/`verified` set inside `services/scanItems.service.js` (scan flow, out of this doc's scope). `packed` is the schema default — not found being explicitly (re)set anywhere, i.e. it is only ever the as-created value. |
| `KitDispatch.status` | `dispatched` (default), `cancelled` | `dispatched` via `recordKitDispatches` (`driver-kit-verification-controller.js:2199`). **`cancelled` is declared in the schema (`models/KitDispatch.js`) but no write to it was found anywhere in the repo** (`grep -rn '"cancelled"' controllers/ repositories/` → zero hits) — dead enum value, there is no dispatch-cancellation feature despite the model being built for one. |
| `Discrepancy.status` | `open` (default), `pending`, `pendingApproval`, `resolved`, `rejected` | Set in `discrepancyManagement/discrepancy-management-controller.js` (not traced line-by-line; out of kit-build/dispatch core scope) and by `onHoldVerification`'s discrepancy-creation branch (`:4954+`). |

## 4. Time and scheduling

`startup/nodeCrons.js` (43 lines) defines exactly the 4 jobs the survey report names, all block-commented:
- `cron.schedule('*/30 * * * * *', ...)` (`:7-14`) would call `kitDistributed` (imported from the
  *controller*, `manage-distributions-controller.js`) every 30s. **If simply un-commented as written, every
  invocation throws before doing anything**: `kitDistributed` is `asyncMiddleware(async (req,res)=>{...})`
  (`manage-distributions-controller.js:175`) whose first line is `extractSubRegionIdsFromRequest(req)`
  (`:177`), which dereferences `req.body` (`:20-24`); called as `kitDistributed()` with no arguments
  (exactly what the commented code does, `:9`), `req` is `undefined` → `TypeError: Cannot read properties of
  undefined (reading 'body')`. `asyncMiddleware`'s own catch then tries `res.status(400).send(...)`
  (`middlewares/async.js:22-25`) with `res` **also** undefined, throwing a second error that escapes to the
  cron's own `try/catch` (`nodeCrons.js:11-13`), which just logs it. Net effect if re-enabled: fires every
  30s, does nothing, logs an error every time.
- `cron.schedule('*/10 * * * * *', ...)` (`:16-23`) → `dailyRefillKit`, same problem
  (`kit-refill-controller.js:851`, `asyncMiddleware`, reads `req` immediately at `:861`).
- `cron.schedule('*/10 * * * *', ...)` (`:25-32`) → `saveProductBatches` — this one *is* a plain function
  (`controllers/common-controllers.js`), not Express-shaped, so it would actually run if enabled.
- `cron.schedule('* * * * *', ...)` (`:35-42`) → `syncSoldQty` — also plain, would run if enabled.

**Whatever currently triggers `kitDistributed`/`dailyRefillKit` in production must be calling the HTTP routes
directly** (external scheduler hitting `POST .../cron` with a valid admin JWT) — the in-process cron path is
not just disabled, it is not fixed to work even if someone flips the comment back on.

**Date/timezone handling**: `moment` is used for day boundaries in the main build (`moment().startOf("day")`,
`manageDistributions.repository.js:48-49` — server-local timezone, whatever that is on the deploy host).
`dailyRefillKit`'s dedup/day-key logic instead hand-rolls a boundary with a **hardcoded `+5.5h` (IST) offset**
(`kit-refill-controller.js:856-859`, repeated identically at `:1511`, `:2634`, `:4941`; the field it feeds,
`models/KitDistributed.js:283`, is explicitly commented `refillDay: Number, // todayKey (IST start of day)` —
this is a deliberate choice, not a typo). Two different day-boundary conventions (`moment().startOf("day")`
server-local vs. hardcoded IST) coexist across the build step and the refill step of the *same* pipeline. See
§5 finding C for the consequence.

**Assumes a prior run happened**: `getRefillCapQty` (`kit-refill-controller.js:1026-1035`) caps a refill at
"whatever the previous refill gave, or if there was none, whatever the original distribution gave" — if the
distribution step never actually ran for a subregion (e.g. blocked by finding B/D below), Pass A silently
finds `getDistributedQty(item)` = 0 for everything and refills nothing, with no distinct error message
differentiating "nothing to refill" from "distribution never happened."

## 5. Why it may not work today

**A. `DistributionGlobalSettings.findOne()` ignores the `platform` field and has no null guard**
(`manageDistributions.repository.js:162-166`). The model has a `platform` enum (`hyperwolf`/`stilo`,
`models/DistributionGlobalSettings.js:15`) and the *admin-facing read* endpoint filters by it
(`controllers/distribution/distribution-controller.js:85`, `findOne({platform: req.query.platform})`) — but
the kit-build step's own read does not. If both platforms have configured their own settings document (two
rows in the collection, which the schema explicitly supports), `kitDistributed()` applies **whichever one
Mongo happens to return first** to every template regardless of platform, silently using the wrong
min/max-per-box and min/max-per-product caps for one platform's kits. If the collection is empty (fresh
environment, or the one document was ever deleted), `globalSetting` is `null` and `Number(globalSetting.maxQuantityPerProduct)`
throws immediately — **symptom**: `POST /manage-distributions/cron` returns HTTP 400 with a raw
`"Cannot read properties of null (reading 'maxQuantityPerProduct')"` message (via `asyncMiddleware`'s generic
catch), and nothing about the error points at "you need to configure Distribution Global Settings."

**B. `KitDistributed` is built at `status:"splitting"`; the Blaze bulk-transfer builders only look at
`status:"freeze"`; the only path to `"freeze"` is conditional and easy to never satisfy.** Build:
`manageDistributions.repository.js:640`. The two functions that actually create Blaze inventory transfers for
a distribution — `createRefillTransfers` (`blaze-syncing-controller.js:587`) and `createBulkInventoryTransfer`
(`:1168`, mounted **unauthenticated** at `POST /api/v1/blaze/distribution/inventory`, confirmed in the survey
report §14 #3) — both start with `KitDistributed.find({status:'freeze'})` (`:597`, `:1177`). The only writer of
`status:'freeze'` for a main-flow doc is `freezeDistribution()` (`:1318-1367`), and it sets it **only if a
`RegionDriverAssign` lookup found a driver different from what was already on the doc** (`updated ||
backupUpdated`, `:1362-1364`) — the common case (driver assignments already correct, nothing to "freeze") never
flips the flag, so the doc stays in `"splitting"` forever. **Symptom**: admin calls
`POST /manage-distributions/freeze`, gets a 200, and the distribution still doesn't show up when the Blaze
sync endpoints are triggered — no error anywhere, `distributionDataArray` is just an empty array
(`blaze-syncing-controller.js:598`) and the function reports "0 distributions processed."

**C. Daily-refill's "already ran today" dedup key is computed in IST, not the operating region's local
time** (`kit-refill-controller.js:856-859`, `ActivityLog` check at `:903-941`). For a US-timezone business,
IST midnight falls mid-afternoon US time (the offset between IST and any US zone is 12.5-13.5h, not a clean
day boundary). Two `POST /kit-refill/cron` calls made on the same US business day, on either side of that
IST-midnight crossing, compute **different** `todayKey` values and neither sees the other in `ActivityLog` —
the dedup guard (`:929-941`, `:903-925`) does not fire, and the same subregion can be refilled twice in one
US day (double-consuming `usedQty` capacity, double-writing `refillLogs`). Conversely, a run just before and
just after US local midnight can land in the *same* IST day and get incorrectly blocked as "already
completed today." **Symptom**: intermittent duplicate refill records or a refill that silently no-ops with
"Kit refill has already been completed for today" (`:936`) at a time when, locally, it plainly has not.

**D. One failing template can discard a successful run for every other template in the same invocation.**
`manageDistributions.repository.js` loops all templates (`:686-1018`), only checking `failedTemplates.length`
**after** the loop closes (`:1020-1027`) and only calling `KitDistributed.insertMany` after that check
(`:1213`). If template #3 out of 5 fails its min-product-per-region gate, the function returns
`{success:false, error:"MIN_PRODUCT_PER_REGION_NOT_MET"}` and **nothing is saved for templates #1, #2, #4, #5
either**, even though their `docs` were fully built and valid. **Symptom**: "the whole day's kit distribution
didn't happen" when in fact only one region/template had a stock problem.

**E. `productBatchesBlaze[]` is never populated at kit-build time — the push is commented out.**
`mergeIntoRegion`'s blaze-batch branch builds a `blazeBatch` object but never adds it to the array
(`manageDistributions.repository.js:441-455`, the commented line still carries a `// item.productBatchesBlaze.push(blazeBatch)`
next to a `// 🔥 ADD THIS` marker on the array's own initializer three lines above at `:405`). Every freshly
built `KitDistributed.regionData[].items[].productBatchesBlaze` is `[]` until `services/scanItems.service.js`
populates it during a scan. Anything that reads `productBatchesBlaze` before a scan happens —
`blaze-syncing-controller.js:1025`, `:1245`, `:1551-1554`, `:3254` — sees an empty array and treats the item as
having nothing to transfer to Blaze.

**F. `driverKitDispatch` can send two responses on a Blaze-transfer failure, and never records the failed
attempt.** It calls the Blaze transfer controllers through a hand-rolled `mockRes` shim
(`driver-kit-verification-controller.js:2280-2293`) so it can invoke them as plain functions. On failure those
controllers do `return res.status(400).json({error:...})` (e.g. `blaze-syncing-controller.js:1738-1740`), which
the shim forwards to the *real* `res` (`:2289`) — but that `return` only exits the shim's inner `json`
callback, not `driverKitDispatch` itself. Execution continues, the outer `if (transferResponse === undefined
|| transferResponse?.success)` guard is false (correctly skips the dispatch-status update), but control then
falls through to the unconditional `return res.status(200).json({success:true, ...})` at the bottom of the
function (`:2465-2481`) — a second write to a response whose headers are already sent. **Symptom**: Express
logs `ERR_HTTP_HEADERS_SENT`/a silently-swallowed second response on a Blaze failure, the client either gets
the original error or a confusing partial success depending on timing, and `recordKitDispatches` is never
reached, so `KitDispatch` has no record the attempt happened or failed.

**G. `recordKitDispatches` deletes the entire dispatch history for a subregion before writing the new
one.** `KitDispatch.deleteMany({subRegionId})` (`:2175`) has no `dispatchType`/`distributionId`/`driverId`
filter — every prior main-and-refill dispatch row for that subregion, from any past distribution, is deleted
on every new dispatch call. This defeats the model's own partial-unique indexes (survey report §5, "one of
the few models with well-designed indexes") since there is never a chance to collide with history that keeps
getting wiped, and destroys the audit trail `KitDispatch` exists to provide.

**H. Round-robin eligibility drops low-stock products entirely rather than partially serving them**
(`manageDistributions.repository.js:722`, `:745`, `fefoNode.total < totalSubregions → continue`) — see §2.
This is plausibly intentional (fairness), but is indistinguishable in the UI from a bug: a product with, say,
4 units and 6 subregions simply never appears in any kit that day, with no dedicated low-stock message beyond
whatever `globalLowStockItems` back-fills afterward (`:1063-1119`).

**Other contributing factors (already covered in the survey report, reconfirmed here in the kit path
specifically):** all 12+ routes across `manage-distributions-routes.js`/`kit-refill-routes.js`/
`driver-kit-verification-routes.js` are `[admin]`-gated with **zero Joi validation**, so a malformed
`driverId`/`regionId` reaches Mongoose queries as free-form strings; `partnerAuth` (survey §14 #2) provides no
protection on any of these routes; `bulkInventoryTransferSubRegionWise`/`createBulkInventoryTransfer` are
directly reachable without auth (survey §14 #3) — meaning an unauthenticated caller can trigger a Blaze
transfer for a `subRegionId`/`distributionId` they supply; no lock of any kind (`LockService` equivalent)
guards `kitDistributed()`, `dailyRefillKit()`, or `driverKitDispatch()` against concurrent invocation for the
same region — two admins (or an admin and a stale retry) clicking "distribute"/"refill"/"dispatch" at the same
moment race on the same `KitDistributed` documents with plain `find`→mutate→`save()`/`updateMany` (e.g.
`freezeDistribution`'s `find()` then per-doc `.save()`, `:1319-1366`; `onHoldVerification`'s `updateRegionStatus`,
`:4809-4849`).

## 6. Change surface

| Function | File:lines | Size | Called by |
|---|---|---|---|
| `kitDistributed()` | `repositories/manageDistributions.repository.js:45-1311` | ~1,267 lines | `manage-distributions-controller.js:175` (`POST /manage-distributions/cron`) |
| `dailyRefillKit` | `controllers/kitRefill/kit-refill-controller.js:851-2630` | ~1,780 lines | `POST /kit-refill/cron` |
| `newProductDistributionCore` (Pass B) | `controllers/kitRefill/kit-refill-controller.js:~1495-2628` | ~1,130 lines | called from inside `dailyRefillKit`; also standalone via `POST /kit-refill.../newProductDistribution`-style route not separately mounted (only reachable through `dailyRefillKit`'s fallback and `exports.newProductDistribution`, `:2630`) |
| `driverKitDispatch` | `controllers/driverKitVerification/driver-kit-verification-controller.js:2211-2491` | ~280 lines | `POST /driver-kit-verification/dispatch` |
| `recordKitDispatches` | `controllers/driverKitVerification/driver-kit-verification-controller.js:2163-2209` | 47 lines | `driverKitDispatch` (both branches) |
| `freezeDistribution()` | `repositories/manageDistributions.repository.js:1318-1367` | 50 lines | `manage-distributions-controller.js` → `POST /manage-distributions/freeze` |
| `bulkInventoryTransferSubRegionWise` / `createBulkInventoryTransfer` / `createRefillTransfers` | `controllers/blaze/blaze-syncing-controller.js:1695`, `:1168`, `:587` | ~800 / ~290 / ~370 lines | `driverKitDispatch` (via `mockRes` shim) and directly via unauthenticated Blaze routes |
| `onHoldVerification` | `controllers/driverKitVerification/driver-kit-verification-controller.js:4773-4970` | ~200 lines | `GET /driver-kit-verification/onHold` |
| `distributeProductMinMax`, `allocateFromBatches`, `adjustBoxTotalsForRegion`, `fefoSelectMutating`, `allocateFromBatchesFEFO` | `utils/utils.js:33-289` | small helpers | `distributeProductMinMax` and `allocateFromBatches` are **imported nowhere** (`grep -rn "distributeProductMinMax(\|allocateFromBatches(" controllers/ repositories/` → zero call sites outside their own file) — dead helpers sitting next to the ones actually used (`fefoSelectMutating`/`allocateFromBatchesFEFO` are also unused by name — the build step re-implements its own inline FEFO logic, `manageDistributions.repository.js:321-347`, `:391-465`, rather than calling these shared utils). `fefoSelect` is destructured from `utils/utils.js` at `manageDistributions.repository.js:13` but **no such export exists** in `utils/utils.js` — it silently resolves to `undefined` and is never called, so it doesn't throw, but it is dead/misleading code.

**Tests**: none. `find . -iname "*.test.js" -o -iname "*spec.js"` in this repo returns nothing (confirmed,
matches survey report §9); a team modifying any function above has no regression harness and would be
changing 1,000+-line functions by hand-tracing console.log output.

## 7. Questions for the team

1. Is `POST /manage-distributions/freeze` supposed to be a required step between building and dispatching a
   distribution, or is it a leftover from an earlier driver-reassignment feature that happened to also flip a
   status flag? Right now it is the *only* way a main-flow `KitDistributed` doc ever reaches `status:"freeze"`,
   and that status is the sole gate the two Blaze bulk-transfer builders check (finding B). If freeze isn't
   meant to be load-bearing here, what should gate those two functions instead?
2. Was the `+5.5h` (IST) day-boundary offset in `dailyRefillKit` (finding C) a deliberate choice for some
   reason not visible in this repo (e.g. the ops team running these crons is in India), or is it simply wrong
   for a US-timezone delivery business? The `KitDistributed.refillDay` field comment explicitly documents it
   as intentional (`models/KitDistributed.js:283`), which argues against a typo, but nothing else in the repo
   explains why.
3. Is the all-or-nothing template rollback in `kitDistributed()` (finding D) intended behavior ("don't
   half-distribute the day"), or should a failing template be skippable without blocking the templates that
   passed? This can't be answered from the code — it reads like an oversight (the check is positioned after
   the full loop rather than per-template) but could be a deliberate business rule.
4. Is there a reason `productBatchesBlaze[]` isn't populated at build time (finding E) — e.g. is Blaze sync
   *meant* to only ever happen after a scan, making the pre-scan empty array correct — or is the commented-out
   push simply an unfinished change?
5. What actually calls `POST /manage-distributions/cron` and `POST /kit-refill/cron` in production today,
   since the in-process cron is disabled and, per §4, would not work if re-enabled as-is? Confirming this
   (external scheduler vs. manual clicks) determines whether finding H (the cron re-enable trap) is even
   relevant, or whether the real fix is wiring up whatever calls these routes today to call them correctly
   instead.
6. Is `KitDispatch.status:"cancelled"` a feature that's planned but not yet built, or dead schema left over
   from a removed feature? Nothing in the current dispatch flow can produce it.
7. Should `DistributionGlobalSettings` be looked up per-platform inside `kitDistributed()` (finding A), and
   is there in fact more than one settings document in the live database today (i.e. is this bug currently
   live, or does only one platform have a configured document so it happens not to matter yet)? That can only
   be checked against the live database, not this repo.
