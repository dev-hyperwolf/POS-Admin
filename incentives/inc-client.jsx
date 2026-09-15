// ── incentives/inc-client.jsx ── window.HWInc — the one seam Bounty screens use ─
// Every Bounty screen reaches the network and identity through this file, never
// through window.HW_LIVE directly and never through a second fetch helper of its
// own. hw-live.js is loaded on Hyperwolf Bounty.html in LITE mode (see
// shared/hw-live.README.md's "Lite mode" section) — base resolution, the write
// token and get()/post() are armed; the /api/state catalog fetch and the
// window.HW accessor pos/data.jsx normally drives are not, because this app has
// neither. get()/post() below degrade the same way when hw-live.js is entirely
// absent (never reject, always resolve to {ok:false, ...}), so a screen can
// always destructure the result without a try/catch.
//
// session() IS THE PRODUCTION SEAM (plan §6). The estate has no login —
// pos/app.jsx hard-codes USER — so this module isolates that one fact behind one
// function instead of forty call sites. Swapping in real auth later is a
// one-function change here, not a grep-and-replace across every Bounty screen.
;(function () {
  function live() { return window.HW_LIVE || null; }

  // ── demo sign-in override ("Testing as", incentives/app.jsx's Topbar) ──────
  // DEMO ONLY — removed at cutover, same as the fallback branch below it. A
  // real POS associate (window.HW.STATS.associate) always wins over this, so
  // the override can never shadow production identity once pos/data.jsx is
  // actually on the page; today it never is (see the fallback's own note),
  // which is exactly why the picker is useful here. One key, one shape
  // ({id, name, role, storeId}), read/written ONLY through these two
  // functions so session() stays the one seam every screen already trusts.
  var TEST_AS_KEY = 'hw-bounty-test-as';
  function readTestAs() {
    try {
      var raw = window.localStorage.getItem(TEST_AS_KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      if (!v || !v.id) return null;
      return { id: v.id, name: v.name || v.id, role: v.role || 'Budtender', storeId: v.storeId || null };
    } catch (e) { return null; }
  }
  function writeTestAs(person) {
    try {
      if (!person || !person.id) { window.localStorage.removeItem(TEST_AS_KEY); return; }
      window.localStorage.setItem(TEST_AS_KEY, JSON.stringify({
        id: person.id, name: person.name || person.id, role: person.role || 'Budtender',
        storeId: person.storeId || null,
      }));
    } catch (e) { /* not remembering the pick is survivable; the app must still render */ }
  }

  function session() {
    var assoc = window.HW && window.HW.STATS && window.HW.STATS.associate;
    if (assoc && assoc.id) {
      return {
        id: assoc.id, name: assoc.name, role: assoc.role,
        storeId: assoc.storeId || assoc.store_id || null,
      };
    }
    // Testing-as override — only reached when no real POS associate is
    // present, exactly like production's real login will take priority once
    // it exists. See incentives/app.jsx's Topbar "Testing as" control.
    var testAs = readTestAs();
    if (testAs) return testAs;
    // Fallback mirrors pos/app.jsx's USER exactly (name, role, id, storeId) —
    // the same demo person this estate already keeps in sync in three places
    // (pos/app.jsx's USER, pos/data.jsx's window.HW.STATS.associate,
    // wmdemo/associates.py's 'manisha-saini' row). Hyperwolf Bounty.html loads
    // none of pos/data.jsx, so this is the branch that actually runs today.
    return { id: 'manisha-saini', name: 'Manisha Saini', role: 'Floor Manager', storeId: 'elsinore' };
  }

  // role() — session().role stays the display string ('Floor Manager', 'Admin', …) for
  // anything that shows it on screen; role() is that same string put through the
  // contract's one role vocabulary (window.HWContracts.roleFrom) for anything that GATES
  // on it. A screen comparing `role === 'Floor Manager'` is comparing against a display
  // spelling that can drift from the backend's own MANAGER_ROLES; roleFrom + roleAtLeast
  // is the one mapping both sides read. Degrades to the raw display role (and warns once)
  // if contracts/index.js has not loaded — the caller is then responsible for falling
  // back to the old literal comparison, exactly as it did before this existed.
  var roleWarned = false;
  function role() {
    var K = window.HWContracts;
    if (!K) {
      if (!roleWarned) { console.warn('HWInc.role(): window.HWContracts not loaded — returning the raw display role'); roleWarned = true; }
      return session().role;
    }
    return K.roleFrom(session().role);
  }

  // get/post — never reject, mirror HW_LIVE's own {ok, code, body, error} shape
  // exactly so a caller never needs a second error-handling convention for the
  // "the seam itself is missing" case versus "the seam answered with an error".
  function get(path) {
    var L = live();
    if (!L || typeof L.get !== 'function') {
      return Promise.resolve({ ok: false, code: 0, body: null, error: 'no-live-seam', hint: null });
    }
    return L.get(path);
  }
  function post(path, body) {
    var L = live();
    if (!L || typeof L.post !== 'function') {
      return Promise.resolve({ ok: false, code: 0, body: null, error: 'no-live-seam', hint: null, gated: false });
    }
    return L.post(path, body);
  }

  // usePoll — re-fetches `path` on an interval and short-circuits the
  // re-render when the response's ledger_version has not moved. The standings
  // cache (plan §2, contests.py) makes an unchanged ledger_version a single
  // indexed read server-side, so polling stays cheap; this is the client half
  // of that contract — it must not force React to re-render a screen with data
  // it has already shown, or the cache buys nothing.
  function usePoll(path, opts) {
    opts = opts || {};
    var intervalMs = opts.intervalMs || 15000;
    var enabled = opts.enabled !== false;
    var React = window.React;
    var stateHook = React.useState({ loading: true, error: null, data: null });
    var s = stateHook[0], setS = stateHook[1];
    var ledgerRef = React.useRef(null);
    var timerRef = React.useRef(null);
    var aliveRef = React.useRef(true);

    var fetchOnce = React.useCallback(function () {
      return get(path).then(function (r) {
        if (!aliveRef.current) return;
        if (!r.ok) {
          setS(function (prev) { return { loading: false, error: r.error || ('HTTP ' + r.code), data: prev.data }; });
          return;
        }
        var v = r.body && r.body.ledger_version;
        if (v != null && v === ledgerRef.current) {
          // Same ledger_version as last time -- nothing changed server-side.
          // Only escape the loading state (first paint); do not otherwise
          // touch `data`, which is the whole point of the short-circuit.
          setS(function (prev) { return prev.loading ? { loading: false, error: null, data: prev.data != null ? prev.data : r.body } : prev; });
          return;
        }
        ledgerRef.current = v;
        setS({ loading: false, error: null, data: r.body });
      });
    }, [path]);

    React.useEffect(function () {
      aliveRef.current = true;
      if (!enabled) return undefined;
      ledgerRef.current = null;
      setS({ loading: true, error: null, data: null });
      fetchOnce();
      timerRef.current = setInterval(fetchOnce, intervalMs);
      return function () { aliveRef.current = false; clearInterval(timerRef.current); };
      // eslint-disable-next-line
    }, [path, enabled, intervalMs, fetchOnce]);

    return { loading: s.loading, error: s.error, data: s.data, refresh: fetchOnce };
  }

  // fmt — never a second money formatter. window.HD (shared/hd-format.jsx,
  // loaded on Hyperwolf Bounty.html the same way Engage loads it) already owns
  // cents -> dollars; these are named re-exports so a screen calls
  // `HWInc.fmt.cents(n)` without having to remember which HD.format* it wants,
  // and so a page that somehow loses hd-format.jsx degrades to a plain
  // formatter instead of throwing.
  var fmt = {
    cents: function (c, opts) { return window.HD ? window.HD.formatCents(c, opts) : '$' + ((c || 0) / 100).toFixed(2); },
    number: function (n) { return window.HD ? window.HD.formatNumber(n) : String(n); },
    percent: function (n, digits) { return window.HD ? window.HD.formatPercent(n, digits) : ((n || 0) * 100).toFixed(digits || 1) + '%'; },
    date: function (iso) { return window.HD ? window.HD.formatDate(iso) : iso; },
    relative: function (iso) { return window.HD ? window.HD.relativeTime(iso) : iso; },
  };

  // contract — the production shapes of the same records, served by wmdemo/contracts_api.py
  // through one adapter (docs/BUILD-AGAINST-THE-SOURCE.md). `contract.get('standings?…')`
  // hits /api/contracts/bounty/standings and resolves to the same {ok, code, body, error}
  // envelope as get(); `contract.session()` is session() expressed as a contract Person, with
  // the display role mapped by window.HWContracts.roleFrom — the one role vocabulary.
  var contract = {
    get: function (path) { return get('/api/contracts/bounty/' + String(path || '').replace(/^\/+/, '')); },
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

  // testAs()/setTestAs()/clearTestAs() — the Topbar picker's whole interface
  // onto the override above. Never touch TEST_AS_KEY or localStorage from
  // incentives/app.jsx directly; these three functions are the seam, same
  // reasoning as session() itself.
  function testAs() { return readTestAs(); }
  function setTestAs(person) { writeTestAs(person); }
  function clearTestAs() { writeTestAs(null); }

  window.HWInc = { session: session, role: role, get: get, post: post, usePoll: usePoll, fmt: fmt, contract: contract,
    testAs: testAs, setTestAs: setTestAs, clearTestAs: clearTestAs };
})();
