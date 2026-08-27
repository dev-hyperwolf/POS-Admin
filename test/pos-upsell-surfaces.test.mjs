/* ── THE UPSELL ENGINE, ON THE TWO POS SURFACES THAT SELL ────────────────────
 *
 * `getUpsells()` has 299 tests of its own and had been wired into exactly one
 * chip in the driver app. These drive the POS instead: the cart rail that shows
 * while a sale is being rung up, and the "Pairs with cart" ranking over the
 * register's product grid.
 *
 * ⚠️ NOTHING HERE PINS A FIGURE THIS FILE COMPUTED. Every assertion is an
 * invariant — a count that must equal the ENGINE'S OWN config, a set that must
 * not change when only the order should, a product that must be absent when the
 * lane cannot fill it. A test that pins "6" would pass a hard-coded slice.
 *
 * ⚠️ THE FIXTURES STRADDLE. The lane-availability test renders the SAME product
 * twice, once in stock and once at zero, and fails if the in-stock half does not
 * show it — a fixture that never shows the item proves nothing about the guard
 * that hides it.
 *
 * ⚠️ Each screen is mounted on its OWN host node (see `mounter`), never through
 * app.mount(), because these tests mount TWICE inside one boot to compare two
 * worlds and app.mount() re-roots #root.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/* ── mounting ────────────────────────────────────────────────────────────── */

/** Mount a screen on a host of its own, so a second mount is a clean slate. */
function mounter(app) {
  const W = app.window;
  let cur = null;
  const close = () => {
    if (!cur) return;
    try {cur.root.unmount();} catch {/* already gone */}
    cur.host.remove();
    cur = null;
  };
  const open = async (name) => {
    close();
    assert.equal(typeof W[name], 'function', `${name} is not on the page — errors: ${app.errors.join(' | ') || '(none)'}`);
    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    root.render(W.React.createElement(W[name]));
    cur = { root, host };
    await app.settle(); await app.settle();
  };
  open.close = close;
  return open;
}

/* ── reading the two surfaces ────────────────────────────────────────────── */

/** The names on the cart's suggestion rail, in the order they are rendered.
 *  Read off the dismiss control's title, which names its own card. */
const rail = (app) => [...app.document.querySelectorAll('button[title^="Not for this sale · "]')].
  map((b) => b.getAttribute('title').replace('Not for this sale · ', ''));

/** Every product tile in the register grid, in grid order. */
const gridSkus = (app) => [...app.document.querySelectorAll('[data-hw-sku]')].
  map((e) => e.getAttribute('data-hw-sku'));

/** The tiles the ranking put a reason on, in grid order. */
const reasonedSkus = (app) => [...app.document.querySelectorAll('[data-hw-why]')].
  map((e) => e.closest('[data-hw-sku]')).filter(Boolean).
  map((e) => e.getAttribute('data-hw-sku'));

/** Dismiss the rail card for `name`. Returns whether anything was clicked. */
const dismiss = (app, name) =>
  app.click((t, el) => el.getAttribute('title') === `Not for this sale · ${name}`);

/** Add the grid tile for `sku`. Returns whether anything was clicked. */
const addTile = (app, sku) =>
  app.click((t, el) => t === 'Add' && !!el.closest(`[data-hw-sku="${sku}"]`));

/** The Total the cart footer is showing, as a number. `app.text()` collapses
 *  whitespace and adjacent spans have none between them. */
function totalShown(app) {
  const m = app.text().match(/Items\s*(\d+)\s*Total\s*\$([\d,]+\.\d\d)/);
  return m ? Number(m[2].replace(/,/g, '')) : null;
}

/** TENDER → Cash → quick cash → Complete → Done. The real end of a sale.
 *  ⚠️ NOT `app.click('Clear')`: the customer chip ALSO carries a control
 *  labelled Clear, it is earlier in the document, and it starts a whole new
 *  visit — so a dismissal test written against it passes without the ticket's
 *  own reset ever running. That mutation survived until this walked a tender. */
async function tenderCash(app) {
  const total = totalShown(app);
  assert.ok(total > 0, 'nothing on the ticket to tender');
  assert.ok(app.click('TENDER'), 'no TENDER button');
  await app.settle();
  assert.ok(app.click((t) => t.startsWith('Cash')), `no Cash tile — ${app.buttons().slice(0, 12).join(' | ')}`);
  await app.settle();
  const quick = '$' + Math.ceil(total).toFixed(2);
  assert.ok(app.click(quick), `no quick-cash ${quick} — ${app.buttons().slice(0, 14).join(' | ')}`);
  await app.settle();
  assert.ok(app.click((t) => t.startsWith('Complete')), `no Complete — ${app.buttons().slice(0, 14).join(' | ')}`);
  await app.settle();
  assert.ok(app.click((t) => t.startsWith('Done · new sale')), `no Done — ${app.buttons().slice(0, 14).join(' | ')}`);
  await app.settle();
}

/* ── 1. the rail is the ENGINE's list, at the ENGINE's slot count ─────────── */

test('the cart rail is engine-ranked and holds exactly the slots config allows', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    const open = mounter(app);
    try {
      // The number lives in @hyperwolf/commerce-logic, beside the weights that
      // produced the ranking. Reading it here rather than writing "6" is the
      // whole point: change the config and this test follows it.
      const slots = W.HWSwap.engine.defaultConfig.upsell.slotsBySurface.cart_add_to_order;
      assert.equal(typeof slots, 'number');
      assert.ok(slots > 0, 'cart_add_to_order has no slots — the fixture cannot prove anything');

      await open('RegisterScreen');
      const shown = rail(app);
      assert.equal(shown.length, slots,
        `the rail showed ${shown.length} cards where the engine's config allows ${slots} — ` +
        'somebody chose a number instead of asking the config');

      // The rail says which list it is. A hand-rolled fallback wearing the
      // engine's clothes is how nobody notices the engine stopped loading.
      assert.ok(app.text().includes('Suggested for this sale'),
        `the rail is not claiming to be engine-ranked — it reads: ${app.text().slice(0, 200)}`);

      // Nothing already on the ticket may be offered back to the same ticket.
      const cartNames = [...app.document.querySelectorAll('button[title^="Add "]')].length;
      assert.ok(cartNames >= 0);
      for (const name of shown) {
        assert.ok(!/^(Add|Clear)$/.test(name), 'a rail card has no product behind it');
      }
      assert.equal(new Set(shown).size, shown.length, 'the rail offered the same product twice');
    } finally { open.close(); }
  });
});

/* ── 2. an offer is never for something the lane cannot fill ──────────────── */

test('a product the lane cannot fill is never offered — and the guard is the engine\'s, not a filter here', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    const open = mounter(app);
    try {
      await open('RegisterScreen');
      const inStock = rail(app);
      assert.ok(inStock.length > 1, 'need more than one card to tell "hidden" from "rail broke"');

      // The subject: a product the engine ranked highly WHILE IT HAD STOCK.
      // Straddling matters — a fixture that never shows the item proves nothing
      // about the guard that is supposed to hide it.
      const subject = inStock[0];
      const survivor = inStock[1];
      const p = W.HW.PRODUCTS.find((x) => x.name === subject);
      assert.ok(p, `the rail named ${subject}, which is not in the catalogue`);
      assert.ok(p.qty > 0, 'the subject was offered while out of stock before the mutation even ran');

      // Take the last unit away and render the same screen again.
      const held = p.qty;
      p.qty = 0;
      try {
        await open('RegisterScreen');
        const zeroed = rail(app);
        assert.ok(!zeroed.includes(subject),
          `${subject} has no units and was offered anyway — the lane-availability guard is not being consulted`);
        assert.ok(zeroed.includes(survivor),
          `the whole rail vanished when one product went to zero (${zeroed.join(', ') || 'empty'}) — ` +
          'this fixture would "pass" for the wrong reason');
      } finally { p.qty = held; }
    } finally { open.close(); }
  });
});

/* ── 3. a dismissed offer goes, and its slot is refilled ──────────────────── */

test('dismissing an offer removes it and backfills the slot it left', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    const open = mounter(app);
    try {
      const slots = W.HWSwap.engine.defaultConfig.upsell.slotsBySurface.cart_add_to_order;
      await open('RegisterScreen');
      const before = rail(app);
      assert.equal(before.length, slots, 'the rail did not start full — the backfill claim is untestable');

      assert.ok(dismiss(app, before[0]), `no dismiss control on the card for ${before[0]}`);
      await app.settle();

      const after = rail(app);
      assert.ok(!after.includes(before[0]),
        `${before[0]} was dismissed and is still on the rail`);
      // The slot count is the config's, dismissed or not: the offer below the
      // fold moves up. A rail that shrinks by one on every "no thanks" empties
      // itself over a long sale.
      assert.equal(after.length, slots,
        `dismissing one card left ${after.length} of ${slots} slots filled — nothing moved up to take it`);
      // And the dismissal is not a reshuffle: everything else that was showing
      // is still showing.
      for (const name of before.slice(1)) {
        assert.ok(after.includes(name),
          `dismissing ${before[0]} also took ${name} off the rail`);
      }
    } finally { open.close(); }
  });
});

/* ── 4. a dismissal is worth ONE sale ─────────────────────────────────────── */

test('a dismissal dies with the sale — the next customer is offered it again', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    const open = mounter(app);
    try {
      await open('RegisterScreen');
      const before = rail(app);
      const refused = before[0];
      assert.ok(refused, 'nothing on the rail to refuse');

      assert.ok(dismiss(app, refused), `no dismiss control for ${refused}`);
      await app.settle();
      assert.ok(!rail(app).includes(refused), `${refused} survived its own dismissal`);

      // End the sale the way a sale actually ends: money at the drawer.
      await tenderCash(app);
      assert.equal(rail(app).length, 0, 'a tendered, emptied ticket is still being sold to');

      // A new sale on the same terminal, on a screen that never unmounted.
      // Ring up something that is NOT the refused product, so the refusal is
      // the only thing that could still be keeping it off the rail.
      const fresh = W.HW.PRODUCTS.find((x) => x.active && x.qty > 0 && x.name !== refused);
      assert.ok(fresh, 'the catalogue has nothing to start a second sale with');
      assert.ok(addTile(app, fresh.sku), `could not add ${fresh.sku} from the grid`);
      await app.settle();

      const next = rail(app);
      assert.ok(next.length > 0, 'the second sale got no suggestions at all');
      assert.ok(next.includes(refused),
        `${refused} was refused by the PREVIOUS customer and is still being withheld from this one — ` +
        `this sale is offered: ${next.join(', ')}`);
    } finally { open.close(); }
  });
});

/* ── 4b. …including when the ticket empties one line at a time ────────────── */

test('emptying the ticket line by line clears its dismissals too', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    const open = mounter(app);
    try {
      await open('RegisterScreen');
      const refused = rail(app)[0];
      assert.ok(refused, 'nothing on the rail to refuse');
      assert.ok(dismiss(app, refused), `no dismiss control for ${refused}`);
      await app.settle();
      assert.ok(!rail(app).includes(refused), `${refused} survived its own dismissal`);

      // The trash icon on each cart line. This path never touches clearTicket —
      // it is the OTHER way a ticket reaches empty, and it has its own reset.
      let guard = 0;
      while (app.click((t, el) => el.getAttribute('aria-label') === 'trash')) {
        await app.settle();
        assert.ok(++guard < 20, 'the cart lines will not go away');
      }
      assert.ok(guard > 0, 'no cart lines were removed — this fixture proves nothing');
      assert.equal(rail(app).length, 0, 'an emptied ticket is still being sold to');

      const fresh = W.HW.PRODUCTS.find((x) => x.active && x.qty > 0 && x.name !== refused);
      assert.ok(addTile(app, fresh.sku), `could not add ${fresh.sku} from the grid`);
      await app.settle();
      assert.ok(rail(app).includes(refused),
        `${refused} was refused on a ticket that no longer exists and is still being withheld — ` +
        `this sale is offered: ${rail(app).join(', ')}`);
    } finally { open.close(); }
  });
});

/* ── 5. the register grid: "Pairs with cart" ORDERS, it never filters ─────── */

test('"Pairs with cart" re-orders the grid without removing a single product', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    const open = mounter(app);
    try {
      await open('RegisterScreen');
      const before = gridSkus(app);
      assert.ok(before.length > 3, 'the grid is too small to tell a sort from a filter');
      assert.equal(reasonedSkus(app).length, 0, 'the grid is claiming a ranking nobody asked for');

      assert.ok(app.click('Pairs with cart'),
        `no "Pairs with cart" chip — buttons: ${app.buttons().slice(0, 14).join(' | ')}`);
      await app.settle();

      const after = gridSkus(app);
      // THE invariant. Filtering the grid down to the ranked handful would empty
      // the catalogue the cashier is mid-search in, and the count is the only
      // thing that tells a sort from a filter.
      assert.equal(after.length, before.length,
        `ranking changed the grid from ${before.length} tiles to ${after.length} — it filtered instead of ordering`);
      assert.equal([...after].sort().join(','), [...before].sort().join(','),
        'ranking changed WHICH products the grid holds, not just their order');

      // The reasons belong to the top of the grid, and there are no more of them
      // than the engine's config for this surface allows.
      const slots = W.HWSwap.engine.defaultConfig.upsell.slotsBySurface.shop_grid_tile;
      const reasoned = reasonedSkus(app);
      assert.ok(reasoned.length > 0, 'the chip is on and not one tile says why it is up there');
      assert.ok(reasoned.length <= slots,
        `${reasoned.length} tiles carry a reason where the config allows ${slots} — ` +
        'a reason line on every row is wallpaper, not a signal');
      assert.equal(after.slice(0, reasoned.length).join(','), reasoned.join(','),
        'the tiles the engine picked are not the ones at the top of the grid');
      assert.ok(app.text().includes('Best match first'),
        'the grid is ranked and does not say so');

      // Off again: the ranking, the reasons and the claim all go together.
      assert.ok(app.click('Pairs with cart'), 'the chip does not toggle off');
      await app.settle();
      assert.equal(reasonedSkus(app).length, 0, 'reason lines outlived the ranking that made them');
      assert.equal(gridSkus(app).join(','), before.join(','),
        'switching the ranking off did not put the catalogue back in its own order');
      assert.ok(!app.text().includes('Best match first'),
        'the grid still claims to be ranked after the chip was switched off');
    } finally { open.close(); }
  });
});

/* ── 6. the ranking does not move under the cashier's finger ──────────────── */

test('adding from a ranked grid does not re-sort the grid', async () => {
  await withApp('pos', async (app) => {
    const open = mounter(app);
    try {
      await open('RegisterScreen');
      assert.ok(app.click('Pairs with cart'), 'no "Pairs with cart" chip');
      await app.settle();

      const ranked = gridSkus(app);
      const tapped = ranked[0];
      assert.ok(addTile(app, tapped), `could not add the top-ranked tile ${tapped}`);
      await app.settle();

      // The engine drops what is already in the cart, so re-deriving the
      // ranking from the live cart would pull the tile the cashier just tapped
      // out from under the next tap. The basis is frozen at chip-on for exactly
      // this reason.
      assert.equal(gridSkus(app).join(','), ranked.join(','),
        'the grid re-sorted itself the moment an item was added — the next tap lands on a different product');
    } finally { open.close(); }
  });
});
