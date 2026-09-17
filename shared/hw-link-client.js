// ── shared/hw-link-client.js ── the signed-link fetch seam ──────────────────
//
// wm-demo's docs/SIGNED-LINKS.md (Team 7b, `wmdemo/signed_links.py` /
// `signed_links_api.py`): an anonymous employee-facing page authenticates
// with ONE bearer token carried in the `x-hw-link-token` header — never a
// query param (the token would land in server logs/Referer), never a
// session, never `x-hw-write-token`. This file is the client half of that
// contract, deliberately separate from shared/hw-live.js:
//
//   * hw-live.js's `post()`/`get()` are built around a credential that
//     LIVES somewhere (localStorage's `hw-live-token`, sessionStorage's
//     `hw-live-session`) and is read back across page loads. A signed link
//     is the opposite: single-purpose, single-recipient, and the token
//     itself is the only durable copy that should exist ANYWHERE outside
//     the URL fragment it arrived in (shared/hw-sign-page.jsx reads it once
//     from `location.hash` and holds it in memory only). Persisting it
//     would let it outlive the tab, get restored into a later session on
//     the same device, or leak into whatever else reads that storage key —
//     none of which docs/SIGNED-LINKS.md's single-use, single-recipient
//     model expects. So this module touches neither localStorage nor
//     sessionStorage, anywhere, for any reason: the token is a parameter to
//     every call, never a module-level variable it remembers for you.
//   * hw-live.js's post()/get() attach `x-hw-write-token` and fold a 401
//     into "clear the session, fire an event". There is no session here to
//     clear — a bad/expired/exhausted link is terminal, and the caller
//     (hw-sign-page.jsx) decides what UI that terminal state gets (docs/
//     SIGNED-LINKS.md: 404 is always generic "not found" regardless of
//     WHY, 409 means the link's uses are exhausted — the one reason
//     `consume`/`submit` discloses).
//
// CONTRACT, deliberately narrow (four functions, no state):
//   resolve(token)              -> GET  /api/links/resolve
//   submit(slug, token, data)   -> POST /api/forms/<slug>/submit  {data}
//   consume(token)              -> POST /api/links/consume        {}
//     (exposed for completeness/parity with docs/SIGNED-LINKS.md's route
//     table; NOT called by hw-sign-page.jsx today — forms_api.py's own
//     `_submit` already consumes a link-scoped submission server-side,
//     after `forms.submit()`'s insert commits, per that file's own
//     docstring. A future caller that posts to some OTHER link-gated write
//     route — one that does not auto-consume the way `_submit` does — would
//     need this.)
//   submitTo(path, token, body) -> POST <path>                    body
//     A link-scoped write route that is NOT `/api/forms/<slug>/submit` --
//     e.g. `POST /api/writeups/<id>/sign` (`writeups:sign` scope,
//     wmdemo/writeups/sign.py), whose own contract (`WriteupSignature`,
//     contracts/index.js) is the top-level request object, not `{data:...}`.
//     Unlike submit(), `body` is sent EXACTLY as given -- no wrapping, no
//     shape assumed -- because this route's contract is not this module's to
//     know. Same statelessness as every export here: `path` and `token` are
//     both arguments, nothing remembered between calls.
//
// Every call resolves to EXACTLY ONE OF:
//   { status, body }   -- 2xx, `body` is the parsed JSON (or null if the
//                          server sent a 2xx with an unparseable/empty body)
//   { status, error }  -- anything else, `error` a short human string taken
//                          from the server's own `{error:{code,message}}`
//                          shape when present, else a generic fallback.
// NEVER REJECTS. A caller that has to choose between `.then` and `.catch`
// to learn whether a link was refused is a caller that will get it wrong
// once — same reasoning hw-live.js's own `post()` docstring gives for its
// identical no-reject rule. A network failure (offline, DNS, CORS) becomes
// `{ status: 0, error: 'request failed: ...' }`, mirroring hw-live.js's own
// `status: 0` convention for "the request never reached the server".
//
// NO RETRIES, anywhere, ever. A submit is exactly one fetch: retrying a
// write with real side effects (a `forms.submit()` insert, a link's single
// use) on a flaky network would risk a duplicate submission or double-spend
// a single-use link — the same "retry the smallest failing unit, never a
// call with external side effects" reasoning that governs GAS retries in
// this estate applies here even harder, because there IS no smaller unit:
// the whole call either lands once or the caller (a human looking at an
// error message) decides to press Submit again.
//
// IIFE, ONE GLOBAL: window.HWLinkClient. Plain JS (no JSX, no React
// dependency) so it loads before/without React, same posture as
// shared/hw-z.js and shared/brands.js on every page that needs them early.
;(function () {
  'use strict';
  if (window.HWLinkClient) { return; }   // idempotent: two tags, one seam

  var TOKEN_HEADER = 'x-hw-link-token';

  // A body we could not parse as JSON is evidence of nothing (same ruling
  // hw-live.js's settleRead/settleWrite make for their own responses) --
  // never throws, resolves to null.
  function readJson(res) {
    return res.json().then(
      function (j) { return j; },
      function () { return null; }
    );
  }

  // The server's own `{error:{code,message}}` shape (forms_api._err,
  // signed_links_api._err) wins when present; otherwise a bare `HTTP <n>`
  // -- never fabricated wording that could be mistaken for something the
  // server actually said.
  function errorMessage(json, status) {
    if (json && json.error) {
      if (typeof json.error === 'string') { return json.error; }
      if (typeof json.error.message === 'string' && json.error.message) { return json.error.message; }
      if (typeof json.error.code === 'string' && json.error.code) { return json.error.code; }
    }
    return 'HTTP ' + status;
  }

  // THE one request path every export below funnels through. `token` is
  // read from nowhere but the caller's argument -- no fallback to a stored
  // value, because there is no stored value; that is the whole point of
  // this file existing separately from hw-live.js.
  function request(method, path, token, body) {
    var headers = {};
    headers[TOKEN_HEADER] = token || '';
    var init = {
      method: method,
      headers: headers,
      credentials: 'omit',   // never send/accept cookies -- the header IS the credential
      cache: 'no-store'
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    return fetch(path, init).then(function (res) {
      return readJson(res).then(function (json) {
        if (res.ok) { return { status: res.status, body: json }; }
        return { status: res.status, error: errorMessage(json, res.status) };
      });
    }, function (e) {
      // The browser's own message, never anything derived from the token.
      return { status: 0, error: 'request failed: ' + (e && e.message ? e.message : 'network error') };
    });
  }

  // GET /api/links/resolve -- header only, no body. -> {purpose,
  // subject_kind, subject_id, scopes} on 200; a 404 here is ALWAYS generic
  // ("not found") regardless of why the link is invalid (docs/
  // SIGNED-LINKS.md) -- this module does not attempt to unfold that, it
  // only relays whatever the server actually said.
  function resolve(token) {
    return request('GET', '/api/links/resolve', token);
  }

  // POST /api/forms/<slug>/submit -- {data}. `slug` is percent-encoded, same
  // as shared/hd-form.jsx's own `defaultSubmit`. A 201 means the link-scoped
  // path took it (forms_api._submit's own doc: "a new resource, created by
  // a caller who was never in the door before this one request"); some
  // non-link callers of the same route still see 200, so both are treated
  // as success here -- `res.ok` already covers that, this function does not
  // special-case either status.
  function submit(slug, token, data) {
    return request('POST', '/api/forms/' + encodeURIComponent(slug) + '/submit', token, { data: data });
  }

  // POST /api/links/consume -- {}. See module docstring: not on
  // hw-sign-page.jsx's own critical path today (forms_api._submit already
  // consumes link-scoped submissions itself), kept for parity with docs/
  // SIGNED-LINKS.md's route table and for any future link-gated route that
  // does not auto-consume.
  function consume(token) {
    return request('POST', '/api/links/consume', token, {});
  }

  // POST <path> -- `body` sent as given (no `{data:...}` wrapping, unlike
  // submit()). See module docstring: for a link-scoped write route whose
  // request shape is its own top-level contract, e.g.
  // `/api/writeups/<id>/sign` + `WriteupSignature`. `path` must already be
  // the exact route the caller wants hit -- this function builds nothing
  // from a slug.
  function submitTo(path, token, body) {
    return request('POST', path, token, body);
  }

  window.HWLinkClient = {
    resolve: resolve,
    submit: submit,
    consume: consume,
    submitTo: submitTo,
    // exposed for tests only -- not part of the four-function public
    // surface above, but useful without re-deriving the request() shape.
    _request: request
  };
})();
