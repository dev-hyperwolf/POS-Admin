/* shared/commerce-governance.js — the GOVERNED post-submission bridge.
 *
 * What is actually at risk here is not ranking. It is that a live order — money
 * already agreed, a customer already holding a receipt — gets changed by the
 * wrong person, for the wrong money, losing a discount nobody mentioned, with
 * no record of it. Every test below is aimed at one of those four.
 *
 * Two of them are written as A/B RUNS rather than as fixed expectations,
 * because a fixed expectation cannot tell "the kit excluded it" from "the
 * ranker never wanted it anyway". Where that distinction is the whole point,
 * the test runs the same plan twice and asserts on the DIFFERENCE.
 *
 * Money in this file is integer cents, as the engine uses it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGovern, loadWindow, plain, NOW, promoOn } from './gov-harness.mjs';

// ── Fixtures ────────────────────────────────────────────────────────────────

const DRIVER_KIT = 'LA-01';
const OTHER_KIT = 'RC-02';
/** Blueberry Pancakes, $17 Flower — carried by LA-01. */
const LINE_SKU = 'F2Q4EN2C';
/** Cheetah Piss Pre-Roll, $5 — a second line, so the order is not single-line. */
const SECOND_SKU = 'CHP1GPR';

function fixture(G, over = {}) {
  const task = {
    id: 't-gov', order: 'ORD-GOV-1', status: 'in-progress',
    tender: over.tender || 'cash',
    items: [{ sku: LINE_SKU, qty: 1 }, { sku: SECOND_SKU, qty: 1 }],
  };
  const order = G.buildOrder(task, {
    kitId: over.kitId || DRIVER_KIT,
    driverName: 'Kofi Mensah',
    promotionIds: over.promotionIds,
    discountCents: over.discountCents,
  });
  return { task, order };
}

const driverActor = (G, kitId) =>
  G.buildActor({ id: 'emp-11', name: 'Kofi Mensah', role: 'driver', kitId });

const supportActor = (G) =>
  G.buildActor({ id: 'emp-99', name: 'A. Chen', role: 'support_agent' });

// ── Loading and degradation ─────────────────────────────────────────────────

test('the governed stack loads and exposes the surface callers depend on', () => {
  const { G } = loadGovern();
  for (const k of ['buildOrder', 'buildKit', 'buildActor', 'planGoverned', 'commitGoverned']) {
    assert.equal(typeof G[k], 'function', `HWGovern.${k} must be callable`);
  }
  assert.equal(G.POLICY.priceDelta, 'settle_at_door', "the owner's settlement decision");
  assert.equal(G.POLICY.consent, 'verbal_ok', "the owner's consent decision");
  assert.equal(G.POLICY.allowCrossKitSubstitution, false, 'a driver hands over only what is in their own van');
  assert.equal(G.POLICY.blockIfPromotionBroken, false, 'broken promotions are allowed, and flagged');
});

test('HWGovern is null — not broken — when the engine has not loaded', () => {
  const w = loadWindow({ skip: ['shared/commerce-engine.js'] });
  assert.equal(w.HWGovern, null);
});

test('HWGovern is null when the adapter has not loaded', () => {
  // The adapter is the ONLY place this estate's product shape is mapped. A
  // governance layer that quietly grew a second mapper would be the exact
  // duplication CLAUDE.md forbids, so it refuses to run without it.
  const w = loadWindow({ skip: ['shared/commerce-adapter.js'] });
  assert.equal(w.HWGovern, null);
});

// ── Who may swap — permissions, not job titles ──────────────────────────────

test('permission, not role, decides who may swap', () => {
  const { G } = loadGovern();

  // A title with no permission gets nothing, however senior it sounds.
  assert.equal(G.buildActor({ id: 'x', name: 'Nobody', role: 'regional_director' }), null);

  // An explicit permission set overrides the demo role map — which is the point
  // of the owner's answer: the POS permission set is the authority, not a title.
  const rider = G.buildActor({ id: 'm1', name: 'Manager on a ride-along', role: 'manager', permissions: ['substitute:own'], kitId: DRIVER_KIT });
  assert.equal(rider.kind, 'driver', 'substitute:own means KIT-SCOPED, whatever the title says');
  assert.equal(rider.kitId, DRIVER_KIT);

  // Broad permission is not kit-scoped, and carries no kit.
  assert.deepEqual(plain(supportActor(G)), { kind: 'support', id: 'emp-99', name: 'A. Chen' });

  // Kit-scoped with no kit cannot act at all — there is no van to hand from.
  assert.equal(G.buildActor({ id: 'd2', name: 'Off shift', role: 'driver' }), null);
});

test('no permission means the plan refuses before the engine is even called', () => {
  const { G } = loadGovern();
  const { order } = fixture(G);
  const r = G.planGoverned({ order, kit: G.buildKit(DRIVER_KIT, { now: NOW }), lineId: 'l1', actor: null, now: NOW });
  assert.equal(r.ok, false);
  assert.equal(r.refusal.code, 'actor_not_permitted');
  assert.equal(r.plan, null);
});

// ── A driver cannot act on another region's order ───────────────────────────

test('a driver cannot plan a swap on another region’s order', () => {
  const { G } = loadGovern();
  // The order is on RC-02. The driver is carrying LA-01.
  const { order } = fixture(G, { kitId: OTHER_KIT });
  const r = G.planGoverned({
    order, kit: G.buildKit(DRIVER_KIT, { now: NOW }), lineId: 'l1',
    actor: driverActor(G, DRIVER_KIT), now: NOW,
  });
  assert.equal(r.ok, false);
  assert.equal(r.refusal.code, 'wrong_kit');
  assert.match(r.refusal.message, /RC-02/);
  assert.match(r.refusal.message, /LA-01/);
  assert.equal(r.plan.candidateCount, 0, 'a blocked plan offers nothing');
  assert.equal(r.gate, null, 'and there is no gate to render');
});

test('the same order is fine for the SAME region’s driver — it is scope, not a blanket block', () => {
  const { G } = loadGovern();
  const { order } = fixture(G, { kitId: OTHER_KIT });
  const r = G.planGoverned({
    order, kit: G.buildKit(OTHER_KIT, { now: NOW }), lineId: 'l1',
    actor: driverActor(G, OTHER_KIT), now: NOW,
  });
  assert.equal(r.ok, true, r.refusal && r.refusal.message);
  assert.ok(r.gate.candidateCount > 0);
});

test('support is not kit-scoped and may act on that same order', () => {
  const { G } = loadGovern();
  const { order } = fixture(G, { kitId: OTHER_KIT });
  const r = G.planGoverned({
    order, kit: G.buildKit(OTHER_KIT, { now: NOW }), lineId: 'l1',
    actor: supportActor(G), now: NOW,
  });
  assert.equal(r.ok, true, r.refusal && r.refusal.message);
});

test('the wrong-region driver is refused at COMMIT too, not only at plan', () => {
  // Planning and committing are separate calls; a UI that cached a plan from a
  // moment when the kit matched must not be able to push it through afterwards.
  const { G } = loadGovern();
  const good = fixture(G, { kitId: DRIVER_KIT });
  const planned = G.planGoverned({
    order: good.order, kit: G.buildKit(DRIVER_KIT, { now: NOW }), lineId: 'l1',
    actor: driverActor(G, DRIVER_KIT), now: NOW,
  });
  assert.equal(planned.ok, true);

  const strandedOrder = Object.assign({}, good.order, { assignedKitId: OTHER_KIT });
  const c = G.commitGoverned({
    order: strandedOrder, plan: planned.plan, candidate: planned.gate.all[0].candidate,
    actor: driverActor(G, DRIVER_KIT), reason: 'customer_upgraded',
    attested: true, now: NOW, recordId: 'rec-1',
  });
  assert.equal(c.ok, false);
  assert.equal(c.refusal.code, 'wrong_kit');
});

// ── The kit genuinely constrains the candidate pool ─────────────────────────

test('a product in the catalogue but NOT in the van is never offered', () => {
  const { G, HW, DDATA } = loadGovern();
  const { order } = fixture(G);
  const actor = driverActor(G, DRIVER_KIT);
  const row = DDATA.REGION_STOCK[DRIVER_KIT];

  const current = HW.PRODUCTS.find((p) => p.sku === LINE_SKU);
  const absent = HW.PRODUCTS.filter((p) => p.cat === current.cat && !row.units[p.sku]);
  assert.ok(absent.length > 0, 'the fixture van must be missing something in this category');

  const asIs = G.planGoverned({ order, kit: G.buildKit(DRIVER_KIT, { now: NOW }), lineId: 'l1', actor, now: NOW });
  assert.equal(asIs.ok, true);
  const offered = new Set(asIs.gate.all.map((c) => c.productId));
  for (const p of absent) {
    assert.equal(offered.has(p.sku), false, `${p.sku} is not in ${DRIVER_KIT} and must not be offered`);
  }

  // ⚠️ THE HALF THAT MATTERS. The assertion above passes just as happily if the
  // ranker never wanted those products in the first place — in which case it
  // proves nothing about the kit. So load one of them INTO the van and require
  // it to appear. Only the difference between the two runs shows that the
  // absence was caused by the kit.
  const widened = plain(DDATA.REGION_STOCK);
  const proof = absent.find((p) => {
    const stock = plain(DDATA.REGION_STOCK);
    stock[DRIVER_KIT].units[p.sku] = 5;
    const r = G.planGoverned({ order, kit: G.buildKit(DRIVER_KIT, { now: NOW, stock }), lineId: 'l1', actor, now: NOW });
    return r.ok && r.gate.all.some((c) => c.productId === p.sku);
  });
  assert.ok(proof, 'at least one absent product must become offerable once the van carries it');
  widened[DRIVER_KIT].units[proof.sku] = 5;

  const wide = G.planGoverned({ order, kit: G.buildKit(DRIVER_KIT, { now: NOW, stock: widened }), lineId: 'l1', actor, now: NOW });
  assert.ok(wide.gate.all.some((c) => c.productId === proof.sku));
  assert.ok(wide.gate.candidateCount > asIs.gate.candidateCount,
    'adding stock to the van must add offers — otherwise the pool is not the van');
});

test('every region carries a different subset — a van does not have everything', () => {
  // This exists because the first two hashes written for REGION_STOCK both
  // looked well mixed and both collapsed: `hash(sku) + hash(regionId) * k` is
  // constant mod 3 per region, and a char-sum seed gives 'SB-01' and 'RC-01'
  // the same value. Nine regions came out as three, then as seven, identical
  // vans — and nothing in the UI would ever have shown it.
  const { DDATA, HW } = loadGovern();
  const ids = Object.keys(DDATA.REGION_STOCK);
  assert.equal(ids.length, DDATA.SUBREGIONS.length, 'one kit per region, no gaps');

  const seen = new Map();
  for (const id of ids) {
    const carried = Object.keys(DDATA.REGION_STOCK[id].units).sort();
    assert.ok(carried.length > 0, `${id} carries nothing`);
    assert.ok(carried.length < HW.PRODUCTS.length, `${id} carries the whole catalogue — that is not a van`);
    const key = carried.join(',');
    assert.equal(seen.has(key), false, `${id} carries exactly the same subset as ${seen.get(key)}`);
    seen.set(key, id);
  }
});

// ── The settlement figure matches the payment method ────────────────────────

test('settlement follows the order’s own payment method, and the sign only picks direction', () => {
  const { G } = loadGovern();
  const cases = [
    ['cash', 500, 'driver_collects_cash', 'collect'],
    ['cash', -500, 'driver_refunds_cash', 'refund'],
    // A card charge and a card refund share ONE settlement method, so the
    // DIRECTION is the only thing telling the operator which way the money
    // moves. Asserting 'reauthorize' for both — as this matrix originally did —
    // is what let a refund render as a charge.
    ['card', 500, 'card_adjustment', 'charge'],
    ['card', -500, 'card_adjustment', 'refund'],
    ['split', 500, 'card_adjustment', 'charge'],
    ['wallet', -500, 'card_adjustment', 'refund'],
    ['cash', 0, 'none', 'none'],
  ];
  for (const [method, delta, expected, direction] of cases) {
    const s = G.settlementView(method, delta);
    assert.equal(s.method, expected, `${method} ${delta}`);
    assert.equal(s.direction, direction);
    assert.equal(s.amountCents, delta, 'signed as the engine signs it');
    assert.equal(s.magnitudeCents, Math.abs(delta), 'and an unsigned figure to actually hand over');
  }
  // Nothing is ever settled at close-out under this policy — that was the
  // engine's DEFAULT and is the one thing the owner explicitly ruled out.
  for (const [method, delta] of cases) {
    assert.notEqual(G.settlementView(method, delta).method, 'closeout_reconciliation');
  }
});

test('a cash order collects cash and a card order re-authorizes, on the same swap', () => {
  const { G } = loadGovern();
  const plan = (tender) => {
    const { order } = fixture(G, { tender });
    const r = G.planGoverned({
      order, kit: G.buildKit(DRIVER_KIT, { now: NOW }), lineId: 'l1',
      actor: driverActor(G, DRIVER_KIT), now: NOW,
    });
    assert.equal(r.ok, true, r.refusal && r.refusal.message);
    return r;
  };
  const cash = plan('cash');
  const card = plan('card');

  const byProduct = (r) => new Map(r.gate.all.map((c) => [c.productId, c]));
  const cashRows = byProduct(cash);
  const cardRows = byProduct(card);
  assert.ok(cashRows.size > 0);

  let compared = 0;
  for (const [id, a] of cashRows) {
    const b = cardRows.get(id);
    if (!b) continue;
    compared++;
    assert.equal(a.settlement.amountCents, b.settlement.amountCents, 'the money is the same either way');
    assert.equal(a.settlement.method, a.settlement.amountCents > 0 ? 'driver_collects_cash' : 'driver_refunds_cash');
    assert.equal(b.settlement.method, 'card_adjustment');
    assert.match(a.settlement.label, /cash at the door/);
    assert.match(b.settlement.label, /card on file/);
  }
  assert.ok(compared > 0, 'nothing was actually compared');
});

test('the settlement figure is what the CUSTOMER owes, not what the line moved', () => {
  // A cheaper item that breaks a promotion leaves the customer owing MORE. The
  // engine carries both numbers; a surface reading the line delta would tell a
  // driver to refund money on an order the customer owes on. This is the exact
  // shape of a bug the engine repo has already had to fix once.
  const { G } = loadGovern();
  const rule = promoOn(LINE_SKU, 500, 'Blueberry bundle');
  const { order } = fixture(G, { promotionIds: [rule.id], discountCents: 500 });
  const r = G.planGoverned({
    order, kit: G.buildKit(DRIVER_KIT, { now: NOW }), lineId: 'l1',
    actor: driverActor(G, DRIVER_KIT), rules: [rule], now: NOW,
  });
  assert.equal(r.ok, true);

  const inverted = r.gate.all.filter((c) =>
    c.candidate.priceDeltaCents < 0 && c.settlement.amountCents > 0);
  assert.ok(inverted.length > 0,
    'the fixture must contain a cheaper item that still costs the customer more');

  for (const c of inverted) {
    assert.equal(c.settlement.direction, 'collect',
      `${c.productId}: line says "${c.priceDeltaLabel}" but the customer owes more — collect, never refund`);
    assert.equal(c.settlement.amountCents, c.candidate.money.customerOwesDeltaCents);
  }
});

test('the settlement method is never undefined, even on an engine bundle that predates settle_at_door', () => {
  // `settlementFor` is a switch with no default. A bundle built before
  // priceDelta:'settle_at_door' existed returns undefined for it and throws
  // nothing — the driver would simply be shown a blank where the amount goes.
  const { G, E } = loadGovern();
  const engineAnswer = E.settlementFor(G.POLICY, 'cash', 100);
  const supported = engineAnswer === 'driver_collects_cash';
  assert.equal(G.capabilities.settleAtDoorFromEngine, supported,
    'the capability flag must report what the loaded bundle actually does');

  const { order } = fixture(G);
  const r = G.planGoverned({
    order, kit: G.buildKit(DRIVER_KIT, { now: NOW }), lineId: 'l1',
    actor: driverActor(G, DRIVER_KIT), now: NOW,
  });
  for (const c of r.gate.all) {
    assert.ok(c.settlement.method, `${c.productId} has no settlement method`);
    assert.ok(c.settlement.label, `${c.productId} has no settlement label`);
    assert.equal(c.settlement.fromEngine, supported);
  }
});

// ── A swap that breaks a promotion says so, loudly ──────────────────────────

test('breaking a promotion is reported on the candidate, priced, and marked blocking', () => {
  const { G } = loadGovern();
  const rule = promoOn(LINE_SKU, 500, 'Blueberry bundle');
  const { order } = fixture(G, { promotionIds: [rule.id], discountCents: 500 });
  const r = G.planGoverned({
    order, kit: G.buildKit(DRIVER_KIT, { now: NOW }), lineId: 'l1',
    actor: driverActor(G, DRIVER_KIT), rules: [rule], now: NOW,
  });
  assert.equal(r.ok, true);
  assert.equal(r.gate.anyBreaksPromotion, true, 'the surface must be able to see this before rendering a row');

  const row = r.gate.all[0];
  assert.equal(row.promotion.breaks, true);
  assert.equal(row.promotion.blocking, true, 'the commit refuses without an acknowledgement');
  assert.equal(row.promotion.lossCents, 500);
  assert.deepEqual(plain(row.promotion.lost), [
    { ruleId: rule.id, name: 'Blueberry bundle', valueCents: 500, label: '$5.00' },
  ]);
  // Owner: "this needs to be flagged CLEARLY on the POS and drivers app."
  // The loss must be a sentence a surface can put above the confirm button —
  // naming the promotion and the dollar figure — not an entry in `warnings`.
  assert.match(row.promotion.headline, /Blueberry bundle/);
  assert.match(row.promotion.headline, /\$5\.00/);
  assert.match(row.promotion.acknowledgeLabel, /Blueberry bundle/);
  assert.equal(row.requiresPromotionAcknowledgement, true);
});

test('a swap that breaks nothing reports nothing to acknowledge', () => {
  const { G } = loadGovern();
  const { order } = fixture(G);   // no promotions applied
  const r = G.planGoverned({
    order, kit: G.buildKit(DRIVER_KIT, { now: NOW }), lineId: 'l1',
    actor: driverActor(G, DRIVER_KIT), now: NOW,
  });
  assert.equal(r.gate.anyBreaksPromotion, false);
  for (const c of r.gate.all) {
    assert.equal(c.promotion.breaks, false);
    assert.equal(c.promotion.headline, null);
    assert.equal(c.requiresPromotionAcknowledgement, false);
  }
});

// ── Committing ──────────────────────────────────────────────────────────────

function plannedBreakingSwap(G) {
  const rule = promoOn(LINE_SKU, 500, 'Blueberry bundle');
  const { order } = fixture(G, { promotionIds: [rule.id], discountCents: 500 });
  const actor = driverActor(G, DRIVER_KIT);
  const r = G.planGoverned({
    order, kit: G.buildKit(DRIVER_KIT, { now: NOW }), lineId: 'l1', actor, rules: [rule], now: NOW,
  });
  assert.equal(r.ok, true);
  return { order, actor, r, row: r.gate.all[0], rule };
}

test('the commit REFUSES a promotion-breaking swap that was not acknowledged', () => {
  const { G } = loadGovern();
  const { order, actor, r, row } = plannedBreakingSwap(G);
  const c = G.commitGoverned({
    order, plan: r.plan, candidate: row.candidate, actor,
    reason: 'customer_upgraded', attested: true,
    // acknowledgePromotionLoss deliberately omitted
    now: NOW, recordId: 'rec-x',
  });
  assert.equal(c.ok, false);
  assert.equal(c.refusal.code, 'promotion_loss_unacknowledged');
});

test('the commit REFUSES when the actor did not attest the customer agreed', () => {
  const { G } = loadGovern();
  const { order, actor, r, row } = plannedBreakingSwap(G);
  const c = G.commitGoverned({
    order, plan: r.plan, candidate: row.candidate, actor,
    reason: 'customer_upgraded', attested: false, acknowledgePromotionLoss: true,
    now: NOW, recordId: 'rec-x',
  });
  assert.equal(c.ok, false);
  assert.equal(c.refusal.code, 'consent_required');
});

test('acknowledged + attested commits, and writes the audit row and the intents', () => {
  const { G } = loadGovern();
  const { order, actor, r, row, rule } = plannedBreakingSwap(G);
  const c = G.commitGoverned({
    order, plan: r.plan, candidate: row.candidate, actor,
    reason: 'customer_upgraded', attested: true, acknowledgePromotionLoss: true,
    now: NOW, recordId: 'rec-7',
  });
  assert.equal(c.ok, true, c.refusal && c.refusal.message);

  const rec = c.result.record;
  assert.equal(rec.id, 'rec-7');
  assert.equal(rec.orderId, order.id);
  assert.equal(rec.fromProductId, LINE_SKU);
  assert.equal(rec.toProductId, row.productId);
  assert.equal(rec.kitId, DRIVER_KIT);
  assert.equal(rec.orderStatusAtChange, 'en_route');
  assert.equal(rec.occurredAt, NOW.toISOString());
  // Consent names WHO attested and WHEN — that is the whole value of it.
  assert.equal(rec.consent.channel, 'driver_verbal');
  assert.equal(rec.consent.recordedByActorId, 'emp-11');
  assert.equal(rec.money.promotionLossCents, 500);

  // The promotion is gone from the order, and the discount with it.
  assert.equal((c.result.order.appliedPromotionIds || []).includes(rule.id), false);
  assert.equal(c.result.order.agreed.discountCents, 0);
  assert.equal(c.result.order.agreed.totalCents, row.newTotalCents);

  // Inventory moves within ONE kit: release the old, allocate the new.
  const inv = c.result.intents.inventory;
  assert.deepEqual(plain(inv.map((i) => i.kind)), ['release', 'allocate']);
  assert.ok(inv.every((i) => i.kitId === DRIVER_KIT));

  // And the money is a door settlement, not a close-out line — in the PERSISTED
  // record as well as on screen. The engine copies `candidate.money.settlement`
  // into both, so a bundle without `settle_at_door` would file `undefined` here
  // while the driver was shown "Refund $x in cash". Displayed and filed must
  // agree, or the audit row is worthless in the dispute it exists for.
  const rc = c.result.intents.reconciliation;
  assert.equal(rc.settlement, row.settlement.method);
  assert.ok(rc.settlement, 'the reconciliation intent must name a settlement method');
  assert.equal(rec.money.settlement, row.settlement.method, 'the audit row must agree with the screen');
  assert.notEqual(rc.settlement, 'closeout_reconciliation');
  assert.equal(rc.amountCents, row.settlement.amountCents);
  assert.equal(rc.paymentMethod, order.paymentMethod);
});

test('a support agent’s attestation is recorded as support, not as the driver’s', () => {
  const { G } = loadGovern();
  const { order } = fixture(G);
  const actor = supportActor(G);
  const r = G.planGoverned({ order, kit: G.buildKit(DRIVER_KIT, { now: NOW }), lineId: 'l1', actor, now: NOW });
  const c = G.commitGoverned({
    order, plan: r.plan, candidate: r.gate.all[0].candidate, actor,
    reason: 'customer_request', attested: true, now: NOW, recordId: 'rec-8',
  });
  assert.equal(c.ok, true, c.refusal && c.refusal.message);
  assert.equal(c.result.record.consent.channel, 'support_verbal');
  assert.equal(c.result.record.actor.kind, 'support');
});

// ── The plan is passed through, not reinterpreted ───────────────────────────

test('planGoverned returns the engine’s plan unchanged, and the gate mirrors it exactly', () => {
  const { G } = loadGovern();
  const { order } = fixture(G);
  const r = G.planGoverned({
    order, kit: G.buildKit(DRIVER_KIT, { now: NOW }), lineId: 'l1',
    actor: driverActor(G, DRIVER_KIT), now: NOW,
  });
  assert.equal(r.ok, true);

  let counted = 0;
  for (const mode of Object.keys(r.plan.candidatesByMode)) {
    const engineRows = r.plan.candidatesByMode[mode];
    const gateRows = r.gate.byMode[mode];
    assert.equal(gateRows.length, engineRows.length, `${mode}: gate must not add or drop rows`);
    for (let i = 0; i < engineRows.length; i++) {
      assert.equal(gateRows[i].candidate, engineRows[i],
        `${mode}[${i}]: the gate row must carry the engine's own candidate, by reference`);
      assert.equal(gateRows[i].productId, engineRows[i].product.id, 'and in the engine’s order');
      counted++;
    }
  }
  assert.equal(counted, r.plan.candidateCount);
  assert.equal(r.gate.candidateCount, r.plan.candidateCount);
  assert.ok(counted > 0);
});

// ── The kit is always dated ─────────────────────────────────────────────────

test('buildKit always sets asOf, so no candidate carries the undated warning', () => {
  const { G, DDATA } = loadGovern();
  for (const id of Object.keys(DDATA.REGION_STOCK)) {
    const kit = G.buildKit(id, { now: NOW });
    assert.equal(typeof kit.asOf, 'string', `${id} kit has no asOf`);
    assert.ok(Number.isFinite(Date.parse(kit.asOf)), `${id} asOf is not a date`);
    assert.ok(Date.parse(kit.asOf) <= NOW.getTime(), `${id} kit was signed out in the future`);
  }

  const { order } = fixture(G);
  const r = G.planGoverned({
    order, kit: G.buildKit(DRIVER_KIT, { now: NOW }), lineId: 'l1',
    actor: driverActor(G, DRIVER_KIT), now: NOW,
  });
  for (const c of r.gate.all) {
    assert.equal(c.warnings.some((w) => /undated/i.test(w)), false,
      'an undated kit warns on EVERY candidate, which trains drivers to ignore the line that also carries the promotion loss');
  }
});

test('a genuinely stale van still warns — the freshness check is live, not disabled', () => {
  const { G, DDATA } = loadGovern();
  const stale = Object.keys(DDATA.REGION_STOCK)
    .find((id) => DDATA.REGION_STOCK[id].ageMin > G.POLICY.maxKitAgeMs / 60000);
  assert.ok(stale, 'the demo stock must contain at least one stale van');

  const { order } = fixture(G, { kitId: stale });
  const r = G.planGoverned({
    order, kit: G.buildKit(stale, { now: NOW }), lineId: 'l1',
    actor: driverActor(G, stale), now: NOW,
  });
  assert.equal(r.ok, true, r.refusal && r.refusal.message);
  assert.ok(r.gate.all.length > 0);
  for (const c of r.gate.all) {
    assert.ok(c.warnings.some((w) => /min old/.test(w)), `${c.productId} should warn that the count is stale`);
  }
});

test('buildKit returns null for a region with no stock rather than an empty van', () => {
  const { G } = loadGovern();
  // An empty-units kit would let the engine run and answer "nothing to offer",
  // which is indistinguishable from a van that is genuinely out of stock.
  assert.equal(G.buildKit('ZZ-99', { now: NOW }), null);
  const { order } = fixture(G);
  const r = G.planGoverned({ order, kit: null, lineId: 'l1', actor: driverActor(G, DRIVER_KIT), now: NOW });
  assert.equal(r.ok, false);
  assert.equal(r.refusal.code, 'kit_unknown');
});

// ── Order mapping is honest about what the estate does not have ─────────────

test('estate statuses map onto the engine’s union, and never invent one', () => {
  const { G } = loadGovern();
  const items = [{ sku: LINE_SKU, qty: 1 }];
  const build = (src) => G.buildOrder(src, { kitId: DRIVER_KIT });

  assert.equal(build({ order: 'A', status: 'not-started', tender: 'cash', items }).status, 'assigned');
  assert.equal(build({ order: 'B', status: 'in-progress', tender: 'cash', items }).status, 'en_route');
  assert.equal(build({ order: 'C', status: 'completed', tender: 'cash', items }).status, 'delivered');
  assert.equal(build({ order: 'D', status: 'cancelled', tender: 'cash', items }).status, 'cancelled');

  // POS stages carry no driver, so they stay 'submitted' until a kit is attached.
  assert.equal(G.buildOrder({ id: 'E', stage: 'verify', pay: 'Cash', items }, {}).status, 'submitted');
  assert.equal(G.buildOrder({ id: 'F', stage: 'packing', pay: 'Card', items }, {}).status, 'submitted');
  assert.equal(G.buildOrder({ id: 'G', stage: 'ready', pay: 'Card', items }, {}).status, 'submitted');
  assert.equal(G.buildOrder({ id: 'H', stage: 'ready', pay: 'Card', items }, { kitId: DRIVER_KIT }).status, 'assigned');
  assert.equal(G.buildOrder({ id: 'I', stage: 'canceled', pay: 'Cash', items }, {}).status, 'cancelled');

  // NOTHING in this estate means "items pulled into the kit". The engine has a
  // 'picked' status; producing it here would be a guess, and a guess about
  // status is a guess about the substitution cutoff.
  const everyStatus = ['not-started', 'in-progress', 'completed', 'cancelled']
    .map((s) => build({ order: 'X', status: s, tender: 'cash', items }).status)
    .concat(['verify', 'pack', 'packing', 'ready', 'done', 'canceled']
      .map((s) => G.buildOrder({ id: 'Y', stage: s, pay: 'Cash', items }, { kitId: DRIVER_KIT }).status));
  assert.equal(everyStatus.includes('picked'), false);

  // An unrecognised status is refused, not defaulted to something changeable.
  assert.equal(build({ order: 'Z', status: 'on-hold', tender: 'cash', items }), null);
  assert.equal(G.buildOrder({ id: 'Z2', stage: 'refunded', pay: 'Cash', items }, {}), null);
});

test('a delivered or cancelled order cannot be substituted at all', () => {
  const { G } = loadGovern();
  const kit = G.buildKit(DRIVER_KIT, { now: NOW });
  const actor = driverActor(G, DRIVER_KIT);
  const items = [{ sku: LINE_SKU, qty: 1 }, { sku: SECOND_SKU, qty: 1 }];

  const delivered = G.buildOrder({ order: 'D1', status: 'completed', tender: 'cash', items }, { kitId: DRIVER_KIT });
  const rd = G.planGoverned({ order: delivered, kit, lineId: 'l1', actor, now: NOW });
  assert.equal(rd.ok, false);
  assert.equal(rd.refusal.code, 'order_past_cutoff');
  assert.match(rd.refusal.message, /return\/exchange/);

  const cancelled = G.buildOrder({ order: 'D2', status: 'cancelled', tender: 'cash', items }, { kitId: DRIVER_KIT });
  const rc = G.planGoverned({ order: cancelled, kit, lineId: 'l1', actor, now: NOW });
  assert.equal(rc.ok, false);
  assert.equal(rc.refusal.code, 'order_cancelled');
});

test('payment instrument comes from the tender, and a POS row that has none is refused', () => {
  const { G } = loadGovern();
  const items = [{ sku: LINE_SKU, qty: 1 }];
  const build = (src) => G.buildOrder(src, { kitId: DRIVER_KIT });

  assert.equal(build({ order: 'A', status: 'not-started', tender: 'cash', items }).paymentMethod, 'cash');
  assert.equal(build({ order: 'B', status: 'not-started', tender: 'card', items }).paymentMethod, 'card');
  assert.equal(build({ order: 'C', status: 'not-started', tender: 'split', items }).paymentMethod, 'split');
  // A task is `pay: 'cod'` with `tender: 'cash'`. The INSTRUMENT wins — 'cod'
  // says when the money moves, and settle_at_door needs to know how.
  assert.equal(build({ order: 'D', status: 'not-started', pay: 'cod', tender: 'cash', items }).paymentMethod, 'cash');
  // 'Prepaid' names the timing and not the instrument; the estate stores no
  // instrument behind it, so it settles as a card adjustment. Documented gap.
  assert.equal(G.buildOrder({ id: 'E', stage: 'verify', pay: 'Prepaid', items }, {}).paymentMethod, 'card');
  // Nothing at all → refuse, rather than pick a settlement route by coin flip.
  assert.equal(build({ order: 'F', status: 'not-started', items }), null);
});

test('a POS order row stores an item COUNT, not lines, and is refused until lines are supplied', () => {
  const { G, HW } = loadGovern();
  const posRow = HW.ORDERS.find((o) => o.stage === 'verify');
  assert.equal(typeof posRow.items, 'number', 'this is the shape the refusal exists for');
  assert.equal(G.buildOrder(posRow, { kitId: DRIVER_KIT }), null);

  const withLines = G.buildOrder(posRow, { kitId: DRIVER_KIT, lines: [{ sku: LINE_SKU, qty: 1 }] });
  assert.ok(withLines, 'supplying the lines makes it mappable');
  assert.equal(withLines.lines.length, 1);
});

test('the agreed totals are built through the estate’s ONE tax helper', () => {
  const { G, HW } = loadGovern();
  const { order } = fixture(G);
  const taxable = order.agreed.subtotalCents - order.agreed.discountCents;
  const expected = Math.round(HW.taxBreakdown(taxable / 100).total * 100);
  assert.equal(order.agreed.taxCents, expected,
    'a second tax rate here is how the driver app once collected $17.55 too little on every order');
  assert.equal(order.agreed.totalCents, taxable + order.agreed.feesCents + order.agreed.taxCents);
});


// ─────────────────────────────────────────────────────────────────────────────
// The direction a card settlement moves money
//
// Adversarial review 2026-08-19: a card order swapped DOWN produced
// amountCents -8010 — the customer is owed $80.10 — and the driver was shown
// "Re-authorize $80.10 on the card on file", which reads as taking it FROM
// them. `card_adjustment` covers a charge AND a refund, so one verb for it is
// wrong half the time, and this is the line the operator acts on at the door.
// ─────────────────────────────────────────────────────────────────────────────

test('a card REFUND never reads as a charge', () => {
  const { G } = loadGovern();
  const refund = G.settlementView('card', -8010);
  assert.equal(refund.direction, 'refund');
  assert.match(refund.label, /^Refund \$80\.10/,
    'the operator must be told the money goes back to the customer');
  assert.doesNotMatch(refund.label, /Charge|Collect|Re-authorize/,
    'no verb that reads as taking money');
});

test('a card CHARGE never reads as a refund', () => {
  const { G } = loadGovern();
  const charge = G.settlementView('card', 8010);
  assert.equal(charge.direction, 'charge');
  assert.match(charge.label, /^Charge \$80\.10/);
  assert.doesNotMatch(charge.label, /Refund/);
});

test('the two directions are not the same sentence', () => {
  const { G } = loadGovern();
  assert.notEqual(G.settlementView('card', 500).label, G.settlementView('card', -500).label,
    'identical copy for both signs is the defect this pins');
});

// ─────────────────────────────────────────────────────────────────────────────
// D4 — which van did this order go out on
//
// "the address falls [in a] weedmaps listing[,] with that listing we could have
//  a region or multiple regions, our logic has 1 driver assigned to each region.
//  The system decides which driver is best to fulfill the order based on its
//  routing algorithm." — the owner, 2026-08-19
//
// The property that matters is INDEPENDENCE. checkActor compares the actor's kit
// against the order's kit; derive both from the acting driver and it compares a
// value to itself, which is how an earlier attempt produced a guarantee that
// looked present and enforced nothing.
// ─────────────────────────────────────────────────────────────────────────────

test('D4 — dispatch abbreviations and full names both resolve to a region', () => {
  const { G } = loadGovern();
  assert.equal(G.driverToRegion('Theo R.'), 'RC-01', "dispatch writes 'Theo R.'");
  assert.equal(G.driverToRegion('Theo Reyes'), 'RC-01', 'the van register holds the full name');
  assert.equal(G.driverToRegion('Kofi M.'), 'LA-01');
});

test('D4 — Unassigned is a real dispatch state, not a lookup failure', () => {
  const { G } = loadGovern();
  assert.equal(G.driverToRegion('Unassigned'), null);
  assert.equal(G.driverToRegion(''), null);
  assert.equal(G.driverToRegion('Nobody X.'), null);
});

test('D4 — an AMBIGUOUS name refuses rather than picking one', () => {
  // Two region drivers sharing a first name. Guessing would attribute an order
  // to the wrong van, which is worse than attributing it to none.
  const { w, G } = loadGovern();
  w.DDATA.REGION_STOCK = {
    'AA-01': { regionId: 'AA-01', driver: 'Theo Reyes', ageMin: 3, units: {} },
    'AA-02': { regionId: 'AA-02', driver: 'Theo Rivera', ageMin: 3, units: {} },
  };
  assert.equal(G.driverToRegion('Theo R.'), null, 'both match — refuse');
  assert.equal(G.driverToRegion('Theo Reyes'), 'AA-01', 'the full name still disambiguates');
});

test('D4 — orderKitId reads the DISPATCH record, never the session', () => {
  const { w, G } = loadGovern();
  assert.equal(G.orderKitId('ORD-00223'), 'RC-01');
  assert.equal(G.orderKitId('ORD-00218'), null, 'Unassigned');
  assert.equal(G.orderKitId('NOPE'), null);

  // Change who is logged in; the order's van must not move.
  const before = G.orderKitId('ORD-00223');
  if (w.MD && w.MD.DRIVER) w.MD.DRIVER.name = 'Dev Anand';
  assert.equal(G.orderKitId('ORD-00223'), before,
    'if this moved, the order kit is being derived from the actor — the tautology');
});

test('D4 — the two sources CAN differ, which is what makes wrong_kit reachable', () => {
  const { G } = loadGovern();
  const orderKit = G.orderKitId('ORD-00223');   // RC-01, from dispatch
  const actorKit = G.actorKitId('Dev Anand');   // RC-03, from who is acting
  assert.ok(orderKit && actorKit);
  assert.notEqual(orderKit, actorKit,
    'a check whose two inputs can never differ is decorative');
});

test('D4 — and the ENGINE actually refuses when they differ', () => {
  const { G, E } = loadGovern();
  const actor = { kind: 'driver', id: 'drv-x', name: 'Dev Anand', kitId: G.actorKitId('Dev Anand') };
  // signature is (order, actor, policy)
  const refusal = E.checkActor({
    id: 'ORD-00223', status: 'en_route', assignedKitId: G.orderKitId('ORD-00223'),
  }, actor, E.defaultFulfillmentPolicy);
  assert.ok(refusal, 'expected a refusal');
  assert.equal(refusal.code, 'wrong_kit');
});
