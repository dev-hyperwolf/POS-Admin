# Hyperwolf Bounty — build status

Updated 2026-09-08 (evening). Everything is committed locally on both repos and **nothing is
pushed** (both repos auto-deploy on push; you push when you have looked).

## Where it stands

All four POS-connected stores rank real people from real sales, on the review server at
http://127.0.0.1:8791/Hyperwolf%20Bounty.html (August loaded via the real exports; September
via the live APIs):

| Store | POS | Live path | Backfill path | August board |
|---|---|---|---|---|
| Corona | Blaze | API sync every 5 min | Completed Sales Detail / Total Sales Products exports | 17 ranked, $375,571 net, $0 unattributed |
| Lake Elsinore | Blaze | API sync | All Sales export | 33 ranked, $698,451 net, $0 unattributed |
| West Hollywood | Meadow | API sync (Analytics key) | Orders Report workbook | 6 ranked, $79,583 net, $4,548 anonymous API orders |
| Long Beach | Treez | none (no client) | Products Report (tickets + money) and Inventory Log (units) | 8 ranked, $240,727 net, 6,909 tickets, $12,200 awaiting two identity binds |
| Register (demo POS) | in-house | every tender posts txn + cart lines | — | flows into the same ledger |

## What shipped today (on top of last night's module)

- **Classification and audiences.** Six classes (budtender, driver, manager, loss prevention,
  support, other) seeded from Blaze hints, editable on Data → Roster, audited; every bounty has
  an audience; boards default to Budtenders with a class switch; ranks are within class.
- **Real export formats, verified on your files:** Blaze Completed Sales Detail (title row)
  and Total Sales Products; Meadow Orders Report workbook (Date + Time columns); Treez
  Products Report (ticket grain, money) and Treez Inventory Log (units only, no ticket id —
  the board says so). Refunds net; a products-report line supersedes its inventory-log twin
  (90.4% matched on August); line keys are order- and format-independent.
- **Identity without guessing.** Id and email bind automatically; a CSV name binds only when it
  exactly matches the same vendor's own spelling of a person already bound by id at the same
  store; a name with sales and no candidate becomes a new person; a later id-based adoption
  merges into that person instead of duplicating; a name that could be two people waits for a
  manager. "N/A" and internal accounts are never people.
- **Register cart lines.** `/api/pos/sale` takes `lines[]` and `txn_type`; developer call-outs
  on the Data screen, upload section and Home card state exactly what the production POS must
  send (contract section "Register → Bounty").
- **Bandwidth.** Server gzips, ETag/304 on scripts, dashboard poll backs off when hidden or
  idle (8.5 GB/day per open tab → 69–139 MB).
- **Safety (from the adversarial reviews):** media allowlist with byte sniffing and nosniff,
  manager gate on every manager-only write, idempotent record-paid, leased and rate-limited
  sync-now, vendor kill switch (`HW_INC_VENDOR_OFF=1`).

## Verification

Twelve probe suites on scratch databases, **638 checks, all green** (`docs/SCOREBOARD.md`
BT-1 … BT-11): scoring 38, ingest 34, identity 37, aov_compat 20, contests 35, classes 55,
routes 161, safety 47, blaze_export 29, meadow_real 10, treez 55, meadow_sync 117 (plus
blaze_sync 48 offline). POS-Admin `test/global-collisions.test.mjs` 16/16. Live: a real cash
tender on the demo register reached a brand board; every store's August board recomputed by
hand from the raw files matches to the cent (adversarial pass in progress at time of writing).

## Waiting on you

1. **Review** the app with August loaded; send anything that reads wrong as a list.
2. **Push** both repos.
3. **After the push, on Render:** add the five env variables (same names as in
   `wm-demo/.env`: `BLAZE_PARTNER_KEY`, `BLAZE_AUTH_KEY_CORONA`, `BLAZE_AUTH_KEY_ELSINORE`,
   `MEADOW_CONSUMER_KEY`, `MEADOW_CLIENT_KEY_WEST_LA`), then either let the sync run its
   first pass or upload the August exports through Data → Upload on the deployed instance.
   The repo carries no data and no keys.
4. Two Long Beach identity binds (people who also work at West Hollywood): Data → Identities.

## Run it

```bash
cd /Users/jt/wm-demo && WM_DEMO_STATIC_DIR=/Users/jt/POS-Admin python3 -m wmdemo.server
```

Then http://127.0.0.1:8787/Hyperwolf%20Bounty.html. The review server I left on port 8791
polls Blaze and Meadow every 5 minutes; `pkill -f wmdemo.server` stops it.

## Open (known)

- Actor is self-asserted in every write, like the rest of wm-demo; `serve.is_manager()` is
  where real authentication attaches (plan §6, escalated).
- Session identity in the app is the estate's demo user via `HWInc.session()`.
- The two Blaze exports for one store carry genuinely different money bases on ~3,000 lines
  (Retail Value vs Retail Value of Sales); uploading both reports them as conflicts a manager
  can apply, by design. Upload one report type per store per month.
- Notifications, brand logins, payouts, mobile: out of scope (plan §11).
