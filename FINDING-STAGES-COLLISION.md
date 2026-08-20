# 🔴 `STAGES` collision — `main` is broken today, independent of any merge

**Status: UNOWNED.** Found 2026-08-20 by the Weedmaps session. The session that owned `main`
and was going to fix it has since restarted and is unreachable. Written down here because a
finding that lives only in a chat transcript dies with the session that found it.

## The defect

    pos/data.jsx:441         const STAGES = ['verify','pack','packing','ready','done']   NEW
    pos/screen-orders.jsx:4  const STAGES = [{id,label,color} x 5]                       pre-existing

`Hyperwolf POS.html` carries no `data-presets`, so @babel/standalone compiles a top-level
`const` to a **global**, and the later script tag wins. `data.jsx` is script 93,
`screen-orders.jsx` is 113. There is no per-script scope and **no SyntaxError** — just a
silent overwrite.

`data.jsx`'s functions then resolve the identifier globally, at call time:

    setStage(id, 'pack')       -> !STAGES.includes('pack') over objects -> returns null, ALWAYS
    nextStage('verify')        -> indexOf -> -1                          -> returns null, ALWAYS
    addOrder({stage:'ready'})  -> coerced to 'verify', ALWAYS

## What an associate sees

Open an order in Verification Pending, press release (`VerifyReleaseBlock`,
`pos/screen-orders.jsx:2124`). The activity log prints a **green tick** — *"Verified order ·
cleared for fulfillment"* — with the `· moved to Need to Pack` clause missing. The header still
reads *"Verification pending — nothing is packed until this is released"*. The card never
leaves the column.

Same at `:1680` (Weedmaps approve) and `:2749` (pack scanner "Done" — scan 12/12 units, log
says packed, card stays put).

**This is a control someone presses to release product, telling them it worked when it did
not.**

## The mechanism was verified in production, not reasoned about

`Hyperwolf Delivery.html` already loads `pos/data.jsx` then `delivery/ddata.jsx`. On the live
deployment, `window.DRIVERS` is ddata's 11 rows (`keys: name, role`) while `window.HW.DRIVERS`
is data.jsx's 6 (`Theo Reyes`) — `same_identity: false`. The clobber is live right now.

## ⚠️ The test suite structurally cannot see this

`test/ui-harness.mjs` wraps every file in `(function(){…})()`, with a comment asserting that
*"Separate `<script>` tags each get their own top-level scope"*. **That is false** — the
Delivery-page evidence above disproves it. That wrapper is the only reason
`test/order-store.test.mjs`'s `assert.ok(HW.setStage(o.id,'pack'))` is green.

The harness is hiding the exact class of bug it was built to catch, so **every future name
collision is invisible in the same way.** Arguably the more serious of the two findings.

## The fix — four lines, plus the harness

1. Rename the binding in `pos/data.jsx:441` to `ORDER_STAGES`.
2. Use it in `addOrder` / `setStage` / `nextStage`.
3. Keep the export as `STAGES: ORDER_STAGES` so nothing downstream changes.
4. **Confirm in a real browser, not in the harness** — the harness cannot show the difference.

Separately: drop the IIFE wrapper, or add one browser-faithful boot path, so this class becomes
visible.

## Two other collisions found in the same sweep

* **`DRIVERS`** — `main` adds `delivery/ddata.jsx` to the POS page (script 97).
  `ddata.jsx:119` reads `window.TDATA`, and `terminals/tdata.jsx` is **not loaded on the POS
  page**, so global `DRIVERS` becomes `[]` and `SCHEDULE_WK` an all-empty roster. No bare
  `DRIVERS` read was found in any POS-page file, so this is rated **inert-but-fragile** — a
  code-reading conclusion, not an observation.
* **`REGION_STOCK`** (`delivery/ddata.jsx:106`) — a module-scope cache built once from
  `HW.PRODUCTS`. If `/api/state` lands after the Babel pass it is never rebuilt, and the swap
  panel offers substitutes from 30 mock SKUs while the catalogue shows 39 live ones.
