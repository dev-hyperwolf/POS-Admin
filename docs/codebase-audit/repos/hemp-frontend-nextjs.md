# hemp-frontend-nextjs — Codebase Audit

Repo: `/Users/jt/hyper-tech/hemp-frontend-nextjs` · SHA `755eab4` (single squashed "Initial commit") ·
468 tracked files, 244 source files, 45,869 source lines.

## 1. Purpose

Consumer-facing storefront for the "Hyperwolf"/"hyperwolf-hemp" cannabis delivery brand
(`package.json:2` name `hyperwolf-hemp`; canonical URLs point at `hyperwolf.la` and
`hyperwolf.com`, e.g. `app/page.js:23`, `app/constants.js:87`). It is a Next.js 14 App Router
site that:
- Renders the shop catalog, product/brand/strain/trait pages, blog/author content, checkout,
  and a member account area (`app/shop/*`, `app/blog/*`, `app/author/*`).
- Calls a single first-party backend ("hemp-backend", per the sibling repo naming in
  `CROSS-REPO-DUPLICATES.md`) at `NEXT_PUBLIC_HEMP_BASE_URL` / `HEMP_BASE_URL` for catalog,
  cart, member, and order data (`app/constants.js:27-29`, `app/api/checkout/route.js:19`).
- Calls a half-dozen third parties directly from the browser or from two Next.js API routes:
  Blaze-style member endpoints under `/api/v1/*` on the same backend, SpringBig loyalty,
  Alt36 payments, FHL (a financing/credit provider), Google Places/Maps/reCAPTCHA, Persona
  (age/ID verification), Didit (alternate ID verification), Intercom, MailerLite, DataOwl SMS,
  and Google Analytics/GTM (constants block `app/constants.js:17-153`).

## 2. Runtime & framework

- Node `>=18.15.0`, npm `>=9.5.0`, `engineStrict: true` (`package.json:66-70`, `.npmrc:1`). No
  `.nvmrc`, no Dockerfile in the repo.
- Next `14.0.4` (`package.json:38`) — two majors behind current (15/16); React `^18`
  (`package.json:39`). Next 14.0.4 predates the Next.js Server Actions CVEs patched in 14.1.1+;
  no Next.js version pin newer than 14.0.4 is anywhere in the tree.
- No database, no ORM — this is a pure frontend; all persistence is the remote backend.
- Plain JavaScript, not TypeScript: zero `.ts`/`.tsx` files, `jsconfig.json` only
  (`jsconfig.json:1`). No compile-time type checking anywhere in the 45k-line codebase.
- **No lockfile** (`package-lock.json`/`yarn.lock`/`pnpm-lock.yaml` all absent — confirmed by
  `ls` at repo root and by the metrics pass). Combined with `pins: {caret: 55, exact: 7}`
  (55 of 62 deps on `^`), every fresh `npm install` can pull different transitive versions.
  `engineStrict` only pins Node/npm, not packages.
- Two dependencies are imported but never listed in `package.json` at all —
  `classnames` (used in `app/components/Layout.js:1`, `app/components/app/Brands/FilterHeadingUI.jsx`,
  6 more files) and `prop-types` — see §13.

## 3. Entry points & boot

- Process entry is Next's own server (`next start -p 3047`, `package.json:6`); there is no
  custom server file.
- `middleware.js:1-18` runs on every request: sets 6 security headers (X-Frame-Options,
  HSTS, etc.) and does one hardcoded redirect (`/shop/cannabinoid` → `/shop/trait/cannabinoids`,
  `middleware.js:5-6`). It performs **no auth or route-protection logic**.
- `app/layout.js:50-89` is the root layout: wraps the tree in a Redux `Provider`
  (`app/redux/Providers.js:1-8`, client component, one global `configureStore` — no
  per-request store, standard for CSR-heavy Next apps), an MUI `ThemeProvider`
  (`app/theme`), and a progress-bar provider (`app/ProvidersBar.js`). It also inlines
  render-blocking third-party `<link>` tags for reviews.io, Quill CSS, and RevenueKit
  directly in the server-rendered `<body>` (`app/layout.js:65-79`) and a GTM `<noscript>` iframe
  via `dangerouslySetInnerHTML` (`app/layout.js:84-86`).
- `app/optimized-scripts.jsx` is a client component that injects GA/GTM/Facebook-Pixel-style
  script tags via `dangerouslySetInnerHTML` (6 occurrences, `app/optimized-scripts.jsx:12-143`).
- Global mutable state: the Redux store (`app/redux/store.js:13-25`) is the only in-memory
  global; `localStorage`/cookies (`app/utils.js:141-174`, `app/utils.js:796-816`) are the only
  persisted global state, entirely client-managed (see §6).
- Startup side effect worth flagging: `app/redux/reducers/index.js:1-16` defines a second,
  **dead** `combineReducers` root (three of five reducers commented out) that is never imported
  by `store.js` — confusing leftover from a pre-RTK migration, not wired into boot at all.

## 4. Directory map

| Dir | Role | Size |
|---|---|---|
| `app/components/` | ~139 files, all UI (feature folders under `app/`, `wrapper/`, `common/`) | 25,735 lines |
| `app/redux/` | RTK slices, thunks, and hand-rolled API wrapper functions (`actions/`, `apis/`, `reducers/`) | 8,275 lines, 23 files |
| `app/shop/` | App-Router pages for catalog/checkout/account (route segments, not components) | 4,913 lines, 25 files |
| `app/styles/` | Global SCSS — one 19,056-line file (`custom.scss`) and a 10,496-line `breakpoints.scss` | 30,180 lines, 5 files |
| `app/blog/`, `app/author/` | Blog/author content pages, all SSR + `dangerouslySetInnerHTML` | ~1,520 lines |
| `app/utilities/validations/` | Hand-rolled query/route param sanitizer (§14) | 1,207 lines, 6 files |
| `app/api/` | 3 Next.js Route Handlers: checkout, register, shop proxy (§6) | 194 lines |
| `app/axiosClient/` | A second, mostly-unused Axios client (§6, §12) | 69 lines |
| `app/HOC/` | 2 wrapper components (`RenderMainComponent`, `AuthComponent`) | 92 lines |
| `app/hooks/` | 1 custom hook, dead code (`useShopIsOpen`, never imported — §16) | 132 lines |
| `app/*_sitemap/` | 11 near-identical `sitemap.js` route files, one per content type | small, high duplication (§12) |
| `public/` | Static assets (images/fonts/icons) | 200 files |
| repo root `*.md` | `README.md`, `CLAUDE.md`, `SECURITY_IMPLEMENTATION.md`, `DEALS_FLOW_IMPLEMENTATION_GUIDE.md`, `dependency_analysis_report.md`, `project_analysis_report.md`, `docs/*.md` | 9 docs, several already stale (§9, §14) |

## 5. Data model summary

This is a frontend: there is no owned database schema. "Data model" here means the client-side
shapes the UI assumes — Redux slices and the JSON the backend is expected to return. Full
field-by-field detail (all 8 slices, all `apis/*.js` response shapes assumed) is in
`hemp-frontend-nextjs.datamodel.md`. Summary:

- **8 Redux Toolkit slices** wired into the one store (`app/redux/store.js:15-23`): `common`
  (58 fields, `app/redux/reducers/common.js:419-476` — the largest and most central slice: UI
  modals, location, cart-adjacent flags, FAQ, review data, all mixed together), `auth` (13
  fields, `app/redux/reducers/auth.js:16-32`), `products` (30 fields,
  `app/redux/reducers/products.js:546-576` — has a **duplicate key** `orderDetailData`
  declared twice in the same object literal, lines 548 and 551), `externals` (18 fields,
  loyalty/payment/FHL — `app/redux/reducers/externals.js:4-29`), `strains` (4 fields),
  `order` (3 fields), `cannabinoids` (3 fields), `traits` (3 fields).
- No client-side entity has a formal id/enum/type definition anywhere — ids are raw strings
  (Mongo ObjectId format, 24 hex chars, e.g. `app/constants.js:12`, `app/utils.js:613`)
  threaded through props and Redux state with no shape validation (no Zod/Yup/PropTypes on
  API responses — `prop-types` is imported in a handful of components, §13, but never on
  data coming back from the network).
- **Money is a raw JS `Number`, dollars (not cents), no currency field.** Tax math is done
  entirely client-side with hardcoded percentage constants — `app/utils.js:362-368`
  (`0.097` sales tax, `0.02` local city tax, `0.15` excise tax) — consumed by
  `app/components/app/Checkout/OrderDetails.js:21`. These rates are not sourced from the
  backend, a config file, or a per-store/per-region table; for a multi-jurisdiction cannabis
  retailer (city/county/state excise all vary), a single hardcoded rate triple baked into the
  bundle is very likely wrong for at least some stores/orders and can only be fixed by a
  frontend redeploy.
- **Type-shape drift within one slice:** `traits` slice initial state comments describe `data`
  as a map (`app/redux/reducers/traits.js:32`, `// mainTraitName => { metadata, subTraits }`)
  but the fulfilled reducer overwrites it with an **array** (`.map(...)`,
  `app/redux/reducers/traits.js:58-61`); a later reducer then does
  `Object.entries(state.data).find(...)` (`app/redux/reducers/traits.js:82-84`), which happens
  to still work on an array (numeric-index entries) but silently breaks any future code that
  expects `state.data[traitName]` to resolve directly, per the original comment's contract.
- No soft-delete convention, no timestamp convention, and no multi-tenancy key visible
  client-side — store/region scoping is done ad hoc via a `dispatchRegionID` string in the
  `common` slice (`app/redux/reducers/common.js:452`) and a location cookie
  (`app/utils.js` `Location` constant), not a first-class store/tenant object.

## 6. API surface

**API base URL selection.** Two different base URLs are read from two different env-var
families and mixed: `API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL` (`app/constants.js:27`,
used to build `BASE_URL` for the `apiGet/apiPost/...` family) and
`process.env.NEXT_PUBLIC_HEMP_BASE_URL` used directly in `app/page.js:53-56`,
`app/HOC/RenderMainComponent.jsx:11`, and `app/api/shop/route.js:34`. There is no single
source of truth for "the backend URL" — two names for what appears to be the same host, and a
third, unrelated pattern in `app/axiosClient/index.js:6`, which reads
`process.env.REACT_APP_BASE_URL` — a **Create-React-App-style env var name that Next.js does
not special-case**; it is not `NEXT_PUBLIC_`-prefixed so it is `undefined` in the browser
bundle, and it is not in `.env.example` at all (`env_missing_from_example` in the metrics
JSON). `axiosClient`'s `baseURL` is therefore always `undefined` wherever it runs in a browser
context. It still works today only because most `apis/*.js` files that use `axiosClient` pass
a **full absolute URL** as the call argument (e.g. `app/redux/apis/auth.js:8`), which makes
axios ignore `baseURL` — but that is incidental, not by design.

**Two parallel API client layers** exist and are both live: (1) `app/axiosClient/index.js`, a
bare axios instance whose request interceptor for attaching auth is entirely commented out
(`app/axiosClient/index.js:21-30`) and whose only active behavior is a 401 → `window.location.href
= "/login"` redirect (`app/axiosClient/index.js:39-43`) — note `/login` is outside the
`(auth)` route group's actual path `/login` under `app/(auth)/login/page.jsx`, so this part is
consistent, but there is no `/login` retry of the original request; and (2) a hand-rolled
`apiGet/apiPost/apiPut/apiDelete` family in `app/utils.js:71-140` built on a fresh `axios[method]`
call per request, no shared instance, no interceptors, no retry, no request cancellation.
Which layer a given `apis/*.js` file uses looks arbitrary — `app/redux/apis/auth.js` mixes both
in the same file (`axiosClient.post` on lines 8/16/20/31/36/40 vs `apiPost` on lines 44/48/52).

**Auth token storage and attachment — the actual bug.** On login, the full member object
(profile fields + `accessToken`) is written to `localStorage` in plaintext under the key named
by `AccessTokenName` (`app/constants.js:1`, written at
`app/redux/reducers/auth.js:~330-333` in the `login.fulfilled` case, and again at
`emailLogin.fulfilled`). Every subsequent "authenticated" request goes through
`apiReq` (`app/utils.js:71-108`), which does read the token back out
(`const accessToken = getData(AccessTokenId)`, `app/utils.js:82`) but then only spreads the
*existing* headers back into itself and drops the token on the floor —
```
if (accessToken) {
    headers = {
        ...headers,   // accessToken never added here
    }
}
```
(`app/utils.js:83-87`). Combined with the commented-out Authorization attachment in
`axiosClient` (`app/axiosClient/index.js:21-30`), **no code path in this repo ever sends a
per-user bearer/session token to the backend.** Every call instead carries only the static,
client-bundle-embedded `X-API-KEY` (`app/constants.js` `NEXT_PUBLIC_API_AUTH_KEY`, same value
for every visitor). Endpoints that are keyed by member id take that id straight from client
state with no proof of ownership, e.g. `getUserInfoAPI(memberId)` →
`GET ${HEMP_BASE_URL}/api/v1/member/${memberId}` (`app/redux/apis/auth.js:64`,
`app/redux/reducers/auth.js` calls it from `fetchUserInfo`). From the frontend's side this is
architecturally indistinguishable from "any client that knows the static API key can fetch any
member id" — see §14, Critical.

**Route/page inventory:** 35 Next.js pages per the metrics pass (`app/**/page.js(x)`,
independently re-counted at `find app -name 'page.js*' | wc -l` = 35), plus 3 Route Handlers
under `app/api/` (`checkout`, `register`, `shop`) and 11 `sitemap.js` files
(`app/*_sitemap/sitemap.js`, one per content type — see §12). 14 of those pages are dynamic
segments (`[id]`/`[...catchall]`); 8 of the 14 route their params through
`validateRouteParams`/`validateQueryParams` from `app/utilities/validations/queryParams.js`
(author, brand, product, strain, `[type]`/`[type]/[subtype]`, both trait routes, blog list) —
**6 do not**: `app/[...not_found]/page.js`, `app/[template]/page.jsx`,
`app/blog/[...blogPath]/page.jsx`, `app/blog/category/[categorySlug]/page.jsx`,
`app/shop/blogs/[blogID]/page.jsx`, `app/shop/deals/[dealType]/[category-slug]/page.jsx`. This
contradicts the blanket claim in `SECURITY_IMPLEMENTATION.md:5-19` that the utility
"protect[s] against SQL injection, XSS, path traversal... through query parameters and route
parameters" for the app generally — it protects the routes that call it, which is roughly
half of the dynamic ones. (Note: because there is no owned SQL/NoSQL database in this repo,
the SQL/NoSQL-injection framing in that doc is largely theater for a pure frontend anyway —
the real payoff of the utility is XSS/param-shape hardening before values are interpolated
into `fetch` URLs sent to the backend.)

**Auth mechanism / role checks.** There is no JWT decoding, no role string, and no
role-gated UI anywhere client-side found by grep for `role`/`jwt`/`decode` in `app/redux` and
`app/components`. "Logged in" is purely `!!getData(AccessTokenId)` (`app/utils.js:179-184`).
Protected-looking pages such as `/shop/my_account` (`app/shop/my_account/page.jsx:9-15`) render
unconditionally with no server-side or client-side redirect for a logged-out visitor — the
page simply renders with an empty `user` object from Redux (`app/components/app/MyAccount/index.js:30`)
until/unless the backend rejects the underlying data fetches. Because no bearer token is ever
sent (see above), enforcement of "is this really your account" is 100% the backend's job; the
frontend contributes nothing to that boundary.

**Validation library:** none for forms beyond the hand-written `app/utilities/validations/*`
files (no Yup/Zod/React Hook Form resolver); form validation in `Signup.js` (1,523 lines) is
inline conditional logic mixed into the component.

**Pagination:** ad hoc, per-endpoint query strings (`?skip=0&limit=100`, e.g.
`app/HOC/RenderMainComponent.jsx:13`, `app/api/shop/route.js:57`) — no shared pagination
helper or cursor convention.

**Error response shape:** the two Route Handlers under `app/api/` return
`{ message }` (`app/api/checkout/route.js:29-35`) while `app/api/shop/route.js` returns
`{ error }` (`app/api/shop/route.js:97-100`) — two different error envelope keys for the app's
own three routes.

**Versioning:** the backend is addressed as `/api/v1/...` throughout; no `v2` reference
anywhere, so no evidence of an in-flight migration.

**SSR vs CSR:** the app mixes both without a clear rule. `app/page.js` (home) is an async
Server Component that fetches categories/products/banners/brands with **four sequential
`await fetch` calls** (`app/page.js:59-62`, not `Promise.all`) — a request waterfall on the
most-visited page. `app/HOC/RenderMainComponent.jsx`, which wraps the home page *and* every
blog/author/template/shop page (8 call sites, confirmed by grep), does its **own**, separate,
uncached-relative-to-page.js fetch of the same category endpoint
(`app/HOC/RenderMainComponent.jsx:11-19`) with different `fetch` options (`next: { tags,
revalidate }`) than `page.js`'s plain fetch — Next's request memoization only dedupes
identical `fetch(url, options)` calls, so these two do **not** dedupe and the category
endpoint is hit twice per home-page render. Most interior shop/checkout/account UI is
`'use client'` and CSR-only against Redux + the API layers above.

## 7. Background jobs

None. This is a frontend with no server-held cron/queue. The closest analogs are two
client-side `setInterval` polls, both properly cleaned up in `useEffect` teardown:
`app/components/app/MyAccount/DiditModal.js:16-33` (polls an ID-verification session every 8s
while a modal is open) and a second, **dead** one in `app/hooks/useShopIsOpen.jsx:49-52` (1s
interval) — this hook is defined but never imported anywhere in the tree (verified: the only
grep hit for `useShopIsOpen` is its own definition file), so it never runs in production.

## 8. Third-party integrations & secrets

| Integration | Wrapper file | Credential source | Signature-verified webhooks? |
|---|---|---|---|
| First-party backend (hemp-backend) | `app/utils.js` (`apiGet` family), `app/axiosClient/index.js`, `app/redux/apis/*.js` | `NEXT_PUBLIC_API_AUTH_KEY`, `API_AUTH_KEY` (server-only, used only in `app/api/{checkout,register}/route.js`) | N/A (outbound only) |
| Blaze-style headers | `app/constants.js:66-70` (`BlazeHeaders`) | `NEXT_PUBLIC_X_AUTH_TOKEN` **with a hardcoded literal fallback token** — `app/constants.js:24` — cited as file:line only; the literal secret value is not reproduced here | N/A |
| SpringBig (loyalty) | `app/constants.js:52-54`, consumed in `app/redux/apis/externals.js` | `NEXT_PUBLIC_SPRING_BIG_AUTH_KEY`, `NEXT_PUBLIC_SPRING_BIG_API_KEY` | N/A |
| Alt36 (payments) | `app/constants.js:58-62` | `NEXT_PUBLIC_ALT_36_API_KEY`, `NEXT_PUBLIC_ALT_36_X_API_KEY` — both `NEXT_PUBLIC_`, i.e. shipped to every browser | N/A |
| FHL (financing/credit) | `app/components/app/Checkout/FHLcredit.js`, constants at `app/constants.js:120-127` | `NEXT_PUBLIC_FHL_*` (all client-exposed) | N/A |
| Persona (ID verification) | dynamic `import('persona')` in `app/components/app/Auth/Signup.js:108` | `NEXT_PUBLIC_AGE_CHECKER_LIVE_API_KEY` (`Signup.js:185`) | N/A |
| Didit (alt ID verification) | `app/components/app/MyAccount/DiditModal.js` | via Redux thunk to backend, no direct client key seen | N/A |
| Google Places/Maps/reCAPTCHA | `app/constants.js:44,79-85` | `NEXT_PUBLIC_GOOGLE_*` (all client-exposed, expected for these Google client SDKs) | N/A |
| Intercom | `app/redux/apis/auth.js:51,58` (`intercom/user/optIn` proxied through own backend) | none client-side; backend-mediated | N/A |
| MailerLite | `app/constants.js:75` | `NEXT_PUBLIC_MAILERLITE_API_KEY` | N/A |
| DataOwl (SMS) | `app/constants.js:43` | URL only, no key referenced client-side | N/A |
| Google Analytics/GTM | `app/optimized-scripts.jsx`, `app/layout.js:84-86` | `NEXT_PUBLIC_GOOGLE_ANALYTICS_KEY`/`_TRAKING_KEY` (note the typo, both names exist) | N/A |
| Sentry | **declared in `package.json:22` (`@sentry/nextjs`) but never configured or imported anywhere** — no `sentry.client.config.js`/`sentry.server.config.js`, zero `Sentry.` references in `app/` | N/A | N/A |

No webhook receivers exist in this repo (the 3 Route Handlers are all outbound proxies), so
"are webhooks signature-verified" does not apply here — that responsibility sits in the
backend repo.

Nearly every "secret" that matters for this app (API keys, partner keys, third-party keys) is
`NEXT_PUBLIC_`-prefixed and therefore intentionally shipped into the client bundle; the one
genuinely server-only pair (`API_AUTH_KEY`, `HEMP_BASE_URL`) is correctly kept off
`NEXT_PUBLIC_` and used only inside the two Route Handlers (§6). The exception is the
hardcoded fallback token at `app/constants.js:24`, which defeats the purpose of having an env
var at all for that one header.

## 9. Tests

- One test file, 94 lines: `app/components/common/__tests__/smartCartUpsellState.test.js`,
  testing a single pure function (`getSmartCartUpsellState`) with plain `describe`/`it`/`expect`
  syntax.
- **No test runner is declared.** `package.json` has no `test` script, no `jest`/`vitest`/
  `@testing-library/*` in `devDependencies`, and no `jest.config.*` anywhere in the tree
  (confirmed: `find . -iname "jest.config*"` returns nothing, `node_modules` was not
  installed so this can't be verified against an actual jest binary, but the config and
  dependency are both absent from source). The one test file that exists **cannot currently be
  run** by any command in this repo as checked out.
- No component tests, no integration tests, no E2E (no Playwright/Cypress config found).
  Effectively 0% of the 45k-line UI surface has automated coverage.

## 10. Build & deploy

- Build: `next build` (`package.json:5`); no bundle analyzer wired despite `ANALYZE` appearing
  in `.env.example` (`ANALYZE` key, no corresponding `withBundleAnalyzer` in `next.config.js`).
- Deploy: `.github/workflows/node.js.yml:1-16` triggers only on push to branch
  `new-ui-design-development` (not `main`), SSHes into host `thcs.in` with a username/password
  secret pair, and runs `git stash && git pull origin new-ui-design-development && pm2 restart
  hyperwolf-hemp-nextjs` directly on the server. There is **no `npm install` and no `npm run
  build` step in the deploy job** — if `pm2`'s own process definition doesn't rebuild, this
  ships un-built source or stale `.next` output; if it does rebuild, that step is invisible to
  CI and unverifiable from this repo. `git stash` on every deploy silently discards any
  uncommitted server-side changes with no log of what was stashed.
- No environment separation is visible in the repo: one workflow, one branch, one server,
  password-based SSH. `.env.example` lists both `NEXT_PUBLIC_HEMP_BASE_URL` and a separate
  legacy-looking `NEXT_PUBLIC_BASE_URL`/`NEXT_PUBLIC_CUSTOM_BASE_URL`/`NEXT_PUBLIC_APP` with no
  comments distinguishing dev/stage/prod usage.
- Logging/monitoring: `console.log`/`console.error`/`console.warn` only (6 raw `console.log`
  hits per metrics, e.g. `app/HOC/RenderMainComponent.jsx:23,41`); no Sentry despite it being a
  declared dependency (§8); no structured logging.
- README (`README.md`) documents local dev commands accurately (`npm run dev` on port 3047
  matches `package.json:4`) but does not mention the actual SSH/pm2 deploy path found in
  `.github/workflows/node.js.yml` at all — a new engineer reading only the README would not
  know how or where this app is deployed.

## 11. Hardcoded values

Counts from the verified metrics pass, corrected where re-checked by hand:
- **158 raw `http(s)://` URLs across 50 files** (`app/constants.js` alone has 18, e.g. the
  `POWERED_BY` fallback `app/constants.js:113`, `FOOTER_MENU_WORDPRESS_URL` fallback
  `app/constants.js:139`, `WORDPRESS_BANNER_URL` fallback `app/constants.js:30`). Most are
  `||` fallback defaults for missing env vars — i.e., "hardcoded because the env var wasn't
  set," which quietly reintroduces the value the env var was supposed to override.
- **A hardcoded secret-shaped fallback token**: `app/constants.js:24` — kind: static bearer/
  auth-token string used as an unconditional fallback for `NEXT_PUBLIC_X_AUTH_TOKEN`; shipped
  to every browser regardless of env config (see §8, §14 — value not reproduced here).
- **12 raw 24-hex Mongo ObjectIds** as literal string constants, e.g.
  `app/constants.js:12` (`OverrideInventoryId`), `app/utils.js:613` (`thcMgIds`, an array of
  10 hardcoded product-tag ids used to special-case "THC mg" display logic) — these are
  content ids, not secrets, but they mean a catalog change on the backend (re-tagging a
  product) silently breaks a client-side special case with no test to catch it.
- **A hardcoded physical store address and phone number** in footer data:
  `app/constants.js:163-176` (`footerCompanyData`) — "1628 S. Grand Ave., Santa Ana, CA 92705"
  and a `tel:` link, JSX baked directly into a constants file instead of coming from the store
  data already modeled elsewhere in the app (`storeDetailsData` in the `common` slice,
  `app/redux/reducers/common.js:438`).
- **S3 bucket name/URL hardcoded 4x** in one file: `app/components/app/Shop/Shop.js:322-324`.
- Two placeholder phone/email "literals" flagged by the metrics
  (`app/components/app/Auth/Signup.js:190-191`, `app/components/app/Checkout/FHLcredit.js:49`)
  are **not real PII** — verified by reading them: both are commented-out sample data
  (`m@yopmail.com`, a fake 10-digit number) used during development, left in place. Corrected
  from the mechanical count: 0 real hardcoded contact PII found.
- **Hardcoded cannabis tax rates** baked into `app/utils.js:363-365` (9.7% / 2% / 15%) — see
  §5; this is "hardcoded and should be config/data" in the clearest sense in the repo, since
  tax law varies by jurisdiction and the app serves multiple stores/regions.
- **Hardcoded `localhost:3047` in the production CSRF-ish origin allowlist** of both server
  API routes: `app/api/checkout/route.js:9`, `app/api/register/route.js:12` — dev convenience
  left in a value that also guards production traffic.
- **A hardcoded `refer: 'http://localhost:3047'` header** sent to the production backend on
  every register call regardless of actual deployment origin: `app/api/register/route.js:26`.

## 12. Duplicated code

**In-repo:** the metrics pass's exact/near duplicate scanner found no groups (small, unusual
for 45k lines — likely because most repetition here is structural/copy-paste-with-edits rather
than byte-identical). Manually found:
- **11 near-identical `sitemap.js` files**, one per content type
  (`app/author_sitemap/sitemap.js`, `app/blog_sitemap/sitemap.js`,
  `app/blog_category_sitemap/sitemap.js`, `app/brands_sitemap/sitemap.js`,
  `app/cannabinoids_sitemap/sitemap.js`, `app/categories_sitemap/sitemap.js`,
  `app/legal_sitemap/sitemap.js`, `app/mainTrait_sitemap/sitemap.js`,
  `app/products_sitemap/sitemap.js`, `app/subTrait_sitemap/sitemap.js`, plus the root
  `app/sitemap.js`) — each has the same empty-catch pattern flagged by the metrics
  (`app/author_sitemap/sitemap.js:20` etc., 21 empty catches total across 19 files), a strong
  sign these were copy-pasted from one template and never refactored into a shared generator.
- **Two parallel API client layers** doing the same job (`app/axiosClient/index.js` vs.
  `app/utils.js:71-140`), see §6 — this is duplication of *responsibility*, not text.
- **Two blog "detail view" component pairs** that look like the same feature built twice:
  `app/blog/_components/BlogDetailView.jsx` (494 lines) vs.
  `app/components/app/Shop/BlogsView/_components/BlogDetailsView.jsx`, and
  `app/shop/blogs/_components/BlogDetailsView.jsx` — three files implementing overlapping
  "render a blog post" logic in three different directory trees.
- Duplicate object key in one file: `app/redux/reducers/products.js:548` and `:551` both
  declare `orderDetailData` in the same `initialState` literal (§5).

**Cross-repo** (verified against `CROSS-REPO-DUPLICATES.md`): this repo has exactly one
cross-repo match, and it is trivial — `commitlint.config.js` (110 lines) is byte-identical
across `hemp-frontend-nextjs`, `hemp-retailer-admin`, and `hyperwolf-super-admin`
(`CROSS-REPO-DUPLICATES.md:34`). That is expected/desirable boilerplate (a shared lint config
convention), not a duplication problem — this repo does **not** participate in the large
`hemp-backend`↔`stilo-backend` or `hemp-retailer-admin`↔`hyperwolf-super-admin` duplication
clusters that dominate the cross-repo report, because it is the only pure end-customer-facing
storefront among the sibling repos scanned.

## 13. Dependency risk

- **Next 14.0.4 / React 18**: two Next majors behind (15, 16 current per metrics EOL note);
  no migration codemod artifacts in the tree, meaning an eventual upgrade is a from-scratch
  effort.
- **No lockfile** (§2) — reproducible-build risk on every install, in CI and locally.
- **Declared but never imported (metrics claimed 16, re-verified by hand — 9 confirmed genuinely
  unused, 7 are false positives from the regex not catching non-JS-import usages):**
  - Genuinely unused: `@sentry/nextjs` (§8, §10 — a real operability gap, not just dead
    weight), `next-seo`, `next-redux-wrapper`, `react-chartjs-2`, `react-ga` (Google Analytics
    is instead hand-rolled via `gtag()` in `app/utils.js:356-361` and GTM script tags — two
    different GA integration strategies coexist), `redux-thunk` (RTK's `configureStore`
    already includes `redux-thunk` internally, `app/redux/store.js:24`, making the explicit
    dependency redundant), `isomorphic-dompurify` (declared, but the team wrote a hand-rolled
    `sanitizeHtml` instead — `app/utils.js:734-759` — despite the maintained, security-reviewed
    library already sitting in `node_modules`; see §14), `date-fns` (the app uses `moment`/
    `moment-timezone` throughout instead — two date libraries declared, one used).
  - False positives, corrected: `sass` and `sharp` are consumed implicitly by Next.js's built-in
    Sass compiler and image optimizer respectively, not via JS `import`; `slick-carousel` **is**
    used, but only via CSS-only imports (`app/template.js:27-28`,
    `app/components/app/Shop/SliderData.jsx:9-10`), which the metrics' import-statement regex
    doesn't match; `persona` **is** used via a dynamic `import('persona')`
    (`app/components/app/Auth/Signup.js:108`); `@emotion/*` are transitively required by
    `@mui/material` regardless of direct import; `react-dom` is a required peer of `react`/Next
    itself.
- **Imported but undeclared — genuinely fragile:** `classnames` and `prop-types` are imported
  directly in at least 8 component files (`app/components/Layout.js`,
  `app/components/app/Brands/FilterHeadingUI.jsx`,
  `app/components/app/Shop/Types/DealsCategoryProducts.js`,
  `app/components/app/Shop/Details/SingleProductDetails.js`, 4 more) but **neither appears in
  `package.json` dependencies at all**. The build only works today because something else in
  the dependency tree (MUI, most likely) happens to pull them in transitively; a future
  upgrade that drops that transitive dependency will break these imports with no warning from
  `npm install`.
- The rest of the "imported but not declared" metrics list (`@/app`, `@actions/*`,
  `@components/*`, `@constants`, `@utils`, `@validations/*`, bare `app`) are all `jsconfig.json`
  path aliases (`jsconfig.json:4-11`), not npm packages — false positives in the metrics pass,
  corrected here.
- Bundle-size offenders: `moment` + `moment-timezone` (both full, non-tree-shakeable, ~230KB
  combined un-minified) sit alongside a declared-but-unused `date-fns` (which is
  tree-shakeable) — the app is paying the bundle cost of the worse choice while a lighter one
  sits unused in `package.json`.

## 14. Security findings

**Critical — No per-user auth token is ever sent to the backend; member data is addressed by
raw client-supplied id.** `app/utils.js:82-88` reads the stored access token but never attaches
it to outgoing request headers (the `if (accessToken) { headers = {...headers} }` block is a
no-op); `app/axiosClient/index.js:21-30`'s request interceptor that would attach
`Authorization: Bearer <token>` is entirely commented out. The only credential ever sent on
any request from this codebase is the single static `X-API-KEY`
(`NEXT_PUBLIC_API_AUTH_KEY`/`BMW_HEADER`), identical for every visitor and visible in every
browser's network tab and JS bundle. Endpoints that return a specific member's data take that
member's id directly from client state with no accompanying proof of session ownership, e.g.
`getUserInfoAPI(memberId)` → `GET {HEMP_BASE_URL}/api/v1/member/${memberId}`
(`app/redux/apis/auth.js:64`). **Fix:** un-comment and complete the Authorization-header
attachment in one client (retire the other), have the backend require and verify a bearer
token on every member-scoped route, and stop keying member lookups purely off a client-passed
id — this is exploitable as IDOR/broken authentication to whatever extent the backend does not
independently enforce session ownership, and this repo's code proves the frontend currently
contributes nothing to that enforcement.

**High — Hardcoded secret-shaped fallback token shipped to every browser.**
`app/constants.js:24` falls back to a literal token string when
`NEXT_PUBLIC_X_AUTH_TOKEN` is unset. Being a `||` fallback baked into source means it ships in
the client bundle for every environment that forgets to set the env var, and rotating the real
secret does nothing unless this line is also edited and redeployed. **Fix:** remove the literal
fallback; fail loudly (throw at build/boot) if the env var is missing instead.

**High — Session (including the access token) is stored as a single plaintext localStorage
blob, and many `dangerouslySetInnerHTML` sinks bypass the app's own sanitizer.** The full member
object plus `accessToken` is written to `localStorage` unencrypted
(`app/redux/reducers/auth.js` `login.fulfilled`/`emailLogin.fulfilled`, via `setData` at
`app/utils.js:159-165`). Separately, a hand-rolled `sanitizeHtml` exists
(`app/utils.js:734-759`) and is correctly used at ~25 call sites (blog/author/strain/brand
content), but at least 9 other `dangerouslySetInnerHTML` sites render raw, unsanitized
CMS-sourced strings directly: `app/components/app/Shop/Details/SingleProductDetails.js:791,829,853,884`
(product description/effects/traits, `ql-editor` rich-text fields),
`app/components/app/SearchIcon/SearchedBrand.jsx:25,40`,
`app/components/app/SearchIcon/SearchedStrain.jsx:32,47`, and
`app/components/app/Shop/Traits/ProductTraits.jsx:198`. Any of these fields being editable by a
lower-trust role in the admin/back-office (brand partner, vendor-managed product copy, etc.)
is a stored-XSS path straight to the plaintext session blob above — an attacker who gets one
malicious `<script>` into a product/brand/strain description field can exfiltrate every
visitor's `accessToken` and profile data. **Fix:** route every `dangerouslySetInnerHTML` call
through the existing `sanitizeHtml`, or better, the already-declared-but-unused
`isomorphic-dompurify` (§13); stop storing raw tokens in `localStorage` in favor of an
httpOnly cookie set by the backend.

**Medium — Client-side "encryption" of a client-visible secret provides no protection.**
`generateEncryptedAuthKey()` (`app/utils.js:722-731`) AES-encrypts
`NEXT_PUBLIC_API_AUTH_KEY` using a key derived from `NEXT_PUBLIC_AUTH_PHRASE_KEY` — both values
are `NEXT_PUBLIC_`, i.e. both are already plaintext in the shipped JS bundle, so this function
adds bundle size and CPU cost without adding any confidentiality. (Grep found no call site for
this function in `app/`, so it may also simply be dead code — either way it should be removed
rather than left as false reassurance.)

**Medium — Origin-header allowlist is the only access control on two backend-key-bearing
proxy routes, and it is trivially spoofable by a non-browser client.**
`app/api/checkout/route.js:8-16` and `app/api/register/route.js:9-17` gate use of the
server-only `API_AUTH_KEY` on `headers().get('origin')` matching a 3-item allowlist that
includes `http://localhost:3047` in production (§11). A real browser enforces `Origin`
honestly, but any direct HTTP client (curl, a script, another server) can set `Origin` to
whatever it wants — the check stops accidental cross-site browser calls, not a deliberate
attacker who read this file. **Fix:** this is a reasonable *CSRF* mitigation for browser
traffic but should not be the only gate on a route that spends a real backend secret; add a
CSRF token or session check behind it.

**Low — 21 empty `catch` blocks swallow errors silently** across 19 files (metrics-verified,
e.g. `app/author_sitemap/sitemap.js:20`), meaning sitemap generation and other flows can fail
with zero signal to anyone.

**Corrected from the mechanical metrics pass (false positives, verified by hand):**
- `mongo_where` hit at `app/utilities/validations/queryParams.js:30` is the sanitizer's *own*
  `$where` detection regex literal, not an actual NoSQL query — not a vulnerability.
- `child_process` hit claimed at `app/utils.js:239` — the string `child_process` does not
  appear anywhere in this file or the repo (`grep -arn "child_process"` returns zero matches at
  this SHA); stale/incorrect metrics entry, zero verified.

## 15. Performance findings

- **Sequential (non-parallel) data fetching on the highest-traffic page.**
  `app/page.js:59-62` awaits categories, then products, then banners, then brand data one
  after another instead of `Promise.all`/`Promise.allSettled` — four network round-trips
  serialized on the home page's TTFB. The team already knows the fix: the sibling route
  `app/api/shop/route.js:63-68` does the same four fetches with `Promise.allSettled`.
- **The category endpoint is fetched twice per page render** with two different cache
  configurations that don't dedupe (`app/page.js:53-56` vs.
  `app/HOC/RenderMainComponent.jsx:11-19`, wrapping 8 different page types) — see §6.
- **93 `dangerouslySetInnerHTML` sites across 38 files** (metrics-verified) — beyond the
  security angle (§14), several call `sanitizeHtml`'s DOM-based path
  (`app/utils.js:738-750`) on every render of list views (e.g. search results, blog lists),
  parsing HTML via `DOMParser` on the client for content that rarely changes; there is no
  memoization of the sanitized output.
- **A 1-second polling interval exists in the codebase but is dead** —
  `app/hooks/useShopIsOpen.jsx:49-52` is never imported anywhere (verified), so it currently
  costs nothing in production; flagged so it isn't revived without fixing the interval length.
- The `find_without_limit` metric (73 hits) is a **false-positive-heavy category for a
  frontend with no owned database** — nearly all hits are `Array.prototype.find()` on
  in-memory arrays already fetched from the backend (e.g.
  `app/components/app/Shop/Details/SingleProductDetails.js` finding a matching product
  variant in a small already-loaded list), not unbounded database queries. Not re-scored as a
  performance risk; noted so it isn't miscounted in a rollup across repos.
- **Two full, non-tree-shaken date libraries shipped** (`moment` + `moment-timezone`) while a
  lighter, tree-shakeable one (`date-fns`) sits declared-but-unused (§13) — a real,
  fixable bundle-size cost.
- `app/styles/custom.scss` is 19,056 lines and `app/styles/breakpoints.scss` is 10,496 lines,
  both loaded globally (`next.config.js:52-54` `sassOptions.includePaths`) rather than
  per-component/CSS-modules — every page pays for the full global stylesheet regardless of
  which components it actually renders.

## 16. Ten things a new developer would trip over

1. Two different env var names for the same backend host (`NEXT_PUBLIC_BASE_URL` vs
   `NEXT_PUBLIC_HEMP_BASE_URL`, `app/constants.js:27` vs `app/page.js:53`) — easy to edit the
   wrong one and see no effect.
2. `axiosClient`'s `baseURL` reads `process.env.REACT_APP_BASE_URL`, a CRA-style var name that
   does nothing in Next.js and isn't in `.env.example` (`app/axiosClient/index.js:6`) — looks
   configured, isn't.
3. The `accessToken` fetched in `apiReq` is never actually attached to request headers
   (`app/utils.js:82-88`) — a new dev "fixing" an auth bug here will assume the token is being
   sent because the variable exists and is referenced.
4. Two competing reducer trees: the real one (`app/redux/store.js`) and a dead
   `combineReducers` file with three of five slices commented out
   (`app/redux/reducers/index.js:1-16`) that looks like it should be the source of truth but
   is never imported.
5. `app/redux/reducers/traits.js` documents `data` as an object map in a comment
   (line 32) but actually stores an array after the first fetch (line 58) — code written
   against the comment will silently get `undefined`.
6. `app/HOC/RenderMainComponent.jsx` silently double-fetches the category list already
   fetched by whatever page it wraps (§6) — a dev adding a "fetch categories once" cache will
   not find this second call site by searching the page component alone.
7. No test runner is configured (`package.json` has no `test` script and no jest config), but
   one test file exists and looks runnable — `npm test` fails with "missing script" the first
   time anyone tries it.
8. `classnames` and `prop-types` are used across 8+ files but not declared in `package.json`
   (§13) — `npm ls classnames` will show nothing, and a clean install that changes MUI's
   transitive deps can break these imports with a confusing "module not found."
9. The GitHub Actions workflow deploys from branch `new-ui-design-development`, not `main`
   (`.github/workflows/node.js.yml:4-5`) — pushing to `main` does nothing.
10. `app/styles/custom.scss` is 19,056 lines with no per-feature split — finding the rule that
    controls a given component's styling means grep, not navigation.

## 17. Grade inputs

| Axis | 1–10 | Justification | Citation |
|---|---|---|---|
| Simplicity | 3 | 3,063-line single component file, 19,056-line single SCSS file, two parallel API-client layers doing the same job | `app/components/app/Checkout/SecondStep.js` (3,063 lines); `app/styles/custom.scss` |
| Speed | 4 | Home page serializes 4 awaited fetches instead of `Promise.all`; category endpoint double-fetched every render | `app/page.js:59-62` |
| Security | 2 | No per-user auth token is ever attached to any request; member data addressed by raw client-supplied id | `app/utils.js:82-88`, `app/redux/apis/auth.js:64` |
| Data modelling | 3 | Money is a float with hardcoded, non-configurable tax rates; one slice's documented shape doesn't match its runtime shape | `app/utils.js:363-365`; `app/redux/reducers/traits.js:32,58` |
| Reuse vs. hardcoding | 3 | 11 near-identical sitemap files; store address/phone hardcoded in constants instead of using the already-modeled store data | `app/*_sitemap/sitemap.js`; `app/constants.js:163-176` |
| Testing | 1 | One 94-line test file; no test runner configured at all | `package.json` (no `test` script); `app/components/common/__tests__/smartCartUpsellState.test.js` |
| Upgradability | 3 | Plain JS (no types) across 45k lines, no lockfile, Next 14 two majors behind, business logic (tax math, cart math) embedded directly in components/utils rather than isolated | `app/utils.js:362-368`; `package.json` (no lockfile) |
| Operability | 2 | `@sentry/nextjs` declared but never configured; only `console.*` logging; deploy job has no visible build step | `package.json:22`; `.github/workflows/node.js.yml:9-16` |
| Developer experience | 3 | Two API client layers, dead reducer file, dead hook, doc (`SECURITY_IMPLEMENTATION.md`) overstates actual coverage | `app/redux/reducers/index.js`; `app/hooks/useShopIsOpen.jsx` |

## 18. Quick fixes (<1h each)

1. Delete the dead `app/redux/reducers/index.js` and `app/hooks/useShopIsOpen.jsx` — zero
   behavior change, removes two sources of confusion (§16 items 4, and the dead hook).
2. Remove the duplicate `orderDetailData` key in `app/redux/reducers/products.js:548,551`.
3. Fix the two Route Handlers' hardcoded `localhost:3047` origin allowlist entry and the
   hardcoded `refer: 'http://localhost:3047'` header to be environment-derived
   (`app/api/checkout/route.js:9`, `app/api/register/route.js:12,26`).
4. Route `SingleProductDetails.js:791,829,853,884`,
   `SearchedBrand.jsx:25,40`, `SearchedStrain.jsx:32,47`, and `ProductTraits.jsx:198` through
   the existing `sanitizeHtml` helper — same pattern already used 25 other places in the repo.
5. Remove the literal fallback token at `app/constants.js:24`; fail fast if the env var is
   unset.
6. Add `classnames` and `prop-types` to `package.json` dependencies (§13) — they're already
   imported and working, just undeclared.
7. Change `app/page.js:59-62` from sequential `await` to `Promise.all`, mirroring
   `app/api/shop/route.js`'s existing `Promise.allSettled` pattern.
8. Add a `test` script to `package.json` (even a stub that runs the one existing Jest-style
   file) so `npm test` doesn't fail with "missing script" on a fresh checkout.
9. Remove the unused `generateEncryptedAuthKey` function (`app/utils.js:722-731`) or wire it
   up for real — currently dead weight that also reads as false security.
10. Add `npm run build` (or equivalent) to the GitHub Actions deploy job before `pm2 restart`
    (`.github/workflows/node.js.yml`), or document why it's intentionally omitted.

## 19. Open questions

1. Does the backend (hemp-backend) independently verify session ownership on member-scoped
   routes (e.g. `/api/v1/member/:id`), or does it trust the static `X-API-KEY` as sufficient
   authorization? This repo's code cannot answer that — it's the single highest-priority
   question raised by this audit (§14, Critical).
2. Is the SSH/pm2 deploy in `.github/workflows/node.js.yml` still the real production deploy
   path, or has it been superseded by something not committed to this repo (Vercel, a
   different CI)? The branch it triggers on (`new-ui-design-development`) suggests it may be
   stale.
3. Are the hardcoded tax rates (`app/utils.js:363-365`) actually correct for every
   store/region this app currently serves, or is this a known gap already covered by a
   server-side recalculation at order placement that the frontend's number is never trusted
   for?
4. Was `@sentry/nextjs` ever wired up and then removed, or was it added to `package.json` and
   never finished? Worth knowing before assuming "add Sentry" is greenfield work.
5. Is there a reason two independent ID-verification vendors (Persona and Didit) are both
   integrated, or is one meant to be retired?
