/* ── WEEDMAPS CARRIES THE SAME PRODUCT TWICE, AND THE PANEL MUST SAY SO ─────
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The re-point control was built on a premise that turned out to be false.
 * SLUG-BB-629491 is mapped onto Weedmaps product 634042 while our own SKU
 * string names 629491, and every screen and every comment called that a
 * MISMAPPING to be corrected.
 *
 * Paging the whole Sluggers Hit feed (brand 28588) read-only on 2026-08-27
 * settled it: meta.total 236 over 12 pages, and BOTH ids are in it —
 *
 *   629491  "Sluggers - Jarred Flower - 5g - NYC Diesel"  published  msrp NULL
 *   634042  "Sluggers - Jarred Flower - 5g - NYC Diesel"  published  msrp 16.00
 *
 * — identical on name, categories and strain. There was never a mismapping.
 * 634042 only looked wrong because our mirror held page 1 of 12 and not the
 * page carrying it. That brand alone has EIGHT duplicate groups, one a triple
 * (629494 / 634043 / 860002).
 *
 * And they are NOT interchangeable: in both the pair and the triple, the id
 * our SKU names is the one WITHOUT a price. "Re-point to the id in the SKU"
 * would have moved a live listing from the priced row to the unpriced one.
 *
 * WHAT IS ASSERTED HERE
 * ---------------------
 *   1. THE ABSENT-KEY DEFECT. rows() read `r.wm_mirror_known !== false`, which
 *      is TRUE when the key is missing — so any server predating the field made
 *      this panel assert a mirror check it had never been told about. Absent is
 *      now its own state, and it says a different sentence from a read failure.
 *   2. THE DUPLICATE FRAMING renders as a CHOICE, never as a fault.
 *   3. THE PRICE SPLIT is drawn loudly, because it is the one thing on this
 *      screen that can quietly cost money.
 *   4. "MAPPED TO A PRODUCT NOT IN OUR MIRROR" is STILL its own visible state,
 *      and an unmirrored side renders "we never looked", never "no duplicates".
 *
 * Nothing on disk and nothing on any port is touched. NO RE-POINT IS APPLIED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const SRC = readFileSync(new URL('../shared/hw-live-mapping.js', import.meta.url), 'utf8');

function palette() {
  const nested = new Proxy({}, { get: () => 12 });
  return new Proxy({}, {
    get: (_, k) => (k === 'type' || k === 'ctrlH' ? nested : 'X'),
    has: () => true
  });
}

function mrow(sku, over) {
  return Object.assign({
    sku, name: sku + ' 5g', category: 'Flower',
    weight: { value: 5.0, unit: 'g' },
    wm_product_id: null, mapping: null, queued: false, queue_reason: null,
    suggestion: null, suggestion_status: 'scored',
    wm_mirror: null, wm_mirror_known: true
  }, over || {});
}

const LINK = (wm_id, over) => Object.assign({
  wm_id, tier: 1, score: 1.0, status: 'active', manual_override: 0,
  decided_by: 'engine', reviewed_by: null
}, over || {});

async function boot(rows, routes = {}) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://127.0.0.1:5173/', pretendToBeVisual: true,
    runScripts: 'outside-only'
  });
  const W = dom.window;
  const sent = [];
  W.THEMES = { light: palette(), dark: palette() };
  W.HW_LIVE = {
    post: (path, body) => {
      sent.push({ path, body });
      if (path === '/api/mapping/bulk') {
        return Promise.resolve({ ok: true, code: 200, body: {
          rows, wm_cached: 96,
          counters: { total: rows.length, mapped: 0, unmapped: 0, overrides: 0,
                      unmirrored: rows.filter(r => r.wm_mirror === 'unknown').length },
          suggestions: { mode: 'queue_only', rescored: false, complete: true,
                         scored: 0, requested: rows.length, cached: false,
                         stopped_reason: null }
        } });
      }
      if (Object.prototype.hasOwnProperty.call(routes, path)) {
        const r = routes[path];
        return Promise.resolve(typeof r === 'function' ? r(body) : r);
      }
      return Promise.resolve({ ok: false, code: 404, body: null, error: 'not stubbed' });
    }
  };
  W.fetch = () => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve({ absences: [], unlooked: [], brands: [],
                                  products: [], menu_state: [], events: [] })
  });
  W.confirm = () => true;
  W.eval(SRC);
  await W.HW_MAPPING.refresh();
  return { W, M: W.HW_MAPPING, sent, dom,
           html: () => W.document.body.innerHTML };
}

const byS = (M) => Object.fromEntries(M.rows.map(r => [r.sku, r]));

/* ── 1. THE ABSENT KEY IS ITS OWN STATE ──────────────────────────────────── */

test('a server that never sends wm_mirror_known does NOT get reported as checked', async () => {
  // THE DEFECT, EXACTLY. `r.wm_mirror_known !== false` is TRUE for undefined,
  // so this row used to arrive with mirrorKnown === true — the panel asserting
  // it had checked the mirror on the strength of a field nobody sent.
  const legacy = { sku: 'OLD', name: 'OLD 5g', category: 'Flower',
                   weight: { value: 5, unit: 'g' }, wm_product_id: null,
                   mapping: LINK(700001), queued: false, queue_reason: null,
                   suggestion: null, suggestion_status: 'scored' };
  const { M, dom } = await boot([legacy]);
  const r = byS(M).OLD;
  assert.notEqual(r.mirrorKnown, true,
    'THE BUG: an absent wm_mirror_known must never read as a completed check');
  assert.equal(r.mirrorKnown, null, 'absent is its own value, not true and not false');
  assert.equal(r.mirror, null);
  dom.window.close();
});

test('NOT REPORTED and READ FAILED are counted separately and worded differently', async () => {
  const { M, html, dom } = await boot([
    // absent key entirely
    { sku: 'OLD', name: 'OLD 5g', category: 'Flower',
      weight: { value: 5, unit: 'g' }, wm_product_id: null,
      mapping: LINK(700001), queued: false, queue_reason: null,
      suggestion: null, suggestion_status: 'scored' },
    // the server tried and failed
    mrow('FAILED', { mapping: LINK(700002), wm_mirror: null, wm_mirror_known: false })
  ]);
  assert.equal(M.counts.mirrorUnreported, 1, 'the silent server must be counted');
  assert.equal(M.counts.mirrorUnknowable, 1, 'the failed read must be counted separately');
  assert.equal(M.counts.unmirrored, 0,
    'neither kind of not-knowing may be reported as a broken mapping');

  M.open();
  const h = html();
  assert.match(h, /did not report a mirror state[\s\S]{0,160}ABSENT from its response/,
    'a server that said nothing must be described as having said nothing');
  assert.match(h, /could not read wm_products/,
    'a real read failure keeps its own, different sentence');
  // The two must not be described identically — that is the whole point.
  assert.doesNotMatch(
    h.slice(h.indexOf('did not report a mirror state')),
    /^[\s\S]{0,400}could not read wm_products/,
    'the NOT-REPORTED sentence must not claim the server tried and failed');
  dom.window.close();
});

test('the legend refuses to print a checked-looking 0 when nothing was checked', async () => {
  const { M, html, dom } = await boot([
    { sku: 'OLD', name: 'OLD 5g', category: 'Flower',
      weight: { value: 5, unit: 'g' }, wm_product_id: null,
      mapping: LINK(700001), queued: false, queue_reason: null,
      suggestion: null, suggestion_status: 'scored' }
  ]);
  M.open();
  assert.match(html(), /Not in our mirror \?/,
    'with no mirror state reported at all, the chip must read ? and never 0 — ' +
    'a 0 there is a claim that the check ran and found nothing');
  dom.window.close();
});

test('a server that DOES report keeps the old, precise behaviour', async () => {
  const { M, dom } = await boot([
    mrow('SEEN', { mapping: LINK(700001), wm_mirror: 'present' }),
    mrow('GHOST', { mapping: LINK(634042), wm_mirror: 'unknown' })
  ]);
  const r = byS(M);
  assert.equal(r.SEEN.mirrorKnown, true);
  assert.equal(r.SEEN.state, 'linked');
  assert.equal(r.GHOST.state, 'unmirrored',
    'MAPPED TO A PRODUCT NOT IN OUR MIRROR must remain its own visible state');
  assert.equal(M.counts.mirrorUnreported, 0);
  assert.equal(M.counts.unmirrored, 1);
  dom.window.close();
});

/* ── 2. THE DUPLICATE CHOICE ─────────────────────────────────────────────── */

/* Shaped exactly like wmdemo/mapping.repoint_preview()'s response, with the
 * REAL values read off the live Sluggers feed on 2026-08-27. */
const side = (wm_id, over) => Object.assign({
  wm_id, mirror: 'present',
  name: 'Sluggers - Jarred Flower - 5g - NYC Diesel',
  brand_id: 28588, brand_name: 'Sluggers Hit', category: 'Flower',
  weight: { value: 5.0, unit: 'g' }, strain: 'NYC Diesel',
  items_per_pack: null, first_seen: null, last_seen: null, missing_since: null,
  why: 'mirrored from Weedmaps’ own brand feed'
}, over || {});

const DUP_PREVIEW = {
  sku: 'SLUG-BB-629491',
  our: { name: 'Sluggers - Jarred Flower - 5g - NYC Diesel', category: 'Flower',
         weight: { value: '5.0', unit: 'g' }, strain: 'NYC Diesel',
         brand_name: 'Sluggers Hit', wm_brand_id: 28588, wm_product_id: null },
  current_mapping: { wm_id: 634042, tier: 1, score: 1.0, status: 'active',
                     decided_by: 'engine', reviewed_by: null,
                     manual_override: 0, updated_at: '2026-08-27T00:00:00Z' },
  current: side(634042),
  proposed: side(629491),
  proposed_id_from: 'sku_id_witness',
  sku_id_witness: { wm_id: 629491, all_matches: [629491],
                    source: 'digits parsed out of OUR OWN sku string',
                    authority: 'evidence, not proof — this is a string we wrote.' },
  agreement: { name: true, brand_id: true, category: true, weight: true, strain: true },
  agreement_note: null,
  conflict_with: null, holder_tier: null, holder_status: null,
  holder_decided_by: null,
  duplicates: {
    current: {
      wm_id: 634042,
      subject: { wm_id: 634042, published: true, msrp: '16.00 USD' },
      group: [{
        wm_id: 629491, relation: 'identical', differs: [],
        delisted: false, claimed_by: null, claimed_status: null,
        published: true, msrp: null, variants: 1,
        updated_at: '2026-03-31T23:38:30Z', raw_read: true,
        differs_beyond_identity: [
          { field: 'msrp', current: '16.00 USD', other: null, decides: true },
          { field: 'updated_at', current: '2026-03-30T23:56:49Z',
            other: '2026-03-31T23:38:30Z', decides: false }
        ]
      }],
      identical: 1, near: 0, interchangeable: false,
      interchangeable_note: 'These rows are the same product, and they are NOT the same listing.',
      compared_on: ['name', 'category', 'strain', 'weight'],
      not_compared: ['price', 'inventory', 'menu placement', 'per-listing overrides'],
      not_compared_note: "'identical' means identical on the columns our mirror holds.",
      scan: { brand_id: 28588, brand_name: 'Sluggers Hit',
              brand_rows_in_mirror: 236, brand_feed_total: 236,
              brand_feed_status: 'ok', complete: true,
              why: 'We hold 236 of the 236 products Weedmaps reports for Sluggers Hit.' }
    },
    proposed: null
  },
  same_product: true,
  framing: 'choice_between_duplicates',
  framing_note: 'Weedmaps lists this product more than once and BOTH rows are real. ' +
                'This is not a mismapping — it is a choice between duplicates, and ' +
                'you are currently on one of them.',
  decidable: true, blocked_by: null, next_action: null, mirror_states: {}
};

async function drawer(preview, rows) {
  const b = await boot(rows || [
    mrow('SLUG-BB-629491', { mapping: LINK(634042), wm_mirror: 'present' })
  ], { '/api/mapping/repoint-preview': { ok: true, code: 200, body: preview } });
  b.M.open();
  // Open the row's drawer, then the re-point control on it.
  const btn = [...b.W.document.querySelectorAll('[data-hwm]')]
    .find(e => e.getAttribute('data-hwm') === 'repoint');
  if (btn) { btn.click(); await new Promise(r => setTimeout(r, 0)); }
  return b;
}

test('THE FEATURE: two identical Weedmaps rows are framed as a CHOICE, not a fault', async () => {
  const { html, dom, sent } = await drawer(DUP_PREVIEW);
  const h = html();
  assert.match(h, /WEEDMAPS LISTS THIS PRODUCT MORE THAN ONCE/,
    'the duplicate framing must lead the control');
  assert.match(h, /not a mismapping/,
    'the operator must be told explicitly that nothing is broken here');
  assert.doesNotMatch(h, /THIS MAPPING IS WRONG/i,
    'the old accusation must be gone');
  assert.equal(sent.filter(s => s.path === '/api/mapping/repoint').length, 0,
    'NOTHING may be applied by rendering a preview');
  dom.window.close();
});

test('the duplicate group names both ids and calls them identical', async () => {
  const { html, dom } = await drawer(DUP_PREVIEW);
  const h = html();
  assert.match(h, /#629491/, 'the other row must be named by id');
  assert.match(h, /IDENTICAL on name, category, strain, weight/,
    'what "identical" was judged on must be stated, not implied');
  dom.window.close();
});

test('THE PRICE SPLIT is drawn: same product, NOT the same listing', async () => {
  // The one that can cost money. 634042 carries msrp 16.00; 629491 — the id our
  // own SKU names — carries none.
  const { html, dom } = await drawer(DUP_PREVIEW);
  const h = html();
  assert.match(h, /NOT INTERCHANGEABLE/,
    'an identical pair that differs on price must NOT read as "pick either"');
  assert.match(h, /msrp: #634042 has 16\.00 USD, #629491 has none/,
    'both sides of the price must be shown, with the ids attached');
  dom.window.close();
});

test('a difference that changes nothing customers see is marked as context', async () => {
  const { html, dom } = await drawer(DUP_PREVIEW);
  assert.match(html(), /updated_at[\s\S]{0,120}context, not a difference in what customers see/,
    'timestamp drift must not be dressed up as a reason to act');
  dom.window.close();
});

test('an UNMIRRORED side renders "we never looked", never "no duplicates"', async () => {
  const pv = JSON.parse(JSON.stringify(DUP_PREVIEW));
  pv.current = side(634042, { mirror: 'unknown', name: null, brand_name: null,
                              category: null, weight: null, strain: null,
                              why: 'wm_products has no row for 634042. This product ' +
                                   'has never been pulled into our mirror.' });
  pv.duplicates.current = null;
  pv.duplicates.proposed = null;
  pv.same_product = null;
  pv.framing = 'cannot_tell';
  pv.framing_note = 'We cannot tell whether these are two rows for one product or ' +
    'two different products, because at least one of them is not in our mirror. ' +
    'That is not a "no" — it is a "we have not looked".';
  pv.agreement = null;
  pv.agreement_note = 'NOT COMPARED.';

  const { html, dom } = await drawer(pv);
  const h = html();
  assert.match(h, /WE CANNOT TELL YET/, 'the framing must admit it cannot answer');
  assert.match(h, /NOT CHECKED[\s\S]{0,200}not "no duplicates found"/,
    'THE RECURRING DEFECT: an absence and an unknown must not render alike');
  assert.doesNotMatch(h, /TWO DIFFERENT PRODUCTS/,
    'an unmirrored side must never be reported as a different product');
  dom.window.close();
});

test('a partial brand scan says so, because an empty group would mean nothing', async () => {
  const pv = JSON.parse(JSON.stringify(DUP_PREVIEW));
  pv.duplicates.current.group = [];
  pv.duplicates.current.identical = 0;
  pv.duplicates.current.interchangeable = null;
  pv.duplicates.current.scan = {
    brand_id: 28588, brand_name: 'Sluggers Hit', brand_rows_in_mirror: 20,
    brand_feed_total: 236, brand_feed_status: 'ok', complete: false,
    why: 'WE HOLD 20 OF 236 products Weedmaps reports for Sluggers Hit.'
  };
  const { html, dom } = await drawer(pv);
  const h = html();
  assert.match(h, /Scan coverage[\s\S]{0,200}20 OF 236/,
    'the shortfall must be on screen with its numbers');
  assert.match(h, /would not be listed above/,
    'an empty group over a partial mirror must be disclaimed, not presented');
  dom.window.close();
});

test('a duplicate already claimed by one of our SKUs is named', async () => {
  const pv = JSON.parse(JSON.stringify(DUP_PREVIEW));
  pv.duplicates.current.group[0].claimed_by = 'SLUG-BB-OTHER';
  const { html, dom } = await drawer(pv);
  assert.match(html(), /already claimed by SLUG-BB-OTHER/,
    'moving onto a row another SKU holds is a collision the operator can see coming');
  dom.window.close();
});

test('rendering a preview NEVER writes, whatever the framing says', async () => {
  for (const f of ['choice_between_duplicates', 'different_products', 'cannot_tell']) {
    const pv = JSON.parse(JSON.stringify(DUP_PREVIEW));
    pv.framing = f;
    pv.framing_note = 'x';
    const { sent, dom } = await drawer(pv);
    assert.equal(sent.filter(s => s.path === '/api/mapping/repoint').length, 0,
      `framing ${f} must not trigger a write`);
    dom.window.close();
  }
});
