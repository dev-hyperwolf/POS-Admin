# hemp-backend — data model (field by field)

Repo: `/Users/jt/hyper-tech/hemp-backend` @ `4725d37585b0cfd01a64089df63a8e3c2b95680e`.
All paths are relative to the repo root. Companion to `hemp-backend.md`.

## How this file was produced

Every `models/*.js` file was read; the tables below are a mechanical extraction of each
`new mongoose.Schema({...})` literal, with the source line number for each key. Nested
sub-document schemas (`Legal`, `HempBlogs`, `Authors`, `MainProductTraits`, `Tax`,
`RoleAndPermissions`, `OrderTracker`, `ProductBatch`, `HempProducts.inventories`) are declared
as separate `Schema` objects or inline arrays; their inner keys appear in the same table at
their own line numbers. For `ActiveCart` the extractor also picks up the option keys of the
two `schema.index(...)` calls (lines 44/45/51/52) — those are index options, not fields.

## Counts (verified, not from the metrics pass)

- `models/*.js` files: **56**  (`ls models/*.js | wc -l`)
- `mongoose.model(...)` / `model(...)` registrations: **56** — the metrics pass said 55; it
  missed `models/BlazeUser.js:19` (`const BlazeUser = model("BlazeUser", ...)`, destructured
  `model` rather than `mongoose.model`).
- Total lines across `models/`: **2,095** for 56 models — i.e. the schema layer is 5.6% of the
  37,254 source lines, while `controllers/` is 29,855 (80%). Business rules live in controllers.

## Cross-cutting conventions

| Concern | What the code actually does | Evidence |
|---|---|---|
| Primary key | Mongo `_id` (ObjectId) plus a **second, application-generated string id** per entity (`memberId`, `orderId`, `productId`, `retailerId`, `storeId`, `promotionId`, `ruleId`, `traitId`…). Almost every query uses the string id, not `_id`. | `common/utils.js:222-228` `generateUniqueId()` — 20 chars from `Math.random()` |
| Id generation | `Math.random()`, not `crypto`. `generateResetToken()` (100 chars) uses the same generator and is the **password-reset token**. | `common/utils.js:213-228` |
| Order id | `ORD-#####`, derived by reading the newest order and incrementing — a read-then-write with no uniqueness constraint and no lock. | `common/utils.js:230-249`; `models/Order.js` has no index on `orderId` |
| Timestamps | Hand-rolled `createdDate` / `updatedDate` as **epoch-millisecond `Number`**, set by controllers. Mongoose `timestamps:` is used in exactly **one** model. | `models/RoleAndPermissions.js:44` is the only `timestamps` usage |
| Time type inconsistency | `Number` (ms) in most models; **`String`** in `ErrorLogs.js:8-10`, `FhlScript.js:13-17`, `Log.js:8`; **`Date`** in `Promotions.js:19-20` (`startDate`/`endDate`). Three representations of a timestamp in one database. | `models/ErrorLogs.js:8`, `models/Promotions.js:19` |
| Money | **`Number`** (JS double) throughout, in **dollars**, not cents. `unitPrice`, `salePrice`, `total`, `subTotal`, `walletAmount`, `taxRate`, `discountAmount`, `netProfit`. Rounding is done ad hoc, e.g. `Math.round(x*100)/100` and `.toFixed(2)` producing a **String** assigned to a Number field. | `models/HempProducts.js:8,15,16`; `models/Order.js:45-49`; `controllers/cart/cart-controllers.js:2837` `(...).toFixed(2)` assigned to `member.walletAmount` |
| Soft delete | **None.** No `deletedAt` / `isDeleted` field exists in any model. Deletes are hard: `Admin.deleteOne`, `Admin.deleteMany`, `ActiveCart.deleteMany`, `ResetRequest.deleteOne`. | `controllers/admin/admin-user-controller.js:308,523`; `controllers/cart/cart-controllers.js:2763` |
| Multi-tenancy key | `retailerId` (this repo) / `storeId` (the Stilo fork). Plain `String`, **no index anywhere**, **never derived from the caller** — it is supplied in the request body/query. | `models/Member.js:39`, `models/Order.js:52`, `models/Approvals.js:6`, `models/RetailerProducts.js:5` |
| Brand/platform key | A repeated inline object `{hyperwolf, hemp, stilo, (hyperdrive), (pos), all}` copy-pasted into 4 schemas instead of a shared sub-schema. | `models/Legal.js:124-129`, `models/MainProductTraits.js:52-57`, `models/SubProductTraits.js:32-37`, `models/RoleAndPermissions.js:25-31` |
| Enums | Only 6 models declare any `enum`. Every other status is a free `String` or a `Boolean`, and `status` means different things per model (`String` "active"/"Inactive" on some, `Boolean` on others, `String` defaulted to the **boolean** `false` on `Brand`/`Category`). | `models/Brand.js:10` `status: { type: String, default: false }` |
| Relations | **No `ref` / `populate` anywhere except two places.** Joins are done by string-id lookups in application code. | refs exist only at `models/SubProductTraits.js:9` (`ref: 'MainProductTraits'`) and `models/HempBlogs.js:40` (`ref: "Author"`, pointing at a model registered as **`Authors`**, so `populate` on it would throw) |
| Denormalisation | Orders and carts embed a **whole product snapshot** per line item (`items: Array` of `{product: {...}}`) and a whole member snapshot (`userData: Object`). No schema on either. | `models/Order.js:15,17`; `models/ActiveCart.js:9,12` |
| Schema-less escape hatches | `Miscellaneous.data` is `Mixed` and is used as a key–value store for payment gateway selection, signup gating, product disclaimers, refund settings and the Blaze token. | `models/Miscellaneous.js:6`; consumers at `common/utils.js:810`, `controllers/common-controllers.js:750,790,829` |

## Index coverage vs. the queries actually made

Total indexes in the schema layer: **6 explicit `.index()` calls** (2 on `ActiveCart`, 3 on
`HempBlogs`, 1 `2dsphere` on `StoreCoordinates`) plus the implicit unique indexes created by
33 `unique: true` declarations. Everything else is a collection scan.

| Collection | Fields actually queried (call-site counts from `grep -a`) | Indexed? |
|---|---|---|
| `Order` | `orderId` ×21, `memberId` ×10, `sessionId`, `trackingId`, `shipStationOrderId`, `emailStatus`, plus `createdDate` range scans in every one of the 12 dashboard aggregations | **NONE.** `models/Order.js` declares zero indexes and zero `unique`. |
| `Member` | `memberId` ×16, `email` ×11, `phone` ×8, `status`, `diditSessionId` | only `phone` (`models/Member.js:13`) |
| `HempProducts` | `productId` ×41, `sku`, `productSlug`, `status`, `inventories.inventoryId`, `holdQuantity` | `productId`, `sku` (both `unique`) — the rest unindexed |
| `ActivityLog`, `ErrorLog`, `Log`, `NotificationData`, `Promotion`, `RetailerProducts`, `Approvals`, `Miscellaneous` | queried by `uniqueId`, `retailerId`, `orderId`, `promotionId`, `status` | none |

`models/HempProducts.js:7` — `sku: { type: String, default: '', unique: true }`. A unique index
on a field whose default is the empty string: the **second** product saved without a SKU
collides with the first and the save fails with E11000. Same shape at
`models/Category.js:13` (`categoryId`, plus the `require:` typo below).

## Schema defects found while reading

| Defect | Location | Effect |
|---|---|---|
| `require: true` instead of `required: true` (8 occurrences) | `models/ActiveCart.js:6,8,9,26,27`; `models/Category.js:6,13`; `models/WebCategory.js:6` | Mongoose ignores the unknown option silently. These fields are **not** required. |
| Duplicate key `shippingCharges` declared twice | `models/ActiveCart.js:14` and `:16` | The second wins; the first (`Number` with no default) is dead. |
| Duplicate key `permissions` at two nesting levels | `models/RoleAndPermissions.js:8` (inside `PermissionDetailSchema`) and `:33` | Confusing but not a runtime bug — different schemas. |
| `deafult` typo instead of `default` (3 occurrences) | `models/HempProducts.js:51,52,53` (`productPlatform`, `productBarCode`, `productQRCode`) | No default is applied; fields are `undefined` rather than `[]`/`""`. |
| `.method` instead of `.methods` + arrow function `this` | `models/BlazeUser.js:16-18` | `generateUserToken` is never attached to documents, and its `this.userData` would be the module scope anyway. It is also never called. Dead. |
| JWT secret fallback to a literal | `models/BlazeUser.js:5` — `process.env.JWT_USER_PRIVATE_KEY \|\| "private"` | If the env var is unset the signing key is a hardcoded, guessable string. (This code path is dead today; the pattern is the risk.) |
| One JWT secret for four identity types | `models/Admin.js:22`, `models/RetailerUser.js:34`, `models/StoreUser.js:35`, `models/Retailer.js:48` all sign with `JWT_ADMIN_PRIVATE_KEY` | A `StoreUser` token is signature-valid against `middlewares/admin.js:13`. Only `middlewares/isSuperAdmin.js` re-checks the `Admin` collection, and it guards 4 routes. |
| Payment gateway secret stored in plaintext in Mongo | `models/PaymentSetting.js:6` `paymentSecretId` | The NMI secret is a normal string column with no encryption, and it is regex-searched in `controllers/retailer-settings/payment-controllers.js:107`. |
| Government-ID fields with no access control | `models/Member.js:18-21` (`licenseNumber`, `idImage`, `recId`), `:9` (`dob`) | Returned in full by `GET /api/v1/member/:id`, which has no authentication (see main report §14). |
| Email regex misses a literal dot | `models/Retailer.js:14`, `models/Store.js:14` (commented out), `models/BranchSetting.js:11` — `(.\w{2,3})+` | `.` is unescaped, so `a@b_xx` validates. |
| Phone regex is `/\d{10}/` (unanchored) | `models/Retailer.js:24`, `models/Store.js:24`, `models/StoreUser.js:16`, `models/RetailerUser.js:16`, `models/BranchSetting.js:20` | Any string containing 10 consecutive digits passes. |

## Ten most central models

`HempProducts` · `Order` · `ActiveCart` · `Member` · `Promotion` · `ProductBatch` ·
`RetailerProducts` · `Store` / `Retailer` · `RoleAndPermissions` · `Miscellaneous`.
Relation edges (all string-id, none enforced by Mongo):

```
Member.memberId ──< Order.memberId ──> Order.items[].product.productId ──> HempProducts.productId
Member.memberId ──1 ActiveCart.memberId (unique, partial)   ActiveCart.sessionId ──> Order.sessionId
HempProducts.productId ──1 ProductBatch.productId ──< ProductBatch.batchData[].productBatchId
HempProducts.inventories[].inventoryId ──> Inventory.inventoryId ──> Region.regionId
Retailer.retailerId ──< RetailerUser.retailerId, RetailerProducts.retailerId, TaxSettings.retailerId,
                        BranchSetting.retailerId, PaymentSetting.retailerId, UserRolesPermissions.retailerId
Store.storeId ──< StoreUser.storeId, StoreCoordinates.storeId
Admin.userRoles[] ──> RoleAndPermissions.role.roleName        (string-name join, no id)
Promotion.promotionId ──> Order.promotionData.promotionId / Order.productPromo.promotionId
Authors._id ──> HempBlogs.author._id   (declared ref: "Author"; the model is registered as "Authors")
```

---

# Full schemas

## ActiveCart  
`models/ActiveCart.js` · 72 lines · collection `activecarts` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 6 | `memberId` | `{ type: String, require: true }` |
| 7 | `sessionId` | `{ type: String }` |
| 8 | `email` | `{ type: String, require: true }` |
| 9 | `cartData` | `{ type: Object, require: true }` |
| 10 | `deliveryAddress` | `Object` |
| 11 | `afterTaxDiscount` | `Number` |
| 12 | `memberData` | `Object` |
| 13 | `paymentOption` | `String` |
| 14 | `shippingCharges` | `Number` |
| 15 | `shippingType` | `{ type: String, default: "standard" }` |
| 16 | `shippingCharges` | `{ type: Number, default: 0 }` |
| 17 | `walletAmount` | `Number` |
| 18 | `walletPointsUsed` | `Number` |
| 19 | `activeMemberWallet` | `Number` |
| 20 | `taxResult` | `Object` |
| 21 | `subTotal` | `Number` |
| 22 | `total` | `Number` |
| 24 | `reminderSent` | `{ type: Number, default: 0 }` |
| 25 | `holdReset` | `{ type: Number, default: 0 }` |
| 26 | `createdDate` | `{ type: Number, require: true }` |
| 27 | `updatedDate` | `{ type: Number, require: true }` |
| 28 | `promotionData` | `{ type: Array, default: [] }` |
| 29 | `availablePromos` | `{ type: Array, default: [] }` |
| 30 | `invalidCodes` | `{ type: Array, default: [] }` |
| 31 | `currentPromos` | `{ type: Array, default: [] }` |
| 32 | `promoMessages` | `{ type: Array, default: [] }` |
| 33 | `errorMessages` | `{ type: Array, default: [] }` |
| 34 | `totalDiscount` | `{ type: Number, default: 0 }` |
| 35 | `upsell` | `{ type: Object, default: null }` |
| 44 | `unique` | `true` |
| 45 | `partialFilterExpression` | `{ memberId: { $type: "string", $ne: "" } }` |
| 51 | `unique` | `true` |
| 52 | `partialFilterExpression` | `{ sessionId: { $type: "string", $ne: "" } }` |

- schema options: `see file` · `timestamps`: no
- explicit `.index()` calls: 2  
  - models/ActiveCart.js:41 `activeCartSchema.index(`
  - models/ActiveCart.js:48 `activeCartSchema.index(`
- `unique: true` declarations (each creates a unique index): 2 — at models/ActiveCart.js:44, models/ActiveCart.js:51

## ActivityLog  
`models/ActivityLog.js` · 15 lines · collection `activitylogs` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `source` | `{ type: String, default: '' }` |
| 6 | `logsType` | `{ type: String, default: '' }` |
| 7 | `updatedBy` | `{ type: String, default: '' }` |
| 8 | `newChanges` | `{ type: mongoose.Schema.Types.Mixed }` |
| 9 | `previousChanges` | `{ type: mongoose.Schema.Types.Mixed }` |
| 10 | `createdDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## Admin  
`models/Admin.js` · 27 lines · collection `admins` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 6 | `firstName` | `String` |
| 7 | `lastName` | `String` |
| 8 | `name` | `String` |
| 9 | `email` | `String` |
| 10 | `password` | `String` |
| 11 | `phone` | `String` |
| 12 | `status` | `String` |
| 13 | `userRoles` | `Array` |
| 14 | `createdDate` | `Number` |
| 15 | `lastLogin` | `Number` |
| 16 | `stores` | `Array` |
| 17 | `isSuperAdmin` | `{ type: Boolean, default: false }` |
| 18 | `deviceToken` | `{ type: Array, default: [] }` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## Approvals  
`models/Approvals.js` · 27 lines · collection `approvalss` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 4 | `approvalId` | `{ type: String, required: [true, 'Approval ID is required'], unique: true, trim: true }` |
| 5 | `productId` | `{ type: String, required: [true, 'Product ID is required'], unique: true, trim: true }` |
| 6 | `retailerId` | `{ type: String, required: [true, 'Retailer ID is required'], trim: true }` |
| 7 | `productName` | `{ type: String, default: "" }` |
| 8 | `overrideProductName` | `{ type: String, default: "" }` |
| 9 | `productImage` | `{ type: String, default: "" }` |
| 10 | `sku` | `{ type: String, default: "" }` |
| 11 | `brandName` | `{ type: String, default: "" }` |
| 12 | `categoryName` | `{ type: String, default: "" }` |
| 13 | `productPlatform` | `{ type: Array, default: ['ecommerce'] }` |
| 14 | `isAccept` | `{ type: Boolean, default: false }` |
| 15 | `isDeclined` | `{ type: Boolean, default: false }` |
| 16 | `declinedReason` | `{ type: String, default: "" }` |
| 17 | `isOverride` | `{ type: Boolean, default: false }` |
| 18 | `status` | `{ type: String, default: "" }` |
| 19 | `totalQuantity` | `{ type: Number, default: 0 }` |
| 20 | `unitPrice` | `{ type: Number, default: 0 }` |
| 21 | `createdDate` | `{ type: Number, default: Date.now }` |
| 22 | `updatedDate` | `{ type: Number, default: Date.now }` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 2 — at models/Approvals.js:4, models/Approvals.js:5

## Authors  
`models/Authors.js` · 47 lines · collection `authorss` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `platform` | `{type: String,required: true,trim: true,}` |
| 6 | `link` | `{type: String,required: true,trim: true}` |
| 7 | `status` | `{type: Boolean,default: true}` |
| 8 | `imageUrl` | `{type: String,trim: true}` |
| 15 | `url` | `{type: String,required: true,trim: true,}` |
| 16 | `title` | `{type: String,trim: true}` |
| 17 | `description` | `{type: String,trim: true}` |
| 18 | `alt` | `{type: String,trim: true}` |
| 25 | `image` | `imageSchema` |
| 26 | `name` | `{ type: String, required: true, trim: true }` |
| 27 | `description` | `{ type: String }` |
| 28 | `socialMediaLinks` | `[socialMediaLinkSchema]` |
| 29 | `createdBy` | `{ type: String, trim: true }` |
| 30 | `createdDate` | `{ type: Number, default: Date.now }` |
| 31 | `updatedDate` | `{ type: Number, default: Date.now }` |
| 32 | `slug` | `{ type: String}` |
| 33 | `authorSlugArray` | `{type: Array}` |
| 34 | `canonical` | `{ type: String}` |
| 39 | `versionKey` | `false` |
| 40 | `minimize` | `true   ` |

- schema options: `{
    versionKey: false,   // removes __v
    minimize: true   ,// removes empty objects from DB
  }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## Banners  
`models/Banners.js` · 15 lines · collection `bannerss` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 4 | `desktop_image` | `String` |
| 5 | `mobile_image` | `String` |
| 6 | `media_type` | `String` |
| 7 | `url` | `String` |
| 8 | `banner_position` | `{ type: String, default: '' }` |
| 9 | `createdDate` | `Number` |
| 10 | `updatedDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## BlazeUser  
`models/BlazeUser.js` · 21 lines · collection `blazeusers` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 8 | `email` | `String` |
| 9 | `userData` | `{ type: Object, default: {} }` |
| 10 | `fhlOtp` | `String` |
| 11 | `personaUid` | `String` |
| 12 | `sessionToken` | `String` |
| 13 | `inquiryId` | `String` |

- schema options: `{ versionKey: false, minimize: true }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## Blog  
`models/Blog.js` · 21 lines · collection `blogs` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 4 | `blogId` | `String` |
| 5 | `blogName` | `String` |
| 6 | `metaTitle` | `String` |
| 7 | `metaDescription` | `String` |
| 8 | `description` | `String` |
| 9 | `image` | `String` |
| 10 | `title` | `String` |
| 11 | `status` | `{ type: Boolean, default: true }` |
| 12 | `title2` | `String` |
| 13 | `slug` | `String` |
| 14 | `canonical` | `String` |
| 15 | `tags` | `Array` |
| 16 | `createdBy` | `String` |
| 17 | `createdDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## BranchSetting  
`models/BranchSetting.js` · 34 lines · collection `branchsettings` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 4 | `branchId` | `{ type: String, required: [true, 'Branch ID is required'], unique: true, trim: true }` |
| 5 | `branchName` | `{ type: String, required: [true, 'Branch Name is required'], trim: true }` |
| 6 | `retailerId` | `{ type: String, required: [true, 'Retailer ID is required'], trim: true }` |
| 7 | `email` | `{` |
| 16 | `phone` | `{` |
| 25 | `kml` | `{ type: String, default: "", trim: true }` |
| 26 | `status` | `{ type: Boolean, default: true }` |
| 27 | `address` | `{ type: Object, default: {} }` |
| 28 | `createdDate` | `{ type: Number, default: Date.now }` |
| 29 | `updatedDate` | `{ type: Number, default: Date.now }` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 3 — at models/BranchSetting.js:4, models/BranchSetting.js:8, models/BranchSetting.js:17

## Brand  
`models/Brand.js` · 56 lines · collection `brands` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `brandId` | `String` |
| 6 | `brandName` | `String` |
| 7 | `metaTitle` | `String` |
| 8 | `metaDescription` | `String` |
| 9 | `description` | `{ type: String, default: "" }` |
| 10 | `status` | `{ type: String, default: false }` |
| 11 | `image` | `String` |
| 12 | `createdBy` | `String` |
| 13 | `createdDate` | `Number` |
| 14 | `updatedDate` | `Number` |
| 15 | `description_left_side` | `String` |
| 16 | `description_right_side` | `String` |
| 17 | `brandHeading` | `{ type: String }` |
| 18 | `brandSlugArray` | `{ type: Array, default: [] }` |
| 19 | `brand_left_side` | `{ type: Array, default: [] }` |
| 20 | `brand_right_side` | `{ type: Array, default: [] }` |
| 21 | `isBestBrand` | `{ type: Boolean, default: false }` |
| 22 | `isPopularBrand` | `{ type: Boolean, default: false }` |
| 23 | `title2` | `String` |
| 24 | `subBrandSlug` | `String` |
| 25 | `brandSlug` | `String` |
| 26 | `canonical` | `String` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## Cannabinoid  
`models/Cannabinoid.js` · 70 lines · collection `cannabinoids` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `cannabinoidId` | `String` |
| 6 | `cannabinoidName` | `{ type: String, required: true, unique: true, trim: true }` |
| 7 | `status` | `{ type: Boolean, default: false }` |
| 8 | `tags` | `{ type: Array, default: [] }` |
| 9 | `title` | `String` |
| 10 | `description` | `String` |
| 11 | `description1` | `String` |
| 12 | `description2` | `String` |
| 13 | `listImage` | `String` |
| 14 | `detailImage` | `String` |
| 15 | `canonical` | `String` |
| 16 | `metaTitle` | `String` |
| 17 | `cannabinoidHeading` | `String` |
| 18 | `cannabinoidSlugArray` | `Array` |
| 19 | `detailImageAlt` | `{ type: String, default: "" }` |
| 20 | `listImageAlt` | `{ type: String, default: "" }` |
| 21 | `metaDescription` | `String` |
| 22 | `cannabinoidSlug` | `String` |
| 23 | `createdBy` | `String` |
| 24 | `createdDate` | `{ type: Number, default: Date.now }` |
| 25 | `updatedDate` | `{ type: Number }` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 1 — at models/Cannabinoid.js:6

## CannabinoidBanners  
`models/CannabinoidBanners.js` · 14 lines · collection `cannabinoidbannerss` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 4 | `desktop_image` | `String` |
| 5 | `mobile_image` | `String` |
| 6 | `media_type` | `String` |
| 7 | `url` | `String` |
| 8 | `createdDate` | `Number` |
| 9 | `updatedDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## CartRules  
`models/CartRules.js` · 14 lines · collection `cartruless` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 4 | `ruleId` | `String` |
| 5 | `ruleType` | `{ type: String, default: "" }` |
| 6 | `minAmt` | `{ type: Number, default: 0 }` |
| 7 | `maxAmt` | `{ type: Number, default: 0 }` |
| 8 | `createdDate` | `Number` |
| 9 | `updatedDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## Category  
`models/Category.js` · 50 lines · collection `categorys` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 6 | `categoryName` | `{ type: String, require: true, unique: true }` |
| 7 | `categoryMenuName` | `{ type: String }` |
| 8 | `categoryHeading` | `{ type: String }` |
| 9 | `categoryImage` | `{ type: String, default: "" }` |
| 10 | `categorySlugArray` | `{ type: Array, default: [] }` |
| 11 | `status` | `{ type: String, default: false }` |
| 12 | `category` | `Object` |
| 13 | `categoryId` | `{ type: String, require: true, unique: true }` |
| 14 | `description` | `String` |
| 15 | `image` | `String` |
| 16 | `metaTitle` | `String` |
| 17 | `categorySlug` | `String` |
| 18 | `metaDescription` | `String` |
| 19 | `heading` | `String` |
| 20 | `canonical` | `{ type: String, default: "" }` |
| 21 | `bottomText` | `{ type: String, default: "" }` |
| 22 | `bannerImage` | `String` |
| 23 | `productInstructions` | `String` |
| 24 | `faq` | `{ type: Array, default: [] }` |
| 25 | `createdBy` | `String` |
| 26 | `createdDate` | `Number` |
| 27 | `updatedDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 2 — at models/Category.js:6, models/Category.js:13

## Employee  
`models/Employees.js` · 26 lines · collection `employees` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `name` | `String` |
| 6 | `email` | `String` |
| 7 | `phone` | `String` |
| 8 | `password` | `String` |
| 9 | `createdDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## ErrorLog  
`models/ErrorLogs.js` · 16 lines · collection `errorlogs` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `reqBody` | `String` |
| 6 | `errorMsg` | `String` |
| 7 | `errorSource` | `String` |
| 8 | `createdDate` | `String` |
| 9 | `createdTime` | `String` |
| 10 | `timeStamp` | `String` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## Faq  
`models/Faq.js` · 16 lines · collection `faqs` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 4 | `uniqueId` | `String` |
| 5 | `faq` | `[{` |
| 9 | `createdDate` | `Number` |
| 10 | `updatedDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## FhlScript  
`models/FhlScript.js` · 23 lines · collection `fhlscripts` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `userName` | `{ type: String, default: "" }` |
| 6 | `email` | `{ type: String, default: "" }` |
| 7 | `phone` | `{ type: String, default: "" }` |
| 8 | `fhlTransactionId` | `{ type: String, default: "" }` |
| 9 | `fhlOtp` | `{ type: String, default: "" }` |
| 10 | `fhlResponse` | `{ type: String, default: "" }` |
| 11 | `blazeResponse` | `{ type: String, default: "" }` |
| 12 | `transNo` | `{ type: String, default: "" }` |
| 13 | `createdDate` | `{ type: String, default: "" }` |
| 14 | `createdTime` | `{ type: String, default: "" }` |
| 15 | `timeStamp` | `{ type: String, default: "" }` |
| 16 | `paymentMethod` | `{ type: String, default: "" }` |
| 17 | `updatedDate` | `{ type: String, default: "" }` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## HempBlogs  
`models/HempBlogs.js` · 75 lines · collection `hempblogss` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 6 | `url` | `{ type: String, default: "" }` |
| 7 | `title` | `{ type: String, default: "" }` |
| 8 | `description` | `{ type: String, default: "" }` |
| 9 | `alt` | `{ type: String, default: "" }` |
| 17 | `question` | `{ type: String, default: "" }` |
| 18 | `answer` | `{ type: String, default: "" }` |
| 26 | `blogId` | `{ type: String, required: true }` |
| 27 | `title` | `{ type: String, default: "" }` |
| 35 | `title` | `{ type: String, required: true, trim: true, unique: true }` |
| 36 | `description` | `{ type: String, default: "" }` |
| 37 | `category` | `[{ type: String, trim: true }]` |
| 38 | `author` | `{` |
| 43 | `canonical` | `String` |
| 44 | `slug` | `String` |
| 45 | `blogSlugArray` | `Array` |
| 47 | `content` | `Array` |
| 48 | `image` | `ImageSchema` |
| 49 | `listingImage` | `{ type: ImageSchema, default: {} }` |
| 50 | `status` | `{ type: String, enum: ["draft", "published"], default: "draft" }` |
| 51 | `metaTitle` | `{ type: String, default: "" }` |
| 52 | `metaDescription` | `{ type: String, default: "" }` |
| 53 | `faq` | `[FAQSchema]` |
| 54 | `faqStatus` | `{ type: Boolean, default: false }` |
| 55 | `state` | `{ type: String, default: "" }` |
| 56 | `readTime` | `{ type: Number, default: 0 }` |
| 57 | `relatedBlogStatus` | `{ type: Boolean, default: false }` |
| 58 | `relatedBlogData` | `[RelatedBlogSchema]` |
| 59 | `scheduleBlogStatus` | `{ type: Boolean, default: false }` |
| 60 | `scheduleDate` | `{ type: String, default: null }` |
| 61 | `scheduleTime` | `{ type: String, default: null }` |
| 62 | `createdDate` | `{ type: Number, default: () => Date.now() }` |
| 63 | `updatedDate` | `{ type: Number, default: () => Date.now() }` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 3  
  - models/HempBlogs.js:69 `BlogSchema.index({ title: 1 }, { unique: true });`
  - models/HempBlogs.js:70 `BlogSchema.index({ status: 1, createdDate: -1 });`
  - models/HempBlogs.js:71 `BlogSchema.index({ category: 1 });`
- `unique: true` declarations (each creates a unique index): 2 — at models/HempBlogs.js:35, models/HempBlogs.js:69

## HempProducts  
`models/HempProducts.js` · 71 lines · collection `hempproductss` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 4 | `productId` | `{ type: String, unique: true }` |
| 5 | `productName` | `{ type: String, trim: true }` |
| 6 | `productImages` | `{ type: Array, default: [] }` |
| 7 | `sku` | `{ type: String, default: '', unique: true }` |
| 8 | `productPrice` | `Number` |
| 9 | `status` | `String` |
| 10 | `productSlug` | `String` |
| 11 | `brandSlug` | `String` |
| 12 | `isSalePrice` | `{ type: Boolean, default: false }` |
| 13 | `promoPriceApplied` | `{ type: Boolean, default: false }` |
| 14 | `promoPricePromotionId` | `{ type: String, default: null }` |
| 15 | `unitPrice` | `Number` |
| 16 | `salePrice` | `Number` |
| 17 | `brandName` | `String` |
| 18 | `createdBy` | `String` |
| 19 | `updatedBy` | `String` |
| 20 | `category` | `Object` |
| 21 | `updatedDate` | `Number` |
| 22 | `createdDate` | `Number` |
| 23 | `customWeight` | `String` |
| 24 | `thcData` | `String` |
| 25 | `ingredients` | `{ type: String, default: '' }` |
| 26 | `instructions` | `{ type: String, default: '' }` |
| 27 | `ingredientStatus` | `{ type: Boolean, default: false }` |
| 28 | `instructionStatus` | `{ type: Boolean, default: false }` |
| 29 | `totalQuantity` | `{ type: Number, default: 0 }` |
| 30 | `holdQuantity` | `{ type: Number, default: 0 }` |
| 31 | `inventoryTrend` | `{ type: Array, default: [] }` |
| 32 | `isSuperAdminProduct` | `{ type: Boolean, default: true }` |
| 33 | `proportionalDiscount` | `Number` |
| 34 | `inventories` | `[{` |
| 41 | `productBatches` | `{ type: Array, default: [] }` |
| 42 | `categoryName` | `{ type: String, default: '' }` |
| 43 | `tags` | `{ type: Array, default: [] }` |
| 44 | `strainSlug` | `{ type: String, default: '' }` |
| 45 | `strainType` | `{ type: String, default: '' }` |
| 46 | `infoEffects` | `{ type: Array, default: [] }` |
| 47 | `brandDescription` | `{ type: String, default: '' }` |
| 48 | `productDescription` | `{ type: String, default: '' }` |
| 49 | `purchasePrice` | `{ type: Number, default: 0 }` |
| 50 | `margin` | `{ type: Number, default: 0 }` |
| 51 | `productPlatform` | `{ type: Array, deafult: [] }` |
| 52 | `productBarCode` | `{ type: String, deafult: "" }` |
| 53 | `productQRCode` | `{ type: String, deafult: "" }` |
| 54 | `productSlugArray` | `{ type: Array, default: [] }` |
| 55 | `productTraits` | `Array` |
| 56 | `matchedStrains` | `Array` |
| 57 | `seoData` | `{` |
| 63 | `reviews` | `{ type: Object, default: {} }` |
| 64 | `terpenoids` | `Array` |
| 65 | `productDisclaimer` | `{ type: String, default: '' }` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 2 — at models/HempProducts.js:4, models/HempProducts.js:7

## Inventory  
`models/Inventory.js` · 16 lines · collection `inventorys` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `inventoryId` | `{ type: String, required: true, unique: true }` |
| 6 | `inventoryName` | `{ type: String, required: true }` |
| 7 | `regionId` | `{ type: String, default: "" }` |
| 8 | `quantity` | `{ type: Number, default: 0 }` |
| 9 | `status` | `{ type: String, default: 'Inactive' }` |
| 10 | `createdDate` | `Number` |
| 11 | `updatedDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 1 — at models/Inventory.js:5

## Legal  
`models/Legal.js` · 235 lines · collection `legals` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `title` | `{ type: String, required: false }` |
| 6 | `description` | `{ type: String, required: false }` |
| 14 | `url` | `{ type: String, required: false }` |
| 15 | `cta` | `{ type: String, required: false }` |
| 16 | `order` | `{` |
| 26 | `question` | `{ type: String, required: false }` |
| 27 | `answer` | `{ type: String, required: false }` |
| 35 | `name` | `{ type: String, required: false }` |
| 36 | `role` | `{ type: String, required: false }` |
| 44 | `description` | `{ type: String, required: false }` |
| 45 | `socialMediaLinks` | `[` |
| 59 | `order` | `{` |
| 70 | `sectionType` | `{` |
| 75 | `headerSection` | `{` |
| 81 | `topicSection` | `{` |
| 87 | `bottomSection` | `{` |
| 93 | `teamSection` | `{` |
| 99 | `brandStorySection` | `{` |
| 105 | `customerExperienceSection` | `{` |
| 111 | `testimonialsSection` | `{` |
| 117 | `jobOpeningsSection` | `{` |
| 124 | `platformAvailability` | `{` |
| 131 | `displaySettings` | `{` |
| 136 | `metaProperties` | `{` |
| 143 | `faq` | `{` |
| 148 | `deliveryAtGlanceSection` | `{` |
| 154 | `deliveryEstimateSection` | `{` |
| 160 | `ETASection` | `{` |
| 166 | `deliveryRunningLateSection` | `{` |
| 175 | `whatYouSeeSection` | `{` |
| 182 | `makesUpYourTotalSection` | `{` |
| 188 | `feesPoliciesSection` | `{` |
| 194 | `taxesSection` | `{` |
| 202 | `weDeliverYouSection` | `{` |
| 209 | `deliveryRulesSection` | `{` |
| 217 | `uniqueId` | `String` |
| 218 | `slug` | `String` |
| 219 | `description` | `String` |
| 220 | `contentHeading` | `String` |
| 221 | `metaTitle` | `String` |
| 222 | `metaDescription` | `String` |
| 223 | `canonical` | `String` |
| 224 | `heading` | `String` |
| 225 | `status` | `{ type: Boolean, default: false }` |
| 226 | `createdBy` | `String` |
| 227 | `legalSlugArray` | `{ type: Array, default: [] }` |
| 228 | `createdDate` | `Number` |
| 229 | `updatedDate` | `Number` |

- schema options: `{ versionKey: false, minimize: true }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## Log  
`models/Log.js` · 14 lines · collection `logs` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `reqBody` | `Array` |
| 6 | `reqParams` | `Array` |
| 7 | `lastEntry` | `String` |
| 8 | `createdDate` | `String` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## MainBrand  
`models/MainBrand.js` · 35 lines · collection `mainbrands` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `metaTitle` | `String` |
| 6 | `metaDescription` | `String` |
| 7 | `description` | `String` |
| 8 | `image` | `String` |
| 9 | `title` | `String` |
| 10 | `createdBy` | `String` |
| 11 | `createdDate` | `Number` |
| 12 | `canonical` | `String` |
| 13 | `brandName` | `String` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## MainCannabinoid  
`models/MainCannabinoid.js` · 39 lines · collection `maincannabinoids` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 6 | `metaTitle` | `String` |
| 7 | `metaDescription` | `String` |
| 8 | `description` | `String` |
| 9 | `image` | `String` |
| 10 | `title` | `String` |
| 11 | `createdBy` | `String` |
| 12 | `createdDate` | `Number` |
| 13 | `canonical` | `String` |
| 14 | `cannabinoidName` | `String` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## MainProductTraits  
`models/MainProductTraits.js` · 67 lines · collection `mainproducttraitss` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 4 | `status` | `{ type: String, enum: ['Active', 'Inactive'], default: 'Active' }` |
| 5 | `traitId` | `{ type: String }` |
| 6 | `displaySettings` | `{` |
| 10 | `traitSlug` | `{ type: String }` |
| 11 | `traitHeading` | `{ type: String }` |
| 12 | `desktopImages` | `[{` |
| 27 | `mobileImages` | `[{` |
| 42 | `mainTraitName` | `{ type: String }` |
| 43 | `canonical` | `{ type: String }` |
| 44 | `title` | `{ type: String }` |
| 45 | `description1` | `{ type: String }` |
| 46 | `description2` | `{ type: String }` |
| 47 | `metaTitle` | `{ type: String }` |
| 48 | `metaDescription` | `{ type: String }` |
| 49 | `traitSlugArray` | `{ type: Array, default: [] }` |
| 50 | `detailImageAlt` | `{ type: String }` |
| 51 | `listImageAlt` | `{ type: String }` |
| 52 | `platformAvailability` | `{` |
| 58 | `faq` | `{ type: Array, default: [] }` |
| 60 | `createdBy` | `{ type: String }` |
| 61 | `createdDate` | `{ type: Number, default: Date.now }` |
| 62 | `updatedDate` | `Number` |
| 63 | `updatedBy` | `{ type: String }` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## MainStrain  
`models/MainStrain.js` · 39 lines · collection `mainstrains` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `metaTitle` | `String` |
| 6 | `metaDescription` | `String` |
| 7 | `description` | `String` |
| 13 | `title` | `String` |
| 14 | `createdBy` | `String` |
| 15 | `createdDate` | `Number` |
| 16 | `canonical` | `String` |
| 17 | `strainName` | `String` |
| 18 | `faq` | `Array` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## Member  
`models/Member.js` · 55 lines · collection `members` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 6 | `memberId` | `{ type: String, required: true }` |
| 7 | `diditSessionId` | `{type: String}` |
| 8 | `diditRegisterUrl` | `String` |
| 9 | `dob` | `{ type: Number }` |
| 10 | `age` | `{ type: Number }` |
| 11 | `walletAdjustmentReason` | `String` |
| 12 | `email` | `{ type: String, required: true }` |
| 13 | `phone` | `{ type: String, unique: true }` |
| 14 | `password` | `{ type: String, default: "" }` |
| 15 | `firstName` | `{ type: String, default: "", trim: true }` |
| 16 | `lastName` | `{ type: String, default: "", trim: true }` |
| 17 | `fullName` | `{ type: String, default: "" }` |
| 18 | `licenseNumber` | `{ type: String, default: "" }` |
| 19 | `recIssueDate` | `String` |
| 20 | `idImage` | `{ type: String, default: "" }` |
| 21 | `recId` | `{ type: String, default: "" }` |
| 22 | `gender` | `{ type: String, default: "" }` |
| 23 | `memberType` | `{ type: String, default: "" }` |
| 24 | `memberShipGroup` | `{ type: String, default: "Delivery" }` |
| 25 | `deliveryAddress` | `{ type: Object, default: {} }` |
| 26 | `klaviyoProfileId` | `{ type: String, default: "" }` |
| 27 | `inquiryId` | `{ type: String }` |
| 28 | `dlExpiration` | `String` |
| 29 | `verifyMethod` | `{ type: String, default: "" }` |
| 30 | `status` | `{ type: Boolean, default: false }` |
| 31 | `isVerified` | `{ type: Boolean, default: false }` |
| 32 | `ageCheckerUid` | `{ type: String, default: "" }` |
| 33 | `guestCheckout` | `{ type: Boolean, default: false }` |
| 34 | `walletAmount` | `{ type: Number, default: 0 }` |
| 35 | `memberNotes` | `{ type: String, default: "" }` |
| 36 | `notesAttachment` | `{ type: Array, default: [] }` |
| 37 | `memberNotesEmployee` | `{ type: String, default: "" }` |
| 38 | `notesTime` | `Number` |
| 39 | `retailerId` | `{ type: String, default: "" }` |
| 40 | `hotNotes` | `{ type: Array, default: [] }` |
| 41 | `memberPlatform` | `{ type: Array, default: [] }` |
| 42 | `averageSpent` | `{ type: Number, default: 0 }` |
| 43 | `profileImage` | `{ type: String, default: "" }` |
| 44 | `blockOnlinePayments` | `{` |
| 50 | `createdDate` | `Number` |
| 51 | `updatedDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 1 — at models/Member.js:13

## MemberWalletReasons  
`models/MemberWalletReasons.js` · 14 lines · collection `memberwalletreasonss` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `reasonId` | `{ type: String }` |
| 6 | `reasonStatus` | `{ type: Boolean, default: true }` |
| 7 | `walletReason` | `{ type: String, default: '' }` |
| 8 | `createdDate` | `Number` |
| 9 | `updatedDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## Miscellaneous  
`models/Miscellaneous.js` · 15 lines · collection `miscellaneouss` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `uniqueId` | `String` |
| 6 | `data` | `mongoose.Schema.Types.Mixed` |
| 7 | `retailerId` | `{ type: String, default: '' }` |
| 8 | `createdDate` | `Number` |
| 9 | `updatedDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## NotificationData  
`models/NotificationData.js` · 19 lines · collection `notificationdatas` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 6 | `orderId` | `{ type: String, default: '' }` |
| 7 | `notificationId` | `{ type: String, default: '' }` |
| 8 | `retailerId` | `{ type: String, default: '' }` |
| 9 | `email` | `String` |
| 10 | `notificationData` | `Object` |
| 11 | `readStatus` | `{ type: Boolean, default: false }` |
| 12 | `notificationType` | `{ type: String, default: '' }` |
| 13 | `notificationMetaData` | `{ type: Array, default: [] }` |
| 14 | `createdDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## Order  
`models/Order.js` · 78 lines · collection `orders` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 6 | `memberId` | `String` |
| 7 | `email` | `String` |
| 8 | `emailStatus` | `{ type: String, default: "pending" }` |
| 9 | `paymentOption` | `String` |
| 10 | `promoCode` | `{ type: Object, default: {} }` |
| 11 | `klaviyoProfileId` | `String` |
| 12 | `memo` | `String` |
| 13 | `shipStationOrderId` | `{ type: Number, default: 0 }` |
| 14 | `orderKey` | `{ type: String, default: "" }` |
| 15 | `items` | `{ type: Array, default: [] }` |
| 16 | `orderId` | `{ type: String, default: "" }` |
| 17 | `userData` | `{ type: Object, default: {} }` |
| 18 | `deliveryAddress` | `{ type: Object, default: {} }` |
| 19 | `creditTransactionId` | `{ type: String, default: "" }` |
| 20 | `createdBy` | `{ type: String, default: "" }` |
| 21 | `afterTaxDiscount` | `{ type: Number, default: 0 }` |
| 22 | `reviewStatus` | `{ type: Boolean, default: false }` |
| 23 | `warrantyStatus` | `{ type: String }` |
| 24 | `returnRequestStatus` | `{ type: Boolean, default: false }` |
| 25 | `returnApprovedStatus` | `{ type: Boolean, default: false }` |
| 26 | `approvedItems` | `{ type: Array, default: [] }` |
| 27 | `returnComments` | `{ type: String, default: "" }` |
| 28 | `approvalComment` | `{ type: String, default: "" }` |
| 29 | `alpineIQPoints` | `{ type: Number, default: 0 }` |
| 30 | `walletAmount` | `{ type: Number, default: 0 }` |
| 31 | `shippingType` | `{ type: String }` |
| 32 | `shippingCharges` | `{ type: Number, default: 0 }` |
| 33 | `cancellationReason` | `{ type: String, default: "" }` |
| 34 | `trackingId` | `{ type: String, default: "" }` |
| 35 | `serviceName` | `{ type: String, default: "" }` |
| 36 | `returnItems` | `Array` |
| 37 | `walletPointsUsed` | `Number` |
| 38 | `sessionId` | `String` |
| 39 | `promotionData` | `{ type: Object, default: {} }` |
| 40 | `productPromo` | `{ type: Object, default: {} }` |
| 41 | `orderPlatform` | `{ type: String, default: "" }` |
| 42 | `splitCardAmount` | `{ type: Number, default: 0 }` |
| 43 | `cashReceived` | `{ type: Number, default: 0 }` |
| 44 | `balanceLeft` | `{ type: Number, default: 0 }` |
| 45 | `subTotal` | `Number` |
| 46 | `total` | `Number` |
| 47 | `taxTotal` | `{ type: Number, default: 0 }` |
| 48 | `netProfit` | `{ type: Number, default: 0 }` |
| 49 | `netPercentage` | `{ type: Number, default: 0 }` |
| 50 | `reviewsEmailSent` | `{ type: Number, default: 0 }` |
| 51 | `returnRequestDate` | `Number` |
| 52 | `retailerId` | `{ type: String, default: "" }` |
| 53 | `shippedDateTime` | `{ type: Number, default: 0 }` |
| 54 | `deliveredDateTime` | `{ type: Number, default: 0 }` |
| 55 | `canceledDateTime` | `{ type: Number, default: 0 }` |
| 56 | `discountType` | `{ type: String, default: "" }` |
| 57 | `discountValue` | `{ type: Number, default: 0 }` |
| 58 | `itemsDiscount` | `{ type: Number, default: 0 }` |
| 59 | `createdDate` | `Number` |
| 60 | `deliveredDate` | `{ type: Number, default: 0 }` |
| 61 | `walletReturned` | `{ type: Number, default: 0 }` |
| 62 | `packageProof` | `[` |
| 70 | `totalDiscount` | `{ type: Number, default: 0 }` |
| 71 | `updatedDate` | `Number` |

- schema options: `see file` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## OrderManager  
`models/OrderManager.js` · 13 lines · collection `ordermanagers` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `uniqueId` | `String` |
| 6 | `order` | `[{ type: mongoose.Schema.Types.ObjectId }]` |
| 7 | `createdDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## OrderTracker  
`models/OrderTracker.js` · 19 lines · collection `ordertrackers` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 4 | `uniqueId` | `String` |
| 5 | `slotDetails` | `[{` |
| 14 | `createdDate` | `Number` |
| 15 | `updatedDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## PaymentSetting  
`models/PaymentSetting.js` · 16 lines · collection `paymentsettings` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 4 | `paymentId` | `{ type: String, required: [true, 'Branch ID is required'], unique: true, trim: true }` |
| 5 | `paymentClientId` | `{ type: String, required: [true, 'NMI Client is required'], trim: true }` |
| 6 | `paymentSecretId` | `{ type: String, required: [true, 'NMI Secret is required'], trim: true }` |
| 7 | `retailerId` | `{ type: String, required: [true, 'Retailer id is required'], trim: true }` |
| 8 | `paymentMode` | `{ type: String, required: [true, 'NMI Mode is required'], enum: ['test', 'live'], default: 'test' }` |
| 9 | `paymentStatus` | `{ type: Boolean, default: true }` |
| 10 | `createdDate` | `{ type: Number, default: Date.now }` |
| 11 | `updatedDate` | `{ type: Number, default: Date.now }` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 1 — at models/PaymentSetting.js:4

## ProductBatch  
`models/ProductBatch.js` · 93 lines · collection `productbatchs` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `productId` | `String` |
| 6 | `batchData` | `[{` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## ProductRules  
`models/ProductRules.js` · 20 lines · collection `productruless` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 4 | `ruleId` | `String` |
| 5 | `ruleType` | `{ type: String, default: "" }` |
| 6 | `categoryIds` | `{ type: Array, default: [] }` |
| 7 | `productIds` | `{ type: Array, default: [] }` |
| 8 | `brandIds` | `{ type: Array, default: [] }` |
| 9 | `productTags` | `{ type: Array, default: [] }` |
| 10 | `minAmt` | `{ type: Number, default: 0 }` |
| 11 | `maxAmt` | `{ type: Number, default: 0 }` |
| 12 | `discountType` | `{ type: String, default: "" }` |
| 13 | `discountAmt` | `{ type: Number, default: 0 }` |
| 14 | `createdDate` | `Number` |
| 15 | `updatedDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## Promotion  
`models/Promotions.js` · 40 lines · collection `promotions` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `promotionId` | `{ type: String, default: '' }` |
| 6 | `promoName` | `{ type: String, default: '' }` |
| 7 | `status` | `{ type: Boolean, default: false }` |
| 8 | `promotionType` | `{ type: String, default: '' }` |
| 9 | `promoDescription` | `{ type: String, default: '' }` |
| 10 | `isStackable` | `{ type: Boolean, default: false }` |
| 11 | `promoCodes` | `{ type: Array, default: [] }` |
| 12 | `autoApply` | `{ type: Boolean, default: false }` |
| 13 | `discountType` | `{ type: String, default: '' }` |
| 14 | `criteriaGroups` | `{ type: Array, default: [] }` |
| 15 | `availableUnits` | `{ type: Number, default: 0 }` |
| 16 | `membershipGroup` | `{ type: Boolean, default: false }` |
| 17 | `membershipGroupType` | `{ type: String, default: "" }` |
| 18 | `discountAmount` | `Number` |
| 19 | `startDate` | `Date` |
| 20 | `endDate` | `Date` |
| 21 | `startTime` | `String` |
| 22 | `endTime` | `String` |
| 23 | `promoTimeStart` | `Number` |
| 24 | `images` | `Array` |
| 25 | `maxAvailableCustomer` | `Number` |
| 26 | `cashUpto` | `Number` |
| 27 | `target` | `{ type: Array, default: [] }` |
| 28 | `sun` | `{ type: Boolean, default: false }` |
| 29 | `mon` | `{ type: Boolean, default: false }` |
| 30 | `tue` | `{ type: Boolean, default: false }` |
| 31 | `wed` | `{ type: Boolean, default: false }` |
| 32 | `thu` | `{ type: Boolean, default: false }` |
| 33 | `fri` | `{ type: Boolean, default: false }` |
| 34 | `sat` | `{ type: Boolean, default: false }` |
| 35 | `createdDate` | `Number` |
| 36 | `updatedDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## RefundReasons  
`models/RefundReasons.js` · 14 lines · collection `refundreasonss` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `reasonId` | `{ type: String }` |
| 6 | `reasonStatus` | `{ type: Boolean, default: true }` |
| 7 | `refundReason` | `{ type: String, default: '' }` |
| 8 | `createdDate` | `Number` |
| 9 | `updatedDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## Region  
`models/Region.js` · 16 lines · collection `regions` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `regionId` | `{ type: String, required: true }` |
| 6 | `regionName` | `{ type: String, required: true }` |
| 7 | `status` | `{ type: String }` |
| 8 | `openingHours` | `{ type: Number }` |
| 9 | `closingHours` | `{ type: Number }` |
| 10 | `kml` | `{ type: String, default: "" }` |
| 11 | `createdDate` | `Number` |
| 12 | `updatedDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## ResetRequest  
`models/ResetRequest.js` · 31 lines · collection `resetrequests` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `phone` | `String` |
| 6 | `firstName` | `String` |
| 7 | `email` | `{ type: String, default: "" }` |
| 8 | `lastName` | `String` |
| 9 | `token` | `String` |
| 10 | `userData` | `Object` |
| 11 | `createdDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## Retailer  
`models/Retailer.js` · 53 lines · collection `retailers` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `retailerId` | `{ type: String, required: [true, 'Retailer ID is required'], unique: true, trim: true }` |
| 6 | `retailerName` | `{ type: String, required: [true, 'Retailer Name is required'], trim: true }` |
| 7 | `firstName` | `{ type: String, required: [true, 'First Name is required'] }` |
| 8 | `lastName` | `{ type: String, required: [true, 'Last Name is required'] }` |
| 9 | `contactName` | `{ type: String, trim: true }` |
| 10 | `email` | `{` |
| 20 | `phone` | `{` |
| 29 | `subscription` | `{ type: String, enum: ['Paid', 'Unpaid'], default: 'Unpaid' }` |
| 30 | `valiDateFrom` | `{ type: Number }` |
| 31 | `valiDateTo` | `{ type: Number }` |
| 32 | `status` | `{ type: String, default: "" }` |
| 33 | `address` | `{ type: Object, default: {} }` |
| 34 | `password` | `{ type: String }` |
| 35 | `klaviyoProfileId` | `{ type: String, }` |
| 36 | `kml` | `{ type: String, trim: true }` |
| 37 | `isLifeTime` | `{ type: Boolean, default: true }` |
| 38 | `isViewUser` | `{ type: Boolean, default: false }` |
| 39 | `deviceToken` | `{ type: Array, default: [] }` |
| 40 | `roleId` | `{ type: String, default: "" }` |
| 41 | `roleName` | `{ type: String, default: "" }` |
| 42 | `batchStatus` | `{ type: Boolean, default: false }` |
| 43 | `createdDate` | `{ type: Number, default: Date.now }` |
| 44 | `updatedDate` | `{ type: Number, default: Date.now }` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 3 — at models/Retailer.js:5, models/Retailer.js:11, models/Retailer.js:21

## RetailerProducts  
`models/RetailerProducts.js` · 17 lines · collection `retailerproductss` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `retailerId` | `{ type: String, required: [true, 'Retailer ID is required'], trim: true }` |
| 6 | `products` | `{ type: Object, default: {} }` |
| 7 | `productAvailability` | `{ type: String, default: "" }` |
| 8 | `productBarCode` | `{ type: String, default: "" }` |
| 9 | `productQRCode` | `{ type: String, default: "" }` |
| 10 | `createdDate` | `{ type: Number, default: Date.now }` |
| 11 | `updatedDate` | `{ type: Number, default: Date.now }` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## RetailerUser  
`models/RetailerUser.js` · 39 lines · collection `retailerusers` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 6 | `firstName` | `String` |
| 7 | `lastName` | `String` |
| 8 | `retailerName` | `String` |
| 9 | `email` | `{` |
| 12 | `phone` | `{` |
| 21 | `password` | `String` |
| 22 | `status` | `{ type: Boolean, default: true }` |
| 23 | `roleName` | `{ type: String, default: "" }` |
| 24 | `roleId` | `{ type: String, default: "" }` |
| 25 | `createdDate` | `Number` |
| 26 | `lastLogin` | `Number` |
| 27 | `retailerId` | `String` |
| 28 | `klaviyoProfileId` | `{ type: String, default: "" }` |
| 29 | `isSuperAdmin` | `{ type: Boolean, default: false }` |
| 30 | `deviceToken` | `{ type: Array, default: [] }` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 2 — at models/RetailerUser.js:10, models/RetailerUser.js:13

## RoleAndPermissions  
`models/RoleAndPermissions.js` · 50 lines · collection `roleandpermissionss` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 6 | `title` | `{ type: String, required: true, trim: true }` |
| 7 | `redirectUrl` | `{ type: String, default: "", trim: true }` |
| 8 | `permissions` | `[` |
| 20 | `role` | `{` |
| 25 | `platforms` | `{` |
| 33 | `permissions` | `{` |
| 41 | `createdBy` | `{ type: String, default: "" }` |
| 42 | `updatedBy` | `{ type: String, default: "" }` |

- schema options: `see file` · `timestamps`: YES
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 1 — at models/RoleAndPermissions.js:21

## Store  
`models/Store.js` · 52 lines · collection `stores` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `storeId` | `{ type: String, required: [true, 'Store ID is required'], unique: true, trim: true }` |
| 6 | `storeName` | `{ type: String, required: [true, 'Store Name is required'], trim: true }` |
| 7 | `firstName` | `{ type: String, required: [true, 'First Name is required'] }` |
| 8 | `lastName` | `{ type: String, required: [true, 'Last Name is required'] }` |
| 9 | `contactName` | `{ type: String, trim: true }` |
| 10 | `email` | `{` |
| 20 | `phone` | `{` |
| 29 | `storeImage` | `{ type: String, }` |
| 30 | `subscription` | `{ type: String, }` |
| 31 | `valiDateFrom` | `{ type: Number }` |
| 32 | `valiDateTo` | `{ type: Number }` |
| 33 | `status` | `{ type: String, default: "" }` |
| 34 | `address` | `{ type: Object, default: {} }` |
| 35 | `password` | `{ type: String }` |
| 36 | `klaviyoProfileId` | `{ type: String, }` |
| 37 | `platform` | `String` |
| 38 | `PIN` | `String` |
| 39 | `kml` | `{ type: String, trim: true }` |
| 40 | `isLifeTime` | `{ type: Boolean, default: true }` |
| 41 | `isViewUser` | `{ type: Boolean, default: true }` |
| 42 | `deviceToken` | `{ type: Array, default: [] }` |
| 43 | `roleId` | `{ type: String, default: "" }` |
| 44 | `roleName` | `{ type: String, default: "" }` |
| 45 | `batchStatus` | `{ type: Boolean, default: false }` |
| 46 | `createdDate` | `{ type: Number, default: Date.now }` |
| 47 | `updatedDate` | `{ type: Number, default: Date.now }` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 3 — at models/Store.js:5, models/Store.js:11, models/Store.js:21

## StoreCoordinates  
`models/StoreCoordinates.js` · 26 lines · collection `storecoordinatess` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 6 | `storeId` | `{ type: String, }` |
| 7 | `regionId` | `{ type: String, default: "" }` |
| 8 | `coordinates` | `{` |
| 19 | `deliveryType` | `{ type: String }` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 1  
  - models/StoreCoordinates.js:23 `storeCoordinatesSchema.index({ coordinates: '2dsphere' });`
- `unique: true` declarations (each creates a unique index): 0

## StoreUser  
`models/StoreUser.js` · 40 lines · collection `storeusers` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 6 | `firstName` | `String` |
| 7 | `lastName` | `String` |
| 8 | `storeName` | `String` |
| 9 | `email` | `{` |
| 12 | `phone` | `{` |
| 21 | `password` | `String` |
| 22 | `status` | `{ type: Boolean, default: true }` |
| 23 | `roleName` | `{ type: String, default: "" }` |
| 24 | `roleId` | `{ type: String, default: "" }` |
| 25 | `pin` | `String` |
| 26 | `createdDate` | `Number` |
| 27 | `lastLogin` | `Number` |
| 28 | `storeId` | `String` |
| 29 | `klaviyoProfileId` | `{ type: String, default: "" }` |
| 30 | `isSuperAdmin` | `{ type: Boolean, default: false }` |
| 31 | `deviceToken` | `{ type: Array, default: [] }` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 2 — at models/StoreUser.js:10, models/StoreUser.js:13

## Strain  
`models/Strain.js` · 70 lines · collection `strains` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `strainId` | `String` |
| 6 | `strainName` | `String` |
| 7 | `metaTitle` | `String` |
| 8 | `metaDescription` | `String` |
| 9 | `description` | `String` |
| 15 | `strainCategory` | `String` |
| 16 | `title` | `String` |
| 17 | `createdBy` | `String` |
| 18 | `strainHeading` | `{ type: String }` |
| 19 | `strainSlugArray` | `{ type: Array, default: [] }` |
| 20 | `createdDate` | `Number` |
| 21 | `status` | `{ type: Boolean, default: false }` |
| 22 | `isBestStrain` | `{ type: Boolean, default: false }` |
| 23 | `isPopularStrain` | `{ type: Boolean, default: false }` |
| 24 | `infoEffects` | `{ type: Array, default: [] }` |
| 25 | `flavors` | `{ type: Array, default: [] }` |
| 26 | `productId` | `String` |
| 27 | `title2` | `String` |
| 28 | `subStrainSlug` | `String` |
| 29 | `canonical` | `String` |
| 30 | `faq` | `Array` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## SubProductTraits  
`models/SubProductTraits.js` · 56 lines · collection `subproducttraitss` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 4 | `status` | `{ type: String, enum: ['Active', 'Inactive'], default: 'Active' }` |
| 5 | `subTraitId` | `{ type: String }` |
| 6 | `parentTrait` | `{ type: String }` |
| 7 | `traitId` | `{` |
| 18 | `traitHeading` | `{ type: String }` |
| 19 | `showOnHomePage` | `{ type: Boolean, default: false }` |
| 20 | `tags` | `[{ type: String }]` |
| 21 | `traitSlug` | `{ type: String }` |
| 22 | `listImage` | `{ type: String }` |
| 23 | `detailImage` | `{ type: String }` |
| 24 | `detailImageAlt` | `{ type: String }` |
| 25 | `listImageAlt` | `{ type: String }` |
| 26 | `subTraitName` | `{ type: String }` |
| 27 | `canonical` | `{ type: String }` |
| 28 | `title` | `{ type: String }` |
| 29 | `desktopIcon` | `{ type: String }` |
| 30 | `mobileIcon` | `{ type: String }` |
| 31 | `description1` | `{ type: String }` |
| 32 | `platformAvailability` | `{` |
| 38 | `faq` | `{ type: Array, default: [] }` |
| 39 | `description2` | `{ type: String }` |
| 40 | `metaTitle` | `{ type: String }` |
| 41 | `metaDescription` | `{ type: String }` |
| 42 | `traitSlugArray` | `{ type: Array, default: [] }` |
| 43 | `createdBy` | `{ type: String }` |
| 44 | `createdDate` | `{ type: Number, default: Date.now }` |
| 45 | `updatedDate` | `{ type: Number }` |
| 46 | `updatedBy` | `{ type: String }` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## Tax  
`models/Tax.js` · 51 lines · collection `taxs` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `taxId` | `{ type: String, required: true }` |
| 6 | `name` | `{ type: String, required: true, unique: true }` |
| 7 | `memberType` | `String` |
| 8 | `taxDetails` | `{` |
| 46 | `createdDate` | `Number` |
| 47 | `updatedDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 1 — at models/Tax.js:6

## TaxSettings  
`models/TaxSettings.js` · 16 lines · collection `taxsettingss` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 4 | `taxID` | `{ type: String, required: [true, 'Tax ID is required'], unique: true, trim: true }` |
| 5 | `taxName` | `{ type: String, unique: true, trim: true }` |
| 6 | `taxRate` | `{ type: Number, default: 0 }` |
| 7 | `order` | `Number` |
| 8 | `retailerId` | `{ type: String, default: "" }` |
| 9 | `taxStatus` | `{ type: Boolean, default: true }` |
| 10 | `createdDate` | `{ type: Number, default: Date.now }` |
| 11 | `updatedDate` | `{ type: Number, default: Date.now }` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 2 — at models/TaxSettings.js:4, models/TaxSettings.js:5

## Terpenoids  
`models/Terpenoids.js` · 30 lines · collection `terpenoidss` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 5 | `terpeneId` | `String` |
| 6 | `terpeneName` | `String` |
| 7 | `terpeneImage` | `String` |
| 8 | `subText` | `String` |
| 9 | `status` | `{ type: String }` |
| 10 | `createdBy` | `String` |
| 11 | `createdDate` | `Number` |
| 12 | `updatedDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## UserRolesPermissions  
`models/UserRolesPermissions.js` · 14 lines · collection `userrolespermissionss` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 4 | `retailerId` | `{ type: String, required: [true, 'Retailer id is required'], trim: true }` |
| 5 | `roleId` | `{ type: String, required: [true, 'Role ID is required'], unique: true, trim: true }` |
| 6 | `roleName` | `{ type: String, required: [true, 'Role name is required'], trim: true }` |
| 7 | `permissions` | `{ type: Object, default: {} }` |
| 8 | `createdDate` | `{ type: Number, default: Date.now }` |
| 9 | `updatedDate` | `{ type: Number, default: Date.now }` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 1 — at models/UserRolesPermissions.js:5

## VersionSync  
`models/VersionSync.js` · 9 lines · collection `versionsyncs` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 4 | `uniqueId` | `String` |
| 5 | `blazeLastSync` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 0

## WebCategory  
`models/WebCategory.js` · 30 lines · collection `webcategorys` (mongoose default pluralisation)

| line | field | definition |
|---|---|---|
| 6 | `webCategoryName` | `{ type: String, require: true, unique: true }` |
| 7 | `metaTitle` | `String` |
| 8 | `metaDescription` | `String` |
| 9 | `heading` | `String` |
| 10 | `canonical` | `String` |
| 11 | `description` | `String` |
| 12 | `adminCategories` | `Array` |
| 13 | `webCategorySlug` | `String` |
| 14 | `webMenuName` | `{ type: String }` |
| 15 | `webCategoryHeading` | `{ type: String }` |
| 16 | `webCategorySlugArray` | `{ type: Array, default: [] }` |
| 17 | `status` | `String` |
| 18 | `image` | `String` |
| 19 | `order` | `Number` |
| 20 | `createdBy` | `String` |
| 21 | `bottomText` | `{ type: String, default: "" }` |
| 22 | `bannerImage` | `String` |
| 23 | `faq` | `{ type: Array, default: [] }` |
| 24 | `createdDate` | `Number` |
| 25 | `updatedDate` | `Number` |

- schema options: `{ versionKey: false, minimize: false }` · `timestamps`: no
- explicit `.index()` calls: 0
- `unique: true` declarations (each creates a unique index): 1 — at models/WebCategory.js:6

