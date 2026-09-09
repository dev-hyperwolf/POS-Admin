# Bounty API contract — the shapes both sides build to

Companion to `INCENTIVES-PLAN-2026-09-07.md` §4. The backend (`wmdemo/incentives/serve.py`)
implements these; the screens (`incentives/screen-*.jsx`) consume them. **A screen never
invents a field; a route never omits one listed as required.** Money is integer cents.
Timestamps are ISO-8601 UTC text. `local_day` is `YYYY-MM-DD` in the store's tz.
Every read carries `ledger_version` so polling can short-circuit.

Errors: `{ "error": "<sentence>" }` with 400 (bad input), 403 (role/gate), 404 (no such id),
409 (illegal transition), 501 (not built — must never ship).

Actor: writes take `actor` in the body (`associate_id`), defaulting to the operator email as
the estate does today. Manager-only writes verify `associates.role ∈ {Floor Manager, Admin}`.

---

## Common fragments

```jsonc
Source            { "source": "blaze-api|meadow-api|blaze-csv|meadow-csv|hwpos",
                    "store_id": "corona", "store_name": "Corona",
                    "configured": true,               // keys present (api) / n.a. (csv)
                    "last_ok_at": "2026-09-08T21:02:11Z" | null,
                    "last_error": "401 Unauthorized (client key)" | null,
                    "last_error_at": "..." | null,
                    "today": { "txns": 143, "lines": 412 },
                    "stale": false }                  // no ok in > 30 min for api sources
Person            { "associate_id": "manisha-saini", "name": "Manisha Saini",
                    "store_id": "elsinore", "store_name": "Lake Elsinore", "role": "Floor Manager" }
Standing          { ...Person, "value": 61200, "value_kind": "net_cents|units|gross_cents|txn_count|aov_cents",
                    "rank": 2, "tied": false, "earned_cents": 0, "progress": 0.62,
                    "movement": 1 | -1 | 0 | null }   // rank change since previous ledger_version
Unattributed      { "txns": 6, "cents": 41200 }
Trail             { "gross_cents": 1448655, "refund_cents": 47875, "net_cents": 1400780,
                    "attributed_cents": 1339540, "unattributed_cents": 61240,
                    "txns": 212, "refunds": 4, "window": {"from":"...","to":"..."},
                    "sources": ["blaze-api", "blaze-csv"] }   // Concept B's computation trail
```

## GET /api/incentives/me?store_id&associate_id

```jsonc
{ "ledger_version": 812, "as_of": "2026-09-08T21:05:00Z",
  "person": Person,
  "today": { "net_cents": 61200, "txns": 9, "aov_cents": 6800,
             "rank_store": {"rank": 2, "of": 5, "tied": false}, "rank_all": {"rank": 7, "of": 18, "tied": false},
             "neighbors": [Standing, Standing, Standing] },      // me and the two either side (D's seat)
  "aov_goal": { "goal_cents": 9000, "source": "override|store_default|fallback", "met": false, "gap_cents": 2200 },
  "bounties": [ { "id": "b_...", "name": "...", "kind": "spiff", "brand": "STIIIZY"|null,
                  "funded_by": "brand|store", "ends_at": "...", "round_key": "2026-09-08T20",
                  "my": Standing, "reward_summary": "$50 at 10 units", "status": "active" } ],
  "earnings": { "projected_cents": 11500, "settled_cents": 9500, "recorded_paid_cents": 4000, "outstanding_cents": 5500 },
  "learn": { "unread": 2, "due": [ {"id": "s_...", "title": "...", "brand": "..."} ] },
  "inbox": { /* manager only, else absent */
             "pending_approval": 1, "unresolved_identities": 3, "source_errors": 1,
             "ending_today": 2, "settlements_due": 1 },
  "sources": [Source] }
```

## GET /api/incentives/standings?scope=store|all|stores&store_id&period=today|week|month|custom&from&to&metric=net_cents|units|gross_cents|txn_count|aov_cents&brand&category

```jsonc
{ "ledger_version": 812, "scope": "store", "store_id": "elsinore", "period": "today",
  "window": {"from": "...", "to": "..."}, "metric": "net_cents",
  "ranked": [Standing], "not_yet": [Person], "unattributed": Unattributed,
  "trail": Trail, "sources": [Source],
  "stores": [ { "store_id": "...", "store_name": "...", "value": 0, "rank": 1, "tied": false,
                "counted": true, "reason": null | "no data source · runs Treez" | "stale · 3h" } ] }  // scope=stores
```

## Contests (bounties)

`GET /api/incentives/contests?store_id&status=` → `{ "ledger_version", "contests": [ContestSummary] }`

```jsonc
ContestSummary    { "id", "name", "kind": "spiff|contest|team_goal|store_vs_store|aov_goal",
                    "metric", "status": "draft|pending_approval|active|ended|settled|cancelled",
                    "funded_by": "brand|store", "brand": "..."|null, "store_ids": [], "window_start", "window_end", "tz",
                    "recurrence": "none|hourly|daily|weekly", "reward_summary": "top three earn $50 / $30 / $20; ties split",
                    "sentence": "Sell 10 units of any STIIIZY pod between Mon 9:00 am and Sun at close; ...",  // C's sentence
                    "participants_count": 6, "leader": Standing|null, "ends_in_s": 3600, "has_source": true }
Contest (POST body / GET detail "contest")
                  { "id"?, "name", "description", "kind", "metric",
                    "filter": {"brands": [], "categories": [], "products": [], "min_line_cents": 0},
                    "store_ids": [], "participants": {"scope": "all|list", "associate_ids": [], "teams": [{"name","associate_ids":[]}]},
                    "window_start", "window_end", "tz", "recurrence",
                    "reward": {"type": "threshold|per_unit|places|team_threshold|aov", "unit": "cents|points|recognition",
                               "threshold"?, "amount_cents"?, "cap_cents"?, "places"?: [{"rank","amount_cents"}], "split"?: "equal|by_share", "goal_cents"?},
                    "funding": {"funded_by": "store|brand", "brand": null, "budget_cents": null, "cap_per_person_cents": null},
                    "tie_rule": "split|earliest" }
```

`GET /api/incentives/contests/{id}` →
```jsonc
{ "ledger_version", "contest": Contest, "summary": ContestSummary,
  "rounds": [ { "round_key", "window_start", "window_end", "standings": [Standing], "not_yet": [Person],
                "unattributed": Unattributed, "teams"?: [{"name","value","rank","tied","members":[Standing]}],
                "stores"?: [...], "settled": false } ],
  "trail": Trail, "audit": [ {"ts","action","actor","from","to","reason"} ] }
```

`POST /api/incentives/contests` (create/update draft; body = Contest + `actor`) → `{ "contest": Contest, "summary": ContestSummary, "sentence": "..." }`
`POST /api/incentives/contests/preview` (body = Contest) → `{ "sentence": "...", "would_have_counted": { "window": {...7 days...}, "rounds": [...] } }` (B's live preview, labelled history)
`POST /api/incentives/contests/{id}/submit|approve|cancel|settle|apply` (body `{actor, reason?}`) → the GET detail shape.

## Earnings

`GET /api/incentives/earnings?associate_id` or `?store_id` →
```jsonc
{ "ledger_version", "balances": [ { ...Person, "projected_cents", "settled_cents", "recorded_paid_cents", "outstanding_cents", "points": 0 } ],
  "ledger": [ { "id", "ts", "kind": "earned|adjusted|recorded_paid", "unit", "amount", "contest_id", "contest_name", "round_key", "snap_id", "reason", "actor", "associate_id" } ],
  "reconciliation": { "settled_cents", "recorded_paid_cents", "outstanding_cents" } }
```
`POST /api/incentives/earnings/record-paid` `{associate_id, amount_cents, actor, reason, contest_id?}` → the GET shape for that associate.

## Learn (snaps)

`GET /api/incentives/snaps?store_id&associate_id` → `{ "snaps": [ { "id","title","brand","status","publish_at","expire_at","linked_contest_id","cards_count","quiz": bool, "reward_summary", "viewed": bool, "completed": bool, "quiz_passed": bool|null } ] }`
`GET /api/incentives/snaps/{id}` → `{ "snap": { ...above, "cards": [ {"type":"image|text|video_url|quiz","media_id"?,"media_url"?,"heading"?,"body"?,"question"?,"choices"?:[],"answer_index"?} ], "views": {"count","completed"} } }` (answer_index only for managers)
`POST /api/incentives/snaps` (body = snap + actor) · `POST /api/incentives/snaps/{id}/publish|expire`
`POST /api/incentives/snaps/{id}/view` `{associate_id, completed: bool}` → `{ "view": {...} }`
`POST /api/incentives/snaps/{id}/quiz` `{associate_id, answers: [int]}` → `{ "score": 0.8, "passed": true, "earned": {"unit","amount"}|null }`
`POST /api/incentives/media` `{mime, b64, actor}` → `{ "id", "url": "/api/incentives/media/<id>", "size" }` · `GET /api/incentives/media/{id}` → bytes

## Data (ingest)

`GET /api/incentives/ingest/status` → `{ "sources": [Source], "cursors": [ {"source","store_id","cursor","last_ok_at","last_error"} ], "sync_running": false }`
`POST /api/incentives/ingest/upload/begin` `{store_id, filename, size, actor}` → `{ "upload_id" }`
`POST /api/incentives/ingest/upload/chunk` `{upload_id, seq, b64}` → `{ "received": 2, "bytes": 2097152 }`
`POST /api/incentives/ingest/upload/commit` `{upload_id}` → `{ "run": Run }` (parse + ingest synchronously; the run row carries the result)
```jsonc
Run               { "id", "kind": "csv|api", "source", "store_id", "filename", "format", "started_at", "finished_at",
                    "status": "running|ok|partial|failed", "rows_read", "inserted", "unchanged", "conflicts", "rejected",
                    "unresolved_identities", "brands_unknown": [], "window_from", "window_to", "actor", "error" }
```
`GET /api/incentives/ingest/runs?store_id&limit` → `{ "runs": [Run] }` · `GET .../runs/{id}` → `{ "run": Run }`
`GET .../runs/{id}/rejects` → `{ "rejects": [ {"row_no","reason","raw_excerpt"} ] }`
`GET .../runs/{id}/conflicts` → `{ "conflicts": [ {"txn_key","field","stored_value","incoming_value","resolution"} ] }`
`POST /api/incentives/ingest/conflicts/apply` `{run_id, txn_key?, actor}` → `{ "applied": n, "run": Run }`
`POST /api/incentives/ingest/sync-now` `{source, store_id, actor}` → `{ "run": Run }`

## Identities

`GET /api/incentives/identities/unresolved?store_id` →
`{ "identities": [ { "identity_key","source","store_id","external_id","external_email","raw_name","first_seen","last_seen","seen_count","sales_count","cents","suggestions": [ { ...Person, "score": 0.91, "evidence": "name 0.91 · same store" } ] } ] }`
`POST /api/incentives/identities/resolve` `{identity_key, associate_id, actor, reason?}` → `{ "identity": {...}, "reattributed": {"txns": n, "lines": m} }`
`POST /api/incentives/identities/create` `{identity_key, actor}` → same, with the new Person
`POST /api/incentives/identities/unbind` `{identity_key, actor, reason}` → same
`GET /api/incentives/roster?store_id` → `{ "roster": [ { ...Person, "email", "active", "identities": [ {"source","external_id","raw_name","match_kind"} ] } ] }`

## Goals (absorbed AOV)

`/api/aov/*` unchanged (see plan §3.5). Bounty's Goals screen calls exactly those.

## Register → Bounty: the production POS integration contract

**`POST /api/pos/sale`** — called by the register at the point of sale (today: pos/payment.jsx's
`finalize()`, demo scope only; a production POS integration replaces that call site, not this
contract). One POST per completed tender. Dual-writes `pos_sales` (unchanged, legacy shape) and
`inc_txns`/`inc_lines` (the Bounty ledger) from the same call, so a sale is on every board the
moment it is tendered.

```jsonc
// request body
{ "order_id": "ORD-00224",        // string, required — this register's own sale id
  "store_id": "elsinore",          // string, required
  "associate_id": "manisha-saini", // string, required — the person who RANG the sale, never a
                                    // terminal id or a shared till login
  "total_cents": 6120,             // int, required — the TENDER total, cents. Includes tax and
                                    // fees, so it is NOT what a bounty is scored from — see
                                    // subtotal_cents/discount_cents below.
  "subtotal_cents": 5400,          // int, REQUIRED (2026-09-08) — ex-tax retail BEFORE discounts.
  "discount_cents": 400,           // int, REQUIRED (2026-09-08) — the discount off that subtotal.
                                    // Bounty net = subtotal_cents - discount_cents. Both may be
                                    // OMITTED only when `lines[]` is present and every line
                                    // carries `line_gross_cents`, in which case the server sums
                                    // them (Σ line_gross_cents, Σ discount_cents) — the same two
                                    // facts at finer grain. A post with neither → 400.
  "item_count": 3,                 // int, optional, default 1
  "method": "cash|card|split",     // string, optional
  "customer_name": "...",          // string, optional
  "txn_type": "sale|refund|void",  // string, optional, DEFAULT "sale". A refund/void is its own
                                    // POST — never folded into the sale it reverses.
  "ref_txn_id": "ORD-00219",       // string, optional — for a refund/void, the original sale's
                                    // order_id. Same role Blaze's parentTransactionId / Meadow's
                                    // orderId play for those vendors (see the refund-netting
                                    // section below). Never on a CSV export; only a live POST.
  "lines": [                       // array of objects, OPTIONAL BUT STRONGLY EXPECTED — see
                                    // "why lines[] matters" below. Built ONCE, at tender time,
                                    // from the cart that is actually being charged.
    { "product_name": "Cake Crasher",  // string or null
      "brand": "Jeeter",               // string or null — the catalogue's own display name,
                                        // never a vendor-raw spelling that needs normalizing
      "category": "Pre-Rolls",         // string or null
      "sku": "H480PRO1",               // string or null
      "quantity": 1,                   // number, required, > 0
      "unit_price_cents": 1500,        // int or null — NEVER 0 for "unknown"
      "line_gross_cents": 1500,        // int or null — quantity × unit price, before discount
      "line_net_cents": 1500,          // int or null — after this line's own discount
      "discount_cents": 0 }            // int or null — line_gross_cents - line_net_cents
  ] }
```

```jsonc
// response, 200
{ "sale": { /* pos_sales row, unchanged shape */ },
  "lines": "not sent"                          // no `lines` key in the request at all — an
                                                 // OLDER CLIENT, accepted exactly as before
      | { "inserted": 3, "unchanged": 0, "conflicts": [] }   // lines were sent and upserted
      | { "error": "ledger mirror failed" } }               // sale recorded; the inc_* mirror
                                                              // (txn and/or lines) did not land —
                                                              // see log_event, never silent
```

**Refusal rules — the whole POST fails together, nothing partial is stored:**

- Missing any of `order_id`, `store_id`, `associate_id`, `total_cents` → `400`.
- **Missing the ex-tax money basis → `400`** (2026-09-08). The post must state it either as
  `subtotal_cents` + `discount_cents`, or as a `lines[]` whose every entry carries
  `line_gross_cents`. `total_cents` cannot stand in: it is the tender total, taxes and fees
  included, and every Bounty board is scored on **ex-tax net sales after discounts**
  (`money_basis: "ex_tax_net"`). Before this, an unfiltered board summed the tax-inclusive
  receipt total while a filtered board summed ex-tax line nets — measured 34% apart on the same
  real rows. Either of the two forms present but not a whole number of cents → `400` as well.
- `associate_id` not on the roster, or not that store's own associate → `400`
  (`pos_sales.UnknownAssociate`).
- `txn_type` present but not one of `sale|refund|void` → `400`.
- `lines` **present** and invalid — not a list, an entry not an object, `quantity` missing/≤0/not
  numeric, or any of the four cents fields not an integer-or-null (a non-integer float or a bool
  refuses too) — → `400` **naming the bad line's index**, e.g. `"line 2: quantity must be > 0,
  got 0"`. Nothing from this sale (not even `pos_sales`, not `inc_txns`) is written.
- `lines` **absent entirely** (no `"lines"` key in the body) is **not** a validation failure — it
  is an older client, accepted, and the response says `"lines": "not sent"`.
- A missing field ON A LINE the client legitimately doesn't know (unresolved SKU, no brand on
  record) is sent as `null` — **never `0`**, which would tell the ledger a real product sold for
  free.

**Idempotency.** Retried with the same `order_id`: `pos_sales` no-ops (`INSERT OR IGNORE`),
`inc_txns` no-ops on the same `txn_key`/content hash, and `inc_lines` no-ops on the same
`line_key`s — a replay is a no-op end to end, never a duplicate.

**Why `lines[]` matters.** `/api/incentives/*`'s brand and category bounties score off
`inc_lines`, not the transaction total. A sale posted with no `lines[]` still lands on the
store/associate boards (`inc_txns` alone is enough for those) but is **invisible to every
brand-funded or category-scoped bounty** — there is nothing in `inc_lines` for that sale to
match against. See the "Production POS wiring" DevNote on `incentives/screen-data.jsx` for the
same rule stated to whoever wires the real register.

**Refund/void netting.** `/api/aov/*` (legacy Goals numbers) reads `txn_type='sale'` only —
refunds/voids are invisible there, exactly as `pos_sales` always was. `/api/incentives/*`
(Bounty's own boards) nets them: a `refund`/`void` row's `total_cents` is subtracted, and when
`ref_txn_id` names the original sale, that sale is also dropped from the netted `txn_count`. See
"`/api/aov/*` and `/api/incentives/*` disagree about refunds — on purpose" below for the full
reasoning; the same divergence applies to hwpos rows as to Blaze/Meadow ones.

**The money basis, on every board payload.** `GET /standings` and the contest detail payload both
carry `scored_from: "txns"|"lines"` (which grain the board was scored from) and
`money_basis: "ex_tax_net"` (what `net_cents`/`gross_cents` mean: ex-tax net after discounts and
refunds, against ex-tax retail before discounts). Both grains have used that one basis since
2026-09-08; a stored board without `money_basis` predates the fix and its unfiltered numbers are
on the tax-inclusive receipt total.

## Settings

`GET /api/incentives/settings` → `{ "stores": [ {"id","name","tz","pos": "blaze|meadow|treez|none"} ], "tie_rule_default": "split", "managers": [Person] }`
`POST /api/incentives/settings` `{ tie_rule_default?, actor }` → the GET shape.

## Addenda (2026-09-08, from the screen builds — backend must honour)

- Screens receive props `{ navigate, query, route, path, session, isManager, previewing, seat: 'console'|'seat', me }` from `incentives/app.jsx`; `me` is the app-wide `/api/incentives/me` poll (`{loading, error, data, refresh}`).
- `POST /api/incentives/snaps` (create/update) → `{ "snap": Snap }` (the detail shape). `POST .../publish|expire` → the same.
- Snap body may carry `"quiz_reward": {"unit": "cents|points", "amount": int}`; the detail returns it under the same key; `reward_summary` is derived from it.
- `video_url` cards carry the URL in `media_url` (no separate field).
- Snap list items carry `"views": {"count": int, "completed": int}` for managers (budtenders get the same key with their own counts only) so the list needs no N+1.
- `GET /api/incentives/contests` also accepts `?status=active` etc.; the Learn author reads it for the linked-bounty picker.
- `GET /api/incentives/contests/{id}` also returns `"sources": [Source]` for the bounty's stores (not only `trail.sources`).
- `POST /api/incentives/contests/preview` also returns `"fragments": [ {"text": "...", "field": "threshold|brands|window|reward|tie_rule|...", "answered": true} ]` in reading order; `sentence` is their concatenation.
- `submit` on a **store-funded** bounty goes draft → active directly (a manager created it; there is nobody else to approve). `submit` on a brand-funded bounty goes draft → pending_approval. `apply` is a manual re-evaluation only.
- `#/contests/:id/edit` is a real route in `incentives/app.jsx` (renders the builder with the draft loaded).

### Person classification and bounty audiences (2026-09-08)

**Why it exists.** Drivers are not sales people. At Lake Elsinore the sellers *are* the
fourteen delivery drivers and the floor staff ring almost nothing, so one shared board tells a
budtender they are 15th of 21 for doing a job the fourteen above them do not do — and one
shared `scope: "all"` bounty pays the fleet out of the floor's prize pool. Managers, support
and loss prevention have the same problem in reverse: they were unincentivizable because there
was nothing to name them.

**Blaze cannot answer it.** `/employees` carries `role.roleLevel` ∈ {ADMIN, MANAGER, OTHER} and
a boolean `driver`, and nothing else — a budtender, a loss-prevention officer and a support
account are all `OTHER`. The class is therefore **seeded** from those two hints and **curated**
in Bounty; a re-seed never overwrites a non-NULL classification.

```jsonc
Classification    "budtender" | "driver" | "manager" | "loss_prevention" | "support" | "other"
```

- **`Person.classification`** — added to `Person`, and therefore to every `Standing`, every
  `not_yet` row, `/me.person`, `/roster` rows and `/settings.managers`. Never null: a row with
  no stored class reads as `"budtender"`, which is what keeps every pre-existing bounty and
  board meaning the floor.
- **`GET /standings` gains `&class=`** — one of the six, or `all`. **Defaults to `budtender`.**
  It narrows `ranked` and `not_yet` only: `unattributed`, `trail` and `sources` are unmoved (a
  sale with nobody on it has no class, and the trail is the whole store's arithmetic). `rank`,
  `tied` and `progress` are **recomputed within the class** through the same ranker, so the
  board agrees with `/me`. The response echoes `"class": "budtender"`.
- **`GET /me`** — `person.classification`, and `today.rank_store` / `today.rank_all` are ranks
  **within the person's own class**, with `of` counting that same population. The `neighbors`
  strip is the same class. The seat offers no class control: a person is shown the board they
  are on.
- **`participants.classes: ["budtender"]`** on every contest — the audience. Absent means
  `["budtender"]`; an empty list or an unknown class is a **400**. Stored de-duplicated in
  `budtender, driver, manager, loss_prevention, support, other` order, so two payloads naming
  the same audience produce the same row. With `scope: "all"` this now resolves to *every
  active associate at the bounty's stores whose classification is in `classes`* — not "whoever
  shows up in the data", which is what it meant before.
- **`ContestSummary.audience: ["driver"]`** — the same list, so the bounty list can show one
  chip per row without fetching each contest body.
- **`GET /contests` gains `?class=`** — one of the six, or `all`. **Defaults to `all`** (unlike
  the board: a bounty list is a manager's inventory of what is running). A bounty matches when
  the class is *one of* its audiences, so `?class=manager` keeps a drivers-and-managers bounty.
- **`sentence`** names the audience: `"… Open to budtenders on shift; ties split the prize."` ·
  `"Open to drivers"` · `"Open to drivers and managers"` · `"Open to everyone on shift"` (all
  six).
- **`POST /api/incentives/roster/classify`** `{associate_id, classification, actor, reason?}` →
  `{ "person": Person, "changed": bool, "ledger_version": int }`. **Manager-only** (403 for an
  associate). Unknown person → 404; unknown class → 400. Idempotent: re-setting the same class
  returns `changed: false`, writes no event and bumps no version. A real change **bumps
  `ledger_version`** — an audience change moves a bounty's ranking while inserting no ledger
  row — and appends to `inc_classification_events` (who moved whom, from → to, why).
- **`POST /api/incentives/identities/create`** accepts an optional `classification`, so the
  unresolved queue can mint a person straight into a class. An unknown class is a 400 and
  nothing is created.
- **`GET /settings` gains `classes`** — `[{ "id": "budtender", "label": "Budtender", "count": 34 }]`,
  all six always present including the empty ones, live headcount across every store. The
  labels are served so no screen keeps a second spelling.

### `/api/aov/*` and `/api/incentives/*` disagree about refunds — on purpose

**`/api/aov/*` EXCLUDES refunds and voids. `/api/incentives/*` NETS them.** The two are
reading the same `inc_txns` rows and will report different numbers for the same person over
the same window. Neither is broken; they are answering different questions, and a manager
holding the Goals screen next to a bounty board needs to know which is which before treating
the gap as a bug.

- **`/api/aov/*`** (`aov_compat._agg_sql`) aggregates `WHERE txn_type='sale'` only. Refund and
  void rows are not subtracted from the money and not removed from the order count — they are
  simply not read. This is the **legacy `pos_sales` contract kept verbatim for shape parity**:
  `pos_sales` had no concept of a refund at all, so a shim that quietly started netting them
  would have moved every historical AOV number and every goal that was ever set against one.
- **`/api/incentives/*`** (`scoring.py`) subtracts refunds from value, and — where the refund
  names its original (`ref_txn_id`: Blaze partner API `parentTransactionId`, Meadow `orderId`;
  never on either vendor's CSV export) — also removes the refunded sale from `txn_count`.

**How far apart they can get.** The Goals figure is the higher of the two whenever anything came
back in the window, and the gap is not a rounding difference. The whole value of the window's
refunds is missing from the Goals numerator, spread across the orders the board still counts,
so a single large return on a quiet day moves a person's board AOV by most of that return while
their Goals AOV does not move at all. Where the refund is linked, the board also drops the
original order out of the denominator, and the two effects compound: a budtender whose only
transaction that day was refunded reads their full sale price as AOV over one order on Goals,
and zero over zero orders on the board. Over a busy month with a normal return rate the two
land within a percent or two of each other — which is exactly what makes the occasional large
divergence look like a defect. It is not one.

**Consequence for the screens:** never present an `/api/aov/*` figure and an
`/api/incentives/*` `aov_cents` as the same measurement, and never compute one from the other.
A bounty settled on `aov_cents` is settled on the netted number; the Goals screen's target is
set against the un-netted one.
