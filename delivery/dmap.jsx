// ── Delivery KML map — combined homescreen (3 style options) + single-region.
// Schematic dark map: county-colored sub-region polygons, dashed buffer zones,
// labels, and driver pins. mode: 'filled' | 'outline' | 'grouped'.
const useP = window.useP;
const D = window.DDATA;

function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);let r = n >> 16,g = n >> 8 & 255,b = n & 255;
  r = Math.round(r + (255 - r) * amt);g = Math.round(g + (255 - g) * amt);b = Math.round(b + (255 - b) * amt);
  return `rgb(${r},${g},${b})`;
}

// faint "streets" backdrop so it reads as a map, not a chart
function MapBackdrop() {
  return <g opacity="0.5">
    <rect width="1000" height="640" fill="#15151a" />
    <path d="M-20,300 Q250,240 520,320 T1020,300" fill="none" stroke="#2a2a31" strokeWidth="6" />
    <path d="M300,-20 Q360,240 300,660" fill="none" stroke="#2a2a31" strokeWidth="5" />
    <path d="M-20,440 Q420,400 1020,470" fill="none" stroke="#242429" strokeWidth="4" />
    <path d="M640,-20 Q700,300 560,660" fill="none" stroke="#242429" strokeWidth="4" />
    {Array.from({ length: 22 }).map((_, i) => <line key={'h' + i} x1="0" x2="1000" y1={i * 30} y2={i * 30} stroke="#ffffff" strokeWidth="0.5" opacity="0.03" />)}
    {Array.from({ length: 34 }).map((_, i) => <line key={'v' + i} y1="0" y2="640" x1={i * 30} x2={i * 30} stroke="#ffffff" strokeWidth="0.5" opacity="0.03" />)}
  </g>;
}

function RegionLabel({ sr, mode }) {
  const [cx, cy] = D.centroid(sr.pts);const c = D.COUNTY_BY_ID[sr.county].color;
  if (mode === 'outline') return <text x={cx} y={cy} textAnchor="middle" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 15, fontWeight: 800, fill: '#fff' }}>{sr.id}</text>;
  return <g transform={`translate(${cx},${cy})`}>
    <rect x={-30} y={-15} width={60} height={30} rx={8} fill="rgba(10,10,14,.72)" stroke={c} strokeWidth={1} />
    <text x={0} y={-2} textAnchor="middle" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12.5, fontWeight: 800, fill: '#fff' }}>{sr.id}</text>
    <text x={0} y={10} textAnchor="middle" style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fill: 'rgba(255,255,255,.65)' }}>{sr.city}</text>
  </g>;
}

window.DeliveryMap = function DeliveryMap({ mode = 'filled', showBuffer = true, showLabels = true, showPins = true, focus = null, height = 460, subset }) {
  const regions = (subset || D.SUBREGIONS).filter((s) => !focus || s.id === focus);
  const counties = [...new Set(regions.map((s) => s.county))];
  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,.08)', background: '#101014' }}>
      <svg viewBox="0 0 1000 640" style={{ display: 'block', width: '100%', height }}>
        <MapBackdrop />
        {/* GROUPED: soft county halo behind each county's subs */}
        {mode === 'grouped' && counties.map((cid) => {
          const c = D.COUNTY_BY_ID[cid].color;
          return <g key={'halo' + cid}>{regions.filter((s) => s.county === cid).map((s) => <path key={s.id} d={D.bufferPath(s.pts, 6)} fill={c} opacity="0.14" stroke="none" />)}</g>;
        })}
        {/* buffer zones — dashed, lighter shade of the county color */}
        {showBuffer && regions.map((s) => {
          const c = D.COUNTY_BY_ID[s.county].color;const b = D.effSettings(s).buffer;
          return <path key={'buf' + s.id} d={D.bufferPath(s.pts, b)} fill="none" stroke={lighten(c, .35)} strokeWidth={mode === 'outline' ? 2.2 : 1.8} strokeDasharray={mode === 'outline' ? '10 7' : '7 6'} opacity={mode === 'grouped' ? .55 : .8} />;
        })}
        {/* sub-region polygons */}
        {regions.map((s) => {
          const c = D.COUNTY_BY_ID[s.county].color;
          const fill = mode === 'filled' ? c : mode === 'grouped' ? c : 'none';
          const fo = mode === 'filled' ? focus ? .26 : .2 : mode === 'grouped' ? .1 : .04;
          const sw = mode === 'outline' ? 2.8 : mode === 'grouped' ? 1.5 : 2;
          return <path key={s.id} d={D.toPath(s.pts)} fill={fill} fillOpacity={fo} stroke={c} strokeWidth={sw} strokeLinejoin="round" opacity={s.status === 'off' ? .55 : 1} />;
        })}
        {/* GROUPED: county-level big label at avg centroid */}
        {mode === 'grouped' && counties.map((cid) => {
          const subs = regions.filter((s) => s.county === cid);const cs = subs.map((s) => D.centroid(s.pts));
          const cx = cs.reduce((a, p) => a + p[0], 0) / cs.length;const cy = cs.reduce((a, p) => a + p[1], 0) / cs.length;
          const c = D.COUNTY_BY_ID[cid].color;
          return <g key={'clbl' + cid} transform={`translate(${cx},${cy})`}>
            <text x={0} y={0} textAnchor="middle" style={{ fontFamily: 'Inter, sans-serif', fontSize: 21, fontWeight: 800, fill: '#fff' }}>{cid}</text>
            <rect x={-26} y={9} width={52} height={5} rx={2.5} fill={c} />
          </g>;
        })}
        {/* labels */}
        {showLabels && mode !== 'grouped' && regions.map((s) => <RegionLabel key={'lbl' + s.id} sr={s} mode={mode} />)}
        {/* driver pins */}
        {showPins && regions.filter((s) => s.status === 'on').map((s) => {
          const [cx, cy] = D.centroid(s.pts);const c = D.COUNTY_BY_ID[s.county].color;const py = mode === 'grouped' ? cy + 26 : cy + 22;
          return <g key={'pin' + s.id}><circle cx={cx} cy={py} r={7} fill={c} stroke="#fff" strokeWidth={2.5} /></g>;
        })}
      </svg>
      {/* legend */}
      <div style={{ position: 'absolute', left: 12, bottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 11px', background: 'rgba(12,12,16,.82)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, backdropFilter: 'blur(4px)' }}>
        {(focus ? counties : D.COUNTIES.map((c) => c.id)).map((cid) => {
          const c = D.COUNTY_BY_ID[cid];
          return <span key={cid} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,.8)', fontFamily: 'Inter, sans-serif' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c.color }} />{c.id}</span>;
        })}
        {showBuffer && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'rgba(255,255,255,.6)', fontFamily: 'Inter, sans-serif' }}><span style={{ width: 14, borderTop: '2px dashed rgba(255,255,255,.6)' }} />buffer</span>}
      </div>
    </div>);
};