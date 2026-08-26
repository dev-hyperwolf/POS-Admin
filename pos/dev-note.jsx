// ── pos/dev-note.jsx — explanatory notes rendered IN the UI, for the devs ───
// Self-wrapping IIFE: declares NOTHING at top level, so it cannot clobber
// another file's globals (test/global-collisions.test.mjs). Exports
// window.DevNote and window.DevNoteStyles.
//
// WHY THIS EXISTS, AND WHY IT IS NOT A COMMENT
//
// Every screen in this repo already carries a long source header explaining
// its rules. Those headers are excellent and no dev reading the code will be
// confused. The problem is the person looking at the DEMO: they see a number
// and have no way to know what it is claiming. Concretely, the three that
// have cost the most time --
//
//   * "low confidence 46%" on a match that looks perfect to a human. The
//     score was FABRICATED in the screen (a char-code hash) and has now been
//     deleted; but the real scores need saying out loud too, because a
//     confident 0.000 does not mean "no such product on Weedmaps", it means
//     "nothing was in the pool to compare against".
//   * "not looked at" vs "absent". These are DIFFERENT CLAIMS and only one of
//     them is a thing to send a brand. A UI that renders both as 0 turns "we
//     never checked" into "Weedmaps does not carry this".
//   * a publish channel that is bound but not armed. It reads as OFF, which
//     invites someone to bind it a second time.
//
// SO: the note text is about CONSEQUENCE, never about mechanism. "What does
// this number let me conclude, and what does it NOT let me conclude." A note
// that just restates the label ("this is the mapping queue") is noise and
// should be deleted rather than reworded.
//
// IT MUST NOT BECOME CHROME. Three rules keep it honest:
//   1. Collapsed by default after first read, remembered per note id in
//      localStorage. A dev reads it once; the demo is not permanently
//      wallpapered in explanation.
//   2. data-hw-chrome, so annotation pins cannot land on it (QA reproduced a
//      pin landing on a status pill; same class of bug).
//   3. It never fetches, never writes, and holds no React root. If it throws,
//      it must not be able to take a screen with it.
;(function () {
  'use strict';
  const useP = window.useP;

  const KEY = 'hw-devnote-open';

  function readOpen() {
    // localStorage throws in some embeddings (private mode, blocked site
    // data). A note that cannot remember its state must still RENDER.
    try { return JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writeOpen(m) {
    try { window.localStorage.setItem(KEY, JSON.stringify(m)); }
    catch (e) { /* not remembering is survivable; not rendering is not */ }
  }

  // tone: 'info' (default) explains, 'warn' says this number is not what you
  // think, 'gap' says this is a known hole and names who closes it.
  window.DevNote = function DevNote({ id, title, tone = 'info', children,
                                     defaultOpen = false, style }) {
    const P = useP();
    const [open, setOpen] = React.useState(function () {
      const m = readOpen();
      return id && Object.prototype.hasOwnProperty.call(m, id)
        ? !!m[id] : !!defaultOpen;
    });

    // accentText, never raw accent: tokens.jsx warns that yellow at readable
    // contrast is olive and that accentText is the ONE place gold exists.
    const accent = tone === 'warn' ? P.warn : tone === 'gap' ? P.bad : P.accentText;
    const soft = tone === 'warn' ? P.warnSoft
               : tone === 'gap' ? P.badSoft : P.highlightSoft;

    function toggle() {
      const next = !open;
      setOpen(next);
      if (id) { const m = readOpen(); m[id] = next; writeOpen(m); }
    }

    const label = tone === 'gap' ? 'KNOWN GAP'
                : tone === 'warn' ? 'READ THIS NUMBER CAREFULLY'
                : 'FOR THE DEVS';

    return React.createElement('div', {
      'data-hw-chrome': 'dev-note',
      style: Object.assign({
        border: '1px solid ' + (tone === 'info' ? P.hairline2 : accent),
        background: soft,
        borderRadius: P.r10 || 10,
        margin: '10px 0',
        overflow: 'hidden',
        fontSize: 12.5,
        lineHeight: 1.55,
      }, style || {}),
    }, [
      React.createElement('button', {
        key: 'h',
        onClick: toggle,
        style: {
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '8px 12px', background: 'transparent', border: 0,
          cursor: 'pointer', textAlign: 'left', color: P.ink,
          font: 'inherit',
        },
      }, [
        React.createElement('span', {
          key: 'b',
          style: {
            fontSize: 9.5, letterSpacing: '.08em', fontWeight: 700,
            color: accent, whiteSpace: 'nowrap',
          },
        }, label),
        React.createElement('span', {
          key: 't', style: { fontWeight: 600, flex: 1 },
        }, title),
        React.createElement('span', {
          key: 'c', style: { color: P.inkMute, fontSize: 11 },
        }, open ? 'hide' : 'show'),
      ]),
      open ? React.createElement('div', {
        key: 'b',
        style: { padding: '0 12px 11px 12px', color: P.ink, opacity: .92 },
      }, children) : null,
    ]);
  };

  // Monospace inside a note. It exists so a note never depends on a
  // per-screen local: screen-catalog.jsx defines its own Mono(), screen-
  // orders.jsx does not, and a note copied between them threw
  // "Mono is not defined" and blanked the screen. Notes use THIS.
  window.DevNoteMono = function DevNoteMono({ children }) {
    const P = useP();
    return React.createElement('span', {
      style: { fontFamily: P.fontMono, fontSize: '.94em', color: P.ink2 },
    }, children);
  };

  // A paragraph inside a DevNote. Kept as an atom so notes cannot drift into
  // per-screen bespoke markup.
  window.DevNoteP = function DevNoteP({ children, style }) {
    return React.createElement('p', {
      style: Object.assign({ margin: '6px 0 0 0' }, style || {}),
    }, children);
  };
})();
