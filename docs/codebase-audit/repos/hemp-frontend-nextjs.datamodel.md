# hemp-frontend-nextjs — Client-side data model (full detail)

Companion to `hemp-frontend-nextjs.md` §5/§6. This repo owns no database — everything below is
(a) the shape of Redux Toolkit state the UI reads/writes, and (b) the shape of requests/responses
the UI assumes the backend (hemp-backend) will send, as inferred from how each field is
consumed. All paths relative to repo root. All line numbers verified against SHA `755eab4`.

## Store wiring

`app/redux/store.js:13-25` — single `configureStore`, 8 reducers, `serializableCheck: false`
(RTK's default middleware check is disabled, meaning non-serializable values — e.g., functions
or DOM nodes accidentally placed in state — would not be caught in dev). `devTools` on unless
`NODE_ENV === "production"` (`app/redux/store.js:23`).

A second, **dead** reducer tree exists at `app/redux/reducers/index.js:1-16` — uses classic
`redux` `combineReducers`, only wires `common` (auth/products/externals/strains are imported
but commented out of the object literal, lines 14-16). Not imported by `store.js`; confirmed
dead by grep (`reducers/index.js` has no importers).

---

## Slice: `common` (`app/redux/reducers/common.js`)

The largest, most central slice — 58 top-level keys, mixing UI chrome state, cart-adjacent
flags, location, and content caches with no sub-namespacing.

**Initial state** (`app/redux/reducers/common.js:419-476`):

| Field | Type (inferred) | Notes |
|---|---|---|
| `appLoader` | bool | global page loader flag |
| `modalData` | object | payload for whichever modal is open |
| `isLoading` | bool | generic loading flag reused by many unrelated thunks |
| `isCategoryLoading` | bool | |
| `modal` | string | name of active modal, empty string = none |
| `drawer` | string | drawer side, default `"left"` |
| `drawerData` | object | |
| `drawerOpen` | bool | |
| `categoryData` | object | raw category tree from backend, shape not modeled (no fields validated) |
| `selectedCategoryData` | object | derived via `getSelectedCategory()` helper (`common.js:483-487`), matches by `webCategorySlug` or `_id` |
| `sideBarListHeaderData` | array | |
| `companyListFooterData` | array | |
| `supportListFooterData` | array | |
| `legalListFooterData` | array | |
| `recaptcha` | object | |
| `locationData` | object | user's selected delivery location |
| `allZipCode` | array | |
| `efTransactionID` | string | |
| `storeDetailsData` | object | defaults to `staticStoreAddress` (below) |
| `storeReviewData` | object | |
| `searchSection` | bool | |
| `berbixTransactionId` | object | legacy ID-verification vendor (Berbix) — vendor appears retired in favor of Persona/Didit but state key remains |
| `berbixVerificationData` | object | same |
| `deliveryOptions` | array | |
| `dropOffOptions` | object | `{ DropOffOptions: "", DropOffInstructions: "" }` |
| `lastOrderDetails` | object | |
| `wolfPackRewards` | object | loyalty program data |
| `creditCheckBoxChecked` | bool | |
| `deliveryType` | string | default `"asap"` — matches `ASAP`/`SCHEDULE`/`BOTH` constants (`app/constants.js:14-16`) but stored lowercase here, uppercase in constants — inconsistent casing convention |
| `selectedDeliverySlot` | object | |
| `productTypeData` | object | |
| `isShopOpenASAP` | bool | default `true` |
| `dispatchRegionID` | string | the closest thing to a multi-tenant/region key in this app |
| `isDefaultAddr` | bool | |
| `personaInquiry` | object | |
| `personaVerification` | object | consumed heavily by `Signup.js` (§ below) |
| `faqData` | array | |
| `isPersonaOpen` | bool | |
| `bannerTimings` | number | default `5000` (ms) |
| `shopTimings` | object | |
| `alertMessage` | string | |
| `scheduleDeliveryStatus` | string | |
| `FHL_Status` | bool | |
| `isThanksGivingDay` | bool | |
| `isChristmasDay` | bool | |
| `isCategoryData` | object | separate from `categoryData` above — unclear distinction from naming alone |
| `searchedData` | array | |
| `isSearching` | bool | |
| `currentOrderActiveCount` | number | |
| `signupStatus` | object | `{ personaStatus, registerStatus, agecheckerStatus, diditStatus }` per usage in `Signup.js:77` |
| `blogs` | object | |
| `reviews` | object | |
| `isNotFound` | bool | |
| `companyReviews` | object | |
| `categoryContent` | object | |
| `blockData` | object | account-block/suspension reason, set via `memberDataBlockReason` action |

`staticStoreAddress` fallback (`common.js:11-20`) — hardcoded default shop address used when
`storeDetailsData` hasn't loaded yet: `city: "commerce"`, `country: "USA"`, `zipCode: "90014"`,
`address: DEFAULT_SHOP_ADDRESS` (env var). A default that silently anchors "shop open" and
delivery-radius logic to one specific city if the real store data fetch fails or is slow.

30 `createAsyncThunk`s (`common.js:22-405`), each wrapping one `apis/common.js` or
`apis/externals.js` call — see API inventory below for the full list of backend calls this
slice can trigger.

---

## Slice: `auth` (`app/redux/reducers/auth.js`)

**Initial state** (`app/redux/reducers/auth.js:16-32`):

| Field | Type | Notes |
|---|---|---|
| `user` | object | full member record + `accessToken`, mirrored into `localStorage` under `AccessTokenName` |
| `isLoading` | bool | |
| `isLoggedIn` | bool | |
| `userPhone` | string | |
| `userList` | array | |
| `FHLBalance` | number | FHL (financing) wallet balance, dollars |
| `userLocation` | object | `{ fullAddress, lat, long, zipCode }` |
| `locationPermissionByUser` | bool | |
| `userAgeCheck` | bool | |
| `openBerbix` | bool | legacy vendor flag, see `common` slice note |
| `isGuestUser` | bool | |
| `guestUser` | object | |
| `rememberLoginCred` | object | persisted to `localStorage` key `'rememberUserCred'` **excluding password** (`app/redux/reducers/auth.js` `setRememberLoginCred`, destructures `password` out before `setData` — the one place in this slice that deliberately avoids persisting a secret) |

14 thunks: `login`, `signup`, `guestChekout`, `updatePassword`, `memberSignup`,
`ageCheckerMemberSignup`, `enableIntercomOptin`, `checAgeCheckerRequiredOrNot`, `findUser`,
`forgotPassword`, `resetPassword`, `uploadUserDoc`, `updateAccountDetails`, `getDocumentById`,
`emailLogin`, `resetOTP`, `fetchUserInfo` (17 total, `app/redux/reducers/auth.js:37-247`).

On `login.fulfilled`/`emailLogin.fulfilled`, the entire `action.payload.member` object
(assumed shape: profile fields + `accessToken` + `walletBalance`) is written verbatim to
`localStorage` via `setData(AccessTokenName, ...)` and the raw token separately via
`setData(AccessTokenId, ...)` — no field allowlist, whatever the backend returns is persisted
as-is. See main report §6/§14 for the consequence (token is stored but never re-attached to
outgoing requests).

---

## Slice: `products` (`app/redux/reducers/products.js`)

**Initial state** (`app/redux/reducers/products.js:546-576`) — 30 declared keys, but
`orderDetailData` is declared **twice** (lines 548 and 551; second silently wins):

`productsData`, `orderDetailData` (×2, dup), `allCategoryProductsData`, `isLoading`,
`isLoadingProducts`, `isExpressLoading`, `isLoadingAddtoCart`, `isSingleProductLoading`,
`singleProductData`, `activeCartData`, `cartSessionData`, `singleCategoryProductsData`,
`brandListData`, `cartsItemsData`, `completedOrderData`, `orderHistoryData`,
`infoAndEffectData`, `allCouponsData`, `singleCouponData`, `allBlazeCoupon`,
`expressDeliveryData`, `isExpress`, `isExpressLastStatus` (`{ status, count }`),
`terminalsName`, `isLoadingProductsInfinite`, `skipInfiniteProducts` (default `16`, pagination
page-size baked into initial state rather than a config constant), `IsPickupType` (default
`"Delivery"`), `searchProductsData`, `isLoadingSearchProducts`, `checkValidOrder`,
`checkValidOrderError`, `shopPageLoader`, `shopPageData`, `orderDetails`, `fhlDetails`,
`addressAvailability`, `allowToAddMinBalance`, `split`, `walletBalance`, `placeOrderLoader`,
`activeCartLoader`, `selectedAlpineRewards`, `deliverySlots`, `asapTotal`, `scheduleTotal`,
`allAsapProducts`, `clearCartFHL`, `showComeingSoon` (sic), `productCount`,
`brandDescrition` (sic), `wordpressFailed`, `recommendedPRoductLoading` (sic),
`recommendedPRoduct` (sic), `brandProducts`, `bannerDescrition` (sic), `bannerFailed`.

Note the number of typo'd keys shipped into the public state contract
(`showComeingSoon`, `brandDescrition`, `recommendedPRoductLoading`/`recommendedPRoduct`,
`bannerDescrition`) — every consumer has to know and repeat the misspelling.

`activeCartData`/`cartsItemsData`/`asapTotal`/`scheduleTotal`/`walletBalance` are all plain
`Number`/`object` with no currency unit field — dollars is the assumed unit throughout (see
main report §5 on money typing).

This is the largest slice by line count (1,292 lines) and backs the checkout flow (cart, active
cart, coupons, FHL financing balance, express delivery). 38 API functions in
`app/redux/apis/products.js` are available to it (see inventory below); not all are
necessarily wired to a thunk in this file — cross-referencing thunk-to-API-call pairs was not
exhaustively done given the file size, but every thunk found calls exactly one `apis/*` function
by the pattern shown in `auth.js`/`order.js`.

---

## Slice: `externals` (`app/redux/reducers/externals.js`)

**Initial state** (`app/redux/reducers/externals.js:4-29`):

`isLoading`, `allRewards`, `selectedReward`, `sbUser` (SpringBig user), `allOffers`,
`paymentMethodsList`, `onFleetOrderDetails` (OnFleet is the delivery-dispatch vendor referenced
here — not otherwise documented in the main report since no direct client credential is used
for it, calls are backend-mediated per `apis/externals.js:121`), `alpineIQData` (AlpineIQ
loyalty — a second loyalty vendor alongside SpringBig, both live simultaneously),
`associateIdData`, `loyalyContact` (sic), `alpineRedeemCoupons`, `redeemUnlockableRewards`,
`creditCardDetails`, `splitAmmount` (sic, string type — a money field stored as a string,
inconsistent with the `Number` convention elsewhere), `alpineReferralCode`,
`referralCodeValidation`, `isValidateCodeLoading`, `referralLoader`, `otpData`, `FHLotp`,
`FHLotpSubmition` (sic), `fhlUserCreation`.

Two commented-out fields remain in source (`// selectedAlpineRewards: []`,
`// unlockableRewards: []`, `externals.js:16-17`) — dead state left as a comment, another small
signal of copy/trim-without-cleanup.

---

## Slice: `order` (`app/redux/reducers/order.js`)

**Initial state** (`app/redux/reducers/order.js:5-9`): `orderData` (null until fetched),
`loading`, `error`. Single thunk `getOrderData(orderId)` → `getchOrderDetailAPI` (sic,
typo'd function name, `apis/order.js:3`). Smallest slice in the app (47 lines total).

---

## Slice: `cannabinoids` (`app/redux/reducers/cannabinoids.js`)

**Initial state** (`cannabinoids.js:17-21`): `tags` (array), `isLoading`, `error`. One thunk,
`getCannabinoidsTags` → `getCannabinoidsTagsAPI`. Response shape assumed:
`{ cannabinoidData: [...] }` (`cannabinoids.js:35`, `action.payload?.cannabinoidData`).

---

## Slice: `strains` (`app/redux/reducers/strains.js`)

**Initial state** (`strains.js:6-11`): `strains`, `singleStrain`, `isLoading`,
`strainProducts`. One thunk, `getAllStrainsProducts` → `strainAllProductAPI`.
`strains`/`singleStrain` in initial state are never actually populated by any reducer case in
this file (only `strainProducts` is set on fulfilled, line 42) — `strains` and `singleStrain`
look like planned-but-unimplemented state, or are populated by direct component-level API
calls that bypass Redux entirely (not confirmed either way without reading every strain
component).

---

## Slice: `traits` (`app/redux/reducers/traits.js`)

**Initial state** (`traits.js:31-35`): `data` (commented as `{}, // mainTraitName => {
metadata, subTraits }`), `isLoading`, `error`. Two thunks: `getMainTraits`, `getSubTraits`.

**Shape drift** (flagged in main report §5, §16): `getMainTraits.fulfilled`
(`traits.js:49-63`) sets `state.data = (action.payload.traits || []).map(trait => ({
metadata: trait, subTraits: [] }))` — an **array** of `{metadata, subTraits}` objects, not the
object-map the initial-state comment promises. `getSubTraits.fulfilled`
(`traits.js:75-90`) then does `Object.entries(state.data).find(([_, value]) =>
value.metadata.traitSlug === mainTraitSlug)` — `Object.entries` on an array yields
`[index-as-string, value]` pairs, so this `.find()` still locates the right entry by scanning
values, but any code that tries `state.data[someTraitName]` (as the original comment implies is
valid) gets `undefined` because the array is indexed 0..n, not by name.

---

## API surface — full function inventory by file

Every function below returns a Promise (either `axios`/`axiosClient` call or wrapped in
`apiReq`). Grouped by the file that owns it; call sites are the matching `createAsyncThunk` in
the reducer of the same base name unless noted.

### `app/redux/apis/auth.js` (18 functions, lines 6-97)
`loginAPI`, `emailLoginAPI`, `signUpAPI`, `updatePasswordAPI`, `memberSignUpAPI`,
`ageCheckermemberSignUpAPI`, `forgotPasswordAPI`, `findUserAPI`, `resetPasswordAPI`,
`updateMemberVerificationAPI`, `resetOTPAPI(email)`, `userOtinAPI(email)`,
`checkAgeCheckerRequiredOrNotAPI(email)`, `userIntercomIdAPI(email)`,
`getUserInfoAPI(memberId)` — **IDOR-relevant, see main report §14** —,
`uploadUserDocAPI(data, name, consumerId)`, `updateAccountDetailsAPI(data, customerId)`,
`getUserDocByIDAPI(key, consumerId)`. Mixes `axiosClient.post/get` (absolute URLs, e.g.
`auth.js:8`) and `apiPost` (relative, via `apiReq`, e.g. `auth.js:44`) in the same file.

### `app/redux/apis/common.js` (41 functions, lines 6-246)
`getAllCategoriesAPI`, `getHeaderContentAPI`, `getFooterCompanyContentAPI`,
`getFooterSupportContentAPI`, `getFooterLegalContentAPI`, `getAllDeliveryZipCodeAPI`,
`getStoreDetailsAPI`, `postCreateTransactionAPI`, `getBerbixTransactionAPI`,
`getDeliveryMethodAPI`, `getLastOrderDetailsAPI`, `getWolfPackRewardsAPI`,
`getProductTypeAPI`, `getDispatchRegionAPI`, `postCreateInquiryAPI`,
`cancelPersonaVerificationAPI`, `createDiditURlAPI`, `getSessionDiditURlAPI`,
`retrieveSessionUrlAPI`, `getPerosonaInquiryDataAPI` (sic), `getPerosonaInquiryIdAPI` (sic),
`getFooterMenuContentAPI(data = 3)`, `currentActiveOrderCountAPI(memberId)`,
`getFAQMenuContentAPI(category = "", isDeal = false)`, `getCategoryWiseContentAPI`,
`getSignupStatusAPI`, `getFHLotpAPI`, `getFHLotpSubmitAPI`,
`getRealTimeOTPAPI({ creditTransactionId })`, `getConversationAPI`, `closeConversationAPI`
(Intercom-style conversation endpoints), `checkIsFirstOrder(orderId)`,
`getIntercomVerficationHash` (sic), `getRestrictAmountValuesAPI`, `getBannerTimingsAPI`,
`getShopTimingsAPI`, `getShopFHLStatusAPI`, `getDeliveryTypeStatusAPI`, `addResponseLogsAPI`,
`globalSearchAPI`, `getProductReviewsAPI`, `getTopAndPopularBrands`, `getLegalPagesAPI`,
`fetchBlockStatusAPI`. This is the largest and most miscellaneous API file — content, delivery
config, ID-verification session management, and analytics logging all share one module.

### `app/redux/apis/products.js` (38 functions, lines 8-291)
`getAllProductsAPI`, `getAllScheduleProductsAPI`, `getAllCategoryProductsAPI`,
`getSingleProductDetailsAPI(data, queryParms = {})`, `getBrandListAPI`,
`getOrderItemDetailAPI`, `getProductRecommentDataAPI(platformType, placement)`,
`activeCartAPI`, `prepareCartAPI(data, addedFromAsap = false, sideCartBarOpen = false)`,
`updateCartAPI(cartId, data)`, `placeCartOrderAPI(consumerID, data)`,
`cancelPlacedOrderAPI(consumerID, data)`, `expressNearByAPI`, `allBrandProductsAPI`,
`getOrderHistoryAPI`, `getOrderHistoryRewardAPI`, `getInfoAndEffectAPI`,
`savePlaceCartOrderBMWAPI`, `changePaymentStatusBMWAPI`, `getOrderByPaymentIdBMWAPI`,
`createCartBMWAPI`, `updateCartBMWAPI(consumerId, data)`, `getCouponsPromoAPI`,
`getSingleCouponPromoAPI(id)`, `checkValidOrderBMWAPI`, `checkValidCouponAPI`,
`checkExpressDeliveryBMWAPI`, `getAllBlazeCouponsAPI`, `getShopDataAPI`,
`getOrderDetailByIdAPI(id, data)`, `getFhlDataAPI(data, headers)`, `getDeliverySlotsAPI`,
`getDeliveryTypeProductAPI`, `hitFHLUserExistapi` (sic), `hitFHLOTPsubmitApi`,
`getAllProductsCountAPI`, `getBrandProductDescriptionAPI(brandId = {})`,
`getParentBannerAPI`, `getRecomendedProductsAPI` (sic), `getProductFiltersAPI`. The `BMW`
suffix (`*BMWAPI`) throughout appears to be a legacy/internal codename for the order-placement
subsystem — no other reference to what "BMW" stands for exists in the repo's docs.

### `app/redux/apis/externals.js` (25 functions, lines 7-174)
`emailSubscribeAPI`, `smsSubscribeAPI`, `googlePlacesAPI`, `googleStoreReviewAPI`,
`getRewardsAPI`, `createSBMemberAPI`, `getSBMemberAPI` (SpringBig), `redeemRewardAPI(data,
isReward)`, `giveUserRewardsPointsAPI`, `getOffersSBAPI`, `paymentAPI`,
`getPaymentStatusAPI(PaymentId)`, `getPaymentMethodsAPI`, `onFleetAPI`, `fhlAPI(data, key)`,
`fhlAssociateIdApi`, `fhlBlockUserApi`, `fhlGetOTPapi`, `fhlGetOTPsplitApi`, `fhlFormDataApi`,
`alpineIQAPI`, `loyaltyContactAPI`, `getAlpineRedeemPointsAPI`, `redeemUnlockableDealsAPI`,
`getAlpineReferralcodeAPI`, `validateAlpineReferralcodeAPI`.

### `app/redux/apis/order.js` (1 function)
`getchOrderDetailAPI(orderId)` (sic — "getch", typo of "get").

### `app/redux/apis/cannabinoids.js` (1 function)
`getCannabinoidsTagsAPI`.

### `app/redux/apis/strains.js` (3 functions)
`strainAPI`, `singleStrainAPI(id)`, `strainAllProductAPI(filters)`.

### `app/redux/apis/traits.js` (2 functions)
`getMainTraitsAPI`, `getSubTraitsAPI(mainTraitSlug)`.

**Total: ~109 distinct backend-calling functions** across 8 files, none behind a shared
retry/timeout/cancellation policy (`apiReq`, `app/utils.js:71-108`, has none of the three), and
roughly a third mixing `axiosClient` and the `apiGet`/`apiPost` family within the same file
(auth.js, confirmed; not individually re-verified for every other file given volume).

---

## Next.js API Route Handlers (server-side, this repo's own backend surface)

| Route | Method | Request body (assumed) | Response | Auth gate |
|---|---|---|---|---|
| `app/api/checkout/route.js` | POST | arbitrary JSON, forwarded as-is to `HEMP_BASE_URL/api/v1/cart/submit` | `{ ...backendResponse }` on 200, `{ message }` on error | `Origin` header allowlist only (`app/api/checkout/route.js:9`) |
| `app/api/register/route.js` | POST | arbitrary JSON, forwarded to `HEMP_BASE_URL/api/v1/member/register` | `{ ...backendResponse }` / `{ message }` | `Origin` header allowlist only (`app/api/register/route.js:12`) |
| `app/api/shop/route.js` | GET | query string, whitelist-validated via `validateQueryParams` (`app/api/shop/route.js:9-18`) | `{ categories, products, banners, brandData }` | none (public catalog data) |

Both POST routes forward the caller's JSON body to the backend **unmodified** — no schema
validation on `checkout`/`register` payloads before forwarding (contrast with `shop/route.js`,
which does validate). This is a mass-assignment-shaped gap at the proxy layer: whatever keys a
caller sends in the POST body reach the backend verbatim, so any additional-property
protection has to live entirely in hemp-backend.

---

## Client-side persisted storage keys (`app/constants.js:1-12`, all `localStorage` unless noted)

| Constant | Key string kind | Written from |
|---|---|---|
| `AccessTokenName` | full member/session object (incl. token) | `auth.js` `login.fulfilled`/`emailLogin.fulfilled` |
| `AccessTokenId` | raw access token string | same |
| `CartSessionId` | cart session id | various cart flows |
| `Location` | `{ zipcode, lat, long, fullAddress }`-shaped location, also mirrored to a same-named **cookie** read server-side by `app/page.js:39-40` and `app/api/shop/route.js:24-25` | location picker flow |
| `LocationWordpress` | secondary location cache for WordPress-sourced content | |
| `SelectedReward` | loyalty reward selection | |
| `RewardUser` | | |
| `PaymentId` | | |
| `PineappleExpress` | express-delivery flag (brand-specific name "Pineapple Express" leaking into a generic constant — see main report hardcoding notes for the same brand name appearing in `app/constants.js:88-91`) | |
| `PineappleExpressLastStatus` | | |
| plus ad hoc keys set directly by string literal rather than a constant | `"selectedRewards"` (`SecondStep.js:878,1149,1153`), `"cartType"` (`app/utils.js:386-400`), `"rememberUserCred"` (`auth.js`) | no central registry of every key actually used — grep for `setData(`/`localStorage.setItem(` is the only way to enumerate them all, three are shown here as evidence the constant list in `constants.js` is incomplete |
