# promotion-engine — codebase audit

Audited at commit `8e37229` (`git log -1` in `/Users/jt/hyper-tech/promotion-engine` confirms
`8e37229a3ce8cc6105da118cc2ef012d76b09428`, "Initial commit", matches HEAD — pinned SHA verified).
Mechanical metrics pass read from `/Users/jt/POS-Admin/docs/codebase-audit/metrics/promotion-engine.md`
and `.json`; every number below was independently re-derived from source, and corrections are
called out where the mechanical pass was wrong.

## 1. Purpose

A standalone Node/Express microservice that evaluates and compiles cannabis-retail promotion
rules for three storefront platforms (hemp, hyperwolf, stilo — `core/constants.js:153-157`). It
does **not** own promotion CRUD; it is a compute/evaluation service that:
- compiles admin-authored rule JSON into an internal executable form (`POST /compile-promotion`,
  `controllers/promotion-controllers.js:271-325`),
- evaluates a shopper's cart against all active promotions for a platform and returns discounts,
  free gifts, free shipping and upsell hints (`POST /evaluate`,
  `controllers/promotion-controllers.js:37-268`),
- lists active promotions (`POST /userPromotions`, ignores the `userId` it validates — see §16),
- and records post-purchase usage counters (`POST /consume-usage`,
  `controllers/promotion-controllers.js:346-485`).

**Callers** (inferred from code, not README — this repo ships no README): `controllers/promotion-controllers.js:79-81`
has an explicit comment stating `hemp-backend sends userId in engine payload`; the sibling repo
`promotion-backend` calls `POST /compile-promotion` over HTTP via `COMPILE_PROMOTION_URL`
(verified in `promotion-backend/controllers/promotion-controllers.js:278-279`, whose commented-out
line 279 literally contains a devtunnel URL ending in `/api/v1/engine/compile-promotion` — an
exact match for this repo's route). No caller of `/evaluate` was found inside this repo or
`promotion-backend`; it is presumably called directly by `hemp-backend`/`hyperwolf-backend`
(outside this audit's scope — see Open Questions).

**What it calls out to**: MongoDB (three connections: shared promotions DB + one website DB per
platform, §3), and the Blaze Retail partner API for hyperwolf inventory
(`utils/common.js:1017-1073`, `:1121-1149`).

## 2. Runtime & framework

- Node: `"engines": {"node": ">=18.0.0"}` (`package.json:42-44`). Node 18 reached EOL
  2025-04-30; the floor is unenforced beyond a warning, so it does not block running on an
  already-EOL runtime. No `.nvmrc`, no Dockerfile — deploy is `git pull` + `pm2 restart` on a
  self-hosted runner (`.github/workflows/dev.yml:9-19`).
- Framework: Express `^5.2.1`, Mongoose `^8.21.0`, axios `^1.13.6`, jest `^29.7.0`
  (`package.json:26-41`). All dependencies are caret-pinned (12 caret pins per the metrics pass,
  confirmed); a lockfile (`package-lock.json`) is present.
- Not TypeScript — plain CommonJS `.js` throughout, no `@types` usage beyond dev-only `@types/node`.
- Mongoose is a declared, installed dependency but is **not used for the live request path**.
  The only two `conn.model()` calls in the repo (`repositories/cart.repository.js:11`,
  `repositories/promotion.repository.js:11`) reference Mongoose models `"Cart"` and
  `"Promotion"` for which **no `mongoose.Schema` is ever defined or registered anywhere in this
  repo** (verified: zero hits for `mongoose.Schema`/`new Schema(` in the whole tree). Calling
  either repository as written would throw `MissingSchemaError` at runtime. This corrects the
  mechanical metrics pass's "Data model: models: 2 (Cart, Promotion)" — those are not real,
  working models; see §5 and §12 for why (they belong to an entirely dead code path).
  Every actual database read/write in the live path uses the **native MongoDB driver**
  (`db.collection("...")`) reached through a Mongoose `Connection`'s `.db` handle.
- EOL/CVE exposure: not independently checked against an advisory DB (no network access in this
  audit); Express 5 and Mongoose 8 are both current major lines as of the audit date.

## 3. Entry points & boot

`server.js` is the process entry point (`package.json` `start`/`dev` scripts both point at it,
`package.json:14-15`). Boot sequence:
1. `require("dotenv").config()`, build the Express app, install a global CSP header middleware
   applied to every response including 404s (`server.js:17-24`).
2. `startup/config.js` validates required env vars via the `configManager` singleton
   (`core/config.js`).
3. `startup/app.init.js`'s `initializeApplication(platform)` is awaited **twice**, once for
   `"hemp"` and once for `"hyperwolf"` (`server.js:38-39`) — **`"stilo"` is never initialized**
   even though it is a valid `platform` enum value accepted by request validation
   (`core/validation.js:31,67`). A request with `platform: "stilo"` passes validation and then
   500s at `controllers/promotion-controllers.js:88-93` ("Platform stilo not initialized") — a
   real, reachable inconsistency between the validation schema and boot wiring.
4. Each `initializeApplication(platform)` call opens a **platform-specific website connection**
   (`HEMP_DATABASE_URL` or `HW_DATABASE_URL`) but reuses one **shared promotions connection**
   across both platforms via a module-level `sharedPromotionsConnection` variable
   (`startup/app.init.js:7-8,21-25`) — this is the `global.dbConnections`-style multi-connection
   pattern the audit brief calls out, implemented here as closures over module state rather than
   a literal `global.*` object.
5. Global mutable state / landmine: `utils/initialize.js:5-6` holds its own **second, independent**
   pair of module-level singletons (`webConnection`, `promoConnection`), overwritten on every call
   to `initializePromotionEngine()` — which happens once per platform at boot
   (`startup/app.init.js:36-40`). The **second** call (hyperwolf) silently clobbers whatever the
   first call (hemp) set. Today this is harmless only by coincidence: the one live call site that
   reads it back, `engine.js:1231` (`const { promoConnection } = getConnection();`), only ever
   destructures `promoConnection`, and `promoConnection` happens to be the *shared* connection
   object regardless of which platform initialized it last. If a caller ever destructured
   `webConnection` from `getConnection()`, or if `stilo` were wired up with its own non-shared
   promotions DB, this would silently serve one platform's data to another.
6. Routes are mounted only after both `initializeApplication()` calls resolve
   (`startup/routes.js`, `server.js:41`).
7. `core/logger.js:10-14` performs a **synchronous side effect at module-require time**:
   `fs.existsSync`/`fs.mkdirSync` against `<repoRoot>/../logs` (i.e. one directory *above* the
   repo). Every subsequent log call is also synchronous disk I/O — see §15.

## 4. Directory map

| Path | Role | Size |
|---|---|---|
| `engine.js` | The live evaluation/compilation engine; single 2,316-line file | 75,479 B |
| `controllers/` | 1 file, 4 route handlers + health check | 486 lines |
| `routes/` | 1 file, route table | 31 lines |
| `startup/` | Boot wiring: config load, DB init, route mount | 3 files |
| `core/` | Infra: config, logging, errors, validation, financial calc, rule cache, concurrency, adapter, validator, compiler, operators, resolver, db-connection-manager | 16 files, ~2,650 lines — **~1,400 of those lines are dead** (see §12) |
| `rule-types/` | Per-rule-type compiler/context/evaluator/definition for `cart`, `product`, `user`, `bogo`, `time`, `payment` | 6 subfolders, ~9,800 lines |
| `utils/` | Grab-bag of DB/date/inventory/Blaze/normalization helpers | 8 files, ~5,300 lines (`utils/common.js` alone is 1,972 lines — see §6/§16) |
| `application/`, `repositories/`, `presenters/` | An entire second, unwired "clean architecture" implementation of promotion validation (bootstrap → repositories → application use-case → presenter) | 3 files/dirs, ~250 lines, **100% dead** (see §12) |
| `bootstrap.js` | Entry point for the dead `application/`+`repositories/` path above | 34 lines, dead |
| `index.js` | Package main; `module.exports = require("./engine")` | 1 line |
| `staticDB.js/apiVersion.json` | Static API version string echoed by `GET /` | 1 file |
| `.github/workflows/` | Self-hosted-runner CI that `git pull`s and `pm2 restart`s on push to `free-product-and-calculation` | 1 file |

## 5. Data model summary

There are **no Mongoose schemas anywhere in this repo** for the live path (§2). The engine reads
and writes plain MongoDB documents by convention. Reverse-engineered from field access across
`engine.js`, `controllers/promotion-controllers.js`, and the `rule-types/*` evaluators, the shapes
actually read/written are (full field inventory in `promotion-engine.datamodel.md`):

- **`promotions`** (shared promotions DB) — the central document. Money/limits are plain
  `Number` (dollars, not cents — `core/financial-calculator.js:13-24` rounds with
  `Math.round(value * 100) / 100`, a classic float-rounding approach, not integer cents or a
  Decimal type). Status is read/written as a free string but the *actual* writer
  (`promotion-backend/models/Promotion.js:44-47`, sibling repo) constrains it to an enum of only
  `["active", "inactive"]` — yet this repo's own `core/constants.js:189-195` `PROMOTION_STATUS`
  declares five values (`ACTIVE/INACTIVE/PENDING/EXPIRED/ARCHIVED`); three of those five can never
  occur in real data given the actual writer's schema.
- **`activecarts`** (per-platform website DB) — read by `memberId`/`cuid`/`sessionId`, no
  Mongoose timestamps enforced; multi-tenancy key is implicit via which connection (per-platform)
  is queried, not a stored tenant field.
- **`promotionusages`** (shared promotions DB) — per-user consumption ledger, keyed by
  `platform + promotionId + (memberId|sessionId)`, upserted via `$inc` (atomic at the Mongo level
  — see §14/§15 for the non-atomic check-then-act race around it).
- **`hempproducts` / `products` / `storeproducts`** (per-platform website DB) — product/inventory
  documents, queried ad hoc by `productId`, no schema, no index evidence checked (native driver
  bypasses Mongoose index declarations entirely since none exist).
- **`orders`, `blazeusers`, `searchhistory`** (per-platform website DB) — read-only, used by
  `rule-types/user/context.js` and `utils/common.js` for user-targeting rule attributes (spend
  history, last order date, search history, DOB, membership tier).

**Rule schema** (the actual "data model" this service exists to interpret) is a registry of
per-rule-type attribute/action maps in `rule-types/*/definition.js` — six rule types are
implemented (`cart`, `product`, `user`, `bogo`, `time`, `payment`), but `core/constants.js:200-205`'s
`RULE_TYPES` constant only declares four (`CART`, `PRODUCT`, `USER`, `SEGMENT`) — `SEGMENT` maps to
no folder that exists, while `bogo`, `time`, and `payment` (all three actively evaluated in
`engine.js`) are absent from the constant. See the `.datamodel.md` file for every attribute and
action key across all six rule types.

Multi-tenancy: platform (`hemp`/`hyperwolf`/`stilo`) selects which website connection and which
`platform` field filter to use; there is no per-store/per-retailer key below platform level in
this service (delivery region is passed through as `dispatchRegionId`/`inventoryId`, not a schema
field).

## 6. API surface

Mounted at `/api/v1/engine` (`startup/routes.js:11`). Five routes total, matches the metrics pass:

| Method | Path | Middleware | Auth |
|---|---|---|---|
| GET | `/health` | none | **none** |
| POST | `/evaluate` | `validationMiddleware("evaluatePromotions")` | **none** |
| POST | `/compile-promotion` | none | **none** |
| POST | `/userPromotions` | `validationMiddleware("userPromotions")` | **none** |
| POST | `/consume-usage` | none | **none** |
| GET | `/` (root) | none | **none** |

Traced the full chain from `server.js` → `startup/routes.js` → `routes/promotion-routes.js`:
there is **no auth middleware mounted anywhere** — not at the app level (`server.js:14-24` only
sets a CSP header and JSON body parsing), not at the router level, not per-route. `AUTH_TOKEN` /
`PARTNER_KEY` / `API_KEY` env vars exist but are used exclusively as **outbound** credentials to
call Blaze (`utils/common.js:10-11,1026-1028,1131-1132`); `API_KEY` is explicitly documented as
"Reserved... not enforced today" (`.env.example:53`). This **corrects** the metrics pass's
`role_string` hits (`engine.js:287,413,590` etc.) — those are JSDoc/switch-case labels for
`ruleType` (`'cart'|'product'|'user'`), not authorization roles; there is no role concept in this
service at all. **Every one of the five routes is reachable with zero authentication**, including
`POST /consume-usage`, which increments promotion usage counters
(`controllers/promotion-controllers.js:412-417,427-464`) for any promotion ID or code an attacker
supplies, without verifying the order it claims to consume usage for ever existed — see §14.

Input validation is a small hand-rolled allowlist validator (`core/validation.js`), not a library
(no Joi/Zod/express-validator). It does sanitize (strips `<>"'%;()&+`, `core/validation.js:113-120`)
and enforces per-field type/length/enum/regex. Only two of the five routes use it
(`/evaluate`, `/userPromotions`); `/compile-promotion` and `/consume-usage` accept raw, unvalidated
`req.body`.

Pagination: none in this repo's own reads (`promotions.find({...}).toArray()` is unbounded — see
§15); the dead `repositories/promotion.repository.js:26-60` does implement `skip`/`limit`
pagination, but it's unreachable code.

Error shape is consistent: `{ success: false, error: { code, message, details } }` via
`core/errors.js:169-193`'s centralized `errorHandler` — except this handler is **never wired**;
`server.js` never calls `app.use(errorHandler)` (confirmed: `errorHandler` has zero call sites
outside its own definition file). In practice every route uses `asyncHandler` to funnel errors to
`next(err)`, which then hits Express 5's **default** error handler (plain text stack trace, status
500) unless the caller happens to have thrown one of the typed errors with a `statusCode` — Express
5's default handler doesn't know about `.statusCode` either, so **all thrown errors currently
return generic 500s with a stack-trace body**, not the structured JSON shape the code appears to
promise. This is a concrete, verifiable bug: the well-built `normalizeError`/`errorHandler` pair
in `core/errors.js` is completely disconnected from the live app.

Versioning: URL-path (`/api/v1/`), no header/content-negotiation versioning.

## 7. Background jobs

**None.** No cron, no queue, no `setInterval`-driven job in this repo (the `setTimeout` hits the
metrics pass found — `core/errors.js:104,119`, `utils/initialize.js:52,79`,
`core/db-connection-manager.js:236` — are all one-shot retry/timeout races, not recurring jobs).
This differs from the sibling `promotion-backend`, which runs a 60-second promo-price-sync
scheduler (`promotion-backend/startup/promo-price-sync-scheduler.js`) — see the cross-repo section.

## 8. Third-party integrations & secrets

- **Blaze Retail partner API** — `utils/common.js:1017-1073` (`getRegionsMaxQuantity`) and
  `:1121-1149` (`getBlazeProductsByIds`). Base URL from `BLAZE_BASE_URL`, credentials
  `AUTH_TOKEN`/`PARTNER_KEY` from env (`utils/common.js:10-11`). No signature verification needed
  (outbound-only, no webhook). No retry/backoff on these two calls (contrast with
  `core/errors.js`'s unused `retryWithBackoff`).
- **MongoDB** — three connections, all via env-provided URIs (`DATABASE_URL`, `HEMP_DATABASE_URL`,
  `HW_DATABASE_URL`); no `STILO_DATABASE_URL` (consistent with `stilo` never being initialized,
  §3).
- No secret literals found in source (metrics pass "secrets: none matched" — spot-checked, agree;
  `.env.example` only has placeholder tokens like `<auth-token>`).
- `core/db-connection-manager.js:106` deliberately redacts credentials before logging
  (`uri.split("@")[0] + "@***"`) — good practice, in a module that is otherwise entirely unused
  (§12).

## 9. Tests

`package.json:16` declares `"test": "jest --coverage"` and `jest ^29.7.0` is a real devDependency,
but **zero test files exist** in the repo (metrics pass confirmed: `test_files: 0`, and an
independent `find . -iname "*.test.js" -o -iname "*.spec.js"` returned nothing). Running `npm test`
today fails outright (Jest exits non-zero with "no tests found"). Nothing is covered; nothing is
excluded — there is simply no suite.

## 10. Build & deploy

- `npm run build:bundle` → `ncc build index.js -o bundle` (`package.json:13`) — bundles the
  package-main export (`index.js` → `engine.js` and its requires) into a single-file artifact.
  This is precisely the mechanism that produced the **stale, frozen** `promotion-backend/common/index.js`
  bundle checked into the sibling repo (verified independently — see the cross-repo section below).
- Runtime deploy: GitHub Actions self-hosted runner, triggered on push to branch
  `free-product-and-calculation` (not `main` — worth flagging to the owner), runs `git pull` +
  `pm2 restart promotion-engine` directly on the target box as root via `sudo bash -c`
  (`.github/workflows/dev.yml:9-19`). No build step, no test gate, no staging environment evident
  in this repo — whatever is on that branch goes live on the next push.
- Environment separation: a single `.env` per deployment, `NODE_ENV` one of
  `development|production|test` (`core/config.js:61`), no per-environment config files.
- Logging/monitoring: custom structured JSON logger writing to console + local files
  (`core/logger.js`); no APM/New Relic/Sentry wiring found in this repo (contrast:
  `promotion-backend` declares `newrelic` as a dependency but its own README says it's unwired
  too).

## 11. Hardcoded values

Counts below are hand-verified, not just the mechanical regex pass:

1. **Collection names** — 9 distinct native-driver collection name string literals scattered
   across `engine.js` and `rule-types/*`: `orders` (13 occurrences), `hempproducts` (6),
   `promotions` (5), `products` (4), `blazeusers` (4), `storeproducts` (3), `activecarts` (3),
   `promotionusages` (2), `searchhistory` (1). No central constants file for collection names —
   each file re-types the string. Worst offenders: `rule-types/user/context.js:2,109,118,128,142`.
2. **Platform-name branching** — `if (platform === "hemp")` / `"hyperwolf"` / `"stilo"` string
   literals branch behavior in at least 8 places (e.g. `engine.js:1364-1365`,
   `rule-types/product/evaluator.js:1072,1147,1155`, `rule-types/cart/evaluator.js` similarly) —
   this should be data/config (a per-platform adapter/strategy), not `if/else` on a string
   repeated at every call site that needs product data.
3. **Default timezone** `"America/Los_Angeles"` hardcoded in three independent places:
   `engine.js:1204`, `core/validator.js:8`, and implicitly via `utils/timeUtils.js` defaults —
   should be one constant.
4. **Money-adjacent magic numbers**: `price: 0.01` sentinel for free-gift line items
   (`rule-types/product/evaluator.js:1103` and duplicated at multiple free-gift/free-product
   action sites) used to distinguish "free" from "zero" downstream — an implicit, undocumented
   convention rather than an explicit `isFreeGift` flag driving the price (a flag *does* exist —
   `isFreeProduct: true` on the same object — making the `0.01` price entirely redundant
   legacy baggage).
5. **`core/constants.js` itself** is the "should be config" counter-example done right — financial
   precision, timeouts, BOGO limits, HTTP codes, rule types, platform enum, cart-field aliases are
   all centralized there. The problem is that large parts of the *actual* code (§6, §12) don't
   consistently read from it (e.g. `RULE_TYPES` omitting `bogo`/`time`/`payment`, `PROMOTION_STATUS`
   listing statuses the schema can't produce).

Distinguishing "should be config" (platform names, collection names, timezone, Blaze URLs — all
environment/deployment concerns) from "should be data" (the `0.01` sentinel, which is a business
rule about how a free item is represented, and belongs in the promotion document/action shape,
not a magic literal repeated at each evaluator call site).

## 12. Duplicated code

### Inside this repo — a second, entirely dead architecture

This repo contains **two complete, parallel implementations** of "compile + evaluate a promotion,"
only one of which is wired to any route:

- **Live path**: `controllers/promotion-controllers.js` → `engine.js` (`compilePromotion`,
  `runCartPromotions`) → `core/adapter/legacy.js` (`compileIfRulesToLegacy`/
  `compileThenRulesToLegacy`) → `rule-types/*/evaluator.js`.
- **Dead path** (zero inbound references from any route or from `engine.js`'s live functions):
  `bootstrap.js` (34 lines) → `repositories/cart.repository.js` (60 lines) +
  `repositories/promotion.repository.js` (81 lines, both call `conn.model()` against
  never-registered schemas, §2/§5) → `application/validatePromotion.js` (45 lines, calls
  `runCartPromotions(compiledPromotions, facts, {totalSpent, now})` — a **positional-argument
  signature that does not match** `engine.js:1196`'s actual `runCartPromotions(payload)` single-
  options-object signature; this code would throw immediately if ever invoked) →
  `presenters/promotionResponse.js` (63 lines, expects `engineResults[].effects.discounts` shaped
  results that the live engine also doesn't produce in that shape). **Total: 283 lines, 100% dead,
  and internally inconsistent with the live engine even if it were wired up.**
- A **third**, also-dead rule-compilation path: `core/compiler.js` (28 lines) dispatches to
  `rule-types/{cart,product,user}/compiler.js` (172+164+175 = 511 lines). `core/compiler.js`'s
  `compileRules` is imported into `engine.js:22` **only to be re-exported** in
  `engine.js:2301-2315`'s `module.exports` — grepped for `compileRules(` calls anywhere in
  `engine.js`'s body: zero. The function that actually does compilation on the live path is
  `compileIfRulesToLegacy`/`compileThenRulesToLegacy` from `core/adapter/legacy.js`, a completely
  separate implementation. `rule-types/bogo/compiler.js` is a **0-byte empty file**, tracked in
  git (`wc -c` confirms 0), suggesting this alternate compiler path was abandoned mid-build.
- **`core/db-connection-manager.js`** (258 lines) and **`core/concurrency.js`** (248 lines) are
  each fully self-contained, well-written modules with zero import sites anywhere else in the
  repo (grepped `dbManager`, `inMemoryLockManager`, `withLock`, `OptimisticLockManager`,
  `createDistributedLockManager` — only their own definition file matches). **`core/resolver.js`**
  (77 lines) is the same story — zero importers.
- **The advertised rule cache is never used.** `ENABLE_RULE_CACHING`/`CACHE_TTL_SECONDS` are real
  env vars, validated and loaded by `core/config.js:135-136`, and `core/rule-cache.js` (137 lines)
  is a complete, working TTL cache implementation. `engine.js:73` imports `ruleCache` from it —
  but never calls `.get()`/`.set()` on it anywhere in the file (grepped `ruleCache\.` in
  `engine.js`: zero matches). `engine.js:1270-1271`'s `safeCompile` function is explicitly
  commented `// Compile promotion without caching`. Every single `/evaluate` request recompiles
  every active promotion for the platform from scratch, every time — see §15.

**Dead-code total: ~1,405 lines out of 17,727 source lines (~7.9%)** — `core/concurrency.js` (248)
+ `core/db-connection-manager.js` (258) + `core/resolver.js` (77) + `core/compiler.js` (28) +
`rule-types/{cart,product,user}/compiler.js` (511) + `bootstrap.js`/`application/`/`repositories/`/
`presenters/` (283, per above). This does not count the unused `ruleCache` wiring, which is live
code that simply never fires.

- **`core/validator.js:196-286`** carries a second, complete, luxon-based implementation of
  `isPromotionActive` **left commented out** below the live dayjs-based one — 90 lines of dead
  code preserved as a comment rather than deleted (git history already has it).
- **Latent broken reference**: `utils/common.js:1082`'s `getTotalQuantityInActiveCart` calls
  `ActiveCart.find(searchQuery)` where `ActiveCart` is never imported, required, or defined
  anywhere in the file or its requires — it would throw `ReferenceError: ActiveCart is not defined`
  if invoked. It is currently safe only because `rule-types/bogo/evaluator.js:28` imports the
  function but never calls it (grepped `getTotalQuantityInActiveCart(` — zero call sites).

### Cross-repo — verified against `promotion-backend` and the mechanical lead

The metrics-derived cross-repo lead (`CROSS-REPO-DUPLICATES.md:138`,
`0.93 promotion-backend:services/category-brand-composite.js ~ promotion-engine:rule-types/product/category-brand-composite.js`)
is **confirmed and self-admitted in the source**: `promotion-backend/services/category-brand-composite.js:2`
carries the comment `"Keep in sync with promotion-engine/rule-types/product/category-brand-composite.js"`.
Diffing both files after stripping comments/whitespace shows **zero logic differences** today —
only JSDoc (this repo's copy, `rule-types/product/category-brand-composite.js:2-4,51-60`, has more
of it). This is a manually-maintained duplicate across two repos with no shared package, no CI
check, and no test asserting parity — the sync is a documented promise, not an enforced one.

Far more significant, and not in the mechanical lead list at all because it isn't a same-named-file
match: **`promotion-backend/common/index.js` is a 10,939-line `@vercel/ncc` webpack bundle
(confirmed by its `webpackBootstrap`/`__nccwpck_require__` wrapper) whose exports
(`compilePromotion, runCartPromotions, compileRules, buildProductFacts, buildUserFacts,
evaluateCartRule, executeCartActions, evaluateProductRule, executeProductActions, evaluateUserRule,
executeUserActions, isPromotionActive, initializePromotionEngine`) are the exact same list, in the
same order, as this repo's `engine.js:2301-2315` `module.exports` — and this repo's own
`package.json:13` (`"build:bundle": "ncc build index.js -o bundle"`) is the exact command that
produces that shape.** In other words, `promotion-backend` vendors a frozen build of an **older
revision of this very repo** and calls it directly for its own live checkout-validation path
(`promotion-backend/controllers/promotion-controllers.js:12,862,921`), rather than calling this
repo's `/evaluate` endpoint over HTTP. Independently verified the staleness claim by grepping three
functions that exist in the current `engine.js` (`applyFreeGiftsToCart`, `deriveCartSnapshot`,
`stripPromotionArtifacts` — 13 combined hits in `engine.js`) against `promotion-backend/common/index.js`:
**zero hits**. The vendored copy predates free-gift reconciliation, cart-snapshot derivation, and
promotion-artifact stripping that this repo has since gained, and nothing detects that drift.

## 13. Dependency risk

- `p-limit ^6.2.0` — metrics pass flagged this as "declared but never imported." **Corrected**:
  it *is* used, via a lazy dynamic `import("p-limit")` in `rule-types/bogo/evaluator.js:1-8`
  (commented as `// pLimit is ESM-only, lazy-load it via dynamic import`) — a static-require regex
  scanner cannot see this. Not a real finding.
- `mongoose ^8.21.0` declared and installed, but effectively dead weight for the live path — only
  the fully-unreachable `repositories/*.js` call `.model()`, and no schema backs it (§2). If this
  repo is ever slimmed down, Mongoose could be dropped in favor of the native `mongodb` driver it
  already depends on directly, unless the dead code is intentionally being kept for a future
  migration.
- `mongodb ^6.21.0` and `mongoose ^8.21.0` both declared — two MongoDB client libraries for one
  service, only one of which (native `mongodb`, via Mongoose `Connection.db`) is actually queried.
- No abandoned/unmaintained packages identified among the 12 direct/dev dependencies; all are
  actively maintained majors as of the audit date.
- The mechanical metrics pass's "imported but not declared: *25%" is not independently verifiable
  from the tool's raw output alone (the `*25%` value is not a file:line list) — flagging as **not
  measured** rather than repeating an unverifiable number, per the "honest zero" rule.

## 14. Security findings

1. **Critical — every route is unauthenticated, including a state-mutating one.**
   `routes/promotion-routes.js:8-28` mounts `/health`, `/evaluate`, `/compile-promotion`,
   `/userPromotions`, `/consume-usage` with no auth middleware at any level (verified end-to-end
   from `server.js` through the router, §6). `POST /consume-usage`
   (`controllers/promotion-controllers.js:346-485`) lets any unauthenticated caller increment
   `promoUsage` on any promotion (by ID or code, attacker-supplied,
   `controllers/promotion-controllers.js:369-387`) and per-user usage counters, with no check that
   the `orderId` it accepts (`:350`) corresponds to a real, completed order. An attacker can
   exhaust a promotion's `usageLimit` for everyone else, or falsify their own `usageLimitPerUser`
   downward to deny themselves nothing while inflating a competitor's, purely by repeated POSTs.
   **Fix**: require a signed/authenticated service-to-service token (the codebase already has an
   unused `API_KEY` slot, `.env.example:53-54`, and an unused `createAuthenticationError` factory,
   `core/errors.js:36-42`) and verify `orderId` against the platform's order collection before
   crediting usage.
2. **High — check-then-act race on usage limits.** `isGlobalUsageExceeded`/`isUserUsageExceeded`
   (`utils/promotion-helpers.js:94-130`) are evaluated at `/evaluate` time, well before checkout
   completes; the actual increment happens later, out-of-band, at `/consume-usage`. Two concurrent
   checkouts can both pass the limit check and both succeed, exceeding `usageLimit`/
   `usageLimitPerUser` by design of the split. The `$inc` itself is atomic
   (`controllers/promotion-controllers.js:414-417`) but the limit *check* it's supposed to enforce
   is not transactional with it. Compounds with finding #1 since `/consume-usage` isn't even
   scoped to a real order.
3. **Medium — `getUserPromotions` ignores the identity it validates.**
   `controllers/promotion-controllers.js:328-343` destructures `userId` from `req.validatedBody`
   but the Mongo query (`:334-337`) only filters on `status: "active"` — every caller, regardless
   of `userId`, gets the same full list of active promotions for the platform. Not a
   confidentiality leak (promotions aren't secret) but the endpoint's name promises personalization
   it doesn't deliver, which is a correctness/trust issue for anything downstream that assumes
   "user promotions" are actually scoped.
4. **Medium — structured error handler exists but is disconnected.** `core/errors.js:169-193`'s
   `errorHandler` (which would return a consistent `{success:false, error:{code,message}}` shape
   without leaking stack traces) is never registered via `app.use()` anywhere (`server.js` has no
   such call, and grepping `errorHandler(` across the repo shows only its own definition and the
   unrelated `setupGlobalErrorHandlers`). Every uncaught error currently falls through to Express
   5's default handler, which **can** leak a stack trace in the response body depending on
   `NODE_ENV`/`res.locals` state — verify and fix by wiring `app.use(errorHandler)` as the last
   middleware in `server.js`.
5. **Low — no rate limiting despite dedicated config.** `RATE_LIMIT_ENABLED`/`RATE_LIMIT_WINDOW_MS`/
   `RATE_LIMIT_MAX_REQUESTS` are defined in `core/config.js:145-153` and `.env.example:47-50`, but
   no rate-limiting middleware (e.g. `express-rate-limit`) is installed or referenced anywhere in
   the repo — the flags are aspirational. Combined with finding #1, `/compile-promotion` and
   `/consume-usage` have no request-volume defense at all.
6. **Informational — no ReDoS, no injection found.** No `new RegExp()` built from request input
   anywhere in the repo (grepped, zero hits) — the one user-facing regex
   (`core/validation.js:42`, promo-code format) is a fixed pattern. No string-built SQL/Mongo
   query concatenation found; all Mongo filters are object-literal, and the one place an attacker
   fully controls an `_id`-style lookup (`consume-usage`'s `promotionIds`) is defended by
   `ObjectId.isValid()` (`controllers/promotion-controllers.js:381-383`) before use. No
   `dangerouslySetInnerHTML`/templating (this is a pure API service). CORS: no CORS middleware is
   installed at all (no `cors` package, no manual header) — since this is a server-to-server API
   (not browser-called per the `hemp-backend` comment in §1), the *absence* of CORS headers is not
   itself exploitable, but also means there's no origin allowlist if that assumption ever changes.

## 15. Performance findings

1. **High — every log line is a synchronous disk write on the request path.**
   `core/logger.js:85-86`: `fs.appendFileSync(logFile, logJson + "\n")` runs inside `writeLog`,
   which every `logger.info/warn/error/debug` call goes through. `engine.js` alone calls the
   logger dozens of times per `/evaluate` request (per-promotion debug/info logs in the main
   evaluation loop, e.g. `engine.js:1485,1510,1518`). Synchronous file I/O blocks Node's single
   event loop thread for every concurrent request in flight, and the log files
   (`<repoRoot>/../logs/{error,warn,info,debug}.log`) grow forever with no rotation — an
   operational risk independent of the performance one.
2. **High — the rule cache is fully wired for config but never invoked (§12).** Every `/evaluate`
   call recompiles every active promotion for the platform from raw `ifRules`/`thenRules` via
   `core/adapter/legacy.js`, unconditionally (`engine.js:1270-1284`'s `safeCompile`, explicitly
   commented "without caching"). For a platform with hundreds of active promotions this means
   hundreds of rule-tree walks per checkout page load, every time, forever.
3. **Medium — unbounded `find()` on `promotions` inside the request path.**
   `controllers/promotion-controllers.js:130-136` and `engine.js:158` (per the metrics pass, cited
   and verified) both fetch the entire active-promotion set for a platform with no `.limit()`.
   Combined with #2, this scales linearly (recompiled, uncached) with total active-promotion count
   on every single request.
4. **Medium — inconsistent per-request caching across evaluators.** `engine.js:1265-1268`
   allocates a `promotionContext` with `categoryProducts`/`productCache` `Map`s specifically to
   memoize product/category lookups **within one cart evaluation** (multiple promotions in the
   same request shouldn't refetch the same product). `rule-types/cart/evaluator.js:1208-1334` and
   `rule-types/bogo/evaluator.js:259-484` correctly read/write this cache. But
   `rule-types/product/evaluator.js`'s `free_gift`/`free_product` action handlers
   (`:1079-1081,1150-1169`) issue their own uncached `findOne()` per action execution, bypassing
   the cache entirely — a promotion with a free-gift action re-fetches the same product document
   every time it fires, even within a request that already fetched it for a different promotion.
5. **Low — sequential, not batched, per-promotion evaluation.** `engine.js:1476`'s main auto-apply
   loop (`for (const promo of promotionsToRun)`) `await`s `evaluatePromotionRule`/
   `executePromotionActions` one promotion at a time (`engine.js:1552,1587-1589`), each of which
   can issue its own DB round-trip (product/inventory lookups, §15.4). For N eligible promotions
   this is N sequential round-trips where the existing per-request cache (#4, when actually used)
   could collapse many of them, or a batched `Promise.all` could parallelize the independent ones.
6. **Low — `console.log` on the hot path instead of the structured (if synchronous) logger.**
   `engine.js:1325,1399` (and 34 total `console.log`/`console.error` call sites across 8 files per
   the metrics pass, spot-checked in `rule-types/bogo/evaluator.js`, `rule-types/user/evaluator.js`)
   dump full cart/product-id payloads to stdout on every cart load — bypasses log-level filtering
   entirely (`LOG_LEVEL=ERROR` in production would still print these).

## 16. Ten things a new developer would trip over

1. `bootstrap.js`, `application/`, `repositories/`, `presenters/` look like the "proper" layered
   architecture entry point — they are 100% dead and internally inconsistent with the real engine
   (§12). A new dev reading `bootstrap.js` first will build a completely wrong mental model.
2. `repositories/cart.repository.js:11` / `promotion.repository.js:11` call `conn.model("Cart"/"Promotion")`
   against schemas that don't exist anywhere in the repo — this throws if ever exercised.
3. `core/compiler.js` + `rule-types/{cart,product,user}/compiler.js` (511 lines) look like the
   compilation logic; the real compilation path is `core/adapter/legacy.js`, a completely
   different, unrelated implementation reached via `engine.js:51-52`.
4. `ENABLE_RULE_CACHING`/`CACHE_TTL_SECONDS` env vars and `core/rule-cache.js` exist and are
   documented in `.env.example:36-39` — toggling them does nothing; the cache is never called
   (§12/§15).
5. `platform: "stilo"` is a documented, validator-accepted value (`core/validation.js:31,67`) that
   500s at runtime because `server.js:38-39` never initializes it (§3).
6. `POST /userPromotions` validates and requires a `userId`/`memberId` but the handler
   (`controllers/promotion-controllers.js:328-343`) never uses it — the response is identical for
   every caller on a platform.
7. `getTotalQuantityInActiveCart` (`utils/common.js:1076-1119`) references a global `ActiveCart`
   that is never imported anywhere — dead but would `ReferenceError` if ever called (§12).
8. `core/validator.js:196-286` has an entire second `isPromotionActive` implementation (luxon-based)
   commented out below the live one — easy to accidentally "restore" the wrong one during a merge.
9. `utils/common.js` is 1,972 lines mixing loyalty-tier math, Blaze HTTP calls, inventory
   resolution, date arithmetic, and cart-flagging helpers with no sub-module boundaries — finding
   any one function means scrolling or grepping a monolith (40+ top-level functions, §1 metrics).
10. `logs/` is written one directory **above** the repo root (`core/logger.js:11`,
    `path.join(__dirname, "../../logs")`) — a dev running this locally will not find logs inside
    the `promotion-engine` folder at all, and in a `pm2`-managed deploy this writes outside
    whatever directory ops expects to be disposable.

## 17. Grade inputs

| Axis | 1–10 | Justification | Citation |
|---|---|---|---|
| Simplicity | 3 | Three parallel, uncoordinated implementations of "compile a rule" exist in one repo, only one wired up | `core/compiler.js` + dead `application/`/`repositories/` (§12) |
| Speed | 3 | Cache is fully built and configured, never called; sync `fs.appendFileSync` on every log line on the request path | `engine.js:1270-1271` (no-cache comment), `core/logger.js:85-86` |
| Security | 2 | Zero authentication on any route, including an unauthenticated usage-mutation endpoint with no order verification | `routes/promotion-routes.js:8-28`, `controllers/promotion-controllers.js:346-485` |
| Data modelling | 3 | No schema anywhere for the live path; money is float dollars; status enum in constants doesn't match the actual writer's schema | `core/constants.js:189-195` vs `promotion-backend/models/Promotion.js:44-47` |
| Reuse vs. hardcoding | 4 | Centralized `core/constants.js` is a good instinct, undermined by drift (`RULE_TYPES` missing 3 of 6 real rule types) and by 9 uncoordinated collection-name literals | `core/constants.js:200-205` |
| Testing | 1 | `jest --coverage` configured, zero test files exist, `npm test` fails today | `package.json:16`, confirmed 0 files |
| Upgradability | 5 | Business logic (rule-types) is reasonably separable from Express; but a hard Node-version bump risk is low since deps are current majors — the real upgrade risk is organizational (which of 3 compilers is "the" one) not technical | §12 |
| Operability (logging/error handling/config) | 3 | Structured logger and centralized error handler both exist and are well-designed, but the error handler is never wired to the app and logging is synchronous and unrotated | `server.js` (no `app.use(errorHandler)`), `core/logger.js:85-86` |
| Developer experience | 3 | No README in this repo at all; the dead-code-to-live-code ratio (~8%+ measured, likely higher counting unused cache/lock modules) actively misleads | directory listing, §4/§12 |

## 18. Quick fixes (<1h each), ranked by impact per hour

1. Wire `app.use(errorHandler)` in `server.js` so the already-built structured error responses
   (`core/errors.js:169-193`) actually reach clients instead of Express 5's default handler.
2. Delete `bootstrap.js`, `application/`, `repositories/`, `presenters/`, `core/compiler.js`,
   `rule-types/{cart,product,user}/compiler.js`, `rule-types/bogo/compiler.js`,
   `core/db-connection-manager.js`, `core/concurrency.js`, `core/resolver.js` — ~1,400 lines of
   verified-dead code with zero import sites, removable in one PR with a grep-based sanity check.
3. Either call `ruleCache.get`/`.set` inside `safeCompile` (`engine.js:1270-1284`) or delete
   `core/rule-cache.js` and the `ENABLE_RULE_CACHING`/`CACHE_TTL_SECONDS` config surface — stop
   shipping a cache that does nothing.
4. Add a minimal auth check (shared secret header, using the already-present but unused `API_KEY`
   config slot) in front of `/consume-usage` at minimum, given it's the one state-mutating route.
5. Fix `getUserPromotions` to actually filter by the validated `userId`/`memberId`, or rename/
   document the endpoint as "all active promotions for platform" if that's the intended behavior.
6. Initialize `stilo` in `server.js` alongside `hemp`/`hyperwolf`, or remove `"stilo"` from the
   `platform` enum in `core/validation.js:31,67` — pick one so the two stop disagreeing.
7. Replace `core/logger.js:86`'s `fs.appendFileSync` with an async append (or drop file logging
   in favor of stdout-only + the platform's log aggregator) to stop blocking the event loop.
8. Delete the 90-line commented-out `isPromotionActive` in `core/validator.js:196-286`.

## 19. Open questions (for the owner or the contractor)

1. Who calls `POST /evaluate` in production? Not found in this repo or `promotion-backend`; the
   comment at `controllers/promotion-controllers.js:79-81` implies `hemp-backend` calls it
   directly, which would need confirming in that repo (out of this audit's scope).
2. Is `promotion-backend`'s vendored `common/index.js` (a stale build of an older revision of this
   very engine) still intentionally the live checkout-evaluation path, or should `promotion-backend`
   be switched to call this repo's `/evaluate` over HTTP the same way it already calls
   `/compile-promotion`? This is the single highest-leverage architectural decision across both
   repos (see cross-repo relation below).
3. Was the `application/`/`repositories/`/`bootstrap.js` layer an abandoned refactor-in-progress,
   or a scaffold generated but never finished? Worth confirming before deleting (quick fix #2)
   in case there's institutional intent to revive it — as written, it can't currently run.
4. Does anything downstream actually rely on `PROMOTION_STATUS` values other than
   `active`/`inactive` (`PENDING`/`EXPIRED`/`ARCHIVED`, `core/constants.js:189-195`)? If not, the
   constant should shrink to match what `promotion-backend`'s schema can actually produce.

---

## Relation to sibling repo `promotion-backend` (as requested)

**Which is newer**: git history is not a usable signal here — both repos were committed as a
single "Initial commit" seconds apart in the same audit-prep session (`promotion-backend` at
19:34:02, this repo at 19:34:11). Judged by code content instead, **this repo (`promotion-engine`)
is the newer, actively developed one**: it declares an `engines.node` floor, runs Express 5 and
Mongoose 8 (vs. `promotion-backend`'s Express 4 / Mongoose 5), has a real (if empty) test runner
configured, and — most concretely — contains functions (`applyFreeGiftsToCart`,
`deriveCartSnapshot`, `stripPromotionArtifacts`, `mergeShippingCharges`) that are **verifiably
absent** (zero grep hits) from `promotion-backend/common/index.js`, which is itself a frozen
`ncc`-bundled snapshot of an earlier revision of this exact engine (identical, ordered
`module.exports` list between `promotion-backend/common/index.js` and this repo's
`engine.js:2301-2315`; this repo's own `package.json:13` `build:bundle` script is the literal
command that produces that bundle shape).

**Which is used**: both are used, for different halves of the same job. `promotion-backend` is the
system of record — it owns the `Promotion`/`Rule`/`Rules`/`ProductPromoTag` collections and serves
all admin CRUD, and its own `POST /api/v1/admin/promotion/validate` is what a storefront calls to
validate a promo code at checkout, using its **vendored, stale** copy of this engine
(`promotion-backend/controllers/promotion-controllers.js:12,862,921`, verified). `promotion-backend`
delegates only **rule compilation** to this repo, over HTTP, via `COMPILE_PROMOTION_URL` →
this repo's `POST /compile-promotion` (verified: `promotion-backend/controllers/promotion-controllers.js:278-279`'s
commented-out devtunnel URL is an exact match for `routes/promotion-routes.js:18`). It does **not**
call this repo's own `POST /evaluate` for checkout-time evaluation — it re-implements that locally
via the frozen bundle instead. Separately, this repo's `/evaluate` appears to be called directly by
`hemp-backend`/`hyperwolf-backend` (per the in-code comment, §1) — outside this audit's scope to
confirm.

**What overlaps**: the entire cart-evaluation surface —
`compilePromotion`/`runCartPromotions`/`compileRules`/`buildProductFacts`/`buildUserFacts`/
`evaluate*Rule`/`execute*Actions`/`isPromotionActive`/`initializePromotionEngine` — exists three
times across the two repos: (1) this repo's live `engine.js`, (2) `promotion-backend`'s frozen
`common/index.js` bundle of an old version of (1), and (3) `promotion-backend`'s separate,
hand-written `engine/` directory (`ruleEvaluator.js`/`operatorRegistry.js`/`actionExecutor.js`)
used only by its `/dynamic/validate` route — a third, structurally unrelated engine sharing no
code with either of the first two. The one piece that *is* deliberately, explicitly shared is
`category-brand-composite.js` (§12), kept in sync by hand and currently not drifted.

**Are the rule types the same?** **No — inconsistently, in three separate ways:**
1. `promotion-backend/models/Rule.js:11-14`'s `rule_type` enum allows exactly
   `["cart", "user", "product", "bogo"]` (4 values); `promotion-backend/models/Rules.js:27`'s
   parallel `ruleType` field is an **unconstrained string** (comment says only `"product"`/`"user"`
   are expected). Neither matches this repo.
2. This repo's `engine.js` actively compiles and evaluates **six** rule types —
   `cart`/`product`/`user`/`bogo`/`time`/`payment` (`rule-types/*`, all six wired into
   `engine.js:22-93`'s requires and used in its evaluation switch, e.g. `engine.js:585-595`).
3. This repo's own `core/constants.js:200-205` `RULE_TYPES` constant lists only **four** —
   `CART`, `PRODUCT`, `USER`, `SEGMENT` — and `SEGMENT` corresponds to no folder or evaluator that
   exists anywhere in the repo, while `bogo`, `time`, and `payment` (all three live) are simply
   missing from the constant that's supposed to enumerate them.

Net: there is no single, authoritative list of "the rule types" shared by (or even consistent
within) either repo. The highest-leverage fix available to the owner is deciding whether
`promotion-backend` should call this repo's `/evaluate` for checkout-time evaluation the same way
it already calls `/compile-promotion` — and then deleting `promotion-backend/common/index.js` and
`promotion-backend/engine/` entirely, plus reconciling the rule-type enums to one source of truth —
rather than continuing to patch three drifting copies of the same system.
