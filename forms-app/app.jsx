// ── forms-app/app.jsx — the Forms shell: list published forms, render the
// chosen one through window.HDForm ─────────────────────────────────────────
// Mirrors the smallest useful slice of incentives/app.jsx's shape (HWRail +
// ThemeProvider + ToastHost), with none of Bounty's seat/console framing —
// Forms has exactly one screen: pick a form, fill it in, optionally print it.
// GET /api/forms is tolerated missing (404/501): window.HDForm's own FormRoot
// already renders "forms not available on this server yet" once a form is
// selected, so this shell only needs to handle an EMPTY or FAILED list.
;(function () {
  const useP = window.useP;

  function FormHost({ slug, mode }) {
    const ref = React.useRef(null);
    const rootRef = React.useRef(null);
    React.useEffect(() => {
      if (!ref.current || !slug) return;
      if (rootRef.current) { try { rootRef.current.unmount(); } catch (e) {} }
      rootRef.current = window.HDForm.render(ref.current, { slug, mode });
      return () => { if (rootRef.current) { try { rootRef.current.unmount(); } catch (e) {} } rootRef.current = null; };
    }, [slug, mode]);
    return <div ref={ref} />;
  }

  function App() {
    const P = useP();
    const [forms, setForms] = React.useState([]);
    const [status, setStatus] = React.useState('loading'); // loading | ready | unavailable
    const [slug, setSlug] = React.useState(null);
    const [mode, setMode] = React.useState('fill');
    // 'form' (fill/preview through FormHost) vs 'submissions' (the review list,
    // FORM-GENERATOR-PROPOSAL.md phase 2) -- a separate tab, not a third value on the
    // fill/review Seg below: that Seg previews the DEFINITION with no data, this one browses
    // actual submissions.
    const [view, setView] = React.useState('form');

    React.useEffect(() => {
      fetch('/api/forms').then((r) => {
        if (r.status === 404 || r.status === 501) { setStatus('unavailable'); return null; }
        if (!r.ok) { setStatus('unavailable'); return null; }
        return r.json();
      }).then((body) => {
        if (!body) return;
        const list = Array.isArray(body) ? body : (body.forms || []);
        setForms(list);
        setStatus('ready');
        if (list.length && !slug) setSlug(list[0].slug || list[0].id);
      }).catch(() => setStatus('unavailable'));
    }, []);

    return (
      <div style={{ display: 'flex', height: '100%', background: P.canvas || P.surface2 }}>
        {window.HWRail ? <window.HWRail active="forms" /> : null}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            {window.SectionHead ? <window.SectionHead level={2} title="Forms" subtitle="Generated from a saved form definition — one renderer, every form." /> : <h2>Forms</h2>}
            <div style={{ flex: 1 }} />
            {status === 'ready' && forms.length > 0 && (
              <select value={slug || ''} onChange={(e) => setSlug(e.target.value)}
                style={{ minHeight: 38, padding: '0 10px', borderRadius: P.r8, border: `1px solid ${P.fieldBorder || P.hairline2}`, background: P.field || P.surface, color: P.ink }}>
                {forms.map((f) => <option key={f.slug || f.id} value={f.slug || f.id}>{f.title || f.slug || f.id}</option>)}
              </select>
            )}
            {slug && window.Seg && (
              <window.Seg value={view} onChange={setView} options={[{ value: 'form', label: 'Form' }, { value: 'submissions', label: 'Submissions' }]} />
            )}
            {slug && view === 'form' && window.Seg && (
              <window.Seg value={mode} onChange={setMode} options={[{ value: 'fill', label: 'Fill' }, { value: 'review', label: 'Review' }]} />
            )}
            {slug && view === 'form' && window.PBtn && (
              <window.PBtn variant="secondary" icon="printer" onClick={() => window.print()}>Print</window.PBtn>
            )}
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {status === 'loading' && <div style={{ padding: 20, color: P.inkMute }}>Loading forms…</div>}
            {status === 'unavailable' && (
              <div style={{ padding: 20 }}>
                {window.ErrorState
                  ? <window.ErrorState title="Forms not available on this server yet" compact />
                  : <div style={{ color: P.inkMute }}>Forms not available on this server yet.</div>}
              </div>
            )}
            {status === 'ready' && forms.length === 0 && (
              <div style={{ padding: 20 }}>
                {window.EmptyState
                  ? <window.EmptyState icon="note" title="No published forms" body="Forms created in the builder will show up here once published." />
                  : <div style={{ color: P.inkMute }}>No published forms.</div>}
              </div>
            )}
            {status === 'ready' && slug && view === 'form' && <div style={{ padding: 20 }}><FormHost slug={slug} mode={mode} /></div>}
            {status === 'ready' && slug && view === 'submissions' && window.HWFormsReview && <window.HWFormsReview slug={slug} />}
          </div>
        </div>
        {window.ToastHost ? <window.ToastHost /> : null}
      </div>);
  }

  window.FormsApp = App;
  ReactDOM.createRoot(document.getElementById('root')).render(
    window.ThemeProvider ? <window.ThemeProvider><App /></window.ThemeProvider> : <App />);
})();
