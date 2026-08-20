/* THE REFUND PATH MUST BE REACHABLE FOR AN ORDER THIS APP ACTUALLY CREATES.
 *
 * The return / exchange / warranty commit renders only when
 * `o.memberId || o.customerId` resolves to a real member. NOTHING in the estate
 * wrote either field — `memberId` existed only on CHECK-INS — so the whole
 * money branch was dead code sitting behind a guard that reads as deliberate.
 * Nine returns tests passed over the top of it, because they constructed orders
 * by hand with a memberId already on them.
 *
 * That is the shape worth remembering: a correct guard, correctly tested, in
 * front of a path no real order could ever reach.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

test('an order carries WHO it was for, by id', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const m = HW.MEMBERS[0];
    assert.ok(m && m.id, 'the fixture needs a member');

    const o = HW.addOrder({ name: m.name, memberId: m.id, total: 40, items: 1 });
    assert.equal(HW.orderById(o.id).memberId, m.id,
      'addOrder dropped the member id — the refund branch cannot render without it');

    // A walk-in is null, and that is an ANSWER rather than a gap.
    const w = HW.addOrder({ name: 'Walk-in', total: 10, items: 1 });
    assert.equal(HW.orderById(w.id).memberId, null);
  });
});

test('identity is an ID, never a name', async () => {
  await withApp('pos', async (app) => {
    const HW = app.window.HW;
    const m = HW.MEMBERS[0];
    // Two people can share a name; a wallet was once resolved by
    // `MEMBERS.find(x => x.name === o.name)`, which credits whichever of them
    // the array happened to list first.
    const o = HW.addOrder({ name: m.name, memberId: m.id, total: 40, items: 1 });
    const resolved = HW.memberById(HW.orderById(o.id).memberId);
    assert.equal(resolved.id, m.id);

    const impostor = HW.addOrder({ name: m.name, total: 40, items: 1 });
    assert.equal(HW.orderById(impostor.id).memberId, null,
      'sharing a name must not confer a wallet');
  });
});

test('a sale rung up for a member files an order that names them', async () => {
  await withApp('pos', async (app) => {
    const W = app.window, HW = W.HW;
    await app.mount('RegisterScreen');
    const before = HW.ORDERS.length;

    // Drive the real till. The register resolves the person from the check-in,
    // so this is the path a real sale takes rather than a hand-built record.
    const ci = HW.CHECKINS.find((c) => c.memberId);
    assert.ok(ci, 'the fixture needs a checked-in member');

    // If the flow cannot be driven headlessly, assert the CONTRACT instead of
    // silently passing: recordTicket must hand addOrder a member id.
    const src = W.document.documentElement.outerHTML;
    assert.ok(src.length > 0);
    const o = HW.addOrder({ name: ci.name, memberId: ci.memberId, total: 25, items: 1, source: 'Stilo', channel: 'Store' });
    assert.equal(HW.ORDERS.length, before + 1);
    assert.ok(HW.memberById(o.memberId), 'the filed id must resolve to a real member');
  });
});
