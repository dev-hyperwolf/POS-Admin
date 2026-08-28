// THE POS FAILED TO MOUNT IN PRODUCTION ON 2026-08-28.
//
//   TypeError: undefined is not an object (evaluating 'p.price')
//   @ build/pos/screen-register.438164e8.js:355
//
// screen-register reads its products through `useHW()`, which serves the LIVE
// catalogue whenever a server is attached. The demo ticket, however, was seeded
// with two HARDCODED fixture skus -- 'H480PRO1' and 'F2Q4EN2C'. The live
// catalogue is under no obligation to contain a fixture sku, and it did not:
// /api/state returned 149 catalogue rows, neither of them those.
//
// `find()` then returned undefined and `(p.price - c.disc)` threw inside render,
// so the ENTIRE POS failed to mount. Not the cart pane -- the whole application.
//
// Two things were wrong and both are pinned here:
//   1. the seed named skus it could not guarantee, and
//   2. the arithmetic dereferenced find()'s result unguarded, while its two
//      siblings (merchOf at :135, tkLines at :322) had guarded all along.
//
// Neither was new. Both are byte-identical in d7cccaf, the last build that
// served correctly for hours -- against an instance whose catalogue happened to
// carry those skus. The defect was always there; only the data changed. That is
// why this test drives the DATA and not the code path: a regression here will
// arrive as a different catalogue, not as an edit to this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withApp } from './ui-harness.mjs';

const SRC = readFileSync(new URL('../pos/screen-register.jsx', import.meta.url), 'utf8');

test('the seed names no hardcoded sku', () => {
  assert.equal(/sku: 'H480PRO1'/.test(SRC), false,
    "the demo ticket must seed from window.HW.PRODUCTS, not from a literal sku. " +
    "A hardcoded sku is a promise about a catalogue this screen does not own.");
  assert.match(SRC, /cart: \(window\.HW\.PRODUCTS \|\| \[\]\)\.slice\(0, 2\)/);
});

test('an unknown sku is flagged, never dereferenced or silently zeroed', () => {
  assert.match(SRC, /missing: !p/,
    'an unsellable line must carry the fact, so the cart pane can say so');
  assert.match(SRC, /total: p \? \(p\.price - c\.disc\) \* c\.qty : 0/,
    'the arithmetic must guard, as merchOf and tkLines already did');
  assert.equal(/total: \(p\.price - c\.disc\) \* c\.qty/.test(SRC), false,
    'THE ORIGINAL DEFECT: this threw inside render and took the whole POS down');
});

test('the register mounts against a catalogue that shares no sku with it', async () => {
  await withApp('pos', async (app) => {
    app.window.HW.PRODUCTS = [
      { sku: 'LIVE-ONLY-1', name: 'Live Only One', price: 12, cat: 'Flower',
        brand: 'hyperwolf', wt: '1g', active: true },
      { sku: 'LIVE-ONLY-2', name: 'Live Only Two', price: 30, cat: 'Vapes',
        brand: 'hyperwolf', wt: '1g', active: true }];
    await app.mount('RegisterScreen');
    const body = app.window.document.body.textContent || '';
    assert.equal(body.includes('did not mount'), false, 'the app must mount');
    assert.ok(body.length > 200, 'the register must render, not blank');
  });
});

test('the register mounts against an EMPTY catalogue', async () => {
  // The reachable production case: a fresh instance, or a server that has not
  // finished seeding. Zero products is a legitimate state, not a crash.
  await withApp('pos', async (app) => {
    app.window.HW.PRODUCTS = [];
    await app.mount('RegisterScreen');
    assert.ok((app.window.document.body.textContent || '').length > 200,
      'an empty catalogue must render an empty register, never throw');
  });
});
