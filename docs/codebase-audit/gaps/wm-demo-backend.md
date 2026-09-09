# wm-demo backend — gap inventory vs `contracts/index.js`

Scope: `wmdemo/*.py` excluding `idv_*.py`, `incentives/`, `contracts.py`, `contracts_api.py`.
Read first: `BUILD-AGAINST-THE-SOURCE.md` §3, `wmdemo/contracts.py` (adapters), `contracts/index.js` `ENUMS`.

**Headline finding**: only `server.py` imports the contract at all (`from . import contracts_api`,
`server.py:91`), to serve the new `/api/contracts/*` routes. None of the 33 other files in scope —
catalog, pricing, promos, checkin, fulfillment, mapping, taxonomy, brands, identity — call
`contracts.validate/is_enum/money/to_iso/external_id`. `contracts.py`'s adapters (`person_from_associate`,
`store_out`, `standing_out`, `contest_out`, `points_entry_out`, `verification_session_out`,
`person_from_idv`, `order_from_pos_sale`/`pos_sale_from_order`) cover only the Bounty/Verify-shaped
records; every enum, money boundary and id below is untouched by the contract layer.

## 1. Enum literals

| Vocabulary | Where | Contract enum |
|---|---|---|
| `txn_type` sale/refund/void | `server.py:3421`, `pos_sales.py` schema | `TxnType` — matches exactly |
| product mapping decision | `mapping.py:630 MAPPING_DECISIONS = {"exact","auto"}`; `server.py:420 d in ("exact","auto")`, `server.py:424 elif d in ("ai","review")`; `store.py:151 status TEXT NOT NULL DEFAULT 'active'` (review_queue `state` default `'open'`) | NO CONTRACT ENUM YET → propose `MappingDecision: [exact, auto, ai, review, reject]` |
| brand/SKU state | `brands.py:282 STATES = ("mapped","mapped_empty","unmapped","absent_from_wm","unbranded")` (used `brands.py:2763`) | NO CONTRACT ENUM YET → propose `BrandSkuState: [mapped, mapped_empty, unmapped, absent_from_wm, unbranded]` |
| taxonomy map kind | `taxonomy.py:2215 if kind not in ("auto","sku","sub_category")` | NO CONTRACT ENUM YET → propose `TaxonomyMapKind: [auto, sku, sub_category]` |
| fulfillment stage | `fulfillment.py:129 WM_STATUS_MAP` → `fulfillment.py:168 STAGES = tuple(WM_STATUS_MAP)` = verify\|pack\|packing\|ready\|done\|canceled; `fulfillment.py:170 TERMINAL_STAGES` | Contract `OrderStatus` (pending/confirmed/packed/out_for_delivery/completed/cancelled/refunded) does **not** match this vocabulary at all — different stage names, different count. NO CONTRACT ENUM YET → propose `FulfillmentStage` distinct from `OrderStatus`, or reconcile the two |
| WM order status (as received) | `fulfillment.py:129 WM_STATUS_ORDER = ("DRAFT","PENDING","IN_PROGRESS","READY_FOR_ATTAINMENT","COMPLETE")` | third, separate vocabulary from both `OrderStatus` and `STAGES` — same gap |
| checkin state | `checkin_api.py:101-102 _SETTABLE=("waiting","left")`, `_ALL_STATES=("waiting","bound","served","left")`; used `checkin.py:120,905,964,995,1050` | NO CONTRACT ENUM YET → propose `CheckinState: [waiting, bound, served, left]` |
| checkin_binds state | `store.py:264-270` comment: `auto\|confirm\|manual\|rejected\|released`; set at `checkin.py:905` (`"bound"` via bind, not this enum — verify against `bind_gate.py` write path) | NO CONTRACT ENUM YET → propose `CheckinBindState: [auto, confirm, manual, rejected, released]` |
| promo relation kind | `store.py:237-241 promo_links CHECK(relation IN ('mirrors','supersedes','conflict'))` | NO CONTRACT ENUM YET → propose `PromoRelation: [mirrors, supersedes, conflict]` |
| internal promo kind | `store.py:227-231 internal_promos.kind` comment: `percent\|amount\|bogo\|bundle\|tiered` (free-text column, not CHECK-enforced) | overlaps contract `RuleType` (`cart,product,user,bogo,time,payment`) but vocabularies differ — NO CONTRACT ENUM YET → reconcile or propose `InternalPromoKind` |
| city room / provision state | `cities.py:214-220 CHECK (room IN ('express','scheduled'))`, `CHECK (provision_state IN ('live','requested','unprovisioned'))` | NO CONTRACT ENUM YET → propose `CityRoomKind: [express, scheduled]`, `ProvisionState: [live, requested, unprovisioned]` |
| adjustment kind | `adjustments.py:73 _REGISTRY` (currently one entry: `rounding`) | small, registry-based — low priority, but same shape gap |
| identity verification method/decision | `store.py:511-521 identity_verification_log`: method `didit\|in_store\|wm_document\|manual`, decision `approved\|declined\|review\|unknown` | overlaps contract `VerificationStatus`/`VerificationChannel` in spirit but literal values differ — NO CONTRACT ENUM YET, needs reconciliation with `idv_*.py` (out of scope here) |
| identity review outcome | `store.py:543-549 identity_review_queue.outcome IN comment ('ambiguous','undetermined')` | NO CONTRACT ENUM YET → propose `IdentityReviewOutcome` |
| dead-letter source | `store.py:611-624 order_dead_letter.source` comment: `record_order_event\|upsert_order\|m001` (deliberately unconstrained, no CHECK — see table's own design note) | not a candidate enum by design (dead-letter table must accept anything) |

`Platform`, `PosVendor`, `ProductSource`, `IdSource` from the contract are **not referenced** anywhere
in this scope (`grep -ic blaze`: only `catalog.py:2`, `server.py:1`, `inventory.py:1`, `engine.py:1`,
`taxonomy.py:1`, all comments/docstrings, not live vendor branching) — this estate is Weedmaps-only
and doesn't yet exercise the multi-vendor enums.

## 2. Money

- **Dollars-at-rest**: `catalog.py:49-58` (`PRODUCTS` seed) stores `"price": 30.00` etc as a JSON-blob
  float dollar amount; read back at `catalog.py:779,814`.
- **Cents-at-rest**: `pos_sales.py:46 total_cents INTEGER NOT NULL`; `inventory.py:141 price_cents INTEGER` (batch_meta).
- **The conversion boundary** is `pricing.py:39-42 base_cents()`: `int(round(product["price"] * 100))`,
  documented at `pricing.py:8` as the one formula `engine.build_item_payload` must match byte-for-byte.
  `pricing.py:54-61 sale_price_cents()` derives the sale floor from it.
- **A second, independent dollars↔cents boundary** exists at `order_lines.py:102-114`
  (`_cents(v)`/`_dollars(c)`) — same `round(float(v)*100)` / `round(c/100.0,2)` shapes, reimplemented
  rather than importing `pricing.base_cents`/`dollarsFromCents`. Not wrong today (different input:
  WM's own string-or-number price field) but is exactly the "second copy" §3 warns about.
- Real counts: `cents` — `engine.py`:119, `promos.py`:41, `pricing.py`:91, `wm_validate.py`:31,
  `server.py`:30, `aov_goals.py`:21, `inventory.py`:19, `reco/core.py`:22, `pos_sales.py`:14,
  `order_lines.py`:14, `adjustments.py`:9, `store.py`:3. `* 100` — `engine.py`:9, `pricing.py`:7,
  `promos.py`:4, `reco/core.py`:2. `/ 100` — `engine.py`:13, `promos.py`:5, `wm_validate.py`:4,
  `pricing.py`:2, `server.py`:2, `identity_api.py`:2, `aov_goals.py`:2.
- No `contracts.money()`/`centsFromDollars()` call anywhere in scope — `pricing.py` and
  `order_lines.py` each hand-roll the boundary the contract already centralizes.

## 3. Time

Column-by-column, from `store.py` `CREATE TABLE` (line cited is the `CREATE TABLE`):
- **Epoch REAL** (`time.time()`-based): `events.ts` (75), `wm_order_events.ts/ingested_at` (82),
  `orders.updated_at` (99), `menu_state.last_pushed_at` (108), `wm_customer_mapping.first_seen_at/last_seen_at` (117),
  `hw_identities.*_at` (173), `fraud_review.created_at/resolved_at` (191), `checkins.arrived_at` (248, explicitly
  "absolute epoch, NOT elapsed"), `checkin_binds.ts` (264), `identity_verification_log.ts/expires_at` (511),
  `order_dead_letter.ts/resolved_at` (611). Also `catalog.py` (`reservations.expires_at`, `batches.received_at`),
  `inventory.py` (`batch_meta.received_at`), `fulfillment.py` (`order_stage.updated_at`,
  `stage_transitions.ts`, `wm_status_queue.created_at/updated_at/next_attempt_at`).
- **ISO text** (`strftime`/`isoformat`-based, `TEXT NOT NULL`): `wm_products.first_seen/last_seen/missing_since` (124),
  `product_mappings.created_at/updated_at` (129), `mapping_events.ts` (134), `mapping_absences.*_at` (157),
  `wm_promos.first_seen/last_seen/disappeared_at/end_date` (200), `internal_promos.starts_at/ends_at/created_at/updated_at` (227),
  `promo_links.created_at` (237), `identity_review_queue.created_at/resolved_at` (543), `associates.created_at`
  (`associates.py:37`, written via `_now()` = `time.strftime("%Y-%m-%dT%H:%M:%SZ", ...)`).
- **Mixed within one table**: `checkins` mixes epoch (`arrived_at`, migrated `doc_expires_at REAL`) with
  no ISO columns; `identity_verification_log` is pure epoch; `identity_review_queue` (created same
  migration wave) is pure ISO — two tables added days apart chose opposite time representations.
- Real counts of `time.time()` call sites (a migration must check every one): `store.py`:30,
  `catalog.py`:14, `server.py`:14, `fulfillment.py`:8, `mapping.py`:9, `engine.py`:13, `wm_client.py`:11,
  `reco/serve.py`:16, `taxonomy.py`:7, `inventory.py`:4, `purchase_history.py`:2, `brands.py`:2,
  `checkin_api.py`:3, `checkin.py`:1, `identity_api.py`:1, `wm_binding.py`:1, `reco/build.py`:2,
  `reco/fit.py`:1. `strftime` call sites: `store.py`:4, `pos_sales.py`:3, `server.py`:2, `associates.py`:1,
  `checkin.py`:1, `promos.py`:1, `mapping.py`:1, `aov_goals.py`:1, `wm_client.py`:1, `brands.py`:1,
  `reco/build.py`:1, `reco/serve.py`:1.
- No `contracts.to_iso()`/`is_iso_utc()` used anywhere in scope; every ISO string is hand-formatted per file.

## 4. Ids

- **Autoincrement INTEGER PK**: `events`, `wm_order_events`, `mapping_events`, `review_queue`,
  `hw_identities`, `fraud_review`, `wm_promo_redemptions`, `promo_events`, `internal_promos`,
  `promo_links`, `checkin_binds`, `hw_identity_audit`, `identity_verification_log`,
  `identity_review_queue`, `order_dead_letter` (all `store.py`); `reservations`, `order_line_batches`
  (`catalog.py:106,121`); `stage_transitions`, `wm_status_queue` (`fulfillment.py:429,446`).
- **String/slug PK**: `orders.wm_order_id`, `checkins.id` (`'ci-<epoch>-<short>'` — a formatted slug, not
  a UUID) (`store.py:99,248`); `products.sku`, `regions.region`, `drivers.driver`, `pickup_locations.id`
  (`catalog.py:95-136`); `inventory_locations.id` (`inventory.py:120`); `associates.associate_id`
  (`associates.py:37`, e.g. `"jordan-ames"`); `cities.city` (`cities.py:208`).
- **Composite PK, no surrogate id**: `kits(driver,sku)`, `region_stock(region,sku)`,
  `batches(region,sku,batch_id)`, `region_menus(region,wm_menu_id)` (`catalog.py`); `location_stock`,
  `batch_meta`, `channel_map`, `channel_gate` (`inventory.py:130-166`); `aov_goals(store_id,associate_id)`
  (`aov_goals.py:68`); `city_rooms(city,room)` (`cities.py:214`).
- **Vendor ids stored bare** (TEXT/INTEGER, never `{source,id}`): `wm_order_id` — 129 sites in
  `store.py` alone, plus `checkin.py`:47, `server.py`:33, `engine.py`:30, `checkin_api.py`:18,
  `order_lines.py`:15, `identity_api.py`:11, `purchase_history.py`:9, `fulfillment.py`:8,
  `wm_binding.py`:4; `wm_id`/`wm_menu_id`/`wm_customer_id`/`wm_cart_id` throughout `catalog.py`,
  `mapping.py`, `wm_client.py`. None pass through `contracts.externalId('weedmaps', id)`.
- Our own slugs (`associate_id`, `store_id`, `sku`) are correctly used as display/join keys, matching
  §3's "our own slug is a display key" rule.

## 5. Store/person names as literals

- `associates.py:61-67 STORES` dict (`elsinore→Lake Elsinore`, `west-la→West Hollywood`, etc.) — the
  file's own docstring (`associates.py:12-19`) says this is superseded by the `inc_stores` registry
  (`incentives/stores.py`, out of scope) as of 2026-09-08 but is still the **seed** and is read directly
  wherever `associates.py` doesn't defer to the registry.
  - **Note**: `incentives/stores.py` is out of scope per this task's exclusion list, so whether
    `associates.py` itself still calls the dict directly vs the registry needs a follow-up read of
    `associates.py` call sites against `incentives/stores.py` — flagged, not resolved, here.
- `associates.py:78-99 ROSTER` — 18 hardcoded `(associate_id, name, role)` tuples, e.g.
  `("manisha-saini","elsinore","Manisha Saini","Floor Manager")` — explicitly seeded to match
  `pos/app.jsx`'s previously-hardcoded `Manisha Saini` (per file docstring), i.e. one hardcode replacing
  another, now centralized in exactly one place (the seed list itself is the intended single source for
  a fresh DB, per its own comment at `associates.py:69-76`).
- No other scope file hardcodes a store name or person name as a bare string literal in logic (a
  targeted `grep -i elsinore\|"Lake Elsinore"\|manisha` outside `associates.py` returned nothing in
  scope files).

## 6. Second copies

1. **Store-ownership check duplicated**: `pos_sales.py:113-118 record_sale()` raises `UnknownAssociate`
   when `a["store_id"] != store_id`; `server.py:3113-3131` (`/api/aov/stats` handler) **hand-inlines the
   identical check** (`if _a["store_id"] != _store: return self._send(400, ...)`) instead of calling a
   shared helper — same rule, two implementations, one in a route handler. This is the exact pattern
   §3/prompt calls out; the code's own comment (`server.py:3119-3128`) documents the 2026-08-31 bug this
   duplication was patching, but patched it in place rather than factoring out `pos_sales`'s check.
2. **Money conversion boundary duplicated**: `pricing.py:39-42 base_cents()` vs `order_lines.py:102-114
   _cents()/_dollars()` — same `round(x*100)`/`round(x/100.0,2)` arithmetic, independently written.
3. **Ad hoc error shape, not `contracts.error()`**: `server.py` builds `{"error": ...}` literals directly
   169 times (`grep -ac '"error":' server.py`); `identity_api.py`:8; `fulfillment.py`:2. None use
   `contracts.py`'s `error()`/`http_status()`. This isn't two *different* helpers colliding — it's the
   contract's single helper simply not adopted yet anywhere in scope.
4. **Fingerprint functions — resolved, not duplicated**: `checkin.py:62` imports `_gov_id_hash,
   _lev_le1, _name_dob_fp, _norm_dob` from `engine.py`; those are themselves aliases
   (`engine.py:3600-3604`) to `identity_match.norm_dob/name_dob_fp/lev_le1/gov_id_hash`. Worth noting
   only because `engine.py:3585`'s own comment says this used to be a hand-copied duplicate and was
   fixed — a live example of §6 done right, kept here as the contrast case.
5. **Order stage vocabulary — three independent lists** describing overlapping concepts (not
   duplicate code, but duplicate *domain modeling*): `fulfillment.STAGES` (verify/pack/packing/ready/done/canceled),
   `fulfillment.WM_STATUS_ORDER` (DRAFT/PENDING/IN_PROGRESS/READY_FOR_ATTAINMENT/COMPLETE), and contract
   `OrderStatus` (pending/confirmed/packed/out_for_delivery/completed/cancelled/refunded). See §1.
6. **Routes in `server.py` that duplicate a module function** rather than adding logic: spot-checked
   `/api/pos/sale` (delegates to `pos_sales.record_sale`, `server.py:3487-3494`) and `/api/aov/goals/clear`
   (delegates to `inc_aov.clear_goal`, `server.py:3399`) — both are thin, correctly delegating. The
   `/api/aov/stats` handler (item 1 above) is the exception found, not the rule.

## 7. Per-file S/M/L, order, contract coverage

| File | Size | Reason | Covered by existing `contracts.py` adapter? |
|---|---|---|---|
| `pricing.py` | S | Single, already-isolated money boundary (`base_cents`); wire `centsFromDollars`/`money()` here first — smallest surface, unblocks §2 for everyone downstream | No |
| `associates.py` | S | Small (217 lines), one table, one seed dict/list; wire `Store`/`Role` enums and retire the `STORES` dict in favor of the registry | Partially — `person_from_associate` (`contracts.py:381`) adapts associate rows to `Person`, but the file's own literals aren't touched |
| `adjustments.py` | S | 213 lines, one registry entry; low urgency, just needs `Enum`-style registration if `AdjustmentKind` is ever added to the contract | No |
| `pos_sales.py` | S | 280 lines; `TxnType` already matches the contract 1:1 — just needs `C.isEnum('TxnType', ...)` swapped in for the literal tuple at `server.py:3421` | No, but `order_from_pos_sale`/`pos_sale_from_order` (`contracts.py:500-561`) already adapt its output shape |
| `order_lines.py` | S | 365 lines; fold its `_cents`/`_dollars` into `pricing.py`'s boundary (§2 item 2) | No |
| `checkin_api.py` | M | 1237 lines but one clear enum (`_ALL_STATES`) to promote | No |
| `checkin.py` | M | 1090 lines, consumer of the same states plus check-in/order matching logic; do together with `checkin_api.py` | No |
| `cities.py` | M | 1245 lines, two clean CHECK-constraint enums (`room`, `provision_state`) ready to lift verbatim | No |
| `aov_goals.py` | M | 319 lines logic but touches money (`goal_cents`) and the duplicated store/associate check (§6.1) — fix the duplication here alongside `pos_sales.py` | No |
| `fulfillment.py` | M | 1449 lines; reconciling `STAGES`/`WM_STATUS_ORDER` against `OrderStatus` is the highest-value enum fix in scope but needs care (§1, §6.5) | No |
| `promos.py` | M | 1114 lines; `PromoRelation`/internal promo `kind` are small, contained enums once located | No |
| `catalog.py` | M | 1793 lines; dollars-at-rest seed data (§2) plus several id shapes — mechanical but touches the most tables | No |
| `inventory.py` | M | 1269 lines; `price_cents` already correct, `channel` values are a small enum, low risk | No |
| `identity_api.py` | M | 1088 lines; `identity_verification_log` method/decision literals need reconciling with IDV's `VerificationStatus` (excluded file, cross-cutting) | No |
| `purchase_history.py` | M | 1268 lines; mostly read/aggregation, reuses `fulfillment.WM_TO_STAGE` correctly already (§1 note) | No |
| `identity_match.py` | M | 761 lines; fingerprint functions are the canonical, already-reused source (§6.4) — no fix needed, just contract-wrap the outputs | No |
| `wm_binding.py` | M | 585 lines; vendor-id-bare pattern (`wm_customer_id`) throughout | No |
| `wm_duplicates.py` | M | 511 lines; product-shape comparison, no enum/money surface found | No |
| `wm_dryrun.py` | S | 577 lines but narrow (dry-run capture only) | No |
| `taxonomy.py` | L | 2396 lines; `TaxonomyMapKind` is small but the file is large and load-bearing for the mapper — do after `mapping.py`'s decision enum lands | No |
| `brands.py` | L | 2887 lines; `BrandSkuState` (§1) is a clean 5-value enum but touched by a very large surface (141KB file) | No |
| `mapping.py` | L | 5763 lines, largest in scope; `MAPPING_DECISIONS` plus `review_queue`/`mapping_absences` states — highest line count, do after smaller wins prove the pattern | No |
| `engine.py` | L | 6175 lines; touches money (119 `cents` hits), time (13 `time.time()`), and re-exports `identity_match` — central but high blast-radius, last | No |
| `server.py` | L | 6952 lines, largest file; 169 ad hoc error literals (§6.3), the duplicated ownership check (§6.1), and nearly every enum above is *read* somewhere in its route handlers — do last, after every module it calls has its own enum wired, so `server.py`'s fix is "call `C.isEnum`" not "invent the vocabulary" | Partially — already imports `contracts_api` for `/api/contracts/*` |
| `wm_client.py` | L | 1537 lines; own `_error_pointers`/`_error_details` (JSON:API-style, `wm_client.py:94,140`) are a distinct, intentional shape (WM's error format, not ours) — not a duplicate of `contracts.error()`, note only |
| `wm_validate.py` | L | 2448 lines; validation rule engine with its own `Authority`/`Finding`/`Result` types — orthogonal to the contract's `SCHEMAS`, would need a design decision before touching, not a mechanical port |
| `reco/*.py` (7 files) | S each | Pure ranking core, explicitly "no I/O, no clock, no config, no DB" (`reco/core.py:1-3`) — no enum/money/id/time surface in scope | No |

**Recommended order**: (1) `pricing.py` + `order_lines.py` money boundary merge, (2) `pos_sales.py`
`TxnType` swap-in (already matches, free win), (3) `associates.py` + `pos_sales.py`/`server.py`
ownership-check dedup (§6.1), (4) `checkin.py`/`checkin_api.py` `CheckinState`, (5) `cities.py` room/
provision enums, (6) `fulfillment.py` stage reconciliation (needs a decision, not just a port), (7)
`mapping.py`/`brands.py`/`taxonomy.py` decision/state enums, (8) `server.py` last, wiring `C.isEnum`/
`C.error` into routes once every callee owns its vocabulary, (9) `engine.py` and `wm_client.py`/
`wm_validate.py` as their own follow-on decisions (large, or intentionally divergent shape).
