// ── #/counts and #/counts/:id — cycle count (walk-scan of a room) ────────
;(function () {
  const useP = window.useP;

  window.ScreenCounts = function ScreenCounts({ navigate }) {
    const P = useP(), HD = window.HD, D = window.RFID_DATA;
    const [room, setRoom] = React.useState('all');
    const rooms = [...new Set(D.COUNTS.map((c) => c.room))];
    const rows = D.COUNTS.filter((c) => room === 'all' || c.room === room);
    const passRate = D.COUNTS.filter((c) => c.verdict === 'PASS').length / D.COUNTS.length;

    return (
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <RfidPageHead
          title="Cycle counts"
          sub="Walk-scan a room with the handheld. Reads dedupe by EPC across every pass, so overlap costs time and never accuracy. A count passes at 98% coverage."
          actions={<PBtn size="sm" variant="accent" icon="plus" onClick={() => window.hdToast && window.hdToast({ title: 'Pick a room', description: 'Expected inventory is read from Hyperdrive at session open.', tone: 'info' })}>Start cycle count</PBtn>} />

        <Callout tone="warn" icon="alert" title="One reader exists">
          Only a single Zebra TC22R was purchased. Multi-operator dedupe is designed and simulated, but it cannot be validated on hardware until a second unit lands — the passes below were walked sequentially by one person.
        </Callout>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <StatTile icon="scan" label="Counts (7 days)" value={String(D.COUNTS.length)} hue="blue" />
          <StatTile icon="check-circle" label="Pass rate" value={HD.formatPercent(passRate, 0)} hue={passRate >= 0.98 ? 'ok' : 'warn'} sub={`bar is ${HD.formatPercent(D.ROOM_PASS_COVERAGE, 0)} coverage`} />
          <StatTile icon="help" label="Open stragglers" value={String(D.COUNTS.reduce((n, c) => n + c.notLocated, 0))} hue="quarantine" sub="never seen by any pass" />
          <StatTile icon="package" label="Units walked" value={HD.formatNumber(D.COUNTS.reduce((n, c) => n + c.expected, 0))} hue="teal" />
        </div>

        <ChipFilter ariaLabel="Room" value={room} onChange={setRoom}
          options={[{ id: 'all', label: 'All rooms', count: D.COUNTS.length }].concat(rooms.map((r) => ({ id: r, label: r, count: D.COUNTS.filter((c) => c.room === r).length })))} />

        <Card padding={0}>
          <div style={{ overflowX: 'auto' }}>
            <HDTable>
              <thead><tr style={{ background: P.surface2 }}>
                <TH>Count</TH><TH>Room</TH><TH align="right">Expected</TH><TH align="right">Found</TH>
                <TH align="right">Not located</TH><TH width={190}>Coverage</TH><TH align="right">Passes</TH>
                <TH>Operator</TH><TH align="right">Finished</TH><TH>Verdict</TH>
              </tr></thead>
              <tbody>
                {rows.map((c) => (
                  <TR key={c.id} onClick={() => navigate(`#/counts/${c.id}`)}>
                    <TD mono>{c.id}</TD>
                    <TD>{c.room}</TD>
                    <TD align="right" mono>{HD.formatNumber(c.expected)}</TD>
                    <TD align="right" mono>{HD.formatNumber(c.uniqueFound)}</TD>
                    <TD align="right" mono style={{ color: c.notLocated ? HD.tone(P, 'blocked').fg : P.inkMute }}>{c.notLocated}</TD>
                    <TD><CoverageBar pct={c.coveragePct} /></TD>
                    <TD align="right" mono>{c.operators}</TD>
                    <TD>{c.operator}</TD>
                    <TD align="right" mono style={{ color: P.inkDim }}>{HD.relativeTime(c.finishedAt, D.NOW)}</TD>
                    <TD><HDPill size="sm" tone={c.verdict === 'PASS' ? 'ok' : 'warn'} label={c.verdict} /></TD>
                  </TR>))}
              </tbody>
            </HDTable>
          </div>
        </Card>
      </div>);
  };

  // Coverage meter with the 98% pass bar drawn on it. The threshold is the
  // whole point of the number, so it is never left implicit.
  function CoverageBar({ pct, height = 8, showValue = true }) {
    const P = useP(), HD = window.HD;
    const pass = window.RFID_DATA.ROOM_PASS_COVERAGE * 100;
    const c = HD.tone(P, pct >= pass ? 'ok' : 'warn');
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 60, height, background: P.surface3, borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: c.fg, borderRadius: 99 }} />
          <div aria-hidden="true" title={`${pass}% pass bar`} style={{ position: 'absolute', top: -1, bottom: -1, left: `${pass}%`, width: 2, background: P.ink }} />
        </div>
        {showValue && <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', fontSize: 12.5, color: P.ink, minWidth: 46, textAlign: 'right' }}>{pct.toFixed(1)}%</span>}
      </div>);
  }

  window.ScreenCountDetail = function ScreenCountDetail({ navigate, countId }) {
    const P = useP(), HD = window.HD, D = window.RFID_DATA;
    const c = D.COUNTS.find((x) => x.id === countId);
    const [queued, setQueued] = React.useState(false);
    if (!c) {
      return <div style={{ padding: 20 }}><EmptyState icon="scan" title="No such count" body="That cycle count is not in the last seven days." action={<PBtn size="sm" variant="secondary" onClick={() => navigate('#/counts')}>Back to cycle counts</PBtn>} /></div>;
    }
    const pass = c.verdict === 'PASS';
    let cum = 0;
    const passRows = c.passes.map((p) => { cum += p.newlySeen; return { ...p, cum, cumPct: cum / c.expected * 100 }; });

    return (
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <RfidPageHead
          back={{ label: 'Cycle counts', onClick: () => navigate('#/counts') }}
          title={{ text: c.id, mono: true }}
          sub={`${c.room} · walked by ${c.operator} on ${c.device}`}
          meta={<React.Fragment>
            <HDPill tone={pass ? 'ok' : 'warn'} label={c.verdict} />
            <HDPill tone="neutral" icon={false} label={`${c.operators} passes`} />
            <HDPill tone="neutral" icon={false} label={`${c.device} @ ${c.rfPower} dBm`} />
            <span style={{ fontSize: 12.5, color: P.inkMute }}>finished {HD.relativeTime(c.finishedAt, D.NOW)}</span>
          </React.Fragment>}
          actions={<PBtn size="sm" variant="accent" icon="scan" disabled={!c.stragglers.length || queued}
            onClick={() => { setQueued(true); window.hdToast && window.hdToast({ title: 'Second pass queued', description: `${c.stragglers.length} stragglers pushed to ${c.device}.`, tone: 'ok' }); }}>
            {queued ? '2nd pass queued' : 'Queue 2nd pass'}
          </PBtn>} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))', gap: 12 }}>
          <StatTile icon="package" label="Expected" value={HD.formatNumber(c.expected)} hue="blue" />
          <StatTile icon="check-circle" label="Found" value={HD.formatNumber(c.uniqueFound)} hue="ok" sub="unique EPCs, deduped" />
          <StatTile icon="help" label="Not located" value={String(c.notLocated)} hue={c.notLocated ? 'blocked' : 'ok'} />
          <StatTile icon="gauge" label="Coverage" value={`${c.coveragePct.toFixed(1)}%`} hue={pass ? 'ok' : 'warn'} progress={c.coveragePct / 100} sub={`pass bar ${(D.ROOM_PASS_COVERAGE * 100).toFixed(0)}%`} />
          <StatTile icon="flag" label="Verdict" value={c.verdict} hue={pass ? 'ok' : 'warn'} />
          <StatTile icon="users" label="Passes" value={String(c.operators)} hue="teal" sub="deduped by EPC" />
        </div>

        <div className="hd-2col">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            <Card>
              <CardHead title="Coverage by pass" sub="Each pass only ever adds. Overlap between passes costs walking time, never accuracy — the same EPC read twice is one unit." />
              <div style={{ marginBottom: 16 }}><CoverageBar pct={c.coveragePct} height={12} /></div>
              <div style={{ overflowX: 'auto' }}>
                <HDTable>
                  <thead><tr style={{ background: P.surface2 }}>
                    <TH width={72}>Pass</TH><TH align="right">Reads</TH><TH align="right">Newly seen</TH>
                    <TH align="right">Cumulative</TH><TH width={180}>Coverage after</TH>
                  </tr></thead>
                  <tbody>
                    {passRows.map((p) => (
                      <TR key={p.n}>
                        <TD mono>#{p.n}</TD>
                        <TD align="right" mono>{HD.formatNumber(p.reads)}</TD>
                        <TD align="right" mono style={{ color: p.newlySeen > 0 ? P.ink : P.inkMute }}>+{p.newlySeen}</TD>
                        <TD align="right" mono>{HD.formatNumber(p.cum)}</TD>
                        <TD><CoverageBar pct={p.cumPct} /></TD>
                      </TR>))}
                  </tbody>
                </HDTable>
              </div>
              <div style={{ marginTop: 12, fontSize: 12.5, color: P.inkDim, lineHeight: 1.5 }}>
                The last pass added <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{passRows[passRows.length - 1].newlySeen}</span> units.
                {passRows[passRows.length - 1].newlySeen / c.expected < 0.03
                  ? ' Returns have flattened — another identical pass will not find the rest. What is left needs a close-range hunt, not more walking.'
                  : ' Returns are still climbing; one more pass is worth walking.'}
              </div>
            </Card>

            <Card padding={0}>
              <div style={{ padding: '16px 16px 12px' }}>
                <CardHead title="Stragglers — send a 2nd pass"
                  sub={c.stragglers.length ? 'Never seen by any pass. Typically stacked dense, behind foil, or sitting inside a metal cage.' : undefined}
                  right={c.stragglers.length ? <HDPill size="sm" tone="blocked" icon={false} label={`${c.stragglers.length} units`} /> : undefined} />
              </div>
              {c.stragglers.length === 0
                ? <EmptyState compact icon="check-circle" title="Everything on the list was found." body="100% coverage. No second pass needed." />
                : <React.Fragment>
                  <div style={{ overflowX: 'auto' }}>
                    <HDTable>
                      <thead><tr style={{ background: P.surface2 }}>
                        <TH>EPC</TH><TH>SKU</TH><TH>Tag material</TH><TH align="right">Last seen</TH>
                      </tr></thead>
                      <tbody>
                        {c.stragglers.map((s) => (
                          <TR key={s.epc}>
                            <TD><EpcChip value={s.epc} /></TD>
                            <TD><SkuToken sku={s.sku} withName /></TD>
                            <TD><HDPill size="sm" tone="neutral" icon={false} label={s.material} /></TD>
                            <TD align="right" mono style={{ color: P.inkDim }}>{HD.relativeTime(s.lastSeen, D.NOW)}</TD>
                          </TR>))}
                      </tbody>
                    </HDTable>
                  </div>
                  <div style={{ padding: '12px 16px 16px' }}>
                    <Callout tone="warn" icon="alert" title="Every tag in this estate is paper">
                      No on-metal stock was purchased. Straggler logic reads a <span style={{ fontFamily: P.fontMono }}>tag_material</span> column that only ever holds <span style={{ fontFamily: P.fontMono }}>paper</span> today — treat on-metal as unsupported, not as a setting.
                    </Callout>
                  </div>
                </React.Fragment>}
            </Card>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            <Card>
              <CardHead title="Count" />
              <KV label="Room" value={c.room} mono={false} />
              <KV label="Operator" value={c.operator} mono={false} />
              <KV label="Reader" value={c.device} />
              <KV label="RF power" value={`${c.rfPower} dBm`} />
              <KV label="Started" value={HD.formatDateTime(c.startedAt)} />
              <KV label="Finished" value={HD.formatDateTime(c.finishedAt)} />
              <KV label="Pass bar" value={`${(D.ROOM_PASS_COVERAGE * 100).toFixed(0)}%`} />
              <KV label="Verdict" value={c.verdict} tone={HD.tone(P, pass ? 'ok' : 'warn').fg} />
            </Card>

            <Card>
              <CardHead title="How this count works" />
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: P.inkDim, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <li>Hyperdrive hands the session the list of EPCs it expects to be in this room.</li>
                <li>Every pass streams reads in. They are deduped by EPC, so a unit read forty times is still one unit.</li>
                <li>Coverage is unique found ÷ expected. At or above <span style={{ fontFamily: P.fontMono, color: P.ink }}>98%</span> the count is a PASS.</li>
                <li>Anything never seen becomes a straggler and goes out as a targeted second pass — not a re-walk of the whole room.</li>
              </ol>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${P.hairline}`, fontSize: 12.5, color: P.inkMute, lineHeight: 1.5 }}>
                Unlike kit verification, a cycle count asserts no location — it answers "is this unit in this room", so there is no argmax and no confidence gate here.
              </div>
            </Card>
          </div>
        </div>
      </div>);
  };
})();
