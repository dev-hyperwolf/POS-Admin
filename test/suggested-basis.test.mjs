/* ── "Suggested" — THE CHIP THAT IS ONLY ALLOWED TO CLAIM WHAT IT WAS GIVEN ──
 *
 * The register now carries two suggestion chips. "Pairs with cart" ranks on the
 * TICKET through the upsell engine and is covered by pos-upsell-surfaces.test.
 * This file covers the other one, which ranks on the PERSON — and the person is
 * where this estate has almost nothing.
 *
 * ⚠️ EVERY ASSERTION HERE IS ABOUT TELLING TWO STATES APART. Nothing pins a
 * sentence's exact wording; each test takes the sentence produced by state A
 * and the sentence produced by state B and fails if they are equal. A test that
 * pinned copy would pass a build that printed the same reassuring line for all
 * four bases, which is the exact defect.
 *
 * ⚠️ THE MOCK CATALOGUE HAS NO HOUSE-BRAND PRODUCT IN IT — 0 of 24 rows, and
 * shared/brands.js (the vendor list) has no Hyperwolf row to read one off. So
 * the fixtures STRADDLE: the tests that prove the ranking works inject a
 * house-branded product, and the tests that prove the empty case is announced
 * use the catalogue as shipped. A suite that only ever ran one of those would
 * prove nothing about the branch it never entered.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';

/** Mount a screen on a host of its own, so a second mount is a clean slate. */
function mounter(app) {
  const W = app.window;
  let cur = null;
  const close = () => {
    if (!cur) return;
    try {cur.root.unmount();} catch {/* already gone */}
    cur.host.remove();
    cur = null;
  };
  const open = async (name) => {
    close();
    assert.equal(typeof W[name], 'function', `${name} is not on the page — errors: ${app.errors.join(' | ') || '(none)'}`);
    const host = W.document.createElement('div');
    W.document.body.appendChild(host);
    const root = W.ReactDOM.createRoot(host);
    root.render(W.React.createElement(W[name]));
    cur = { root, host };
    await app.settle(); await app.settle();
  };
  open.close = close;
  return open;
}

const gridSkus = (app) => [...app.document.querySelectorAll('[data-hw-sku]')].
  map((e) => e.getAttribute('data-hw-sku'));

/** The basis banner: its machine state and the sentence the operator reads. */
function banner(app) {
  const el = app.document.querySelector('[data-hw-suggest-basis]');
  return el ? { kind: el.getAttribute('data-hw-suggest-basis'), text: el.textContent.trim() } : null;
}

/** A house-branded product the mock catalogue does not have. Built off a real
 *  row so every field the grid dereferences is present and of the right type. */
function houseProduct(W, sku = 'HWHOUSE1') {
  const base = W.HW.PRODUCTS.find((p) => p.active && p.qty > 0);
  return { ...base, id: sku, sku, name: 'House Test Item', brand: 'Hyperwolf' };
}

/* ── 1. both chips are there, under the names the owner asked for ─────────── */

test('the register carries "Suggested" and "Pairs with cart", and no "For this ticket"', async () => {
  await withApp('pos', async (app) => {
    const open = mounter(app);
    try {
      await open('RegisterScreen');
      const b = app.buttons();
      assert.ok(b.includes('Suggested'), `no "Suggested" chip — buttons: ${b.slice(0, 16).join(' | ')}`);
      assert.ok(b.includes('Pairs with cart'), `no "Pairs with cart" chip — buttons: ${b.slice(0, 16).join(' | ')}`);
      assert.ok(!app.text().includes('For this ticket'),
        'the old label survived the rename and now two names describe one control');
    } finally { open.close(); }
  });
});

/* ── 2. the basis is VISIBLE TEXT, every time the chip is on ──────────────── */

test('turning "Suggested" on always prints the basis, and turning it off takes the claim with it', async () => {
  await withApp('pos', async (app) => {
    const open = mounter(app);
    try {
      await open('RegisterScreen');
      assert.equal(banner(app), null, 'the grid is claiming a basis nobody asked for');
      assert.ok(app.click('Suggested'), 'no "Suggested" chip to click');
      await app.settle();
      const shown = banner(app);
      assert.ok(shown, 'the chip is on and the screen does not say what produced the order');
      assert.ok(shown.text.length > 20, `the basis line is too short to be a sentence: ${JSON.stringify(shown.text)}`);
      assert.ok(app.click('Suggested'), 'the chip does not toggle off');
      await app.settle();
      assert.equal(banner(app), null, 'the basis line outlived the chip that made it');
    } finally { open.close(); }
  });
});

/* ── 3. ORDER, never filter — and never move at all on an empty basis ─────── */

test('a basis that found nothing leaves the grid exactly where it was, and says so', async () => {
  await withApp('pos', async (app) => {
    const open = mounter(app);
    try {
      // The mock catalogue as shipped: not one house-branded row.
      await open('RegisterScreen');
      const before = gridSkus(app);
      assert.ok(before.length > 3, 'the grid is too small to tell a sort from a filter');
      assert.ok(app.click('Suggested'));
      await app.settle();
      const shown = banner(app);
      assert.equal(shown.kind, 'no-house-brand',
        `expected the empty-catalogue basis, got ${shown.kind}: ${shown.text}`);
      assert.equal(gridSkus(app).join(','), before.join(','),
        'the chip re-ordered the grid on a basis that selected nothing');
      assert.ok(/nothing was ranked/i.test(shown.text),
        `the grid did not move and the screen does not say so: ${JSON.stringify(shown.text)}`);
    } finally { open.close(); }
  });
});

test('a house-branded product is lifted to the top without a single tile leaving the grid', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    const open = mounter(app);
    try {
      const sku = 'HWHOUSE1';
      W.HW.PRODUCTS.push(houseProduct(W, sku));
      await open('RegisterScreen');
      const before = gridSkus(app);
      assert.ok(before.includes(sku), 'the injected house-brand product never reached the grid');
      assert.notEqual(before[0], sku, 'the fixture is already first — this proves nothing about the lift');

      assert.ok(app.click('Suggested'));
      await app.settle();
      const after = gridSkus(app);
      assert.equal(after.length, before.length,
        `the grid went from ${before.length} tiles to ${after.length} — it filtered instead of ordering`);
      assert.equal([...after].sort().join(','), [...before].sort().join(','),
        'the chip changed WHICH products the grid holds, not just their order');
      assert.equal(after[0], sku, `the house-brand product is not first — grid: ${after.slice(0, 4).join(', ')}`);
      const shown = banner(app);
      assert.ok(/Hyperwolf/.test(shown.text), `the basis line does not name the brand it ranked on: ${shown.text}`);
      assert.ok(/1 of \d+/.test(shown.text),
        `the basis line does not say how much of the catalogue it found: ${JSON.stringify(shown.text)}`);
    } finally { open.close(); }
  });
});

/* ── 4. the two chips are one ordering at a time ──────────────────────────── */

test('lighting one suggestion chip puts the other one out', async () => {
  await withApp('pos', async (app) => {
    const open = mounter(app);
    try {
      await open('RegisterScreen');
      assert.ok(app.click('Pairs with cart'));
      await app.settle();
      assert.ok(app.text().includes('Best match first') || app.text().includes('No ranking'),
        'the ticket ranking did not come on');
      assert.ok(app.click('Suggested'));
      await app.settle();
      assert.ok(banner(app), 'the person basis did not come on');
      assert.ok(!app.text().includes('Best match first'),
        'both rankings are applied to one grid at once — the order is now nobody’s claim');

      // AND THE OTHER WAY ROUND. One chip clearing the other is two edits, and
      // a suite that only ever drives one direction passes a build where only
      // one of them was made.
      assert.ok(app.click('Pairs with cart'));
      await app.settle();
      assert.equal(banner(app), null,
        'the person basis is still claimed while the ticket ranking is what re-ordered the grid');
    } finally { open.close(); }
  });
});

/* ── 5. THE HEART OF IT: four different reasons for the same fallback, and
 *      four different sentences. This is the requirement in one test. ─────── */

test('first visit, a returning customer, an unknown visit count and no customer at all are four DIFFERENT claims', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    const SB = W.HWSuggestBasis;
    assert.ok(SB, 'window.HWSuggestBasis is not on the page');
    // Straddle: with house-brand stock, so every branch actually RANKS and the
    // only thing that differs between them is the claim about the person.
    const catalogue = W.HW.PRODUCTS.filter((p) => p.active).concat([houseProduct(W)]);

    const firstTimer = SB.resolve({ customer: { id: 'x', name: 'A', visits: 1 }, catalogue });
    const returning = SB.resolve({ customer: { id: 'y', name: 'B', visits: 7 }, catalogue });
    const unknown = SB.resolve({ customer: { id: 'z', name: 'C' }, catalogue });   // no `visits` key at all
    const nobody = SB.resolve({ customer: null, catalogue });

    const all = { firstTimer, returning, unknown, nobody };
    for (const [k, v] of Object.entries(all)) {
      assert.ok(v && v.line && v.line.length > 20, `${k} produced no readable basis line: ${JSON.stringify(v)}`);
      assert.equal(v.ranks, true, `${k} refused to rank a catalogue that has a house-brand product in it`);
    }
    const lines = Object.entries(all).map(([k, v]) => [k, v.line]);
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        assert.notEqual(lines[i][1], lines[j][1],
          `${lines[i][0]} and ${lines[j][0]} print the SAME sentence — the operator cannot tell them apart:\n  ${lines[i][1]}`);
      }
    }
    // And the one that matters most: a missing visit count must not be rounded
    // into "first visit". HW.visitLabel() does exactly that (`n = n || 1`).
    assert.notEqual(unknown.kind, firstTimer.kind,
      'a record with NO visit count was reported as a first-timer — an absence rendered as an answer');
    assert.ok(!/first visit/i.test(unknown.line),
      `the unknown-visit-count sentence claims a first visit: ${unknown.line}`);
  });
});

/* ── 6. the history branch: it exists, it is named, and it is not faked ───── */

test('with no history source wired, no basis ever claims to have ranked on history', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    assert.equal(typeof W.HW.purchaseHistory, 'undefined',
      'something now defines HW.purchaseHistory — update this test and the SPEC in screen-cart.jsx');
    const catalogue = W.HW.PRODUCTS.filter((p) => p.active).concat([houseProduct(W)]);
    for (const visits of [1, 4]) {
      const b = W.HWSuggestBasis.resolve({ customer: { id: 'm', name: 'M', visits }, catalogue });
      assert.notEqual(b.kind, 'history', `visits=${visits} produced a history ranking out of nothing`);
      assert.equal(b.source, null, `visits=${visits} named a source that does not exist: ${b.source}`);
      assert.ok(!/purchase history —|Bought before/.test(b.reason || ''),
        `the tile reason claims prior purchase: ${b.reason}`);
    }
  });
});

test('a wired history source is used, is named on screen, and reads differently from the house-brand default', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    const catalogue = W.HW.PRODUCTS.filter((p) => p.active).concat([houseProduct(W)]);
    const bought = catalogue[3].sku;
    const cust = { id: 'm5', name: 'Joseph Levi', visits: 8 };

    const withoutSource = W.HWSuggestBasis.resolve({ customer: cust, catalogue });

    W.HW.purchaseHistory = () => ({ skus: [bought], orders: 3, source: 'test fixture' });
    try {
      const withHistory = W.HWSuggestBasis.resolve({ customer: cust, catalogue });
      assert.equal(withHistory.kind, 'history', `a wired source was ignored: ${withHistory.kind}`);
      assert.equal(withHistory.skus[0], bought, 'the history basis did not lift what the source said was bought');
      assert.ok(withHistory.line.includes('test fixture'),
        `the basis line does not name where the history came from: ${withHistory.line}`);
      assert.notEqual(withHistory.line, withoutSource.line,
        'ranking on real history and ranking on the house-brand default print the same sentence');

      // A source that cannot say where it came from is refused, not used.
      W.HW.purchaseHistory = () => ({ skus: [bought], orders: 3 });
      const unsourced = W.HWSuggestBasis.resolve({ customer: cust, catalogue });
      assert.notEqual(unsourced.kind, 'history',
        'an unattributed list of skus was accepted as purchase history');

      // History that is real and entirely out of stock is its OWN state — the
      // operator can say "what you always buy is out", which is not "no history".
      W.HW.purchaseHistory = () => ({ skus: ['NOT-IN-CATALOGUE'], orders: 2, source: 'test fixture' });
      const stockless = W.HWSuggestBasis.resolve({ customer: cust, catalogue });
      assert.equal(stockless.ranks, false, 'a basis with nothing in stock still re-ordered the grid');
      assert.notEqual(stockless.line, withoutSource.line,
        '"we have your history and none of it is in stock" reads exactly like "we have no history"');
    } finally { delete W.HW.purchaseHistory; }
  });
});

/* ── 7. an unbranded row is not evidence of anything, and is declared ─────── */

test('products with no brand at all are counted and disclosed, never scored as not-house-brand', async () => {
  await withApp('pos', async (app) => {
    const W = app.window;
    const base = W.HW.PRODUCTS.find((p) => p.active && p.qty > 0);
    const catalogue = [
      { ...base, id: 'HB1', sku: 'HB1', brand: 'Hyperwolf' },
      { ...base, id: 'NB1', sku: 'NB1', brand: '' },
      { ...base, id: 'NB2', sku: 'NB2', brand: null },
      { ...base, id: 'OT1', sku: 'OT1', brand: 'Some Other Brand' }];

    const b = W.HWSuggestBasis.resolve({ customer: { id: 'q', name: 'Q', visits: 1 }, catalogue });
    assert.equal(b.counts.house, 1, 'the house-brand count is wrong');
    assert.equal(b.counts.noBrand, 2, 'a row with no brand was counted as having one');
    assert.deepEqual(b.skus, ['HB1'], 'an unbranded row was lifted as if it were house brand');
    assert.ok(b.line.includes('2 of 4'),
      `the basis is partial over 2 of 4 rows and does not say so: ${b.line}`);
  });
});
