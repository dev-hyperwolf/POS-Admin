// ── /flows · /flows/[id] · /flows/new · /flows/templates ──────────────────
;(function () {
  const useP = window.useP;
  const STATUS_TONE = { draft: 'neutral', live: 'ok', active: 'ok', paused: 'warn', archived: 'neutral' };
  const STATUS_LABEL = { draft: 'Draft', live: 'Active', active: 'Active', paused: 'Paused', archived: 'Archived' };
  const TRIGGER_LABEL = (t) => (t.startsWith('schedule') ? 'Schedule' : t.startsWith('customer') || t.startsWith('commerce') || t.startsWith('loyalty') || t.startsWith('referral') ? 'Event' : 'Manual');
  const NODE_ICON = { trigger: 'zap', wait: 'clock', condition: 'split', message: 'send', action: 'gift', exit: 'ban' };
  const NODE_HUE = { trigger: 'violet', wait: 'blue', condition: 'teal', message: 'pink', action: 'green', exit: 'neutral' };

  function stepsFor(flow) {
    const D = window.ENGAGE_DATA;
    if (D.FLOW_STEPS[flow.id]) return D.FLOW_STEPS[flow.id];
    const out = [{ id: 's1', kind: 'trigger', label: flow.trigger, detail: 'flow entry', entered: flow.enrolled }];
    for (let i = 1; i < flow.steps; i++) {
      const kind = i % 3 === 1 ? 'wait' : i % 3 === 2 ? 'message' : 'condition';
      out.push({
        id: `s${i + 1}`, kind,
        label: kind === 'wait' ? `Wait ${i * 12}h` : kind === 'message' ? `${i === 2 ? 'SMS' : 'Email'} · step ${i}` : 'Converted since?',
        detail: kind === 'message' ? `tmpl_${flow.id}_${i} · policy-checked` : '',
        entered: Math.max(0, Math.round(flow.enrolled * (1 - i * 0.12))),
      });
    }
    return out;
  }

  function FlowGraph({ steps }) {
    const P = useP(), HD = window.HD;
    return (
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {steps.map((s, i) => {
          const hue = HD.hueColor(P, NODE_HUE[s.kind]);
          return (
            <li key={s.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderRadius: P.r12, border: `1px solid ${P.hairline2}`, background: P.surface2, padding: '10px 14px' }}>
                <span style={{ height: 30, width: 30, borderRadius: 8, background: P.surface3, color: hue, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                  <Icon name={NODE_ICON[s.kind]} size={15} stroke={2} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: P.ink }}>{s.label}</span>
                    <HDPill tone="neutral" icon={false} size="sm" label={s.kind} />
                  </div>
                  {s.detail && <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{s.detail}</div>}
                  {s.branchA && <div style={{ marginTop: 4, display: 'flex', gap: 8, fontSize: 11.5, color: P.inkDim }}><span>↳ {s.branchA}</span><span>↳ {s.branchB}</span></div>}
                </div>
                <span style={{ fontSize: 11.5, fontFamily: P.fontMono, color: P.inkMute, whiteSpace: 'nowrap' }}>{window.HD.formatNumber(s.entered)} entered</span>
              </div>
              {i < steps.length - 1 && <div style={{ marginLeft: 28, height: 14, width: 2, background: P.hairline2 }} />}
            </li>);
        })}
      </ol>);
  }

  window.ScreenFlows = function ScreenFlows({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const [flows, setFlows] = React.useState(D.FLOWS);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-.02em', color: P.ink }}>Flows</h1>
            <p style={{ margin: '6px 0 0', maxWidth: 640, fontSize: 13.5, color: P.inkMute, lineHeight: 1.5 }}>
              Durable customer journeys — trigger → wait → branch → action. Every step is resumable; runs survive worker restarts and re-fire idempotently.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <PBtn size="sm" variant="secondary" icon="layout-template" onClick={() => navigate('#/flows/templates')}>From template</PBtn>
            <PBtn size="sm" variant="accent" icon="plus" onClick={() => navigate('#/flows/new')}>New flow</PBtn>
          </div>
        </div>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
          {flows.map((f) => {
            const convRate = f.enrolled ? f.converted / f.enrolled : 0;
            return (
              <li key={f.id}>
                <Card padding={16} style={{ cursor: 'pointer', height: '100%' }} onClick={() => navigate(`#/flows/${f.id}`)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: P.ink }}>{f.name}</h2>
                    <Icon name="arrow-right" size={14} stroke={2} color={P.inkMute} />
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <HDPill tone={STATUS_TONE[f.status]} icon={false} size="sm" label={STATUS_LABEL[f.status]} />
                    <HDPill tone="info" icon={false} size="sm" label={TRIGGER_LABEL(f.trigger)} />
                    <HDPill tone="neutral" icon={false} size="sm" label={`${f.steps} nodes`} />
                  </div>
                  <div style={{ marginTop: 12, fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute }}>{f.trigger}</div>
                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, paddingTop: 12, borderTop: `1px solid ${P.hairline}` }}>
                    {[['Enrolled', HD.formatNumber(f.enrolled)], ['Converted', HD.formatNumber(f.converted)], ['Revenue', HD.formatCents(f.revenueCents, { showCents: false })]].map(([l, v]) => (
                      <div key={l}>
                        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>{l}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink, fontFamily: P.fontMono }}>{v}</div>
                      </div>))}
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 99, background: P.surface3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, convRate * 400)}%`, background: HD.tone(P, 'ok').fg }} />
                    </div>
                    <span style={{ fontSize: 11.5, fontFamily: P.fontMono, color: P.inkMute }}>{HD.formatPercent(convRate, 1)} conv</span>
                  </div>
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11.5, color: P.inkMute }}>v{f.versionNo} · {HD.relativeTime(f.updatedAt)}</span>
                    <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <IconBtn icon={f.status === 'live' ? 'pause' : 'play'} size={13} title={f.status === 'live' ? 'Pause' : 'Activate'} style={{ width: 26, height: 26 }}
                        onClick={() => { setFlows((cur) => cur.map((x) => (x.id === f.id ? { ...x, status: x.status === 'live' ? 'paused' : 'live' } : x))); window.hdToast?.({ title: f.status === 'live' ? 'Flow paused' : 'Flow activated', description: `${f.name} · in-flight runs ${f.status === 'live' ? 'hold at their current node' : 'resume'}.`, tone: f.status === 'live' ? 'warn' : 'ok' }); }} />
                    </div>
                  </div>
                </Card>
              </li>);
          })}
        </ul>
      </div>);
  };

  window.ScreenFlowDetail = function ScreenFlowDetail({ path, navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const id = path.split('/')[2];
    const f = D.FLOWS.find((x) => x.id === id) || D.FLOWS[0];
    const [status, setStatus] = React.useState(f.status);
    const steps = stepsFor(f);
    const stats = { total: f.enrolled, running: Math.max(0, f.enrolled - f.completed), completed: f.completed, failed: Math.round(f.enrolled * 0.01), exited: Math.round(f.enrolled * 0.04) };
    const runs = D.CUSTOMERS.slice(0, 12).map((c, i) => ({
      id: `run-${i}`, customerId: c.id,
      status: ['completed', 'running', 'completed', 'exited', 'running', 'failed'][i % 6],
      currentNodeId: i % 3 === 0 ? null : steps[Math.min(steps.length - 1, (i % steps.length))].id,
      startedAt: D.ago(D.range(10, 4000)),
    }));
    const runTone = (s) => (s === 'completed' ? 'ok' : s === 'running' || s === 'pending' ? 'info' : s === 'exited' ? 'warn' : s === 'failed' ? 'blocked' : 'neutral');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>
              <button onClick={() => navigate('#/flows')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer' }}>
                <Icon name="arrow-left" size={12} stroke={2} />Flows
              </button>
              <span>·</span>
              <HDPill tone={STATUS_TONE[status]} icon={false} size="sm" label={STATUS_LABEL[status]} />
            </div>
            <h1 style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>{f.name}</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13.5, color: P.inkMute }}>Version {f.versionNo} · updated {HD.relativeTime(f.updatedAt)}</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <PBtn size="sm" variant="secondary" icon="pencil" onClick={() => navigate('#/flows/new')}>Edit canvas</PBtn>
            <PBtn size="sm" variant="ghost" icon="copy">Duplicate</PBtn>
            <PBtn size="sm" variant={status === 'live' ? 'secondary' : 'accent'} icon={status === 'live' ? 'pause' : 'play'}
              onClick={() => { const next = status === 'live' ? 'paused' : 'live'; setStatus(next); window.hdToast?.({ title: next === 'live' ? 'Flow activated' : 'Flow paused', description: next === 'live' ? 'New trigger events will enroll customers.' : 'In-flight runs hold at their current node.', tone: next === 'live' ? 'ok' : 'warn' }); }}>
              {status === 'live' ? 'Pause' : 'Activate'}
            </PBtn>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          {[['Total runs', stats.total, 'neutral'], ['Running', stats.running, 'info'], ['Completed', stats.completed, 'ok'], ['Failed / exited', stats.failed + stats.exited, 'warn']].map(([label, value, tone]) => (
            <Card key={label} padding={16}>
              <MicroLabel>{label}</MicroLabel>
              <div style={{ marginTop: 4, fontSize: 21, fontWeight: 600, fontFamily: P.fontMono, color: tone === 'neutral' ? P.ink : HD.tone(P, tone).fg }}>{HD.formatNumber(value)}</div>
            </Card>))}
        </div>

        <div className="hd-2col">
          <Card padding={0}>
            <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Definition</h2>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>{steps.length} nodes · {steps.length - 1} edges · read-only view of the published version</p>
            </header>
            <div style={{ padding: 20 }}><FlowGraph steps={steps} /></div>
          </Card>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card padding={20}>
              <MicroLabel>Trigger</MicroLabel>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="zap" size={14} stroke={2} color={HD.hueColor(P, 'violet')} />
                <span style={{ fontSize: 13.5, fontWeight: 500, color: P.ink }}>{TRIGGER_LABEL(f.trigger)}</span>
              </div>
              <pre style={{ margin: '10px 0 0', overflowX: 'auto', borderRadius: 8, background: P.surface3, padding: 10, fontSize: 11.5, fontFamily: P.fontMono, color: P.ink2 }}>{JSON.stringify({ eventName: f.trigger, dedupeWindow: '24h', quietHours: true }, null, 2)}</pre>
            </Card>
            <Card padding={20}>
              <MicroLabel>Guardrails</MicroLabel>
              <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, color: P.ink2 }}>
                {[['Frequency cap', '3 / 7 days'], ['Quiet hours', '9pm – 9am local'], ['Consent required', 'sms + email'], ['Re-entry', 'once per 30 days']].map(([k, v]) => (
                  <li key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ color: P.inkMute }}>{k}</span><span style={{ fontFamily: P.fontMono }}>{v}</span>
                  </li>))}
              </ul>
            </Card>
          </aside>
        </div>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
            <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Recent runs</h2>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>Last 25 — full history queryable via the API.</p>
          </header>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {runs.map((r) => (
              <li key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px', borderBottom: `1px solid ${P.hairline}`, fontSize: 12.5 }}>
                <span style={{ fontFamily: P.fontMono, color: P.ink }}>{r.customerId.slice(0, 8)}…</span>
                <HDPill tone={runTone(r.status)} icon={false} size="sm" label={r.status} />
                <span style={{ color: P.inkMute }}>{r.currentNodeId ? `at ${r.currentNodeId}` : 'idle'}</span>
                <span style={{ marginLeft: 'auto', color: P.inkMute }}>{HD.formatDateTime(r.startedAt)}</span>
              </li>))}
          </ul>
        </Card>
      </div>);
  };

  // ── Templates gallery ───────────────────────────────────────────────────
  window.ScreenFlowTemplates = function ScreenFlowTemplates({ navigate }) {
    const P = useP(), D = window.ENGAGE_DATA, HD = window.HD;
    const groups = React.useMemo(() => {
      const m = new Map();
      for (const t of D.FLOW_TEMPLATES) { const l = m.get(t.category) || []; l.push(t); m.set(t.category, l); }
      return [...m.entries()];
    }, []);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24 }}>
        <header>
          <button onClick={() => navigate('#/flows')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, fontSize: 11.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
            <Icon name="arrow-left" size={12} stroke={2} />Flows
          </button>
          <h1 style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>Start from a template</h1>
          <p style={{ margin: '6px 0 0', maxWidth: 640, fontSize: 13.5, color: P.inkMute, lineHeight: 1.5 }}>
            Pre-built journeys you can copy + customize. Templates are inserted as drafts — the operator wires real audience IDs and message templates before activating, so a placeholder never fires accidentally.
          </p>
        </header>
        {groups.map(([category, templates]) => (
          <section key={category} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>{category}</h2>
              <HDPill tone="neutral" icon={false} size="sm" label={`${templates.length} template${templates.length === 1 ? '' : 's'}`} />
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {templates.map((t) => (
                <li key={t.id}>
                  <Card padding={16} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon name="workflow" size={14} stroke={2} color={HD.hueColor(P, 'violet')} />
                      <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>{t.name}</h3>
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: 12.5, color: P.inkDim, lineHeight: 1.45 }}>{t.blurb}</p>
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <HDPill tone="neutral" icon={false} size="sm" label={`${t.steps} nodes`} />
                      {t.channels.map((c) => <HDPill key={c} tone="info" icon={false} size="sm" label={c} />)}
                    </div>
                    <div style={{ marginTop: 12, borderRadius: 8, border: `1px solid ${HD.tone(P, 'warn').fg}55`, background: HD.tone(P, 'warn').bg, padding: 8, fontSize: 10, color: HD.tone(P, 'warn').fg }}>
                      <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}><Icon name="flag" size={10} stroke={2} />Edit before activating</p>
                      <ul style={{ margin: '4px 0 0', paddingLeft: 12, fontFamily: P.fontMono }}>
                        <li>audienceId</li><li>templateId</li>
                      </ul>
                    </div>
                    <div style={{ marginTop: 'auto', paddingTop: 12 }}>
                      <PBtn size="sm" variant="accent" icon="sparkle" full onClick={() => { window.hdToast?.({ title: 'Draft flow created', description: `${t.name} · swap placeholders, then activate.`, tone: 'ok' }); navigate('#/flows/new'); }}>Use this template →</PBtn>
                    </div>
                  </Card>
                </li>))}
            </ul>
          </section>))}
      </div>);
  };

  // ── New flow ────────────────────────────────────────────────────────────
  const TRIGGERS = [
    { value: 'customer.created', label: 'Customer created', kind: 'Event' },
    { value: 'commerce.order.completed', label: 'Order completed', kind: 'Event' },
    { value: 'commerce.cart.abandoned', label: 'Cart abandoned', kind: 'Event' },
    { value: 'loyalty.tier.entered', label: 'Tier entered', kind: 'Event' },
    { value: 'referral.attributed', label: 'Referral attributed', kind: 'Event' },
    { value: 'audience.entered', label: 'Audience entered', kind: 'Audience' },
    { value: 'schedule.daily', label: 'Daily schedule', kind: 'Schedule' },
    { value: 'manual', label: 'Manual / API', kind: 'Manual' },
  ];
  const PALETTE = [
    { kind: 'message', label: 'Send message', detail: 'SMS · email · push · wallet' },
    { kind: 'wait', label: 'Wait', detail: 'duration or until time-of-day' },
    { kind: 'condition', label: 'Condition', detail: 'branch on trait or event' },
    { kind: 'action', label: 'Grant reward', detail: 'points, reward, or tag' },
    { kind: 'exit', label: 'Exit', detail: 'end the run' },
  ];

  window.ScreenFlowNew = function ScreenFlowNew({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const [name, setName] = React.useState('');
    const [trigger, setTrigger] = React.useState('commerce.cart.abandoned');
    const [audience, setAudience] = React.useState(D.AUDIENCES[0].id);
    const [nodes, setNodes] = React.useState([{ id: 'n1', kind: 'wait', label: 'Wait 1 hour', detail: 'quiet-hours aware' }]);
    const [quiet, setQuiet] = React.useState(true);
    const [cap, setCap] = React.useState(3);
    const sel = { height: 36, width: '100%', background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, fontSize: 13.5, padding: '0 10px', color: P.ink, fontFamily: P.fontSans };
    const steps = [{ id: 'trig', kind: 'trigger', label: TRIGGERS.find((t) => t.value === trigger)?.label || trigger, detail: trigger, entered: 0 }, ...nodes.map((n) => ({ ...n, entered: 0 }))];
    const valid = name.trim() && nodes.length > 0;

    function add(kind) {
      const preset = {
        message: { label: 'SMS · new message', detail: 'pick a template' },
        wait: { label: 'Wait 24 hours', detail: '' },
        condition: { label: 'Condition', detail: 'trait or event check' },
        action: { label: 'Grant 250 points', detail: 'loyalty ledger write' },
        exit: { label: 'Exit run', detail: '' },
      }[kind];
      setNodes((cur) => [...cur, { id: `n${cur.length + 1}`, kind, ...preset }]);
    }

    return (
      <div style={{ padding: 24 }}>
        <div className="hd-split">
          <section style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <div>
              <button onClick={() => navigate('#/flows')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, fontSize: 11.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
                <Icon name="arrow-left" size={12} stroke={2} />Flows
              </button>
              <h1 style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', color: P.ink }}>New flow</h1>
              <p style={{ margin: '6px 0 0', maxWidth: 560, fontSize: 13.5, color: P.inkMute, lineHeight: 1.5 }}>
                Pick the trigger, then compose the journey. It saves as a draft — nothing fires until you activate it.
              </p>
            </div>

            <Card padding={20}>
              <MicroLabel style={{ marginBottom: 6 }}>Flow name</MicroLabel>
              <Field value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Abandoned cart · 1h" />
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div>
                  <MicroLabel style={{ marginBottom: 6 }}>Trigger</MicroLabel>
                  <select value={trigger} onChange={(e) => setTrigger(e.target.value)} style={sel}>
                    {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label} · {t.kind}</option>)}
                  </select>
                </div>
                <div>
                  <MicroLabel style={{ marginBottom: 6 }}>Entry audience (optional)</MicroLabel>
                  <select value={audience} onChange={(e) => setAudience(e.target.value)} style={sel}>
                    <option value="">— anyone matching the trigger —</option>
                    {D.AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.name} · {HD.formatNumber(a.size)}</option>)}
                  </select>
                </div>
              </div>
            </Card>

            <Card padding={20}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Journey</h2>
                <span style={{ fontSize: 11.5, color: P.inkMute }}>{steps.length} nodes</span>
              </div>
              <div style={{ marginTop: 12 }}><FlowGraph steps={steps} /></div>
              {nodes.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {nodes.map((n, i) => (
                    <button key={n.id} onClick={() => setNodes((cur) => cur.filter((_, k) => k !== i))}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: '0 8px', borderRadius: 99, background: P.surface3, border: `1px solid ${P.hairline2}`, fontSize: 11.5, color: P.inkDim, cursor: 'pointer', fontFamily: P.fontSans }}>
                      remove {n.kind} #{i + 1}<Icon name="x" size={10} stroke={2.4} />
                    </button>))}
                </div>)}
              <MicroLabel style={{ marginTop: 16 }}>Add a node</MicroLabel>
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                {PALETTE.map((p) => (
                  <button key={p.kind} onClick={() => add(p.kind)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, border: `1px solid ${P.hairline2}`, background: P.surface2, padding: '8px 10px', cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = P.accentBorder)} onMouseLeave={(e) => (e.currentTarget.style.borderColor = P.hairline2)}>
                    <Icon name={NODE_ICON[p.kind]} size={14} stroke={2} color={HD.hueColor(P, NODE_HUE[p.kind])} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 12.5, color: P.ink }}>{p.label}</span>
                      <span style={{ display: 'block', fontSize: 10, color: P.inkMute }}>{p.detail}</span>
                    </span>
                  </button>))}
              </div>
            </Card>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <PBtn size="sm" variant="ghost" onClick={() => navigate('#/flows')}>Cancel</PBtn>
              <div style={{ display: 'flex', gap: 8 }}>
                <PBtn size="sm" variant="secondary" icon="note" disabled={!valid} onClick={() => { window.hdToast?.({ title: 'Draft saved', description: `${name} · ${steps.length} nodes.`, tone: 'ok' }); navigate('#/flows'); }}>Save draft</PBtn>
                <PBtn size="sm" variant="accent" icon="play" disabled={!valid} onClick={() => { window.hdToast?.({ title: 'Flow activated', description: `${name} will enroll on ${trigger}.`, tone: 'ok' }); navigate('#/flows'); }}>Save + activate</PBtn>
              </div>
            </div>
          </section>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card padding={20} style={{ background: P.accentSoft, border: `1px solid ${P.accentBorder}` }}>
              <MicroLabel>Estimated weekly enrollment</MicroLabel>
              <div style={{ marginTop: 4, fontSize: 30, fontWeight: 600, fontFamily: P.fontMono, color: P.ink, lineHeight: 1 }}>
                {HD.formatNumber(Math.round((audience ? (D.AUDIENCES.find((a) => a.id === audience)?.size || 1000) : 42318) * 0.08))}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 11.5, color: P.inkMute }}>based on the last 4 weeks of {trigger}</p>
            </Card>
            <Card padding={20}>
              <MicroLabel>Guardrails</MicroLabel>
              <label style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: P.ink2, cursor: 'pointer' }}>
                <Check on={quiet} onChange={setQuiet} size={18} />Respect quiet hours (9pm–9am local)
              </label>
              <div style={{ marginTop: 14 }}>
                <MicroLabel style={{ marginBottom: 6 }}>Frequency cap · messages / 7 days</MicroLabel>
                <Field type="number" min={1} max={14} value={cap} onChange={(e) => setCap(Number(e.target.value))} />
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 11.5, color: P.inkMute, lineHeight: 1.5 }}>
                The policy engine evaluates consent, quiet hours, and caps at send time — a paused flow can never leak a message.
              </p>
            </Card>
            <Card padding={16}>
              <MicroLabel>Validation</MicroLabel>
              <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
                {[[!!name.trim(), 'Flow has a name'], [nodes.length > 0, 'At least one node after the trigger'], [nodes.some((n) => n.kind === 'message'), 'Sends at least one message'], [quiet, 'Quiet hours respected']].map(([ok, label]) => (
                  <li key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, color: ok ? HD.tone(P, 'ok').fg : P.inkMute }}>
                    <Icon name={ok ? 'check-circle' : 'info'} size={12} stroke={2} />{label}
                  </li>))}
              </ul>
            </Card>
          </aside>
        </div>
      </div>);
  };
})();
