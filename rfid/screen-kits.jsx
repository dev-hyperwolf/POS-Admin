// ── #/kits and #/kits/:id — box-by-box kit verification ──────────────────
// The desk half of the kit workflow. The handheld asserted these reads; this
// screen shows what the engine made of them and holds the one decision the
// floor is not allowed to make: posting the kit.
;(function () {
  const useP = window.useP;

  /* ══════════════════════════ LIST ══════════════════════════ */

  window.ScreenKits = function ScreenKits({ navigate }) {
    const P = useP(), HD = window.HD, D = window.RFID_DATA;
    const dec = window.useDecisions();
    const [q, setQ] = React.useState('');
    const [status, setStatus] = React.useState('all');

    const statusOf = (k) => (k.id === D.KIT.id
      ? (dec.kit.status === 'approved' ? 'closed' : dec.kit.status === 'rejected' ? 'rejected' : 'awaiting')
      : k.status === 'closed' ? 'closed' : 'awaiting');

    const rows = D.KITS.filter((k) => {
      if (status !== 'all' && statusOf(k) !== status) return false;
      const s = q.trim().toLowerCase();
      if (!s) return true;
      return k.id.toLowerCase().includes(s) || k.label.toLowerCase().includes(s) || k.destination.toLowerCase().includes(s);
    });

    const today = D.KITS.filter((k) => D.NOW - new Date(k.startedAt).getTime() < 20 * 3600000);
    const unitsToday = today.reduce((n, k) => n + k.countedUnits, 0);
    const awaiting = D.KITS.filter((k) => statusOf(k) === 'awaiting').length;

    return (
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <RfidPageHead
          title="Kit verification"
          sub="The handheld scans each box of a kit. Every tag is assigned to the one box it read strongest in, then per-box SKU counts are diffed against the distribution plan. Posting the result is a decision, and it is made here."
          actions={<React.Fragment>
            <PBtn size="sm" variant="secondary" icon="smartphone" onClick={() => navigate('#/handheld?flow=kit')}>See it on the handheld</PBtn>
            <PBtn size="sm" variant="accent" icon="plus" onClick={() => window.hdToast && window.hdToast({ title: 'Pick a kit', description: 'Kits ready to pack are pulled from the distribution plan in Hyperdrive.', tone: 'info' })}>Start kit session</PBtn>
          </React.Fragment>} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <StatTile icon="box" label="Sessions today" value={String(today.length)} hue="blue" sub={<Mono color={P.inkDim}>{D.KITS.length} in the last 48h</Mono>} />
          <StatTile icon="package" label="Units verified today" value={HD.formatNumber(unitsToday)} hue="teal" sub="deduped by argmax, one EPC one box" />
          <StatTile icon="shield" label="Awaiting your decision" value={String(awaiting)} hue={awaiting ? 'warn' : 'ok'} sub="submitted by the floor, not yet posted" />
          <StatTile icon="swap" label="Moves outstanding" value={String(D.KIT_SUMMARY.moveLines)} hue={D.KIT_SUMMARY.moveLines ? 'info' : 'ok'} sub="product-level, fungible units" />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, maxWidth: 420, minWidth: 240 }}>
            <Field icon="search" size="sm" aria-label="Search kit sessions" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by kit ID, run or destination…" />
          </div>
          <ChipFilter ariaLabel="Status" value={status} onChange={setStatus} options={[
            { id: 'all', label: 'All', count: D.KITS.length },
            { id: 'awaiting', label: 'Awaiting decision', count: D.KITS.filter((k) => statusOf(k) === 'awaiting').length },
            { id: 'closed', label: 'Posted', count: D.KITS.filter((k) => statusOf(k) === 'closed').length },
          ]} />
        </div>

        <Card padding={0}>
          {rows.length === 0
            ? <EmptyState icon="box" title="No kit sessions match." body="Nothing matches that search. Clear it to see every session from the last 48 hours." action={<PBtn size="sm" variant="secondary" onClick={() => { setQ(''); setStatus('all'); }}>Clear</PBtn>} />
            : <window.ScrollX label="Kit sessions table">
              <HDTable>
                <thead><tr style={{ background: P.surface2 }}>
                  <TH>Kit</TH><TH>Destination</TH><TH align="right">Boxes</TH><TH align="right">Planned</TH>
                  <TH align="right">Counted</TH><TH align="right">Flagged</TH><TH align="right">Moves</TH>
                  <TH align="right">Rescan</TH><TH>Operator</TH><TH align="right">Submitted</TH><TH>Decision</TH>
                </tr></thead>
                <tbody>
                  {rows.map((k) => {
                    const st = statusOf(k);
                    const rescan = k.rescanCount != null ? k.rescanCount : k.rescan;
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
                        <TD align="right" mono style={{ color: k.flagged ? HD.tone(P, 'blocked').fg : P.inkMute }}>{k.flagged}</TD>
                        <TD align="right" mono style={{ color: k.moves ? HD.tone(P, 'info').fg : P.inkMute }}>{k.moves}</TD>
                        <TD align="right" mono style={{ color: rescan ? P.ink2 : P.inkMute }}>{rescan}</TD>
                        <TD>{k.operator}</TD>
                        <TD align="right" mono style={{ color: P.inkDim }}>{HD.relativeTime(k.reconciledAt, D.NOW)}</TD>
                        <TD>
                          <HDPill size="sm"
                            tone={st === 'closed' ? 'archived' : st === 'rejected' ? 'blocked' : k.flagged ? 'warn' : 'ok'}
                            label={st === 'closed' ? 'Posted' : st === 'rejected' ? 'Rejected' : k.flagged ? 'Needs a decision' : 'Clean — post it'} />
                        </TD>
                      </TR>);
                  })}
                </tbody>
              </HDTable>
            </window.ScrollX>}
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
        boxShadow: selected ? 'none' : P.shadowSm, transition: 'background .12s, border-color .12s' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: selected ? P.surface : P.inkMute }}>Box <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{box.box}</span></span>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: c.fg }} />
        </div>
        <div style={{ marginTop: 7, display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontSize: 21, fontWeight: 600, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: selected ? P.surface : P.ink }}>{box.actual}</span>
          <span style={{ fontSize: 12.5, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: selected ? P.surface : P.inkMute }}>/ {box.planned}</span>
        </div>
        <div style={{ marginTop: 9, height: 5, borderRadius: 99, background: selected ? P.hairline3 : P.surface3, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 99, background: c.fg, width: `${Math.min(100, box.actual / box.planned * 100)}%` }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 11.5, color: selected ? P.surface : P.inkDim, minHeight: 16, fontFamily: flags.length ? P.fontMono : P.fontSans, fontVariantNumeric: 'tabular-nums' }}>
          {flags.length ? flags.join(' · ') : 'matches plan'}
        </div>
        <div style={{ marginTop: 3, fontSize: 11.5, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: selected ? P.railInk : P.inkMute }}>{box.reads} reads · {box.bleedRejected} bleed rejected</div>
      </button>);
  }

  // The move list. Ticking a move here mirrors the handheld's pull list — the
  // desk can follow along, but the person holding the box is the one who
  // confirms it, which is why this panel says so.
  function PullList({ groups, locked }) {
    const P = useP();
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
              <span style={{ fontSize: 13.5, fontWeight: 600, color: P.ink }}>Pull from Box <Mono>{g.fromBox}</Mono></span>
              <span style={{ fontSize: 11.5, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.inkMute }}>{g.totalUnits} units</span>
            </div>
            {g.items.map((i, ix) => {
              const key = `${g.fromBox}-${i.sku}-${i.toBox}`;
              const on = !!done[key];
              const meta = window.RFID_DATA.SKU_MAP.get(i.sku);
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderTop: ix === 0 ? 'none' : `1px solid ${P.hairline}` }}>
                  <window.RfidCheck size={18} label={`Confirm move: ${i.qty} of ${i.sku} from box ${g.fromBox} to box ${i.toBox}`} on={on} onChange={(v) => setDone((d) => ({ ...d, [key]: v }))} />
                  <span style={{ fontFamily: P.fontMono, fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: on ? P.inkMute : P.ink, minWidth: 34 }}>{i.qty}×</span>
                  <div style={{ flex: 1, minWidth: 0, textDecoration: on ? 'line-through' : 'none', opacity: on ? .55 : 1 }}>
                    <div style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink, fontVariantNumeric: 'tabular-nums' }}>{i.sku}</div>
                    <div style={{ fontSize: 11.5, color: P.inkMute, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta ? `${meta.name} · ${meta.brand}` : ''}</div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: P.ink2, whiteSpace: 'nowrap' }}>
                    <Icon name="arrow-right" size={13} stroke={2} color={P.inkMute} />Box <Mono color={P.ink2}>{i.toBox}</Mono>
                  </span>
                </div>);
            })}
          </div>))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: P.inkDim }}>
            <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{doneCount}/{total}</span> moves confirmed
          </span>
          <PBtn size="sm" variant="secondary" icon="smartphone" disabled={locked}
            onClick={() => window.hdToast && window.hdToast({ title: 'Pull list sent to the handheld', description: 'Opens on TC22R-01 as a box-by-box checklist.', tone: 'ok' })}>Send to handheld</PBtn>
        </div>
        <div style={{ fontSize: 11.5, color: P.inkMute, lineHeight: 1.5 }}>
          Units are fungible per SKU — any units of that SKU satisfy the move. Nobody is ever sent to hunt a specific serial.
          The tick that counts is the one made on the device, by the person with the box open.
        </div>
      </div>);
  }

  function Method({ label, value, tone, note }) {
    const P = useP(), HD = window.HD;
    const c = HD.tone(P, tone);
    return (
      <div style={{ padding: 12, borderRadius: P.r10, background: c.bg, border: `1px solid ${P.hairline2}`, borderLeft: `3px solid ${c.fg}` }}>
        <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkMute }}>{label}</div>
        <div style={{ marginTop: 6, fontSize: 21, fontWeight: 600, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', lineHeight: 1, color: c.fg }}>{HD.formatNumber(value)}</div>
        <div style={{ marginTop: 5, fontSize: 11.5, color: P.inkDim }}>{note}</div>
      </div>);
  }

  window.ScreenKitSession = function ScreenKitSession({ navigate, kitId }) {
    const P = useP(), HD = window.HD, D = window.RFID_DATA;
    const dec = window.useDecisions();
    const kit = D.KIT.id === kitId ? D.KIT : null;
    const [boxFilter, setBoxFilter] = React.useState(0);   // 0 = all
    const [stateFilter, setStateFilter] = React.useState('flagged');
    const [modal, setModal] = React.useState(null);        // 'approve' | 'reject'

    if (!kit) {
      return (
        <div style={{ padding: 20 }}>
          {/* These three whole-page empty states are the only routes with no
              RfidPageHead, so they were the only ones with no <h1> at all. An
              off-screen one restores the document outline without adding a
              title to a screen that is deliberately titleless. */}
          <window.SrOnly as="h1">Session detail not seeded</window.SrOnly>
          <EmptyState icon="box" title="Session detail not seeded"
            body="Only the live session KIT-2026-0824-03 carries a full reconciliation in this prototype. The other rows are list fixtures."
            action={<PBtn size="sm" variant="secondary" onClick={() => navigate('#/kits/KIT-2026-0824-03')}>Open KIT-2026-0824-03</PBtn>} />
        </div>);
    }

    const r = kit.recon, S = D.KIT_SUMMARY;
    const decided = dec.kit.status !== 'submitted';
    const lines = kit.lines.filter((l) => {
      if (boxFilter && l.boxIndex !== boxFilter) return false;
      if (stateFilter === 'all') return true;
      if (stateFilter === 'flagged') return l.state !== 'correct';
      return l.state === stateFilter;
    });
    const inflation = S.naive / S.physical;
    const activity = dec.events.filter((a) => a.subject.indexOf(kit.sessionId) === 0)
      .concat(D.AUDIT.filter((a) => a.subject.indexOf(kit.sessionId) === 0 || a.subject === kit.id));

    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>

          <RfidPageHead
            back={{ label: 'Kit verification', onClick: () => navigate('#/kits') }}
            title={{ text: kit.id, mono: true }}
            sub={`${kit.label} · ${kit.destination}`}
            meta={<React.Fragment>
              <HDPill tone={dec.kit.status === 'approved' ? 'archived' : dec.kit.status === 'rejected' ? 'blocked' : S.flagged ? 'warn' : 'ok'}
                label={dec.kit.status === 'approved' ? 'Posted' : dec.kit.status === 'rejected' ? 'Rejected' : `${S.flagged} lines need a decision`} />
              <HDPill tone="info" icon={false} style={monoStyle(P)} label={`${kit.boxCount} boxes · ${HD.formatNumber(S.planned)} planned`} />
              <HDPill tone="neutral" icon={false} style={monoStyle(P)} label={`${kit.device} @ ${kit.rfPower} dBm`} />
              <HDPill tone="neutral" icon={false} style={monoStyle(P)} label={`gate ${dec.gateValue} dBm`} />
              <FromDevice device={kit.device} who={kit.operator} when={HD.relativeTime(kit.submittedAt, D.NOW)} label="submitted from" />
            </React.Fragment>}
            actions={<React.Fragment>
              <PBtn size="sm" variant="secondary" icon="smartphone" onClick={() => navigate('#/handheld?flow=kit')}>Handheld view</PBtn>
              <PBtn size="sm" variant="secondary" icon="refresh" disabled={decided || dec.rescanRequested}
                onClick={() => { dec.requestRescan(); window.hdToast && window.hdToast({ title: 'Rescan requested', description: `${S.rescan} tags queued to ${kit.device} for a close-range pass.`, tone: 'info' }); }}>
                {dec.rescanRequested ? 'Rescan requested' : `Request rescan of ${S.rescan}`}
              </PBtn>
            </React.Fragment>} />

          {/* Box strip — the operator's mental model of the kit, first thing on the page. */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
              <MicroLabel>Boxes · counted vs planned</MicroLabel>
              {boxFilter > 0 && <button onClick={() => setBoxFilter(0)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12.5, color: P.inkDim, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', fontFamily: P.fontSans }}>Show all boxes</button>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
              {kit.boxes.map((b) => <BoxCard key={b.box} box={b} selected={boxFilter === b.box} onClick={() => setBoxFilter(boxFilter === b.box ? 0 : b.box)} />)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))', gap: 12 }}>
            <StatTile icon="activity" label="Reads ingested" value={HD.formatNumber(S.reads)} hue="blue" sub="raw, before argmax" />
            <StatTile icon="package" label="Units assigned" value={HD.formatNumber(S.assigned)} hue="teal" sub={<Mono color={P.inkDim}>of {HD.formatNumber(S.planned)} planned</Mono>} />
            <StatTile icon="check-circle" label="Correct lines" value={String(S.correct)} hue="ok" />
            <StatTile icon="flag" label="Flagged lines" value={String(S.flagged)} hue={S.flagged ? 'warn' : 'ok'} sub={<Mono color={P.inkDim}>{S.short} short · {S.excess} excess · {S.wrong} wrong</Mono>} />
            <StatTile icon="help" label="Rescan" value={String(S.rescan)} hue={S.rescan ? 'quarantine' : 'ok'} sub="below the confidence gate" />
            <StatTile icon="swap" label="Suggested moves" value={String(S.moveLines)} hue="info" sub={<Mono color={P.inkDim}>{S.moveUnits} units · {S.moveGroups} source boxes</Mono>} />
          </div>

          <div className="hd-2col">
            {/* ─── left column ─── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

              <Card padding={0}>
                <div style={{ padding: '16px 16px 12px' }}>
                  <CardHead title="Reconciliation lines"
                    sub={boxFilter ? `Box ${boxFilter} only — per-box SKU counts diffed against the distribution plan.` : 'Per-box SKU counts diffed against the distribution plan. One line per (box, SKU).'} />
                  <ChipFilter ariaLabel="Line state" value={stateFilter} onChange={setStateFilter} options={[
                    { id: 'flagged', label: 'Needs action', count: S.flagged },
                    { id: 'short', label: 'Short', count: S.short },
                    { id: 'excess', label: 'Excess', count: S.excess },
                    { id: 'wrong', label: 'Wrong product', count: S.wrong },
                    { id: 'correct', label: 'Correct', count: S.correct },
                    { id: 'all', label: 'All', count: kit.lines.length },
                  ]} />
                </div>
                <window.ScrollX label="Reconciled lines table">
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
                </window.ScrollX>
              </Card>

              <Card>
                <CardHead title="Pull list — grouped by source box"
                  sub="Product-level rebalance. An operator works one box at a time: open it once, take everything out of it, close it."
                  right={<FromDevice device={kit.device} who={kit.operator} when={HD.relativeTime(kit.submittedAt, D.NOW)} label="confirmed on" />} />
                <PullList groups={kit.moveGroups} locked={decided} />
              </Card>

              <Card padding={0}>
                <div style={{ padding: '16px 16px 12px' }}>
                  <CardHead title="Unresolved shortfall"
                    sub="Shorts with no surplus anywhere in the kit to pair against. These are missing units, not misplaced ones — and only this console may write one off."
                    right={<HDPill size="sm" tone={S.missingUnits ? 'blocked' : 'ok'} icon={false} style={monoStyle(P)} label={`${S.missingUnits} units`} />}
                    style={{ marginBottom: 0 }} />
                </div>
                <window.ScrollX label="Unresolved units table">
                  <HDTable>
                    <thead><tr style={{ background: P.surface2 }}>
                      <TH width={64}>Box</TH><TH>SKU</TH><TH align="right" width={72}>Missing</TH><TH>Most likely cause</TH>
                    </tr></thead>
                    <tbody>
                      {kit.unresolved.map((u) => (
                        <TR key={`${u.boxIndex}-${u.sku}`}>
                          <TD mono>Box {u.boxIndex}</TD>
                          <TD><SkuToken sku={u.sku} withName /></TD>
                          <TD align="right" mono style={{ color: HD.tone(P, u.maybeRescan ? 'info' : 'blocked').fg }}>{u.qty}</TD>
                          <TD style={{ fontSize: 12.5, color: P.inkDim }}>{u.cause}</TD>
                        </TR>))}
                    </tbody>
                  </HDTable>
                </window.ScrollX>
              </Card>
            </div>

            {/* ─── right column ─── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

              <Card>
                <CardHead title="Rescan queue"
                  right={<HDPill size="sm" tone="quarantine" icon={false} style={monoStyle(P)} label={`${S.rescan} units`} />} />
                <Callout tone="quarantine" icon="help" title="No location asserted" style={{ marginBottom: 12 }}>
                  The strongest read on each of these was below the <Mono>{dec.gateValue} dBm</Mono> gate. The module refuses to say which box they are in, and emits no move for them.
                </Callout>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {r.rescan.map((x, i) => (
                    <li key={x.epc} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <EpcChip value={x.epc} />
                        <div style={{ marginTop: 4, fontSize: 11.5, color: P.inkMute }}>heard nearest Box <Mono color={P.inkMute}>{x.nearestBox}</Mono> · not asserted</div>
                      </div>
                      <Dbm value={x.bestRssi} gate={dec.gateValue} />
                    </li>))}
                </ul>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${P.hairline}`, fontSize: 12.5, color: P.inkDim, lineHeight: 1.5 }}>
                  Until they are rescanned, <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{S.rescan}</span> of the short lines above may be phantom — the boxes those two units were heard nearest each read one short because of them.
                </div>
              </Card>

              <Card>
                <CardHead title="argmax vs. naive counting" sub="Same reads, both methods. This is why one EPC gets exactly one box." />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Method label="argmax (shipped)" value={S.assigned} tone="ok" note={<Mono color={P.inkDim}>{S.physical} physically present</Mono>} />
                  <Method label="naive per-box" value={S.naive} tone="blocked" note={<Mono color={P.inkDim}>{inflation.toFixed(2)}× inflation</Mono>} />
                </div>
                <div style={{ marginTop: 12, fontSize: 12.5, color: P.inkDim, lineHeight: 1.5 }}>
                  Counting each tag in every box it was heard in would have invented{' '}
                  <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{HD.formatNumber(S.naive - S.assigned)}</span>{' '}
                  units that do not exist — phantom excess an operator would have been sent to fix.
                </div>
              </Card>

              <Card>
                <CardHead title="Session" />
                <KV label="Session" value={kit.sessionId} />
                <KV label="Operator" value={kit.operator} mono={false} />
                <KV label="Reader" value={kit.device} />
                <KV label="RF power" value={`${kit.rfPower} dBm`} />
                <KV label="Confidence gate" value={`${dec.gateValue} dBm`} />
                <KV label="Started" value={HD.formatDateTime(kit.startedAt)} />
                <KV label="Submitted" value={HD.formatDateTime(kit.submittedAt)} />
                <KV label="Phantom counts avoided" value={HD.formatNumber(S.phantomUnitsAvoided)} />
                <KV label="Unknown EPCs" value={S.unknown} tone={S.unknown ? HD.tone(P, 'warn').fg : undefined} />
              </Card>

              <Card>
                <CardHead title="Activity" sub="Anything you decide on this page lands here first." />
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {activity.map((a, i) => {
                    const c = HD.tone(P, a.tone);
                    return (
                      <li key={a.at + a.action} style={{ display: 'flex', gap: 10, padding: '9px 0', borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
                        <span style={{ width: 7, height: 7, borderRadius: 99, background: c.fg, flex: '0 0 auto', marginTop: 6 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.ink2, fontVariantNumeric: 'tabular-nums' }}>{a.action}</div>
                          <div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 2, lineHeight: 1.45, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums' }}>{a.detail}</div>
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

        {/* Sticky decision bar. The handheld asserted; this is where a person
            decides. Same pattern as the pipeline's invoice detail. */}
        <div style={{ position: 'sticky', bottom: 0, background: P.surface, borderTop: `1px solid ${P.hairline2}`, padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', zIndex: 40 }}>
          <div style={{ flex: 1, minWidth: 220, fontSize: 12.5, color: P.inkDim }}>
            {dec.kit.status === 'approved'
              ? <React.Fragment>Posted by {dec.kit.by}. <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{S.assigned}</span> units written back to the distribution plan.</React.Fragment>
              : dec.kit.status === 'rejected'
              ? <React.Fragment>Rejected — sent back to {kit.device} for a full re-scan.</React.Fragment>
              : <React.Fragment>Approving posts <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{S.assigned}</span> assigned units, closes <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{S.moveGroups}</span> pull groups, and carries <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', color: P.ink }}>{S.missingUnits}</span> missing units as a kit exception.</React.Fragment>}
          </div>
          <PBtn size="sm" variant="ghost" icon="download" onClick={() => window.hdToast && window.hdToast({ title: 'Pull list exported', description: 'CSV, grouped by source box.', tone: 'ok' })}>Export pull list</PBtn>
          <PBtn size="sm" variant="secondary" icon="ban" disabled={decided} onClick={() => setModal('reject')}>Reject & re-scan</PBtn>
          <PBtn size="sm" variant="accent" icon="check-circle" disabled={decided} onClick={() => setModal('approve')}>
            {dec.kit.status === 'approved' ? 'Kit posted' : dec.kit.status === 'rejected' ? 'Kit rejected' : 'Approve & post kit'}
          </PBtn>
        </div>

        <ReasonModal open={modal === 'approve'} onClose={() => setModal(null)}
          title="Approve and post this kit" tone="ok" confirmLabel="Post the kit"
          placeholder="e.g. two units confirmed missing at the pack bench; shortfall raised with receiving"
          body={<React.Fragment>
            This writes <b><Mono>{S.assigned}</Mono></b> assigned units back to the distribution plan and closes the session.{' '}
            <b><Mono>{S.missingUnits}</Mono></b> unit{S.missingUnits === 1 ? '' : 's'} stay open as a kit exception, and{' '}
            <b><Mono>{S.rescan}</Mono></b> tag{S.rescan === 1 ? '' : 's'} in the rescan queue will never be located once the session closes.
            The floor cannot do this, and it cannot be undone from the handheld.
          </React.Fragment>}
          onConfirm={(reason) => { dec.approveKit(reason); window.hdToast && window.hdToast({ title: 'Kit posted', description: `${kit.id} accepted at ${S.assigned} units.`, tone: 'ok' }); }} />

        <ReasonModal open={modal === 'reject'} onClose={() => setModal(null)}
          title="Reject the kit and send it back" tone="blocked" confirmLabel="Reject & re-scan"
          placeholder="e.g. box 3 was scanned with the lid closed; counts are not trustworthy"
          body={<React.Fragment>
            Rejecting discards this reconciliation and reopens the session on <b><Mono>{kit.device}</Mono></b> at box <Mono>1</Mono>.
            Every read in it — <b><Mono>{window.HD.formatNumber(S.reads)}</Mono></b> of them — is invalidated, and the operator starts again.
          </React.Fragment>}
          onConfirm={(reason) => { dec.rejectKit(reason); window.hdToast && window.hdToast({ title: 'Kit rejected', description: `${kit.id} sent back to ${kit.device}.`, tone: 'warn' }); }} />
      </div>);
  };
})();
