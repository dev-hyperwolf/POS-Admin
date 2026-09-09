# Team to-do — ordered by what must happen first

For the developer team, from the 2026-09-09 audit. Nothing here has been done by the auditor;
the Hyper-Tech repos are untouched. Each item names the repo, the place (`path:line` from
`repos/<repo>.md`), the change, and how to prove it worked. Do them in wave order; inside a wave,
top to bottom. Hours are the reports' own estimates. "Owner" is who can do it: **JT** (needs
console or account access), **team** (code), **Claude** (our estate only).

## Wave 0 — today, no code changes

| # | What | Where | Verify | Owner |
|---|---|---|---|---|
| 0.1 | Rotate the Firebase/GCP service-account keys committed in three repos; load the replacement from an env var or secret manager | `hyperwolf-backend/hyperdrive-firebase-adminsdk.json`, `hemp-backend/staticDB/fcmtoken.json`, `stilo-backend/staticDB/fcmtoken.json` | old key rejected by Firebase Admin; push notifications still send | JT |
| 0.2 | Rotate the Google Maps key sitting in a code comment, and the LedgerGreen webhook secret literal | `hyperwolf-backend/controllers/google-controllers.js:23`; `hyperwolf-backend/controllers/ledgergreen/ledgergreen-controllers.js:10` | old values fail | JT |
| 0.3 | Rotate the static API tokens that two storefronts ship as hardcoded fallbacks | `hyperwolf-frontend-nextjs/lib/api/client.ts:9`, `lib/constants.ts:15`; `hemp-frontend-nextjs/app/constants.js:24` | old value returns 401 | JT + team |
| 0.4 | Decide who has write access to the twelve repos during the fix waves, and whether the contractor keeps push | GitHub org settings | — | JT |
| 0.5 | Answer the "how is production actually deployed" question for each backend — every CI file points at a branch or host the repo cannot confirm | `repos/*.md` §10 and §19 | one written line per repo: branch, host, mechanism | team |

## Wave 1 — this week: close the credential-free chains (one line to one hour each)

| # | What | Where | Verify | Hours |
|---|---|---|---|---|
| 1.1 | Delete `POST /api/v1/nmi/payment` (charges attacker-supplied card data on the merchant account, no auth) | `hemp-backend/routes/common-routes.js:9`, `controllers/common-controllers.js:334-340`, `middlewares/authMiddleware.js:15` | route returns 404 | 0.1 |
| 1.2 | Remove `generateAuthToken()` from `getAdminById`; put the `admin` JWT middleware on every admin-user route except login/forgot/reset; `.select('-password')` on `getAllAdmins` | `hemp-backend/controllers/admin/admin-user-controller.js:396-401`, `routes/admin/admin-user-routes.js:13-16`; `stilo-backend/controllers/admin/admin-user-controller.js:96-115,176-186`, `routes/admin/admin-user-routes.js` | `GET /admin/:id` without a JWT → 401; response has no `access_token`, list has no `password` | 0.5 |
| 1.3 | Require the caller to already be super-admin before honouring `userRoles.includes("Super Admin")` | `stilo-backend/controllers/admin/admin-user-controller.js:117-126` | a normal admin cannot set `isSuperAdmin` | 0.2 |
| 1.4 | Add `[adminAuth]` to `PUT /reassignTask/:taskId`; add a `fleetId` ownership check in `updateTaskStatus`; scope `orderHistoryDetail`/`taskHistoryDetail` by `fleetId`; remove the `platformType === "web"` auth bypass | `hyperdrive-backend/routes/admin/tasks/tasks-routes.js:9-16,34`; `controllers/tasks/task-controller.js:774,1268,1326` | driver A cannot complete driver B's task | 0.5 |
| 1.5 | Put `[admin]` on the upload routes, add a MIME/extension `fileFilter` and `limits.fileSize`, stop serving the upload directory, set S3 uploads private | `distribution-backend/routes/common-routes.js:6-7`, `middlewares/strainFileUpload.js:16-19`, `startup/middleware.js:52`, `middlewares/awsBucket.js:22`; same shape in `hemp-backend/routes/common-routes.js:6`, `middlewares/awsBucket.js:22` | anonymous upload → 401; uploaded ID photo not readable by URL | 1 |
| 1.6 | Recompute cart totals server-side; stop reading `total`, `subTotal`, `walletAmount`, `memberId` from the request; remove the wallet-adjust route or gate it super-admin; accept `isVerified` only from a signed vendor callback | `hemp-backend/controllers/cart/cart-controllers.js:2434-2462,2513`; `controllers/POS/pos-controllers.js:403-428`; `controllers/member/member-controllers.js:1174-1206`; `controllers/agechecker/agechecker-controllers.js:52-69` | `total: 0` is rejected; wallet cannot be set by a customer | 8 (the one item in this wave that is not a one-liner; start it now, finish in wave 2) |
| 1.7 | Add `[admin]` to the eight Blaze-sync routes and the CanPay order-cancel route; move the LedgerGreen secret to env | `distribution-backend/routes/blaze/blaze-syncing-routes.js`; `hyperwolf-backend/routes/canpay-routes.js`, `controllers/canpay-controllers.js:118` | unauthenticated call → 401 | 0.5 |
| 1.8 | Add JWT auth in front of promotion-backend's 15 routes and promotion-engine's `/consume-usage`; verify `orderId` exists before crediting usage | `promotion-backend/startup/routes.js:15-16`; `promotion-engine/routes/promotion-routes.js:8-28`, `controllers/promotion-controllers.js:346-485` | `DELETE /promotion/:id` without a token → 401 | 1 |

## Wave 2 — before any feature work: make the estate rebuildable and observable

| # | What | Where | Verify | Hours |
|---|---|---|---|---|
| 2.1 | Un-ignore and commit `package-lock.json`; add `engines.node: "20.x"`; switch deploys to `npm ci` | eight repos that gitignore the lockfile (`repos/*.md` §2); `.gitignore` lines cited there | `npm ci` succeeds from a clean clone | 1.5 |
| 2.2 | Add a CI job that runs `npm ci && npm run build` (and lint where it exists) and make every deploy job depend on its success; point triggers at the branch that actually deploys (wave 0.5) | all `.github/workflows/*.yml` | a broken push does not reach PM2 | 4 |
| 2.3 | `app.use(cors(corsOptionsDelegate))` — the allow-list already exists unused in the same file; parse `ALLOW_ORIGIN` into an array | `hyperwolf-backend/startup/middleware.js:13-26,60`; `hemp-backend/startup/middleware.js:8,55`; `stilo-backend/startup/middleware.js:12-31,66`; `hyperdrive-backend/startup/middleware.js:8-27`; `distribution-backend/startup/middleware.js:6-13,55`; `common/socket.js:12` | cross-origin request from an unknown origin is refused | 0.5 |
| 2.4 | Stop logging DB connection strings, member documents and card data; scrub `req.body` before Sentry captures | `hemp-backend/startup/db.js:7`, `controllers/member/member-controllers.js:349`, `controllers/cart/cart-controllers.js:2613-2616`; `promotion-backend/startup/db.js:16,23,29,36` | grep the PM2 log for `mongodb` and `ccnumber` → nothing | 0.3 |
| 2.5 | Fix error tracking: mount Sentry's error handler after the routes and init once; un-comment `Sentry.init` where `SENTRY_DSN` is mandatory but unused; wire promotion-engine's `errorHandler` | `hemp-backend/startup/middleware.js:61` + 18 other `Sentry.init` sites; `stilo-backend/startup/middleware.js:35-44,73-74`; `distribution-backend/startup/middleware.js:39-48`; `promotion-engine/server.js` | a thrown route error appears in Sentry | 1 |
| 2.6 | Indexes on the transactional collections; fix the three dead indexes | `hemp-backend/models/Order.js`, `models/Member.js:13`; `stilo-backend` same; `distribution-backend/models/KitDistributed.js`; `hyperdrive-backend/models/Fleets.js:71`, `FleetTasks`, `FleetOffDutyCloseout` | `explain()` on the dashboard aggregations shows IXSCAN | 1 |
| 2.7 | Replace the whole-collection loads on hot paths: `Order.find()` on every coupon apply → `countDocuments`; `KitDistributed.find({})` on four list endpoints → filtered + paged; cap `limit` server-side everywhere | `hemp-backend/common/utils.js:1176,1183`; `distribution-backend/controllers/closureOverview/closure-overview-controller.js:35`, `common-controllers.js:888`, `discrepancy-management-controller.js:34`, `kit-refill-controller.js:3985`; all list handlers | response time on a large collection | 2 |
| 2.8 | `crypto.randomBytes` for reset tokens and ids; rate limiters on login, PIN login, reset, register, pointed at routes that exist | `hemp-backend/common/utils.js:213-228`, `startup/routes.js:87`; `stilo-backend` login routes; `distribution-backend` PIN reset routes | `/admin/forgot` is limited | 0.7 |
| 2.9 | Inventory decrement with `$inc` and a `$gte` guard; an overlap guard (lease) on every cron | `hemp-backend/controllers/cart/cart-controllers.js:3094-3159`, `common/utils.js:1074`, `controllers/POS/pos-controllers.js:1520-1543`; every `startup/nodeCrons.js` | two concurrent orders for the last unit: one fails | 3 |
| 2.10 | Fix the cron comments (five of six wrong in two repos), add the unlisted env vars to `.env.example`, validate every referenced env var at boot | `hyperwolf-backend/startup/nodeCrons.js`, `.env.example` (14 missing); `hemp-backend/startup/nodeCrons.js:65-90`; `hyperdrive-backend` (`CRON_TIME`, `KLAVIYO_API_KEY`) | fresh clone from `.env.example` boots | 1 |

## Wave 3 — clean-up that removes footguns (no behaviour change)

| # | What | Where | Hours |
|---|---|---|---|
| 3.1 | Delete `partnerAuth` (a no-op that looks like an auth gate) in four backends; delete the never-wired `auth.js`/`isSuperAdmin.js` copies; delete `adminCreationDisabled` | `middlewares/partnerAuth.js:6` in hyperwolf, hemp, stilo, distribution; `distribution-backend/middlewares/auth.js`; `stilo-backend/middlewares/isSuperAdmin.js` | 1 |
| 3.2 | Delete the dead second and third promotion engines once 1.8 and 4.3 are done; delete ~1,400 dead lines in promotion-engine (`bootstrap.js`, `application/`, `repositories/`, `presenters/`, `core/compiler.js`, `core/db-connection-manager.js`, `core/concurrency.js`, `core/resolver.js`) | `promotion-backend/common/index.js`, `engine/`; `promotion-engine` §12 list | 2 |
| 3.3 | Remove `build.zip` from git and `.gitignore` it; delete the two byte-identical dead role files; pull the 19k-line `Cities.js` into fetched data | `hyperwolf-super-admin` §14.1, §12, §0 | 2 |
| 3.4 | Correct the five READMEs that contradict the code (hyperdrive's describes Socket.IO, `swiftAssign/`, SendGrid, Mapbox that do not exist; four say `.env.example` is absent) | `repos/*.md` §16 item 1 | 1 |
| 3.5 | Remove declared-but-unused dependencies (20 in hemp, 40 in super-admin, Sequelize/pg/Apollo in stilo, `newrelic`/`mongoose-sequence` in promotion-backend) and declare the imported-but-undeclared ones (`uuid`, `sharp`, `cors`, `moment-timezone`, `form-data`, `escpos`) | `repos/*.md` §13 | 2 |
| 3.6 | Fix the schema typos that silently disable validation: `require:` → `required:` (8 in hemp, 2 in promotion-backend), `deafult` ×3, duplicate keys (`shippingCharges`, `onFleetTriggers`, `matchedStrains`), `ref: "Author"` → `"Authors"` | `repos/hemp-backend.md` §5; `repos/promotion-backend.md` §11; `repos/hyperdrive-backend.md` §5 | 0.5 |
| 3.7 | Sanitise the `dangerouslySetInnerHTML` sites (16 / 134 / 65 / 93) through DOMPurify; move tokens out of `localStorage` into httpOnly cookies once wave 4.1 exists | `hemp-retailer-admin` §14-1; `hyperwolf-super-admin` §14.4; `stilo-frontend-nextjs` §14; `hemp-frontend-nextjs` §14 | 8 |

## Wave 4 — platform prerequisites (design with the team; `CONSOLIDATION-AND-PLATFORM-SERVICES.md` §2–3)

| # | What | Depends on |
|---|---|---|
| 4.1 | Identity & Auth service: one issuer, asymmetric keys, refresh + revocation, one `Role` enum, server-side permission checks; retire `PROJECT_API_KEY` and the shared `JWT_ADMIN_PRIVATE_KEY` | contracts package (Claude, Phase 3) |
| 4.2 | `@hyper-tech/backend-core`: the byte-identical S3/CORS/Sentry/error/pagination/auth code as one package; each backend deletes its copy | 2.x |
| 4.3 | promotion-backend calls promotion-engine `/evaluate`; one rule-type enum (six); delete the vendored bundle | 1.8 |
| 4.4 | Pricing & Cart service: server-side quote in cents with `money_basis`; brand backends and POS call it | 4.3, contracts |
| 4.5 | Verify replaces Didit/Persona/Berbix/AgeChecker in hyperwolf-backend first (`docs/IDV-SITE-INTEGRATION.md`: three env vars, `x-api-key`), then hemp/stilo | 0.x rotation, 4.1 for real sessions |
| 4.6 | Rewards ledger replaces `walletAmount` writes and becomes the AlpineIQ sync source | 4.1, contracts |
| 4.7 | Catalog: one Product shape with `platform` and `source`; Blaze/Meadow/Treez as sync adapters | contracts |
| 4.8 | Logistics: hyperdrive owns Fleet/Task; distribution stops opening HW-DB/HEMP-DB | 4.1, 4.2 |

## Wave 5 — merges, in the order and with the risks in `CONSOLIDATION-AND-PLATFORM-SERVICES.md` §4

promotions → hemp+stilo → hyperwolf → logistics → admin-web (strangler) → storefront-web.
Each merge has a written probe suite run against old and new before cutover, and none starts
until waves 1–2 are green in both source repos.
