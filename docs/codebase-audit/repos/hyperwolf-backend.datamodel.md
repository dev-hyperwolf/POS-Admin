# hyperwolf-backend — Data Model Reference (full detail)

Repo: `/Users/jt/hyper-tech/hyperwolf-backend` @ `cd74550`. All 59 files under `models/` were read
in full. Companion to `hyperwolf-backend.md` (main report) — that file has the summarized version
of §5; this file has every field.

All models are Mongoose schemas. The repo maintains **three separate MongoDB connections**
(`startup/db.js`): `conn1` = `DATABASE_URL` (Hyperwolf DB), `conn2` = `HEMP_DATABASE_URL` (Hemp
DB), `conn3` = `STILO_DATABASE_URL` (Stilo DB), stored on `global.dbConnections`. Every model
calls `global.dbConnections.connN.model(...)` directly at require-time — there is no fallback and
no lazy init; if `startup/db.js` has not finished (or one of the three connection strings is
missing/wrong) before a model file is required, this throws `Cannot read properties of undefined
(reading 'model')` and crashes boot. `models/MainStrain.js` is the sole model with a defensive
null-guard (`global.dbConnections.conn1 ? ... : null`), which is worse in a different way: it
silently exports `null` as the model instead of crashing, so any controller calling
`MainStrain.find()` gets `TypeError: Cannot read properties of null` at request time instead of at
boot — masks the failure until traffic hits it.

## 1. Model index (59 models)

| Model | File | Conn | Fields | Timestamps | Indexes | Tenant/scope field |
|---|---|---|---|---|---|---|
| ActiveCart | models/ActiveCart.js | conn1 | 12 | no (manual `createdDate`/`updatedDate` Number) | none | none (cuid/email only) |
| ActivityLogs | models/ActivityLogs.js | conn1 | 6 | no | none | none |
| Admin | models/Admin.js | conn1 | 6 | no | none | none — this collection IS the tenant (admin users) |
| Announcements | models/Announcements.js | conn1 | 6 | yes, custom names (`createdDate`/`updatedDate` via `timestamps` option) | none | none |
| ApprovalNotifications | models/ApprovalNotifications.js | conn1 | 10 | no (manual Date fields) | 4 (`fleetId`,`isAdminSpecific`,`notificationType`,`adminIds`) | fleetId (ref) |
| Authors | models/Authors.js | **conn2** | 10 | no (manual Number fields) | none | none |
| BRBGraphics | models/BRBGraphics.js | conn1 | 8 | no (manual) | none | regionId (string, not ref) |
| Banners | models/Banners.js | conn1 | 7 | no (manual Number) | none | none |
| BlazeUser | models/BlazeUser.js | conn1 | 11 | no | none | none |
| Brand | models/Brand.js | conn1 | 17 (incl. embedded faqs[]) | no | none | none |
| Break | models/Break.js | conn1 | 9 | no (manual Date) | none (but `breakName` and `fromTime` are `unique: true`) | none |
| CanPayUsers | models/CanPayUsers.js | conn1 | 3 | no | none | none |
| Cannabinoid | models/Cannabinoid.js | conn1 | 18 | no (manual) | none | none |
| CannabinoidBanners | models/CannabinoidBanners.js | conn1 | 6 | no | none | none |
| Category | models/Category.js | conn1 | ~18 (2 duplicate keys, see §4) | no | none | none |
| Distributor | models/Distributors.js | conn1 | 8 | no | none | none |
| Driver | models/Driver.js | conn1 | 3 | no | none | none |
| Employee | models/Employees.js | conn1 | 5 | no | none | none |
| ErrorLog | models/ErrorLogs.js | conn1 | 6 | no (all String, even timestamps) | none | none |
| FailureReason | models/FailureReason.js | conn1 | 7 | no (manual Date) | none | none — has soft delete (`isActive`, `deletedAt`, `deletedBy`) |
| FhlScript | models/FhlScript.js | conn1 | 13 | no (all String, even timestamps) | none | none |
| fleetAccessTokens | models/FleetAccessTokens.js | conn1 | 5 | no (manual Date) | 2 (`fleetId`, `accessToken`) | fleetId (ref) |
| fleetDevices | models/FleetDevices.js | conn1 | 7 | no (manual Date) | 2 (`fleetId`, `fcmToken`) | fleetId (ref) |
| Fleets | models/Fleets.js | conn1 | 19 | no (manual Date) | 3 (`fleetEmail`,`fleetPhone`,`regionId` — **`regionId` index targets a field that does not exist on the schema**, the real field is `regionData.regionId`) | regionData.regionId (string, not ref) — has soft delete (`isDeleted`,`deletedBy`) |
| HempProducts | models/HempProducts.js | **conn2** | 40 (incl. embedded `inventories[]`, `seoData`) | no (manual Number) | none | `inventories[].regionId` (string) |
| HolidayManagement | models/HolidayManagement.js | conn1 | 9 | no (manual) | none | regionId (string, not ref) |
| HyperwolfBlogs | models/HyperwolfBlogs.js | conn1 | 22 (incl. embedded image/faq/relatedBlog) | no (manual `createdDate`/`updatedDate` via defaults) | 3 (`title` unique, `status`+`createdDate`, `category`) | none |
| LedgerGreen | models/LedgerGreen.js | conn1 | 7 | no (all String, even timestamps) | none | none |
| Legal | models/Legal.js | **conn2** | ~20 top-level + 5 embedded sub-schemas | no (manual Number) | none | `platformAvailability` (booleans per brand: hyperwolf/hemp/stilo/all) |
| Log | models/Log.js | conn1 | 4 | no | none | none |
| MainBrand | models/MainBrand.js | conn1 | 9 (incl. duplicate `faq` key, see §4) | no | none | none |
| MainCannabinoid | models/MainCannabinoid.js | conn1 | 9 | no | none | none |
| MainProductTraits | models/MainProductTraits.js | **conn2** | 20 | no (manual) | 2 (`mainTraitName`+`status`, `traitSlug`) | `platformAvailability` |
| MainStrain | models/MainStrain.js | conn1 (null-guarded, see above) | 10 (incl. duplicate `faq` key) | no | none | none |
| Miscellaneous | models/Miscellaneous.js | **conn1 AND conn2** (same schema registered on both) | 4 | no | none | none |
| HyperDriveNotification | models/Notifications.js | conn1 | 9 | no (manual Date) | none | to (Fleets ref) |
| onDutyChecklists | models/OnDutyChecklists.js | conn1 | 7 | no (manual Date) | 1 (`title`) | none |
| Order | models/Order.js | conn1 | 27 | no (manual Number) | 2 (`cuid`, `orderId`) | none — money lives inside untyped `cartData`/`metadata`/`everFlow` Objects, not schema fields |
| OrderManager | models/OrderManager.js | conn1 | 3 | no | none | none |
| OrderTracker | models/OrderTracker.js | conn1 | 4 (incl. deeply nested `slotDetails[].regionData[]`) | no (manual) | none | `slotDetails[].regionData[].dispatchRegionIdBlaze` (string) |
| ProductCarousel | models/ProductCarousel.js | **conn2** | 15 | no (manual) | 3 (compound `platformType+placement+status+createdDate`, text index on `title`, plus inline `index:true` on `platformType`/`placement`/`categories.categorySlug`/`status`) | platformType (enum Hyperwolf/Hemp/Stilo/Other), storeId |
| Product | models/Products.js | conn1 | 18 (incl. embedded faq) | no | 6 (`productData.active`+`sellableQuantities.no_region`, `productData.categoryId`, `productData.brandId`, `productData.productId`, `productTraits.traitKey`, `productTraits.subTraitKey`) | none — money in untyped `productData` Object |
| Promotion | models/Promotions.js | conn1 | 8 | no (manual) | none | none — money/rules in untyped `promotionData` Object |
| Regions | models/Regions.js | conn1 | 4 | no (manual) | none | none — this IS the tenant/region reference table |
| ResetRequest | models/ResetRequest.js | conn1 | 5 | no | none | none |
| ShopTime | models/ShopTime.js | conn1 | 5 (incl. embedded `slots[]`) | no (manual) | none | `slots[].regionId` (string) |
| SlotsCoordinates | models/SlotsCoordinates.js | conn1 | 3 | no | 1 (`coordinates` 2dsphere) | regionId (string) |
| StartTask | models/StartTask.js | conn1 | 8 | no (manual) | none | regionId (string), fleetId (ref) |
| StoreProducts | models/StoreProducts.js | **conn3** | 11 (incl. duplicate `matchedStrains` key, see §4) | no (manual) | 1 (`productTraits`) | storeId (required string) |
| Strain | models/Strain.js | conn1 | 20 — **`productId` field is broken, see §4** | no (manual) | none | none |
| SubProductTraits | models/SubProductTraits.js | **conn2** | 22 | no (manual, but has a `pre('save')` hook that stamps `updatedDate`) | none | `platformAvailability`, `traitId` (ref MainProductTraits) |
| Tasks (`TaskModel`) | models/TasksModel.js | conn1 | 30 | no (manual Date) | none (uses `mongoose-sequence` plugin for `taskDisplayId`) | dispatchRegionId (string), fleetId (ref) |
| TerminalProducts | models/TerminalProducts.js | conn1 | 3 | no | none | none |
| TimeSlot | models/TimeSlot.js | conn1 | 4 (incl. embedded `slots[]`) | no (manual) | none | none |
| TransportationTypes | models/TransportationTypes.js | conn1 | 5 | no (manual Date) | 1 (`name`) | none |
| Truck | models/Trucks.js | conn1 | 8 (incl. embedded `orderingHours[]`) | no | none | zipcode[] (array of strings) |
| User | models/User.js | conn1 | 5 | no | none | none |
| VersionSync | models/VersionSync.js | conn1 | 2 | no | none | none |
| WebCategory | models/WebCategory.js | conn1 | ~16 (2 duplicate `status` keys, see §4) | no (manual) | none | none |

**59 models total.** Timestamps: only 1 of 59 (`Announcements`) uses Mongoose's built-in
`timestamps` option. Every other model that tracks created/updated time does so with a manually
maintained `createdDate`/`updatedDate` field — mostly `Number` (epoch millis via `Date.now()`),
sometimes `Date`, sometimes `String` (ErrorLog, FhlScript, LedgerGreen store timestamps as plain
strings). This is inconsistent across the same repo and makes cross-model date range queries and
sorting unreliable without per-model knowledge of the stored type.

**Soft delete:** only 2 of 59 models have any soft-delete convention — `Fleets` (`isDeleted`,
`deletedBy`) and `FailureReason`/`Announcements` (`isActive`/`deletedAt`/`deletedBy`). Every other
model (57/59) has no soft-delete field at all; controllers that "delete" records on those models
are presumably doing hard `deleteOne`/`findByIdAndDelete` (see main report §12/§15 for verified
examples).

## 2. Relation graph (Mongoose `ref` fields, exhaustive)

| Field | Model | Connection | -> Target |
|---|---|---|---|
| createdBy, updatedBy, deletedBy | Announcements | conn1 | -> Admin |
| fleetId | ApprovalNotifications | conn1 | -> Fleets |
| adminIds[] | ApprovalNotifications | conn1 | -> Admin |
| updatedBy | ApprovalNotifications | conn1 | -> Admin |
| createdBy | Break | conn1 | -> Admin |
| createdBy, updatedBy, deletedBy | FailureReason | conn1 | -> Admin |
| fleetId | FleetAccessTokens | conn1 | -> Fleets |
| fleetId | FleetDevices | conn1 | -> Fleets |
| fleetTransportationTypeId | Fleets | conn1 | -> TransportationTypes |
| deletedBy | Fleets | conn1 | -> Admin |
| author._id | HyperwolfBlogs | conn1 | -> "Author" (**dangling ref** — no model named `Author` exists anywhere in this repo; the real model is `Authors`, registered on **conn2**. A Mongoose ref string is just a label used by `.populate()`, so this ref can never successfully populate — it would need `model('Author')` on the default/conn2 connection, which doesn't exist under that name.) |
| from | HyperDriveNotification | conn1 | -> Admin |
| to | HyperDriveNotification | conn1 | -> Fleets |
| createdBy | onDutyChecklists | conn1 | -> Admin |
| fleetId | Order | conn1 | -> Fleets |
| fleetId | StartTask | conn1 | -> Fleets |
| traitId | SubProductTraits | conn2 | -> MainProductTraits (**cross-connection ref**: SubProductTraits lives on conn2 and refs MainProductTraits which is also conn2 — consistent here, but see §3 for the general hazard) |
| fleetId, multipleFleetIds[] | Tasks | conn1 | -> Fleets |
| createdBy, updatedBy | Tasks | conn1 | -> Admin |
| failureDetails.failureReasonId | Tasks | conn1 | -> FailureReason |

Notably **absent**: `Order` has no ref to `Product`/`HempProducts`/`StoreProducts` (cart contents
live in the untyped `cartData` Object); `Product`/`HempProducts` have no ref to `Brand`/`Category`
(category/brand are duplicated as free-text `categoryName`/`brandName`/`brandSlug` strings on the
product document itself, not foreign keys) — see main report §5 and §12 for the duplication this
causes.

## 3. Multi-tenancy / multi-connection analysis

This single repo (`hyperwolf-backend`) is not single-tenant despite its name — it is the shared
middleware behind three retail brands (Hyperwolf, Hemp, Stilo) and picks which of the three Mongo
databases a document lives in **by model, not by a tenant field on the document**:

- **conn1 (Hyperwolf DB)** — 49 of 59 models. This is the default/catch-all connection; most
  cross-cutting collections (Admin, Fleets, Order, Tasks, Product, Cannabinoid, Strain, Category,
  Promotion, etc.) live here even though some of them (e.g. `Cannabinoid`, `Strain`, `Category`)
  conceptually apply to all three brands' catalogs.
- **conn2 (Hemp DB)** — 7 models: `Authors`, `HempProducts`, `Legal`, `MainProductTraits`,
  `ProductCarousel`, `SubProductTraits`, and one of the two `Miscellaneous` registrations.
- **conn3 (Stilo DB)** — 1 model: `StoreProducts`.

Two things stand out as likely bugs rather than intentional design:

1. **`models/Legal.js` (legal/policy pages) is registered on conn2 (Hemp DB)** from inside the
   *hyperwolf-backend* repo, yet the schema itself has a `platformAvailability: { hyperwolf, hemp,
   stilo, all }` field — i.e. the model's own data shape says "this record may belong to
   Hyperwolf", but every such record physically lives in the Hemp database. Any direct query
   against the Hyperwolf (conn1) database for legal/policy content will find nothing — it is
   silently in Hemp's DB. Confirmed cross-repo: `stilo-backend:models/Legal.js` is a 166-line
   near-identical duplicate (`CROSS-REPO-DUPLICATES.md`), so Stilo has its own separate copy of
   this same collection shape rather than sharing the one in Hemp's DB — meaning "legal pages"
   exist as at least 2-3 independently-maintained copies across repos/databases with no single
   source of truth.
2. **`models/StoreProducts.js` is registered only on conn3 (Stilo DB)** from the *hyperwolf-backend*
   repo, despite having a generic `storeId` field that looks brand-agnostic. If Hyperwolf or Hemp
   stores also need a `StoreProducts` document, this file cannot serve them — they'd need their own
   copy (and indeed `hemp-backend`/`stilo-backend` are separate repos with their own `models/`).
3. **`models/Miscellaneous.js` registers the *same* schema on both conn1 and conn2** (`Miscellaneous`
   and `MiscellaneousConn2`, models/Miscellaneous.js:12-13) — this is the one place in the repo that
   explicitly acknowledges the 3-DB split and provides both connections' models under separate
   export names. No model does the conn3 equivalent, and no other model in the repo follows this
   pattern, which suggests the multi-DB problem was solved ad hoc per model as it came up, not with
   a general strategy.
4. **Every model uses `global.dbConnections.connN.model(...)` — none uses plain `mongoose.model()`**,
   so there is no example of the "ambiguous default connection" risk itself; the risk instead is the
   boot-order / null-guard issue described above the table, and the fact that connection choice is
   hardcoded per model file with no central registry documenting *why* a given model is on conn1 vs
   conn2 vs conn3 — the only way to know is to open each file.

## 4. In-repo schema bugs and near-duplicate schemas

**Bugs (verified, not just duplication):**
- `models/Category.js:5,14` — `categoryName` is defined twice as an object key in the same schema
  literal (a commented-out `required: true, unique: true` version at line 5, and a plain
  `String` at line 14). In JS, the second literal wins silently — the constraint is dead, not
  enforced. Also `models/Category.js:18,38` — `status` is defined twice (`String, default: false`
  at line 18 vs `String, default: "Draft"` at line 38); again the second wins, so `status` is
  effectively `{ type: String, default: "Draft" }` and the boolean-looking first default is dead
  code that would mislead any developer scanning the top of the file.
- `models/WebCategory.js:6,7` and `:39` — `webCategoryName` (unique) exists alongside a near-twin
  `categoryName` (also unique) with no documented distinction; `status` is likewise defined twice
  (String with no default at line 17, then `{type: String, default: "Draft"}` at line 39) — same
  dead-first-definition bug as Category.
- `models/MainBrand.js:17,20` and `models/MainStrain.js:21,24` — `faq: Array` is declared twice
  verbatim in the same schema object. Harmless (identical redefinition) but signals copy-paste
  without review.
- `models/StoreProducts.js:10,12` — `matchedStrains` declared twice (`{type:Array,default:[]}`
  then bare `Array`); the second silently overrides the default.
- `models/Strain.js:20` — `productId: Joi.string().allow(null, ''),` — a **Joi validator chain
  used as a Mongoose field-type definition**, inside a `new mongoose.Schema({...})` call that
  otherwise uses plain Mongoose type syntax throughout. This is almost certainly a copy-paste
  error from one of the `Joi.object({...})` validation blocks elsewhere in the same file. Mongoose
  will not use it as an ObjectId/String/etc. type; at minimum `productId` does not behave as a
  normal typed field, and depending on Mongoose 5's handling of an object with no recognizable
  `type` key, it likely gets treated as a nested subdocument matching the (irrelevant) shape of a
  Joi validator instance. Any code trying to read/write `document.productId` as a plain string id
  should be treated as suspect until verified against actual production data.
- `models/Fleets.js:71` — index `fleetSchema.index({ regionId: 1 })` targets a top-level `regionId`
  field that does not exist on the schema (the actual field is the nested `regionData.regionId`,
  models/Fleets.js:40-42). The index is therefore indexing a field that is always `undefined` on
  every document — dead index, and any query planner hint expecting region-based lookups on
  `Fleets` to be indexed is wrong.
- `models/HyperwolfBlogs.js:41` — `author._id: { ref: "Author" }` references a model name
  (`"Author"`, singular) that is never registered anywhere in the codebase; the actual model is
  `Authors` (plural, models/Authors.js:44, registered on conn2). `.populate('author._id')` on a
  blog document will always fail/return null for this path.

**Near-duplicate schemas within this repo** (by field-name/shape overlap):
- `Product` (models/Products.js, conn1) vs `HempProducts` (models/HempProducts.js, conn2) — both
  are "catalog product" documents with overlapping fields (`productId`, `productSlug`,
  `brandSlug`, `strainType`, `strainSlug`, `matchedStrains`, `productTraits`, `metaTitle`,
  `metaDescription`, `faq`). `HempProducts` additionally carries pricing/inventory fields
  (`productPrice`, `unitPrice`, `salePrice`, `totalQuantity`, `holdQuantity`, `inventories[]`)
  that `Product` does not have inline (Product instead nests everything Blaze-sourced under the
  untyped `productData` Object and indexes into that Object's dotted paths, e.g.
  `productSchema.index({ "productData.active": 1, ... })`, models/Products.js:38-43). Two
  different shapes for conceptually the same "a product in a store" entity, on two different
  databases, is the in-repo mirror of the cross-repo `HempProducts` duplication already flagged in
  `CROSS-REPO-DUPLICATES.md` (0.96 similarity vs `hemp-backend:models/HempProducts.js`).
- `ShopTime` (models/ShopTime.js) vs `TimeSlot` (models/TimeSlot.js) — near-identical shape: both
  key on a `day` enum of the seven weekday names and hold an embedded `slots[]` array with
  open/close time strings and a `slotId`. `ShopTime.slots[]` adds `regionId`/`regionName`/
  `isClosed`; `TimeSlot.slots[]` adds `overallOrderLimit`. Two collections for what looks like one
  concept (a weekly schedule with per-slot data) that has organically forked into two models with
  two sets of routes/controllers (`routes/admin/shop-time-routes.js` and
  `routes/admin/time-slot-routes.js` — see main report §12).
- `BRBGraphics` (models/BRBGraphics.js) vs `HolidayManagement` (models/HolidayManagement.js) —
  identical embedded `mediaSchema` (mediaType enum image/video, imageUrl with the same regex
  validator, description, title, altText) copy-pasted verbatim between the two files, then each
  wraps it in a near-identical outer schema (`regionId`, `regionName`, `desktopImages`,
  `mobileImages`, `createdBy`, `updatedBy`, `createdDate`, `updatedDate`). This is the same
  "region + before/after-hours graphic" concept duplicated for two different features (closed
  ("break room banner"/BRB) vs holiday closures) instead of one media-sub-schema module imported
  twice.
- `MainBrand` / `MainCannabinoid` / `MainStrain` (models/MainBrand.js, MainCannabinoid.js,
  MainStrain.js) — three files with the same shape: `metaTitle`, `metaDescription`, `description`,
  `image`, `title`, `createdBy`, `createdDate`, `canonical`, plus one brand-specific name field
  (`name`/`cannabinoidName`/`strainName`) and a duplicated `faq` key (see bug list above). These
  three could be one parameterized schema factory; instead each is hand-copied with its own
  independent bugs (only `MainBrand`/`MainStrain` have the duplicate-`faq` bug; `MainCannabinoid`
  does not, showing the copies have already drifted).

## 5. Money field type audit

No model in this repo defines a dedicated, typed "money" field with a documented unit (cents vs
dollars). The closest are: `HempProducts.productPrice/unitPrice/salePrice/purchasePrice/margin`
(all plain `Number`, models/HempProducts.js:8,13-14,46-47 — no comment or convention indicating
cents or dollars), `Products.totalPrice` (plain `Number`, models/Products.js:17), and
`Tasks.totalDiscount/totalTax/creditCardFee` (plain `Number`, models/TasksModel.js:77,94,98). Every
other money-shaped value observed in this repo — cart totals, order totals, promotion pricing
rules, payment intents — is **not a schema field at all**; it lives inside untyped
`Object`/`Mixed` fields: `Order.cartData`, `Order.metadata`, `Order.everFlow`, `Order.customTotal`
(this one IS a typed `Number`, models/Order.js:26), `Promotion.promotionData`,
`Product.productData`, `ActiveCart.cartData`/`customTotal`. This means Mongoose provides **zero
schema-level validation** on the majority of monetary data moving through this service — no type
check, no range check, no required-field check — for anything nested inside those Object fields.
