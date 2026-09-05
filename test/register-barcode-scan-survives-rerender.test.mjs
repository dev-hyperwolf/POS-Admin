/* ══ BARCODE SCAN: THE BUFFER MUST SURVIVE A RE-RENDER MID-SCAN ═════════════
 *
 * pos/screen-register.jsx's global keydown listener buffers a barcode
 * scanner's keystrokes (fast keys ending in Enter) into a running `buf`,
 * then looks the finished code up with `find()`. That `buf` — and the
 * `last`-keystroke timestamp next to it — used to be plain closure locals
 * declared inside a `React.useEffect` that had NO dependency array. Per
 * React's effect semantics, an effect with no deps tears down and re-runs
 * after EVERY render of RegisterScreen, which hands the listener a brand
 * new, empty `buf`.
 *
 * RegisterScreen re-renders constantly for reasons that have nothing to do
 * with scanning — a toast, a cart edit from the product grid, switching the
 * active ticket. If any of those fires while a scan is only half typed, the
 * old code silently dropped the keystrokes typed so far: by the time Enter
 * arrived, `buf` held only the tail of the code, `find()` missed, and the
 * operator saw "No product matches" for a code that was scanned perfectly
 * well.
 *
 * The fix (see the comment at the effect in pos/screen-register.jsx) moves
 * `buf`/`last` into `useRef` — so they survive a render — and registers the
 * `keydown` listener once, at mount, with `find`/`add`/`flash` read back out
 * of a ref that is kept current every render (they are not memoized, so a
 * `[]`-deps listener that closed over them directly would go stale the first
 * time the active ticket or cart changed).
 *
 * This test types a scan in two halves with a real cart-edit click — the
 * same kind of unrelated setState the bug shipped without any coverage for —
 * in between, and asserts the scan still resolves against the OLD code: it
 * fails (the split code never matches, so a "No product matches" toast
 * appears and the scanned product is never added) and passes on the fix.
 *
 * `Date.now()` is frozen for the duration of the scan. The effect's own
 * `now - last > 75` check ("a gap this big is a person typing, not a wedge
 * scanner") is legitimate, unrelated behaviour — and `app.settle()` between
 * the two halves burns a real ~40ms+ of wall clock by design (see the long
 * note at `settleFor` in ui-harness.mjs), which under load can exceed that
 * 75ms window for reasons that have nothing to do with this bug. Freezing
 * time removes that confound so the only thing that can make the buffer
 * reset is the actual regression: an effect torn down and rebuilt losing a
 * closure-local `buf` versus a `useRef` that survives the render.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/** Dispatch one keydown per character of `code`, plus a trailing Enter — the
 *  same event stream a USB/Bluetooth wedge scanner produces. Fired on
 *  `window`, same target the listener under test is registered on. */
function scanKeys(app, code) {
  for (const ch of code) {
    app.window.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: ch, bubbles: true }));
  }
}
function scanEnter(app) {
  app.window.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}

/** The product grid's own "Add" button for one sku — see ProductRow in
 *  pos/screen-register.jsx (`data-hw-sku` names the tile, the plain button
 *  inside it is the click-to-add control, same target a real associate
 *  would tap while a scan is in flight). */
function addButtonFor(app, sku) {
  return app.window.document.querySelector(`[data-hw-sku="${sku}"] button`);
}

test('barcode scan: a cart-edit click mid-scan must not truncate the buffer', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');

    // Freeze time — see the file header for why. Restored in `finally` so it
    // cannot bleed into whatever else this callback (or `settle`) does.
    const RealDate = app.window.Date;
    const frozenNow = RealDate.now();
    app.window.Date = class extends RealDate {
      static now() { return frozenNow; }
    };

    try {
      // The seeded ticket carries PRODUCTS[0] and PRODUCTS[1] (see RegisterScreen's
      // initial `tickets` state) — pick the scan target and the mid-scan click
      // target from further down the catalogue so neither is already on the cart.
      const scanTarget = app.window.HW.PRODUCTS[3]; // 'WIL20X9' — Product Willy
      const clickTarget = app.window.HW.PRODUCTS[2]; // '212FFSAFA' — CDS Product
      assert.ok(scanTarget && scanTarget.sku.length >= 5, 'fixture changed — need a real multi-char sku to split');
      assert.ok(clickTarget && clickTarget.sku !== scanTarget.sku, 'fixture changed — need a second, distinct product to click');

      assert.match(app.text(), /Items\s*2/, `seeded ticket should start at 2 items: ${app.text().slice(0, 200)}`);

      const sku = scanTarget.sku;
      const splitAt = Math.floor(sku.length / 2);

      // Type the first half of the scan…
      scanKeys(app, sku.slice(0, splitAt));

      // …then an UNRELATED cart edit lands mid-scan: an associate (or a second
      // scan already in flight elsewhere) adds a different product from the
      // grid. This is exactly the kind of re-render (`setCart`) the bug shipped
      // with no coverage for.
      const btn = addButtonFor(app, clickTarget.sku);
      assert.ok(btn, `no Add button for the click-target product — grid may be filtered/paginated differently than expected`);
      btn.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      await app.settle();

      // …then the rest of the scan, and Enter — the operator/scanner has no
      // idea a re-render happened in between. Time is still frozen, so this
      // is indistinguishable (to the 75ms-gap check) from one continuous burst.
      scanKeys(app, sku.slice(splitAt));
      scanEnter(app);
      await app.settle();

      assert.doesNotMatch(app.text(), /No product matches/,
        `the split scan should still resolve to a real product — saw: ${app.text().slice(0, 300)}`);

      // Both the click-add and the scan-add should have landed: 2 seeded + the
      // click target + the scanned product = 4 items on the ticket.
      assert.match(app.text(), /Items\s*4/,
        `expected the click-add AND the scan-add to both land on the cart: ${app.text().slice(0, 300)}`);

      const scannedBtn = addButtonFor(app, scanTarget.sku);
      assert.ok(scannedBtn && /1/.test(scannedBtn.textContent),
        `the scanned product should show as added (qty 1) on its grid tile — saw "${scannedBtn && scannedBtn.textContent}"`);
    } finally {
      app.window.Date = RealDate;
    }
  });
});

test('barcode scan: a clean, uninterrupted scan still resolves (no false regression from the fix)', async () => {
  await withApp('pos', async (app) => {
    await app.mount('RegisterScreen');
    const scanTarget = app.window.HW.PRODUCTS[3]; // 'WIL20X9' — Product Willy

    scanKeys(app, scanTarget.sku);
    scanEnter(app);
    await app.settle();

    assert.doesNotMatch(app.text(), /No product matches/, 'an uninterrupted scan must still work after the fix');
    assert.match(app.text(), /Items\s*3/, 'the scanned product should be the only addition — 2 seeded + 1 scanned');
  });
});
