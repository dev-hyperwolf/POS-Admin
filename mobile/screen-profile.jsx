// ── Profile — driver, settings, appearance, history links ──────────────────
const useP = window.useP, useTheme = window.useTheme;

// Grouped settings list + row
function Group({ label, children }) {
  const P = useP();
  return (
    <div>
      {label && <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono, margin: '4px 4px 9px' }}>{label}</div>}
      <div style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}
function Row({ icon, tint, title, detail, control, onClick, last }) {
  const P = useP();
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderBottom: last ? 'none' : `1px solid ${P.hairline}`, cursor: onClick ? 'pointer' : 'default' }}>
      {icon && <span style={{ width: 32, height: 32, borderRadius: 9, background: (tint || P.ink) + (P.mode === 'dark' ? '22' : '18'), color: tint || P.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={icon} size={17} stroke={1.9} /></span>}
      <span style={{ flex: 1, fontSize: 16, fontWeight: 600, color: P.ink }}>{title}</span>
      {detail && <span style={{ fontSize: 12.5, color: P.inkMute, fontFamily: P.fontMono }}>{detail}</span>}
      {control}
      {onClick && !control && <Icon name="chevron-right" size={16} stroke={2} color={P.inkFaint} />}
    </div>
  );
}

window.ProfileScreen = function ProfileScreen() {
  const P = useP(); const M = window.useM();
  const { mode, toggle } = useTheme();
  const d = window.MD.DRIVER;
  const prof = window.M.profile();
  const [notif, setNotif] = React.useState(true);
  const [ann, setAnn] = React.useState(window.MD.ANNOUNCEMENTS.map((a) => a.on));
  const delivered = window.MD.SHIFT_COMPLETED.length + (M.s.completed || []).filter((s) => s.outcome !== 'failed').length;

  return (
    <div style={{ padding: '2px 16px 100px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* driver header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => window.M.openSheet('editavatar', {})} style={{ position: 'relative', width: 62, height: 62, flex: '0 0 auto', background: 'none', border: 'none', padding: 0, cursor: 'pointer', borderRadius: 99 }}>
          {prof.avatar ?
            <img src={prof.avatar} alt="" style={{ width: 62, height: 62, borderRadius: 99, objectFit: 'cover', display: 'block' }} /> :
            <Avatar name={d.name} size={62} />}
          <span style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 99, background: P.accent, border: `2.5px solid ${P.bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="camera" size={12} stroke={2.2} color={P.accentInk} /></span>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: P.ink }}>{d.name}</div>
          <div style={{ fontSize: 12.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 2 }}>{d.id} · {d.region}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '3px 10px', borderRadius: 99, background: M.s.duty ? P.goodSoft : P.surface3 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: M.s.duty ? P.good : P.inkMute }} /><span style={{ fontSize: 11.5, fontWeight: 700, color: M.s.duty ? P.good : P.inkDim }}>{M.s.duty ? 'On duty' : 'Off duty'}</span></div>
        </div>
      </div>

      {/* quick stats */}
      <div style={{ display: 'flex', gap: 10 }}>
        {[['Delivered', delivered, 'package'], ['On-time', window.MD.SHIFT.onTimePct + '%', 'clock'], ['Miles', window.MD.SHIFT.miles, 'route']].map(([k, v, ic]) => (
          <div key={k} style={{ flex: 1, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, padding: '12px 10px', textAlign: 'center' }}>
            <Icon name={ic} size={16} stroke={1.9} color={P.inkMute} />
            <div style={{ fontSize: 21, fontWeight: 800, color: P.ink, fontFamily: P.fontMono, marginTop: 6 }}>{v}</div>
            <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 1 }}>{k}</div>
          </div>
        ))}
      </div>

      <Group label="Vehicle & contact">
        <Row icon="truck" tint={P.info} title="Vehicle" detail={window.M.vehicle().label} onClick={() => window.M.openSheet('vehicles', {})} />
        <Row icon="phone" tint={P.good} title="Contact" detail={prof.pendingPhone ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ fontFamily: P.fontMono, color: P.inkMute }}>{prof.phone}</span><span style={{ padding: '2px 8px', borderRadius: 99, background: P.warnSoft, color: P.warn, fontSize: 10, fontWeight: 800, fontFamily: P.fontSans }}>Pending approval</span></span> : prof.phone} onClick={() => window.M.openSheet('editphone', {})} last />
      </Group>

      <Group label="Money & activity">
        <Row icon="cash" tint={P.accent} title="My tips" detail={window.HW.fmt.money(window.M.tipTotal())} onClick={() => window.M.push('tips')} />
        <Row icon="receipt" tint={P.info} title="Order history" onClick={() => window.M.push('orderhistory')} />
        <Row icon="list" tint={P.indica} title="Task history" onClick={() => window.M.push('taskhistory')} last />
      </Group>

      <Group label="Preferences">
        <Row icon={mode === 'dark' ? 'moon' : 'sun'} tint={P.accent} title="Appearance" control={<Seg size="sm" value={mode} onChange={(v) => { if (v !== mode) toggle(); }} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />} />
        <Row icon="bell" tint={P.warn} title="Push notifications" control={<Switch on={notif} onChange={setNotif} />} last />
      </Group>

      <Group label="Announcements shown to customers">
        {window.MD.ANNOUNCEMENTS.map((a, i) => (
          <Row key={a.id} icon="sparkle" tint={P.indica} title={a.label} control={<Switch on={ann[i]} onChange={(v) => setAnn((s) => s.map((x, j) => j === i ? v : x))} />} last={i === window.MD.ANNOUNCEMENTS.length - 1} />
        ))}
      </Group>

      <Group label="Support">
        <Row icon="lightning" tint={P.accent} title="Take the app tour" onClick={() => window.M.startTour()} />
        <Row icon="help" tint={P.info} title="Help & support" onClick={() => window.M.push('help')} />
        <Row icon="info" tint={P.neutral} title="App version" detail={'v' + d.appVersion} last />
      </Group>

      <PBtn variant="secondary" size="xl" full icon="user-off" onClick={() => { window.M.setDuty(false); window.M.flash('Signed out'); }}>Sign out</PBtn>
      <div style={{ textAlign: 'center', fontSize: 11.5, color: P.inkFaint, fontFamily: P.fontMono }}>Hyperwolf Driver + POS · {d.id}</div>
    </div>
  );
};

// Receipts are emailed to the customer automatically — no reprint/print.
function ReceiptEmailedNote() {
  const P = useP();
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}><Icon name="check-circle" size={15} stroke={2} color={P.good} /><span style={{ fontSize: 12.5, fontWeight: 600, color: P.inkDim }}>Receipt emailed to customer</span></div>;
}

window.OrderHistoryScreen = function OrderHistoryScreen() {
  const P = useP(); const M = window.useM();
  const money = window.HW.fmt.money;
  const [open, setOpen] = React.useState(null);
  const live = (M.s.completed || []).map((s) => ({ ...s, when: 'Today' }));
  const shift = window.MD.SHIFT_COMPLETED.map((s) => ({ ...s, when: s.at, collected: (s.cash || 0) + (s.card || 0) }));
  const all = [...live, ...shift];
  const methodTone = (m) => ({ cash: P.accent, card: P.info, split: P.indica }[m] || P.neutral);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <window.MTopBar title="Order history" sub={`${all.length} orders`} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {all.length === 0 && <div style={{ textAlign: 'center', color: P.inkMute, padding: '60px 20px', fontSize: 13.5 }}>No orders yet this shift.</div>}
        {all.map((s, i) => { const isOpen = open === i; const failed = s.outcome === 'failure'; return (
          <div key={i} style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, overflow: 'hidden' }}>
            <div onClick={() => setOpen(isOpen ? null : i)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', cursor: 'pointer' }}>
              <span style={{ width: 40, height: 40, borderRadius: 11, background: methodTone(s.method) + '22', color: methodTone(s.method), display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name={failed ? 'x' : s.method === 'cash' ? 'cash' : s.method === 'card' ? 'card' : s.method === 'split' ? 'split' : 'check'} size={19} stroke={1.9} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.order} · {s.when}{failed ? ' · failed' : ''}</div>
              </div>
              <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: failed ? P.inkMute : P.ink, fontFamily: P.fontMono, textDecoration: failed ? 'line-through' : 'none' }}>{money(s.total)}</div>
                <div style={{ fontSize: 11.5, color: P.inkMute, textTransform: 'capitalize', fontFamily: P.fontMono }}>{failed ? 'unpaid' : s.method}</div>
              </div>
              <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} stroke={2} color={P.inkFaint} />
            </div>
            {isOpen && !failed && <div style={{ padding: '0 15px 14px', borderTop: `1px solid ${P.hairline}` }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '11px 0 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: P.inkDim }}>Items</span><span style={{ color: P.ink2, fontFamily: P.fontMono }}>{s.items || '—'}</span></div>
                {s.cash > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: P.inkDim }}>Cash</span><span style={{ color: P.ink2, fontFamily: P.fontMono }}>{money(s.cash)}</span></div>}
                {(s.card || s.cardCharged) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: P.inkDim }}>Card charged</span><span style={{ color: P.ink2, fontFamily: P.fontMono }}>{money(s.card || s.cardCharged)}</span></div>}
                {s.change > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: P.inkDim }}>Change given</span><span style={{ color: P.ink2, fontFamily: P.fontMono }}>{money(s.change)}</span></div>}
              </div>
              <ReceiptEmailedNote />
            </div>}
          </div>
        ); })}
      </div>
    </div>
  );
};

window.TaskHistoryScreen = function TaskHistoryScreen() {
  const P = useP();
  const money = window.HW.fmt.money;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <window.MTopBar title="Task history" sub="Past shifts" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {window.MD.TASK_HISTORY.map((h) => (
          <div key={h.id} style={{ background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, padding: '15px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: P.ink }}>{h.date}</span>
              <div style={{ flex: 1 }} />
              <span style={{ padding: '3px 10px', borderRadius: 99, background: h.onTime === 100 ? P.goodSoft : P.warnSoft, color: h.onTime === 100 ? P.good : P.warn, fontSize: 11.5, fontWeight: 700, fontFamily: P.fontMono }}>{h.onTime}% on-time</span>
            </div>
            <div style={{ display: 'flex' }}>
              {[['Stops', h.stops], ['Avg $', money(h.collected / h.stops)], ['Collected', money(h.collected)], ['Miles', h.miles]].map(([k, v], i) => (
                <div key={k} style={{ flex: 1, borderLeft: i ? `1px solid ${P.hairline}` : 'none', paddingLeft: i ? 12 : 0 }}>
                  <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{k}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: P.ink, fontFamily: P.fontMono, marginTop: 3 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

Object.assign(window, { });

// Edit phone (sheet)
window.EditPhoneSheet = function EditPhoneSheet() {
  const P = useP();
  const prof = window.M.profile();
  const [val, setVal] = React.useState(prof.pendingPhone || prof.phone);
  const ok = /\d{3}.*\d{3}.*\d{4}/.test(val) && val !== prof.phone;
  return (
    <window.Sheet title="Contact number" onClose={() => window.M.closeSheet()} footer={
      <PBtn variant="accent" size="xl" full icon="check" disabled={!ok} onClick={() => { window.M.submitPhone(val); window.M.closeSheet(); window.M.flash('Number submitted — pending management approval', 'warn'); }}>Submit for approval</PBtn>
    }>
      <Eyebrow style={{ marginBottom: 8 }}>Mobile number</Eyebrow>
      <Field icon="phone" placeholder="(555) 555-5555" value={val} onChange={(e) => setVal(e.target.value)} />
      {prof.pendingPhone &&
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 12px', background: P.warnSoft, borderRadius: P.r10 }}><Icon name="clock" size={15} stroke={2} color={P.warn} /><span style={{ fontSize: 12.5, fontWeight: 600, color: P.warn }}>{prof.pendingPhone} is awaiting approval.</span></div>}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, padding: '11px 13px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10 }}>
        <Icon name="lock" size={15} stroke={2} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
        <span style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.45 }}>Changes to your contact number must be approved by management before they go live. Your current number stays active until then.</span>
      </div>
    </window.Sheet>);
};

// Edit avatar (sheet) — upload a photo or revert to initials
window.EditAvatarSheet = function EditAvatarSheet() {
  const P = useP();
  const prof = window.M.profile();
  const [img, setImg] = React.useState(prof.avatar || null);
  const inputRef = React.useRef(null);
  const pick = (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => setImg(r.result); r.readAsDataURL(f); };
  return (
    <window.Sheet title="Profile photo" onClose={() => window.M.closeSheet()} footer={
      <PBtn variant="accent" size="xl" full icon="check" onClick={() => { window.M.setAvatar(img); window.M.closeSheet(); window.M.flash('Profile photo updated'); }}>Save photo</PBtn>
    }>
      <input ref={inputRef} type="file" accept="image/*" onChange={pick} style={{ display: 'none' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '4px 0 8px' }}>
        <div style={{ width: 128, height: 128, borderRadius: 99, overflow: 'hidden', background: P.surface2, border: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {img ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Avatar name={window.MD.DRIVER.name} size={128} />}
        </div>
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <PBtn variant="secondary" size="lg" full icon="camera" onClick={() => inputRef.current && inputRef.current.click()}>{img ? 'Change photo' : 'Upload photo'}</PBtn>
          {img && <PBtn variant="secondary" size="lg" icon="trash" onClick={() => setImg(null)}>Remove</PBtn>}
        </div>
        <div style={{ fontSize: 11.5, color: P.inkMute, textAlign: 'center', lineHeight: 1.45 }}>A clear, front-facing photo helps customers recognize you at the door.</div>
      </div>
    </window.Sheet>);
};

// Vehicle manager (list / select / add / edit)
window.VehiclesSheet = function VehiclesSheet() {
  const P = useP(); const M = window.useM();
  const p = window.M.profile();
  return (
    <window.Sheet title="My vehicles" onClose={() => window.M.closeSheet()} footer={
      <PBtn variant="secondary" size="xl" full icon="plus" onClick={() => window.M.openSheet('editvehicle', {})}>Add a vehicle</PBtn>
    }>
      <div style={{ fontSize: 12.5, color: P.inkDim, marginBottom: 12, lineHeight: 1.4 }}>Pick the vehicle you're driving today. Add another if you switch.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 6 }}>
        {p.vehicles.map((v, i) => { const a = i === p.vehIdx; return (
          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', background: a ? P.accentSoft : P.surface2, border: `1.5px solid ${a ? P.accentBorder : P.hairline2}`, borderRadius: P.r14 }}>
            <button onClick={() => window.M.selectVehicle(i)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, background: a ? P.accent : P.surface3, color: a ? P.accentInk : P.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="truck" size={19} stroke={1.9} /></span>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>{v.label}</div><div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{v.plate}{a ? ' · active' : ''}</div></div>
            </button>
            <button onClick={() => window.M.openSheet('editvehicle', { idx: i })} style={{ padding: '7px 12px', background: 'transparent', border: `1px solid ${P.hairline2}`, borderRadius: P.r8, color: P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
          </div>); })}
      </div>
    </window.Sheet>);
};
window.EditVehicleSheet = function EditVehicleSheet({ idx }) {
  const P = useP();
  const existing = idx != null ? window.M.profile().vehicles[idx] : null;
  const [label, setLabel] = React.useState(existing ? existing.label : '');
  const [plate, setPlate] = React.useState(existing ? existing.plate : '');
  return (
    <window.Sheet title={idx != null ? 'Edit vehicle' : 'Add vehicle'} onClose={() => window.M.openSheet('vehicles', {})} footer={
      <div style={{ display: 'flex', gap: 10 }}>
        {idx != null && window.M.profile().vehicles.length > 1 && <PBtn variant="secondary" size="xl" icon="trash" onClick={() => { window.M.removeVehicle(idx); window.M.openSheet('vehicles', {}); }}>Remove</PBtn>}
        <PBtn variant="accent" size="xl" full icon="check" disabled={!label.trim() || !plate.trim()} onClick={() => { window.M.saveVehicle({ label: label.trim(), plate: plate.trim().toUpperCase() }, idx); window.M.openSheet('vehicles', {}); window.M.flash('Vehicle saved'); }}>Save</PBtn>
      </div>
    }>
      <Eyebrow style={{ marginBottom: 8 }}>Vehicle</Eyebrow>
      <div style={{ marginBottom: 16 }}><Field icon="truck" placeholder="e.g. Van, Sprinter" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
      <Eyebrow style={{ marginBottom: 8 }}>License plate</Eyebrow>
      <Field icon="board" placeholder="7HWL294" value={plate} onChange={(e) => setPlate(e.target.value)} />
    </window.Sheet>);
};
