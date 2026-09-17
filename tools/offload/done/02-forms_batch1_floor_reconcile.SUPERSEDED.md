---
repo: /Users/jt/wm-demo
model_hint: gpt-5-codex
max_minutes: 45
files_allowed: qa/battery.py
verify_command: cd /Users/jt/wm-demo && python3 qa/battery.py --check
---

# Goal

`qa/battery.py`'s `EXPECTED_CHECKS` dict is a **floor**, never an equality
(see the file's own comment block right above the dict — read it before
touching anything): a suite must emit at least that many checks, and the
number only ever goes up, with a comment explaining what changed. Tonight's
swarm added or changed a batch of suites (2026-09-16/17) and at least one
entry is already known-stale: `forms_batch1_probe` is recorded as `42` but
was last measured at `48`. When this is done, every 2026-09-16/17 suite's
`EXPECTED_CHECKS` entry matches (or is below, never above) a real, freshly
measured check count, with a comment on each changed line saying what was
added and why the number moved.

# Hard rules

- Never touch any `.env` file.
- No git commands that write — the PM commits after review.
- Only edit `qa/battery.py`, and only the `EXPECTED_CHECKS` dict entries and
  their explanatory comments (plus, if you must, the matching line count in
  a comment elsewhere that references the same number). Do not touch
  `SUITES`, suite ordering, or any suite's own source file.
- **Never lower a number.** If a measured count is LOWER than what's
  recorded, that is a regression to report, not a floor to relax — stop,
  do not edit that entry, and write it up in your report instead.
- Any server you boot to run a suite: scratch DB only, a free port, never
  `wmdemo.sqlite3`. No `pkill -f` — track PIDs, kill only those, every
  server you start gets stopped before you finish.
- Foreground runs, respecting `max_minutes` above in total across every
  suite you measure.

# Steps

1. Read `qa/battery.py`'s docstring and the comment block immediately above
   `EXPECTED_CHECKS` (search for `# --------------------------------------------------- how many checks to expect`)
   so you understand the floor-not-equality contract before changing a
   single number.
2. **forms_batch1_probe (concrete, do this one first):**
   - Current entry: `"forms_batch1_probe": 42,` — find it in `EXPECTED_CHECKS`
     (grep for `forms_batch1_probe`).
   - Run it standalone: `cd /Users/jt/wm-demo && python3 qa/forms_batch1_probe.py`
     — read its own `run_all()` output (`qa/forms_batch1_probe.py`, bottom of
     file) for the printed `Total:` line. Also run it the way the battery
     runs it — `python3 qa/battery.py --only=forms_batch1_probe` — and use
     whatever `checks` column the battery itself prints for this suite as
     the authoritative number (the battery's own counting method, not the
     probe's own printed total, is what `EXPECTED_CHECKS` must match — check
     the harness code if the two numbers disagree and say which one you used
     and why).
   - If it measures 48 (as reported), set the entry to `48` with a one-line
     comment citing which fields/forms account for the increase since the
     42 baseline. If it measures something else, use the real number instead
     — do not assume 48 is correct without measuring.
3. **The rest of tonight's suites — sweep for the same drift.** These were
   added or changed by tonight's swarm per this session's own scratchpad
   notes (`w4-battery-progress.md`): `authz_probe`, `sessions_probe`,
   `server_integration_probe`, `policy_batch1_probe`, `policy_batch2_probe`,
   `policy_batch3_probe`, `promo_rules_probe`, `promo_rules_export_probe`,
   `restock_guard_probe`, `db_backup_probe`, `restock_engine_probe`,
   `restock_api_probe`, `promo_probe`, `promo_registry_probe`,
   `engage_api_probe`.
   For each: find its current `EXPECTED_CHECKS` entry (some may not have
   one yet — those report as `unmeasured`, which is also a gap to fix), then
   measure it with `python3 qa/battery.py --only=<suite_name>` against a
   throwaway scratch DB/port (follow whatever env vars that suite's own
   module docstring says it needs — read the docstring before running it;
   several suites need specific env vars to run standalone). Compare
   measured `checks` to the recorded floor and raise-only as in step 2.
4. **Two suites need multi-server orchestration you should NOT attempt
   inside this time-capped run — skip and report instead, do not guess:**
   `security_gate_probe` (needs two already-running servers, one strict one
   warn mode, sharing one scratch DB — see the suite's own module docstring
   for the exact boot commands) and `hr_read_probe` (needs an HR Airtable
   stub server on a specific port, `HR_STUB_BASE` env var forwarded — see
   `w5-hardening-progress.md`/`w4-battery-progress.md` for what that session
   already learned about it). List these two in your report as "not
   measured this pass, needs a dedicated multi-server session" rather than
   spending your time budget standing up that harness.
5. For every entry you change, leave a comment in the same style as the
   existing ones (see e.g. the `menu_publish_contract_probe` and
   `purchase_history_probe` entries near the top of the dict for the house
   style: which check ids matter and why, not just a bare number).

# Verify

```
cd /Users/jt/wm-demo && python3 qa/battery.py --check
```
This is a preflight-only run (no suites executed) — success means it
reports no new drift/FATAL introduced by your edit and, critically, that
`bash -n`-equivalent sanity holds for the file: `python3 -c "import ast; ast.parse(open('qa/battery.py').read())"`
must succeed (valid Python syntax).

Additionally, for `forms_batch1_probe` specifically, re-run
`python3 qa/battery.py --only=forms_batch1_probe` and confirm it now
reports `checks >= EXPECTED_CHECKS["forms_batch1_probe"]` (i.e., no red from
your own edit).

# Report format

Write `qa/REPORT-02-forms_batch1_floor_reconcile.md` with a table: suite
name | old floor | measured count | new floor | note. Call out explicitly:
(a) any suite where measured < recorded (do not touch, flag as a
regression), (b) the two skipped multi-server suites, (c) any suite you
could not measure and why.
