// ── #/counts and #/counts/:id — cycle count (walk-scan of a room) ────────
// A cycle count asserts no location — it answers "is this unit in this room" —
// so there is no argmax and no confidence gate here. What there is instead is
// the one decision the floor may not make: closing a straggler as missing.
;(function () {
  const useP = window.useP;

  window.ScreenCounts = function ScreenCounts({ navigate }) {
    const P = useP(), HD = window.HD, D = window.RFID_DATA;
    const dec = window.useDecisions();
    const [room, setRoom] = React.useState('all');
    const rooms = [...new Set(D.COUNTS.map((c) => c.room))];
    const rows = D.COUNTS.filter((c) => room === 'all' || c.room === room);
    const passRate = D.COUNTS.filter((c) => c.verdict === 'PASS').length / D.COUNTS.length;
    const closed = Object.keys(dec.stragglersClosed).length;
    const openStragglers = D.COUNTS.reduce((n, c) => n + c.stragglers.filter((s) => !dec.stragglersClosed[s.epc]).length, 0);

    return (
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <RfidPageHead
          title="Cycle counts"
          sub="The handheld walk-scans a room. Reads dedupe by EPC across every pass, so overlap costs time and never accuracy. A count passes at 98% coverage — which clears the room for trading, not for writing anything off."
          actions={<React.Fragment>
            <PBtn size="sm" variant="secondary" icon="smartphone" onClick={() => navigate('#/handheld?flow=count')}>See it on the handheld</PBtn>
            <PBtn size="sm" variant="accent" icon="plus" onClick={() => window.hdToast && window.hdToast({ title: 'Pick a room', description: 'Expected inventory is read from Hyperdrive at session open.', tone: 'info' })}>Start cycle count</PBtn>
          </React.Fragment>} />

        <Callout tone="warn" icon="alert" title="One reader exists">
          Only a single Zebra TC22R was purchased. Multi-operator dedupe is designed and simulated, but it cannot be validated on hardware until a second unit lands — the passes below were walked sequentially by one person.
        </Callout>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <StatTile icon="scan" label="Counts (7 days)" value={String(D.COUNTS.length)} hue="blue" />
          <StatTile icon="check-circle" label="Pass rate" value={HD.formatPercent(passRate, 0)} hue={passRate >= 0.98 ? 'ok' : 'warn'} sub={<Mono color={P.inkDim}>bar is {HD.formatPercent(D.ROOM_PASS_COVERAGE, 0)} coverage</Mono>} />
          <StatTile icon="help" label="Open stragglers" value={String(openStragglers)} hue="quarantine" sub={closed ? <Mono color={P.inkDim}>{closed} closed as missing this session</Mono> : 'never seen by any pass'} />
          <StatTile icon="package" label="Units walked" value={HD.formatNumber(D.COUNTS.reduce((n, c) => n + c.expected, 0))} hue="teal" />
        </div>

        <ChipFilter ariaLabel="Room" value={room} onChange={setRoom}
          options={[{ id: 'all', label: 'All rooms', count: D.COUNTS.length }].concat(rooms.map((r) => ({ id: r, label: r, count: D.COUNTS.filter((c) => c.room === r).length })))} />

        <Card padding={0}>
          <window.ScrollX label="Cycle counts table">
            <HDTable>
              <thead><tr style={{ background: P.surface2 }}>
                <TH>Count</TH><TH>Room</TH><TH align="right">Expected</TH><TH align="right">Found</TH>
                <TH align="right">Open</TH><TH width={190}>Coverage</TH><TH align="right">Passes</TH>
                <TH>Operator</TH><TH align="right">Finished</TH><TH>Verdict</TH>
              </tr></thead>
              <tbody>
                {rows.map((c) => {
                  const open = c.stragglers.filter((s) => !dec.stragglersClosed[s.epc]).length;
                  return (
                    <TR key={c.id} onClick={() => navigate(`#/counts/${c.id}`)}>
                      <TD mono>{c.id}</TD>
                      <TD>{c.room}</TD>
                      <TD align="right" mono>{HD.formatNumber(c.expected)}</TD>
                      <TD align="right" mono>{HD.formatNumber(c.uniqueFound)}</TD>
                      <TD align="right" mono style={{ color: open ? HD.tone(P, 'blocked').fg : P.inkMute }}>{open}</TD>
                      <TD><CoverageBar pct={c.coveragePct} /></TD>
                      <TD align="right" mono>{c.passes.length}</TD>
                      <TD>{c.operator}</TD>
                      <TD align="right" mono style={{ color: P.inkDim }}>{HD.relativeTime(c.finishedAt, D.NOW)}</TD>
                      <TD><HDPill size="sm" tone={c.verdict === 'PASS' ? 'ok' : 'warn'} label={c.verdict} /></TD>
                    </TR>);
                })}
              </tbody>
            </HDTable>
          </window.ScrollX>
        </Card>
      </div>);
  };

  window.ScreenCountDetail = function ScreenCountDetail({ navigate, countId }) {
    const P = useP(), HD = window.HD, D = window.RFID_DATA;
    const dec = window.useDecisions();
    const c = D.COUNTS.find((x) => x.id === countId);
    const [queued, setQueued] = React.useState(false);
    const [sel, setSel] = React.useState({});
    const [modal, setModal] = React.useState(false);
    if (!c) {
      return <div style={{ padding: 20 }}><window.SrOnly as="h1">No such count</window.SrOnly><EmptyState icon="scan" title="No such count" body="That cycle count is not in the last seven days." action={<PBtn size="sm" variant="secondary" onClick={() => navigate('#/counts')}>Back to cycle counts</PBtn>} /></div>;
    }
    const pass = c.verdict === 'PASS';
    let cum = 0;
    const passRows = c.passes.map((p) => { cum += p.newlySeen; return { ...p, cum, cumPct: cum / c.expected * 100 }; });
    const open = c.stragglers.filter((s) => !dec.stragglersClosed[s.epc]);
    const closedHere = c.stragglers.filter((s) => dec.stragglersClosed[s.epc]);
    const selected = open.filter((s) => sel[s.epc]);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <RfidPageHead
            back={{ label: 'Cycle counts', onClick: () => navigate('#/counts') }}
            title={{ text: c.id, mono: true }}
            sub={`${c.room} · walked by ${c.operator} on ${c.device}`}
            meta={<React.Fragment>
              <HDPill tone={pass ? 'ok' : 'warn'} label={c.verdict} />
              <HDPill tone="neutral" icon={false} style={monoStyle(P)} label={`${c.passes.length} passes`} />
              <HDPill tone="neutral" icon={false} style={monoStyle(P)} label={`${c.device} @ ${c.rfPower} dBm`} />
              <FromDevice device={c.device} who={c.operator} when={HD.relativeTime(c.finishedAt, D.NOW)} label="walked on" />
            </React.Fragment>}
            actions={<React.Fragment>
              <PBtn size="sm" variant="secondary" icon="smartphone" onClick={() => navigate('#/handheld?flow=count')}>Handheld view</PBtn>
              <PBtn size="sm" variant="accent" icon="send" disabled={!open.length || queued}
                onClick={() => { setQueued(true); window.hdToast && window.hdToast({ title: 'Second pass dispatched', description: `${open.length} stragglers pushed to ${c.device}.`, tone: 'ok' }); }}>
                {queued ? '2nd pass dispatched' : 'Dispatch 2nd pass'}
              </PBtn>
            </React.Fragment>} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))', gap: 12 }}>
            <StatTile icon="package" label="Expected" value={HD.formatNumber(c.expected)} hue="blue" />
            <StatTile icon="check-circle" label="Located" value={HD.formatNumber(c.uniqueFound)} hue="ok" sub="unique EPCs, deduped" />
            <StatTile icon="help" label="Still open" value={String(open.length)} hue={open.length ? 'blocked' : 'ok'} sub={closedHere.length ? <Mono color={P.inkDim}>{closedHere.length} closed as missing</Mono> : 'awaiting a second pass'} />
            <StatTile icon="gauge" label="Coverage" value={`${c.coveragePct.toFixed(1)}%`} hue={pass ? 'ok' : 'warn'} progress={c.coveragePct / 100} sub={<Mono color={P.inkDim}>pass bar {(D.ROOM_PASS_COVERAGE * 100).toFixed(0)}%</Mono>} />
            <StatTile icon="flag" label="Verdict" value={c.verdict} hue={pass ? 'ok' : 'warn'} />
            <StatTile icon="users" label="Passes" value={String(c.passes.length)} hue="teal" sub="deduped by EPC" />
          </div>

          <div className="hd-2col">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
              <Card>
                <CardHead title="Coverage by pass" sub="Each pass only ever adds. Overlap between passes costs walking time, never accuracy — the same EPC read twice is one unit." />
                <div style={{ marginBottom: 16 }}><CoverageBar pct={c.coveragePct} height={12} /></div>
                <window.ScrollX label="Coverage by pass table">
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
                </window.ScrollX>
                <div style={{ marginTop: 12, fontSize: 12.5, color: P.inkDim, lineHeight: 1.5 }}>
                  The last pass added <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{passRows[passRows.length - 1].newlySeen}</span> units.
                  {passRows[passRows.length - 1].newlySeen / c.expected < 0.03
                    ? ' Returns have flattened — another identical pass will not find the rest. What is left needs a close-range hunt, not more walking.'
                    : ' Returns are still climbing; one more pass is worth walking.'}
                </div>
              </Card>

              <Card padding={0}>
                <div style={{ padding: '16px 16px 12px' }}>
                  <CardHead title="Stragglers — chase, or close as missing"
                    sub={c.stragglers.length ? 'Never seen by any pass. Typically stacked dense, behind foil, or sitting inside a metal cage. Selecting rows here arms the one decision the handheld does not carry.' : undefined}
                    right={c.stragglers.length
                      ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <HDPill size="sm" tone={open.length ? 'blocked' : 'ok'} icon={false} style={monoStyle(P)} label={`${open.length} open`} />
                        {closedHere.length ? <HDPill size="sm" tone="archived" icon={false} style={monoStyle(P)} label={`${closedHere.length} written off`} /> : null}
                      </div>
                      : undefined} />
                </div>
                {c.stragglers.length === 0
                  ? <EmptyState compact icon="check-circle" title="Everything on the list was found." body="100% coverage. No second pass needed." />
                  : <React.Fragment>
                    <window.ScrollX label="Stragglers table">
                      <HDTable>
                        <thead><tr style={{ background: P.surface2 }}>
                          <TH width={44}></TH><TH>EPC</TH><TH>SKU</TH><TH width={92}>Shelf</TH><TH>Likely cause</TH><TH align="right">Last seen</TH><TH width={110}>State</TH>
                        </tr></thead>
                        <tbody>
                          {c.stragglers.map((s) => {
                            const isClosed = !!dec.stragglersClosed[s.epc];
                            return (
                              <TR key={s.epc} style={isClosed ? { opacity: .55 } : undefined}>
                                <TD>{!isClosed && <window.RfidCheck size={17} label={`Select straggler ${D.shortEpc(s.epc)} — ${s.sku}`} on={!!sel[s.epc]} onChange={(v) => setSel((x) => ({ ...x, [s.epc]: v }))} />}</TD>
                                <TD><EpcChip value={s.epc} muted={isClosed} /></TD>
                                <TD><SkuToken sku={s.sku} withName /></TD>
                                <TD mono>{s.shelf}</TD>
                                <TD style={{ fontSize: 12.5, color: P.inkDim }}>{s.cause}</TD>
                                <TD align="right" mono style={{ color: P.inkDim }}>{HD.relativeTime(s.lastSeen, D.NOW)}</TD>
                                <TD><HDPill size="sm" tone={isClosed ? 'archived' : 'blocked'} icon={false} label={isClosed ? 'written off' : 'open'} /></TD>
                              </TR>);
                          })}
                        </tbody>
                      </HDTable>
                    </window.ScrollX>
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
                <CardHead title="Cause mix" sub="Across the stragglers still open in this room." />
                {open.length === 0
                  ? <div style={{ fontSize: 12.5, color: P.inkMute }}>Nothing open.</div>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[...new Set(c.stragglers.map((s) => s.cause))].map((cause) => {
                      const n = open.filter((s) => s.cause === cause).length;
                      return (
                        <div key={cause} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 132, fontSize: 12.5, color: P.ink2 }}>{cause}</span>
                          <div style={{ flex: 1 }}><BarMeter value={n} max={open.length} color={P.ink} /></div>
                          <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', fontSize: 12.5, color: P.ink, width: 20, textAlign: 'right' }}>{n}</span>
                        </div>);
                    })}
                  </div>}
                <div style={{ marginTop: 12, fontSize: 12, color: P.inkMute, lineHeight: 1.5 }}>
                  No on-metal label stock was purchased. Anything reading as a metal problem is a procurement answer, not a scanning one.
                </div>
              </Card>

              <Card>
                <CardHead title="What a PASS does not mean" />
                <div style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.6 }}>
                  <Mono>{(D.ROOM_PASS_COVERAGE * 100).toFixed(0)}%</Mono> coverage clears the room for trading, not for writing anything off. Every straggler stays on the books until a second pass finds it or a supervisor closes it as missing — a person’s decision, made here, never on the handheld.
                </div>
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${P.hairline}` }}>
                  <KV label="Closed as missing (session)" value={closedHere.length} />
                  <KV label="Still on the books" value={open.length} />
                </div>
              </Card>

              <Card>
                <CardHead title="How this count works" />
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: P.inkDim, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <li>Hyperdrive hands the session the list of EPCs it expects to be in this room.</li>
                  <li>Every pass streams reads in. They are deduped by EPC, so a unit read forty times is still one unit.</li>
                  <li>Coverage is unique found ÷ expected. At or above <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>98%</span> the count is a PASS.</li>
                  <li>Anything never seen becomes a straggler and goes out as a targeted second pass — not a re-walk of the whole room.</li>
                </ol>
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${P.hairline}`, fontSize: 12.5, color: P.inkMute, lineHeight: 1.5 }}>
                  Unlike kit verification, a cycle count asserts no location — it answers "is this unit in this room", so there is no argmax and no confidence gate here.
                </div>
              </Card>
            </div>
          </div>
          <div style={{ height: 8 }} />
        </div>

        {/* Sticky decision bar — write-off is the decision this screen owns. */}
        <div style={{ position: 'sticky', bottom: 0, background: P.surface, borderTop: `1px solid ${P.hairline2}`, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', zIndex: 40 }}>
          <div style={{ flex: 1, minWidth: 220, fontSize: 12.5, color: P.inkDim }}>
            {selected.length
              ? <React.Fragment>Closing <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{selected.length}</span> unit{selected.length === 1 ? '' : 's'} as missing writes them off the books permanently.</React.Fragment>
              : <React.Fragment>A second pass re-walks only {c.room} and only the <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{open.length}</span> open tag{open.length === 1 ? '' : 's'}.</React.Fragment>}
          </div>
          <PBtn size="sm" variant="ghost" icon="download" onClick={() => window.hdToast && window.hdToast({ title: 'Stragglers exported', description: `${open.length} rows · CSV`, tone: 'ok' })}>Export stragglers</PBtn>
          <PBtn size="sm" variant="secondary" icon="ban" disabled={!selected.length} onClick={() => setModal(true)}>
            Close {selected.length || ''} as missing…
          </PBtn>
        </div>

        <ReasonModal open={modal} onClose={() => setModal(false)}
          title="Close these units as missing" tone="blocked" confirmLabel="Write them off"
          placeholder="e.g. two full shelf sweeps and a hand count found nothing; treating as shrink for the period"
          body={<React.Fragment>
            This writes <b><Mono>{selected.length}</Mono></b> unit{selected.length === 1 ? '' : 's'} off the books as shrink. It is an accounting
            decision, not a scan result: the tags stay in the registry with their history, but the units stop counting as on hand.
            The handheld cannot do this, and a second pass will no longer look for them.
          </React.Fragment>}
          onConfirm={(reason) => { dec.closeStragglers(selected.map((s) => s.epc), reason); setSel({}); window.hdToast && window.hdToast({ title: 'Written off — not synced to inventory', description: `${selected.length} unit${selected.length === 1 ? '' : 's'} closed as missing on ${c.id} in this session only. Nothing was written to inventory.`, tone: 'warn' }); }} />
      </div>);
  };
})();
