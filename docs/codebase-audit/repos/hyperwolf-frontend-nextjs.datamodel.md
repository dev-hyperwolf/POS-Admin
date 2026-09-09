# hyperwolf-frontend-nextjs — Full Data Model

Companion to `hyperwolf-frontend-nextjs.md` §5/§6. This repo has no database of its own — every
type below is the frontend's own belief about what a backend response (or its own client state)
looks like, hand-maintained against `hyperwolf-backend`/`hemp-backend`/`distribution-backend`
(none of which live in this repo). All paths are relative to
`/Users/jt/hyper-tech/hyperwolf-frontend-nextjs`. Type count measured directly for this audit:
61 exported `interface`/`type` declarations across `types/*.ts` + `lib/api/*.ts` +
`lib/api/services/*.ts` (`grep -arE '^(export )?(interface|type) ' ... | wc -l`).

Every field below is exactly as declared in source; `?` denotes optional. Where a type's own
comments claim a "legacy" origin, that's quoted, not editorialized.

---

## Cart & checkout — `types/cart.ts` (260 lines, the single most-referenced type file)

### `PriceBreak` (lines 3-11)
| Field | Type |
|---|---|
| `id?` | `string` |
| `name?` | `string` |
| `price?` | `number` |
| `salePrice?` | `number` |
| `assignedPrice?` | `number` |
| `quantity?` | `number` |
| `isTaxInclusive?` | `boolean` |

### `ProductAsset` (13-18) — all required
`publicURL: string`, `thumbURL: string`, `active: boolean`, `priority: number`

### `BlazePromo` (20-25)
`isStrikeThrough?: boolean`, `salePrice?: number`, `assignedPrice?: number`, `price?: number` — name
references "Blaze" (the POS vendor used elsewhere in the Hyper-Tech estate for other brands),
suggesting this pricing shape originated from a Blaze-integrated pricing engine even though this
frontend calls `hyperwolf-backend`/`hemp-backend` directly, not Blaze.

### `Product` (27-44) — **see note below: a second, different `Product` type exists in `types/product.ts`**
| Field | Type |
|---|---|
| `id` | `string` |
| `name` | `string` |
| `websiteProductName?` | `string` |
| `brandName?` | `string` |
| `assets?` | `ProductAsset[]` |
| `priceBreaks?` | `PriceBreak[]` |
| `blazePromo?` | `BlazePromo` |
| `totalSellableQuantity?` | `number \| Record<string, number>` (union — a product can be sold as one flat quantity or per-variant, and every consumer of this field must branch on `typeof`) |
| `totalConsumerOrderQuantity?` | `number` |
| `flowerType?` | `string` |
| `weightPerUnit?` | `number` |
| `customGramType?` | `string` |
| `productSlug?` | `string` |
| `sellableQuantities?` | `Record<string, number>` |
| `webCategoryName?` | `string` |
| `tags?` | `string[]` |

### `CartItem` (46-56)
`productId: string`, `quantity: number`, `price?: number`, `name?: string`, `image?: string`,
`finalPrice?: number`, `origQuantity?: number`, `product?: Product` (the `types/cart.ts` `Product`,
not `types/product.ts`'s), `brandName?: string` — note `price` and `finalPrice` coexist with no
comment distinguishing pre-discount vs. post-discount; inferred from naming only, not documented.

### `DeliveryAddress` (58-67)
`address: string`, `city: string`, `state: string`, `zipCode: string` (capital `C` — inconsistent
with `UserLocation.zipcode` in `types/delivery-store.ts`, all-lowercase), `latitude: number`,
`longitude: number`, `country: string`, `companyId?: string`.

### `TaxMappingInfo` (69-74) / `TaxResult` (76-89)
`TaxMappingInfo`: `City?`, `County?`, `State?`, `Federal?` (all `string`, capitalized field names —
mirrors backend tax-jurisdiction naming). `TaxResult`: `totalPostCalcTax?`, `totalCityTax?`,
`totalCountyTax?`, `totalStateTax?`, `totalFedtax?`, `totalExciseTax?`, `totalNALPreExciseTax?`
(all `number`), `taxMappingInfo?: TaxMappingInfo`, plus a commented-in-code "Legacy fields that
might still be present but unused in new UI": `salesTax?`, `localCityTax?`, `exciseTax?` — the type
itself documents its own dead weight rather than removing it.

### `PromotionReq` (91-98)
`promotionId: string`, `name?`, `amount?: number`, `couponCode?: string`,
`discountAmount?: number`, plus `[key: string]: unknown` — open index signature.

### `SlotDetail` (100-106)
`slotId?: number`, `startTime?: string`, `endTime?: string`, `slotType?: string`,
`disable?: boolean` — note `disable` (not `disabled`) is the actual field name the UI branches on
per `CLAUDE.md`'s documented delivery-slot logic.

### `Cart` (108-146) — the core money-bearing type
| Field | Type | Note |
|---|---|---|
| `items` | `CartItem[]` | required |
| `promoCode?` | `string` | |
| `paymentOption?` | `string` | free-form string, not a union of known payment methods |
| `promotionReqs?` / `promotionReqLogs?` | `PromotionReq[]` | two separate arrays for "requested" vs. some kind of "logged" promotions — the distinction isn't documented in the type |
| `total?`, `subTotal?`, `subTotalDiscount?`, `totalDiscount?`, `totalBeforeTaxRounding?`, `afterTaxDiscount?`, `deliveryFee?`, `creditCardFee?`, `customTotal?` | all `number?` | every money field is a bare optional number — no currency, no cents-vs-dollars marker (confirmed dollars via formatters, §5 of main report) |
| `taxResult?` | `TaxResult` | |
| `enableDeliveryFee?` | `boolean` | |
| `splitPayment?` | inline `{ cashAmt: number, creditDebitAmt: number, paymentType: string }` | anonymous nested type, not extracted/shared with `types/split-payment.ts`'s `SplitPaymentDetails` (which uses `cashAmount`/`cardAmount`, different field names for the same concept — a third naming inconsistency for the same domain concept) |
| `dropOffOption?` | `string \| null` | |
| `dropOffInstructions?` | `string` | |
| `id?` | `string` | |
| `orderTags?` | `string[]` | |
| `completeAfter?`, `deliveryDate?` | `string \| number` | ambiguous ISO-string-or-epoch, per main report §5 |
| `creditCardDetails?` | inline `{ ccReceipt: string, creditCardFeeDetails: number }` | |
| `minimumAmount?` | inline `{ enabled: boolean, minimumAmount: number, effectiveTotal: number \| 0 }` — `number \| 0` is a redundant union (0 is already a `number`), likely a copy/paste artifact | |
| `[key: string]: unknown` | — | **open index signature — line 145. Any field not listed above still type-checks when read off a `Cart` object, silently defeating the purpose of every field listed above it.** |

### `ActiveCartData` (148-166)
`id: string`, `sessionId: string`, `cart: Cart`, `companyId?`, `pickupType?: 'Pickup' | 'Delivery'`
(capitalized union values — inconsistent with `cartType`'s lowercase values two lines below),
`deliveryAddress?: DeliveryAddress`, `consumerId?: string` (**the field at the center of the §14
IDOR finding in the main report**), `isExpress?: boolean`, `cartType?: 'asap' | 'schedule' |
'pickup'`, `dispatchRegionId?: string`, `memo?: string`, `dropOffOption?`, `dropOffInstructions?`,
`completeAfter?`, `deliveryDate?`, and again `[key: string]: unknown` (line 165).

### `PrepareCartPayload` (168-201)
Nested `cart` object with its own inline `items: {productId, quantity}[]` (a third, narrower
cart-item shape, distinct from `CartItem`), plus `deliveryAddress: DeliveryAddress` (required
here, optional on `ActiveCartData`), `companyId?`, `consumerId?`, `pickupType?`, `queueType?`,
`salesChannel?`, `cartStatus?`, `overrideInventoryId?`, `cartType?`, `source?`,
`transactionSource?`, `completeAfter?`, `deliveryDate?`, `isExpress?`, `memo?`, `slotDetail?:
SlotDetail`, and a third `[key: string]: unknown` (line 200).

### `PrepareCartQueryParams` (203-213)
`isExpress: boolean` (required), `lat?`, `long?`, `zipcode?`, `cuid?`, `dispatchRegionId?`,
`completeAfter?`, `deliveryDate?`, `overrideInventory?` — all optional strings/the usual
string-or-number date fields.

### `AddToCartParams` (215-218)
`productId: string`, `quantity?: number`.

### `CartState` (220-224) — Zustand store shape
`activeCart: ActiveCartData | null`, `isLoading: boolean`, `error: string | null`.

### `GuestDetails` (226-235)
`email: string`, `firstName?`, `lastName?`, `fullName?`, `phone: string`, `password?`,
`createAccount?: boolean`, `dob?: string` — note: date of birth collected for guest checkout too,
not just registered accounts (age-verification requirement for cannabis sales), reinforcing the
main report's §14 concern about DOB ending up in client-readable storage once a user logs in.

### `PlaceOrderParams` (241-260) — imports `User` from `./auth-store`, `UserLocation` from
`./delivery-store`, `CardDetails` from `./checkout-credit-card`
`cart: Cart`, `activeCartData?`, `activeCartId?`, `paymentMethod: string | null`, `deliveryType?:
'asap'|'schedule'|'pickup'`, `deliverySlot?: {day, time, slot: SlotDetail | null} | null`,
`userLocation: UserLocation`, `consumerId?`, `guestDetails?: GuestDetails | null`, `cardDetails?:
CardDetails | null`, `splitPaymentData?: {cashAmount, cardAmount} | null` (yet another shape for
split-payment amounts — a fourth variant alongside `Cart.splitPayment` and `SplitPaymentDetails`),
`memo?`, `dropOffOption?`, `dropOffInstructions?`, `userReferralCode?`, `referralContactId?`,
`userDetails?: User | {user: User} | null` (union that allows either a bare `User` or a wrapper
object — a sign this field's shape drifted at some point and the type was widened to match
whatever callers actually pass rather than being fixed at the call sites), `selectedAlpineRewards?:
any[]` — untyped array (AlpineIQ loyalty rewards, per the `anthropic-skills:alpineiq` domain
context — this repo doesn't type that vendor's payload at all).

---

## Products — `types/product.ts` (89 lines)

### `ProductPrice` (1-6)
`price?: number`, `salePrice?: number`, `displayPrice?: number`, `isOnSale?: boolean`.

### `Product` (8-31) — **the second, differently-shaped `Product` type; see main report §12**
| Field | Type |
|---|---|
| `id` | `string` |
| `name` | `string` |
| `slug` | `string` |
| `brand` | `{ name: string, slug?: string }` (structured — vs. `types/cart.ts`'s flat `brandName?: string`) |
| `image` | `string` (singular — vs. `types/cart.ts`'s `assets?: ProductAsset[]`) |
| `flowerType` | `string` (required here, optional in the cart-side `Product`) |
| `thc` | `string` (here a `string`; on `RawProduct` below, `number \| string`) |
| `webCategoryName` | `string` |
| `price` | `ProductPrice` (structured — the cart-side `Product` has no price field at all) |
| `tags` | `string[]` |
| `new_item` | `boolean` (snake_case field name — the only snake_case field found in `types/product.ts`, suggesting it's passed through from a raw API response field verbatim rather than normalized) |
| `totalSellableQuantity` | `number \| Record<string, number>` |
| `sellableQuantities` | `Record<string, number>` |
| `sku?`, `productSaleType?`, `description?`, `customWeight?`, `weightValue?`, `categoryId?` | all optional |

### `RawProduct` (33-89) — the "as the API actually sends it, before normalization" shape
This is the widest, messiest type in the repo — nearly every field has 2-3 alternate names the code
must check, evidence of at least one backend field-naming migration the frontend still has to
absorb at read time:
- id-like: `id?: string|number`, `_id?: string|number`, `productId?: string|number`
- category id-like: `categoryId?: string|number`
- name-like: `name?`, `websiteProductName?`, `productName?` (three names for the same concept)
- slug-like: `productSlug?`, `slug?`
- sku-like: `sku?`, `productSku?`
- brand: `brand?: {name, slug?}` AND separately `brandName?: string` AND `brandSlug?: string` (all
  three coexist on the same type)
- `assets?: Array<{mediumURL?, largeURL?, origURL?, publicURL?}>` — four different URL fields per
  asset, no indication which is canonical for which use
- `category?: {id?, _id?, name?, categoryName?, photo?: {publicURL}}` — same id/name-duplication
  pattern nested one level down
- `flowerType?`, `strainType?` (two names), `potencyAmount?: {thc?: number|string}` AND separately
  `thc?: number|string` (both present)
- `webCategoryName?`, `tags?: string[]`, `infoEffects?: string[]`, `new_item?: boolean`
- quantity: `sellableQuantity?: number` (singular) AND `totalSellableQuantity?: number|Record<...>`
  AND `sellableQuantities?: Record<string, number>` — three overlapping quantity fields
- `productSaleType?`, `deliveryTag?`
- `priceBreaks?: Array<{name?, price?, salePrice?, assignedPrice?}> | Record<string, unknown>` —
  union between an array shape and an arbitrary object, meaning consuming code must check
  `Array.isArray()` before doing anything with this field
- `unitPrice?: number`, `blazePromo?: {isStrikeThrough?, salePrice?, assignedPrice?}`
- `customWeight?`, `weightValue?`
- `productData?: RawProduct` — **self-referential**, with the type's own inline comment: "Nested
  product data in some responses" — i.e. the backend sometimes wraps a product inside another
  product-shaped envelope, and this type has to model that as a recursive optional field rather
  than a documented, distinct envelope type.

---

## Auth — `types/auth-store.ts` (27 lines)

### `User` (1-17)
`id: string`, `email: string`, `firstName?`, `lastName?`, `primaryPhone?`, `memberId?`, `dob?`,
`birthDate?` (both `dob` AND `birthDate` present — two fields for date of birth, unclear which is
canonical; this is the PII field flagged in main report §14 as landing in a plain cookie),
`memberShipGroup?`, `fullName?`, `name?` (both `fullName` and `name`), `_id?` (Mongo-style, vs. the
primary `id`), `phone?` (a second phone field alongside `primaryPhone`), `cpn?` (undocumented
3-letter field, meaning not established from context), and `[key: string]: unknown` (line 16 —
same open-index pattern as the cart types).

### `AuthState` (19-27) — Zustand store shape
`user: User | null`, `token: string | null`, `isLoggedIn: boolean`, `setAuth(user, token): void`,
`logout(): Promise<void>`, `clearAuthState(): void`, `updateUser(user: Partial<User>): void`.

---

## Delivery — `types/delivery-store.ts` (87 lines) — imports `ShopTimings` from `./shop`

`DeliveryType = 'asap' | 'schedule' | 'pickup'` (the canonical 3-mode union, referenced/re-declared
inline in several other types rather than importing this one — e.g. `types/cart.ts` re-types the
same union locally 4 times instead of importing `DeliveryType`).

`DeliverySlot`: `slotId: number`, `startTime: string`, `endTime: string`, `disable?: boolean` — a
near-duplicate of `types/cart.ts`'s `SlotDetail` (different required-ness, `slotId` is `number`
here vs `number?` there, no `slotType` field here).

`DeliverySlotsData`: `today: DeliverySlot[]`, `tomorrow: DeliverySlot[]`, `slots: DeliverySlot[]`.

`ProductCounts`: `asap: number`, `scheduled: number` (note: "scheduled" here vs. "schedule"
everywhere else in the delivery-type union — a naming inconsistency), `pickup: number`.

`UserLocation`: `lat: number`, `long: number`, `zipcode: string` (lowercase — vs.
`DeliveryAddress.zipCode` in `types/cart.ts`), `address: string`, `city: string`, `state: string`,
`addressLine2?: string`.

`DeliveryState` (the full Zustand store shape, 34-87): `deliveryType`, `selectedSlot`,
`deliverySlots`, `isLoadingSlots`, `isModalOpen`, `userLocation`, `lastSelectedLocation`,
`isLoadingLocation`, `isAddressDrawerOpen`, `productCounts`, `isLoadingCounts`, 11 setter actions,
`modalSource: 'checkout' | 'default'` + setter, `dropOffOption: 'discreetcurbside' | 'meetmydoor' |
null` + setter (a third drop-off union, distinct in spelling from `Cart.dropOffOption: string |
null` which has no union constraint at all), `dropOffInstructions`, `rememberInstructions` +
setters, `validationErrors: Record<string, string>` + setter, `shopTimings: ShopTimings | null` +
setter, `isShopOpen`, `isTodayHoliday`, `isTomorrowHoliday` + setters, `addressAvailability` +
setter. This is the single largest store shape in the repo (18 pieces of state + ~20 actions in one
store), matching the main report's note that `deliveryStore` carries a lot of orthogonal concerns
(location, slots, modal UI state, drop-off preference, shop-open status) in one place.

---

## Shop timings — `types/shop.ts` (28 lines)

`ShopTimings`: `shopOpenTime?`, `shopCloseTime?`, `specialAddressOpenTime?`, `currentTime?` (all
`string | number` — the same ambiguous date/time typing pattern seen throughout), `isClosed?`,
`isHoliday?`, `isTomorrowHoliday?`, `regionExists?` (all `boolean`), `holidayDescription?: string`,
`scheduleDeliveryStatus?: boolean`, `brbGraphic?: {mobileImages?, desktopImages?}` ("brb" = almost
certainly "be right back" — a closed-shop graphic), `comingSoonGraphic?: {imageUrl, altText}`.

---

## Category / navigation — `types/category.ts` (57 lines)

`Category` (normalized, 1-19): `id`, `categoryId?`, `name`, `slug`, `webCategoryName?`,
`webCategorySlug?`, `categoryHeading?`, `webCategoryHeading?`, `description?`, `bottomText?`,
`image?`, `bannerImage?`, `metaTitle?`, `metaDescription?`, `canonical?`,
`faq?: Array<{question, answer}>`, `adminCategories?: Category[]` (self-referential, one level of
nesting for sub-categories).

`NavigationCategory` (21-31): a slimmer duplicate of `Category` for nav-menu rendering — `id`,
`name`, `slug`, `image?`, `adminCategories?: {id, name, slug}[]` (an inline anonymous shape here,
not reusing `Category` or itself, a third variant of "category with children").

`RawCategory` (33-57): the "as received from the API" shape — same multi-name-per-concept pattern
as `RawProduct`: `_id`/`id?`/`categoryId?`, `name?`/`webCategoryName?`/`categoryName?`,
`slug?`/`webCategorySlug?`/`categorySlug?`, `categoryHeading?`/`webCategoryHeading?`/`heading?`
(three names for one heading field), `image?: string | {url: string}` (union between a bare string
and a wrapped object for the same concept), `categoryImage?: {url}`, `photo?: {publicURL}`,
`bannerImage?: {url}` (three separate image-ish fields beyond `image`), `metaTitle?`,
`metaDescription?`, `canonical?`, `faq?`, `adminCategories?: RawCategory[]`.

---

## Brand — `types/brand.ts` (5 lines)
`FilterBrand`: `id: string`, `name: string`, `brandSlug?: string`. The only brand-specific type in
the repo — brand identity elsewhere is carried as ad hoc `{name, slug?}` objects or flat
`brandName`/`brandSlug` strings on `Product`/`RawProduct` rather than reusing this type.

## Strain / trait — `types/strain.ts` (60 lines) + `types/footer.ts` (33 lines)
**`Trait` is declared twice, differently** — see main report-worthy duplication not called out in
the main report's §12 (flagging here for completeness): `types/footer.ts:20-23` declares `Trait`
as just `{traitSlug: string, mainTraitName: string}`; `types/strain.ts:1-19` declares a *different*
`Trait` with the same two required fields plus `desktopImages?`, `mobileImages?`,
`subtraits?: Array<{traitSlug, subTraitName, publicURL?}>`. Since both are named exports from
different files, whichever one a component imports depends entirely on which import path it
happens to use — TypeScript won't warn about the mismatch.

`types/strain.ts` also declares: `Flavor: {flavorType: string}`, `Effect: {url, title}`,
`RelatedStrain: {image, strainCategory, strainName, subStrainSlug}`, `StrainDetail: {image,
strainHeading, strainCategory, description, title, title2, strainName, flavors: Flavor[],
metaTitle?, canonical?, metaDescription?, faq?: any[]}` (note `title`/`title2` — unclear semantic
difference, and `faq?: any[]` is untyped despite `Category.faq` two files away being properly typed
as `Array<{question, answer}>`), `FilterTrait` (a near-duplicate of `Trait`, again).

`types/footer.ts` also declares: `WpMenuItem: {ID: number, title: string, url: string}` (WordPress
menu item — capital `ID` matches WP's own field naming, confirming this is a raw
WordPress-response shape, not normalized), `WpMenu: {items: WpMenuItem[]}`, `LegalPage: {slug,
heading, displaySettings?: {footer?: boolean}, status?: boolean}`, `FooterProps: {data: {siteMap:
WpMenu, careers: WpMenu, legalMenu: WpMenu, legalPages: LegalPage[], traits: Trait[] | {traits:
Trait[]}}}` — note the `traits` field's own union between a bare array and a wrapped object, the
same "shape drifted, type was widened instead of fixed" pattern seen on `PlaceOrderParams.userDetails`.

---

## Blog — `types/blog.ts` (52 lines)
`BlogPost`: `id`, `slug`, `state: string` (publish state, not a union — any string passes),
`title`, `excerpt`, `content: string[]` (an array of strings, not a single body — suggests
block-based content from the CMS), `featuredImage?`, `category: string[]`, `author: {name, slug,
description, socialMediaLinks: [], image: {url, title, description, alt}}` (note
`socialMediaLinks: []` — typed as the literal empty-array type, meaning TypeScript will reject any
actual links being placed there; almost certainly meant to be `string[]` or similar, a real type
bug), `createdDate`, `updatedAt`, `metaTitle?`, `metaDescription?`, `faqStatus: boolean`, `faq:
any[]` (untyped again), `readTime?: number`, `relatedBlogData?: BlogPost[]` (self-referential),
`image: {url, title, description, alt}` (duplicates the shape already nested inside `author.image`
— could be a shared `WpImage` type but isn't).

`BlogListResponse`: `posts: BlogPost[]`, `total: number`, `totalPages: number`, `currentPage:
number`.

`BlogFilters`: `page?`, `limit?`, `category?`, `tag?`, `search?`.

---

## Reviews — `types/reviews.ts` (89 lines, Reviews.io integration)
Cleanly split into "raw API" and "UI view model" halves — the best-organized type file in the repo:

Raw: `GetAllReviewsParams` (query params for `GET /reviews`: `store?`, `type?:
'store_review'|'product_review'|'store_third_party_review'|'questions'`, `per_page?`, `page?`,
`minRating?`, `sort?`, `keyword?`), `ReviewsApiAuthor: {name?, location?}`, `ReviewsApiReply:
{comment?, comments?, text?, body?}` (four alternate field names for "the reply text" — the type's
own comment says "Raw API — only fields we read"), `ReviewsApiReviewItem: {id, source?, rating?,
comments?, author?, date_created?, time_ago?, verified?: number (0/1 flag typed as number, not
boolean), replies?}`, `ReviewsApiStatsCompany: {review_count?, average_rating?: string}` (rating
as a string, not a number), `ReviewsApiResponse: {reviews?, stats?: {company?, ratings?:
Record<string, number>}, results_count?, review_count?, average_rating?}`.

View model: `ReviewCardView` (normalized shape a component actually renders — `id`, `initials`,
`authorName`, `verified: boolean` (normalized from the raw `number` flag), `dateLabel`, `rating:
number`, `sourceVariant: 'reviewsio'|'google'|'other'`, `sourceLabel`, `body`, `replyBody?`),
`ReviewStarBreakdownRow: {star, count, percent}`, `ReviewsSummaryView: {averageDisplay: string,
companyReviewCount: number, breakdown: ReviewStarBreakdownRow[]}`, `ReviewsPagePayload: {cards,
summary, resultsCount, page, perPage}`.

---

## Rewards / loyalty — `types/reward-store.ts` (31 lines)
`Reward: {id, name, dollarValue: number, pointsDeduction: number}` — `dollarValue` is the one
explicitly currency-named money field in the entire codebase (everywhere else it's just `price`/
`total`/`amount`), but it's still a bare `number`, same float-dollars convention as everywhere
else. `WolfPackRewards: {wolfPackObject?: {totalOrder?: number}, [key: string]: unknown}` — open
index signature again, and this is the type for the WolfPack loyalty program status object, which
per main report §3 is fetched proactively on every login. `RewardState` (Zustand shape): `rewards:
Reward[]`, `loyaltyPoints: number`, `selectedRewards: Reward[]`, `wolfPackRewards:
WolfPackRewards | null`, `isLoading`, `isWolfPackLoading`, `error: string | null`, plus 6 actions
(`fetchRewards`, `fetchWolfPackRewards`, `toggleReward`, `clearRewards`, `resetRewards`,
`getLoyaltyPointsUsed`).

---

## Checkout sub-types

`types/checkout-credit-card.ts` (10 lines): `CardDetails: {cardNumber: string, expiryDate: string,
cvv: string}` — **raw card number and CVV typed as plain strings held in component state**; this
type by itself says nothing about PCI handling (whether these ever leave the browser toward this
app's own server vs. going straight to a PCI-compliant processor's iframe/tokenization endpoint
was not traced in this pass — flagged as an open question in the main report if not already
covered, since `CardDetails` flows into `PlaceOrderParams.cardDetails` in `types/cart.ts:251`,
which is passed to a Server Action, meaning raw card data does appear to transit through this
app's own server-side code path rather than being tokenized purely client-side). Also
`CheckoutCreditCardProps: {onChange: (details, isValid) => void, disabled?: boolean}`.

`types/checkout-guest-info.ts` (36 lines) — the one type file that also defines runtime validation,
not just shapes: `guestSchema` (Zod) requires `email` (valid email), `phone` (exactly 10 digits
after stripping non-digits), `createAccount: boolean`, `password?` with a cross-field `.refine()`
requiring 6+ chars only when `createAccount` is true. `GuestFormValues = z.infer<typeof
guestSchema>`. Plus `CheckoutGuestInfoRef: {validate: () => Promise<boolean>}` and
`CheckoutGuestInfoProps`.

`types/split-payment.ts` (20 lines): `SplitPaymentDetails: {cashAmount, cardAmount, cardFee,
totalCardCharge}` (all `number`) — the field names here (`cashAmount`/`cardAmount`) differ from
`Cart.splitPayment`'s inline shape (`cashAmt`/`creditDebitAmt`) and from
`PlaceOrderParams.splitPaymentData`'s inline shape (`cashAmount`/`cardAmount`, matching this file
but as an anonymous type, not reusing it) — three shapes for the same concept across two files,
none reusing this one consistently. `SplitPaymentModalProps`, `CheckoutSplitPaymentProps` round out
the file.

`types/product-add-to-cart.ts` (21 lines): `ProductAddToCartProps` — the props for the
"add to cart" button component. Notably carries its own copies of `deliveryType`, `totalSellableQuantity`,
`sellableQuantities`, `price`, `brandName`, `flowerType` rather than accepting a single `Product`
prop — a sign this component's prop surface grew organically field-by-field rather than being
designed against the `Product` type up front, plus an explicit `addToCart?` prop commented
`// Legacy prop for backward compatibility`.

---

## Generic API shapes — `types/api.ts` (42 lines)

`ApiResponse<T>: {data: T, message?: string, success: boolean}` — the documented generic response
envelope, but per main report §6 nothing actually validates that a given response matches
`ApiResponse<T>` at runtime; it's a compile-time assertion only.

`PaginatedResponse<T>: {items: T[], total: number, page: number, limit: number}` — the type's own
comment says "if needed later," and indeed no consistent evidence was found that every paginated
endpoint in `lib/api/services/*` actually returns this exact shape (main report §6, "pagination
conventions... not measured" beyond this declared-but-possibly-aspirational type).

`SearchQueryParams` (17-42) — the single largest "kitchen sink" params type, used across product/
search/category fetches: `deliveryType?: 'asap'|'schedule'|'pickup'|string` (a union that also
allows *any* string, which defeats the point of the three-value union preceding it), `lat?`,
`long?`, `zipcode?`, `cuid?` (this is the `consumerId` alias used at the HTTP-query-param layer —
see main report §14, this is the field name that actually goes out on the wire), `isExpress?`,
`page?`, `limit?`, `search?`, `sortBy?`, `order?`, `categorySlug?`, `mainCategorySlug?`,
`brandId?`, `brandSlug?`, `strainId?`, `traitId?`, `subtraitId?`, `dispatchRegionId?`, `userId?`,
`companyId?`, `type?`, `searchTerm?` (both `search` and `searchTerm` present — unclear which is
actually read backend-side), plus `[key: string]: QueryParamValue` — an open index signature typed
to a specific value union (`string | number | boolean | string[] | undefined | null`) rather than
fully open `unknown`, at least constraining *values* even though *keys* are unconstrained.

---

## Cross-file naming inconsistencies (summary, for anyone about to touch this code)

- **Delivery-type union re-declared 5+ times** instead of importing `DeliveryType` from
  `types/delivery-store.ts`: `types/cart.ts` (×4 inline), `types/product-add-to-cart.ts` (×1
  inline).
- **`Product` exists twice** with different shapes (`types/cart.ts:27`, `types/product.ts:8`).
- **`Trait` exists twice** with different shapes (`types/footer.ts:20`, `types/strain.ts:1`), plus
  a third near-duplicate `FilterTrait` (`types/strain.ts:52`).
- **Split-payment amounts have three different field-name pairs** across two files:
  `cashAmt`/`creditDebitAmt` (`types/cart.ts` `Cart.splitPayment`), `cashAmount`/`cardAmount`
  (`types/split-payment.ts` `SplitPaymentDetails`, and again inline on
  `PlaceOrderParams.splitPaymentData`).
- **Open index signatures (`[key: string]: unknown`)** appear on `Cart`, `ActiveCartData`,
  `PrepareCartPayload` (`types/cart.ts`), `User` (`types/auth-store.ts`), `PromotionReq`
  (`types/cart.ts`), and `WolfPackRewards` (`types/reward-store.ts`) — six of the highest-traffic
  types in the app, all with an escape hatch that lets any additional field through unchecked.
- **`any[]`/`any` fields survive `"strict": true`** on `BlogPost.faq`, `StrainDetail.faq`,
  `PlaceOrderParams.selectedAlpineRewards` — TypeScript strict mode does not catch explicit `any`.
- **Multiple id/name/slug aliases per concept** are the norm, not the exception, on every "raw API"
  type (`RawProduct`, `RawCategory`) — strongly suggestive of at least one backend field-rename
  that was absorbed by widening the frontend type rather than by a coordinated rename.
