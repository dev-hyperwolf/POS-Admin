# Brief 14 — Restock client 409 messages

## Server evidence (read-only)

`wm-demo/wmdemo/inventory.py:2362`:

```python
class RestockStale(ValueError):
    """Raised by advance_restock_checkpoint() when the caller's window starts before (or
    exactly repeats) a window an earlier, successful apply already claimed for this same
    (store_id, shelf_location_id) -- inventory_api.py::_restock_apply turns this into a
    409 'conflict', never a silent double-give and never a raw 500."""
```

`advance_restock_checkpoint`, lines 2420–2436, compares since_epoch with
current and until_epoch with current, rolls back, and raises RestockStale
with free-text window/checkpoint details. Both cases reach the same route
mapping at `inventory_api.py:982–983`:

```python
except inv.RestockStale as e:
    return _err(handler, "conflict", str(e))
```

No structured repeat-vs-overlap discriminator exists. The checkpoint
docstring explicitly refuses retry passthrough because this Python port
has no movement-level per-line dedup backing it. Preview/plan can clamp a
stale since; apply rejects it. No server file changed or ran for this brief.

## Client and panel changes

`hw-restock.js` keeps a null-prototype in-module object, keyed by a JSON
tuple of store_id/shelf_location_id (avoids delimiter collisions). It
snapshots the submitted cloned Plan's since before asynchronous completion,
normalizes valid ISO instants with Date.parse, and remembers only successful
applies. A late older success cannot erase a newer successful since.

Only HTTP 409 AND structured error.code=conflict classify: attempted since
<= that pair's last successful since is repeat; otherwise overlap. Other
failures carry conflictKind:null, with all original fields preserved; local
validation failures and successes also carry null. No error-prose parsing,
browser storage, automatic retry, skip or resubmit. Invalid/missing window
metadata cannot manufacture repeat history.

This is a display heuristic, not a server guarantee. Different tabs/devices
and full reloads have no memory, so real-world repeats appear as overlap.
Any successful response is remembered per the brief, including a response
with all lines skipped; therefore the UI deliberately says "appears"/"may"
and makes no definite claim about why the server refused.

`OutcomePanel` accepts onRefresh and branches only for repeat/overlap:

- Repeat: “This window appears to repeat an earlier apply from this browser.
  Refresh to see the current state.”
- Overlap: “Another restock may overlap this window. Refresh to see the
  current state before trying again.”

Generic error title/body is unchanged. The call site passes
onRefresh={loadPreview}; ErrorState receives onRetry={onRefresh}, matching
the existing preview-error pattern. **ErrorState supports only onRetry and
hardcodes the visible label “Try again” with a refresh icon**
(`shared/states.jsx:56–71`). Per the brief's explicit fallback, that existing
action now refreshes; the body calls the action Refresh. No new action-label
prop was invented and the shared component was not edited. loadPreview,
commit, lastAppliedPlan and hand-counted retry logic are byte-unchanged.

## Verification

`node --test test/hw-restock.test.mjs`: all prior assertions retained,
existing 422 test adds conflictKind:null, eight new tests cover repeat/
older/later and timezone-equivalent instants, fresh overlap/failure memory,
store+shelf isolation/key collisions, exact status+code gate, reload,
caller mutation, invalid metadata/local error, and out-of-order completion.
No fetch exists in the vm test context; every apply posts exactly once.

Scratch UI verification: 4 groups PASS / 0 FAIL — Babel JSX syntax, both
conflict messages/actions (callback actually invoked), generic error without
action unchanged, original preview/commit/hand-count flow unchanged.
`git diff --check` PASS. Full required test output follows:

```text
✔ preview() builds the GET path with store_id/shelf_location_id/since and returns the plan (2.705542ms)
✔ preview() refuses locally when a required field is missing, never calling HW_LIVE (0.2755ms)
✔ preview() maps a server error body to {status, error} and a null plan (0.246291ms)
✔ preview() flattens a bare string error and a codeless network failure the same way (0.231958ms)
✔ preview() percent-encodes query values (0.232417ms)
✔ plan() posts store_id/shelf_location_id/actor and omits since when not given (0.245542ms)
✔ plan() includes since when given (0.230375ms)
✔ plan() refuses locally without an actor (0.2125ms)
✔ plan() maps a server error the same way preview() does (0.247334ms)
✔ apply() refuses locally without a plan or an actor, never calling HW_LIVE (0.318291ms)
✔ apply() posts a CLONE of the plan, and never mutates the caller's plan object (0.342458ms)
✔ apply() includes station_id and read only when given (0.235042ms)
✔ apply() maps the three outcomes (applied/skipped/adjusted) and movements verbatim (0.224083ms)
✔ apply() surfaces per-line hand_count_required, pulled out of skipped (0.207334ms)
✔ apply() error path returns empty outcome arrays, not undefined (0.219042ms)
✔ slipUrl() defaults to format=html and uses HW_LIVE.base (0.204125ms)
✔ slipUrl() accepts an explicit format and a Plan-shaped source (shelf_location_id/since stamped by the server) (0.188208ms)
✔ locations() builds an empty query with no args and returns the list on success (0.201375ms)
✔ locations() passes kind/region_id/active through as query params (0.5205ms)
✔ locations() error path returns an empty array, not undefined (0.226708ms)
✔ the module is idempotent against a second script tag in the same context (0.2995ms)
✔ apply() same or earlier window after own success is repeat; later is overlap (0.268083ms)
✔ apply() fresh module conflict is overlap and failures never create success memory (0.213625ms)
✔ apply() remembered windows are isolated by both store and shelf, without tuple collisions (0.232834ms)
✔ apply() classification requires both HTTP 409 and structured conflict code (0.514959ms)
✔ apply() full module reload loses local memory and shows overlap (0.342ms)
✔ apply() snapshots the posted window before asynchronous caller mutation (0.234542ms)
✔ apply() invalid window cannot manufacture repeat history; local failure carries null (0.201334ms)
✔ apply() late older success does not discard a newer successfully applied window (0.251125ms)
ℹ tests 29
ℹ suites 0
ℹ pass 29
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 73.643375
```
