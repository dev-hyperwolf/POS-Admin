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
              <window.Seg value={mode} onChange={setMode} options={[{ value: 'fill', label: 'Fill' }, { value: 'review', label: 'Review' }]} />
            )}
            {slug && window.PBtn && (
              <window.PBtn variant="secondary" icon="printer" onClick={() => window.print()}>Print</window.PBtn>
            )}
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 20 }}>
            {status === 'loading' && <div style={{ color: P.inkMute }}>Loading forms…</div>}
            {status === 'unavailable' && (
              window.ErrorState
                ? <window.ErrorState title="Forms not available on this server yet" compact />
                : <div style={{ color: P.inkMute }}>Forms not available on this server yet.</div>
            )}
            {status === 'ready' && forms.length === 0 && (
              window.EmptyState
                ? <window.EmptyState icon="note" title="No published forms" body="Forms created in the builder will show up here once published." />
                : <div style={{ color: P.inkMute }}>No published forms.</div>
            )}
            {status === 'ready' && slug && <FormHost slug={slug} mode={mode} />}
          </div>
        </div>
        {window.ToastHost ? <window.ToastHost /> : null}
      </div>);
  }

  window.FormsApp = App;
  ReactDOM.createRoot(document.getElementById('root')).render(
    window.ThemeProvider ? <window.ThemeProvider><App /></window.ThemeProvider> : <App />);
})();
