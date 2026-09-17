// ── shared/hw-restock.js ── Floor Restock data layer ────────────────────────
// Plain JS. Loads BEFORE React (same load order as shared/hw-live.js and its
// siblings), on the POS entry HTML only.
//
// WHAT IT IS. A thin wrapper around the four live restock routes plus the
// shelf picker's locations route, all through window.HW_LIVE — never a raw
// fetch of its own, so the session token header and same-origin base URL are
// inherited from that one seam (see shared/hw-live.js's own header comment).
// pos/screen-floor-restock.jsx renders; this file only talks to the server
// and hands back parsed contract shapes. It does no arithmetic on `give` —
// every number a screen shows comes from a route response, never a client
// re-derivation of one (see wmdemo/inventory_api.py's own comment on
// _restock_apply: a tampered `give` is capped server-side, never trusted).
//
// ROUTES (read wm-demo/wmdemo/inventory_api.py before changing any of this):
//   GET  /api/inventory/restock/preview  ?store_id&shelf_location_id&since
//   POST /api/inventory/restock/plan      {store_id, shelf_location_id, since?, actor}
//   POST /api/inventory/restock/apply     {plan, actor, station_id?, read?:{tag_ids}}
//   GET  /api/inventory/restock/slip      ?store_id&shelf_location_id&since&format=html|text
//   GET  /api/inventory/locations         ?kind&region_id&active
//
// WHY plan()'S RESULT (not a hand-built object) IS WHAT apply() WANTS.
// plan_restock_for_store stamps `shelf_location_id` and `since` onto the Plan
// it returns (contract-legal: Plan.additionalProperties is true) so that
// _restock_apply can re-derive the identical Plan server-side and cap every
// posted `give` at what it re-derives — the posted plan's own `give` is never
// trusted. Passing through exactly what preview()/plan() returned, untouched,
// is what keeps that re-derivation matching what the operator actually saw.
//
// PlanLine (contracts/schema/PlanLine.json) carries batch_id but not
// batch_no/thc_pct/packaged_at as structured fields — those exist only, as a
// formatted string, inside a mixed-batch line's `note`
// (restock_engine.py's _mixed_batch_note/_batch_detail_text). GET
// /api/inventory/batches has the full structured shape but is outside this
// build's approved endpoint set, so this module does not call it — see the
// build report for the resulting screen-level gap.
//
// ERRORS. Every function resolves, never rejects, to a plain object carrying
// `status` (HTTP code, or 0 for a request that never reached the server) and
// `error` (a string, or null on success) — never a thrown string. Mirrors
// window.HW_LIVE.get/post's own "never rejects" contract one level up.
//
// WRITES ARE NOT RETRIED. plan()/apply() call HW_LIVE.post exactly once. A
// retry of apply() in particular would risk re-firing wmdemo/inventory.py's
// move() side effects — the same reasoning R3 §4.5 states for GAS triggers.
//
// PUBLIC SURFACE: window.HWRestock = { preview, plan, apply, slipUrl, locations }.
(function () {
  'use strict';
  var W = window;
  if (W.HWRestock && W.HWRestock.__armed) { return; }   // idempotent: two script tags, one module

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

  // Server error bodies are C.error(code, message, details) -> {error: {code, message, details}}.
  // HW_LIVE.get/post already lift `error`/`hint` onto the settled result, but `error` there can
  // still be that whole object (not a string) — flatten it to one string here so every HWRestock
  // caller gets the same {status, error:string|null} shape regardless of what shape the
  // underlying failure took.
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

  // Deep-clones via JSON round-trip before ever handing a plan to HW_LIVE.post — this module
  // must never mutate the plan object a caller gave it (see test/hw-restock.test.mjs), and a
  // clone makes that true regardless of what the fetch layer or the caller does with it after.
  function cloneJson(v) {
    if (v === undefined) { return v; }
    return JSON.parse(JSON.stringify(v));
  }

  // ── preview(): GET /api/inventory/restock/preview ──────────────────────────
  function preview(args) {
    args = args || {};
    var missing = missingFieldsError(['store_id', 'shelf_location_id', 'since'], args);
    if (missing) { return localError(missing); }
    var path = '/api/inventory/restock/preview?' + qs({
      store_id: args.store_id, shelf_location_id: args.shelf_location_id, since: args.since
    });
    return live().get(path).then(function (res) {
      return { ok: res.ok, status: res.code, error: errorText(res), plan: res.ok ? (res.body && res.body.plan) : null };
    });
  }

  // ── plan(): POST /api/inventory/restock/plan ────────────────────────────────
  // Stamps `actor` onto the returned Plan as `planned_by` server-side; this is the Plan a
  // "Move to floor" commit should hand to apply(), not a hand-built object.
  function plan(args) {
    args = args || {};
    var missing = missingFieldsError(['store_id', 'shelf_location_id', 'actor'], args);
    if (missing) { return localError(missing); }
    var body = { store_id: args.store_id, shelf_location_id: args.shelf_location_id, actor: args.actor };
    if (args.since !== undefined && args.since !== null && args.since !== '') { body.since = args.since; }
    return live().post('/api/inventory/restock/plan', body).then(function (res) {
      return { ok: res.ok, status: res.code, error: errorText(res), plan: res.ok ? (res.body && res.body.plan) : null };
    });
  }

  // ── apply(): POST /api/inventory/restock/apply ──────────────────────────────
  // Surfaces the three outcomes wmdemo/inventory_api.py's _restock_apply returns verbatim
  // (applied / skipped / adjusted), plus `handCountRequired` — the subset of `skipped` whose
  // reason is exactly 'hand_count_required' — because that is the one outcome the screen has to
  // act on immediately (mark the line hand_counted, or read more tags, and re-submit).
  function apply(args) {
    args = args || {};
    if (!args.plan) { return localError('plan is required'); }
    if (!args.actor) { return localError('actor is required'); }
    var body = { plan: cloneJson(args.plan), actor: args.actor };
    if (args.station_id !== undefined && args.station_id !== null && args.station_id !== '') {
      body.station_id = args.station_id;
    }
    if (args.read !== undefined && args.read !== null) { body.read = cloneJson(args.read); }
    return live().post('/api/inventory/restock/apply', body).then(function (res) {
      if (!res.ok) {
        return { ok: false, status: res.code, error: errorText(res), applied: [], skipped: [], adjusted: [], movements: [], handCountRequired: [] };
      }
      var b = res.body || {};
      var skipped = b.skipped || [];
      return {
        ok: true, status: res.code, error: null,
        applied: b.applied || [],
        skipped: skipped,
        adjusted: b.adjusted || [],
        movements: b.movements || [],
        handCountRequired: skipped.filter(function (s) { return s && s.reason === 'hand_count_required'; })
                                   .map(function (s) { return s.line; })
      };
    });
  }

  // ── slipUrl(): builds the GET /api/inventory/restock/slip URL ─────────────
  // Never fetched by this module — the screen opens it directly (window.open / an <a href>) so
  // the browser handles the html|text response and native print. `source` is either a Plan this
  // module returned (plan_restock_for_store stamps shelf_location_id/since onto it) or a plain
  // {store_id, shelf_location_id, since, kit?, region?} params object.
  function slipUrl(source, format) {
    source = source || {};
    var store_id = source.store_id;
    var shelf_location_id = source.shelf_location_id;
    var since = source.since;
    var base = (live() && live().base) || '';
    return base + '/api/inventory/restock/slip?' + qs({
      store_id: store_id, shelf_location_id: shelf_location_id, since: since,
      kit: source.kit, region: source.region, format: format || 'html'
    });
  }

  // ── locations(): GET /api/inventory/locations ───────────────────────────────
  // Used for the store + shelf picker. `store_id` is accepted for call-site symmetry with the
  // other functions but the live route filters by kind/region_id/active only (wmdemo has no
  // store_id filter on this route) — callers filter the returned list by store client-side if
  // they need to, which is display filtering, not arithmetic on a contract number.
  function locations(args) {
    args = args || {};
    var path = '/api/inventory/locations?' + qs({
      kind: args.kind, region_id: args.region_id,
      active: args.active === undefined ? undefined : (args.active ? '1' : '0')
    });
    return live().get(path).then(function (res) {
      return { ok: res.ok, status: res.code, error: errorText(res), locations: res.ok ? ((res.body && res.body.locations) || []) : [] };
    });
  }

  W.HWRestock = {
    __armed: true,
    preview: preview,
    plan: plan,
    apply: apply,
    slipUrl: slipUrl,
    locations: locations
  };
})();
