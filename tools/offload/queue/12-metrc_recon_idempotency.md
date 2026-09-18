---
repo: /Users/jt/wm-demo
model_hint: gpt-5-codex
max_minutes: 45
files_allowed: wmdemo/metrc/recon.py wmdemo/metrc/jobs.py qa/metrc_probe.py qa/battery.py
verify_command: cd /Users/jt/wm-demo && python3 qa/metrc_probe.py
---

# Goal

`wmdemo/metrc/recon.py::run_recon_for_day()` calls `_record_variance()`
(line 164-181) unconditionally for every mismatch it finds -- there is no
natural-key uniqueness anywhere on `metrc_recon_variances` (its schema, line
48-66, has only an `id TEXT PRIMARY KEY` -- a random `mrv_<hex>` from
`_new_id()`). Re-running `run_recon_for_day()` for the same
licence/business_day therefore creates a brand-new duplicate exception row
every time, instead of recognizing "this is the same finding I already
raised." Separately, `pull_packages()` (line 103-134) has no wall-clock
budget: it fully drains `adapter_read.packages_active()` +
`packages_inactive()` (each already page-capped at `max_pages=50` inside
`adapter_read.py`, which you are NOT touching) and then upserts every row,
with no cap on how long that whole pass may take for one store. When this
is done: (1) re-running recon for the same licence+day is idempotent --
either no new row for an unchanged finding, or the old one is superseded
(status-linked) rather than duplicated; and (2) `pull_packages()` accepts a
per-store wall-clock cap (setting, default 60s) and returns whether it had
to stop early (`partial: true`), with `wmdemo/metrc/jobs.py`'s job output
reflecting that honestly (CLAUDE.md §4.7: "watch the output, not just the
exception" -- a job that silently pulls less than it should and never says
so is exactly that failure mode).

# Read first

1. `wmdemo/metrc/recon.py` end to end -- particularly `_record_variance()`
   (164-181), `_severity_for_delta()` (183-188), and `run_recon_for_day()`
   (266-361, especially the `for tag, local_qty in local_by_tag.items():`
   loop at 297 and the `for read in packages:` loop at 337) -- and its own
   module docstring (top of file) for the "watch the output" framing this
   brief's idempotency fix must preserve.
2. `wmdemo/metrc/jobs.py` end to end (77 lines) -- specifically
   `_job_metrc_package_pull()` (52-70): `count = ctx.retry(_pull, attempts=3,
   backoff=1.0)` then `per_store[store_id] = {"packages": count}` and
   `total += count` treat `pull_packages()`'s return value as a bare `int`.
   If you change that return shape (see step 3 below), this function's
   handling of it must change in the same commit -- an untested return-shape
   change here would silently break `total`/`per_store` math.
3. `qa/metrc_probe.py`'s section D (recon, ids `METRC-D1`..`METRC-D14`,
   lines ~497-566) and section E (jobs, `METRC-E1`..`METRC-E5`, lines
   ~568-593) -- these are the exact call patterns and check-id numbering
   style (`METRC-D<n>`, `METRC-E<n>`) your new checks continue.
4. `qa/battery.py`: `"metrc_probe": 92` (line 5734) with the comment right
   below it saying "88/88 measured, 2026-09-17" -- **these two numbers
   already disagree with each other** (92 vs 88), a pre-existing drift this
   brief did not create. Before adding anything, measure the CURRENT real
   count (`python3 qa/battery.py --only=metrc_probe`, read whatever `checks`
   column it prints) and use THAT as your baseline, not either stale number
   -- say in your report which of {92, 88, something else} you actually
   measured before you started.

# Hard rules

- Never read, write, copy, move, or delete any `.env` file, anywhere.
- No git commands that write. Read-only git is fine. The PM commits after
  review, explicit paths only, never `git add -A`/`.`.
- Touch only the four files in `files_allowed`. In `qa/battery.py`, touch
  ONLY the `"metrc_probe"` `EXPECTED_CHECKS` entry, its explanatory comment,
  and `TOTAL_CHECK_FLOOR`'s own number+comment (matching the file's existing
  "raise the floor, comment why, `was: TOTAL_CHECK_FLOOR = ...`" convention
  visible right above the current value) -- do not touch `SUITES`, any other
  suite's `EXPECTED_CHECKS` entry, or suite ordering.
- Do not touch `wmdemo/metrc/adapter_read.py`, `api.py`, `exceptions.py`,
  `config.py`, or `ledger.py` -- this brief's wall-clock cap lives inside
  `pull_packages()` itself (which you own), never inside `adapter_read.py`'s
  own pagination (`_get_paginated`'s `max_pages` DoS guard already exists
  there and is out of scope).
- `wmdemo/metrc/` is a READ-ONLY-to-Metrc module by design (its own
  `adapter_read.py` docstring: every call is hardcoded `GET`). Nothing you
  add may introduce a write verb to Metrc, directly or via a new helper.
- Never lower `EXPECTED_CHECKS["metrc_probe"]` below whatever you actually
  measure standalone before adding new checks (see "Read first" #4) -- only
  raise it, by exactly the number of new checks you add, with a comment
  explaining the increase (matching e.g. the `sale_lines_probe` entry's "49
  -> 77 (+28, ...)" style right below it in the same dict).
- Any server/DB you boot for `qa/metrc_probe.py` or the battery: follow the
  probe's own existing scratch-DB/stub pattern (it already boots its own
  fixture server against a scratch DB and a Metrc loopback stub -- never a
  real Metrc endpoint, never `wmdemo.sqlite3`). No `pkill -f`.
- Foreground run, `max_minutes` cap above.

# Steps

1. **Idempotency.** Give `metrc_recon_variances` a natural key: (licence_number,
   business_day, package_tag, kind) -- add a real uniqueness constraint at
   the schema level (`CREATE UNIQUE INDEX IF NOT EXISTS
   idx_metrc_recon_natural_key ON metrc_recon_variances(licence_number,
   business_day, package_tag, kind)` -- `package_tag` can be NULL for some
   kinds; SQLite treats NULLs as distinct for uniqueness purposes, which is
   fine here since every current variance kind that omits `package_tag`
   doesn't exist yet). In `_record_variance()`, before inserting, look up
   whether an OPEN row already exists for that natural key with the SAME
   `local_quantity`/`metrc_quantity`/`delta`/`detail` (an unchanged finding):
   if so, do nothing (no new row, no re-open of a resolved/acknowledged one)
   and return the existing row's id. If a row exists for that key but the
   numbers moved (the variance got worse/better), SUPERSEDE it: leave the
   old row's status alone if it's already `acknowledged`/`resolved` (history
   is real, don't rewrite it), but if it's still `open`, update it in place
   with the new numbers/detail/`detected_at` rather than inserting a
   sibling -- one open row per natural key, ever. If no row exists, insert
   as today. Keep the existing `_scope_rows()` fail-closed store-scoping in
   `wmdemo/metrc/api.py` completely untouched -- your change is entirely
   about not duplicating rows `run_recon_for_day()` itself creates, not
   about read-side scoping.
2. **Wall-clock cap.** Add `wmdemo/metrc/config.py`... **no** -- `config.py`
   is not in `files_allowed`; instead read the cap directly from
   `os.environ.get("HW_METRC_PULL_CAP_S")` inline in `recon.py` (default
   `60.0`, same "read lazily, at call time" posture `adapter_read.py`'s own
   docstring describes for its key values -- don't cache it at import time).
   Change `pull_packages(store_id, licence_number)` to
   `pull_packages(store_id, licence_number, wall_clock_cap_s=None)`, resolve
   the default inside the function body, and track `time.monotonic()` from
   entry. Check elapsed time: (a) after fetching `packages_active` and
   before fetching `packages_inactive` -- skip the second fetch and mark
   partial if already over cap; (b) inside the `for raw in raw_rows:` upsert
   loop -- break early and mark partial if a check every N rows (pick a
   reasonable N, e.g. every 25 rows, so you're not calling
   `time.monotonic()` on every single iteration for no reason) crosses the
   cap. Change the return value from a bare `int` to
   `{"written": <int>, "partial": <bool>}`.
3. **Propagate the new return shape.** In `wmdemo/metrc/jobs.py`'s
   `_job_metrc_package_pull()`: unpack `result = ctx.retry(_pull, ...)`,
   `count = result["written"]`, `partial = result.get("partial", False)`;
   `per_store[store_id] = {"packages": count, "partial": partial}`; `total
   += count`. Also add a top-level `"any_partial": any(v.get("partial") for
   v in per_store.values() if isinstance(v, dict))` to the returned dict so
   an operator reading `GET /api/jobs` sees at a glance whether ANY store's
   pull was capped, not just each one's own row.
4. **Probe coverage (≥ 6 new checks, `METRC-D15` onward, continuing the
   existing numbering from `METRC-D14`):** re-running `run_recon_for_day()`
   for the same licence/day with no new data creates ZERO new variance rows
   (idempotent no-op); re-running it after a real number changed
   (`stub_set_quantity` to a different value, same tag/day) supersedes the
   existing open row in place rather than adding a second one (assert
   `list_variances()` count is unchanged and the row's own `detail`/
   `metrc_quantity` reflect the new number); an already-`acknowledged` or
   `resolved` variance for that natural key is NOT silently reopened or
   overwritten when recon re-runs with the same finding (assert its status
   stays put). For the cap: `pull_packages(..., wall_clock_cap_s=0)` (an
   impossible-to-meet budget) returns `partial: True` and `written` less
   than the full fixture count (or `0`, if it cuts off before the first
   store's rows); `pull_packages(..., wall_clock_cap_s=60)` against the tiny
   test fixture completes fully with `partial: False` (proving the cap
   doesn't interfere with the normal case). Update every existing call site
   in `qa/metrc_probe.py` that currently does `count =
   recon.pull_packages(...)` (there are three -- `METRC-D1` at line ~498,
   plus two more with no assigned variable at lines ~522 and ~535) to match
   the new dict return shape (`METRC-D1`'s own assertion, currently `count
   == 2`, becomes `result["written"] == 2` or equivalent -- do not weaken
   what it actually checks, just adapt the shape).
5. Run `python3 qa/metrc_probe.py` until green. Update
   `EXPECTED_CHECKS["metrc_probe"]` in `qa/battery.py` to your new measured
   total (baseline from "Read first" #4, plus however many you added) with
   a comment explaining the increase and resolving the 92-vs-88 discrepancy
   explicitly (say which number was actually real). Raise
   `TOTAL_CHECK_FLOOR` by the same delta, following the file's own `was:
   TOTAL_CHECK_FLOOR = N # +M, ...` convention.
6. Run `python3 qa/battery.py --only=metrc_probe,authz_probe,sessions_probe,security_gate_probe`
   against a scratch DB (metrc_probe self-boots; the other three need their
   own boot per their module docstrings) to confirm nothing outside
   `metrc_probe` regressed.

# Verify

```
cd /Users/jt/wm-demo && python3 qa/metrc_probe.py
```
Success: prints a summary with `Failed: 0` and a `Total:` that is your new,
real, itemized count (old measured baseline + at least 6). Additionally:
```
cd /Users/jt/wm-demo && python3 qa/battery.py --only=metrc_probe
```
must report `checks >= EXPECTED_CHECKS["metrc_probe"]` (no red from your own
edit), and the three regression suites named in step 6 must show no new
failures versus their own pre-existing baseline (paste their pass/fail
counts; note any PRE-EXISTING failure by id so the PM can tell old-red from
new-red).

# Security notes

The idempotency fix must not weaken `_scope_rows()`'s fail-closed store
scoping (`wmdemo/metrc/api.py`, out of scope for edits, but re-read it
before you finish to confirm your natural-key lookup inside `recon.py`
doesn't accidentally match/supersede a variance belonging to a DIFFERENT
licence -- the natural key already includes `licence_number`, so this
should be structurally impossible, but say in your report that you checked).
The wall-clock cap must fail toward doing LESS work, never toward silently
skipping the idempotency check or writing incomplete/inconsistent rows --
a capped `pull_packages()` that stops mid-upsert must leave every row it did
write fully formed, never a half-written record.

# What NOT to do

- Do not touch `adapter_read.py`'s own `max_pages` pagination cap or its
  `_request()`/backoff logic.
- Do not touch `wmdemo/metrc/api.py`'s `_scope_rows()` or any HTTP dispatch
  branch.
- Do not add a write verb (POST/PUT/PATCH/DELETE) anywhere in
  `wmdemo/metrc/`.
- Do not touch any `qa/battery.py` dict entry other than `"metrc_probe"` and
  `TOTAL_CHECK_FLOOR`.
- Do not call a real Metrc endpoint -- the existing stub
  (`qa/metrc_stub.py`) is what every fixture in this probe already uses.

# Report format

Write `qa/REPORT-12-metrc_recon_idempotency.md` covering:
- the measured baseline check count you found for `metrc_probe` before
  adding anything, and how it reconciles with the 92-vs-88 discrepancy
- the natural-key + supersede design (schema change, `_record_variance()`
  diff shape)
- the wall-clock cap design (`pull_packages()`'s new signature/return shape,
  and the `jobs.py` propagation)
- every new check id added and what each proves
- the probe's final output, the battery `--only=metrc_probe` output, and the
  three-suite regression check output from step 6

# Log entry

Append "## 12 -- Metrc recon idempotency + pull wall-clock cap -- COMPLETE"
(or BLOCKED) to `POS-Admin/docs/CODEX-HANDOFF-LOG.md`, matching the existing
entries' style. Commit with explicit paths, never push.
