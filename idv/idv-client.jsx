// ── idv/idv-client.jsx ── window.HWIdv — the one seam Verify screens use ───
// Same shape and reasoning as incentives/inc-client.jsx (window.HWInc), copied
// deliberately: every Verify screen reaches the network and identity through
// this file, never through window.HW_LIVE directly. hw-live.js is loaded on
// Hyperwolf Verify.html in LITE mode (data-hw-live-lite="1") — base
// resolution, the write token and the connectivity badge are armed; the
// /api/state catalog fetch and window.HW are not, because Verify has neither.
//
// session() IS THE PRODUCTION SEAM (docs/IDV-PLAN-2026-09-08.md §6). The
// estate has no login, so this isolates that one fact behind one function.
// The fallback identity is BYTE-FOR-BYTE Bounty's (incentives/inc-client.jsx
// L27-32) on purpose — same demo person, same three places it is kept in
// sync (pos/app.jsx USER, pos/data.jsx window.HW.STATS.associate,
// wmdemo/associates.py 'manisha-saini').
//
// ONE DELIBERATE DEPARTURE FROM inc-client.jsx: get()/post() here build their
// own fetch instead of delegating straight to HW_LIVE.get/post, because the
// IDV API contract (docs/IDV-API-CONTRACT.md, "Actor header on console
// routes") requires every console request to carry `X-HW-Actor: <associate
// id>`, and HW_LIVE's get()/post() take no headers argument — adding one
// there would be an edit to a shared file this task is not scoped to touch.
// So this file reads HW_LIVE's already-public surface (`base`, `hasToken()`)
// and the SAME localStorage key hw-live.js itself reads the write token from
// (`hw-live-token`, shared/hw-live.js L147 `TOKEN_KEY`) to reproduce its
// same-origin write-token behaviour, then layers the actor header on top.
// This file never WRITES that key — token lifecycle (accepting `?hwtoken=`,
// clearing it) stays entirely hw-live.js's job. If HW_LIVE is missing
// entirely (script not loaded), get/post degrade to the same
// { ok:false, code:0, error:'no-live-seam' } shape inc-client.jsx uses, so a
// screen never needs a second error-handling convention for "the seam itself
// is missing" versus "the seam answered with an error".
;(function () {
  function live() { return window.HW_LIVE || null; }

  function session() {
    var assoc = window.HW && window.HW.STATS && window.HW.STATS.associate;
    if (assoc && assoc.id) {
      return {
        id: assoc.id, name: assoc.name, role: assoc.role,
        storeId: assoc.storeId || assoc.store_id || null,
      };
    }
    // Fallback mirrors pos/app.jsx's USER exactly — the same demo person this
    // estate keeps in sync in three places. Verify loads none of pos/data.jsx,
    // so this is the branch that actually runs today (same as Bounty).
    return { id: 'manisha-saini', name: 'Manisha Saini', role: 'Floor Manager', storeId: 'elsinore' };
  }

  // ── role() / can() — plan §6's viewer|analyst|admin ladder ───────────────
  // The estate's session() returns a human job title ("Floor Manager"), not
  // one of Verify's three role names, because there is no real auth yet
  // (plan §6, §11.5). This is the one place that maps a display role onto the
  // Verify ladder, so production auth swapping session() in later is still a
  // one-function change — nothing downstream reads `session().role` for a
  // permission decision, only role()/can() do.
  var DISPLAY_ROLE_TO_IDV = { Admin: 'admin', Owner: 'admin', 'Floor Manager': 'analyst' };
  function role() {
    var s = session();
    return DISPLAY_ROLE_TO_IDV[s.role] || 'viewer';
  }
  var ROLE_RANK = { viewer: 0, analyst: 1, admin: 2 };
  // Action -> minimum role, from plan §6: viewer reads; analyst approves,
  // declines, resubmits, notes, assigns, edits data, merges people; admin
  // owns workflows, questionnaires, customization, lists (write), keys,
  // webhooks, team, deletion and overriding a Declined session.
  var ACTION_MIN_ROLE = {
    view: 'viewer',
    review: 'analyst', approve: 'analyst', decline: 'analyst', resubmit: 'analyst',
    note: 'analyst', assign: 'analyst', edit_data: 'analyst', merge_person: 'analyst',
    add_to_list: 'analyst',
    workflows: 'admin', questionnaires: 'admin', customization: 'admin',
    lists_manage: 'admin', keys: 'admin', webhooks: 'admin', team: 'admin',
    deletion: 'admin', override_declined: 'admin',
    create_session: 'analyst', import: 'admin', view_media: 'viewer', download_pdf: 'viewer',
    request_deletion: 'analyst', execute_deletion: 'admin',
  };
  function can(action) {
    var need = ACTION_MIN_ROLE[action];
    // An action this file has never heard of defaults to the strictest gate
    // rather than the loosest one — an unrecognised action string is a typo
    // or a not-yet-catalogued write, and either way "no" is the safe answer.
    if (need == null) need = 'admin';
    return (ROLE_RANK[role()] || 0) >= (ROLE_RANK[need] == null ? 2 : ROLE_RANK[need]);
  }

  var TOKEN_KEY = 'hw-live-token'; // same key shared/hw-live.js stores it under
  function writeToken() {
    try { return (window.localStorage.getItem(TOKEN_KEY) || '').trim() || null; }
    catch (e) { return null; }
  }
  function actorHeaders(extra) {
    var h = Object.assign({}, extra || {});
    var s = session();
    if (s && s.id) h['X-HW-Actor'] = s.id;
    return h;
  }
  function settle(res, j) {
    return {
      ok: res.ok, code: res.status, body: j,
      error: (j && (j.error || j.why)) || (res.ok ? null : ('HTTP ' + res.status)),
      hint: (j && j.hint) || null,
    };
  }
  function networkError(e) {
    return { ok: false, code: 0, body: null, hint: null,
      error: 'request failed: ' + (e && e.message ? e.message : 'unknown') };
  }

  // get/post — never reject, always resolve to { ok, code, body, error, hint }
  // (post also carries `gated`), so a caller can always destructure the
  // result without a try/catch. Degrades to 'no-live-seam' only when
  // window.HW_LIVE itself never armed.
  function get(path) {
    var L = live();
    if (!L || typeof L.get !== 'function') {
      return Promise.resolve({ ok: false, code: 0, body: null, error: 'no-live-seam', hint: null });
    }
    var url = (L.base || '') + path;
    return fetch(url, { method: 'GET', credentials: 'omit', cache: 'no-store', headers: actorHeaders() })
      .then(function (res) {
        return res.json().then(function (j) { return settle(res, j); }, function () { return settle(res, null); });
      })
      .catch(networkError);
  }
  function post(path, body) { return writeVerb('POST', path, body); }
  // patch()/put()/del() — same header/write-token/never-reject behaviour as
  // post(), just a different HTTP method. Added so screens stop re-deriving
  // this fetch wrapper locally (screen-session.jsx's verb(), screen-
  // workflows.jsx's idvPatch(), screen-integrate.jsx's idvDelete(),
  // screen-settings.jsx's writeJson() were all byte-for-byte copies of this
  // same logic under a different name — each file's own header comment
  // flagged it as a gap to close here).
  function patch(path, body) { return writeVerb('PATCH', path, body); }
  function put(path, body) { return writeVerb('PUT', path, body); }
  function del(path, body) { return writeVerb('DELETE', path, body); }
  function writeVerb(method, path, body) {
    var L = live();
    if (!L || typeof L.post !== 'function') {
      return Promise.resolve({ ok: false, code: 0, body: null, error: 'no-live-seam', hint: null, gated: false });
    }
    var url = (L.base || '') + path;
    var sameOrigin = !L.base || L.base === window.location.origin;
    var headers = actorHeaders({ 'Content-Type': 'application/json' });
    var token = sameOrigin ? writeToken() : null;
    if (token) headers['x-hw-write-token'] = token; // header name from shared/hw-live.js L148
    return fetch(url, { method: method, credentials: 'omit', cache: 'no-store', headers: headers, body: JSON.stringify(body || {}) })
      .then(function (res) {
        return res.json().then(function (j) { return finishPost(res, j, token); }, function () { return finishPost(res, null, token); });
      })
      .catch(function (e) { var r = networkError(e); r.gated = false; return r; });
  }
  function finishPost(res, j, tokenSent) {
    var r = settle(res, j);
    r.gated = res.status === 403 && !tokenSent && !!(j && typeof j.error === 'string' && j.error.indexOf('read-only') === 0);
    return r;
  }

  // ── usePoll(path, ms) ─────────────────────────────────────────────────────
  // Re-fetches `path` every `ms` (default 15000) and short-circuits the
  // re-render when the response's idv_version has not moved (docs/IDV-API-
  // CONTRACT.md: "every read carries idv_version ... for polling short-
  // circuit") — same contract as HWInc.usePoll's ledger_version, different
  // field name. Backs off to 4x the interval while the tab is hidden
  // (document.hidden), because Render bandwidth is a named risk (plan §9)
  // and a backgrounded tab has no one watching it refresh.
  function usePoll(path, ms) {
    var intervalMs = ms || 15000;
    var React = window.React;
    var stateHook = React.useState({ loading: true, error: null, data: null });
    var s = stateHook[0], setS = stateHook[1];
    var versionRef = React.useRef(null);
    var timerRef = React.useRef(null);
    var aliveRef = React.useRef(true);

    var fetchOnce = React.useCallback(function () {
      return get(path).then(function (r) {
        if (!aliveRef.current) return;
        if (!r.ok) {
          // Keep the parsed body even on a non-2xx response (e.g. a 503
          // EngineHealth shape with ok:false) — a caller that wants to tell
          // "backend unreachable" (r.body == null) apart from "backend
          // reachable but the engine isn't" (r.body present, ok:false)
          // needs that body in `data`, not just the error string.
          setS(function (prev) { return { loading: false, error: r.error || ('HTTP ' + r.code), data: r.body != null ? r.body : prev.data }; });
          return;
        }
        var v = r.body && r.body.idv_version;
        if (v != null && v === versionRef.current) {
          setS(function (prev) { return prev.loading ? { loading: false, error: null, data: prev.data != null ? prev.data : r.body } : prev; });
          return;
        }
        versionRef.current = v;
        setS({ loading: false, error: null, data: r.body });
      });
    }, [path]);

    React.useEffect(function () {
      aliveRef.current = true;
      versionRef.current = null;
      setS({ loading: true, error: null, data: null });
      fetchOnce();

      function schedule() {
        clearInterval(timerRef.current);
        var backoff = (typeof document !== 'undefined' && document.hidden) ? intervalMs * 4 : intervalMs;
        timerRef.current = setInterval(fetchOnce, backoff);
      }
      schedule();
      function onVisibility() { schedule(); }
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);

      return function () {
        aliveRef.current = false;
        clearInterval(timerRef.current);
        if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
      };
      // eslint-disable-next-line
    }, [path, intervalMs, fetchOnce]);

    return { loading: s.loading, error: s.error, data: s.data, refresh: fetchOnce };
  }

  // ── fmt — dates via window.HD (shared/hd-format.jsx), plus a score
  // formatter the estate has no equivalent of yet. Scores print with exactly
  // one decimal (docs/IDV-API-CONTRACT.md: "scores are numbers 0-100 with one
  // decimal"); a Score OBJECT ({score, model, caption, ...}) renders its
  // `caption` verbatim rather than reformatting it — the caption is the
  // provenance text ("open model · uncertified") and this file must never
  // invent its own wording for that.
  function scoreNumber(n) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toFixed(1);
  }
  var fmt = {
    date: function (iso) { return window.HD ? window.HD.formatDate(iso) : iso; },
    relative: function (iso) { return window.HD ? window.HD.relativeTime(iso) : iso; },
    number: function (n) { return window.HD ? window.HD.formatNumber(n) : String(n); },
    percent: function (n, digits) { return window.HD ? window.HD.formatPercent(n, digits) : ((n || 0) * 100).toFixed(digits || 1) + '%'; },
    cents: function (c, opts) { return window.HD ? window.HD.formatCents(c, opts) : '$' + ((c || 0) / 100).toFixed(2); },
    // score(87.4) -> "87.4"; score({score:87.4, caption:'open model · uncertified'}) -> "open model · uncertified"
    score: function (v) {
      if (v == null) return '—';
      if (typeof v === 'object') return v.caption != null ? String(v.caption) : scoreNumber(v.score);
      return scoreNumber(v);
    },
  };

  window.HWIdv = { session: session, get: get, post: post, patch: patch, put: put, del: del, usePoll: usePoll, fmt: fmt, role: role, can: can };
})();
