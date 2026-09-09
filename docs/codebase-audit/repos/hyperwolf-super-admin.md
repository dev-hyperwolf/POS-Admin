# hyperwolf-super-admin — Codebase Audit

Repo: `/Users/jt/hyper-tech/hyperwolf-super-admin` @ `c1d9cbd` (verified: `git rev-parse HEAD` matches).
Mechanical metrics: `/Users/jt/POS-Admin/docs/codebase-audit/metrics/hyperwolf-super-admin.md` (read
and spot-verified; corrections noted inline where its regex leads were wrong or incomplete). Full
field-level data (all 60 Redux slices, all 59 API-wrapper files, route inventory) is in the
companion `hyperwolf-super-admin.datamodel.md`.

## 0. Answering the assignment directly: what inflates this repo

The repo is 1,203 source files / 296,940 lines. Five categories account for roughly a third of
that, and they are not "one big app" — they are five different kinds of bloat stacked on top of
each other:

| Category | Lines (verified) | % of 296,940 | Evidence |
|---|---|---|---|
| Vendored third-party admin template (Creative Tim "Material Dashboard 2 React") checked in as first-party source | ≥8,236 (`src/examples/` 6,837 + `src/components/MD*` 1,399) plus most of `src/assets/theme*` (not separately counted) | ~2.8%+ | `src/examples/Sidenav/index.js` carries the literal "Material Dashboard 2 React" / Creative Tim header comment; identical files exist byte-for-byte in sibling repo `hemp-retailer-admin` (see §12) |
| Duplicated page-builder trees: `homePage/` (dashboard's "Home" content builder) vs `landingPage/` (near-identical "Landing" content builder) | 37,151 (`src/components/homePage/` 19,526 + `src/components/landingPage/` 17,625) | 12.5% | `diff src/components/homePage/createHome/sections/category-section.jsx src/components/landingPage/createLanding/sections/category-section.jsx` → 207 diff lines out of 9,879/9,862 — ~98% identical; same pattern across `content-section.jsx`, `faq-section.jsx`, `customer-review.jsx`, `fav-delivery-section.jsx`, `index.jsx`/`viewHome`/`viewLanding` |
| Per-brand parallel component/layout trees for "hyperwolf mode" duplicating the generic (hemp/stilo) tree instead of parameterizing by brand | ≥35,011 (`src/layouts/hyperwolf/` 31,897 across 84 files + `src/components/hyperwolf/` 3,114 across 6 dirs) | ~11.8% | e.g. `src/redux/slices/orders.js` and `src/redux/slices/hyperwolf/orders.js` are structurally identical slices (`orders:[]`, `isLoading`, `error`, `order:{}`) with separate thunks (`fetchOrders` vs `fetchHyperwolfOrders`) instead of one parameterized slice; `src/layouts/hyperwolf/userAndRoles/components/roles.jsx` / `users.jsx` are byte-identical (0-line diff), 321 lines each |
| Generated/vendored static geo data shipped as JS source (not JSON, not fetched) | 19,163 | 6.5% | `src/utilities/common/Cities.js` — one `export const cities = [...]` array (full US state→city→lat/long dataset), imported into the client bundle |
| Committed production build artifact | 13,072,726 bytes compressed / ~59 MB uncompressed, 122 files (not counted in the 296,940 source-line figure — it's binary) | n/a (repo weight, not LOC) | `build.zip` at repo root, tracked in git (`git show HEAD --stat -- build.zip`); `.gitignore` excludes `/build` (the directory) but not `build.zip` — see §8/§14 for the secrets baked into it |

Sum of the four LOC-countable categories: **~99,561 lines, ~33.5% of the repo's source lines**,
before counting further brand forks that were sampled but not exhaustively measured (e.g.
`AddProduct.jsx` 1,003 lines vs `AddStiloProduct.jsx` 1,338 lines, 491 diff lines — a genuine fork,
not a pure duplicate, so excluded from the total above; `src/layouts/promo/data.js` at 4,504 lines
is a hand-written IF/THEN rule-config data file, not vendored/generated — also excluded).

This is not "one 297k-line application." It is roughly: a ~14k-line vendored UI kit, a ~37k-line
duplicated page-builder feature, a ~35k-line duplicated brand tree, a 19k-line static data file
that has no business being client-side JS, a 13 MB build artifact that should never have been
committed, plus cross-repo duplication with `hemp-retailer-admin` (§12) on top of all of that.

## 1. Purpose

A single-page React admin console used to operate four related consumer brands from one codebase:
**Hyperwolf**, **Hemp**, **Stilo** (all e-commerce/delivery storefronts), and **Hyperdrive**
(delivery/dispatch). Confirmed from code, not README: `src/routes.js` exports three separate route
arrays — `hyperfwolfAdminRoutes` (line 1254), `hyperfDriveAdminRoutes` (line 2733), `stiloRoutes`
(line 2769) — selected at runtime by `REACT_APP_MODE`/`adminsMode` (localStorage), and
`src/axiosClient/index.js` instantiates five separate Axios clients pointed at five separate
backend base URLs (Hyperwolf, Hyperwolf-dev/driver, Hemp-dev, Stilo, Distribution, Hyperdrive,
Promotions — 7 base URLs across 6 client files in `src/axiosClient/`). It calls out to Google
Maps/Places, Mapbox, HERE Maps, Firebase (Cloud Messaging + Analytics), Sentry, and a Socket.IO
distribution service (`src/socket.js:4`). It is called only by the humans who use it in a browser —
there are no inbound integrations into this repo (it is pure frontend, no server).

## 2. Runtime & framework

- **No Node version pinned anywhere**: no `engines` field in `package.json`, no `.nvmrc`, no
  Dockerfile in the repo. README claims "Node.js LTS (developed/verified with Node v20)" but that
  is a README claim with no enforcement — nothing in CI or `package.json` checks it.
- **No lockfile committed** (`package-lock.json`/`yarn.lock` absent — metrics confirmed, and
  `.gitignore` does not exclude it, it's simply not there). Combined with 106 caret-pinned deps out
  of 126 total, this means `npm install` on two different days can resolve two different dependency
  trees. This is the single biggest "why won't it build" risk in the repo.
  Also `npm run install:clean` script (`package.json:122`) deletes `package-lock.json` on every
  clean install, which is consistent with — and probably why — no lockfile is ever committed.
- **React 18.2.0** (exact-pinned), React Router 6.11.0, Redux Toolkit 2.6.0 alongside legacy
  hand-written `redux`/`react-redux` slices (two competing state layers, see §5).
- **Not TypeScript.** Zero `.ts`/`.tsx` files; `jsconfig.json` exists but is unused for type
  checking (no `tsc` script, no `// @ts-check`).
- **Fully ejected Create React App**, not `react-scripts`. `package.json` has no `react-scripts`
  dependency; `scripts/start.js`, `scripts/build.js`, `scripts/test.js` and the entire `config/`
  directory (`config/webpack.config.js`, `config/webpackDevServer.config.js`, `config/env.js`,
  `config/jest/*`) are a hand-copied, hand-maintained fork of CRA's internals. CRA/`react-scripts`
  itself is a discontinued tool (no longer maintained by its authors) — this repo has taken on the
  burden of maintaining that toolchain forever, with zero upstream security patches, and nothing in
  the repo documents that this was a deliberate choice.
- Test runner is Jest 27.4.3 (2021-era; current major is 29+) via `scripts/test.js`, itself an
  ejected-CRA fork of `react-scripts test`.
- 111 prod deps + 17 dev deps declared; **40 of the 111 are declared but never imported anywhere**
  (metrics-verified, spot-checked `openai`, `msal`, `jszip`, `daterangepicker`, `@sentry/browser`,
  `react-date-range` via `grep -arl` — all confirmed absent from any `import`/`require` in `src/`
  except `react-date-range`'s CSS, which is imported in `src/index.js:7-8` for side effects only,
  no component uses the library). That's over a third of the dependency tree being dead weight that
  still gets resolved and (for some) bundled.

## 3. Entry points & boot

`src/index.js` is the entry: creates the React root on `#app` (`src/index.js:12-13`), wraps the
tree in `Sentry.ErrorBoundary` → `BrowserRouter` → Redux `Provider` (`src/index.js:31-37`). Sentry
is initialized unconditionally whenever `NODE_ENV !== 'development'` (`src/index.js:18-25`) —
meaning any local `NODE_ENV=production` build (e.g. `npm run build` run locally by a developer)
reports to the real Sentry project. No environment tag differentiates stage vs a developer's
laptop build beyond `NODE_ENV` itself.

`src/App.js` (837+ lines, only partially read) does the real boot work in a `useEffect`: reads
`adminsMode` from localStorage, dispatches `fetchCategories`/`fetchBrands`/`fetchAllRegions`/
`fetchInfoEffect` unconditionally on every mount depending on brand mode (`src/App.js:100-113`),
wires a Firebase Cloud Messaging `onMessage` listener, and renders one of three route trees
(`routes`, `hyperfwolfAdminRoutes`, `hyperfDriveAdminRoutes`) based on that same `adminsMode` value.
`src/App.js:477` does `window.google = null` — a global mutation used to force the Google Maps
script loader to re-initialize; brittle if any other component also touches `window.google`.

Client-side auth gating: `src/HOC/PrivateRoutes.jsx` and `src/HOC/PublicRoute.jsx` both call
`isLoggedIn()` (`src/utilities/common/index.js:260-263`), which just checks
`JSON.parse(getData('login-user-info')).access_token` truthiness — no expiry check, no token
verification, purely "is there a token-shaped object in localStorage." `PublicRoute.jsx` also
contains real business logic (resolving which of 4 brand-permission arrays to route an already
logged-in user to) inside what is nominally a route guard — mixing routing and permission-resolution
concerns in one file (`src/HOC/PublicRoute.jsx:8-40`).

No multi-connection pattern (that's a backend concept) — the frontend equivalent is the 6-file,
7-base-URL `axiosClient/` split (§6).

## 4. Directory map

| Dir | Files | Lines | Real role |
|---|---|---|---|
| `src/components/` | 241 | 116,873 | Feature UI, including the 37k-line homePage/landingPage duplicate (§0) and the 3.1k-line hyperwolf-brand fork |
| `src/layouts/` | 278 | 88,425 | Route-level pages (one per nav item), including the 31.9k-line `layouts/hyperwolf/` brand-parallel tree |
| `src/utilities/` | 4 | 23,129 | Grab-bag: `common/index.js` (3,750 lines, god-file — everything from CSV export to AES key generation to hardcoded GPS fixtures, see §11), `common/Cities.js` (19,163 lines, static geo data), `constants.js`, `permissionsV2.js` (82 lines) |
| `src/common/` | 285 | 21,577 | Shared modals/tables/icons (`CommonModal/`, `CustomTable.js` — also cross-repo duplicated, §12) |
| `src/redux/` | 120 | 19,771 | Classic Redux Toolkit: 60 slices + 59 API-wrapper files (full inventory in `.datamodel.md`) |
| `src/examples/` | 62 | 6,837 | **Vendored** Creative Tim "Material Dashboard 2 React" template components (Sidenav, Navbars, Charts, Cards) — not app-specific |
| `src/assets/` | 137 | 6,185 | Theme (mostly template theme from the same vendored kit), images, fonts |
| `src/validations/` | 38 | 3,078 | Yup schemas |
| `src/prompt/` | 1 | 1,536 | A single file — likely an LLM prompt template (matches the unused `openai` dependency, see §13) |
| `src/axiosClient/` | 6 | 546 | 7 Axios instances / base URLs, one per backend service |
| `src/contexts/`, `src/HOC/`, `src/Rtk/`, `src/hooks/`, `src/services/` | 9 combined | 514 | Route guards, one competing RTK-Query slice (`src/Rtk/`, 2 files, seemingly unused/half-migrated — see §5), one context provider |
| `src/styles/`, `src/heremapStyle/` | 0 | 0 | Empty directories, tracked in git for no reason found |
| `config/`, `scripts/` | — | — | Hand-maintained ejected-CRA build toolchain (§2) |
| `build.zip` (root) | 1 file | n/a | 13 MB committed production build artifact with baked secrets (§0, §8, §14) — should not exist in the repo at all |

## 5. Data model summary

There is no server-side data model in this repo (frontend only). The frontend equivalent — Redux
state — is fragmented across **two competing state layers**:

1. **Classic Redux Toolkit** (`src/redux/store.js`, 137 lines): 60 `createSlice` slices combined
   into one store. Every slice follows the same hand-written pattern: `{ data, loading/isLoading,
   error }` plus ad hoc extra fields, with `createAsyncThunk` for every API call and manual
   `pending/fulfilled/rejected` cases repeated per-slice (no shared abstraction — see §12 for how
   often this exact boilerplate repeats).
2. **Redux Toolkit Query**, used in exactly one place: `src/Rtk/Services/user.js` +
   `src/Rtk/slices/user/userSlice.js` (2 files, 64 lines total). This looks like an abandoned
   migration — `src/index.js:10` has the old store import live and a commented-out
   `// import { store } from './Rtk/Store'` (`src/index.js:10`) with no `Rtk/Store.js` file present
   in the repo, meaning that commented import doesn't even resolve if uncommented.

**10 most-touched slices** (by size/centrality, from `src/redux/store.js` imports and API-call
volume): `orders` (+ its `hyperwolf/orders` twin), `products` (+ `hyperwolf/products`), `member`/
`memberships`, `inventory`, `brand`, `region`/`regions` (+ `hyperwolf/driver/regions`, a third
copy), `common` (global UI + brand-mode state), `promotions`, `strain`/`hyperwolf/strains`,
`roleAndPermissions`. Every one of the brand-paired slices (`orders`/`hyperwolf/orders`,
`driverHemp`/`hyperwolf/driver/driver`, `driverApproval`/`hyperwolf/driver/approvals`) has the same
shape and near-identical reducer bodies — this is the Redux-layer symptom of the brand-duplication
problem in §0/§12, not independent data modeling.

- **IDs**: Mongo ObjectId strings passed through as opaque strings everywhere; no client-side ID
  type/validation.
- **Enums**: hand-written arrays of `{key, value}` objects scattered in `utilities/common/index.js`
  (e.g. `orderStatus` at `src/utilities/common/index.js:273`) rather than centralized or generated
  from a shared contract with the backend — a mismatch here (e.g. backend renames a status key)
  fails silently in the UI (unmatched key just doesn't render a label).
- **Money**: no dedicated money type sampled in the redux layer — price fields flow through as
  whatever the API returns (`grep` for a slice-level "price"/"amount" field found none in
  `initialState`; money lives inside opaque `action.payload` objects passed straight to the UI, so
  Number-vs-String and cents-vs-dollars conventions are whatever each backend returns, unverified
  from this repo alone).
- **Timestamps / soft-delete / multi-tenancy**: not modeled client-side at all — these are backend
  concerns; the frontend just renders whatever fields the API sends.
- **Response envelope is inconsistent slice-to-slice**: some reducers do
  `state.data = action.payload` directly (`src/redux/slices/regions.js:1929`), others unwrap one
  level (`state.regionDetails = action.payload.regionDetails`,
  `src/redux/slices/hyperwolf/driver/regions.js:981`), others unwrap two levels
  (`state.order = action.payload.data.orderDetails`, `src/redux/slices/hyperwolf/orders.js:1202`).
  A new developer cannot predict the shape without opening the specific API function.

Full slice-by-slice table (all 60 + the 2 RTK-Query files) is in `.datamodel.md`.

## 6. API surface

Not a server — "routes" here means the 384 `route:`-keyed entries across the three exported route
arrays in `src/routes.js` (verified count via `grep -ac "route:" src/routes.js`; the metrics file's
`route: 0` line is wrong — it was grepping for a backend `router.` pattern that doesn't exist in a
frontend repo, and its own JSON correctly lists 0 Next.js routes because this isn't a Next app).

- **Auth mechanism**: Bearer token (`access_token`) attached via Axios request interceptor
  (`src/axiosClient/index.js:21-32`), read fresh from `localStorage['login-user-info']` on every
  request. Token is never verified or decoded client-side, never refreshed proactively — a 401
  response interceptor just does `window.location.href = '/login'; localStorage.clear()`
  (`src/axiosClient/index.js:41-47`). No visibility from this repo into signing algorithm/expiry —
  that lives in the backend repos.
- **Role checks**: role/permission data is an array of permission objects
  (`hwPermissions`/`hempPermissions`/`stiloPermissions`/`hyperdrivePermissions`) stored under
  `localStorage['login-user-info'].permissions` and re-derived client-side in
  `src/utilities/permissionsV2.js` and `src/HOC/PublicRoute.jsx:19-40`. This is UI-gating only —
  there is no re-verification against the server per action visible in this repo; a user who edits
  localStorage directly can unlock UI for brands/features they don't have permission for (whether
  the backend independently enforces this is out of scope for this repo, but nothing here assumes
  it does).
- **Input validation**: Yup (`src/validations/`, 38 files, 3,078 lines) — used per-form, not
  centrally enforced; no schema is shared with/generated from the backend.
- **Pagination**: `getQueryString()` helper (`src/utilities/common/index.js:53`) turns a filter
  object into a query string; call sites pass ad hoc `skip`/`limit` values (e.g.
  `dispatch(fetchCategories({ skip: 0, limit: 1000, ... }))`, `src/App.js:105/110`) — no shared
  pagination component/hook, `limit: 1000` hardcoded as a "fetch everything" pattern in multiple
  places (performance risk, §15).
- **Error response shape**: inconsistent — thunks do `rejectWithValue(error.response?.data)`
  (e.g. `src/redux/slices/orders.js:13`), so the shape stored in `state.error` is whatever the
  calling backend returned for that specific endpoint; no repo-wide normalized error shape.
- **Versioning**: path-based (`/api/v1/...`) per backend, e.g.
  `src/redux/apis/terpenoids.js:5` — consistent within each backend, not a cross-cutting concern
  here.
- **API base URL selection**: `process.env.REACT_APP_*_BASE_URL` per brand/service, baked in at
  build time (CRA convention) — meaning **switching environments requires a rebuild**, not a
  runtime config change. Combined with the committed `build.zip` (§8), old base URLs and keys are
  frozen into that artifact forever.
- **Auth token storage**: `localStorage`, plaintext JSON, unencrypted (`login-user-info` key) —
  see §14 for the XSS-to-token-theft implication given 134 `dangerouslySetInnerHTML` call sites.
- **SSR vs CSR**: pure CSR (client-side rendered SPA via `react-dom/client` + `BrowserRouter`); no
  server-rendering anywhere in this repo.

## 7. Background jobs

None — this is a browser SPA with no server process. The closest equivalents are client-side
polling intervals, covered in §15 (Performance) since that's the more relevant lens for a frontend:
8 `setInterval` call sites (`src/components/hyperdrive/mapDriverList.js:128`,
`src/components/notifications/NotificationCardHyperdrive.jsx:117`,
`src/components/notifications/OrderNotificationCard.jsx:36`, plus 5 more — full list in metrics
JSON), none of which are cleared on component unmount in the two I checked in depth
(`mapDriverList.js`, `OrderNotificationCard.jsx`) beyond a bare `clearInterval` in the `useEffect`
cleanup — verified present in both, so this specific "can it overlap/leak" question is: no leak
found in the two sampled, not measured for the other six.

## 8. Third-party integrations & secrets

| Integration | Wrapper file | Credential source | Notes |
|---|---|---|---|
| Google Maps / Places | `src/App.js` (script tag), `utilities/constants` | `REACT_APP_GOOGLE_KEY`, `REACT_APP_GOOGLE_PLACES_KEY` (env, baked at build) | **Two live Google API keys found embedded in the committed `build.zip`'s main JS bundle** (kind: Google API key, format `AIzaSy...`) — not quoting the values per the hard rule; verified via `unzip -p build.zip build/static/js/main.*.js \| grep -ao "AIzaSy..."`. These are permanently in git history now regardless of any future `.env` rotation. |
| Mapbox GL | not isolated to one wrapper file — used directly where needed | `REACT_APP_MAP_KEY_TOKEN` | **A Mapbox public access token found embedded in the same `build.zip` bundle** (kind: Mapbox `pk.` token). Mapbox public tokens are meant to be client-exposed, but a committed *build artifact* baking one in still means URL-restriction changes never retroactively protect the old artifact. |
| HERE Maps | `src/heremapStyle/` (empty dir — style presumably inline), map components | `REACT_APP_MAP_KEY` | Not independently verified beyond the env var reference in README |
| Firebase (Cloud Messaging + Analytics) | `src/firebaseInit.js`, `firebase-messaging-sw.js` | `REACT_APP_API_KEY`/`REACT_APP_AUTH_DOMAIN`/etc. (6 env vars) | Firebase web config is meant to be public (it's not a secret by Google's own model), but it too is now frozen into `build.zip` — kind: Firebase project config, confirmed present in the bundle (`grep -ao "firebase"` hit) |
| Sentry | `src/index.js:18-25` | `REACT_APP_PUBLIC_SENTRY_DSN` | DSN found referenced in the bundle (kind: Sentry DSN string, `sentry.io` substring matched); Sentry DSNs are designed to be public but again now permanently in the bundle |
| Socket.IO (Distribution service) | `src/socket.js` | `REACT_APP_DISTRIBUTION_API_BASE_URL` | `withCredentials: false` (`src/socket.js:9`) — no auth token attached to the socket connection at all, `HOC/useSocket.jsx:19` even has the token-attach line commented out (`// socket.auth = { token };`) |
| Metrc (compliance) | `src/App.js` (referenced), `layouts/Metrc` | `REACT_APP_METRC_ACCESS_1`/`_2` | Two Metrc credentials as separate env vars — not verified whether these are user/password or API keys, not present in `.env.example` per README's own table gap list |
| AES encryption (custom, not a vendor) | `src/utilities/common/index.js:814-819` | `REACT_APP_API_AUTH_KEY` used as *plaintext* AND as the thing being encrypted, `REACT_APP_AUTH_PHRASE_KEY` as the passphrase | **`CryptoJS.mode.ECB`** — ECB is a known-weak block cipher mode (no IV, identical plaintext blocks → identical ciphertext blocks, pattern leakage). See §14. |

30 of 56 referenced env vars are documented in `.env.example`; 26 are CRA build-tooling vars
(`GENERATE_SOURCEMAP`, `FAST_REFRESH`, `WDS_SOCKET_*`, etc.) that don't need app-level docs, but a
few real ones are missing from the example file per the metrics scan: `REACT_APP_X_AUTH_TOKEN`,
`REACT_APP_HYPERWOLF_FRONTEND_URL`... (README's own table documents these, so the gap is
`.env.example` being stale relative to README, not a mystery — but it means a fresh clone following
`.env.example` alone will be missing working env vars).

**No secret value is reproduced above or anywhere in this report — only file location and kind, per
the audit's hard rule.**

## 9. Tests

Zero. `test files: 0, test lines: 0` (metrics, and independently confirmed: no file under
`src/**/__tests__/` or matching `*.spec.*`/`*.test.*` exists — `jest` config's own `testMatch`
patterns in `package.json:183-185` have nothing to match). `npm test` runs `scripts/test.js`, an
ejected-CRA Jest launcher wired to run whatever matches those patterns — currently nothing, so
`npm test` "passes" instantly having tested zero lines of the 296,940. `.github/workflows/linting.yml`
(name: "Linting Audit") does not run `npm test` either (confirmed by reading the workflow file — it
detects project type and presumably lints, not test-runs; full test-execution step absent).

## 10. Build & deploy

`npm run build` → `scripts/build.js` (ejected CRA build script) → static bundle in `build/`.
`.github/workflows/stage.yml` ("Hemp Github CI") is the only deploy path found:
- Triggers on `workflow_run` completion of the "Security Audit" workflow
  (`.github/workflows/stage.yml:2-5`) — **but has no `if: github.event.workflow_run.conclusion ==
  'success'` guard anywhere in the file** (verified: `grep -n "conclusion\|if:"` on the file
  returned nothing). This means a **failing security scan does not block deployment** — the deploy
  job fires on any completion of that workflow, pass or fail.
- Deploys via raw SSH (`appleboy/ssh-action`) as `root` to a hardcoded IP
  (`host: "54.81.94.241"`, `.github/workflows/stage.yml:14`), running
  `git pull origin feature/distribution-tasks` (a **feature branch, not `main`**, hardcoded into the
  stage pipeline — `.github/workflows/stage.yml:20`), then `npm i && npm run build --cache` directly
  on the box (`.github/workflows/stage.yml:21-22`). No lockfile (§2) means this `npm i` on the
  server can resolve different versions than whatever a developer tested locally. No rollback step,
  no health check after build, no build-artifact promotion (build happens in place on the target
  host).
- No `.env`/environment-separation mechanism visible in the repo beyond `.env.example` and
  whatever file actually lives on `54.81.94.241` (not accessible from this audit).
- `security.yml` exists as a separate workflow (its content not fully read here — noted as present,
  its findings/enforcement not independently verified beyond confirming stage.yml doesn't gate on
  it).
- No Dockerfile, no containerization anywhere in the repo.

## 11. Hardcoded values

Counts from the metrics pass, spot-verified:

1. **`http_url`**: 121 hits / 54 files. Worst: `src/components/homePage/viewHome/index.jsx` (10),
   `src/utilities/common/index.js` (7).
2. **`role_string`**: 104 hits / 72 files — role/permission strings compared by literal value
   scattered through components instead of a central role-constants module; worst:
   `src/layouts/manageCategories/index.jsx` (4), `src/layouts/orders/index.jsx` (4), `src/App.js`
   (3, at lines 105/109/112).
3. **`objectid_24hex`**: 399 hits / 6 files, **392 of them in one file**:
   `src/utilities/common/index.js`. Verified this is almost entirely one hardcoded fixture array,
   `routeMap` (`src/utilities/common/index.js:1065` onward, ~130 lines of fake driver GPS
   coordinates with realistic-looking `taskId`/`fleetId` ObjectIds) — and it is **dead code**: the
   only two components that take a `routeMap` prop (`src/components/hyperdrive/calculateMap.js`,
   `src/components/hyperdrive/calculateMap(HereMap).js`) get it as a prop from a parent, and the
   import from `utilities/common` is explicitly commented out in the HERE-map variant
   (`calculateMap(HereMap).js:7`, `// import { routeMap } from 'utilities/common';`). Nothing in the
   live codebase imports and uses this export — verified with a repo-wide grep for
   `routeMap` outside `utilities/common/index.js` and `permissionsV2.js`'s unrelated same-named
   local const.
4. **`email_literal`**: 17 hits / 2 files — `src/utilities/common/index.js` (14),
   `src/layouts/billing/components/BillingInformation/index.js` (3, lines 26/32/38).
5. **`phone_literal`**: 13 hits / 3 files — `src/utilities/common/index.js` (11).
6. **`store_name_literal`**: 7 hits, all in `src/utilities/common/Cities.js` — should be data
   (this one genuinely is data, just in the wrong format/location, see §0).
7. Static geo dataset **`Cities.js`** (19,163 lines) — should be JSON fetched from an endpoint or a
   build-time-generated static JSON asset, not hand-maintained JS source shipped to every client.
8. Hardcoded EC2 IP in CI: `54.81.94.241` (`.github/workflows/stage.yml:14`) — should be a GitHub
   secret/variable.
9. Hardcoded branch name in CI: `feature/distribution-tasks` (`.github/workflows/stage.yml:20`) —
   should be `main`/a release branch, or at minimum a workflow input.
10. `localhost`/`ip_literal`: 4 hits total, confined to `config/` dev-server files — low risk,
    dev-only.

Distinguishing "should be config" vs "should be data": the CI IP/branch and the role strings should
be config (they change per environment/feature). Cities.js and the dead `routeMap` fixture should be
data (they're already shaped like data, they're just embedded as source).

## 12. Duplicated code

**Inside this repo:**
- `src/layouts/hyperwolf/userAndRoles/components/roles.jsx` and `.../users.jsx` — **byte-identical**
  (0-line diff), 321 lines each, and **neither is imported anywhere in the repo**
  (`grep -arln "components/roles\b\|components/users\b" src` outside their own directory returns
  nothing) — dead, duplicated code. Delete both (§18).
- `src/components/homePage/*` vs `src/components/landingPage/*` — 37,151 combined lines, ~98%
  identical in the sampled `category-section.jsx` pair (§0). Same duplication pattern repeats across
  `content-section.jsx`, `faq-section.jsx`, `customer-review.jsx`, `fav-delivery-section.jsx`, and
  the top-level `viewHome/index.jsx` (4,323 lines) vs `viewLanding/index.jsx` (4,142 lines) — not
  diffed line-by-line here (out of scope for the time budget) but same directory-structure mirror.
- `src/redux/slices/hyperwolf/driverApproval.js` and
  `src/redux/slices/hyperwolf/driver/approvals.js` — two files, same exported reducer variable name
  (`driverApprovalSlice`), same state shape (`approvals: []`, `loading`, `error`, `pendingCount: 0`),
  same `pendingCount` computation
  (`action.payload.data.data.filter(a => a.notificationStatus === 'pending').length`) against two
  differently-named thunks (`fetchDriverApprovalsHemp` vs `fetchDriverApprovals`) — a copy-paste
  brand fork at the Redux layer, mirroring the component-layer brand duplication.
- `src/components/hyperwolf/products/productTraits/SelectProductTrait.jsx` (hyperwolf-brand copy) vs
  `src/components/products/productTraits/selectProductTrait.jsx` (generic) — 190 diff lines, a
  genuine partial fork rather than a pure copy, same pattern as `AddProduct.jsx`/
  `AddStiloProduct.jsx` (491 diff lines out of ~1,000-1,338).
- `src/layouts/hyperwolf/` (84 files, 31,897 lines) largely re-implements features that already
  exist generically at `src/layouts/{products,orders,members,brands,regions,strains,...}` — this is
  the single largest structural duplication in the repo (§0) and it is not a byte-identical
  copy-paste in most cases, it's independently-maintained parallel logic for the same features,
  which is worse: bug fixes applied to one brand's version routinely will not reach the other.

**Cross-repo** (verified against `/Users/jt/POS-Admin/docs/codebase-audit/metrics/CROSS-REPO-DUPLICATES.md`,
which already lists this repo's pairs — spot-checked several, not re-diffed from scratch):
- **`hemp-retailer-admin` ↔ `hyperwolf-super-admin`: 4,146 lines byte-identical**, entirely the
  vendored Creative Tim template (`src/examples/Charts/*`, `src/components/MD*`) plus several
  first-party files that should have been extracted to a shared package instead of copy-pasted:
  `src/redux/slices/memberships.js` (171 lines, identical), `src/redux/slices/hyperwolf/driver/regions.js`
  ↔ `hemp-retailer-admin:src/redux/slices/regions.js` (163 lines), `src/redux/slices/faq.js` (78
  lines), `src/components/MDPagination/index.js`, `src/components/MDBox/index.js`.
- A further ~40+ file pairs at 0.97–1.00 similarity (not byte-identical, but near-copies) between
  the two repos, including `src/common/CommonModal/member/BanMemberModal.jsx` (1.00),
  `src/common/CustomTable.js` (1.00), `src/layouts/rolesPermissions/RolesPermission.jsx` (0.98),
  `src/redux/slices/inventory.js` (0.98), `src/components/inventory/addInventoryForm.js` (0.97).
  This strongly suggests `hyperwolf-super-admin` and `hemp-retailer-admin` were forked from a common
  starting point (or from each other) and have been diverging ever since with no shared package to
  pull fixes from one into the other.
- Smaller overlap with `hemp-frontend-nextjs`: 110 lines (`commitlint.config.js` — tooling config,
  low-stakes duplication).

## 13. Dependency risk

- **40 of 111 prod deps declared but never imported** (§2) — dead weight in `node_modules` install
  time and in anyone's mental model of "what does this app actually use."
- **Two competing date libraries in active use simultaneously**: `moment` imported in 33 files,
  `dayjs` imported in 29 files (`grep -arl` counts). `moment` itself is in maintenance mode
  (upstream declares it a legacy project, "please consider other options for new projects") — this
  repo is both using it heavily *and* already mid-migration to `dayjs`, so it's paying the bundle
  cost of both.
- **`moment-timezone`** declared alongside `date-fns-tz` (declared-but-unused per §2's list) — two
  timezone libraries where the app only needs one.
- **CRA/`react-scripts` is a discontinued upstream tool** and this repo has fully ejected + forked
  it (§2) — every future CVE in the fork's own transitive deps (`webpack`, `babel-loader`,
  `terser-webpack-plugin`, etc., all still declared) is now this team's problem to patch manually,
  with no upstream to pull fixes from.
- **Jest 27** (2021) vs current major 29+ — not itself exploitable (dev-only), but blocks adopting
  newer testing patterns/matchers if tests are ever added.
- `msal` (Microsoft auth library, ^1.4.18) declared but unused, and the *actual* auth slice is
  imported under the misleading alias `msalReducer` in `src/redux/store.js:2`
  (`import msalReducer from './slices/authSlice';`) — pure naming confusion, no functional risk, but
  it means grepping for "msal" to find the real auth code fails.
- `openai` (^5.3.0) declared but unused, paired with an orphaned 1,536-line `src/prompt/` file —
  looks like an abandoned AI-feature attempt; not wired into any component that imports `openai`.
- No `npm audit`/Dependabot/Snyk config found in the repo (`.github/workflows/security.yml` exists
  and is named for this purpose, but its actual checks were not read in depth for this pass — flag
  as "not fully verified" rather than claiming it does or doesn't cover dependency CVEs).

## 14. Security findings

1. **Critical** — **Live third-party API keys and tokens baked into a build artifact that is
   committed to git and will remain in git history forever.** `build.zip` (repo root) contains a
   production JS bundle with a Google Maps/Places API key (kind: `AIzaSy...`-format Google API
   key, ×2 distinct keys), a Mapbox public token (kind: `pk.`-format Mapbox token), and Firebase
   web config + Sentry DSN. Fix: remove `build.zip` from the repo (`git rm` won't purge history —
   this needs a history rewrite, e.g. `git filter-repo`, coordinated with anyone else who has
   clones), add `*.zip`/`build.zip` to `.gitignore`, and rotate the Google Maps key at minimum
   (restrict it or reissue — Google API keys, even client-side ones, are commonly abused for
   billing-fraud if unrestricted; whether these specific keys are domain-restricted was not
   verified from this repo).
2. **High** — **`CryptoJS.AES.encrypt(..., { mode: CryptoJS.mode.ECB })`**
   (`src/utilities/common/index.js:815-817`). ECB mode has no IV and leaks plaintext structure
   (identical plaintext blocks → identical ciphertext blocks); it is considered broken for anything
   beyond trivial obfuscation. Fix: use `CBC` or `GCM` mode with a random IV, or better, stop
   encrypting an API key client-side at all (see finding 3).
3. **High** — the thing being "encrypted" in finding 2 is `process.env.REACT_APP_API_AUTH_KEY`
   itself, encrypted with `process.env.REACT_APP_AUTH_PHRASE_KEY` as the passphrase
   (`src/utilities/common/index.js:815-816`) — **both values ship in the client bundle**, so this
   buys no real confidentiality; anyone can extract the encryption key from the same bundle and
   decrypt the "protected" value, or just read `REACT_APP_API_AUTH_KEY` before it's encrypted since
   it's already in the bundle as a literal. This is security theater, not a control.
4. **High** — **auth token stored in plaintext `localStorage`**
   (`src/utilities/common/index.js:20-25`, key `login-user-info`, read in
   `src/axiosClient/index.js:23-25`) **combined with 134 `dangerouslySetInnerHTML` call sites across
   27 files** (metrics-verified; worst offenders `LabTestingStandardsDetail.js` (10),
   `SameDayDeliveryPageDetail.js` (9), `CareerDetail.js` (7)) **and zero sanitization library in
   dependencies** (`grep -a "dompurify\|sanitize-html\|xss" package.json` → no matches). Any stored
   XSS via one of those 134 sinks — e.g. rich-text content authored by a lower-privileged admin and
   rendered back to a higher-privileged one via `formData?.heroSection?.heroSectionPara`
   (`src/components/homePage/viewHome/index.jsx:871`) — can read `localStorage` and exfiltrate the
   bearer token directly, no cookie/httpOnly protection in the way. Fix: move the token to an
   httpOnly cookie set by the backend (bigger change), or at minimum add DOMPurify sanitization at
   every `dangerouslySetInnerHTML` call site as a stopgap.
5. **Medium** — **CI deploy is not gated on the security-scan workflow's result**
   (`.github/workflows/stage.yml`, §10) — a failing `security.yml` run does not stop `stage.yml`
   from deploying. Fix: add `if: github.event.workflow_run.conclusion == 'success'` to the deploy
   job.
6. **Medium** — client-side-only authorization (§6): permission arrays live in `localStorage` and
   are trusted by the UI with no re-check; whether the backend independently enforces per-endpoint
   permissions is outside this repo, but nothing here assumes it must, and the UI will happily
   render brand/feature screens for a user who edits their own localStorage.
7. **Low** — Socket.IO connection carries no auth (`src/socket.js:6-9`, `withCredentials: false`,
   and `src/HOC/useSocket.jsx:19` has the token-attach line dead-commented) — depends entirely on
   the Distribution backend not trusting anything from this socket for anything sensitive, which
   was not verifiable from this repo.
8. **Low** — `Sentry.init` runs whenever `NODE_ENV !== 'development'` with no separate staging vs
   production environment tag beyond `NODE_ENV` itself (`src/index.js:18-25`) — a developer building
   locally with `NODE_ENV=production` (e.g. to reproduce a prod-only bug) will report real events
   into the shared Sentry project indistinguishable from real production traffic.

No IDOR/injection/mass-assignment/CORS/unsigned-webhook findings — those are backend concerns and
this repo has no backend.

## 15. Performance findings

1. **`limit: 1000` "fetch everything" pattern repeated across dispatch calls**, e.g.
   `src/App.js:105/108/110` (`fetchCategories({ skip: 0, limit: 1000, userType: 'admin' })`,
   `fetchBrands({ skip: 0, limit: 1000, ... })`, `fetchAllRegions()`) fired unconditionally on every
   app mount regardless of which screen the user lands on. This is the frontend equivalent of an
   unbounded `find({})` — it's a network-and-memory cost paid on every load whether or not the user
   ever visits Categories/Brands/Regions.
2. **298 `find`-without-limit-style hits / 103 files** (metrics label `find_without_limit`) — for a
   frontend this metric is a weaker signal (it's mostly Array `.find()`, not DB queries), spot check
   of `src/App.js:219` confirmed it's an `Array.prototype.find` over an in-memory permissions array,
   not a query — **correcting the metrics file here**: this category is largely a false-positive
   lead for a frontend repo and should be down-weighted, not cited as-is.
3. **72 `setTimeout`-in-handler hits / 50 files** — sampled `src/common/CommonModal/AddNewStrainModal.jsx:56`
   and `src/common/component/Hyperwolf/InfiniteScrollListBlog.jsx:102`; both are debounce-style
   delays around user input, not obviously leaking, but 72 independent hand-rolled timeout patterns
   instead of one shared `useDebounce` hook is a real duplication-of-effort cost (ties to §12).
2×2 duplicated 9,800-line `category-section.jsx` files (§0) each independently re-run their own
render/effect logic for what is functionally the same "pick a category, configure its display"
UI — meaning any performance fix (e.g. memoization) applied to one page builder must be
re-applied by hand to the other, and frequently won't be.
4. **8 `setInterval` polling sites** (§7) with no shared polling/backoff strategy — each component
   manages its own interval independently; not measured for actual poll frequency/payload size
   (would require runtime observation, out of scope for a static read-only audit).
5. **Bundle size**: `ag-grid-community` + `ag-grid-react` (full grid library), `mapbox-gl`, HERE
   Maps, Google Maps, `react-virtualized` + `react-virtuoso` (two virtualization libraries declared
   simultaneously), `chart.js` + `react-chartjs-2`, `moment` + `dayjs` (§13) all ship together in one
   bundle with no code-splitting verified from the repo (no `React.lazy`/`import()` dynamic-import
   pattern found in the files sampled — not exhaustively checked across all 384 routes). The 12.5 MB
   unminified-equivalent main bundle inside `build.zip` (`main.713e6418.js`, 12,554,829 bytes) is
   direct evidence of this.
6. **Cities.js (19,163 lines) ships as part of the JS bundle** rather than being fetched on demand
   — every user downloads the full US states/cities dataset regardless of whether they ever open a
   screen that needs it (not verified whether webpack tree-shakes/code-splits this specific import;
   given it's a single `export const` array likely imported eagerly wherever used, treat as
   bundle-inflating until proven otherwise).

## 16. Ten things a new developer would trip over

1. No lockfile — `npm install` is non-reproducible (§2).
2. Three route trees selected by a localStorage string (`adminsMode`) that can silently mismatch
   the user's actual permissions if it's ever out of sync (`src/App.js`, `src/HOC/PublicRoute.jsx`).
3. `src/redux/store.js:2` imports the real auth slice under the alias `msalReducer` — grepping for
   "msal" (the actual unused dependency) leads here by mistake.
4. Two files (`roles.jsx`/`users.jsx` in `userAndRoles/components/`) are byte-identical and neither
   is used — easy to "fix a bug" in the wrong one, or waste time figuring out which is live (§12).
5. `homePage` vs `landingPage` — a bug fixed in one nearly-identical 9,800-line file silently does
   not apply to its twin (§0/§12).
6. `src/index.js:10` has a commented-out import (`// import { store } from './Rtk/Store'`) pointing
   at a file (`Rtk/Store.js`) that doesn't exist in the repo — a leftover from an abandoned
   RTK-Query migration; the one file that *is* live under `src/Rtk/` (`Services/user.js`) is easy to
   mistake for "the new pattern to follow" when it's actually unused by 59 of 60 slices.
7. `.env.example` (30 vars) is missing real vars the README documents as required (§8) — following
   `.env.example` alone on a fresh clone produces a broken build.
8. File named `src/components/hyperdrive/calculateMap(HereMap).js` — parentheses in a filename is
   unusual and some tools/shells mishandle it; same pattern exists elsewhere per metrics
   (`AddDiscrepancyNote backup.jsx` — a space in a filename, from the `empty_catch` metric list).
9. `npm run install:clean` (`package.json:122`) deletes `package-lock.json` — running it "to fix a
   weird install" guarantees there's no lockfile afterward either.
10. The `routeMap` export in `utilities/common/index.js` looks like real hyperdrive route data (it
    has realistic ObjectIds and timestamps) but is dead fixture data nobody imports (§11) — a
    developer debugging a map issue could easily "fix" this dead code and wonder why nothing
    changes.

## 17. Grade inputs

| Axis | 1–10 | Justification | Citation |
|---|---|---|---|
| Simplicity | 3 | Two parallel state-management approaches, three route trees, two duplicated page-builder feature sets, and a per-brand duplicated layout tree, for what is one conceptual app | §0, §5, §12 |
| Speed | 4 | Unbounded `limit:1000` fetches on every mount + no verified code-splitting across a 12.5 MB bundle | §15.1, §15.5 |
| Security | 3 | Committed build artifact with live API keys is the kind of finding that requires an incident response, not a ticket | §14.1 |
| Data modelling | 4 | Inconsistent response-unwrap conventions slice-to-slice mean the shape of `state.X` is unpredictable without reading the API call | §5 (response envelope) |
| Reuse vs. hardcoding | 2 | ~33.5% of source lines are duplicated/vendored/generated-as-source rather than shared or fetched | §0 |
| Testing | 1 | Zero test files across 296,940 lines | §9 |
| Upgradability | 3 | Hand-forked, unmaintained CRA toolchain; no lockfile; Jest 27; two date libraries mid-migration | §2, §13 |
| Operability | 3 | Deploy pipeline doesn't gate on its own security scan; no rollback; SSH-to-root-on-hardcoded-IP deploy | §10, §14.5 |
| Developer experience | 3 | No lockfile, misleading import alias, dead files sitting next to live ones, a filename with parentheses | §16 |

## 18. Quick fixes (<1 h each)

1. Delete `src/layouts/hyperwolf/userAndRoles/components/roles.jsx` and `.../users.jsx` — confirmed
   dead, byte-identical, −642 lines. (§12)
2. Add `build.zip` to `.gitignore` and `git rm --cached build.zip` (does not purge history — flag
   the history-rewrite as a separate, larger task, but stop the bleeding immediately). (§14.1)
3. Delete the dead `routeMap` fixture in `src/utilities/common/index.js` (~130 lines) — confirmed
   unused. (§11)
4. Delete the commented-out `Rtk/Store` import in `src/index.js:10` and the dead
   `getSingleProductDetails`/`deleteEmployee` commented reducer blocks in
   `src/redux/slices/hyperwolf/products.js` and `hyperwolf/employee.js` — cheap
   `commented_code_hint` cleanup (1,000 hits total across the repo, these are three concrete ones).
5. Add `if: github.event.workflow_run.conclusion == 'success'` to
   `.github/workflows/stage.yml`'s deploy job — one line, closes a real deploy-gating gap. (§14.5)
6. Add `*.zip` to `.gitignore` proactively (prevents a repeat of #2).
7. Rename `msalReducer` to `authReducer` in `src/redux/store.js:2` — removes a genuinely confusing
   grep-trap for the next person debugging auth. (§16.3)
8. Remove the 40 declared-but-unused dependencies from `package.json` (§2/§13) — mechanical,
   shrinks `npm install` time and the dependency audit surface.

## 19. Open questions

1. Is `hyperwolf-super-admin` meant to fully replace `hemp-retailer-admin`, or are both intended to
   keep existing? The 4,146 byte-identical lines plus ~40 near-identical files (§12) suggest one
   should be the source of truth for the shared template/component layer — which one, and is a
   shared internal package (extracting `MD*`/`examples/`/the identical redux slices) worth the
   migration cost?
2. Is the per-brand duplication in `layouts/hyperwolf/` (§0) intentional (hyperwolf genuinely needs
   different business logic per screen) or historical accident (it started as a copy-paste and
   nobody unified it)? This determines whether the fix is "parameterize by brand" or "leave it, it's
   actually divergent on purpose."
3. Are the two Google Maps API keys and the Mapbox token found in `build.zip` (§14.1) already
   restricted by HTTP referrer/domain? If not, they should be rotated regardless of the git-history
   cleanup.
4. Is `build.zip` used by any deploy process, or is it a one-off artifact someone committed by
   accident? (`stage.yml` builds fresh on the target host — §10 — so `build.zip` does not appear to
   be consumed by the one deploy path found in this repo.)
5. Is the abandoned RTK-Query migration (`src/Rtk/`, §5/§16.6) something the team still intends to
   finish, or dead — worth a decision either way before more slices get half-migrated.
6. What does `.github/workflows/security.yml` actually check? Not read in depth for this pass —
   worth a follow-up read given finding §14.5 (deploy doesn't gate on its result regardless of what
   it checks).
