// The stacking scale. ONE ladder for every layer that leaves the flow.
//
// WHY IT LIVES HERE AND NOT IN pos/tokens.jsx. It has to be readable by two
// populations that cannot see each other's world:
//   - the React screens, which want `P.z.modal` (pos/tokens.jsx merges this in);
//   - the plain-JS chrome in shared/*.js, which is parsed and MOUNTS before any
//     `type="text/babel"` module has executed, and which writes CSS strings.
// A plain script solves both: it runs synchronously, before anything mounts, and
// publishes the scale twice — as `window.HW_Z` and as `--hwz-*` custom
// properties on :root. Chrome files write `z-index:var(--hwz-chromeBar)` and
// never a number. dashboard.html, which carries the shared chrome but has its
// own hand-copied token block and never loads pos/tokens.jsx, gets the same
// values from the same place rather than a second copy that can drift.
//
// LOAD IT FIRST, on every page that carries shared chrome.
//
// THE LOAD-BEARING RULE: AMBIENT CHROME SITS BELOW APPLICATION UI. Before this,
// ten pieces of chrome each picked a number within 3,646 of INT32_MAX to
// guarantee it won, so the bottom-left status tray covered `Confirm match` on
// the POS catalog modal and the build stamp ate the bottom 15px of two buttons.
// Only annotation and the guided tour sit above the application, because both
// must be able to point AT a modal.
//
// WHY THE CHROME BAND IS 64/66/68 AND NOT 100/110/120.
// docs/FLOATING-UI-AUDIT.md §4.1 proposes 100/110/120 and states that alone
// fixes the `Confirm match` collision. That is only true once every modal in the
// estate has been migrated onto `scrim`/`modal` — and it has not been: ~160
// numeric z-index call sites remain, POS's own match modal among them at z 90.
// Shipping 100/110/120 today would leave the headline collision intact.
// 64/66/68 clears every in-page dropdown and header (≤60, including
// pos/shell.jsx's z-60 topbar) and sits under the lowest scrimmed modal in the
// estate (80), so it fixes the collision against the code that exists. Raise
// these to the audit's numbers once the app files are migrated.
(function () {
  'use strict';
  var Z = {
    content: 0,
    sticky: 10,           // in-page sticky headers / action bars
    dropdown: 60,         // in-page popovers, select menus, filter panels
    chromeDock: 64,       // ambient chrome, bottom-left  (live pill + seam tray)
    chromeBar: 66,        // ambient chrome, right column (launcher buttons)
    chromeMenu: 68,       // menus those launchers open
    scrim: 300,           // modal / sheet backdrop
    modal: 310,           // modal + sheet content
    modalPop: 320,        // popovers owned by an open modal
    toast: 400,           // transient confirmations
    notePin: 500,         // annotation — must sit above modals
    notePop: 510,
    notePanel: 520,
    tourMask: 600,        // the guided tour is the only true takeover
    tourCard: 610,
  };
  window.HW_Z = Z;
  try {
    var rs = document.documentElement.style;
    Object.keys(Z).forEach(function (k) { rs.setProperty('--hwz-' + k, String(Z[k])); });
  } catch (e) { /* a missing scale must never break a page */ }
})();
