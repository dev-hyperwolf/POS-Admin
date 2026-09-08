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

## Settings

`GET /api/incentives/settings` → `{ "stores": [ {"id","name","tz","pos": "blaze|meadow|treez|none"} ], "tie_rule_default": "split", "managers": [Person] }`
`POST /api/incentives/settings` `{ tie_rule_default?, actor }` → the GET shape.
