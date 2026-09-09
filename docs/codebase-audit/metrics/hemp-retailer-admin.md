# hemp-retailer-admin @ 1d09f69 — mechanical metrics
Scanned 2026-09-09T10:04:40 by tools/hw_audit_metrics.py. Numbers are counts of regex matches over tracked source at HEAD; they are leads for the reviewer, not verdicts.

## Size
- files tracked: 760 · source files: 640 · source lines: 87,888
- by extension: .js 376, .jsx 264, .svg 48, .png 25, .jpg 17, .jpeg 7, .md 6, .scss 5, .json 4, .yml 3, .example 1, (none) 1
- biggest source files: src/components/POS/OrderDetailsView.jsx (2233); src/layouts/rolesPermissions/addRoles/index.jsx (1379); src/components/orders/AddOrderForm.jsx (1354); src/components/products/AddProduct.jsx (1290); src/utilities/common/index.js (1151); src/layouts/orders/index.jsx (1128); src/layouts/members/memberDetails/index.jsx (1110); src/components/members/addMemberForm.jsx (1077)

## Runtime and dependencies
- engines: None · lockfile: ['package-lock.json'] · deps 60 / dev 17 · pinning: {'caret': 57, 'exact': 20}
- frameworks: {"react": "18.2.0", "react-scripts": "5.0.1", "axios": "^1.6.3", "yup": "1.1.1", "redux": "^5.0.0", "@reduxjs/toolkit": "^2.0.1", "eslint": "^8.55.0", "prettier": "2.8.8", "husky": "^8.0.3"}
- version risk: react 18.2.0; create-react-app (react-scripts; unmaintained since 2023); no engines.node
- declared but never imported (17): @emotion/cache, @emotion/react, @point-of-sale/receipt-printer-encoder, ag-grid-community, mrz, msal, npm, openai, react-barcode, react-qr-code, react-scripts, react-webcam, redux, sass, stylis, tesseract.js, yup
- imported but not declared: @mui/system, @splidejs/react-splide, App, HOC, assets, axiosClient, bluetooth, common, components, context, examples, firebaseInit, hooks, layouts, lodash, prompt, react-router, routes, sideMenus, utilities, validations
- env vars referenced: 15 · in .env.example: 17 · referenced but missing from example: NODE_ENV, REACT_APP_AMZAON_S3_URL, REACT_APP_PUBLIC_BASE_URL
- CI/deploy files: .github/workflows/dev.yml, .github/workflows/security.yml, .github/workflows/stage.yml

## Tests
- test deps: none · test files: 0 · test lines: 0 · scripts.test: react-scripts test

## API surface
- route handlers found: 0 · with no middleware before the handler: 0 · Next pages/routes: 0 · Next api routes: 0
- middleware frequency: 

## Data model
- models: 0 ()
- money field types in models/: none matched

## secrets
- **google_api_key**: 2 hits in 1 files — top: public/firebase-messaging-sw.js (2) — e.g. public/firebase-messaging-sw.js:18, public/firebase-messaging-sw.js:28
- **assigned_secret**: 2 hits in 1 files — top: public/firebase-messaging-sw.js (2) — e.g. public/firebase-messaging-sw.js:18, public/firebase-messaging-sw.js:28
- **private_key_block**: 1 hits in 1 files — top: src/components/settings/PrinterSetup/index_old.jsx (1) — e.g. src/components/settings/PrinterSetup/index_old.jsx:58

## security
- **dangerously_set_html**: 16 hits in 6 files — top: src/layouts/brands/index.jsx (4), src/layouts/strains/index.jsx (4), src/components/products/productDetails/index.jsx (3) — e.g. src/components/products/productDetails/index.jsx:398, src/components/products/productDetails/index.jsx:403, src/components/products/productDetails/index.jsx:409, src/components/products/productDetails/masterDetailView.js:217
- **unfiltered_find**: 5 hits in 2 files — top: src/components/settings/PrinterSetup/index_old.jsx (3), src/utilities/printer/index.js (2) — e.g. src/components/settings/PrinterSetup/index_old.jsx:26, src/components/settings/PrinterSetup/index_old.jsx:36, src/components/settings/PrinterSetup/index_old.jsx:42, src/utilities/printer/index.js:5
- **child_process**: 3 hits in 2 files — top: src/components/homepageBanner/index.jsx (2), src/utilities/common/index.js (1) — e.g. src/components/homepageBanner/index.jsx:73, src/components/homepageBanner/index.jsx:81, src/utilities/common/index.js:975

## hardcoded
- **http_url**: 485 hits in 241 files — top: public/firebase-messaging-sw.js (5), src/examples/Footer/index.js (5), src/layouts/profile/index.js (5) — e.g. public/firebase-messaging-sw.js:1, public/firebase-messaging-sw.js:2, public/firebase-messaging-sw.js:4, public/firebase-messaging-sw.js:5
- **role_string**: 37 hits in 22 files — top: src/common/CommonModal/stores/ScanMemberModal.jsx (5), src/components/promotion/addPromotionForm.jsx (3), src/layouts/manageCategories/index.jsx (3) — e.g. src/App.js:93, src/common/CommonModal/stores/ScanMemberModal.jsx:26, src/common/CommonModal/stores/ScanMemberModal.jsx:192, src/common/CommonModal/stores/ScanMemberModal.jsx:192
- **email_literal**: 10 hits in 3 files — top: src/layouts/tables/data/authorsTableData.js (6), src/layouts/billing/components/BillingInformation/index.js (3), src/layouts/profile/index.js (1) — e.g. src/layouts/billing/components/BillingInformation/index.js:39, src/layouts/billing/components/BillingInformation/index.js:45, src/layouts/billing/components/BillingInformation/index.js:51, src/layouts/profile/index.js:73
- **phone_literal**: 3 hits in 2 files — top: src/utilities/printer/index.js (2), public/firebase-messaging-sw.js (1) — e.g. public/firebase-messaging-sw.js:32, src/utilities/printer/index.js:22, src/utilities/printer/index.js:42
- **objectid_24hex**: 2 hits in 2 files — top: src/layouts/POS/layouts/Purchased/index.jsx (1), src/utilities/constants/index.js (1) — e.g. src/layouts/POS/layouts/Purchased/index.jsx:105, src/utilities/constants/index.js:11
- **localhost**: 1 hits in 1 files — top: src/index.js (1) — e.g. src/index.js:50
- **ip_literal**: 1 hits in 1 files — top: src/common/CommonModal/AddPrinterModal.js (1) — e.g. src/common/CommonModal/AddPrinterModal.js:261

## performance
- **find_without_limit**: 83 hits in 38 files — top: src/components/products/FilterProducts.jsx (10), src/components/orders/AddOrderForm.jsx (9), src/components/MDBox/MDBoxRoot.js (5) — e.g. src/bluetooth/main.js:265, src/bluetooth/main.js:281, src/common/CommonDrawer/AddBatchDrawer.jsx:196, src/common/CommonModal/orders/ReturnOrderModal.jsx:37
- **settimeout_in_handler**: 18 hits in 17 files — top: src/components/POS/OrderDetailsView.jsx (2), src/bluetooth/callback-queue.js (1), src/bluetooth/event-emitter.js (1) — e.g. src/bluetooth/callback-queue.js:32, src/bluetooth/event-emitter.js:15, src/common/component/BarcodeScanArea.jsx:50, src/components/MDAlert/index.js:54

## quality
- **commented_code_hint**: 845 hits in 147 files — top: src/components/POS/OrderDetailsView.jsx (85), src/common/CommonDrawer/AddBatchDrawer.jsx (35), src/components/orders/AddOrderForm.jsx (35) — e.g. public/firebase-messaging-sw.js:1, public/firebase-messaging-sw.js:2, public/firebase-messaging-sw.js:6, public/firebase-messaging-sw.js:26
- **ts_ignore**: 15 hits in 10 files — top: public/firebase-messaging-sw.js (3), src/layouts/dashboard/components/Projects/data/index.js (2), src/layouts/tables/data/authorsTableData.js (2) — e.g. public/firebase-messaging-sw.js:38, public/firebase-messaging-sw.js:42, public/firebase-messaging-sw.js:56, src/components/MDButton/MDButtonRoot.js:1
- **empty_catch**: 11 hits in 7 files — top: src/components/products/productTraits/selectProductTrait.jsx (4), src/components/react-select/PaginationSelct.jsx (2), public/firebase-messaging-sw.js (1) — e.g. public/firebase-messaging-sw.js:62, src/bluetooth/main.js:254, src/common/CommonModal/stores/ScanMemberModal.jsx:28, src/components/masterCatalog/MasterCatalogProductList.jsx:542
- **console_log**: 4 hits in 3 files — top: firebase-messaging-sw.js (2), src/components/tables/PaginationTable.jsx (1), src/firebaseInit.js (1) — e.g. firebase-messaging-sw.js:5, firebase-messaging-sw.js:8, src/components/tables/PaginationTable.jsx:55, src/firebaseInit.js:39

## Byte-identical files inside this repo (>=30 lines)
- src/assets/theme-dark/components/list/listItem.js == src/assets/theme/components/list/listItem.js

## Docs in repo
- CLAUDE.md, PERMISSIONS_REFACTOR.md, README.md, docs/architecture.md, docs/components.md, docs/development-guidelines.md
