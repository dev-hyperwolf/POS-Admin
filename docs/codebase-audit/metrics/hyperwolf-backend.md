# hyperwolf-backend @ cd74550 — mechanical metrics
Scanned 2026-09-09T10:04:41 by tools/hw_audit_metrics.py. Numbers are counts of regex matches over tracked source at HEAD; they are leads for the reviewer, not verdicts.

## Size
- files tracked: 294 · source files: 207 · source lines: 34,681
- by extension: .js 207, .png 37, .json 16, (none) 8, .txt 5, .kml 5, .svg 3, .yml 2, .md 2, .jpg 2, .jpeg 2, .gif 2
- biggest source files: controllers/blaze/product-controllers.js (4851); controllers/common-controllers.js (2016); common/utils.js (1739); controllers/admin/shop-time-controllers.js (1621); controllers/blaze/integration/blaze-integration-controllers.js (1617); controllers/admin/product-carousel-controllers.js (1565); controllers/blaze/user-cart-controllers.js (1259); controllers/admin/category-controllers.js (1189)

## Runtime and dependencies
- engines: {'node': '12.x'} · lockfile: NONE · deps 48 / dev 0 · pinning: {'caret': 46, 'exact': 2}
- frameworks: {"express": "^4.17.1", "mongoose": "^5.11.15", "jsonwebtoken": "^8.5.1", "axios": "^0.21.1", "node-cron": "^3.0.0", "cors": "^2.8.5", "express-rate-limit": "^6.3.0", "joi": "^17.4.0", "bcrypt": "^5.0.1", "newrelic": "^9.0.0", "firebase-admin": "^12.5.0", "aws-sdk": "^2.1466.0", "twilio": "^3.62.0", "nodemailer": "^6.6.0", "@sendgrid/mail": "^7.4.2"}
- version risk: mongoose 5.x (EOL; 8.x current); express 4.x (5.x current); axios 0.x (1.x current; 0.21 has CVEs); jsonwebtoken <9 (CVE-2022-23529 family); engines.node = 12.x (EOL Node)
- declared but never imported (9): bcrypt, express-rate-limit, fcm-node, msg91, nodemailer, nodemon, pug, remove, twilio
- imported but not declared: products, uuid
- env vars referenced: 133 · in .env.example: 119 · referenced but missing from example: CLIENT_ID_FOR_GET_OTP_FHL, FHL_ASSOCIATE_CLIENTID, FHL_ASSOCIATE_SECRET_KEY, FHL_ASSOCIATE_URL, FHL_CHECK_CUSTOMER, FHL_CUSTOMER_URL, FHL_OTP_URL, FHL_URL_FOR_GET_OTP, FHL_URL_FOR_VALIDATE_OTP, FOOTER_COLOR, PROJECT_NAME, PROJECT_THEME_COLOR, REASSIGN_ASSOCIATE_URL, TOKEN_FOR_GET_OTP_FHL
- CI/deploy files: .github/workflows/node.js.yml, .github/workflows/stage.yml

## Tests
- test deps: none · test files: 2 · test lines: 105 · scripts.test: none

## API surface
- route handlers found: 421 · with no middleware before the handler: 419 · Next pages/routes: 0 · Next api routes: 0
- middleware frequency: validateCarouselPayload 2
- unguarded sample: POST / (routes/admin/banner-routes.js:5); GET / (routes/admin/banner-routes.js:6); GET /web (routes/admin/banner-routes.js:7); PUT /:id (routes/admin/banner-routes.js:8); DELETE /:id (routes/admin/banner-routes.js:9); POST / (routes/admin/brand-routes.js:5); GET / (routes/admin/brand-routes.js:6); GET /:id (routes/admin/brand-routes.js:7); DELETE /:id (routes/admin/brand-routes.js:8); PUT /:id (routes/admin/brand-routes.js:9); GET /sync/blaze (routes/admin/brand-routes.js:10); GET /sync/brand/image (routes/admin/brand-routes.js:11); GET /web/seo/:id (routes/admin/brand-routes.js:13); GET /sync/wp (routes/admin/brand-routes.js:14); POST / (routes/admin/category-routes.js:8)

## Data model
- models: 60 (ActiveCart, ActivityLogs, Admin, Announcements, ApprovalNotifications, Authors, BRBGraphics, Banners, BlazeUser, Brand, Break, CanPayUsers, Cannabinoid, CannabinoidBanners, Category, Distributor, Driver, Employee, ErrorLog, FailureReason, FhlScript, Fleets, HempProducts, HolidayManagement, HyperDriveNotification, HyperwolfBlogs, LedgerGreen, Legal, Log, MainBrand, MainCannabinoid, MainProductTraits, MainStrain, Miscellaneous, Order, OrderManager, OrderTracker, Product, ProductCarousel, Promotion, Regions, ResetRequest, ShopTime, SlotsCoordinates, StartTask, StoreProducts, Strain, SubProductTraits, Tasks, TerminalProducts, TimeSlot, TransportationTypes, Truck, User, VersionSync, WebCategory, fleetAccessTokens, fleetDevices, onDutyChecklists)
- money field types in models/: {'Number': 6, 'String': 2}
  - BRBGraphics (models/BRBGraphics.js): fields 17, indexes 0, timestamps False, enums: "image", "video"
  - fleetAccessTokens (models/FleetAccessTokens.js): fields 6, indexes 2, timestamps False, enums: true, false
  - fleetDevices (models/FleetDevices.js): fields 8, indexes 2, timestamps False, enums: true, false
  - Fleets (models/Fleets.js): fields 30, indexes 5, timestamps False, enums: 'pending', 'verified'
  - HolidayManagement (models/HolidayManagement.js): fields 17, indexes 0, timestamps False, enums: "image", "video"
  - HyperwolfBlogs (models/HyperwolfBlogs.js): fields 28, indexes 5, timestamps False, enums: "draft", "published"
  - MainProductTraits (models/MainProductTraits.js): fields 35, indexes 2, timestamps False, enums: 'Active', 'Inactive' | 'image', 'video' | 'image', 'video'
  - ProductCarousel (models/ProductCarousel.js): fields 15, indexes 6, timestamps False, enums: "Hyperwolf", "Hemp", "Stilo", "Other" | "active", "inactive"
  - ShopTime (models/ShopTime.js): fields 12, indexes 0, timestamps False, enums:          "Monday",         "Tuesday",         "Wednesday",         "Thursday",         "Friday",         "Saturday",         "Sunday",       
  - SlotsCoordinates (models/SlotsCoordinates.js): fields 5, indexes 1, timestamps False, enums: 'Polygon'
  - SubProductTraits (models/SubProductTraits.js): fields 34, indexes 0, timestamps False, enums: 'Active', 'Inactive'
  - TimeSlot (models/TimeSlot.js): fields 10, indexes 0, timestamps False, enums:          "Monday",         "Tuesday",         "Wednesday",         "Thursday",         "Friday",         "Saturday",         "Sunday",       
  - Truck (models/Trucks.js): fields 14, indexes 0, timestamps False, enums: 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'

## secrets
- **assigned_secret**: 4 hits in 1 files — top: test/admin-security.test.js (4) — e.g. test/admin-security.test.js:13, test/admin-security.test.js:57, test/admin-security.test.js:59, test/admin-security.test.js:71
- **private_key_block**: 1 hits in 1 files — top: hyperdrive-firebase-adminsdk.json (1) — e.g. hyperdrive-firebase-adminsdk.json:5
- **google_api_key**: 1 hits in 1 files — top: controllers/google-controllers.js (1) — e.g. controllers/google-controllers.js:23

## security
- **unfiltered_find**: 48 hits in 19 files — top: controllers/blaze/product-controllers.js (14), controllers/cannabinoids/cannabinoids-controllers.js (4), controllers/admin/truck-controllers.js (3) — e.g. controllers/admin/banner-controllers.js:37, controllers/admin/banner-controllers.js:83, controllers/admin/brand-controllers.js:183, controllers/admin/brand-controllers.js:429
- **child_process**: 25 hits in 16 files — top: controllers/strain/strain-controller.js (5), controllers/fleets/fleet-controller.js (3), controllers/breaks/break-controller.js (2) — e.g. controllers/admin/banner-controllers.js:37, controllers/admin/shop-time-controllers.js:1031, controllers/announcements/announcements-controller.js:28, controllers/breaks/break-controller.js:183
- **req_query_in_regex**: 5 hits in 4 files — top: controllers/admin/shop-time-controllers.js (2), controllers/cannabinoids/cannabinoids-controllers.js (1), controllers/cart-controllers.js (1) — e.g. controllers/admin/shop-time-controllers.js:1021, controllers/admin/shop-time-controllers.js:1538, controllers/cannabinoids/cannabinoids-controllers.js:74, controllers/cart-controllers.js:49
- **mass_assign_update**: 4 hits in 4 files — top: controllers/admin/product-carousel-controllers.js (1), controllers/admin/promotion-controllers.js (1), controllers/blaze/product-controllers.js (1) — e.g. controllers/admin/product-carousel-controllers.js:813, controllers/admin/promotion-controllers.js:33, controllers/blaze/product-controllers.js:4354, controllers/common-controllers.js:1887
- **sql_concat**: 3 hits in 2 files — top: controllers/blaze/integration/blaze-integration-controllers.js (2), controllers/blaze/product-controllers.js (1) — e.g. controllers/blaze/integration/blaze-integration-controllers.js:210, controllers/blaze/integration/blaze-integration-controllers.js:246, controllers/blaze/product-controllers.js:1244
- **jwt_no_expiry_hint**: 2 hits in 2 files — top: models/Admin.js (1), models/BlazeUser.js (1) — e.g. models/Admin.js:17, models/BlazeUser.js:28
- **cors_wildcard**: 1 hits in 1 files — top: startup/middleware.js (1) — e.g. startup/middleware.js:60
- **mass_assign_create**: 1 hits in 1 files — top: controllers/admin/product-carousel-controllers.js (1) — e.g. controllers/admin/product-carousel-controllers.js:55

## hardcoded
- **objectid_24hex**: 49 hits in 8 files — top: controllers/blaze/user-cart-controllers.js (21), controllers/common-controllers.js (12), controllers/blaze/integration/blaze-integration-controllers.js (3) — e.g. common/utils.js:24, common/utils.js:47, controllers/admin/hyperwolf-blog-controllers.js:159, controllers/admin/hyperwolf-blog-controllers.js:226
- **http_url**: 25 hits in 13 files — top: startup/middleware.js (5), common/utils.js (3), controllers/weedmaps/weedmap-controllers.js (3) — e.g. common/utils.js:712, common/utils.js:1701, common/utils.js:1724, controllers/admin/brand-controllers.js:777
- **role_string**: 22 hits in 12 files — top: controllers/admin/category-controllers.js (4), controllers/cannabinoids/cannabinoids-controllers.js (4), controllers/strain/strain-controller.js (3) — e.g. controllers/admin/brand-controllers.js:224, controllers/admin/category-controllers.js:321, controllers/admin/category-controllers.js:536, controllers/admin/category-controllers.js:634
- **email_literal**: 4 hits in 1 files — top: test/admin-security.test.js (4) — e.g. test/admin-security.test.js:9, test/admin-security.test.js:31, test/admin-security.test.js:56, test/admin-security.test.js:63
- **phone_literal**: 4 hits in 2 files — top: controllers/textVolt/textVolt-controllers.js (3), common/utils.js (1) — e.g. common/utils.js:1166, controllers/textVolt/textVolt-controllers.js:20, controllers/textVolt/textVolt-controllers.js:75, controllers/textVolt/textVolt-controllers.js:114
- **store_name_literal**: 1 hits in 1 files — top: common/utils.js (1) — e.g. common/utils.js:834

## performance
- **find_without_limit**: 179 hits in 39 files — top: controllers/blaze/product-controllers.js (46), controllers/common-controllers.js (17), controllers/strain/strain-controller.js (10) — e.g. common/sendPushNotifications.js:42, common/utils.js:371, common/utils.js:374, common/utils.js:408
- **aggregate_calls**: 35 hits in 13 files — top: controllers/admin/product-carousel-controllers.js (10), controllers/admin/category-controllers.js (4), controllers/order-controllers.js (4) — e.g. controllers/admin/brand-controllers.js:203, controllers/admin/category-controllers.js:144, controllers/admin/category-controllers.js:170, controllers/admin/category-controllers.js:473
- **await_in_loop_hint**: 9 hits in 6 files — top: controllers/admin/shop-time-controllers.js (2), controllers/blaze/integration/blaze-integration-controllers.js (2), controllers/common-controllers.js (2) — e.g. controllers/admin/category-controllers.js:226, controllers/admin/shop-time-controllers.js:853, controllers/admin/shop-time-controllers.js:1105, controllers/blaze/integration/blaze-integration-controllers.js:76
- **sync_fs**: 7 hits in 3 files — top: controllers/didit/didit-controllers.js (4), controllers/persona/personaController.js (2), controllers/kml-controllers.js (1) — e.g. controllers/didit/didit-controllers.js:244, controllers/didit/didit-controllers.js:255, controllers/didit/didit-controllers.js:256, controllers/didit/didit-controllers.js:257
- **settimeout_in_handler**: 3 hits in 3 files — top: common/utils.js (1), controllers/alpine/alpine-controllers.js (1), controllers/fleets/fleet-controller.js (1) — e.g. common/utils.js:445, controllers/alpine/alpine-controllers.js:294, controllers/fleets/fleet-controller.js:851
- **populate_calls**: 1 hits in 1 files — top: controllers/breaks/break-controller.js (1) — e.g. controllers/breaks/break-controller.js:134

## quality
- **commented_code_hint**: 233 hits in 24 files — top: controllers/common-controllers.js (42), controllers/admin/shop-time-controllers.js (32), controllers/order-controllers.js (29) — e.g. common/utils.js:1206, common/utils.js:1210, common/utils.js:1211, controllers/admin/brand-controllers.js:452
- **console_log**: 137 hits in 36 files — top: controllers/common-controllers.js (25), controllers/blaze/integration/blaze-integration-controllers.js (22), startup/nodeCrons.js (14) — e.g. awsEvent/iotCore.js:10, awsEvent/iotCore.js:17, awsEvent/iotCore.js:25, awsEvent/iotCore.js:29
- **empty_catch**: 24 hits in 14 files — top: controllers/blaze/integration/blaze-integration-controllers.js (6), controllers/blaze/user-cart-controllers.js (3), common/utils.js (2) — e.g. common/utils.js:1459, common/utils.js:1677, controllers/admin/hyperwolf-blog-controllers.js:438, controllers/admin/hyperwolf-blog-controllers.js:805

## Docs in repo
- README.md, awsEvent/readme.md
