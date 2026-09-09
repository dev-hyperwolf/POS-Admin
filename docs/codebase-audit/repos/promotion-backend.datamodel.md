# promotion-backend — full data model (field-by-field)

Companion to `promotion-backend.md`. 19 Mongoose models across 4 Mongoose connections opened in
`startup/db.js`: `conn1` = `DATABASE_URL` (promotions DB), `conn2` = `HEMP_DATABASE_URL`,
`conn3` = `STILO_DATABASE_URL`, `conn4` = `HW_DATABASE_URL` (Hyperwolf). Every field below is
transcribed directly from the schema definition cited; no field is inferred.

---

## conn1 (promotions DB) — 6 models

### Promotion — `models/Promotion.js`
No `timestamps: true`; hand-rolled `createdAt`. Compound unique index `{platform:1, code:1}`
(line 137).

| Field | Type | Notes |
|---|---|---|
| name | String | required, unique, maxlength 200, trim |
| code | [String] | required; `unique` commented out (line 15) |
| description | String | default `""` |
| publishDate | Date | required |
| expiryDate | Date | default null |
| usageLimit | Number | default null |
| usageLimitPerUser | Number | default null |
| status | String | enum `["active","inactive"]`, default `"inactive"` |
| isExpiryDateRequired | Boolean | default null |
| isScheduled | Boolean | default null |
| allowSalesItem | Boolean | default null |
| isIndividualUsed | Boolean | default null |
| codeId | String | default null |
| autoApply | Boolean | default false |
| showingPromoCode | Boolean | default true |
| timezone | String | default `"America/Los_Angeles"` |
| platform | String | default `"hyperwolf"` |
| createdAt | Date | default `Date.now` |
| rule | Mixed | required — unvalidated arbitrary JSON |
| actions | Mixed | required — unvalidated arbitrary JSON |
| rules | Mixed | ref `"Rules"` (ref on a Mixed type has no effect in Mongoose), default `{}` |
| ruleTree | Mixed | default null — "NEW: For Dynamic Rule Engine" (comment, line 112) |
| stackable | Boolean | default true |
| promoUsage | Number | default 0 |

Dead/commented fields still in source: `priority` (lines 18-22, commented out — see main report
§16 item 9, `services/promotionService.js:36` sorts by this non-existent field) and `promoCode`
(lines 131-134, commented out).

### Rule — `models/Rule.js`
Standalone schema (also required into `Promotion.js` but not embedded — `Promotion.rule` is
`Mixed`, not a `Rule` sub-document). Defensive connection binding (lines 53-56): falls back to
default `mongoose` connection if `global.dbConnections` isn't set yet.

| Field | Type | Notes |
|---|---|---|
| promotion_id | ObjectId | ref `"Promotion"`, indexed |
| rule_type | String | enum `["cart","user","product","bogo"]`, required |
| operation | String | required, free text (no enum) |
| attributes | String | enum `["each_or_any","cart_total","cart_count","category_id","product_id","user_group","mp_id"]`, required |
| value | Mixed | required |
| logicalGroup | String | default `""` |
| createdAt | Date | default `Date.now` |

### Rules — `models/Rules.js`
Second, structurally different rule representation used only by the dynamic-engine path (see main
report §12). Three schemas in one file: `IfRuleSchema`, `ThenRuleSchema` (recursively embeds
itself via `groupRule: RulesSchema`), `RulesSchema`.

**IfRuleSchema** (sub-document): `title` String, `value` String, `type` String enum
`['input','select']`, `inputType` String, `operation` String enum `['>','<=','>=','==']`,
`attributes` String, `selectedValue` Mixed, `isOpen` Boolean, `isShowError` Boolean.

**ThenRuleSchema** (sub-document): `title` String, `value` String, `type` String (free text,
no enum — inconsistent with `IfRuleSchema.type`), `inputType` String, `selectedValue` Mixed,
`isGroupRule` Boolean, `groupRule` → `RulesSchema` (recursive nesting), `isShowError` Boolean.

**RulesSchema** (top-level, registered as model `"Rules"`): `ruleType` String (comment: `"product",
"user"`, not an enforced enum), `ifRules` [IfRuleSchema], `thenRules` [ThenRuleSchema],
`isRuleSelected` Boolean, `showError` Boolean, `showThenError` Boolean.

### Action — `models/Action.js`
Standalone schema, `required` into `Promotion.js` but (like `Rule`) not actually embedded —
`Promotion.actions` is `Mixed`.

| Field | Type | Notes |
|---|---|---|
| type | String | required; comment says `flat / percentage / product`, no enum enforced |
| value | [Mixed] | required |
| createdAt | Date | default `Date.now` |

Dead/commented field: `promotionId` (lines 6-11, commented out).

### PromoCode — `models/PromoCode.js`
Only model in the repo using Mongoose `{timestamps: true}` (line 28).

| Field | Type | Notes |
|---|---|---|
| promotionId | ObjectId | ref `"Promotion"`, required, indexed |
| type | String | default null |
| code | [String] | required, default `[]` |
| applied | Number | default 0 |
| createdAt / updatedAt | Date | via `timestamps: true` |

### ProductPromoTag — `models/ProductPromoTag.js`
Derived/cache document rebuilt by `services/product-promo-tag.service.js`. `versionKey: false`.
Compound unique index `{platform:1, productId:1}` (line 39).

| Field | Type | Notes |
|---|---|---|
| platform | String | required, indexed |
| productId | String | required, indexed |
| tags | [subdoc] | default `[]` — see below |
| updatedAt | Date | default `Date.now` (not Mongoose `timestamps`) |

`tags[]` subdocument: `promoId` String required, `code` String default `""`, `name` String
default `""`, `type` String default `"offer"`, `label` String default `"Special Offer"`,
`startsAt` Date default null, `endsAt` Date default null, `priority` Number default 0,
`autoApply` Boolean default true, `promoCalculation` object (`calculationType` String default
`""` — comment: percentage|flat; `value` Number default null; `maxDiscount` Number default null;
`scope` String default `""` — comment: product|category|brand|cart; `appliesTo` String default
`""` — comment: target|other|trigger; `isEstimated` Boolean default true).

---

## conn4 (Hyperwolf DB) — models used by promotion-backend

### Product — `models/Product.js`
Hyperwolf catalog read model. `versionKey: false, minimize: false`. 6 explicit indexes
(lines 26-31): `{productData.active, productData.sellableQuantities.no_region}`,
`{productData.categoryId}`, `{productData.brandId}`, `{productData.productId}`,
`{productTraits.traitKey}`, `{productTraits.subTraitKey}`.

| Field | Type | Notes |
|---|---|---|
| productId | String | unique |
| status | String | |
| ordersing | String | (sic — likely typo for "ordering") |
| productSlug | String | |
| brandSlug | String | |
| strainType | String | default `""` |
| infoEffects | Array | default `[]` |
| totalPrice | Number | money, dollars |
| adminProductName | String | |
| websiteProductName | String | |
| isSalePrice | Boolean | |
| brandDescription | String | default `""` |
| productData | Object | untyped nested blob |
| terpenoids | Object | default `{}` |
| productBatchSKU | String | default `""` |
| strainSlug | String | default `""` |
| productTraits | Array | |
| matchedStrains | Array | |

Also exports `updateProductValidaton` (sic — typo, not "Validation"), a Joi-based middleware
(lines 36-49) validating `strainType`/`infoEffects`/`brandDescription`/`websiteProductName`/
`active` — **not wired to any route in this repo** (no router imports it).

### Hyperwolf/Brand — `models/Hyperwolf/Brand.js`
Smallest of the three Brand variants — no image/listing-image sub-objects.

| Field | Type | Notes |
|---|---|---|
| brandId | String | required (Joi only, not schema-level) |
| brandName | String | required (Joi only) |
| description | String | default `""` |
| createdBy | String | |
| createdDate | Number | epoch, not Date |
| updatedBy | String | present here only — not on Hemp/Stilo variants |
| updatedDate | Number | epoch |

### Hyperwolf/Category — `models/Hyperwolf/Category.js`
The one platform variant where the `required` typo was fixed (see main report §11/§16).

| Field | Type | Notes |
|---|---|---|
| categoryName | String | **required: true** (correct), unique |
| categoryMenuName | String | |
| categoryHeading | String | |
| categoryImage | {title,url,description,alt: String, all required:false} | object, not String (differs from Hemp/Stilo) |
| categorySlugArray | Array | default `[]` |
| status | String | default `false` (a Boolean literal as a String default — type mismatch) |
| category | Object | untyped |
| categoryId | String | **required: true** (correct), unique |
| description | String | |
| metaTitle | String | |
| categorySlug | String | |
| metaDescription | String | |
| heading | String | |
| content | String | default `""` — not present on Hemp/Stilo variants |
| canonical | String | default `""` |
| bottomText | String | default `""` |
| bannerImage | {title,url,description,alt} | object, not String |
| productInstructions | String | |
| faq | Array | default `[]` |
| status (2nd decl.) | String | default `"Draft"` — **duplicate key** `status` declared twice (lines 16 and 36); the second silently wins in the compiled schema |
| createdBy | String | |
| createdDate | Number | epoch |
| updatedDate | Number | epoch |

### Hyperwolf/Region — `models/Hyperwolf/Region.js`
Registered as model name **`"Regions"`** (plural — inconsistent with Hemp/Stilo's `"Region"`,
singular), and uses `module.exports = Regions` directly (no named export), unlike every other
model in the repo which does `exports.X = X`.

| Field | Type | Notes |
|---|---|---|
| regionId | String | no `required` |
| regionName | String | no `required` |
| createdDate | Number | default `Date.now` (epoch) |
| updatedDate | Number | default `Date.now` (epoch) |

Missing entirely vs. Hemp/Stilo Region: `status`, `openingHours`, `closingHours`, `kml`.

---

## conn3 (Stilo DB) — models used by promotion-backend

### StoreProducts — `models/StoreProducts.js`
`versionKey: false, minimize: false`. One index: `{productTraits:1}`.

| Field | Type | Notes |
|---|---|---|
| storeId | String | required (custom message), trim |
| products | Object | default `{}` |
| productAvailability | String | default `""` |
| productBarCode | String | default `""` |
| productQRCode | String | default `""` |
| productSlugArray | Array | default `[]` |
| matchedStrains | Array | default `[]` — **declared twice** (also plain `Array` at line 12, no default — duplicate key, second wins) |
| productTraits | Array | |
| isBestSeller | Boolean | default false |
| isFeatured | Boolean | default false |
| isCustFav | Boolean | default false |
| productDisclaimer | String | default `""` |
| createdDate | Number | default `Date.now` |
| updatedDate | Number | default `Date.now` |

### Stilo/Brand — `models/Stilo/Brand.js`
Adds `image`/`listingImage` as structured objects (title/url/description/alt), unlike Hemp's
plain `String` `image` field.

| Field | Type | Notes |
|---|---|---|
| brandId | String | |
| brandName | String | |
| metaTitle | String | |
| metaDescription | String | |
| description | String | default `""` |
| status | String | default `false` (type-mismatched default, same pattern as Hyperwolf/Category) |
| image | {title,url,description,alt} | object |
| listingImage | {title,url,description,alt} | object |
| createdBy | String | |
| createdDate | Number | |
| updatedDate | Number | |
| description_left_side | String | |
| description_right_side | String | |
| brandHeading | String | |
| brandSlugArray | Array | default `[]` |
| brand_left_side | Array | default `[]` |
| brand_right_side | Array | default `[]` |
| isBestBrand | Boolean | default false |
| isPopularBrand | Boolean | default false |
| title2 | String | |
| subBrandSlug | String | |
| brandSlug | String | |
| canonical | String | |

### Stilo/Category — `models/Stilo/Category.js`
Has the **unfixed** `require: true` typo (lines 6, 15 — see main report §11).

| Field | Type | Notes |
|---|---|---|
| categoryName | String | `require: true` (typo — no-op), unique |
| categoryMenuName | String | |
| categoryHeading | String | |
| bannerHeading | String | not on Hemp variant |
| categoryImage | String | default `""` (plain String, unlike Hyperwolf's object) |
| categorySlugArray | Array | default `[]` |
| categoryType | String | not on Hemp variant |
| status | String | default `false` |
| category | Object | |
| categoryId | String | `require: true` (typo — no-op), unique |
| description | String | |
| image | String | default `""` |
| listingImage | {title,url,description,alt} | object |
| metaTitle | String | |
| categorySlug | String | |
| metaDescription | String | |
| heading | String | |
| canonical | String | default `""` |
| bottomText | String | default `""` |
| bannerImage | {title,url,description,alt} | object |
| bannerMobileImage | {title,url,description,alt} | not on Hemp/Hyperwolf variants |
| productInstructions | String | |
| faq | Array | default `[]` |
| createdBy | String | |
| createdDate | Number | |
| updatedDate | Number | |

### Stilo/Region — `models/Stilo/Region.js`
Same shape as Hemp/Region (see below) — the only pair of the three platform Region variants that
match field-for-field, differing only in the target connection (`conn3` vs `conn2`).

| Field | Type | Notes |
|---|---|---|
| regionId | String | required |
| regionName | String | required |
| status | String | |
| openingHours | Number | |
| closingHours | Number | |
| kml | String | default `""` |
| createdDate | Number | |
| updatedDate | Number | |

---

## conn2 (Hemp DB) — models used by promotion-backend

### HempProducts — `models/HempProducts.js`
Largest schema in the repo (67 fields). `versionKey: false, minimize: false`. **Zero explicit
indexes** despite `sku`/`productId` carrying `unique: true` (which does create an index) and being
queried by many other fields with no index (see main report §15).

| Field | Type | Notes |
|---|---|---|
| productId | String | unique |
| productName | String | trim |
| productImages | Array | default `[]` |
| sku | String | default `""`, unique |
| productPrice | Number | money, dollars |
| status | String | |
| productSlug | String | |
| brandSlug | String | |
| isSalePrice | Boolean | default false |
| promoPriceApplied | Boolean | default false — set by `services/promo-price-sync.service.js` |
| promoPricePromotionId | String | default null — set by same service |
| unitPrice | Number | money |
| salePrice | Number | money |
| brandName | String | |
| createdBy | String | |
| updatedBy | String | |
| category | Object | untyped |
| updatedDate | Number | epoch, no default |
| createdDate | Number | epoch, no default |
| customWeight | String | |
| thcData | String | |
| ingredients | String | default `""` |
| instructions | String | default `""` |
| ingredientStatus | Boolean | default false |
| instructionStatus | Boolean | default false |
| totalQuantity | Number | default 0 |
| holdQuantity | Number | default 0 |
| inventoryTrend | Array | default `[]` |
| isSuperAdminProduct | Boolean | default true |
| inventories | [subdoc] | `status` String, `quantity` Number, `regionId` String default `""`, `inventoryId` String, `inventoryName` String |
| productBatches | Array | default `[]` |
| categoryName | String | default `""` |
| tags | Array | default `[]` |
| strainSlug | String | default `""` |
| strainType | String | default `""` |
| infoEffects | Array | default `[]` |
| brandDescription | String | default `""` |
| productDescription | String | default `""` |
| purchasePrice | Number | default 0, money |
| margin | Number | default 0 |
| productPlatform | Array | `deafult: []` (sic — typo, means this "default" **does not apply** in Mongoose, field truly defaults to `undefined`) |
| productBarCode | String | `deafult: ""` (same typo, same effect) |
| productQRCode | String | `deafult: ""` (same typo, same effect) |
| productSlugArray | Array | default `[]` |
| productTraits | Array | |
| matchedStrains | Array | |
| seoData | object | `canonical`, `metaTitle`, `metaDescription`, `heading` — all String |
| reviews | Object | default `{}` |
| terpenoids | Array | |
| productDisclaimer | String | default `""` |

Compared to `hemp-backend:models/HempProducts.js` (cross-repo duplicate, main report §12): that
copy has one additional field, `proportionalDiscount: Number`, absent here — confirmed drift
between the two copies, not just a connection-binding difference.

### Hemp/Brand — `models/Hemp/Brand.js`
Plain-`String` `image` (unlike Stilo/Hyperwolf's structured image objects).

| Field | Type | Notes |
|---|---|---|
| brandId | String | |
| brandName | String | |
| metaTitle | String | |
| metaDescription | String | |
| description | String | default `""` |
| status | String | default `false` |
| image | String | plain string, not object |
| createdBy | String | |
| createdDate | Number | |
| updatedDate | Number | |
| description_left_side | String | |
| description_right_side | String | |
| brandHeading | String | |
| brandSlugArray | Array | default `[]` |
| brand_left_side | Array | default `[]` |
| brand_right_side | Array | default `[]` |
| isBestBrand | Boolean | default false |
| isPopularBrand | Boolean | default false |
| title2 | String | |
| subBrandSlug | String | |
| brandSlug | String | |
| canonical | String | |

### Hemp/Category — `models/Hemp/Category.js`
Has the **unfixed** `require: true` typo (lines 6, 13 — same bug as Stilo, see main report §11).
Smallest of the three Category variants — no `bannerMobileImage`, no `listingImage`, no
`categoryType`, no `bannerHeading`, no `content`, single `status` declaration (unlike
Hyperwolf's duplicate-key `status`).

| Field | Type | Notes |
|---|---|---|
| categoryName | String | `require: true` (typo — no-op), unique |
| categoryMenuName | String | |
| categoryHeading | String | |
| categoryImage | String | default `""` — plain string (Hyperwolf/Stilo use structured objects) |
| categorySlugArray | Array | default `[]` |
| status | String | default `false` |
| category | Object | |
| categoryId | String | `require: true` (typo — no-op), unique |
| description | String | |
| image | String | |
| metaTitle | String | |
| categorySlug | String | |
| metaDescription | String | |
| heading | String | |
| canonical | String | default `""` |
| bottomText | String | default `""` |
| bannerImage | String | plain string (Hyperwolf/Stilo use structured objects) |
| productInstructions | String | |
| faq | Array | default `[]` |
| createdBy | String | |
| createdDate | Number | |
| updatedDate | Number | |

### Hemp/Region — `models/Hemp/Region.js`

| Field | Type | Notes |
|---|---|---|
| regionId | String | required |
| regionName | String | required |
| status | String | |
| openingHours | Number | |
| closingHours | Number | |
| kml | String | default `""` |
| createdDate | Number | |
| updatedDate | Number | |

Field-for-field identical to Stilo/Region (only the target connection differs — `conn2` vs
`conn3`); Hyperwolf/Region diverges from both (registered under model name `"Regions"`, missing
`status`/`openingHours`/`closingHours`/`kml`, defaults `createdDate`/`updatedDate` to `Date.now`
where the other two leave them undefaulted).

---

## Cross-cutting observations for the data model

- **No shared base schema.** Every one of the 9 platform-variant model files
  (`{Hemp,Stilo,Hyperwolf} × {Brand,Category,Region}`) is a fully independent `new
  mongoose.Schema({...})` call with hand-copied fields — there is no shared field set, no schema
  composition/mixin, and no shared Joi validator, which is why the `require`/`required` typo, the
  `deafult`/`default` typo, the duplicate `status` key, and the plain-String-vs-structured-object
  `image`/`bannerImage` inconsistency could each exist in some copies and not others.
- **Two typo patterns that silently disable validation/defaults**, both confirmed by direct
  reading (not the metrics regex pass): `require:` instead of `required:` (Mongoose schema
  option; silently ignored) in `Hemp/Category.js` and `Stilo/Category.js`; `deafult:` instead of
  `default:` (plain misspelling; the key is simply not recognized by Mongoose, so the field has no
  default at all) in `HempProducts.js` (`productPlatform`, `productBarCode`, `productQRCode`).
- **Two duplicate-key schema definitions** where the second declaration of the same field name
  silently wins: `status` in `Hyperwolf/Category.js` (lines 16 and 36) and `matchedStrains` in
  `StoreProducts.js` (lines 10 and 12).
- **Money fields are `Number` throughout** (`totalPrice`, `unitPrice`, `salePrice`,
  `productPrice`, `purchasePrice`, `margin`, promo `value`) — no cents-integer convention, no
  currency field, dollars assumed implicitly.
- **Timestamps**: only `PromoCode` uses real Mongoose `{timestamps:true}`. Every other model uses
  one of three different hand-rolled conventions: `createdAt: Date` (Promotion, Rule, Action),
  `createdDate/updatedDate: Number` (epoch — most platform models, HempProducts, StoreProducts),
  or `createdDate/updatedDate: Number` defaulted to `Date.now` (Hyperwolf/Region only).
