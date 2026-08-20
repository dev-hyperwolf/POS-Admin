/* ── THE STOREFRONT CART AND CHECKOUT, DRIVEN FOR REAL ──────────────────────
 *
 * These boot the actual storefront — engine, adapter, tokens, atoms,
 * shop/data.jsx, shop/screen-cart.jsx, shop/screen-checkout.jsx — render the
 * screens with real React into jsdom and click real buttons.
 *
 * 🔴 NOT ONE DOLLAR FIGURE IS PINNED. Every assertion is an INVARIANT read off
 * `window.SHOP.totals()` at the moment of the assertion:
 *
 *     the cart header total  ==  the checkout bar total
 *                            ==  the sum of the orders that get written
 *
 * A test that pinned $147.53 would pass a build that had merely re-rolled the
 * same wrong way twice, which is exactly how the last money bug survived.
 *
 * ⚠️ Values reached through `app.window` are jsdom-realm: compare primitives.
 * ⚠️ `app.click` matches text EXACTLY — anything partial passes a predicate,
 *    and every click's RETURN VALUE is asserted, because a test that clicks
 *    nothing and passes is the failure mode this harness replaces.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/**
 * Mount a screen into its OWN host node.
 *
 * ⚠️ Not `app.mount()` twice: that calls createRoot on the same #root, and a
 * second root on one container throws React's scheduler into "Should not
 * already be working", which then poisons every LATER test in the file rather
 * than failing the one that caused it.
 */
function screens(app) {
  const W = app.window;
  let cur = null;
  const close = () => {
    if (!cur) return;
    try { cur.root.unmount(); } catch { /* already gone */ }
    cur.host.remove();
    cur = null;
  };
  const open = async (name, props) => {
    close();
    assert.equal(typeof W[name], 'function', `${name} is not defined — the page did not finish loading`);
    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    root.render(W.React.createElement(W[name], props || {}));
    cur = { root, host };
    await app.settle();
    await app.settle();
    return host;
  };
  open.close = close;
  return open;
}

function withShop(fn) {
  return withApp('shop', async (app) => {
    const open = screens(app);
    try { await fn(app, app.window, open); } finally { open.close(); }
  }, { settleMs: 60 });
}

/** Two lanes, both comfortably over their minimums. Returns the skus used. */
function loadTwoLanes(W, expQty = 3, schQty = 3) {
  // A delivery order REQUIRES an address: an order with nowhere to go is refused
  // at the point of writing, and the place bar is `disabled` without one. This
  // has to be set BEFORE the bar renders — `disabled` is computed during render,
  // so setting it afterwards leaves a dead button and a test that places nothing.
  W.SCO_STATE.address = '123 Test St, Long Beach';
  const pool = W.SHOPDATA.allProducts().filter((p) => p.qty > 0 && p.price >= 20);
  assert.ok(pool.length >= 2, 'the catalogue must offer two items to build a two-lane cart');
  // ⚠️ THE EXPRESS SKU MUST BE ONE TODAY'S VAN CARRIES `expQty` OF.
  // Express is the driver's kit and the cart now caps that lane at the kit's
  // depth, so an arbitrary `pool[0]` — which the van may carry none of — puts
  // the whole "express" add into scheduled and leaves this fixture with ONE
  // lane and an undefined `laneOf(W, 'express')`.
  const exp = pool.find((p) => W.SHOPDATA.expressUnits(p.sku) >= expQty);
  assert.ok(exp, `nothing in the catalogue is on today's van ${expQty} deep — no express lane is buildable`);
  // The scheduled sku has to be van-carried too, or "Move to Express" on it is
  // a promise the driver cannot keep and the cart correctly refuses to offer it.
  const sch = pool.find((p) => p.sku !== exp.sku
    && W.SHOPDATA.expressUnits(p.sku) >= schQty);
  assert.ok(sch, 'the fixture needs a second van-carried sku deep enough to take both lanes');
  W.SHOP.add(exp.sku, expQty, 'express');
  W.SHOP.add(sch.sku, schQty, 'scheduled');
  assert.equal(W.SHOP.lines().length, 2, 'the fixture must build exactly two lines, one per lane');
  return { express: exp, scheduled: sch };
}

/** The lane record the engine currently reports. */
const laneOf = (W, id) => W.SHOP.totals().lanes.find((l) => l.lane === id);

// ── The counts ─────────────────────────────────────────────────────────────

test('"n ITEMS · n ORDERS" is the engine\'s count, not a count of the lines on screen', async () => {
  await withShop(async (app, W, open) => {
    // Two LINES carrying six ITEMS — the number that separates a real count
    // from `lines.length`, which is what a hand-rolled header would show.
    loadTwoLanes(W, 3, 3);
    const t = W.SHOP.totals();
    assert.equal(t.itemCount, 6);
    assert.equal(t.orderCount, 2);
    assert.equal(W.SHOP.lines().length, 2, 'two lines, six items — the whole point of this case');

    await open('ShopCartScreen');
    const text = app.text();
    assert.ok(text.includes(`${t.itemCount} ITEMS · ${t.orderCount} ORDERS`),
      `cart header must read the engine's counts; got: ${text.slice(0, 160)}`);
    assert.ok(!text.includes('2 ITEMS · 2 ORDERS'), 'that would be a count of LINES, not items');

    await open('ShopCheckoutScreen');
    assert.ok(app.text().includes(`${t.itemCount} ITEMS · ${t.orderCount} ORDERS`),
      'checkout header must read the same engine counts');
  });
});

// ── Lane assignment is per line, and the customer drives it ────────────────

test('"Move to Scheduled" moves that one line and the totals re-derive from the engine', async () => {
  await withShop(async (app, W, open) => {
    loadTwoLanes(W, 3, 3);
    await open('ShopCartScreen');

    const expBefore = laneOf(W, 'express').subtotalCents;
    const schBefore = laneOf(W, 'scheduled').subtotalCents;
    const totalBefore = W.SHOP.totals().totalCents;
    assert.ok(expBefore > 0 && schBefore > 0, 'both lanes must start with money in them');

    assert.ok(app.click('Move to Scheduled'), 'the express line must carry a Move to Scheduled control');
    await app.settle();

    const expAfter = laneOf(W, 'express');
    const schAfter = laneOf(W, 'scheduled');
    // The express lane is now empty, so the engine drops it entirely — one lane,
    // one order. That IS the re-derivation: nothing here recomputed anything.
    assert.equal(expAfter, undefined, 'the emptied express lane must leave the totals');
    assert.equal(schAfter.subtotalCents, schBefore + expBefore,
      'the moved line’s value must land in the other lane, to the cent');
    assert.equal(W.SHOP.totals().orderCount, 1, 'one lane left is one order');
    // The express FEE went with it, so the grand total must have changed.
    assert.notEqual(W.SHOP.totals().totalCents, totalBefore,
      'dropping the express lane drops its fee — the total cannot be unchanged');
  });
});

test('the converse control moves a scheduled line back to express', async () => {
  await withShop(async (app, W, open) => {
    loadTwoLanes(W, 3, 3);
    await open('ShopCartScreen');
    const expBefore = laneOf(W, 'express').subtotalCents;
    const schBefore = laneOf(W, 'scheduled').subtotalCents;

    assert.ok(app.click('Move to Express'), 'the scheduled line must carry a Move to Express control');
    await app.settle();

    assert.equal(laneOf(W, 'scheduled'), undefined);
    assert.equal(laneOf(W, 'express').subtotalCents, expBefore + schBefore);
  });
});

// ── The minimum is PROGRESS, not a blocker ─────────────────────────────────

test('an unmet minimum renders as progress and shortfall — and blocks nothing on the cart', async () => {
  await withShop(async (app, W, open) => {
    // One cheap line: under both lane minimums by construction, whatever they are.
    const cheap = W.SHOPDATA.allProducts().filter((p) => p.qty > 0 && p.price > 0)
      .sort((a, b) => a.price - b.price)[0];
    W.SHOP.add(cheap.sku, 1, 'express');
    const lane = laneOf(W, 'express');
    assert.equal(lane.minimumMet, false, 'this fixture must be under the express minimum');
    assert.ok(lane.shortfallCents > 0);
    assert.ok(lane.progress > 0 && lane.progress < 1, 'progress must be a partial fill, not 0 or 1');

    const host = await open('ShopCartScreen');
    const text = app.text();

    // The shortfall is shown, as the engine reports it.
    assert.ok(text.includes(W.SHOP.money(lane.shortfallCents)),
      'the cart must say how much more is needed');
    assert.ok(!text.includes('MIN MET'), 'the tick belongs to the met state only');

    // 🔴 And it is NOT an error: nothing is disabled and no alarm copy appears.
    const disabled = [...host.querySelectorAll('button')].filter((b) => b.disabled)
      .map((b) => (b.textContent || '').trim());
    assert.ok(!disabled.some((l) => /Checkout/.test(l)),
      `the cart must not block a customer who is part-way to a minimum; disabled: ${disabled.join('|')}`);
    for (const shouty of ['minimum not met', 'Minimum not met', 'required', 'Error', 'cannot']) {
      assert.ok(!text.includes(shouty), `"${shouty}" reads as failure; the frame draws progress`);
    }

    // The progress bar itself is rendered and partially filled.
    const bar = host.querySelector('[data-hw="lane-progress-express"]');
    assert.ok(bar, 'the lane must carry a progress bar');
    const fills = [...bar.querySelectorAll('div')].map((d) => d.style.width).filter(Boolean);
    assert.ok(fills.some((w) => /%$/.test(w) && parseFloat(w) > 0 && parseFloat(w) < 100),
      `the bar must be partially filled, not empty and not full; widths: ${fills.join(',')}`);
  });
});

test('a met minimum shows the MIN MET tick', async () => {
  await withShop(async (app, W, open) => {
    loadTwoLanes(W, 3, 3);
    assert.equal(laneOf(W, 'express').minimumMet, true, 'this fixture must clear the express minimum');
    await open('ShopCartScreen');
    assert.ok(app.text().includes('MIN MET'));
  });
});

// ── Delivery is priced PER LANE ────────────────────────────────────────────

test('the summary carries a separate delivery row per lane, each at that lane’s own fee', async () => {
  await withShop(async (app, W, open) => {
    loadTwoLanes(W, 3, 3);
    const exp = laneOf(W, 'express'), sch = laneOf(W, 'scheduled');
    assert.notEqual(exp.feeCents, sch.feeCents, 'this case is only meaningful when the lanes differ');

    await open('ShopCartScreen');
    const text = app.text();
    assert.ok(text.includes(`Express delivery${W.SHOP.money(exp.feeCents)}`),
      `the express row must carry the express fee; got: ${text}`);
    assert.ok(text.includes('Scheduled deliveryFREE'),
      'a zero fee reads FREE, on its own row');
    // A single blended "Delivery" row is the thing the frame rules out.
    assert.ok(!/(^|[^a-zA-Z])Delivery\$/.test(text), 'there must be no blended delivery row');
  });
});

// ── 🔴 ONE MONEY AUTHORITY ─────────────────────────────────────────────────

test('the cart button, the checkout bar and the orders that get written are ONE number', async () => {
  await withShop(async (app, W, open) => {
    loadTwoLanes(W, 3, 3);
    const t = W.SHOP.totals();
    assert.equal(t.canCheckout, true);
    const shown = W.SHOP.money(t.totalCents);

    await open('ShopCartScreen');
    assert.ok(app.text().includes(`Checkout · ${shown}`),
      'the cart’s checkout button must carry the engine total');

    await open('ShopCheckoutScreen');
    assert.ok(app.text().includes(`Place order${shown}`),
      'the place-order bar must carry the same engine total');

    const before = W.HW.ORDERS.length;
    assert.ok(app.click((s) => /CLICK TO PLACE ORDER/.test(s)), 'the place-order bar must be clickable');
    await app.settle();

    const written = W.HW.ORDERS.length - before;
    assert.equal(written, t.orderCount, 'one order per lane — the frame’s "2 ORDERS", written');

    let sum = 0;
    for (let i = 0; i < written; i++) sum += Math.round(W.HW.ORDERS[i].total * 100);
    assert.equal(sum, t.totalCents,
      'the orders must add back up to the figure the customer pressed, to the cent');
  });
});

test('each written order carries a money record — so the panel cannot invent a discount for it', async () => {
  await withShop(async (app, W, open) => {
    // ⚠️ THIS FIXTURE NEEDS A PROMOTION-FREE CART, and the signed-in customer is
    // no longer promotion-free: `loyaltyTier` used to read 'Wolfpack', which
    // matched no rule in the estate, so every cart came out at discountCents 0
    // by accident. It now reads the real tier ('Wolfpack Leader') and the
    // `wolfpack-10` rule fires on every cart. Stand the tier down HERE so the
    // no-promotion case this test is about still exists — the case where the
    // customer DOES qualify is covered in test/shop-van-promise.test.mjs.
    W.SHOPDATA.CUSTOMER.engine.loyaltyTier = 'no-such-tier';
    loadTwoLanes(W, 3, 3);
    const t = W.SHOP.totals();
    assert.equal(t.discountCents, 0, 'this fixture has no promotion, which is what makes the next line meaningful');

    await open('ShopCheckoutScreen');
    const before = W.HW.ORDERS.length;
    assert.ok(app.click((s) => /CLICK TO PLACE ORDER/.test(s)));
    await app.settle();
    const written = W.HW.ORDERS.length - before;
    assert.equal(written, 2);

    for (let i = 0; i < written; i++) {
      const o = W.HW.ORDERS[i];
      assert.ok(o.money, `${o.id} must be filed with a money record`);
      // `seedOrderMoney` invents a "Veteran 10%" for any order that arrives
      // without one. A real web receipt must never acquire a discount nobody gave.
      assert.equal(o.money.discAmt, 0, `${o.id} must not carry a discount the cart never gave`);
      assert.equal(o.money.credits, 0);
      assert.ok(o.money.lines.length > 0, `${o.id} must carry its own lines`);
      const lane = t.lanes.find((l) => l.lane === o.money.lane);
      assert.ok(lane, `${o.id} must name the lane it came from`);
      assert.equal(o.items, lane.itemCount, `${o.id} must carry that lane's item count`);
      // The lane's own fee is filed as its own line, never blended into a product.
      const feeLines = o.money.lines.filter((l) => /^DLV-/.test(l.sku));
      assert.equal(feeLines.length, lane.feeCents > 0 ? 1 : 0,
        `${o.id} must itemise its delivery fee exactly when it has one`);
      if (lane.feeCents > 0) assert.equal(Math.round(feeLines[0].total * 100), lane.feeCents);
      // The lines are the money: they must sum to the lane's charged goods.
      const linesCents = o.money.lines.reduce((s, l) => s + Math.round(l.total * 100), 0);
      assert.equal(linesCents, lane.subtotalCents + lane.feeCents,
        `${o.id}'s lines must sum to its lane's subtotal plus its own fee`);
    }
  });
});

test('an under-minimum cart cannot be placed, and says so as progress rather than as an error', async () => {
  await withShop(async (app, W, open) => {
    const cheap = W.SHOPDATA.allProducts().filter((p) => p.qty > 0 && p.price > 0)
      .sort((a, b) => a.price - b.price)[0];
    W.SHOP.add(cheap.sku, 1, 'express');
    assert.equal(W.SHOP.totals().canCheckout, false);

    const host = await open('ShopCheckoutScreen');
    const before = W.HW.ORDERS.length;
    const bar = host.querySelector('[data-hw="place-bar"]');
    assert.ok(bar, 'the place-order bar must render even when it is not yet pressable');
    const btn = bar.querySelector('button');
    assert.equal(btn.disabled, true, 'placing must be refused while a lane is under its minimum');

    // Refused at the STORE too, not only in the UI — a disabled button is not a guard.
    assert.equal(app.click((s) => /CLICK TO PLACE ORDER/.test(s)), true, 'the button is present');
    await app.settle();
    assert.equal(W.HW.ORDERS.length, before, 'nothing may be written from a cart the engine refuses');

    assert.ok(app.text().includes('Almost there'), 'the copy must read as progress, not as a failure');
  });
});

// ── The tip ────────────────────────────────────────────────────────────────

test('the tip is express-only, is derived from the express subtotal, and IS charged', async () => {
  await withShop(async (app, W, open) => {
    loadTwoLanes(W, 3, 3);
    const t = W.SHOP.totals();
    const exp = t.lanes.find((l) => l.lane === 'express');
    const totalBefore = t.totalCents;

    const host = await open('ShopCheckoutScreen');
    // Drawn on the express lane only.
    assert.ok(host.querySelector('[data-hw="checkout-lane-express"] [data-hw="tip-express"]'),
      'the tip selector belongs to the express lane');
    assert.equal(host.querySelector('[data-hw="checkout-lane-scheduled"] [data-hw="tip-express"]'), null,
      'a scheduled order has no driver on the way — no tip selector');

    assert.ok(app.click('20%'), 'the 20% step must be clickable');
    await app.settle();

    const expectedTip = Math.round(exp.subtotalCents * 0.20);
    assert.ok(app.text().includes(W.SHOP.money(expectedTip)),
      'the tip must be shown, derived from the express lane subtotal');
    // ⚠️ THIS ASSERTION USED TO SAY THE OPPOSITE. It read "the tip is captured,
    // not charged — the priced total must not move", which was a reasonable
    // reading of the tax rule (a stated gratuity is not taxable, and the money
    // record had no post-tax slot). The owner overruled it: the tip IS charged.
    // The tax concern was real and is handled by giving the record a post-tax
    // slot, mirroring `credits`, rather than by not charging.
    assert.equal(W.SHOP.totals().totalCents, totalBefore,
      'the ENGINE total must not move — the tip is not merchandise and is not taxed');

    const before = W.HW.ORDERS.length;
    assert.ok(app.click((s) => /CLICK TO PLACE ORDER/.test(s)));
    await app.settle();
    const written = W.HW.ORDERS.length - before;
    let byLane = {};
    for (let i = 0; i < written; i++) byLane[W.HW.ORDERS[i].money.lane] = W.HW.ORDERS[i];
    // ⚠️ THE KEY IS `tip`, NOT `tipAmt`. priceOrderMoney (pos/screen-orders.jsx)
    // reads `m.tip`; filing it under any other name means the storefront quotes
    // a tipped total and the order panel prices an untipped one — two money
    // authorities across two surfaces. A mutation that renamed this key survived
    // four other tip tests, which is why the assertion is on the KEY and on the
    // FILED TOTAL rather than on the stored number alone.
    assert.equal(Math.round(byLane.express.money.tip * 100), expectedTip,
      'the tip is recorded on the express order, under the key the pricer reads');
    assert.equal(byLane.scheduled.money.tip, 0, 'and on no other order');

    // And it was actually CHARGED: the filed total carries it.
    const exLane = W.SHOP.totals ? null : null;
    assert.equal(
      Math.round(byLane.express.total * 100) - Math.round(byLane.express.money.tip * 100)
        + Math.round(byLane.scheduled.total * 100),
      totalBefore,
      'the two filed orders minus the tip must reconcile to the engine total');
  });
});

// ── The dead-end that must not be a broken screen ──────────────────────────

test('with no engine the cart refuses to show a number rather than showing a wrong one', async () => {
  await withShop(async (app, W, open) => {
    loadTwoLanes(W, 3, 3);
    const real = W.SHOP.totals;
    W.SHOP.totals = () => null;      // exactly what shop/data.jsx does when the engine is absent
    try {
      await open('ShopCartScreen');
      assert.ok(app.text().includes('can’t be priced'), 'an honest dead end, not a page of NaN');
      await open('ShopCheckoutScreen');
      assert.ok(app.text().includes('can’t be priced'));
    } finally { W.SHOP.totals = real; }
  });
});

// ── The column must add up to its own bottom line ──────────────────────────

/** Read the ORDER SUMMARY as { rows: [signed cents], total: cents }. */
function readSummary(host) {
  const card = host.querySelector('[data-hw="order-summary"]');
  assert.ok(card, 'the order summary must render');
  const parse = (s) => {
    const t = (s || '').trim();
    if (/^FREE$/i.test(t)) return 0;
    const neg = t.startsWith('−') || t.startsWith('-');
    const n = Number(t.replace(/[^0-9.]/g, ''));
    assert.ok(Number.isFinite(n), `unreadable summary figure: "${t}"`);
    return Math.round(n * 100) * (neg ? -1 : 1);
  };
  const rows = [], out = { rows, total: null };
  for (const r of card.querySelectorAll('[data-hw="sum-row"]')) {
    const cents = parse(r.querySelector('[data-hw="sum-value"]').textContent);
    if (r.getAttribute('data-hw-kind') === 'total') out.total = cents;
    else rows.push(cents);
  }
  assert.notEqual(out.total, null, 'the summary must carry a Total row');
  return out;
}

test('the order summary adds up to its own Total — including when a promotion waives a fee', async () => {
  await withShop(async (app, W, open) => {
    // Push the express lane over the built-in free-delivery threshold, which is
    // the case that first broke this: a fee waiver is reported in `discounts`
    // but never enters `discountCents`, so printing it as a price row put a
    // figure in the column that was never subtracted from the Total.
    const pool = W.SHOPDATA.allProducts().filter((p) => p.qty > 0 && p.price >= 20);
    // Same van-depth constraint as `loadTwoLanes`: six units only stay in the
    // express lane if the driver is carrying six.
    const exp = pool.find((p) => W.SHOPDATA.expressUnits(p.sku) >= 6);
    assert.ok(exp, 'nothing on today’s van is six deep — no express lane is buildable');
    W.SHOP.add(exp.sku, 6, 'express');
    W.SHOP.add(pool.find((p) => p.sku !== exp.sku).sku, 3, 'scheduled');
    const t = W.SHOP.totals();
    const waivers = t.discounts.filter((d) => d.kind === 'fee_waiver');
    assert.ok(waivers.length > 0, 'this fixture must actually trigger a fee waiver');
    assert.equal(t.lanes.find((l) => l.lane === 'express').feeWaived, true);

    const host = await open('ShopCartScreen');
    const s = readSummary(host);
    const sum = s.rows.reduce((a, b) => a + b, 0);
    assert.equal(sum, s.total,
      `every figure in the summary must add up to the Total it sits above; rows ${s.rows.join('+')} vs total ${s.total}`);
    assert.equal(s.total, t.totalCents, 'and that Total is the engine\'s');

    // The waiver is still NAMED — it just is not double-counted as a price row.
    assert.ok(app.text().includes(waivers[0].name), 'the waiver must still be visible to the customer');
    assert.ok(app.text().includes('FEE WAIVED'), 'and the lane must say its fee was waived');
  });
});

test('the checkout summary adds up to the figure on the place-order bar', async () => {
  await withShop(async (app, W, open) => {
    loadTwoLanes(W, 3, 3);
    const t = W.SHOP.totals();
    const host = await open('ShopCheckoutScreen');
    const s = readSummary(host);
    assert.equal(s.rows.reduce((a, b) => a + b, 0), s.total);
    assert.equal(s.total, t.totalCents);
    assert.ok(app.text().includes(`Place order${W.SHOP.money(s.total)}`),
      'the bar must carry the same figure the column ends on');
  });
});
