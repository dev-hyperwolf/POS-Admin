# hemp-frontend-nextjs @ 755eab4 — mechanical metrics
Scanned 2026-09-09T10:04:39 by tools/hw_audit_metrics.py. Numbers are counts of regex matches over tracked source at HEAD; they are leads for the reviewer, not verdicts.

## Size
- files tracked: 468 · source files: 244 · source lines: 45,869
- by extension: .js 130, .jsx 114, .svg 90, .png 65, .jpg 19, .md 9, .gif 9, .webp 8, .json 5, .scss 5, .woff2 4, (none) 3
- biggest source files: app/components/app/Checkout/SecondStep.js (3063); app/components/app/Auth/Signup.js (1523); app/redux/actions/common.js (1417); app/redux/reducers/common.js (1306); app/redux/reducers/products.js (1292); app/utils.js (1176); app/components/app/Drawer/ShoppingCartSidebar.js (1146); app/components/app/Shop/Types/SubSingleCategoryProducts.js (1082)

## Runtime and dependencies
- engines: {'npm': '>=9.5.0', 'node': '>=18.15.0'} · lockfile: NONE · deps 48 / dev 14 · pinning: {'caret': 55, 'exact': 7}
- frameworks: {"next": "14.0.4", "react": "^18", "axios": "^1.6.7", "redux": "^5.0.0", "@reduxjs/toolkit": "^2.0.1", "eslint": "^8.55.0", "prettier": "2.8.8", "husky": "^8.0.3"}
- version risk: next 14.0.4 (15/16 current); react 18
- declared but never imported (16): @emotion/cache, @emotion/react, @emotion/styled, @sentry/nextjs, date-fns, isomorphic-dompurify, next-redux-wrapper, next-seo, persona, react-chartjs-2, react-dom, react-ga, redux-thunk, sass, sharp, slick-carousel
- imported but not declared: @/app, @actions/auth, @actions/common, @actions/externals, @actions/products, @components/GlobalLoaderLootie, @components/Layout, @components/Slider, @components/analytics, @components/app, @components/common, @components/wrapper, @constants, @utils, @validations/accountDetails, @validations/auth, @validations/externals, @validations/postOrder, app, classnames, prop-types
- env vars referenced: 62 · in .env.example: 64 · referenced but missing from example: NEXT_PUBLIC_CLIENT_SIDE_REDIRECT_URL, NEXT_PUBLIC_FOOTER_MENU_WORDPRESS_URL, NEXT_PUBLIC_META_TITLE_BRAND_URL, NEXT_PUBLIC_WEBSITE_BASE_URL, NEXT_PUBLIC_WORDPRESS_BANNER_URL, NEXT_PUBLIC_WORDPRESS_DESCRIPTION_URL, NODE_ENV, REACT_APP_BASE_URL
- CI/deploy files: .github/workflows/node.js.yml

## Tests
- test deps: none · test files: 1 · test lines: 94 · scripts.test: none

## API surface
- route handlers found: 0 · with no middleware before the handler: 0 · Next pages/routes: 35 · Next api routes: 3
- middleware frequency: 

## Data model
- models: 0 ()
- money field types in models/: none matched

## secrets
- none matched

## security
- **dangerously_set_html**: 93 hits in 38 files — top: app/blog/_components/BlogDetailView.jsx (8), app/components/app/CareerPage/index.js (7), app/components/app/AboutsUs/index.js (6) — e.g. app/author/_components/AuthorBlogList.jsx:137, app/author/_components/AuthorDetailView.jsx:77, app/blog/_components/BlogDetailView.jsx:238, app/blog/_components/BlogDetailView.jsx:257
- **child_process**: 1 hits in 1 files — top: app/utils.js (1) — e.g. app/utils.js:239
- **mongo_where**: 1 hits in 1 files — top: app/utilities/validations/queryParams.js (1) — e.g. app/utilities/validations/queryParams.js:30

## hardcoded
- **http_url**: 158 hits in 50 files — top: app/constants.js (18), app/components/app/Shop/Types/SubSingleCategoryProducts.js (16), app/components/wrapper/Footer.js (13) — e.g. app/api/checkout/route.js:10, app/api/checkout/route.js:10, app/api/register/route.js:11, app/api/register/route.js:11
- **objectid_24hex**: 12 hits in 3 files — top: app/utils.js (10), app/components/app/Checkout/FHLcredit.js (1), app/constants.js (1) — e.g. app/components/app/Checkout/FHLcredit.js:74, app/constants.js:12, app/utils.js:613, app/utils.js:613
- **ip_literal**: 8 hits in 3 files — top: app/shop/strain/_components/SingleStrain.jsx (6), app/constants.js (1), app/shop/strain/_components/Strains.jsx (1) — e.g. app/constants.js:39, app/shop/strain/_components/SingleStrain.jsx:341, app/shop/strain/_components/SingleStrain.jsx:341, app/shop/strain/_components/SingleStrain.jsx:341
- **localhost**: 4 hits in 3 files — top: app/api/register/route.js (2), app/api/checkout/route.js (1), app/components/app/Auth/Signup.js (1) — e.g. app/api/checkout/route.js:10, app/api/register/route.js:11, app/api/register/route.js:25, app/components/app/Auth/Signup.js:622
- **s3_bucket**: 4 hits in 1 files — top: app/components/app/Shop/Shop.js (4) — e.g. app/components/app/Shop/Shop.js:322, app/components/app/Shop/Shop.js:322, app/components/app/Shop/Shop.js:324, app/components/app/Shop/Shop.js:324
- **phone_literal**: 2 hits in 2 files — top: app/components/app/Auth/Signup.js (1), app/components/app/Checkout/FHLcredit.js (1) — e.g. app/components/app/Auth/Signup.js:191, app/components/app/Checkout/FHLcredit.js:49
- **email_literal**: 1 hits in 1 files — top: app/components/app/Auth/Signup.js (1) — e.g. app/components/app/Auth/Signup.js:190

## performance
- **find_without_limit**: 73 hits in 21 files — top: app/components/app/Shop/Details/SingleProductDetails.js (9), app/components/app/Shop/Shop.js (7), app/components/common/DeliveryTabs.js (6) — e.g. app/blog/_components/BlogDetailView.jsx:94, app/blog/_components/BlogDetailView.jsx:101, app/components/app/Brands/Brands.js:199, app/components/app/Brands/Brands.js:295
- **settimeout_in_handler**: 12 hits in 10 files — top: app/components/app/Checkout/SecondStep.js (2), app/components/common/DeliveryTabs.js (2), app/HOC/AuthComponent.jsx (1) — e.g. app/HOC/AuthComponent.jsx:8, app/author/_components/AuthorBlogList.jsx:39, app/blog/_components/BlogListView.jsx:51, app/blog/_components/CategoryBlogView.jsx:58

## quality
- **commented_code_hint**: 407 hits in 51 files — top: app/components/app/Checkout/SecondStep.js (111), app/redux/actions/common.js (45), app/components/app/Auth/Signup.js (32) — e.g. app/HOC/RenderMainComponent.jsx:6, app/HOC/RenderMainComponent.jsx:30, app/HOC/RenderMainComponent.jsx:39, app/HOC/RenderMainComponent.jsx:42
- **empty_catch**: 21 hits in 19 files — top: app/shop/deals/[dealType]/[category-slug]/page.jsx (3), app/author_sitemap/sitemap.js (1), app/blog_category_sitemap/sitemap.js (1) — e.g. app/author_sitemap/sitemap.js:20, app/blog_category_sitemap/sitemap.js:20, app/blog_sitemap/sitemap.js:20, app/brands_sitemap/sitemap.js:20
- **console_log**: 6 hits in 5 files — top: app/HOC/RenderMainComponent.jsx (2), app/components/app/Drawer/ShoppingCartSidebar.js (1), app/components/app/Shop/Details/SingleProductDetails.js (1) — e.g. app/HOC/RenderMainComponent.jsx:23, app/HOC/RenderMainComponent.jsx:41, app/components/app/Drawer/ShoppingCartSidebar.js:453, app/components/app/Shop/Details/SingleProductDetails.js:39
- **todo_fixme**: 1 hits in 1 files — top: app/components/app/Shop/FAQ.jsx (1) — e.g. app/components/app/Shop/FAQ.jsx:10

## Docs in repo
- CLAUDE.md, DEALS_FLOW_IMPLEMENTATION_GUIDE.md, README.md, SECURITY_IMPLEMENTATION.md, dependency_analysis_report.md, docs/architecture.md, docs/components.md, docs/development-guidelines.md, project_analysis_report.md
