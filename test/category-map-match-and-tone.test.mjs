/* ── The match join, the picker's name collisions, and what tone asserts ─────
 *
 * WHAT THIS FILE GUARDS
 * ---------------------
 * Three defects that this screen had shipped with, all of the same family: the
 * screen was TRUE about one question while the reader took it to be answering
 * a different one.
 *
 *   1. THE SECOND JOIN WAS INVISIBLE. category_map.py has been sending
 *      `match_key`, `match_state`, `match_path`, `match_differs` and
 *      `match_ambiguous` on every row, plus a whole top-level `match` block
 *      with `skus_shutout`. NOTHING ON THE SCREEN READ ANY OF IT. `wm_ids` is
 *      the PUBLISH join; `match_key` is the MATCH join, and they have
 *      different answers -- `Accessories` publishes to [234, 9] and matches on
 *      `Gear`. A row could read `resolves`, in green, truthfully, while every
 *      candidate for every SKU under it was excluded before scoring. That was
 *      live for 804 of 1,529 SKUs.
 *
 *      So: the match key must be RENDERED, it must SAY SO when it differs from
 *      the display name, and it must never be presented as a name anybody
 *      could rename -- renaming the category breaks the publish join and does
 *      not move the match key at all.
 *
 *   2. THE PICKER HID A COIN FLIP. Weedmaps' tree is not name-unique:
 *      `Diamonds` is 423 (solvent BHO) and 428 (solventless rosin), and
 *      engine.resolve_categories() keeps the FIRST and drops the other. A
 *      picker rendering two identical-looking rows leaves the operator to
 *      re-make, by hand, the same arbitrary choice the engine already made.
 *      Both sides of a collision must be marked, and each must say which side
 *      it is -- because one of the two is reachable ONLY by an explicit pick.
 *
 *   3. TONE ASSERTED SOMETHING THE CONTENTS DENIED. The list of SKUs the alias
 *      layer has already FIXED sat inside the defect card, under the eyebrow
 *      "Products publishing to Weedmaps with no category", in a card whose
 *      border goes red the moment anything else in it is broken. Every row in
 *      it was green with a tick. The owner read four fixed things as four
 *      broken ones, which is exactly what the styling said.
 *
 *      A red border is an assertion that somebody must act. Nobody must act on
 *      a record of a repair. So the rescued list is its own panel and must NOT
 *      inherit the defect card's alarm -- INCLUDING when the defect card is
 *      genuinely red, which is the only case where the old nesting could hurt.
 *
 * And one rule that cuts across all three: AN UNKNOWN IS NOT A ZERO AND NOT A
 * VERDICT. `skus_shutout: null` means the catalogue or the vocabulary could not
 * be read; printing 0 there asserts "nothing is shut out", the single most
 * reassuring claim the panel could make and the one it has no evidence for.
 * Likewise a row with no `match_state` at all has not been judged, and must not
 * render like one that was.
 *
 * HOW IT TESTS
 * ------------
 * jsdom + the real react-dom, so useEffect runs and the screen's own fetch path
 * is exercised. The route is stubbed per scenario; nothing on disk and nothing
 * on any port is touched. Atoms are stubbed as plain elements that keep their
 * text and their data-* attributes, so what is asserted is what the panel SAYS
 * and which container it says it in.
 *
 * State vocabulary is the REAL one from wmdemo/taxonomy.match_index():
 * MATCHES / NO_MATCH_KEY / BROKEN_TREE, plus UNKNOWN when the derivation
 * failed. An invented state name here would test a fallback and prove nothing.
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

/** Real nodes, including BOTH halves of the live `Diamonds` collision. */
const TREE = [
  { id: 2, name: 'Flower', parent_id: null, slug: 'flower', published: true },
  { id: 185, name: 'Pre Roll', parent_id: null, slug: 'pre-roll', published: true },
  { id: 4, name: 'Vape Pens', parent_id: null, slug: 'vape-pens', published: true },
  { id: 234, name: 'Gear', parent_id: null, slug: 'gear', published: true },
  { id: 9, name: 'Accessories', parent_id: 234, slug: 'accessories', published: true },
  { id: 104, name: 'Concentrates', parent_id: null, slug: 'concentrates', published: true },
  { id: 423, name: 'Diamonds', parent_id: 104, slug: 'diamonds', published: true },
  { id: 428, name: 'Diamonds', parent_id: 104, slug: 'diamonds-rosin', published: true }
];

/** The collision exactly as category_map._name_index() reports it. */
const COLLISIONS = [
  { name: 'Diamonds', kept_id: 423, ignored_id: 428, ignored_parent_id: 104 }
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
  return Object.assign({
    category, state: 'RESOLVES', wm_ids: [2],
    wm_nodes: [{ id: 2, name: 'Flower', parent_id: null, slug: 'flower',
      published: true, unknown: false }],
    wm_path: 'Flower [2]', product_count: 5,
    binding_source: 'name_match', binding: null, name_match_ids: [2],
    name_match_path: 'Flower [2]', overrides_name_match: false,
    aliases: [alias(category, { is_canonical: true, products: 5, in_use: true,
      spellings_in_use: [category], resolves_on_its_own: true, own_ids: [2] })],
    alias_count: 0, other_spellings_in_use: [], policy: {},
    match_key: category, match_state: 'MATCHES', match_path: 'Flower [2]',
    match_differs: false, match_ambiguous: []
  }, over || {});
}

/** The live divergence: publishes under Gear > Accessories, MATCHES on `Gear`. */
const ACCESSORIES = row('Accessories', {
  wm_ids: [234, 9],
  wm_nodes: [
    { id: 234, name: 'Gear', parent_id: null, slug: 'gear', published: true, unknown: false },
    { id: 9, name: 'Accessories', parent_id: 234, slug: 'accessories', published: true, unknown: false }
  ],
  wm_path: 'Gear [234] > Accessories [9]', product_count: 29,
  match_key: 'Gear', match_state: 'MATCHES', match_path: 'Gear [234]',
  match_differs: true
});

/** `Deals`: Weedmaps has no node. An allowed resting state, per the owner. */
const DEALS = row('Deals', {
  state: 'NO_WM_NODE', wm_ids: [], wm_nodes: [], wm_path: null,
  product_count: 1, binding_source: 'none', name_match_ids: [],
  name_match_path: null,
  match_key: null, match_state: 'NO_MATCH_KEY', match_path: null,
  match_differs: null,
  aliases: [alias('Deals', { is_canonical: true, products: 1, in_use: true,
    spellings_in_use: ['Deals'] })]
});

function payload(rows, over) {
  return Object.assign({
    rows,
    counts: {
      categories: rows.length,
      resolves: rows.filter((r) => r.state === 'RESOLVES').length,
      no_wm_node: rows.filter((r) => r.state === 'NO_WM_NODE').length,
      unused: 0, unknown_use: 0, binding_broken: 0, explicit_bindings: 0,
      products: rows.reduce((a, r) => a + (r.product_count || 0), 0),
      products_uncategorised: 0, products_binding_broken: 0,
      products_needing_action: 0, products_rescued_by_alias: 0,
      spellings_unfoldable: 0
    },
    unfoldable: [], uncategorised_skus: [], rescued_by_alias: [],
    wm_tree: { path: '/repo/cats.json', nodes: TREE.length, names: TREE.length - 1,
      collisions: COLLISIONS, error: null, tree: TREE },
    wm_node_table: { available: true, nodes: TREE.length, retired: 0 },
    catalog: { error: null, spellings: rows.length },
    match: { vocabulary: {}, spellings: [], skus_shutout: 0,
      skus: rows.reduce((a, r) => a + (r.product_count || 0), 0),
      error: null, derivation: 'root node name, from cats.json alone' },
    editor: { error: null, top_level: rows.map((r) => r.category),
      alias_overrides: [], bindings: {}, routes: {},
      no_suppress_state: 'An unbound category is allowed.' },
    algorithm: 'engine.resolve_categories()'
  }, over || {});
}

// ------------------------------------------------------------- the sandbox

const compiled = esbuild.transformSync(fs.readFileSync(SCREEN, 'utf8'), {
  loader: 'jsx', jsx: 'transform', target: 'es2020'
}).code;

function palette() {
  return new Proxy({}, {
    get(_t, k) {
      if (k === 'type') { return new Proxy({}, { get: (_a, kk) => 'sz-' + String(kk) }); }
      return 'TOK:' + String(k);
    }
  });
}

function installAtoms(win) {
  const h = React.createElement;
  const pass = (tag, extra) => function S(p) {
    return h(tag, { 'data-stub': extra || tag }, p.children);
  };
  win.React = React;
  win.useP = () => palette();
  win.Icon = ({ name }) => h('i', { 'data-icon': name });
  // Card KEEPS its resolved inline style AND its data-* attributes. Both are
  // load-bearing: half this file's assertions are about which container a thing
  // is inside and what colour that container claims to be. The real
  // pos/atoms.jsx Card spreads ...rest onto the div, so these hooks are honest
  // rather than a fiction the stub invented.
  win.Card = function Card(p) {
    const { children, density, style, ...rest } = p;
    return h('div', Object.assign({ 'data-stub': 'card',
      'data-style': JSON.stringify(style || {}) }, rest), children);
  };
  win.Eyebrow = pass('div', 'eyebrow');
  win.Pill = function Pill(p) {
    return h('span', { 'data-stub': 'pill', 'data-tone': p.kind }, p.children);
  };
  win.PBtn = function PBtn(p) {
    const { children, icon, iconRight, variant, size, busy, active, full, style,
      onClick, disabled, ...rest } = p;
    return h('button', Object.assign({ 'data-stub': 'pbtn', onClick,
      disabled: !!disabled }, rest), children);
  };
  win.Field = () => h('input', { 'data-stub': 'field', readOnly: true });
  win.KPI = function KPI(p) {
    return h('div', { 'data-stub': 'kpi', 'data-kpi': String(p.label) },
      String(p.label) + ' | ' + String(p.value) + ' | ' + String(p.sublabel));
  };
  win.SkeletonRows = () => h('div', { 'data-stub': 'skeleton' });
  win.EmptyState = (p) => h('div', { 'data-stub': 'empty' },
    String(p.title) + ' ' + String(p.body));
  win.ErrorState = (p) => h('div', { 'data-stub': 'error' },
    String(p.title) + ' ' + String(p.body));
  win.SectionHead = function S(p) {
    return h('div', { 'data-stub': 'sectionhead' },
      String(p.eyebrow || '') + ' >> ' + String(p.title) + ' ~ ' + String(p.subtitle || ''),
      p.action || null);
  };
  win.DataTable = function DataTable(p) {
    return h('div', { 'data-stub': 'table' }, (p.rows || []).map((r, i) =>
      h('div', { key: p.rowKey ? p.rowKey(r) : i, 'data-stub': 'row' },
        (p.columns || []).map((c, j) =>
          h('div', { key: j, 'data-stub': 'cell', 'data-col': String(c.label) },
            c.render ? c.render(r) : null)))));
  };
  win.DevNote = (p) => h('div', { 'data-stub': 'devnote', 'data-tone': p.tone }, p.children);
  win.DevNoteP = pass('p', 'devnotep');
  win.DevNoteMono = pass('code', 'devnotemono');
}

async function mount(body) {
  const dom = new JSDOM('<!doctype html><html><body><div id="r"></div></body></html>',
    { url: 'http://127.0.0.1:8942/' });
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
  win.fetch = (url) => {
    const p = String(url).replace('http://127.0.0.1:8942', '');
    if (p.split('?')[0] === ROUTE) {
      return Promise.resolve({ ok: true, status: 200,
        text: () => Promise.resolve(JSON.stringify(body)) });
    }
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') });
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
  const q = (sel) => Array.from(host.querySelectorAll(sel));
  const cardStyle = (el) => {
    const card = el.closest('[data-stub="card"]');
    assert.ok(card, 'that element is not inside a card');
    return JSON.parse(card.getAttribute('data-style') || '{}');
  };
  return { win, host, q, click, cardStyle, text: () => host.textContent };
}

const flat = (s) => String(s).replace(/\s+/g, ' ');

// ══════════════════════════════════════════════ 1. the match join is rendered

test('the match key is on the screen at all — the column exists for every row', async () => {
  const { q } = await mount(payload([row('Flower'), ACCESSORIES, DEALS]));
  const cells = q('[data-hw-match]');
  assert.equal(cells.length, 3,
    'every row must render a match cell; the route sends match_* on all of them');
  assert.deepEqual(cells.map((e) => e.getAttribute('data-hw-match')),
    ['Flower', 'Accessories', 'Deals']);
  const cols = q('[data-col]').map((e) => e.getAttribute('data-col'));
  assert.ok(cols.indexOf('Matcher joins on') >= 0,
    'the match join must be its own COLUMN, not a footnote to the node cell');
});

test('a category that matches on a DIFFERENT word than its own name says so, and names both facts', async () => {
  const { q } = await mount(payload([row('Flower'), ACCESSORIES, DEALS]));
  const cell = q('[data-hw-match="Accessories"]')[0];
  const t = flat(cell.textContent);

  // BOTH facts, neither standing in for the other.
  assert.match(t, /Gear/, 'the match key itself must be printed');
  assert.match(t, /Gear \[234\] > Accessories \[9\]/,
    'the PUBLISH path must be printed alongside it — they are different answers');
  assert.equal(q('[data-hw-match="Accessories"] [data-hw-match-differs]').length, 1,
    'the divergence must be flagged, not left for the reader to spot');

  // AND the trap that makes this dangerous: the match key is not ours to rename.
  assert.match(t, /Renaming this category/i,
    'the screen must say that renaming the category breaks the publish join');
});

test('a row whose name and match key agree does NOT get the divergence warning', async () => {
  const { q } = await mount(payload([row('Flower'), ACCESSORIES, DEALS]));
  assert.equal(q('[data-hw-match="Flower"] [data-hw-match-differs]').length, 0,
    'Flower matches on "Flower"; warning there would make the real one unreadable');
  assert.equal(q('[data-hw-match="Flower"]')[0].getAttribute('data-hw-match-state'),
    'MATCHES');
});

test('a category with no match key at all is stated as a shutout, not left blank', async () => {
  const { q } = await mount(payload([row('Flower'), ACCESSORIES, DEALS]));
  const cell = q('[data-hw-match="Deals"]')[0];
  assert.equal(cell.getAttribute('data-hw-match-state'), 'NO_MATCH_KEY');
  assert.match(flat(cell.textContent), /excluded before scoring/i,
    'NO_MATCH_KEY must say what it costs, not merely show an empty key');
});

test('NO match state at all renders as "not derived" — never as a verdict', async () => {
  // The route sends null for every match_* field when the derivation itself
  // could not run. That is an ABSENCE. It must not render like MATCHES and it
  // must not render like NO_MATCH_KEY: one would reassure, the other would
  // accuse, and neither has been established.
  const blind = row('Flower', { match_key: null, match_state: null,
    match_path: null, match_differs: null, match_ambiguous: [] });
  const { q } = await mount(payload([blind]));
  const cell = q('[data-hw-match="Flower"]')[0];
  assert.equal(cell.getAttribute('data-hw-match-state'), 'ABSENT');
  const t = flat(cell.textContent);
  assert.match(t, /not derived/i);
  assert.match(t, /not the same claim/i,
    'the screen must say an absent key is not a claim that it matches');
  assert.doesNotMatch(t, /\bjoins\b/,
    'an absence must never borrow the wording of a successful match');
});

// ══════════════════════════════════════════════ 2. the shutout panel

test('SKUs excluded before scoring are reported as their own alarm, above the table', async () => {
  const { q } = await mount(payload([row('Flower'), ACCESSORIES, DEALS], {
    match: { vocabulary: {}, skus_shutout: 804, skus: 1529, error: null,
      derivation: 'root node name',
      spellings: [{ spelling: 'Prerolls', products: 428, canonical: 'Pre Roll',
        match_key: 'Pre Roll', joins: false,
        why: 'the catalogue stores ‘Prerolls’; the matcher joins on ‘Pre Roll’', skus: [] }] }
  }));
  const panel = q('[data-hw-shutout]')[0];
  assert.ok(panel, 'the shutout must be reported somewhere');
  assert.equal(panel.getAttribute('data-hw-shutout'), 'bad');
  const t = flat(panel.textContent);
  assert.match(t, /804/);
  assert.match(t, /1,529/, 'the denominator matters — 804 alone is not a rate');
  assert.equal(q('[data-hw-shutout-row="Prerolls"]').length, 1,
    'the offending spelling must be named, not merely counted');

  // AND it must be a genuinely separate claim from the publish defect.
  assert.equal(panel.closest('[data-hw-defect]'), null,
    'the match shutout is not a publish defect and must not be nested in that card');
});

test('an UNKNOWN shutout count never prints 0 — the most reassuring possible lie', async () => {
  const { q } = await mount(payload([row('Flower')], {
    match: { vocabulary: {}, spellings: [], skus_shutout: null, skus: null,
      error: 'catalog unavailable', derivation: 'root node name' }
  }));
  const panel = q('[data-hw-shutout]')[0];
  assert.equal(panel.getAttribute('data-hw-shutout'), 'unknown');
  const t = flat(panel.textContent);
  assert.match(t, /UNKNOWN/i);
  assert.doesNotMatch(t, /\b0 of\b/,
    'a null count rendered as 0 asserts "nothing is shut out" with nothing looked at');
  assert.doesNotMatch(t, /excluded before the matcher scores anything/,
    'that headline is a measurement; there is no measurement here');
});

test('a clean deployment says so quietly, and does not manufacture an alarm', async () => {
  const { q } = await mount(payload([row('Flower')]));
  const panel = q('[data-hw-shutout]')[0];
  assert.equal(panel.getAttribute('data-hw-shutout'), 'clear');
  const style = JSON.parse(panel.getAttribute('data-style') || '{}');
  assert.ok(!/TOK:bad/.test(JSON.stringify(style)),
    'nothing is wrong, so nothing may be styled as wrong');
});

// ══════════════════════════════════════════════ 3. tone must match content

test('the ALREADY-FIXED list is its own panel and is never inside the defect card', async () => {
  const { q } = await mount(payload([row('Flower'), DEALS], {
    rescued_by_alias: [
      { sku: 'V-1', spelling: 'Vapes', canonical: 'Vape Pens', wm_ids: [4] },
      { sku: 'V-2', spelling: 'Vapes', canonical: 'Vape Pens', wm_ids: [4] },
      { sku: 'P-1', spelling: 'Pre-Rolls', canonical: 'Pre Roll', wm_ids: [185] },
      { sku: 'P-2', spelling: 'Pre-rolls', canonical: 'Pre Roll', wm_ids: [185] }
    ]
  }));
  const panel = q('[data-hw-rescued]')[0];
  assert.ok(panel, 'the rescued list must still be shown — the fix being recent is why');
  assert.equal(panel.closest('[data-hw-defect]'), null,
    'THE BUG: it used to live inside the defect card and inherit its alarm');
  assert.equal(panel.getAttribute('data-hw-rescued-tone'), 'calm');
  const t = flat(panel.textContent);
  assert.match(t, /Already fixed/i,
    'the panel must say it is fixed in words, not leave it to the tick marks');
  assert.match(t, /nothing here is waiting on anybody/i);
  assert.equal(q('[data-hw-rescued-row]').length, 3,
    'grouped by spelling: Vapes, Pre-Rolls, Pre-rolls');
});

test('even when the defect card IS a genuine alarm, the fixed list stays calm', async () => {
  // THE ONLY CASE WHERE THE OLD NESTING ACTUALLY HURT. With a real broken SKU
  // present the defect card goes red — and the four FIXED SKUs used to be
  // inside that red border, which is precisely what the owner reported.
  const { q } = await mount(payload([row('Flower'), DEALS], {
    uncategorised_skus: [
      { sku: 'X-1', spelling: 'Vapess', canonical: null, kind: 'unfoldable',
        why: 'no alias accepts this spelling', needs_action: true }
    ],
    rescued_by_alias: [
      { sku: 'V-1', spelling: 'Vapes', canonical: 'Vape Pens', wm_ids: [4] }
    ]
  }));
  const defect = q('[data-hw-defect]')[0];
  assert.equal(defect.getAttribute('data-hw-defect-tone'), 'alarm',
    'a genuinely broken SKU must still raise a genuine alarm');
  assert.match(JSON.stringify(JSON.parse(defect.getAttribute('data-style'))), /TOK:bad/,
    'the defect card is red here, which is correct');

  const rescued = q('[data-hw-rescued]')[0];
  assert.equal(rescued.closest('[data-hw-defect]'), null);
  const rstyle = JSON.stringify(JSON.parse(rescued.getAttribute('data-style')));
  assert.doesNotMatch(rstyle, /TOK:bad/,
    'a record of a repair must not be painted as a fault, whatever its neighbour is doing');
});

test('nothing rescued means no panel at all, rather than an empty reassurance', async () => {
  const { q } = await mount(payload([row('Flower')]));
  assert.equal(q('[data-hw-rescued]').length, 0);
});

// ══════════════════════════════════════════════ 4. the picker's collisions

async function openPicker(category, body) {
  const m = await mount(body);
  const btn = m.q('[data-hw-edit-binding="' + category + '"]')[0];
  assert.ok(btn, 'there must be a control that opens the binding editor for ' + category);
  await m.click(btn);
  return m;
}

test('the picker exists and binds by choosing a node, never by typing an id', async () => {
  const { q } = await openPicker('Flower', payload([row('Flower'), DEALS]));
  assert.equal(q('[data-hw-picker]').length, 1);
  assert.equal(q('[data-hw-node]').length, TREE.length,
    'every node in the capture must be pickable');
});

test('BOTH halves of a name collision are marked, and each says which half it is', async () => {
  // `Diamonds` is 423 and 428. engine keeps the first. A picker that showed two
  // identical rows would make the operator re-flip the same coin by hand.
  const { q } = await openPicker('Flower', payload([row('Flower'), DEALS]));
  const kept = q('[data-hw-node-collision="423"]')[0];
  const ignored = q('[data-hw-node-collision="428"]')[0];
  assert.ok(kept && ignored, 'BOTH sides must be marked — marking only one hides the pair');
  assert.equal(kept.getAttribute('data-hw-node-collision-side'), 'kept');
  assert.equal(ignored.getAttribute('data-hw-node-collision-side'), 'ignored');

  assert.match(flat(kept.textContent), /by ORDER, not by intent/,
    'the winner won arbitrarily and the screen must say so');
  assert.match(flat(ignored.textContent), /never reaches this category type/i,
    '428 is reachable ONLY by an explicit pick — that is the whole reason to show it');

  // The slug is the only field that tells 423 from 428 at a glance.
  assert.match(flat(kept.textContent), /diamonds/);
  assert.match(flat(ignored.textContent), /diamonds-rosin/);
});

test('a node with a unique name carries no collision marking', async () => {
  const { q } = await openPicker('Flower', payload([row('Flower'), DEALS]));
  assert.equal(q('[data-hw-node-collision="2"]').length, 0,
    'Flower [2] is unique; marking it would make the real collisions invisible');
});

test('whether OUR OWN names collide is derived from the payload, never asserted', async () => {
  // This sentence used to be the hard-coded string "None of our nine names is
  // one of them today." — a claim about live data that nothing recomputed. The
  // day one of ours collided, it would have gone on reassuring the reader.
  const clean = await mount(payload([row('Flower'), DEALS]));
  assert.match(flat(clean.text()), /None of our own 2 names is one of them/);
  assert.equal(clean.q('[data-hw-collision-ours]').length, 0);

  const dirty = await mount(payload([row('Diamonds', { match_key: 'Concentrates' }), DEALS]));
  assert.equal(dirty.q('[data-hw-collision-ours]').length, 1,
    'one of ours IS `Diamonds` here, and the banner must notice without being told');
  assert.match(flat(dirty.text()), /decided by order/i);
});

// ══════════════════════════════════════════════ 5. not mapping is allowed

test('an unmapped category is expressible, and the screen does not nag about it', async () => {
  const { q, text } = await mount(payload([row('Flower'), DEALS]));
  const cell = q('[data-hw-cat="Deals"]')[0];
  assert.equal(cell.getAttribute('data-hw-cat-state'), 'NO_WM_NODE');
  // `info`, not `bad`: the owner ruled that choosing not to map is a fact about
  // Weedmaps' taxonomy, not work anybody can do.
  assert.equal(cell.querySelector('[data-stub="pill"]').getAttribute('data-tone'), 'info');
  assert.match(flat(text()), /no category type to bind to — allowed, not a task/,
    'the KPI must not phrase an allowed resting state as an outstanding decision');
});

test('an unmapped category can still be BOUND — the picker opens on it like any other', async () => {
  const { q } = await openPicker('Deals', payload([row('Flower'), DEALS]));
  assert.equal(q('[data-hw-picker]').length, 1,
    'not mapping is the default, but it must not be a dead end');
  assert.ok(q('[data-hw-node]').length > 0);
});
