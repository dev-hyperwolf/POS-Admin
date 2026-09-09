# stilo-frontend-nextjs — data model @ 23f5e62

Frontend-only repo: there is no backend schema/ORM here (`models: 0` from the metrics pass is
correct). Everything below is **inferred from destructuring in the code** — how the UI consumes
API responses and what Redux carries client-side. Nothing here is validated against a backend
schema (that lives in other repos); treat field names/optionality as "what this frontend assumes
exists," not as ground truth about the actual API contract.

## Redux store shape (`redux/reducer.js:10-17`)

```
store = {
  auth:      { isNotFound, rememberedUser, authUser, loading?, error? },
  common:    { deliveryType, loading?, signupStatus? },
  cart:      { memberCart },
  alpine:    {},   // dead — see note below
  addresses: {},   // dead — see note below
  strain:    {},   // dead — see note below
}
```

- `alpine` / `addresses` / `strain` slices (`redux/alpineSlice/slice.js`,
  `redux/addressSlice/slice.js`, `redux/strainSlice/slice.js`) each declare an `initialState`
  (`{ memberCart: {} }` for alpine — a copy-paste leftover from cartSlice; `{ value: 0 }` for
  address) but have **empty `extraReducers`** and are never read via `useSelector` anywhere in the
  app (verified: `grep -rn "state\.alpine\|state\.addresses\|state\.strain"` = 0 hits). Their
  `thunk.js` files are real and dispatched, but results are consumed directly from the resolved
  promise (via `handleApiRequest`), never routed through these slices.

### `auth` slice (`redux/authSlice/slice.js`)

`state.auth.authUser` — the canonical "current user" shape, built by `getUserData()`
(`redux/authSlice/slice.js:10-37`) and re-derived inline at `loginMember.fulfilled`
(`:61-88`) and `registerMember.fulfilled` (`:121-131`). Field list (all optional/nullable in
practice — accessed everywhere with `?.`):

| Field | Notes |
|---|---|
| `_id` | Mongo-style id |
| `memberId` | separate string id, used as the actual API key for member-scoped calls |
| `email`, `firstName`, `lastName`, `fullName` | |
| `licenseNumber` | cannabis ID/medical license |
| `idImage` | S3 URL to uploaded ID photo |
| `gender` | derived from `existingMember?.gender` |
| `memberType` | sourced from `existingMember?.memberTypemember` — **note the `member` suffix**; this looks like a flattening artifact from a nested API shape (`member.memberType` got flattened to `memberTypemember` somewhere), same pattern repeats for `verifyMethod`, `status`, `isVerified`, `retailerId`, `averageSpent`, `profileImage`, `deliveryAddress` (all read from `xxxmember` keys) — worth confirming with the backend team whether this is intentional or a bug that happens to work because those fields are usually `undefined` |
| `verifyMethod` | e.g. `"persona"` |
| `status`, `isVerified` | booleans |
| `retailerId` | |
| `averageSpent` | Number, dollars presumably |
| `profileImage` | |
| `deliveryAddress` | single object, see Address shape below |
| `age` | Number |
| `dob` | epoch millis (see `lib/helpers.js:236-249` `getDOB`) |
| `phone` | string, formatted via `lib/helpers.js:5-15` `formatPhone` |
| `storeId` | |
| `blockOnlinePayments` | object `{ status, blockedReason, blockedDate, blockedBy }` — full shape only visible in the dead mock at `signup.jsx:47-52`; consumed as `onlinePaymentStatus.blockedReason` in `checkout-view.jsx:867` |

Cookie mirror: `authUser` (JSON, 7-day expiry on some writes, no expiry on others — inconsistent:
`redux/authSlice/slice.js:55` sets `expires: 7`, but `:89` (login) does **not** pass an `expires`
option at all, meaning that write falls back to a session cookie while the signup-path write is
persistent — same cookie, two different lifetimes depending on which flow set it last).

`rememberedUser` — mirrors the raw login form `arg` (`redux/authSlice/slice.js:92-93`), not a
separate shape; whatever fields the login form submitted (`phone`, `password`, `rememberMe`).

### `cart` slice (`redux/cartSlice/slice.js`)

`state.cart.memberCart` — set from `getActiveCart`/`prepareCart` thunk responses
(`redux/cartSlice/thunk.js`). Shape assembled client-side from the raw API response:

```
memberCart = {
  ...rawApiResponse,               // spread first, so any of the fields below can be overridden by API-declared same-named fields... but code always re-derives `items` after the spread
  items: [ { quantity, productId } ],   // re-derived from rawApiResponse.cartData[].product.productId
}
```

Known fields referenced on `cartDetails` (the prop name `checkout-view.jsx` uses for this same
object) beyond `items`:

| Field | Notes |
|---|---|
| `cartData` | raw array of cart line items from the API — each item has `.quantity` and `.product.productId` at minimum (`redux/cartSlice/thunk.js:41-45,66-69`) |
| `deliveryType` | `"Pick-up"` \| `"Delivery"` — string literal, not an enum type (`checkout-view.jsx:391,397,406,413,429,436,445,477,490,554,612`) |
| `deliveryAddress` | Address shape (below) |
| `splitPayment` | `{ credit?, ... }` — `credit` key explicitly stripped before submit (`redux/cartSlice/thunk.js:26-28`) |
| `paymentOption` | `"Cash"` \| `"Split"` \| (others implied by `!== "Split"` check) — default `"Cash"` |
| `walletAmount` | Number |
| `walletPointsUsed` | Number, compared against `subTotal` to decide payment-option display (`checkout-view.jsx:1214`) |
| `subTotal`, `total` | Number, dollars, rendered via `toFixed()` (`checkout-view.jsx:1130,1214`) |
| `sessionId` | guest cart identifier, mirrored into a cookie (`redux/cartSlice/slice.js:26-28`) |
| `promoCode` | string |
| `afterTaxDiscount` | Number |
| `rewardTemplates` | array, shape not observed beyond being reset to `[]` |
| `regionId`, `inventoryId` | **hardcoded literals** `"HcrzXJ159dcDw77pFvnm"` / `"odkEgmqfW3MDJJedc3QJ"` appear as request fields in **two** places: `redux/Providers.js:42-43` and `services/handleActiveCart.js:37-38` (`resetCartData`) — same two magic strings, independently hardcoded twice rather than imported from one constant. |

Request shape sent to `cart/prepare` (`redux/cartSlice/thunk.js:14-36`): spreads the caller's
`data`, then overlays `splitPayment`, `paymentOption` (default `"Cash"`), `storeId` (from cookie
if not passed), `deliveryType` (default `"Pick-up"`), `walletAmount` (default `0`), and
conditionally `memberId` (only if `authUser.memberId` truthy — so guest carts omit it entirely
rather than sending `null`).

### `common` slice

`deliveryType` (initial `"pickup"` — **note the casing mismatch**: cart's `deliveryType` values
are `"Pick-up"`/`"Delivery"` with a capital letter and a hyphen, while `common`'s initial value is
lowercase `"pickup"` with no hyphen — these two `deliveryType` fields in two different slices use
different string literal conventions for what reads as the same concept), `signupStatus` (shape:
`{ personaStatus, diditStatus }`, consumed at `signup.jsx:148`), `loading`.

## Product shape (destructured in `app/(main)/shop/components/productDetails.jsx:67-89`)

```
product = {
  productId, productSlug, productName, productDescription, productDisclaimer,
  brandName, brandSlug,
  category: {},         // object, sub-fields not fully enumerated in this file
  mainCategory: {},
  customWeight,
  ingredients, ingredientStatus,
  instructions, instructionStatus,
  productImages: [],    // array, first element used as default selected image
  strainType,
  sku,
  salePrice,             // Number, dollars — may be falsy/undefined when not on sale
  unitPrice,             // Number, dollars — the non-sale price
  totalQuantity,
  thcData,
  inventories: [ { quantity } ],   // used by lib/helpers.js:213-217 isProductAvailable — inventories[0].quantity > 0
}
```

Traits are a separate object passed alongside: `{ mainTraits, genetics }`
(`productDetails.jsx:92`).

Discount math (`lib/utils.js` — wait, actually `lib/helpers.js:124-130` `getDiscount`):
`((unitPrice - salePrice) * (100 / unitPrice)).toFixed(0)` — percentage off, rounded to whole
number, returned as a **string** (`"NN% OFF"`) or `""` if no sale. No currency-formatting
library used anywhere (no `Intl.NumberFormat`) — all money display is raw `` `$${toFixed(n)}` ``
string interpolation (`lib/helpers.js:71-75` `toFixed` helper wraps `Number(num)?.toFixed(places)`
with a fallback to `Number(0)?.toFixed(places)` when `num` is falsy/NaN).

## Address shape

Used consistently across cart, checkout, member profile, and middleware
(`lib/constants.js:1-10` `defaultAddress` is the canonical field list):

```
Address = {
  address,      // full formatted string, e.g. "3428 Long Beach Blvd, Long Beach, CA 90807, United States"
  apartment,    // free text, sometimes reused to hold a street number (see lib/helpers.js:146-149 getLocation)
  city,
  state,
  country,      // "US" (ISO-ish, not enforced)
  zipcode,      // string, 5-digit format enforced only in validations/commonSchemas.js:44-47 (yup .matches(/^\d{5}$/))
  lat, long,    // Numbers — note "long" not "lng" (Google's own API returns "lng"; this repo
                // renames it to "long" at the point of consumption, e.g. lib/helpers.js:181,
                // server/actions.js is unaffected but app/(main)/order/[orderId]/page.jsx:56-60
                // destructures `long` off objects that came from the backend, meaning the
                // backend's own order/store shape apparently also uses "long" — consistent, but
                // worth flagging since it diverges from Google's "lng" the moment any Places API
                // response is stored without renaming)
  primary,      // boolean, on `deliveryAddresses[]` entries (authSlice mock at signup.jsx:96-105)
  _id,          // present on saved addresses in a list, absent on ad hoc/session addresses
}
```

`idAddress` is a parallel, separately-tracked address on the member record (ID-verification
address vs delivery address) — same field shape, distinct purpose (`signup.jsx:106-112`).

## Order shape (`app/(main)/order/[orderId]/page.jsx`, from `order/${orderId}` response)

```
orderDetails = {
  orderId,
  deliveryType,          // "Delivery" | other (branches to storeDetails.address instead of deliveryAddress)
  deliveryAddress: { lat, long, ... },   // Address shape, when deliveryType === "Delivery"
  storeDetails: { address: { lat, long, ... } },  // used for pickup orders
  orderStatus,            // "placed" | "cancelled" | "completed" | "return" (page.jsx:27-32 orderStatusLottie map)
}
```

Not fully enumerated — this file focuses on map/status rendering; line-item/pricing sub-fields for
orders were not observed in the portion of the file read during this pass.

## Signup/registration request & response shapes

Request built from Formik `initialValues` (`signup.jsx:122-135`):
`{ dob, email, firstName, lastName, password, phone, sex, deliveryAddress: {}, verifyMethod: "site", gender, memberType: "AdultUse" }`.

`registerMember` response: `{ existingMember, shouldNotLogin? }` — `existingMember` is the same
shape as `auth.authUser` above (`redux/authSlice/slice.js:122-131`).

Persona verification response (`getPersonaInquiryData` / `onPersonaFlowCompleted`,
`signup.jsx:229-245`): `{ firstName, lastName, dob, email, sex, address, city, state, zip, filePath }`
— **note `zip` here, not `zipcode`** as used everywhere else in this codebase (Address shape
above uses `zipcode`); `signup.jsx:245` manually renames it (`zipcode: zip`) at the point of
consumption, meaning this is a known, already-handled inconsistency rather than a live bug — but
it does confirm the Persona API and the internal Address shape disagree on this field name.

Didit verification response (`redux/authSlice/thunk.js:149-159` `retrieveSessionUrl`): raw
response plus a manual remap `{ ...response, gender: response.sex, zipcode: response.zip }` —
same `sex`→`gender` and `zip`→`zipcode` renames as Persona, done independently in a second place
rather than through one shared normalizer function. This is the same underlying data-shape
mismatch handled twice, once per vendor, in two different files.

## Validation schemas (`validations/`) — the closest thing to a formal "model" in this repo

- `authSchema.js`: `signupSchema`, `guestSignUpSchema`, `guestCheckoutSchema`, `loginSchema`,
  `resetPasswordSchema`, `passwordUpdateSchema`, `updateProfileSchema` — all Yup object schemas,
  client-side only.
- `commonSchemas.js`: `emailSchema`, `phoneSchema` (uses the `phone` npm package, US-only:
  `phone(value, { country: "US" })` — hardcoded to US, no support for other countries even though
  nothing else in the schema enforces a US-only address), `addressSchema` (fields: `apartment`
  (optional), `address` (required, custom `.validateAddress()` that requires
  `isAddressSelected` to be true on the parent object — i.e. a raw typed address without picking a
  Google Places suggestion fails validation), `isAddressSelected` (boolean), `city`, `state`
  (both `min(2)`, no allowlist against `lib/usStates.js`), `zipcode` (`/^\d{5}$/`, US 5-digit only,
  no ZIP+4 support).
- `contactUsSchema.js`: not read in detail this pass — contact form fields only.

## Money — explicit type audit

Every money value observed in this repo (`unitPrice`, `salePrice`, `subTotal`, `total`,
`walletAmount`, `averageSpent`) is a **plain JavaScript `Number`, denominated in whole dollars
(not cents)**. There is no shared money type, no `Decimal`/`BigNumber` library in the dependency
tree, and formatting is inconsistent (see main report §5 and §11) — some render sites call
`toFixed(2)`, at least one (`productDetails.jsx:435`) does not. Since all totals are computed
server-side and only *displayed* here, the float-precision risk is contained to display
formatting, not to any calculation this repo performs — but the inconsistent `toFixed` usage means
the same underlying value can visibly render differently in different parts of the UI.
