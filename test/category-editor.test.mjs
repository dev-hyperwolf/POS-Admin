/* ── The category editor: picker, aliases, preview ──────────────────────────
 *
 * WHAT THIS FILE GUARDS
 * ---------------------
 * pos/screen-category-map.jsx grew three writes on the owner's instruction:
 * pick a Weedmaps node from their tree, add and edit aliases, and see what a
 * decision would change before saving. Each of the three has a specific way of
 * going quietly wrong, and each one is one edit away at all times:
 *
 *   1. THE PICKER BECOMES AN ID FIELD. A text box is a control that asks the
 *      operator for something the system already knows, and typing 193 when
 *      you meant 194 binds a category to a node nobody chose. The tree is in
 *      the payload; there must be no way to type an id.
 *
 *   2. THE PREVIEW STOPS GATING THE SAVE. The confirmation is the publish
 *      gate's own mechanism — echo back the number you were shown, and the
 *      server recomputes it at save time. If the button enables without a
 *      matching echo, a screen that has been open for ten minutes can commit a
 *      change to a catalog that has moved underneath it.
 *
 *   3. AN UNKNOWN BECOMES A ZERO. When the catalog cannot be read the count is
 *      null, and null is not zero and not "nothing is affected". There must be
 *      NO WAY to type 0 in that state: the confirmation has to be a different
 *      control that sends null, or an absence and an unknown produce the same
 *      request and the server cannot tell them apart either.
 *
 * And one that is not about a control at all:
 *
 *   4. A REFUSAL RENDERS AS A CRASH. The routes answer 409 with a machine code
 *      and a sentence written for a person, because "the built-in alias table
 *      already folds 'Vapes' to Vape Pens" is a CORRECT outcome — it is the
 *      collision guard taxonomy._build_alias_index enforces at import, enforced
 *      again where a human can reach it. Rendered as an error, it invites a
 *      retry that must also fail.
 *
 *   5. AN UNBOUND CATEGORY BECOMES A CHORE. The owner ruled that deciding NOT
 *      to map something "shouldnt be a problem and the system should allow it",
 *      and he did not ask for a ceremony to record that decision. So the editor
 *      must not grow a do-not-publish control, and opening it on a category
 *      with no Weedmaps node must say you do not have to bind it.
 *
 * HOW IT TESTS
 * ------------
 * jsdom + the real react-dom, so useEffect runs and the screen's own fetch and
 * post paths are exercised. Every route is stubbed per scenario; nothing on
 * disk and nothing on any port is touched. The atoms are stubbed as plain
 * elements that keep their text, their tone and their disabled state — what is
 * asserted is what the panel SAYS, what colour it says it in, and whether the
 * button can be pressed.
 *
 * Fixtures are the real payload shapes, captured from
 * GET /api/taxonomy/categories and GET /api/taxonomy/categories/preview against
 * a scratch database (WM_DEMO_DB=/tmp/wf7_category-editor.sqlite3, port 8942).
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

/** Four real nodes out of the 94, including a parent/child pair. */
const TREE = [
  { id: 2, name: 'Flower', parent_id: null, slug: 'flower', published: true },
  { id: 4, name: 'Vape Pens', parent_id: null, slug: 'vape-pens', published: true },
  { id: 193, name: 'Cartridge', parent_id: 4, slug: 'cartridges', published: true },
  { id: 234, name: 'Gear', parent_id: null, slug: 'gear', published: true },
  { id: 9, name: 'Accessories', parent_id: 234, slug: 'accessories', published: true }
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
    alias_count: 0, other_spellings_in_use: [], policy: {}
  }, over || {});
}

/** `Deals` as the route serves it: nothing bound, and that is allowed. */
const DEALS = row('Deals', {
  state: 'NO_WM_NODE', wm_ids: [], wm_nodes: [], wm_path: null,
  product_count: 1, binding_source: 'none', name_match_ids: [],
  name_match_path: null,
  aliases: [alias('Deals', { is_canonical: true, products: 1, in_use: true,
    spellings_in_use: ['Deals'] }), alias('deal')],
  alias_count: 1
});

function payload(rows, over) {
  const counts = {
    categories: rows.length,
    resolves: rows.filter((r) => r.state === 'RESOLVES').length,
    no_wm_node: rows.filter((r) => r.state === 'NO_WM_NODE').length,
    unused: rows.filter((r) => r.state === 'UNUSED').length,
    unknown_use: rows.filter((r) => r.state === 'UNKNOWN_USE').length,
    binding_broken: rows.filter((r) => r.state === 'BINDING_BROKEN').length,
    explicit_bindings: rows.filter((r) => r.binding_source === 'explicit').length,
    products: rows.reduce((a, r) => a + (r.product_count || 0), 0),
    products_uncategorised: 0, products_rescued_by_alias: 0,
    spellings_unfoldable: 0
  };
  return Object.assign({
    rows, counts, unfoldable: [], uncategorised_skus: [], rescued_by_alias: [],
    wm_tree: { path: '/repo/cats.json', nodes: 94, names: 93, collisions: [],
      error: null, tree: TREE },
    wm_node_table: { available: true, nodes: 94, retired: 0 },
    catalog: { error: null, spellings: rows.length },
    editor: {
      error: null,
      top_level: ['Flower', 'Pre Roll', 'Vape Pens', 'Edibles', 'Drinks',
        'Concentrates', 'Deals', 'Wellness', 'Accessories'],
      alias_overrides: [], bindings: {},
      routes: {}, no_suppress_state: 'An unbound category is allowed.'
    },
    algorithm: 'engine.resolve_categories()'
  }, over || {});
}

/** A preview envelope exactly as GET .../preview answers it. */
function preview(over) {
  return Object.assign({
    op: 'bind', subject: 'Deals', products_affected: 3, products_known: true,
    from_ids: [], to_ids: [2], from_path: null, to_path: 'Flower [2]',
    sentence: 'Binds 3 product rows under Deals to Flower [2].',
    confirm_field: 'confirm_products', would_refuse: null,
    catalog_error: null
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
  // PBtn KEEPS `disabled` AND ITS data-* ATTRIBUTES. Both are load-bearing
  // here: whether the save button can be pressed IS the assertion in half this
  // file, and a stub that swallowed `disabled` would report every gate as open.
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

/** Mount the screen with a router over BOTH verbs.
 *  `route(path, method, body)` returns [code, jsonBody] or 'network'. */
async function mount(route, opts = {}) {
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
  const sent = [];
  win.fetch = (url, init) => {
    const p = String(url).replace('http://127.0.0.1:8942', '');
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

  let src = compiled;
  if (opts.patch) {
    const next = opts.patch(src);
    assert.notEqual(next, src, 'patch() did not change the compiled screen');
    src = next;
  }
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
  // TYPING GOES THROUGH THE HANDLER THE SCREEN ITSELF SUPPLIED, read off the
  // React fiber. This is not a shortcut — it is the only route that works here,
  // and the reason is worth writing down because the obvious approach FAILS
  // SILENTLY, which is the worst possible way for a test helper to be wrong.
  //
  // React runs in Node's realm while the DOM lives in jsdom's. A synthetic
  // `input` event dispatched at the node reaches React's onInput but never its
  // onChange: ChangeEventPlugin resolves a different target instance across the
  // realm boundary and simply extracts no event. Nothing throws. The state
  // never changes, the button never enables — and every assertion of the form
  // "the save is still disabled" PASSES, for entirely the wrong reason. That is
  // how a suite ends up guarding a gate that is not there.
  //
  // Clicks are unaffected (SimpleEventPlugin needs none of that), so `click`
  // below is a real dispatched event. This is the same trick
  // publish-gate-states.test.mjs uses, where the atom is stubbed to expose
  // __onChange; these inputs are raw elements, so the fiber props are the hook.
  const reactProps = (el) => {
    const k = Object.keys(el).filter((x) => x.indexOf('__reactProps$') === 0)[0];
    assert.ok(k, 'that element is not a React-rendered node');
    return el[k];
  };
  const type = async (el, value) => {
    assert.ok(el, 'type target does not exist');
    const onChange = reactProps(el).onChange;
    assert.ok(onChange,
      'that input has no onChange — the screen did not make it typeable');
    await act(async () => { onChange({ target: { value: String(value) } }); });
    await settle();
  };
  const check = async (el) => {
    assert.ok(el, 'checkbox does not exist');
    const onChange = reactProps(el).onChange;
    assert.ok(onChange, 'that checkbox has no onChange');
    await act(async () => { onChange({ target: { checked: true } }); });
    await settle();
  };
  return { doc: win.document, win, host, sent, click, type, check, settle,
    text: () => host.textContent };
}

/** The default router: the map on GET, one preview, and a successful save. */
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

async function openEditor(m, category) {
  await m.click(q(m.doc, '[data-hw-edit-binding="' + category + '"]'));
  assert.ok(q(m.doc, '[data-hw-editor="binding"]'),
    'the binding editor did not open for ' + category);
}

// ═══════════════════════════════ 1. a PICKER, never an id field

test('the node picker offers Weedmaps’ real tree and no way to type an id', async () => {
  const m = await mount(router({ map: payload([DEALS]) }));
  await openEditor(m, 'Deals');

  const nodes = qa(m.doc, '[data-hw-node]').map((b) => b.getAttribute('data-hw-node'));
  // Every node in the payload's tree, parents and children alike.
  TREE.forEach((n) => assert.ok(nodes.includes(String(n.id)),
    'node ' + n.id + ' (' + n.name + ') is not offered by the picker'));

  // The child must be shown UNDER its parent with both ids visible — picking
  // the wrong root is the bug already live on this instance.
  const cart = q(m.doc, '[data-hw-node="193"]');
  assert.match(cart.textContent, /Cartridge/);
  assert.match(cart.textContent, /\[193\]/);

  // AND THERE MUST BE NO FREE-TEXT ID FIELD. The only text input inside the
  // editor is the picker's filter and the confirmation echo; neither may be a
  // way to name a node the tree does not contain.
  const editor = q(m.doc, '[data-hw-editor="binding"]');
  const inputs = [...editor.querySelectorAll('input')]
    .filter((i) => i.type !== 'checkbox');
  const named = inputs.map((i) => i.getAttribute('data-hw-picker-filter') ? 'filter'
    : i.getAttribute('data-hw-echo') ? 'echo' : 'UNKNOWN INPUT: ' + i.outerHTML);
  assert.deepEqual(named.filter((n) => n.startsWith('UNKNOWN')), [],
    'an unexplained text input in the binding editor is how an id field comes back');
});

test('filtering the picker narrows Weedmaps’ tree and never invents a node', async () => {
  const m = await mount(router({ map: payload([DEALS]) }));
  await openEditor(m, 'Deals');
  await m.type(q(m.doc, '[data-hw-picker-filter]'), 'cartridge');
  const nodes = qa(m.doc, '[data-hw-node]').map((b) => b.getAttribute('data-hw-node'));
  assert.ok(nodes.includes('193'), 'the matching node must survive the filter');
  assert.ok(!nodes.includes('2'), 'a non-matching node must be filtered out');

  await m.type(q(m.doc, '[data-hw-picker-filter]'), 'zzzz');
  assert.equal(qa(m.doc, '[data-hw-node]').length, 0);
  assert.match(q(m.doc, '[data-hw-picker]').textContent,
    /statement about their tree, not about ours/i,
    'an empty filter result must not read as "we have no categories"');
});

// ═══════════════════════════════ 2. the preview gates the save

test('the save is refused until the operator echoes the exact count shown', async () => {
  const m = await mount(router({ map: payload([DEALS]), pv: preview({ products_affected: 3 }) }));
  await openEditor(m, 'Deals');
  await m.click(q(m.doc, '[data-hw-node="2"]'));

  assert.match(q(m.doc, '[data-hw-preview-sentence]').textContent,
    /Binds 3 product rows under Deals to Flower \[2\]/,
    'the preview sentence must be the server’s, printed verbatim');

  const save = () => btnByText(m.doc, /Bind it/);
  assert.equal(save().getAttribute('data-disabled'), '1',
    'the save must start disabled — nothing has been confirmed');

  await m.type(q(m.doc, '[data-hw-echo]'), '2');
  assert.equal(save().getAttribute('data-disabled'), '1',
    'a WRONG echo must not enable the save');
  assert.equal(m.sent.length, 0, 'nothing may have been posted yet');

  await m.type(q(m.doc, '[data-hw-echo]'), '3');
  assert.equal(save().getAttribute('data-disabled'), '0',
    'the matching echo must enable the save');

  await m.click(save());
  assert.equal(m.sent.length, 1, 'exactly one write');
  assert.equal(m.sent[0].path, ROUTE + '/bind');
  assert.deepEqual(m.sent[0].body,
    { category: 'Deals', node: 2, confirm_products: 3 },
    'the confirmed number must travel with the write');
});

test('the map the screen shows after a save is the one the SERVER returned', async () => {
  const after = payload([row('Deals', {
    state: 'RESOLVES', wm_ids: [2], wm_path: 'Flower [2]',
    binding_source: 'explicit', binding: { node_id: 2, actor: 'jt@hyperwolf.com', at_iso: '2026-08-27T00:00:00Z' },
    name_match_ids: [], product_count: 1
  })]);
  const m = await mount(router({
    map: payload([DEALS]), pv: preview({ products_affected: 1 }),
    save: () => [200, { result: { ok: true }, map: after }]
  }));
  await openEditor(m, 'Deals');
  await m.click(q(m.doc, '[data-hw-node="2"]'));
  await m.type(q(m.doc, '[data-hw-echo]'), '1');
  await m.click(btnByText(m.doc, /Bind it/));

  const src = q(m.doc, '[data-hw-binding-source]');
  assert.equal(src.getAttribute('data-hw-binding-source'), 'explicit');
  assert.match(src.textContent, /picked by jt@hyperwolf\.com/,
    'the row must show who picked it, from the server’s payload');
});

// ═══════════════════════ 3. an UNKNOWN count can never be typed as a number

test('an unreadable catalog offers no number to type, and confirms null', async () => {
  const m = await mount(router({
    map: payload([DEALS]),
    pv: preview({ products_affected: null, products_known: false,
      catalog_error: 'catalog unavailable: no such table: products',
      sentence: 'Binds an unknown number of product rows under Deals to Flower [2].' })
  }));
  await openEditor(m, 'Deals');
  await m.click(q(m.doc, '[data-hw-node="2"]'));

  assert.equal(q(m.doc, '[data-hw-echo]'), null,
    'there must be NO number field when the count is unknown — a 0 typed there ' +
    'and a real 0 would reach the server as the same request');
  const panel = q(m.doc, '[data-hw-confirm-unknown]');
  assert.ok(panel, 'the unknown state must have its own confirmation control');
  assert.match(panel.textContent, /UNKNOWN/);
  assert.match(panel.textContent, /not zero/i);
  assert.match(panel.textContent, /no such table: products/,
    'the reason the catalog could not be read must be on screen');
  assert.doesNotMatch(panel.textContent, /\b0\b/,
    'an unknown must not print a zero anywhere in its own panel');

  const save = () => btnByText(m.doc, /Bind it/);
  assert.equal(save().getAttribute('data-disabled'), '1');
  await m.check(q(m.doc, '[data-hw-echo-unknown]'));
  assert.equal(save().getAttribute('data-disabled'), '0');
  await m.click(save());
  assert.equal(m.sent[0].body.confirm_products, null,
    'the write must carry a literal null, not 0 and not an absent field');
  assert.ok('confirm_products' in m.sent[0].body,
    'the field must be PRESENT and null — an absent field is a third thing ' +
    'the server refuses as confirm_required');
});

// ═══════════════════════════════ 4. a refusal is not a crash

test('a 409 refusal renders as a named refusal, not as a breakage', async () => {
  const m = await mount(router({
    map: payload([DEALS]), pv: preview({ products_affected: 3 }),
    save: () => [409, {
      code: 'confirm_mismatch',
      error: 'confirm_products=3 does not match the 5 product row(s) this would affect right now.',
      blocked: 5
    }]
  }));
  await openEditor(m, 'Deals');
  await m.click(q(m.doc, '[data-hw-node="2"]'));
  await m.type(q(m.doc, '[data-hw-echo]'), '3');
  await m.click(btnByText(m.doc, /Bind it/));

  const ref = q(m.doc, '[data-hw-server-refusal="confirm_mismatch"]');
  assert.ok(ref, 'the refusal must be rendered with its machine code');
  assert.match(ref.textContent, /does not match the 5 product row/,
    'the server’s sentence must be shown to the person, verbatim');
  assert.match(ref.textContent, /Nothing was written/i,
    'a refusal must say the write did not happen');
  assert.equal(ref.getAttribute('data-stub'), null);
  assert.equal([...ref.querySelectorAll('[data-tone]')].map((e) => e.getAttribute('data-tone'))[0],
    'warn', 'a refusal is a correct outcome and must not wear the error tone');
});

test('a preview that already knows the save would be refused offers no save', async () => {
  const m = await mount(router({
    map: payload([DEALS]),
    pv: preview({
      would_refuse: {
        code: 'no_such_node',
        error: 'Weedmaps node 2 is not in the tree this deployment resolves against (94 nodes).'
      }
    })
  }));
  await openEditor(m, 'Deals');
  await m.click(q(m.doc, '[data-hw-node="2"]'));

  assert.ok(q(m.doc, '[data-hw-refusal="no_such_node"]'));
  assert.equal(btnByText(m.doc, /Bind it/), undefined,
    'a button that discovers on submit that it could never work is worse than no button');
  assert.equal(q(m.doc, '[data-hw-echo]'), null);
  assert.match(q(m.doc, '[data-hw-refusal="no_such_node"]').textContent,
    /refusal, not a failure/i);
});

// ═══════════════════════════════ 5. aliases: add, and refuse a collision

test('adding a spelling previews it, then posts the confirmed count', async () => {
  const m = await mount(router({
    map: payload([row('Pre Roll')]),
    pv: preview({ op: 'alias', subject: 'Pre-rollz', products_affected: 4,
      to_ids: [185], to_path: 'Pre Roll [185]',
      sentence: '4 product rows spelled like \'Pre-rollz\' would be bound to Pre Roll [185].' })
  }));
  await m.type(q(m.doc, '[data-hw-alias-input]'), 'Pre-rollz');
  await m.click(q(m.doc, '[data-hw-alias-add]'));

  assert.match(q(m.doc, '[data-hw-preview="alias"]').textContent,
    /4 product rows spelled like 'Pre-rollz'/);
  const save = () => btnByText(m.doc, /Add the alias/);
  assert.equal(save().getAttribute('data-disabled'), '1');
  await m.type(q(m.doc, '[data-hw-echo]'), '4');
  await m.click(save());
  assert.equal(m.sent[0].path, ROUTE + '/alias');
  assert.equal(m.sent[0].body.alias, 'Pre-rollz');
  assert.equal(m.sent[0].body.confirm_products, 4);
});

test('a colliding alias is refused BY NAME before anything is sent', async () => {
  const m = await mount(router({
    map: payload([row('Flower')]),
    pv: preview({ op: 'alias', subject: 'vapes', products_affected: 2,
      would_refuse: {
        code: 'builtin_alias',
        error: "the built-in alias table already folds 'vapes' to Vape Pens (taxonomy.CATEGORY_ALIASES)."
      } })
  }));
  await m.type(q(m.doc, '[data-hw-alias-input]'), 'vapes');
  await m.click(q(m.doc, '[data-hw-alias-add]'));

  const ref = q(m.doc, '[data-hw-refusal="builtin_alias"]');
  assert.ok(ref, 'the collision must be named on screen');
  assert.match(ref.textContent, /already folds 'vapes' to Vape Pens/,
    'the refusal must say WHAT it collided with, never just that it failed');
  assert.equal(btnByText(m.doc, /Add the alias/), undefined,
    'a save that would be refused must not be offered');
  assert.equal(m.sent.length, 0, 'nothing may be posted');
});

test('a built-in alias carries no edit control; an operator one does', async () => {
  const map = payload([row('Vape Pens', {
    aliases: [
      alias('Vape Pens', { is_canonical: true, in_use: true }),
      alias('vapes', { source: 'code', editable: false, in_use: true, products: 2 }),
      alias('vapez', { source: 'operator', editable: true, added_by: 'jt@hyperwolf.com' })
    ], alias_count: 2
  })], {
    editor: {
      error: null,
      top_level: ['Flower', 'Vape Pens'],
      alias_overrides: [{ alias: 'vapez', alias_key: 'vapez', canonical: 'Vape Pens',
        actor: 'jt@hyperwolf.com', at_iso: '2026-08-27T00:00:00Z', note: null,
        source: 'operator', live: true, dead_reason: null, shadowed_by: null }],
      bindings: {}, routes: {}, no_suppress_state: 'allowed'
    }
  });
  const m = await mount(router({ map }));
  assert.ok(q(m.doc, '[data-hw-operator-alias="vapez"]'),
    'an operator alias must be listed as editable');
  assert.ok(q(m.doc, '[data-hw-alias-remove="vapez"]'));
  assert.ok(q(m.doc, '[data-hw-repoint="vapez"]'));
  // The built-in must NOT get one. It lives in code because live rows and live
  // SKU assignments on a persistent disk carry that spelling.
  assert.equal(q(m.doc, '[data-hw-operator-alias="vapes"]'), null);
  assert.equal(q(m.doc, '[data-hw-alias-remove="vapes"]'), null);
});

test('an operator alias the code table later shadowed says it does nothing', async () => {
  const map = payload([row('Flower')], {
    editor: {
      error: null, top_level: ['Flower', 'Vape Pens'],
      alias_overrides: [{ alias: 'vapes', alias_key: 'vapes', canonical: 'Flower',
        actor: 'jt@hyperwolf.com', at_iso: '2026-08-27T00:00:00Z', note: null,
        source: 'operator', live: false, dead_reason: 'shadowed_by_code',
        shadowed_by: 'Vape Pens' }],
      bindings: {}, routes: {}, no_suppress_state: 'allowed'
    }
  });
  const m = await mount(router({ map }));
  const el = q(m.doc, '[data-hw-operator-alias="vapes"]');
  assert.match(el.textContent, /no longer does anything/i,
    'a dead row must say it is dead — dead is the state that renders as fine');
  assert.match(el.textContent, /Vape Pens/,
    'it must name what shadowed it');
});

test('the alias editor’s own rows failing to load is not "no aliases exist"', async () => {
  const map = payload([row('Flower')], {
    editor: { error: 'category_edit unavailable: no such table: category_alias_map',
      top_level: [], alias_overrides: [], bindings: {}, routes: {} }
  });
  const m = await mount(router({ map }));
  assert.match(m.text(), /could not be read/i);
  assert.match(m.text(), /not the same as .none exist/i,
    'an unreadable editor must not render as an empty one');
  assert.equal(q(m.doc, '[data-hw-alias-input]'), null,
    'no add control may be offered when its own state is unknown');
});

// ═══════════════════ 6. an unbound category is a resting state, not a chore

test('opening the editor on an unbound category says you do not have to bind it', async () => {
  const m = await mount(router({ map: payload([DEALS]) }));
  await openEditor(m, 'Deals');
  const rest = q(m.doc, '[data-hw-resting]');
  assert.ok(rest, 'an unbound category must be told it is allowed to stay unbound');
  assert.match(rest.textContent, /do not have to bind this/i);
  assert.match(rest.textContent, /nothing is waiting on you/i);

  // AND THERE IS NO CEREMONY. The owner did not ask for a control that records
  // a decision NOT to map something, and adding one would turn "that shouldn't
  // be a problem" into a chore. If one ever appears, this fails.
  const editor = q(m.doc, '[data-hw-editor="binding"]');
  assert.doesNotMatch(editor.textContent, /do not publish/i);
  assert.doesNotMatch(editor.textContent, /acknowledge/i);
  assert.doesNotMatch(editor.textContent, /mark as (reviewed|decided)/i);
});

test('a name match and an operator’s pick are not shown as the same fact', async () => {
  const m = await mount(router({
    map: payload([
      row('Flower'),
      row('Edibles', { binding_source: 'explicit', wm_ids: [5], wm_path: 'Edibles [5]',
        binding: { node_id: 5, actor: 'jt@hyperwolf.com', at_iso: '2026-08-27T00:00:00Z' },
        name_match_ids: [5], name_match_path: 'Edibles [5]' })
    ])
  }));
  const sources = qa(m.doc, '[data-hw-binding-source]')
    .map((e) => [e.getAttribute('data-hw-binding-source'), e.textContent]);
  const byKind = Object.fromEntries(sources);
  assert.ok('name_match' in byKind && 'explicit' in byKind,
    'both binding sources must be present: ' + JSON.stringify(sources));
  assert.match(byKind.name_match, /matched by name, not chosen/i);
  assert.match(byKind.explicit, /picked by jt@hyperwolf\.com/);
  assert.notEqual(byKind.name_match, byKind.explicit,
    'a decision nobody made must not read like one somebody did');
});

test('a binding whose node has left the tree is neither RESOLVES nor NO WM NODE', async () => {
  const broken = row('Wellness', {
    state: 'BINDING_BROKEN', wm_ids: [], wm_nodes: [], wm_path: null,
    binding_source: 'explicit_missing_node',
    binding: { node_id: 9999, actor: 'jt@hyperwolf.com', at_iso: '2026-08-27T00:00:00Z' },
    name_match_ids: [467], name_match_path: 'Wellness [467]', product_count: 2
  });
  const m = await mount(router({ map: payload([broken, DEALS]) }));
  const cell = q(m.doc, '[data-hw-cat="Wellness"]');
  assert.equal(cell.getAttribute('data-hw-cat-state'), 'BINDING_BROKEN');
  assert.match(cell.textContent, /BINDING BROKEN/);
  const tone = [...cell.querySelectorAll('[data-tone]')].map((e) => e.getAttribute('data-tone'));
  assert.ok(tone.includes('warn'),
    'a pick that has stopped applying IS work somebody has to do: ' + JSON.stringify(tone));
  const dealsTone = [...q(m.doc, '[data-hw-cat="Deals"]').querySelectorAll('[data-tone]')]
    .map((e) => e.getAttribute('data-tone'));
  assert.notDeepEqual(tone, dealsTone,
    'a broken binding and an allowed resting state must not render alike');
  assert.match(q(m.doc, '[data-hw-binding-source="explicit_missing_node"]').textContent,
    /picked node 9999 is not in the tree/);
});

// ═══════════════════ 7. the two causes of "uncategorised" stay apart

test('a spelling nobody chose and a category Weedmaps lacks are counted apart', async () => {
  const body = payload([DEALS, row('Flower')], {
    uncategorised_skus: [
      { sku: 'HW-DEAL-1', spelling: 'Deals', canonical: 'Deals',
        kind: 'no_wm_node', why: "Weedmaps has no node named 'Deals'" },
      { sku: 'HW-ODD-1', spelling: 'Buds', canonical: null,
        kind: 'unfoldable', why: 'no alias accepts this spelling' }
    ]
  });
  body.counts.products_uncategorised = 2;
  const m = await mount(router({ map: body }));
  const t = m.text();

  assert.match(t, /1 SKU goes live on Weedmaps with no category, and nobody chose that/,
    'the FIXABLE kind must be counted on its own — 1, not 2');
  const resting = q(m.doc, '[data-hw-resting-uncategorised]');
  assert.ok(resting, 'the allowed kind must be rendered in its own block');
  assert.match(resting.textContent, /HW-DEAL-1/);
  assert.match(resting.textContent, /which is allowed/i);
  assert.match(resting.textContent, /Nothing here is waiting on anybody/i);
  assert.doesNotMatch(resting.textContent, /HW-ODD-1/,
    'the fixable SKU must not be filed under the allowed block');
  const restTone = [...resting.querySelectorAll('[data-tone]')]
    .map((e) => e.getAttribute('data-tone'));
  assert.ok(!restTone.includes('bad'),
    'the allowed kind must not wear the alarm tone: ' + JSON.stringify(restTone));
});

// ═══════════════════════════ 8. MUTATION — prove the gate is the defence

test('MUTATION: enabling the save without a matching echo breaks these tests', async () => {
  // The gate is one expression: `ready` is false unless the typed number equals
  // the number the preview showed. Patch it to `true` and the save must become
  // pressable with nothing typed — if it does not, the assertions above are
  // passing for some reason other than the gate they claim to test.
  const m = await mount(router({ map: payload([DEALS]), pv: preview({ products_affected: 3 }) }), {
    // Patched against the COMPILED source: esbuild flattens the nested ternary,
    // so a patch written against the .jsx text matches nothing. mount() asserts
    // the patch actually changed something, which is what caught that.
    patch: (src) => src.replace(
      'echo !== "" && Number(echo) === Number(n)',
      '(true)')
  });
  await openEditor(m, 'Deals');
  await m.click(q(m.doc, '[data-hw-node="2"]'));
  assert.equal(btnByText(m.doc, /Bind it/).getAttribute('data-disabled'), '0',
    'the mutation should have opened the gate with nothing confirmed; it did ' +
    'not, so `ready` is not what is actually gating the button — find out what is');
});

test('MUTATION: rendering an unknown count as a typable number breaks these tests', async () => {
  // The unknown branch is `products_known !== false`. Force it true and the
  // screen must offer a number field for a count nobody could compute — which
  // is exactly how an absence and an unknown reach the server identically.
  const m = await mount(router({
    map: payload([DEALS]),
    pv: preview({ products_affected: null, products_known: false })
  }), {
    patch: (src) => src.replace(
      'const known = pv.products_known !== false;',
      'const known = true;')
  });
  await openEditor(m, 'Deals');
  await m.click(q(m.doc, '[data-hw-node="2"]'));
  assert.ok(q(m.doc, '[data-hw-echo]'),
    'the mutation should have produced a number field for an unknown count; it ' +
    'did not, so the unknown branch is not what is suppressing it');
  assert.equal(q(m.doc, '[data-hw-confirm-unknown]'), null);
});
