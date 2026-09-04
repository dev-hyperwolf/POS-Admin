/* ── Bulk bind, and the right panel's own scroll region ──────────────────────
 *
 * WHAT THIS FILE GUARDS
 * ----------------------
 * Two owner-reported problems on pos/screen-category-map.jsx, on top of the
 * split-view layout test/category-map-queue-and-reassign.test.mjs already
 * covers:
 *
 *   1. THE RIGHT PANEL ("Weedmaps bindings") AND THE LEFT TABLE SHARED ONE
 *      SCROLL CONTAINER. The panel is `position:'sticky'` against <main>'s own
 *      scroll (pos/app.jsx) but had no height limit of its own, so once its
 *      content grew taller than the viewport, reaching the rest of it meant
 *      scrolling <main> -- which dragged the table's scroll position along
 *      with it. The fix bounds the panel to the room actually left in the
 *      viewport (`useStickyPanelMaxHeight`, screen-category-map.jsx) and gives
 *      it `overflowY:'auto'` so it scrolls independently. jsdom does no real
 *      layout, so `getBoundingClientRect()` always reports `top: 0` here --
 *      what is asserted is that the panel node carries the right INLINE
 *      STYLE (a real max-height driven by `window.innerHeight`, its own
 *      overflow, and overscroll containment), not a pixel-perfect layout a
 *      unit test cannot see anyway.
 *
 *   2. ONE BIND AT A TIME WAS TOO SLOW FOR N CATEGORIES. Checkboxes on the
 *      left table (native <input type="checkbox">, matching this screen's own
 *      existing checkbox pattern in PreviewPanel/AliasEditor rather than
 *      pulling in pos/atoms.jsx's `Check` atom -- see the commit message for
 *      why) feed a bulk bar, which opens BulkBindEditor: ONE Weedmaps category
 *      type picked once, applied to every selected category via the SAME
 *      `POST /bind` route BindingEditor's own single-category flow calls,
 *      once per category. The single-category "Bindings (N)" flow
 *      (test/category-map-queue-and-reassign.test.mjs) is untouched by any of
 *      this -- these tests only add coverage for the new path.
 *
 * HOW IT TESTS
 * ------------
 * Identical jsdom + real react-dom harness as the other category-map test
 * files (see test/category-editor.test.mjs for why each piece is shaped this
 * way): real fetch/useEffect wiring, every route stubbed per scenario,
 * nothing on disk or any port touched.
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

const TREE = [
  { id: 2, name: 'Flower', parent_id: null, slug: 'flower', published: true },
  { id: 7, name: 'Pre-Rolls', parent_id: null, slug: 'pre-rolls', published: true },
  { id: 9, name: 'Vaporizers', parent_id: null, slug: 'vaporizers', published: true }
];

function alias(name, over) {
  return Object.assign({
    alias: name, is_canonical: false, products: 0, spellings_in_use: [],
    resolves_on_its_own: false, own_ids: [], rescued_by_alias: false,
    diverges: false, in_use: false, source: 'code', editable: false,
    added_by: null, added_at: null
  }, over || {});
}

function row(category, over) {
  const merged = Object.assign({
    category, state: 'RESOLVES', wm_ids: [2],
    wm_nodes: [{ id: 2, name: 'Flower', parent_id: null, slug: 'flower', published: true, unknown: false }],
    wm_path: 'Flower [2]', product_count: 5,
    binding_source: 'name_match', binding: null, name_match_ids: [2],
    name_match_path: 'Flower [2]', overrides_name_match: false,
    aliases: [alias(category, { is_canonical: true, products: 5, in_use: true,
      spellings_in_use: [category], resolves_on_its_own: true, own_ids: [2] })],
    alias_count: 0, other_spellings_in_use: [], policy: {}
  }, over || {});
  if (!('bindings' in (over || {}))) {
    merged.bindings = merged.binding
      ? [Object.assign({ note: null, broken: merged.binding_source === 'explicit_missing_node',
          path: (merged.wm_nodes && merged.wm_nodes.length) ? merged.wm_nodes : [] },
          merged.binding)]
      : [];
  }
  return merged;
}

const FLOWER = row('Flower', { product_count: 12 });
const PREROLL = row('Pre Roll', {
  wm_ids: [7], wm_path: 'Pre-Rolls [7]', product_count: 8,
  wm_nodes: [{ id: 7, name: 'Pre-Rolls', parent_id: null, slug: 'pre-rolls', published: true, unknown: false }],
  name_match_ids: [7], name_match_path: 'Pre-Rolls [7]'
});
const VAPES = row('Vape Pens', {
  wm_ids: [9], wm_path: 'Vaporizers [9]', product_count: 4,
  wm_nodes: [{ id: 9, name: 'Vaporizers', parent_id: null, slug: 'vaporizers', published: true, unknown: false }],
  name_match_ids: [9], name_match_path: 'Vaporizers [9]',
  // Already bound to the node the bulk tests below pick -- this row exists to
  // prove a category the preview refuses is excluded, not force-included.
  binding_source: 'explicit',
  binding: { node_id: 9, actor: 'ops@hyperwolf.com', at_iso: '2026-08-01T00:00:00Z' }
});

function payload(rows, over) {
  const counts = {
    categories: rows.length,
    resolves: rows.filter((r) => r.state === 'RESOLVES').length,
    no_wm_node: rows.filter((r) => r.state === 'NO_WM_NODE').length,
    unused: 0, unknown_use: 0, binding_broken: 0,
    explicit_bindings: rows.filter((r) => r.binding_source === 'explicit').length,
    products: rows.reduce((a, r) => a + (r.product_count || 0), 0),
    products_uncategorised: 0, products_rescued_by_alias: 0, spellings_unfoldable: 0
  };
  return Object.assign({
    rows, counts, unfoldable: [], uncategorised_skus: [], rescued_by_alias: [],
    wm_tree: { path: '/repo/cats.json', nodes: TREE.length, names: TREE.length, collisions: [],
      error: null, tree: TREE },
    wm_node_table: { available: true, nodes: TREE.length, retired: 0 },
    catalog: { error: null, spellings: rows.length },
    editor: { error: null, top_level: rows.map((r) => r.category), alias_overrides: [],
      bindings: {}, routes: {}, no_suppress_state: 'An unbound category is allowed.' },
    algorithm: 'engine.resolve_categories()'
  }, over || {});
}

function preview(over) {
  return Object.assign({
    op: 'bind', subject: 'Flower', products_affected: 3, products_known: true,
    from_ids: [], to_ids: [9], from_path: null, to_path: 'Vaporizers [9]',
    sentence: 'Binds 3 product rows under Flower to Vaporizers [9].',
    confirm_field: 'confirm_products', would_refuse: null, catalog_error: null
  }, over || {});
}

// ------------------------------------------------------------- the sandbox
// Identical harness to test/category-map-queue-and-reassign.test.mjs.

const compiled = esbuild.transformSync(fs.readFileSync(SCREEN, 'utf8'), {
  loader: 'jsx', jsx: 'transform', target: 'es2020'
}).code;

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
  win.Card = function Card(props) {
    const { children, density, style, ...rest } = props;
    return h('div', Object.assign({ 'data-stub': 'card' }, rest), children);
  };
  win.Eyebrow = passthrough('div', 'eyebrow');
  win.Pill = function Pill(props) {
    return h('span', { 'data-stub': 'pill', 'data-tone': props.kind }, props.children);
  };
  win.PBtn = function PBtn(props) {
    const { children, icon, iconRight, variant, size, busy, active, full, style,
      onClick, disabled, ...rest } = props;
    return h('button', Object.assign({
      'data-stub': 'pbtn', onClick, disabled: !!disabled,
      'data-disabled': disabled ? '1' : '0'
    }, rest), children);
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
      String(props.title) + ' ' + String(props.subtitle || ''), props.action || null);
  };
  win.DataTable = function DataTable(props) {
    return h('div', { 'data-stub': 'table' }, (props.rows || []).map((r, i) =>
      h('div', { key: props.rowKey ? props.rowKey(r) : i, 'data-stub': 'row' },
        (props.columns || []).map((c, j) =>
          h('div', { key: j, 'data-stub': 'cell', 'data-col': String(c.label) },
            c.render ? c.render(r) : null)))));
  };
  win.DevNote = function D(props) {
    return h('div', { 'data-stub': 'devnote', 'data-tone': props.tone }, props.children);
  };
  win.DevNoteP = passthrough('p', 'devnotep');
  win.DevNoteMono = passthrough('code', 'devnotemono');
}

async function mount(route, opts = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="r"></div></body></html>',
    { url: 'http://127.0.0.1:8944/' });
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
  const sent = [];
  win.fetch = (url, init) => {
    const p = String(url).replace('http://127.0.0.1:8944', '');
    const method = (init && init.method) || 'GET';
    let body = null;
    try { body = init && init.body ? JSON.parse(init.body) : null; } catch (e) {}
    if (method === 'POST') { sent.push({ path: p, body }); }
    const r = route(p, method, body);
    if (r === 'network') { return Promise.reject(new Error('ECONNREFUSED')); }
    const [code, payloadBody] = r;
    return Promise.resolve({
      ok: code >= 200 && code < 300, status: code,
      text: () => Promise.resolve(JSON.stringify(payloadBody))
    });
  };
  win.HW_LIVE = undefined;

  const src = compiled;
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
  const settle = async () => {
    for (let i = 0; i < 8; i++) {
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    }
  };
  await settle();
  const click = async (el) => {
    assert.ok(el, 'click target does not exist');
    await act(async () => { el.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); });
    await settle();
  };
  // CHECKBOXES GO THROUGH THE HANDLER THE SCREEN ITSELF SUPPLIED, read off the
  // React fiber — same trick and same reason as test/category-editor.test.mjs:
  // React runs in Node's realm while the DOM lives in jsdom's, and a synthetic
  // 'click'/'change' event dispatched at a checkbox resolves to no event on
  // the far side of that boundary. Nothing throws; the checkbox just silently
  // never toggles, and a test asserting "still unchecked" would pass for
  // entirely the wrong reason.
  const reactProps = (el) => {
    const k = Object.keys(el).filter((x) => x.indexOf('__reactProps$') === 0)[0];
    assert.ok(k, 'that element is not a React-rendered node');
    return el[k];
  };
  const check = async (el) => {
    assert.ok(el, 'checkbox does not exist');
    const onChange = reactProps(el).onChange;
    assert.ok(onChange, 'that checkbox has no onChange');
    await act(async () => { onChange({ target: { checked: !el.checked } }); });
    await settle();
  };
  return { doc: win.document, win, host, sent, click, check, settle, text: () => host.textContent };
}

function router({ map, pv, save }) {
  return function (p, method, body) {
    if (method === 'POST') {
      return save ? save(p, body) : [200, { result: { ok: true }, map: map }];
    }
    if (p.startsWith(ROUTE + '/preview')) {
      return typeof pv === 'function' ? pv(p) : [200, pv || preview()];
    }
    if (p.startsWith(ROUTE)) { return [200, map]; }
    return [404, { error: 'not found' }];
  };
}

function qparam(p, name) {
  return new URL('http://x' + p).searchParams.get(name);
}

const q = (doc, sel) => doc.querySelector(sel);
const qa = (doc, sel) => [...doc.querySelectorAll(sel)];
const btnByText = (doc, re) => qa(doc, 'button')
  .filter((b) => re.test(b.textContent || ''))[0];

// ═══════════════════════════ 1. the panel's own scroll region (issue 1)

test('the binding panel carries its own bounded, independently-scrolling region, not the page scroll', async () => {
  const m = await mount(router({ map: payload([FLOWER, PREROLL]) }));
  const panel = q(m.doc, '[data-hw-binding-panel]');
  assert.ok(panel, 'the sticky panel must exist');
  assert.equal(panel.style.position, 'sticky', 'it must stay pinned, same as before this fix');
  assert.equal(panel.style.overflowY, 'auto',
    'the panel must scroll ITSELF once its content outgrows the viewport, never rely on <main>');
  assert.equal(panel.style.overscrollBehavior, 'contain',
    'without containment, scrolling this box to its end chains into <main> -- the same "screen ' +
    'jumped around" defect NodePicker already had to fix once');
  // jsdom does no real layout (getBoundingClientRect always reports 0), so the
  // exact number is a function of jsdom's fixed 768px default viewport height
  // minus the hook's own bottom gap -- what matters is that a REAL number
  // (not the whole page, not undefined) was computed from window.innerHeight.
  assert.equal(panel.style.maxHeight, '748px',
    'the height bound must be measured from the real viewport, not omitted or hardcoded to something ' +
    'that ignores it');
});

// ═══════════════════════════ 2. bulk selection surfaces a bulk bar

test('selecting categories surfaces a bulk bar, and Select-all/Clear both work', async () => {
  const m = await mount(router({ map: payload([FLOWER, PREROLL, VAPES]) }));
  assert.equal(q(m.doc, '[data-hw-bulk-bar]'), null, 'no bulk bar until something is selected');

  await m.check(q(m.doc, '[data-hw-select-row="Flower"]'));
  assert.ok(q(m.doc, '[data-hw-bulk-bar]'), 'selecting one row must surface the bulk bar');
  assert.match(q(m.doc, '[data-hw-bulk-bar]').textContent, /1 selected/);

  await m.check(q(m.doc, '[data-hw-select-row="Pre Roll"]'));
  assert.match(q(m.doc, '[data-hw-bulk-bar]').textContent, /2 selected/);

  await m.check(q(m.doc, '[data-hw-select-all]'));
  assert.match(q(m.doc, '[data-hw-bulk-bar]').textContent, /3 selected/,
    'select-all must pick up every row, including ones not individually clicked');

  await m.click(q(m.doc, '[data-hw-bulk-clear]'));
  assert.equal(q(m.doc, '[data-hw-bulk-bar]'), null, 'Clear must empty the selection entirely');
});

// ═══════════════════════════ 3. bulk bind: one pick, N real /bind calls

test('bulk bind fetches a live preview per category and posts one /bind per category with its OWN confirmed count', async () => {
  const counts = { Flower: 12, 'Pre Roll': 8 };
  const m = await mount(router({
    map: payload([FLOWER, PREROLL]),
    pv: (p) => {
      const cat = qparam(p, 'category');
      return [200, preview({ subject: cat, products_affected: counts[cat],
        sentence: 'Binds ' + counts[cat] + ' rows under ' + cat + ' to Vaporizers [9].' })];
    }
  }));

  await m.check(q(m.doc, '[data-hw-select-row="Flower"]'));
  await m.check(q(m.doc, '[data-hw-select-row="Pre Roll"]'));
  await m.click(q(m.doc, '[data-hw-bulk-bind]'));

  assert.ok(q(m.doc, '[data-hw-editor="bulk-bind"]'), 'the bulk editor must open in the right panel');
  // The single-row editor and the queue must both be gone while it is open.
  assert.equal(q(m.doc, '[data-hw-editor="binding"]'), null);

  await m.click(q(m.doc, '[data-hw-node="9"]'));
  assert.match(q(m.doc, '[data-hw-bulk-usable-count]').textContent, /2/);

  await m.click(q(m.doc, '[data-hw-bulk-review]'));
  const strip = q(m.doc, '[data-hw-bulk-review-strip]').textContent;
  assert.match(strip, /Flower/);
  assert.match(strip, /12 product rows/);
  assert.match(strip, /Pre Roll/);
  assert.match(strip, /8 product rows/);

  await m.click(q(m.doc, '[data-hw-bulk-confirm]'));

  assert.equal(m.sent.length, 2, 'bulk bind must call the real single-bind route once per category');
  const byCat = Object.fromEntries(m.sent.map((s) => [s.body.category, s.body]));
  assert.equal(m.sent[0].path, ROUTE + '/bind');
  assert.equal(m.sent[1].path, ROUTE + '/bind');
  assert.deepEqual(byCat.Flower, { category: 'Flower', node: 9, confirm_products: 12 });
  assert.deepEqual(byCat['Pre Roll'], { category: 'Pre Roll', node: 9, confirm_products: 8 });

  assert.ok(q(m.doc, '[data-hw-bulk-done]'), 'the batch must report a result per category');
  assert.match(q(m.doc, '[data-hw-bulk-result="Flower"]').textContent, /bound/);
  assert.match(q(m.doc, '[data-hw-bulk-result="Pre Roll"]').textContent, /bound/);
});

test('a category the preview refuses is excluded from the batch, shown with its reason, and never posted', async () => {
  const m = await mount(router({
    map: payload([FLOWER, VAPES]),
    pv: (p) => {
      const cat = qparam(p, 'category');
      if (cat === 'Vape Pens') {
        return [200, { op: 'bind', subject: cat, products_affected: null, products_known: true,
          from_ids: [9], to_ids: [9], from_path: 'Vaporizers [9]', to_path: 'Vaporizers [9]',
          sentence: 'no-op', confirm_field: 'confirm_products',
          would_refuse: { code: 'no_change', error: 'Vape Pens is already bound to Vaporizers [9].' },
          catalog_error: null } ];
      }
      return [200, preview({ subject: cat, products_affected: 12 })];
    }
  }));

  await m.check(q(m.doc, '[data-hw-select-row="Flower"]'));
  await m.check(q(m.doc, '[data-hw-select-row="Vape Pens"]'));
  await m.click(q(m.doc, '[data-hw-bulk-bind]'));
  await m.click(q(m.doc, '[data-hw-node="9"]'));

  const skipped = q(m.doc, '[data-hw-bulk-skipped]');
  assert.ok(skipped, 'a refused category must be surfaced, not silently dropped');
  assert.match(skipped.textContent, /1 of 2/);
  assert.match(q(m.doc, '[data-hw-bulk-skip-reason="Vape Pens"]').textContent, /already bound/);
  assert.match(q(m.doc, '[data-hw-bulk-usable-count]').textContent, /1/);

  await m.click(q(m.doc, '[data-hw-bulk-review]'));
  await m.click(q(m.doc, '[data-hw-bulk-confirm]'));

  assert.equal(m.sent.length, 1, 'the refused category must never be posted');
  assert.equal(m.sent[0].body.category, 'Flower');
});

test('the batch goes stale, and writes NOTHING, if a category\'s count moved between Review and Confirm', async () => {
  let liveCount = 12;
  const m = await mount(router({
    map: payload([FLOWER, PREROLL]),
    pv: (p) => {
      const cat = qparam(p, 'category');
      const affected = cat === 'Flower' ? liveCount : 8;
      return [200, preview({ subject: cat, products_affected: affected })];
    }
  }));

  await m.check(q(m.doc, '[data-hw-select-row="Flower"]'));
  await m.check(q(m.doc, '[data-hw-select-row="Pre Roll"]'));
  await m.click(q(m.doc, '[data-hw-bulk-bind]'));
  await m.click(q(m.doc, '[data-hw-node="9"]'));
  await m.click(q(m.doc, '[data-hw-bulk-review]'));

  // The catalog moves while the panel sits reviewed, exactly the race
  // PreviewPanel's own Review->Confirm gate exists to catch for a single bind.
  liveCount = 40;
  await m.click(q(m.doc, '[data-hw-bulk-confirm]'));

  assert.equal(m.sent.length, 0, 'nothing may be written once any category has gone stale');
  const stale = q(m.doc, '[data-hw-bulk-stale]');
  assert.ok(stale, 'a moved count must block the WHOLE batch, not save the categories that did not move');
  assert.match(stale.textContent, /Flower/);

  // Review again must be able to recover and proceed.
  await m.click(q(m.doc, '[data-hw-bulk-review-again]'));
  await m.click(q(m.doc, '[data-hw-bulk-confirm]'));
  assert.equal(m.sent.length, 2, 'once re-reviewed against the current count, the batch can save');
});

test('the unknown-catalog acknowledgement is required before a bulk confirm fires, same as the single-bind flow', async () => {
  const m = await mount(router({
    map: payload([FLOWER, PREROLL]),
    pv: (p) => {
      const cat = qparam(p, 'category');
      return [200, preview({ subject: cat, products_affected: null, products_known: false,
        catalog_error: 'catalog unreadable' })];
    }
  }));

  await m.check(q(m.doc, '[data-hw-select-row="Flower"]'));
  await m.check(q(m.doc, '[data-hw-select-row="Pre Roll"]'));
  await m.click(q(m.doc, '[data-hw-bulk-bind]'));
  await m.click(q(m.doc, '[data-hw-node="9"]'));
  await m.click(q(m.doc, '[data-hw-bulk-review]'));

  const confirmBtn = q(m.doc, '[data-hw-bulk-confirm]');
  assert.equal(confirmBtn.getAttribute('data-disabled'), '1',
    'confirm must be blocked until the unknown-catalog checkbox is ticked');

  await m.check(q(m.doc, '[data-hw-bulk-echo-unknown]'));
  assert.equal(q(m.doc, '[data-hw-bulk-confirm]').getAttribute('data-disabled'), '0');

  await m.click(q(m.doc, '[data-hw-bulk-confirm]'));
  assert.equal(m.sent.length, 2);
  assert.equal(m.sent[0].body.confirm_products, null);
  assert.equal(m.sent[1].body.confirm_products, null);
});
