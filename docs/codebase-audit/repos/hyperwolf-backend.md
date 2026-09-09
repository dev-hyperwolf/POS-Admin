# hyperwolf-backend — Codebase Audit

Repo: `/Users/jt/hyper-tech/hyperwolf-backend` pinned at `cd74550` (HEAD already matched this SHA;
working tree clean at audit time — read directly, nothing was checked out or modified). A single
squashed "Initial commit" — there is no prior history to mine for intent. Mechanical metrics:
`/Users/jt/POS-Admin/docs/codebase-audit/metrics/hyperwolf-backend.md` (+ `.json`). Every metrics
number cited below was independently re-verified against source; corrections are called out where
the mechanical scan under- or over-counted. Full field-by-field schema reference:
`hyperwolf-backend.datamodel.md` (companion file, same directory).

## 1. Purpose

Per `package.json` (`name: "hyperwolf-blaze-middleware"`) and confirmed by the route tree, this is
the integration middleware between Hyperwolf's (and, via shared code, Hemp's and Stilo's)
storefront/mobile clients and the **Blaze** POS/e-commerce platform. It:
- Syncs products, brands, categories, inventory, and promotions from Blaze into its own MongoDB
  (`controllers/blaze/integration/blaze-integration-controllers.js`, cron-driven — see §7).
- Serves the customer-facing catalog, cart, checkout, and order-tracking API consumed by a
  Next.js storefront (`hyperwolf-frontend-nextjs`, per the sibling repos in this estate) and a
  driver/fleet app ("Hyperdrive").
- Serves an admin CMS surface (banners, blog, brand/distributor pages, product carousels, shop
  hours/holidays, legal pages) — `routes/admin/*`.
- Brokers a long list of third-party integrations for payments, identity verification, delivery,
  loyalty, and marketing (§8).
- Manages Hyperdrive fleet/driver operations (fleets, tasks, breaks, on-duty checklists, approval
  notifications) — this looks like a second product bolted onto the same Express app and Mongo
  connections, not a cleanly separated service.

## 2. Runtime & framework

- **Node:** `engines.node: "12.x"` (package.json) — Node 12 reached EOL April 2022; over 4 years
  unsupported at time of audit. No `.nvmrc`, no Dockerfile — nothing else pins the runtime, so the
  actual production Node version depends entirely on whatever is installed on the deploy host.
- **Framework:** Express `^4.17.1` (current major is 5.x; 4.x still maintained but should be
  budgeted for migration).
- **DB / ORM:** MongoDB via Mongoose `^5.11.15` — Mongoose 5 is EOL (Mongoose 8.x is current);
  5.x does not support modern MongoDB driver versions or Node 18+ cleanly.
- **Language:** Plain JavaScript, no TypeScript anywhere in the tree.
- **Pinning:** No lockfile (`package-lock.json` is `.gitignore`'d, `.gitignore:8`) — 46 of 48
  dependencies pinned with caret (`^`), 2 exact. Combined with no lockfile, **every fresh
  `npm install` can pull different minor/patch versions of 46 packages** — this repo has no
  reproducible install.
- **Known-vulnerable/EOL majors in active use:** `axios ^0.21.1` (0.21.x has multiple published
  CVEs — SSRF/redirect handling; 1.x is current), `jsonwebtoken ^8.5.1` (pre-9, in the CVE-2022-23529
  family affected-version range depending on exact patch), `mongoose ^5.x` (EOL). New Relic and
  Sentry SDKs are reasonably current (`newrelic ^9`, `@sentry/node ^6.19` — Sentry 6 is several
  majors behind the current 8.x line but functional).
- **Declared but never imported (verified, not just grepped):** `bcrypt`, `express-rate-limit`,
  `fcm-node`, `msg91`, `nodemailer`, `nodemon` (dev-only, fine), `pug` (configured as the view
  engine in `startup/middleware.js:61` but **no `res.render` call exists anywhere in the repo** —
  `views/index.pug` is dead weight), `remove`, `twilio`. Two of these are not cosmetic: see §14
  Critical-1 (`bcrypt`) and §7 (`express-rate-limit`, declared but not wired to any route despite
  login/OTP endpoints existing).
- **Duplicate scheduling libraries:** both `node-cron` and `node-schedule` are used to schedule
  jobs in `startup/nodeCrons.js` (one job uses `node-schedule`, the rest use `node-cron`) — no
  functional reason found; consolidating to one library removes a dependency.

## 3. Entry points & boot

`index.js` is the process entry point. Boot sequence, awaited in an IIFE:
1. `dotenv.config()`, `require('newrelic')` (index.js:8-9).
2. `startup/config.js` — a synchronous chain of `if/else if` that throws if any of 10 required
   env vars (`DATABASE_URL`, `BLAZE_BASE_URL`, `PUBLIC_TOKEN`, `ONFLEET_BASE_URL`, `FHL_BASE_URL`,
   `FHL_REDIRECT_URL`, `BLAZE_RETAIL_BASE_URL`, `BLAZE_RETAIL_AUTH_EMAIL`,
   `BLAZE_RETAIL_AUTH_PASSWORD`, `ALPINE_BASE_URL`, `SENTRY_DSN`) is missing — but this list checks
   only 10 of the **133** env vars actually referenced in the codebase (metrics), so a missing
   `HEMP_DATABASE_URL`/`STILO_DATABASE_URL`/`JWT_ADMIN_PRIVATE_KEY`/etc. is not caught here and
   instead fails later, deeper in the stack, with a less obvious error.
3. `startup/middleware.js(app)` — security headers, Sentry init, static file serving, body
   parsing (200 MB limit — see §15), CORS (see §14 Critical-2), `partnerAuth` mounted globally at
   `/` (see §14 Critical-3), Sentry request/error handlers.
4. `await startup/db.js()` — opens **three separate Mongoose connections**
   (`mongoose.createConnection`, not the default `mongoose.connect`) and stores them on
   `global.dbConnections = { conn1, conn2, conn3 }` — a global mutable object that every one of
   the 59 model files reads synchronously at `require()` time (`global.dbConnections.connN.model(...)`).
   This is a hard ordering dependency: if any route file is required (directly or transitively)
   before `db.js` finishes, `global.dbConnections` is `undefined` and the process crashes with a
   generic `Cannot read properties of undefined (reading 'model')` that gives no hint which model
   file caused it. One model (`MainStrain`) instead null-guards and exports `null` — worse, because
   it defers the crash from boot time to first-request time (see datamodel.md §top).
5. `startup/routes.js(app)` — mounts ~57 routers under `/api/v1/*` (§6).
6. `startup/nodeCrons.js()` — only if `IS_DEVELOPMENT` is falsy (§7).
7. `global.messages = require('./locales/en')` — a second piece of global mutable state (English
   response strings), loaded after routes are already mounted; a request arriving in the brief
   window between `app.listen` and this line touching `global.messages` would throw.
8. `app.listen(3030, ...)` — port is a hardcoded literal (`index.js:3`), not env-configurable.

Startup side effects: Sentry.init and New Relic agent init happen twice — once at the top of
`index.js` (`require('newrelic')`, line 9) and once again at the top of `startup/middleware.js`
(`require('newrelic')`, line 1, with the comment "must be the first line" — it no longer is, since
`index.js` already required it first).

## 4. Directory map

| Dir | Files | Size | Role |
|---|---|---|---|
| `controllers/` | 59 | 1.0 MB | Business logic, one file per domain; several files exceed 1,500 lines (§11) |
| `routes/` | 58 | 248 KB | Express routers, one per domain, mounted in `startup/routes.js` |
| `models/` | 59 | 256 KB | Mongoose schemas (full detail in `.datamodel.md`) |
| `middlewares/` | 12 | 48 KB | Auth (`admin.js`, `auth.js`, `partnerAuth.js`), uploads, caching, validators |
| `common/` | 8 | 104 KB | Shared HTTP client (`utils.js`, 1,739 lines), email templates, push notifications |
| `startup/` | 5 | 28 KB | Boot wiring (§3) |
| `staticDB/` | 14 | 388 KB | Static JSON reference data (API version file, region/city lists, etc.) |
| `assets/` | 49 | 684 KB | Static images served directly by Express (`express.static`) |
| `views/` | 3 | 2.1 MB | One unused `.pug` template + a "please wait" gif (§2) |
| `emailTemplates/` | 3 | 48 KB | HTML email bodies |
| `uploads/` | 8 | 100 KB | Local disk upload target (multer) — see §15 for the operability implication of local disk storage on a PM2/single-host deploy |
| `locales/` | 1 | 4 KB | English response-message strings (`en.js`), loaded as `global.messages` |
| `awsEvent/` | 2 | 4 KB | AWS IoT Core device-messaging glue |
| `test/` | 1 | 4 KB | One standalone `assert`-based script, not wired to any test runner (§9) |
| `config/` | 1 (empty) | 0 B | Empty except `.gitkeep`; gitignored otherwise |

## 5. Data model summary

**60 collections across 59 model files** (`Miscellaneous.js` registers two models, one per
connection) spanning **three separate MongoDB databases** reached via `global.dbConnections.conn1
/conn2/conn3` (Hyperwolf / Hemp / Stilo DBs respectively — `startup/db.js:13-15`). This is the
single most consequential architectural fact about this repo's data layer: a model's physical
database is chosen per-file, hardcoded, with no central registry, and two placements look like
bugs rather than intent — see `.datamodel.md` §3 for the full analysis:
- `models/Legal.js` lives on **conn2 (Hemp DB)** despite carrying a
  `platformAvailability.hyperwolf` field implying it should be queryable as Hyperwolf content, and
  despite `stilo-backend` maintaining its own separate 166-line near-identical `Legal.js` copy
  (`CROSS-REPO-DUPLICATES.md:12`) rather than sharing this one.
- `models/StoreProducts.js` lives on **conn3 (Stilo DB)** only, despite a brand-agnostic-looking
  `storeId` field.

**10 most central models** (by role, not alphabetically): `Order` (checkout/fulfillment record —
27 fields, but cart contents and money live in an untyped `cartData`/`metadata`/`everFlow` Object,
not typed schema fields), `Product` (conn1, catalog — 6 indexes into dotted paths of an untyped
`productData` Object), `HempProducts` (conn2, a parallel/duplicate catalog shape for Hemp — see
`.datamodel.md` §4), `Fleets` (driver/courier accounts, 19 fields, one dead index — see below),
`Tasks`/`TaskModel` (delivery task queue, 30 fields, uses `mongoose-sequence` for a human-readable
`taskDisplayId`), `Admin` (6 fields — **passwords stored and compared in plaintext**, §14
Critical-1), `Category`/`WebCategory`/`Brand`/`Cannabinoid`/`Strain` (catalog taxonomy, largely
free-text duplicated across products rather than foreign-keyed — §12), `Promotion` (8 fields, all
promotion logic in an untyped `promotionData` Object), `ApprovalNotifications` /
`HyperDriveNotification` (fleet-ops messaging), `StartTask`/`OnDutyChecklists`/`Break` (fleet
shift/compliance tracking).

**Money:** no dedicated typed money field exists anywhere with a documented unit. The handful of
typed money fields that do exist (`HempProducts.productPrice/unitPrice/salePrice/purchasePrice`,
`Products.totalPrice`, `Tasks.totalDiscount/totalTax/creditCardFee`) are all plain `Number` with no
comment indicating cents vs. dollars. The majority of money — cart totals, order totals, promotion
pricing rules, payment intents — is not a schema field at all; it lives inside untyped
`Object`/`Mixed` fields (`Order.cartData`, `Order.everFlow`, `Product.productData`,
`Promotion.promotionData`), meaning Mongoose enforces **zero** validation on it.

**Timestamps:** only 1 of 59 models (`Announcements`) uses Mongoose's built-in `timestamps`
option. Every other model manually maintains `createdDate`/`updatedDate`, inconsistently typed as
`Number` (epoch millis, the majority), `Date` (a large minority), or plain `String`
(`ErrorLog`, `FhlScript`, `LedgerGreen` — dates stored as formatted strings, e.g. `"DD-MM-YYYY"`,
making range queries on these collections impossible without parsing every document client-side).

**Soft delete:** present on only 2 of 59 models (`Fleets`: `isDeleted`/`deletedBy`;
`FailureReason`: `isActive`/`deletedAt`/`deletedBy`). The other 57 have no soft-delete field —
"delete" endpoints on those models are hard deletes (verified for `Banners`, `Brand`, `Distributor`
— see §6, §12).

**Multi-tenancy key:** none, structurally. Brand scoping is done ad hoc per model: sometimes a
`platformAvailability: {hyperwolf,hemp,stilo,all}` boolean map (`Legal`, `MainProductTraits`,
`SubProductTraits`), sometimes a `platformType` string enum (`ProductCarousel`), sometimes not at
all (most models assume "the brand this DB connection belongs to" rather than storing a tenant
key). There is no single field or convention a new developer could grep for.

**Indexes vs. queries:** `Fleets.js:71` defines `fleetSchema.index({ regionId: 1 })`, but the
schema has no top-level `regionId` field — the real field is the nested `regionData.regionId`
(`Fleets.js:40-42`). The index silently indexes a field that is always `undefined` on every
document; any query planner expectation of region-scoped Fleet lookups being indexed is false.
Full index inventory is in `.datamodel.md` §1.

Full field-by-field schema, the complete `ref` relation graph, and every in-repo schema-shape bug
found (duplicate object keys that silently shadow each other, a Joi-validator-used-as-a-Mongoose-
type-definition bug in `Strain.js:20`, a dangling `ref: "Author"` that can never resolve) are in
`hyperwolf-backend.datamodel.md`.

## 6. API surface

**Mounting:** `startup/routes.js` requires all ~57 routers up front and mounts them under
`/api/v1/*` prefixes in one large `module.exports` function (lines 63-125) ending in a catch-all
404 handler. There is no versioning beyond the `v1` prefix baked into every path — no `/v2`
exists, no header/negotiation-based versioning.

**Auth mechanism, traced (not taken from the metrics regex):**
- `middlewares/admin.js` — real JWT bearer verification (`jwt.verify(token,
  process.env.JWT_ADMIN_PRIVATE_KEY)`, `admin.js:13`), used for admin-console routes. Token
  expiry is set at issuance in `models/Admin.js:17` (`expiresIn: "2d"`), algorithm is whatever
  `jsonwebtoken`'s default is (HS256) since none is specified.
- `middlewares/auth.js` — **not per-user auth**: a single static shared secret
  (`process.env.PUBLIC_TOKEN`) compared against `req.header('x-auth-token')` **or**
  `req.query.token` (`auth.js:5-13`). Accepting the token as a query string means it lands in
  server access logs, browser history, and `Referer` headers — a standard token-leakage vector.
  Because it's one shared value for an entire tier of callers, a single leak (any of those logs)
  compromises every caller behind that tier, with no per-caller revocation possible.
- `middlewares/isSuperAdmin.js` — role check via `req.user.isSuperAdmin` boolean (set from the
  JWT payload at login, `models/Admin.js:16-19`) — this is the only role representation in the
  codebase; there is no roles/permissions table or string-enum role field for non-admin actors.
- `middlewares/partnerAuth.js` — **mounted globally at `app.use('/', partnerAuth)`
  (`startup/middleware.js:63`), applied to every single request before any route matches, and it
  performs zero authentication of the caller.** Its logic (`partnerAuth.js:6`):
  `if (!req.headers["Authorization"] || req.headers["authorization"]) req.headers.Authorization =
  authorization`. Node/Express normalizes all incoming header names to lowercase, so
  `req.headers["Authorization"]` (capital A) is **always** `undefined`, making the left side of
  the `||` always true regardless of what the caller sent — this middleware unconditionally
  overwrites `req.headers.Authorization` with the server's own `process.env.AUTH_TOKEN` on every
  request and never calls anything but `next()`. It exists to inject a fixed downstream-partner
  credential for outbound calls, not to gate inbound ones — but its name and mount point make it
  look like a security control to anyone skimming `startup/middleware.js`.
- **`req.isAdmin`/`addAdminReq` pattern** (`routes/admin/product-routes.js:12-15`) — a route-local
  middleware that unconditionally sets `req.isAdmin = true` and calls `next()`, with no check of
  anything. It is chained *after* `[admin]` on some routes (line 22, 25) — harmless there since
  `admin` already ran — but the naming invites a future developer to reach for `addAdminReq` alone
  on a new route and get a flag that means nothing.

**Routes reachable with NO authentication (verified by tracing mount points in
`startup/routes.js` against each router file's own middleware imports — not just counting
"handler with no inline middleware array," which is what the metrics script did):**

Of 57 route files, **33 import neither `middlewares/admin` nor `middlewares/auth` nor
`middlewares/isSuperAdmin`**, and none of their corresponding `app.use(...)` mount lines in
`startup/routes.js` add auth either (`partnerAuth` doesn't count — see above). The highest-impact
confirmed-open ones:

| Mount | Router file | Exposure |
|---|---|---|
| `/api/v1/admin/banners` | `routes/admin/banner-routes.js` | create/update/delete site banners |
| `/api/v1/admin/brand` | `routes/admin/brand-routes.js` | create/update/delete brand pages |
| `/api/v1/admin/distributor` | `routes/admin/distributor-routes.js` | create/update/delete distributor records |
| `/api/v1/admin/blogs` | `routes/admin/hyperwolf-blog-routes.js` | create/update blog posts |
| `/api/v1/admin/shop/time` | `routes/admin/shop-time-routes.js` | create/update/delete store hours, holiday closures, "break room banner" graphics |
| `/api/v1/product/carousel` | `routes/admin/product-carousel-routes.js` | create/update/delete homepage product carousels, **and** `findByIdAndUpdate(id, {...req.body})` with no field whitelist (mass assignment, `product-carousel-controllers.js:812-820`) |
| `/api/v1/timeslots` | `routes/admin/time-slot-routes.js` | create/update/delete delivery time slots |
| `/api/v1/admin/products` → `POST /`, `PUT /:productId` | `routes/admin/product-routes.js:17-18` | admin `createProduct`/`updateProduct` have **no** `[admin]` middleware, unlike every other route in the same file (contrast lines 19-29, which all carry `[admin]`) |
| `/api/v1/canpay` → `POST /update/status` | `routes/canpay-routes.js` → `controllers/canpay-controllers.js:94` | toggles a site-wide feature flag (`canpaystatus`) enabling/disabling the CanPay payment method for everyone |
| `/api/v1/canpay` → `POST /update/order/status` | `routes/canpay-routes.js` → `controllers/canpay-controllers.js:118` (`cancelACHOrders`) | cancels/refunds an ACH order looked up **only** by attacker-supplied `orderId` in the body — no ownership check (IDOR), no auth |
| `/api/v1/ledgergreen` → `POST /webhook` | `controllers/ledgergreen/ledgergreen-controllers.js:34` | returns another customer's payment transaction (name, phone, amount, status) to anyone who can guess/brute-force a `creditTransactionId`+`phone` pair — no auth, no rate limit |

This list is illustrative, not exhaustive — the other 22 unauthenticated router files (weedmaps,
onfleet ETA lookup, google places proxy, kml, errors log ingestion, strain/cannabinoid CMS,
banner-timings, shop-variables, textVolt, herbpixel, optin, reviews, berbix/persona/didit identity
flows, intercom, hyperdrive, stronghold payment-link creation) were checked for auth-middleware
imports but not each individually re-audited for business impact at the depth above; treat all 33
as in-scope for a follow-up pass, ranked by write-vs-read and money-adjacency.

**Input validation:** `joi` is used, but only opportunistically — most model files export a
validator function alongside the schema (e.g. `models/Fleets.js` has 5 separate Joi schemas for
different Fleet operations), and it is up to each route to remember to apply it. Several routes
skip it entirely even when a validator exists in the same file's sibling model (e.g.
`product-carousel-controllers.js`'s update path spreads `req.body` straight into
`findByIdAndUpdate` with no Joi check at all, despite `middlewares/productCarouselvalidator.js`
existing and being applied only to `create`, not `update` field contents beyond a payload shape
check — see §14).

**Pagination:** `skip`/`limit` query params, validated ad hoc per endpoint (e.g.
`Fleets.getFleetsValidation`, `ApprovalNotifications` validator) — no consistent default page size
or max-limit enforcement found; combined with `find_without_limit` (179 mechanical hits, §15) this
means most list endpoints have no upper bound at all unless the specific route happens to apply
one of these Joi schemas.

**Error response shape:** consistently `res.status(<code>).send({ message: <string> })` across
the codebase — this part is genuinely uniform.

**Versioning:** none beyond the `/api/v1` path prefix.

## 7. Background jobs

All scheduled in `startup/nodeCrons.js`, run only when `IS_DEVELOPMENT` is falsy (`index.js:16-18`).
**Every comment describing a cron's interval is wrong** — verified by decoding each expression:

| Schedule (as written) | Comment says | Actually runs | Job |
|---|---|---|---|
| `0 */6 * * * *` | "every 3 day" | every 6 minutes | `resetActiveCart()` |
| `0 */1 * * * *` | "every 1 min" | every minute (comment right by luck) | `checkCartStatus()` |
| `0 */15 * * * *` | "every 10 minutes" | every 15 minutes | product sync from Blaze (`runUpdateAllProductCron`) |
| `0 18 * * *` (PT) | (none) | daily at 6pm Pacific | `sendFirstOrderReminderSMS()` |
| `0 0 */3 * * *` | "every 3 day" | every 3 hours | `generateBlazeRetailToken()` |
| `0 0 */30 * * *` | "every 2 day" | **only ever fires at hour 0** (`*/30` in a 0-23 hour field never reaches step 2) — effectively once/day at midnight, not the intended ~30-hour cadence | `removeFiles()` (deletes cached Google Street View images >24h old) |
| `0 */18 * * * *` | "every 2 day" | every 18 minutes | `syncRegions()` |
| `node-schedule`: `5 18 * * *` | (none) | daily at 18:05 (server-local tz, not pinned) | `syncRegionWithTerminals()` |

None of these jobs take any lock or check whether a previous invocation is still running before
starting a new one (§4.4/§4.5 pattern from this estate's own GAS standing orders — the same
failure mode applies here). The product sync job is the one most likely to overlap itself: its
implementation (`controllers/blaze/integration/blaze-integration-controllers.js:76`) does `await
Product.findOne({ productId: item.id })` **inside a `for` loop over every product returned by
Blaze** — an N+1 query pattern — and it is scheduled every 15 minutes; if the Blaze catalog grows
large enough that one pass exceeds ~15 minutes, the next cron tick starts a second sync against
the same collection concurrently, with no coordination.

Failures are caught per-job (`try/catch` wrapping each cron body) and only `console.log`'d
(`nodeCrons.js:17,25,36,44,52,59,67` — every catch block does `console.log(ex, '<label>')`, several
with copy-pasted wrong labels, e.g. the region-sync catch at line 52 logs `'update product cron
error'`). None of these call `Sentry.captureException` even though Sentry is initialized in this
same process — Sentry's Express error handler (`startup/middleware.js:65`) only catches errors
inside the request/response cycle, not inside a bare cron callback, so **every cron failure is
currently invisible outside whatever captures PM2's stdout**, with no alerting.

Two scheduling libraries are used for what is functionally one list of jobs (`node-cron` for all
but the last, `node-schedule` for the last) — no technical reason found for the split.

`updateAllProducts` is also exported and importable elsewhere as `runUpdateAllProductCron`
(`nodeCrons.js:71`) and `removeFiles` likewise (`nodeCrons.js:73`) — dead exports, nothing in the
repo imports `startup/nodeCrons` other than `index.js`'s `require('./startup/nodeCrons')()` call.

## 8. Third-party integrations & secrets

| Service | Purpose | Wrapper | Credential source |
|---|---|---|---|
| Blaze / Blaze Retail | Primary POS/catalog/order sync | `controllers/blaze/**`, `common/utils.js` | env (`BLAZE_*`, `BLAZE_RETAIL_*`) |
| Onfleet | Delivery task dispatch/ETA | `controllers/onFleet-integration/`, `routes/onfleet/` | env (`ONFLEET_*`) |
| CanPay | ACH payments | `controllers/canpay-controllers.js` | env, but the write endpoints are unauthenticated (§6) |
| Stronghold | Payment links | `controllers/stronghold-controllers.js` | env |
| LedgerGreen | Contactless payments | `controllers/ledgergreen/ledgergreen-controllers.js` | env for API keys (`LEDGERGREEN_PUBLIC_KEY`/`SECRET_KEY`), **but the webhook shared-secret is a hardcoded literal in source, not env** — `ledgergreen-controllers.js:10` (see §14 Critical-4) |
| FHL | Compliance / customer checks / OTP | `controllers/fhl/*` | env; no signature/HMAC verification code found anywhere in this controller despite the README claiming "Provider webhook verification where applicable (e.g., FHL)" (README.md, Authentication & Security section) — **contradicted by code**, see §8a below |
| Berbix, Persona, Didit | Identity verification (KYC) | `controllers/berbix/`, `controllers/persona/`, `controllers/didit/` | env |
| Alpine IQ | Loyalty | `controllers/alpine/alpine-controllers.js` | env |
| SendGrid | Email | `common/` email helpers | env |
| TextVolt | SMS | `controllers/textVolt/textVolt-controllers.js` | env; **phone numbers hardcoded as literals** at `textVolt-controllers.js:20,75,114` (§11) |
| Firebase (Admin SDK) | Push notifications | `firebaseAdmin.js` | **committed service-account JSON file**, `hyperdrive-firebase-adminsdk.json` — see §14 Critical-5 (cited, not opened/printed here per audit rules) |
| Intercom | Support messaging | `controllers/intercom/intercom-controllers.js` | env |
| Weedmaps | Marketplace listing sync | `controllers/weedmaps/weedmap-controllers.js` | env |
| Google (Places/Street View) | Address lookup, imagery | `controllers/google-controllers.js` | env for the live calls, **but a real Google Maps API key is hardcoded in a comment** at `controllers/google-controllers.js:23` (cited, value withheld) |
| AWS S3 | File/image storage | `middlewares/awsBucket.js` | env |
| AWS IoT Core | Fleet device messaging | `awsEvent/` | env |
| New Relic, Sentry | APM / error monitoring | `newrelic.js`, Sentry init in `startup/middleware.js` | env |

**§8a — README vs. code, Authentication & Security section:** the README asserts two things the
code does not support: **"CORS origin allow-list"** (in fact `startup/middleware.js` builds a
`corsOptionsDelegate` origin-whitelist function at lines 13-26 and then never passes it to `cors()`
— line 60 calls bare `cors()` with no options, which allows any origin) and **"Provider webhook
verification where applicable (e.g., FHL)"** (no `verify`/`signature`/`hmac` logic exists in
`controllers/fhl/*`, confirmed by grep and manual read). Both are corrected in §14.

**Secrets found committed to the repository** (kind and location cited; values withheld per audit
rules):
1. **Firebase service-account private key** — `hyperdrive-firebase-adminsdk.json` (repo root,
   2,393 bytes, contains a `private_key` PEM block at line 5). This file is listed in
   `.gitignore:6` — meaning someone added the gitignore rule *after* it was already committed, and
   it was never removed from history or rotated. It is loaded directly by `firebaseAdmin.js:2`.
2. **Google Maps API key**, hardcoded in a comment (not even live code) — `controllers/google-
   controllers.js:23`.
3. **LedgerGreen webhook shared-secret**, hardcoded as a literal string constant —
   `controllers/ledgergreen/ledgergreen-controllers.js:10` — used at line 138 to gate the payment
   webhook. Every other credential in this same file is correctly sourced from `process.env`
   (lines 3-4, 9); this one specifically is not.
4. `test/admin-security.test.js` contains `assigned_secret`/`email_literal` regex hits (4 each) —
   verified as **fixture/dummy data** (`'admin@example.com'`, `'password-hash'`, `'jwt'`), not real
   secrets. No action needed; noted here only because the mechanical scan flagged it and this
   audit's instructions require every flagged item to be checked.

## 9. Tests

- **1 test file, 105 lines** (`test/admin-security.test.js`), a plain Node script using the
  built-in `assert` module — no test framework (no Jest/Mocha dependency, confirmed absent from
  `package.json`).
- `package.json` has **no `test` script** — `npm test` runs npm's default (exits non-zero, does
  nothing useful). CI (`.github/workflows/*.yml`) never invokes tests at all; both workflows are
  pure SSH-deploy-on-push with no test gate (§10).
- What the one test file covers: `removeSensitiveFields` (a function that strips
  password/token/PIN fields from API responses before sending them to clients) and a small inline
  HTTP-mock check of an admin-security-related response path. It does not touch auth middleware,
  models, controllers, or any of the integration code.
- **Not covered:** everything else — no route test, no model validation test, no controller test,
  no integration test against Blaze/payments/identity providers, and (given §14) no test would
  have caught the plaintext-password comparison or the unauthenticated admin-CRUD routes, since
  nothing exercises those code paths at all.

## 10. Build & deploy

- **No Dockerfile, no containerization.** Deployment is direct SSH + `git pull` + `npm i` + `pm2
  restart`, defined entirely inside two GitHub Actions workflow files:
  - `.github/workflows/node.js.yml` — triggers on push to branch `hyperdrive-fleet`, SSHes to
    host `thcs.in` with a username/password pair from GitHub Secrets, runs `git stash && git pull
    ... && npm i && pm2 restart hyperwolf-blaze-middleware`.
  - `.github/workflows/stage.yml` — triggers on push to branch `feature-schedule-dynamic`, SSHes
    to a raw IP (`18.235.246.3`) as `root` with a private key secret, same pattern against a
    different PM2 process name (`backend`).
  - **Neither workflow runs a build, lint, or test step of any kind before deploying** — a push to
    either named branch deploys directly to that environment's live process. `git stash` before
    `git pull` on the target host means any local drift on the server (manual hotfixes, uncommitted
    config) is silently stashed and can be lost or resurface unexpectedly on a later stash pop that
    nothing in the workflow ever issues.
  - Two different production hosts/processes are addressed by branch name, with no shared
    `main`/`production` branch pattern visible in the workflows — the actual current deployment
    branch is impossible to determine from this repo snapshot alone (open question, §19).
- **Environment separation:** by env vars only (`IS_DEVELOPMENT` gates cron jobs, `.env.example`
  documents 119 of the 133 referenced vars — see gap list in §11). No staging/prod config files,
  no environment-specific `.env.*` templates beyond the one example.
- **Logging/monitoring:** Sentry (error tracking, initialized in `startup/middleware.js`) and New
  Relic (APM, `newrelic.js` + double-required as noted in §3) are both wired for the HTTP request
  path. Application-level logs otherwise go to `console.log` (137 call sites across 36 files per
  metrics) and to three Mongo collections used as ad hoc logs (`ErrorLog`, `Log`,
  `ActivityLogs`) with no rotation/retention policy visible in code.

## 11. Hardcoded values

Mechanical counts (metrics), each spot-verified:

- **ObjectId literals (49 hits, 8 files)** — mostly in `controllers/blaze/user-cart-controllers.js`
  (21) and `controllers/common-controllers.js` (12). These are hardcoded MongoDB `_id`s used as
  lookups for singleton/config-like documents — a real "should be config or a named constant"
  case, not "should be data" (they already are pointing at data; the problem is the ID is buried
  inline instead of named).
- **HTTP URLs (25 hits, 13 files)**, top offender `startup/middleware.js` (5) — this is the CORS
  origin whitelist array itself (`middleware.js:9`), which is dead code anyway (§8a); also
  scattered base URLs in `common/utils.js` and `controllers/weedmaps/weedmap-controllers.js` that
  duplicate what `.env.example` already has env vars for.
- **Role strings (22 hits, 12 files)** — free-text role/status strings compared with `===`
  scattered through `controllers/admin/category-controllers.js`, `controllers/cannabinoids/
  cannabinoids-controllers.js`, `controllers/strain/strain-controller.js`, etc. — should be
  centralized enums; currently a typo in any one of the 22 sites silently creates a new,
  unmatched status value.
- **Phone number literals (4 hits, 2 files)** — worst offender `controllers/textVolt/textVolt-
  controllers.js:20,75,114` — three hardcoded phone numbers in the SMS-sending integration
  (destination or sender numbers baked into code rather than config; kind cited, values withheld
  as they may be real numbers).
- **Email literal / assigned_secret (4 hits each, both in `test/admin-security.test.js`)** —
  confirmed fixture data, not a real finding (§8, item 4).
- **Store name literal (1 hit)** — `common/utils.js:834`, a single named store baked into shared
  utility logic that otherwise operates generically.

**Worst 10 by impact** (severity = how much blast radius a change/typo has):
1. `controllers/google-controllers.js:23` — live API key in a comment (§8, §14).
2. `controllers/ledgergreen/ledgergreen-controllers.js:10` — hardcoded webhook secret (§8, §14).
3. `startup/middleware.js:9` — dead CORS whitelist array (misleads readers into thinking CORS is
   restricted).
4. `Fleets.js:71` — index on a field name that doesn't exist (`regionId` vs. actual
   `regionData.regionId`) — a hardcoded-and-wrong index definition, not just a value.
5-7. Three hardcoded phone numbers, `textVolt-controllers.js:20,75,114`.
8. `common/utils.js:834` — a single hardcoded store name inside otherwise-generic shared logic.
9. `index.js:3` — hardcoded port `3030`, not env-configurable, forces every environment (dev,
   stage, prod, and any second instance on the same host) to use the same port unless the process
   manager remaps it externally.
10. `.env.example` gap: 14 env vars are referenced in code but **absent** from `.env.example**
   (`CLIENT_ID_FOR_GET_OTP_FHL`, `FHL_ASSOCIATE_CLIENTID`, `FHL_ASSOCIATE_SECRET_KEY`,
   `FHL_ASSOCIATE_URL`, `FHL_CHECK_CUSTOMER`, `FHL_CUSTOMER_URL`, `FHL_OTP_URL`,
   `FHL_URL_FOR_GET_OTP`, `FHL_URL_FOR_VALIDATE_OTP`, `FOOTER_COLOR`, `PROJECT_NAME`,
   `PROJECT_THEME_COLOR`, `REASSIGN_ASSOCIATE_URL`, `TOKEN_FOR_GET_OTP_FHL`) — a new developer
   setting up a local environment from `.env.example` alone will silently break every FHL flow at
   runtime with `undefined` values plugged into request URLs, since `startup/config.js` doesn't
   check for these.

## 12. Duplicated code

**Inside this repo:**
- `ShopTime` (`models/ShopTime.js`, `routes/admin/shop-time-routes.js`) vs. `TimeSlot`
  (`models/TimeSlot.js`, `routes/admin/time-slot-routes.js`) — near-identical weekly-schedule
  shape (day enum + embedded `slots[]` with open/close time strings), maintained as two entirely
  separate models, routers, and controllers.
- `BRBGraphics` vs. `HolidayManagement` (`models/BRBGraphics.js`, `models/HolidayManagement.js`)
  — the exact same embedded media sub-schema (mediaType enum, imageUrl regex validator,
  description/title/altText) copy-pasted verbatim between the two files, then wrapped in
  near-identical outer schemas.
- `MainBrand`/`MainCannabinoid`/`MainStrain` — same field shape (metaTitle, metaDescription,
  description, image, title, createdBy, createdDate, canonical + one name field), hand-copied
  three times with independently drifted bugs (see `.datamodel.md` §4).
- `Product` (conn1) vs. `HempProducts` (conn2) — two different shapes for "a catalog product,"
  full detail in `.datamodel.md` §4.

**Against sibling repos** (from `CROSS-REPO-DUPLICATES.md`, each pair re-confirmed to include
`hyperwolf-backend` on at least one side):
- **hyperwolf-backend ↔ stilo-backend: 629 duplicated lines** (the largest cross-repo pair
  involving this repo) — includes `models/Legal.js` (166 lines, byte-similar), `models/
  MainProductTraits.js` (77 lines), `models/Authors.js` (45 lines), `models/MainCannabinoid.js`
  (39 lines), `common/commonSendMail.js` (30 lines), `controllers/intercom/intercom-controllers.js`
  (0.99 similarity), `models/SubProductTraits.js` (0.98), `models/Cannabinoid.js` (0.98),
  `controllers/blaze/shop-variables-controller.js` (0.94), `controllers/textVolt/textVolt-
  controllers.js` (0.87), `controllers/admin/banner-controllers.js` (0.83).
- **hemp-backend ↔ hyperwolf-backend: 305 duplicated lines** — `controllers/cannabinoids/
  cannabinoids-banner-controllers.js` (148 lines), `common/emailTemplates.js` (53 lines),
  `routes/cannabinoids/cannabinoid-routes.js` (37 lines), `common/sensitiveResponse.js` (33
  lines), `controllers/intercom/intercom-controllers.js` (0.99), `models/Authors.js` (0.98),
  `models/SubProductTraits.js` (0.98), `models/HempProducts.js` (0.96 — the in-repo duplicate
  above is itself a third copy of a shape that already exists twice across repos),
  `models/Cannabinoid.js` (0.97), `controllers/blaze/shop-variables-controller.js` (0.94),
  `controllers/weedmaps/weedmap-controllers.js` (0.92), `startup/middleware.js` (0.75 — meaning
  the same dead-CORS-whitelist bug from §8a likely exists in hemp-backend too; worth checking in
  that repo's own audit pass), `controllers/admin/banner-controllers.js` (0.84).
- **distribution-backend ↔ hyperwolf-backend: 34 duplicated lines** — `middlewares/
  awsBucket.js` (34 lines, shared across 4 repos: distribution/hemp/hyperwolf/stilo-backend — the
  single most-replicated file in the estate per the cross-repo scan), `startup/middleware.js`
  (0.95 similarity — again the CORS pattern), `models/Fleets.js` (0.82), `models/Order.js` (0.78),
  `models/Products.js` (0.74).
- `common/sendPushNotifications.js` ~ `hyperdrive-backend:common/sendPushNotifications.js` (0.77)
  — push notification sending logic duplicated between the fleet-facing backend and this one
  rather than shared.

None of these were spot-checked line-by-line for byte-identity beyond what `CROSS-REPO-DUPLICATES.md`
already scored; the similarity scores (0.72-0.99) are the tool's own output and are trustworthy as
leads, not independently re-diffed here given the audit's scope (one repo).

## 13. Dependency risk

- **Unmaintained/EOL:** Node 12 (engines field), Mongoose 5.x — both years past EOL (§2).
- **Known-vulnerable:** `axios ^0.21.1` (pre-1.0, multiple CVEs in the 0.21.x line),
  `jsonwebtoken ^8.5.1` (pre-9).
- **Declared but unused (9, verified by grep — not just the metrics list):** `bcrypt` (see §14
  Critical-1 for why this is the worst one on the list), `express-rate-limit` (declared, never
  wired to any route — login and OTP-adjacent endpoints have no rate limiting despite the package
  being one `npm install` away from already being available), `fcm-node`, `msg91`, `nodemailer`,
  `nodemon` (dev tool, fine to be "unused" in prod code), `pug` (configured but never rendered,
  §2), `remove`, `twilio`.
- **Imported but not declared in package.json:** `products` (likely a local path typo/leftover,
  not an npm package — needs manual confirmation against the actual `require()` call site, not
  re-verified here), `uuid` (a real, extremely common package — should be added explicitly rather
  than relying on a transitive install).
- **No lockfile** — see §2; this is a reproducibility/supply-chain risk independent of any single
  package's health, since every install can silently resolve to different dependency versions.
- **Redundant packages doing the same job:** `node-cron` + `node-schedule` (§7); `axios` +
  `request` (the latter has been deprecated by its own maintainers since 2020 and is also declared
  in `package.json`) — both HTTP clients are present, and `request` should not be relied on for
  new code.

## 14. Security findings (ranked)

**Critical-1 — Admin passwords stored and compared in plaintext.**
`controllers/auth-controllers.js:97` — `if (req.body.password != user.password) return
res.status(400)...` compares the login attempt directly against the stored value with no hashing
on either side. `controllers/auth-controllers.js:138` — password updates
(`user.password = req.body.password`) likewise store the raw value. `models/Admin.js` has no
`pre('save')` hook to hash it either. `bcrypt` is a declared dependency (§13) and is never
imported anywhere in the repo — this is not a partially-migrated system, hashing was never wired
in at all. **Impact:** any read access to the `Admin` collection (a DB compromise, a misconfigured
backup, an injection elsewhere, or simply the plaintext-Firebase-key-adjacent poor secret hygiene
already evident in this repo) yields every admin's actual login password, reusable on other
systems. **Fix:** `bcrypt.hash` on create/update, `bcrypt.compare` on login; migrate existing
plaintext values on next successful login (a standard "verify against plaintext once, then
rehash" bridge). Under 1 hour of code change; the hard part is coordinating the one-time
migration of existing accounts, which the owner should confirm before this ships (§19).

**Critical-2 — CORS allows any origin; the whitelist code is dead.**
`startup/middleware.js:13-26` builds a proper origin-whitelist delegate
(`corsOptionsDelegate`, checking `req.header('Origin')` against a real list including
`https://hyperwolf.com`, `https://admin.hyperwolf.com`, etc.) but it is never passed to the `cors`
middleware — `startup/middleware.js:60` calls bare `cors()`, which reflects/allows any origin. The
README claims "CORS origin allow-list" (§8a) — false as shipped. Combined with Critical-3 below,
any website can script cross-origin `fetch()` calls against every endpoint in this API from a
victim's browser. **Fix:** `app.use(cors(corsOptionsDelegate))`. Under 1 hour.

**Critical-3 — Full unauthenticated admin CRUD surface (verified by tracing real code, per the
audit brief's warning that the mechanical "unguarded route" count can be wrong in either
direction — here it was, if anything, an undercount of business impact even though the raw count
was roughly right).** See the table in §6: banners, brand pages, distributors, blog posts, shop
hours/holiday closures, product carousels, and delivery time slots can all be created, edited, or
deleted by anyone with no credential, and `POST /api/v1/admin/products` /
`PUT /api/v1/admin/products/:productId` (product creation/update) have no `[admin]` guard while
every sibling route in the same file does (`routes/admin/product-routes.js:17-18` vs. 19-29) —
almost certainly an accidental omission rather than intended design, given the pattern break.
**Fix:** add `[admin]` (and `[admin, isSuperAdmin]` where a delete/publish action warrants it) to
all 33 route files listed as unauthenticated in §6, starting with the write-capable ones in the
table. This is mechanical but touches ~50+ individual route lines — budget more than the
"quick fix" bar for the full sweep, though each individual line is a 1-minute change.

**Critical-4 — Financial write endpoints reachable with no auth and, in one case, a hardcoded
secret guarding the one that does check.**
`controllers/canpay-controllers.js:118` (`cancelACHOrders`, mounted unauthenticated at
`/api/v1/canpay/update/order/status`) cancels/refunds an ACH order looked up only by
attacker-supplied `orderId` — no ownership check (IDOR) and no auth at all.
`controllers/ledgergreen/ledgergreen-controllers.js:138` does check a shared secret before
processing its payment webhook, but that secret is a **hardcoded literal in source**
(`ledgergreen-controllers.js:10`) rather than sourced from `process.env` like every other
credential in the same file — anyone with read access to this repository (which, given Critical-5,
may already be broader than intended) has the webhook secret as a side effect, and rotating it
requires a code change + redeploy rather than an env var update. **Fix:** add `[auth]` (or a
proper per-caller token) to the CanPay routes and validate order ownership before cancel/refund;
move the LedgerGreen token to `process.env.LEDGERGREEN_WEBHOOK_TOKEN` and rotate it (rotation
itself is not a code change but should happen given it's been sitting in a committed file).

**Critical-5 — Committed Firebase service-account private key.**
`hyperdrive-firebase-adminsdk.json` (repo root) contains a live `private_key` PEM block, loaded
directly by `firebaseAdmin.js:2`. It is listed in `.gitignore:6`, meaning the ignore rule was added
after the file was already tracked — it remains in the repository and in the one squashed commit
this repo currently has. **Fix:** rotate the Firebase service-account key in the Firebase console,
remove the file from the repo (and from git history if this repo is ever un-squashed/pushed
anywhere with history), load the credential from an env var or secret manager instead. This is an
owner-authority action (rotating a live credential), not something to do unilaterally — flagged as
an open item in §19.

**High-1 — Mass assignment via unfiltered `req.body` spread into `findByIdAndUpdate`.**
`controllers/admin/product-carousel-controllers.js:812-820` — `{ ...req.body, products: [] }`
passed straight to `ProductCarousel.findByIdAndUpdate`, with no field whitelist. Combined with
Critical-3 (this same route has no auth), an anonymous caller can overwrite any schema field on
any carousel document, including audit fields like `createdBy`/`createdDate`. **Fix:** destructure
an explicit allow-list of fields instead of spreading `req.body`.

**High-2 — Query-string bearer token (`middlewares/auth.js:5-9`).**
The `x-auth-token`-or-`req.query.token` pattern accepts a static shared secret via URL query
string, which lands in server logs, proxy logs, and browser history. **Fix:** header-only, and
consider per-caller tokens instead of one shared value.

**Medium-1 — `partnerAuth` middleware is not authentication and is misleadingly named/placed.**
See §6 — it always overwrites the caller's `Authorization` header with the server's own outbound
credential and never rejects a request. Not itself exploitable (it doesn't weaken anything that
was otherwise protected), but it actively misleads anyone auditing this codebase into believing a
global auth gate exists at `app.use('/', partnerAuth)`. **Fix:** rename to reflect its true purpose
(e.g. `injectOutboundPartnerCreds`) and move it to where outbound requests are actually built,
not the inbound middleware chain.

**Medium-2 — 200 MB request body limit** (`startup/middleware.js:58-59`,
`express.json({limit:'200mb'})` and `urlencoded` likewise) — a generous DoS surface for any
unauthenticated route (and per Critical-3, there are many); a handful of concurrent 200 MB posts
can exhaust server memory. **Fix:** lower to the actual maximum legitimate payload (almost
certainly well under 10 MB for this API's JSON bodies; file uploads already go through `multer`
separately).

**Low-1 — `LedgerGreen.webhook` info leak** (`ledgergreen-controllers.js:34`, `/webhook` GET-style
lookup) — returns transaction details for any guessed `creditTransactionId`+`phone` pair, no auth,
no rate limit. Low severity because it requires guessing a transaction id, but phone numbers are
low-entropy and this is a payments-adjacent endpoint.

**Not a finding (verified false positive from the mechanical scan):** `mass_assign_update` hits at
`controllers/admin/promotion-controllers.js:33` and `controllers/blaze/product-controllers.js:4354`
write Blaze-API-sourced data (`values[i]`, fetched server-side from Blaze, not `req.body`) into
Mongo updates — not attacker-controlled input. The High-1 finding above (`product-carousel-
controllers.js:813`) is the one confirmed real instance of this pattern in the metrics list.

## 15. Performance findings (ranked)

**High-1 — N+1 query in the core product-sync cron.**
`controllers/blaze/integration/blaze-integration-controllers.js:76-77` — `for` loop over every
product returned by Blaze, `await Product.findOne({ productId: item.id })` per iteration. Runs
every 15 minutes (§7); for a catalog of any real size this is O(n) round trips to MongoDB per sync,
and is the most likely job to eventually miss its own 15-minute window and overlap itself (no lock
exists to prevent that — see §7).

**High-2 — 179 `find()`/`findOne()` calls with no `.limit()` across 39 files** (metrics,
spot-checked at `common/utils.js:371,374,408` and `controllers/blaze/product-controllers.js`,
which alone accounts for 46 of the 179). Combined with the pagination gaps noted in §6, a
meaningful fraction of this API has no upper bound on result set size.

**Medium-1 — 35 `.aggregate()` calls across 13 files**, concentrated in `controllers/admin/
product-carousel-controllers.js` (10) and `controllers/admin/category-controllers.js` (4) — not
independently confirmed to be missing indexes for their `$match`/`$sort` stages (that would
require an `explain()` against live data, out of scope for a static read), but worth a targeted
follow-up given how few indexes exist overall (`.datamodel.md` §1 shows most models have zero).

**Medium-2 — 9 `await`-in-loop hits across 6 files** beyond the High-1 case above — e.g.
`controllers/admin/category-controllers.js:226`, `controllers/admin/shop-time-controllers.js:853,
1105`, `controllers/blaze/integration/blaze-integration-controllers.js:76` (same as High-1),
`controllers/common-controllers.js` (2 sites) — each is a candidate for `Promise.all()` batching.

**Low-1 — Synchronous filesystem calls in request-handling code.** `controllers/didit/didit-
controllers.js:244,255-257` (4 sites) and `controllers/persona/personaController.js` (2 sites) use
sync `fs` calls inside what appear to be request handlers for identity-verification flows —
blocks the single Node event loop for the duration of the disk I/O on every such call.

**Low-2 — Chatty frontend N/A** (this repo is a backend; no frontend polling/bundle-size
applicable here — see the frontend repos' own audits for that).

## 16. Ten things a new developer would trip over

1. Every admin route file looks like it should require `middlewares/admin` — 33 of 57 don't, and
   two routes in `product-routes.js` (create/update) look guarded because their neighbors are, but
   aren't (`routes/admin/product-routes.js:17-18` vs. 19-29).
2. `partnerAuth` (`middlewares/partnerAuth.js`), mounted globally, looks like the app's auth gate
   by name and position — it does the opposite (§6, Medium-1).
3. The cron comments in `startup/nodeCrons.js` are all wrong (§7) — trusting them to reason about
   load or timing will mislead every time.
4. `global.dbConnections` must exist before any model file is required, with no explicit
   documentation of that ordering constraint anywhere except by reading `startup/db.js` and
   `index.js` side by side (§3).
5. `Fleets.js` has an index on `regionId`, a field that doesn't exist on the schema — looks like
   region lookups are indexed; they are not (§5).
6. Two nearly-identical schedule models (`ShopTime` vs `TimeSlot`) and two nearly-identical
   media-banner models (`BRBGraphics` vs `HolidayManagement`) exist side by side with no
   indication of which one is current — a new feature could easily get built against the wrong
   one (§12).
7. `.env.example` is missing 14 vars the code actually reads (§11, item 10) — a fresh local setup
   from the example file alone silently breaks FHL and a few branding vars.
8. `bcrypt` is in `package.json` and looks like it's used for password hashing — it is imported
   nowhere, and passwords are plaintext (§14 Critical-1).
9. The README's "Authentication & Security" section states CORS is allow-listed and FHL webhooks
   are verified — neither is true in the code as it stands (§8a).
10. `views/index.pug` and the `pug` dependency look like they render something — nothing in the
    repo ever calls `res.render`.

## 17. Grade inputs

| Axis | Score (1-10) | Justification | Citation |
|---|---|---|---|
| Simplicity | 3 | One Express app conflates a Blaze middleware, an admin CMS, and a full fleet-ops system across 57 route files and 3 databases with no internal module boundaries | `startup/routes.js` (125 lines of flat `app.use` calls) |
| Speed | 4 | N+1 sync loop on the core 15-min product-sync cron; 179 unlimited `find()` calls | `blaze-integration-controllers.js:76-77` |
| Security | 2 | Plaintext admin passwords, wide-open CORS, ~33 unauthenticated route files including financial writes, a committed Firebase key | `auth-controllers.js:97`; `startup/middleware.js:60` |
| Data modelling | 3 | 60 collections across 3 undocumented DB placements, near-zero soft delete, timestamps stored as 3 different types across models, money mostly untyped | `.datamodel.md` §3, §5 |
| Reuse vs. hardcoding | 3 | 629+305+34 duplicated lines against 3 sibling repos, plus 4 in-repo near-duplicate model pairs | `CROSS-REPO-DUPLICATES.md`; §12 |
| Testing | 1 | One 105-line assert script, no runner wired, no CI test gate | `package.json` (no `test` script); `.github/workflows/*` |
| Upgradability | 2 | Node 12 + Mongoose 5, both EOL; no lockfile; business logic tightly coupled to Express req/res and to the global `dbConnections` boot order | package.json `engines`; `startup/db.js` |
| Operability | 3 | Cron failures only `console.log`, never reach Sentry; three ad hoc Mongo log collections with no retention policy; deploy has no test/build gate | `nodeCrons.js` catch blocks; `.github/workflows/node.js.yml` |
| Developer experience | 3 | README is unusually accurate on architecture but wrong on two security claims; no local env var completeness check; misleading middleware names (`partnerAuth`, `addAdminReq`) | README.md "Authentication & Security"; `partnerAuth.js` |

## 18. Quick fixes (<1h each, ranked by impact/hour)

1. Wire `cors(corsOptionsDelegate)` instead of bare `cors()` — the fix already exists in the file,
   just unused (`startup/middleware.js:13-26,60`). **Highest impact/effort ratio in this repo.**
2. Add `[admin]` to `routes/admin/product-routes.js:17-18` (create/update product) to match its
   neighbors.
3. Move the LedgerGreen webhook token to an env var and rotate it (`ledgergreen-controllers.js:10`).
4. Remove the hardcoded Google Maps API key comment and rotate the key
   (`google-controllers.js:23`).
5. Fix `Fleets.js:71`'s dead index to target `regionData.regionId`.
6. Lower the Express body-size limit from 200 MB to something realistic
   (`startup/middleware.js:58-59`).
7. Add `middlewares/auth` (header-only, drop the `req.query.token` fallback) to
   `middlewares/auth.js:5-9`.
8. Delete the dead `pug`/`views/index.pug` view-engine wiring and the `pug` dependency.
9. Consolidate `node-cron`/`node-schedule` to one library in `startup/nodeCrons.js`.
10. Fix the cron interval comments in `startup/nodeCrons.js` to match reality (or better, delete
    them — wrong documentation is worse than none).

(Rotating/removing the committed Firebase key and migrating admin passwords off plaintext are both
higher-impact than everything above, but neither is a "<1h, do it now" item — both need owner
sign-off given they touch live credentials and existing user data; see §19.)

## 19. Open questions

1. Which branch (`hyperdrive-fleet` or `feature-schedule-dynamic`, per the two CI workflows, or
   some third branch not visible in this squashed single-commit snapshot) is actually deployed to
   the production host serving live traffic today, and is `thcs.in` prod or is
   `18.235.246.3` prod? The repo alone cannot answer this.
2. Is the Firebase service-account key in `hyperdrive-firebase-adminsdk.json` still active in
   production? If so, rotating it is a live-credential change that needs the owner's go-ahead and
   a coordinated redeploy, not something to do unilaterally from an audit pass.
3. How many existing `Admin` accounts have plaintext passwords today, and is there appetite for a
   forced password reset vs. a transparent rehash-on-next-login migration?
4. Is `StoreProducts` (conn3/Stilo-only) intentionally Stilo-specific, or is this a gap where
   Hyperwolf/Hemp store-level product data should exist here but doesn't?
5. Why does `Legal` live in the Hemp database (conn2) from inside the Hyperwolf-named repo, while
   `stilo-backend` maintains an independent copy — is there a plan to consolidate legal/policy
   content into one shared service, or is per-brand duplication intentional given legal content
   can differ by brand?
6. Is `express-rate-limit` (declared, unused) meant to have been wired to login/OTP endpoints
   already, or was it added speculatively and never finished?
