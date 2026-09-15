# Engage Spine — status

## Phase 4 — Promotions persistence + cart eligibility (2026-09-10)

Plan: `docs/ENGAGE-PLAN-2026-09-10.md` §4/§8 Phase 4. Build contract: `docs/ENGAGE-BUILD-
CONTRACT.md` §1.1 (naming: the table is `engage_promotions`, NOT `internal_promos`, which
stays store.py's own Weedmaps-mirror table, untouched).

**What shipped.** `wmdemo/engage/promotions.py` (new): `engage_promotions`/`engage_promotion_
usage`/`engage_product_lists` CRUD, `eligible(cart, customer_id, store_id, channel, codes,
now)`, `consume(order_id, promotion_ids, customer_id)` (idempotent on `(promotion_id,
order_id)`), `to_production_export(id)` via `rules.to_production` (never modified — only
imported). Schema additive on `wmdemo/engage/schema.py`: `engage_promotion_usage` and
`engage_product_lists` (new tables), a UNIQUE-nullable index on `engage_promotions.code`, an
`updated_by` column (PRAGMA-guarded ALTER, same pattern as the six `hw_identities` columns).
Routes in `engage/api.py`: `GET/POST /api/promos/internal` (dual-shape — a body carrying
`discount` persists to `engage_promotions`; the pre-existing WM-mirror shape is byte-for-byte
unchanged), `GET/POST /api/promos/eligible`, `POST /api/promos/consume`; wired into `server.py`
next to the pre-existing `/api/promos/*` routes with zero changes to their own behavior (see
that file's own comment at the dual-shape branch). `POST /api/pos/sale` gained an ADDITIVE,
OPTIONAL promotions-consume hook (only runs when the body carries `promotion_ids`). POS side:
`pos/screen-cart.jsx`'s `applyPromo` checks the live API through `window.HW_LIVE.post()` first
and falls back to the three hardcoded `PROMO_CODES` (relabelled "(offline code)") only when the
API is genuinely unreachable (network failure/timeout/gated) — never merely because the live
side refused the code; the register screen (`pos/screen-register.jsx`) was not touched.
`pweb/app.jsx`'s `saveBuilder` now persists through `window.HW_PROMOS_LIVE.upsertInternal`
(that seam needed no signature change — it already forwards its `fields` object verbatim; only
a new `listInternal()` GET method was added) and `Suite()` pulls persisted promotions back on
mount via `pweb/merge.jsx::mergeEngageRows`, so a saved promotion survives a reload.

**Verified.** `qa/engage_promotions_probe.py` 62/62, own scratch DB, no server. Both owner
examples proven on synthetic carts: "customer in audience Lapsed VIPs → reward Welcome back
$10, delivery only" (auto-applies in-audience/delivery, refuses on the wrong channel/audience/
store with the exact reason) and "Raw Garden + Concentrates 30% off excluding list Clearance
exclusions" ($12.00 with the exclusion list applied to the one qualifying line, $21.00 without
it — the list genuinely changes the number). Stacking (`priority` ASC, a non-stackable
candidate stopping every later one, combined discount clamped to the cart total), usage/per-
customer limits, `consume()` idempotency (including a `kind="points"` action crediting the real
ledger once, never twice on replay), and `to_production_export()` emitting only real production
operators (`$nin` routed to `unsupported`, never fabricated) are all covered. Registered in
`qa/battery.py` (SUITES + `EXPECTED_CHECKS["engage_promotions_probe"] = 62`,
`TOTAL_CHECK_FLOOR` 3141 → 3203; `idv_rules_probe`/`idv_store_probe`/`idv_api_probe` left
UNCHANGED at 448/95/236). `node --test test/global-collisions.test.mjs` 17/17, including
`Promotions Suite.html` and `Hyperwolf POS.html`. Confirmed over real HTTP against a scratch
database (subprocess `wmdemo.server`): dual-shape `/api/promos/internal` (both shapes),
`/api/promos/eligible` (GET+POST), `/api/promos/consume` (with replay), and `/api/pos/sale`
with and without `promotion_ids` — `internal_promos` verified untouched by the Suite-shape path.

**Known, documented gaps (not blockers).** A Suite `bundle` offer (`promo/builder-native.jsx`'s
free-text-only editor — no SKUs, no price) persists fine but `eligible()` always reports it
`unsupported`: `_compute_discount`'s bundle branch needs `bundle_skus`/`bundle_price_cents`,
neither of which the current editor supplies. A Suite `points` offer is a MULTIPLIER (e.g. "2×
points earned"); `engage_promotions`'s own `points` action is a FLAT AWARD credited by
`consume()` — turning one into the other needs the order's own earn amount, not known at save
time, so the adapter (`engage/api.py::_suite_action_from_discount`) deliberately carries the
Suite's multiplier through as `action["multiplier"]` (not `action["value"]`) so `_compute_
discount` honestly reports it unsupported rather than guessing. Both are additive, single-
function fixes once a real bundle/points editor lands — see that adapter's own docstring.
`engine/promotion-engine` stacking in production is caller-array-order with no priority/store/
channel/audience concept at all (`docs/ENGAGE-COMPAT.md`); this build's `priority`-ordered
stacking with store/channel/audience scoping is richer than what `to_production_export()` can
express back into that engine — the export carries `action`/`stackable`/`priority` alongside
the compiled rule for the dev team's own reference, but production itself does not read any of
those three fields today.

**Before any push.** Same gate as every other phase (contract §7): `engage_promotions` is now
wired (this phase's entire job), so that specific line of the Phase 1-3 "before any push"
checklist no longer applies verbatim — re-read it fresh rather than assuming it still says
"unwired" is the safe state.

---

Updated 2026-09-10 (Phase 1-3 integration, below). The eleven sibling modules (schema, errors, identity, ledger, consent,
rules, traits, rewards, documents, links, policy, msg_adapter) already existed with green
probes; this pass is the **integration**: `engage/api.py` (every route), `engage/serve.py`
(the `/api/engage/*` + public `/l/<token>` wiring), the required `server.py` core changes, the
`pos_sales.customer_id` traits wiring, and the API-level probe. Build contract:
`docs/ENGAGE-BUILD-CONTRACT.md`. Plan: `docs/ENGAGE-PLAN-2026-09-10.md`.

## What shipped

- **`wmdemo/engage/api.py`** — every route in the contract §2 table: customers list/get/edit
  (tags, merge, field edit — store ids checked against `stores.ids(active_only=True)`), consent
  + inbound sms/email (Twilio/SendGrid-shaped HMAC signature check, 401 on failure, no write),
  points earn/redeem/adjust/get, loyalty programs/tiers/rewards CRUD + usable + redeem + refund,
  audiences CRUD + preview + from-prompt, documents CRUD + render, landing-pages CRUD, messages
  CRUD + check + test-send + send, journeys CRUD + activate/pause + report, a derived-parameters
  create route, insights, and the `import/alpine` dry-run stub. Every `engage.errors.EngageError`
  subclass maps to the documented 4xx exactly like `shells_api.py`'s `_error_status`; every write
  route requires a non-empty `actor` (no `OPERATOR_EMAIL` fallback); manager gates (`points/
  adjust`, loyalty program/tier/reward writes, `messages/*/send`, `journeys/*/activate|pause`,
  `parameters`) go through `contests.is_manager(actor)`; every body is type-checked before it
  reaches a sibling module, so a malformed request is a 400 with a `code`, never a 500.
- **`wmdemo/engage/serve.py`** — `handle_get`/`handle_post`/`handle_head`, registered into
  `server.py` exactly like `shells_api.py`. The public `GET|HEAD /l/<token>` route: per-token AND
  per-ip fixed-window rate limiting (`links.check_public_route_rate_limit`, 429 over either cap),
  HEAD resolves without counting a click, GET counts and renders the landing document through
  `documents.render(doc, ctx, "landing")` with the page's `gate_enabled` and the resolved
  customer's context, an expired token answers `410`, an unknown one `404` — both an honest
  rendered page, never a silent 200.
- **`server.py` core changes** (called out per the contract, not buried): `do_HEAD` added (did
  not exist before this build), scoped to `/l/*` only; `Handler._send` gained a `head=False`
  kwarg that computes every header (status, content-type, content-length post-gzip, vary) exactly
  as the equivalent GET would and simply skips the final `wfile.write`; two new dispatch branches
  (`/api/engage`, `/l/`) in `_dispatch_GET`/`_dispatch_POST`; `/api/engage/inbound/` added to the
  public-mode write-token exemption tuple (inbound webhooks authenticate via signature, the same
  posture as the Weedmaps webhook and the IDV engine callback already in that tuple).
- **`wmdemo/engage/traits.py`** — `pos_sales.customer_id` is a real column now (this build's own
  task), so `_order_dates_for_customer`/`_pos_sales_rollup_for_customer` are real joins: money
  from `total_cents`, store from `store_id`. `compute_for_customer`'s `_gaps` list is empty now —
  `lifetime_spend_cents`/`aov_cents`/`favorite_store_id` and (when history is long enough)
  `order_freq_median_days`/`freq_drop_ratio` are real numbers, honestly `0`/`None` only when a
  customer genuinely has zero linked sales, never a placeholder. `lifetime_orders`/
  `favorite_category`/`favorite_brand` still come from `purchase_history.py` (Weedmaps delivery
  orders — a real, different, still-money-unlinked order population; see the module's own
  docstring for why that split is correct, not a shortcut).
- **`qa/engage_api_probe.py`** (new) — every route once over the real handler (fake `_send`-
  recording handler, same convention as `qa/shells_probe.py`), a full landing flow end to end
  (mint → HEAD not counted → GET counted → expired → unknown → rate-limited), consent STOP via
  the inbound route genuinely blocking the next `policy.check()`, and a real subprocess server in
  `WM_DEMO_PUBLIC` mode proving the write-token gate structurally. 70/70.
- **`qa/engage_traits_probe.py`** (revised) — seeds real `pos_sales` rows via `pos_sales.
  record_sale` instead of monkeypatching the now-real `_order_dates_for_customer`; 4 new checks
  for spend/AOV/favorite-store honesty. 19 → 23/23.

## Verified

- `qa/battery.py --only engage_schema_probe,engage_identity_probe,engage_ledger_probe,
  engage_rewards_probe,engage_documents_probe,engage_consent_probe,engage_policy_probe,
  engage_adapter_probe,engage_links_probe,engage_rules_probe,engage_traits_probe,
  engage_api_probe,shells_probe,incentives_routes_probe` — **687 PASS / 0 FAIL** across all 14
  suites, against a scratch database with a real server on port 8787 (`shells_probe`,
  `incentives_routes_probe` included as an unrelated-regression check — both still green, so
  this integration did not disturb either). `docs/SCOREBOARD.md` EG-1..EG-12.
- Every Engage probe alone: schema 11, identity 18, ledger 30, rewards 21, documents 56, consent
  31, policy 21, adapter 22, links 20, rules 34, traits 23, api 70 — **357/357** across the whole
  package.
- **Live, end to end, over real HTTP** against a server on port 8921 running against a COPY of
  the live database (`WM_DEMO_STATIC_DIR=/Users/jt/POS-Admin`): created a landing document and
  page, ran `messages/<id>/test-send` through the real `NullAdapter` against a real customer id
  from the copied database, minted a link, then over the wire — `HEAD /l/<token>` → 200, no body,
  `clicks` stayed 0; `GET /l/<token>` → 200, rendered HTML, `clicks` → 1; a backdated token → 410;
  an unknown token → 404; hammering one fresh token past `links.DEFAULT_TOKEN_LIMIT` (30) → 429
  from request 31 on. **This server is still running** — see "Run it locally" below.

## Dev call-outs

`docs/ENGAGE-COMPAT.md` has the full production-mapping audit (14 numbered gaps, §2). The ones
this integration pass itself brushed up against directly, for the dev team's own porting work:

- **Gap #1 (no `customer_id` on production orders)** — this build's own wm-demo side of that gap
  just closed: `pos_sales.customer_id` is real and `traits.py` reads it. Production's
  `hyperwolf-backend/models/Order.js` still has no equivalent column (see gap #1's own row).
- **Gap #2/#6 (no consent table, no unsubscribe path)** — `engage/api.py`'s inbound routes are the
  wm-demo shape of what gaps #2 and #6 ask production to add; the Twilio/SendGrid-style HMAC
  check here is a reference implementation dev can port directly (`msg_adapter.
  verify_twilio_signature`/`verify_sendgrid_signature`).
- **Gap #3/#12/#13 (no idempotency, no local redemption record)** — every money/points route here
  demonstrates the pattern (`idempotency_key` partial-UNIQUE index, redemption minted server-side
  before any external call would happen) that gaps #3, #12 and #13 ask production to adopt.
- **Gap #14 (tier ladder never persisted)** — `loyalty/tiers` here is real CRUD against a real
  table, but ladder VALUES were never decided (see "What waits on the owner" below) — do not treat
  this build's `gold`/`silver` naming as the answer to gap #14's four-ladder conflict.
- One gap this build's own routes ADD, not close: `/api/engage/inbound/email`'s SendGrid
  signature check is verified over `json.dumps(body, sort_keys=True)` — a re-serialization of the
  parsed JSON body, not the provider's original raw bytes, because `server.py`'s existing
  `_dispatch_POST` parses every POST body to JSON before any route sees it and there is currently
  no raw-bytes pass-through for this one route. Self-consistent within this demo (the probe signs
  the same canonicalization it verifies), but a real SendGrid webhook's signature is computed over
  its own exact raw bytes and would need `server.py` to thread the raw body through for this one
  route before this check is production-honest. Not one of the 14 numbered gaps in
  `ENGAGE-COMPAT.md` — flagged here as a 15th, specific to this build's own wiring choice, not to
  the production side.

## What waits on the owner

- **Concept pick** — four Engage UI directions exist as static mockups
  (`POS-Admin/explorations/Engage - Concept {A,B,C,D}...html`, indexed at `Engage - Concepts
  Index.html`); none is built against this API yet.
- **Tier ladder** — bronze/silver/gold/platinum here is a schema placeholder, not a decision;
  `ENGAGE-COMPAT.md` gap #14 lists four real, disagreeing ladders already live across register,
  the consumer app, this Engage draft, and the contract doc. `loy_tiers.entry_rule_json`/
  `benefits_json` are ready to hold whatever the owner picks; nothing here assumes an answer.
- **Providers** — `msg_adapter.get_adapter` is env-key-gated (`TWILIO_*`/`SENDGRID_*`); every send
  in this build's own verification used `NullAdapter` (no network call ever made). Real keys are
  an owner decision, not a code change.
- **Alpine export** — `import/alpine` is the documented stub (`rows_read:0`,
  `reason:"no_export_configured"`); `ENGAGE-COMPAT.md` §3 already flags that no bulk/historical
  Alpine export endpoint was found in any production file read, so real Alpine access (API scope
  or a CSV) is an owner/vendor question before this route can do anything but the honest stub.

## Before any push

Per the contract §7 gate, restated: do not push if a demo tenant name or the tenant switcher
exists anywhere touched by this build (none does — checked, this integration touched no
tenant-facing surface); any store id in code/fixtures/seeded rows is not one of
`stores.ids(active_only=True)` (checked — `_customers_edit`'s `favorite_store_id` validation and
every probe fixture use real ids only); any customer/order/points number did not derive from a
real writer (`hw_identities`/`pos_sales`/`loy_ledger`, checked — `_customers_list`/
`_customer_detail`/`_insights` are all real SQL, no PRNG); a screen shows a number with no real
data behind it instead of `null`/`0` + an honest flag (checked — `insights`, `_audience_preview`,
`traits.compute_for_customer` all follow this); `engage_promotions` has been wired to any route
(checked — `engage/api.py` never references that table; it stays reserved, Phase 4, unwired).

## Run it locally

```bash
cd /Users/jt/wm-demo && WM_DEMO_STATIC_DIR=/Users/jt/POS-Admin python3 -m wmdemo.server
```

**The server used to verify this pass is still running**: port **8921**, against a COPY of the
live database at
`/private/tmp/claude-501/-Users-jt-Library-Mobile-Documents-com-apple-CloudDocs-Claude-Co-work-files-gas-projects/466a7459-04a7-4901-a95e-3692917f0a20/scratchpad/engage-demo/wmdemo-copy.sqlite3`
(never the repo's own `wmdemo.sqlite3` — that file was only ever read, to make the copy), with
`WM_DEMO_STATIC_DIR=/Users/jt/POS-Admin`. `lsof -i :8921` finds it; its log is at
`.../scratchpad/engage-demo/server.log` in that same directory. A document (id 1, "Demo
Winback"), a landing page (id 1, slug `demo-winback`), an audience (id 1), and a message (id 1)
were created on it during verification and are still there.

## Alpine import

Built, dry-run only by the owner's ruling: `POST /api/engage/import/alpine {kind: contacts|balances|history, dry_run: true, limit}` reads the live account (GET only, ≤ 2 req/s, `HW_ALPINE_OFF=1` kill switch) and returns a run report (`rows_read == inserted + unchanged + conflicts + rejected`, plus `assumed_store` for "Hyperwolf"-store contacts mapped to Lake Elsinore and `retired_store` for "Hyperwolf Hemp"). A real run refuses unless the body carries `confirm: "cutover"` and a manager actor; it writes identities only through the real identity writer, consent through `consent.record` (source `import`), the Alpine contact id as an external id, and never a plain email or name. Store map: Chkn n Wafflez → Corona, Stilo Supply → Long Beach, Hyperwolf West Hollywood → West Hollywood, Hyperwolf → Lake Elsinore. The one-time real pull happens at cutover.
