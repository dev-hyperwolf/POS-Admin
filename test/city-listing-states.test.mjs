/* ── The states the City → Weedmaps listing board must never let collapse ────
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Four of the five states a city ROOM can be in produce the same thing on the
 * wire: no menu id. Absence is what a UI renders by leaving a gap, so left
 * alone all four come out as one grey nothing that reads as "off" — a claim
 * nobody made. The two that collapse most easily are the two the API works
 * hardest to keep apart:
 *
 *   absent          no row exists. Nobody ever created this room. The API
 *                   SYNTHESISES the slot and stamps `absent: true`.
 *   unprovisioned   the row exists and we never asked Weedmaps for a menu.
 *
 * and the trap is that the synthesised slot ALSO carries
 * `provision_state: 'unprovisioned'`. So a screen that reads provision_state
 * before it reads `absent` renders "this room does not exist" as "this room
 * exists and we never asked" — with no error, no warning, and a sentence that
 * reads perfectly. Branch order is the whole defence, so branch order is what
 * is mutation-tested below.
 *
 * The second half is the pin. `wm_listing_id` CANNOT BE VALIDATED — the partner
 * API exposes menus and has no listings endpoint, so a typo is invisible to
 * every check we can write, forever. The payload carries
 * `wm_listing_id_verifiable: false` and stamps `wm_listing_id_verified: false`
 * on every row precisely so a screen cannot imply confirmation. This asserts
 * the screen never says verified, never renders a stored pin in the "good"
 * tone, and never renders a missing route as an empty estate.
 *
 * FIXTURES ARE THE REAL PAYLOAD. Every shape below was captured from
 * `GET /api/cities` on a scratch database (WM_DEMO_DB in /tmp, own port) —
 * including the detail that a REAL room row carries NO `absent` key at all,
 * which is what makes `=== true` the correct test and a truthiness check on a
 * usually-missing field the wrong one.
 *
 * HOW IT TESTS
 * ------------
 * jsdom + the real react-dom, so useEffect runs and the screen's own fetch
 * path is what is exercised. `fetch` is stubbed per scenario; nothing on disk
 * and nothing on any port is touched. Atoms are stubbed as plain elements that
 * keep their text and expose their tone in a data attribute, because what is
 * asserted is WHAT THE CARD SAYS and WHAT COLOUR IT SAYS IT IN.
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
const SCREEN = path.join(ROOT, 'pos', 'screen-city-listing.jsx');

// ---------------------------------------------------------------- fixtures
// Captured verbatim from GET /api/cities against a scratch DB.

/** A REAL room row. Note: no `absent` key. That is the point. */
function realRoom(city, room, over) {
  return Object.assign({
    city, room, wm_menu_id: null, provision_state: 'unprovisioned', active: true
  }, over || {});
}

/** What the API synthesises when NO ROW EXISTS. Verified shape. */
function synthRoom(city, room) {
  return { city, room, wm_menu_id: null, provision_state: 'unprovisioned',
    active: false, absent: true };
}

function city(slug, over) {
  return Object.assign({
    city: slug, label: slug, wm_listing_id: null, active: true,
    wm_listing_id_verified: false,
    rooms: { express: synthRoom(slug, 'express'), scheduled: synthRoom(slug, 'scheduled') },
    regions: []
  }, over || {});
}

const EMPTY_UNMAPPED = {
  regions_without_city: [], regions_pointing_at_missing_city: [],
  cities_without_pin: [], cities_without_regions: [], rooms_unprovisioned: [],
  menus_not_claimed_by_any_city: []
};

function payload(cities, over) {
  return Object.assign({
    cities,
    region_cities: {},
    unmapped: EMPTY_UNMAPPED,
    wm_listing_id_is_operator_entered: true,
    wm_listing_id_verifiable: false,
    rooms: ['express', 'scheduled'],
    write_protocol: {
      omitted_field: 'keeps the stored value',
      explicit_null: 'refused for wm_listing_id and wm_menu_id -- destroying either one is its own verb',
      clear_the_pin: 'POST /api/city/pin/clear',
      unbind_a_room: 'POST /api/city/room/delete'
    }
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
    return h(tag, { 'data-stub': extra || tag,
      'data-tone': props.kind || props.tone || undefined }, props.children);
  };
  win.React = React;
  win.useP = () => palette();
  win.Icon = ({ name }) => h('i', { 'data-icon': name });
  win.Card = function Card(props) {
    return h('div', { 'data-stub': 'card', 'data-hw-city': props['data-hw-city'] }, props.children);
  };
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
  const seen = [];
  win.fetch = (url) => {
    const p = String(url).replace('http://127.0.0.1:8943', '');
    seen.push(p);
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
    'Field', 'KPI', 'SkeletonRows', 'EmptyState', 'ErrorState', 'SectionHead', 'fetch'];
  // eslint-disable-next-line no-new-func
  new win.Function(NAMES.join(','), src)
    .apply(null, NAMES.map((n) => (n === 'window' ? win : win[n])));
  assert.equal(typeof win.CityListingScreen, 'function',
    'the screen file must export window.CityListingScreen');

  const host = win.document.getElementById('r');
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(win.CityListingScreen)); });
  for (let i = 0; i < 6; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
  return { doc: win.document, win, seen, host, text: () => host.textContent };
}

/** Serve one /api/cities payload and nothing else. */
const serve = (code, body, asText) => (p) =>
  p.startsWith('/api/cities') ? [code, body, asText] : [404, { error: 'not found' }];

function slotEl(doc, cityslug, room) {
  const card = doc.querySelector('[data-hw-city="' + cityslug + '"]');
  assert.ok(card, 'no card rendered for ' + cityslug);
  const el = card.querySelector('[data-hw-room="' + room + '"]');
  assert.ok(el, 'no ' + room + ' slot rendered for ' + cityslug);
  return el;
}
const slotState = (doc, c, r) => slotEl(doc, c, r).getAttribute('data-hw-room-state');
const slotText = (doc, c, r) => slotEl(doc, c, r).textContent;
const tones = (el) => [...el.querySelectorAll('[data-stub="pill"]')]
  .map((p) => p.getAttribute('data-tone'));
const kpi = (doc, label) => {
  const el = doc.querySelector('[data-kpi="' + label + '"]');
  assert.ok(el, 'no KPI labelled ' + label);
  return el.textContent;
};

// ═══════════════════════════════════════════════════ 1. absent ≠ unprovisioned

test('a synthesised slot and a real never-asked row do not render the same', async () => {
  const body = payload([
    city('corona', {
      // scheduled: NO ROW. express: a real row nobody has asked WM about.
      rooms: { express: realRoom('corona', 'express'),
               scheduled: synthRoom('corona', 'scheduled') }
    })
  ]);
  const { doc } = await mount(serve(200, body));

  assert.equal(slotState(doc, 'corona', 'express'), 'unprovisioned');
  assert.equal(slotState(doc, 'corona', 'scheduled'), 'absent');

  const exp = slotText(doc, 'corona', 'express');
  const sch = slotText(doc, 'corona', 'scheduled');
  assert.notEqual(exp, sch, 'the two slots rendered identical text');
  assert.match(sch, /no row exists|never been created|nobody has ever created/i);
  assert.match(exp, /never asked/i);
  // The one that is easy to get backwards: the SYNTHESISED slot must not be
  // described as a row that exists.
  assert.doesNotMatch(sch, /The row exists and holds no menu id/);
});

test('both of them still say, in words, that they publish nothing', async () => {
  const body = payload([
    city('corona', { rooms: { express: realRoom('corona', 'express'),
                              scheduled: synthRoom('corona', 'scheduled') } })
  ]);
  const { doc } = await mount(serve(200, body));
  assert.match(slotText(doc, 'corona', 'express'), /publishes nothing/);
  assert.match(slotText(doc, 'corona', 'scheduled'), /publishes nothing/);
});

test('MUTATION: reading provision_state before `absent` makes them collapse', async () => {
  const body = payload([
    city('corona', { rooms: { express: realRoom('corona', 'express'),
                              scheduled: synthRoom('corona', 'scheduled') } })
  ]);
  const { doc } = await mount(serve(200, body), {
    // Delete the `absent` branch — the exact edit a later agent would make
    // while "simplifying" a check that looks redundant next to provision_state.
    patch: (src) => src.replace('if (slot.absent === true) {\n      return "absent";\n    }\n', '')
  });
  // With the guard gone the two states become one, which is the defect.
  assert.equal(slotState(doc, 'corona', 'scheduled'), 'unprovisioned');
  assert.equal(slotState(doc, 'corona', 'express'), 'unprovisioned');
  // Compare the copy, not the whole node: the room's own name is the only
  // thing left that differs, and it is not a state.
  const strip = (c, r) => slotText(doc, c, r).replace(/^(express|scheduled)/, '');
  assert.equal(strip('corona', 'scheduled'), strip('corona', 'express'),
    'the mutation was supposed to make these identical — if it did not, this test is not testing the guard');
});

test('MUTATION: keeping the `absent` guard but demoting it below provision_state also collapses them', async () => {
  // The guard surviving is not enough — its POSITION is the defence. A
  // synthesised slot carries provision_state 'unprovisioned' too, so any
  // reordering that lets that branch answer first silently rewrites "this room
  // does not exist" into "this room exists and we never asked".
  const body = payload([
    city('corona', { rooms: { express: realRoom('corona', 'express'),
                              scheduled: synthRoom('corona', 'scheduled') } })
  ]);
  const { doc } = await mount(serve(200, body), {
    patch: (src) => src
      .replace('if (slot.absent === true) {\n      return "absent";\n    }\n    const ps = slot.provision_state;',
        '    const ps = slot.provision_state;')
      .replace('if (ps === "unprovisioned") {\n      return "unprovisioned";\n    }',
        'if (ps === "unprovisioned") {\n      return "unprovisioned";\n    }\n    if (slot.absent === true) {\n      return "absent";\n    }')
  });
  assert.equal(slotState(doc, 'corona', 'scheduled'), 'unprovisioned',
    'demoting the absent test must break it — if this still reads "absent" the patch missed');
});

// ═══════════════════════════════════════════════════════ 2. live ≠ parked

test('a bound room that is switched off keeps its id and says it publishes nothing', async () => {
  const body = payload([
    city('corona', {
      wm_listing_id: 'L-CORONA-1',
      rooms: {
        express: realRoom('corona', 'express', { wm_menu_id: 342170487, provision_state: 'live', active: true }),
        scheduled: realRoom('corona', 'scheduled', { wm_menu_id: 555000111, provision_state: 'live', active: false })
      }
    })
  ]);
  const { doc } = await mount(serve(200, body));

  assert.equal(slotState(doc, 'corona', 'express'), 'live');
  assert.equal(slotState(doc, 'corona', 'scheduled'), 'parked');

  const live = slotText(doc, 'corona', 'express');
  const parked = slotText(doc, 'corona', 'scheduled');
  assert.match(live, /publishing now/);
  assert.match(parked, /publishes nothing/);
  // The id is STILL SHOWN on the parked room: it is still claimed, and
  // UNIQUE(wm_menu_id) means no other city can take it.
  assert.match(parked, /555000111/);
  // And it is not described as unprovisioned.
  assert.match(parked, /NOT unprovisioned|still HOLDS|still holds/i);
  // Only the publishing room gets the good tone.
  assert.ok(tones(slotEl(doc, 'corona', 'express')).includes('good'));
  assert.ok(!tones(slotEl(doc, 'corona', 'scheduled')).includes('good'),
    'a room that publishes nothing must never carry the good tone');
});

test('requested is neither of the other empty states', async () => {
  const body = payload([
    city('west-la', {
      rooms: {
        express: realRoom('west-la', 'express', { provision_state: 'requested' }),
        scheduled: realRoom('west-la', 'scheduled')
      }
    })
  ]);
  const { doc } = await mount(serve(200, body));
  assert.equal(slotState(doc, 'west-la', 'express'), 'requested');
  assert.equal(slotState(doc, 'west-la', 'scheduled'), 'unprovisioned');
  assert.match(slotText(doc, 'west-la', 'express'), /asked/i);
  assert.notEqual(slotText(doc, 'west-la', 'express'), slotText(doc, 'west-la', 'scheduled'));
});

test('an unrecognised provision_state is never folded into one of the five', async () => {
  const body = payload([
    city('corona', {
      rooms: {
        express: realRoom('corona', 'express', { provision_state: 'pending_review' }),
        scheduled: synthRoom('corona', 'scheduled')
      }
    })
  ]);
  const { doc } = await mount(serve(200, body));
  assert.equal(slotState(doc, 'corona', 'express'), 'unknown_state');
  assert.match(slotText(doc, 'corona', 'express'), /refuses to guess|unrecognised/i);
});

test('a rooms object missing a room key is an error, not an empty room', async () => {
  const body = payload([
    city('corona', { rooms: { express: realRoom('corona', 'express') } })
  ]);
  const { doc } = await mount(serve(200, body));
  assert.equal(slotState(doc, 'corona', 'scheduled'), 'no_slot');
  assert.match(slotText(doc, 'corona', 'scheduled'), /does not understand|no key/i);
  assert.notEqual(slotState(doc, 'corona', 'scheduled'), 'absent');
});

// ══════════════════════════════════════ 3. the pin is never a confirmation

test('a stored pin is shown, and is never green and never called verified', async () => {
  const body = payload([city('corona', { wm_listing_id: 'L-CORONA-1' })]);
  const { doc, host } = await mount(serve(200, body));
  const card = doc.querySelector('[data-hw-city="corona"]');
  assert.match(card.textContent, /L-CORONA-1/);
  assert.match(card.textContent, /cannot be verified/i);
  // EVERY use of "verif*" anywhere on the screen must be one of the sanctioned
  // NEGATIVE forms. A blanket /\bverified\b/ regex passed here for the wrong
  // reason once — the rendered text ran "verifiedOperator-entered" together, so
  // the word boundary never matched and the assertion was decorative. Whitelist
  // the honest phrasings instead, and fail on anything new.
  const SANCTIONED = /(cannot be verif|unverifiable|wm_listing_id_verif|payload states wm_listing_id|claims pins ARE verifiable|claims this is checkable|none of them checkable)/i;
  const uses = [...host.textContent.matchAll(/.{0,30}verif\w*/gi)].map((m) => m[0]);
  assert.ok(uses.length > 0, 'the pin must always carry its unverifiable language');
  uses.forEach((u) => assert.match(u, SANCTIONED,
    'unsanctioned verification language on screen: ' + JSON.stringify(u)));
  // No pill anywhere near the pin may carry the good tone.
  const pinPills = [...card.querySelectorAll('[data-stub="pill"]')]
    .filter((p) => /verif/i.test(p.textContent));
  assert.ok(pinPills.length > 0, 'the pin must always carry its unverifiable marker');
  pinPills.forEach((p) => assert.notEqual(p.getAttribute('data-tone'), 'good'));
});

test('a missing pin and a stored pin are different sentences', async () => {
  const body = payload([city('corona', { wm_listing_id: 'L-CORONA-1' }), city('west-la')]);
  const { doc } = await mount(serve(200, body));
  const withPin = doc.querySelector('[data-hw-city="corona"]').textContent;
  const noPin = doc.querySelector('[data-hw-city="west-la"]').textContent;
  assert.match(noPin, /no pin/i);
  assert.doesNotMatch(withPin, /no pin/i);
});

test('a payload claiming pins ARE verifiable is a warning, not a green light', async () => {
  const body = payload([city('corona', { wm_listing_id: 'L-CORONA-1' })],
    { wm_listing_id_verifiable: true });
  const { doc, host } = await mount(serve(200, body));
  assert.match(host.textContent, /claims pins ARE verifiable|contract change/i);
  const card = doc.querySelector('[data-hw-city="corona"]');
  const pinPills = [...card.querySelectorAll('[data-stub="pill"]')]
    .filter((p) => /verif|checkable/i.test(p.textContent));
  pinPills.forEach((p) => assert.notEqual(p.getAttribute('data-tone'), 'good'));
});

test('a payload with no verifiable flag says the flag was missing', async () => {
  const body = payload([city('corona', { wm_listing_id: 'L-1' })]);
  delete body.wm_listing_id_verifiable;
  const { host } = await mount(serve(200, body));
  assert.match(host.textContent, /did not carry/i);
  assert.match(host.textContent, /wm_listing_id_verifiable/);
});

// ══════════════════════════════════ 4. a dead route is not an empty estate

test('HTTP 404 never renders as "no cities", and every count reads not-known', async () => {
  const { host } = await mount(serve(404, { error: 'not found' }));
  assert.match(host.textContent, /404/);
  assert.match(host.textContent, /nothing looked/i);
  // The tiles must not print a zero for something nobody measured.
  const cities = kpi(host, 'Cities');
  assert.match(cities, /—/);
  assert.match(cities, /not zero/i);
  assert.match(kpi(host, 'Rooms publishing now'), /—/);
  assert.match(kpi(host, 'Rooms with no row'), /not zero/i);
  // And it must not claim the estate is empty.
  assert.doesNotMatch(host.textContent, /holds no cities/i);
});

test('a network failure is reported as a failure, not as zero cities', async () => {
  const { host } = await mount(() => 'network');
  assert.match(host.textContent, /ECONNREFUSED|request failed/);
  assert.match(kpi(host, 'Cities'), /—/);
});

test('HTTP 200 with a body that has no cities array is a shape error, not an empty estate', async () => {
  const { host } = await mount(serve(200, { ok: true }));
  assert.match(host.textContent, /no cities array|does not understand/i);
  assert.match(kpi(host, 'Cities'), /—/);
  assert.doesNotMatch(host.textContent, /holds no cities/i);
});

test('HTTP 200 with an empty cities list IS a real none, and says so', async () => {
  const { host } = await mount(serve(200, payload([])));
  assert.match(host.textContent, /holds no cities/i);
  assert.match(host.textContent, /real .none.|city tier exists/i);
  assert.match(kpi(host, 'Cities'), /\| 0 \|/);
});

test('MUTATION: flattening the unknown case to an empty list makes a 404 read as an empty estate', async () => {
  const { host } = await mount(serve(404, { error: 'not found' }), {
    patch: (src) => src.replace(
      'if (!Array.isArray(body.cities)) {\n      return void 0;\n    }',
      'if (!Array.isArray(body.cities)) { return []; }')
      .replace('if (!body || typeof body !== "object") {\n      return void 0;\n    }',
        'if (!body || typeof body !== "object") { return []; }')
  });
  // With "nobody answered" flattened to [], the screen reports a measurement
  // that was never taken.
  assert.match(kpi(host, 'Cities'), /\| 0 \|/,
    'the mutation was supposed to make a dead route report 0 cities');
});

// ═════════════════════════════════════ 5. gaps: missing key ≠ empty list

test('a missing gap list reads "not reported"; an empty one reads "none"', async () => {
  const body = payload([city('corona')]);
  delete body.unmapped.cities_without_pin;
  const { doc } = await mount(serve(200, body));
  const missing = doc.querySelector('[data-hw-gap="cities_without_pin"]');
  const empty = doc.querySelector('[data-hw-gap="cities_without_regions"]');
  assert.ok(missing && empty);
  assert.match(missing.textContent, /not reported/i);
  assert.match(missing.textContent, /not .none./i);
  assert.match(empty.textContent, /\bnone\b/i);
  assert.notEqual(missing.textContent, empty.textContent);
  assert.ok(!tones(missing).includes('good'), 'an uncomputed gap must never be green');
  assert.ok(tones(empty).includes('good'));
});

test('a populated gap list prints the items rather than a count alone', async () => {
  const body = payload([city('corona')], {
    unmapped: Object.assign({}, EMPTY_UNMAPPED, {
      regions_without_city: ['riverside', 'ontario'],
      menus_not_claimed_by_any_city: [914117477]
    })
  });
  const { doc } = await mount(serve(200, body));
  const g = doc.querySelector('[data-hw-gap="regions_without_city"]');
  assert.match(g.textContent, /riverside/);
  assert.match(g.textContent, /ontario/);
  assert.match(doc.querySelector('[data-hw-gap="menus_not_claimed_by_any_city"]').textContent,
    /914117477/);
});

// ═══════════════════════════════════════════ 6. the rest of the model

test('a city with no region behind it says so instead of showing an empty row', async () => {
  const body = payload([city('santa-ana', { regions: [] }),
                        city('corona', { regions: ['corona', 'riverside'] })]);
  const { doc } = await mount(serve(200, body));
  assert.match(doc.querySelector('[data-hw-city="santa-ana"]').textContent,
    /No region rolls up to this city/i);
  const corona = doc.querySelector('[data-hw-city="corona"]').textContent;
  assert.match(corona, /riverside/);
  assert.doesNotMatch(corona, /No region rolls up/i);
});

test('a city carrying no regions array is "not known", not "none"', async () => {
  const c = city('corona');
  delete c.regions;
  const { doc } = await mount(serve(200, payload([c])));
  const t = doc.querySelector('[data-hw-city="corona"]').textContent;
  assert.match(t, /does not know|no regions array/i);
  assert.match(t, /not .none./i);
});

test('an inactive city is not described as having stopped publishing', async () => {
  const body = payload([
    city('corona', {
      active: false,
      rooms: { express: realRoom('corona', 'express', { wm_menu_id: 342170487, provision_state: 'live', active: true }),
               scheduled: synthRoom('corona', 'scheduled') }
    })
  ]);
  const { doc } = await mount(serve(200, body));
  const t = doc.querySelector('[data-hw-city="corona"]').textContent;
  assert.match(t, /switched off/i);
  // The finding: a region-scoped write still resolves this city's menus.
  assert.match(t, /does not mean|still/i);
  // And the live room still says it is publishing, because it is.
  assert.match(slotText(doc, 'corona', 'express'), /publishing now/);
});

test('room names come from the payload, and their absence is disclosed', async () => {
  const body = payload([city('corona')]);
  delete body.rooms;
  const { host } = await mount(serve(200, body));
  assert.match(host.textContent, /named none|a third room would not be visible/i);
});

test('the screen reads exactly one route and writes nothing', async () => {
  const { seen } = await mount(serve(200, payload([city('corona')])));
  assert.deepEqual(seen, ['/api/cities']);
});

test('the five states each get their own legend entry', async () => {
  const { host } = await mount(serve(200, payload([city('corona')])));
  const t = host.textContent;
  ['no room row', 'row exists · never asked', 'asked · waiting', 'live', 'bound · switched off']
    .forEach((label) => assert.ok(t.includes(label), 'legend is missing: ' + label));
});

test('the two easily-collapsed counts are tiled apart, never summed', async () => {
  const body = payload([
    city('corona', { rooms: { express: realRoom('corona', 'express'),
                              scheduled: synthRoom('corona', 'scheduled') } }),
    city('west-la', { rooms: { express: realRoom('west-la', 'express', { provision_state: 'requested' }),
                               scheduled: synthRoom('west-la', 'scheduled') } })
  ]);
  const { host } = await mount(serve(200, body));
  assert.match(kpi(host, 'Rooms with no row'), /\| 2 \|/);
  assert.match(kpi(host, 'Rooms never asked for'), /\| 1 \|/);
  assert.match(kpi(host, 'Rooms never asked for'), /1 more asked and waiting/);
});

test('the exported state helpers branch the way the rendered screen does', async () => {
  const { win } = await mount(serve(200, payload([city('corona')])));
  const S = win.CityListingScreen.__states;
  assert.equal(S.roomState(synthRoom('c', 'express')), 'absent');
  assert.equal(S.roomState(realRoom('c', 'express')), 'unprovisioned');
  assert.equal(S.roomState(realRoom('c', 'express', { provision_state: 'requested' })), 'requested');
  assert.equal(S.roomState(realRoom('c', 'express', { wm_menu_id: 1, provision_state: 'live', active: true })), 'live');
  assert.equal(S.roomState(realRoom('c', 'express', { wm_menu_id: 1, provision_state: 'live', active: false })), 'parked');
  assert.equal(S.roomState(undefined), 'no_slot');
  assert.equal(S.roomState({ provision_state: 'nonsense' }), 'unknown_state');
  // publishesNow mirrors menu_ids_for_city(active_only=True) and nothing else.
  assert.equal(S.publishesNow({ wm_menu_id: 1, active: true }), true);
  assert.equal(S.publishesNow({ wm_menu_id: 1, active: false }), false);
  assert.equal(S.publishesNow({ wm_menu_id: null, active: true }), false);
  // Three outcomes, and undefined is one of them.
  assert.equal(S.cityRowsOf(null), undefined);
  assert.equal(S.cityRowsOf({}), undefined);
  assert.deepEqual(S.cityRowsOf({ cities: [] }), []);
  assert.equal(S.gapListOf({}, 'cities_without_pin'), undefined);
  assert.deepEqual(S.gapListOf({ unmapped: { cities_without_pin: [] } }, 'cities_without_pin'), []);
  // The pin never resolves to a "verified" token, whatever it is handed.
  assert.equal(S.pinState({ wm_listing_id: null }, false), 'absent');
  assert.equal(S.pinState({ wm_listing_id: '' }, false), 'absent');
  assert.equal(S.pinState({ wm_listing_id: 'L-1' }, false), 'unverifiable');
  assert.equal(S.pinState({ wm_listing_id: 'L-1' }, undefined), 'unverifiable');
  assert.equal(S.pinState({ wm_listing_id: 'L-1' }, true), 'claims_verifiable');
});
