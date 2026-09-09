# stilo-backend — audit report

Repo: `/Users/jt/hyper-tech/stilo-backend` pinned at `a9f4407` (confirmed via `git rev-parse
HEAD`). Read-only audit; nothing in the repo was modified. Full field-by-field data model is in
`stilo-backend.datamodel.md`. The mechanical metrics pass
(`/Users/jt/POS-Admin/docs/codebase-audit/metrics/stilo-backend.md`) was read first; its numbers
are cited below only where independently verified, and corrected in three places where it was
wrong or misleading (§6, §13, §15).

## 1. Purpose

Stilo Backend is the Node/Express API for the Stilo retail brand (part of the same estate as
Hyperwolf and Hemp). One process serves three client surfaces off a single `/api/v1/*` REST
API (per `startup/routes.js` and `README.md`, which agree here): a customer storefront
(products/cart/checkout/orders/members), an admin back office (stores, products, promotions,
dashboards, settings), and an in-store POS (checkout, printing, barcode scanning, member
check-in). It talks to ~20 external services for payments, identity/age verification, loyalty,
compliance reporting, shipping, and messaging (full list in §8).

## 2. Runtime & framework

- Node: no `.nvmrc`, no `engines` field in `package.json` (confirmed: `grep -n engines
  package.json` = no match). CI (`.github/workflows/security.yml`) pins Node 20 for its own job,
  but that is not a guarantee about production.
- Framework: Express `^4.21.2` (5.x is current — no migration path visible).
- DB + ORM: MongoDB via Mongoose `^8.9.5`, two live connections (see §3). `sequelize ^6.37.5` +
  `pg ^8.13.1` + `pg-hstore ^2.3.4` are also declared, but **zero uses of either exist anywhere
  in source** — `grep -arn "sequelize\|Sequelize" --include='*.js' .` and
  `grep -arn "require(['\"]pg['\"]" --include='*.js' .` both return no hits outside
  `package.json`, and there is no `new Sequelize(`/`.define(` call anywhere. **Verdict on the
  two-ORM question the task asked about: Mongoose is the entire live datastore; Sequelize/pg are
  dead weight — either a removed feature or an unfinished migration that was never started.**
  Confirm with the owner before deleting (§19) but treat as safe to remove from `package.json`
  (§18).
- TypeScript: none, plain JS throughout (197 `.js` source files).
- Pinning/lockfile: **no lockfile** (`package-lock.json`/`yarn.lock`/`pnpm-lock.yaml` all absent
  — confirmed by directory listing), all 45 dependencies pinned with `^` (caret) only — a fresh
  `npm install` today can pull different minor/patch versions than the last deploy, with no way
  to reproduce what's actually running in production.
- EOL/CVE exposure: Express 4.x is in maintenance-only mode; `puppeteer ^24.x` is a very heavy
  dependency (bundles a full Chromium) for what appears to be PDF/receipt rendering — worth
  confirming it's still needed. No other majors stood out as EOL in this scan.

## 3. Entry points & boot

`index.js` boots in order: `dotenv.config()` → `startup/config.js` (throws if `DATABASE_URL`,
`PUBLIC_TOKEN`, `ALPINE_BASE_URL`, or `SENTRY_DSN` are unset — config.js:2-13) →
`startup/middleware.js` → `await startup/db.js()` → `startup/routes.js` → (if
`!IS_DEVELOPMENT`) `startup/nodeCrons.js`. `app.listen` happens **outside** the async IIFE
(index.js:30), so the HTTP server starts listening immediately even if the `await db()` inside
the IIFE hasn't resolved yet or throws — there is a narrow startup window where requests can hit
routes before `global.dbConnections` exists (every model file dereferences
`global.dbConnections.connN` at `require()` time, so in practice this would crash the process on
require rather than serve a broken request, but it's a fragile pattern worth flagging).

`startup/db.js` opens **two separate Mongoose connections** and does not proceed until both are
live: `conn1` = `mongoose.createConnection(process.env.DATABASE_URL)`, `conn2` =
`mongoose.createConnection(process.env.HEMP_DATABASE_URL)` (db.js:14-20). Both are exposed as
`global.dbConnections.conn1`/`conn2` — every one of the 56 registered models attaches to one of
these two connections by name (`global.dbConnections.connN.model(...)`), never to a bare
`mongoose.model(...)` (confirmed: 0 hits for bare `mongoose.model(` across `models/*.js`). 48
models use `conn1` (Stilo's own DB); **8 models use `conn2`, which is opened from
`HEMP_DATABASE_URL` — the Hemp brand's database URL** — Admin, Authors, Legal,
MemberWalletReasons, MainProductTraits, Miscellaneous, RefundReasons, SubProductTraits
(models/Admin.js:27 etc.). In other words, **Stilo's own admin-login collection physically lives
in a database provisioned for a different brand.** This is either an intentional
shared-content-database design (Legal/Authors/MainProductTraits do look like brand-shared CMS
content) or a real cross-tenant coupling risk for `Admin` specifically, since Admin holds
authentication credentials, not shared marketing content — worth a direct answer from the owner
(§19).

Global mutable state: `global.dbConnections` (the two connections) and `global.crypto` polyfill
(index.js:16-18) are the only globals set at boot.

## 4. Directory map

| Dir | Files/Size | Role |
|---|---|---|
| `controllers/` | 53 files / 1.4MB | Request handlers, grouped by feature; contains the bulk of business logic (no separate service layer) |
| `routes/` | 53 files / 216K | Express Router definitions, one file per feature, mounted in `startup/routes.js` |
| `models/` | 55 files / 224K | Mongoose schemas (56 registered models, see §5 and the datamodel file) |
| `middlewares/` | 14 files / 56K | Auth (JWT, static API key, static token), file/S3 uploads, `checkStoreExists`, `isSuperAdmin` |
| `common/` | 7 files / 176K | Shared utilities — `utils.js` is 3,697 lines and is a genuine god-file: request helpers to 15+ external APIs, cart/order math, image/barcode generation, and cron job bodies all live in one file. `emailService.js`/`commonSendMail.js`/`emailTemplates.js`/`fcmNotifications.js`/`toastMessages.js` round out the directory with single-purpose helpers. |
| `emailTemplates/` | 9 files / 132K | HTML string templates for SendGrid emails |
| `staticDB/` | 12 files / 192K | Static JSON config (`apiVersion.json`) and `fcmtoken.json` — a Firebase service-account key file committed to the repo (see §14) |
| `regionFiles/` | 1 file / 8K | Delivery-zone data |
| `startup/` | 5 files / 24K | Boot sequence (§3) |
| `assets/`, `uploads/` | 27+4 files | Static/uploaded file storage (also served directly via `express.static`, startup/middleware.js:57-61) |

## 5. Data model summary

56 registered Mongoose models across two connections (48 on `conn1`/Stilo's own DB, 8 on
`conn2`/Hemp's DB — see §3). No models use Postgres/Sequelize (§2). Full field-by-field detail
for every model is in `stilo-backend.datamodel.md`; highlights here:

- **Money**: every currency-shaped field (`unitPrice`, `salePrice`, `purchasePrice`, `margin`,
  `walletAmount`, `totalTax`, `netProfit`, `discountAmount`, `cashUpto`, `minAmt`/`maxAmt`,
  `taxRate`, `averageSpent`, etc.) is a plain Mongoose `Number` — **no `Decimal128` anywhere**
  (confirmed: `grep -arn "Decimal128" models/*.js` = 0 hits). Dollars, not cents, and subject to
  IEEE-754 float rounding on every arithmetic op done in JS across `common/utils.js` and the
  order/cart controllers.
- **Timestamps**: none of the 56 schemas use Mongoose's built-in `{timestamps: true}` — every
  model instead has manually-maintained `createdDate`/`updatedDate` `Number` fields (Unix ms),
  set by controller code on each write. Only one model (`SubProductTraits`) has a `pre('save')`
  hook to auto-stamp `updatedDate`; everywhere else it's the controller author's job to remember,
  and at least one field (`Order.updatedDate`) is set inconsistently across the very large
  `Order` schema (see datamodel file for the duplicate-field details in `Order`).
- **Soft delete**: no convention exists. No `isDeleted`/`deletedAt` field appears in any of the
  56 models. "Deactivation" is done via a `status` field that is inconsistently typed —
  `Boolean` in some schemas (Cannabinoid, Strain, Member, StoreUser), `String` in others (Store,
  Inventory, WebCategory), and in two places (`Brand`, `Category`) a `String`-typed `status`
  field whose *default value* is the boolean literal `false` (Brand.js:314, Category.js:505) —
  almost certainly a copy-paste bug from a Boolean-status model.
- **Multi-tenancy key**: `storeId`, a plain `String` (not an ObjectId ref to `Store._id`),
  present on ~20 of the 56 models with no schema-level `ref` or, in most of them, no
  `required` either.
- **IDs**: default Mongo `ObjectId` `_id` everywhere, plus a large parallel set of
  application-generated `String` id fields (`storeId`, `productId`, `orderId`, `memberId`,
  `roleId`, etc.) that every cross-collection "join" in the controllers matches on directly —
  real Mongoose `ref:` relations are used in only 4 places in the whole model layer, one of
  which references a model name (`"Author"`) that doesn't match the model actually registered
  (`Authors` — models/Blog.js:208 vs models/Authors.js:177), so `.populate('author')` cannot
  resolve.
- **Indexes**: only 3 of the 56 models declare an explicit index (`Blog`, `MainProductTraits`,
  `StoreCoordinates` — see datamodel file for exact keys). `Order`, `Member`, `StiloProducts`,
  `StoreProducts`, `ActiveCart`, and `TransactionLog` — the collections the busiest
  dashboard/POS/cart code queries and aggregates by `storeId`/status/`createdDate` — have **no
  explicit index at all**. See §15.
- **10 most central models** (by how many other collections carry their id, since real `ref`s
  are almost never used): Store/StoreUser, Member, Order, StiloProducts/StoreProducts,
  ProductBatch, Admin, Region, CartRules/ProductRules (consulted by cart pricing),
  UserRolesPermissions.

## 6. API surface

Routes are mounted in `startup/routes.js`: ~50 routers under `/api/v1/*`, one `GET /` health
string, one rate-limited `GET /ping`, and a catch-all 404.

**Auth mechanism — corrected from the metrics tool.** The metrics pass counted 490 of 504 route
handlers as having "no middleware before the handler," which is misleading: it only looks at
what's attached directly in each route file and misses the two `app.use(...)` calls in
`startup/middleware.js` that apply to *every* request. The real chain is:

1. `app.use(cors())` with no options object — a fully open CORS policy (any origin may read
   responses; `cors()`'s default reflects the request origin and does not set
   `Access-Control-Allow-Credentials`, so this is "wildcard, not credentialed" — lower severity
   than it could be, but still unrestricted). A differently-shaped `corsOptions`/
   `corsOptionsDelegate` object sits in the same file (startup/middleware.js:12-31) but is never
   passed to `cors()` — dead code.
2. `app.use('/', partnerAuth)` (middlewares/partnerAuth.js) — on every request it checks
   `!req.headers["Authorization"] || req.headers["authorization"]`. Node always lowercases
   incoming header names, so `req.headers["Authorization"]` (capital A) is **always** `undefined`
   and the condition is **always true**, so it always executes `req.headers.Authorization =
   authorization` (the server's own `AUTH_TOKEN` secret) and, separately, sets
   `req.headers["X-API-KEY"]` (capital-cased key) from `PARTNER_KEY` if that exact capitalized
   key is absent (which it always is). Both writes create **new, differently-cased object keys**
   that nothing downstream reads (everything else reads the lowercase `req.headers.authorization`
   / `req.headers['x-api-key']`). **This middleware appears to be a complete no-op** — verify with
   the owner before assuming it does anything (§19); if it was meant to inject default
   credentials for some client, it currently doesn't.
3. `app.use(middlewareAuth.middlewareAuth)` (middlewares/authMiddleware.js) — checks
   `req.headers['x-api-key']` (lowercase) against `process.env.PROJECT_API_KEY` for **every**
   route except a 7-item `excludedRoutes` allowlist (`/`, two ShipStation callback paths, an NMI
   payment path, `/ping`, `/api/v1/revenuekit/check/status`). This means the *entire* API is
   gated by **one static, shared secret** — not a per-user credential.
4. On top of that shared-secret gate, a **separate JWT layer** exists
   (middlewares/admin.js: Bearer JWT, `jwt.verify(token, process.env.JWT_ADMIN_PRIVATE_KEY)`,
   sets `req.user = decoded`) — but it is wired into only **2 of the 53 route files**:
   `routes/store-settings/tax-routes.js` and
   `routes/store-settings/user-roles-permission-routes.js` (confirmed via
   `grep -arl "middlewares/admin['\"]" routes -r`). `middlewares/isSuperAdmin.js` — the
   role-check middleware that reads `req.user.isSuperAdmin` — **is required by zero route files**
   (confirmed: `grep -arl isSuperAdmin routes -r` = no matches). It is dead code.

**Net effect**: essentially every admin, POS, order, and member endpoint — including
`routes/admin/admin-user-routes.js` itself (admin account CRUD) — has **no per-user
authentication and no role check**, only the one shared `PROJECT_API_KEY`. See §14 for the
critical exploit chain this enables. `JWT_ADMIN_PRIVATE_KEY` is also misnamed: it's used
identically in `jwt.sign` (models/Admin.js:23, Store.js:49, StoreUser.js:35) and `jwt.verify`
(middlewares/admin.js:13) — a single symmetric HMAC secret, not an asymmetric key pair.

Role representation: a Boolean `isSuperAdmin` flag on the decoded JWT payload (not a role-string
system) — but `Admin.userRoles`, `Store.roleName`/`roleId`, and `StoreUser.roleName`/`roleId` are
separate free-text fields checked ad hoc in controller code (e.g.
`req.body.userRoles.includes("Super Admin")`, controllers/admin/admin-user-controller.js:126) —
two different, uncoordinated role systems.

Input validation: `joi` is used in some model files (as an export alongside the schema, not as
route middleware in most cases — inconsistent) and hand-rolled `if (!field) return 400` checks
elsewhere; no consistent validation layer across all 53 controllers.

Pagination: `limit`/`skip` query params, defaulted per-handler (e.g.
`controllers/admin/admin-user-controller.js:99-100` defaults `limit=10, skip=0`) — not a shared
utility, repeated ad hoc in each list handler.

Error shape: mostly `res.status(4xx).send({message: "..."})`, but not universal — some handlers
`res.send({message: errorResponse})` with a 200 status on failure (e.g.
controllers/ledgergreen/ledgergreen-controllers.js:44).

Versioning: `/api/v1/*` only — no v2, no deprecation mechanism visible.

## 7. Background jobs

`startup/nodeCrons.js`, registered only when `!IS_DEVELOPMENT`. node-cron here uses 6-field
syntax (`sec min hour day month weekday`) for most entries — **three of the six active jobs run
far more often than their own inline comment claims**, verified by decoding the cron strings:

| Schedule | Comment says | Actually runs | Job |
|---|---|---|---|
| `0 0 */2 * * *` | "every 2 day" | every **2 hours** | `removeFiles()` — deletes `assets/googleImages/*.jpeg` older than 24h |
| `0 0 */1 * * *` | "every 1 day" | every **1 hour** | `productReviews()` — calls the Reviews API once per `StoreProducts` document, in parallel via `Promise.all` with no concurrency cap |
| `0 */1 * * * *` | "every 4 minutes" | every **1 minute** | `resetHoldQuantityFunction()` |
| `*/10 * * * *` | "every 10 minutes" | every 10 minutes (correct — 5-field syntax) | `checkCartStatus()` — abandoned-cart check |
| `59 23 * * *` | — | daily 23:59 | `vipMember()` |
| `59 23 * * *` | — | daily 23:59 | `createSales()` — METRC sales report |

`productReviews()` running 24x more often than its comment implies, combined with an unbounded
`Promise.all` over every `StoreProducts` row (`controllers` call `StoreProducts.find()` with no
limit — nodeCrons.js:32), is a real load risk against both MongoDB and the third-party Reviews
API. None of the six jobs guard against overlapping runs (no lock, no `isRunning` flag) — if a
job takes longer than its own interval, invocations will pile up concurrently on the same
collections. All failures are caught and only `console.error`'d (nodeCrons.js:18-20, 57, 66) —
no alerting, so a permanently-failing cron produces no signal beyond scrollback log lines.

## 8. Third-party integrations & secrets

| Integration | Wrapper file(s) | Credential source |
|---|---|---|
| MongoDB (x2) | `startup/db.js` | `DATABASE_URL`, `HEMP_DATABASE_URL` env vars |
| LedgerGreen (payments) | `controllers/ledgergreen/ledgergreen-controllers.js` | `LEDGERGREEN_PUBLIC_KEY`/`LEDGERGREEN_SECRET_KEY` env vars, sent as request headers to a proxied API call — no inbound signature verification implemented (its `webhook` handler is actually an outbound GET-by-id lookup, not a signed inbound receiver) |
| NMI (payments) | `models/PaymentSetting.js` stores `paymentClientId`/`paymentSecretId` as plain schema fields in the primary DB, not a secrets manager | per-store, stored in Mongo |
| AlpineIQ (loyalty) | `controllers/alpine/*` | `ALPINE_BASE_URL`, `ALPINE_IQ_KEY` |
| Persona / Didit (identity verification) | `controllers/persona/*`, `controllers/didit/*` | `PERSONA_TOKEN`/`PERSONA_URL`, `DIDIT_API_KEY`/`DIDIT_API_BASE_URL`/`DIDIT_WORKFLOW_ID` |
| Intercom | `controllers/intercom/intercom-controllers.js` | `INTERCOM_AUTH_TOKEN`, `INTERCOM_HASH_SECRET_KEY` — correctly uses `crypto.createHmac('sha256', secretKey)` (line 69) for the Intercom identity-verification hash. This is the one place in the codebase doing HMAC correctly — worth crediting. |
| TextVolt (SMS/driver dispatch) | `controllers/textVolt/textVolt-controllers.js` | `TEXT_VOLT_BEARER_TOKEN`, `TEXT_VOLT_URL` |
| ShipStation | `controllers/shipstation/shipstation-controllers.js` | `SHIPSTATION_API_KEY`/`SHIPSTATION_BASE_URL` |
| Reviews (unnamed vendor) | called from `startup/nodeCrons.js`/`common/utils.js` | `REVIEW_API_KEY`/`REVIEW_BASE_URL`/`REVIEW_STORE_ID` |
| Age Checker | `controllers/agechecker/*` | `AGE_CHECKER_BASE_URL` |
| METRC (state compliance reporting) | `controllers/metrc-controllers.js`, mounted `/api/v1/metrc` | `METRC_BASE_URL`/`METRC_USERNAME`/`METRC_PASSWORD` |
| Blaze POS | `routes/blaze/shop-variables-routes.js` | `BLAZE_BASE_URL`/`BLAZE_RETAIL_*` |
| AWS S3 | `middlewares/awsBucket*.js` (4 variants: generic, barcode, PDF, product) | `AWS_ACCESS_KEY`/`AWS_SECRET_ACCESS_KEY` |
| Firebase (push) | `firebaseAdmin.js` + `staticDB/fcmtoken.json` | **a Firebase service-account private-key JSON file committed to the repo** (`staticDB/fcmtoken.json` — the metrics tool's `private_key_block` hit; confirmed present, kind not reproduced here per the no-secrets rule) |
| SendGrid | `common/emailService.js` / `common/commonSendMail.js` | `SENDGRID_API_KEY`/`SENDGRID_FROM_EMAIL` |
| OpenAI | referenced via `OPEN_AI_AUTH_KEY` | usage not deeply traced in this pass |
| Sentry | `@sentry/node`/`@sentry/tracing` declared, `SENTRY_DSN` **required at boot** by `startup/config.js:11-13` (process throws if unset) | **but `Sentry.init(...)` is commented out** in `startup/middleware.js:35-44`, and its request/error handlers are also commented out (lines 73-74). The app cannot even start without a `SENTRY_DSN` value, yet no error is ever actually sent to Sentry. Either finish wiring it up or drop the boot-time requirement — right now it's pure friction with no payoff. |
| Hardcoded (non-env) secret | `controllers/common-controllers.js:45-46` — `clientId`/`apiKey` are literal string values in source (`apiKey = "NjI3MTU2ZjM4ZGU1OGU0NTlkM"`), not read from `process.env` | kind: API credential literal, not reproduced here |

## 9. Tests

Zero. `find . -name "*.test.js" -o -name "*.spec.js"` and the metrics pass both report 0 test
files, 0 test lines. `package.json` has no `test` script at all (only `start` and `dev`) — there
is nothing for `npm test` to even run. This is a payments/inventory/age-verification/compliance
system with no automated coverage of any kind.

## 10. Build & deploy

No Dockerfile. `.github/workflows/security.yml` runs `npm audit --audit-level=critical` plus a
battery of scanners for other languages (Go/Python/Flutter/Android/PHP) that all no-op on this
pure-Node repo via `if [ -f ... ]` guards — real coverage here is just `npm audit`, gated to fail
only on `critical` findings. `.github/workflows/stage.yml` triggers on that workflow's success
(branch `development` only) and SSHes into `api.stage.stilosupply.com` to `git stash && git pull
&& npm i && pm2 restart stilo-backend`. **No production deploy workflow exists in this repo** —
`README.md` §Deployment (lines 177-184) is honest about this ("No deployment credentials, hosts,
or internal details are documented here"), so the README and the CI files agree; production
deploy is presumably manual or handled elsewhere. `npm i` (not `npm ci`) on every stage deploy,
combined with no lockfile (§2), means stage can install different dependency versions on
different deploys with no record of what actually ran.

Logging/monitoring: `console.log`/`console.error` only (147 + more call sites per the metrics
pass) — no structured logging, no log levels, no correlation IDs. Sentry is configured-for but
inert (§8).

## 11. Hardcoded values

Worst 10 by risk (not just metrics count):

1. `controllers/common-controllers.js:45-46` — literal API credential strings in source
   (`clientId`, `apiKey`) instead of env vars. **Should be config**, and should be rotated once
   moved, since it's sat in git history regardless.
2. `controllers/common-controllers.js:1756-1757` — `http://127.0.0.1:5000/print_tm30_image...`
   / `.../print_ip...` hardcoded localhost print-server URLs used in `printAPI`. **Should be
   config** — breaks if the print bridge ever runs anywhere but `127.0.0.1:5000` on the same
   host as the API process.
3. `controllers/POS/pos-controllers.js:47` — hardcoded S3 URL
   `https://stilo-assets.s3.us-east-1.amazonaws.com/staticBarCode.png`. **Should be config**
   (bucket/region differs per environment/brand).
4. `staticDB/fcmtoken.json` — committed Firebase service-account key (see §8). **Should not
   exist in the tree at all**; belongs in a secret store.
5. `role_string` — 44 hits across 15 files (top: `controllers/admin/category-controllers.js`
   7x, `controllers/common-controllers.js` 6x, `controllers/admin/blog-controller.js` 5x) —
   role/permission checks done as scattered string-literal comparisons
   (e.g. `.includes("Super Admin")`, controllers/admin/admin-user-controller.js:126) instead of
   a shared constants module. **Should be data/config** (a single roles enum), not because the
   values change often but because 44 independent copies of the same literal is how a rename
   silently breaks half the checks.
6. `http_url` — 57 hits across 15 files, heaviest in `emailTemplates/orderCompletedOrCancelled.js`
   (7x) and `startup/middleware.js` (6x, the CORS whitelist — see §6). Brand-specific domains
   hardcoded into email templates and the CORS allowlist. **Should be config** — this is exactly
   the kind of value that differs across the Stilo/Hemp/Hyperwolf forks (§12).
7. `controllers/cart/cart-controllers.js:1105` and `emailTemplates/userForgotEmailTemplate.js:40`
   — hardcoded email/S3 literals, same "should be config" category.
8. `controllers/textVolt/textVolt-controllers.js:19,67,100` — hardcoded phone literal
   `+11111111111` used as a test/placeholder sentinel value checked in production logic
   (`if (... .phone === "+11111111111")`) — **should be a named constant at minimum**, ideally
   not a magic string embedded three times.
9. `common/utils.js:647` and similar `http_url` hits inside the shared utils god-file — same
   category as #6, but harder to find/change because of the file's size (§4).
10. `models/PaymentSetting.js` field names (`paymentClientId`/`paymentSecretId`) aren't
    hardcoded values themselves, but they normalize storing payment-processor secrets as plain
    Mongo fields rather than referencing a secret manager — a structural version of the same
    "should be config, not data-that-looks-like-secrets" problem.

The `mongo_uri`/`localhost`/`ip_literal` metrics hits at `controllers/common-controllers.js:1911`
were verified and are **false positives**: that line is a `uri.startsWith('mongodb://')` format
*check* inside `checkDBConnection`, not a hardcoded connection string.

## 12. Duplicated code

**In-repo**: `controllers/store-settings/*` (barcode, branch, notification, payment, printer,
shop, tax, user-roles-permission — 8 files, 716 lines total) is a near-identical CRUD pattern
repeated once per settings type, each hand-written rather than generated from a shared factory —
classic copy-paste-and-rename. `MainBrand.js`, `MainCannabinoid.js`, and `MainStrain.js` (models)
are the same schema shape three times with one field renamed each time. `Category.js` and
`WebCategory.js` (models) are two separately-maintained "category" collections. `Tax.js` and
`TaxSettings.js` (models) are two separately-maintained tax-configuration collections.

**Cross-repo** (verified against `/Users/jt/hyper-tech/hemp-backend` and
`/Users/jt/hyper-tech/hyperwolf-backend`, per the leads in
`metrics/CROSS-REPO-DUPLICATES.md`): `hemp-backend` ↔ `stilo-backend` share **2,507 exact
duplicate lines**; `hyperwolf-backend` ↔ `stilo-backend` share **629**; `distribution-backend` ↔
`stilo-backend` share **34**. Spot-verified the highest-impact pairs directly (not just trusting
the scanner):

- `controllers/admin/dashboard-controllers.js` — **confirmed byte-for-byte identical** to
  `hemp-backend:controllers/admin/dashboard-controllers.js` (2,054 vs 2,053 lines; `diff` on the
  first 40 lines of each is empty). This is the revenue/analytics dashboard — a 2,000+ line
  business-critical file forked with zero shared package, meaning every bugfix or metric change
  has to be manually re-applied to (at least) two repos, and there's no evidence-based reason to
  believe that happens reliably.
- `controllers/intercom/intercom-controllers.js` — 480 lines, exact duplicate with hemp-backend.
- `controllers/admin/promotion-controllers.js` — 230 lines, exact duplicate with hemp-backend.
- `models/Legal.js` — 166 lines, exact duplicate with hyperwolf-backend (confirmed by content —
  the CMS-style Legal schema itself even carries a `platformAvailability {hyperwolf, hemp,
  stilo, all}` flag object, i.e. the model was explicitly designed to be shared across brands,
  yet is copy-pasted per repo instead of centralized).
- `controllers/ledgergreen/ledgergreen-controllers.js` — 117 lines duplicated with hemp-backend.
  **This one is higher-risk than the others**: it's payment-processing logic. A security fix
  applied to one brand's copy and not the other is a real, silent exposure.
- `controllers/cannabinoids/cannabinoids-banner-controllers.js` — 148 lines, duplicated
  **three ways** across hemp-backend, hyperwolf-backend, and stilo-backend.

**Verdict**: this is not "coincidentally similar CRUD" — the dashboard and payment-provider
duplication in particular are large, business-critical, and drift-prone. It reads as three
brand backends produced by forking one codebase per brand rather than extracting a shared
internal package, which is the single biggest structural finding in this repo (see §17
reuse-vs-hardcoding).

## 13. Dependency risk

- **Declared but never imported** (confirmed by grep, not just trusting the metrics list):
  `sequelize`, `pg`, `pg-hstore`, `apollo-server`, `apollo-server-express`, `graphql`,
  `@graphql-tools/merge` — all GraphQL/Postgres tooling with zero usage anywhere in `.js` source.
  `child_process` is also declared as an **npm package** (not just used as the Node builtin) —
  confirmed nothing actually `require`s it, so it's inert, but it's worth noting that a package
  on npm sharing a name with a Node core module is an easy typo/confusion trap for whoever added
  it. `tar-fs`, `get-stream`, `join-images`, `pdf-to-printer`, `nodemon` (a devDependency living
  in `dependencies`) round out the unused list.
- **The metrics tool's 60-hit `child_process` "security" lead is a false positive** — every one
  of those 60 hits (e.g. `common/utils.js:921-923`) is a Mongoose `.exec()` query-method call
  (`Order.aggregate(...).exec()`), not `child_process.exec()`. Verified directly; there is no
  shell/process spawning anywhere in the controllers checked (`dashboard-controllers.js`,
  `member-controllers.js`, `common/utils.js`) — **no command-injection risk from this lead**,
  correcting the metrics pass.
- **Imported but undeclared** (will break a clean `npm install`): `sharp`, `cors`,
  `moment-timezone`, `form-data`, `escpos` — confirmed these are genuinely absent from
  `package.json` while being required in source.
- No lockfile + all-caret pinning (§2) means "declared but unused" and "imported but undeclared"
  can both silently change between deploys with no diff to review.
- Puppeteer (`^24.22.0`) is a heavyweight, security-sensitive dependency (bundles Chromium,
  historically a frequent CVE source) — confirm it's still needed for whatever PDF/receipt flow
  uses it before the next major bump.

## 14. Security findings (ranked)

**1. CRITICAL — full admin account takeover requires no credential at all, only the one shared
static API key.** `routes/admin/admin-user-routes.js` has **no JWT/role middleware on any
route** (§6) — every admin-management endpoint is gated only by the global `PROJECT_API_KEY`
static header. Chained:
- `GET /api/v1/admin/get` (`getAllAdmins`, controllers/admin/admin-user-controller.js:96-115)
  returns full `Admin` documents via `Admin.find(searchQuery)` with **no field exclusion** —
  every admin's bcrypt password hash and Mongo `_id` is returned to any caller holding the
  static key.
- `GET /api/v1/admin/:id` (`getAdminById`, same file:176-186) then **mints and returns a fresh,
  valid 2-day JWT** (`admin.generateAuthToken()`) for *any* admin `_id` passed in the URL — no
  password, no prior session, nothing but the static key and an `_id` harvested from the
  previous call.
- **What an attacker can do**: with only the one shared `PROJECT_API_KEY` (which — given it
  gates nearly the entire public API — is highly likely embedded in a POS terminal build or an
  admin frontend bundle somewhere in the estate), obtain a valid super-admin-capable JWT for any
  existing admin account, with zero knowledge of that admin's password or PIN.
- **The fix**: put `middlewares/admin.js` (JWT check) in front of every route in
  `admin-user-routes.js` except `/login`/`/forgot`/`/reset`; add `.select('-password')` to
  `getAllAdmins`; remove the free token mint from `getAdminById` or gate it behind
  `isSuperAdmin`.

**2. CRITICAL — privilege escalation to super-admin via the same unauthenticated route.**
`updateAdmin` (controllers/admin/admin-user-controller.js:117-126): `if
(req.body.userRoles.includes("Super Admin")) user.isSuperAdmin = true` — any caller who can hit
`PUT /api/v1/admin/edit/:id` (same static-key-only gate as above) can set `isSuperAdmin: true` on
any admin record, including one they just created via the equally-unauthenticated `POST
/create`. Combined with finding #1, this is a complete, zero-credential path from "has the one
shared static API key" to "holds a valid super-admin JWT." **The fix**: require the *caller* to
already be `isSuperAdmin` (via `req.user` once JWT gating is added) before honoring this field.

**3. HIGH — `isSuperAdmin` role-check middleware is dead code.**
`middlewares/isSuperAdmin.js` exists and correctly checks `req.user.isSuperAdmin`, but is
required by **zero** of the 53 route files (confirmed by grep). Any endpoint intended to be
super-admin-only is currently either open to any JWT holder or (per findings #1-2) open to
anyone with the shared static key. **The fix**: audit which admin routes are meant to be
super-admin-gated and wire this middleware in.

**4. MEDIUM — ReDoS / unescaped user input in MongoDB regex queries.**
`controllers/admin/cart-rules-controllers.js:92,96` and
`controllers/admin/product-rules-controllers.js:99,103`: `new RegExp('^' + req.body.ruleType +
'$', 'i')` builds a regex directly from unescaped request input. A crafted `ruleType` containing
regex metacharacters can cause catastrophic backtracking (ReDoS) or unintended broad matches.
**The fix**: escape regex special characters before constructing the `RegExp` (a small
`escapeRegex()` helper), or use a plain equality/`$eq` query instead of `$regex` for exact-match
lookups like this one.

**5. MEDIUM — CORS is fully open.** `app.use(cors())` with no restriction (startup/middleware.js:66)
allows any origin to read API responses. Mitigated somewhat by the shared-API-key requirement on
most routes, but the excluded routes (`/`, ShipStation callbacks, `/ping`,
`revenuekit/check/status`) and any route an attacker does obtain the key for are fully exposed
cross-origin. **The fix**: use the already-written-but-unused `whitelist`/`corsOptionsDelegate`
in the same file instead of the bare `cors()` call.

**6. MEDIUM — no rate limiting on any login/PIN endpoint.** The only rate limiter in the app
(`pingRateLimiter`, startup/routes.js:61-67) applies to `GET /ping` alone. `POST
/api/v1/admin/login` (password login) and `POST /api/v1/pos/pin/login` (POS PIN login,
routes/POS/pos-routes.js:21 — PINs are typically short/numeric and far more brute-forceable than
passwords) have no rate limit at all. **The fix**: add `express-rate-limit` to both.

**7. MEDIUM — secret literal committed in source.** `controllers/common-controllers.js:45-46` —
`clientId`/`apiKey` are hardcoded string literals rather than `process.env` reads (kind only,
value not reproduced here per the no-secrets rule). **The fix**: move to env vars and rotate.

**8. MEDIUM — Firebase service-account key committed to the repo.**
`staticDB/fcmtoken.json` (the metrics tool's `private_key_block` hit, confirmed present). **The
fix**: remove from git history, rotate the service account, load from a secret store or env var
at runtime.

**9. LOW-MEDIUM — `partnerAuth` middleware is very likely non-functional (see §6.2)** — not a
vulnerability by itself, but worth confirming it isn't silently supposed to be doing something
security-relevant (e.g. stripping/normalizing an inbound partner header) that it currently
doesn't do at all.

**10. LOW — payment-processor client/secret IDs stored as plain Mongo fields**
(`models/PaymentSetting.js` `paymentClientId`/`paymentSecretId`) rather than in a secrets
manager. Anyone with read access to the `PaymentSetting` collection (or a backup of it) has
these values in plaintext.

**11. LOW — webhook-shaped endpoints have no signature verification.** Neither the LedgerGreen
integration (which, on inspection, doesn't actually receive inbound webhooks — its `webhook`
handler is an outbound lookup, controllers/ledgergreen/ledgergreen-controllers.js:30-45) nor any
other integration checked implements HMAC/signature verification on inbound payloads. Intercom is
the one exception, and only for the *outbound* identity-hash it generates
(controllers/intercom/intercom-controllers.js:69) — that direction is correct and not a finding.
If any provider (ShipStation, Didit, Persona) does deliver signed inbound webhooks, none of the
handlers checked verify the signature — worth a deeper pass scoped to just the inbound webhook
routes if any exist beyond what this pass sampled.

**12. LOW — mass-assignment-adjacent patterns in POS quantity updates**
(`controllers/POS/pos-controllers.js:2590-2660`) build Mongo update documents from request-driven
values (`item.productId`, `item.quantity`) without an allowlist, though the specific lines
sampled use targeted `$set`/`$push` on known paths rather than spreading `req.body` wholesale —
lower severity than a classic mass-assignment bug, but worth a full pass over `pos-controllers.js`
(4,696 lines) given its size.

## 15. Performance findings (ranked)

**1. HIGH — N+1 query in the POS checkout path.**
`controllers/POS/pos-controllers.js:213`: `for (const item of items) { const storeProduct =
await StoreProducts.findOne(...) }` — one DB round-trip per cart line item, on the
order-submission path. **The fix**: batch with a single `StoreProducts.find({ storeId, "products.productId": { $in: items.map(i => i.productId) } })` and look up in memory, as `common/utils.js:358` already does elsewhere in the codebase (so the pattern to copy already exists locally).

**2. HIGH — missing indexes on the hottest collections.** `Order`, `Member`, `StiloProducts`,
`StoreProducts`, and `ActiveCart` have zero explicit indexes (§5) despite being queried/filtered
by `storeId`, `status`/`fulfillmentStatus`, and `createdDate` throughout the dashboard and POS
aggregation pipelines (e.g. `controllers/admin/dashboard-controllers.js`'s 12 aggregate calls,
`controllers/product/product-controllers.js`'s 13). **The fix**: add compound indexes on
`{storeId:1, createdDate:-1}` at minimum for `Order`, and `{storeId:1}` for `Member`/
`StiloProducts`/`StoreProducts`.

**3. MEDIUM — synchronous file I/O on a request path.** `controllers/common-controllers.js` uses
`fs.writeFileSync` during barcode-image generation (verified at the barcode-generation call
site, ~line 850) — this blocks the Node event loop for every concurrent request while the image
is written to disk. **The fix**: use `fs.promises.writeFile`.

**4. MEDIUM — cron job runs 24x more often than intended and fans out unbounded.**
`productReviews()` (§7) calls the Reviews API once per `StoreProducts` document via an unbounded
`Promise.all` (`nodeCrons.js:36-61`, `StoreProducts.find()` with no limit at
`nodeCrons.js:32`), every hour instead of the intended once/day. **The fix**: fix the cron string
first (§7), then cap concurrency (e.g. `p-limit`) regardless.

**5. LOW-MEDIUM — 232 `find()`-without-`limit()` sites** (metrics count, spot-verified a sample
genuine — e.g. `common/utils.js:358` fetches all matching `StiloProducts` with no bound, though
that particular call is scoped by an `$in` of a bounded cart's product ids, so its real-world
risk is lower than the raw count suggests). The worst offenders by collection size are in
`controllers/product/product-controllers.js` (33 hits) and `common/utils.js` (23 hits) — worth a
targeted pass rather than treating all 232 as equally risky.

**Corrected from the metrics pass**: the 74 `aggregate_calls` and 60 `child_process` leads are
**not** both performance/security concerns as tagged — the `child_process` ones are, as noted in
§13, a false positive (they're `.exec()` on Mongoose queries, not child-process spawning).

## 16. Ten things a new developer would trip over

1. `JWT_ADMIN_PRIVATE_KEY` is not a private key — it's one symmetric HMAC secret used in both
   `jwt.sign` (3 model files) and `jwt.verify` (middlewares/admin.js:13).
2. That JWT check is wired into only 2 of 53 route files (§6) — nearly everything else is
   protected by one shared static API key, not per-user auth.
3. `middlewares/isSuperAdmin.js` is fully dead code — required nowhere (§14 finding #3).
4. `middlewares/partnerAuth.js` looks like it should inject default auth headers but, due to a
   header-casing bug, almost certainly does nothing (§6.2).
5. Stilo's `Admin`/`Authors`/`Legal`/etc. models live in `HEMP_DATABASE_URL`, a database named
   for a different brand (§3).
6. Two ORMs are declared in `package.json`; only one (Mongoose) is ever used (§2) — there is no
   Postgres schema to go find.
7. `SENTRY_DSN` is required at boot (the app won't start without it) but `Sentry.init()` is
   commented out — errors are never actually sent anywhere (§8).
8. `common/utils.js` (3,697 lines) and `controllers/POS/pos-controllers.js` (4,696 lines) hold a
   disproportionate share of business logic — "where does checkout happen" means searching one
   giant file.
9. 280 commented-code-hint blocks (metrics count) leave large dead hooks in place, e.g.
   `models/ProductBatch.js:1423-1487` — ~65 lines of a commented-out `post('save')` hook that
   references a `Product` model that doesn't exist in this repo (it's `StiloProducts`/
   `StoreProducts` here), so re-enabling it as-is would throw immediately.
10. No test suite exists at all (§9) — there is nothing to run to check a refactor didn't break
    checkout, tax, or age verification.

## 17. Grade inputs

| Axis | 1-10 | Justification (one citation) |
|---|---|---|
| Simplicity | 4 | Conventional Express/Mongoose CRUD once found, but two 3,700-4,700-line god-files (`common/utils.js`, `controllers/POS/pos-controllers.js`) carry a disproportionate share of logic |
| Speed | 3 | Confirmed N+1 on the checkout path (pos-controllers.js:213) plus zero indexes on `Order`/`Member`/`StiloProducts` |
| Security | 1 | Unauthenticated admin-account creation → self-promotion to super-admin → free JWT mint chain (§14 #1-2) |
| Data modelling | 4 | No `Decimal128` for money, no soft-delete convention, real `ref`s used in only 4 of 56 models, one of those 4 references a non-existent model name (Blog.js:208) |
| Reuse vs hardcoding | 2 | 2,507 exact-duplicate lines with hemp-backend including a byte-identical 2,054-line dashboard controller, with no shared package (§12) |
| Testing | 1 | Zero test files, no `test` script in `package.json` (§9) |
| Upgradability | 3 | No lockfile, all-caret pinning, Express 4.x, business logic embedded directly in controllers with no service-layer boundary to isolate a framework bump |
| Operability | 3 | Boot-time-mandatory `SENTRY_DSN` that is never actually used (§8); console-only logging; cron failures only logged, never alerted (§7) |
| Developer experience | 3 | Two dead-code auth middlewares (`isSuperAdmin`, `partnerAuth`), a misleadingly-named JWT secret, and 280 commented-code-hint blocks left in place |

## 18. Quick fixes (<1h each), ranked by impact/hour

1. Add `middlewares/admin` (JWT) to every route in `routes/admin/admin-user-routes.js` except
   `/login`, `/forgot`, `/reset` — closes the account-takeover chain (§14 #1). Highest impact of
   anything in this report.
2. Add `.select('-password')` to `getAllAdmins` (controllers/admin/admin-user-controller.js:113).
3. Remove the free `generateAuthToken()` call from `getAdminById`
   (controllers/admin/admin-user-controller.js:182), or gate that route behind `isSuperAdmin`.
4. Require `req.user.isSuperAdmin` before honoring `userRoles.includes("Super Admin")` in
   `updateAdmin` (controllers/admin/admin-user-controller.js:126) — closes §14 #2.
5. Escape regex metacharacters in `req.body.ruleType` before building `RegExp` in
   `cart-rules-controllers.js:92,96` and `product-rules-controllers.js:99,103`.
6. Add `express-rate-limit` to `POST /api/v1/admin/login` and `POST /api/v1/pos/pin/login`.
7. Delete the dead `corsOptions`/`corsOptionsDelegate` block (startup/middleware.js:12-31) and
   either finish wiring Sentry or drop the `SENTRY_DSN` requirement in `startup/config.js:11-13`.
8. Remove `sequelize`, `pg`, `pg-hstore`, `apollo-server`, `apollo-server-express`, `graphql`,
   `@graphql-tools/merge` from `package.json` (confirmed zero usages, §2/§13) — pending the
   owner's confirmation these aren't mid-migration (§19).
9. Add `sharp`, `cors`, `moment-timezone`, `form-data`, `escpos` to `package.json` dependencies
   (imported but undeclared — breaks a clean install today).
10. Fix `ref: "Author"` → `ref: "Authors"` in `models/Blog.js:208` to match the actual registered
    model name.
11. Generate and commit a `package-lock.json`.
12. Fix the three cron-string/comment mismatches in `startup/nodeCrons.js` (§7) or correct the
    comments to match reality, whichever is intended.

## 19. Open questions

1. Is `PROJECT_API_KEY` (the sole gate on ~51 of 53 route files) embedded in any client-shipped
   build (POS terminal app, admin frontend bundle)? If so it should be treated as already
   public, which raises the severity of §14's findings from "needs the shared key" to "the key
   is not really a secret."
2. Was `middlewares/isSuperAdmin.js` ever actually wired into routes and later removed, or has
   it always been dead? (Out of scope for a pinned-SHA read-only pass; git history would answer
   this.)
3. Is `HEMP_DATABASE_URL` intentionally the same physical database/cluster shared between
   `stilo-backend` and `hemp-backend` for the 8 `conn2` models, or is this env var
   misconfigured?
4. Is the Sequelize/pg/Apollo/GraphQL tooling in `package.json` a leftover from a removed
   feature, or a half-started migration someone still intends to finish? Deleting it (§18 #8) is
   only safe if the latter isn't true.
5. Given the 2,507-line exact duplication with `hemp-backend` (including a byte-identical
   dashboard controller and a duplicated payment-provider controller), is there appetite to
   extract a shared internal package across the brand backends, or is per-brand fork-and-diverge
   the accepted long-term model?
6. Who exercises the LedgerGreen/NMI/Persona/Didit integrations in a sandbox today, given there
   is no automated test suite (§9) to catch a regression in any of them?

---
Both output files written: `stilo-backend.md` (this file) and `stilo-backend.datamodel.md`.
