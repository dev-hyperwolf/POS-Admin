// ── Identity assurance ──────────────────────────────────────────────────────
// One customer record. Many verification EVENTS. The tier is DERIVED from the
// events — never typed by hand, never set per channel.
//
//   T0  Unverified      browse only
//   T1  Document on file  a person physically inspected the ID: scanned the
//                         barcode and photographed it. Staff at the counter, or
//                         a driver at the door. Clears in-store sale instantly.
//   T2  Account bound     T1 + we proved they control the phone on the account
//                         (one SMS code). THIS is what unlocks delivery.
//
// Why delivery needs T2 and not "check the document again": the ID is already verified by
// a human who held it. The only open question for a remote order is whether the
// person tapping "order" is that same human — which is an ACCOUNT-BINDING
// question, answered by phone ownership, not by re-checking the document.
//
// The remote ID check is therefore a SUBSTITUTE for T1, not an extra step on top
// of it. It exists for customers who have never walked in. A customer who has
// been scanned in store never sees it. Ever.
//
// WHO GETS THE VERIFICATION SMS: delivery customers only. An in-store walk-in
// is fully cleared by the counter ID scan (T1) and is NEVER sent one — there is
// nothing to bind, because the person is standing in front of you holding the
// document. The SMS exists solely to answer "is the person placing this REMOTE
// order the same human whose ID we inspected", so it is triggered by a delivery
// order, not by a check-in. Walk-ins who later want delivery are asked once, at
// the counter, as a courtesy — never as a condition of shopping in store.
const useP = window.useP;
// The remote ID-verification VENDOR is deliberately never named in the UI, so a
// change of provider is a config change, not a redesign. Set this to a name if
// we ever want to badge it; empty means the chip is hidden.
const IDV_VENDOR = '';

const TIERS = {
  0: { key: 't0', label: 'Unverified', short: 'T0', tone: 'bad' },
  1: { key: 't1', label: 'ID on file', short: 'T1', tone: 'warn' },
  2: { key: 't2', label: 'Delivery ready', short: 'T2', tone: 'good' }
};

// Derive everything from the events. Order of checks matters.
function assurance(v) {
  if (!v) return { tier: 0, ...TIERS[0], canStore: false, canDelivery: false, blocker: 'No ID has been seen yet.', next: 'Scan their ID at the counter, or send a remote ID-check link.' };
  const doc = v.doc,ph = v.phone || {},pa = v.remoteId || v.persona;
  const docOk = !!(doc && doc.scannedAt && doc.photo);
  const docExpired = !!(doc && doc.expired);
  const remoteOk = !!(pa && pa.status === 'passed');
  const phoneOk = !!ph.smsVerified;

  if (docExpired) return { tier: 0, ...TIERS[0], canStore: false, canDelivery: false, expired: true, blocker: 'The ID we have on file has expired.', next: 'Re-scan a current ID — the account and history are kept.' };
  if (!docOk && !remoteOk) return { tier: 0, ...TIERS[0], canStore: false, canDelivery: false, blocker: 'No ID has been seen yet.', next: 'Scan their ID at the counter, or send a remote ID-check link.' };
  if (!phoneOk) return { tier: 1, ...TIERS[1], canStore: true, canDelivery: false,
    blocker: 'Phone not confirmed — we can’t tie a remote order back to this person.',
    next: 'One SMS code, and only if they want delivery. In-store shopping needs nothing more.' };
  return { tier: 2, ...TIERS[2], canStore: true, canDelivery: true, via: remoteOk && !docOk ? 'remote' : doc && doc.where === 'door' ? 'door' : 'in-store' };
}
window.HWV = { assurance, TIERS };

// ── Badge ───────────────────────────────────────────────────────────────────
window.AssuranceBadge = function AssuranceBadge({ v, size = 'md' }) {
  const P = useP();
  const a = assurance(v);
  const c = a.tone === 'good' ? P.good : a.tone === 'warn' ? P.warn : P.bad;
  const sm = size === 'sm';
  return <span title={a.blocker || 'Cleared for in-store and delivery'} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: sm ? '2px 8px' : '4px 10px', borderRadius: 99, background: c + '1f', color: c, fontSize: sm ? 10 : 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
    <Icon name={a.tier === 2 ? 'check-circle' : a.tier === 1 ? 'shield' : 'x'} size={sm ? 11 : 13} stroke={2.2} />{a.label}
  </span>;
};

// ── The ladder — where this customer is and what is actually missing ────────
window.IdentityLadder = function IdentityLadder({ v, compact }) {
  const P = useP();
  const a = assurance(v);
  const doc = v && v.doc || {};
  const ph = v && v.phone || {};
  const pa = v && (v.remoteId || v.persona);
  const rungs = [
  { n: 1, t: 'ID inspected', done: a.tier >= 1,
    d: a.tier >= 1 ?
    pa && pa.status === 'passed' && !doc.scannedAt ? 'Remote ID check passed ' + pa.at :
    doc.where === 'door' ? 'Scanned at the door by ' + doc.by + ' · ' + doc.scannedAt :
    'Scanned & photographed by ' + doc.by + ' · ' + doc.where :
    'Nobody has seen a document yet.',
    meta: a.tier >= 1 && doc.num ? doc.type + ' ' + doc.num + ' · expires ' + doc.expires : null },
  { n: 2, t: 'Phone confirmed', done: !!ph.smsVerified, note: 'delivery only',
    d: ph.smsVerified ? 'SMS code confirmed ' + (ph.verifiedAt || '') + ' — ' + ph.value :
    ph.sentAt ? 'Code sent ' + ph.sentAt + ' to ' + ph.value + ' — waiting on them' :
    'Not sent. Only sent when they order delivery — never for an in-store visit.' },
  { n: 3, t: 'Delivery unlocked', done: a.tier >= 2,
    d: a.tier >= 2 ? 'Can order delivery on our site and on Weedmaps. No further checks, ever.' :
    'Opens automatically the moment step 2 lands. In-store shopping is already open.' }];

  return <div style={{ display: 'flex', flexDirection: 'column' }}>
    {rungs.map((r, i) => {
      const c = r.done ? P.good : P.inkMute;
      return <div key={r.n} style={{ display: 'flex', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto' }}>
          <span style={{ width: 20, height: 20, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', background: r.done ? P.good : 'transparent', border: r.done ? 'none' : `1.5px dashed ${P.hairline3 || P.hairline2}`, color: '#fff', fontSize: 10, fontWeight: 800, fontFamily: P.fontMono }}>
            {r.done ? <Icon name="check" size={11} stroke={3.2} color="#fff" /> : <span style={{ color: P.inkMute }}>{r.n}</span>}</span>
          {i < rungs.length - 1 && <span style={{ flex: 1, width: 1.5, background: r.done ? P.good : P.hairline, margin: '2px 0', minHeight: compact ? 8 : 12 }} />}
        </div>
        <div style={{ paddingBottom: i < rungs.length - 1 ? compact ? 9 : 12 : 0, minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: r.done ? P.ink : P.ink2, display: 'flex', alignItems: 'center', gap: 6 }}>{r.t}{r.note && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: P.info, background: P.infoSoft, borderRadius: 99, padding: '1px 6px' }}>{r.note}</span>}</div>
          <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 1, lineHeight: 1.45 }}>{r.d}</div>
          {r.meta && <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 2 }}>{r.meta}</div>}
        </div>
      </div>;})}
  </div>;
};

// ── Verification SMS ────────────────────────────────────────────────────────
// DELIVERY ONLY. The system sends this automatically when a DELIVERY order
// appears for an account that has an ID on file but no confirmed phone. An
// in-store walk-in never triggers it. Staff never have to remember to send it —
// but they CAN resend when the first one silently fails, and every attempt is
// timestamped with its carrier delivery receipt so you can tell "not delivered"
// from "ignored".
const SMS_STATE = {
  queued: { label: 'Queued', tone: 'dim', icon: 'clock' },
  sent: { label: 'Sent', tone: 'dim', icon: 'arrow-right' },
  delivered: { label: 'Delivered', tone: 'good', icon: 'check' },
  failed: { label: 'Undelivered', tone: 'bad', icon: 'x' }
};
window.SmsVerifyPanel = function SmsVerifyPanel({ phone, state, sentAt, attempts, onVerified, onLog, compact }) {
  const P = useP();
  const [st, setSt] = React.useState(state === 'verified' ? 'verified' : 'pending');
  const [code, setCode] = React.useState('');
  const [secs, setSecs] = React.useState(0);
  // Staff choose what the customer receives: a 6-digit code to read back, or a
  // one-tap magic link. Both bind the same phone to the same account.
  const [mode, setMode] = React.useState('link');
  const [log, setLog] = React.useState(attempts && attempts.length ? attempts :
  [{ at: sentAt || '2 min ago', by: 'System · auto', status: 'delivered', receipt: 'carrier ack 1.4s', kind: 'link' }]);
  React.useEffect(() => {if (secs <= 0) return;const t = setTimeout(() => setSecs(secs - 1), 1000);return () => clearTimeout(t);}, [secs]);

  const resend = () => {
    setSecs(30);
    const kind = mode === 'link' ? 'link' : 'code';
    setLog((l) => [{ at: 'Just now', by: 'Manisha Saini · manual', status: 'sent', receipt: 'awaiting carrier ack', kind }, ...l]);
    onLog && onLog({ who: 'Manisha Saini', role: 'You', action: `Resent verification ${kind} by SMS to ` + phone, time: 'just now', icon: 'phone' });
    setTimeout(() => setLog((l) => l.map((x, i) => i === 0 ? { ...x, status: 'delivered', receipt: 'carrier ack 0.9s' } : x)), 1600);
  };
  const verify = () => {setSt('verified');onVerified && onVerified();onLog && onLog({ who: phone, role: 'Customer', action: 'Confirmed phone by SMS code — account bound, delivery unlocked', time: 'just now', icon: 'check-circle' });};

  if (st === 'verified') return <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: P.goodSoft, border: `1px solid ${P.good}44`, borderRadius: P.r10 }}>
    <Icon name="check-circle" size={16} stroke={2} color={P.good} />
    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Phone confirmed — delivery unlocked</div>
      <div style={{ fontSize: 11.5, color: P.inkDim }}>{phone} is now bound to this account. They will never be asked again.</div></div>
  </div>;

  const last = log[0] || {};
  const lastMeta = SMS_STATE[last.status] || SMS_STATE.sent;
  const lastCol = lastMeta.tone === 'good' ? P.good : lastMeta.tone === 'bad' ? P.bad : P.inkDim;

  return <div style={{ padding: '11px 13px', background: P.warnSoft, border: `1px solid ${P.warn}66`, borderRadius: P.r10 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
      <Icon name="phone" size={14} color={P.warn} />
      <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: P.warn }}>Pending verification</span>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: P.info, background: P.infoSoft, borderRadius: 99, padding: '1px 7px' }}>Delivery only</span>
      <span style={{ marginLeft: 'auto', fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{phone}</span>
    </div>

    {/* What gets sent — link or code — and the exact message. */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <Seg value={mode} onChange={setMode} size="sm" options={[{ value: 'link', label: 'Magic link', icon: 'link' }, { value: 'code', label: '6-digit code', icon: 'lock' }]} />
      <span style={{ marginLeft: 'auto', fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>expires in 15 min</span>
    </div>

    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: P.surface, borderRadius: P.r8, marginBottom: 9 }}>
      <Icon name="mail" size={13} color={P.inkMute} style={{ marginTop: 1, flex: '0 0 auto' }} />
      <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5, fontFamily: P.fontMono, minWidth: 0 }}>
        {mode === 'link' ?
        <>“Hyperwolf: confirm your number to unlock delivery — <b style={{ color: P.info }}>hyprwlf.co/v/8Kd2mQ</b>. Reply STOP to opt out.”</> :
        <>“Hyperwolf: your verification code is <b style={{ color: P.ink }}>481 302</b>. Reply STOP to opt out.”</>}
      </div>
    </div>

    {/* Send / resend is always available — it is the whole point of the panel. */}
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 9 }}>
      <PBtn variant="accent" size="sm" icon={secs > 0 ? 'clock' : 'phone'} disabled={secs > 0} onClick={resend}>
        {secs > 0 ? `Resend in ${secs}s` : `Resend ${mode === 'link' ? 'link' : 'code'} by SMS`}
      </PBtn>
      {mode === 'code' && <>
        <div style={{ flex: '1 1 96px', minWidth: 92 }}><Field mono value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="000000" size="sm" /></div>
        <PBtn variant="primary" size="sm" icon="check" disabled={code.length < 6} onClick={verify}>Confirm</PBtn>
      </>}
      {mode === 'link' && <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: P.inkDim, lineHeight: 1.4 }}>They tap the link and it confirms itself — nothing to read back.</span>}
    </div>

    {/* Send log — every attempt, who triggered it, and the carrier receipt */}
    <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r8, overflow: 'hidden', marginBottom: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute }}>Send log</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: lastCol }}>
          <Icon name={lastMeta.icon} size={11} stroke={2.6} color={lastCol} />{lastMeta.label}</span>
      </div>
      {log.slice(0, 3).map((a, i) => {
        const m = SMS_STATE[a.status] || SMS_STATE.sent;
        const c = m.tone === 'good' ? P.good : m.tone === 'bad' ? P.bad : P.inkMute;
        return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: c, flex: '0 0 auto' }} />
          <span style={{ fontSize: 11.5, fontFamily: P.fontMono, color: P.ink, flex: '0 0 auto' }}>{a.at}</span>
          {a.kind && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: P.inkDim, background: P.surface3, borderRadius: 4, padding: '1px 5px', flex: '0 0 auto' }}>{a.kind}</span>}
          <span style={{ fontSize: 11.5, color: P.inkDim, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.by}</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: c, flex: '0 0 auto' }}>{m.label}</span>
          <span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, flex: '0 0 auto' }}>{a.receipt}</span>
        </div>;})}
    </div>

    {last.status === 'failed' &&
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9, fontSize: 11.5, fontWeight: 600, color: P.bad }}>
        <Icon name="shield" size={12} color={P.bad} />Carrier rejected the number — check it is a mobile line before resending.
      </div>}

    {!compact && <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 7, lineHeight: 1.45 }}>Sent automatically when a <b style={{ color: P.ink2 }}>delivery</b> order appears for an account with an ID on file but no confirmed phone. Walk-ins are never sent one. Resend only if it never landed — the code box is for reading it back over the phone.</div>}
  </div>;
};

// ── Remote ID capture ───────────────────────────────────────────────────────
// For customers who have NEVER walked in. We text them a link; they photograph
// their document and face with our ID-verification provider; a pass writes a T1
// document event on
// our side. It is a SUBSTITUTE for the counter scan, not an extra hoop — anyone
// whose ID we have already held never sees it.
const RID_STEPS = [
{ k: 'sent', label: 'Link sent', sub: 'SMS delivered to their phone' },
{ k: 'opened', label: 'Opened', sub: 'They tapped the link' },
{ k: 'submitted', label: 'Photos submitted', sub: 'Document + selfie uploaded' },
{ k: 'passed', label: 'Passed', sub: 'Document verified — ID on file' }];
const RID_META = {
  idle: { label: 'Not sent', tone: 'bad' },
  sent: { label: 'Waiting on them', tone: 'warn' },
  opened: { label: 'In progress', tone: 'warn' },
  submitted: { label: 'Under review', tone: 'info' },
  passed: { label: 'Verified', tone: 'good' },
  failed: { label: 'Failed', tone: 'bad' },
  expired: { label: 'Link expired', tone: 'bad' }
};
window.RemoteIdPanel = function RemoteIdPanel({ phone, remoteId, onLog, onDoor, compact }) {
  const P = useP();
  const p0 = remoteId || {};
  const [status, setStatus] = React.useState(p0.status || 'idle');
  const [secs, setSecs] = React.useState(0);
  const [copied, setCopied] = React.useState(false);
  const link = p0.link || 'hyprwlf.co/id/Q7m2';
  const [log, setLog] = React.useState(p0.attempts && p0.attempts.length ? p0.attempts :
  p0.sentAt ? [{ at: p0.sentAt, by: (p0.by || 'System') + ' · SMS', status: 'delivered', receipt: 'carrier ack 1.2s' }] : []);
  React.useEffect(() => {if (secs <= 0) return;const t = setTimeout(() => setSecs(secs - 1), 1000);return () => clearTimeout(t);}, [secs]);

  const meta = RID_META[status] || RID_META.idle;
  const tone = meta.tone === 'good' ? P.good : meta.tone === 'warn' ? P.warn : meta.tone === 'info' ? P.info : P.bad;
  const reached = (k) => {
    const order = ['sent', 'opened', 'submitted', 'passed'];
    const at = order.indexOf(status === 'failed' || status === 'expired' ? 'sent' : status);
    return at >= order.indexOf(k);
  };

  const send = () => {
    const first = status === 'idle';
    setSecs(30);setStatus('sent');
    setLog((l) => [{ at: 'Just now', by: 'Manisha Saini · manual', status: 'sent', receipt: 'awaiting carrier ack' }, ...l]);
    onLog && onLog({ who: 'Manisha Saini', role: 'You', action: `${first ? 'Sent' : 'Resent'} the remote ID-check link by SMS to ${phone}`, time: 'just now', icon: 'phone' });
    setTimeout(() => setLog((l) => l.map((x, i) => i === 0 ? { ...x, status: 'delivered', receipt: 'carrier ack 0.8s' } : x)), 1500);
  };
  const copy = () => {setCopied(true);setTimeout(() => setCopied(false), 1600);
    onLog && onLog({ who: 'Manisha Saini', role: 'You', action: 'Copied the ID-check link to read out over the phone', time: 'just now', icon: 'link' });};
  const door = () => {onDoor && onDoor();
    onLog && onLog({ who: 'Manisha Saini', role: 'You', action: 'Deferred to a door scan — the driver will inspect the ID on delivery', time: 'just now', icon: 'scan' });};

  if (status === 'passed') return <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', background: P.goodSoft, border: `1px solid ${P.good}44`, borderRadius: P.r10 }}>
    <Icon name="check-circle" size={16} stroke={2} color={P.good} />
    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Remote ID check passed — ID on file</div>
      <div style={{ fontSize: 11.5, color: P.inkDim }}>Verified remotely {p0.at || ''}. Counts exactly like a counter scan — they will never be asked again.</div></div>
  </div>;

  const last = log[0];
  return <div style={{ padding: '11px 13px', background: status === 'failed' || status === 'expired' ? P.badSoft : P.infoSoft, border: `1px solid ${tone}55`, borderRadius: P.r10 }} data-hw="remote-id-panel">
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, flexWrap: 'wrap' }}>
      <Icon name="scan" size={14} color={tone} />
      <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: tone }}>Remote ID check</span>
      {IDV_VENDOR && <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: P.ink2, background: P.surface3, borderRadius: 99, padding: '1px 7px' }}>{IDV_VENDOR}</span>}
      <span style={{ fontSize: 10, fontWeight: 700, color: tone, background: tone + '1f', borderRadius: 99, padding: '2px 8px' }}>{meta.label}</span>
      <span style={{ marginLeft: 'auto', fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{phone}</span>
    </div>

    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', background: P.surface, borderRadius: P.r8, marginBottom: 9 }}>
      <Icon name="mail" size={13} color={P.inkMute} style={{ marginTop: 1, flex: '0 0 auto' }} />
      <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5, fontFamily: P.fontMono, minWidth: 0 }}>
        “Hyperwolf: verify your ID to order for delivery — <b style={{ color: P.info }}>{link}</b>. Takes 2 minutes. Reply STOP to opt out.”
      </div>
    </div>

    {/* Where they are in the remote-check flow */}
    <div style={{ display: 'flex', gap: 0, marginBottom: 10 }}>
      {RID_STEPS.map((s, i) => {const on = status !== 'idle' && reached(s.k);const isLast = i === RID_STEPS.length - 1;
        return <div key={s.k} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ width: 15, height: 15, borderRadius: 99, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? tone : P.surface, border: `1.5px solid ${on ? tone : P.hairline3}` }}>{on && <Icon name="check" size={9} stroke={3.4} color={P.surface} />}</span>
            {!isLast && <span style={{ flex: 1, height: 1.5, background: on ? tone : P.hairline2 }} />}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: on ? P.ink : P.inkMute, lineHeight: 1.2, paddingRight: 6 }}>{s.label}</span>
          {!compact && <span style={{ fontSize: 10, color: P.inkMute, lineHeight: 1.3, paddingRight: 6 }}>{s.sub}</span>}
        </div>;})}
    </div>

    {(status === 'failed' || status === 'expired') &&
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 9, padding: '8px 10px', background: P.surface, borderRadius: P.r8, fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>
        <Icon name="shield" size={13} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />
        <span>{status === 'expired' ? <>The link timed out before they finished. <b>Send a fresh one</b> — nothing they uploaded is lost.</> : <>The check could not match the document to the selfie. Send a new link, or have the driver scan the ID at the door.</>}</span>
      </div>}

    {/* Send log */}
    {log.length > 0 &&
    <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r8, overflow: 'hidden', marginBottom: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute }}>Link sends</span>
          <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: P.inkDim }}>{log.length} total</span>
        </div>
        {log.slice(0, 3).map((a, i) => {
        const m2 = SMS_STATE[a.status] || SMS_STATE.sent;
        const c = m2.tone === 'good' ? P.good : m2.tone === 'bad' ? P.bad : P.inkMute;
        return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: c, flex: '0 0 auto' }} />
            <span style={{ fontSize: 11.5, fontFamily: P.fontMono, color: P.ink, flex: '0 0 auto' }}>{a.at}</span>
            <span style={{ fontSize: 11.5, color: P.inkDim, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.by}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: c, flex: '0 0 auto' }}>{m2.label}</span>
            <span style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, flex: '0 0 auto' }}>{a.receipt}</span>
          </div>;})}
      </div>}

    {/* Actions — always reachable */}
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <PBtn variant="accent" size="sm" icon={secs > 0 ? 'clock' : 'phone'} disabled={secs > 0} onClick={send}>
        {secs > 0 ? `Resend in ${secs}s` : status === 'idle' ? 'Send ID check link by SMS' : 'Resend ID check link'}
      </PBtn>
      <PBtn variant="secondary" size="sm" icon={copied ? 'check' : 'link'} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</PBtn>
      <PBtn variant="ghost" size="sm" icon="scan" onClick={door}>Verify at the door instead</PBtn>
    </div>
    {!compact && <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 7, lineHeight: 1.45 }}>
      The remote check is only for customers whose ID <b style={{ color: P.ink2 }}>nobody has ever held</b> — a pass writes the same document event as a counter scan, so they are never asked twice. A door scan clears them just as permanently and keeps the first order frictionless.
      {last ? <> Last sent {last.at.toLowerCase()} by {last.by.split(' · ')[0]}.</> : ' Nothing has been sent yet.'}
    </div>}
  </div>;
};

// ── Customer peek — open a profile from anywhere, without losing your place ─
window.CustomerPeek = function CustomerPeek({ member, contact, idv, onClose }) {
  const P = useP();
  const fmt = window.HW.fmt;
  const m = member || {};
  const name = m.name || contact && contact.name || 'Unknown customer';
  const rows = [
  ['Phone', m.phone || contact && contact.phone || '—', true],
  ['Email', m.email || contact && contact.email || 'Not provided', false],
  ['Customer type', m.type || '—', false],
  ['Group', m.group || '—', false]];

  const stats = [['Visits', m.visits != null ? m.visits : '—'], ['Points', m.points != null ? m.points.toLocaleString() : '—'], ['Wallet', m.wallet != null ? fmt.money(m.wallet) : '—']];
  return ReactDOM.createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 320, background: 'rgba(24,20,16,.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: P.fontSans }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(430px,96vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: `1px solid ${P.hairline}` }}>
          <Avatar name={name} size={42} crown={m.member} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: P.ink, letterSpacing: '-.01em' }}>{name}</div>
            <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{m.id ? 'Customer ' + m.id : 'Not yet a customer record'}</div>
          </div>
          <IconBtn icon="x" size={16} onClick={onClose} />
        </div>
        <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 15 }}>
          {idv && <div><div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 8 }}>Verification</div>
            <window.IdentityLadder v={idv} compact /></div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9 }}>
            {stats.map(([k, v]) => <div key={k} style={{ padding: '10px 12px', background: P.surface2, borderRadius: P.r10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: P.inkMute }}>{k}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: P.ink, fontFamily: P.fontMono, marginTop: 3 }}>{v}</div>
            </div>)}
          </div>
          <div style={{ background: P.surface2, borderRadius: P.r10, overflow: 'hidden' }}>
            {rows.map(([k, v, mono], i) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 12px', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
              <span style={{ fontSize: 11.5, color: P.inkDim }}>{k}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: P.ink, fontFamily: mono ? P.fontMono : P.fontSans, textAlign: 'right', wordBreak: 'break-word' }}>{v}</span>
            </div>)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 9, padding: '13px 18px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
          <PBtn variant="secondary" size="sm" icon="clock" full>Order history</PBtn>
          <PBtn variant="primary" size="sm" icon="user" full>Open in Members</PBtn>
        </div>
      </div>
    </div>, document.body);
};

// ── ID scan + photo (the in-store event that does the heavy lifting) ────────
window.IdScanPanel = function IdScanPanel({ value, onChange, onLog }) {
  const P = useP();
  const [st, setSt] = React.useState(value && value.scannedAt ? 'done' : 'idle'); // idle | scanning | done
  const scan = () => {
    setSt('scanning');
    setTimeout(() => {
      const doc = { type: 'CA DL', num: '••••4821', expires: '2029-04-11', scannedAt: 'Just now', by: 'Priya Nair', where: 'Front Counter 1', photo: true, name: 'Jordan A. Vasquez', dob: '09/02/1988' };
      setSt('done');onChange && onChange(doc);
      onLog && onLog({ who: 'Priya Nair', role: 'You', action: 'Scanned & photographed government ID · CA DL ••••4821', time: 'just now', icon: 'scan' });
    }, 900);
  };
  if (st === 'done') {
    const d = (value && value.scannedAt ? value : null) || { type: 'CA DL', num: '••••4821', expires: '2029-04-11', by: 'Priya Nair', where: 'Front Counter 1' };
    return <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', background: P.goodSoft, border: `1px solid ${P.good}44`, borderRadius: P.r10 }}>
      <span style={{ width: 44, height: 30, borderRadius: 5, background: P.surface, border: `1px solid ${P.good}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="user" size={15} color={P.good} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>ID scanned &amp; photo captured</div>
        <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{d.type} {d.num} · expires {d.expires} · age 21+ ✓</div>
      </div>
      <PBtn variant="ghost" size="xs" icon="refresh" onClick={() => setSt('idle')}>Re-scan</PBtn>
    </div>;
  }
  return <div style={{ padding: '13px', background: P.surface2, border: `1px dashed ${P.hairline2}`, borderRadius: P.r10, textAlign: 'center' }}>
    <Icon name="scan" size={22} color={P.inkMute} />
    <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, marginTop: 6 }}>{st === 'scanning' ? 'Reading barcode…' : 'Scan the customer’s ID'}</div>
    <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 3, lineHeight: 1.45 }}>Reads the PDF417 barcode for name, DOB and expiry, and stores a photo of the document.</div>
    <div style={{ marginTop: 9 }}><PBtn variant="accent" size="sm" icon="scan" disabled={st === 'scanning'} onClick={scan}>{st === 'scanning' ? 'Scanning…' : 'Scan ID & capture photo'}</PBtn></div>
  </div>;
};

// ── The policy, stated once, where people will actually read it ─────────────
window.VerifyPolicyCard = function VerifyPolicyCard({ tight }) {
  const P = useP();
  const rows = [
  { i: 'shop', t: 'Walked in first', d: 'Counter scans the ID and photographs it. That alone clears them to shop in store — no SMS, no app, nothing else. If they later want delivery, one SMS code binds their phone and they are never asked again.' },
  { i: 'truck', t: 'Never walked in', d: 'Two options, their choice: a remote ID-check link before the first order, or nothing at all — the driver scans their ID at the door on delivery one, which upgrades the account for every order after it.' },
  { i: 'phone', t: 'The SMS is a delivery gate, not a door policy', d: 'It is only ever sent for a delivery order. A walk-in buying at the counter never receives one — the person is standing there with the document.' },
  { i: 'shield', t: 'The remote check is a substitute, not an extra', d: 'It only runs when no human has ever held the document. A scanned-in-store customer never sees it.' }];

  return <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}>
      <Icon name="shield" size={14} color={P.ink2} />
      <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: P.ink2 }}>Verify once — never twice</span>
    </div>
    <div style={{ padding: tight ? '10px 13px' : '13px', display: 'flex', flexDirection: 'column', gap: 11 }}>
      {rows.map((r) => <div key={r.t} style={{ display: 'flex', gap: 10 }}>
        <Icon name={r.i} size={15} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
        <div><div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{r.t}</div>
          <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.5, marginTop: 1 }}>{r.d}</div></div>
      </div>)}
    </div>
  </div>;
};