/* ── A bind that cannot succeed must not be offered ─────────────────────────
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The owner screenshotted the brand screen showing this, verbatim:
 *
 *     Cann  ->  wm_brand_id 11200 · tier 1 · 1.0000 · exact     [Bind to Cann]
 *
 * and pressing the button answered:
 *
 *     approve - HTTP 409. no brand 'cann' in the catalogue. The roster is
 *     built from the brands that appear on products, so a brand with no
 *     product cannot be bound.
 *
 * BOTH HALVES WERE CORRECT AND THE SCREEN STILL LIED. Weedmaps brand 11200
 * really is named 'Cann' (verified in qa/wm_brand_index.json, 3,255 rows), so
 * tier 1 / 1.0000 / exact is the right verdict -- an EXACT hit on a real name,
 * not a truncation of a longer one.
 *
 * CORRECTED: an earlier draft of this header argued the point by claiming
 * 'Cannabiotix' is absent from the WM index. It is present, as 'CBX: Cannabiotix'
 * (id 1505). The conclusion is unchanged -- an exact 1.0000 on 'Cann' outranks any
 * fuzzy match to a prefixed name -- but the premise was false, and a false premise
 * propping up a true conclusion is exactly the shape that gets inherited by the
 * next reader as established fact. And no product in the catalogue
 * carries brand 'cann' (verified read-only against the repo DB: 0 products;
 * the nearest names are 'cannabiotix' at 28 and 'connected cannabis co.' at 10),
 * so the 409 is the right refusal. The defect was the button BETWEEN them.
 *
 * The rows on this screen come from three sources and only two of them can be
 * bound. shared/brands.js is a POS design roster of 16 names; the bind
 * precondition is the roster wmdemo/brands.py derives FROM PRODUCTS. Measured
 * 2026-08-27 against the live route, EIGHT of those sixteen carry no product —
 * Lowell Farms, Papa & Barkley, Cann, Connected, Select, Pax Labs, 710 Labs,
 * Cookies — and every one of them offered a live button.
 *
 * That number was NINE in the first draft of this file, because the sweep was
 * run over shared/brands.js's `key` field ('kiva') instead of the folded
 * DISPLAY NAME the screen actually keys rows by ('kivaconfections'). Kiva
 * Confections is bindable and was briefly libelled as not. Recorded rather
 * than quietly corrected: the wrong key silently returns a real-looking answer
 * for a brand nobody has, which is the same failure this file is about.
 *
 * WHAT IS ASSERTED, AND WHY IT IS THREE THINGS AND NOT ONE
 * -------------------------------------------------------
 *  1. The button is HELD and says why, and the reason is the server's sentence
 *     rather than one this screen invented.
 *  2. The MATCH IS STILL SHOWN as correct. Hiding the 1.0000 to make the
 *     refusal tidy would replace one lie with another: the operator needs to
 *     know Weedmaps has this brand and we do not.
 *  3. A brand that CAN be bound is untouched. A guard that disables everything
 *     passes test 1 and is useless, and `bindable` is read STRICTLY as
 *     `=== false` so that a null (free-text search) or a missing field (an
 *     older server) never disables a bind that works — turning an absence into
 *     a verdict is the bug this whole change is about, and it must not be
 *     re-introduced pointing the other way.
 *
 * Reject is gated too, and that is not padding. Measured on a scratch DB:
 * POST /api/brands/reject {brand:'cann'} answers HTTP 200 with result:null —
 * an UPDATE that matched no row. The footer keys its green "Recorded." banner
 * off r.ok, so an unstored decision reads as a stored one. That is worse than
 * the 409, because nothing tells the operator.
 *
 * FIXTURES ARE REAL. Both candidate payloads below were captured from
 * GET /api/brands/candidates against a scratch copy of the repo database
 * (sqlite3.backup, never cp), on this agent's own port 8931 with
 * WM_API_BASE=http://127.0.0.1:1. No Weedmaps traffic, and the owner's 8787
 * was never touched.
 *
 * HOW IT TESTS: jsdom + real react-dom, so useEffect runs and the screen's own
 * fetch path is exercised. Nothing on disk and nothing on any port is touched.
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
const SCREEN = path.join(ROOT, 'pos', 'screen-brands.jsx');

// ------------------------------------------------------------- fixtures

/** GET /api/brands/candidates?brand=cann — captured verbatim, trimmed to the
 *  fields this screen reads. our_name is null because no row exists. */
const CAND_CANN = {
  brand: 'cann', brand_key: 'cann', query: 'Cann', our_name: null,
  bindable: false,
  bind_blocked: {
    code: 'no_product_carries_brand',
    reason: "no brand 'cann' in the catalogue. The roster is built from the " +
      'brands that appear on products, so a brand with no product cannot be ' +
      'bound. Add a product carrying that brand first.'
  },
  state: 'mapped', wm_brand_id: 11200, wm_name: 'Cann', confidence: 1.0,
  tier: 1, reason: 'exact', collision: [], runner_up: null,
  candidates: [{ id: 11200, name: 'Cann', claimed_by: null, wm_product_count: null }],
  total: 1, index_collisions: [], matcher: 'brands.candidates'
};

/** The same route for a brand that CAN be bound. Same shape, bindable true. */
const CAND_STIIIZY = {
  brand: 'stiiizy', brand_key: 'stiiizy', query: 'STIIIZY', our_name: 'STIIIZY',
  bindable: true, bind_blocked: null,
  state: 'unmapped', wm_brand_id: 3464, wm_name: 'STIIIZY', confidence: 1.0,
  tier: 1, reason: 'exact', collision: [], runner_up: null,
  candidates: [{ id: 3464, name: 'STIIIZY', claimed_by: null, wm_product_count: null }],
  total: 1, index_collisions: [], matcher: 'brands.candidates'
};

/** A server that predates `bindable`. The field is ABSENT, not false. */
const CAND_OLD_SERVER = (function () {
  const c = Object.assign({}, CAND_CANN);
  delete c.bindable;
  delete c.bind_blocked;
  return c;
})();

/** GET /api/brands with nothing stored and no evidence: every row on the
 *  screen then comes from shared/brands.js alone, which is precisely the
 *  situation that produced the button. */
const BRANDS_EMPTY = {
  source: 'wmdemo/brands.py', brands: [], evidence: { brands: [], by_evidence: {} },
  index_collisions: [], counts: {}, thresholds: { auto: 0.86, floor: 0.55 },
  blocked_skus: [], unbranded_skus: 0, products_with_no_brand_name: 0,
  wm_index: { ok: true, count: 3255 }, store: { available: true },
  store_view: 'store', note: ''
};

// ------------------------------------------------------------- the sandbox

const compiled = esbuild.transformSync(fs.readFileSync(SCREEN, 'utf8'), {
  loader: 'jsx', jsx: 'transform', target: 'es2020'
}).code;

/** Every palette member is a string, so a typo'd token is visible not blank. */
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
  // `disabled` is the whole subject of this file, so the stub must carry it
  // onto a real <button> and must not fire onClick when it is set — otherwise
  // the test would pass against a button that merely LOOKS held.
  win.PBtn = function PBtn(props) {
    return h('button', {
      'data-stub': 'pbtn', disabled: !!props.disabled,
      onClick: props.disabled ? undefined : props.onClick
    }, props.children);
  };
  win.Field = () => h('input', { 'data-stub': 'field', readOnly: true });
  win.KPI = function KPI(props) {
    return h('div', { 'data-stub': 'kpi', 'data-kpi': String(props.label) },
      String(props.label) + ' | ' + String(props.value));
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
  win.DataTable = function DataTable(props) {
    return h('div', { 'data-stub': 'table' }, (props.rows || []).map((r, i) =>
      h('div', { key: props.rowKey ? props.rowKey(r) : i, 'data-stub': 'row',
        'data-hw-key': String(r && r.key) },
      (props.columns || []).map((c, j) =>
        h('div', { key: j, 'data-stub': 'cell', 'data-col': String(c.label) },
          c.render ? c.render(r) : null)))));
  };
  win.BarMeter = function BarMeter(props) {
    return h('div', { 'data-stub': 'barmeter', 'data-value': String(props.value) });
  };
  win.IconBtn = function IconBtn(props) {
    return h('button', { 'data-stub': 'iconbtn', onClick: props.onClick },
      String(props.label || ''));
  };
  win.Tabs = function Tabs(props) {
    return h('div', { 'data-stub': 'tabs' }, (props.options || []).map(function (o, i) {
      return h('button', { key: i, 'data-stub': 'tab',
        onClick: function () { props.onChange(o.value); } }, String(o.label));
    }));
  };
  win.DevNote = function D(props) {
    return h('div', { 'data-stub': 'devnote', 'data-tone': props.tone }, props.children);
  };
  win.DevNoteP = passthrough('p', 'devnotep');
  win.DevNoteMono = passthrough('code', 'devnotemono');
}

/** The two design-roster names this file needs, in shared/brands.js's shape. */
const HW_BRANDS = {
  list: [
    { key: 'cann', id: 'v-cann', name: 'Cann', category: 'Beverage', posCats: ['Wellness'] },
    { key: 'stiiizy', id: 'v-stiiizy', name: 'STIIIZY', category: 'Vape', posCats: ['Vapes'] }
  ]
};

async function mount(candidatesFor, opts = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="r"></div></body></html>',
    { url: 'http://127.0.0.1:8931/' });
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
  win.HW_BRANDS = HW_BRANDS;
  win.HW = undefined;
  win.HW_MAPPING = undefined;

  const posted = [];
  win.fetch = (url, init) => {
    const p = String(url).replace('http://127.0.0.1:8931', '');
    if (init && String(init.method || '').toUpperCase() === 'POST') {
      posted.push(p);
      return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('{}') });
    }
    let body = { error: 'not found' }, code = 404;
    if (p.startsWith('/api/brands/candidates')) {
      const m = /[?&]brand=([^&]*)/.exec(p);
      body = candidatesFor(decodeURIComponent(m ? m[1] : '')); code = 200;
    } else if (p.startsWith('/api/brands/backfill')) {
      body = { would_bind_count: 0, held_back_count: 0, rows: [] }; code = 200;
    } else if (p.startsWith('/api/brands')) {
      body = BRANDS_EMPTY; code = 200;
    }
    return Promise.resolve({
      ok: code >= 200 && code < 300, status: code,
      text: () => Promise.resolve(JSON.stringify(body))
    });
  };

  let src = compiled;
  if (opts.patch) {
    const next = opts.patch(src);
    assert.notEqual(next, src, 'patch() did not change the compiled screen');
    src = next;
  }
  const NAMES = ['window', 'React', 'useP', 'Icon', 'Card', 'Eyebrow', 'Pill', 'PBtn',
    'Field', 'KPI', 'SkeletonRows', 'EmptyState', 'ErrorState', 'SectionHead',
    'DataTable', 'DevNote', 'DevNoteP', 'DevNoteMono', 'BarMeter', 'IconBtn',
    'Tabs', 'fetch'];
  // eslint-disable-next-line no-new-func
  new win.Function(NAMES.join(','), src)
    .apply(null, NAMES.map((n) => (n === 'window' ? win : win[n])));
  assert.equal(typeof win.BrandsScreen, 'function',
    'the screen file must export window.BrandsScreen');

  const host = win.document.getElementById('r');
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(win.BrandsScreen)); });
  await settle();
  return { doc: win.document, win, host, posted, root };

  async function settle() {
    for (let i = 0; i < 8; i++) {
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    }
  }
}

/** Open the picker for one brand row by clicking its own Map button. */
async function openPicker(ctx, brandKey) {
  const row = ctx.doc.querySelector('[data-hw-key="' + brandKey + '"]');
  assert.ok(row, 'no row rendered for ' + brandKey);
  const btns = [...row.querySelectorAll('button')]
    .filter((b) => /^(Map|Review)$/.test(b.textContent.trim()));
  assert.equal(btns.length, 1, 'expected exactly one Map/Review button in the ' + brandKey + ' row');
  await act(async () => { btns[0].click(); });
  for (let i = 0; i < 8; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
}

/** Click the proposal's "Pick this", so the bind button is in the state the
 *  owner photographed. Picking is not a write and is never gated. */
async function pickProposal(ctx) {
  const b = [...ctx.doc.querySelectorAll('button')]
    .filter((x) => /^Pick this$/.test(x.textContent.trim()));
  assert.equal(b.length, 1, 'the matcher verdict must offer exactly one "Pick this"');
  await act(async () => { b[0].click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

/** The picker's footer buttons, by their visible label. */
function footerBtn(doc, re) {
  const b = [...doc.querySelectorAll('button')].filter((x) => re.test(x.textContent));
  assert.ok(b.length, 'no button matching ' + re);
  return b[b.length - 1];
}

const serveBoth = (k) => (k === 'cann' ? CAND_CANN : CAND_STIIIZY);

// ══════════════════════════════════ 1. the button that started this

test('a brand no product carries is not offered a bind', async () => {
  const ctx = await mount(serveBoth);
  await openPicker(ctx, 'cann');

  // PICK THE PROPOSAL FIRST. This matters, and a mutation proof is what found
  // it: without this click the bind button is disabled anyway because nothing
  // is picked, so `disabled === true` passed even with the gate removed --
  // a green light for the wrong reason. The owner's screenshot showed the
  // button reading "Bind to Cann", which is the PICKED state, so that is the
  // state this must assert against.
  await pickProposal(ctx);
  const txt = ctx.host.textContent;

  // The primary action is HELD, and its own label carries the reason — a
  // disabled button with the old hopeful text is a button people keep pressing.
  const bind = footerBtn(ctx.doc, /Cannot bind|Bind to|Pick a brand to bind/);
  assert.equal(bind.disabled, true, 'the bind button must be disabled for cann');
  assert.match(bind.textContent, /Cannot bind/,
    'the held button must say it cannot bind, not still offer to');

  // The server's sentence, not one this screen wrote. If these ever drift the
  // screen and the route are explaining one invariant two ways.
  assert.ok(txt.includes(CAND_CANN.bind_blocked.reason),
    'the picker must show the server\'s own refusal sentence verbatim');

  // Reject is held for the same reason and the screen says why, because a
  // 200-with-result-null renders as "Recorded." and is the worse failure.
  const rej = footerBtn(ctx.doc, /None of these is my brand/);
  assert.equal(rej.disabled, true, 'reject writes to the same absent row and must be held');
  assert.match(txt, /HTTP 200 having\s+changed nothing/,
    'the footer must name the silent no-op reject would perform');

  // AND THE MATCH IS STILL SHOWN. Hiding a correct 1.0000 to tidy the refusal
  // would swap one lie for another: Weedmaps HAS this brand, we do not.
  assert.ok(txt.includes('11200'), 'the correct wm_brand_id must still be shown');
  assert.ok(txt.includes('1.0000'), 'the correct confidence must still be shown');
  assert.match(txt, /match above is not wrong/,
    'the screen must say the match is right and the gap is on our side');
});

// ══════════════════════════════════ 2. clicking it cannot post

test('the held bind cannot fire a write even if clicked', async () => {
  const ctx = await mount(serveBoth);
  await openPicker(ctx, 'cann');
  await pickProposal(ctx);
  const bind = footerBtn(ctx.doc, /Cannot bind|Bind to/);
  await act(async () => { bind.click(); });
  assert.deepEqual(ctx.posted, [],
    'a held bind must not reach POST /api/brands/approve at all');
});

// ══════════════════════════════════ 3. a bindable brand is untouched

test('a brand our products carry still binds normally', async () => {
  const ctx = await mount(serveBoth);
  await openPicker(ctx, 'stiiizy');
  const txt = ctx.host.textContent;

  assert.ok(!txt.includes('Nothing here can be bound'),
    'a bindable brand must not get the refusal card');
  const rej = footerBtn(ctx.doc, /None of these is my brand/);
  assert.equal(rej.disabled, false, 'reject must stay live for a bindable brand');

  // Pick the proposal, then the bind must be live and must post.
  await pickProposal(ctx);
  const bind = footerBtn(ctx.doc, /Bind to|Cannot bind|Pick a brand to bind/);
  assert.equal(bind.disabled, false, 'a bindable brand must keep a live bind button');
  assert.match(bind.textContent, /Bind to STIIIZY/);
  await act(async () => { bind.click(); });
  for (let i = 0; i < 6; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
  assert.deepEqual(ctx.posted, ['/api/brands/approve'],
    'a live bind must still reach the approve route');
});

// ══════════════════════════════════ 4. absence is not a refusal

test('a server that does not send `bindable` leaves the bind live', async () => {
  // THE GUARD ON THE GUARD. `bindable` missing means the question was never
  // asked. Reading that as "cannot bind" would disable a working action off an
  // absence — the same defect as the original, aimed the other way — and it
  // would strand every operator the moment the UI shipped ahead of the API.
  const ctx = await mount(() => CAND_OLD_SERVER);
  await openPicker(ctx, 'cann');
  const txt = ctx.host.textContent;
  assert.ok(!txt.includes('Nothing here can be bound'),
    'a missing `bindable` must not be rendered as a refusal');
  const rej = footerBtn(ctx.doc, /None of these is my brand/);
  assert.equal(rej.disabled, false,
    'a missing `bindable` must not hold the reject button');
});
