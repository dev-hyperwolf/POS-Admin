// ── #/kits and #/kits/:id — box-by-box kit verification ──────────────────
;(function () {
  const useP = window.useP;

  /* ══════════════════════════ LIST ══════════════════════════ */

  window.ScreenKits = function ScreenKits({ navigate }) {
    const P = useP(), HD = window.HD, D = window.RFID_DATA;
    const [q, setQ] = React.useState('');
    const [status, setStatus] = React.useState('all');

    const rows = D.KITS.filter((k) => {
      if (status !== 'all' && k.status !== status) return false;
      const s = q.trim().toLowerCase();
      if (!s) return true;
      return k.id.toLowerCase().includes(s) || k.label.toLowerCase().includes(s) || k.destination.toLowerCase().includes(s);
    });

    const today = D.KITS.filter((k) => D.NOW - new Date(k.startedAt).getTime() < 20 * 3600000);
    const unitsToday = today.reduce((n, k) => n + k.countedUnits, 0);
    const openFlags = D.KIT.flagged;
    const openMoves = D.KIT.moves;

    return (
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <RfidPageHead
          title="Kit verification"
          sub="Scan each box of a kit with the handheld. Every tag is assigned to the one box it read strongest in, then per-box SKU counts are diffed against the distribution plan."
          actions={<React.Fragment>
            <PBtn size="sm" variant="secondary" icon="scan" onClick={() => navigate('#/counts')}>Cycle counts</PBtn>
            <PBtn size="sm" variant="accent" icon="plus" onClick={() => window.hdToast && window.hdToast({ title: 'Pick a kit', description: 'Kits ready to pack are pulled from the distribution plan in Hyperdrive.', tone: 'info' })}>Start kit session</PBtn>
          </React.Fragment>} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <StatTile icon="box" label="Sessions today" value={String(today.length)} hue="blue" sub={`${D.KITS.length} in the last 48h`} />
          <StatTile icon="package" label="Units verified today" value={HD.formatNumber(unitsToday)} hue="teal" sub="deduped by argmax, one EPC one box" />
          <StatTile icon="flag" label="Open flagged lines" value={String(openFlags)} hue={openFlags ? 'warn' : 'ok'} sub={`on ${D.KIT.id}`} />
          <StatTile icon="swap" label="Moves outstanding" value={String(openMoves)} hue={openMoves ? 'info' : 'ok'} sub="product-level, fungible units" />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, maxWidth: 420, minWidth: 240 }}>
            <Field icon="search" size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by kit ID, run or destination…" />
          </div>
          <ChipFilter ariaLabel="Status" value={status} onChange={setStatus} options={[
            { id: 'all', label: 'All', count: D.KITS.length },
            { id: 'reconciled', label: 'Needs action', count: D.KITS.filter((k) => k.status === 'reconciled').length },
            { id: 'closed', label: 'Closed', count: D.KITS.filter((k) => k.status === 'closed').length },
          ]} />
        </div>

        <Card padding={0}>
          {rows.length === 0
            ? <EmptyState icon="box" title="No kit sessions match." body="Nothing matches that search. Clear it to see every session from the last 48 hours." action={<PBtn size="sm" variant="secondary" onClick={() => { setQ(''); setStatus('all'); }}>Clear</PBtn>} />
            : <div style={{ overflowX: 'auto' }}>
              <HDTable>
                <thead><tr style={{ background: P.surface2 }}>
                  <TH>Kit</TH><TH>Destination</TH><TH align="right">Boxes</TH><TH align="right">Planned</TH>
                  <TH align="right">Counted</TH><TH align="right">Flagged</TH><TH align="right">Moves</TH>
                  <TH align="right">Rescan</TH><TH>Operator</TH><TH align="right">Reconciled</TH><TH>Status</TH>
                </tr></thead>
                <tbody>
                  {rows.map((k) => {
                    const rescan = k.rescanCount != null ? k.rescanCount : k.rescan;
                    const flagged = k.flagged;
                    return (
                      <TR key={k.id} onClick={() => navigate(`#/kits/${k.id}`)}>
                        <TD>
                          <div style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink, fontVariantNumeric: 'tabular-nums' }}>{k.id}</div>
                          <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 2 }}>{k.label}</div>
                        </TD>
                        <TD>{k.destination}</TD>
                        <TD align="right" mono>{k.boxCount}</TD>
                        <TD align="right" mono>{HD.formatNumber(k.plannedUnits)}</TD>
                        <TD align="right" mono style={{ color: k.countedUnits === k.plannedUnits ? P.ink : HD.tone(P, 'warn').fg }}>{HD.formatNumber(k.countedUnits)}</TD>
                        <TD align="right" mono style={{ color: flagged ? HD.tone(P, 'blocked').fg : P.inkMute }}>{flagged}</TD>
                        <TD align="right" mono style={{ color: k.moves ? HD.tone(P, 'info').fg : P.inkMute }}>{k.moves}</TD>
                        <TD align="right" mono style={{ color: rescan ? P.ink2 : P.inkMute }}>{rescan}</TD>
                        <TD>{k.operator}</TD>
                        <TD align="right" mono style={{ color: P.inkDim }}>{HD.relativeTime(k.reconciledAt, D.NOW)}</TD>
                        <TD><HDPill size="sm" tone={k.status === 'closed' ? 'archived' : flagged ? 'warn' : 'ok'} label={k.status === 'closed' ? 'Closed' : flagged ? 'Needs action' : 'Clean'} /></TD>
                      </TR>);
                  })}
                </tbody>
              </HDTable>
            </div>}
        </Card>
      </div>);
  };

  /* ══════════════════════════ DETAIL ══════════════════════════ */

  function BoxCard({ box, selected, onClick }) {
    const P = useP(), HD = window.HD;
    const c = HD.tone(P, box.state);
    const flags = [];
    if (box.short) flags.push(`${box.short} short`);
    if (box.excess) flags.push(`${box.excess} excess`);
    if (box.wrong) flags.push(`${box.wrong} wrong product`);
    if (box.rescan) flags.push(`${box.rescan} rescan`);
    return (
      <button onClick={onClick} aria-pressed={selected} style={{
        textAlign: 'left', cursor: 'pointer', padding: 12, borderRadius: P.r12, fontFamily: P.fontSans,
        background: selected ? P.ink : P.surface, border: `1px solid ${selected ? P.ink : P.hairline2}`,
        transition: 'background .12s, border-color .12s' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: selected ? P.surface : P.inkMute }}>Box {box.box}</span>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: c.fg }} />
        </div>
        <div style={{ marginTop: 7, display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontSize: 21, fontWeight: 600, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: selected ? P.surface : P.ink }}>{box.actual}</span>
          <span style={{ fontSize: 12.5, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: selected ? P.surface : P.inkMute }}>/ {box.planned}</span>
        </div>
        <div style={{ marginTop: 9, height: 5, borderRadius: 99, background: selected ? P.hairline3 : P.surface3, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 99, background: c.fg, width: `${Math.min(100, box.actual / box.planned * 100)}%` }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 11.5, color: selected ? P.surface : P.inkDim, minHeight: 16 }}>
          {flags.length ? flags.join(' · ') : 'matches plan'}
        </div>
        <div style={{ marginTop: 3, fontSize: 11.5, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: selected ? P.railInk : P.inkMute }}>{box.reads} reads</div>
      </button>);
  }

  function PullList({ groups }) {
    const P = useP(), HD = window.HD;
    const [done, setDone] = React.useState({});
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    const doneCount = Object.values(done).filter(Boolean).length;
    if (!groups.length) {
      return <EmptyState compact icon="check-circle" title="No moves needed." body="Every box already holds the products its plan calls for." />;
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {groups.map((g) => (
          <div key={g.fromBox} style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 12px', background: P.surface2, borderBottom: `1px solid ${P.hairline2}` }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: P.ink }}>Pull from Box {g.fromBox}</span>
              <span style={{ fontSize: 11.5, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.inkMute }}>{g.totalUnits} units</span>
            </div>
            {g.items.map((i, ix) => {
              const key = `${g.fromBox}-${i.sku}-${i.toBox}`;
              const on = !!done[key];
              const meta = window.RFID_DATA.SKU_MAP.get(i.sku);
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderTop: ix === 0 ? 'none' : `1px solid ${P.hairline}` }}>
                  <Check size={18} on={on} onChange={(v) => setDone((d) => ({ ...d, [key]: v }))} />
                  <span style={{ fontFamily: P.fontMono, fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: on ? P.inkMute : P.ink, minWidth: 34 }}>{i.qty}×</span>
                  <div style={{ flex: 1, minWidth: 0, textDecoration: on ? 'line-through' : 'none', opacity: on ? .55 : 1 }}>
                    <div style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink, fontVariantNumeric: 'tabular-nums' }}>{i.sku}</div>
                    <div style={{ fontSize: 11.5, color: P.inkMute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta ? `${meta.name} · ${meta.brand}` : ''}</div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: P.ink2, whiteSpace: 'nowrap' }}>
                    <Icon name="arrow-right" size={13} stroke={2} color={P.inkMute} />Box {i.toBox}
                  </span>
                </div>);
            })}
          </div>))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 12.5, color: P.inkDim }}>
            <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{doneCount}/{total}</span> moves confirmed
          </span>
          <PBtn size="sm" variant="secondary" icon="printer" onClick={() => window.hdToast && window.hdToast({ title: 'Pull list sent to the handheld', description: 'Opens on TC22R-01 as a box-by-box checklist.', tone: 'ok' })}>Send to handheld</PBtn>
        </div>
        <div style={{ fontSize: 11.5, color: P.inkMute, lineHeight: 1.5 }}>
          Units are fungible per SKU — any units of that SKU satisfy the move. Nobody is ever sent to hunt a specific serial.
        </div>
      </div>);
  }

  window.ScreenKitSession = function ScreenKitSession({ navigate, kitId }) {
    const P = useP(), HD = window.HD, D = window.RFID_DATA;
    const kit = D.KIT.id === kitId ? D.KIT : null;
    const [boxFilter, setBoxFilter] = React.useState(0);   // 0 = all
    const [stateFilter, setStateFilter] = React.useState('flagged');
    const [closed, setClosed] = React.useState(false);

    if (!kit) {
      return (
        <div style={{ padding: 20 }}>
          <EmptyState icon="box" title="Session detail not seeded"
            body="Only the live session KIT-2026-0824-03 carries a full reconciliation in this prototype. The other rows are list fixtures."
            action={<PBtn size="sm" variant="secondary" onClick={() => navigate('#/kits/KIT-2026-0824-03')}>Open KIT-2026-0824-03</PBtn>} />
        </div>);
    }

    const r = kit.recon;
    const tagged = React.useMemo(() => [
      ...r.short.map((l) => ({ ...l, state: 'short' })),
      ...r.excess.map((l) => ({ ...l, state: 'excess' })),
      ...r.wrongProduct.map((l) => ({ ...l, state: 'wrong' })),
      ...r.correct.map((l) => ({ ...l, state: 'correct' })),
    ].sort((a, b) => a.boxIndex - b.boxIndex || a.sku.localeCompare(b.sku)), [r]);

    const flaggedCount = r.short.length + r.excess.length + r.wrongProduct.length;
    const lines = tagged.filter((l) => {
      if (boxFilter && l.boxIndex !== boxFilter) return false;
      if (stateFilter === 'all') return true;
      if (stateFilter === 'flagged') return l.state !== 'correct';
      return l.state === stateFilter;
    });

    const inflation = kit.naiveUnits / kit.physicalUnits;
    const activity = D.AUDIT.filter((a) => a.subject.indexOf(kit.sessionId) === 0 || a.subject === kit.id);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>

          <RfidPageHead
            back={{ label: 'Kit verification', onClick: () => navigate('#/kits') }}
            title={{ text: kit.id, mono: true }}
            sub={`${kit.label} · ${kit.destination}`}
            meta={<React.Fragment>
              <HDPill tone={closed ? 'archived' : flaggedCount ? 'warn' : 'ok'} label={closed ? 'Closed' : flaggedCount ? `${flaggedCount} lines need action` : 'Clean'} />
              <HDPill tone="info" icon={false} label={`${kit.boxCount} boxes · ${HD.formatNumber(kit.plannedUnits)} planned`} />
              <HDPill tone="neutral" icon={false} label={`${kit.device} @ ${kit.rfPower} dBm`} />
              <HDPill tone="neutral" icon={false} label={`gate ${kit.gate} dBm`} />
              <span style={{ fontSize: 12.5, color: P.inkMute }}>reconciled {HD.relativeTime(kit.reconciledAt, D.NOW)} by {kit.operator}</span>
            </React.Fragment>}
            actions={<PBtn size="sm" variant="secondary" icon="refresh" onClick={() => window.hdToast && window.hdToast({ title: 'Rescan queued', description: 'TC22R-01 will reopen this session at box 1.', tone: 'info' })}>Reopen scan</PBtn>} />

          {/* Box strip — the operator's mental model of the kit, first thing on the page. */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
              <MicroLabel>Boxes · counted vs planned</MicroLabel>
              {boxFilter > 0 && <button onClick={() => setBoxFilter(0)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12.5, color: P.inkDim, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', fontFamily: P.fontSans }}>Show all boxes</button>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(178px, 1fr))', gap: 12 }}>
              {kit.boxes.map((b) => <BoxCard key={b.box} box={b} selected={boxFilter === b.box} onClick={() => setBoxFilter(boxFilter === b.box ? 0 : b.box)} />)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))', gap: 12 }}>
            <StatTile icon="activity" label="Reads ingested" value={HD.formatNumber(kit.readsIngested)} hue="blue" sub="raw, before argmax" />
            <StatTile icon="package" label="Units counted" value={HD.formatNumber(kit.countedUnits)} hue="teal" sub={`of ${HD.formatNumber(kit.plannedUnits)} planned`} />
            <StatTile icon="check-circle" label="Correct lines" value={String(r.correct.length)} hue="ok" />
            <StatTile icon="flag" label="Flagged lines" value={String(flaggedCount)} hue={flaggedCount ? 'warn' : 'ok'} sub={`${r.short.length} short · ${r.excess.length} excess · ${r.wrongProduct.length} wrong`} />
            <StatTile icon="help" label="Rescan" value={String(r.rescan.length)} hue={r.rescan.length ? 'quarantine' : 'ok'} sub="below the confidence gate" />
            <StatTile icon="swap" label="Suggested moves" value={String(r.moves.length)} hue="info" sub={`${kit.moveGroups.length} source boxes`} />
          </div>

          <div className="hd-2col">
            {/* ─── left column ─── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

              <Card padding={0}>
                <div style={{ padding: '16px 16px 12px' }}>
                  <CardHead title="Reconciliation lines"
                    sub={boxFilter ? `Box ${boxFilter} only — per-box SKU counts diffed against the distribution plan.` : 'Per-box SKU counts diffed against the distribution plan. One line per (box, SKU).'} />
                  <ChipFilter ariaLabel="Line state" value={stateFilter} onChange={setStateFilter} options={[
                    { id: 'flagged', label: 'Needs action', count: flaggedCount },
                    { id: 'short', label: 'Short', count: r.short.length },
                    { id: 'excess', label: 'Excess', count: r.excess.length },
                    { id: 'wrong', label: 'Wrong product', count: r.wrongProduct.length },
                    { id: 'correct', label: 'Correct', count: r.correct.length },
                    { id: 'all', label: 'All', count: tagged.length },
                  ]} />
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <HDTable>
                    <thead><tr style={{ background: P.surface2 }}>
                      <TH width={64}>Box</TH><TH>SKU</TH><TH align="right" width={82}>Planned</TH>
                      <TH align="right" width={72}>Actual</TH><TH align="right" width={56}>Δ</TH><TH width={132}>State</TH>
                    </tr></thead>
                    <tbody>
                      {lines.length === 0 && <tr><TD colSpan={6}><div style={{ padding: '18px 0', textAlign: 'center', fontSize: 12.5, color: P.inkMute }}>No lines in that filter.</div></TD></tr>}
                      {lines.map((l) => (
                        <TR key={`${l.boxIndex}-${l.sku}`}>
                          <TD mono>Box {l.boxIndex}</TD>
                          <TD><SkuToken sku={l.sku} withName /></TD>
                          <TD align="right" mono style={{ color: l.planned === 0 ? P.inkMute : P.ink }}>{l.planned}</TD>
                          <TD align="right" mono>{l.actual}</TD>
                          <TD align="right"><Delta value={l.delta} /></TD>
                          <TD><LinePill state={l.state} /></TD>
                        </TR>))}
                    </tbody>
                  </HDTable>
                </div>
              </Card>

              <Card>
                <CardHead title="Pull list — grouped by source box"
                  sub="Product-level rebalance. An operator works one box at a time: open it once, take everything out of it, close it." />
                <PullList groups={kit.moveGroups} />
              </Card>

              <Card>
                <CardHead title="Unresolved shortfall"
                  sub="Shorts with no surplus anywhere in the kit to pair against. These are missing units, not misplaced ones." />
                <div style={{ overflowX: 'auto' }}>
                  <HDTable>
                    <thead><tr style={{ background: P.surface2 }}>
                      <TH width={64}>Box</TH><TH>SKU</TH><TH align="right" width={72}>Missing</TH><TH>Most likely cause</TH>
                    </tr></thead>
                    <tbody>
                      {unresolvedShorts(r).map((u) => (
                        <TR key={`${u.boxIndex}-${u.sku}`}>
                          <TD mono>Box {u.boxIndex}</TD>
                          <TD><SkuToken sku={u.sku} withName /></TD>
                          <TD align="right" mono style={{ color: HD.tone(P, 'blocked').fg }}>{u.qty}</TD>
                          <TD style={{ fontSize: 12.5, color: P.inkDim }}>{u.cause}</TD>
                        </TR>))}
                    </tbody>
                  </HDTable>
                </div>
              </Card>
            </div>

            {/* ─── right column ─── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

              <Card>
                <CardHead title="Rescan queue"
                  right={<HDPill size="sm" tone="quarantine" icon={false} label={`${r.rescan.length} units`} />} />
                <Callout tone="quarantine" icon="help" title="No location asserted"
                  style={{ marginBottom: 12 }}>
                  The strongest read on each of these was below the {kit.gate} dBm gate. The module refuses to say which box they are in, and emits no move for them.
                </Callout>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {r.rescan.map((x, i) => (
                    <li key={x.epc} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <EpcChip value={x.epc} />
                        <div style={{ marginTop: 4, fontSize: 11.5, color: P.inkMute }}>heard nearest Box {x.nearestBox} · not asserted</div>
                      </div>
                      <Dbm value={x.bestRssi} gate={kit.gate} />
                    </li>))}
                </ul>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${P.hairline}`, fontSize: 12.5, color: P.inkDim, lineHeight: 1.5 }}>
                  Until they are rescanned, <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{r.rescan.length}</span> of the short lines below may be phantom — Box 1 · VAP-1G-GEL and Box 5 · CON-1G-LR each read one short because one of their units fell under the gate.
                </div>
                <div style={{ marginTop: 12 }}>
                  <PBtn size="sm" variant="secondary" full icon="scan" onClick={() => window.hdToast && window.hdToast({ title: 'Second pass queued', description: `${r.rescan.length} units · walk boxes 1 and 5 again at close range.`, tone: 'info' })}>Queue a close-range pass</PBtn>
                </div>
              </Card>

              <Card>
                <CardHead title="argmax vs. naive counting" sub="Same reads, both methods. This is why one EPC gets exactly one box." />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Method label="argmax (shipped)" value={kit.countedUnits} tone="ok" note={`${kit.physicalUnits} physically present`} />
                  <Method label="naive per-box" value={kit.naiveUnits} tone="blocked" note={`${inflation.toFixed(2)}× inflation`} />
                </div>
                <div style={{ marginTop: 12, fontSize: 12.5, color: P.inkDim, lineHeight: 1.5 }}>
                  Counting each tag in every box it was heard in would have invented{' '}
                  <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{HD.formatNumber(kit.naiveUnits - kit.countedUnits)}</span>{' '}
                  units that do not exist — phantom excess an operator would have been sent to fix.
                </div>
              </Card>

              <Card>
                <CardHead title="Session" />
                <KV label="Session" value={kit.sessionId} />
                <KV label="Operator" value={kit.operator} mono={false} />
                <KV label="Reader" value={kit.device} />
                <KV label="RF power" value={`${kit.rfPower} dBm`} />
                <KV label="Confidence gate" value={`${kit.gate} dBm`} />
                <KV label="Started" value={HD.formatDateTime(kit.startedAt)} />
                <KV label="Reconciled" value={HD.formatDateTime(kit.reconciledAt)} />
                <KV label="Phantom counts avoided" value={HD.formatNumber(r.phantomUnitsAvoided)} />
                <KV label="Unknown EPCs" value={r.unknownEpcs.length} tone={r.unknownEpcs.length ? HD.tone(P, 'warn').fg : undefined} />
              </Card>

              <Card>
                <CardHead title="Activity" />
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {activity.map((a, i) => {
                    const c = HD.tone(P, a.tone);
                    return (
                      <li key={a.at} style={{ display: 'flex', gap: 10, padding: '9px 0', borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
                        <span style={{ width: 7, height: 7, borderRadius: 99, background: c.fg, flex: '0 0 auto', marginTop: 6 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.ink2, fontVariantNumeric: 'tabular-nums' }}>{a.action}</div>
                          <div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 2, lineHeight: 1.45 }}>{a.detail}</div>
                        </div>
                        <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkMute, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{HD.relativeTime(a.at, D.NOW)}</span>
                      </li>);
                  })}
                </ul>
              </Card>
            </div>
          </div>
          <div style={{ height: 8 }} />
        </div>

        {/* Sticky decision bar — same pattern as the invoice detail. */}
        <div style={{ position: 'sticky', bottom: 0, background: P.surface, borderTop: `1px solid ${P.hairline2}`, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', zIndex: 40 }}>
          <div style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: P.inkDim }}>
            {closed
              ? 'Kit closed. Counts written back to the distribution plan.'
              : <React.Fragment><span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{r.moves.length}</span> moves and <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{unresolvedShorts(r).reduce((n, u) => n + u.qty, 0)}</span> missing units outstanding.</React.Fragment>}
          </div>
          <PBtn size="sm" variant="ghost" icon="download" onClick={() => window.hdToast && window.hdToast({ title: 'Pull list exported', description: 'CSV, grouped by source box.', tone: 'ok' })}>Export pull list</PBtn>
          <PBtn size="sm" variant="secondary" icon="flag" onClick={() => window.hdToast && window.hdToast({ title: 'Escalated to supervisor', description: 'Unresolved shortfall flagged on the packing board.', tone: 'warn' })}>Flag shortfall</PBtn>
          <PBtn size="sm" variant="accent" icon="check" disabled={closed}
            onClick={() => { setClosed(true); window.hdToast && window.hdToast({ title: 'Kit closed', description: `${kit.id} accepted at ${kit.countedUnits} units.`, tone: 'ok' }); }}>
            {closed ? 'Kit closed' : 'Accept & close kit'}
          </PBtn>
        </div>
      </div>);
  };

  function Method({ label, value, tone, note }) {
    const P = useP(), HD = window.HD;
    const c = HD.tone(P, tone);
    return (
      <div style={{ padding: 12, borderRadius: P.r10, background: c.bg, border: `1px solid ${P.hairline2}` }}>
        <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>{label}</div>
        <div style={{ marginTop: 6, fontSize: 21, fontWeight: 600, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: c.fg }}>{window.HD.formatNumber(value)}</div>
        <div style={{ marginTop: 5, fontSize: 11.5, color: P.inkDim }}>{note}</div>
      </div>);
  }

  // Shorts the greedy pairing could not satisfy from any surplus in the kit.
  function unresolvedShorts(r) {
    const covered = new Map();
    for (const m of r.moves) covered.set(`${m.toBox}|${m.sku}`, (covered.get(`${m.toBox}|${m.sku}`) || 0) + m.qty);
    const rescanBySku = new Set(['VAP-1G-GEL', 'CON-1G-LR']);
    return r.short.map((l) => {
      const q = -l.delta - (covered.get(`${l.boxIndex}|${l.sku}`) || 0);
      return { boxIndex: l.boxIndex, sku: l.sku, qty: q,
        cause: rescanBySku.has(l.sku) && q === 1 ? 'One unit sits in the rescan queue — likely present, not missing.' : 'Never packed. No surplus of this SKU anywhere in the kit.' };
    }).filter((u) => u.qty > 0);
  }
})();
