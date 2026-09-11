/* ── Locations and Boxes panels — smoke + the 404/501 tolerance rule ─────────
 *
 * The brief for these two screens is explicit: "make the client tolerate
 * 404/501 by showing 'locations not available on this server yet'" — the
 * backend is being built in parallel (wm-demo) and may not have landed these
 * routes on every environment yet. This file proves three things a review of
 * the source cannot: the panels actually render real server data through
 * window.HW_LIVE, they don't throw when mounted, and a 404 from the server
 * degrades to the promised sentence instead of a stack trace or a blank
 * screen.
 *
 * Reuses shells-fetch-stub.mjs's base fixture (formats/shells/products) and
 * layers the locations/boxes routes documented in the task brief on top of
 * it — the exact same seam pos/shell-store.jsx calls through window.HW_LIVE.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApp } from './ui-harness.mjs';
import { makeShellsFixture } from './shells-fetch-stub.mjs';

function json(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300, status, statusText: '', url: '',
    json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body))
  });
}

// `notFound` lets one test simulate "this environment hasn't shipped the
// route yet" for locations, boxes, or both, independent of the base fixture.
function makeFixture({ notFound } = {}) {
  const base = makeShellsFixture();
  const LOCATIONS = [
    { id: 'LOC-1', kind: 'floor', name: 'Floor A1', address: 'F1-A-01', store_id: null, capacity: 40, active: true, shell_count: 1 },
    { id: 'LOC-2', kind: 'safe', name: 'Safe 1', address: 'S1', store_id: null, capacity: null, active: true, shell_count: 0 }
  ];
  const BOXES = [{ id: 'BOX-1', name: 'Flower Box 1', type: 'Flower', sort: 1, active: true, shell_count: 2 }];

  function fetch(url, options) {
    const u = String(url);
    const method = (options && options.method) || 'GET';
    const path = u.replace(/^https?:\/\/[^/]+/, '');

    if (notFound === 'locations' || notFound === 'both') {
      if (/^\/api\/shells\/locations/.test(path)) return json({ error: 'not_found' }, 404);
    }
    if (notFound === 'boxes' || notFound === 'both') {
      if (/^\/api\/shells\/boxes/.test(path)) return json({ error: 'not_found' }, 404);
    }

    if (method === 'GET' && /^\/api\/shells\/locations(\?.*)?$/.test(path)) return json({ locations: LOCATIONS });
    if (method === 'GET' && /^\/api\/shells\/boxes(\?.*)?$/.test(path)) return json({ boxes: BOXES });
    if (method === 'POST' && /^\/api\/shells\/locations\/delete\/preview$/.test(path)) return json({ affected: [], stock_held: 0 });
    if (method === 'POST' && /^\/api\/shells\/boxes\/delete\/preview$/.test(path)) return json({ affected: [] });
    if (method === 'POST' && /^\/api\/shells\/locations$/.test(path)) {
      const body = JSON.parse(options.body || '{}');
      return json({ location: Object.assign({ id: 'LOC-NEW' }, body) });
    }
    if (method === 'POST' && /^\/api\/shells\/boxes$/.test(path)) {
      const body = JSON.parse(options.body || '{}');
      return json({ box: Object.assign({ id: 'BOX-NEW' }, body) });
    }
    if (method === 'POST' && /^\/api\/shells\/[^/]+\/location$/.test(path)) return json({ ok: true });
    if (method === 'POST' && /^\/api\/shells\/[^/]+\/box$/.test(path)) return json({ ok: true });

    return base.fetch(url, options);
  }

  return { fetch, LOCATIONS, BOXES };
}

// ── 1 · both panels render real server rows, grouped correctly ─────────────

test('the Locations panel splits real rows into Front of house / Back of house', async () => {
  const fixture = makeFixture();
  await withApp('pos', async (app) => {
    await app.mount('ShellLocationsModule');
    await app.waitFor(() => /Floor A1/.test(app.text()), { what: 'the fixture location to render' });
    const txt = app.text();
    assert.match(txt, /Front of house/, 'no Front of house section');
    assert.match(txt, /Back of house/, 'no Back of house section');
    assert.match(txt, /Floor A1/, 'the FOH fixture location never rendered');
    assert.match(txt, /Safe 1/, 'the BOH fixture location never rendered');
  }, { fetch: fixture.fetch });
});

test('the Boxes panel renders real server rows with a used-by count', async () => {
  const fixture = makeFixture();
  await withApp('pos', async (app) => {
    await app.mount('ShellBoxesModule');
    await app.waitFor(() => /Flower Box 1/.test(app.text()), { what: 'the fixture box to render' });
    const txt = app.text();
    assert.match(txt, /Flower Box 1/, 'the fixture box never rendered');
    assert.match(txt, /2 shells/, 'the "used by N shells" count never rendered');
  }, { fetch: fixture.fetch });
});

// ── 2 · 404/501 degrades to the promised sentence, never a crash ───────────

test('Locations degrades to "not available on this server yet" on a 404, not a crash', async () => {
  const fixture = makeFixture({ notFound: 'locations' });
  await withApp('pos', async (app) => {
    await app.mount('ShellLocationsModule');
    await app.waitFor(() => /not available on this server yet/.test(app.text()), { what: 'the not-available message' });
    assert.equal(app.errors.length, 0, 'mounting on a 404 backend threw: ' + JSON.stringify(app.errors));
  }, { fetch: fixture.fetch });
});

test('Boxes degrades to "not available on this server yet" on a 404, not a crash', async () => {
  const fixture = makeFixture({ notFound: 'boxes' });
  await withApp('pos', async (app) => {
    await app.mount('ShellBoxesModule');
    await app.waitFor(() => /not available on this server yet/.test(app.text()), { what: 'the not-available message' });
    assert.equal(app.errors.length, 0, 'mounting on a 404 backend threw: ' + JSON.stringify(app.errors));
  }, { fetch: fixture.fetch });
});

// ── 3 · the Placement section on the shell details modal reads live rows ───

const clickOpenShell = (app) => {
  const el = [...app.document.querySelectorAll('span')].find((s) => /Open shell/.test((s.textContent || '').trim()));
  if (!el) return false;
  el.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return true;
};

test('the shell Placement section renders FOH/BOH pickers and a box picker without crashing', async () => {
  const fixture = makeFixture();
  await withApp('pos', async (app) => {
    await app.mount('ShellsModule');
    await app.waitFor(() => [...app.document.querySelectorAll('span')].some((s) => /Open shell/.test((s.textContent || '').trim())),
      { what: 'the fixture shell card to render in the library' });
    assert.ok(clickOpenShell(app), 'could not click into the shell');
    await app.waitFor(() => /Mango/.test(app.text()), { what: 'the shell detail to load its products' });
    // "Shell details" opens window.ShellEditModal, which hosts PlacementSection.
    const detailsBtn = [...app.document.querySelectorAll('button')].find((b) => /Shell details/.test(b.textContent || ''));
    assert.ok(detailsBtn, 'no "Shell details" button on the shell page');
    detailsBtn.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await app.waitFor(() => /Placement/.test(app.text()), { what: 'the Placement section to render' });
    await app.settle();
    const txt = app.text();
    assert.match(txt, /Placement/, 'no Placement section on the shell details modal');
    assert.match(txt, /Front of house/, 'no Front of house row in Placement');
    assert.match(txt, /Back of house/, 'no Back of house row in Placement');
    assert.equal(app.errors.length, 0, 'the Placement section threw while rendering: ' + JSON.stringify(app.errors));
  }, { fetch: fixture.fetch });
});
