/* shared/hw-live.js — the D2 server-issued session surface, tested in isolation.
 *
 * Same "vm harness, fake fetch" shape as test/hw-restock.test.mjs, but here we
 * load the REAL shared/hw-live.js (not a plain data-layer module) into a vm
 * context whose `window` is a small hand-built fake: localStorage,
 * sessionStorage, an EventTarget for addEventListener/dispatchEvent, and a
 * fake `fetch`. hw-live.js does a LOT at load (fetches /api/state, wraps
 * ReactDOM.createRoot, paints a DOM badge) — all of that is gated behind its
 * own `armed` flag, so every test seeds `localStorage['hw-live-off']='1'`
 * first. That flag does NOT gate login()/logout()/session()/post()/get(), so
 * the session surface under test runs exactly as it does on a live page.
 *
 * Legacy (non-strict) `assert`, deliberately: hw-live.js runs inside a vm
 * context with its own realm, so an object literal it hands back is not the
 * same Object/Array constructor as this file's — assert/strict's deepEqual
 * would fail on structurally-identical values. Same reasoning as
 * hw-restock.test.mjs's own comment on this.
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(ROOT, 'shared', 'hw-live.js'), 'utf8');

const OFF_KEY = 'hw-live-off';
const TOKEN_KEY = 'hw-live-token';
const SESSION_KEY = 'hw-live-session';

// ── fakes ────────────────────────────────────────────────────────────────

function fakeStorage(opts = {}) {
  const store = new Map();
  const calls = { getItem: [], setItem: [], removeItem: [] };
  return {
    calls,
    has(k) { return store.has(k); },
    raw(k) { return store.get(k); },
    getItem(k) {
      calls.getItem.push(k);
      if (opts.throwOnGet) throw new Error('storage blocked (get)');
      return store.has(k) ? store.get(k) : null;
    },
    setItem(k, v) {
      calls.setItem.push([k, v]);
      if (opts.throwOnSet) throw new Error('storage blocked (set)');
      store.set(k, String(v));
    },
    removeItem(k) {
      calls.removeItem.push(k);
      if (opts.throwOnRemove) throw new Error('storage blocked (remove)');
      store.delete(k);
    }
  };
}

// Queue-free, handler-based fake fetch. Each handler is tried in order;
// the first whose `match(url)` returns true answers the call. `respond` is
// either a fixed shape or a function of (url, opts, callIndex) returning one:
//   { status, body, jsonError }  -> a resolved Response-alike
//   { reject: true, message }    -> a rejected fetch promise (network failure)
function fakeFetch(handlers) {
  const calls = [];
  function impl(url, opts) {
    calls.push({ url, opts, headers: (opts && opts.headers) || {}, body: opts && opts.body ? JSON.parse(opts.body) : undefined });
    for (const h of handlers) {
      if (h.match(url)) {
        const r = typeof h.respond === 'function' ? h.respond(url, opts, calls.length) : h.respond;
        if (r && r.reject) return Promise.reject(new Error(r.message || 'network failure'));
        const status = r.status == null ? 200 : r.status;
        return Promise.resolve({
          ok: status >= 200 && status < 300,
          status,
          json() { return r.jsonError ? Promise.reject(new Error('bad json')) : Promise.resolve(r.body === undefined ? {} : r.body); }
        });
      }
    }
    return Promise.reject(new Error('fakeFetch: no handler for ' + url));
  }
  impl.calls = calls;
  return impl;
}

function loadHwLive({ ls: lsOpts = {}, ss: ssOpts = {}, fetchImpl, seedLegacyToken } = {}) {
  const ls = fakeStorage(lsOpts);
  const ss = fakeStorage(ssOpts);
  ls.setItem(OFF_KEY, '1');   // disable `armed` -> no /api/state fetch, no DOM badge
  if (seedLegacyToken) ls.setItem(TOKEN_KEY, seedLegacyToken);
  ls.calls.setItem.length = 0;   // the seeding above isn't part of the module's own behaviour

  const listeners = {};
  const windowObj = {
    localStorage: ls,
    sessionStorage: ss,
    location: { origin: 'http://127.0.0.1:8812', search: '', pathname: '/', hash: '', reload() {} },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener(type, fn) { if (listeners[type]) listeners[type] = listeners[type].filter((f) => f !== fn); },
    dispatchEvent(evt) { (listeners[evt.type] || []).slice().forEach((fn) => fn(evt)); return true; }
  };
  windowObj.CustomEvent = CustomEvent;
  const fetchImplUsed = fetchImpl || fakeFetch([]);
  const context = {
    window: windowObj,
    document: { currentScript: null },
    fetch: fetchImplUsed,
    CustomEvent,
    URL,
    console
  };
  vm.createContext(context);
  vm.runInContext(SRC, context, { filename: 'shared/hw-live.js' });
  return { HW_LIVE: windowObj.HW_LIVE, ls, ss, fetch: fetchImplUsed, listeners, window: windowObj };
}

function loginHandler(respond) {
  return { match: (u) => u.endsWith('/api/session/login'), respond };
}
function logoutHandler(respond) {
  return { match: (u) => u.endsWith('/api/session/logout'), respond };
}

const GOOD_LOGIN_BODY = { token: 'sess-abc123', expires_at: '2026-09-17T12:00:00Z', scopes: ['inventory:restock'], store_ids: ['corona'] };

// ── login(): storage placement ──────────────────────────────────────────

test('login() stores the session in memory + sessionStorage only; localStorage is never used for it', async () => {
  const fetchImpl = fakeFetch([loginHandler({ status: 200, body: GOOD_LOGIN_BODY })]);
  const { HW_LIVE, ls, ss } = loadHwLive({ fetchImpl });

  const res = await HW_LIVE.login({ token: 'good-token', actor_label: 'Jamie', store_id: 'corona' });
  assert.equal(res.ok, true);
  assert.equal(res.code, 200);

  const sess = HW_LIVE.session();
  assert.deepEqual(Object.keys(sess).sort(), ['expires_at', 'label', 'scopes', 'store_ids']);
  assert.equal(sess.label, null); // server response carried no actor_label echo field itself
  assert.equal(sess.expires_at, GOOD_LOGIN_BODY.expires_at);
  assert.deepEqual(sess.scopes, GOOD_LOGIN_BODY.scopes);
  assert.deepEqual(sess.store_ids, GOOD_LOGIN_BODY.store_ids);

  // sessionStorage got the session...
  assert.ok(ss.has(SESSION_KEY), 'session must land in sessionStorage');
  const stored = JSON.parse(ss.raw(SESSION_KEY));
  assert.equal(stored.token, 'sess-abc123');

  // ...and localStorage never received a set for the session key or the token value.
  const badSets = ls.calls.setItem.filter(([k, v]) => k === SESSION_KEY || String(v).includes('sess-abc123'));
  assert.equal(badSets.length, 0, 'the session token must never be written to localStorage');
});

test('login() request body includes actor_label/store_id only when supplied', async () => {
  const fetchImpl = fakeFetch([loginHandler({ status: 200, body: GOOD_LOGIN_BODY })]);
  const { HW_LIVE, fetch } = loadHwLive({ fetchImpl });

  await HW_LIVE.login({ token: 'good-token' });
  assert.deepEqual(fetch.calls[0].body, { token: 'good-token' });

  await HW_LIVE.login({ token: 'good-token', actor_label: 'Jamie', store_id: 'corona' });
  assert.deepEqual(fetch.calls[1].body, { token: 'good-token', actor_label: 'Jamie', store_id: 'corona' });
});

// ── legacy token: used until login, then deleted ─────────────────────────

test('legacy localStorage token is sent by post() until login succeeds, then deleted', async () => {
  const fetchImpl = fakeFetch([
    loginHandler({ status: 200, body: GOOD_LOGIN_BODY }),
    { match: (u) => u.endsWith('/api/thing'), respond: { status: 200, body: { ok: true } } }
  ]);
  const { HW_LIVE, ls, fetch } = loadHwLive({ fetchImpl, seedLegacyToken: 'legacy-xyz' });

  assert.equal(ls.raw(TOKEN_KEY), 'legacy-xyz');

  await HW_LIVE.post('/api/thing', { a: 1 });
  const before = fetch.calls.find((c) => c.url.endsWith('/api/thing'));
  assert.equal(before.headers['x-hw-write-token'], 'legacy-xyz');

  await HW_LIVE.login({ token: 'good-token', actor_label: 'Jamie' });
  assert.equal(ls.has(TOKEN_KEY), false, 'legacy token must be deleted from localStorage on successful login');
  assert.ok(ls.calls.removeItem.includes(TOKEN_KEY));

  await HW_LIVE.post('/api/thing', { a: 2 });
  const after = fetch.calls.filter((c) => c.url.endsWith('/api/thing')).pop();
  assert.equal(after.headers['x-hw-write-token'], 'sess-abc123', 'post() must now send the SESSION token, not the legacy one');
});

// ── post()/get() header + 401 handling ───────────────────────────────────

test('post() attaches the session token under the x-hw-write-token header, never a different name', async () => {
  const fetchImpl = fakeFetch([
    loginHandler({ status: 200, body: GOOD_LOGIN_BODY }),
    { match: (u) => u.endsWith('/api/write'), respond: { status: 200, body: {} } }
  ]);
  const { HW_LIVE, fetch } = loadHwLive({ fetchImpl });
  await HW_LIVE.login({ token: 'good-token', actor_label: 'Jamie' });
  await HW_LIVE.post('/api/write', {});
  const call = fetch.calls.find((c) => c.url.endsWith('/api/write'));
  assert.equal(call.headers['x-hw-write-token'], 'sess-abc123');
  assert.equal(Object.keys(call.headers).includes('Authorization'), false);
});

test('a 401 from post() clears the session and fires hw-live:unauthenticated', async () => {
  const fetchImpl = fakeFetch([
    loginHandler({ status: 200, body: GOOD_LOGIN_BODY }),
    { match: (u) => u.endsWith('/api/write'), respond: { status: 401, body: { error: 'unauthorized' } } }
  ]);
  const { HW_LIVE, window } = loadHwLive({ fetchImpl });
  await HW_LIVE.login({ token: 'good-token', actor_label: 'Jamie' });
  assert.ok(HW_LIVE.session(), 'session must exist before the 401');

  let fired = 0;
  window.addEventListener('hw-live:unauthenticated', () => { fired += 1; });
  const res = await HW_LIVE.post('/api/write', {});
  assert.equal(res.ok, false);
  assert.equal(res.code, 401);
  assert.equal(HW_LIVE.session(), null, 'session must be cleared after a 401');
  assert.equal(fired, 1);
});

test('a 401 from get() also clears the session and fires hw-live:unauthenticated', async () => {
  const fetchImpl = fakeFetch([
    loginHandler({ status: 200, body: GOOD_LOGIN_BODY }),
    { match: (u) => u.endsWith('/api/read'), respond: { status: 401, body: { error: 'unauthorized' } } }
  ]);
  const { HW_LIVE, window } = loadHwLive({ fetchImpl });
  await HW_LIVE.login({ token: 'good-token', actor_label: 'Jamie' });

  let fired = 0;
  window.addEventListener('hw-live:unauthenticated', () => { fired += 1; });
  const res = await HW_LIVE.get('/api/read');
  assert.equal(res.ok, false);
  assert.equal(HW_LIVE.session(), null);
  assert.equal(fired, 1);
});

// ── logout() ──────────────────────────────────────────────────────────────

test('logout() sends the current session token as x-hw-write-token and clears the session', async () => {
  const fetchImpl = fakeFetch([
    loginHandler({ status: 200, body: GOOD_LOGIN_BODY }),
    logoutHandler({ status: 200, body: { ok: true } })
  ]);
  const { HW_LIVE, fetch } = loadHwLive({ fetchImpl });
  await HW_LIVE.login({ token: 'good-token', actor_label: 'Jamie' });
  const result = await HW_LIVE.logout();
  assert.equal(result, true);
  assert.equal(HW_LIVE.session(), null);
  const call = fetch.calls.find((c) => c.url.endsWith('/api/session/logout'));
  assert.equal(call.headers['x-hw-write-token'], 'sess-abc123');
});

test('logout() clears the session locally even when the network call itself fails', async () => {
  const fetchImpl = fakeFetch([
    loginHandler({ status: 200, body: GOOD_LOGIN_BODY }),
    logoutHandler({ reject: true })
  ]);
  const { HW_LIVE } = loadHwLive({ fetchImpl });
  await HW_LIVE.login({ token: 'good-token', actor_label: 'Jamie' });
  const result = await HW_LIVE.logout();
  assert.equal(result, true, 'an operator asking to log out must end up logged out locally regardless');
  assert.equal(HW_LIVE.session(), null);
});

test('logout() with no active credential sends no x-hw-write-token header and still resolves true', async () => {
  const fetchImpl = fakeFetch([logoutHandler({ status: 200, body: { ok: true } })]);
  const { HW_LIVE, fetch } = loadHwLive({ fetchImpl });
  const result = await HW_LIVE.logout();
  assert.equal(result, true);
  const call = fetch.calls.find((c) => c.url.endsWith('/api/session/logout'));
  assert.equal(Object.prototype.hasOwnProperty.call(call.headers, 'x-hw-write-token'), false);
});

// ── session() shape ───────────────────────────────────────────────────────

test('session() is null before any login', () => {
  const { HW_LIVE } = loadHwLive({ fetchImpl: fakeFetch([]) });
  assert.equal(HW_LIVE.session(), null);
});

test('session() never exposes the token itself', async () => {
  const fetchImpl = fakeFetch([loginHandler({ status: 200, body: GOOD_LOGIN_BODY })]);
  const { HW_LIVE } = loadHwLive({ fetchImpl });
  await HW_LIVE.login({ token: 'good-token', actor_label: 'Jamie' });
  const sess = HW_LIVE.session();
  assert.equal(Object.prototype.hasOwnProperty.call(sess, 'token'), false);
  assert.equal(JSON.stringify(sess).includes('sess-abc123'), false);
});

// ── wrong token / rate limit / malformed response ─────────────────────────

test('login() with a wrong token: 401, ok:false, no session created, error is the server text', async () => {
  const fetchImpl = fakeFetch([loginHandler({ status: 401, body: { error: 'unauthorized' } })]);
  const { HW_LIVE } = loadHwLive({ fetchImpl });
  const res = await HW_LIVE.login({ token: 'wrong', actor_label: 'Jamie' });
  assert.equal(res.ok, false);
  assert.equal(res.code, 401);
  assert.equal(res.session, null);
  assert.equal(res.error, 'unauthorized');
  assert.equal(HW_LIVE.session(), null);
});

test('login() rate-limited: 429, ok:false, "too many" in the error text', async () => {
  const fetchImpl = fakeFetch([loginHandler({ status: 429, body: { error: 'too many failed attempts, try again later' } })]);
  const { HW_LIVE } = loadHwLive({ fetchImpl });
  const res = await HW_LIVE.login({ token: 'whatever', actor_label: 'Jamie' });
  assert.equal(res.ok, false);
  assert.equal(res.code, 429);
  assert.match(res.error, /too many/i);
  assert.equal(HW_LIVE.session(), null);
});

test('login() with a 200 that is not valid JSON is treated as a failure, not a silent success', async () => {
  const fetchImpl = fakeFetch([loginHandler({ status: 200, jsonError: true })]);
  const { HW_LIVE } = loadHwLive({ fetchImpl });
  const res = await HW_LIVE.login({ token: 'good-token', actor_label: 'Jamie' });
  assert.equal(res.ok, false);
  assert.equal(res.code, 200);
  assert.equal(res.session, null);
  assert.equal(HW_LIVE.session(), null);
});

test('login() never rejects, even when fetch itself throws (offline)', async () => {
  const fetchImpl = fakeFetch([loginHandler({ reject: true, message: 'Failed to fetch' })]);
  const { HW_LIVE } = loadHwLive({ fetchImpl });
  const res = await HW_LIVE.login({ token: 'good-token', actor_label: 'Jamie' });
  assert.equal(res.ok, false);
  assert.equal(res.code, 0);
  assert.match(res.error, /request failed/);
});

// ── sessionStorage unavailable (private browsing) ─────────────────────────

test('sessionStorage.setItem throwing (private mode) does not break login()', async () => {
  const fetchImpl = fakeFetch([loginHandler({ status: 200, body: GOOD_LOGIN_BODY })]);
  const { HW_LIVE } = loadHwLive({ fetchImpl, ss: { throwOnSet: true } });
  const res = await HW_LIVE.login({ token: 'good-token', actor_label: 'Jamie' });
  assert.equal(res.ok, true, 'login must still succeed even though persisting it failed');
  const sess = HW_LIVE.session();
  assert.ok(sess, 'the in-memory session must still be set regardless of storage');
  assert.deepEqual(sess.store_ids, GOOD_LOGIN_BODY.store_ids);
});

test('sessionStorage.getItem throwing at load time does not break module load or login()', async () => {
  const fetchImpl = fakeFetch([loginHandler({ status: 200, body: GOOD_LOGIN_BODY })]);
  const { HW_LIVE } = loadHwLive({ fetchImpl, ss: { throwOnGet: true } });
  assert.equal(HW_LIVE.session(), null, 'a throwing read at load must degrade to "no session", not a crash');
  const res = await HW_LIVE.login({ token: 'good-token', actor_label: 'Jamie' });
  assert.equal(res.ok, true);
});

// ── refuter finding #1: realtime re-arm on login, teardown on logout/401 ──
//
// `armed` (module-level, from OFF_KEY) gates armRealtime() as well as the
// initial load(), so every test above sets OFF_KEY and never exercises the
// wiring at all -- that is by design (see this file's header comment) for
// the session-surface tests, but the realtime wiring itself needs `armed`
// true to run. This harness variant leaves it on and stubs just enough
// (a fake `window.HWRealtime`, `/api/state`, the fulfilment board, and
// `/api/session/me`) for load()/armRealtime() to complete without a real
// POS page underneath them -- no `window.HW`, no `window.THEMES`, so
// paintBadge()/the window.HW setter stay no-ops the whole time (see
// palette()'s own `if (!W.THEMES) return null` and paintBadge()'s own
// `if (!_badge)` guard), which is what this test needs: only the realtime
// seam, nothing else standing up.
function fakeHWRealtime() {
  const subs = [];
  return {
    subs,
    supportsStreaming: true,
    subscribe(opts) {
      const handle = { opts, stopped: false, status: 'live' };
      handle.stop = () => { handle.stopped = true; };
      subs.push(handle);
      return handle;
    }
  };
}

function meHandler(respond) {
  return { match: (u) => u.endsWith('/api/session/me'), respond };
}
function stateHandler(respond) {
  return { match: (u) => u.endsWith('/api/state'), respond };
}
function boardHandler(respond) {
  return { match: (u) => u.includes('/api/fulfillment/'), respond };
}

function loadHwLiveArmed({ fetchHandlers = [], hwRealtime } = {}) {
  const ls = fakeStorage();
  const ss = fakeStorage();
  // No OFF_KEY seeded -- `armed` stays true.
  const listeners = {};
  const windowObj = {
    localStorage: ls,
    sessionStorage: ss,
    location: { origin: 'http://127.0.0.1:8812', search: '', pathname: '/', hash: '', reload() {} },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener(type, fn) { if (listeners[type]) listeners[type] = listeners[type].filter((f) => f !== fn); },
    dispatchEvent(evt) { (listeners[evt.type] || []).slice().forEach((fn) => fn(evt)); return true; },
    HWRealtime: hwRealtime,
    AbortController,
  };
  windowObj.CustomEvent = CustomEvent;
  const fetchImplUsed = fakeFetch([
    stateHandler({ status: 503 }),          // no real catalog here -- load() degrades to 'unreachable'
    boardHandler({ status: 404 }),          // loadBoard() catches this and returns false
    ...fetchHandlers,
  ]);
  const context = {
    window: windowObj,
    document: { currentScript: null },
    fetch: fetchImplUsed,
    CustomEvent,
    URL,
    AbortController,
    performance,
    setTimeout, clearTimeout, setInterval, clearInterval,
    console
  };
  vm.createContext(context);
  vm.runInContext(SRC, context, { filename: 'shared/hw-live.js' });
  return { HW_LIVE: windowObj.HW_LIVE, ls, ss, fetch: fetchImplUsed, listeners, window: windowObj };
}

test('a successful login() re-arms a realtime subscription scoped to /api/session/me\'s store_ids', async () => {
  const rt = fakeHWRealtime();
  const fetchHandlers = [
    loginHandler({ status: 200, body: GOOD_LOGIN_BODY }),
    meHandler({ status: 200, body: { store_ids: ['corona'], entity_ids: [] } }),
  ];
  const { HW_LIVE } = loadHwLiveArmed({ hwRealtime: rt, fetchHandlers });

  const res = await HW_LIVE.login({ token: 'good-token', actor_label: 'Jamie', store_id: 'corona' });
  assert.equal(res.ok, true);
  await new Promise((r) => setTimeout(r, 0));  // let armRealtime()'s /api/session/me chain settle
  assert.equal(rt.subs.length, 1, 'login() must arm exactly one realtime subscription');
  assert.deepEqual(rt.subs[0].opts.channels.slice().sort(),
    ['inventory.store.corona', 'lp.store.corona', 'orders.store.corona', 'register.store.corona'].sort());
  assert.equal(typeof rt.subs[0].opts.onUnauthenticated, 'function');
});

test('the realtime onUnauthenticated callback clears the session and fires hw-live:unauthenticated, and stops the subscription', async () => {
  const rt = fakeHWRealtime();
  const fetchHandlers = [
    loginHandler({ status: 200, body: GOOD_LOGIN_BODY }),
    meHandler({ status: 200, body: { store_ids: ['corona'], entity_ids: [] } }),
  ];
  const { HW_LIVE, window: win } = loadHwLiveArmed({ hwRealtime: rt, fetchHandlers });
  await HW_LIVE.login({ token: 'good-token', actor_label: 'Jamie', store_id: 'corona' });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(rt.subs.length, 1);
  const handle = rt.subs[0];

  let unauthFired = 0;
  win.addEventListener('hw-live:unauthenticated', () => { unauthFired++; });
  handle.opts.onUnauthenticated();

  assert.equal(HW_LIVE.session(), null, 'a dead realtime credential must clear the session, exactly like a 401 on a normal fetch');
  assert.equal(unauthFired, 1);
  assert.equal(handle.stopped, true, 'the subscription itself must be stopped, not left dangling');
});

test('logout() stops the armed realtime subscription (abort the reader) as part of clearing the session', async () => {
  const rt = fakeHWRealtime();
  const fetchHandlers = [
    loginHandler({ status: 200, body: GOOD_LOGIN_BODY }),
    meHandler({ status: 200, body: { store_ids: ['corona'], entity_ids: [] } }),
    logoutHandler({ status: 200, body: {} }),
  ];
  const { HW_LIVE } = loadHwLiveArmed({ hwRealtime: rt, fetchHandlers });
  await HW_LIVE.login({ token: 'good-token', actor_label: 'Jamie', store_id: 'corona' });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(rt.subs.length, 1);
  const handle = rt.subs[0];
  assert.equal(handle.stopped, false);

  await HW_LIVE.logout();
  assert.equal(handle.stopped, true);
  assert.equal(HW_LIVE.session(), null);
});
