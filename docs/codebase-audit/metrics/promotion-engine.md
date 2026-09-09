# promotion-engine @ 8e37229 — mechanical metrics
Scanned 2026-09-09T10:04:47 by tools/hw_audit_metrics.py. Numbers are counts of regex matches over tracked source at HEAD; they are leads for the reviewer, not verdicts.

## Size
- files tracked: 64 · source files: 57 · source lines: 17,727
- by extension: .js 57, .json 3, (none) 2, .example 1, .yml 1
- biggest source files: engine.js (2316); utils/common.js (1972); rule-types/user/evaluator.js (1562); rule-types/cart/evaluator.js (1484); rule-types/product/evaluator.js (1477); utils/normalization.js (1104); rule-types/bogo/evaluator.js (908); controllers/promotion-controllers.js (486)

## Runtime and dependencies
- engines: {'node': '>=18.0.0'} · lockfile: ['package-lock.json'] · deps 8 / dev 4 · pinning: {'caret': 12}
- frameworks: {"express": "^5.2.1", "mongoose": "^8.21.0", "axios": "^1.13.6", "jest": "^29.7.0"}
- declared but never imported (1): p-limit
- imported but not declared: *25%
- env vars referenced: 23 · in .env.example: 23 · referenced but missing from example: none
- CI/deploy files: .github/workflows/dev.yml

## Tests
- test deps: ['jest'] · test files: 0 · test lines: 0 · scripts.test: jest --coverage

## API surface
- route handlers found: 6 · with no middleware before the handler: 4 · Next pages/routes: 0 · Next api routes: 0
- middleware frequency: validationMiddleware 2
- unguarded sample: GET /health (routes/promotion-routes.js:8); POST /compile-promotion (routes/promotion-routes.js:18); POST /consume-usage (routes/promotion-routes.js:28); GET / (startup/routes.js:5)

## Data model
- models: 2 (Cart, Promotion)
- money field types in models/: none matched

## secrets
- none matched

## security
- none matched

## hardcoded
- **role_string**: 13 hits in 4 files — top: engine.js (10), core/compiler.js (1), core/constants.js (1) — e.g. core/compiler.js:19, core/constants.js:203, engine.js:287, engine.js:413
- **mongo_uri**: 2 hits in 1 files — top: core/db-connection-manager.js (2) — e.g. core/db-connection-manager.js:26, core/db-connection-manager.js:26

## performance
- **find_without_limit**: 26 hits in 11 files — top: rule-types/bogo/evaluator.js (4), utils/common.js (4), engine.js (3) — e.g. controllers/promotion-controllers.js:336, controllers/promotion-controllers.js:431, engine.js:158, engine.js:1368
- **aggregate_calls**: 13 hits in 1 files — top: utils/common.js (13) — e.g. utils/common.js:140, utils/common.js:218, utils/common.js:309, utils/common.js:425
- **settimeout_in_handler**: 5 hits in 3 files — top: core/errors.js (2), utils/initialize.js (2), core/db-connection-manager.js (1) — e.g. core/db-connection-manager.js:236, core/errors.js:104, core/errors.js:119, utils/initialize.js:52
- **sync_fs**: 1 hits in 1 files — top: core/logger.js (1) — e.g. core/logger.js:12

## quality
- **console_log**: 34 hits in 8 files — top: rule-types/user/evaluator.js (13), rule-types/bogo/evaluator.js (10), rule-types/product/evaluator.js (3) — e.g. engine.js:1325, engine.js:1399, rule-types/bogo/evaluator.js:411, rule-types/bogo/evaluator.js:442
- **todo_fixme**: 14 hits in 5 files — top: rule-types/product/evaluator.js (8), rule-types/product/context.js (2), rule-types/user/evaluator.js (2) — e.g. engine.js:912, rule-types/cart/evaluator.js:1390, rule-types/product/context.js:80, rule-types/product/context.js:131
- **commented_code_hint**: 7 hits in 7 files — top: engine.js (1), rule-types/product/compiler.js (1), rule-types/product/context.js (1) — e.g. engine.js:1432, rule-types/product/compiler.js:88, rule-types/product/context.js:81, rule-types/product/evaluator.js:1464

## Docs in repo
- none
