# Symptom trace: newly-received inventory sits for a week / refill qty is wrong

Repo: `/Users/jt/hyper-tech/distribution-backend` (read-only clone). All line numbers verified by direct read on 2026-09-10.

---

## Symptom 1 — newly-received inventory is not prioritised

### (a) How the system learns inventory was received

- `controllers/common-controllers.js:643-843` `exports.saveProductBatches` is the only writer of receiving data. Per product it calls two Blaze endpoints:
  - `GET /api/v1/partner/products/:productId` → `sellableQuantities.no_region` becomes `safeInventory` (`common-controllers.js:707-708`).
  - `GET /api/v1/partner/store/batches?productId=...` → each Blaze batch `b` becomes a `batchData` entry (`common-controllers.js:756-793`) with `purchaseDate: new Date(b.purchasedDate).getTime()`, `created: b.created`, `expirationDate`, `currentQuantity: b.liveQuantity`, `batchNo`, `productBatchId: b.id`.
  - Written via `ProductBatch.bulkWrite` with `$set: { batchData, safeInventory, updatedDate }` — **the whole `batchData` array is replaced every sync** (`common-controllers.js:795-808`).
- There is **no "new arrival" flag, no lot/received-date field distinct from `purchaseDate`**, and no diffing against the previous sync to detect "this batch is new." `purchaseDate` (Blaze's `purchasedDate`) is the closest thing to a received-date, and it is only ever read for FEFO ordering and for aging (see below) — never for prioritisation.
- **This sync never runs on its own.** `startup/nodeCrons.js` is the only file in the repo that calls `node-cron`, and **every `cron.schedule(...)` in it is commented out** (lines 7-42), including the one that would have called `saveProductBatches()` every 10 minutes (lines 25-32). The only way `saveProductBatches` executes is (i) inline inside `dailyRefillKit` (`kit-refill-controller.js:870`, see below) or (ii) an external caller hitting `POST /product/batches` (`routes/common-routes.js:10`). No such external caller (cron-job.org config, GAS trigger, etc.) exists in this repo — **not found**, cannot confirm cadence from code alone.

### (b) Kit template / kit build — any freshness input at all?

- `controllers/kitTemplate/kit-template-controller.js` — `addKitTemplate`, `addTemplateSku`, `updateTemplateProductSku`, `deleteTemplateProductSku` are all **admin-driven CRUD** on `KitTemplate` / `KitTemplateSku` (`kit-template-controller.js:17-284`). Quantities are `minQuantity`/`maxQuantity` typed directly into `KitTemplateSku.products[]` (`models/templateSku.js:7-12`, untyped `Object`). **No field, hook, or cron references `purchaseDate`, `created`, or any freshness signal when building/editing a template.** The template is purely static and hand-edited — confirmed, no ordering/priority logic exists at all in this layer.

### (c) Kit refill "new product" pass (Pass B) — does it prioritise by freshness?

`newProductDistributionCore` in `kit-refill-controller.js:1498-…` is the only mechanism that adds a SKU that isn't already in a driver's kit:
- Eligibility filters (`kit-refill-controller.js:2011-2022`): not already in kit, `activeProductIdSet` (`Product.productData.active===true && productData.totalSellableQuantity>0`, `:1698-1706`), and `passBFefoMap` (built from `ProductBatch.batchData`, `:1655-1694`) has `total > 0`.
- **Selection order is alphabetical**: `newProductPids.sort((a, b) => String(a).localeCompare(String(b)))` (`kit-refill-controller.js:2021`). No sort by `purchaseDate`/`created`/age anywhere in this function.
- **Equal-distribution gate** (`kit-refill-controller.js:2095-2098`): `if (node.total < ctx.totalSubregions) { skipPidLog.lowStock++; continue; }` — a product is skipped from every box in a round until its *total* current-quantity across all batches is at least the number of subregions being served. A newly received SKU that arrived in a small first tranche (e.g., 5 units against 12 subregions) is silently skipped every single run until enough stock accumulates — with no freshness override to jump the queue.
- `productData.totalSellableQuantity` (used as the "active & sellable" gate, `:1701-1706`) is **read in 20+ places across this repo but never written anywhere in it** (`grep -l totalSellableQuantity` finds zero assignment sites) — it must be populated by a separate, out-of-repo product sync. If that sync also lags, a fresh product can be excluded from Pass B entirely regardless of `safeInventory`/batches — **not found**, cannot confirm its own cadence from this repo.

### (d) Aging rules — do they feed the build/refill?

- `repositories/aging-rules.repository.js` implements `getAgingProducts`, `getAgingRulesProduct`, `getPromotionsProducts`, `getAgingRulesPromotionsProduct`. All four **only compute `agingDays`/`expiryDays` from `ProductBatch.batchData.purchaseDate`/`expirationDate` for read-only listing/reporting/promotions endpoints** (`aging-rules.repository.js:140-294`, `:302-542`, `:583-936`, `:942-1252`). None of them write to `KitTemplate`, `KitTemplateSku`, or `KitDistributed`, and none are called from `kit-refill-controller.js` or `kit-template-controller.js` (verified: no cross-reference in either direction). **Confirmed: aging rules feed reports/promotions only — zero connection to kit build or refill.**

### Root cause, Symptom 1

A newly received premium SKU sits for up to a week because **freshness/received-date is not an input anywhere in the selection path** — not in the static, hand-edited `KitTemplate`, and not in the one dynamic path that can add a new SKU (Pass B), which sorts candidates alphabetically and additionally requires the SKU's *total* batch quantity to already cover every subregion (`kit-refill-controller.js:2021`, `:2095-2098`) before it will place a single unit anywhere. On top of that, the only writer of received-inventory data (`saveProductBatches`, `common-controllers.js:643`) has no live cron (`nodeCrons.js:25-32`, commented out) and only fires as a side-effect of `dailyRefillKit` (`kit-refill-controller.js:870`) or an external call this repo doesn't show — so a small first-tranche receipt can be both under the equal-distribution threshold *and* stale in `ProductBatch` for however long the external trigger takes to fire.

---

## Symptom 2 — refill quantity is wrong (over/under/omitted)

### (a) What "sold" means

`controllers/common-controllers.js:849-1068` `exports.syncSoldQty`, called from `dailyRefillKit` with `preserveExistingUsedQty:true` (`kit-refill-controller.js:874-877`):

- Source: **Blaze transactions**, `fetchBlazeTransactions(startTs, endTs)` → `GET /api/v1/partner/transactions?startDate&endDate&skip&limit` (`common-controllers.js:169-208`), paginated by 100, deduped by `transaction.id`.
- Query window: `formatBlazeTransactionDate` (`:167`) uses `moment(ts).format("MM/DD/YYYY")` with **no explicit timezone** — this is the server process's local/OS timezone, not stated anywhere as Pacific. `globalStartTs = min(dispatch time across target subregions)` (`syncSoldQty`, `:922-924`), `nowTs = moment().valueOf()`.
- Filter (`filterBlazeTransactions`, `:116-133`): must be `isCompletedBlazeTransaction` (`status === "completed"`, `:80-81`) **AND** `isAsapBlazeTransaction` (`(transaction.orderTags||[]).includes("asap")`, `:83-84`). **Any completed order that is not tagged "asap" is entirely excluded from "sold" — this is a hard omission mechanism**, not a filter tunable per region/product.
- Per-item window (`syncSoldQty`, `:959-971`): `orderWindowStart = latestRefill?.date ?? dispatchStart` — i.e., "since last refill" or "since dispatch."
- Product identity: `cartItem.productId.toString() !== productId` (`countOrderSoldQtyForItem`, `common-controllers.js:135-155`) — matches on Blaze's own product id as a string against `KitDistributed.regionData[].items[].productId` (also a String field, `models/KitDistributed.js:29`). No SKU/barcode fallback; a Blaze-side product/variant id change breaks the join silently (see table below).
- Region identity: transactions are mapped to a subregion via `sellerTerminalId → terminalRegionMap[terminalId]` from `GET /api/v1/partner/store/inventory/terminals` (`getBlazeTerminalRegionMap`, `:86-107`, `:109-114`). A terminal not present in that map, or reassigned to a different region in Blaze without the mapping being refreshed, drops its transactions from `matchedTransactions` entirely.
- `usedQty = preserveExistingUsedQty ? max(existingUsedQty, calculatedUsedQty) : calculatedUsedQty` (`:977-979`) — **usedQty is monotonic non-decreasing** across syncs during the refill's own preserve-mode call; it only resets to 0 when a refill actually consumes it (`kit-refill-controller.js:1382-1384`, `:1338`).

### (b) What "on hand"/"remaining in kit" means

- Never computed directly from a physical/scanned count in the refill formula. "Remaining in kit" is implied as `distributed − usedQty`, but the refill loop doesn't compute it explicitly — it only computes `neededQty` (below) and always draws fresh stock from `ProductBatch` via FEFO (`kit-refill-controller.js:1100-1167`), capped by `safeInventory` (`:1109-1115`). `safeInventory` comes from the same lagging `saveProductBatches` Blaze call.

### (c) The refill formula

`kit-refill-controller.js:990-1046`:
```
getEffectiveUsedQty(item)   // latest refillLog.usedQty, else item.usedQty
getDistributedQty(item)     // assignedQty || sum(productBatches assignedQty/expectedQty) || expectedQty
getRefillCapQty(item)       // latest refillLog.refillQty||expectedQty, else getDistributedQty(item)
getRefillNeededQty(item) = soldQty<=0 ? 0
                          : capQty<=0 ? 0
                          : Math.min(soldQty, capQty)
```
There is **no min/max/threshold from the template in this formula at all** — Pass A refill quantity is purely `min(sold-since-last-refill, cap)`, where cap is whatever was distributed the first time or actually refilled last time (see ratchet mechanism below). Min/max/threshold quantities (`KitTemplateSku.products[].minQuantity/maxQuantity`, `DistributionGlobalSettings`) are only consulted in Pass B (new products), never in Pass A (refill of existing items).

### (d) Rounding, caps, overrides

- `qtyToRefill = Math.min(neededQty, stockLeft)` (`:1285`) — hard-capped by currently-available FEFO stock, shortfall recorded to `refillLowStockItems` (`pushLowStock`, `:1235-1251`, reasons `no_stock`/`insufficient_stock`/`partial_stock`/`no_picks`).
- **Cap ratchet (persistent under-refill mechanism):** the new refill log stores `refillQty: qtyToRefill, expectedQty: qtyToRefill` — i.e. **the actually-given quantity, not the true `neededQty`** (`:1307-1308`). Since `getRefillCapQty` reads `latestRefill.refillQty` for the *next* cycle's cap (`:1026-1035`, same logic in `common-controllers.js:63-72`), **a single stock-shortage day permanently lowers the ceiling for all future refills of that product/kit**, even after `ProductBatch` stock recovers — there is no mechanism that restores the cap to the original distributed quantity.
- No explicit per-region or per-driver override multiplier exists in this formula; regional variance only enters via each kit's own `assignedQty`/prior refill history.

### (e) Identity-join and null→0/null→full mechanisms — table

| # | Mechanism | Symptom | path:line | How to confirm from data |
|---|---|---|---|---|
| 1 | Order not tagged `"asap"` in Blaze → excluded from "sold" entirely | **Omitted** (product never flagged as needing refill) | `common-controllers.js:125` `if (!isAsapBlazeTransaction(transaction)) return false;` | Pull a completed Blaze transaction for a product known to be low in the field; check `orderTags`. If `"asap"` isn't present, `syncSoldQty` never counts it. |
| 2 | Transaction's `sellerTerminalId` missing from `terminalRegionMap` (stale/unmapped terminal) | **Omitted** | `common-controllers.js:96-107`, `:122-123` | `GET /api/v1/partner/store/inventory/terminals` and diff terminal ids against ones appearing in recent `/api/v1/partner/transactions` results. |
| 3 | `cartItem.productId` (Blaze) ≠ `item.productId` (KitDistributed) after a product rename/variant swap in Blaze | **Omitted** (usedQty stays 0 forever for that kit item) | `common-controllers.js:149` `if (cartItem?.productId?.toString() !== productId) continue;` | For a product suspected under-refilled, compare `KitDistributed.regionData[].items[].productId` to the `productId` on the matching Blaze order line; a value present in Blaze's product catalog under a new id but absent from `KitDistributed` items confirms the break. |
| 4 | `item.usedQty` / `item.refillLogs` never populated (product added outside the sync path, e.g. manual box edit) | **Omitted** | `kit-refill-controller.js:990-994` `getEffectiveUsedQty` returns `Number(item.usedQty)\|\|0` | `db.kitdistributeds.find({"regionData.items.usedQty": {$exists:false}})` or `usedQty: null` for items with known sales. |
| 5 | `getRefillCapQty` returns 0 (no `assignedQty`, no `productBatches`, no `expectedQty` ever set on distribution) | **Omitted** (`getRefillNeededQty` short-circuits `capQty<=0 → 0`, line 1043) | `kit-refill-controller.js:1002-1013`, `:1042-1043` | Inspect the item's `assignedQty`/`productBatches`/`expectedQty` on its original distribution record; all-zero/absent confirms. |
| 6 | `ProductBatch` doc missing or `safeInventory<=0` for the product | **Omitted**, logged as `no_stock` | `kit-refill-controller.js:1112-1115`, `:1265-1271` | `db.productbatches.findOne({productId})` — absent doc or `safeInventory<=0` while Blaze shows live stock confirms lag. |
| 7 | Cap ratchet after a stock-shortage day (see (d)) | **Under-refill**, persistent | `kit-refill-controller.js:1307-1308` + `:1026-1035` | Compare a product's `refillLogs` history: once `refillQty < previous cap` appears once, every subsequent `neededQty` is capped at that lower value even after stock recovers — check `ProductBatch.safeInventory` on those later dates to confirm stock was no longer the constraint. |
| 8 | `preserveExistingUsedQty` takes `max(existing, calculated)` — a stale high `usedQty` from a prior miscount never decreases except by consumption via refill | **Over-refill** (refills against phantom demand) | `common-controllers.js:977-981` | Find an item whose `refillLogs[].usedQty` grew once, unusually high, then stayed elevated across days without a corresponding Blaze order; the `capNote`/`restoreNote` console logging pattern (`:986-990`) documents when this happened. |
| 9 | `loadDistributedRecordsForRefill` only pulls `status:"distributed"` docs, and — with no explicit subregion filter — only the single latest `weekStartDate` (`:113-135`) | **Omitted**, whole-kit | `kit-refill-controller.js:113-135` | Any `KitDistributed` doc with `status` other than `"distributed"`, or belonging to an older `weekStartDate`, is invisible to an unscoped `dailyRefillKit` run — `db.kitdistributeds.distinct("status")` and `distinct("weekStartDate")` to check for stragglers. |
| 10 | Subregion has no `KitTemplate{templateType:"refill"}` covering it | **Omitted**, whole-subregion (Pass B, and Pass A dedup/skip logic references the same coverage set) | `kit-refill-controller.js:166-192`, `:974-979` | `db.kittemplates.find({templateType:"refill", subRegionId: <id>})` returns empty for the affected subregion. |

### (f) Date windows — UTC vs Pacific, and midnight-crossing drivers

- `dailyRefillKit`'s day-bucket key uses a **hardcoded `+5.5` hour offset** — India Standard Time, not Pacific and not UTC:
  ```js
  const startOfDayMs = (ts) => {
      const offset = 5.5 * 60 * 60 * 1000;
      return Math.floor((ts + offset) / 86400000) * 86400000 - offset;
  };
  ```
  `kit-refill-controller.js:855-858`, **duplicated verbatim** in `newProductDistributionCore` at `:1510-1513`. This `todayKey` is what dedupes "has today's refill already run" (`ActivityLog` lookups, `:903-941`) and is stored as `refillDay` on every log. For a US (Pacific) operation this shifts the "day" boundary by roughly 13.5 hours from local midnight — a refill run late at night Pacific can be bucketed as "tomorrow" (IST) and a driver working past midnight Pacific can have their sales attributed to a `refillDay` that doesn't match the shift they were actually on, and/or the "already refilled today" gate can fire early/late relative to the real business day.
- `syncSoldQty`'s Blaze API request window (`formatBlazeTransactionDate`, `moment(ts).format("MM/DD/YYYY")`, `common-controllers.js:167`) uses **whatever timezone the Node process itself runs in** (no `moment.tz` anywhere in the repo — confirmed via repo-wide grep for `timezone`/`moment.tz`/`process.env.TZ`, zero hits). If the host's default TZ is UTC while the business operates in Pacific, a transaction between 4pm–midnight Pacific (which is the next UTC calendar day) risks falling outside a tightly-scoped `startDate`/`endDate` pair — though because the *precise* filtering afterward is done on raw epoch timestamps (`getBlazeTransactionTime`, `:74-78`) against `dispatchStart`/`windowStart`, the risk is bounded to the Blaze API's own day-bucketing on the request, not the in-process filtering. **Not found**: could not confirm the actual deployed `TZ` env value from this repo.

### Root cause, Symptom 2

Over-refill and under-refill/omission are not one bug but the sum of the table above; the two highest-confidence, most systemic ones are: (1) **the `"asap"`-tag-only sold filter** (`common-controllers.js:125`) which structurally excludes any non-ASAP completed sale from ever counting as demand, and (2) **the cap ratchet** (`kit-refill-controller.js:1307-1308` feeding `:1026-1035`) which permanently lowers a product's refill ceiling after any single stock-constrained day, with no reset path. The IST-offset day boundary (`:855-858`, `:1510-1513`) is a separate, concrete defect affecting exactly the "driver who worked past midnight" case asked about.

---

## What would have to be true for the logic to work

1. Blaze (or an intermediate receiving step) would need to expose a **received/new-arrival signal distinguishable from "already in circulation" stock** — the current data (`purchaseDate`, `currentQuantity`, `safeInventory`) tells you *how much* and *how old*, but the refill/build code never reads age as an input, so even perfect data wouldn't change behavior without a code change.
2. `productData.totalSellableQuantity` and `ProductBatch.safeInventory`/`batchData` need to be **refreshed on a real, live schedule** — right now both depend on triggers this repo doesn't show (`nodeCrons.js` is fully disabled) or on `dailyRefillKit` happening to run.
3. "Sold" needs to include **all completed transaction types**, not just `"asap"`-tagged ones, and the Blaze product id used in transactions needs to be guaranteed stable/reconciled against `KitDistributed.items.productId` (or joined via SKU as a fallback) whenever Blaze renames/re-ids a product.
4. The refill cap needs a **source of truth independent of "what was actually handed out last time"** — otherwise a single low-stock day is indistinguishable from "this kit needs less than before" forever.

## Smallest fix per symptom (design note, not code)

- **Symptom 1:** Add a `receivedFreshDays` (or reuse `purchaseDate`) sort key ahead of the alphabetical sort in `newProductDistributionCore` (`kit-refill-controller.js:2021`), and relax or waive the equal-distribution gate (`:2095-2098`) for products under some age threshold — e.g., allow partial-subregion placement for anything received within N days instead of requiring full coverage first. Independently, re-enable a real cron for `saveProductBatches` (or confirm and document the external trigger) so `safeInventory`/`batchData` are not only as fresh as the last `dailyRefillKit` run.
- **Symptom 2:** (a) Remove or make configurable the `isAsapBlazeTransaction` filter (`common-controllers.js:125`) so all completed sales count as "sold" unless there's a specific reason ASAP-only was intentional (undocumented in this repo). (b) Store `neededQty` (true demand) separately from `refillQty` (actually given) on each refill log, and derive next-cycle cap from `max(neededQty, distributedQty)` rather than from `refillQty`, so a shortage day doesn't permanently ratchet the ceiling down. (c) Replace the hardcoded `+5.5h` offset (`:855-858`, `:1510-1513`) with the business's actual timezone, defined once and imported, not duplicated. (d) Add a SKU-based fallback (or a Blaze-product-id-change reconciliation step) to the sold-qty product join so a mid-cycle Blaze rename doesn't silently zero out demand.

## What could not be determined from this repo

- Whether `saveProductBatches`, `syncSoldQty`, `dailyRefillKit`'s `/cron` route, or `kitDistributed`'s `/cron` route are invoked by an external scheduler (cron-job.org, a GAS trigger, etc.) and at what cadence — `startup/nodeCrons.js` has zero active `cron.schedule` calls, so the only in-repo trigger is `dailyRefillKit`'s own inline call to `saveProductBatches`/`syncSoldQty` at the start of its own run.
- The writer of `productData.totalSellableQuantity` — read in ≥20 places, written nowhere in this repo.
- The deployed process's `TZ` environment value, needed to confirm the exact UTC-vs-Pacific exposure in `syncSoldQty`'s Blaze API date-range request.
- Whether Blaze's `cartItem.productId` and the partner-products-API `productId` used to key `ProductBatch`/`Product` are guaranteed to be the same value for a given SKU across a rename/variant event — this would need a live Blaze API comparison, not just code reading.
