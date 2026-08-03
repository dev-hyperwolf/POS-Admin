// ── /scan — mobile floor intake ───────────────────────────────────────────
// Port of app/scan/page.tsx + components/scan/{offline-chip,scan-history}.tsx.
;(function () {
  const useP = window.useP;

  const SIM_PRODUCTS = [
    'Kiva Terra Bites Milk Chocolate Espresso 100mg',
    'STIIIZY Pod Live Resin Blue Dream 0.5g',
    'Jeeter Baby Cannon Churros 1.3g',
    'Lowell Reserve Preroll 5-pack Sativa',
    'Wyld Real Fruit Raspberry Sativa 100mg',
    'Heavy Hitters Cartridge OG Kush 1g',
    'Cann Blood Orange Cardamom 6-pack',
  ];

  const INITIAL_SCAN_HISTORY = [
    { id: 's-1', at: new Date(window.HD_DATA.NOW - 5 * 60000).toISOString(), code: '1A4060300012345670000A9C3F', productName: 'Kiva Terra Bites Milk Chocolate Espresso 100mg', qty: 48, success: true },
    { id: 's-2', at: new Date(window.HD_DATA.NOW - 14 * 60000).toISOString(), code: '1A4060300012345670000B1E27', productName: 'STIIIZY Pod Live Resin Blue Dream 0.5g', qty: 60, success: true },
    { id: 's-3', at: new Date(window.HD_DATA.NOW - 23 * 60000).toISOString(), code: '1A4060300012345670000C7F91', productName: 'Wyld Real Fruit Raspberry Sativa 100mg', qty: 72, success: true },
    { id: 's-4', at: new Date(window.HD_DATA.NOW - 41 * 60000).toISOString(), code: '1A4060300012345670000D4A08', productName: 'Jeeter Baby Cannon Churros 1.3g', qty: 36, success: true },
  ];

  function fakeMetrcCode() {
    const chars = '0123456789ABCDEF';
    let s = '1A40603000123456700';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * 16)];
    return s;
  }

  function OfflineChip({ online, onToggle }) {
    const P = useP(), HD = window.HD;
    const c = HD.tone(P, online ? 'ok' : 'warn');
    return (
      <button onClick={onToggle} aria-label={online ? 'Online — toggle to simulate offline' : 'Offline — toggle to simulate online'}
        style={{ height: 28, padding: '0 10px', borderRadius: 99, fontSize: 12, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, background: c.bg, color: c.fg, border: 'none', cursor: 'pointer', fontFamily: P.fontSans }}>
        <Icon name={online ? 'link' : 'x'} size={12} stroke={2} />{online ? 'Online' : 'Offline · queueing'}
      </button>);
  }

  function ScanHistory({ items }) {
    const P = useP(), HD = window.HD;
    const ok = HD.tone(P, 'ok');
    return (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map((s, i) => (
          <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
            <div style={{ height: 32, width: 32, borderRadius: 99, background: ok.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
              <Icon name="check" size={14} stroke={2.6} color={ok.fg} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: P.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.productName}</div>
              <div style={{ fontFamily: P.fontMono, fontSize: 11, color: P.inkMute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.code}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: P.fontMono, fontSize: 13, color: P.ink }}>{s.qty}</div>
              <div style={{ fontSize: 11, color: P.inkMute }}>{HD.relativeTime(s.at, Date.now())}</div>
            </div>
          </li>))}
      </ul>);
  }

  window.ScreenScan = function ScreenScan({ navigate }) {
    const P = useP();
    const [online, setOnline] = React.useState(true);
    const [history, setHistory] = React.useState(INITIAL_SCAN_HISTORY);
    const [flash, setFlash] = React.useState(false);
    const [manualOpen, setManualOpen] = React.useState(false);
    const [manualCode, setManualCode] = React.useState('');
    const [manualQty, setManualQty] = React.useState('');
    const [pulse, setPulse] = React.useState(false);
    const last = history[0];
    const trackingId = 'MAN-2026-04-20-0418';

    function simulateScan() {
      const product = SIM_PRODUCTS[Math.floor(Math.random() * SIM_PRODUCTS.length)];
      const qty = 12 + Math.floor(Math.random() * 72);
      const entry = { id: `s-${Date.now()}`, at: new Date().toISOString(), code: fakeMetrcCode(), productName: product, qty, success: true };
      setHistory((h) => [entry, ...h].slice(0, 20));
      setPulse(true);
      setTimeout(() => setPulse(false), 500);
      if (navigator.vibrate) navigator.vibrate(40);
      window.hdToast?.({ title: online ? 'Scanned' : 'Queued (offline)', description: `${product} · qty ${qty}`, tone: 'ok' });
    }

    function submitManual() {
      if (!manualCode.trim() || !manualQty.trim()) {
        window.hdToast?.({ title: 'Both fields required', description: 'Enter a package ID and a quantity.', tone: 'warn' });
        return;
      }
      const product = SIM_PRODUCTS[Math.floor(Math.random() * SIM_PRODUCTS.length)];
      const entry = { id: `s-${Date.now()}`, at: new Date().toISOString(), code: manualCode.trim(), productName: product, qty: Number(manualQty), success: true };
      setHistory((h) => [entry, ...h].slice(0, 20));
      setManualOpen(false); setManualCode(''); setManualQty('');
      window.hdToast?.({ title: 'Manual entry added', description: `${product} · qty ${entry.qty}`, tone: 'ok' });
    }

    return (
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', position: 'relative', background: P.canvas }}>
        <header style={{ height: 56, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderBottom: `1px solid ${P.hairline2}`, flex: '0 0 auto' }}>
          <IconBtn icon="arrow-left" size={18} onClick={() => navigate('#/inbox')} title="Back" style={{ width: 36, height: 36 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <MicroLabel>Intake · manifest</MicroLabel>
            <div style={{ fontFamily: P.fontMono, fontSize: 13, color: P.ink }}>{trackingId}</div>
          </div>
          <OfflineChip online={online} onToggle={() => setOnline((o) => !o)} />
        </header>

        <div style={{ padding: 16 }}>
          <div style={{ position: 'relative', aspectRatio: '4 / 5', width: '100%', borderRadius: 18, overflow: 'hidden', border: `1px solid ${P.hairline3}`,
            background: `radial-gradient(circle at center, ${P.accent}12 0, transparent 60%), linear-gradient(180deg, ${P.rail} 0%, color-mix(in oklab, ${P.rail} 62%, black) 100%)` }}>
            <div style={{ position: 'absolute', inset: 24, border: `1px solid ${P.accent}44`, borderRadius: 12 }} />
            <div style={{ position: 'absolute', left: 24, right: 24, top: '50%', height: 2, background: P.accent, boxShadow: `0 0 12px ${P.accent}`, opacity: pulse ? 0 : .8, transition: 'opacity .7s' }} />
            <div style={{ position: 'absolute', top: 12, right: 12 }}>
              <button onClick={() => setFlash((f) => !f)} aria-label={flash ? 'Turn torch off' : 'Turn torch on'}
                style={{ height: 36, width: 36, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer',
                  background: flash ? P.accent : 'rgba(255,255,255,.12)', color: flash ? P.accentInk : 'rgba(255,255,255,.8)' }}>
                <Icon name="lightning" size={16} />
              </button>
            </div>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 96, textAlign: 'center', color: 'rgba(255,255,255,.55)', fontSize: 12, fontWeight: 500, pointerEvents: 'none' }}>
              Align package barcode in frame · tap to simulate
            </div>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <button onClick={simulateScan} aria-label="Simulate scan"
                style={{ height: 64, width: 64, borderRadius: 99, background: P.accent, color: P.accentInk, border: 'none', boxShadow: `0 8px 32px ${P.accent}59`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="scan" size={24} stroke={2} />
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '0 16px' }}>
          <Card padding={16} radius={18}>
            <MicroLabel style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="package" size={12} stroke={2} /> Last scan</MicroLabel>
            {last ? (
              <React.Fragment>
                <div style={{ fontSize: 15, color: P.ink, fontWeight: 500, marginTop: 4, lineHeight: 1.3 }}>{last.productName}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <div style={{ fontFamily: P.fontMono, fontSize: 11, color: P.inkMute }}>{last.code}</div>
                  <div style={{ fontFamily: P.fontMono, fontSize: 15, color: P.ink, fontWeight: 600 }}>Qty {last.qty}</div>
                </div>
              </React.Fragment>
            ) : <div style={{ fontSize: 13, color: P.inkMute, marginTop: 4 }}>No scans yet. Tap the shutter to start.</div>}
          </Card>
        </div>

        <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <MicroLabel>Recent scans</MicroLabel>
            <span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{history.length} total</span>
          </div>
          <Card padding={16} radius={18}><ScanHistory items={history.slice(0, 5)} /></Card>
        </div>

        <button onClick={() => setManualOpen(true)}
          style={{ position: 'sticky', bottom: 20, alignSelf: 'flex-end', marginRight: 20, height: 56, padding: '0 20px', borderRadius: 99, background: P.accent, color: P.accentInk, border: 'none', boxShadow: P.shadowLg, display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: P.fontSans, zIndex: 40 }}>
          <Icon name="plus" size={18} stroke={2.4} />Manual entry
        </button>

        {manualOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={() => setManualOpen(false)} style={{ position: 'absolute', inset: 0, background: P.scrim }} />
            <Card padding={0} style={{ position: 'relative', width: 420, maxWidth: '92vw' }}>
              <div style={{ padding: 20 }}>
                <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 600, color: P.ink }}>Manual entry</h2>
                <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, marginBottom: 6 }}>METRC package ID</label>
                <Field mono value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="1A4060300012345670000…" autoComplete="off" />
                <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, margin: '12px 0 6px' }}>Quantity</label>
                <Field value={manualQty} onChange={(e) => setManualQty(e.target.value)} type="number" inputMode="numeric" placeholder="48" />
              </div>
              <div style={{ padding: 16, borderTop: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <PBtn variant="ghost" onClick={() => setManualOpen(false)}>Cancel</PBtn>
                <PBtn variant="accent" icon="cart" onClick={submitManual}>Add to intake</PBtn>
              </div>
            </Card>
          </div>)}
      </div>);
  };
})();
