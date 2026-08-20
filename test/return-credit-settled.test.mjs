/* AN ORDER THAT COLLECTED NOTHING MUST NOT CLAIM IT WAS REFUNDED.
 *
 * `refundCap <= 0` is true in two completely different situations:
 *   1. a return really has given everything back;
 *   2. the order collected nothing in the first place, because wallet or reward
 *      credit covered it — priceOrderMoney says `grand = gross - credits`, so an
 *      order settled entirely on credit has grand 0 from the moment it was rung
 *      up, before anyone has returned anything.
 *
 * Both rendered "Everything this order collected has already been given back."
 * In case 2 that is a false statement about money, on the screen an operator
 * uses to decide whether a customer is owed something.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

function panel(app) {
  const W = app.window;
  let cur = null;
  const close = () => { if (!cur) return; try { cur.root.unmount(); } catch {} cur.host.remove(); cur = null; };
  const open = async (id) => {
    close();
    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    root.render(W.React.createElement(W.OrderDetails, { o: W.HW.orderById(id), onClose() {} }));
    cur = { root, host };
    await app.settle(); await app.settle();
    return host;
  };
  open.close = close;
  return open;
}

test('an order settled entirely on credit does NOT claim it was refunded', async () => {
  await withApp('pos', async (app) => {
    const W = app.window, HW = W.HW;
    const p = HW.PRODUCTS.find((x) => x.active);
    const m = HW.MEMBERS[0];
    const o = HW.addOrder({ name: m.name, memberId: m.id, items: 1, stage: 'done',
      lines: [{ name: p.name, brand: p.brand, cat: p.cat, qty: 1, price: p.price, total: p.price }] });
    // Credit covers everything, so grand is 0 and nothing was ever collected.
    HW.updateOrder(o.id, { credits: 99999 });

    const open = panel(app);
    try {
      await open(o.id);
      const t = app.text();
      assert.doesNotMatch(t, /has already been given back/,
        'nothing was given back — the order collected nothing to begin with');
      assert.match(t, /collected no money|credit covered it/i,
        'the panel must say why there is nothing to return');
    } finally { open.close(); }
  });
});

test('an order that really WAS fully refunded still says so', async () => {
  await withApp('pos', async (app) => {
    const W = app.window, HW = W.HW;
    const p = HW.PRODUCTS.find((x) => x.active);
    const m = HW.MEMBERS[0];
    const o = HW.addOrder({ name: m.name, memberId: m.id, items: 1, stage: 'done',
      lines: [{ name: p.name, brand: p.brand, cat: p.cat, qty: 1, price: p.price, total: p.price }] });

    const open = panel(app);
    try {
      await open(o.id);
      const rec = HW.orderById(o.id);
      // ⚠️ THE FIELD IS `returns`, NOT `claims` — screen-orders.jsx:2302 reads
      // `o.returns`. My first version wrote `claims`, so refundedSoFar stayed 0
      // and this control reported the WRONG state while looking like a real
      // failure of the fix. A negative control that is wired to nothing is
      // exactly as useless as the tests it exists to protect against.
      HW.updateOrder(o.id, { returns: [{ id: 'r1', amount: rec.total, at: 'now', lines: [] }] });
      await open(o.id);
      const t = app.text();
      // THE NEGATIVE CONTROL for the test above: if this stopped saying it, the
      // first test would pass for the wrong reason.
      assert.match(t, /has already been given back/,
        'a genuinely refunded order must still report that it was refunded');
    } finally { open.close(); }
  });
});
