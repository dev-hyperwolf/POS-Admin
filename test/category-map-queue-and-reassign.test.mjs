/* ── The "needs a look" queue, and reassigning an already-confirmed pick ─────
 *
 * WHAT THIS FILE GUARDS
 * ---------------------
 * Two changes landed on the category map screen on 2026-09-01, from an
 * approved mockup, on top of everything test/category-editor.test.mjs and
 * test/category-map-states.test.mjs already guard:
 *
 *   1. THE RIGHT PANEL BECOMES A WORK QUEUE. "Confirmed" means a PERSON
 *      explicitly picked the Weedmaps category type — not that the category
 *      happens to resolve. 8 of our 9 canonical names resolve by accidental
 *      name match today (the whole point of the alias layer), so a literal
 *      "hide anything that resolves" filter would count a coincidence in
 *      spelling as a decision nobody made, and would leave the queue nearly
 *      always empty. `Deals` (no Weedmaps category type exists for it, ever)
 *      is its own permanent line: never counted as unconfirmed, never hidden,
 *      never offered a Confirm button it has nothing to confirm.
 *
 *   2. REASSIGN MOVES ONE PICK IN ONE OPERATOR ACTION. Before this, moving a
 *      category from one Weedmaps category type to another was two separate
 *      confirmed writes (Add, then Remove) with a real gap between them where
 *      the category held neither. Reassign still has to be TWO HTTP calls —
 *      this screen's backend (wmdemo/category_map.py, not part of this file)
 *      has no single route that does both — but the ORDER is the guarantee:
 *      ADD the new pick first, REMOVE the old one second, so the category is
 *      bound to BOTH (never NEITHER) for however long the second call takes.
 *      A refusal on the second call must surface on screen, not vanish —
 *      leaving both bindings live is a correct, visible outcome, not a bug
 *      swept under a "saved" toast.
 *
 * HOW IT TESTS
 * ------------
 * Same jsdom + real react-dom harness as test/category-editor.test.mjs: real
 * fetch/useEffect wiring, every route stubbed per scenario, nothing on disk or
 * any port touched.
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
  { id: 471, name: 'CBD Isolate', parent_id: null, slug: 'cbd-isolate', published: true }
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

/** Wellness: picked EARLY, bound to the wrong category type (the mockup's own
 *  scenario) — Tinctures [512] instead of Wellness [467]. */
const WELLNESS = row('Wellness', {
  state: 'RESOLVES', wm_ids: [512],
  wm_nodes: [{ id: 512, name: 'Tinctures', parent_id: null, slug: 'tinctures', published: true, unknown: false }],
  wm_path: 'Tinctures [512]', product_count: 41,
  binding_source: 'explicit',
  binding: { node_id: 512, actor: 'ops@hyperwolf.com', at_iso: '2026-07-14T00:00:00Z' },
  name_match_ids: [467], name_match_path: 'Wellness [467]'
});

/** Deals: no Weedmaps category type exists, ever. The permanent resting line. */
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
// Identical harness to test/category-editor.test.mjs — see that file for why
// each piece (the reactProps() typing shortcut especially) is shaped this way.

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
    { url: 'http://127.0.0.1:8943/' });
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
    const p = String(url).replace('http://127.0.0.1:8943', '');
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
  return { doc: win.document, win, host, sent, click, settle, text: () => host.textContent };
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
const btnByText = (doc, re) => qa(doc, 'button')
  .filter((b) => re.test(b.textContent || ''))[0];

// ═══════════════════════════ 1. the queue: unconfirmed, confirmed, resting

test('the queue lists only the name-match categories, keeps Deals in its own permanent line, and hides confirmed picks behind a toggle', async () => {
  const m = await mount(router({ map: payload([FLOWER, WELLNESS, DEALS]) }));

  const queue = q(m.doc, '[data-hw-queue]');
  assert.ok(queue, 'the right panel must default to the queue, not an idle placeholder');

  // Flower: unconfirmed, has a Confirm button, is visible without any click.
  const flowerItem = q(m.doc, '[data-hw-queue-item="Flower"]');
  assert.ok(flowerItem, 'Flower resolves only by name match and must be in the queue');
  assert.ok(q(m.doc, '[data-hw-queue-confirm="Flower"]'), 'Flower must offer a Confirm control');

  // Deals: its OWN permanent line, no Confirm button, never counted below.
  const dealsItem = q(m.doc, '[data-hw-queue-item="Deals"]');
  assert.ok(dealsItem, 'Deals must have its own permanent, always-visible line');
  assert.equal(q(m.doc, '[data-hw-queue-confirm="Deals"]'), null,
    'there is nothing to confirm on a category with no Weedmaps category type');
  assert.match(dealsItem.textContent, /not fixable/i);

  // Wellness: explicitly confirmed (even though bound to the wrong type — see
  // change 2). It must NOT appear in the unconfirmed list...
  assert.equal(q(m.doc, '[data-hw-queue-item="Wellness"]'), null,
    'a confirmed pick must not sit among the unconfirmed items by default');

  // ...the count must exclude it AND exclude Deals — 1 unconfirmed, not 2 or 3.
  assert.match(q(m.doc, '[data-hw-queue-count]').textContent, /1 unconfirmed/);

  // ...and it must still be reachable, not silently dropped — behind a toggle
  // that says how many are hidden.
  const toggle = q(m.doc, '[data-hw-queue-toggle]');
  assert.ok(toggle, 'confirmed picks must be reachable, never disappear with no trace');
  assert.match(toggle.textContent, /1 already confirmed/);
  assert.equal(q(m.doc, '[data-hw-queue-settled]'), null, 'starts collapsed');

  await m.click(toggle);
  assert.ok(q(m.doc, '[data-hw-queue-settled]'), 'toggle must reveal the confirmed group');
  assert.ok(q(m.doc, '[data-hw-queue-item="Wellness"]'),
    'once shown, Wellness must be listed with the rest');

  await m.click(toggle);
  assert.equal(q(m.doc, '[data-hw-queue-settled]'), null, 'toggle must collapse it again');
});

test('a category that merely resolves by accidental name match counts as unconfirmed, never as mapped', async () => {
  // Guards the exact judgment call from the approved mockup: "not yet mapped"
  // means nobody explicitly confirmed it, NOT "does not resolve". Flower here
  // resolves perfectly (state RESOLVES) and is still unconfirmed.
  const m = await mount(router({ map: payload([FLOWER, DEALS]) }));
  assert.equal(q(m.doc, '[data-hw-cat="Flower"]').getAttribute('data-hw-cat-state'), 'RESOLVES');
  assert.ok(q(m.doc, '[data-hw-queue-item="Flower"]'),
    'resolving is not the same fact as somebody having picked it');
  assert.match(q(m.doc, '[data-hw-queue-item="Flower"]').textContent,
    /nobody has picked it on purpose/i);
});

test('confirming a name-match category from the queue opens the editor already pointed at the category type it resolves to', async () => {
  const m = await mount(router({ map: payload([FLOWER, DEALS]), pv: preview({ products_affected: 6 }) }));
  await m.click(q(m.doc, '[data-hw-queue-confirm="Flower"]'));

  assert.ok(q(m.doc, '[data-hw-editor="binding"]'), 'Confirm must open the binding editor');
  // The picker already shows node 2 (Flower's own name-match id) selected —
  // the operator did not have to re-pick something the screen already knew.
  assert.equal(q(m.doc, '[data-hw-node="2"][data-hw-node-selected="1"]') !== null, true,
    'the queue’s Confirm must preset the picker to the category type already resolved to');

  await m.click(q(m.doc, '[data-hw-review]'));
  assert.match(q(m.doc, '[data-hw-review-strip]').textContent, /6 product rows reviewed/);
  await m.click(btnByText(m.doc, /Add this category type/));
  assert.equal(m.sent.length, 1);
  assert.deepEqual(m.sent[0].body, { category: 'Flower', node: 2, confirm_products: 6 });
});

// ═══════════════════════════ 2. reassign: one operator action, two ordered writes

test('reassign moves a confirmed pick as add-then-remove, both gated on the ONE reviewed count', async () => {
  const afterAdd = payload([row('Wellness', {
    state: 'BINDING_PARTIAL', wm_ids: [512, 467], product_count: 41,
    binding_source: 'explicit_partial',
    wm_nodes: [{ id: 512, name: 'Tinctures', parent_id: null, slug: 'tinctures', published: true, unknown: false }],
    bindings: [
      { node_id: 512, actor: 'ops@hyperwolf.com', at_iso: '2026-07-14T00:00:00Z', broken: false,
        path: [{ id: 512, name: 'Tinctures', parent_id: null }] },
      { node_id: 467, actor: 'jt@hyperwolf.com', at_iso: '2026-09-01T00:00:00Z', broken: false,
        path: [{ id: 467, name: 'Wellness', parent_id: null }] }
    ]
  })]);
  const afterRemove = payload([row('Wellness', {
    state: 'RESOLVES', wm_ids: [467], wm_path: 'Wellness [467]', product_count: 41,
    binding_source: 'explicit',
    wm_nodes: [{ id: 467, name: 'Wellness', parent_id: null, slug: 'wellness', published: true, unknown: false }],
    bindings: [{ node_id: 467, actor: 'jt@hyperwolf.com', at_iso: '2026-09-01T00:00:00Z', broken: false,
      path: [{ id: 467, name: 'Wellness', parent_id: null }] }]
  })]);

  const m = await mount(router({
    map: payload([WELLNESS]),
    pv: preview({ products_affected: 27, to_path: 'Wellness [467]', sentence: 'placeholder' }),
    save: (p, body) => {
      if (p === ROUTE + '/bind') { return [200, { result: { ok: true }, map: afterAdd }]; }
      if (p === ROUTE + '/unbind') { return [200, { result: { ok: true }, map: afterRemove }]; }
      return [404, { error: 'unexpected route ' + p }];
    }
  }));

  await m.click(q(m.doc, '[data-hw-edit-binding="Wellness"]'));
  assert.ok(q(m.doc, '[data-hw-binding-row="512"]'), 'the current pick must be listed');
  await m.click(q(m.doc, '[data-hw-reassign-node="512"]'));

  // Reassigning: the OTHER bindings list and the plain "Pick a category type"
  // controls step aside for the single swap this is about.
  assert.equal(q(m.doc, '[data-hw-bindings-list]'), null);
  await m.click(q(m.doc, '[data-hw-node="467"]'));

  assert.match(q(m.doc, '[data-hw-preview-sentence]').textContent,
    /never a moment where Wellness holds neither/,
    'the swap sentence must state the atomicity guarantee itself, not just the two ids');

  await m.click(q(m.doc, '[data-hw-review]'));
  assert.match(q(m.doc, '[data-hw-review-strip]').textContent, /27 product rows reviewed/);
  await m.click(btnByText(m.doc, /Confirm move/));

  assert.equal(m.sent.length, 2, 'reassign is two writes, never one and never more');
  assert.equal(m.sent[0].path, ROUTE + '/bind', 'the NEW pick must be added FIRST');
  assert.deepEqual(m.sent[0].body, { category: 'Wellness', node: 467, confirm_products: 27 });
  assert.equal(m.sent[1].path, ROUTE + '/unbind', 'the OLD pick is removed only after the add lands');
  assert.deepEqual(m.sent[1].body, { category: 'Wellness', node: 512, confirm_products: 27 },
    'both writes are gated on the SAME reviewed count — nothing is re-typed for the second one');

  // Final state: only the new pick remains.
  assert.ok(q(m.doc, '[data-hw-bound-node="467"]'));
  assert.equal(q(m.doc, '[data-hw-bound-node="512"]'), null);
});

test('reassign never removes the old pick if adding the new one is refused', async () => {
  const m = await mount(router({
    map: payload([WELLNESS]),
    pv: preview({ products_affected: 27 }),
    save: (p) => {
      if (p === ROUTE + '/bind') {
        return [409, { code: 'confirm_mismatch', error: 'the catalog moved' }];
      }
      return [404, { error: 'the old pick must never be touched: ' + p }];
    }
  }));
  await m.click(q(m.doc, '[data-hw-edit-binding="Wellness"]'));
  await m.click(q(m.doc, '[data-hw-reassign-node="512"]'));
  await m.click(q(m.doc, '[data-hw-node="467"]'));
  await m.click(q(m.doc, '[data-hw-review]'));
  await m.click(btnByText(m.doc, /Confirm move/));

  assert.equal(m.sent.length, 1, 'a refused ADD must never be followed by a REMOVE attempt');
  assert.ok(q(m.doc, '[data-hw-server-refusal="confirm_mismatch"]'));
});

test('a reassign whose REMOVE half is refused leaves BOTH bindings live and says so, rather than losing the failure', async () => {
  const afterAdd = payload([row('Wellness', {
    state: 'BINDING_PARTIAL', wm_ids: [512, 467], product_count: 41,
    binding_source: 'explicit_partial',
    bindings: [
      { node_id: 512, actor: 'ops@hyperwolf.com', at_iso: '2026-07-14T00:00:00Z', broken: false,
        path: [{ id: 512, name: 'Tinctures', parent_id: null }] },
      { node_id: 467, actor: 'jt@hyperwolf.com', at_iso: '2026-09-01T00:00:00Z', broken: false,
        path: [{ id: 467, name: 'Wellness', parent_id: null }] }
    ]
  })]);
  const m = await mount(router({
    map: payload([WELLNESS]),
    pv: preview({ products_affected: 27 }),
    save: (p) => {
      if (p === ROUTE + '/bind') { return [200, { result: { ok: true }, map: afterAdd }]; }
      if (p === ROUTE + '/unbind') {
        return [409, { code: 'confirm_mismatch', error: 'the catalog moved again' }];
      }
      return [404, { error: 'unexpected route ' + p }];
    }
  }));
  await m.click(q(m.doc, '[data-hw-edit-binding="Wellness"]'));
  await m.click(q(m.doc, '[data-hw-reassign-node="512"]'));
  await m.click(q(m.doc, '[data-hw-node="467"]'));
  await m.click(q(m.doc, '[data-hw-review]'));
  await m.click(btnByText(m.doc, /Confirm move/));

  assert.equal(m.sent.length, 2, 'both halves must have been attempted');
  const ref = q(m.doc, '[data-hw-server-refusal="confirm_mismatch"]');
  assert.ok(ref, 'the failed half must be surfaced, never swallowed as a quiet success');
  assert.match(ref.textContent, /new category type was added, but removing the old one was refused/i);
  assert.match(ref.textContent, /Both are currently bound/i);

  // AND the screen must reflect the real, half-done state — both bindings —
  // rather than the stale pre-write picture where only 512 was bound.
  assert.ok(q(m.doc, '[data-hw-bound-node="512"]'));
  assert.ok(q(m.doc, '[data-hw-bound-node="467"]'));
});
