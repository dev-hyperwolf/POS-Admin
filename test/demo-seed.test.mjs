/* The demo seeder, driven through its own panel.
 *
 * "make sure we can quickly add more demo data easily" + "right now everything
 * is super confusing I dont even know what to do".
 *
 * So these assert two different things, and the second is the one that matters:
 * that the record is created, AND that clicking the panel button is what creates
 * it. An API nobody can reach is the same as no API.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

test('the panel mounts itself on the POS, with every control', async () => {
  await withApp('pos', async (app) => {
    const panel = app.document.querySelector('[data-hw-seed]');
    assert.ok(panel, 'no demo-data panel — the seeder would be console-only again');
    const labels = [...panel.querySelectorAll('button')].map((b) => (b.textContent || '').trim());
    for (const want of ['Clean', 'High risk', 'New product', 'New customer']) {
      assert.ok(labels.some((l) => l.startsWith(want)), `missing control: ${want}`);
    }
  });
});

test('a Weedmaps order creates BOTH records — the pair that must agree', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW, Seed = app.window.HWSeed;
    const before = HW.ORDERS.length;
    const r = Seed.weedmapsOrder('clean');

    assert.equal(r.ok, true, r.message);
    assert.equal(HW.ORDERS.length, before + 1, 'it must reach the queue');
    // The trap this exists to remove: an order row with no WM_ORDER entry
    // renders in the queue and then crashes the detail view.
    assert.ok(HW.WM_ORDER[r.id], 'the paired WM_ORDER entry is missing — the POS would crash on open');
    assert.equal(HW.ORDERS[0].id, r.id, 'newest first, so you can actually see it');
    assert.equal(HW.ORDERS[0].source, 'Weedmaps');
  });
});

test('every preset produces a coherent order', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW, Seed = app.window.HWSeed;
    for (const preset of Seed.presets) {
      const r = Seed.weedmapsOrder(preset);
      assert.equal(r.ok, true, `${preset}: ${r.message}`);
      const wm = HW.WM_ORDER[r.id];
      assert.ok(wm.checks && wm.contact && typeof wm.risk === 'number', `${preset}: incomplete WM record`);
      assert.ok(r.next && r.where, `${preset}: says nothing about where it went`);
      assert.ok(r.record.total > 0, `${preset}: an order with no money in it is not testable`);
    }
  });
});

test('CLICKING the panel is what creates it, not just the API', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const before = HW.ORDERS.length;
    const panel = app.document.querySelector('[data-hw-seed]');
    const btn = [...panel.querySelectorAll('button')].find((b) => (b.textContent || '').startsWith('Clean'));
    assert.ok(btn, 'no Clean button');
    btn.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true }));
    await app.settle();

    assert.equal(HW.ORDERS.length, before + 1, 'the button did nothing — the exact defect this suite exists for');
    assert.match(panel.textContent, /Created/, 'it must report back');
    assert.match(panel.textContent, /Where:/, 'and say where it went');
  });
});

test('a product and a customer both land where they are findable', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW, Seed = app.window.HWSeed;
    const p = Seed.product({ name: 'Test Kush', price: 42 });
    assert.equal(p.ok, true);
    assert.ok(HW.PRODUCTS.some((x) => x.id === p.id), 'not in the catalogue');
    assert.equal(HW.PRODUCTS.find((x) => x.id === p.id).price, 42);

    const c = Seed.customer({ name: 'Test Person' });
    assert.equal(c.ok, true);
    assert.ok(HW.MEMBERS.some((m) => m.id === c.id), 'not in members');
    // Ids must not collide with the seeded ones already there.
    assert.equal(new Set(HW.MEMBERS.map((m) => m.id)).size, HW.MEMBERS.length, 'duplicate member id');
  });
});
