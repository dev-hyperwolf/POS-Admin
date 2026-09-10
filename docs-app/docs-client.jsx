// ── docs-app/docs-client.jsx ── window.HWDocs — the one seam Docs screens use ──
// Same shape and reasoning as incentives/inc-client.jsx (window.HWInc) and
// idv/idv-client.jsx (window.HWIdv), copied deliberately: every Docs screen
// reaches the backend through this file, never through window.HW_LIVE or a
// bare fetch() directly. Hyperwolf Docs.html loads shared/hw-live.js in LITE
// mode (data-hw-live-lite="1") — base resolution, the write token and the
// connectivity badge are armed; the /api/state catalog fetch and window.HW
// are not, because Docs has neither.
//
// UNLIKE idv-client.jsx's get(), the Docs API requires the write token on
// EVERY route, reads included ("All routes require header x-hw-write-token
// (reads included)"), so there is exactly one request builder here, used by
// every method — no separate authenticated-write-only path.
//
// Every method returns a Promise that RESOLVES with the parsed JSON body on
// a 2xx response and REJECTS with `{ status, error }` on anything else
// (network failure included, as status 0) — a 403 is a plain rejection a
// screen can catch and show the "paste the write token" gate for, per
// docs/... (see Hyperwolf Docs.html header strip / gate screen in app.jsx).
;(function () {
  function base() {
    return (window.HW_LIVE && window.HW_LIVE.base) || window.location.origin;
  }

  // Same localStorage key shared/hw-live.js itself reads the write token
  // from (shared/hw-live.js L147 TOKEN_KEY) — this file never writes it;
  // token lifecycle (accepting `?hwtoken=`, clearing it) stays hw-live.js's
  // job. setToken() below delegates to HW_LIVE.setToken when it is armed so
  // the badge and any other reader of the token stay in sync, and only
  // falls back to writing the key directly when HW_LIVE never loaded.
  var TOKEN_KEY = 'hw-live-token';
  function readToken() {
    if (window.HW_LIVE && typeof window.HW_LIVE.hasToken === 'function' && !window.HW_LIVE.hasToken()) return null;
    try { return (window.localStorage.getItem(TOKEN_KEY) || '').trim() || null; }
    catch (e) { return null; }
  }
  function hasToken() {
    if (window.HW_LIVE && typeof window.HW_LIVE.hasToken === 'function') return window.HW_LIVE.hasToken();
    return !!readToken();
  }
  function setToken(v) {
    if (window.HW_LIVE && typeof window.HW_LIVE.setToken === 'function') { window.HW_LIVE.setToken(v); return; }
    try {
      if (v) window.localStorage.setItem(TOKEN_KEY, String(v));
      else window.localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  function qs(params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === '') return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  function parseError(res, json) {
    if (json && json.error && typeof json.error === 'object') return json.error;
    if (json && typeof json.error === 'string') return { code: 'error', message: json.error };
    return { code: 'http_' + res.status, message: 'HTTP ' + res.status };
  }

  // request() — never throws synchronously; every failure path (network,
  // non-JSON body, non-2xx status) rejects with the same { status, error }
  // shape so a caller never needs two error-handling conventions.
  function request(method, path, body) {
    var url = base() + path;
    var headers = {};
    var token = readToken();
    if (token) headers['x-hw-write-token'] = token;
    var opts = { method: method, credentials: 'omit', cache: 'no-store', headers: headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(url, opts).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (json) {
        if (!res.ok) return Promise.reject({ status: res.status, error: parseError(res, json) });
        return json;
      });
    }, function (e) {
      return Promise.reject({ status: 0, error: { code: 'network', message: e && e.message ? e.message : 'request failed' } });
    });
  }

  window.HWDocs = {
    hasToken: hasToken,
    setToken: setToken,
    status: function () { return request('GET', '/api/docs/status'); },
    pages: function () { return request('GET', '/api/docs/pages'); },
    page: function (repo, path) { return request('GET', '/api/docs/page' + qs({ repo: repo, path: path })); },
    search: function (q, opts) {
      opts = opts || {};
      return request('GET', '/api/docs/search' + qs({ q: q, k: opts.k, repo: opts.repo }));
    },
    chat: function (question, history, repo) {
      var payload = { question: question, history: history || [] };
      if (repo) payload.repo = repo;
      return request('POST', '/api/docs/chat', payload);
    },
    reindex: function () { return request('POST', '/api/docs/reindex'); },
  };
})();
