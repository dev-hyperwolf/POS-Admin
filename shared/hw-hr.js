// ── shared/hw-hr.js ── HR data layer (M1) ───────────────────────────────────
// Plain JS. Loads BEFORE React (same load order as shared/hw-live.js and
// shared/hw-restock.js), on the POS entry HTML only.
//
// WHAT IT IS. A thin wrapper around the five read-only wm-demo HR routes
// (wm-demo/wmdemo/hr/api.py), all through window.HW_LIVE.get — never a raw
// fetch of its own, so the session/base-URL plumbing shared/hw-live.js
// already worked out is inherited, not re-implemented. The M1 Overview/list
// screens bind to this module (once built); this file does no rendering and
// does no arithmetic beyond counting rows the server already returned.
//
// ROUTES (read wm-demo/wmdemo/hr/api.py before changing any of this):
//   GET /api/hr/employees?entity_id=&store_id=&status=  -> {contract, employees:[HrEmployee]}
//   GET /api/hr/employees/{id}                           -> {contract, employee:HrEmployee}
//   GET /api/hr/compliance/expiring?days=30              -> {days, expiring:[...]}
//   GET /api/hr/incidents?since=                         -> {contract, incidents:[Incident]}
//   GET /api/hr/calloffs?since=                          -> {contract, calloffs:[CallOff]}
//
// ROUTE/CONTRACT MISMATCHES FOUND WHILE BUILDING THIS (see build report):
//   1. /api/hr/compliance/expiring is the one route of the five that answers
//      with no `contract` key at all — the other four all carry one. Not
//      fixed here; this module reads the route as it exists.
//   2. Only /employees accepts entity_id as a QUERY PARAM. /compliance/expiring,
//      /incidents and /calloffs all carry entity_id on every row they return
//      (HrEmployee/Incident/CallOff/the expiring-item shape all have it) but
//      take no entity_id filter of their own — scoping there is principal-based
//      server-side (api.py's `_allowed_entities`), never caller-selectable.
//      `summary()` below is the one place this matters: it filters those three
//      arrays by entity_id ITSELF, client-side, on rows the server already
//      sent — it never asks the server for a narrower slice it cannot request.
//
// ERRORS. Every function resolves, never rejects. A 401 propagates as exactly
// `{status: 401}` (no `error` key) so the shell's sign-in prompt can key off
// the bare status. A 403 always returns `{status: 403, error: "hr:read
// needed"}` — literally that string, regardless of what the server's own body
// said, because "you don't have this scope" is the one thing about a 403 on
// this module a caller ever needs to act on. Anything else failing is
// `{status, error}` with the server's own flattened message when there is
// one. Nothing here ever throws.
//
// CACHE. One in-memory map keyed by the exact request path (path + query
// string, so two different filter combinations are two different keys),
// 30s TTL, cleared by an explicit `invalidate()` — e.g. on an entity switch,
// per the M1 list screens' own requirement. Only a SUCCESSFUL response is
// kept; a failed one is evicted immediately so a transient error is never
// held stale for whoever calls next.
//
// PUBLIC SURFACE: window.HWHR = { employees, employee, expiring, incidents,
//   calloffs, summary, invalidate, daysAgoIso, startOfTodayIso }.
(function () {
  'use strict';
  var W = window;
  if (W.HWHR && W.HWHR.__armed) { return; }   // idempotent: two script tags, one module

  function live() { return W.HW_LIVE; }

  // ── cache: path -> { expiresAt, promise } ───────────────────────────────
  var CACHE_TTL_MS = 30000;
  var _cache = {};

  function invalidate() { _cache = {}; }

  function cachedGet(path) {
    var now = Date.now();
    var hit = _cache[path];
    if (hit && hit.expiresAt > now) { return hit.promise; }
    var promise = live().get(path).then(function (res) {
      // A failed fetch is evidence of nothing worth remembering — evict it so
      // the NEXT call gets a fresh try instead of the same failure for 30s.
      if (!res.ok) { delete _cache[path]; }
      return res;
    });
    _cache[path] = { expiresAt: now + CACHE_TTL_MS, promise: promise };
    return promise;
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

  // Server error bodies are C.error(code, message, details) -> {error: {code,
  // message, details}}. HW_LIVE.get already lifts `error`/`hint` onto the
  // settled result, but `error` there can still be that whole object — flatten
  // to one string, the same rule shared/hw-restock.js applies.
  function errorText(res) {
    var e = res.error;
    if (e && typeof e === 'object') { return e.message || e.code || 'request failed'; }
    if (typeof e === 'string' && e) { return e; }
    return 'HTTP ' + (res.code || 0);
  }

  function mapError(res) {
    if (res.code === 401) { return { status: 401 }; }
    if (res.code === 403) { return { status: 403, error: 'hr:read needed' }; }
    return { status: res.code, error: errorText(res) };
  }

  function localError(message) {
    return Promise.resolve({ status: 0, error: message });
  }

  // ── since / date helpers ─────────────────────────────────────────────────
  // Whole days back from now, ISO-8601 with a Z suffix — matches the
  // `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$` pattern every
  // contract timestamp field uses, so it compares correctly (lexicographically,
  // same as api.py's own `since` check) against a row's `created_at`.
  function daysAgoIso(n) {
    var days = Number(n) || 0;
    return new Date(Date.now() - days * 86400000).toISOString();
  }

  // Midnight UTC today. Used for the "call-offs today" summary count — the
  // only one of the four headline counts that means "since the day started"
  // rather than "in the last N days".
  function startOfTodayIso() {
    var d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
  }

  // ── employees() : GET /api/hr/employees ─────────────────────────────────
  function employees(args) {
    args = args || {};
    var path = '/api/hr/employees?' + qs({
      entity_id: args.entity_id, store_id: args.store_id, status: args.status
    });
    return cachedGet(path).then(function (res) {
      if (!res.ok) { return mapError(res); }
      return (res.body && res.body.employees) || [];
    });
  }

  // ── employee(id) : GET /api/hr/employees/{id} ───────────────────────────
  function employee(id) {
    if (id === undefined || id === null || id === '') { return localError('id is required'); }
    var path = '/api/hr/employees/' + encodeURIComponent(id);
    return cachedGet(path).then(function (res) {
      if (!res.ok) { return mapError(res); }
      return (res.body && res.body.employee) || null;
    });
  }

  // ── expiring() : GET /api/hr/compliance/expiring ────────────────────────
  function expiring(args) {
    args = args || {};
    var path = '/api/hr/compliance/expiring?' + qs({ days: args.days });
    return cachedGet(path).then(function (res) {
      if (!res.ok) { return mapError(res); }
      return (res.body && res.body.expiring) || [];
    });
  }

  // ── incidents() : GET /api/hr/incidents ─────────────────────────────────
  function incidents(args) {
    args = args || {};
    var path = '/api/hr/incidents?' + qs({ since: args.since });
    return cachedGet(path).then(function (res) {
      if (!res.ok) { return mapError(res); }
      return (res.body && res.body.incidents) || [];
    });
  }

  // ── calloffs() : GET /api/hr/calloffs ───────────────────────────────────
  function calloffs(args) {
    args = args || {};
    var path = '/api/hr/calloffs?' + qs({ since: args.since });
    return cachedGet(path).then(function (res) {
      if (!res.ok) { return mapError(res); }
      return (res.body && res.body.calloffs) || [];
    });
  }

  // ── summary() : fan out the four list calls, headline counts only ───────
  // Every count here is `.length` of an array the server returned (optionally
  // narrowed by an `entity_id ===` check on rows the server already sent) —
  // never a number the server did not hand back. The four requests fire in
  // parallel; if any one of them fails, that failure (its {status[,error]}) is
  // returned as-is instead of a partial summary, so a 401/403 on any leg still
  // reaches the shell in the shape it expects.
  function summary(args) {
    args = args || {};
    var entityId = args.entity_id;
    return Promise.all([
      employees(entityId ? { entity_id: entityId } : {}),
      expiring({ days: 30 }),
      incidents({ since: daysAgoIso(7) }),
      calloffs({ since: startOfTodayIso() })
    ]).then(function (results) {
      var emp = results[0], exp = results[1], inc = results[2], co = results[3];
      var failed = [emp, exp, inc, co].filter(function (r) { return !Array.isArray(r); })[0];
      if (failed) { return failed; }

      function sameEntity(row) { return !entityId || row.entity_id === entityId; }

      return {
        activePeople: emp.filter(function (e) { return e.status === 'active'; }).length,
        expiring30d: exp.filter(sameEntity).length,
        openIncidents7d: inc.filter(function (i) { return i.status === 'open' && sameEntity(i); }).length,
        calloffsToday: co.filter(sameEntity).length
      };
    });
  }

  W.HWHR = {
    __armed: true,
    employees: employees,
    employee: employee,
    expiring: expiring,
    incidents: incidents,
    calloffs: calloffs,
    summary: summary,
    invalidate: invalidate,
    daysAgoIso: daysAgoIso,
    startOfTodayIso: startOfTodayIso
  };
})();
