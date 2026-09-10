// ── idv/screen-usage.jsx ── #/usage — per-feature counts, honestly costed ──
// Design: explorations/Verify - Concept A - Console.html tab "10 · Usage" (layout, the
// window/cumulative split, the "no invented prices" rule). Contract: docs/IDV-API-
// CONTRACT.md §"Usage, audit, team, retention" — GET /api/idv/usage?from&to&feature
// -> { idv_version, window, rows: [{ feature, n_window, n_cumulative, unit_cost_cents,
// cost_cents, cost_note }], imported: {...} }. Plan: docs/IDV-PLAN-2026-09-08.md §3.9 (idv_usage
// table, one row written per engine run, per feature) and §5.3 (honesty labelling: "Usage cost
// column: 'no per-check fee (own engine)'; hosting cost not shown because it is not metered").
//
// THE CORRECTION THIS SCREEN EXISTS TO CARRY: scratch/idv-didit-console-crossref-2026-09-08.md —
// the Didit console's own Usage page shows CUMULATIVE counts (9,391 lifetime ID Verification
// reads), not a monthly rate; an earlier brief read that figure as "~9,400 a month" and was wrong
// by roughly sixty times. Every number this screen shows is therefore labelled with which one it
// is — "this window" vs "cumulative" — in the column header itself, not just in a caption.
//
// NOTHING HERE IS FABRICATED. The cost columns print exactly what the API sends: unit_cost_cents
// and cost_cents are 0 for every engine-run feature (own engine, no per-check fee), and the
// cost_note string ("no per-check fee (own engine)") is relayed verbatim, never reworded and
// never replaced with an invented hosting number. Didit's own per-feature prices are not part of
// this contract at all (the API has no field for them) — the one place this screen mentions them
// is a static, number-free line pointing at the cross-reference doc, not a re-typed price list.
//
// ── "Time to verify" (2026-09-10 Addendum 3) ───────────────────────────────
// Second, independent section, GET /api/idv/stats/timing?from&to&preset&bucket&age_band&sex&
// state&os&browser -> { filters, count, decided, total_s:{median,mean,p90}, base_s:{...},
// retake_s:{...}, before_open_s:{...}, steps:{document_front:{median_s,p90_s},...},
// buckets:[{start,count,median_s,p90_s}...], breakdown:{age_band:{...},sex:{...},state:{...},
// os:{...},browser:{...}} }. Its own poll, its own loading/error states, rendered in its own
// component (TimeToVerifySection) so a slow or failed per-feature fetch below never hides it and
// vice versa. FILTERS LIVE IN THE URL, same rule screen-sessions.jsx states for itself — every
// filter change calls `navigate` with a rebuilt query string; nothing here keeps a parallel
// "current filters" state that could drift from the address bar. The multi-value encoding
// (comma-separated) is the same documented guess screen-sessions.jsx already made for its own
// filters — the contract states the param names, not how a multi-value one is joined.
// age_band/sex options are the two closed enums the addendum gives verbatim (18-20|21-24|25-34|
// 35-44|45+ and M|F|X — printed as-is, never re-worded into "Male"/"Female", the same
// never-invent-friendlier-prose rule idv-shared.jsx's ReasonChips states for reason codes).
// state/os/browser options are never invented: they are read back from whatever this window's own
// `breakdown` block has actually seen, so an option can only appear once a real session carried
// that value — there is no endpoint that lists "every OS this console might see" to draw from.
;(function () {
  const useP = window.useP;
  const HWIdv = window.HWIdv;
  const IdvShared = window.IdvShared;

  // ── feature vocabulary (idv_usage.feature, plan §3.9) ──────────────────
  const FEATURE_LABEL = {
    ID_VERIFICATION: 'ID Verification',
    LIVENESS_PASSIVE: 'Passive Liveness',
    LIVENESS_ACTIVE: 'Active Liveness',
    FACE_MATCH: 'Face Match',
    FACE_SEARCH: 'Face Search',
    AGE_ESTIMATION: 'Age Estimation',
    IP_ANALYSIS: 'IP Analysis',
    QUESTIONNAIRE: 'Questionnaire',
    HOSTED_SESSION: 'Hosted Session',
  };
  // An unrecognised code is title-cased from itself, never dropped and never
  // renamed into something friendlier the backend didn't send.
  function featureLabel(f) {
    if (FEATURE_LABEL[f]) return FEATURE_LABEL[f];
    if (!f) return 'Unknown';
    return f.split('_').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ');
  }

  // ── window (7d / 30d / 90d / custom) ────────────────────────────────────
  function isoDate(d) { return d.toISOString().slice(0, 10); }
  function daysAgo(n) { return isoDate(new Date(Date.now() - n * 86400000)); }
  const WINDOW_OPTIONS = [
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
    { value: 'custom', label: 'Custom' },
  ];
  const WINDOW_DAYS = { '7d': 7, '30d': 30, '90d': 90 };
  function resolveWindow(key, customFrom, customTo) {
    const to = isoDate(new Date());
    if (key === 'custom') return { from: customFrom || daysAgo(30), to: customTo || to };
    return { from: daysAgo(WINDOW_DAYS[key] || 30), to };
  }

  // ── CSV export (client-side only — nothing is sent anywhere) ───────────
  function csvCell(v) {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportCsv(rows, win) {
    const header = ['feature', 'label', 'n_window', 'n_cumulative', 'unit_cost_cents', 'cost_cents', 'cost_note'];
    const lines = [header.join(',')];
    (rows || []).forEach((r) => {
      lines.push([r.feature, featureLabel(r.feature), r.n_window, r.n_cumulative,
        r.unit_cost_cents, r.cost_cents, csvCell(r.cost_note)].map(csvCell).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `idv-usage_${win.from}_to_${win.to}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── small local composites (atoms only — this screen's shapes are specific
  // enough to stay local, same call idv/screen-data.jsx-style files make) ──
  function SubHead({ icon, title, right }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 28, height: 28, borderRadius: P.r8, background: P.surface3, color: P.ink2,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
          <Icon name={icon} size={15} stroke={1.9} />
        </span>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>{title}</span>
        {right}
      </div>);
  }
  function KV({ k, v, mono }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '6px 0', borderBottom: `1px solid ${P.hairline}`, fontSize: 12 }}>
        <span style={{ color: P.inkDim }}>{k}</span>
        <span style={{ fontWeight: 600, color: P.ink, fontFamily: mono ? P.fontMono : undefined, textAlign: 'right' }}>{v}</span>
      </div>);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ── "Time to verify" (2026-09-10 Addendum 3) ────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  const AGE_BAND_LIST = ['18-20', '21-24', '25-34', '35-44', '45+'];
  const SEX_LIST = ['M', 'F', 'X'];
  const TIMING_PRESET_OPTIONS = [
    { value: '24h', label: '24h' }, { value: '7d', label: '7d' },
    { value: '30d', label: '30d' }, { value: '90d', label: '90d' },
    { value: 'custom', label: 'Custom' },
  ];
  const BUCKET_OPTIONS = [{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }];
  const TIMING_PRESET_DAYS = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 };

  // URL <-> filter object, same shape/rule as screen-sessions.jsx's own
  // parseHashQuery: read fresh from location.hash on every render, never
  // mirrored into a separate state that could drift from the address bar.
  function parseTimingHashQuery() {
    const h = window.location.hash || '';
    const qi = h.indexOf('?');
    const usp = new URLSearchParams(qi >= 0 ? h.slice(qi + 1) : '');
    const list = (k) => (usp.get(k) || '').split(',').map((s) => s.trim()).filter(Boolean);
    const bucket = usp.get('bucket') === 'week' ? 'week' : 'day';
    const preset = TIMING_PRESET_OPTIONS.some((o) => o.value === usp.get('preset')) ? usp.get('preset') : '30d';
    return {
      preset, bucket,
      from: usp.get('from') || '',
      to: usp.get('to') || '',
      age_band: list('age_band'),
      sex: list('sex'),
      state: list('state'),
      os: list('os'),
      browser: list('browser'),
    };
  }
  function resolveTimingRange(f) {
    const to = isoDate(new Date());
    if (f.preset === 'custom') return { from: f.from || daysAgo(30), to: f.to || to };
    return { from: daysAgo(TIMING_PRESET_DAYS[f.preset] || 30), to };
  }
  // Multi-value params sent comma-separated — a documented guess, same as
  // screen-sessions.jsx's buildApiQuery: the contract names the params, not
  // the multi-value encoding.
  function buildTimingQuery(f) {
    const p = new URLSearchParams();
    if (f.preset === 'custom') {
      const range = resolveTimingRange(f);
      p.set('from', range.from);
      p.set('to', range.to);
      p.set('preset', 'custom');
    } else {
      p.set('preset', f.preset || '30d');
    }
    p.set('bucket', f.bucket || 'day');
    if (f.age_band.length) p.set('age_band', f.age_band.join(','));
    if (f.sex.length) p.set('sex', f.sex.join(','));
    if (f.state.length) p.set('state', f.state.join(','));
    if (f.os.length) p.set('os', f.os.join(','));
    if (f.browser.length) p.set('browser', f.browser.join(','));
    return p.toString();
  }
  function hasAnyTimingFilter(f) {
    return !!(f.preset !== '30d' || f.bucket !== 'day' || f.age_band.length || f.sex.length
      || f.state.length || f.os.length || f.browser.length);
  }

  // One duration bar cell — a BarMeter (the same atom screen-home.jsx's own
  // BarRows uses for its "no chart library" bars) plus the formatted seconds,
  // reused across the bucket table, the per-step table and every breakdown
  // table below rather than four near-identical inline blocks.
  function DurBar({ seconds, max, color }) {
    const P = useP();
    const fmtd = IdvShared ? IdvShared.fmtDuration : (s) => (s == null ? '—' : String(s));
    if (seconds == null) return <span style={{ color: P.inkFaint, fontFamily: P.fontMono, fontSize: 11.5 }}>—</span>;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 118 }}>
        <div style={{ width: 56, flex: '0 0 auto' }}><BarMeter value={seconds} max={max || seconds || 1} color={color} height={6} /></div>
        <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.ink, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtd(seconds)}</span>
      </div>);
  }

  function TimeToVerifySection({ navigate, path }) {
    const P = useP();
    const fmt = HWIdv ? HWIdv.fmt : { number: (n) => String(n == null ? 0 : n) };
    const fmtd = IdvShared ? IdvShared.fmtDuration : (s) => (s == null ? '—' : String(s));
    const fmt0 = (n) => fmt.number(n == null ? 0 : n);

    const filters = parseTimingHashQuery();
    const range = resolveTimingRange(filters);
    const apiPath = '/api/idv/stats/timing?' + buildTimingQuery(filters);
    const poll = HWIdv ? HWIdv.usePoll(apiPath, 30000) : { loading: false, error: 'no-live-seam', data: null, refresh: () => {} };

    function setFilter(patch) {
      const next = Object.assign({}, filters, patch);
      navigate('#' + (path || '/usage') + '?' + buildTimingQuery(next));
    }
    function clearFilters() { navigate('#' + (path || '/usage')); }

    const data = poll.data || null;
    const ageOptions = AGE_BAND_LIST.map((v) => ({ id: v, label: v }));
    // Printed verbatim (M/F/X), never reworded — same rule idv-shared.jsx's
    // ReasonChips states for reason codes.
    const sexOptions = SEX_LIST.map((v) => ({ id: v, label: v }));
    const dimOptions = (dim) => (data && data.breakdown && data.breakdown[dim]
      ? Object.keys(data.breakdown[dim]).sort().map((v) => ({ id: v, label: v })) : []);
    const stateOptions = dimOptions('state');
    const osOptions = dimOptions('os');
    const browserOptions = dimOptions('browser');

    const filterBar = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Seg size="sm" value={filters.preset} onChange={(v) => setFilter({ preset: v })} options={TIMING_PRESET_OPTIONS} />
        {filters.preset === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Field size="sm" full={false} mono type="date" value={filters.from || range.from} style={{ width: 142 }}
              onChange={(e) => setFilter({ from: e.target.value })} />
            <span style={{ color: P.inkMute, fontSize: 12 }}>to</span>
            <Field size="sm" full={false} mono type="date" value={filters.to || range.to} style={{ width: 142 }}
              onChange={(e) => setFilter({ to: e.target.value })} />
          </div>)}
        <Seg size="sm" value={filters.bucket} onChange={(v) => setFilter({ bucket: v })} options={BUCKET_OPTIONS} />
        <MultiSelectFilter label="Age band" options={ageOptions} value={filters.age_band} onChange={(v) => setFilter({ age_band: v })} />
        <MultiSelectFilter label="Sex" options={sexOptions} value={filters.sex} onChange={(v) => setFilter({ sex: v })} />
        <MultiSelectFilter label="State" options={stateOptions} value={filters.state} onChange={(v) => setFilter({ state: v })} />
        <MultiSelectFilter label="OS" options={osOptions} value={filters.os} onChange={(v) => setFilter({ os: v })} />
        <MultiSelectFilter label="Browser" options={browserOptions} value={filters.browser} onChange={(v) => setFilter({ browser: v })} />
        {hasAnyTimingFilter(filters) && <PBtn variant="ghost" size="sm" onClick={clearFilters}>Clear</PBtn>}
      </div>);

    let body;
    const looksDisconnected = poll.error === 'no-live-seam' || (poll.error && /^request failed/.test(poll.error));
    if (poll.loading && !data) {
      body = <IdvShared.SkeletonCard lines={4} />;
    } else if (poll.error && !data) {
      body = looksDisconnected
        ? <IdvShared.NotConnected onRetry={poll.refresh} />
        : <ErrorState title="Timing stats didn't load" detail={poll.error} onRetry={poll.refresh} />;
    } else if (data) {
      const buckets = data.buckets || [];
      const bucketMax = Math.max(1, ...buckets.flatMap((b) => [b.median_s || 0, b.p90_s || 0]));
      const steps = (IdvShared.TIMING_STEPS || []).map((st) => ({
        key: st.key, label: st.label,
        median_s: data.steps && data.steps[st.key] ? data.steps[st.key].median_s : null,
        p90_s: data.steps && data.steps[st.key] ? data.steps[st.key].p90_s : null,
      }));
      const stepMax = Math.max(1, ...steps.map((s) => s.p90_s || 0));

      const tiles = [
        { label: 'Sessions', value: fmt0(data.count), sub: data.decided != null ? `${fmt0(data.decided)} decided` : undefined },
        { label: 'Median total', value: fmtd(data.total_s && data.total_s.median) },
        { label: 'Mean total', value: fmtd(data.total_s && data.total_s.mean) },
        { label: 'P90 total', value: fmtd(data.total_s && data.total_s.p90) },
        { label: 'Base vs retake', value: fmtd(data.base_s && data.base_s.median), sub: `vs ${fmtd(data.retake_s && data.retake_s.median)} retake` },
        { label: 'Median before open', value: fmtd(data.before_open_s && data.before_open_s.median) },
      ];

      const dims = [
        { key: 'age_band', label: 'Age band' },
        { key: 'sex', label: 'Sex' },
        { key: 'state', label: 'Issuing state' },
        { key: 'os', label: 'OS' },
        { key: 'browser', label: 'Browser' },
      ];

      body = (
        <React.Fragment>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 16 }}>
            {tiles.map((t, i) => <KPI key={i} label={t.label} value={t.value} sublabel={t.sub} />)}
          </div>

          <Card padding={0} style={{ marginBottom: 16 }}>
            <SubHead icon="chart" title="By bucket"
              right={<span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{buckets.length} bucket{buckets.length === 1 ? '' : 's'}</span>} />
            {buckets.length === 0 ? (
              <EmptyState icon="chart" title="No buckets in this window" body="Widen the date range, or check back after the next session." />
            ) : (
              <DataTable
                rowKey={(r) => r.start}
                columns={[
                  { key: 'start', label: 'Bucket', render: (r) => <b style={{ color: P.ink, fontFamily: P.fontMono, fontSize: 12 }}>{r.start}</b> },
                  { key: 'count', label: 'Sessions', align: 'right', render: (r) => <span style={{ fontFamily: P.fontMono, color: P.ink2 }}>{fmt0(r.count)}</span> },
                  { key: 'median', label: 'Median', render: (r) => <DurBar seconds={r.median_s} max={bucketMax} color={P.accent} /> },
                  { key: 'p90', label: 'P90', render: (r) => <DurBar seconds={r.p90_s} max={bucketMax} color={P.warn} /> },
                ]}
                rows={buckets} />
            )}
          </Card>

          <Card padding={0} style={{ marginBottom: 16 }}>
            <SubHead icon="clock" title="Per step" />
            <DataTable
              rowKey={(r) => r.key}
              columns={[
                { key: 'label', label: 'Step', render: (r) => <b style={{ color: P.ink }}>{r.label}</b> },
                { key: 'median', label: 'Median', render: (r) => <DurBar seconds={r.median_s} max={stepMax} color={P.accent} /> },
                { key: 'p90', label: 'P90', render: (r) => <DurBar seconds={r.p90_s} max={stepMax} color={P.warn} /> },
              ]}
              rows={steps} />
          </Card>

          {/* CONTRACT GAP: the addendum's own literal for `breakdown` is
              "{...count/median...}" per dimension — a placeholder, not a
              worked example the way `steps` gets one. This reads it as the
              same keyed-by-category-value shape `steps` documents in full
              (`{"CA": {"count":n,"median_s":n,...}, "NV": {...}}`), which is
              also the only shape MultiSelectFilter's own state/os/browser
              options (above) could be built from without a second endpoint.
              If the backend ships an array of {value,count,median_s} rows
              instead, this Object.keys() over a non-object silently reads as
              "no breakdown for this window" rather than throwing — worth
              reconciling once a real response is in hand. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
            {dims.map((d) => {
              const rows = Object.keys((data.breakdown && data.breakdown[d.key]) || {})
                .map((k) => Object.assign({ key: k }, data.breakdown[d.key][k]));
              const max = Math.max(1, ...rows.map((r) => r.median_s || 0));
              return (
                <Card padding={0} key={d.key}>
                  <SubHead icon="users" title={d.label} />
                  {rows.length === 0 ? (
                    <div style={{ padding: 16, fontSize: 12, color: P.inkMute }}>No breakdown for this window.</div>
                  ) : (
                    <DataTable
                      dense
                      rowKey={(r) => r.key}
                      columns={[
                        { key: 'key', label: d.label, render: (r) => <span style={{ color: P.ink }}>{r.key}</span> },
                        { key: 'count', label: 'N', align: 'right', render: (r) => <span style={{ fontFamily: P.fontMono, color: P.inkDim }}>{fmt0(r.count)}</span> },
                        { key: 'median', label: 'Median', render: (r) => <DurBar seconds={r.median_s} max={max} color={P.info} /> },
                      ]}
                      rows={rows} />
                  )}
                </Card>);
            })}
          </div>
        </React.Fragment>);
    } else {
      body = null;
    }

    return (
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Icon name="clock" size={16} stroke={1.9} color={P.inkDim} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: P.ink }}>Time to verify</h3>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>
            {filters.preset === 'custom' ? `${range.from} → ${range.to}` : filters.preset} · {filters.bucket}
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: P.inkDim, marginBottom: 12, lineHeight: 1.5, maxWidth: 720 }}>
          Opened → decision, per session — the same clock the Session screen's own Timing card shows for
          one session, aggregated here across whatever this filter bar selects. Time a link sat unopened
          is its own "before opening" figure and is never folded into the totals above it.
        </div>
        {filterBar}
        {body}
      </div>);
  }

  // ── screen ───────────────────────────────────────────────────────────────
  window.IdvUsageScreen = function IdvUsageScreen(props) {
    const { navigate, path } = props || {};
    const P = useP();
    const [windowKey, setWindowKey] = React.useState('30d');
    const [customFrom, setCustomFrom] = React.useState(() => daysAgo(30));
    const [customTo, setCustomTo] = React.useState(() => isoDate(new Date()));

    const win = resolveWindow(windowKey, customFrom, customTo);
    const featurePath = `/api/idv/usage?from=${encodeURIComponent(win.from)}&to=${encodeURIComponent(win.to)}`;
    const poll = HWIdv ? HWIdv.usePoll(featurePath, 30000) : { loading: false, error: 'no-live-seam', data: null, refresh: () => {} };

    const fmt = HWIdv ? HWIdv.fmt : { number: (n) => String(n), cents: (c) => '$' + ((c || 0) / 100).toFixed(2), date: (d) => d };

    const header = (
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: P.inkDim, marginBottom: 6, fontFamily: P.fontMono }}>Connect</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-.01em', color: P.ink, lineHeight: 1.12 }}>Usage</h2>
          <div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 6, maxWidth: 640, lineHeight: 1.45 }}>
            What ran, how often, and what it cost. "This window" is the run rate for the range below; "cumulative" is
            every engine run since Verify went live — it does not reach back through the imported Didit history.
            Didit's own lifetime counts are a separate figure, shown in the "Imported from Didit" card below. Nothing
            on this screen is an invented price.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Seg value={windowKey} onChange={setWindowKey} size="sm" options={WINDOW_OPTIONS} />
          {windowKey === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Field size="sm" full={false} mono type="date" value={customFrom} style={{ width: 150 }}
                onChange={(e) => setCustomFrom(e.target.value)} />
              <span style={{ color: P.inkMute, fontSize: 12 }}>to</span>
              <Field size="sm" full={false} mono type="date" value={customTo} style={{ width: 150 }}
                onChange={(e) => setCustomTo(e.target.value)} />
            </div>)}
          <PBtn size="sm" variant="secondary" icon="download" disabled={!poll.data || !(poll.data.rows || []).length}
            onClick={() => exportCsv(poll.data.rows, win)}>
            Export CSV
          </PBtn>
        </div>
      </div>);

    // "Time to verify" is its own component with its own poll — rendered
    // ahead of every early return below so a slow/failed per-feature fetch
    // never hides it, and vice versa (see the file header comment).
    const timingSection = <TimeToVerifySection navigate={navigate} path={path} />;

    if (poll.loading && !poll.data) {
      return (
        <div>
          {header}
          {timingSection}
          <IdvShared.SkeletonCard lines={4} />
        </div>);
    }
    if (poll.error) {
      return (
        <div>
          {header}
          {timingSection}
          <IdvShared.NotConnected onRetry={poll.refresh} />
        </div>);
    }

    const data = poll.data || {};
    const rows = data.rows || [];
    const allZero = rows.length > 0 && rows.every((r) => (r.n_window || 0) === 0);
    // imported may come back as a single object (the contract's literal example)
    // or, if the backend ever ships more than one lifetime figure, as an array —
    // normalized here rather than assumed, so this screen never crashes on
    // either shape and never invents a feature the response didn't include.
    const imported = Array.isArray(data.imported) ? data.imported : (data.imported ? [data.imported] : []);

    return (
      <div>
        {header}
        {timingSection}

        <div style={{ fontSize: 11.5, color: P.inkMute, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="info" size={13} stroke={1.8} />
          Counts come from <span style={{ fontFamily: P.fontMono, color: P.inkDim }}>idv_usage</span> rows — the backend
          writes one row per feature every time the engine actually runs a check, not when this screen is opened.
        </div>

        <Card padding={0} style={{ marginBottom: 16 }}>
          <SubHead icon="chart" title="Per feature"
            right={<span style={{ fontSize: 11, color: P.inkMute, fontFamily: P.fontMono }}>{rows.length} feature{rows.length === 1 ? '' : 's'} · {win.from} → {win.to}</span>} />
          {allZero ? (
            <EmptyState icon="chart" title="No verifications in this window"
              body="Nothing ran between these two dates. Widen the window, or check back after the next session — cumulative totals below are unaffected." />
          ) : (
            <DataTable
              rowKey={(r) => r.feature}
              columns={[
                { key: 'feature', label: 'Feature', render: (r) => (
                  <div>
                    <b style={{ color: P.ink }}>{featureLabel(r.feature)}</b>
                    <div style={{ fontSize: 10, color: P.inkFaint, fontFamily: P.fontMono, marginTop: 1 }}>{r.feature}</div>
                  </div>) },
                { key: 'n_window', label: 'This window', align: 'right', render: (r) => (
                  <span style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink }}>{fmt.number(r.n_window || 0)}</span>) },
                { key: 'n_cumulative', label: 'Cumulative', align: 'right', render: (r) => (
                  <span style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink2 }}>{fmt.number(r.n_cumulative || 0)}</span>) },
                { key: 'unit_cost', label: 'Unit cost', align: 'right', render: (r) => (
                  <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkDim }}>{fmt.cents(r.unit_cost_cents)}</span>) },
                { key: 'cost', label: 'Cost', align: 'right', render: (r) => (
                  <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkDim }}>{fmt.cents(r.cost_cents)}</span>) },
                // The note is the honest half of this table: the API's cost_note
                // string, printed exactly as sent — never reworded, never swapped
                // for a hosting estimate this backend does not meter.
                { key: 'note', label: 'Note', render: (r) => (
                  r.cost_note ? <Pill kind="good" size="sm">{r.cost_note}</Pill> : <span style={{ color: P.inkFaint }}>—</span>) },
              ]}
              rows={rows} />
          )}
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
          <Card padding={0}>
            <SubHead icon="download" title="Imported from Didit" />
            <div style={{ padding: 16 }}>
              {imported.length === 0 ? (
                <div style={{ fontSize: 12, color: P.inkMute }}>The API returned no imported block for this window.</div>
              ) : (
                <React.Fragment>
                  {imported.map((im, i) => (
                    <KV key={i} k={featureLabel(im.feature)} v={fmt.number(im.n)} mono />
                  ))}
                  <div style={{ marginTop: 10, fontSize: 11.5, color: P.inkDim, lineHeight: 1.5 }}>
                    {imported[0] && imported[0].note ? imported[0].note + '. ' : ''}
                    These are lifetime counts since the Didit account opened — not a monthly figure. An earlier
                    internal estimate read a cumulative Didit number as a monthly rate and was wrong by a wide margin;
                    every count on this screen says which one it is in its own column header for that reason.
                  </div>
                </React.Fragment>)}
            </div>
          </Card>

          <Card padding={0}>
            <SubHead icon="info" title="What Didit charged" />
            <div style={{ padding: 16, fontSize: 12, color: P.inkDim, lineHeight: 1.55 }}>
              Didit's per-feature prices are not stored here; see the console cross-reference of 2026-09-08.
            </div>
          </Card>
        </div>
      </div>);
  };
})();
