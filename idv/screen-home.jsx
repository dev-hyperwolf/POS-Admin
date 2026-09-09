// ── idv/screen-home.jsx ── IdvHomeScreen — support-first Home ──────────────
// Plan §5.6: "Home is support-first: a search box, the engine health strip,
// today's counts, and an exceptions list." Everything below that is the
// Dashboard's own panel set (plan §5.6 puts verifications-table-density
// panels on this screen too, per the kickoff's Concept A direction). Built
// only from pos/atoms.jsx + shared/states.jsx + idv/idv-shared.jsx — no
// private div-tree duplicating an atom, no hex literal anywhere in this file
// (`grep -E '#[0-9a-fA-F]{3,6}' idv/screen-home.jsx` must stay empty).
//
// Three contract/spec gaps this file works around rather than silently
// papering over (documented here, not fixed in docs/IDV-API-CONTRACT.md,
// which this task is not scoped to edit):
//
// 1. ROUTE NAME. The build brief names the search target "#/verifications
//    ?q=", but idv/app.jsx (out of scope here) registers the Verifications
//    screen at path '/sessions' (its NAV entry is `{ id:'sessions', path:
//    '/sessions', label:'Verifications' }` — see SCREEN_SOURCE/ROUTES() in
//    that file). Routing to '#/verifications' would hit app.jsx's unbuilt-
//    route ErrorState instead of the sessions table, so this file navigates
//    to the REAL route, '#/sessions?q=...'.
//
// 2. NO PER-DAY STATUS BREAKDOWN. `GET /api/idv/dashboard` only breaks
//    volume down by day (`volume.series[].n`, a plain count); `conversion`,
//    with its `approved`/`completed` fields, is a WINDOW total, not a daily
//    one. There is no dashboard field that means "approved today" or
//    "declined today". Labelling the window aggregate as "today" would be
//    the exact kind of dishonest number plan §5.3 rules out, so Approved /
//    Declined / Awaiting-guest counts are instead read from the `count`
//    field of three `/api/idv/sessions?status=...&from=<today>` calls (the
//    same calls the exceptions list below needs anyway); only Verifications
//    comes from the dashboard's own `volume.series` last day, as the brief
//    specifies. "Today" for those three calls is the store's Pacific calendar
//    date (America/Los_Angeles), computed independently of the dashboard's own
//    day bucket — there is no store-local `local_day` field on either route to
//    anchor both to the same boundary, so the two can still disagree by up to a
//    day at midnight even though this file no longer uses the browser's UTC day.
//
// 3. NO OVERRIDE FILTER. The brief's exceptions list wants "declined today,
//    awaiting user > 10 min, overrides", built from `/api/idv/sessions?
//    status=...&from=...` calls. Declined-today and awaiting-user are real
//    status filters; "override" is neither a `status` value nor a `reason`
//    enum member (POS override recording is addenda-only: a `review` row
//    with an audit row, no session-level flag or query param). Rather than
//    invent a filter the contract doesn't define, this renders a permanent,
//    honest caption instead of a fabricated zero — see OVERRIDES_NOTE below.
//
// A fourth, smaller honesty note: "awaiting user > 10 min" is measured from
// `created_at` (session start), because SessionSummary carries no separate
// "entered this status at" timestamp — the caption on that section says so.
;(function () {
  const useP = window.useP;

  // ── local helpers (nothing here leaks past this closure) ────────────────
  // todayFromISO() used to be `new Date().toISOString().slice(0,10)` — the
  // BROWSER's UTC day, not the store's. The estate's store day is Pacific,
  // so a session that closed at, say, 11pm Pacific on the 7th (07:00Z on the
  // 8th) was counted as "today" a whole day early by a UTC boundary.
  // Intl.DateTimeFormat with timeZone:'America/Los_Angeles' gives the
  // correct LOCAL calendar date; the only remaining problem is turning that
  // date back into a UTC instant, since Pacific's offset from UTC (-7 PDT /
  // -8 PST) isn't knowable without asking the platform — there is no JS API
  // for "the UTC instant that renders as this local midnight" so this tries
  // both candidate offsets and keeps whichever one actually round-trips.
  function pacificTodayStartISO() {
    const dateParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const get = (t) => (dateParts.find((p) => p.type === t) || {}).value;
    const y = get('year'), m = get('month'), d = get('day');
    for (let i = 0; i < 2; i++) {
      const offsetHours = i === 0 ? 7 : 8; // PDT then PST
      const candidate = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), offsetHours, 0, 0));
      const rendered = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', hourCycle: 'h23',
      }).formatToParts(candidate);
      const rget = (t) => (rendered.find((p) => p.type === t) || {}).value;
      if (rget('year') === y && rget('month') === m && rget('day') === d && rget('hour') === '00') {
        return candidate.toISOString();
      }
    }
    // Both offsets checked above cover the only two Pacific ever uses
    // (PDT/PST) — this is an in-case-the-platform-disagrees fallback, not an
    // expected path, and it uses the same UTC-day boundary the old code did.
    return `${y}-${m}-${d}T00:00:00Z`;
  }
  function shortDay(iso) {
    try { return new Date(iso + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
    catch (e) { return iso; }
  }
  function minutesAgo(iso) {
    if (!iso) return null;
    const ms = Date.now() - new Date(iso).getTime();
    if (isNaN(ms)) return null;
    return ms / 60000;
  }
  const OVERRIDES_NOTE = 'Overrides aren’t listed here yet — the sessions endpoint has no override '
    + 'flag or query filter (an override is recorded as a review row and an audit row, not a session '
    + 'field). They will show here once the contract adds one; for now check the audit log once Settings ships.';

  // ── BarRows / KVRows — the two list shapes every panel below reuses ─────
  // "No chart library" per the brief: a bar is P.<token>-coloured BarMeter,
  // not a drawn chart. Kept local because no other Verify screen needs a
  // generic label/value bar list (yet) — if one does, this is the seam to
  // promote into idv-shared.jsx, not a second copy.
  function BarRows({ items, color }) {
    const P = useP();
    if (!items || !items.length) return null;
    const max = Math.max.apply(null, items.map((it) => it.value)) || 1;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {items.map((it, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 8 }}>
              <span style={{ fontSize: P.type.body, fontWeight: 600, color: P.ink2, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
              <span style={{ fontSize: P.type.body, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, flex: '0 0 auto' }}>{it.value}</span>
            </div>
            <BarMeter value={it.value} max={max} color={color || P.accent} height={7} />
          </div>))}
      </div>);
  }
  function KVRows({ items }) {
    const P = useP();
    if (!items || !items.length) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: P.type.body, color: P.ink2, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
            <span style={{ fontSize: P.type.body, color: P.ink, fontWeight: 700, fontFamily: P.fontMono, flex: '0 0 auto' }}>{it.value}</span>
          </div>))}
      </div>);
  }

  // ── health strip — reuses IdvShared.EngineBadge (the one place the
  // three-state backend/engine contract, plan §5.4, is implemented) instead
  // of a second copy that could quietly disagree with the topbar's badge. ─
  function HealthStrip({ dash }) {
    const P = useP();
    const lastAtRef = React.useRef(Date.now());
    const [, tick] = React.useState(0);
    React.useEffect(() => { if (dash.data) lastAtRef.current = Date.now(); }, [dash.data]);
    React.useEffect(() => {
      const id = setInterval(() => tick((n) => n + 1), 5000);
      return () => clearInterval(id);
    }, []);
    const secsAgo = Math.max(0, Math.round((Date.now() - lastAtRef.current) / 1000));
    return (
      <Card elevation="flat" density="compact" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <window.IdvShared.EngineBadge size="md" />
        <span style={{ marginLeft: 'auto', fontSize: P.type.meta, color: P.inkFaint }}>
          {dash.loading ? 'Refreshing…' : `Dashboard updated ${secsAgo}s ago`}
        </span>
      </Card>);
  }

  // ── today's counts ────────────────────────────────────────────────────
  function TodayCounts({ dash, approved, declined, awaiting }) {
    const series = dash.data && dash.data.volume && dash.data.volume.series;
    const todayN = series && series.length ? series[series.length - 1].n : null;
    // `count` on this route is this PAGE's row count (wmdemo/idv_api.py
    // `_sessions`: `"count": len(out)`), capped by the `limit=200` these
    // three calls send — not a total across every matching session. Hitting
    // that cap means "at least 200", not "exactly 200", so it is shown as
    // "200+" rather than a number that understates the real count.
    const tileValue = (poll) => {
      if (!poll.data) return poll.loading ? '…' : '—';
      const n = poll.data.count != null ? poll.data.count : (poll.data.rows ? poll.data.rows.length : null);
      if (n == null) return '—';
      return n >= 200 ? '200+' : n;
    };
    const tiles = [
      { label: 'Verifications', value: todayN != null ? todayN : '—', icon: 'shield' },
      { label: 'Approved', value: tileValue(approved), icon: 'check-circle' },
      { label: 'Declined', value: tileValue(declined), icon: 'ban' },
      { label: 'Awaiting guest', value: tileValue(awaiting), icon: 'clock' },
    ];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        {tiles.map((t) => <KPI key={t.label} label={t.label} value={t.value} icon={t.icon} />)}
      </div>);
  }

  // ── one exceptions row ────────────────────────────────────────────────
  function ExceptionRow({ s, navigate, note }) {
    const P = useP();
    const name = s.person && s.person.display_name;
    const go = () => navigate('#/sessions/' + s.id);
    return (
      <div data-hw-i role="button" tabIndex={0} onClick={go} onKeyDown={(e) => { if (e.key === 'Enter') go(); }}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', background: P.surface,
          border: `1px solid ${P.hairline}`, borderRadius: P.r8, cursor: 'pointer' }}>
        <window.IdvShared.StatusPill status={s.status} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: P.type.body, fontWeight: 600, color: P.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Session {s.session_number}{name ? ` · ${name}` : ''}
          </div>
          <div style={{ fontSize: P.type.meta, color: P.inkDim }}>{note}</div>
          {s.reasons && s.reasons.length ? <window.IdvShared.ReasonChips reasons={s.reasons} style={{ marginTop: 4 }} /> : null}
        </div>
        {s.imported_from === 'didit' && <window.IdvShared.ImportedTag date={s.created_at} />}
        <Icon name="chevron-right" size={14} color={P.inkMute} />
      </div>);
  }

  // ── exceptions card ───────────────────────────────────────────────────
  const ROW_CAP = 6;
  function ExceptionsCard({ declined, awaiting, navigate }) {
    const P = useP();
    const fmt = window.HWIdv ? window.HWIdv.fmt : { relative: (d) => d };
    const firstLoad = (declined.loading && !declined.data) || (awaiting.loading && !awaiting.data);
    const err = declined.error || awaiting.error;

    const declinedRows = (declined.data && declined.data.rows) || [];
    const awaitingRows = ((awaiting.data && awaiting.data.rows) || []).filter((r) => {
      const m = minutesAgo(r.created_at);
      return m != null && m > 10;
    });
    const declinedShown = declinedRows.slice(0, ROW_CAP);
    const awaitingShown = awaitingRows.slice(0, ROW_CAP);

    return (
      <Card elevation="flat">
        <SectionHead level={3} eyebrow="Support-first" title="Exceptions"
          subtitle="Declined today, sessions waiting on a guest for more than 10 minutes, and overrides."
          style={{ marginBottom: 10 }} />
        {firstLoad ? <window.IdvShared.SkeletonTable rows={3} /> :
          err ? <ErrorState compact body={`The exceptions list didn’t come back: ${err}`}
            onRetry={() => { declined.refresh(); awaiting.refresh(); }} /> :
          (declinedShown.length === 0 && awaitingShown.length === 0) ? (
            <EmptyState compact icon="check-circle" title="Nothing needs attention"
              body="No declines today, and nobody has been waiting on a guest for more than 10 minutes." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {declinedShown.length > 0 && (
                <div>
                  <Eyebrow style={{ marginBottom: 6 }}>Declined today · {declinedRows.length}</Eyebrow>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {declinedShown.map((s) => (
                      <ExceptionRow key={s.id} s={s} navigate={navigate}
                        note={`Declined ${fmt.relative(s.completed_at || s.created_at)}`} />
                    ))}
                  </div>
                  {declinedRows.length > declinedShown.length && (
                    <PBtn variant="ghost" size="sm" style={{ marginTop: 6 }}
                      onClick={() => navigate('#/sessions?status=Declined')}>
                      {declinedRows.length - declinedShown.length} more declined today →
                    </PBtn>)}
                </div>)}
              {awaitingShown.length > 0 && (
                <div>
                  <Eyebrow style={{ marginBottom: 6 }}>Waiting on a guest · {awaitingRows.length}</Eyebrow>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {awaitingShown.map((s) => (
                      <ExceptionRow key={s.id} s={s} navigate={navigate}
                        note={`Waiting ${Math.round(minutesAgo(s.created_at))} min`} />
                    ))}
                  </div>
                  {awaitingRows.length > awaitingShown.length && (
                    <PBtn variant="ghost" size="sm" style={{ marginTop: 6 }}
                      onClick={() => navigate('#/sessions?status=Awaiting User')}>
                      {awaitingRows.length - awaitingShown.length} more waiting →
                    </PBtn>)}
                  <div style={{ marginTop: 8, fontSize: P.type.micro, color: P.inkFaint, lineHeight: 1.5 }}>
                    Measured from when the session started — there is no separate "entered Awaiting User" timestamp on a session row.
                  </div>
                </div>)}
            </div>
          )}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <Icon name="alert" size={14} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <span style={{ fontSize: P.type.meta, color: P.inkFaint, lineHeight: 1.5 }}>{OVERRIDES_NOTE}</span>
        </div>
      </Card>);
  }

  // ── dashboard panels ──────────────────────────────────────────────────
  function PanelVolume({ volume }) {
    const P = useP();
    if (!volume || !volume.n) {
      return (
        <Card elevation="flat">
          <SectionHead level={3} title="Volume" subtitle="Sessions per day, last 7 days" style={{ marginBottom: 8 }} />
          <EmptyState compact icon="chart" title="No sessions in the last 7 days" />
        </Card>);
    }
    const items = (volume.series || []).map((d) => ({ label: shortDay(d.day), value: d.n }));
    return (
      <Card elevation="flat">
        <SectionHead level={3} title="Volume" subtitle={`${volume.n} sessions in 7 days`} style={{ marginBottom: 8 }} />
        <BarRows items={items} color={P.accent} />
      </Card>);
  }

  function PanelConversion({ conversion }) {
    const P = useP();
    const fmt = window.HWIdv ? window.HWIdv.fmt : { percent: (n) => (n * 100).toFixed(1) + '%' };
    if (!conversion || !conversion.started) {
      return (
        <Card elevation="flat">
          <SectionHead level={3} title="Conversion" subtitle="Started → decided" style={{ marginBottom: 8 }} />
          <EmptyState compact icon="chart-line" title="No conversion data in this window" />
        </Card>);
    }
    const items = [
      { label: 'Session created', value: conversion.started },
      { label: 'Decision reached', value: conversion.completed },
      { label: 'Approved', value: conversion.approved },
    ];
    return (
      <Card elevation="flat">
        <SectionHead level={3} title="Conversion" subtitle="Started → decided" style={{ marginBottom: 8 }} />
        <BarRows items={items} color={P.info} />
        <div style={{ marginTop: 8, fontSize: P.type.meta, color: P.inkDim }}>
          {fmt.percent(conversion.rate / 100, 1)} of started sessions were approved.
        </div>
      </Card>);
  }

  function PanelResubmissions({ resubmissions }) {
    const P = useP();
    if (!resubmissions || !resubmissions.n) {
      return (
        <Card elevation="flat">
          <SectionHead level={3} title="Resubmissions" subtitle="Asked to redo a step" style={{ marginBottom: 8 }} />
          <EmptyState compact icon="refresh" title="No resubmissions in this window" />
        </Card>);
    }
    const byNode = resubmissions.by_node || {};
    const items = Object.keys(byNode).map((k) => ({ label: k, value: byNode[k] }));
    return (
      <Card elevation="flat">
        <SectionHead level={3} title="Resubmissions" subtitle={`${resubmissions.n} asked to redo a step`} style={{ marginBottom: 8 }} />
        <BarRows items={items} color={P.warn} />
      </Card>);
  }

  function PanelWarnings({ warnings }) {
    const P = useP();
    if (!warnings || !warnings.length) {
      return (
        <Card elevation="flat">
          <SectionHead level={3} title="Warnings" subtitle="Raised, not a decision" style={{ marginBottom: 8 }} />
          <EmptyState compact icon="alert" title="No warnings raised in this window" />
        </Card>);
    }
    const items = warnings.map((w) => ({ label: w.risk, value: w.n }));
    return (
      <Card elevation="flat">
        <SectionHead level={3} title="Warnings" subtitle="A warning is not a decision — each is a filter on the table" style={{ marginBottom: 8 }} />
        <BarRows items={items} color={P.warn} />
      </Card>);
  }

  function PanelLocations({ idLocations, ipLocations }) {
    const P = useP();
    const hasId = idLocations && idLocations.length;
    const hasIp = ipLocations && ipLocations.length;
    if (!hasId && !hasIp) {
      return (
        <Card elevation="flat">
          <SectionHead level={3} title="Where they are" subtitle="Document state · IP region" style={{ marginBottom: 8 }} />
          <EmptyState compact icon="map-pin" title="No location data in this window" />
        </Card>);
    }
    return (
      <Card elevation="flat">
        <SectionHead level={3} title="Where they are" subtitle="Document state and IP region are different questions" style={{ marginBottom: 8 }} />
        <Eyebrow style={{ marginBottom: 6 }}>By document state</Eyebrow>
        {hasId ? <KVRows items={idLocations.map((l) => ({ label: l.issuing_state, value: l.n }))} /> :
          <EmptyState compact icon="map-pin" title="No document-state data" />}
        <div style={{ height: 14 }} />
        <Eyebrow style={{ marginBottom: 6 }}>By IP region</Eyebrow>
        {hasIp ? <KVRows items={ipLocations.map((l) => ({ label: l.region, value: l.n }))} /> :
          <EmptyState compact icon="globe" title="No IP-region data" />}
      </Card>);
  }

  function PanelDemographics({ demographics }) {
    const P = useP();
    const age = demographics && demographics.age;
    const gender = demographics && demographics.gender;
    if (!age || !age.n) {
      return (
        <Card elevation="flat">
          <SectionHead level={3} title="Who they are" subtitle="From the document, not the age estimator" style={{ marginBottom: 8 }} />
          <EmptyState compact icon="users" title="No demographic data in this window" />
        </Card>);
    }
    const ageItems = Object.keys(age).filter((k) => k !== 'n').map((k) => ({ label: k, value: age[k] }));
    const genderItems = gender ? Object.keys(gender).filter((k) => k !== 'n').map((k) => ({ label: k, value: gender[k] })) : [];
    return (
      <Card elevation="flat">
        <SectionHead level={3} title="Who they are" subtitle="Age is read from the document; the estimator only ever raises a warning" style={{ marginBottom: 8 }} />
        {genderItems.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {genderItems.map((g) => <Pill key={g.label} kind="neutral" size="sm">{g.label} · {g.value}</Pill>)}
          </div>)}
        <BarRows items={ageItems} color={P.accent} />
      </Card>);
  }

  function PanelDevices({ devices }) {
    const P = useP();
    if (!devices || !devices.n) {
      return (
        <Card elevation="flat">
          <SectionHead level={3} title="Devices" subtitle="Browser · OS" style={{ marginBottom: 8 }} />
          <EmptyState compact icon="smartphone" title="No device data in this window" />
        </Card>);
    }
    return (
      <Card elevation="flat">
        <SectionHead level={3} title="Devices" subtitle="Browser · OS" style={{ marginBottom: 8 }} />
        <Eyebrow style={{ marginBottom: 6 }}>Browser</Eyebrow>
        <KVRows items={(devices.browser || []).map((b) => ({ label: b.name, value: b.n }))} />
        <div style={{ height: 14 }} />
        <Eyebrow style={{ marginBottom: 6 }}>OS</Eyebrow>
        <KVRows items={(devices.os || []).map((o) => ({ label: o.name, value: o.n }))} />
      </Card>);
  }

  function DashboardPanels({ dash }) {
    const d = dash.data || {};
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <PanelVolume volume={d.volume} />
        <PanelConversion conversion={d.conversion} />
        <PanelResubmissions resubmissions={d.resubmissions} />
        <PanelWarnings warnings={d.warnings} />
        <PanelLocations idLocations={d.id_locations} ipLocations={d.ip_locations} />
        <PanelDemographics demographics={d.demographics} />
        <PanelDevices devices={d.devices} />
      </div>);
  }

  // ── loading skeleton — same header/cards, shimmering placeholders inside ─
  function HomeSkeleton() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <window.IdvShared.SkeletonCard lines={1} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          {[0, 1, 2, 3].map((i) => <window.IdvShared.SkeletonCard key={i} lines={2} />)}
        </div>
        <window.IdvShared.SkeletonCard lines={4} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <window.IdvShared.SkeletonCard key={i} lines={4} />)}
        </div>
      </div>);
  }

  // ── the screen ────────────────────────────────────────────────────────
  window.IdvHomeScreen = function IdvHomeScreen(props) {
    const P = useP();
    const navigate = props.navigate;
    const [query, setQuery] = React.useState('');
    const FROM = React.useMemo(function () { return pacificTodayStartISO(); }, []);

    const dash = window.HWIdv.usePoll('/api/idv/dashboard?window=7d', 30000);
    const declined = window.HWIdv.usePoll(
      '/api/idv/sessions?status=Declined&from=' + encodeURIComponent(FROM) + '&limit=200', 30000);
    const awaiting = window.HWIdv.usePoll(
      '/api/idv/sessions?status=' + encodeURIComponent('Awaiting User') + '&from=' + encodeURIComponent(FROM) + '&limit=200', 30000);
    const approved = window.HWIdv.usePoll(
      '/api/idv/sessions?status=Approved&from=' + encodeURIComponent(FROM) + '&limit=200', 30000);

    // Same "never armed / first request had nothing to fall back on" signal
    // IdvShared.NotConnected exists for elsewhere in Verify.
    const notConnected = !!dash.error && dash.data == null;
    const firstLoad = dash.loading && dash.data == null && !dash.error;

    function onSearchKey(e) {
      if (e.key !== 'Enter') return;
      const q = query.trim();
      // See gap #1 in the file header: the real route is '/sessions', not
      // '/verifications'.
      navigate('#/sessions' + (q ? ('?q=' + encodeURIComponent(q)) : ''));
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1180 }}>
        <SectionHead eyebrow="Overview" title="Home"
          subtitle="Everything below is for today, or the last 7 days where a panel says so. A panel with nothing in it says that in words, never a flat line." />

        <Field icon="search" size="lg" placeholder="Find a guest by name, email, phone or session #"
          value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onSearchKey} />

        {notConnected ? (
          <window.IdvShared.NotConnected onRetry={dash.refresh} />
        ) : firstLoad ? (
          <HomeSkeleton />
        ) : (
          <React.Fragment>
            <HealthStrip dash={dash} />
            <TodayCounts dash={dash} approved={approved} declined={declined} awaiting={awaiting} />
            <ExceptionsCard declined={declined} awaiting={awaiting} navigate={navigate} />
            <DashboardPanels dash={dash} />
          </React.Fragment>
        )}
      </div>);
  };
})();
