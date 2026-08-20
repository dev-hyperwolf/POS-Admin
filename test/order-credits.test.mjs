/* The two blockers three refuters found IN the money-authority wave itself.
 *
 * Both are the shape that wave existed to kill: the order record and what
 * actually happened disagree. The suite was GREEN at 169 while both were live —
 * worth remembering that a passing suite was not evidence.
 *
 * ⚠️ These assert INVARIANTS, never pinned dollar figures. My first draft of
 * this file failed against CORRECT code because I had invented a gross of
 * $44.35 when the real tax makes it $49.29 — a test pinned to a number I made
 * up tests my arithmetic, not the app's.
 *
 * ⚠️ OrderDetails needs { o, onClose } and its own host node. app.mount()
 * re-roots #root and throws React into "Should not already be working", which
 * poisons LATER tests instead of failing the one at fault.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

function mounter(app) {
  const W = app.window;
  let cur = null;
  const close = () => { if (!cur) return; try { cur.root.unmount(); } catch {} cur.host.remove(); cur = null; };
  const open = async (id) => {
    close();
    const rec = W.HW.orderById(id);
    assert.ok(rec, `${id} is not in the order book`);
    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    root.render(W.React.createElement(W.OrderDetails, { o: rec, onClose() {} }));
    cur = { root, host };
    await app.settle(); await app.settle();
  };
  open.close = close;
  return open;
}

// The line must name a REAL catalogue product: AddItemPanel lists
// window.HW.PRODUCTS, and draftAdd merges by name — an invented product would
// take the "new line" branch and never exercise the merge that had the bug.
const realLine = (HW) => {
  const p = HW.PRODUCTS.find((x) => x.active);
  assert.ok(p, 'the catalogue must hold an active product');
  return { name: p.name, brand: p.brand, cat: p.cat, qty: 1, price: p.price, total: p.price };
};
const mk = (HW, tag, patch) => {
  const r = HW.addOrder({ name: tag, items: 1, stage: 'verify', pay: 'Card', source: 'Stilo',
    lines: [realLine(HW)] });
  if (patch) HW.updateOrder(r.id, patch);
  return r.id;
};

test('a credit taken at the drawer survives the panel, and survives it twice', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const open = mounter(app);
    const plain = mk(HW, 'No Credit');
    const credited = mk(HW, 'With Credit', { credits: 10 });
    try {
      await open(plain);
      const gross = HW.orderById(plain).total;

      await open(credited);
      const once = HW.orderById(credited).total;
      assert.equal(+(gross - once).toFixed(2), 10,
        'the credit was handed back: the panel re-derived the total from the lines alone');

      // Idempotence is the real guarantee. Re-opening an order is exactly when
      // a third figure used to appear.
      await open(credited);
      assert.equal(HW.orderById(credited).total, once,
        `opening the order a second time moved the money again: ${once} -> ${HW.orderById(credited).total}`);
    } finally { open.close(); }
  });
});

test('a credit comes off the GRAND total, never off the taxable base', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const open = mounter(app);
    // A credit is not a discount: the sale was for the full amount and part of
    // it was settled another way. Taxing the post-credit figure under-collects
    // tax on a real sale.
    const a = mk(HW, 'Tax A'), b = mk(HW, 'Tax B', { credits: 10 });
    try {
      await open(a); const plain = HW.orderById(a).total;
      await open(b); const cred = HW.orderById(b).total;
      assert.equal(+(plain - cred).toFixed(2), 10,
        'a credit must move the total by exactly its own value — no more, no less');
    } finally { open.close(); }
  });
});

test('adding a unit of something already on the order costs money', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const open = mounter(app);
    const id = mk(HW, 'Add Probe');
    const sub = () => {
      const m = app.text().match(/New subtotal\$([\d,.]+)/);
      assert.ok(m, 'the edit panel must show a subtotal to compare');
      return +m[1].replace(/,/g, '');
    };
    try {
      await open(id);
      assert.ok(app.click('Edit order'), 'the edit panel must open');
      await app.settle();
      const before = sub();

      assert.ok(app.click('Add item'), 'the add-item control must be reachable');
      await app.settle();
      // The SAME product, so it takes draftAdd's merge branch — the one that
      // used to keep the line's stale `total` while bumping the quantity, so
      // the count moved and not one cent did.
      // The picker's add control is labelled 'Add' for a new product and
      // 'In order (N)' for one already on the order — so THIS label is proof we
      // are taking draftAdd's merge branch, the one that had the bug, rather
      // than appending a fresh line that would have priced correctly anyway.
      assert.ok(app.click((t) => /^In order \(\d+\)$/.test(t)),
        `the picker must offer the already-present product; saw: ${app.buttons().join(' | ').slice(0, 300)}`);
      await app.settle();

      assert.ok(sub() > before,
        `the quantity moved and the money did not: subtotal stayed at $${before.toFixed(2)}`);
    } finally { open.close(); }
  });
});
