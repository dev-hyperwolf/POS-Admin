# distribution-backend @ aaa6ecb — mechanical metrics
Scanned 2026-09-09T10:04:37 by tools/hw_audit_metrics.py. Numbers are counts of regex matches over tracked source at HEAD; they are leads for the reviewer, not verdicts.

## Size
- files tracked: 96 · source files: 86 · source lines: 36,485
- by extension: .js 86, .ejs 4, .yml 2, .example 1, (none) 1, .md 1, .json 1
- biggest source files: controllers/driverKitVerification/driver-kit-verification-controller.js (5717); repositories/manageDistributions.repository.js (5615); controllers/kitRefill/kit-refill-controller.js (5480); controllers/blaze/blaze-syncing-controller.js (3822); controllers/closureOverview/closure-overview-controller.js (1874); repositories/kitTemplate.repository.js (1718); controllers/boxes/boxes-controller.js (1521); repositories/aging-rules.repository.js (1258)

## Runtime and dependencies
- engines: None · lockfile: NONE · deps 19 / dev 1 · pinning: {'caret': 20}
- frameworks: {"express": "^5.1.0", "mongoose": "^8.17.1", "jsonwebtoken": "^9.0.2", "axios": "^1.11.0", "socket.io": "^4.8.3", "node-cron": "^4.2.1", "cors": "^2.8.5", "joi": "^18.0.0", "aws-sdk": "^2.1692.0", "@sendgrid/mail": "^8.1.6"}
- version risk: no engines.node
- declared but never imported (1): @sentry/integrations
- imported but not declared: refillLog, uuid
- env vars referenced: 28 · in .env.example: 28 · referenced but missing from example: none
- CI/deploy files: .github/workflows/dev.yml, .github/workflows/security.yml

## Tests
- test deps: none · test files: 0 · test lines: 0 · scripts.test: echo "Error: no test specified" && exit 1

## API surface
- route handlers found: 152 · with no middleware before the handler: 152 · Next pages/routes: 0 · Next api routes: 0
- middleware frequency: 
- unguarded sample: GET /sync/blaze/inventory (routes/blaze/blaze-syncing-routes.js:5); POST /inventory (routes/blaze/blaze-syncing-routes.js:6); POST /refill/inventory (routes/blaze/blaze-syncing-routes.js:7); POST /driver/syncing (routes/blaze/blaze-syncing-routes.js:8); POST /driver/refill/syncing (routes/blaze/blaze-syncing-routes.js:9); POST /check/inventory (routes/blaze/blaze-syncing-routes.js:10); GET /check/sold (routes/blaze/blaze-syncing-routes.js:12); GET /check/sold/driver (routes/blaze/blaze-syncing-routes.js:13); POST /add (routes/boxes/boxes-routes.js:7); GET /list (routes/boxes/boxes-routes.js:8); GET /detail/:id (routes/boxes/boxes-routes.js:9); DELETE /delete/:id (routes/boxes/boxes-routes.js:10); PUT /update/:id (routes/boxes/boxes-routes.js:11); GET /unassigned/products (routes/boxes/boxes-routes.js:12); GET /unassign/products (routes/boxes/boxes-routes.js:13)

## Data model
- models: 32 (ActivityLog, Admin, AgingRules, BoxProduct, Boxes, Brand, Category, Discrepancy, DistributionGlobalSettings, DistributionRefillLogs, FleetOffDutyCloseout, FleetOnDutyChecklists, Fleets, Inventory, KitBoxes, KitDispatch, KitDistributed, KitRefill, KitTemplate, KitTemplateSku, Miscellaneous, Order, Product, ProductBatch, RegionDriverAssign, Regions, RemovedSafeProducts, ResetRequest, SubRegions, closeOut, distributedProductLogs, onDutyChecklists)
- money field types in models/: {'Number': 8, 'String': 1}
  - AgingRules (models/AgingRules.js): fields 6, indexes 0, timestamps False, enums: 'hyperwolf', 'stilo'
  - Boxes (models/Boxes.js): fields 8, indexes 1, timestamps False, enums: "hyperwolf", "stilo"
  - Discrepancy (models/Discrepancy.js): fields 44, indexes 0, timestamps False, enums: "open", "pending", "pendingApproval", "resolved", "rejected"
  - DistributionGlobalSettings (models/DistributionGlobalSettings.js): fields 15, indexes 0, timestamps False, enums: 'hyperwolf', 'stilo'
  - FleetOffDutyCloseout (models/FleetOffDutyCloseout.js): fields 13, indexes 2, timestamps False, enums: "pending", "approved"
  - Fleets (models/Fleets.js): fields 27, indexes 5, timestamps False, enums: 'pending', 'verified'
  - KitDispatch (models/KitDispatch.js): fields 13, indexes 7, timestamps False, enums: "main", "refill" | "dispatched", "cancelled"
  - KitDistributed (models/KitDistributed.js): fields 63, indexes 0, timestamps False, enums: "distribution" | "pending", "dispatched", "hold", "paused" | "packed", "verifying", "verified", "dispatched", "hold", "paused", "pending" | "pending", "dispatched", "hold", "paused" | "packed", "verifying", "verified", "dispatched", "hold", "paused", "pending" | "no_stock", "partial_stock", "validation_failed", "box_capacity_shortfall", "box_max_exceeded", "insufficient_stock", "insufficient_stock_for_subregions"
  - KitTemplate (models/KitTemplate.js): fields 17, indexes 3, timestamps False, enums: "distribution", "refill" | "hyperwolf", "stilo"
  - Regions (models/Regions.js): fields 5, indexes 0, timestamps False, enums: 'hyperwolf', 'stilo'
  - SubRegions (models/SubRegions.js): fields 13, indexes 2, timestamps False, enums: 'hyperwolf', 'stilo'
  - DistributionRefillLogs (models/distributionRefillLogs.js): fields 22, indexes 7, timestamps False, enums: "refill", "distribution" | "completed", "skipped", "failed"
  - KitTemplateSku (models/templateSku.js): fields 6, indexes 0, timestamps False, enums: 'hyperwolf', 'stilo'

## secrets
- none matched

## security
- **unfiltered_find**: 11 hits in 6 files — top: repositories/aging-rules.repository.js (4), controllers/kitRefill/kit-refill-controller.js (2), repositories/kitTemplate.repository.js (2) — e.g. controllers/closureOverview/closure-overview-controller.js:35, controllers/common-controllers.js:888, controllers/discrepancyManagement/discrepancy-management-controller.js:34, controllers/kitRefill/kit-refill-controller.js:3985
- **cors_wildcard**: 2 hits in 2 files — top: common/socket.js (1), startup/middleware.js (1) — e.g. common/socket.js:12, startup/middleware.js:57
- **child_process**: 1 hits in 1 files — top: controllers/region/sub-region-controller.js (1) — e.g. controllers/region/sub-region-controller.js:100
- **mass_assign_update**: 1 hits in 1 files — top: controllers/region/sub-region-controller.js (1) — e.g. controllers/region/sub-region-controller.js:205
- **jwt_no_expiry_hint**: 1 hits in 1 files — top: models/Admin.js (1) — e.g. models/Admin.js:22

## hardcoded
- **http_url**: 12 hits in 4 files — top: startup/middleware.js (5), templates/userForgotEmailTemplate.js (5), controllers/common-controllers.js (1) — e.g. controllers/common-controllers.js:319, models/Fleets.js:6, startup/middleware.js:7, startup/middleware.js:7
- **s3_bucket**: 1 hits in 1 files — top: templates/userForgotEmailTemplate.js (1) — e.g. templates/userForgotEmailTemplate.js:40

## performance
- **find_without_limit**: 191 hits in 14 files — top: repositories/manageDistributions.repository.js (52), repositories/kitTemplate.repository.js (32), controllers/kitRefill/kit-refill-controller.js (25) — e.g. controllers/blaze/blaze-syncing-controller.js:597, controllers/blaze/blaze-syncing-controller.js:1177, controllers/blaze/blaze-syncing-controller.js:2560, controllers/blaze/blaze-syncing-controller.js:3637
- **aggregate_calls**: 25 hits in 8 files — top: controllers/kitRefill/kit-refill-controller.js (7), controllers/boxes/boxes-controller.js (5), repositories/aging-rules.repository.js (4) — e.g. controllers/boxes/boxes-controller.js:1069, controllers/boxes/boxes-controller.js:1070, controllers/boxes/boxes-controller.js:1479, controllers/boxes/boxes-controller.js:1480
- **await_in_loop_hint**: 7 hits in 4 files — top: repositories/manageDistributions.repository.js (3), repositories/kitTemplate.repository.js (2), controllers/blaze/blaze-syncing-controller.js (1) — e.g. controllers/blaze/blaze-syncing-controller.js:1766, controllers/driverKitVerification/driver-kit-verification-controller.js:2336, repositories/kitTemplate.repository.js:731, repositories/kitTemplate.repository.js:820
- **settimeout_in_handler**: 7 hits in 1 files — top: controllers/blaze/blaze-syncing-controller.js (7) — e.g. controllers/blaze/blaze-syncing-controller.js:237, controllers/blaze/blaze-syncing-controller.js:273, controllers/blaze/blaze-syncing-controller.js:565, controllers/blaze/blaze-syncing-controller.js:864
- **populate_calls**: 5 hits in 3 files — top: controllers/boxes/boxes-controller.js (2), repositories/aging-rules.repository.js (2), controllers/discrepancyManagement/discrepancy-management-controller.js (1) — e.g. controllers/boxes/boxes-controller.js:830, controllers/boxes/boxes-controller.js:1290, controllers/discrepancyManagement/discrepancy-management-controller.js:419, repositories/aging-rules.repository.js:595
- **sync_fs**: 1 hits in 1 files — top: controllers/driverKitVerification/driver-kit-verification-controller.js (1) — e.g. controllers/driverKitVerification/driver-kit-verification-controller.js:4248

## quality
- **console_log**: 304 hits in 24 files — top: repositories/manageDistributions.repository.js (96), controllers/kitRefill/kit-refill-controller.js (53), controllers/blaze/blaze-syncing-controller.js (42) — e.g. common/emailService.js:20, common/scanHandler.js:24, common/socket.js:18, common/socket.js:36
- **commented_code_hint**: 180 hits in 8 files — top: controllers/blaze/blaze-syncing-controller.js (124), controllers/common-controllers.js (34), controllers/driverKitVerification/driver-kit-verification-controller.js (10) — e.g. controllers/blaze/blaze-syncing-controller.js:1871, controllers/blaze/blaze-syncing-controller.js:1873, controllers/blaze/blaze-syncing-controller.js:1878, controllers/blaze/blaze-syncing-controller.js:1881
- **empty_catch**: 2 hits in 2 files — top: controllers/blaze/blaze-syncing-controller.js (1), controllers/driverKitVerification/driver-kit-verification-controller.js (1) — e.g. controllers/blaze/blaze-syncing-controller.js:3521, controllers/driverKitVerification/driver-kit-verification-controller.js:5257

## Docs in repo
- README.md
