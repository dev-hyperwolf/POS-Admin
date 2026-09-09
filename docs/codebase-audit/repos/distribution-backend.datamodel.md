# distribution-backend — full data model

Repo pinned at `aaa6ecb79ccea079f14505f4bbc5a7ffa666cfde`. Every model file in `models/` (32 files, 31 live models — `ManageDistributions.js` is 0 bytes and unreferenced, see main report §5). Field lists are transcribed directly from the Mongoose schema definitions; nested sub-documents are indented. `versionKey: false` is set on every schema (no `__v`); noted separately only where a schema also sets `minimize: false` or omits both.

Connections: **conn1** = `DATABASE_URL` (this service's own DB) · **conn2** = `HEMP_DATABASE_URL` · **conn3** = `HYPERWOLF_DATABASE_URL`.

---

## Admin — conn2, collection `Admin`
`models/Admin.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| firstName, lastName, name, email, password, phone, status, pin | String | plaintext field names only — hashing not verifiable from schema (bcrypt/etc. would happen in a controller not present in this repo, since there's no login controller here) |
| userRoles | Array | untyped array, no sub-schema |
| createdDate, lastLogin | Number | epoch ms, no default |
| isSuperAdmin | Boolean | default `false` |
| deviceToken | Array | default `[]` |

Method: `generateAuthToken()` — signs `{ _id, email, isSuperAdmin }` with `JWT_ADMIN_PRIVATE_KEY`, `expiresIn: "2d"`. No indexes declared (not even on `email`, despite it presumably being the login lookup key).

## AgingRules — conn1, collection `AgingRules`
`models/AgingRules.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| categoryId | String | |
| productOlderDays, productExpiringDays | Number | |
| platform | String | enum `['hyperwolf','stilo']`, default `'hyperwolf'` |
| createdDate, updatedDate | Number | epoch ms, no default |

No indexes. Joi validator `addAgingRulesValidation` (all fields optional).

## Boxes — conn1, collection `Boxes`
`models/Boxes.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| name | String | `unique: true, required: true, trim: true` (implicit unique index) |
| description | String | default `""` |
| createdBy | String | |
| isActive | Boolean | default `true` |
| platform | String | enum `["hyperwolf","stilo"]`, default `"hyperwolf"` |
| createdDate, updatedDate | Number | |
| updatedBy | String | |

1 implicit index (unique `name`). Joi validator does an app-level case-insensitive duplicate-name check (`new RegExp('^name$','i')`) in addition to the unique index.

## Brand — conn3, collection `Brand`
`models/Brand.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| brandId, brandName | String | |
| description | String | default `""` |
| createdBy, status | String | |
| createdDate, updatedDate | Number | |

No indexes.

## Category — conn3, collection `Category`
`models/Category.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| categoryName | String | `require: true` (note: typo for Mongoose's `required`, so this is **not actually enforced** — `require` is not a recognized SchemaType option and is silently ignored by Mongoose), `unique: true` |
| description, image, metaTitle, bmwCategorySlug, metaDescription, heading, canonical | String | |
| blazeCategories | Array | untyped |
| order | Number | |
| createdDate, updatedDate | Number | |

1 implicit unique index (`categoryName`). **Bug**: the `require: true` typo means new categories can be saved with no `categoryName` at the DB layer (only the separate Joi validator enforces it, and only on the one route that uses that validator).

## Closeout — conn3, collection `closeOut` (model name `"closeOut"`)
`models/Closeout.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| title | String | |
| type | String | enum `['text','checkbox','photo','qr','number','prefix','boolean']` |
| createdBy | ObjectId | ref `Admin` |
| isActive, isButton, isPrefix | Boolean | default `true` |
| isOptional, isRequired | Boolean | default `false` |
| keyboardType | String | |
| createdDate, updatedDate | Date | default `Date.now` — **Date type**, unlike most conn1 models which use epoch `Number` |

Index: `{ title: 1 }` (non-unique).

## Discrepancy — conn1, collection `Discrepancy`
`models/Discrepancy.js`. Options: `{ versionKey: false }` (no `minimize: false`).

| Field | Type | Notes |
|---|---|---|
| distributionId | String | `required: true` |
| regionId, subRegionId, driverId, productId, boxId, type | String | |
| discrepancyAmount | String | **inconsistent with `amount` below — should almost certainly be Number** |
| closureType | String | |
| isStopScan, isExtra, isNewProduct | Boolean | default `false` |
| discrepancyBatches[] | subdoc array | `batchNo` (Number, default 0), `sku` (String), `productBatchId` (String), `qty`/`wholeSaleValue`/`retailValue`/`scannedQty` (Number, default 0), `isExtra`/`scannedStatus` (Boolean, default false) |
| discrepancyType | String | |
| note | String | |
| photos[] | [String] | |
| status | String | enum `["open","pending","pendingApproval","resolved","rejected"]`, default `"open"` |
| assignedTo | String | |
| dueDate | Number | epoch, used for overdue calc |
| amount | Number | default `0` |
| createdBy | String | |
| createdDate, updatedDate | Number | default `Date.now` |
| activityLogs[] | subdoc array | `status`, `action`, `comment` (String), `photos` ([String]), `updatedBy`/`createdBy` (String), `updatedAt` (Number, default `Date.now`) |
| comments[] | subdoc array | `photos` ([String]), `comment` (String, default ""), `createdAt` (Date, default `Date.now` — **Date, inconsistent with the Number timestamps two fields up in the same document**) |
| additionalNote, resolution, relevantContext, updatedBy | String | |
| additionalPhotos[], evidencePhotos[] | [String] | |

No indexes declared, despite `distributionId`/`status`/`assignedTo` all being filtered on in list endpoints (§15 of main report).

## DistributedBatchesLogs — conn1, collection `distributedProductLogs`
`models/DistributedBatchesLogs.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| productId, distributionId | String | |
| totalQuantity, quantityRemaining | Number | |
| distributedQuantity[] | subdoc array | `subRegionId` (String), `scannedQty` (Number) |
| createdDate, updatedDate | Number | |

No indexes.

## DistributionActivityLogs — conn1, collection `ActivityLog`
`models/DistributionActivityLogs.js`. Options: `{ versionKey: false }`.

| Field | Type | Notes |
|---|---|---|
| action | String | `required: true` — e.g. `"DISTRIBUTION_CREATED"`, `"DAILY_REFILL"` (free-text, not an enum) |
| distributionId, boxId | String | |
| templateId, regionId, subRegionId | ObjectId | no `ref` declared (unlike most other ObjectId fields in this repo) |
| refillId | String | |
| details | Object | untyped/Mixed — "dynamic details (products, qty, etc.)" per its own comment |
| createdDate | Number | default `Date.now` |

No indexes.

## DistributionGlobalSettings — conn1, collection `DistributionGlobalSettings`
`models/DistributionGlobalSettings.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| minProductPerRegion, maxProductPerRegion, minProductPerBox, maxProductPerBox, minQuantityPerProduct, maxQuantityPerProduct, productOrderDays, productExpiringDays, discrepancyResolutionETA | Number | all business-tunable thresholds |
| isRetailer | Boolean | |
| discrepancyTypes[] | [String] | |
| platform | String | enum `['hyperwolf','stilo']`, default `'hyperwolf'` |
| createdBy | String | |
| createdDate, updatedDate | Number | |

No indexes — this is effectively a singleton/settings document per platform, queried with `.findOne()` everywhere it's used (confirmed in `discrepancy-management-controller.js:47`).

## FleetOffDutyCloseout — conn3, collection `FleetOffDutyCloseout`
`models/FleetOffDutyCloseout.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| fleetId | ObjectId | ref `Fleets` |
| closeoutData[] | subdoc array | `closeoutId` (ObjectId, ref `closeOut`), `value` (String) |
| status | String | enum `["pending","approved"]`, default `"pending"` |
| closedBy, closedNotes | String | default `null` |
| cashReconciliation, creditCardReconciliation | Object | default `null`, untyped/Mixed |
| createdDate, updatedDate | Date | default `Date.now` |

Indexes: `{ fleetId: 1 }`, `{ closeoutId: 1 }` (note: the second index targets `closeoutId` at the **top level** of the document, but the actual field only exists nested inside `closeoutData[].closeoutId` — this index likely indexes nothing useful as written, since there is no top-level `closeoutId` field on this schema).

## FleetOnDutyChecklists — conn3, collection `FleetOnDutyChecklists`
`models/FleetOnDutyChecklists.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| fleetId | ObjectId | ref `Fleets` |
| checklistId | ObjectId | ref `OnDutyChecklists` |
| value | String | |
| createdDate, updatedDate | Date | default `Date.now` |

Indexes: `{ fleetId: 1 }`, `{ checklistId: 1 }` (both valid here, unlike the sibling model above).

## Fleets — conn3, collection `Fleets`
`models/Fleets.js`. Options: `{ versionKey: false, minimize: false }`. 27 fields per metrics scan; full list:

| Field | Type | Notes |
|---|---|---|
| fleetName | String | |
| fleetEmail | String | `unique: true` |
| fleetPhone | String | `unique: true` |
| fleetPassword | String | plaintext field name (hashing, if any, happens outside this schema) |
| fleetImage | String | default `defaultFleetImage` = hardcoded S3 URL (see main report §11) |
| fleetTransportationTypeId | ObjectId | ref `TransportationTypes` — **no `TransportationTypes` model exists anywhere in this repo**; this ref points at a model registered by some other service sharing conn3 |
| fleetVehicleDetails | Object | untyped/Mixed, validated by a separate Joi `vehicleDataSchema` (licensePlate, color, year, make, model, insuranceProvider, policyNumber, expirationDate — all optional strings) |
| regionData | Object | `{ regionId: String, regionName: String }` — plain nested object, not an array, not an ObjectId ref |
| locationData | Object | `{ latitude: Number default 0.0, longitude: Number default 0.0 }` |
| terminalData | Object | `{ terminalId: String default "", terminalName: String default "" }` |
| policyFile, idFile | String | |
| fleetOtherInfo | Object | untyped/Mixed |
| fleetVerificationStatus | String | enum `['pending','verified']`, default `'pending'` |
| fleetStatus | String | enum `['inactive','active']` (`validFleetStatus`), default `'active'` — note the separate `getFleetsValidation` Joi schema allows a **third** value, `'pending'`, that the Mongoose enum itself does not — a fleet whose status is validated as `'pending'` at the query layer cannot actually exist as a stored `fleetStatus` value |
| fleetOnDutyStatus, isDeleted | Boolean | default `false` |
| createdBy, deletedBy | ObjectId | ref `Admin` |
| lastLoginDate, createdDate, updatedDate | Date | default `Date.now` (createdDate/updatedDate only; `lastLoginDate` has no default) |

Indexes: `{ fleetEmail: 1 }`, `{ fleetPhone: 1 }` (redundant with the unique constraints above, which already create indexes), `{ regionId: 1 }` (**dead index** — there is no top-level `regionId` field on this schema, only `regionData.regionId`). Plugin: `mongoose-sequence` auto-increment `fleetDisplayId` starting at 1000.

## Inventory — conn1, collection `Inventory`
`models/Inventory.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| inventoryId, regionId | String | |
| createdDate, updatedDate | Number | |

Smallest model in the repo (4 real fields). No indexes.

## KitBoxes — conn1, collection `KitBoxes`
`models/KitBoxes.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| templateId, boxId | String | default `''` |
| minProductValuePerBox, maxProductValuePerBox | Number | `required: false` |
| isActive | Boolean | default `true` |
| createdDate, updatedDate | Number | |

No indexes.

## KitDispatch — conn1, collection `KitDispatch`
`models/KitDispatch.js`. Options: `{ versionKey: false }`.

| Field | Type | Notes |
|---|---|---|
| dispatchType | String | enum `["main","refill"]`, `required: true`, `index: true` |
| kitDistributedId | ObjectId | ref `KitDistributed`, `required: true` |
| distributionId | String | `required: true`, `index: true` |
| refillId | String | default `null` |
| driverId | String | `required: true` |
| regionId | ObjectId | ref `Regions`, `required: true` |
| subRegionId | ObjectId | ref `SubRegions`, `required: true` |
| boxId | String | default `null` |
| dispatchedAt | Number | default `() => Date.now()` |
| dispatchedBy | String | default `null` |
| status | String | enum `["dispatched","cancelled"]`, default `"dispatched"` |

Indexes (well-designed relative to the rest of the repo): `{ subRegionId: 1, dispatchedAt: -1 }`; a **partial unique** index on `{ distributionId, subRegionId, kitDistributedId, dispatchType }` filtered to `dispatchType: "main"`; a second partial unique index on `{ refillId, subRegionId, kitDistributedId }` filtered to `dispatchType: "refill"`. This correctly prevents double-dispatching the same box for the same distribution/refill without a global unique constraint blocking legitimate reuse across types.

## KitDistributed — conn1, collection `KitDistributed`
`models/KitDistributed.js`. Options: `{ versionKey: false }`. **The central, most heavily-nested model in the repo — 63 fields per metrics, no indexes.**

Top level:

| Field | Type | Notes |
|---|---|---|
| templateId | ObjectId | ref `KitTemplate` |
| distributionId | String | "Unique weekly ID" (comment) — **not actually declared unique at the schema level** |
| weekStartDate | Number | comment says `YYYYMMDD` format |
| boxId, kitId | String | |
| allocationType | String | enum `["distribution"]` (single-value enum), default `"distribution"` |
| distributionType | String | sequential label, e.g. `"D-01"` |
| backupRegionData[] | subdoc array | see below |
| regionData[] | subdoc array | see below (structurally near-identical to `backupRegionData[]`, but with 3 extra item-level flags) |
| backupLowStockItems[] | subdoc array, default `[]` | `productId` (String), `subRegion` (ObjectId ref `SubRegions`), `leftover` (Number), `reason` (String) |
| lowStockItems[] | subdoc array, default `[]` | `productId` (String), `regionId` (String — **plain String here, vs. ObjectId in `backupLowStockItems`'s `subRegion` field two lines up: inconsistent ID typing within the same schema**), `leftover` (Number), `reason` (String) |
| refillLowStockItems[] | subdoc array, default `[]` | `refillId`, `productId`, `regionId`, `subRegionId` (String), `refillDay` (Number), `neededQty`/`refilledQty`/`shortfallQty` (Number), `reason` (enum: `"no_stock"`,`"partial_stock"`,`"validation_failed"`,`"box_capacity_shortfall"`,`"box_max_exceeded"`,`"insufficient_stock"`,`"insufficient_stock_for_subregions"`), `refillType` (enum: `"used_replenish"`,`"new_product"`), `date` (Number) |
| distribution | String | enum `["auto","manual"]`, default `"auto"` |
| status | String | enum `["splitting","freeze","distributed"]`, default `"splitting"` — parent lifecycle |
| verificationStatus | String | enum `["pending","completed"]`, default `"pending"` |
| createdDate, updatedDate | Number | |

`regionData[]` / `backupRegionData[]` subdocument shape (identical structure, `regionData[]` adds `isOtherProduct`/`isDispatched` at the item level that `backupRegionData[]` lacks):
- `regionId`, `subRegionId` — ObjectId, ref `Regions`/`SubRegions`
- `driverId` — String
- `status` — enum `["pending","dispatched","hold","paused"]`, default `"pending"`
- `kitId` — String
- `items[]`:
  - `productId`, `boxId` — String
  - `assignedQty`, `expectedQty` — Number
  - `scannedQty`, `lowStockQty`, `usedQty` — Number, default `0`
  - `scannedStatus`, `isNewProduct` — Boolean, default `false`
  - `isRefill` — Boolean, default `false`
  - `isOtherProduct`, `isDispatched` — Boolean, default `false` (**`regionData[]` only, not `backupRegionData[]`**)
  - `updatedAt` — Number
  - `productBatches[]` — `assignedQty`, `expectedQty` (Number), `productBatchId` (String), `batchNo` (Number), `purchaseDate` (Number), `sku` (String), `expirationDate` (Number), `unitCost` (Number), `soldPercentage` (Number), `currentQuantity` (Number, **`regionData[]` only**), `scannedStatus` (Boolean, default false), `scannedQty` (Number, default 0)
  - `productBatchesBlaze[]` — same shape as `productBatches[]` plus `currentQuantity` in both variants
  - `refillLogs[]` — `refillId`, `distributionType` (String), `expectedQty`, `refillDay`, `date`, `refillQty` (Number), `consumedUsedQty`, `usedQty`, `scannedQty`, `discrepancyCount` (Number, default 0), `isNewProduct` (Boolean, default false), nested `productBatches[]`/`productBatchesBlaze[]` (same shape again, third level of nesting), `status` (enum `["packed","verifying","verified","dispatched","hold","paused","pending"]`, default `"packed"`), `verified` (Boolean, default false), `verifiedBy` (String), `verifiedAt` (Number)

This is a 5-level-deep nested document (`KitDistributed` → `regionData[]` → `items[]` → `refillLogs[]` → `productBatches[]`) with the same "batch" shape (assignedQty/expectedQty/productBatchId/batchNo/purchaseDate/sku/expirationDate/unitCost/soldPercentage/scannedStatus/scannedQty, sometimes +currentQuantity) repeated **6 separate times** in this one schema file (`items[].productBatches`, `items[].productBatchesBlaze`, `items[].refillLogs[].productBatches`, `items[].refillLogs[].productBatchesBlaze` — × 2 for `regionData` and `backupRegionData`) with no shared sub-schema factored out, despite Mongoose supporting reusable sub-schemas (as this repo already does elsewhere, e.g. `distributionRefillLogsSchema`'s `refillEntrySchema`).

## KitRefill — conn1, collection `KitRefill`
`models/KitRefill.js`. Options: `{ versionKey: false }`.

| Field | Type | Notes |
|---|---|---|
| refillId | String | `required: true`, `index: true` (non-unique) |
| distributionType | String | default `null`, e.g. `"R-0001"` |
| qty | Number | default `0` |
| updatedBy, deletedBy | String | default `null` |
| previousData[] | subdoc array, default `[]` | `refillId`, `distributionType`, `deletedBy` (String), `totalQty` (Number), `deletedAt` (Number) — delete-history log |
| changes | Object | default `null`; shape `{ previousQty, updatedQty, totalQty }` (Number) |

## KitTemplate — conn1, collection `KitTemplate`
`models/KitTemplate.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| templateId | String | default `''` |
| regionId | ObjectId | **`ref: "Region"` — does not match any registered model** (actual model is `Regions`, plural); see main report §5/§16 |
| subRegionId[] | [ObjectId] | **`ref: "SubRegion"` — same mismatch** (actual model is `SubRegions`) |
| minProductPerRegion, maxProductPerRegion | Number | `required: false` |
| createdBy | String | `required: false` |
| isActive | Boolean | default `true` |
| templateType | String | enum `["distribution","refill"]`, default `"distribution"`, `index: true` |
| platform | String | enum `["hyperwolf","stilo"]`, default `"hyperwolf"` |
| plannerOverrideNotes[] | subdoc array | `updatedBy`, `note` (String), `timestamp` (Number) |
| createdDate, updatedDate | Number | |

Index: `{ regionId: 1, templateType: 1 }` unique — a region can have at most one `distribution`-type and one `refill`-type template.

## ManageDistributions — conn: **none** (0-byte file)
`models/ManageDistributions.js`. Empty. Not referenced anywhere in the codebase (verified: `grep -arln "require.*ManageDistributions.js"` and `grep -arln "require.*models/ManageDistributions"` both return zero hits). The class in `repositories/manageDistributions.repository.js` (`ManageDistributionsRepository`) uses `KitDistributed`, `Discrepancy`, `Regions`, `SubRegions`, `Fleets`, `Boxes`, `Product`, etc. directly instead — this file is a leftover stub.

## Miscellaneous — conn3, collection `Miscellaneous`
`models/Miscellaneous.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| uniqueId | String | |
| data | Mixed | `mongoose.Schema.Types.Mixed` — fully untyped catch-all |
| createdDate, updatedDate | Number | |

No indexes. A generic key-value bucket — used across services sharing conn3 for whatever doesn't have its own model (not resolvable from this repo alone which keys are actually stored here — "not measured").

## OnDutyChecklists — conn3, collection `onDutyChecklists`
`models/OnDutyChecklists.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| title | String | |
| type | String | enum `['text','checkbox']` |
| createdBy | ObjectId | ref `Admin` |
| isActive | Boolean | default `true` |
| isOptional | Boolean | default `false` |
| createdDate, updatedDate | Date | default `Date.now` |

Index: `{ title: 1 }`. 0.97 near-duplicate of `hyperdrive-backend:models/OnDutyChecklists.js` (main report §12) — that sibling uses a bare `mongoose.model()` call instead of `global.dbConnections.conn3.model()`.

## Order — conn3, collection `Order`
`models/Order.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| paymentId, orderId | String | default `''` |
| cuid, email, emailStatus, onFleetTaskId, taskAssignmentMode, splitPaymentMethod, canpay_transaction_id, canpay_intent_id, canpaytransactionIntentId, canpayIntentId, refundType | String |
| status | String | default `'pending'` (no enum declared at schema level — `changeStatusValidation`'s Joi schema restricts the *request* to `'pending'|'completed'|'cancelled'`, but the DB column itself accepts any string) |
| userData, everFlow, cartData, metadata, driverDetails (default `{}`), orderCancellationReason (default `{}`) | Object | all untyped/Mixed |
| createdDate, updatedDate, totalOrders, serviceTime, expectedArrivalTime | Number | |
| isFollowUpMsg, refundStatus, reviewStatus | Boolean | default `false` |
| alpineIQPoints | Number | default `0` — loyalty points, AlpineIQ integration marker |
| canpay_amount | Number | — the one "amount" field on this model, plain `Number`, no currency/cents indication |
| onFleetTriggers | Array | default `[]` |
| fleetId | ObjectId | ref `Fleets` |
| creditTransactionId | String | default `""` |

Indexes: `{ cuid: 1 }`, `{ orderId: 1 }` (both non-unique, despite `cuid` looking like it should be a natural unique key for a customer/cart session).

## ProductBatch — conn3, collection `ProductBatch`
`models/ProductBatch.js`. Options: `{ versionKey: false, minimize: false }`. Smallest real model (3 fields).

| Field | Type | Notes |
|---|---|---|
| productId | String | `required: true` |
| batchData | Array | default `[]`, untyped — the actual batch objects (batchNo/sku/qty/etc., matching the shapes seen inline in `KitDistributed`) are never given a sub-schema here, so Mongoose applies no validation to anything inside |
| safeInventory | Number | |

No indexes (not even on `productId`, the field it's presumably always looked up by).

## Products — conn3, collection `Product`
`models/Products.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| productId | String | `unique: true` |
| status, ordersing (sic — likely a typo for "ordering"), productSlug, brandSlug, productBatchSKU (default ""), strainSlug (default "") | String |
| strainType | String | default `''` |
| infoEffects | Array | default `[]` |
| totalPrice | Number | no cents/currency field distinguishing this from a display-formatted value |
| adminProductName, websiteProductName | String | |
| isSalePrice | Boolean | |
| brandDescription | String | default `''` |
| productData, terpenoids (default `{}`) | Object | untyped/Mixed |
| productTraits, matchedStrains | Array | untyped |

Index: `{ productId: 1 }` (duplicates the implicit unique index already created by `unique: true` — a second, redundant index on the same field).

## Regions — conn1, collection `Regions`
`models/Regions.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| region | String | |
| platform | String | enum `['hyperwolf','stilo']`, default `'hyperwolf'` |
| status | Boolean | default `true` |
| createdDate, updatedDate | Number | |

No indexes.

## RemovedSafeProducts — conn1, collection `RemovedSafeProducts`
`models/RemovedSafeProducts.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| distributionId, subRegionId | String | |
| products | Array | untyped |
| upadtedBy (sic) | String | typo'd field name — persisted as-is in the DB |
| updatedDate | Number | |

No indexes.

## ResetRequest — conn2, collection `ResetRequest`
`models/ResetRequest.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| phone, firstName, lastName, token | String | |
| email | String | default `""` |
| userData | Object | untyped |
| createdDate | Number | |

No indexes, no TTL — a password/PIN reset token collection with no automatic expiry mechanism at the schema level (any expiry must be enforced in application code, not verified from this file alone).

## SubRegions — conn1, collection `SubRegions`
`models/SubRegions.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| name, blazeRegionId, blazeRegionName, nameConvention | String | |
| kmls[] | subdoc array | `filename`, `url` (String), `active` (Boolean, default `true`), `uploadedAt` (Number, default `Date.now`) — delivery-zone map files |
| platform | String | enum `['hyperwolf','stilo']`, default `'hyperwolf'` |
| status | Boolean | default `true` |
| createdDate, updatedDate | Number | |

Index: `{ blazeRegionId: 1, blazeRegionName: 1 }` unique (compound).

## boxProduct (exported as `BoxProduct`) — conn1, collection `BoxProduct`
`models/boxProduct.js`. **No schema options object at all** — this is the only model in the repo that doesn't set `versionKey: false`, so it's the only conn1 collection that gets Mongoose's default `__v` field.

| Field | Type | Notes |
|---|---|---|
| boxId | ObjectId | ref `Boxes` |
| productId | ObjectId | ref `Products` — **case mismatch**: the actual registered model name is `Product` (singular, `models/Products.js:45`), not `Products` — same latent-populate-failure pattern as `KitTemplate`'s region refs |
| createdDate, updatedDate | Number | |

No indexes.

## distributionRefillLogs (exported as `DistributionRefillLogs`) — conn1, collection `DistributionRefillLogs`
`models/distributionRefillLogs.js`. Options: `{ versionKey: false }` at the sub-schema level (`_id: false` on the two nested schemas); no explicit options object on the parent schema (defaults apply, so this collection *does* get `__v` too).

Nested schemas (both `{ _id: false }`, i.e. no per-entry `_id`):
- `refillEntrySchema`: `productId` (ObjectId, required), `soldQty`/`refilledQty`/`totalStock` (Number, default 0), `reason` (String — documented via comment as one of `success|no_stock|insufficient_stock|partial_stock|no_picks`, not a real enum).
- `newProductEntrySchema`: `productId` (ObjectId, required), `distributedQty`/`totalStock` (Number, default 0), `reason` (String — comment-documented, not enforced).

Parent fields:

| Field | Type | Notes |
|---|---|---|
| type | String | enum `["refill","distribution"]`, `required: true`, `index: true` |
| refillId | String | `required: true`, `index: true` |
| distributionType | String | `required: true` |
| refillDay | Number | `required: true`, `index: true` |
| templateId | ObjectId | `required: true`, no `ref` declared |
| distributionId | String | |
| boxId | String | `required: true` |
| regionId, subRegionId | ObjectId | `required: true`, no `ref` declared |
| driverId | ObjectId | default `null` |
| refillEntries[] | [refillEntrySchema] | |
| newProductEntries[] | [newProductEntrySchema] | |
| status | String | enum `["completed","skipped","failed"]`, default `"completed"` |
| skipReason | String | default `null` |
| createdDate | Number | default `() => Date.now()` |

Indexes (the best-designed model in the repo): unique compound `{ refillId, subRegionId, boxId }`; compound `{ refillDay, templateId }`; compound `{ type, refillDay }` — plus the 3 single-field indexes declared inline above.

## regionDriverAssignment (exported as `RegionDriverAssign`) — conn1, collection `RegionDriverAssign`
`models/regionDriverAssignment.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| regionId, subRegionId, driverId | String | |
| status | Boolean | default `false` |
| createdDate, updatedDate | Number | default `Date.now` |

No indexes. Note: the co-located `addRegionsValidation` Joi schema (`models/regionDriverAssignment.js:16-24`) declares the key `closeTime` **twice** (lines 21 and 22, identical) — harmless (the second silently overwrites the first in the object literal) but dead/confusing code.

## templateSku (exported as `KitTemplateSku`) — conn1, collection `KitTemplateSku`
`models/templateSku.js`. Options: `{ versionKey: false, minimize: false }`.

| Field | Type | Notes |
|---|---|---|
| templateId, boxId | String | default `''` |
| products[] | [Object] | `{ type: Object, required: true }` per entry — an array of fully untyped objects, no shape enforced by Mongoose at all |
| platform | String | enum `['hyperwolf','stilo']`, default `'hyperwolf'` |
| createdDate, updatedDate | Number | |

No indexes.

---

## Cross-model observations (rolled up from the field lists above)

- **ID type is inconsistent for the same logical entity across models**: `regionId`/`subRegionId` are `String` on `AgingRules`, `Inventory`, `Discrepancy`, `RemovedSafeProducts`, `regionDriverAssignment`, and inside `KitDistributed.lowStockItems[].regionId` — but `ObjectId` (with `ref`) on `KitDispatch`, `KitTemplate`, `distributionRefillLogs`, and inside `KitDistributed.regionData[].regionId`/`.subRegionId`. Any code that expects to `.populate()` or directly compare one against the other has to know, per-model, which representation it's dealing with.
- **`ref` name mismatches** (silently inert until someone calls `.populate()`): `KitTemplate.regionId` → `ref: "Region"` (actual model: `Regions`); `KitTemplate.subRegionId` → `ref: "SubRegion"` (actual model: `SubRegions`); `boxProduct.productId` → `ref: "Products"` (actual model: `Product`).
- **Timestamp type is split three ways** with no visible rule for which a given model gets: plain `Number` no-default (`Boxes`, `Brand`, `Regions`, `SubRegions`, `KitTemplate`, `KitBoxes`, `AgingRules`, `DistributionGlobalSettings`, `Inventory`, `DistributedBatchesLogs`, `Products`, `RemovedSafeProducts`, `templateSku`, `KitDistributed`); `Number` with `default: Date.now`/`() => Date.now()` (`Discrepancy`, `distributionRefillLogs`, `regionDriverAssignment`, `KitDispatch.dispatchedAt`); real `Date` with `default: Date.now` (`Closeout`, `FleetOffDutyCloseout`, `FleetOnDutyChecklists`, `OnDutyChecklists`, `Fleets`).
- **Two dead/mis-scoped indexes** confirmed by reading the schema they're declared on: `FleetOffDutyCloseout`'s `{ closeoutId: 1 }` (field only exists nested inside `closeoutData[]`, not at the top level) and `Fleets`' `{ regionId: 1 }` (field only exists as `regionData.regionId`, not a top-level `regionId`).
- **One redundant index**: `Products.js` declares an explicit `{ productId: 1 }` index on a field that already has `unique: true` (which itself creates a unique index) — two indexes doing the same job.
- **Typos persisted as real field/schema names**: `Category.categoryName`'s `require: true` (should be `required`, silently a no-op), `RemovedSafeProducts.upadtedBy` (should be `updatedBy`), `Products.ordersing` (likely meant "ordering").
- **No shared sub-schema for the repeated "batch" shape** (`assignedQty`, `expectedQty`, `productBatchId`, `batchNo`, `purchaseDate`, `sku`, `expirationDate`, `unitCost`, `soldPercentage`, `scannedStatus`, `scannedQty`, sometimes `currentQuantity`) that appears independently defined 6 times within `KitDistributed.js` alone, plus again (differently) in `ProductBatch.batchData` (untyped) and `Discrepancy.discrepancyBatches[]` (a 4th independent shape covering similar ground with different field names — `qty`/`wholeSaleValue`/`retailValue` instead of `assignedQty`/`unitCost`).
