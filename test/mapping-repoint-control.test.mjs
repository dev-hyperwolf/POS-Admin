/* ── MAPPED TO A PRODUCT WE HAVE NEVER PULLED IS ITS OWN STATE ──────────────
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * 2026-08-27. SLUG-BB-629491 ("Sluggers - Jarred Flower - 5g - NYC Diesel")
 * carries an ACTIVE tier-1 mapping onto Weedmaps product 634042 at score 1.0.
 * The Sluggers Hit brand feed (28588) has never been pulled — GET
 * /api/mapping/unlooked on the live instance lists that SKU with feed status
 * "never" and 0 products cached — so 634042 has no row in our mirror and
 * neither does 629491. We are published against a product we cannot see.
 *
 * The board drew it GREEN. rows() tested `linked` first:
 *
 *     if (linked) { st = 'linked'; }        // before
 *
 * and a mapping row exists, so it stopped there. "The mirror holds this
 * product" and "the mirror has never heard of it" produced the same pixel.
 * That is the estate's recurring defect — an ABSENCE and an UNKNOWN rendering
 * identically, with the default being the one that looks like an answer —
 * committed on the one state that means something is ALREADY WRONG in public.
 *
 * WHAT IS ASSERTED
 * ----------------
 *   1. the derived STATE, off the live HW_MAPPING.rows getter;
 *   2. the RENDERED DRAWER, because a state that is right and a screen that
 *      still shows two identical-looking columns is the same bug wearing a
 *      passing test;
 *   3. that nothing is applied from the SKU string, and that no write leaves
 *      this file without a human.
 * Nothing on disk and nothing on any port is touched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const SRC = readFileSync(new URL('../shared/hw-live-mapping.js', import.meta.url), 'utf8');

/* A stand-in for pos/tokens.jsx's THEMES. Every lookup answers with a string so
 * the panel renders; NOTHING in this file asserts a colour off it — the tone
 * assertions read the source, exactly as the sibling suggestion-honesty test
 * does, because a colour is part of the claim and a stub palette cannot check
 * one. */
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

/** Boot the seam. `routes` maps a POST path to its response body. */
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

/* ── 1. the state ────────────────────────────────────────────────────────── */

test('a mapping onto a product NOT IN OUR MIRROR is its own state, not LINKED', async () => {
  const { M, dom } = await boot([
    mrow('SLUG-BB-629491', { mapping: LINK(634042), wm_mirror: 'unknown' }),
    mrow('OK-1', { mapping: LINK(700001), wm_mirror: 'present' })
  ]);
  const r = byS(M);
  assert.notEqual(r['SLUG-BB-629491'].state, 'linked',
    'THE BUG: a mapping onto a product we have never pulled drawn as a healthy link');
  assert.equal(r['SLUG-BB-629491'].state, 'unmirrored');
  assert.equal(r['OK-1'].state, 'linked');
  assert.equal(M.counts.unmirrored, 1);
  assert.equal(M.counts.linked, 1, 'the broken row must not also be counted as linked');
  dom.window.close();
});

test('DELISTED is not folded into either — we held it and Weedmaps dropped it', async () => {
  const { M, html, dom } = await boot([
    mrow('GONE', { mapping: LINK(700002), wm_mirror: 'delisted' })
  ]);
  assert.equal(byS(M).GONE.state, 'linked',
    'a delisted product is still one we can see; it is not the unmirrored state');
  assert.equal(M.counts.unmirrored, 0);
  M.open();
  assert.match(html(), /STOPPED returning it/,
    'a delisted mapping must say so on the row rather than pass as healthy');
  dom.window.close();
});

test('a FAILED mirror read is unknowable, never "not in our mirror"', async () => {
  const { M, html, dom } = await boot([
    mrow('A', { mapping: LINK(700001), wm_mirror: null, wm_mirror_known: false })
  ]);
  const r = byS(M).A;
  assert.equal(r.mirrorKnown, false);
  assert.equal(r.state, 'linked',
    'a read failure must not flip every linked row into the broken state');
  assert.equal(M.counts.unmirrored, 0,
    'counting an unchecked row as broken is the same defect in the other direction');
  assert.equal(M.counts.mirrorUnknowable, 1);
  M.open();
  assert.match(html(), /is UNKNOWN[\s\S]{0,120}could not read wm_products/,
    'the row must say it is unchecked rather than imply it is healthy');
  dom.window.close();
});

test('an older server that sends no wm_mirror at all behaves as it always did', async () => {
  // This file ships to a browser and its API is deployed separately. A row with
  // neither key must keep its old meaning, not silently become the new state.
  const legacy = { sku: 'A', name: 'A 5g', category: 'Flower',
                   weight: { value: 5, unit: 'g' }, wm_product_id: null,
                   mapping: LINK(700001), queued: false, queue_reason: null,
                   suggestion: null };
  const { M, dom } = await boot([legacy]);
  assert.equal(byS(M).A.state, 'linked');
  assert.equal(M.counts.unmirrored, 0);
  dom.window.close();
});

/* ── 2. the drawer ───────────────────────────────────────────────────────── */

const PREVIEW = {
  sku: 'SLUG-BB-629491',
  our: { name: 'Sluggers - Jarred Flower - 5g - NYC Diesel', category: 'Flower',
         weight: { value: '5.0', unit: 'g' }, strain: 'NYC Diesel',
         brand_name: 'Sluggers Hit', wm_brand_id: null, wm_product_id: 634042 },
  current_mapping: { wm_id: 634042, tier: 1, score: 1.0, status: 'active',
                     decided_by: 'engine', reviewed_by: null,
                     manual_override: 0, updated_at: '2026-08-20T00:00:00Z' },
  current: { wm_id: 634042, mirror: 'unknown', name: null, brand_id: null,
             brand_name: null, category: null, weight: null,
             items_per_pack: null, strain: null, first_seen: null,
             last_seen: null, missing_since: null,
             why: 'wm_products has no row for 634042. This product has never been pulled into our mirror, so we have never seen its name, brand, weight or category.' },
  proposed: { wm_id: 629491, mirror: 'present',
              name: 'Sluggers - Jarred Flower - 5g - NYC Diesel',
              brand_id: 28588, brand_name: 'Sluggers Hit', category: 'Flower',
              wm_category_raw: 'Flower', slugs: ['flower'],
              weight: { value: 5.0, unit: 'g' }, items_per_pack: null,
              strain: 'NYC Diesel', first_seen: '2026-08-01T00:00:00Z',
              last_seen: '2026-08-26T00:00:00Z', missing_since: null,
              why: "mirrored from Weedmaps' own brand feed" },
  proposed_id_from: 'sku_id_witness',
  sku_id_witness: { wm_id: 629491, all_matches: [629491],
                    source: 'digits parsed out of OUR OWN sku string',
                    authority: 'evidence, not proof — this is a string we wrote.' },
  agreement: null,
  agreement_note: 'NOT COMPARED. A field-by-field comparison needs both rows in our mirror; wm 634042 is not. An empty comparison is not agreement.',
  conflict_with: null, holder_tier: null, holder_status: null,
  holder_decided_by: null,
  decidable: true, blocked_by: null, next_action: null
};

async function opened(previewBody, extraRoutes = {}) {
  const b = await boot(
    [mrow('SLUG-BB-629491', { mapping: LINK(634042), wm_mirror: 'unknown' })],
    Object.assign({ '/api/mapping/repoint-preview':
                      { ok: true, code: 200, body: previewBody } }, extraRoutes));
  b.M.open();
  await b.M.previewRepoint('SLUG-BB-629491');
  return b;
}

test('the control shows BOTH sides, and the unmirrored side shows NO product fields', async () => {
  const { html, dom } = await opened(PREVIEW);
  const h = html();
  assert.match(h, /MAPPED NOW/);
  assert.match(h, /PROPOSED/);
  assert.match(h, /NOT IN OUR MIRROR/,
    'the side we cannot see must be labelled, not left blank');
  assert.match(h, /never been pulled into our mirror/,
    "the server's own reason must be printed, not paraphrased into a dash");
  // The PROPOSED side's real Weedmaps fields — name, brand, weight, category —
  // are the whole point of the control: a human chooses on evidence.
  assert.match(h, /Sluggers - Jarred Flower - 5g - NYC Diesel/);
  assert.match(h, /Sluggers Hit/);
  assert.match(h, /5g/);
  assert.match(h, /Flower/);
  assert.match(h, /#629491/);
  assert.match(h, /#634042/);
  dom.window.close();
});

test('an uncomparable pair is NOT COMPARED, never a silent "no differences"', async () => {
  const { html, dom } = await opened(PREVIEW);
  assert.match(html(), /NOT COMPARED/,
    'agreement:null must be spoken; an empty comparison reads as agreement');
  dom.window.close();
});

test('a comparable pair prints the field-by-field verdict, tri-state', async () => {
  const both = Object.assign({}, PREVIEW, {
    current: Object.assign({}, PREVIEW.proposed, { wm_id: 634042, name: 'Something else 1g',
                                                   weight: { value: 1, unit: 'g' } }),
    agreement: { name: false, brand_id: true, category: true, weight: false, strain: null },
    agreement_note: null
  });
  const { html, dom } = await opened(both);
  const h = html();
  assert.match(h, /name: DIFFERENT/);
  assert.match(h, /brand_id: same/);
  assert.match(h, /strain: not comparable/,
    'a null from weights_equal/strain must not print as "same" or as "DIFFERENT"');
  dom.window.close();
});

test('the SKU string is offered as a LABELLED witness and applies nothing', async () => {
  const { html, sent, dom } = await opened(PREVIEW);
  assert.match(html(), /evidence, not proof/,
    'the sku-derived id must carry its own authority statement');
  assert.equal(sent.filter(s => s.path === '/api/mapping/repoint').length, 0,
    'PREVIEWING MUST NOT WRITE. Auto-applying the sku string is the same class of '
    + 'error as the mapping being fixed, in the opposite direction');
  dom.window.close();
});

test('when neither side is readable the control says so and names the next action', async () => {
  const blocked = Object.assign({}, PREVIEW, {
    proposed: Object.assign({}, PREVIEW.current, { wm_id: 629491 }),
    decidable: false, blocked_by: 'proposed_not_in_mirror',
    next_action: { action: 'pull_brand_feed', brand_id: 28588,
                   brand_id_source: 'wm_brand_id', brand_name: 'Sluggers Hit',
                   route: 'POST /api/mapping/look-again', note: '' }
  });
  const { html, dom } = await opened(blocked);
  const h = html();
  assert.match(h, /Next action: pull the brand feed/);
  assert.match(h, /Sluggers Hit/);
  assert.match(h, /NOT decidable/,
    'a re-point with no evidence on either side must not look like a normal one');
  dom.window.close();
});

test('a preview that failed offers nothing to press', async () => {
  const b = await boot(
    [mrow('SLUG-BB-629491', { mapping: LINK(634042), wm_mirror: 'unknown' })],
    { '/api/mapping/repoint-preview': { ok: false, code: 500, body: null, error: 'boom' } });
  b.M.open();
  await b.M.previewRepoint('SLUG-BB-629491');
  const h = b.html();
  assert.match(h, /No preview: boom/);
  assert.ok(!/data-hwm="rp-apply"/.test(h),
    'an Apply button with no preview behind it is the blind approval this control removes');
  b.dom.window.close();
});

/* ── 3. the write ────────────────────────────────────────────────────────── */

test('applying sends ONE request to the ONE write route, with the previous id named back', async () => {
  const b = await opened(PREVIEW, {
    '/api/mapping/repoint': { ok: true, code: 200, body: {
      sku: 'SLUG-BB-629491', changed: true, prev_wm_id: 634042, wm_id: 629491 } }
  });
  const res = await b.M.repoint('SLUG-BB-629491', 629491);
  assert.equal(res.ok, true);
  const writes = b.sent.filter(s => s.path === '/api/mapping/repoint');
  assert.equal(writes.length, 1);
  // Field-by-field, not deepEqual: the body is built inside the jsdom realm and
  // its Object prototype is a different one, which deepStrictEqual rejects for
  // reasons that have nothing to do with what was sent.
  assert.equal(writes[0].body.sku, 'SLUG-BB-629491');
  assert.equal(writes[0].body.wm_id, 629491);
  assert.equal(writes[0].body.force, undefined,
    'force may never be sent on this file\'s own initiative');
  assert.equal(writes[0].body.confirm_unmirrored, undefined,
    'nor may the unmirrored confirmation');
  assert.match(b.html(), /WM #634042/,
    'the operator must be shown the id they moved AWAY from — that is the undo');
  b.dom.window.close();
});

test('a target we have never pulled is REFUSED, asked about, and only then confirmed', async () => {
  let calls = 0;
  const b = await opened(PREVIEW, {
    '/api/mapping/repoint': (body) => {
      calls++;
      if (!body.confirm_unmirrored) {
        return { ok: false, code: 409, error: 'not in our mirror',
                 body: { code: 'target_not_in_mirror', sku: body.sku,
                         wm_id: body.wm_id, prev_wm_id: 634042,
                         retry_with: { confirm_unmirrored: true } } };
      }
      return { ok: true, code: 200,
               body: { sku: body.sku, changed: true, prev_wm_id: 634042,
                       wm_id: body.wm_id } };
    }
  });
  let asked = null;
  b.W.confirm = (m) => { asked = m; return true; };
  const res = await b.M.repoint('SLUG-BB-629491', 999999);
  assert.equal(res.ok, true);
  assert.equal(calls, 2, 'it must try without the flag first');
  assert.match(asked, /NOT in our Weedmaps mirror/,
    'the operator has to be told what they are being asked to approve blind');
  b.dom.window.close();
});

test('a refusal the operator declines writes nothing', async () => {
  const b = await opened(PREVIEW, {
    '/api/mapping/repoint': (body) => body.confirm_unmirrored
      ? { ok: true, code: 200, body: { changed: true } }
      : { ok: false, code: 409, error: 'no',
          body: { code: 'target_not_in_mirror', wm_id: body.wm_id } }
  });
  b.W.confirm = () => false;
  const res = await b.M.repoint('SLUG-BB-629491', 999999);
  assert.equal(res.ok, false);
  assert.equal(b.sent.filter(s => s.path === '/api/mapping/repoint'
                                  && s.body.confirm_unmirrored).length, 0);
  b.dom.window.close();
});

test('a claim conflict names the incumbent and force is never sent unasked', async () => {
  const b = await opened(PREVIEW, {
    '/api/mapping/repoint': (body) => body.force
      ? { ok: true, code: 200, body: { changed: true, prev_wm_id: 634042 } }
      : { ok: false, code: 409, error: 'claimed',
          body: { code: 'claim_conflict', conflict_with: 'OTHER-SKU',
                  wm_id: body.wm_id, retry_with: { force: true } } }
  });
  let asked = null;
  b.W.confirm = (m) => { asked = m; return true; };
  await b.M.repoint('SLUG-BB-629491', 629491);
  assert.match(asked, /already claimed by OTHER-SKU/);
  const first = b.sent.filter(s => s.path === '/api/mapping/repoint')[0];
  assert.equal(first.body.force, undefined,
    'a many-to-one must never be created without the question being asked');
  b.dom.window.close();
});

/* ── 4. the claim is in the colour too ───────────────────────────────────── */

test('MAPPED TO A PRODUCT WE CANNOT SEE is not drawn as a healthy link', () => {
  const i = SRC.indexOf("if (st === 'unmirrored')");
  assert.ok(i > 0, 'the state has no badge of its own');
  const seg = SRC.slice(i, SRC.indexOf('\n', i));
  assert.ok(!/P\.good/.test(seg),
    'the green of LINKED asserts the mapping is sound — this state must never wear it');
  assert.ok(/P\.bad/.test(seg), 'a live mapping into the dark is a fault, and reads as one');
  assert.ok(!/'LINKED'/.test(seg));
});

test('it sorts above the one-click work, because it is already wrong in public', () => {
  const m = SRC.match(/var ORDER = \{([^}]*)\}/);
  assert.ok(m, 'no ORDER map');
  assert.match(m[1], /unmirrored:\s*-1/);
});

test('the re-point writes through the ONE route, and no new mapping route appears', () => {
  // Every path this file POSTs to, harvested from the source. A re-point must
  // travel down /api/mapping/repoint — which is itself a thin wrapper over the
  // server's existing approve() — and this file must not grow a second way to
  // move a mapping.
  // Both doors: post() for the reads, write() for the mutations — write() is
  // post() plus the refusal handling, so a path that appears in neither cannot
  // be reached from this panel at all.
  const posted = [...SRC.matchAll(/(?:post|write)\('(\/api\/[^']+)'/g)].map(m => m[1]);
  const KNOWN = ['/api/mapping/bulk', '/api/mapping/candidates',
                 '/api/mapping/rescore', '/api/mapping/absences',
                 '/api/mapping/approve', '/api/mapping/reject',
                 '/api/mapping/unmap', '/api/mapping/pull',
                 '/api/mapping/repoint', '/api/mapping/repoint-preview'];
  assert.ok(posted.includes('/api/mapping/repoint'),
    'the re-point route is not called at all');
  const strays = posted.filter(p => !KNOWN.includes(p));
  assert.deepEqual(strays, [],
    'a new mapping endpoint appeared in this panel: ' + strays.join(', '));
});
