/* ── The states the Category map must never let collapse ────────────────────
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * pos/screen-category-map.jsx renders our nine top-level categories against
 * Weedmaps' node tree, and the owner makes a PUBLISH DECISION off it. Three of
 * its four states produce the same visible thing — no product count worth
 * looking at, or no node ids — so left alone they come out as one grey nothing:
 *
 *   RESOLVES      matched a real WM node; publishing works.
 *   NO WM NODE    Weedmaps HAS NO SUCH NODE. `Deals` is the live one. NO ALIAS
 *                 CAN EVER FIX IT, because an alias re-spells OUR side and the
 *                 missing node is on THEIRS. Rendered as "not yet mapped" it
 *                 becomes work somebody could do, and they cannot.
 *   UNUSED        resolves fine, no product carries it. Benign.
 *   UNKNOWN USE   the catalog could not be read, so the count is null. NOT
 *                 ZERO — a zero here turns every working category into UNUSED
 *                 ("nothing publishes through this") off a failed import.
 *
 * The pair that collapses most easily is NO WM NODE and UNUSED: both show zero
 * or near-zero products and neither is an error, and only one of them is a
 * decision the owner has to make. So the tone each one is rendered in, and the
 * words each one uses, are what is asserted — not merely that a row appeared.
 *
 * FIXTURES ARE THE REAL PAYLOAD. Every shape below was captured from
 * GET /api/taxonomy/categories on a scratch database (WM_DEMO_DB in /tmp, own
 * port 8972, a 168-product mirror), including the detail that `product_count`
 * is `null` rather than absent when the catalog cannot be read — which is what
 * makes `=== null` the correct test and a truthiness check the wrong one.
 *
 * HOW IT TESTS
 * ------------
 * jsdom + the real react-dom, so useEffect runs and the screen's own fetch path
 * is exercised. `fetch` is stubbed per scenario; nothing on disk and nothing on
 * any port is touched. Atoms are stubbed as plain elements that keep their text
 * and expose their tone in a data attribute, because what is asserted is WHAT
 * THE ROW SAYS and WHAT COLOUR IT SAYS IT IN.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import esbuild from 'esbuild';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCREEN = path.join(ROOT, 'pos', 'screen-category-map.jsx');
const ROUTE = '/api/taxonomy/categories';

// ---------------------------------------------------------------- fixtures
// Captured verbatim from GET /api/taxonomy/categories against a scratch DB.

function alias(name, over) {
  return Object.assign({
    alias: name, is_canonical: false, products: 0, spellings_in_use: [],
    resolves_on_its_own: false, own_ids: [], rescued_by_alias: false,
    diverges: false, in_use: false
  }, over || {});
}

function row(category, over) {
  return Object.assign({
    category, state: 'RESOLVES', wm_ids: [2],
    wm_nodes: [{ id: 2, name: 'Flower', parent_id: null, slug: 'flower',
      published: true, unknown: false }],
    wm_path: 'Flower [2]', product_count: 5,
    aliases: [alias(category, { is_canonical: true, products: 5, in_use: true,
      spellings_in_use: [category], resolves_on_its_own: true, own_ids: [2] })],
    alias_count: 0, other_spellings_in_use: [], policy: {}
  }, over || {});
}

/** `Deals` exactly as the route serves it: no node, and one product on it. */
const DEALS = row('Deals', {
  state: 'NO_WM_NODE', wm_ids: [], wm_nodes: [], wm_path: null,
  product_count: 1,
  aliases: [alias('Deals', { is_canonical: true, products: 1, in_use: true,
    spellings_in_use: ['Deals'] }), alias('deal')],
  alias_count: 1
});

/** Resolves to a real node and nothing carries it. Benign, and NOT Deals. */
const WELLNESS_UNUSED = row('Wellness', {
  state: 'UNUSED', wm_ids: [467],
  wm_nodes: [{ id: 467, name: 'Wellness', parent_id: null, slug: 'wellness',
    published: true, unknown: false }],
  wm_path: 'Wellness [467]', product_count: 0,
  aliases: [alias('Wellness', { is_canonical: true, in_use: false })],
  alias_count: 0
});

/** A two-level bind, which is what most WM leaves are. */
const ACCESSORIES = row('Accessories', {
  wm_ids: [234, 9],
  wm_nodes: [
    { id: 234, name: 'Gear', parent_id: null, slug: 'gear', published: true, unknown: false },
    { id: 9, name: 'Accessories', parent_id: 234, slug: 'accessories', published: true, unknown: false }],
  wm_path: 'Gear [234] > Accessories [9]', product_count: 1
});

function payload(rows, over) {
  const counts = {
    categories: rows.length,
    resolves: rows.filter((r) => r.state === 'RESOLVES').length,
    no_wm_node: rows.filter((r) => r.state === 'NO_WM_NODE').length,
    unused: rows.filter((r) => r.state === 'UNUSED').length,
    unknown_use: rows.filter((r) => r.state === 'UNKNOWN_USE').length,
    products: rows.reduce((a, r) => a + (r.product_count || 0), 0),
    products_uncategorised: 0, products_rescued_by_alias: 0,
    spellings_unfoldable: 0
  };
  return Object.assign({
    rows, counts, unfoldable: [], uncategorised_skus: [], rescued_by_alias: [],
    wm_tree: { path: '/repo/cats.json', nodes: 94, names: 93, collisions: [], error: null },
    wm_node_table: { available: true, nodes: 94, retired: 0 },
    catalog: { error: null, spellings: rows.length },
    algorithm: 'engine.resolve_categories()'
  }, over || {});
}

// ------------------------------------------------------------- the sandbox

const compiled = esbuild.transformSync(fs.readFileSync(SCREEN, 'utf8'), {
  loader: 'jsx', jsx: 'transform', target: 'es2020'
}).code;

/** A palette whose every member is a string, so a typo'd token is visible. */
function palette() {
  return new Proxy({}, {
    get(_t, k) {
      if (k === 'type') { return new Proxy({}, { get: (_a, kk) => 'sz-' + String(kk) }); }
      return 'tok-' + String(k);
    }
  });
}

function installAtoms(win) {
  const h = React.createElement;
  const passthrough = (tag, extra) => function Stub(props) {
    return h(tag, { 'data-stub': extra || tag }, props.children);
  };
  win.React = React;
  win.useP = () => palette();
  win.Icon = ({ name }) => h('i', { 'data-icon': name });
  win.Card = function Card(props) { return h('div', { 'data-stub': 'card' }, props.children); };
  win.Eyebrow = passthrough('div', 'eyebrow');
  win.Pill = function Pill(props) {
    return h('span', { 'data-stub': 'pill', 'data-tone': props.kind }, props.children);
  };
  win.PBtn = function PBtn(props) {
    return h('button', { 'data-stub': 'pbtn', onClick: props.onClick }, props.children);
  };
  win.Field = () => h('input', { 'data-stub': 'field', readOnly: true });
  win.KPI = function KPI(props) {
    return h('div', { 'data-stub': 'kpi', 'data-kpi': String(props.label) },
      String(props.label) + ' | ' + String(props.value) + ' | ' + String(props.sublabel));
  };
  win.SkeletonRows = () => h('div', { 'data-stub': 'skeleton' });
  win.EmptyState = function E(props) {
    return h('div', { 'data-stub': 'empty' }, String(props.title) + ' ' + String(props.body));
  };
  win.ErrorState = function E(props) {
    return h('div', { 'data-stub': 'error' }, String(props.title) + ' ' + String(props.body));
  };
  win.SectionHead = function S(props) {
    return h('div', { 'data-stub': 'sectionhead' },
      String(props.title) + ' ' + String(props.subtitle || ''));
  };
  // Rows are rendered through the screen's own column render functions, so
  // what is asserted below is this screen's markup and not DataTable's.
  win.DataTable = function DataTable(props) {
    return h('div', { 'data-stub': 'table' }, (props.rows || []).map((r, i) =>
      h('div', { key: props.rowKey ? props.rowKey(r) : i, 'data-stub': 'row' },
        (props.columns || []).map((c, j) =>
          h('div', { key: j, 'data-stub': 'cell', 'data-col': String(c.label) },
            c.render ? c.render(r) : null)))));
  };
  // The DevNote atoms, exactly as pos/dev-note.jsx exports them. The screen
  // reaches them as window.DevNote — never a per-screen Mono, which threw
  // "Mono is not defined" and blanked a screen.
  win.DevNote = function D(props) {
    return h('div', { 'data-stub': 'devnote', 'data-tone': props.tone }, props.children);
  };
  win.DevNoteP = passthrough('p', 'devnotep');
  win.DevNoteMono = passthrough('code', 'devnotemono');
}

async function mount(route, opts = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="r"></div></body></html>',
    { url: 'http://127.0.0.1:8972/' });
  const win = dom.window;

  global.window = win;
  global.document = win.document;
  Object.defineProperty(global, 'navigator',
    { value: win.navigator, configurable: true, writable: true });
  global.HTMLElement = win.HTMLElement;
  global.Element = win.Element;
  global.Node = win.Node;
  global.IS_REACT_ACT_ENVIRONMENT = true;

  installAtoms(win);
  const seen = [];
  win.fetch = (url) => {
    const p = String(url).replace('http://127.0.0.1:8972', '');
    seen.push([p, arguments && null]);
    const r = route(p);
    if (r === 'network') { return Promise.reject(new Error('ECONNREFUSED')); }
    const [code, body, asText] = r;
    return Promise.resolve({
      ok: code >= 200 && code < 300, status: code,
      text: () => Promise.resolve(asText != null ? asText : JSON.stringify(body))
    });
  };
  // No write path on purpose: this screen sends none, and a screen that can
  // write is a screen that could be asked to.
  win.HW_LIVE = undefined;

  let src = compiled;
  if (opts.patch) {
    const next = opts.patch(src);
    assert.notEqual(next, src, 'patch() did not change the compiled screen');
    src = next;
  }
  // jsdom's window is NOT the global object a `new win.Function` body sees, so
  // the atoms the screen references bare are handed in as named parameters —
  // exactly as a browser <script> would resolve them off window.
  const NAMES = ['window', 'React', 'useP', 'Icon', 'Card', 'Eyebrow', 'Pill', 'PBtn',
    'Field', 'KPI', 'SkeletonRows', 'EmptyState', 'ErrorState', 'SectionHead',
    'DataTable', 'DevNote', 'DevNoteP', 'DevNoteMono', 'fetch'];
  // eslint-disable-next-line no-new-func
  new win.Function(NAMES.join(','), src)
    .apply(null, NAMES.map((n) => (n === 'window' ? win : win[n])));
  assert.equal(typeof win.CategoryMapScreen, 'function',
    'the screen file must export window.CategoryMapScreen');

  const host = win.document.getElementById('r');
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(win.CategoryMapScreen)); });
  for (let i = 0; i < 6; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
  return { doc: win.document, win, seen, host, text: () => host.textContent };
}

/** Serve one payload on the category-map route and nothing else. */
const serve = (code, body, asText) => (p) =>
  p.startsWith(ROUTE) ? [code, body, asText] : [404, { error: 'not found' }];

function catCell(doc, category) {
  const el = doc.querySelector('[data-hw-cat="' + category + '"]');
  assert.ok(el, 'no row rendered for ' + category);
  return el;
}
const catState = (doc, c) => catCell(doc, c).getAttribute('data-hw-cat-state');
const tones = (el) => [...el.querySelectorAll('[data-stub="pill"]')]
  .map((p) => p.getAttribute('data-tone'));
/** The whole rendered row (every cell), located via its category cell. */
function rowOf(doc, category) {
  const el = catCell(doc, category).closest('[data-stub="row"]');
  assert.ok(el, 'category cell for ' + category + ' is not inside a row');
  return el;
}
/** One named CELL of a row. Assertions about a product count must not be able
 *  to trip over the words "0 aliases" in the neighbouring column. */
function cellOf(doc, category, colLabel) {
  const el = rowOf(doc, category).querySelector('[data-col="' + colLabel + '"]');
  assert.ok(el, 'no "' + colLabel + '" cell in the ' + category + ' row');
  return el;
}
const kpi = (doc, label) => {
  const el = doc.querySelector('[data-kpi="' + label + '"]');
  assert.ok(el, 'no KPI labelled ' + label);
  return el.textContent;
};

// ══════════════════════════════════ 1. NO WM NODE is not "not yet mapped"

test('a category Weedmaps has no node for does not render like an unused one', async () => {
  const { doc } = await mount(serve(200, payload([DEALS, WELLNESS_UNUSED])));

  assert.equal(catState(doc, 'Deals'), 'NO_WM_NODE');
  assert.equal(catState(doc, 'Wellness'), 'UNUSED');

  // TONE UPDATED 2026-08-27, ON THE OWNER'S RULING, AND THE OLD ASSERTION IS
  // KEPT AS ITS INVERSE RATHER THAN DELETED.
  //
  // This used to demand `bad` — a red row on Deals, forever. The owner then
  // ruled: "if we decide NOT to map deals, then that shouldnt be a problem and
  // the system should allow it." A permanent red row on a settled decision is
  // exactly the problem he said it should not be, and a permanent alarm is one
  // nobody reads. So NO WM NODE is now `info`.
  //
  // WHAT THIS TEST STILL GUARDS, AND IT IS THE WHOLE POINT: quieting the colour
  // must not collapse the STATE. The two must still differ in tone AND in
  // words, and NO WM NODE must still not wear the alarm tone that belongs to a
  // thing somebody has to fix.
  const dealsTone = tones(catCell(doc, 'Deals'));
  const wellTone = tones(catCell(doc, 'Wellness'));
  assert.ok(!dealsTone.includes('bad'),
    'an ALLOWED resting state must not be rendered as an error, got ' + JSON.stringify(dealsTone));
  assert.ok(dealsTone.includes('info'),
    'NO WM NODE must carry its own informational tone, got ' + JSON.stringify(dealsTone));
  assert.ok(!wellTone.includes('bad') && !wellTone.includes('info'),
    'an UNUSED category must not borrow NO WM NODE\'s tone, got ' + JSON.stringify(wellTone));
  assert.notDeepEqual(dealsTone, wellTone,
    'NO WM NODE and UNUSED rendered the same tone — that is the collapse');

  // And the words differ, not only the colour. A colour-blind reader, a
  // screenshot in a report and a copy-paste into an email all lose the tone.
  const dealsText = rowOf(doc, 'Deals').textContent;
  const wellText = rowOf(doc, 'Wellness').textContent;
  assert.match(dealsText, /NO WEEDMAPS NODE/,
    'the unfixable state must say so in words: ' + dealsText.slice(0, 200));
  assert.doesNotMatch(wellText, /NO WEEDMAPS NODE/);
  assert.match(wellText, /unused/i);
});

test('the unfixable row says it cannot be fixed here, and the benign one does not', async () => {
  const { doc, text } = await mount(serve(200, payload([DEALS, WELLNESS_UNUSED])));
  // The explainer states it once for the reader who has never seen the screen.
  // WORDING UPDATED with the tone: it must still say no alias can reach it, and
  // it must now ALSO say that leaving it alone is allowed — because the screen
  // grew a node picker, and a picker makes "point it at something" look like
  // the obvious next move on a row where there is nothing correct to point at.
  assert.match(text(), /NOT FIXABLE, AND NOT A FAULT/,
    'the screen must say somewhere that NO WM NODE is not work anyone can do');
  assert.match(text(), /allowed resting state/i,
    'the screen must say that leaving it unbound is allowed, not merely impossible to fix');
  assert.doesNotMatch(text(), /needs a decision/i,
    'nothing is pending on an unbound category — the owner ruled it is not a problem');
  // And the row itself must not offer a node that does not exist.
  const dealsRow = rowOf(doc, 'Deals').textContent;
  assert.match(dealsRow, /no node exists/i);
  assert.doesNotMatch(dealsRow, /category_ids \[/,
    'a category with no node must not print a category_ids binding');
});

// ══════════════════════════════════════════ 2. the ids are shown, with names

test('a resolving category prints the Weedmaps node ids it will publish with', async () => {
  const { doc } = await mount(serve(200, payload([ACCESSORIES])));
  const t = rowOf(doc, 'Accessories').textContent;
  // Both levels, both ids — picking the wrong root is the bug already live on
  // this instance, so the parent must be visible, not just the leaf.
  assert.match(t, /Gear/);
  assert.match(t, /\[234\]/);
  assert.match(t, /Accessories/);
  assert.match(t, /\[9\]/);
  assert.match(t, /category_ids \[234, 9\]/,
    'the exact list that goes on the menu item must be printed: ' + t.slice(0, 240));
});

// ══════════════════════════════════════════ 3. absent is never rendered as 0

test('an unreadable catalog renders "unknown", never zero products', async () => {
  const blind = row('Flower', { state: 'UNKNOWN_USE', product_count: null });
  const body = payload([blind], {
    catalog: { error: 'catalog unavailable: no such table', spellings: null }
  });
  body.counts.products = null;
  const { doc, text } = await mount(serve(200, body));

  assert.equal(catState(doc, 'Flower'), 'UNKNOWN_USE');
  // Scoped to the product-count CELL. The row also says "0 aliases", and an
  // assertion that reads the whole row would pass or fail on that instead --
  // which is how a test ends up guarding a sentence nobody cares about.
  const t = cellOf(doc, 'Flower', 'Our products').textContent;
  assert.match(t, /unknown/i,
    'a null product count must say unknown: ' + t.slice(0, 200));
  assert.doesNotMatch(t, /\b0\b/,
    'a null product count must never render as 0: ' + t.slice(0, 200));
  // And the banner must name the failure rather than let the screen look calm.
  assert.match(text(), /catalog could not be read/i);
});

test('a genuine zero and an unknown do not render the same', async () => {
  const { doc } = await mount(serve(200, payload([
    WELLNESS_UNUSED,
    row('Flower', { state: 'UNKNOWN_USE', product_count: null })
  ])));
  const unusedText = cellOf(doc, 'Wellness', 'Our products').textContent;
  const unknownText = cellOf(doc, 'Flower', 'Our products').textContent;
  // The cell text runs together ("0resolves, no products carry it"), so there
  // is no word boundary after the digit -- \b0\b does not match it. Anchor on
  // the start of the cell, which is where the number is rendered.
  assert.match(unusedText, /^0\D/, 'a real zero should print the digit 0: ' + unusedText);
  assert.match(unknownText, /^unknown/i, 'an unknown must say so: ' + unknownText);
  assert.doesNotMatch(unknownText, /0/, 'an unknown must not print a 0 anywhere in the cell');
  assert.notEqual(unusedText, unknownText);
});

// ══════════════════════════════════════════ 4. a missing route is not "fine"

test('a 404 on the route never renders as "every category is fine"', async () => {
  const { doc, text } = await mount(() => [404, { error: 'not found' }]);
  const err = doc.querySelector('[data-stub="error"]');
  assert.ok(err, 'a failed route must render an ErrorState');
  assert.match(err.textContent, /404/);
  assert.match(err.textContent, /nothing looked/i,
    'the error must say nothing looked, not that nothing is wrong');
  assert.equal(doc.querySelector('[data-stub="table"]'), null,
    'no table may render off a failed route');
  // NOT a check that the word "resolves" is absent from the page: the explainer
  // defines all three states and must keep doing so on a failed route, because
  // that is when a reader most needs to know what the states mean. What must be
  // absent is a CLAIM about a category -- i.e. any rendered row at all.
  assert.equal(doc.querySelector('[data-hw-cat]'), null,
    'no category row may render off a failed route');
  assert.equal(doc.querySelector('[data-stub="kpi"]'), null,
    'no KPI may render off a failed route -- a "0 uncategorised" tile is a claim');
});

test('a network failure is reported as a failure, not as an empty estate', async () => {
  const { doc } = await mount(() => 'network');
  const err = doc.querySelector('[data-stub="error"]');
  assert.ok(err, 'a rejected fetch must render an ErrorState');
  assert.equal(doc.querySelector('[data-stub="empty"]'), null,
    'a network failure must not render the empty state — that is a claim');
});

// ══════════════════════════════════════════ 5. the defect is not softened

test('SKUs publishing with no category are named, counted, and called unfixable', async () => {
  const body = payload([DEALS], {
    uncategorised_skus: [{ sku: 'DD-DL-BUNDLE-1', spelling: 'Deals',
      canonical: 'Deals', why: "Weedmaps has no node named 'Deals'" }]
  });
  body.counts.products_uncategorised = 1;
  const { text } = await mount(serve(200, body));
  const t = text();
  assert.match(t, /DD-DL-BUNDLE-1/, 'the actual SKU must be on the screen');
  assert.match(t, /no category at all/i);
  assert.match(t, /No alias can fix this/i,
    'the screen must say an alias cannot fix a missing Weedmaps node');
});

test('the uncategorised KPI counts SKUs, and reads clean when there are none', async () => {
  const withNone = await mount(serve(200, payload([row('Flower')])));
  assert.match(kpi(withNone.doc, 'SKUs publishing uncategorised'),
    /\| 0 \| every spelling reaches a node/);

  const body = payload([DEALS], {
    uncategorised_skus: [{ sku: 'DD-DL-BUNDLE-1', spelling: 'Deals',
      canonical: 'Deals', why: "Weedmaps has no node named 'Deals'" }]
  });
  body.counts.products_uncategorised = 1;
  const withOne = await mount(serve(200, body));
  assert.match(kpi(withOne.doc, 'SKUs publishing uncategorised'),
    /\| 1 \| live on Weedmaps with no category/);
});

// ══════════════════════════════════════════ 6. the alias layer is not implied

test('a spelling that only resolves because of an alias says so', async () => {
  const vapes = row('Vape Pens', {
    wm_ids: [4],
    wm_nodes: [{ id: 4, name: 'Vape Pens', parent_id: null, slug: 'vape-pens',
      published: true, unknown: false }],
    wm_path: 'Vape Pens [4]', product_count: 22, alias_count: 5,
    aliases: [
      alias('Vape Pens', { is_canonical: true, products: 18, in_use: true,
        spellings_in_use: ['Vape Pens'], resolves_on_its_own: true, own_ids: [4] }),
      alias('vapes', { products: 4, in_use: true, spellings_in_use: ['Vapes'],
        rescued_by_alias: true })
    ]
  });
  const { doc } = await mount(serve(200, payload([vapes])));
  const t = rowOf(doc, 'Vape Pens').textContent;
  assert.match(t, /Vapes/, 'the raw spelling in use must be named');
  assert.match(t, /resolves only because of the alias/i,
    'a rescued spelling must say the alias is load-bearing: ' + t.slice(0, 300));
});

// ═══════════════════════════════ 7. MUTATION — prove the branch is the defence

test('MUTATION: collapsing NO_WM_NODE into UNUSED breaks these tests', async () => {
  // The whole defence is that `state` decides the tone and the words. Patch the
  // compiled screen so NO_WM_NODE resolves to the UNUSED entry, and the row for
  // Deals must stop being distinguishable — if it does not, the assertions
  // above are passing for some reason other than the branch they claim to test.
  const { doc } = await mount(serve(200, payload([DEALS, WELLNESS_UNUSED])), {
    // Patched against the COMPILED source, not the authored source: esbuild
    // reflows `function st(row) { ... }` onto three lines, so a patch written
    // against the .jsx text silently matches nothing. mount() asserts the patch
    // actually changed something, which is what caught that.
    patch: (src) => src.replace(
      'STATES[row && row.state]',
      'STATES[(row && row.state) === "NO_WM_NODE" ? "UNUSED" : (row && row.state)]')
  });
  const dealsTone = tones(catCell(doc, 'Deals'));
  const wellTone = tones(catCell(doc, 'Wellness'));
  assert.deepEqual(dealsTone, wellTone,
    'the mutation should have made the two states identical; it did not, so the ' +
    'tone is coming from somewhere other than STATES — find out where');
  assert.doesNotMatch(catCell(doc, 'Deals').textContent, /NO WEEDMAPS NODE/,
    'the mutation should have removed the distinguishing words');
});
