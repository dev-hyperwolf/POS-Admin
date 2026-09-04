/* ── Multi-location binding, in one action ───────────────────────────────────
 *
 * WHY THIS FILE EXISTS
 * ---------------------
 * The owner's own words: "we need to be able to map more than one of our
 * inventories to an express menu - right now that's not possible."
 *
 * Re-derived against wmdemo/inventory.py rather than assumed: channel_map's
 * own PRIMARY KEY is (wm_menu_id, channel, location_id) — nothing in the
 * schema, and nothing in bind_channel()/unbind_channel(), caps a channel at
 * one location. Each already takes ONE location_id per call and INSERTs OR
 * IGNOREs it; there is no bulk-bind route. So "not possible" was never a
 * server-side limit — it was pos/screen-publish-gate.jsx's own picker: a
 * single <select> plus a single Bind button, which made mapping five real
 * locations to one channel five separate reads-and-clicks with no way to
 * select more than one before pressing Bind.
 *
 * This file tests the fix: BoundLocations now offers a checklist (every
 * unbound location, checked independently) and ONE Bind action that submits
 * every checked id. Under the hood that is still N sequential POSTs — there
 * is nothing to batch them into — so this file also tests the honesty of a
 * PARTIAL failure: a multi-bind that succeeds for some ids and refuses for
 * others must say exactly which is which, never collapse to "it worked" or
 * "it failed".
 *
 * HOW IT TESTS
 * ------------
 * Same jsdom + real react-dom harness as publish-gate-states.test.mjs
 * (copied rather than imported — each test file in this house is
 * self-contained). The mock server here is STATEFUL for the gate row, unlike
 * that file's static fixtures: a bind has to be seen to move `bindings`
 * forward, or a second bind in the same action could not be distinguished
 * from the first.
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

// The five real regional counters this fix exists for.
const LOCATIONS = [
  { id: 'corona-counter', name: 'Corona Counter', kind: 'counter', region: 'corona', active: true },
  { id: 'elsinore-counter', name: 'Lake Elsinore Counter', kind: 'counter', region: 'elsinore', active: true },
  { id: 'longbeach-counter', name: 'Long Beach Counter', kind: 'counter', region: 'long-beach', active: true },
  { id: 'westla-counter', name: 'West Hollywood Counter', kind: 'counter', region: 'west-la', active: true },
  { id: 'riverside-counter', name: 'Riverside Counter', kind: 'counter', region: 'riverside', active: true }
];

function gateRow(over) {
  return Object.assign({
    wm_menu_id: MENU, channel: 'express', state: 'unbound', enforced: false,
    switch: true, switch_source: 'default', declared: false,
    bindings: [], active_bindings: [], inactive_bindings: [],
    stale_declaration: false, updated_at: null, actor: null, note: null,
    mode: 'kits', channel_for_mode: 'express'
  }, over || {});
}

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
      body += depth === 1 ? c : ' ';
    }
    const flat = body.replace(/'[^']*'|"[^"]*"/g, "''");
    let m;
    const re = /([A-Za-z_][A-Za-z0-9_]*)\s*:/g;
    while ((m = re.exec(flat))) { names.add(m[1]); }
  }
  return names;
}
const TOKENS = tokenNames();
const TYPE_STEPS = new Set(['micro', 'meta', 'body', 'strong', 'title', 'h2', 'h1', 'numRow', 'numTotal']);

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

function installAtoms(win) {
  const h = React.createElement;
  const passthrough = (tag, extra) => function Stub(props) {
    const { children } = props;
    return h(tag, Object.assign({
      'data-stub': extra || tag, 'data-tone': props.kind || props.tone || undefined
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
  win.Field = function Field(props) {
    return h('input', {
      'data-stub': 'field', 'data-field-mode': props.inputMode || '',
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

const compiled = esbuild.transformSync(fs.readFileSync(SCREEN, 'utf8'), {
  loader: 'jsx', jsx: 'transform', target: 'es2020'
}).code;

/**
 * A STATEFUL mock server. `state.gate` moves forward exactly the way
 * bind_channel() does: the FIRST bind flips switch off / state to 'staged'.
 * `binds` records every POST /api/inventory/bind payload this test's server
 * actually saw, in order — the whole point of "sequential, not parallel".
 */
function makeServer(opts) {
  const state = {
    gate: gateRow(),
    locations: LOCATIONS.slice(),
    binds: []
  };
  const enforceAll = !!(opts && opts.enforced);
  const knownIds = LOCATIONS.map((l) => l.id);

  function route(p) {
    if (p.startsWith('/api/state')) {
      return [200, {
        menu_plan: { [String(MENU)]: { mode: 'kits', regions: ['corona'] } },
        wmids: { delivery: MENU }, events: []
      }];
    }
    if (p.startsWith('/api/inventory/locations')) { return [200, state.locations]; }
    if (p.startsWith('/api/inventory/gate/preview')) {
      return [200, { blocked: 0, skus_examined: 0, publishable: [], blocked_no_price: [], blocked_no_stock: [] }];
    }
    if (p.startsWith('/api/inventory/gate')) {
      const ch = decodeURIComponent((p.split('channel=')[1] || '').split('&')[0]);
      if (ch === 'express') { return [200, Object.assign({}, state.gate, { channel: 'express' })]; }
      return [200, gateRow({ channel: ch })];
    }
    return [404, { error: 'unrouted ' + p }];
  }

  function post(p, payload) {
    if (p !== '/api/inventory/bind') { return { ok: false, code: 404, body: { error: 'unrouted ' + p } }; }
    state.binds.push(payload);
    const id = String(payload.location);
    if (enforceAll) {
      return { ok: false, code: 409,
        body: { error: 'menu ' + MENU + " / channel 'express' is ENFORCED", code: 'channel_enforced' } };
    }
    if (knownIds.indexOf(id) < 0) {
      return { ok: false, code: 409,
        body: { error: 'unknown location ' + JSON.stringify(id) + ' — create it first.', code: 'unknown_location' } };
    }
    if (state.gate.bindings.indexOf(id) < 0) {
      state.gate = Object.assign({}, state.gate, {
        state: 'staged', switch: false, switch_source: 'declared', declared: true,
        bindings: state.gate.bindings.concat([id]),
        active_bindings: state.gate.active_bindings.concat([id])
      });
    }
    return { ok: true, code: 200, body: Object.assign({}, state.gate, { channel: 'express' }) };
  }

  return { state, route, post };
}

async function mount(server) {
  const dom = new JSDOM('<!doctype html><html><body><div id="r"></div></body></html>',
    { url: 'http://127.0.0.1:8943/' });
  const win = dom.window;

  global.window = win;
  global.document = win.document;
  Object.defineProperty(global, 'navigator', { value: win.navigator, configurable: true, writable: true });
  global.HTMLElement = win.HTMLElement;
  global.Element = win.Element;
  global.Node = win.Node;
  global.IS_REACT_ACT_ENVIRONMENT = true;

  installAtoms(win);
  const seen = [];
  win.fetch = (url) => {
    const p = String(url).replace('http://127.0.0.1:8943', '');
    seen.push(p);
    const [code, body] = server.route(p);
    return Promise.resolve({ ok: code >= 200 && code < 300, status: code,
      text: () => Promise.resolve(JSON.stringify(body)) });
  };
  win.HW_LIVE = { base: '', post: (p, payload) => Promise.resolve(server.post(p, payload)) };

  const NAMES = ['window', 'React', 'useP', 'Icon', 'Card', 'Eyebrow', 'Pill', 'PBtn',
    'IconBtn', 'Field', 'Seg', 'Check', 'KPI', 'DataTable', 'SkeletonRows',
    'EmptyState', 'ErrorState', 'SectionHead', 'fetch'];
  // eslint-disable-next-line no-new-func
  new win.Function(NAMES.join(','), compiled)
    .apply(null, NAMES.map((n) => (n === 'window' ? win : win[n])));
  assert.equal(typeof win.PublishGateScreen, 'function',
    'the screen file must export window.PublishGateScreen');

  const host = win.document.getElementById('r');
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(win.PublishGateScreen)); });
  const settle = async () => {
    for (let i = 0; i < 8; i++) {
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    }
  };
  await settle();

  const click = async (label, scope) => {
    const btns = Array.from((scope || win.document).querySelectorAll('[data-stub="pbtn"]'));
    const hit = btns.filter((b) => b.textContent.indexOf(label) >= 0 && !b.disabled)[0];
    assert.ok(hit, 'no enabled button labelled ' + JSON.stringify(label) +
      ' (saw: ' + btns.map((b) => b.textContent + (b.disabled ? '[disabled]' : '')).join(' | ') + ')');
    await act(async () => { hit.click(); });
    await settle();
  };
  const cardFor = (channel) => {
    const cards = Array.from(win.document.querySelectorAll('[data-stub="card"]'));
    const hit = cards.filter((c) => c.textContent.trim().indexOf(channel) === 0);
    assert.ok(hit.length >= 1, 'no card found for channel ' + channel);
    return hit[0];
  };
  /** Toggle one location's checkbox by id, SCOPED to one channel's card.
   *  All three channel cards render the identical picker before anything is
   *  bound anywhere, each with its own independent `checked` state — an
   *  unscoped querySelector would silently hit pickup's card (first in DOM
   *  order) instead of the channel actually under test. Calls the handler
   *  the screen exposed via ref (`__onToggle`), the same escape hatch Field
   *  uses for its onChange in this jsdom/React combination — see
   *  publish-gate-states.test.mjs's Field comment for the measured reason a
   *  dispatched native event is not trusted here. */
  const toggleLocation = async (channel, id) => {
    const scope = cardFor(channel);
    const label = scope.querySelector('[data-hw-bind-option="' + id + '"]');
    assert.ok(label, 'no bind checkbox for location ' + id + ' on channel ' + channel);
    const box = label.querySelector('input[type="checkbox"]');
    assert.ok(box && box.__onToggle, 'checkbox missing, or not wired, for ' + id);
    await act(async () => { box.__onToggle(); });
    await settle();
  };
  return { doc: win.document, win, seen, click, toggleLocation, cardFor,
    text: () => host.textContent };
}

// ------------------------------------------------------------------ tests

test('the picker offers every unbound location, unchecked, with a single Bind action', async () => {
  const server = makeServer();
  const { cardFor } = await mount(server);
  const c = cardFor('express');
  LOCATIONS.forEach((l) => {
    const label = c.querySelector('[data-hw-bind-option="' + l.id + '"]');
    assert.ok(label, l.id + ' is not offered in the picker');
    assert.equal(label.querySelector('input[type="checkbox"]').checked, false,
      l.id + ' starts checked — nothing has been picked yet');
  });
  assert.match(c.textContent, /Check every location to bind/);
});

test('checking several locations and pressing Bind once binds all of them', async () => {
  const server = makeServer();
  const { cardFor, toggleLocation, click } = await mount(server);

  await toggleLocation('express', 'corona-counter');
  await toggleLocation('express', 'elsinore-counter');
  await toggleLocation('express', 'longbeach-counter');

  const c = cardFor('express');
  assert.match(c.textContent, /Bind 3 locations/, 'the action button did not count the 3 checked boxes');

  await click('Bind 3 locations');

  // ONE ACTION, but still N calls under the hood — there is no bulk-bind
  // route on the server. Sequential, in the order checked.
  assert.equal(server.state.binds.length, 3);
  assert.deepEqual(server.state.binds.map((b) => b.location),
    ['corona-counter', 'elsinore-counter', 'longbeach-counter']);
  server.state.binds.forEach((b) => {
    assert.equal(b.menu, MENU);
    assert.equal(b.channel, 'express');
  });

  const after = cardFor('express');
  assert.deepEqual(server.state.gate.bindings.slice().sort(),
    ['corona-counter', 'elsinore-counter', 'longbeach-counter'].sort());
  // All three now show as bound, and are no longer offered in the picker.
  ['corona-counter', 'elsinore-counter', 'longbeach-counter'].forEach((id) => {
    assert.match(after.textContent, new RegExp(id));
    assert.equal(after.querySelector('[data-hw-bind-option="' + id + '"]'), null,
      id + ' is bound and must not still be offered as an unbound option');
  });
  // The two NOT checked are still offered.
  assert.ok(after.querySelector('[data-hw-bind-option="westla-counter"]'));
  assert.ok(after.querySelector('[data-hw-bind-option="riverside-counter"]'));
});

test('"Select all" checks every offered location for the one-action bind', async () => {
  const server = makeServer();
  const { cardFor, click } = await mount(server);
  // Scoped: EVERY channel card offers its own "Select all" before anything is
  // bound anywhere, and pickup's renders first in the DOM.
  await click('Select all', cardFor('express'));
  const c = cardFor('express');
  assert.match(c.textContent, /Bind 5 locations/);
  LOCATIONS.forEach((l) => {
    assert.equal(c.querySelector('[data-hw-bind-option="' + l.id + '"] input[type="checkbox"]').checked, true);
  });
});

test('a partial failure — one bad id among several — names which bound and which did not', async () => {
  const server = makeServer();
  const { cardFor, toggleLocation, click } = await mount(server);

  // Simulate one of the ids being wrong by binding a name the fixture server
  // does not know, alongside two real ones, via the no-picker fallback text
  // path — same doBind(ch, ids) call the checklist itself makes, so this
  // exercises the identical multi-bind code path with a mixed-outcome batch.
  await toggleLocation('express', 'corona-counter');
  await toggleLocation('express', 'westla-counter');
  await click('Bind 2 locations');

  const ok = cardFor('express');
  assert.match(ok.textContent, /corona-counter/);
  assert.equal(ok.querySelector('[data-hw-bind-option="corona-counter"]'), null);

  // Now attempt a batch containing a genuinely unknown id, mixed with a real
  // one, through the fallback text field — reachable because this same
  // screen still degrades to it when the locations route is unavailable, and
  // it feeds the identical doBind(ch, ids) array path. Scoped to the express
  // card specifically: with no picker, EVERY channel card falls back to an
  // identical-looking text field, and pickup's renders first in the DOM.
  const server2 = makeServer();
  const { cardFor: cardFor2, click: click2 } = await mountWithBrokenPicker(server2);
  const expressCard = cardFor2('express');
  const field = expressCard.querySelector('input[data-placeholder^="location id"]');
  assert.ok(field && field.__onChange, 'the fallback field is not wired');
  await act_(field, 'elsinore-counter, not-a-real-location');
  await click2('Bind 2 locations', expressCard);

  assert.equal(server2.state.binds.length, 2, 'the unknown id must still be ATTEMPTED, not skipped silently');
  const after2 = cardFor2('express');
  const panel = after2.querySelector('[data-gate-refusal]');
  assert.ok(panel, 'a partial failure must render SOMETHING, not fail silently');
  const summary = after2.querySelector('[data-hw-multibind-result="1"]');
  assert.ok(summary, 'a multi-location bind result must say which ids landed and which did not');
  assert.match(summary.textContent, /Bound:/);
  assert.match(summary.textContent, /elsinore-counter/);
  assert.match(summary.textContent, /Not bound:/);
  assert.match(summary.textContent, /not-a-real-location/);
  // And the one that DID succeed must actually show as bound — a refusal
  // panel must never imply the whole action was rolled back when it was not.
  assert.deepEqual(server2.state.gate.bindings, ['elsinore-counter']);
});

test('a systemic refusal (channel_enforced) stops the rest of the batch, not five identical refusals', async () => {
  const server = makeServer({ enforced: true });
  const { cardFor, toggleLocation, click, win } = await mount(server);

  await toggleLocation('express', 'corona-counter');
  await toggleLocation('express', 'elsinore-counter');
  await toggleLocation('express', 'longbeach-counter');
  await click('Bind 3 locations');

  // The FIRST attempt refuses channel_enforced; the other two ids must never
  // even be tried — every one of them would refuse for the identical reason,
  // and attempting them anyway would just be three refusal round-trips for
  // one fact already known after the first.
  assert.equal(server.state.binds.length, 1,
    'a systemic channel_enforced refusal did not stop the remaining locations in the batch');

  const c = cardFor('express');
  const panel = c.querySelector('[data-gate-refusal]');
  assert.ok(panel);
  assert.equal(panel.getAttribute('data-gate-refusal'), 'channel_enforced');
  const summary = c.querySelector('[data-hw-multibind-result="1"]');
  assert.ok(summary);
  assert.match(summary.textContent, /Not attempted/);
  assert.match(summary.textContent, /elsinore-counter/);
  assert.match(summary.textContent, /longbeach-counter/);
});

// ── helpers for the fallback (no-picker) path used by the partial-failure test

async function mountWithBrokenPicker(server) {
  const brokenRoute = (p) => {
    if (p.startsWith('/api/inventory/locations')) { return [404, { error: 'no route' }]; }
    return server.route(p);
  };
  const wrapped = Object.assign({}, server, { route: brokenRoute });
  return mount(wrapped);
}

async function act_(input, value) {
  assert.ok(input && input.__onChange, 'that input has no onChange');
  await act(async () => { input.__onChange({ target: { value } }); });
  for (let i = 0; i < 8; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
}
