# stilo-frontend-nextjs — audit @ 23f5e62

Repo: `/Users/jt/hyper-tech/stilo-frontend-nextjs`. Read-only audit; no files modified. Metrics
pass consulted: `/Users/jt/POS-Admin/docs/codebase-audit/metrics/stilo-frontend-nextjs.md` (and
`.json`); its numbers are corrected below where verification found them wrong.

## 1. Purpose

Customer-facing e-commerce storefront for Stilo, a cannabis/hemp delivery retailer (one of the
Hyper-Tech-inc brands). Next.js 15 App Router + React 19, JavaScript/JSX (no TypeScript despite a
`tsconfig.json` present — that file exists only to support `@types/node` and the `@/*` path
alias; there are zero `.ts`/`.tsx` source files). It renders the shop catalog, cart, checkout,
account, blog/CMS pages, and sitemaps, and talks to three separate backend services owned by
other repos in this estate (none of which were audited here — see §6).

## 2. Runtime & framework

- `package.json` `engines`: `{"node": ">=18 || <=20", "npm": ">=10 || <=11"}`. **Node 18 reached
  EOL 2025-04-30** (confirmed against the standard Node.js release schedule, not a code comment)
  — the engines range still permits an EOL runtime today (2026-09-09). Not itself a code bug, but
  it means CI/servers running Node 18 get zero security patches.
- Framework versions (`package.json:22,30,33`): `next: ^15.1.9`, `react: ^19.2.4`,
  `react-dom: ^19.0.0` (React and react-dom versions themselves are inconsistent — `^19.2.4` vs
  `^19.0.0`, both caret), `@reduxjs/toolkit: ^2.8.1`, `axios: ^1.7.9`, `yup: ^1.6.1`.
- **No lockfile** (`package-lock.json` is explicitly listed in `.gitignore:9` and no
  `yarn.lock`/`pnpm-lock.yaml` exists). Combined with 44 caret-pinned deps and 2 exact, this means
  every `npm i` — including the one the deploy workflow runs on every push (`.github/workflows/dev.yml:16`)
  — can silently resolve different transitive versions than what was last tested. This is the
  single biggest reproducibility/security risk in the repo: there is no way to know what actually
  ships without re-deriving the dependency tree by hand.
- No Dockerfile, no `.nvmrc`. Deployment is bare-metal SSH + pm2 (see §10).
- DB/ORM: not applicable — this is a pure frontend with zero server-side data storage (`next_api_routes: 0`,
  confirmed by `find app -name route.js` returning nothing).

## 3. Entry points & boot

- `app/layout.js` is the root layout: loads a local font (`gotham`), mounts `redux/Providers.js`,
  and injects third-party scripts directly in JSX (Google Maps, Reviews.io ×4, Intercom, GTM) —
  see §8.
- `redux/Providers.js:20-50` runs a `useEffect` on every client mount that calls
  `GET cart/active` directly via the raw axios client (bypassing the documented
  `services/handleApiRequest.js` wrapper that the rest of the app is told to use — see §12) and,
  if `pathname === "/checkout"`, immediately fires `prepareCart` with **hardcoded**
  `regionId: "HcrzXJ159dcDw77pFvnm"` and `inventoryId: "odkEgmqfW3MDJJedc3QJ"`
  (`redux/Providers.js:42-43`) — opaque IDs baked into the client bundle for what looks like a
  single store/region, with no visible fallback for any other store.
- `middleware.js` runs on almost every request (matcher excludes `api`, `_next/static`,
  `_next/image`, `*.png`) and does three things: auth-gate `/my-account/*`, bounce authenticated
  users off `/login` etc., and resolve/set a `storeId` cookie by calling the backend
  (`middleware.js:64`). It also unconditionally `console.log`s the request's user-agent
  (`middleware.js:48`) on every non-excluded request — noise in production logs, not gated behind
  any debug flag.
- Global mutable state: none beyond the Redux store (client-only; `redux/store.js:6-10` disables
  `serializableCheck`) and cookies (`authUser`, `storeId`, `sessionId`, `savedAddress`,
  `rememberedUser` — all read/written ad hoc from many files via `js-cookie`, not through one
  accessor).

## 4. Directory map

| Dir | Role | Size (from metrics) |
|---|---|---|
| `app/` | Next.js App Router pages, route groups, and shared page-level components under `(_components)` | 240 `.jsx` files, bulk of the 25,163 source lines |
| `axios/` | 3 near-duplicate axios client wrappers (main/HyperWolf/HyperWolf-Web), see §12 | 3 files |
| `components/` | shadcn/ui primitives (`components/ui`) + ~60 hand-written SVG icon components (`components/icons`) | small |
| `hooks/` | 2 hooks: debounce, remove-anchor-target | 2 files |
| `lib/` | constants, helpers (geocoding, formatting), SEO JSON-LD builders, `usStates.js`, `cn()`/toast utils | 6 files |
| `redux/` | Toolkit store; 6 slices (`auth`, `common`, `cart`, `alpine`, `addresses`, `strain`) — half are dead, see §5 | 14 files |
| `server/` | 1 file, 3 tiny server-action wrappers around `handleServerApi` | 1 file |
| `services/` | 6 files: 3 near-duplicate server-fetch wrappers, `handleApiRequest.js`, `handleActiveCart.js`, `handlePersonFlow.js` | 6 files |
| `validations/` | Yup schemas (auth, contact, common: phone/address/email) | 3 files |
| `public/` | Static assets, fonts, Lottie JSON animations — **50MB total**, two single JSON files are 28MB and 8.4MB (§15) | 50MB, 85+ files |
| `docs/` | `architecture.md`, `components.md`, `development-guidelines.md` — verified accurate against code, no contradictions found | 3 files |

## 5. Data model summary

This is a frontend with **zero backend models** (`models: 0` in metrics is correct — there is no
ORM/schema here). What exists is client-side *shape* knowledge: Redux slice state and the JSON
shapes the UI destructures out of API responses. Full field-by-field detail is in
`stilo-frontend-nextjs.datamodel.md`. Summary:

- **6 Redux slices** (`redux/reducer.js:10-17`): `auth`, `common`, `cart`, `alpine`, `addresses`,
  `strain`. Of these, **3 are dead weight**: `alpineSlice` (`redux/alpineSlice/slice.js`),
  `addressSlice` (`redux/addressSlice/slice.js`), and `strainSlice` (`redux/strainSlice/slice.js`)
  all have empty `extraReducers` and their state (`state.alpine`, `state.addresses`,
  `state.strain`) has **zero read sites** anywhere in the app (verified: `grep -rn "state\.alpine\|state\.addresses\|state\.strain"` returns nothing). Their `thunk.js` files *are* live
  (dispatched via `handleApiRequest` and consumed from the resolved promise directly, e.g.
  `app/(headerLess)/checkout/page.jsx:274`), but the slice/reducer plumbing around them was never
  wired up — pure boilerplate cost with no behavior.
- **Money** is a plain JS `Number`, in **dollars** (not cents), computed server-side and rendered
  client-side with `.toFixed(2)` (`app/(main)/shop/components/productDetails.jsx:398,401,416,480`).
  Formatting is inconsistent: line 435 in the same file (`${salePrice || unitPrice}`) skips
  `toFixed` entirely, so a price with float error (e.g. `19.989999999998`) would render raw.
- **IDs**: two ID schemes coexist per entity — a Mongo-style `_id` and a separate `memberId` /
  `productId` / `orderId` string (e.g. `redux/authSlice/slice.js:14-33` carries both `_id` and
  `memberId`). Nothing in this repo indicates which one is canonical; that's a backend question
  (§19).
- **Timestamps**: raw epoch millis from the API (`createdDate`, `updatedDate` — see mock data at
  `app/(_components)/authComponents/signup.jsx:117-118`), formatted client-side via
  `lib/helpers.js:17-50` (`formatDate`, `formatDateTime`, `formatDateWithTimezone`).
  `formatDateTime` hardcodes `timeZone: "America/Los_Angeles"` (`lib/helpers.js:37`) — correct for
  a single-region cannabis retailer today, but a latent bug if Stilo ever operates outside
  Pacific time.
- **Multi-tenancy key**: `storeId`, resolved once via `middleware.js` and cached in a cookie; every
  subsequent product/cart/order call threads `storeId` through as a query param
  (`redux/cartSlice/thunk.js:59-62`, `server/actions.js:15-21`).
- **No soft-delete convention visible** — this repo never deletes anything; it only ever fetches
  and displays.

## 6. API surface

- **Not a Node/Express API** — 0 route handlers, 0 Next.js `app/api/*` routes (confirmed: `find app -name route.js` / `route.jsx` returns nothing; `next_api_routes: 0` from metrics is correct).
  "API surface" here means the 30 `page.jsx` routes (listed in full in §4/route table below) plus
  how they call three **separate, unrelated backend services**, verified in code:

  | Backend | Env var(s) | Client wrapper | Server (RSC) wrapper |
  |---|---|---|---|
  | Main commerce API | `NEXT_PUBLIC_API_BASE_URL` + `NEXT_PUBLIC_API_VERSION` | `axios/axiosSetup.jsx` | `services/handleServerApi.js` |
  | HyperWolf API | `NEXT_PUBLIC_HYPERWOLF_BASE_URL` | `axios/axiosHyperWolf.jsx` | `services/handleHyperWolfServerApi.js` |
  | HyperWolf Web API | `NEXT_PUBLIC_HYPERWOLF_WEB_BASE_URL` | `axios/axiosHyperWolfWeb.jsx` | `services/handleHWserverApi.js` |

- **Auth mechanism, verified — this is the headline finding.** There is **no bearer token, no
  JWT, no session header anywhere in this codebase.** Every one of the three axios wrappers has
  an `attachAccessToken` interceptor whose only live line is
  `config.headers["x-api-key"] = API_KEY;`; the `Authorization`/`Bearer` lines are commented out
  in all three files (`axios/axiosSetup.jsx:12-14`, `axios/axiosHyperWolf.jsx:13-16`,
  `axios/axiosHyperWolfWeb.jsx:13-16`). `API_KEY` comes from `NEXT_PUBLIC_API_KEY`
  (`axios/axiosSetup.jsx:6`) — a `NEXT_PUBLIC_*` var is inlined into the client JS bundle at build
  time, so it is **the same static string visible to every visitor**, not a per-user credential.
  "Logged in" state is represented purely by an **unsigned JSON cookie**, `authUser`
  (set at `redux/authSlice/slice.js:55,89,128` via `Cookies.set("authUser", JSON.stringify(userData))`
  with no `httpOnly`/`secure` flags and no signature) — a client can edit this cookie in devtools
  to any `{"_id": "...", "memberId": "..."}` value they want and every consumer here
  (`middleware.js:28-30`, `app/(headerLess)/checkout/page.jsx:274` etc.) trusts it. Member-scoped
  calls then pass that client-supplied `memberId` as a **plain request parameter**
  (`redux/cartSlice/thunk.js:23-24`; `getMemberPaymentStatus(authUser.memberId)` at
  `app/(headerLess)/checkout/page.jsx:631`; `getMemberDetails(memberId)` in
  `redux/authSlice/thunk.js:125-135`). Whether this is actually exploitable depends entirely on
  whether the backend (a different repo, not audited here) re-validates identity server-side — but
  from this repo's vantage point, the frontend sends **nothing** that could let a backend
  distinguish "the real member" from "an attacker who typed a memberId." Flag this to the backend
  auditor explicitly.
- **Confirmed IDOR at the route level**: `app/(main)/order/[orderId]/page.jsx:38-44` fetches
  `order/${orderId}` using only the `orderId` **URL path segment** — the `authUser` cookie is read
  at line 40 but used *only* to pick the "Back to Orders" link target (line 67), never to scope or
  verify the order fetch. `/order/<anything>` is also outside `middleware.js`'s `protectedRoutes`
  (only `/my-account` is protected), so this page is reachable by anyone, logged in or not. Anyone
  who can guess or enumerate an `orderId` gets a full order receipt (items, delivery address,
  payment status) rendered server-side, no session required.
- **Role checks**: none found. There is no admin/staff surface in this repo; `memberType` is a
  string enum (`"AdultUse"` / `"MedicinalUser"`, e.g. `validations/authSchema.js:22`) used only for
  medical-vs-recreational form branching, not access control.
- **Input validation**: Yup schemas via Formik (`validations/authSchema.js`, `commonSchemas.js`,
  `contactUsSchema.js`) on forms client-side only — there is no server here to duplicate/enforce
  it. Password policy is weak by design: `min(6)` with the complexity regex **commented out** in
  four places (`validations/authSchema.js:14-17,65-67,77-79`) — signup, login, and reset all
  accept a 6-character password with no character-class requirement.
- **Pagination**: ad hoc `page=`/`limit=`/`skip=` query params per-endpoint (e.g.
  `admin/physicians/list?page=1&limit=100` — `redux/authSlice/thunk.js:105`), no shared
  pagination helper or convention document.
- **Error response shape**: not this repo's to define, but consumption is consistent:
  `error?.response?.data?.message || error?.message` (12 sites), surfaced via one shared
  `errorMsg()` toast (`lib/utils.js:18-31`).
- **Auth token storage**: unsigned cookies via `js-cookie` (not `httpOnly`, readable/writable by
  any JS on the page — see XSS-amplification note in §14).
- **SSR vs CSR**: hybrid, correctly used for what it is — catalog/CMS/order pages are Server
  Components fetching via `serverApi.get()` with `next: { revalidate }` (ISR), while cart/checkout/
  account/forms are `"use client"` (58 of 115 `app/**/*.jsx` files carry `"use client"`) driven by
  Redux thunks.
- **Versioning**: `NEXT_PUBLIC_API_VERSION` is concatenated into the main API's base URL
  (`axios/axiosSetup.jsx:5`) — a single global version pin, no per-endpoint versioning.

## 7. Background jobs

None. This is a request/response frontend with no cron, no queue, no server-side timers. The only
scheduled-feeling thing is Next's ISR `revalidate` on server fetches (e.g.
`server/actions.js:4-13`, 3600s), which is framework-managed caching, not a job.

## 8. Third-party integrations & secrets

| Integration | Wrapper/location | Credential source | Notes |
|---|---|---|---|
| Persona (IDV) | `services/handlePersonFlow.js`, `app/(_components)/authComponents/signup.jsx:190-227` | `NEXT_PUBLIC_PERSONA_TEMPLATE_ID`/`_ENVIRONMENT_ID` (client-exposed, expected for this SDK) | `onError`/`onCancel` handlers swallow errors silently (empty `catch` at `signup.jsx:216`) |
| Didit (alternate IDV) | `redux/authSlice/thunk.js:137-171`, `app/(_components)/common/DiditModal.jsx` | via main API | Two competing identity-verification vendors live in the same signup flow (Persona and Didit), gated by a `personaStatus === 'active'` flag (`signup.jsx:157`) — meaning at any time exactly one is "the" active vendor and the other's code path is dead but still shipped |
| Google Places/Maps | `app/layout.js:46-51` (script tag), `lib/helpers.js:132-186` | `NEXT_PUBLIC_GOOGLE_PLACES_KEY` (client-exposed — normal for a Maps JS key, but confirm it's referrer-restricted in Google Cloud console, which isn't visible from this repo) | — |
| Reviews.io | `app/layout.js:54-57` | none (public widget scripts) | 4 separate `<Script>` tags all `lazyOnload` |
| Intercom | `app/layout.js:59-97` | hardcoded `app_id: "lipka71t"` inline in a `dangerouslySetInnerHTML` script | Not a secret (Intercom app IDs are public by design) but still a hardcoded config value that should be an env var like every other integration here |
| Google Tag Manager | `app/layout.js:100-112,125-134` | `NEXT_PUBLIC_GOOGLE_ANALYTICS_MANAGE_KEY` | — |
| No webhooks are received by this repo | — | — | It's a pure frontend; nothing here needs signature verification because nothing here has an inbound webhook endpoint |

No committed secrets found (`grep` for common secret patterns returned none; matches the metrics
pass's "secrets: none matched" — spot-checked, agree). `.env*` is gitignored except
`.env.example` (`.gitignore:24-26`), and `.env.example` contains only empty placeholders
(`.env.example:1-13`) — clean.

## 9. Tests

**Zero.** No test dependency in `package.json`, no test files anywhere in the tree, no `test`
script (confirmed: `scripts` in `package.json:5-12` has no `test` entry). `docs/README.md:33` and
`CLAUDE.md:20` both state this plainly — accurate self-reporting, not a doc/code mismatch. There
is no lint-on-CI either: `.github/workflows/dev.yml` runs `npm i && npm run prod` directly with no
`npm run lint` or build-check gate before deploying to production.

## 10. Build & deploy

- `npm run build` (`next build`) / `npm run start` (`next start -p 3053`, always non-default port
  3053) / `npm run prod` (`next build && pm2 restart stilo-nextjs`).
- **Deploy pipeline** (`.github/workflows/dev.yml`): push to `development` → SSH into host
  `thcs.in` using a **username/password** pair from GitHub Secrets (`appleboy/ssh-action`,
  password auth, not a keypair) → `git stash` (silently shelves any uncommitted server-side state)
  → `git pull origin development` → `npm i` (no lockfile, see §2) → `npm run prod`. There is no
  staging environment, no smoke test, and no rollback step in this workflow — a bad push goes
  straight to what pm2 calls `stilo-nextjs` in production.
- Second workflow, `.github/workflows/aiCodeReviewer.yml`, runs an LLM PR reviewer
  (`galihlprakoso/llm-ai-code-reviewer-action`) whose own `codebase_high_overview_descripton`
  field literally describes *itself* ("This repository is an LLM Code Reviewer Github Action...")
  — copy-pasted from the action's own example config and never customized for this repo. Cosmetic,
  but it means the AI reviewer has been running with the wrong context on every PR since it was
  added.
- Environment separation: `NEXT_PUBLIC_REACT_APP_ENV === "production"` gates search-engine
  indexing (per `README.md:47`, not independently re-verified beyond grepping the string — this
  claim is stated by the doc and is consistent with standard Next.js patterns, flagged as
  doc-sourced). No separate staging URL/config found in-repo.
- Logging/monitoring: none beyond `console.log`/`console.error` scattered through the code (10
  `console.log` + more `console.error` sites per the metrics pass) and whatever pm2's own log
  capture provides on the host. No Sentry/error-tracking SDK, no structured logging.

## 11. Hardcoded values

Corrected counts (metrics regex leads, verified):

- **URLs** — 44 hits/20 files per metrics; spot-checked `lib/constants.js:20-25` (social media
  links to generic homepages, e.g. `facebook.com` not `facebook.com/stilosupply` — likely
  placeholder that was never filled in) and `app/layout.js` (8 hardcoded widget/script URLs,
  reasonable for third-party script tags, not really "should be config").
- **Two opaque IDs baked into a `useEffect`**: `regionId: "HcrzXJ159dcDw77pFvnm"`,
  `inventoryId: "odkEgmqfW3MDJJedc3QJ"` — `redux/Providers.js:42-43`. Worst finding in this
  category: unlike the URLs/contact info (which are legitimately static business facts), these
  look like they encode a specific store/region and are used unconditionally on every checkout
  page load regardless of which `storeId` the user actually resolved to.
- **Default address fallback**: `lib/constants.js:1-10` (`defaultAddress` — Long Beach, CA)
  used as the fallback address in cart, checkout, and `middleware.js:57-59` when no real address
  is known — reasonable as a single-market seed default, but should be data/config if Stilo ever
  expands past one metro.
- **~100 lines of dead mock "identity verification" data** at module scope:
  `app/(_components)/authComponents/signup.jsx:22-120` — `personaResponse`, `personaAddressResponse`,
  and `userData` constants containing a fabricated-but-realistic name, DOB, license number, S3
  photo URL, address, and email, none of which are referenced anywhere else in the file (verified:
  the only other `personaResponse` at line 234 is a function-local `const` that shadows the
  module-level one). This is hardcoded **and dead** — should be deleted, not converted to config.
- **Email/phone/ObjectId-shaped literals**: 3 email hits (`signup.jsx:34,55`, `lib/constants.js:15`
  — the last is the real, legitimate support contact address, the first two are inside the dead
  mock data above), 1 phone (`signup.jsx:115`, also dead mock data), 2 ObjectId-shaped strings
  (`signup.jsx:53,103`, same dead block). **Metrics' 3/2/1 hit counts are accurate**, but almost
  all of them are inside the one dead code block above, not scattered real hardcoding — the fix is
  one deletion, not a config migration.
- **Intercom app ID** `"lipka71t"` hardcoded in `app/layout.js:67,86` — should be
  `NEXT_PUBLIC_INTERCOM_APP_ID` for consistency with every other integration in this file.

## 12. Duplicated code

**In-repo — three near-identical axios client wrappers** (verified via `diff`):
`axios/axiosSetup.jsx`, `axios/axiosHyperWolf.jsx`, `axios/axiosHyperWolfWeb.jsx`. The only
differences across all three are the `API_BASE_URL` env var and, in one case, whether extra
`config` is spread into the `get()` call. Same shape, same interceptors, same five HTTP-verb
methods, ~100 lines duplicated ×3. Should be one `createApiClient(baseUrlEnvVar)` factory.

**In-repo — three near-identical server fetch wrappers**: `services/handleServerApi.js`,
`services/handleHyperWolfServerApi.js`, `services/handleHWserverApi.js` (verified via `diff` —
differences are the base URL, an unused `onError` callback param in one, and which of `cache` vs
`...options` gets passed through). Same fix: one factory function.

**Cross-repo**: this repo's job did not include re-running the full cross-repo duplicate scan (see
`/Users/jt/POS-Admin/docs/codebase-audit/metrics/CROSS-REPO-DUPLICATES.md` for leads involving
other repos); spot-check of that file's leads touching `stilo-frontend-nextjs` was not performed
in this pass — **not measured**, flag for a follow-up dispatch that has that file loaded.

**Dead-vendor duplication**: two competing identity-verification integrations (Persona and Didit)
implement the same "verify member identity" responsibility side by side (§8) — not code-identical,
but duplicated *capability*, permanently, by a runtime flag rather than a migration that removed
the old path.

## 13. Dependency risk

- `critters`, `node-sass`, `persona`, and `react-dom` are declared in `package.json` but the
  metrics pass found no static import — **verified partially**: `persona` is dynamically imported
  (`await import("persona")` at `app/(_components)/authComponents/signup.jsx:194`), so that one is
  a metrics false-positive (static-import regex misses dynamic `import()`). `react-dom` is used
  implicitly by Next/React's runtime, not a real "unused dep" either — another false positive.
  `critters` (inlines critical CSS; `next.config.mjs:12` sets `experimental.optimizeCss: true`,
  which depends on `critters` under the hood — so it's used indirectly by Next, not directly
  imported) is also likely a false positive of the same kind. **`node-sass` is genuinely
  unused-looking**: no `.scss` files exist anywhere in the tracked tree (`find . -name "*.scss"`
  returns nothing outside `node_modules`), despite both `CLAUDE.md:68` and `README.md:120`
  explicitly warning "check for `.scss` usage before assuming Tailwind-only" — that warning is now
  stale; there's nothing to check. `node-sass` itself is also a long-deprecated package (superseded
  by `sass`/dart-sass) — dead weight dependency, remove it.
- Everything else is a real dependency with real imports; no further "declared but unused" issues
  found beyond the above.
- No lockfile (§2) is the dominant dependency risk in this repo — it makes every other pinning
  question moot, since the actual resolved versions are never recorded anywhere.

## 14. Security findings

1. **Critical — no verifiable session identity anywhere in the client.** Every API client sends
   only a static, publicly-visible `x-api-key` (`axios/axiosSetup.jsx:15`, `axiosHyperWolf.jsx:18`,
   `axiosHyperWolfWeb.jsx:18` — same key baked into the JS bundle via `NEXT_PUBLIC_API_KEY`); the
   `Authorization`/`Bearer` code paths are commented out in all three files. "Logged in" is
   represented by an unsigned `authUser` cookie the client itself writes
   (`redux/authSlice/slice.js:55,89,128`). Any member-scoped call (order status, payment status,
   member details, wallet points) is only as safe as the backend's willingness to trust a
   client-supplied `memberId`/`_id` with no accompanying proof of identity. Fix: issue a real
   session token (JWT or opaque) at login, store it `httpOnly`+`secure`, send it as
   `Authorization: Bearer <token>`, and have the backend derive identity from the token — never
   from a request body/query field the client can set itself.
2. **High — confirmed order IDOR.** `app/(main)/order/[orderId]/page.jsx:44`:
   `serverApi.get(\`order/${orderId}\`)` — no member scoping, no auth check, and the route is
   outside `middleware.js`'s protected-route list. Anyone who can guess/enumerate an order ID can
   view another customer's name, delivery address, items, and payment status. Fix: gate this route
   in `middleware.js` (add `/order` to `protectedRoutes` or check ownership) **and** have the
   backend verify the requester's session owns that order — the frontend fix alone doesn't close
   this if the API endpoint has no such check either.
3. **Medium — unsanitized HTML from API/CMS content rendered via `dangerouslySetInnerHTML` with no
   sanitizer library in the dependency tree** (confirmed: no `dompurify`/`sanitize-html` in
   `package.json` or anywhere in the tree). 65 hits across 21 files per metrics (spot-checked and
   confirmed real, not a false positive): `app/(headerLess)/checkout/(_components)/checkout-view.jsx:867`
   renders `onlinePaymentStatus.blockedReason` (an admin-settable free-text field per its name) raw;
   `app/(_components)/Faq.jsx:31,36` and `app/(_components)/search/globalSearch.jsx:192,254,259`
   render `faq.question`/`faq.answer`/`item?.description` raw. If any of these fields can ever
   contain user- or partner-influenced text (support macros, admin notes), this is stored XSS.
   Given cookies here are not `httpOnly`, a successful XSS would be able to read/forge the
   `authUser` cookie directly, compounding finding #1.
4. **Medium — `next.config.mjs:5-11`**: `images.remotePatterns` allows `hostname: "*"` (any
   domain) combined with `dangerouslyAllowSVG: true`. This turns the built-in Next.js Image
   Optimization endpoint into an open image proxy that will fetch and (for SVG) render content
   from **any URL an attacker supplies** through the `/_next/image?url=` endpoint, which Next's own
   docs flag as an XSS/SSRF-adjacent risk when both are combined without a strict CSP on the image
   response. No CSP header was found anywhere in `next.config.mjs`'s `headers()` (`:24-33`, only
   sets `Cache-Control`).
5. **Low — weak password policy.** `min(6)` with no complexity check, complexity regex commented
   out in 4 places (`validations/authSchema.js:14-17,65-67,77-79`; also the reset-password schema).
   Client-side only, so this is at most a UX-level guard — see backend audit for whether the API
   enforces anything stronger.
6. **Low — deploy credentials are username/password over SSH**, not a keypair
   (`.github/workflows/dev.yml:11-14`, `appleboy/ssh-action` with `password:` set from secrets).
   Not this repo's secret to rotate, but worth flagging alongside the other repos' deploy configs
   if password-based CI-to-prod SSH is a pattern across the estate.
7. **Info — `middleware.js:49` bot-detection regex** (`/bot|crawl|slurp|spider|.../i`) is dead:
   it's computed into `isBot` but never referenced again in the function (the `if (!storeId)` block
   that follows doesn't check it — the commented-out line 52 shows it *was* meant to be
   `if (!storeId && !isBot)` and someone reverted to the unconditional version without removing the
   now-unused variable). Not a vulnerability, but a sign the store-resolution API call fires for
   every crawler hit too — see §15.

## 15. Performance findings

1. **28MB + 8.4MB Lottie JSON files shipped as static assets**: `public/lottie/NoSearchResult.json`
   (28MB) and `public/lottie/No404.json` (8.4MB) — an empty-search-results animation and a 404
   animation. Even lazy-loaded, these are 30+ MB of JSON for two rarely-hit UI states; a real
   perf/bandwidth cost for any user who does land on them (mobile users on a 404 or empty search
   would pull megabytes for a decorative animation). Fix: re-export these Lottie files at a sane
   complexity/frame count, or replace with a lightweight Lottie/CSS animation.
2. **`redux/Providers.js:20-50`** fires an uncached `cart/active` fetch on **every client-side
   navigation mount** (the `useEffect` has an empty dependency array but `Providers` wraps every
   page, so this runs once per full page load) using the raw axios client directly rather than the
   `handleApiRequest` wrapper the rest of the app is told to use — inconsistent with the documented
   pattern (`CLAUDE.md:52`) and bypasses the standardized error handling entirely.
3. **`find_without_limit` (17 hits/10 files, per metrics) is a false positive** — verified by
   reading the flagged lines (`app/(_components)/authComponents/medicalVerification.jsx:54`,
   `app/(_components)/common/categoryFilter.jsx:154`, etc.): every hit is
   `Array.prototype.find()` on an in-memory client-side array (e.g. finding a physician by id in an
   already-fetched list), not an unbounded database query. Correcting the metrics pass: **0 real
   unbounded-query findings** — there are no DB queries in this repo at all (§2/§6).
4. **`settimeout_in_handler`** (7 hits/7 files, per metrics) — spot-checked
   `app/(_components)/common/copyToClipboard.jsx:23` and `app/(_components)/Reviews.jsx:106`: both
   are short UI-feedback timeouts (e.g. reset a "copied!" state after 2s), not polling loops.
   Real, but low-impact.
5. **Bundle/dependency weight**: `node-sass` (unused, §13) still gets installed and can run its
   native-binary postinstall step for zero benefit. `critters` + Next's `optimizeCss` experimental
   flag (`next.config.mjs:12`) is an experimental Next.js feature as of the pinned version — worth
   re-checking against the installed Next 15.1.9's stability notes before relying on it in
   production (**not measured** — would require reading Next's own changelog, out of scope for a
   read-only repo audit).

## 16. Ten things a new developer would trip out over

1. Dev server runs on port **3053**, not 3000 (`package.json:6`) — easy to forget and get a
   confusing "port already in use" or "nothing loads" moment.
2. Three different axios clients that all look identical (`axios/axiosSetup.jsx` vs
   `axiosHyperWolf.jsx` vs `axiosHyperWolfWeb.jsx`) — picking the wrong one silently points at the
   wrong backend with no error until the response shape doesn't match.
3. `redux/alpineSlice`, `addressSlice`, `strainSlice` exist and look like real state but are
   permanently empty (§5) — a dev "fixing" a bug by reading `state.addresses` will get nothing,
   forever, and won't know why.
4. `app/(_components)/authComponents/signup.jsx:22-120` — ~100 lines of realistic-looking mock
   user/persona data sitting at the top of a live signup component; easy to mistake for
   still-in-use fixture data rather than dead code.
5. `middleware.js:49-50` computes `isBot` and then never uses it — looks load-bearing, isn't.
6. There is no lockfile (§2) — `npm i` locally may not match what's running on the server, and
   there's no way to `npm ci` here.
7. `redux/Providers.js:42-43` fires `prepareCart` with hardcoded `regionId`/`inventoryId` whenever
   `pathname === "/checkout"` — a dev adding a second store/region will hit checkout requests that
   silently target the wrong inventory unless they find and update this one `useEffect`.
8. `tsconfig.json` exists in a project that has zero TypeScript files — misleading signal that this
   might be (or be migrating to) TS.
9. `.github/workflows/dev.yml` deploys straight from a `git pull` + `npm i` + pm2 restart on every
   push to `development` — there's no PR gate, no build check, no tests; a broken commit reaches
   production the moment it's pushed to that branch.
10. Two identity-verification vendors (Persona and Didit) are both fully wired into
    `signup.jsx`/`authSlice`, switched by a runtime `personaStatus` flag (§8) — a dev debugging
    "why didn't Persona open" may not realize Didit is the active path for that store/session.

## 17. Grade inputs

| Axis | 1–10 | Justification | Citation |
|---|---|---|---|
| Simplicity | 5 | Route structure and Redux pattern are clean and consistently followed, but 3 dead slices and 3×2 duplicated API-client files add unnecessary surface | `redux/reducer.js:10-17`; `axios/axiosHyperWolf.jsx` vs `axiosHyperWolfWeb.jsx` |
| Speed | 5 | ISR/RSC used correctly for catalog pages, but two 8–28MB static JSON assets and a per-navigation uncached cart fetch outside the standard error-handling path drag it down | `public/lottie/NoSearchResult.json` (28MB); `redux/Providers.js:20-50` |
| Security | 2 | No real session token anywhere in the client; a confirmed IDOR on order receipts; unsanitized HTML rendering with no sanitizer dependency at all | `axios/axiosSetup.jsx:12-15`; `app/(main)/order/[orderId]/page.jsx:44` |
| Data modelling | 4 | Money-as-Number-in-dollars with inconsistent formatting, dual `_id`/`memberId` schemes, no canonical shape doc beyond what's inferred from destructuring | `app/(main)/shop/components/productDetails.jsx:398,435` |
| Reuse vs hardcoding | 4 | Three near-identical axios wrappers and three near-identical server-fetch wrappers that should be one factory each; ~100 dead lines of hardcoded mock PII-shaped data | `services/handleServerApi.js` vs `handleHyperWolfServerApi.js` vs `handleHWserverApi.js` |
| Testing | 1 | Zero tests, zero test tooling, no CI gate before deploy | `package.json:5-12` (no `test` script); `.github/workflows/dev.yml` |
| Upgradability | 5 | Business logic (thunks/services) is reasonably separable from the framework, but no lockfile means an upgrade of anything is untraceable, and Node 18 in the `engines` range is already EOL | `package.json:14-17` (engines); no lockfile in repo root |
| Operability | 3 | No structured logging, no error tracking SDK, deploy has no rollback/staging step, and `console.log` fires on every non-bot request in middleware | `middleware.js:48`; `.github/workflows/dev.yml` |
| Developer experience | 6 | Docs (`CLAUDE.md`, `README.md`, `docs/architecture.md`) are unusually accurate and were verified to match the code with no contradictions found — a real strength — but the dead-slice/duplicate-wrapper/hardcoded-mock traps in §16 undercut it | `docs/architecture.md` (verified accurate throughout this audit) |

## 18. Quick fixes (<1h each)

1. Delete the ~100 lines of dead mock data in `signup.jsx:22-120` (`personaResponse`,
   `personaAddressResponse`, `userData`) — zero risk, immediate clarity win.
2. Remove the unused `isBot` computation in `middleware.js:48-49` (or actually gate the storeId
   fetch on it, per the commented-out original intent at line 52) and delete the unconditional
   `console.log(userAgent)`.
3. Remove `node-sass` from `package.json` dependencies — confirmed zero `.scss` files exist.
4. Move the hardcoded Intercom `app_id` (`app/layout.js:67,86`) to `NEXT_PUBLIC_INTERCOM_APP_ID`.
5. Add `next test`/lint step to `.github/workflows/dev.yml` before the deploy step — even just
   `npm run lint && npm run build` as a gate would catch broken pushes before they reach pm2.
6. Commit a lockfile (`package-lock.json`, and remove it from `.gitignore:9`) — single highest
   ROI-per-minute fix in this repo for reproducibility.
7. Re-export or replace `public/lottie/NoSearchResult.json` (28MB) and `No404.json` (8.4MB) with
   smaller assets.
8. Add `/order` to `middleware.js`'s `protectedRoutes` as a stop-gap for the IDOR in §14 finding
   #2, while the real fix (backend-side ownership check) is scheduled.

## 19. Open questions

1. Does the backend actually validate that the `memberId`/`_id` a request claims matches an
   authenticated session, or does it trust whatever the frontend sends? This determines whether
   §14 finding #1 is "frontend looks insecure but backend covers it" or "the whole estate has no
   real per-user auth." Needs the backend audit(s) for the Main/HyperWolf/HyperWolf-Web APIs.
2. Is `order/${orderId}` (§14 finding #2) actually unguarded server-side too, or does that specific
   endpoint check ownership even though nothing else here does? Needs a backend-side check.
3. Which of Persona vs Didit (§8) is the currently-live vendor in production, and is the other one
   scheduled for removal, or intentionally kept as a fallback?
4. Are the hardcoded `regionId`/`inventoryId` in `redux/Providers.js:42-43` specific to a single
   store, and if Stilo operates (or plans to operate) more than one store/region, how is this
   currently not already broken?
5. Is `NEXT_PUBLIC_API_KEY` rotated on any schedule, given it's permanently visible in the shipped
   JS bundle to any visitor?
6. Was the SSH deploy password (`.github/workflows/dev.yml`) a deliberate choice over a keypair, or
   legacy from before keys were set up on `thcs.in`?
