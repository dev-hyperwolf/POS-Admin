# distribution-backend — codebase audit

Repo: `/Users/jt/hyper-tech/distribution-backend` pinned at `aaa6ecb79ccea079f14505f4bbc5a7ffa666cfde` (matches requested SHA `aaa6ecb`, working tree clean, `nothing to commit`).

Mechanical metrics reviewed: `/Users/jt/POS-Admin/docs/codebase-audit/metrics/distribution-backend.md`/`.json`. Its numbers are corrected below where verification showed them wrong.

---

## 1. Purpose

A Node/Express backend that manages **inventory distribution and fleet kit logistics** for Hyperwolf (and, via shared code, Stilo). Per `README.md` and `startup/routes.js`, it:

- Builds weekly "kit" distributions of product to drivers/regions (`KitTemplate` → `KitDistributed` → `KitDispatch`), tracks daily refills, and reconciles what a driver actually scans against what was assigned (`controllers/driverKitVerification/`, `controllers/kitRefill/`).
- Syncs inventory/orders with **Blaze** (external POS) — `controllers/blaze/blaze-syncing-controller.js` (3,822 lines): creates Blaze inventory transfers, checks sold quantities, syncs safe-inventory counts.
- Handles discrepancy management, end-of-day closure/reconciliation (`controllers/closureOverview/`), aging-rules for stale product, and waste inventory.
- Generates PDF box/driver reports via Puppeteer + EJS (`templates/*.ejs`), emits live scan events over Socket.IO (`common/socket.js`, `common/scanHandler.js`), and sends transactional email via SendGrid.
- Is called by: an admin web app (JWT-protected `/api/v1/admin/*` routes) and presumably a driver-facing mobile/PWA client (PIN login at `/driver-kit-verification/pin/login`, scan endpoints, Socket.IO).
- Calls out to: Blaze REST API (`BLAZE_BASE_URL`/`RETAIL_BLAZE_BASE_URL`), AWS S3 (uploads), SendGrid (email), and reaches directly into **two other services' MongoDB databases** (see §3) rather than calling their APIs.

## 2. Runtime & framework

- **Node version**: not pinned anywhere — no `engines` in `package.json`, no `.nvmrc`, no `Dockerfile` in the repo (deploy workflow runs `docker compose up --build` against a compose file that isn't in this repo). README claims "CI uses Node 20" — verified true only for `.github/workflows/security.yml`'s `npm-audit` job (`actions/setup-node@v4` `node-version: '20'`); the actual deploy workflow (`dev.yml`) never sets up Node at all (deploys via `docker compose` on a self-hosted box, so the real runtime version lives outside this repo).
- **Framework**: Express `^5.1.0`, Mongoose `^8.17.1`, Socket.IO `^4.8.3`, node-cron `^4.2.1` (all cron schedules currently commented out, see §7), Joi `^18.0.0`, jsonwebtoken `^9.0.2`, aws-sdk `^2.1692.0` (v2, in maintenance mode — AWS's own EOL notice targets Sept 2025 for new feature support), `@sendgrid/mail` `^8.1.6`, puppeteer `^24.22.3`.
- **DB + ORM**: MongoDB via Mongoose, **three separate connections** (`global.dbConnections.conn1/2/3`) — see §3/§5.
- **TypeScript**: none — plain JS throughout, 86 source files, 36,485 lines.
- **Pinning**: everything in `package.json` is caret-pinned (`^`) — no exact pins. **No lockfile**, and it's not an oversight: `.gitignore:5` explicitly lists `package-lock.json`. Combined with `npm install --legacy-peer-deps` as the documented install command (README), two installs a week apart can resolve different transitive dependency trees with no way to diff or roll back. CI's `security.yml` even branches on lockfile presence (`if [ -f package-lock.json ]`) — that branch is dead code in this repo since the file is actively excluded.
- **EOL/CVE exposure**: `aws-sdk` v2 (legacy, superseded by `@aws-sdk/client-s3` v3), Express 5 and Joi 18 are both recent majors (fine). `npm audit` was not run as part of this audit (no lockfile to audit against without a fresh install, which the read-only rule prohibits) — "not measured".

## 3. Entry points & boot

`index.js` is the process entrypoint:
1. `dotenv.config()`, then `startup/config.js` — throws if `DATABASE_URL` or `PUBLIC_TOKEN` is missing (fail-fast).
2. `startup/middleware.js(app)` — security headers, static file serving, JSON/urlencoded body parsing (200 MB limit each), CORS, and mounts `partnerAuth` middleware at `/` for **every** route (see §6 — it does not actually enforce anything).
3. `startup/db.js()` — opens **three** Mongoose connections in sequence and stores them on `global.dbConnections`:
   - `conn1` = `DATABASE_URL` — this service's own data (kit templates, distributions, discrepancies, regions).
   - `conn2` = `HEMP_DATABASE_URL` — `Admin` (admin auth) and `ResetRequest` live here, i.e. **distribution-backend authenticates admins against the hemp-backend database**, not its own.
   - `conn3` = `HYPERWOLF_DATABASE_URL` — `Brand`, `Category`, `Fleets`, `Order`, `Product`, `ProductBatch`, `Miscellaneous`, `Closeout`, `OnDutyChecklists`, `FleetOnDutyChecklists`, `FleetOffDutyCloseout` all live in **hyperwolf-backend's** database and are read/written directly by this service.
   If any connection fails, `db.js:24` calls `process.exit(1)` — a bad password/URL on any one of three unrelated databases takes the whole service down at boot.
4. `startup/routes.js(app)` — mounts all route groups, a root `/` welcome text (`"Welcome to Distribution APIs:1.0.6"` — hardcoded version string, `startup/routes.js:17`), and a 404 fallback.
5. `global.messages = require('./locales/en')`, `startup/nodeCrons.js()` (all schedules commented out, §7), then creates an `http.Server`, attaches Socket.IO (`common/socket.js`), and listens on `PORT` (default 3067).
6. Startup errors are swallowed to `console.log(ex, 'error in index.js')` — no process exit, no alert; a failed boot can leave a half-initialized process that still appears "up" to a process manager.

**Global mutable state**: `global.dbConnections` (3 live Mongoose connections) and `global.messages` (locale strings) — both set once at boot and read throughout controllers/models with no accessor layer.

**Architecture concern (carries into §5, §12)**: this service does not call hemp-backend's or hyperwolf-backend's HTTP APIs for `Admin`/`Fleets`/`Order`/`Product`/etc. — it opens its own Mongoose connection straight into their databases and defines its own (independently drifting) copies of their schemas. `models/Fleets.js` here is a 0.82 near-duplicate of `hyperwolf-backend:models/Fleets.js`, `models/Order.js` is a 0.78–0.82 near-duplicate of the `Order` model in both hyperwolf-backend and hyperdrive-backend (see §12). A schema change in hyperwolf-backend's `Fleets` model silently does not propagate here — the two copies only agree by convention.

## 4. Directory map

| Path | Role | Size |
|---|---|---|
| `index.js` | Process entrypoint (Express + HTTP + Socket.IO) | 34 lines |
| `startup/` | Boot sequence: config validation, 3x DB connect, middleware, route mounting, cron (all disabled) | 5 files |
| `routes/` | Route definitions, one subfolder per feature, thin (just wiring + inline `[admin]`/validation middleware) | 12 files |
| `controllers/` | Request handlers — the bulk of the business logic, several single files 1,800–5,700 lines | 13 files/subfolders |
| `repositories/` | Larger data-access/report-generation classes for aging rules, kit templates, and manage-distributions (the biggest file in the repo, 5,615 lines) | 3 files |
| `services/` | Two small helpers for scan-item and scanned-summary logic used by the socket handler | 2 files |
| `models/` | Mongoose schemas + inline Joi validators, 32 files across 3 DB connections; one (`ManageDistributions.js`) is a 0-byte dead file | 32 files |
| `middlewares/` | auth (JWT), admin/super-admin gate, a static-token auth (unused, see §6), partner-header injector (broken, see §6), file upload, S3 upload helper | 7 files |
| `common/` | Socket.IO init + scan handler, SendGrid wrapper, toast message strings, small Blaze HTTP helper | 5 files |
| `locales/` | `en.js` — response message strings | 1 file |
| `templates/` | 4 EJS report templates (Puppeteer-rendered PDFs) + 1 hardcoded HTML email template (JS string, not EJS) | 5 files |
| `.github/workflows/` | `dev.yml` (self-hosted Docker deploy, no tests run) and `security.yml` (multi-language security scan matrix, only the Node/`npm-audit` job actually applies) | 2 files |

No `tests/` directory exists (see §9).

## 5. Data model summary

**32 model files, 31 live models** (`models/ManageDistributions.js` is 0 bytes and is never `require`d anywhere in the repo — confirmed via `grep -arln "ManageDistributions.js\|require.*ManageDistributions"`; the string "ManageDistributions" that the metrics tool matched in `repositories/manageDistributions.repository.js` is a class name, not a reference to the model file).

**Connection split** (verified by grepping every model file for `dbConnections.conn`):
- **conn1** (`DATABASE_URL`, this service's own DB) — 18 models: `AgingRules`, `Boxes`, `Discrepancy`, `DistributedBatchesLogs`(`distributedProductLogs`), `DistributionActivityLogs`(`ActivityLog`), `DistributionGlobalSettings`, `Inventory`, `KitBoxes`, `KitDispatch`, `KitDistributed`, `KitRefill`, `KitTemplate`, `Regions`, `RemovedSafeProducts`, `SubRegions`, `boxProduct`(`BoxProduct`), `distributionRefillLogs`(`DistributionRefillLogs`), `regionDriverAssignment`(`RegionDriverAssign`), `templateSku`(`KitTemplateSku`).
- **conn2** (`HEMP_DATABASE_URL`) — 2 models: `Admin`, `ResetRequest`.
- **conn3** (`HYPERWOLF_DATABASE_URL`) — 11 models: `Brand`, `Category`, `Closeout`(`closeOut`), `FleetOffDutyCloseout`, `FleetOnDutyChecklists`, `Fleets`, `Miscellaneous`, `OnDutyChecklists`(`onDutyChecklists`), `Order`, `ProductBatch`, `Products`(`Product`).

**Multi-tenancy key**: `platform` string enum (`'hyperwolf' | 'stilo'`), present on `AgingRules`, `Boxes`, `DistributionGlobalSettings`, `KitBoxes`(validation only), `KitTemplate`, `KitTemplateSku`, `Regions`, `SubRegions` — but **absent** from `KitDistributed`, `KitDispatch`, `Discrepancy`, `Fleets`, `Order`, `Product` (the actual transactional/central models). Store/region scoping for those runs through `regionId`/`subRegionId` (plain `String` on `AgingRules`, `Inventory`, `Discrepancy`, `RegionDriverAssign`; `ObjectId` refs on `KitDispatch`, `KitDistributed.regionData[].regionId`, `KitTemplate`) — the ID type for the "same" logical field is inconsistent across models.

**Timestamps**: three different conventions coexist with no apparent rule:
- Epoch-`Number` `createdDate`/`updatedDate` (no default; caller must set it) — most conn1 models (`Boxes`, `Brand`, `Regions`, `SubRegions`, `KitTemplate`, etc.).
- Epoch-`Number` with `default: Date.now` — `Discrepancy`, `distributionRefillLogs`, `regionDriverAssignment`.
- Actual `Date` type with `default: Date.now` — `Closeout`, `FleetOffDutyCloseout`, `FleetOnDutyChecklists`, `OnDutyChecklists`, `Fleets` (`createdDate`/`updatedDate`/`lastLoginDate`).
A query that assumes one convention (e.g. a `Date` range filter) against a model using the other will silently return nothing rather than erroring.

**Soft delete**: only `Fleets` has `isDeleted`/`deletedBy`. No other model has any soft-delete field — `Boxes`, `Discrepancy`, `KitTemplate`, `Regions`, etc. are physically deleted (`deleteOne`/`findByIdAndDelete`, confirmed present in their controllers) with no recovery path or audit trail beyond whatever's in `ActivityLog`.

**Money/quantity fields**: no dedicated money type exists — `unitCost`, `wholeSaleValue`, `retailValue`, `amount`, `canpay_amount` are all `Number` (dollars, not cents — no evidence of cent-based storage anywhere). One outlier: `Discrepancy.discrepancyAmount` is typed **`String`**, not `Number`, unlike every sibling amount field in the same schema (`amount: Number` exists two lines away) — `models/Discrepancy.js:12` vs `:45`.

**Central models** (by fan-out and reference count):
1. **`KitDistributed`** (63 fields per the metrics scan; verified — it is a deeply nested weekly-distribution document with `backupRegionData[]` and `regionData[]`, each containing `items[]`, each containing `productBatches[]`, `productBatchesBlaze[]`, and `refillLogs[]` sub-arrays that recursively re-nest `productBatches`/`productBatchesBlaze` again). This is the transactional core of the whole system and has **zero indexes** despite being queried by `distributionId`, `regionData.items.refillLogs.refillId`, etc. (confirmed: `KitDistributed.find({...regionData.items.refillLogs.refillId...})` in `controllers/discrepancyManagement/discrepancy-management-controller.js:63` with no supporting index on that path).
2. **`KitTemplate`** — defines a distribution's shape (region/sub-region, min/max product counts). `regionId` is declared `ref: "Region"` and `subRegionId` is declared `ref: "SubRegion"` (`models/KitTemplate.js:7-8`) but the models actually registered on `conn1` are named `Regions` and `SubRegions` (plural) — the ref names don't match any registered model. Verified no `.populate()` is ever called on these fields (`grep -arn "populate(" controllers/ repositories/` has zero hits mentioning region), so this is currently a latent/inert bug, not an active one — but it will silently return `null` the day someone adds a `.populate('regionId')`.
3. **`Discrepancy`** (44 fields) — workflow entity with embedded `discrepancyBatches[]`, `activityLogs[]`, `comments[]`; `status` enum drives the whole discrepancy-management UI.
4. **`Fleets`** (27 fields, `conn3`) — driver/vehicle record, `mongoose-sequence` auto-increment `fleetDisplayId`, unique index on `fleetEmail`/`fleetPhone`.
5. **`Order`** (conn3) — e-commerce order, largely `Object`/`Mixed` blobs (`userData`, `everFlow`, `cartData`, `metadata`, `driverDetails`, `orderCancellationReason` all untyped `Object`).
6. **`Regions`/`SubRegions`** (conn1) — `SubRegions` embeds `kmls[]` (delivery-zone map files) and has a compound unique index on `(blazeRegionId, blazeRegionName)`.
7. **`KitDispatch`** — join between a distribution/refill and a driver; has real partial-unique indexes distinguishing `main` vs `refill` dispatch types (one of the few models with well-designed indexes).
8. **`DistributionRefillLogs`** — audit log of refill runs, well-indexed (3 compound indexes) with a documented `reason`/`skipReason` enum for why a refill succeeded/failed/was skipped.
9. **`Admin`** (conn2) — auth record; `generateAuthToken()` signs the JWT other services also verify (see §6).
10. **`Boxes`/`boxProduct`** — box definitions and box-to-product join table.

Full field-by-field detail (all 32 files) is in `distribution-backend.datamodel.md`.

## 6. API surface

**Mounting**: `startup/routes.js` mounts 12 route groups under `/api/v1/...` (see `README.md`'s own listing, which matches the code). Each route file defines its own per-route middleware array (e.g. `[admin]`) rather than a router-level `router.use(admin)` — **this is why the mechanical metrics tool's "152 unguarded routes" claim is wrong**: its regex only looks for `router.use(<middleware>)` at the top of the file and misses the inline `[admin]` array most routes actually use. Verified by reading all 12 route files in full.

**Real auth mechanism**: JWT, `Authorization: Bearer <token>`, verified in `middlewares/admin.js:13` with `jwt.verify(token, process.env.JWT_ADMIN_PRIVATE_KEY)` — no algorithm pinned (accepts whatever `jsonwebtoken` defaults to for the key type), 2-day expiry (`models/Admin.js:22`, `expiresIn: "2d"` — the metrics tool's `jwt_no_expiry_hint` flag on this line is a **false positive**, expiry is present). **This repo never signs its own admin tokens** — there is no login/register route or controller in this codebase at all; `Admin.generateAuthToken()` exists but is only ever called from wherever admins actually log in (a different service — hemp-backend or hyperwolf-backend share the same `JWT_ADMIN_PRIVATE_KEY` env var name and DB). Roles are represented as a single `isSuperAdmin: Boolean` on the decoded token payload — no string role list, no granular permissions.

**Real unauthenticated (no JWT, no token) routes** — verified by reading every route file's full middleware array:
- `routes/common-routes.js` — **all 6 routes**: `POST /upload/image`, `POST /upload/multiImages`, `POST /blaze/brands`, `GET /brands/list`, `POST /product/batches`, `GET /sync/sold/qty`. None have `[admin]` or any auth middleware.
- `routes/blaze/blaze-syncing-routes.js` — **all 8 routes**: inventory sync/transfer/check-sold endpoints mounted at `/api/v1/blaze/distribution/*`. None have auth middleware.
- `routes/kitTemplate/kit-template-routes.js:12,24,25` — `GET /list`, `GET /get/unassigned/region`, `GET /get/template/subregions`.
- `routes/regions/region-routes.js:16` — `GET /list`.
- `routes/kitRefill/kit-refill-routes.js:18` — `GET /reports/download`.
- `routes/manageDistributions/manage-distributions-routes.js:32` — `GET /reports/download`.
- `routes/driverKitVerification/driver-kit-verification-routes.js:23,24` — `POST /user/reset/pin`, `POST /user/forgot/pin` (plausibly intentional — a logged-out driver needs to reach these — but there is no rate limiting on them, see §14).

The one thing that runs before **every** route is `partnerAuth` (`startup/middleware.js:60`, `app.use('/', partnerAuth)`) — but it provides **no protection at all**: see §14 Critical finding #1. `middlewares/auth.js` (a separate, `PUBLIC_TOKEN`-based static-token check) is fully implemented but **never `require`d anywhere in routes or controllers** (`grep -arn "require(.*middlewares/auth[^S]" routes/ controllers/` → zero hits) — dead code, even though `startup/config.js:4` throws at boot if `PUBLIC_TOKEN` is unset, meaning every deployment must configure a secret that nothing ever checks. `middlewares/isSuperAdmin.js` is likewise defined but never wired into any route.

**Input validation**: Joi, but only on some routes — inline `Joi.object(...).validate(req.body)` functions co-located in the model files (`addBoxValidation`, `addRegionsValidation`, `fleetValidation`, etc.) and applied selectively per-route. Many routes (all of `blaze-syncing-routes.js`, most of `manage-distributions-routes.js`, `discrepancy-management-routes.js`) have **no** Joi validation at all — the handler reads `req.body`/`req.query` directly.

**Pagination**: two conventions coexist — `skip`/`limit`/`page` query params on some list endpoints (e.g. `sub-region-controller.js:81-83`) vs. "load the whole collection with `.find({})` and slice/aggregate in memory" on others (§15). No consistent envelope.

**Error response shape**: no centralized Express error-handling middleware is registered anywhere (`grep -arn "app.use((err" startup/ index.js` → zero hits). Error handling is per-route via the `asyncMiddleware` wrapper (`middlewares/async.js`) which returns `{ message: ex.message }` with **HTTP 400** for *any* thrown error, including ones that are really 500s (DB down, null-pointer bugs) — the client cannot distinguish "you sent bad input" from "the server broke." Worse, **not every controller uses this wrapper** — `controllers/blaze/blaze-syncing-controller.js`, `controllers/driverKitVerification/driver-kit-verification-controller.js`, and `controllers/closureOverview/closure-overview-controller.js` define plain `async (req, res) => {}` handlers with their own scattered `try/catch` blocks (178 `catch` blocks total across the repo) instead — response shapes for unhandled errors on those routes fall through to Express 5's default HTML error handler, which is a different content-type and body shape than the JSON the rest of the API returns.

**Versioning**: URL-prefixed `/api/v1`, no evidence of a `v2` or a deprecation path.

**Frontend-specific fields**: N/A — this is a backend-only repo.

## 7. Background jobs

**All cron jobs are commented out.** `startup/nodeCrons.js` (24 lines) defines 4 `cron.schedule(...)` blocks — `kitDistributed` (every 30s), `dailyRefillKit` (every 10s), `saveProductBatches` (every 10 min), `syncSoldQty` (every minute) — and every single one is wrapped in a `//` block comment. `node-cron` is a listed dependency that currently does nothing at runtime.

The functions those crons would have called are instead reachable as manual HTTP endpoints: `POST /api/v1/admin/manage-distributions/cron` → `kitDistributed` (`[admin]`-protected), `POST /api/v1/admin/kit-refill/cron` → `dailyRefillKit` (`[admin]`-protected) — but `saveProductBatches` and `syncSoldQty` are exposed as the **unauthenticated** `POST /api/v1/product/batches` and `GET /api/v1/sync/sold/qty` in `common-routes.js` (§6). Whatever process currently triggers "daily refill" and "kit distribution" work is therefore an **external scheduler calling an admin-JWT-protected HTTP endpoint** (not verified in this repo — could be a GAS trigger, a separate cron host, or a manual click; "not measured" from this codebase alone) rather than the in-process cron the code and README structure imply exists.

No job in this repo can overlap itself via `node-cron` (moot, since none run), and there is no `LockService`-equivalent (no lock library, no lease pattern) protecting the manually-triggered `kitDistributed`/`dailyRefillKit` HTTP endpoints from being fired twice concurrently — nothing in `manageDistributions.repository.js:45` (`kitDistributed`, ~1,270 lines) takes a lock before mutating `KitDistributed` documents.

## 8. Third-party integrations & secrets

| Integration | Wrapper file(s) | Credential source | Signature/verification |
|---|---|---|---|
| Blaze (POS) | `controllers/blaze/blaze-syncing-controller.js`, `controllers/common-controllers.js`, `common/utils.js` | env vars (`BLAZE_BASE_URL`, `RETAIL_BLAZE_BASE_URL`, `BLAZE_API_KEY`, `BLAZE_API_KEY_TOKEN`) | Outbound only — this service calls Blaze, no inbound Blaze webhook exists in this repo, so no webhook signature question applies here. |
| AWS S3 | `middlewares/awsBucket.js` | env vars (`AWS_ACCESS_KEY`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`) | N/A. Uploads are `ACL: 'public-read'` (`middlewares/awsBucket.js:22`) — every uploaded object is public by default. |
| SendGrid | `common/emailService.js`, `templates/userForgotEmailTemplate.js` | env var `SENDGRID_API_KEY` | N/A |
| Sentry | `middlewares/async.js`, `common/emailService.js` | env var `SENTRY_DSN` | **Dead**: `Sentry.init(...)` is commented out in both places it would be called (`startup/middleware.js:39-48`, `middlewares/async.js:7-17`), yet `Sentry.captureException(...)` is still called live in 3 places (`middlewares/async.js:25`, `common/emailService.js:22,24`). Modern `@sentry/node` no-ops `captureException` when uninitialized rather than throwing, so every one of the 178 `catch` blocks in this codebase that goes through `asyncMiddleware`, plus every failed email send, is silently un-reported. The README lists "Error tracking: Sentry" as a working feature of this stack — the code contradicts that (`README.md` "Tech Stack" section vs. `startup/middleware.js:39-48`). |
| Puppeteer | `controllers/*/`(box/driver PDF endpoints) + `templates/*.ejs` | N/A (headless Chromium bundled by the `puppeteer` package) | N/A |
| Socket.IO | `common/socket.js` | N/A | CORS `origin: "*"` (`common/socket.js:12`) — any origin can open a socket connection and call `scanProduct`. |

**No secret values found in the tree** (metrics scan: "none matched"; spot-checked `.env.example` — it is a template with `<placeholder>` values only, correctly excluded from tracking would need `.env` itself, which `.gitignore:1` does exclude, and `git ls-files | grep -i env` confirms only `.env.example` is tracked).

**README discrepancy**: `README.md`'s "Environment Setup" section states *"A `.env.example` is **not** included in this repository"* — this is false; `.env.example` exists at the repo root and is tracked in git (`git ls-files` confirms it), and it lists all 28 environment variables the metrics scan found referenced in code. Cite both: `README.md` (Environment Setup section) vs. the tracked file `.env.example`.

## 9. Tests

**Zero.** `package.json`'s `test` script is `echo "Error: no test specified" && exit 1` (the default npm placeholder, never replaced). No test framework is a dependency. No `*.test.js`/`*.spec.js` files exist anywhere in the tree (`find . -iname "*.test.js" -o -iname "*spec.js"` → no results). Nothing is covered; nothing is measured about correctness except by hand in production.

## 10. Build & deploy

- **Build**: none — plain Node, no transpile/bundle step. `npm install --legacy-peer-deps` per README (the `--legacy-peer-deps` flag being necessary is itself a signal of an unresolved peer-dependency conflict somewhere in the dependency tree — "not measured" exactly which package, since installing is out of scope for a read-only audit).
- **Deploy**: `.github/workflows/dev.yml` — triggers on push to `development`, runs on a **self-hosted** runner, and does: `git stash || true` (silently discards any uncommitted server-side changes) → `git pull origin development` → `docker compose up --build -d`. No `Dockerfile` or `docker-compose.yml` exists in this repo (must live outside the tracked tree on the deploy host, or this workflow currently can't succeed as written — not verifiable from this repo alone). **No test step, no lint step, no build-verification step** — a syntax error would only surface after the container is already up and the process crashes.
- **Environment separation**: single `development` branch triggers deploy; nothing in-repo distinguishes a staging vs. production target beyond whatever `.env` file happens to be on the self-hosted box. `IS_DEVELOPMENT` env var flips CORS/Sentry `mode` string but that string (`startup/middleware.js:9`) is computed and never actually used anywhere else in the file.
- **Security scanning**: `.github/workflows/security.yml` runs on every push, but only its `npm-audit` job applies to this repo (no Go/Python/PHP/Flutter/Android code present, so `gosec`/`bandit`/etc. all skip via their own guard conditions). `npm-audit` only fails the build on **critical** vulnerabilities (`--audit-level=critical` and a separate `jq` check for `.metadata.vulnerabilities.critical`) — **high-severity** vulnerabilities are scanned, reported, but do not block. And since there's no committed lockfile, `npm audit` runs against whatever `npm install --legacy-peer-deps` happens to resolve at CI time, which per §2 can legitimately differ run to run.
- **Logging/monitoring**: `console.log`/`console.error` only (304 `console.log` calls per the metrics scan, concentrated in `manageDistributions.repository.js` (96) and `kit-refill-controller.js` (53)) plus the dead Sentry wiring above. No structured logging, no log levels, no request-id correlation.

## 11. Hardcoded values

Worst 10 (verified, `path:line`):

1. `startup/middleware.js:6-7` — CORS `whitelist` fallback array hardcodes 4 production origins (`https://hyperwolf.s1.ths.agency`, `https://hyperwolf.com`, `https://admin.hyperwolf.com`, `http://hyperdrive.hyperwolf.com/`) inline in source instead of only in `ALLOW_ORIGIN` env — and as shown in §14, this list is defined but never actually consulted because `cors()` is called with no arguments a few lines later.
2. `common/socket.js:12` — Socket.IO CORS `origin: "*"` hardcoded, should be config or the same whitelist as HTTP CORS.
3. `startup/routes.js:17` — API version string `"Distribution APIs:1.0.6"` hardcoded in the welcome route; drifts from `package.json`'s own `"version": "1.0.0"` — two different "version numbers" for the same service, neither wired to the other.
4. `models/Fleets.js:6` — `defaultFleetImage = 'https://hyperwolf-website-assets.s3.amazonaws.com/assets/strain/default.jpg'` — a specific S3 object URL baked into the model file (should be config/data).
5. `templates/userForgotEmailTemplate.js:30,35,40,89,100` — 5 hardcoded S3 asset URLs (logo, gif, icons) baked directly into the email template string, one of which is **wrong** (see §12 — points at a `hemp-website-assets` logo in what is otherwise a Stilo-branded email).
6. `templates/userForgotEmailTemplate.js:92-93,103,123` — hardcoded support email (`order@hyperwolf.com`), phone (`(562) 676-4014`), and marketing URL (`www.hyperwolf.com`) baked into the template rather than sourced from a brand-config object — this is exactly the kind of value that broke when the file was copy-pasted from Stilo (§12).
7. `controllers/common-controllers.js:319` and similar — direct `http://`/`https://` URL literals for Blaze/webhook targets rather than composed from the env-configured base URL via `common/utils.js:combineBaseurl` that already exists for this purpose.
8. `middlewares/awsBucket.js:22` — `ACL: 'public-read'` hardcoded for every S3 upload — should be a config decision per bucket/use-case, not a constant baked into the shared upload helper (also a security finding, §14).
9. Platform enum values `'hyperwolf'`/`'stilo'` are re-declared as inline string literals in 8+ separate model files (`AgingRules`, `Boxes`, `DistributionGlobalSettings`, `KitTemplate`, `Regions`, `SubRegions`, `templateSku`, plus Joi validators) rather than a single shared constant — a third platform can't be added without touching 8+ files, and a typo in one of them silently creates a new valid-looking enum value Mongoose won't reject on read.
10. `discrepancy-management-controller.js` and others repeat the same status-string enums (`"open"`, `"pending"`, `"pendingApproval"`, `"resolved"`, `"rejected"`) as literal comparisons in controller code rather than importing them from the one place (`models/Discrepancy.js`) that declares the canonical enum — classic "hardcoded and should be data" drift risk.

## 12. Duplicated code

**Inside the repo**: the biggest internal duplication is structural, not textual — `blaze-syncing-controller.js` has 180 of the repo's 180 `commented_code_hint` matches (124 in this one file) and 7 of its 8 `settimeout_in_handler` occurrences, suggesting large blocks of superseded logic were commented out in place rather than deleted (`controllers/blaze/blaze-syncing-controller.js:2444,3024,3042,3128` are all dead commented-out `"X-API-KEY"` header blocks, for example) — the mechanism (`.exec()` calls, not `.exec` for shell) that the metrics tool mis-flagged as `child_process` at `controllers/region/sub-region-controller.js:100` is a real false positive, corrected here: it's a Mongoose query `.exec()`.

**Cross-repo** (verified against the sibling repos on disk, not just the metrics leads):
- `middlewares/awsBucket.js` — **byte-identical** (diff shows only trailing whitespace) across **four** repos: `distribution-backend`, `hemp-backend`, `hyperwolf-backend`, `stilo-backend`. A single 34-line S3-upload helper, copy-pasted four times instead of published as a shared internal package. A bug fix (e.g. the hardcoded `ACL: 'public-read'` in §11) must be applied four times by hand.
- `startup/middleware.js` — near-duplicate of the same file in `hemp-backend` (0.78), `hyperwolf-backend` (0.95), `stilo-backend` (0.77/0.72). **Verified with a real diff against hyperwolf-backend**: that sibling's copy actually calls `Sentry.init(...)` and registers `Sentry.Handlers.requestHandler()`/`errorHandler()` — live, not commented out — and also requires `newrelic` as its very first line and sets a `Content-Security-Policy` header this repo lacks entirely. This is strong evidence `distribution-backend`'s copy is a stale fork of hyperwolf-backend's: whoever copied it either commented out Sentry deliberately (in which case the commented block should have been deleted, not left as bait for someone to "helpfully" re-enable it half-wired) or forgot to finish the port.
- `models/OnDutyChecklists.js` — 0.97 near-duplicate of `hyperdrive-backend:models/OnDutyChecklists.js`. Diff shows the *only* difference is the connection pattern: this repo correctly uses `global.dbConnections.conn3.model(...)` (the 3-connection pattern) while hyperdrive-backend uses a bare `mongoose.model(...)` (presumably that service only has one connection) — same schema, hand-copied and hand-adapted per service, with no shared package enforcing they stay in sync.
- `models/Fleets.js` (0.82) and `models/Order.js` (0.78–0.82) are near-duplicates of the same-named models in `hyperwolf-backend` and `hyperdrive-backend` — this repo, hyperwolf-backend, and hyperdrive-backend each maintain their own copy of what is conceptually the same driver and the same order.
- `templates/userForgotEmailTemplate.js` — 0.99 near-duplicate of `stilo-backend:emailTemplates/userForgotEmailTemplate.js`. **Verified with a real diff**: the two differ only in brand-specific strings (logo URL, support email, marketing URL) — and this repo's copy has the brand swap done **wrong**: the logo at line 30 points to `hemp-website-assets.s3.amazonaws.com` while every other string in the same email (`order@hyperwolf.com`, `www.hyperwolf.com`, "Thanks for rolling with Stilo Supply!" copy) is Hyperwolf/Stilo-branded, not Hemp-branded — a real, live bug caused directly by copy-paste drift, not a hypothetical one. Whichever driver-PIN-reset flow in this service actually sends this email is currently emailing a broken/wrong logo URL.
- `middlewares/awsBucket.js`, `common/emailTemplates.js`-style helpers, and the platform-enum/status-enum duplication in §11 are all instances of the same root cause: **no shared internal package** across the four backend repos (`distribution-backend`, `hemp-backend`, `hyperwolf-backend`, `stilo-backend`) for the utilities and schemas that are conceptually one thing per the business (one Fleet, one Order, one S3 upload helper, one CORS/Sentry middleware stack).

## 13. Dependency risk

- **Unmaintained/legacy majors**: `aws-sdk` v2 (AWS's monolithic v2 SDK, long superseded by modular `@aws-sdk/client-*` v3 packages; v2 is in maintenance-only mode).
- **Declared but never imported**: `@sentry/integrations` (`package.json` dependency, zero `require`/`import` hits anywhere in source) — dead weight, and misleading (implies more Sentry wiring exists than actually does, compounding the §8 Sentry finding).
- **Imported but not declared**: `uuid` — `repositories/manageDistributions.repository.js:12` does `const { v4: uuidv4 } = require("uuid")`, but `uuid` is not in `package.json` `dependencies`. It currently resolves only because some other declared dependency happens to bring it in transitively (unverified which, without an install) — a future dependency bump that drops that transitive chain will break this file at import time with no warning from `npm install` succeeding. (The metrics tool's separate "imported but not declared: refillLog" flag is a **false positive** — `refillLog` is a local variable name in `blaze-syncing-controller.js` and `kit-refill-controller.js`, not a package import; corrected here.)
- **Bundle-size / heavy deps**: `puppeteer` (bundles a full Chromium download, ~300+ MB installed) is a dependency of the whole service just to render PDF reports server-side — reasonable for the feature, but worth knowing it's why this container image is far larger than a typical Express API's.
- **No lockfile** (§2) means dependency-risk itself is a moving target between installs; this section reflects what's declared in `package.json` today, not what any given running instance actually has resolved.

## 14. Security findings

**Critical**

1. **Unauthenticated, unrestricted file upload that is immediately served publicly.** `POST /api/v1/upload/image` and `POST /api/v1/upload/multiImages` (`routes/common-routes.js:6-7`) have zero auth middleware. The `multer` config behind them (`middlewares/strainFileUpload.js`) has a `fileFilter` that unconditionally calls `cb(null, true)` (line 17) — **any file type is accepted** — and no `limits` (no file-size cap; Multer's default is unlimited). Files land in `assets/distribution/` with a randomized name, and `startup/middleware.js:52` (`app.use(express.static('assets'))`) serves that entire directory back out over HTTP with no further gating. **Impact**: any unauthenticated caller can upload arbitrary content (HTML/SVG for stored XSS/phishing hosted on a hyperwolf.com-trusted origin, or just large files to fill disk) and have it served back from the API's own domain. **Fix**: put `[admin]` (or at minimum the also-unused `middlewares/auth.js` static token) in front of both routes, add a real `fileFilter` (mime/extension allowlist) and `limits: { fileSize: ... }` to the Multer config, and stop serving the upload directory with `Content-Type` sniffing disabled (already partially done via the global `X-Content-Type-Options: nosniff` header in `startup/middleware.js:30`, which helps but does not stop hosting/storage abuse).

2. **`partnerAuth` middleware runs on every request and enforces nothing** (`startup/middleware.js:60`, `app.use('/', partnerAuth)` → `middlewares/partnerAuth.js`). Line 6's condition — `if (!req.headers["Authorization"] || req.headers["authorization"]) req.headers.Authorization = authorization` — is a logic bug: Node lowercases all incoming header names, so `req.headers["Authorization"]` (capital A) is always `undefined`, making the `!...` always `true` and short-circuiting the `||` — this line unconditionally sets a **new**, differently-cased `Authorization` property that Express's own `req.header()`/`req.get()` never reads (they normalize to lowercase before lookup, per Express's implementation), so it has **zero effect on the actual `authorization` header any downstream middleware sees**. The middleware neither rejects nor authenticates anything — it is dead code masquerading as a security gate at the very top of the middleware chain, which is exactly where a reviewer skimming `startup/middleware.js` would assume request-level auth lives. **Fix**: delete it, or fix the case bug and actually reject requests that fail the check — as written it does neither.

3. **Fully unauthenticated Blaze-sync surface.** All 8 routes in `routes/blaze/blaze-syncing-routes.js` (mounted at `/api/v1/blaze/distribution/*`) — including `POST /inventory` (`createBulkInventoryTransfer`) and `POST /driver/syncing` (`bulkInventoryTransferSubRegionWise`, an ~800-line handler) — have no auth middleware at all. Anyone who can reach this host can trigger inventory transfers against the live Blaze POS system. **Fix**: add `[admin]` or a dedicated service-to-service token check.

**High**

4. **Mass assignment via `$set: { ...req.body }`.** `controllers/region/sub-region-controller.js:205-211`: `SubRegions.updateOne({ _id: req.params.id }, { $set: { ...req.body, updatedDate: Date.now() } })` spreads the entire request body into a MongoDB update with no field allowlist. The route is `[admin]`-protected (`routes/regions/region-routes.js:19`), so this requires a valid admin JWT, but any admin caller (or anyone who obtains one admin token) can set fields the edit form was never meant to expose (e.g. flip `status`, inject unexpected keys into a document that other code paths assume has a fixed shape). **Fix**: build the `$set` object from an explicit field allowlist.
5. **Public-write S3 uploads.** `middlewares/awsBucket.js:22` sets `ACL: 'public-read'` unconditionally for every upload this service makes, compounding finding #1 — even a legitimately-authenticated upload (e.g. an admin's box photo) becomes a public, guessable-if-the-random-suffix-is-weak S3 object.
6. **Systemic unescaped-regex-from-user-input (ReDoS surface).** 16 confirmed call sites construct `new RegExp(<user input>, "i")` directly from `req.query.search`/`driver`/`subRegion`/`status` with no metacharacter escaping — e.g. `controllers/closureOverview/closure-overview-controller.js:671-673`, `controllers/kitRefill/kit-refill-controller.js:3788`, `controllers/driverKitVerification/driver-kit-verification-controller.js:685,937`, `repositories/kitTemplate.repository.js:873,1258`, `repositories/aging-rules.repository.js:657,1010`, `repositories/manageDistributions.repository.js:2531`, `controllers/boxes/boxes-controller.js:203`, `controllers/discrepancyManagement/discrepancy-management-controller.js:159,610`, `controllers/wasteInventory/waste-inventory-controller.js:170`. Most sit behind `[admin]`, which lowers severity from Critical to High/Medium (trusted-but-not-fully-trusted caller), but a single crafted `?search=` value from any authenticated admin session can block the Node event loop. **Fix**: escape regex metacharacters (a one-line `str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` helper) before constructing any of these.

**Medium**

7. **Sentry error tracking is completely non-functional in production** (§8) — this is a security-adjacent operability gap: security-relevant exceptions (auth failures, unexpected DB errors) are silently un-reported, so there is no out-of-band detection of exploitation attempts hitting these endpoints.
8. **No rate limiting anywhere in the repo** (`grep` for `express-rate-limit` or any hand-rolled limiter: zero hits) — the unauthenticated `POST /user/reset/pin`/`POST /user/forgot/pin` driver-PIN-reset endpoints (`driver-kit-verification-routes.js:23-24`) and the unauthenticated Blaze/upload endpoints above are all open to brute-force/flood with no throttle.
9. **CORS is effectively wide open despite a whitelist being defined.** `startup/middleware.js:6-13` builds a `corsOptionsDelegate` function that checks `req.header('Origin')` against a whitelist — but it is never passed to `cors()`. Line 55 calls `app.use(cors())` with **no arguments**, which is the permissive default (`Access-Control-Allow-Origin: *` reflected for all origins, no credentials). The whitelist and the delegate function are dead code sitting next to the thing that should use them. Combined with Socket.IO's separate `origin: "*"` (`common/socket.js:12`), there is no origin restriction anywhere in this service despite the source code visibly trying to build one.

**Low**

10. `middlewares/auth.js` (unused, §6) and `middlewares/isSuperAdmin.js` (unused — `grep -arn "isSuperAdmin" routes/ controllers/` finds only a data query, never route middleware) are dead code that could confuse a future maintainer into thinking a permission layer exists where it doesn't.

No IDOR was found beyond the JWT-scoping question above — most `:id`-based lookups (`GET /detail/:id`, `PUT /update/:id`, etc.) are `[admin]`-gated with no further per-record ownership check, but since there is no multi-tenant admin concept in this repo (any valid admin JWT can act on any record regardless of `platform`), that is a design choice rather than a scoping bug — flagged here as an **open question** (§19) rather than a finding, since "should admin A be able to edit a Stilo region" may be intended behavior.

## 15. Performance findings

Ranked:

1. **Unbounded `.find({})`/`.find()` on `KitDistributed` and `Discrepancy` with no filter, no `.limit()`, on every request to several list endpoints** — verified real (not the metrics tool's raw count of 191, most of which are legitimate `$in`-scoped lookups):
   - `controllers/closureOverview/closure-overview-controller.js:35` — `KitDistributed.find({}).lean()`
   - `controllers/common-controllers.js:888` — `KitDistributed.find({}).lean()`
   - `controllers/discrepancyManagement/discrepancy-management-controller.js:34` — `Discrepancy.find().sort({ _id: -1 }).lean()`
   - `controllers/kitRefill/kit-refill-controller.js:3985-3986` — `KitDistributed.find({}).lean()`
   `KitDistributed` is the 63-field, deeply-nested central model with **zero indexes** (§5) — every one of these four endpoints does a full collection scan and pulls every distribution document (with all nested arrays) into Node memory before filtering/paginating in JavaScript. This gets linearly worse every week new distributions are created; there is no evidence of a retention/archival policy for old `KitDistributed` documents.
2. **`KitDistributed` has no index on the field it's most often queried by.** `distributionId` (a plain `String`, not the `_id`) is the primary lookup key used throughout `manageDistributions.repository.js` and `kit-refill-controller.js`, and `regionData.items.refillLogs.refillId` is queried directly in `discrepancy-management-controller.js:63` — neither has a supporting index defined in `models/KitDistributed.js`.
3. **Single functions of 500–1,270 lines doing the real work** (not itself a DB-performance issue, but the shape that produces the query patterns above): `ManageDistributionsRepository.kitDistributed()` (`repositories/manageDistributions.repository.js:45-1318`, ~1,270 lines), `bulkInventoryTransferSubRegionWise` (`controllers/blaze/blaze-syncing-controller.js:1695-2498`, ~800 lines), `syncInventory` (`:38-587`, ~550 lines), `driverKitDispatch` (`controllers/driverKitVerification/driver-kit-verification-controller.js:2211-2543`, ~330 lines). Functions this size make it very hard to tell, by reading, whether a DB call is inside a loop; the metrics tool's 7 `await_in_loop_hint` matches (`repositories/manageDistributions.repository.js` x3, `repositories/kitTemplate.repository.js` x2, `blaze-syncing-controller.js`, `driver-kit-verification-controller.js`) sit inside functions this large and would benefit from a real trace rather than a grep — flagged here as **not fully verified**, worth a dedicated pass.
4. **7 `setTimeout` calls inside request handlers**, all in `blaze-syncing-controller.js` (lines 237, 273, 565, 864, and 3 more) — using `setTimeout` to pace/retry HTTP calls to Blaze inside a synchronous request-response cycle risks holding the Express worker/request open far longer than the client's own timeout expects, and (depending on how they're awaited) can silently swallow a retry's result if the outer handler already returned.
5. **200 MB JSON/urlencoded body limit** (`startup/middleware.js:53-54`, `express.json({ limit: '200mb' })`) is extremely generous for what is mostly small CRUD payloads — a single malicious or buggy client can tie up significant memory parsing one request body.

## 16. Ten things a new developer would trip over

1. `partnerAuth` (`middlewares/partnerAuth.js:6`) looks like it authenticates every request — it does nothing (§14 #2). Don't assume any baseline auth exists just because this middleware runs first.
2. `middlewares/auth.js` exists, is fully implemented, validates `PUBLIC_TOKEN` — and is never used anywhere. If you're looking for "where is the static-token auth applied," the answer is nowhere; `PUBLIC_TOKEN` in `.env` only exists to satisfy the boot-time check in `startup/config.js:4`.
3. There is no login endpoint in this repo. `models/Admin.js` has `generateAuthToken()` but nothing here calls it — admin JWTs are minted by a different service. If you need to test an admin-protected route locally, you have to get a token from elsewhere (hemp-backend or hyperwolf-backend) that shares the same `JWT_ADMIN_PRIVATE_KEY`.
4. `models/ManageDistributions.js` is a 0-byte file. It's not a stub waiting to be filled in — nothing references it. Don't spend time wondering what schema it "should" have.
5. `startup/nodeCrons.js` looks like it drives the daily refill/distribution jobs. All four schedules are commented out — whatever actually triggers `dailyRefillKit`/`kitDistributed` in production is external to this repo, hitting `POST .../cron` by hand or from another scheduler.
6. `Sentry.captureException(...)` is called in 3 places but `Sentry.init()` never runs (§8) — don't assume "we'll see it in Sentry" for any error caught in this codebase; right now you won't.
7. CORS looks configured (`corsOptionsDelegate`, a real `whitelist` array) but `app.use(cors())` on line 55 of `startup/middleware.js` ignores all of it and is wide open (§14 #9).
8. The email template at `templates/userForgotEmailTemplate.js` currently renders with the wrong brand logo (hemp assets in a Stilo-branded email, §12) — if you're debugging "why does the PIN reset email look off-brand," this is why, and it's been that way since at least this commit.
9. Three completely separate MongoDB connections (`global.dbConnections.conn1/2/3`) back this one service, and which model lives on which connection is not obvious from the model's name — `Admin` is on `conn2` (hemp's DB), `Fleets`/`Order`/`Product`/`Brand`/`Category` are on `conn3` (hyperwolf's DB), and only the distribution-specific models (`KitTemplate`, `KitDistributed`, `Regions`, etc.) are on `conn1` (this service's own DB). Cross-service writes from here do not go through hemp-backend's or hyperwolf-backend's own validation/business logic.
10. `KitTemplate.regionId`/`subRegionId` declare Mongoose `ref: "Region"`/`ref: "SubRegion"` (singular) but the actually-registered models are `Regions`/`SubRegions` (plural, §5). `.populate()` on either field will silently fail once someone adds it — it doesn't error today only because nobody has called `.populate()` on them yet.

## 17. Grade inputs

| Axis | 1–10 | Justification | Citation |
|---|---|---|---|
| Simplicity | 3 | Single functions running 500–1,270 lines doing DB access, business rules, and response shaping together | `repositories/manageDistributions.repository.js:45-1318` (`kitDistributed`) |
| Speed | 4 | Core list endpoints load the entire, unindexed, most-central collection on every call | `controllers/discrepancyManagement/discrepancy-management-controller.js:34` |
| Security | 2 | Unauthenticated arbitrary file upload immediately served back publicly | `routes/common-routes.js:6-7` + `middlewares/strainFileUpload.js:16-19` |
| Data modelling | 4 | Three incompatible timestamp conventions and a `ref` pointing at a model name that doesn't exist, across 31 hand-maintained schemas with no shared package | `models/Fleets.js` (Date) vs `models/Boxes.js` (Number) vs `models/KitTemplate.js:7` (`ref: "Region"`) |
| Reuse vs. hardcoding | 3 | A 34-line S3 helper is byte-identical in 4 repos; an email template is 99% identical to a sibling repo's and the 1% that differs is wrong | `middlewares/awsBucket.js`; `templates/userForgotEmailTemplate.js:30` |
| Testing | 1 | Zero test files, placeholder `npm test` script | `package.json` `scripts.test` |
| Upgradability | 4 | No Node version pin, no lockfile (deliberately gitignored), caret-ranged deps everywhere — a fresh `npm install` is not reproducible | `.gitignore:5`, `package.json` |
| Operability | 3 | Error tracking is wired in code but never initialized; no centralized error handler; inconsistent JSON vs. default-Express error shapes | `startup/middleware.js:39-48` |
| Developer experience | 3 | Dead middlewares that look load-bearing (`partnerAuth`, `auth.js`, `isSuperAdmin.js`), a 0-byte model file, and cron jobs that look active but aren't | `middlewares/partnerAuth.js`; `startup/nodeCrons.js` |

## 18. Quick fixes (<1h each), ranked by impact/hour

1. Add `[admin]` middleware to `routes/common-routes.js`'s upload routes and add a `fileFilter`/`limits` to `middlewares/strainFileUpload.js` — closes Critical #1 in under an hour.
2. Delete `middlewares/partnerAuth.js` and its `app.use('/', partnerAuth)` mount — removes a misleading dead "security" layer with a one-line diff.
3. Pass `corsOptionsDelegate` into `cors(corsOptionsDelegate)` at `startup/middleware.js:55` instead of `cors()` — the fix is already written in the same file, just unused.
4. Delete `models/ManageDistributions.js` (0 bytes, unreferenced).
5. Un-comment `Sentry.init(...)` in `startup/middleware.js` (copy the working block from `hyperwolf-backend:startup/middleware.js`) — restores error visibility for all 178 `catch` blocks that already call `Sentry.captureException`.
6. Fix the case-sensitivity condition in `middlewares/partnerAuth.js:6` if it turns out to still be needed for something outside this repo — or delete it (see #2).
7. Fix the wrong logo URL in `templates/userForgotEmailTemplate.js:30` (point it at the Stilo asset bucket like the rest of the template).
8. Add `uuid` to `package.json` `dependencies` (it's already used at `repositories/manageDistributions.repository.js:12`) and remove `@sentry/integrations` (unused).
9. Un-ignore `package-lock.json` in `.gitignore` and commit one generated lockfile — makes every future install reproducible.
10. Escape regex metacharacters in the 16 `new RegExp(<user input>)` call sites (§14 #6) with a single shared helper.

## 19. Open questions

1. Is any external scheduler currently calling `POST /api/v1/admin/manage-distributions/cron` and `POST /api/v1/admin/kit-refill/cron`? If not, daily refills and kit distributions are not running at all right now — this repo alone cannot answer whether that's the case in production.
2. Should any admin JWT be allowed to act on any `platform` (`hyperwolf`/`stilo`) record, or is per-brand admin scoping intended and simply not implemented? (§14, "no IDOR beyond JWT scoping.")
3. Is the direct-database-access pattern into hemp-backend's and hyperwolf-backend's MongoDB (§3, §5) an accepted architectural decision, or is it meant to be replaced by real API calls between services? This is the single biggest driver of the cross-repo schema-drift findings in §12.
4. Who owns keeping `middlewares/awsBucket.js` in sync across the 4 repos that copy it byte-for-byte? Is there appetite for extracting a shared internal npm package for it and the other near-identical files in §12?
5. Was `middlewares/auth.js` (the `PUBLIC_TOKEN` static-token check) meant to protect a specific set of routes that were later re-routed to `[admin]` instead, leaving it orphaned — or was it never wired up in the first place?

---

**Verification note on the mechanical metrics file**: corrected/downgraded findings from `metrics/distribution-backend.md` are: "152 unguarded routes" (wrong methodology, real count is ~20, listed in §6), `jwt_no_expiry_hint` on `models/Admin.js:22` (false positive, expiry present), `child_process` at `controllers/region/sub-region-controller.js:100` (false positive, it's `.exec()` on a Mongoose query), and "imported but not declared: refillLog" (false positive, local variable name). Confirmed accurate as-is: `cors_wildcard` (2/2 real), `mass_assign_update` (1/1 real), the model/route/dependency counts, and the "no lockfile" finding (confirmed deliberate via `.gitignore`).
