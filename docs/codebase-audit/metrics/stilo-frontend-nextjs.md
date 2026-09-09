# stilo-frontend-nextjs @ 23f5e62 — mechanical metrics
Scanned 2026-09-09T10:04:50 by tools/hw_audit_metrics.py. Numbers are counts of regex matches over tracked source at HEAD; they are leads for the reviewer, not verdicts.

## Size
- files tracked: 394 · source files: 292 · source lines: 25,163
- by extension: .jsx 240, .js 47, .json 27, .jpg 21, .woff 10, .png 10, .woff2 8, .webp 8, .md 5, .mjs 4, .svg 4, .yml 2
- biggest source files: app/(main)/shop/components/productDetails.jsx (1322); app/(headerLess)/checkout/(_components)/checkout-view.jsx (1282); app/(_components)/authComponents/signup.jsx (893); app/(headerLess)/checkout/page.jsx (798); app/(_components)/drawers/cartDrawer.jsx (611); app/(_components)/formComponents/customInput.jsx (610); app/(_components)/drawers/mobileFilterDrawer.jsx (470); app/(_components)/search/globalSearch.jsx (447)

## Runtime and dependencies
- engines: {'node': '>=18 || <=20', 'npm': '>=10 || <=11'} · lockfile: NONE · deps 39 / dev 7 · pinning: {'caret': 44, 'exact': 2}
- frameworks: {"next": "^15.1.9", "react": "^19.2.4", "axios": "^1.7.9", "yup": "^1.6.1", "@reduxjs/toolkit": "^2.8.1", "eslint": "^9"}
- declared but never imported (4): critters, node-sass, persona, react-dom
- imported but not declared: @/app, @/axios, @/components, @/hooks, @/lib, @/public, @/redux, @/server, @/services, @/validations, console
- env vars referenced: 14 · in .env.example: 13 · referenced but missing from example: NEXT_PUBLIC_SITE_URL, NODE_ENV
- CI/deploy files: .github/workflows/aiCodeReviewer.yml, .github/workflows/dev.yml

## Tests
- test deps: none · test files: 0 · test lines: 0 · scripts.test: none

## API surface
- route handlers found: 0 · with no middleware before the handler: 0 · Next pages/routes: 30 · Next api routes: 0
- middleware frequency: 

## Data model
- models: 0 ()
- money field types in models/: none matched

## secrets
- none matched

## security
- **dangerously_set_html**: 65 hits in 21 files — top: app/(main)/shop/components/productDetails.jsx (13), app/(main)/blog/[slug]/page.jsx (7), app/(main)/[slug]/(components)/Carrier.jsx (5) — e.g. app/(_components)/Faq.jsx:13, app/(_components)/Faq.jsx:31, app/(_components)/Faq.jsx:36, app/(_components)/search/globalSearch.jsx:192

## hardcoded
- **http_url**: 44 hits in 20 files — top: lib/constants.js (11), app/layout.js (8), app/(_components)/Reviews.jsx (4) — e.g. app/(_components)/Reviews.jsx:10, app/(_components)/Reviews.jsx:11, app/(_components)/Reviews.jsx:144, app/(_components)/Reviews.jsx:148
- **email_literal**: 3 hits in 2 files — top: app/(_components)/authComponents/signup.jsx (2), lib/constants.js (1) — e.g. app/(_components)/authComponents/signup.jsx:34, app/(_components)/authComponents/signup.jsx:55, lib/constants.js:15
- **objectid_24hex**: 2 hits in 1 files — top: app/(_components)/authComponents/signup.jsx (2) — e.g. app/(_components)/authComponents/signup.jsx:53, app/(_components)/authComponents/signup.jsx:103
- **phone_literal**: 1 hits in 1 files — top: app/(_components)/authComponents/signup.jsx (1) — e.g. app/(_components)/authComponents/signup.jsx:115

## performance
- **find_without_limit**: 17 hits in 10 files — top: app/(headerLess)/checkout/page.jsx (5), app/(_components)/drawers/cartDrawer.jsx (4), app/(_components)/authComponents/medicalVerification.jsx (1) — e.g. app/(_components)/authComponents/medicalVerification.jsx:54, app/(_components)/common/categoryFilter.jsx:154, app/(_components)/drawers/brandPageFilters.jsx:84, app/(_components)/drawers/cartDrawer.jsx:125
- **settimeout_in_handler**: 7 hits in 7 files — top: app/(_components)/Reviews.jsx (1), app/(_components)/common/copyToClipboard.jsx (1), app/(_components)/search/globalSearch.jsx (1) — e.g. app/(_components)/Reviews.jsx:106, app/(_components)/common/copyToClipboard.jsx:23, app/(_components)/search/globalSearch.jsx:394, app/(headerLess)/checkout/page.jsx:517

## quality
- **commented_code_hint**: 82 hits in 20 files — top: app/(_components)/authComponents/signup.jsx (19), axios/axiosSetup.jsx (12), app/(headerLess)/checkout/page.jsx (11) — e.g. app/(_components)/authComponents/signup.jsx:205, app/(_components)/authComponents/signup.jsx:287, app/(_components)/authComponents/signup.jsx:289, app/(_components)/authComponents/signup.jsx:292
- **console_log**: 10 hits in 7 files — top: lib/utils.js (3), app/(headerLess)/checkout/page.jsx (2), app/(_components)/SidebarFilters.jsx (1) — e.g. app/(_components)/SidebarFilters.jsx:29, app/(_components)/common/DiditModal.jsx:40, app/(_components)/drawers/addressDrawer.jsx:122, app/(headerLess)/checkout/page.jsx:468
- **empty_catch**: 10 hits in 10 files — top: app/(_components)/authComponents/signup.jsx (1), app/(_components)/common/DiditModal.jsx (1), app/(main)/blog/[slug]/page.jsx (1) — e.g. app/(_components)/authComponents/signup.jsx:216, app/(_components)/common/DiditModal.jsx:23, app/(main)/blog/[slug]/page.jsx:102, app/(main)/blog/category/[slug]/page.jsx:30
- **ts_ignore**: 1 hits in 1 files — top: app/(main)/author/components/authorBlogsList.jsx (1) — e.g. app/(main)/author/components/authorBlogsList.jsx:41

## Docs in repo
- CLAUDE.md, README.md, docs/architecture.md, docs/components.md, docs/development-guidelines.md
