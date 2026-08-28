// ── RFID Direction C — shell, router, paired view ──────────────────────────
// Direction C's argument, made structural: the handheld is the first-class
// surface and the desktop is the second one. The default route shows both,
// side by side, so the relationship is visible rather than asserted.
;(function () {
  const useP = window.useP, useTheme = window.useTheme;
  const R = () => window.RFID;

  const WORKFLOWS = [
    { id: 'kit',    label: 'Kit verification', sup: () => <window.SupKit /> },
    { id: 'count',  label: 'Cycle count',      sup: () => <window.SupCount /> },
    { id: 'tags',   label: 'Tag commissioning', sup: () => <window.SupTags /> },
    { id: 'system', label: 'How the two connect' },
  ];

  function parseHash() {
    const h = (location.hash || '').replace(/^#\/?/, '');
    const [w, s] = h.split('/');
    const wf = WORKFLOWS.find((x) => x.id === w) ? w : 'kit';
    const sf = ['both', 'hh', 'sup'].includes(s) ? s : 'both';
    return { wf, sf };
  }

  // ── The handheld pane: device + the screen index for this workflow ─────────
  function HandheldPane({ workflow, compact }) {
    const P = useP();
    const set = window.RFID_HH[workflow];
    const [screen, setScreen] = React.useState(set.order[0]);
    React.useEffect(() => { setScreen(window.RFID_HH[workflow].order[0]); }, [workflow]);
    const go = (id) => setScreen(id);
    // The workflow tab can change before the reset effect runs, so never trust
    // a screen id from the previous workflow.
    const cur = set.screens[screen] ? screen : set.order[0];
    const scanning = (workflow === 'kit' && cur === 'scan') || (workflow === 'count' && cur === 'walk');
    const idx = set.order.indexOf(cur);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <div style={{ background: P.bg2, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'stretch' }}>
            <window.Eyebrow>Primary surface</window.Eyebrow>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>
              {idx + 1} / {set.order.length}
            </span>
          </div>
          <window.TCDevice scanning={scanning} onTrigger={() => {
            const next = set.order[Math.min(set.order.length - 1, idx + 1)];
            setScreen(next);
          }}>
            {set.screens[cur].render({ go })}
          </window.TCDevice>
          <div style={{ alignSelf: 'stretch', fontSize: 11.5, color: P.inkMute, textAlign: 'center', lineHeight: 1.45 }}>
            Zebra TC22R · 5″ Android · integrated UHF · web UI in a WebView shell.
            The side triggers advance this prototype.
          </div>
        </div>

        <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden' }}>
          <div style={{ padding: '9px 14px', borderBottom: `1px solid ${P.hairline}`, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>
            {set.label} · handheld screens
          </div>
          {set.order.map((id, i) => {
            const a = id === cur;
            return (
              <button key={id} onClick={() => setScreen(id)} aria-pressed={a} style={{
                display: 'flex', width: '100%', alignItems: 'center', gap: 10, minHeight: 40, padding: '0 14px',
                background: a ? P.ink : 'transparent', color: a ? P.surface : P.ink2, border: 'none',
                borderTop: i === 0 ? 'none' : `1px solid ${a ? 'transparent' : P.hairline}`,
                cursor: 'pointer', fontFamily: P.fontSans, fontSize: 13, fontWeight: a ? 600 : 500, textAlign: 'left',
              }}>
                <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontVariantNumeric: 'tabular-nums', opacity: .7 }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ flex: 1 }}>{set.screens[id].label}</span>
                {a && <Icon name="chevron-right" size={14} stroke={2.2} />}
              </button>);
          })}
        </div>
      </div>);
  }

  // ── The relationship strip shown above a paired view ──────────────────────
  function PairNote() {
    const P = useP();
    const items = [
      { icon: 'scan', t: 'The handheld asserts', d: 'What was read, in which box, at what strength — and when the gate refused to assert anything at all.' },
      { icon: 'refresh', t: 'The module decides', d: 'argmax-RSSI, the −62 dBm gate, the SKU diff and the move list. Same result on both screens, computed once.' },
      { icon: 'shield', t: 'The desktop approves', d: 'Posting a kit, writing off a missing unit, rebinding an EPC. None of these are on the handheld, deliberately.' },
    ];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 }}>
        {items.map((it) => (
          <div key={it.t} style={{ display: 'flex', gap: 10, padding: '12px 14px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12 }}>
            <span style={{ width: 28, height: 28, borderRadius: P.r8, background: P.surface3, color: P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
              <Icon name={it.icon} size={15} stroke={1.9} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: P.ink }}>{it.t}</div>
              <div style={{ fontSize: 12, color: P.inkDim, marginTop: 3, lineHeight: 1.45 }}>{it.d}</div>
            </div>
          </div>))}
      </div>);
  }

  // ── System map ────────────────────────────────────────────────────────────
  function SystemMap() {
    const P = useP();
    const Node = ({ icon, title, sub, tone, wide }) => {
      const c = tone ? window.HD.tone(P, tone) : null;
      return (
        <div style={{ flex: wide ? 1.4 : 1, minWidth: 0, padding: '14px 14px', borderRadius: P.r12, background: c ? c.bg : P.surface, border: `1px solid ${c ? c.fg + '44' : P.hairline2}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 26, height: 26, borderRadius: P.r8, background: c ? c.fg + '26' : P.surface3, color: c ? c.fg : P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
              <Icon name={icon} size={14} stroke={2} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: P.ink }}>{title}</span>
          </div>
          <div style={{ marginTop: 7, fontSize: 12, color: P.inkDim, lineHeight: 1.45 }}>{sub}</div>
        </div>);
    };
    const Arrow = () => (
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', color: P.inkFaint, padding: '0 2px' }}>
        <Icon name="arrow-right" size={18} stroke={2} />
      </div>);

    const RIGHTS = [
      ['Read a box / walk a room', 'Handheld', 'Only the device has the radio.'],
      ['Assign a tag to a box', 'Module core', 'argmax-RSSI + the −62 dBm gate. Not a human judgement.'],
      ['Confirm a physical move', 'Handheld', 'The person holding the box ticks it off, one box at a time.'],
      ['Approve / post a kit', 'Supervisor', 'A kit with exceptions must be accepted by a person.'],
      ['Close a straggler as missing', 'Supervisor', 'Shrink is an accounting decision, never a scan result.'],
      ['Rebind an EPC to a retail ID', 'Supervisor', '1:1 is enforced at commissioning; overriding it writes an audit event.'],
      ['Change RF power or the gate', 'Supervisor', 'Non-default gate values are written to the audit log.'],
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100 }}>
        <window.SectionHead level={2} eyebrow="Direction C" title="One session, two surfaces"
          subtitle="The operator app and the supervisor console are not two products. They read the same session, computed once by the module core, and they hold different powers on purpose." />

        <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <window.Eyebrow>Read path</window.Eyebrow>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
            <Node icon="smartphone" title="TC22R radio" sub="Reduced power. Every read carries RSSI." tone="info" />
            <Arrow />
            <Node icon="link" title="WebView bridge" sub="The only hardware-aware layer. Connect · set power · stream reads · trigger · battery." />
            <Arrow />
            <Node icon="refresh" title="Module core" sub="Best-RSSI collapse → argmax → confidence gate → SKU diff → move list. Pure, no I/O." tone="ok" wide />
            <Arrow />
            <Node icon="database" title="Hyperdrive" sub="Owns the plan, the registry and the DB, behind ports this module never reaches around." />
          </div>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
            <Node icon="scan" title="Operator app" sub="Same result, shaped for a hand: one question per screen, action under the thumb." wide />
            <Arrow />
            <Node icon="layout" title="Supervisor console" sub="Same result, shaped for a desk: every line, every box, every audit event, and the approve button." wide />
          </div>
          <div style={{ fontSize: 12, color: P.inkMute, lineHeight: 1.5 }}>
            Neither surface re-implements the algorithm. If the two ever disagreed, one of them would
            be lying — so neither is allowed to compute.
          </div>
        </div>

        <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${P.hairline}` }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: P.ink }}>Decision rights</div>
            <div style={{ fontSize: 12, color: P.inkMute, marginTop: 2 }}>Which surface is allowed to do what, and why it sits there.</div>
          </div>
          <window.HDTable>
            <thead><tr>
              <window.TH width={280}>Decision</window.TH>
              <window.TH width={150}>Owned by</window.TH>
              <window.TH>Why</window.TH>
            </tr></thead>
            <tbody>
              {RIGHTS.map((r, i) => (
                <window.TR key={i}>
                  <window.TD>{r[0]}</window.TD>
                  <window.TD>
                    <window.HDPill size="sm" icon={false} tone={r[1] === 'Supervisor' ? 'info' : r[1] === 'Handheld' ? 'neutral' : 'ok'} label={r[1]} />
                  </window.TD>
                  <window.TD style={{ color: P.inkDim }}>{r[2]}</window.TD>
                </window.TR>))}
            </tbody>
          </window.HDTable>
        </div>

        <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, padding: 18 }}>
          <window.Eyebrow>Known gaps this design does not paper over</window.Eyebrow>
          <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12.5, color: P.inkDim, lineHeight: 1.7 }}>
            <li>One TC22R exists. Multi-operator cycle counting is drawn but cannot be validated yet — the console says so rather than showing a fleet that isn’t there.</li>
            <li>The Android shell is a contract, not a verified integration. Per-read RSSI and programmatic RF power still need confirming on the real device.</li>
            <li>The ZT411 ZPL has never been run. The commissioning console carries that warning permanently until someone prints one and reads it back.</li>
            <li>The −62 dBm gate and the reduced-power setpoint are simulation-validated only. Both are shown on the handheld so a miscalibration is visible, not buried.</li>
            <li>No on-metal label stock was purchased, so “likely cause: behind metal shelf” is a procurement finding, not a scanning bug.</li>
          </ul>
        </div>
      </div>);
  }

  // ── Shell ─────────────────────────────────────────────────────────────────
  function Shell() {
    const P = useP(), { mode, toggle } = useTheme();
    const [route, setRoute] = React.useState(parseHash);
    React.useEffect(() => {
      const h = () => setRoute(parseHash());
      addEventListener('hashchange', h);
      if (!location.hash) location.hash = '#/kit/both';
      return () => removeEventListener('hashchange', h);
    }, []);
    const nav = (wf, sf) => { location.hash = `#/${wf}/${sf || route.sf}`; };
    const wf = WORKFLOWS.find((w) => w.id === route.wf);
    const isSystem = route.wf === 'system';

    return (
      <div style={{ height: '100vh', display: 'flex', overflow: 'hidden', background: P.canvas }}>
        <window.HWRail active="rfid" />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* top bar */}
          <div style={{ flex: '0 0 auto', background: P.surface, borderBottom: `1px solid ${P.hairline2}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 0' }}>
              <div style={{ minWidth: 0 }}>
                <window.Eyebrow>Hyperdrive · RFID scanning module</window.Eyebrow>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>Direction C — Operator-first</h1>
                  <window.Pill kind="neutral" size="sm">device-shaped</window.Pill>
                </div>
              </div>
              <span style={{ flex: 1 }} />
              {!isSystem && (
                <window.Seg size="sm" value={route.sf} onChange={(v) => nav(route.wf, v)} options={[
                  { value: 'both', label: 'Both', icon: 'grid' },
                  { value: 'hh', label: 'Handheld', icon: 'smartphone' },
                  { value: 'sup', label: 'Supervisor', icon: 'layout' },
                ]} />)}
              <window.IconBtn icon={mode === 'dark' ? 'sun' : 'moon'} label="Toggle theme" onClick={toggle} />
            </div>
            <div style={{ padding: '0 20px' }}>
              <window.Tabs value={route.wf} onChange={(v) => nav(v)} options={WORKFLOWS.map((w) => ({ value: w.id, label: w.label }))} style={{ marginTop: 10, borderBottom: 'none' }} />
            </div>
          </div>

          {/* body */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 20 }}>
            {isSystem ? <SystemMap /> : route.sf === 'hh' ? (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ width: 460 }}><HandheldPane workflow={route.wf} /></div>
              </div>
            ) : route.sf === 'sup' ? (
              wf.sup()
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <PairNote />
                <div className="rfid-pair" style={{ display: 'grid', gridTemplateColumns: '460px minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
                  <div style={{ position: 'sticky', top: 0 }}><HandheldPane workflow={route.wf} /></div>
                  <div style={{ minWidth: 0 }}>{wf.sup()}</div>
                </div>
              </div>)}
          </div>
        </div>
        <window.ToastHost />
      </div>);
  }

  /* == WHERE A FAILURE STOPS IN THE RFID STUDY (DIRECTION C) ==
   * CONTAINS. The boundaries sit at shell level, so the app renders whole or shows a
   * named panel -- there is no partial state that reads as a complete screen.
   * !! RENDER AND LIFECYCLE ERRORS ONLY -- not event handlers, not async work. */
  if (!window.ScreenBoundary || !window.CriticalBoundary) {
    try {console.error('[HW boundary] rfid-direction-c/index.html did not load shared/error-boundary.jsx — ' +
      'the RFID study (direction C) is running with NO error boundaries.');} catch (e) {}
  }
  const RfidFrame = window.ScreenBoundary || function RfidFrame(p) {return p.children;};

  ReactDOM.createRoot(document.getElementById('root')).render(
    <window.ThemeProvider><RfidFrame name="The RFID console"><Shell /></RfidFrame></window.ThemeProvider>
  );
})();
