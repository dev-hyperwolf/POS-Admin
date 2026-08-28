/* ── THE ONE ERROR BOUNDARY ──────────────────────────────────────────────────
 * Two components. Pick by what must happen when the subtree breaks:
 *   <ScreenBoundary   name="Catalog">      CONTAIN — this frame fails, the
 *                                          rest of the app keeps working.
 *   <CriticalBoundary name="Cart" flow="this sale">
 *                                          REFUSE — nothing of the subtree
 *                                          renders, and the whole enclosing
 *                                          frame refuses with it.
 * There is no default and no mode flag: containing a failure is a decision you
 * have to type. The long argument, and the limits, are below.
 * ──────────────────────────────────────────────────────────────────────────── */
;(function () {
  'use strict';

  /* ══ WHY TWO COMPONENTS AND NOT ONE WITH A FLAG ════════════════════════════
   *
   * On 2026-08-27 one dereference of `undefined` in pos/screen-register.jsx —
   * `cart.map(...)`, on the render path — took the WHOLE application down.
   * Not the cart pane: the register, the nav, the check-in queue, everything.
   * There were zero error boundaries in this estate, so the blast radius of any
   * render error was the entire app.
   *
   * The obvious fix is a boundary per screen. The obvious fix is also how you
   * turn a loud outage into a silent one, and that is the more expensive bug:
   *
   *   A cart pane that throws and shows "cart unavailable" is honest.
   *   A cart pane that throws and renders EMPTY is a catastrophe, because
   *   someone rings a sale against it.
   *
   * So the dangerous behaviour — "show a tidy card and let the user carry on" —
   * must never be what you get by forgetting something. A single <Boundary>
   * with `critical` as an opt-in flag fails that test: forget the flag on a
   * money surface and you have built the catastrophe. Hence two names, neither
   * of them a default:
   *
   *   ScreenBoundary   contains. Use where NOTHING that survives is a thing a
   *                    person can act on wrongly — a screen frame, a report, a
   *                    settings pane, a decorative panel.
   *   CriticalBoundary refuses. Use on money, compliance, and anything a person
   *                    acts on: cart, tender, drawer, ID verification, check-in.
   *                    It renders none of its subtree and escalates, so the
   *                    enclosing ScreenBoundary refuses the whole frame. The
   *                    sale cannot be rung from a screen that has already
   *                    failed.
   *
   * Two properties fall out of this that are worth more than the components:
   *
   *   1. NO BOUNDARY AT ALL BEHAVES LIKE CriticalBoundary. An unbounded error
   *      propagates to the nearest ScreenBoundary above. Omission is safe;
   *      only containment is a choice.
   *   2. A ScreenBoundary NESTED INSIDE A CriticalBoundary DOES NOT CONTAIN.
   *      It escalates instead. You cannot accidentally re-contain a failure
   *      inside a region that has already declared it must refuse — see the
   *      `critical` flag on the context value below.
   *
   * ══ LIMITS. READ THIS BEFORE TREATING A BOUNDARY AS A GUARANTEE ═══════════
   *
   * React error boundaries catch errors thrown during RENDER, in LIFECYCLE
   * methods, and in constructors of the tree BELOW them. They do NOT catch:
   *
   *   · event handlers          (onClick, onChange — the tender button)
   *   · async work              (setTimeout, promises, fetch callbacks)
   *   · server-side rendering
   *   · errors thrown in the boundary itself
   *   · anything outside the React tree (the plain-JS chrome, the live seams)
   *
   * The register's actual sale path is mostly event handlers. A boundary does
   * not protect it. Whatever ends up guarding handlers is a SEPARATE mechanism
   * and must be built as one — do not let a green boundary test read as cover
   * for a class of failure it cannot see.
   *
   * ══ NEVER SWALLOW ════════════════════════════════════════════════════════
   *
   * Every caught error, contained or refused, is (a) pushed to
   * HW_BOUNDARY.failures, (b) console.error'd, and (c) re-dispatched as a real
   * `error` event on window so it reaches the reporting path of the build guard
   * in tools/precompile.mjs. The guard records it, and paints only if the app
   * also failed to mount — so containment stays contained while the evidence
   * still lands. A boundary that quietly renders a nice card is the same defect
   * this estate spent a day removing.
   * ═════════════════════════════════════════════════════════════════════════ */

  var React = window.React;
  if (!React || typeof React.createContext !== 'function') {
    // Loud, not silent: without React this file cannot define anything and
    // every caller's <ScreenBoundary> would be an undefined-component crash.
    try {
      console.error('[HW boundary] shared/error-boundary.jsx loaded before React. '
        + 'Move its <script> tag after the react UMD tag on this page.');
    } catch (e) {}
    return;
  }

  /* ── The failure ledger + the reporting path ──────────────────────────── */

  var HW = window.HW_BOUNDARY || (window.HW_BOUNDARY = {});
  HW.failures = HW.failures || [];
  /** Tests and the harness clear the ledger between cases. */
  HW.reset = function () { HW.failures.length = 0; };
  /** Optional sink. Assign a function to ship failures somewhere real. */
  HW.onFailure = HW.onFailure || null;

  function messageOf(err) {
    if (!err) return 'an error with no message';
    if (typeof err === 'string') return err;
    return String(err.message || err) || 'an error with no message';
  }

  /**
   * Record a failure everywhere it has to go. Never throws — a reporter that
   * throws inside componentDidCatch takes down the boundary that caught it.
   *
   * @param {{name:string, kind:'contained'|'refused', flow?:string,
   *          error:any, componentStack?:string}} entry
   */
  function report(entry) {
    var line = '[HW boundary] ' + entry.kind + ' — ' + entry.name + ': ' + messageOf(entry.error);
    try {
      HW.failures.push({
        name: entry.name, kind: entry.kind, flow: entry.flow || null,
        message: messageOf(entry.error), error: entry.error,
        componentStack: entry.componentStack || null, at: Date.now(),
      });
    } catch (e) {}
    try { console.error(line, entry.error); } catch (e) {}
    // Reach the build guard's own listener (tools/precompile.mjs bootGuard).
    // It records into its `errs` list and paints only if the app is also dead,
    // which is exactly the behaviour we want: evidence without a takeover.
    try {
      var ev;
      try { ev = new window.ErrorEvent('error', { message: line, error: entry.error }); }
      catch (e2) {
        ev = window.document.createEvent('Event');
        ev.initEvent('error', false, false);
        try { ev.message = line; } catch (e3) {}
      }
      window.dispatchEvent(ev);
    } catch (e4) {}
    try { if (typeof HW.onFailure === 'function') HW.onFailure(entry); } catch (e5) {}
  }
  HW.report = report;

  /* ── The context that lets a child escalate to its enclosing frame ─────── */

  /**
   * Value shape: { critical: boolean, name: string, refuse(payload) }
   * `null` means "no boundary above me" — a CriticalBoundary that finds null
   * has nowhere to escalate to, so it paints its own refusal rather than
   * throwing into the void and white-screening the page.
   */
  var Ctx = React.createContext(null);
  HW.Context = Ctx;

  /* ── Presentation. Deliberately dependency-free ────────────────────────── */

  /* NOT useP / not ErrorState / not PBtn. A boundary's fallback UI must not
   * depend on anything that could itself be the thing that broke — a theme
   * provider that throws would make the panel that reports it throw too. Same
   * reason the build guard in tools/precompile.mjs hand-writes its colours.
   * These read on both light and dark backgrounds. */
  var PANEL = {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10,
    margin: 16, padding: '20px 22px', borderRadius: 12,
    background: '#2a1414', color: '#ffd7d7', border: '1px solid #6b2b2b',
    font: '13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace',
    maxWidth: 720, textAlign: 'left',
  };
  var TITLE = { font: '700 17px/1.3 system-ui,-apple-system,sans-serif', color: '#ff8a8a' };
  var BODY = { color: '#e4cccc' };
  var DETAIL = {
    alignSelf: 'stretch', padding: '9px 11px', borderRadius: 8,
    background: '#1a0f0f', border: '1px solid #4a2020', color: '#c9b7b7',
    fontSize: 11.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  };
  var BTN = {
    padding: '7px 13px', borderRadius: 8, cursor: 'pointer',
    background: '#3a1c1c', color: '#ffd7d7', border: '1px solid #6b2b2b',
    font: '600 12.5px/1 system-ui,-apple-system,sans-serif',
  };

  function reload() { try { window.location.reload(); } catch (e) {} }

  /**
   * The panel. `kind` decides the wording, and the wording is the product:
   * "Something went wrong" is the same defect in a friendlier font.
   */
  function Panel(props) {
    var refused = props.kind === 'refused';
    var msg = messageOf(props.error);
    var actions = [
      React.createElement('button', { key: 'reload', type: 'button', style: BTN, onClick: reload }, 'Reload the page'),
    ];
    if (props.onReset) {
      actions.push(React.createElement('button', {
        key: 'reset', type: 'button', style: BTN, onClick: props.onReset,
      }, props.resetLabel || 'Go back'));
    }
    return React.createElement('div', {
      style: PANEL,
      'data-hw-boundary': props.kind,
      'data-hw-boundary-name': props.name,
      role: 'alert',
    },
      React.createElement('div', { style: TITLE },
        refused
          ? (props.flow ? props.flow + ' has been stopped.' : props.name + ' has been stopped.')
          : props.name + ' stopped working.'),
      React.createElement('div', { style: BODY },
        refused
          ? (props.name + ' failed, and this is a surface people act on. Nothing from it is '
             + 'being shown, because a screen that has already failed must not be used to '
             + 'take money, clear a customer, or record a count. Do not carry on from what '
             + 'was on screen before this appeared.')
          : (props.name + ' is showing nothing rather than showing something wrong. The rest '
             + 'of this page was not affected and is safe to use.')),
      React.createElement('div', { style: DETAIL }, msg),
      React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 2 } }, actions));
  }
  HW.Panel = Panel;

  /* ── ScreenBoundary — CONTAIN ──────────────────────────────────────────── */

  /**
   * Contain a render/lifecycle failure inside one frame.
   *
   * @prop {string}   name        REQUIRED. What broke, in the words a person on
   *                              the floor would use — "Catalog", "Orders".
   *                              It is printed, so a generic name is a bug.
   * @prop {function} [onReset]   Renders a second button. Use it to send the
   *                              user somewhere that works.
   * @prop {string}   [resetLabel]Label for that button. Default "Go back".
   * @prop {node}     children
   *
   * Put a `key` on it (in a router, `key={route}`) so navigating away clears
   * the failure instead of stranding the user on a dead frame.
   *
   * Inside a CriticalBoundary this does NOT contain — it escalates. See the
   * header note.
   */
  var ScreenBoundary = class ScreenBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null, refusal: null };
      this.refuse = this.refuse.bind(this);
      this.value = null;
    }

    static getDerivedStateFromError(error) { return { error: error }; }

    componentDidCatch(error, info) {
      var name = this.props.name || '(an unnamed ScreenBoundary)';
      if (!this.props.name) {
        try { console.error('[HW boundary] ScreenBoundary rendered without a `name`. '
          + 'The panel cannot say what broke.'); } catch (e) {}
      }
      var parent = this.context;
      // A ScreenBoundary inside a CriticalBoundary must not contain. The
      // enclosing region has already declared that a failure there is not
      // survivable, and containing here would quietly undo that.
      if (parent && parent.critical) {
        report({ name: name, kind: 'refused', flow: parent.name, error: error,
          componentStack: info && info.componentStack });
        parent.refuse({ name: name, error: error, flow: null });
        return;
      }
      report({ name: name, kind: 'contained', error: error,
        componentStack: info && info.componentStack });
    }

    /** Called by a descendant CriticalBoundary. Refuses this whole frame. */
    refuse(payload) { this.setState({ refusal: payload }); }

    render() {
      var name = this.props.name || '(an unnamed ScreenBoundary)';
      var r = this.state.refusal;
      if (r) {
        return React.createElement(Panel, {
          kind: 'refused', name: r.name || name, flow: r.flow, error: r.error,
          onReset: this.props.onReset, resetLabel: this.props.resetLabel,
        });
      }
      if (this.state.error) {
        var parent = this.context;
        // Escalated in componentDidCatch: render nothing, the refusing
        // ancestor owns the frame now.
        if (parent && parent.critical) return null;
        return React.createElement(Panel, {
          kind: 'contained', name: name, error: this.state.error,
          onReset: this.props.onReset, resetLabel: this.props.resetLabel,
        });
      }
      if (!this.value || this.value.name !== name) {
        this.value = { critical: false, name: name, refuse: this.refuse };
      }
      return React.createElement(Ctx.Provider, { value: this.value }, this.props.children);
    }
  };
  ScreenBoundary.displayName = 'ScreenBoundary';
  ScreenBoundary.contextType = Ctx;

  /* ── CriticalBoundary — REFUSE ───────────────────────────────── */

  /**
   * Refuse the whole flow when this subtree fails. Nothing of the subtree
   * renders, and the failure is escalated to the enclosing ScreenBoundary so
   * the entire frame refuses — the money surface cannot be reached around the
   * edge of a broken pane.
   *
   * @prop {string} name   REQUIRED. The surface — "Cart", "Tender", "ID check".
   * @prop {string} [flow] What is being stopped, in the user's words —
   *                       "This sale", "This check-in". Printed as the title.
   * @prop {node}   children
   *
   * With no ScreenBoundary above it, it paints its own refusal rather than
   * escalating into nothing — escalating to no one is a white screen, which is
   * the bug this file exists to end.
   */
  var CriticalBoundary = class CriticalBoundary extends React.Component {
    constructor(props) {
      super(props);
      // `mode` is deliberately null until componentDidCatch decides. While it
      // is null and an error is set, render() returns NOTHING — the undecided
      // state resolves toward showing less, never toward showing a usable-
      // looking subtree.
      this.state = { error: null, mode: null };
      this.refuse = this.refuse.bind(this);
      this.value = null;
    }

    static getDerivedStateFromError(error) { return { error: error }; }

    componentDidCatch(error, info) {
      var name = this.props.name || '(an unnamed CriticalBoundary)';
      if (!this.props.name) {
        try { console.error('[HW boundary] CriticalBoundary rendered without a `name`. '
          + 'The refusal cannot say what broke.'); } catch (e) {}
      }
      report({ name: name, kind: 'refused', flow: this.props.flow, error: error,
        componentStack: info && info.componentStack });
      this.settle({ name: name, error: error, flow: this.props.flow });
    }

    /** Hand the refusal up if there is anywhere to hand it; otherwise own it. */
    settle(payload) {
      var parent = this.context;
      if (parent && typeof parent.refuse === 'function') {
        parent.refuse(payload);
        this.setState({ mode: 'escalated' });
        return true;
      }
      this.setState({ error: payload && payload.error, mode: 'self' });
      return false;
    }

    /** A nested boundary refusing. We are a refusing region too — pass it on. */
    refuse(payload) { this.settle(payload); }

    render() {
      var name = this.props.name || '(an unnamed CriticalBoundary)';
      if (this.state.error || this.state.mode) {
        // Anything other than a decided 'self' renders NOTHING. Never a
        // partial or empty version of the subtree — an empty cart is worse
        // than no cart, because someone rings a sale against an empty cart.
        if (this.state.mode !== 'self') return null;
        return React.createElement(Panel, {
          kind: 'refused', name: name, flow: this.props.flow, error: this.state.error,
        });
      }
      if (!this.value || this.value.name !== name) {
        this.value = { critical: true, name: name, refuse: this.refuse };
      }
      return React.createElement(Ctx.Provider, { value: this.value }, this.props.children);
    }
  };
  CriticalBoundary.displayName = 'CriticalBoundary';
  CriticalBoundary.contextType = Ctx;

  window.ScreenBoundary = ScreenBoundary;
  window.CriticalBoundary = CriticalBoundary;
  HW.ScreenBoundary = ScreenBoundary;
  HW.CriticalBoundary = CriticalBoundary;
})();
