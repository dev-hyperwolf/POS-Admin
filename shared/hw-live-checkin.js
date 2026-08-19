// ── shared/hw-live-checkin.js ── the counter: who is in the room, whose bag ──
// Plain JS. Loads BEFORE React on the POS entry HTML only, after hw-live.js and
// hw-live-taxonomy.js. Third sibling, built to the same four rules: armed
// everywhere but decided by whether the same origin answers, IN-PLACE mutation
// of window.HW (never a reassignment), silent fallback to the mock when nothing
// answers, and the panel says out loud what is still mock.
//
// WHAT IT REPLACES, AND WHY THAT IS THE WHOLE POINT
// -------------------------------------------------
// pos/data.jsx:68 ships CHECKINS as four invented people — Harshil Gupta,
// Manisha Saini, Girish Sharma, Joseph Levi — with invented wait clocks and an
// invented "claimed by". The check-in strip (pos/screen-orders.jsx:104) and the
// register's waiting strip (pos/screen-register.jsx:647) render them, and both
// screens read `window.HW.CHECKINS` inside render, so replacing the CONTENTS of
// that array is enough. No screen is edited.
//
// wmdemo/checkin.py + wmdemo/checkin_api.py are the real thing behind it:
//   GET  /api/checkin/board?location_id=   waiting orders + the people in the room
//   GET  /api/checkin/contract             the matcher's signal vocabulary & weights
//   POST /api/checkin                      create a check-in
//   POST /api/checkin/match                one arrival -> ranked ORDERS, losers kept
//   POST /api/checkin/candidates           one order  -> ranked PEOPLE, losers kept
//   POST /api/checkin/bind /reject /handoff /state
//
// THE FALSEHOODS THIS FILE EXISTS TO NOT COMMIT
// ---------------------------------------------
//  1. A GREEN RAIL OVER AN UNBOUND ORDER. checkin_api's `unclaimed` means
//     "somebody in the room scores >= 60 and NOBODY HAS BOUND IT". That is not
//     ownership. It maps to the design's amber `confirm` strip — the one with
//     "Yes, that's them" on it — never to the green `auto` strip, which this
//     file emits only when the API returns an actual active_bind row.
//  2. A BIND STRIP NAMING NOBODY. BindStrip (screen-orders.jsx:206) resolves
//     bind.checkinId through window.HW.checkinById. Replacing CHECKINS orphans
//     the four mock ids in ORDER_BIND, and an orphan renders a green strip with
//     a BLANK name and a confidence of 96 next to it. checkinById is therefore
//     replaced with a resolver that answers from the live room first and from a
//     snapshot of the mock rows second, so no strip can ever name nobody.
//  3. A FABRICATED 5. MatchSheet (screen-orders.jsx:340) scores anybody missing
//     from bind.candidates as `5` and draws a bar meter for it. So the candidate
//     list handed to the screen is the API's FULL list — every person in the
//     room, losers at conf 0 included — and never a top-N slice.
//  4. "1st visit" FOR SOMEBODY WE HAVE NEVER SEEN. VisitPill calls
//     HW.visitLabel(c.visit), and pos/data.jsx:73 answers "1st visit" for
//     undefined. A live check-in row carries no visit count at all, so
//     visitLabel is wrapped to say `visits unknown` for null and to leave every
//     real number exactly as it was.
//  5. "Type: Adult Use", "Method: Pick-up". The checkins table has no customer
//     type and no fulfilment method. Those two cells read `not captured` rather
//     than borrowing the mock's answer.
//
// WHAT IT DELIBERATELY DOES NOT DO
// --------------------------------
//  * It does not score anything. Every number on screen and in this panel came
//    out of checkin.py. There is no second matcher here, not even a tie-break.
//  * It does not default `decided_by`. checkin.bind() refuses an unattended bind
//    on any verdict but 'auto', and that refusal is the guard that stops
//    software handing a stranger a bag. The panel asks for a name and sends
//    nothing when the prompt is cancelled.
//  * It does not invent a reason. Refusals come back 200 with ok:false and a
//    `why` sentence; the sentence is what gets rendered, verbatim.
//
// SEEDED DATA, 2026-08-19 — the checkins table was EMPTY, so four arrivals were
// created THROUGH POST /api/checkin (never by SQL) at location `corona-counter`,
// chosen so that all four verdict states the matcher can return are reachable:
//   ci-1787169596-02587d  Pickup Tester   +13105551234  1990-04-12  -> CHOOSE
//        (its phone matches TWO waiting orders, so the ambiguity penalty fires
//         and drops 96 to 71 on both — the case a human must resolve)
//   ci-1787169596-7e3a90  Cross Region    +13105557777  1990-04-12  -> AUTO 96
//   ci-1787169596-d416c8  D2 T            no phone, no dob          -> CONFIRM 64
//   ci-1787169596-62e42c  Dana Whitfield  +13105559042  1993-07-21  -> NONE (0)
// One bind was made, to prove the green strip appears only for a real bind row:
//   checkin_binds 752 — ci-…7e3a90 -> order 48553068, state 'confirm', conf 96.
//   Rows 750 (manual/gov_id/100) and 751 (rejected) are its superseded history:
//   750 was written by an earlier revision of THIS FILE that sent manual=true
//   from an unlabelled Bind button, which records "human verification of the
//   document" for somebody who was never asked. 751 retracts it. That is why
//   bind() and bindManual() are two separate buttons below.
// TEARDOWN (order matters — 'left' is refused while a check-in holds a bag):
//   curl -s -XPOST localhost:8787/api/checkin/handoff -H 'Content-Type: application/json' \
//        -d '{"wm_order_id":"48553068","decided_by":"teardown"}'
//   for id in ci-1787169596-02587d ci-1787169596-7e3a90 ci-1787169596-d416c8 \
//             ci-1787169596-62e42c; do
//     curl -s -XPOST localhost:8787/api/checkin/state -H 'Content-Type: application/json' \
//          -d "{\"checkin_id\":\"$id\",\"state\":\"left\"}"; done
//   'left' takes them out of the room; the rows and the append-only bind ledger
//   stay, which is what an append-only ledger is for. A hard wipe is
//   DELETE FROM checkin_binds WHERE checkin_id LIKE 'ci-1787169596-%';
//   DELETE FROM checkins WHERE id LIKE 'ci-1787169596-%';  -- not run by this seam.
//
// PUBLIC SURFACE: window.HW_CHECKIN = { status, board, people, orders, contract,
//   match(), candidates(), bind(), bindManual(), reject(), handoff(), claim(),
//   leave(),
//   create(), refresh(), open(), disable(), enable() }.
// Turn it off: append `?hwcheckin=off`, or run `HW_CHECKIN.disable()`.
// Point it at one counter: `?hwcounter=corona-counter`.
(function () {
  'use strict';
  var W = window;
  if (W.HW_CHECKIN && W.HW_CHECKIN.__armed) { return; }   // idempotent

  var TIMEOUT_MS = 6000;
  var OFF_KEY = 'hw-checkin-off';
  var RAIL_W = 74;               // shared/app-rail.jsx:46 — clear the rail
  var BOTTOM = 162   // STACKED, NOT STACKED ON.
  // Every seam picked its own "clear the siblings" offset without knowing the
  // others existed, so three pills landed on the same 90px line at the same
  // z-index. The last one in the DOM won elementFromPoint() everywhere and the
  // panels behind it were openable only from the console -- a feature nobody
  // can click is a feature nobody has. Taxonomy 90, identity 126, check-in 162.;               // above hw-live.js (14) and hw-live-taxonomy (52)
  var CAND_CAP = 30;             // orders we pull a full candidate list for

  // ── gate ─────────────────────────────────────────────────────────────────
  var LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i;

  // ff(P.fontMono) contains DOUBLE QUOTES. Interpolated raw into style="..."
  // the first one terminates the attribute and every declaration after it is
  // silently dropped — which is how a warning line once computed black-on-black
  // in dark mode. hw-live-taxonomy.js:62 paid for this; single quotes survive.
  function ff(v) { return String(v).replace(/"/g, "'"); }

  function qs(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(W.location.search);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function isLoopbackOrigin(o) {
    try {
      var u = new URL(o);
      return (u.protocol === 'http:' || u.protocol === 'https:') && LOOPBACK.test(u.hostname);
    } catch (e) { return false; }
  }

  var override = qs('hwcheckin');
  var disabled = override === 'off' || override === '0';
  try { if (W.localStorage.getItem(OFF_KEY) === '1') { disabled = true; } } catch (e) {}

  var base = W.location.origin;
  // An explicit base is honoured ONLY when it is itself loopback. A crafted
  // ?hwcheckin=<host> link would otherwise point a viewer's counter screen at
  // an arbitrary server and render that server's customers as the people
  // standing in this room.
  if (override && override !== 'off' && override !== '0') {
    base = isLoopbackOrigin(override) ? override.replace(/\/+$/, '') : base;
  }
  // Armed on any origin; the same-origin fetch is what decides. On GitHub Pages
  // /api/checkin/board 404s, the fetch fails, and the strip stays on the mock
  // rows exactly as it does today.
  var armed = !disabled;
  var counter = qs('hwcounter');           // optional single-counter filter

  // ── state ────────────────────────────────────────────────────────────────
  var _status = armed ? 'pending' : 'off';   // off|pending|slow|live|unreachable
  var _board = null;          // /api/checkin/board, verbatim
  var _contract = null;       // /api/checkin/contract, verbatim
  var _cands = {};            // wm_order_id -> /api/checkin/candidates, verbatim
  var _match = {};            // checkin_id  -> /api/checkin/match, verbatim
  var _candFail = {};         // wm_order_id -> why the candidate pull did not happen
  var _hw = null, _mockCheckins = null, _origCheckinById = null;
  var _origBindFor = null, _origVisitLabel = null;
  var _open = false, _busy = false, _msg = null, _msgOk = false;
  var _el = null, _scroll = 0, _tab = 'room';
  var _root = null, _rootEl = null;
  var _liveBinds = {};        // wm_order_id -> the design's bind shape, live only
  var _newRow = { first_name: '', last_name: '', phone: '', dob: '' };

  // ── helpers ──────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }

  // The design's own wait format ('0h 2m 11s'). screen-orders.jsx and
  // screen-register.jsx both strip a leading '0h ' off it, so producing the
  // same shape is what keeps those two lines reading like the rest of the UI.
  function waitLabel(sec) {
    var s = Math.max(0, Math.round(num(sec) || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return h + 'h ' + m + 'm ' + (r < 10 ? '0' : '') + r + 's';
  }

  function shortWait(sec) {
    var s = Math.max(0, Math.round(num(sec) || 0));
    if (s < 60) { return s + 's'; }
    if (s < 3600) { return Math.floor(s / 60) + 'm'; }
    return (s / 3600).toFixed(1) + 'h';
  }

  function people() { return (_board && _board.people) || []; }
  function orders() { return (_board && _board.orders) || []; }

  // pos/tokens.jsx is the ONLY place colours are defined (CLAUDE.md rule 2).
  // No THEMES on the page means no panel at all, rather than a hex literal here.
  function palette() {
    if (!W.THEMES) { return null; }
    var mode = document.body.style.colorScheme;
    if (mode !== 'light' && mode !== 'dark') {
      try { mode = W.localStorage.getItem('hw-pos-theme'); } catch (e) { mode = null; }
    }
    return W.THEMES[mode === 'dark' ? 'dark' : 'light'] || W.THEMES.light;
  }

  // The four owner states, drawn so no two read alike. `awaiting_arrival` is
  // checkin.py's NORMAL case ("placed 34 min ago, customer has not arrived") and
  // is deliberately the quiet one — a counter screen that flags the normal case
  // as a problem trains the associate to ignore the row that IS a problem.
  function ownerTone(P, st) {
    if (st === 'bound') { return { fg: P.good, bg: P.goodSoft, word: 'BOUND' }; }
    if (st === 'unclaimed') { return { fg: P.warn, bg: P.warnSoft, word: 'SOMEBODY IS HERE · UNBOUND' }; }
    if (st === 'no_show') { return { fg: P.bad, bg: P.badSoft, word: 'NO-SHOW' }; }
    return { fg: P.neutral, bg: P.neutralSoft, word: 'AWAITING ARRIVAL · NORMAL' };
  }

  // The verdict states match() can return. 'none' is a legitimate answer and is
  // not drawn as an error.
  function verdictTone(P, st) {
    if (st === 'auto') { return { fg: P.good, bg: P.goodSoft, word: 'AUTO' }; }
    if (st === 'confirm') { return { fg: P.warn, bg: P.warnSoft, word: 'CONFIRM' }; }
    if (st === 'choose') { return { fg: P.warn, bg: P.warnSoft, word: 'CHOOSE' }; }
    return { fg: P.neutral, bg: P.neutralSoft, word: 'NO MATCH' };
  }

  // A signal chip carries the SERVED label and the SERVED weight. Nothing here
  // knows what `wm_acct` is worth; /api/checkin/contract does.
  function signalLabel(s) {
    var L = (_contract && _contract.signal_labels) || {};
    return L[s] || s;
  }
  function signalWeight(s) {
    var Wt = (_contract && _contract.signals) || {};
    return Wt[s] == null ? null : Wt[s];
  }

  // ── fetch ────────────────────────────────────────────────────────────────
  // DELIBERATELY DOES NOT ABORT. Both siblings paid for this: aborting on a
  // timeout makes a slow-but-fine response indistinguishable from a dead
  // server, and on a cold load Babel is compiling thirty JSX files on this same
  // thread. The timer changes the LABEL only; the request runs to completion.
  var _settled = false;

  function getJSON(path) {
    return fetch(base + path, { credentials: 'omit', cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) { throw new Error('HTTP ' + res.status); }
        return res.json();
      });
  }

  function postJSON(path, body) {
    return fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit', cache: 'no-store',
      body: JSON.stringify(body || {})
    }).then(function (res) {
      return res.json().then(function (j) { return { code: res.status, body: j }; },
                             function () { return { code: res.status, body: null }; });
    });
  }

  function load() {
    if (!armed) { return Promise.resolve('off'); }
    _settled = false;
    var timer = setTimeout(function () {
      if (!_settled) { _status = 'slow'; paint(); }
    }, TIMEOUT_MS);

    var boardPath = '/api/checkin/board' +
      (counter ? '?location_id=' + encodeURIComponent(counter) : '');

    return Promise.all([
      getJSON(boardPath),
      // The contract is fetched EVERY time the board is. It is the source of
      // the weights and labels this panel prints, and a cached contract next to
      // a fresh board is the two-copies problem again, one refresh later.
      getJSON('/api/checkin/contract').catch(function () { return null; })
    ]).then(function (r) {
      clearTimeout(timer);
      _settled = true;
      var b = r[0];
      // A payload with no `orders` array is not this API answering. Refusing it
      // beats rendering an empty room and calling it live.
      if (!b || !Array.isArray(b.orders) || !Array.isArray(b.people)) {
        _status = 'unreachable';
        restoreMock();
        rerenderIfMounted();
        paint();
        return _status;
      }
      _board = b;
      _contract = r[1] && r[1].ok ? r[1] : null;
      _status = 'live';
      return loadCandidates().then(function () {
        publishToHW();
        paint();
        rerenderIfMounted();
        return _status;
      });
    }).catch(function () {
      clearTimeout(timer);
      _settled = true;
      _status = 'unreachable';
      restoreMock();
      rerenderIfMounted();
      paint();
      return _status;
    });
  }

  // One /api/checkin/candidates call per order that is not already bound.
  //
  // WHY THE FULL LIST AND NOT THE BOARD'S `best_checkin_id`: the board keeps
  // only the single best person per order (checkin.py:963). MatchLane and
  // MatchSheet want the ranked list, and MatchSheet scores anybody MISSING from
  // that list as a hardcoded 5 — so a truncated list would put a fabricated
  // number under a bar meter. The endpoint returns every active check-in,
  // including the ones that scored 0, which is exactly what has to be shown.
  //
  // WHY A CAP: this is one POST per waiting order and the counter screen is not
  // a batch job. Past the cap the order keeps its board verdict and carries a
  // sentence saying the candidate list was not pulled — never an empty list,
  // which the screen would render as "nobody in the room is plausible".
  function loadCandidates() {
    _cands = {}; _candFail = {};
    var todo = orders().filter(function (o) { return o.owner_state !== 'bound'; });
    if (todo.length > CAND_CAP) {
      todo.slice(CAND_CAP).forEach(function (o) {
        _candFail[String(o.wm_order_id)] =
          'candidate list not pulled — ' + todo.length + ' orders are waiting and this ' +
          'seam pulls the first ' + CAND_CAP + '. Open the check-in panel for this one.';
      });
      todo = todo.slice(0, CAND_CAP);
    }
    return Promise.all(todo.map(function (o) {
      var id = String(o.wm_order_id);
      return postJSON('/api/checkin/candidates', { wm_order_id: id })
        .then(function (r) {
          if (r.body && r.body.ok) { _cands[id] = r.body; }
          else {
            _candFail[id] = (r.body && r.body.why) ||
              ('candidate list failed with HTTP ' + r.code + ' and no reason in the body');
          }
        })
        .catch(function (e) {
          _candFail[id] = 'candidate list request failed (' +
            (e && e.message ? e.message : 'unknown') + ')';
        });
    })).then(function () { return true; });
  }

  // ── actions ──────────────────────────────────────────────────────────────
  // Every one of these renders the server's OWN sentence on refusal. This API
  // refuses a bind with no `decided_by` on a non-auto verdict, refuses a state
  // change on a check-in that still holds a bag, refuses a check-in with no
  // identifying field, and refuses a raw document number. Each refusal is the
  // contract explaining itself and is worth more on screen than "failed".
  function act(path, body, describe) {
    if (!armed) { return Promise.resolve({ ok: false, why: 'seam is off' }); }
    _busy = true; _msg = null; paint();
    return postJSON(path, body).then(function (r) {
      _busy = false;
      var j = r.body || {};
      // match() carries NO `ok` key on purpose: "the request was served" and "a
      // match was found" are different claims. Treating a missing ok as failure
      // would report every honest 'none' verdict as a broken request.
      var refused = (j.ok === false);
      if (refused || r.code >= 400) {
        _msgOk = false;
        _msg = j.why || ('HTTP ' + r.code + ' with no reason in the body');
        paint();
        return { ok: false, why: _msg, body: j };
      }
      _msgOk = true;
      _msg = describe ? describe(j) : (j.why || 'done');
      return { ok: true, body: j };
    }).catch(function (e) {
      _busy = false; _msgOk = false;
      _msg = 'Request failed: ' + (e && e.message ? e.message : 'unknown');
      paint();
      return { ok: false, why: _msg };
    });
  }

  function matchCheckin(cid, code) {
    if (!armed) { return Promise.resolve(null); }
    _busy = true; _msg = null; paint();
    return postJSON('/api/checkin/match', { checkin_id: cid, code: code || null })
      .then(function (r) {
        _busy = false;
        var j = r.body || {};
        if (j.state == null) {
          _msgOk = false;
          _msg = j.why || ('match returned no verdict (HTTP ' + r.code + ')');
        } else {
          _match[cid] = j;
          _msgOk = true;
          _msg = j.state.toUpperCase() + ' — ' + (j.why || '');
        }
        paint();
        return j;
      }).catch(function (e) {
        _busy = false; _msgOk = false;
        _msg = 'match failed: ' + (e && e.message ? e.message : 'unknown');
        paint();
        return null;
      });
  }

  // `decided_by` is ASKED FOR, never defaulted. checkin_api.py's docstring is
  // explicit: an adapter that helpfully defaults it defeats the guard silently —
  // the guard still exists, still passes its own test, and never fires again.
  //
  // AND `manual` IS ITS OWN BUTTON, because manual=True is not "a stronger
  // bind". checkin.bind() records it as conf 100, signals ['gov_id'], note
  // "human verification of the document" (checkin.py:~740) and it is the path
  // that stamps a document hash onto the identity ledger. A single Bind button
  // that quietly sent manual=true would write "the associate looked at the
  // licence" into a permanent record on behalf of somebody who was never asked.
  // That was in this file for one revision and the write is what caught it;
  // bind row 750 in this database is the evidence and is described in the
  // handover note.
  //
  //   bind()      -> state 'confirm', the computed conf, the real signals
  //   bindManual() -> state 'manual', conf 100, gov_id, and the prompt says so
  function bind(cid, oid) {
    var who = W.prompt('Who is binding this bag?\n\n' +
      'Recorded as a HUMAN-CONFIRMED bind at the confidence the matcher computed. ' +
      'checkin.bind() refuses an unattended bind on anything but an AUTO verdict, ' +
      'and this name is what makes it attended. It is written to the ledger.');
    if (who == null || !String(who).trim()) { return Promise.resolve({ ok: false, why: 'cancelled at the prompt — nothing was sent' }); }
    return act('/api/checkin/bind',
      { checkin_id: cid, wm_order_id: oid, decided_by: String(who).trim(), manual: false },
      function (j) { return j.why || ('bound ' + oid); }).then(after);
  }

  function bindManual(cid, oid) {
    var who = W.prompt('You are recording that YOU LOOKED AT THIS PERSON\'S ID.\n\n' +
      'This writes confidence 100 with the gov_id signal and the note "human ' +
      'verification of the document", and — if a document hash was scanned at ' +
      'check-in — stamps that hash onto the identity so every future order from ' +
      'them matches at 100 without being asked again.\n\n' +
      'Only do this if you actually checked the licence. Your name:');
    if (who == null || !String(who).trim()) { return Promise.resolve({ ok: false, why: 'cancelled at the prompt — nothing was sent' }); }
    return act('/api/checkin/bind',
      { checkin_id: cid, wm_order_id: oid, decided_by: String(who).trim(), manual: true },
      function (j) { return j.why || ('bound ' + oid); }).then(after);
  }

  function reject(cid, oid) {
    var who = W.prompt('Who is rejecting this pairing?\n\n' +
      'A rejection is an append-only labelled negative example — this pair is ' +
      'excluded from every later match for this person.');
    if (who == null || !String(who).trim()) { return Promise.resolve({ ok: false, why: 'cancelled at the prompt — nothing was sent' }); }
    return act('/api/checkin/reject',
      { checkin_id: cid, wm_order_id: oid, decided_by: String(who).trim() },
      function (j) { return j.why || ('rejected ' + oid); }).then(after);
  }

  function handoff(oid) {
    var who = W.prompt('Who handed the bag over?\n\n' +
      'This closes the check-in to `served`. It does NOT tell Weedmaps anything — ' +
      'engine.py owns every WM write and neither checkin.py nor this seam makes one.');
    if (who == null || !String(who).trim()) { return Promise.resolve({ ok: false, why: 'cancelled at the prompt — nothing was sent' }); }
    return act('/api/checkin/handoff',
      { wm_order_id: oid, decided_by: String(who).trim() },
      function (j) { return j.why || ('handed off ' + oid); }).then(after);
  }

  function claim(cid) {
    var who = W.prompt('Which associate is taking this person?');
    if (who == null || !String(who).trim()) { return Promise.resolve({ ok: false, why: 'cancelled at the prompt — nothing was sent' }); }
    return act('/api/checkin/state', { checkin_id: cid, claimed_by: String(who).trim() },
      function (j) { return j.why || 'claimed'; }).then(after);
  }

  function leave(cid) {
    return act('/api/checkin/state', { checkin_id: cid, state: 'left' },
      function (j) { return j.why || 'left'; }).then(after);
  }

  function create(row) {
    var b = row || _newRow;
    return act('/api/checkin', {
      first_name: b.first_name, last_name: b.last_name,
      phone: b.phone, dob: b.dob,
      location_id: counter || b.location_id || null
    }, function (j) {
      return (j.checkin && j.checkin.id ? j.checkin.id + ' — ' : '') + (j.why || 'checked in');
    }).then(function (r) {
      if (r.ok) { _newRow = { first_name: '', last_name: '', phone: '', dob: '' }; }
      return after(r);
    });
  }

  function after(r) {
    // Re-read the board after every write. The screen must never be showing the
    // state the last click ASKED for; it shows the state the server reports.
    return load().then(function () { return r; });
  }

  // ── the handles on window.HW ─────────────────────────────────────────────
  // PROPERTY WRITES on the object pos/data.jsx published, never
  // `window.HW = ...`. hw-live.js documents why: five modules capture
  // window.HW.fmt.money at module scope and a reassignment leaves all five
  // formatting against a dead object with nothing throwing.

  // A live check-in, in the shape the two strips already render.
  //
  // Every cell here is either a served fact or the words `not captured`. The
  // checkins table (store.py:199) has no customer type, no fulfilment method,
  // no visit count, no membership flag and no party — so this row asserts none
  // of them. `member:false` means no crown is drawn, not that we checked.
  function toRow(p) {
    var holds = p.holds_wm_order_ids || [];
    return {
      id: p.id,
      memberId: null,
      name: p.name || ('check-in ' + p.id),
      type: 'not captured',        // CheckInCard "Type" · WaitRow prefix
      delivery: 'not captured',    // CheckInCard "Method"
      wait: waitLabel(p.waited_s),
      waitSec: Math.max(0, Math.round(num(p.waited_s) || 0)),
      claimedBy: p.claimed_by || null,
      member: false,               // no crown: we were not told, so we claim nothing
      visit: null,                 // -> visitLabel(null) -> 'visits unknown'
      second: false,
      guests: [],                  // a check-in has no party in this schema
      // live-only fields; harmless to the design, read by this panel
      live: true,
      phone: p.phone || null,
      dob: p.dob || null,
      govIdShort: p.gov_id_hash_short || null,
      identityId: p.identity_id == null ? null : p.identity_id,
      locationId: p.location_id || null,
      state: p.state || null,
      holds: holds,
      unclaimed: !!p.unclaimed
    };
  }

  // The design's bind shape, built ONLY from what the board and the candidates
  // endpoint returned.
  //
  //   bound            -> 'auto'    green. There is an actual bind row.
  //   unclaimed        -> 'confirm' amber. Somebody scores >= CONFIRM and NOBODY
  //                       HAS BOUND IT. Green here would be the exact shape of
  //                       the rail that claimed a customer had been notified.
  //   awaiting_arrival -> 'none'    the API's own sentence rides on it.
  //   no_show          -> 'none'    ditto, with the cancel reason in it.
  //
  // The design has only four strips and none of them is neutral, so
  // `awaiting_arrival` — checkin.py's NORMAL case — lands in the red lane. That
  // is a wording mismatch this seam cannot fix without editing the screen, and
  // it is named on the panel rather than left to be discovered.
  function toBind(o) {
    var id = String(o.wm_order_id);
    var st = o.owner_state;
    var ab = o.active_bind || null;
    var cand = _cands[id] || null;
    var list = (cand && cand.candidates) || [];

    // Everyone the API scored, losers included. MatchSheet defaults anybody
    // missing here to a fabricated 5, so this list is never truncated.
    var candidates = list.map(function (c) {
      return {
        checkinId: c.checkin_id,
        conf: c.conf,
        signals: c.signals || [],
        why: c.why || '',
        plausible: !!c.plausible
      };
    });

    // `why` is carried ONLY on a 'none' bind, and that is not tidiness.
    // MatchSheet prints the fixed words "auto-match failed" whenever bind.why is
    // truthy (screen-orders.jsx:364). On a 96-confidence order that simply has
    // nobody's name on it yet, auto-match did not fail — it was never asked to
    // decide, because nothing is bound until a human binds it. The board's
    // sentence is kept on `boardWhy` and is printed in full in this panel.
    // GREEN MEANS OWNED, and `bound` is the only state that earns it. The bind
    // row's own state — 'auto', 'confirm' or 'manual' — records HOW it was
    // decided, not whether it is provisional; all three are holding states
    // (checkin_api.py `_BIND_HOLDS`). Drawing a human-confirmed bind amber
    // would put "Yes, that's them" under an order somebody already said yes to.
    if (st === 'bound' && ab) {
      return {
        state: 'auto',
        conf: num(ab.conf) == null ? 0 : ab.conf,
        checkinId: ab.checkin_id,
        signals: ab.signals || [],
        why: '', boardWhy: o.why || '',
        candidates: candidates,
        live: true, ownerState: st, decidedBy: ab.decided_by || null
      };
    }
    if (st === 'unclaimed') {
      return {
        state: 'confirm',
        conf: num(o.best_conf) == null ? 0 : o.best_conf,
        checkinId: o.best_checkin_id || null,
        signals: bestSignals(id, o.best_checkin_id),
        why: '', boardWhy: o.why || '',
        candidates: candidates,
        live: true, ownerState: st
      };
    }
    return {
      state: 'none',
      conf: num(o.best_conf) == null ? 0 : o.best_conf,
      checkinId: null,
      signals: [],
      // The board's own sentence, and — when the candidate pull did not happen —
      // the reason, because an empty candidate list renders on screen as
      // "nobody in the room is a plausible match", which would be a claim this
      // seam never computed.
      why: (o.why || '') + (_candFail[id] ? ' · ' + _candFail[id] : ''),
      boardWhy: o.why || '',
      candidates: candidates,
      live: true, ownerState: st
    };
  }

  // The signals behind the board's best_conf. The board does not return them,
  // so they are read off the candidates payload for the SAME pair — and when
  // that pull did not happen, the answer is an empty list rather than a guess.
  function bestSignals(oid, cid) {
    var cand = _cands[String(oid)];
    if (!cand || !cid) { return []; }
    var hit = (cand.candidates || []).filter(function (c) { return c.checkin_id === cid; })[0];
    return (hit && hit.signals) || [];
  }

  function publishToHW() {
    if (!_hw || !_board) { return; }

    // 1. The strip. CONTENTS replaced, array identity kept.
    if (Array.isArray(_hw.CHECKINS)) {
      if (_mockCheckins === null) { _mockCheckins = _hw.CHECKINS.slice(); }
      var rows = people().map(toRow);
      _hw.CHECKINS.length = 0;
      rows.forEach(function (r) { _hw.CHECKINS.push(r); });
    }

    // 2. The resolver. Live room first, then the mock snapshot — see falsehood
    // #2 at the top of this file.
    if (typeof _hw.checkinById === 'function' && !_origCheckinById) {
      _origCheckinById = _hw.checkinById;
      _hw.checkinById = function (id) {
        var live = (_hw.CHECKINS || []).filter(function (c) { return c.id === id; })[0];
        if (live) { return live; }
        var mock = (_mockCheckins || []).filter(function (c) { return c.id === id; })[0];
        return mock || null;
      };
    }

    // 3. The signal vocabulary, SERVED rather than duplicated. pos/data.jsx:265
    //    carries handle / email / cart / time — none of which this matcher
    //    emits — over weights nobody computes with. Both maps have their
    //    contents replaced, so a screen can only ever print a label and a weight
    //    that came from /api/checkin/contract.
    if (_contract) {
      replaceMap(_hw.SIGNAL_LABEL, _contract.signal_labels);
      replaceMap(_hw.MATCH_WEIGHT, _contract.signals);
    }

    // 4. Ownership. bindFor() answers for every order the board classified and
    //    falls through to pos/data.jsx for everything else.
    if (typeof _hw.bindFor === 'function' && !_origBindFor) {
      _origBindFor = _hw.bindFor;
      _hw.bindFor = function (o) {
        // KEYED BOTH WAYS. This looked up by o.id while _liveBinds was
        // populated by o.wm_order_id. Those agree on a live page (hw-live.js
        // sets id = wm_order_id) and DIVERGE on every mock row ('ORD-00231'),
        // so the lookup missed, fell through to pos/data.jsx, and MatchSheet
        // drew four invented people each carrying a bar meter and the score 5.
        // Nobody scored them. toBind() above is careful never to truncate the
        // candidate list for exactly that reason -- and this miss defeated
        // that guard one level up.
        var live = _liveBinds[String(o && o.wm_order_id)]
                || _liveBinds[String(o && o.id)];
        if (live) { return live; }
        // The board is live and did not classify this order. Say so. Falling
        // through here would hand the sheet fabricated scores for real people
        // standing in a real room, which is the one thing this file exists to
        // stop.
        if (_status === 'live') {
          return {
            state: 'none', conf: 0, checkinId: null, signals: [],
            why: '', boardWhy: 'The live check-in board did not classify this '
                 + 'order, so nobody has been scored against it. Any ranking '
                 + 'shown here would be invented.',
            candidates: [], live: true, ownerState: 'unknown'
          };
        }
        return _origBindFor(o);
      };
    }
    _liveBinds = {};
    orders().forEach(function (o) { _liveBinds[String(o.wm_order_id)] = toBind(o); });
    // Also key by the id the SCREEN uses, so a page whose orders were replaced
    // by hw-live.js and one still on mock rows both resolve.
    orders().forEach(function (o) {
      if (o && o.id != null) { _liveBinds[String(o.id)] = _liveBinds[String(o.wm_order_id)]; }
    });

    // 5. "1st visit" for somebody we have never seen — falsehood #4.
    if (typeof _hw.visitLabel === 'function' && !_origVisitLabel) {
      _origVisitLabel = _hw.visitLabel;
      _hw.visitLabel = function (n) {
        return (n == null) ? 'visits unknown' : _origVisitLabel(n);
      };
    }

    // 6. The raw payloads, for anyone who wants to render the real thing.
    _hw.CHECKIN_LIVE = {
      status: _status,
      board: _board,
      contract: _contract,
      candidates: _cands,
      source: base + '/api/checkin',
      counter: counter || null
    };
  }

  // When the API stops answering we have to put back what we replaced. The
  // panel says, in words, "the strip is rendering pos/data.jsx's four invented
  // people" -- and it said that while the LIVE people were still on screen,
  // because nothing restored them. A disclosure that is itself false is worse
  // than no disclosure: it tells an operator to distrust exactly the rows that
  // were real.
  function restoreMock() {
    try {
      if (_hw && _mockCheckins && Array.isArray(_hw.CHECKINS)) {
        _hw.CHECKINS.length = 0;
        _mockCheckins.forEach(function (c) { _hw.CHECKINS.push(c); });
      }
      _liveBinds = {};
      if (_hw) { _hw.CHECKIN_LIVE = { status: _status, board: null,
                                      contract: null, candidates: {},
                                      restored_mock: true }; }
    } catch (e) {}
  }

  function replaceMap(target, src) {
    if (!target || typeof target !== 'object' || !src) { return; }
    Object.keys(target).forEach(function (k) { delete target[k]; });
    Object.keys(src).forEach(function (k) { target[k] = src[k]; });
  }

  var _tries = 0;
  function waitForHW() {
    if (W.HW) { _hw = W.HW; publishToHW(); rerenderIfMounted(); return; }
    if (_tries++ > 200) { return; }         // ~30s, then give up quietly
    setTimeout(waitForHW, 150);
  }

  // ── re-render ────────────────────────────────────────────────────────────
  // Same mechanism hw-live.js uses, and for the same reason: on a cold load the
  // payload can land after the first mount, and a screen that mounted on mock
  // data keeps rendering mock data forever. cloneElement is load-bearing —
  // re-rendering the same element object is a React bail-out and does nothing.
  function armRenderCapture() {
    var RD = W.ReactDOM;
    if (!RD || typeof RD.createRoot !== 'function' || RD.createRoot.__hwCheckin) { return true; }
    var orig = RD.createRoot;
    function patched(container, options) {
      var root = orig.call(RD, container, options);
      var render = root.render.bind(root);
      root.render = function (el) { _root = root; _rootEl = el; return render(el); };
      return root;
    }
    patched.__hwCheckin = true;
    RD.createRoot = patched;
    return true;
  }

  var _rdTries = 0;
  function waitForReactDOM() {
    if (W.ReactDOM && typeof W.ReactDOM.createRoot === 'function') { armRenderCapture(); return; }
    if (_rdTries++ > 400) { return; }       // ~60s
    setTimeout(waitForReactDOM, 150);
  }

  function rerenderIfMounted() {
    // hw-live.js wrapped ReactDOM.createRoot BEFORE us, so our own wrapper
    // never saw the call and _root is null. Re-rendering through the root
    // that was actually captured is the difference between 'the payload
    // landed' and 'the payload landed and anyone can see it'.
    if ((!_root || !_rootEl) && W.HW_LIVE && typeof W.HW_LIVE.rerender === 'function') {
      try { W.HW_LIVE.rerender(); } catch (e) {}
      return;
    }
    if (!_root || !_rootEl) { return; }
    try {
      var el = (W.React && W.React.cloneElement) ? W.React.cloneElement(_rootEl) : _rootEl;
      _root.render(el);
    } catch (e) {}
  }

  // ── panel ────────────────────────────────────────────────────────────────
  function chip(P, t, text) {
    return '<span style="display:inline-block;padding:2px 7px;border-radius:' + P.r999 + 'px;' +
      'background:' + t.bg + ';color:' + t.fg + ';font-size:' + P.type.micro + 'px;font-weight:800;' +
      'letter-spacing:.06em">' + esc(text) + '</span>';
  }

  function sectionTitle(P, s) {
    return '<div style="font-size:' + P.type.micro + 'px;font-weight:700;letter-spacing:.08em;' +
      'text-transform:uppercase;color:' + P.inkMute + ';margin:12px 0 6px">' + esc(s) + '</div>';
  }

  function note(P, s) {
    return '<div style="display:flex;gap:7px;font-size:' + P.type.meta + 'px;color:' + P.inkDim +
      ';line-height:1.45;margin-bottom:5px"><span style="color:' + P.inkFaint + '">·</span><span>' +
      esc(s) + '</span></div>';
  }

  function btn(P, act2, label, attrs) {
    return '<button data-hwc="' + act2 + '" ' + (attrs || '') + ' style="min-height:' + P.ctrlH.xs +
      'px;padding:0 9px;border-radius:' + P.r8 + 'px;border:1px solid ' + P.hairline2 +
      ';background:' + P.surface2 + ';color:' + P.ink2 + ';font-family:' + P.fontSans +
      ';font-size:' + P.type.micro + 'px;font-weight:700;cursor:pointer;margin-right:5px">' +
      esc(label) + '</button>';
  }

  function inputHTML(P, key, ph, val) {
    return '<input data-hwc-in="' + key + '" value="' + esc(val || '') + '" placeholder="' + esc(ph) +
      '" style="min-height:' + P.ctrlH.sm + 'px;border-radius:' + P.r8 + 'px;border:1px solid ' +
      P.fieldBorder + ';background:' + P.field + ';color:' + P.ink + ';font-size:' + P.type.meta +
      'px;font-family:' + P.fontSans + ';padding:0 8px;box-sizing:border-box;width:100%">';
  }

  // One signal, with the label and the weight the API served for it. A signal
  // the contract does not know is printed as its raw key with `weight unknown`
  // rather than silently dropped or silently weighted.
  function sigHTML(P, s) {
    var w = signalWeight(s);
    return '<span style="display:inline-block;margin:0 5px 4px 0;padding:2px 7px;border-radius:' +
      P.r8 + 'px;background:' + P.surface3 + ';color:' + P.ink2 + ';font-size:' + P.type.micro +
      'px">' + esc(signalLabel(s)) + ' <b style="font-family:' + ff(P.fontMono) + ';color:' +
      (w == null ? P.bad : P.inkMute) + '">' + esc(w == null ? 'weight unknown' : w) + '</b></span>';
  }

  function confHTML(P, conf, raw) {
    var same = (raw == null || raw === conf);
    return '<span style="font-family:' + ff(P.fontMono) + ';font-weight:800;font-size:' +
      P.type.strong + 'px;color:' + (conf >= 90 ? P.good : conf >= 60 ? P.warn : P.inkMute) + '">' +
      esc(conf) + '</span>' + (same ? '' :
      '<span style="font-family:' + ff(P.fontMono) + ';font-size:' + P.type.micro + 'px;color:' +
      P.inkDim + '"> (raw ' + esc(raw) + ')</span>');
  }

  // ── panel · the room ─────────────────────────────────────────────────────
  function personHTML(P, p) {
    var v = _match[p.id] || null;
    var h = '<div style="border:1px solid ' + P.hairline2 + ';border-left:3px solid ' +
      (p.claimed_by ? P.good : p.unclaimed ? P.warn : P.neutral) + ';border-radius:' + P.r8 +
      'px;padding:8px 9px;margin-bottom:7px;background:' + P.surface2 + '">';

    h += '<div style="display:flex;gap:8px;align-items:baseline;justify-content:space-between">' +
      '<div style="font-size:' + P.type.strong + 'px;font-weight:700;color:' + P.ink + '">' +
      esc(p.name || '(no name on the row)') + '</div>' +
      '<span style="font-family:' + ff(P.fontMono) + ';font-size:' + P.type.micro + 'px;color:' +
      P.inkMute + '">' + esc(shortWait(p.waited_s)) + ' waiting</span></div>';

    h += '<div style="font-family:' + ff(P.fontMono) + ';font-size:' + P.type.micro + 'px;color:' +
      P.inkFaint + ';margin:1px 0 5px">' + esc(p.id) + ' · ' + esc(p.state || '?') +
      (p.location_id ? ' · ' + esc(p.location_id) : ' · counter not stamped') + '</div>';

    // Only what the row actually carries. An absent field says it is absent.
    var facts = [
      ['phone', p.phone || 'none on the row'],
      ['dob', p.dob || 'none on the row'],
      ['gov id', p.gov_id_hash_short ? p.gov_id_hash_short + '…' : 'no document hash'],
      ['identity', p.identity_id == null ? 'not resolved' : '#' + p.identity_id],
      ['claimed by', p.claimed_by || 'nobody'],
      ['holding', (p.holds_wm_order_ids || []).length ? p.holds_wm_order_ids.join(', ') : 'no bag']
    ];
    h += '<div style="display:grid;grid-template-columns:auto 1fr;gap:2px 8px;font-size:' +
      P.type.micro + 'px;margin-bottom:6px">';
    facts.forEach(function (f) {
      h += '<span style="color:' + P.inkMute + '">' + esc(f[0]) + '</span>' +
        '<span style="color:' + P.ink2 + ';font-family:' + ff(P.fontMono) + '">' + esc(f[1]) + '</span>';
    });
    h += '</div>';

    h += btn(P, 'match', 'Match against waiting orders', 'data-cid="' + esc(p.id) + '"') +
      btn(P, 'claim', 'Claim…', 'data-cid="' + esc(p.id) + '"') +
      btn(P, 'leave', 'They left', 'data-cid="' + esc(p.id) + '"');

    if (v) { h += matchHTML(P, p, v); }
    return h + '</div>';
  }

  // THE MATCHER, rendered whole. Every candidate — the winner and every loser —
  // with its own confidence, its own signals and its own sentence. An associate
  // who cannot see why the runner-up lost cannot disagree with the machine, and
  // disagreeing with the machine is the entire reason a human is standing there.
  function matchHTML(P, p, v) {
    var t = verdictTone(P, v.state);
    var h = '<div style="margin-top:8px;border-top:1px solid ' + P.hairline + ';padding-top:8px">';
    h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:5px">' +
      chip(P, t, t.word) +
      '<span style="font-size:' + P.type.micro + 'px;color:' + P.inkMute + ';font-family:' +
      ff(P.fontMono) + '">pool ' + esc(v.pool) + ' · margin ' + esc(v.margin) + '</span></div>';

    // The verdict sentence, verbatim. Never "matched", never a tick.
    h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.45;' +
      'margin-bottom:7px">' + esc(v.why || '(the API returned no sentence)') + '</div>';

    if ((v.same_person || []).length > 1) {
      h += note(P, v.same_person.length + ' of these orders belong to this same person (' +
        v.same_person.join(', ') + ') — hand over every bag or bind them one at a time.');
    }

    (v.candidates || []).forEach(function (c, i) {
      var win = (i === 0 && v.top && c.wm_order_id === v.top.wm_order_id);
      h += '<div style="border:1px solid ' + (win ? P.accentBorder : P.hairline) + ';border-radius:' +
        P.r8 + 'px;padding:7px 8px;margin-bottom:5px;background:' + (win ? P.surface : 'transparent') + '">';
      h += '<div style="display:flex;gap:8px;align-items:baseline;justify-content:space-between">' +
        '<span style="font-size:' + P.type.meta + 'px;font-weight:700;color:' + P.ink + '">#' +
        esc(c.wm_order_id) + ' · ' + esc(c.customer_name || 'no name on the order') + '</span>' +
        confHTML(P, c.conf, c.raw_conf) + '</div>';
      h += '<div style="font-family:' + ff(P.fontMono) + ';font-size:' + P.type.micro + 'px;color:' +
        P.inkFaint + ';margin-bottom:4px">' + esc(c.status || '?') + ' · ' + esc(c.prep_state || '?') +
        ' · $' + esc(c.grand_total) + ' · waiting ' + esc(shortWait(c.waited_s)) + '</div>';
      h += '<div style="margin-bottom:3px">' +
        ((c.signals || []).length ? c.signals.map(function (s) { return sigHTML(P, s); }).join('') :
         '<span style="font-size:' + P.type.micro + 'px;color:' + P.inkMute + '">no signal fired</span>') +
        '</div>';
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkDim + ';line-height:1.45">' +
        esc(c.why || '') + '</div>';
      h += '<div style="margin-top:6px">' +
        btn(P, 'bind', 'Bind this bag…', 'data-cid="' + esc(p.id) + '" data-oid="' + esc(c.wm_order_id) + '"') +
        btn(P, 'bindmanual', 'Bind · I checked their ID…', 'data-cid="' + esc(p.id) + '" data-oid="' + esc(c.wm_order_id) + '"') +
        btn(P, 'reject', 'Not this one', 'data-cid="' + esc(p.id) + '" data-oid="' + esc(c.wm_order_id) + '"') +
        '</div>';
      h += '</div>';
    });

    if (!(v.candidates || []).length) {
      h += note(P, 'no order was even eligible to be scored — excluded: ' +
        JSON.stringify(v.excluded || {}));
    }
    return h + '</div>';
  }

  // ── panel · the orders ───────────────────────────────────────────────────
  function orderHTML(P, o) {
    var id = String(o.wm_order_id);
    var t = ownerTone(P, o.owner_state);
    var cand = _cands[id] || null;
    var h = '<div style="border:1px solid ' + P.hairline2 + ';border-left:3px solid ' + t.fg +
      ';border-radius:' + P.r8 + 'px;padding:8px 9px;margin-bottom:7px;background:' + P.surface2 + '">';

    h += '<div style="display:flex;gap:8px;align-items:baseline;justify-content:space-between">' +
      '<div style="font-size:' + P.type.strong + 'px;font-weight:700;color:' + P.ink + '">#' +
      esc(id) + '<span style="font-weight:500;color:' + P.inkFaint + ';font-size:' + P.type.meta +
      'px"> · ' + esc(o.customer_name || 'no name on the order') + '</span></div>' + chip(P, t, t.word) + '</div>';

    h += '<div style="font-family:' + ff(P.fontMono) + ';font-size:' + P.type.micro + 'px;color:' +
      P.inkFaint + ';margin:1px 0 5px">' + esc(o.status || '?') + ' · ' + esc(o.prep_state || '?') +
      ' · $' + esc(o.grand_total) + ' · waiting ' + esc(shortWait(o.waited_s)) +
      (o.pickup_location_id ? ' · ' + esc(o.pickup_location_id) : '') + '</div>';

    h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.45;' +
      'margin-bottom:6px">' + esc(o.why || '(the API returned no sentence)') + '</div>';

    // The INVERSE view: this order, the people in the room ranked beneath it,
    // losers kept. checkin_api.py returns two caveats as fields rather than
    // hiding them, so they are printed rather than hidden.
    if (cand) {
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkMute + ';margin-bottom:4px">' +
        esc(cand.why || '') + '</div>';
      (cand.candidates || []).forEach(function (c, i) {
        h += '<div style="display:flex;gap:8px;align-items:center;border:1px solid ' +
          (i === 0 && c.plausible ? P.accentBorder : P.hairline) + ';border-radius:' + P.r8 +
          'px;padding:6px 7px;margin-bottom:4px">' +
          '<span style="flex:1;min-width:0"><span style="display:block;font-size:' + P.type.meta +
          'px;font-weight:700;color:' + P.ink + '">' + esc(c.name || c.checkin_id) + '</span>' +
          '<span style="display:block;font-size:' + P.type.micro + 'px;color:' + P.inkDim + '">' +
          esc(c.why || '') + '</span></span>' + confHTML(P, c.conf, null) +
          btn(P, 'bind', 'Bind…', 'data-cid="' + esc(c.checkin_id) + '" data-oid="' + esc(id) + '"') +
          btn(P, 'bindmanual', 'ID checked…', 'data-cid="' + esc(c.checkin_id) + '" data-oid="' + esc(id) + '"') +
          '</div>';
      });
      h += note(P, 'This view cannot fire the `sole` signal and does not apply the ambiguity ' +
        'penalty, so its numbers can differ from the matcher\'s for the same pair. ' +
        'match(checkin_id) is the scoring authority. ambiguity_applied=' +
        String(cand.ambiguity_applied) + ', sole_signal_scored=' + String(cand.sole_signal_scored) + '.');
    } else if (_candFail[id]) {
      h += note(P, _candFail[id]);
    } else if (o.owner_state === 'bound') {
      h += note(P, 'already bound — no candidate list was pulled for it.');
    }

    h += '<div style="margin-top:4px">' + btn(P, 'handoff', 'Bag left the counter…', 'data-oid="' + esc(id) + '"') + '</div>';
    return h + '</div>';
  }

  // ── panel · what is real and what is not ─────────────────────────────────
  function honestyHTML(P) {
    var h = sectionTitle(P, 'What this seam replaced');
    h += note(P, 'window.HW.CHECKINS — contents replaced with the ' + people().length +
      ' people the board reports. pos/data.jsx:68 (Harshil Gupta, Manisha Saini, Girish Sharma, ' +
      'Joseph Levi) is no longer rendered by the strip.');
    h += note(P, 'window.HW.SIGNAL_LABEL / MATCH_WEIGHT — contents replaced with ' +
      '/api/checkin/contract. pos/data.jsx:265 carried handle / email / cart / time; this matcher ' +
      'emits none of them, so a bind strip showing one of those old keys is a MOCK strip.');
    h += note(P, 'window.HW.bindFor — answers from the live board for the ' + orders().length +
      ' waiting pickup orders and falls through to pos/data.jsx for every other order.');
    h += note(P, 'window.HW.checkinById — live room first, then a snapshot of the four mock rows, ' +
      'so a mock bind strip can never render a green rail with a blank name on it.');
    h += note(P, 'window.HW.visitLabel — answers "visits unknown" for a null visit count instead ' +
      'of "1st visit". A live check-in row carries no visit count at all.');

    h += sectionTitle(P, 'What is still mock, and what that means on screen');
    h += note(P, 'Type and Method on every check-in card read "not captured" because the checkins ' +
      'table has no customer type and no fulfilment method. They are not unknown-and-hidden; ' +
      'they are absent.');
    h += note(P, 'No crown, no "second visit" badge and no party on any live card. Membership, ' +
      'visit count and guests do not exist in this schema — the absence is the honest render.');
    h += note(P, 'THE BOARD\'S OWN BUTTONS ARE STILL LOCAL. "Yes, that\'s them", "Bind" in the ' +
      'match lane and "Bind" in the match sheet are pos/screen-orders.jsx state setters ' +
      '(screen-orders.jsx:26-28) — they turn the strip green in this tab and POST NOTHING. ' +
      'The binds that reach the ledger are the ones in this panel, which ask for a name first.');
    h += note(P, 'An order the API calls `awaiting_arrival` — its NORMAL state, the customer is ' +
      'still driving — lands in the red "Needs match" lane, because the design has no neutral ' +
      'strip. The sentence on the card is the API\'s and says so; the lane\'s colour is the ' +
      'design\'s and overstates it.');
    h += note(P, 'A candidate row in the match lane always reads "no order yet" under the name. ' +
      'That string is hardcoded at screen-orders.jsx:293 and is wrong for anybody already ' +
      'holding a bag — this panel\'s "holding" line is the true one.');
    h += note(P, 'Nothing here tells Weedmaps anything. handoff() closes the check-in; ' +
      'engine.py owns every WM write.');
    return h;
  }

  function contractHTML(P) {
    if (!_contract) {
      return sectionTitle(P, 'Scoring contract') +
        note(P, '/api/checkin/contract did not answer, so no weight or label on this screen can ' +
          'be trusted to be current. Nothing was substituted.');
    }
    var h = sectionTitle(P, 'Scoring contract · served, not duplicated');
    h += '<div style="margin-bottom:6px">' +
      Object.keys(_contract.signals || {}).map(function (s) { return sigHTML(P, s); }).join('') +
      '</div>';
    h += note(P, _contract.scoring || '');
    h += note(P, 'AUTO at ' + _contract.auto + ', CONFIRM at ' + _contract.confirm + '. ' +
      (_contract.auto_rule || ''));
    h += note(P, _contract.ambiguity_rule || '');
    h += note(P, 'Circumstantial (capped below CONFIRM on their own): ' +
      (_contract.circumstantial || []).join(', ') + '.');
    h += note(P, 'A pickup order goes no-show after ' +
      Math.round((_contract.no_show_after_s || 0) / 3600) + 'h with nobody plausible in the room · ' +
      'cancel reason ' + _contract.no_show_cancel_reason + '.');
    return h;
  }

  function newCheckinHTML(P) {
    var h = sectionTitle(P, 'Check somebody in · POST /api/checkin');
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">' +
      inputHTML(P, 'first_name', 'First name', _newRow.first_name) +
      inputHTML(P, 'last_name', 'Surname', _newRow.last_name) +
      inputHTML(P, 'phone', 'Phone', _newRow.phone) +
      inputHTML(P, 'dob', 'DOB (YYYY-MM-DD)', _newRow.dob) + '</div>';
    h += btn(P, 'create', 'Check in' + (counter ? ' at ' + counter : ''));
    h += note(P, 'The API refuses a row with no surname, phone, document hash or identity — such a ' +
      'row could never be matched to anything but would still be counted as a person standing at ' +
      'the counter. It also refuses a raw document number outright; only a hash the identity ' +
      'layer computed is accepted. Try it: the refusal sentence is what appears above.');
    return h;
  }

  function panelHTML(P) {
    var h = '<div style="font-size:' + P.type.micro + 'px;font-weight:700;letter-spacing:.08em;' +
      'text-transform:uppercase;color:' + P.inkMute + ';margin-bottom:8px">The counter</div>';

    if (_status !== 'live') {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.5">' +
        (_status === 'off' ? 'Turned off. The strip is rendering pos/data.jsx\'s four invented people.' :
         _status === 'pending' ? 'Asking ' + esc(base) + ' for the board…' :
         _status === 'slow' ? 'Still waiting on ' + esc(base) + '. The request was not aborted; it will apply late.' :
         esc(base) + '/api/checkin/board did not answer. The strip is rendering pos/data.jsx\'s four ' +
         'invented people — Harshil Gupta, Manisha Saini, Girish Sharma, Joseph Levi — and nothing ' +
         'on this screen is live.') + '</div>';
      return h;
    }

    var pc = _board.people_counts || {};
    var oc = _board.counts || {};
    h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.5;' +
      'margin-bottom:8px">' + esc(pc.in_room || 0) + ' in the room · ' + esc(pc.unclaimed || 0) +
      ' unclaimed · ' + esc(pc.holding || 0) + ' holding a bag. ' + esc(orders().length) +
      ' waiting pickup order' + (orders().length === 1 ? '' : 's') + ': ' +
      esc(oc.bound || 0) + ' bound, ' + esc(oc.unclaimed || 0) + ' somebody-is-here, ' +
      esc(oc.awaiting_arrival || 0) + ' awaiting arrival, ' + esc(oc.no_show || 0) + ' no-show.' +
      (counter ? ' Counter filter: ' + esc(counter) + '.' : ' All counters.') + '</div>';

    if (_msg) {
      h += '<div style="font-size:' + P.type.meta + 'px;line-height:1.45;padding:7px 9px;' +
        'border-radius:' + P.r8 + 'px;margin-bottom:8px;background:' +
        (_msgOk ? P.goodSoft : P.badSoft) + ';color:' + (_msgOk ? P.good : P.bad) + '">' +
        esc(_msg) + '</div>';
    }

    h += '<div style="display:flex;gap:5px;margin-bottom:4px">' +
      btn(P, 'tab', 'The room (' + people().length + ')', 'data-tab="room"') +
      btn(P, 'tab', 'The orders (' + orders().length + ')', 'data-tab="orders"') +
      btn(P, 'tab', 'Contract', 'data-tab="contract"') +
      btn(P, 'tab', 'What is real', 'data-tab="honesty"') + '</div>';

    if (_tab === 'room') {
      h += newCheckinHTML(P);
      h += sectionTitle(P, 'In the room');
      if (!people().length) {
        h += note(P, 'Nobody is checked in. The strip is showing an empty room, which is what the ' +
          'checkins table says — not a fallback to the mock.');
      }
      people().forEach(function (p) { h += personHTML(P, p); });
    } else if (_tab === 'orders') {
      h += sectionTitle(P, 'Waiting pickup orders');
      if (!orders().length) { h += note(P, 'No outstanding pickup orders.'); }
      orders().forEach(function (o) { h += orderHTML(P, o); });
    } else if (_tab === 'contract') {
      h += contractHTML(P);
    } else {
      h += honestyHTML(P);
    }
    return h;
  }

  function paintWhenThemed() {
    if (_themeWait) { return; }
    _themeWait = setInterval(function () {
      if (W.THEMES) { clearInterval(_themeWait); _themeWait = null; paint(); }
    }, 200);
  }
  var _themeWait = null;

  function paint() {
    if (!armed) { return; }
    var P = palette();
    if (!P) { paintWhenThemed(); return; }   // no tokens yet -> wait, never a hex here

    if (!_el) {
      _el = document.createElement('div');
      _el.id = 'hw-checkin-badge';
      document.body.appendChild(_el);
      _el.addEventListener('click', onClick);
      _el.addEventListener('input', onInput);
      _el.addEventListener('keydown', function (e) {
        if (e.target && /^(SELECT|OPTION|INPUT)$/.test(e.target.tagName)) { return; }
        if (e.key !== 'Enter' && e.key !== ' ') { return; }
        e.preventDefault();
        onClick(e);
      });
      if (W.MutationObserver && document.body) {
        // tokens.jsx repaints document.body.style on a theme change and emits no
        // event, so the style attribute is the only signal a plain-JS module has.
        new MutationObserver(function () { if (_el) { paint(); } })
          .observe(document.body, { attributes: true, attributeFilter: ['style'] });
      }
    }

    var body = _el.querySelector('[data-hwc-scroll]');
    if (body) { _scroll = body.scrollTop; }
    var focusKey = document.activeElement &&
      document.activeElement.getAttribute && document.activeElement.getAttribute('data-hwc-in');

    var oc = _board && _board.counts || {};
    var needs = (oc.unclaimed || 0) + (oc.no_show || 0);
    var dot = _status !== 'live' ? P.inkFaint : needs ? P.warn : P.good;
    var label = _status === 'live' ? 'Check-in' :
                _status === 'pending' ? 'Check-in…' :
                _status === 'slow' ? 'Check-in — still loading' :
                _status === 'off' ? 'Check-in (off · mock people)' : 'Check-in (no API · mock people)';
    var sub = _status !== 'live' ? base.replace(/^https?:\/\//, '') :
      people().length + ' in room · ' + orders().length + ' waiting' +
      (needs ? ' · ' + needs + ' need a human' : '');

    _el.style.cssText = 'position:fixed;left:' + (RAIL_W + 12) + 'px;bottom:' + BOTTOM + 'px;' +
      'z-index:2147482002;pointer-events:none;font-family:' + P.fontSans +
      ';max-width:min(460px,calc(100vw - ' + (RAIL_W + 28) + 'px));';

    var html = '';
    if (_open) {
      html += '<div style="background:' + P.surface + ';border:1px solid ' + P.hairline2 +
        ';border-radius:' + P.r12 + 'px;box-shadow:' + P.shadowLg + ';padding:13px;margin-bottom:8px;' +
        'pointer-events:auto"><div data-hwc-scroll style="max-height:70vh;overflow:auto">' +
        panelHTML(P) + '</div>' +
        '<button data-hwc="refresh" style="margin-top:11px;width:100%;min-height:' + P.ctrlH.sm +
        'px;border-radius:' + P.r8 + 'px;border:1px solid ' + P.hairline2 + ';background:' + P.surface2 +
        ';color:' + P.ink2 + ';font-family:' + P.fontSans + ';font-size:' + P.type.meta +
        'px;font-weight:600;cursor:pointer">' + (_busy ? 'working…' : 'Re-fetch /api/checkin/board') +
        '</button></div>';
    }
    html += '<div role="button" tabindex="0" data-hw-i data-hwc="toggle" title="' +
      esc(label + ' — click for the room, the orders and the matcher') +
      '" style="display:inline-flex;align-items:center;gap:8px;min-height:' + P.ctrlH.xs +
      'px;padding:0 12px;border-radius:' + P.r999 + 'px;background:' + P.surface + ';border:1px solid ' +
      P.hairline2 + ';box-shadow:' + P.shadowSm + ';cursor:pointer;user-select:none;pointer-events:auto">' +
      '<span style="width:7px;height:7px;border-radius:' + P.r999 + 'px;background:' + dot +
      ';flex:0 0 auto"></span>' +
      '<span style="font-size:' + P.type.meta + 'px;font-weight:700;color:' + P.ink + '">' +
      esc(label) + '</span>' +
      '<span style="font-size:' + P.type.meta + 'px;color:' + P.inkMute + ';font-family:' +
      ff(P.fontMono) + '">' + esc(sub) + '</span></div>';

    _el.innerHTML = html;

    body = _el.querySelector('[data-hwc-scroll]');
    if (body) { body.scrollTop = _scroll; }
    if (focusKey) {
      var again = _el.querySelector('[data-hwc-in="' + focusKey + '"]');
      if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
    }
  }

  function onInput(e) {
    var k = e.target && e.target.getAttribute && e.target.getAttribute('data-hwc-in');
    if (!k) { return; }
    _newRow[k] = e.target.value;      // no repaint: repainting on every keystroke
  }                                   // would fight the caret

  function onClick(e) {
    var t = e.target;
    var a = t && t.getAttribute && t.getAttribute('data-hwc');
    if (!a) {
      if (t && /^(SELECT|OPTION|INPUT|BUTTON)$/.test(t.tagName)) { return; }
      _open = !_open; paint(); return;
    }
    e.stopPropagation();
    var cid = t.getAttribute('data-cid'), oid = t.getAttribute('data-oid');
    if (a === 'refresh') { _msg = null; load(); return; }
    if (a === 'tab') { _tab = t.getAttribute('data-tab'); _msg = null; paint(); return; }
    if (a === 'match') { matchCheckin(cid); return; }
    if (a === 'bind') { bind(cid, oid); return; }
    if (a === 'bindmanual') { bindManual(cid, oid); return; }
    if (a === 'reject') { reject(cid, oid); return; }
    if (a === 'handoff') { handoff(oid); return; }
    if (a === 'claim') { claim(cid); return; }
    if (a === 'leave') { leave(cid); return; }
    if (a === 'create') { create(); return; }
    if (a === 'toggle') { _open = !_open; paint(); return; }
  }

  // ── public surface ───────────────────────────────────────────────────────
  W.HW_CHECKIN = {
    __armed: armed,
    get status() { return _status; },
    get board() { return _board; },
    get people() { return people(); },
    get orders() { return orders(); },
    get contract() { return _contract; },
    get candidates() { return _cands; },
    get base() { return base; },
    get counter() { return counter; },
    match: matchCheckin,
    bind: bind,
    bindManual: bindManual,
    reject: reject,
    handoff: handoff,
    claim: claim,
    leave: leave,
    create: create,
    refresh: function () {
      if (!armed) { return Promise.resolve('off'); }
      _status = 'pending'; paint();
      return load();
    },
    open: function () { _open = true; paint(); },
    disable: function () {
      try { W.localStorage.setItem(OFF_KEY, '1'); } catch (e) {}
      W.location.reload();
    },
    enable: function () {
      try { W.localStorage.removeItem(OFF_KEY); } catch (e) {}
      W.location.reload();
    }
  };

  if (armed) {
    waitForHW();
    waitForReactDOM();
    if (document.body) { paint(); }
    else { document.addEventListener('DOMContentLoaded', paint); }
    load();
  }
})();
