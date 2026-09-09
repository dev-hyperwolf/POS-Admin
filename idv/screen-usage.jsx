// ── idv/screen-usage.jsx ── #/usage — per-feature counts, honestly costed ──
// Design: explorations/Verify - Concept A - Console.html tab "10 · Usage" (layout, the
// window/cumulative split, the "no invented prices" rule). Contract:
// docs/IDV-API-CONTRACT.md §"Usage, audit, team, retention" — GET /api/idv/usage?from&to&feature
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

  // ── screen ───────────────────────────────────────────────────────────────
  window.IdvUsageScreen = function IdvUsageScreen() {
    const P = useP();
    const [windowKey, setWindowKey] = React.useState('30d');
    const [customFrom, setCustomFrom] = React.useState(() => daysAgo(30));
    const [customTo, setCustomTo] = React.useState(() => isoDate(new Date()));

    const win = resolveWindow(windowKey, customFrom, customTo);
    const path = `/api/idv/usage?from=${encodeURIComponent(win.from)}&to=${encodeURIComponent(win.to)}`;
    const poll = HWIdv ? HWIdv.usePoll(path, 30000) : { loading: false, error: 'no-live-seam', data: null, refresh: () => {} };

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

    if (poll.loading && !poll.data) {
      return (
        <div>
          {header}
          <IdvShared.SkeletonCard lines={4} />
        </div>);
    }
    if (poll.error) {
      return (
        <div>
          {header}
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
