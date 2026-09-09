# hyperwolf-frontend-nextjs — Codebase Audit

Repo: `/Users/jt/hyper-tech/hyperwolf-frontend-nextjs` · HEAD verified via `git rev-parse HEAD` =
`f419ef0d53e302c502740906a1c0e38c9679c216` (2026-09-08 18:42:13 +0530) · audited 2026-09-09,
READ-ONLY. `package.json` name: `hyperwolf-upgrade-nextjs`, version `5.0.23`.

Mechanical metrics pass: `/Users/jt/POS-Admin/docs/codebase-audit/metrics/hyperwolf-frontend-nextjs.md`
(+`.json`). Its counts are cited below only after verification; several were wrong and are
corrected in place (see §11, §13).

---

## 1. Purpose

A customer-facing cannabis delivery/pickup storefront for the Hyperwolf brand — browse → cart →
checkout → order tracking → account/loyalty. Confirmed from code, not README:

- It is a pure frontend: zero Next.js API routes (`app/**/route.ts` exists only for sitemap/llms.txt
  generation — 12 files, none are backend endpoints), zero DB/ORM code anywhere in the tree.
- It calls THREE separate backend APIs via three Axios clients defined in `lib/api/client.ts:21-46`:
  `hempClient` (product catalog/inventory — `hemp-backend`/`hemp-frontend-nextjs`'s sibling backend),
  `hyperwolfClient` (users/orders/cart/auth/loyalty — `hyperwolf-backend`), `distributionClient`
  (delivery logistics/regions/slots — `distribution-backend`). Default base URLs are hardcoded
  fallbacks pointing at real hosts: `lib/api/client.ts:4-6` (`api.direct.stage.hyperwolf.com`,
  `api.hyperwolf.prod.ths.agency`, `distribution-backend.js.thcs.in`).
- It also talks directly to a WordPress instance for blog/FAQ/footer content
  (`lib/constants.ts` — `FOOTER_MENU_WORDPRESS_URL`, `FAQ_WORDPRESS_URL`, `HYPERWOLF_WORDPRESS_URL`)
  and to a grab-bag of marketing/identity SaaS vendors (§8).
- Route tree (`app/shop/**`) confirms the domain: product browsing (`/shop/[type]/[subtype]`),
  cart/checkout (`/shop/checkout`), order tracking (`/shop/order-status`), account + loyalty
  (`/shop/my_account`), plus SEO surface (blog, author pages, 10 sitemap XML routes, `llms.txt`).

## 2. Runtime & framework

- **Node**: no `engines` field in `package.json` (confirmed absent — `grep -a engines package.json`
  returns nothing) and no `.nvmrc`/Dockerfile in the repo root. README.md:9 claims "Node.js 20+
  (verified with v20.20.2)" — that claim is enforced nowhere in the repo; any Node version can run
  `npm install`/`next build` and nothing will complain if it's wrong.
- **Framework versions** (`package.json`): Next `^16.1.6`, React `19.2.3` (exact), TypeScript `^5`,
  Tailwind `^4`, Zustand `^5.0.11`, `@tanstack/react-query` `^5.90.20` (declared but **not used** —
  see §13; contradicts `CLAUDE.md`'s claim "React Query manages client-side server state and
  caching" — no import of `@tanstack/react-query` exists anywhere under `app/`, `components/`,
  `lib/`, or `hooks/`, verified by repo-wide grep), Axios `^1.13.4`, Zod `^4.3.6`.
- **DB/ORM**: none. Confirmed — this is a frontend with no database of its own; metrics' "models: 0"
  is correct for that reason (see §5 for what "data model" means here instead).
- **TypeScript strictness**: `tsconfig.json:6` sets `"strict": true` — good default — but is
  substantially defeated in practice: 413 `any`-typed hits across 109 files (metrics, spot-verified
  in `lib/schema/schema-builders.ts` and `components/checkout/checkout-container.tsx`), 8
  `// @ts-ignore` suppressions (`lib/api/hooks/useCart.ts:` x4 + 4 others), and open index
  signatures (`[key: string]: unknown`) on the three most-used cart types
  (`types/cart.ts:145,165,200` — `Cart`, `ActiveCartData`, `PrepareCartPayload`), which let any
  extra field pass through those types unchecked.
- **Pinning / lockfile**: `package.json` uses caret ranges for 57 of 61 deps, exact for 4
  (`react`, `react-dom`, `@radix-ui/react-tabs`, and one more per metrics). **No lockfile exists**
  in the repo (`package-lock.json`/`yarn.lock`/`pnpm-lock.yaml` — none present; confirmed by
  directory listing). Combined with 57 caret-pinned deps, two `npm install` runs on two machines
  or two days can resolve materially different dependency trees — this is a real reproducibility
  gap, not a style nitpick, given `npm run build:prod` is what ships to production (`package.json`
  scripts).
- **EOL/CVE exposure**: not measured — no CVE database was queried. Next 16.x and React 19.2.x are
  current major versions as of the audit date, not EOL; specific CVE status of pinned Next/Axios/
  Next patch versions was not researched and is reported here as "not measured" rather than guessed.

## 3. Entry points & boot

- No `middleware.ts` exists at the repo root (confirmed: `find . -maxdepth 1 -iname 'middleware.ts'`
  returns nothing) — there is **no route-level gate** of any kind; every access-control decision in
  this app is made per-page, in application code (see §6, §14).
- Boot/layout: `app/layout.tsx` is the root layout. It statically injects, at module/render scope
  (not gated behind consent or feature flags): Reviews.io widget scripts (`app/layout.tsx:180-183`),
  an Intercom bootstrap snippet (`app/layout.tsx:181-186`), and a GTM bootstrap via
  `dangerouslySetInnerHTML` with a **static, hardcoded literal string** (`app/layout.tsx:184-192`,
  container id `GTM-554SLVC` hardcoded in the template literal, not env-driven).
- Global providers live under `components/providers/*` (not individually enumerated here — see
  `.datamodel.md` is not applicable; this is architecture, not data — but note `app/layout.tsx`
  is where they're composed).
- Global mutable client state = 6 Zustand stores under `lib/store/*`: `authStore.ts`, `cartStore.ts`,
  `deliveryStore.ts`, `rewardStore.ts`, `loyaltyStore.ts`, `uiStore.ts`. `authStore.ts` uses
  `persist()` (zustand middleware) with `name: 'hyperwolf-auth'` (`lib/store/authStore.ts:92-94`) —
  meaning the entire auth state object, including the raw session token field, is serialized into
  **`localStorage`** under that key, in addition to being written to plain (non-httpOnly) cookies
  (see §14, this is the load-bearing finding of the whole audit).
- Startup side effect of note: `authStore.setAuth()` (`lib/store/authStore.ts:17-53`) is not just a
  state setter — on every login it also sets three cookies (`auth_token`, `user`, `consumerId`,
  lines 34-39), fires a rewards fetch (line 47), and fires a cart fetch (line 51) — a single state
  mutation with four side effects, none of which can fail independently or be retried in isolation.

## 4. Directory map

Real line counts measured via `find <dir> -name '*.ts' -o -name '*.tsx' | xargs wc -l`:

| Dir | Files (approx) | TS/TSX lines | Real role (verified) |
|---|---|---|---|
| `app/` | ~55 | 7,339 | Next App Router: 28 `page.tsx` routes + 12 `route.ts` (10 sitemap XML + `sitemap.xml` + `llms.txt`) + `app/actions/*` (server actions: auth, cart, common, loyalty, products, rewards, search — `app/actions/cart.ts` alone is 1,703 lines, the single biggest file in the repo) |
| `components/` | 303 | 30,840 | Feature-organized React components — by far the largest tree (66% of all TS/TSX lines). Subfolders: `cart/`, `checkout/`, `auth/`, `shop/`, `account/`, `navigation/`, `cms-templates/` (server-driven marketing page templates, several 500-800 line files), `ui/` (Shadcn/Radix primitives), `schema/` (JSON-LD builders), `icons/` (raw inline SVGs — source of the "ip_literal" false-positive, §11) |
| `lib/` | 47 | 7,012 | `lib/api/` (3 Axios clients + `cached-fetch.ts` 921 lines + `common-fetch.ts` 606 lines + `services/*`), `lib/store/` (6 Zustand stores), `lib/validation/` (Zod schemas), `lib/schema/` (`schema-builders.ts`, 540 lines, SEO JSON-LD), `lib/utils/` (date/sanitize/price/shop-status helpers) |
| `types/` | 17 | 946 | Hand-written TS interfaces, no codegen from any schema/OpenAPI — types are maintained by hand against a backend the repo doesn't own (see §5) |
| `context/` | 1 | 32 | `CategoryContext.tsx` — a single React context, everything else state-related is Zustand |
| `hooks/` | 4 | 143 | Custom hooks (small — most data-fetching hooks actually live under `lib/api/hooks/`, e.g. `useCart.ts` at 678 lines, which is arguably mis-placed relative to the documented `hooks/` convention in `CLAUDE.md`) |
| `public/` | — | 7.6 MB | Static assets (images, fonts) |
| `.agent/` | 92 files | — | In-repo Claude Code skill definitions (15 skills) + architecture notes (`.agent/api-caching-strategy.md`, `.agent/delivery-type-cookie-migration.md`, etc.) — unusually thorough self-documentation for this estate |
| `.claude/` | 1 file | — | `settings.json` only — skills are gitignored from here per `README.md:38-41`, copied in manually by contributors |
| `.github/` | 1 file | — | `workflows/deployment.yml` — see §10, currently a no-op |

## 5. Data model summary

No backend DB schema exists in this repo (confirmed — it's a frontend). "Data model" here means the
TypeScript shapes the UI assumes the backend returns, plus client-side store/form shapes.

- **Type count**: 61 exported `interface`/`type` declarations across `types/*.ts` and `lib/api/*`
  (measured: `grep -arE '^(export )?(interface|type) ' types/*.ts lib/api/*.ts lib/api/services/*.ts | wc -l`
  → 61; not a metrics-file number, measured directly for this audit).
- **Central types** (10 most load-bearing, full field detail in the `.datamodel.md`):
  `Cart`/`CartItem`/`ActiveCartData`/`PrepareCartPayload` (`types/cart.ts`, 260 lines — the biggest
  and most-referenced type file), `Product`/`RawProduct` (`types/product.ts` — **note: a second,
  differently-shaped `Product` interface also exists at `types/cart.ts:27-44`** — two types named
  `Product` in the same repo with different fields, see §12), `User`/`AuthState`
  (`types/auth-store.ts`), `UserLocation`/delivery slot types (`types/delivery-store.ts`),
  `GuestDetails` (`types/cart.ts:226-235`), `CardDetails` (`types/checkout-credit-card.ts`),
  `PromotionReq` (`types/cart.ts:91-98`), `TaxResult` (`types/cart.ts:76-89`).
- **Money**: plain JS `number`, assumed to be **dollars** (not cents) — confirmed by the two
  formatters both dividing by nothing and calling `.toFixed(2)`/`Intl.NumberFormat` directly on the
  raw value (`lib/utils/price.ts:4-8`, `lib/utils.ts:89-94`) — see §12 for why there are two
  formatters. No currency field exists on any money-bearing type (`Cart.total`, `Cart.subTotal`,
  `Product.price` are all bare `number`) — USD is assumed everywhere, not modeled.
- **IDs**: `string` everywhere (backend Mongo ObjectIds as hex strings, e.g.
  `Product.id: string` — `types/product.ts:9`). No branded/nominal typing — a `productId` and a
  `consumerId` are both plain `string`, so passing one where the other is expected type-checks.
- **Enums**: mostly string unions, not TS `enum` — e.g. `cartType?: 'asap' | 'schedule' | 'pickup'`
  (`types/cart.ts:157,192`), `pickupType?: 'Pickup' | 'Delivery'` (`types/cart.ts:153`, note the
  inconsistent casing vs `cartType`'s lowercase values — a real "two conventions for the same kind
  of flag" smell).
- **Timestamps**: no dedicated `Date`/timestamp type convention — fields like `deliveryDate`,
  `completeAfter` are typed `string | number` (`types/cart.ts:133-134,162-163,195-196`) — the UI
  itself doesn't know if the backend will hand it an ISO string or a Unix number, and has to
  branch at every use site.
- **Multi-tenancy analog**: this deployment serves **one brand only** (Hyperwolf) — brand identity
  is baked in at build/env time via `NEXT_PUBLIC_APP`, `NEXT_PUBLIC_SHOP_KEY`,
  `NEXT_PUBLIC_DEFAULT_SHOP_ID` (`.env.example`), not a runtime-selectable tenant. `companyId` shows
  up on cart/order types (`types/cart.ts:66,152,185`) as the closer analog to a store/location
  scoping key, threaded manually through nearly every server action in `app/actions/cart.ts`.
- **Indexes / query shape**: not applicable — no DB queries originate in this repo; all "queries"
  are HTTP calls built in `lib/api/cached-fetch.ts`/`common-fetch.ts`/`services/*`, discussed as
  API surface in §6.

Full field-by-field detail for all 61 types: `hyperwolf-frontend-nextjs.datamodel.md`.

## 6. API surface

- **Base URL selection**: three separate env-driven base URLs with **hardcoded production/staging
  fallbacks baked into source** — `lib/api/client.ts:4-6`:
  `NEXT_PUBLIC_HEMP_API_BASE_URL || NEXT_PUBLIC_BASE_URL || 'https://api.direct.stage.hyperwolf.com'`,
  `NEXT_PUBLIC_HYPERWOLF_API_BASE_URL || 'https://api.hyperwolf.prod.ths.agency'`,
  `NEXT_PUBLIC_DISTRIBUTION_API_BASE_URL || 'https://distribution-backend.js.thcs.in'`. If an env
  var is ever missing in a given environment, the app silently falls back to one of these
  literal hosts — for the hyperwolf client, that fallback is a **production** host.
- **API client layer**: three Axios instances (`lib/api/client.ts:21-46`) + a request/response
  interceptor pair (`lib/api/interceptors.ts`) that is **entirely a no-op** — the only logic that
  would attach a bearer token is commented out (`lib/api/interceptors.ts:9-16`), and the 401
  handler branch is an empty comment (`lib/api/interceptors.ts:25-27`). Plus a large
  `lib/api/cached-fetch.ts` (921 lines) and `lib/api/common-fetch.ts` (606 lines) of GET-fetch
  wrappers used from Server Components, and `lib/api/services/*` (auth, cart, common, externals,
  products, reviews) used from Server Actions for mutations.
- **Auth mechanism — this is the headline finding, detailed fully in §14**: there is no per-request
  bearer/session token validated by this frontend's own request pipeline. The `x-auth-token` header
  sent on every request (`lib/api/client.ts:16`, `lib/constants.ts:14-16`) is a **static, shared
  string with a hardcoded literal fallback committed to source**
  (`lib/api/client.ts:9`/`lib/constants.ts:15` — same literal in both places, ~40 chars, cited by
  file:line only per audit rules, not reproduced), identical for every visitor. User identity for
  personalized endpoints (cart, orders, rewards) is instead carried as a `consumerId`/`cuid`
  parameter, sourced from a **plain, non-httpOnly cookie** the client itself set at login
  (`lib/store/authStore.ts:34-39` sets it via `cookies-next`'s `setCookie`, which runs in the
  browser and is not httpOnly) and then read back and trusted by Server Actions with no
  cross-check against the session (`app/actions/cart.ts:169,261,460,844,1169,1459` — six separate
  spots read `cookieStore.get('consumerId')?.value` and pass it straight into an API call as the
  identity for that cart/order operation).
- **Role checks**: `authStore.ts` and related files reference a small number of role-shaped
  strings (`lib/store/authStore.ts` x3, `app/actions/auth.ts:11`, `components/navigation/AuthLink.tsx`)
  but there is no role/permission system to speak of in this repo — this app has exactly one
  audience (retail customers); "role" here is really just "logged in vs. guest," gated the same
  client-side way as §14 describes for `/shop/my_account`.
- **Input validation**: Zod (`lib/validation/*`, one schema file per form area per `CLAUDE.md`) is
  used consistently for form input (React Hook Form + `@hookform/resolvers`), but nothing validates
  the **response** shape coming back from the three Axios clients — every API response is trusted
  as-is and cast to the relevant TS interface (a compile-time-only guarantee); a backend contract
  change silently produces `undefined` reads at runtime rather than a caught validation error.
- **Error response shape**: `lib/api/errors.ts` wraps failures into an `ApiException` with
  `message`/`statusCode`/`code`; `lib/api/cached-fetch.ts:47-53`'s `handleApiError` has separate,
  differently-shaped fallback-and-log behavior. Two error-handling conventions coexist depending on
  which fetch layer a given call goes through.
- **Pagination**: not measured — no single/consistent pagination parameter convention was found
  across `lib/api/services/*` in the time available for this pass; several list-fetching functions
  accept ad hoc `page`/`limit`-shaped params inline rather than through a shared type.
- **SSR vs CSR**: pages under `app/shop/*` are largely Server Components for initial data
  (`common-fetch.ts`/`cached-fetch.ts` calls), with `"use client"` islands for interactivity
  (cart drawer, forms) — standard Next App Router split. **`app/shop/my_account/page.tsx:1`
  (`"use client"`) is a full-page client component**, not a server component with a server-side
  guard — see §14.
- **Route inventory** (41 total: 28 `page.tsx` + 12 `route.ts` sitemap/llms.txt handlers):
  storefront (`/`, `/shop`, `/shop/[type]`, `/shop/[type]/[subtype]`, `/shop/brand`,
  `/shop/brand/[brandId]`, `/shop/product/[productId]`, `/shop/deals`, `/shop/deals/[dealType]`,
  `/shop/deals/[dealType]/[categorySlug]`, `/shop/strain`, `/shop/strain/[strainId]`,
  `/shop/trait`, `/shop/trait/[traitId]`, `/shop/trait/[traitId]/[subtraitId]`), checkout/account
  (`/shop/checkout`, `/shop/order-status`, `/shop/my_account`), auth (`/login`, `/signup`,
  `/forgot_password`, `/reset_password`), content/SEO (`/blog`, `/blog/[...segments]`,
  `/blog/category/[categorySlug]`, `/author/[authorId]`, `/[template]`, `/reviews-page`,
  `/why-choose-national-delivery`, 10 sitemap XML routes, `/llms.txt`, `/sitemap.xml`). **No route
  in this list has a server-side auth gate** — there is no `middleware.ts` (§3) and
  `/shop/my_account` (the one route that should require auth) gates itself only client-side
  (§14). Every other route is intentionally public (storefront/marketing/SEO), which is correct
  for those — the finding is specific to `/shop/my_account`.
- **Versioning**: all three API base URLs hardcode `/api/v1/` (`lib/api/client.ts:23,33,45`) — no
  version negotiation, no `/v2` fallback path visible in this repo.

## 7. Background jobs

None. This is a frontend with no cron/queue infrastructure. The 12 `settimeout_in_handler` metric
hits are UI debounce/delay patterns inside event handlers (e.g.
`components/account/account-sidebar.tsx:60`, `components/auth/auth-layout.tsx:15`), not scheduled
jobs — spot-checked, confirmed not a background-job finding. Next.js's own data-cache revalidation
(`revalidate`/`CACHE_TIMES` in `lib/api/cached-fetch.ts`) is the closest analog to a "job," and it
is discussed as a caching concern in §15, not here.

## 8. Third-party integrations & secrets

| Service | Purpose | Wrapper (file:line) | Credential source | Notes |
|---|---|---|---|---|
| Google Maps/Places/Geocoding/reCAPTCHA | address autocomplete, geocoding, bot check | `@react-google-maps/api`, `use-places-autocomplete` deps; keys via `lib/constants.ts` | `NEXT_PUBLIC_GOOGLE_PLACES_KEY`, `NEXT_PUBLIC_GOOGLE_GEOCODE_KEY`, `NEXT_PUBLIC_GOOGLE_RECAPTCHA_KEY`, `NEXT_PUBLIC_GOOGLE_SITE_KEY` | All `NEXT_PUBLIC_` by design (client-side Maps keys) — normal for this category |
| Persona | ID/age verification (KYC) | `components/auth/persona-verification-modal.tsx`, used from `components/auth/signup-form.tsx`, `components/checkout/checkout-container.tsx`, `components/account/account-settings.tsx`, `app/actions/common.ts`, `lib/api/services/{common,auth}.ts` | `NEXT_PUBLIC_PERSONA_ENVIRONMENT_ID`, `NEXT_PUBLIC_PERSONA_TEMPLATE_ID` | **The `persona` npm package (`package.json`) is not imported anywhere** — the modal doesn't `import` it (`components/auth/persona-verification-modal.tsx:3-11`); integration is done another way (widget/script), matching the `withpersona.com` domains allow-listed in CSP (`next.config.ts`). The declared package is dead weight. |
| Intercom | customer chat | inline bootstrap script, `app/layout.tsx:181-186` | workspace id `lipka71t` hardcoded in the script literal, not env-driven | |
| Reviews.io | product review widgets | `app/layout.tsx:176-183`, `lib/utils/map-reviews-api.ts`, `lib/schema/schema-builders.ts` (batch API for JSON-LD ratings) | no key visible client-side in the scripts themselves | |
| Weedmaps | product images only | `next.config.ts:24-26` (`images.weedmaps.com` remote pattern) | n/a (image CDN allow-list) | Not an API integration, just an image host allow-list |
| AWS S3 | asset hosting | `next.config.ts:14-21` (`hyperwolf-website-assets.s3.amazonaws.com`, `connect-files-public.s3.amazonaws.com`, `**.amazonaws.com`) | n/a | `**.amazonaws.com` is a broad wildcard remote pattern — any S3-hosted image URL from any AWS account can be requested through Next's image optimizer |
| Google Tag Manager / Analytics | analytics | `app/layout.tsx:184-192` (hardcoded container id `GTM-554SLVC`), `NEXT_PUBLIC_GOOGLE_ANALYTICS_KEY` | env var + hardcoded container id | |
| Microsoft Clarity | session recording | CSP allow-list only (`next.config.ts` `clarity.ms` entries) — no explicit env var found | not measured further | |
| Ahrefs Analytics | SEO analytics | CSP allow-list (`analytics.ahrefs.com`) | not measured further | |
| Surfside | (marketing pixel) | `lib/utils/surfside.ts` (has the repo's only 2 `console.log` hits — metrics) | CSP allow-list `surfside.io`/`r.surfside.io` | |
| RevenueKit | (checkout/payments-adjacent, per CSP) | CSP allow-list only (`form.revenuekit.com`, `hq.revenuekit.com`) — no in-app wrapper file found | not measured further | worth confirming with the owner whether this is live or vestigial |
| Didit | identity verification (per CSP `frame-src: verify.didit.me`) | **no corresponding application code found** — CSP-only reference | n/a | Likely vestigial CSP entry from a prior/parallel identity-verification vendor evaluation (Persona is the one actually wired up) — flagged as an open question (§19) |
| MailerLite | email marketing | `lib/constants.ts:22,32` (`MAILERLITE_API_KEY`, `MAILERLITE_BASE_URL`) | `NEXT_PUBLIC_MAILERLITE_API_KEY` | Client-exposed API key by naming convention — see §14 |
| Alt36 / FHL / Springbig / Ankar | loyalty/POS-adjacent partner APIs (named in `.env.example`) | `lib/constants.ts:34` (`ALT_36_BASE_URL`) + related vars | `NEXT_PUBLIC_ALT_36_API_KEY`, `NEXT_PUBLIC_ALT_36_X_API_KEY`, `NEXT_PUBLIC_SPRING_BIG_API_KEY`, `NEXT_PUBLIC_SPRING_BIG_AUTH_KEY`, `NEXT_PUBLIC_FHL_*` | All `NEXT_PUBLIC_`-prefixed despite "API key"/"auth key" naming — see §14 |
| Sentry | error monitoring | **not wired up** — `NEXT_PUBLIC_SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_CLI_EXECUTABLE` exist in `.env.example` but `@sentry/*` is **not a dependency** in `package.json` and no `sentry.*.config.*` file or `@sentry` import exists anywhere in the tree (confirmed by repo-wide grep) | n/a | Declared, never implemented — see §10, §17 (operability) |

**Webhooks**: none. This is a frontend; it receives no inbound webhooks (confirmed — no
`route.ts` under `app/` implements anything beyond static sitemap XML generation).

## 9. Tests

Zero. Confirmed: no `*.test.*`/`*.spec.*` files, no `__tests__` directories, no Playwright/Cypress/
Vitest/Jest config file, no `test` script in `package.json` (scripts are `dev*`, `build*`, `start*`,
`lint`, `audit*` only — `package.json`). `README.md:53` states this explicitly: "No test runner is
configured." `npm run lint` runs ESLint's flat config (`eslint.config.mjs`) with
`next/core-web-vitals` + `next/typescript` presets (`README.md`) — this catches style/type-adjacent
issues, not behavior. Nothing in this 47,000-line app is covered by an automated test of any kind;
the entire safety net for a checkout flow that handles money is manual QA and production traffic.

## 10. Build & deploy

- **Build**: `next build` / `next build:stage` / `next build:prod` via `env-cmd -f <envfile>`
  (`package.json` scripts) — three parallel environment files (`.env`, `.env.stage`,
  `.env.production`), all gitignored (`.gitignore`, confirmed — not present in the tree).
- **CI/CD is effectively dead**: `.github/workflows/deployment.yml` triggers only on push to a
  branch literally named `bug/delivery-slot` (line 5-6) — not `main`/`master`/any release branch —
  plus manual `workflow_dispatch`. Its entire deploy body (`git stash`, `git checkout`, `git pull`,
  `npm install`, `pm2 restart 0`) is **commented out** (lines 16-22); the job currently only prints
  `whoami`/`$HOME` on a self-hosted runner and does nothing else. Whatever actually ships this app
  to production today happens by some other, unrecorded mechanism (manual SSH + `pm2 restart`,
  going by the commented hints) — this contradicts any assumption that a green GitHub Action means
  a deploy happened.
- **No Dockerfile** — confirmed absent. Deployment target, per the dead workflow's commented lines,
  is a **PM2 process on a self-hosted server** (`/var/www/html/hyperwolf-upgrade-nextjs`,
  `pm2 restart 0`), not Vercel/containerized despite being a standard Next.js app that would run
  cleanly on either.
- **Environment separation**: three env files map to three `npm run` script families
  (dev/stage/prod) — a reasonable convention — but nothing enforces that the correct file is used
  for a given deploy target beyond developer discipline, since the CI that would enforce it is the
  dead workflow above.
- **Logging/monitoring**: no APM/error-tracking is actually wired up (§8 — Sentry vars exist,
  package and code don't). Errors are handled ad hoc via `console.error` in the two fetch layers
  (`lib/api/cached-fetch.ts:52`, `lib/api/errors.ts`) and are otherwise swallowed (§14/§15 —
  `app/actions/cart.ts:277` empty catch). There is no structured/centralized logging of any kind.

## 11. Hardcoded values

Metrics leads verified and corrected:

- **`ip_literal` (167 hits, metrics) — FALSE POSITIVE, corrected to 0 real hardcoded IPs.**
  Verified: the regex matched decimal-number sequences inside inline SVG `<path d="...">` data in
  `components/icons/*.tsx` (e.g. `components/icons/FlowerTypeIcon.tsx:6` — path coordinates like
  `18.39 9.75`), which happen to look like dotted-quad IPs to a naive regex. Not a real finding.
- **`objectid_24hex` (12 hits) — real, worst is a hardcoded id list.** `lib/utils.ts:180`:
  `thcMgIds` — a hardcoded array of 10 literal Mongo ObjectId strings used to special-case "THC mg"
  categories/products in UI logic. This is "hardcoded and should be data" — if the backend ever
  re-creates these category/product records (new ids), this array silently stops matching anything
  and the special-casing goes dead with no error. `components/cart/CartSummary.tsx:54` and
  `lib/constants.ts:7` are the other two hit files (each a single id, lower risk).
- **`http_url` (292 hits, corrected count ~280 after excluding legitimate config)** — the two worst
  concentrations are legitimate-ish but still worth flagging: `next.config.ts` (82 hits — CSP
  allow-list domains, §14) and `lib/schema/schema-builders.ts` (26 hits — SEO JSON-LD builders that
  hardcode `https://hyperwolf.com/...` URL templates rather than deriving them from
  `NEXT_PUBLIC_WEBSITE_BASE_URL`, meaning a domain change requires an in-code edit across this file
  as well as the env var).
- **`store_name_literal` (8 hits) — real, and duplicated 3x.** An 80-entry `CITIES` array
  (`components/WeedDeliveryLocations.tsx:8-21`) is copy-pasted into `components/cms-templates/
  SameDayWeedDelivery.tsx` and `components/cms-templates/DeliveryArea.tsx` (confirmed present in
  all three files via grep for a distinctive entry). This is "hardcoded and should be data" (city
  coverage should come from the backend's region config, since `dispatchRegionId`/region APIs
  already exist per `CLAUDE.md`'s Shop Timings Flow) **and** a triplicated-maintenance problem —
  adding a city means editing 3 files and hoping they're kept in sync (§12).
- **`role_string` (6 hits)** — not a real role system; see §6, these are "logged in" checks, not
  a permissions model.
- **`email_literal`/`phone_literal` (1 each)** — `components/checkout/checkout-guest-info.tsx:122`
  and `lib/schema/schema-builders.ts:23` are support-contact placeholders/schema defaults, low
  severity, but should still come from `NEXT_PUBLIC_*` config rather than being typed into a
  component, since support contact info changes independently of code.
- **Hardcoded auth token + hardcoded production URL fallbacks** (`lib/api/client.ts:4-9`,
  `lib/constants.ts:15`) are the worst hardcoding findings in the repo by impact — covered fully in
  §14 since they are security findings first and hardcoding findings second.

Worst 10 by file:line: `lib/api/client.ts:9` (secret literal) · `lib/constants.ts:15` (same secret,
duplicated) · `lib/api/client.ts:4-6` (hardcoded prod/stage host fallbacks) · `lib/utils.ts:180`
(`thcMgIds`) · `components/WeedDeliveryLocations.tsx:8-21` (CITIES, x3 copies) · `app/layout.tsx:186`
(Intercom workspace id) · `app/layout.tsx:191` (GTM container id) · `lib/schema/schema-builders.ts`
(hardcoded `hyperwolf.com` URL templates, 26 occurrences) · `components/checkout/
checkout-guest-info.tsx:122` (email literal) · `lib/schema/schema-builders.ts:23` (phone literal).

## 12. Duplicated code

**Within this repo:**
- **Two `Product` interfaces, different shapes, same repo**: `types/product.ts:8-31` and
  `types/cart.ts:27-44`. They overlap (`id`, `name`, `flowerType`, `webCategoryName`, `tags`) but
  diverge meaningfully (`types/product.ts`'s `Product` has a structured `price: ProductPrice` and
  `brand: {name, slug}`; `types/cart.ts`'s `Product` has neither, using flat `brandName?: string`
  and no price field at all). Importing the wrong one for a given context type-checks but produces
  subtly wrong assumptions about what fields exist.
- **Two money-formatting functions, both actively used, different output format**:
  `formatPrice` (`lib/utils.ts:89-94`, `Intl.NumberFormat` — produces `$1,234.56`) vs.
  `formatCurrency` (`lib/utils/price.ts:4-8`, manual `toFixed(2)` — produces `$1234.56`, no
  thousands separator). Verified both are live: `formatPrice` used in 2 files, `formatCurrency` in
  6 — a cart/order total over $1,000 will display differently depending on which component renders
  it.
- **The 80-entry `CITIES` array**, triplicated verbatim across `components/WeedDeliveryLocations.tsx`,
  `components/cms-templates/SameDayWeedDelivery.tsx`, `components/cms-templates/DeliveryArea.tsx`
  (§11).
- General note: the mechanical scan's `inrepo_duplicate_groups` came back empty (metrics JSON) —
  that check apparently only looks for large exact-duplicate blocks, and would miss the smaller,
  more damaging duplications above (a formatter function is only 4-8 lines; a type is 15 lines).
  Don't read "0 groups" as "no duplication."

**Cross-repo**: `/Users/jt/POS-Admin/docs/codebase-audit/metrics/CROSS-REPO-DUPLICATES.md` lists
zero exact/near-duplicate file pairs involving `hyperwolf-frontend-nextjs` (only a sibling
`hemp-frontend-nextjs` appears once, for a shared `commitlint.config.js`). **Verified this silence
is correct, not a scanner miss**: `hemp-frontend-nextjs` and `stilo-frontend-nextjs` (the two
plausible sibling storefronts under `/Users/jt/hyper-tech/`) are genuinely different codebases —
`hemp-frontend-nextjs` is Next `14.0.4` + React `^18`, plain JS (`next.config.js`, `jsconfig.json`,
no `lib/api/`, no TypeScript), and `stilo-frontend-nextjs` is Next `^15.1.9` + React `^19.2.4` with
its own separate structure (`axios/`, `redux/`, `services/`, `validations/` top-level dirs — Redux,
not Zustand). Confirmed with `diff`/directory comparison — none of `lib/api/client.ts`,
`cached-fetch.ts`, or `checkout-container.tsx` exist at matching paths in either sibling. This
package's own name (`hyperwolf-upgrade-nextjs`) confirms the story: this is an independent, from-
scratch **rewrite** of the Hyperwolf storefront on a modern stack, while Hemp and Stilo's
storefronts remain on their own, older, independently-evolved codebases. That is itself a real
finding for the owner: **three brands, three separate frontend architectures, three Next majors
(14/15/16), no shared component or API-client library** — every bug fix, every new feature, every
security patch (e.g. this audit's CSP/auth findings) has to be independently discovered and
re-applied three times, in three different frameworks, by anyone maintaining more than one brand.

## 13. Dependency risk

Metrics' declared-but-unused list (11 packages) verified individually — several were wrong:

| Package | Metrics said | Verified |
|---|---|---|
| `@tanstack/react-query` | unused | **Confirmed unused** — 0 imports anywhere, despite `CLAUDE.md` documenting it as the client-state/caching layer. Either removed mid-migration or never actually wired in. |
| `persona` | unused | **Confirmed unused** as an npm import (§8) — the KYC flow is implemented some other way. Dead dependency, not a dead feature. |
| `lottie-react` | unused | **Metrics was wrong** — used in `components/common/customLottie.tsx`, `components/common/FullscreenLoader.tsx`. |
| `react-player` | unused | **Metrics was wrong** — used in `components/shop/shop-status-banner.tsx`, `components/common/top-slider.tsx`. |
| `react-intersection-observer` | unused | not independently re-verified this pass — treat metrics' flag as a lead, not confirmed. |
| `@heroicons/react`, `@radix-ui/react-avatar`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-switch`, `motion`, `react-dom` | unused | `@radix-ui/react-*` individual packages are superseded by the combined `radix-ui` meta-package, which **is** imported directly (`components/ui/dialog.tsx:5` — `import { Dialog as DialogPrimitive } from "radix-ui"`) — the individually-declared `@radix-ui/*` packages are genuinely redundant now. `react-dom` "unused" is a metrics artifact (it's always used implicitly by React DOM rendering, never imported by name). `motion` is genuinely unused as a named import — see next row. |
| — (metrics flagged `framer-motion` as imported-but-undeclared) | | **Confirmed and explains the `motion` mystery**: `components/common/StickyCategoryBar.tsx:9` imports from `'framer-motion'`, not `'motion'` — `package.json` declares `motion` (the newer package name Framer ships under) but the one call site still imports the old `framer-motion` name. This currently resolves (npm hoists a compatible transitive copy) but is fragile with no lockfile (§2) — a future `npm install` is not guaranteed to keep resolving it. |

- **Sentry**: `NEXT_PUBLIC_SENTRY_DSN` referenced in `.env.example` with no `@sentry/*` package
  declared and no config file — dead env var, not a dependency risk per se, but a monitoring gap
  (§10, §17).
- **`moment`/`moment-timezone`**: confirmed fully removed per `package.json` (absent) and
  `BUNDLE_SIZE_ISSUES.md`'s "FIXED" changelog — this migration was completed, a genuine positive.
- **Bundle size**: `BUNDLE_SIZE_ISSUES.md` (in-repo, dated 2026-03-21) documents prior fixes
  (moment removal ~67KB, dynamic-importing modals/drawers) with estimated ~140-185KB total savings
  claimed already banked — spot-verified the moment removal is real; did not re-verify every dynamic
  import claim in that document line-by-line.
- **Unmaintained/abandoned packages**: not measured — no package-age/maintenance-status lookup was
  performed against npm registry data for this pass (would require network access this audit did
  not use).

## 14. Security findings

Ranked by severity. This is a frontend calling an external API it doesn't control, so several
classic backend categories (SQLi, NoSQL operator injection) don't apply here — the equivalent risk
surface is: what does this frontend trust from the browser and forward unchecked, and what does it
expose to the browser that shouldn't be there.

1. **CRITICAL — Client-controlled identity cookie is trusted as the authorization key for
   cart/order/loyalty data, with no session validation anywhere in the request path.**
   `lib/api/interceptors.ts:9-16` shows the one place a real bearer token would be attached is
   commented out. Instead, six call sites in `app/actions/cart.ts` (lines 169, 261, 460, 844, 1169,
   1459) and one in `lib/actions/order.ts:11` read `consumerId` from a **plain, non-httpOnly
   cookie** (`lib/store/authStore.ts:34-39` sets it client-side via `cookies-next`, unauthenticated
   pages can read/write it with `document.cookie`), and pass it straight to the backend as the
   identity for that operation. The one gate that exists, `/shop/my_account`'s login check
   (`app/shop/my_account/page.tsx:30-35`), only checks `isLoggedIn` state OR the mere **presence**
   of an `auth_token` cookie (`if (!isLoggedIn && !token) router.push('/shop')`) — it never
   validates the token's value. **Attack**: from any browser, set `document.cookie =
   "auth_token=x"` and `document.cookie = "consumerId=<any known/guessed customer id>"`, then load
   `/shop/my_account` — the page's own gate passes, and its children fetch that consumerId's cart,
   orders, and reward data from the backend using the app's single shared `x-auth-token` header
   (finding #2). Fix: never trust a client-writable cookie as an identity claim; require the
   backend to derive `consumerId` from a signed, server-validated session token on every
   personalized call, and move `/shop/my_account`'s guard into a Server Component that fails the
   request server-side before any child renders.
2. **CRITICAL — Hardcoded, static, shared API auth token committed to source, in two places.**
   `lib/api/client.ts:9`: `const AUTH_TOKEN = process.env.NEXT_PUBLIC_X_AUTH_TOKEN ||
   "<40-char literal>"` — directly contradicts the comment one line above it
   ("SECURITY: Never hardcode API keys"). The identical literal is duplicated at
   `lib/constants.ts:15`. This token is sent as `x-auth-token` on every request from every visitor
   (`lib/api/client.ts:16`) — it is not a per-user secret, it's effectively a public API key
   (since `NEXT_PUBLIC_` env vars ship to the browser bundle anyway), but hardcoding a *working*
   fallback value in source means the app is one missing env var away from silently using this
   literal in any environment (including if it were ever accidentally left in for staging or a
   fork), and anyone with repo access has it whether or not it's ever rotated in the real env.
   Fix: remove the literal fallback entirely — fail loudly at build time if the env var is absent,
   and rotate the token since it is now effectively public via this history.
3. **HIGH — CSP allows `'unsafe-inline'` and `'unsafe-eval'` in `script-src`.**
   `next.config.ts` (`Content-Security-Policy` header, `script-src` directive) includes
   `'unsafe-inline' 'unsafe-eval'` alongside the vendor allow-list. This neutralizes CSP's main
   value as an XSS mitigation — any injected `<script>` or `eval`-reachable payload runs. Combined
   with finding #1's session cookie being plain (JS-readable) rather than httpOnly, a single XSS
   bug anywhere in this 47,000-line app (119 `dangerouslySetInnerHTML` sites across 35 files,
   metrics — most spot-checked ones do route through `sanitizeRichContent`, but not all 119 were
   individually re-verified this pass) is a session-and-PII-theft bug, not just a defacement bug.
   Fix: move inline scripts to nonces/hashes and external files; audit whether `unsafe-eval` is
   actually required by a specific vendor script (if so, scope it narrower than global `script-src`).
4. **HIGH — Session token and PII stored in a plain (non-httpOnly) cookie and in `localStorage`.**
   `lib/store/authStore.ts:34-35` sets `auth_token` and a `user` JSON blob (including `dob`,
   `birthDate`, `primaryPhone`, `email` — `lib/store/authStore.ts:22-32`) via client-side
   `setCookie`, not httpOnly. The same data also lands in `localStorage` under key
   `hyperwolf-auth` via Zustand's `persist()` (`lib/store/authStore.ts:11-13,92-94`), since
   `persist` by default serializes the whole store including the `token` field — `partialize` (which
   `CLAUDE.md` itself documents as the correct pattern: "Use `partialize` to persist only
   user-relevant state") **is not actually applied in `authStore.ts`** — confirmed no `partialize`
   option is passed to `persist()` here, contradicting the repo's own documented convention. For a
   cannabis delivery site, date-of-birth in a JS-readable cookie is a materially sensitive
   exposure. Fix: httpOnly + `Secure` + `SameSite` cookies for the session token, set server-side
   only; apply `partialize` to exclude the raw token from localStorage.
5. **MEDIUM — Several partner API keys are `NEXT_PUBLIC_`-prefixed by naming convention that
   suggests they shouldn't be.** `.env.example`: `NEXT_PUBLIC_ALT_36_API_KEY`,
   `NEXT_PUBLIC_ALT_36_X_API_KEY`, `NEXT_PUBLIC_SPRING_BIG_API_KEY`,
   `NEXT_PUBLIC_SPRING_BIG_AUTH_KEY`, `NEXT_PUBLIC_MAILERLITE_API_KEY`,
   `NEXT_PUBLIC_X_AUTH_TOKEN`. Every one of these is consumed in `lib/constants.ts`, a module
   imported from both server and client code paths — meaning whatever value each holds ships into
   the client JS bundle. If any of these are true backend-partner secrets (an "auth key" for a
   loyalty vendor's write API, for instance) rather than public identifiers, they are exposed to
   every visitor's browser. Could not confirm the actual values (out of scope, and prohibited by
   audit rules) — flagged as an open question for the owner (§19) to confirm which of these are
   genuinely public vs. mis-classified secrets.
6. **MEDIUM — Broad image remote pattern.** `next.config.ts:16-19`: `hostname: '**.amazonaws.com'`
   in `images.remotePatterns` lets Next's image optimizer proxy/resize any image from any S3
   bucket on any AWS account, not just Hyperwolf's own buckets — a minor SSRF-adjacent/resource-
   abuse surface (the optimizer will fetch attacker-supplied `**.amazonaws.com` URLs on request).
   Fix: scope to the specific bucket hostnames already listed two lines above it.
7. **MEDIUM — GTM/Intercom bootstrap via `dangerouslySetInnerHTML` with a hardcoded container/
   workspace id** (`app/layout.tsx:184-192`, `181-186`) is not attacker-controlled input (so not
   XSS by itself), but it means the analytics/chat vendor IDs can't be swapped per-environment
   without a code change — a config-hygiene issue adjacent to security (dev/stage traffic reports
   into the same GTM container as production unless overridden elsewhere).
8. **LOW — 401 handling is a stub.** `lib/api/interceptors.ts:24-27`: the response interceptor's
   401 branch is an empty comment (`// Handle unauthorized access (e.g., redirect to login)`) —
   an expired/invalid credential produces whatever the calling code does by default (often a
   silent empty state), not a clean re-auth prompt.
9. **LOW — `app/actions/cart.ts:277` empty catch block** swallows any failure fetching the active
   cart with no logging (`catch (error) { }`) — not itself an attacker-exploitable bug, but it
   means a real backend outage or auth failure on this path produces silence, not a signal an
   operator can act on (cross-reference §15, §17 operability).

## 15. Performance findings

1. **The tiered caching system this file's own comments describe is switched off.**
   `lib/api/cached-fetch.ts:31-41`: `CACHE_TIMES` — `STATIC`, `SEMI_STATIC`, `DYNAMIC`, `SHORT`,
   `FEATURE_FLAGS`, `LEGAL`, `STRAINS`, `BLOGS` are **all hardcoded to `0`** (only
   `BLOGS_DETAIL: 30`, `CATEGORIES: 60`, `FOOTER_MENU: 60` are non-zero). A commented-out block
   directly above (lines 20-30) shows what the *intended* tiered values were (`STATIC: 60`,
   `SEMI_STATIC: 1800`, etc.) before someone zeroed nearly everything out — almost certainly to
   fix a stale-data bug, but the effect is that a 921-line file built around Next's
   `revalidate`/cache-tag machinery now serves effectively zero caching for product listings,
   deals, legal pages, and strain data — every request is a fresh round trip to the backend. This
   is a real, verified performance regression baked into the architecture, not a hypothetical.
2. **`components/checkout/checkout-container.tsx:577`: async callback inside `.forEach()`, promise
   dropped.** `productsToRemove.forEach(async (productId) => { await removeFromCart(...) })` —
   `forEach` does not await its callback, so all `removeFromCart` calls fire concurrently with no
   sequencing, no aggregate error handling, and the surrounding `useEffect` has no way to know when
   (or whether) all removals actually completed before the cart UI re-reads state. Fix: replace
   with `for...of` + `await`, or `Promise.all(productsToRemove.map(...))` if concurrency is fine
   and only the "wait for completion" property is missing.
3. **`app/actions/cart.ts` (1,703 lines) — sequential-await risk in a hot path.** Not exhaustively
   line-audited in this pass, but its sheer size and the density of consumer/cart/order concerns in
   one file (§17) makes it the highest-risk location in the repo for accidental sequential
   `await`s that could be parallelized with `Promise.all` — flagged for a follow-up pass rather
   than a specific verified line, per "honest zero over fabricated number."
4. **`components/icons/StrainsNotFound.tsx` — 153 numeric literals in one inline SVG `<path>`**
   (metrics `ip_literal` top hit, §11) — not a bug, but a 150+ point vector path inlined directly
   into a React component's render tree (not `next/image`-optimized, not lazy) ships and
   re-parses on every render of that component; if this icon appears in a list (its name suggests
   an empty-state), consider extracting to a static `<img>`/`next/image` SVG asset instead of
   inline JSX.
5. **Two parallel money-formatting implementations** (§12) aren't just a correctness risk, they're
   also two code paths doing the same `Intl`/string work rather than one shared, memoizable
   formatter.
6. **`next/image` usage was not exhaustively verified against raw `<img>` tags** across all 303
   component files in the time available — spot checks found `next/image` used in the primary
   product-card paths; a full `<img` vs `next/image` census is left as "not measured" rather than
   guessed.
7. **Bundle size**: `BUNDLE_SIZE_ISSUES.md` documents ~140-185KB of prior fixes (moment removal,
   dynamic imports for modals/drawers/Lottie) — the moment removal was spot-verified as real and
   complete; this represents real, already-banked work, not a current finding, but is worth citing
   as a section-15 asset achieved rather than a gap.

## 16. Ten things a new developer would trip out over

1. **Zero tests, anywhere** — `package.json` scripts, confirmed (§9). The checkout/payment flow
   has no safety net beyond manual QA.
2. **No lockfile** — `npm install` on day one can silently resolve different transitive versions
   than whoever built the last working `.next` output (§2).
3. **The CI workflow does nothing** — `.github/workflows/deployment.yml`'s deploy steps are
   commented out and it only triggers on a branch called `bug/delivery-slot` (§10). A green check
   here means nothing about whether anything shipped.
4. **`cached-fetch.ts` is not actually cached** — its name and 921 lines of `CACHE_TIMES`/cache-tag
   machinery strongly suggest tiered caching is in effect; nearly every tier is zeroed (§15 #1).
5. **Two `Product` types and two money formatters** with the same name/purpose but different
   shapes/output (§12) — importing the wrong one is a silent, type-checked mistake.
6. **The auth token isn't really per-user** — `x-auth-token` (`lib/api/client.ts`) is a static
   shared value; real personalization runs through a client-supplied `consumerId` cookie instead
   (§6, §14) — this is not how most engineers coming from a typical JWT-bearer-token app will
   expect auth to work here, and it's easy to accidentally build a new feature that trusts
   `consumerId` the same insecure way the existing code does.
7. **`persona` and `@tanstack/react-query` are installed but dead** (§13) — `CLAUDE.md` documents
   React Query as the client-state/caching layer; it is not actually used anywhere. Don't trust the
   architecture doc's dependency claims without grepping for the import.
8. **The CITIES list lives in three files** (§11, §12) — editing delivery coverage in one
   marketing component and not the other two produces an inconsistent site.
9. **`persist()` on the auth store does not use `partialize`**, despite `CLAUDE.md` documenting
   `partialize` as the required pattern (§14 #4) — the whole auth state, including the session
   token, sits in `localStorage` under `hyperwolf-auth`.
10. **`hooks/` (4 files, 143 lines) is nearly empty; the real data-fetching hooks live under
    `lib/api/hooks/`** (e.g. `useCart.ts`, 678 lines) — the documented naming convention
    (`CONTRIBUTING.md`/`CLAUDE.md`) says hooks belong in `hooks/`; in practice the biggest and most
    important one doesn't, which will send a new contributor to the wrong directory first.

## 17. Grade inputs

| Axis | Score | Justification | Citation |
|---|---|---|---|
| Simplicity | 4/10 | One 1,703-line server-action file (`cart.ts`) mixes cart CRUD, checkout, guest flow, and split payments; two parallel money formatters and two `Product` types add avoidable cognitive load | `app/actions/cart.ts` (1,703 lines) |
| Speed | 4/10 | The dedicated caching layer is switched off almost entirely, turning every product/legal/strain fetch into a live round trip | `lib/api/cached-fetch.ts:31-41` (`CACHE_TIMES` all `0`) |
| Security | 2/10 | Client-writable identity cookie trusted for cart/order access, plus a hardcoded shared API secret committed to source | `lib/api/client.ts:9`; `app/actions/cart.ts:169` |
| Data modelling | 3/10 | Core cart types carry open `[key: string]: unknown` index signatures that defeat the type system precisely where money and identity flow through | `types/cart.ts:145,165,200` |
| Reuse vs. hardcoding | 4/10 | An 80-city list and a hardcoded ObjectId array both duplicate/hardcode data that belongs in backend config | `components/WeedDeliveryLocations.tsx:8-21`; `lib/utils.ts:180` |
| Testing | 1/10 | Zero test files, zero test script, for an app that processes real payments | `package.json` (no `test` script) |
| Upgradability | 5/10 | No lockfile makes any dependency bump non-reproducible, but business logic is reasonably separated into Server Actions/services rather than smeared through UI components | (no `package-lock.json`/`yarn.lock`/`pnpm-lock.yaml` in repo) |
| Operability | 3/10 | Sentry is referenced by env var but never actually installed/wired; failures are swallowed silently in at least one cart path | `app/actions/cart.ts:277`; `.env.example` (`NEXT_PUBLIC_SENTRY_DSN`, unused) |
| Developer experience | 6/10 | Unusually thorough `CLAUDE.md`/`CONTRIBUTING.md`/15 Claude Code skills — but the docs make claims (React Query, `partialize`) the code doesn't follow, which costs more trust than no docs at all | `CLAUDE.md` ("React Query manages client-side server state") vs. zero `@tanstack/react-query` imports |

## 18. Quick fixes (<1h each), ranked by impact per hour

1. Remove the hardcoded token fallback in `lib/api/client.ts:9` and `lib/constants.ts:15`; fail
   the build if `NEXT_PUBLIC_X_AUTH_TOKEN` is unset. Rotate the token.
2. Fix `checkout-container.tsx:577`'s `forEach(async ...)` to a `for...of` loop or `Promise.all`.
3. Fix `app/actions/cart.ts:277`'s empty catch — at minimum `console.error` with context, matching
   the pattern already used in `lib/api/cached-fetch.ts:52`.
4. Add `partialize` to `authStore`'s `persist()` call (`lib/store/authStore.ts:92-94`) to stop
   writing the raw session token into `localStorage` — `CLAUDE.md` already documents this as the
   required pattern, it's just missing here.
5. Scope `next.config.ts`'s `**.amazonaws.com` image remote pattern down to the two named buckets.
6. Point `.github/workflows/deployment.yml` at the actual deploy branch (or delete it if it's
   dead) so a green check isn't misleading.
7. Delete the unused `persona`, `@tanstack/react-query` dependencies (or wire them in) — either
   way, stop the drift between `package.json`/`CLAUDE.md` claims and reality.
8. Consolidate `formatPrice`/`formatCurrency` into one function; grep-replace the 8 call sites.
9. Pull the triplicated `CITIES` array into one shared `lib/constants.ts` export, import it in the
   3 files that currently paste it.
10. Generate and commit a lockfile (`npm install` with no existing lockfile, then commit
    `package-lock.json`) — the single highest-leverage reproducibility fix available in under an
    hour.

## 19. Open questions

1. Does the backend (`hyperwolf-backend`, out of scope for this repo's audit) actually validate
   `consumerId` against a real session anywhere server-side, or does this frontend's trust of a
   client-writable cookie (§14 #1) reflect a matching gap on the backend? This can only be answered
   by auditing `hyperwolf-backend` directly (a separate repo/audit).
2. Is the hardcoded `x-auth-token` literal (`lib/api/client.ts:9`) still the live production value,
   or already rotated/dead? If live, it needs rotation regardless of this audit's fix.
3. Which of the `NEXT_PUBLIC_`-prefixed partner keys (Alt36, Springbig, MailerLite — §14 #5) are
   genuinely public identifiers vs. secrets that were mis-classified when someone added the
   `NEXT_PUBLIC_` prefix to "make it work" in a client component? Needs the vendor's own docs or
   the person who wired each integration.
4. Is RevenueKit (`next.config.ts` CSP allow-list) and Didit (`next.config.ts` CSP `frame-src`)
   live, planned, or vestigial? No application code references either beyond the CSP entries.
5. What actually deploys this app to production today, given `.github/workflows/deployment.yml` is
   a no-op (§10)? Whoever runs `pm2 restart 0` manually should be identified so deploy knowledge
   isn't tribal.
6. Is there an intentional reason `@tanstack/react-query` was added to `package.json` and
   documented in `CLAUDE.md` as the caching layer, yet never actually used? (Migration in
   progress? Abandoned plan? Worth 5 minutes to ask before someone "helpfully" removes the
   dependency and breaks a WIP branch elsewhere.)
7. Given `hemp-frontend-nextjs` (Next 14, JS) and `stilo-frontend-nextjs` (Next 15, Redux) are
   fully separate codebases from this rewrite (§12), is there a plan to bring them onto this
   architecture, or will the owner accept three permanently-divergent frontends? This is a resourcing
   question, not an engineering one.
