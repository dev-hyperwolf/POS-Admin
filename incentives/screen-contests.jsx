// ── Bounties — #/contests · the console owns the lifecycle, the seat owns the progress ─
// Design: explorations/Incentives - Concept D - Two Seats.html, tab "3 · Bounties".
// Backend: GET /api/incentives/contests?store_id (console) · GET /api/incentives/me (seat)
//          POST /api/incentives/contests/{id}/approve · .../cancel
//          Shapes: docs/BOUNTY-API-CONTRACT.md. Plan: docs/INCENTIVES-PLAN-2026-09-07.md §3.4, §5.
//
// NO FABRICATED NUMBERS. Every figure on this screen is a field the contract
// names. When the backend is unreachable the screen says so (IncShared.
// NotConnected) rather than degrading to a plausible-looking board — the AOV
// rule, and the reason this module exists at all.
//
// TWO SEATS, ONE ROUTE. A budtender sees only bounties that already concern
// them (from /me: my open bounties, my progress, what the round pays) with no
// status filter and no lifecycle action, because a control they cannot use
// teaches them the product is not for them. A manager sees the whole list by
// status, plus the approval inbox strip — the one thing on this route that is
// waiting on a person.
//
// WHICH SEAT. incentives/app.jsx passes every screen `{navigate, query, route,
// path, session, isManager, previewing, seat: 'console'|'seat', me}` — `seat`
// already accounts for a manager previewing the budtender seat, so this file
// reads it straight off props instead of measuring its own width.
//
// TOASTS. window.hdToast exists only while a <ToastHost> is mounted; app.jsx
// mounts exactly one for the whole shell. Every write outcome that stays on
// this screen (approve, decline) reports through window.hdToast directly.
;(function () {
  const useP = window.useP;

  const KIND_LABEL = { spiff: 'Spiff', contest: 'Ranked bounty', team_goal: 'Team goal',
    store_vs_store: 'Store vs store', aov_goal: 'AOV goal' };
  const METRIC_LABEL = { net_cents: 'Net $', gross_cents: 'Gross $', units: 'Units',
    txn_count: 'Orders', aov_cents: 'AOV' };

  // The status tabs, in lifecycle order (plan §3.4). "All" is first because
  // Concept D's own filter opens on it.
  const STATUS_TABS = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'pending_approval', label: 'Pending approval' },
    { value: 'active', label: 'Active' },
    { value: 'ended', label: 'Ended' },
    { value: 'settled', label: 'Settled' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  // What an empty status tab says. Written out rather than derived from the
  // tab label, because "Nothing is draft" is not a sentence.
  const EMPTY_TITLE = {
    draft: 'No drafts', pending_approval: 'Nothing is waiting for your approval',
    active: 'Nothing is running right now', ended: 'Nothing has ended and gone unsettled',
    settled: 'Nothing has been settled yet', cancelled: 'Nothing has been cancelled',
  };

  // ── formatting ──────────────────────────────────────────────────────────
  // value_kind decides the unit, never the caller — a units bounty showing a
  // dollar sign is the failure this exists to prevent.
  function valueLabel(value, kind) {
    const f = window.HWInc.fmt;
    if (value == null) return '—';
    if (kind === 'units') return f.number(value) + ' units';
    if (kind === 'txn_count') return f.number(value) + ' orders';
    return f.cents(value);
  }
  const dayLabel = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—');
  function windowLabel(a, b) {
    if (!a && !b) return '—';
    return dayLabel(a) + ' – ' + dayLabel(b);
  }
  function endsInLabel(s) {
    if (s == null) return null;
    if (s <= 0) return 'ended';
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (d >= 1) return 'ends in ' + d + 'd ' + h + 'h';
    if (h >= 1) return 'ends in ' + h + 'h ' + m + 'm';
    return 'ends in ' + m + 'm';
  }

  const toast = (t) => { if (window.hdToast) window.hdToast(t); };

  // ── local composites (kept in this file: inc-shared.jsx is shared and this
  // brief does not own it) ────────────────────────────────────────────────
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

  // Inline confirm — the estate's rule for an irreversible action: never
  // confirm(), never a bare button that fires on the first click. The row
  // replaces the trigger in place so the thing being confirmed stays visible.
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
          <PBtn size="sm" variant="ghost" disabled={busy} onClick={onCancel}>Keep it as it is</PBtn>
        </div>
      </div>);
  }

  function FundingChip({ fundedBy, brand }) {
    if (fundedBy === 'brand') return <Pill kind="accent" size="sm" icon="tag">{brand || 'Brand'}</Pill>;
    return <Pill kind="neutral" size="sm">Store</Pill>;
  }

  // ── the budtender seat ──────────────────────────────────────────────────
  // From /me only. A bounty reaches this screen when it is already running for
  // this person, so there is no status filter and no action — just what it
  // wants, where they are, and when it ends.
  function SeatBounties({ navigate, me }) {
    const P = useP();
    const fmt = window.HWInc.fmt;
    const S = window.IncShared;

    if (me.error && !me.data) return <S.NotConnected onRetry={me.refresh} />;
    if (me.loading && !me.data) {
      return (
        <Card padding={0}>
          <CardHead icon="award" title="Running now" />
          <div style={{ padding: 14 }}><SkeletonRows rows={3} avatar={false} /></div>
        </Card>);
    }

    const data = me.data || {};
    const bounties = Array.isArray(data.bounties) ? data.bounties : [];
    const running = bounties.filter((b) => b.status === 'active');
    const waiting = bounties.filter((b) => b.status === 'ended');

    const rowFor = (b) => {
      const my = b.my || {};
      const value = valueLabel(my.value, my.value_kind);
      const rank = my.rank != null ? '#' + my.rank + (my.tied ? ' · tied' : '') : 'no rank yet';
      // fmt.relative already carries its own direction ("in 3d" / "2d ago"),
      // so the verb has to agree with it or the row reads "ends 2d ago".
      const endWord = b.ends_at ? ((new Date(b.ends_at).getTime() > Date.now() ? 'ends ' : 'ended ') + fmt.relative(b.ends_at)) : null;
      const sub = [b.reward_summary, endWord, b.brand ? b.brand : null].filter(Boolean).join(' · ');
      const color = my.rank === 1 ? P.good : b.funded_by === 'brand' ? P.accent : P.info;
      return (
        <div key={b.id} data-hw-i role="button" tabIndex={0}
          onClick={() => navigate('#/contests/' + b.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('#/contests/' + b.id); } }}
          style={{ cursor: 'pointer', minHeight: P.ctrlH.xl }}>
          <S.ProgressRow title={b.name} valueLabel={rank + ' · ' + value}
            pct={my.progress == null ? 0 : my.progress} color={color} sub={sub} />
        </div>);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card padding={0}>
          <CardHead icon="award" title="Running now"
            right={running.length ? <Pill kind="good" size="sm" dot>{running.length}</Pill> : null} />
          {running.length === 0 ? (
            <EmptyState compact icon="award" title="No bounty is running for you"
              body="When your manager starts one that includes you, it shows up here with your progress in it." />
          ) : running.map(rowFor)}
        </Card>

        {waiting.length > 0 && (
          <Card padding={0}>
            <CardHead icon="clock" title="Waiting to be settled" />
            {waiting.map(rowFor)}
            <div style={{ padding: '10px 13px', borderTop: `1px solid ${P.hairline}`, fontSize: P.type.meta, color: P.inkDim, lineHeight: 1.5 }}>
              These ended but haven&#8217;t been settled, so what you earned is still projected.
            </div>
          </Card>)}

        <S.SourceFreshness sources={data.sources} />
      </div>);
  }

  // ── the manager console ─────────────────────────────────────────────────
  function ConsoleBounties({ navigate, session, me }) {
    const P = useP();
    const S = window.IncShared;
    const storeId = session.storeId;
    const [cls, setCls] = React.useState('all');
    // The AUDIENCE filter is server-side, not a filter over the rows already
    // in hand: a bounty matches when the class is ONE of its audiences, and
    // "one of" is the backend's own rule (serve._get) — reimplementing it here
    // is how two answers to "which bounties can a driver win" come to differ.
    const q = new URLSearchParams();
    if (storeId) q.set('store_id', storeId);
    if (cls !== 'all') q.set('class', cls);
    const path = '/api/incentives/contests' + (q.toString() ? '?' + q.toString() : '');
    const list = window.HWInc.usePoll(path, { intervalMs: 20000 });

    // Everyone FIRST here, unlike the standings board. A bounty list is a
    // manager's inventory of what is running; opening it already filtered
    // would hide bounties they wrote themselves.
    const CLASS_TABS = [{ value: 'all', label: 'Every audience' }]
      .concat((S.CLASS_ORDER || []).map((id) => ({ value: id, label: S.classLabel(id) })));

    const [tab, setTab] = React.useState('all');
    const [confirming, setConfirming] = React.useState(null); // {id, action}
    const [reason, setReason] = React.useState('');
    const [busyId, setBusyId] = React.useState(null);

    const header = (
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: P.type.h1, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>Bounties</h1>
          <p style={{ margin: '6px 0 0', maxWidth: 660, fontSize: P.type.strong, color: P.inkMute, lineHeight: 1.5 }}>
            Every state is a real row. A bounty whose store has no data source is created but flagged — it will never score.
          </p>
        </div>
        <PBtn size="sm" variant="accent" icon="lightning" onClick={() => navigate('#/contests/new')}>New bounty</PBtn>
      </header>);

    if (list.error && !list.data) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {header}
          <S.NotConnected onRetry={list.refresh} />
        </div>);
    }
    if (list.loading && !list.data) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {header}
          <Tabs value="all" onChange={() => {}} options={STATUS_TABS} />
          <SkeletonRows rows={5} avatar={false} />
        </div>);
    }

    const contests = Array.isArray(list.data && list.data.contests) ? list.data.contests : [];
    const counts = {};
    contests.forEach((c) => { counts[c.status] = (counts[c.status] || 0) + 1; });
    const tabs = STATUS_TABS.map((t) => ({ ...t, count: t.value === 'all' ? contests.length : (counts[t.value] || 0) }));
    const rows = tab === 'all' ? contests : contests.filter((c) => c.status === tab);
    const pending = contests.filter((c) => c.status === 'pending_approval' && c.funded_by === 'brand');

    async function act(id, action, verb) {
      setBusyId(id);
      const body = { actor: session.id };
      if (reason.trim()) body.reason = reason.trim();
      const r = await window.HWInc.post('/api/incentives/contests/' + encodeURIComponent(id) + '/' + action, body);
      setBusyId(null);
      if (r.ok) {
        setConfirming(null); setReason('');
        toast({ title: verb, description: 'Recorded against your name in the bounty’s audit.', tone: 'ok' });
        list.refresh(); me.refresh();
      } else {
        const msg = (r.body && r.body.error) || r.error || ('HTTP ' + r.code);
        toast({ title: 'That didn’t go through', description: msg, tone: 'blocked' });
      }
    }

    const columns = [
      { key: 'name', label: 'Bounty', render: (c) => (
        <div style={{ minWidth: 200 }}>
          <div style={{ fontWeight: 700, color: P.ink }}>{c.name}</div>
          <div style={{ marginTop: 2, fontSize: P.type.meta, fontFamily: P.fontMono, color: P.inkDim }}>
            {[METRIC_LABEL[c.metric] || c.metric,
              c.brand ? 'brand ' + c.brand : null,
              c.participants_count != null ? c.participants_count + ' people' : null,
              !c.store_ids || c.store_ids.length === 0 ? 'every store' : c.store_ids.length + (c.store_ids.length === 1 ? ' store' : ' stores'),
              c.recurrence && c.recurrence !== 'none' ? 'resets ' + c.recurrence : null].filter(Boolean).join(' · ')}
          </div>
        </div>) },
      { key: 'kind', label: 'Kind', render: (c) => <Pill kind="neutral" size="sm">{KIND_LABEL[c.kind] || c.kind}</Pill> },
      // WHO CAN WIN IT. Reading a bounty list without this, a manager cannot
      // tell the floor spiff from the driver spiff — they are the same row
      // apart from one field, and only one of them pays the fleet.
      { key: 'audience', label: 'Audience', render: (c) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(c.audience && c.audience.length ? c.audience : ['budtender']).map((a) => (
            <S.ClassPill key={a} cls={a} />))}
        </div>) },
      { key: 'window', label: 'Window', render: (c) => (
        <div>
          <div style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', fontSize: P.type.body, color: P.ink2 }}>
            {windowLabel(c.window_start, c.window_end)}
          </div>
          {c.status === 'active' && endsInLabel(c.ends_in_s) && (
            <div style={{ marginTop: 2, fontSize: P.type.meta, fontFamily: P.fontMono, color: P.inkDim }}>{endsInLabel(c.ends_in_s)}</div>)}
        </div>) },
      { key: 'funding', label: 'Funding', render: (c) => <FundingChip fundedBy={c.funded_by} brand={c.brand} /> },
      { key: 'leader', label: 'Leader', render: (c) => (c.leader ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 150 }}>
          <Avatar name={c.leader.name} size={24} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: P.type.body, fontWeight: 600, color: P.ink }}>{c.leader.name}</span>
            <span style={{ display: 'block', fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', fontSize: P.type.meta, color: P.inkDim }}>
              {valueLabel(c.leader.value, c.leader.value_kind)}{c.leader.tied ? ' · tied' : ''}
            </span>
          </span>
        </div>) : <span style={{ color: P.inkMute, fontFamily: P.fontMono, fontSize: P.type.meta }}>no leader yet</span>) },
      { key: 'reward', label: 'Reward', align: 'right', render: (c) => (
        <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', fontSize: P.type.body, color: P.ink2 }}>
          {c.reward_summary || '—'}
        </span>) },
      { key: 'status', label: 'Status', render: (c) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <S.StatusPill status={c.status} />
          {c.has_source === false && <Pill kind="bad" size="sm" icon="plug">no data source</Pill>}
        </div>) },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {header}

        <Seg value={cls} onChange={setCls} size="sm" options={CLASS_TABS} />

        {pending.length > 0 && (
          <Card padding={0}>
            <CardHead icon="check-circle" tone="warn"
              title={pending.length === 1 ? '1 brand-funded bounty is waiting for your approval'
                : pending.length + ' brand-funded bounties are waiting for your approval'}
              right={<Pill kind="warn" size="sm" dot>{pending.length}</Pill>} />
            {pending.map((c) => {
              const open = confirming && confirming.id === c.id;
              return (
                <div key={c.id} style={{ padding: '12px 16px', borderTop: `1px solid ${P.hairline}`,
                  display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ flex: 1, minWidth: 180 }}>
                      <span data-hw-i role="button" tabIndex={0}
                        onClick={() => navigate('#/contests/' + c.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('#/contests/' + c.id); } }}
                        style={{ display: 'block', fontSize: P.type.strong, fontWeight: 700, color: P.ink, cursor: 'pointer' }}>{c.name}</span>
                      <span style={{ display: 'block', marginTop: 2, fontFamily: P.fontMono, fontSize: P.type.meta, color: P.inkDim }}>
                        {[c.brand ? c.brand : 'brand-funded', c.reward_summary, windowLabel(c.window_start, c.window_end)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {!open && (
                      <span style={{ display: 'flex', gap: 8 }}>
                        <PBtn size="sm" variant="accent" icon="check-circle"
                          onClick={() => { setReason(''); setConfirming({ id: c.id, action: 'approve' }); }}>Approve</PBtn>
                        <PBtn size="sm" variant="secondary"
                          onClick={() => { setReason(''); setConfirming({ id: c.id, action: 'cancel' }); }}>Decline</PBtn>
                      </span>)}
                  </div>
                  {open && confirming.action === 'approve' && (
                    <ConfirmRow tone="warn" title={'Approve ' + c.name + ' and let it start scoring?'}
                      body="Nothing is scored and nobody accrues anything until you approve it. Approving records your name against it permanently."
                      confirmLabel="Approve and start" busy={busyId === c.id}
                      onConfirm={() => act(c.id, 'approve', 'Approved')} onCancel={() => setConfirming(null)} />)}
                  {open && confirming.action === 'cancel' && (
                    <ConfirmRow tone="bad" title={'Decline ' + c.name + '?'}
                      body="Declining cancels the bounty. It stays in the list as cancelled, with your name and reason in the audit, and it can never score."
                      confirmLabel="Decline it" confirmVariant="danger" busy={busyId === c.id}
                      reason={reason} onReasonChange={setReason} reasonPlaceholder="Why you’re declining it (optional)"
                      onConfirm={() => act(c.id, 'cancel', 'Declined')} onCancel={() => setConfirming(null)} />)}
                </div>);
            })}
          </Card>)}

        <Tabs value={tab} onChange={setTab} options={tabs} />

        {rows.length === 0 ? (
          <EmptyState icon="award"
            title={tab === 'all' ? 'No bounties at this store yet' : EMPTY_TITLE[tab]}
            body={tab === 'all'
              ? 'Build one and it lands here as a draft — nothing scores until it is active.'
              : 'Bounties move through draft, approval, active, ended and settled. This tab fills as they get there.'}
            action={tab === 'all' ? <PBtn size="sm" variant="accent" icon="lightning" onClick={() => navigate('#/contests/new')}>New bounty</PBtn> : null} />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(c) => c.id} onRowClick={(c) => navigate('#/contests/' + c.id)} />)}

        <S.SourceFreshness sources={me.data && me.data.sources} />
      </div>);
  }

  // ── route entry ─────────────────────────────────────────────────────────
  window.IncScreenContests = function IncScreenContests(props) {
    const seat = !props.isManager || props.seat === 'seat';
    return (
      <div style={{ width: '100%' }}>
        {seat ? <SeatBounties navigate={props.navigate} me={props.me} />
          : <ConsoleBounties navigate={props.navigate} session={props.session} me={props.me} />}
      </div>);
  };
})();
