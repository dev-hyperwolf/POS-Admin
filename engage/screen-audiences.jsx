// ── /audiences · /audiences/[id] · /suggested · /compare ──────────────────
;(function () {
  const useP = window.useP;
  const SOURCE_LABEL = { manual: ['Manual', 'neutral'], rule: ['Manual', 'neutral'], ai: ['AI', 'info'], lookalike: ['Lookalike', 'brand'], suggested: ['Suggested', 'info'] };
  const STATUS_TONE = { draft: 'neutral', live: 'ok', active: 'ok', paused: 'warn', archived: 'neutral', suggested: 'info' };

  function SortableHead({ label, k, sort, onSort, align }) {
    const P = useP();
    const active = sort.key === k;
    return (
      <TH align={align}>
        <button onClick={() => onSort(k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, font: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', color: active ? P.ink : 'inherit', cursor: 'pointer' }}>
          {label}<Icon name={active ? (sort.dir === 'asc' ? 'arrow-up' : 'arrow-down') : 'sort'} size={11} stroke={2} style={{ opacity: active ? 1 : .35 }} />
        </button>
      </TH>);
  }

  function ChipGroup({ label, options, active, onToggle }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>{label}</span>
        {options.map((o) => {
          const on = active.has(o.value);
          return (
            <button key={o.value} onClick={() => onToggle(o.value)}
              style={{ height: 24, padding: '0 9px', borderRadius: 99, fontSize: 11.5, cursor: 'pointer', fontFamily: P.fontSans,
                background: on ? P.ink : 'transparent', color: on ? P.surface : P.inkMute, border: `1px solid ${on ? P.ink : P.hairline2}` }}>{o.label}</button>);
        })}
      </div>);
  }

  window.ScreenAudiences = function ScreenAudiences({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const [rows, setRows] = React.useState(D.AUDIENCES);
    const [query, setQuery] = React.useState('');
    const [sourceF, setSourceF] = React.useState(new Set());
    const [statusF, setStatusF] = React.useState(new Set());
    const [sort, setSort] = React.useState({ key: 'lastRefresh', dir: 'desc' });
    const [selected, setSelected] = React.useState(new Set());

    const toggleIn = (setter) => (v) => setter((cur) => { const n = new Set(cur); n.has(v) ? n.delete(v) : n.add(v); return n; });

    const visible = React.useMemo(() => {
      const q = query.trim().toLowerCase();
      let out = rows.filter((r) => (statusF.has('archived') ? true : r.status !== 'archived'));
      if (q) out = out.filter((r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
      if (sourceF.size) out = out.filter((r) => sourceF.has(r.source));
      if (statusF.size) out = out.filter((r) => statusF.has(r.status));
      const dir = sort.dir === 'asc' ? 1 : -1;
      return [...out].sort((a, b) => {
        if (sort.key === 'name') return a.name.localeCompare(b.name) * dir;
        if (sort.key === 'members') return (a.size - b.size) * dir;
        return (new Date(a.lastRefreshedAt) - new Date(b.lastRefreshedAt)) * dir;
      });
    }, [rows, query, sourceF, statusF, sort]);

    const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));
    const allSelected = visible.length > 0 && selected.size === visible.length;

    function refreshOne(id) {
      setRows((cur) => cur.map((r) => (r.id === id ? { ...r, size: r.size + D.range(-40, 90), lastRefreshedAt: new Date(D.NOW).toISOString() } : r)));
      window.hdToast?.({ title: 'Audience refreshed', description: 'Re-evaluated against the trait store.', tone: 'ok' });
    }
    function archive(ids) {
      setRows((cur) => cur.map((r) => (ids.includes(r.id) ? { ...r, status: 'archived' } : r)));
      setSelected(new Set());
      window.hdToast?.({ title: `Archived ${ids.length} audience${ids.length === 1 ? '' : 's'}`, description: 'Hidden from the list and excluded from flows.', tone: 'neutral' });
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-.02em', color: P.ink }}>Audiences</h1>
            <p style={{ margin: '6px 0 0', maxWidth: 660, fontSize: 13.5, color: P.inkMute, lineHeight: 1.5 }}>
              Dynamic segments that refresh against the customer-trait store in real time. Lookalikes expand off a pgvector centroid; AI-generated audiences come from plain-English prompts.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <PBtn size="sm" variant="ghost" icon="sparkle" onClick={() => navigate('#/audiences/suggested')}>Suggested</PBtn>
            <PBtn size="sm" variant="ghost" icon="swap" onClick={() => navigate('#/audiences/compare')}>Compare</PBtn>
            <PBtn size="sm" variant="secondary" disabled>Import from CSV</PBtn>
            <PBtn size="sm" variant="accent" icon="sparkle" onClick={() => navigate('#/audiences/new')}>New audience</PBtn>
          </div>
        </div>

        <Card padding={12}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}><Field icon="search" size="sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or tag…" /></div>
            <ChipGroup label="Source" active={sourceF} onToggle={toggleIn(setSourceF)}
              options={[{ value: 'rule', label: 'Manual' }, { value: 'ai', label: 'AI' }, { value: 'lookalike', label: 'Lookalike' }, { value: 'suggested', label: 'Suggested' }]} />
            <ChipGroup label="Status" active={statusF} onToggle={toggleIn(setStatusF)}
              options={[{ value: 'draft', label: 'draft' }, { value: 'live', label: 'active' }, { value: 'paused', label: 'paused' }, { value: 'archived', label: 'archived' }]} />
          </div>
        </Card>

        {selected.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, border: `1px solid ${P.hairline3}`, background: P.highlightSoft, padding: '8px 12px', fontSize: 13.5 }}>
            <span style={{ fontWeight: 500, color: P.ink }}>{selected.size} selected</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <PBtn size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</PBtn>
              <PBtn size="sm" variant="secondary" icon="box" onClick={() => archive([...selected])}>Archive {selected.size}</PBtn>
            </div>
          </div>)}

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <HDTable>
              <thead><tr>
                <TH width={36}>
                  <button onClick={() => setSelected(allSelected ? new Set() : new Set(visible.map((r) => r.id)))} aria-label={allSelected ? 'Deselect all' : 'Select all'}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}>
                    <Icon name={allSelected ? 'check-circle' : 'box'} size={14} stroke={2} color={allSelected ? P.ink : P.inkMute} />
                  </button>
                </TH>
                <SortableHead label="Name" k="name" sort={sort} onSort={onSort} />
                <TH>Source</TH><TH>Status</TH>
                <SortableHead label="Members" k="members" sort={sort} onSort={onSort} align="right" />
                <TH>Cadence</TH>
                <SortableHead label="Last refresh" k="lastRefresh" sort={sort} onSort={onSort} />
                <TH align="right">Actions</TH>
              </tr></thead>
              <tbody>
                {visible.length === 0
                  ? <tr><TD colSpan={8}><div style={{ padding: '40px 0', textAlign: 'center', color: P.inkMute }}>No audiences match your filters.</div></TD></tr>
                  : visible.map((a) => {
                    const [srcLabel, srcTone] = SOURCE_LABEL[a.source] || [a.source, 'neutral'];
                    const isSel = selected.has(a.id);
                    return (
                      <TR key={a.id} style={{ background: isSel ? P.surface3 : 'transparent' }}>
                        <TD style={{ borderLeft: `3px solid ${isSel ? P.ink : 'transparent'}` }}>
                          <button onClick={() => setSelected((cur) => { const n = new Set(cur); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })} aria-label={`Select ${a.name}`}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}>
                            <Icon name={isSel ? 'check-circle' : 'box'} size={14} stroke={2} color={isSel ? P.ink : P.inkMute} />
                          </button>
                        </TD>
                        <TD>
                          <button onClick={() => navigate(`#/audiences/${a.id}`)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans, fontSize: 13.5, fontWeight: 500, color: P.ink }}>{a.name}</button>
                          <div style={{ fontSize: 11.5, color: P.inkMute, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description}</div>
                        </TD>
                        <TD><HDPill tone={srcTone} icon={false} size="sm" label={srcLabel} /></TD>
                        <TD><HDPill tone={STATUS_TONE[a.status]} icon={false} size="sm" label={a.status === 'live' ? 'active' : a.status} /></TD>
                        <TD align="right" mono style={{ fontWeight: 600 }}>{HD.formatNumber(a.size)}</TD>
                        <TD><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: P.inkDim }}><Icon name="clock" size={11} stroke={2} />{a.refreshCadence}</span></TD>
                        <TD style={{ fontSize: 12.5, color: P.inkDim }}>{HD.relativeTime(a.lastRefreshedAt)}</TD>
                        <TD align="right">
                          <div style={{ display: 'inline-flex', gap: 4 }}>
                            <IconBtn icon="refresh" size={14} title="Refresh now" disabled={a.status === 'archived'} onClick={() => refreshOne(a.id)} style={{ width: 28, height: 28 }} />
                            <IconBtn icon="box" size={14} title="Archive" disabled={a.status === 'archived'} onClick={() => archive([a.id])} style={{ width: 28, height: 28 }} />
                          </div>
                        </TD>
                      </TR>);
                  })}
              </tbody>
            </HDTable>
          </div>
        </Card>
        <p style={{ margin: 0, fontSize: 11.5, color: P.inkMute }}>Showing {visible.length} of {rows.length} audiences{statusF.has('archived') ? '' : ' · archived hidden by default'}</p>
      </div>);
  };

  // ── Detail ──────────────────────────────────────────────────────────────
  const OP_LABEL = { '>=': '≥', '<=': '≤', '>': '>', '<': '<', '=': '=', in: 'in', 'not in': 'not in', within: 'within' };

  function chipsFromPredicate(pred) {
    return pred.split(/\s+AND\s+/i).map((clause, i) => {
      const m = clause.match(/^([\w.]+)\s+(>=|<=|>|<|=|in|not in)\s+(.+)$/i);
      if (!m) return { id: `c${i}`, path: clause, op: '', display: '' };
      return { id: `c${i}`, path: m[1], op: OP_LABEL[m[2].toLowerCase()] || m[2], display: m[3].replace(/[()]/g, '') };
    });
  }

  window.ScreenAudienceDetail = function ScreenAudienceDetail({ path, navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const id = path.split('/')[2];
    const a = D.AUDIENCES.find((x) => x.id === id) || D.AUDIENCES[0];
    const [cadence, setCadence] = React.useState(a.refreshCadence);
    const chips = chipsFromPredicate(a.predicate);
    const [srcLabel, srcTone] = SOURCE_LABEL[a.source] || [a.source, 'neutral'];
    const sample = D.CUSTOMERS.slice(0, 5);
    const events = [
      { id: 'e1', label: 'Refreshed', tone: 'info', meta: `+${D.range(20, 90)} entered · -${D.range(4, 30)} exited · ${HD.formatNumber(a.size)} total`, at: a.lastRefreshedAt },
      { id: 'e2', label: 'Refreshed', tone: 'info', meta: `+${D.range(20, 90)} entered · ${HD.formatNumber(a.size - 40)} total`, at: D.agoDays(1) },
      { id: 'e3', label: 'Created', tone: 'ok', meta: 'mode: dynamic', at: a.createdAt },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>
              <button onClick={() => navigate('#/audiences')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer' }}>
                <Icon name="arrow-left" size={12} stroke={2} />Audiences
              </button>
              <span>·</span>
              <HDPill tone={srcTone} icon={false} size="sm" label={srcLabel} />
            </div>
            <h1 style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>{a.name}</h1>
            <p style={{ margin: '4px 0 0', maxWidth: 620, fontSize: 13.5, color: P.inkMute }}>{a.description}</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <PBtn size="sm" variant="secondary" icon="pencil" onClick={() => navigate('#/audiences/new')}>Edit</PBtn>
            <PBtn size="sm" variant="secondary" icon="download" onClick={() => window.hdToast?.({ title: 'Export queued', description: `${HD.formatNumber(a.size)} member ids · redacted CSV.`, tone: 'info' })}>Export</PBtn>
            <PBtn size="sm" variant="ghost" icon="pause">Pause</PBtn>
            <PBtn size="sm" variant="accent" icon="refresh" onClick={() => window.hdToast?.({ title: 'Refresh queued', description: 'Recomputing against the trait store.', tone: 'ok' })}>Refresh</PBtn>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          <Card padding={20} style={{ background: P.accentSoft, border: `1px solid ${P.accentBorder}` }}>
            <MicroLabel>Members</MicroLabel>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 30, fontWeight: 600, color: P.ink, fontFamily: P.fontMono, lineHeight: 1 }}>{HD.formatNumber(a.size)}</span>
              <HDPill tone="neutral" icon={false} size="sm" label="cached" />
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11.5, color: P.inkMute }}>as of {HD.formatDateTime(a.lastRefreshedAt)}</p>
            <div style={{ marginTop: 12 }}><Spark data={a.history} color={P.accent} width={220} height={34} fill /></div>
          </Card>
          <Card padding={20}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <MicroLabel>Refresh</MicroLabel>
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="clock" size={15} stroke={2} color={P.inkMute} />
                  <span style={{ fontSize: 16, fontWeight: 600, color: P.ink }}>{cadence}</span>
                </div>
              </div>
              <select value={cadence} onChange={(e) => { setCadence(e.target.value); window.hdToast?.({ title: 'Cadence updated', description: `Refreshing ${e.target.value}.`, tone: 'ok' }); }}
                style={{ height: 30, background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: 8, fontSize: 12.5, color: P.ink, fontFamily: P.fontSans, padding: '0 8px' }}>
                {['15 min', 'hourly', 'nightly', 'manual'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 11.5, color: P.inkMute }}>Dynamic — re-evaluates against the trait store</p>
          </Card>
          <Card padding={20}>
            <MicroLabel>Reachable</MicroLabel>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
              {[['SMS consent', a.reachableSms], ['Email consent', a.reachableEmail]].map(([label, v]) => (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: P.ink2 }}><span>{label}</span><span style={{ fontFamily: P.fontMono }}>{HD.formatNumber(v)} · {HD.formatPercent(v / a.size, 0)}</span></div>
                  <div style={{ marginTop: 4, height: 5, borderRadius: 99, background: P.surface3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(v / a.size) * 100}%`, background: P.accent }} />
                  </div>
                </div>))}
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 11.5, color: P.inkMute }}>Used by {a.usedByFlows} flows · {a.usedByCampaigns} campaigns</p>
          </Card>
        </div>

        <Card padding={0}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Filter</h2>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>
                The DSL this audience evaluates against <code style={{ fontFamily: P.fontMono, background: P.accentSoft, color: P.mode === 'dark' ? P.accent : P.accentBorder, borderRadius: 4, padding: '1px 5px' }}>segmentation.customer_trait</code>.
              </p>
            </div>
            {a.source === 'ai' && <HDPill tone="info" size="sm" label="from prompt" />}
          </header>
          <div style={{ padding: 20 }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {chips.map((c) => (
                <li key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 99, border: `1px solid ${P.hairline2}`, background: P.surface3, padding: '5px 12px', fontSize: 13.5 }}>
                  <span style={{ fontWeight: 500, color: P.ink, fontFamily: P.fontMono, fontSize: 12.5 }}>{c.path}</span>
                  <HDPill tone="neutral" icon={false} size="sm" label={c.op} />
                  <span style={{ color: P.inkDim }}>{c.display}</span>
                </li>))}
            </ul>
            {a.source === 'ai' && (
              <div style={{ marginTop: 16, borderRadius: 10, border: `1px solid ${P.hairline2}`, background: P.surface2, padding: 12, fontSize: 12.5, color: P.inkDim }}>
                <span style={{ fontWeight: 500, color: P.ink }}>Original prompt:</span> <span style={{ fontStyle: 'italic' }}>“{a.description}”</span>
              </div>)}
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Activity</h2>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>Audience lifecycle events from the segmentation engine. Refresh ticks include enter/exit member counts.</p>
            </header>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {events.map((e) => (
                <li key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${P.hairline}`, fontSize: 12.5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <HDPill tone={e.tone} icon={false} size="sm" label={e.label} />
                    <span style={{ color: P.inkDim, fontFamily: P.fontMono, fontSize: 11.5 }}>{e.meta}</span>
                  </div>
                  <span style={{ fontSize: 10, color: P.inkMute, whiteSpace: 'nowrap' }}>{HD.relativeTime(e.at)}</span>
                </li>))}
            </ul>
          </Card>

          <Card padding={0} style={{ overflow: 'hidden' }}>
            <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Sample customers</h2>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>First 5 matching customer ids · PII redacted at read</p>
            </header>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {sample.map((c) => (
                <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${P.hairline}` }}>
                  <span style={{ height: 30, width: 30, borderRadius: 99, background: P.surface3, color: P.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="user" size={14} stroke={2} /></span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontFamily: P.fontMono, fontSize: 11.5, color: P.ink }}>{c.id}</p>
                    <p style={{ margin: 0, fontSize: 11.5, color: P.inkMute }}>Decrypt context required for email + phone</p>
                  </div>
                </li>))}
            </ul>
          </Card>
        </div>

        <Card padding={20}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="sparkle" size={14} stroke={2} color={window.HD.hueColor(P, 'violet')} />
            <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Build a lookalike</h2>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: P.inkMute }}>Expand off this audience's pgvector centroid. Pick how wide to cast — tighter similarity means fewer, better-matched customers.</p>
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {[['0.9 · tight', Math.round(a.size * 0.4)], ['0.8 · balanced', Math.round(a.size * 1.2)], ['0.7 · wide', Math.round(a.size * 3.1)]].map(([label, est]) => (
              <div key={label} style={{ borderRadius: 10, border: `1px solid ${P.hairline2}`, background: P.surface2, padding: '10px 14px' }}>
                <div style={{ fontSize: 11.5, color: P.inkMute }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: P.ink, fontFamily: P.fontMono }}>≈{HD.formatNumber(est)}</div>
              </div>))}
            <PBtn size="sm" variant="secondary" icon="sparkle" onClick={() => window.hdToast?.({ title: 'Lookalike queued', description: 'Centroid expansion running — new audience in ~30s.', tone: 'info' })}>Generate lookalike</PBtn>
          </div>
        </Card>
      </div>);
  };

  // ── Suggested ───────────────────────────────────────────────────────────
  window.ScreenSuggestedAudiences = function ScreenSuggestedAudiences({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const [dismissed, setDismissed] = React.useState(new Set());
    const accentInk = P.mode === 'dark' ? P.accent : P.accentBorder;
    const live = D.SUGGESTED_AUDIENCES.filter((s) => !dismissed.has(s.id));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div>
          <button onClick={() => navigate('#/audiences')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, fontSize: 11.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
            <Icon name="arrow-left" size={12} stroke={2} />Audiences
          </button>
          <h1 style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-.02em', color: P.ink }}>Suggested audiences</h1>
          <p style={{ margin: '6px 0 0', maxWidth: 640, fontSize: 13.5, color: P.inkMute, lineHeight: 1.5 }}>
            The scoring worker looks for behavioural clusters that don't have an audience yet. Accept to materialise it as a live segment; dismiss and it won't resurface for 30 days.
          </p>
        </div>

        {live.length === 0
          ? <HDEmpty icon="sparkle" title="No suggestions right now" body="The next scoring pass runs tonight. Dismissed suggestions come back after 30 days." />
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 12 }}>
            {live.map((s) => (
              <Card key={s.id} padding={20}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name="sparkle" size={13} stroke={2} color={accentInk} />
                      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: P.ink }}>{s.name}</h2>
                    </div>
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 30, fontWeight: 600, color: P.ink, fontFamily: P.fontMono, lineHeight: 1 }}>{HD.formatNumber(s.size)}</span>
                      <span style={{ fontSize: 11.5, color: P.inkMute }}>estimated members</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <MicroLabel align="right">Confidence</MicroLabel>
                    <div style={{ fontSize: 16, fontWeight: 600, fontFamily: P.fontMono, color: s.confidence > 0.8 ? HD.tone(P, 'ok').fg : HD.tone(P, 'warn').fg }}>{HD.formatPercent(s.confidence, 0)}</div>
                  </div>
                </div>
                <p style={{ margin: '12px 0 0', fontSize: 13.5, color: P.inkDim, lineHeight: 1.45 }}>{s.rationale}</p>
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {s.signals.map((sig) => (
                    <span key={sig} style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 8px', borderRadius: 99, background: P.surface3, border: `1px solid ${P.hairline2}`, fontSize: 11.5, color: P.ink2, fontFamily: P.fontMono }}>{sig}</span>))}
                </div>
                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  <PBtn size="sm" variant="accent" icon="check" full onClick={() => { setDismissed((d) => new Set([...d, s.id])); window.hdToast?.({ title: 'Audience created', description: `${s.name} is live and refreshing hourly.`, tone: 'ok' }); }}>Accept</PBtn>
                  <PBtn size="sm" variant="ghost" onClick={() => setDismissed((d) => new Set([...d, s.id]))}>Dismiss</PBtn>
                </div>
              </Card>))}
          </div>}
      </div>);
  };

  // ── Compare ─────────────────────────────────────────────────────────────
  function interpret(o) {
    if (!o) return '';
    if (o.intersection === 0) return 'Zero overlap — these audiences target completely different customers. Safe to send separate campaigns.';
    if (o.jaccard >= 0.85) return 'These audiences are nearly identical (Jaccard ≥ 0.85). Consider sending one campaign — the second will mostly hit the same people.';
    if (o.containment >= 0.9) return `“${o.smaller}” is essentially a subset of “${o.larger}” (≥90% containment). Sending to both will double-message most of “${o.smaller}”.`;
    if (o.jaccard >= 0.4) return `Substantial overlap (Jaccard ${o.jaccard.toFixed(2)}) — ${(o.containment * 100).toFixed(0)}% of the larger audience is also in the smaller. Consider deduping before campaign send.`;
    return `Modest overlap — ${o.intersection.toLocaleString()} customers fall in both, ${(o.jaccard * 100).toFixed(1)}% Jaccard similarity. Generally safe to send separately, but watch frequency caps.`;
  }

  window.ScreenAudienceCompare = function ScreenAudienceCompare({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const [aId, setAId] = React.useState('');
    const [bId, setBId] = React.useState('');
    const [overlap, setOverlap] = React.useState(null);
    const sel = { height: 36, width: '100%', background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, fontSize: 13.5, padding: '0 10px', color: P.ink, fontFamily: P.fontSans, marginTop: 6 };
    const canCompute = aId && bId && aId !== bId;

    function compute() {
      const A = D.AUDIENCES.find((x) => x.id === aId), B = D.AUDIENCES.find((x) => x.id === bId);
      const small = Math.min(A.size, B.size), big = Math.max(A.size, B.size);
      const intersection = Math.round(small * (0.12 + (Math.abs(A.size - B.size) < big * 0.3 ? 0.55 : 0.18)));
      const union = A.size + B.size - intersection;
      setOverlap({
        aName: A.name, bName: B.name, aSize: A.size, bSize: B.size, intersection, union,
        jaccard: intersection / union, containment: intersection / big,
        smaller: A.size <= B.size ? A.name : B.name, larger: A.size <= B.size ? B.name : A.name,
      });
    }

    const Stat = ({ label, value, sub, primary }) => (
      <div style={{ borderRadius: P.r12, border: `1px solid ${P.hairline2}`, background: P.surface2, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>
          <Icon name="users" size={11} stroke={2} />{label}
        </div>
        <div style={{ marginTop: 4, fontSize: 21, fontWeight: 600, fontFamily: P.fontMono, color: primary ? (P.mode === 'dark' ? P.accent : P.accentBorder) : P.ink }}>{value}</div>
        {sub && <div style={{ marginTop: 2, fontSize: 11.5, color: P.inkMute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
      </div>);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div>
          <button onClick={() => navigate('#/audiences')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, fontSize: 11.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
            <Icon name="arrow-left" size={12} stroke={2} />Audiences
          </button>
          <h1 style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-.02em', color: P.ink }}>Compare audiences</h1>
          <p style={{ margin: '6px 0 0', maxWidth: 640, fontSize: 13.5, color: P.inkMute }}>Intersection, union, Jaccard and containment — computed over member ids, so you can dedupe before a send.</p>
        </div>

        <Card padding={20}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {[['Audience A', aId, setAId, bId], ['Audience B', bId, setBId, aId]].map(([label, val, setter, other]) => (
              <div key={label}>
                <label style={{ fontSize: 12.5, color: P.ink2 }}>{label}</label>
                <select value={val} onChange={(e) => { setter(e.target.value); setOverlap(null); }} style={sel}>
                  <option value="">— Pick an audience —</option>
                  {D.AUDIENCES.map((o) => <option key={o.id} value={o.id} disabled={o.id === other}>{o.name} · {HD.formatNumber(o.size)} · {o.source}</option>)}
                </select>
              </div>))}
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <PBtn variant="accent" icon="swap" disabled={!canCompute} onClick={compute}>Compute overlap</PBtn>
          </div>
        </Card>

        {overlap && (
          <Card padding={20}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <Stat label="Audience A" sub={overlap.aName} value={HD.formatNumber(overlap.aSize)} />
              <Stat label="Audience B" sub={overlap.bName} value={HD.formatNumber(overlap.bSize)} />
              <Stat label="Intersection (A ∩ B)" value={HD.formatNumber(overlap.intersection)} sub={`${(overlap.containment * 100).toFixed(1)}% of larger`} primary />
              <Stat label="Union (A ∪ B)" value={HD.formatNumber(overlap.union)} sub={`Jaccard ${overlap.jaccard.toFixed(3)}`} />
            </div>
            <div style={{ marginTop: 12, borderRadius: 10, background: P.surface3, padding: 12, fontSize: 12.5 }}>
              <p style={{ margin: 0, fontWeight: 600, color: P.ink }}>Interpretation</p>
              <p style={{ margin: '4px 0 0', color: P.inkDim, lineHeight: 1.5 }}>{interpret(overlap)}</p>
            </div>
          </Card>)}
      </div>);
  };
})();
