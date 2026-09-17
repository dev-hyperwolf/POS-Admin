---
repo: /Users/jt/wm-demo
model_hint: gpt-5-codex
max_minutes: 30
files_allowed: qa/security_gate_probe.py
verify_command: cd /Users/jt/wm-demo && python3 qa/security_gate_probe.py
---

# Goal

`qa/security_gate_probe.py` walks every registered route and asserts that an
extra/unexpected key in a valid POST body gets a 400 (`SG-input-overpost-*`,
around line 485-491). Seven of these currently FAIL, and a prior session
(`w5-hardening-progress.md` in this repo's own scratch history) already
root-caused and documented all seven as genuine, deliberate architecture —
not bugs, not oversights. When this is done, those seven checks report
`SKIP` with the documented reason (using the file's own existing `skip()`
mechanism — see the `SG-auth-nocred-*` checks around line 397-401 for the
house pattern of "this is genuinely fine by design, here's why"), and every
*other* `SG-input-overpost-*` check still asserts exactly what it does
today, unweakened. Zero net change to any route's actual behavior — this is
a test-expectations change only.

# Hard rules

- Never touch any `.env` file.
- No git commands that write — the PM commits after review.
- Only edit `qa/security_gate_probe.py`. Do not touch `wmdemo/server.py`,
  `wmdemo/route_policy.py`, `wmdemo/authz.py`, `wmdemo/forms_api.py`,
  `wmdemo/docs_api.py`, or `wmdemo/review_api.py` — none of those are in
  scope, and "fixing" any of them to make a check go green instead of
  documenting it is explicitly the wrong move here (that's real
  architecture work for a separate pass, already flagged in this repo's
  scratch notes).
- Do NOT touch, weaken, or reclassify any `SG-input-overpost-*` check other
  than the seven named below. If you find an eighth you believe is the same
  shape, do not touch it — report it instead.
- Any server you boot to run this probe: scratch DB, throwaway ports, never
  `wmdemo.sqlite3`. No `pkill -f`.
- Foreground run, `max_minutes` cap above.

# The seven items (exact `sg` ids, derived mechanically by
`_sg_id(method, pattern)` from the route pattern — see that function around
line 271 if you need to confirm an id)

1. `SG-input-overpost-post-api-brands-wild` (`POST /api/brands/*`) and
   `SG-input-overpost-post-api-mapping-wild` (`POST /api/mapping/*`) — these
   two wildcard families have **no dedicated dispatcher function** anywhere
   in `wmdemo/server.py` (unlike `shells`/`incentives`/`engage`/`contracts`/
   `city`/`taxonomy`, which each have one). The literal wildcard path falls
   straight to `_dispatch_POST`'s own terminal
   `else: self._send(404, {"error": "not found"})` — the dispatch table's
   own fallback, which is explicitly off-limits to edit for this pass.
   Reason string: "no dedicated dispatcher for this wildcard family — the
   literal path 404s at _dispatch_POST's own terminal fallback, which is
   off-limits to this probe; gate-layering, by design."
2. `SG-input-overpost-post-api-forms`, `-forms-wild`, `-docs-wild`,
   `-review-wild` — `forms_api.py`/`docs_api.py`/`review_api.py` each
   enforce their OWN legacy gate (`x-hw-write-token` / `x-hw-review-pin`)
   UNCONDITIONALLY, before ever reaching body dispatch. This probe's
   "authorized" request for a `key_or_session`/`none` route presents a
   scoped `x-api-key` (or nothing, for review's public "none" auth), never
   that specific legacy header — so these 403 before input validation is
   ever reached. Reason string: "forms_api.py/docs_api.py/review_api.py
   enforce their own legacy write-token/PIN gate before body dispatch —
   this probe's scoped key never satisfies it, so overpost validation is
   never reached; gate-layering, by design (route_policy's newer scope auth
   and these older per-module gates don't yet know about each other — a
   real architecture gap, tracked separately, not a probe bug)."
3. `SG-input-overpost-post-api-identity-match` (`POST /api/identity/match`)
   — `identity_api.match_order()` deliberately accepts a WHOLE WM-shaped
   order object and reads only `order.customer`/`shippingAddress`/
   `deliveryAddress`; every other top-level order field (`id`, `items`,
   `totals`, ...) is real production noise it ignores by design. A
   top-level `reject_unknown_keys` would 400 every real WM order payload.
   Reason string: "match_order() deliberately accepts a whole WM order
   object and reads only three fields off it; every other top-level key is
   real production noise it ignores by design — a strict-unknown-keys
   check here would 400 every real order payload; gate-layering, by
   design."

Do NOT include `SG-headers-post-api-reconcile` (a slow-route header check,
not an overpost check, and not one of the seven) — leave it exactly as is.

# Steps

1. Read `qa/security_gate_probe.py` end to end once, focusing on: the
   `skip()` function (around line 86) and its existing callers (the
   `SG-auth-nocred-*`/`SG-auth-actor-header-alone-*`/`SG-auth-wrongscope-*`
   skips for `auth == "none"` routes, ~lines 397-401) for the house style of
   "this is fine by design, here's why" — and the overpost check itself
   (`record(st_ == 400, "SG-input-overpost-%s" % sg, ...)`, ~line 485-491)
   inside the `for r in ROUTES:` loop.
2. Add a small, clearly-commented mapping near the top of the per-route loop
   (or right above the overpost check — your call on placement, keep it
   readable) from `sg` id to the exact reason string, covering the seven ids
   above. Something in the shape of:
   ```python
   _OVERPOST_GATE_LAYERING_EXCEPTIONS = {
       "post-api-brands-wild": "...",
       "post-api-mapping-wild": "...",
       "post-api-forms": "...",
       "post-api-forms-wild": "...",
       "post-api-docs-wild": "...",
       "post-api-review-wild": "...",
       "post-api-identity-match": "...",
   }
   ```
   (Use the exact reason text given above, or your own wording that
   preserves the same meaning — cite the real cause, not a vague "known
   issue".)
3. In the overpost check block, check membership in that mapping BEFORE the
   `record(...)` call: if `sg` is in the mapping, call
   `skip("SG-input-overpost-%s" % sg, <reason>)` instead of running the
   `record(...)` check at all. Every other route's overpost check runs
   exactly as before, unchanged.
4. Run the probe (two servers, see its own module docstring for the exact
   boot commands and env vars) and confirm: the seven ids now report as
   skips (with your reason text visible in the output), and the overall
   FAIL count drops by exactly seven (or fewer, if some of the seven were
   already passing for an unrelated reason you should investigate and
   report rather than silently skip).

# Verify

Boot the two servers per the module docstring at the top of
`qa/security_gate_probe.py` (strict on one port, warn on the other, same
scratch DB), then:
```
cd /Users/jt/wm-demo && python3 qa/security_gate_probe.py
```
Success: the seven named ids print as `SKIP` with your reason text, no
other `SG-*` id's pass/fail status changed, and total FAIL count is exactly
7 lower than the pre-change run (paste both counts in your report).

# Report format

Write `qa/REPORT-03-security_gate_overpost_exceptions.md`: before/after FAIL
count, the exact diff shape, and confirmation (with pasted output lines)
that all seven now skip with the stated reasons and nothing else moved.
