// ── #/kits/:id — Distribution › Kit build (Hyperdrive Logistics) ───────────
// TODAY: five boxes, a printed pick sheet, and a clipboard. The screen already
// owns the plan; the only thing missing is a trustworthy count.
// WITH RFID: the same screen, same table, same plan column — the "Counted"
// input becomes a scanned, argmax-assigned number, and two panels appear that
// only a per-unit count can produce: the pull list and the rescan queue.
;(function () {
  const useP = window.useP;
  const D = () => window.RFID_DATA;

  // ── Session strip ───────────────────────────────────────────────────────
  function SessionStrip() {
    const P = useP();
    const K = D().KIT, S = K.session;
    const maxHeard = Math.max(...D().BOX_SCANS.map((b) => b.heard));
    const meta = (label, value, title) => (
      <div title={title} style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingRight: 18, borderRight: `1px solid ${P.hairline}`, marginRight: 18 }}>
        <MicroLabel>{label}</MicroLabel>
        <window.Num size={13.5}>{value}</window.Num>
      </div>);
    return (
      <window.RfidPanel isNew pad={0}
        title={'Scan session ' + S.id}
        sub={'One handheld · five box scans · ' + S.startedAt + ' → ' + S.finishedAt}
        right={<HDPill tone="ok" size="sm" label="Complete" />}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: 12, padding: '14px 16px', background: P.surface2, borderBottom: `1px solid ${P.hairline2}` }}>
          {meta('Device', S.device, 'Zebra TC22R integrated handheld — the only reader on site')}
          {meta('Battery', S.battery + '%')}
          {meta('RF power', S.powerDbm + ' dBm', 'Deliberately reduced — reduced power is half of why argmax isolates one box')}
          {meta('Confidence gate', S.gateDbm + ' dBm', 'Strongest read below this asserts no location')}
          {meta('Reads ingested', S.totalReads.toLocaleString())}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <MicroLabel>Units located</MicroLabel>
            <window.Num size={13.5}>{S.located} <span style={{ color: P.inkMute }}>of {K.plannedUnits}</span></window.Num>
          </div>
        </div>
        <div style={{ padding: '10px 16px 14px' }}>
          {D().BOX_SCANS.map((b) => (
            <div key={b.boxIndex} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', borderTop: b.boxIndex === 1 ? 'none' : `1px solid ${P.hairline}` }}>
              <span style={{ width: 52, fontSize: 12.5, color: P.inkDim }}>Box {b.boxIndex}</span>
              <div title={b.heard + ' tags heard \u00b7 ' + b.assigned + ' kept by argmax'}
                style={{ flex: 1, minWidth: 90, height: 8, borderRadius: 99, background: P.surface3, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: (b.heard / maxHeard * 100) + '%', background: P.hairline3, borderRadius: 99 }} />
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: (b.assigned / maxHeard * 100) + '%', background: P.info, borderRadius: 99 }} />
              </div>
              <span style={{ width: 108, textAlign: 'right' }}><window.Num size={12.5} color={P.inkMute}>{b.heard} heard</window.Num></span>
              <span style={{ width: 108, textAlign: 'right' }}><window.Num size={12.5}>{b.assigned} assigned</window.Num></span>
              <span style={{ width: 62, textAlign: 'right' }}><window.Num size={12.5} color={P.inkMute}>{b.seconds}s</window.Num></span>
              <span style={{ width: 78, textAlign: 'right' }}><window.Num size={12.5} color={P.inkMute}>{b.medianRssi} dBm</window.Num></span>
            </div>))}
          <div style={{ marginTop: 10, fontSize: 11.5, color: P.inkMute, lineHeight: 1.5 }}>
            The pale bar is every tag the reader heard during that box's scan; the solid bar is what argmax kept.
            The gap between them is neighbour bleed — real reads from the boxes either side, which is why a tag is
            assigned to exactly one box rather than counted in each.
          </div>
        </div>
      </window.RfidPanel>);
  }

  // ── The reconciliation table — the same table in both states ────────────
  function BoxTable({ rfid, counted, setCounted }) {
    const P = useP();
    const lines = D().LINES;
    const boxes = [1, 2, 3, 4, 5];
    const cell = { padding: '9px 12px', borderBottom: `1px solid ${P.hairline}`, verticalAlign: 'middle' };
    return (
      <div style={{ overflowX: 'auto' }}>
        <HDTable>
          <thead>
            <tr>
              <TH width="42%">Product</TH>
              <TH align="right" width={92}>Planned</TH>
              <TH align="right" width={rfid ? 108 : 128}>{rfid ? 'Scanned' : 'Counted'}</TH>
              <TH align="right" width={70}>Δ</TH>
              <TH width={140}>State</TH>
            </tr>
          </thead>
          <tbody>
            {boxes.map((b) => {
              const rows = lines.filter((l) => l.boxIndex === b);
              const planned = rows.reduce((n, l) => n + l.planned, 0);
              const actual = rows.reduce((n, l) => n + l.actual, 0);
              const done = counted[b];
              return (
                <React.Fragment key={b}>
                  <tr>
                    <td colSpan={5} style={{ padding: '10px 12px', background: P.surface3, borderBottom: `1px solid ${P.hairline2}`, borderTop: `1px solid ${P.hairline2}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: P.ink }}>Box {b}</span>
                        <span style={{ fontSize: 11.5, color: P.inkMute }}>{rows.length} product lines</span>
                        <div style={{ flex: 1 }} />
                        <window.Num size={12.5} color={P.inkMute}>{planned} planned</window.Num>
                        {rfid
                          ? <window.Num size={12.5}>{actual} scanned</window.Num>
                          : done
                            ? <window.Num size={12.5}>{planned} counted</window.Num>
                            : <span style={{ fontSize: 12.5, color: P.inkMute }}>not counted</span>}
                      </div>
                    </td>
                  </tr>
                  {rows.map((l) => {
                    const show = rfid || done;
                    const value = rfid ? l.actual : l.planned;   // a box hand-counted to plan
                    const delta = rfid ? l.delta : 0;
                    const state = rfid ? l.state : 'correct';
                    return (
                      <tr key={b + l.sku} style={{ background: rfid && l.state !== 'correct' ? P.surface2 : 'transparent' }}>
                        <td style={cell}><window.RfidSkuCell sku={l.sku} /></td>
                        <td style={{ ...cell, textAlign: 'right' }}>
                          {l.planned === 0
                            ? <span style={{ fontSize: 12.5, color: P.inkMute }}>not planned</span>
                            : <window.Num>{l.planned}</window.Num>}
                        </td>
                        <td style={{ ...cell, textAlign: 'right' }}>
                          {rfid
                            ? <window.Num weight={600}>{l.actual}</window.Num>
                            : done
                              ? <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                  <Field size="sm" mono full={false} value={String(value)} onChange={() => {}} style={{ width: 84, textAlign: 'right' }} />
                                </div>
                              : <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                  <Field size="sm" mono full={false} value="" onChange={() => {}} placeholder="—" style={{ width: 84 }} />
                                </div>}
                        </td>
                        <td style={{ ...cell, textAlign: 'right' }}>
                          {show ? <window.Delta value={delta} /> : <span style={{ color: P.inkFaint }}>—</span>}
                        </td>
                        <td style={cell}>
                          {show ? <window.RfidStatePill state={state} /> : <span style={{ fontSize: 12.5, color: P.inkFaint }}>Awaiting count</span>}
                        </td>
                      </tr>);
                  })}
                </React.Fragment>);
            })}
          </tbody>
        </HDTable>
      </div>);
  }

  // ── Pull list — grouped by SOURCE box ───────────────────────────────────
  function PullList() {
    const P = useP();
    return (
      <window.RfidPanel isNew title="Pull list" sub="Grouped by source box — one box at a time" pad={0}
        right={<window.Num size={12.5} color={P.inkMute}>{D().lineCounts.moves} moves</window.Num>}>
        {D().MOVES.map((g, i) => (
          <div key={g.fromBox} style={{ padding: '12px 16px', borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: P.ink }}>Pull from Box {g.fromBox}</span>
              <window.Num size={11.5} color={P.inkMute}>{g.totalUnits} units</window.Num>
            </div>
            {g.items.map((it) => (
              <div key={it.sku + it.toBox} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: P.r8, background: P.surface2, marginBottom: 6 }}>
                <window.Num size={15} weight={600}>{it.qty}×</window.Num>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: P.fontMono, fontSize: 12, color: P.ink2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.sku}</div>
                  <div style={{ fontSize: 11.5, color: P.inkMute }}>{D().bySku[it.sku].name}</div>
                </div>
                <Icon name="arrow-right" size={14} stroke={2} color={P.inkMute} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap' }}>Box {it.toBox}</span>
              </div>))}
          </div>))}
        <div style={{ padding: '10px 16px 14px', borderTop: `1px solid ${P.hairline}`, fontSize: 11.5, color: P.inkMute, lineHeight: 1.5 }}>
          Units are fungible per SKU: any two units of the SKU satisfy the move. Nobody is sent to hunt a serial number.
        </div>
      </window.RfidPanel>);
  }

  function RescanPanel() {
    const P = useP();
    return (
      <window.RfidPanel isNew title="Rescan" sub="Below the confidence gate — no location asserted" pad={0}
        right={<HDPill tone="warn" size="sm" label={D().RESCAN.length + ' units'} />}>
        {D().RESCAN.map((r, i) => (
          <div key={r.epc} style={{ padding: '11px 16px', borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <window.Num size={11.5} color={P.inkDim}>{r.epc}</window.Num>
              <div style={{ flex: 1 }} />
              <window.Num size={12.5} color={P.bad} weight={600}>{r.bestRssi} dBm</window.Num>
            </div>
            <div style={{ fontSize: 12.5, color: P.ink2, marginTop: 3 }}>{D().bySku[r.sku].name}</div>
            <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 2 }}>{r.note}</div>
          </div>))}
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${P.hairline}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, fontSize: 11.5, color: P.inkMute, lineHeight: 1.5 }}>
            Two of Box 4's four short gummies are these. They are not a move — the module refuses to guess a box.
          </div>
          <PBtn size="sm" variant="secondary" icon="refresh" onClick={() => window.hdToast?.({ title: 'Rescan queued', description: 'Box 4 and Box 5 — walk the wall side slowly.', tone: 'info' })}>Rescan</PBtn>
        </div>
      </window.RfidPanel>);
  }

  function AntiPattern() {
    const P = useP();
    const a = D().KIT.antiPattern;
    const col = (label, value, color, sub) => (
      <div style={{ flex: 1, minWidth: 0, padding: 12, borderRadius: P.r8, background: P.surface2, border: `1px solid ${P.hairline}` }}>
        <MicroLabel>{label}</MicroLabel>
        <div style={{ marginTop: 5 }}><window.Num size={21} weight={600} color={color}>{value}</window.Num></div>
        <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>
      </div>);
    return (
      <window.RfidPanel isNew title="Why the count is believable" sub="Telemetry only — never acted on">
        <div style={{ display: 'flex', gap: 10 }}>
          {col('argmax', a.argmaxUnits, P.good, a.physicalUnits + ' physically present')}
          {col('Naive per-box', a.naiveUnits, P.bad, a.inflation + '× inflation')}
        </div>
        <div style={{ marginTop: 12, fontSize: 12.5, color: P.inkDim, lineHeight: 1.5 }}>
          Counting each tag in every box it was heard in would have invented{' '}
          <window.Num size={12.5} weight={600}>{a.phantomAvoided}</window.Num> units that do not exist — phantom excess
          an operator would have been sent to "fix".
        </div>
      </window.RfidPanel>);
  }

  // ── Handheld — the same route at phone width ────────────────────────────
  function Handheld() {
    const P = useP();
    const K = D().KIT, S = K.session;
    const scans = D().BOX_SCANS;
    const maxA = Math.max(...scans.map((s) => s.assigned));
    return (
      <window.RfidPanel isNew title="On the TC22R" sub="The same route, rendered at 360px in the device WebView">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ width: 340, flex: '0 0 auto', padding: 10, borderRadius: 30, background: P.rail, boxShadow: P.shadowLg }}>
            <div style={{ borderRadius: 21, overflow: 'hidden', background: P.bg }}>
              {/* device status bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: P.surface3, borderBottom: `1px solid ${P.hairline2}` }}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: P.good }} />
                <window.Num size={10} color={P.inkDim}>{S.device}</window.Num>
                <div style={{ flex: 1 }} />
                <window.Num size={10} color={P.inkDim}>{S.powerDbm} dBm</window.Num>
                <window.Num size={10} color={P.inkDim}>{S.battery}%</window.Num>
              </div>
              {/* header */}
              <div style={{ padding: '12px 14px', background: P.surface, borderBottom: `1px solid ${P.hairline2}` }}>
                <MicroLabel>Distribution · kit build</MicroLabel>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 3 }}>
                  <window.Num size={16} weight={600}>{K.id}</window.Num>
                  <span style={{ fontSize: 11.5, color: P.inkMute }}>{K.run}</span>
                </div>
              </div>
              {/* boxes */}
              <div style={{ padding: '10px 14px' }}>
                {scans.map((s) => (
                  <div key={s.boxIndex} style={{ display: 'flex', alignItems: 'center', gap: 9, height: 34 }}>
                    <span style={{ width: 44, fontSize: 12, color: P.inkDim }}>Box {s.boxIndex}</span>
                    <div style={{ flex: 1 }}><BarMeter value={s.assigned} max={maxA} height={8} color={P.info} /></div>
                    <Icon name="check-circle" size={13} stroke={2} color={P.good} />
                    <window.Num size={12} weight={600} style={{ width: 34, textAlign: 'right' }}>{s.assigned}</window.Num>
                  </div>))}
              </div>
              {/* result */}
              <div style={{ margin: '4px 14px 12px', padding: 12, borderRadius: P.r10, background: P.warnSoft, border: `1px solid ${P.warn}44` }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: P.warn }}>3 moves · 2 rescans</div>
                <div style={{ fontSize: 11.5, color: P.ink2, marginTop: 4, lineHeight: 1.45 }}>
                  Next: pull <b>3× Blue Dream 3.5g</b> from Box 4 → Box 2.
                </div>
              </div>
              {/* trigger — ink, because the page's one accent belongs to Accept */}
              <div style={{ padding: '0 14px 14px' }}>
                <button style={{ width: '100%', minHeight: 56, borderRadius: P.r12, border: 'none', background: P.ink, color: P.surface, fontFamily: P.fontSans, fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>
                  <Icon name="scan" size={18} stroke={2} />Start move · Box 4
                </button>
                <div style={{ marginTop: 8, textAlign: 'center', fontSize: 11, color: P.inkMute }}>Hardware trigger works too</div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 13.5, color: P.ink2, lineHeight: 1.6 }}>
              There is no separate operator app. The handheld loads the same kit-build route this page is showing,
              at phone width, in the Android WebView shell — so a picker who already knows the desk screen already
              knows the device screen.
            </div>
            <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['zap', 'Touch targets on the device layout are 56px; the desk layout keeps the 34px control height.'],
                ['shield', 'RF power and the trigger belong to the native shell. Everything above the radio is this web app.'],
                ['clock', 'Five box scans, ' + scans.reduce((n, s) => n + s.seconds, 0) + ' seconds of trigger time, against ' + K.manualMinutes + ' minutes of hand counting.'],
              ].map(([icon, text]) => (
                <li key={text} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ width: 26, height: 26, borderRadius: P.r8, background: P.surface3, color: P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                    <Icon name={icon} size={13} stroke={1.9} />
                  </span>
                  <span style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.5 }}>{text}</span>
                </li>))}
            </ul>
          </div>
        </div>
      </window.RfidPanel>);
  }

  // ── Today's right-hand column ───────────────────────────────────────────
  function TodayAside({ counted }) {
    const P = useP();
    const done = Object.values(counted).filter(Boolean).length;
    return (
      <React.Fragment>
        <window.RfidPanel title="Variance" sub="Computed once every box is counted" pad={0}>
          <window.EmptyState compact icon="list" title={done + ' of 5 boxes counted'}
            body="Nothing can be diffed against the plan until the clipboard comes back. Boxes 3–5 are still open." />
        </window.RfidPanel>
        <window.RfidPanel title="What the count costs today">
          {[
            ['clock', D().KIT.manualMinutes + ' min', 'Two people, one clipboard, per kit.'],
            ['eye', 'No evidence', 'The count is a number typed into this box. Nothing records which units were where.'],
            ['refresh', 'Not repeatable', 'A recount means counting again from zero.'],
          ].map(([icon, head, body]) => (
            <div key={head} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', padding: '9px 0', borderTop: head === D().KIT.manualMinutes + ' min' ? 'none' : `1px solid ${P.hairline}` }}>
              <span style={{ width: 28, height: 28, borderRadius: P.r8, background: P.surface3, color: P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                <Icon name={icon} size={14} stroke={1.9} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: P.ink }}>{head}</div>
                <div style={{ fontSize: 12, color: P.inkMute, marginTop: 2, lineHeight: 1.45 }}>{body}</div>
              </div>
            </div>))}
        </window.RfidPanel>
      </React.Fragment>);
  }

  // ── Screen ──────────────────────────────────────────────────────────────
  window.RfidScreenKits = function RfidScreenKits({ rfid, app, navigate }) {
    const P = useP();
    const K = D().KIT, C = D().lineCounts;
    const counted = { 1: true, 2: true, 3: false, 4: false, 5: false };

    const metaPills = [
      <HDPill key="run" tone="info" size="sm" icon={false} label={K.run} />,
      <span key="a" style={{ fontSize: 12.5, color: P.inkMute }}>Packed by {K.packedBy}</span>,
      <span key="b" style={{ fontSize: 12.5, color: P.inkMute }}>·</span>,
      <span key="c" style={{ fontSize: 12.5, color: P.inkMute }}>{K.stagedAt}</span>,
    ];

    const action = rfid
      ? <React.Fragment>
          <PBtn size="sm" variant="secondary" icon="printer" onClick={() => window.hdToast?.({ title: 'Pull list sent to ZT411-DOCK3', tone: 'info' })}>Print pull list</PBtn>
          <PBtn size="sm" variant="accent" icon="check" onClick={() => window.hdToast?.({ title: 'Kit accepted', description: '3 moves outstanding — the run will not seal until they clear.', tone: 'warn' })}>Accept kit</PBtn>
        </React.Fragment>
      : <React.Fragment>
          <PBtn size="sm" variant="secondary" icon="printer" onClick={() => window.hdToast?.({ title: 'Pick sheet printed', tone: 'info' })}>Print pick sheet</PBtn>
          <PBtn size="sm" variant="accent" icon="check" onClick={() => window.hdToast?.({ title: 'Cannot verify yet', description: 'Boxes 3–5 have not been counted.', tone: 'warn' })}>Mark verified</PBtn>
        </React.Fragment>;

    return (
      <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <window.RfidPageHead app={app} rfid={rfid} title={'Kit ' + K.id}
          sub={rfid
            ? 'Five boxes, 700 planned units. Each tag was assigned to the one box it read strongest in, then per-box SKU counts were diffed against this kit’s plan.'
            : 'Five boxes, 700 planned units. The plan is already here; the count is a clipboard walking the dock.'}
          meta={metaPills} action={action} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <StatTile icon="box" label="Boxes" value={String(K.boxes)} hue="blue" />
          <StatTile icon="package" label="Units planned" value={K.plannedUnits.toLocaleString()} hue="teal" />
          {rfid
            ? <React.Fragment>
                <StatTile icon="check-circle" label="Units located" value={K.session.located.toLocaleString()} hue="ok" progress={K.session.located / K.plannedUnits} sub={'gate ' + K.session.gateDbm + ' dBm'} />
                <StatTile icon="flag" label="Lines off plan" value={String(C.short + C.excess + C.wrongProduct)} hue="warn" sub={C.short + ' short · ' + C.excess + ' excess · ' + C.wrongProduct + ' wrong product'} />
                <StatTile icon="refresh" label="Rescan" value={String(C.rescan)} hue="neutral" sub="no location asserted" />
              </React.Fragment>
            : <React.Fragment>
                <StatTile icon="list" label="Boxes counted" value="2 / 5" hue="warn" progress={0.4} sub="18 min in" />
                <StatTile icon="flag" label="Lines off plan" value="—" hue="neutral" sub="unknown until the count finishes" />
                <StatTile icon="clock" label="Typical hand count" value={K.manualMinutes + ' min'} hue="neutral" sub="two people, per kit" />
              </React.Fragment>}
        </div>

        {rfid && <SessionStrip />}

        <div className="hd-2col">
          <window.RfidPanel pad={0}
            title={rfid ? 'Plan vs scanned' : 'Plan vs counted'}
            sub={rfid ? '21 product lines across five boxes · argmax-assigned, deduped by EPC' : '21 product lines across five boxes · enter counts as boxes come back'}
            right={rfid ? <window.RfidTag label="COUNT" title="The plan column is unchanged — only the count column changed source" /> : undefined}>
            <BoxTable rfid={rfid} counted={counted} />
          </window.RfidPanel>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
            {rfid
              ? <React.Fragment><PullList /><RescanPanel /><AntiPattern /></React.Fragment>
              : <TodayAside counted={counted} />}
          </div>
        </div>

        {rfid && <Handheld />}
      </div>);
  };
})();
