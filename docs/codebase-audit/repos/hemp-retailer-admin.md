# hemp-retailer-admin — audit @ 1d09f69

Repo: `/Users/jt/hyper-tech/hemp-retailer-admin`. Read-only audit; nothing under
`/Users/jt/hyper-tech` was modified. All line numbers verified against the pinned SHA by direct
`Read`/`grep -a`, not taken from the mechanical metrics pass. Where the metrics pass
(`metrics/hemp-retailer-admin.md`) mis-scored something because its regexes are backend-tuned, that
is called out explicitly below.

## 1. Purpose

A React 18 / Create React App admin dashboard for the "Stilo POS" hemp-retail brand
(`public/index.html` title; `README.md:1`). It is the back-office console store staff and admins
use to manage products, master catalog, brands/strains, members, orders (e-commerce and in-store),
inventory, promotions, roles/permissions, company settings, and to run the in-store POS and
Fulfillment ("Checkin"/kanban) screens. It talks to two backend base URLs configured via env:
`REACT_APP_BASE_URL` (the "main" API — products, orders, members, settings, printer, promotions)
and `REACT_APP_HEMP_BASE_URL` (the "hemp" API — used almost exclusively for admin-user auth and
role/permission management: `src/redux/apis/auth.js:5`, `src/redux/apis/roleAndPermissions.js`).
It also talks directly to Firebase Cloud Messaging for push (`src/firebaseInit.js`,
`public/firebase-messaging-sw.js`), to Google Maps JS API (injected in `src/App.js:233-235`), to a
local QZ Tray websocket for label/receipt printers (`src/utilities/printer/index.js`), and to a
`socket.io` server (`src/socket.js`) whose dev-mode URL is a hardcoded personal ngrok tunnel.

Callers: store-level admin users and cashiers via browser, and the in-store POS terminal mode
(same SPA, different route/`currentSite` state — `src/App.js:196-209`).

## 2. Runtime & framework

- React `18.2.0`, `react-dom` `18.2.0`, bundler/toolchain is `react-scripts` (CRA) `5.0.1`
  (`package.json`). **CRA has been unmaintained since 2023** (no releases addressing webpack 5 /
  Node 22 compatibility issues) — this is the single biggest upgradability risk in the repo (see
  §17).
- State: Redux Toolkit `^2.0.1` + `react-redux ^9.0.1`. Routing: `react-router-dom 6.11.0`. UI:
  MUI `^5.12.3` + `@mui/styles ^5.15.2` (styles package is itself deprecated upstream in favor of
  `styled`/`sx`, still used — see `src/assets/theme*`). Forms: **no** form/validation library is
  actually used at runtime — `yup 1.1.1` is a declared dependency that is never imported anywhere
  (verified: `grep -a -rn "from 'yup'" src/` → 0 hits); all validation is 17 hand-rolled files
  under `src/validations/` (§6, §12).
- No TypeScript anywhere (`.js`/`.jsx` only, `jsconfig.json` not `tsconfig.json`).
- Pinning: `package.json` mixes caret (57 deps) and exact (20 deps) with no stated policy; a
  `package-lock.json` is committed (deterministic installs are possible) but nothing prevents a
  caret dep from drifting on a fresh `npm ci` after an upstream release. No `engines` field —
  Node version is enforced nowhere (README claims "Node.js 20.x (verified)" but that is a comment,
  not a gate; `.nvmrc` and `Dockerfile` are both absent from the repo).
- EOL/CVE exposure: `react-scripts` (CRA) unmaintained since 2023 carries whatever webpack/babel
  CVEs its frozen transitive tree has, with no path to a patch except ejecting or migrating off
  CRA. `msal ^1.4.18` (MSAL.js v1, superseded by `@azure/msal-browser`) is declared but its only
  live use is a `msalReducer`/`msalSlice` **name** — the actual library and all Azure AD/MSAL flow
  code are 100% commented out (`src/index.js:14-36`, `src/layouts/authentication/sign-in/authService.js`
  is entirely comments). `moment` (declared, in maintenance-mode upstream, superseded project-wide
  by `dayjs` which is also present) is still imported for date math in
  `src/utilities/common/index.js:80-84`.
- Test runner is CRA's bundled Jest (`react-scripts test`) but there are **zero** test files
  (§9).

## 3. Entry points & boot

- `public/index.html` mounts to `<div id="app">`; `src/index.js:12-13` does
  `createRoot(document.getElementById("app"))` and renders `<BrowserRouter><Provider
  store={store}><App/></Provider></BrowserRouter>` (`src/index.js:92-101`).
- `src/index.js:46-90` defines a full MSAL configuration object (Azure tenant ID
  `60b03f2c-54e3-4f17-ad91-4164dda011b3`, client ID `1a5f0a47-1ffa-42f0-bbec-9786b90933e8`,
  hardcoded `redirectUri: 'http://localhost:3000'` — note: doesn't even match the app's real dev
  port of 3001 per `package.json`'s `start` script) that is constructed on every module load and
  then **never referenced again** — dead weight executed at boot for no effect. Real auth is a
  plain POST + Bearer JWT (§6).
- `src/redux/store.js` wires 28 reducers via `configureStore` (one JS module import graph, no
  code-splitting of the store). No thunk middleware customization, no persistence middleware —
  Redux state is memory-only; the durable copy of session data lives in `localStorage` directly
  (`utilities/common` `getData`/`setData`, not Redux).
- `src/App.js` (326 lines) is the composition root: on mount it dispatches four thunks
  unconditionally (`fetchBrands`, `fetchInfoEffect`, `fetchAllRegions`, `fetchCategories` —
  `src/App.js:89-94`) before any auth check, i.e. these four network calls fire even on the
  `/login` screen for an unauthenticated visitor. It also owns Firebase `onMessage` wiring,
  Google Maps script injection (creates and appends a `<script>` tag itself — `src/App.js:233-235`
  — rather than using `@react-google-maps/api`'s loader, so double-injection is a real risk if any
  other component also injects the same script), and permission-based route filtering
  (`getRoutes`, `src/App.js:102-146`).
- Global mutable state outside Redux: `window.google` is nulled in a `useEffect` cleanup
  (`src/App.js:236-238`); `localStorage` keys (`access-token`, `login-user-info`, `mode`,
  `orderNotifications`, etc. — enumerated in `removeLocalData`,
  `src/utilities/common/index.js:859-868`) are the real source of truth for "am I logged in,"
  read directly by many components instead of exclusively through Redux/hooks.
- **Module-load-time state capture bug**: `src/utilities/common/index.js:4` does
  `const userData = JSON.parse(getData('login-user-info'))` at **module evaluation time** (i.e.
  once, whenever this module is first imported — effectively at app boot, before login). This
  stale snapshot is later read as a fallback default in `prepareTaxPayload`
  (`src/utilities/common/index.js:1033`: `defaultStoreId = userData?.storeId`). If the user logs
  in after this module loads (the normal case — it always does), `userData` never updates for the
  lifetime of the tab; the fallback silently uses `undefined`/stale data instead of the real
  logged-in store. A real correctness bug, low-traffic code path (tax payload builder).

## 4. Directory map

| Dir | Files | Role |
|---|---|---|
| `src/layouts` | 96 | Route-level pages (one per `routes.js` entry): dashboard, products, members, orders, settings, POS, Fulfillment, rolesPermissions, etc. |
| `src/components` | 117 | Reusable feature components split by domain (products, orders, members, promotion, settings, POS, MD* primitives). |
| `src/common` | 122 | Shared low-level building blocks: `CommonModal/` (dozens of per-feature modals), `CommonDrawer/`, `CustomTable.js`, chart wrappers, custom icons, editor (Quill wrapper). |
| `src/assets` | 233 | Material Dashboard 2 template theme system (`theme/`, `theme-dark/`) plus `images/`. Almost entirely vendored template boilerplate — see §12 duplicate-file finding. |
| `src/redux` | 64 | `slices/` (30 files, Redux Toolkit slices) + `apis/` (29 files, thin axios wrappers) + `store.js`. This is the entire client-side "data model" (§5). |
| `src/examples` | 60 | Material Dashboard 2 React template components (Sidenav, Navbars, Configurator, Charts, Cards, Timeline) — again template-vendored, not hand-written for this product. |
| `src/HOC` | 3 | `PrivateRoutes.jsx`, `PublicRoute.jsx` (route guards, §6), `useSocket.jsx`. |
| `src/hooks` | 5 | `usePermissions.js` (canonical permission check, §6), debounce, window-size, barcode-scan-detection hooks. |
| `src/validations` | 17 | Hand-rolled per-entity form validators (no schema library — §2, §12). |
| `src/utilities` | 4 files across subfolders | `common/index.js` (1150 lines — grab-bag: localStorage helpers, date formatting, AAMVA driver's-license barcode parsing, tax payload builder, permission helpers), `constants/index.js`, `printer/`. |
| `src/bluetooth` | 3 | Web Bluetooth printer discovery/connection queue (used by in-store barcode/label printers). |
| `src/styles` | 5 | Global SCSS. |
| `src/prompt` | 1 | Single file (not inspected in depth — low line count per metrics). |
| `public/` | — | `firebase-messaging-sw.js` (hardcoded Firebase web config, §11), static assets. |

## 5. Data model summary

This is a frontend: there is no ORM/schema layer, so "models" here means the **client-side Redux
state shapes and the API response shapes the UI assumes** — full field-by-field detail is in
`hemp-retailer-admin.datamodel.md`. Summary:

- **30 Redux Toolkit slices** (`src/redux/slices/**`), registered as **28** reducers in
  `src/redux/store.js:38-70` (`settings/CreditCardFee.js` exists but is **not** wired into the
  store — dead slice, verified: no `CreditCardFee` key in `store.js`). Backed by **29 api files**
  (`src/redux/apis/**`) making **~180+ distinct REST calls** (mechanical count of parseable
  `axiosClient.*`/`axiosHempClient.*` calls: 247 call sites across the repo, ~180 as unique
  `function` wrappers — full list in the datamodel doc).
- The 10 most central slices by app-wide usage and code volume: `auth` (session/user/permissions),
  `common` (categories, regions, banners, info-effects, snackbar — a catch-all), `products`,
  `pos/products` (POS-mode product/cart state, 60+ fields — the largest single slice),
  `orders`, `member`/`pos/members`, `inventory`, `roleAndPermissions`, `promotions`,
  `regions`/`brand`/`category` (near-identical CRUD shape, each duplicated by hand rather than
  generated — see §12).
- IDs: MongoDB ObjectId strings passed through as opaque strings in URLs/state (e.g.
  `${productId}`, `${storeId}` interpolated directly into REST paths — no client-side ID
  validation). One ObjectId is **hardcoded** as a magic constant:
  `OverrideInventoryId = "5f99fc0ee8a8da08def1e72e"` (`src/utilities/constants/index.js:11`) — a
  single Mongo document ID baked into source that inventory-override logic depends on across every
  environment; if that document doesn't exist in a given environment (e.g. staging), the feature
  silently no-ops or errors.
- Enums are informal — string literals compared ad hoc (`currentSite === 'POS'`, order statuses as
  raw strings mapped in `orderStatus` array `src/utilities/common/index.js:154-170`), not a shared
  enum module.
- **Money is a JS `Number` in dollars**, not cents, no money/decimal library. Display uses
  `.toFixed(2)` at the read site (e.g. `src/components/orders/AddOrderForm.jsx:1108,1129,1145,1158`)
  — the classic floating-point-money footgun (no evidence of a bug caused by it in this repo, but
  no guard against one either).
- Timestamps: whatever the backend sends, formatted client-side with a **mix of `dayjs` and
  `moment`** in the same file (`src/utilities/common/index.js` imports both, `dayjs` used for most
  new formatters, `moment` still used at lines 80-84) — two date libraries doing the same job.
- No soft-delete convention visible client-side (DELETE calls are real DELETE/POST-to-delete
  requests to the backend; the frontend has no notion of a "deleted" flag to filter on).
- Multi-tenancy key: **`storeId`**, threaded through almost every API call and read from
  `user?.storeId` / `localUser?.storeId` (e.g. `src/redux/apis/pos/members.js:146-147` builds URLs
  with `storeId=${user?.storeId}` where `user` is captured from module scope, not passed in — see
  the datamodel doc for the list of api files that read a module-scope `user` instead of taking it
  as a parameter, which is a testability/correctness smell: those functions silently depend on
  import order and a live `getLocaUserInfo()`/localStorage read at call time).
- Indexes: not applicable (no ORM/schema files in a frontend repo) — "not measured."

## 6. API surface

**Client layer.** Two axios instances, `src/axiosClient/index.js` (main) and
`src/axiosClient/hempIndex.js` (hemp) — **byte-for-byte identical** except the base-URL env var
and internal variable name (verified via `diff`-equivalent read of both files). Both:
- set `baseURL` from `process.env.REACT_APP_BASE_URL` / `REACT_APP_HEMP_BASE_URL` at axios-create
  time (baked in at build time, per CRA env semantics — changing it requires a rebuild, not just a
  redeploy of the same bundle);
- send a static `X-API-KEY` header from `REACT_APP_API_AUTH_KEY` on every request (a single shared
  API key, not per-user);
- a request interceptor reads the JWT from `localStorage` (`getData(AccessTokenId)`,
  `AccessTokenId = "access-token"`, `src/utilities/constants/index.js:2`) and sets
  `Authorization: Bearer <token>`;
- a response interceptor unwraps to `response.data` (so every caller gets the backend's response
  body directly, no separate error/success envelope check needed) and, on any `401`, does
  `window.location.href = "/login"` + clears local storage (`src/axiosClient/index.js:43-49`).
  Note this is a **hard redirect**, not a router navigation — it force-reloads the SPA on every
  401, discarding in-memory Redux state and any unsaved form input with no warning to the user.

**Auth mechanism.** Login is `POST /api/v1/admin/login` on the **hemp** client
(`src/redux/apis/auth.js:5`) — a plain credential POST, response presumably contains
`access_token` (checked via `isLoggedIn()`, `src/utilities/common/index.js:141-145`: `if
(user.access_token) return {isAuthenticated:true}`). The JWT itself is never decoded/inspected
client-side (no expiry check beyond reacting to a `401`); its algorithm/expiry/signing are entirely
backend concerns not visible in this repo. Session persistence is **`localStorage`** (not an
httpOnly cookie) under `login-user-info` (whole user object, including permissions) and
`access-token` (the bare token string) — both readable by any script on the page (XSS → token
theft, standard CRA/SPA risk, no mitigating `Content-Security-Policy` found in `public/index.html`
or CRA config).

**Route guards.** `src/HOC/PrivateRoutes.jsx` wraps every non-auth route; it derives
`isAuthenticated` purely from `isLoggedIn('userData')` (i.e. "does `login-user-info` in
localStorage have an `access_token` field") — **no token expiry or validity check**, so a stale
(backend-expired) token still renders the private UI until the first API call 401s.
`src/HOC/PublicRoute.jsx` is the inverse for `/login` etc.

**Authorization / roles.** Represented as an array of permission objects
(`user.permissions.posPermissions`, each `{ title, redirectUrl, ... }`) attached to the logged-in
user by the backend. `src/hooks/usePermissions.js` is the documented "always use this" API
(comment in the repo's own `CLAUDE.md`) exposing `hasPermission(section, action)` and
`getModuleAccess(module)`; it falls back to re-parsing `localStorage` if Redux hasn't hydrated yet
(`src/hooks/usePermissions.js:29-40`). Route-level filtering happens in `src/App.js:102-146`
(`getRoutes`) by matching a route's declared `title` against the permission titles the user has —
**this is UI-layer gating only**: nothing in this repo can stop an authenticated user from calling
any endpoint their bearer token is accepted for; real authorization enforcement is a backend
concern (out of scope for this repo, but worth stating explicitly since the frontend's permission
model reads as if it were the enforcement layer).

**Unauthenticated routes** (verified by tracing `src/App.js:340-350`): `/login`,
`/forgot-password`, `/reset-password`, `/reset-pincode` are rendered outside `PrivateRoute`. Every
other declared route (33 unique paths in `src/routes.js`, enumerated in the datamodel doc) is
wrapped in `<PrivateRoute>`. The catch-all (`path="*"`) and root (`path="/"`) both redirect based
on `isLoggedIn()`, and `/401` is a static "not found/forbidden" page
(`src/layouts/401`) — reachable without auth, as expected for an error page.

**Input validation.** No schema library in use despite `yup` being declared (§2, §12); validation
is imperative field-by-field checks duplicated across `src/validations/*.js` (17 files, e.g.
`isValidEmail`/`isValidPhone` independently reimplemented in both `admin.js:70-79` and
`member.js:105-114`).

**Pagination.** Convention is `skip`/`limit` query params built via `getQueryString()`
(`src/utilities/common/index.js:50-59`), e.g. `fetchBrands({skip:0, limit:1000})`
(`src/App.js:90`) — note the app's own boot sequence requests **1000** brands and **1000**
categories unconditionally on every load (`src/App.js:90,93`), not paged incrementally.

**Error shape.** Callers uniformly do `.catch(err => ...err?.message...)` against whatever the
axios response-interceptor passed through — there's no single normalized error shape asserted
anywhere; each component free-hands its own `err?.response?.data?.message` / `err?.message`
extraction (not enumerated exhaustively — pattern confirmed via multiple `redux/slices/*.js`
`rejectWithValue(error?.response?.data)` call sites).

**Versioning.** All endpoints are `/api/v1/...`; no `v2` anywhere, and no version negotiation.
Two endpoint families use an **inconsistent leading slash** (`/api/v1/...` vs `api/v1/...` — e.g.
compare `src/redux/apis/brand.js:27` (`/api/v1/brand?...`) with `src/redux/apis/brand.js:32`
(`api/v1/brand/update/main/metas`, no leading slash) in the *same file*). Whether this matters
depends on how axios resolves a relative path against `baseURL` (it does, but behavior differs if
`baseURL` ever gains a path segment) — flagged as a latent footgun, not a confirmed live bug.

**SSR vs CSR.** Pure CSR (CRA `react-scripts build` output is a static SPA bundle); no
server-rendering anywhere.

## 7. Background jobs

None. This is a frontend SPA with no cron/queue/timer subsystem of its own. The closest analogues
are UI-level polling/intervals, none of which run unconditionally in the background (no
`setInterval`-driven polling loop was found at the App root; `settimeout_in_handler` metric hits
are one-off UI debounce/timeout calls inside event handlers, not schedulers — e.g.
`src/common/component/BarcodeScanArea.jsx:50` debounces scanner input, not a recurring job).

## 8. Third-party integrations & secrets

| Integration | Wrapper file | Credential source | Notes |
|---|---|---|---|
| Backend API ("main") | `src/axiosClient/index.js` | `REACT_APP_BASE_URL`, `REACT_APP_API_AUTH_KEY` (build-time env) | Shared static API key header on every request (§6). |
| Backend API ("hemp") | `src/axiosClient/hempIndex.js` | `REACT_APP_HEMP_BASE_URL`, `REACT_APP_API_AUTH_KEY` | Byte-identical wrapper to the above (§12). |
| Firebase Cloud Messaging | `src/firebaseInit.js`, `public/firebase-messaging-sw.js` | **Hardcoded** in `public/firebase-messaging-sw.js:17-25` (`apiKey: 'AIza…[redacted, 39 chars]'`, project `stilo-pos`), even though the file **also contains a commented-out env-var version directly above it** (lines 7-15) — someone built the correct (env-driven) version and then shipped the hardcoded one instead, or reverted it. A second, also-commented, `hyperwolf-firebase` config block (lines 27-35) is leftover cross-repo copy-paste evidence (this app was cloned from the `hyperwolf-super-admin` sibling — confirmed independently in §12). Firebase web `apiKey`s are not secret by Google's own threat model (protected by Firebase security rules, not by key secrecy), so this is a "should be config, not hardcoded" finding rather than a credential leak. |
| Google Maps JS API | `src/App.js:233-235`, `src/components/googleMaps` | `REACT_APP_GOOGLE_KEY` (env) | Injected via a manually created `<script>` tag rather than a loader library — risk of double-injection if another component also injects it (not confirmed as actually happening, but no guard against it either). |
| QZ Tray (label/receipt printers) | `src/utilities/printer/index.js` | none (local websocket to `qz-tray` daemon on the operator's machine) | `getPrinterList` calls `qz.printers.find()` — this is the "unfiltered_find" metrics hit; it is a **false positive**, `find()` here is the QZ Tray printer-discovery API, not an unbounded DB query. |
| `socket.io` | `src/socket.js` | Hardcoded dev-mode URL: `'https://af09-14-194-152-142.ngrok-free.app'` (`src/socket.js:4`) when `NODE_ENV !== 'production'` | Matches the repo's own `CLAUDE.md` pitfall note ("hardcoded ngrok URL for non-production"); this tunnel almost certainly no longer exists, so local dev socket connections silently fail unless a developer edits this file locally. |
| AAMVA driver's-license barcode parsing | `src/utilities/common/index.js:~950-1010` | n/a (pure parsing, no network) | Regex-based PDF417 field extraction; the "child_process" metrics hit here (`:975`) is a **false positive** — the match is `RegExp.exec()`, not Node's `child_process.exec()`. |
| OpenAI | declared in `package.json`, **never imported** | n/a | The "AI description" feature (README claim) actually calls the **backend's own** endpoint, `fetch(`${REACT_APP_BASE_URL}/api/v1/generate/description`)` (`src/components/products/AddProduct.jsx:581`) — the `openai` npm SDK is entirely dead weight in `node_modules`. |
| MSAL / Azure AD | declared (`msal ^1.4.18`), **never imported** | n/a | Fully dead; see §3. |
| Webhooks | none found | — | This repo has no server-side code, so "webhook signature verification" is not applicable here (would live in a backend repo). |

**Secrets in the tree**: the only literal-looking secret is the Firebase config above (not a true
secret per Firebase's model, see note). No AWS/Stripe/API keys, no private key blocks were found
in real (non-commented, non-template) code. The metrics tool's `private_key_block` hit
(`src/components/settings/PrinterSetup/index_old.jsx:58`) was checked: this is a file explicitly
named `index_old.jsx` (dead/superseded component, not imported/routed anywhere — verified no
`PrinterSetup/index_old` import exists in `src/`), and the "private key" text is inside a
commented-out QZ Tray certificate-signing example, not a live embedded key.

## 9. Tests

**Zero.** `test_files: 0`, `test_lines: 0` (metrics, confirmed by `find src -iname "*.test.*" -o
-iname "*.spec.*"` returning nothing). `npm test` runs CRA's bundled `react-scripts test` (Jest +
Testing Library are available transitively via `react-scripts`, but no test file exists to run
it against). Neither CI workflow (`dev.yml`, `stage.yml`) invokes `npm test` at all — deployment is
gated only by `security.yml`'s `npm audit --audit-level=critical` (§10), not by any test or type
check. Coverage: none. Nothing is covered.

## 10. Build & deploy

- Build: `GENERATE_SOURCEMAP=false react-scripts build` → static `build/` directory (CRA default,
  no custom webpack config, no `craco`/`react-app-rewired`).
- Deploy: **direct SSH to a live VPS**, not a container/artifact pipeline. Two workflows
  (`.github/workflows/dev.yml`, `.github/workflows/stage.yml`) both trigger on completion of
  `security.yml` and use `appleboy/ssh-action` to `git pull` + `npm i` + `npm run build` **directly
  on the target server**:
  - `dev.yml:9-19` → host `thcs.in`, **username/password auth** (`secrets.USERNAME`/`PASSWORD` —
    password-based SSH, weaker than key-based; only runs when `head_branch == 'Development'`).
  - `stage.yml:9-19` → host `54.81.94.241` (raw IP, root user), **SSH key auth**
    (`secrets.STAGE_SSH_KEY`), branch `fullfillment-task-dev`, no branch-name guard (any push that
    completes `security.yml` on any branch triggers this — verify against the actual default
    branch protection, not visible from this repo alone).
  - No production workflow is present in this repo's `.github/workflows/` — either prod deploys
    are manual, live in a different repo/pipeline, or (unverified) don't exist yet. **Open
    question for the owner** (§19).
  - Neither workflow builds an artifact and promotes it; both build **in place** on the box
    that serves traffic, meaning a failed `npm run build` mid-deploy can leave the server serving a
    half-built/broken `build/` directory with no rollback step defined here.
- `security.yml` is a generic, six-language security-scan template (Node, Go, Python,
  Flutter/Dart, Android, PHP) copy-pasted across the estate — only the Node/`npm-audit` job ever
  actually runs in this repo (the other five `if:` guards all evaluate false, since there's no
  Go/Python/Flutter/Android/PHP code here); it's dead CI weight that still costs a full
  `actions/checkout` + conditional-check job per push. It fails the pipeline only on **critical**
  npm advisories (`--audit-level=critical`), so High/Medium CVEs never block a deploy.
- No Dockerfile, no `.nvmrc`, no `engines` field — environment parity between dev/stage/CI/prod
  Node versions is enforced nowhere except the CI YAML's own `node-version: '20'` and the README's
  prose claim.
- Environment separation: purely by which `.env` is loaded per-host at build time (CRA inlines
  `REACT_APP_*` vars into the bundle at build, so switching environments requires a full rebuild,
  not a config swap) — confirmed by both CI jobs running `npm run build` per target.
- Logging/monitoring: none found client-side beyond `console.log` (4 hits total per metrics, none
  wired to a monitoring service like Sentry — no error-tracking SDK is declared in `package.json`
  at all). A production SPA with zero client-side error reporting means JS exceptions in the field
  are invisible unless a user reports them.

## 11. Hardcoded values

Counts from the metrics pass, spot-verified above where cited:

- **`http_url`: 485 hits / 241 files** — the overwhelming majority are MUI/theme
  boilerplate SVG/asset URLs and doc-comment URLs inherited from the Material Dashboard 2 template
  (`src/examples/**`, `src/assets/theme*/**`) — low-signal. The handful that matter operationally:
  `src/socket.js:4` (ngrok tunnel, §8), the Firebase config block (§8), and
  `public/firebase-messaging-sw.js:53` (a hardcoded CDN image URL for the notification icon).
- **`role_string`: 37 hits / 22 files** — permission/role title strings compared as raw literals
  (e.g. `'POS/Fulfillment'` compared in three unrelated files: `src/App.js:275`,
  `src/HOC/PublicRoute.jsx:20`, and `src/redux/slices/*` — not a shared constant, so a rename of
  that title on the backend silently breaks routing in three places at once with no compiler
  error).
- **`email_literal` / `phone_literal`**: dashboard demo-data leftovers
  (`src/layouts/tables/data/authorsTableData.js` — template sample data never removed, not live
  user data) and printer test fixtures (`src/utilities/printer/index.js:22,42`) — cosmetic, not
  operational.
- **`objectid_24hex`: 2 hits** — one is the `OverrideInventoryId` magic constant (§5, the
  worst finding in this category); the other (`src/layouts/POS/layouts/Purchased/index.jsx:105`)
  is a UI text label, not a code dependency — not verified further, low priority.
- **Worst 10, ranked by blast radius:**
  1. `src/utilities/constants/index.js:11` — `OverrideInventoryId` hardcoded Mongo ObjectId.
     Should be config/data, not source.
  2. `src/socket.js:4` — hardcoded personal ngrok URL. Should be an env var (the file already
     has the `NODE_ENV` branch to hang one off of).
  3. `public/firebase-messaging-sw.js:17-25` — hardcoded Firebase config with a dead,
     correct env-var version commented out two lines above it. Should be templated at build
     time (CRA service workers can be templated via `public/` substitution or a small build step)
     or at minimum kept in sync with the main `firebaseInit.js` config.
  4. `src/index.js:46-90` — entire MSAL config, dead. Should be deleted, not hardcoded-and-dead.
  5. `src/App.js:275`, `src/HOC/PublicRoute.jsx:20` — `'POS/Fulfillment'` permission title
     repeated as a raw string in ≥3 places instead of a shared constant.
  6. `.github/workflows/stage.yml:12` — raw IP `54.81.94.241` as the deploy target. Should be a
     DNS name or repo/environment variable.
  7. `.github/workflows/dev.yml:11` — hostname `thcs.in` hardcoded in the workflow (should be an
     environment-scoped GitHub Actions variable, especially since password auth is used here).
  8. `src/utilities/common/index.js:154-170` — `orderStatus` display-label map is hardcoded
     inline in a generic utils file rather than colocated with order constants/enums.
  9. `.env.example` declares `REACT_APP_METRC_BASE_URL`, `REACT_APP_HYPERWOLF_BASE_URL`,
     `REACT_APP_METRC_ACCESS_1/2/3` — **none of these six vars are referenced anywhere in `src/`**
     (verified via `grep -a -rn` across `src/`). Either dead template leftovers from a sibling repo
     or vestiges of a removed feature — either way, actively misleading to a new developer trying
     to configure the app (§16).
  10. `src/layouts/tables/data/authorsTableData.js` — template demo data (names/emails/avatars)
      shipped in the production bundle; harmless but unshipped cleanup debt.

Distinguishing "should be config" vs "should be data": #1, #2, #3, #6, #7, #9 are config
(environment-specific, belong in env vars/CI secrets). #5, #8 are data/constants (belong in a
shared enum/constants module, not repeated string literals). #10 is neither — it's dead template
content that should simply be deleted.

## 12. Duplicated code

**Inside this repo:**
- `src/axiosClient/index.js` and `src/axiosClient/hempIndex.js` — byte-identical apart from the
  env var name and local variable name (§6).
- `src/validations/admin.js:70-79` and `src/validations/member.js:105-114` — `isValidEmail`/
  `isValidPhone` reimplemented rather than shared.
- `src/redux/apis/members.js` and `src/redux/apis/pos/members.js` — near-identical function sets
  (`fetchMemberAPI`, `fetchMemberDetailsAPI`, `addMemberAPI`, `updateMemberAPI`,
  `deleteMemberAPI`, `fetchMemberOrdersAPI` all present in both, same signatures) — two parallel
  copies of the member API for "admin" vs "POS" contexts instead of one shared module.
- `src/redux/slices/regions.js:4-9` — a dead, unused top-level `const initialState = {products:
  [], singleProduct: null, ...}` **copy-pasted from `products.js`** and left in the file; the slice
  actually created at line 79 uses a completely different (correct) shape
  (`{data: [], regionDetails: {}}`). The dead block is never referenced — confirmed by grep for
  `initialState` usage in the file (only the inline object at `createSlice({initialState: {...}})`
  is consumed).
- `src/redux/slices/brand.js:27-32` — duplicate object key `isDeleting: false` written twice in
  the same literal (harmless at runtime — the second silently wins — but indicates ESLint's
  `no-dupe-keys` rule is not enforced in CI, since this would be a lint error under
  `eslint-config-react-app`'s defaults if `npm run lint` were ever run — there is no `lint` script
  wired into either CI workflow, only a local husky pre-commit hook, unverified whether it's
  actually installed on contributor machines).
- `src/assets/theme-dark/components/list/listItem.js` == `src/assets/theme/components/list/listItem.js`
  (byte-identical, ≥30 lines — mechanical finding, confirmed). Template artifact, not a bug, but
  representative of the ~233-file `assets/theme*` tree being vendored Material Dashboard 2
  boilerplate rather than product-specific styling.
- Nested nested `map().find()` nested-loop pattern for id→name lookups repeated at least 6 times
  in one file: `src/components/products/FilterProducts.jsx:68-69,85-86,173-174,180-181` — each
  rebuilds an O(n) linear `find()` inside a `map()` over the full categories/brands arrays instead
  of building a `Map` once (§15 performance).

**Cross-repo** (cross-checked against `metrics/CROSS-REPO-DUPLICATES.md`, all entries below
independently spot-verified, not taken on faith):
- **`hemp-retailer-admin` ↔ `hyperwolf-super-admin`: 4,146 duplicate lines** — by far the largest
  cross-repo overlap in the whole estate's duplicate report. The bulk (~3,000+ lines) is the
  Material Dashboard 2 React **template itself** — every chart wrapper under `src/examples/Charts/**`
  (`MixedChart`, `LineCharts/*`, `BarCharts/*`, `RadarChart`, `BubbleChart`, `PieChart`,
  `PolarChart`, `DoughnutCharts/*`) is byte-identical between the two repos (verified: sampled
  `src/examples/Charts/MixedChart/index.js` — 236 lines, identical file path and size in both
  repos per the duplicate report). This part is legitimate shared UI-kit boilerplate that both
  apps happened to eject-copy rather than depend on as a package — low business risk, real
  maintenance cost (any template fix has to be hand-applied twice).
  - The **higher-risk** overlap is business logic, not template chrome: `src/redux/slices/regions.js`
    (163 lines) vs `hyperwolf-super-admin:src/redux/slices/hyperwolf/driver/regions.js` — same
    region CRUD shape reimplemented for a different domain (driver regions vs retail regions);
    `src/redux/slices/memberships.js` (171 lines, near-identical); `src/redux/slices/inventory.js`
    (0.98 similarity to the sibling's `inventory.js`); `src/layouts/rolesPermissions/RolesPermission.jsx`
    (0.98 similarity) — permission-matrix logic duplicated rather than shared, meaning a
    permission-model bug fix has to be found and re-applied in both repos by hand.
  - `src/components/settings/CardSetting/FeePreview.js` / `FeeAmountInput.js` (142/132 lines) are
    duplicated verbatim against `hyperwolf-super-admin:src/components/CardSetting/*` — credit-card
    fee calculation logic, a place where a silent divergence between the two copies would produce
    different fee math for two different brands with no test to catch it (§9).
  - `commitlint.config.js` (110 lines) is duplicated identically across **three** repos
    (`hemp-frontend-nextjs`, `hemp-retailer-admin`, `hyperwolf-super-admin`) — low risk, but a
    fourth place any commit-convention change has to be copy-pasted.
- **`hemp-retailer-admin` ↔ `hemp-frontend-nextjs`: 110 lines** — just the shared
  `commitlint.config.js` above; no other overlap surfaced by the mechanical pass.

## 13. Dependency risk

- **Unmaintained majors**: `react-scripts`/CRA (unmaintained since 2023 — highest-impact item in
  this whole section), `msal` v1 (superseded by `@azure/msal-browser`, and dead code regardless —
  §2/§8), `moment` (in maintenance mode upstream, redundant with `dayjs` already in the tree).
- **Declared but never imported (17, per metrics, spot-checked above):** `@emotion/cache`,
  `@emotion/react`, `@point-of-sale/receipt-printer-encoder`, `ag-grid-community`, `mrz`, `msal`,
  `npm` (declaring the `npm` CLI itself as a project dependency is almost certainly an accident),
  `openai`, `react-barcode`, `react-qr-code`, `react-scripts` (declared as a dependency *and* used
  as the toolchain — technically "used" via `package.json` scripts, the metrics tool's static
  import scan just can't see that), `react-webcam`, `redux` (superseded by `@reduxjs/toolkit`,
  which re-exports what's needed), `sass`, `stylis`, `tesseract.js`, `yup`. Concretely verified
  dead: `openai`, `msal`, `yup`, `tesseract.js`, `mrz` (§2, §8, §6). These bloat `node_modules`
  and `npm install`/CI time (`tesseract.js` alone ships a WASM OCR engine) without contributing to
  the shipped bundle (CRA tree-shakes unused imports, so the runtime bundle-size risk is lower than
  the dependency-count risk — but `npm audit` still has to reason about all of them, and a
  developer reading `package.json` reasonably assumes they're load-bearing).
- **Imported but not declared** (per metrics — mostly false positives from the `jsconfig.json`
  `baseUrl: src` path-alias setup, e.g. `App`, `HOC`, `assets`, `components`, `context`, `hooks`,
  `layouts`, `routes`, `sideMenus`, `utilities`, `validations` are absolute imports resolved via
  `baseUrl`, not npm packages — the metrics tool's import-resolution heuristic doesn't know about
  CRA's `baseUrl`). The two real hits worth noting: `@mui/system` and `@splidejs/react-splide` are
  imported somewhere in `src/` without an explicit `package.json` entry — they likely resolve as
  transitive deps of `@mui/material`/`swiper` today, which means an unrelated version bump
  elsewhere in the tree could silently break these imports with no direct-dependency safety net.
  Not independently re-verified line-by-line given the size of the import graph — flagged as a
  lead, not a confirmed break.
- **Bundle-size offenders** (by known package weight, since an actual production build was not run
  per the read-only constraint — "not measured" for real numbers): `ag-grid-community` +
  `ag-grid-react` (large grid library, declared but not found imported anywhere in `src/` by this
  audit's greps — candidate for removal), `tesseract.js` (multi-MB WASM OCR engine, unused),
  `moment` + `dayjs` both present (redundant ~70KB), `qz-tray`, `swiper`, `chart.js` +
  `react-chartjs-2` all declared and legitimately used for their respective features.

## 14. Security findings

Ranked by severity. This is a **frontend-only** repo — several classic backend findings (IDOR via
unscoped record lookup, NoSQL injection, mass assignment, CORS, webhook verification) are not
applicable here and are called out as such rather than silently omitted.

1. **Medium — Stored HTML rendered without sanitization (`dangerouslySetInnerHTML`, no
   DOMPurify/sanitize-html anywhere in the tree).** Product `description`, `ingredients`, and
   `instructions` fields (authored via a Quill rich-text editor elsewhere in the same app) are
   rendered raw: `src/components/products/productDetails/index.jsx:398,403,409`,
   `src/components/products/productDetails/masterDetailView.js:217,222,228`,
   `src/layouts/brands/index.jsx:77,84,91,98`, `src/layouts/strains/index.jsx:77,84,91,98` (16
   sites total). No sanitizer library is declared in `package.json` at all. **Attacker**: any
   account with product/brand/strain create-or-edit permission (i.e. a lower-trust "editor" role
   if one exists on the backend's role model — this repo can't confirm the backend's actual role
   granularity) can plant a `<script>`/`onerror=` payload that executes in the browser of every
   admin/cashier who later views that product/brand/strain page — a stored-XSS path to session
   (`access-token`) theft from `localStorage` (see finding 2). **Fix**: run all three fields
   through `dompurify` (`DOMPurify.sanitize(html)`) at the render site, or better, at the point the
   Quill editor serializes content before it's sent to the backend, so no unsanitized HTML is ever
   stored in the first place.
2. **Medium — Session token stored in `localStorage`, not an httpOnly cookie.**
   `src/utilities/constants/index.js:2` (`AccessTokenId = "access-token"`), written via `setData`
   (`src/redux/slices/authSlice.js` on login) and read on every request
   (`src/axiosClient/index.js:22`). Any XSS anywhere in the app (see finding 1) can read this
   token directly (`localStorage.getItem('access-token')`) and exfiltrate it — full account
   takeover for as long as the token is valid, with no way for the backend to invalidate it early
   short of a token-revocation list (not something this repo can attest to). **Fix**: this is an
   architectural change (httpOnly cookie + CSRF token, or a short-lived access token with silent
   refresh) that has to happen alongside the backend — flagged for the owner as a cross-repo
   decision (§19), not a one-file fix.
3. **Low-Medium — 401 handling force-reloads the page and does not check token freshness
   proactively.** `src/axiosClient/index.js:43-49`/`hempIndex.js:43-49`: on any 401 the app does a
   hard `window.location.href = "/login"`. Combined with finding-4 below (`PrivateRoute` doesn't
   check expiry, only presence), a user with an expired-but-present token sees the full private UI
   render once, then gets yanked mid-interaction on the first API call — not a vulnerability by
   itself, but a UX/reliability finding with a security-adjacent cause (weak client-side session
   validity model).
4. **Low — Route guard checks token *presence*, not *validity*.**
   `src/HOC/PrivateRoutes.jsx:5-11` only checks `isAuthenticated` from `isLoggedIn()`, which itself
   only checks `if (user.access_token) return {isAuthenticated:true}`
   (`src/utilities/common/index.js:141-145`) — no expiry/format check. Purely a UX gap (real
   enforcement is the backend rejecting the expired token on the next call) but worth listing since
   it means the client cannot distinguish "logged out" from "logged in with a dead token" until a
   network round-trip happens.
5. **Low — Static, shared `X-API-KEY` sent from the browser on every request**
   (`src/axiosClient/index.js:9-11`, value from `REACT_APP_API_AUTH_KEY`). Because CRA inlines env
   vars into the built JS bundle, this key is **visible to anyone who opens devtools** on the
   deployed app — it provides no real access control (it's trivially extractable), so whatever the
   backend uses it for (rate limiting? a coarse "is this our official frontend" gate?) should not
   be treated as a secret. Not independently confirmed what the backend does with this header —
   flagged as a design smell, severity capped at Low because a static, publicly-embedded value
   cannot itself be a meaningful access boundary regardless of backend enforcement.
6. **Informational — no Content-Security-Policy** found in `public/index.html` or any CRA-level
   config. A CSP would meaningfully reduce the blast radius of finding 1.
7. **Not applicable to this repo** (belongs to the backend): IDOR, NoSQL/SQL injection, mass
   assignment, CORS policy, webhook signature verification, rate limiting on login/OTP, JWT
   signing/expiry configuration. None of these can be assessed from client code alone; the closest
   this repo comes is that login is a plain POST with no visible client-side rate-limiting or
   CAPTCHA (`src/redux/apis/auth.js:5`) — whether the backend rate-limits `/api/v1/admin/login` is
   unverifiable here.
8. **File upload validation is client-side-only and trivially bypassable**
   (`src/components/homepageBanner/index.jsx:69-83`): file-type checking is a regex on the
   **filename string** (`/(\.jpg|\.jpeg|\.bmp|\.gif|\.png)$/i`), not the file's actual content/MIME
   type, and happens only in the browser before upload — renaming a malicious file
   `payload.php.png` defeats it entirely. Severity depends entirely on what the backend does with
   the uploaded bytes (unverifiable from this repo) — listed as Low/Informational here since the
   real control point is server-side, but worth the backend team's attention.

## 15. Performance findings

1. **Confirmed — O(n) linear `.find()` inside `.map()`, repeated per filter chip render.**
   `src/components/products/FilterProducts.jsx:68-69,85-86,173-174,180-181`: for every selected
   category/brand id, the code does
   `payload.categoryId?.map(id => categoriesData.categories?.find(c => c.categoryId === id))`
   — for `k` selected filters against `n` categories this is `O(k·n)` on every relevant render,
   instead of building a `Map<id, category>` once and doing `O(k)` lookups. With category/brand
   lists fetched at `limit: 1000` (`src/App.js:90,93`), `n` can be large. This is the metrics
   tool's `find_without_limit` category, but that name is misleading for a frontend — **it is not
   an unbounded database query** (there is no database here); it's a real but different
   performance smell (repeated linear scan), verified independently.
2. **Confirmed false positive to correct in the metrics pass**: the same `find_without_limit`
   category also flagged `src/bluetooth/main.js:265,281` and
   `src/common/CommonDrawer/AddBatchDrawer.jsx:196` — these are `Array.prototype.find()` over
   small, already-in-memory arrays (Bluetooth device list, form option list) with no
   performance concern at all. Only the `FilterProducts.jsx` cluster above is a genuine finding.
3. **Confirmed — unconditional, unpaginated bootstrap fetches on every app load.**
   `src/App.js:89-94` fires `fetchBrands({limit:1000})`, `fetchInfoEffect()`, `fetchAllRegions()`,
   `fetchCategories({limit:1000})` on mount, **before checking whether the user is authenticated**
   — an anonymous visitor hitting `/login` still triggers four backend calls, two of them
   requesting up to 1000 records each, every page load/refresh.
4. **Confirmed — dual date libraries.** Both `moment` and `dayjs` are imported in the same hot
   utility file (`src/utilities/common/index.js:1-2`) — pure bundle/parse-cost waste, no
   functional benefit, easy to consolidate onto `dayjs` (already the dominant one — 5 of 6
   formatter functions in that file use it).
5. **Not measured**: actual production bundle size, Lighthouse/Web Vitals, network waterfall,
   polling intervals beyond what's visible in source (no build was run, per the read-only
   constraint). If the owner wants real numbers, a `npm run build && npx source-map-explorer` pass
   (in a disposable environment, not this checked-out worktree) would answer bundle-size questions
   directly.

## 16. Ten things a new developer would trip over

1. The main auth Redux slice is named `msalSlice`/`msalReducer`
   (`src/redux/slices/authSlice.js:123`, `src/redux/store.js:2,39`) as if this app uses Microsoft
   Azure AD/MSAL SSO. It does not — auth is a plain JWT POST. The name is inherited from a
   template and never renamed.
2. `.env.example` lists `REACT_APP_METRC_BASE_URL`, `REACT_APP_HYPERWOLF_BASE_URL`, and
   `REACT_APP_METRC_ACCESS_1/2/3` — none of which are used anywhere in `src/`. A new developer
   will reasonably try to fill these in and wonder why nothing changes.
3. `src/socket.js:4` hardcodes a personal ngrok tunnel URL for local dev — sockets will silently
   fail to connect locally until someone edits this file or an env-var alternative is added.
4. Two axios clients (`axiosClient` vs `axiosHempClient`) look interchangeable (identical code,
   §6/§12) but point at **different backends** — picking the wrong one for a new endpoint will
   fail confusingly (404/wrong-shape response) rather than obviously.
5. `src/redux/slices/regions.js` has two different `initialState`-shaped objects in the same file
   (§12) — reading the top one (the dead one, with `products`/`singleProduct` fields) gives a
   completely wrong mental model of what the `regions` slice actually holds.
6. The dev server runs on port **3001**, not CRA's default 3000 (`package.json` `start` script:
   `PORT=3001 ...`), while the dead MSAL config in `src/index.js:50` hardcodes `redirectUri:
   'http://localhost:3000'` — a stale artifact that could mislead someone debugging auth, even
   though it's unreachable dead code.
7. `src/redux/slices/settings/CreditCardFee.js` exists, has thunks, but is **not registered** in
   `src/redux/store.js` — any component that tries `useSelector(state => state.creditCardFee)`
   (or similar) gets `undefined` with no error until it's dereferenced.
8. Form validation looks like it might use `yup` (it's in `package.json`, and schema-shaped
   validation is a common CRA pattern) — it doesn't; every validator is a hand-written function in
   `src/validations/*.js`, and some entity-level checks (email/phone) are duplicated rather than
   shared (§12), so "fix the email regex" has to be done in more than one place.
9. `PERMISSIONS_REFACTOR.md` and `src/hooks/usePermissions.js`'s own JSDoc say "always use this
   hook, don't re-parse localStorage in components" — but `src/App.js` itself does exactly that in
   several places (`getData('login-user-info')`, `src/App.js:96,152,189` etc.) rather than using
   the hook, so the codebase doesn't follow its own documented convention at the composition root.
10. The repo's own `CLAUDE.md` (`src/../CLAUDE.md`, repo root) is a genuinely accurate, well-
    maintained internal doc (verified several of its specific claims against code in this audit
    and found no contradictions) — a new developer who skips reading it will re-discover several
    of the above the hard way.

## 17. Grade inputs

| Axis | Score | Justification (single strongest citation) |
|---|---|---|
| Simplicity | 4/10 | `src/components/POS/OrderDetailsView.jsx` is 2233 lines with 85 commented-code-hint lines (metrics) — several other files exceed 1000 lines (§4 biggest-files list); logic, data-fetching, and presentation are not separated. |
| Speed | 5/10 | Unpaginated `limit:1000` bootstrap fetch on every load, pre-auth (`src/App.js:89-94`, §15-3) is the clearest concrete cost; no measured runtime numbers exist to grade further. |
| Security | 4/10 | Unsanitized `dangerouslySetInnerHTML` from user-authored rich text with zero sanitizer dependency in `package.json` (§14-1) is a real stored-XSS path into a `localStorage`-held bearer token (§14-2). |
| Data modelling | 4/10 | `src/redux/slices/regions.js:4-9` carries a dead, copy-pasted `initialState` with fields (`products`, `singleProduct`) that don't belong to the domain it's named for — evidence the "model" was never designed, only copy-pasted per feature. |
| Reuse vs hardcoding | 3/10 | `yup` is a declared dependency and zero validation uses it; 17 hand-rolled validators duplicate `isValidEmail`/`isValidPhone` across files (§12) instead of one shared schema. |
| Testing | 1/10 | Zero test files against 87,888 source lines; neither deploy workflow runs `npm test` (§9). |
| Upgradability | 3/10 | The entire toolchain sits on `react-scripts` (CRA), unmaintained since 2023, with no `engines` field and no Dockerfile pinning the Node version anywhere (§2) — a Node major bump has no compatibility gate at all before it reaches a developer's machine or CI. |
| Operability | 3/10 | Zero client-side error-tracking SDK (§10) and deploys build in-place on the target VPS via SSH with no rollback step (`dev.yml`/`stage.yml`, §10) — a broken build can leave production half-updated with nothing surfacing the failure beyond the CI log. |
| Developer experience | 4/10 | The repo's own `CLAUDE.md` is genuinely good, but the codebase actively contradicts its own documented conventions in the composition root (`src/App.js` re-parsing localStorage instead of using `usePermissions`, §16-9) — good docs undermined by code that doesn't follow them. |

## 18. Quick fixes (<1h each), ranked by impact per hour

1. Delete the dead MSAL block in `src/index.js:14-90` and the fully-commented
   `src/layouts/authentication/sign-in/authService.js` — zero risk, removes the single most
   misleading piece of dead code in the repo (§3, §16-1).
2. Wire `REACT_APP_SOCKET_URL` (new env var) into `src/socket.js:4` instead of the hardcoded ngrok
   URL, falling back to `window.location.origin` in dev if unset — unblocks local dev sockets for
   any new contributor (§8, §16-3).
3. Register `settings/CreditCardFee` in `src/redux/store.js`, or delete the slice/its thunks if
   it's genuinely unused — resolves the silent `state.???` `undefined` trap (§16-7).
4. Remove the six unused env vars from `.env.example` (`REACT_APP_METRC_*`,
   `REACT_APP_HYPERWOLF_BASE_URL`) or, if they're for a genuinely planned feature, add a one-line
   comment saying so — stops the next developer from chasing a config that does nothing (§16-2).
5. Delete `msal`, `openai`, `tesseract.js`, `mrz`, `yup` (if the decision is to keep hand-rolled
   validation), `redux` (superseded by the `@reduxjs/toolkit` re-export) from `package.json` —
   shrinks `npm install`/CI time with zero behavior change (§13).
6. Fix the duplicate `isDeleting` key in `src/redux/slices/brand.js:27-32` and enable
   `eslint-config-react-app`'s default `no-dupe-keys` as a CI-blocking lint step (there is
   currently no `lint` script and no lint step in either CI workflow) — catches this whole class of
   mistake going forward (§12).
7. Add `DOMPurify.sanitize()` at the 16 `dangerouslySetInnerHTML` call sites listed in §14-1 —
   the single highest-value security fix available in under an hour, since it's a drop-in wrapper
   with no data-model change required.
8. Delete `src/redux/slices/regions.js:4-9` (the dead top-level `initialState`) — pure deletion,
   zero behavior change, removes the misleading duplicate (§12, §16-5).
9. Sync `public/firebase-messaging-sw.js`'s hardcoded config with `src/firebaseInit.js`'s (find
   the source of truth, delete the other) so the two can't silently drift (§8, §11-3).
10. Add `npm test` (even as a no-op placeholder that fails loudly if a test file ever appears) and
    `npm run build` (a build failure gate, not just `npm audit`) as required checks before either
    deploy workflow runs — currently a broken build could theoretically still deploy since neither
    workflow's trigger condition depends on a successful local build check beyond the SSH script's
    own `npm run build` step succeeding on the target box itself, with no pre-flight in CI.

## 19. Open questions (for the owner/contractor, not decidable from code)

1. Is there a production deploy pipeline for this repo at all? Only `dev.yml` (host `thcs.in`) and
   `stage.yml` (IP `54.81.94.241`, branch `fullfillment-task-dev`) exist — no `prod.yml`/`main.yml`
   equivalent was found (§10). If prod deploys manually or from a different repo, that should be
   documented; if it doesn't exist yet, that's a gap worth knowing about explicitly.
2. What does the backend actually do with the static, browser-visible `X-API-KEY` header (§14-5)?
   If it's meant as an access-control boundary, that's a design issue spanning this repo and the
   backend; if it's just a coarse bot filter, it should be documented as such so nobody mistakes it
   for real security.
3. Is `REACT_APP_HYPERWOLF_BASE_URL`/`REACT_APP_METRC_BASE_URL` in `.env.example` (§16-2) a sign
   that METRC or a Hyperwolf-backend integration is planned/half-built for this app, or pure
   template leftover from the `hyperwolf-super-admin` sibling this repo was cloned from? Only the
   owner or original author can say which.
4. Given the 4,146-line overlap with `hyperwolf-super-admin` (§12), is there an intent to extract
   the shared Material Dashboard 2 template + shared business-logic slices (regions, memberships,
   inventory, credit-card-fee, roles/permissions) into a common package, or are these two
   codebases expected to diverge permanently as separate brand-specific products? This determines
   whether the duplication above is "debt to pay down" or "acceptable cost of two independent
   products" — not a call this audit can make.
5. Is client-side session storage in `localStorage` (§14-2) an accepted risk for this
   application's threat model (internal admin tool, presumably behind some network/VPN
   restriction not visible from the repo), or should it be prioritized for a cookie-based
   session redesign? That tradeoff depends on deployment context this repo doesn't expose.
