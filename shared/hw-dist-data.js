// ── shared/hw-dist-data.js ── Distribution/Refill typed fetchers ───────────
// Plain JS IIFE. Publishes window.HWDistData. Loads after shared/hw-live.js
// (this file never builds its own fetch, headers, base URL or write-token
// logic — every request goes through window.HW_LIVE.get / .post, exactly
// like every sibling *-live-*.js seam, so the loopback gate, the same-origin
// rule and the x-hw-write-token header live in the one place that already
// owns them).
//
// SCOPE. Team 2c builds only the components all four Refill concepts already
// share (docs/codebase-audit/distribution/CONSOLE-ENDPOINT-MAP.md §B). This
// file is the data half: one typed fetcher per route the census maps, each
// returning the contract shape the route already emits, untouched — no
// client-side arithmetic on quantities (sold/need/cap/give stay exactly what
// the server computed). Two census rows have NO ROUTE (StatusTimeline's
// lifecycle events; "Manage box types" CRUD) — there is deliberately no
// fetcher for either here; shared/hw-dist-ui.jsx renders those components
// display-only off caller-supplied props instead.
//
// ERROR CONTRACT. Every fetcher resolves (never rejects) to either the
// route's own contract shape on success, or `{ status, error }` on failure —
// status is the HTTP code (0 for a network/transport failure, matching
// HW_LIVE's own convention). Callers branch on `'error' in result`.
(function () {
  'use strict';
  var W = window;

  function liveGet(path) {
    if (!W.HW_LIVE || typeof W.HW_LIVE.get !== 'function') {
      return Promise.resolve({ ok: false, code: 0, body: null, error: 'HW_LIVE unavailable' });
    }
    return W.HW_LIVE.get(path);
  }

  function livePost(path, body) {
    if (!W.HW_LIVE || typeof W.HW_LIVE.post !== 'function') {
      return Promise.resolve({ ok: false, code: 0, body: null, error: 'HW_LIVE unavailable' });
    }
    return W.HW_LIVE.post(path, body);
  }

  function errShape(r) {
    return { status: r.code, error: r.error || ('HTTP ' + r.code) };
  }

  // Builds a query string from a plain params object, dropping null/undefined/
  // empty-string values so an omitted filter never becomes "?kind=".
  function qs(params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') { return; }
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.length ? ('?' + parts.join('&')) : '';
  }

  // 'YYYY-MM-DD' for a Date, in UTC — the census's GET /api/inventory/received
  // route takes a calendar day, not a timestamp, so day math here is UTC-only
  // to keep it independent of the viewer's local timezone/DST.
  function isoDay(d) {
    return d.getUTCFullYear() + '-' +
      String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
      String(d.getUTCDate()).padStart(2, '0');
  }

  function parseDay(dayStr) {
    // Parsed as UTC midnight regardless of local zone.
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayStr || ''));
    if (!m) { return null; }
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  }

  function todayISO() { return isoDay(new Date()); }

  // ── GET /api/inventory/locations ──────────────────────────────────────
  // inventory_api.py:207-210. kind=region|kit|box; parent_id links; region_id.
  // Census gap: no single "list tree" route (item 24) — client chases
  // parent_id links or filters by kind. fetchLocations returns the flat list
  // as-is; fetchKitBoxTree (below) does the structural (non-quantity) chase.
  function fetchLocations(params) {
    return liveGet('/api/inventory/locations' + qs(params || {})).then(function (r) {
      if (!r.ok) { return errShape(r); }
      var body = r.body || {};
      return { locations: body.locations || [] };
    });
  }

  // Structural tree-walk over fetchLocations — Region -> Kit -> Boxes, by
  // kind + parent_id. No quantity math: this only re-shapes identity/
  // hierarchy fields the server already returned.
  function fetchKitBoxTree(params) {
    return fetchLocations(params).then(function (r) {
      if (r.error) { return r; }
      var byId = {};
      r.locations.forEach(function (loc) {
        byId[loc.id] = Object.assign({}, loc, { children: [] });
      });
      var regions = [];
      r.locations.forEach(function (loc) {
        var node = byId[loc.id];
        if (loc.kind === 'region') {
          regions.push(node);
        } else if (loc.parent_id != null && byId[loc.parent_id]) {
          byId[loc.parent_id].children.push(node);
        }
      });
      return { tree: regions };
    });
  }

  // ── GET /api/inventory/restock/preview ────────────────────────────────
  // inventory_api.py:232-233. Built by plan_restock_for_store():626.
  // Contract: plan { lines[], skipped[], warnings[] }.
  function fetchRestockPreview(params) {
    params = params || {};
    if (!params.store_id || !params.shelf_location_id) {
      return Promise.resolve({ status: 400, error: 'store_id and shelf_location_id are required' });
    }
    return liveGet('/api/inventory/restock/preview' + qs(params)).then(function (r) {
      if (!r.ok) { return errShape(r); }
      var plan = (r.body && r.body.plan) || {};
      return {
        plan: {
          lines: plan.lines || [],
          skipped: plan.skipped || [],
          warnings: plan.warnings || []
        }
      };
    });
  }

  // Convenience view over the same route for SkipsPanel — plan.skipped[] /
  // plan.warnings[] already carry the reasons; this is a re-read, not a
  // second computation.
  function fetchSkips(params) {
    return fetchRestockPreview(params).then(function (r) {
      if (r.error) { return r; }
      return { skipped: r.plan.skipped, warnings: r.plan.warnings };
    });
  }

  // ── GET /api/inventory/batches ────────────────────────────────────────
  // inventory_api.py:211-217. oldest_first(sku), FEFO ordered.
  // Contract: { batches[], mixed }. Used to enrich PlanPreviewTable rows
  // with batch_no / THC / packaged date and the mixed-batch flag.
  function fetchBatches(params) {
    params = params || {};
    if (!params.sku) {
      return Promise.resolve({ status: 400, error: 'sku is required' });
    }
    return liveGet('/api/inventory/batches' + qs(params)).then(function (r) {
      if (!r.ok) { return errShape(r); }
      var body = r.body || {};
      return { batches: body.batches || [], mixed: !!body.mixed };
    });
  }

  // ── GET /api/inventory/received?day=YYYY-MM-DD ────────────────────────
  // inventory_api.py:222-227. One calendar day per call — census item 23
  // proposes a ?days=N range param; until it lands, callers loop (below).
  function fetchReceivedForDay(params) {
    params = params || {};
    var day = params.day;
    if (!day) {
      return Promise.resolve({ status: 400, error: 'day (YYYY-MM-DD) is required' });
    }
    return liveGet('/api/inventory/received' + qs({ day: day })).then(function (r) {
      if (!r.ok) { return errShape(r); }
      var body = r.body || {};
      return { day: day, received: body.received || [] };
    });
  }

  // ReceivedLane's 7-day loop (census item 23: no range param yet). Calls
  // fetchReceivedForDay once per day, for the 7 calendar days ending at
  // `endDay` (inclusive), oldest to newest. Each day's success/failure is
  // independent — one bad day does not blank the other six.
  function fetchReceivedLast7Days(params) {
    params = params || {};
    var endStr = params.endDay || todayISO();
    var end = parseDay(endStr);
    if (!end) {
      return Promise.resolve({ status: 400, error: 'endDay must be YYYY-MM-DD' });
    }
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(end.getTime());
      d.setUTCDate(d.getUTCDate() - i);
      days.push(isoDay(d));
    }
    return Promise.all(days.map(function (day) {
      return fetchReceivedForDay({ day: day }).then(function (r) {
        if (r.error) {
          return { day: day, ok: false, received: [], status: r.status, error: r.error };
        }
        return { day: r.day, ok: true, received: r.received };
      });
    })).then(function (results) {
      return { days: results };
    });
  }

  // ── POST /api/inventory/restock/apply ─────────────────────────────────
  // inventory_api.py:265-266 ("Move to floor" in Floor Restock / census §A,
  // "Send today" in ReceivedLane / census §B — same route). Re-derives the
  // plan server-side to cap give values; applies via inventory.py. Returns
  // the server's own response body untouched on success.
  function applyRestockPlan(params) {
    params = params || {};
    if (!params.plan) {
      return Promise.resolve({ status: 400, error: 'plan is required' });
    }
    return livePost('/api/inventory/restock/apply', { plan: params.plan, actor: params.actor || null })
      .then(function (r) {
        if (!r.ok) { return errShape(r); }
        return r.body || {};
      });
  }

  W.HWDistData = {
    fetchLocations: fetchLocations,
    fetchKitBoxTree: fetchKitBoxTree,
    fetchRestockPreview: fetchRestockPreview,
    fetchSkips: fetchSkips,
    fetchBatches: fetchBatches,
    fetchReceivedForDay: fetchReceivedForDay,
    fetchReceivedLast7Days: fetchReceivedLast7Days,
    applyRestockPlan: applyRestockPlan,
    // Exposed for the Bench harness and tests; not part of the route surface.
    _isoDay: isoDay
  };
})();
