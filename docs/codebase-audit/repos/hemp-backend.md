# hemp-backend — audit

Repo: `/Users/jt/hyper-tech/hemp-backend` @ `4725d37585b0cfd01a64089df63a8e3c2b95680e`
(single commit, "Initial commit", Abhi Saini, 2026-09-09 — the git history is a squash, so
`git blame`/`git log` carry zero forensic value for this repo).
All paths relative to the repo root. Full schemas: `hemp-backend.datamodel.md`.

Corrections to the mechanical metrics pass, up front:
- **models: 56, not 55.** It missed `models/BlazeUser.js:19` (destructured `model(...)`).
- **route handlers: 443 registered / 434 distinct METHOD+PATH, not 425.** It missed
  `routes/admin/hemp-blogs-routes.js` (6 handlers, registered on a router variable named
  `hempBlogRoutes`, not `router`), and it did not account for `routes/admin/store-routes.js`
  and `routes/admin/retailer-product-routes.js` each being mounted at **two** prefixes
  (`startup/routes.js:104` + `:125`, and `:126` + `:127`).
- **"419 unguarded" is misleading but the conclusion is worse than it says.** There *is* a
  global gate (`startup/middleware.js:59`), but it is a single static shared API key. Only
  **4** of 434 routes require a user identity. See §6.
- **`morgan`, `nodemailer`, `twilio` are declared and never imported** — confirmed (§13). The
  "imported but not declared: fromInventory" lead is a false positive (destructuring, not a
  require); **`uuid` is real** (`controllers/admin/product-traits-controllers.js:8`).

---

## 1. Purpose

A single Express/MongoDB monolith serving **five different consumer surfaces at once**:

| Surface | Mount | Evidence |
|---|---|---|
| Hemp customer storefront | `/api/v1/product`, `/api/v1/cart`, `/api/v1/order`, `/api/v1/member`, `/api/v1/blog`, `/api/v1/sitemap` | `startup/routes.js:88-121` |
| Admin back office | `/api/v1/admin/*` (dashboard, banners, promotions, regions, inventory, SEO, roles, blogs, authors, stores) | `startup/routes.js:92-141` |
| Retailer/store back office | `/api/v1/admin/retailer/*`, `/api/v1/admin/store/*` | `startup/routes.js:126-137` |
| Point of sale | `/api/v1/pos` | `startup/routes.js:123`, `controllers/POS/pos-controllers.js` |
| Third-party webhooks | `/api/v1/shipstation`, `/api/v1/ledgergreen/webhook`, `/api/v1/textVolt` (Onfleet), `/api/v1/agechecker`, `/api/v1/persona`, `/api/v1/didit` | `startup/routes.js:113-119`, `routes/ledgergreen/ledgergreen-routes.js:6` |

Outbound it calls, from code (not the README): Blaze POS (`common/utils.js:11,584-620`),
Alpine IQ (`:14`), Persona (`:28`), Intercom (`:29`), Klaviyo (`:30`), TextVolt SMS
(`:31-32`), LedgerGreen (`:34`), ShipStation (`:35`), a reviews service (`:36`), AgeChecker
(`:37`), LeisurePay/Maverick/NMI card processing (`:38-44`), USPS (`:50`), Didit (`:53`),
Google Street View (`:623-661`), AWS S3 (`middlewares/awsBucket.js`), SendGrid
(`common/sendGridFunction.js`), Firebase FCM (`common/fcmNotifications.js`), Sentry, a
promotion engine (`controllers/cart/cart-controllers.js:59-273`), and — hardcoded — the
Hyperwolf **production** and Stilo **staging** blog APIs
(`controllers/admin/authors-controllers.js:414,433`).

The `package.json` name is `"hyperwolf-blaze-middleware"` (`package.json:2`) and the git
remote is `techindustan/hyperwolf-hemp-backend` (`package.json:79`) — the package name is a
leftover from a different service.

## 2. Runtime & framework

| Item | Declared | Reality |
|---|---|---|
| Node | `engines.node: ">=12.x"` (`package.json:12`) | Node 12 is EOL (Apr 2022). CI runs Node 18 (`.github/workflows/security.yml:24`), which is itself EOL (Apr 2025). `helmet@8` (`package.json:35`) requires Node ≥18, so the declared floor cannot actually install. No `.nvmrc`, no Dockerfile. |
| Framework | `express ^4.22.1` | Express 4 is in maintenance; 5.x is current. |
| DB / ORM | `mongoose ^5.11.15` (`package.json:41`) | Mongoose 5 is **end of life**. The declared floor predates the 5.13.20 fix for CVE-2023-3696; the caret range plus **no lockfile** means the resolved version is whatever npm picks at deploy time. |
| TypeScript | none | Plain CommonJS, no JSDoc types, no `"use strict"`. |
| Pinning | 45 caret + 2 exact (`fs: "0.0.1-security"`, `msg91: "0.0.6"`) | `package-lock.json` is **gitignored** (`.gitignore:3`). Deploy runs `npm i` on the server (`.github/workflows/node.js.yml:22`), so every deploy can resolve different transitive versions. |
| Known-vulnerable majors in use | `axios ^0.21.4` (0.x EOL; CVE-2023-45857 affects all <1.6.0), `jsonwebtoken ^8.5.1` (CVE-2022-23529/23540/23541 fixed only in 9.0.0 — a `^8` range can never reach it), `@sentry/node ^6.19.7` (v6 EOL), `firebase-admin ^9.7.0` (v9 EOL, 13.x current), `request ^2.88.2` (deprecated since 2020, still used at `common/utils.js:20,633`), `multer ^1.4.2` (1.x deprecated). |

`fs: "0.0.1-security"` (`package.json:34`) and `path: "^0.12.7"` (`:49`) declare npm packages
that shadow Node builtins. `fs@0.0.1-security` is a placeholder squat package with no code.

## 3. Entry points & boot

`index.js` (26 lines) is the whole boot:

```
index.js:8   startup/config()      — throws unless DATABASE_URL, PUBLIC_TOKEN,
                                     ALPINE_BASE_URL, SENTRY_DSN are set. Four of the 91
                                     env vars are checked; JWT_ADMIN_PRIVATE_KEY and
                                     PROJECT_API_KEY — the two that gate all auth — are not.
index.js:12  startup/middleware(app)
index.js:13  await startup/db()    — ONE mongoose.connect (startup/db.js:6). No multi-
                                     connection / global.dbConnections pattern here.
index.js:14  startup/routes(app)
index.js:18  startup/nodeCrons()   — only when !process.env.IS_DEVELOPMENT
index.js:21  app.listen(PORT || 3046)
```

Startup side effects and global mutable state:

- **`startup/db.js:7` logs the full Mongo connection string** (`Connected to MongoDB: ${db}`)
  to stdout on every boot — credentials into the PM2 log file.
- **`Sentry.init()` is called 19 times** across the codebase (`startup/middleware.js:31`,
  `middlewares/async.js:7`, `common/utils.js:25`, `common/emailService.js:7`, and 15 more).
  Sentry v6 keeps one global hub, so the **last** init at require-time wins — and that is a
  bare `Sentry.init({dsn, tracesSampleRate: 1.0})` with no Express integration. The tracing
  wiring set up at `startup/middleware.js:33-38` is silently discarded. All 19 use
  `tracesSampleRate: 1.0`, i.e. 100% trace capture in production.
- `middlewares/async.js:5` constructs a **second, unused Express app** at module load purely
  to hand to a duplicate Sentry integration.
- `startup/middleware.js:61` registers `Sentry.Handlers.errorHandler()` **before**
  `startup/routes.js` runs (`index.js:12` then `:14`). An Express error handler registered
  before the routes it should protect never fires. Sentry sees no route errors.
- `common/utils.js:1183`, `controllers/*` capture 19 module-level `process.env` reads at
  require time, so no config can be changed without a restart (fine) — but
  `startup/middleware.js:8` reads `ALLOW_ORIGIN` into a variable that is then never used.
- `middlewares/multiFileUpload.js:5` declares a module-level `let fileUploadPath = []` that is
  never read or written — shared-mutable-array shaped dead code.

## 4. Directory map

| Dir | Role | .js files | lines |
|---|---|---|---|
| `controllers/` | All business logic. 53 files, 8 of them >1,500 lines. | 53 | 29,855 (80% of source) |
| `models/` | 56 Mongoose schemas, almost no behaviour. | 56 | 2,095 |
| `common/` | Shared helpers; `utils.js` alone is 2,340 lines and is the de-facto integration layer for 14 vendors. | 10 | 3,050 |
| `routes/` | 54 thin route files; 2 of them are never mounted. | 54 | 803 |
| `middlewares/` | 13 files: 2 real auth gates, 3 S3 wrappers, 3 multer configs, 1 dead 404 stub. | 13 | 325 |
| `emailTemplates/` | 4 hand-written HTML-in-JS templates — **three of them Stilo-branded** (§12). | 4 | 633 |
| `startup/` | config/db/middleware/routes/cron bootstrap. | 5 | 326 |
| `staticDB/` | 11 JSON files: roles, permissions, delivery slots, KML polygons — **and a live Google service-account private key** (§8). | 0 | 96 KB |
| `assets/`, `uploads/`, `views/` | Served publicly via `express.static` ×5 (`startup/middleware.js:48-52`). `views/` contains no Pug templates despite `app.set('view engine','pug')` at `:56`. | 0 | — |

## 5. Data model summary

56 models, 2,095 lines. Full field-by-field detail is in `hemp-backend.datamodel.md`.

- **Ten most central**: `HempProducts`, `Order`, `ActiveCart`, `Member`, `Promotion`,
  `ProductBatch`, `RetailerProducts`, `Store`/`Retailer`, `RoleAndPermissions`,
  `Miscellaneous`. All relations are **string-id joins resolved in application code** — there
  are exactly two `ref:` declarations in the entire schema layer
  (`models/SubProductTraits.js:9`, `models/HempBlogs.js:40`), and the second points at a model
  registered under a different name (`"Author"` vs `mongoose.model("Authors", ...)` at
  `models/Authors.js:46`), so `populate()` on it would throw.
- **Ids**: every entity carries a Mongo `_id` *and* an application string id generated by
  `common/utils.js:222-228` using `Math.random()`. The same non-cryptographic generator
  produces **password-reset tokens** (`common/utils.js:213-219`, used at
  `controllers/admin/admin-user-controller.js:415` and `controllers/member/member-controllers.js:482`).
- **Money**: `Number` (JS double), in **dollars**, never cents.
  `controllers/cart/cart-controllers.js:2837` assigns `Math.max(x,0).toFixed(2)` — a **String** —
  to `member.walletAmount`, a `Number` field.
- **Time**: hand-rolled `createdDate`/`updatedDate` epoch-ms `Number` on almost every model;
  `String` on `models/ErrorLogs.js:8-10` and `models/FhlScript.js:13-17`; `Date` on
  `models/Promotions.js:19-20`. Mongoose `timestamps:` is used in exactly one model
  (`models/RoleAndPermissions.js:44`).
- **Soft delete**: none. No `deletedAt`/`isDeleted` field exists anywhere; deletes are hard
  (`controllers/admin/admin-user-controller.js:308,523`).
- **Multi-tenancy key**: `retailerId` (this fork) / `storeId` (the Stilo fork). Plain `String`,
  **never indexed**, and **never derived from the caller** — it arrives in `req.body`/`req.query`
  (e.g. `controllers/POS/pos-controllers.js:1510`, `controllers/member/member-controllers.js:1178`).
- **Indexes vs queries — the headline**: 6 explicit `.index()` calls in the whole repo
  (`models/ActiveCart.js:41,48`, `models/HempBlogs.js:69-71`, `models/StoreCoordinates.js:23`)
  plus 33 implicit unique indexes. **`models/Order.js` declares zero indexes**, yet `Order` is
  queried by `orderId` at 21 call sites, `memberId` at 10, and range-scanned on `createdDate`
  by all 12 dashboard aggregations. `Member` is queried by `memberId` ×16 and `email` ×11;
  only `phone` is indexed (`models/Member.js:13`).
- **Schema defects**: `require: true` instead of `required: true` in 8 places
  (`models/ActiveCart.js:6,8,9,26,27`, `models/Category.js:6,13`, `models/WebCategory.js:6`) —
  silently ignored by Mongoose; `deafult` instead of `default` ×3
  (`models/HempProducts.js:51-53`); `shippingCharges` declared twice
  (`models/ActiveCart.js:14,16`); `sku: {default: '', unique: true}`
  (`models/HempProducts.js:7`) — the second SKU-less product fails with E11000.

## 6. API surface

**Mounting.** `startup/routes.js:79-144`: 6 app-level routes plus 54 `app.use(prefix, router)`
mounts giving **443 router handlers / 434 distinct METHOD+PATH**.
`routes/admin/store-routes.js` is mounted twice (`:104`, `:125`) and
`routes/admin/retailer-product-routes.js` twice (`:126`, `:127`).
`routes/admin/retailer-routes.js` (a complete retailer login/forgot/reset surface) and
`routes/weedmaps/weedmap-routes.js` are **never mounted** — dead code, along with their
controllers.

**Auth chain, traced from `index.js`.** There are exactly three gates:

1. `startup/middleware.js:58` → `middlewares/partnerAuth.js`. This is a **no-op with a bug**.
   Its condition `if (!req.headers["Authorization"] || req.headers["authorization"])`
   (`partnerAuth.js:6`) is *always true* — Node lowercases inbound header names, so
   `req.headers["Authorization"]` is always `undefined`. It then writes
   `req.headers.Authorization = process.env.AUTH_TOKEN` and
   `req.headers["X-API-KEY"] = process.env.PARTNER_KEY` under **capitalised** keys, which
   `req.header()` (which lowercases) never reads. Net effect: two junk keys on every request
   object and nothing else.
2. `startup/middleware.js:59` → `middlewares/authMiddleware.js:18`. Requires header
   `x-api-key === process.env.PROJECT_API_KEY` — **one static shared secret for the whole
   platform**, necessarily embedded in every browser client — on every path except an exact
   list of six (`authMiddleware.js:15`): `/`, `/ping`, `/api/v1/shipstation/shipped`,
   `/api/v1/shipstation/order`, `/api/v1/shipstation/delivered`, `/api/v1/nmi/payment`.
3. Per-route JWT: `middlewares/admin.js` + `middlewares/isSuperAdmin.js`, applied to
   **4 routes only** — `routes/admin/admin-user-routes.js:19-22`. Verified by
   `grep -arnE "router\.(get|post|put|patch|delete)\([^)]*,\s*(admin|isSuperAdmin|auth)\b" routes/`
   → 4 hits, and `grep -arn "router.use" routes/` → **0 hits**.

`grep -arn "jwt.verify" controllers/` returns **nothing**. `grep -arn "req\.user" controllers/`
returns **nothing**. No controller in this repo ever inspects who is calling.

**JWT.** Signed in four models — `models/Admin.js:22`, `models/RetailerUser.js:34`,
`models/StoreUser.js:35`, `models/Retailer.js:48` — all with the **same** secret
`process.env.JWT_ADMIN_PRIVATE_KEY`, HS256 (jsonwebtoken default), `expiresIn: "2d"`, no
refresh token, no revocation list. `models/BlazeUser.js:5` falls back to the literal
`"private"` if `JWT_USER_PRIVATE_KEY` is unset (that path is dead — `.method` typo at
`BlazeUser.js:16` means the method is never attached). Because one secret covers four identity
types, a `StoreUser` token is signature-valid against `middlewares/admin.js:13`;
`middlewares/isSuperAdmin.js:11` exists precisely to compensate, and it guards 4 routes.

**Roles.** Free strings in an array on `Admin.userRoles`, joined by *name* to
`RoleAndPermissions.role.roleName` (`controllers/admin/admin-user-controller.js:70-72`).
`isSuperAdmin` is a boolean on four different models. Permissions are merged into the login
response (`admin-user-controller.js:96-101`) and then **never checked server-side** — they are
purely a UI hint. `grep` finds 34 hardcoded role-string literals across 15 files.

**Validation.** Joi is declared and used in **7 model files** as route middleware
(`models/Brand.js:31`, `models/Cannabinoid.js:30`, `models/Category.js:33`,
`models/Strain.js:35`, `models/MainBrand.js:18`, `models/MainCannabinoid.js:21`,
`models/MainStrain.js:23`, `models/Employees.js:13`, `models/Terpenoids.js:17`,
`models/ResetRequest.js:16`) — i.e. on catalogue/SEO writes. **The cart, order, member,
wallet, POS and payment endpoints have no schema validation at all**; they destructure
`req.body` and use it (`controllers/cart/cart-controllers.js:2434-2462`,
`controllers/POS/pos-controllers.js:403-405`).

**Routes reachable with NO credential whatsoever** (verified by tracing `excludedRoutes`):

| Route | Handler | What it does |
|---|---|---|
| `GET /` | `startup/routes.js:80` | version banner |
| `GET /ping` | `controllers/common-controllers.js:1229` | opens a **new** Mongo connection per call and never closes it; echoes `err.message` back |
| `POST /api/v1/nmi/payment` | `controllers/common-controllers.js:334` | **charges a card** (§14 #2) |
| `POST /api/v1/shipstation/order` | `shipstation-controllers.js:130` | proxies attacker-chosen query params to ShipStation with the merchant API key |
| `POST /api/v1/shipstation/shipped` | `shipstation-controllers.js:143` | mutates `Order.emailStatus`, `trackingId` |
| `POST /api/v1/shipstation/delivered` | `shipstation-controllers.js:211` | mutates `Order.emailStatus` |

The other **428** routes are reachable by anyone holding the single static `x-api-key`, which
every browser client must carry.

**Pagination**: `?limit` + `?skip` (66 call sites each), defaulting to 10/0, e.g.
`controllers/admin/admin-user-controller.js:179-180`. **No maximum** — `?limit=1000000` is
honoured. Four endpoints use `?page` and three use `?per_page` instead.

**Error shape**: `{ message: string }` in 170 places, `{ status, message }` in 4, one
`res.json`. `middlewares/async.js:26` converts **every** thrown exception into
`400 {message: ex.message}` — so internal errors are reported as client errors and the raw
exception text is returned to the caller. Status distribution across `controllers/`:
`400` ×543, `404` ×62, `200` ×60, `500` ×28, `201` ×3. There is no `401`/`403` outside the two
auth middlewares.

**Versioning**: `/api/v1` prefix only; no content negotiation, no deprecation mechanism.
`staticDB/apiVersion.json` is echoed in the root banner (`startup/routes.js:81`) alongside a
**hardcoded** date string `2026.06.01`.

## 7. Background jobs

`startup/nodeCrons.js:65-90`, six schedules, all six-field (seconds-first) except the last.
**The comments and the README both describe the wrong frequency for five of six.**

| Expression | Actual | Comment says | README says | Job |
|---|---|---|---|---|
| `0 0 */3 * * *` (`:68`) | every **3 hours** | "every 3 day" | "every 3 days" | `generateBlazeRetailToken()` |
| `0 0 */2 * * *` (`:71`) | every **2 hours** | "every 2 day" | "every 2 days" | `removeFiles()` |
| `0 0 */1 * * *` (`:74`) | every **hour** | "every 1 day" | "daily" | `productReviews()` |
| `0 */10 * * * *` (`:77`) | every 10 min | "every 4 minutes" | "every 10 minutes" | `resetHoldQuantityFunction()` |
| `0 */60 * * * *` (`:83`) | hourly (minute 0 only) | "every minutes" | "hourly" | `updateDeliveryStatus()` |
| `*/20 * * * *` (`:86`) | every 20 min | "every 10 minutes" | "every 20 minutes" | `checkCartStatus()` |

- **None of the six has an overlap guard.** `node-cron` fires on schedule regardless of
  whether the previous invocation finished. `resetHoldQuantityFunction`
  (`common/utils.js:1026-1108`) is a nested loop — for each active cart, for each cart line,
  `await HempProducts.findOne(...)` (`:1061`) — so its runtime scales with total open carts ×
  lines. Two overlapping runs both compute `newInventoryQuantity` in JS and `$set` it
  (`:1074`), losing each other's writes.
- `productReviews()` (`nodeCrons.js:22-59`) does `HempProducts.find()` with **no filter and no
  limit** (`:32`), then `Promise.all(products.map(...))` — an **unbounded parallel fan-out** of
  one external HTTP call plus one `product.save()` per product, every hour. Its inner
  `catch (error) {}` at `:52-53` is **empty**, so every failure is invisible.
- Failure logging is `console.log` only (`:17`, `:57`); nothing routes to Sentry.
- `deleteExpiredActiveCarts` is imported (`:2`) and its schedule is commented out (`:80-82`) —
  expired carts are never deleted, and the "held quantity" they pin is only released by the
  10-minute job.
- The cron `store: 'hyperwolf'` parameter at `:26` means the **Hemp** service pulls reviews for
  the **Hyperwolf** store.

## 8. Third-party integrations & secrets

Every credential is an env var except one. All 91 env vars referenced in code are present in
`.env.example`, and all 91 values there are `<placeholder>` form — that file is clean.

| Service | Wrapper | Credential source | Webhook signature verified? |
|---|---|---|---|
| NMI / LeisurePay / Maverick (cards) | `common/utils.js:808-834` | `LEISUREPAY_SECURITY_KEY` / `MAVERICK_SECURITY_KEY`; which one is chosen is read from a Mongo document (`utils.js:810`) | n/a — **no auth on the endpoint at all** |
| ShipStation | `controllers/shipstation/shipstation-controllers.js:107-128` | `SHIPSTATION_API_KEY` | **No.** No HMAC, no shared secret, 3 of 4 endpoints unauthenticated |
| LedgerGreen | `controllers/ledgergreen/ledgergreen-controllers.js` | `LEDGERGREEN_SECRET_KEY` | **No.** `routes/ledgergreen/ledgergreen-routes.js:6` `/webhook` has no verification |
| Onfleet (via TextVolt) | `controllers/textVolt/textVolt-controllers.js:2` | `ONFLEET_API_ID` | **No.** |
| AgeChecker / Persona / Didit (identity) | `controllers/agechecker/`, `persona/`, `didit/` | `AGE_CHECKER_BASE_URL`, `PERSONA_TOKEN`, `DIDIT_API_KEY` | **No.** `agechecker/verify` sets `isVerified = true` from request body (§14 #4) |
| Alpine IQ | `common/utils.js:51`, `controllers/alpine/` | `ALPINE_IQ_KEY` | n/a |
| Blaze | `common/utils.js:584-620` | `BLAZE_RETAIL_AUTH_EMAIL` + `..._PASSWORD`, token cached in `Miscellaneous` | n/a |
| Klaviyo, Intercom, SendGrid, TextVolt, USPS, Google Street View, Sentry | `common/utils.js:26-53`, `common/sendGridFunction.js` | env vars | n/a |
| AWS S3 | `middlewares/awsBucket.js:2-9`, `awsBucketProduct.js`, `awsBucketBarCode.js` | `AWS_ACCESS_KEY` / `AWS_SECRET_ACCESS_KEY` | — |
| Firebase FCM | `common/fcmNotifications.js` | **committed private key file** ↓ | — |

**`staticDB/fcmtoken.json` is a live Google Cloud service-account key**, tracked in git
(`git ls-files staticDB/` confirms). It contains a `private_key` PEM block
(`staticDB/fcmtoken.json:5`), `private_key_id`, `client_email` and `client_id` for project
`hyperwolf-firebase`. Anyone with repo read access holds that identity. **Revoke it.**

Also worth flagging: `middlewares/awsBucket.js:22`, `awsBucketProduct.js:29` and
`awsBucketBarCode.js:28` all upload with `ACL: 'public-read'`, and the endpoint that uploads
**customer government-ID photographs** (`controllers/common-controllers.js:39-73`,
`uploadIdProof`) uses that same wrapper. Driver's-licence images are world-readable by URL.

## 9. Tests

**Zero.** No test framework in `package.json` (no jest/mocha/vitest/supertest), no `test`
script (`package.json:5-10` defines only `start`, `dev`, `commit`, `lint:commit`), no `*.test.js`
or `*.spec.js` file anywhere, no `__tests__` directory. Coverage in words: nothing is covered.
The only automated quality gate in the repo is commitlint on commit *messages*
(`commitlint.config.js`, `package.json:72-76`).

## 10. Build & deploy

- **No Dockerfile, no PM2 ecosystem file, no infra-as-code.** Two GitHub workflows only.
- `.github/workflows/security.yml` runs `npm audit`, gosec, bandit, dart, gradle, swiftlint and
  composer against a Node repo. It triggers **only on push to branch
  `feat_roles_permissions`** (`:4`) — not `main`, not `development` — so on the deployed branch
  it never runs. When it does run it executes `npm ci --legacy-peer-deps` (`:27`), which
  **requires a lockfile**; `package-lock.json` is gitignored (`.gitignore:3`), so the job cannot
  succeed. `npm audit --audit-level=critical` (`:31`) also only fails on *critical*.
- `.github/workflows/node.js.yml` deploys on `workflow_run: types: [completed]` of that audit
  (`:3-6`) with **no `conclusion == 'success'` guard**, so it deploys whether the audit passed,
  failed, or errored.
- The deploy step (`:18-23`) SSHes to `api.direct.stage.hyperwolf.com`, runs `git stash`
  (silently discarding anything on the server), `git pull origin development`, `npm i`,
  `pm2 restart`. So: the branch that *triggers* the pipeline is not the branch that gets
  deployed, and `npm i` without a lockfile re-resolves dependencies on every deploy.
- **There is no production deploy path in this repo** — only staging. How production is
  updated is unknown (§19).
- **Environment separation is broken in code**, not just in CI:
  `controllers/admin/authors-controllers.js:414` posts to
  `https://hyperwolf.prod.ths.agency/...` (production) and `:433` to
  `https://api.stage.stilosupply.com/...` (**staging**) in the same function, with this
  service's own `PROJECT_API_KEY` and `AUTH_TOKEN` sent in headers to the staging host (`:442-443`).
- **Logging**: `console.log` at 128 sites in 35 files, including `console.log("Login check",
  loginCheck)` (`controllers/member/member-controllers.js:349`), which prints the full member
  document — **bcrypt password hash included** — to the PM2 log on every login attempt.
  `morgan` is declared but never wired up. No request ids, no structured logs.
- **Monitoring**: Sentry, effectively broken (§3): the error handler is registered before the
  routes, and the last of 19 `Sentry.init()` calls wins and lacks the Express integration.

## 11. Hardcoded values

Counts from `grep -a` over `--include='*.js'`:

| Kind | Count | Notes |
|---|---|---|
| absolute `http(s)://` literals | 36 | 25 in email templates, 11 in logic |
| role-string literals | 34 in 15 files | `"admin"` ×32, `"Super Admin"` ×4, `"ADMIN"` ×3 |
| opaque 20-char vendor ids | 22 matches, 3 distinct real ids | see below |
| literal phone numbers | 4 | |
| literal email addresses | 1 | |
| `Miscellaneous` magic keys | 8 distinct strings | `'payment'`, `'signupStatus'`, `'blazeToken'`, `'productDisclaimer'`, `'faq'`, `'notificationsettings'`, `'adminCategoryDetails'`, `'refund'` |

Worst 10, with the config-vs-data distinction:

| # | Value | Location | Should be |
|---|---|---|---|
| 1 | Blaze "safe" inventory id `odkEgmqfW3MDJJedc3QJ` | `controllers/common-controllers.js:130`, `controllers/admin/retailer-product-controllers.js:382,1585`, `controllers/POS/pos-controllers.js:1218,1514` | **config** — `SAFE_INVENTORY_ID` already exists (`common/utils.js:13`) and is ignored at these 5 sites |
| 2 | Second inventory id `8obM6G8eHYSkNXSb8rp1` | `controllers/admin/retailer-product-controllers.js:385,1588` | **config** |
| 3 | Prod endpoint `https://hyperwolf.prod.ths.agency/api/v1/admin/blogs/author/update` | `controllers/admin/authors-controllers.js:414` | **config** |
| 4 | Staging endpoint `https://api.stage.stilosupply.com/api/v1/admin/blogs/author/update` | `controllers/admin/authors-controllers.js:433` | **config** — and it is a *staging* host called from production code |
| 5 | Debug telemetry sink `http://127.0.0.1:7779/ingest/<uuid>` with `X-Debug-Session-Id: 8e14fc` | `controllers/cart/cart-controllers.js:1802-1836` | **delete** — leftover AI-agent instrumentation firing on every `prepareCart`, alongside 26 `dbg*` timing variables in the same function |
| 6 | SMS sender `+13238801420` | `common/utils.js:737` | **config** |
| 7 | Test phone `+11111111111` used as a live branch condition | `controllers/textVolt/textVolt-controllers.js:19,67,100` | **data** — a test fixture wired into production control flow |
| 8 | Returns recipient `admin@hyperwolf.com` | `controllers/order/order-controllers.js:1459`, alongside literals `"BigBad"` and `"Hyperwolf"` | **config** |
| 9 | CORS whitelist array (4 domains) | `startup/middleware.js:9` | **config** — and it is dead code (`:55` overrides it, §14 #7) |
| 10 | `alpine` account id `1546` in 4 API paths | `controllers/member/member-controllers.js:446,456`, `controllers/agechecker/agechecker-controllers.js:139,150` | **config** |

Also **data that should not be in code**: `staticDB/roles.json` and
`staticDB/user-rules.json` are served directly as the role/permission catalogue
(`controllers/admin/admin-user-controller.js:9-10,470,506`) while `RoleAndPermissions` is a
live Mongo collection doing the same job — two sources of truth for authorisation.
`staticDB/kmlCoordinates.json` + `kmlCoordinates1.json` (16 KB of delivery-zone polygons) and
`staticDB/deliverySlot.json` (77 KB) are business data requiring a deploy to change.

## 12. Duplicated code

**Inside the repo.** `common/commonSendMail.js` and `common/emailService.js` are
**byte-identical** (32 lines each, `cmp -s` confirms); both are imported —
`emailTemplates/adminUserTemplate.js:5` uses one, `emailTemplates/storeCreateTemplate.js:5`
the other. `middlewares/awsBucket.js`, `awsBucketProduct.js` and `awsBucketBarCode.js` are the
same S3 upload with a different key-naming rule. `middlewares/fileUpload.js`,
`multiFileUpload.js` and `strainFileUpload.js` are three near-identical multer configs.
`warrantyRequest` exists twice with divergent logic
(`controllers/order/order-controllers.js:1378` and `controllers/POS/pos-controllers.js:1468`),
as does `walletLogs` (`cart-controllers.js:2621`, `order-controllers.js:2569`). 189
commented-out-code blocks across 21 files, worst at
`controllers/admin/authors-controllers.js` (45) and `hemp-blogs-controller.js` (36).

**Versus sibling repos** — measured, not scored. For every `.js` file in `hemp-backend` I
looked for a same-basename file in each sibling and ran `diff -w`:

| Sibling | Same-basename counterpart exists | 0 differing lines | ≥90% identical | share of hemp's 37,254 source lines |
|---|---|---|---|---|
| `stilo-backend` | 167 / 197 | **50 files** | **108 files** | **9,543 lines = 25.6%** |
| `hyperwolf-backend` | 97 / 197 | 20 files | 37 files | 1,486 lines = 4.0% |
| `promotion-backend` | 11 / 197 | 0 | 4 files | 191 lines = 0.5% |
| `distribution-backend` | 27 / 197 | 2 files | 5 files | 121 lines = 0.3% |

Verified pairs (`diff -w`, then read):

| hemp-backend | sibling | hemp / sibling lines | differing lines | what actually differs |
|---|---|---|---|---|
| `controllers/intercom/intercom-controllers.js` | `stilo-backend` same path | 479 / 479 | **0 — byte-identical** | nothing |
| `controllers/textVolt/textVolt-controllers.js` | `stilo-backend` same path | 146 / 146 | **0 — byte-identical** | nothing |
| `controllers/weedmaps/weedmap-controllers.js` | `stilo-backend` same path | 111 / 111 | **0 — byte-identical** | nothing (and it is dead code in hemp — §6) |
| `controllers/ledgergreen/ledgergreen-controllers.js` | `stilo-backend` same path | 116 / 116 | **0 — byte-identical** | nothing |
| `controllers/admin/cart-rules-controllers.js` | `stilo-backend` same path | 118 / 118 | **0 — byte-identical** | nothing |
| `controllers/admin/product-rules-controllers.js` | `stilo-backend` same path | 125 / 125 | **0 — byte-identical** | nothing |
| `middlewares/awsBucket.js` | `stilo-`, `hyperwolf-`, `distribution-backend` | 33 each | **0 — byte-identical ×3** | nothing |
| `common/emailTemplates.js` | `stilo-backend` same path | 52 / 52 | **0 — byte-identical** | nothing |
| `controllers/agechecker/agechecker-controllers.js` | `stilo-backend` same path | 210 / 210 | 2 | one string: `"value": "Hemp"` (`:122`) vs `"Stilo"` |
| `controllers/retailer-settings/payment-controllers.js` | `stilo-backend:controllers/store-settings/payment-controllers.js` | 111 / 111 | 4 | the tenant key: `retailerId` vs `storeId` |
| `controllers/admin/inventory-controllers.js` | `stilo-backend` same path | 206 / 206 | 8 | the model name: `HempProducts` vs `StiloProducts` |
| `controllers/admin/dashboard-controllers.js` | `stilo-backend` same path | 2,053 / 2,054 | 5 | **stilo has a bug fix hemp does not** — `const quantity = Number(item.quantity) \|\| 0` at stilo `:785`, so hemp's `:788-789` sums a possibly-string `item.quantity` with `+=`, producing string concatenation in the category-sold totals |
| `controllers/admin/store-controller.js` | `stilo-backend` same path | 616 / 619 | 13 | branding + 3 extra lines in stilo |
| `models/Order.js` | `stilo-backend:models/Order.js` | 77 / 102 | 58 | stilo's order model has diverged substantially |
| `startup/middleware.js` | `stilo-`, `hyperwolf-`, `distribution-backend` | 63 / 75 / — / — | 55 vs stilo | same broken CORS shape in all forks |

That last-but-two row is the whole argument in one line: these are not "similar" files, they
are the *same* file with a find-and-replace, and a defect fixed in one copy is still live in
the other.

**Contamination proving the copy direction.** Three of hemp-backend's four email templates are
**Stilo-branded**: `emailTemplates/adminUserTemplate.js:53,58,63,126,145`,
`storeCreateTemplate.js:49,54,59,202`, `storeForgotEmailTemplate.js:31,36,41,64,93-94,124`
render Stilo Supply logos from `stilo-assets.s3.amazonaws.com`, the footer "Thanks for rolling
with Stilo Supply!", the contact address `order@stilosupply.com`, and a link to
`www.stilosupply.com`. Worse, `storeCreateTemplate.js:3` and `storeForgotEmailTemplate.js:3`
build the action link from `process.env.CLIENT_SIDE_STILO_POS_REDIRECT_URL`. These templates
are live: `controllers/admin/admin-user-controller.js:12` imports
`sendAdminUserCreationEmail` from `adminUserTemplate` and calls it at `:158` and `:270`. **A
new Hemp admin receives a Stilo-branded welcome email containing a Stilo POS link.**
In the other direction, hemp still carries `store: 'hyperwolf'` in its reviews cron
(`startup/nodeCrons.js:26`), `"Hyperwolf"`/`"BigBad"` in a returns email
(`controllers/order/order-controllers.js:1459`), and `android_channel_id: "hyperwolf-firebase"`
(`common/fcmNotifications.js:12`).

## 13. Dependency risk

- **Declared and never `require`d — 20 of 52** (script-verified): `@aws-sdk/client-s3`,
  `cli`, `fcm-node`, `morgan`, `msg91`, `multer-s3`, `nodemailer`, `pug`, `remove`,
  `socket.io`, `socket.io-client`, `twilio`, `xml2js`, `xml2json`, plus the five dev tools
  (`@commitlint/*`, `commitizen`, `husky`, `lint-staged`) and `nodemon`.
  `xml2json` and `sharp` are native builds; `twilio`, `socket.io` and `aws-sdk` v2 are large.
  Note `app.set('view engine','pug')` (`startup/middleware.js:56`) is set while `pug` is never
  required and `views/` contains no templates.
- **`require`d and not declared — 1**: `uuid`, at
  `controllers/admin/product-traits-controllers.js:8`. It resolves today only because some
  other package hoists it into `node_modules`; a clean install on a different npm version can
  break `/api/v1/product/traits/*` at require time.
- **Builtin-shadowing packages**: `fs: "0.0.1-security"` (`package.json:34`) and
  `path: "^0.12.7"` (`:49`). `fs@0.0.1-security` is an empty squat placeholder.
- **Abandoned**: `request@2.88.2` (deprecated Feb 2020, still called at `common/utils.js:633`),
  `fcm-node` (last publish 2021), `msg91@0.0.6`, `remove@0.1.5`, `cli@1.0.1`.
- **EOL / vulnerable majors**: `mongoose@5` (EOL; declared floor 5.11.15 predates the
  CVE-2023-3696 fix in 5.13.20), `jsonwebtoken@^8` (the `^8` range can never reach the 9.0.0
  fixes for CVE-2022-23529/23540/23541), `axios@^0.21` (0.x EOL; CVE-2023-45857 affects all
  <1.6.0), `@sentry/node@^6` (EOL), `firebase-admin@^9` (EOL, 13.x current),
  `express-rate-limit@^6` (v8 current), `multer@^1` (1.x deprecated).
- **No lockfile** (`.gitignore:3`) — every one of the above ranges resolves freshly at each
  `npm i` on the deploy host. `npm ci` in CI (`security.yml:27`) cannot work without it.
- The `SECURITY_AUDIT.md` in the repo (dated 2026-05-29) reports **81 npm advisories, 5
  critical** (`SECURITY_AUDIT.md:20`). That number is not re-derivable here (no install
  permitted) — treat it as the contractor's own figure.

## 14. Security findings

Ranked. "Unauthenticated" below means *no user identity*; unless stated, the shared static
`x-api-key` still applies — and that key is by construction present in every browser client,
so it is not a meaningful control.

**1. CRITICAL — any caller can mint a valid admin JWT for any admin, including super-admins.**
`routes/admin/admin-user-routes.js:14` mounts `GET /api/v1/admin/:id` → `getAdminById`
(`controllers/admin/admin-user-controller.js:323`) with **no middleware**. At `:396` it calls
`admin.generateAuthToken()` and at `:399-401` returns the signed `access_token` in the
response body. `GET /api/v1/admin/get` (`admin-user-routes.js:13`, also unguarded) lists every
admin with `_id` (`admin-user-controller.js:199-208`; `removeSensitiveFields` strips
`password`/`pin`/`*token` keys but not `_id`). So: list admins → pick the one with
`isSuperAdmin: true` → request its id → receive a 2-day super-admin bearer token. That token
then satisfies `middlewares/admin.js` and `middlewares/isSuperAdmin.js`, i.e. the *only* four
protected routes in the application. **Fix**: delete the `generateAuthToken()` call from
`getAdminById`; put `admin` + an ownership check on `/:id` and `/get`.

**2. CRITICAL — unauthenticated open card-charging endpoint.**
`POST /api/v1/nmi/payment` (`routes/common-routes.js:9`) is in the exclusion list at
`middlewares/authMiddleware.js:15`, so it bypasses even the API key. Its handler
(`controllers/common-controllers.js:334-340`) passes `req.body` straight to `nmiIntegration`
(`common/utils.js:808-834`), which charges `ccnumber`/`ccexp`/`cvv`/`amount` against the
merchant account using the server's own `security_key` (`:812,820`). The raw gateway response
string is returned to the caller (`common-controllers.js:337-338`). This is a
publicly-reachable carding oracle on a live merchant account, with no rate limit and no
amount bound; it also puts raw PANs through this server, which is a PCI-scope problem
independent of the vulnerability. **Fix**: delete the endpoint. If a payment proxy is needed,
authenticate it, bind the amount to a server-side order, and never echo the gateway response.

**3. CRITICAL — order total is taken from the client.**
`controllers/cart/cart-controllers.js:2434-2462` destructures `subTotal`, `total`, `taxResult`,
`walletAmount`, `afterTaxDiscount`, `totalDiscount` and the whole priced `cartData` from
`req.body`. `checkCartAvailability` (`:2693-2753`) validates **stock only** — it never compares
the submitted price to `HempProducts.productPrice`. `handlePayment` charges `amount: total`
(`:2514-2523`, `:2796`) and `createOrder` persists the submitted `subTotal`/`total`
(`:2902-2903`). Submitting `total: 0` skips payment entirely (the `if (total > 0)` guard at
`:2513`) and still creates the order and ships it. `memberId` and `memberData` also come from
the body, so the caller asserts their own identity and wallet. The identical defect is
duplicated in POS at `controllers/POS/pos-controllers.js:403-405,414,421-428,467-468`.
**Fix**: recompute subtotal, tax, discount and total server-side from the catalogue and the
promotion engine; treat the client's numbers as a display hint to be compared, not used.

**4. CRITICAL — customer wallet balance is settable by request, and age verification is
self-asserted.** `PUT /api/v1/member/adjust/wallet` (`routes/member/member-routes.js:24` →
`controllers/member/member-controllers.js:1174-1206`) reads `walletAmount` and `memberId` from
`req.body` and does `member.walletAmount = walletAmount; await member.save()` (`:1195-1197`)
with no auth, no role check and no bound — arbitrary store credit for any customer.
Separately, `POST /api/v1/agechecker/verify`
(`controllers/agechecker/agechecker-controllers.js:52-69`) sets `existingMember.status = true`
and `isVerified = true` from request-body fields, with no callback from AgeChecker and no
signature — self-service age-gate bypass on a cannabis product, which is a compliance exposure
as much as a security one. **Fix**: derive the actor from a verified session; make wallet
adjustment an audited super-admin action; accept verification status only from a
signature-verified vendor callback.

**5. CRITICAL — live Google service-account private key committed.**
`staticDB/fcmtoken.json:5` holds a `private_key` PEM for project `hyperwolf-firebase`, tracked
in git. **Fix**: revoke the key in GCP, rotate, load from an env var or secret manager, purge
from history.

**6. HIGH — mass IDOR across all customer and order data.** No handler in the repo scopes a
lookup to the caller (there is no caller). Examples:
`GET /api/v1/member/:id` (`member-controllers.js:628-655`) returns the full member document —
`dob`, `licenseNumber`, `idImage`, `deliveryAddress`, `walletAmount`, `memberNotes`;
`GET /api/v1/member/orders?memberId=` (`:657-675`) returns any member's order history;
`GET /api/v1/order/:id`, `GET /api/v1/admin/dashboard/*`, and the 20 retailer-product routes
are equally open. `retailerId` is a request parameter, so tenant isolation is voluntary.
**Fix**: a real session; scope every by-id read to the authenticated subject or role.

**7. HIGH — customer ID photographs are uploaded to a public-read S3 bucket by an
unauthenticated endpoint.** `POST /api/v1/upload/image` (`routes/common-routes.js:6`) →
`uploadIdProof` (`controllers/common-controllers.js:39-73`) → `uploadToS3`
(`middlewares/awsBucket.js:12-32`) which sets `ACL: 'public-read'` (`:22`). The multer config it
uses (`middlewares/strainFileUpload.js:22-24`) has a `fileFilter` that returns `cb(null, true)`
for **every** file type and **no `limits.fileSize`**, and files land in `assets/commonFiles`,
which `startup/middleware.js:48` serves via `express.static('assets')` — so arbitrary uploaded
content (HTML, SVG) is served from the API's own origin. `common-controllers.js:50` also sets
the S3 `ContentType` from `req.headers['content-type']`, which for multipart is
`multipart/form-data; boundary=…`, not the file's type. **Fix**: authenticate the route;
restrict MIME types and set a size limit; store ID images private with pre-signed reads; stop
serving the upload directory.

**8. HIGH — CORS allows every origin.** `startup/middleware.js:13-26` defines
`corsOptionsDelegate` against a 4-domain whitelist and then never uses it; `:55` calls bare
`cors()`, which reflects/allows all origins. `SECURITY_AUDIT.md:26-44` flagged exactly this on
2026-05-29 and it is still present. **Fix**: `app.use(cors(corsOptionsDelegate))` — and fix the
delegate too: `whitelist` at `:8` is `process.env.ALLOW_ORIGIN || [array]`, so when the env var
is set it is a **String** and `.indexOf(origin)` at `:22` becomes a substring test
(origin `evil-hyperwolf.com.attacker.net` would need care) — parse it into an array.

**9. HIGH — full read-SSRF with credential exfiltration.**
`controllers/shipstation/shipstation-controllers.js:15` takes `req.body.resource_url` and
passes it unvalidated to `shipstationApiCall` (`:107-128`), which attaches
`Authorization: Basic ${SHIPSTATION_API_KEY}` (`:114`) and returns the response body to the
caller (`:26-29`). An attacker points it at their own host and receives the ShipStation
credential; or at `169.254.169.254`/internal services and reads the response. This route
(`/new-order-webhook`) does require the shared API key; the three sibling routes that do *not*
(`:130,143,211`) constrain the URL to ShipStation's base but still let an unauthenticated
caller run arbitrary `/orders?…` queries with the merchant key and mutate `Order.emailStatus`
and `trackingId` (`:157-162`, `:227-229`) — and `:157` has no null guard, so a bad order number
is a 500. **Fix**: drop `resource_url` entirely and derive the path from the webhook payload;
verify a shared webhook secret on all four routes.

**10. HIGH — password-reset tokens are `Math.random()`.**
`common/utils.js:213-219` builds a 100-character token from `Math.random()`; it is the reset
token for both admins (`controllers/admin/admin-user-controller.js:415`) and members
(`controllers/member/member-controllers.js:482`). V8's `Math.random` is a seedable
xorshift128+ whose internal state is recoverable from a modest number of outputs, and the same
generator also produces every `memberId`/`productId`/`orderId` in the system — so an attacker
who can create records can harvest outputs and predict a reset token. Compounding it,
`member-controllers.js:476` looks up `Member.findOne({ phone: req.body.phone })` with the raw
body value, so `{"phone": {"$ne": null}}` issues a reset for an arbitrary member.
**Fix**: `crypto.randomBytes(32).toString('hex')` for tokens and ids; cast query scalars.

**11. HIGH — mass assignment on privileged records.** `store.set(req.body)` at
`controllers/admin/store-controller.js:322` (route `PUT /api/v1/admin/store/:id`, unguarded)
lets the caller set any field in the `Store` schema, including `password`, `PIN`, `roleId`,
`roleName`, `isViewUser`, `subscription`, `valiDateTo` (`models/Store.js:29-45`) — and on this
path the password is **not** hashed. The same `.set(req.body)` pattern appears at
`controllers/admin/region-controllers.js:125`, `admin/inventory-controllers.js:175,193`,
`admin/promotion-controllers.js:120,199`, `admin/cart-rules-controllers.js:104`,
`admin/product-rules-controllers.js:111`, `product/product-controllers.js:846`,
`order/order-controllers.js:2424`, `member/member-controllers.js:1367`, and
`{...req.body}` at `admin/roles-permissions-controllers.js:20,94` and
`admin/authors-controllers.js:340`. **Fix**: explicit field allow-lists.

**12. HIGH — card data (PAN, expiry, CVV) is sent to Sentry.**
`controllers/cart/cart-controllers.js:2613-2616` calls
`Sentry.captureMessage("Submit Cart Error", "Payload= " + JSON.stringify(req.body) ...)` inside
the `submitCart` catch, and `req.body` contains `ccnumber`, `ccexp`, `cvv` (`:2446-2448`).
`handlePayment` at `:2808` is careful to strip `ccnumber` before its own capture — proving the
author knew — but the outer handler is not. `createOrder`'s catch (`:2933-2960`) similarly
ships the whole cart and member snapshot. **Fix**: scrub, or send only an error id.

**13. MEDIUM — ReDoS / regex injection from query strings.** `controllers/` + `common/`
contain **98** `new RegExp(...)` construction sites; **16** route the value through
`addSlashToSpecialCharacterString` (`common/utils.js:522-532`) or a local escaper. Of the
remaining 82, **80 interpolate a request-derived value unescaped**, e.g.
`controllers/order/order-controllers.js:200-203,1652-1655,2299-2300,2349`,
`controllers/member/member-controllers.js:246-247,1065-1067,1219,1292`,
`controllers/admin/inventory-controllers.js:20-21`,
`controllers/admin/product-traits-controllers.js:188-190,705-707,1114`,
`controllers/admin/category-controllers.js:31`,
`controllers/admin/dashboard-controllers.js:1981`,
`controllers/retailer-settings/payment-controllers.js:106-107`,
`controllers/retailer-settings/branch-controllers.js:117-119`,
`controllers/admin/retailer-product-controllers.js:129-133`. On an unindexed collection a catastrophic pattern pins a CPU for the duration
of a full scan. `controllers/admin/product-rules-controllers.js:99,103` additionally builds
`new RegExp('^' + req.body.ruleType + '$', 'i')` by concatenation. **Fix**: escape centrally,
or use a text index.

**14. MEDIUM — NoSQL operator injection.** Request scalars are passed into query objects
without casting throughout: `Member.findOne({ phone })` from `req.body.phone`
(`controllers/member/member-controllers.js:347`, `:476`),
`Member.findOne({ email })` (`controllers/agechecker/agechecker-controllers.js:50`),
`Order.find({ memberId: req.query.memberId })` (`member-controllers.js:662`),
`RetailerProducts.findOne({ retailerId: req.body.retailerId, ... })`
(`controllers/POS/pos-controllers.js:1510`). Login itself is not directly bypassable (bcrypt
still runs), but enumeration and unintended record selection are. **Fix**: `String(...)` casts
or a validation layer at the edge.

**15. MEDIUM — auth-endpoint rate limiting is partly aimed at a route that does not exist.**
`startup/routes.js:87` applies `authRateLimiter` to `POST /api/v1/admin/forgot-password`; the
actual route is `POST /api/v1/admin/forgot` (`routes/admin/admin-user-routes.js:9`), which is
therefore **unlimited**. The limiter is also `skipSuccessfulRequests: true`
(`startup/routes.js:73`), so a credential-stuffing run that finds valid passwords is not
counted, and `express-rate-limit`'s default store is per-process memory — under PM2 cluster
mode the effective limit multiplies by the worker count.
`POST /api/v1/admin/reset`, `POST /api/v1/member/reset` and `POST /api/v1/member/register`
have no limiter at all.

**16. MEDIUM — `/ping` leaks Mongo errors and leaks connections.**
`controllers/common-controllers.js:1229-1270` calls `mongoose.createConnection(db1, ...)` on
every request (`:1240`) and **never closes it**, and returns `err.message` verbatim
(`:1254,1261,1267`) which for connection failures names hosts and replica-set members. It is
unauthenticated (`middlewares/authMiddleware.js:15`) and limited to 5/min
(`startup/routes.js:62-68,83`) — 300 leaked connections an hour is enough to exhaust the pool.

**17. LOW — reflected content in a webhook echo.**
`controllers/textVolt/textVolt-controllers.js:11` does `res.send(check)` where `check` is
`req.query.check` (`:10`). Express sets `Content-Type: text/html` for a string body, so the
value is reflected as HTML. Exploitability is low because the route requires the `x-api-key`
header, which a browser navigation will not send. Same shape at `:61`.

**18. LOW — inconsistent bcrypt cost.** 12 at
`controllers/admin/admin-user-controller.js:124,449`, `member-controllers.js:516,1029`;
**10** at `controllers/admin/store-controller.js:567`,
`controllers/retailerUser/retailer-user-controllers.js:390`,
`controllers/agechecker/agechecker-controllers.js:37`.

**Note on the repo's own `SECURITY_AUDIT.md`.** It is dated 2026-05-29 and is partly stale:
its "[HIGH] No Security Headers (Helmet Not Installed/Used)" (`:253`) is contradicted by
`startup/middleware.js:42`; its "[MEDIUM] 200 MB JSON Body Limit" (`:236`) by `:53`
(`limit: '5mb'`); its "[HIGH] bcrypt Salt Rounds Set to 10" (`:136`) is now 12 in most places;
its "[HIGH] Auth Token Accepted via URL Query Parameter" (`:46`) is fixed in
`middlewares/auth.js:5` — a file that is only imported by a route that is never mounted. Its
four "CRITICAL" items are CORS (still open) and three reset-token issues (two now fixed:
tokens are SHA-256 hashed at `admin-user-controller.js:416`, expire after an hour at `:441`,
and are deleted at `:453`). **It missed every one of findings #1–#5 and #7 above.** A document
that certifies a codebase as 23-issue-clean while the highest-value flaws sit untouched is
worse than no document.

## 15. Performance findings

**1. Zero indexes on `Order`; near-zero on `Member`.** `models/Order.js` declares no index and
no `unique`. `Order` is queried by `orderId` at 21 sites, `memberId` at 10, `sessionId`,
`trackingId`, `shipStationOrderId`, and range-scanned on `createdDate` by every dashboard
aggregation (`controllers/admin/dashboard-controllers.js:1977` and 11 more). Every one is a
COLLSCAN. `Member` indexes only `phone` (`models/Member.js:13`) while `memberId` (16 sites) and
`email` (11 sites) are unindexed. **Fix**: `{orderId:1}` unique, `{memberId:1, createdDate:-1}`,
`{sessionId:1}`, `{createdDate:-1}` on Order; `{memberId:1}`, `{email:1}` on Member. This is
an afternoon's work and is the single largest available win.

**2. The whole `Order` collection is loaded into Node on every promo-code application.**
`common/utils.js:1183-1185`, inside `promoConditions` (`:1150`) — which
`controllers/cart/cart-controllers.js` calls on the cart hot path — does
`const allOrders = await Order.find()` with no filter, no projection and no limit, then
`.filter()` in JavaScript to count promo usage. `:1176` does the same per-member. At any real
order volume this is an OOM or a multi-second stall on every "apply coupon" click.
**Fix**: `Order.countDocuments({'promotionData.promotionId': id})` with an index.

**3. Read-modify-write inventory decrement with no atomicity — overselling.**
`controllers/cart/cart-controllers.js:3052-3336` (`updateProductQuantities`) reads the product
(`:3073`), computes `product.totalQuantity = Math.max(product.totalQuantity - item.quantity, 0)`
in JS (`:3094-3097`), then `$set`s the computed value back (`:3152-3159`). Two concurrent
orders for the same SKU read the same starting quantity and both write their own result — one
decrement is silently lost. The same shape is in the 10-minute hold-reset cron
(`common/utils.js:1074`) and in POS (`controllers/POS/pos-controllers.js:1520-1543`).
**Fix**: `$inc` with a `{totalQuantity: {$gte: qty}}` guard, and check `modifiedCount`.

**4. N+1 loops over DB calls.** A scripted scan finds 66 candidate `await <Model>.<op>` calls
inside loop bodies; the ones I read and confirmed:
`controllers/cart/cart-controllers.js:3065-3336` (one find + up to five writes per cart line,
sequential); `controllers/POS/pos-controllers.js:1505-1593` (four sequential writes per
returned item); `common/utils.js:1050-1108` (nested cart × line loop with a `findOne` per line,
in a 10-minute cron); `controllers/order/order-controllers.js:416`, `:2044`;
`controllers/retailer-settings/tax-controllers.js:118`;
`controllers/admin/inventory-controllers.js:93-98` (`HempProducts.find()` unbounded, then
`product.save()` per product).

**5. 26 unbounded `find()` calls.** Verified list includes
`common/utils.js:1183`, `controllers/alpine/alpine-controllers.js:136`,
`controllers/product/product-controllers.js:1629`, `controllers/POS/pos-controllers.js:84`,
`controllers/admin/inventory-controllers.js:93`,
`controllers/admin/admin-user-controller.js:471` (loads every admin to compute role counts),
`controllers/sitemap-controllers.js:28,79,95`, `controllers/strain/strain-controller.js:410`,
`controllers/blog-controllers.js:101`. None has a `.limit()` or a projection.

**6. Response sent before the work is done.** `controllers/cart/cart-controllers.js:2581`
`res.send(orderData)` precedes inventory decrement (`:2584`), receipt email (`:2585`),
ShipStation order creation (`:2586`) and Alpine rewards (`:2608`). Any failure after `:2581`
lands in the catch at `:2612`, which calls `res.status(400).send(...)` on an
already-sent response. `controllers/POS/pos-controllers.js:1502` and
`controllers/textVolt/textVolt-controllers.js:11` do the same. The user is told the order
succeeded before stock is reserved.

**7. The hourly reviews cron fans out one HTTP call per product with no concurrency cap.**
`startup/nodeCrons.js:32-54`: `HempProducts.find()` then `Promise.all(products.map(...))`,
each doing an external GET plus a `product.save()`, hourly, with an empty catch.

**8. Debug telemetry on the cart hot path.** `controllers/cart/cart-controllers.js:1802-1836`
issues a `fetch` to `http://127.0.0.1:7779/ingest/...` on every `prepareCart`, with 26 `dbg*`
timing variables threaded through the function.

**9. 100% Sentry trace sampling** in all 19 `Sentry.init` calls (`tracesSampleRate: 1.0`).

**10. Synchronous filesystem I/O in request handlers**: `controllers/common-controllers.js:957`
and `:1016` (barcode/QR generation).

## 16. Ten things a new developer would trip over

1. **`partnerAuth` looks like authentication and is a no-op.** `middlewares/partnerAuth.js:6` —
   the condition is always true and the headers it writes are capitalised, so nothing reads them.
2. **The `auth` middleware is only referenced by a route file that is never mounted.**
   `routes/weedmaps/weedmap-routes.js:4,6`; `startup/routes.js` has no weedmap mount. Same for
   `routes/admin/retailer-routes.js` and its whole controller.
3. **`adminCreationDisabled` does not disable admin creation.**
   `middlewares/adminCreationDisabled.js` is imported by nothing (`grep -arn adminCreationDisabled`
   → the file itself only), yet `README.md:128` claims it protects the creation route.
4. **`require: true` is not `required: true`.** 8 fields you think are mandatory are not —
   `models/ActiveCart.js:6,8,9,26,27`, `models/Category.js:6,13`, `models/WebCategory.js:6`.
5. **Cron comments are wrong by a factor of 24.** `startup/nodeCrons.js:68` is a six-field
   expression: `0 0 */3 * * *` is every three *hours*, and the comment says "every 3 day".
6. **The Sentry error handler runs before the routes.** `startup/middleware.js:61` vs
   `index.js:12,14` — Sentry captures nothing from route handlers, and 18 later `Sentry.init`
   calls clobber the Express integration.
7. **Two identical mail modules, both live.** `common/commonSendMail.js` and
   `common/emailService.js` are byte-identical; `emailTemplates/adminUserTemplate.js:5` imports
   one and `emailTemplates/storeCreateTemplate.js:5` the other.
8. **The admin welcome email is Stilo-branded.**
   `emailTemplates/adminUserTemplate.js:53,126,145`, reached from
   `controllers/admin/admin-user-controller.js:158`.
9. **Every thrown error becomes a `400` with the raw exception message.**
   `middlewares/async.js:26`. There is no 500 path and no `next(err)` — the wrapper never even
   receives `next` (`:21-23`).
10. **`GET /api/v1/product/traits` does not hit the product-traits router.**
    `startup/routes.js:96` mounts `/api/v1/product` before `:139` mounts
    `/api/v1/product/traits`, and `routes/product/product-routes.js:11` (`router.get('/:id')`)
    matches first, so the request is served as a product lookup with `id = "traits"`.

## 17. Grade inputs

| Axis | 1–10 | Justification | Single strongest citation |
|---|---|---|---|
| Simplicity | **2** | 80% of the source is in 53 controllers, eight of them over 1,500 lines; `cart-controllers.js` is 3,485 lines containing routing, pricing, promotions, payment, inventory, email, shipping and debug telemetry. No service layer, no repository layer. | `controllers/cart/cart-controllers.js:2433-2619` — `submitCart` does payment, wallet, discount, order, inventory, email, ShipStation and loyalty inline |
| Speed | **2** | The primary transactional collection has no index at all, and the cart hot path loads that entire collection into memory. | `common/utils.js:1183` — `const allOrders = await Order.find()` inside `promoConditions` |
| Security | **1** | Anyone can mint a super-admin token, charge a card unauthenticated, set their own order total to zero, and set any customer's wallet balance. A live GCP private key is committed. | `controllers/admin/admin-user-controller.js:396-401` — unauthenticated route returns a signed admin JWT |
| Data modelling | **3** | 56 schemas, 6 indexes, no refs, no soft delete, three representations of time, money as floating-point dollars, tenant key unindexed and client-supplied. | `models/Order.js` — 77 lines, zero indexes, for the collection queried at 33+ call sites |
| Reuse vs hardcoding | **2** | 25.6% of this repo is ≥90% identical to `stilo-backend`, with 50 byte-identical files; the differences are a brand string, a model name, or `retailerId`→`storeId` — and stilo already carries a bug fix hemp does not. | `controllers/admin/dashboard-controllers.js:788` vs `stilo-backend/controllers/admin/dashboard-controllers.js:785,789` |
| Testing | **1** | Zero tests, zero test dependencies, no `test` script. | `package.json:5-10` |
| Upgradability | **2** | `engines: ">=12.x"` with a dependency (`helmet@8`) that needs ≥18; no lockfile; five EOL majors; framework calls (`req`, `res`, Mongoose models) are threaded through every one of the 29,855 controller lines, so business logic cannot be lifted out. | `package.json:12` + `.gitignore:3` (lockfile excluded) |
| Operability | **3** | Sentry is initialised 19 times and its error handler is mounted before the routes; 128 `console.log`s including one that prints a bcrypt hash; the DB URI is logged at boot; the CI security gate is wired to a branch nobody uses and cannot pass. | `startup/middleware.js:61` (error handler before routes) and `startup/db.js:7` (logs the connection string) |
| Developer experience | **2** | No tests, no types, no linting of code (only of commit messages), 189 commented-out blocks, two dead route files, and a README that contradicts the code on member auth, admin-creation blocking and the existence of `.env.example`. | `README.md:56` claims no `.env.example` is committed; the file exists at the repo root and is tracked |

**README vs code, explicitly** (the prompt asks for both citations where they conflict):
`README.md:56` "The repository does not commit an `.env.example` file" — it does.
`README.md:124` "member sessions use signed JWTs" — `controllers/member/member-controllers.js:364-368`
issues no token; `grep -arn "jwt.verify" controllers/` is empty.
`README.md:128` "Admin creation disabled — an `adminCreationDisabled` middleware returns 404" —
that middleware is imported by nothing and `routes/admin/admin-user-routes.js:19` is live.
`README.md:91` lists a `/robots.txt` route — `grep -arn robots routes/ controllers/ startup/`
returns nothing.
`README.md:134-139` cron frequencies — five of six are wrong (§7).

## 18. Quick fixes (<1 h each), ranked by impact per hour

1. **Delete `POST /api/v1/nmi/payment`** — remove `routes/common-routes.js:9` and
   `controllers/common-controllers.js:334-340`. Closes an open carding endpoint. 5 minutes.
2. **Delete the `generateAuthToken()` call in `getAdminById`** —
   `controllers/admin/admin-user-controller.js:396,399`; then add `admin` middleware to
   `routes/admin/admin-user-routes.js:13-16`. Closes the admin-token mint. 15 minutes.
3. **Revoke and rotate the Firebase service-account key**, remove `staticDB/fcmtoken.json`
   from the tree, load from env. 30 minutes (plus history purge separately).
4. **Add indexes**: `Order {orderId:1}` unique, `{memberId:1, createdDate:-1}`, `{sessionId:1}`,
   `{createdDate:-1}`; `Member {memberId:1}`, `{email:1}`. One edit per model file. 30 minutes,
   and it is the largest latency win available.
5. **Replace `Order.find()` at `common/utils.js:1183` with `countDocuments`** and the same at
   `:1176`. 15 minutes.
6. **Fix CORS**: `app.use(cors(corsOptionsDelegate))` at `startup/middleware.js:55` and parse
   `ALLOW_ORIGIN` into an array at `:8`. 10 minutes.
7. **Scrub card data from Sentry**: replace `JSON.stringify(req.body)` at
   `controllers/cart/cart-controllers.js:2615` with an allow-listed subset. 10 minutes.
8. **Fix the reset-token generator**: `crypto.randomBytes(32).toString('hex')` in
   `common/utils.js:213-219`. 5 minutes.
9. **Point `authRateLimiter` at the route that exists**: `startup/routes.js:87`
   `/api/v1/admin/forgot-password` → `/api/v1/admin/forgot`; add limiters to `/reset` and
   `/register`; drop `skipSuccessfulRequests`. 10 minutes.
10. **Delete the debug telemetry block** at `controllers/cart/cart-controllers.js:1802-1836`
    and the `dbg*` variables. 15 minutes.
11. **Commit `package-lock.json`** (remove `.gitignore:3`) so `npm ci` in CI can work at all,
    and change `security.yml:4` to trigger on the deployed branch. 10 minutes.
12. **Stop logging the member document and the DB URI**:
    `controllers/member/member-controllers.js:349`, `startup/db.js:7`. 5 minutes.
13. **Add `limits: { fileSize }` and a real `fileFilter`** to
    `middlewares/strainFileUpload.js:22-26`. 10 minutes.
14. **Fix the eight `require:` → `required:` typos** and the three `deafult` typos. 10 minutes.
15. **Delete `common/commonSendMail.js`** and repoint `emailTemplates/adminUserTemplate.js:5`.
    5 minutes.

Everything above is symptomatic. The structural fixes — a real session/authorisation layer,
server-side price computation, and collapsing the hemp/stilo fork into one parameterised
service — are weeks, not hours.

## 19. Open questions

1. **Is this repo deployed to production, and how?** The only workflow deploys to
   `api.direct.stage.hyperwolf.com` (`.github/workflows/node.js.yml:14`). Is production
   deployed by hand? From which branch?
2. **Has `staticDB/fcmtoken.json` ever been in a public or widely-shared repository?** That
   determines whether rotation is urgent or merely required.
3. **Is `PROJECT_API_KEY` shipped in the browser bundle of the storefront and admin SPA?** If
   so, every one of the 428 "protected" routes is effectively public, and findings #1, #4, #6,
   #7 and #11 are all remotely exploitable by anyone.
4. **Are `POST /api/v1/nmi/payment` and the four ShipStation routes reachable from the public
   internet, or is there a WAF/nginx allow-list in front?** Nothing in the repo constrains them.
5. **Which of `Retailer` / `Store` / `RetailerUser` / `StoreUser` is the live tenant model?**
   Both hierarchies exist, both have login flows, and `routes/admin/retailer-routes.js` (the
   retailer login) is not mounted. Is the retailer path dead, or served elsewhere?
6. **Is the Stilo branding in `emailTemplates/adminUserTemplate.js`, `storeCreateTemplate.js`
   and `storeForgotEmailTemplate.js` intentional?** Hemp admins currently receive Stilo-branded
   mail with a `CLIENT_SIDE_STILO_POS_REDIRECT_URL` link.
7. **Is `hemp-backend` intended to remain a fork of `stilo-backend`?** 25.6% of it is a
   find-and-replace copy. If they are meant to converge, that is a very different plan from
   "fix hemp's bugs".
8. **Was `SECURITY_AUDIT.md` (2026-05-29) treated as a completed remediation?** Some of its
   findings were fixed and the document was never updated, so it now reads as a clean bill of
   health for a codebase with five critical unfixed issues it never looked for.
9. **What is `http://127.0.0.1:7779/ingest/d619a079-…`** (`controllers/cart/cart-controllers.js:1806`)
   — an internal profiler that is expected to be running, or abandoned agent scaffolding?
10. **Who owns `techindustan/hyperwolf-hemp-backend`** (`package.json:79`), and does the
    contractor still have push access?
