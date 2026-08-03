// ── Payment flow core — shared demo data, fee math, generic primitives ─────
// Reused by all 5 flow explorations so the numbers/behaviour stay identical.
const useP = window.useP;
const money = window.HW.fmt.money;

const PAY = {
  // Demo transaction — matches the register screenshot (2 items, $34.63)
  txn: { items: 2, sub: 32.00, tax: 2.63, total: 34.63,
    lines: [ { name: 'Cake Crasher', qty: 1, price: 15, hue: 18 }, { name: 'Blueberry Pancakes', qty: 1, price: 17, hue: 110 } ] },
  cust: { name: 'Girish Sharma', visit: '3rd visit', points: 1280, wallet: 25.00, hue: 110 },
  // The two merchant-processing-fee structures to compare on the CARD portion
  feeOpts: [
    { id: 'flat6', label: '6% flat',      short: '6%',        rate: 0.06, flat: 0,    note: '6% of the card amount' },
    { id: 'p550',  label: '5% + $0.50',   short: '5%+50¢',    rate: 0.05, flat: 0.50, note: '5% of card + $0.50 fixed' },
  ],
  // Points → redeemable dollar rewards. Same fixed ladder as the register,
  // plus the birthday $20, which is a membership perk and costs no points.
  rewards: [
    { id: '250off', label: '$2.50 off',    cost: 100, value: 2.5 },
    { id: '5off',   label: '$5 off',       cost: 200, value: 5 },
    { id: '10off',  label: '$10 off',      cost: 400, value: 10 },
    { id: '20off',  label: '$20 off',      cost: 800, value: 20 },
    { id: 'bday',   label: 'Birthday $20', cost: 0,   value: 20, bday: true },
  ],
  fee(base, opt) { if (!opt || base <= 0) return 0; return Math.round((base * opt.rate + opt.flat) * 100) / 100; },
};
window.PAY = PAY;

// Round to cents helper
const c2 = (n) => Math.round(n * 100) / 100;
window.c2 = c2;

// ── Generic numpad (used where a flow wants keypad entry) ──────────────────
window.PadKeys = function PadKeys({ onPress, accentDel, big }) {
  const P = useP();
  const keys = ['1','2','3','4','5','6','7','8','9','.','0','del'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
      {keys.map((k) => (
        <button key={k} onClick={() => onPress(k)} style={{
          padding: big ? '18px 0' : '13px 0', background: P.surface, border: `1px solid ${P.hairline2}`,
          borderRadius: P.r10, fontSize: big ? 20 : 17, fontWeight: 600,
          color: k === 'del' ? P.bad : P.ink, cursor: 'pointer', fontFamily: P.fontMono,
          display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: big ? 58 : 46,
        }}>{k === 'del' ? <Icon name="x" size={18} stroke={2.2} /> : k}</button>
      ))}
    </div>
  );
};

// keypad string reducer
window.padPush = function padPush(s, k) {
  if (k === 'del') return s.slice(0, -1);
  if (k === 'clr') return '';
  if (k === '.' && s.includes('.')) return s;
  if (k === '.' && s === '') return '0.';
  if (s.includes('.') && s.split('.')[1].length >= 2) return s; // cap 2 decimals
  return s + k;
};

// ── Fee comparison — shows BOTH structures for a card base; radio-select ───
// layout: 'cards' (two big picks) | 'strip' (compact side-by-side)
window.FeeCompare = function FeeCompare({ base, value, onChange, layout = 'cards' }) {
  const P = useP();
  if (layout === 'strip') {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        {PAY.feeOpts.map((o) => {
          const a = value === o.id, f = PAY.fee(base, o);
          return (
            <button key={o.id} onClick={() => onChange(o.id)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              padding: '9px 12px', background: a ? P.accentSoft : P.surface, border: `1.5px solid ${a ? P.accentBorder : P.hairline2}`,
              borderRadius: P.r10, cursor: 'pointer', fontFamily: P.fontSans, textAlign: 'left' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: P.ink }}>{o.label}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: a ? P.ink : P.inkDim, fontFamily: P.fontMono }}>+{money(f)}</span>
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {PAY.feeOpts.map((o) => {
        const a = value === o.id, f = PAY.fee(base, o), tot = c2(base + f);
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{
            display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', textAlign: 'left',
            background: a ? P.accentSoft : P.surface, border: `1.5px solid ${a ? P.accentBorder : P.hairline2}`,
            borderRadius: P.r12, cursor: 'pointer', fontFamily: P.fontSans }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 16, height: 16, borderRadius: 99, border: `2px solid ${a ? P.accent : P.hairline3}`, background: a ? P.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>{a && <Icon name="check" size={9} stroke={3.4} color={P.accentInk} />}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>{o.label}</span>
            </div>
            <div style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>{o.note}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 2 }}>
              <span style={{ fontSize: 10.5, color: P.inkDim, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>Fee</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: P.ink, fontFamily: P.fontMono }}>+{money(f)}</span>
            </div>
            <div style={{ fontSize: 11, color: P.inkDim, fontFamily: P.fontMono, borderTop: `1px dashed ${P.hairline2}`, paddingTop: 6 }}>Card charged <b style={{ color: P.ink }}>{money(tot)}</b></div>
          </button>
        );
      })}
    </div>
  );
};

// ── Customer credits (points reward + wallet) — compact shared strip ───────
// Presents the two spendable balances; each flow decides where to place it.
window.money = money;

// small labelled row
window.KV = function KV({ k, v, strong, sign, color }) {
  const P = useP();
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: strong ? 13 : 12, color: strong ? P.ink : P.inkDim, fontWeight: strong ? 700 : 500 }}>{k}</span>
      <span style={{ fontSize: strong ? 16 : 12.5, fontWeight: strong ? 700 : 600, color: color || (strong ? P.ink : P.ink2), fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{sign || ''}{v}</span>
    </div>
  );
};

// Flow frame — consistent modal chrome for every flow (title bar + step meta)
window.FlowFrame = function FlowFrame({ title, tag, children, foot }) {
  const P = useP();
  return (
    <div style={{ width: '100%', height: '100%', background: P.bg, display: 'flex', flexDirection: 'column', fontFamily: P.fontSans, color: P.ink }}>
      <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 11, padding: '14px 20px', background: P.surface, borderBottom: `1px solid ${P.hairline2}` }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: P.ink, color: P.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="receipt" size={16} stroke={1.9} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: P.ink, lineHeight: 1.1 }}>{title}</div>
          <div style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono, letterSpacing: '.06em', textTransform: 'uppercase' }}>{tag}</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px 5px 6px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: 99 }}>
          <Avatar name={PAY.cust.name} size={24} hue={PAY.cust.hue} />
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink }}>{PAY.cust.name}</div>
            <div style={{ fontSize: 9.5, color: P.inkMute, fontFamily: P.fontMono }}>{PAY.cust.points.toLocaleString()} pts · {money(PAY.cust.wallet)} wallet</div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
      {foot}
    </div>
  );
};

Object.assign(window, {});
