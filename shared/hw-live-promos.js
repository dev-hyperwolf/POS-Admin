// ── shared/hw-live-promos.js ── Weedmaps promo registry, live ──────────────
// Plain JS. Loads BEFORE React, on Promotions Suite.html only. Sibling of
// shared/hw-live.js and friends (hw-live-mapping.js, hw-live-identity.js,
// hw-live-checkin.js, hw-live-taxonomy.js, hw-live-regions.js) but scoped to
// exactly the six wmdemo routes this panel needs (wmdemo/server.py, all under
// do_POST — there is no GET variant of any of these, registry included):
//   POST /api/promos/registry      read: WM promos + internal promos + links
//                                   + computed overlaps (promos.promo_registry)
//   POST /api/promos/pull          mirror-pull WM's available_discounts
//   POST /api/promos/link          assert a WM<->internal relation
//   POST /api/promos/link/delete   remove one
//   POST /api/promos/internal      create/update an internal promo
//   POST /api/promos/internal/delete   soft-delete one (row + links survive)
//
// SELF-CONTAINED, not a dependency on shared/hw-live.js being on the page —
// Promotions Suite.html never loads it (there is no catalog here to refresh,
// and hw-live.js's own GET is a ~1.9MB /api/state pull that would be pure
// waste on this page). It DOES share hw-live.js's write-token convention
// (same localStorage key, same header) so a token set once on the POS entry
// page is honoured here too, and "armed on any origin, same-origin fetch
// decides" (shared/hw-live.js's own comment on why: a loopback-only gate
// left the seam inert on every hosted deployment; here, on GitHub Pages
// /api/promos/registry 404s, the fetch fails, and the panel says so rather
// than showing fabricated data).
//
// WHAT IT REPLACES. pweb/weedmaps.jsx's promo panel faked every control:
// Push / Re-sync / Pause / Resume resolved via a client-side setTimeout with
// no backing route — and none is buildable: Weedmaps' partner API has no
// promo-push endpoint at all (wmdemo/config.py's own comment; polling
// (pull) is the only mechanism that exists). Link / Merge / Keep-standalone
// / Unlink rendered with no onClick at all, even though the backend they
// need (wmdemo/promos.py + store.py — mirror-pull, an internal registry,
// named WM<->internal relations, automatic overlap detection with severity)
// has been fully built and routed the whole time. This file is the wiring.
// It invents no state of its own and computes no overlap of its own — every
// value a caller gets back is the server's.
//
// PUBLIC SURFACE: window.HW_PROMOS_LIVE = {
//   status(), hasToken(), registry(), pull(opts), link(fields),
//   unlink(linkId), upsertInternal(fields), deleteInternal(id), disable() }.
// Every method returns a Promise of { ok, code, body, gated, error, hint }
// and NEVER rejects — same contract as shared/hw-live.js's post(), so a
// caller cannot mistake a refusal for a network error and report a
// committed write as one.
// Turn it off: append `?hwpromos=off`, or run `HW_PROMOS_LIVE.disable()`.
(function () {
  'use strict';
  var W = window;
  if (W.HW_PROMOS_LIVE && W.HW_PROMOS_LIVE.__armed) { return; }  // idempotent

  var TOKEN_KEY = 'hw-live-token';          // shared/hw-live.js:133 — same key
  var TOKEN_HEADER = 'x-hw-write-token';    // wmdemo/server.py:366
  var OFF_KEY = 'hw-promos-off';
  var TIMEOUT_MS = 9000;

  function qs(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(W.location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }

  var override = qs('hwpromos');
  var disabled = override === 'off' || override === '0';
  try { if (W.localStorage.getItem(OFF_KEY) === '1') { disabled = true; } } catch (e) {}

  // Armed on any origin — the fetch itself decides whether this origin
  // serves the API. See the file header for why a loopback-only gate is the
  // wrong rule here (it is shared/hw-live.js's own correction, applied the
  // same way in every sibling seam written after it).
  var armed = !disabled;
  var base = W.location.origin;

  function token() {
    try { return (W.localStorage.getItem(TOKEN_KEY) || '').trim() || null; }
    catch (e) { return null; }
  }

  function withTimeout(p, ms) {
    return new Promise(function (resolve) {
      var done = false;
      var t = setTimeout(function () {
        if (done) { return; }
        done = true;
        resolve({ ok: false, code: 0, body: null, gated: false, error: 'timeout',
                  hint: 'No response within ' + ms + 'ms.' });
      }, ms);
      p.then(function (r) {
        if (done) { return; }
        done = true; clearTimeout(t); resolve(r);
      }, function (e) {
        if (done) { return; }
        done = true; clearTimeout(t);
        resolve({ ok: false, code: 0, body: null, gated: false,
                  error: 'request failed: ' + (e && e.message ? e.message : 'unknown'),
                  hint: null });
      });
    });
  }

  // Only the public-mode write gate answers 403 with an `error` beginning
  // 'read-only' (wmdemo/server.py:368) — anything else means the gate let us
  // through, whatever the route then decided.
  function settle(res, j) {
    var gated = res.status === 403 && !!(j && typeof j.error === 'string' &&
                                         j.error.indexOf('read-only') === 0);
    return {
      ok: res.ok,
      code: res.status,
      body: j,
      gated: gated,
      error: (j && (j.error || j.why)) || (res.ok ? null : ('HTTP ' + res.status)),
      hint: (j && j.hint) || null
    };
  }

  // THE one write/read path — every route this seam calls is a POST
  // (wmdemo/server.py has no GET registry route; reads and writes share one
  // dispatcher and one gate). `timeoutMs` overrides TIMEOUT_MS per call — see
  // PULL_TIMEOUT_MS below for why pull() alone needs a much longer one.
  function post(path, body, timeoutMs) {
    if (!armed) {
      return Promise.resolve({ ok: false, code: 0, body: null, gated: false,
        error: 'disabled', hint: 'HW_PROMOS_LIVE is turned off on this page (?hwpromos=off).' });
    }
    var headers = { 'Content-Type': 'application/json' };
    var t = token();
    if (t) { headers[TOKEN_HEADER] = t; }
    var req = fetch(base + path, {
      method: 'POST',
      headers: headers,
      credentials: 'omit',
      cache: 'no-store',
      body: JSON.stringify(body || {})
    }).then(function (res) {
      return res.json().then(function (j) { return settle(res, j); },
                             function () { return settle(res, null); });
    });
    return withTimeout(req, timeoutMs || TIMEOUT_MS);
  }

  // pull() alone needs far more room than every other route here.
  // wmdemo/wm_client.py's request() retries a network-level failure (a dead
  // or unreachable WM_API_BASE — exactly the scratch-test setup this file's
  // own header describes, and a real Weedmaps outage looks the same) up to 4
  // times with exponential backoff (1+2+4+8s plus jitter, ~15-19s) BEFORE
  // raising — and pull_wm_promos does this once per configured wmid (2, by
  // default), serially. Measured against a deliberately dead WM_API_BASE:
  // >9s and still running. TIMEOUT_MS is plenty for registry/link/unlink,
  // which never leave local SQLite, but using it for pull() would show
  // "timeout" while the server is still doing exactly what it is supposed to
  // do — this is a client-side patience setting, not a claim about the
  // server. 45s comfortably covers two full worst-case retry sequences.
  var PULL_TIMEOUT_MS = 45000;

  W.HW_PROMOS_LIVE = {
    __armed: true,

    status: function () { return { armed: armed, base: base, hasToken: !!token() }; },
    hasToken: function () { return !!token(); },

    // Read-only. Never triggers a WM pull itself — promos.promo_registry()
    // is local-SQLite-only by construction (its own docstring).
    registry: function () { return post('/api/promos/registry', {}); },

    // opts: { source: 'live'|'fixture', wmid }. Omit `source` and the SERVER
    // defaults to 'fixture' (wmdemo/server.py's route reads
    // body.get('source','fixture')) — deliberately conservative for a stray
    // call. An operator-facing "Pull from Weedmaps" button should pass
    // { source: 'live' } explicitly, matching what the server's own
    // always-on background sync loop does every 60s
    // (wmdemo/server.py:_promo_sync_loop -> promos.sync_promos_all).
    pull: function (opts) { return post('/api/promos/pull', opts || {}, PULL_TIMEOUT_MS); },

    // relation: 'mirrors' | 'supersedes' | 'conflict' (store.add_promo_link's
    // own whitelist — anything else comes back as a 400 with that message).
    link: function (wmPromoId, internalPromoId, relation, note) {
      return post('/api/promos/link', {
        wm_promo_id: wmPromoId,
        internal_promo_id: internalPromoId,
        relation: relation,
        note: note || null
      });
    },
    unlink: function (linkId) { return post('/api/promos/link/delete', { link_id: linkId }); },

    upsertInternal: function (fields) { return post('/api/promos/internal', fields || {}); },
    deleteInternal: function (id) { return post('/api/promos/internal/delete', { id: id }); },

    disable: function () {
      try { W.localStorage.setItem(OFF_KEY, '1'); } catch (e) {}
      armed = false;
    }
  };
})();
