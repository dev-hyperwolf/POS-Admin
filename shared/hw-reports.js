// ── shared/hw-reports.js ── Reports data layer ──────────────────────────────
// Plain JS. Loads BEFORE React (same load order as shared/hw-live.js and its siblings), on the
// POS entry HTML only. NO SCREEN OF ITS OWN — this build's brief is the client data layer only;
// a future Reports screen (or an existing admin page) calls this module the way
// pos/screen-floor-restock.jsx calls shared/hw-restock.js.
//
// WHAT IT IS. A thin wrapper around wmdemo/reports_api.py's three routes, all through
// window.HW_LIVE — never a raw fetch of its own, so the session token header and same-origin
// base URL are inherited from that one seam (see shared/hw-live.js's own header comment). See
// wmdemo/reports.py before changing any of this: the report registry, every column/param shape
// and the report catalogue all live there, not here — this file does no arithmetic of its own,
// the same "the server computes, the client renders" rule shared/hw-restock.js's own header
// states for restock's `give`.
//
// ROUTES (read wm-demo/wmdemo/reports_api.py before changing any of this):
//   GET /api/reports                         -> {reports: [{name, title, category, params,
//                                               columns, pii}, ...]}
//   GET /api/reports/{name}?store_id=&since=&until=&group_by=  -> the JSON report body
//   GET /api/reports/{name}.csv?...          -> never fetched by this module (see csvUrl()
//                                               below, the same posture shared/hw-restock.js's
//                                               own slipUrl() takes for the print slip route) —
//                                               the screen opens it directly and the browser
//                                               handles the download.
//
// ERRORS. Every function resolves, never rejects, to a plain object carrying `status` (HTTP
// code, or 0 for a request that never reached the server) and `error` (a string, or null on
// success) — never a thrown string. Mirrors window.HW_LIVE.get's own "never rejects" contract
// one level up, and shared/hw-restock.js's own errorText() flattening.
//
// PUBLIC SURFACE: window.HWReports = { list, run, csvUrl }.
(function () {
  'use strict';
  var W = window;
  if (W.HWReports && W.HWReports.__armed) { return; }   // idempotent: two script tags, one module

  function live() { return W.HW_LIVE; }

  function qs(params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') { return; }
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.join('&');
  }

  // Server error bodies are {error: "message", code: "..."} (wmdemo/reports_api.py's own
  // _err_body) -- flatten to one string, same posture as shared/hw-restock.js's errorText()
  // (which flattens the DIFFERENT {error:{code,message}} shape wmdemo/contracts.py's C.error
  // uses -- reports_api.py predates that convention, same as tax_api.py/register_api.py's own
  // non-contracts routes, so this module's flattening matches ITS server file, not restock's).
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

  // ── list(): GET /api/reports ─────────────────────────────────────────────
  function list() {
    return live().get('/api/reports').then(function (res) {
      return { ok: res.ok, status: res.code, error: errorText(res),
              reports: res.ok ? ((res.body && res.body.reports) || []) : [] };
    });
  }

  // ── run(): GET /api/reports/{name} ───────────────────────────────────────
  // args: {store_id (required), since?, until?, group_by?}. `report` is the full JSON body
  // wmdemo/reports.run() returns (report/title/category/params/columns/rows/totals/truncated/
  // note) — passed through verbatim, never re-shaped: a screen reads `columns` to know how to
  // render each row rather than this file guessing.
  function run(name, args) {
    args = args || {};
    if (!name) { return localError('report name is required'); }
    if (!args.store_id) { return localError('store_id is required'); }
    var path = '/api/reports/' + encodeURIComponent(name) + '?' + qs({
      store_id: args.store_id, since: args.since, until: args.until, group_by: args.group_by
    });
    return live().get(path).then(function (res) {
      return { ok: res.ok, status: res.code, error: errorText(res),
              report: res.ok ? res.body : null };
    });
  }

  // ── csvUrl(): builds the GET /api/reports/{name}.csv URL ────────────────
  // Never fetched by this module — the screen opens it directly (window.open / an <a href>),
  // same posture as shared/hw-restock.js's own slipUrl() for the print slip route, so the
  // browser handles the attachment download and the x-hw-write-token/x-api-key header the
  // export route needs is carried by whatever auth the browser's own session already has
  // (a cookie/URL token scheme is a screen-level concern, not this file's).
  function csvUrl(name, args) {
    args = args || {};
    var base = (live() && live().base) || '';
    return base + '/api/reports/' + encodeURIComponent(name || '') + '.csv?' + qs({
      store_id: args.store_id, since: args.since, until: args.until, group_by: args.group_by
    });
  }

  W.HWReports = {
    __armed: true,
    list: list,
    run: run,
    csvUrl: csvUrl
  };
})();
