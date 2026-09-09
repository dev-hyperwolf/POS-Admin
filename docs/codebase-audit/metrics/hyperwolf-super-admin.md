# hyperwolf-super-admin @ c1d9cbd — mechanical metrics
Scanned 2026-09-09T10:04:47 by tools/hw_audit_metrics.py. Numbers are counts of regex matches over tracked source at HEAD; they are leads for the reviewer, not verdicts.

## Size
- files tracked: 1312 · source files: 1203 · source lines: 296,940
- by extension: .js 626, .jsx 577, .svg 51, .png 22, .json 7, .md 5, .scss 5, .jpg 4, .yml 3, (none) 3, .gif 2, .yaml 2
- biggest source files: src/utilities/common/Cities.js (19163); src/components/landingPage/createLanding/sections/category-section.jsx (9879); src/components/homePage/createHome/sections/category-section.jsx (9862); src/layouts/promo/data.js (4504); src/components/homePage/viewHome/index.jsx (4323); src/components/landingPage/viewLanding/index.jsx (4142); src/utilities/common/index.js (3750); src/routes.js (3735)

## Runtime and dependencies
- engines: None · lockfile: NONE · deps 111 / dev 17 · pinning: {'caret': 106, 'exact': 20}
- frameworks: {"react": "18.2.0", "axios": "^1.9.0", "yup": "1.1.1", "redux": "^5.0.0", "@reduxjs/toolkit": "^2.6.0", "jest": "^27.4.3", "eslint": "^8.57.1", "prettier": "2.8.8", "husky": "^8.0.3"}
- version risk: react 18.2.0; no engines.node
- declared but never imported (40): @babel/core, @emotion/cache, @emotion/styled, @mapbox/togeojson, @sentry/browser, @svgr/webpack, ag-grid-community, babel-loader, babel-plugin-named-asset-import, babel-preset-react-app, css-loader, date-fns-tz, daterangepicker, eslint-config-react-app, file-loader, identity-obj-proxy, jest-resolve, jest-watch-typeahead, jszip, msal, openai, os-browserify, postcss, postcss-flexbugs-fixes, postcss-loader, postcss-normalize, postcss-preset-env, react-app-polyfill, react-date-range, react-refresh
- imported but not declared: ,
                    value: , @here/maps-api-for-javascript, @mui/system, App, HOC, Rtk, assets, axiosClient, common, components, context, contexts, date-fns, examples, firebaseInit, hemp, hooks, jquery, layouts, lodash, prompt, quill, react-router, react-window, routes, services, sideMenus, socket, utilities, validations
- env vars referenced: 56 · in .env.example: 30 · referenced but missing from example: BABEL_ENV, BUILD_PATH, CI, DANGEROUSLY_DISABLE_HOST_CHECK, DISABLE_ESLINT_PLUGIN, DISABLE_NEW_JSX_TRANSFORM, ESLINT_NO_DEV_ERRORS, FAST_REFRESH, GENERATE_SOURCEMAP, HOST, HTTPS, IMAGE_INLINE_SIZE_LIMIT, INLINE_RUNTIME_CHUNK, NODE_ENV, NODE_PATH, PORT, PUBLIC_URL, REACT_APP_AMZAON_S3_URL, REACT_APP_GOOGLE_PLACES_KEY, REACT_APP_HEMP_API_DEV_BASE_URL, REACT_APP_PUBLIC_REDIRECT_URL, REACT_APP_X_AUTH_TOKEN, REACT_APP__HYPERWOLF_PUBLIC_BASE_URL, TSC_COMPILE_ON_ERROR, WDS_SOCKET_HOST, WDS_SOCKET_PATH, WDS_SOCKET_PORT
- CI/deploy files: .github/workflows/linting.yml, .github/workflows/security.yml, .github/workflows/stage.yml

## Tests
- test deps: ['jest'] · test files: 0 · test lines: 0 · scripts.test: node scripts/test.js

## API surface
- route handlers found: 0 · with no middleware before the handler: 0 · Next pages/routes: 0 · Next api routes: 0
- middleware frequency: 

## Data model
- models: 0 ()
- money field types in models/: none matched

## secrets
- none matched

## security
- **dangerously_set_html**: 134 hits in 27 files — top: src/components/legalPages/DetailsPages/LabTestingStandardsDetail.js (10), src/components/legalPages/DetailsPages/SameDayDeliveryPageDetail.js (9), src/components/legalPages/DetailsPages/CareerDetail.js (7) — e.g. src/components/homePage/viewHome/index.jsx:871, src/components/homePage/viewHome/index.jsx:3552, src/components/homePage/viewHome/index.jsx:3769, src/components/homePage/viewHome/index.jsx:4253
- **child_process**: 10 hits in 5 files — top: scripts/test.js (3), src/components/cannabinoids/AddCannabinoidBannerForm.jsx (2), src/components/homepageBanner/index.jsx (2) — e.g. scripts/test.js:19, scripts/test.js:24, scripts/test.js:33, src/components/cannabinoids/AddCannabinoidBannerForm.jsx:77
- **weak_hash**: 1 hits in 1 files — top: config/webpack/persistentCache/createEnvironmentHash.js (1) — e.g. config/webpack/persistentCache/createEnvironmentHash.js:5

## hardcoded
- **objectid_24hex**: 399 hits in 6 files — top: src/utilities/common/index.js (392), src/components/hyperdrive/settings/BufferRules/index.js (3), src/common/CommonModal/Hyperwolf/freezeDistribution.jsx (1) — e.g. src/common/CommonModal/Hyperwolf/freezeDistribution.jsx:37, src/components/hyperdrive/settings/BufferRules/index.js:18, src/components/hyperdrive/settings/BufferRules/index.js:23, src/components/hyperdrive/settings/BufferRules/index.js:28
- **http_url**: 121 hits in 54 files — top: src/components/homePage/viewHome/index.jsx (10), src/utilities/common/index.js (7), src/components/brand/addBrandForm.jsx (5) — e.g. config/env.js:47, config/jest/cssTransform.js:4, config/jest/fileTransform.js:7, config/webpack.config.js:314
- **role_string**: 104 hits in 72 files — top: src/layouts/manageCategories/index.jsx (4), src/layouts/orders/index.jsx (4), src/App.js (3) — e.g. src/App.js:105, src/App.js:109, src/App.js:112, src/Rtk/slices/user/userSlice.js:5
- **email_literal**: 17 hits in 2 files — top: src/utilities/common/index.js (14), src/layouts/billing/components/BillingInformation/index.js (3) — e.g. src/layouts/billing/components/BillingInformation/index.js:26, src/layouts/billing/components/BillingInformation/index.js:32, src/layouts/billing/components/BillingInformation/index.js:38, src/utilities/common/index.js:2215
- **phone_literal**: 13 hits in 3 files — top: src/utilities/common/index.js (11), src/App.js (1), src/components/hyperdrive/createTask/DropOffTask.jsx (1) — e.g. src/App.js:335, src/components/hyperdrive/createTask/DropOffTask.jsx:323, src/utilities/common/index.js:2323, src/utilities/common/index.js:2354
- **store_name_literal**: 7 hits in 1 files — top: src/utilities/common/Cities.js (7) — e.g. src/utilities/common/Cities.js:1380, src/utilities/common/Cities.js:3641, src/utilities/common/Cities.js:8911, src/utilities/common/Cities.js:10318
- **localhost**: 2 hits in 1 files — top: config/webpackDevServer.config.js (2) — e.g. config/webpackDevServer.config.js:36, config/webpackDevServer.config.js:36
- **ip_literal**: 2 hits in 2 files — top: config/webpackDevServer.config.js (1), scripts/start.js (1) — e.g. config/webpackDevServer.config.js:11, scripts/start.js:48

## performance
- **find_without_limit**: 298 hits in 103 files — top: src/components/homePage/createHome/sections/category-section.jsx (34), src/components/landingPage/createLanding/sections/category-section.jsx (34), src/layouts/promo/IfRuleView.jsx (15) — e.g. src/App.js:219, src/HOC/PublicRoute.jsx:50, src/HOC/PublicRoute.jsx:54, src/common/CommonDrawer/hyperwolf/discrepancyDetails.jsx:211
- **settimeout_in_handler**: 72 hits in 50 files — top: src/components/homePage/createHome/index.jsx (5), src/components/landingPage/createLanding/index.jsx (5), src/layouts/promo/AddPromotions.jsx (4) — e.g. src/common/CommonModal/AddNewStrainModal.jsx:56, src/common/CommonModal/FetchDriveMessage.jsx:11, src/common/CommonModal/FetchDriveMessageConfirm.jsx:13, src/common/component/Hyperwolf/InfiniteScrollListBlog.jsx:102
- **sync_fs**: 16 hits in 9 files — top: config/webpack.config.js (4), config/getHttpsConfig.js (2), config/modules.js (2) — e.g. config/env.js:34, config/getHttpsConfig.js:36, config/getHttpsConfig.js:43, config/modules.js:96

## quality
- **commented_code_hint**: 1000 hits in 184 files — top: src/layouts/promo/data.js (54), src/components/landingPage/viewLanding/index.jsx (38), src/common/CommonModal/orders/ReturnReason.jsx (34) — e.g. config/env.js:29, config/modules.js:116, config/webpack.config.js:298, config/webpack.config.js:308
- **empty_catch**: 51 hits in 43 files — top: src/components/hyperwolf/products/productTraits/SelectProductTrait.jsx (4), src/components/products/productTraits/selectProductTrait.jsx (4), src/components/distributionSetting/distributionManagement/components/productsListing.jsx (2) — e.g. src/common/CommonModal/Hyperwolf/AddDiscrepancyNote backup.jsx:67, src/common/CommonModal/Hyperwolf/AddDiscrepancyNote.jsx:67, src/common/CommonModal/Hyperwolf/AddNewStrainModal.jsx:23, src/common/CommonModal/UploadIdImageModal.jsx:40
- **console_log**: 30 hits in 7 files — top: scripts/build.js (12), scripts/start.js (7), public/firebase-messaging-sw.js (4) — e.g. firebase-messaging-sw.js:4, firebase-messaging-sw.js:7, public/firebase-messaging-sw.js:23, public/firebase-messaging-sw.js:25
- **ts_ignore**: 18 hits in 15 files — top: public/firebase-messaging-sw.js (3), src/components/products/ProductSelect.jsx (2), scripts/build.js (1) — e.g. public/firebase-messaging-sw.js:18, public/firebase-messaging-sw.js:21, public/firebase-messaging-sw.js:35, scripts/build.js:82
- **todo_fixme**: 4 hits in 4 files — top: config/webpack.config.js (1), src/components/CardSetting/OrderSetting.js (1), src/components/hyperdrive/mapDriverList.js (1) — e.g. config/webpack.config.js:354, src/components/CardSetting/OrderSetting.js:80, src/components/hyperdrive/mapDriverList.js:184, src/layouts/hyperwolf/HyperdriveTestingPanel.js/WebFlow.js:539

## Byte-identical files inside this repo (>=30 lines)
- src/layouts/hyperwolf/userAndRoles/components/roles.jsx == src/layouts/hyperwolf/userAndRoles/components/users.jsx

## Docs in repo
- README-roles-permissions-V2.md, README-roles-permissions.md, README.md, src/layouts/hyperwolf/BannerManagement/Holidays/HOLIDAY_README.md, src/layouts/promo/PromoSummary.md
