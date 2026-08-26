/* THE MERCHANDISING SEAM.
 *
 * The owner's answers this encodes:
 *   · a HOUSE CARD is the fallback, editable at any time — never a derived pick,
 *     because "deepest markdown in the catalogue" is how the shop came to
 *     advertise "Up to 97% off" to customers;
 *   · carousel AND weighted, as separate modes per surface;
 *   · share of voice is per surface x REGION;
 *   · who and when on every change, with rollback;
 *   · browser storage for now, behind ONE seam, so the real backing store stays
 *     an open decision.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

const item = (id, share) => ({ id, kind: 'brand', label: id, share });

test('the house card is the fallback, and it is editable', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    assert.ok(M.houseCard().headline, 'there must always be something to fall back to');
    const saved = M.setHouseCard({ headline: 'Same-day delivery' }, 'J. Torres');
    assert.equal(saved.headline, 'Same-day delivery');
    assert.equal(M.houseCardBy().who, 'J. Torres', 'who changed it must be recorded');
    // A blank house card is a blank surface — the exact state it exists to prevent.
    assert.equal(M.setHouseCard({ headline: '   ' }, 'x'), null);
    assert.equal(M.houseCard().headline, 'Same-day delivery', 'a refused edit must not have landed');
  });
});

test('an unknown surface is REFUSED, not stored', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    // A typo'd surface id is otherwise invisible: an unknown surface renders
    // nothing, which looks exactly like a surface with nothing scheduled.
    assert.equal(M.set('shop_spotlite', 'corona', { items: [item('a')] }, 'me'), null);
    assert.ok(M.set('shop_spotlight', 'corona', { items: [item('a')] }, 'me'));
  });
});

test('weighted shares must sum to 100', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    // A set summing to 90 silently under-delivers a tenth of the slot, and
    // nobody chose that.
    assert.equal(M.set('cart_addon', 'corona',
      { mode: 'weighted', items: [item('a', 70), item('b', 20)] }, 'me'), null);
    assert.ok(M.set('cart_addon', 'corona',
      { mode: 'weighted', items: [item('a', 70), item('b', 30)] }, 'me'));
  });
});

test('a surface cannot hold more than its capacity', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    const cap = M.surfaceById('shop_spotlight').cap;
    const tooMany = Array.from({ length: cap + 1 }, (_, i) => item('x' + i));
    assert.equal(M.set('shop_spotlight', 'corona', { items: tooMany }, 'me'), null);
  });
});

test('share of voice is per REGION — one region does not move another', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    M.set('shop_spotlight', 'corona', { items: [item('pacific')], state: 'live' }, 'me');
    M.set('shop_spotlight', 'west-la', { items: [item('connected')], state: 'live' }, 'me');
    assert.equal(M.live('shop_spotlight', 'corona').items[0].id, 'pacific');
    assert.equal(M.live('shop_spotlight', 'west-la').items[0].id, 'connected');
  });
});

test('a region with nothing set inherits the "all" default', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    M.set('home_hero', 'all', { items: [item('default')], state: 'live' }, 'me');
    assert.equal(M.live('home_hero', 'corona').items[0].id, 'default',
      'one number until it isn’t — an unset region must inherit');
    M.set('home_hero', 'corona', { items: [item('override')], state: 'live' }, 'me');
    assert.equal(M.live('home_hero', 'corona').items[0].id, 'override');
    assert.equal(M.live('home_hero', 'west-la').items[0].id, 'default', 'the override is regional');
  });
});

test('only a LIVE set reaches a customer', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    M.set('shop_spotlight', 'corona', { items: [item('draft-only')], state: 'draft' }, 'me');
    assert.equal(M.live('shop_spotlight', 'corona'), null,
      'a draft must never render to a shopper');
    M.set('shop_spotlight', 'corona', { state: 'review' }, 'me');
    assert.equal(M.live('shop_spotlight', 'corona'), null, 'nor an unapproved review');
    M.set('shop_spotlight', 'corona', { state: 'live' }, 'me');
    assert.ok(M.live('shop_spotlight', 'corona'));
  });
});

test('every change records who and when, and can be rolled back', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    M.set('home_hero', 'corona', { items: [item('first')], state: 'live' }, 'M. Saini');
    M.set('home_hero', 'corona', { items: [item('second')], state: 'live' }, 'J. Torres');

    const rec = M.get('home_hero', 'corona');
    assert.equal(rec.items[0].id, 'second');
    assert.equal(rec.by.who, 'J. Torres');
    assert.ok(rec.by.at, 'when must be recorded, not just who');
    assert.equal(M.history('home_hero', 'corona')[0].items[0].id, 'first');

    const rolled = M.rollback('home_hero', 'corona', 0, 'J. Torres');
    assert.equal(rolled.items[0].id, 'first');
    // The rollback is itself a change, so it is attributed too — otherwise the
    // record of who did what has a hole exactly where someone undid something.
    assert.equal(rolled.by.who, 'J. Torres');
  });
});

test('the store hands out copies — a screen cannot edit it by reference', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    M.set('cart_addon', 'corona', { items: [item('a')] }, 'me');
    const got = M.get('cart_addon', 'corona');
    got.items[0].label = 'MUTATED';
    assert.notEqual(M.get('cart_addon', 'corona').items[0].label, 'MUTATED');
  });
});

test('the board shows empty slots — a gap is a task, not a silence', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    const before = M.board();
    assert.ok(before.length >= M.SURFACES.length, 'every surface x region is a slot');
    assert.ok(before.every((s) => s.filled === false), 'nothing is filled yet');
    M.set('shop_spotlight', 'corona', { items: [item('a')], state: 'live' }, 'me');
    const hit = M.board().find((s) => s.surface === 'shop_spotlight' && s.region === 'corona');
    assert.equal(hit.filled, true);
    assert.equal(hit.by.who, 'me');
  });
});

test('the reorder row is flagged never-first and must-label', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    // The owner: a sponsored card may appear there, but never at index 0, and
    // always labelled. Index 0 earns the "Your usual" badge and the row's whole
    // credibility comes from being genuinely the customer's own history.
    const s = M.surfaceById('home_reorder');
    assert.equal(s.neverFirst, true);
    assert.equal(s.mustLabel, true);
  });
});

test('it says out loud that this is demo storage', async () => {
  await withApp('pos', async (app) => {
    // Per-browser, no sync: two marketers have two realities. A surface that
    // implies a shared source of truth would be lying.
    assert.equal(app.window.HWMerch.isDemoStorage(), true);
  });
});
