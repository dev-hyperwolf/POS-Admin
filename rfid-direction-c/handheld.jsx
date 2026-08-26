// ── RFID Direction C — the handheld (TC22R) screens ────────────────────────
// This is the primary surface. Everything here is designed for a 6-inch screen
// held in one hand in a packing room: one question per screen, the answer in a
// band you can read while moving, the action pinned under the thumb.
;(function () {
  const useP = window.useP;
  const HD = () => window.HD;
  const R = () => window.RFID;

  const plannedFor = (b) => Object.values(window.RFID.PLAN[b]).reduce((n, v) => n + v, 0);
  const actualFor = (b) => Object.values(window.RFID.ACTUAL[b]).reduce((n, v) => n + v, 0);
  const linesFor = (b) => window.RFID.LINES.filter((l) => l.boxIndex === b);

  function SkuLead({ sku, size }) {
    const s = window.RFID.skuOf(sku);
    return <window.CatDot cat={s.cat} size={size || 34} label={s.sku.slice(0, 3)} />;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1 · KIT VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════

  function KitPickup({ go }) {
    const P = useP(), K = R().KIT;
    return (<>
      <window.HHBar title="Kit verification" sub={K.id} right={<window.Pill kind="neutral" size="sm">{K.reader}</window.Pill>} />
      <window.HHBand tone="info" icon="package" title="Kit staged" value="5 boxes"
        sub={`${K.plannedUnits} units planned · ${K.route}`} />
      <window.HHBody>
        <div style={{ fontSize: 11.5, color: P.inkMute, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '2px 2px 0' }}>Scan order</div>
        {[1, 2, 3, 4, 5].map((b) => (
          <window.HHRow key={b}
            lead={<span style={{ width: 34, height: 34, borderRadius: 9, background: P.surface3, color: P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: P.fontMono, fontSize: 15, fontWeight: 700, flex: '0 0 auto' }}>{b}</span>}
            title={`Box ${b}`}
            sub={`${Object.keys(R().PLAN[b]).length} SKUs planned`}
            value={plannedFor(b)} valueSub="units" />))}
        <window.HHMeta items={[
          { label: 'RF power', value: `${K.power} dBm (reduced)` },
          { label: 'Confidence gate', value: `${K.gate} dBm` },
          { label: 'Reader', value: K.device, mono: false },
          { label: 'Opened', value: R().fmtClock(K.openedAt) },
        ]} />
        <div style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.45, padding: '2px 2px 8px' }}>
          Scan one box at a time. Every tag is credited to the single box it read strongest in, so
          a neighbour box bleeding into this read never double-counts.
        </div>
      </window.HHBody>
      <window.HHDock note="Squeeze and hold either side trigger to read.">
        <window.HHAction icon="scan" onClick={() => go('scan')} sub={`${plannedFor(1)} units planned`}>Scan Box 1</window.HHAction>
      </window.HHDock>
    </>);
  }

  function KitScanning({ go }) {
    const P = useP(), K = R().KIT, box = 3;
    const [live, setLive] = React.useState({ unique: 0, reads: 0, s: 0 });
    const target = R().BOXES[box - 1];
    React.useEffect(() => {
      let f = 0;
      const t = setInterval(() => {
        f += 1;
        const k = Math.min(1, f / 26);
        const e = 1 - Math.pow(1 - k, 2.2);
        setLive({ unique: Math.round(target.unique * e), reads: Math.round(target.reads * e), s: Math.round(target.seconds * e) });
        if (k >= 1) clearInterval(t);
      }, 90);
      return () => clearInterval(t);
    }, []);
    const running = live.unique < target.unique;
    const seen = R().ACTUAL[box];
    return (<>
      <window.HHBar title={`Box ${box} of 5`} sub={`${K.id} · ${plannedFor(box)} planned`} onBack={() => go('pickup')} />
      <window.HHScanField scanning={running} unique={live.unique} reads={live.reads} seconds={live.s} gate={K.gate} power={K.power} />
      <window.HHBody pad={12} style={{ gap: 6 }}>
        <div style={{ fontSize: 11.5, color: P.inkMute, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '0 2px' }}>Seen in this box</div>
        {Object.keys(seen).map((sku) => {
          const s = R().skuOf(sku);
          const n = Math.round(seen[sku] * Math.min(1, live.unique / target.unique || 0));
          return <window.HHRow key={sku} lead={<SkuLead sku={sku} />} title={s.name} sub={sku} value={n} valueSub={s.unit + 's'} />;
        })}
        <div style={{ fontSize: 12, color: P.inkMute, lineHeight: 1.4, padding: '4px 2px' }}>
          Counts settle as reads arrive. Nothing is compared to the plan until the box is locked.
        </div>
      </window.HHBody>
      <window.HHDock note={running ? 'Keep the trigger held — sweep the box top to bottom.' : 'Release the trigger, then lock the box.'}>
        <window.HHAction icon="lock" variant={running ? 'quiet' : 'accent'} disabled={running}
          onClick={() => go('box')} sub={`${live.unique} unique tags`}>Lock Box {box}</window.HHAction>
      </window.HHDock>
    </>);
  }

  function KitBoxResult({ go }) {
    const P = useP(), box = 3;
    const ls = linesFor(box);
    const bad = ls.filter((l) => l.state !== 'correct');
    const worst = bad[0];
    const s = worst ? R().skuOf(worst.sku) : null;
    return (<>
      <window.HHBar title={`Box ${box} result`} sub={`${actualFor(box)} of ${plannedFor(box)} units`} onBack={() => go('scan')} />
      <window.HHBand tone={R().STATE_TONE[worst.state]} icon="alert" title={`Box ${box} · ${R().STATE_LABEL[worst.state]}`}
        value={(worst.delta > 0 ? '+' : '') + worst.delta}
        sub={`${s.name} — ${worst.actual} of ${worst.planned} ${s.unit}s. Everything else in this box is correct.`} />
      <window.HHBody>
        {ls.map((l) => {
          const sk = R().skuOf(l.sku);
          return (
            <window.HHRow key={l.sku} lead={<SkuLead sku={l.sku} />} title={sk.name}
              sub={`${l.actual} of ${l.planned} · ${l.sku}`}
              value={l.state === 'correct' ? '✓' : (l.delta > 0 ? '+' : '') + l.delta}
              valueSub={R().STATE_LABEL[l.state].toLowerCase()}
              tone={R().STATE_TONE[l.state]} />);
        })}
        <window.HHMeta items={[
          { label: 'Read for', value: R().fmtDur(R().BOXES[box - 1].seconds) },
          { label: 'Avg RSSI', value: `${R().BOXES[box - 1].avgRssi} dBm` },
          { label: 'Bleed rejected', value: `${R().BOXES[box - 1].bleedRejected} reads` },
          { label: 'Assigned here', value: `${R().BOXES[box - 1].unique} tags` },
        ]} />
      </window.HHBody>
      <window.HHDock note="Box 3 is locked. Moves are decided once every box is in.">
        <window.HHAction icon="arrow-right" onClick={() => go('kit')} sub={`${plannedFor(4)} units planned`}>Next — Box 4</window.HHAction>
      </window.HHDock>
    </>);
  }

  function KitVerdict({ go }) {
    const P = useP(), S = R().KIT_SUMMARY;
    return (<>
      <window.HHBar title="Kit verdict" sub={R().KIT.id} onBack={() => go('box')} />
      <window.HHBand tone="warn" icon="flag" title="Review — 2 moves" value={`${S.assigned} / ${S.planned}`}
        sub="5 boxes read. Two lines can be fixed by moving product between boxes; two cannot." />
      <window.HHBody>
        <div style={{ display: 'flex', gap: 8 }}>
          <window.HHStat label="Correct" value={S.correct} sub="lines" tone="ok" />
          <window.HHStat label="Short" value={S.short} sub="lines" tone="blocked" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <window.HHStat label="Excess" value={S.excess} sub="lines" tone="warn" />
          <window.HHStat label="Wrong product" value={S.wrong} sub="lines" tone="quarantine" />
        </div>
        <window.HHRow lead={<span style={{ width: 34, height: 34, borderRadius: 9, background: HD().tone(P, 'info').bg, color: HD().tone(P, 'info').fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="refresh" size={17} stroke={2} /></span>}
          title="Rescan queue" sub="Below the confidence gate — no box asserted" value={S.rescan} valueSub="tags" tone="info"
          onClick={() => go('rescan')} />
        <window.HHRow lead={<span style={{ width: 34, height: 34, borderRadius: 9, background: P.surface3, color: P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="help" size={17} stroke={2} /></span>}
          title="Unregistered EPC" sub="Read clearly, but not in the tag registry" value={S.unknown} valueSub="tag" />
        <window.HHMeta items={[
          { label: 'Scanned', value: `${S.scanned} tags` },
          { label: 'Assigned', value: `${S.assigned} tags` },
          { label: 'Bleed rejected', value: `${S.phantomUnitsAvoided} reads` },
          { label: 'Gate', value: `${R().KIT.gate} dBm` },
        ]} />
      </window.HHBody>
      <window.HHDock>
        <window.HHAction icon="list" onClick={() => go('pull')} sub={`${S.moves} units across 2 boxes`}>Open pull list</window.HHAction>
      </window.HHDock>
    </>);
  }

  function KitPullList({ go }) {
    const P = useP();
    const groups = R().MOVE_GROUPS;
    const [done, setDone] = React.useState({});
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    const doneCount = Object.values(done).filter(Boolean).length;
    const unresolved = R().UNRESOLVED;
    return (<>
      <window.HHBar title="Pull list" sub={`${groups.length} source boxes · ${R().KIT_SUMMARY.moves} units`} onBack={() => go('kit')} />
      <window.HHBand tone={doneCount === total ? 'ok' : 'neutral'} icon="package"
        title={doneCount === total ? 'All moves done' : 'Work one box at a time'}
        value={`${doneCount} / ${total}`} sub="Any unit of the SKU will do — never hunt a specific tag." />
      <window.HHBody>
        {groups.map((g) => (
          <div key={g.fromBox} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 2px 0' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: P.ink }}>Pull from Box {g.fromBox}</span>
              <span style={{ flex: 1, height: 1, background: P.hairline }} />
              <span style={{ fontFamily: P.fontMono, fontSize: 12, color: P.inkMute, fontVariantNumeric: 'tabular-nums' }}>{g.totalUnits} units</span>
            </div>
            {g.items.map((it, i) => {
              const key = g.fromBox + ':' + it.sku + ':' + it.toBox;
              const s = R().skuOf(it.sku);
              const on = !!done[key];
              return (
                <window.HHRow key={i} done={on} onClick={() => setDone((d) => ({ ...d, [key]: !d[key] }))}
                  lead={<span style={{ width: 34, height: 34, borderRadius: 99, border: `2px solid ${on ? P.ink : P.hairline3}`, background: on ? P.ink : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                    {on && <Icon name="check" size={18} stroke={3} color={P.surface} />}</span>}
                  title={`${it.qty} × ${s.name}`}
                  sub={`${it.sku} · ${s.brand}`}
                  value={`→ ${it.toBox}`} valueSub="box" />);
            })}
          </div>))}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 2px 0' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: P.ink }}>Moving won’t fix these</span>
          <span style={{ flex: 1, height: 1, background: P.hairline }} />
        </div>
        {unresolved.map((u, i) => {
          const s = R().skuOf(u.sku);
          return (
            <window.HHRow key={i} lead={<SkuLead sku={u.sku} />}
              title={`${u.qty} × ${s.name}`}
              sub={u.kind === 'shortfall' ? `Box ${u.boxIndex} is short — no box has spare` : `Box ${u.boxIndex} has extra — no box needs it`}
              value={u.kind === 'shortfall' ? `−${u.qty}` : `+${u.qty}`} valueSub={u.kind}
              tone={u.kind === 'shortfall' ? 'blocked' : 'warn'} />);
        })}
        <div style={{ fontSize: 12, color: P.inkMute, lineHeight: 1.45, padding: '2px 2px 8px' }}>
          These two go to the supervisor as a kit shortfall and a kit overage — they are a picking
          or receiving problem, not a rebalance.
        </div>
      </window.HHBody>
      <window.HHDock note={doneCount < total ? `${total - doneCount} move${total - doneCount === 1 ? '' : 's'} left before you can submit.` : 'Submitting locks the kit for supervisor approval.'}>
        <window.HHAction icon="check-circle" disabled={doneCount < total} onClick={() => window.hdToast?.({ title: 'Kit submitted', description: 'KIT-2026-0824-03 sent for supervisor approval.', tone: 'ok' })}
          sub={`${doneCount} of ${total} moves confirmed`}>Submit kit</window.HHAction>
      </window.HHDock>
    </>);
  }

  function KitRescan({ go }) {
    const P = useP();
    return (<>
      <window.HHBar title="Rescan queue" sub={`gate ${R().KIT.gate} dBm`} onBack={() => go('kit')} />
      <window.HHBand tone="info" icon="refresh" title="No location asserted" value={R().RESCAN.length}
        sub="Their strongest read was below the gate. No box was blamed and no move was suggested." />
      <window.HHBody>
        {R().RESCAN.map((t) => {
          const s = R().skuOf(t.sku);
          return (
            <window.HHRow key={t.epc} lead={<SkuLead sku={t.sku} />} title={s.name}
              sub={R().shortEpc(t.epc)} value={t.bestRssi} valueSub="dBm best" tone="info" />);
        })}
        <window.HHMeta items={[
          { label: 'Gate', value: `${R().KIT.gate} dBm` },
          { label: 'Power', value: `${R().KIT.power} dBm` },
          { label: 'Likeliest box', value: 'not asserted', mono: false },
          { label: 'Moves emitted', value: '0' },
        ]} />
        <div style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.45, padding: '2px 2px 8px' }}>
          Hold the reader within arm’s length of one box at a time. If a tag still will not clear the
          gate, it is probably foil-lined or wedged against metal — flag it instead of guessing.
        </div>
      </window.HHBody>
      <window.HHDock note="Re-reading a single box does not re-open the boxes already locked.">
        <window.HHAction icon="scan" onClick={() => go('scan')} sub="2 tags to re-read">Rescan up close</window.HHAction>
      </window.HHDock>
    </>);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2 · CYCLE COUNT
  // ═══════════════════════════════════════════════════════════════════════════

  function CountStart({ go }) {
    const P = useP();
    const [room, setRoom] = React.useState(R().ROOMS[0].id);
    const r = R().ROOMS.find((x) => x.id === room);
    return (<>
      <window.HHBar title="Cycle count" sub="Walk-scan · deduped by EPC" />
      <window.HHBand tone="neutral" icon="grid" title="Expected on hand" value={r.expected}
        sub={`${r.name} · last counted ${R().fmtClock(r.at)} by ${r.operator}`} />
      <window.HHBody>
        <window.HHChips value={room} onChange={setRoom} options={R().ROOMS.map((x) => ({ value: x.id, label: x.name, count: x.expected }))} />
        <window.HHMeta items={[
          { label: 'Pass bar', value: '98.0% coverage' },
          { label: 'Last verdict', value: r.verdict, mono: false },
          { label: 'Last coverage', value: `${r.coverage}%` },
          { label: 'Reader', value: R().KIT.reader },
        ]} />
        <div style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.45, padding: '2px 2px' }}>
          Walk every aisle at a steady pace with the trigger held. Reads dedupe by EPC, so covering
          the same shelf twice costs time and never accuracy.
        </div>
        <div style={{ padding: '10px 12px', background: HD().tone(P, 'warn').bg, border: `1px solid ${HD().tone(P, 'warn').fg}44`, borderRadius: P.r12, display: 'flex', gap: 9 }}>
          <Icon name="alert" size={16} stroke={2} color={HD().tone(P, 'warn').fg} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <span style={{ fontSize: 12.5, color: P.ink2, lineHeight: 1.4 }}>
            One reader exists. Multi-operator dedupe is designed but cannot be validated until a
            second TC22R lands.
          </span>
        </div>
      </window.HHBody>
      <window.HHDock note="The count runs until you end it — there is no timer.">
        <window.HHAction icon="play" onClick={() => go('walk')} sub={`${r.expected} units expected`}>Start walk</window.HHAction>
      </window.HHDock>
    </>);
  }

  function CountWalk({ go }) {
    const P = useP(), W = R().WALK;
    const [n, setN] = React.useState(0);
    React.useEffect(() => {
      let f = 0;
      const t = setInterval(() => { f += 1; const k = Math.min(1, f / 30); setN(Math.round(W.uniqueSoFar * (1 - Math.pow(1 - k, 2)))); if (k >= 1) clearInterval(t); }, 90);
      return () => clearInterval(t);
    }, []);
    const cov = (n / W.room.expected) * 100;
    const running = n < W.uniqueSoFar;
    const c = HD().tone(P, cov >= 98 ? 'ok' : 'warn');
    return (<>
      <window.HHBar title={W.room.name} sub={`${W.zone} · ${R().fmtDur(W.elapsed)}`} onBack={() => go('start')} />
      <div style={{ flex: '0 0 auto', padding: '16px 16px 14px', background: c.bg, borderBottom: `2px solid ${c.fg}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 52, lineHeight: .95, fontWeight: 600, color: P.ink, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.03em' }}>{cov.toFixed(1)}</span>
          <span style={{ fontSize: 22, fontWeight: 600, color: P.ink2, fontFamily: P.fontMono }}>%</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: P.fontMono, fontSize: 13.5, color: P.ink2, fontVariantNumeric: 'tabular-nums' }}>{n} / {W.room.expected}</span>
        </div>
        <div style={{ marginTop: 12, position: 'relative', height: 10, borderRadius: 99, background: P.hairline2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, cov)}%`, background: c.fg, borderRadius: 99, transition: 'width .1s linear' }} />
        </div>
        <div style={{ position: 'relative', height: 14 }}>
          <span style={{ position: 'absolute', left: '98%', top: 0, transform: 'translateX(-50%)', fontFamily: P.fontMono, fontSize: 10, color: P.inkMute, whiteSpace: 'nowrap' }}>▲ 98%</span>
        </div>
      </div>
      <window.HHBody>
        <div style={{ display: 'flex', gap: 8 }}>
          <window.HHStat label="Unique EPCs" value={n} sub="deduped" />
          <window.HHStat label="Raw reads" value={Math.round(W.readsSoFar * (n / W.uniqueSoFar || 0))} sub="all passes" />
        </div>
        <div style={{ fontSize: 11.5, color: P.inkMute, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '4px 2px 0' }}>Aisles</div>
        {['Aisle 1', 'Aisle 2', 'Aisle 3', 'Aisle 4', 'Aisle 5'].map((a, i) => {
          const state = i < 2 ? 'done' : i === 2 ? 'now' : 'todo';
          return (
            <window.HHRow key={a} title={a}
              sub={state === 'done' ? 'covered' : state === 'now' ? 'walking now' : 'not yet walked'}
              value={state === 'done' ? '✓' : state === 'now' ? '•' : '—'}
              tone={state === 'done' ? 'ok' : state === 'now' ? 'info' : undefined} />);
        })}
      </window.HHBody>
      <window.HHDock note={running ? 'Keep walking — coverage is still climbing.' : 'Coverage has settled. End the walk to reconcile.'}>
        <window.HHAction icon="check-circle" variant={running ? 'quiet' : 'accent'} disabled={running}
          onClick={() => go('result')} sub={`${cov.toFixed(1)}% coverage`}>End walk &amp; reconcile</window.HHAction>
      </window.HHDock>
    </>);
  }

  function CountResult({ go }) {
    const P = useP(), r = R().ROOMS[0];
    return (<>
      <window.HHBar title="Count result" sub={`${r.name} · ${r.id}`} onBack={() => go('walk')} />
      <window.HHBand tone="ok" icon="check-circle" title={`${r.verdict} · bar is 98.0%`} value={`${r.coverage}%`}
        sub={`${r.found} of ${r.expected} units located across ${r.passes} passes.`} />
      <window.HHBody>
        <div style={{ display: 'flex', gap: 8 }}>
          <window.HHStat label="Located" value={r.found} sub="unique EPCs" tone="ok" />
          <window.HHStat label="Not located" value={r.expected - r.found} sub="stragglers" tone="warn" />
        </div>
        <window.HHMeta items={[
          { label: 'Walk time', value: `${r.minutes} min` },
          { label: 'Passes', value: String(r.passes) },
          { label: 'Operator', value: r.operator, mono: false },
          { label: 'Finished', value: R().fmtClock(r.at) },
        ]} />
        <div style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.45, padding: '2px 2px' }}>
          A PASS still leaves stragglers. They are not written off — they go to a second pass, and
          only a supervisor can close them as missing.
        </div>
      </window.HHBody>
      <window.HHDock>
        <window.HHAction icon="target" onClick={() => go('strag')} sub={`${R().STRAGGLERS.length} tags to chase`}>Show stragglers</window.HHAction>
      </window.HHDock>
    </>);
  }

  function CountStragglers({ go }) {
    const P = useP();
    const [found, setFound] = React.useState({});
    const n = Object.values(found).filter(Boolean).length;
    return (<>
      <window.HHBar title="Stragglers" sub={`${R().STRAGGLERS.length} tags · second pass`} onBack={() => go('result')} />
      <window.HHBand tone={n ? 'ok' : 'warn'} icon="target" title="Second pass" value={`${n} / ${R().STRAGGLERS.length}`}
        sub="Shelf hints come from where each tag was last seen — go there first." />
      <window.HHBody>
        {R().STRAGGLERS.map((s) => {
          const on = !!found[s.epc];
          return (
            <window.HHRow key={s.epc} done={on} onClick={() => setFound((f) => ({ ...f, [s.epc]: !f[s.epc] }))}
              lead={<span style={{ width: 34, height: 34, borderRadius: 99, border: `2px solid ${on ? P.ink : P.hairline3}`, background: on ? P.ink : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                {on && <Icon name="check" size={18} stroke={3} color={P.surface} />}</span>}
              title={s.name} sub={`${s.shelf} · ${s.cause}`} value={R().shortEpc(s.epc).slice(-6)} valueSub="epc" />);
        })}
      </window.HHBody>
      <window.HHDock note="Anything still missing after this pass is a supervisor decision.">
        <window.HHAction icon="send" onClick={() => window.hdToast?.({ title: 'Second pass closed', description: `${n} of ${R().STRAGGLERS.length} stragglers located.`, tone: n ? 'ok' : 'warn' })}
          sub={`${R().STRAGGLERS.length - n} still missing`}>Close second pass</window.HHAction>
      </window.HHDock>
    </>);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3 · TAG COMMISSIONING
  // ═══════════════════════════════════════════════════════════════════════════

  function TagSetup({ go }) {
    const P = useP(), RUN = R().RUN, PR = R().PRINTER;
    const s = R().skuOf(RUN.sku);
    const [qty, setQty] = React.useState(RUN.qty);
    return (<>
      <window.HHBar title="Tag commissioning" sub={`${PR.id} · ${R().TAG_INVENTORY.remaining} labels left`} />
      <window.HHBand tone="neutral" icon="printer" title="Encode &amp; print" value={qty}
        sub={`${s.name} · ${s.brand}`} />
      <window.HHBody>
        <window.HHRow lead={<SkuLead sku={RUN.sku} />} title={s.name} sub={RUN.sku} value={s.cat.slice(0, 3).toUpperCase()} valueSub="cat" />
        <window.HHRow lead={<span style={{ width: 34, height: 34, borderRadius: 9, background: P.surface3, color: P.inkDim, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="box" size={17} stroke={2} /></span>}
          title="Source package" sub={RUN.packageId} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 64, padding: '0 12px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: P.ink }}>Labels to print</div>
            <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 2 }}>One tag per retail unit</div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: P.r10 }}>
            <button onClick={() => setQty((q) => Math.max(10, q - 10))} aria-label="Fewer" style={{ width: 48, height: 48, background: 'transparent', border: 'none', color: P.ink, cursor: 'pointer' }}><Icon name="minus" size={18} stroke={2.4} /></button>
            <span style={{ minWidth: 52, textAlign: 'center', fontFamily: P.fontMono, fontSize: 18, fontWeight: 600, color: P.ink, fontVariantNumeric: 'tabular-nums' }}>{qty}</span>
            <button onClick={() => setQty((q) => q + 10)} aria-label="More" style={{ width: 48, height: 48, background: 'transparent', border: 'none', color: P.ink, cursor: 'pointer' }}><Icon name="plus" size={18} stroke={2.4} /></button>
          </div>
        </div>
        <window.HHMeta items={[
          { label: 'Printer', value: PR.id },
          { label: 'Stock', value: PR.stock, mono: false },
          { label: 'Media left', value: `${Math.round(PR.mediaRemaining * 100)}%` },
          { label: 'Ribbon left', value: `${Math.round(PR.ribbonRemaining * 100)}%` },
        ]} />
        <div style={{ padding: '10px 12px', background: HD().tone(P, 'warn').bg, border: `1px solid ${HD().tone(P, 'warn').fg}44`, borderRadius: P.r12, display: 'flex', gap: 9 }}>
          <Icon name="alert" size={16} stroke={2} color={HD().tone(P, 'warn').fg} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <span style={{ fontSize: 12.5, color: P.ink2, lineHeight: 1.4 }}>{PR.warning}</span>
        </div>
      </window.HHBody>
      <window.HHDock note="Every label is read back after encoding — a tag that will not encode is voided, not shipped.">
        <window.HHAction icon="printer" onClick={() => go('printing')} sub={`${R().TAG_INVENTORY.remaining - qty} labels remain after this run`}>Encode &amp; print {qty}</window.HHAction>
      </window.HHDock>
    </>);
  }

  function TagPrinting({ go }) {
    const P = useP(), RUN = R().RUN;
    const [n, setN] = React.useState(0);
    React.useEffect(() => {
      let f = 0;
      const t = setInterval(() => { f += 1; const k = Math.min(1, f / 28); setN(Math.round(RUN.printed * k)); if (k >= 1) clearInterval(t); }, 90);
      return () => clearInterval(t);
    }, []);
    const rows = Array.from({ length: 6 }).map((_, i) => {
      const idx = Math.max(0, n - i);
      return { epc: R().epcAt(6000 + idx), retail: 'R-' + RUN.sku + '-' + String(4400 + idx).padStart(6, '0'), ok: idx !== 172, n: idx };
    }).filter((r) => r.n > 0);
    return (<>
      <window.HHBar title="Encoding run" sub={RUN.id} onBack={() => go('setup')} />
      <window.HHBand tone="ok" icon="printer" title="Printing" value={`${n} / ${RUN.qty}`}
        sub={`${RUN.labelsPerMin} labels/min · ${RUN.voided} voided on read-back · ${RUN.collisions} collision`} />
      <window.HHBody>
        <div style={{ height: 8, borderRadius: 99, background: P.hairline2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(n / RUN.qty) * 100}%`, background: HD().tone(P, 'ok').fg, borderRadius: 99, transition: 'width .1s linear' }} />
        </div>
        <div style={{ fontSize: 11.5, color: P.inkMute, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', padding: '4px 2px 0' }}>Just printed</div>
        {rows.map((r) => (
          <window.HHRow key={r.n} title={r.retail} sub={R().shortEpc(r.epc)}
            value={r.ok ? '✓' : 'VOID'} valueSub={r.ok ? 'read back' : 'encode failed'}
            tone={r.ok ? 'ok' : 'blocked'} />))}
        <window.HHRow lead={<span style={{ width: 34, height: 34, borderRadius: 9, background: HD().tone(P, 'blocked').bg, color: HD().tone(P, 'blocked').fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="ban" size={17} stroke={2} /></span>}
          title="1 collision held" sub="Retail ID already bound to another EPC" value="409" valueSub="held"
          tone="blocked" onClick={() => go('collision')} />
      </window.HHBody>
      <window.HHDock note="Pausing stops the printer between labels — no partial encode.">
        <window.HHAction icon="pause" onClick={() => window.hdToast?.({ title: 'Run paused', description: `${RUN.id} paused at label ${n}.`, tone: 'warn' })} sub={`${RUN.qty - n} labels remaining`}>Pause run</window.HHAction>
      </window.HHDock>
    </>);
  }

  function TagCollision({ go }) {
    const P = useP(), C = R().COLLISION;
    return (<>
      <window.HHBar title="Binding refused" sub={R().RUN.id} onBack={() => go('printing')} />
      <window.HHBand tone="blocked" icon="ban" title={C.status} value="1"
        sub="This retail ID is already bound to a different EPC. Nothing was written and nothing was overwritten." />
      <window.HHBody>
        <window.HHRow title="Retail ID" sub={C.retailId} value="1:1" valueSub="enforced" tone="blocked" />
        <window.HHRow title="Incoming EPC" sub={R().shortEpc(C.incomingEpc)} value="—" valueSub="rejected" />
        <window.HHRow title="Already bound to" sub={R().shortEpc(C.boundEpc)} value="✓" valueSub="live" tone="ok" />
        <window.HHMeta items={[
          { label: 'Bound at', value: new Date(C.boundAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
          { label: 'Bound by', value: C.boundBy, mono: false },
          { label: 'Audit event', value: C.auditEventId },
          { label: 'Idempotency', value: 'replay-safe', mono: false },
        ]} />
        <div style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.45, padding: '2px 2px' }}>
          Rebinding a retail ID is not something the floor can do. Void this label, keep printing, and
          a supervisor resolves the binding from the console.
        </div>
      </window.HHBody>
      <window.HHDock>
        <window.HHAction icon="printer" onClick={() => go('printing')} sub="run continues at the next label">Void label &amp; continue</window.HHAction>
        <window.HHAction variant="outline" icon="send" onClick={() => window.hdToast?.({ title: 'Sent to supervisor', description: `${C.auditEventId} queued for binding review.`, tone: 'info' })}>Send to supervisor</window.HHAction>
      </window.HHDock>
    </>);
  }

  // ── Screen registry ───────────────────────────────────────────────────────
  window.RFID_HH = {
    kit: {
      label: 'Kit verification',
      order: ['pickup', 'scan', 'box', 'kit', 'pull', 'rescan'],
      screens: {
        pickup: { label: 'Kit staged', render: (p) => <KitPickup {...p} /> },
        scan:   { label: 'Scanning box 3', render: (p) => <KitScanning {...p} /> },
        box:    { label: 'Box 3 result', render: (p) => <KitBoxResult {...p} /> },
        kit:    { label: 'Kit verdict', render: (p) => <KitVerdict {...p} /> },
        pull:   { label: 'Pull list', render: (p) => <KitPullList {...p} /> },
        rescan: { label: 'Rescan queue', render: (p) => <KitRescan {...p} /> },
      },
    },
    count: {
      label: 'Cycle count',
      order: ['start', 'walk', 'result', 'strag'],
      screens: {
        start:  { label: 'Room start', render: (p) => <CountStart {...p} /> },
        walk:   { label: 'Walking', render: (p) => <CountWalk {...p} /> },
        result: { label: 'Coverage result', render: (p) => <CountResult {...p} /> },
        strag:  { label: 'Stragglers', render: (p) => <CountStragglers {...p} /> },
      },
    },
    tags: {
      label: 'Tag commissioning',
      order: ['setup', 'printing', 'collision'],
      screens: {
        setup:     { label: 'Bind & print', render: (p) => <TagSetup {...p} /> },
        printing:  { label: 'Encoding run', render: (p) => <TagPrinting {...p} /> },
        collision: { label: 'Collision · 409', render: (p) => <TagCollision {...p} /> },
      },
    },
  };
})();
