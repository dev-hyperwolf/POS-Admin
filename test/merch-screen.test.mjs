/* THE MERCHANDISING TAB — driven by real clicks, not by reading the source.
 *
 * ⚠️ THIS FILE WAS QUARANTINED FOR HOURS AND THE CAUSE IS WORTH KEEPING.
 * It hung `node --test` for ~42 seconds and then killed the process, taking
 * thirteen of its sixteen tests with it and reporting a bare 'test failed'.
 *
 * The cause was ONE ASSERTION:  assert.equal(btn(app, ITEM_B), undefined)
 *
 * `btn` returns a jsdom DOM ELEMENT. When that assertion fails, node builds a
 * diff — and serialising a DOM node means walking a circular graph with the
 * whole document hanging off it. That is the 42 seconds and the memory.
 *
 * It is the same family as the cross-realm rule in the harness header: COMPARE
 * PRIMITIVES. `has()` returns a boolean, so a failure prints `true !== false`
 * and costs nothing. With that one change the file runs in FOUR SECONDS.
 *
 * Ruled out along the way, so nobody repeats it: not the screen (it drives
 * cleanly outside node --test), not the harness (sibling files run in ~1s), not
 * a leaked mounter (14 mounters, 14 closes), and not any subscription.
 */
/* THE MERCHANDISING TAB — driven by real clicks, not by reading the source.
 *
 * Every assertion here is about a REFUSAL BEING VISIBLE. The store
 * (shared/merch-store.js) already refuses a bad set; what this screen has to
 * add is that the operator finds out BEFORE pressing a button, and finds out
 * again if the store refuses for a reason the form did not model. A control
 * that fails quietly is the bug this project has shipped most often, and it is
 * invisible to any test that only checks the store.
 *
 * ⚠️ MerchScreen gets its OWN host node. app.mount() re-roots #root and throws
 * React into "Should not already be working", which poisons LATER tests instead
 * of failing the one at fault.
 *
 * ⚠️ NOTHING HERE PINS A NUMBER I COMPUTED MYSELF. Counts are derived from
 * HWMerch.SURFACES/REGIONS at assert time, so growing the surface list moves
 * the expectation with it rather than turning this file red for no reason.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

function mounter(app, name) {
  const W = app.window;
  let cur = null;
  const close = () => { if (!cur) return; try { cur.root.unmount(); } catch {} cur.host.remove(); cur = null; };
  const open = async (props) => {
    close();
    const Comp = W[name];
    assert.equal(typeof Comp, 'function', `${name} is not on the page — errors: ${app.errors.join(' | ') || '(none)'}`);
    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    root.render(W.React.createElement(Comp, props || {}));
    cur = { root, host };
    await app.settle(); await app.settle();
  };
  open.close = close;
  return open;
}

/** A button by its exact visible label, so `.disabled` can be asserted. A test
 *  that clicks a disabled button and passes proves nothing. */
const btn = (app, label) =>
  [...app.document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === label);

/* 🔴 NEVER ASSERT ON A DOM NODE. `assert.equal(someElement, undefined)` FAILS
 * by trying to serialise a jsdom element to build its diff — a circular object
 * graph with the whole document hanging off it. That single assertion took ~42
 * SECONDS and then killed the process, taking the other twelve tests in this
 * file with it and reporting only a bare 'test failed'.
 *
 * It is the same family as the cross-realm rule at the top of the harness:
 * compare PRIMITIVES. `has()` returns a boolean, so a failure prints
 * `true !== false` and costs nothing. */
const has = (app, label) => btn(app, label) !== undefined;

/** Open a board cell. Cells carry a title of "<surface label> · <region label>";
 *  matching on that is stable while the cell's visible text changes. */
async function openCell(app, surfaceId, regionLabel) {
  const label = app.window.HWMerch.surfaceById(surfaceId).label;
  const ok = app.click((t, el) => el.getAttribute && el.getAttribute('title') === label + ' · ' + regionLabel);
  assert.ok(ok, `no board cell titled "${label} · ${regionLabel}"`);
  await app.settle();
}

const clickAria = async (app, aria) => {
  const ok = app.click((t, el) => el.getAttribute && el.getAttribute('aria-label') === aria);
  assert.ok(ok, `nothing with aria-label "${aria}"`);
  await app.settle();
};

/** The nth role=switch on screen — the Sponsored toggles, in item order. */
const clickSwitch = async (app, nth) => {
  const ok = app.click((t, el) => el.getAttribute && el.getAttribute('role') === 'switch', { nth });
  assert.ok(ok, `no switch #${nth}`);
  await app.settle();
};

const ITEM_A = 'Kiva Confections';
const ITEM_B = 'STIIIZY';
const ITEM_C = 'Jeeter';

test('the board shows every surface x region, and an empty slot is a task rather than silence', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    const open = mounter(app, 'MerchScreen');
    try {
      await open();
      const t = app.text();
      // Every surface label, and every region column, is on screen.
      for (const s of M.SURFACES) assert.ok(t.includes(s.label), `${s.label} is missing from the board`);
      for (const c of ['All regions', 'Corona', 'Long Beach', 'West LA']) {
        assert.ok(t.includes(c), `the ${c} column is missing`);
      }

      // An empty slot must SAY it is empty. This is the whole reason the board
      // exists: nobody could see the gap that let "Up to 97% off" through.
      const cells = [...app.document.querySelectorAll('button')]
        .filter((b) => (b.getAttribute('title') || '').includes(' · '));
      const expected = M.SURFACES.length * (M.REGIONS.length + 1);   // + the 'all' column
      assert.equal(cells.length, expected, 'the board must cover every surface across all-regions plus each region');
      assert.ok(cells.every((c) => (c.textContent || '').includes('Nothing scheduled')),
        'with an empty store every slot must read as empty');

      const dark = M.SURFACES.length * M.REGIONS.length;
      assert.ok(t.includes(dark + ' of ' + dark + ' region slots have nothing live'),
        'the count of dark slots must be stated, not left to be counted by eye');
      assert.ok(t.includes('Demo storage'), 'the screen must say this is per-browser demo storage');
    } finally { open.close(); }
  });
});

test('a DRAFT with items is never reported as showing — live() is the only authority', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    // Four items, saved, attributed — and not live. A board that prints
    // "4 items" and stops is telling the operator this is on the storefront.
    M.set('cart_addon', 'corona', { mode: 'carousel', items: [{ id: 'a', kind: 'brand', label: 'A' }], state: 'draft' }, 'tester');
    const open = mounter(app, 'MerchScreen');
    try {
      await open();
      const cell = [...app.document.querySelectorAll('button')]
        .find((b) => (b.getAttribute('title') || '') === M.surfaceById('cart_addon').label + ' · Corona');
      assert.ok(cell, 'the cart add-on / Corona cell must exist');
      const txt = (cell.textContent || '');
      assert.ok(txt.includes('Showing the house card'),
        'a draft does not reach a shopper — the cell must say the house card is what shows');
      assert.ok(txt.includes('staged, not live yet'), 'the cell must say the set is staged');

      // And once it IS live the same cell flips, so the assertion above is not
      // passing because the cell always says "house card".
      M.set('cart_addon', 'corona', { state: 'live' }, 'tester');
      await app.settle();
      const after = [...app.document.querySelectorAll('button')]
        .find((b) => (b.getAttribute('title') || '') === M.surfaceById('cart_addon').label + ' · Corona');
      assert.ok((after.textContent || '').includes('Showing 1'), 'a live set must be reported as showing');
      // And the staged label must GO. A live set still wearing "staged, not live
      // yet" is the same lie pointing the other way, and an assertion that only
      // checks the draft case cannot see it.
      assert.ok(!(after.textContent || '').includes('staged, not live yet'),
        'a live set must not still be labelled staged');
    } finally { open.close(); }
  });
});

test('weighted: the total is visible, and Save is withheld until it is 100 with no dead item', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    const open = mounter(app, 'MerchScreen');
    try {
      await open();
      await openCell(app, 'cart_addon', 'All regions');           // cap 3
      assert.ok(app.click(ITEM_A), 'the item picker must add items');
      assert.ok(app.click(ITEM_B), 'and two adds in one frame must both land');
      await app.settle();

      assert.ok(app.click('Weighted'), 'the weighted mode control must be reachable');
      await app.settle();
      // Switching mode splits what is already there evenly, so the slot is
      // immediately savable rather than starting life refused.
      assert.equal(btn(app, 'Publish now').disabled, false, 'an even two-way split is a valid weighted set');

      // A third item arrives at 0% — which SUMS TO 100 and the store would
      // happily accept. Nobody would ever be shown it.
      assert.ok(app.click(ITEM_C));
      await app.settle();
      assert.ok(app.text().includes('0% share, so no visitor is ever shown it'),
        'a zero-share item must be called out — the store accepts 50/50/0 and it is silently wrong');
      assert.equal(btn(app, 'Publish now').disabled, true, 'Save cannot be offered while an item is dead');

      // Now break the TOTAL as well, and check the total itself is stated.
      assert.ok(app.type('share %', '10'), 'the share field must be typeable');
      await app.settle();
      const total = 10 + 50 + 0;
      assert.ok(app.text().includes('Share of voice totals ' + total + '% — weighted needs exactly 100%'),
        'the operator must be told the total, not left to press a button that does nothing');
      assert.ok(app.text().includes(total + '% of 100%'), 'the running total must be on screen');
      assert.equal(btn(app, 'Publish now').disabled, true);

      assert.ok(app.click('Split evenly'));
      await app.settle();
      assert.equal(btn(app, 'Publish now').disabled, false, 'an even split must clear both objections');

      assert.ok(app.click('Publish now'));
      await app.settle();
      const live = M.live('cart_addon', 'all');
      assert.ok(live, 'publishing must produce a live set');
      assert.equal(live.items.length, 3);
      assert.equal(live.items.reduce((a, i) => a + i.share, 0), 100,
        'what landed in the store must be the 100 the operator was shown');
      assert.ok(live.by && live.by.who, 'who published it must be recorded');
    } finally { open.close(); }
  });
});

test('the surface capacity is stated and the picker closes, rather than letting a refusal happen', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    const cap = M.surfaceById('shop_spotlight').cap;
    const open = mounter(app, 'MerchScreen');
    try {
      await open();
      await openCell(app, 'shop_spotlight', 'All regions');
      for (let i = 0; i < cap; i++) { assert.ok(app.click([ITEM_A, ITEM_B, ITEM_C][i])); await app.settle(); }
      assert.ok(app.text().includes(cap + ' of ' + cap),
        'the operator must be told the surface is full, with its real capacity');
      assert.equal(has(app, ITEM_B), false,
        'a full surface must stop offering items — the store would refuse the set and the button would look broken');
    } finally { open.close(); }
  });
});

test('the reorder row does NOT block a lone sponsored pick — placement is the storefront\'s', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    const open = mounter(app, 'MerchScreen');
    try {
      await open();
      await openCell(app, 'home_reorder', 'All regions');
      assert.ok(app.click(ITEM_A));
      await app.settle();
      await clickSwitch(app, 0);                     // mark it sponsored
      /* ⚠️ THIS TEST USED TO ASSERT THE OPPOSITE, and the screen obliged.
       * `neverFirst` was refused against draft.items[0] — the PICK LIST — but
       * the shopper's row is assembled by the storefront, which already clamps
       * every pick to idx >= minIndex. So the check was against the wrong index
       * space, and its only real effect was that a marketer whose ONLY pick was
       * one labelled sponsor could never save it: Publish stayed disabled with
       * no way forward except adding a second card they did not want. */
      const blocked = has(app, 'Publish now') && btn(app, 'Publish now').disabled;
      assert.equal(blocked, false,
        'a single sponsored pick must be publishable — the storefront places it, not this form');
    } finally { open.close(); }
  });
});

test('a sponsored card is always disclosed to the shopper, typed label or not', async () => {
  await withApp('shop', async (app) => {
    const W = app.window, M = W.HWMerch, D = W.SHOPDATA;
    M.reset();
    /* ⚠️ THIS TEST USED TO DEMAND A TYPED LABEL and the screen obliged by
     * refusing a blank one. That was wrong in both directions: the storefront
     * defaults an empty disclosure to "Sponsored"
     * (shop/data.jsx — `String(it.sponsorLabel || '').trim() || 'Sponsored'`),
     * so a blank field is LABELLED, not unlabelled. Refusing it blocked a
     * legitimate set while proving nothing about what a shopper sees.
     *
     * What actually matters is the shopper-facing outcome, so that is what is
     * asserted, on the storefront rather than on the form. */
    const p = D.allProducts()[0];
    M.set('home_reorder', 'all', { mode: 'carousel', state: 'live', items: [
      { id: 'sku:' + p.sku, kind: 'product', sku: p.sku, label: p.name, sponsored: true },
    ] }, 'tester');

    const row = D.reorderRow ? D.reorderRow() : null;
    if (!row) return;                       // row not exposed; covered by shop-merch-surfaces
    const sponsored = row.filter((e) => e.kind === 'sponsored');
    assert.ok(sponsored.length, 'the pick must reach the row');
    for (const e of sponsored) {
      assert.ok(String(e.sponsorLabel || '').trim(),
        'every sponsored card must carry a disclosure the shopper can read');
    }
    // And never first — the storefront owns that, and it is the real guarantee.
    assert.notEqual(row[0] && row[0].kind, 'sponsored',
      'position 1 belongs to the customer\'s own history');
  });
});

test('the claim ceiling is enforced where copy is written, and moving the ceiling moves the guard', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch, C = app.window.HWClaim;
    M.reset(); C.reset();
    const open = mounter(app, 'MerchScreen');
    try {
      await open();
      assert.ok(app.click('Edit house card'));
      await app.settle();
      assert.ok(app.type('Express in ~90 min', 'Up to 97% off'));
      await app.settle();
      assert.ok(app.text().includes('97% off, over the ' + C.get() + '% claim ceiling'),
        'the exact incident — "Up to 97% off" — must be refused with the ceiling named');
      assert.equal(btn(app, 'Save house card').disabled, true);

      // The ceiling is a SETTING, so moving it must move the guard. If it did
      // not, this would be a hard-coded 60 wearing a setting's clothes.
      C.set(100);
      await app.settle();
      assert.equal(btn(app, 'Save house card').disabled, false,
        'raising the ceiling above the claim must let the same copy through');
      assert.ok(app.click('Save house card'));
      await app.settle();
      assert.equal(M.houseCard().headline, 'Up to 97% off');
      assert.equal(M.houseCardBy().who.length > 0, true, 'who edited the house card must be recorded');
      C.reset();
    } finally { open.close(); }
  });
});

test('a claim over the ceiling blocks a slot too, not only the house card', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch, C = app.window.HWClaim;
    M.reset(); C.reset();
    M.set('shop_spotlight', 'all', { mode: 'carousel', state: 'draft',
      items: [{ id: 'x', kind: 'promo', label: 'STIIIZY — 90% off this weekend' }] }, 'seed');
    const open = mounter(app, 'MerchScreen');
    try {
      await open();
      await openCell(app, 'shop_spotlight', 'All regions');
      assert.ok(app.text().includes('advertises 90% off, over the ' + C.get() + '% claim ceiling'));
      assert.equal(btn(app, 'Publish now').disabled, true);
    } finally { open.close(); }
  });
});

test('the ceiling REFUSES a figure that would switch the guard off, in either direction', async () => {
  await withApp('pos', async (app) => {
    const C = app.window.HWClaim;
    C.reset();
    const base = C.get();
    // Zero refuses every claim; 250 refuses none. Both are the guard turned
    // off, and neither looks wrong on screen.
    assert.equal(C.set(0), null);
    assert.equal(C.set(250), null);
    assert.equal(C.set('sixty'), null);
    assert.equal(C.get(), base, 'a refused write must not have landed');
    assert.equal(C.set(40), 40);
    assert.equal(C.isDefault(), false, 'a surface cannot label the figure provisional if it cannot tell it was touched');
    C.reset();
    assert.equal(C.isDefault(), true);
  });
});

test('history records who and when, and rollback restores the earlier set', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    M.set('checkout_addon', 'all', { mode: 'carousel', state: 'live', items: [{ id: 'v1', kind: 'brand', label: 'Version one' }] }, 'Ana');
    M.set('checkout_addon', 'all', { mode: 'carousel', state: 'live', items: [{ id: 'v2', kind: 'brand', label: 'Version two' }] }, 'Ben');
    const open = mounter(app, 'MerchScreen');
    try {
      await open();
      await openCell(app, 'checkout_addon', 'All regions');
      assert.ok(app.click((t) => t.startsWith('History (')), 'the history control must be reachable');
      await app.settle();
      assert.ok(app.text().includes('Ana'), 'the earlier author must be named in history');

      /* A rollback the store refuses must be SHOWN. This is the same failure as
       * a swallowed save, and worse: the operator believes the slot went back
       * and it did not. */
      const realRollback = M.rollback;
      M.rollback = () => null;
      assert.ok(app.click('Roll back'));
      await app.settle();
      assert.ok(app.text().includes('rollback was REFUSED'), 'a refused rollback must be surfaced');
      assert.equal(M.live('checkout_addon', 'all').items[0].id, 'v2', 'and nothing must have moved');
      M.rollback = realRollback;

      assert.ok(app.click('Roll back'));
      await app.settle();
      const now = M.live('checkout_addon', 'all');
      assert.equal(now.items[0].id, 'v1', 'rollback must restore the earlier set');
      // The rollback is itself a change: attributing it to Ana would leave a
      // hole in the record of who did what.
      assert.notEqual(now.by.who, 'Ana');
      assert.ok(now.by.who, 'the rollback must be attributed to whoever performed it');
    } finally { open.close(); }
  });
});

test('a region with no set of its own is shown as inheriting, and an override is shown as its own', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    M.set('home_hero', 'all', { mode: 'carousel', state: 'live', items: [{ id: 'd', kind: 'brand', label: 'Default' }] }, 'Ana');
    const open = mounter(app, 'MerchScreen');
    const cellText = (region) => {
      const el = [...app.document.querySelectorAll('button')]
        .find((b) => (b.getAttribute('title') || '') === M.surfaceById('home_hero').label + ' · ' + region);
      assert.ok(el, `no cell for ${region}`);
      return el.textContent || '';
    };
    try {
      await open();
      assert.ok(cellText('Corona').includes('From All regions'), 'an unset region must be shown as inheriting');
      assert.ok(cellText('Corona').includes('Showing 1'), 'and as genuinely showing the inherited set');

      await openCell(app, 'home_hero', 'Corona');
      assert.ok(app.text().includes('has no set of its own'), 'the editor must say the region is inheriting');
      assert.ok(app.click('Publish now'));
      await app.settle();
      assert.ok(!cellText('Corona').includes('From All regions'), 'an override must stop reading as inherited');
      assert.ok(M.get('home_hero', 'corona'), 'the override must exist in the store');
      assert.ok(M.get('home_hero', 'west-la') === null, 'the other regions must be untouched by one override');
    } finally { open.close(); }
  });
});

test('a refusal from the store is SHOWN, never swallowed by a button that looks like it worked', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    const open = mounter(app, 'MerchScreen');
    const realSet = M.set;
    try {
      await open();
      await openCell(app, 'cart_addon', 'All regions');
      assert.ok(app.click(ITEM_A));
      await app.settle();
      assert.equal(btn(app, 'Publish now').disabled, false);

      /* The form predicts the store's refusals — but if the store ever refuses
       * for a reason the form does not model, the operator must see THAT, not a
       * modal that closes on a write which never happened. */
      M.set = () => null;
      assert.ok(app.click('Publish now'));
      await app.settle();
      assert.ok(app.text().includes('REFUSED this set and nothing was written'),
        'an unpredicted refusal must be surfaced');
      assert.ok(btn(app, 'Publish now'), 'the editor must stay open so the work is not lost');
      assert.equal(M.live('cart_addon', 'all'), null, 'and nothing must have been written');
    } finally { M.set = realSet; open.close(); }
  });
});

test('rails offer all five, disable auto, and say what each disabled mode needs', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    const open = mounter(app, 'MerchScreen');
    try {
      await open();
      const t = app.text();
      for (const r of ['Fresh Drops', 'On Sale', 'Staff Picks', 'Best Sellers', 'New Arrivals']) {
        assert.ok(t.includes(r), `${r} must be offered`);
      }
      // The mode is offered and switched off, with the missing fields named —
      // an auto rail here would rank on something invented.
      assert.ok(btn(app, 'Auto'), 'the auto mode must be visible, not hidden');
      assert.ok(t.includes('unitsSold') && t.includes('firstSeenAt'),
        'the fields an auto rail needs must be named on screen');

      // And the editorial picker is honest about why it cannot save yet: the
      // seam carries no rail surface, so a set for one would be refused.
      const picks = [...app.document.querySelectorAll('button')].filter((b) => (b.textContent || '').trim() === 'Pick items');
      assert.equal(picks.length, 5, 'every rail must offer its picker');
      const wired = picks.filter((b) => !b.disabled).length;
      const railSurfaces = M.SURFACES.filter((s) => s.id.indexOf('rail_') === 0).length;
      assert.equal(wired, railSurfaces,
        'a rail picker may only be live when the seam actually carries a rail_* surface for it');
      assert.ok(t.includes('HWMerch.SURFACES'), 'the screen must name the one-line fix rather than implying "coming soon"');
    } finally { open.close(); }
  });
});

test('POS settings reaches the claim ceiling, beside the lane minimums', async () => {
  await withApp('pos', async (app) => {
    const C = app.window.HWClaim;
    C.reset();
    const open = mounter(app, 'SettingsScreen');
    try {
      await open();
      assert.ok(app.text().includes('Claim Ceiling'), 'the setting must exist in POS settings');
      assert.ok(app.text().includes('Max advertised ' + C.get() + '%'),
        'the card must state the figure in force, the way the lane card states the express minimum');

      // The settings cards are Cards, not buttons — dispatch on the card the
      // way a mouse would, so this proves the card is genuinely wired.
      const card = [...app.document.querySelectorAll('div')]
        .filter((d) => (d.textContent || '').trim().startsWith('Claim Ceiling')).pop();
      assert.ok(card, 'the Claim Ceiling card must be on screen');
      card.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      await app.settle();
      assert.ok(app.text().includes('The deepest discount merchandising copy may advertise'),
        'the card must open the claim ceiling editor');
      assert.ok(app.text().includes('SPOTLIGHT_MAX_PCT'),
        'the panel must name what the setting does NOT reach yet — the storefront constant');
    } finally { open.close(); }
  });
});

test('the ceiling is one figure: it takes over the estate-wide setting as soon as that carries the key', async () => {
  await withApp('pos', async (app) => {
    const W = app.window, C = W.HWClaim, HW = W.HW;
    C.reset();

    /* TODAY: pos/data.jsx's setLaneSettings copies only the keys in
     * LANE_DEFAULTS, so a claimCeilingPct patch is silently dropped. The setter
     * must NOT believe that write — it has to check what came back, or the
     * operator's figure vanishes and the screen reports the default. */
    assert.equal(C.isShared(), false, 'the shared setting does not carry the key yet');
    assert.equal(C.set(42), 42);
    assert.equal(C.get(), 42, 'a dropped shared write must fall back, not lose the figure');
    assert.equal(Number(HW.laneSettings().claimCeilingPct) || 0, 0, 'and nothing must have landed there');
    C.reset();

    /* TOMORROW: the one-line change lands and laneSettings carries it. Both this
     * tab and the storefront then read the same number with no edit here —
     * shop/data.jsx already looks for exactly this key. */
    const realGet = HW.laneSettings, realSet = HW.setLaneSettings;
    let shared = { expressMinimum: 50, claimCeilingPct: 35 };
    HW.laneSettings = () => ({ ...shared });
    HW.setLaneSettings = (patch) => {
      if (patch && 'claimCeilingPct' in patch) shared = { ...shared, claimCeilingPct: patch.claimCeilingPct };
      return { ...shared };
    };
    try {
      assert.equal(C.isShared(), true);
      assert.equal(C.get(), 35, 'the estate-wide figure must win over the browser-local one');
      assert.equal(C.set(25), 25);
      assert.equal(shared.claimCeilingPct, 25, 'the write must land ON the shared setting, not beside it');
      assert.equal(C.get(), 25);
    } finally { HW.laneSettings = realGet; HW.setLaneSettings = realSet; C.reset(); }
  });
});

test('the header shortcut opens the ceiling editor in place, without losing the page', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch, C = app.window.HWClaim;
    M.reset(); C.reset();
    const open = mounter(app, 'MerchScreen');
    try {
      await open();
      assert.ok(app.text().includes('Claim ceiling · ' + C.get() + '%'),
        'the figure in force must be readable without opening anything');
      assert.ok(app.click((t) => t.startsWith('Claim ceiling ·')), 'the shortcut must be a real control');
      await app.settle();
      assert.ok(app.text().includes('The deepest discount merchandising copy may advertise'),
        'the shortcut must open the same editor Settings opens');
      // In place, not by navigation: the board is still behind it, so a slot
      // half way through editing survives.
      assert.ok(app.text().includes('The board'), 'the merchandising screen must still be mounted underneath');
    } finally { open.close(); }
  });
});

test('the PICKER files a record the storefront can resolve — driven, then read back', async () => {
  await withApp('pos', async (app) => {
    const M = app.window.HWMerch;
    M.reset();
    const open = mounter(app, 'MerchScreen');
    try {
      await open();
      await openCell(app, 'shop_spotlight', 'All regions');
      assert.ok(app.click(ITEM_A), 'the picker must offer ' + ITEM_A);
      await app.settle();
      assert.ok(app.click('Publish now'), 'Publish must be reachable for a single valid pick');
      await app.settle();

      /* 🔴 READ THE FILED RECORD, NOT THE CLICK. Every earlier test in this
       * file asserted that a click returned true — which is why the tab shipped
       * filing { id, kind, label } while shop/data.jsx resolves a pick by
       * `item.brand` or `item.sku`. Neither key was written, so every storefront
       * eligibility guard was switched off and a brand the shop does not carry
       * sailed straight through. Four screens of guards in front of a path no
       * POS-authored record could reach. */
      const filed = M.get('shop_spotlight', 'all');
      assert.ok(filed && filed.items.length, 'the pick must actually be filed');
      const it = filed.items[0];
      assert.ok(it.brand || it.sku,
        'the filed record carries neither `brand` nor `sku` — the storefront cannot resolve it, ' +
        'and every eligibility guard downstream becomes unreachable. Got: ' + JSON.stringify(it));
    } finally { open.close(); }
  });
});

test('a product pick files its sku, the same way', async () => {
  await withApp('pos', async (app) => {
    const W = app.window, M = W.HWMerch;
    M.reset();
    const prod = ((W.HW && W.HW.PRODUCTS) || []).find((p) => p.active);
    assert.ok(prod, 'the catalogue must hold an active product');
    const open = mounter(app, 'MerchScreen');
    try {
      await open();
      await openCell(app, 'cart_addon', 'All regions');
      // Search narrows the picker to this exact product, so the chip we click is
      // the product and not a brand that happens to share a prefix.
      assert.ok(app.type('Search brands and products', prod.name), 'the picker search must take input');
      await app.settle();
      assert.ok(app.click(prod.name), 'the picker must offer ' + prod.name);
      await app.settle();
      assert.ok(app.click('Publish now'));
      await app.settle();

      const it = M.get('cart_addon', 'all').items[0];
      assert.equal(it.sku, prod.sku,
        'a product pick must carry its sku — got ' + JSON.stringify(it));
    } finally { open.close(); }
  });
});
