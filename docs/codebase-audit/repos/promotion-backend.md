# promotion-backend — codebase audit

Repo: `/Users/jt/hyper-tech/promotion-backend` pinned at `d1bd9a8` ("Initial commit", 2026-09-09
19:34:02 +0530). Sibling repo `promotion-engine` at `/Users/jt/hyper-tech/promotion-engine`,
pinned at `8e37229` (committed 9 seconds later, same author/session — see "Relation to
promotion-engine" below; the two "Initial commit" timestamps are an artifact of how these repos
were seeded for this audit, not real development history, so git log is NOT a valid signal for
"which is newer" here). Metrics pre-read: `metrics/promotion-backend.md` /
`.json` and `metrics/promotion-engine.md`, and `metrics/CROSS-REPO-DUPLICATES.md`.

## 1. Purpose

Node/Express "admin promotion" middleware for Hyperwolf's multi-brand storefronts (Hemp, Stilo,
Hyperwolf). From the code (not the README): it (a) does CRUD on `Promotion`/`Rule`/`PromoCode`
documents (`controllers/promotion-controllers.js`), (b) evaluates a shopper's cart against active
promotions and returns applied discounts (`ruleEngine.runCartPromotions`,
`controllers/promotion-controllers.js:921`), (c) maintains a derived
`ProductPromoTag` index used to badge/strike-through prices on product listings
(`services/product-promo-tag.service.js`), (d) serves read-only product/category/brand/region
listings across three storefront platforms (`controllers/product-listing-controller.js`), and
(e) runs a background scheduler that keeps `HempProducts` sale prices consistent with active
promotions (`startup/promo-price-sync-scheduler.js`). It is called by admin/storefront web
clients, per `README.md:18`. It calls out to `promotion-engine`'s `/compile-promotion` endpoint
when creating/updating a promotion (`controllers/promotion-controllers.js:278,580`, env var
`COMPILE_PROMOTION_URL`), and to Reviews.io during cart validation
(`.env.example:19-22`, `controllers/promotion-controllers.js:919`).

## 2. Runtime & framework

- No `.nvmrc`, no `Dockerfile`, no `engines` field in `package.json` (`package.json:1-25`).
  README claims "verified to run on Node 20" (`README.md:64`) — unverifiable from the repo
  itself, taken on faith.
- Express `^4.19.2` (4.x is maintained but 5.x is current — the sibling `promotion-engine`
  already runs Express 5). Mongoose `^5.11.15` — **Mongoose 5 reached EOL in 2022**; current
  major is 8.x (which `promotion-engine` already uses). Joi `^18.0.2`. `cors ^2.8.5`.
  `newrelic ^13.8.1` is declared but never `require`d anywhere in source (verified:
  `grep -arn "newrelic" --include='*.js' .` → zero hits outside `package.json`/lockfile) — dead
  dependency, not wired observability despite being in the metrics list of "frameworks".
  `mongoose-sequence ^6.0.1` is likewise declared but never imported.
- All deps use caret ranges (`package.json:16-24`); lockfile (`package-lock.json`) is present, so
  installs are reproducible even though semver drift is possible on a fresh `npm install`.
- No TypeScript anywhere.
- **Corrections to the metrics pass**: the `child_process` "security" hit (2 in `common/index.js`)
  is a false positive — both hits are `regex.exec(...)` calls inside a vendored date library, not
  `child_process.exec` (`common/index.js:1108,3390`). The `http_url` "hardcoded" hits (23 in
  `common/index.js`) are JSDoc comment links inside the same vendored library (e.g. links to
  `cldr.unicode.org`, `en.wikipedia.org`) — not app-level hardcodes. The `role_string` hits are
  rule-type enum values (`"user"`, `"product"`, etc.) picked up by a generic regex, not RBAC role
  strings — this codebase has no RBAC at all (see §6, §14).

## 3. Entry points & boot

`index.js` is the process entry point. Boot sequence: load env → construct Express app → apply
`cors()` with no options (reflects/allows all origins, see §14) → `express.json({limit:"2mb"})` →
a global CSP header middleware (`index.js:13-19`, a genuinely good touch for an API-only service)
→ `startup/config()` (only checks `DATABASE_URL` is set, `startup/config.js:1-11`) → `await
startup/db()` opens **four separate Mongoose connections** (`DATABASE_URL`, `HEMP_DATABASE_URL`,
`STILO_DATABASE_URL`, `HW_DATABASE_URL`) and stores them as `global.dbConnections = {conn1, conn2,
conn3, conn4}` (`startup/db.js:39`) → `startup/routes(app)` mounts the two route groups → starts
`startPromoPriceSyncScheduler({platform:"hemp"})` (`index.js:29-30`) → `app.listen`.

**Global mutable state risk**: nearly every model file calls
`global.dbConnections.connN.model(...)` **unconditionally at require-time**
(`models/Promotion.js:140`, `models/PromoCode.js:31`, `models/Product.js:51`,
`models/StoreProducts.js:23`, `models/HempProducts.js:67`, `models/ProductPromoTag.js:41`, all
three `models/{Hemp,Stilo,Hyperwolf}/{Brand,Category,Region}.js`). If any of these modules is
`require`d before `startup/db()` resolves — directly, or transitively through a future refactor —
the process throws `Cannot read properties of undefined (reading 'model')` with no useful stack
context. `models/Rule.js:53-56` is the only file defensive about this (falls back to
`mongoose.models.Rule || mongoose.model(...)` when `global.dbConnections` isn't set yet), which
shows the author was aware of the hazard in at least one place but did not apply the fix
consistently.

`startup/db.js:16,23,29,36` logs the **full connection string, including credentials**, to
stdout on every boot (`console.log(\`Connected to Database 1: ${db1}\`)`) — see §14.

## 4. Directory map

| Dir | Role | Size |
|---|---|---|
| `common/` | Vendored, machine-generated bundle of an old `promotion-engine` build (see §12) + `toastMessages.js` (response strings) | `index.js` 10,939 lines (bundle), `toastMessages.js` 29 lines |
| `controllers/` | Route handlers: promotion CRUD/validation (1,107 lines), product listing (251 lines) | 2 files |
| `engine/` | A **second**, in-repo, hand-rolled generic rule engine (AND/OR/CONDITION tree + operator registry + attribute resolvers), wired only to the "dynamic" `/dynamic/validate` route (see §12) | 4 files, ~417 lines |
| `models/` | Mongoose schemas, including three near-duplicate per-platform Brand/Category/Region schemas | 19 files |
| `routes/` | Express routers, no middleware | 2 files, 25 lines |
| `services/` | Business logic: promo-tag index rebuild (1,406 lines), promo-price sync (308 lines), dynamic promotion service (101 lines), category/brand rule extraction shared with `promotion-engine` (116 lines) | 4 files |
| `startup/` | Config check, DB connections, route mounting, background scheduler | 4 files |
| `utils/` | Rule-duplicate detection (233 lines), cross-platform listing helpers (359 lines) | 2 files |
| `staticDB.js/` | A **directory** (not a file, despite the `.js` in its name) holding one static JSON (`apiVersion.json`) | 1 file, 2 lines |
| `.github/` | Single CI workflow (self-hosted push-to-deploy) | 1 file |

## 5. Data model summary

19 Mongoose models across **4 separate MongoDB connections** (`conn1`=promotions DB,
`conn2`=Hemp, `conn3`=Stilo, `conn4`=Hyperwolf) — the multi-tenancy key is which physical
database/connection a model is bound to, not a shared `tenantId`/`platform` field on one schema;
`Promotion` and `ProductPromoTag` additionally carry a `platform: String` field
(`models/Promotion.js:87-89`, `models/ProductPromoTag.js:5`) to distinguish brands **within**
`conn1`. No model uses Mongoose `timestamps: true` except `PromoCode`
(`models/PromoCode.js:28`); everything else hand-rolls `createdAt`/`createdDate`/`updatedDate` as
plain `Date`/`Number` fields with inconsistent naming (`createdAt` on `Promotion`/`Rule`/`Action`
vs `createdDate`/`updatedDate` — a `Number` epoch, not a `Date` — on `HempProducts`,
`StoreProducts`, and all three platform Brand/Category/Region models). No soft-delete convention
anywhere — `deletePromotion` is a real `findByIdAndDelete` (`controllers/promotion-controllers.js`
~801). IDs are Mongo ObjectIds for `_id` but ad-hoc `String` for `productId`/`brandId`/
`categoryId`/`regionId` cross-references (no referential integrity enforced by the DB). Money
(`totalPrice`, `unitPrice`, `salePrice`, `productPrice`, discount `value`) is stored as plain
`Number` — dollars, not cents (`promo-price-sync.service.js:17` `roundToTwo` rounds to 2dp) —
floating-point money with no cents-integer convention, standard rounding-error risk at scale
(Medium, not Critical, since this is a promo/display price, not the payment ledger).

The 10 most central models: `Promotion` (27 fields, 1 compound unique index on
`{platform,code}`, `models/Promotion.js:137`, no `timestamps`, `status` enum `active/inactive`);
`Rule` (10 fields, defensive connection lookup, `rule_type` enum `cart/user/product/bogo`); `Rules`
(16 fields — a **second**, structurally different "if/then" rule shape used only by the dynamic
engine, `models/Rules.js`); `Action` (4 fields, `type` free-text `flat/percentage/product`, no
enum enforced); `PromoCode` (6 fields, `timestamps: true`, only model with real Mongoose
timestamps); `ProductPromoTag` (derived/cache document, compound unique `{platform,productId}`,
`models/ProductPromoTag.js:39`); `Product` (Hyperwolf catalog, 6 secondary indexes,
`models/Product.js:26-31`); `HempProducts` (67 fields, zero explicit indexes despite being
queried by `productId`, `brandSlug`, `category`, THC fields — see §15); `StoreProducts` (Stilo
catalog, one index on `productTraits`); the three per-platform `Brand`/`Category`/`Region`
trios (near-duplicate schemas, different field sets per platform, see §12). Full field-by-field
detail: `promotion-backend.datamodel.md`.

## 6. API surface

Two route groups mounted in `startup/routes.js:15-16`:
`/api/v1/admin/promotion` → `routes/promotion-routes.js` (10 routes, all CRUD verbs including
`DELETE /:id`) and `/api/v1/admin/listing` → `routes/product-listing-routes.js` (4 read-only GET
routes). **Verified by tracing `index.js` → `startup/routes.js` → each router file: there is no
authentication middleware anywhere in the request chain.** `index.js` applies only `cors()`, JSON
body parsing, and a CSP header before `startup/routes(app)`; neither router file imports or calls
any auth/session/JWT check; no route passes a second handler argument. This is not a
metrics-pass artifact to second-guess — the metrics count ("15 route handlers, 15 with no
middleware") is **correct as read**, and `README.md:178` independently states "**No authentication
middleware is present**" (see §11 for where the README is *wrong* elsewhere). There is no
`jsonwebtoken`, `passport`, `helmet`, or `express-rate-limit` in `package.json` or
`package-lock.json` at all — not merely unused, but genuinely absent from the dependency tree, so
there is no scaffolding to bolt auth onto without adding a library. Role checks: **none exist**;
there is no concept of a role or caller identity anywhere in this service. Input validation is
inconsistent: Joi schemas exist for the platform Brand/Category models
(`models/Hemp/Brand.js:31-52` etc.) but are **never wired into `routes/`** (no route calls
`brandValidation`/`addCategoryValidation` — those models aren't even routed to); the actual
promotion CRUD routes do hand-rolled `if (!rules) return res.status(400)...` checks
(`controllers/promotion-controllers.js:283-289`) with no schema validation library. Pagination:
`getPromotions` and `getProductListing` both accept `skip`/`limit` query params with a default of
20 but **no server-side cap** — a client can pass `limit=999999999` (`controllers/
promotion-controllers.js:460-470`, `controllers/product-listing-controller.js:22-56`). Error
shape is inconsistent — some handlers return `{message}` (`res.status(...).send({message:...})`),
others `{success, message, data}` (`res.status(...).json({success:false,...})`) — no shared error
envelope. No API versioning beyond the literal `/api/v1/` path segment (no version negotiation,
no deprecation mechanism). No frontend in this repo (backend service only).

**Every one of the 15 routes is reachable with zero authentication**, including
`DELETE /api/v1/admin/promotion/:id` (`routes/promotion-routes.js:11` →
`controllers/promotion-controllers.js` `deletePromotion`, a real
`Promotion.findByIdAndDelete`) and `POST /product-tags/rebuild`
(`routes/promotion-routes.js:8`, triggers a full catalog re-scan, see §15). This is the single
worst finding in the repo — see §14.

## 7. Background jobs

One: `startPromoPriceSyncScheduler` (`startup/promo-price-sync-scheduler.js`), started once at
boot (`index.js:29-30`), interval `PROMO_PRICE_SYNC_INTERVAL_MS` (default 60000ms,
`.env.example:26`). It runs `rebuildProductPromoTagIndex` then `syncPromoPricesToHempProducts`
inside a `try/catch`, and guards against overlap with an in-process boolean flag
(`running`, `startup/promo-price-sync-scheduler.js:5,14-15,24`) — **this correctly prevents the
tick from overlapping itself**, and failures are logged (`console.error`,
`startup/promo-price-sync-scheduler.js:22`) rather than silently swallowed, which is better
practice than most of the rest of the repo. It is a single-process in-memory lock, so it only
protects against overlap within one Node process — if this service is ever run with more than one
PM2 instance/replica, both processes will run the tick independently with no cross-process lock,
and both write to the same `HempProducts`/`ProductPromoTag` collections. Not currently observable
as broken (no evidence of multi-instance PM2 config in this repo), but it is the one place a
GAS-style "two triggers touching one sheet" bug could reappear if this service is ever scaled
horizontally.

## 8. Third-party integrations & secrets

- **MongoDB** (self-hosted/Atlas, 4 separate connections) — credentials via
  `DATABASE_URL`/`HEMP_DATABASE_URL`/`STILO_DATABASE_URL`/`HW_DATABASE_URL` env vars
  (`.env.example:10-13`), obtained correctly (no literals in source) but **the connection string
  including credentials is written to stdout on every boot** (`startup/db.js:16,23,29,36`) — see
  §14.
- **promotion-engine** (internal HTTP service) — `COMPILE_PROMOTION_URL` env var
  (`.env.example:16-17`), called from `createPromotion`/`updatePromotion`
  (`controllers/promotion-controllers.js:278,580`). Not signature-verified (internal call, no
  webhook involved, so not itself a finding) but see §12 for the deeper architectural problem
  this integration sits next to.
- **Reviews.io** — `REVIEWS_IO_APIKEY`/`REVIEWS_IO_STORE`/`REVIEWS_IO_URL`
  (`.env.example:19-22`), used inside cart validation (`controllers/promotion-controllers.js`
  ~919). Not independently deep-audited (out of scope for a promotion service, low risk surface).
- **New Relic** — declared dependency, credentials would be `NEW_RELIC_LICENSE_KEY` by
  convention, but it's never required in code (see §2) and no such var appears in
  `.env.example`'s 10 listed vars — dead integration.
- No payments, SMS, email, push, or METRC/Weedmaps integrations in this repo (out of scope for a
  promotion engine).
- No secrets literal in tracked source (`grep -a` scan matched none; metrics pass agrees:
  "secrets: none matched"). `.env` is correctly gitignored (`.gitignore:1-3` pattern, verified
  present).

## 9. Tests

**None.** `package.json` has no `test` script, no test dependency, and there are zero test files
in the repository (`find . -name '*.test.js' -o -name '*.spec.js'` → empty; confirmed by metrics:
"test files: 0"). `README.md:207-208` states this plainly and accurately. Nothing is covered.
Given this service does 4-database writes, a 30-min interval catalog rebuild job, and unguarded
CRUD on production promotions, the complete absence of tests is a standing risk, not a stylistic
gap.

## 10. Build & deploy

`.github/workflows/dev.yml`: triggers on push to branch **`feat/admin_promo`** (not `main`/
`master`) or manual dispatch; runs on a **self-hosted** runner; the deploy step is
`cd /var/www/html/node-js/promotion-backend/ && git pull origin feat/admin_promo && pm2 restart
promotion-backend` (`.github/workflows/dev.yml:19-27`) — i.e., **no build step, no test gate, no
install step** even on deploy; it assumes `node_modules` is already correct on the server and
just re-pulls and restarts under PM2. There is exactly one environment (whatever `feat/admin_promo`
+ that one server represents) — no separate dev/stage/prod distinction visible anywhere in the
repo. **Open question for the owner**: this repo's checked-out branch is `main`
(`git status` → "On branch main"), but the only CI trigger fires on `feat/admin_promo` — either
`main` is stale relative to what's actually deployed, or the workflow file itself is stale and no
longer reflects how this service ships; can't be resolved from the repo alone. Logging is
`console.log`/`console.error` only (28 `console.log` call sites per metrics, verified spot checks
in `startup/db.js` and `common/index.js`) — no structured logger, no log level control, and (per
§3) some of those log lines leak DB credentials.

## 11. Hardcoded values

Counts (verified, metrics corrected — see §2 for the two false-positive categories removed):
- **2** commented-out internal dev-tunnel URLs left in source:
  `controllers/promotion-controllers.js:279` (`//const promoUrl="https://r2ds44gk-3080.inc1.devtunnels.ms/api/v1/engine/compile-promotion"`)
  and `:581` (same pattern, different path). Dead code, but it leaks that a developer's personal
  devtunnel was used to test the `promotion-engine` integration — worth removing, not a security
  hole since it's commented out and the tunnel is presumably long expired.
- **6** hardcoded MongoDB ObjectIds, all currently commented out, in
  `controllers/product-listing-controller.js:114-119` (an `excludedCategoryIds` array meant to
  exclude specific categories from listings — currently a no-op since every entry is commented,
  meaning the "exclusion" feature silently does nothing right now). This is a "should be data"
  case — category exclusion belongs in the `Category` document (a `hidden`/`excluded` flag) or a
  config collection, not a literal ID array in a controller.
- Default platform literals scattered through controllers instead of one constant:
  `platform = 'stilo'` (`controllers/product-listing-controller.js:20,89` and others),
  `platform = "hyperwolf"` as the `Promotion` schema default (`models/Promotion.js:88`), and
  `platform: "hemp"` as the scheduler default (`index.js:30`, `startup/promo-price-sync-scheduler.js:8`)
  — three different implicit default platforms depending on which file you're reading, with no
  single source of truth for "what platform means when unset."
- **README/code contradiction**: `README.md:75-76` and `README.md:236` both state *"No
  `.env.example` is committed to this repository"* — this is **false**; `.env.example` is
  present, tracked, and was committed in the same initial commit
  (`git log --oneline -- .env.example` → `d1bd9a8`), 26 lines, fully populated with all 10 env
  vars the app reads. Whoever wrote the README either wrote it against an earlier state of the
  repo or never re-checked after `.env.example` was added.
- The `require: true` (vs. `required: true`) Mongoose schema-option typo appears in **two** of the
  three platform Category models — `models/Hemp/Category.js:6,13` and
  `models/Stilo/Category.js:6,15` — but was already fixed in the third,
  `models/Hyperwolf/Category.js:5,18` (`required: true`). Mongoose silently ignores the unknown
  `require` key, so `categoryName`/`categoryId` are **not actually required** on Hemp/Stilo
  categories despite the schema author's evident intent; this is presence-of-code, not
  configuration, but it's the clearest single piece of evidence in the repo that these three
  "platform variant" model files are hand-copied, not templated or shared.

## 12. Duplicated code

**Inside this repo**: there are **three independent implementations of "evaluate a promotion
rule against a cart"** live in this one service simultaneously:
1. `common/index.js` (10,939 lines) — a machine-generated `@vercel/ncc` webpack bundle (confirmed
   by its `webpackBootstrap`/`__nccwpck_require__` wrapper, `common/index.js:1-2,10919-10938`),
   wired in via `controllers/promotion-controllers.js:12` (`const ruleEngine =
   require('../common/index.js')`) and invoked for real cart-time evaluation at
   `controllers/promotion-controllers.js:862` (`ruleEngine.initializePromotionEngine`) and `:921`
   (`ruleEngine.runCartPromotions`). This is the **production path** used for `POST /validate`.
2. `engine/` (`ruleEvaluator.js`, `operatorRegistry.js`, `actionExecutor.js`,
   `attributeResolvers/index.js`, ~417 lines total) — a second, hand-written, AND/OR/CONDITION
   tree engine, wired only through `services/promotionService.js` (`applyPromotions`) into the
   single route `POST /dynamic/validate` (`routes/promotion-routes.js:14`,
   `controllers/promotion-controllers.js:1022,1035`). It has its own operator set, its own
   attribute-resolution domains (`user`/`cart`/`time`/`product`), and its own action-execution
   semantics — none of it shared with either of the other two engines.
3. `promotion-engine` (sibling repo, `engine.js`, 2,316 lines) — the actively developed source
   that `common/index.js` was originally *built from* (see below) and that this repo calls over
   HTTP for compilation only (`COMPILE_PROMOTION_URL`, §8), never for evaluation.

**Cross-repo — `promotion-backend` vs `promotion-engine` (verified, not just the metrics lead)**:
`common/index.js`'s bootstrap wrapper (`/******/ __nccwpck_require__`) and its
`module.exports = {compilePromotion, runCartPromotions, compileRules, buildProductFacts,
buildUserFacts, evaluateCartRule, executeCartActions, evaluateProductRule, executeProductActions,
evaluateUserRule, executeUserActions, isPromotionActive, initializePromotionEngine}`
(`common/index.js:668-684`) is **the exact same public export shape**, in the same order, as
`promotion-engine/engine.js:2301-2314` today, and `promotion-engine/package.json:13` literally
declares `"build:bundle": "ncc build index.js -o bundle"` — i.e. **`common/index.js` is (or was)
the output of that exact command run against an earlier revision of `promotion-engine`**, checked
into `promotion-backend` as a vendored, opaque, unreadable artifact instead of a versioned
dependency or a runtime HTTP call. The bundle's `runCartPromotions`/`initializePromotionEngine` do
**not** contain several functions that exist in the current `promotion-engine/engine.js` — grepped
for `applyFreeGiftsToCart`, `mergeShippingCharges`, `deriveCartSnapshot`, `evaluateEligiblePromotions`,
`stripPromotionArtifacts` (all present in `promotion-engine/engine.js:122,780,883,1037,1097-1108`)
against `common/index.js`: **zero matches for any of them**. In plain terms: `promotion-backend`'s
live checkout flow is running a **stale, frozen snapshot** of the cart-evaluation logic that has
since gained free-gift application, shipping-charge merging, and cart-snapshot handling in the
live `promotion-engine` repo — and there is no mechanism in this repo to detect or re-sync that
drift. This is the single most important structural finding for the "which is used, which is
duplicated" question the owner asked about (full relationship written up separately below, per
the task's instruction to state it precisely).

- `services/category-brand-composite.js` carries a comment at line 2: `"Keep in sync with
  promotion-engine/rule-types/product/category-brand-composite.js"` — a **manually-maintained**
  duplicate, self-admitted in the source. Verified: after stripping comments/whitespace, the two
  files' logic is currently byte-identical (`diff` on comment-stripped content → no output); only
  JSDoc differs (`promotion-engine`'s copy has more documentation,
  `promotion-engine/rule-types/product/category-brand-composite.js:2-4,51-60`). Not drifted
  today, but "keep in sync" is a process, not a guarantee — see §12 lesson above for what happens
  when that process lapses.
- Per §11's cross-repo family: `models/Hemp/Brand.js` is ~99% identical to
  `hemp-backend:models/Brand.js` (verified: only the DB-connection binding line differs — module-
  vs. `global.dbConnections.conn2` — and a missing trailing newline); `models/HempProducts.js` is
  ~98% identical to `hemp-backend:models/HempProducts.js` (verified: `hemp-backend`'s copy has one
  extra field, `proportionalDiscount: Number`, that `promotion-backend`'s copy lacks — an actual
  drift, not just a connection-binding difference) and to `hyperwolf-backend`'s copy per the
  cross-repo lead. `startup/db.js` is ~79% similar to `hyperwolf-backend:startup/db.js` (verified:
  `hyperwolf-backend`'s version only opens 3 connections; `promotion-backend`'s is the same file
  with a 4th connection block pasted in) — the same copy-paste-and-extend pattern as the model
  files.
- Within this repo's own `models/` directory: the three `{Hemp,Stilo,Hyperwolf}/{Brand,Category,
  Region}.js` files are pairwise 80-99% identical to each other with small, undocumented field
  differences (verified via `diff`, §11) — this is the same "copy per platform instead of
  parameterize by platform" pattern repeated three times over, and it is why the `require`/
  `required` typo bug in §11 could exist in two of three copies and not the third.

## 13. Dependency risk

- **Mongoose 5.x** — EOL, no security patches; current major is 8 (which the sibling
  `promotion-engine` already runs). Upgrading is a real migration (Mongoose 5→8 changed
  connection/query internals significantly) and this repo has zero tests to catch regressions.
- **Express 4.x** — maintained but a major behind; low urgency on its own.
- **`newrelic`, `mongoose-sequence`** — declared, never imported (verified §2). Dead weight in
  `npm install` and a false signal to anyone reading `package.json` expecting APM or
  auto-increment IDs to be active.
- **No pinned Node version** (`engines` absent) — nothing stops a deploy on a Node major the code
  was never tested against.
- No frontend in this repo, so no bundle-size axis applies.
- "Imported but not declared: *25%" from the metrics pass could not be independently re-verified
  precisely in the time available for this audit; spot checks (`dotenv`, `joi`, `cors`, `express`,
  `mongoose`) all resolve to declared deps. Flagging as **not fully re-measured** rather than
  repeating the metrics number as verified.

## 14. Security findings

1. **Critical — every route is unauthenticated.** Verified end-to-end trace: `index.js` → no auth
   middleware → `startup/routes.js:15-16` → `routes/promotion-routes.js` (10 routes) +
   `routes/product-listing-routes.js` (4 routes) → zero handlers with a second middleware
   argument. Anyone who can reach this service over the network can create, read, update, or
   **delete** any promotion (`DELETE /api/v1/admin/promotion/:id`,
   `controllers/promotion-controllers.js` `deletePromotion`), forge arbitrary discount rules
   (`POST /create`, `POST /create/rule`), or trigger a full catalog re-scan
   (`POST /product-tags/rebuild`). Fix: add an auth middleware (shared JWT/service-token check
   consistent with how the other Hyperwolf backends authenticate their `/admin/` routes) at the
   `app.use('/api/v1/admin/...')` mount points in `startup/routes.js`, not per-route, so no future
   route can be added unguarded by accident.
2. **High — DB credentials logged to stdout on every boot.** `startup/db.js:16,23,29,36`:
   `console.log(\`Connected to Database N: ${dbN}\`)` where `dbN` is the full
   `mongodb+srv://user:pass@...` connection string from the env var. Anywhere these logs are
   collected (PM2 logs, a log aggregator, `pm2 restart` output captured by the CI runner) now
   holds a copy of production DB credentials in plaintext. Fix: log only the host/DB name
   (`new URL(dbN).host`), never the full string.
3. **Medium — CORS wildcard on an admin API.** `index.js:7`: `app.use(cors())` with no options —
   default `cors` behavior reflects the request's `Origin` and allows it, for a service whose
   entire surface is `/api/v1/admin/...`. Combined with finding #1 (no auth), any web page can
   `fetch()` this API from a victim's browser and get a response back. Fix: pass an explicit
   allow-list of the admin-frontend origin(s) to `cors()`.
4. **Low — predictable promo codes.** `generateRandomPromoCode`
   (`controllers/promotion-controllers.js:223-230`) uses `Math.random()` over a 32-character
   alphabet for 6-character codes. Not a cryptographic secret, but promo codes have real monetary
   value and `Math.random()` is guessable/brute-forceable faster than `crypto.randomInt`; low
   severity because the uniqueness check against the DB (`generateUniquePromoCode`,
   `controllers/promotion-controllers.js:232-244`) at least prevents collisions, and there's no
   rate limit stopping someone from brute-forcing a discovered pattern (compounds with #1: no auth
   means no rate limit is even possible to add cheaply without first adding identity).
5. **Low — mass-assignment-adjacent pattern.** `createPromotion`/`updatePromotion` destructure a
   large, explicit list of expected fields out of `req.body`
   (`controllers/promotion-controllers.js:252-276`) rather than spreading `req.body` directly into
   `Promotion.create`/`findByIdAndUpdate` — this is actually the **safe** pattern, called out here
   only because it is inconsistent with the schema's own `mongoose.Schema.Types.Mixed` fields
   (`rule`, `actions`, `rules`, `ruleTree` — `models/Promotion.js:96-116`), which accept
   **arbitrary, unvalidated nested JSON** with no shape checked by Mongoose or Joi. Not classic
   mass assignment, but the net effect (unvalidated arbitrary structure lands in the DB and is
   later `eval`'d by three different rule engines, §12) is the same risk in different clothing.
6. **No IDOR beyond #1**: every ID-scoped handler (`getPromotionById`, `updatePromotion`,
   `deletePromotion`) loads by `_id` with no ownership/tenant check — but since there is no auth
   at all, "IDOR" is subsumed by finding #1 rather than being a distinct escalation.
7. **No injection findings**: no SQL, no `$where`, no raw regex built from unescaped user input
   into a Mongo query (`getPromotions`'s `$regex: searchTerm` at
   `controllers/promotion-controllers.js` ~503 is **ReDoS-adjacent** if `searchTerm` is
   attacker-controlled and unbounded in length — worth a `escapeRegex`/length cap, matching the
   pattern this repo already uses correctly elsewhere at `services/product-promo-tag.service.js:195`
   `escapeRegex`). Marking this **Low** rather than omitting it, since the fix is a one-line
   application of a helper already present in the same repo.
8. No file uploads, no `dangerouslySetInnerHTML` (no frontend), no open redirects in this repo.

## 15. Performance findings

1. **Medium — `HempProducts` has zero explicit indexes** (`models/HempProducts.js`) despite being
   queried by `productId` (unique-by-convention but not enforced by an index — only `sku` and
   `productId` carry `unique: true`, which *does* create an index; but the field is queried by
   `brandSlug`, `category`, THC fields, and `inventories.regionId` all through
   `services/product-promo-tag.service.js` with **no supporting indexes** — e.g. lines 175, 237,
   258 `HempProducts.find(...)` with query shapes on `strainType`/`productTraits`/THC fields that
   have no index). On a large catalog this degrades to collection scans on every promo-tag
   rebuild tick (every 60s by default, §7).
2. **Medium — N+1-shaped resolution loop.** `services/product-promo-tag.service.js:575`
   `resolveOneCompositeBlock` is called once per composite rule block from
   `resolveCompositeCategoryBrandForIndex` (line 558), and internally issues its own
   `HempProducts.find`/`Product.find`/`StoreProducts.find` calls per platform per block
   (lines 603-844) — for a promotion with several composite (category+brand) IF rules, this is a
   query per rule block per rebuild tick rather than one batched query.
3. **Low-Medium — uncapped `limit` on two paginated endpoints.** `getPromotions`
   (`controllers/promotion-controllers.js:460-470`) and `getProductListing`
   (`controllers/product-listing-controller.js:22-56`) both do `Number(limit)` straight into
   `.limit()` with no server-side maximum — a client requesting `limit=1000000` gets exactly that
   many documents pulled and serialized.
4. **Low — synchronous work on the request path is not the issue here** (no `sync_fs` hits
   outside the vendored bundle, which uses one `fs` sync call inside a library init path,
   `common/index.js:401`, not per-request).
5. The background scheduler itself is well-behaved on this axis (§7): it does not run inside a
   request handler, and its own overlap-guard means it can't pile up.

## 16. Ten things a new developer would trip over

1. `common/index.js` is 10,939 lines of machine-generated webpack output with numeric module IDs
   (`/***/ 71:`) — you cannot `Cmd+click` into it meaningfully, and it is the file the actual
   checkout discount math runs through (`controllers/promotion-controllers.js:921`).
2. There are **three** promotion rule engines in this one repo (`common/index.js`, `engine/`,
   and the HTTP call to `promotion-engine`) and picking the wrong one to "fix a bug in" will not
   fix the bug a customer is hitting, depending on which route they hit (§12).
3. `staticDB.js` is a **directory**, not a file, despite looking exactly like one
   (`startup/routes.js:1` `require('../staticDB.js/apiVersion.json')`).
4. Every model file assumes `global.dbConnections` already exists (§3) — add a new model, forget
   to check require-order, and you get an opaque `Cannot read properties of undefined` at boot.
5. There is no authentication anywhere (§6, §14) — a new developer copying this service's pattern
   into a new one will ship another unauthenticated admin API by default, because nothing in the
   codebase demonstrates what "add auth to a route" looks like.
6. Three near-identical `Brand`/`Category`/`Region` model files per platform, with silent field
   drift between them (§11, §12) — editing `models/Hemp/Category.js` and assuming
   `models/Stilo/Category.js` got the same fix is how the `require`/`required` typo survived in
   two of three copies.
7. `README.md` says there's no `.env.example` (§11) — a new developer will go hunting for
   undocumented env vars that are, in fact, already documented in a file sitting right next to
   the README.
8. The CI workflow deploys from `feat/admin_promo`, but the repo's default/checked-out branch is
   `main` (§10) — pushing to `main` does nothing; you have to know to push to a different branch
   name that isn't mentioned anywhere else in the repo.
9. `services/promotionService.js:36` sorts active promotions by `priority` for the dynamic engine,
   but `Promotion.priority` is a commented-out field in the schema (`models/Promotion.js:18-22`)
   — the sort is a silent no-op; nothing errors, promotions just apply in whatever order Mongo
   returns them.
10. `startup/config.js` only validates `DATABASE_URL` is present — `HEMP_DATABASE_URL`,
    `STILO_DATABASE_URL`, and `HW_DATABASE_URL` are used unchecked in `startup/db.js:7-9,19-36`; if
    any of the other three is missing, you get a raw Mongoose connection-string parse error at
    boot instead of the clear `"DB url not found."` message the config check was meant to provide.

## 17. Grade inputs

| Axis | 1-10 | Justification | Citation |
|---|---|---|---|
| Simplicity | 3 | Three parallel rule engines for one concept (compile+evaluate a promotion) | `common/index.js`, `engine/`, `controllers/promotion-controllers.js:12,862,921` |
| Speed | 5 | Background sync is well-behaved (overlap guard); listing/tag-rebuild paths have real N+1 and missing-index risk | `services/product-promo-tag.service.js:558-844` |
| Security | 1 | Every one of 15 routes, including delete, is reachable with zero authentication | `startup/routes.js:15-16`, `routes/promotion-routes.js:11` |
| Data modelling | 4 | No `timestamps` convention, no soft delete, three drifted per-platform copies of the same three entities | `models/Hemp/Category.js:6` vs `models/Hyperwolf/Category.js:5` |
| Reuse vs hardcoding | 3 | A stale vendored bundle instead of a dependency; a second hand-rolled engine instead of reusing either | `common/index.js:668-684` vs `promotion-engine/engine.js:2301-2314` |
| Testing | 1 | Zero test files, no test script | `package.json:1-25`, confirmed by `find` |
| Upgradability | 3 | Mongoose 5 (EOL) with zero tests to validate a major-version migration; three engines to keep in sync through any schema change | `package.json:21` |
| Operability | 2 | `console.log`/`console.error` only, DB credentials logged at boot, no structured logging or monitoring wired despite `newrelic` being declared | `startup/db.js:16,23,29,36` |
| Developer experience | 3 | A directory named like a file, a README that contradicts the repo it describes, undocumented CI branch mismatch | `staticDB.js/`, `README.md:75-76`, `.github/workflows/dev.yml:5-6` |

## 18. Quick fixes (<1h each), ranked by impact/hour

1. Stop logging full DB connection strings — log `new URL(dbN).host` instead
   (`startup/db.js:16,23,29,36`). ~10 min, removes a live credential leak.
2. Add a shared auth-check middleware at the two `app.use('/api/v1/admin/...')` mount points in
   `startup/routes.js:15-16`. This is the highest-impact fix in the whole audit; scope/design of
   *which* auth mechanism to reuse is the only reason it isn't "trivial."
3. Cap `limit` server-side on `getPromotions` and `getProductListing`
   (`controllers/promotion-controllers.js:460-470`, `controllers/product-listing-controller.js:22-56`)
   — `Math.min(Number(limit)||20, 100)`. ~15 min.
4. Delete the two dead dependencies, `newrelic` and `mongoose-sequence`, from `package.json`
   (§2, §13). ~5 min.
5. Fix the `require: true` → `required: true` typo in `models/Hemp/Category.js:6,13` and
   `models/Stilo/Category.js:6,15` to match the already-correct `Hyperwolf` copy. ~5 min (but
   verify no code currently depends on the validation being a silent no-op before shipping).
6. Delete the two commented-out devtunnel URLs (`controllers/promotion-controllers.js:279,581`)
   and the commented-out `excludedCategoryIds` array (`controllers/product-listing-controller.js:114-119`)
   — either wire the exclusion to real data or remove the dead branch. ~10 min.
7. Correct `README.md:75-76,236` — `.env.example` exists and is fully populated; the README
   should say so and point to it. ~10 min.
8. Swap `Math.random()` for `crypto.randomInt()` in `generateRandomPromoCode`
   (`controllers/promotion-controllers.js:223-230`). ~5 min.
9. Reconcile the CI workflow's target branch (`feat/admin_promo`,
   `.github/workflows/dev.yml:5-6`) with the checked-out `main` — either the workflow or the
   branching model is stale; find out which and fix the mismatch. ~30 min once the owner answers
   the open question in §10.
10. Add an index on `HempProducts` for the fields `services/product-promo-tag.service.js` actually
    queries (`strainType`, `productTraits.traitKey`, THC fields) — mirrors the indexes
    `models/Product.js:26-31` already has for the same *kind* of query on a different collection.
    ~20 min plus a migration window.

## 19. Open questions (for the owner or the contractor)

1. **Which branch is actually deployed?** The repo's checked-out/default branch is `main`, but
   the only CI trigger fires on pushes to `feat/admin_promo` (§10). Is `main` merged into that
   branch out-of-band, is `feat/admin_promo` the real trunk and `main` is vestigial, or is the CI
   file itself stale?
2. **Is `promotion-engine`'s `/evaluate` endpoint meant to replace `common/index.js`'s
   `runCartPromotions` entirely?** Right now `promotion-backend` calls `promotion-engine` only for
   `/compile-promotion` and does cart evaluation locally against a frozen, drifted snapshot
   (§12). Was the intent always for `promotion-backend` to also call `/evaluate` over HTTP once
   it's ready, making `common/index.js` and `engine/` both disposable? If so, is there a tracked
   plan/ticket for that cutover, or did it stall?
3. **Is the `engine/` "dynamic rule engine" (AND/OR/CONDITION tree) a deliberate third
   architecture meant to eventually replace both other engines, or an abandoned experiment?**
   It's wired to exactly one route (`/dynamic/validate`) and nothing else references it. Worth
   knowing before anyone invests further in either the legacy `rules`/`ruleTree` split or a
   fourth engine.
4. **Does anything actually consume the three per-platform Brand/Category/Region models in this
   repo** (`models/Hemp/Brand.js` etc.) beyond `utils/product-listing-utils.js`'s read-only
   listing? If the per-platform admin CRUD for these lives entirely in `hemp-backend`/
   `stilo-backend`/`hyperwolf-backend` (per the near-duplicate models found in §12), is
   `promotion-backend`'s copy read-only by design, or could it silently write stale data if
   someone wires up its unused `brandValidation`/`addCategoryValidation` middlewares to a route
   later?
5. **Who owns fixing the "keep in sync" comment in `services/category-brand-composite.js:2`?**
   It's correct today (§12) but has no test or automated check behind it — is there an appetite
   to extract this into an actual shared package instead of a maintained-by-convention duplicate?

---

## Relation to sibling repo `promotion-engine` (as requested)

**Which is newer**: git history is not a usable signal — both repos were committed as a single
"Initial commit" 9 seconds apart in the same session (`promotion-backend` `d1bd9a8` at 19:34:02,
`promotion-engine` `8e37229` at 19:34:11), which reflects how they were prepared for this audit,
not their real development timelines. Judged by **code content** instead: `promotion-engine` is
the newer, actively-developed codebase — it has `engines.node`, Express 5, Mongoose 8, a real test
runner (`jest --coverage`, even though no test files exist yet), and an `engine.js` containing
functions (`applyFreeGiftsToCart`, `mergeShippingCharges`, `deriveCartSnapshot`,
`evaluateEligiblePromotions`) that are verifiably **absent** from `promotion-backend`'s vendored
copy of the same engine. `promotion-backend`'s `common/index.js` is a frozen build artifact of an
**older** revision of exactly this engine (§12) — so relative to what `promotion-backend` embeds,
`promotion-engine` has moved forward and `promotion-backend` has not kept its copy current.

**Which is used**: both are used, for different halves of the same job, and that split is itself
the problem. `promotion-backend` is the system of record — it owns the `Promotion`/`Rule`/
`PromoCode`/`ProductPromoTag` MongoDB collections, serves all admin CRUD, and is what storefronts
call to validate a promo code at checkout (`POST /api/v1/admin/promotion/validate`). It delegates
only **rule compilation** (turning the admin UI's rule-builder JSON into the engine's internal
format) to `promotion-engine` over HTTP via `COMPILE_PROMOTION_URL` →
`promotion-engine`'s `POST /compile-promotion` (`promotion-engine/routes/promotion-routes.js:18`
→ `controllers/promotion-controllers.js` `compilePromotion`). It does **not** delegate evaluation
to `promotion-engine`'s own `POST /evaluate` endpoint (`promotion-engine/routes/promotion-routes.js:12-15`,
which itself calls `promotion-engine`'s own `runCartPromotions`,
`promotion-engine/controllers/promotion-controllers.js:219`) — instead it re-implements evaluation
locally via the stale vendored bundle. So `promotion-engine` is simultaneously (a) a live
dependency of `promotion-backend` for one operation (compile) and (b) a **duplicated, drifted
implementation source** for another operation (evaluate) that `promotion-backend` chose to copy
rather than call.

**What overlaps**: the entire cart-evaluation surface — `compilePromotion`, `runCartPromotions`,
`compileRules`, `buildProductFacts`, `buildUserFacts`, `evaluateCartRule`/`executeCartActions`,
`evaluateProductRule`/`executeProductActions`, `evaluateUserRule`/`executeUserActions`,
`isPromotionActive`, `initializePromotionEngine` — exists in both `promotion-engine/engine.js`
(current, 2,316 lines) and `promotion-backend/common/index.js` (frozen, 10,939-line bundle,
identical export list, §12), plus a **third**, structurally unrelated implementation of the same
concept in `promotion-backend/engine/` (§12), plus one explicitly-shared, currently-in-sync helper
(`services/category-brand-composite.js` ↔ `promotion-engine/rule-types/product/category-brand-composite.js`,
§12). Net assessment: this is not two systems with a clean API boundary — it is one system
(promotion evaluation) implemented three times with a partial, stale, one-directional HTTP bridge
between two of the three. The highest-leverage fix the owner could make here is deciding whether
`promotion-backend` should call `promotion-engine`'s `/evaluate` for cart-time evaluation the same
way it already calls `/compile-promotion`, and then deleting `common/index.js` and `engine/`
entirely — rather than patching either frozen copy further.
