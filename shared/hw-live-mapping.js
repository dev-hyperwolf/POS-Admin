// ── shared/hw-live-mapping.js ── our product → THEIR product, on a screen ──
// Plain JS. Loads BEFORE React, on the POS entry HTML only. Sibling of
// shared/hw-live.js, hw-live-taxonomy.js, hw-live-identity.js and
// hw-live-checkin.js, built to the same rules: armed on any origin with the
// same-origin fetch deciding, in-place mutation of window.HW (never a
// reassignment), every write through W.HW_LIVE.post, silent fallback when
// nothing answers, and the panel says out loud what is still not true.
//
// WHAT IT IS, AND WHY IT EXISTS.
// The owner's question is "how can I map a product from our catalog to a
// weedmaps product to make sure it's verified on weedmaps?" The matching engine
// for that has existed for weeks (wmdemo/mapping.py, ~1180 lines: deterministic
// exact match, fuzzy scoring, an AI escalation band, sticky human verdicts, an
// absence ledger). Eight HTTP routes serve it. NOT ONE SCREEN CALLS THEM. The
// honest answer to "can we do this yet" was "yes, with curl", which is not an
// answer. This file is the screen. It builds no matcher of its own and re-
// derives no threshold of its own — every verdict word on it is the server's.
//
// THE STATES, AND WHY THEY ARE DRAWN AS DIFFERENTLY AS THEY ARE. Four of these
// mean "not on Weedmaps" and the operator's next move is different for each, so
// they share no colour and no wording:
//   LINKED    — a mapping row exists (status active/alert). This SKU has a WM
//               product id behind it. Linked is NOT the same as published; the
//               row says separately whether we ever pushed it and whether
//               Weedmaps handed back an item id.
//   READY     — the engine is confident (its own word: exact / auto) and
//               nothing has pressed the button. One click each. This is the
//               cheapest work on the board and it sorts first.
//   REVIEW    — the engine is NOT confident: an open queue row, or a score in
//               the AI-escalation band. A person has to look.
//   REJECTED  — a PERSON said no. Sticky: wmdemo/mapping.py:539-541 refuses to
//               re-queue it until the product itself changes. Re-running the
//               matcher does nothing. Only approving something clears it.
//   NO MATCH  — nothing scored well enough. NOT the same as "Weedmaps does not
//               have it": we have not proved absence, and this panel refuses to
//               say we have.
//   NEVER LOOKED — the SKU's BRAND feed has never been pulled, so the candidate
//               pool it was scored against was EMPTY. This is a THIRD state and
//               it is the one this panel used to lie about: with no pool, the
//               engine returns its lowest score and the row rendered as "NO
//               CONFIDENT MATCH ... best 0.000", which reads as "we looked and
//               found nothing". We did not look. 108 of the 149 SKUs on the
//               deployed instance are in exactly this state (GET
//               /api/mapping/unlooked, 2026-08-26) and every one of them was
//               drawn as a scoring failure. The next action is not on this row
//               and not on this SKU: it is pulling ONE brand feed, which clears
//               every SKU under that brand at once. So the state carries the
//               brand and the panel groups the work by brand, because 108 rows
//               of "nothing matched" is 22 brands of "we never asked".
//   MAPPED, NOT IN OUR MIRROR — a mapping row exists and points at a Weedmaps
//               product id that HAS NO ROW in wm_products. We are published
//               against a product we have never pulled and cannot see: no name,
//               no brand, no weight, no category. It is not LINKED-and-fine and
//               it is not "Weedmaps dropped it" either — those are three states
//               and the server used to collapse two of them into the first.
//               Live case, 2026-08-27: SLUG-BB-629491 → wm 634042, tier 1,
//               score 1.0, status active, while its brand feed (Sluggers Hit,
//               28588) has NEVER been pulled — so 634042 cannot be in the
//               mirror — and the dashboard's wm_missing on the same response
//               was []. This row drew as a healthy green LINKED. The fix is on
//               both sides: store.mapping_dashboard now emits `wm_unknown`,
//               bulk_view puts `wm_mirror` on every row, and rows() below tests
//               this BEFORE `linked`, which was swallowing it.
//   ABSENT    — the absence ledger says Weedmaps genuinely does not carry it,
//               confirmed across two DISTINCT catalogue pulls
//               (wmdemo/mapping.py:562-588). This is not our work at all — it
//               is a sentence to send the brand.
//
// THE CLAIM IS DRAWN WHERE THE CHOICE IS MADE. Any candidate a different SKU
// already holds live comes back from /api/mapping/candidates carrying
// `conflict_with` and the holder's tier/status/decided_by. Those are rendered
// on the row, naming the incumbent SKU — because approve() refuses a second
// live claim with a 409, and until this was drawn the operator met that refusal
// at the last click for a reason that was knowable before they picked. The row
// is NOT hidden and NOT re-ranked: a many-to-one is legitimate (approve takes
// force:true) and filtering the row would remove the fact the operator needs.
// Detect and surface; the machine never picks the winner.
//
// PUBLIC SURFACE: window.HW_MAPPING = { status, rows, counts, absences,
//   refresh(), candidates(), approve(), reject(), unmap(), rescore(), pull(),
//   open(), close(), disable() }. Also mirrored, read-only, onto
//   window.HW.WM_MAPPING so a POS dev can render this from a screen with no
//   fetch code of their own.
// Turn it off: append `?hwmap=off`, or run `HW_MAPPING.disable()`.
(function () {
  'use strict';
  var W = window;
  if (W.HW_MAPPING && W.HW_MAPPING.__armed) { return; }   // idempotent

  // 9s, not 6s. The list read is POST /api/mapping/bulk with rescore_all.
  // IT NO LONGER SCORES EVERY SKU AGAINST EVERY CACHED WM PRODUCT. It did, and
  // that is what took the demo down on 2026-08-26: 148 SKUs x 17,749 mirrored
  // products = 2.6M comparisons in one request, 82.8s over HTTP, the worker held
  // and the instance restarted for exceeding its memory limit. The server now
  // scores each SKU against ITS OWN BRAND's catalogue and caches the pass on the
  // mirror version: measured 3.7s cold and 0.05s warm at 17,749 products. The
  // timeout stays at 9s because a genuinely cold container still takes seconds to
  // answer its first request at all, and the timer only changes the LABEL — see
  // load(): nothing is ever aborted.
  var TIMEOUT_MS = 9000;
  var OFF_KEY = 'hw-mapping-off';
  var SEAM_ID = 'mapping';

  // ── gate ─────────────────────────────────────────────────────────────────
  var LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i;

  // ff(P.fontMono) is '"JetBrains Mono","SF Mono",ui-monospace,monospace' -- it
  // CONTAINS DOUBLE QUOTES. Interpolated raw into style="..." the first quote
  // TERMINATES THE ATTRIBUTE and every declaration after it is silently
  // discarded. Single quotes are equally valid in CSS and survive the attribute.
  function ff(v) { return String(v).replace(/"/g, "'"); }

  // ── the seam dock ────────────────────────────────────────────────────────
  // Every seam file defines this block identically -- whichever loads first
  // wins and the others reuse it, so there is exactly one tray and exactly one
  // open-panel rule however many seams ship.
  // ⚠️ ONE OF SIX. This dock() fallback is duplicated verbatim in all six
  // shared/hw-live-*.js seams (lines, checkin, mapping, identity, taxonomy,
  // regions), and shared/hw-seam-dock.js is the real implementation this defers to.
  //
  // They are code-identical but NOT byte-identical — two of them are missing a
  // comment block the other four carry. That is the shape that bites: an edit lands
  // in five of six and the sixth silently keeps the old behaviour, with nothing to
  // flag it. If you change this function, change it in all six, or collapse them
  // into a shared helper and delete these.
  function dock() {
    if (W.HW_SEAM_DOCK) { return W.HW_SEAM_DOCK; }
    if (!document.body) { return null; }
    var D = {
      LEFT: 86,            // shared/app-rail.jsx:46 — 74px rail + 12px gutter
      BOTTOM: 52,          // clears hw-live.js's own pill (bottom 14 + ~30 tall)
      _root: null,
      _slot: null,
      _tray: null,
      _closers: {},
      root: function () {
        if (D._root && D._root.parentNode) { return D._root; }
        var r = document.createElement('div');
        r.id = 'hw-seam-dock';
        r.setAttribute('data-hw-chrome', 'seam-dock');
        r.style.cssText = 'position:fixed;left:' + D.LEFT + 'px;bottom:' + D.BOTTOM +
          'px;z-index:var(--hwz-chromeDock);display:flex;flex-direction:column;align-items:flex-start;' +
          'gap:8px;max-width:calc(100vw - ' + (D.LEFT + 16) + 'px);pointer-events:none';
        document.body.appendChild(r);
        D._root = r;
        return r;
      },
      slot: function () {
        if (D._slot && D._slot.parentNode) { return D._slot; }
        var s = document.createElement('div');
        s.id = 'hw-seam-panels';
        s.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:8px;' +
          'max-width:100%;pointer-events:none';
        var r = D.root();
        r.insertBefore(s, r.firstChild);
        D._slot = s;
        return s;
      },
      tray: function () {
        if (D._tray && D._tray.parentNode) { return D._tray; }
        var t = document.createElement('div');
        t.id = 'hw-seam-tray';
        t.style.cssText = 'display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px;' +
          'max-width:100%;pointer-events:none';
        D.root().appendChild(t);
        D._tray = t;
        return t;
      },
      register: function (id, close) { D._closers[id] = close; },
      opened: function (id) {
        Object.keys(D._closers).forEach(function (k) {
          if (k !== id) { try { D._closers[k](); } catch (e) {} }
        });
      },
      closeAll: function () {
        Object.keys(D._closers).forEach(function (k) { try { D._closers[k](); } catch (e) {} });
      }
    };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') { D.closeAll(); }
    });
    W.HW_SEAM_DOCK = D;
    return D;
  }

  function panelCSS(P, D, open) {
    return 'width:min(400px,calc(100vw - ' + (D.LEFT + 16) + 'px));max-height:min(46vh,380px);' +
      'flex-direction:column;overflow:hidden;background:' + P.surface + ';border:1px solid ' +
      P.hairline2 + ';border-radius:' + P.r12 + 'px;box-shadow:' + P.shadowLg + ';font-family:' +
      P.fontSans + ';pointer-events:auto;display:' + (open ? 'flex' : 'none');
  }

  function panelShell(P, attr, title, bodyHTML, footerHTML) {
    return '<div style="display:flex;align-items:center;gap:8px;padding:9px 11px;flex:0 0 auto;' +
      'border-bottom:1px solid ' + P.hairline + '"><span style="flex:1 1 auto;min-width:0;font-size:' +
      P.type.micro + 'px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:' +
      P.inkMute + '">' + esc(title) + '</span>' +
      '<button ' + attr + '="close" aria-label="Close this panel" title="Close (Esc)" ' +
      'style="flex:0 0 auto;width:24px;height:24px;padding:0;line-height:1;border-radius:' + P.r8 +
      'px;border:1px solid ' + P.hairline2 + ';background:' + P.surface2 + ';color:' + P.ink2 +
      ';font-family:' + P.fontSans + ';font-size:' + P.type.body +
      'px;font-weight:700;cursor:pointer">×</button></div>' +
      '<div ' + attr + '-scroll style="flex:1 1 auto;min-height:0;overflow:auto;padding:11px">' +
      bodyHTML + '</div>' +
      (footerHTML ? '<div style="flex:0 0 auto;padding:9px 11px;border-top:1px solid ' +
        P.hairline + '">' + footerHTML + '</div>' : '');
  }

  function pillHTML(P, attr, dot, label, sub, tip) {
    return '<div role="button" tabindex="0" data-hw-i ' + attr + '="toggle" title="' + esc(tip) +
      '" style="display:inline-flex;align-items:center;gap:7px;min-height:' + P.ctrlH.xs +
      'px;padding:0 11px;border-radius:' + P.r999 + 'px;background:' + P.surface + ';border:1px solid ' +
      P.hairline2 + ';box-shadow:' + P.shadowSm + ';cursor:pointer;user-select:none;' +
      'pointer-events:auto;white-space:nowrap">' +
      '<span style="width:7px;height:7px;border-radius:' + P.r999 + 'px;background:' + dot +
      ';flex:0 0 auto"></span>' +
      '<span style="font-size:' + P.type.meta + 'px;font-weight:700;color:' + P.ink + '">' +
      esc(label) + '</span>' +
      (sub ? '<span style="font-size:' + P.type.meta + 'px;color:' + P.inkMute + ';font-family:' +
        ff(P.fontMono) + '">' + esc(sub) + '</span>' : '') + '</div>';
  }

  function whyBlock(P, attr, open, notesHTML, n) {
    return '<div style="margin-top:10px;padding-top:9px;border-top:1px solid ' + P.hairline + '">' +
      '<button ' + attr + '="why" aria-expanded="' + (open ? 'true' : 'false') +
      '" style="width:100%;text-align:left;min-height:' + P.ctrlH.xs + 'px;padding:0 9px;' +
      'border-radius:' + P.r8 + 'px;border:1px solid ' + P.hairline2 + ';background:' + P.surface2 +
      ';color:' + P.ink2 + ';font-family:' + P.fontSans + ';font-size:' + P.type.micro +
      'px;font-weight:700;letter-spacing:.06em;cursor:pointer">' + (open ? '▾' : '▸') +
      '  WHY · SOURCE, AND WHAT IS STILL NOT TRUE (' + n + ')</button>' +
      (open ? '<div style="margin-top:8px">' + notesHTML + '</div>' : '') + '</div>';
  }

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

  var override = qs('hwmap');
  var disabled = override === 'off' || override === '0';
  try { if (W.localStorage.getItem(OFF_KEY) === '1') { disabled = true; } } catch (e) {}

  var base = W.location.origin;
  // An explicit base is honoured ONLY when it is itself loopback — otherwise a
  // crafted link could point the page at an arbitrary host and have it render
  // that host's catalog, and its approve buttons, as the operator's own.
  if (override && override !== 'off' && override !== '0') {
    base = isLoopbackOrigin(override) ? override.replace(/\/+$/, '') : base;
  }
  // ARMED ON ANY ORIGIN, and the SAME-ORIGIN FETCH decides. On GitHub Pages
  // /api/state 404s, the reads fail, and the panel says so instead of drawing a
  // board. No regression to the public demo; a hosted one comes alive.
  var armed = !disabled;

  // ── state ────────────────────────────────────────────────────────────────
  var _status = armed ? 'pending' : 'off';   // off|pending|slow|live|unreachable|no-write-path
  var _bulk = null, _bulkErr = null;         // POST /api/mapping/bulk
  var _menuBySku = null, _stateErr = null;   // GET  /api/state  -> menu + events
  var _verdicts = null, _evHorizon = null, _evCount = 0;
  var _absBySku = null, _absErr = null, _absNote = null, _absCount = null, _absConfirmed = null;
  // GET /api/mapping/unlooked -- the third state. Kept in its own slot and
  // NEVER folded into _absBySku: the absence ledger is a claim about THEIR
  // catalogue and this is a fact about OUR pipeline. One is a sentence to
  // send a brand, the other is a job on our side; merging them is how the
  // 108 came to be drawn as 138 scoring failures in the first place.
  var _unlBySku = null, _unlBrands = null, _unlErr = null, _unlNote = null, _unlCount = null;
  var _bulkRun = null;                        // {done,total,ok,refused,notes} while a bulk approve runs
  var _wmids = null;
  var _hw = null;
  var _open = false, _busy = false, _why = false;
  var _filter = 'all';
  var _openSku = null, _cands = null, _candStatus = 'idle', _candErr = null;
  var _candQuery = '', _candSku = null;
  // The re-point control. Its own drawer, deliberately NOT folded into the
  // candidate picker: the picker answers "which of their products is this?"
  // against a ranked list, and this answers "these two specific ids — which one
  // is real?", which is a different question with a different failure mode.
  var _rpSku = null, _rp = null, _rpStatus = 'idle', _rpErr = null, _rpTarget = '';
  var _fresh = {};                            // sku -> the server's own rescore verdict
  var _msg = null, _msgOk = false;
  var _el = null, _panel = null, _scroll = 0;

  // ── helpers ──────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function ago(sec) {
    if (!sec) { return 'never'; }
    var s = Math.max(0, Math.floor(Date.now() / 1000 - sec));
    if (s < 60) { return 'just now'; }
    if (s < 3600) { return Math.floor(s / 60) + 'm ago'; }
    if (s < 86400) { return Math.floor(s / 3600) + 'h ago'; }
    return Math.floor(s / 86400) + 'd ago';
  }

  // Weight is printed EXACTLY as the two sides store it and is never converted.
  // '3.5g' vs Weedmaps' '3.54g' 1/8-oz quirk is a real difference an operator is
  // entitled to see; normalising it here would hide the thing they are checking.
  function wt(w) {
    if (!w || w.value == null) { return ''; }
    return String(w.value) + String(w.unit == null ? '' : w.unit);
  }

  // A score is a number or it is nothing. There is no third option and no zero
  // stands in for "not computed": search_candidates returns score:null for every
  // row when it was asked without a sku, and a 0.000 there would read as "scored,
  // and terrible" for a candidate that was never scored at all.
  function scoreText(s) { return s == null ? 'not scored' : Number(s).toFixed(3); }

  function palette() {
    if (!W.THEMES) { return null; }
    var mode = document.body.style.colorScheme;
    if (mode !== 'light' && mode !== 'dark') {
      try { mode = W.localStorage.getItem('hw-pos-theme'); } catch (e) { mode = null; }
    }
    return W.THEMES[mode === 'dark' ? 'dark' : 'light'] || W.THEMES.light;
  }

  // Six states, six treatments. REJECTED is the only quiet one, because it is
  // the only one that is a recorded decision rather than an open problem — the
  // same reason the taxonomy board draws `skipped` quiet. NO MATCH and ABSENT
  // must never look alike: one is unfinished work here, the other is a sentence
  // to send a brand.
  function tone(P, st) {
    if (st === 'linked')   { return { fg: P.good,    bg: P.goodSoft,    word: 'LINKED' }; }
    // Shares NO CONFIDENT MATCH's red, and the WORD is what separates them —
    // the same way NOT SCORED YET and NEVER LOOKED share `info`. It earns the
    // red: this is the only state on the board where something we have already
    // PUBLISHED is pointing somewhere we cannot see.
    if (st === 'unmirrored'){ return { fg: P.bad,     bg: P.badSoft,     word: 'MAPPED TO A PRODUCT WE CANNOT SEE' }; }
    if (st === 'ready')    { return { fg: P.accentText, bg: P.highlightSoft, word: 'READY · ONE CLICK' }; }
    if (st === 'review')   { return { fg: P.warn,    bg: P.warnSoft,    word: 'NEEDS REVIEW' }; }
    if (st === 'rejected') { return { fg: P.neutral, bg: P.neutralSoft, word: 'REJECTED · STICKY' }; }
    if (st === 'absent')   { return { fg: P.warn,    bg: P.warnSoft,    word: 'NOT ON WEEDMAPS' }; }
    // NEVER LOOKED is drawn in `info`, which no other state on this board uses.
    // It must not share the red of NO CONFIDENT MATCH (that says we looked) nor
    // the amber of NOT ON WEEDMAPS (that says they do not have it). It is
    // neither: it is unstarted work of ours, and the only state here whose next
    // action is on a BRAND rather than on the row.
    if (st === 'unlooked')  { return { fg: P.info,    bg: P.infoSoft,    word: 'NEVER LOOKED' }; }
    // NOT SCORED shares NEVER LOOKED's ink on purpose: both mean unstarted
    // work of ours, and neither is a judgement on the product. It must never
    // borrow the red of NO CONFIDENT MATCH, which asserts that we looked.
    if (st === 'unscored')  { return { fg: P.info,    bg: P.infoSoft,    word: 'NOT SCORED YET' }; }
    return { fg: P.bad, bg: P.badSoft, word: 'NO CONFIDENT MATCH' };
  }

  // -1: it sorts ABOVE the one-click work. A live mapping pointing at a product
  // we have never pulled is already on Weedmaps and already wrong; everything
  // else on this board is work not yet done.
  var ORDER = { unmirrored: -1, ready: 0, review: 1, rejected: 2, nomatch: 3, unscored: 4, unlooked: 5, absent: 6, linked: 7 };

  // ── the derived board ────────────────────────────────────────────────────
  // ONE place where a state is decided, and every input to it is something the
  // server said. Nothing here re-implements the matcher and nothing re-derives
  // a threshold: T_AUTO and T_AI live in wmdemo/mapping.py:34-35 and are not
  // served, so the verdict WORD on every row is the server's own.
  function rows() {
    if (!_bulk || !Array.isArray(_bulk.rows)) { return []; }
    return _bulk.rows.map(function (r) {
      var m = r.mapping;
      var linked = !!(m && (m.status === 'active' || m.status === 'alert'));
      var sug = r.suggestion || null;
      var dec = sug && sug.decision;
      var abs = _absBySku ? _absBySku[r.sku] : null;
      var unl = _unlBySku ? _unlBySku[r.sku] : null;
      var v = _verdicts ? _verdicts[r.sku] : null;
      var rejected = !linked && !!(v && v.action === 'rejected');

      // THREE ANSWERS AND TWO DIFFERENT WAYS OF NOT HAVING ONE. The server
      // sends wm_mirror = 'present' | 'delisted' | 'unknown' on any live
      // mapping, and wm_mirror_known === false when its own mirror read failed.
      //
      // `wm_mirror_known !== false` WAS THE BUG, and it was this file asserting
      // something it had never been told. That expression is TRUE WHEN THE KEY
      // IS ABSENT — which is every response from any server built before the
      // field existed. So an old server made this panel report "we checked WM
      // #N and it is in our mirror" on the strength of a field it never sent.
      // This panel's whole claim to be trusted is that every verdict word on it
      // is the server's; a default that manufactures the server's most
      // reassuring answer out of silence is that claim inverted.
      //
      // ABSENT IS ITS OWN STATE. Three values, and `true` is reachable ONLY by
      // the server actually saying so:
      //   true   the server read its mirror; r.wm_mirror is its answer
      //   false  the server TRIED to read its mirror and the read FAILED
      //   null   the server said NOTHING about the mirror — no field at all
      // null and false are both "we do not know", and they are not the same
      // fact: one is an outage on a server that HAS this check, the other is a
      // server that has never had it. They get different sentences below.
      var mirrorKnown = r.wm_mirror_known === true ? true
                      : r.wm_mirror_known === false ? false
                      : null;
      var mirror = mirrorKnown === true ? (r.wm_mirror || null) : null;

      var st;
      // BEFORE `linked`, and that order is the entire fix. `linked` was the
      // first arm of this chain and it returned true for a mapping onto a wm id
      // our mirror has never held, so the row rendered green and nothing on the
      // board disagreed.
      if (linked && mirror === 'unknown') { st = 'unmirrored'; }
      else if (linked) { st = 'linked'; }
      else if (abs && (abs.state === 'absent' || abs.state === 'requested')) { st = 'absent'; }
      else if (rejected) { st = 'rejected'; }
      else if (r.queued) { st = 'review'; }
      else if (dec === 'exact' || dec === 'auto') { st = 'ready'; }
      else if (dec === 'ai') { st = 'review'; }
      // UNLOOKED DISPLACES NOMATCH AND NOTHING ELSE, and the order is the whole
      // point. A SKU whose brand feed was never pulled can still have scored
      // against the feeds we DO hold -- if the engine came back confident, the
      // operator has a button to press and READY is the true state. What is
      // never true is calling it a scoring failure when the pool was empty. So
      // this sits immediately above nomatch and takes only the rows that would
      // otherwise have landed there. The brand fact is still drawn on the other
      // states, as a note, by rowHTML().
      else if (unl) { st = 'unlooked'; }
      // UNSCORED DISPLACES NOMATCH, and this is the whole reason the server
      // grew `suggestion_status`. NO CONFIDENT MATCH is a CLAIM: it says the
      // engine looked at this SKU and was not persuaded. When the bulk pass
      // was cut short by its time budget, nobody looked -- `suggestion` is
      // null for exactly the same reason it is null when the engine rejects,
      // and every row the pass never reached rendered in red as a verdict the
      // engine never gave. That is the estate's recurring defect ("we scored
      // 40 of 17,749" reading as "no match found") in its purest form, and it
      // is the one thing the server cannot fix on its own.
      else if (r.suggestion_status && r.suggestion_status !== 'scored' &&
               r.suggestion_status !== 'queue_only') { st = 'unscored'; }
      else { st = 'nomatch'; }

      // Publication is a SEPARATE fact from linkage and is read from a
      // different table (menu_state). A SKU can be linked and never pushed.
      var mrows = (_menuBySku && _menuBySku[r.sku]) || [];
      var pushed = 0, accepted = 0, lastPush = 0, pushedIds = {};
      mrows.forEach(function (row) {
        pushed++;
        if (row.published && row.wm_item_id != null) { accepted++; }
        if (row.last_pushed_at && row.last_pushed_at > lastPush) { lastPush = row.last_pushed_at; }
        if (row.product_id != null) { pushedIds[String(row.product_id)] = true; }
      });
      // The listing carries a WM product id of its own. If it disagrees with the
      // mapping we hold now, the live listing is pointing at a DIFFERENT WM
      // product than this screen says — which no counter anywhere reports.
      var driftIds = m && m.wm_id != null
        ? Object.keys(pushedIds).filter(function (k) { return k !== String(m.wm_id); })
        : [];

      return {
        sku: r.sku, name: r.name, category: r.category, weight: r.weight,
        state: st, mapping: m, linked: linked, suggestion: sug,
        mirror: mirror, mirrorKnown: mirrorKnown,
        suggestionStatus: r.suggestion_status || null,
        queued: !!r.queued, queueReason: r.queue_reason,
        wmProductId: r.wm_product_id,
        absence: abs || null, unlooked: unl || null, verdict: v || null,
        listings: mrows.length, pushed: pushed, accepted: accepted,
        lastPush: lastPush, driftIds: driftIds
      };
    });
  }

  function counts() {
    var c = { total: 0, linked: 0, ready: 0, review: 0, rejected: 0, nomatch: 0,
              unscored: 0, unlooked: 0, absent: 0, unmirrored: 0, accepted: 0,
              drift: 0, neverPushed: 0, mirrorUnknowable: 0, mirrorUnreported: 0 };
    rows().forEach(function (x) {
      c.total++; c[x.state]++;
      // THREE COUNTERS, NOT TWO. "we could not check" is not "we checked and
      // it is fine", it is not "it is missing", and it is not "this server
      // never told us" either. `!x.mirrorKnown` counted the last two as one —
      // and since an absent key used to read as `true`, the third was not
      // counted at all and no number on this board would have moved.
      if (x.linked && x.mirrorKnown === false) { c.mirrorUnknowable++; }
      if (x.linked && x.mirrorKnown === null) { c.mirrorUnreported++; }
      if (x.linked) {
        if (x.accepted) { c.accepted++; }
        if (!x.listings) { c.neverPushed++; }
        if (x.driftIds.length) { c.drift++; }
      }
    });
    return c;
  }

  // What the sibling taxonomy board knows and this one cannot: a linked SKU can
  // still be rejected by Weedmaps for a missing category id. Read from the
  // sibling's already-fetched coverage — never a second fetch, and never an
  // assumption when the sibling is not there to ask.
  function taxonomyGate() {
    var T = W.HW_TAXONOMY;
    if (!T || !T.__armed) { return { known: false, why: 'the WM taxonomy seam is not loaded on this page' }; }
    if (T.status !== 'live') { return { known: false, why: 'the WM taxonomy seam is ' + T.status }; }
    var cov = T.coverage;
    if (!cov || !cov.blocked_skus) { return { known: false, why: 'the taxonomy seam served no coverage' }; }
    var byS = {};
    (cov.blocked_skus || []).forEach(function (b) {
      if (b && b.sku) { byS[String(b.sku)] = b; }
      else if (typeof b === 'string') { byS[b] = { sku: b, status: 'blocked' }; }
    });
    var n = 0;
    rows().forEach(function (x) { if (x.linked && byS[x.sku]) { n++; } });
    return { known: true, blocked: n };
  }

  // ── fetch ────────────────────────────────────────────────────────────────
  // DELIBERATELY DOES NOT ABORT. hw-live.js paid for this lesson already
  // (hw-live.js:32-39): aborting on a timeout makes a slow-but-perfectly-fine
  // response indistinguishable from a dead server. The timer only changes the
  // LABEL; the request runs to completion and applies late.
  var _settled = false;

  // THE LIST READ IS A POST. /api/mapping/bulk, /candidates, /absences and
  // /rescore are all reads served over POST (wmdemo/server.py:854-870), and the
  // public-mode gate at server.py:365 does not distinguish a POST that reads
  // from a POST that writes. So they go through W.HW_LIVE.post like every write
  // — one token, one same-origin rule, one place the server's own refusal text
  // is read. Which also means this panel cannot load at all without hw-live.js,
  // and says exactly that rather than rendering an empty board.
  function post(path, body) {
    if (!armed) { return Promise.resolve({ ok: false, error: 'seam is off' }); }
    if (!W.HW_LIVE || typeof W.HW_LIVE.post !== 'function') {
      return Promise.resolve({ ok: false, code: 0, body: null,
        error: 'shared/hw-live.js is not loaded — this seam routes every request through its write path and has none of its own' });
    }
    return W.HW_LIVE.post(path, body);
  }

  function loadBulk() {
    // rescore_all:true is what makes READY exist. Without it the server only
    // reports suggestions for SKUs already sitting in the review queue, so a
    // catalogue the nightly job has never touched — the deployed one, today —
    // renders 39 rows of "unmapped" with no candidate on any of them, and the
    // screen is a list of problems with no button.
    //
    // WHAT IT COSTS IS NOW THE SERVER'S PROBLEM AND THE SERVER SAYS SO. The
    // pass is brand-scoped and cached on the mirror version; the response
    // carries a `suggestions` block naming the mode, the cache age and how
    // many SKUs it actually reached, and every row carries `suggestion_status`.
    // This client asks for the whole thing and NEVER assumes it got it —
    // rows() reads suggestion_status, and a row the server did not score is
    // NOT SCORED YET, never NO CONFIDENT MATCH.
    return post('/api/mapping/bulk', { rescore_all: true }).then(function (r) {
      if (!r.ok || !r.body || !Array.isArray(r.body.rows)) {
        _bulk = null;
        _bulkErr = r.gated
          ? 'This deployment is in public mode and every POST needs the write token. Open the hw-live badge and paste it — the list itself is a POST, so nothing here can load without it.'
          : (r.error || 'the bulk read returned no rows');
        return false;
      }
      _bulk = r.body; _bulkErr = null;
      return true;
    });
  }

  // Absences are read-only unless mark_requested is sent, and it never is from
  // here: flipping a SKU to 'requested' is a claim that somebody actually asked
  // the brand, and no button on this panel does that.
  function loadAbsences() {
    return post('/api/mapping/absences', {}).then(function (r) {
      if (!r.ok || !r.body || !Array.isArray(r.body.absences)) {
        _absBySku = null; _absErr = r.error || 'no absence report';
        _absCount = null; _absConfirmed = null; _absNote = null;
        return;
      }
      var by = {};
      r.body.absences.forEach(function (a) { if (a && a.sku) { by[a.sku] = a; } });
      _absBySku = by; _absErr = null;
      _absCount = r.body.count; _absConfirmed = r.body.confirmed; _absNote = r.body.note;
    });
  }

  // THE THIRD STATE, AND WHY IT IS THE ONLY READ HERE THAT IS NOT A POST.
  // /api/mapping/unlooked is served on GET and ONLY on GET (wmdemo/server.py:
  // 1194) -- the server made that choice deliberately so a public deployment,
  // where do_POST refuses anything without the write token, can still show what
  // it has not looked at. Routing it through W.HW_LIVE.post would 404 it. So it
  // goes out as a plain same-origin fetch, exactly like /api/state does, and it
  // is the one thing on this board that still answers when the token is missing.
  //
  // Its failure is NOT allowed to look like an empty result. _unlBySku stays
  // null on a failure and rows() then leaves every SKU in nomatch, which is the
  // old lie -- so the panel says out loud that it could not ask, rather than
  // letting 108 rows quietly re-acquire a word that is false.
  function loadUnlooked() {
    return fetch(base + '/api/mapping/unlooked', { credentials: 'omit', cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) { throw new Error('HTTP ' + res.status); }
        return res.json();
      })
      .then(function (j) {
        if (!j || !Array.isArray(j.skus)) { throw new Error('not this API'); }
        var by = {};
        j.skus.forEach(function (r) { if (r && r.sku) { by[r.sku] = r; } });
        _unlBySku = by; _unlErr = null;
        _unlBrands = Array.isArray(j.brands) ? j.brands : null;
        _unlCount = j.count; _unlNote = j.note || null;
      })
      .catch(function (e) {
        _unlBySku = null; _unlBrands = null; _unlCount = null; _unlNote = null;
        _unlErr = (e && e.message) || 'unreachable';
      });
  }

  // /api/state carries two facts nothing else serves: menu_state (did we ever
  // push this SKU, and did Weedmaps hand back an item id) and the event log —
  // the ONLY place a human rejection is visible to a client. It is a ~100KB read
  // and hw-live.js is already polling the same route; that duplication is real
  // and is named in the WHY block rather than hidden.
  function loadState() {
    return fetch(base + '/api/state', { credentials: 'omit', cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) { throw new Error('HTTP ' + res.status); }
        return res.json();
      })
      .then(function (j) {
        if (!j || !Array.isArray(j.events)) { throw new Error('not this API'); }
        _wmids = j.wmids || null;

        // external_id is 'hyperwolf:sku:' + sku (wmdemo/catalog.py:207). Matched
        // by suffix rather than by rebuilding the prefix here, so a server that
        // changes SKU_PREFIX does not silently turn every row into "never
        // pushed" — the one failure mode that would look like clean data.
        var by = {};
        (j.menu || []).forEach(function (row) {
          var ext = String(row.external_id == null ? '' : row.external_id);
          var i = ext.lastIndexOf(':');
          var sku = i < 0 ? ext : ext.slice(i + 1);
          if (!sku) { return; }
          var pid = null;
          try { pid = JSON.parse(row.last_payload || '{}').product_id; } catch (e) { pid = null; }
          (by[sku] = by[sku] || []).push({
            wm_menu_id: row.wm_menu_id, published: row.published,
            wm_item_id: row.wm_item_id, last_pushed_at: row.last_pushed_at,
            product_id: pid == null ? null : pid
          });
        });
        _menuBySku = by;

        // THE STICKY REJECTION, AND WHY IT IS INFERRED RATHER THAN READ.
        // mapping.reject() writes 'rejected' into the mapping_events table
        // (wmdemo/mapping.py:902-907) and NO endpoint serves that table. The
        // only client-visible trace is the dashboard log line the route also
        // writes (wmdemo/server.py:825). So: newest-first scan, first verdict
        // per SKU wins, which is the same last-event-wins rule the server's own
        // sticky check uses. Its limits are stated on the row and in the WHY —
        // this never claims a rejection it cannot see, and it never shows one
        // for a SKU that now has a mapping.
        var RX = /^mapping (approved|rejected|unmapped) (\S+)/;
        var v = {}, n = 0, oldest = null;
        j.events.forEach(function (e) {
          var msg = String(e && e.message || '');
          if (e && e.ts && (oldest == null || e.ts < oldest)) { oldest = e.ts; }
          var m = RX.exec(msg);
          if (!m) { return; }
          n++;
          if (v[m[2]]) { return; }              // newest-first: first hit wins
          var reason = /\(([^)]*)\)/.exec(msg);
          var byWho = / by (\S+)/.exec(msg);
          v[m[2]] = { action: m[1], ts: e.ts, reason: reason ? reason[1] : null,
                      by: byWho ? byWho[1] : null };
        });
        _verdicts = v; _evCount = n; _evHorizon = oldest;
        _stateErr = null;
      })
      .catch(function (e) {
        _menuBySku = null; _verdicts = null; _evHorizon = null; _evCount = 0;
        _stateErr = (e && e.message) || 'unreachable';
      });
  }

  function load() {
    _settled = false;
    var timer = setTimeout(function () {
      if (!_settled) { _status = 'slow'; paint(); }
    }, TIMEOUT_MS);
    _busy = true; paint();
    // Four independent reads, settled independently. A failed absence report
    // must not blank the board, and a failed board must not be disguised by a
    // good absence report — each one's failure is shown where that data was
    // going to be.
    return Promise.all([loadBulk(), loadState(), loadAbsences(), loadUnlooked()]).then(function (r) {
      clearTimeout(timer);
      _settled = true; _busy = false;
      _status = r[0] ? 'live'
        : (!W.HW_LIVE || typeof W.HW_LIVE.post !== 'function') ? 'no-write-path'
        : 'unreachable';
      publishToHW();
      paint();
      return _status;
    }).catch(function () {
      clearTimeout(timer);
      _settled = true; _busy = false;
      _status = 'unreachable';
      paint();
      return _status;
    });
  }

  function loadCandidates(sku) {
    _candSku = sku; _candStatus = 'pending'; _cands = null; _candErr = null;
    paint();
    // include_excluded defaults true server-side and is sent explicitly: THE
    // LOSERS ARE THE POINT. A ranked list with the guard-excluded rows quietly
    // removed cannot be disagreed with, and every one of them carries the name
    // of the guard that removed it.
    return post('/api/mapping/candidates',
                { sku: sku, query: _candQuery || null, limit: 12, include_excluded: true })
      .then(function (r) {
        if (_candSku !== sku) { return; }        // a later click won
        if (!r.ok || !r.body || !Array.isArray(r.body.candidates)) {
          _candStatus = 'error';
          _candErr = r.error || 'no candidates in the response';
        } else {
          _cands = r.body; _candStatus = 'live';
        }
        paint();
      });
  }

  // ── writes ───────────────────────────────────────────────────────────────
  // Each one shows the server's OWN reason on failure rather than swallowing it.
  function write(path, body, said) {
    _busy = true; _msg = null; paint();
    return post(path, body).then(function (r) {
      _busy = false;
      if (!r.ok) {
        _msgOk = false;
        _msg = 'Refused' + (r.code ? ' (' + r.code + ')' : '') + ': ' + (r.error || 'no reason given');
        paint();
        // The code and the body ride out with the failure. approve() needs both
        // to tell a claim conflict (409, and the server names the holder) from
        // every other refusal — returning a bare {ok:false} threw away the one
        // thing that makes the next press possible.
        return { ok: false, code: r.code, body: r.body, error: r.error };
      }
      _msgOk = true; _msg = said;
      return load().then(function () {
        if (_openSku) { return loadCandidates(_openSku); }
      }).then(function () { return { ok: true, body: r.body }; });
    }).catch(function (e) {
      _busy = false; _msgOk = false;
      _msg = 'Request failed: ' + (e && e.message ? e.message : 'unknown');
      paint();
      return { ok: false };
    });
  }

  // `force` is the many-to-one override wmdemo/server.py:1259 reads. It is NEVER
  // sent on its own initiative: it is passed only after a person has been shown
  // the incumbent SKU by name and said yes. Two ways in, and both of them ask —
  //   1. the candidate row was labelled CLAIMED, and onClick() confirms first;
  //   2. the row was NOT labelled (the list was fetched before the claim
  //      existed) and the server refuses with 409. The refusal carries
  //      `conflict_with` and `retry_with:{force:true}`, so the same question is
  //      asked at that point rather than leaving the operator at a dead end.
  function approve(sku, wmId, force) {
    var body = { sku: sku, wm_id: Number(wmId) };
    if (force) { body.force = true; }
    return write('/api/mapping/approve', body,
                 sku + ' → WM #' + wmId +
                 (force ? ' (FORCED second claim, manual override, tier 0)'
                        : ' (manual override, tier 0)'))
      .then(function (res) {
        if (force || res.ok || res.code !== 409) { return res; }
        var holder = res.body && res.body.conflict_with;
        if (!holder) { return res; }
        if (!W.confirm('WM #' + wmId + ' is already claimed by ' + holder + '.\n\n' +
                       'This screen did not know that when it drew the list — the claim was made ' +
                       'after it was fetched.\n\nApprove anyway? ' + sku + ' and ' + holder +
                       ' would then BOTH point at WM #' + wmId + '. Weedmaps does not enforce a ' +
                       'unique external_id, so this is how duplicate listings get made. It is ' +
                       'sometimes right — but it is your call, not the machine’s.')) {
          return res;
        }
        return approve(sku, wmId, true);
      });
  }
  function reject(sku, reason) {
    return write('/api/mapping/reject', { sku: sku, reason: reason || 'no_match' },
                 sku + ' rejected — sticky until the product itself changes');
  }
  function unmap(sku) {
    return write('/api/mapping/unmap', { sku: sku },
                 sku + ' unlinked — the mapping row is kept as audit, the catalog link is cleared');
  }
  function pull() {
    // The route defaults to source 'fixture' (wmdemo/server.py:800) and this
    // sends nothing else, so the button never silently reaches for the live WM
    // partner API. The label says which one it is.
    return write('/api/mapping/pull', {}, 'brand feed re-pulled');
  }
  // ── the bulk path ────────────────────────────────────────────────────────
  // THE ROWS THIS IS ALLOWED TO TOUCH, and the reason the list is derived here
  // rather than passed in: READY means the SERVER's own verdict was `exact` or
  // `auto` on this load (rows() reads suggestion.decision, which is
  // wmdemo/mapping.py decide()'s word). This function therefore approves
  // nothing the engine did not already say it was confident about — it is a
  // batch of the one-click buttons that are already on those rows, not a
  // lowered bar. It cannot approve a REVIEW row, a queued row or a claimed one.
  function readyRows() {
    return rows().filter(function (x) {
      return x.state === 'ready' && x.suggestion && x.suggestion.wm_id != null;
    });
  }

  // Sequential, spaced, and it NEVER sends force. Three separate decisions:
  //
  //   Sequential — each approve is a write against one sqlite file and the
  //   claim check is read-then-write; firing N of them at once is how two rows
  //   both pass the check and both claim one WM product. The server's own
  //   nightly loop is sequential for the same reason.
  //
  //   Spaced — 120ms between writes. This is a real partner-backed service on
  //   a container that idles out; a burst of 40 writes is the shape that gets
  //   a client throttled.
  //
  //   Never force — a 409 means another SKU already holds that WM product.
  //   approve(force) exists and is deliberately NOT reachable from here: a
  //   many-to-one is a judgement about two of OUR products being duplicates,
  //   and a batch button is exactly where nobody is looking. Refusals are
  //   COUNTED AND NAMED, and the row keeps its own single-approve button where
  //   the conflict is drawn and the question is asked.
  function approveAllReady() {
    var list = readyRows();
    if (!list.length) { return Promise.resolve({ ok: 0, refused: 0 }); }
    if (!W.confirm('Approve ' + list.length + ' mapping(s) the engine is already confident about?\n\n' +
                   'These are the rows marked READY — the server\u2019s own verdict on this load was ' +
                   '\u201cexact\u201d or \u201cauto\u201d, and each one already has a single Approve ' +
                   'button on it. This presses them one at a time.\n\n' +
                   'It sends NO force flag: any Weedmaps product another SKU already claims will be ' +
                   'refused and listed for you, not overwritten. Nothing in the review queue, nothing ' +
                   'rejected and nothing unmatched is touched.')) {
      return Promise.resolve({ ok: 0, refused: 0, cancelled: true });
    }
    _bulkRun = { done: 0, total: list.length, ok: 0, refused: 0, notes: [] };
    _busy = true; _msg = null; paint();

    var i = 0;
    function step() {
      if (i >= list.length) { return Promise.resolve(); }
      var x = list[i++];
      return post('/api/mapping/approve', { sku: x.sku, wm_id: Number(x.suggestion.wm_id) })
        .then(function (r) {
          _bulkRun.done++;
          if (r.ok) { _bulkRun.ok++; }
          else {
            _bulkRun.refused++;
            var holder = r.body && r.body.conflict_with;
            _bulkRun.notes.push(x.sku + ' → #' + x.suggestion.wm_id + ': ' +
              (holder ? 'already claimed by ' + holder + ' — approve it on the row if you mean to double up'
                      : (r.error || ('refused' + (r.code ? ' (' + r.code + ')' : '')))));
          }
          paint();
          return new Promise(function (res) { setTimeout(res, 120); }).then(step);
        });
    }

    return step().then(function () {
      var run = _bulkRun;
      _bulkRun = null;
      return load().then(function () {
        _busy = false;
        _msgOk = run.refused === 0;
        _msg = 'Approved ' + run.ok + ' of ' + run.total +
          (run.refused ? ' · ' + run.refused + ' refused: ' + run.notes.join(' · ')
                       : ' · none refused') +
          '. Each is a manual override at tier 0, recorded against you.';
        paint();
        return { ok: run.ok, refused: run.refused, notes: run.notes };
      });
    }).catch(function (e) {
      _bulkRun = null; _busy = false; _msgOk = false;
      _msg = 'Bulk approve stopped: ' + (e && e.message ? e.message : 'unknown') +
             '. Everything already approved stayed approved — press Re-read the board.';
      paint();
      return { ok: 0, refused: 0 };
    });
  }

  // Read-only: rescore never writes a mapping (wmdemo/mapping.py:1038-1040).
  function rescore(sku) {
    _busy = true; _msg = null; paint();
    return post('/api/mapping/rescore', { sku: sku }).then(function (r) {
      _busy = false;
      if (!r.ok || !r.body) {
        _msgOk = false; _msg = 'Re-score failed: ' + (r.error || 'no reason given');
      } else {
        _fresh[sku] = { decision: r.body.decision, wm_id: r.body.suggested_wm_id,
                        score: r.body.score, note: r.body.note, at: Date.now() / 1000 };
        _msgOk = true;
        _msg = sku + ': ' + r.body.decision +
               (r.body.suggested_wm_id ? ' → #' + r.body.suggested_wm_id : '') +
               ' (' + scoreText(r.body.score) + ')';
      }
      paint();
      return r;
    });
  }

  // ── the one handle on window.HW ──────────────────────────────────────────
  // A PROPERTY WRITE on the object pos/data.jsx published, never
  // `window.HW = ...` — five modules capture window.HW.fmt.money at module
  // scope and a reassignment leaves them bound to a dead object.
  //
  // AND NOTHING ELSE IS TOUCHED. hw-live.js already downgrades an unmapped
  // SKU's Weedmaps pill with the right sentence (hw-live.js:518-521), so this
  // seam does not write to window.HW.PRODUCTS at all. Two seams overwriting one
  // `wm.issue` string is a race in which the surviving message is whichever
  // fetch happened to land last — the catalog and this board would then
  // disagree in a way nobody could reproduce.
  function publishToHW() {
    if (!_hw || !_bulk) { return; }
    _hw.WM_MAPPING = {
      rows: rows(),
      counts: counts(),
      absences: _absBySku ? Object.keys(_absBySku).map(function (k) { return _absBySku[k]; }) : null,
      // The third state, mirrored too — a POS screen reading WM_MAPPING must be
      // able to tell "we looked and found nothing" from "we never looked", or
      // it reproduces this panel's own bug one layer up.
      unlooked: _unlBySku ? Object.keys(_unlBySku).map(function (k) { return _unlBySku[k]; }) : null,
      unlookedBrands: _unlBrands,
      unlookedError: _unlErr,
      wmCached: _bulk.wm_cached == null ? null : _bulk.wm_cached,
      eventHorizon: _evHorizon,
      source: base + '/api/mapping/bulk'
    };
  }

  var _tries = 0;
  function waitForHW() {
    if (W.HW) { _hw = W.HW; publishToHW(); return; }
    if (_tries++ > 200) { return; }         // ~30s, then give up quietly
    setTimeout(waitForHW, 150);
  }

  // ── panel ────────────────────────────────────────────────────────────────
  function chip(P, t, text) {
    return '<span style="display:inline-block;padding:2px 7px;border-radius:' + P.r999 + 'px;' +
      'background:' + t.bg + ';color:' + t.fg + ';font-size:' + P.type.micro + 'px;font-weight:800;' +
      'letter-spacing:.06em">' + esc(text) + '</span>';
  }

  // THE SERVER'S OWN ACCOUNT OF ITS SCORING PASS, quoted, never inferred.
  // /api/mapping/bulk returns a `suggestions` block naming the mode it ran in,
  // whether the answer came from its cache and how old that is, and how many
  // of the SKUs it actually reached. Every sentence on this panel about the
  // freshness or completeness of a verdict is built HERE, from those fields,
  // so there is exactly one place to check when the wording and the payload
  // disagree. An older server that does not send the block gets an honest "it
  // did not say", not a cheerful default.
  function passSentence() {
    var sg = _bulk && _bulk.suggestions;
    if (!sg) { return 'The server did not report how its scoring pass ran.'; }
    if (sg.rescored === false) {
      return 'This read did not re-score: suggestions shown come from the open review queue only.';
    }
    var bits = [];
    bits.push(sg.brand_scoped
      ? 'The pass scored each SKU against its own brand\u2019s catalogue' +
        (sg.wm_candidates != null ? ' out of ' + sg.wm_candidates + ' mirrored products' : '')
      : 'The pass scored every SKU against the whole mirror' +
        (sg.wm_candidates != null ? ' (' + sg.wm_candidates + ' products)' : ''));
    if (sg.complete === false) {
      bits.push('IT DID NOT FINISH: ' + sg.scored + ' of ' + sg.requested +
                ' SKUs were scored before it hit its ' + sg.budget_s +
                's budget (' + (sg.stopped_reason || 'stopped') + ')');
    } else if (sg.scored != null) {
      bits.push('all ' + sg.scored + ' of ' + sg.requested + ' SKUs were scored');
    }
    if (sg.cached) {
      bits.push('this answer came from the server\u2019s cache, ' +
                Math.round(Number(sg.cache_age_s || 0)) + 's old, and is recomputed ' +
                'the moment the mirror or the catalogue changes');
    }
    return bits.join('; ') + '.';
  }

  function note(P, s) {
    return '<div style="display:flex;gap:7px;font-size:' + P.type.meta + 'px;color:' + P.inkDim +
      ';line-height:1.45;margin-bottom:5px"><span style="color:' + P.inkFaint + '">·</span><span>' +
      esc(s) + '</span></div>';
  }

  function ctlCSS(P) {
    return 'height:' + P.ctrlH.sm + 'px;border-radius:' + P.r8 + 'px;border:1px solid ' +
      P.hairline2 + ';background:' + P.surface2 + ';color:' + P.ink + ';font-size:' +
      P.type.meta + 'px;padding:0 8px;';
  }

  function btn(P, attr, act, sku, label, wm, extra) {
    return '<button ' + attr + '="' + act + '" data-sku="' + esc(sku) + '"' +
      (wm == null ? '' : ' data-wm="' + esc(wm) + '"') + (extra || '') + ' style="' + ctlCSS(P) +
      'height:28px;cursor:pointer;font-family:' + P.fontSans + ';font-weight:600">' +
      esc(label) + '</button>';
  }

  function mono(P, s, colour) {
    return '<span style="font-family:' + ff(P.fontMono) + ';color:' + (colour || P.ink2) + '">' +
      esc(s) + '</span>';
  }

  // ── the claim, drawn where the choice is made ────────────────────────────
  // /api/mapping/candidates has always returned `conflict_with` plus
  // `holder_tier`, `holder_status` and `holder_decided_by` on any candidate a
  // different SKU already holds live (wmdemo/mapping.py:2124-2127). NOTHING
  // RENDERED THEM. So a claimed row looked exactly like a free one — same
  // weight, same colour, `excluded: null` — the operator picked it, pressed
  // Approve, and was refused at the last click with a 409 for a reason that was
  // fully knowable before they clicked. Two QA probes walked into that and read
  // it as a product bug.
  //
  // THE ROW IS NOT HIDDEN AND NOT RE-RANKED, and that is deliberate on both
  // sides of the wire (mapping.py:2100-2105). A many-to-one is a real thing an
  // operator may legitimately want — approve() takes force:true for exactly
  // that — and filtering the row out removes the one fact they need to make
  // the call. These are duplicates in OUR OWN catalogue; a machine that quietly
  // picks a winner hides that from the only person who can fix it. Detect and
  // surface, never decide.
  // The brand, named the way the SERVER named it and never invented. The
  // unlooked report carries `wm_brand_id` (which may be null when we could not
  // resolve one at all) and `brand`, our own vendor name. A null brand id is a
  // DIFFERENT problem from an unpulled feed — nobody can pull a feed for a
  // brand we have not identified — and the two are worded apart.
  function brandPhrase(u) {
    if (!u) { return 'this SKU\u2019s brand feed'; }
    var ours = u.brand ? '\u201c' + u.brand + '\u201d' : 'this SKU\u2019s brand';
    if (u.wm_brand_id == null) {
      return ours + ', which has NO Weedmaps brand id on our side at all, so there is no feed to pull yet';
    }
    return ours + ' (Weedmaps brand ' + u.wm_brand_id + ')';
  }

  // How many of OUR SKUs sit behind the same unpulled feed. Counted from the
  // brand rollup the server sent, not re-derived from the rows: the rollup is
  // the report's own arithmetic and a second count here could disagree with the
  // number printed at the top of the same panel.
  function unlookedSiblings(u) {
    if (!u || !_unlBrands) { return 1; }
    for (var i = 0; i < _unlBrands.length; i++) {
      var b = _unlBrands[i];
      if (b && b.wm_brand_id === u.wm_brand_id) { return b.skus; }
    }
    return 1;
  }

  // NAMING A BRAND WE HAVE NEVER PULLED. The server's rollup carries `name`
  // from wm_brand_feeds — WEEDMAPS' name for the brand — and for a feed that
  // was never pulled there is no such row, so it is null. Falling back to OUR
  // vendor name off the SKU rows is more useful than printing a bare id, but
  // the two are NOT the same fact and the label says which one it is: our name
  // is what we would search Weedmaps FOR, not what Weedmaps calls it.
  function unlookedBrandLabel(b) {
    if (!b) { return 'unknown brand'; }
    if (b.name) { return b.name + ' (WM brand ' + b.wm_brand_id + ')'; }
    if (b.wm_brand_id == null) {
      return 'no Weedmaps brand id on our side — cannot be pulled at all yet';
    }
    var ours = null;
    if (_unlBySku) {
      var keys = Object.keys(_unlBySku);
      for (var i = 0; i < keys.length && !ours; i++) {
        var r = _unlBySku[keys[i]];
        if (r && r.wm_brand_id === b.wm_brand_id && r.brand) { ours = r.brand; }
      }
    }
    return (ours ? 'our “' + ours + '”' : 'brand') + ' → WM brand ' + b.wm_brand_id;
  }

  var claimOf = function (c) {
    return c && c.conflict_with != null && c.conflict_with !== '' ? String(c.conflict_with) : null;
  };

  // The holder's own row, in the server's words. Every field is printed only
  // when the server sent it — a missing tier is not drawn as tier 0.
  function holderBits(c) {
    var bits = [];
    if (c.holder_status) { bits.push(String(c.holder_status)); }
    if (c.holder_tier != null) { bits.push('tier ' + c.holder_tier); }
    if (c.holder_decided_by) { bits.push('by ' + c.holder_decided_by); }
    return bits.join(' · ');
  }

  function claimHTML(P, c, held) {
    var bits = holderBits(c);
    return '<div data-hwm-claim="' + esc(c.wm_id) + '" style="font-size:' + P.type.micro +
      'px;color:' + P.warn + ';line-height:1.45;margin:0 0 4px;padding:4px 7px;border-radius:' +
      P.r8 + 'px;background:' + P.warnSoft + '">Already claimed by <b style="font-family:' +
      ff(P.fontMono) + '">' + esc(held) + '</b>' + (bits ? ' (' + esc(bits) + ')' : '') +
      '. Approving it here points <b>two of our SKUs</b> at one Weedmaps product. Weedmaps does not ' +
      'enforce a unique external_id, so that is how duplicate listings get made — but it is ' +
      'sometimes the right call, so the row is shown rather than hidden. The button sends ' +
      '<b>force</b> and asks you first.</div>';
  }

  // One candidate. The score is printed as a number AND drawn as a bar, and the
  // bar is NEVER coloured by a threshold of ours — T_AUTO and T_AI are not
  // served, so a green bar here would be this file guessing at the engine's
  // opinion. The engine's opinion is the word above the list.
  function candHTML(P, c, rank, ourSku) {
    var out = c.excluded != null;
    var held = claimOf(c);
    var pct = c.score == null ? 0 : Math.max(2, Math.min(100, Math.round(c.score * 100)));
    var h = '<div data-hwm-cand="' + esc(c.wm_id) + '" style="border-top:1px solid ' +
      (held ? P.warn : P.hairline) + ';padding:7px 0">';
    h += '<div style="display:flex;gap:7px;align-items:baseline">' +
      '<span style="font-family:' + ff(P.fontMono) + ';font-size:' + P.type.micro + 'px;color:' +
      P.inkFaint + ';flex:0 0 auto">' + rank + '</span>' +
      '<span style="flex:1 1 auto;min-width:0;font-size:' + P.type.body + 'px;font-weight:' +
      (out ? '500' : '700') + ';color:' + (out ? P.inkMute : P.ink) + '">' + esc(c.name || '(unnamed)') +
      '</span>' +
      (c.exact ? chip(P, { fg: P.good, bg: P.goodSoft }, 'EXACT') : '') +
      (held ? chip(P, { fg: P.warn, bg: P.warnSoft }, 'CLAIMED BY ' + held) : '') + '</div>';

    h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkFaint + ';font-family:' +
      ff(P.fontMono) + ';margin:1px 0 4px">#' + esc(c.wm_id) + ' · ' + esc(c.category || 'no category') +
      ' · ' + esc(wt(c.weight) || 'no weight') +
      (c.items_per_pack ? ' · ' + esc(c.items_per_pack) + '-pack' : '') +
      (c.strain ? ' · ' + esc(c.strain) : '') + '</div>';

    // Before the button, because it is the thing that decides whether pressing
    // it is a good idea.
    if (held) { h += claimHTML(P, c, held); }

    h += '<div style="display:flex;gap:7px;align-items:center">' +
      '<div style="flex:1 1 auto;height:4px;border-radius:' + P.r999 + 'px;background:' +
      P.hairline + ';overflow:hidden"><div style="width:' + pct + '%;height:100%;background:' +
      (out ? P.inkFaint : P.ink2) + '"></div></div>' +
      '<span style="flex:0 0 auto;font-family:' + ff(P.fontMono) + ';font-size:' + P.type.micro +
      'px;color:' + (out ? P.inkMute : P.ink2) + '">' + esc(scoreText(c.score)) + '</span>' +
      btn(P, 'data-hwm', 'approve', ourSku,
          held ? 'Approve as a 2nd claim' : out ? 'Approve anyway' : 'Approve', c.wm_id,
          held ? ' data-holder="' + esc(held) + '"' : '') + '</div>';

    if (out) {
      // WHY THE RUNNER-UP LOST, in the server's own vocabulary. An operator who
      // cannot see this cannot disagree with the machine — and this is exactly
      // where they are most likely to be right and it wrong.
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.warn +
        ';line-height:1.4;margin-top:3px">Excluded by the <b>' + esc(c.excluded) +
        '</b> guard, so it scores 0 whatever it looks like. Approving it overrides that guard ' +
        'and records you as the reviewer.</div>';
    }
    return h + '</div>';
  }

  function drawerHTML(P, x) {
    var h = '<div style="margin-top:8px;padding:8px 9px;border-radius:' + P.r8 +
      'px;background:' + P.surface + ';border:1px solid ' + P.hairline2 + '">';

    // The engine's own verdict, quoted. Re-scoring replaces it with a fresher
    // one and says so, rather than the two silently blending.
    var f = _fresh[x.sku];
    var sug = x.suggestion;
    if (f) {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.45">' +
        '<b>Re-scored ' + esc(ago(f.at)) + ':</b> ' + esc(f.decision) +
        (f.wm_id ? ' → #' + esc(f.wm_id) : '') + ' · ' + esc(scoreText(f.score)) +
        (f.note ? ' — “' + esc(f.note) + '”' : '') + '</div>';
    } else if (sug) {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.45">' +
        '<b>Engine says “' + esc(sug.decision) + '”</b>' +
        (sug.wm_id ? ' → #' + esc(sug.wm_id) : '') + ' · ' + esc(scoreText(sug.score)) +
        (sug.note ? ' — “' + esc(sug.note) + '”' : '') + '</div>';
    } else {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';line-height:1.45">' +
        'The bulk read carried no engine verdict for this SKU. Re-score to ask for one.</div>';
    }

    // WHAT THE SEARCH BOX IS ACTUALLY SEARCHING. On an unlooked SKU the pool is
    // every brand feed we HAVE pulled, and this SKU's brand is not one of them —
    // so an operator can search all day and never see their own product. Saying
    // so here is the difference between a search that found nothing and a search
    // that was never given anything to find.
    if (x.unlooked) {
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.info + ';line-height:1.45;' +
        'margin-top:6px;padding:5px 7px;border-radius:' + P.r8 + 'px;background:' + P.infoSoft + '">' +
        esc('The search below looks at the ' +
            (_bulk && _bulk.wm_cached != null ? _bulk.wm_cached + ' cached Weedmaps products'
                                              : 'cached Weedmaps products') +
            ' we already hold. ' + brandPhrase(x.unlooked) + ' is NOT among them, so this SKU\u2019s ' +
            'own product cannot appear here however you spell it. You can still bind it to a product ' +
            'from another brand deliberately — that is a real decision and the button is live — but ' +
            'an empty result here is not evidence of anything.') + '</div>';
    }

    h += '<div style="display:flex;gap:6px;margin:7px 0 3px">' +
      '<input data-hwm-q value="' + esc(_candQuery) + '" placeholder="filter their catalog: name, strain, 3.5g…" ' +
      'style="' + ctlCSS(P) + 'height:28px;flex:1 1 auto;min-width:0;font-family:' + P.fontSans + '">' +
      btn(P, 'data-hwm', 'search', x.sku, 'Search') +
      btn(P, 'data-hwm', 'rescore', x.sku, 'Re-score') + '</div>';

    if (_candStatus === 'pending') {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';padding:6px 0">' +
        'Asking ' + esc(base) + '/api/mapping/candidates…</div>';
    } else if (_candStatus === 'error') {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.bad + ';line-height:1.45;padding:6px 0">' +
        'No candidate list: ' + esc(_candErr) + '</div>';
    } else if (_cands) {
      var list = _cands.candidates || [];
      var claimed = list.filter(function (c) { return claimOf(c); }).length;
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkFaint + ';margin-top:4px">' +
        esc(list.length) + ' shown of ' + esc(_cands.total) + ' in their catalog' +
        (_candQuery ? ' matching “' + esc(_candQuery) + '”' : '') +
        ' · ranked by the engine, losers included' +
        // Counted, not filtered. The count is here so an operator scanning the
        // list knows to expect the labels below; the rows themselves stay in
        // their engine-given order.
        (claimed ? '<span style="color:' + P.warn + ';font-weight:700"> · ' + esc(claimed) +
          ' already claimed by another SKU of ours</span>' : '') + '</div>';
      if (!list.length) {
        h += '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 + ';line-height:1.45;padding:6px 0">' +
          esc(x.unlooked
            ? 'Nothing matches — and for this SKU that means nothing, because the pool searched does ' +
              'not contain its brand. This is not the absence ledger and it is not evidence.'
            : 'Nothing in the Weedmaps brand feed matches that search. That is not proof they do not ' +
              'carry it — see the absence ledger, which is the only thing here allowed to say that.') +
          '</div>';
      }
      list.forEach(function (c, i) { h += candHTML(P, c, i + 1, x.sku); });
    }

    if (x.state !== 'linked' && x.state !== 'rejected') {
      h += '<div style="border-top:1px solid ' + P.hairline + ';padding-top:7px;margin-top:4px">' +
        btn(P, 'data-hwm', 'reject', x.sku, 'None of these — reject') +
        '<span style="font-size:' + P.type.micro + 'px;color:' + P.inkFaint +
        ';margin-left:7px">sticky: the matcher stops reconsidering this SKU until the product changes</span></div>';
    }
    return h + '</div>';
  }


  // ── the re-point control ─────────────────────────────────────────────────
  // TWO SIDES, DRAWN FROM THE MIRROR ONLY, AND NEVER APPLIED BY THIS FILE.
  //
  // The failure this exists for is a mapping onto a Weedmaps product id we have
  // never pulled. The obvious "fix" is to read the digits out of our own SKU
  // (SLUG-BB-629491 → 629491) and re-point to them. That is the SAME class of
  // error in the opposite direction: the SKU is a string WE wrote, and the whole
  // reason this row is wrong is that something already treated one unverified
  // field as authoritative. So the server offers the digits as a labelled
  // WITNESS, this panel prefills the box with them and says where they came
  // from, and a person presses the button.
  function loadRepoint(sku, target) {
    _rpSku = sku; _rpStatus = 'pending'; _rp = null; _rpErr = null;
    paint();
    var body = { sku: sku };
    if (target != null && String(target).trim() !== '') {
      body.wm_id = Number(String(target).trim());
    }
    return post('/api/mapping/repoint-preview', body).then(function (r) {
      if (_rpSku !== sku) { return; }               // a later click won
      if (!r.ok || !r.body) {
        _rpStatus = 'error';
        _rpErr = r.error || 'no preview in the response';
      } else {
        _rp = r.body; _rpStatus = 'live';
        // The box follows the server, so what is shown is what would be sent.
        _rpTarget = (_rp.proposed && _rp.proposed.wm_id != null)
          ? String(_rp.proposed.wm_id) : '';
      }
      paint();
    });
  }

  // The write. ONE route, which itself calls mapping.approve() — this panel
  // does not have a second path to product_mappings and must never grow one.
  //
  // Two refusals are expected and both are questions, not dead ends:
  //   target_not_in_mirror — we have never pulled the product being aimed at,
  //                          so nothing here can show it. Legitimate when the
  //                          operator has Weedmaps open in front of them.
  //   claim_conflict       — another SKU of ours already holds it.
  // Neither flag is ever sent on this file's own initiative.
  function repoint(sku, wmId, opts) {
    opts = opts || {};
    var body = { sku: sku, wm_id: Number(wmId) };
    if (opts.force) { body.force = true; }
    if (opts.confirmUnmirrored) { body.confirm_unmirrored = true; }
    if (opts.note) { body.note = opts.note; }
    var prev = _rp && _rp.current_mapping ? _rp.current_mapping.wm_id : null;
    return write('/api/mapping/repoint', body,
                 sku + ': ' + (prev == null ? 'unmapped' : 'WM #' + prev) +
                 ' → WM #' + wmId + ' (manual override, tier 0' +
                 (opts.force ? ', FORCED second claim' : '') +
                 (opts.confirmUnmirrored ? ', target NOT in our mirror' : '') +
                 '). The previous id is in the event record.')
      .then(function (res) {
        if (res.ok || res.code !== 409 || !res.body) {
          if (res.ok && _rpSku === sku) { loadRepoint(sku, wmId); }
          return res;
        }
        var code = res.body.code;
        if (code === 'target_not_in_mirror' && !opts.confirmUnmirrored) {
          if (!W.confirm('WM #' + wmId + ' is NOT in our Weedmaps mirror.\n\n' +
                         'We have never pulled it, so nothing on this screen can show you its ' +
                         'Weedmaps name, brand, weight or category — you would be approving a ' +
                         'product this system cannot see. That is exactly the state you are here ' +
                         'to fix.\n\nIf you are reading Weedmaps directly and know this id is ' +
                         'right, press OK. Otherwise cancel and pull that brand’s feed first.')) {
            return res;
          }
          return repoint(sku, wmId, { force: opts.force, confirmUnmirrored: true, note: opts.note });
        }
        if (code === 'claim_conflict' && !opts.force) {
          var holder = res.body.conflict_with;
          if (!W.confirm('WM #' + wmId + ' is already claimed by ' + holder + '.\n\n' +
                         'Re-point anyway? ' + sku + ' and ' + holder + ' would then BOTH point at ' +
                         'WM #' + wmId + '. Weedmaps does not enforce a unique external_id, so this ' +
                         'is how duplicate listings get made — and it is sometimes exactly ' +
                         'what you want. Your call, not the machine’s.')) {
            return res;
          }
          return repoint(sku, wmId, { force: true, confirmUnmirrored: opts.confirmUnmirrored, note: opts.note });
        }
        return res;
      });
  }

  // ONE SIDE OF THE COMPARISON. An unmirrored side renders NO product fields —
  // not an em-dash, not "unknown" in the name slot, nothing that could be read
  // across from the other column as if the two were being compared. It renders
  // the reason instead.
  function sideHTML(P, title, side, extra) {
    var known = side && (side.mirror === 'present' || side.mirror === 'delisted');
    var t = !side || side.mirror === 'none'
      ? { fg: P.inkDim, bg: P.neutralSoft, word: 'NO ID' }
      : side.mirror === 'present' ? { fg: P.good, bg: P.goodSoft, word: 'IN OUR MIRROR' }
      : side.mirror === 'delisted' ? { fg: P.warn, bg: P.warnSoft, word: 'DELISTED BY WEEDMAPS' }
      : { fg: P.bad, bg: P.badSoft, word: 'NOT IN OUR MIRROR' };
    var h = '<div style="flex:1 1 220px;min-width:0;border:1px solid ' + t.fg +
      ';border-radius:' + P.r8 + 'px;padding:7px 8px;background:' + P.surface2 + '">' +
      '<div style="display:flex;gap:6px;align-items:baseline;justify-content:space-between">' +
      '<span style="font-size:' + P.type.micro + 'px;font-weight:800;letter-spacing:.06em;color:' +
      P.inkFaint + '">' + esc(title) + '</span>' + chip(P, t, t.word) + '</div>' +
      '<div style="font-family:' + ff(P.fontMono) + ';font-size:' + P.type.micro + 'px;color:' +
      P.inkFaint + ';margin-top:2px">' +
      (side && side.wm_id != null ? '#' + esc(side.wm_id) : 'no weedmaps id') + '</div>';

    if (known) {
      h += '<div style="font-size:' + P.type.body + 'px;font-weight:700;color:' + P.ink +
        ';margin-top:4px;line-height:1.35">' + esc(side.name || '(no name on the mirrored row)') + '</div>';
      // Every one of these four is the mirrored Weedmaps value. A null renders
      // as the words "not on the mirrored row", never as a blank that reads
      // like agreement with the other column.
      [['brand', side.brand_name], ['category', side.category],
       ['weight', wt(side.weight) || null], ['strain', side.strain]
      ].forEach(function (kv) {
        h += '<div style="font-size:' + P.type.micro + 'px;color:' +
          (kv[1] == null ? P.inkFaint : P.ink2) + ';line-height:1.5">' +
          '<span style="color:' + P.inkFaint + '">' + esc(kv[0]) + ': </span>' +
          esc(kv[1] == null ? 'not on the mirrored row' : kv[1]) + '</div>';
      });
    } else {
      h += '<div style="font-size:' + P.type.meta + 'px;color:' + t.fg +
        ';line-height:1.45;margin-top:5px">' + esc(side ? side.why : 'nothing to show') + '</div>';
    }
    return h + (extra || '') + '</div>';
  }

  // ── DUPLICATE ROWS ON WEEDMAPS ───────────────────────────────────────────
  // THE PREMISE OF THIS WHOLE CONTROL CHANGED, and this is where it lands.
  //
  // It was built to fix what looked like a mismapping: SLUG-BB-629491 mapped
  // onto WM #634042 while our own SKU string names 629491. Paging the full
  // Sluggers Hit feed (brand 28588, meta.total 236) read-only on 2026-08-27
  // showed BOTH ids live, both published, identical on name, categories and
  // strain. WEEDMAPS CARRIES THE SAME PRODUCT TWICE. There was never a
  // mismapping to fix — 634042 only looked wrong because our mirror held page
  // one of that brand and not the page carrying it.
  //
  // It is not a one-off: that single brand carries EIGHT duplicate groups, one
  // of them a triple (629494 / 634043 / 860002). BD-F-35G and DD-FL-NULLINV-35
  // reached "review: near-duplicate" for the same underlying reason.
  //
  // So the sentence owed to an operator is "Weedmaps lists this product twice
  // and you are on one of them", and the wrong sentence — the one that was
  // here — sends somebody to correct something that is not broken, by making
  // a real write against a live listing.
  //
  // AND THE DUPLICATES ARE NOT INTERCHANGEABLE. Same live read: #634042 carries
  // msrp 16.00 USD and #629491 carries none. The "obvious fix" of re-pointing
  // to the id our SKU names would have moved us from the priced row to the
  // unpriced one. That is drawn loudest of all, because it is the one thing
  // here that can quietly cost money.
  function dupeFramingTone(P, key) {
    if (key === 'choice_between_duplicates') { return { fg: P.warn, bg: P.warnSoft, word: 'WEEDMAPS LISTS THIS PRODUCT MORE THAN ONCE' }; }
    if (key === 'different_products')        { return { fg: P.ink2, bg: P.neutralSoft, word: 'TWO DIFFERENT PRODUCTS' }; }
    return { fg: P.info, bg: P.infoSoft, word: 'WE CANNOT TELL YET' };
  }

  // One duplicate group. `d` is null when that side is NOT IN OUR MIRROR — and
  // that is rendered as "we have never looked", never as "no duplicates". The
  // two are the same pixels and opposite facts, which is the defect this whole
  // file exists to stop repeating.
  function dupeHTML(P, title, d, sideMirror) {
    var h = '<div style="margin-top:6px">' +
      '<div style="font-size:' + P.type.micro + 'px;font-weight:800;letter-spacing:.06em;color:' +
      P.inkFaint + '">' + esc(title) + '</div>';
    if (!d) {
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.info + ';line-height:1.45;margin-top:3px">' +
        esc(sideMirror === 'none'
          ? 'No Weedmaps id on this side, so there is nothing to look for duplicates of.'
          : 'NOT CHECKED. This product has no row in our mirror, so we could not look for ' +
            'duplicates of it. This is not "no duplicates found" — it is the same "we never ' +
            'looked" that made this control necessary.') + '</div>';
      return h + '</div>';
    }
    if (!d.group.length) {
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.ink2 + ';line-height:1.45;margin-top:3px">' +
        esc('No other row in our mirror shares this product\u2019s name.') + '</div>';
    } else {
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.ink2 + ';line-height:1.5;margin-top:3px">' +
        esc('Weedmaps carries ' + (d.group.length + 1) + ' rows under this name: #' + d.wm_id +
            ' (this one) plus ' + d.group.map(function (g) { return '#' + g.wm_id; }).join(', ') +
            '.') + '</div>';
      d.group.forEach(function (g) {
        var same = g.relation === 'identical';
        h += '<div style="font-size:' + P.type.micro + 'px;line-height:1.5;margin-top:3px;padding:4px 6px;' +
          'border-radius:' + P.r8 + 'px;background:' + P.surface2 + ';border-left:2px solid ' +
          (same ? P.warn : P.info) + '">' +
          '<span style="font-family:' + ff(P.fontMono) + ';color:' + P.ink + '">#' + esc(g.wm_id) + '</span> ' +
          '<span style="color:' + (same ? P.warn : P.info) + ';font-weight:700">' +
          esc(same ? 'IDENTICAL on ' + d.compared_on.join(', ')
                   : 'NEAR-DUPLICATE — differs on ' + g.differs.join(', ')) + '</span>' +
          (g.delisted ? '<span style="color:' + P.warn + '"> \u00b7 delisted by Weedmaps</span>' : '') +
          (g.claimed_by ? '<span style="color:' + P.ink2 + '"> \u00b7 already claimed by ' +
             esc(g.claimed_by) + '</span>' : '');
        // THE PART THAT COSTS MONEY IF IT IS MISSED.
        (g.differs_beyond_identity || []).forEach(function (f) {
          h += '<div style="color:' + (f.decides ? P.bad : P.inkFaint) + ';line-height:1.45">' +
            esc((f.decides ? 'NOT INTERCHANGEABLE \u2014 ' : '') + f.field + ': #' + d.wm_id +
                ' has ' + (f.current == null ? 'none' : f.current) + ', #' + g.wm_id +
                ' has ' + (f.other == null ? 'none' : f.other)) +
            (f.decides ? '' : ' (context, not a difference in what customers see)') + '</div>';
        });
        h += '</div>';
      });
      if (d.interchangeable === false) {
        h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.bad + ';line-height:1.45;margin-top:3px">' +
          esc('These are the same product and NOT the same listing. Moving between them changes ' +
              'what Weedmaps shows \u2014 check the field(s) named above before you press ' +
              'anything.') + '</div>';
      }
    }
    // HOW MUCH OF THE BRAND WE ACTUALLY SAW. An empty group over a partly
    // mirrored brand means nothing, and saying so is the entire lesson of this
    // ticket: #634042 was invisible because we held page 1 of 12.
    var sc = d.scan || {};
    if (sc.complete !== true) {
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.info + ';line-height:1.45;margin-top:3px">' +
        esc('Scan coverage: ' + (sc.why || 'unknown') +
            ' A duplicate on a page we never pulled would not be listed above.') + '</div>';
    }
    h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkFaint + ';line-height:1.4;margin-top:3px">' +
      esc(d.not_compared_note || '') + '</div>';
    return h + '</div>';
  }

  function repointHTML(P, x) {
    var h = '<div style="margin-top:8px;padding:8px 9px;border-radius:' + P.r8 +
      'px;background:' + P.surface + ';border:1px solid ' + P.hairline2 + '">' +
      '<div style="font-size:' + P.type.micro + 'px;font-weight:800;letter-spacing:.06em;color:' +
      P.inkFaint + ';margin-bottom:6px">RE-POINT THIS MAPPING</div>';

    if (_rpStatus === 'pending') {
      return h + '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + '">Asking ' +
        esc(base) + '/api/mapping/repoint-preview…</div></div>';
    }
    if (_rpStatus === 'error' || !_rp) {
      return h + '<div style="font-size:' + P.type.meta + 'px;color:' + P.bad + ';line-height:1.45">' +
        esc('No preview: ' + (_rpErr || 'the server did not answer') +
            '. NOTHING is offered to press — a re-point button with no preview behind it ' +
            'is the same blind approval this control exists to remove.') + '</div></div>';
    }

    // FRAMING FIRST, because it changes how the two boxes below are read.
    // Two identical Weedmaps rows are not a mistake anybody made.
    if (_rp.framing) {
      var ft = dupeFramingTone(P, _rp.framing);
      h += '<div style="margin-bottom:7px;padding:6px 8px;border-radius:' + P.r8 +
        'px;background:' + ft.bg + ';border-left:3px solid ' + ft.fg + '">' +
        '<div style="font-size:' + P.type.micro + 'px;font-weight:800;letter-spacing:.05em;color:' +
        ft.fg + '">' + esc(ft.word) + '</div>' +
        '<div style="font-size:' + P.type.meta + 'px;color:' + P.ink2 +
        ';line-height:1.45;margin-top:2px">' + esc(_rp.framing_note || '') + '</div></div>';
    }

    h += '<div style="display:flex;gap:7px;flex-wrap:wrap">' +
      sideHTML(P, 'MAPPED NOW', _rp.current) +
      sideHTML(P, 'PROPOSED', _rp.proposed,
        _rp.conflict_with
          ? '<div style="font-size:' + P.type.micro + 'px;color:' + P.warn +
            ';line-height:1.4;margin-top:5px">Already claimed by <b>' + esc(_rp.conflict_with) +
            '</b> (tier ' + esc(_rp.holder_tier) + ', ' + esc(_rp.holder_status) + ', ' +
            esc(_rp.holder_decided_by) + ').</div>'
          : '') +
      '</div>';

    // WHAT AGREES — only when both sides are actually readable. `agreement:null`
    // is NOT "no differences found"; the server says so in words and they are
    // printed rather than paraphrased.
    if (_rp.agreement) {
      var ks = Object.keys(_rp.agreement);
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.ink2 +
        ';line-height:1.6;margin-top:6px;font-family:' + ff(P.fontMono) + '">' +
        ks.map(function (k) {
          var v = _rp.agreement[k];
          // Tri-state, from the server's own weights_equal(): true / false /
          // null-meaning-one-side-has-no-value. A null must not print as "no".
          return '<span style="color:' + (v === true ? P.good : v === false ? P.bad : P.inkFaint) +
            '">' + esc(k) + ': ' + esc(v === true ? 'same' : v === false ? 'DIFFERENT' : 'not comparable') +
            '</span>';
        }).join('<br>') + '</div>';
    } else {
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.bad +
        ';line-height:1.45;margin-top:6px">' + esc(_rp.agreement_note || '') + '</div>';
    }

    // THE DUPLICATE GROUPS, one per side.
    if (_rp.duplicates) {
      h += dupeHTML(P, 'OTHER WEEDMAPS ROWS FOR THE PRODUCT MAPPED NOW',
                    _rp.duplicates.current, _rp.current && _rp.current.mirror);
      h += dupeHTML(P, 'OTHER WEEDMAPS ROWS FOR THE PROPOSED PRODUCT',
                    _rp.duplicates.proposed, _rp.proposed && _rp.proposed.mirror);
    }

    // The SKU-string witness, labelled as what it is.
    if (_rp.sku_id_witness) {
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkDim +
        ';line-height:1.45;margin-top:6px;padding:5px 7px;border-radius:' + P.r8 +
        'px;background:' + P.surface2 + '">' + esc(
          'Our own SKU string names #' + _rp.sku_id_witness.wm_id + '. ' +
          _rp.sku_id_witness.authority) + '</div>';
    }

    // The next action, when there is no evidence to decide on at all.
    if (_rp.next_action) {
      var na = _rp.next_action;
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.info +
        ';line-height:1.45;margin-top:6px;padding:5px 7px;border-radius:' + P.r8 +
        'px;background:' + P.infoSoft + '">' + esc(
          'Next action: pull the brand feed for ' +
          (na.brand_name ? '“' + na.brand_name + '”' : 'this SKU’s brand') +
          (na.brand_id == null
            ? ' — except we have NO Weedmaps brand id for it, so there is no feed to pull yet. ' +
              'That has to be set before either side of this can be read.'
            : ' (Weedmaps brand ' + na.brand_id +
              (na.brand_id_source ? ', resolved from ' + na.brand_id_source : '') + '). ') +
          ' Until then neither column above can be read on evidence.') + '</div>';
    }

    h += '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;align-items:center">' +
      '<input data-hwm-rp value="' + esc(_rpTarget) + '" placeholder="weedmaps product id" ' +
      'style="' + ctlCSS(P) + 'height:28px;width:150px;font-family:' + ff(P.fontMono) + '">' +
      btn(P, 'data-hwm', 'rp-preview', x.sku, 'Preview') +
      btn(P, 'data-hwm', 'rp-apply', x.sku,
          'Apply re-point' + (_rp.decidable ? '' : ' anyway…')) + '</div>';

    h += '<div style="font-size:' + P.type.micro + 'px;color:' +
      (_rp.decidable ? P.inkDim : P.bad) + ';line-height:1.45;margin-top:5px">' + esc(
        _rp.decidable
          ? 'Applying writes through the same approve() every other button here uses: sticky, ' +
            'tier 0, recorded as a manual override by you, and refused if another SKU already ' +
            'holds that product. The PREVIOUS Weedmaps id is written into the event record, so ' +
            'this is reversible — it is the first field of that record and it is not truncated.'
          : 'This is NOT decidable from what we hold: ' + (_rp.blocked_by || 'unknown reason') +
            '. The button is still live — an operator reading Weedmaps directly may know ' +
            'better than our mirror does — but it will ask you to confirm that you are ' +
            'approving a product this system cannot show you.') + '</div>';
    return h + '</div>';
  }

  function rowHTML(P, x) {
    var t = tone(P, x.state);
    var h = '<div style="border:1px solid ' + (x.state === 'linked' ? P.hairline : t.fg) +
      ';border-left:3px solid ' + t.fg + ';border-radius:' + P.r8 + 'px;padding:8px 9px;margin-bottom:7px;' +
      'background:' + (x.state === 'rejected' ? 'transparent' : P.surface2) + '">';

    h += '<div style="display:flex;gap:8px;align-items:baseline;justify-content:space-between">' +
      '<div style="flex:1 1 auto;min-width:0;font-size:' + P.type.strong + 'px;font-weight:700;color:' +
      (x.state === 'rejected' ? P.inkMute : P.ink) + '">' + esc(x.name || x.sku) + '</div>' +
      chip(P, t, t.word) + '</div>';

    h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkFaint + ';font-family:' +
      ff(P.fontMono) + ';margin-top:1px">' + esc(x.sku) + ' · ' + esc(x.category || 'no category') +
      (wt(x.weight) ? ' · ' + esc(wt(x.weight)) : '') + '</div>';

    // The sentence. What this state MEANS, and whose move it is next.
    var says, colour = t.fg;
    if (x.state === 'linked') {
      says = 'Linked to Weedmaps product #' + x.mapping.wm_id +
        (x.mapping.manual_override ? ' by a person' : ' by the engine') +
        ' (tier ' + x.mapping.tier + (x.mapping.score == null ? '' : ', score ' + scoreText(x.mapping.score)) + ').';
      colour = P.ink2;
    } else if (x.state === 'unmirrored') {
      says = 'This SKU is mapped to Weedmaps product #' + x.mapping.wm_id +
        ' and THERE IS NO SUCH PRODUCT IN OUR MIRROR. We have never pulled it, so nothing on ' +
        'this screen can tell you its Weedmaps name, brand, weight or category — and the mapping ' +
        'was still written' +
        (x.mapping.manual_override ? ' by a person' : ' by the engine') +
        ' at tier ' + x.mapping.tier +
        (x.mapping.score == null ? '' : ' with score ' + scoreText(x.mapping.score)) +
        '. That score was not computed against anything we hold. This is NOT proof the product ' +
        'does not exist on Weedmaps — it is proof we cannot see it, which is a different fact ' +
        'and a different next move.';
    } else if (x.state === 'ready') {
      says = 'The engine is confident: “' + (x.suggestion.decision) + '” at ' +
        scoreText(x.suggestion.score) + '. Nothing has approved it, so this SKU has NO Weedmaps ' +
        'product behind it and cannot be verified there. One click below fixes it.';
    } else if (x.state === 'review') {
      says = x.queued
        ? 'In the review queue (' + (x.queueReason || 'no reason recorded') + '). The engine will not decide this one.'
        : 'The engine landed in the escalation band — good enough to be interesting, not good enough to map. A person decides.';
    } else if (x.state === 'rejected') {
      says = 'A person looked and said no' + (x.verdict.reason ? ' (' + x.verdict.reason + ')' : '') + '. ' +
        'STICKY: re-running the matcher will not re-queue it until the product itself changes. ' +
        'Approving a candidate is what clears it.';
    } else if (x.state === 'absent') {
      says = 'Weedmaps does not carry this. Confirmed across ' + x.absence.checks +
        ' distinct catalogue pulls, first seen ' + x.absence.days_absent + ' days ago. ' +
        'THIS IS NOT OUR WORK — it is a line in a message to the brand.';
    } else if (x.state === 'unlooked') {
      // THE SENTENCE THIS WHOLE STATE EXISTS FOR. It must not contain the word
      // "score" as a verdict: the score is real but it is the score of an empty
      // pool, and quoting it as evidence is the falsehood being removed.
      says = 'WE HAVE NOT LOOKED. Weedmaps serves products per BRAND, and ' +
        brandPhrase(x.unlooked) + ' has never been pulled' +
        (x.unlooked.brand_feed_status ? ' (feed status “' + x.unlooked.brand_feed_status + '”' +
          (x.unlooked.brand_feed_size != null ? ', ' + x.unlooked.brand_feed_size +
            ' products cached' : '') + ')' : '') +
        '. So this SKU was scored against a candidate pool that does not contain ' +
        'its brand at all' +
        (x.suggestion && x.suggestion.score != null
          ? ' — the ' + scoreText(x.suggestion.score) + ' below is the score of that empty pool, not a judgement on this product'
          : '') +
        '. Nothing can be concluded here until that one feed is pulled.';
      colour = P.info;
    } else {
      // "A REAL MISS" IS A CLAIM, AND IT HAS A PRECONDITION. It is only true
      // because /api/mapping/unlooked answered and did NOT list this SKU. When
      // that read failed, _unlBySku is null, every unlooked SKU falls back into
      // this branch, and asserting the feed was pulled would put the original
      // falsehood back on the screen in stronger words. So the sentence is
      // conditioned on the read, and says "cannot tell" when it cannot tell.
      says = 'Nothing in their catalog scored well enough' +
        (x.suggestion && x.suggestion.score != null ? ' (best ' + scoreText(x.suggestion.score) + ')' : '') +
        '. ' + (_unlBySku
          ? 'Their brand feed WAS pulled and this SKU is not on the never-looked list, so this is a ' +
            'real miss — still not the same as Weedmaps not having it. See below.'
          : 'WHETHER WE EVER PULLED THIS BRAND\u2019S FEED IS UNKNOWN on this load — ' +
            '/api/mapping/unlooked did not answer, and it is the only thing that knows. This word ' +
            'may be wrong: an empty candidate pool scores exactly like a bad match.');
    }
    h += '<div style="font-size:' + P.type.meta + 'px;line-height:1.45;margin-top:5px;color:' +
      colour + '">' + esc(says) + '</div>';

    // LINKED IS NOT PUBLISHED. Said on the row, because the owner's question is
    // "is it verified on Weedmaps" and a link is only the first of three things
    // that have to be true.
    if (x.state === 'linked') {
      var pub;
      if (!x.listings) {
        pub = 'Never pushed to a listing — we hold the link, Weedmaps has never been told.';
      } else if (!x.accepted) {
        pub = 'Pushed to ' + x.listings + ' listing(s) ' + ago(x.lastPush) +
          ', and NOT ONE came back with an item id. Weedmaps has not confirmed it.';
      } else {
        pub = 'Pushed and accepted on ' + x.accepted + ' of ' + x.listings + ' listing(s), last ' +
          ago(x.lastPush) + '. That is our record of the last push, not proof it is on the menu now.';
      }
      h += '<div style="font-size:' + P.type.micro + 'px;color:' +
        (x.accepted ? P.inkDim : P.warn) + ';line-height:1.4;margin-top:4px">' + esc(pub) + '</div>';
      if (x.driftIds.length) {
        h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.bad +
          ';line-height:1.4;margin-top:3px">THE LISTING DISAGREES WITH THIS SCREEN: the last payload ' +
          'we pushed carried product id ' + esc(x.driftIds.join(', ')) + ', not #' + esc(x.mapping.wm_id) +
          '. Re-push to make Weedmaps match the mapping shown here.</div>';
      }
    }

    // MIRROR STATE, said on every linked row that is not already the state.
    // 'delisted' is a real and separate thing to say: we HELD this product and
    // Weedmaps stopped returning it. And when the server could not read its own
    // mirror, that is said too rather than passed over as if it were healthy.
    if (x.linked && x.state !== 'unmirrored') {
      if (x.mirrorKnown === false) {
        h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.info +
          ';line-height:1.4;margin-top:4px">' + esc(
            'Whether Weedmaps product #' + x.mapping.wm_id + ' is in our mirror at all is UNKNOWN ' +
            'on this load — the server could not read wm_products. This row is not being called ' +
            'healthy; it is being called unchecked.') + '</div>';
      } else if (x.mirrorKnown === null) {
        // A DIFFERENT SENTENCE, because it is a different fact and a different
        // fix. Nothing tried and failed here: the server never sent the field.
        // Saying "the server could not read wm_products" would be this panel
        // inventing an outage; saying nothing at all is what it used to do,
        // and that drew this row as a checked, healthy mapping.
        h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.info +
          ';line-height:1.4;margin-top:4px">' + esc(
            'This server did not report a mirror state for WM #' + x.mapping.wm_id +
            ' at all — the field is ABSENT from its response, not false. Nothing has checked ' +
            'whether we hold that product, so this row is drawn exactly as it was before that ' +
            'check existed. It is not evidence of a healthy mapping. Update the server, or ' +
            'read the mapping directly.') + '</div>';
      } else if (x.mirror === 'delisted') {
        h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.warn +
          ';line-height:1.4;margin-top:4px">' + esc(
            'We hold Weedmaps product #' + x.mapping.wm_id + ' in our mirror, but Weedmaps has ' +
            'STOPPED returning it. What we show for it is the last copy we pulled, not what is on ' +
            'their menu now.') + '</div>';
      }
    }

    // A 'suspected' absence is evidence, not a verdict, and it is only shown
    // where it changes what you would do next.
    if (x.absence && x.state !== 'absent') {
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkDim + ';line-height:1.4;margin-top:4px">' +
        'Absence ledger: ' + esc(x.absence.state) + ' after ' + esc(x.absence.checks) +
        ' look(s) — not yet enough to tell a brand anything.</div>';
    }
    // NO VERDICT IS NOT A NEGATIVE VERDICT, said on the row, because the row is
    // where the operator decides. Drawn in `info` like NEVER LOOKED and never
    // in the red of NO CONFIDENT MATCH.
    if (x.state === 'unscored') {
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.info +
        ';line-height:1.45;margin-top:4px;padding:5px 7px;border-radius:' + P.r8 +
        'px;background:' + P.infoSoft + '">' + esc(
          'The server\u2019s scoring pass stopped before it reached this SKU (' +
          x.suggestionStatus + '), so there is NO verdict here \u2014 not a negative one. ' +
          passSentence() + ' Nothing about this product has been ruled out. Press ' +
          'Candidates to score this one SKU on its own.') + '</div>';
    }
    if (x.state === 'nomatch' && !x.absence) {
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + (_unlBySku ? P.inkDim : P.bad) +
        ';line-height:1.4;margin-top:4px">' + esc(
          'The absence ledger has NO entry for this SKU, so nobody has established that Weedmaps ' +
          'lacks it. That entry is written by the nightly pass, across two distinct feed pulls.' +
          (_unlBySku ? '' : ' And the never-looked report is down, so this row\u2019s state is the ' +
            'panel\u2019s fallback, not a verdict.')) + '</div>';
    }
    // THE WORK IS ON THE BRAND, NOT ON THE ROW — said on the row, because the
    // row is where the operator is standing when they need to know that
    // clicking Candidates here will not help them.
    if (x.state === 'unlooked') {
      var sibs = unlookedSiblings(x.unlooked);
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.info +
        ';line-height:1.45;margin-top:4px;padding:5px 7px;border-radius:' + P.r8 +
        'px;background:' + P.infoSoft + '">Next action is <b>not on this row</b>: pull ' +
        esc(brandPhrase(x.unlooked)) + '. That clears ' +
        esc(sibs > 1 ? 'all ' + sibs + ' of our SKUs under it' : 'this SKU') +
        ' in one go. Nothing on this panel pulls a brand feed — brand→Weedmaps-brand binding is ' +
        'the upstream screen, and this board will not pretend a Candidates search substitutes for it. ' +
        'The search below is still open, and it looks at the feeds we DO hold.</div>';
    } else if (x.unlooked) {
      // Not the state, but still true and still load-bearing: the pool this row
      // was scored against was missing its own brand.
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.info + ';line-height:1.4;margin-top:4px">' +
        esc('Its brand feed has still never been pulled (' + brandPhrase(x.unlooked) +
            '), so whatever is above was decided without a single product from this SKU\u2019s own brand in the pool.') +
        '</div>';
    }

    // Controls.
    h += '<div style="display:flex;gap:6px;margin-top:7px;flex-wrap:wrap;align-items:center">';
    if (x.state === 'ready' && x.suggestion && x.suggestion.wm_id) {
      h += btn(P, 'data-hwm', 'approve', x.sku,
               'Approve #' + x.suggestion.wm_id, x.suggestion.wm_id);
    }
    h += btn(P, 'data-hwm', 'cands', x.sku,
             _openSku === x.sku ? 'Hide candidates' : (x.linked ? 'Change…' : 'Candidates'));
    // THE RE-POINT CONTROL. Offered on every linked row, not only the broken
    // one: "this mapping is aimed at the wrong product" is a thing an operator
    // discovers about a perfectly mirrored row too.
    if (x.linked) {
      h += btn(P, 'data-hwm', 'repoint', x.sku,
               _rpSku === x.sku ? 'Hide re-point' : 'Re-point\u2026');
      h += btn(P, 'data-hwm', 'unmap', x.sku, 'Unlink');
    }
    h += '</div>';

    if (_rpSku === x.sku) { h += repointHTML(P, x); }
    if (_openSku === x.sku) { h += drawerHTML(P, x); }
    return h + '</div>';
  }

  function filterBar(P, c) {
    var defs = [
      ['all', 'All ' + c.total],
      ['decide', 'To decide ' + (c.ready + c.review)],
      ['linked', 'Linked ' + c.linked],
      ['rejected', 'Rejected ' + c.rejected],
      ['nomatch', 'No match ' + c.nomatch],
      // '?' not '0'. A zero here would be the same lie in miniature: on a failed
      // read the count is UNKNOWN, and 0 reads as "none".
      ['unlooked', 'Never looked ' + (_unlErr ? '?' : c.unlooked)],
      ['absent', 'Not on WM ' + c.absent]
    ];
    // Conditional, unlike every other chip: NOT SCORED is a state the server
    // only produces when its bulk pass ran out of time budget, which should
    // never happen. A permanent 0 chip would train the eye to skip it.
    if (c.unscored) { defs.splice(5, 0, ['unscored', 'Not scored ' + c.unscored]); }
    // UNCONDITIONAL, unlike NOT SCORED. A zero here is a real, checkable
    // statement — "no live mapping points at a product we have never pulled" —
    // and it is exactly the number that was silently 0-by-omission before.
    // `?` when the server could not read its own mirror OR never reported one,
    // never 0. BOTH have to be here: a server that does not send
    // wm_mirror_known at all makes every linked row unreportable, `unmirrored`
    // is then structurally 0, and a chip reading "Not in our mirror 0" is this
    // panel publishing a checked-looking zero for a check that never ran.
    defs.splice(1, 0, ['unmirrored',
      'Not in our mirror ' +
      ((c.mirrorUnknowable || c.mirrorUnreported) && !c.unmirrored ? '?' : c.unmirrored)]);
    return '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:9px">' +
      defs.map(function (d) {
        var on = _filter === d[0];
        return '<button data-hwm="filter" data-f="' + d[0] + '" style="height:24px;padding:0 8px;' +
          'border-radius:' + P.r999 + 'px;cursor:pointer;font-family:' + P.fontSans + ';font-size:' +
          P.type.micro + 'px;font-weight:700;border:1px solid ' + (on ? P.ink : P.hairline2) +
          ';background:' + (on ? P.ink : P.surface2) + ';color:' + (on ? P.surface : P.ink2) + '">' +
          esc(d[1]) + '</button>';
      }).join('') + '</div>';
  }

  // THE BULK BAR IS NEVER SILENT. A button that only appears when there is
  // work is indistinguishable, on the day there is none, from a feature that
  // was never built — and this board's whole failure mode is a state you cannot
  // tell from another state. So: the button when there are READY rows, and the
  // reason there is no button when there are not, with the numbers that make it
  // checkable.
  function bulkBar(P, c) {
    var n = readyRows().length;
    if (_bulkRun) {
      return '<div style="border:1px solid ' + P.accentText + ';background:' + P.highlightSoft +
        ';border-radius:' + P.r8 + 'px;padding:8px 9px;margin-bottom:9px;font-size:' + P.type.meta +
        'px;color:' + P.accentText + ';line-height:1.45;font-family:' + ff(P.fontMono) + '">' +
        esc('Approving ' + _bulkRun.done + ' of ' + _bulkRun.total + '… ' + _bulkRun.ok +
            ' approved, ' + _bulkRun.refused + ' refused. One write at a time, 120ms apart, no force.') +
        '</div>';
    }
    if (n) {
      return '<div style="border:1px solid ' + P.accentText + ';background:' + P.highlightSoft +
        ';border-radius:' + P.r8 + 'px;padding:8px 9px;margin-bottom:9px">' +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
        '<button data-hwm="bulk" style="' + ctlCSS(P) + 'height:32px;cursor:pointer;font-weight:800;' +
        'font-family:' + P.fontSans + ';border-color:' + P.accentText + ';color:' + P.accentText + '">' +
        esc('Approve all ' + n + ' the engine is confident about') + '</button>' +
        '<span style="font-size:' + P.type.micro + 'px;color:' + P.accentText + '">' +
        esc('one click instead of ' + n) + '</span></div>' +
        '<div style="font-size:' + P.type.micro + 'px;color:' + P.accentText +
        ';line-height:1.45;margin-top:5px">Only the READY rows — the server\u2019s own verdict on ' +
        'this load was “exact” or “auto”. One write at a time, 120ms apart, and <b>no force flag</b>: ' +
        'a Weedmaps product another SKU already claims is refused and named, never overwritten. ' +
        'Review, rejected and never-looked rows are untouched.</div></div>';
    }
    if (!c.total || c.total === c.linked) { return ''; }
    return '<div style="font-size:' + P.type.micro + 'px;color:' + P.inkDim + ';line-height:1.45;' +
      'margin-bottom:9px">' + esc(
        'No bulk approve is offered: 0 of the ' + (c.total - c.linked) + ' unlinked SKUs are READY, ' +
        'so there is nothing a batch could press. ' +
        (c.unlooked
          ? c.unlooked + ' of them were never looked at, and no amount of re-scoring creates a ' +
            'candidate for a brand feed that was never pulled. The button returns by itself the ' +
            'moment those feeds land and the engine starts coming back confident.'
          : 'The engine is not confident about any of them, so every one is a human decision.')) +
      '</div>';
  }

  function panelHTML(P) {
    if (_status !== 'live') {
      var why =
        _status === 'off' ? 'This seam is switched off.'
        : _status === 'pending' ? 'Asking ' + base + '/api/mapping/bulk…'
        : _status === 'slow' ? 'Still waiting on ' + base + '/api/mapping/bulk after ' +
          TIMEOUT_MS + 'ms. The request was NOT aborted — it will land and this board will fill ' +
          'in. The scoring pass behind it is brand-scoped and cached on the mirror version ' +
          '(measured 3.7s cold, 0.05s warm against 17,749 mirrored products), so this wait is ' +
          'a cold container, not the pass.'
        : _status === 'no-write-path' ? 'shared/hw-live.js is not loaded on this page. Every ' +
          'request here — including the list itself, which the API serves over POST — goes ' +
          'through its write path so the token and the same-origin rule live in one place. ' +
          'Without it this panel has no way to ask anything, and will not pretend otherwise.'
        : 'No API answered at ' + base + '/api/mapping/bulk' + (_bulkErr ? ' — ' + _bulkErr : '') +
          '. Nothing on this page can map a product to Weedmaps until it does.';
      return '<div style="font-size:' + P.type.body + 'px;color:' + P.ink2 + ';line-height:1.5">' +
        esc(why) + '</div>';
    }

    var c = counts(), gate = taxonomyGate();
    var h = '<div style="font-size:' + P.type.meta + 'px;color:' + P.inkDim + ';line-height:1.5;margin-bottom:9px">' +
      'Live from ' + mono(P, base + '/api/mapping', P.inkDim) + '. ' +
      (_bulk.wm_cached == null ? 'Their catalog size was not reported by this read.'
        : 'Their brand feed holds ' + _bulk.wm_cached + ' products.') + ' ' +
      esc(passSentence()) + '</div>';

    // A PASS THAT DID NOT FINISH GETS A BANNER. Every state word below it --
    // READY, NEEDS REVIEW, NO CONFIDENT MATCH -- is derived from verdicts the
    // engine gave, and on a truncated pass some of those verdicts do not
    // exist. Saying so once, loudly, at the top is the difference between a
    // board that is incomplete and a board that is WRONG.
    var _sg = _bulk.suggestions;
    if (_sg && _sg.rescored !== false && _sg.complete === false) {
      h += '<div style="border:1px solid ' + P.warn + ';background:' + P.warnSoft +
        ';border-radius:' + P.r8 + 'px;padding:8px 9px;margin-bottom:9px;font-size:' +
        P.type.meta + 'px;color:' + P.warn + ';line-height:1.45"><b>This board is ' +
        'incomplete.</b> ' + esc('The server scored ' + _sg.scored + ' of ' +
        _sg.requested + ' SKUs and stopped (' + (_sg.stopped_reason || 'stopped') +
        '). The ' + Math.max(0, (_sg.requested || 0) - (_sg.scored || 0)) +
        ' it never reached are marked NOT SCORED YET and carry no verdict at ' +
        'all \u2014 they are not "no match".') + '</div>';
    }

    // THE HEADLINE — the owner's actual question, answered in three lines,
    // because "verified on Weedmaps" is three separate facts and only one of
    // them is a mapping.
    var short = c.total - c.linked;
    h += '<div style="border:1px solid ' + (short ? P.bad : P.good) + ';background:' +
      (short ? P.badSoft : P.goodSoft) + ';border-radius:' + P.r8 + 'px;padding:8px 9px;margin-bottom:9px">' +
      '<div style="font-size:' + P.type.title + 'px;font-weight:800;color:' + (short ? P.bad : P.good) +
      ';font-family:' + ff(P.fontMono) + '">' + esc(c.linked) + ' of ' + esc(c.total) +
      ' linked to a WM product</div>';
    h += '<div style="font-size:' + P.type.meta + 'px;color:' + (short ? P.bad : P.good) +
      ';line-height:1.45;margin-top:2px">' + esc(short ? short + ' have no Weedmaps product behind them and cannot be verified there.'
        : 'Every product has a Weedmaps product behind it.') + '</div>';

    // Link is step one of three. Steps two and three, each with its own source.
    var pubLine = _stateErr
      ? 'Publication: UNKNOWN — ' + base + '/api/state did not answer (' + _stateErr + '), and that ' +
        'is the only place the push record lives. No count is shown rather than a wrong one.'
      : c.linked === 0 ? 'Publication: nothing is linked, so nothing can have been pushed.'
      : c.accepted + ' of the ' + c.linked + ' linked were pushed and came back with a Weedmaps item id' +
        (c.neverPushed ? ' · ' + c.neverPushed + ' have never been pushed at all' : '') +
        (c.drift ? ' · ' + c.drift + ' listing(s) carry a DIFFERENT product id than the mapping' : '') +
        '. A past push is not present publication.';
    h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.ink2 + ';line-height:1.4;margin-top:5px">' +
      esc(pubLine) + '</div>';
    h += '<div style="font-size:' + P.type.micro + 'px;color:' + (gate.known && gate.blocked ? P.bad : P.inkDim) +
      ';line-height:1.4;margin-top:3px">' + esc(
        gate.known
          ? (gate.blocked
              ? gate.blocked + ' of the linked are BLOCKED by the taxonomy board — Weedmaps rejects ' +
                'them for a missing category id whatever this mapping says. Open the WM taxonomy pill.'
              : 'Taxonomy gate: none of the linked are blocked by the sub-category board.')
          : 'Taxonomy gate: not measured (' + gate.why + '). A linked SKU can still be rejected by ' +
            'Weedmaps for a missing category id, so "linked" above is not by itself "live".') +
      '</div></div>';

    // THE RE-FRAME. Directly under the headline, because the headline number is
    // the one the owner is looking at and 108 of its 142 have a cause that is
    // not "the matcher is bad".
    if (_unlErr) {
      h += '<div style="border:1px solid ' + P.bad + ';background:' + P.badSoft + ';border-radius:' +
        P.r8 + 'px;padding:8px 9px;margin-bottom:9px;font-size:' + P.type.meta +
        'px;color:' + P.bad + ';line-height:1.45">' + esc(
          'THE NEVER-LOOKED REPORT DID NOT ANSWER (' + _unlErr + '). GET ' + base +
          '/api/mapping/unlooked is the only thing that can tell an unpulled brand feed from a ' +
          'real scoring miss, so every row below that would carry NEVER LOOKED is showing NO ' +
          'CONFIDENT MATCH instead. That word is not trustworthy on this load — it is a missing ' +
          'answer being drawn as a negative one.') + '</div>';
    } else if (c.unlooked) {
      var brands = (_unlBrands || []).slice().sort(function (a, b) { return b.skus - a.skus; });
      h += '<div style="border:1px solid ' + P.info + ';background:' + P.infoSoft + ';border-radius:' +
        P.r8 + 'px;padding:8px 9px;margin-bottom:9px">' +
        '<div style="font-size:' + P.type.strong + 'px;font-weight:800;color:' + P.info + '">' +
        esc(c.unlooked) + ' of the ' + esc(c.total) + ' were never looked at</div>' +
        '<div style="font-size:' + P.type.meta + 'px;color:' + P.info + ';line-height:1.45;margin-top:2px">' +
        esc('Weedmaps serves products per BRAND. ' + brands.length + ' brand feed(s) behind these SKUs ' +
            'have never been pulled, so those SKUs were scored against a pool that does not contain ' +
            'their own brand. A 0.000 there is an EMPTY POOL, not a bad product and not a bad matcher. ' +
            'This is ' + brands.length + ' pulls of work, not ' + c.unlooked + ' rows of it.') + '</div>';
      // The rollup, because the unit of work is a brand. Top 8 by SKU count —
      // enough to see where the mass is, and the filter chip shows the rest.
      h += '<div style="margin-top:6px;font-family:' + ff(P.fontMono) + ';font-size:' + P.type.micro +
        'px;color:' + P.info + ';line-height:1.6">' +
        brands.slice(0, 8).map(function (b) {
          return esc(unlookedBrandLabel(b) +
                     '  ·  ' + b.skus + ' sku(s)  ·  feed ' + (b.why || 'never'));
        }).join('<br>') +
        (brands.length > 8 ? '<br>' + esc('+ ' + (brands.length - 8) + ' more brand(s)') : '') +
        '</div>';
      h += '<div style="font-size:' + P.type.micro + 'px;color:' + P.info + ';line-height:1.4;margin-top:5px">' +
        esc(_unlNote || '') + '</div></div>';
    }

    h += filterBar(P, c);
    h += bulkBar(P, c);

    if (_msg) {
      h += '<div style="margin-bottom:8px;font-size:' + P.type.meta + 'px;line-height:1.45;font-family:' +
        ff(P.fontMono) + ';color:' + (_msgOk ? P.ink2 : P.bad) + '">' + esc(_msg) + '</div>';
    }

    // Cheapest work first, done last. An operator opens this to clear the board,
    // and the one-click rows are the only ones that cost nothing to decide.
    var list = rows().slice().sort(function (a, b) {
      var d = ORDER[a.state] - ORDER[b.state];
      if (d) { return d; }
      return (a.category + a.name).localeCompare(b.category + b.name);
    });
    if (_filter === 'decide') {
      list = list.filter(function (x) { return x.state === 'ready' || x.state === 'review'; });
    } else if (_filter !== 'all') {
      list = list.filter(function (x) { return x.state === _filter; });
    }
    if (!list.length) {
      h += '<div style="font-size:' + P.type.body + 'px;color:' + P.ink2 + ';line-height:1.5">' +
        esc(_filter === 'unlooked' && _unlErr
          ? 'This filter cannot be answered on this load: GET /api/mapping/unlooked failed (' +
            _unlErr + '). Empty here means UNKNOWN, not zero.'
          : _filter === 'unmirrored' && c.mirrorUnknowable
          ? 'This filter cannot be answered on this load: the server could not read its own ' +
            'wm_products mirror for ' + c.mirrorUnknowable + ' linked SKU(s). Empty here means ' +
            'UNKNOWN, not zero.'
          : _filter === 'unmirrored' && c.mirrorUnreported
          ? 'This filter cannot be answered by this server at all: it reported no mirror state ' +
            'for ' + c.mirrorUnreported + ' linked SKU(s) — the field is absent from its ' +
            'response. Empty here means THE QUESTION WAS NEVER ASKED, not zero.'
          : _filter === 'unmirrored'
          ? 'No live mapping points at a Weedmaps product missing from our mirror. That is a ' +
            'real answer, checked against wm_products on this load — not an unasked question.'
          : c.total ? 'No product is in that state right now.'
          : 'The API served an empty catalog, so there is nothing to map.') + '</div>';
    }
    list.forEach(function (x) { h += rowHTML(P, x); });

    // What is still not true, said here rather than left to be discovered.
    var w = '', wn = 0;
    function w_(s) { w += note(P, s); wn++; }

    w_('THE POS CATALOG SCREEN IS UNTOUCHED. pos/screen-catalog.jsx renders its Weedmaps pill ' +
      'from hw-live.js, which already downgrades an unmapped SKU with its own sentence ' +
      '(hw-live.js:518-521). This seam deliberately writes nothing into window.HW.PRODUCTS — two ' +
      'seams overwriting one wm.issue string is a race whose winner is whichever fetch landed ' +
      'last. It publishes a read-only mirror at window.HW.WM_MAPPING instead.');

    if (_verdicts) {
      w_('A HUMAN REJECTION IS INFERRED, NOT READ. mapping.reject() records it in the ' +
        'mapping_events table (wmdemo/mapping.py:902-907) and NO endpoint serves that table. The ' +
        'only client-visible trace is the dashboard log line the route writes (server.py:825), so ' +
        'this panel scans /api/state events newest-first and takes the first verdict per SKU — the ' +
        'same last-event-wins rule the server\'s own sticky check uses. ' + _evCount +
        ' mapping verdict(s) are visible in that window, which reaches back to ' + ago(_evHorizon) + '.');
      w_('The limit of that inference, stated so nobody trusts it further than it goes: the log ' +
        'holds the last 500 events, so a rejection older than that window is INVISIBLE here and ' +
        'this board will call the SKU "no confident match" instead. It also cannot see the nightly ' +
        'job\'s own per-SKU mapping events, which log only as one summary line — so a SKU rejected ' +
        'and later auto-mapped is shown by its mapping, never by the stale rejection.');
    } else {
      w_('HUMAN REJECTIONS ARE NOT SHOWN AT ALL right now: ' + base + '/api/state did not answer (' +
        (_stateErr || 'unknown') + '), and that event log is the only client-visible trace of one. ' +
        'Any SKU a person rejected is therefore drawn as "no confident match" — the state is ' +
        'missing, not empty.');
    }

    if (_unlErr) {
      w_('THE THIRD STATE IS MISSING ON THIS LOAD. GET ' + base + '/api/mapping/unlooked did not ' +
        'answer (' + _unlErr + '), and it is the ONLY route that distinguishes a SKU whose brand ' +
        'feed was never pulled from one the matcher genuinely failed on. Every such row is showing ' +
        'NO CONFIDENT MATCH right now, which on the deployed catalogue would be wrong about 108 of ' +
        '138 rows. Treat that word as unavailable, not as a verdict.');
    } else {
      w_('NEVER LOOKED IS A SERVED FACT, NOT AN INFERENCE. GET /api/mapping/unlooked returns the ' +
        'SKUs the server has parked in its `not_looked_at` absence state, with the brand id and the ' +
        'brand feed\u2019s own status on each one (wmdemo/mapping.py:1477 unlooked_report). ' +
        (_unlCount || 0) + ' SKU(s) across ' + ((_unlBrands || []).length) + ' brand(s) on this ' +
        'load. Nothing here re-derives it and nothing here guesses a brand: a SKU with no Weedmaps ' +
        'brand id is worded as a different problem, because it is one.');
      w_('WHY 0.000 WAS NEVER A SCORE. Weedmaps serves products per brand — GET ' +
        '/partners/brands/{id}/products — so a SKU whose brand feed has not been pulled is scored ' +
        'against a pool containing none of its brand\u2019s products. The engine returns its floor, ' +
        'and this panel used to print that floor as \u201cnothing scored well enough\u201d. It was ' +
        'the panel that was wrong, not the matcher. THE FIX IS NOT TO UNSCOPE THE PULL: an unscoped ' +
        'cold boot fetches every brand\u2019s entire catalogue (~18,000 products over ~911 requests, ' +
        'measured on the deployed instance) and repeats it every time the container wakes. The unit ' +
        'of work is one brand feed, which is why this board counts brands and not rows.');
      w_('WHAT THIS PANEL STILL CANNOT DO ABOUT IT: pull a brand feed. There is no route on ' +
        '/api/mapping/* that binds one of our brands to a Weedmaps brand id, and "Re-pull feed ' +
        '(fixture)" re-reads the QA fixture — it does not widen the brand scope. So NEVER LOOKED is ' +
        'reported here and cleared elsewhere, and this board does not offer a button that would ' +
        'look like it fixed it.');
    }

    if (_absErr) {
      w_('THE ABSENCE LEDGER DID NOT ANSWER (' + _absErr + '), so no row on this board can say ' +
        'Weedmaps genuinely lacks a product. Nothing is shown as "not on WM" — that is a missing ' +
        'answer, not a negative one.');
    } else {
      w_('"Not on Weedmaps" is the ledger\'s word, never this panel\'s: ' + (_absConfirmed || 0) +
        ' confirmed of ' + (_absCount || 0) + ' tracked. ' + (_absNote || '') +
        ' A truncated feed cannot manufacture an absence — the server refuses to score one below ' +
        'half the feed size (wmdemo/mapping.py:550-560).');
    }

    w_('No threshold is re-derived here. T_AUTO and T_AI live in wmdemo/mapping.py:34-35 and are ' +
      'not served, so every verdict word on this board — exact, auto, ai, reject, queued — is the ' +
      'server\'s own, and the score bars are drawn in ink, never in a green this file decided.');

    w_('The list read is POST /api/mapping/bulk with rescore_all. It is the reason a SKU the ' +
      'nightly job has never touched still shows a candidate. ' + passSentence() + ' Until ' +
      '2026-08-27 that pass scored every SKU against every cached WM product — 2.6 million ' +
      'comparisons in one request once the mirror reached 17,749 rows — which is what was ' +
      'timing this panel out and restarting the instance. It now scores each SKU against its ' +
      'own brand\u2019s catalogue, exactly as the nightly job does, and any row it did not ' +
      'reach is drawn as NOT SCORED YET rather than as a verdict. This panel also re-reads ' +
      '/api/state, which hw-live.js is already polling: one duplicated ~100KB read per refresh, ' +
      'for the push record and the event log, neither of which any other endpoint serves.');

    w_('Still mock on this panel: nothing. Every row, score, id and verdict is served. What is ' +
      'NOT here: SKU→sub-category assignment (no HTTP route), and any way to make Weedmaps ' +
      'itself confirm a listing right now — "accepted an item id" is the strongest claim the ' +
      'API can support and is the strongest one made.');

    h += whyBlock(P, 'data-hwm', _why, w, wn);
    return h;
  }

  // pos/tokens.jsx is a text/babel script: on a cold load Babel needs seconds to
  // compile it, and the API answers sooner. So the FIRST paint often runs before
  // window.THEMES exists. Bailing out there and never trying again is how a seam
  // reports `live` with a full board behind it and renders no pill at all.
  var _waitingForTokens = false;
  function paintWhenThemed() {
    if (_waitingForTokens) { return; }
    _waitingForTokens = true;
    var tries = 0;
    (function tick() {
      if (!armed) { return; }
      if (W.THEMES && document.body) { _waitingForTokens = false; paint(); return; }
      if (tries++ > 300) { _waitingForTokens = false; return; }   // ~45s, then stop
      setTimeout(tick, 150);
    })();
  }

  function paint() {
    if (!armed) { return; }
    var P = palette();
    if (!P) { paintWhenThemed(); return; }   // no tokens yet -> wait, never a hex here
    var D = dock();
    if (!D) { paintWhenThemed(); return; }   // no document.body yet

    if (!_el) {
      _el = document.createElement('div');
      _el.id = 'hw-mapping-badge';
      _el.style.cssText = 'display:flex;pointer-events:none';
      D.tray().appendChild(_el);

      _panel = document.createElement('div');
      _panel.id = 'hw-mapping-panel';
      _panel.setAttribute('role', 'dialog');
      _panel.setAttribute('aria-label', 'Weedmaps product mapping');
      D.slot().appendChild(_panel);

      _el.addEventListener('click', onClick);
      _panel.addEventListener('click', onClick);
      // The query box is rebuilt on every repaint, so its value is kept here
      // rather than in the DOM — and typing must NOT repaint, or the caret
      // jumps to the end on every keystroke.
      _panel.addEventListener('input', function (e) {
        if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-hwm-q')) {
          _candQuery = e.target.value;
        }
        // Same rule for the re-point id box, and for the same reason: a poll or
        // a theme change repaints the panel, and a value that lives only in the
        // DOM would silently revert to the last previewed id while the operator
        // was looking at what they typed.
        if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-hwm-rp')) {
          _rpTarget = e.target.value;
        }
      });
      _panel.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') { return; }
        if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-hwm-rp')) {
          e.preventDefault();
          // Enter PREVIEWS, it never applies. The one destructive control in
          // this drawer is behind a button and a confirm, deliberately.
          if (_rpSku) { loadRepoint(_rpSku, rpInput()); }
          return;
        }
        if (!e.target || !e.target.hasAttribute || !e.target.hasAttribute('data-hwm-q')) { return; }
        e.preventDefault();
        if (_openSku) { loadCandidates(_openSku); }
      });
      _el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') { return; }
        e.preventDefault();
        toggle();
      });
      D.register(SEAM_ID, function () { if (_open) { _open = false; paint(); } });
      if (W.MutationObserver && document.body) {
        // tokens.jsx repaints document.body.style on a theme change and emits no
        // event, so the style attribute is the only signal a plain-JS module has.
        new MutationObserver(function () { if (_el) { paint(); } })
          .observe(document.body, { attributes: true, attributeFilter: ['style'] });
      }
    }

    var body = _panel.querySelector('[data-hwm-scroll]');
    if (body) { _scroll = body.scrollTop; }

    var c = counts();
    var short = _status === 'live' ? (c.total - c.linked) : 0;
    var dot = _status !== 'live' ? P.inkFaint : short ? P.bad : P.good;
    var label = _status === 'live' ? 'WM products' :
                _status === 'pending' ? 'WM products…' :
                _status === 'slow' ? 'WM products — still loading' : 'WM products (no API)';
    var detail = _status !== 'live' ? base.replace(/^https?:\/\//, '') :
      c.linked + '/' + c.total + ' linked' +
      ((c.ready + c.review) ? ' · ' + (c.ready + c.review) + ' to decide' : ' · nothing to decide');
    var sub = _status !== 'live' ? base.replace(/^https?:\/\//, '')
            : (short ? short + ' unlinked' : '');

    // The dock's collapsed summary pill speaks for all seven seams, so each
    // reports its own tone and status rather than the pill guessing from the
    // DOM. Worst tone wins; see shared/hw-seam-dock.js tone().
    if (D.report) { D.report(SEAM_ID, dot, _status, label); }
    _el.innerHTML = pillHTML(P, 'data-hwm', dot, label, sub,
      label + ' · ' + detail + ' — click for the mapping board');

    _panel.style.cssText = panelCSS(P, D, _open);
    if (!_open) { _panel.innerHTML = ''; return; }

    _panel.innerHTML = panelShell(P, 'data-hwm', 'Weedmaps products · our catalog → theirs',
      panelHTML(P),
      '<div style="display:flex;gap:6px">' +
      '<button data-hwm="refresh" style="flex:1 1 auto;min-height:' + P.ctrlH.sm +
      'px;border-radius:' + P.r8 + 'px;border:1px solid ' + P.hairline2 + ';background:' +
      P.surface2 + ';color:' + P.ink2 + ';font-family:' + P.fontSans + ';font-size:' +
      P.type.meta + 'px;font-weight:600;cursor:pointer">' +
      (_busy ? 'working…' : 'Re-read the board') + '</button>' +
      '<button data-hwm="pull" title="POST /api/mapping/pull with no source — the route defaults ' +
      'to the QA fixture (wmdemo/server.py:800). A live partner-API pull needs source:live and is ' +
      'not wired to this button." style="flex:0 0 auto;min-height:' + P.ctrlH.sm +
      'px;padding:0 9px;border-radius:' + P.r8 + 'px;border:1px solid ' + P.hairline2 + ';background:' +
      P.surface2 + ';color:' + P.ink2 + ';font-family:' + P.fontSans + ';font-size:' +
      P.type.meta + 'px;font-weight:600;cursor:pointer">Re-pull feed (fixture)</button></div>');

    body = _panel.querySelector('[data-hwm-scroll]');
    if (body) { body.scrollTop = _scroll; }
  }

  // ONE panel at a time, and never open on arrival.
  function toggle() {
    _open = !_open;
    if (_open) { var D = dock(); if (D) { D.opened(SEAM_ID); } }
    paint();
  }

  // The id actually in the box RIGHT NOW. Read from the DOM rather than kept in
  // a variable the keystrokes update: paint() re-renders the whole panel and a
  // mirrored variable is one missed event away from sending a different id from
  // the one on screen.
  function rpInput() {
    var el = _panel && _panel.querySelector ? _panel.querySelector('[data-hwm-rp]') : null;
    return el ? el.value : _rpTarget;
  }

  function onClick(e) {
    var t = e.target;
    var act = t && t.getAttribute && t.getAttribute('data-hwm');
    var sku = t && t.getAttribute && t.getAttribute('data-sku');
    if (act === 'close') { e.stopPropagation(); _open = false; paint(); return; }
    if (act === 'why') { e.stopPropagation(); _why = !_why; paint(); return; }
    if (act === 'refresh') { e.stopPropagation(); load(); return; }
    if (act === 'pull') { e.stopPropagation(); pull(); return; }
    if (act === 'bulk') { e.stopPropagation(); approveAllReady(); return; }
    if (act === 'filter') {
      e.stopPropagation();
      _filter = t.getAttribute('data-f') || 'all';
      paint();
      return;
    }
    if (act === 'cands') {
      e.stopPropagation();
      if (_openSku === sku) { _openSku = null; _cands = null; _candStatus = 'idle'; paint(); return; }
      _openSku = sku; _candQuery = '';
      loadCandidates(sku);
      return;
    }
    if (act === 'search') { e.stopPropagation(); if (sku) { loadCandidates(sku); } return; }
    if (act === 'repoint') {
      e.stopPropagation();
      if (_rpSku === sku) { _rpSku = null; _rp = null; _rpStatus = 'idle'; _rpTarget = ''; paint(); return; }
      _rpSku = sku; _rpTarget = '';
      loadRepoint(sku);                  // no target: the server prefills its witness
      return;
    }
    if (act === 'rp-preview') {
      e.stopPropagation();
      if (sku) { loadRepoint(sku, rpInput()); }
      return;
    }
    if (act === 'rp-apply') {
      e.stopPropagation();
      var tgt = rpInput();
      // The BOX is what gets sent, not the last preview: an operator who typed
      // a new id and pressed Apply without pressing Preview must not have the
      // old id written. If they disagree, re-preview first and say so.
      if (!tgt || !/^[0-9]+$/.test(String(tgt).trim())) {
        _msgOk = false;
        _msg = 'Nothing sent: give a numeric Weedmaps product id.';
        paint();
        return;
      }
      if (_rp && _rp.proposed && String(_rp.proposed.wm_id) !== String(tgt).trim()) {
        _msgOk = false;
        _msg = 'Nothing sent: the box says #' + String(tgt).trim() + ' but the preview above is ' +
               'for #' + _rp.proposed.wm_id + '. Press Preview so you are looking at what you ' +
               'would be approving.';
        paint();
        return;
      }
      if (!W.confirm('Re-point ' + sku + ' to Weedmaps product #' + String(tgt).trim() + '?\n\n' +
                     'This writes through approve(): tier 0, manual override, recorded as you. ' +
                     'The previous Weedmaps id is written into the mapping event record, so it ' +
                     'can be put back.')) { return; }
      repoint(sku, String(tgt).trim());
      return;
    }
    if (act === 'rescore') { e.stopPropagation(); if (sku) { rescore(sku); } return; }
    if (act === 'approve') {
      e.stopPropagation();
      var wm = t.getAttribute('data-wm');
      // data-holder is present only on a row the server told us is already
      // claimed. The row said so before the press; this asks once more and
      // names the incumbent, then sends force — which is the human making a
      // many-to-one deliberately, not this file deciding one is fine.
      var holder = t.getAttribute && t.getAttribute('data-holder');
      if (holder) {
        if (!W.confirm('WM #' + wm + ' is already claimed by ' + holder + '.\n\n' +
                       'Approve anyway? ' + sku + ' and ' + holder + ' would then BOTH point at ' +
                       'WM #' + wm + '. Weedmaps does not enforce a unique external_id, so this is ' +
                       'how duplicate listings get made — and it is sometimes exactly what you ' +
                       'want. Nothing is sent unless you press OK.')) { return; }
        approve(sku, wm, true);
        return;
      }
      approve(sku, wm);
      return;
    }
    if (act === 'unmap') {
      e.stopPropagation();
      // Unlinking is reversible and the API keeps the row as audit, so it asks
      // once rather than blocking behind a typed reason.
      if (!W.confirm('Unlink ' + sku + ' from its Weedmaps product?\n\n' +
                     'The mapping row is kept as an audit record and the catalog link is cleared. ' +
                     'The SKU re-enters the scoring pool.')) { return; }
      unmap(sku);
      return;
    }
    if (act === 'reject') {
      e.stopPropagation();
      // A rejection is STICKY, so it is the one action here that asks for a
      // reason: an unexplained sticky verdict is indistinguishable from an
      // accident six months later, and it is the reason the row will give.
      var reason = W.prompt('Why does no Weedmaps product match ' + sku + '?\n' +
                            'This is STICKY — the matcher stops reconsidering this SKU until the ' +
                            'product itself changes.', 'no_match');
      if (reason == null || !String(reason).trim()) { return; }
      reject(sku, String(reason).trim());
      return;
    }
    if (t && /^(SELECT|OPTION|INPUT|BUTTON)$/.test(t.tagName)) { return; }
    // A stray click inside the open panel must not close it -- only the pill
    // toggles, and only the x and Escape close.
    if (_panel && _panel.contains(t)) { return; }
    toggle();
  }

  // ── public surface ───────────────────────────────────────────────────────
  W.HW_MAPPING = {
    __armed: armed,
    get status() { return _status; },
    get rows() { return rows(); },
    get counts() { return counts(); },
    get absences() { return _absBySku; },
    get base() { return base; },
    refresh: function () {
      if (!armed) { return Promise.resolve('off'); }
      _status = 'pending'; paint();
      return load();
    },
    get unlooked() { return _unlBySku; },
    get unlookedBrands() { return _unlBrands; },
    candidates: loadCandidates,
    get repointPreview() { return _rp; },
    previewRepoint: loadRepoint,
    repoint: repoint,
    approve: approve,
    approveAllReady: approveAllReady,
    reject: reject,
    unmap: unmap,
    rescore: rescore,
    pull: pull,
    open: function () {
      var D = dock();
      if (D) { D.opened(SEAM_ID); }
      _open = true; paint();
    },
    close: function () { _open = false; paint(); },
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
    if (document.body) { paint(); }
    else { document.addEventListener('DOMContentLoaded', paint); }
    load();
  }
})();
