// ── Promotions Suite — merged shell ────────────────────────────────────────
// Home board + calendar + live surfaces + studio (4-day-old app) ⊕ the 3-style
// if/then builder + plain-English sentence (today's app), on ONE dataset.
const useP = window.useP,useTheme = window.useTheme;
const { useState } = React;
const M = window.MERGE;

function SuiteTopBar({ onNew }) {
  const P = useP();const { mode, toggle } = useTheme();
  return <header style={{ height: 60, flex: '0 0 60px', display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', background: P.surface, borderBottom: `1px solid ${P.hairline2}`, zIndex: 30 }}>
    <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', fontFamily: P.fontSans }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: P.good }} />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>ALL STORES</span>
      <Icon name="chevron-down" size={14} stroke={2} color={P.inkMute} />
    </button>
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 11px', borderRadius: P.r999, background: P.highlightSoft, border: `1px solid ${P.hairline2}` }}>
      <Icon name="link" size={13} color={P.inkDim} />
      <span style={{ fontSize: 11.5, fontWeight: 600, color: P.ink2 }}>Banners · Points · Catalog connected</span>
    </div>
    <div style={{ flex: 1 }} />
    <PBtn variant="secondary" icon="plus" size="sm" onClick={onNew}>New promotion</PBtn>
    <IconBtn icon="search" title="Search" />
    <IconBtn icon="bell" badge={true} badgeColor={P.warn} title="Alerts" />
    <button onClick={toggle} title="Toggle theme" style={{ width: 38, height: 38, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', borderRadius: P.r10, color: P.ink2, cursor: 'pointer' }}><Icon name={mode === 'light' ? 'moon' : 'sun'} size={18} stroke={1.9} /></button>
    <div style={{ width: 1, height: 26, background: P.hairline2, margin: '0 2px' }} />
    <button style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 8px 4px 4px', background: 'transparent', border: 'none', borderRadius: P.r10, cursor: 'pointer' }}>
      <Avatar name="Manisha Saini" size={32} />
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}><span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>Manisha Saini</span><span style={{ fontSize: 11.5, color: P.inkDim }}>Marketing</span></span>
      <Icon name="chevron-down" size={13} stroke={2} color={P.inkMute} />
    </button>
  </header>;
}

function Suite() {
  const P = useP();
  const [promos, setPromos] = useState(() => M.seedMerged());
  const [view, setView] = useState('home');
  const [builderId, setBuilderId] = useState(null); // null | 'new' | id
  const [draft, setDraft] = useState(null);
  const [bmode, setBmode] = useState('blocks');
  const [wstep, setWstep] = useState(0);
  const [analyticsId, setAnalyticsId] = useState(null);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const openBuilder = (id) => {
    if (id === 'new') {setDraft(window.newDraft());} else
    {const p = promos.find((x) => x.id === id);setDraft(M.mergedToDraft(p));}
    setBmode('blocks');setWstep(0);setBuilderId(id);
  };
  const openWmBuilder = (wm) => {
    setDraft({ wmReadonly: true, name: wm.name, code: wm.code || '', status: 'active', wm });
    setBmode('blocks');setWstep(0);setBuilderId('wm');
  };
  const saveBuilder = () => {
    const base = builderId !== 'new' ? promos.find((p) => p.id === builderId) : null;
    const merged = M.draftToMerged(draft, base);
    setPromos((prev) => prev.find((p) => p.id === merged.id) ? prev.map((p) => p.id === merged.id ? merged : p) : [merged, ...prev]);
    setBuilderId(null);setView('studio');
  };
  const dup = (id) => {const s = promos.find((p) => p.id === id);const c = { ...JSON.parse(JSON.stringify(s)), id: 'p' + Date.now(), name: s.name + ' (copy)', status: 'draft', perf: undefined };setPromos((prev) => [c, ...prev]);openBuilder(c.id);};
  const goAnalytics = (id) => {setAnalyticsId(id);setView('home');};

  // ── builder overlay ───────────────────────────────────────────────────────
  if (builderId) {
    return <div style={{ display: 'flex', height: '100vh', background: P.bg }}>
      <window.PRail active="promos" onNav={() => {}} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <window.BuilderTopBar mode={bmode} setMode={setBmode} draft={draft} onCancel={() => setBuilderId(null)} onSave={saveBuilder} />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <window.BuilderBlocks draft={draft} set={set} />
        </div>
      </div>
    </div>;
  }

  const TABS = [
  { value: 'home', label: 'Promotions' },
  { value: 'weedmaps', label: 'Weedmaps' },
  { value: 'studio', label: 'Studio' }];


  return <div style={{ display: 'flex', height: '100vh', background: P.bg, color: P.ink, fontFamily: P.fontSans, overflow: 'hidden' }}>
    <window.PRail active="promos" onNav={() => setView('home')} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
      <SuiteTopBar onNew={() => openBuilder('new')} />
      <div style={{ padding: '0 30px', borderBottom: `1px solid ${P.hairline2}`, background: P.surface, flex: '0 0 auto' }}>
        <Tabs value={view} onChange={setView} options={TABS} />
      </div>
      <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '26px 30px 56px' }}>
        {view === 'home' && <>
          <window.BrandMapView onNew={() => openBuilder('new')} />
          <div style={{ height: 1, background: P.hairline2, margin: '44px 0' }} />
          <window.PreviewView promos={promos} onOpen={openBuilder} />
          <div style={{ height: 1, background: P.hairline2, margin: '44px 0' }} />
          <window.LegacyDashboard promos={promos} onOpen={openBuilder} onNew={() => openBuilder('new')} onAnalytics={goAnalytics} onDuplicate={dup} />
        </>}
        {view === 'weedmaps' && <window.WeedmapsView promos={promos} setPromos={setPromos} onOpen={openBuilder} onOpenWm={openWmBuilder} />}
        {view === 'studio' && <window.StudioView promos={promos} setPromos={setPromos} onOpen={openBuilder} />}
      </main>
    </div>
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<ThemeProvider><Suite /></ThemeProvider>);