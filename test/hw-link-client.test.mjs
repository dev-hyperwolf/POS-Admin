/* shared/hw-link-client.js — the signed-link fetch seam, tested in isolation.
 *
 * Same "vm harness, fake fetch" shape test/hw-live-session.test.mjs already
 * established for shared/hw-live.js: a small hand-built `window` (here, just
 * `localStorage`/`sessionStorage` spies -- this module touches neither, so
 * the spies exist to PROVE that, not to support any real feature) and a
 * fake `fetch`. Legacy (non-strict) `assert`, deliberately: the module runs
 * inside a vm context with its own realm, so an object literal it hands
 * back is not the same Object/Array constructor as this file's -- deepEqual
 * from assert/strict would fail on structurally-identical values (same
 * reasoning hw-live-session.test.mjs's own header comment gives).
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(path.join(ROOT, 'shared', 'hw-link-client.js'), 'utf8');

// ── fakes ────────────────────────────────────────────────────────────────

function fakeStorage() {
  const store = new Map();
  const calls = { getItem: [], setItem: [], removeItem: [] };
  return {
    calls,
    getItem(k) { calls.getItem.push(k); return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { calls.setItem.push([k, v]); store.set(k, String(v)); },
    removeItem(k) { calls.removeItem.push(k); store.delete(k); }
  };
}

// Same handler-based fake fetch hw-live-session.test.mjs uses: first
// matching handler answers, `respond` is a fixed shape or a function.
function fakeFetch(handlers) {
  const calls = [];
  function impl(url, opts) {
    calls.push({
      url,
      opts,
      headers: (opts && opts.headers) || {},
      body: opts && opts.body !== undefined ? JSON.parse(opts.body) : undefined
    });
    for (const h of handlers) {
      if (h.match(url)) {
        const r = typeof h.respond === 'function' ? h.respond(url, opts, calls.length) : h.respond;
        if (r && r.reject) { return Promise.reject(new Error(r.message || 'network failure')); }
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

function loadClient({ fetchImpl } = {}) {
  const ls = fakeStorage();
  const ss = fakeStorage();
  const windowObj = { localStorage: ls, sessionStorage: ss };
  const fetchImplUsed = fetchImpl || fakeFetch([]);
  const context = { window: windowObj, fetch: fetchImplUsed, console };
  vm.createContext(context);
  vm.runInContext(SRC, context, { filename: 'shared/hw-link-client.js' });
  if (!windowObj.HWLinkClient) { throw new Error('hw-link-client.test: window.HWLinkClient did not load'); }
  return { client: windowObj.HWLinkClient, ls, ss, fetch: fetchImplUsed };
}

function resolveHandler(respond) {
  return { match: (u) => u.endsWith('/api/links/resolve'), respond };
}
function consumeHandler(respond) {
  return { match: (u) => u.endsWith('/api/links/consume'), respond };
}
function submitHandler(slug, respond) {
  return { match: (u) => u.endsWith('/api/forms/' + slug + '/submit'), respond };
}

const RESOLVE_BODY = { purpose: 'signature', subject_kind: 'writeup', subject_id: 'wu_1', scopes: ['writeups:sign'] };

// ── header set ───────────────────────────────────────────────────────────

test('resolve() sends x-hw-link-token and nothing else that looks like a credential', async () => {
  const fetchImpl = fakeFetch([resolveHandler({ status: 200, body: RESOLVE_BODY })]);
  const { client, fetch } = loadClient({ fetchImpl });
  await client.resolve('lnk_abc.secret123');
  const call = fetch.calls[0];
  assert.equal(call.headers['x-hw-link-token'], 'lnk_abc.secret123');
  assert.equal(Object.prototype.hasOwnProperty.call(call.headers, 'x-hw-write-token'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(call.headers, 'Authorization'), false);
  assert.equal(call.opts.credentials, 'omit');
});

test('resolve() is a GET with no body', async () => {
  const fetchImpl = fakeFetch([resolveHandler({ status: 200, body: RESOLVE_BODY })]);
  const { client, fetch } = loadClient({ fetchImpl });
  await client.resolve('tok');
  assert.equal(fetch.calls[0].opts.method, 'GET');
  assert.equal(fetch.calls[0].opts.body, undefined);
});

test('submit() sends x-hw-link-token and Content-Type: application/json', async () => {
  const fetchImpl = fakeFetch([submitHandler('onb_ack_sign', { status: 201, body: { submission: { id: 's1' } } })]);
  const { client, fetch } = loadClient({ fetchImpl });
  await client.submit('onb_ack_sign', 'lnk.secret', { typedName: 'Jamie' });
  const call = fetch.calls[0];
  assert.equal(call.headers['x-hw-link-token'], 'lnk.secret');
  assert.equal(call.headers['Content-Type'], 'application/json');
  assert.equal(call.opts.method, 'POST');
});

test('submit() wraps the data under {data:...} and never adds an actor of its own', async () => {
  const fetchImpl = fakeFetch([submitHandler('onb_ack_sign', { status: 201, body: { submission: {} } })]);
  const { client, fetch } = loadClient({ fetchImpl });
  await client.submit('onb_ack_sign', 'tok', { typedName: 'Jamie', ackAgree: true });
  assert.deepEqual(fetch.calls[0].body, { data: { typedName: 'Jamie', ackAgree: true } });
});

test('submit() percent-encodes the slug in the URL', async () => {
  const fetchImpl = fakeFetch([{ match: (u) => u.includes('/api/forms/'), respond: { status: 201, body: { submission: {} } } }]);
  const { client, fetch } = loadClient({ fetchImpl });
  await client.submit('a slug/weird', 'tok', {});
  assert.ok(fetch.calls[0].url.endsWith('/api/forms/' + encodeURIComponent('a slug/weird') + '/submit'));
});

test('consume() is a POST with an empty body and the link header', async () => {
  const fetchImpl = fakeFetch([consumeHandler({ status: 200, body: { ok: true, purpose: 'signature', subject_kind: 'writeup', subject_id: 'wu_1' } })]);
  const { client, fetch } = loadClient({ fetchImpl });
  await client.consume('tok');
  const call = fetch.calls[0];
  assert.equal(call.opts.method, 'POST');
  assert.deepEqual(call.body, {});
  assert.equal(call.headers['x-hw-link-token'], 'tok');
});

// ── storage untouched ────────────────────────────────────────────────────

test('resolve() never reads or writes localStorage/sessionStorage', async () => {
  const fetchImpl = fakeFetch([resolveHandler({ status: 200, body: RESOLVE_BODY })]);
  const { client, ls, ss } = loadClient({ fetchImpl });
  await client.resolve('tok');
  assert.equal(ls.calls.getItem.length + ls.calls.setItem.length + ls.calls.removeItem.length, 0);
  assert.equal(ss.calls.getItem.length + ss.calls.setItem.length + ss.calls.removeItem.length, 0);
});

test('submit() never reads or writes localStorage/sessionStorage, including on failure', async () => {
  const fetchImpl = fakeFetch([submitHandler('onb_ack_sign', { status: 409, body: { error: { code: 'conflict', message: 'this link has already been used' } } })]);
  const { client, ls, ss } = loadClient({ fetchImpl });
  await client.submit('onb_ack_sign', 'tok', {});
  assert.equal(ls.calls.getItem.length + ls.calls.setItem.length + ls.calls.removeItem.length, 0);
  assert.equal(ss.calls.getItem.length + ss.calls.setItem.length + ss.calls.removeItem.length, 0);
});

test('a full resolve()+submit() lifecycle touches storage zero times', async () => {
  const fetchImpl = fakeFetch([
    resolveHandler({ status: 200, body: RESOLVE_BODY }),
    submitHandler('onb_ack_sign', { status: 201, body: { submission: { id: 's1' } } })
  ]);
  const { client, ls, ss } = loadClient({ fetchImpl });
  await client.resolve('tok');
  await client.submit('onb_ack_sign', 'tok', { typedName: 'Jamie' });
  assert.equal(ls.calls.getItem.length + ls.calls.setItem.length + ls.calls.removeItem.length, 0);
  assert.equal(ss.calls.getItem.length + ss.calls.setItem.length + ss.calls.removeItem.length, 0);
});

// ── status mapping ───────────────────────────────────────────────────────

test('resolve() 200 -> {status, body}', async () => {
  const fetchImpl = fakeFetch([resolveHandler({ status: 200, body: RESOLVE_BODY })]);
  const { client } = loadClient({ fetchImpl });
  const res = await client.resolve('tok');
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(res.body)), RESOLVE_BODY);
  assert.equal(Object.prototype.hasOwnProperty.call(res, 'error'), false);
});

test('resolve() 404 -> {status:404, error} with no reason disclosed beyond the server body', async () => {
  const fetchImpl = fakeFetch([resolveHandler({ status: 404, body: { error: { code: 'not_found', message: 'not found' } } })]);
  const { client } = loadClient({ fetchImpl });
  const res = await client.resolve('bad-token');
  assert.equal(res.status, 404);
  assert.equal(res.error, 'not found');
  assert.equal(Object.prototype.hasOwnProperty.call(res, 'body'), false);
});

test('resolve() 429 -> {status:429, error}', async () => {
  const fetchImpl = fakeFetch([resolveHandler({ status: 429, body: { error: { code: 'rate_limited', message: 'too many requests' } } })]);
  const { client } = loadClient({ fetchImpl });
  const res = await client.resolve('tok');
  assert.equal(res.status, 429);
  assert.equal(res.error, 'too many requests');
});

test('submit() 201 -> {status:201, body} (link-scoped create)', async () => {
  const fetchImpl = fakeFetch([submitHandler('onb_ack_sign', { status: 201, body: { submission: { id: 's1' } } })]);
  const { client } = loadClient({ fetchImpl });
  const res = await client.submit('onb_ack_sign', 'tok', {});
  assert.equal(res.status, 201);
  assert.equal(res.body.submission.id, 's1');
});

test('submit() 200 -> {status:200, body} (the non-link legacy success shape still counts as ok)', async () => {
  const fetchImpl = fakeFetch([submitHandler('onb_ack_sign', { status: 200, body: { submission: { id: 's2' } } })]);
  const { client } = loadClient({ fetchImpl });
  const res = await client.submit('onb_ack_sign', 'tok', {});
  assert.equal(res.status, 200);
  assert.equal(res.body.submission.id, 's2');
});

test('submit() 401 -> {status:401, error}', async () => {
  const fetchImpl = fakeFetch([submitHandler('onb_ack_sign', { status: 401, body: { error: { code: 'unauthorized', message: 'unauthorized' } } })]);
  const { client } = loadClient({ fetchImpl });
  const res = await client.submit('onb_ack_sign', 'tok', {});
  assert.equal(res.status, 401);
  assert.equal(res.error, 'unauthorized');
});

test('submit() 403 -> {status:403, error} (link minted for a different form)', async () => {
  const fetchImpl = fakeFetch([submitHandler('onb_ack_sign', { status: 403, body: { error: { code: 'forbidden', message: "this link is not valid for form 'onb_ack_sign'" } } })]);
  const { client } = loadClient({ fetchImpl });
  const res = await client.submit('onb_ack_sign', 'tok', {});
  assert.equal(res.status, 403);
  assert.match(res.error, /not valid for form/);
});

test('submit() 404 -> {status:404, error} (invalid/expired/unknown link, no reason disclosed)', async () => {
  const fetchImpl = fakeFetch([submitHandler('onb_ack_sign', { status: 404, body: { error: { code: 'not_found', message: 'not found' } } })]);
  const { client } = loadClient({ fetchImpl });
  const res = await client.submit('onb_ack_sign', 'tok', {});
  assert.equal(res.status, 404);
  assert.equal(res.error, 'not found');
});

test('submit() 409 -> {status:409, error} (exhausted link, the one disclosed reason)', async () => {
  const fetchImpl = fakeFetch([submitHandler('onb_ack_sign', { status: 409, body: { error: { code: 'conflict', message: 'this link has already been used' } } })]);
  const { client } = loadClient({ fetchImpl });
  const res = await client.submit('onb_ack_sign', 'tok', {});
  assert.equal(res.status, 409);
  assert.equal(res.error, 'this link has already been used');
});

test('consume() 409 -> {status:409, error}', async () => {
  const fetchImpl = fakeFetch([consumeHandler({ status: 409, body: { error: { code: 'conflict', message: 'this link has already been used' } } })]);
  const { client } = loadClient({ fetchImpl });
  const res = await client.consume('tok');
  assert.equal(res.status, 409);
  assert.equal(res.error, 'this link has already been used');
});

// ── network / malformed ──────────────────────────────────────────────────

test('a network failure never rejects: resolves to {status:0, error: /request failed/}', async () => {
  const fetchImpl = fakeFetch([resolveHandler({ reject: true, message: 'Failed to fetch' })]);
  const { client } = loadClient({ fetchImpl });
  const res = await client.resolve('tok');
  assert.equal(res.status, 0);
  assert.match(res.error, /request failed/);
});

test('an error response with an unparseable body falls back to "HTTP <status>"', async () => {
  const fetchImpl = fakeFetch([submitHandler('onb_ack_sign', { status: 500, jsonError: true })]);
  const { client } = loadClient({ fetchImpl });
  const res = await client.submit('onb_ack_sign', 'tok', {});
  assert.equal(res.status, 500);
  assert.equal(res.error, 'HTTP 500');
});

test('a 2xx response with an unparseable body resolves with body: null, not a thrown error', async () => {
  const fetchImpl = fakeFetch([resolveHandler({ status: 200, jsonError: true })]);
  const { client } = loadClient({ fetchImpl });
  const res = await client.resolve('tok');
  assert.equal(res.status, 200);
  assert.equal(res.body, null);
});

// ── submitTo() ───────────────────────────────────────────────────────────
// A link-scoped write route that is NOT /api/forms/<slug>/submit -- e.g.
// POST /api/writeups/<id>/sign (shared/hw-sign-page.jsx's write-up flow).
// Unlike submit(), the body is sent EXACTLY as given: no `{data:...}`
// wrapping, because that route's own contract (WriteupSignature,
// contracts/index.js) is the top-level request object.

function signHandler(id, respond) {
  return { match: (u) => u.endsWith('/api/writeups/' + id + '/sign'), respond };
}

test('submitTo() sends x-hw-link-token and Content-Type: application/json', async () => {
  const fetchImpl = fakeFetch([signHandler('wu_1', { status: 201, body: { writeup: { id: 'wu_1', status: 'signed' } } })]);
  const { client, fetch } = loadClient({ fetchImpl });
  await client.submitTo('/api/writeups/wu_1/sign', 'lnk.secret', { signature_png_b64: 'AAAA', acknowledged: true, typed_name: 'Jamie' });
  const call = fetch.calls[0];
  assert.equal(call.headers['x-hw-link-token'], 'lnk.secret');
  assert.equal(call.headers['Content-Type'], 'application/json');
  assert.equal(call.opts.method, 'POST');
});

test('submitTo() sends the body exactly as given, NOT wrapped under {data:...}', async () => {
  const fetchImpl = fakeFetch([signHandler('wu_1', { status: 201, body: { writeup: {} } })]);
  const { client, fetch } = loadClient({ fetchImpl });
  const body = { signature_png_b64: 'AAAA', acknowledged: true, typed_name: 'Jamie' };
  await client.submitTo('/api/writeups/wu_1/sign', 'tok', body);
  assert.deepEqual(fetch.calls[0].body, body);
});

test('submitTo() posts to the exact path given, building nothing from a slug', async () => {
  const fetchImpl = fakeFetch([{ match: (u) => u.includes('/api/writeups/'), respond: { status: 201, body: { writeup: {} } } }]);
  const { client, fetch } = loadClient({ fetchImpl });
  await client.submitTo('/api/writeups/wu_42/sign', 'tok', {});
  assert.ok(fetch.calls[0].url.endsWith('/api/writeups/wu_42/sign'));
});

test('submitTo() never reads or writes localStorage/sessionStorage', async () => {
  const fetchImpl = fakeFetch([signHandler('wu_1', { status: 201, body: { writeup: {} } })]);
  const { client, ls, ss } = loadClient({ fetchImpl });
  await client.submitTo('/api/writeups/wu_1/sign', 'tok', {});
  assert.equal(ls.calls.getItem.length + ls.calls.setItem.length + ls.calls.removeItem.length, 0);
  assert.equal(ss.calls.getItem.length + ss.calls.setItem.length + ss.calls.removeItem.length, 0);
});

test('submitTo() 201 -> {status:201, body}', async () => {
  const fetchImpl = fakeFetch([signHandler('wu_1', { status: 201, body: { writeup: { id: 'wu_1', status: 'signed' } } })]);
  const { client } = loadClient({ fetchImpl });
  const res = await client.submitTo('/api/writeups/wu_1/sign', 'tok', {});
  assert.equal(res.status, 201);
  assert.equal(res.body.writeup.status, 'signed');
});

test('submitTo() 409 -> {status:409, error} (already signed)', async () => {
  const fetchImpl = fakeFetch([signHandler('wu_1', { status: 409, body: { error: { code: 'conflict', message: 'this write-up has already been signed' } } })]);
  const { client } = loadClient({ fetchImpl });
  const res = await client.submitTo('/api/writeups/wu_1/sign', 'tok', {});
  assert.equal(res.status, 409);
  assert.equal(res.error, 'this write-up has already been signed');
});

test('submitTo() 410 -> {status:410, error} (no canonical contracts ErrorCode, sent raw by api.py)', async () => {
  const fetchImpl = fakeFetch([signHandler('wu_1', { status: 410, body: { error: { code: 'gone', message: 'this write-up has been withdrawn' } } })]);
  const { client } = loadClient({ fetchImpl });
  const res = await client.submitTo('/api/writeups/wu_1/sign', 'tok', {});
  assert.equal(res.status, 410);
  assert.equal(res.error, 'this write-up has been withdrawn');
});

test('submitTo() 404 -> {status:404, error} (invalid link, no reason disclosed)', async () => {
  const fetchImpl = fakeFetch([signHandler('wu_1', { status: 404, body: { error: { code: 'not_found', message: 'not found' } } })]);
  const { client } = loadClient({ fetchImpl });
  const res = await client.submitTo('/api/writeups/wu_1/sign', 'tok', {});
  assert.equal(res.status, 404);
  assert.equal(res.error, 'not found');
});

test('submitTo() makes exactly one fetch call even when the server refuses it', async () => {
  const fetchImpl = fakeFetch([signHandler('wu_1', { status: 410, body: { error: { code: 'gone', message: 'withdrawn' } } })]);
  const { client, fetch } = loadClient({ fetchImpl });
  await client.submitTo('/api/writeups/wu_1/sign', 'tok', {});
  assert.equal(fetch.calls.length, 1);
});

// ── no retries ───────────────────────────────────────────────────────────

test('submit() makes exactly one fetch call even when the server refuses it', async () => {
  const fetchImpl = fakeFetch([submitHandler('onb_ack_sign', { status: 409, body: { error: { code: 'conflict', message: 'already used' } } })]);
  const { client, fetch } = loadClient({ fetchImpl });
  await client.submit('onb_ack_sign', 'tok', {});
  assert.equal(fetch.calls.length, 1);
});

test('submit() makes exactly one fetch call even when the network call itself fails', async () => {
  const fetchImpl = fakeFetch([submitHandler('onb_ack_sign', { reject: true, message: 'offline' })]);
  const { client, fetch } = loadClient({ fetchImpl });
  await client.submit('onb_ack_sign', 'tok', {});
  assert.equal(fetch.calls.length, 1);
});

test('resolve() makes exactly one fetch call regardless of outcome', async () => {
  const fetchImpl = fakeFetch([resolveHandler({ status: 404, body: { error: { code: 'not_found', message: 'not found' } } })]);
  const { client, fetch } = loadClient({ fetchImpl });
  await client.resolve('tok');
  assert.equal(fetch.calls.length, 1);
});
