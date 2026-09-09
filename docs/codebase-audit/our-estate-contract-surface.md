# Our-estate contract surface — Bounty & Verify vs. a production Node/Mongo backend

Read-only audit, 2026-09-09. Scope: `wmdemo/incentives/` (**Bounty**) and `wmdemo/idv_*.py`
(**Verify**), their POS-Admin frontends, and the shared infra both ride on
(`server.py`, `store.py`, `identity_api.py`/`identity_match.py`, `pos_sales.py`, `catalog.py`,
`pricing.py`, `commerce-adapter.js`). Every claim carries a `file:line`. Two corrections to the
task brief, confirmed by direct read: **the live Bounty route prefix is `/api/incentives/*`**,
not `/api/inc/*` (nothing answers `/api/inc/*`); **`/v2/*` and `/v3/*` belong to Verify**, not a
separate shared surface — see §4.

A real production counterpart already exists for Verify: `hyperwolf-backend` (Node/Mongo, the
live `www.hyperwolf.com` site), which Verify's `/v2` facade is built to be a drop-in replacement
for (`POS-Admin/docs/IDV-PLAN-2026-09-08.md:48,536`). Bounty has no live counterpart yet — it
has a documented "production gap" at one function (`POS-Admin/docs/INCENTIVES-PLAN-2026-09-07.md:427-434`).
Blaze's own upstream ids (`shopId`/`companyId`) are **already** opaque 24-hex strings
(`POS-Admin/docs/BOUNTY-API-CONTRACT.md:312`) — i.e. Mongo-shaped ids already flow into this
estate from one vendor; our own generated ids are the mismatch, not vendor input.

---

## 1. Identity & ids

### 1.1 Two unrelated identity systems in wm-demo — not one shared layer

**A. `hw_identities`** (Weedmaps/checkin/order side) — `wmdemo/store.py:173-186`.
`id INTEGER PRIMARY KEY AUTOINCREMENT`. Columns: `phone_e164`, `first_name`/`last_name`/`dob`,
`name_dob_fp`, `addr_fp`, `gov_id_hash`, `wm_ids` (JSON array), `pos_customer_id`. No
blaze/connecteam/meadow id columns. Lookups (`store.py:2066,2088,2105,2985`) all `ORDER BY id`
+ first-row-wins on ties (documented `identity_match.py:511-519`).

Matching ladder, pure function `identity_match.py:452 match(subj, candidates, unreadable)`:
Tier 0 gov-id exact (`:502-508`, vetoes all else on conflict, `:288`) → Tier 1 phone exact
(`:524-530`) → Tier 2 name+dob fingerprint exact (`:532-538`) → Tier 3 dob + fuzzy name,
Levenshtein ≤1 (`:540-561`) → Tier 4 Weedmaps customer id (`:568-580`, weakest, "identifies an
account, not a person"). Every weak-tier hit is vetoed if it conflicts with a gov-id hash
(`_veto`, `:485-491`).

**B. `inc_identities`** (Bounty roster) — `wmdemo/incentives/roster.py`. Independent key scheme,
does not call `identity_api.py`/`identity_match.py` at all. `identity_key = "<source>:<store_id>:
<external_id|norm_name>"` (`roster.py:219-232`), falling back to normalized name when the vendor
export carries no external id. Binding ladder (`roster.py:1-56`, probe-pinned
`qa/incentives_identity_probe.py:2-24`):
1. `external_id` already bound → use it, `match_kind='id'`.
2. `external_email == associates.email` at same store, exactly one candidate → auto-bind,
   `match_kind='email'` (`roster.py:14,26-29,368`).
3. Name-only identity whose normalized name exactly matches an id-bound identity, same
   vendor+store → auto-bind, `match_kind='name-exact-vendor'` (`roster.py:16-24,34-47`).
4. Else unresolved; ≤3 fuzzy suggestions (difflib, threshold 0.85) for a manager to confirm.
   **A name never binds on its own** — the probe exists specifically because `difflib` scores
   "Marcus Web" vs "Marcus Webb" at 0.95 (`qa/incentives_identity_probe.py:8-10`).

External ids: Blaze employee id from `/employees` (`blaze_client.py:428-436,628-629,676,713`);
Meadow employee id from `order["placedBy"]["id"]` (`meadow_client.py:580,630,668,731`); CSV
exports carry name only, no external id (`roster.py:34-36`).

**Verify's own person/session identity** — deterministic, own `new_id()`
(`wmdemo/idv_store.py:389-390`: `prefix + uuid.uuid4().hex`, 32 lowercase hex, no dashes — NOT a
24-hex ObjectId shape). Person id `p_`+hex (`idv_store.py:1251`). `upsert_person` finds-or-creates
on `vendor_data` (unique col, `idv_store.py:94,1236-1279`), never overwrites non-null with null.
`vendor_data` defaults to `email_hash(email)` = `"email:<sha256>"` (`idv_store.py:666-673,1247`)
when the caller sends none. `idv_people.blaze_member_id` / `.hw_identity_id` are the two explicit
cross-system anchors (`idv_store.py:94`).

Didit-import binding (`idv_import_didit.py`): `_person_key()` (`:788-806`) synthesizes
`vendor_data` in priority order `raw vendor_data → "didit:user:<id>" → "didit:doc:<sha256(gov_id)
[:32]>" → "didit:namedob:<fp[:32]>"`. `resolve_person()` (`:809-905`) — gov-id exact
(`:850-852`) → `identity_match.match()` fuzzy (`:855-880`) → new person (`:892-901`). A hit
against `hw_identities` carries forward as `idv_people.hw_identity_id` (`:869-880`) — this is the
one place the two identity systems above actually touch.

### 1.2 Store/product/order/associate ids

- `store_id` — free-text slug (`corona`, `elsinore`…), seeded from `associates.py` `ROSTER`/
  `STORES` (`associates.py:79-105`), not database-minted. `<SLUG>` env-var convention forbids `_`
  in a store id (`docs/BOUNTY-API-CONTRACT.md:303-305`).
- `wm_order_id` — Weedmaps' numeric string, PK on `orders` (`store.py:99-103`). Synthetic
  fallback when absent: `"UNKEYED-" + secrets.token_hex(8)` (`store.py:710,754`) — deliberately
  non-numeric so it can't collide with a real WM id.
- `product.sku` — human string, PK on `products` (`catalog.py:95-96`); `external_id(sku) =
  "hyperwolf:sku:" + sku` (`catalog.py:18,225-226`).
- `pos_sales.order_id` — caller-supplied string PK (`pos_sales.py:42-43`), idempotent via
  `INSERT OR IGNORE` (`:121-128`).
- `associate_id` — caller-assigned string PK, seeded from `ROSTER` (`associates.py:38,79-105`);
  **also minted at runtime as a kebab-slug** by Bounty's `create_associate_from_identity`
  (`roster.py:744-796`, de-duplicated with a numeric suffix loop `roster.py:793-796`) — i.e. the
  same column is both a seed value and a live-minted mutable-looking slug.
- Bounty ledger rows use **composite string keys, not ids**: `inc_txns.txn_key =
  "<vendor>:<store_id>:<txn_id>"` (`schema.py:116`), `inc_lines.line_key = "<txn_key>#<n>"`
  (`schema.py:151`) — natural keys, not surrogate ids.
- Bounty contest id: `"c-" + uuid4().hex[:12]` (`contests.py:177`) — 12 hex chars, prefixed.
- Verify document `doc_`, media `m_`, decision `dec_`, event `ev_`, face-template `t_`, list/entry
  `l_`/`le_`, API key `k_`, webhook dest/delivery `wh_`/`d_`, consent `c_`, deletion `del_`,
  questionnaire `q_` — all `prefix + uuid4().hex` (`idv_store.py:1055,1172,1389,1594,1627,1831,
  1862,1925-1926,1967-1968,2021,2264,2290,2401`). Verify session id is **bare hex, no prefix**
  (`idv_store.py:906`), plus a human-facing `session_number INTEGER UNIQUE` via
  `SELECT COALESCE(MAX(session_number),0)+1` — race-prone, no lock at the call site
  (`idv_store.py:892-893,908-910`).

---

## 2. Enums

No hard role/status enum module is shared between Bounty and Verify — each defines its own.

| Enum | Defined | Frontend reads |
|---|---|---|
| Bounty classification (`CLASSES`) | `schema.py:424-425` — `budtender,driver,manager,loss_prevention,support,other`; default `budtender` (`:433`) | roster/class filter UI, `screen-standings.jsx` class switch |
| Bounty contest stored status | `contests.py:66` — `draft,pending_approval,active,settled,cancelled` | `screen-contests.jsx:145-146,251,254,298,318`; `screen-contest-detail.jsx:331,360,372,391,401,440` |
| Bounty contest *effective* status | derived, adds `"ended"` (not stored) `contests.py:300-314` | exposed as `"status"` by `serve.py:1121,1144,1167,1173,2601` |
| Bounty contest kind | `scoring.py:165` — `spiff,contest,team_goal,store_vs_store,aov_goal` | contest-builder kind picker |
| Bounty metric | `scoring.py:164` — `units,net_cents,gross_cents,txn_count,aov_cents` | `screen-standings.jsx` metric selector; validated `serve.py:1732` |
| Bounty points `kind` | `rewards.py:36` — `earned,adjusted,recorded_paid` | `screen-earnings.jsx:290 kindFilter` |
| Bounty snap/education status | `education.py:89` — `draft,published,expired` | `screen-learn.jsx`/`screen-learn-author.jsx` badges |
| Bounty identity `match_kind` | comment `schema.py:65-67` — `id\|email\|name-exact-vendor\|name-new\|confirmed\|manual\|unresolved` | unresolved-queue badges, `screen-data.jsx` |
| Bounty manager roles | `contests.py:61` — `frozenset(["Floor Manager","Admin"])` | `inc-client.jsx:32` hardcodes fallback role `'Floor Manager'` |
| Bounty API filters | `serve.py:176-190` — `PERIODS=(today,week,month,custom)`, `SCOPES=(store,all,stores)`, `CLASS_FILTERS=CLASSES+("all",)`, `CONTEST_ACTIONS=(submit,approve,cancel,settle,apply)` | `screen-standings.jsx` pickers |
| `pos_sales`/Bounty `txn_type` | inline check `server.py:3409-3413` — `sale,refund,void` (no shared constant) | not surfaced as a picker; filtered read-side |
| **Verify session `status`** | 10 literals, `idv_rules.py:106-120` (canonical) and `idv_store.py:59-61`: `Not Started, In Progress, Awaiting User, In Review, Approved, Declined, Resubmitted, Abandoned, Expired, Kyc Expired`. `In Review` is legacy-import-only, never produced (`idv_rules.py:112-117`). Terminal set `("Abandoned","Expired","Kyc Expired")` (`:1120`) | `idv-shared.jsx:27-35 STATUS_TONE`; `screen-sessions.jsx:31-32 STATUS_LIST`; `screen-session.jsx:83 TERMINAL_STATUS`, `:539-546` |
| Verify reason codes | 3 frozensets `idv_rules.py:151-154` (engine outage), `:161-191` (retryable), `:200-217` (hard decline — presence forces `Declined`) | subset mirrored `screen-sessions.jsx:33-38 REASON_LIST`; rendered verbatim `idv-shared.jsx:38-44` |
| Verify roles | not a stored enum — computed: explicit override wins, else role text containing "manager"/"admin"→`admin`, else any associate→`analyst`, else no role (`idv_api.py:16-30`) | `idv-client.jsx:54-58 DISPLAY_ROLE_TO_IDV` (independent client-side copy) |
| Verify feature flags | `idv_store.py:2579-2583` — `DEFAULT_FEATURES=[OCR,LIVENESS,FACE_MATCH,IP_ANALYSIS]`, `UNSUPPORTED_FEATURES=[NFC,AML,DATABASE_VALIDATION,PROOF_OF_ADDRESS]` | workflow editor screens |
| `promo_links.relation` | **SQL-level** `CHECK(relation IN ('mirrors','supersedes','conflict'))` (`store.py:240-241`) | — |

---

## 3. Money & time

### 3.1 Money

`POS-Admin/shared/commerce-adapter.js` is the swap/upsell engine's dollars→cents boundary (its
own header, `:12-13`): `cents(dollars) = Math.round((+dollars||0)*100)` (`:21`), applied to
`p.price`→`price` (`:74`) and `p.was`→`compareAtPrice` (`:80`) inside `toEngineProduct` (`:66-87`).
One-directional only (dollars→cents); no cents→dollars path in this file.

Server-side cents authority is a **different** file: `wmdemo/pricing.py`. `base_cents(product) =
int(round(product["price"]*100))` (`pricing.py:39-42`); `sale_price_cents` (`:54-61`);
`resolved_price_cents` (`:459-479`). Catalog/menu data is **dollars-at-rest** in a JSON blob
(`catalog.py:49-58,95-96`, e.g. `"price": 30.00`). `pos_sales.total_cents` is **cents-at-rest**,
`INTEGER NOT NULL` (`pos_sales.py:42-46`), inserted as `int(total_cents)` (`:126`); `/api/pos/sale`
requires integer `total_cents`/`subtotal_cents`/`discount_cents`, rejects non-integer/string/bool
(`server.py:3443-3460`).

Bounty stores money in **integer cents** throughout (`inc_txns.total_cents`,
`inc_lines.line_net_cents` etc., `schema.py:116-180`). `MONEY_BASIS = "ex_tax_net"`
(`scoring.py:514`); every scoring payload states `"scored_from"` (`lines`|`txns`, `:706`) and
`"money_basis"` (`:713`) — this is the field the API-contract calls out (docs
`BOUNTY-API-CONTRACT.md:5`: "Money is integer cents"). `aov_compat.py:338-356` separates
`subtotal_cents` (pre-tax, pre-discount) from `total_cents` (tender total, may include tax).

Verify: no real money. `idv_usage.unit_cost_cents INTEGER` exists (`idv_store.py:301`) but every
write hardcodes `0` and every read returns `"cost_note": "no per-check fee (own engine)"`
(`idv_store.py:2192,2216-2218`) — a cost-tracking stub, not live billing.

### 3.2 Time

Three different conventions coexist with **no shared time module**:

- **Epoch REAL** (`time.time()`), explicit convention note `store.py:1985,4178`: `hw_identities`,
  `orders`/`wm_order_events` (`store.py:83,103-107`), fraud/checkin tables.
- **ISO-8601 `Z`-suffixed TEXT**, hand-built with `time.strftime("%Y-%m-%dT%H:%M:%SZ",
  time.gmtime())`: `pos_sales.created_at` (`pos_sales.py:50,60-61`), `internal_promos`/
  `wm_promos` (`store.py:200-235`), Bounty's `sold_at`/`created_at`/`ts` throughout `schema.py`,
  Verify's `now_iso()` (`idv_store.py:355-357`), `server.py:5941,6241`.
- **Bare local date** `YYYY-MM-DD`: Bounty's `local_day`, derived per-row from
  `parse_iso_utc(sold_at).astimezone(store_tz)` (`ledger.py:187-191`), store tz map `STORE_TZ`
  (`schema.py:368-370`, currently all `America/Los_Angeles`). Verify widens a bare date to
  end-of-day for range queries: `day_upper_bound()` appends `"T23:59:59.999Z"`
  (`idv_store.py:332-339` — fixes a found bug where a bare date lexicographically excluded the
  final day). Verify parses back via `calendar.timegm` specifically to dodge a DST bug found
  2026-09-08 (`idv_store.py:360-379`).
- Document dates (DOB, expiry) accept ISO `YYYY-MM-DD` **or** two AAMVA 8-digit forms,
  disambiguated by content (`idv_rules.py:690-711`).
- Webhook signing uses **unix-seconds** in `X-Timestamp`, the one epoch-integer usage found
  (`idv_webhooks.py:11,97-113`).
- No timezone-aware datetime objects anywhere (no `pytz`/`zoneinfo` in `store.py`/`server.py`);
  everything is naive UTC, either an epoch float or a hand-built `Z` string. **A Mongo/Node port
  must pick one `Date` representation and normalize both the epoch-REAL and ISO-TEXT tables into
  it — they are not currently comparable as stored.**

---

## 4. API surface

Routing is one `if/elif` chain in `Handler._dispatch_GET`/`_dispatch_POST` (`server.py:2153-2148,
3270+`), wrapped by a concurrency semaphore `_gated()` (`:2043-2058`, not an auth gate).

### 4.1 Bounty — `/api/incentives/*` (the brief's `/api/inc/*` does not exist)

One mount, `inc_serve.handle_get`/`handle_post` (`server.py:3139-3141` GET, `:3517-3518` POST),
dispatch inside `incentives/serve.py`. Route list from `server.py:51-61` and confirmed against
`serve.py`:

| Route | Method | Gate | Shape (one line) |
|---|---|---|---|
| `/me` | GET | none | one budtender's stats — `serve.py:1707-1717 _me()` |
| `/standings` | GET | none | ranked board + trail/sources — `:1725-1826 _board()` |
| `/contests`, `/contests/{id}` | GET | none | list/detail — `:1826-1861` |
| `/contests` create/update; `/contests/{id}/{submit\|approve\|cancel\|settle\|apply}` | POST | manager for approve/settle (`_require_manager`, `:2062`) | `:2194-2229`, 403 on `contests.NotPermitted` |
| `/earnings` | GET/POST | none / actor-checked | balances, ledger, paid markers — `:1861-1873`, write `:2232-2251` (idempotent via `_paid_idem_key`, `:2154`) |
| `/snaps`, `/snaps/{id}` | GET/POST | manager for write | education cards — `:1873-1891`, `:2257+` |
| `/media`, `/media/{id}` | POST / GET bytes | none (media allowlist + sniffing) | `:1891+`, upload `:2330+` mints `"u-"+uuid4().hex[:16]` (`:2773`) |
| `/ingest/*` | GET/POST | none | source status/runs/rejects/conflicts, chunked upload — `:1924-2016,2342+` |
| `/identities/*` | GET/POST | manager for bind/unbind | matching queue — `:2396+` |
| `/roster`, `/roster/{id}/classify` | GET/POST | manager for classify | `:1924-2016`, `:2448+` |
| `/stores`, `/stores/{id}` | GET/POST | manager | `:2487+` |
| `/settings` | GET/POST | manager | `:2543+` |

Auth model: **no real authentication**. `_actor(body) = body.get("actor") or body.get("set_by")
or OPERATOR_EMAIL` (`serve.py:2033-2034`) — actor is a client-asserted **body** field, not a
header. `is_manager(actor)` (`:2037-2059`) checks `contests.is_manager` (roster role ∈
`MANAGER_ROLES`) or falls back to the operator identity; explicitly documented as not
authentication (`serve.py:2040+` docstring).

### 4.2 Verify — `/api/idv/*`, `/v3/*`, `/v2/*`, `/verify/{token}`

All four handled by one mount, `idv_api.handle()` (`server.py:2078-2083`, `_IDV_PREFIXES` at
`:2076`); GET at `:3142-3144`, POST at `:3305-3306` (raw bytes, before JSON parse — capture/engine
payloads aren't always JSON); **PATCH/PUT/DELETE exist only for this module**
(`server.py:2085-2114`) — every other route in the file is GET/POST only.

- **Console `/api/idv/*`** — gated by `X-HW-Actor` header resolved to a role via `associates`
  (`idv_api.py:277-311`; role model in §2). Key routes: `dashboard`, `sessions/*`,
  `review-queue/*`, `people/*`, `workflows/*`, `questionnaires/*`, `customization`, `lists/*`,
  `api-keys/*` (admin), `webhooks/*` (admin), `usage`, `audit`, `team/*`, `retention`,
  `deletion-requests/*` (admin), `import/*` (admin) — all `idv_api.py:1479-1574`. `version` and
  `engine/health` are ungated (`:1456-1462`).
- **Public `/v3/*`** — `x-api-key` header + scope, `_api_key_gate()` (`idv_api.py:3734-3773`,
  rate-limited per key/minute; scopes `sessions:read/write`, `lists:read`, `users:read`).
  `POST /v3/session` (`:3781-3793`), `GET /v3/session/{id}/decision` (`:3794-3812`),
  `PATCH /v3/session/{id}/update-status` (`:3817-3825`), `GET /v3/session/{id}/generate-pdf`
  (`:3826-3834`), `GET /v3/sessions` (paginated, `:3835-3854`), `GET /v3/lists`,
  `GET /v3/lists/{id}/entries` (`:3856-3874`), `GET /v3/users` (`:3875-3888`).
- **`/v2/*`** — Didit-shaped compatibility facade for `hyperwolf-backend`
  (`idv_api.py:7,3889-3906`), same `x-api-key`+scope auth as `/v3` since 2026-09-08
  (`:3897-3906`); mirrors exactly the two calls the live site makes today
  (`docs/IDV-PLAN-2026-09-08.md:536`).
- **Capture `/api/idv/capture/{token}/...`** — session-token gated, TTL-enforced, 410 Gone on
  expiry except terminal-status reads (`idv_api.py:3192-3218`).
- **Engine callback `POST /api/idv/webhooks/engine`** — HMAC gate, not actor (§5).

### 4.3 `/api/pos/sale`

POST only (`server.py:3395-3513`). Requires `order_id`, `store_id`, `associate_id`,
`total_cents` (400 if missing, `:3405-3408`); `txn_type ∈ {sale,refund,void}` (`:3409-3413`);
requires an ex-tax basis (`subtotal_cents`+`discount_cents` or `lines[]`) since 2026-09-08
(`:3427-3474`). Handler `pos_sales.record_sale` (`pos_sales.py:84`) then **dual-writes** into the
Bounty ledger via `inc_aov.record_hwpos_sale` (`server.py:3496-3504`) — failure of the second
write only logs a warning, never rolls back or fails the request (`:3507-3512`).

### 4.4 Auth mechanisms in play (reused across the estate)

1. `x-hw-write-token` vs `config.WRITE_TOKEN` — general PUBLIC-mode mutation gate, checked
   identically at `server.py:2098-2103` (PATCH/PUT/DELETE) and `:3291-3296` (POST); exempts
   webhook/engine/capture/`/v2`/`/v3` prefixes (`:3286-3290`).
2. `X-HW-Actor` header → role via `associates` — **Verify only**.
3. Body/query `actor` param → `contests.is_manager` — **Bounty only**.
4. `x-api-key` header + scopes — `/v3`, `/v2` only.
5. Front-door concurrency semaphore (`_gated()`) — not auth; self-origin (`demo` header) is
   exempt (`:2044-2045`).

No granular scopes exist outside Verify's `/v3`/`/v2`; every other gate is binary.

---

## 5. Events & webhooks

**Bounty: none outbound.** Only inbound pulls (GET) from Blaze/Meadow APIs
(`blaze_client.py`/`meadow_client.py`) — no `requests.post`, no signing anywhere in
`incentives/`. Retry is pull-side: jittered exponential backoff on 429/5xx, capped
(`blaze_client.py:232-233`, `meadow_client.py:200-253`); 401/403 never retried
(`blaze_client.py:233`, `meadow_client.py:112-114,209-211`).

**Verify: HMAC both directions**, one signing function (`idv_webhooks.py:1-30,89-91`):
`preimage = "<unix_ts>.<canonical_json>"`, `signature = HMAC-SHA256(secret, preimage)` (hex),
headers `X-Signature-V2` + `X-Timestamp`, ±300s skew window (`MAX_SKEW_S`, `:42`). Canonicalizer
(`canonical_json()`, `:53-70`) sorts keys, strips whitespace, rounds floats to 2 decimals — used
for both verify and sign.

- **Inbound** engine callback `POST /api/idv/webhooks/engine` → `idv_api.py:2630`. Bad signature
  → 403, audited, zero writes (`:2638-2642`). Idempotency via required `event_id`
  (`:2645-2646`), replay → 200 `{"received":true,"applied":false,"duplicate":true}`, zero writes
  (`:2652-2656`), enforced at storage by `UNIQUE(event_id)` on `idv_session_events`
  (`idv_store.py:158,1059-1062`).
- **Outbound** `enqueue()` (`idv_webhooks.py:129-146`) writes one `idv_webhook_deliveries` row
  per subscribed destination, atomic with the decision write. `deliver_due()` (`:164-208`),
  fixed retry schedule `{1:60s, 2:240s}` then `dead`, `MAX_ATTEMPTS=3` (`:29,44-46`).
  `send_test()` (`:209+`) for manual fire from the console.

---

## 6. Error shape

Shape is **consistent** (`{"error": "<message>"}`, sometimes extra keys like `"hint"`); the
**mechanism is not** — three independent implementations:

- `Handler._send(code, body)` (`server.py:2020`) — base JSON writer.
- `incentives/serve.py._err(handler, code, message, **extra)` → merges `**extra` into the body
  (`serve.py:1658-1661`). Examples: 400 `"missing store_id or associate_id"` (`:1710-1711`);
  404 `"no such associate %r"` (`:1713-1714`); 403 `contests.NotPermitted` string
  (`:2211-2212`); unhandled → 500 `"unhandled: %s: %s"` (`:1679,1694`).
- `idv_api._err(handler, code, message)` (`idv_api.py:150-151`), driven by a plain `Refused
  (status, message)` exception (`:128-132`) caught at the dispatch root (`:1391-1394`). Examples:
  400 "the request body must be a JSON object" (`:224,226`); 403 role-gate message naming the
  exact reason (`:305-311`); 404 `"no such session %r"` (`:3798`); 409 workflow-gone (`:2656`);
  429 rate limit (`:3760-3762`).
- `server.py`'s own ~60 other POST/GET branches call `self._send(400, {"error": "..."})` inline
  with no shared helper (e.g. `:3406-3408,3457-3460,3468-3474`); its own top-level 500 wrapper
  has yet another literal (`"unhandled: %s: %s" % (type(e).__name__, e)`, `:3261-3268`).

Bounty's contract doc also promises 501 "not built — must never ship" as a permitted stub
(`docs/BOUNTY-API-CONTRACT.md:9`); Verify's promises the same plus explicit "never 401, matching
Didit" for auth failures (`docs/IDV-API-CONTRACT.md:12`) — i.e. the two modules' *documented*
contracts already diverge on status-code convention, not just implementation.

---

## 7. Storage

### 7.1 Bounty (`schema.py:56-360`, one `SCHEMA_SQL`)

`inc_identities` (PK `identity_key` TEXT, `:56`), `inc_identity_events` (AUTOINCREMENT, `:82`),
`inc_classification_events` (AUTOINCREMENT, `:103`), `inc_txns` (PK `txn_key` TEXT, `:116`),
`inc_lines` (PK `line_key` TEXT, `:151`), `inc_ledger_version` (singleton `CHECK(id=1)`, `:182`),
`inc_ingest_runs`/`inc_ingest_rejects`/`inc_ingest_conflicts` (AUTOINCREMENT, `:190,218,227`),
`inc_sync_cursors` (composite PK `(source,store_id)`, `:244`), `inc_contests` (PK `id` TEXT,
`:255`), `inc_contest_events` (AUTOINCREMENT, `:281`), `inc_standings_cache` (composite PK
`(contest_id,round_key)`, `:294`), `inc_points` (AUTOINCREMENT + `UNIQUE(contest_id,round_key,
associate_id,kind)`, `:304-318`), `inc_snaps` (PK `id` TEXT, `:324`), `inc_snap_views`
(composite PK, `:341`), `inc_media` (PK `id` TEXT, BLOB, `:353`). Plus `associates`
(`associates.py:37`, PK `associate_id` TEXT) and `inc_stores`/`inc_store_events`
(`stores.py:109,123`).

Mongo-hostile SQL found: `ON CONFLICT ... DO UPDATE` (`contests.py:502,513`; `education.py:315,
332,405`; `sync.py:300,348,431`; `serve.py:783,793`); `INSERT OR IGNORE` idempotency
(`contests.py:578`; `rewards.py:191,279`; `stores.py:239`); multi-table `JOIN`
(`ledger.py:768,897,907`; `sync.py:457`); `PRAGMA table_info`-guarded runtime `ALTER TABLE`
migrations, 7 sites (`schema.py:511,540,576,594,654,742,772`) — no schema-version table.
Denormalization: `associate_id` is duplicated onto `inc_txns`/`inc_lines` and rewritten
row-by-row on identity rebind (`roster.py`) — a fan-out update that needs a different pattern
under a document model (can't cheaply "rewrite every row" the same way).

### 7.2 Verify (`idv_store.py:71-325`, `IDV_SCHEMA`, 26 tables)

Text-PK (uuid-hex) tables: `idv_workflows`(`:75`), `idv_people`(`:91`, UNIQUE `vendor_data`),
`idv_face_templates`(`:105`), `idv_sessions`(`:114`, plus `session_number INTEGER UNIQUE` via
`MAX()+1`, see §1.2), `idv_decisions`(`:167`, UNIQUE `(session_id,version)`),
`idv_documents`(`:187`), `idv_media`(`:200`), `idv_lists`(`:241`), `idv_list_entries`(`:246`),
`idv_api_keys`(`:256`, UNIQUE `key_hash`), `idv_webhook_destinations`(`:262`),
`idv_webhook_deliveries`(`:268`), `idv_deletion_requests`(`:304`), `idv_questionnaires`(`:310`),
`idv_consents`(`:320`). **Autoincrement-int-PK (need Mongo rework)**:
`idv_session_events`(`:157`, UNIQUE `event_id`), `idv_reviews`(`:223`), `idv_review_queue`
(`:233`, PK is `session_id` itself — no autoincrement, despite the name), `idv_audit`(`:278`),
`idv_import_runs`(`:285`), `idv_usage`(`:298`). Composite key: `idv_workflow_versions`(`:86`, PK
`(workflow_id, version)`). Singleton: `idv_customization`(`:315`, `CHECK(id=1)`, SQLite-specific
trick).

JOINs needing app-level rework: `idv_store.py:1371` (list_entries JOIN idv_lists);
`:1515-1517` (LEFT JOIN idv_people + correlated subquery LEFT JOIN idv_decisions); `:1552-1553,
1581` (JOIN idv_lists + LEFT JOIN idv_face_templates for face-list matching). `INSERT OR
REPLACE`: `:812,867` (`idv_workflow_versions`), `:2389` (`idv_customization` singleton).
Race-prone read-then-write with **no lock**: `next_session_number()` (`:892-893,906-910`).

### 7.3 Shared tables Bounty/Verify read or join against

`hw_identities` (`store.py:173-186`, int autoincrement PK — Verify's own identity concept, §1.1);
`orders`/`wm_order_events` (`store.py:99-107,82-97`, string PK, not autoincrement); `pos_sales`
(`pos_sales.py:42-52`, caller-supplied string PK); `associates` (`associates.py:37-44`, string
PK); `products` (`catalog.py:95-96`, string PK, JSON blob column). Also `INTEGER PRIMARY KEY
AUTOINCREMENT`: `fraud_review`, `wm_promo_redemptions`, `promo_events`, `internal_promos`,
`promo_links`, `reservations`, `order_line_batches` (`store.py:191-244`; `catalog.py:106-123`).

No `PRAGMA busy_timeout`/`journal_mode=WAL` anywhere — concurrency is an in-process
`threading.Lock()` (`store.py:18`), which protects nothing across multiple Node worker
processes. `catalog.py:43` opens with `isolation_level=None` (SQLite autocommit knob).

---

## 8. Frontend seams

### 8.1 The real base-URL/token seam: `shared/hw-live.js` (not the files named in the brief)

`commerce-adapter.js`, `brands.js`, `app-nav.js` carry **no** base-URL/token/actor logic —
verified by full read. The actual seam is `POS-Admin/shared/hw-live.js`, loaded in "Lite mode"
on both `Hyperwolf Bounty.html` and `Hyperwolf Verify.html`: `base = W.location.origin`
(`hw-live.js:87`, repointable via `?hwlive=`), write-token stored under localStorage key
`hw-live-token` (`:147-161`), taken from `?hwtoken=` on load (`:171-191`), sent as header
`x-hw-write-token` (`:148`, cites `server.py:366`) only same-origin (`:165,205`).

### 8.2 `HWInc` (Bounty) vs `HWIdv` (Verify) — same pattern, real divergence

Both wrap `window.HW_LIVE`, never fetch directly, degrade to `{ok:false, error:'no-live-seam'}`
when absent (`inc-client.jsx:6-18,38-49`; `idv-client.jsx:1-33`). `session()` in both reads
`window.HW.STATS.associate` first, else the **same hardcoded demo identity**:
`{id:'manisha-saini', name:'Manisha Saini', role:'Floor Manager', storeId:'elsinore'}`
(`inc-client.jsx:19-32`; `idv-client.jsx:33-45`) — flagged in both files as "the production seam"
(one function to swap for real auth later).

**Divergence**: `HWInc.get/post` call `window.HW_LIVE.get/post` directly (`inc-client.jsx:38-51`)
— no actor header is ever sent for Bounty; actor travels only in POST **bodies** (§4.1).
`HWIdv` instead re-implements its own `fetch()` (`idv-client.jsx:112-150`) so it can add
`actorHeaders()` → `X-HW-Actor: <session().id>` (`:91-96`) on every call, and **independently
re-reads** the same `hw-live-token` localStorage key rather than delegating
(`idv-client.jsx:86-89`, comment `:22-27` explains why: `HW_LIVE.get/post` take no headers
argument). Verify's client also duplicates the server's role gate client-side —
`ACTION_MIN_ROLE`/`can()` (`idv-client.jsx:62-80`) — a second copy of `idv_api.py`'s role table
that must be kept in sync by hand, and `DISPLAY_ROLE_TO_IDV` (`:54-58`) maps job-title strings
("Floor Manager"→analyst, "Admin"/"Owner"→admin) that have no relationship to the free-text
`associates.role` column's actual values (§2).

`fmt.cents` in `inc-client.jsx:104-110` re-exports `window.HD.formatCents` — confirms the wire
format for Bounty money is cents end-to-end, frontend included.

### 8.3 Shared UI utilities actually used

- `brands.js` → `window.HW_BRANDS.names` consumed directly by Bounty's brand pickers
  (`incentives/screen-contest-builder.jsx:504`; `incentives/screen-learn-author.jsx:230`).
  Verify never references `HW_BRANDS`.
- `app-nav.js` → `window.HW_NAV` rendered by `shared/app-rail.jsx:31,50,52` on both apps; carries
  no actor/role/store context, just `{id,label,icon,href|pos}` (`app-nav.js:6-33`).
- `commerce-adapter.js` is not loaded by either `Hyperwolf Bounty.html` or `Hyperwolf Verify.html`
  — it belongs to the swap/upsell surface only, not to Bounty/Verify.

### 8.4 Representative record-shape assumptions (direct property access, no schema validation)

Bounty: `s.associate_id` (`screen-contest-detail.jsx:161,163`; `screen-standings.jsx:215,217,
332-333,350,361`), `c.id`/`c.status` (`screen-contests.jsx:145-146,251,318`),
`{actor: session.id}` (`screen-earnings.jsx:89`; `screen-contest-detail.jsx:342`), `store.id`/
`session.storeId` (`screen-earnings.jsx:266-269`; `screen-standings.jsx:420,439`), `r.kind`
(`screen-earnings.jsx:290`).

Verify: `sess.status` (`screen-session.jsx:482,539-546,686,693,837`), `person.id`
(`screen-people.jsx:313,594`), `d.person_id` (`screen-people.jsx:487,492-493`), `f.session_id`
(`screen-session.jsx:766`), `filters.status[0]` against literal strings
(`screen-sessions.jsx:353,355`). No screen in either module goes through a typed accessor —
every screen assumes the raw JSON from `serve.py`/`idv_api.py`'s `*_out()` helpers matches
field-for-field.

A cross-cutting invariant repeated (not shared) in two places: `associates[id].store_id` must
equal the caller's `store_id` — enforced identically at `server.py:3124-3127` (`/api/aov/stats`)
and `pos_sales.py:115-118` (`/api/pos/sale`). A Mongo port should centralize this once.

---

## 9. Test floor

No test in either repo names Mongo/ObjectId/24-hex/ "collision" in the compatibility sense the
brief asks about (`grep -a "ObjectId\|24-hex\|collision" wm-demo/qa/*.py POS-Admin/test/*` — only
hits are an unrelated `mapping_collision_probe` about SKU-mapping collisions, and
`_dbsafe.py:198`/`battery.py` cross-refs of it). **No cross-module Bounty↔Verify probe exists**
(`grep -a -l "incentives" qa/idv_*.py` and `grep -a -l "idv_" qa/incentives_*.py` both empty).
**No POS-Admin `test/*.mjs` file targets `/api/incentives/`, `/api/idv/`, `inc-client`, or
`idv-client`** (`grep -a -rl` over `test/*.mjs` empty) — despite POS-Admin's own package.json
running `node --test "test/*.test.mjs"` (`package.json:8`). Section 10's ranked list is,
functionally, the compatibility check that does not yet exist anywhere as a runnable probe.

### 9.1 Full-suite driver

```
cd /Users/jt/wm-demo && python3 qa/battery.py            # check, run, report
cd /Users/jt/wm-demo && python3 qa/battery.py --fix      # repair drift first, then run
cd /Users/jt/wm-demo && python3 qa/battery.py --check    # preflight only, run nothing
```
(`README.md:123`; registration + check counts confirmed live in `qa/battery.py:742-1020`.)

### 9.2 Bounty probes (standalone: `python3 qa/<file>.py` from `wm-demo/`; each has its own
`if __name__=="__main__": sys.exit(main())`, confirmed per-file)

| Probe | Checks | Covers |
|---|---|---|
| `incentives_scoring_probe.py` | 38 | pure scorer, hand-computed expected numbers |
| `incentives_ingest_probe.py` | 34 | `rows_read == inserted+unchanged+conflicts+rejected` |
| `incentives_identity_probe.py` | 26 | the binding ladder (§1.1) — name never binds alone |
| `incentives_aov_compat_probe.py` | 20 | `/api/aov/*` shape preserved key-for-key as ledger absorbs it |
| `incentives_contests_probe.py` | 35 | contest state machine; double-settle can't double-pay (DB constraint, not check-then-insert) |
| `incentives_routes_probe.py` | 189 | every route in `BOUNTY-API-CONTRACT.md`, keys+types not just 200 |
| `incentives_safety_probe.py` | 47 | adversarial: media MIME sniffing/XSS, actor spoofing, double-submit |
| `incentives_classes_probe.py` | 55 | classification isolation (driver never leaks onto a budtender board) |
| `incentives_blaze_export_probe.py` | 29 | real Blaze CSV export parsing (2 formats, sanitized real files) |
| `incentives_blaze_sync_probe.py` | — | live Blaze API sync pass, 3 layers (offline fixture / offline fake / one live run) |
| `incentives_meadow_real_probe.py` | 10 | real Meadow `.xlsm` export parsing |
| `incentives_meadow_sync_probe.py` | — | Meadow API client shapes + paging guards |
| `incentives_treez_probe.py` | 55 | Treez Inventory Log + Products Report real-file parsing |
| `incentives_blaze_field_census.py` | — (`argparse`) | measures per-sale employee-attribution field population live |

### 9.3 Verify probes (same invocation pattern)

| Probe | Checks | Covers |
|---|---|---|
| `idv_rules_probe.py` | 321 | pure decision engine — every reason code, full transition matrix, list matching |
| `idv_store_probe.py` | 64 | storage promises: replay writes nothing, partial run never reports `ok`, keyset paging, webhook retry ladder, PDF writer |
| `idv_api_probe.py` | 137 | every route in `IDV-API-CONTRACT.md` via `idv_api.handle()`, incl. forged/replayed engine callback |
| `idv_import_probe.py` | 78 | Didit history importer — rerun-safe, no duplicate rows, no silent partial |
| `idv_dev_seed.py` | n/a (seed, not in `battery.py`) | seeds a realistic dev dataset through real routes; `IDV_BASE`/`IDV_ENGINE_SECRET`/`DB_PATH` env vars (`idv_dev_seed.py:60-63`) |

---

## 10. Collision list — ranked, highest risk first

1. **Bounty `associate_id` is a live-minted, human-readable, de-duplicated slug used as a foreign
   key across `inc_identities`/`inc_txns`/`inc_lines`** (`roster.py:744-796`; FK use
   `schema.py:63,133,164`). A Mongo/Mongoose model wants an immutable `ObjectId` ref; a
   collision-avoided-by-suffix slug (`"sam-2"`) is exactly the kind of value that looks stable
   until a rename or a re-import produces a new slug for the same person, silently orphaning
   every FK that still points at the old one. *Mitigation*: mint a real surrogate id at
   associate-creation and keep the slug as a display/lookup field only.

2. **Verify's own ids are 32-hex (`uuid4().hex`), not 24-hex** (`idv_store.py:389-390`), several
   with string prefixes (`p_`, `dec_`, `k_`, …). Any Mongoose schema field typed as `ObjectId` or
   any code that regex-validates `/^[0-9a-f]{24}$/` will reject every id this module has ever
   minted. *Mitigation*: either re-key on migration (breaks every stored FK/URL that echoes an
   id back to a partner, e.g. `/v3/session/{id}`) or keep string ids and change the Mongoose
   field type — decide before Verify's `/v2` facade is asked to also emit ids `hyperwolf-backend`
   stores.

3. **Two independent actor/auth models across modules that must become one.** Bounty trusts a
   client-supplied body field with no signature or session (`serve.py:2033-2034`); Verify trusts
   a header resolved against a free-text role column (`idv_api.py:277-311`) plus a separate
   `x-api-key`+scopes system for `/v3`/`/v2`. A single production auth layer (real sessions/JWT)
   has to subsume all three without silently widening Bounty's trust boundary (today anyone who
   can POST can claim to be a manager) or narrowing Verify's (today's role strings are looser
   than `viewer|analyst|admin` suggests — see #4). *Mitigation*: land real auth once at the
   platform layer (already flagged as escalation in `INCENTIVES-PLAN-2026-09-07.md:427-434`), not
   per-module.

4. **`associates.role` is free text, no enum, no CHECK constraint** (`associates.py:41`), yet
   three different consumers infer meaning from it: Bounty's `MANAGER_ROLES` exact-string set
   (`contests.py:61`), Verify's substring test (`"manager"`/`"admin"` in the string,
   `idv_api.py:16-30`), and the frontend's job-title map (`idv-client.jsx:54-58`, only exact
   matches on "Admin"/"Owner"/"Floor Manager"). A Mongo `role: {type:String, enum:[...]}` forces
   a single canonical vocabulary — whichever one is picked, at least one of these three consumers
   needs rewriting, not just a schema swap. *Mitigation*: pick one canonical role enum now and
   make all three read it the same way before the port.

5. **`inc_txns`/`inc_lines` primary keys are composite natural strings**
   (`"<vendor>:<store_id>:<txn_id>"`, `schema.py:116,151`), not surrogate ids — fine in SQLite,
   but Mongoose's default `_id: ObjectId` convention and most Mongo tooling assume a surrogate
   key; treating the natural key as `_id` works but breaks any library/tool that assumes `_id` is
   an `ObjectId` (dashboards, `$oid` in some drivers, change-stream resume tokens keyed on
   `_id` ordering). *Mitigation*: keep the natural key as a unique compound index and mint a real
   `ObjectId _id` alongside it, matching what `idv_store.py` already does with `vendor_data`
   (unique) vs `id` (surrogate).

6. **`INSERT OR IGNORE` / `ON CONFLICT DO UPDATE` idempotency is load-bearing in both modules**
   (`contests.py:502,513,578`; `education.py:315,332,405`; `sync.py:300,348,431`;
   `stores.py:239`; `rewards.py:191,279`; `idv_store.py:812,867,2389`) — this is how the two
   safety probes (`incentives_contests_probe.py` "can a contest pay the same person twice?",
   `idv_store_probe.py` ST-8 "a replayed event writes nothing") actually get their guarantee.
   Mongo's `findOneAndUpdate({upsert:true})` is transactionally different (no unique-constraint
   race the same way without an explicit unique index + retry-on-duplicate-key). *Mitigation*:
   port every one of these sites to a unique index + catch-duplicate-key pattern, and re-run
   the two probes' scenarios (double-click, retried POST) against the port before shipping it.

7. **Two timestamp conventions on tables that get compared to each other.** `hw_identities`/
   `orders` use epoch REAL; `pos_sales`/Bounty/`Verify` use ISO-`Z` text
   (`store.py:1985,4178` vs `pos_sales.py:50,60-61`, `schema.py` throughout,
   `idv_store.py:355-357`). Any Mongo `Date` field is a real datetime — migrating both
   conventions into it is mechanical for the ISO-text tables and requires an explicit
   `new Date(epoch*1000)` conversion for the epoch-REAL ones; missing one silently produces a
   1970 or NaN date rather than an error. *Mitigation*: audit every read site of the epoch-REAL
   tables before cutover, not just the writes.

8. **Verify's `session_number` is a race-prone `MAX()+1` with no lock**
   (`idv_store.py:892-893,906-910`). SQLite's single-writer behavior has been masking a real race;
   under Mongo/Node with concurrent writers this either needs a `findOneAndUpdate` atomic counter
   document or becomes a duplicate-session-number bug in production. *Mitigation*: convert to an
   atomic counter document (`$inc`) before the port, don't carry the SQLite-safe-by-accident
   pattern forward.

9. **Bounty ledger money is cents-at-rest; catalog/menu money is dollars-at-rest in a JSON blob**
   (`catalog.py:49-58,95-96` vs `pos_sales.py:42-46`, `schema.py:116-180`) — two representations
   for "price" already coexist in this estate, converted only at `pricing.py`
   (backend) and `commerce-adapter.js` (frontend, swap engine only, not Bounty/Verify). A Mongo
   schema for "product" must pick one unit and the migration must not silently import a dollar
   float into a field a Node service reads as cents (or vice versa) — an easy off-by-100 that
   produces a plausible-looking wrong number rather than an error. *Mitigation*: normalize to
   cents at the Mongo schema boundary and validate on import (reject non-integer cents), the same
   guard `/api/pos/sale` already applies (`server.py:3443-3460`).

10. **Verify's `/v2` facade is the one piece already scoped against a real production Mongo
    backend** (`hyperwolf-backend`, `docs/IDV-PLAN-2026-09-08.md:48,536`) — meaning any id/role/
    time format decision made for Verify's storage layer that diverges from what `/v2` already
    promises `hyperwolf-backend` (Didit-shaped JSON, `{workflow_id}`-only session creation, no
    `vendor_data` from the site side) creates a second, incompatible contract the facade then has
    to paper over twice. *Mitigation*: treat `/v2`'s existing contract as the compatibility
    baseline for any Mongo migration of `idv_sessions`/`idv_people`, not a document to reconcile
    after the fact.
