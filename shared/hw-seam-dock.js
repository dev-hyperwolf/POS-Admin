// Hyperwolf seam dock — the ONE bottom-left chrome column.
//
// WHAT THIS REPLACES. Six sibling seam files (hw-live-identity/-regions/
// -taxonomy/-checkin/-lines/-mapping) each carried a byte-identical copy of a
// `dock()` function, first-loader-wins. That copy is still in all six as a
// fallback; this file is loaded BEFORE them, so it wins and there is exactly one
// definition to change. Their `if (W.HW_SEAM_DOCK) { return W.HW_SEAM_DOCK; }`
// guard is what makes that safe.
//
// WHY THE TRAY SHAPE CHANGED. The six pills laid out in a wrapping ROW. Measured
// at 1920 in the demo (`no API`) state they need 271+258+265+279+322+395 = 1790px
// plus gaps plus the rail — 1,906px of viewport — so they wrapped to two rows at
// every real display size and, with the hw-live pill under them, claimed the
// bottom 126px of the content column. On the POS catalog modal that band covered
// `Confirm match` and swallowed `Unmap · use custom product` entirely.
// docs/FLOATING-UI-AUDIT.md §3.1/§3.3 has the elementFromPoint results.
//
// So: ONE always-visible summary pill (dot + label + `N seams · M live`), which
// expands into a VERTICAL, width-capped, self-scrolling tray. Vertical + capped
// is what makes wrapping structurally impossible rather than merely unlikely —
// a seventh seam cannot reintroduce the bug.
//
// UNCHANGED, DELIBERATELY: register(id, close) / opened(id) / closeAll(), the
// one-open-panel rule, the panel slot sitting ABOVE the tray in the same
// bottom-anchored column, and Escape. Those are why the identity panel is
// reachable at all (hw-live-identity.js:89) and this file must not touch them.
(function () {
  'use strict';
  var W = window;
  if (W.HW_SEAM_DOCK) { return; }

  var TRAY_KEY = 'hw-seam-tray';           // 'open' | 'closed', default closed

  function ls(k, d) { try { var v = W.localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function lset(k, v) { try { W.localStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  // ff(P.fontMono) CONTAINS DOUBLE QUOTES. Interpolated raw into style="..." the
  // first quote terminates the attribute and every declaration after it is
  // silently discarded — which is how the sibling seams went invisible in dark
  // mode. Single quotes are equally valid CSS and survive. Same guard, same file
  // family, same reason (hw-live-identity.js:80).
  function ff(v) { return String(v).replace(/"/g, "'"); }

  function palette() {
    var T = W.THEMES;
    if (!T) { return null; }
    var m = 'light';
    try { m = W.localStorage.getItem('hw-pos-theme') === 'dark' ? 'dark' : 'light'; } catch (e) {}
    return T[m] || T.light || null;
  }

  var D = {
    LEFT: 86,            // shared/app-rail.jsx:46 — 74px rail + 12px gutter
    // The column is bottom-anchored at 14 now, not 52: the hw-live pill that
    // used to own bottom:14 has moved into this tray as a row, so nothing sits
    // beneath the column any more.
    BOTTOM: 14,
    _root: null, _slot: null, _tray: null, _sum: null, _css: null,
    _closers: {},
    _state: {},          // id -> { dot, status, label }
    _order: [],          // registration order, so rows keep a stable sequence
    _open: ls(TRAY_KEY, 'closed') === 'open',

    root: function () {
      if (D._root && D._root.parentNode) { return D._root; }
      if (!document.body) { return null; }
      var r = document.createElement('div');
      r.id = 'hw-seam-dock';
      // data-hw-chrome keeps annotation pins OFF this column. notes.js locate()
      // re-finds a pin by matching its stored text across the whole document and
      // taking the smallest visible match — and these pills are small, so a pin
      // left on the words `Check-in` or `Live data` would migrate onto one of
      // them. See shared/notes.js locate().
      r.setAttribute('data-hw-chrome', 'seam-dock');
      // pointer-events:none here and auto on each pill and panel: the empty
      // gutter beside a short pill must not swallow a click meant for the app.
      // z from the scale in pos/tokens.jsx via the custom properties it
      // publishes — ambient chrome sits BELOW application modals. Never a number.
      r.style.cssText = 'position:fixed;left:' + D.LEFT + 'px;bottom:' + D.BOTTOM +
        'px;z-index:var(--hwz-chromeDock);display:flex;flex-direction:column;align-items:flex-start;' +
        'gap:8px;max-width:calc(100vw - ' + (D.LEFT + 16) + 'px);pointer-events:none';
      document.body.appendChild(r);
      D._root = r;
      D.style();
      return r;
    },

    // Where every seam's panel lives. Above the tray, always.
    slot: function () {
      if (D._slot && D._slot.parentNode) { return D._slot; }
      var r = D.root(); if (!r) { return null; }
      var s = document.createElement('div');
      s.id = 'hw-seam-panels';
      s.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:8px;' +
        'max-width:100%;pointer-events:none';
      r.insertBefore(s, r.firstChild);
      D._slot = s;
      return s;
    },

    tray: function () {
      if (D._tray && D._tray.parentNode) { return D._tray; }
      var r = D.root(); if (!r) { return null; }
      var t = document.createElement('div');
      t.id = 'hw-seam-tray';
      r.appendChild(t);
      D._tray = t;
      D.summary();          // the pill is always the LAST child of the column
      D.paint();
      return t;
    },

    // The always-visible pill. Built here rather than in a seam file because it
    // describes ALL of them.
    summary: function () {
      if (D._sum && D._sum.parentNode) { return D._sum; }
      var r = D.root(); if (!r) { return null; }
      var s = document.createElement('div');
      s.id = 'hw-seam-summary';
      s.style.cssText = 'display:flex;pointer-events:none;max-width:100%';
      r.appendChild(s);
      D._sum = s;
      s.addEventListener('click', function () { D.toggle(); });
      s.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') { return; }
        e.preventDefault(); D.toggle();
      });
      return s;
    },

    // One stylesheet, so the six seam pills become full-width ROWS without any
    // of the six being edited. Each seam appends `<div id=hw-X-badge>` holding
    // one inline-flex pill; stretching them here keeps the row shape in one
    // place and cannot drift six ways.
    style: function () {
      if (D._css && D._css.parentNode) { return; }
      var st = document.createElement('style');
      st.id = 'hw-seam-dock-css';
      st.textContent = [
        '#hw-seam-tray{display:none;flex-direction:column;align-items:stretch;gap:6px;' +
          'width:min(400px,calc(100vw - ' + (D.LEFT + 16) + 'px));max-height:40vh;' +
          'overflow-y:auto;overflow-x:hidden;pointer-events:auto;overscroll-behavior:contain}',
        '#hw-seam-tray.on{display:flex}',
        '#hw-seam-tray > *{display:flex !important;width:100%}',
        '#hw-seam-tray > * > *{flex:1 1 auto;min-width:0;justify-content:flex-start}',
        // The label is the only thing allowed to truncate; the dot and the
        // count must stay legible at 400px.
        '#hw-seam-tray > * > * > span:nth-child(2){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      ].join('');
      document.head.appendChild(st);
      D._css = st;
    },

    register: function (id, close) {
      if (!D._closers[id]) { D._order.push(id); }
      D._closers[id] = close;
      D.paint();
    },

    // Every seam calls this from its own paint(). `dot` is already resolved from
    // the same palette object this file reads, so comparing against P.bad/warn/
    // good is exact rather than a guess about colour.
    report: function (id, dot, status, label) {
      D._state[id] = { dot: dot, status: status, label: label };
      D.paint();
    },

    // Opening one closes its siblings. Overlapping cards at the same z-index is
    // how the identity panel became unreachable.
    opened: function (id) {
      Object.keys(D._closers).forEach(function (k) {
        if (k !== id) { try { D._closers[k](); } catch (e) {} }
      });
    },
    closeAll: function () {
      Object.keys(D._closers).forEach(function (k) { try { D._closers[k](); } catch (e) {} });
    },

    expand: function () { if (!D._open) { D._open = true; lset(TRAY_KEY, 'open'); D.paint(); } },
    collapse: function () {
      if (!D._open) { return; }
      D._open = false; lset(TRAY_KEY, 'closed');
      // A panel left open above a hidden tray is an orphan with no visible way
      // back to the row that opened it.
      D.closeAll();
      D.paint();
    },
    toggle: function () { D._open ? D.collapse() : D.expand(); },

    // Worst state wins, and only semantic tones ever appear here. Accent is
    // reserved (HANDOFF.md: at most one accent per view, selection is ink).
    tone: function (P) {
      var worst = 0;
      D._order.forEach(function (id) {
        var st = D._state[id]; if (!st) { return; }
        var r = st.dot === P.bad ? 3 : st.dot === P.warn ? 2 : st.dot === P.good ? 1 : 0;
        if (r > worst) { worst = r; }
      });
      return worst === 3 ? P.bad : worst === 2 ? P.warn : worst === 1 ? P.good : P.inkFaint;
    },

    paint: function () {
      var P = palette();
      var s = D._sum;
      if (!P || !s) { return; }
      if (D._tray) { D._tray.className = D._open ? 'on' : ''; }

      var ids = D._order.filter(function (id) { return D._state[id]; });
      var n = ids.length;
      var live = ids.filter(function (id) { return D._state[id].status === 'live'; }).length;
      // hw-live is the seam that knows whether the page is on the API at all, so
      // its wording leads. Without it the pill says what it honestly is.
      var lead = (D._state['hw-live'] && D._state['hw-live'].label) || 'Integrations';
      var sub = n ? (n + ' seam' + (n === 1 ? '' : 's') + ' · ' + live + ' live') : 'no seams';

      s.innerHTML =
        '<div role="button" tabindex="0" data-hw-i aria-expanded="' + (D._open ? 'true' : 'false') +
        '" title="' + esc(lead + ' · ' + sub + ' — click for the integration seams') + '"' +
        ' style="display:inline-flex;align-items:center;gap:8px;min-height:' + P.ctrlH.xs +
        'px;max-width:320px;padding:0 11px;border-radius:' + P.r999 + 'px;background:' + P.surface +
        ';border:1px solid ' + P.hairline2 + ';box-shadow:' + P.shadowSm + ';cursor:pointer;' +
        'user-select:none;pointer-events:auto;white-space:nowrap;overflow:hidden">' +
        '<span style="width:7px;height:7px;border-radius:' + P.r999 + 'px;background:' + D.tone(P) +
        ';flex:0 0 auto"></span>' +
        '<span style="font-size:' + P.type.meta + 'px;font-weight:700;color:' + P.ink +
        ';overflow:hidden;text-overflow:ellipsis">' + esc(lead) + '</span>' +
        '<span style="font-size:' + P.type.meta + 'px;color:' + P.inkMute + ';font-family:' +
        ff(P.fontMono) + ';font-variant-numeric:tabular-nums;flex:0 0 auto">' + esc(sub) + '</span>' +
        '<span aria-hidden="true" style="font-size:' + P.type.micro + 'px;color:' + P.inkMute +
        ';flex:0 0 auto">' + (D._open ? '▾' : '▴') + '</span></div>';
    }
  };

  // The only globally bound key, and it only ever CLOSES. A panel you cannot get
  // out of without hunting for its pill again is the bug being fixed; a tray you
  // cannot collapse is the same bug one level up.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Esc') { D.closeAll(); D.collapse(); }
  });

  // pos/tokens.jsx repaints document.body.style on a theme change and emits no
  // event, so the style attribute is the only signal plain JS has.
  function watchTheme() {
    if (!W.MutationObserver || !document.body) { return; }
    new MutationObserver(function () { D.paint(); })
      .observe(document.body, { attributes: true, attributeFilter: ['style'] });
  }
  if (document.body) { watchTheme(); }
  else { document.addEventListener('DOMContentLoaded', watchTheme); }

  // Published through a getter for ONE reason: the six seam files still carry
  // the old inline dock() as a fallback, and each begins
  // `if (W.HW_SEAM_DOCK) { return W.HW_SEAM_DOCK; }` followed by
  // `if (!document.body) { return null; }`. Returning null while there is no
  // body keeps that second guard reachable, so a seam that paints early retries
  // instead of dereferencing a dock that cannot build itself yet. The no-op
  // setter is what stops an inline copy from replacing this one — silently, and
  // without throwing inside their 'use strict'.
  Object.defineProperty(W, 'HW_SEAM_DOCK', {
    configurable: true,
    get: function () { return document.body ? D : null; },
    set: function () {},
  });
})();
