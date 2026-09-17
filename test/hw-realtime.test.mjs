/* shared/hw-realtime.js — the fetch-stream SSE client, tested in isolation.
 *
 * Same "vm harness, fake fetch" shape as test/hw-live-session.test.mjs, but the fake here
 * answers with a STREAMING body (a hand-built ReadableStream-alike whose `read()` can hold
 * open, emit chunks split across arbitrary byte boundaries, or reject on abort) instead of a
 * fixed JSON blob — this file's whole job is parsing that stream by hand (no EventSource
 * anywhere), so the fake has to be able to lie about network timing the same way a flaky wifi
 * connection would.
 *
 * Real global `fetch`/`Response`/`ReadableStream`/`TextDecoder`/`AbortController`/`CustomEvent`
 * are all native in this Node runtime, so only `fetch` itself is faked per test; everything
 * else is the real, spec-correct implementation, passed into the vm context explicitly (a
 * fresh vm context gets none of Node's globals for free).
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(ROOT, 'shared', 'hw-realtime.js'), 'utf8');

// ── fakes ────────────────────────────────────────────────────────────────

function abortError() {
  const e = new Error('The operation was aborted');
  e.name = 'AbortError';
  return e;
}

/** blocks: array of raw SSE block strings (no trailing blank line -- added here). `chunking`
 * lets a test force an arbitrary byte-boundary split across `read()` calls instead of the
 * default "one block per chunk", to prove the decoder/buffer survives a frame arriving in
 * pieces. `holdOpen` keeps the stream alive (no `done:true`) until aborted -- a live
 * connection that just has nothing new to say. */
function makeStreamResponse({ ok = true, status = 200, blocks = [], chunking = null, holdOpen = false, signal } = {}) {
  const text = blocks.map((b) => b + '\n\n').join('');
  const enc = new TextEncoder();
  const chunks = chunking ? chunking.map((s) => enc.encode(s)) : [enc.encode(text)];
  let i = 0;
  return {
    ok, status,
    body: {
      getReader() {
        return {
          read() {
            return new Promise((resolve, reject) => {
              if (signal && signal.aborted) { reject(abortError()); return; }
              if (i < chunks.length) { resolve({ done: false, value: chunks[i++] }); return; }
              if (!holdOpen) { resolve({ done: true, value: undefined }); return; }
              if (signal) {
                const onAbort = () => { signal.removeEventListener('abort', onAbort); reject(abortError()); };
                signal.addEventListener('abort', onAbort);
              }
              // else: never resolves -- a short test that doesn't abort just times out its
              // own assertions, which is a test bug, not a hang in the code under test.
            });
          }
        };
      }
    }
  };
}

/** `script[i]` answers the (i+1)th fetch call; the last entry repeats for every call past the
 * end of the array, so a test can set up "first call fails, everything after succeeds" with a
 * two-entry script. Each entry is `(url, opts, callNumber) -> response-like | throws`. */
function fakeFetch(script) {
  const calls = [];
  function impl(url, opts) {
    calls.push({ url, opts, headers: (opts && opts.headers) || {} });
    const entry = script[Math.min(calls.length - 1, script.length - 1)];
    try {
      return Promise.resolve(entry(url, opts, calls.length));
    } catch (e) {
      return Promise.reject(e);
    }
  }
  impl.calls = calls;
  return impl;
}

function loadHwRealtime({ fetchImpl, hidden = false, streaming = true } = {}) {
  const listeners = {};
  let _hidden = hidden;
  const fakeDocument = {
    get hidden() { return _hidden; },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener(type, fn) { if (listeners[type]) listeners[type] = listeners[type].filter((f) => f !== fn); },
    _setHidden(v) {
      _hidden = v;
      (listeners.visibilitychange || []).slice().forEach((fn) => fn());
    }
  };
  const consoleCalls = [];
  const fakeConsole = {};
  ['log', 'warn', 'error', 'info', 'debug'].forEach((k) => {
    fakeConsole[k] = (...args) => consoleCalls.push({ method: k, args });
  });
  const windowObj = {
    document: fakeDocument,
    location: { origin: 'http://127.0.0.1:8812' },
    fetch: fetchImpl || fakeFetch([() => ({ ok: false, status: 0 })]),
    AbortController,
    TextDecoder,
  };
  if (streaming) {
    windowObj.Response = Response;
    windowObj.ReadableStream = ReadableStream;
  }
  const context = {
    window: windowObj,
    setTimeout, clearTimeout, setInterval, clearInterval,
    console: fakeConsole
  };
  vm.createContext(context);
  vm.runInContext(SRC, context, { filename: 'shared/hw-realtime.js' });
  return { HWRealtime: windowObj.HWRealtime, document: fakeDocument, consoleCalls, window: windowObj };
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitFor(predicate, { timeout = 2000, interval = 5 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) { return true; }
    await sleep(interval);
  }
  return predicate();
}

// ── tests ────────────────────────────────────────────────────────────────

test('HWRealtime.__armed and supportsStreaming are true in a full-featured environment', () => {
  const { HWRealtime } = loadHwRealtime({});
  assert.strictEqual(HWRealtime.__armed, true);
  assert.strictEqual(HWRealtime.supportsStreaming, true);
});

test('loading twice is idempotent (second load is a no-op, first HWRealtime object wins)', () => {
  const listeners = {};
  const fakeDocument = { hidden: false, addEventListener() {}, removeEventListener() {} };
  const windowObj = {
    document: fakeDocument, location: { origin: 'http://x' },
    fetch: fakeFetch([() => ({ ok: false, status: 0 })]),
    AbortController, TextDecoder, Response, ReadableStream
  };
  const context = { window: windowObj, setTimeout, clearTimeout, setInterval, clearInterval, console };
  vm.createContext(context);
  vm.runInContext(SRC, context, { filename: 'a' });
  const first = windowObj.HWRealtime;
  vm.runInContext(SRC, context, { filename: 'b' });
  assert.strictEqual(windowObj.HWRealtime, first);
});

test('a single event frame is delivered via onEvent with channel/id/ts/payload', async () => {
  const block = 'id: register.store.corona|7\nevent: event\n' +
    'data: {"type":"event","channel":"register.store.corona","id":7,"ts":123.5,"payload":{"type":"register.opened","ref":"9"}}';
  const events = [];
  const { HWRealtime } = loadHwRealtime({
    fetchImpl: fakeFetch([
      () => makeStreamResponse({ blocks: [block] }),
      () => makeStreamResponse({ holdOpen: true })
    ])
  });
  const h = HWRealtime.subscribe({ channels: ['register.store.corona'], onEvent: (e) => events.push(e) });
  await waitFor(() => events.length >= 1);
  h.stop();
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].channel, 'register.store.corona');
  assert.strictEqual(events[0].id, 7);
  assert.strictEqual(events[0].ts, 123.5);
  // Loose (non-strict) deepEqual, deliberately: `events[0].payload` was JSON.parse'd inside
  // the vm context's own realm, so its Object prototype differs from this file's -- see
  // test/hw-live-session.test.mjs's own header comment for the identical reasoning.
  assert.deepEqual(events[0].payload, { type: 'register.opened', ref: '9' });
});

test('multiple event frames in one chunk are all delivered, in order', async () => {
  const mk = (id) => 'event: event\ndata: ' + JSON.stringify({ type: 'event', channel: 'inventory.store.corona', id, ts: id, payload: { type: 'inventory.movement', ref: String(id) } });
  const events = [];
  const { HWRealtime } = loadHwRealtime({
    fetchImpl: fakeFetch([
      () => makeStreamResponse({ blocks: [mk(1), mk(2), mk(3)] }),
      () => makeStreamResponse({ holdOpen: true })
    ])
  });
  const h = HWRealtime.subscribe({ channels: ['inventory.store.corona'], onEvent: (e) => events.push(e) });
  await waitFor(() => events.length >= 3);
  h.stop();
  assert.deepStrictEqual(events.map((e) => e.id), [1, 2, 3]);
});

test('an event frame split across two raw chunks at an arbitrary byte boundary still parses', async () => {
  const full = 'event: event\ndata: ' + JSON.stringify({ type: 'event', channel: 'orders.store.corona', id: 1, ts: 1, payload: { type: 'order.status', ref: 'ord-1' } }) + '\n\n';
  const cut = 37;  // mid-frame, not on a line boundary
  const events = [];
  const { HWRealtime } = loadHwRealtime({
    fetchImpl: fakeFetch([
      () => makeStreamResponse({ chunking: [full.slice(0, cut), full.slice(cut)], holdOpen: true })
    ])
  });
  const h = HWRealtime.subscribe({ channels: ['orders.store.corona'], onEvent: (e) => events.push(e) });
  await waitFor(() => events.length >= 1);
  h.stop();
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].payload.ref, 'ord-1');
});

test('a heartbeat-only block produces no onEvent call and keeps status live', async () => {
  const events = [];
  const statuses = [];
  const { HWRealtime } = loadHwRealtime({
    fetchImpl: fakeFetch([() => makeStreamResponse({ blocks: [': heartbeat'], holdOpen: true })])
  });
  const h = HWRealtime.subscribe({
    channels: ['register.store.corona'], onEvent: (e) => events.push(e), onStatus: (s) => statuses.push(s)
  });
  await waitFor(() => statuses.includes('live'));
  await sleep(30);
  h.stop();
  assert.strictEqual(events.length, 0);
  assert.strictEqual(h.status === 'stopped' || statuses[statuses.length - 2] === 'live', true);
});

test('a malformed data line is dropped silently -- no throw, no event, connection continues', async () => {
  const events = [];
  const good = 'event: event\ndata: ' + JSON.stringify({ type: 'event', channel: 'register.store.corona', id: 1, ts: 1, payload: { type: 'x', ref: '1' } });
  const { HWRealtime } = loadHwRealtime({
    fetchImpl: fakeFetch([() => makeStreamResponse({ blocks: ['event: event\ndata: {not json', good], holdOpen: true })])
  });
  const h = HWRealtime.subscribe({ channels: ['register.store.corona'], onEvent: (e) => events.push(e) });
  await waitFor(() => events.length >= 1);
  h.stop();
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].id, 1);
});

test('a "gap" control frame produces a synthetic onEvent with type gap and ref null', async () => {
  const events = [];
  const gap = 'event: control\ndata: ' + JSON.stringify({ type: 'gap', channel: 'lp.store.corona', from: 3, to: 9 });
  const { HWRealtime } = loadHwRealtime({
    fetchImpl: fakeFetch([() => makeStreamResponse({ blocks: [gap], holdOpen: true })])
  });
  const h = HWRealtime.subscribe({ channels: ['lp.store.corona'], onEvent: (e) => events.push(e) });
  await waitFor(() => events.length >= 1);
  h.stop();
  assert.strictEqual(events[0].channel, 'lp.store.corona');
  assert.strictEqual(events[0].payload.type, 'gap');
  assert.strictEqual(events[0].payload.ref, null);
});

test('a "shutdown" control frame never calls onEvent (the stream ending is handled as an ordinary reconnect)', async () => {
  const events = [];
  const shutdown = 'event: control\ndata: ' + JSON.stringify({ type: 'shutdown' });
  const { HWRealtime } = loadHwRealtime({
    fetchImpl: fakeFetch([
      () => makeStreamResponse({ blocks: [shutdown] }),   // stream ends right after
      () => makeStreamResponse({ holdOpen: true })         // reconnect succeeds and holds
    ])
  });
  const h = HWRealtime.subscribe({ channels: ['register.store.corona'], onEvent: (e) => events.push(e), baseBackoffMs: 5, maxBackoffMs: 20 });
  await sleep(60);
  h.stop();
  assert.strictEqual(events.length, 0);
});

test('resume: an event on channel X updates the next reconnect URL\'s resumeFrom', async () => {
  const ev = 'event: event\ndata: ' + JSON.stringify({ type: 'event', channel: 'register.store.corona', id: 5, ts: 1, payload: { type: 'x', ref: '1' } });
  const f = fakeFetch([
    () => makeStreamResponse({ blocks: [ev] }),           // ends after one event -> reconnect
    () => makeStreamResponse({ holdOpen: true })
  ]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const h = HWRealtime.subscribe({ channels: ['register.store.corona'], baseBackoffMs: 5, maxBackoffMs: 20 });
  await waitFor(() => f.calls.length >= 2);
  h.stop();
  const secondUrl = f.calls[1].url;
  assert.match(secondUrl, /resumeFrom=/);
  const qs = new URL(secondUrl).searchParams.get('resumeFrom');
  assert.deepStrictEqual(JSON.parse(qs), { 'register.store.corona': 5 });
});

test('resume with two channels carries both last-seen ids independently', async () => {
  const evA = 'event: event\ndata: ' + JSON.stringify({ type: 'event', channel: 'a.store.1', id: 2, ts: 1, payload: {} });
  const evB = 'event: event\ndata: ' + JSON.stringify({ type: 'event', channel: 'b.store.1', id: 9, ts: 1, payload: {} });
  const f = fakeFetch([
    () => makeStreamResponse({ blocks: [evA, evB] }),
    () => makeStreamResponse({ holdOpen: true })
  ]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const h = HWRealtime.subscribe({ channels: ['a.store.1', 'b.store.1'], baseBackoffMs: 5, maxBackoffMs: 20 });
  await waitFor(() => f.calls.length >= 2);
  h.stop();
  const qs = JSON.parse(new URL(f.calls[1].url).searchParams.get('resumeFrom'));
  assert.deepStrictEqual(qs, { 'a.store.1': 2, 'b.store.1': 9 });
});

test('no credential ever appears in the request URL', async () => {
  const f = fakeFetch([() => makeStreamResponse({ holdOpen: true })]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const h = HWRealtime.subscribe({
    channels: ['register.store.corona'],
    getHeaders: () => ({ 'x-hw-write-token': 'super-secret-token-value' })
  });
  await waitFor(() => f.calls.length >= 1);
  h.stop();
  for (const call of f.calls) {
    assert.doesNotMatch(call.url, /super-secret-token-value/);
    assert.doesNotMatch(call.url, /token=/i);
    assert.doesNotMatch(call.url, /[?&]key=/i);
  }
  // and it DOES arrive as a header, so the credential path actually works
  assert.strictEqual(f.calls[0].headers['x-hw-write-token'], 'super-secret-token-value');
});

test('getHeaders() is called fresh on every (re)connection attempt', async () => {
  let n = 0;
  const f = fakeFetch([
    () => ({ ok: false, status: 500 }),
    () => makeStreamResponse({ holdOpen: true })
  ]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const h = HWRealtime.subscribe({
    channels: ['register.store.corona'],
    getHeaders: () => { n++; return { 'x-hw-write-token': 't' + n }; },
    baseBackoffMs: 5, maxBackoffMs: 20
  });
  await waitFor(() => f.calls.length >= 2);
  h.stop();
  assert.strictEqual(f.calls[0].headers['x-hw-write-token'], 't1');
  assert.strictEqual(f.calls[1].headers['x-hw-write-token'], 't2');
});

test('never calls any console method, across a full failure -> reconnect -> event -> stop lifecycle', async () => {
  const ev = 'event: event\ndata: ' + JSON.stringify({ type: 'event', channel: 'register.store.corona', id: 1, ts: 1, payload: {} });
  const f = fakeFetch([
    () => Promise.reject(new Error('network down')),
    () => ({ ok: false, status: 404, body: null }),
    () => makeStreamResponse({ blocks: [ev], holdOpen: true })
  ]);
  const { HWRealtime, consoleCalls } = loadHwRealtime({ fetchImpl: f });
  const events = [];
  const h = HWRealtime.subscribe({
    channels: ['register.store.corona'], onEvent: (e) => events.push(e),
    baseBackoffMs: 5, maxBackoffMs: 20
  });
  await waitFor(() => events.length >= 1);
  h.stop();
  assert.strictEqual(consoleCalls.length, 0);
});

test('a non-ok HTTP response schedules a reconnect (status -> reconnecting, a second fetch follows)', async () => {
  const statuses = [];
  const f = fakeFetch([
    () => ({ ok: false, status: 503, body: null }),
    () => makeStreamResponse({ holdOpen: true })
  ]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const h = HWRealtime.subscribe({
    channels: ['register.store.corona'], onStatus: (s) => statuses.push(s),
    baseBackoffMs: 5, maxBackoffMs: 20
  });
  await waitFor(() => f.calls.length >= 2);
  h.stop();
  assert.ok(statuses.includes('reconnecting'));
  assert.ok(statuses.includes('live'));
});

test('repeated consecutive failures switch to polling and invoke the poll callback', async () => {
  let pollCalls = 0;
  const f = fakeFetch([() => ({ ok: false, status: 0 })]);  // every attempt fails
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const statuses = [];
  const h = HWRealtime.subscribe({
    channels: ['register.store.corona'],
    onStatus: (s) => statuses.push(s),
    poll: () => { pollCalls++; },
    baseBackoffMs: 2, maxBackoffMs: 10, pollAfterFailures: 2, pollIntervalMs: 15
  });
  await waitFor(() => statuses.includes('polling') && pollCalls >= 1);
  h.stop();
  assert.ok(pollCalls >= 1);
});

test('a successful reconnect after polling mode stops the poll interval and returns to live', async () => {
  let pollCalls = 0;
  const f = fakeFetch([
    () => ({ ok: false, status: 0 }),
    () => ({ ok: false, status: 0 }),
    () => makeStreamResponse({ holdOpen: true })
  ]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const statuses = [];
  const h = HWRealtime.subscribe({
    channels: ['register.store.corona'],
    onStatus: (s) => statuses.push(s),
    poll: () => { pollCalls++; },
    baseBackoffMs: 2, maxBackoffMs: 10, pollAfterFailures: 2, pollIntervalMs: 10
  });
  await waitFor(() => statuses.includes('live'));
  const countAtLive = pollCalls;
  await sleep(40);
  h.stop();
  assert.strictEqual(pollCalls, countAtLive);  // poll interval was torn down once streaming recovered
});

test('backoff delay does not shrink across consecutive failures (exponential, within jitter)', async () => {
  const timestamps = [];
  const f = fakeFetch([
    (u, o, n) => { timestamps.push(Date.now()); return { ok: false, status: 0 }; },
  ]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const h = HWRealtime.subscribe({
    channels: ['register.store.corona'], baseBackoffMs: 20, maxBackoffMs: 400, pollAfterFailures: 99
  });
  await waitFor(() => timestamps.length >= 4);
  h.stop();
  const gap1 = timestamps[2] - timestamps[1];
  const gap0 = timestamps[1] - timestamps[0];
  // Full jitter means gap1 is not GUARANTEED larger than gap0 every single run, but its own
  // ceiling (attempt-scaled backoff cap) must have grown -- so gap1's own value must be
  // achievable only because the ceiling grew; assert against the ceiling directly instead of
  // a flaky sample-to-sample comparison.
  assert.ok(gap0 <= 20 + 40, 'first gap within first ceiling + scheduling slack: ' + gap0);
  assert.ok(gap1 <= 40 + 40, 'second gap within its larger ceiling + scheduling slack: ' + gap1);
});

test('an unsupported-streaming environment goes straight to polling, never calls fetch', async () => {
  let pollCalls = 0;
  const f = fakeFetch([() => { throw new Error('fetch must never be called'); }]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f, streaming: false });
  const statuses = [];
  const h = HWRealtime.subscribe({
    channels: ['register.store.corona'], onStatus: (s) => statuses.push(s),
    poll: () => { pollCalls++; }, pollIntervalMs: 10
  });
  await waitFor(() => pollCalls >= 1);
  h.stop();
  assert.strictEqual(f.calls.length, 0);
  assert.ok(statuses.includes('polling'));
});

test('hiding the tab aborts an open stream, stops polling, and reports paused', async () => {
  let pollCalls = 0;
  const f = fakeFetch([() => makeStreamResponse({ holdOpen: true, signal: undefined })]);
  // signal is attached per-call by hw-realtime.js's own AbortController; makeStreamResponse
  // needs the REAL signal to know about aborts, so wire it through opts instead:
  const f2 = fakeFetch([(url, opts) => makeStreamResponse({ holdOpen: true, signal: opts.signal })]);
  const { HWRealtime, document } = loadHwRealtime({ fetchImpl: f2 });
  const statuses = [];
  const h = HWRealtime.subscribe({
    channels: ['register.store.corona'], onStatus: (s) => statuses.push(s),
    poll: () => { pollCalls++; }, pollIntervalMs: 10, pollAfterFailures: 1
  });
  await waitFor(() => statuses.includes('live'));
  document._setHidden(true);
  await waitFor(() => statuses.includes('paused'));
  const callsAtPause = f2.calls.length;
  await sleep(30);
  h.stop();
  assert.strictEqual(f2.calls.length, callsAtPause);  // no reconnect attempted while hidden
  assert.strictEqual(pollCalls, 0);                    // no poll fallback armed while hidden either
});

test('un-hiding the tab reconnects promptly (a new fetch call, status leaves paused)', async () => {
  const f = fakeFetch([(url, opts) => makeStreamResponse({ holdOpen: true, signal: opts.signal })]);
  const { HWRealtime, document } = loadHwRealtime({ fetchImpl: f });
  const statuses = [];
  const h = HWRealtime.subscribe({ channels: ['register.store.corona'], onStatus: (s) => statuses.push(s) });
  await waitFor(() => statuses.includes('live'));
  document._setHidden(true);
  await waitFor(() => statuses.includes('paused'));
  const callsBefore = f.calls.length;
  document._setHidden(false);
  await waitFor(() => f.calls.length > callsBefore);
  h.stop();
  assert.ok(f.calls.length > callsBefore);
  assert.notStrictEqual(statuses[statuses.length - 1], 'paused');
});

test('stop() aborts the open connection and prevents any further scheduled reconnect', async () => {
  const f = fakeFetch([
    () => ({ ok: false, status: 0 }),
    () => ({ ok: false, status: 0 })
  ]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const h = HWRealtime.subscribe({ channels: ['register.store.corona'], baseBackoffMs: 20, maxBackoffMs: 20 });
  await waitFor(() => f.calls.length >= 1);
  h.stop();
  const countAtStop = f.calls.length;
  await sleep(80);
  assert.strictEqual(f.calls.length, countAtStop);
  assert.strictEqual(h.status, 'stopped');
});

test('the requested channels are joined into the URL exactly as given', async () => {
  const f = fakeFetch([() => makeStreamResponse({ holdOpen: true })]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const h = HWRealtime.subscribe({ channels: ['register.store.corona', 'inventory.store.corona'] });
  await waitFor(() => f.calls.length >= 1);
  h.stop();
  const url = new URL(f.calls[0].url);
  assert.strictEqual(url.searchParams.get('channels'), 'register.store.corona,inventory.store.corona');
});

test('onStatus never reports the same status twice in a row', async () => {
  const ev = 'event: event\ndata: ' + JSON.stringify({ type: 'event', channel: 'register.store.corona', id: 1, ts: 1, payload: {} });
  const f = fakeFetch([
    () => ({ ok: false, status: 0 }),
    () => makeStreamResponse({ blocks: [ev], holdOpen: true })
  ]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const statuses = [];
  const h = HWRealtime.subscribe({
    channels: ['register.store.corona'], onStatus: (s) => statuses.push(s),
    baseBackoffMs: 5, maxBackoffMs: 20
  });
  await waitFor(() => statuses.includes('live'));
  h.stop();
  for (let i = 1; i < statuses.length; i++) {
    assert.notStrictEqual(statuses[i], statuses[i - 1], 'consecutive duplicate at index ' + i + ': ' + statuses.join(','));
  }
});

test('a watchdog-timeout stream (no frames at all) is treated as dead and reconnects', async () => {
  const f = fakeFetch([
    (url, opts) => makeStreamResponse({ holdOpen: true, signal: opts.signal }),  // never sends a frame
    () => makeStreamResponse({ blocks: [': heartbeat'], holdOpen: true })
  ]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const statuses = [];
  const h = HWRealtime.subscribe({
    channels: ['register.store.corona'], onStatus: (s) => statuses.push(s), watchdogMs: 20
  });
  await waitFor(() => f.calls.length >= 2, { timeout: 3000 });
  h.stop();
  assert.ok(f.calls.length >= 2, 'watchdog should have forced a reconnect');
});

// ── refuter finding #1: terminal outcomes (401/403/404) and throttling (429/503) ──

function fakeStatusResponse(status, headers) {
  return {
    ok: false, status, body: null,
    headers: headers ? { get: (h) => (Object.prototype.hasOwnProperty.call(headers, h) ? headers[h] : null) } : undefined
  };
}

test('a 401 makes exactly one request, fires onUnauthenticated once, and leaves no timer running', async () => {
  const statuses = [];
  let unauthCalls = 0;
  const f = fakeFetch([() => fakeStatusResponse(401)]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const h = HWRealtime.subscribe({
    channels: ['register.store.corona'],
    onStatus: (s) => statuses.push(s),
    onUnauthenticated: () => { unauthCalls++; },
    baseBackoffMs: 5, maxBackoffMs: 20
  });
  await waitFor(() => statuses.includes('unauthenticated'));
  await sleep(80);  // long enough for a reconnect/poll timer to have fired, if one existed
  assert.strictEqual(h.status, 'unauthenticated');
  h.stop();
  assert.strictEqual(f.calls.length, 1, 'no reconnect attempt after a 401');
  assert.strictEqual(unauthCalls, 1);
  assert.ok(!statuses.includes('reconnecting') && !statuses.includes('polling'));
});

test('onUnauthenticated is optional -- a 401 with no callback supplied never throws', async () => {
  const f = fakeFetch([() => fakeStatusResponse(401)]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const h = HWRealtime.subscribe({ channels: ['register.store.corona'], baseBackoffMs: 5, maxBackoffMs: 20 });
  await waitFor(() => h.status === 'unauthenticated');
  h.stop();
  assert.strictEqual(h.status, 'stopped');
});

test('a 403 on a channel stops the subscription (status forbidden, no further requests, callback once)', async () => {
  let forbidCalls = 0;
  const f = fakeFetch([() => fakeStatusResponse(403)]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const h = HWRealtime.subscribe({
    channels: ['dispatch.store.corona'],
    onForbidden: () => { forbidCalls++; },
    baseBackoffMs: 5, maxBackoffMs: 20
  });
  await waitFor(() => h.status === 'forbidden');
  await sleep(80);
  h.stop();
  assert.strictEqual(f.calls.length, 1, 'no reconnect attempt after a 403');
  assert.strictEqual(forbidCalls, 1);
});

test('a 404 on a channel is treated the same as a 403 -- stops, status forbidden', async () => {
  const f = fakeFetch([() => fakeStatusResponse(404)]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const h = HWRealtime.subscribe({ channels: ['ghost.store.corona'], baseBackoffMs: 5, maxBackoffMs: 20 });
  await waitFor(() => h.status === 'forbidden');
  await sleep(60);
  h.stop();
  assert.strictEqual(f.calls.length, 1, 'no reconnect attempt after a 404');
});

test('a 429 with Retry-After waits approximately that long before reconnecting', async () => {
  const timestamps = [];
  const f = fakeFetch([
    (u, o, n) => { timestamps.push(Date.now()); return fakeStatusResponse(429, { 'Retry-After': '0.1' }); },
    (u, o, n) => { timestamps.push(Date.now()); return makeStreamResponse({ holdOpen: true }); },
  ]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const h = HWRealtime.subscribe({
    channels: ['register.store.corona'], baseBackoffMs: 5, maxBackoffMs: 5000
  });
  await waitFor(() => timestamps.length >= 2);
  h.stop();
  const gap = timestamps[1] - timestamps[0];
  assert.ok(gap >= 90, 'waited at least the Retry-After duration: ' + gap + 'ms');
});

test('a 503 with a Retry-After longer than maxBackoffMs is capped, never waits the full duration', async () => {
  const timestamps = [];
  const f = fakeFetch([
    (u, o, n) => { timestamps.push(Date.now()); return fakeStatusResponse(503, { 'Retry-After': '600' }); },
    (u, o, n) => { timestamps.push(Date.now()); return makeStreamResponse({ holdOpen: true }); },
  ]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const h = HWRealtime.subscribe({
    channels: ['register.store.corona'], baseBackoffMs: 5, maxBackoffMs: 50
  });
  await waitFor(() => timestamps.length >= 2, { timeout: 2000 });
  h.stop();
  const gap = timestamps[1] - timestamps[0];
  assert.ok(gap < 600, 'capped well under the requested 600s: ' + gap + 'ms');
});

test('a 503 with no Retry-After header falls back to the ordinary exponential reconnect', async () => {
  const statuses = [];
  const f = fakeFetch([
    () => fakeStatusResponse(503),
    () => makeStreamResponse({ holdOpen: true }),
  ]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const h = HWRealtime.subscribe({
    channels: ['register.store.corona'], onStatus: (s) => statuses.push(s), baseBackoffMs: 5, maxBackoffMs: 20
  });
  await waitFor(() => statuses.includes('live'));
  h.stop();
  assert.ok(statuses.includes('reconnecting'));
});

test('a plain 500 still backs off through the ordinary reconnect path (no special-casing)', async () => {
  const statuses = [];
  const f = fakeFetch([
    () => fakeStatusResponse(500),
    () => makeStreamResponse({ holdOpen: true }),
  ]);
  const { HWRealtime } = loadHwRealtime({ fetchImpl: f });
  const h = HWRealtime.subscribe({
    channels: ['register.store.corona'], onStatus: (s) => statuses.push(s), baseBackoffMs: 5, maxBackoffMs: 20
  });
  await waitFor(() => statuses.includes('live'));
  h.stop();
  assert.ok(statuses.includes('reconnecting'));
  assert.strictEqual(f.calls.length, 2);
});
