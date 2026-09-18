---
repo: /Users/jt/POS-Admin
model_hint: gpt-5-codex
max_minutes: 35
files_allowed: shared/hw-restock.js pos/screen-floor-restock.jsx test/hw-restock.test.mjs
verify_command: cd /Users/jt/POS-Admin && node --test test/hw-restock.test.mjs
---

# Goal

`pos/screen-floor-restock.jsx`'s `OutcomePanel` (search for `function
OutcomePanel`) shows every failed apply the same way: `<window.ErrorState
title="Move to floor did not apply" body={result.error || 'The server
refused this apply.'} />`. When the server refuses with 409 `conflict`
(`wmdemo/inventory_api.py::_restock_apply`, via `RestockStale` in
`wmdemo/inventory.py`), that generic text is all a picker sees, whether
their own earlier request already went through or a different window
collided with theirs. When this is done, a 409 from apply() is classified
client-side into one of two distinct, clearer messages, the panel shows a
"Refresh" action that re-loads the current preview/plan state, and this is
proven by a client-side (`shared/hw-restock.js`) unit test -- no server
change.

# Read first -- and the one honest limitation to carry into your design

1. `wm-demo/wmdemo/inventory.py`'s `RestockStale` class (search for `class
   RestockStale`) and `advance_restock_checkpoint()` right below it
   (read-only reference in a DIFFERENT repo -- do not edit anything there).
   **Confirm this yourself, it changes the whole design:** both the
   "you're repeating a window you already successfully applied" case and
   "a DIFFERENT window someone/something else applied collided with yours"
   case raise the exact same `RestockStale`, with the exact same
   `error.code == "conflict"` and only a free-text `message` (e.g. "restock
   window for 'store'/'shelf' starts at 1700000000, before the checkpoint
   1700003600 an earlier apply already advanced past -- re-plan from a
   fresher `since`"). **There is no structured field in the 409 body that
   distinguishes the two cases today** -- the checkpoint value is embedded
   in prose, not a separate JSON key. Do not parse that prose to tell the
   two cases apart (fragile, and the wording is not a contract). Also read
   `wm-demo/wmdemo/inventory.py`'s `restock_checkpoint()` docstring
   (immediately above `advance_restock_checkpoint`) for why this port
   refuses every repeat rather than treating an exact retry as a safe no-op
   (no per-line movement dedup backing a retry-passthrough here, unlike the
   TypeScript port).
2. Given #1, the distinction this brief can actually build is a
   **client-side heuristic**, not a server-guaranteed fact, and your
   report/code comments must say so plainly: `shared/hw-restock.js` already
   knows, locally, the last `since` THIS client successfully applied for
   each `(store_id, shelf_location_id)` pair (or can start remembering it).
   On a 409 conflict, if the `since` this client just tried is `<=` its own
   last-known-successful `since` for that same store/shelf, classify it as
   "you already applied this" (this client's own prior success is a
   plausible cause). Otherwise classify it as "another window overlaps"
   (something this client has no record of advanced the checkpoint --
   another tab, another device, or a stale plan built long ago). Document
   in a comment that a genuine same-real-world-action retry from a
   DIFFERENT tab/device will still show as "another window overlaps" even
   though a human would call it the same action -- that's a real, accepted
   limitation of a client-only fix, not a bug to chase further here.
3. `shared/hw-restock.js`'s `apply()` (search for `function apply`) and its
   `errorText()` helper (search for `function errorText`) -- the exact
   `{ok, status, error}` shape every caller already gets on failure; you are
   ADDING a field, never changing what's already there (existing callers,
   including `pos/screen-floor-restock.jsx`, must keep working unmodified
   for every non-409 error path).
4. `pos/screen-floor-restock.jsx`'s `commit()` function (search for
   `function commit`) -- it already calls `plan()` then `apply()` and does
   `setLastAppliedPlan(planRes.plan)` right before the apply attempt (used
   today by `retryHandCounted()`, a DIFFERENT feature -- leave that variable
   and its existing use alone). Also read `loadPreview()` (search for
   `function loadPreview`) -- the function that already re-fetches a fresh
   plan/preview and resets `applyResult`/`lastAppliedPlan`/
   `handCountedByKey`; this is what "Refresh" should call, it does not need
   a new implementation. And read the `<OutcomePanel result={applyResult}
   onRetryHandCounted={retryHandCounted} retryBusy={retrying} />` call site
   (search for `<OutcomePanel`) -- `OutcomePanel` currently receives no way
   to trigger a refresh; you'll add one prop.
5. `test/hw-restock.test.mjs`'s existing `apply() error path` test (search
   for `apply() error path`) and its `fakeLive()` helper at the top of the
   file, for the exact `vm`-context test harness style (no real `fetch`,
   no `window.sessionStorage` -- keep your new client-side memory as
   plain in-module state, not browser storage, so it works the same way
   inside this test harness as in a real browser).

# Hard rules

- Never read, write, copy, move, or delete any `.env` file, anywhere.
- No git commands that write. Read-only git is fine. The PM commits after
  review, explicit paths only, never `git add -A`/`.`.
- Touch only the three files in `files_allowed`.
- Do not touch anything under `wm-demo/` (a different repo, read-only
  reference for this brief) or `platform/modules/restock/` (the
  TypeScript port -- a different implementation, out of scope; this brief
  is the POS-Admin browser client only).
- Do not touch `pos/screen-register.jsx`, `pos/screen-catalog.jsx`,
  `pos/tokens.jsx`, or `pos/atoms.jsx`.
- Do not add a new screen, dialog, or design concept -- this is a fix to an
  existing screen's existing error panel, not a redesign (HANDOFF rule: new
  screens need four concepts first; a wording/action fix to an existing
  error state does not).
- Never invent a server-side distinction that doesn't exist (see "Read
  first" #1) -- do not claim in UI copy or code comments that the server
  told you which case it is.
- No network calls, no server boot, no database -- this is browser-JS-only
  work provable with `node --test`.
- Foreground run, `max_minutes` cap above.

# Steps

1. In `shared/hw-restock.js`, add module-scope state (a plain object, e.g.
   `var _lastAppliedSince = {};`, keyed by `store_id + '::' +
   shelf_location_id`) inside the module's existing closure (check how the
   file is wrapped -- IIFE per the estate convention -- and place this
   alongside its other module-level state/helpers, not global). On every
   SUCCESSFUL `apply()` (the existing `if (!res.ok) {...}` branch's `else`
   path), record `_lastAppliedSince[key] = args.plan.since` (read `since`
   off the plan the caller posted -- confirm that field name is really
   `since` on the Plan object `apply()` receives, matching what
   `preview()`/`plan()` already return and what
   `qa/restock_api_probe.py` reads as `planA.get("since")` in the reference
   repo).
2. On a FAILED `apply()` where `res.code === 409` (check what field the
   fetch layer surfaces the HTTP status as -- `res.code`, matching
   `errorText`'s own `'HTTP ' + (res.code || 0)` fallback) and the
   underlying error's code is `'conflict'` (available via `res.error.code`
   before `errorText()` flattens it to a string -- read `errorText()`
   carefully, you need the structured code BEFORE it gets flattened, so
   compute your classification from `res.error` directly, not from the
   flattened string `errorText()` returns), compute `conflictKind`:
   `'repeat'` if `_lastAppliedSince[key]` exists and `args.plan.since <=
   _lastAppliedSince[key]`; otherwise `'overlap'`. Add `conflictKind: null`
   to the normal (non-409, or non-conflict-code) failure return shape, and
   `conflictKind: 'repeat'|'overlap'` on this specific one, so every caller
   keeps getting the same shape either way (no new required field an
   existing consumer must now handle to avoid `undefined` breakage --
   confirm this by re-reading the existing `apply() error path` test, which
   destructures/asserts specific fields and must keep passing unmodified
   unless you're the one updating it in step 4).
3. In `pos/screen-floor-restock.jsx`'s `OutcomePanel`, when
   `!result.ok`, branch on `result.conflictKind`: `'repeat'` ->
   something like "This restock window was already applied -- your earlier
   request went through. Nothing moved twice."; `'overlap'` -> something
   like "Another restock already covers part of this window. Refresh to
   see the current state before trying again."; `null`/anything else ->
   keep today's existing generic message unchanged. Add an `onRefresh` prop
   to `OutcomePanel`, rendered as a "Refresh" action on the ErrorState only
   for the two conflict cases (reuse whatever action/button pattern
   `window.ErrorState` already supports elsewhere in this file for
   `onRetry`, e.g. the `previewState.error` ErrorState a few dozen lines
   above `OutcomePanel` -- match that exact prop name/pattern rather than
   inventing a new one, unless `ErrorState` only supports `onRetry` and not
   a differently-named refresh prop, in which case just pass `loadPreview`
   as `onRetry` and say so in your report). Wire the call site
   (`<OutcomePanel result={applyResult} onRetryHandCounted={retryHandCounted}
   retryBusy={retrying} />`) to pass `onRefresh={loadPreview}` (the existing
   function, unmodified) as the new prop.
4. Add tests to `test/hw-restock.test.mjs`: (a) a successful apply followed
   by a second apply with the SAME `since` on the same store/shelf getting a
   409 `conflict` classifies as `conflictKind: 'repeat'`; (b) a 409
   `conflict` with NO prior successful apply recorded for that store/shelf
   in this client (fresh `HWRestock` instance/module load) classifies as
   `conflictKind: 'overlap'`; (c) confirm the EXISTING `apply() error path`
   test (422, unrelated to conflicts) still passes unmodified and gets
   `conflictKind: null` (add that one assertion to it, or a new adjacent
   test, your call -- don't rewrite its existing assertions).
5. Run the verify command until green.

# Verify

```
cd /Users/jt/POS-Admin && node --test test/hw-restock.test.mjs
```
Success: all existing tests still pass unmodified in their existing
assertions, plus your new tests for `conflictKind: 'repeat'`,
`conflictKind: 'overlap'`, and `conflictKind: null` on a non-conflict error,
all green. Paste the full pass/fail summary line.

# Security notes

This is a client-side UX classification only, built on a heuristic the
client cannot fully trust (see "Read first" #1-2) -- it must never be used
to skip, retry, or auto-resubmit an apply automatically; it only changes
what TEXT and which manual action (Refresh) the picker sees. Do not add any
automatic retry/resubmit behavior triggered by `conflictKind` -- a human
still decides what to do next, matching this estate's general "server
computes, client displays" and "no automatic retry of a write with external
side effects" posture even though a restock apply is internal-only.

# What NOT to do

- Do not touch any file under `wm-demo/` or `platform/modules/restock/`.
- Do not parse the 409 error message's prose to extract the checkpoint
  number -- classify using only this client's own locally-remembered last
  successful `since`, per "Read first" #1-2.
- Do not add browser storage (`localStorage`/`sessionStorage`) for this --
  plain in-module state is sufficient and matches the test harness; note in
  your report that this means the memory resets on a full page reload
  (an accepted limitation, not a follow-up to silently fix).
- Do not add automatic retry/resubmit logic.
- Do not change `apply()`'s existing return fields for any non-409 or
  non-`conflict`-code failure.

# Report format

Write `docs/REPORT-14-restock_client_409_message.md` covering:
- confirmation of the "Read first" #1 finding (paste the relevant
  `RestockStale`/`advance_restock_checkpoint` lines proving both cases share
  one error shape)
- the exact heuristic implemented and its stated limitation (cross-tab/
  cross-device repeats look like "overlap")
- the `hw-restock.js` diff (new state, new `conflictKind` field)
- the `screen-floor-restock.jsx` diff (message branching, the Refresh prop
  and which `ErrorState` prop you used for it)
- the full test output from Verify

# Log entry

Append "## 14 -- Restock client 409 message -- COMPLETE" (or BLOCKED) to
`docs/CODEX-HANDOFF-LOG.md`, matching the style of its existing entries.
Commit with explicit paths, never push.
