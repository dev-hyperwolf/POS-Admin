// ── shared/hw-tax.js ── Tax rate table + quote, typed fetchers ─────────────
// Plain JS IIFE. Publishes window.HWTax. Loads after shared/hw-live.js (this
// file never builds its own fetch, headers, base URL or write-token logic —
// every request goes through window.HW_LIVE.get / .post, exactly like every
// sibling *-live-*.js seam and shared/hw-dist-data.js, so the loopback gate,
// the same-origin rule and the x-hw-write-token header live in the one place
// that already owns them).
//
// SCOPE. ADMIN-GAP-LIST-2026-09-17.md §B "Tax" / §C items 2, 6, 7 (Team 6b).
// wmdemo/tax.py + wmdemo/tax_api.py own the data model and the arithmetic —
// this file is a thin, typed client over `/api/tax/*`, same posture as
// hw-dist-data.js: no client-side tax math, the server's own compute() is
// the only place a cent is ever computed. NO SCREEN CHANGES: this ships the
// data layer only (the register will show the breakdown later, via the Home
// card — see docs/TAX.md — never by editing pos/screen-register.jsx, which
// this pass does not touch).
//
// ERROR CONTRACT. Every fetcher resolves (never rejects) to either the
// route's own contract shape on success, or `{ status, error, code }` on
// failure — status is the HTTP code (0 for a network/transport failure,
// matching HW_LIVE's own convention), code is the server's machine-readable
// `code` field when it sent one (over_post, bad_rate_bps, rate_id_exists,
// already_closed, not_found, ...). Callers branch on `'error' in result`.
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

  // errShape carries the server's own `code` (over_post, bad_rate_bps, ...)
  // when the body has one, same posture as hw-dist-data.js's errShape plus
  // that one extra field -- tax_api.py's routes always send `code` on a
  // refusal and a caller (a rates-admin screen, later) needs it to show the
  // right inline message rather than a bare "HTTP 400".
  function errShape(r) {
    var body = r.body || {};
    return { status: r.code, error: r.error || ('HTTP ' + r.code), code: body.code || null };
  }

  // Builds a query string from a plain params object, dropping null/undefined/
  // empty-string values so an omitted filter never becomes "?store_id=".
  function qs(params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') { return; }
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.length ? ('?' + parts.join('&')) : '';
  }

  // ── GET /api/tax/rates?store_id=&at= ────────────────────────────────────
  // wmdemo/tax_api.py's `tax:read` route -- the CURRENTLY-effective rows
  // visible to `store_id` (its own rows plus the all-stores defaults, its
  // own override winning for the same slot) at `at` (server default: today).
  function fetchTaxRates(params) {
    return liveGet('/api/tax/rates' + qs(params || {})).then(function (r) {
      if (!r.ok) { return errShape(r); }
      var body = r.body || {};
      return { rates: body.rates || [] };
    });
  }

  // ── GET /api/tax/audit?store_id= ────────────────────────────────────────
  // `tax:admin` route -- every row (open, closed, future) for `store_id` (or
  // every store when omitted), oldest first, who/when included.
  function fetchTaxAudit(params) {
    return liveGet('/api/tax/audit' + qs(params || {})).then(function (r) {
      if (!r.ok) { return errShape(r); }
      var body = r.body || {};
      return { audit: body.audit || [] };
    });
  }

  // ── POST /api/tax/rates ──────────────────────────────────────────────────
  // `tax:admin`. Creates a new rate row. NEVER edits an existing one -- pass
  // an `id` that already exists and the server refuses with 409
  // rate_id_exists (this module does not special-case that; the caller reads
  // `.code` same as any other refusal). Required fields: jurisdiction_kind,
  // jurisdiction_name, kind, basis, rate_bps, applies_to, member_type,
  // effective_from -- see docs/TAX.md for the full shape.
  function createTaxRate(rate) {
    if (!rate || typeof rate !== 'object') {
      return Promise.resolve({ status: 400, error: 'rate is required', code: 'bad_body' });
    }
    return livePost('/api/tax/rates', rate).then(function (r) {
      if (!r.ok) { return errShape(r); }
      var body = r.body || {};
      return { rate: body.rate || null };
    });
  }

  // ── POST /api/tax/rates/{id}/close ──────────────────────────────────────
  // `tax:admin`. The ONLY mutation this API allows on an existing row --
  // sets `effective_to`. Close the old rate, then createTaxRate() the
  // successor: that pair is the entire "edit a rate" workflow (see
  // docs/TAX.md's history model).
  function closeTaxRate(id, effectiveTo) {
    if (!id) {
      return Promise.resolve({ status: 400, error: 'id is required', code: 'bad_body' });
    }
    return livePost('/api/tax/rates/' + encodeURIComponent(id) + '/close',
      { effective_to: effectiveTo }).then(function (r) {
      if (!r.ok) { return errShape(r); }
      var body = r.body || {};
      return { rate: body.rate || null };
    });
  }

  // ── POST /api/tax/quote ──────────────────────────────────────────────────
  // `tax:read` (read-shaped despite being POST -- the route computes, never
  // stores). `lines`: [{ line_idx?, base_cents, category? | is_cannabis? }].
  // Returns the TaxBreakdown shape untouched -- lines[].taxes[], totals per
  // kind, total_tax_cents -- no arithmetic happens in this file.
  function quoteTax(params) {
    params = params || {};
    if (!Array.isArray(params.lines)) {
      return Promise.resolve({ status: 400, error: 'lines must be an array', code: 'bad_body' });
    }
    var body = { lines: params.lines, store_id: params.store_id || null,
                member_type: params.member_type || 'all' };
    if (params.at) { body.at = params.at; }
    return livePost('/api/tax/quote', body).then(function (r) {
      if (!r.ok) { return errShape(r); }
      var b = r.body || {};
      return { lines: b.lines || [], totals: b.totals || {}, total_tax_cents: b.total_tax_cents || 0 };
    });
  }

  W.HWTax = {
    fetchTaxRates: fetchTaxRates,
    fetchTaxAudit: fetchTaxAudit,
    createTaxRate: createTaxRate,
    closeTaxRate: closeTaxRate,
    quoteTax: quoteTax
  };
})();
