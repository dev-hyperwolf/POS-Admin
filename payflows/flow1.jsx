// ── Flow 1 — Guided Steps (wizard) ─────────────────────────────────────────
// One decision per screen. Rail shows progress. Split forces cash entry first,
// then card fee is chosen from both structures, then confirm.
const useP = window.useP;

window.Flow1 = function Flow1() {
  const P = useP();
  const { txn, cust } = window.PAY, money = window.money, c2 = window.c2;

  const [step, setStep] = React.useState(0);
  const [reward, setReward] = React.useState(null);      // reward id
  const [wallet, setWallet] = React.useState(0);         // $ applied
  const [method, setMethod] = React.useState(null);      // cash|card|split
  const [cash, setCash] = React.useState('');            // split cash portion / cash tendered
  const [feeOpt, setFeeOpt] = React.useState('flat6');
  const [done, setDone] = React.useState(false);

  const rw = window.PAY.rewards.find((r) => r.id === reward);
  const rewardVal = rw ? rw.value : 0;
  const credits = c2(rewardVal + wallet);
  const balance = Math.max(0, c2(txn.total - credits));

  const cashNum = parseFloat(cash) || 0;
  const cardBase = method === 'card' ? balance : method === 'split' ? Math.max(0, c2(balance - cashNum)) : 0;
  const opt = window.PAY.feeOpts.find((o) => o.id === feeOpt);
  const feeAmt = window.PAY.fee(cardBase, opt);
  const cardCharged = c2(cardBase + feeAmt);
  const change = method === 'cash' ? c2(cashNum - balance) : 0;

  // dynamic step list
  const steps = ['Credits', 'Method'];
  if (method === 'split') steps.push('Cash first', 'Card fee');
  else if (method === 'card') steps.push('Card fee');
  else if (method === 'cash') steps.push('Cash tendered');
  steps.push('Confirm');
  const atName = steps[step];

  const canNext = () => {
    if (atName === 'Method') return !!method;
    if (atName === 'Cash first') return cashNum > 0 && cashNum < balance;
    if (atName === 'Cash tendered') return cashNum >= balance;
    return true;
  };
  const next = () => setStep((s) => Math.min(steps.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const reset = () => { setStep(0); setReward(null); setWallet(0); setMethod(null); setCash(''); setDone(false); };

  const pad = (k) => setCash((s) => window.padPush(s, k));

  const Rail = () => (
    <div style={{ flex: '0 0 208px', background: P.surface2, borderRight: `1px solid ${P.hairline2}`, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Eyebrow style={{ marginBottom: 12 }}>Checkout steps</Eyebrow>
      {steps.map((s, i) => {
        const cur = i === step, past = i < step;
        return (
          <div key={s + i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: P.r10, background: cur ? P.surface : 'transparent', border: `1px solid ${cur ? P.hairline2 : 'transparent'}` }}>
            <span style={{ width: 22, height: 22, borderRadius: 99, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 700, fontFamily: P.fontMono,
              background: past ? P.good : cur ? P.ink : P.surface3, color: past || cur ? '#fff' : P.inkMute, border: `1px solid ${past ? P.good : cur ? P.ink : P.hairline2}` }}>
              {past ? <Icon name="check" size={12} stroke={3} color="#fff" /> : i + 1}</span>
            <span style={{ fontSize: 12.5, fontWeight: cur ? 700 : 500, color: cur ? P.ink : past ? P.ink2 : P.inkMute }}>{s}</span>
          </div>
        );
      })}
      <div style={{ flex: 1 }} />
      <div style={{ padding: '12px 12px', background: P.ink, borderRadius: P.r12, color: '#fff' }}>
        <div style={{ fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)', fontFamily: P.fontMono }}>Balance due</div>
        <div style={{ fontSize: 30, fontWeight: 700, fontFamily: P.fontMono, letterSpacing: '-.01em', color: P.accent }}>{money(balance)}</div>
        {credits > 0 && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.55)', fontFamily: P.fontMono, marginTop: 2 }}>{money(txn.total)} − {money(credits)} credits</div>}
      </div>
    </div>
  );

  const bodyStyle = { flex: 1, minWidth: 0, padding: '22px 26px', display: 'flex', flexDirection: 'column', overflow: 'hidden' };

  return (
    <window.FlowFrame title="Guided steps" tag="Flow 1 · Wizard">
      {done ? <Complete P={P} onReset={reset} lines={[['Credits applied', credits], ['Cash', method === 'cash' ? balance : method === 'split' ? cashNum : 0], ['Card charged', method === 'cash' ? 0 : cardCharged]]} change={change} /> :
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Rail />
        <div style={bodyStyle}>
          <div style={{ flex: 1, minHeight: 0 }}>
            {atName === 'Credits' && <StepCredits {...{ P, reward, setReward, wallet, setWallet, balance }} />}
            {atName === 'Method' && <StepMethod {...{ P, method, setMethod, balance }} />}
            {atName === 'Cash first' && <StepCash {...{ P, cash, pad, setCash, balance, cardBase, split: true }} />}
            {atName === 'Cash tendered' && <StepCash {...{ P, cash, pad, setCash, balance, cashNum, change, split: false }} />}
            {atName === 'Card fee' && <StepFee {...{ P, cardBase, feeOpt, setFeeOpt, feeAmt, cardCharged }} />}
            {atName === 'Confirm' && <StepConfirm {...{ P, method, credits, balance, cashNum, cardBase, cardCharged, feeAmt, opt, change }} />}
          </div>
          <div style={{ flex: '0 0 auto', display: 'flex', gap: 10, paddingTop: 16, borderTop: `1px solid ${P.hairline2}`, marginTop: 8 }}>
            <PBtn variant="secondary" size="lg" icon="chevron-left" onClick={back} disabled={step === 0}>Back</PBtn>
            <div style={{ flex: 1 }} />
            {atName === 'Confirm'
              ? <PBtn variant="accent" size="lg" icon="check" onClick={() => setDone(true)}>Complete · {money(balance)}</PBtn>
              : <PBtn variant="primary" size="lg" iconRight="arrow-right" onClick={next} disabled={!canNext()}>Continue</PBtn>}
          </div>
        </div>
      </div>}
    </window.FlowFrame>
  );
};

function StepHead({ P, n, title, sub }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <Eyebrow style={{ marginBottom: 7 }}>Step · {title}</Eyebrow>
      <div style={{ fontSize: 21, fontWeight: 700, color: P.ink, letterSpacing: '-.01em' }}>{n}</div>
      {sub && <div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 5, maxWidth: 460 }}>{sub}</div>}
    </div>
  );
}

function StepCredits({ P, reward, setReward, wallet, setWallet, balance }) {
  const { cust } = window.PAY, money = window.money;
  return (
    <div>
      <StepHead P={P} title="Loyalty & wallet" n="Apply any credits first" sub="Redeem points and store-credit before choosing how to tender. These come off the total before the card fee is calculated." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}><Icon name="star" size={14} color={P.accent} /><span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Redeem points</span><span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>· {cust.points.toLocaleString()} available</span></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {window.PAY.rewards.map((r) => {
              const can = (r.bday || cust.points >= r.cost), a = reward === r.id;
              return <button key={r.id} disabled={!can} onClick={() => setReward(a ? null : r.id)} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '9px 13px', background: a ? P.accentSoft : P.surface, border: `1.5px solid ${a ? P.accentBorder : P.hairline2}`, borderRadius: P.r10, cursor: can ? 'pointer' : 'not-allowed', opacity: can ? 1 : .5, textAlign: 'left', fontFamily: P.fontSans }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{r.label}</span>
                <span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{r.bday ? 'birthday perk' : r.cost + ' pts'}</span>
              </button>;
            })}
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}><Icon name="wallet" size={14} color={P.good} /><span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Store-credit wallet</span><span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>· {money(cust.wallet)} available</span></div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[0, 5, 10, cust.wallet].filter((v, i, a) => a.indexOf(v) === i).map((v) => {
              const a = wallet === v;
              return <button key={v} onClick={() => setWallet(v)} style={{ padding: '9px 15px', background: a ? P.accentSoft : P.surface, border: `1.5px solid ${a ? P.accentBorder : P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>{v === 0 ? 'None' : v === cust.wallet ? `All ${money(v)}` : money(v)}</button>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepMethod({ P, method, setMethod, balance }) {
  const money = window.money;
  const opts = [
    ['cash', 'All cash', 'cash', 'Full balance paid in cash — no processing fee.'],
    ['card', 'All card', 'card', 'Full balance on card — processing fee added.'],
    ['split', 'Split cash + card', 'split', 'Enter cash first, card covers the rest + fee.'],
  ];
  return (
    <div>
      <StepHead P={P} title="Tender type" n="How is this paid?" sub={`Balance due ${money(balance)}. Card payments carry a merchant processing fee — cash does not.`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {opts.map(([v, l, ic, d]) => {
          const a = method === v;
          return <button key={v} onClick={() => setMethod(v)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', background: a ? P.accentSoft : P.surface, border: `1.5px solid ${a ? P.accentBorder : P.hairline2}`, borderRadius: P.r14, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
            <span style={{ width: 42, height: 42, borderRadius: 10, flex: '0 0 auto', background: a ? P.accent : P.surface3, color: a ? P.accentInk : P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={ic} size={21} stroke={1.8} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>{l}</div>
              <div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 2 }}>{d}</div>
            </div>
            {a && <Icon name="check-circle" size={20} stroke={2} color={P.good} />}
          </button>;
        })}
      </div>
    </div>
  );
}

function StepCash({ P, cash, pad, setCash, balance, cardBase, cashNum, change, split }) {
  const money = window.money;
  const shown = cash === '' ? '0.00' : cash;
  return (
    <div style={{ display: 'flex', gap: 26, height: '100%' }}>
      <div style={{ flex: 1 }}>
        <StepHead P={P} title={split ? 'Cash portion first' : 'Cash tendered'} n={split ? 'How much cash?' : 'Cash received'} sub={split ? 'We take the cash amount first — whatever is left goes to card, where the processing fee applies.' : 'Enter the cash handed over to compute change.'} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {(split ? [balance / 2, balance] : [Math.ceil(balance), Math.ceil(balance / 5) * 5, Math.ceil(balance / 10) * 10, Math.ceil(balance / 20) * 20]).map((v) => c2(v)).filter((v, i, a) => a.indexOf(v) === i).map((v) => (
            <button key={v} onClick={() => setCash(v.toFixed(2))} style={{ padding: '11px 14px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, fontSize: 13.5, fontWeight: 700, color: P.info, cursor: 'pointer', fontFamily: P.fontMono, textAlign: 'left' }}>{money(v)}{split && v === c2(balance / 2) ? '  · half' : split && v === balance ? '  · all cash' : ''}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, padding: '13px 15px', textAlign: 'right', fontSize: 25, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, marginBottom: 10 }}>${shown}</div>
        <window.PadKeys onPress={pad} />
        <div style={{ marginTop: 12, padding: '11px 14px', borderRadius: P.r10, background: split ? P.infoSoft : (change >= 0 ? P.goodSoft : P.badSoft) }}>
          {split
            ? <window.KV k="Remaining → card" v={money(Math.max(0, c2(balance - (parseFloat(cash) || 0))))} strong color={P.info} />
            : <window.KV k={change >= 0 ? 'Change' : 'Still owed'} v={money(Math.abs(change || 0))} strong color={change >= 0 ? P.good : P.bad} />}
        </div>
      </div>
    </div>
  );
}
const c2 = window.c2;

function StepFee({ P, cardBase, feeOpt, setFeeOpt, feeAmt, cardCharged }) {
  const money = window.money;
  return (
    <div>
      <StepHead P={P} title="Merchant processing fee" n="Pick the card fee structure" sub={`The card portion is ${money(cardBase)}. We charge a processing fee on card only — compare both structures and choose.`} />
      <window.FeeCompare base={cardBase} value={feeOpt} onChange={setFeeOpt} layout="cards" />
      <div style={{ marginTop: 18, padding: '14px 16px', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <window.KV k="Card base" v={money(cardBase)} />
        <window.KV k="Processing fee" v={money(feeAmt)} sign="+ " color={P.warn} />
        <div style={{ borderTop: `1px dashed ${P.hairline2}`, paddingTop: 8 }}><window.KV k="Card charged" v={money(cardCharged)} strong /></div>
      </div>
    </div>
  );
}

function StepConfirm({ P, method, credits, balance, cashNum, cardBase, cardCharged, feeAmt, opt, change }) {
  const money = window.money;
  const rows = [];
  if (credits > 0) rows.push(['Credits applied', '− ' + money(credits), P.good]);
  if (method === 'cash') rows.push(['Cash tendered', money(cashNum), P.ink], ['Change due', money(Math.max(0, change)), P.good]);
  if (method === 'split') rows.push(['Cash portion', money(cashNum), P.ink]);
  if (method !== 'cash') rows.push(['Card base', money(cardBase), P.ink], [`Processing fee · ${opt.label}`, '+ ' + money(feeAmt), P.warn], ['Card charged', money(cardCharged), P.ink]);
  return (
    <div>
      <StepHead P={P} title="Review & complete" n="Confirm the tender" sub="Everything the customer will be charged, in order." />
      <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <window.KV k="Order total" v={money(window.PAY.txn.total)} />
        {rows.map((r, i) => <window.KV key={i} k={r[0]} v={r[1]} color={r[2]} />)}
        <div style={{ borderTop: `2px solid ${P.ink}`, paddingTop: 10, marginTop: 2 }}><window.KV k="Balance settled" v={money(balance)} strong /></div>
      </div>
    </div>
  );
}

// Shared success screen
window.Complete = function Complete({ P, onReset, lines, change }) {
  const money = window.money;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 30 }}>
      <span style={{ width: 66, height: 66, borderRadius: 99, background: P.goodSoft, color: P.good, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={34} stroke={2.4} /></span>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 21, fontWeight: 700, color: P.ink }}>Payment complete</div>
        <div style={{ fontSize: 12.5, color: P.inkDim, marginTop: 4 }}>Receipt sent · drawer opened</div>
      </div>
      {change > 0 && <div style={{ padding: '10px 18px', background: P.goodSoft, borderRadius: P.r12, fontSize: 13.5, fontWeight: 700, color: P.good, fontFamily: P.fontMono }}>Change due {money(change)}</div>}
      <div style={{ width: 300, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lines.filter((l) => l[1] > 0).map((l, i) => <window.KV key={i} k={l[0]} v={money(l[1])} />)}
      </div>
      <PBtn variant="secondary" size="md" icon="refresh" onClick={onReset}>Run flow again</PBtn>
    </div>
  );
};

Object.assign(window, {});
