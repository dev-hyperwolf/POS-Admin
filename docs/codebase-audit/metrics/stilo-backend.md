# stilo-backend @ a9f4407 — mechanical metrics
Scanned 2026-09-09T10:04:48 by tools/hw_audit_metrics.py. Numbers are counts of regex matches over tracked source at HEAD; they are leads for the reviewer, not verdicts.

## Size
- files tracked: 249 · source files: 197 · source lines: 45,438
- by extension: .js 197, .png 21, .json 14, .txt 4, .svg 3, .kml 3, (none) 2, .yml 2, .example 1, .md 1, .html 1
- biggest source files: controllers/POS/pos-controllers.js (4696); common/utils.js (3697); controllers/product/product-controllers.js (3425); controllers/order/order-controllers.js (3165); controllers/common-controllers.js (2374); controllers/admin/store-product-controllers.js (2121); controllers/admin/dashboard-controllers.js (2055); controllers/cart/cart-controllers.js (2051)

## Runtime and dependencies
- engines: None · lockfile: NONE · deps 45 / dev 0 · pinning: {'caret': 45}
- frameworks: {"express": "^4.21.2", "mongoose": "^8.9.5", "sequelize": "^6.37.5", "pg": "^8.13.1", "jsonwebtoken": "^9.0.2", "axios": "^1.7.9", "node-cron": "^3.0.2", "express-rate-limit": "^7.5.1", "joi": "^17.13.3", "bcrypt": "^5.1.1", "firebase-admin": "^13.3.0", "aws-sdk": "^2.1692.0", "@sendgrid/mail": "^8.1.5"}
- version risk: express 4.x (5.x current); BOTH sequelize and mongoose in one service; no engines.node
- declared but never imported (14): @graphql-tools/merge, apollo-server, apollo-server-express, child_process, fetch, get-stream, graphql, join-images, nodemon, pdf-to-printer, pg, pg-hstore, sequelize, tar-fs
- imported but not declared: cors, escpos, form-data, fromInventory, moment-timezone, sharp
- env vars referenced: 91 · in .env.example: 91 · referenced but missing from example: none
- CI/deploy files: .github/workflows/security.yml, .github/workflows/stage.yml

## Tests
- test deps: none · test files: 0 · test lines: 0 · scripts.test: none

## API surface
- route handlers found: 504 · with no middleware before the handler: 490 · Next pages/routes: 0 · Next api routes: 0
- middleware frequency: checkStoreExists 13, pingRateLimiter 1
- unguarded sample: GET /get/products/:id (routes/POS/pos-routes.js:5); POST /prepare/cart (routes/POS/pos-routes.js:6); POST /submit/cart (routes/POS/pos-routes.js:7); GET /order/purchased/list (routes/POS/pos-routes.js:8); GET /order/return/list (routes/POS/pos-routes.js:9); POST /create/order (routes/POS/pos-routes.js:10); POST /update/order/:id (routes/POS/pos-routes.js:11); POST /return/order (routes/POS/pos-routes.js:12); POST /age/verification (routes/POS/pos-routes.js:14); GET /fulfillment/orders (routes/POS/pos-routes.js:16); GET /search/member (routes/POS/pos-routes.js:17); POST /checkin/member (routes/POS/pos-routes.js:18); GET /checkin/logs (routes/POS/pos-routes.js:19); POST /pin/login (routes/POS/pos-routes.js:21); POST /scan/items (routes/POS/pos-routes.js:22)

## Data model
- models: 56 (ActiveCart, ActivityLogs, Admin, Approvals, Authors, Banners, Blog, BranchSetting, Brand, Cannabinoid, CannabinoidBanners, CannabisLimit, CartRules, Category, Employee, ErrorLog, Faq, Inventory, Legal, Log, MainBrand, MainCannabinoid, MainProductTraits, MainStrain, Member, MemberWalletReasons, Miscellaneous, NotificationData, Order, OrderManager, OrderTracker, POSChekIn, PaymentSetting, Physicisans, PrinterSetup, ProductBatch, ProductRules, Promotion, RefundReasons, Region, ResetRequest, StiloProducts, Store, StoreCoordinates, StoreProducts, StoreUser, Strain, SubProductTraits, Tax, TaxSettings, Terpenoids, TransactionLog, UserRolesPermissions, VersionSync, WebCategory)
- money field types in models/: {'Number': 18, 'String': 9}
  - Blog (models/Blog.js): fields 32, indexes 5, timestamps False, enums: 'published', 'draft'
  - MainProductTraits (models/MainProductTraits.js): fields 35, indexes 2, timestamps False, enums: 'Active', 'Inactive' | 'image', 'video' | 'image', 'video'
  - PaymentSetting (models/PaymentSetting.js): fields 8, indexes 1, timestamps False, enums: 'test', 'live'
  - PrinterSetup (models/PrinterSetup.js): fields 9, indexes 0, timestamps False, enums: 'Network', 'USB'
  - StoreCoordinates (models/StoreCoordinates.js): fields 6, indexes 1, timestamps False, enums: 'Polygon'
  - SubProductTraits (models/SubProductTraits.js): fields 34, indexes 0, timestamps False, enums: 'Active', 'Inactive'
  - Tax (models/Tax.js): fields 16, indexes 0, timestamps False, enums: "pre-taxed", "post-taxed" | "MedicinalUser", "AdultUse" | "Cannabis", "Non-Cannabis"
  - TransactionLog (models/TransactionLog.js): fields 11, indexes 0, timestamps False, enums: 'success', 'failed', 'pending'

## secrets
- **private_key_block**: 1 hits in 1 files — top: staticDB/fcmtoken.json (1) — e.g. staticDB/fcmtoken.json:5
- **assigned_secret**: 1 hits in 1 files — top: controllers/common-controllers.js (1) — e.g. controllers/common-controllers.js:46

## security
- **child_process**: 60 hits in 22 files — top: controllers/admin/dashboard-controllers.js (10), controllers/member/member-controllers.js (7), controllers/product/product-controllers.js (5) — e.g. common/utils.js:921, common/utils.js:922, common/utils.js:923, common/utils.js:1890
- **unfiltered_find**: 37 hits in 24 files — top: controllers/product/product-controllers.js (5), controllers/cannabinoids/cannabinoids-controllers.js (3), controllers/sitemap-controllers.js (3) — e.g. common/utils.js:1215, controllers/POS/pos-controllers.js:109, controllers/admin/admin-user-controller.js:314, controllers/admin/banner-controllers.js:36
- **req_query_in_regex**: 9 hits in 7 files — top: controllers/admin/cart-rules-controllers.js (2), controllers/admin/product-rules-controllers.js (2), controllers/admin/dashboard-controllers.js (1) — e.g. controllers/admin/cart-rules-controllers.js:92, controllers/admin/cart-rules-controllers.js:96, controllers/admin/dashboard-controllers.js:1982, controllers/admin/product-rules-controllers.js:99
- **mass_assign_update**: 8 hits in 5 files — top: controllers/POS/pos-controllers.js (4), controllers/admin/cannabisLimit-controller.js (1), controllers/admin/store-product-controllers.js (1) — e.g. controllers/POS/pos-controllers.js:2590, controllers/POS/pos-controllers.js:2603, controllers/POS/pos-controllers.js:2629, controllers/POS/pos-controllers.js:2652
- **sql_concat**: 7 hits in 5 files — top: controllers/admin/cart-rules-controllers.js (2), controllers/admin/product-rules-controllers.js (2), controllers/admin/admin-user-controller.js (1) — e.g. controllers/admin/admin-user-controller.js:124, controllers/admin/cart-rules-controllers.js:92, controllers/admin/cart-rules-controllers.js:96, controllers/admin/product-rules-controllers.js:99
- **jwt_no_expiry_hint**: 3 hits in 3 files — top: models/Admin.js (1), models/Store.js (1), models/StoreUser.js (1) — e.g. models/Admin.js:23, models/Store.js:50, models/StoreUser.js:35
- **cors_wildcard**: 2 hits in 1 files — top: startup/middleware.js (2) — e.g. startup/middleware.js:66, startup/middleware.js:68

## hardcoded
- **http_url**: 57 hits in 15 files — top: emailTemplates/orderCompletedOrCancelled.js (7), startup/middleware.js (6), emailTemplates/ordersEmailTemplates.js (5) — e.g. common/utils.js:647, controllers/POS/pos-controllers.js:47, controllers/common-controllers.js:1756, controllers/common-controllers.js:1757
- **role_string**: 44 hits in 15 files — top: controllers/admin/category-controllers.js (7), controllers/common-controllers.js (6), controllers/admin/blog-controller.js (5) — e.g. controllers/admin/blog-controller.js:255, controllers/admin/blog-controller.js:261, controllers/admin/blog-controller.js:711, controllers/admin/blog-controller.js:715
- **phone_literal**: 4 hits in 2 files — top: controllers/textVolt/textVolt-controllers.js (3), common/utils.js (1) — e.g. common/utils.js:765, controllers/textVolt/textVolt-controllers.js:19, controllers/textVolt/textVolt-controllers.js:67, controllers/textVolt/textVolt-controllers.js:100
- **localhost**: 2 hits in 1 files — top: controllers/common-controllers.js (2) — e.g. controllers/common-controllers.js:1756, controllers/common-controllers.js:1757
- **mongo_uri**: 2 hits in 1 files — top: controllers/common-controllers.js (2) — e.g. controllers/common-controllers.js:1911, controllers/common-controllers.js:1911
- **ip_literal**: 2 hits in 1 files — top: controllers/common-controllers.js (2) — e.g. controllers/common-controllers.js:1756, controllers/common-controllers.js:1757
- **s3_bucket**: 2 hits in 2 files — top: controllers/POS/pos-controllers.js (1), emailTemplates/userForgotEmailTemplate.js (1) — e.g. controllers/POS/pos-controllers.js:47, emailTemplates/userForgotEmailTemplate.js:40
- **email_literal**: 2 hits in 2 files — top: controllers/POS/pos-controllers.js (1), controllers/cart/cart-controllers.js (1) — e.g. controllers/POS/pos-controllers.js:1323, controllers/cart/cart-controllers.js:1105

## performance
- **find_without_limit**: 232 hits in 39 files — top: controllers/product/product-controllers.js (33), common/utils.js (23), controllers/admin/product-traits-controllers.js (17) — e.g. common/utils.js:358, common/utils.js:361, common/utils.js:378, common/utils.js:496
- **aggregate_calls**: 74 hits in 15 files — top: controllers/product/product-controllers.js (13), controllers/admin/dashboard-controllers.js (12), controllers/POS/pos-controllers.js (9) — e.g. common/utils.js:921, common/utils.js:922, common/utils.js:923, common/utils.js:2951
- **await_in_loop_hint**: 15 hits in 8 files — top: controllers/POS/pos-controllers.js (4), controllers/admin/product-traits-controllers.js (3), controllers/cart/cart-controllers.js (3) — e.g. controllers/POS/pos-controllers.js:213, controllers/POS/pos-controllers.js:722, controllers/POS/pos-controllers.js:2436, controllers/POS/pos-controllers.js:2575
- **sync_fs**: 6 hits in 4 files — top: controllers/common-controllers.js (2), controllers/didit/didit-controllers.js (2), controllers/member/member-controllers.js (1) — e.g. controllers/common-controllers.js:852, controllers/common-controllers.js:949, controllers/didit/didit-controllers.js:213, controllers/didit/didit-controllers.js:257
- **settimeout_in_handler**: 1 hits in 1 files — top: common/utils.js (1) — e.g. common/utils.js:411

## quality
- **commented_code_hint**: 280 hits in 24 files — top: controllers/POS/pos-controllers.js (78), controllers/admin/blog-controller.js (66), controllers/order/order-controllers.js (26) — e.g. common/utils.js:1314, common/utils.js:1783, common/utils.js:1785, common/utils.js:3471
- **console_log**: 147 hits in 32 files — top: controllers/POS/pos-controllers.js (25), controllers/common-controllers.js (17), common/utils.js (14) — e.g. common/emailService.js:23, common/fcmNotifications.js:7, common/fcmNotifications.js:30, common/fcmNotifications.js:33
- **empty_catch**: 28 hits in 9 files — top: controllers/admin/store-product-controllers.js (8), common/utils.js (6), controllers/order/order-controllers.js (4) — e.g. common/utils.js:1758, common/utils.js:2048, common/utils.js:2092, common/utils.js:2214
- **todo_fixme**: 4 hits in 2 files — top: emailTemplates/storeCreateTemplate.js (2), emailTemplates/storeUserTemplate.js (2) — e.g. emailTemplates/storeCreateTemplate.js:18, emailTemplates/storeCreateTemplate.js:18, emailTemplates/storeUserTemplate.js:18, emailTemplates/storeUserTemplate.js:18

## Docs in repo
- README.md
