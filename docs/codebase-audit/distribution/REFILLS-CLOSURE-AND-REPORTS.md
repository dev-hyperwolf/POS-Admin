# distribution-backend — Refills, Closure, Aging/Waste, and Reports (logic deep-dive)

Repo: `/Users/jt/hyper-tech/distribution-backend` pinned at `aaa6ecb79ccea079f14505f4bbc5a7ffa666cfde` (same SHA as `distribution-backend.md`, working tree clean). This document extends `distribution-backend.md` (§1,3,5,7,9) and `distribution-backend.datamodel.md` — read those first; this file does not repeat the survey, only the logic in the four areas the owner's team flagged as broken.

---

## 1. Refills — `controllers/kitRefill/kit-refill-controller.js` (5,479 lines, not ~4,000)

### 1.1 Exported function map

| Function | Lines | Route | Reads | Writes |
|---|---|---|---|---|
| `dailyRefillKit` | 851–1497 (~647) | `POST /api/v1/admin/kit-refill/cron` `[admin]` | `RegionDriverAssign`, `ActivityLog`, `KitDistributed`, `ProductBatch` | `KitDistributed` (bulkWrite), `ActivityLog` (insertMany), indirectly `KitRefill`/`ProductBatch` via helpers below |
| `newProductDistribution` | 2630–2711 (~81) | **none — dead route**, see §1.2 | same as `newProductDistributionCore` | same |
| `listRefillLogs` | 2712–2977 (~265) | `GET /list` | `ActivityLog`, `KitDistributed`, `Fleets`, `Regions`/`SubRegions`, `Product` | — |
| `listKitRefillAuditLogs` | 2978–3116 (~138) | `GET /logs` | `KitRefill` | — |
| `getKitRefillAuditLog` | 3117–3168 (~51) | `GET /logs/:refillId` | `KitRefill` | — |
| `getRegions` | 3169–3642 (~473) | `GET /get/regions` | `Regions`, `SubRegions`, `RegionDriverAssign`, `KitDistributed` | — |
| `getProducts` | 3643–3911 (~268) | `GET /get/products` | `Product`, `Category`, `ProductBatch` | — |
| `deleteRefillLog` | 3912–3967 (~55) | `DELETE /delete/:refillId` | `KitDistributed` | calls `undoRefillOnKitDistributed` (below) |
| `useDistributedProductQty` | 3968–4095 (~127) | `GET /use/qty` | `KitDistributed.find({})` — **whole collection**, §5 | `KitDistributed` (bulkWrite) |
| `getRefillLowStockProduct` | 4096–4293 (~197) | `GET /low/stock` | `KitDistributed` | — |
| `boxPdfDownload` | 4294–4487 (~193) | `GET /box/pdf` `[admin]` | `KitDistributed`, `Boxes`, `Product`, `SubRegions`, `Regions` | Puppeteer PDF → S3 |
| `deleteRefillProduct` | 4488–4607 (~119) | `POST /delete/product` | `KitDistributed` | `KitDistributed` |
| `boxRegionPdfDownload` | 4608–4767 (~159) | `GET /region/pdf` `[admin]` | same shape as `boxPdfDownload` | Puppeteer PDF → S3 |
| `downloadReport` | 4768–4780 (~12) | `GET /reports/download` **— no `[admin]`, unauthenticated** | S3 `getObject` | streams PDF back |
| `bulkRefillProductDelete` | 4781–4914 (~133) | `POST /bulk/delete` | `KitDistributed` | `KitDistributed` |
| `bulkRefillProductAdd` | 4915–5374 (~459) | `POST /bulk/add/product` | `KitDistributed`, `Product`, `ProductBatch` | `KitDistributed` |
| `getRefillBoxesUnassignedProducts` | 5375–5478 (~103) | `POST /box/products` | `KitBoxes`, `Product` | — |

Internal (not exported, called only from inside this file): `loadDistributedRecordsForRefill` (109), `getRefillTemplateCoverage` (166), `undoRefillOnKitDistributed` (310), `cleanupOrphanDailyRefillLogs` (378), `getNextRefillDistributionType` (459), `resolveActorId` (497), `getRefillTotalQty` (528), `getRefillDistributionType`/`Map` (573/585), `recordKitRefillUpdate` (745), `recordKitRefillDelete` (799), `newProductDistributionCore` (1498–2629, ~1,131 lines — the single largest function in the repo).

### 1.2 Dead route: `newProductDistribution` is unreachable

`exports.newProductDistribution` (line 2630) is never mounted — `routes/kitRefill/kit-refill-routes.js` has no route for it, and no other route file references it (`grep -rn "newProductDistribution" routes/` → zero hits). It is only ever invoked as `newProductDistributionCore(...)` from inside `dailyRefillKit` (kit-refill-controller.js:1069, :1439). If a frontend or another team believes there is a manual "run new-product distribution" button that calls this endpoint, it does not exist — the only way Pass B runs today is as the second half of `dailyRefillKit`.

### 1.3 The refill algorithm (Pass A — "used-qty replenish")

`dailyRefillKit` runs two passes. **Pass A** (851–1420ish) replenishes what was already assigned to a driver, based on what Blaze says has sold since the last refill:

1. `cleanupOrphanDailyRefillLogs(todayKey, ...)` self-heals refill logs whose `ActivityLog` audit row is missing (kit-refill-controller.js:317–378).
2. `saveProductBatches()` (common-controllers.js:643) refreshes `ProductBatch.batchData`/`safeInventory` from Blaze, per-product, concurrency 15 (common-controllers.js:673–811). **Return value is discarded** — `await saveProductBatches();` (kit-refill-controller.js:870) ignores `updatedCount`/`failedCount`/`failedProducts`.
3. `syncSoldQty({ subRegionIds, preserveExistingUsedQty: true })` (common-controllers.js:849) recomputes `item.usedQty` from matched Blaze transactions.
4. Idempotency: a `todayKey` is computed and an `ActivityLog` with `action:"DAILY_REFILL"` and matching `details.refillDay` blocks a second run for the same day (kit-refill-controller.js:922–933, per-subregion variant at 899–917).
5. Need is computed per item:
   ```js
   const getRefillCapQty = (item) => { /* latest refillLog.refillQty, else distributed qty */ };
   const getRefillNeededQty = (item) => {
       const soldQty = getEffectiveUsedQty(item);
       if (soldQty <= 0) return 0;
       const capQty = getRefillCapQty(item);
       if (capQty <= 0) return 0;
       return Math.min(soldQty, capQty);           // kit-refill-controller.js:1049-1055
   };
   ```
   i.e. refill quantity = **min(sold-since-last-refill, what was distributed/last-refilled)** — a driver can never be refilled *more* than what they were originally given, even if they sold more (excess sales are logged but capped, kit-refill-controller.js:1216–1219 `console.log("[cap] ...")`).
6. `ProductBatch` docs for products needing refill are loaded (`ProductBatch.find({ productId: { $in: [...] } }, { productId:1, batchData:1, safeInventory:1 })`, kit-refill-controller.js:1100), then a FEFO (first-expired-first-out) map is built **capped to `safeInventory`**:
   ```js
   // No safeInventory → product unavailable for distribution (kitDistributed parity)
   if (safeInventory <= 0) { fefoMap.set(pid, node); continue; }   // kit-refill-controller.js:1112-1115
   ```
   Batches are sorted by `expirationDate` ascending and truncated so total distributable qty never exceeds `safeInventory` (1141–1157).
7. Allocation loop (1256–1350): needs are sorted **smallest-need-first** (`compareRefillNeedOrder`, stable) so "the same limited stock always prefers the same subregions/boxes on delete → re-run" (comment at kit-refill-controller.js:1244). Stock-outs and partial fills are recorded into `refillLowStockItems`/`backupLowStockItems` with a `reason` (`no_stock`/`insufficient_stock`/`partial_stock`/`no_picks`).
8. Writes are `KitDistributed.bulkWrite(bulkKitOps, { ordered: true })` (1379) using `arrayFilters` to target `regionData.$[r].items.$[i].refillLogs` — a positional, targeted write (good pattern, unlike §1.5 below).
9. **Pass B** (`newProductDistributionCore`) always runs after Pass A, even if Pass A found nothing to refill (kit-refill-controller.js:1063–1097 for the early-exit branch, 1424–1454 for the normal path) — it adds SKU-template products not yet in the kit, gated by `DistributionGlobalSettings` (`maxQuantityPerProduct`/`minQuantityPerProduct`/`maxProductPerBox`/`minProductPerBox`, falling back to hardcoded `10`/`1`/`100`/`10` if unset — kit-refill-controller.js:1583–1586).

### 1.4 Per driver or per region?

Per **subregion + driver** pair: the unit of allocation is `regionData[]` (one entry per `regionId`/`subRegionId`/`driverId` on a `KitDistributed` doc, per the datamodel). `dailyRefillKit` can be scoped to specific subregions via `subRegionIds` in the request body/query (`extractSubRegionIdsFromRequest`, kit-refill-controller.js:53); with no scope it processes **every** distribution at the latest `weekStartDate` (`loadDistributedRecordsForRefill`, 109–134). Refill eligibility for Pass B is further gated per-subregion by whether that subregion has a `templateType:"refill"` `KitTemplate` (`getRefillTemplateCoverage`, 166–309) — subregions without one are silently skipped and only ever surface in `skippedSubRegionIds` in the JSON response, not as an error.

### 1.5 Timezone/day-boundary bug — four independent copies, wrong offset

`utils/utils.js:213` exports a real `startOfDayMs(ms)` that uses `new Date(ms).setHours(0,0,0,0)` (server-local timezone). `kit-refill-controller.js:9` imports it — **but then shadows it with a local re-declaration in four separate places**, each hardcoding a **+5.5 hour (India Standard Time) offset**, not any US timezone:

```js
const startOfDayMs = (ts) => {
    const offset = 5.5 * 60 * 60 * 1000;
    return Math.floor((ts + offset) / 86400000) * 86400000 - offset;
};
```
— kit-refill-controller.js:855–858 (`dailyRefillKit`), 1510–1513 (`newProductDistributionCore`), 2633–2636 (`newProductDistribution`), 4940–4943 (`bulkRefillProductAdd`). The imported `startOfDayMs` from `utils/utils.js` becomes a dead import in this file. Meanwhile `controllers/closureOverview/closure-overview-controller.js` computes its own day boundaries with plain `new Date(date).setHours(0,0,0,0)` — **server-local time, no offset at all** (lines 453–454, 731–734, 1043–1048, 1380–1385, 1553–1558, 1789–1794). Two files computing "today" with two different, mutually inconsistent rules is a direct explanation for symptoms like "the refill ran but says already done for today" or "the closure list shows yesterday's distribution under today." See §6 for the concrete failure story.

### 1.6 `getNextRefillDistributionType` — full-collection `$unwind` on every refill run

`kit-refill-controller.js:459–489` computes the next `R-00X` sequence by running a **triple `$unwind`** aggregate over `KitDistributed.regionData → items → refillLogs` on the entire collection, plus an `ActivityLog.distinct`, every single time `dailyRefillKit` or `newProductDistributionCore` needs a fresh distribution type (i.e. on every unscoped refill run). No index supports any of the three unwound array paths. This gets more expensive every week and is a second, independent scaling problem beyond the four `.find({})` calls in §5 — worse, because it runs on the **write** path, not just list endpoints. It is also **not atomic**: two concurrent refill triggers can read the same `maxNum` and mint the same `R-00X` distributionType (no lock — confirmed absent repo-wide per `distribution-backend.md` §7).

---

## 2. Closure / end of day — `controllers/closureOverview/closure-overview-controller.js` (1,887 lines)

Route prefix `/api/v1/admin/closure-overview`, all `[admin]`-protected.

| Function | Lines | Route |
|---|---|---|
| `getData` | 21–431 | `GET /list` — overview grouped by day/region |
| `getDrivers` | 433–713 | `GET /drivers` |
| `getClosureDetail` | 714–1023 | `GET /detail` — per-driver reconciliation |
| `approveClosure` | 1023–1121 | `POST /approve` |
| `addDiscrepancy` | 1127–1200 | `POST /discrepancy` |
| `detailDiscrepancy`/`updateDiscrepancy`/`deleteDiscrepancy` | 1202–1359 | `GET/PUT/DELETE /discrepancy/:id` |
| `viewReport` | 1360–1533 | `GET /report` |
| `getRevenueReconciliation` | 1533–1759 | `GET /revenue` |
| `forceClosure` | 1759–1887 | `POST /force/closure` |

**Reconciliation model**: "closed" is **not** a field on `KitDistributed` at all — its `status` enum is only `["splitting","freeze","distributed"]` (datamodel §KitDistributed), with no "closed" value. Closure state lives entirely on `FleetOffDutyCloseout` (`status: "pending"|"approved"`, one doc per driver per day, conn3/hyperwolf-backend's DB) and on `Discrepancy.status`. There is no single record that says "this distribution/day is closed" — a day is "closed" only in the aggregate sense of every driver's `FleetOffDutyCloseout` being approved, and nothing in this codebase computes or stores that aggregate; `getData` (§below) recomputes open/closed/pending **counts** on every request from raw `FleetOffDutyCloseout` rows.

**Assigned vs scanned vs sold vs returned**: `getClosureDetail` (714–1023) builds this per product from the `KitDistributed` item's `productBatches[]` (or the matching `refillLogs[].productBatches[]` if the distribution being viewed is a refill):
```js
const assigned = Number(b.refillQty !== undefined ? b.refillQty : b.assignedQty !== undefined ? b.assignedQty : 0);
const scanned = Number(b.scannedQty || 0);
grouped[key].expectedQty += assigned;
grouped[key].soldQty += scanned;                       // closure-overview-controller.js:914-916
```
i.e. "sold" here is actually **`scannedQty`** (what the driver scanned back as sold at end-of-day), not a Blaze order count — a different "sold" than the one `syncSoldQty`/refill Pass A uses (`usedQty`, from Blaze transactions). Two different code paths call two different numbers "sold" with no shared definition — worth flagging to the team explicitly, since it means the refill algorithm's demand signal and the closure screen's revenue signal are not reconciled against each other anywhere.

**Discrepancies are created from here, not from `discrepancyManagement`**: `addDiscrepancy` (1127–1200) is the only place that constructs a `new Discrepancy({...})` with `status: "pending"` in the two areas covered by this doc (`discrepancyManagement` only reads/transitions existing ones). Drivers presumably file these on the closure form; there's no server-side check that `distributionId`/`driverId` actually correspond to a real `KitDistributed` entry.

### 2.1 Bug: wrong dollar figure in `getClosureDetail`

```js
totalInventoryValue: Number(totalQty * totalInventoryValue.toFixed(2)),   // closure-overview-controller.js:993
```
`totalQty` is a **quantity** (sum of units) and `totalInventoryValue` is already a **dollar total** (sum of `assignedQty * assignedPrice` across products, accumulated at line ~886). Multiplying them produces a number with no real-world meaning whenever `totalQty != 1` — e.g. 40 units × $1,200 inventory value reports as $48,000 instead of $1,200. This is a concrete, high-confidence "the numbers on the closure detail screen are wrong" bug, not a hypothesis.

### 2.2 Dead filter-mutation in `approveClosure`

```js
const updated = await FleetOffDutyCloseout.findOneAndUpdate(filter, {...}).lean();   // line ~1059, uses `filter`
...
if (distributionId) filter.distributionId = distributionId;   // 1076-1078 — filter already consumed above
if (regionId) filter.regionId = regionId;
if (subRegionId) filter.subRegionId = subRegionId;
await Discrepancy.updateMany({ driverId, distributionId, createdDate: {...}, status: "pending" }, {...});  // 1080-ish, builds its own literal, ignores `filter`
```
The three `filter.X = ...` lines mutate an object that is never read again — `Discrepancy.updateMany` below builds a fresh literal that never includes `regionId`/`subRegionId`. Net effect: approving one region/subregion's closure form flips **every** pending discrepancy for that driver on that calendar day to `pendingApproval`, regardless of which region/subregion it belongs to. If a driver has two subregions active the same day, approving one silently also advances discrepancies belonging to the other.

### 2.3 Silent audit gap in `forceClosure`

```js
// --- Log this event for audit ---
// await ActivityLog.create({ action: "FORCE_CLOSURE", ... });   // closure-overview-controller.js:1826-1841, commented out
```
A force-closure (admin manually marking a driver's day closed without their own submission) leaves **no** `ActivityLog` row — there is no audit trail distinguishing a driver-submitted closure from an admin override, beyond `closedBy` on the `FleetOffDutyCloseout` doc itself (which a driver's own approval also sets to `"Admin"` by default parameter, so it isn't even reliably distinguishable there either — `closedBy = "Admin"` is the function's own default, line 1763).

### 2.4 Whole-collection load, in-memory date filter

`getData` (§5 below) is the fourth of the four `.find({})` calls the mechanical audit flagged. Its `from`/`to` query params are parsed into `start`/`end` (lines 28–32) but **never passed to the Mongo query** — the query is `KitDistributed.find({}).lean()` unconditionally (line 35); `start`/`end` are only applied 350 lines later as an in-memory `Array.filter` gate at line 382–387, after the entire collection has already been pulled into Node and grouped by day. Every "load the closure overview for last week" click currently downloads every `KitDistributed` document ever created.

---

## 3. Aging and waste rules

**Thresholds live in two places** and are read, not automatically enforced anywhere:
- `AgingRules` (conn1, per-category: `productOlderDays`, `productExpiringDays`) — CRUD via `controllers/distribution/agingRules-controller.js`, no default values on the schema (`models/AgingRules.js:6-7`, plain `Number`, undefined until an admin sets one).
- `DistributionGlobalSettings.productExpiringDays` — a global fallback (`models/DistributionGlobalSettings.js:12`).

**Where the rule is applied**: `repositories/aging-rules.repository.js` (1,257 lines, a `class AgingRulesRepository` singleton). The actual "is this product aging/expiring" test:
```js
if (catRule.productOlderDays && catRule.productExpiringDays) {
    if (productAgingDays >= catRule.productOlderDays && productExpiryDays <= catRule.productExpiringDays) { /* both */ }
} else if (catRule.productOlderDays > 0) {
    if (productAgingDays !== null && productAgingDays >= catRule.productOlderDays) { /* aging */ }
} else if (catRule.productExpiringDays > 0) {
    if (productExpiryDays <= catRule.productExpiringDays) { /* expiring */ }
}
```
(repository lines 755–773, duplicated near-verbatim at 1094–1112 in a second function). Per-category fallback to the global setting happens at lines 149–156 / 314–322 when no category-specific `AgingRules` doc exists.

**This logic is consumed only by its own read endpoints** — `getAgingProducts` (140–302, `GET /api/v1/admin/aging/rules/products`) and `getAgingRulesProduct` (583–941, `GET .../box/products`). Grepping the whole repo for `productOlderDays`/`productExpiringDays`/`stale` outside `aging-rules.repository.js` and its own model/controller/route returns **zero hits**. **Nothing downstream — not `dailyRefillKit`, not `newProductDistributionCore`, not `waste-inventory-controller.js` — reads an aging flag or excludes an "old" product automatically.** "Becoming stale/waste" is purely an admin-facing report; turning that into an actual waste record or removing the product from circulation is a fully manual, separate action outside this codebase (or a step that doesn't exist yet).

**What "waste" means downstream**: `controllers/wasteInventory/waste-inventory-controller.js` has no relationship to `AgingRules` at all (no import). Waste inventory is simply `Discrepancy` documents with `status: "rejected"` (`listWasteInventory`, line 46: `const overdueFilter = { status: "rejected" };`). A discrepancy becomes "waste" only when someone in the discrepancy-management workflow rejects it — there is no automatic aging → waste pipeline.

### 3.1 Waste Inventory has two independent bugs that make it look broken

1. **Silent empty-list gate**: `DistributionGlobalSettings.discrepancyResolutionETA` has no schema default (`models/DistributionGlobalSettings.js:13`, plain `Number`). `listWasteInventory` does `const resolutionETA = globalSetting?.discrepancyResolutionETA || 0; if (resolutionETA <= 0) return res.json({ data: [], total: 0 });` (waste-inventory-controller.js:27–37). If that global setting was never set (or was reset to 0), the Waste Inventory screen returns an empty list **every time**, with success:true and no error — indistinguishable from "there is genuinely no waste."
2. **Filter-after-paginate**: `overdueFilter` is `{ status: "rejected" }` only — the `thresholdMs`/`thresholdDate` computed from the ETA (lines 42–44) are **never applied as a query filter**, only used later to compute a display `overdueHours` number (line 80). Pagination (`.skip().limit()`) is applied at the DB level (lines 50–54) **before** `brandId`/`categoryId`/`subCategory`/`discrepancyType`/`search` are applied as in-memory `Array.filter` calls (lines 153–178). Any filtered request therefore paginates over the wrong result set: page 1 can return zero rows for a valid category filter (because the unfiltered page of 10 raw rows happened to contain none of that category), and the reported `total` (`totalOverdue`, the *unfiltered* count) never matches the number of rows actually returned once a filter is applied.

---

## 4. Reports — Puppeteer + EJS

Two report families exist, all under `controllers/kitRefill/kit-refill-controller.js` and `repositories/manageDistributions.repository.js` (the latter out of scope here except to note it feeds `driverReport.ejs`).

| Template | Fed by | Query |
|---|---|---|
| `templates/refillBoxReport.ejs` | `boxPdfDownload` (4294–4487) | `KitDistributed.find({ "regionData.items.refillLogs.refillId": distributionId, "regionData.regionId": regionId })`, then `Boxes`/`Product`/`SubRegions`/`Regions` lookups by collected IDs |
| `templates/refillRegionReport.ejs` | `boxRegionPdfDownload` (4608–4767) | same shape, grouped by region instead of box |
| `templates/boxReport.ejs`, `templates/driverReport.ejs` | `repositories/manageDistributions.repository.js` (out of scope; ~1,270-line `kitDistributed()` function) | not re-verified here |

**Generation → storage → delivery** (`boxPdfDownload`, 4294–4487):
```js
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "networkidle0" });
const pdfBuffer = await page.pdf({ format: "A4", landscape: true, printBackground: true, margin: {...} });
await browser.close();
const fileKey = `reports/region_${regionId}_${Date.now()}.pdf`;
await s3.putObject({ Bucket: process.env.AWS_S3_BUCKET, Key: fileKey, Body: pdfBuffer, ContentType: "application/pdf", ContentDisposition: "attachment" }).promise();
const downloadUrl = `${process.env.APP_BASE_URL}api/v1/admin/kit-refill/reports/download?key=${encodeURIComponent(fileKey)}`;
```
(kit-refill-controller.js:4437–4459). No `ACL` is set on this `putObject` (unlike `middlewares/awsBucket.js:22`'s `ACL:'public-read'` for regular uploads), so the object is private by the bucket's own default; it is served back out through `downloadReport` (4768–4780), which does `s3.getObject(...)` and streams the buffer. **`downloadReport` has no `[admin]` middleware** (`routes/kitRefill/kit-refill-routes.js:18`, confirmed in `distribution-backend.md` §6) — anyone who obtains or guesses a `key` (predictable pattern: `reports/region_<regionId>_<epoch-ms>.pdf`) can fetch that PDF with no authentication.

**Timeouts**: none. `puppeteer.launch()` and `page.pdf()` have no explicit timeout override (Puppeteer's own defaults apply — 30s protocol timeout, but nothing here shortens or extends it for a slow/large report). A report covering many subregions/boxes builds a large in-memory `mergedBySubRegion` structure (4356–4423) before rendering; there is no page size cap.

**When Puppeteer/Chromium is missing on the host**: `puppeteer.launch()` throws synchronously inside the `try` block wrapping the whole handler (4295, `catch (err) { ... res.status(500).send({ message: "Error generating PDF", error: err.message }) })`). The client sees a 500 with whatever Chromium/library error Puppeteer produces (typically a "Failed to launch the browser process" / missing `.so` message on a slim Docker base image lacking `libnss3`/`libatk`/etc). Nothing in this repo's `package.json` or `.env.example` pins a `PUPPETEER_SKIP_DOWNLOAD`/`PUPPETEER_EXECUTABLE_PATH`/`PUPPETEER_CACHE_DIR` — Puppeteer `^24.22.3` downloads its own bundled Chromium at `npm install` time by default, so whether the deploy image's `npm install --legacy-peer-deps` step (per README) actually completes that download, and whether the runtime image retains OS-level shared libraries Chromium needs, is **not verifiable from this repo** (no Dockerfile — `distribution-backend.md` §2/§10) but is the single most likely explanation if PDF endpoints fail in production while everything else works.

---

## 5. Whole-collection loads and in-memory aggregation (path:line, collection, what breaks first)

Confirmed unbounded queries on the paths this doc covers (the four flagged by the mechanical audit, plus the aggregate found during this pass):

| # | Location | Collection | Pattern |
|---|---|---|---|
| 1 | `controllers/closureOverview/closure-overview-controller.js:35` | `KitDistributed` | `.find({}).lean()`, date filter applied in-memory 350 lines later (§2.4) |
| 2 | `controllers/common-controllers.js:888` | `KitDistributed` | `.find({}).lean()` inside `syncSoldQty`, then a nested `for (kit) for (region) for (item)` triple loop building `bulkOps` in JS — runs on **every** `dailyRefillKit` call, not just a list view |
| 3 | `controllers/discrepancyManagement/discrepancy-management-controller.js:34` | `Discrepancy` | `.find().sort({_id:-1}).lean()`, no filter despite `status`/`assignedTo`/`distributionType`/`startDate`/`endDate` all being accepted as query params (`startDate`/`endDate` destructured at lines 28–29 and never used again anywhere in the file — dead params, the frontend's date filter silently does nothing) |
| 4 | `controllers/kitRefill/kit-refill-controller.js:3985-3986` | `KitDistributed` | `.find({}).lean()` inside `useDistributedProductQty`, followed by a full `for (rec) for (rd) for (it)` scan building bulk ops |
| 5 | `controllers/kitRefill/kit-refill-controller.js:459-489` (`getNextRefillDistributionType`) | `KitDistributed` | triple `$unwind` aggregate (`regionData`→`items`→`refillLogs`) over the **entire** collection, run on every refill request, not just reads (§1.6) |
| 6 | `controllers/kitRefill/kit-refill-controller.js:317-378` / `378-448` | `KitDistributed` | `.find()` returns full Mongoose docs (not `.lean()`), then `kit.save()` **per modified document inside a `for` loop** — N sequential round-trips instead of one `bulkWrite`, and each `.save()` rewrites the entire `regionData`/`backupRegionData`/`refillLowStockItems` paths after `markModified()` (§5.1 below) |
| 7 | `controllers/wasteInventory/waste-inventory-controller.js:50-54` vs `153-178` | `Discrepancy` | DB-level `.skip()/.limit()` executed **before** in-memory category/brand/search filters — wrong results, not (yet) a scale problem, but will get slower as the `rejected` set grows since every page still requires re-fetching until enough post-filter rows accumulate |

**What breaks first as data grows**: `KitDistributed` has zero indexes (`distribution-backend.datamodel.md`) and is already the deepest-nested model in the schema (5 levels: `KitDistributed → regionData[] → items[] → refillLogs[] → productBatches[]`). Every week adds new documents that are never archived (no retention policy found). The four `.find({})` calls scale linearly with total historical distributions, but item 5 (`getNextRefillDistributionType`'s `$unwind`) scales with total historical **refill log rows** — the cross product of distributions × regions × items × refill-logs — which grows far faster than document count and runs on the write path of every refill. This is very likely to become the first hard failure (request timeout or OOM on the Node process building the unwound result set) well before the simpler `.find({})` calls do, because it runs unconditionally on every refill trigger rather than only when someone opens a list screen.

### 5.1 `versionKey:false` + whole-document `.save()` = silent lost updates

`models/KitDistributed.js` is declared with `{ versionKey: false }` (`distribution-backend.datamodel.md`), which disables Mongoose's built-in optimistic-concurrency check (`__v`). `undoRefillOnKitDistributed` (310–366) and `cleanupOrphanDailyRefillLogs` (378–448) both load full `KitDistributed` docs (not `.lean()`), mutate nested arrays in JS, `markModified(...)`, and call `kit.save()` — a whole-document overwrite of whatever was in memory when it was loaded. With no version check and no `LockService`-equivalent anywhere in this repo (confirmed in `distribution-backend.md` §7 — "no lock library, no lease pattern"), a `.save()` from either of these functions racing against `syncSoldQty`'s targeted `bulkWrite` (common-controllers.js, positional `$set` on the same document) or against a driver's live scan write (`common/scanHandler.js`) can silently clobber the other's write with no error on either side. This is the direct Node/Mongo analogue of the GAS "row indices only valid while the lock is held" rule — here it's "the loaded document is only valid until you `.save()` it back," and nothing in this repo protects against a stale save.

---

## 6. Why it may not work today

1. **Hardcoded IST (+5:30) day-boundary offset, 4 copies, inconsistent with the rest of the codebase** (§1.5). Symptom the team would see: a refill triggered near local midnight either double-runs or is refused with "already been completed for today," on a schedule that doesn't match any US business day — and the closure-overview screens (which use a *different*, unoffset day boundary) will show a distribution grouped under a different calendar date than the refill screens do for the same event. This is the strongest single candidate for "supposed to work but doesn't," because it's not a crash — it silently produces wrong "today" buckets that only show up as confusing, hard-to-reproduce timing complaints.
2. **All four cron schedules are commented out, and even uncommenting them would crash immediately.** `startup/nodeCrons.js` wraps `kitDistributed()`, `dailyRefillKit()`, `saveProductBatches()`, `syncSoldQty()` in commented `cron.schedule(...)` blocks. `dailyRefillKit` is written as an Express handler: it immediately calls `extractSubRegionIdsFromRequest(req)` (kit-refill-controller.js:861), which does `req.body?.subRegionIds` — if a cron called `await dailyRefillKit()` with no arguments (as `nodeCrons.js`'s commented code does), `req` is `undefined` and this throws a `TypeError` on the very first line. **Whoever "fixes" this by just removing the `//` will break the process on every tick** unless the handlers are first adapted to accept a plain options object the way `syncSoldQty`/`saveProductBatches` already do. Whatever currently triggers `dailyRefillKit` in production is an external caller hitting the admin-JWT-protected `POST /api/v1/admin/kit-refill/cron` by hand or from an out-of-repo scheduler (confirmed absent from this repo).
3. **`totalInventoryValue` on the closure detail screen is arithmetically wrong** (§2.1, `closure-overview-controller.js:993`, `totalQty * totalInventoryValue`) — every closure reconciliation view with more than 1 total unit shows an inflated, meaningless dollar figure. This is not a hypothesis; it is a direct read of the expression.
4. **Waste Inventory silently returns empty whenever `DistributionGlobalSettings.discrepancyResolutionETA` is unset** (§3.1.1) — no schema default, `|| 0` fallback, hard `<= 0` gate returns `data: []` with `success:true`. If nobody has explicitly configured this setting (or it was reset), the feature looks "empty" rather than broken, which is exactly the kind of failure a team reports as "doesn't work."
5. **`saveProductBatches()`'s return value is discarded inside `dailyRefillKit`** (`kit-refill-controller.js:870`) — if Blaze is flaky and many products fail to sync (`failedCount` > 0, `common-controllers.js:807-812`), the refill proceeds anyway on stale `ProductBatch` data with no signal in the API response about which products' batch data might be outdated. Symptom: refill quantities come out lower than expected (or zero, if `safeInventory` failed to update and reads as 0 → "product unavailable," kit-refill-controller.js:1112–1115) with nothing in the response explaining why.
6. **8 separate places** swallow failure of the `KitRefill` audit-total update with only a `console.error`, e.g. `catch (kitRefillErr) { console.error("KitRefill update (dailyRefillKit) failed:", kitRefillErr); }` (kit-refill-controller.js:1466–1467, and 7 more at 2693, 3944, 4592, 4895, 5190, 5347). The refill itself already committed via `bulkWrite`, so the HTTP response correctly reports success — but the `KitRefill` summary/audit collection (used by `listKitRefillAuditLogs`/`getKitRefillAuditLog`) can silently drift out of sync with what `KitDistributed` actually holds, and (per the Sentry finding in `distribution-backend.md` §8) `Sentry.captureException` is a no-op here since `Sentry.init()` is never called — so this failure is invisible everywhere, not just in the HTTP response.
7. **`getNextRefillDistributionType`'s unindexed triple-`$unwind` aggregate runs on every refill trigger** (§1.6) — as refill-log history grows this is the piece most likely to time out or exhaust memory first, and it would present as "the refill button just spins/504s" with no obvious cause in the response.
8. **`approveClosure`'s dead filter-mutation** (§2.2) means approving one region/subregion's closure can silently flip discrepancies belonging to a *different* region/subregion for the same driver/day to `pendingApproval` — a discrepancy-management symptom ("why did this discrepancy change status when I approved a different closure") whose root cause is in the closure controller, not discrepancy-management.
9. **`forceClosure` writes no audit trail** (§2.3, commented-out `ActivityLog.create`) — if the team is trying to reconcile "why does this day show closed with no discrepancy record of who forced it," the answer is that the logging call was commented out, not that logs were lost.
10. **Cross-service dependency**: `resolveActorId` (kit-refill-controller.js:497) looks up `Admin` on `conn2` (hemp-backend's database) by the JWT's `_id` claim to resolve a human-readable name for `updatedBy`/`createdBy`; `Fleets`/`Order`/`Product`/`Brand`/`Category`/`Closeout`/`FleetOffDutyCloseout` all live on `conn3` (hyperwolf-backend's database, per `distribution-backend.md` §3). If either `HEMP_DATABASE_URL` or `HYPERWOLF_DATABASE_URL` is misconfigured, stale, or that database's schema has drifted from this repo's independent copy of the same model (§12 of the main audit — `Fleets`/`Order` are near-duplicates, not shared code), refill/closure requests touching those paths fail or silently mismatch with no indication the root cause is in a different service's database.
11. **Env vars this flow needs** (from `.env.example`, all required for the paths in this document): `DATABASE_URL`, `HEMP_DATABASE_URL`, `HYPERWOLF_DATABASE_URL` (boot-fatal if any fail, `startup/db.js:24`), `JWT_ADMIN_PRIVATE_KEY` (admin auth), `BLAZE_BASE_URL`/`BLAZE_API_KEY`/`BLAZE_API_KEY_TOKEN` (refill's Blaze sync), `AWS_ACCESS_KEY`/`AWS_SECRET_ACCESS_KEY`/`AWS_REGION`/`AWS_S3_BUCKET` (PDF reports), `APP_BASE_URL` (report download URL construction). No Puppeteer-specific env var is set anywhere in this repo (§4) — that dependency is entirely implicit.

---

## 7. Change surface

Functions most likely to need touching to fix the above, ranked by how central they are to the reported symptoms:

| Function | File:lines | Size | Callers |
|---|---|---|---|
| `dailyRefillKit` | `controllers/kitRefill/kit-refill-controller.js:851-1497` | ~647 | route only (`POST .../kit-refill/cron`) |
| `newProductDistributionCore` | `controllers/kitRefill/kit-refill-controller.js:1498-2629` | ~1,131 | `dailyRefillKit` (×2), `exports.newProductDistribution` (dead route) |
| `syncSoldQty` | `controllers/common-controllers.js:849-~1050` | ~200 | `dailyRefillKit`, unauthenticated `GET /api/v1/sync/sold/qty` |
| `saveProductBatches` | `controllers/common-controllers.js:643-834` | ~190 | `dailyRefillKit`, unauthenticated `POST /api/v1/product/batches` |
| `getData` (closure overview list) | `controllers/closureOverview/closure-overview-controller.js:21-431` | ~410 | route only (`GET .../closure-overview/list`) |
| `getClosureDetail` | `controllers/closureOverview/closure-overview-controller.js:714-1023` | ~310 | route only (`GET .../closure-overview/detail`) — contains the §2.1 dollar bug |
| `approveClosure` | `controllers/closureOverview/closure-overview-controller.js:1023-1121` | ~100 | route only — contains the §2.2 dead-filter bug |
| `getDiscrepancyData` | `controllers/discrepancyManagement/discrepancy-management-controller.js:20-228` | ~208 | route only (`GET .../discrepancy-management/list`) |
| `listWasteInventory` | `controllers/wasteInventory/waste-inventory-controller.js:11-~200` | ~190 | route only (`GET .../waste-inventory/list`) — contains both §3.1 bugs |
| `getAgingProducts` / `getAgingRulesProduct` | `repositories/aging-rules.repository.js:140-302`, `:583-941` | ~160 / ~360 | `controllers/distribution/agingRules-controller.js` |
| `boxPdfDownload` / `boxRegionPdfDownload` | `controllers/kitRefill/kit-refill-controller.js:4294-4487`, `:4608-4767` | ~193 / ~159 | route only |

**Tests**: none exist for any of the above, or anywhere in the repo (`distribution-backend.md` §9 — `npm test` is the default placeholder, no `*.test.js`/`*.spec.js` files, no test framework installed). Any change to this logic ships with zero automated regression coverage; manual verification against a real `KitDistributed` document is the only check available today.

---

## 8. Questions for the team

1. What timezone should "today" actually mean for a refill day boundary — is there a documented business timezone (Eastern? the store's local zone per region?), or was the `+5.5h` offset a copy-paste from an unrelated project? This needs settling before any fix, since closure-overview uses a third (server-local, unoffset) definition.
2. Is `newProductDistribution` (the unmounted route) meant to be callable independently by the frontend, or is it legacy from before Pass A/B were merged into one `dailyRefillKit` flow? If it's dead, should it be removed to stop it drifting further from `newProductDistributionCore`'s actual signature?
3. Is `DistributionGlobalSettings.discrepancyResolutionETA` currently set in production? If it's `0`/unset, that alone fully explains an empty Waste Inventory screen with no other symptoms.
4. Should "sold" mean the same thing in the refill algorithm (Blaze-transaction-derived `usedQty`) and in the closure reconciliation screen (driver-scanned `scannedQty`)? Right now they're two different numbers with the same name, computed by two different controllers, and nothing cross-checks them.
5. Is there a retention/archival plan for `KitDistributed`? It has zero indexes, is queried with `.find({})` on four endpoints, and is the input to an unindexed triple-`$unwind` aggregate run on every refill request (§1.6) — this is the highest-priority item if "gets slower every week" matches what the team is observing.
6. Does the production deploy actually have Chromium/Puppeteer working today? If PDF report generation is one of the reported failures, confirming whether `puppeteer.launch()` succeeds at all on the current host would immediately rule in or out §4's hypothesis.
7. Who (or what) currently calls `POST /api/v1/admin/kit-refill/cron` in production, now that the in-process cron is fully commented out? If nobody can answer this confidently, refills may not be running on any reliable schedule at all.
8. Should `approveClosure`/`forceClosure` be scoped to the specific region/subregion passed in, given §2.2's dead-filter bug currently makes that scoping a no-op for the discrepancy side-effect?
