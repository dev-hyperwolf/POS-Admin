# hyperdrive-backend @ afa975b — mechanical metrics
Scanned 2026-09-09T10:04:40 by tools/hw_audit_metrics.py. Numbers are counts of regex matches over tracked source at HEAD; they are leads for the reviewer, not verdicts.

## Size
- files tracked: 91 · source files: 78 · source lines: 10,872
- by extension: .js 78, (none) 4, .json 4, .md 2, .example 1, .yml 1, .txt 1
- biggest source files: admin/controllers/task-controller.js (2535); controllers/tasks/task-controller.js (1489); controllers/fleets/fleet-controller.js (978); admin/controllers/driverAnalytics/driver-analytics-controller.js (800); admin/controllers/analyze/analyze-controller.js (433); admin/controllers/headQuarter-controller.js (424); common/util.js (388); models/TasksModel.js (363)

## Runtime and dependencies
- engines: None · lockfile: ['package-lock.json'] · deps 28 / dev 0 · pinning: {'caret': 28}
- frameworks: {"express": "^4.19.2", "mongoose": "^8.5.2", "jsonwebtoken": "^9.0.2", "axios": "^1.7.7", "node-cron": "^3.0.3", "cors": "^2.8.5", "joi": "^17.13.3", "bcrypt": "^5.1.1", "winston": "^3.14.1", "firebase-admin": "^12.4.0", "aws-sdk": "^2.1687.0"}
- version risk: express 4.x (5.x current); no engines.node
- declared but never imported (1): nodemon
- imported but not declared: csv-writer, form-data
- env vars referenced: 31 · in .env.example: 43 · referenced but missing from example: CRON_TIME, IS_DEVELOPMENT, KLAVIYO_API_KEY
- CI/deploy files: .github/workflows/dev.yml

## Tests
- test deps: none · test files: 0 · test lines: 0 · scripts.test: none

## API surface
- route handlers found: 86 · with no middleware before the handler: 82 · Next pages/routes: 0 · Next api routes: 0
- middleware frequency: conditionalAdminAuth 1, fleetLoginValidation 1, fleetForgotPasswordValidation 1, recommendFleetValidation 1
- unguarded sample: GET / (routes/admin/analyze/analyze-routes.js:7); GET /export (routes/admin/analyze/analyze-routes.js:8); GET /graph (routes/admin/analyze/analyze-routes.js:9); POST /add (routes/admin/closeOut/closeOut-routes.js:6); GET /list (routes/admin/closeOut/closeOut-routes.js:7); PUT /update/:id (routes/admin/closeOut/closeOut-routes.js:8); GET /list (routes/admin/driverAnalytics/driver-analytics-route.js:7); GET /details/:fleetId (routes/admin/driverAnalytics/driver-analytics-route.js:8); GET /export (routes/admin/driverAnalytics/driver-analytics-route.js:9); GET /view/route (routes/admin/driverAnalytics/driver-analytics-route.js:10); GET /view/checkInDetails (routes/admin/driverAnalytics/driver-analytics-route.js:11); POST /create (routes/admin/headQuarter/headQuarter-routes.js:8); GET /list (routes/admin/headQuarter/headQuarter-routes.js:9); GET /:id (routes/admin/headQuarter/headQuarter-routes.js:10); DELETE /:id (routes/admin/headQuarter/headQuarter-routes.js:11)

## Data model
- models: 28 (ActivityLogs, Admin, Announcements, ApprovalNotifications, Break, FailureReason, FleetBreakLog, FleetCloseout, FleetOffDutyCloseout, FleetOnDutyChecklists, FleetTasks, Fleets, HyperDriveNotification, HyperdriveResetRequest, Miscellaneous, Order, Region, ReturnToHQ, StartTask, Tasks, TerminalProducts, TransportationTypes, closeOut, fleetAccessTokens, fleetActivityLogs, fleetDevices, fleetTaskActivityLogs, onDutyChecklists)
- money field types in models/: {'String': 1, 'Number': 4}
  - fleetAccessTokens (models/FleetAccessTokens.js): fields 6, indexes 2, timestamps False, enums: true, false
  - fleetActivityLogs (models/FleetActivityLogs.js): fields 9, indexes 4, timestamps False, enums: 'pending','completed' | true, false
  - fleetDevices (models/FleetDevices.js): fields 8, indexes 2, timestamps False, enums: true, false
  - fleetTaskActivityLogs (models/FleetTaskActivityLogs.js): fields 7, indexes 2, timestamps False, enums: 'in_progress','completed','cancelled' | true, false
  - Fleets (models/Fleets.js): fields 29, indexes 4, timestamps False, enums: 'pending', 'verified'
  - Region (models/Region.js): fields 36, indexes 0, timestamps False, enums: 'zipCode', 'geoFence', 'customZone'

## secrets
- none matched

## security
- **child_process**: 21 hits in 8 files — top: admin/controllers/task-controller.js (9), controllers/tasks/task-controller.js (3), admin/controllers/headQuarter-controller.js (2) — e.g. admin/controllers/closeOut/closeOut-controller.js:31, admin/controllers/driverAnalytics/driver-analytics-controller.js:791, admin/controllers/headQuarter-controller.js:156, admin/controllers/headQuarter-controller.js:228
- **unfiltered_find**: 6 hits in 4 files — top: admin/controllers/headQuarter-controller.js (2), admin/controllers/task-controller.js (2), admin/controllers/closeOut/closeOut-controller.js (1) — e.g. admin/controllers/closeOut/closeOut-controller.js:31, admin/controllers/driverAnalytics/driver-analytics-controller.js:716, admin/controllers/headQuarter-controller.js:228, admin/controllers/headQuarter-controller.js:277
- **cors_wildcard**: 1 hits in 1 files — top: startup/middleware.js (1) — e.g. startup/middleware.js:27
- **jwt_no_expiry_hint**: 1 hits in 1 files — top: models/FleetAccessTokens.js (1) — e.g. models/FleetAccessTokens.js:21

## hardcoded
- **role_string**: 10 hits in 2 files — top: admin/controllers/task-controller.js (9), models/TasksModel.js (1) — e.g. admin/controllers/task-controller.js:286, admin/controllers/task-controller.js:309, admin/controllers/task-controller.js:346, admin/controllers/task-controller.js:411
- **http_url**: 8 hits in 4 files — top: startup/middleware.js (5), common/util.js (1), controllers/tasks/task-controller.js (1) — e.g. common/util.js:312, controllers/tasks/task-controller.js:972, models/Fleets.js:7, startup/middleware.js:4
- **objectid_24hex**: 2 hits in 2 files — top: controllers/tasks/task-controller.js (1), driverAssignment/monitoring/monitoringCron.js (1) — e.g. controllers/tasks/task-controller.js:1021, driverAssignment/monitoring/monitoringCron.js:238
- **phone_literal**: 1 hits in 1 files — top: common/util.js (1) — e.g. common/util.js:273

## performance
- **find_without_limit**: 57 hits in 16 files — top: admin/controllers/driverAnalytics/driver-analytics-controller.js (15), admin/controllers/task-controller.js (9), controllers/tasks/task-controller.js (9) — e.g. admin/controllers/analyze/analyze-controller.js:43, admin/controllers/analyze/analyze-controller.js:121, admin/controllers/analyze/analyze-controller.js:269, admin/controllers/closeOut/closeOut-controller.js:31
- **sync_fs**: 7 hits in 2 files — top: common/logger.js (4), admin/controllers/analyze/analyze-controller.js (3) — e.g. admin/controllers/analyze/analyze-controller.js:396, admin/controllers/analyze/analyze-controller.js:399, admin/controllers/analyze/analyze-controller.js:402, common/logger.js:14
- **populate_calls**: 7 hits in 6 files — top: driverAssignment/scheduleAssignment/updateOrderTask.js (2), admin/controllers/driverAnalytics/driver-analytics-controller.js (1), admin/controllers/mapFleetDetails/fleetInfo-controller.js (1) — e.g. admin/controllers/driverAnalytics/driver-analytics-controller.js:193, admin/controllers/mapFleetDetails/fleetInfo-controller.js:44, admin/controllers/task-controller.js:2137, driverAssignment/monitoring/monitoringCron.js:239
- **aggregate_calls**: 7 hits in 6 files — top: controllers/fleets/fleet-controller.js (2), admin/controllers/driverAnalytics/driver-analytics-controller.js (1), admin/controllers/headQuarter-controller.js (1) — e.g. admin/controllers/driverAnalytics/driver-analytics-controller.js:615, admin/controllers/headQuarter-controller.js:135, controllers/fleets/fleet-controller.js:129, controllers/fleets/fleet-controller.js:839
- **await_in_loop_hint**: 4 hits in 3 files — top: admin/controllers/task-controller.js (2), controllers/fleets/fleet-controller.js (1), driverAssignment/reAssignment/reAssignTaskAuto.js (1) — e.g. admin/controllers/task-controller.js:308, admin/controllers/task-controller.js:2471, controllers/fleets/fleet-controller.js:897, driverAssignment/reAssignment/reAssignTaskAuto.js:17
- **settimeout_in_handler**: 2 hits in 1 files — top: awsEvent/iotCore.js (2) — e.g. awsEvent/iotCore.js:50, awsEvent/iotCore.js:57

## quality
- **commented_code_hint**: 136 hits in 12 files — top: controllers/tasks/task-controller.js (42), driverAssignment/assignment/regionAssignmentRule.js (37), driverAssignment/commonFunc.js (15) — e.g. admin/controllers/driverAnalytics/driver-analytics-controller.js:31, admin/controllers/driverAnalytics/driver-analytics-controller.js:189, admin/controllers/driverAnalytics/driver-analytics-controller.js:780, admin/controllers/driverAnalytics/driver-analytics-controller.js:781
- **console_log**: 90 hits in 17 files — top: driverAssignment/monitoring/monitoringCron.js (15), startup/cronJobs.js (15), admin/controllers/task-controller.js (10) — e.g. admin/controllers/headQuarter-controller.js:327, admin/controllers/headQuarter-controller.js:398, admin/controllers/task-controller.js:179, admin/controllers/task-controller.js:2043
- **empty_catch**: 12 hits in 3 files — top: admin/controllers/task-controller.js (5), controllers/tasks/task-controller.js (4), common/util.js (3) — e.g. admin/controllers/task-controller.js:261, admin/controllers/task-controller.js:535, admin/controllers/task-controller.js:1404, admin/controllers/task-controller.js:1522

## Docs in repo
- README.md, awsEvent/readme.md
