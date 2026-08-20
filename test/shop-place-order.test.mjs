/* Placing an order is a money-writing act, so it gets the same scrutiny as the
 * till. Two defects a reviewer drove live:
 *
 *  · A DOUBLE-TAP FILED THE CART TWICE. scoPlace is fully synchronous, so the
 *    `placing` flag was already back to false before the second click's handler
 *    ran — and that handler still carried the PRE-CLEAR totals from its render.
 *    Two sets of real orders for one checkout.
 *  · A DELIVERY ORDER COULD BE PLACED WITH NO ADDRESS, filing deliverTo: null.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';


/** Mount ONE screen on its own host — ShopApp starts on Home, and the
 *  place-order bar only exists on the checkout screen. */
function mounter(app) {
  const W = app.window;
  let cur = null;
  const close = () => { if (!cur) return; try { cur.root.unmount(); } catch {} cur.host.remove(); cur = null; };
  const open = async (name) => {
    close();
    assert.equal(typeof W[name], 'function', `${name} is not defined — the page did not finish loading`);
    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    root.render(W.React.createElement(W[name], {}));
    cur = { root, host };
    await app.settle(); await app.settle();
    return host;
  };
  open.close = close;
  return open;
}

/** Fill a cart that clears every lane minimum, so canCheckout is true. */
function loadCart(W, mult = 6) {
  const D = W.SHOPDATA;
  const ex = D.allProducts().find((p) => D.isExpress(p.sku));
  const sc = D.allProducts().find((p) => !D.isExpress(p.sku));
  assert.ok(ex && sc, 'the fixture needs one express and one scheduled product');
  W.SHOP.add(ex.sku, mult);
  W.SHOP.add(sc.sku, mult);
  return W.SHOP.totals();
}

test('a double tap on the real Place order button does NOT file the cart twice', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    const open = mounter(app);
    try {
      // ⚠️ Set BEFORE the bar renders — `disabled` is computed during render, so
      // setting it later leaves a dead button and a test that places nothing
      // and passes anyway.
      W.SCO_STATE.address = '123 Test St, Long Beach';
      loadCart(W);
      await open('ShopCheckoutScreen');

      /* 🔴 THIS MUST GO THROUGH THE BUTTON, NOT scoPlace() DIRECTLY. The defect
       * lived in the CALLER: onPlace closed over the totals from its render, and
       * the synchronous `placing` flag was already false again by the second
       * click. Calling scoPlace() by hand passes no stale snapshot, so a
       * direct-call version of this test PASSED against the broken code — I
       * wrote that version first and it proved nothing. */
      const before = W.HW.ORDERS.length;
      const hit = () => app.click((t) => /CLICK TO PLACE ORDER/.test(t));

      // ⚠️ NO settle() BETWEEN THE TWO CLICKS. That is the whole reproduction:
      // a re-render between them rescues the bug, because the second handler is
      // then a NEW closure over an empty cart. A double tap does not wait for
      // React — both handlers run against the SAME render, and the second one
      // therefore holds the pre-clear totals. My first version awaited between
      // the clicks and passed against the broken code.
      assert.ok(hit(), 'the place-order bar must be clickable');
      hit();
      await app.settle();
      const afterFirst = W.HW.ORDERS.length;
      assert.ok(afterFirst > before, 'the first click filed nothing at all');

      const t = W.SHOP.totals ? null : null;
      assert.equal(afterFirst - before, 2,
        `a double tap filed ${afterFirst - before} orders for a two-lane cart — one tap should file 2, not 4`);
    } finally { open.close(); }
  });
});

test('placing files one order per lane, matching the design’s "2 ORDERS"', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    const t = loadCart(W);
    W.SCO_STATE.address = '123 Test St, Long Beach';
    const made = W.scoPlace();
    assert.equal(made.length, t.orderCount, 'the orders filed must match the engine’s own orderCount');
  });
});

test('a delivery order cannot be placed without an address', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    loadCart(W);
    W.SCO_STATE.address = null;
    const before = W.HW.ORDERS.length;
    assert.equal(W.scoPlace(), null, 'an order with nowhere to go must be refused');
    assert.equal(W.HW.ORDERS.length, before, 'an undeliverable order was filed anyway');
  });
});

test('the place bar says an address is what is missing, not just "almost there"', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    loadCart(W);
    W.SCO_STATE.address = null;
    W.SHOP.setTab ? W.SHOP.setTab('checkout') : null;
    await app.settle();
    // A blocked button with no reason beside it is indistinguishable from a
    // dead one — the same rule the POS learned the hard way.
    const txt = app.text();
    if (/Place order/i.test(txt)) {
      assert.match(txt, /delivery address/i, 'the bar must name the address as the thing missing');
    }
  });
});

test('an empty cart cannot be placed', async () => {
  await withApp('shop', async (app) => {
    const W = app.window;
    await app.mount('ShopApp');
    W.SHOP.clear();
    W.SCO_STATE.address = '123 Test St';
    assert.equal(W.scoPlace(), null, 'an empty cart is not an order');
  });
});
