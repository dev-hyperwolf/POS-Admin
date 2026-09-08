# Hyperwolf Bounty — overnight build status

Written 2026-09-08, for JT's morning. Everything below is committed locally on both repos and
**nothing is pushed** (both repos auto-deploy on push; you push when you have looked).

## What shipped

**Backend (`/Users/jt/wm-demo`, `wmdemo/incentives/`, stdlib only)**
- Ledger at transaction and line grain with content-hash dedupe and full ingest accounting
  (`rows_read == inserted + unchanged + conflicts + rejected`, asserted on every run).
- Identity resolution: Blaze employees become associates automatically (bound by id, retroactive
  on the ledger); drivers are adopted after their first rung sale with the role "Driver"; deleted
  and internal accounts are held back with a visible note. Names only ever *suggest*.
- Blaze partner API client + sync (employees, then today's store-local day, paging guards,
  never trusts `total`). Meadow API client + sync (orders, returns, `placedBy`).
- CSV/XLSM ingestion for Blaze All Sales, Blaze Total Sales, Meadow Orders Report (built on the
  documented headers; **not yet verified against real files**, see "Waiting on you").
- Pure scoring (competition ranking, tie rules split | earliest, refunds netted, rounds incl.
  hourly), contest state machine with append-only audit and idempotent settlement, earnings
  ledger with a record-only "paid" marker, snaps with quiz rewards, `/api/aov/*` served from the
  new ledger with identical shapes.
- Every route in `docs/BOUNTY-API-CONTRACT.md`, a sync loop with an expiring lease, and the
  register's `/api/pos/sale` dual-writing into the ledger with a reconciler every sweep.

**Frontend (`/Users/jt/POS-Admin`)**
- `Hyperwolf Bounty.html` + `incentives/` — Concept D (Two Seats): budtender seat and manager
  console, hash router, one session accessor to swap at the production port.
- Screens: Standings (with Concept B's "How this was computed" trail), Bounties list/detail/
  builder (with Concept C's self-rewriting sentence and a 7-day dry run), Earnings, Learn
  (story player + author), Data (connections, chunked upload, run reports, conflicts, identities,
  roster), Goals (absorbed AOV), Settings. POS Home card replaces the AOV card.
- Rail item, app-switcher entry, hub card. The Register screen is untouched (verified
  byte-identical).

## What was verified live (not just by probes)

- Real Blaze data: two store-local days pulled for Corona (202 txns) and Lake Elsinore (254),
  all attributed to real people; weekly boards render in the app with ties marked; the POS Home
  card reads the same backend; the Data screen shows each store's real source state.
- Probe suites on scratch databases (see `docs/SCOREBOARD.md` BT-1…): scoring, ingest,
  identity, AOV compat, contests, routes, Blaze sync, Meadow sync — all green at last run.
- Three adversarial reviews (numbers, safety, blast radius) — findings and their fixes are in
  the git log; the two BLOCK-level ones (line-grain net ignored discounts; media MIME and
  manager-role gaps) were fixed the same night. See "Open" for anything still standing.

## Facts you should know

- **Blaze attribution is real.** `sellerId` names a person (13 distinct at Corona, 30 at
  Elsinore, all resolving via `/employees`); `cart.items[]` is on the list response. No CSV is
  needed for Blaze stores.
- **Lake Elsinore's sellers are all drivers** in Blaze (delivery depot). They are ranked as
  sellers with role "Driver". If you want drivers excluded from bounties, that is one rule in
  `sync_blaze._no_adopt_reason` and a decision for you.
- **Meadow key scope.** The West Hollywood client key has Customers scope only; orders and
  returns return 403. The Data screen shows that verbatim. (Also: the two Meadow keys had been
  pasted into each other's slots in `.env`; I swapped them.)
- **Long Beach runs Treez.** No client exists; the Data screen says "no data source · runs Treez".
- **`/api/aov/*`** keeps its shapes, but "today" is now the store-local day (plan §3.2), so
  evening AOV figures on the old Home card differ from before. The AOV routes still exclude
  refunds (legacy), while Bounty nets them — the contract addenda state this.

## Waiting on you

1. **A Meadow client key with Analytics scope** (Meadow Admin → Settings → API → Add Integration
   → enable Analytics) into `MEADOW_CLIENT_KEY_WEST_LA` in `/Users/jt/wm-demo/.env`.
2. **One real export per format** into `/Users/jt/wm-demo/qa/fixtures/incentives/` (Blaze All
   Sales, Blaze Total Sales, Meadow Orders Report). Until then the CSV parsers are verified only
   against synthetic files built from the documented headers.
3. **Long Beach / Treez**: leave as "no data source" or scope a Treez client later.
4. **Drivers as sellers** at Elsinore: keep (current) or exclude.
5. **Push** both repos when you are satisfied.

## Run it

```bash
cd /Users/jt/wm-demo && WM_DEMO_STATIC_DIR=/Users/jt/POS-Admin python3 -m wmdemo.server
```

Then open http://127.0.0.1:8787/Hyperwolf%20Bounty.html (manager console as Manisha Saini at
Lake Elsinore; "Preview as budtender" for the seat) and http://127.0.0.1:8787/Hyperwolf%20POS.html
for the Home card. The sync loop polls Blaze every 5 minutes; set `HW_INC_VENDOR_OFF=1` to stop
vendor polling, `HW_INC_SYNC_S=0` to idle the loop.

## Open

- (filled in at the end of the night)
