// ── shared/hw-register.js ── Cash Drawer register-session data layer ───────
// Plain JS. Loads BEFORE React (same load order as shared/hw-live.js and
// shared/hw-restock.js), on the POS entry HTML only.
//
// WHAT IT IS. A thin wrapper around the /api/register/* routes, all through
// window.HW_LIVE — never a raw fetch of its own, so the session token header
// and same-origin base URL are inherited from that one seam (see
// shared/hw-live.js's own header comment). This file does NO cash arithmetic
// of its own: every cents figure a screen shows (expected cash, a count's
// total, a session's variance) comes from a route response, never a client
// re-derivation — CASH-DROPPED-COUNTED-VERDICT-2026-08-17.md's whole finding
// is that a number the screen computes and asks the operator to retype is not
// a control, and wmdemo/register.py enforces that server-side (a posted
// `total_cents` on a count is REFUSED, not silently ignored). This module
// mirrors that discipline: it forwards `denominations` exactly as given and
// never sums them itself.
//
// NO SCREEN CHANGES. Per the owner's "never modify the Register screen" rule
// (pos/screen-register.jsx), this file is not wired into any screen yet — the
// Home card / own-screen integration is a later, separate task. This is the
// data layer that integration will call.
//
// ROUTES (read wm-demo/wmdemo/register_api.py before changing any of this):
//   POST /api/register/open                    {store_id, register_id, opened_by, opening_float_cents, notes?}
//   POST /api/register/{id}/drop                {amount_cents, reason, by, bag_ref?}
//   POST /api/register/{id}/count                {kind, denominations, by}
//   POST /api/register/{id}/close                {closed_by}
//   POST /api/register/{id}/void                 {voided_by, reason}
//   GET  /api/register/{id}                      -> {session, breakdown}
//   GET  /api/register/sessions ?store_id&day
//   GET  /api/register/variance ?store_id&since
//   GET  /api/register/policy   ?store_id
//   POST /api/register/policy                    {store_id, blind_counts?, require_drawer_for_sales?}
//
// CENTS NEVER DERIVED CLIENT-SIDE. `count()` takes `denominations` — a
// {denom_cents: qty} object — and passes it through unmodified; it never
// computes a total to send, and it never trusts a `total_cents` the caller
// might attach (the server refuses one outright — see reg.count()'s own
// jsdoc below for what that looks like from here).
//
// ERRORS. Every function resolves, never rejects, to a plain object carrying
// `status` (HTTP code, or 0 for a request that never reached the server) and
// `error` (a string, or null on success) — never a thrown string. Mirrors
// shared/hw-restock.js's own "never rejects" contract.
//
// WRITES ARE NOT RETRIED. open()/drop()/count()/close()/void() call
// HW_LIVE.post exactly once — a retried close() in particular risks
// re-computing a session's expected/variance and returning a different
// answer for what should be a single act, not a repeated one.
//
// PUBLIC SURFACE: window.HWRegister = {
//   open, drop, count, close, void, session, sessions, variance,
//   getPolicy, setPolicy
// }.
(function () {
  'use strict';
  var W = window;
  if (W.HWRegister && W.HWRegister.__armed) { return; }   // idempotent: two script tags, one module

  function live() { return W.HW_LIVE; }

  function missingFieldsError(fields, given) {
    var missing = fields.filter(function (f) { return given[f] === undefined || given[f] === null || given[f] === ''; });
    if (!missing.length) { return null; }
    return missing.join(', ') + (missing.length > 1 ? ' are all required' : ' is required');
  }

  function qs(params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') { return; }
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.join('&');
  }

  // Server error bodies are either a bare {error: "string"} (route_policy's own 401/403/404) or
  // the contract's C.error(code, message, details) -> {error: {code, message, details}}.
  // HW_LIVE.get/post already lift `error`/`hint` onto the settled result, but `error` there can
  // still be either shape — flatten it to one string here so every HWRegister caller gets the
  // same {status, error:string|null} shape regardless of which one a given failure took.
  function errorText(res) {
    if (res.ok) { return null; }
    var e = res.error;
    if (e && typeof e === 'object') { return e.message || e.code || 'request failed'; }
    if (typeof e === 'string' && e) { return e; }
    return 'HTTP ' + (res.code || 0);
  }

  function localError(message) {
    return Promise.resolve({ ok: false, status: 0, error: message });
  }

  // Deep-clones via JSON round-trip before ever handing `denominations` to HW_LIVE.post — this
  // module must never mutate an object a caller gave it (see test/hw-register.test.mjs), same
  // reasoning as shared/hw-restock.js's own cloneJson on a Plan.
  function cloneJson(v) {
    if (v === undefined) { return v; }
    return JSON.parse(JSON.stringify(v));
  }

  function sessionResult(res) {
    return {
      ok: res.ok, status: res.code, error: errorText(res),
      session: res.ok ? (res.body && res.body.session) || null : null,
      breakdown: res.ok ? (res.body && res.body.breakdown !== undefined ? res.body.breakdown : null) : null
    };
  }

  // ── open(): POST /api/register/open ─────────────────────────────────────
  function open(args) {
    args = args || {};
    var missing = missingFieldsError(['store_id', 'register_id', 'opened_by', 'opening_float_cents'], args);
    if (missing) { return localError(missing); }
    var body = { store_id: args.store_id, register_id: args.register_id, opened_by: args.opened_by,
                 opening_float_cents: args.opening_float_cents };
    if (args.notes !== undefined && args.notes !== null && args.notes !== '') { body.notes = args.notes; }
    return live().post('/api/register/open', body).then(sessionResult);
  }

  // ── drop(): POST /api/register/{id}/drop ────────────────────────────────
  function drop(args) {
    args = args || {};
    var missing = missingFieldsError(['session_id', 'amount_cents', 'reason', 'by'], args);
    if (missing) { return localError(missing); }
    var body = { amount_cents: args.amount_cents, reason: args.reason, by: args.by };
    if (args.bag_ref !== undefined && args.bag_ref !== null && args.bag_ref !== '') { body.bag_ref = args.bag_ref; }
    return live().post('/api/register/' + encodeURIComponent(args.session_id) + '/drop', body).then(sessionResult);
  }

  // ── count(): POST /api/register/{id}/count ──────────────────────────────
  // `denominations` is a {denom_cents: qty} object, forwarded exactly as given — this function
  // never sums it and never sends a `total_cents` of its own; the server computes that and
  // refuses a request that tries to supply one (over-posting guard, wmdemo/reqcheck.py).
  function count(args) {
    args = args || {};
    var missing = missingFieldsError(['session_id', 'kind', 'denominations', 'by'], args);
    if (missing) { return localError(missing); }
    var body = { kind: args.kind, denominations: cloneJson(args.denominations), by: args.by };
    return live().post('/api/register/' + encodeURIComponent(args.session_id) + '/count', body).then(sessionResult);
  }

  // ── close(): POST /api/register/{id}/close ──────────────────────────────
  // A variance beyond the server's alert threshold sets `session.needs_review` — it never turns
  // into an `ok:false` here. D1 (RETAIL-FLOAT-D1-FALSE-BLOCK-2026-08-16.md): a close-out tool
  // that substitutes its own arithmetic for a manager's judgment is the failure mode this whole
  // module exists to not repeat, and that starts with never treating "flagged" as "failed".
  function close(args) {
    args = args || {};
    var missing = missingFieldsError(['session_id', 'closed_by'], args);
    if (missing) { return localError(missing); }
    return live().post('/api/register/' + encodeURIComponent(args.session_id) + '/close',
                       { closed_by: args.closed_by }).then(sessionResult);
  }

  // ── void_(): POST /api/register/{id}/void ───────────────────────────────
  // Named `void_` internally (reserved word) but exposed as `HWRegister.void` — an object
  // property may be a reserved word, only a bare identifier may not.
  function void_(args) {
    args = args || {};
    var missing = missingFieldsError(['session_id', 'voided_by', 'reason'], args);
    if (missing) { return localError(missing); }
    return live().post('/api/register/' + encodeURIComponent(args.session_id) + '/void',
                       { voided_by: args.voided_by, reason: args.reason }).then(sessionResult);
  }

  // ── session(): GET /api/register/{id} ───────────────────────────────────
  function session(args) {
    args = args || {};
    var missing = missingFieldsError(['session_id'], args);
    if (missing) { return localError(missing); }
    return live().get('/api/register/' + encodeURIComponent(args.session_id)).then(sessionResult);
  }

  // ── sessions(): GET /api/register/sessions ──────────────────────────────
  function sessions(args) {
    args = args || {};
    var path = '/api/register/sessions?' + qs({ store_id: args.store_id, day: args.day });
    return live().get(path).then(function (res) {
      return { ok: res.ok, status: res.code, error: errorText(res), sessions: res.ok ? ((res.body && res.body.sessions) || []) : [] };
    });
  }

  // ── variance(): GET /api/register/variance ──────────────────────────────
  function variance(args) {
    args = args || {};
    var path = '/api/register/variance?' + qs({ store_id: args.store_id, since: args.since });
    return live().get(path).then(function (res) {
      return { ok: res.ok, status: res.code, error: errorText(res), variance: res.ok ? ((res.body && res.body.variance) || []) : [] };
    });
  }

  // ── getPolicy() / setPolicy(): /api/register/policy ─────────────────────
  function getPolicy(args) {
    args = args || {};
    var missing = missingFieldsError(['store_id'], args);
    if (missing) { return localError(missing); }
    var path = '/api/register/policy?' + qs({ store_id: args.store_id });
    return live().get(path).then(function (res) {
      return { ok: res.ok, status: res.code, error: errorText(res), policy: res.ok ? (res.body && res.body.policy) || null : null };
    });
  }

  function setPolicy(args) {
    args = args || {};
    var missing = missingFieldsError(['store_id'], args);
    if (missing) { return localError(missing); }
    var body = { store_id: args.store_id };
    if (args.blind_counts !== undefined && args.blind_counts !== null) { body.blind_counts = !!args.blind_counts; }
    if (args.require_drawer_for_sales !== undefined && args.require_drawer_for_sales !== null) {
      body.require_drawer_for_sales = !!args.require_drawer_for_sales;
    }
    return live().post('/api/register/policy', body).then(function (res) {
      return { ok: res.ok, status: res.code, error: errorText(res), policy: res.ok ? (res.body && res.body.policy) || null : null };
    });
  }

  W.HWRegister = {
    __armed: true,
    open: open,
    drop: drop,
    count: count,
    close: close,
    void: void_,
    session: session,
    sessions: sessions,
    variance: variance,
    getPolicy: getPolicy,
    setPolicy: setPolicy
  };
})();
