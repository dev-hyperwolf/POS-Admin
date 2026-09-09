# Architecture map — the twelve Hyper-Tech-inc repos as they actually are

Synthesised 2026-09-09 from the twelve per-repo reports in `repos/` (each claim there carries a
`path:line`; this file cites the report section, not the line, to stay short). Every repo is
pinned at the SHA in `metrics/<repo>.md`. Every repo has exactly **one commit**, dated 8–9
September 2026, by one author — there is no history behind any of this.

## 1. What exists

| Repo | Kind | Stack | Lines | What it is, from code |
|---|---|---|---|---|
| hyperwolf-backend | API | Node 12 (engines) · Express 4 · Mongoose 5 · 3 Mongo DBs | 34,681 | Blaze POS middleware + storefront/cart/order API + admin CMS + an older copy of the fleet/dispatch system, in one process (`repos/hyperwolf-backend.md` §1) |
| hemp-backend | API | Node ≥12 (engines) · Express 4 · Mongoose 5 · 1 DB | 37,313 | Fork of stilo-backend: storefront + admin + retailer + POS + webhooks for the Hemp brand (§1, §12) |
| stilo-backend | API | Express 4 · Mongoose 8 · 2 DBs (Sequelize declared, unused) | 45,438 | The same service for the Stilo brand; 25.6% of hemp-backend is ≥90% identical to it, 2,507 lines exactly (§12) |
| hyperdrive-backend | API | Express 4 · Mongoose 8 · 1 DB + DynamoDB + IoT Core | 10,872 | Driver dispatch: fleet app API, admin task API, assignment engine (§1) |
| distribution-backend | API | Express 5 · Mongoose 8 · **3 DBs, two of them other services'** | 36,485 | Weekly kit distribution, Blaze inventory sync, discrepancies, PDFs, Socket.IO scans (§1) |
| promotion-backend | API | Express 4 · Mongoose 5 · **4 DBs** | 16,369 | Promotion CRUD (system of record) + a frozen vendored copy of promotion-engine + a third hand-rolled engine (§12) |
| promotion-engine | API | Express 5 · native mongodb driver · 3 DBs | 17,727 | Rule compile + cart evaluate service; ~8% dead code; no auth (§6, §12) |
| hyperwolf-frontend-nextjs | Web | Next 16 · React 19 · TypeScript | 46,988 | Hyperwolf storefront; calls hemp, hyperwolf and distribution backends (§1) |
| hemp-frontend-nextjs | Web | Next 14 · React 18 · JS | 45,869 | Hemp storefront; calls hemp-backend (§1) |
| stilo-frontend-nextjs | Web | Next 15 · React 19 · JS | 25,163 | Stilo storefront; calls stilo-backend + two hyperwolf endpoints (§6) |
| hyperwolf-super-admin | Web | CRA · React 18 · JS | 296,940 | One admin SPA for Hyperwolf/Hemp/Stilo/Hyperdrive; 7 backend base URLs; 33% of lines are vendored template, duplicated page trees or a 19k-line city list (§0) |
| hemp-retailer-admin | Web | CRA · React 18 · JS | 87,888 | "Stilo POS" retailer/store admin + in-store POS; 4,146 lines identical to super-admin (§12) |

Total: 702,000 source lines, of which roughly 100,000 are vendored, generated-data-as-code or
duplicated page trees in super-admin alone, and a further 7,043 lines are exact cross-repo duplicates
(`metrics/CROSS-REPO-DUPLICATES.md`: 64 groups); separately, 9,543 hemp-backend lines are ≥90%
identical to stilo-backend (the 2,507 exact hemp↔stilo lines sit inside both figures).

## 2. Who talks to whom

```
                 hyperwolf-frontend-nextjs ──┬──► hyperwolf-backend ──► Blaze, Onfleet, CanPay, Stronghold,
                                             │         │                 LedgerGreen, FHL, Berbix/Persona/Didit,
                 hemp-frontend-nextjs ───────┼──► hemp-backend ────────► AlpineIQ, SendGrid, TextVolt, Firebase,
                                             │         │                 Intercom, Weedmaps, Google, AWS S3/IoT
                 stilo-frontend-nextjs ──────┼──► stilo-backend ───────► (same vendor list, own copies)
                                             │
 hyperwolf-super-admin (7 base URLs) ────────┼──► hyperdrive-backend ──► Blaze, HERE, Klaviyo, FCM, TextVolt,
 hemp-retailer-admin (2 base URLs) ──────────┤          │                DynamoDB, IoT Core
                                             ├──► distribution-backend ► Blaze, S3, SendGrid, Socket.IO
                                             └──► promotion-backend ──HTTP /compile-promotion──► promotion-engine
                                                       (vendored old engine for /validate)        ▲
                                                                                                   └── hemp-backend calls /evaluate directly (comment only)

 Databases (Mongo):  HW-DB ◄── hyperwolf-backend(conn1), distribution-backend(conn3), promotion-backend(conn4), promotion-engine
                     HEMP-DB ◄── hemp-backend, hyperwolf-backend(conn2), stilo-backend(conn2: Admin, Legal, Authors…),
                                 distribution-backend(conn2: Admin, ResetRequest), promotion-backend(conn2), promotion-engine
                     STILO-DB ◄── stilo-backend(conn1), hyperwolf-backend(conn3: StoreProducts), promotion-backend(conn3)
                     PROMO-DB ◄── promotion-backend(conn1), promotion-engine
                     HYPERDRIVE-DB ◄── hyperdrive-backend
```

Three facts about that diagram decide the consolidation plan:

1. **Service boundaries are database boundaries, not API boundaries.** distribution-backend
   authenticates admins against the Hemp DB and reads/writes Fleets, Order, Product, Brand,
   Category in the Hyperwolf DB through its own drifted schema copies
   (`repos/distribution-backend.md` §3). stilo-backend keeps its own `Admin` collection in the
   Hemp DB (`repos/stilo-backend.md` §3). promotion-backend opens all four brand DBs. Any schema
   change in one repo silently invalidates copies in the others.
2. **One symmetric JWT secret, `JWT_ADMIN_PRIVATE_KEY`, is shared by hemp, stilo, hyperwolf and
   distribution backends** and signs four different identity types with the same claims shape
   (`repos/hemp-backend.md` §6). A token minted for a Store user is signature-valid on every admin
   middleware in the estate; only a boolean `isSuperAdmin` distinguishes callers.
3. **Every browser client carries one static shared key** (`PROJECT_API_KEY` / `x-api-key` /
   `x-auth-token`, with hardcoded fallbacks in two storefronts) and that key is the only gate on
   428 of 434 hemp routes and 51 of 53 stilo route files. Per-user identity is a client-supplied
   `memberId`/`consumerId` parameter. See `THE-GRADE.md` §2.

Production hosts seen in code (not verified live): `api.hyperwolf.prod.ths.agency`,
`api.direct.stage.hyperwolf.com`, `distribution-backend.js.thcs.in`, `api.stage.stilosupply.com`,
`hyperdrive.hyperwolf.com`, `thcs.in` (SSH deploy target for hyperwolf-backend and
hyperdrive-backend), `18.235.246.3` (root SSH target in hyperwolf-backend/stage.yml). The GAS
estate references `hyperwolf-prod-g7eluhkiza-uk.a.run.app` (Cloud Run), which no repo's CI
deploys to — how production is actually deployed is an open question in 5 of 7 backend reports.

## 3. Which repo is canonical for each concept

"Canonical" = the copy the business would keep. Where no copy deserves it, the cell says so.

| Concept | Copies today (repo: model) | Canonical today | Notes |
|---|---|---|---|
| Customer / member | hemp: `Member` · stilo: `Member` · hyperwolf: `BlazeUser` (Blaze-shaped `userData` blob) · hyperdrive/distribution: none (`Order.userData` blob) | **none** — hemp/stilo `Member` is the richest (wallet, ID image, verification flags) but `memberId` is a `Math.random()` string and identity is client-asserted | Our Verify `idv_people` and `hw_identities` are two more (`our-estate-contract-surface.md` §1) |
| Admin / staff user | hemp, stilo, hyperwolf, hyperdrive, distribution: `Admin` (5 copies; hemp, stilo and distribution share the HEMP-DB collection, hyperwolf has HW-DB, hyperdrive its own DB) + hemp/stilo `RetailerUser`/`StoreUser`/`Retailer`/`Store` login models | **hemp-DB `Admin`** is the physical record hemp, stilo and distribution all read | Roles: free strings in `userRoles[]` + boolean `isSuperAdmin`; permissions merged into the login response and never checked server-side |
| Product / catalog | hyperwolf: `Product` (Blaze `productData` blob, 6 indexes) · hemp: `HempProducts` (67 typed fields, 0 indexes) · stilo: `StiloProducts` + `StoreProducts` · distribution: `Products` (copy of hyperwolf) · promotion-backend: `Product` + `HempProducts` + `StoreProducts` (copies) | **two shapes, no winner**: Blaze-mirrored (hyperwolf) vs first-party typed (hemp/stilo) | Money: `Number` dollars everywhere; hemp `sku` unique+default `''` breaks on the second SKU-less product |
| Brand / Category / Region / Strain / Cannabinoid taxonomy | hemp, stilo, hyperwolf each: `Brand`, `Category`, `WebCategory`, `MainBrand`, `MainCannabinoid`, `MainStrain`, `Strain`, `Cannabinoid`, `Region`; promotion-backend: 3 per-platform copies of Brand/Category/Region; distribution: `Brand`, `Category`, `Regions`, `SubRegions` | **hyperwolf-backend** (Blaze-synced, cron `syncRegions`) for Region; nobody for Brand/Category | `require:` typo (not `required:`) in 8 hemp + 2 promotion-backend schema copies, fixed in a third |
| Cart | hemp/stilo/hyperwolf: `ActiveCart` (totals as `Number`, cart lines as `Object`) · promotion-engine reads `activecarts` natively | **none** — totals are computed client-side and trusted (`repos/hemp-backend.md` §14 #3) | |
| Order | hemp: `Order` (77 lines, 0 indexes) · stilo: `Order` (diverged, 102 lines) · hyperwolf: `Order` (`cartData`/`everFlow` blobs) · hyperdrive: `Order` (fleet view) · distribution: `Order` (hyperwolf copy + CanPay block) | **hyperwolf-DB `orders`** is the physical collection hyperwolf and distribution both write with two different schemas; hyperdrive writes `orders` in its own DB, and whether that is the same physical database is an open question (`repos/hyperdrive-backend.md` §2) | Time: epoch `Number`; status: free string; money: inside untyped `cartData` |
| Promotion | promotion-backend: `Promotion` (Mixed `rule`/`actions`/`ruleTree`, 27 fields) · hemp/stilo/hyperwolf: `Promotion` (a 40-field legacy shape, 8 fields in hyperwolf) · promotion-engine: reads `promotions` natively, constants disagree with the writer's enum | **promotion-backend `Promotion`** for storage; **promotion-engine `engine.js`** for evaluation logic (newest, has free-gift/shipping merge) | Three engines evaluate the same rule; rule-type enums disagree three ways (`repos/promotion-engine.md` cross-repo section) |
| Fleet / driver | hyperdrive: `Fleets` (hub, 14 inbound refs) · hyperwolf: `Fleets` (older copy, dead index) · distribution: `Fleets` (0.82 copy) | **hyperdrive-backend** | hyperwolf and distribution write the HW-DB collection; hyperdrive writes its own DB (same physical DB unconfirmed) |
| Task / delivery | hyperdrive: `Tasks` (65 fields, god-object) · hyperwolf: `Tasks`/`TaskModel` | **hyperdrive-backend** | Order↔Task linked by string fields only, no ref either way |
| Checklists / closeouts / breaks | hyperdrive: `closeOut`, `FleetCloseout`, `FleetOffDutyCloseout`, `Break`, `OnDutyChecklists` · hyperwolf and distribution: copies | **hyperdrive-backend** (three competing closeout models even there) | Cash closeout money lives in an untyped `closeoutObject` |
| Kit / distribution / inventory logistics | distribution only: `KitTemplate`, `KitDistributed` (63 fields, 5 levels deep, 0 indexes), `KitDispatch`, `Discrepancy`, `Inventory` | **distribution-backend** | Genuinely its own domain |
| Store / retailer / tenant | hemp: `Retailer`+`RetailerUser` and `Store`+`StoreUser` (both hierarchies, retailer login route never mounted) · stilo: `Store`+`StoreUser` · distribution: `platform` enum + `Regions` · everyone else: none | **stilo `Store`** by usage | Tenant key (`retailerId`/`storeId`) is a client-supplied string, unindexed |
| Wallet / points / rewards | hemp/stilo: `Member.walletAmount` (settable by request) · `Order.alpineIQPoints` · AlpineIQ calls in hemp/stilo/hyperwolf | **none in code** — AlpineIQ (vendor) is the de-facto ledger | Our Bounty ledger is the only integer-cents, audited implementation in the estate |
| Identity verification | hemp/stilo/hyperwolf: Berbix + Persona + Didit + AgeChecker controllers (4 vendors, self-asserted `isVerified` in hemp) · hyperwolf calls Didit via `/v2` | **our Verify `/v2` facade** is already the drop-in for hyperwolf-backend (`our-estate-contract-surface.md` intro) | |
| Auth / sessions | four backends (hemp, stilo, hyperwolf, distribution) verify JWTs with the same HS256 secret, hyperdrive with its own `JWT_FLEET_PRIVATE_KEY`; no refresh, no revocation, no issuer/audience; frontends store tokens in `localStorage` or unsigned cookies | **none** | Must become one service before anything else is merged (`CONSOLIDATION-AND-PLATFORM-SERVICES.md` §1) |
| S3 upload helper, CORS/Sentry middleware, email templates, Intercom/TextVolt/LedgerGreen controllers | byte-identical in 2–4 backends | any one | The shared-package case in one line |

## 4. Where the same concept exists twice with different shapes

Ranked by how much it will hurt the consolidation.

1. **Product**: Blaze-mirror `productData` blob (hyperwolf, distribution) vs typed 67-field
   `HempProducts` (hemp, promotion-backend) vs `StiloProducts`+`StoreProducts` split (stilo).
   Price lives at `totalPrice`, `productPrice`/`unitPrice`/`salePrice`, or inside `productData`.
2. **Order**: five schemas on at least three physical collections (HEMP, STILO, HW; hyperdrive's DB unconfirmed); money inside `cartData`
   (hyperwolf/hyperdrive/distribution) vs typed `subTotal`/`total` (hemp/stilo); status is a free
   string with a Joi enum at the edge in some repos and nothing in others.
3. **Person**: `Member` (hemp/stilo, `memberId` random string), `BlazeUser` (hyperwolf, Blaze
   `userData`), `Admin` (5 copies), `Fleets` (driver, with password), `Store`/`Retailer`/
   `StoreUser`/`RetailerUser` (tenant logins) — plus our `hw_identities`, `idv_people`,
   `associates`, `inc_identities`. Nine shapes for "a person who logs in or buys".
4. **Region**: hyperwolf `Region` (Blaze-synced, 8 fields), hyperdrive `Region` (36 fields with six
   refs to models that do not exist in that repo, never queried), distribution `Regions`+`SubRegions`
   (platform enum, KMLs), hemp/stilo `Region`, promotion-backend three per-platform copies.
5. **Promotion**: legacy 40-field brand-backend shape vs promotion-backend Mixed-blob shape vs
   promotion-engine's constants. Rule types: 4 vs 4 (different) vs 6 vs 4-with-a-phantom.
6. **Timestamps**: `createdDate` as epoch `Number` (majority), `Date` (hyperdrive Fleets,
   distribution conn3 models, promotion-backend `createdAt`), formatted `String` (hemp/hyperwolf
   `ErrorLog`, `FhlScript`), hyperdrive `Region.created/modified`. Mongoose `timestamps` (boolean or
   object form) is used by 3 models across 7 backends.
7. **Soft delete**: none (hemp, stilo, promotion), `isDeleted` (Fleets), `isActive+deletedAt`
   (Announcements), `deleted` (Region), `taskArchived` (Tasks) — five conventions.
8. **Roles**: boolean `isSuperAdmin` on four models; free-text `userRoles[]` joined by name to
   `RoleAndPermissions.roleName`; `staticDB/roles.json` as a second source of truth; frontends
   re-derive permissions from `localStorage`.

## 5. Where our estate sits in this map

POS-Admin + wm-demo (`our-estate-contract-surface.md`) is a third shape for identity, money and
time, but it is the only place in the whole map where money is integer cents end-to-end, ids are
never `Math.random()`, webhooks are HMAC-signed both ways, idempotency is a database constraint,
and every route has a probe. Verify's `/v2` is already written against hyperwolf-backend's real
calls. Bounty has no production counterpart because the production estate has no rewards ledger —
AlpineIQ holds it. That is the seam Phase 3 builds against.
