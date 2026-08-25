// ── RFID Direction C — the supervisor desktop ──────────────────────────────
// The SECOND surface. It never scans. It watches sessions the handheld
// produced, approves or rejects them, chases what the floor could not close,
// and owns the two decisions the floor is not allowed to make: rebinding an EPC
// and writing off a missing unit.
;(function () {
  const useP = window.useP;
  const HD = () => window.HD;
  const R = () => window.RFID;

  const mono = (P) => ({ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' });

  // Header card — caption strip over one aligned row of figures, hairline
  // dividers, exactly like the batch board header in HANDOFF §6.
  function SupHeader({ caption, live, cells, action }) {
    const P = useP();
    return (
      <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowSm, minWidth: 380, overflow: 'hidden' }}>
        <div style={{ background: P.surface2, borderBottom: `1px solid ${P.hairline}`, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>Currently shown</span>
          {live && <span style={{ width: 6, height: 6, borderRadius: 99, background: P.good, boxShadow: `0 0 0 3px ${P.good}33` }} />}
          <span style={{ fontSize: 11.5, color: P.inkDim, ...mono(P) }}>{caption}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', flexWrap: 'wrap' }}>
          {cells.map((c, i) => (
            <div key={i} style={{ padding: '11px 16px', borderLeft: i === 0 ? 'none' : `1px solid ${P.hairline}`, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>{c.label}</div>
              <div style={{ marginTop: 3, fontSize: 15, color: P.ink, ...(c.plain ? { fontFamily: P.fontSans, fontWeight: 600 } : mono(P)) }}>{c.value}</div>
            </div>))}
          <div style={{ flex: 1 }} />
          {action && <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px' }}>{action}</div>}
        </div>
      </div>);
  }

  function Section({ title, sub, right, children, pad = 0 }) {
    const P = useP();
    return (
      <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${P.hairline}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: P.ink }}>{title}</div>
            {sub && <div style={{ fontSize: 12, color: P.inkMute, marginTop: 2 }}>{sub}</div>}
          </div>
          <div style={{ flex: 1 }} />
          {right}
        </div>
        <div style={{ padding: pad }}>{children}</div>
      </div>);
  }

  // Selection is ink — never accent.
  function StateChip({ label, count, on, onClick, tone }) {
    const P = useP();
    const c = tone ? HD().tone(P, tone) : null;
    return (
      <button onClick={onClick} aria-pressed={on} style={{
        height: 30, padding: '0 11px', borderRadius: 99, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
        background: on ? P.ink : 'transparent', color: on ? P.surface : P.inkDim,
        border: `1px solid ${on ? P.ink : P.hairline2}`, fontFamily: P.fontSans, fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap',
      }}>
        {c && !on && <span style={{ width: 6, height: 6, borderRadius: 99, background: c.fg }} />}
        {label}
        {count != null && <span style={{ ...mono(P), fontSize: 11.5, fontWeight: 700, opacity: on ? .9 : .7 }}>{count}</span>}
      </button>);
  }

  function ActionBar({ children }) {
    const P = useP();
    return (
      <div style={{ position: 'sticky', bottom: 0, zIndex: 5, marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowMd }}>
        {children}
      </div>);
  }

  // Small "from the handheld" provenance tag — the thing that makes the two
  // surfaces legibly one system.
  function FromDevice({ who, when, device }) {
    const P = useP();
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 9px', borderRadius: 99, background: P.surface3, color: P.inkDim, fontSize: 11.5 }}>
        <Icon name="smartphone" size={12} stroke={1.9} />
        <span style={mono(P)}>{device}</span>
        <span style={{ color: P.inkFaint }}>·</span>
        <span>{who}</span>
        <span style={{ color: P.inkFaint }}>·</span>
        <span style={mono(P)}>{when}</span>
      </span>);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // KIT VERIFICATION — supervisor
  // ═══════════════════════════════════════════════════════════════════════════
  window.SupKit = function SupKit() {
    const P = useP(), S = R().KIT_SUMMARY, K = R().KIT;
    const [filter, setFilter] = React.useState('flagged');
    const all = R().LINES;
    const shown = filter === 'all' ? all : filter === 'flagged' ? all.filter((l) => l.state !== 'correct') : all.filter((l) => l.state === filter);
    const count = (st) => all.filter((l) => l.state === st).length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SupHeader live caption={`${K.id} · 5 boxes · gate ${K.gate} dBm · power ${K.power} dBm`}
          cells={[
            { label: 'Kit', value: K.id },
            { label: 'Boxes', value: '5' },
            { label: 'Planned', value: S.planned },
            { label: 'Assigned', value: S.assigned },
            { label: 'Verdict', value: <window.HDPill tone="warn" label="Review" />, plain: true },
          ]}
          action={<div style={{ display: 'flex', gap: 8 }}>
            <window.PBtn variant="secondary" size="sm" icon="sliders">Confidence gate</window.PBtn>
            <window.PBtn variant="secondary" size="sm" icon="download">Export</window.PBtn>
          </div>} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 12 }}>
          <window.StatTile icon="check-circle" label="Correct lines" value={S.correct} hue="ok" sub="planned qty met exactly" />
          <window.StatTile icon="arrow-down" label="Short lines" value={S.short} hue="blocked" sub="box needs more of a SKU" />
          <window.StatTile icon="arrow-up" label="Excess lines" value={S.excess} hue="warn" sub="box has too many" />
          <window.StatTile icon="ban" label="Wrong product" value={S.wrong} hue="quarantine" sub="SKU not planned for that box" />
          <window.StatTile icon="refresh" label="Rescan" value={S.rescan} hue="info" sub={`below ${K.gate} dBm — no location`} />
        </div>

        <div className="rfid-2col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 380px', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <Section title="Reconciliation lines" sub="One line per box × SKU. Delta is actual minus planned."
              right={<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <StateChip label="Flagged" count={S.short + S.excess + S.wrong} on={filter === 'flagged'} onClick={() => setFilter('flagged')} />
                <StateChip label="Short" count={count('short')} tone="blocked" on={filter === 'short'} onClick={() => setFilter('short')} />
                <StateChip label="Excess" count={count('excess')} tone="warn" on={filter === 'excess'} onClick={() => setFilter('excess')} />
                <StateChip label="Wrong" count={count('wrong')} tone="quarantine" on={filter === 'wrong'} onClick={() => setFilter('wrong')} />
                <StateChip label="All" count={all.length} on={filter === 'all'} onClick={() => setFilter('all')} />
              </div>}>
              <window.HDTable>
                <thead><tr>
                  <window.TH width={64}>Box</window.TH>
                  <window.TH>Product</window.TH>
                  <window.TH>SKU</window.TH>
                  <window.TH align="right" width={84}>Planned</window.TH>
                  <window.TH align="right" width={78}>Actual</window.TH>
                  <window.TH align="right" width={74}>Delta</window.TH>
                  <window.TH width={132}>State</window.TH>
                </tr></thead>
                <tbody>
                  {shown.map((l, i) => {
                    const s = R().skuOf(l.sku);
                    const c = HD().tone(P, R().STATE_TONE[l.state]);
                    return (
                      <window.TR key={i}>
                        <window.TD mono>{l.boxIndex}</window.TD>
                        <window.TD>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <window.CatDot cat={s.cat} size={26} label={s.sku.slice(0, 3)} />
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: 'block', color: P.ink }}>{s.name}</span>
                              <span style={{ display: 'block', fontSize: 11.5, color: P.inkMute }}>{s.brand}</span>
                            </span>
                          </div>
                        </window.TD>
                        <window.TD mono style={{ color: P.inkDim, fontSize: 12 }}>{l.sku}</window.TD>
                        <window.TD mono align="right">{l.planned}</window.TD>
                        <window.TD mono align="right">{l.actual}</window.TD>
                        <window.TD mono align="right" style={{ color: l.delta === 0 ? P.inkMute : c.fg, fontWeight: 600 }}>{l.delta > 0 ? '+' : ''}{l.delta}</window.TD>
                        <window.TD><window.HDPill size="sm" tone={R().STATE_TONE[l.state]} label={R().STATE_LABEL[l.state]} /></window.TD>
                      </window.TR>);
                  })}
                </tbody>
              </window.HDTable>
              {shown.length === 0 && <window.EmptyState compact icon="check-circle" title="Nothing flagged" body="Every line in this filter matched the plan exactly." />}
            </Section>

            <Section title="Per-box scan telemetry" sub="One TC22R exists, so boxes are read in sequence — the operator column shows the handoff.">
              <window.HDTable>
                <thead><tr>
                  <window.TH width={56}>Box</window.TH>
                  <window.TH align="right">Assigned</window.TH>
                  <window.TH align="right">Raw reads</window.TH>
                  <window.TH align="right">Bleed rejected</window.TH>
                  <window.TH align="right">Avg RSSI</window.TH>
                  <window.TH align="right">Read for</window.TH>
                  <window.TH>Operator</window.TH>
                  <window.TH align="right">Locked</window.TH>
                </tr></thead>
                <tbody>
                  {R().BOXES.map((b) => (
                    <window.TR key={b.i}>
                      <window.TD mono>{b.i}</window.TD>
                      <window.TD mono align="right">{b.unique}</window.TD>
                      <window.TD mono align="right" style={{ color: P.inkDim }}>{b.reads}</window.TD>
                      <window.TD mono align="right" style={{ color: P.inkDim }}>{b.bleedRejected}</window.TD>
                      <window.TD mono align="right">{b.avgRssi}</window.TD>
                      <window.TD mono align="right">{R().fmtDur(b.seconds)}</window.TD>
                      <window.TD>{b.operator}</window.TD>
                      <window.TD mono align="right" style={{ color: P.inkDim }}>{R().fmtClock(b.at)}</window.TD>
                    </window.TR>))}
                </tbody>
              </window.HDTable>
              <div style={{ padding: '10px 16px', borderTop: `1px solid ${P.hairline}`, fontSize: 12, color: P.inkMute, lineHeight: 1.5 }}>
                <b style={{ color: P.ink2, fontWeight: 600 }}>{S.phantomUnitsAvoided} reads</b> were neighbour bleed and were not counted.
                Counting every tag in every box it was heard in would have invented that much phantom
                overage. Telemetry only — nothing acts on this number.
              </div>
            </Section>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <Section title="Pull list" sub="Grouped by source box — the same list the operator is holding."
              right={<FromDevice who="M. Delgado" when={R().fmtClock(R().NOW - 4 * 60000)} device="TC22R-01" />}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {R().MOVE_GROUPS.map((g) => (
                  <div key={g.fromBox}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>Pull from Box {g.fromBox}</span>
                      <span style={{ flex: 1 }} />
                      <span style={{ ...mono(P), fontSize: 11.5, color: P.inkMute }}>{g.totalUnits} units</span>
                    </div>
                    {g.items.map((it, i) => {
                      const s = R().skuOf(it.sku);
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: `1px solid ${P.hairline}` }}>
                          <window.CatDot cat={s.cat} size={28} label={s.sku.slice(0, 3)} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: P.ink }}><span style={mono(P)}>{it.qty}×</span> {s.name}</div>
                            <div style={{ fontSize: 11.5, color: P.inkMute, ...mono(P) }}>{it.sku}</div>
                          </div>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, ...mono(P), fontSize: 12.5, color: P.ink2 }}>
                            <Icon name="arrow-right" size={13} stroke={2} color={P.inkMute} />Box {it.toBox}
                          </span>
                        </div>);
                    })}
                  </div>))}
              </div>
            </Section>

            <Section title="Moving won’t fix these" sub="No box holds a surplus of the SKU that is short, and nothing needs the SKU in surplus.">
              <div>
                {R().UNRESOLVED.map((u, i) => {
                  const s = R().skuOf(u.sku), t = HD().tone(P, u.kind === 'shortfall' ? 'blocked' : 'warn');
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: i === R().UNRESOLVED.length - 1 ? 'none' : `1px solid ${P.hairline}` }}>
                      <span style={{ width: 28, height: 28, borderRadius: P.r8, background: t.bg, color: t.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                        <Icon name={u.kind === 'shortfall' ? 'arrow-down' : 'arrow-up'} size={14} stroke={2.2} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: P.ink }}><span style={mono(P)}>{u.qty}×</span> {s.name}</div>
                        <div style={{ fontSize: 11.5, color: P.inkMute }}>Box {u.boxIndex} · kit {u.kind}</div>
                      </div>
                      <window.HDPill size="sm" tone={u.kind === 'shortfall' ? 'blocked' : 'warn'} label={u.kind === 'shortfall' ? 'Shortfall' : 'Overage'} />
                    </div>);
                })}
              </div>
            </Section>

            <Section title="Rescan queue" sub={`Strongest read below ${K.gate} dBm. No box asserted, no move emitted.`}>
              <div>
                {R().RESCAN.map((t) => {
                  const s = R().skuOf(t.sku);
                  return (
                    <div key={t.epc} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: `1px solid ${P.hairline}` }}>
                      <window.CatDot cat={s.cat} size={28} label={s.sku.slice(0, 3)} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: P.ink }}>{s.name}</div>
                        <div style={{ fontSize: 11.5, color: P.inkMute, ...mono(P) }}>{R().shortEpc(t.epc)}</div>
                      </div>
                      <span style={{ ...mono(P), fontSize: 13, color: HD().tone(P, 'info').fg }}>{t.bestRssi}</span>
                    </div>);
                })}
                {R().UNKNOWN_EPCS.map((t) => (
                  <div key={t.epc} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <span style={{ width: 28, height: 28, borderRadius: P.r8, background: P.surface3, color: P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="help" size={14} stroke={2} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: P.ink }}>Unregistered EPC</div>
                      <div style={{ fontSize: 11.5, color: P.inkMute, ...mono(P) }}>{R().shortEpc(t.epc)}</div>
                    </div>
                    <window.PBtn variant="ghost" size="xs">Look up</window.PBtn>
                  </div>))}
              </div>
            </Section>

            <Section title="Floor right now" sub="Two operators, one reader.">
              <div>
                {R().OPERATORS.map((o) => (
                  <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: `1px solid ${P.hairline}` }}>
                    <window.Avatar name={o.name} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: P.ink }}>{o.name}</div>
                      <div style={{ fontSize: 11.5, color: P.inkMute }}>{o.task}</div>
                    </div>
                    <span style={{ ...mono(P), fontSize: 11.5, color: P.inkDim }}>{o.device}</span>
                  </div>))}
                {R().DEVICES.map((d) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px' }}>
                    <span style={{ width: 30, height: 30, borderRadius: P.r8, background: P.surface3, color: P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="smartphone" size={15} stroke={1.9} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: P.ink }}>{d.model}</div>
                      <div style={{ fontSize: 11.5, color: P.inkMute, ...mono(P) }}>fw {d.firmware} · {d.rf} dBm</div>
                    </div>
                    <div style={{ width: 76 }}><window.BarMeter value={d.battery} showLabel color={d.battery < .2 ? P.bad : P.ink} /></div>
                  </div>))}
              </div>
            </Section>
          </div>
        </div>

        <ActionBar>
          <span style={{ fontSize: 12.5, color: P.inkDim }}>
            Approving posts {S.assigned} assigned units and closes {R().MOVE_GROUPS.length} pull groups.
            The two unresolved lines stay open as a kit exception.
          </span>
          <span style={{ flex: 1 }} />
          <window.PBtn variant="ghost" size="sm">Reject &amp; re-scan kit</window.PBtn>
          <window.PBtn variant="secondary" size="sm" icon="send">Request rescan of 2 tags</window.PBtn>
          <window.PBtn variant="accent" size="md" icon="check-circle"
            onClick={() => window.hdToast?.({ title: 'Kit approved', description: `${K.id} posted · 2 exceptions carried forward.`, tone: 'ok' })}>Approve kit</window.PBtn>
        </ActionBar>
      </div>);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CYCLE COUNT — supervisor
  // ═══════════════════════════════════════════════════════════════════════════
  window.SupCount = function SupCount() {
    const P = useP();
    const rooms = R().ROOMS;
    const [sel, setSel] = React.useState(rooms[0].id);
    const room = rooms.find((r) => r.id === sel);
    const totalExpected = rooms.reduce((n, r) => n + r.expected, 0);
    const totalFound = rooms.reduce((n, r) => n + r.found, 0);
    const avg = (totalFound / totalExpected) * 100;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SupHeader live caption="Cycle count · today · dedupe by EPC · PASS bar 98.0%"
          cells={[
            { label: 'Rooms counted', value: rooms.length },
            { label: 'Expected', value: totalExpected },
            { label: 'Located', value: totalFound },
            { label: 'Coverage', value: avg.toFixed(2) + '%' },
            { label: 'Verdict', value: <window.HDPill tone={avg >= 98 ? 'ok' : 'warn'} label={avg >= 98 ? 'Pass' : 'Review'} />, plain: true },
          ]}
          action={<window.PBtn variant="secondary" size="sm" icon="calendar">Schedule count</window.PBtn>} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
          <window.StatTile icon="grid" label="Rooms at pass" value={rooms.filter((r) => r.verdict === 'PASS').length + ' / ' + rooms.length} hue="ok" sub="coverage ≥ 98.0%" />
          <window.StatTile icon="target" label="Stragglers open" value={rooms.reduce((n, r) => n + (r.expected - r.found), 0)} hue="warn" sub="awaiting a second pass" />
          <window.StatTile icon="clock" label="Floor time" value={rooms.reduce((n, r) => n + r.minutes, 0) + 'm'} hue="info" sub="across all rooms today" />
          <window.StatTile icon="smartphone" label="Readers" value="1" hue="blocked" sub="multi-operator dedupe unvalidated" />
        </div>

        <div className="rfid-2col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 380px', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <Section title="Rooms" sub="Click a room to load its stragglers.">
              <window.HDTable>
                <thead><tr>
                  <window.TH>Room</window.TH>
                  <window.TH align="right" width={90}>Expected</window.TH>
                  <window.TH align="right" width={84}>Located</window.TH>
                  <window.TH width={170}>Coverage</window.TH>
                  <window.TH width={104}>Verdict</window.TH>
                  <window.TH>Operator</window.TH>
                  <window.TH align="right" width={92}>Finished</window.TH>
                </tr></thead>
                <tbody>
                  {rooms.map((r) => (
                    <window.TR key={r.id} onClick={() => setSel(r.id)} style={r.id === sel ? { background: P.surface2 } : undefined}>
                      <window.TD>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {r.id === sel && <span style={{ width: 3, height: 18, borderRadius: 99, background: P.ink }} />}
                          <span>
                            <span style={{ display: 'block', color: P.ink }}>{r.name}</span>
                            <span style={{ display: 'block', fontSize: 11.5, color: P.inkMute, ...mono(P) }}>{r.id}</span>
                          </span>
                        </div>
                      </window.TD>
                      <window.TD mono align="right">{r.expected}</window.TD>
                      <window.TD mono align="right">{r.found}</window.TD>
                      <window.TD><window.BarMeter value={r.coverage} max={100} showLabel color={r.verdict === 'PASS' ? P.good : P.warn} /></window.TD>
                      <window.TD><window.HDPill size="sm" tone={r.verdict === 'PASS' ? 'ok' : 'warn'} label={r.verdict === 'PASS' ? 'Pass' : 'Review'} /></window.TD>
                      <window.TD>{r.operator}</window.TD>
                      <window.TD mono align="right" style={{ color: P.inkDim }}>{R().fmtClock(r.at)}</window.TD>
                    </window.TR>))}
                </tbody>
              </window.HDTable>
            </Section>

            <Section title={`Stragglers · ${room.name}`} sub="Not located this pass. Cause is inferred from the tag's last known position and material."
              right={<FromDevice who={room.operator} when={R().fmtClock(room.at)} device="TC22R-01" />}>
              <window.HDTable>
                <thead><tr>
                  <window.TH>Product</window.TH>
                  <window.TH>EPC</window.TH>
                  <window.TH width={88}>Shelf</window.TH>
                  <window.TH>Likely cause</window.TH>
                  <window.TH align="right" width={112}>Last seen</window.TH>
                </tr></thead>
                <tbody>
                  {R().STRAGGLERS.map((s) => (
                    <window.TR key={s.epc}>
                      <window.TD>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <window.CatDot cat={s.cat} size={26} label={s.sku.slice(0, 3)} />
                          <span>
                            <span style={{ display: 'block', color: P.ink }}>{s.name}</span>
                            <span style={{ display: 'block', fontSize: 11.5, color: P.inkMute }}>{s.brand}</span>
                          </span>
                        </div>
                      </window.TD>
                      <window.TD mono style={{ color: P.inkDim, fontSize: 12 }}>{R().shortEpc(s.epc)}</window.TD>
                      <window.TD mono>{s.shelf}</window.TD>
                      <window.TD style={{ color: P.inkDim }}>{s.cause}</window.TD>
                      <window.TD mono align="right" style={{ color: P.inkDim }}>{HD().relativeTime(new Date(s.lastSeen).toISOString(), R().NOW)}</window.TD>
                    </window.TR>))}
                </tbody>
              </window.HDTable>
            </Section>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <Section title="What a PASS does not mean" pad={16}>
              <div style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.6 }}>
                98% coverage clears the room for trading, not for writing anything off. Every
                straggler stays on the books until a second pass finds it or a supervisor closes it
                as missing — which is a person's decision, made here, never on the handheld.
              </div>
            </Section>

            <Section title="Cause mix" sub="Across all open stragglers." pad={16}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Foil-lined pouch', 'Stacked dense', 'Behind metal shelf', 'Mylar overwrap'].map((c) => {
                  const n = R().STRAGGLERS.filter((s) => s.cause === c).length;
                  return (
                    <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 132, fontSize: 12.5, color: P.ink2 }}>{c}</span>
                      <div style={{ flex: 1 }}><window.BarMeter value={n} max={R().STRAGGLERS.length} color={P.ink} /></div>
                      <span style={{ ...mono(P), fontSize: 12.5, color: P.ink, width: 20, textAlign: 'right' }}>{n}</span>
                    </div>);
                })}
                <div style={{ fontSize: 12, color: P.inkMute, lineHeight: 1.5, marginTop: 2 }}>
                  No on-metal label stock was purchased. Anything reading as a metal problem is a
                  procurement answer, not a scanning one.
                </div>
              </div>
            </Section>

            <Section title="Reader" pad={16}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 34, height: 34, borderRadius: P.r8, background: P.surface3, color: P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="smartphone" size={17} stroke={1.9} /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: P.ink }}>{R().DEVICES[0].model}</div>
                  <div style={{ fontSize: 11.5, color: P.inkMute, ...mono(P) }}>{R().DEVICES[0].id} · in use</div>
                </div>
                <div style={{ width: 76 }}><window.BarMeter value={R().DEVICES[0].battery} showLabel /></div>
              </div>
            </Section>
          </div>
        </div>

        <ActionBar>
          <span style={{ fontSize: 12.5, color: P.inkDim }}>
            A second pass re-walks only {room.name} and only the {room.expected - room.found} open tags.
          </span>
          <span style={{ flex: 1 }} />
          <window.PBtn variant="ghost" size="sm">Close as missing…</window.PBtn>
          <window.PBtn variant="secondary" size="sm" icon="download">Export stragglers</window.PBtn>
          <window.PBtn variant="accent" size="md" icon="send"
            onClick={() => window.hdToast?.({ title: 'Second pass dispatched', description: `${room.name} · ${room.expected - room.found} tags queued to TC22R-01.`, tone: 'info' })}>Dispatch second pass</window.PBtn>
        </ActionBar>
      </div>);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // TAG COMMISSIONING — supervisor
  // ═══════════════════════════════════════════════════════════════════════════
  window.SupTags = function SupTags() {
    const P = useP(), RUN = R().RUN, PR = R().PRINTER, C = R().COLLISION, INV = R().TAG_INVENTORY;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SupHeader live caption={`${PR.id} · ${PR.stock} · closed-loop 96-bit EPC (not SGTIN-96)`}
          cells={[
            { label: 'Active run', value: RUN.id },
            { label: 'Printed', value: `${RUN.printed} / ${RUN.qty}` },
            { label: 'Verified', value: RUN.verified },
            { label: 'Voided', value: RUN.voided },
            { label: 'Collisions', value: <window.HDPill tone="blocked" label="1 held" />, plain: true },
          ]}
          action={<window.PBtn variant="secondary" size="sm" icon="printer">Printer settings</window.PBtn>} />

        <div style={{ padding: '11px 14px', background: HD().tone(P, 'warn').bg, border: `1px solid ${HD().tone(P, 'warn').fg}44`, borderRadius: P.r12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="alert" size={17} stroke={2} color={HD().tone(P, 'warn').fg} />
          <span style={{ fontSize: 12.5, color: P.ink2, lineHeight: 1.45 }}>
            <b style={{ fontWeight: 600 }}>ZPL template unverified on hardware.</b> Print one label on the
            real Glint stock and read it back before any production run. Until then, treat this run's
            yield figures as provisional.
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
          <window.StatTile icon="tag" label="Labels purchased" value={INV.purchased} hue="info" sub="Vulcan Glint · paper only" />
          <window.StatTile icon="check-circle" label="Commissioned" value={INV.commissioned} hue="ok" sub="EPC ↔ retail ID bound 1:1" />
          <window.StatTile icon="package" label="Remaining" value={INV.remaining} hue="warn" sub={`≈ ${INV.kitsRemaining} kits of stock left`} />
          <window.StatTile icon="ban" label="Collisions today" value={RUN.collisions} hue="blocked" sub="hard 409 · never overwritten" />
        </div>

        <div className="rfid-2col" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 380px', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <Section title="Print runs" sub="Each run mints EPCs and creates bindings. Replays return the stored result.">
              <window.HDTable>
                <thead><tr>
                  <window.TH>Run</window.TH>
                  <window.TH>SKU</window.TH>
                  <window.TH align="right" width={70}>Qty</window.TH>
                  <window.TH align="right" width={78}>Done</window.TH>
                  <window.TH width={150}>Progress</window.TH>
                  <window.TH align="right" width={92}>Collisions</window.TH>
                  <window.TH width={104}>State</window.TH>
                </tr></thead>
                <tbody>
                  {R().RECENT_RUNS.map((r) => {
                    const s = R().skuOf(r.sku);
                    return (
                      <window.TR key={r.id}>
                        <window.TD mono>{r.id}</window.TD>
                        <window.TD>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <window.CatDot cat={s.cat} size={26} label={s.sku.slice(0, 3)} />
                            <span>
                              <span style={{ display: 'block', color: P.ink }}>{s.name}</span>
                              <span style={{ display: 'block', fontSize: 11.5, color: P.inkMute, ...mono(P) }}>{r.sku}</span>
                            </span>
                          </div>
                        </window.TD>
                        <window.TD mono align="right">{r.qty}</window.TD>
                        <window.TD mono align="right">{r.done}</window.TD>
                        <window.TD><window.BarMeter value={r.done} max={r.qty} showLabel color={r.state === 'running' ? P.info : P.ink} /></window.TD>
                        <window.TD mono align="right" style={{ color: r.collisions ? HD().tone(P, 'blocked').fg : P.inkMute }}>{r.collisions}</window.TD>
                        <window.TD><window.HDPill size="sm" tone={r.state === 'running' ? 'info' : 'ok'} label={r.state === 'running' ? 'Running' : 'Complete'} /></window.TD>
                      </window.TR>);
                  })}
                </tbody>
              </window.HDTable>
            </Section>

            <Section title="Collision — binding refused" sub="A retail ID may hold exactly one EPC, for its whole life."
              right={<FromDevice who={RUN.operator} when={R().fmtClock(R().NOW - 3 * 60000)} device="TC22R-01" />}>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 1fr', alignItems: 'center', gap: 12 }}>
                  <div style={{ padding: '12px 14px', borderRadius: P.r12, background: HD().tone(P, 'blocked').bg, border: `1px solid ${HD().tone(P, 'blocked').fg}44` }}>
                    <window.MicroLabel>Incoming EPC · rejected</window.MicroLabel>
                    <div style={{ marginTop: 4, ...mono(P), fontSize: 13, color: P.ink, wordBreak: 'break-all' }}>{C.incomingEpc}</div>
                    <div style={{ marginTop: 6 }}><window.HDPill size="sm" tone="blocked" label={C.status} /></div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.inkMute }}><Icon name="x" size={20} stroke={2.4} /></div>
                  <div style={{ padding: '12px 14px', borderRadius: P.r12, background: HD().tone(P, 'ok').bg, border: `1px solid ${HD().tone(P, 'ok').fg}44` }}>
                    <window.MicroLabel>Already bound · live</window.MicroLabel>
                    <div style={{ marginTop: 4, ...mono(P), fontSize: 13, color: P.ink, wordBreak: 'break-all' }}>{C.boundEpc}</div>
                    <div style={{ marginTop: 6, fontSize: 11.5, color: P.inkDim }}>{new Date(C.boundAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {C.boundBy}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 }}>
                  <window.MetaCell label="Retail ID" value={C.retailId} mono />
                  <window.MetaCell label="Audit event" value={C.auditEventId} mono />
                  <window.MetaCell label="Resolution" value="Supervisor only" />
                </div>
              </div>
            </Section>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <Section title="Printer" sub={PR.id} pad={16}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <window.HDPill tone="ok" label="Online" />
                  <span style={{ flex: 1 }} />
                  <span style={{ ...mono(P), fontSize: 12, color: P.inkDim }}>{RUN.labelsPerMin} labels/min</span>
                </div>
                {[['Media remaining', PR.mediaRemaining], ['Ribbon remaining', PR.ribbonRemaining]].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 128, fontSize: 12.5, color: P.ink2 }}>{l}</span>
                    <div style={{ flex: 1 }}><window.BarMeter value={v} showLabel color={v < .2 ? P.warn : P.ink} /></div>
                  </div>))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 4 }}>
                  <window.MetaCell label="Darkness" value={PR.darkness} mono />
                  <window.MetaCell label="Speed" value={PR.speed + ' ips'} mono />
                  <window.MetaCell label="Head temp" value={PR.headTemp + '°C'} mono />
                  <window.MetaCell label="Calibrated" value={HD().relativeTime(new Date(PR.lastCalibration).toISOString(), R().NOW)} mono />
                </div>
              </div>
            </Section>

            <Section title="Where a binding is born" pad={16}>
              <div style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.6 }}>
                The 1:1 rule is enforced at commissioning rather than discovered at scan time. That is
                why a collision is a hard refusal with an audit event and not a warning: by the time a
                duplicated EPC reaches a kit scan, there is no honest way to say which physical unit
                it is.
              </div>
            </Section>
          </div>
        </div>

        <ActionBar>
          <span style={{ fontSize: 12.5, color: P.inkDim }}>
            Resolving writes an audit event either way — rebinding is never silent.
          </span>
          <span style={{ flex: 1 }} />
          <window.PBtn variant="ghost" size="sm">View audit trail</window.PBtn>
          <window.PBtn variant="secondary" size="sm">Void the label</window.PBtn>
          <window.PBtn variant="accent" size="md" icon="lock"
            onClick={() => window.hdToast?.({ title: 'Binding resolved', description: `${C.auditEventId} · retail ID kept its original EPC.`, tone: 'ok' })}>Resolve binding</window.PBtn>
        </ActionBar>
      </div>);
  };
})();
