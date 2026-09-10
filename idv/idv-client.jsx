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
  // Mirrors the backend's rule (idv_api.actor): an explicit Team role wins,
  // else a job title containing "manager" or "admin" is admin, any other
  // associate is analyst. The client mapped "Floor Manager" to analyst while
  // the backend treated it as admin, so Save buttons were greyed for a user
  // the server would have accepted (found 2026-09-09).
  // NOW ROUTED THROUGH window.HWContracts.roleFrom() (docs/BUILD-AGAINST-THE-
  // SOURCE.md #3 — "Role strings" may never be a second hand-rolled mapping)
  // when contracts/index.js is loaded, WITH THE SAME OUTCOME AS BEFORE: the
  // contract's five-value Role ladder (viewer|associate|manager|admin|
  // superadmin) collapses onto Verify's three exactly as the backend already
  // treats a title — admin and superadmin are admin, and manager is ALSO
  // admin here (the backend's "title contains manager" rule, not the
  // contract's own manager->analyst-ish default), so a Floor Manager still
  // saves workflows. Any other real role (roleFrom's "associate", or
  // anything roleFrom could not place) is analyst; no role at all is viewer.
  // The literal substring fallback below is UNCHANGED and used only when
  // HWContracts never loaded (a page that does not include contracts/).
  var DISPLAY_ROLE_TO_IDV = { Admin: 'admin', Owner: 'admin', 'Floor Manager': 'admin' };
  function role() {
    var s = session();
    var K = window.HWContracts;
    if (K && typeof K.roleFrom === 'function') {
      var r = K.roleFrom(s.role);
      if (r === 'admin' || r === 'superadmin' || r === 'manager') return 'admin';
      return s.role ? 'analyst' : 'viewer';
    }
    var t = String(s.role || '').toLowerCase();
    if (DISPLAY_ROLE_TO_IDV[s.role]) return DISPLAY_ROLE_TO_IDV[s.role];
    if (t.indexOf('manager') >= 0 || t.indexOf('admin') >= 0) return 'admin';
    return s.role ? 'analyst' : 'viewer';
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

  // ── the console PIN token ────────────────────────────────────────────────
  // ONE SHARED SECRET IN FRONT OF THE CONSOLE, exchanged once per device for a
  // 12-hour token (wmdemo/idv_api.py `require_console`). `X-HW-Actor` is a
  // header this file writes for itself — honest attribution, and no
  // authentication at all — so on a public URL it was the whole gate in front
  // of a guest's licence photo, date of birth and document number.
  //
  // WHY localStorage AND NOT sessionStorage. The counter tablet is the device
  // this is for, and sessionStorage dies with the tab: an associate who closes
  // Verify and reopens it would be asked for the PIN again, mid-shift, several
  // times a day — which is the pressure that gets a PIN written on a sticky
  // note beside the till. The token itself is bounded (12 hours, and changing
  // the PIN on the server revokes every outstanding one), and it is the same
  // trade shared/hw-live.js already makes for the write token two lines above.
  //
  // THIS KEY IS SHARED WITH Hyperwolf POS.html, deliberately: same origin,
  // same localStorage, so entering the PIN once in Verify also unblocks the
  // check-in seam's `POST /api/idv/sessions`, and vice versa. See
  // pos/checkin-verify-seam.jsx's 401 branch.
  var CONSOLE_KEY = 'hw-console-token';
  var CONSOLE_HEADER = 'X-HW-Console-Token';
  function consoleToken() {
    try { return (window.localStorage.getItem(CONSOLE_KEY) || '').trim() || null; }
    catch (e) { return null; }
  }
  function setConsoleToken(v) {
    try {
      if (v) window.localStorage.setItem(CONSOLE_KEY, String(v));
      else window.localStorage.removeItem(CONSOLE_KEY);
    } catch (e) {}
  }
  // ── auth — { status, enter, clear } ─────────────────────────────────────
  // The console's whole authentication surface, in one object, for the same
  // reason session() is one function: the estate has no login, and when it
  // gets one this is the shape that gets swapped rather than a search for
  // every place a PIN was mentioned.
  //
  // `status()` NEVER REJECTS and always answers three flags:
  //   { gated, ok, unknown }
  // `unknown` is the one that stops a bad screen: when the backend cannot be
  // reached at all, "is there a gate?" has no answer, and showing the PIN card
  // then would ask an operator to fix connectivity by typing a PIN. Unknown
  // means "carry on and let the screens show their own NotConnected".
  var auth = (function () {
    var listeners = [];
    function notify() {
      listeners.slice().forEach(function (fn) { try { fn(); } catch (e) {} });
    }
    return {
      // app.jsx subscribes so a 401 from ANY screen re-checks the gate.
      subscribe: function (fn) {
        listeners.push(fn);
        return function () {
          listeners = listeners.filter(function (f) { return f !== fn; });
        };
      },
      // Called by get()/usePoll on any 401. THE STORED TOKEN IS DROPPED: the
      // server has just said it does not accept it, so keeping it only means
      // every subsequent request carries a header that will be refused again,
      // and the PIN card would sit behind a token it cannot see is dead.
      onUnauthorized: function () {
        if (consoleToken()) setConsoleToken(null);
        notify();
      },
      token: consoleToken,
      status: function () {
        return get('/api/idv/auth/status').then(function (r) {
          if (!r.ok) {
            return { gated: true, ok: false, unknown: true, code: r.code,
              error: r.error || null };
          }
          var b = r.body || {};
          return { gated: !!b.gated, ok: !!b.ok, unknown: false, code: r.code,
            error: null };
        });
      },
      // -> { ok, code, error, expiresAt, gated }. `gated` is the OTHER 403 on
      // this route and it is not a wrong PIN: shared/hw-live.js's write-token
      // gate sits in front of every POST on a public deployment, so a device
      // with no `?hwtoken=` is refused before the PIN is ever compared. The
      // two 403s need different sentences, so the flag is relayed rather than
      // flattened into one "that failed".
      enter: function (pin) {
        return post('/api/idv/auth/pin',
          { pin: String(pin == null ? '' : pin) }).then(function (r) {
          if (r.ok && r.body && r.body.token) {
            setConsoleToken(r.body.token);
            notify();
            return { ok: true, code: r.code, error: null, gated: false,
              expiresAt: r.body.expires_at || null };
          }
          return { ok: false, code: r.code, gated: !!r.gated, expiresAt: null,
            error: r.error || 'That did not work.' };
        });
      },
      clear: function () { setConsoleToken(null); notify(); },
    };
  })();

  function actorHeaders(extra) {
    var h = Object.assign({}, extra || {});
    var s = session();
    if (s && s.id) h['X-HW-Actor'] = s.id;
    // Sent on EVERY request, including the ones that do not need it (version,
    // engine/health, auth/status). A per-route allow-list here would be a
    // second copy of the backend's exempt list, kept in a different file, and
    // the failure mode of the copy drifting is a screen that 401s for a reason
    // nobody can find. The server ignores the header where it does not apply.
    var ct = consoleToken();
    if (ct) h[CONSOLE_HEADER] = ct;
    return h;
  }
  function settle(res, j) {
    return {
      ok: res.ok, code: res.status, body: j,
      error: (j && (j.error || j.why)) || (res.ok ? null : ('HTTP ' + res.status)),
      hint: (j && j.hint) || null,
      // `needsPin` — 401 means "authenticate and retry", and it is the ONE
      // status the console reacts to structurally rather than by printing a
      // sentence. It is derived from the STATUS, never from the error text: an
      // error string is copy, and copy gets reworded. 503 is deliberately NOT
      // needsPin — a server with no PIN configured cannot be fixed by typing
      // one, so that case must show its own sentence, not the PIN card.
      needsPin: res.status === 401,
    };
  }
  // EVERY 401, FROM EVERY VERB, IN ONE PLACE. `settle` is the single funnel
  // for get/post/patch/put/del and usePoll, so hanging the re-check here is
  // what makes "re-check on a 401 from any screen" true of a one-shot write
  // as well as of a poll — a screen whose Save comes back 401 because the
  // token expired mid-form must raise the PIN card, not print an error and
  // leave the operator retyping into a dead console. It cannot recurse: the
  // two auth routes answer 200/403/429/503 and never 401.
  function settleAndWatch(res, j) {
    var r = settle(res, j);
    if (r.needsPin) auth.onUnauthorized();
    return r;
  }
  function networkError(e) {
    return { ok: false, code: 0, body: null, hint: null, needsPin: false,
      error: 'request failed: ' + (e && e.message ? e.message : 'unknown') };
  }

  // get/post — never reject, always resolve to { ok, code, body, error, hint }
  // (post also carries `gated`), so a caller can always destructure the
  // result without a try/catch. Degrades to 'no-live-seam' only when
  // window.HW_LIVE itself never armed.
  function get(path) {
    var L = live();
    if (!L || typeof L.get !== 'function') {
      return Promise.resolve({ ok: false, code: 0, body: null, error: 'no-live-seam', hint: null, needsPin: false });
    }
    var url = (L.base || '') + path;
    return fetch(url, { method: 'GET', credentials: 'omit', cache: 'no-store', headers: actorHeaders() })
      .then(function (res) {
        return res.json().then(function (j) { return settleAndWatch(res, j); }, function () { return settleAndWatch(res, null); });
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
      return Promise.resolve({ ok: false, code: 0, body: null, error: 'no-live-seam', hint: null, needsPin: false, gated: false });
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
      .catch(function (e) { var r = networkError(e); r.gated = false; return r; });  // needsPin already false
  }
  function finishPost(res, j, tokenSent) {
    var r = settleAndWatch(res, j);
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
    var stateHook = React.useState({ loading: true, error: null, data: null, needsPin: false });
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
          //
          // A 401 ALSO TELLS app.jsx TO RE-CHECK, from `settleAndWatch`
          // above — the poll is what notices a token that expired mid-shift:
          // the operator was on a screen, the 12 hours ran out, and the next
          // tick comes back 401. `needsPin` is carried on the state as well
          // so a screen can say something of its own if it wants to.
          setS(function (prev) { return { loading: false, error: r.error || ('HTTP ' + r.code), data: r.body != null ? r.body : prev.data, needsPin: !!r.needsPin }; });
          return;
        }
        var v = r.body && r.body.idv_version;
        if (v != null && v === versionRef.current) {
          setS(function (prev) { return prev.loading ? { loading: false, error: null, data: prev.data != null ? prev.data : r.body, needsPin: false } : prev; });
          return;
        }
        versionRef.current = v;
        setS({ loading: false, error: null, data: r.body, needsPin: false });
      });
    }, [path]);

    React.useEffect(function () {
      aliveRef.current = true;
      versionRef.current = null;
      setS({ loading: true, error: null, data: null, needsPin: false });
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

    return { loading: s.loading, error: s.error, data: s.data, needsPin: s.needsPin, refresh: fetchOnce };
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

  // contract — see incentives/inc-client.jsx `contract`: the same records in
  // @hyper-tech/contracts shape via /api/contracts/verify/*, one adapter server-side.
  var contract = {
    get: function (path) { return get('/api/contracts/verify/' + String(path || '').replace(/^\/+/, '')); },
    validate: function (schema, obj) {
      var K = window.HWContracts;
      return K ? K.validate(schema, obj) : { ok: false, errors: ['contracts/index.js not loaded'] };
    },
    session: function () {
      var s = session(), K = window.HWContracts;
      return { id: s.id, kind: 'staff', display_name: s.name, store_id: s.storeId,
        role: K ? K.roleFrom(s.role) : null, classification: null,
        external_ids: [{ source: 'hwpos', id: s.id }] };
    },
    version: function () { return window.HWContracts ? window.HWContracts.VERSION : null; },
  };
  window.HWIdv = { session: session, get: get, post: post, patch: patch, put: put, del: del, usePoll: usePoll, fmt: fmt, role: role, can: can, contract: contract, auth: auth, actorHeaders: actorHeaders };
})();
