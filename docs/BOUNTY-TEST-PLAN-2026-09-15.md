# Bounty — what works, what doesn't, and the path to team testing

Audited 2026-09-15 against the deployed instance (https://hyperwolf-wm-demo.onrender.com) and
the code. Companion: `docs/BOUNTY-STATUS.md` (build status, 2026-09-08), `docs/BOUNTY-API-CONTRACT.md`.

## What works (deployed, verified read-only)

- The app loads; every tab renders (Standings, Bounties, Earnings, Learn, Data, Goals, Settings);
  every read route answers; the store switcher covers the five stores; the manager /
  budtender seat toggle works; the POS Home card and app-switcher entry are present.
- Empty states are honest: "No budtenders have sold anything yet" with the roster listed
  unranked, and the source strip names the exact cause ("Blaze API · Corona · no key configured
  for this store", "Blaze CSV · never synced", "Register · synced 5d ago · 0 sales today").
- The CSV upload path is live (`ingest/upload/begin|chunk|commit`, 64 MB cap, nine formats
  detected by header) and writes are not token-gated on this deployment (your 2026-08-19 ruling);
  manager-only routes still require a manager actor (today only Manisha Saini is a manager).
- Locally, all four stores ranked real people from real August exports and the live APIs; twelve
  probe suites (BT-1…BT-11) are green; the register → ledger dual-write is proven in-suite.

## What doesn't (and why)

| # | Symptom the team sees | Cause | Fix |
|---|---|---|---|
| 1 | Every board empty, every store "not configured" | No Blaze/Meadow key was ever added on Render; the local `.env` was deleted by another session's agent on 2026-09-10, so the keys now exist only in your GAS Script Properties | You re-enter five keys locally (Run buttons below) **and** in Render → Environment |
| 2 | No August data anywhere on the deployed instance | The August exports were only ever loaded on the local review server | **Done 2026-09-15**: five uploads, runs 360–364, zero conflicts: Corona 15,246 rows → 17 ranked; Lake Elsinore 24,335 → 33; West Hollywood 5,612 → 6; Long Beach 12,762 + 10,531 → 8 (two identity binds waiting). Note: the Corona file named TOTAL_SALES_PRODUCTS fingerprinted as Completed Sales Detail; the numbers match the local build, but confirm which report Blaze exported |
| 3 | "Sync now" refuses; nothing polls | The 2026-09-11 OOM mitigation set `HW_INC_SYNC_S=0` and `HW_INC_VENDOR_OFF=1` in render.yaml; the memory hardening that makes the loop safe (`60e6825`) is on origin but the pause was never lifted | After keys: restore `HW_INC_SYNC_S=300`, remove `HW_INC_VENDOR_OFF`, redeploy, watch the `rss_before/rss_after` log line for a day |
| 4 | Everyone is "Manisha Saini · Floor Manager · Lake Elsinore" even on Corona | The Bounty page has no POS login, so the demo fallback session is the only identity; the seat toggle is a visual preview, not a second person | "Testing as" picker over the roster (in progress today), labelled demo-only |
| 5 | Long Beach shows nothing | Treez store, CSV-only by design; nobody uploaded its reports on Render | Same upload as #2; then the two identity binds on Data → Identities |
| 6 | Register sales never appear | The deployed register has never tendered a sale; the mirror runs read 0 rows | A tester tenders one cash sale on the deployed POS with a customer attached; the ledger row appears on the next mirror pass (or immediately once the loop is back) |
| 7 | No contests to look at | None were created on Render | Seed two real bounties on Render after the data lands (brand board for a real August brand; AOV goal), created through the UI as the manager |

## Sequence

1. **Today, no keys needed**: August exports uploaded to Render (all four stores); "Testing as"
   picker shipped; two starter bounties created; status strip re-checked. Team can test
   Standings, Bounties, Earnings, Data, Goals on August data.
2. **You**: re-enter the five vendor keys locally (Run buttons) and on Render. Names:
   `BLAZE_PARTNER_KEY`, `BLAZE_AUTH_KEY_CORONA`, `BLAZE_AUTH_KEY_ELSINORE`,
   `MEADOW_CONSUMER_KEY`, `MEADOW_CLIENT_KEY_WEST_LA`.
3. **Me, after the keys**: lift the sync pause in render.yaml, push (with your OK), verify the
   first pass on Render reads September from Blaze and Meadow, and that RSS stays flat.
4. **Team QA** on the deployed app with the checklist below; notes back as a list.

## Team checklist

1. Open https://hyperwolf-wm-demo.onrender.com/Hyperwolf%20Bounty.html. Use **Testing as** to
   become a Corona budtender; confirm your own board, your bounties, your earnings.
2. Switch to a manager; switch stores; compare Budtenders vs Drivers boards; open "How this was
   computed" and check a number against the trail.
3. Bounties → create one (brand board or AOV goal); approve; watch it on the budtender seat.
4. Data → Upload one report you own (a September export); confirm the run report and that the
   board updates. Data → Identities: resolve the two Long Beach binds.
5. Earnings → record a payout as manager; confirm idempotency (record twice, one row).
6. Anything that reads wrong: the screen, what it says, what it should say.
