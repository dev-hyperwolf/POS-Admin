// ── One bounty — #/contests/:id · live standings, the trail, the audit ─────
// Design: explorations/Incentives - Concept D - Two Seats.html, tab "3 · Bounties"
//         (detail panel) + explorations/Incentives - Concept B - Ledger.html
//         ("How this was computed" disclosure, folded in here).
// Backend: GET /api/incentives/contests/{id} · GET /api/incentives/me (sources)
//          POST /api/incentives/contests/{id}/submit|approve|cancel|settle
//          Shapes: docs/BOUNTY-API-CONTRACT.md. Plan §3.4 (state machine), §3.5 (scoring).
//
// PROJECTED IS NOT EARNED, AND THEY ARE NEVER ADDED UP. A round carries
// `settled: false` until settlement writes the ledger rows, so the money column
// is headed "Projected" until then and "Earned" after — never one word for
// both, and never a total that mixes the two. This is the distinction the whole
// module exists to keep honest (plan §3.5), so it is a column heading, not a
// footnote.
//
// WHAT THE BOARD CANNOT SEE IS ON THE BOARD. Competition ranking (1, 1, 3) with
// an explicit `tied` marker; people with no sales in the window listed under
// `not_yet` with rank "—" instead of ranked last at zero; and unattributed
// sales as their own row, because a sale with no budtender on it is a number
// this table is missing, not a number that does not exist.
//
// SETTLE MOVES NO MONEY. Every confirm row says so in the copy. Settling writes
// earned amounts to the points ledger; payment stays wherever payroll lives
// (plan §3.6). An action that sounds like a payout and is not is the single
// most expensive thing this screen could get wrong.
//
// ⚠️ SEAT DETECTION AND TOASTS: same two shell gaps as screen-contests.jsx —
// app.jsx passes only {navigate, query, route, path} and mounts no ToastHost.
// See that file's header for the reasoning; the mechanism is repeated here
// rather than shared because inc-shared.jsx is not this brief's file.
;(function () {
  const useP = window.useP;

  const KIND_LABEL = { spiff: 'Spiff', contest: 'Ranked bounty', team_goal: 'Team goal',
    store_vs_store: 'Store vs store', aov_goal: 'AOV goal' };
  const METRIC_LABEL = { net_cents: 'Net $', gross_cents: 'Gross $', units: 'Units',
    txn_count: 'Orders', aov_cents: 'AOV' };
  const SOURCE_LABEL = { 'blaze-api': 'Blaze API', 'meadow-api': 'Meadow API',
    'blaze-csv': 'Blaze CSV', 'meadow-csv': 'Meadow CSV', hwpos: 'Hyperwolf POS' };
  const RECURRENCE_LABEL = { none: 'Doesn’t repeat', hourly: 'Hourly', daily: 'Daily', weekly: 'Weekly' };
  const TIE_LABEL = { split: 'Split the place', earliest: 'Whoever got there first' };
  const REWARD_TYPE_LABEL = { threshold: 'Threshold', per_unit: 'Per unit', places: 'Places',
    team_threshold: 'Team threshold', aov: 'AOV goal' };

  function valueLabel(value, kind) {
    const f = window.HWInc.fmt;
    if (value == null) return '—';
    if (kind === 'units') return f.number(value) + ' units';
    if (kind === 'txn_count') return f.number(value) + ' orders';
    return f.cents(value);
  }
  const stamp = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : '—');
  const dayTime = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

  // Same adapter, same reason, as screen-contests.jsx: the contract's Source is
  // not the shape IncShared.SourceFreshness reads, and nothing is invented to
  // bridge them.
  function freshnessRows(sources) {
    if (!Array.isArray(sources)) return [];
    return sources.map((s) => {
      const at = s.last_error_at ? new Date(s.last_error_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : null;
      return {
        source: SOURCE_LABEL[s.source] || s.source,
        store: s.store_name || s.store_id,
        status: s.last_error ? 'bad' : s.configured === false ? 'off' : s.stale ? 'warn' : s.last_ok_at ? 'ok' : 'off',
        synced_at: s.last_ok_at || null,
        count_today: s.today && s.today.txns != null ? s.today.txns : null,
        last_error: s.last_error ? (at ? at + ': ' + s.last_error : s.last_error) : null,
      };
    });
  }

  const toast = (t) => { if (window.hdToast) window.hdToast(t); };

  const SEAT_MAX_WIDTH = 460;
  function useSeatFrame(isManager) {
    const ref = React.useRef(null);
    const [narrow, setNarrow] = React.useState(false);
    React.useLayoutEffect(() => {
      const el = ref.current;
      if (!el) return undefined;
      const measure = () => { const w = el.clientWidth; if (w > 0) setNarrow(w <= SEAT_MAX_WIDTH); };
      measure();
      if (typeof ResizeObserver === 'undefined') return undefined;
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }, []);
    return { ref, seat: !isManager || narrow };
  }
  function useIsManager(propValue) {
    if (propValue != null) return propValue;
    const role = window.HWInc.session().role;
    return role === 'Floor Manager' || role === 'Admin';
  }

  function CardHead({ icon, title, right, tone }) {
    const P = useP();
    const fg = tone === 'warn' ? P.warnText : tone === 'bad' ? P.bad : tone === 'accent' ? P.accentText : P.inkDim;
    const bg = tone === 'warn' ? P.warnSoft : tone === 'bad' ? P.badSoft : tone === 'accent' ? P.accentSoft : P.surface3;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: `1px solid ${P.hairline}` }}>
        {icon && (
          <span style={{ width: 28, height: 28, borderRadius: P.r8, background: bg, color: fg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
            <Icon name={icon} size={15} stroke={1.8} />
          </span>)}
        <span style={{ flex: 1, minWidth: 0, fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>{title}</span>
        {right}
      </div>);
  }

  function KV({ k, v, mono }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '7px 0', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: P.type.body, color: P.inkDim }}>{k}</span>
        <span style={{ fontSize: P.type.body, fontWeight: 600, color: P.ink,
          fontFamily: mono ? P.fontMono : P.fontSans, fontVariantNumeric: mono ? 'tabular-nums' : 'normal' }}>{v}</span>
      </div>);
  }

  function ConfirmRow({ tone, title, body, confirmLabel, confirmVariant, busy, onConfirm, onCancel, reason, onReasonChange, reasonPlaceholder }) {
    const P = useP();
    const bg = tone === 'bad' ? P.badSoft : tone === 'warn' ? P.warnSoft : P.infoSoft;
    const bd = tone === 'bad' ? P.bad : tone === 'warn' ? P.warn : P.info;
    return (
      <div style={{ background: bg, border: `1px solid ${bd}`, borderRadius: P.r10, padding: '11px 13px',
        display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>{title}</div>
        {body && <div style={{ fontSize: P.type.body, color: P.ink2, lineHeight: 1.5 }}>{body}</div>}
        {onReasonChange && (
          <Field size="sm" icon="note" placeholder={reasonPlaceholder} value={reason} onChange={(e) => onReasonChange(e.target.value)} />)}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <PBtn size="sm" variant={confirmVariant || 'accent'} busy={busy} onClick={onConfirm}>{confirmLabel}</PBtn>
          <PBtn size="sm" variant="ghost" disabled={busy} onClick={onCancel}>Leave it alone</PBtn>
        </div>
      </div>);
  }

  // ── standings ───────────────────────────────────────────────────────────
  // Hand-rolled rather than DataTable, deliberately: this table needs three
  // things the atom cannot express — a highlighted "me" row, a warn-toned
  // unattributed row that is not a ranked row, and a footer that is prose. It
  // matches DataTable's construction exactly (bordered r14 container, surface2
  // head, hairline2 under it, hairline between rows), which is the estate's
  // stated expectation for a hand-rolled leaderboard.
  function Standings({ round, meId, seat }) {
    const P = useP();
    const ranked = Array.isArray(round.standings) ? round.standings : [];
    const notYet = Array.isArray(round.not_yet) ? round.not_yet : [];
    const un = round.unattributed;
    const settled = round.settled === true;
    const moneyHead = settled ? 'Earned' : 'Projected';
    const th = { textAlign: 'left', padding: '11px 14px', fontWeight: 600, fontSize: P.type.meta,
      letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkDim, borderBottom: `1px solid ${P.hairline2}`, whiteSpace: 'nowrap' };
    const td = { padding: '11px 14px', borderTop: `1px solid ${P.hairline}`, verticalAlign: 'middle', color: P.ink };
    const mono = { fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' };

    if (ranked.length === 0 && notYet.length === 0 && !un) {
      return (
        <EmptyState icon="chart" title="Nothing has scored in this round yet"
          body="The board fills in as sales land and are attributed to a person. If sales are landing and nobody is moving, the identities queue in Data is the place to look." />);
    }

    return (
      <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r14, overflow: 'hidden', background: P.surface }}>
        <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: P.type.strong, fontFamily: P.fontSans }}>
            <thead>
              <tr style={{ background: P.surface2 }}>
                <th style={{ ...th, width: 62 }}>Rank</th>
                <th style={th}>Budtender</th>
                <th style={{ ...th, textAlign: 'right' }}>Value</th>
                <th style={{ ...th, textAlign: 'right' }}>{moneyHead}</th>
                {!seat && <th style={{ ...th, width: 140 }}>Progress</th>}
              </tr>
            </thead>
            <tbody>
              {ranked.map((s) => {
                const isMe = meId && s.associate_id === meId;
                return (
                  <tr key={s.associate_id} style={{ background: isMe ? P.accentSoft : 'transparent' }}>
                    <td style={{ ...td, ...mono, fontWeight: 700, borderLeft: isMe ? `3px solid ${P.accent}` : undefined }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {s.rank == null ? '—' : s.rank}
                        {s.movement === 1 && <Icon name="arrow-up" size={12} stroke={2.4} color={P.good} />}
                        {s.movement === -1 && <Icon name="arrow-down" size={12} stroke={2.4} color={P.bad} />}
                      </span>
                    </td>
                    <td style={td}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                        <Avatar name={s.name} size={26} />
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontWeight: 700, color: P.ink }}>
                            {s.name}{isMe ? ' · you' : ''}
                          </span>
                          <span style={{ display: 'block', ...mono, fontSize: P.type.meta, color: P.inkDim }}>{s.store_name || s.store_id || ''}</span>
                        </span>
                        {s.tied && <Pill kind="info" size="sm">tied</Pill>}
                      </span>
                    </td>
                    <td style={{ ...td, ...mono, textAlign: 'right', fontWeight: 600 }}>{valueLabel(s.value, s.value_kind)}</td>
                    <td style={{ ...td, ...mono, textAlign: 'right', color: settled ? P.ink : P.ink2 }}>
                      {s.earned_cents == null ? '—' : window.HWInc.fmt.cents(s.earned_cents)}
                    </td>
                    {!seat && (
                      <td style={td}>
                        <BarMeter value={s.progress == null ? 0 : s.progress} color={isMe ? P.accent : P.info} height={8} />
                      </td>)}
                  </tr>);
              })}

              {un && (un.txns || un.cents) ? (
                <tr style={{ background: P.warnSoft }}>
                  <td style={{ ...td, ...mono, color: P.warnText, fontWeight: 700 }}>—</td>
                  <td style={{ ...td, color: P.warnText, fontWeight: 700 }}>
                    No budtender on the record
                    <span style={{ display: 'block', ...mono, fontWeight: 500, fontSize: P.type.meta }}>
                      {window.HWInc.fmt.number(un.txns || 0)} sales this round can&#8217;t count toward anyone
                    </span>
                  </td>
                  <td style={{ ...td, ...mono, textAlign: 'right', color: P.warnText, fontWeight: 600 }}>{window.HWInc.fmt.cents(un.cents || 0)}</td>
                  <td style={{ ...td, ...mono, textAlign: 'right', color: P.warnText }}>—</td>
                  {!seat && (
                    <td style={td}>
                      <a href="#/data" style={{ fontSize: P.type.meta, fontWeight: 700, color: P.info, textDecoration: 'none' }}>Resolve identities</a>
                    </td>)}
                </tr>) : null}

              {notYet.length > 0 && (
                <tr>
                  <td colSpan={seat ? 4 : 5} style={{ ...td, background: P.surface2, fontSize: P.type.meta, color: P.inkDim, lineHeight: 1.55 }}>
                    <b style={{ color: P.ink2 }}>{notYet.map((p) => p.name).join(' · ')}</b>
                    {notYet.length === 1 ? ' has ' : ' have '}
                    no sales that count in this round, so there is no rank to give — listed, not ranked at zero.
                  </td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </div>);
  }

  // ── Concept B's computation trail, as a disclosure ──────────────────────
  // The two lines under "Net counted" add back to it exactly. Nothing is
  // dropped to make the board tidy: if attribution breaks, the residual grows
  // and you can watch it grow.
  function TrailDisclosure({ trail }) {
    const P = useP();
    if (!trail) return null;
    const f = window.HWInc.fmt;
    const row = (label, note, value, kind) => (
      <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '8px 0',
        borderTop: kind === 'sum' ? `1px solid ${P.hairline2}` : `1px solid ${P.hairline}` }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: P.type.body, fontWeight: kind === 'sum' ? 700 : 500,
            color: kind === 'resid' ? P.warnText : P.ink }}>{label}</span>
          {note && <span style={{ display: 'block', marginTop: 1, fontSize: P.type.meta, fontFamily: P.fontMono, color: P.inkDim }}>{note}</span>}
        </span>
        <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', fontSize: P.type.body,
          fontWeight: kind === 'sum' ? 800 : 600, color: kind === 'neg' ? P.bad : kind === 'resid' ? P.warnText : P.ink }}>{value}</span>
      </div>);
    return (
      <details style={{ background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, padding: '10px 13px' }}>
        <summary style={{ cursor: 'pointer', fontSize: P.type.body, fontWeight: 600, color: P.ink2 }}>How this was computed</summary>
        <div style={{ marginTop: 8 }}>
          {trail.window && (
            <div style={{ fontSize: P.type.meta, fontFamily: P.fontMono, color: P.inkDim, marginBottom: 4 }}>
              {dayTime(trail.window.from)} → {dayTime(trail.window.to)} · store-local, computed once at ingest
            </div>)}
          {row('Gross sales', (trail.txns != null ? f.number(trail.txns) + ' sale rows' : null), f.cents(trail.gross_cents))}
          {row('Refunds netted', (trail.refunds != null ? f.number(trail.refunds) + ' refund rows, each linked to a sale inside this window' : null), '−' + f.cents(trail.refund_cents), 'neg')}
          {row('Net counted', null, f.cents(trail.net_cents), 'sum')}
          {row('Attributed to a budtender', null, f.cents(trail.attributed_cents))}
          {row('No budtender on the record', null, f.cents(trail.unattributed_cents), 'resid')}
          {Array.isArray(trail.sources) && trail.sources.length > 0 && (
            <div style={{ marginTop: 8, fontSize: P.type.meta, fontFamily: P.fontMono, color: P.inkDim }}>
              Sources counted · {trail.sources.join(' · ')}
            </div>)}
          <p style={{ margin: '9px 0 0', fontSize: P.type.body, color: P.inkDim, lineHeight: 1.5 }}>
            The two lines under &#8220;Net counted&#8221; add back to it exactly. Nothing is dropped to make the board look tidy — if attribution breaks, the residual grows and you can see it grow.
          </p>
        </div>
      </details>);
  }

  function Audit({ events }) {
    const P = useP();
    if (!Array.isArray(events) || events.length === 0) {
      return <EmptyState compact icon="clock" title="Nothing recorded yet" body="Every transition and every edit lands here as it happens, and nothing here is ever removed." />;
    }
    const dotColor = (a) => (/cancel|decline/i.test(a) ? P.bad : /approve|settle/i.test(a) ? P.good : /submit/i.test(a) ? P.warnText : P.info);
    return (
      <div style={{ padding: '4px 16px 14px' }}>
        {events.map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, paddingTop: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: dotColor(e.action || ''), marginTop: 5, flex: '0 0 auto' }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ fontSize: P.type.body, color: P.ink2 }}>
                <b style={{ color: P.ink }}>{e.action}</b>
                {e.from != null || e.to != null ? ' — ' + (e.from == null ? '' : String(e.from) + ' → ') + (e.to == null ? '' : String(e.to)) : ''}
              </span>
              {e.reason && <span style={{ display: 'block', marginTop: 2, fontSize: P.type.body, fontStyle: 'italic', color: P.inkDim }}>&#8220;{e.reason}&#8221;</span>}
              <span style={{ display: 'block', marginTop: 2, fontFamily: P.fontMono, fontSize: P.type.meta, color: P.inkMute }}>
                {stamp(e.ts)} · actor {e.actor}
              </span>
            </span>
          </div>))}
      </div>);
  }

  // ── the screen ──────────────────────────────────────────────────────────
  function Detail({ navigate, id, seat }) {
    const P = useP();
    const S = window.IncShared;
    const session = window.HWInc.session();
    const detail = window.HWInc.usePoll('/api/incentives/contests/' + encodeURIComponent(id), { intervalMs: 20000 });
    // /me carries sources[]; the detail route does not (see the report note).
    const me = window.HWInc.usePoll('/api/incentives/me', { intervalMs: 30000 });

    const [roundKey, setRoundKey] = React.useState(null);
    const [confirming, setConfirming] = React.useState(null);
    const [reason, setReason] = React.useState('');
    const [busy, setBusy] = React.useState(false);

    const back = (
      <button onClick={() => navigate('#/contests')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
        background: 'none', border: 'none', padding: 0, fontSize: P.type.meta, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '.06em', color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
        <Icon name="arrow-left" size={12} stroke={2} />Bounties
      </button>);

    if (detail.error && !detail.data) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {back}
          <S.NotConnected onRetry={detail.refresh} />
        </div>);
    }
    if (detail.loading && !detail.data) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {back}
          <Card padding={16}><Skeleton lines={2} /></Card>
          <SkeletonRows rows={4} />
        </div>);
    }

    const data = detail.data || {};
    const c = data.contest || {};
    const sum = data.summary || {};
    const rounds = Array.isArray(data.rounds) ? data.rounds : [];
    const status = sum.status || c.status;
    const kind = sum.kind || c.kind;
    const funding = c.funding || {};
    const fundedBy = sum.funded_by || funding.funded_by;
    const brand = sum.brand || funding.brand;
    const reward = c.reward || {};
    const recurrence = c.recurrence || sum.recurrence || 'none';
    const round = rounds.find((r) => r.round_key === roundKey) || rounds[0] || null;

    async function act(action, verb, after) {
      setBusy(true);
      const body = { actor: session.id };
      if (reason.trim()) body.reason = reason.trim();
      const r = await window.HWInc.post('/api/incentives/contests/' + encodeURIComponent(id) + '/' + action, body);
      setBusy(false);
      if (r.ok) {
        setConfirming(null); setReason('');
        toast({ title: verb, description: after, tone: action === 'cancel' ? 'warn' : 'ok' });
        detail.refresh(); me.refresh();
      } else {
        const msg = (r.body && r.body.error) || r.error || ('HTTP ' + r.code);
        toast({ title: 'That didn’t go through', description: msg, tone: 'blocked' });
      }
    }

    // Manager actions, by status (plan §3.4). A budtender gets none of this.
    let actions = null;
    if (!seat) {
      const open = confirming;
      if (status === 'draft') {
        actions = open === 'submit' ? (
          <ConfirmRow tone="info" title="Submit this draft for approval?"
            body="It moves to pending approval and stops being editable. A manager at the store — you or someone else — has to approve it before it scores anything."
            confirmLabel="Submit for approval" busy={busy}
            onConfirm={() => act('submit', 'Submitted for approval', 'It is waiting on a manager now.')}
            onCancel={() => setConfirming(null)} />
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <PBtn size="sm" variant="accent" icon="send" onClick={() => { setReason(''); setConfirming('submit'); }}>Submit for approval</PBtn>
            <PBtn size="sm" variant="secondary" icon="pencil" onClick={() => navigate('#/contests/new?id=' + encodeURIComponent(id))}>Edit the draft</PBtn>
          </div>);
      } else if (status === 'pending_approval') {
        actions = open === 'approve' ? (
          <ConfirmRow tone="warn" title="Approve it and let it start scoring?"
            body="Nothing is scored and nobody accrues anything until you approve it. Approving records your name against it permanently, and it does not backdate an award."
            confirmLabel="Approve and start" busy={busy}
            onConfirm={() => act('approve', 'Approved', 'It scores from now on.')}
            onCancel={() => setConfirming(null)} />
        ) : open === 'cancel' ? (
          <ConfirmRow tone="bad" title="Cancel it before it ever runs?"
            body="It stays in the list as cancelled, with your name and reason in the audit, and it can never score."
            confirmLabel="Cancel it" confirmVariant="danger" busy={busy}
            reason={reason} onReasonChange={setReason} reasonPlaceholder="Why you’re cancelling it (optional)"
            onConfirm={() => act('cancel', 'Cancelled', 'Nothing will score against it.')}
            onCancel={() => setConfirming(null)} />
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <PBtn size="sm" variant="accent" icon="check-circle" onClick={() => { setReason(''); setConfirming('approve'); }}>Approve and start</PBtn>
            <PBtn size="sm" variant="secondary" onClick={() => { setReason(''); setConfirming('cancel'); }}>Cancel it</PBtn>
          </div>);
      } else if (status === 'active') {
        actions = open === 'cancel' ? (
          <ConfirmRow tone="bad" title="Cancel a bounty that is running?"
            body="People are already scoring against it. Cancelling stops it where it is; nothing already projected is settled, and nobody is paid anything on paper."
            confirmLabel="Cancel it" confirmVariant="danger" busy={busy}
            reason={reason} onReasonChange={setReason} reasonPlaceholder="Why you’re cancelling it (optional)"
            onConfirm={() => act('cancel', 'Cancelled', 'It stopped scoring.')}
            onCancel={() => setConfirming(null)} />
        ) : (
          <PBtn size="sm" variant="secondary" onClick={() => { setReason(''); setConfirming('cancel'); }}>Cancel it</PBtn>);
      } else if (status === 'ended') {
        actions = open === 'settle' ? (
          <ConfirmRow tone="warn" title="Settle it and write the earned amounts?"
            body="Settling writes each person’s earned amount into the points ledger and closes the bounty. It moves no money — payment stays wherever payroll lives, and a manager records a payment separately in Earnings."
            confirmLabel="Settle it" busy={busy}
            reason={reason} onReasonChange={setReason} reasonPlaceholder="A note for the audit (optional)"
            onConfirm={() => act('settle', 'Settled', 'Earned amounts are in the ledger. No money moved.')}
            onCancel={() => setConfirming(null)} />
        ) : (
          <PBtn size="sm" variant="accent" icon="coins" onClick={() => { setReason(''); setConfirming('settle'); }}>Settle it</PBtn>);
      }
    }

    const headerCard = (
      <Card padding={0}>
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, flex: 1, minWidth: 200, fontSize: seat ? P.type.h2 : 26, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>
              {sum.name || c.name || 'Bounty'}
            </h1>
            <S.StatusPill status={status} size="md" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Pill kind="neutral" size="sm">{KIND_LABEL[kind] || kind}</Pill>
            <Pill kind="neutral" size="sm">{METRIC_LABEL[sum.metric || c.metric] || sum.metric || c.metric}</Pill>
            {fundedBy === 'brand'
              ? <Pill kind="accent" size="sm" icon="tag">{brand || 'Brand-funded'}</Pill>
              : <Pill kind="neutral" size="sm">Store-funded</Pill>}
            {recurrence !== 'none' && <Pill kind="info" size="sm" icon="refresh">{RECURRENCE_LABEL[recurrence] || recurrence}</Pill>}
            {sum.has_source === false && <Pill kind="bad" size="sm" icon="plug">no data source</Pill>}
          </div>
          {(sum.sentence || c.description) && (
            <p style={{ margin: 0, fontSize: P.type.strong, color: P.ink2, lineHeight: 1.6 }}>{sum.sentence || c.description}</p>)}
          <div style={{ fontFamily: P.fontMono, fontSize: P.type.meta, color: P.inkDim }}>
            {[dayTime(c.window_start || sum.window_start) + ' → ' + dayTime(c.window_end || sum.window_end),
              c.tz || sum.tz,
              sum.participants_count != null ? sum.participants_count + ' people' : null].filter(Boolean).join(' · ')}
          </div>
          {actions && <div style={{ marginTop: 2 }}>{actions}</div>}
          {status === 'settled' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: P.infoSoft,
              border: `1px solid ${P.info}`, borderRadius: P.r10, fontSize: P.type.body, color: P.ink2 }}>
              <Icon name="check-circle" size={15} stroke={1.9} color={P.info} />
              <span>Settled. The amounts below are written into the ledger — no money moved, and nothing here can change now.</span>
            </div>)}
        </div>
      </Card>);

    const roundPicker = (recurrence !== 'none' && rounds.length > 1) ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        <span style={{ fontSize: P.type.meta, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, flex: '0 0 auto' }}>Round</span>
        {rounds.map((r) => (
          <PBtn key={r.round_key} size="xs" variant={(round && r.round_key === round.round_key) ? 'primary' : 'secondary'}
            style={{ fontFamily: P.fontMono, flex: '0 0 auto' }}
            onClick={() => setRoundKey(r.round_key)}>{r.round_key}</PBtn>))}
      </div>) : null;

    const standingsBlock = (
      <Card padding={0}>
        <CardHead icon="trophy" title={round ? 'The bounty board' : 'The bounty board'}
          right={round ? (round.settled
            ? <Pill kind="info" size="sm" dot>Settled round</Pill>
            : <Pill kind="warn" size="sm" dot>Projected</Pill>) : null} />
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {roundPicker}
          {round ? (
            <React.Fragment>
              <div style={{ fontFamily: P.fontMono, fontSize: P.type.meta, color: P.inkDim }}>
                {dayTime(round.window_start)} → {dayTime(round.window_end)}
              </div>
              <Standings round={round} meId={session.id} seat={seat} />
              {Array.isArray(round.teams) && round.teams.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: P.type.meta, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>Teams</div>
                  {round.teams.map((t) => (
                    <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                      background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
                      <span style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink }}>{t.rank == null ? '—' : t.rank}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: P.type.strong, fontWeight: 600, color: P.ink }}>
                        {t.name}{t.tied ? ' · tied' : ''}
                      </span>
                      <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink2 }}>
                        {valueLabel(t.value, (t.members && t.members[0] && t.members[0].value_kind) || sum.metric)}
                      </span>
                    </div>))}
                </div>)}
              {Array.isArray(round.stores) && round.stores.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: P.type.meta, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>Stores</div>
                  {round.stores.map((st) => (
                    <div key={st.store_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                      background: st.counted === false ? P.warnSoft : P.surface2,
                      border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
                      <span style={{ fontFamily: P.fontMono, fontWeight: 700, color: st.counted === false ? P.warnText : P.ink }}>{st.rank == null ? '—' : st.rank}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: P.type.strong, fontWeight: 600, color: st.counted === false ? P.warnText : P.ink }}>
                        {st.store_name || st.store_id}{st.tied ? ' · tied' : ''}
                        {st.reason && <span style={{ display: 'block', fontFamily: P.fontMono, fontWeight: 500, fontSize: P.type.meta }}>{st.reason}</span>}
                      </span>
                      <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink2 }}>{valueLabel(st.value, sum.metric)}</span>
                    </div>))}
                </div>)}
            </React.Fragment>
          ) : (
            <EmptyState compact icon="clock" title="This bounty has no rounds yet"
              body="A round appears once the window opens. Nothing is scored before then." />)}
          <TrailDisclosure trail={data.trail} />
          <S.SourceFreshness sources={freshnessRows(me.data && me.data.sources)} />
        </div>
      </Card>);

    const fundingCard = (
      <Card padding={0}>
        <CardHead icon="coins" title="Funding and reward" />
        <div style={{ padding: '4px 16px 12px' }}>
          <KV k="Funded by" v={fundedBy === 'brand' ? (brand ? brand + ' (brand)' : 'A brand') : 'This store'} />
          {funding.budget_cents != null && <KV k="Budget" v={window.HWInc.fmt.cents(funding.budget_cents)} mono />}
          {funding.cap_per_person_cents != null && <KV k="Cap per person" v={window.HWInc.fmt.cents(funding.cap_per_person_cents)} mono />}
          <KV k="Reward shape" v={REWARD_TYPE_LABEL[reward.type] || reward.type || '—'} />
          {sum.reward_summary && <KV k="Reward" v={sum.reward_summary} mono />}
          <KV k="Reward unit" v={reward.unit === 'cents' ? 'cents · tracked, never paid' : (reward.unit || '—')} mono />
          <KV k="Tie rule" v={TIE_LABEL[c.tie_rule] || c.tie_rule || '—'} />
          <KV k="Repeats" v={RECURRENCE_LABEL[recurrence] || recurrence} />
        </div>
      </Card>);

    const auditCard = (
      <Card padding={0}>
        <CardHead icon="clock" title="Audit" right={<Pill kind="neutral" size="sm">append-only</Pill>} />
        <Audit events={data.audit} />
      </Card>);

    if (seat) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {back}
          {headerCard}
          {standingsBlock}
          {fundingCard}
        </div>);
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {back}
        {headerCard}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>{standingsBlock}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>{fundingCard}{auditCard}</div>
        </div>
      </div>);
  }

  // ── route entry ─────────────────────────────────────────────────────────
  // app.jsx sends EVERY '/contests/*' path here except '/contests/new', so
  // '#/contests/:id/edit' — a route the plan lists — lands on this file rather
  // than the builder. Rather than change the shell (not this brief's file), the
  // edit path is forwarded to the builder's own '?id=' form, which app.jsx does
  // route. See the report: the shell is the better long-term fix.
  window.IncScreenContestDetail = function IncScreenContestDetail(props) {
    const P = useP();
    const isManager = useIsManager(props.isManager);
    const frame = useSeatFrame(isManager);
    const parts = (props.path || '').split('/').filter(Boolean); // ['contests', id, 'edit'?]
    const id = parts[1] || '';
    const isEdit = parts[2] === 'edit';

    React.useEffect(() => {
      if (isEdit && id) props.navigate('#/contests/new?id=' + encodeURIComponent(id));
    }, [isEdit, id]);

    return (
      <div ref={frame.ref} style={{ width: '100%' }}>
        {window.ToastHost && <window.ToastHost />}
        {!id ? (
          <EmptyState icon="alert" title="That bounty link is incomplete"
            body="The address carries no bounty id. Open one from the Bounties list and the link will carry its id."
            action={<PBtn size="sm" variant="secondary" icon="arrow-left" onClick={() => props.navigate('#/contests')}>Back to Bounties</PBtn>} />
        ) : isEdit ? (
          <div style={{ fontSize: P.type.body, color: P.inkDim, padding: 20 }}>Opening the builder for this draft…</div>
        ) : (
          <Detail navigate={props.navigate} id={id} seat={frame.seat} />)}
      </div>);
  };
})();
