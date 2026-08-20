/* ── THE CUSTOMER STOREFRONT — shell, home, shop ───────────────────────────
 *
 * Every assertion here is an INVARIANT, never a dollar figure typed by the
 * person who wrote the test. A test that pins "$63.00" passes for exactly as
 * long as nobody edits the catalogue, and then it fails for a reason that has
 * nothing to do with the behaviour it claims to protect. Worse, it can only
 * ever confirm the number the author already believed.
 *
 * ⚠️ CROSS-REALM. Everything off `app.window` belongs to the jsdom realm, so
 * deepEqual against a Node array fails on prototypes alone. Compare primitives.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

const countOf = (text, needle) => text.split(needle).length - 1;

test('the storefront boots with the engine attached, not silently null', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    // `typeof null === 'object'`, and the adapter sets itself to null when the
    // engine is missing — so this has to check for null directly or a broken
    // load reads as a good one.
    assert.notEqual(W.HWCommerce, null, 'commerce-engine.js did not attach');
    assert.notEqual(W.HWSwap, null, 'commerce-adapter.js reported no engine');
    assert.notEqual(W.DDATA, null, 'delivery/ddata.jsx must load — it is the van kit');
    assert.equal(app.errors.join(' | '), '', 'a script threw while loading');
    await app.mount('ShopApp');
    assert.equal(app.errors.join(' | '), '', 'the shell threw while rendering');
  });
});

test('home greets the signed-in customer by the name the data holds', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    const first = W.SHOPDATA.CUSTOMER.first;
    assert.ok(first.length > 0, 'the fixture must actually name someone');
    assert.ok(app.text().includes(first), `the greeting never rendered "${first}"`);
    const z = W.SHOPDATA.CUSTOMER.zone;
    assert.ok(app.text().includes(z.city) && app.text().includes(z.zip),
      'the deliver-to block must show the customer’s own zone');
  });
});

test('the express ETA on screen is the engine’s lane config, not a typed 90', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    const eta = W.HWCommerce.defaultLanes.express.etaMinutes;
    assert.ok(eta > 0, 'the engine must actually carry an ETA or this proves nothing');
    assert.ok(app.text().includes('~' + eta + ' min'),
      'home did not render the engine’s express ETA');
    // And it moves when the engine's number moves — which a literal would not.
    W.HWCommerce.defaultLanes.express.etaMinutes = eta + 7;
    W.SHOP.setQuery('');                      // any emit re-renders the tree
    await app.settle();
    assert.ok(app.text().includes('~' + (eta + 7) + ' min'),
      'the ETA is hard-coded — it did not follow the engine');
    W.HWCommerce.defaultLanes.express.etaMinutes = eta;
  });
});

test('"Add all to cart" adds every line of that order, at its own quantities', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    const order = W.SHOPDATA.pastOrders()[0];
    assert.ok(order.lines.length > 1, 'the fixture order must have several lines');
    assert.ok(order.lines.some((l) => l.qty > 1),
      'and at least one quantity above 1, or "adds all of them" is untested');

    assert.equal(W.SHOP.lines().length, 0, 'the cart must start empty');
    const hit = app.click('Add all to cart');
    assert.equal(hit, true, 'the Add-all button was not found or not clickable');
    await app.settle();

    // Every sku, at the right quantity. Compared as a joined STRING because the
    // arrays come from the jsdom realm.
    const want = order.lines.map((l) => l.sku + ':' + l.qty).sort().join(',');
    const got = W.SHOP.lines().map((l) => l.sku + ':' + l.qty).sort().join(',');
    assert.equal(got, want, 'the cart does not hold exactly what the card promised');
    assert.equal(W.SHOP.itemCount(), order.lines.reduce((s, l) => s + l.qty, 0));
  });
});

test('the ⚡ EXPRESS badge is derived from the van kit, per product', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    const D = W.SHOPDATA;
    const all = D.allProducts();
    const eligible = all.filter((p) => D.isExpress(p.sku));
    assert.ok(eligible.length > 0, 'no product is express — the kit did not load');
    assert.ok(eligible.length < all.length,
      'EVERY product is express, so a badge on every card would prove nothing');

    W.SHOP.go('shop');
    await app.settle();
    assert.equal(countOf(app.text(), 'EXPRESS'), eligible.length,
      'the badge count does not match what the van is carrying');

    // Empty the van. A badge that survives that is a decoration, not a fact.
    const kit = W.DDATA.REGION_STOCK[D.CUSTOMER.zone.regionId];
    const real = kit.units;
    kit.units = {};
    W.SHOP.setCategory('All');
    await app.settle();
    assert.equal(countOf(app.text(), 'EXPRESS'), 0,
      'the badge did not follow the kit — it is hard-coded onto the card');
    kit.units = real;
  });
});

test('an add lands in express only when the van has it; otherwise scheduled', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    const D = W.SHOPDATA;
    const yes = D.allProducts().find((p) => D.isExpress(p.sku));
    const no = D.allProducts().find((p) => !D.isExpress(p.sku));
    assert.ok(yes && no, 'need one of each, or the rule is untested');
    W.SHOP.add(yes.sku, 1);
    W.SHOP.add(no.sku, 1);
    const laneOf = (sku) => (W.SHOP.lines().find((l) => l.sku === sku) || {}).lane;
    assert.equal(laneOf(yes.sku), 'express');
    assert.equal(laneOf(no.sku), 'scheduled');
  });
});

test('the cart refuses a line for a sku the store does not sell', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    assert.equal(W.SHOP.add('NOT-A-REAL-SKU', 1), null);
    assert.equal(W.SHOP.lines().length, 0);
  });
});

test('there is ONE money authority: SHOP.totals() IS computeCartTotals', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    const D = W.SHOPDATA;
    // Something in each lane, so the comparison covers fees and two minimums.
    W.SHOP.add(D.allProducts().find((p) => D.isExpress(p.sku)).sku, 2);
    W.SHOP.add(D.allProducts().find((p) => !D.isExpress(p.sku)).sku, 1);

    const mine = W.SHOP.totals();
    assert.notEqual(mine, null, 'totals came back null with the engine loaded');
    // The SAME options the storefront prices with — rebuilding them here by
    // hand is how this test went stale when computeTax was added and reported a
    // second money authority that did not exist.
    const direct = W.HWCommerce.computeCartTotals(W.SHOP.context(), W.SHOP.engineOptions());
    for (const k of ['subtotalCents', 'discountCents', 'feesCents', 'taxCents', 'totalCents', 'orderCount', 'itemCount']) {
      assert.equal(mine[k], direct[k], `${k} disagrees with the engine — a second total exists`);
    }
  });
});

test('the design’s "4 ITEMS · 2 ORDERS" is the engine’s own itemCount / orderCount', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    const D = W.SHOPDATA;
    W.SHOP.add(D.allProducts().find((p) => D.isExpress(p.sku)).sku, 2);
    W.SHOP.add(D.allProducts().find((p) => !D.isExpress(p.sku)).sku, 1);
    const t = W.SHOP.totals();
    assert.equal(t.orderCount, t.lanes.length, 'one order per active lane');
    assert.equal(t.orderCount, 2, 'both lanes should be active in this cart');
    assert.equal(t.itemCount, W.SHOP.itemCount(), 'the engine and the cart disagree on item count');
  });
});

test('the lane minimum is progress, and the progress bar cannot lie', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    const D = W.SHOPDATA;
    // Cheapest express item first — a deliberately UNDER-minimum cart, which is
    // the state the design draws as a filling bar rather than as an error.
    const cheap = D.allProducts().filter((p) => D.isExpress(p.sku)).sort((a, b) => a.price - b.price)[0];
    W.SHOP.add(cheap.sku, 1);
    let lane = W.SHOP.totals().lanes.find((l) => l.lane === 'express');
    assert.equal(lane.minimumCents, W.HWCommerce.defaultLanes.express.minimumCents,
      'the minimum must be the engine’s, not a number this screen chose');
    assert.equal(lane.minimumMet, lane.subtotalCents >= lane.minimumCents);
    assert.equal(lane.shortfallCents, lane.minimumMet ? 0 : lane.minimumCents - lane.subtotalCents);
    assert.ok(lane.progress >= 0 && lane.progress <= 1, 'progress must be a 0..1 bar fill');
    assert.equal(lane.minimumMet, false, 'this cart is meant to be under the minimum');

    // Fill it past the minimum: the bar clamps at 1 and the tick turns on.
    W.SHOP.add(cheap.sku, 999);
    lane = W.SHOP.totals().lanes.find((l) => l.lane === 'express');
    assert.equal(lane.minimumMet, true);
    assert.equal(lane.progress, 1, 'progress must clamp at 1 once the minimum is met');
    assert.equal(lane.shortfallCents, 0);
  });
});

test('moving one line to the other lane moves that line only', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    const D = W.SHOPDATA;
    const exp = D.allProducts().filter((p) => D.isExpress(p.sku)).slice(0, 2);
    assert.equal(exp.length, 2, 'need two express products');
    W.SHOP.add(exp[0].sku, 1);
    W.SHOP.add(exp[1].sku, 1);
    const target = W.SHOP.lines().find((l) => l.sku === exp[0].sku);
    assert.equal(W.SHOP.setLane(target.id, 'scheduled'), true);
    const lanes = W.SHOP.lines().map((l) => l.sku + ':' + l.lane).sort().join(',');
    assert.equal(lanes, [exp[0].sku + ':scheduled', exp[1].sku + ':express'].sort().join(','),
      'the lane move took the wrong lines with it');
  });
});

test('category and rail filters compose, and both really narrow the grid', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    const D = W.SHOPDATA;
    W.SHOP.go('shop');
    await app.settle();
    const cards = () => countOf(app.text(), 'Add');    // one Add button per card

    const all = cards();
    assert.equal(all, D.allProducts().length, 'the unfiltered grid should be the whole catalogue');

    assert.equal(app.click('Flower'), true, 'the Flower category pill was not clickable');
    await app.settle();
    const flower = cards();
    assert.equal(flower, D.productsInCategory('Flower').length);
    assert.ok(flower < all, 'the category filter did not narrow anything');

    assert.equal(app.click('On Sale'), true, 'the On Sale rail chip was not clickable');
    await app.settle();
    const both = cards();
    assert.ok(both <= flower, 'adding a rail on top of a category widened the grid');
    const expected = D.productsInCategory('Flower')
      .filter((p) => D.railProducts('sale').some((r) => r.sku === p.sku)).length;
    assert.equal(both, expected, 'category and rail do not compose');
  });
});

test('the On Sale rail is the real markdown set, not a curated list', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    const D = W.SHOPDATA;
    const onSale = D.railProducts('sale').map((p) => p.sku).sort().join(',');
    const marked = D.allProducts().filter((p) => p.was != null).map((p) => p.sku).sort().join(',');
    assert.equal(onSale, marked);
    assert.ok(marked.length > 0, 'nothing is marked down — this proves nothing');
  });
});

test('the brand spotlight offers a discount the catalogue actually carries', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    const D = W.SHOPDATA;
    const sp = D.brandSpotlight();
    assert.notEqual(sp, null, 'no spotlight was produced');
    const pct = +(sp.offer.match(/(\d+)%/) || [])[1];
    const deepest = Math.max(...D.allProducts()
      .filter((p) => p.brand === sp.brand && p.was != null && p.was > p.price)
      .map((p) => Math.round(((p.was - p.price) / p.was) * 100)));
    assert.equal(pct, deepest, 'the spotlight advertises a markdown that brand does not have');
  });
});

test('a reorder card’s total is the sum of its own lines', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    for (const o of W.SHOPDATA.pastOrders()) {
      assert.ok(o.lines.length > 0, 'an empty past order tests nothing');
      const sum = o.lines.reduce((s, l) => s + l.paidCents * l.qty, 0);
      assert.equal(o.totalCents, sum, `${o.id}: the headline total is not its lines`);
      assert.ok(app.text().includes(W.SHOP.money(o.totalCents)),
        `${o.id}: the card did not render its own total`);
    }
  });
});

test('a screen that has not loaded says so instead of rendering nothing', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    W.SHOP.go('no-such-screen');
    await app.settle();
    assert.ok(app.text().includes('isn’t loaded'),
      'a missing screen rendered blank, which reads as "the shop is empty"');
  });
});

test('a screen registered through SHOPDATA.SCREENS is what the shell renders', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    // This is the seam the cart/checkout screens arrive through. If it does not
    // work, those screens can never appear no matter what they export.
    W.SHOPDATA.SCREENS.cart = () => W.React.createElement('div', null, 'CART-SEAM-OK');
    W.SHOP.go('cart');
    await app.settle();
    assert.ok(app.text().includes('CART-SEAM-OK'), 'the screen registry is not wired to the shell');
  });
});
