# Consolidation proposal and platform-services plan

Written 2026-09-09 after Phase 1. Nothing here is started; every step waits on the owner's go
(`THE-GRADE.md` closes with the decisions). Evidence for each claim is in `ARCHITECTURE-MAP.md`
and `repos/<repo>.md` at the section cited.

## 0. The one-paragraph version

The twelve repos are really **four codebases**: one brand-commerce backend forked three times
(hemp, stilo, hyperwolf), one fleet/logistics backend split in two with copies left behind in
hyperwolf-backend (hyperdrive, distribution), one promotion engine implemented three times across
two repos, and one admin SPA forked twice plus three storefronts on three Next.js majors. Nothing
shares a package. The target is **six repos**: a contracts package, a commerce API parameterised
by platform, a logistics API, a promotions API, one admin web app, one storefront web app. The
order is dictated by risk: secure and pin before you merge; merge the pair that is already 93%
identical first; never merge the two things that hold live money and identity until real auth
exists.

## 1. Preconditions (before any merge — Phase 0, roughly two weeks)

These are not consolidation; they are what makes consolidation survivable. Each is a quick fix in
`THE-GRADE.md` §3 or a Biggest Issue in §4.

| # | Step | Repos | Why first |
|---|---|---|---|
| P1 | Rotate the three committed service-account keys, the Google Maps key, the LedgerGreen webhook secret and the two storefront static tokens; purge `build.zip` | hyperwolf-b, hemp-b, stilo-b, super-admin, hw-frontend, hemp-frontend | Anyone who has cloned these repos holds them. Owner action. |
| P2 | Close the six credential-free chains: admin JWT mint (hemp, stilo), open card charge (hemp), reassignTask (hyperdrive), unauthenticated uploads served publicly (distribution, hemp), self-promote to super-admin (stilo) | 5 backends | One-line to one-hour fixes; without them a merge copies the hole into the merged service |
| P3 | Commit lockfiles in the eight repos that gitignore them; add `engines.node` (20 LTS) everywhere; add `npm ci && npm run build` (and `npm test` once tests exist) as a required check before every SSH/PM2 deploy step | all | Today no deploy is reproducible and no CI gate can even run (`repos/hemp-backend.md` §10) |
| P4 | Delete the confirmed-dead code: `partnerAuth` (4 repos), dead auth/isSuperAdmin middlewares, the second promotion engine, `common/index.js` bundle (after P5), ~1,400 lines in promotion-engine, 6 commented crons, two dead route files | backends | Dead security-shaped code is how the next developer ships another open route |
| P5 | Pick **promotion-engine `engine.js`** as the one evaluator: promotion-backend calls `/evaluate` the way it already calls `/compile-promotion`; delete the vendored bundle and `engine/` | promotion-* | Cheapest merge in the estate and it stops silent drift on checkout discounts |

## 2. The shared packages (Phase B, alongside our Phase 3)

Two private npm packages in the org, versioned, consumed by every backend and frontend:

- **`@hyper-tech/contracts`** — the Phase 3 contract package: types, enums, id and money and
  time conventions, event and error shapes, generated from `CANONICAL-DATA-MODEL.md` §7, with
  drift tests. Our estate imports the same package (`POS-Admin/shared/`, `wm-demo` via a
  generated JSON schema, since wm-demo is stdlib-only).
- **`@hyper-tech/backend-core`** — the files that are already byte-identical across 2–4
  backends: S3 upload (private-by-default), CORS from an env allow-list, Sentry init + error
  handler mounted **after** routes, request logging, one `errorHandler` producing the contract
  error shape, pagination helper with a server-side max, regex-escape helper, one auth middleware
  (below), one env-validation helper that checks **every** referenced variable at boot.

## 3. Platform services — one contract each, used by every frontend

| Service | Today | Target | Consumes | First consumer |
|---|---|---|---|---|
| **Identity & Auth** | one HS256 secret shared by 5 backends; static `x-api-key` in every browser; `localStorage`/unsigned-cookie sessions; roles as free strings | one issuer: short-lived access JWT (RS256/EdDSA, `iss`/`aud`/`kid`), httpOnly refresh cookie, revocation list, one `Role` enum from contracts, permissions checked server-side per route. Kinds: customer, staff, driver, tenant, service (for engine↔backend calls, replacing `PROJECT_API_KEY`) | contracts | every backend's admin routes, then storefront sessions |
| **Members** (customer identity) | `Member` ×2, `BlazeUser`, `idv_people`, `hw_identities` | one Person record with `kind` and external ids `{source,id}`; the matching ladder from `identity_match.py` becomes the merge policy | Identity & Auth | Verify, then hemp/stilo storefront accounts |
| **Verify** (ID verification) | Berbix + Persona + Didit + AgeChecker controllers in three backends; `isVerified` set from request body | our engine behind `/v3` (canonical) and `/v2` (Didit facade, already matches hyperwolf-backend's two calls); verification status written to Members only from a signed decision event | Members, Identity | hyperwolf-backend (swap Didit URL + key: `docs/IDV-SITE-INTEGRATION.md`), then hemp/stilo, then POS check-in |
| **Rewards** (points, wallet, Bounty) | `Member.walletAmount` settable by request; `alpineIQPoints`; AlpineIQ as the ledger; no audit | Bounty's append-only cents ledger generalised: `earn`, `adjust`, `redeem`, `record_paid`, idempotent by `(source, txn_key)`; AlpineIQ becomes a sync target, not the truth | Members, contracts | Bounty (already built), then wallet adjustments in hemp/stilo admin, then storefront loyalty display |
| **Promotions** | three engines, three enums, legacy 40-field model in brand backends, Promotions Suite in POS-Admin | promotion-engine's evaluator + promotion-backend's CRUD as one service; **cart totals computed here, server-side**, returned with `money_basis`; brand backends delete their local promo math | Catalog, contracts | hemp/stilo checkout (`submitCart`), POS-Admin Promotions Suite as the admin UI |
| **Catalog** | Product ×3 shapes, taxonomy ×5 copies, Blaze sync in hyperwolf only | one Product with `platform`, `source: blaze\|first-party`, cents prices, one Brand/Category/Region tree with `platformAvailability`; Blaze/Meadow/Treez sync as adapters | contracts | Promotions (needs one product shape), storefronts, POS-Admin catalog screens |
| **Pricing & Cart** | client computes totals; inventory decrement is read-modify-write | server-side quote: `quote(cart) → lines, subtotal, tax, discounts, total (cents, basis)`; `$inc`-guarded reservation | Catalog, Promotions | hemp/stilo/hyperwolf checkout and POS |
| **Orders** | five schemas on two collections | one Order + OrderLine; status enum; events | Pricing, Members | logistics (Task↔Order ref), Bounty ingest (`/api/pos/sale` becomes an `order.completed` consumer) |
| **Logistics** (fleet, tasks, kits) | hyperdrive + copies in hyperwolf + distribution reaching into HW-DB | hyperdrive owns Fleet/Task/shift lifecycle; distribution owns kits and calls Fleet via API; one Region | Orders, Identity (driver kind) | POS-Admin Delivery/Dispatch/Driver App screens |

Rules that apply to every service: contract first (types + probe suite), one adapter per legacy
shape, money in cents, ids as `{source,id}` for anything external, events signed, no vendor SDK
in a screen.

## 4. Repo merges — order, method, risk

| Order | Merge | Method | Risk | Blast radius if it goes wrong |
|---|---|---|---|---|
| 1 | promotion-backend + promotion-engine → **promotions-api** | P5 above, then move CRUD routes into the engine repo (Express 5, Mongoose 8, jest already there); reconcile rule-type enum to six; add auth | **Low** — smallest repos, 4 lockfile-pinned deps, engine newer copy is the target | Checkout discounts for all three brands; mitigated by a golden-cart probe suite run against old and new before cutover |
| 2 | hemp-backend + stilo-backend → **commerce-api** | stilo is the base (Mongoose 8, hemp is the fork); parameterise `retailerId`/`storeId`→`tenantId`, `HempProducts`/`StiloProducts`→`Product` with `platform`; brand strings, email templates and CORS lists become per-platform config; carry stilo's bug fixes | **Medium** — 25.6% identical, but `Order` diverged (58 differing lines) and both are Critical-security today (`repos/hemp-backend.md` §14, `repos/stilo-backend.md` §14); merge **after** P1–P3 | Both storefronts, both admin consoles, POS, webhooks, payments |
| 3 | hyperwolf-backend → commerce-api | last, because it carries the Blaze integration (its real job), Node 12, Mongoose 5, plaintext admin passwords, and a stale fleet copy that must be deleted rather than merged | **High** — the Blaze sync cron and the Onfleet/CanPay/Stronghold integrations have no tests; needs a shadow run | The live hyperwolf.com storefront and Hyperdrive fleet ops |
| 4 | hyperdrive-backend absorbs the fleet models from hyperwolf-backend and distribution-backend; distribution stops opening HW-DB and HEMP-DB and calls logistics/identity APIs → **logistics-api** (hyperdrive + distribution, or two repos sharing `backend-core`) | schema-copy deletion + API calls; DynamoDB/IoT stay in hyperdrive | **Medium** — distribution's 1,270-line `kitDistributed` and 3,800-line Blaze sync are untested god-functions; do not refactor them, just cut their DB coupling | Driver dispatch and weekly kit distribution |
| 5 | hyperwolf-super-admin + hemp-retailer-admin → **admin-web** | not a code merge: a new Next.js admin built screen-by-screen against the contracts package, retiring CRA (unmaintained since 2023). Start with the screens both apps duplicate (regions, memberships, inventory, roles) | **Medium-High** by size (385k lines), **low** by risk if done as strangler | Every back-office user; mitigated by running both until parity |
| 6 | three storefronts → **storefront-web** | base = hyperwolf-frontend-nextjs (Next 16, TypeScript, Zod); hemp and stilo become brand themes + platform config; delete the CITIES triplicate, one API client, real sessions | **Medium** — hemp is Next 14 / React 18 with no TS; stilo has 65 unsanitised HTML sites; the two must be re-implemented, not moved | Three customer sites' SEO and checkout |

End state: `contracts`, `backend-core`, `commerce-api`, `promotions-api`, `logistics-api` (or
hyperdrive + distribution), `admin-web`, `storefront-web`. Twelve → six or seven. Our estate
(POS-Admin, wm-demo, idv-engine) plugs in through `contracts` and stays where it is until the
owner decides where Bounty/Verify/Docs are hosted.

## 5. What is deliberately not proposed

- Rewriting any backend in TypeScript or another framework before it has tests and a contract.
  The upgrade path is: lockfile → engines → Mongoose 5→8 (hemp, hyperwolf, promotion-backend) →
  Express 4→5 → then TypeScript at the contract boundary only.
- Merging distribution-backend into hyperdrive-backend in one step. They share one file and one
  drifted `Order`; the win is cutting the DB coupling, not the repo count.
- Consolidating the GAS estate. It is context; its Blaze/Meadow/Treez/Airtable integrations are
  the reference implementation for the Catalog and Logistics adapters, not a target.

## 6. Decisions that are the owner's (asked one at a time after the grade)

1. Rotate the committed keys now, or after the contractor is informed.
2. Approve the merge order above, or change it.
3. Whether the contractor keeps write access during Phases 0–B.
4. Where Bounty/Verify/Docs are hosted long term: inside `commerce-api`/`admin-web`, or as their
   own services behind the same contracts.
5. Whether AlpineIQ stays the loyalty truth (Rewards syncs to it) or becomes a mirror.
