/* ── The five states the publish gate must never let collapse ───────────────
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * wmdemo/engine.py:publish_decision() FAILS OPEN BY DESIGN — its own docstring
 * says so in capitals. Every path that cannot enforce the gate returns the
 * pre-gate values and reports gate='unconfigured'. The consequence for a
 * screen is nasty and easy to get backwards:
 *
 *   an UNCONFIGURED gate and a GENUINE out-of-stock both produce ABSENCE.
 *
 * Absence is not something a UI can render by leaving a gap, so four states
 * have to be told apart on purpose:
 *
 *   1. unconfigured           fails open  -> THE PRODUCT IS PUBLISHING
 *   2. staged (bound, not armed)          -> publishing, identical to (1)
 *   3. enforced + blocked_no_stock        -> dark, and stock is the reason
 *   4. enforced + blocked_no_price        -> dark, and price is the reason
 *   5. enforced + declared:false          -> dark, and NOBODY DECIDED IT
 *
 * (5) is not in the brief and was found by re-deriving the model: gate_status
 * computes `state` from `enf`, and _enforced() returns TRUE for an ABSENT
 * channel_gate row, so set_channel_map() — the primitive, not the operator
 * surface — arms the gate on contact. It renders on the same evidence as (3)
 * and (4) and differs only on `declared`, which is precisely the field this
 * screen exists to never drop.
 *
 * (1) is the one that attracts a warning badge, and a warning badge on (1) is
 * exactly backwards: it reads as a problem at the moment the listing is live
 * and selling. (3) and (4) are the pair the first cut of the screen actually
 * collapsed — an enforced card rendered no per-sku measurement at all, so both
 * came out as one green "enforced — live" pill and nothing said what was dark
 * or why.
 *
 * HOW IT TESTS
 * ------------
 * jsdom + the real react-dom, so useEffect runs and the screen's own
 * auto-measure path is what gets exercised — not a hand-called render of an
 * internal component. `fetch` is stubbed per scenario; nothing on disk and
 * nothing on any port is touched. The atoms are stubbed as plain elements that
 * keep their text and expose their tone in a data attribute, because what is
 * asserted here is WHAT THE CARD SAYS and WHAT COLOUR IT SAYS IT IN.
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
const SCREEN = path.join(ROOT, 'pos', 'screen-publish-gate.jsx');

const MENU = 342170487;
const CHANNELS = ['pickup', 'express', 'scheduled'];

// ---------------------------------------------------------------- fixtures

function gateRow(channel, over) {
  return Object.assign({
    wm_menu_id: MENU, channel, state: 'unbound', enforced: false,
    switch: true, switch_source: 'default', declared: false,
    bindings: [], active_bindings: [], inactive_bindings: [],
    stale_declaration: false, updated_at: null, actor: null, note: null,
    mode: 'kits', channel_for_mode: 'express'
  }, over || {});
}

const UNCONFIGURED = gateRow('pickup');

const STAGED = gateRow('pickup', {
  state: 'staged', switch: false, switch_source: 'declared', declared: true,
  bindings: ['corona-safe'], active_bindings: ['corona-safe'],
  updated_at: 1787780000, actor: 'admin@hyperwolf.com'
});

const ENFORCED = gateRow('pickup', {
  state: 'enforced', enforced: true, switch: true, switch_source: 'declared',
  declared: true, bindings: ['corona-safe'], active_bindings: ['corona-safe'],
  updated_at: 1787780000, actor: 'admin@hyperwolf.com'
});

// THE FIFTH STATE, and it is (3)/(4) with nobody behind it.
//
// gate_status computes `state` from `enf`, and inventory._enforced() returns
// TRUE for an ABSENT channel_gate row. set_channel_map() — the primitive every
// seed, probe and legacy caller uses — writes no row, so it arms the gate on
// contact. Re-derived in-process on a scratch COPY of the production database
// (never the repo file):
//
//   set_channel_map(<menu>, 'pickup', 'wf3-safe')
//     -> {"state": "enforced", "switch": true, "switch_source": "default",
//         "declared": false, "actor": null, "updated_at": null}
//     -> locations_for(<menu>, 'pickup') == ['wf3-safe']   (the gate is ON)
//
// So this is a LIVE gate deciding what a real menu publishes, that no operator
// ever armed. It renders on the same evidence as ENFORCED — the same bindings,
// the same blocked lists — and if the screen prints it as the confident green
// "enforced — live" it has credited a decision to nobody, on a screen whose
// whole argument is that arming is a deliberate act.
const ENFORCED_UNDECLARED = gateRow('pickup', {
  state: 'enforced', enforced: true, switch: true, switch_source: 'default',
  declared: false, bindings: ['corona-safe'], active_bindings: ['corona-safe'],
  updated_at: null, actor: null
});

// arm_preview()'s shape. no_price and no_stock are separate arrays in the API;
// the screen must keep them separate on the way out too.
function previewBody(over) {
  return Object.assign({
    wm_menu_id: MENU, channel: 'pickup', bindings: ['corona-safe'],
    active_bindings: ['corona-safe'], inactive_bindings: [],
    already_enforced: true, skus_examined: 10,
    publishable: [{ sku: 'OK-1', price_cents: 1000, qty: 4, batch_id: 'b1' }],
    blocked_no_price: [], blocked_no_stock: [], blocked: 0
  }, over || {});
}

const NO_STOCK_ONLY = previewBody({
  blocked_no_stock: [
    { sku: 'HW-PR-1G', reason: 'no_stock: no in-stock batch in corona-safe' },
    { sku: 'HW-PR-2G', reason: 'no_stock: no in-stock batch in corona-safe' }
  ],
  blocked: 2
});

const NO_PRICE_ONLY = previewBody({
  blocked_no_price: [
    { sku: 'HW-PR-9G', reason: 'no_price: batch b7 has qty 6 and no usable price' }
  ],
  blocked: 1
});

// ------------------------------------------------------------- the sandbox

const compiled = esbuild.transformSync(fs.readFileSync(SCREEN, 'utf8'), {
  loader: 'jsx', jsx: 'transform', target: 'es2020'
}).code;

/**
 * The token names pos/tokens.jsx actually defines, read off the file.
 *
 * THE OLD COMMENT HERE CLAIMED A GUARANTEE IT DID NOT PROVIDE. The palette was
 * a bare Proxy returning 'tok-' + key for ANY key, and was labelled "so a typo'd
 * token is visible" — it is exactly the opposite: `P.surfaceX` came back as the
 * perfectly plausible string 'tok-surfaceX' and rendered without a murmur. A
 * house rule that tokens come from pos/tokens.jsx is only enforced if something
 * fails when they do not.
 *
 * Top-level keys only, by brace depth, so `hue.blue` and `cat.flower` do not
 * leak in as if they were palette members. `type` is handled separately because
 * the screen reads P.type.<step>.
 */
function tokenNames() {
  const src = fs.readFileSync(path.join(ROOT, 'pos', 'tokens.jsx'), 'utf8');
  const names = new Set();
  for (const objName of ['LIGHT', 'DARK', 'SHARED']) {
    const start = src.indexOf('const ' + objName + ' = {');
    assert.ok(start >= 0, 'pos/tokens.jsx no longer declares ' + objName);
    let i = src.indexOf('{', start), depth = 0, body = '';
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') { depth++; if (depth === 1) { continue; } }
      if (c === '}') { depth--; if (depth === 0) { break; } }
      body += depth === 1 ? c : ' ';        // blank out nested objects
    }
    // Strip strings so a colon inside 'rgba(...)' or a font stack is not a key.
    const flat = body.replace(/'[^']*'|"[^"]*"/g, "''");
    let m;
    const re = /([A-Za-z_][A-Za-z0-9_]*)\s*:/g;
    while ((m = re.exec(flat))) { names.add(m[1]); }
  }
  assert.ok(names.has('badSoft') && names.has('fontMono') && names.has('type'),
    'token extraction broke — it did not find tokens it must find');
  return names;
}

const TOKENS = tokenNames();
const TYPE_STEPS = new Set(['micro', 'meta', 'body', 'strong', 'title', 'h2', 'h1', 'numRow', 'numTotal']);

/** A palette that THROWS on a token pos/tokens.jsx does not define. */
function palette() {
  return new Proxy({}, {
    get(_t, k) {
      if (typeof k !== 'string') { return undefined; }
      if (k === 'type') {
        return new Proxy({}, {
          get: (_a, kk) => {
            if (typeof kk !== 'string') { return undefined; }
            if (!TYPE_STEPS.has(kk)) { throw new Error('P.type.' + kk + ' is not a step in pos/tokens.jsx'); }
            return 'sz-' + kk;
          }
        });
      }
      if (!TOKENS.has(k)) { throw new Error('P.' + k + ' is not a token in pos/tokens.jsx'); }
      return 'tok-' + k;
    }
  });
}

/**
 * Stub atoms. Each keeps its children and stamps its tone into data-tone, so a
 * test can assert both the sentence and the colour it is said in without
 * pulling in the real design system.
 */
function installAtoms(win) {
  const h = React.createElement;
  const passthrough = (tag, extra) => function Stub(props) {
    const { children } = props;
    return h(tag, Object.assign({
      'data-stub': extra || tag,
      'data-tone': props.kind || props.tone || undefined
    }), children);
  };
  win.React = React;
  win.useP = () => palette();
  win.Icon = ({ name }) => h('i', { 'data-icon': name });
  win.Card = passthrough('div', 'card');
  win.Eyebrow = passthrough('div', 'eyebrow');
  win.Pill = function Pill(props) {
    return h('span', { 'data-stub': 'pill', 'data-tone': props.kind }, props.children);
  };
  win.PBtn = function PBtn(props) {
    return h('button', { 'data-stub': 'pbtn', disabled: !!props.disabled,
      onClick: props.onClick }, props.children);
  };
  win.IconBtn = () => h('button', { 'data-stub': 'iconbtn' });
  // A REAL controlled input, not a dead one. The arm confirmation is typed
  // into a Field, so a Field that swallows onChange makes the whole confirm ->
  // arm -> 409 path untestable — and that path is the one the screen exists to
  // render as a first-class state.
  //
  // The node also carries its own onChange, and `type()` calls it directly.
  // MEASURED, not assumed: in this jsdom + React 18 combination a dispatched
  // `input` event reaches React's SimpleEventPlugin (an `onInput` prop fires)
  // but never produces an `onChange`, with or without the native-value-setter
  // trick — the value tracker read '' while node.value read '7' and onChange
  // still did not run. Calling the handler the screen actually passed exercises
  // the same code path (`setTyped(e.target.value)`) without depending on that.
  win.Field = function Field(props) {
    return h('input', {
      'data-stub': 'field',
      'data-field-mode': props.inputMode || '',
      'data-placeholder': props.placeholder || '',
      value: props.value == null ? '' : props.value,
      onChange: props.onChange || (() => {}),
      readOnly: !props.onChange, disabled: !!props.disabled,
      ref: (n) => { if (n) { n.__onChange = props.onChange || null; } }
    });
  };
  win.Seg = function Seg(props) {
    return h('div', { 'data-stub': 'seg' },
      (props.options || []).map((o) => h('span', { key: o.value }, o.label)));
  };
  win.Check = () => h('input', { type: 'checkbox', readOnly: true });
  win.KPI = function KPI(props) {
    return h('div', { 'data-stub': 'kpi' }, String(props.label) + ' ' + String(props.value));
  };
  win.DataTable = () => h('table', { 'data-stub': 'table' });
  win.SkeletonRows = () => h('div', { 'data-stub': 'skeleton' });
  win.EmptyState = function E(props) { return h('div', { 'data-stub': 'empty' }, props.title); };
  win.ErrorState = function E(props) {
    return h('div', { 'data-stub': 'error' }, String(props.title) + ' ' + String(props.body));
  };
  win.SectionHead = function S(props) { return h('div', { 'data-stub': 'sectionhead' }, props.title); };
  win.DevNote = function D(props) { return h('div', { 'data-stub': 'devnote' }, props.children); };
  win.DevNoteP = passthrough('p', 'devnotep');
  win.DevNoteMono = passthrough('code', 'devnotemono');
}

/**
 * Boot the screen in jsdom against a canned server.
 *
 * @param {(path:string)=>[number, any]} route
 * @returns {{doc: Document, text: () => string}}
 */
async function mount(route, opts = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="r"></div></body></html>',
    { url: 'http://127.0.0.1:8942/' });
  const win = dom.window;

  global.window = win;
  global.document = win.document;
  // navigator is a getter-only global on modern node; define, do not assign.
  Object.defineProperty(global, 'navigator',
    { value: win.navigator, configurable: true, writable: true });
  global.HTMLElement = win.HTMLElement;
  global.Element = win.Element;
  global.Node = win.Node;
  global.IS_REACT_ACT_ENVIRONMENT = true;

  installAtoms(win);
  const seen = [];
  win.fetch = (url) => {
    const p = String(url).replace('http://127.0.0.1:8942', '');
    seen.push(p);
    const [code, body] = route(p);
    return Promise.resolve({
      ok: code >= 200 && code < 300, status: code,
      text: () => Promise.resolve(JSON.stringify(body))
    });
  };
  // NO WRITE PATH BY DEFAULT: most tests here assert what the screen SAYS, and
  // a screen that can write is a screen that could be asked to. `opts.post`
  // installs one — canned, never a socket — for the tests that must render a
  // server REFUSAL, which is a state the screen cannot reach by reading alone.
  const posted = [];
  win.HW_LIVE = opts.post
    ? { base: '', post: (p, payload) => { posted.push([p, payload]); return Promise.resolve(opts.post(p, payload)); } }
    : undefined;

  let src = compiled;
  if (opts.patch) {
    const next = opts.patch(src);
    // A mutation that changed nothing would test the unbroken screen.
    assert.notEqual(next, src, 'patch() did not change the compiled screen');
    src = next;
  }
  // jsdom's window is NOT the global object a `new win.Function` body sees --
  // verified: an own property set on `win` reads back as `undefined` from a
  // bare identifier inside such a function. The screen references its atoms
  // bare (`<Card>`, `<Eyebrow>`), exactly as a browser <script> does, so they
  // are handed in as named parameters instead of being hoped for on a global.
  const NAMES = ['window', 'React', 'useP', 'Icon', 'Card', 'Eyebrow', 'Pill', 'PBtn',
    'IconBtn', 'Field', 'Seg', 'Check', 'KPI', 'DataTable', 'SkeletonRows',
    'EmptyState', 'ErrorState', 'SectionHead', 'fetch'];
  // eslint-disable-next-line no-new-func
  new win.Function(NAMES.join(','), src)
    .apply(null, NAMES.map((n) => (n === 'window' ? win : win[n])));
  assert.equal(typeof win.PublishGateScreen, 'function',
    'the screen file must export window.PublishGateScreen');

  const host = win.document.getElementById('r');
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(win.PublishGateScreen)); });
  // Let the chained reads (state -> gates -> auto-measure) settle.
  for (let i = 0; i < 8; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
  const settle = async () => {
    for (let i = 0; i < 8; i++) {
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    }
  };
  /** Click the first PBtn whose label contains `label`. */
  const click = async (label, scope) => {
    const btns = Array.from((scope || win.document).querySelectorAll('[data-stub="pbtn"]'));
    const hit = btns.filter((b) => b.textContent.indexOf(label) >= 0 && !b.disabled)[0];
    assert.ok(hit, 'no enabled button labelled ' + JSON.stringify(label) +
      ' (saw: ' + btns.map((b) => b.textContent + (b.disabled ? '[disabled]' : '')).join(' | ') + ')');
    await act(async () => { hit.click(); });
    await settle();
  };
  /** Type into a Field by calling the handler the screen gave it. */
  const type = async (input, value) => {
    assert.ok(input && input.__onChange,
      'that input has no onChange — the screen did not make it typeable');
    await act(async () => { input.__onChange({ target: { value: String(value) } }); });
    await settle();
  };
  /** The arm confirmation box: the one numeric Field on the card. */
  const confirmBox = (scope) => {
    const hit = Array.from(scope.querySelectorAll('input[data-field-mode="numeric"]'));
    assert.equal(hit.length, 1,
      'expected exactly one numeric confirm field, saw ' + hit.length);
    return hit[0];
  };
  return { doc: win.document, win, seen, posted, click, type, settle, confirmBox,
    text: () => host.textContent };
}

/** The one card, as text and as tones. */
function card(doc, channel) {
  const cards = Array.from(doc.querySelectorAll('[data-stub="card"]'));
  const hit = cards.filter((c) => {
    const first = c.textContent.trim();
    return first.indexOf(channel) === 0;
  });
  assert.ok(hit.length >= 1, 'no card found for channel ' + channel);
  return hit[0];
}

function tones(el) {
  return Array.from(el.querySelectorAll('[data-tone]')).map((n) => n.getAttribute('data-tone'));
}

/** A route serving one gate row for `pickup` and an optional preview. */
function routeFor(gate, preview) {
  return (p) => {
    if (p.startsWith('/api/state')) {
      return [200, {
        menu_plan: { [String(MENU)]: { mode: 'kits', regions: ['corona'] } },
        wmids: { delivery: MENU }, events: []
      }];
    }
    if (p.startsWith('/api/inventory/locations')) { return [200, []]; }
    if (p.startsWith('/api/inventory/gate/preview')) {
      if (!preview) { return [500, { error: 'no preview canned for this scenario' }]; }
      return [200, preview];
    }
    if (p.startsWith('/api/inventory/gate')) {
      const ch = decodeURIComponent((p.split('channel=')[1] || '').split('&')[0]);
      if (ch === 'pickup') { return [200, Object.assign({}, gate, { channel: 'pickup' })]; }
      return [200, gateRow(ch)];
    }
    return [404, { error: 'unrouted ' + p }];
  };
}

// ------------------------------------------------------------------ tests

test('1. unconfigured says the product IS PUBLISHING, and carries no alarm', async () => {
  const { doc, seen } = await mount(routeFor(UNCONFIGURED, null));
  const c = card(doc, 'pickup');
  const t = c.textContent;

  assert.match(t, /PUBLISHING NOW · THE GATE IS NOT DECIDING/i);
  assert.match(t, /Nothing is dark here because of the gate/);
  assert.match(t, /fails open by\s*design/i);

  // THE BACKWARDS-BADGE GUARD. The fail-open state is the one where the
  // listing is live and selling; a bad-tone element in this band would read as
  // a fault at exactly the wrong moment.
  const band = c.querySelector('[data-gate-band]');
  assert.ok(band, 'the publishing band must be present and carry its tone');
  assert.equal(band.getAttribute('data-gate-band'), 'good');
  assert.equal(band.getAttribute('data-gate-state'), 'unbound');
  assert.ok(!/data-icon="alert"/.test(c.innerHTML), 'no alert icon on a live, selling channel');

  // AND IT MUST NOT HAVE INVENTED A BLOCKED COUNT. The preview route answers
  // `no_locations` for every sku on an unbound channel -- a fact about the
  // gate, not about stock. Asking it here and rendering the answer is the
  // literal mechanism by which a live, selling channel would acquire a red
  // badge, so the screen must not ask, and must show no dark counter.
  assert.ok(!seen.some((p) => p.indexOf('/api/inventory/gate/preview') === 0),
    'an unbound channel must not be measured with the arm preview');
  assert.doesNotMatch(t, /dark ·/);
});

test('2. staged is publishing too — same behaviour, different configuration', async () => {
  const { doc } = await mount(routeFor(STAGED, null));
  const c = card(doc, 'pickup');
  const t = c.textContent;

  // Same publishing claim as (1): that identity is the deliberate property
  // that lets an operator build a mapping over days.
  assert.match(t, /PUBLISHING NOW · THE GATE IS NOT DECIDING/i);
  assert.match(t, /Nothing is dark here because of the gate/);
  // ...told apart from (1) on the CONFIGURATION axis, not the publishing one.
  assert.match(t, /staged — not live/);
  assert.doesNotMatch(t, /not configured/);
  assert.match(t, /staging is configuration/);
  assert.ok(tones(c).includes('warn'), 'staged carries a warn pill');
});

test('3. enforced + no stock names stock as the reason, and counts it', async () => {
  const { doc, seen } = await mount(routeFor(ENFORCED, NO_STOCK_ONLY));
  const c = card(doc, 'pickup');
  const t = c.textContent;

  assert.ok(seen.some((p) => p.indexOf('/api/inventory/gate/preview') === 0),
    'an enforced channel must be measured without being asked');
  assert.match(t, /THE GATE IS DECIDING WHAT PUBLISHES/i);
  assert.match(t, /2\s*dark · no stock/);
  assert.match(t, /0\s*dark · no price/);
  assert.match(t, /Dark right now · no stock in the bound locations/);
  assert.match(t, /HW-PR-1G/);
  assert.doesNotMatch(t, /Dark right now · no price/);
});

test('4. enforced + no price names price as the reason, and counts it', async () => {
  const { doc } = await mount(routeFor(ENFORCED, NO_PRICE_ONLY));
  const c = card(doc, 'pickup');
  const t = c.textContent;

  assert.match(t, /THE GATE IS DECIDING WHAT PUBLISHES/i);
  assert.match(t, /1\s*dark · no price/);
  assert.match(t, /0\s*dark · no stock/);
  assert.match(t, /Dark right now · no price/);
  assert.match(t, /HW-PR-9G/);
  assert.doesNotMatch(t, /Dark right now · no stock in the bound locations/);
});

test('5. enforced with nobody behind it does not borrow the armed card', async () => {
  // The gate IS deciding — that half is identical to (3)/(4) and must still be
  // said. What must NOT be borrowed is the attribution: `declared: false` means
  // no channel_gate row, which means no operator, no actor and no timestamp.
  const { doc } = await mount(routeFor(ENFORCED_UNDECLARED, NO_STOCK_ONLY));
  const c = card(doc, 'pickup');
  const t = c.textContent;

  assert.match(t, /enforced — nobody armed it/);
  assert.match(t, /THE GATE IS DECIDING · NOBODY ARMED IT/i);
  assert.match(t, /set_channel_map/);
  assert.match(t, /an absent row reads as enforced/i);
  // Still a real measurement: undeclared does not mean unmeasured.
  assert.match(t, /2\s*dark · no stock/);

  // The band stamps who is answerable, so this is assertable and not a matter
  // of reading prose.
  const band = c.querySelector('[data-gate-band]');
  assert.equal(band.getAttribute('data-gate-state'), 'enforced');
  assert.equal(band.getAttribute('data-gate-declared'), 'false');

  // AND IT MUST NOT CLAIM A PERSON. `actor` is null and `updated_at` is null;
  // the armed card's sentence ("It is already armed") credits an act nobody
  // performed.
  assert.doesNotMatch(t, /already armed/);
  assert.doesNotMatch(t, /enforced — live/);
});

test('...while a channel somebody DID arm keeps its own card and its actor', async () => {
  // The mirror check: the new branch must not swallow the declared case.
  const { doc } = await mount(routeFor(ENFORCED, NO_STOCK_ONLY));
  const c = card(doc, 'pickup');
  const t = c.textContent;
  assert.match(t, /enforced — live/);
  assert.doesNotMatch(t, /nobody armed it/);
  assert.equal(c.querySelector('[data-gate-band]').getAttribute('data-gate-declared'), 'true');
  assert.match(t, /admin@hyperwolf\.com/);
});

test('the five states produce five different cards', async () => {
  const seenText = [];
  const names = ['unconfigured', 'staged', 'enforced+no_stock', 'enforced+no_price',
                 'enforced+undeclared'];
  for (const [g, pv] of [[UNCONFIGURED, null], [STAGED, null],
                         [ENFORCED, NO_STOCK_ONLY], [ENFORCED, NO_PRICE_ONLY],
                         [ENFORCED_UNDECLARED, NO_STOCK_ONLY]]) {
    const { doc } = await mount(routeFor(g, pv));
    seenText.push(card(doc, 'pickup').textContent.replace(/\s+/g, ' ').trim());
  }
  for (let i = 0; i < seenText.length; i++) {
    for (let j = i + 1; j < seenText.length; j++) {
      assert.notEqual(seenText[i], seenText[j],
        names[i] + ' and ' + names[j] + ' render identically — that is the collapse this file exists to catch');
    }
  }
  // The pair most at risk: (3) and (5) differ ONLY on `declared`, and every
  // number on the card is the same. If the screen ever drops switch_source on
  // the enforced side again, these two collapse and nothing else here fires.
  assert.notEqual(seenText[2], seenText[4],
    'enforced+no_stock and enforced+undeclared render identically');
});

test('the detector can detect — dropping `declared` collapses (3) and (5)', async () => {
  // MUTATION. Delete the undeclared branch's guard so situation() falls through
  // to the plain enforced card, which is precisely what the screen did before
  // this repair. If the pair still reads as different, test 5 proves nothing.
  // Aimed at EVERY read of `declared`, not at one branch: situation() splits the
  // card, PublishingNow splits the band title and stamps data-gate-declared, and
  // armConsequence picks its verb from it. A mutation that removed only the
  // first would leave the other two still printing "nobody armed it" and the
  // test would pass while proving nothing -- which is exactly what happened on
  // the first run of this check.
  const patch = (src) => src.replace(/g\.declared/g, 'true');
  const { doc } = await mount(routeFor(ENFORCED_UNDECLARED, NO_STOCK_ONLY), { patch });
  const t = card(doc, 'pickup').textContent;
  assert.match(t, /enforced — live/, 'the mutation must restore the old collapsed card');
  assert.doesNotMatch(t, /nobody armed it/,
    'the mutation did not actually remove the split — this file would prove nothing');
});

test('a state this screen does not model gets NO publishing claim', async () => {
  // The green band asserts a specific server behaviour. Printing it for a
  // state the screen has no model of would be a fabrication dressed as
  // reassurance -- worse than a gap, because it reads as an all-clear.
  const weird = gateRow('pickup', { state: 'quiesced' });
  const { doc } = await mount(routeFor(weird, null));
  const c = card(doc, 'pickup');
  assert.equal(c.querySelector('[data-gate-band]').getAttribute('data-gate-band'), 'bad');
  assert.match(c.textContent, /what is publishing: not stated/i);
  assert.doesNotMatch(c.textContent, /Nothing is dark here because of the gate/);
});

test('an enforced channel whose measurement FAILED says unknown, never zero', async () => {
  const { doc } = await mount(routeFor(ENFORCED, null));   // preview route 500s
  const c = card(doc, 'pickup');
  const t = c.textContent;
  assert.match(t, /could not measure/i);
  assert.match(t, /Not zero — unknown/);
  assert.doesNotMatch(t, /0\s*dark · no price/);
});

test('the routing banner never promises an arm that the server refuses', async () => {
  // channel_for_mode is 'express', so pickup/scheduled both carry the banner.
  // 'unbound' is the screen's default view and arm answers 409 code=unbound.
  const { doc } = await mount(routeFor(UNCONFIGURED, null));
  const c = card(doc, 'pickup');
  const t = c.textContent;
  assert.match(t, /This menu publishes through express/);
  assert.match(t, /code `unbound`/);
  assert.doesNotMatch(t, /Arming pickup will succeed/);

  // bound only to inactive locations: arm refuses all_bindings_inactive, and
  // the banner used to assert success two lines under the panel saying so.
  const inactive = gateRow('pickup', {
    state: 'staged', switch: false, switch_source: 'declared', declared: true,
    bindings: ['qa2-dead'], active_bindings: [], inactive_bindings: ['qa2-dead'],
    updated_at: 1787780000, actor: 'admin@hyperwolf.com'
  });
  const c2 = card((await mount(routeFor(inactive, null))).doc, 'pickup');
  assert.match(c2.textContent, /would REFUSE, not succeed/);
  assert.match(c2.textContent, /all_bindings_inactive/);
  assert.doesNotMatch(c2.textContent, /Arming pickup will succeed/);

  // already enforced: the promise was future tense about a completed act.
  const c3 = card((await mount(routeFor(ENFORCED, NO_STOCK_ONLY))).doc, 'pickup');
  assert.match(c3.textContent, /already armed — past tense/);
  assert.doesNotMatch(c3.textContent, /Arming pickup will succeed/);
});

test('...and on the ONE armable state it still does not promise HTTP 200', async () => {
  // THE LAST SURVIVING OVERCLAIM, AND IT WAS THE SAME ONE.
  // This test used to assert the sentence "Arming pickup will succeed and
  // change nothing about what ships" on a staged channel with an active
  // binding. Half of that is true and is still asserted. The "will succeed"
  // half is a promise the server does not make, re-derived in-process on a
  // scratch COPY of the production database (never the repo file):
  //
  //   bind_channel(<menu>, 'pickup', <active loc>) -> state 'staged',
  //     active_bindings ['wf3-safe2']       (exactly this fixture's shape)
  //   arm_preview(...)['blocked'] == 31
  //   arm_channel(..., confirm_blocked=30)
  //     -> Refused code=confirm_mismatch -> HTTP 409
  //
  // arm_channel recomputes the preview at the instant of the press, so success
  // is conditional on a number no screen can hold still. The banner must say
  // what IS guaranteed (neither structural refusal applies; nothing ships
  // differently) and stop there.
  const { doc } = await mount(routeFor(STAGED, null));
  const t = card(doc, 'pickup').textContent;
  assert.match(t, /Arming pickup changes nothing about what ships/);
  assert.match(t, /not `unbound` and not `all_bindings_inactive`/);
  assert.match(t, /not a promise of HTTP 200/);
  assert.match(t, /confirm_mismatch/);
  assert.doesNotMatch(t, /will succeed/,
    'the banner promises a 200 the server does not guarantee — that is refutation 1, one state smaller');
});

// ── ARM IS GATED ON A PREVIEW, AND THE 409 IS A DESIGNED STATE ─────────────
//
// These two are the only tests in this file that let the screen WRITE. The
// refusal is not reachable by reading, and a refusal nothing renders is a
// refusal nobody designed.

test('arm is gated on having SEEN a preview — no number to type before then', async () => {
  // BEFORE AND AFTER IN ONE TEST, ON PURPOSE. The first half asserts an
  // ABSENCE, and an absence assertion passes for free the day a label is
  // reworded. The second half presses Preview and demands the same strings
  // appear, so a rename breaks this test instead of quietly hollowing it out.
  const { doc, click } = await mount(routeFor(STAGED, NO_STOCK_ONLY),
    { post: () => ({ ok: false, code: 409, body: {} }) });

  const before = card(doc, 'pickup');
  assert.match(before.textContent, /Arm is gated on a preview/);
  assert.match(before.textContent, /Preview what arming would do/);
  assert.doesNotMatch(before.textContent, /Type the number of SKUs that will stop publishing/);
  const armBefore = Array.from(before.querySelectorAll('[data-stub="pbtn"]'))
    .filter((b) => b.textContent.indexOf('Arm this channel') >= 0);
  assert.equal(armBefore.length, 0, 'an Arm button exists before any preview has been read');
  assert.equal(before.querySelectorAll('input[data-field-mode="numeric"]').length, 0,
    'a confirm field exists before any preview has been read');

  await click('Preview what arming would do');

  const after = card(doc, 'pickup');
  assert.match(after.textContent, /Type the number of SKUs that will stop publishing/);
  assert.equal(after.querySelectorAll('input[data-field-mode="numeric"]').length, 1);
  const armAfter = Array.from(after.querySelectorAll('[data-stub="pbtn"]'))
    .filter((b) => b.textContent.indexOf('Arm this channel') >= 0);
  assert.equal(armAfter.length, 1, 'the Arm button did not appear after a preview');
  // ...and it is still DISABLED, because nothing has been typed back yet.
  assert.equal(armAfter[0].disabled, true, 'Arm is pressable with no confirmation typed');
});

test('a stale confirmation renders as the guard holding, NOT as an alarm', async () => {
  // The server's own refusal, verbatim, from inventory.arm_channel:
  const SENTENCE = "confirm_blocked=2 does not match the 3 sku(s) this channel cannot publish " +
    "right now (0 with no price, 3 with no stock in corona-safe). Re-read arm_preview() and " +
    "confirm the current number.";
  const { doc, click, type, posted, confirmBox } = await mount(
    routeFor(STAGED, NO_STOCK_ONLY),
    { post: (p) => {
        assert.equal(p, '/api/inventory/gate/arm');
        return { ok: false, code: 409,
          body: { error: SENTENCE, code: 'confirm_mismatch', blocked: 3 } };
      } });

  await click('Preview what arming would do');
  const c = card(doc, 'pickup');
  assert.match(c.textContent, /2 SKUs would stop publishing on this channel/);

  // Type the number the screen showed, then press Arm. The server has moved.
  await type(confirmBox(c), '2');
  await click('Arm this channel');
  assert.equal(posted.length, 1, 'Arm did not reach the write path');
  assert.equal(posted[0][1].confirm_blocked, 2);

  const c2 = card(doc, 'pickup');
  const panel = c2.querySelector('[data-gate-refusal]');
  assert.ok(panel, 'the 409 rendered nowhere — a refusal nothing renders is not a designed state');
  assert.equal(panel.getAttribute('data-gate-refusal'), 'confirm_mismatch');

  // THE POINT. A guard firing correctly is not a fault, and must not wear the
  // same alarm red as `unknown_location`. This is the same backwards-badge rule
  // the fail-open band is held to, on the other end of the screen.
  assert.equal(panel.getAttribute('data-gate-refusal-tone'), 'warn',
    'confirm_mismatch is painted as an error; it is the confirm guard working');
  assert.match(panel.textContent, /The confirmation guard held/i);
  assert.doesNotMatch(panel.textContent, /THE GATE REFUSED/i);

  // It is a PANEL, not a toast: the server's sentence verbatim, both numbers
  // labelled by where they came from, and no auto-retry.
  assert.match(panel.textContent, /Re-read arm_preview\(\) and confirm the current number/);
  assert.match(panel.textContent, /you confirmed/);
  assert.match(panel.textContent, /blocked now/);
  assert.match(panel.textContent, /from the refusal itself/);
  assert.match(panel.textContent, /no .*arm anyway.* and no auto-retry/);
});

test('every OTHER refusal stays red — the tone split is not a blanket softening', async () => {
  const { doc, click, type, confirmBox } = await mount(
    routeFor(STAGED, NO_STOCK_ONLY),
    { post: () => ({ ok: false, code: 409,
        body: { error: 'menu 1 / channel pickup is bound only to INACTIVE location(s)',
                code: 'all_bindings_inactive' } }) });
  await click('Preview what arming would do');
  const c = card(doc, 'pickup');
  await type(confirmBox(c), '2');
  await click('Arm this channel');
  const panel = card(doc, 'pickup').querySelector('[data-gate-refusal]');
  assert.ok(panel);
  assert.equal(panel.getAttribute('data-gate-refusal'), 'all_bindings_inactive');
  assert.equal(panel.getAttribute('data-gate-refusal-tone'), 'bad');
  assert.match(panel.textContent, /The gate refused/i);
});

test('the detector can detect — collapsing the two enforced states is caught', async () => {
  // Mutation: strip the no_price bucket out of the band so both enforced
  // states render one undifferentiated blocked list, which is what the first
  // cut of this screen effectively did.
  // Anchored on `live.body`, not on the bare declaration: ArmFlow contains a
  // byte-identical `const noPrice = b.blocked_no_price || [];` line and it is
  // EARLIER in the file, so an unanchored replace mutates the arm preview --
  // which an enforced card never renders -- and the mutation test passes
  // while testing nothing. That happened on the first run of this file.
  const patch = (src) => src.replace(
    /const b = live\.body \|\| \{\};\s*const noPrice = b\.blocked_no_price \|\| \[\];/,
    'const b = live.body || {}; const noPrice = [];');
  const { doc } = await mount(routeFor(ENFORCED, NO_PRICE_ONLY), { patch });
  const t = card(doc, 'pickup').textContent;
  assert.doesNotMatch(t, /1\s*dark · no price/,
    'the mutation must actually remove the no_price rendering, or this file proves nothing');
});
