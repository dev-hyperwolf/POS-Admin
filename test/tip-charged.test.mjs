/* THE TIP IS CHARGED — the owner's decision — AND NOT TAXED.
 *
 * Three reviewers independently found the same thing: the selector was drawn
 * exactly as the Figma has it, the amount was stored on the order, and selecting
 * 20% moved the place-order total by nothing. `grep -arn tipAmt` over the whole
 * estate returned ONE hit: the write.
 *
 * A stated gratuity is not taxable in California, so it cannot be a line — it is
 * the exact mirror of `credits`: outside the taxed base, applied to the grand
 * total after tax. A credit is money the customer already put in; a tip is money
 * they are adding on top. Same slot, opposite sign.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

const line = (p) => ({ name: p.name, brand: p.brand, cat: p.cat, qty: 1, price: p.price, total: p.price });

test('a tip raises the order total by exactly its own value', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const p = HW.PRODUCTS.find((x) => x.active);
    const mk = (tip) => {
      const o = HW.addOrder({ name: 'Tip Probe ' + tip, items: 1, stage: 'verify', lines: [line(p)] });
      if (tip) HW.updateOrder(o.id, { tipAmt: tip });
      return o.id;
    };
    const plain = mk(0), tipped = mk(10);

    const host = app.window.document.createElement('div');
    app.window.document.body.appendChild(host);
    const root = app.window.ReactDOM.createRoot(host);
    const open = async (id) => {
      root.render(app.window.React.createElement(app.window.OrderDetails,
        { o: HW.orderById(id), onClose() {} }));
      await app.settle(); await app.settle();
    };
    try {
      await open(plain);  const a = HW.orderById(plain).total;
      await open(tipped); const b = HW.orderById(tipped).total;
      assert.equal(+(b - a).toFixed(2), 10,
        'the tip must move the total by exactly its own value — no more, no less');
    } finally { root.unmount(); host.remove(); }
  });
});

test('the tip is NOT taxed — it sits outside the taxable base', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const p = HW.PRODUCTS.find((x) => x.active);
    const o = HW.addOrder({ name: 'Tax Probe', items: 1, stage: 'verify', lines: [line(p)] });
    HW.updateOrder(o.id, { tipAmt: 20 });

    const host = app.window.document.createElement('div');
    app.window.document.body.appendChild(host);
    const root = app.window.ReactDOM.createRoot(host);
    root.render(app.window.React.createElement(app.window.OrderDetails,
      { o: HW.orderById(o.id), onClose() {} }));
    await app.settle(); await app.settle();
    try {
      const m = HW.orderById(o.id).money;
      assert.ok(m, 'the order must carry a money record');
      // If the tip were taxed, the taxable base would have grown by 20.
      const merch = m.lines.reduce((s, l) => s + (l.total != null ? +l.total : l.price * l.qty), 0);
      const taxed = HW.taxBreakdown(merch).total;
      const expected = +(merch + taxed + 20).toFixed(2);
      assert.equal(HW.orderById(o.id).total, expected,
        'the tip was folded into the taxed base — a stated gratuity is not taxable');
    } finally { root.unmount(); host.remove(); }
  });
});

test('a tip survives an order discounted to nothing', async () => {
  await withApp('pos', async (app) => {
    const W = app.window, HW = W.HW;
    const p = HW.PRODUCTS.find((x) => x.active);
    const o = HW.addOrder({ name: 'Zero Probe', items: 1, stage: 'verify', lines: [line(p)] });
    // Clamping the tip together with the credits would silently swallow it: the
    // customer still owes the gratuity they chose to add.
    HW.updateOrder(o.id, { tipAmt: 5, credits: 99999 });

    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    root.render(W.React.createElement(W.OrderDetails, { o: HW.orderById(o.id), onClose() {} }));
    await app.settle(); await app.settle();
    try {
      assert.equal(HW.orderById(o.id).total, 5,
        'the order settled to zero and the tip went with it');
    } finally { root.unmount(); host.remove(); }
  });
});

test('the storefront QUOTES the tip it is about to charge', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, HW = W.HW, SHOP = W.SHOP, D = W.SHOPDATA;
    HW.resetLaneSettings();
    const ex = D.allProducts().find((x) => D.isExpress(x.sku));
    SHOP.clear(); SHOP.add(ex.sku, 8, 'express');
    W.SCO_STATE.address = '1 Test St';

    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    const render = async () => {
      root.render(W.React.createElement(W.ShopCheckoutScreen, {}));
      await app.settle(); await app.settle();
    };
    try {
      W.SCO_STATE.tip = { mode: 'none', pct: 0, customCents: 0 };
      await render();
      const before = W.SHOP.totals().totalCents;

      W.SCO_STATE.tip = { mode: 'pct', pct: 20, customCents: 0 };
      await render();
      const shown = app.text();
      const t = W.SHOP.totals();
      const ex2 = t.lanes.find((l) => l.lane === 'express');
      const tipCents = Math.round(ex2.subtotalCents * 0.2);
      assert.ok(tipCents > 0, 'the fixture must produce a non-zero tip');
      assert.ok(shown.includes(W.SHOP.money(before + tipCents)),
        `the place bar must quote the tipped total ${W.SHOP.money(before + tipCents)}`);
    } finally { root.unmount(); host.remove(); HW.resetLaneSettings(); }
  });
});
