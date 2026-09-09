# hyperdrive-backend — Codebase Audit

Repo: `/Users/jt/hyper-tech/hyperdrive-backend` · Pinned at commit `afa975b` (`afa975b2a384c86a5f12c7494358d55364e7a9ad`, "Initial commit", single-commit snapshot — no prior history to blame).
Mechanical scan: `/Users/jt/POS-Admin/docs/codebase-audit/metrics/hyperdrive-backend.md` / `.json`. Cross-repo leads: `/Users/jt/POS-Admin/docs/codebase-audit/metrics/CROSS-REPO-DUPLICATES.md`.
All paths below are relative to the repo root unless stated otherwise.

---

## 1. Purpose

HyperDrive Backend is a Node.js/Express + MongoDB service that dispatches and tracks a fleet of delivery drivers for a cannabis retail/delivery operation. From the actual wired code (not the README, see §3 for the discrepancy):

- **Driver (fleet) mobile app** calls `/api/v1/fleet`, `/api/v1/task`, `/api/v1/checklist`, `/api/v1/closeout`, `/api/v1/transportationTypes` — login, duty status, task list/status updates, on/off-duty checklists, break/closeout submission.
- **Admin dashboard** calls `/api/v1/admin/*` — task creation/reassignment, analytics, headquarters (return-to-HQ) configuration, driver approval/notifications.
- **It calls out to**: Blaze POS/retail API (order + transaction sync, `common/util.js`), Klaviyo (password-reset profile creation, marketing), HERE Maps (driver-to-stop distance/ETA, `driverAssignment/assignment/hereMapsLogic.js`), Google Street View (static arrival photos), Firebase Cloud Messaging (push notifications, `firebaseAdmin.js` + `common/sendPushNotifications.js`), TextVolt (delivery-failure SMS), AWS S3 (photo/ID upload via `multer-s3`), AWS DynamoDB (a `FLEET_TABLE` of live route/location history), and AWS IoT Core (MQTT ingestion of driver device telemetry, `awsEvent/iotCore.js`, run as a separate PM2 process — see `.github/workflows/dev.yml`: `pm2 restart hyperdrive-backend hyperdrive-iot-core-service`).
- Core domain logic is automated driver assignment: `driverAssignment/` decides which on-duty driver gets a new delivery task by region/distance/priority, with periodic monitoring to detect late deliveries and reassign (`driverAssignment/monitoring/monitoringCron.js`).

---

## 2. Runtime & framework

- **Node version**: no `engines` field in `package.json` — unpinned. README claims "Node.js 18+" but this is a documentation assertion, not enforced anywhere (no `.nvmrc`, no Dockerfile, no CI Node-version step).
- **Framework**: Express `^4.19.2` (Express 5 is current). `grep -rn "req\.param("` across the repo returns zero hits, so the one concrete Express-5 breaking change checked for does not block an upgrade.
- **DB + ORM**: MongoDB via Mongoose `^8.5.2`, single connection (`startup/db.js:3-6`, `mongoose.connect(process.env.DATABASE_URL, ...)`) — no multi-connection pattern (`global.dbConnections`) despite `.env.example` also declaring `DISTRIBUTION_DATABASE_URL`, which is never read anywhere in the code (`grep -rn "DISTRIBUTION_DATABASE_URL"` outside `.env.example` returns zero hits). Contrast: sibling repo `distribution-backend` uses `global.dbConnections.conn3.model(...)` across all 32 of its models — this repo does not use that pattern at all.
- **TypeScript**: none — plain CommonJS `.js` throughout.
- **Pinning**: all 28 production dependencies use caret ranges (no exact pins). Lockfile present (`package-lock.json`, committed).
- **EOL/CVE exposure of majors in use**: `aws-sdk` v2 (AWS's own maintenance-mode SDK, superseded by v3) is declared *and used alongside* `@aws-sdk/client-dynamodb`/`@aws-sdk/util-dynamodb` (v3) — both real dependencies, both actually required (see §13). `moment` + `moment-timezone` are both declared and used in 16 files — long-established maintenance-mode packages (no new features, project recommends migrating to day.js/luxon). `node-schedule` is declared and imported but its only call site is commented out (§7) — dead dependency at runtime. Express 4 itself is not EOL but is one major behind current.

---

## 3. Entry points & boot

`index.js` is the sole entry point (`"main"` / `npm start` → `node index.js`). Boot sequence, all inside one `try { } catch(ex) { console.log(ex) }` IIFE (`index.js:6-30`):

1. `require('dotenv').config()` (`:8`)
2. `require('./startup/config')()` (`:9`) — only validates `process.env.DATABASE_URL` is set; throws if missing (`startup/config.js:4-9`). Also imports `aws-sdk` and destructures `winston.profile` but uses neither — dead imports.
3. `app.use(express.static(...public...))` (`:11`)
4. `require('./startup/middleware')(app)` (`:15`) — CORS, JSON/urlencoded body parsing (200MB limit each — see §15), pug view engine (unused elsewhere — no `.pug` templates found in the repo), a `req._id = uuidv4()` stamp.
5. `await require('./startup/db')()` (`:16`) — Mongoose connect, no retry/backoff.
6. `require('./startup/routes')(app)` (`:17`) — mounts all 6 routers + 404 catch-all.
7. `setupCronJobs()` (`:20`) — registers the one live cron job (§7).
8. `global.messages = require('./locales/en')` (`:26`) — global mutable state; every controller error path elsewhere in the codebase reads `global.messages.X` for i18n-style response strings.
9. `app.listen(PORT, ...)` (`:32`) runs **unconditionally, outside the try/catch**, so the process reports "Listening to PORT" and looks healthy even if any step above (2, 5, 6, 7, 8) throws and is swallowed by the catch. Concretely: if `process.env.CRON_TIME` (read only by step 7, `startup/cronJobs.js:11`) is unset or malformed, `node-cron`'s `schedule()` throws synchronously, the IIFE's catch swallows it, `global.messages` (step 8, which runs *after* step 7 in source order) never gets assigned, and every controller that references `global.messages.*` throws "Cannot read properties of undefined" on the next request — while the process itself never crashes or logs anything beyond one generic `console.log`. `CRON_TIME` is referenced in code but **missing from `.env.example`** (confirmed: `grep -a "CRON_TIME" .env.example` → no hits), making this a realistic silent-outage path for a fresh deploy.
- **Global mutable state**: `global.messages` (i18n strings, set once at boot, read everywhere).
- **Startup side effects**: DB connection, cron registration, static file serving from `public/`. `firebaseAdmin.js` (required transitively wherever push notifications are used) initializes Firebase Admin from a **local JSON key file** (`./hyperdrive-firebase-adminsdk.json`) rather than an env var — the file is `.gitignore`d and not present at this commit (`git cat-file -e afa975b:hyperdrive-firebase-adminsdk.json` fails), so a fresh checkout cannot send push notifications without that file being provisioned out-of-band.

---

## 4. Directory map

| Dir | Files | JS lines | Real role |
|---|---|---|---|
| `admin/` | 7 | 4,349 | Admin-facing controllers (`admin/controllers/*`, including the 2,535-line `task-controller.js`) + `admin/middleware/adminAuth.js` (JWT auth for admin/web tokens). |
| `controllers/` | 5 | 2,682 | Mobile/driver-facing controllers (fleets, tasks, closeOut, onDutyChecklists, transportation) — the driver-app counterpart to `admin/`. |
| `driverAssignment/` | 8 | 1,116 | Core dispatch engine: region/distance-based driver ranking, auto-reassignment, HERE Maps distance calls, order-status monitoring cron logic. |
| `models/` | 28 | 1,492 | All Mongoose schemas — see §5 and the companion `.datamodel.md`. |
| `common/` | 4 | 494 | Shared utilities: generic HTTP client + Blaze/Klaviyo/TextVolt/Google-Street-View wrappers (`util.js`), Winston logger (`logger.js`), FCM push (`sendPushNotifications.js`), toast/message text (`toastMessages.js`). |
| `routes/` | 12 | 204 | Express route definitions, one subtree per feature area (`fleets`, `tasks`, `onDutyChecklists`, `transportationTypes`, `closeOut`, and `admin/*` sub-routes). |
| `middlewares/` | 4 | 125 | `mobileAuth.js` (driver JWT + fleet-active check), `fileUpload.js`, `multiFileUploadToS3.js`, `async.js` (error-wrapping helper, inconsistently used — see §7, §14). |
| `startup/` | 5 | 134 | Boot wiring: `config.js`, `db.js`, `middleware.js`, `routes.js`, `cronJobs.js`. |
| `awsEvent/` | 2 | 87 | `iotCore.js` — AWS IoT Core MQTT subscriber for driver-device telemetry; `readme.md`. |
| `enums/` | 1 | 2 | One frozen constant object (`adminNotificationTypes`) — most other "enums" in the codebase live inline in `models/*.js` instead (inconsistent). |
| `locales/` | 1 | 69 | `en.js` — the sole locale; `LOCALE` env var exists but only `en` is implemented. |
| `staticDB/` | 1 | 0 (JSON) | `apiVersion.json` — a cosmetic version string, not a real API-version mechanism (§6). |
| `config/` | 1 | 0 | Empty except `.gitkeep`; holds AWS IoT device cert/key files at runtime, gitignored, not present in this checkout. |
| `public/` | 1 | 0 (JSON) | `.well-known/assetlinks.json` (Android app-link verification). |
| `assets/`, `logs/` | 1 each | 0 | Static image assets; gitignored log output directory. |

Total: 91 tracked files, 78 source files, 10,872 source lines (per mechanical scan), independently corroborated by the per-directory counts above.

---

## 5. Data model summary

**28 Mongoose models**, single database, no `{timestamps: true}` anywhere — every model hand-rolls date fields, and at least **three incompatible conventions** coexist for it (Date+`Date.now` default; raw Number with no default; raw Number defaulted via `Date.now`), plus a fourth (`Region.created`/`modified`) that doesn't even use the `createdDate`/`updatedDate` name. Full field-by-field detail, every model, is in `hyperdrive-backend.datamodel.md`.

**10 most central models** (by inbound `ref:` count / domain centrality):
1. **Fleets** — the true hub; referenced by 14 other model files (every fleet-scoped log/config/token table).
2. **Tasks** (`models/TasksModel.js`) — 65 fields, the dispatch/delivery core, referenced by `FleetTasks.taskId`.
3. **Admin** — referenced from 10 files (every `createdBy`/`updatedBy`/`deletedBy`/audit field).
4. **Order** — customer-facing order; links to Fleets but has **no schema ref to Tasks at all** — the order↔task relationship is stitched together in application code via plain-String fields (`Order.orderId`/`onFleetTaskId`, `Tasks.orderDetails`/`orderTag`), not enforced by the schema.
5. **FleetTasks** — join collection between Fleets and Tasks.
6. **Region** — 36 fields, meant to be the store/territory concept, but structurally an outlier (see below).
7. **Announcements**, 8. **closeOut**, 9. **Break**, 10. **OnDutyChecklists** — supporting/template collections.

**Money**: represented as floating-point `Number` wherever it's typed at all (`Region.deliveryFee`/`deliveryCharge`, `Tasks.subTotal`/`total`/`totalTax`/`creditCardFee`), no comment or convention indicating cents vs. dollars. The single richest source of money data in the estate — a driver's end-of-shift cash/credit-card closeout (`Fleets.js`'s exported `fleetCloseoutFormValidation` Joi schema: bill counts, `cashTotal`, `creditCardTotal`, QR fields) — has **no corresponding typed schema at all**; it lands in `FleetCloseout.closeoutObject`, a bare untyped `Object`.

**Timestamps/soft-delete**: at least **four different soft-delete conventions** coexist — `isActive`+`deletedAt`+`deletedBy` (Announcements, FailureReason); `isDeleted`+`deletedBy` with no `deletedAt` (Fleets); bare `deleted` boolean (Region); bare `taskArchived` boolean (Tasks, no deletedBy/deletedAt at all).

**Multi-tenancy key**: `fleetId` (ObjectId ref to Fleets) is the dominant scoping key across driver-side collections. `Tasks` additionally carries `regionId`/`dispatchRegionId`/`terminalId` as **raw Strings with no referential integrity** — two separately-named "region" fields whose relationship to each other isn't evident from the schema. `TerminalProducts` — a model literally named for a terminal — has **no `terminalId` field at all**.

**Indexes vs. queries**: three indexes are provably dead because they reference field paths that don't exist on their own schema — `FleetTasks` indexes `fleetEmail`/`fleetPhone` (fields that belong to `Fleets`, not `FleetTasks`); `FleetOffDutyCloseout` indexes `closeoutId` (the real field is nested at `closeoutData.closeoutId`); `Fleets`' compound index references top-level `regionId` (the real field is nested at `regionData.regionId`) — and that broken index is exactly the field `driverAssignment/scheduleAssignment/assignToDriver.js:13` queries on every scheduled-order assignment (`Fleets.findOne({"regionData.regionId": ...})`), so the query it should serve gets no index support at all. `ActivityLogs` (0 indexes) is queried by `admin/controllers/task-controller.js:2061` on `newChanges.taskId` — full collection scan on every reassignment-history lookup. `Region` (0 indexes, 36 fields) turns out to be a red herring: it is imported but **never actually queried anywhere in this repo**.

**Overlapping/duplicate models**: the **closeout family** (`closeOut` template vs. `FleetCloseout` untyped-submission vs. `FleetOffDutyCloseout` referenced-submission) looks like two competing, never-consolidated implementations of the same feature. **`ReturnToHQ` vs. `StartTask`** are near-identical (same `regionId`/`location`/`isEnabled`/`fleetId`/`fleetDetails` shape) and could plausibly be one "FleetWaypointEvent" model with a `type` enum. `Region` is a structural island: it's the only model using `{collection: 'regions'}` instead of the otherwise-universal `{versionKey:false, minimize:false}` option style, uses `created`/`modified` instead of `createdDate`/`updatedDate`, uses a `deleted` boolean instead of any other model's soft-delete convention, and its six `ref:` targets (`Company`, `TaxRule`, `Driver`, `Terminal`, `Shop`, `Inventory`) **do not exist anywhere in this repo's `models/` directory** — strong evidence it was carried over from a different (storefront/admin) service sharing the same database rather than authored for this backend.

Full per-model field tables, the complete relationship graph, and additional bugs (a `FleetTaskActivityLogs.taskId` field wrongly `ref:`'d to `Fleets` instead of `Tasks`; a `Tasks.taskStatus` default value that isn't a member of its own enum) are in **`hyperdrive-backend.datamodel.md`**.

---

## 6. API surface

**Mounting**: `index.js` → `startup/routes.js`, which requires 6 router modules and mounts them with **no middleware argument at any mount point** (`startup/routes.js:14-19`) — `app.use('/api/v1/fleet', fleetRoutes)`, `.../checklist`, `.../task`, `.../transportationTypes`, `.../admin`, `.../closeout`. There is no mount-level auth anywhere; every route file is individually responsible for guarding its own routes. A 404 catch-all exists (`:21-23`).

**Versioning**: only the literal `/api/v1/` URL prefix. `staticDB/apiVersion.json` (`{"apiVersion": "2.0.17"}`) feeds a cosmetic welcome string at `GET /` (`startup/routes.js:10-12`) — not a real content-negotiated API version.

**Auth mechanism**: two JWT middlewares, both verifying against the same secret `process.env.JWT_FLEET_PRIVATE_KEY`:
- `admin/middleware/adminAuth.js` (24 lines) — Bearer token, `jwt.verify` for signature+expiry only. No issuer/audience check, no role check, nothing looked up in a DB. Fails closed on every branch (401/403/400, never calls `next()` on failure).
- `middlewares/mobileAuth.js` (37 lines) — Bearer token looked up in `fleetAccessTokens`, then the owning `Fleets` doc checked for `fleetStatus === 'active'`, then `jwt.verify`. Also fails closed on every branch.
- `models/FleetAccessTokens.js:21` is the **only `jwt.sign` call site in the entire repo** (2-day `expiresIn`) — admin tokens are verified here but never *issued* anywhere in this codebase, meaning admin login/issuance lives in a separate service not covered by this audit.

**Route inventory & guard status — the mechanical scan's "82 of 86 unguarded" is wrong.** Its regex only matched a middleware identifier passed as a bare second argument and missed this codebase's dominant array-literal pattern (`[adminAuth]`/`[mobileAuth]`) plus one aliased import. Verified by reading all 12 route files end-to-end: **85 `router.<method>()` declarations; 13 are truly unauthenticated** (full list below). Everything else is either per-route `[adminAuth]`/`[mobileAuth]`-guarded, or (for `admin-routes.js`) a pure sub-router mounter that delegates auth to each child file.

**Truly unauthenticated routes** (verified by tracing, not the regex sample — several of the regex's cited examples were actually guarded and are corrected here):

| Route | File:line | Exposure |
|---|---|---|
| `GET /api/v1/fleet/recommend` | `routes/fleets/fleet-routes.js:34` | **Most significant finding** — returns the full `Fleets` document (name, email, phone, hashed password, live lat/long) for the nearest on-duty driver to anyone who supplies `?latitude=&longitude=`. No `$project` stage anywhere in `driverAssignment/assignment/regionAssignmentRule.js:36`'s aggregation. |
| `GET /api/v1/fleet/orderMonitor` | `fleet-routes.js:35` | Triggers the order-monitoring job; handler never calls `res.send` (hangs until timeout). |
| `GET /api/v1/fleet/scheduleCron` | `fleet-routes.js:36` | Triggers driver-reassignment scheduling job; same no-response issue. |
| `GET /api/v1/fleet/scheduleTaskStatusCron` | `fleet-routes.js:37` | Triggers task-status update job; same no-response issue. |
| `POST /api/v1/fleet/reset/password` | `fleet-routes.js:28` | Public by design, but resets a password given only a `token` looked up with no expiry check, and its own exported `resetPasswordValidation` (`models/HyperdriveResetRequest.js:14-24`) is never wired to the route. |
| `POST /api/v1/admin/tasks/create` | `routes/admin/tasks/tasks-routes.js:19` | Gated by a **bypassable** `conditionalAdminAuth` wrapper (`:9-16`) that calls `next()` unconditionally whenever `req.body.platformType === "web"` — attacker-controlled body field disables auth entirely. |
| `PUT /api/v1/admin/tasks/reassignTask/:taskId` | `tasks-routes.js:34` | **Critical** — zero auth wired at all (see §14); reassigns any active delivery's driver. |
| `GET /api/v1/admin/tasks/start/task/cron` | `tasks-routes.js:39` | Creates start-tasks + push notifications for every enabled config. |
| `GET /api/v1/admin/tasks/break/task/cron` | `tasks-routes.js:40` | Creates break tasks across all on-duty fleets. |
| `GET /api/v1/admin/headquarters/returnToHQ/address` | `routes/admin/headQuarter/headQuarter-routes.js:15` | Reads HQ address config (read-only, low severity). |
| `PUT /api/v1/admin/headquarters/returnToHQ/address` | `headQuarter-routes.js:16` | **Write** — overwrites the HQ address used for return-to-HQ task generation. |
| `GET /api/v1/admin/headquarters/sync/region/task` | `headQuarter-routes.js:21` | Calls the Blaze partner API and writes `ReturnToHQ` records. |
| `GET /api/v1/admin/headquarters/cron/automatic` | `headQuarter-routes.js:22` | Creates HQ tasks + push notifications. |

(`POST /login`, `POST /forgotPassword` at `fleet-routes.js:16,18` are intentionally public pre-auth endpoints, excluded above.)

**Role checks**: not modeled. `models/Admin.js` has an `isSuperAdmin` boolean that is **set but never read/enforced anywhere** (`grep -arn "isSuperAdmin"` finds only its own definition). `Fleets` has no role/permission field at all. `grep -arn "role" admin/ controllers/` returns zero hits. Every valid admin JWT carries identical privileges over every admin route.

**Input validation**: Joi is used, defined inside `models/*.js` (17 files) and wired per-route as named middlewares. Coverage is inconsistent — `POST /api/v1/admin/closeout/add`, `PUT /api/v1/admin/closeout/update/:id`, and `PUT /api/v1/admin/headquarters/returnToHQ/address` all write unvalidated `req.body` fields straight into Mongoose calls; `POST /api/v1/fleet/reset/password` has a validation schema defined but not attached.

**Pagination**: consistent ad hoc `req.query.limit`/`req.query.skip` with `parseInt(...) || <default>` (default `limit=10, skip=0`) across every list endpoint checked (`controllers/fleets/fleet-controller.js:765-766`, `admin/controllers/headQuarter-controller.js:154-155`, `admin/controllers/driverAnalytics/driver-analytics-controller.js:76`, etc.) — no `pageSize`/`pageNumber` convention exists anywhere.

**Error response shape**: uniform `{ message: <string> }` everywhere sampled, including the global wrapper `middlewares/async.js:10` (which always returns HTTP 400 regardless of the underlying error type — a minor but real shape/status inconsistency). No `{error: ...}` variant found anywhere.

**CORS — confirmed dead security control**: `startup/middleware.js:8-21` defines `corsOptionsDelegate`, an origin-whitelist function (`hyperwolf.com`, `admin.hyperwolf.com`, etc.), but line **27** calls **`app.use(cors())`** with no arguments — `corsOptionsDelegate` is referenced nowhere else in the repo. The bare `cors()` call uses the library default (reflects/allows any `Origin`), so the whitelist logic is entirely dead code. Any origin can call the API and read JSON responses (credentialed cookie-sharing is not enabled, since `credentials:true` is also part of the dead delegate).

**Frontend-specific fields (API base URL, token storage, SSR/CSR, route inventory)**: not applicable — this is a backend-only repo with no frontend code present.

---

## 7. Background jobs

**Only ONE cron job is actually live.** `startup/cronJobs.js` (59 lines) registers 7 jobs; 6 are commented out.

| Job | Schedule | Function | Status |
|---|---|---|---|
| `updateDutyStatusCronJob` (`controllers/fleets/fleet-controller.js:889`) | `process.env.CRON_TIME` (env-driven, no literal) | Sets on-duty fleets off-duty, force-closes past-day in-progress break tasks. | **LIVE** — the only active registration (`startup/cronJobs.js:11`). |
| `orderMonitoringCron` | `*/5 * * * *` | `monitoringCron.js`'s `monitoringLoop` — ETA/lateness/proximity checks. | Commented out (`:18`). |
| `scheduleTaskStatusUpdate` | `30 17 * * *` | Updates scheduled-task statuses. | Commented out (`:24`). |
| `scheduleReassignTask` | `*/30 * * * *` | Reassigns scheduled deliveries. | Commented out (`:30`). |
| `startTaskCron` | node-schedule, twice daily | Creates start-tasks. | Commented out (`:36,41`). |
| `breakTaskCron` | `* * * * *` (every minute) | Creates break tasks 15 min before each break window. | Commented out (`:46`). |
| `hQCron` | `30 4 * * *` | Creates return-to-HQ tasks. | Commented out (`:53`). |

**The 6 disabled jobs' only remaining trigger is the unauthenticated HTTP routes in §6** (`/orderMonitor`, `/scheduleCron`, `/scheduleTaskStatusCron`, `/cron/automatic`, `/start/task/cron`, `/break/task/cron`). No job anywhere in the repo has a lock/mutex/in-flight flag (`grep -arn "LockService\|mutex\|isRunning\|inFlight\|tryLock"` → zero hits), so this is the dominant overlap risk today, not the (mostly inert) cron schedule:
- `orderMonitoringCron`/`scheduleReassignTask`/`scheduleTaskStatusUpdate`: errors are logged via `console.error` (not swallowed), but no dedup — two overlapping HTTP-triggered invocations could double-reassign a driver or double-send a lateness push notification.
- `hQCron` and `startTaskCron`: their `try/catch` blocks **re-throw**, and neither is wrapped by `middlewares/async.js`'s `asyncMiddleware` nor is `express-async-errors` installed — a thrown error becomes an **unhandled promise rejection**, and neither function ever calls `res.send` even on success, so the HTTP client just hangs. Neither has any idempotency check, so a double-hit creates duplicate tasks and duplicate push notifications.
- `breakTaskCron` has **no try/catch at all** — a thrown error is a silent unhandled rejection with zero logging. It's the one job with a check-then-insert dedup (existing-task lookup before creating), but with no lock a tight double-invocation can still race past the check.

`process.env.CRON_TIME` is confirmed missing from `.env.example` (§3) — a real deploy-time footgun given the boot-order bug described there.

---

## 8. Third-party integrations & secrets

| Integration | Wrapper file | Credential source | Status |
|---|---|---|---|
| Blaze POS/Retail | `common/util.js` (`combineBaseurl`, `getRequest`/`postRequest`/etc., lines 20-125; retail session auth `:353-373`) | `BLAZE_BASE_URL`, `BLAZE_RETAIL_*`, `AUTH_TOKEN`, `PARTNER_KEY` (env) | Live. Retail token cached in `Miscellaneous` (`uniqueId: "blazeToken"`). |
| SendGrid | — | `SENDGRID_*` (env, declared in `.env.example`) | **Dead** — `grep -arn "sendgrid\|SENDGRID\|@sendgrid"` across `.js` files: zero hits. No email-send capability exists in this repo at all; password reset goes through Klaviyo instead. README lists SendGrid as a live integration — it is not. |
| TextVolt (SMS) | `common/util.js:281-300` (`postGraphqlRequest`) | `TEXT_VOLT_URL`, `TEXT_VOLT_BEARER_TOKEN` | Live, used for delivery-failure SMS (`controllers/tasks/task-controller.js:967-977`); send failures are silently swallowed by an empty `catch`. |
| Klaviyo | `common/util.js` (default fallback branch of `combineBaseurl`, line 26) + `controllers/fleets/fleet-controller.js:17,~253` | `KLAVIYO_BASE_URL` (in `.env.example`), `KLAVIYO_API_KEY` (referenced in code, **missing from `.env.example`**) | Live — powers password-reset profile creation. `combineBaseurl`'s fallthrough means **any unrecognized `platform` string silently routes to the Klaviyo host** — a typo elsewhere would misroute a request there instead of erroring. |
| Slack | — | `SLACK_WEBHOOK_URL` (declared) | **Dead** — zero references anywhere in `.js` files. |
| HERE Maps | `driverAssignment/assignment/hereMapsLogic.js:6-12` | `HERE_MAPS_KEY`, `HERE_MAPS_BASE_URL` | Live — the sole distance/ETA provider (see §15 for its perf issue). |
| Mapbox / GraphHopper / `APP_MAP_KEY_TOKEN` | — | Declared in `.env.example` | **Dead** — zero references anywhere in `.js` files despite the README listing Mapbox/GraphHopper/Turf.js as live routing tech. |
| Google Street View | `common/util.js:304-330` (`getGoogleStreetView`) | `GOOGLE_API_KEY_STREET_VIEW` | Live — static arrival-photo fetch, called from `startTaskCron`/`hQCron`. |
| Firebase (FCM push) | `firebaseAdmin.js` + `common/sendPushNotifications.js` | **Local JSON key file** (`./hyperdrive-firebase-adminsdk.json`), not env — inconsistent with every other integration's convention. | Live. File is gitignored, not present at this commit. |
| AWS S3 | `middlewares/multiFileUploadToS3.js` (`aws-sdk` v2 `S3` + `multer-s3`) | `AWS_ACCESS_KEY`/`AWS_SECRET_ACCESS_KEY`/`AWS_BUCKET` | Live — photo/ID uploads; see §14 for validation gap. |
| AWS DynamoDB | `admin/controllers/task-controller.js`, `controllers/tasks/task-controller.js`, `admin/controllers/driverAnalytics/driver-analytics-controller.js` | `@aws-sdk/client-dynamodb` v3 client, but constructed with a **v2** `AWS.SharedIniFileCredentials({profile: process.env.PROFILE_NAME})` — a real SDK-version bridge, not mere coexistence (see §13). | Live — `FLEET_TABLE` route/location history. |
| AWS IoT Core | `awsEvent/iotCore.js` | `IOT_CORE_ENDPOINT`, `IOT_CORE_TOPIC`, plus a **hardcoded 64-char device-certificate ID embedded in the cert/key file paths** (`:10-11`) | Live, separate PM2 process. No inbound webhook (this is outbound MQTT). |

**Secrets in tree**: none found. `grep -a` sweep for `AKIA`, `sk_live`, and literal API-key-shaped strings across `.js` files returned nothing; the Firebase key and IoT certs are provisioned out-of-band and gitignored, not committed.

**Webhooks**: no inbound webhook route exists anywhere in `routes/` — every third-party call in this repo is outbound. Signature verification is therefore not applicable, not a gap.

---

## 9. Tests

**No tests exist.** Zero `*.test.js`/`*.spec.js` files, no `test/`/`tests/`/`__tests__/` directories, no Jest/Mocha config, no test dependency in `package.json`, no `test` npm script, and `.github/workflows/dev.yml` has no test step — it only SSHes in and runs `npm i && pm2 restart`.

Highest-risk paths with zero coverage:
1. `updateTaskStatus` (`controllers/tasks/task-controller.js:766-1006`) — the driver-writable task-status mutation with the IDOR gap described in §14.
2. Driver assignment/reassignment (`driverAssignment/assignment/regionAssignmentRule.js`, `driverAssignment/commonFunc.js`) — contains a half-disabled break-time filter (`checkForBreakFleets`, commented out in two places) with no test to catch a regression if it's ever re-enabled.
3. `reassignOrderInBlaze` (`admin/controllers/task-controller.js:1993-2020`) — a live, untested POST to Blaze's transaction-employee endpoint with its own `try` wrapper commented out, so a failure throws unguarded into the caller.

---

## 10. Build & deploy

**Build**: no build step — `npm i` only. No Dockerfile anywhere in the repo. No `engines.node`.

**Where it runs**: bare SSH + PM2 on host `thcs.in` (`.github/workflows/dev.yml`), not containerized, not on a PaaS. SSH auth is **password-based** (`secrets.USERNAME`/`secrets.PASSWORD`), not key-based.

**Deploy trigger mismatch — likely non-functional CI**: the workflow fires on `push: branches: [development]`, but this checkout's actual (and GitHub default) branch is `main` — `git branch -a` shows only `main`, and `origin/HEAD` points at `origin/main`; no `development` branch exists locally or on the remote as of this pin. If that holds on GitHub too, **this "push to deploy" pipeline has likely never fired from ordinary work on `main`**, meaning deploys are either happening by some undocumented manual process or aren't happening via this file at all. Worth an explicit owner question (§19).

**Environment separation**: `.env.example` declares `APP_ENV`, but it is **never read anywhere in the code** (`grep -rn "APP_ENV"` → zero hits in `.js` files; `NODE_ENV` likewise unused). There is no environment-based branching logic — dev/stage/prod differ only by which `.env` values are loaded, never by explicit conditionals.

**Logging/monitoring**: `common/logger.js` defines two Winston loggers — a general `log` (info level, JSON, **console transport only**, no file destination despite `winston-daily-rotate-file` being a dependency) and a narrow `csvLog` (uses `DailyRotateFile` for fleet-location CSV output only). The 90 raw `console.log` calls found by the mechanical scan are concentrated exactly where operational visibility matters most: `startup/cronJobs.js` (15) and `driverAssignment/monitoring/monitoringCron.js` (15) both bypass Winston entirely for their operational status lines ("Updating ETA...", "Checking Reassigning driver...", cron start/end) — the monitoring/cron layer that would be most useful to alert on is invisible to whatever tooling consumes the structured Winston stream, and on PM2 lands only in PM2's own unrotated log files.

---

## 11. Hardcoded values

Verified counts (whole repo, `grep -a`, node_modules/.git excluded):

| Category | Count | Files |
|---|---|---|
| Magic mode-string comparisons (`taskAssignmentMode === 'driver'/...`) despite an existing shared enum | 14 | 2 |
| Hardcoded `http(s)://` URLs (excluding the 5-entry CORS whitelist array, covered in §6) | 3 | 3 |
| Hardcoded 24-hex ObjectId literals | 2 | 2 |
| Hardcoded phone number | 1 | 1 |
| Hardcoded email addresses / store or region names / feature-flag booleans | 0 each | — (genuinely clean, verified by targeted sweep) |

**Worst 10, each verified:**

1. `common/util.js:273` — `"from": "+12136910347"`, hardcoded SMS sender for every TextVolt message. **Should be config.**
2. `admin/controllers/task-controller.js:1021` — `employeeId: "5f9df52827e11708c30b7855"` attributed on every Blaze order-cancellation call. **Should be config** — ties every cancellation to one specific (possibly deactivated) Blaze employee account.
3. `controllers/tasks/task-controller.js:972-973` — SMS body hardcodes a support link (`https://bit.ly/HWchat`) sent to customers on delivery failure, next to an empty `catch{}` swallowing send failures. **Should be config.**
4. `models/Fleets.js:7` — default profile image hardcodes a full S3 URL rather than deriving from the `AWS_BUCKET`/`AWS_REGION` env vars used elsewhere. **Should be config.**
5. `common/util.js:312` — Google Street View endpoint URL hardcoded (only the key is env-driven). **Should be config** for consistency.
6. `awsEvent/iotCore.js:10-11` — IoT device certificate/key **filenames embed a literal 64-char device ID**. **Should be config** — rotating the cert requires a code change.
7. `driverAssignment/monitoring/monitoringCron.js:238` — a commented-out debug filter pinned to one specific task `_id`, left in the file. **Dead code — should be deleted**, not config or data.
8. `admin/controllers/task-controller.js:286,309,346,411,...` (14 sites) — `taskAssignmentMode` literals re-typed instead of referencing the existing `validTaskAssignmentMode` constant already defined at `models/TasksModel.js:10`. **Should reference the shared constant** — a typo at any site silently breaks that branch with no validation to catch it.
9. `driverAssignment/monitoring/monitoringCron.js:12` — `DELIVERY_TIME = 85` (minutes), the auto-reassignment lateness threshold. **Should be config** — an operational tuning knob hardcoded as a constant.
10. `driverAssignment/monitoring/monitoringCron.js:44` — `150` meters, the "mark OutForDelivery" geofence threshold, inline. **Should be config**, same reasoning as #9.

---

## 12. Duplicated code

**In-repo — `admin/controllers/task-controller.js` (2,535 lines) vs. `controllers/tasks/task-controller.js` (1,489 lines).** Confirmed to be an intentional admin-vs-driver API split (mounted behind `adminAuth` and `mobileAuth` respectively), but ~5-6 helpers are copy-pasted rather than shared, and two of those copies have **already diverged into different bugs**:
- `getActiveAnnouncements` — byte-identical including a shared typo'd comment (`admin/controllers/task-controller.js:1860-1868` vs. `controllers/tasks/task-controller.js:660-668`).
- `getCreatedUserDetails` — the admin copy logs a reference bug (`fleetId` undefined in that scope, `admin/controllers/task-controller.js:1844-1856`); the mobile copy "fixed" the crash by deleting the interpolation entirely, producing a useless log line with no ID at all (`controllers/tasks/task-controller.js:644-656`). Neither is correct; a real fix in one never reached the other.
- `getTaskDetails` — admin's version resolves the **task's assigned driver** (`admin/controllers/task-controller.js:1773-1841`); mobile's version resolves the **requesting user's own fleetId** instead (`controllers/tasks/task-controller.js:605-629`) — a plausible copy-paste bug that currently only "works" because a driver happens to view their own tasks.
- Both files independently require **both** AWS SDK generations for the identical reason (v2 solely for `SharedIniFileCredentials`, v3 for the real DynamoDB query) — `admin/controllers/task-controller.js:21-29` and `controllers/tasks/task-controller.js:14-23`.

Also duplicated in its *dead* form: `checkForBreakFleets` (a driver break-time filter) is commented out wholesale in **two** files — `driverAssignment/assignment/regionAssignmentRule.js:134-146` and `driverAssignment/commonFunc.js:77-87` — plus its call sites, also commented out in both places.

**Cross-repo — the 3 leads from `CROSS-REPO-DUPLICATES.md`, all verified against the sibling checkouts:**
- **`models/OnDutyChecklists.js` vs. `distribution-backend/models/OnDutyChecklists.js` (0.97)** — confirmed near-identical; the only substantive difference is that `distribution-backend` registers the model via `global.dbConnections.conn3.model(...)` (its universal pattern, used across all 32 of its models) while this repo uses plain `mongoose.model(...)`. `distribution-backend` is the more likely "home" codebase; this repo's copy is the adapted fork. **Risk**: a schema/index change made in one and not the other silently causes one service to write documents the other doesn't validate/index consistently.
- **`models/Order.js` vs. `distribution-backend/models/Order.js` (0.82)** — confirmed similar core, but genuinely diverged in **both** directions (not a stale one-way copy): this repo has `onFleetTriggers`/`klaviyoProfileId` that `distribution-backend` lacks; `distribution-backend` has an entire CanPay payment block and AlpineIQ loyalty fields this repo lacks. **Risk**: since both likely share the same underlying `Order` collection at the DB layer, a schema fix (e.g. a new required field) in one has zero effect on the other's validation.
- **`common/sendPushNotifications.js` vs. `hyperwolf-backend/common/sendPushNotifications.js` (0.77)** — confirmed core FCM logic is shared, but `hyperwolf-backend`'s copy explicitly coerces the FCM `data` payload to strings (`String(msgBody.title)` etc.) while this repo's copy passes raw values — FCM requires string values, so a non-string `type`/`title` will throw on this repo's copy but succeed on `hyperwolf-backend`'s. This repo's copy also has a feature (`taskId` inclusion) `hyperwolf-backend`'s lacks. A real fix (the string-coercion bug) landed in one copy and never reached the other — the exact "fixed in one place, still broken in the fork" risk this category exists to catch.

---

## 13. Dependency risk

- **`moment`/`moment-timezone`** — both declared, both actively used across 16 files; long-maintenance-mode, superseded by day.js/luxon.
- **`aws-sdk` v2 + `@aws-sdk/client-dynamodb`/`util-dynamodb` v3** — both genuinely declared and required, in the same two files, for the same reason: v2 supplies `AWS.SharedIniFileCredentials({profile: PROFILE_NAME})`, v3 does the actual `QueryCommand`. This bakes a fragile deployment requirement (a populated `~/.aws/credentials` file with a named profile on the server) into the app purely to bridge the SDK gap — v3's own `fromIni()` credential provider could replace v2 entirely, but hasn't.
- **`node-schedule` + `node-cron`** — both declared and both `require()`'d in `startup/cronJobs.js`, but every `node-schedule` call site is commented out (§7) — it is a live dependency for dead code.
- **Express 4 vs. 5** — no `req.param()` usage found anywhere; that specific breaking change would not block an upgrade (other Express-5 changes weren't individually verified).
- **`csv-writer`** — the metrics scan's "imported but undeclared" lead is a **false positive**: its only appearance anywhere is a commented-out require (`admin/controllers/headQuarter-controller.js:17`) — dead code, not a live import; the file actually uses `json2csv` (which is declared).
- **`form-data`** — confirmed genuinely undeclared: imported and used at `common/util.js:2,150` but absent from `package.json` dependencies. Currently masked because `axios`/`multer` pull it in transitively (visible in `package-lock.json`), so `npm ci` works today — but this is latent, not safe: a routine transitive bump by either parent package could silently break `postRequestFormData` with no warning from `package.json` itself.
- **`nodemon`** — declared and flagged "unused" by the mechanical scan, but it is used, just only in the `dev` script (`"dev": "nodemon index.js"`), not in application code — not a real issue.

---

## 14. Security findings

- **[CRITICAL] `routes/admin/tasks/tasks-routes.js:34` (`PUT /reassignTask/:taskId`) — zero auth middleware.** Unlike every other route in this file, `router.put('/reassignTask/:taskId', driverAssignment.reassignTask)` has no `[adminAuth]`. The handler (`driverAssignment/main.js:51`) reassigns an active delivery's driver, updates Blaze, and sends push notifications. **Fix**: add `[adminAuth]`.
- **[CRITICAL] `controllers/tasks/task-controller.js:766-1006` (`updateTaskStatus`) — IDOR.** Looks up the task by `taskId` from `req.body` (`TaskModel.findOne({_id: taskId, isActive: true})`, line 774) with **no check that `taskdetails.fleetId` matches the authenticated caller's fleetId** before writing `taskStatus`/`amountReceived`/attachments or cancelling a live Blaze transaction. Any authenticated driver can complete, cancel, or forge cash-collected amounts on **any other driver's** task by supplying its ObjectId. **Fix**: require `taskdetails.fleetId.toString() === req.user.fleetId` before the write.
- **[HIGH] `controllers/tasks/task-controller.js:1268,1326` (`orderHistoryDetail`, `taskHistoryDetail`) — IDOR/PII disclosure.** Both look up by `taskId` from `req.query` with no `fleetId` filter (unlike the parallel DynamoDB query in the same functions, which *is* fleetId-scoped) — any driver can pull another customer's/driver's full task detail (name, phone, address, amounts) by iterating IDs. **Fix**: add the same `fleetId` scoping used on the DynamoDB half.
- **[HIGH] `admin/controllers/task-controller.js:1338` (`updateExistingTask`) — mass assignment.** `{ ...req.body, updatedDate: new Date() }` is spread straight into `TaskModel.updateOne({_id: taskId}, {$set: updateData})` with no field allow-list — any admin can overwrite `taskStatus`/`fleetId`/`amountReceived` directly, bypassing the dedicated reassignment/status-update code paths and their side effects. **Fix**: destructure an explicit allow-list of editable fields.
- **[MEDIUM] `routes/admin/tasks/tasks-routes.js:19` (`POST /create`) — auth bypass via request body.** `conditionalAdminAuth` (`:9-16`) calls `next()` unconditionally whenever `req.body.platformType === "web"` — attacker-controlled input fully disables auth on task creation. **Fix**: never let a body field control whether auth runs.
- **[MEDIUM] `routes/admin/tasks/tasks-routes.js:39-40`, `routes/admin/headQuarter/headQuarter-routes.js:21-22`, `routes/fleets/fleet-routes.js:35-37` — six unauthenticated cron-trigger/config routes** (full list and impact in §6/§7) — nuisance/DoS and (for the HQ-address `PUT`) unauthenticated write access to operational config.
- **[MEDIUM] `admin/controllers/task-controller.js` (10 sites, e.g. lines 640, 728, 933, 1133) — ReDoS via unescaped `RegExp(searchTerm, 'i')`** built directly from `req.query.searchTerm` on admin search endpoints. **Fix**: escape regex metacharacters or use `$text` search.
- **[MEDIUM] `middlewares/multiFileUploadToS3.js:36-46` — upload validation is extension-only, and uploads are `public-read`.** The `mimetype &&` check is commented out; `fileFilter` trusts the claimed filename extension, not real content-type/magic bytes. **Fix**: verify content server-side before accepting.
- **[LOW] `common/util.js:232-244` (`addUpdateActivityLog`) — audit-log write failures silently swallowed** (`catch(ex){}`) — a gap in the admin-action forensic trail with no signal anything failed.
- **[LOW] `driverAssignment/assignment/hereMapsLogic.js:27-30`** — HERE Maps failures silently swallowed, degrading route/ETA accuracy with no alert.
- **Not a finding**: `child_process` (21 mechanical hits) were all confirmed false positives — Mongoose `.exec()`, not shell execution; no command-injection surface exists anywhere in this repo. Secrets sweep is genuinely clean. No inbound webhooks exist, so webhook-signature verification is not applicable.

---

## 15. Performance findings

- **[CRITICAL] `driverAssignment/assignment/regionAssignmentRule.js:266-279` (`getLocationData`) — sequential HERE Maps calls in a nested loop, on the hot path for every order dispatch.** For each candidate driver, a `for` loop `await`s one HERE Maps call per waypoint pair (driver's current location + every pending stop + the new destination) — roughly N drivers × (M stops + 1) sequential external HTTP calls per dispatch, no batching (HERE's Matrix Routing API exists for exactly this), no caching, no timeout. Biggest latency and billed-API-cost driver in the codebase. **Fix**: batch via HERE Matrix Routing or at minimum parallelize per-driver.
- **[HIGH] `driverAssignment/assignment/regionAssignmentRule.js:34-46` (`findAvailableDriversAll`) — unbounded `$lookup` against the entire Tasks collection (65 fields) with no `$project`/prefilter** before the join, on every dispatch. **Fix**: filter/project inside the `$lookup` pipeline.
- **[HIGH] `admin/controllers/driverAnalytics/driver-analytics-controller.js:204,206` — two fully unbounded, unprojected queries per driver-detail page load** (`TaskModel.find({fleetId})`, `FleetActivityLogs.find({fleetId})`, no `.limit()`/`.select()`) — pulls a driver's entire history to compute a small summary. **Fix**: add limit/date-bounding and projections.
- **[HIGH] `admin/controllers/headQuarter-controller.js:277-296` — unfiltered `ReturnToHQ.find()` + a per-document sequential `await task.save()` loop**, on a model with zero indexes. **Fix**: filter to rows needing an update and `bulkWrite`.
- **[HIGH] `admin/controllers/task-controller.js:2088` (`getIdleFleets`) — unfiltered, unlimited `FleetBreakLog.find()`** for a dashboard widget. **Fix**: date-bound the same way the adjacent `TaskModel` query already does.
- **[MEDIUM] `admin/controllers/task-controller.js:308` — sequential `await Fleets.findOne()` per id in a bulk request array.** **Fix**: one `Fleets.find({_id:{$in: idArray}}})`.
- **[MEDIUM] `admin/controllers/task-controller.js:2452-2483` (`breakTaskCron`) — nested loop (breaks × fleets), one query per pair**, reachable both on schedule and via the unauthenticated route from §6/§7. **Fix**: batch-fetch with `$in`.
- **[MEDIUM] Missing/mismatched indexes** on the two highest-traffic lookups: `Fleets.findOne({"regionData.regionId":...})` (`driverAssignment/scheduleAssignment/assignToDriver.js:13`) isn't served by `Fleets`' only compound index (which points at a nonexistent top-level `regionId`); `ActivityLogs.find({"newChanges.taskId":...})` (`admin/controllers/task-controller.js:2061`) hits a model with zero indexes.
- **[MEDIUM] `admin/controllers/analyze/analyze-controller.js:386-418` — synchronous fs I/O to fixed, shared filenames inside a request handler, with a real race condition**: two concurrent admin CSV/zip exports overwrite each other's files, and one request's `unlinkSync` can delete a file the other is still zipping. **Fix**: per-request unique filenames + async fs.
- **[LOW] `admin/controllers/closeOut/closeOut-controller.js:31`, `admin/controllers/driverAnalytics/driver-analytics-controller.js:716`** — unfiltered `.find()` on small, bounded checklist-template tables; low practical impact, worth a defensive `.limit()`.
- **Not findings (corrected leads)**: `common/logger.js`'s sync-fs hint is one-time startup cost, not hot-path; `awsEvent/iotCore.js:50,57`'s `setTimeout` calls are commented-out dead code, not a live timer/retry mechanism.

---

## 16. Ten things a new developer would trip over

1. **The README describes a service that doesn't exist at this commit.** It claims Socket.IO, Helmet, a `startup/socket.js`, a `swiftAssign/` weighted-ranking engine directory, dual MongoDB connections, live SendGrid, and Mapbox/GraphHopper/Turf.js routing — none of these are present in the actual tree (`find . -iname "socket.js"`, `find . -iname "swiftAssign*"`, and dependency greps for `helmet`/`socket.io`/`turf`/`mqtt` all return nothing; `bcrypt` is declared but never imported despite being listed as "Auth" tech). A developer reading the README before the code will build a mental model that's simply wrong.
2. **`GET /api/v1/fleet/recommend` leaks full driver PII to an anonymous caller** (§6) — this is the kind of route that looks like a harmless "find nearest driver" utility until you read what it actually returns.
3. **`app.use(cors())` is bare** — the CORS whitelist array right above it (`startup/middleware.js:3-21`) looks like it's doing something and isn't (§6).
4. **`CRON_TIME` isn't in `.env.example`**, and its absence can silently break `global.messages` for the whole app without crashing the process (§3, §7) — one of the harder-to-diagnose failure modes in the repo.
5. **Two "task-controller.js" files** (`admin/controllers/` and `controllers/tasks/`) with overlapping helper names that have already drifted into different bugs (§12) — easy to edit the wrong one.
6. **`aws-sdk` v2 is required solely to authenticate a v3 DynamoDB client** (§8, §13) — looks redundant, isn't (yet) removable without also replacing the credential provider.
7. **6 of 7 cron jobs are commented out**, and their code paths are still reachable — unauthenticated — via plain `GET` routes (§7). A dev "testing the cron" by hitting the route in a browser is running a real, unauthenticated production job.
8. **`taskStatus` on `Tasks` has no schema-level enum** even though `validTaskAssignmentMode`/`validTaskStatus`-style constants exist elsewhere and are Joi-validated at the API boundary — a direct DB write (e.g. from a script or a REPL) can put a task into a status string the rest of the app has never seen.
9. **Three model indexes reference field paths that don't exist on their own schema** (`FleetTasks`, `FleetOffDutyCloseout`, `Fleets`, §5) — they look like performance safety nets and provide zero query support.
10. **`FleetTaskActivityLogs.taskId` is `ref: 'Fleets'`** (copy-paste from the field above it) — a naive `populate('taskId')` silently resolves against the wrong collection instead of erroring.

---

## 17. Grade inputs

| Axis | 1-10 | Justification (citation) |
|---|---|---|
| Simplicity | 4 | `models/TasksModel.js` (65 fields) merges dispatch, timing, location, financial, and audit concerns into one document with no submodels — a textbook god-object (§5). |
| Speed | 3 | Dispatch's hot path makes N×(M+1) sequential external HTTP calls per new order with no batching or timeout (`driverAssignment/assignment/regionAssignmentRule.js:266-279`, §15). |
| Security | 2 | An unauthenticated route reassigns any active delivery's driver (`routes/admin/tasks/tasks-routes.js:34`), and a second route lets any driver complete/cancel any other driver's task (`controllers/tasks/task-controller.js:766-1006`) — both §14. |
| Data modelling | 3 | Four incompatible soft-delete conventions and three date-field conventions coexist across 28 models with zero use of `{timestamps:true}` (§5); three schema indexes point at nonexistent field paths. |
| Reuse vs. hardcoding | 4 | 14 sites re-type `taskAssignmentMode` literals instead of the shared constant already defined at `models/TasksModel.js:10` (§11); two "task-controller" files duplicate ~6 helpers that have already drifted apart (§12). |
| Testing | 1 | Zero test files, zero test framework, zero CI test step — confirmed absolute (§9). |
| Upgradability | 4 | Express-5-breaking `req.param()` isn't used (would upgrade cleanly on that axis), but `aws-sdk` v2 is load-bearing for v3 auth (`admin/controllers/task-controller.js:21-29`) and would need real rework to remove (§13). |
| Operability | 3 | The two highest-volume files for operational status logging (`startup/cronJobs.js`, `driverAssignment/monitoring/monitoringCron.js`) both bypass the app's own Winston logger entirely in favor of raw `console.log` (§10). |
| Developer experience | 3 | The committed README describes integrations, directories, and an entire real-time layer (Socket.IO, `swiftAssign/`) that don't exist in this codebase (§16, item 1) — the single most disorienting thing a new hire would encounter. |

---

## 18. Quick fixes (<1h each), ranked by impact per hour

1. Add `[adminAuth]` to `routes/admin/tasks/tasks-routes.js:34` (`PUT /reassignTask/:taskId`) — closes a Critical unauthenticated task-hijack route in one line.
2. Change `app.use(cors())` to `app.use(cors(corsOptionsDelegate))` at `startup/middleware.js:27` — activates the whitelist that's already written and sitting unused.
3. Add `CRON_TIME`, `IS_DEVELOPMENT`, `KLAVIYO_API_KEY` to `.env.example` — prevents the silent `global.messages`-undefined failure mode in §3.
4. Fix `FleetTaskActivityLogs.taskId`'s `ref: 'Fleets'` → `ref: 'Tasks'` (models/FleetTaskActivityLogs.js) — one-line schema correction for a wrong-collection populate bug.
5. Add a `fleetId` ownership check to `updateTaskStatus` (`controllers/tasks/task-controller.js:774`) — closes the Critical cross-driver IDOR.
6. Add `fleetId` scoping to `orderHistoryDetail`/`taskHistoryDetail` (`controllers/tasks/task-controller.js:1268,1326`) to match their own DynamoDB half.
7. Delete the commented-out debug filter at `driverAssignment/monitoring/monitoringCron.js:238` — dead code, zero risk to remove.
8. Remove the dead `csv-writer` require comment (`admin/controllers/headQuarter-controller.js:17`) and add `form-data` to `package.json` dependencies (`common/util.js:2`) — closes the latent undeclared-dependency risk (§13).
9. Fix `Tasks.taskStatus`'s default value not being a member of its own enum's sibling issue in `FleetTaskActivityLogs` (`sessionStatus` defaults `'pending'` outside its `['in_progress','completed','cancelled']` enum, models/FleetTaskActivityLogs.js) — a document saved with the untouched default will fail validation.
10. Correct the README (§16, item 1) to remove claims about Socket.IO/Helmet/`swiftAssign/`/SendGrid/Mapbox that don't match this commit, or note explicitly that they're planned/aspirational.

---

## 19. Open questions

1. Is the "push to `development`" CI workflow (`.github/workflows/dev.yml`) actually how this service gets deployed, given the repo's real branch is `main` (§10)? If deploys happen some other way, what is it, and should this workflow be fixed or removed?
2. Where does admin JWT *issuance* happen — this repo only ever verifies admin tokens (`admin/middleware/adminAuth.js`) and never signs one; is that a separate, unaudited service?
3. Is the README's description (Socket.IO real-time layer, `swiftAssign/` weighted-ranking engine, dual DB connections, SendGrid, Mapbox/GraphHopper) describing a **planned rewrite** that hasn't landed yet, or is it stale documentation for a different branch/version? This materially changes how the findings above should be prioritized.
4. Is `MASTER_PASSWORD` (declared in `.env.example`, never referenced in code) vestigial, or is it consumed by a service outside this repo that shares the same `.env`?
5. Given `Region.js`'s six dangling refs to models that don't exist in this repo (`Company`, `TaxRule`, `Driver`, `Terminal`, `Shop`, `Inventory`) and the fact that it's never actually queried here — is this model dead weight that should be deleted from this repo, or does another service in the estate genuinely read/write the `regions` collection this schema was copied from?
6. Is the Fleets/Tasks god-object schema (§5, §16) and the Order↔Tasks missing-ref gap a known pain point the team already plans to address, or new information for this audit?

---

*Both output files for this repo have been written: `hyperdrive-backend.md` (this file) and `hyperdrive-backend.datamodel.md` (full 28-model field-by-field schema detail).*
