# promotion-engine — full data model (companion to promotion-engine.md)

No `mongoose.Schema` exists anywhere in this repo for the live request path (verified: zero hits
for `mongoose.Schema`/`new Schema(` in the whole tree). Everything below is reverse-engineered
from field access in `engine.js`, `controllers/`, `rule-types/*`, and `utils/*`, cross-referenced
against the sibling repo `promotion-backend`'s actual Mongoose schemas where that repo is the
writer of record for a collection. Every entry below is cited to at least one `path:line`.

---

## 1. `promotions` collection (shared promotions DB, `DATABASE_URL`)

Written by `promotion-backend` (schema: `promotion-backend/models/Promotion.js`, sibling repo, not
part of this audit's file set but read for cross-reference). Read/updated by this repo via the
native driver only (`db.collection("promotions")`).

| Field | Type (as used here) | Read at | Written at | Notes |
|---|---|---|---|---|
| `_id` | ObjectId | `controllers/promotion-controllers.js:183,382-383` | — | Compared as `.toString()` throughout |
| `code` | `Array<string>` | `utils/promotion-helpers.js:8-25` (`getFirstPromoCode`/`getPromoCodeList`) | — | Multiple codes per promo supported; first non-empty used as canonical |
| `status` | string (`"active"` checked explicitly) | `controllers/promotion-controllers.js:132-136,166-171`, `core/validator.js:96-102` | — | This repo's `core/constants.js:189-195` declares 5 enum values (`active/inactive/pending/expired/archived`); the actual writer (`promotion-backend/models/Promotion.js:44-47`) only allows `["active","inactive"]` — 3 of 5 values in this repo's constant can never occur |
| `platform` | string \| `string[]` | `controllers/promotion-controllers.js:133-134,166` (`$or: [{platform}, {platform: {$in:[platform]}}]`) | — | Defensive dual-shape query implies the field's shape has changed historically (single string vs. array) and both are still tolerated |
| `autoApply` | boolean | `engine.js:1477,196` | — | Default assumed `false` when absent (`?? false` at `engine.js:382`, compile time) |
| `isIndividualUsed` | boolean | `engine.js:1517` (as `promo.isIndividualUsed`) | — | "Exclusive" promo semantics — blocks all others once applied |
| `usageLimit` | number | `utils/promotion-helpers.js:94-102` | — | `<= 0` or non-finite treated as "no limit" |
| `usageLimitPerUser` | number | `utils/promotion-helpers.js:111-130` | — | Same no-limit convention |
| `promoUsage` | number | `utils/promotion-helpers.js:81-87` (fallback also reads `codeUsage`) | `controllers/promotion-controllers.js:414-417` (`$inc: {promoUsage: 1}`) | Global usage counter, incremented via `/consume-usage` |
| `codeUsage` | number | `utils/promotion-helpers.js:84` | — | Legacy fallback field name for `promoUsage` |
| `name` | string | `engine.js:1531,1600` etc. (logging/messages) | — | |
| `timezone` | string (IANA) | `core/validator.js:77-78` | — | Falls back to request `timeZone` then `America/Los_Angeles` |
| `timeMode` | `"local"` \| `"global"` (default) | `core/validator.js:81-86,125-133` | — | Controls whether `publishDate`/`expiryDate` are absolute UTC or wall-clock-in-`timezone` |
| `publishDate` / `scheduledDate` / `startDate` | Date/ISO string | `core/validator.js:107-111` | — | First non-null of the three wins |
| `expiryDate` / `expireDate` / `endDate` | Date/ISO string | `core/validator.js:113-117` | — | First non-null of the three wins |
| `rules.ruleType` | string, one of `cart/product/user` at compile dispatch, but `bogo/time/payment` are evaluated too | `engine.js:295-403` (`compilePromotion`), `engine.js:585` (evaluation switch) | — | See Rule Type Registry (§5) below for the real six-way split |
| `rules.ifRules` | `Array` (shape varies by ruleType, see `core/adapter/legacy.js`) | `engine.js:327` | — | Compiled via `compileIfRulesToLegacy` |
| `rules.thenRules` | `Array` (shape varies by ruleType) | `engine.js:352` | — | Compiled via `compileThenRulesToLegacy` |
| `rule` (top-level, sibling of `rules`) | Mixed | not read by this repo's live evaluation path | written by `promotion-backend` after calling this repo's `/compile-promotion` | **This repo ignores its own compiled output once persisted** — `safeCompile`/`compilePromotion` recompile from `rules.ifRules`/`rules.thenRules` every request (`engine.js:1270-1284`); the `rule`/`actions` fields `promotion-backend` writes based on this repo's compile response are write-only from this repo's perspective |
| `actions` (top-level) | Mixed | not read here | written by `promotion-backend` | Same as above |

---

## 2. `activecarts` collection (per-platform website DB — `HEMP_DATABASE_URL` / `HW_DATABASE_URL`)

| Field | Type | Read at | Notes |
|---|---|---|---|
| `_id` | ObjectId | `engine.js:1331` (logged) | |
| `memberId` | string | `controllers/promotion-controllers.js:107`, `engine.js:1303` | Logged-in identity |
| `cuid` | string | `controllers/promotion-controllers.js:108`, `engine.js:1304` | Alternate/legacy identity field, queried alongside `memberId` |
| `sessionId` | string | `controllers/promotion-controllers.js:110-118`, `engine.js:1306-1317` | Guest identity |
| `updatedDate` | Date | `controllers/promotion-controllers.js:126`, `engine.js:1320-1322` | Sort key, `{sort: {updatedDate: -1}}`, most-recent cart wins |
| `cartData` | `Array<CartItem>` | throughout `engine.js`/`rule-types/*` | See CartItem shape below |
| `removedPromotions` | `Array<string>` (promo codes) | `controllers/promotion-controllers.js:206` | Codes the user explicitly dismissed; re-filtering logic at `:202-211` |
| `promotionData` | object or array (dual shape tolerated) | `utils/promotion-helpers.js:45-73` (`getUserPromoUsage`) | Either `{[promoCode]: {used}}` or `[{promoCode/code, used}]` — both read |
| `promoCode` | string \| `Array<string>` | `utils/promotion-helpers.js:65-72` | Legacy fallback for usage counting |
| `walletAmount`, `walletPointsUsed`, `activeMemberWallet` | Number | `engine.js:2283-2288` | Financial fields, plain `Number`, not cents |
| `afterTaxDiscount` | Number | `engine.js:2290` | |
| `paymentOption` | string (default `"Cash"`) | `controllers/promotion-controllers.js:56`, `engine.js:2285` | |

### CartItem (element of `cartData`)

| Field | Type | Read at |
|---|---|---|
| `quantity` | Number | `engine.js:1376-1379` (synthetic-cart construction) |
| `freeGiftQty` | Number | `engine.js:1380` |
| `is_free_gift` | boolean | `engine.js:1381` |
| `discount_type` | string \| null | `engine.js:1382` |
| `promotionId` | string \| null | `engine.js:1383` |
| `discount` | Number | `engine.js:1384` |
| `totalproductprice` | Number | `engine.js:1385,1438-1442` (subtotal recompute) |
| `product` | embedded product doc (`productId`, `category_id`, etc.) | `repositories/cart.repository.js:35-40` (dead path), `engine.js:1386` |

---

## 3. `promotionusages` collection (shared promotions DB)

Per-user usage ledger, upserted only (no reads outside this repo's own write-then-read cycle).

| Field | Type | Written at |
|---|---|---|
| `platform` | string | `controllers/promotion-controllers.js:437` |
| `promotionId` | string (stringified ObjectId) | `controllers/promotion-controllers.js:429,437` |
| `promoCode` | string | `controllers/promotion-controllers.js:430,443` |
| `memberId` | string (present only if caller supplied one) | `controllers/promotion-controllers.js:420-424,438` |
| `sessionId` | string (present only if no `memberId`) | `controllers/promotion-controllers.js:420-424,438` |
| `createdDate` | epoch ms (`Date.now()`) | `controllers/promotion-controllers.js:446` (`$setOnInsert`) |
| `updatedDate` | epoch ms | `controllers/promotion-controllers.js:449` (`$set`) |
| `used` | Number | `controllers/promotion-controllers.js:451` (`$inc: {used: 1}`) |

Read back (aggregated per promo, not per-document) at `engine.js:1230-1262` to enforce
`usageLimitPerUser` at evaluation time — see §14 finding #2 in the main report for the race this
split creates.

---

## 4. Product/inventory collections (read-only from this repo's perspective)

- **`hempproducts`** — fields accessed: `productId`, `inventories` (array, filtered by region/
  active flag — `utils/common.js:1333-1421` `isActiveInventoryRow`/`getInventoryByRegion`),
  `totalQuantity`, `productName` (`rule-types/product/evaluator.js:1149-1154`).
- **`products`** (hyperwolf) — same shape family, queried by `productId`
  (`rule-types/cart/evaluator.js:1216-1217,1326-1327`).
- **`storeproducts`** (stilo) — nested shape: `products.productId`, `products.inventories`,
  `products.totalQuantity`, `products.productName`/`display_name`/`name`
  (`rule-types/product/evaluator.js:1157-1169`) — a single document holds an array/object of
  `products`, string-matched rather than ObjectId-matched.
- **`orders`** — read for user-targeting rule attributes: last order date, Nth purchase, total
  spend in N months, review status (`rule-types/user/context.js:118-142`, `utils/common.js:86-681`
  — see the ~20 analytics helper functions catalogued in the main report §16 item 9).
- **`blazeusers`** — user profile lookups: DOB, membership group, referral count
  (`rule-types/user/context.js:2-10`, `rule-types/user/evaluator.js:1084-1123`).
- **`searchhistory`** — `has_searched_for_specific_keyword` rule attribute
  (`rule-types/user/evaluator.js:1124-1140`).

---

## 5. Rule Type Registry — every attribute and action key, per rule type

This is the closest thing this service has to a "schema" — the set of condition attributes
(`ifRules`) and action types (`thenRules`) each rule type can express. Source: `rule-types/*/definition.js`.
**Six** rule types are implemented and evaluated; `core/constants.js:200-205`'s `RULE_TYPES`
constant only names four (`cart`, `product`, `user`, `segment` — `segment` has no folder or
evaluator anywhere in the repo). `bogo`, `time`, `payment` are real, live, and evaluated in
`engine.js` but absent from that constant.

### 5.1 `cart` (`rule-types/cart/definition.js`)

**Attributes** (25): `cart_total`, `cart_count`, `contains_product`, `contains_specific_product`,
`contain_specific_product`, `product_id`, `category_id`, `does_not_include`,
`category_item_count`, `quantity_same_item` (→ `item_quantity`), `bogo_eligible`,
`bogo_buy_quantity`, `bogo_get_quantity`, `free_shipping_eligible`, `payment_method`,
`items_count`, `shipping_eligibility`, `specific_period`, `cart_product_same_item_quantity`,
`specific_category_id`, `not_contain_specific_product`, `eligible_free_shipping`.

**Actions** (13): `percentage_entire_order`, `percentage_self`, `flat_entire_order`,
`flat_discount`, `free_gift`, `bogo`, `get_x_products` (commented "legacy"),
`offer_mystery_percentage_range`, `offer_free_shipping`, `tiered_discount`, `upsell`,
`spend_x_offer_x`, `spend_x_get_x`.

### 5.2 `product` (`rule-types/product/definition.js`)

**Attributes** (28): `product_id`, `category_id`, `specific_product`,
`product_purchased_quantity_greater_than_n`, `product_purchased_quantity_less_than_n`,
`product_quantity_greater_than_n`, `product_quantity_less_than_n`, `product_edition`,
`product_price`, `product_margin`, `product_brand`, `product_type`, `product_tag`, `product_thc`,
`product_cannabinoid`, `product_terpene`, `product_strain`, `product_trait`,
`product_best_seller`, `days_since_last_purchase`, `product_inventory`, `product_overstock`,
`product_lowstock`, `product_new_arrival`, `product_bought_by_20_customers_same_day`,
`buy_two_get_one_free`, `product_days_without_sale`, `product_days_of_supply`,
`product_sales_velocity`, `product_package_date`, `product_total_quantity_greater_than_n`,
`category_and_brand`.

**Actions** (19): `percentage_entire_order`, `percentage_self`, `percentage_other_product`,
`percentage_another_product`, `bundle_with_high_demand_product` (value has a **leading space** in
source: `" bundle_with_high_demand_product"`, `rule-types/product/definition.js:45`),
`highlight_as_best_seller_or_limited_edition`, `flat_entire_order`, `free_gift`, `free_product`,
`bogo`, `mystery_discount`, `free_shipping`, `tiered_discount`, `upsell`, `percentage_other`,
`offer_discount_on_third`, `low_stock_indicator`, `low_stock_urgency`,
`initiate_flash_sale_on_overstocked_items`.

### 5.3 `user` (`rule-types/user/definition.js`)

**Attributes** (23): `user_group`, `total_spend_last_n_months`, `purchase_count`,
`not_purchased_last_n_days`, `has_abandoned_cart_last_n_days`,
`has_searched_for_specific_keyword`, `brand_purchases`, `first_purchase`, `second_purchase`,
`third_purchase`, `nth_purchase`, `used_discount_x`, `campaign_source`,
`membership_duration_months`, `membership_group`, `referral_count`, `loyalty_tier`,
`review_count`, `newsletter_subscribed`, `age_range`, `specific_region_and_countries`,
`interested_brands_and_categories`, `upcoming_birthday`, `days_since_last_purchase`.

**Actions** (17): `percentage_entire_order`, `exclusive_access`, `free_shipping`,
`free_gift` (maps to value `"offer_a_free_gift"`), `send_discount_mail`, `send_discount_sms`,
`offer_limited_discount`, `giveaway_contest`, `upgrade_shipping`,
`personalized_product_recommendation` (value has spaces, not underscores:
`"personalized product recommendation"`), `offer_early_access`, `special_occasion_gift`,
`percentage`, `percentage_cart`, `percentage_specific_products`, `percentage_category`,
`percentage_brand`.

**Allowed `membership_group` values** (`rule-types/user/definition.js:52`): `Seniors`, `Veteran`,
`Employee` — a closed list enforced only at this constant, not at the database layer.

### 5.4 `bogo` (`rule-types/bogo/definition.js`)

**Attributes** (3): `bogo_eligible`, `bogo_buy_quantity`, `bogo_get_quantity` (comment: "not
currently used as a condition but mapped for completeness").

**Actions** (4): `bogo`, `get_x_products`, `get_x_categories`, `get_x_cheapest`.

`rule-types/bogo/compiler.js` is a **0-byte empty file** — this rule type has definitions and a
full evaluator (`rule-types/bogo/evaluator.js`, 908 lines) but no compiler of its own; its
condition/action compilation must be happening inside the shared `core/adapter/legacy.js` path
rather than a per-type compiler like `cart`/`product`/`user` have.

### 5.5 `time` (`rule-types/time/definition.js`)

**Attributes** (8): `date_range`, `day_of_week`, `time_of_day`, `is_holiday`, `is_flash_sale`,
`before_date`, `after_date`, `specific_period`.

**Actions** (1): `free_shipping_off_peak_hours`.

No `compiler.js` exists in `rule-types/time/` at all (only `context.js`, `definition.js`,
`evaluator.js`) — same pattern as `bogo`.

### 5.6 `payment` (`rule-types/payment/definition.js`)

**Attributes** (1): `payment_specific_type`.

**Actions** (1): `payment_method_discount_or_cashback`.

No `compiler.js` here either.

**Observation**: only `cart`, `product`, and `user` have a dedicated (dead, per main report §12)
`compiler.js`. `bogo`, `time`, and `payment` have none — meaning the single live compilation path,
`core/adapter/legacy.js`, must already handle all six rule types' `ifRules`/`thenRules` shapes in
one place, making the existence of the three dead per-type compilers even harder to justify as
"in progress" work (they'd need three more siblings to reach parity, and nothing currently uses
any of the three that exist).

---

## 6. Configuration surface (`core/config.js`, `.env.example`)

All 22 environment variables actually referenced match `.env.example` 1:1 (metrics pass confirmed
`env_missing_from_example: []`, independently spot-checked):

| Var | Default (if unset) | Validated | Purpose |
|---|---|---|---|
| `NODE_ENV` | `"development"` | enum `development\|production\|test`, required | `core/config.js:61,108` |
| `PORT` | `3040` | numeric | `core/config.js:109` |
| `INSTANCE_ID` | `"default"` | none | Only read in dead `core/concurrency.js:170` |
| `LOG_LEVEL` | `"INFO"` | none | `core/config.js:112` |
| `DATABASE_URL` | — | required, must start `mongodb` (format check has a bug — see below) | Shared promotions DB |
| `HEMP_DATABASE_URL` | — | required | Hemp website DB |
| `HW_DATABASE_URL` | — | required | Hyperwolf website DB |
| `DB_POOL_MIN_SIZE` / `MAX_SIZE` | 5 / 10 | numeric | Declared but **not actually passed** to `mongoose.createConnection` in `startup/app.init.js:11-14` (only `useNewUrlParser`/`useUnifiedTopology` are passed) — another config value that's validated but unused on the live connection path |
| `DB_SOCKET_TIMEOUT_MS` | 30000 | numeric | Same — unused on the live connection path (only read by the dead `core/db-connection-manager.js:100`) |
| `REQUEST_TIMEOUT_MS` | 30000 | numeric | Not wired to any Express timeout middleware — unused |
| `HEALTH_CHECK_INTERVAL_MS` | 30000 | numeric | Only read by dead `core/db-connection-manager.js:64-79` |
| `ENABLE_RULE_CACHING` | `true` | boolean | Loaded, never checked (§12 main report) |
| `CACHE_TTL_SECONDS` | 3600 | numeric | Passed to `initRuleCache` but the cache it configures is never called |
| `CURRENCY_DECIMAL_PLACES` | 2 | numeric | Declared and loaded into `configManager`, but the live rounding calls in `engine.js` (e.g. `:1984,2173,2242,2248`) all pass the separate hardcoded `FINANCIAL.CURRENCY_DECIMAL_PLACES` constant from `core/constants.js:11` (also `2`) instead of `configManager.get("CURRENCY_DECIMAL_PLACES")` — grepped, the config-loaded value has zero read call sites anywhere outside `core/config.js` itself; two independent sources of the same default, only one of which is load-bearing |
| `BOGO_MAX_FREE_ITEMS` | 10 | numeric | Also duplicated as `BOGO.MAX_FREE_ITEMS: 10` in `core/constants.js:32` — two sources of the same default |
| `RATE_LIMIT_ENABLED` / `_WINDOW_MS` / `_MAX_REQUESTS` | false / 60000 / 100 | boolean/numeric | Loaded; no rate-limit middleware installed anywhere (§14 main report) |
| `API_KEY` | `""` | none | Loaded; never checked by any middleware (§6 main report) |
| `AUTH_TOKEN`, `PARTNER_KEY`, `BLAZE_BASE_URL` | — | none (read directly via `process.env`, **not** through `configManager`) | Blaze outbound credentials, `utils/common.js:10-12` |

**Bug in `core/config.js:213-235`'s `validateConfig`/`validate()`**: checks
`DATABASE_URL`/`HEMP_DATABASE_URL`/`HW_DATABASE_URL` all `.startsWith("mongodb")` — but this
function (`validateConfig`, exported as `validate`) is called from `startup/config.js:7` right
after `loadAndValidate()`, which already performed its own, slightly different format check
(`core/config.js:84-91`, which checks `varName.includes("MONGODB_URI")` — a string that never
matches any of the three actual var names `DATABASE_URL`/`HEMP_DATABASE_URL`/`HW_DATABASE_URL`, so
that first check is dead code that never fires). Two redundant, inconsistent validation passes for
the same three variables, one of which (the first) can never trigger due to a name mismatch.
