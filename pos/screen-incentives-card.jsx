// ── pos/screen-incentives-card.jsx ── window.IncHomeCard — Bounty on POS Home ─
// Design: explorations/Incentives - Concept D - Two Seats.html tab "9 · POS surfaces". Plan
// §5.5: replaces window.AovDashboardCard in the exact slot pos/screen-home.jsx mounts it in —
// AOV goals are absorbed into Bounty as one bounty kind (plan §0), so the AOV meter line moves
// here rather than disappearing. pos/screen-aov.jsx is UNTOUCHED (owner rule): its file still
// loads and its manager sub-panel is simply no longer mounted from Home (see the one-line
// change in pos/screen-home.jsx).
//
// POS ATOMS ONLY. hd-ui.jsx / hd-format.jsx are not on Hyperwolf POS.html's script list (see
// pos-admin-design-system.md §2 "who uses what") — no hdToast, no StatTile, no window.HD. This
// card is read-only (no writes), so that has no cost: nothing here needs a toast.
// incentives/inc-shared.jsx is likewise not loaded on the POS page, so composites that mirror
// IncShared.ProgressRow are re-declared locally rather than referenced — same shape, no
// cross-app script dependency.
//
// LIVE, NOT FABRICATED — same rule as pos/screen-aov.jsx's own header comment, reused
// verbatim in spirit: every number here is a GET against wmdemo's /api/incentives/me. Where
// that 404s (routes not built yet) or window.HW_LIVE itself is absent, this card says so in
// the AOV card's own ErrorState shape and copy style — it never falls back to a placeholder
// rank or balance.
;(function () {
  const useP = window.useP;

  function _live() { return window.HW_LIVE || null; }
  function _money0(cents) { return window.HW.fmt.money0((cents || 0) / 100); }

  // Same 5 slugs as pos/screen-aov.jsx's AOV_STORE_NAMES — its own copy, not an import (no
  // module system here; see the estate's global-collision rule). Display-only.
  const STORE_NAMES = { elsinore: 'Lake Elsinore', 'west-la': 'West Hollywood', 'long-beach': 'Long Beach', corona: 'Corona', riverside: 'Riverside' };
  const storeName = (id) => STORE_NAMES[id] || id;

  function useIncentivesMe(storeId, associateId) {
    const [state, setState] = React.useState({ loading: true, error: null, data: null });
    const load = React.useCallback(() => {
      const live = _live();
      if (!live || !storeId || !associateId) { setState({ loading: false, error: 'no-live-seam', data: null }); return; }
      setState((s) => ({ ...s, loading: true }));
      live.get(`/api/incentives/me?store_id=${encodeURIComponent(storeId)}&associate_id=${encodeURIComponent(associateId)}`)
        .then((res) => {
          if (res.ok && res.body) setState({ loading: false, error: null, data: res.body });
          else setState({ loading: false, error: res.error || 'unreachable', data: null });
        });
    }, [storeId, associateId]);
    React.useEffect(() => { load(); }, [load]);
    return { ...state, refresh: load };
  }

  // Goes to the Bounty app itself — window.HW_NAV.items already carries a 'bounty' entry
  // ({ href: 'Hyperwolf Bounty.html' }, shared/app-nav.js) so this is the same navigation path
  // every other cross-app link in this estate uses, not a hand-typed href.
  function openBounty(hash) {
    const NAV = window.HW_NAV;
    const item = NAV && Array.isArray(NAV.items) && NAV.items.find((i) => i.id === 'bounty');
    if (!item) return; // guarded below at render time too — this is the click-time fallback
    if (hash) { location.href = item.href + hash; return; } // HW_NAV.go only ever sets the bare href; a specific route needs the hash appended directly
    NAV.go(item);
  }

  const RankChip = ({ icon, rank, label }) => {
    const P = useP();
    return (
      <div style={{ flex: 1, minWidth: 130, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, flex: '0 0 auto', background: P.surface3, color: P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={13} stroke={1.8} />
        </span>
        {rank
          ? <span style={{ fontFamily: P.fontMono, fontSize: 17, fontWeight: 800, color: P.ink }}>{rank.rank}<span style={{ fontSize: 10.5, fontWeight: 600, color: P.inkMute }}>{` of ${rank.of}`}</span></span>
          : <span style={{ fontFamily: P.fontMono, fontSize: 14, fontWeight: 700, color: P.inkFaint }}>—</span>}
        <span style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>{label}</div>
          <div style={{ fontSize: 10.5, color: P.inkDim, marginTop: 1 }}>{rank ? (rank.tied ? 'tied · today' : 'today') : 'no sales yet today'}</div>
        </span>
      </div>);
  };

  // Same shape as incentives/inc-shared.jsx's IncShared.ProgressRow (title/value line, a
  // BarMeter, a mono sub) — duplicated locally rather than imported, since that file is not on
  // this page's script list.
  const BountyRow = ({ title, valueLabel, pct, color, sub }) => {
    const P = useP();
    return (
      <div style={{ padding: '10px 13px', borderTop: `1px solid ${P.hairline}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
          <span style={{ fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 600, color: P.ink2 }}>{valueLabel}</span>
        </div>
        <BarMeter value={pct == null ? 0 : pct} max={1} color={color || P.info} height={7} />
        {sub && <div style={{ marginTop: 5, fontSize: 10.5, color: P.inkDim, fontFamily: P.fontMono }}>{sub}</div>}
      </div>);
  };

  window.IncHomeCard = function IncHomeCard() {
    const P = useP();
    const a = window.HW.STATS.associate;
    const storeId = a.storeId, associateId = a.id;
    const isManager = a.role === 'Floor Manager'; // same exact check pos/screen-aov.jsx uses

    const me = useIncentivesMe(storeId, associateId);

    if (me.loading) {
      // Same header the loaded card will show — pos/screen-aov.jsx's own loading-branch rule.
      return <Card padding={0}>
        <div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 9 }}>
          <Icon name="trophy" size={15} color={P.ink2} />
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>Bounty</span>
        </div>
        <div style={{ padding: 16 }}><SkeletonRows rows={2} avatar={false} /></div>
      </Card>;
    }
    if (me.error || !me.data) {
      // HONEST DEGRADE — the AOV card's exact pattern and copy shape, renamed for Bounty.
      return (
        <Card padding={0}>
          <ErrorState compact title="Bounty isn't connected"
            body={`Needs the wmdemo backend — not reachable right now${me.error && me.error !== 'no-live-seam' ? ` (${me.error})` : ''}. Your rank, bounties and balance will appear here once it connects.`}
            onRetry={me.refresh} />
        </Card>);
    }

    const d = me.data;
    const g = d.aov_goal, t = d.today, earn = d.earnings || {};
    const goalPct = g && g.goal_cents ? Math.min(1, (t.aov_cents || 0) / g.goal_cents) : 0;
    const goalMet = !!(g && g.met);
    const activeBounties = (d.bounties || []).filter((b) => b.status === 'active').slice(0, 3);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card padding={0}>
          <div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 26, height: 26, borderRadius: P.r8, background: P.accentSoft, color: P.accentText, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
              <Icon name="trophy" size={14} stroke={1.9} />
            </span>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>Bounty</span>
            <Pill kind="neutral" size="sm">{storeName(storeId)}</Pill>
            <button onClick={() => openBounty()} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: P.info, fontFamily: P.fontSans, padding: 0 }}>
              Open Bounty<Icon name="chevron-right" size={13} stroke={2.2} />
            </button>
          </div>

          {window.DevNote && (
            <div style={{ padding: '0 16px' }}>
              <window.DevNote id="pos-card-live-seam" title="This card reads /api/incentives/me">
                <window.DevNoteP>
                  Developer marker. Every number below is one GET against wmdemo's
                  {' '}<window.DevNoteMono>/api/incentives/me</window.DevNoteMono> — and that endpoint is fed by
                  the register's own tender posts (<window.DevNoteMono>POST /api/pos/sale</window.DevNoteMono>{' '}
                  from pos/payment.jsx's <window.DevNoteMono>finalize()</window.DevNoteMono>), not a fixture.
                </window.DevNoteP>
              </window.DevNote>
            </div>
          )}

          {/* hero — the AOV goal meter, absorbed, in the exact wording AovDashboardCard uses */}
          <div style={{ padding: '14px 16px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 700, color: P.ink, flex: 1 }}>
                {goalMet && <Icon name="check-circle" size={16} color={P.good} />}
                {g ? (goalMet ? 'AOV goal met' : `Add ${_money0(g.gap_cents)} to hit today's goal`) : 'No AOV goal set'}
              </span>
              {g && <span style={{ fontSize: 13, fontWeight: 700, color: P.ink2, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>
                {_money0(t.aov_cents)} <span style={{ color: P.inkMute, fontWeight: 500 }}>/</span> {_money0(g.goal_cents)}
              </span>}
            </div>
            <BarMeter value={goalPct} max={1} color={goalMet ? P.good : P.info} height={8} />
          </div>

          {/* rank chips */}
          <div style={{ display: 'flex', gap: 10, padding: '0 16px 14px', flexWrap: 'wrap' }}>
            <RankChip icon="home" rank={t.rank_store} label="Rank · this store" />
            <RankChip icon="globe" rank={t.rank_all} label="Rank · all stores" />
          </div>

          {/* up to three active bounties */}
          {activeBounties.length > 0 && (
            <div style={{ margin: '0 16px 14px', border: `1px solid ${P.hairline2}`, borderRadius: P.r10, overflow: 'hidden' }}>
              <div style={{ padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 8, background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}>
                <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: P.ink }}>Your bounties</span>
                <Pill kind="good" size="sm" dot>{activeBounties.length} running</Pill>
              </div>
              {activeBounties.map((b) => (
                <BountyRow key={b.id} title={b.name}
                  valueLabel={b.my && b.my.rank != null ? `#${b.my.rank}${b.my.tied ? ' tied' : ''}` : (b.my ? '—' : '—')}
                  pct={b.my ? b.my.progress : 0} color={b.brand ? P.accent : P.info} sub={b.reward_summary} />
              ))}
            </div>)}

          {/* balance — projected and settled shown apart, never summed */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 16px', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>Settled</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: P.ink, fontFamily: P.fontMono }}>{_money0(earn.settled_cents)}</div>
              </div>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>Projected</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: P.ink2, fontFamily: P.fontMono }}>{_money0(earn.projected_cents)}</div>
              </div>
            </div>
            <PBtn variant="secondary" size="sm" iconRight="chevron-right" onClick={() => openBounty()}>Open Bounty</PBtn>
          </div>
        </Card>

        {/* manager sub-card — replaces the old embedded manager panel with two links out to
            the console, per plan §5.5: settings now live in the console, not on Home. */}
        {isManager &&
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>Manager tools</Eyebrow>
          <Card padding={0} elevation="sunken">
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 9 }}>
              <Icon name="shield" size={15} color={P.ink2} />
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: P.ink }}>Manage · Bounty</span>
              <Pill kind="neutral" size="sm">Floor Manager only</Pill>
            </div>
            <div style={{ padding: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <PBtn variant="secondary" size="sm" icon="target" onClick={() => openBounty('#/goals')}>Manage goals</PBtn>
              <PBtn variant="secondary" size="sm" icon="trophy" onClick={() => openBounty('#/contests')}>Bounties</PBtn>
            </div>
          </Card>
        </div>}
      </div>);
  };
})();
