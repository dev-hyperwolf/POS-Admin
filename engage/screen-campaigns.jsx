// ── /campaigns · /messages · /templates · /interactive(+[id]) ─────────────
;(function () {
  const useP = window.useP;
  const CHANNEL_TONE = { sms: 'ok', email: 'info', push: 'brand', wallet: 'warn' };
  const STATUS_TONE = { sent: 'ok', sending: 'info', scheduled: 'brand', queued: 'info', draft: 'neutral', paused: 'warn' };

  window.ScreenCampaigns = function ScreenCampaigns({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-.02em', color: P.ink }}>Campaigns</h1>
            <p style={{ margin: '6px 0 0', maxWidth: 680, fontSize: 13.5, color: P.inkMute, lineHeight: 1.5 }}>
              One-shot and recurring sends. Every outbound message runs the full 7-rule policy chain (suppression → consent → age gate → geo → frequency → content scan → quiet hours) before it leaves the queue.
            </p>
          </div>
          <PBtn size="sm" variant="accent" icon="plus" onClick={() => window.hdToast?.({ title: 'New campaign', description: 'Pick an audience and template — the composer opens next.', tone: 'info' })}>New campaign</PBtn>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
          {D.CAMPAIGNS.map((c) => {
            const delivery = c.sent ? c.delivered / c.sent : 0;
            const ctr = c.sent ? c.clicked / c.sent : 0;
            return (
              <Card key={c.id} padding={20} style={{ cursor: 'pointer' }} onClick={() => navigate('#/analytics/campaigns')}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: '-.01em', color: P.ink }}>{c.name}</h3>
                  <HDPill tone={STATUS_TONE[c.status]} size="sm" label={c.status} />
                </div>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: P.inkMute }}>
                  <HDPill tone={CHANNEL_TONE[c.channel]} icon={false} size="sm" label={c.channel.toUpperCase()} />
                  <span>→ {c.audience}</span>
                </div>
                <dl style={{ margin: '14px 0 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, borderTop: `1px solid ${P.hairline}`, paddingTop: 12 }}>
                  {[['Sent', HD.formatNumber(c.sent)], ['Delivery', c.sent ? HD.formatPercent(delivery, 0) : '—'], ['CTR', c.sent ? HD.formatPercent(ctr, 1) : '—'], ['Revenue', c.revenueCents ? HD.formatCents(c.revenueCents, { showCents: false }) : '—']].map(([l, v]) => (
                    <div key={l}>
                      <dt style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>{l}</dt>
                      <dd style={{ margin: '2px 0 0', fontSize: 13.5, fontWeight: 600, fontFamily: P.fontMono, color: P.ink }}>{v}</dd>
                    </div>))}
                </dl>
                <div style={{ marginTop: 12, fontSize: 11.5, color: P.inkMute }}>
                  {c.sentAt ? HD.relativeTime(c.sentAt) : c.scheduledFor ? `scheduled ${HD.relativeTime(c.scheduledFor)}` : 'not scheduled'}
                </div>
              </Card>);
          })}
        </div>
      </div>);
  };

  // ── Messages ────────────────────────────────────────────────────────────
  window.ScreenMessages = function ScreenMessages({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const [q, setQ] = React.useState('');
    const [status, setStatus] = React.useState('all');
    const [selected, setSelected] = React.useState(null);
    const rows = D.MESSAGES.filter((m) => {
      if (status !== 'all' && m.status !== status) return false;
      const s = q.trim().toLowerCase();
      if (!s) return true;
      return [m.channel, m.status, m.templateName, m.customerName, m.campaignName].join(' ').toLowerCase().includes(s);
    });
    const counts = D.MESSAGES.reduce((acc, m) => { acc[m.status] = (acc[m.status] || 0) + 1; return acc; }, {});
    const tone = (s) => (s === 'delivered' ? 'ok' : s === 'sent' || s === 'queued' ? 'info' : s === 'held' ? 'warn' : s === 'failed' || s === 'blocked' ? 'blocked' : 'neutral');
    const POLICY = ['suppression', 'consent', 'age gate', 'geo', 'frequency', 'content scan', 'quiet hours'];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-.02em', color: P.ink }}>Messages</h1>
          <p style={{ margin: '6px 0 0', maxWidth: 680, fontSize: 13.5, color: P.inkMute, lineHeight: 1.5 }}>
            Every outbound send with its policy-verdict chain. “held” means the send is waiting for quiet hours to lift; “blocked” means a rule refused it — open the row for the audit trail.
          </p>
        </div>

        <Card padding={0} style={{ overflow: 'hidden' }}>
          <div style={{ padding: 12, borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}><Field icon="search" size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by channel, status, template, or recipient…" /></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['all', 'delivered', 'sent', 'queued', 'held', 'failed', 'blocked'].map((s) => (
                <button key={s} onClick={() => setStatus(s)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', borderRadius: 99, fontSize: 11.5, cursor: 'pointer', fontFamily: P.fontSans,
                    background: status === s ? P.ink : 'transparent', color: status === s ? P.surface : P.inkMute, border: `1px solid ${status === s ? P.ink : P.hairline2}` }}>
                  {s}{s !== 'all' && counts[s] ? <span style={{ fontFamily: P.fontMono, opacity: .7 }}>{counts[s]}</span> : null}
                </button>))}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <HDTable>
              <thead><tr><TH>Time</TH><TH>Channel</TH><TH>Recipient</TH><TH>Template</TH><TH>Campaign</TH><TH>Status</TH><TH>Reason</TH></tr></thead>
              <tbody>
                {rows.length === 0
                  ? <tr><TD colSpan={7}><div style={{ padding: '36px 0', textAlign: 'center', color: P.inkMute }}>No messages match.</div></TD></tr>
                  : rows.map((m) => (
                    <TR key={m.id} onClick={() => setSelected(m)}>
                      <TD style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{HD.relativeTime(m.scheduledFor)}</TD>
                      <TD><HDPill tone="neutral" icon={false} size="sm" label={m.channel.toUpperCase()} /></TD>
                      <TD mono style={{ fontSize: 11.5 }}>{m.channel === 'email' ? `${m.customerName.split(' ')[0].toLowerCase()[0]}•••@•••.com` : m.channel === 'push' ? 'web-push/1 device' : m.channel === 'wallet' ? `pass GL${m.customerId.slice(0, 5).toUpperCase()}` : `+1 ${D.range(310, 949)}•••${D.range(1000, 9999)}`}</TD>
                      <TD style={{ fontSize: 12.5 }}>{m.templateName}</TD>
                      <TD style={{ fontSize: 12.5, color: P.inkDim, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.campaignName}</TD>
                      <TD><HDPill tone={tone(m.status)} size="sm" label={m.status} /></TD>
                      <TD style={{ fontSize: 11.5, color: P.inkMute }}>{m.reason || '—'}</TD>
                    </TR>))}
              </tbody>
            </HDTable>
          </div>
        </Card>

        <Sheet open={!!selected} onClose={() => setSelected(null)} width={440}>
          {selected && <>
            <div style={{ padding: 20, borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <MicroLabel>Message · {selected.id}</MicroLabel>
                <h2 style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 600, color: P.ink }}>{selected.templateName}</h2>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HDPill tone={CHANNEL_TONE[selected.channel]} icon={false} size="sm" label={selected.channel.toUpperCase()} />
                  <HDPill tone={tone(selected.status)} size="sm" label={selected.status} />
                </div>
              </div>
              <IconBtn icon="x" size={16} onClick={() => setSelected(null)} style={{ width: 30, height: 30, margin: -4 }} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <MicroLabel>Policy chain</MicroLabel>
                <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {POLICY.map((rule, i) => {
                    const failedAt = selected.status === 'blocked' ? 4 : selected.status === 'held' ? 6 : -1;
                    const state = failedAt === i ? 'stop' : failedAt >= 0 && i > failedAt ? 'skip' : 'pass';
                    const c = state === 'pass' ? HD.tone(P, 'ok') : state === 'stop' ? HD.tone(P, selected.status === 'held' ? 'warn' : 'blocked') : { fg: P.inkMute, bg: P.surface3 };
                    return (
                      <li key={rule} style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 8, border: `1px solid ${P.hairline2}`, background: state === 'skip' ? 'transparent' : c.bg, padding: '7px 10px', fontSize: 12.5 }}>
                        <Icon name={state === 'pass' ? 'check-circle' : state === 'stop' ? 'ban' : 'minus'} size={13} stroke={2} color={c.fg} />
                        <span style={{ flex: 1, color: state === 'skip' ? P.inkMute : P.ink }}>{rule}</span>
                        <span style={{ fontSize: 10, fontFamily: P.fontMono, color: c.fg }}>{state === 'pass' ? 'pass' : state === 'stop' ? selected.status : 'skipped'}</span>
                      </li>);
                  })}
                </ul>
              </div>
              <div>
                <MicroLabel>Timeline</MicroLabel>
                <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: P.ink2 }}>
                  <li>queued · {HD.formatDateTime(selected.scheduledFor)}</li>
                  {selected.deliveredAt && <li>delivered · {HD.formatDateTime(selected.deliveredAt)}</li>}
                  {selected.reason && <li style={{ color: HD.tone(P, 'warn').fg }}>{selected.reason}</li>}
                </ul>
              </div>
              <div>
                <MicroLabel>Cost</MicroLabel>
                <p style={{ margin: '6px 0 0', fontSize: 13.5, color: P.ink, fontFamily: P.fontMono }}>{selected.costCents ? `$0.0${selected.costCents}` : '$0.00'} · {selected.channel === 'sms' ? '1 segment' : 'no per-message cost'}</p>
              </div>
            </div>
            <div style={{ padding: 16, borderTop: `1px solid ${P.hairline2}`, display: 'flex', gap: 8 }}>
              <PBtn variant="secondary" full icon="user" onClick={() => { navigate(`#/customers/${selected.customerId}`); setSelected(null); }}>Open customer</PBtn>
              <PBtn variant="ghost" icon="refresh" disabled={selected.status === 'delivered'}>Retry</PBtn>
            </div>
          </>}
        </Sheet>
      </div>);
  };

  // ── Templates ───────────────────────────────────────────────────────────
  window.ScreenTemplates = function ScreenTemplates() {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const [preview, setPreview] = React.useState(null);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-.02em', color: P.ink }}>Templates</h1>
            <p style={{ margin: '6px 0 0', maxWidth: 680, fontSize: 13.5, color: P.inkMute, lineHeight: 1.5 }}>
              One canvas, every channel. Compose email, SMS landing pages, push previews, and wallet back-content visually — the same block palette and merge tokens across all of them.
            </p>
          </div>
          <PBtn size="sm" variant="accent" icon="plus">New template</PBtn>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {D.TEMPLATES.map((t) => (
            <Card key={t.id} padding={20} style={{ cursor: 'pointer' }} onClick={() => setPreview(t)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: P.ink }}>{t.name}</h3>
                <HDPill tone="ok" size="sm" label="approved" />
              </div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: P.inkMute }}>
                <HDPill tone={CHANNEL_TONE[t.channel]} icon={false} size="sm" label={t.channel.toUpperCase()} />
                {t.subject && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</span>}
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 12.5, color: P.ink2, lineHeight: 1.5, background: P.surface2, borderRadius: 8, padding: 10, border: `1px solid ${P.hairline}` }}>{t.body}</p>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: P.inkMute }}>
                <span>Used by {t.usedBy} {t.usedBy === 1 ? 'flow' : 'flows'}</span>
                <span>Updated {HD.relativeTime(t.updatedAt)}</span>
              </div>
            </Card>))}
        </div>

        <Sheet open={!!preview} onClose={() => setPreview(null)} width={420}>
          {preview && <>
            <div style={{ padding: 20, borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <MicroLabel>{preview.channel.toUpperCase()} preview</MicroLabel>
                <h2 style={{ margin: '4px 0 0', fontSize: 16, fontWeight: 600, color: P.ink }}>{preview.name}</h2>
              </div>
              <IconBtn icon="x" size={16} onClick={() => setPreview(null)} style={{ width: 30, height: 30, margin: -4 }} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {preview.channel === 'sms'
                ? <div style={{ maxWidth: 300, margin: '0 auto' }}>
                  <div style={{ borderRadius: 18, background: P.surface3, padding: 14, fontSize: 13.5, color: P.ink, lineHeight: 1.5 }}>{preview.body}</div>
                  <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{preview.segments} segment · {preview.chars} chars</p>
                </div>
                : <div style={{ borderRadius: 10, border: `1px solid ${P.hairline2}`, background: P.surface2, overflow: 'hidden' }}>
                  {preview.subject && <div style={{ padding: 12, borderBottom: `1px solid ${P.hairline2}`, fontSize: 13.5, fontWeight: 600, color: P.ink }}>{preview.subject}</div>}
                  <div style={{ padding: 14, fontSize: 13.5, color: P.ink2, lineHeight: 1.6 }}>{preview.body}</div>
                </div>}
              <MicroLabel style={{ marginTop: 20 }}>Merge tokens</MicroLabel>
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(preview.body.match(/{{\w+}}/g) || ['none']).map((tok) => (
                  <span key={tok} style={{ fontFamily: P.fontMono, fontSize: 11.5, background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: 4, padding: '2px 6px', color: P.ink2 }}>{tok}</span>))}
              </div>
            </div>
            <div style={{ padding: 16, borderTop: `1px solid ${P.hairline2}`, display: 'flex', gap: 8 }}>
              <PBtn variant="secondary" full icon="pencil">Edit in canvas</PBtn>
              <PBtn variant="ghost" icon="send">Send test</PBtn>
            </div>
          </>}
        </Sheet>
      </div>);
  };

  // ── Interactive ─────────────────────────────────────────────────────────
  const GAME_TEMPLATES = [
    { type: 'spin_wheel', name: 'Spin wheel', blurb: 'Classic weighted wheel. 3–24 slices, one spin per session.', icon: 'refresh', time: '~3 min setup' },
    { type: 'scratch_card', name: 'Scratch card', blurb: 'Grid of symbols with a foil reveal. Great for in-store QR.', icon: 'sparkle', time: '~4 min setup' },
    { type: 'pick_a_box', name: 'Pick a box', blurb: 'Customer picks 1 of N; server pre-seals the prize box.', icon: 'gift', time: '~3 min setup' },
    { type: 'quiz', name: 'Quiz', blurb: 'Branching questions. Answer quality decides the prize tier.', icon: 'list', time: '~10 min setup' },
    { type: 'survey', name: 'Survey', blurb: 'Text, rating, multi-choice. No prize, just signal.', icon: 'note', time: '~8 min setup' },
    { type: 'progress', name: 'Progress tracker', blurb: 'Visits 4/5 unlocks reward. Server-driven counter.', icon: 'target', time: '~5 min setup' },
  ];

  window.ScreenInteractive = function ScreenInteractive({ navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-.02em', color: P.ink }}>Interactive</h1>
            <p style={{ margin: '6px 0 0', maxWidth: 660, fontSize: 13.5, color: P.inkMute, lineHeight: 1.5 }}>
              Server-committed games with cannabis-safety validation, atomic stock, and a built-in fraud guard. Preview any renderer before you launch.
            </p>
          </div>
          <PBtn size="sm" variant="accent" icon="gamepad" onClick={() => navigate(`#/interactive/${D.INTERACTIVE[0].id}`)}>Preview spin wheel</PBtn>
        </div>

        <section>
          <MicroLabel>Active &amp; upcoming</MicroLabel>
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
            {D.INTERACTIVE.map((c) => {
              const awarded = c.prizes.reduce((a, p) => a + p.awarded, 0);
              return (
                <Card key={c.id} padding={20} style={{ cursor: 'pointer' }} onClick={() => navigate(`#/interactive/${c.id}`)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ height: 36, width: 36, borderRadius: 10, background: P.surface3, color: P.mode === 'dark' ? P.accent : P.accentBorder, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="gamepad" size={17} stroke={2} />
                      </span>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: P.ink }}>{c.name}</h3>
                        <p style={{ margin: 0, fontSize: 11.5, color: P.inkMute }}>{c.kind.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                    <HDPill tone={c.status === 'live' ? 'ok' : c.status === 'ended' ? 'neutral' : 'warn'} size="sm" label={c.status} />
                  </div>
                  <dl style={{ margin: '14px 0 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, borderTop: `1px solid ${P.hairline}`, paddingTop: 12 }}>
                    {[['Plays', HD.formatNumber(c.plays)], ['Players', HD.formatNumber(c.uniquePlayers)], ['Wins', HD.formatNumber(awarded)]].map(([l, v]) => (
                      <div key={l}>
                        <dt style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>{l}</dt>
                        <dd style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 600, fontFamily: P.fontMono, color: P.ink }}>{v}</dd>
                      </div>))}
                  </dl>
                </Card>);
            })}
          </div>
        </section>

        <section>
          <MicroLabel>Start from a template</MicroLabel>
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
            {GAME_TEMPLATES.map((t) => (
              <Card key={t.type} padding={20} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ height: 34, width: 34, borderRadius: 10, background: P.surface3, color: P.mode === 'dark' ? P.accent : P.accentBorder, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={t.icon} size={16} stroke={2} />
                  </span>
                  <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>{t.name}</h3>
                </div>
                <p style={{ margin: '12px 0 0', flex: 1, fontSize: 12.5, color: P.inkMute, lineHeight: 1.5 }}>{t.blurb}</p>
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11.5, color: P.inkMute }}>{t.time}</span>
                  <PBtn size="sm" variant="secondary">Start</PBtn>
                </div>
              </Card>))}
          </div>
        </section>
      </div>);
  };

  window.ScreenInteractiveDetail = function ScreenInteractiveDetail({ path, navigate }) {
    const P = useP(), HD = window.HD, D = window.ENGAGE_DATA;
    const id = path.split('/')[2];
    const c = D.INTERACTIVE.find((x) => x.id === id) || D.INTERACTIVE[0];
    const [spin, setSpin] = React.useState(0);
    const [result, setResult] = React.useState(null);
    const awarded = c.prizes.reduce((a, p) => a + p.awarded, 0);
    const hues = ['violet', 'teal', 'pink', 'green', 'blue'];

    function play() {
      if (c.prizes.length === 0) return;
      const total = c.prizes.reduce((a, p) => a + p.weight, 0);
      let r = Math.random() * total, idx = 0;
      for (let i = 0; i < c.prizes.length; i++) { r -= c.prizes[i].weight; if (r <= 0) { idx = i; break; } }
      const slice = 360 / c.prizes.length;
      setSpin((s) => s + 1080 + (360 - (idx * slice + slice / 2)));
      setResult(null);
      setTimeout(() => setResult(c.prizes[idx]), 2400);
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24 }}>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <button onClick={() => navigate('#/interactive')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', padding: 0, fontSize: 11.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
              <Icon name="arrow-left" size={12} stroke={2} />Interactive
            </button>
            <h1 style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>{c.name}</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13.5, color: P.inkMute }}>{c.kind.replace(/_/g, ' ')} · server-committed draws · fraud guard on</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HDPill tone={c.status === 'live' ? 'ok' : 'neutral'} size="sm" label={c.status} />
            <PBtn size="sm" variant="secondary" icon="pencil">Edit prizes</PBtn>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <StatTile hue="green" icon="gamepad" label="Plays" value={HD.formatNumber(c.plays)} />
          <StatTile hue="teal" icon="users" label="Unique players" value={HD.formatNumber(c.uniquePlayers)} />
          <StatTile hue="pink" icon="gift" label="Prizes awarded" value={HD.formatNumber(awarded)} />
          <StatTile hue="violet" icon="percent" label="Win rate" value={HD.formatPercent(c.winRate, 0)} />
        </div>

        <div className="hd-2col">
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <header style={{ padding: '12px 20px', borderBottom: `1px solid ${P.hairline2}` }}>
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: P.ink }}>Prize table</h2>
              <p style={{ margin: '2px 0 0', fontSize: 11.5, color: P.inkMute }}>Weights are relative; the server draws and commits before the animation resolves.</p>
            </header>
            {c.prizes.length === 0
              ? <p style={{ margin: 0, padding: 20, fontSize: 12.5, color: P.inkMute }}>No prizes configured yet — this campaign is a draft.</p>
              : <HDTable>
                <thead><tr><TH>Prize</TH><TH align="right">Weight</TH><TH align="right">Odds</TH><TH align="right">Awarded</TH></tr></thead>
                <tbody>
                  {c.prizes.map((p) => {
                    const total = c.prizes.reduce((a, x) => a + x.weight, 0);
                    return (
                      <TR key={p.label}>
                        <TD style={{ fontWeight: 500 }}>{p.label}</TD>
                        <TD align="right" mono>{p.weight}</TD>
                        <TD align="right" mono style={{ color: P.inkDim }}>{HD.formatPercent(p.weight / total, 1)}</TD>
                        <TD align="right" mono>{HD.formatNumber(p.awarded)}</TD>
                      </TR>);
                  })}
                </tbody>
              </HDTable>}
          </Card>

          <Card padding={20} style={{ textAlign: 'center' }}>
            <MicroLabel>Renderer preview</MicroLabel>
            <div style={{ margin: '16px auto 0', position: 'relative', width: 200, height: 200 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: 99, overflow: 'hidden', transform: `rotate(${spin}deg)`, transition: 'transform 2.2s cubic-bezier(.17,.67,.16,1)', border: `3px solid ${P.hairline2}`,
                background: c.prizes.length ? `conic-gradient(${c.prizes.map((p, i) => { const total = c.prizes.reduce((a, x) => a + x.weight, 0); const start = c.prizes.slice(0, i).reduce((a, x) => a + x.weight, 0) / total * 100; const end = start + (p.weight / total) * 100; return `${HD.hueColor(P, hues[i % hues.length])} ${start}% ${end}%`; }).join(', ')})` : P.surface3 }} />
              <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: `12px solid ${P.ink}` }} />
              <div style={{ position: 'absolute', inset: '38%', borderRadius: 99, background: P.surface, border: `2px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: P.inkMute }}>SPIN</div>
            </div>
            <div style={{ marginTop: 16, minHeight: 22, fontSize: 13.5, color: P.ink }}>
              {result ? <>You won <strong>{result.label}</strong></> : <span style={{ color: P.inkMute }}>server pre-commits the outcome</span>}
            </div>
            <PBtn size="sm" variant="accent" icon="play" style={{ marginTop: 12 }} disabled={c.prizes.length === 0} onClick={play}>Test spin</PBtn>
            <p style={{ margin: '14px 0 0', fontSize: 11.5, color: P.inkMute, lineHeight: 1.5 }}>
              Test plays are marked <code style={{ fontFamily: P.fontMono }}>is_test</code> and never draw from real prize stock.
            </p>
          </Card>
        </div>
      </div>);
  };
})();
