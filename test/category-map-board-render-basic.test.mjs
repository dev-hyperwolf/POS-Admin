/* ── The Kanban board: replaces test/category-map-states.test.mjs,
 * category-map-match-and-tone.test.mjs, category-map-queue-and-reassign.test.mjs,
 * category-map-bulk-bind-and-scroll.test.mjs, and category-editor.test.mjs ────
 *
 * WHY ONE FILE REPLACES FIVE
 * ---------------------------
 * The screen those five files tested (a table + a sticky side panel switching
 * between three separate editor components) was fully replaced by a Kanban
 * board on the owner's own request, after reviewing 5 mockups. Every DOM
 * selector those files asserted against (`[data-hw-cat]`, `DataTable` rows,
 * `[data-hw-editor="binding"]`, `[data-hw-bulk-bind]`, the sticky-panel scroll
 * bound) no longer exists — not because the guarantees behind them stopped
 * mattering, but because the UI they were reached through is gone. This file
 * re-asserts the SAME load-bearing guarantees (confirm-gate before any write,
 * server map always wins, a partial reassign surfaces rather than vanishes,
 * NO_WM_NODE never looks like an error, an unconfirmed name-match is not the
 * same fact as an explicit pick) against the board's real markup.
 *
 * WHAT THIS FILE DOES NOT COVER, ON PURPOSE: real HTML5 drag-and-drop.
 * jsdom's DragEvent has no working DataTransfer — dispatching a synthetic
 * 'dragstart'/'drop' pair here would test jsdom's stub, not this screen's
 * code. Every drag gesture in the board (queue → column, column → column)
 * funnels into the SAME `openBind`/`openMoveCard` calls the non-drag
 * fallbacks use (a queue card's "Add to…" select, a bound card's reassign/
 * unbind icons) — this file exercises those directly, which is a real test
 * of the actual decision logic, not a test of whether jsdom can drag.
 *
 * HOW IT TESTS: identical jsdom + real react-dom harness to the five files it
 * replaces — real fetch/useEffect wiring, every route stubbed per scenario,
 * nothing on disk or any port touched. Fixture builders (`row`, `alias`,
 * `payload`, `preview`, `TREE`) are carried over verbatim from
 * test/category-map-queue-and-reassign.test.mjs since they already mirror the
 * real GET/POST payload shapes closely.
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
  { id: 512, name: 'Tinctures', parent_id: null, slug: 'tinctures', published: true },
  { id: 467, name: 'Wellness', parent_id: null, slug: 'wellness', published: true },
  { id: 471, name: 'CBD Isolate', parent_id: null, slug: 'cbd-isolate', published: true },
  { id: 423, name: 'Diamonds', parent_id: 3, slug: 'diamonds-solvent', published: true },
  { id: 428, name: 'Diamonds', parent_id: 3, slug: 'diamonds-solventless', published: true }
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

/** Flower: resolves by name match only, nobody has picked it. */
const FLOWER = row('Flower', { product_count: 512 });

/** Wellness: picked EARLY, bound to the wrong category type — the same
 *  reassign scenario the old suite covered. */
const WELLNESS = row('Wellness', {
  state: 'RESOLVES', wm_ids: [512],
  wm_nodes: [{ id: 512, name: 'Tinctures', parent_id: null, slug: 'tinctures', published: true, unknown: false }],
  wm_path: 'Tinctures [512]', product_count: 41,
  binding_source: 'explicit',
  binding: { node_id: 512, actor: 'ops@hyperwolf.com', at_iso: '2026-07-14T00:00:00Z' },
  name_match_ids: [467], name_match_path: 'Wellness [467]'
});

/** Deals: no Weedmaps category type exists, ever. */
const DEALS = row('Deals', {
  state: 'NO_WM_NODE', wm_ids: [], wm_nodes: [], wm_path: null,
  product_count: 23, binding_source: 'none', name_match_ids: [], name_match_path: null,
  aliases: [alias('Deals', { is_canonical: true, products: 23, in_use: true, spellings_in_use: ['Deals'] })]
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
    from_ids: [], to_ids: [2], from_path: null, to_path: 'Flower [2]',
    sentence: 'Binds 3 product rows under Flower to Flower [2].',
    confirm_field: 'confirm_products', would_refuse: null, catalog_error: null
  }, over || {});
}

// ------------------------------------------------------------- the sandbox
// Identical harness to the files this replaces.

const compiled = esbuild.transformSync(fs.readFileSync(SCREEN, 'utf8'), {
  loader: 'jsx', jsx: 'transform', target: 'es2020'
}).code;

function palette() {
  return new Proxy({}, {
    get(_t, k) {
      if (k === 'type') { return new Proxy({}, { get: (_a, kk) => 'sz-' + String(kk) }); }
      if (k === 'z') { return new Proxy({}, { get: (_a, kk) => 100 + String(kk).length }); }
      return 'tok-' + String(k);
    }
  });
}

function installAtoms(win) {
  const h = React.createElement;
  win.React = React;
  win.useP = () => palette();
  win.Icon = ({ name }) => h('i', { 'data-icon': name });
  win.Card = function Card(props) {
    const { children, density, style, ...rest } = props;
    return h('div', Object.assign({ 'data-stub': 'card' }, rest), children);
  };
  win.Eyebrow = (props) => h('div', { 'data-stub': 'eyebrow' }, props.children);
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
  win.DevNoteP = (props) => h('p', { 'data-stub': 'devnotep' }, props.children);
  win.DevNoteMono = (props) => h('code', { 'data-stub': 'devnotemono' }, props.children);
}

// Each test mounts a fresh JSDOM window + React root. Node's test runner
// does NOT isolate sequential `test()` calls into separate processes the way
// separate FILES are — everything here shares one process, and neither a
// JSDOM window nor a React root was ever torn down between tests. That
// accumulation is real: confirmed by running this exact mount()/fixture pair
// as a bare script outside node:test (no hang, sub-second) versus inside a
// sequence of 4-5 preceding tests in this runner (hangs indefinitely, no
// thrown error, no rejection — node:test's own test-context bookkeeping
// gets confused by the pile-up, not this file's logic). Tearing down the
// PREVIOUS mount before creating a new one keeps exactly one JSDOM window
// and one React root alive at a time, which resolved it.
let _lastCleanup = null;
async function mount(route) {
  if (_lastCleanup) { const c = _lastCleanup; _lastCleanup = null; c(); }
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

  const NAMES = ['window', 'React', 'useP', 'Icon', 'Card', 'Eyebrow', 'Pill', 'PBtn',
    'Field', 'KPI', 'SkeletonRows', 'EmptyState', 'ErrorState', 'SectionHead',
    'DataTable', 'DevNote', 'DevNoteP', 'DevNoteMono', 'fetch'];
  // eslint-disable-next-line no-new-func
  new win.Function(NAMES.join(','), compiled)
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
  const change = async (el, value) => {
    assert.ok(el, 'change target does not exist');
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    await act(async () => {
      setter.call(el, value);
      el.dispatchEvent(new win.Event('change', { bubbles: true }));
    });
    await settle();
  };
  _lastCleanup = function () {
    try { root.unmount(); } catch (e) {}
    try { win.close(); } catch (e) {}
  };
  return { doc: win.document, win, host, sent, click, change, settle, text: () => host.textContent };
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

const q = (doc, sel) => doc.querySelector(sel);
const qa = (doc, sel) => [...doc.querySelectorAll(sel)];
const btnByText = (doc, re) => qa(doc, 'button').filter((b) => re.test(b.textContent || ''))[0];

/* Split from a single larger file, 2026-09-04 — that file hung reliably
 * under `node --test` after ~4-5 tests shared one process (confirmed via a
 * standalone repro script outside node:test: identical mount()/fixtures ran
 * clean in under a second — the app code was never the bug). The original
 * five files this whole suite replaced were always small and separate for
 * the same underlying reason (each gets its own process); this split
 * restores that convention rather than fighting the test runner. */

// ═══════════════════════════ 1. static board render, real data ═══════════

test('the board renders one column per category, plus a queue lane, from real GET data', async () => {
  const m = await mount(router({ map: payload([FLOWER, WELLNESS, DEALS]) }));
  assert.ok(q(m.doc, '[data-hw-board]'), 'the board must mount');
  assert.ok(q(m.doc, '[data-hw-queue-lane]'), 'the queue lane must mount alongside the columns');
  assert.ok(q(m.doc, '[data-hw-column="Flower"]'));
  assert.ok(q(m.doc, '[data-hw-column="Wellness"]'));
  assert.ok(q(m.doc, '[data-hw-column="Deals"]'));
});

test('an explicit binding renders as a real card under its own category, never as an auto-resolved placeholder', async () => {
  const m = await mount(router({ map: payload([WELLNESS]) }));
  const col = q(m.doc, '[data-hw-column="Wellness"]');
  assert.ok(q(col, '[data-hw-wm-card="512"]'), 'Wellness has one explicit pick, node 512');
  assert.equal(!!q(col, '[data-hw-auto-resolved]'), false);
});

