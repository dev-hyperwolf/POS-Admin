/* shared/hw-live-history.js — the three states, executed, not grepped.
 *
 * WHY THIS FILE EXISTS. The seam's entire job is to keep three facts apart:
 *
 *   history        we know what this customer bought
 *   no_purchases   we know them and they have bought nothing
 *   unknown        we have no line data for them at all
 *
 * An empty product list renders identically for all three, and for a fourth
 * and fifth case the route can also produce — a 409 refusal, and a fetch that
 * has not come back yet. The default in every one of those is the branch that
 * LOOKS LIKE AN ANSWER: "this customer has bought nothing yet", under which an
 * operator hands a repeat customer a first-timer offer, or hands a stranger a
 * suggestion built from someone else's history.
 *
 * So these tests RUN the seam against a stubbed fetch rather than asserting on
 * its source text. A grep for the word 'unknown' passes on a file that renders
 * it green; only executing it proves the states stay apart.
 *
 * The seam needs no DOM to be exercised: paint() returns early with no palette
 * and no dock, which is exactly the GitHub-Pages path.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../shared/hw-live-history.js', import.meta.url), 'utf8');

/** A minimal window the IIFE can arm against. No DOM, no THEMES: paint() bails. */
function bootSeam(routes, hw) {
  const calls = [];
  const W = {
    location: { origin: 'http://127.0.0.1:8950', search: '', reload() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setTimeout, clearTimeout, URL,
    HW: hw || {},
    fetch(url, opts) {
      calls.push(url);
      const path = url.replace('http://127.0.0.1:8950', '');
      const hit = routes(path);
      return Promise.resolve({
        ok: hit.status >= 200 && hit.status < 300,
        status: hit.status,
        json: () => Promise.resolve(hit.body),
      });
    },
  };
  W.window = W;
  const doc = { body: null, addEventListener() {} };
  // The IIFE closes over `window`, `document` and `fetch` as free names.
  new Function('window', 'document', 'fetch', 'setTimeout', 'clearTimeout',
               'URL', 'MutationObserver', SRC)(
    W, doc, W.fetch.bind(W), setTimeout, clearTimeout, URL,
    function () { return { observe() {} }; });
  return { W, calls };
}

const HISTORY = {
  state: 'history', state_code: 'history',
  state_reason: 'Repeat Buyer bought 3 products across 4 orders.',
  subject: { identity_id: 7, name: 'Repeat Buyer', accounts: ['a', 'b'] },
  counts: { purchase_orders: 4, cancelled_orders: 1, products: 3 },
  items: [{ key: 'sku:A', sku: 'A', name: 'A', orders: 3, units: 3, resolved: true }],
  ranking_input: { basis: 'repeat_purchase', basis_is_default: false,
                   basis_sentence: 'Suggested from this customer\'s own purchases.' },
};
const NO_PURCHASES = {
  state: 'no_purchases', state_code: 'no_orders_on_record',
  state_reason: 'Newcomer has no Weedmaps order on any bound account.',
  subject: { identity_id: 8, name: 'Newcomer', accounts: ['c'] },
  counts: { purchase_orders: 0, cancelled_orders: 0, products: 0 },
  items: [],
  ranking_input: { basis: 'house_brand_default', basis_is_default: true,
                   basis_sentence: 'NOT personalised. Bought nothing yet.' },
};
const UNKNOWN = {
  state: 'unknown', state_code: 'orders_without_line_data',
  state_reason: 'Blind has 2 standing orders and no readable line items.',
  subject: { identity_id: 9, name: 'Blind', accounts: ['d'] },
  counts: { purchase_orders: 2, cancelled_orders: 0, products: 0 },
  items: [],
  ranking_input: { basis: 'house_brand_default', basis_is_default: true,
                   basis_sentence: 'NOT personalised. We have no record.' },
};
const REFUSAL = {
  error: 'Weedmaps customer 16665721 is bound to 4 different live people.',
  code: 'wm_id_on_multiple_identities', identity_ids: [242, 246, 261, 262],
};

function router(path) {
  if (path.includes('identity_id=0')) { return { status: 409, body: { code: 'identity_not_found' } }; }
  if (path.includes('identity_id=7')) { return { status: 200, body: HISTORY }; }
  if (path.includes('identity_id=8')) { return { status: 200, body: NO_PURCHASES }; }
  if (path.includes('identity_id=9')) { return { status: 200, body: UNKNOWN }; }
  if (path.includes('wm_customer_id=16665721')) { return { status: 409, body: REFUSAL }; }
  if (path.includes('identity_id=500')) { return { status: 500, body: { error: 'boom' } }; }
  return { status: 404, body: {} };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

test('the three states survive a round trip and stay three states', async () => {
  const { W } = bootSeam(router);
  await W.HW_HISTORY.fetch({ identity_id: 7 });
  await W.HW_HISTORY.fetch({ identity_id: 8 });
  await W.HW_HISTORY.fetch({ identity_id: 9 });
  const h = W.HW.purchaseHistory({ identity_id: 7 });
  const n = W.HW.purchaseHistory({ identity_id: 8 });
  const u = W.HW.purchaseHistory({ identity_id: 9 });
  assert.equal(h.state, 'history');
  assert.equal(n.state, 'no_purchases');
  assert.equal(u.state, 'unknown');
  assert.notEqual(n.state, u.state,
    'no_purchases and unknown collapsed — this is the defect the route exists to stop');
  assert.notEqual(n.state_reason, u.state_reason);
});

test('a cold key is loading, NEVER no_purchases', async () => {
  const { W } = bootSeam(router);
  const cold = W.HW.purchaseHistory({ identity_id: 7 });
  assert.equal(cold.state, 'loading',
    'a history that has not come back yet must not read as "bought nothing"');
  assert.notEqual(cold.state, 'no_purchases');
  await settle();
});

test('a 409 refusal is read as a refusal, not as an empty history', async () => {
  const { W } = bootSeam(router);
  await W.HW_HISTORY.fetch({ wm_customer_id: '16665721' });
  const r = W.HW.purchaseHistory({ wm_customer_id: '16665721' });
  assert.equal(r.state, 'unavailable');
  assert.equal(r.state_code, 'wm_id_on_multiple_identities');
  assert.notEqual(r.state, 'no_purchases');
  assert.ok(/four different live people|4 different live people/.test(r.state_reason),
    'the refusal sentence was dropped: ' + r.state_reason);
  assert.deepEqual(r.refusal.identity_ids, [242, 246, 261, 262]);
  assert.equal(W.HW_HISTORY.cached['wm_customer_id=16665721'], undefined,
    'a refusal must never be cached as a history payload');
});

test('a 500 is "not read", which is not "bought nothing"', async () => {
  const { W } = bootSeam(router);
  await W.HW_HISTORY.fetch({ identity_id: 500 });
  const r = W.HW.purchaseHistory({ identity_id: 500 });
  assert.equal(r.state, 'unavailable');
  assert.notEqual(r.state, 'no_purchases');
  assert.ok(/NOT "they have bought nothing"/.test(r.state_reason));
});

test('two customer keys are refused locally, not silently narrowed to one', async () => {
  const { W } = bootSeam(router);
  const r = W.HW.purchaseHistory({ identity_id: 7, pos_customer_id: 'POS-C-7' });
  assert.equal(r.state_code, 'conflicting_customer_keys');
  assert.notEqual(r.state, 'history');
});

test('the default basis is flagged and never reads like a personal one', async () => {
  const { W } = bootSeam(router);
  await W.HW_HISTORY.fetch({ identity_id: 7 });
  await W.HW_HISTORY.fetch({ identity_id: 8 });
  const h = W.HW.purchaseHistory({ identity_id: 7 }).ranking_input;
  const n = W.HW.purchaseHistory({ identity_id: 8 }).ranking_input;
  assert.equal(h.basis_is_default, false);
  assert.equal(n.basis_is_default, true);
  assert.notEqual(h.basis_sentence, n.basis_sentence);
});

test('an unheard-of server state is treated as unknown, never as good news', () => {
  const m = SRC.match(/var STATE_TONE = \{[^}]*\}/);
  assert.ok(m, 'STATE_TONE table not found');
  assert.ok(/history:\s*'good'/.test(m[0]));
  assert.ok(/no_purchases:\s*'neutral'/.test(m[0]));
  assert.ok(/unknown:\s*'bad'/.test(m[0]));
  assert.ok(/STATE_TONE\[d\.state\] \|\| 'bad'/.test(SRC),
    'a state this file has not heard of must fall to bad tone, not to good');
});

test('window.HW is mutated in place — a reassignment drops every other seam', async () => {
  // The object is built BEFORE the seam arms, and it carries another seam's
  // contribution. waitForHW() runs synchronously at arm time, so capturing
  // W.HW after boot would miss a reassignment that happened during it — which
  // is exactly when a seam would do it.
  const otherSeam = { ORDER_LINES: {}, orderLines() { return 'other seam'; } };
  const { W } = bootSeam(router, otherSeam);
  await W.HW_HISTORY.fetch({ identity_id: 7 });
  assert.equal(W.HW, otherSeam, 'window.HW was reassigned, not mutated');
  assert.equal(typeof W.HW.orderLines, 'function',
    'a sibling seam\'s contribution was dropped off window.HW');
  assert.equal(W.HW.orderLines(), 'other seam');
  assert.equal(typeof W.HW.purchaseHistory, 'function');
  assert.equal(typeof W.HW.PURCHASE_HISTORY, 'object');
});

test('the seam ranks nothing itself', () => {
  assert.ok(!/\.sort\(/.test(SRC),
    'the seam sorted something — ranking belongs to one implementation, not two');
});

test('off is a state of its own, not an empty history', () => {
  const { W } = bootSeam(router);
  // Simulate the kill switch by asking the disabled path directly.
  const off = bootSeamOff();
  assert.equal(off.state, 'off');
  assert.notEqual(off.state, 'no_purchases');
  assert.ok(/not the same as nothing having been bought/.test(off.state_reason));
  function bootSeamOff() {
    const b = bootSeam(router);
    b.W.location.search = '?hwhistory=off';
    // Re-arm a fresh copy with the flag set before the IIFE reads it.
    const W2 = {
      location: { origin: 'http://x', search: '?hwhistory=off', reload() {} },
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      setTimeout, clearTimeout, URL, HW: {},
      fetch: () => { throw new Error('a disarmed seam must not fetch'); },
    };
    W2.window = W2;
    new Function('window', 'document', 'fetch', 'setTimeout', 'clearTimeout',
                 'URL', 'MutationObserver', SRC)(
      W2, { body: null, addEventListener() {} }, W2.fetch, setTimeout,
      clearTimeout, URL, function () { return { observe() {} }; });
    return W2.HW.purchaseHistory({ identity_id: 7 });
  }
});

/* ── the consumer's contract (pos/screen-cart.jsx window.HWSuggestBasis) ──────
 * That module was written against a seam that did not exist and specified its
 * shape: { skus, orders, source }. Its readHistory() refuses a list with no
 * `source` and refuses an empty list. These tests hold BOTH halves: the fields
 * are present so the branch can light up at all, and the three states stay
 * apart inside the very field it reads. */
test('the consumer contract { skus, orders, source } is satisfied', async () => {
  const { W } = bootSeam(router);
  await W.HW_HISTORY.fetch({ identity_id: 7 });
  const h = W.HW.purchaseHistory({ identity_id: 7 });
  assert.ok(Array.isArray(h.skus) && h.skus.length, 'skus missing — the chip can never light up');
  assert.deepEqual(h.skus, ['A']);
  assert.equal(h.orders, 4);
  assert.ok(String(h.source || '').trim(), 'source missing — a ranking whose basis cannot be named is refused by the consumer');
  assert.ok(h.source.includes('/api/customer/purchase-history'),
    'source must name the route that produced it, not this file');
});

test('skus keeps the three states apart: list / empty / null', async () => {
  const { W } = bootSeam(router);
  for (const id of [7, 8, 9]) { await W.HW_HISTORY.fetch({ identity_id: id }); }
  const h = W.HW.purchaseHistory({ identity_id: 7 });
  const n = W.HW.purchaseHistory({ identity_id: 8 });
  const u = W.HW.purchaseHistory({ identity_id: 9 });
  assert.ok(Array.isArray(h.skus) && h.skus.length, 'history must carry skus');
  assert.deepEqual(n.skus, [], 'no_purchases: the source ran and found nothing');
  assert.equal(u.skus, null, 'unknown: the source could not tell us — NOT an empty list');
  assert.notEqual(JSON.stringify(n.skus), JSON.stringify(u.skus),
    'bought-nothing and we-do-not-know collapsed inside the field the chip reads');
});

test('only resolved skus are offered, and the shortfall is counted', async () => {
  const withUnresolved = { ...HISTORY, items: [
    { key: 'sku:A', sku: 'A', name: 'A', orders: 3, units: 3, resolved: true },
    { key: 'ext:zzz', sku: null, name: 'mystery', orders: 1, units: 1,
      resolved: false, unresolved_reason: 'not ours' }] };
  const { W } = bootSeam((p) => p.includes('identity_id=0')
    ? { status: 409, body: { code: 'identity_not_found' } }
    : { status: 200, body: JSON.parse(JSON.stringify(withUnresolved)) });
  await W.HW_HISTORY.fetch({ identity_id: 7 });
  const h = W.HW.purchaseHistory({ identity_id: 7 });
  assert.deepEqual(h.skus, ['A'], 'an unresolved line has no sku and must not be ranked');
  assert.equal(h.skus_unresolved, 1, 'the dropped product was not counted');
  assert.ok(/never resolved to a catalogue sku/.test(h.skus_note || ''),
    'the list shrank silently');
});

test('a mock member row is NOT treated as an identity key', async () => {
  // pos/data.jsx MEMBERS are five invented people. Accepting `customer.id` as
  // an identity_id would rank a register ticket on a real stranger's purchases.
  const { W, calls } = bootSeam(router);
  const r = W.HW.purchaseHistory({ id: 'm1', name: 'Girish Sharma', visits: 4 });
  assert.equal(r.state, 'no_key');
  assert.ok(!Array.isArray(r.skus), 'a mock member must not yield a sku list');
  await new Promise((res) => setTimeout(res, 10));
  assert.ok(!calls.some((u) => /identity_id=m1|=m1/.test(u)),
    'the seam fetched a history for an invented member id: ' + calls.join(' '));
});
