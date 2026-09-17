// ── Safe-area padding helper — one place, every screen ──────────────────────
// A fixed pixel pad (status bar / dynamic island clearance, home-indicator
// clearance) is correct in the framed desktop preview, where the device chrome
// is drawn by mobile/ios-frame.jsx and there is no real OS inset to add. On an
// actual phone (mobile/app.jsx's ≤600px breakpoint, no device frame) that same
// fixed pad sits UNDER the real notch/home-indicator inset unless it also adds
// env(safe-area-inset-*).
//
// window.HWSafe.top(n) / .bottom(n) / .left(n) / .right(n) return a CSS
// calc() string: the base px plus that edge's safe-area inset (0 when the
// browser doesn't support env(), e.g. the framed preview or a non-iOS
// browser — so every existing hardcoded value keeps its current look there).
// Plain IIFE, one global, no deps — loads before any text/babel screen.
(function () {
  function pad(edge, n) {
    return `calc(${n}px + env(safe-area-inset-${edge}, 0px))`;
  }
  window.HWSafe = {
    top: (n) => pad('top', n),
    bottom: (n) => pad('bottom', n),
    left: (n) => pad('left', n),
    right: (n) => pad('right', n)
  };
})();
