# promotion-backend @ d1bd9a8 — mechanical metrics
Scanned 2026-09-09T10:04:47 by tools/hw_audit_metrics.py. Numbers are counts of regex matches over tracked source at HEAD; they are leads for the reviewer, not verdicts.

## Size
- files tracked: 46 · source files: 39 · source lines: 16,369
- by extension: .js 39, .json 3, .example 1, .yml 1, (none) 1, .md 1
- biggest source files: common/index.js (10940); services/product-promo-tag.service.js (1407); controllers/promotion-controllers.js (1108); utils/product-listing-utils.js (360); services/promo-price-sync.service.js (309); controllers/product-listing-controller.js (252); utils/rule-duplicate-check.js (234); engine/attributeResolvers/index.js (157)

## Runtime and dependencies
- engines: None · lockfile: ['package-lock.json'] · deps 7 / dev 1 · pinning: {'caret': 8}
- frameworks: {"express": "^4.19.2", "mongoose": "^5.11.15", "cors": "^2.8.5", "joi": "^18.0.2", "newrelic": "^13.8.1"}
- version risk: mongoose 5.x (EOL; 8.x current); express 4.x (5.x current); no engines.node
- declared but never imported (2): mongoose-sequence, newrelic
- imported but not declared: *25%
- env vars referenced: 10 · in .env.example: 10 · referenced but missing from example: none
- CI/deploy files: .github/workflows/dev.yml

## Tests
- test deps: none · test files: 0 · test lines: 0 · scripts.test: none

## API surface
- route handlers found: 15 · with no middleware before the handler: 15 · Next pages/routes: 0 · Next api routes: 0
- middleware frequency: 
- unguarded sample: GET /product (routes/product-listing-routes.js:5); GET /category (routes/product-listing-routes.js:6); GET /brand (routes/product-listing-routes.js:7); GET /region (routes/product-listing-routes.js:8); POST /create (routes/promotion-routes.js:5); GET / (routes/promotion-routes.js:6); GET /product-tags (routes/promotion-routes.js:7); POST /product-tags/rebuild (routes/promotion-routes.js:8); GET /:id (routes/promotion-routes.js:9); PUT /:id (routes/promotion-routes.js:10); DELETE /:id (routes/promotion-routes.js:11); POST /validate (routes/promotion-routes.js:12); POST /create/rule (routes/promotion-routes.js:13); POST /dynamic/validate (routes/promotion-routes.js:14); GET / (startup/routes.js:10)

## Data model
- models: 19 (Brand, Category, HempProducts, Product, ProductPromoTag, PromoCode, Promotion, Region, Regions, Rule, Rules, StoreProducts)
- money field types in models/: {'Number': 2}
  - Promotion (models/Promotion.js): fields 27, indexes 6, timestamps False, enums: "active", "inactive"
  - Rule (models/Rule.js): fields 10, indexes 1, timestamps False, enums: "cart", "user", "product", "bogo" |          "each_or_any",         "cart_total",         "cart_count",         "category_id",         "product_id",         "user_group",         "mp_id"       
  - Rule (models/Rule.js): fields 10, indexes 1, timestamps False, enums: "cart", "user", "product", "bogo" |          "each_or_any",         "cart_total",         "cart_count",         "category_id",         "product_id",         "user_group",         "mp_id"       
  - Rules (models/Rules.js): fields 16, indexes 0, timestamps False, enums: 'input', 'select' | '>', '<=', '>=', '=='

## secrets
- none matched

## security
- **child_process**: 2 hits in 1 files — top: common/index.js (2) — e.g. common/index.js:1108, common/index.js:3390
- **cors_wildcard**: 1 hits in 1 files — top: index.js (1) — e.g. index.js:7
- **math_random_token**: 1 hits in 1 files — top: controllers/promotion-controllers.js (1) — e.g. controllers/promotion-controllers.js:227

## hardcoded
- **http_url**: 25 hits in 2 files — top: common/index.js (23), controllers/promotion-controllers.js (2) — e.g. common/index.js:1269, common/index.js:3089, common/index.js:3890, common/index.js:3913
- **objectid_24hex**: 7 hits in 2 files — top: controllers/product-listing-controller.js (6), common/index.js (1) — e.g. common/index.js:412, controllers/product-listing-controller.js:115, controllers/product-listing-controller.js:116, controllers/product-listing-controller.js:117
- **role_string**: 6 hits in 3 files — top: common/index.js (4), models/Rule.js (1), models/Rules.js (1) — e.g. common/index.js:177, common/index.js:485, common/index.js:524, common/index.js:9941

## performance
- **find_without_limit**: 15 hits in 5 files — top: common/index.js (4), controllers/product-listing-controller.js (4), services/product-promo-tag.service.js (4) — e.g. common/index.js:565, common/index.js:1782, common/index.js:2749, common/index.js:5918
- **sync_fs**: 1 hits in 1 files — top: common/index.js (1) — e.g. common/index.js:401
- **aggregate_calls**: 1 hits in 1 files — top: common/index.js (1) — e.g. common/index.js:10413
- **settimeout_in_handler**: 1 hits in 1 files — top: controllers/promotion-controllers.js (1) — e.g. controllers/promotion-controllers.js:180

## quality
- **console_log**: 28 hits in 7 files — top: common/index.js (14), controllers/product-listing-controller.js (5), startup/db.js (4) — e.g. common/index.js:392, common/index.js:396, common/index.js:503, common/index.js:8816
- **commented_code_hint**: 24 hits in 3 files — top: common/index.js (18), controllers/promotion-controllers.js (5), utils/product-listing-utils.js (1) — e.g. common/index.js:451, common/index.js:500, common/index.js:1565, common/index.js:1754
- **todo_fixme**: 1 hits in 1 files — top: common/index.js (1) — e.g. common/index.js:8711

## Docs in repo
- README.md
