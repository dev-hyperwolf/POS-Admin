---
repo: /Users/jt/wm-demo
model_hint: gpt-5-codex
max_minutes: 20
files_allowed: qa/server_integration_probe.py
verify_command: cd /Users/jt/wm-demo && python3 qa/server_integration_probe.py
---

# Goal

`qa/server_integration_probe.py` checks SI-1, SI-2, and SI-9 assert against
`/api/catalog/import` on the premise that it is an **unregistered** write
path (so hitting it exercises the legacy static-write-token gate in
isolation, which is what this probe's SI-1..SI-9 block is actually for).
That premise is now false: `wmdemo/policy_batch2.py:121` registers
`POST /api/catalog/import` under `route_policy` with `_SESSION_OR_KEY` auth.
When this is done, SI-1/SI-2/SI-9 correctly describe and assert real,
current server behavior — no route_policy registration is left undocumented
in this probe's own comments, and the file runs green.

# Hard rules

- Never touch any `.env` file.
- No git commands that write — the PM commits after review.
- Only edit `qa/server_integration_probe.py`. If you decide a fix needs a
  second file, stop and say so in your report instead of touching it.
- Never lower a check count or weaken what SI-1/SI-2/SI-9 actually assert
  to make them pass — the fix is making the assertion match reality, not
  making reality look passing.
- Any server you boot for testing: scratch DB only (this probe already uses
  `qa/_dbsafe.claim_scratch`, follow its existing pattern), never
  `wmdemo.sqlite3`. No `pkill -f` — track PIDs and kill only those.
- Foreground run, `max_minutes` cap above.

# Steps

1. Read `qa/server_integration_probe.py`'s module docstring (top of file) and
   the SI-1..SI-9 section, roughly lines 200-300. Note in particular:
   - Line 222: `UNREG_WRITE_PATH = "/api/catalog/import"` and the comment
     directly above it explaining why an unregistered path is needed for
     this block.
   - Line 230: SI-1 (`no-credential-403`)
   - Line 235: SI-2 (`wrong-token-403`)
   - Line 285: SI-9 (`legacy-off-static-token-403`, on Server B)
   These exist to prove the **legacy** write-token gate (the raw
   `supplied != config.WRITE_TOKEN` compare in `_dispatch_POST`, and its
   `WM_LEGACY_WRITE_TOKEN=0` kill switch) still works correctly on a path
   `route_policy` does not intercept first. If `route_policy` now intercepts
   the path first, these checks are no longer testing what their own
   docstring says they test — even if they happen to still return the same
   HTTP status by coincidence.
2. Confirm the registration: `grep -n 'catalog/import' wmdemo/policy_batch2.py`
   — it registers `POST /api/catalog/import` under `_SESSION_OR_KEY`
   (session_or_key auth mode) at line 121.
3. Find a write path that is genuinely still unregistered in
   `wmdemo/route_policy.py`'s live registry, to restore the original test
   intent (isolating the legacy gate). To check what's registered:
   `grep -n '_rp.register' wmdemo/policy_batch1.py wmdemo/policy_batch2.py wmdemo/policy_batch3.py`
   and cross-reference against the POST routes `wmdemo/server.py`'s
   `_dispatch_POST` actually serves (grep for `elif self.path ==` and
   `startswith` branches in `_dispatch_POST`). You are looking for a real,
   already-existing bare-body-accepting write route that appears in neither
   batch1/2/3's registration calls.
   - If you find one: swap `UNREG_WRITE_PATH` to that path, update the
     surrounding comment to name the new path and explain briefly why it
     (not `/api/catalog/import` any more) is the unregistered example, and
     leave the SI-1/SI-2/SI-9 identifiers unchanged.
   - If every write route is now registered (no candidate exists): do NOT
     invent a fake path. Instead, rewrite SI-1/SI-2/SI-9 to test
     `/api/catalog/import` against what `route_policy`'s own
     `_SESSION_OR_KEY` gate actually does now (no credential → 401 from
     route_policy, not 403 from the legacy gate; wrong token → whatever
     route_policy's key/session check actually returns) — verified by
     reading `route_policy.py`'s enforcement code and by hitting the live
     Server A/B with real requests, never guessed. Update the docstring's
     SI-1..SI-9 description to say plainly that the legacy-gate-in-isolation
     scenario no longer exists for this path, and why.
4. Whichever path you take, run the probe (see Verify) until SI-1, SI-2, and
   SI-9 are real, passing, and their `record(...)` detail strings describe
   what actually happened — not the old assumption.

# Verify

```
cd /Users/jt/wm-demo && python3 qa/server_integration_probe.py
```
Success: the run prints `PASS` for SI-1, SI-2, and SI-9 specifically (grep
the output for those three ids), and the overall exit code is 0 (or, if
pre-existing unrelated SI checks were already failing before your change,
the count of failures does not increase — note any pre-existing failure by
id in your report so the PM can tell old-red from new-red).

# Report format

Write `qa/REPORT-01-server_integration_probe.md` covering:
- which path you took (swap to a new unregistered route, or rewrite the
  three checks against `/api/catalog/import`'s real current behavior) and
  why
- the exact diff shape (which lines changed)
- the verify command's actual output (paste the SI-1/SI-2/SI-9 lines)
- any other SI-* check whose result changed as a side effect, and why
