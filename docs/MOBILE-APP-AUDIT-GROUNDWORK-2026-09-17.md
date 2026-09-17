# Mobile App Audit — Groundwork (no app source available) — 2026-09-17

READ-ONLY. Nothing in `/Users/jt/hyper-tech` (twelve repos, all read-only) was modified. No `.env`
or credential file was opened (variable *names* only, where cited). No production API, database,
or authenticated app-store surface was touched. No git write commands were run. No binaries were
downloaded. This is the only file created for this task.

**The app SOURCE (iOS/Android client code) is not in any of the twelve hyper-tech repos.** Every
finding below is either (a) a public App Store / Google Play listing, (b) inferred from the
*backend* APIs the apps must call, or (c) already-published prior-audit findings, cited rather
than rediscovered.

**Methodology note (for the record):** the three backend route-trace sub-tasks for this audit were
originally dispatched as background agents; their final reports did not arrive via the normal
completion channel and were instead relayed as files written to a scratch directory by an
intermediary. Per this estate's "verify before repeating a claim" rule, that content was not
taken on trust — 10 of its file:line citations (spanning all three sub-reports) were independently
re-read against the real, read-only repos before anything below was written from them. All 10
matched exactly. The content is used with confidence; the delivery anomaly itself is noted here so
it isn't silently absorbed as normal.

---

## 1. Public app store findings

**One confirmed live app, on one store. No customer-facing native app found on either store.**

| | Android (Google Play) | iOS (App Store) |
|---|---|---|
| App | **HyperDrive For Drivers** | Not found in a public listing search |
| Package/bundle ID | `com.hyperwolf.hyperdrive` | `com.hyperdrive.hyperwolf` (note: reversed word order vs. Android) |
| Developer account | Hyper Technologies Inc., 18421 Collier Ave, Lake Elsinore, CA 92530 | Apple Developer Team ID `WKJ7ST229V` (from AASA config, §1.1 below) — no discoverable storefront listing |
| Version / last update | Not retrievable this session (see limitation below); a cached search snippet says "last updated April 20, 2026" — **UNVERIFIED, not independently re-fetched** | Unknown — no listing found |
| Rating / review count | Not retrievable this session | N/A |
| Data safety declaration | Search-snippet text: "No data is shared with third parties, and data is encrypted in transit" — **UNVERIFIED**, could not load the full Data Safety section | N/A |
| Screenshots / feature copy | Search-snippet description: real-time tracking/navigation (Google Maps or Here We Go), text/call with customer or dispatch, barcode scan, ID verification, signature collection, photo proof of delivery | N/A |

**Limitation, stated plainly:** `WebFetch` against the Google Play listing page
(`play.google.com/store/apps/details?id=com.hyperwolf.hyperdrive`) failed repeatedly this session
— the page returned only a truncation placeholder every attempt (client-side-rendered page, likely
too large/dynamic for the fetch-and-summarize tool). The Browser pane could not be used either — it
was already at its tab cap with other sessions' tabs open, and closing another session's tab was
avoided per this estate's shared-checkout norms. What's reported above is the best obtainable
from `WebSearch` result snippets and the public, unauthenticated **iTunes Search API**
(`itunes.apple.com/search`), not a full listing fetch. **Getting real version/rating/data-safety
detail requires either a live browser session with a free tab, or someone with Play
Console/App Store Connect access pulling it directly.**

**No customer-facing app found on either store**, searched under "Hyperwolf", "Hyperwolf cannabis
delivery", "Hyperdrive delivery", and the developer name/address. This is *expected*, not a gap:
Google Play's developer policy explicitly prohibits apps that "facilitate the sale of marijuana or
marijuana products regardless of legality" (confirmed via WebSearch) — a customer-ordering app
could not be published there regardless of whether one was built. No matching iOS listing was
found either. This is independently consistent with two things found in the backend research
below: (a) `hyperwolf-frontend-nextjs` (the Next.js storefront) has **no** `.well-known/`
directory at all — no `apple-app-site-association`, no `assetlinks.json`, no app-store badges, no
app-version references anywhere in that repo — and (b) the prior codebase audit's own synthesis
docs found no mobile-client repo evidence across all twelve repos. **The customer experience is
the web storefront; there is no evidence of a native customer app existing today.**

### 1.1 Deep-link config found (new finding, not in the prior audit)

`/Users/jt/hyper-tech/hyperdrive-backend/public/.well-known/assetlinks.json` exists — but its
**contents are the Apple `apple-app-site-association` schema** (`applinks`/`webcredentials`/
`appclips` keys), not the Android Asset Links schema (`relation`/`target.package_name`/
`sha256_cert_fingerprints`) its filename implies. Verbatim structure read from the file:

- `appIDs: ["WKJ7ST229V.com.hyperdrive.hyperwolf", "WKJ7ST229V.com.hyperdrive.hyperwolf"]` (listed twice, identical — likely copy-paste, not two apps)
- Universal-link paths: `/buy/*` (included), `/help/*` with a 4-character `articleNumber` query param (included), `/help/website/*` and a `no_universal_links` fragment (both explicitly excluded)
- `webcredentials.apps` and `appclips.apps` both list the same App ID — **App Clips are configured**, meaning a lightweight, no-install iOS entry point was built or planned at some point
- No matching file exists in `hyperwolf-frontend-nextjs`, `hyperwolf-backend`, or any of the nine other repos (confirmed by the nine-repo scan, §2.3)

**This file is almost certainly non-functional as shipped**: Apple's Universal Links require the
file to be named exactly `apple-app-site-association` (no extension) at `/.well-known/`; serving
AASA-shaped JSON from a file literally named `assetlinks.json` means iOS will not find it at the
path it actually checks. Whether a correctly-named file exists on the real production domain
(outside this repo checkout) is **unverified** — this repo only shows what's in source control.

---

## 2. Endpoint inventory

Two backends carry the entire mobile-app-facing surface: **`hyperwolf-backend`** (customer app —
though see §3.1, there is no confirmed customer *app*, only this API, which a customer app would
call if one exists) and **`hyperdrive-backend`** (driver app, confirmed live per §1). All nine
other repos were checked and show **no** direct mobile-app-facing surface (§2.3).

All routes below are prefixed `/api/v1` on both backends. Money unit is flagged "UNVERIFIED" where
the schema doesn't document cents vs. dollars — this is a real, repeated gap, not an oversight in
this audit.

### 2.1 Customer app surface (`hyperwolf-backend`)

| Method | Path | File:line | Auth | Fields (PII / money) | Confidence |
|---|---|---|---|---|---|
| POST | `/partner/user/login`, `/partner/user/register` | `routes/blaze/user-auth-routes.js:6,10` | none | proxies straight to Blaze POS; no local JWT minted | READ |
| POST | `/partner/user/phoneLogin` | `routes/blaze/user-auth-routes.js:11` | none | PII: phone, `dob` (age computed server-side from Blaze data) | READ |
| GET | `/partner/user/find` | `routes/blaze/user-auth-routes.js:7` | none | phone-number lookup | READ |
| POST | `/user/createMobileUser` | `routes/auth-routes.js:25` → `models/User.js:4-10` | none | push-token registration: `name, email, phone, deviceType(ANDROID/IOS), deviceToken` — PII: name/email/phone | READ (spot-checked: schema confirmed verbatim) |
| POST | `/user/admin/login` | `routes/auth-routes.js:17` | none (issues JWT on success) | admin only, not customer | READ |
| GET/POST | `/fhl/get/otp`, `/fhl/validate/otp` | `routes/fhl/fhl-routes.js:11-15` | none | tied to a payment/loyalty flag (`fhlOtp` on `BlazeUser`), **not** login/signup auth | READ |
| POST | `/berbix/createToken` | `routes/berbix/berbix-route.js:6` | none | spot-checked verbatim | READ |
| POST | `/berbix/verifyBerbix` | `routes/berbix/berbix-route.js:7` | `multer.single('file')` only, no auth | uploads ID photo; PII: government ID image + selfie | READ (spot-checked: route + missing-auth confirmed verbatim) |
| — | `routes/persona/*`, `routes/didit/*` | — | none at route layer | second/third ID-verification vendors coexisting with Berbix; UNVERIFIED which one a current app build actually calls | READ |
| POST | `/cart/create`, `/cart/update/:cuid` | `routes/cart-routes.js:8-9` | shared static token (`middlewares/auth.js`, §3.1) | cart contents live in untyped `Order.cartData` (no typed money field) | READ |
| — | `/partner/store/cart/*` (slots, wolfpack, active, prepare, history, checkExpress, checkValidOrder, cancelCart, submitCart, updateCart) | `routes/blaze/user-cart-routes.js:18-29` | mixed — most unauthenticated | this is the real checkout path | READ |
| POST | `/orders/` (create), `/orders/complete/order` | `routes/order-routes.js:8,14` | **none** | order placement — money: UNVERIFIED unit | READ |
| GET | `/orders/track/eta`, `/orders/active/count` | `routes/order-routes.js:15,12` | none | order tracking | READ |
| GET | `/partner/products/asap`, `/nearby`, `/shop`; `/product/:productId` | `routes/blaze/products-routes.js:10,11,18` | none (public) | menu/catalog by region | READ |
| GET | `/check/address/availability` | `routes/blaze/products-routes.js:26` | none | **no Address model/CRUD exists anywhere in this repo** — addresses live entirely in Blaze, proxied (INFERRED) | READ (negative finding) |
| GET | `/partner/loyalty/promotions`, `/partner/loyalty/rewards` | `routes/blaze/other-blaze-routes.js:12-13` | none | Alpine IQ is the real loyalty vendor; no first-party referral route found | READ |
| — | `/canpay/*` (authorize, login, create/authid, status, cancelACHOrders) | `routes/canpay-routes.js` | none | ACH payment; `Order.canpay_amount: Number`, unit UNVERIFIED | READ |
| POST | `/stronghold/create/link` | `routes/stronghold-routes.js:5` | none | payment link creation | READ |

**Push send path**: `common/sendPushNotifications.js` reads `FleetDevices.fcmToken` (driver app
only). Grep for any consumer of the customer `User.deviceToken` field written by
`/user/createMobileUser` found **zero** call sites — **the customer push-token field appears to be
dead**, nothing ever sends to it. Flag for the dev team to confirm rather than assume.

**Device/version gating**: none found anywhere in this repo. No `x-app-version`, no `platform`
header check, no `x-device-id`, no force-update/minimum-version logic. `staticDB/apiVersion.json`
is only the API's own cosmetic version string.

### 2.2 Driver app surface (`hyperdrive-backend`)

| Method | Path | File:line | Auth | Fields (PII / money) | Confidence |
|---|---|---|---|---|---|
| POST | `/fleet/login` | `routes/fleets/fleet-routes.js:16` → `fleet-controller.js:31` | none (public, pre-auth) | PII: driver name/email/phone | READ |
| POST | `/fleet/forgotPassword`, `/fleet/reset/password` | `fleet-routes.js:18,28` | none | reset token has **no expiry check**, and its own Joi validator is defined but never wired to the route | READ (cross-confirmed against prior audit's own hyperdrive-backend report) |
| — | JWT issuance | `models/FleetAccessTokens.js:21` | `jwt.sign({fleetId, fleetEmail}, JWT_FLEET_PRIVATE_KEY, {expiresIn:"2d"})` | 2-day expiry, no refresh-token endpoint — `loginViaAccessToken` re-issues from an existing valid token, not a distinct refresh flow | READ (spot-checked verbatim) |
| — | Verify middleware | `middlewares/mobileAuth.js:1-37` | Bearer token → `fleetAccessTokens` row `isActive` check → `jwt.verify` → `fleet.fleetStatus == 'active'` | fails closed on every branch | READ |
| PUT | `/fleet/verifyPassword` | `fleet-routes.js:19` → `fleet-controller.js:377-390` | mobileAuth | re-checks driver password; **not called by the cash-closeout path** — no PIN/biometric/manager gate exists before cash submit (grepped, zero hits) | READ |
| POST | `/fleet/updateDutyStatus` | `fleet-routes.js:21` → `fleet-controller.js:398-417` | mobileAuth | REST duty-status ping, writes `Fleets.lastLocationData.{lat,long}` | READ |
| — | MQTT/AWS IoT Core stream | `awsEvent/iotCore.js:32-37,84-87` | device cert, not JWT | continuous(-implied) location stream, writes a **different** field, `Fleets.locationData.{lat,long}` — runs as its own PM2 process, not inside the Express app that a code reviewer would read | READ |
| GET | `/task/today`, `/task/schedule`, `/task/orderHistory`, `/task/taskHistory`, `/task/detail` | `routes/tasks/task-routes.js:1-22` | mobileAuth | task list/detail | READ |
| POST | `/task/scanItemProducts` | same file | mobileAuth | barcode scan at handoff | READ |
| PUT | `/task/updateStatus` | `task-controller.js:766` | mobileAuth | `taskStatus` enum: `in_progress/completed/cancelled/unassigned/not_started` — **no discrete en-route/arrived state**; on `completed`, server requires `attachments.customerSignatureUrl`, `attachments.photoUrl`, `attachments.addNotes` | READ |
| PUT | `/fleet/multiUploads` | `fleet-routes.js:27` | mobileAuth + `multer.array('images')` | proof-of-delivery photos/signature, S3-backed | READ (ACL spot-checked verbatim, §3.2) |
| POST | `/closeout/submit`; GET | `/closeout/get` | `routes/closeOut/*` | mobileAuth | cash collection: `totalCash` computed from `TasksModel.total` (Cash) / `splitPayment.cashAmt` (Split) — **no unit annotation, UNVERIFIED cents vs. dollars** | READ |
| — | FCM registration | `fleet-controller.js:33-68,338-366` (side effect of login, not a dedicated route) | — | `fcmToken`, `deviceType` (`android`/`ios`), `appVersion` captured and upserted into `FleetDevices` — **stored but never used for any force-update/min-version gate** | READ |

### 2.3 The other nine repos — no direct mobile-app-facing surface

Checked (all `.well-known` absent in every one, confirmed by direct `find`):

| Repo | Finding |
|---|---|
| hemp-backend | Real FCM push (`common/fcmNotifications.js`, `android_channel_id: "hyperwolf-firebase"`) — targets **retailer/store/admin staff devices**, spot-checked verbatim; not a customer/driver app |
| hemp-frontend-nextjs | Shares the Berbix + FHL OTP vendor calls hemp-backend exposes — browser storefront, no app-wrapper signal |
| hemp-retailer-admin | Web push only (Firebase `getToken`/VAPID + service worker), explicitly documented as browser push in its own README |
| stilo-backend | Same shape as hemp-backend; separate Firebase service-account file, same shared "hyperwolf-firebase" project inferred |
| stilo-frontend-nextjs | Zero mobile signal |
| promotion-backend / promotion-engine | `POST /promotion/validate` exists but is called **server-to-server by hemp-backend**, not by any app directly |
| distribution-backend | A `deviceToken` field exists on `Admin.js` but **no push SDK anywhere in the repo** — dead schema boilerplate. CORS allowlist includes `hyperdrive.hyperwolf.com` (spot-checked verbatim) — a one-directional browser-CORS entry, not a backend-to-backend call; no import/HTTP call linking this repo to hyperdrive-backend or hyperwolf-backend was found |
| hyperwolf-super-admin | Web push only; a `'react-native': 'react-native-web'` webpack alias is CRA boilerplate, not a native app signal |

Flutter/SwiftLint/Android-lint steps appear in several repos' CI YAML but are a shared,
conditionally-gated template (`if has_flutter == 'true'`) — none of these nine repos contain a
single `.dart`, `.swift`, or Android project file. Not evidence of an app.

---

## 3. Auth model + security findings

### 3.1 The auth model, as it actually is

**There is no per-customer identity check anywhere in the customer-facing surface.**
`middlewares/auth.js` (hyperwolf-backend) — spot-checked verbatim — is 17 lines comparing
`x-auth-token` header **or `?token=` query string** against one static, shared
`process.env.PUBLIC_TOKEN`. It is not a session, not a JWT, has no expiry, no per-caller identity,
and (because it also accepts a query string) leaks into server access logs, browser history, and
`Referer` headers by design. `POST /orders/` and `/orders/complete/order` — order placement — have
**zero** authentication of any kind, not even the shared token. Customer identity for Blaze proxy
calls travels as plain fields (email/phone) in the request body, trusted as-is.

This matches, independently, what the prior codebase audit already found at the estate level
(`ARCHITECTURE-MAP.md` §2, cited by an earlier pass of this same research): hemp and stilo run the
identical pattern — "one static shared key... the only gate... per-user identity is a
client-supplied `memberId`/`consumerId`." **This is not a hyperwolf-backend-specific bug; it is
the estate's standing customer-auth model.**

The only real JWT issuance in either mobile-facing backend is for **staff-tier** identities:
admin (`JWT_ADMIN_PRIVATE_KEY`, 2-day expiry, `models/Admin.js:17`) and driver/fleet
(`JWT_FLEET_PRIVATE_KEY`, 2-day expiry, `models/FleetAccessTokens.js:21`, spot-checked verbatim).
Both are HS256 (unspecified algorithm defaults to it), neither carries `iss`/`aud`, neither has a
revocation path beyond flipping `fleetAccessTokens.isActive`, and neither has a refresh-token
endpoint — expiry means a forced re-login, not a silent refresh. Token storage on the client
(Keychain/Keystore vs. plain storage) is **unverifiable from these repos** — that's client-side
code this audit doesn't have.

**OTP abuse limits**: none. `express-rate-limit` is a declared dependency in **both**
hyperwolf-backend and hyperdrive-backend's neighboring `package.json` but is never `require()`'d
anywhere in either codebase (grepped, zero hits in both) — confirmed independently by two separate
sub-reports reading two separate repos, and consistent with the prior audit's own finding
(`hyperwolf-backend` §14/§18/§19, cited above in this session's own reading of that file). Login,
OTP (`/fhl/get/otp`, `/fhl/validate/otp`), and password-reset endpoints on both backends are
**unthrottled**.

**Social login**: none found. `firebase-admin` is used exclusively for push messaging in both
backends; no `verifyIdToken`/`FacebookStrategy`/`AppleStrategy` code exists anywhere.

### 3.2 Security findings — new to this pass (not already in the prior audit)

These are additive to, not a repeat of, the prior `codebase-audit` findings cited in §3.3.

1. **[BLOCK] Public, unauthenticated access to merged ID-verification photos.** `hyperwolf-backend`
   serves `app.use(express.static('uploads'))` globally, mounted before any auth check
   (`startup/middleware.js:57`, spot-checked verbatim). Berbix ID-photo + selfie composites are
   written to `uploads/{timestamp}{random 0-4999}-combibned.jpeg` (`controllers/berbix/
   berbix-controller.js:155,181`) — a small, guessable filename space, served with zero auth.
   Anyone who can predict or enumerate a filename can fetch another customer's government ID photo.
2. **[BLOCK] Driver proof-of-delivery photos and signatures are on a public-read S3 bucket.**
   `middlewares/multiFileUploadToS3.js:22` sets `acl: 'public-read'` (spot-checked verbatim) with
   no signed-URL gate. Filenames are `image-<timestamp+random>.ext` — not cryptographically
   unguessable. This includes `customerSignatureUrl`, which is PII tied to a specific delivery
   address and time.
3. **[WARN] The customer push-token field (`User.deviceToken`) appears to be dead code** — written
   at signup, never read by any send path (`common/sendPushNotifications.js` only reads
   `FleetDevices.fcmToken`). If customer push notifications are believed to work today, they very
   likely don't; needs a runtime check, not a code-only conclusion.
4. **[WARN] No PIN/biometric/manager-approval gate on driver cash closeout.** The one candidate
   (`PUT /fleet/verifyPassword`) exists but nothing in `closeOut-controller.js` calls or requires it
   before `/closeout/submit`. Any such gate today would have to be client-side only, which this
   audit cannot see or trust.
5. **[WARN] Driver reset-password token has no expiry check**, and the field validator that exists
   for it is never wired to the route (`fleet-routes.js:28`).
6. **[INFO] Two independent, disagreeing location-write paths** for the same driver: a low-frequency
   REST duty-status ping (`Fleets.lastLocationData`) and a separate, continuous-implied MQTT/IoT
   Core stream (`Fleets.locationData`) running as its own PM2 process that a reviewer of the main
   Express app would never see. A future engineer who assumes `iotCore.js` is dead code and removes
   it would silently kill live GPS tracking with no error from the API process.
7. **[INFO] Money units are undocumented almost everywhere PII/money coexist**: cart/order totals
   (`Order.cartData`, untyped `Object`), CanPay amount (`Order.canpay_amount: Number`), and driver
   cash closeout (`TasksModel.total`, `splitPayment.cashAmt`) all lack a cents-vs-dollars annotation
   in schema. This is a real cross-cutting risk for a payments-and-cash-handling surface, not a
   cosmetic gap.

### 3.3 Findings already reported by the prior audit — cited, not rediscovered

Per this estate's rule ("anything the prior audit already reported: cite it rather than
rediscover it"), the following were read directly from
`/Users/jt/POS-Admin/docs/codebase-audit/repos/{hyperwolf-backend,hyperdrive-backend}.md` and
`ARCHITECTURE-MAP.md` this session, and independently spot-checked line-for-line in §above:

- **Admin passwords stored/compared in plaintext**, `controllers/auth-controllers.js:97`
  (`hyperwolf-backend.md` §14 Critical-1; spot-checked verbatim, §3.1 above).
- **Driver passwords are base64-encoded, not hashed** — `bcrypt` is imported but never called on
  the compare path (`hyperdrive-backend.md`, driver sub-report §1; not yet in the prior audit's own
  written findings for this repo — new to this pass, flagged separately in §3.2 is unnecessary
  since it's the same class of finding as the admin one already known; noted here for completeness).
- **`GET /api/v1/fleet/recommend` — unauthenticated, leaks a driver's full document** (name, email,
  phone, hashed/encoded password, live lat/long) to anyone supplying `?latitude=&longitude=`
  (`hyperdrive-backend.md` §6, "Most significant finding").
- **`PUT /api/v1/admin/tasks/reassignTask/:taskId` — zero auth**, reassigns any active delivery's
  driver (`hyperdrive-backend.md` §6 and §14 Critical; also TEAM-TODO.md item 1.4).
- **`POST /api/v1/admin/tasks/create` bypassable via a client-controlled `platformType === "web"`
  field** that disables auth entirely (`hyperdrive-backend.md` §6; TEAM-TODO.md item 1.4).
- **One shared symmetric JWT secret (`JWT_ADMIN_PRIVATE_KEY`)** signs four different identity types
  across hemp/stilo/hyperwolf/distribution with the same claims shape — a token minted for one
  Store user validates on every admin middleware in the estate (`ARCHITECTURE-MAP.md` §2).
  hyperdrive's `JWT_FLEET_PRIVATE_KEY` is separate.
- **No refresh, no revocation, no issuer/audience on any JWT in the estate**; frontends store
  tokens in `localStorage` or unsigned cookies (`ARCHITECTURE-MAP.md` §3, "Auth / sessions" row).
- **ID verification is four vendor integrations (Berbix/Persona/Didit/AgeChecker) copied into three
  backends with a self-asserted `isVerified` flag** — no real Verify service in production yet
  (`THE-GRADE.md` §5).
- **Firebase Admin SDK initialized from a committed/gitignored local JSON key file** rather than an
  env var, inconsistent with every other integration's convention, in both hyperwolf-backend and
  hyperdrive-backend (`hyperwolf-backend.md` §8 row "Firebase"; `hyperdrive-backend.md` §3).
- **README vs. code contradiction**: hyperwolf-backend's README claims CORS is allow-listed and
  provider webhooks (FHL) are signature-verified; neither is true as read — bare `cors()` with no
  options, and no HMAC/signature code anywhere in the FHL controller (`hyperwolf-backend.md` §8a).

---

## 4. Mapping to the new backend (`/Users/jt/wm-demo`)

wm-demo's live route surface was re-derived from source (`wmdemo/route_policy.py`,
`policy_batch{1-5}.py`, module registration), not from any stale doc, per this estate's "code wins"
rule. Auth there is **not** JWT — three principal kinds (`session`, `key` via `x-api-key`, `link`
via signed single-use tokens), checked in `route_policy.enforce()`.

### 4.1 Feature matrix (selected — matches `ADMIN-GAP-LIST-2026-09-17.md`'s format)

| Capability | Legacy route(s) | OUR status (wm-demo) | Gap size |
|---|---|---|---|
| ID verification / KYC | Berbix/Persona/Didit, 3 backends, self-asserted flag | **`/api/identity/*`** (verify, merge, wm-binding, review/bind, review/resolve, members, match, search, verification) — this is the real successor per prior audit's own note ("Verify replaces Didit/Persona/Berbix/AgeChecker in hyperwolf-backend first") | MAPPED — module exists, cutover not yet done |
| Loyalty / rewards | Alpine IQ proxy (`/partner/loyalty/*`) | **`/api/engage/*`** (points earn/redeem/adjust, programs/tiers/rewards, customers, consent) | MAPPED |
| Order lifecycle (ops side) | `/orders/*` (create/complete/track/eta) | **`/api/order/stage`, `/api/order/release-hold`, `/api/order/lines`, `/api/orders/held`** | PARTIAL — wm-demo's order module is fulfillment/ops-shaped (staging, holds), not a customer checkout endpoint |
| Driver profile | `Fleets` model | **`/api/driver`, `/api/driver/delete`** | MAPPED (profile CRUD only) |
| Driver duty/shift | `updateDutyStatus`, on-duty checklists | **`/api/shift`** | PARTIAL — needs confirmation it covers duty-status toggling, not just scheduling |
| Cash handling | `/closeout/submit`, `/closeout/get` | **`/api/register/*`** (open/close sessions) | PARTIAL — register is a store-register model, not a per-driver cash closeout; **no driver-side cash closeout route found in wm-demo** |
| Delivery task lifecycle | `/task/updateStatus`, `/task/today`, `/task/schedule` | **`/api/fulfillment/*`** (drain/requeue/backfill/board/queue/status-map) | PARTIAL — conceptually adjacent (queue/status), but no per-task driver-facing status-update endpoint confirmed in the route list |
| Live location / GPS ping | REST duty-status ping + separate MQTT/IoT Core stream | **none found** | **GAP** |
| Proof of delivery (photo/signature) | `PUT /fleet/multiUploads` | **none found** | **GAP** |
| Push notifications (task/dispatch) | FCM (`sendPushNotifications.js`) | **none found as a route**; owner's AWS decision (§5) replaces this with WebSockets — see below | **GAP, superseded by a decided architecture change** |
| Cart / checkout (customer) | `/cart/*`, `/partner/store/cart/*` | **none found** — no `/api/cart`, `/api/checkout` in the enumerated route list | **GAP** |
| Address CRUD (customer) | none in legacy either (proxied to Blaze) | **none found** | GAP on both sides — not a regression |
| Menu/catalog by region | `/partner/products/asap`, `/nearby`, `/shop` | **`/api/product*`, `/api/region-menu`, `/api/menu-mode`** | MAPPED |
| Tax | flat 3-constant math in POS-Admin's own `pos/data.jsx` (see `ADMIN-GAP-LIST-2026-09-17.md`) | **`/api/tax/rates`, `/api/tax/audit*`, `/api/tax/quote`** | MAPPED — module exists; whether it's wired into a customer checkout path is unconfirmed |
| Push-token registration (customer or driver) | `User.deviceToken` (dead) / `FleetDevices.fcmToken` (live) | **none found** | GAP, and see §5 — the target architecture is WebSockets, not FCM, for the driver side |

### 4.2 Named gaps, in depth (format matches `ADMIN-GAP-LIST-2026-09-17.md` §B)

#### Driver live-location ping
- Vendor: two disagreeing paths — REST `updateDutyStatus` writing `Fleets.lastLocationData`, and a
  separate always-on MQTT/AWS IoT Core process writing `Fleets.locationData` (`hyperdrive-backend`,
  §2.2/§3.2 item 6 above).
- Ours: no location-ingest route found in wm-demo's registered route families.
- Gap: total — this is a new module, not a port. Compounded by the owner's decision (§5) to reject
  off-duty pings server-side and retain only 90 days of trail, which the legacy schema has no field
  for at all (no `isOnDuty`-gated write check found anywhere in `hyperdrive-backend`).
- Smallest build: a `driver_location_pings` table (Aurora Postgres per §5) with a server-side
  `duty_status` check *before* insert (reject, don't just filter on read), a TTL/retention job for
  the 90-day window, and a WebSocket broadcast to the dispatcher map on write — belongs in a new
  wmdemo module, sibling to the existing driver/shift modules.

#### Proof of delivery
- Vendor: `PUT /fleet/multiUploads`, S3-backed, **and currently public-read** (§3.2 item 2 — do not
  port the ACL as-is).
- Ours: no upload/proof-of-delivery route found.
- Gap: total.
- Smallest build: signed-URL S3 (or equivalent) upload endpoint gated behind the driver's session,
  tied to a task/order ID; this is the one place where porting the *shape* (photo + signature +
  notes on task completion) is right but the *security model* must not be copied.

#### Cash closeout (driver-side)
- Vendor: `/closeout/submit`/`/closeout/get`, no documented money unit, no PIN/biometric gate
  (§3.2 item 4).
- Ours: `/api/register/*` exists for store-register open/close (per `ADMIN-GAP-LIST-2026-09-17.md`
  §B "Drawers" — that module is itself still client-side-only/localStorage as of that document) but
  nothing for a *driver's* cash-on-hand across a route.
- Gap: real, and adjacent to (not the same as) the already-tracked register/drawer gap.
- Smallest build: extend the planned `register_sessions` table's pattern (per
  `ADMIN-GAP-LIST-2026-09-17.md` item #1) with a driver-scoped variant, with the money unit
  explicitly declared (cents) from day one — this legacy system never declared it and that
  ambiguity should not be inherited.

---

## 5. New architecture decisions and what they mean for the driver app

The owner decided today (2026-09-17) that the platform moves to **AWS: Aurora PostgreSQL + Valkey,
WebSockets for driver task push and the dispatcher map, off-duty location pings refused
server-side, and 90-day trail retention.** Concretely, against everything found above:

- **WebSockets replace FCM for task push.** Today's driver app gets task updates via Firebase Cloud
  Messaging (`common/sendPushNotifications.js`, credential-file-based, §3.3). A WebSocket channel
  means the driver app needs a persistent-connection story (reconnect/backoff, auth handshake per
  connection, and a decision on what happens to in-flight task state if the socket drops mid-route)
  that a push-notification model never had to solve. This is a real client-side redesign, not just
  a backend swap — flag for whoever builds the driver client.
- **Off-duty pings refused server-side is a new control, not present today.** Today, nothing found
  in `hyperdrive-backend` checks duty status before accepting a location write — the REST ping and
  the MQTT stream both write unconditionally. The new backend must add this as a genuine
  server-side gate (reject the write), not a client-side toggle the app merely honors.
- **90-day trail retention needs an explicit purge job.** No such job or field exists today (no
  location record in the current schema has any documented retention field at all). This estate's
  own standing orders on destructive steps (wipe-then-repopulate patterns, checkpointed long jobs)
  apply directly here once this is built as a scheduled AWS job.
- **Aurora Postgres + Valkey vs. today's MongoDB/DynamoDB.** The location data model (§2.2, two
  disagreeing fields) and the untyped money fields (§3.2 item 7) are exactly the kind of schema
  drift a relational rewrite should *fix*, not carry forward — this is the moment to add typed
  columns with explicit units, not preserve the ambiguity.
- **Metrc manifest-before-departure gate.** The owner also decided delivery manifests must reach
  Metrc before a vehicle departs. Today's `taskStatus` enum (`in_progress/completed/cancelled/
  unassigned/not_started`, §2.2) has **no pre-departure state at all** — a driver can be marked
  `in_progress` with no gate checking anything happened first. This is a new required precondition
  on whatever status transition means "left for the route," and it needs a hard-fail UX in the
  driver app (a blocked "start route" action, not a warning) since a vehicle leaving without a
  Metrc-accepted manifest is a compliance violation, not just a data-quality issue. This should be
  designed alongside the WebSocket task-push rework above, since both touch the same "task
  transitions to en-route" moment.

---

## 6. Mobile security review checklist (to run once source/builds exist)

- **Secure token storage** — confirm the driver JWT (2-day expiry, no refresh) is in Keychain
  (iOS) / Keystore (Android), not `AsyncStorage`/`SharedPreferences`/plaintext. Unverifiable from
  the backend alone.
- **Certificate pinning** — given the backend has no TLS-config-of-its-own findings either way,
  confirm whether the app pins its own backend's cert; also confirm the AWS IoT Core MQTT
  connection's client cert handling once the client is available (today's cert files are
  deployed out-of-band, not in git — `awsEvent/iotCore.js` config, §2.2).
- **Jailbreak/root posture** — no server-side signal for this exists today (nothing in either
  backend inspects device attestation); confirm client-side handling, if any.
- **Deep-link validation** — the AASA file found (§1.1) is misnamed and likely non-functional as
  shipped; if Universal Links matter, this needs fixing regardless of anything else. Validate that
  `/buy/*` and `/help/*` handlers in the app actually check the incoming URL rather than trusting
  it blindly.
- **Screenshot/PII in logs** — `console.log`-based error handling is the estate-wide pattern on the
  backend (§3.3, cron catch blocks); ask whether the mobile clients log request/response bodies
  containing ID images, signatures, or cash amounts to device logs or a crash reporter.
- **ID-scan image handling** — today's backend stores merged ID+selfie composites on a
  **public-read path** (§3.2 item 1). Client-side, confirm the image is not cached to a
  world-readable app sandbox location or left in a temp/camera-roll directory after upload.
- **Biometric gate for driver cash** — none exists server-side today (§3.2 item 4); if the app
  claims to have one, it's unverified from here and should be demonstrated, not assumed.
- **Minimum OS support** — unknown; no build config found in these repos.
- **Third-party SDK inventory** — from the backend side, the app must talk to: Firebase (push,
  moving to WebSockets per §5), AWS IoT Core (MQTT location), Google Maps/HERE (per README,
  navigation), Berbix/Persona/Didit (one of, ID verification), CanPay/Stronghold (payments). Ask
  the dev team to confirm which of these ship an actual client SDK in the app vs. server-only.

---

## 7. Design/UX audit plan (once source/builds/testers exist)

**Flows to walk, both platforms:**
1. Driver: login → duty-on → accept/view task list → navigate → arrive → scan/photo/signature →
   mark complete → (new, per §5) manifest-check gate before next route leg → end-of-shift closeout.
2. Any customer surface that turns out to exist: signup/OTP → ID verification → browse menu by
   region → cart → checkout/payment → order tracking → loyalty/rewards.

**Accessibility**: standard mobile a11y pass (dynamic type, VoiceOver/TalkBack labels on the
scan/signature/photo capture screens especially — these are the highest-stakes screens for a
driver working one-handed at a doorstep).

**Offline/poor-network behavior for drivers**: this is the single highest-value UX question given
the architecture change in §5 — a WebSocket-based task push needs an explicit offline story
(queued status updates, a manifest-check retry path that doesn't strand a driver who has a manifest
but no signal) that the current FCM-based push never had to have, since FCM has its own delivery
retry built in and WebSockets do not.

---

## 8. What we need from the owner/dev team

1. **The app repos.** Nothing in the twelve hyper-tech repos names them; the only clue is
   `hyperdrive-backend`'s README calling itself "consumed by a mobile driver app" without naming
   the client repo, plus the bundle/package IDs found in §1. Framework (React Native/Flutter/
   native) is unconfirmed from any backend.
2. **TestFlight + Play internal-testing access**, or equivalent build artifacts, since no store
   listing gave us a full description/screenshots/data-safety detail for the driver app, and no
   customer app was found at all — we need to confirm whether one exists outside public search
   (e.g., unlisted, or distributed some other way).
3. **A test account per role** (customer, if one exists; driver) once source/builds are available.
4. **Push/analytics vendor console read access**: Firebase project (the one behind
   `hyperwolf-firebase-adminsdk-imjc9`, shared across hemp/stilo per §2.3), and confirmation of
   whether AWS IoT Core device certs are managed anywhere with a UI (today they're file-deployed,
   out-of-band, not in git).
5. **Confirmation of the real, production-hosted deep-link files** — this audit can only see what's
   in git; whether a correctly-named `apple-app-site-association` exists on the live domain (as
   opposed to the misnamed one in source, §1.1) is unknown from here.
6. **Clarity on which ID-verification vendor (Berbix, Persona, or Didit) the current app build
   actually calls** — all three exist in parallel in the backend with no way to tell from source
   which one is live.

---

## Gaps / not completed this session (acknowledged, not silently dropped)

- Google Play listing's full description, install count, version, and Data Safety section were
  **not** independently retrieved — `WebFetch` failed repeatedly and the Browser pane was at its
  tab cap from other concurrent sessions. Only search-snippet-derived text is reported, flagged as
  such throughout §1.
- No iOS App Store listing was found for either app under any search term tried; this is reported
  as a negative finding, not confirmed as "no listing exists anywhere" — a Team-ID/App-ID lookup
  via App Store Connect (which this audit has no access to) would be the authoritative check.
- Only 10 of the sub-reports' many file:line citations were independently re-verified against
  source (spot-check, not exhaustive); the rest are used at the sub-reports' own stated confidence
  level (READ vs. INFERRED vs. UNVERIFIED, preserved above).
- wm-demo's `/api/idv/*` `/v2`/`/v3` Verify prefixes, and the `/api/lp`, `/api/timesheet`,
  `/api/writeups` module route lists, were confirmed to exist but not individually enumerated
  (out of scope for this pass — see the underlying research notes' own budget acknowledgment).
- `promotion-backend`/`promotion-engine`'s and `distribution-backend`'s *other* Region model copies
  (3 more exist per the earlier admin-gap census) were not re-opened here; not directly relevant to
  mobile-app routing, noted for completeness.
