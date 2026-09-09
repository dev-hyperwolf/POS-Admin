# hemp-retailer-admin — client-side data model @ 1d09f69

This repo has no backend schema of its own. What follows is the complete field-by-field client
state model: every Redux Toolkit slice's `initialState`, every thunk it exposes, and every REST
endpoint the corresponding `src/redux/apis/*` file calls (method, base client, path — extracted
mechanically by parsing `axiosClient.*`/`axiosHempClient.*` call sites, then spot-verified by hand
for the highest-traffic files). "main" = `REACT_APP_BASE_URL` (`src/axiosClient/index.js`),
"hemp" = `REACT_APP_HEMP_BASE_URL` (`src/axiosClient/hempIndex.js`). All paths are literal strings
from source; `${...}` marks a template-interpolated path/query segment. A handful of endpoints
that use multi-statement URL construction weren't machine-extractable and are marked `(dynamic —
see file)`.

Store wiring: `src/redux/store.js` registers **28** reducers. Two slice files exist on disk but
are **not** in the store (dead): `src/redux/slices/settings/CreditCardFee.js` is never imported by
`store.js` (its actual state is served from a subtree of a different registered slice, or is
simply unreachable — not resolved further here). The `authSlice` module exports its reducer as
`msalReducer` (misleading name, §16 of the main report) registered under the key `auth`.

---

## Route inventory (`src/routes.js`, 33 declared paths, all gated by `<PrivateRoute>` except the
4 listed as public in the main report §6)

| Route | Component | Notes |
|---|---|---|
| `/pos` | `POSHomePage` (`layouts/POS/layouts`) | In-store POS mode; also declared a second time via `POSRouter` export. |
| `/dashboard` | `Dashboard` | Stats/graphs landing page. |
| `/products` | `Products` | Product list. |
| `/products/add` | `AddProduct` | Also reachable via `/products/:productId` (edit uses the same component keyed by param presence). |
| `/products/:productId` | `AddProduct` | Edit mode of the add form. |
| `/products/details/:productId` | `ProductDetails` | |
| `/products/master-catalog/add` | `MasterCatalog` | Duplicated route also registered as `/master-catalog/add` → same component, two paths. |
| `/master-catalog/details/:productId` | `MasterCatalogDetail` | |
| `/products/master-catalog/add-master-catalog-products` | `AddMasterCatalogProducts` | Duplicate path also registered as `/master-catalog/add-master-catalog-products`. |
| `/master-catalog` | `MasterCatalogView` | |
| `/master-catalog/add` | `MasterCatalog` | Duplicate of the `/products/master-catalog/add` route above — same component, two URLs reach it. |
| `/master-catalog/add-master-catalog-products` | `AddMasterCatalogProducts` | Duplicate of the `/products/...` path above. |
| `/ecom-orders` | `Orders` | |
| `/members` | `Members` | |
| `/CheckinLogs` | `CheckinLogs` | Note inconsistent casing vs. every other route (kebab/lowercase elsewhere). |
| `/ecom-orders/member/:memberId` | `MemberOrders` | |
| `/store-orders/:orderId` | `AddOrder` | |
| `/ecom-orders/details/:orderId` | `OrderDetailsPage` | |
| `/ecom-orders/:orderId` | `AddOrder` | |
| `/store-orders/details/:orderId` | `OrderDetailsPage` | |
| `/members/detail/:memberId` | `MemberDetails` | |
| `/members/add` | `AddMember` | |
| `/members/:memberId` | `AddMember` | Edit mode. |
| `/settings` | `CompanyInformation` | "Settings" lands on Company Information by default. |
| `/notification` | `Notification` | |
| `/tax-manage` | `TaxManagement` | |
| `/shopSettings` | `ShopSettings` | |
| `/shippingManagement` | `ShippingManagement` | |
| `/limitManagement` | `LimitManagement` | |
| `/cardSetting` | `CardSetting` | |
| `/PrinterTesting` | `PrinterTesting` | Casing inconsistency again. |
| `/fullfillment` | `FullfillmentHomepage` | |

Public (unauthenticated) routes, from `src/App.js:341-349`: `/login`, `/forgot-password`,
`/reset-password`, `/reset-pincode`. Catch-all (`*`) and root (`/`) redirect based on
`isLoggedIn()`. `/401` renders `layouts/401` (reachable without auth by design — error page).

`src/routes.js` also exports a separate `POSRouter` array (line 54) used to build the POS-mode
nav — not independently enumerated here since it maps onto the same route set above.

---

## Slices (`src/redux/slices/**`) × APIs (`src/redux/apis/**`)

Each entry: state shape (actual `initialState` consumed by `createSlice`, dead/unused duplicates
called out separately), thunk → endpoint mapping.

### `authSlice.js` (store key: `auth`) — the session/user slice
```
initialState = {
  account: null,
  isAuthenticated: false,
  logging: false,
  user: {},
  userRoleAndPermissions: {},
  fetchingPermissions: false
}
```
Thunks (`src/redux/apis/auth.js`):
- `loginUser` → `POST [hemp] /api/v1/admin/login`
- `signupUser` → `POST [main] /api/v1/admin/create`
- `forgotPassword` → `POST [main] /api/v1/admin/store/forgot`
- `resetPassword` → `POST [main] /api/v1/admin/store/reset`
- `getUserInfo` → `GET [hemp] /api/v1/admin/${userId}?storeId=${storeId}`
- `fetchStoreInfo` → `GET [main] /api/v1/admin/store/${storeId}`
- `logoutUser` → `POST [hemp] /api/v1/admin/store/logout`
- `fetchLoggedInUserRolePermission` → `GET [hemp] api/v1/admin/${roleId}` (note: no leading slash)
- `resetPinCode` → `POST [main] /api/v1/pos/user/reset/pin`

Note the split: signup/forgot/reset/store-info hit **main**, but login/logout/user-info hit
**hemp** — same logical "admin auth" domain, two different backends. `userSignupAPI` (main) and
`addAdminAPI` in `apis/admin.js` (hemp) both `POST` to the path `/api/v1/admin/create` — same path
string, different base URL, easy to confuse when adding a new call.

### `common.js` (store key: `common`) — catch-all app-shell state
```
initialState = {
  isLoading: false,
  infoEffectData: [],
  categoriesData: [],
  regions: [],
  fetchCategoriesError: null,
  isFetchingCategories: false,
  snackbar: { isOpen: false, color: '', icon: '', content: '', bgWhite: false, promise: false },
  isUploading: false,
  banners: {},
  paymentPlatformStatus: {},
  singleBanner: {},
  currentSite: 'admin',
  isFullScreen: false
}
```
Thunks (`src/redux/apis/common.js`, all `[main]`):
`uploadImage`, `uploadProductImage`, `fetchInfoEffect` (`GET /api/v1/admin/category/get?...` —
same endpoint reused for 3 different thunks, see below), `fetchCategories`
(`GET /api/v1/admin/category/get?...`), `fetchProductMainCategories` (dynamic — see file),
`fetchAllRegions` (`GET /api/v1/admin/region/get`), `bulkProductUpdate`
(`POST /api/v1/admin/store/products/bulk/update`), `fetchSignupStatus`
(`GET /api/v1/signup/status`), `updateSignupStatus` (`POST /api/v1/signup/status/update`),
`fetchPaymentPlatformStatus`/`updatePaymentPlatformStatus`/`getProductDisclaimers`/
`updateDisclaimer` (all four resolve to `POST /api/v1/payment/status/update` or
`GET /api/v1/payment/status` in `apis/common.js` — **the same two endpoints are reused for what
the thunk names claim are four unrelated concerns** (payment platform status vs. product
disclaimers vs. signup) — either a genuine backend multiplexed endpoint or copy-paste error in the
api wrapper; not resolvable from this repo alone), `getHomepageBanners`, `updateHomePageBanners`,
`getSingleBannerAPI`, `deleteBanner`.

### `brand.js` (store key: `brands`)
```
initialState = {
  isLoading: false,
  brandsData: null,
  fetchBrandsError: null,
  isDeleting: false,   // ⚠ declared twice in source (src/redux/slices/brand.js:30-31), second wins
  isUpdating: false,
  mainBrandData: {}
}
```
Thunks (`src/redux/apis/brand.js`, all `[main]`): `fetchBrands` (`GET /api/v1/brand?...`),
`createBrand` (`POST /api/v1/brand`), `deleteBrand` (`DELETE /api/v1/brand/${brandId}`),
`fetchSingleBrand` (`GET /api/v1/brand/${brandId}?userType=admin`), `updateBrand`
(`PUT /api/v1/brand/update/${brandId}`), `getMainBrand`/`updateMainBrand` (both
`POST api/v1/brand/update/main/metas` — two thunks, one endpoint, differentiated only by request
payload).

### `category.js` (store key: `category`)
```
initialState = {
  loading: false, error: null,
  singleCategory: {}, singleWebCategory: {},
  isDeleting: false, isFetching: false,
  categoriesList: {}, webCategoriesList: []
}
```
Thunks (`src/redux/apis/category.js`, all `[main]`): `deleteCategory`
(`DELETE /api/v1/admin/category/${id}`), `createCategory` (`POST /api/v1/admin/category`),
`updateCategory` (`PUT /api/v1/admin/category/update/${id}`), `fetchCategoriesList`
(`GET /api/v1/admin/category/${id}`), `fetchSingleCategory` (dynamic), `fetchWebCategories`
(`GET /api/v1/admin/category/web?...`), `createWebCategory`
(`POST /api/v1/admin/category/create/update`), `updateCategoriesOrder` (dynamic — see file),
`fetchSingleWebCategory` (`GET /api/v1/admin/category/web/${id}`), `deleteWebCategory`
(`DELETE /api/v1/admin/category/web/${id}`).

### `regions.js` (store key: `regions`) — has a dead duplicate `initialState`
**Dead, unused, top-level `const initialState`** at `src/redux/slices/regions.js:4-9` — never
consumed:
```
{ products: [], loading: false, error: null, singleProduct: null }   // copy-pasted from products.js, unused
```
**Actual** initial state (inline in `createSlice`, `regions.js:79-84`):
```
{ data: [], loading: false, error: null, regionDetails: {} }
```
Thunks (`src/redux/apis/regions.js`, all `[main]`): `fetchRegions`
(`GET /api/v1/admin/region/get/?...`), `addRegion` (`POST /api/v1/admin/region`), `updateRegion`
(`PUT /api/v1/admin/region/update/${id}`), `deleteRegion` (`DELETE /api/v1/admin/region/${id}`),
`fetchSingleRegion` (`GET /api/v1/admin/region/${id}`).

### `inventory.js` (store key: `inventory`)
```
initialState = { inventory: [], inventoryDetails: null, loading: false, error: null }
```
Thunks (`src/redux/apis/inventory.js`, all `[main]`): `fetchInventory`
(`GET /api/v1/admin/inventory/${id}` — note: same endpoint as `fetchInventoryDetails`, the
"fetch all" call is missing an id-less variant), `fetchInventoryDetails`
(`GET /api/v1/admin/inventory/${id}`), `addInventoryItem` (`POST /api/v1/admin/inventory`),
`updateInventoryItem` (`PUT /api/v1/admin/inventory/update/${id}`), `deleteInventoryItem`
(`DELETE /api/v1/admin/inventory/${id}`).

### `orders.js` (store key: `orders`)
```
initialState = { orders: [], isLoading: false, error: null, loading: false, order: {}, isUpdatingStatus: false }
```
(two loading flags — `isLoading` and `loading` — both present, no evidence either is dead code
removed; likely redundant.) Thunks (`src/redux/apis/order.js`, all `[main]`): `fetchOrders`
(`GET /api/v1/order?...`), `fechWarrantyOrders` [sic, typo in thunk name]
(`GET /api/v1/order/warranty?...`), `fetchMemberOrderList`
(`GET /api/v1/member/orders?...`), `fetchSingleOrder` (`GET /api/v1/order/${orderId}`),
`warrantyStatusUpdate` (`POST /api/v1/order/warranty/status`), `createOrder`
(`PUT /api/v1/order/update/${orderId}` — a **PUT** used for what the thunk name calls "create"),
`updateSubmitOrder` (`GET /api/v1/pos/select/payment?orderId=...&balance=...` — a **GET** used to
select a payment method, mutating server state via a GET request), `submitPrepareCart`
(`POST /api/v1/order/active/session/data`), `deleteOrder` (`DELETE /api/v1/order/${orderId}`),
`fetchReturnDetails` (`GET api/v1/order/returned/items/details/${id}`), `fetchRefundList`
(`GET api/v1/order/refund/reasons/list`).

### `member.js` (store key: `members`) — admin-side member management
```
initialState = { members: [], memberDetails: {}, loading: false, error: null, scannedMemberData: {}, isLoading: false }
```
Thunks (`src/redux/apis/members.js`, all `[main]`): `fetchMembers`/`fetchMembersDetails`
(`GET /api/v1/member/${memberId}` — **same endpoint reused for both the list and the single-record
fetch**, differentiated presumably by whether `memberId` is passed), `updateCardBlock`
(`PUT /api/v1/member/block/online/payments`), `addMember` (`POST /api/v1/member`), `updateMember`
(`PUT /api/v1/member/update/${memberId}`), `deleteMember` (`DELETE /api/v1/member/${memberId}`),
`fetchMemberOrders` (`GET /api/v1/member/orders?memberId=${memberId}`), `updateWalletMember`
(`PUT /api/v1/member/adjust/wallet`), `fetchWalletLogs`
(`GET /api/v1/member/wallet/logs?...`), `fetchWalletReasonList`
(`GET api/v1/member/wallet/adjust/reason/list`).

### `pos/members.js` (store key: `posMembers`) — **near-duplicate of `member.js` above**
```
initialState = { members: [], memberDetails: {}, loading: false, error: null, currentSelectedUser: {}, isLoading: false, isOrderLoading: false }
```
Thunks (`src/redux/apis/pos/members.js`): `fetchMembers`, `fetchMemberOrders`,
`fetchMembersDetails`, `addMember`, `updateMember`, `deleteMember` — **identical names and paths**
to `apis/members.js` above, plus two POS-only additions: `fetchPurchaseOrders`
(`GET api/v1/pos/order/purchased/list?storeId=${user?.storeId}&...` — reads `user` from **module
scope**, not a passed parameter, see main report §5) and `fetchReturnsOrders`
(`GET api/v1/pos/order/return/list?storeId=${user?.storeId}&...`, same module-scope pattern).

### `pos/products.js` (store key: `posProducts`) — the largest single slice (60+ fields)
```
initialState = {
  productsData: {}, allCategoryProductsData: [], isLoading: false, isLoadingProducts: true,
  isExpressLoading: false, isLoadingAddtoCart: false, isSingleProductLoading: false,
  singleProductData: {}, activeCartData: {}, cartSessionData: {}, singleCategoryProductsData: {},
  brandListData: {}, cartsItemsData: [], completedOrderData: {}, orderHistoryData: {},
  infoAndEffectData: {}, allCouponsData: {}, singleCouponData: {}, allBlazeCoupon: {},
  expressDeliveryData: {}, isExpress: false, isExpressLastStatus: { status: false, count: 0 },
  terminalsName: [], isLoadingProductsInfinite: false, skipInfiniteProducts: 16,
  IsPickupType: "Delivery", searchProductsData: {}, isLoadingSearchProducts: false,
  checkValidOrder: true, checkValidOrderError: "", shopPageLoader: false, shopPageData: [],
  orderDetails: {}, fhlDetails: {}, addressAvailability: null, allowToAddMinBalance: false,
  split: false, walletBalance: 0, placeOrderLoader: false, activeCartLoader: false,
  deliverySlots: {}, asapTotal: 0, scheduleTotal: 0, allAsapProducts: [], clearCartFHL: false,
  showComeingSoon: false, /* [sic] */ productCount: {}, brandDescrition: {}, /* [sic] */
  wordpressFailed: false, recommendedPRoductLoading: true, /* [sic] */ recommendedPRoduct: {},
  brandProducts: {}, bannerDescrition: {}, bannerFailed: /* truncated by audit tooling, file continues */
}
```
(Field-name typos — `showComeingSoon`, `brandDescrition`, `recommendedPRoduct` — are verbatim from
source, not audit transcription errors; flagged because they make the state shape harder to
`grep`/autocomplete against consistently.) Thunks (`src/redux/apis/pos/products.js`, all `[main]`,
several read `${process.env.REACT_APP_BASE_URL}` directly rather than using the shared
`axiosClient` instance — meaning these calls **bypass the shared request/response interceptors**,
including the 401-redirect-to-login handling in `axiosClient/index.js`): `getSingleProductDetails`
(`GET /api/v1/product/${id}`), `getBrandList` (`GET /api/v1/brand?limit=150&page=0` — a **third**,
independently hardcoded pagination default for brands, alongside the `limit:1000` used at boot in
`App.js` and whatever default `fetchBrandsAPI` itself uses), `activeCart` (dynamic), `prepareCart`
(`POST /api/v1/pos/prepare/cart`), `fetchAgeVerify` (`POST /api/v1/pos/age/verification`),
`placeCartOrder` (`POST /api/v1/cart/submit`), `allBrandProducts`
(`GET /api/v1/product/web?...`), `getOrderHistory` (`GET /api/v1/member/orders?...`),
`getShopData` (`GET /api/v1/product/web/?...`), `getRecomendedProducts` [sic]
(`GET /api/v1/alpine/rec/products/?...` — AlpineIQ integration, called directly from this slice),
`fetchStoreProducts` (`GET /api/v1/pos/get/products/${storeId}?...`), `getProductInfoBySku`
(`GET /api/v1/admin/store/products/productBatchId/${user?.storeId}?productBatchId=${sku}` —
module-scope `user` again), `returnPOSOrder` (`POST /api/v1/pos/return/order`),
`deleteProductStrain`/`fetchProductStrains` (both resolve to the **same**
`DELETE api/v1/product/traits/store/delete/matched/strains/data?...` endpoint — one thunk named
for reading, calling a delete endpoint), `addProductStrain`/`fetchCheckinMember` (both resolve to
`GET /api/v1/pos/verify/checkin/member?...` — again, one thunk's name doesn't match its own
endpoint's evident purpose).

### `pos/notifications.js` (store key: `notifications`)
```
initialState = {
  orderNotifications: [], generalNotifications: [], addProductNotifications: [],
  notificationCount: 0, loading: false, isReading: false, isFetchingNotifications: false,
  notifications: {}, notificationsSettings: {}
}
```
Thunks (`src/redux/apis/pos/notifications.js`, all `[main]`): `fetchNotificationCounts`
(`GET /api/v1/store/notification/count?...`), `fetchNotifications`
(`GET /api/v1/store/notification/count/data?...`), `updateNotificationSettings`
(`POST /api/v1/admin/store/settings/notification`), `fetchNotificationSettings`
(`GET /api/v1/admin/store/settings/notification`), `readAllNotifications`
(`GET /api/v1/store/notification/read/all?...` — **GET** used to mutate read-state),
`readSingleNotification` (`GET /api/v1/store/notification/read/single/?...` — same GET-as-mutation
pattern).

### `pos/payment.js` (store key: `payments`)
```
initialState = {
  orderNotifications: [], generalNotifications: [], addProductNotifications: [],
  notificationCount: 0, loading: false, notifications: {}, notificationsSettings: {},
  isLoading: false, selectedAlpineRewards: []
}
```
Note: the first seven fields here are **verbatim duplicates of `pos/notifications.js`'s shape**
despite this slice having nothing to do with notifications — evidence this slice was
scaffolded by copying `pos/notifications.js` and only `selectedAlpineRewards` was actually added
for its own purpose; the copied fields appear unused within this slice's own reducers (not
exhaustively traced). Thunks (`src/redux/apis/pos/payement.js` [sic, filename typo], all read
`${process.env.REACT_APP_BASE_URL}` directly, bypassing the shared axios instance as in
`pos/products.js`): `placeOrder` (`POST /api/v1/pos/submit/cart`), `fetchCreditStatus`
(`GET /api/v1/pos/real/time/transaction/status?orderId=${id}`), `placeOrderPrintSetup`
(`GET /api/v1/print/receipt/${storeId}?orderId=...&userId=...`), `getAlpineRedeemPoints`
(`GET /api/v1/alpine/getReedemPoints?...` [sic]), `getAlpineReferralCode`
(`POST /api/v1/alpine/getReferCode`), `validateAlpineReferralcode`
(`POST /api/v1/alpine/refCode/usingPhone`), `getWolfPackRewards`
(`GET /api/v1/alpine/get/wolfpack/points?...`).

### `printer.js` (store key: `printerSetting`)
```
initialState = { printerName: '', loading: false, error: null }
```
Thunks (`src/redux/apis/printer.js`, `[main]`): `fetchSelectedPrinters`
(`GET /api/v1/admin/store/settings/printer?...`), `updatePrinterSetting` (dynamic — see file).

### `products.js` (store key: `products`) — admin-side product management
```
initialState = { products: [], loading: false, error: null, singleProduct: null, singleMasterProduct: null, productTerpenoids: {} }
```
Thunks (`src/redux/apis/products.js`, all `[main]`, 20 thunks total — the busiest single api
file): `fetchProducts` has **two same-named exported functions** in `apis/products.js` (verified:
`fetchProductsAPI` is defined twice — once as `POST /api/v1/product/master/catalogue?...`, once as
`GET /api/v1/admin/store/products/all?...` — in JS the second definition silently shadows/replaces
the first at module-eval time, so whichever thunk imports `fetchProductsAPI` always gets the GET
version; the POST version is dead code that looks callable but never runs).
`fetchStoreProducts` (`POST /api/v1/admin/store/products/all?...`), `fetchSingleProduct`... (dynamic),
`fetchSingleMasterProduct` (`GET /api/v1/product/${id}?userType=admin`), `fetchProductBatches`
(`GET /api/v1/admin/store/products/get/product/batches/${id}?...`), `updateProductBatch`
(`PUT /api/v1/admin/store/products/batches/${batchId}`), `deleteProductBatch`
(`POST /api/v1/admin/store/products/batches/delete` — **POST** for a delete operation),
`fetchProductInventories` (`GET /api/v1/product/inventory/${id}?...`),
`fetchProductActivityLogs` (`GET /api/v1/product/inventory/activity/logs?...`), `addProduct`
(`POST /api/v1/admin/store/products/create`), `updateProduct`
(`PUT /api/v1/admin/store/products/update` — note: no id in the path, id must travel in the body),
`assignInventory` (`POST /api/v1/product/inventory/assigned`), `createProductBatch`
(`POST /api/v1/admin/store/products/create/product/batch`), `deleteProduct`
(`POST /api/v1/admin/store/products/delete` — POST for delete, same pattern as batches),
`fetchProductTerpenoids` (`GET /api/v1/product/terpenoids/details/${id}?...`),
`fetchFilterProducts` (`POST /api/v1/product/terpenoids/details/?...` — same path family as the
terpenoids fetch above, differentiated by verb only), `addProductFromMasterCatalog`
(`POST /api/v1/admin/store/products`), `createStoreProductBatch`
(`POST /api/v1/admin/store/products/batches`), `fetchProductTraits`
(`GET /api/v1/product/traits/store/details/${id}?...`), `deleteProductTrait`
(`DELETE api/v1/product/traits/store/delete/${productId}/${traitId}`), `createProductTrait`/
`updateProductTrait` (both resolve to `PUT api/v1/product/traits/store/update` — two thunks, one
endpoint, again), `getSubTraitForMain` (`GET /api/v1/product/traits/sub/listing?...`),
`getProductTraitDetail` (`GET api/v1/product/traits/store/individual/details?...`),
`getTraitListing` (`GET /api/v1/product/traits/main/listing?...`), `deleteProductUnit`
(`DELETE /api/v1/delete/product/unit/${encodedUnit}`), `getUnitListing`/`addProductUnit`
(dynamic — see file).

### `roleAndPermissions.js` (store key: `roleAndPermissions`)
```
initialState = { roles: [], isLoading: false, error: null, isUpdatingStatus: false, userRoles: {}, isUpdatingRole: false, loading: false }
```
Thunks (`src/redux/apis/roleAndPermissions.js`, **mixed hemp/main**, 20 thunks — second busiest
api file): `fetchRoles` (`GET [hemp] api/v1/admin/user/rules`), `fetchRoleList`
(`GET [hemp] /api/v1/admin/get?...`), `deleteBulkRole` (`POST [hemp] /api/v1/admin/bulk/delete`),
`fetchRoleDetails` (`GET [hemp] /api/v1/admin/${roleId}`), `addRole`
(`POST [hemp] /api/v1/admin/create` — same path string as `userSignupAPI` on **main**, see
`authSlice.js` note above), `createRole` (`POST [hemp] /api/v1/admin/store/settings/roles`),
`updateRole` (`PUT [hemp] /api/v1/admin/edit/${roleId}`), `deleteRole`
(`DELETE [hemp] /api/v1/admin/role/permissions/roles/${roleId}`), `rolesAndPermissionList`
(`GET [hemp] /api/v1/admin/roles/permission?...`), `fetchUserRolesList`
(`GET [hemp] /api/v1/admin/store/settings/roles`), `updateUserRole`
(`POST [hemp] /api/v1/admin/store/settings/roles/update/permissions`), `deleteUserRole`
(`DELETE [hemp] /api/v1/admin/store/settings/roles/${roleId}`), `fetchAllPermissions`
(`GET [hemp] /api/v1/admin/store/settings/roles/permissions/all`), `deletePrinterRole`
(`DELETE [main] /api/v1/delete/printer/settings/${roleId}` — the only **main**-client call in this
file, everything else in it is **hemp**), `fetchPrinterUserList`
(`GET [main] /api/v1/fetch/printer/settings/listing?...`), `addPrinterUserSetup`
(`PUT [main] /api/v1/update/printer/settings/${id}`), `deleteUser`
(`DELETE [hemp] /api/v1/admin/delete/${roleId}`), `getRoleandPermission`
(`GET [hemp] /api/v1/admin/role/permissions/listing/all`), `addRoleandPermission`
(`PUT [hemp] /api/v1/admin/role/permissions/roles/${roleId}`), `fetchStores` (not resolved to a
distinct endpoint in this file — likely reuses `fetchUserRolesList`'s call, not confirmed).

### `settings/*.js` (store keys: `companyInformation`, `branch`, `taxes`, `shippingSlice`, `cannabisSlice`, `shopSetting`) — one slice per settings sub-page
- `settings/company.js` → `{ loading: false }` (minimal, most company-info state appears to live in
  component-local `useState`, not Redux). Thunk: `updateCompanyInfo`
  (`PUT [main] /api/v1/admin/store/${storeId}`).
- `settings/branch.js` → `{ loading: false }`. Thunks (`[main]`): `updateBranchInfo`
  (`PUT /api/v1/admin/store/settings/branch/${id}`), `createBranch`
  (`POST /api/v1/admin/store/settings/branch`), `branchList`
  (`GET /api/v1/admin/store/settings/branch/all?...`), `deleteBranch`
  (`DELETE /api/v1/admin/store/settings/branch/${id}`).
- `settings/cannabisLimit.js` → `{ isLoading: false, error: null, limits: [], loading: false }`.
  Thunks (`[main]`): `fetchCannabisLimit` (`GET api/v1/cannabis/limit?storeId=${id}`),
  `updateCannabisLimit` (`PUT api/v1/cannabis/limit/${id}`), `CreateLimitMange`
  (`POST api/v1/cannabis/limit`).
- `settings/taxes.js` → `{ loading: false, compoundTaxStatus: '', taxesList: [] }`. Thunks
  (`[main]`): `updateTaxInfo` (`PUT /api/v1/tax${taxId}` — **missing a slash/segment separator**,
  literally concatenates `tax` + the raw id with nothing between them, e.g. `/api/v1/tax64f...`
  rather than `/api/v1/tax/64f...` — verify this is intentional on the backend, it reads like a
  bug), `createTaxes` (`POST /api/v1/tax`), `taxesList` (`GET api/v1/tax/details?...`),
  `deleteTaxes` (`POST /api/v1/tax/delete` — POST for delete again), `updateTaxOrder`
  (`POST /api/v1/admin/store/settings/tax/update/order`), `updateCompundTaxStatus` [sic]
  (`POST /api/v1/admin/store/settings/tax/update/status`), `fetchCompundTaxStatus` [sic]
  (`GET api/v1/admin/store/settings/tax/status?storeId=${id}`).
- `settings/shipping.js` → `{ methods: {}, isLoading: false, error: null, isUpdating: false,
  updateError: null }`. Thunks (`[main]`): `fetchShippingStatus`
  (`GET api/v1/shipping/status?storeId=${id}`), `updateShippingMethod` (dynamic — see file).
- `settings/shopSettings.js` → `{ batchStatus: false, loading: false }`. Thunks (`[main]`):
  `updateBatchSettings` (`POST /api/v1/admin/store/settings/shop/batch/status`),
  `updateDeliverySettings` (`POST /api/v1/update/deliveryStatus`), `fetchBatchSettings`
  (`GET /api/v1/admin/store/settings/shop/batch/status?storeId=${id}`), `fetchDeliverySettings`
  (`GET /api/v1/get/delivery/status?storeId=${id}`), `fetchInstructionSettings`
  (`GET /api/v1/get/user/instructions?storeId=${id}`), `fetchRoundamountSettings`
  (`GET /api/v1/get/price/roundamount?storeId=${id}`), `updateRoundAmount`
  (`POST /api/v1/update/price/roundamount`), `updateINSSettings`
  (`POST /api/v1/update/user/instructions`).
- `settings/CreditCardFee.js` (**not registered in the store — dead**, see top of file) →
  `{ creditCardStatus: false, loading: false }`. Thunks defined but unreachable via Redux:
  `updateCreditCardSettings` (`POST /api/v1/update/ccfees/status?storeId=${id}`),
  `fetchCreditCardSettings` (`GET /api/v1/ccfees/status?storeId=${id}`).

### `promotions.js` (store key: `promotion`)
```
initialState = { isLoading: false, promotionRules: [], promotionDetail: {}, error: null, promotions: {} }
```
Thunks (`src/redux/apis/promotion.js`, all `[main]`): `createPromotion`
(`POST /api/v1/admin/promotion`), `updatePromotion`
(`PUT /api/v1/admin/promotion/${id}`), `downloadPromotionAsPdf`
(`GET /api/v1/download/csv/promo/${id}` — a "download as PDF" thunk hitting a path literally named
`csv`, likely a stale name on the backend or the frontend's own naming is wrong; not resolvable
from this repo alone), `fetchAllPromotion` (`GET /api/v1/admin/promotion/all?...`),
`fetchSinglePromotion` (`GET /api/v1/admin/promotion/${id}`), `deletePromotion`
(`DELETE /api/v1/admin/promotion/${id}`), `getPromotionCartRulesByType`
(`GET /api/v1/admin/cart/rules`), `getPromotionProductRulesByType`
(`GET /api/v1/admin/product/rules`).

### `memberships.js` (store key: `memberships`)
```
initialState = { memberships: [], memberShipDetails: {}, loading: false, error: null }
```
Thunks (`src/redux/apis/memberships.js`, all `[main]`): `fetchMemberships`
(`GET /api/v1/admin/promotion/all/membership?...`), `fetchMemberShipDetails`
(`GET /api/v1/admin/promotion/membership/${id}`), `createMemberShip`
(`POST /api/v1/admin/promotion/membership`), `updateMemberShip`
(`PUT /api/v1/admin/promotion/membership/${id}`), `deleteMemberShip`
(`DELETE /api/v1/admin/promotion/membership/${id}`) — note memberships live under the
`/api/v1/admin/promotion/...` path family, i.e. they are modeled as a kind of promotion on the
backend even though the frontend gives them a fully separate slice/API module.

### `strain.js` (store key: `strain`)
```
initialState = { strains: [], loading: false, error: null, flavors: [], singleStrain: {} }
```
Thunks (`src/redux/apis/strain.js`, all `[main]`): `getStrainList`
(`GET api/v1/strain?...`), `getSingleStrain` (`GET api/v1/strain/${id}`), `getMainStrain`/
`updateMainStrain` (both `POST api/v1/strain/update/main/metas` — same one-endpoint-two-thunks
pattern seen elsewhere), `getFlavoursList` (dynamic — see file), `createStrain`/`updateStrain`
(both `PUT api/v1/strain/update/${id}` — differentiated only by whether `id` is passed),
`deleteStrain` (`DELETE api/v1/strain/delete/strain/${id}`), `fetchSingleStrain` (not distinctly
resolved — likely reuses `getSingleStrain`'s endpoint).

### `terpenoids.js` (store key: `terpenoids`)
```
initialState = { isLoading: false, error: null, isDeleting: false, terpenoidsList: [], isFetching: false, terpeneDetails: {} }
```
Thunks (`src/redux/apis/terpenoids.js`, all `[main]`): `fetchTerpenoids`
(`GET /api/v1/product/terpenoids/?...`), `createTerpenoid`
(`POST /api/v1/product/terpenoids`), `updateTerpenoid`
(`PUT /api/v1/product/terpenoids/${id}`), `deleteTerpenoid`
(`POST /api/v1/product/delete/terpenoids/${productId}` — POST for delete), `deleteMainTerpenoid`
(`DELETE /api/v1/product/terpenoids/${id}`), `fetchSingleTerpenoid`
(`GET /api/v1/product/terpenoids/${id}`), `assignTerpenoidToProduct`
(`POST /api/v1/product/assign/terpenoids/${productId}`), `updateTerpenoidToProduct`
(`PUT /api/v1/product/update/terpenoids/${productId}`).

### `admin.js` (store key: `admin`)
```
initialState = { admins: [], adminDetails: {}, loading: false, error: null }
```
Thunks (`src/redux/apis/admin.js`, all `[hemp]`): `fetchAdmins`
(`GET /api/v1/admin/get?...`), `fetchAdminDetails`
(`GET /api/v1/admin/${id}?storeId=${storeId}`), `addAdmin` (`POST /api/v1/admin/create` — same
path as `userSignupAPI` (main) and `addRoleAPI` (hemp), a third call site sharing that literal
path string across two different base clients), `updateAdmin`
(`PUT /api/v1/admin/edit/${id}`), `deleteAdmin` (`DELETE /api/v1/admin/delete/${id}`),
`fetchRoleList` (`GET /api/v1/admin/role/permissions/listing/all`).

### `dashboard.js` (store key: `dashboard`) — 15 independent loading/error flag pairs
```
initialState = {
  totalCustomersCountData: null, fetchingCustomer: false,
  taxCalculationStatsData: null, fetchingTaxCalculationStats: false,
  totalSoldCategoriesData: null, fetchingSoldCategories: false,
  memberCalculationStatsData: null, fetchingMemberCalculationStats: false,
  creditCalculationStatsData: null, fetchingCreditCalculationStats: false,
  totalProductsSoldStatsData: null, fetchingTotalProductsSoldStats: false, errorTotalProductsSoldStats: null,
  totalRevenueStatsData: null, fetchingTotalRevenueStats: false, errorTotalRevenueStats: null,
  totalOrdersStatsData: null, fetchingTotalOrdersStats: false, errorTotalOrdersStats: null,
  totalProductsSoldData: null, fetchingTotalProductsSold: false, errorTotalProductsSold: null,
  completedOrdersStatsData: null, fetchingCompletedOrdersStats: false, errorCompletedOrdersStats: null,
  cancelledOrderStatsData: null, fetchingCancelledOrderStats: false, errorCancelledOrderStats: null,
  totalNewCustomersStatsData: null, totalNewCustomerStatsError: null, fetchingTotalNewCustomersStats: false,
  fetchingtotalOrderPlacedOrdersStats: false, totalOrderPlacedOrdersStatsData: null
}
```
15 thunks, one dashboard-widget-shaped pair of fields each (`src/redux/apis/dashboard.js`, all
`[main]`) — this is the textbook shape that would collapse to `{ [statKey]: { data, loading,
error } }` if the 15 stats shared one reducer pattern instead of one field-pair per stat; not a
bug, but the clearest single example of the slice-level "copy the pattern, don't share it"
approach used throughout this codebase. One endpoint typo of note: `creditCalculationsStatsAPI` →
`GET /api/v1/admin/dashboard//total/credit?...` — **double slash** in the literal path string
(`src/redux/apis/dashboard.js`), almost certainly harmless (most HTTP servers normalize double
slashes) but worth a lint/typo pass.

### `materialUISlice.js` (store key: `materialUI`) — pure UI-chrome state, no thunks
```
initialState = {
  miniSidenav: false, transparentSidenav: false, whiteSidenav: false, sidenavColor: "info",
  transparentNavbar: true, fixedNavbar: true, openConfigurator: false, direction: "ltr",
  layout: "login", darkMode: false
}
```
Material Dashboard 2 template state (sidenav/navbar/dark-mode toggles) — inherited wholesale from
the template, not product-specific.

### `modalSlice.js` (store key: `modal`) — pure UI state, no thunks
```
initialState = { isOpen: false, isOpenDrawer: false, drawer: "", modal: null, modalData: {}, drawerData: {}, isLoading: false }
```

### `faq.js` (store key: `mainFAQ`)
```
initialState = { faqs: [], loading: false, error: null }
```
Thunks (`src/redux/apis/faq.js`, `[main]`): `getMainFAQ` (`GET /api/v1/faq`), `updateMainFAQ`
(`POST /api/v1/create/faq`).

### `fullfillment/fullfillment.js` (store key: `fullfillment`) — Fulfillment/Checkin kanban
```
initialState = { loading: false, error: null, logsloading: false }
```
15 thunks (`src/redux/apis/fullfillment/fullfillmentCommon.js`, all `[main]`), several using GET
for state-mutating actions (same pattern noted elsewhere): `fetchCheckinLogs`
(`GET /api/v1/pos/checkin/logs?...`), `UpdateCheckingFlow`
(`POST /api/v1/pos/checkin/member`), `fetchKanBan`
(`GET /api/v1/pos/fulfillment/orders?...`), `getProductScan`
(`POST /api/v1/pos/scan/items`), `getProductPriceCheck`
(`POST /api/v1/pos/scan/items/batch`), `fetchKanBanOrderDetail`
(`GET /api/v1/pos/order/detail?...`), `updateFullFillmentStatus`
(`GET /api/v1/pos/checkin/list?...` — thunk name says "update", endpoint is a GET list fetch;
likely mis-wired to the wrong api function, or the api function itself is misnamed — not
resolvable without the backend), `fetchCheckinList` (`GET /api/v1/pos/checkin/list?...` — same
endpoint as the previous thunk), `forgotPinCode` (`POST /api/v1/pos/user/forgot/pin`),
`checkPincodetoEditOrder` (`POST /api/v1/pos/pin/login`), `removeCheckoutList`
(`POST /api/v1/pos/member/check/out`), `updateCheckoutList`
(`POST /api/v1/pos/checkin/order`), `fetchFullfilmentSettings`
(`GET /api/v1/pos/order/fulfillment/status?storeId=${id}`), `updateFullFilmentStatus` [sic, second
similarly-named thunk with different capitalization from `updateFullFillmentStatus` above]
(`POST /api/v1/pos/order/fulfillment/status`), `ageVerifyStatus`
(`POST /api/v1/pos/order/age/verification`).

---

## Constants of note (`src/utilities/constants/index.js`)

localStorage key names (all consumed via `getData`/`setData`, `src/utilities/common/index.js`):
`AccessTokenName = "application-hyperwolf"`, `AccessTokenId = "access-token"`,
`CartSessionId = "application-cart-session"`, `Location = "application-location"`,
`LocationWordpress = "application-location-2"`, `SelectedReward = "application-reward"`,
`RewardUser = "application-reward-user"`, `PaymentId = "application-paymentId"`,
`PineappleExpress = "application-express"`,
`PineappleExpressLastStatus = "application-express-last-status"`, and the hardcoded
`OverrideInventoryId = "5f99fc0ee8a8da08def1e72e"` flagged in the main report §5/§11.

## Env vars actually consumed (verified, `grep -a -rhoE "process\.env\.REACT_APP_[A-Z0-9_]+"
src/` — 14 distinct vars, cross-checked against `.env.example`'s 17 declared vars)

`REACT_APP_BASE_URL`, `REACT_APP_HEMP_BASE_URL`, `REACT_APP_API_AUTH_KEY`,
`REACT_APP_GOOGLE_KEY`, `REACT_APP_PUBLIC_BASE_URL`, `REACT_APP_API_KEY`,
`REACT_APP_AUTH_DOMAIN`, `REACT_APP_PROJECT_ID`, `REACT_APP_STORAGE_BUCKET`,
`REACT_APP_MESSAGING_SENDER_ID`, `REACT_APP_APP_ID`, `REACT_APP_MEASUREMENT_ID`,
`REACT_APP_VAPID_KEY`, `REACT_APP_AMZAON_S3_URL` (referenced only inside a comment,
`src/layouts/strains/addStrain/index.jsx:366` — not live). **Declared in `.env.example` but never
referenced anywhere in `src/`**: `REACT_APP_METRC_BASE_URL`, `REACT_APP_HYPERWOLF_BASE_URL`,
`REACT_APP_METRC_ACCESS_1`, `REACT_APP_METRC_ACCESS_2`, `REACT_APP_METRC_ACCESS_3` (5 vars — the
6th unused-looking one, `REACT_APP_AMZAON_S3_URL`, is technically referenced but only inside a
comment as noted above).
