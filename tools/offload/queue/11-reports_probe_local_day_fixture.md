---
repo: /Users/jt/wm-demo
model_hint: gpt-5-codex
max_minutes: 30
files_allowed: qa/reports_probe.py
verify_command: cd /Users/jt/wm-demo && python3 qa/reports_probe.py
---

# Goal

`qa/reports_probe.py`'s `seed_fixture()` (around line 316-325) computes the
fixture's "yesterday" bucket with `datetime.datetime.utcnow() -
timedelta(days=1)`, then writes that naive-UTC date string directly into
`local_day` -- but the server (`wmdemo/incentives/ledger.py`'s
`local_parts()`, line 225-228) always derives `local_day` from the store's
own IANA zone, never UTC. Between roughly 4pm and midnight Pacific, UTC's
calendar date has already rolled over to the NEXT day relative to Pacific,
so `utcnow() - 1 day` lands on the SAME calendar date as "today" (Pacific)
instead of the day before it -- collapsing the fixture's two days into one
`local_day` bucket and failing RP-17/18/19/20/58 (which all assert
day-specific numbers) purely because of what time it happened to run. When
this is done, the fixture computes its "yesterday" label the same way the
server does -- in the store's own zone -- and the five checks pass
regardless of what time of day the probe runs.

# Confirm the root cause yourself before changing anything

1. Read `wmdemo/incentives/ledger.py`'s `local_parts(store_id, sold_at_iso)`
   (line 225-228: `parse_iso_utc(sold_at_iso).astimezone(_zone(store_id))`,
   returns `(local_day, local_hour)`) and `_zone(store_id)` (line 191-204:
   loads a real `zoneinfo.ZoneInfo` for the store's configured tz, refuses
   rather than silently defaulting to UTC).
2. Read `qa/reports_probe.py`'s `seed_fixture()` end to end (line 252-329).
   The bug is specifically the `yesterday = (datetime.datetime.utcnow() -
   datetime.timedelta(days=1))` line (~316) and the two lines right after it
   (`y_day = yesterday.strftime("%Y-%m-%d")`, `y_iso =
   yesterday.strftime("%Y-%m-%dT%H:%M:%SZ")`) -- `y_day` is what gets
   written into `local_day` for every "day 2" row (`inc_txns`/`inc_lines`),
   and it is also the same value `seed_fixture()` returns as `y_day` /
   `yesterday_s` for the report query's `since` param and for
   `rows.get(yesterday_s)` lookups in the test body (line ~424-432). The
   `today_local` half of the pair (fetched by a real `SELECT local_day FROM
   inc_txns WHERE txn_id='rp-c-b-d1-1'` at line ~322) is NOT the bug -- it
   reads back a value the server itself already computed correctly through
   the real `/api/pos/sale` POST path, so leave that read as-is.
3. Confirm the failure window mechanically, don't just trust this brief's
   arithmetic: pick a time between 4pm and midnight Pacific (any recent
   date), compute what `datetime.datetime.utcnow()` would have returned at
   that instant, and show that `(utcnow - 1 day).strftime("%Y-%m-%d")`
   equals the SAME date as the real Pacific calendar day at that instant
   (not the day before it). Put this arithmetic in your report.

# Hard rules

- Never read, write, copy, move, or delete any `.env` file, anywhere.
- No git commands that write (`add`, `commit`, `push`, `checkout`, `stash`,
  `reset`, `restore`). Read-only git is fine. The PM commits after review,
  explicit paths only, never `git add -A`/`.`.
- Touch only `qa/reports_probe.py`. Do not touch
  `wmdemo/incentives/ledger.py` or any other server module -- the fix
  belongs entirely in the fixture, never in the server (the server's
  `local_parts()` is already correct and is what the fixture must match).
- Any server you boot to run this probe: its own scratch DB (this probe
  already manages its own DB path/port, per its own module docstring --
  follow that, never point at `wmdemo.sqlite3`). No `pkill -f`.
- Never lower `EXPECTED_CHECKS["reports_probe"]` (currently `71` in
  `qa/battery.py`, which you are NOT editing) or weaken/remove RP-17, 18,
  19, 20, or 58 to make them pass -- the fix is making the fixture's day
  labels correct, not loosening what they assert.
- Foreground run, `max_minutes` cap above.

# Steps

1. Do the root-cause confirmation above first.
2. Fix `seed_fixture()`: replace the naive
   `datetime.datetime.utcnow() - datetime.timedelta(days=1)` local-day
   derivation with a store-zone-correct one. The cleanest fix re-uses the
   server's own helper instead of re-implementing zone math: keep computing
   the UTC instant `yesterday_utc = datetime.datetime.utcnow() -
   datetime.timedelta(days=1)` (that instant itself is fine -- it's still
   really "about 24 hours ago" for `sold_at`/`created_at` purposes), format
   it as the UTC iso string for `sold_at`/`created_at` as before, but derive
   `y_day` by running that iso string through
   `wmdemo.incentives.ledger.local_parts(CORONA, y_iso)[0]` instead of
   `yesterday.strftime("%Y-%m-%d")` -- the same function the server itself
   uses to turn a UTC instant into `(local_day, local_hour)` for the
   `CORONA` store. Import whatever this file doesn't already import to call
   it (check the top of `qa/reports_probe.py` for its existing imports of
   `wmdemo.incentives` modules -- match that style, e.g. `from
   wmdemo.incentives import ledger as inc_ledger` if a similar alias isn't
   already in scope).
3. Double check nothing else in `seed_fixture()`/`seed_tax_fixture()`
   independently recomputes a day label the same naive way (grep for
   `utcnow()` in the file -- lines ~297, ~338, ~723-725, ~765, ~773 are the
   other hits; read each one's surrounding context and fix it the same way
   ONLY if it is actually deriving a `local_day`-equivalent label that later
   gets compared against server-derived data -- several of these (e.g. the
   promo-usage `created_at`/`consumed_at` timestamp at line ~297, or the
   `perf_since`/`perf_until` range bounds around line ~723) are plain
   timestamps or query-range bounds, not local-day labels, and do NOT need
   this fix; say in your report which ones you left alone and why).
4. Document the bug class in the probe's own module docstring (top of file,
   the "WHAT THIS COVERS" section) -- a one-paragraph note that a fixture
   simulating a second calendar day must derive that day's label in the
   TARGET STORE's zone via `local_parts()`, never via naive UTC arithmetic,
   because the two can disagree for several hours a day depending on the
   store's UTC offset and DST.
5. Run the probe (see Verify) at least once normally. If your environment
   lets you fake the clock or set `TZ` to make the probe's OWN process
   believe it's currently 4pm-midnight Pacific (check whether
   `qa/reports_probe.py` or its harness supports a fake-clock override
   before assuming one exists -- if it doesn't, say so in your report rather
   than adding one, this brief does not ask you to build a clock-faking
   feature), run it that way too and confirm RP-17/18/19/20/58 still pass.

# Verify

```
cd /Users/jt/wm-demo && python3 qa/reports_probe.py
```
Success: prints `RP-17`, `RP-18`, `RP-19`, `RP-20`, and `RP-58` all `PASS`
(grep the output for each id), the overall fail count is unchanged or lower
than before your fix (should be exactly the same 71-check total, all
passing, unless the environment already had an unrelated pre-existing
failure -- note any pre-existing failure by id explicitly), and running it
a second time back-to-back produces the identical result (proves the fix
isn't itself time-of-day-dependent in some new way).

# Security notes

None -- this is a QA fixture correcting its own day-labeling math to match
the server's real (already-correct) `local_parts()` behavior. No production
code, auth, or money path changes.

# What NOT to do

- Do not touch `wmdemo/incentives/ledger.py` or any non-test file.
- Do not lower `EXPECTED_CHECKS["reports_probe"]` or touch `qa/battery.py`
  at all -- out of scope for this brief.
- Do not "fix" RP-17/18/19/20/58's asserted numbers instead of the fixture's
  day-label math -- the numbers are correct for the intended 2-distinct-day
  fixture; the bug is that the fixture sometimes fails to produce two
  distinct days at all.
- Do not add a general-purpose clock-faking capability to the probe harness
  if one doesn't already exist -- report that as a gap instead.

# Report format

Write `qa/REPORT-11-reports_probe_local_day_fixture.md` covering:
- the confirmed root-cause arithmetic (a concrete UTC instant between
  4pm-midnight Pacific where the old code collapses two days into one)
- the exact fix (diff shape: which lines changed, and why `local_parts()`
  reuse is correct here)
- which other `utcnow()` call sites you inspected and left alone, and why
- the probe's final output (RP-17/18/19/20/58 lines, and the overall
  Failed: N summary line)
- the module-docstring note you added

# Log entry

Append "## 11 -- reports_probe local-day fixture -- COMPLETE" (or BLOCKED)
to `POS-Admin/docs/CODEX-HANDOFF-LOG.md`, matching the style of its existing
entries (Files, what/why, Checks with real output, Limits, owner questions
as multiple choice if any). Commit with explicit paths, never push.
