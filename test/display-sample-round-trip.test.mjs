/* ── THE DISPLAY-SAMPLE FLAG MUST SURVIVE THE STORE ──────────────────────────
 *
 * The Add Product flow makes a promise in its own confirmation copy:
 *
 *     "Marked as a display sample — Kept off the sellable menu, still tracked
 *      as a full product profile."
 *
 * pos/shell-store.jsx `seed()` broke it in the rebuild, with a literal:
 *
 *     variations: items.map((p) => ({ …, active: p.active, sample: false, … }))
 *
 * Every variation reconstructed from a stored item came back `sample: false`
 * whatever the item said, so the flag died at the POS boundary — before the
 * Weedmaps side ever got the chance to honour or break the owner's rule that a
 * staff sample is NEVER mapped to a Weedmaps product. Everything downstream was
 * defending a value that had already been thrown away.
 *
 * 🔴 WHAT THE HARDCODED `false` WAS HIDING. No product-row writer in this build
 * carries a `sample` field at all — not pos/data.jsx `P_()`, not
 * shared/demo-seed.js `product()`, not the live adapter in shared/hw-live.js.
 * The flag's only home was the variation object inside SHELLS, which lives
 * exactly as long as the page. So the repair is two-sided and both sides are
 * asserted here: `addVariation` writes the flag onto the product row, and
 * `seed()` reads it back off.
 *
 * ⚠️ AND THE INFERENCE THAT MUST NEVER BE MADE. `active` is not a stand-in for
 * `sample`. It is false for `b.skip`, and for qty === 0, and for an item simply
 * switched off — so reading "inactive" backwards as "is a sample" makes a
 * display sample and an out-of-stock product indistinguishable. The last test
 * here is the negative control for exactly that, and it is the reason this file
 * asserts the flag itself rather than the symptom.
 *
 * WHAT THIS CANNOT TELL YOU: jsdom answers "does this WORK", never "does this
 * LOOK right". The Sample tag is asserted as text in the document; its colour,
 * placement and whether it is legible beside the variation name are not tested
 * anywhere and were not seen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/** The variation a given stored item rebuilds into, wherever it landed. */
const rebuilt = (W, sku) =>
  W.HW_SHELL.allShells().flatMap((s) => s.variations).find((v) => v.sku === sku);

// ── 1 · THE ROUND TRIP ──────────────────────────────────────────────────────

test('a stored item flagged as a display sample rebuilds as a display sample', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    const item = W.HW.PRODUCTS[0];
    // Flag it BEFORE the first allShells() — SHELLS is seeded lazily and never
    // rebuilt, so this is the one moment seed() reads the catalogue.
    item.sample = true;

    const v = rebuilt(W, item.sku);
    assert.ok(v, `${item.sku} did not rebuild into any shell at all`);
    assert.equal(v.sample, true,
      'pos/shell-store.jsx seed() rebuilt the variation with sample=false. It ' +
      'hardcoded the literal `false` over whatever the stored item said, so the ' +
      'display-sample flag never survived the store — and the Weedmaps rule ' +
      '("a staff sample is never mapped") was defending a value already lost.');
  });
});

test('a sample rebuilt from the store is never rebuilt as sellable', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    const item = W.HW.PRODUCTS.find((p) => p.active);
    assert.ok(item, 'no active product to flag — fixture changed');
    item.sample = true;

    const v = rebuilt(W, item.sku);
    assert.equal(v.sample, true, 'precondition: the flag survived');
    assert.equal(v.active, false,
      `${item.sku} is flagged as a display sample and came back ACTIVE. The ` +
      'flow that sets the flag writes `active: !v.sample && !b.skip` ' +
      '(pos/product-shell.jsx:152); a rebuild that puts the sample back on the ' +
      'sellable menu undoes that on the next page load.');
  });
});

test('the flag is written onto the product row — the thing a rebuild reads', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    const shell = W.HW_SHELL.allShells()[0];
    const sku = shell.variations[0].sku;
    const row = W.HW.PRODUCTS.find((p) => p.sku === sku);
    assert.ok(row, 'fixture: the seeded variation has a product row');
    assert.notEqual(row.sample, true, 'precondition: it is not a sample yet');

    W.HW_SHELL.addVariation(shell.id, { sku, name: 'Bench Unit', price: 1, sample: true, active: false, qty: 0 });

    assert.equal(row.sample, true,
      'addVariation left the flag on the in-memory variation only. SHELLS lives ' +
      'as long as the page; the product row is what seed() rebuilds from, and ' +
      'shared/hw-live.js apply() replaces HW.PRODUCTS wholesale at any moment. ' +
      'A flag that is never written to the row cannot survive either event.');

    // Closing the loop: test 1 proves seed() reads `p.sample` back off the row,
    // this proves something puts it there. Both halves, or the field is inert.
  });
});

// ── 2 · THE TOGGLE, DRIVEN THE WAY A PERSON DRIVES IT ───────────────────────

/** The MiniSwitch has no label of its own — it is the button in the row whose
 *  heading reads "Display sample". Found structurally, not by text. */
const sampleSwitch = (app) => {
  const heading = [...app.document.querySelectorAll('div')]
    .find((d) => (d.textContent || '').trim() === 'Display sample');
  if (!heading) return null;
  for (let el = heading; el; el = el.parentElement) {
    const btn = el.querySelector && el.querySelector('button');
    if (btn) return btn;
  }
  return null;
};

test('flipping "Display sample" carries the flag through the flow into the store', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    const before = new Set(W.HW_SHELL.allShells().flatMap((s) => s.variations).map((v) => v.sku));

    await app.mount('AddProductFlow');
    assert.ok(app.click((t) => /Add variation/.test(t)), 'no shell row was clickable');
    await app.settle();

    assert.ok(app.type('e.g. Fruit Punch', 'Bench Sample'), 'could not find the name field');
    await app.settle();

    const sw = sampleSwitch(app);
    assert.ok(sw, 'the Display sample toggle is not on the variation step');
    sw.dispatchEvent(new W.MouseEvent('click', { bubbles: true, cancelable: true }));
    await app.settle();

    // Continue → batch. Give it real stock: the point is that a display sample
    // is held off the menu because it is a SAMPLE, not because it has no units.
    assert.ok(app.click('Continue'), 'Continue did not advance to the batch step');
    await app.settle();
    assert.ok(app.type('0.00', '12.50'), 'no wholesale cost field on the batch step');
    assert.ok(app.type('0', '6'), 'no quantity field on the batch step');
    await app.settle();

    assert.ok(app.click('Create variation'), 'the flow would not create the variation');
    await app.settle();

    assert.match(app.text(), /Marked as a display sample/,
      'the confirmation dropped the display-sample line — the copy that states ' +
      'the contract is the first thing to check when the flag goes missing');

    const added = W.HW_SHELL.allShells().flatMap((s) => s.variations).find((v) => !before.has(v.sku));
    assert.ok(added, 'the flow created no new variation at all');
    assert.equal(added.sample, true,
      'the toggle was on and the stored variation says sample=false');
    assert.equal(added.active, false,
      'a display sample was written into the store as sellable, with stock on it');
    assert.equal(added.qty, 6, 'the batch quantity was lost — the sample is still tracked');
  });
});

// ── 3 · THE NEGATIVE CONTROL ────────────────────────────────────────────────

test('an ordinary item is not a sample, and "inactive" is never read backwards as one', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    const plain = W.HW.PRODUCTS.find((p) => p.active);
    const off = W.HW.PRODUCTS.find((p) => p.sku !== plain.sku);
    off.active = false;                    // switched off, NOT a sample
    assert.equal('sample' in off, false, 'fixture: no sample flag on this row');

    assert.equal(rebuilt(W, plain.sku).sample, false,
      'an ordinary stored item came back flagged as a display sample — the ' +
      'rebuild is now inventing the flag instead of dropping it');
    assert.equal(rebuilt(W, off.sku).sample, false,
      `${off.sku} is inactive and carries no sample flag, yet rebuilt as a ` +
      'display sample. `active` is false for b.skip, for zero stock and for a ' +
      'plain switch-off; decoding it backwards makes a display sample and an ' +
      'out-of-stock product indistinguishable.');
    assert.equal(rebuilt(W, plain.sku).active, true,
      'a plain active item was rebuilt inactive — the sample guard on `active` ' +
      'is firing on rows that carry no flag');
  });
});
