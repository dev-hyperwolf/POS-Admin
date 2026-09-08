// ── idv/idv-terms.jsx ── window.IdvTerms — { Link, Modal, useTerms } ───────
// The one place any Verify screen reaches the Terms document from. Built
// only from pos/atoms.jsx + shared/hd-ui.jsx's Sheet — no hex, no private
// modal shell. Content is never retyped here: every word comes from
// window.IDV_TERMS (idv/terms-text.js), so the legal text has exactly one
// source of truth.
;(function () {
  const useP = window.useP;

  function fullLegalText() {
    const T = window.IDV_TERMS;
    if (!T) return '';
    const lines = [];
    lines.push(T.insertHeading || 'Hyperwolf Verify — Identity Verification Terms');
    lines.push('');
    lines.push(T.developerInstruction || '');
    lines.push('');
    (T.sections || []).forEach((s) => {
      lines.push(s.title);
      lines.push('');
      (s.paragraphs || []).forEach((p) => { lines.push(p); lines.push(''); });
    });
    lines.push('PART II.A — CAPTURE NOTICE');
    lines.push(T.captureNotice || '');
    lines.push('');
    lines.push('PART II.B — BIOMETRIC CONSENT CHECKBOX');
    lines.push(T.biometricCheckbox || '');
    lines.push('');
    lines.push('PART III — NOTICE AT COLLECTION');
    (T.noticeAtCollection || []).forEach((row, i) => {
      lines.push(`${i + 1}. ${row.category}`);
      lines.push(`   Purpose: ${row.purpose}`);
      lines.push(`   Retention: ${row.retention}`);
      lines.push(`   ${row.soldOrShared}`);
      lines.push('');
    });
    (T.noticeAtCollectionFooter || []).forEach((p) => { lines.push(p); lines.push(''); });
    lines.push(T.insertVersionLine || '');
    lines.push(`Source: ${T.source || ''} · version ${T.version || ''}`);
    return lines.join('\n');
  }

  // ── useTerms() ─────────────────────────────────────────────────────────
  // Local, independent per call — any screen (Settings' own footer included,
  // per idv/app.jsx's comment that Settings holds a second T&C entry point)
  // can call this and get its own open/close state without a shared context.
  window.IdvTerms = window.IdvTerms || {};
  window.IdvTerms.useTerms = function useTerms() {
    const [isOpen, setIsOpen] = React.useState(false);
    const T = window.IDV_TERMS;
    return {
      version: T ? T.version : null,
      isOpen,
      open: React.useCallback(() => setIsOpen(true), []),
      close: React.useCallback(() => setIsOpen(false), []),
    };
  };

  // ── Modal ──────────────────────────────────────────────────────────────
  // hd-ui's Sheet (right-hand drawer) already handles Escape-to-close and
  // backdrop-click-to-close (shared/hd-ui.jsx L126-143). This layers a focus
  // trap on top — Sheet has none — and the content: a pinned developer
  // banner, the capture notice, every Part I section with a heading, then
  // the notice-at-collection table.
  window.IdvTerms.Modal = function Modal({ open, onClose }) {
    const P = useP();
    const T = window.IDV_TERMS;
    const rootRef = React.useRef(null);
    const [copied, setCopied] = React.useState(false);

    // Focus trap: on open, move focus into the sheet and keep Tab/Shift+Tab
    // cycling inside it; on close, restore focus to whatever had it before.
    // Focus lands on the dialog root itself (tabIndex=-1 below) rather than a
    // ref through IconBtn: IconBtn is a plain function component with no
    // React.forwardRef, so a ref on it would silently resolve to null.
    React.useEffect(() => {
      if (!open) return undefined;
      const prevActive = document.activeElement;
      const root = rootRef.current;
      // Focus synchronously in the effect rather than via requestAnimationFrame:
      // rAF only fires on a rendering frame, which a backgrounded/hidden tab
      // may never produce, silently dropping the trap's initial focus.
      if (root && root.focus) root.focus();
      function onKeyDown(e) {
        if (e.key !== 'Tab' || !root) return;
        const focusables = root.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        const list = Array.prototype.slice.call(focusables).filter((el) => !el.disabled && el.offsetParent !== null);
        if (!list.length) return;
        const first = list[0], last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      document.addEventListener('keydown', onKeyDown, true);
      return () => {
        document.removeEventListener('keydown', onKeyDown, true);
        try { prevActive && prevActive.focus && prevActive.focus(); } catch (e) {}
      };
    }, [open]);

    if (!window.Sheet) {
      // shared/hd-ui.jsx did not load — say so instead of silently rendering
      // nothing (same convention as the ScreenBoundary-missing console.error
      // in incentives/app.jsx).
      if (open) { try { console.error('[Idv] idv/idv-terms.jsx: shared/hd-ui.jsx did not load — window.Sheet is missing, the Terms modal cannot render.'); } catch (e) {} }
      return null;
    }
    if (!T) {
      return (
        <window.Sheet open={open} onClose={onClose} side="right" width={640}>
          <div style={{ padding: 20 }}>
            <ErrorState title="Terms text did not load" body="idv/terms-text.js defines window.IDV_TERMS and this page did not get it — check that Hyperwolf Verify.html loads that file." onRetry={undefined} />
          </div>
        </window.Sheet>);
    }

    async function copyLegalText() {
      const text = fullLegalText();
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.hdToast && window.hdToast({ title: 'Copied', description: 'Full legal text copied to the clipboard.', tone: 'ok' });
        setTimeout(() => setCopied(false), 1600);
      } catch (e) {
        window.hdToast && window.hdToast({ title: 'Copy failed', description: 'The browser blocked clipboard access.', tone: 'blocked' });
      }
    }

    const tableColumns = [
      { label: 'Category collected', key: 'category', render: (r) => <span style={{ fontSize: P.type.meta }}>{r.category}</span> },
      { label: 'Purpose', key: 'purpose', render: (r) => <span style={{ fontSize: P.type.meta }}>{r.purpose}</span> },
      { label: 'Retention', key: 'retention', render: (r) => <span style={{ fontSize: P.type.meta, fontFamily: P.fontMono }}>{r.retention}</span> },
      { label: 'Sold / shared', key: 'soldOrShared', render: (r) => <span style={{ fontSize: P.type.meta }}>{r.soldOrShared}</span> },
    ];

    return (
      <window.Sheet open={open} onClose={onClose} side="right" width={720}>
        <div ref={rootRef} role="dialog" aria-modal="true" tabIndex={-1} aria-label="Hyperwolf Verify — Identity Verification Terms"
          style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, outline: 'none' }}>

          {/* Pinned developer banner — warnSoft/warn tokens, never hex. */}
          <div style={{ position: 'sticky', top: 0, zIndex: 1, flex: '0 0 auto', background: P.warnSoft, borderBottom: `1px solid ${P.warn}`,
            padding: '13px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <Icon name="alert" size={16} stroke={2} color={P.warnText} style={{ flex: '0 0 auto', marginTop: 1 }} />
              <div style={{ fontSize: P.type.body, color: P.ink, lineHeight: 1.5 }}>{T.developerInstruction}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <PBtn size="xs" variant="secondary" icon={copied ? 'check' : 'copy'} onClick={copyLegalText}>{copied ? 'Copied' : 'Copy legal text'}</PBtn>
              <span style={{ fontSize: P.type.meta, color: P.inkDim, fontFamily: P.fontMono }}>Open source file: {T.source}</span>
            </div>
          </div>

          {/* Header + close */}
          <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px 4px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink }}>Identity Verification Terms</div>
              <div style={{ fontSize: P.type.meta, color: P.inkDim, fontFamily: P.fontMono, marginTop: 2 }}>Draft {T.version} · not legal advice</div>
            </div>
            <IconBtn icon="x" onClick={onClose} label="Close" title="Close (Esc)" />
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 18px 28px' }}>
            <SectionHead level={3} eyebrow="Part II · A" title="Capture-screen notice" style={{ marginTop: 12 }} />
            <div style={{ whiteSpace: 'pre-line', fontSize: P.type.body, color: P.ink2, lineHeight: 1.6, background: P.surface2,
              border: `1px solid ${P.hairline}`, borderRadius: P.r12, padding: '14px 16px' }}>{T.captureNotice}</div>

            <SectionHead level={3} eyebrow="Part I" title="Terms and Conditions insert" subtitle={T.insertHeading} style={{ marginTop: 26 }} />
            {(T.sections || []).map((s) => (
              <div key={s.id} style={{ marginTop: 16 }}>
                <div style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink, marginBottom: 6 }}>{s.title}</div>
                {(s.paragraphs || []).map((p, i) => (
                  <p key={i} style={{ margin: '0 0 9px', fontSize: P.type.body, color: P.ink2, lineHeight: 1.6 }}>{p}</p>))}
              </div>))}
            {T.insertVersionLine && <div style={{ marginTop: 10, fontSize: P.type.meta, color: P.inkMute, fontFamily: P.fontMono }}>{T.insertVersionLine}</div>}

            <SectionHead level={3} eyebrow="Part III" title="Notice at collection" style={{ marginTop: 26 }} />
            <DataTable dense columns={tableColumns} rows={T.noticeAtCollection || []} rowKey={(r, i) => r.category || i} />
            {(T.noticeAtCollectionFooter || []).map((p, i) => (
              <p key={i} style={{ margin: '10px 0 0', fontSize: P.type.meta, color: P.inkDim, lineHeight: 1.6 }}>{p}</p>))}
          </div>
        </div>
      </window.Sheet>);
  };

  // ── Link ───────────────────────────────────────────────────────────────
  // A small inline text button that opens its own Modal instance — self
  // contained, so dropping <IdvTerms.Link/> anywhere (top bar, a footer)
  // is the whole integration.
  window.IdvTerms.Link = function Link({ label = 'Terms and Conditions', style }) {
    const P = useP();
    const t = window.IdvTerms.useTerms();
    return (
      <React.Fragment>
        <PBtn variant="ghost" size="xs" onClick={t.open}
          style={{ fontSize: P.type.meta, color: P.inkDim, padding: '0 6px', minHeight: 'auto', height: 'auto', ...style }}>
          {label}
        </PBtn>
        <window.IdvTerms.Modal open={t.isOpen} onClose={t.close} />
      </React.Fragment>);
  };
})();
