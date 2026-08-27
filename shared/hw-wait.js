// ── THE ONE WAIT FORMAT (`window.HW_WAIT.shortWait`) ───────────────────────
//
// How long somebody has been standing there, rendered for a human. Plain JS,
// no dependencies, loaded before every consumer, exactly like shared/hw-z.js.
//
// WHY THIS FILE EXISTS RATHER THAN A FUNCTION IN EACH SCREEN. There were two
// implementations of this and they disagreed on screen at the same moment:
//
//   pos/screen-register.jsx      s -> m -> h -> d      677,000s = '7d 20h'
//   shared/hw-live-checkin.js    s -> m -> h           677,000s = '188.1h'
//
// The seam's own dock panel and the register card were both drawing rows from
// the SAME board read, so one number appeared twice on one screen in two
// formats. The register's ladder was fixed and the seam's was not, because
// nothing connected them — which is the whole failure mode: a fix applied to
// one copy is not applied to the behaviour.
//
// THE DEFECT THE LADDER ITSELF FIXES. This was once
// `sec >= 60 ? floor(sec/60)+'m' : sec+'s'`, with no rung above minutes. Four
// seeded check-ins from 2026-08-19 were left in state `waiting`, so `waited_s`
// was around 600,000 — arithmetic that was CORRECT the whole time — and the
// card rendered '9879m'. A queue timer reading five figures of minutes is
// worse than no timer: it is unreadable AND it looks like a broken clock
// rather than a row nobody closed.
//
// THIS FUNCTION NEVER ADJUSTS THE NUMBER. It formats. A wait that is not a
// live wait is disclosed separately, by the board's own `stale` flag and its
// published threshold — see the cards. The elapsed time stays as measured,
// because it is the evidence that the row was abandoned.
//
// CALL IT AS `window.HW_WAIT.shortWait(sec)`, INLINE. Do not alias it to a
// top-level `const shortWait` in a `.jsx`: with no `data-presets`, Babel
// compiles every top-level binding in a <script type="text/babel"> to a
// GLOBAL and the last file loaded wins. Two screens each declaring
// `shortWait` would silently become one, which is how pos/data.jsx and
// pos/screen-orders.jsx both declaring `STAGES` made setStage() return null
// on every call while the UI reported success.
;(function () {
  var W = window;

  function shortWait(sec) {
    var n = Number(sec);
    if (!isFinite(n)) { n = 0; }
    var s = Math.max(0, Math.round(n));
    if (s < 60) { return s + 's'; }
    if (s < 3600) { return Math.floor(s / 60) + 'm'; }
    if (s < 86400) {
      return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm';
    }
    return Math.floor(s / 86400) + 'd ' + Math.floor((s % 86400) / 3600) + 'h';
  }

  W.HW_WAIT = { shortWait: shortWait };
})();
