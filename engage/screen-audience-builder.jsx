// ── /audiences/new — AI audience builder ──────────────────────────────────
// Port of audiences/new/audience-builder.tsx + trait-catalog-drawer,
// boolean-chips, why-this-size. Three columns: catalog | builder | preview.
;(function () {
  const useP = window.useP;

  const EXAMPLES = [
    'Big spenders lapsed 30+ days and churn risk over 0.6',
    "Flower-first shoppers who haven't bought edibles in 90 days",
    'Price-sensitive regulars with a win-back probability over 0.5',
    'At-risk VIPs — lifetime spend over $1k, RFM at_risk or hibernating',
  ];

  const CATALOG = [
    { group: 'Identity', traits: [
      { path: 'customer.age_verified', numeric: false, kind: 'boolean' },
      { path: 'customer.primary_store', numeric: false, kind: 'enum' },
      { path: 'customer.created_at', numeric: false, kind: 'date' },
    ] },
    { group: 'Commerce', traits: [
      { path: 'customer.lifetime_spend_cents', numeric: true, kind: 'currency' },
      { path: 'customer.lifetime_orders', numeric: true, kind: 'number' },
      { path: 'customer.avg_basket_cents', numeric: true, kind: 'currency' },
      { path: 'customer.last_order_at', numeric: false, kind: 'date' },
      { path: 'customer.recency_days', numeric: true, kind: 'number' },
    ] },
    { group: 'Loyalty', traits: [
      { path: 'loyalty.tier', numeric: false, kind: 'enum' },
      { path: 'loyalty.points_balance', numeric: true, kind: 'number' },
      { path: 'loyalty.lifetime_earned', numeric: true, kind: 'number' },
    ] },
    { group: 'Predictive', traits: [
      { path: 'predictive.churn_30d', numeric: true, kind: 'score' },
      { path: 'predictive.win_back_probability', numeric: true, kind: 'score' },
      { path: 'predictive.ltv_90d_cents', numeric: true, kind: 'currency' },
      { path: 'customer.rfm_segment', numeric: false, kind: 'enum' },
    ] },
    { group: 'Affinity', traits: [
      { path: 'customer.affinity.flower', numeric: true, kind: 'score' },
      { path: 'customer.affinity.vape', numeric: true, kind: 'score' },
      { path: 'customer.affinity.edibles', numeric: true, kind: 'score' },
      { path: 'customer.affinity.concentrates', numeric: true, kind: 'score' },
    ] },
    { group: 'Messaging', traits: [
      { path: 'consent.sms', numeric: false, kind: 'enum' },
      { path: 'consent.email', numeric: false, kind: 'enum' },
      { path: 'messaging.last_click_at', numeric: false, kind: 'date' },
      { path: 'wallet.pass_active', numeric: false, kind: 'boolean' },
    ] },
  ];
  const ALL_PATHS = CATALOG.flatMap((g) => g.traits.map((t) => t.path));

  // Fake prompt→DSL translation. Keyword matching stands in for the LLM call;
  // the shape (leaves, $or groups, unknown paths, rationale, confidence) is
  // exactly what generateAudienceFromPromptAction returns.
  function translate(prompt) {
    const p = prompt.toLowerCase();
    const leaves = [];
    const push = (path, op, value) => leaves.push({ path, op, value });
    if (/big spender|high.?value|vip|\$1k|1,?000|spend/.test(p)) push('customer.lifetime_spend_cents', '$gte', 100000);
    if (/lapsed|haven'?t (bought|ordered)|no order|inactive/.test(p)) push('customer.recency_days', '$gte', /90/.test(p) ? 90 : /60/.test(p) ? 60 : 30);
    if (/churn/.test(p)) push('predictive.churn_30d', '$gte', /0\.\d/.exec(p) ? Number(/0\.\d+/.exec(p)[0]) : 0.6);
    if (/win.?back/.test(p)) push('predictive.win_back_probability', '$gte', /0\.\d+/.exec(p) ? Number(/0\.\d+/.exec(p)[0]) : 0.5);
    if (/flower/.test(p)) push('customer.affinity.flower', '$gte', 0.6);
    if (/vape/.test(p)) push('customer.affinity.vape', '$gte', 0.5);
    if (/edible/.test(p)) push('customer.affinity.edibles', /haven'?t|without|no /.test(p) ? '$lte' : '$gte', /haven'?t|without|no /.test(p) ? 0.1 : 0.5);
    if (/concentrat/.test(p)) push('customer.affinity.concentrates', '$gte', 0.5);
    if (/diamond|bloom|tier/.test(p)) push('loyalty.tier', '$in', ['Bloom', 'Diamond']);
    if (/at.?risk|hibernat/.test(p)) push('customer.rfm_segment', '$in', ['at_risk', 'hibernating']);
    if (/champion/.test(p)) push('customer.rfm_segment', '$in', ['champions']);
    if (/price.?sensitiv|discount|promo/.test(p)) push('customer.avg_basket_cents', '$lte', 6500);
    if (/regular|frequent|loyal/.test(p)) push('customer.lifetime_orders', '$gte', 8);
    if (/wallet/.test(p)) push('wallet.pass_active', '$eq', true);
    if (/consent|opted/.test(p)) push('consent.sms', '$eq', 'granted');
    if (leaves.length === 0) push('customer.lifetime_orders', '$gte', 1);
    const unknown = /gender|zodiac|instagram|pet/.test(p) ? ['customer.zodiac_sign'] : [];
    return {
      leaves, unknownPaths: unknown,
      rationale: `Resolved ${leaves.length} trait path${leaves.length === 1 ? '' : 's'} from the catalog. Numeric thresholds came from the prompt where stated, otherwise from tenant p75 defaults. Anything unresolvable fails closed rather than matching everyone.`,
      confidence: Math.min(0.97, 0.62 + leaves.length * 0.07),
    };
  }

  const OP_LABEL = { $gte: '≥', $gt: '>', $lte: '≤', $lt: '<', $eq: '=', $ne: '≠', $in: 'in', $nin: 'not in', $within_days: 'within' };
  function displayValue(path, value) {
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') {
      if (path.endsWith('_cents')) return `$${(value / 100).toLocaleString()}`;
      if (path.includes('affinity') || path.includes('probability') || path.includes('churn')) return value.toFixed(2);
      return value.toLocaleString();
    }
    return String(value);
  }

  // Size model: each leaf cuts the base population by a factor.
  function estimateSize(leaves) {
    let size = window.ENGAGE_DATA.TENANT.customers;
    for (const l of leaves) {
      const f = l.op === '$in' ? (Array.isArray(l.value) ? 0.12 + l.value.length * 0.06 : 0.2)
        : l.op === '$eq' ? 0.42
        : typeof l.value === 'number' && l.value <= 1 ? Math.max(0.08, 1 - l.value) * 0.55
        : 0.34;
      size = Math.round(size * f);
    }
    return Math.max(0, size);
  }

  function TraitCatalog({ onAdd }) {
    const P = useP();
    const [q, setQ] = React.useState('');
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    return (
      <Card padding={0} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 620 }}>
        <div style={{ padding: 12, borderBottom: `1px solid ${P.hairline2}` }}>
          <MicroLabel style={{ marginBottom: 6 }}>Trait catalog</MicroLabel>
          <Field icon="search" size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter traits…" />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {CATALOG.map((g) => {
            const traits = g.traits.filter((t) => t.path.toLowerCase().includes(q.trim().toLowerCase()));
            if (!traits.length) return null;
            return (
              <div key={g.group} style={{ marginBottom: 10 }}>
                <div style={{ padding: '4px 8px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>{g.group}</div>
                {traits.map((t) => (
                  <button key={t.path} onClick={() => onAdd(t)}
                    style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = P.surface3)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <Icon name="plus" size={11} stroke={2.4} color={accentInk} />
                    <span style={{ flex: 1, fontFamily: P.fontMono, fontSize: 11, color: P.ink2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.path.replace(/^customer\./, '')}</span>
                    <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkFaint }}>{t.kind}</span>
                  </button>))}
              </div>);
          })}
        </div>
        <div style={{ padding: 10, borderTop: `1px solid ${P.hairline2}`, fontSize: 10, color: P.inkMute }}>{ALL_PATHS.length} traits in this tenant's catalog</div>
      </Card>);
  }

  function WhyThisSize({ history, currentSize }) {
    const P = useP(), HD = window.HD;
    const [open, setOpen] = React.useState(false);
    if (history.length === 0) return null;
    const last = history[history.length - 1];
    return (
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <button onClick={() => setOpen((o) => !o)} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: P.fontSans }}>
          <Icon name="help" size={14} stroke={2} color={P.inkMute} />
          <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 600, color: P.ink }}>Why this size?</span>
          <span style={{ fontSize: 11, fontFamily: P.fontMono, color: P.inkMute }}>{HD.formatPercent(last.confidence, 0)} conf</span>
          <Icon name="chevron-down" size={13} stroke={2} color={P.inkMute} style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
        </button>
        {open && (
          <div style={{ padding: '0 16px 16px', fontSize: 12, color: P.inkDim }}>
            <p style={{ margin: 0, lineHeight: 1.5 }}>{last.rationale}</p>
            <MicroLabel style={{ marginTop: 12 }}>Resolved paths</MicroLabel>
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {last.paths.map((p) => <span key={p} style={{ fontFamily: P.fontMono, fontSize: 10, background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: 4, padding: '2px 5px', color: P.ink2 }}>{p}</span>)}
            </div>
            <MicroLabel style={{ marginTop: 12 }}>Turns</MicroLabel>
            <ol style={{ margin: '6px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {history.map((h, i) => (
                <li key={i} style={{ fontSize: 11 }}>
                  <span style={{ textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>{h.kind}</span> · “{h.prompt}” → <span style={{ fontFamily: P.fontMono, color: P.ink }}>{HD.formatNumber(h.size)}</span>
                </li>))}
            </ol>
            <p style={{ margin: '12px 0 0', fontSize: 11, color: P.inkMute }}>Current live count: <span style={{ fontFamily: P.fontMono, color: P.ink }}>{HD.formatNumber(currentSize)}</span></p>
          </div>)}
      </Card>);
  }

  window.ScreenAudienceBuilder = function ScreenAudienceBuilder({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const [name, setName] = React.useState('');
    const [prompt, setPrompt] = React.useState('');
    const [leaves, setLeaves] = React.useState([]);
    const [orGroup, setOrGroup] = React.useState(false);
    const [history, setHistory] = React.useState([]);
    const [generating, setGenerating] = React.useState(false);
    const [loadingPreview, setLoadingPreview] = React.useState(false);
    const [size, setSize] = React.useState(D.TENANT.customers);
    const [priorSize, setPriorSize] = React.useState(null);
    const [unknownPaths, setUnknownPaths] = React.useState([]);
    const wide = window.matchMedia('(min-width:1320px)');
    const [isWide, setIsWide] = React.useState(wide.matches);
    const [catalogOpen, setCatalogOpen] = React.useState(wide.matches);
    React.useEffect(() => {
      const onChange = (e) => { setIsWide(e.matches); setCatalogOpen(e.matches); };
      wide.addEventListener('change', onChange);
      return () => wide.removeEventListener('change', onChange);
    }, []);
    const [showAllSample, setShowAllSample] = React.useState(false);
    const [error, setError] = React.useState(null);
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    const hasFilters = leaves.length > 0;
    const hasGenerated = history.length > 0;

    // Debounced live preview.
    React.useEffect(() => {
      setLoadingPreview(true);
      const t = setTimeout(() => {
        setPriorSize(size);
        setSize(estimateSize(leaves));
        setLoadingPreview(false);
      }, 320);
      return () => clearTimeout(t);
    }, [leaves]);

    const sample = React.useMemo(() => D.CUSTOMERS.slice(0, Math.min(50, Math.max(0, size))).slice(0, 50), [size]);
    const visibleSample = showAllSample ? sample.slice(0, 50) : sample.slice(0, 10);
    const delta = priorSize == null ? 0 : size - priorSize;

    function generateOrRefine() {
      if (!prompt.trim()) return;
      setError(null);
      setGenerating(true);
      const isRefine = hasGenerated && hasFilters;
      setTimeout(() => {
        const out = translate(prompt);
        const next = isRefine ? [...leaves, ...out.leaves.filter((l) => !leaves.some((x) => x.path === l.path))] : out.leaves;
        setLeaves(next);
        setUnknownPaths(out.unknownPaths);
        const s = estimateSize(next);
        setHistory((h) => [...h, { kind: isRefine ? 'refine' : 'generate', prompt: prompt.trim(), size: s, rationale: out.rationale, confidence: out.confidence, paths: next.map((l) => l.path), at: new Date().toISOString() }]);
        if (!name.trim()) setName(prompt.trim().replace(/^\w/, (c) => c.toUpperCase()).slice(0, 48));
        setPrompt('');
        setGenerating(false);
      }, 620);
    }

    function addFromCatalog(t) {
      if (leaves.some((l) => l.path === t.path)) return;
      setLeaves((cur) => [...cur, { path: t.path, op: t.numeric ? '$gt' : '$eq', value: t.numeric ? 0 : '' }]);
    }

    function save(asDraft) {
      if (!name.trim()) { setError('Give the audience a name before saving.'); return; }
      window.hdToast?.({ title: asDraft ? 'Draft saved' : 'Audience saved', description: `${name} · ${HD.formatNumber(size)} members${asDraft ? ' · excluded from flows until finalised' : ''}.`, tone: 'ok' });
      navigate('#/audiences');
    }

    return (
      <div style={{ padding: 24 }}>
        <div className={catalogOpen ? 'hd-builder' : 'hd-builder-nocat'}>
          {catalogOpen && <TraitCatalog onAdd={addFromCatalog} />}

          <section style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>
                  <Icon name="sparkle" size={11} stroke={2} color={accentInk} />AI audience builder
                </div>
                <h1 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 600, letterSpacing: '-.02em', color: P.ink }}>Who should we reach?</h1>
                <p style={{ margin: '6px 0 0', maxWidth: 520, fontSize: 13, color: P.inkMute, lineHeight: 1.5 }}>
                  Describe the segment in plain English, or click traits in the catalog. We translate to a safe filter, validate every path, and show you the live count.
                </p>
              </div>
              {isWide && <IconBtn icon={catalogOpen ? 'chevron-left' : 'chevron-right'} size={15} title={catalogOpen ? 'Hide trait catalog' : 'Show trait catalog'} onClick={() => setCatalogOpen((x) => !x)} style={{ width: 30, height: 30 }} />}
            </div>

            {error && (
              <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, borderRadius: 10, border: `1px solid ${HD.tone(P, 'blocked').fg}66`, background: HD.tone(P, 'blocked').bg, padding: 12, fontSize: 13, color: HD.tone(P, 'blocked').fg }}>
                <Icon name="alert" size={15} stroke={2} /><p style={{ margin: 0 }}>{error}</p>
              </div>)}

            <div>
              <MicroLabel style={{ marginBottom: 6 }}>Name</MicroLabel>
              <Field value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Big spenders · 30-day winback" />
            </div>

            <div style={{ borderRadius: P.r14, border: `1px solid ${P.hairline2}`, background: P.surface, overflow: 'hidden', boxShadow: P.shadowSm }}>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); generateOrRefine(); } }}
                placeholder={hasGenerated && hasFilters ? 'Refine: e.g. “narrow to flower-leaning customers only”' : 'e.g. Big spenders lapsed 30+ days with high churn risk and a win-back probability over 0.5'}
                style={{ display: 'block', width: '100%', border: 'none', outline: 'none', resize: 'vertical', padding: 14, fontSize: 15, lineHeight: 1.5, color: P.ink, background: 'transparent', fontFamily: P.fontSans }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: `1px solid ${P.hairline2}`, background: P.surface2, padding: '8px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: P.inkMute }}>
                  <Icon name="sparkle" size={11} stroke={2} />
                  {hasGenerated && hasFilters ? `Refining turn #${history.length} · prior DSL preserved` : 'Claude Sonnet 4.6 · never sees customer PII, only trait paths'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <kbd style={{ fontSize: 10, fontFamily: P.fontMono, color: P.inkMute, background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: 4, padding: '1px 5px' }}>⌘↵</kbd>
                  <PBtn size="sm" variant="accent" icon={generating ? 'refresh' : 'sparkle'} disabled={generating || !prompt.trim()} onClick={generateOrRefine}>
                    {generating ? 'Working…' : hasGenerated && hasFilters ? 'Refine' : 'Generate'}
                  </PBtn>
                </div>
              </div>
            </div>

            {!hasGenerated && (
              <div>
                <MicroLabel style={{ marginBottom: 8 }}>Try one of these</MicroLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {EXAMPLES.map((ex) => (
                    <button key={ex} onClick={() => setPrompt(ex)}
                      style={{ borderRadius: 99, border: `1px solid ${P.hairline2}`, background: P.surface, padding: '5px 12px', fontSize: 12, color: P.inkDim, cursor: 'pointer', fontFamily: P.fontSans }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = P.accentBorder; e.currentTarget.style.color = P.ink; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = P.hairline2; e.currentTarget.style.color = P.inkDim; }}>{ex}</button>))}
                </div>
              </div>)}

            <div style={{ height: 1, background: P.hairline2 }} />

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.ink }}>Filters</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {hasFilters && (
                    <button onClick={() => setOrGroup((o) => !o)} style={{ fontSize: 11, background: 'none', border: 'none', padding: 0, color: accentInk, cursor: 'pointer', fontFamily: P.fontSans, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                      {orGroup ? 'match ALL (AND)' : 'match ANY (OR)'}
                    </button>)}
                  <span style={{ fontSize: 11, color: P.inkMute }}>{leaves.length === 0 ? 'No filters yet — generate, refine, or click a trait' : `${leaves.length} filter${leaves.length === 1 ? '' : 's'}`}</span>
                </div>
              </div>
              {leaves.length === 0
                ? <div style={{ marginTop: 12, borderRadius: P.r12, border: `1px dashed ${P.hairline2}`, background: P.surface2, padding: '24px 16px', textAlign: 'center', fontSize: 13, color: P.inkMute, lineHeight: 1.5 }}>
                  Your filter chips will appear here. AND-grouped chips render flat; OR-grouped chips render in a wrapped panel. An empty filter set previews the full tenant size.
                </div>
                : <div style={{ marginTop: 12, borderRadius: P.r12, border: `1px ${orGroup ? 'dashed' : 'solid'} ${orGroup ? accentInk + '66' : P.hairline2}`, background: orGroup ? P.accentSoft : 'transparent', padding: orGroup ? 12 : 0 }}>
                  {orGroup && <div style={{ marginBottom: 8, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: accentInk }}>match any of</div>}
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {leaves.map((l, i) => (
                      <li key={l.path + i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 99, border: `1px solid ${P.hairline2}`, background: P.surface, padding: '5px 8px 5px 12px', fontSize: 13 }}>
                        <span style={{ fontFamily: P.fontMono, fontSize: 11, color: P.ink }}>{l.path}</span>
                        <span style={{ fontSize: 11, color: P.inkMute }}>{OP_LABEL[l.op] || l.op}</span>
                        <span style={{ color: P.ink2, fontFamily: P.fontMono, fontSize: 11 }}>{displayValue(l.path, l.value) || '—'}</span>
                        <button onClick={() => setLeaves((cur) => cur.filter((_, k) => k !== i))} aria-label={`Remove ${l.path}`}
                          style={{ display: 'flex', height: 18, width: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 99, background: 'transparent', border: 'none', cursor: 'pointer', color: P.inkMute }}>
                          <Icon name="x" size={11} stroke={2.4} />
                        </button>
                      </li>))}
                  </ul>
                </div>}

              {unknownPaths.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 8, borderRadius: 10, border: `1px solid ${HD.tone(P, 'blocked').fg}66`, background: HD.tone(P, 'blocked').bg, padding: 12, fontSize: 13, color: HD.tone(P, 'blocked').fg }}>
                  <Icon name="alert" size={15} stroke={2} />
                  <div>
                    <p style={{ margin: 0, fontWeight: 500 }}>{unknownPaths.length} unknown trait path{unknownPaths.length === 1 ? '' : 's'}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11 }}>{unknownPaths.join(', ')} — these columns don't exist in your tenant's catalog. Refine the prompt or add custom traits first.</p>
                  </div>
                </div>)}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 4 }}>
              <PBtn size="sm" variant="ghost" icon="note" disabled={!hasFilters || !name.trim()} onClick={() => save(true)}>Save draft</PBtn>
              <PBtn variant="accent" disabled={!hasFilters || !name.trim()} onClick={() => save(false)}>Save audience →</PBtn>
            </div>
          </section>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 0 }}>
            <Card padding={20} style={{ background: P.accentSoft, border: `1px solid ${P.accentBorder}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <MicroLabel>Live preview</MicroLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {loadingPreview
                    ? <Icon name="refresh" size={12} stroke={2} color={P.inkMute} />
                    : hasFilters ? <Icon name="check-circle" size={14} stroke={2} color={HD.tone(P, 'ok').fg} /> : null}
                </div>
              </div>
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 600, color: P.ink, fontFamily: P.fontMono, lineHeight: 1, letterSpacing: '-.02em' }}>{HD.formatNumber(size)}</span>
                {delta !== 0 && <span style={{ fontSize: 12, fontWeight: 500, fontFamily: P.fontMono, color: delta > 0 ? HD.tone(P, 'ok').fg : HD.tone(P, 'blocked').fg }}>{delta > 0 ? '+' : ''}{HD.formatNumber(delta)}</span>}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 11, color: P.inkMute }}>matching customers · updates as you edit</p>
            </Card>

            <WhyThisSize history={history} currentSize={size} />

            <Card padding={0} style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${P.hairline2}` }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: P.ink }}>Sample profiles</h3>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: P.inkMute }}>
                    {sample.length === 0 ? 'Add filters to preview matching customers' : `${visibleSample.length} of ${sample.length}${size > 50 ? '+' : ''} matches`}
                  </p>
                </div>
                {sample.length > 10 && <PBtn size="xs" variant="ghost" onClick={() => setShowAllSample((x) => !x)}>{showAllSample ? 'Show less' : `Show all ${sample.length}`}</PBtn>}
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 320, overflowY: 'auto' }}>
                {visibleSample.length === 0
                  ? <li style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: P.inkMute }}>Add filters or generate from a prompt to preview matching customers.</li>
                  : visibleSample.map((c) => (
                    <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: `1px solid ${P.hairline}` }}>
                      <span style={{ height: 28, width: 28, borderRadius: 99, background: P.surface3, color: P.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="user" size={13} stroke={2} /></span>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontFamily: P.fontMono, fontSize: 11, color: P.ink }}>{c.id.slice(0, 8)}…</p>
                        <p style={{ margin: 0, fontSize: 10, color: P.inkMute }}>PII redacted at read · decrypt context required</p>
                      </div>
                    </li>))}
              </ul>
            </Card>

            <Card padding={16} style={{ background: P.accentSoft, border: `1px solid ${P.accentBorder}` }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: accentInk }}>Safety</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: P.ink2, lineHeight: 1.5 }}>Every path is validated against your trait catalog. Unknown traits fail closed — the audience matches nobody rather than silently wrong.</p>
            </Card>
          </aside>
        </div>
      </div>);
  };
})();
