# hemp-backend @ 4725d37 — mechanical metrics
Scanned 2026-09-09T10:04:38 by tools/hw_audit_metrics.py. Numbers are counts of regex matches over tracked source at HEAD; they are leads for the reviewer, not verdicts.

## Size
- files tracked: 250 · source files: 197 · source lines: 37,313
- by extension: .js 197, .png 21, .json 12, .txt 4, .svg 3, .kml 3, .yml 2, .md 2, .gif 2, .example 1, (none) 1, .html 1
- biggest source files: controllers/cart/cart-controllers.js (3486); controllers/product/product-controllers.js (2905); controllers/order/order-controllers.js (2818); common/utils.js (2341); controllers/admin/dashboard-controllers.js (2054); controllers/common-controllers.js (1705); controllers/admin/retailer-product-controllers.js (1686); controllers/POS/pos-controllers.js (1599)

## Runtime and dependencies
- engines: {'node': '>=12.x'} · lockfile: NONE · deps 47 / dev 5 · pinning: {'caret': 50, 'exact': 2}
- frameworks: {"express": "^4.22.1", "mongoose": "^5.11.15", "jsonwebtoken": "^8.5.1", "axios": "^0.21.4", "socket.io": "^4.7.4", "node-cron": "^3.0.0", "helmet": "^8.2.0", "cors": "^2.8.5", "express-rate-limit": "^6.11.2", "joi": "^17.4.0", "bcrypt": "^5.0.1", "morgan": "^1.10.1", "firebase-admin": "^9.7.0", "aws-sdk": "^2.1466.0", "@aws-sdk/client-s3": "^3.496.0", "twilio": "^3.62.0", "nodemailer": "^6.6.0", "@sendgrid/mail": "^7.4.2", "husky": "^9.0.11"}
- version risk: mongoose 5.x (EOL; 8.x current); express 4.x (5.x current); axios 0.x (1.x current; 0.21 has CVEs); jsonwebtoken <9 (CVE-2022-23529 family); engines.node = >=12.x (EOL Node)
- declared but never imported (15): @aws-sdk/client-s3, cli, fcm-node, morgan, msg91, multer-s3, nodemailer, nodemon, pug, remove, socket.io, socket.io-client, twilio, xml2js, xml2json
- imported but not declared: fromInventory, uuid
- env vars referenced: 91 · in .env.example: 91 · referenced but missing from example: none
- CI/deploy files: .github/workflows/node.js.yml, .github/workflows/security.yml

## Tests
- test deps: none · test files: 0 · test lines: 0 · scripts.test: none

## API surface
- route handlers found: 425 · with no middleware before the handler: 419 · Next pages/routes: 0 · Next api routes: 0
- middleware frequency: admin 4, isSuperAdmin 4, upload.array 1, pingRateLimiter 1
- unguarded sample: GET /get/products/:id (routes/POS/pos-routes.js:5); POST /prepare/cart (routes/POS/pos-routes.js:6); POST /submit/cart (routes/POS/pos-routes.js:7); GET /order/purchased/list (routes/POS/pos-routes.js:8); GET /order/return/list (routes/POS/pos-routes.js:9); POST /create/order (routes/POS/pos-routes.js:10); POST /update/order/:id (routes/POS/pos-routes.js:11); POST /return/order (routes/POS/pos-routes.js:12); POST /login (routes/admin/admin-user-routes.js:8); POST /forgot (routes/admin/admin-user-routes.js:9); POST /reset (routes/admin/admin-user-routes.js:10); GET /get (routes/admin/admin-user-routes.js:13); GET /:id (routes/admin/admin-user-routes.js:14); GET /roles/permission (routes/admin/admin-user-routes.js:15); GET /user/rules (routes/admin/admin-user-routes.js:16)

## Data model
- models: 55 (ActiveCart, ActivityLog, Admin, Approvals, Authors, Banners, Blog, BranchSetting, Brand, Cannabinoid, CannabinoidBanners, CartRules, Category, Employee, ErrorLog, Faq, FhlScript, HempBlogs, HempProducts, Inventory, Legal, Log, MainBrand, MainCannabinoid, MainProductTraits, MainStrain, Member, MemberWalletReasons, Miscellaneous, NotificationData, Order, OrderManager, OrderTracker, PaymentSetting, ProductBatch, ProductRules, Promotion, RefundReasons, Region, ResetRequest, Retailer, RetailerProducts, RetailerUser, RoleAndPermissions, Store, StoreCoordinates, StoreUser, Strain, SubProductTraits, Tax, TaxSettings, Terpenoids, UserRolesPermissions, VersionSync, WebCategory)
- money field types in models/: {'Number': 17, 'String': 15}
  - HempBlogs (models/HempBlogs.js): fields 28, indexes 5, timestamps False, enums: "draft", "published"
  - MainProductTraits (models/MainProductTraits.js): fields 35, indexes 0, timestamps False, enums: 'Active', 'Inactive' | 'image', 'video' | 'image', 'video'
  - PaymentSetting (models/PaymentSetting.js): fields 8, indexes 1, timestamps False, enums: 'test', 'live'
  - Retailer (models/Retailer.js): fields 25, indexes 3, timestamps False, enums: 'Paid', 'Unpaid'
  - StoreCoordinates (models/StoreCoordinates.js): fields 6, indexes 1, timestamps False, enums: 'Polygon'
  - SubProductTraits (models/SubProductTraits.js): fields 34, indexes 0, timestamps False, enums: 'Active', 'Inactive'

## secrets
- **private_key_block**: 1 hits in 1 files — top: staticDB/fcmtoken.json (1) — e.g. staticDB/fcmtoken.json:5

## security
- **child_process**: 58 hits in 21 files — top: controllers/admin/dashboard-controllers.js (10), controllers/member/member-controllers.js (7), controllers/product/product-controllers.js (5) — e.g. common/utils.js:893, common/utils.js:894, common/utils.js:895, common/utils.js:1619
- **unfiltered_find**: 35 hits in 24 files — top: controllers/cannabinoids/cannabinoids-controllers.js (3), controllers/product/product-controllers.js (3), controllers/sitemap-controllers.js (3) — e.g. common/utils.js:1183, controllers/POS/pos-controllers.js:84, controllers/admin/admin-user-controller.js:471, controllers/admin/banner-controllers.js:36
- **mass_assign_update**: 11 hits in 8 files — top: controllers/POS/pos-controllers.js (4), controllers/admin/admin-user-controller.js (1), controllers/admin/retailer-product-controllers.js (1) — e.g. controllers/POS/pos-controllers.js:1520, controllers/POS/pos-controllers.js:1533, controllers/POS/pos-controllers.js:1559, controllers/POS/pos-controllers.js:1582
- **req_query_in_regex**: 9 hits in 7 files — top: controllers/admin/cart-rules-controllers.js (2), controllers/admin/product-rules-controllers.js (2), controllers/admin/dashboard-controllers.js (1) — e.g. controllers/admin/cart-rules-controllers.js:92, controllers/admin/cart-rules-controllers.js:96, controllers/admin/dashboard-controllers.js:1981, controllers/admin/product-rules-controllers.js:99
- **sql_concat**: 7 hits in 5 files — top: controllers/admin/cart-rules-controllers.js (2), controllers/admin/product-rules-controllers.js (2), controllers/admin/admin-user-controller.js (1) — e.g. controllers/admin/admin-user-controller.js:221, controllers/admin/cart-rules-controllers.js:92, controllers/admin/cart-rules-controllers.js:96, controllers/admin/product-rules-controllers.js:99
- **jwt_no_expiry_hint**: 5 hits in 5 files — top: models/Admin.js (1), models/BlazeUser.js (1), models/Retailer.js (1) — e.g. models/Admin.js:22, models/BlazeUser.js:17, models/Retailer.js:48, models/RetailerUser.js:34
- **cors_wildcard**: 1 hits in 1 files — top: startup/middleware.js (1) — e.g. startup/middleware.js:55

## hardcoded
- **role_string**: 34 hits in 15 files — top: controllers/product/brand-controllers.js (4), controllers/strain/strain-controller.js (4), controllers/admin/category-controllers.js (3) — e.g. controllers/admin/authors-controllers.js:105, controllers/admin/authors-controllers.js:132, controllers/admin/category-controllers.js:274, controllers/admin/category-controllers.js:475
- **http_url**: 25 hits in 9 files — top: emailTemplates/storeCreateTemplate.js (5), emailTemplates/storeForgotEmailTemplate.js (5), startup/middleware.js (4) — e.g. common/utils.js:628, controllers/admin/authors-controllers.js:414, controllers/admin/authors-controllers.js:433, controllers/cart/cart-controllers.js:1806
- **mongo_uri**: 4 hits in 1 files — top: controllers/common-controllers.js (4) — e.g. controllers/common-controllers.js:1232, controllers/common-controllers.js:1232, controllers/common-controllers.js:1260, controllers/common-controllers.js:1260
- **phone_literal**: 4 hits in 2 files — top: controllers/textVolt/textVolt-controllers.js (3), common/utils.js (1) — e.g. common/utils.js:737, controllers/textVolt/textVolt-controllers.js:19, controllers/textVolt/textVolt-controllers.js:67, controllers/textVolt/textVolt-controllers.js:100
- **localhost**: 1 hits in 1 files — top: controllers/cart/cart-controllers.js (1) — e.g. controllers/cart/cart-controllers.js:1806
- **ip_literal**: 1 hits in 1 files — top: controllers/cart/cart-controllers.js (1) — e.g. controllers/cart/cart-controllers.js:1806
- **email_literal**: 1 hits in 1 files — top: controllers/order/order-controllers.js (1) — e.g. controllers/order/order-controllers.js:1459

## performance
- **find_without_limit**: 191 hits in 39 files — top: controllers/product/product-controllers.js (24), common/utils.js (17), controllers/order/order-controllers.js (17) — e.g. common/utils.js:339, common/utils.js:342, common/utils.js:359, common/utils.js:477
- **aggregate_calls**: 61 hits in 15 files — top: controllers/admin/dashboard-controllers.js (12), controllers/product/product-controllers.js (11), controllers/order/order-controllers.js (8) — e.g. common/utils.js:893, common/utils.js:894, common/utils.js:895, controllers/POS/pos-controllers.js:842
- **await_in_loop_hint**: 12 hits in 8 files — top: controllers/admin/product-traits-controllers.js (3), controllers/POS/pos-controllers.js (2), controllers/cart/cart-controllers.js (2) — e.g. common/utils.js:1057, controllers/POS/pos-controllers.js:1366, controllers/POS/pos-controllers.js:1505, controllers/admin/inventory-controllers.js:96
- **sync_fs**: 2 hits in 1 files — top: controllers/common-controllers.js (2) — e.g. controllers/common-controllers.js:957, controllers/common-controllers.js:1016
- **settimeout_in_handler**: 1 hits in 1 files — top: common/utils.js (1) — e.g. common/utils.js:392

## quality
- **commented_code_hint**: 189 hits in 21 files — top: controllers/admin/authors-controllers.js (45), controllers/admin/hemp-blogs-controller.js (36), controllers/common-controllers.js (28) — e.g. common/utils.js:1282, controllers/POS/pos-controllers.js:197, controllers/POS/pos-controllers.js:234, controllers/POS/pos-controllers.js:655
- **console_log**: 128 hits in 35 files — top: controllers/cart/cart-controllers.js (19), controllers/POS/pos-controllers.js (13), controllers/admin/retailer-product-controllers.js (11) — e.g. common/commonSendMail.js:23, common/emailService.js:23, common/fcmNotifications.js:20, common/fcmNotifications.js:23
- **empty_catch**: 26 hits in 9 files — top: common/utils.js (6), controllers/admin/retailer-product-controllers.js (6), controllers/order/order-controllers.js (6) — e.g. common/utils.js:1468, common/utils.js:1777, common/utils.js:1821, common/utils.js:1943
- **todo_fixme**: 4 hits in 2 files — top: emailTemplates/adminUserTemplate.js (2), emailTemplates/storeCreateTemplate.js (2) — e.g. emailTemplates/adminUserTemplate.js:18, emailTemplates/adminUserTemplate.js:18, emailTemplates/storeCreateTemplate.js:18, emailTemplates/storeCreateTemplate.js:18

## Byte-identical files inside this repo (>=30 lines)
- common/commonSendMail.js == common/emailService.js

## Docs in repo
- README.md, SECURITY_AUDIT.md
