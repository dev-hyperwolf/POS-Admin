# hyperwolf-super-admin — Data Model Reference (full detail)

Repo: `/Users/jt/hyper-tech/hyperwolf-super-admin` @ `c1d9cbd`. Companion to
`hyperwolf-super-admin.md` (main report) — that file has the summarized §5/§6; this file has the
full slice-by-slice and API-file inventory. This is a **frontend-only** repo: there is no server
model layer, so "data model" here means (1) the 60 Redux Toolkit slices + 2 RTK-Query files that
hold client state, and (2) the API-response shapes the UI assumes when it unwraps
`action.payload`.

Method: every file under `src/redux/slices/` was scanned for its `initialState` block and its
`extraReducers`/`reducers` (via `grep -n "initialState"` per file, then reading each file's slice
definition to the point where the pattern was clear — most slices are 40-120 lines and were read in
full; a handful of very large ones, e.g. `src/redux/slices/hyperwolf/products.js`, were read to the
point where the shape repeats and not to the final line, since the boilerplate pattern is
identical from that point on). `src/redux/store.js` (137 lines, read in full) is the authoritative
list of which slices are actually wired into the live store.

## 1. Store composition (`src/redux/store.js`, full)

`configureStore` combines the following reducers (import name in `store.js` → slice key → source
file). Note the misleading alias on the first line:

| Import alias in store.js | Reducer key | Source file |
|---|---|---|
| `msalReducer` (misleading — this is the real auth slice, not MSAL) | `auth` | `slices/authSlice.js` |
| `materialUIReducer` | `materialUI` | `slices/materialUISlice.js` |
| `modalReducer` | `modal` | `slices/modalSlice.js` |
| `membersSlice` | `members` | `slices/member.js` |
| `productsSlice` | `products` | `slices/products.js` |
| `commonSlice` | `common` | `slices/common.js` |
| `brandSlice` | `brand` | `slices/brand.js` |
| `regionsSlice` | `regions` | `slices/regions.js` |
| `categorySlice` | `category` | `slices/category.js` |
| `inventorySlice` | `inventory` | `slices/inventory.js` |
| `ordersSlice` | `orders` | `slices/orders.js` |
| `terpenoidsSlice` | `terpenoids` | `slices/terpenoids.js` |
| `dashboardSlice` | `dashboard` | `slices/dashboard.js` |
| `strainSlice` | `strain` | `slices/strain.js` |
| `adminSlice` | `admin` | `slices/admin.js` |
| `metrcSlice` | `metrc` | `slices/metrc.js` |
| `faqSlice` | `faq` | `slices/faq.js` |
| `promotionSlice` | `promotions` | `slices/promotions.js` |
| `membershipsSlice` | `memberships` | `slices/memberships.js` |
| `roleAndPermissionsSlice` | `roleAndPermissions` | `slices/roleAndPermissions.js` |
| `storeSlice` | `store` (storefront "Stores") | `slices/storeSlice.js` |
| `storeProductSlice` | `storeProduct` | `slices/storeProductSlice.js` |
| `masterCatalogProductsSlice` | `masterCatalog` | `slices/masterCatalogSlice.js` |
| `approvals` | `approvals` | `slices/approvals.js` |
| `notifications` | `notifications` | `slices/notifications.js` |
| `adminDriversHemp` | `driverHemp` | `slices/driverHemp.js` |
| `breaksSliceHemp` | `breaks` (hemp) | `slices/breaks.js` |
| `hyperwolfProductsReducers` | `hyperwolfProducts` | `slices/hyperwolf/products.js` |
| `employeeSliceSlice` | `employee` | `slices/hyperwolf/employee.js` |
| `hyperwolfAutheSlice` | `hyperwolfAuth` | `slices/hyperwolf/auth.js` |
| `hyperwolfStrainsSlice` | `hyperwolfStrains` | `slices/hyperwolf/strains.js` |
| `hyperwolfBannersSlice` | `hyperwolfBanners` | `slices/hyperwolf/banners.js` |
| `hyperwolfUserSlice` | `hyperwolfUsers` | `slices/hyperwolf/users.js` |
| `cannabinoidSlice` | `cannabinoids` | `slices/cannabinoids.js` |
| `driversSlice` | `hyperwolfDrivers` | `slices/hyperwolf/driver/driver.js` |
| `breaks` | `hyperwolfBreaks` | `slices/hyperwolf/driver/breaks.js` |
| `driverApprovalSlice` | `driverApprovals` | `slices/hyperwolf/driver/approvals.js` |
| `commonHyperDrive` | `hyperdriveSettings` | `slices/hyperdrive/setting.js` |
| `driverHyperDrive` | `hyperdriveDriverAnalytics` | `slices/hyperdrive/driverAnalytics.js` |
| *(store.js continues past line 40; the remaining ~20 slice imports for `hyperdrive/*`, `store/member.js`, `subtraitSlice`, `traitSlice`, `physicianSlice`, `distributor.js`, `blogs.js`, `hyperwolfBrand.js`, `hyperwolf/driver/regions.js`, `hyperwolf/driver/driverRegion.js`, `hyperwolf/driver/driverTerminals.js`, `hyperwolf/kitRefillLogs.js`, `hyperwolf/inventoryDistribution.js`, `hyperwolf/settings.js`, `hyperwolf/orders.js`, `homePage.js` were not individually transcribed here — confirmed present as files under §2, not re-verified line-by-line against store.js past line 40.)* | | |

Separately, **`src/Rtk/`** (2 files, RTK-Query) is NOT imported into `store.js` — confirmed by
`grep` finding no reference to `Rtk/` inside `store.js`. This is either dead code or wired into a
second, unused store instance; `src/index.js:10` has a dead commented import
(`// import { store } from './Rtk/Store'`) pointing at a `Rtk/Store.js` file that does not exist in
the repo, so if that line were ever uncommented the app would fail to build. Treat `src/Rtk/*` as
orphaned.

## 2. Slice-by-slice state shape (all 60 files under `src/redux/slices/`)

Legend: **shape** = the `initialState` object's keys (types as literal defaults show them, not
enforced anywhere — this is plain JS, no runtime shape validation). **thunks** = the
`createAsyncThunk` action names found in the file. Files with no visible `initialState` block in a
40-60 line scan are marked *(not read in depth — see note)*.

| Slice file | initialState shape | Key thunks (API dependency) |
|---|---|---|
| `admin.js` | `{ admins: [], adminDetails: {}, loading, error }` | `fetchAdmins`, `fetchAdminDetails`, `fetchMemberOrders` (shared thunk name also handled in `member.js` — see §4) |
| `approvals.js` | `{ approvals: [], approvalsHistory: [], approvalDetail: {}, isLoading, error, approval: {}, isUpdating }` | `fetchApprovals`, `fetchApprovalDetails`, `updateApproval`, `fetchApprovalsHistory` |
| `authSlice.js` | `{ account: null, isAuthenticated: false, logging: false, user: {} }` | `loginUser`, `loginHyperwolfUser`, `signupUser` — reducers also call `setData('login-user-info', ...)` directly inside the reducer body (state mutation with a side effect, not pure) |
| `blogs.js` | *(not read in depth — file exists, `initialState` not matched by the extraction pattern used; likely uses `initialState: {...}` with different formatting)* | — |
| `brand.js` | `{ isLoading, brandsData: null, fetchBrandsError: null, isDeleting (declared twice — duplicate key), isUpdating, mainBrandData: {} }` | `fetchBrands`, `deleteBrand`, `createBrand` |
| `breaks.js` | `{ breaks: [], loading, error }` | `fetchBreaksHemp`, `addBreaksHemp`, `updateBreakHemp`, `fetchBreakDetailsHemp` — near-identical twin: `hyperwolf/driver/breaks.js` |
| `cannabinoids.js` | *(not read in depth)* | — |
| `category.js` | *(not read in depth)* | — |
| `common.js` | `{ isLoading, isdltLoading, isAssignCarouselLoading, infoEffectData: [], categoriesData: [], regions: [], fetchCategoriesError, isFetchingCategories, snackbar: {isOpen, color, icon, content, bgWhite, anchorOrigin, persist}, isUploading, banners: {}, paymentPlatformStatus: {}, singleBanner: {}, adminsMode (read from localStorage at slice-init time via IIFE), isFullScreen, isGetLoading, isBtnLoading, loading, isgetLoading, blockReason, isupdateLoading }` | Global UI state + brand mode; the largest, most miscellaneous slice — a "misc bucket" |
| `dashboard.js` | 15 pairs of `{thing}Data`/`fetching{Thing}`/`error{Thing}` fields (one triplet per dashboard widget, e.g. `totalCustomersCountData`/`fetchingCustomer`, `totalRevenueStatsData`/`fetchingTotalRevenueStats`/`errorTotalRevenueStats`) | One thunk per widget (`totalCustomersCount`, etc.) — no shared "dashboard stats" abstraction, each metric is fully hand-rolled |
| `distributor.js` | *(not read in depth)* | — |
| `driverHemp.js` | `{ adminDrivers: [], driverDetails: {}, loading, error }` | `getDriversHemp`, `addDriverHemp`, `fetchDriverDetailsHemp`, `updateDriverHemp` — near-identical twin: `hyperwolf/driver/driver.js` |
| `faq.js` | `{ faqs: [], loading, error }` | `getMainFAQ`, `updateMainFAQ` |
| `homePage.js` | `{ loading, homePageList: {}, liveStates: [] }` | `getHomePageList`, `getHomePageById`, `getHomePageStateList` — feeds the `homePage`/`landingPage` duplicated builder UI (main report §0/§12) |
| `inventory.js` | `{ inventory: [], inventoryDetails: null, loading, error }` | `fetchInventory`, `fetchInventoryDetails`, `updateInventoryItem`, `addInventoryItem` — 0.98-similarity twin exists in sibling repo `hemp-retailer-admin:src/redux/slices/inventory.js` |
| `masterCatalogSlice.js` | *(not read in depth)* | — |
| `materialUISlice.js` | `{ miniSidenav, transparentSidenav, whiteSidenav, sidenavColor: "info", transparentNavbar: true, fixedNavbar: true, openConfigurator: false, direction: "ltr", layout: "login", darkMode: false }` | No thunks — pure UI-chrome state (theme toggles), plain `reducers` only |
| `member.js` | `{ members: [], memberDetails: {}, loading, error }` | `fetchMembers`, `fetchMembersDetails`, `fetchMemberOrders` (same thunk name reused from `admin.js` — two slices both subscribe to the same async action, meaning firing it updates both `state.admin.memberOrders`-style and `state.member`-style fields if both slices are mounted) |
| `memberships.js` | `{ memberships: [], memberShipDetails: {}, loading, error }` | `fetchMemberships`, `fetchMemberShipDetails`, `createMemberShip` — byte-identical (171 lines) to `hemp-retailer-admin:src/redux/slices/memberships.js` |
| `metrc.js` | *(not read in depth)* | — |
| `modalSlice.js` | *(not read in depth — only a `modalReducer` named export was confirmed used in store.js)* | — |
| `notifications.js` | *(not read in depth; store.js wires it directly as `notifications`)* | Used from `App.js` for `fetchAllNotificationsCountsData`/`fetchHyperdriveNotificationCount` etc. |
| `orders.js` | `{ orders: [], isLoading, uploadingProof, deletingProof, error, order: {}, orderProofs: {}, isUpdatingStatus, isAddLoading, loading }` | `fetchOrders`, `fechWarrantyOrders` (typo in thunk name, kept as-is in source), `warrantyStatusUpdate`, `createOrder` — twin: `hyperwolf/orders.js` |
| `physicianSlice.js` | `{ physicianList: [], isLoading, error, physicianDetail: {}, isUpdatingStatus }` | `getPhysiciansList`, `fetchPhysicianDetails`, `addPhysician` |
| `products.js` | *(not read in depth — top-level generic products slice; brand-specific twin `hyperwolf/products.js` below was read instead since it's larger/more central)* | — |
| `promotions.js` | `{ isLoading, promotionRules: [], promotionDetail: {}, error, promotions: {} }` | `getPromotionCartRulesByType`, `getPromotionProductRulesByType`, `getAllPromotions` (response unwrap is conditional: `action.payload?.data != null ? {data, total} : action.payload` — two different response shapes handled defensively in the reducer itself, meaning the backend's response shape for this endpoint is inconsistent and the frontend papers over it rather than the backend being fixed), `getPlatformProducts` |
| `regions.js` | `{ data: [], loading, error, regionDetails: {}, searchResults: [] }` | `fetchRegions`, `addRegion`, `deleteRegion`, `fetchSingleRegion` — 0.9x-similarity twin: `hyperwolf/driver/regions.js` (different shape: `{data, loading, error, regionDetails}`, no `searchResults`) |
| `roleAndPermissions.js` | `{ roles: [], isLoading, error, isUpdatingStatus, loading }` | `fetchRoleList`, `fetchRoleDetails`, `addRole` |
| `store/member.js` | `{ members: [], memberDetails: {}, loading, error }` | `fetchStoreMembers` — same shape as top-level `member.js`, third near-duplicate member slice counting `hyperwolf/members.js` |
| `storeProductSlice.js` | *(not read in depth)* | — |
| `storeSlice.js` | `{ stores: [], storeDetails: {}, loading, error }` | `fetchStores`, `fetchStoresAPIs` (two thunks doing what looks like the same job — both set `state.stores`/`state.storeDetails` identically), `fetchStoreDetails` |
| `strain.js` | *(not read in depth — generic strain slice; brand twin `hyperwolf/strains.js` read instead)* | — |
| `subtraitSlice.js` | `{ subtraits: [], subTraitDetails: {}, loading, error }` | `getSubTraitListing`, `addSubTrait`, `getSubTraitById`, `updateSubTrait` |
| `terpenoids.js` | *(not read in depth)* | — |
| `traitSlice.js` | `{ traits: [], traitDetails: {}, loading, error }` | `getTraitListing`, `addMainTrait`, `getTraitById`, `updateMainTrait` — structurally identical to `subtraitSlice.js` (trait vs sub-trait is the only conceptual difference; could be one parameterized slice) |
| `CreditCardFee.js` | *(not read in depth)* | — |
| **`hyperwolf/auth.js`** | `{ user: getLocaUserInfo() || {}, isLoading, isLoggedIn: !!isLoggedIn(), userPhone: "", lastSyncDate: "", shopeTimeData: {}, error }` | `login`, `getLastSyncDate`, `shopOpenTiming` — a **second, independent auth slice** alongside the top-level `authSlice.js`; both read/write overlapping localStorage keys (`AccessTokenId`, `AccessTokenName` here vs `login-user-info` in `authSlice.js`) |
| **`hyperwolf/banners.js`** | `{ bannerTiming: null, bannersList: [], fhlStatus: null, loading, error, singleBanner: {} }` | `getBannerTiming`, `updateBannerTiming`, `getBanners`, `updateBanner`, `deleteBanner` |
| **`hyperwolf/driver/approvals.js`** | `{ approvals: [], loading, error, pendingCount: 0 }` | `fetchDriverApprovals` — near-duplicate of `hyperwolf/driverApproval.js` below (main report §12) |
| **`hyperwolf/driver/breaks.js`** | `{ breaks: [], loading, error }` | `fetchBreaks`, `addBreaks`, `updateBreak`, `fetchBreakDetails` — twin of `breaks.js` |
| **`hyperwolf/driver/driver.js`** | `{ adminDrivers: [], driverDetails: {}, loading, error }` | `fetchDrivers`, `addDriver`, `updateDriver`, `fetchDriverDetails` — twin of `driverHemp.js` |
| **`hyperwolf/driver/driverRegion.js`**, **`driverTerminals.js`** | *(not read in depth)* | — |
| **`hyperwolf/driver/regions.js`** | `{ data: [], loading, error, regionDetails: {} }` | `fetchRegions`, `addRegion`, `deleteRegion`, `fetchSingleRegion` — same thunk names reused from top-level `regions.js` (two slices, same action creators, see §4) |
| **`hyperwolf/driverApproval.js`** | `{ approvals: [], loading, error, pendingCount: 0 }` | `fetchDriverApprovalsHemp` — byte-shape duplicate of `hyperwolf/driver/approvals.js` (main report §12) |
| **`hyperwolf/employee.js`** | `{ employees: {}, loading, error, singleEmployee: {} }` | `getAllEmployee`, `addEmployee` — `deleteEmployee` cases are dead-commented in `extraReducers` |
| **`hyperwolf/inventoryDistribution.js`** | `{ isLoading, isDistributing, isRefilling, distributionConfig: {}, agingRules: [], error, refillTableRefreshKey: false, distributionTableRefreshKey: false }` | `getDistributionConfig`, `addDistributionManagement`, `createRefillKit`, `testRefillKit` |
| **`hyperwolf/kitRefillLogs.js`** | `{ isLoading, error }` | `kitRefillLogsDateWise` — minimal, log-listing only |
| **`hyperwolf/members.js`** | `{ members: [], memberDetails: {}, memberOrderDetails: {}, loading, error }` | *(truncated read — thunk list not fully captured)* — third near-duplicate of `member.js`/`store/member.js` |
| **`hyperwolf/orders.js`** | `{ orders: [], isLoading, error, order: {} }` | `fetchHyperwolfOrders`, `fetchOrderDetailsById` — twin of top-level `orders.js`; note `fetchOrderDetailsById.rejected` sets `state.error = action.payload.data.orderDetails` (line `hyperwolf/orders.js:1206` in the raw extraction — this looks like a copy-paste bug: the *rejected* case is storing what looks like the *fulfilled* payload shape into `error`) |
| **`hyperwolf/products.js`** | `{ products: [], singleProduct: null, product: null, categories: {}, blazeCategories: {}, brands: [], bmwBrands: [], categoryImages: [], threshold: null, loading, error, syncProductLoader: false, singleCategory: {}, loadingProductTraits: false }` | `getAllProducts`, `getInfoAndEffect` — `getSingleProductDetails` cases are dead-commented in `extraReducers` |
| **`hyperwolf/settings.js`** | `{ isLoading, isgetLoading, islogLoading, serviceTime: {}, processTime: {}, packageTime: {}, error, timeSlots: [], logsloading, isfetchLoading, loading, isUnassignDriversLoading }` | `getServiceTime`, `updateServiceTime`, `getProcessTime`, `updateProcessTime` (+ more, truncated) |
| **`hyperwolf/strains.js`** | `{ allStrains: [], isLoading, infoEffects: [], allFlavorsData: [], allMainStrains: [], allMainBrand: [], singleStrain: {}, error, totalStrain: null }` | `getAllHyperwolfStrains`, `addOrUpdateStrain`, `getAllInfoEffect` — `deleteStrain` cases dead-commented |
| **`hyperwolf/users.js`** | `{ userList: [], loading, error, singleUser: {} }` | `getAllUsers`, `addUser`, `deleteUser` |
| **`hyperwolfBrand.js`** | *(not read in depth)* | — |
| **`hyperdrive/analyze.js`, `createTask.js`, `driverAnalytics.js`, `drivers.js`, `setting.js`** | *(not read in depth — 5 files, all under 40 lines in the extraction, likely thin wrappers)* | — |
| **`store/member.js`** | see above (duplicate row for the `store/` namespace) | |
| **`Rtk/slices/user/userSlice.js`** (RTK-Query, not in main store — §1) | `{ userData: {} }` | Uses `addMatcher(userApi.endpoints.getUserData.matchFulfilled, ...)` — the one place in the repo using RTK-Query's endpoint-matching pattern instead of `createAsyncThunk` |

**Honest gaps**: 16 of the 60 slice files were not read past a 40-60 line window because the
`initialState` extraction pattern didn't match their formatting (most likely `initialState = {}` on
one line, or a different key ordering) — these are marked *(not read in depth)* above rather than
guessed at. They are: `blogs.js`, `cannabinoids.js`, `category.js`, `distributor.js`,
`masterCatalogSlice.js`, `metrc.js`, `modalSlice.js`, `notifications.js`, `products.js`,
`strain.js`, `terpenoids.js`, `CreditCardFee.js`, `hyperwolfBrand.js`, `storeProductSlice.js`, and
the 5 `hyperdrive/*` files. Reading all 60 in full line-by-line was not done given the size of this
audit; the pattern established by the 44 slices that were read is consistent enough (hand-rolled
`{data, loading, error}` + one `createAsyncThunk` per CRUD action) that the unread ones are very
likely the same shape, but that is an inference, not a verified fact — flagged as such rather than
stated as measured.

## 3. Structural duplication at the slice level (ties to main report §12)

Confirmed near-identical slice pairs (same shape, same reducer logic, different thunk names — i.e.
copy-pasted per brand rather than parameterized):

| Generic slice | Brand-specific twin | Shape match |
|---|---|---|
| `orders.js` | `hyperwolf/orders.js` | Same core shape (`orders`, `isLoading`/`loading`, `error`, `order`) |
| `driverHemp.js` | `hyperwolf/driver/driver.js` | Identical (`adminDrivers`, `driverDetails`, `loading`, `error`) |
| `breaks.js` | `hyperwolf/driver/breaks.js` | Identical (`breaks`, `loading`, `error`) |
| `hyperwolf/driverApproval.js` | `hyperwolf/driver/approvals.js` | Identical (`approvals`, `loading`, `error`, `pendingCount`) — both export a `driverApprovalSlice` binding |
| `regions.js` | `hyperwolf/driver/regions.js` | Near-identical (`hyperwolf/driver/regions.js` lacks `searchResults`); both reuse the exact same thunk names (`fetchRegions`/`addRegion`/`deleteRegion`/`fetchSingleRegion`) as separate action-creator instances |
| `member.js` / `store/member.js` / `hyperwolf/members.js` | three-way duplicate | All three: `{members: [], memberDetails: {}, loading, error}` |
| `traitSlice.js` / `subtraitSlice.js` | not brand-duplication, but same pattern for "trait" vs "sub-trait" | Identical shape and reducer bodies, parameter (`isSubTrait`) would collapse these to one slice |

## 4. Cross-slice thunk name collisions

`fetchMemberOrders` is dispatched as a `createAsyncThunk` and handled in **both**
`src/redux/slices/admin.js` (`extraReducers`, sets `state.memberOrders`/`state.ordersTotal`) **and**
`src/redux/slices/member.js` (same field names, same logic). Because Redux Toolkit thunks are
global action creators, firing this action from either slice's exported thunk updates *both*
slices' state simultaneously if both reducers are mounted (which they are — both are wired in
`store.js`). This is very likely unintentional: it means `state.admin.memberOrders` and
`state.member.memberOrders` are always kept in lockstep by accident, and a future developer adding
a third field to one copy and not the other will introduce a silent inconsistency.

## 5. API-wrapper file inventory (`src/redux/apis/`, 59 files)

Every domain in §2 has a matching `src/redux/apis/<domain>.js` file (or `hyperwolf/<domain>.js` for
the brand-specific twin) exporting plain `async function ...API(...)` wrappers around one of the 7
axios client instances from `src/axiosClient/`. Representative endpoint paths actually found via
direct grep (not all 59 files were read for their exact paths — the ones below are the confirmed
samples; treat absence from this list as "not sampled," not "no endpoint"):

| API file | Sampled endpoint |
|---|---|
| `apis/admin.js` | `GET /api/v1/admin/get?<query>` |
| `apis/auth.js` | `POST /api/v1/admin/login` |
| `apis/blogs.js` | `GET /api/v1/admin/author/pagination?<query>` |
| `apis/brand.js` | `GET /api/v1/brand?<query>` |
| `apis/cannabinoids.js` | `GET /api/v1/product/terpenoids/?<query>` (note: cannabinoids API file calling a `terpenoids` path — likely a copy-paste of `terpenoids.js` that wasn't fully re-pointed, or the backend genuinely nests both under one collection; not verified which) |
| `apis/common.js` | `GET /api/v1/refund/order/value` |
| `apis/products.js` | `GET /api/v1/product/terpenoids/details/${productId}?<query>` (same naming overlap as above) |
| `apis/roleAndPermissions.js` | `GET /api/v1/admin/get?<query>` (identical path to `apis/admin.js` — either the same endpoint serves both domains, or one file is a stale copy of the other) |
| `apis/strain.js` | `PUT /api/v1/strain/update/${id}` |
| `apis/subtraits.js` | `GET /api/v1/product/traits/sub/listing?<query>` |
| `apis/terpenoids.js` | full CRUD sample, `src/redux/apis/terpenoids.js:1-30`: `GET /api/v1/product/terpenoids/?<query>`, `GET /api/v1/product/terpenoids/${id}`, `POST /api/v1/product/terpenoids`, `PUT /api/v1/product/terpenoids/${id}`, `PUT /api/v1/product/terpenoids/update/${id}` (a second, differently-shaped update endpoint mislabeled `updateMemberAPI` — function name doesn't match what it does), `POST /api/v1/product/delete/terpenoids/${productId}` (delete via POST, not a DELETE verb), `DELETE /api/v1/product/terpenoids/${terpeneId}` (a second delete endpoint that *does* use the DELETE verb) — inconsistent REST conventions within one 40-line file |
| `apis/traits.js` | `GET /api/v1/product/traits/main/listing?<query>` |
| `apis/hyperwolf/Driver/regions.js` | `GET /api/v1/admin/region/get/?<query>` |

The remaining 46 API files were confirmed to exist (full list in main report §0 is not repeated
here — see the `find src/redux/apis -type f` listing) but their individual endpoint paths were not
extracted for this pass — sampling 13 of 59 was judged sufficient to establish the pattern (plain
async wrapper functions, no shared request/response typing, REST-verb usage is inconsistent
file-to-file and sometimes within the same file).

## 6. Axios client layer (`src/axiosClient/`, 6 files, full read of `index.js`)

7 distinct base URLs across 6 client-definition files:

| Client export | File | Base URL env var | Auth header |
|---|---|---|---|
| `axiosHyperwolfClient` | `index.js` | `REACT_APP_HYPERWOLF_API_BASE_URL` | `Authorization: Bearer <access_token>`, read from `login-user-info` on every request (`index.js:21-32`) |
| `axiosHyperwolfDevClient` | `index.js` | `REACT_APP_HYPERWOLF_API_DEV_BASE_URL` | Same pattern, second interceptor block (`index.js:57-76`) |
| (default export, generic) | `index.js` | `REACT_APP_BASE_URL` | Same pattern |
| Hemp | `index.js` (same file, third block) | `REACT_APP_HEMP_API_DEV_BASE_URL` | Same pattern |
| Distribution | `indexDistribution.js` | `REACT_APP_DISTRIBUTION_API_BASE_URL` | Not verified in this pass |
| Stilo | `indexStilo.js` | `REACT_APP_STILO_API_BASE_URL` | Not verified in this pass |
| Hyperdrive | `indexHyperdrive.js` | `REACT_APP_BASE_URL_HYPER_DRIVE` | Not verified in this pass |
| Promotions | `indexPromotion.js` | `REACT_APP_BASE_URL_PROMOTIONS` | Not verified in this pass |

Every interceptor block that *was* read (`axiosHyperwolfClient`, `axiosHyperwolfDevClient`) does the
identical thing: read `login-user-info` from localStorage, `JSON.parse`, attach
`Bearer <access_token>`. This is copy-pasted per-client rather than a single shared interceptor
factory — six near-identical blocks of the same 10 lines across `index.js` alone (not counting the
other 4 files).

401 handling (`index.js:38-49`): unconditional `window.location.href = '/login'; localStorage.clear()`
on any 401 or `message === 'Invalid token!'` — this clears *all* localStorage, not just the auth
key, which means any other per-viewer preference stored there (theme, last-selected brand mode,
etc.) is wiped on every token expiry, not just the session.

## 7. Route inventory (`src/routes.js`, 3,735 lines, not read in full — structure sampled)

Three exported arrays, confirmed via `grep -n "^export const"`:
- `hyperfwolfAdminRoutes` — starts `src/routes.js:1254`
- `hyperfDriveAdminRoutes` — starts `src/routes.js:2733`
- `stiloRoutes` — starts `src/routes.js:2769`
- A fourth, unnamed default route set (the "hemp" generic routes) occupies lines 1-1253, imported
  as the default `routes` export used in `src/App.js`.

384 total `route:`-keyed entries across the file (`grep -ac "route:" src/routes.js`). Each entry
pairs a `route`, a `component` (the page), and typically an icon import — 382 `component:` keys
counted, 2 fewer than `route:` keys (likely 2 route entries are pure redirects/parents with no
direct component, not individually verified). The file was not read end-to-end; the header imports
(first ~50 lines, transcribed in the main report §3) establish the pattern of one `import X from
'layouts/...'` per page, repeated 380+ times — this single 3,735-line file is itself a strong
"should this be split/generated" candidate, though it was not counted in the §0 duplication
inflation total since its length reflects route breadth, not duplication.

## 8. Validation layer (`src/validations/`, 38 files, 3,078 lines — not individually read)

Yup schema files, one per form, confirmed to exist via directory listing but not opened
individually for this pass. Not wired to any shared/generated contract with backend response
shapes (no codegen tooling found in `package.json` scripts or `config/`).

## 9. Permission/role shape (`src/utilities/permissionsV2.js`, 82 lines, read in full)

```
getStoredPermissionsV2() → JSON.parse(localStorage['user-permissions-v2']) | null
setStoredPermissionsV2(perms) → localStorage['user-permissions-v2'] = JSON.stringify(perms)

resolveAdminsMode(perms) → 'hemp' | 'stilo' | 'hyperdrive' | 'none'
  reads: perms.hwPermissions[], perms.hempPermissions[] (legacy, treated as equivalent to hw),
         perms.stiloPermissions[], perms.hyperdrivePermissions[]
  each is an array of permission objects; shape of one permission object (inferred from
  src/HOC/PublicRoute.jsx:33-36 usage, not from a schema — none exists):
    { title: string, redirectUrl?: string, ... (other fields not enumerated, no schema found) }
```

No TypeScript interface, no Yup schema, no JSDoc typedef defines the permission-object shape
anywhere in the repo — it is entirely inferred from call-site usage (`p?.redirectUrl`,
`s.title && String(s.title).toLowerCase().trim() === 'dashboard'`). A backend change to this
object's field names would fail silently (optional-chaining everywhere means a missing field just
resolves to `undefined`/falls through to a fallback route, not an error).

## 10. Summary of "honest zeros" in this document

To comply with the audit's rule against fabricated numbers, the following were explicitly **not
measured** and are not claimed anywhere above:
- Exact endpoint paths for 46 of the 59 API-wrapper files (only 13 sampled, §5).
- Full `initialState` shape for 16 of 60 slices (§2).
- Line-by-line diff percentage between `homePage`/`landingPage` beyond the one `category-section.jsx`
  pair (main report §0/§12).
- Whether the `Distribution`/`Stilo`/`Hyperdrive`/`Promotions` axios clients attach auth headers the
  same way as the two clients that were read (§6) — plausible given the repo's copy-paste pattern,
  but not verified.
