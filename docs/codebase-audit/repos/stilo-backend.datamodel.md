# stilo-backend — full data model

Repo: `/Users/jt/hyper-tech/stilo-backend` @ `a9f4407`. Source: every file in `models/` (55
files, 56 registered Mongoose models — `Miscellaneous.js` registers the same schema on both
connections under one filename). All fields read directly from source; no README/comment
inference. Money fields: **zero** `Decimal128` usage anywhere in `models/` — every currency
field is a plain `Number` (float), stored as whole/decimal dollars, never cents.

Two live Mongoose connections opened in `startup/db.js`: **conn1** = `DATABASE_URL` (Stilo's own
DB — 48 models), **conn2** = `HEMP_DATABASE_URL` (8 models — literally the Hemp brand's database
URL, reused for Stilo's own Admin/Legal/traits data — see main report §3/§16).

Multi-tenancy key: `storeId` (plain `String`, not a ref to `Store._id`, appears in ~20 of the 56
models — no schema-level `required`/`ref` enforcement in most of them). Soft-delete convention:
**none** — no `isDeleted`/`deletedAt` field exists anywhere; "deactivation" is done via an
inconsistently-typed `status` field (`Boolean` in some schemas, `String` in others — see table).
IDs: Mongo `ObjectId` default `_id` everywhere, plus a large number of separate app-generated
`String` id fields (`storeId`, `productId`, `orderId`, `memberId`, `roleId`, `ruleId`, `taxId`,
`brandId`, `cannabinoidId`, `regionId`, `inventoryId`, `approvalId`, `branchId`, `paymentId`) —
none of these are Mongoose `ref`s, so cross-collection "joins" are all done in application code by
matching plain strings, not `.populate()`.

Real `ref:` relations found (rare — only 4 in the whole model layer):
- `Blog.author._id` → `ref: "Author"` (models/Blog.js:208) — **mismatched**: the actual
  registered model name is `Authors` (models/Authors.js:177), not `Author`. `.populate('author')`
  on this path will silently fail to resolve.
- `PrinterSetup.userId` → `ref: 'StoreUser'` (models/PrinterSetup.js:1369)
- `SubProductTraits.traitId` → `ref: 'MainProductTraits'` (models/SubProductTraits.js:1938)
- `POSCheckIn.checkInData[].memberId` → `ref: "Member"` but typed `String`, not `ObjectId`
  (models/POSCheckIn.js:1309) — populate on a String ref only works if it exactly matches the
  target's `_id` string form; here `memberId` is Member's app-level id field, not `_id`, so this
  ref is very likely non-functional.

Given the near-absence of real refs, "most central" models are the ones whose plain-string id is
carried by the most other collections: **Store/StoreUser** (`storeId` in ~20 models),
**Member** (`memberId` in Order, ActiveCart, POSCheckIn, ResetRequest-adjacent flows),
**Order** (`orderId`/`_id` referenced from NotificationData, TransactionLog, ProductBatch flows),
**StiloProducts/StoreProducts** (`productId` referenced from ProductBatch, Approvals).

Auth-token-issuing models (JWT signed with the single shared `JWT_ADMIN_PRIVATE_KEY` secret —
see main report for why "private key" is a misnomer): `Admin.generateAuthToken`
(models/Admin.js:22-25), `Store.generateAuthToken` (models/Store.js:49-52, no `isSuperAdmin`
claim), `StoreUser.generateAuthToken` (models/StoreUser.js:35-38). All three: 2-day expiry,
HS256 (implicit default), payload = `{_id, email[, isSuperAdmin]}`.

Explicit indexes in the entire model layer (3 files out of 56 — everything else relies solely on
the implicit index Mongoose creates for `unique: true` fields):
- `Blog` (models/Blog.js:262-264): `{title:1}` unique, `{status:1, createdDate:-1}`, `{category:1}`
- `MainProductTraits` (models/MainProductTraits.js:993-994): `{mainTraitName:1, status:1}`, `{traitSlug:1}`
- `StoreCoordinates` (models/StoreCoordinates.js:1772): `{coordinates:'2dsphere'}`

None of `Order`, `Member`, `StiloProducts`, `StoreProducts`, `ActiveCart`, or `TransactionLog` —
the collections the busiest controllers query by `storeId`/`status`/`createdDate` — have any
explicit index. See main report §15 for the performance implication.

---

## Per-model field dump

Format: **ModelName** (file, connection) — schema `{ versionKey:false, minimize:false }` unless noted.

**ActiveCart** (ActiveCart.js, conn1) — memberId String(req), storeId String, sessionId String,
email String(req), cartData Object(req), deliveryAddress Object, afterTaxDiscount Number,
memberData Object, paymentOption String, shippingCharges Number(default 0, **declared twice**
at lines 15 and 19), deliverySpeed String, deliveryType String, shippingType String(default
"standard"), walletAmount/walletPointsUsed/activeMemberWallet Number, taxResult Object, subTotal/
total Number, rewardTemplates Array, creditCardDetails Object, totalTax Number, taxDetails
Object, weightSummary Object, promotionData Object, promoCode String, memo String, splitPayment
{cash Number, credit Number}, reminderSent Number(default 0), holdReset Number(default 0),
createdDate/updatedDate Number(req). No indexes. No timestamps option (uses manual
createdDate/updatedDate Numbers, as does virtually every model below — pattern is universal).

**ActivityLog** (ActivityLog.js, conn1) — registered as `ActivityLogs`. source/logsType/updatedBy
String(default ''), newChanges/previousChanges Mixed, createdDate Number.

**Admin** (Admin.js, conn2) — firstName/lastName/name/email/password/phone/status String,
stores Array, pin String, userRoles Array, createdDate/lastLogin Number, isSuperAdmin
Boolean(default false), deviceToken Array(default []). `generateAuthToken` method
(line 22) signs `{_id, email, isSuperAdmin}`. No enum on `status` (free-text String, values
observed in controllers: "inactive"/other) or `userRoles` (free Array, privilege membership is
just an array of role-name strings, e.g. "Super Admin" — see main report Critical finding).

**Approvals** (Approvals.js, conn1) — approvalId String(req,unique), productId String(req,
**unique** — meaning a product can only ever have ONE approval record, likely a modeling bug if
approvals are meant to be resubmittable), storeId String(req), productName/overrideProductName/
productImage/sku/brandName/categoryName String(default ""), productPlatform Array(default
['ecommerce']), isAccept/isDeclined/isOverride Boolean(default false), declinedReason/status
String, totalQuantity/unitPrice Number(default 0) — **money field**, createdDate/updatedDate
Number(default Date.now).

**Authors** (Authors.js, conn2) — registered model name `Authors` (not `Author` — see Blog
mismatch above). Nested `imageSchema` (url/title/description/alt, `_id:false`),
`socialMediaLinkSchema` (platform/link/status Boolean default true/imageUrl, `_id:false`). Top:
image, name String(req), description String, socialMediaLinks [socialMediaLinkSchema],
createdBy String, createdDate/updatedDate Number(default Date.now), slug String,
authorSlugArray Array, canonical String. `minimize:true` (only model that overrides the default).

**Banners** (Banners.js, conn1) — desktop_image/mobile_image/media_type/url String,
banner_position String(default ''), createdDate/updatedDate Number.

**Blog** (Blog.js, conn1) — title String(req,unique), slug/description String, category
[String], author {_id ObjectId ref:"Author" **(mismatched, see above)**, name, slug}, tags
[String], content Array, image/listingImage {title,url,description,alt}, metaTitle/
metaDescription String, **status enum ['published','draft'] default "draft"**, faqStatus
Boolean(default true), faq [{question,answer}], blogSlugArray Array, canonical String, state
String(default ""), readTime Number(default 0), relatedBlogStatus Boolean, relatedBlogData
[RelatedBlogSchema{blogId String(req), title String}], scheduleBlogStatus Boolean,
scheduleDate/scheduleTime String(default null), createdDate/updatedDate Number. 3 indexes (see
above) — the only model with a compound query-shaped index.

**BranchSetting** (BranchSetting.js, conn1) — branchId String(req,unique), branchName
String(req), storeId String(req), email String(req,unique,lowercase — validator commented out),
phone String(req,unique, regex-validated /\d{10}/ — **weak: matches any string containing 10
consecutive digits, not a bounded-length phone number**), kml String(default ""), status
Boolean(default true), address Object(default {}), createdDate/updatedDate Number(default
Date.now).

**Brand** (Brand.js, conn1) — brandId/brandName/metaTitle/metaDescription String, description
String(default ""), **status String(default `false`)** — type/default mismatch (String field
defaulting to a Boolean literal), image/listingImage {title,url,description,alt}, createdBy
String, createdDate/updatedDate Number, description_left_side/description_right_side/
brandHeading String, brandSlugArray/brand_left_side/brand_right_side Array(default []),
isBestBrand/isPopularBrand Boolean(default false), title2/subBrandSlug/brandSlug/canonical
String. Joi validation function exported alongside (not schema-enforced).

**Cannabinoid** (Cannabinoid.js, conn1) — cannabinoidId String, cannabinoidName String(req,
unique), status Boolean(default false), tags Array(default []), title/description/description1/
description2/listImage/detailImage/canonical/metaTitle/cannabinoidHeading String,
cannabinoidSlugArray Array, detailImageAlt/listImageAlt String(default ""), metaDescription/
cannabinoidSlug/createdBy String, createdDate Number(default Date.now), updatedDate Number.

**CannabinoidBanners** (CannabinoidBanners.js, conn1) — desktop_image/mobile_image/media_type/url
String, createdDate/updatedDate Number.

**CannabisLimit** (CannabisLimit.js, conn1) — state String, memberType String(req), storeId
String(req), cannabisType String(req), limit Number(req) — compliance-critical quantity limit,
customUomAbbrev/displayName String, createdDate/updatedDate Number(default Date.now).

**CartRules** (CartRules.js, conn1) — ruleId String, ruleType String(default ""), minAmt/maxAmt
Number(default 0) — **money fields**, createdDate/updatedDate Number.

**Category** (Category.js, conn1) — categoryName String(req,unique), categoryMenuName/
categoryHeading/bannerHeading String, categoryImage String(default ""), categorySlugArray
Array(default []), categoryType String, **status String(default `false`)** (same
type/default mismatch as Brand), category Object, categoryId String(req,unique), description
String, image String(default ""), listingImage/bannerImage/bannerMobileImage
{title,url,description,alt}, metaTitle/categorySlug/metaDescription/heading String, canonical/
bottomText String(default ""), productInstructions String, faq Array(default []), createdBy
String, createdDate/updatedDate Number.

**Employee** (Employees.js, conn1) — registered model name `Employee`. name/email/phone/password
String, createdDate Number. No status/role/permission fields at all — appears unused/vestigial
relative to the Admin/StoreUser role system (grep controllers for actual usage before assuming
it's live).

**ErrorLog** (ErrorLogs.js, conn1) — reqBody/errorMsg/errorSource/createdDate/createdTime/
timeStamp all String (including `reqBody`, which stores serialized request bodies as text — used
elsewhere as a de-facto webhook/event log, see main report §8 `revenueKitWebhook`).

**Faq** (Faq.js, conn1) — uniqueId String, faq [{question,answer}], createdDate/updatedDate
Number.

**Inventory** (Inventory.js, conn1) — inventoryId String(req,unique), inventoryName String(req),
regionId String(default ""), quantity Number(default 0), status String(default 'Inactive'),
createdDate/updatedDate Number.

**Legal** (Legal.js, conn2) — large nested-section CMS schema: `sectionSchema`/`faqSchema`/
`teamMemberSchema` (all `_id:true`) reused across headerSection/topicSection/bottomSection/
teamSection/brandStorySection/customerExperienceSection/testimonialsSection/jobOpeningsSection,
each with pageTitle/status Boolean/section-or-array. `platformAvailability` {hyperwolf, hemp,
stilo, all — all Boolean default false} — explicit multi-brand flag object (this is the pattern
used across the estate to mark shared/legal-content visibility per brand). displaySettings
{hamburgerMenu, footer}. metaProperties {title,description,canonical,updatedBy}. faq
{status,section:[faqSchema]}. uniqueId/slug/description/metaTitle/metaDescription/canonical/
heading String, status Boolean(default false), createdBy String, createdDate/updatedDate Number.
This file is 166 lines and byte-identical to `hyperwolf-backend:models/Legal.js` per the
cross-repo scan.

**Log** (Log.js, conn1) — reqBody/reqParams Array, lastEntry/createdDate String.

**MainBrand** (MainBrand.js, conn1) — metaTitle/metaDescription/description/image/title/
createdBy String, createdDate Number, canonical/brandName String. (Distinct from `Brand` above —
two separate "brand" collections with overlapping purpose; see main report duplication section.)

**MainCannabinoid** (MainCannabinoid.js, conn1) — same shape as MainBrand with
`cannabinoidName` instead of `brandName`.

**MainProductTraits** (MainProductTraits.js, conn2) — status enum ['Active','Inactive']
default 'Active', traitId String, displaySettings {showInMenu, showInFooter Boolean default
false}, traitHeading/traitSlug String, desktopImages/mobileImages
[{mediaType enum['image','video'] req, imageUrl String(regex-validated file-extension URL, req),
redirectUrl/altText String}], mainTraitName/canonical/title/description1/description2/
metaTitle/detailImageAlt/listImageAlt/metaDescription String, traitSlugArray Array(default []),
platformAvailability {hyperwolf,hemp,stilo,all Boolean default false} (same per-brand-flag
pattern as Legal), faq Array(default []), createdBy String, createdDate Number(default
Date.now), updatedDate Number, updatedBy String. 2 indexes (see above). File opens with a
runtime `console.warn`/`console.log` connection-check side effect at module-load time
(lines 923-927) — unusual for a model file, and its `console.log` fires on every successful
`require()`, i.e. every process start, not just once.

**MainStrain** (MainStrain.js, conn1) — same MainBrand/MainCannabinoid shape with `strainName`.

**Member** (Member.js, conn1) — the customer/patient record. memberId String(req), dob/age
Number, diditSessionId String, diditRegisterUrl String, walletAdjustmentReason String, email
String(req), phone String, password String(default ""), firstName/lastName String(default "",
trim), fullName String(default ""), licenseNumber/idImage/recId/rec/issueDate/dlExpiration
String(default ""), selfiePhotoUrl String, medicinaldlExpiration/recPhoto String(default ""),
gender/memberType String(default ""), memberShipGroup String(default "Delivery"),
deliveryAddress Object(default {}), deliveryAddresses [addressSchema (strict:false, free-form)],
physician Object, idAddress Object(default {}), klaviyoProfileId String(default ""), inquiryId
String, verifyMethod String(default ""), status Boolean(default true), isVerified Boolean
(default false), ageCheckerUid String(default ""), guestCheckout/vipMember Boolean(default
false), walletAmount Number(default 0) — **money field, wallet balance stored as float Number**,
memberNotes String(default ""), notesAttachment Array(default []), memberNotesEmployee String
(default ""), notesTime Number, storeId String(default ""), hotNotes Array(default []),
memberPlatform Array(default []), averageSpent Number(default 0) — **money**, profileImage
String(default ""), idImages Object, blockOnlinePayments {status Boolean, blockedReason String,
blockedDate Number, blockedBy String}, createdDate/updatedDate Number. No index on `memberId`,
`email`, or `storeId` despite this being the identity-verification/PII-heaviest collection in
the system and queried constantly by all three (memberId/email/phone).

**MemberWalletReasons** (MemberWalletReasons.js, conn2) — reasonId String, reasonStatus Boolean
(default true), walletReason String(default ''), createdDate/updatedDate Number.

**Miscellaneous** (Miscellaneous.js — registers on BOTH connections) — uniqueId/storeId String,
data Mixed, createdDate/updatedDate Number. Exported as `Miscellaneous` (conn1) and
`MiscellaneousConn2` (conn2) — same schema object reused for two physically different
collections; a write through one export never appears in the other.

**NotificationData** (NotificationData.js, conn1) — orderId/notificationId/storeId String
(default ''), email String, notificationData Object, readStatus Boolean(default false),
notificationType String(default ''), notificationMetaData Array(default []), createdDate
Number.

**Order** (Order.js, conn1) — the largest transactional model (102 lines / ~60 fields).
Highlights: memberId/email String, emailStatus String(default 'pending'), paymentOption String,
promoCode Object(default {}), klaviyoProfileId/memo String, shipStationOrderId Number(default
0), orderKey String(default ""), items Array(default []), orderId String(default ''), userData/
deliveryAddress Object(default {}), creditTransactionId/createdBy String(default ""),
afterTaxDiscount Number(default 0) — **money**, reviewStatus/returnRequestStatus/
returnApprovedStatus Boolean(default false), approvedItems Array(default []), returnComments/
approvalComment String(default ""), alpineIQPoints Number(default 0), walletAmount Number
(default 0) — **money**, shippingType String, shippingCharges Number(default 0) — **money**,
storeDetails Object, creditCardDetails Object, rewardTemplates Array, cancellationReason String
(default ""), trackingId/serviceName String(default ""), returnItems Array, walletPointsUsed
Number, medicinalRecApproval Object, sessionId String, promotionData/productPromo Object
(default {}), orderPlatform String(default ""), splitCardAmount/cashReceived/balanceLeft Number
(default 0) — **money**, source String(default "Stilo"), deliveryType String(default
"Pick-up"), deliverySpeed String, subTotal/total Number — **money**, splitPayment {cash,credit
Number}, receipt String, taxDetails Object, totalTax Number(default 0) — **money**, netProfit
Number(default 0) — **money, and a margin figure kept on the order document itself**,
netPercentage Number(default 0), reviewsEmailSent Number(default 0), returnRequestDate Number,
storeId String(default ""), shippedDateTime/deliveredDateTime/canceledDateTime Number(default
0), discountType String(default ""), discountValue/itemsDiscount/percentagediscount Number
(default 0) (**`percentagediscount` field is declared twice**, lines ~1233 and ~1241 — the
second silently wins), createdDate Number, splitTotal Number(default 0), deliveredDate Number
(default 0), dropOffOptions String(default ""), activeMemberWallet Number, receiptImage/receipt
String (**`receipt` also declared twice**, lines 1219 and 1240), fulfillmentStatus String
(default "todo"), amountHeading String, posCCtxId String, packedDate/amountReceived/
balanceLeft Number (**`balanceLeft` declared twice**, lines 1208 and 1247), inProgressDate
Number, fulfilledBy/paidStatus String, packageProof [{uploaderName,proofImage,createdDate,
userId}], updatedDate Number. **No index at all** on `storeId`, `status`-equivalent
(`fulfillmentStatus`), `memberId`, or `createdDate` despite Order being the model every
dashboard/reporting aggregate pipeline scans.

**OrderManager** (OrderManager.js, conn1) — uniqueId String, order [ObjectId], createdDate
Number.

**OrderTracker** (OrderTracker.js, conn1) — uniqueId String, slotDetails
[{slotId Number, orders [String], regionData
[{dispatchRegionIdBlaze String, orderPlaced Number, limit Boolean(default false)}]}],
createdDate/updatedDate Number.

**POSCheckIn** (POSCheckIn.js, conn1) — registered as `POSChekIn` (typo baked into the model
name/collection, present in source not just this summary). uniqueId String(req), storeId
String, checkInData [{memberId String ref:"Member" (see mismatch note above), checkInId/action/
orderId String, checkInTime/checkOutTime/createdDate Number, memberName/updatedBy/checkedInBy
String}], createdDate/updatedDate Number(default Date.now).

**PaymentSetting** (PaymentSetting.js, conn1) — paymentId String(req,unique), paymentClientId/
paymentSecretId String(req) — **NMI/payment-processor client+secret IDs stored in the primary
transactional database as plain schema fields, not a secrets manager**, storeId String(req),
paymentMode enum['test','live'] default 'test', paymentStatus Boolean(default true),
createdDate/updatedDate Number(default Date.now).

**Physicians** (Physicians.js, conn1) — registered as `Physicisans` (typo in the model name/
collection). firstName/lastName String(default "", trim), fullName String(default ""), email
String(req), phone String(unique), status Boolean(default true), createdDate/updatedDate Number
(default Date.now).

**PrinterSetup** (PrinterSetup.js, conn1) — userId ObjectId ref:'StoreUser' (req), storeId
String, mode enum['Network','USB'] req, ipAddress String(conditionally required when
mode==='Network'), createdDate/updatedDate Number(default Date.now).

**ProductBatch** (ProductBatch.js, conn1) — productId/storeId String, batchData
[{productBatchId String, purchaseDate/uniqueNumber(mistyped field order)/expirationDate Number/
String, status/trackingSystem/barcodeImage/qrcodeImage String, purchaseQuantity/
currentQuantity/unitCost/price Number (**money**), createdDate/updatedDate Number,
soldPercentage Number(default 0)}]. ~65 lines of commented-out `post('save')`/`post('remove')`/
`post('findOneAndDelete')` hooks (lines 1423-1487) left in place — dead code that references a
`Product` model name that doesn't even exist in this repo (it's `StiloProducts`/`StoreProducts`
here), so re-enabling it as-is would throw a ReferenceError.

**ProductRules** (ProductRules.js, conn1) — ruleId String, ruleType String(default ""),
categoryIds/productIds/brandIds/productTags Array(default []), minAmt/maxAmt Number(default 0)
— **money**, discountType String(default ""), discountAmt Number(default 0) — **money**,
createdDate/updatedDate Number.

**Promotion** (Promotions.js, conn1) — promotionId/promoName String(default ''), status
Boolean(default false), promotionType/promoDescription String(default ''), isStackable Boolean
(default false), promoCodes Array(default []), autoApply Boolean(default false), discountType
String(default ''), criteriaGroups Array(default []), availableUnits Number(default 0),
membershipGroup Boolean(default false), membershipGroupType String(default ""), discountAmount
Number — **money**, startDate/endDate Date (**the only two real `Date`-typed fields in the
entire model layer** — every other timestamp in the codebase is a raw `Number`), startTime/
endTime String, promoTimeStart Number, images Array, maxAvailableCustomer Number, cashUpto
Number — **money**, target Array(default []), sun/mon/tue/wed/thu/fri/sat Boolean(default
false) (day-of-week flags as 7 separate fields rather than an array/bitmask), createdDate/
updatedDate Number.

**RefundReasons** (RefundReasons.js, conn2) — reasonId String, reasonStatus Boolean(default
true), refundReason String(default ''), createdDate/updatedDate Number.

**Region** (Region.js, conn1) — regionId/regionName String(req), status String, openingHours/
closingHours Number, kml String(default ""), createdDate/updatedDate Number.

**ResetRequest** (ResetRequest.js, conn1) — phone/firstName String, email String(default ""),
lastName/token String, userData Object, createdDate Number. No TTL/expiry field or index on this
password-reset-token collection — tokens appear to live forever unless deleted by application
code (not verified here).

**StiloProducts** (StiloProducts.js, conn1) — the canonical/global product catalog (as opposed
to `StoreProducts`, the per-store copy — see main report duplication note on this data-modeling
choice). productId String(unique), productName String(trim), productImages Array(default []),
sku String(default '', unique), productPrice Number — **money**, status/productSlug/brandSlug
String, isSalePrice Boolean(default false), unitPrice/salePrice Number — **money**, brandName/
createdBy/updatedBy String, category Object, updatedDate/createdDate Number, customWeight/
thcData String, ingredients/instructions String(default ''), ingredientStatus/
instructionStatus Boolean(default false), totalQuantity/holdQuantity Number(default 0),
inventoryTrend Array(default []), isBestSeller/isFeatured/isCustFav Boolean(default false),
isSuperAdminProduct Boolean(default **true**), proportionalDiscount Number, inventories
[{status,quantity Number,regionId String(default ''),inventoryId,inventoryName String}],
productBatches Array(default []), categoryName String(default ''), tags Array(default []),
strainSlug/strainType String(default ''), infoEffects Array(default []), brandDescription/
productDescription String(default ''), purchasePrice Number(default 0) — **money (cost
basis)**, margin Number(default 0) — **money/percent, ambiguous which**, productPlatform Array
(typo `deafult` instead of `default`, so this field's default silently never applies —
line 1672), productBarCode/productQRCode String (same `deafult` typo, lines 1673-1674),
productSlugArray Array(default []), productTraits/matchedStrains Array, seoData
{canonical,metaTitle,metaDescription,heading}, reviews Object(default {}), terpenoids Array,
productDisclaimer String(default '').

**Store** (Store.js, conn1) — storeId String(req,unique), storeName/firstName/lastName String
(req), contactName String, email String(req,unique, validator commented out), phone String(req,
unique, weak /\d{10}/ validator as in BranchSetting), storeImage/subscription String,
valiDateFrom/valiDateTo Number, status String(default ""), address Object(default {}), password
String, klaviyoProfileId String, PIN String — **a store-level PIN stored in plain schema field,
alongside a separate bcrypt-hashed `password` — check whether PIN is hashed anywhere in
controllers, not verified here**, kml String(trim), isLifeTime/isViewUser Boolean(default true),
deviceToken Array(default []), roleId/roleName String(default ""), batchStatus Boolean(default
false), createdDate/updatedDate Number(default Date.now). `generateAuthToken` (line 49) signs
`{_id, email}` — no `isSuperAdmin` claim, unlike Admin/StoreUser.

**StoreCoordinates** (StoreCoordinates.js, conn1) — storeId String, regionId String(default
""), coordinates GeoJSON {type enum['Polygon'] req, coordinates [[[Number]]] req}, deliveryType
String. 2dsphere index (see above) — the only geo-indexed model, used for delivery-zone
lookups.

**StoreProducts** (StoreProducts.js, conn1) — the per-store product-availability copy of
StiloProducts. storeId String(req,trim), products Object(default {}) — **the entire product
sub-document is stored as an untyped free-form Object, not a sub-schema**, productAvailability/
productBarCode/productQRCode String(default ""), productSlugArray Array(default []),
matchedStrains Array (**declared twice**, lines 1786 and 1788), productTraits Array, isBestSeller/
isFeatured/isCustFav Boolean(default false), productDisclaimer String(default ''), createdDate/
updatedDate Number(default Date.now).

**StoreUser** (StoreUser.js, conn1) — firstName/lastName/storeName String, email String(req,
unique), phone String(req,unique, same weak validator), password String, status Boolean(default
true), roleName/roleId String(default ""), pin String, createdDate/lastLogin Number, storeId
String, klaviyoProfileId String(default ""), isSuperAdmin Boolean(default false), deviceToken
Array(default []). `generateAuthToken` (line 35) signs `{_id, email, isSuperAdmin}` — same shape
as Admin's token, meaning a StoreUser JWT and an Admin JWT are structurally indistinguishable
except by payload values; any endpoint that only checks `req.user.isSuperAdmin` cannot tell
which collection the token's `_id` belongs to.

**Strain** (Strain.js, conn1) — strainId/strainName/metaTitle/metaDescription/description
String, image/listingImage {title,url,description,alt}, strainCategory/title/createdBy String,
strainHeading String, strainSlugArray Array(default []), createdDate Number, status Boolean
(default true), isBestStrain/isPopularStrain Boolean(default false), infoEffects/flavors Array
(default []), **productId: Joi.string()...** (line 1877 — a Joi validator chain assigned
directly as the Mongoose field type, which is almost certainly a bug: Mongoose will not
recognize this as a valid SchemaType and will likely store it as Mixed/ignore validation
entirely), title2/subStrainSlug/canonical String, isReviewed Boolean(default false).

**SubProductTraits** (SubProductTraits.js, conn2) — status enum['Active','Inactive'] default
'Active', subTraitId/parentTrait String, traitId ObjectId ref:'MainProductTraits' (custom
validator allows null or valid ObjectId), traitHeading String, showOnHomePage Boolean(default
false), tags [String], traitSlug/listImage/detailImage/detailImageAlt/listImageAlt/
subTraitName/canonical/title/desktopIcon/mobileIcon/description1 String, platformAvailability
{hyperwolf,hemp,stilo,all Boolean default false}, faq Array(default []), description2/
metaTitle/metaDescription String, traitSlugArray Array(default []), createdBy String,
createdDate Number(default Date.now), updatedDate Number, updatedBy String. `pre('save')` hook
auto-stamps `updatedDate = Date.now()` (lines 1979-1982) — the only model in the repo with this
pattern; every other model relies on controller code to set `updatedDate` manually (inconsistent
convention, easy to forget in a new controller).

**Tax** (Tax.js, conn1) — nested `taxEntrySchema` (`_id:false`): id/name String, status Boolean
(default true), displayName String, taxRate Number, replaces [String], compound Boolean,
taxOrder enum["pre-taxed","post-taxed"], createdDate Number. Top `taxSchema`: taxId String(req),
status Boolean, storeId String, memberType enum["MedicinalUser","AdultUse"], taxes
[taxEntrySchema], isOTD Boolean(default false), cannabisType enum["Cannabis","Non-Cannabis"],
replaces [String], createdDate/updatedDate Number.

**TaxSettings** (TaxSettings.js, conn1) — taxID String(req,unique), taxName String(unique),
taxRate Number(default 0), order Number, storeId String(default ""), taxStatus Boolean(default
true), createdDate/updatedDate Number(default Date.now). (Note: overlaps heavily in purpose with
`Tax` above — two separate tax-configuration collections; see main report duplication section.)

**Terpenoids** (Terpenoids.js, conn1) — terpeneId/terpeneName/terpeneImage/subText String,
status String, createdBy String, createdDate/updatedDate Number.

**TransactionLog** (TransactionLog.js, conn1) — orderId/memberId/memberEmail String, amount
Number — **money**, paymentOption String, status enum['success','failed','pending'],
gatewayResponse Object — **raw payment-gateway response stored verbatim; verify this never
contains full card PANs before treating it as low-sensitivity**, errorCode Number, errorMessage
String, createdDate Number(default Date.now), createdTimeFormatted/dateFormatted String.

**UserRolesPermissions** (UserRolesPermissions.js, conn1) — storeId String(req), roleId
String(req,unique), roleName String(req), permissions Object(default {}) — **free-form
permission map, not a fixed enum/schema of permission keys**, createdDate/updatedDate Number
(default Date.now).

**VersionSync** (VersionSync.js, conn1) — uniqueId String, blazeLastSync Number. (Sync
watermark for the Blaze POS integration.)

**WebCategory** (WebCategory.js, conn1) — webCategoryName String(req,unique), metaTitle/
metaDescription/heading/bannerHeading/canonical/description String, adminCategories Array,
webCategorySlug String, webMenuName/webCategoryHeading String, webCategorySlugArray Array
(default []), status/image String, order Number, createdBy String, bottomText String(default
""), bannerImage/listingImage/bannerMobileImage {title,url,description,alt}, faq Array(default
[]), createdDate/updatedDate Number. (Another Category-shaped collection distinct from
`Category` above — see main report duplication section for the 3-way Category/WebCategory/
MainBrand-style pattern repeated across this codebase.)
