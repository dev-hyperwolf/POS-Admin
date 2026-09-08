# Budtender incentives module — architecture & feature plan

Status: **DRAFT FOR APPROVAL** · 2026-09-07 · owner: JT · author: Claude (planning phase)

SparkPlug feature parity, built into the POS-Admin estate with a real backend in wm-demo.
Production-grade from day one: every number on screen comes from the API; no fixture rows,
no placeholder rosters, no fake uploads. Where the backend is unreachable the screen says so.

Research behind this plan (scratch, not committed): SparkPlug feature inventory (455 lines),
Blaze API + export census (306), Meadow API + export docs (364), POS-Admin design-system
reference (672), wm-demo backend reference (500). Facts below marked **[measured]** come from
real data in this estate; **[documented]** from vendor docs fetched today; **[unconfirmed]**
means exactly that and is handled as a branch, not a guess.

---

## 0. Decisions already made (from the kickoff Q&A)

| Decision | Ruling |
|---|---|
| Backend | Real routes + SQLite in `wm-demo` (it already serves POS-Admin same-origin via `shared/hw-live.js`). |
| Data | Blaze REST API **and** Meadow REST API for live scoring. CSV upload for both as backfill/manual path, fully functional. |
| Placement | Own app like Engage (`Hyperwolf Bounty.html` + `incentives/`), one rail item. Card on POS Home. **The Register screen is not touched** (owner, 2026-09-08, on seeing the strip mockup): the budtender view lives in the Bounty app and the Home card only. |
| AOV goals | Absorbed as one goal type. Existing `/api/aov/*` contract preserved so nothing breaks mid-build. |
| Out of scope | Mobile app. Payout execution (any money movement). Brand-user logins. |
| Naming | **Hyperwolf Bounty** (owner pick, 2026-09-07). One incentive is a **bounty**; the leaderboard is the bounty board. Code stays name-independent (`incentives/`, `window.Inc*`, `wmdemo/incentives/`, `inc_contests`); the name lives in copy, the entry HTML `Hyperwolf Bounty.html`, the rail label and the hub card. |

---

## 1. What the research changed

1. **Blaze API attribution is unproven.** A real 10,000-transaction census in this estate
   found `assignedEmployee`, `seller.name`, `sellerName`, `assignedEmployeeName` at **0 %
   populated [measured]**. Six further candidates (`sellerId`, `createdById`,
   `assignedEmployeeId`, `createdByEmployee`, `preparedByEmployee`, `packedByEmployee`) were
   surfaced but never re-measured. The only field at 100 % is `sellerTerminalId`, which names
   a register, not a person **[measured]**. Blaze's **All Sales Report** (line-item grain) and
   **Total Sales Report** (transaction grain) both carry a documented `Employee` column
   **[documented]**. → Step one of the build is a Python census probe against the live API
   (§7.1). The ledger is designed so unattributed sales are stored, counted in store totals,
   and shown as "no budtender on the record" rather than dropped or guessed.
2. **Meadow is the clean case.** `GET /api/v1/orders` carries `placedBy` (who rang it) and
   `fulfilledBy`; line items carry `productBrand`, `primaryCategory`, `quantity`, prices in
   cents; voids/refunds live in `GET /api/v1/order-returns` **[documented]**. No roster
   endpoint exists; identities are harvested from orders. No webhooks are documented, so
   ingestion is polling. Working Meadow auth already exists in this estate for West Hollywood.
3. **Long Beach runs Treez** (`sales/Config.js`) **[measured]**. Not Blaze, not Meadow. It
   has no ingestion path in this brief. Flagged in §11; the ledger's `source` column leaves
   room for a `treez-*` source later.
4. **Blaze API list responses may lack `cart.items[]`** [unconfirmed]; line-level detail may
   need one `GET /transactions/{id}` per transaction. Brand/category contests for Blaze stores
   therefore have two paths: All Sales CSV (certain) or per-transaction detail fetch via the
   existing bounded worker bus (if the census shows items are absent from the list).
5. **No Blaze or Meadow credentials exist in `wm-demo/.env`** [measured]. They live in GAS
   Script Properties, which are classifier-blocked to me. JT adds them (§7.0).
6. **SparkPlug's vocabulary**: a *Spark* is any campaign; *Spiff* = short window, threshold,
   instant reward; *Contest* = ranked (hourly reset variant exists); *Goal* = team cumulative
   target; *store-vs-store* exists; brand-funded campaigns need retailer-manager approval;
   *Snaps* are unscored story content, *Courses* (quizzes) pay out. All of that is in §4–§5.

---

## 2. Backend architecture (wm-demo, Python 3.9 stdlib only)

New sub-package `wmdemo/incentives/` (server.py imports it as `from .incentives import serve
as incentives`). Each module follows the estate's newer convention: module-level
`SCHEMA_SQL`, `ensure_schema()` at the top of every public function, private `_db()`, integer
cents, ISO-8601 UTC text timestamps, `_lock` for read-then-write paths.

| Module | Responsibility |
|---|---|
| `schema.py` | All `inc_*` DDL in one place, `ensure_schema()`. |
| `roster.py` | People + POS identities. Extends `associates` (adds `email`), owns `inc_identities` and the unmatched queue. Name-similarity *proposes*, never binds. |
| `ledger.py` | The fact tables `inc_txns` / `inc_lines`, idempotent upsert with content hash, `ledger_version` counter, store-local day computation (`zoneinfo`, `America/Los_Angeles`). |
| `ingest_csv.py` | Format fingerprinting + parsers for Blaze All Sales, Blaze Total Sales, Meadow Orders Report (`.xlsm`/`.xlsx` via `zipfile` + `xml.etree`, and CSV of either tab). Emits normalized txns/lines + rejects with reasons. |
| `blaze_client.py` | `urllib` client, headers `Authorization` + `partner_key`, `limit=100`, `skip` paging with the estate's no-progress + page-cap guards, never trusts `total`, per-store keys. Optional per-transaction detail fetch. |
| `meadow_client.py` | `urllib` client, `X-Consumer-Key` + `X-Client-Key`, `startingAfter` cursor paging, orders + order-returns, 15 req/s ceiling respected. |
| `sync.py` | One daemon loop (`_incentives_sync_loop`) in the estate's shape: never dies, sleeps after the pass, cadence re-read each iteration, overlapping run skipped and logged as normal. Per-(store, source) cursor rows. Every pass writes an `inc_ingest_runs` row. |
| `scoring.py` | **Pure functions.** `evaluate(contest, txns, lines) -> standings`. No I/O, no clock it wasn't given. Ties, windows, refunds, team/store aggregation, hourly rounds. |
| `contests.py` | Contest CRUD + state machine + append-only `inc_contest_events`. Standings cache keyed by `(contest_id, ledger_version)`. Settlement writes the points ledger idempotently. |
| `rewards.py` | `inc_points` append-only ledger, balances, "earned" vs "projected", record-only paid marker. |
| `education.py` | Snaps (cards JSON), views/completions, optional quiz → points. Small media table served at `/api/incentives/media/<id>` (base64 JSON in, bytes out; cap 1.5 MB; no multipart needed). |
| `serve.py` | Route handlers (thin; validation lives in the modules). Registered in `_dispatch_GET` / `_dispatch_POST` respecting `startswith` ordering. |
| `aov_compat.py` | Re-implements the six `/api/aov/*` responses over the new ledger with byte-compatible shapes. `pos_sales` rows are backfilled once into `inc_txns` (`source='hwpos'`) and `/api/pos/sale` dual-writes from then on. |

Realtime: **polling**, like everything else in wm-demo (no SSE exists). The standings cache
makes polling cheap: a poll that sees the same `ledger_version` is a single indexed read.

Concurrency: the sync loop holds no long lock. Ingest takes `_lock` per batch of ≤500 rows;
readers never block on it longer than one batch.

---

## 3. Data model

### 3.1 People and identities

```sql
-- existing table, one additive column
ALTER TABLE associates ADD COLUMN email TEXT;            -- nullable; unique when present

CREATE TABLE inc_identities (                            -- a POS-side identity bound to a person
  identity_key   TEXT PRIMARY KEY,                       -- '<source>:<store_id>:<external_id|norm_name>'
  source         TEXT NOT NULL,                          -- blaze | meadow | hwpos
  store_id       TEXT NOT NULL,
  external_id    TEXT,                                   -- Blaze employee id / Meadow placedBy.id
  external_email TEXT,
  raw_name       TEXT NOT NULL,                          -- exactly as the POS spelled it
  associate_id   TEXT,                                   -- NULL == unresolved
  match_kind     TEXT NOT NULL,                          -- id | email | confirmed | manual | unresolved
  confirmed_by   TEXT, confirmed_at TEXT,
  first_seen     TEXT NOT NULL, last_seen TEXT NOT NULL,
  seen_count     INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE inc_identity_events (...);                  -- append-only: bound / rebound / unbound, by whom, why
```

Resolution order, deterministic and logged:
1. `external_id` already bound → use it.
2. `external_email` equals an `associates.email` at the same store → **auto-bind** (`match_kind='email'`).
3. Blaze `/employees` sync creates/updates the associate row for that store (Blaze is a
   real roster) → `match_kind='id'`.
4. Otherwise the identity is stored **unresolved** with up to three *suggestions*
   (normalized-name similarity ≥ 0.85, same store first) shown to the manager. Nothing
   auto-binds on a name. Sales for an unresolved identity are ingested with
   `associate_id = NULL` and appear in store totals and in the "unattributed" line of
   every standings view.
5. Manager resolves in the Data screen: bind to an existing associate, or create a new
   associate from the identity. Binding is retroactive: standings recompute because
   `ledger_version` bumps.

### 3.2 The ledger

```sql
CREATE TABLE inc_txns (
  txn_key        TEXT PRIMARY KEY,                       -- '<source>:<store_id>:<txn_id>'
  source         TEXT NOT NULL,                          -- blaze-api | blaze-csv | meadow-api | meadow-csv | hwpos
  store_id       TEXT NOT NULL,
  txn_id         TEXT NOT NULL,                          -- Blaze Trans No / _id · Meadow order id
  txn_type       TEXT NOT NULL,                          -- sale | refund | void
  status         TEXT,                                   -- vendor status, verbatim
  sold_at        TEXT NOT NULL,                          -- ISO UTC
  local_day      TEXT NOT NULL,                          -- 'YYYY-MM-DD' in store tz, computed at ingest
  local_hour     INTEGER NOT NULL,                       -- 0-23 store tz (hourly contests)
  identity_key   TEXT,                                   -- FK inc_identities; NULL when the record carried none
  associate_id   TEXT,                                   -- denormalized at ingest, rewritten on identity bind
  subtotal_cents INTEGER, discount_cents INTEGER, total_cents INTEGER NOT NULL,
  item_count     INTEGER,
  terminal       TEXT, payment_type TEXT,
  content_hash   TEXT NOT NULL,                          -- sha1 of the normalized row
  ingest_run_id  INTEGER NOT NULL,
  created_at     TEXT NOT NULL
);
CREATE TABLE inc_lines (
  line_key       TEXT PRIMARY KEY,                       -- '<txn_key>#<n>'
  txn_key        TEXT NOT NULL,
  store_id TEXT NOT NULL, associate_id TEXT, identity_key TEXT,
  sold_at TEXT NOT NULL, local_day TEXT NOT NULL, local_hour INTEGER NOT NULL,
  product_name TEXT NOT NULL, brand TEXT, category TEXT, product_id TEXT, sku TEXT,
  quantity REAL NOT NULL, unit_price_cents INTEGER,
  line_net_cents INTEGER, line_gross_cents INTEGER, discount_cents INTEGER,
  content_hash TEXT NOT NULL, ingest_run_id INTEGER NOT NULL
);
CREATE TABLE inc_ledger_version (id INTEGER PRIMARY KEY CHECK (id=1), version INTEGER NOT NULL);
```

Rules:
- **Money is cents.** Vendor dollars convert once, at the parser boundary. An unparseable
  amount rejects the row; it never becomes `0`.
- **Brand names normalize through `shared/brands.js`'s alias table** (the one brand DB) so
  "STIIIZY" and "Stiiizy" are one brand in a contest filter. Unknown brands are kept verbatim
  and listed in the run report as "brands not in the brand DB".
- **Refunds/voids** are stored as their own rows (`txn_type`) and scoring nets them by
  `txn_id` linkage (Blaze refund rows reference the original; Meadow returns carry
  `orderId`). Standings show gross, refunds, net.
- **Local day** is computed once at ingest from the store's tz. This retires the
  midnight-UTC "today" defect in the current AOV stats.

### 3.3 Ingestion accounting — nothing silent

```sql
CREATE TABLE inc_ingest_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                 -- csv | api
  source TEXT NOT NULL, store_id TEXT NOT NULL,
  filename TEXT, format TEXT,         -- blaze-all-sales | blaze-total-sales | meadow-orders-xlsm | meadow-data-csv | meadow-lines-csv
  started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL,   -- running | ok | partial | failed
  rows_read INTEGER, inserted INTEGER, unchanged INTEGER, conflicts INTEGER,
  rejected INTEGER, unresolved_identities INTEGER,
  window_from TEXT, window_to TEXT, cursor_before TEXT, cursor_after TEXT,
  actor TEXT NOT NULL, error TEXT
);
CREATE TABLE inc_ingest_rejects (run_id, row_no, reason, raw_excerpt);   -- every dropped row, why
CREATE TABLE inc_ingest_conflicts (run_id, txn_key, field, stored_value, incoming_value, resolution);
CREATE TABLE inc_sync_cursors (source, store_id, cursor, last_ok_at, last_error, PRIMARY KEY(source, store_id));
```

Invariant enforced by a probe: `rows_read == inserted + unchanged + conflicts + rejected`.

**Overlapping re-upload**: same `txn_key`, same `content_hash` → `unchanged`. Same key,
different hash → `conflict`: the stored row is kept, the difference is listed, and the manager
can "apply incoming" per conflict or for the whole run. New key → `inserted`. A CSV row whose
transaction also arrived via the API is the same `txn_key` (source prefix differs only by
`-api`/`-csv`, so the key uses the vendor prefix `blaze:`/`meadow:` and the run records which
path wrote it); the CSV path enriches lines the API lacked and never double counts.

**Format detection**: header set fingerprint after normalization (lower-case, collapse
spaces). Order-independent. A file that matches no fingerprint is refused with the headers it
had and the required ones it lacked. Required minimums:

| Format | Grain | Required headers (normalized) |
|---|---|---|
| Blaze All Sales | line | `trans num, date, trans type, trans status, product name, product category, brand name, quantity sold, final subtotal, employee` |
| Blaze Total Sales | txn | `trans no, date, trans type, trans status, retail value, discounts, gross receipt, employee` |
| Meadow Orders Report `.xlsm` | txn + line | sheet `Data`: `id, date / time, status, type, subtotal, discounts total, grand total, placed by`; sheet `Line Items`: `order id, product, primary category, quantity, unit price, line item total, brand` |
| Meadow Data CSV / Line Items CSV | txn / line | same headers as the tabs; a Line Items CSV without its Data CSV ingests lines with `identity_key` NULL and reports "N lines await their orders file" until the Data file arrives (joined on `order id`). |

Headers are those published by Blaze support and Meadow help **[documented]**; §7.0 asks for
one real export per format so the parsers ship verified against real files, with those files
(sanitized) becoming the probe fixtures.

Store is chosen explicitly by the uploader. If the file carries a store/region signal that
disagrees (Blaze `Region Name`, Meadow organization), the upload is refused, not corrected.

**Upload transport**: the browser reads the file and POSTs it as JSON in ≤2 MB chunks
(`begin` → `chunk`×N → `commit`, keyed by `upload_id`); the server assembles under a temp dir
and parses once. One parser, in Python, probe-tested against real fixtures. No client-side
parsing, no second implementation.

### 3.4 Contests

```sql
CREATE TABLE inc_contests (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
  kind TEXT NOT NULL,                 -- spiff | contest | team_goal | store_vs_store | aov_goal
  metric TEXT NOT NULL,               -- units | net_cents | gross_cents | txn_count | aov_cents
  filter_json TEXT NOT NULL,          -- {brands:[], categories:[], products:[], min_line_cents}
  store_ids_json TEXT NOT NULL,       -- [] == every store
  participants_json TEXT NOT NULL,    -- {scope:'all'|'list', associate_ids:[], teams:[{name, associate_ids}]}
  window_start TEXT NOT NULL, window_end TEXT NOT NULL, tz TEXT NOT NULL,
  recurrence TEXT NOT NULL,           -- none | hourly | daily | weekly
  reward_json TEXT NOT NULL,          -- see below
  funding_json TEXT NOT NULL,         -- {funded_by:'store'|'brand', brand, budget_cents, cap_per_person_cents}
  tie_rule TEXT NOT NULL,             -- split | earliest
  status TEXT NOT NULL,               -- draft | pending_approval | active | ended | settled | cancelled
  created_by TEXT NOT NULL, approved_by TEXT, approved_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE inc_contest_events (...);                  -- append-only audit of every transition + edit
CREATE TABLE inc_standings_cache (contest_id, round_key, ledger_version, computed_at, standings_json,
                                  PRIMARY KEY (contest_id, round_key));
```

`reward_json` shapes:
- **spiff**: `{type:'threshold', threshold, amount_cents, per:'person', repeat:false}` → every
  participant who reaches `threshold` of `metric` in the window earns `amount_cents`.
- **per-unit spiff**: `{type:'per_unit', amount_cents, cap_cents}`.
- **contest**: `{type:'places', places:[{rank:1, amount_cents}, {rank:2, ...}]}`; hourly
  recurrence evaluates each hour as a round with its own places.
- **team_goal**: `{type:'team_threshold', threshold, amount_cents, split:'equal'|'by_share'}`.
- **store_vs_store**: `{type:'places'}` over stores; the winning store's participants split.
- **aov_goal**: `{type:'aov', goal_cents}` — the absorbed AOV goal, per store default with
  per-associate overrides, backed by the existing `aov_goals` tables.
- Every reward carries `unit:'cents'|'points'|'recognition'`. Cents are **tracked**, never paid.

State machine: `draft → pending_approval → active → ended → settled`, plus `cancelled` from
any pre-settled state. Brand-funded contests **must** pass through `pending_approval` and be
approved by a manager at the store. Store-funded contests created by a manager go straight
to `active` when the window opens. `active` and `ended` are derived from the clock, not
stored transitions; `settled` is a real write.

### 3.5 Scoring semantics (pure, probe-tested)

- Window comparisons are in store-local time via `local_day`/`local_hour`; a contest's `tz`
  is the store's tz.
- `units` sums `quantity` over matching lines; `net_cents` sums `line_net_cents`, minus
  refunds of the same lines; `txn_count` counts distinct sale txns with ≥1 matching line;
  `aov_cents` = net / txn_count.
- **Ranking is competition ranking (1, 1, 3)**; the API says `tied: true` on tied rows. A
  prize tied across N people is split equally (`split`) or goes to whoever reached the value
  first (`earliest`, using `sold_at` of the crossing sale). Both are explicit in the contest.
- Zero-metric participants are listed under `not_yet` with rank `null`, never rank-last at 0.
  This keeps the current AOV convention.
- Unattributed sales (`associate_id NULL`) are reported per contest as `unattributed:
  {txns, cents}` so a manager sees what the standings cannot see.
- A standing is `projected` until `settled`; settlement writes `inc_points` rows once per
  `(contest_id, round_key, associate_id)`.

### 3.6 Earnings

```sql
CREATE TABLE inc_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  associate_id TEXT NOT NULL, store_id TEXT NOT NULL,
  contest_id TEXT, round_key TEXT, snap_id TEXT,
  kind TEXT NOT NULL,                 -- earned | adjusted | recorded_paid
  unit TEXT NOT NULL,                 -- cents | points
  amount INTEGER NOT NULL,
  reason TEXT, actor TEXT NOT NULL, ts TEXT NOT NULL,
  UNIQUE (contest_id, round_key, associate_id, kind)
);
```

Balances are sums over the ledger. `recorded_paid` is a bookkeeping marker ("paid out on
2026-09-12 by Manisha, cash, reason") and carries no payment behaviour. If JT does not want
even the marker, it is one `kind` to drop.

### 3.7 Education (Snaps)

```sql
CREATE TABLE inc_snaps (id, title, brand, store_ids_json, cards_json, status, publish_at, expire_at,
                        linked_contest_id, quiz_reward_json, created_by, created_at, updated_at);
CREATE TABLE inc_snap_views (snap_id, associate_id, first_viewed_at, completed_at, quiz_score, quiz_passed,
                             PRIMARY KEY (snap_id, associate_id));
CREATE TABLE inc_media (id, mime, bytes BLOB, size, created_by, created_at);
```

`cards_json`: ordered `[{type:'image'|'text'|'video_url'|'quiz', media_id?, heading?, body?, question?, choices?, answer?}]`.
A snap with `quiz_reward_json` awards points/cents on a passed quiz (the SparkPlug "Courses"
mechanic); a plain snap is pure content. A snap can link to a contest so "learn it" sits
beside "sell it".

---

## 4. API surface

All JSON. Reads ungated; writes go through the existing `x-hw-write-token` gate in public
mode. Manager-only writes additionally check the actor's `associates.role` server-side.
Every write returns the refreshed read surface (the estate convention).

| Method | Path | Notes |
|---|---|---|
| GET | `/api/incentives/me?store_id&associate_id` | One call for the Home card and the app's landing view: rank today (store/all), active contests with my progress, balance, unread snaps, source freshness. |
| GET | `/api/incentives/standings?scope&store_id&period&metric&filter=` | Leaderboard. `scope` store\|all\|stores (store-vs-store). `period` today\|week\|month\|custom. Returns `ranked`, `not_yet`, `unattributed`, `ledger_version`, `sources[]` freshness. |
| GET/POST | `/api/incentives/contests` | List (filters: store, status) / create-or-update draft. |
| GET | `/api/incentives/contests/{id}` | Contest + live standings (cached by ledger_version) + audit. |
| POST | `/api/incentives/contests/{id}/{submit\|approve\|cancel\|settle\|apply}` | Transitions. `apply` = manual re-evaluation (also cached). |
| GET | `/api/incentives/earnings?associate_id` / `?store_id` | Balances + ledger rows. |
| POST | `/api/incentives/earnings/record-paid` | Bookkeeping marker only. |
| GET/POST | `/api/incentives/snaps`, `/api/incentives/snaps/{id}/view`, `/api/incentives/snaps/{id}/quiz` | Content, views, quiz submission. |
| POST/GET | `/api/incentives/media`, `/api/incentives/media/{id}` | Base64 in, bytes out. |
| GET | `/api/incentives/ingest/status` | Per (store, source): configured?, last ok, last error, cursor, counts today. |
| POST | `/api/incentives/ingest/upload/{begin\|chunk\|commit}` | Chunked CSV/XLSM upload → parse → run report. |
| GET | `/api/incentives/ingest/runs`, `/runs/{id}`, `/runs/{id}/rejects`, `/runs/{id}/conflicts` | Full accounting. |
| POST | `/api/incentives/ingest/conflicts/apply` | Apply incoming values, per conflict or per run. |
| POST | `/api/incentives/ingest/sync-now` | Kick one pass for (store, source). |
| GET/POST | `/api/incentives/identities/unresolved`, `/resolve`, `/unbind` | The matching queue. |
| GET | `/api/incentives/roster?store_id` | Associates + their bound identities per source. |
| GET/POST | `/api/incentives/settings` | Tz per store, default tie rule, manager roles. |
| GET/POST | `/api/aov/*` | Unchanged contract, served by `aov_compat.py`. |

---

## 5. Frontend

### 5.1 Files

```
Hyperwolf <Name>.html            entry, script order copied from Hyperwolf Engage.html
                                 + shared/hw-live.js (see 5.4)
incentives/app.jsx               shell: HWRail active="incentives", module sidebar, hash router, topbar,
                                 theme toggle, ScreenBoundary per screen — the Engage skeleton
incentives/inc-client.jsx        window.HWInc: get/post over HW_LIVE, polling hook with ledger_version
                                 short-circuit, session accessor (window.HW.STATS.associate → one function
                                 to swap at production port)
incentives/inc-shared.jsx        module-local composites built from atoms: StandingsTable, ProgressRow,
                                 SourceFreshness, RunReport, IdentityPicker, ContestBadge
incentives/screen-standings.jsx  #/            leaderboards (person / store-vs-store / period / metric)
incentives/screen-contests.jsx   #/contests    list, detail with live standings, approvals
incentives/screen-contest-builder.jsx #/contests/new · #/contests/:id/edit
incentives/screen-earnings.jsx   #/earnings    my balance + ledger; manager: store ledger, record-paid
incentives/screen-learn.jsx      #/learn       story player (cards, progress dots, tap to advance, quiz)
incentives/screen-learn-author.jsx #/learn/new · #/learn/:id/edit
incentives/screen-data.jsx       #/data        connections, upload, runs, rejects, conflicts, identities
incentives/screen-goals.jsx      #/goals       absorbed AOV goals (store default, overrides, audit)
incentives/screen-settings.jsx   #/settings
pos/screen-incentives-card.jsx   window.IncHomeCard — replaces AovDashboardCard on POS Home
```

Every file is IIFE-wrapped; only `window.Inc*` and `window.HWInc` leak. `test/global-collisions.test.mjs` is extended to include the new files.

### 5.2 Design-system rules honoured

- Palette only via `useP()`; zero hex literals. Type/space/radius from `P.type`, `P.space`, `P.r*`.
- Atoms only: `Card`, `KPI`, `Pill`, `PBtn`, `Field`, `DataTable`, `Seg`, `Tabs`, `BarMeter`, `Avatar`, `Spark`, `Icon`; states from `shared/states.jsx`; Engage kit (`StatTile`, `Sheet`, `hdToast`, `SortableTH`) inside the new app only. The POS card and strip use POS atoms only (hd-ui is not loaded on the POS page).
- New icons (podium, trophy, medal, story) are added as cases in `pos/icons.jsx`, never inline.
- Loading = skeleton *inside the header the loaded state will show*. Error = `ErrorState` with the estate's copy. Empty = `EmptyState`, never blank.
- Copy voice: plain, second person, specific. No "Something went wrong".
- Hub: `Hyperwolf.html` card, `shared/app-nav.js` item, `shared/app-switcher.js` entry — same turn.

### 5.3 Honesty labelling

There is no mock data in this module, so the label is about **connection and freshness**:
- Backend unreachable → `ErrorState` "Incentives aren't connected — needs the wmdemo backend" in place of the content (the AOV pattern).
- Every standings view carries a `SourceFreshness` line per source: `Blaze API · Corona · synced 2m ago · 143 sales today` / `Meadow API · West Hollywood · last error 14:02: 401 (client key)` / `Blaze CSV · Lake Elsinore · last upload 2026-09-05 (All Sales, 1,204 lines)` / `never synced`.
- Unattributed sales are shown as a row, with a link to the identities queue.
- A contest whose store has no source configured is created but flagged `no data source` in its badge.

### 5.4 The live seam on a non-POS page

`shared/hw-live.js` is loaded only by the POS page today and does POS-specific work at boot
(a `/api/state` fetch). Build step: measure what it does on the new page; if the `/api/state`
fetch fires, add a `data-hw-live-lite` attribute on the script tag that arms `get/post`,
the badge and token handling only. One seam, one base-URL rule, one write-token rule.

### 5.5 POS surfaces

- **Register**: untouched. No strip, no card, no file change in `pos/screen-register.jsx` (owner ruling 2026-09-08).
- **Home card** (`IncHomeCard`): replaces `AovDashboardCard`. Same slot, same guard. Shows
  AOV goal meter (absorbed), rank chips, active contests, balance; manager sub-card links to
  `#/goals` and `#/contests` instead of embedding the old manager panel.

---

## 6. Roles and identity (and the production gap)

The estate has no login. `pos/app.jsx` hard-codes `USER` (Manisha Saini, Floor Manager,
elsinore) and `window.HW.STATS.associate` mirrors it. The module reads identity through one
function, `HWInc.session()`, so the production port swaps one function, not forty call sites.
Server-side, manager writes verify `associates.role ∈ {Floor Manager, Admin}` for the given
actor id; in public mode the write token still gates. **Real authentication is escalated
(§11)**: it is a platform decision, not a module one, and it changes how `actor` is trusted.

---

## 7. Build sequence, agents, models

### 7.0 Prerequisites from JT (blocking for phases 2+, not for phase 1)

1. Keys into `/Users/jt/wm-demo/.env` (never in chat): `BLAZE_PARTNER_KEY`,
   `BLAZE_AUTH_KEY_CORONA`, `BLAZE_AUTH_KEY_ELSINORE`, `MEADOW_CONSUMER_KEY`,
   `MEADOW_CLIENT_KEY_WEST_LA` (Analytics scope). `.env.example` gets the names.
2. One real export per format into `wm-demo/qa/fixtures/incentives/` (customer names may
   be blanked; keep employee names and product/brand columns intact): Blaze All Sales,
   Blaze Total Sales, Meadow Orders Report (`.xlsm`).
3. Decisions: name (§10), design concept (separate deliverable), Long Beach/Treez (§11),
   `recorded_paid` marker keep/drop.

### 7.1 Phase 1 — foundation (Opus, sequential, ~1 agent)

`schema.py`, `roster.py`, `ledger.py`, `ingest_csv.py`, `scoring.py`, `aov_compat.py`,
and their probes (`qa/incentives_*.py` registered in `battery.py`). Parsers first run against
the documented headers with synthetic fixtures, then re-run against JT's real files before the
phase closes. Also: `qa/incentives_blaze_field_census.py` — the Python re-run of the field
census against a recent retail-only window, reporting population % per candidate field and
whether `cart.items[]` is present on list responses. Its output decides §1.1's branch.

### 7.2 Phase 2 — integrations and routes (Sonnet, 3 in parallel, disjoint files)

A: `blaze_client.py` + Blaze branch of `sync.py`. B: `meadow_client.py` + Meadow branch.
C: `contests.py`, `rewards.py`, `education.py`, `serve.py`, route registration, docstring
route table. Each with probes. Opus refuter pass after merge.

### 7.3 Phase 3 — UI (Sonnet/Haiku, 5 in parallel, disjoint files)

A: `app.jsx` + `inc-client.jsx` + `inc-shared.jsx` + HTML + hub/nav/switcher. B: standings +
earnings. C: contests + builder. D: learn + author. E: data + goals + settings + POS Home card. Each agent verifies live on a fresh port (the stale-cache rule) and screenshots the
screen in light and dark.

### 7.4 Phase 4 — verification (Opus refuters, 3 lenses, then me)

Lenses: correctness of scoring/ingestion (re-derive numbers from a fixture by hand),
safety (write gates, role checks, idempotency under retry), blast radius (nothing outside
`incentives/` and the two POS files changed; AOV contract probe green; global-collision test
green). Then I spot-check diffs and drive the app live before commit. Commit to POS-Admin and
wm-demo; push only after live verification on both.

---

## 8. Verification standard (what "done" means)

- `python3 qa/battery.py --fix` green including the new suites; `docs/SCOREBOARD.md` rows for each.
- Ingest invariant probe: `rows_read == inserted + unchanged + conflicts + rejected` on every fixture, including a deliberately overlapping second upload and a file with 5 malformed rows.
- Scoring probe: hand-computed standings for a 3-person, 2-brand, 1-refund fixture match the engine, including a tie under both tie rules.
- AOV parity probe: the six `/api/aov/*` responses are shape-identical before and after `aov_compat.py`.
- Field census probe output recorded in the plan's §1.1 with the date.
- Browser: every screen rendered live (backend up) and offline (backend down) in light and dark; the Home card verified on the POS page and `pos/screen-register.jsx` byte-identical to `main`; a real CSV dropped through the UI produces a run report whose numbers match the probe.
- `node test/global-collisions.test.mjs` green with the new files included.

---

## 9. Risks and how the design absorbs them

| Risk | Handling |
|---|---|
| Blaze API has no per-sale employee on retail sales | Census decides. If absent: Blaze stores get near-real-time *store* totals from the API and per-person attribution from the All Sales CSV; the UI says which. `sellerTerminalId` is never used to infer a person (owner ruling 2026-08-17). |
| Blaze list lacks `cart.items[]` | Per-transaction detail fetch via `realtime.submit` with a `"inc:"` lane cap of 2 and a daily budget; or CSV for line-level. Both paths write the same `inc_lines`. |
| `/transactions` truncates at ~2,174 rows, oldest first, silently | Sync windows are one local day, paged at 100, with the no-progress detector; a day exceeding the cap is split into hour windows. |
| Meadow has no roster endpoint | Identities harvested from `placedBy`; email auto-bind; unresolved queue. |
| Duplicate fetch of `/transactions` (5 call sites in GAS) | This one lives in wm-demo with its own window; params differ, so no merge (CLAUDE.md §4.8). |
| SQLite with no WAL, one process | Ingest in ≤500-row batches under `_lock`; readers use the standings cache. |
| 30-minute request cap does not apply (long-lived process) but Render is 0.5 vCPU | Sync loop paces itself; per-pass row cap; measured in the run row. |
| Same global scope | IIFEs, `Inc*` prefix, collision test extended. |
| Stale `.jsx` served by the dev port | Every live check on a fresh port. |

---

## 10. Name — decided

**Hyperwolf Bounty.** Picked 2026-09-07 after four rounds; the requirement that settled it was
SparkPlug's pattern where the product name is also the noun for one incentive ("Sparks").
Vocabulary in UI copy:

| Concept | Copy |
|---|---|
| The module / rail label / hub card | Bounty · "Hyperwolf Bounty" |
| One incentive of any kind | a bounty · "3 open bounties" · "$50 bounty on any STIIIZY pod" |
| Kinds of bounty | spiff · ranked · team goal · store vs store · AOV goal |
| Leaderboard | the bounty board (standings) |
| Earnings | claimed · "you've claimed $130 this week" · projected until settled |
| Brand-funded | "posted by STIIIZY" chip; needs a manager's approval before it opens |

Code identifiers keep the neutral `contest` noun (`inc_contests`, `/api/incentives/contests`,
`screen-contests.jsx`) so a future rename is copy-only, exactly as this one was.

---

## 11. Escalations (not built without a ruling)

1. **Long Beach on Treez** — no ingestion path in this brief. Options: leave the store as
   "no data source" (honest), or scope a Treez client later. The ledger's `source` column is ready.
2. **Real authentication** — identity is a hard-coded demo user across the whole estate; the
   module isolates it behind one function but cannot supply it.
3. **`recorded_paid` marker** — bookkeeping only, no money moves. Keep or drop.
4. **Notifications** — SparkPlug nudges by SMS. This estate has Connecteam chat and Discord
   webhooks. Not in this build; the contest events table gives a hook.
5. **Brand-user access** — SparkPlug lets brands create and fund campaigns from their own
   login. Here a manager enters brand-funded contests on the brand's behalf.
