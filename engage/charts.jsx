// ── Chart primitives for the Engage analytics suite ───────────────────────
// Mirrors components/charts/{bar-chart,line-chart} + console/rfm-matrix.
;(function () {
  const useP = window.useP;

  const CHART_HUES = ['violet', 'teal', 'pink', 'green', 'blue'];
  const chartColor = (P, i) => window.HD.hueColor(P, CHART_HUES[i % CHART_HUES.length]);

  window.EBar = function EBar({ rows, valueFormat, height = 10 }) {
    const P = useP();
    const max = Math.max(...rows.map((r) => r.value), 0.0001);
    return (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r, i) => (
          <li key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 92, flex: '0 0 92px', fontSize: 12, color: P.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
            <span style={{ flex: 1, height, borderRadius: 99, background: P.surface3, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${(r.value / max) * 100}%`, background: r.color || chartColor(P, i), borderRadius: 99 }} />
            </span>
            <span style={{ width: 76, textAlign: 'right', fontSize: 12, fontFamily: P.fontMono, color: P.ink }}>{valueFormat ? valueFormat(r.value) : r.value}</span>
          </li>))}
      </ul>);
  };

  window.ELine = function ELine({ series, labels, height = 220, valueFormat, yMaxOverride }) {
    const P = useP();
    const w = 720, padL = 44, padR = 12, padT = 12, padB = 26;
    const all = series.flatMap((s) => s.data);
    const max = yMaxOverride ?? Math.max(...all, 1);
    const min = 0;
    const x = (i, n) => padL + (i / Math.max(1, n - 1)) * (w - padL - padR);
    const y = (v) => padT + (1 - (v - min) / (max - min || 1)) * (height - padT - padB);
    const ticks = [min, max / 2, max];
    return (
      <div>
        <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} role="img" style={{ display: 'block' }}>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke={P.hairline2} strokeWidth="1" />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill={P.inkMute} fontFamily={P.fontMono}>{valueFormat ? valueFormat(t) : Math.round(t)}</text>
            </g>))}
          {series.map((s, si) => {
            const color = s.color || chartColor(P, si);
            const path = s.data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i, s.data.length).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
            return (
              <g key={s.name}>
                <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {s.data.map((v, i) => <circle key={i} cx={x(i, s.data.length)} cy={y(v)} r="2.2" fill={color}><title>{`${labels[i]} · ${s.name} · ${valueFormat ? valueFormat(v) : v}`}</title></circle>)}
              </g>);
          })}
          {labels.map((l, i) => (i % Math.ceil(labels.length / 8) === 0
            ? <text key={l + i} x={x(i, labels.length)} y={height - 8} textAnchor="middle" fontSize="10" fill={P.inkMute}>{l}</text>
            : null))}
        </svg>
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {series.map((s, si) => (
            <span key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: P.inkDim }}>
              <span style={{ height: 8, width: 8, borderRadius: 99, background: s.color || chartColor(P, si) }} />{s.name}
            </span>))}
        </div>
      </div>);
  };

  window.EStrip = function EStrip({ days, label }) {
    const P = useP();
    const min = Math.min(...days.map((d) => d.rate));
    return (
      <div style={{ marginTop: 18, borderTop: `1px solid ${P.hairline2}`, paddingTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 500, color: P.inkMute }}>{label} · {days.length} days</p>
          <p style={{ margin: 0, fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>floor {(min * 100).toFixed(2)}%</p>
        </div>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'flex-end', gap: 3, height: 40 }}>
          {days.map((d) => (
            <div key={d.day} title={`${d.day} · ${(d.rate * 100).toFixed(2)}%`}
              style={{ flex: 1, borderRadius: 3, background: P.accent, opacity: .55, height: `${Math.max(14, Math.round(d.rate * 100))}%` }} />))}
        </div>
      </div>);
  };

  window.ERfmMatrix = function ERfmMatrix({ cells, total, onCell }) {
    const P = useP(), HD = window.HD;
    const max = Math.max(...cells.map((c) => c.count), 1);
    const get = (r, f) => cells.find((c) => c.r === r && c.f === f);
    return (
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          {[5, 4, 3, 2, 1].map((r) => <div key={r} style={{ height: 52, display: 'flex', alignItems: 'center', fontSize: 10, fontFamily: P.fontMono, color: P.inkMute }}>R{r}</div>)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
            {[5, 4, 3, 2, 1].flatMap((r) => [1, 2, 3, 4, 5].map((f) => {
              const cell = get(r, f);
              const count = cell?.count || 0;
              const intensity = count / max;
              return (
                <button key={`${r}-${f}`} onClick={() => onCell?.(r, f, count)} title={`R${r} F${f} · ${HD.formatNumber(count)} customers`}
                  style={{ height: 52, borderRadius: 8, border: `1px solid ${P.hairline2}`, cursor: 'pointer', fontFamily: P.fontMono, fontSize: 11,
                    background: count === 0 ? P.surface2 : `color-mix(in oklab, ${P.accent} ${Math.round(18 + intensity * 72)}%, ${P.surface})`,
                    color: intensity > 0.55 ? (P.mode === 'dark' ? '#15140f' : P.ink) : P.ink2 }}>
                  {count ? HD.formatNumber(count) : '—'}
                </button>);
            }))}
          </div>
          <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((f) => <div key={f} style={{ textAlign: 'center', fontSize: 10, fontFamily: P.fontMono, color: P.inkMute }}>F{f}</div>)}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 11, color: P.inkMute }}>R5 = most recent · F5 = most frequent · {HD.formatNumber(total)} customers bucketed</p>
        </div>
      </div>);
  };

  window.EHeatRow = function EHeatRow({ label, values, format }) {
    const P = useP();
    const max = Math.max(...values, 1);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 74, flex: '0 0 74px', fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{label}</span>
        <div style={{ flex: 1, display: 'flex', gap: 3 }}>
          {values.map((v, i) => (
            <div key={i} title={format ? format(v) : String(v)} style={{ flex: 1, height: 26, borderRadius: 4, border: `1px solid ${P.hairline}`,
              background: v === 0 ? P.surface2 : `color-mix(in oklab, ${P.accent} ${Math.round(15 + (v / max) * 70)}%, ${P.surface})` }} />))}
        </div>
      </div>);
  };

  window.EChartColor = chartColor;
})();
