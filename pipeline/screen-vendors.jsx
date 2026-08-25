// ── /scorecards + /settings/flags ─────────────────────────────────────────
// Ports app/(shell)/scorecards + settings/flags and their components.
;(function () {
  const useP = window.useP;

  // Simple axis-less line chart for the 12-month cost trend.
  function LineChart({ data, height = 260, stroke, valueFormatter }) {
    const P = useP();
    const color = stroke || P.accent;
    const w = 720, padL = 44, padR = 12, padT = 12, padB = 26;
    const vals = data.map((d) => d.value);
    const min = Math.min(...vals), max = Math.max(...vals);
    const rng = max - min || 1;
    const x = (i) => padL + (i / Math.max(1, data.length - 1)) * (w - padL - padR);
    const y = (v) => padT + (1 - (v - min) / rng) * (height - padT - padB);
    const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(' ');
    const ticks = [min, min + rng / 2, max];
    return (
      <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} role="img" style={{ display: 'block' }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke={P.hairline2} strokeWidth="1" />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill={P.inkMute} fontFamily={P.fontMono}>${t.toFixed(0)}</text>
          </g>))}
        <path d={`${path} L ${x(data.length - 1)} ${height - padB} L ${x(0)} ${height - padB} Z`} fill={color} opacity={P.mode === 'dark' ? .12 : .08} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={d.label}>
            <circle cx={x(i)} cy={y(d.value)} r="2.5" fill={color}><title>{`${d.label} · ${valueFormatter ? valueFormatter(d.value) : d.value}`}</title></circle>
            <text x={x(i)} y={height - 8} textAnchor="middle" fontSize="10" fill={P.inkMute} fontFamily={P.fontSans}>{d.label}</text>
          </g>))}
      </svg>);
  }

  function Metric({ label, value, tone, sparkline }) {
    const P = useP(), HD = window.HD;
    const c = HD.tone(P, tone === 'brand' ? 'brand' : tone);
    return (
      <Card padding={0} style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ height: 4, width: '100%', background: c.fg }} />
        <div style={{ padding: '16px 20px 20px' }}>
          <MicroLabel>{label}</MicroLabel>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 30, lineHeight: 1, color: P.ink, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{value}</div>
            {sparkline && sparkline.length > 0 && <Spark data={sparkline} color={c.fg} width={100} height={36} fill />}
          </div>
        </div>
      </Card>);
  }

  function MetricCards({ vendor }) {
    const HD = window.HD;
    const m = vendor.metrics;
    const onTimeTone = m.onTimeRate > 0.92 ? 'ok' : m.onTimeRate > 0.82 ? 'warn' : 'blocked';
    const shortTone = m.shortShipRate < 0.03 ? 'ok' : m.shortShipRate < 0.08 ? 'warn' : 'blocked';
    const damageTone = m.damageRate < 0.01 ? 'ok' : m.damageRate < 0.04 ? 'warn' : 'blocked';
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <Metric label="On-time rate (90d)" value={HD.formatPercent(m.onTimeRate, 0)} tone={onTimeTone} sparkline={m.onTimeSparkline} />
        <Metric label="Short-ship rate (90d)" value={HD.formatPercent(m.shortShipRate, 1)} tone={shortTone} />
        <Metric label="Damage rate (90d)" value={HD.formatPercent(m.damageRate, 1)} tone={damageTone} />
        <Metric label="Promo honor rate" value={HD.formatPercent(m.promoHonorRate, 0)} tone={m.promoHonorRate > 0.95 ? 'ok' : 'warn'} />
        <Metric label="Outstanding AP" value={HD.formatCurrency(m.outstandingAP, { showCents: false })} tone="info" />
        <Metric label="Max invoice age" value={`${m.maxInvoiceAgeDays}d`} tone={m.maxInvoiceAgeDays > 45 ? 'blocked' : m.maxInvoiceAgeDays > 30 ? 'warn' : 'ok'} />
      </div>);
  }

  function VendorList({ vendors, selectedId, onSelect }) {
    const P = useP(), HD = window.HD;
    const [q, setQ] = React.useState('');
    const filtered = React.useMemo(() => {
      const s = q.toLowerCase().trim();
      const base = s ? vendors.filter((v) => v.name.toLowerCase().includes(s)) : vendors;
      return [...base].sort((a, b) => a.name.localeCompare(b.name));
    }, [q, vendors]);
    const warn = HD.tone(P, 'warn');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: 12, borderBottom: `1px solid ${P.hairline2}` }}>
          <Field icon="search" size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendor" />
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 4, flex: 1, overflow: 'auto' }}>
          {filtered.map((v) => {
            const selected = v.id === selectedId;
            return (
              <li key={v.id}>
                <button onClick={() => onSelect(v.id)}
                  style={{ width: '100%', textAlign: 'left', padding: 12, borderRadius: 10, cursor: 'pointer', fontFamily: P.fontSans,
                    background: selected ? P.surface3 : 'transparent', border: `1px solid ${selected ? P.ink : 'transparent'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13.5, color: P.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                    {v.alerts.length > 0 && <span style={{ fontSize: 11.5, background: warn.bg, color: warn.fg, padding: '2px 6px', borderRadius: 99, fontFamily: P.fontMono }}>{v.alerts.length}</span>}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 11.5, color: P.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{v.category}</span>
                    <span style={{ fontFamily: P.fontMono }}>{HD.formatCurrency(v.totalSpend90d, { showCents: false })}</span>
                  </div>
                </button>
              </li>);
          })}
        </ul>
      </div>);
  }

  window.ScreenScorecards = function ScreenScorecards() {
    const P = useP(), HD = window.HD;
    const VENDORS_FULL = window.HD_VENDORS.VENDORS_FULL;
    const [selectedId, setSelectedId] = React.useState(VENDORS_FULL[0]?.id ?? '');
    const vendor = VENDORS_FULL.find((v) => v.id === selectedId);
    if (!vendor) return null;
    const chartData = vendor.metrics.costTrend.map((d) => ({ label: d.month, value: d.avgUnitCost }));
    return (
      <div style={{ display: 'flex', height: '100%' }}>
        <aside style={{ width: 280, flex: '0 0 280px', borderRight: `1px solid ${P.hairline2}` }}>
          <VendorList vendors={VENDORS_FULL} selectedId={selectedId} onSelect={setSelectedId} />
        </aside>
        <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <MicroLabel>Vendor scorecard · Last 90 days</MicroLabel>
              <h1 style={{ margin: '2px 0 0', fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', color: P.ink, lineHeight: 1.1 }}>{vendor.name}</h1>
              <div style={{ fontSize: 13.5, color: P.ink2, marginTop: 4 }}>
                {vendor.category} · {vendor.totalInvoices90d} invoices · <span style={{ fontFamily: P.fontMono }}>{HD.formatCurrency(vendor.totalSpend90d, { showCents: false })}</span> spend
              </div>
            </div>
            {vendor.alerts.length > 0
              ? <HDPill tone="warn" icon={false} label={`${vendor.alerts.length} active alerts`} />
              : <HDPill tone="ok" icon={false} label="Healthy" />}
          </div>

          <MetricCards vendor={vendor} />

          <Card padding={0}>
            <div style={{ padding: '16px 20px 8px' }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.ink }}>Average unit cost · 12 months</h3></div>
            <div style={{ padding: '0 20px 20px' }}>
              <LineChart data={chartData} height={260} stroke={P.accent} valueFormatter={(v) => `$${v.toFixed(2)}`} />
            </div>
          </Card>

          <Card padding={0}>
            <div style={{ padding: '16px 20px 8px' }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.ink }}>Alerts &amp; anomalies</h3></div>
            <div style={{ padding: '0 20px 20px' }}>
              {vendor.alerts.length === 0
                ? <div style={{ fontSize: 13.5, color: P.ink2, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                  <Icon name="check-circle" size={16} stroke={2} color={HD.tone(P, 'ok').fg} />No anomalies in the last 14 days.
                </div>
                : <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {vendor.alerts.map((a) => (
                    <li key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12, borderRadius: 10, border: `1px solid ${P.hairline2}`, background: P.surface2 }}>
                      <Icon name={a.severity === 'blocked' ? 'x' : a.severity === 'warn' ? 'flag' : 'info'} size={16} stroke={2}
                        color={HD.tone(P, a.severity === 'blocked' ? 'blocked' : a.severity === 'warn' ? 'warn' : 'info').fg} />
                      <div style={{ flex: 1, fontSize: 13.5 }}>
                        <div style={{ color: P.ink }}>{a.message}</div>
                        <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 2, fontFamily: P.fontMono }}>{HD.formatDate(a.at)}</div>
                      </div>
                    </li>))}
                </ul>}
            </div>
          </Card>
        </div>
      </div>);
  };

  // ── Feature flags ───────────────────────────────────────────────────────
  const CATEGORIES = ['All', 'Intake', 'OCR', 'METRC', 'Batch', 'Credit', 'Anomaly', 'Email', 'Portal', 'RFID', 'Platform'];
  const SETTINGS_NAV = [
    { key: 'general', label: 'General' }, { key: 'users', label: 'Users & Roles' }, { key: 'flags', label: 'Feature Flags', active: true },
    { key: 'tolerance', label: 'Tolerance Rules' }, { key: 'notifications', label: 'Notifications' }, { key: 'audit', label: 'Audit Log' },
  ];

  function ValueCol({ label, value, sub, emphasize }) {
    const P = useP();
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    return (
      <div>
        <MicroLabel>{label}</MicroLabel>
        <div title={value} style={{ fontFamily: P.fontMono, fontSize: 13.5, marginTop: 2, color: emphasize ? accentInk : P.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
        {sub && <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{sub}</div>}
      </div>);
  }

  function FlagCard({ flag, onEdit, onReset }) {
    const P = useP();
    const modified = flag.value !== flag.default;
    return (
      <Card padding={20}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <code style={{ fontFamily: P.fontMono, fontSize: 13.5, color: P.ink, fontWeight: 600, wordBreak: 'break-all' }}>{flag.key}</code>
              {modified && <HDPill tone="brand" icon={false} size="sm" label="modified" />}
              <HDPill tone="neutral" icon={false} size="sm" label={flag.type} />
              <HDPill tone="info" icon={false} size="sm" label={flag.scope} />
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, color: P.ink2, lineHeight: 1.4 }}>{flag.description}</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${P.hairline2}` }}>
          <ValueCol label="Current" value={String(flag.value)} emphasize={modified} />
          <ValueCol label="Default" value={String(flag.default)} />
          {flag.type === 'number' && flag.min !== undefined && flag.max !== undefined
            ? <ValueCol label="Range" value={`${flag.min} – ${flag.max}`} />
            : <ValueCol label="Enum" value={flag.enumOptions?.join(', ') || '—'} />}
          <ValueCol label="Last changed" value={flag.lastChangedBy || '—'} sub={flag.lastChangedAt?.slice(0, 10)} />
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <PBtn size="sm" variant="accent" icon="pencil" onClick={onEdit}>Edit</PBtn>
          <PBtn size="sm" variant="secondary" icon="refresh" onClick={onReset} disabled={!modified}>Reset</PBtn>
          <PBtn size="sm" variant="ghost" icon="clock" style={{ marginLeft: 'auto' }}>History</PBtn>
        </div>
      </Card>);
  }

  function FlagEditModal({ flag, open, onClose, onSave }) {
    const P = useP();
    const [value, setValue] = React.useState('');
    const [reason, setReason] = React.useState('');
    const [testStaging, setTestStaging] = React.useState(true);
    React.useEffect(() => { if (flag) { setValue(String(flag.value)); setReason(''); setTestStaging(true); } }, [flag]);
    if (!flag || !open) return null;
    const sel = { width: '100%', height: 40, background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, fontSize: 13.5, padding: '0 12px', color: P.ink, fontFamily: P.fontSans };
    function handleSave() {
      if (!reason.trim()) { window.hdToast?.({ title: 'Reason required', description: 'Enter the reason for this flag change.', tone: 'warn' }); return; }
      let parsed = value;
      if (flag.type === 'number') parsed = Number(value);
      else if (flag.type === 'boolean') parsed = value === 'true';
      onSave(flag.key, parsed);
      window.hdToast?.({ title: 'Flag updated', description: `${flag.key} → ${parsed}. ${testStaging ? 'Staging test queued for 5 min.' : 'Applied immediately.'}`, tone: 'ok' });
      onClose();
    }
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: P.scrim }} />
        <Card padding={0} style={{ position: 'relative', width: 520, maxWidth: '92vw' }}>
          <div style={{ padding: 20 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.ink }}>Edit flag</h2>
            <div style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.inkMute, marginTop: 4 }}>{flag.key}</div>
            <p style={{ margin: '16px 0 0', fontSize: 13.5, color: P.ink2 }}>{flag.description}</p>
            <div style={{ marginTop: 16 }}>
              <MicroLabel style={{ marginBottom: 6 }}>New value</MicroLabel>
              {flag.type === 'boolean'
                ? <select value={value} onChange={(e) => setValue(e.target.value)} style={sel}><option value="true">true</option><option value="false">false</option></select>
                : flag.type === 'enum' && flag.enumOptions
                  ? <select value={value} onChange={(e) => setValue(e.target.value)} style={sel}>{flag.enumOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                  : <Field value={value} onChange={(e) => setValue(e.target.value)} type={flag.type === 'number' ? 'number' : 'text'} min={flag.min} max={flag.max} step={flag.type === 'number' && flag.max && flag.max < 2 ? '0.01' : '1'} />}
              <div style={{ marginTop: 6, fontSize: 11.5, color: P.inkMute }}>Default: <span style={{ fontFamily: P.fontMono }}>{String(flag.default)}</span></div>
            </div>
            <div style={{ marginTop: 16 }}>
              <MicroLabel style={{ marginBottom: 6 }}>Reason (required)</MicroLabel>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                placeholder="Why is this flag changing? e.g. STIIIZY invoices trending high variance — lowering auto-post threshold."
                style={{ width: '100%', padding: '10px 12px', background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, color: P.ink, fontSize: 13.5, fontFamily: P.fontSans, resize: 'vertical', outline: 'none' }} />
            </div>
            <label style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: P.ink2, cursor: 'pointer' }}>
              <Check on={testStaging} onChange={setTestStaging} size={18} />Test in staging for 5 minutes before applying to prod
            </label>
          </div>
          <div style={{ padding: 16, borderTop: `1px solid ${P.hairline2}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <PBtn variant="ghost" onClick={onClose}>Cancel</PBtn>
            <PBtn variant="accent" onClick={handleSave}>Apply change</PBtn>
          </div>
        </Card>
      </div>);
  }

  window.ScreenFlags = function ScreenFlags() {
    const P = useP();
    const [flags, setFlags] = React.useState(window.HD_VENDORS.FLAGS);
    const [category, setCategory] = React.useState('All');
    const [query, setQuery] = React.useState('');
    const [editingKey, setEditingKey] = React.useState(null);
    const [modalOpen, setModalOpen] = React.useState(false);
    const editing = flags.find((f) => f.key === editingKey) || null;
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;

    const filtered = React.useMemo(() => {
      let base = flags;
      if (category !== 'All') base = base.filter((f) => f.category === category);
      if (query.trim()) {
        const q = query.toLowerCase();
        base = base.filter((f) => f.key.toLowerCase().includes(q) || f.description.toLowerCase().includes(q));
      }
      return base;
    }, [flags, category, query]);

    const stamp = (f) => ({ ...f, lastChangedAt: new Date().toISOString(), lastChangedBy: 'Manisha Patel' });
    const handleSave = (key, newValue) => setFlags((prev) => prev.map((f) => (f.key === key ? stamp({ ...f, value: newValue }) : f)));
    const handleReset = (key) => {
      const flag = flags.find((f) => f.key === key);
      if (!flag) return;
      setFlags((prev) => prev.map((f) => (f.key === key ? stamp({ ...f, value: f.default }) : f)));
      window.hdToast?.({ title: 'Flag reset to default', description: `${key} → ${flag.default}`, tone: 'ok' });
    };

    return (
      <div style={{ display: 'flex', height: '100%' }}>
        <aside style={{ width: 200, flex: '0 0 200px', borderRight: `1px solid ${P.hairline2}`, padding: 12 }}>
          <MicroLabel style={{ padding: '6px 8px' }}>Settings</MicroLabel>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {SETTINGS_NAV.map((s) => (
              <li key={s.key}>
                <span aria-disabled={!s.active} style={{ display: 'flex', alignItems: 'center', height: 36, padding: '0 12px', borderRadius: 8, fontSize: 13.5, cursor: s.active ? 'default' : 'not-allowed',
                  background: s.active ? P.surface3 : 'transparent', color: s.active ? P.ink : P.inkFaint, border: `1px solid ${s.active ? P.ink : 'transparent'}` }}>{s.label}</span>
              </li>))}
          </ul>
        </aside>
        <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', color: P.ink, lineHeight: 1.1 }}>Feature flags</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13.5, color: P.inkDim, maxWidth: 620 }}>Runtime configuration for intake, OCR, METRC, and platform modules. Changes are audited and can be scoped per entity, role, or user.</p>
            </div>
            <div style={{ width: 320 }}>
              <Field icon="search" size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search flag key or description" aria-label="Search flags" />
            </div>
          </header>
          <Tabs value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: c }))} style={{ flexWrap: 'wrap', gap: 16 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 12, paddingBottom: 40 }}>
            {filtered.length === 0
              ? <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: P.inkMute, padding: '48px 0' }}>No flags match.</div>
              : filtered.map((f) => <FlagCard key={f.key} flag={f} onEdit={() => { setEditingKey(f.key); setModalOpen(true); }} onReset={() => handleReset(f.key)} />)}
          </div>
        </div>
        <FlagEditModal flag={editing} open={modalOpen} onClose={() => { setModalOpen(false); setEditingKey(null); }} onSave={handleSave} />
      </div>);
  };
})();
