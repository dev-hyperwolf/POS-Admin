// ── Text customer — template picker + admin-controlled template manager ─────
const useP = window.useP;

function msgCtx(task) {
  const d = window.MD.DRIVER;
  return { first: (task?.name || 'there').split(' ')[0], address: task?.addr || '', eta: task?.eta || 'soon', vehicle: (window.M.vehicle ? window.M.vehicle().label : d.vehicle.replace(/\s*·.*/, '')), driver: d.name.split(' ')[0] };
}

// Driver-facing: pick a pre-set message; it "pre-fills" the phone's SMS app.
window.TextCustomerSheet = function TextCustomerSheet({ task }) {
  const P = useP(); const M = window.useM();
  const tpls = window.M.templates();
  const ctx = msgCtx(task);
  return (
    <window.Sheet title="Text customer" onClose={() => window.M.closeSheet()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 12.5, color: P.inkDim }}>To {task?.name} · {task?.phone || ''}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => window.M.openSheet('msgtemplates', { task })} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'transparent', border: `1px solid ${P.hairline2}`, borderRadius: P.r8, color: P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}><Icon name="pencil" size={13} stroke={2} />Manage</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
        {tpls.map((t) => (
          <button key={t.id} onClick={() => { window.M.closeSheet(); window.M.flash('Opening Messages…'); }} style={{ textAlign: 'left', padding: '14px 15px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r14, cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}><span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{t.label}</span><div style={{ flex: 1 }} /><Icon name="arrow-right" size={16} stroke={2} color={P.info} /></div>
            <div style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.5 }}>{window.MD.fillMsg(t.body, ctx)}</div>
          </button>
        ))}
      </div>
    </window.Sheet>);
};

// Admin: manage templates (add / edit / remove)
window.MsgTemplatesSheet = function MsgTemplatesSheet({ task }) {
  const P = useP(); const M = window.useM();
  const tpls = window.M.templates();
  return (
    <window.Sheet title="Message templates" onClose={() => window.M.closeSheet()} footer={
      <PBtn variant="accent" size="xl" full icon="plus" onClick={() => window.M.openSheet('editmsg', { task })}>New template</PBtn>
    }>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 2px 12px' }}>
        <Icon name="info" size={15} stroke={2} color={P.inkMute} />
        <span style={{ fontSize: 12, color: P.inkDim, lineHeight: 1.4 }}>Company-controlled. Drivers send these — they can't free-type.</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tpls.map((t) => (
          <div key={t.id} style={{ padding: '13px 15px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{t.label}</span><div style={{ flex: 1 }} />
              <button onClick={() => window.M.openSheet('editmsg', { id: t.id, task })} style={{ padding: '5px 10px', background: 'transparent', border: `1px solid ${P.hairline2}`, borderRadius: P.r8, color: P.ink2, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
              <button onClick={() => window.M.deleteTemplate(t.id)} style={{ width: 28, height: 28, borderRadius: P.r8, background: 'transparent', border: `1px solid ${P.hairline2}`, color: P.bad, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="trash" size={14} stroke={2} /></button>
            </div>
            <div style={{ fontSize: 12, color: P.inkDim, lineHeight: 1.45, fontFamily: P.fontMono }}>{t.body}</div>
          </div>
        ))}
      </div>
    </window.Sheet>);
};

// Admin: edit / create one template with dynamic-param chips
window.EditMsgSheet = function EditMsgSheet({ id, task }) {
  const P = useP(); const M = window.useM();
  const existing = id ? window.M.templates().find((t) => t.id === id) : null;
  const [label, setLabel] = React.useState(existing ? existing.label : '');
  const [body, setBody] = React.useState(existing ? existing.body : '');
  const ctx = msgCtx(task);
  const PARAM_LABEL = { '{first}': 'First name', '{address}': 'Address', '{eta}': 'ETA', '{vehicle}': 'Vehicle', '{driver}': 'Driver' };
  return (
    <window.Sheet title={id ? 'Edit template' : 'New template'} onClose={() => window.M.closeSheet()} footer={
      <div style={{ display: 'flex', gap: 10 }}>
        {id && <PBtn variant="secondary" size="xl" icon="trash" onClick={() => { window.M.deleteTemplate(id); window.M.closeSheet(); }}>Delete</PBtn>}
        <PBtn variant="accent" size="xl" full icon="check" disabled={!label.trim() || !body.trim()} onClick={() => { window.M.saveTemplate({ id: id || undefined, label: label.trim(), body: body.trim() }); window.M.openSheet('msgtemplates', { task }); window.M.flash('Template saved'); }}>Save</PBtn>
      </div>
    }>
      <Eyebrow style={{ marginBottom: 8 }}>Label</Eyebrow>
      <div style={{ marginBottom: 16 }}><Field icon="tag" placeholder="e.g. On my way" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
      <Eyebrow style={{ marginBottom: 8 }}>Message</Eyebrow>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Type the message…" style={{ width: '100%', resize: 'none', padding: '12px 14px', background: P.field, border: `1px solid ${P.fieldBorder}`, borderRadius: P.r12, color: P.ink, fontSize: 14, fontFamily: P.fontSans, outline: 'none', marginBottom: 12 }} />
      <Eyebrow style={{ marginBottom: 8 }}>Insert a dynamic field</Eyebrow>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {window.MD.MSG_PARAMS.map((p) => <button key={p} onClick={() => setBody((b) => (b + (b && !b.endsWith(' ') ? ' ' : '') + p))} style={{ padding: '8px 12px', borderRadius: 99, border: `1.5px solid ${P.accentBorder}`, background: P.accentSoft, color: P.mode === 'dark' ? P.accent : '#7A5A00', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{PARAM_LABEL[p]}</button>)}
      </div>
      <div style={{ padding: '13px 15px', background: P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r12 }}>
        <div style={{ fontSize: 10.5, color: P.inkMute, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: P.fontMono, marginBottom: 6 }}>Preview</div>
        <div style={{ fontSize: 13, color: P.ink2, lineHeight: 1.5 }}>{body ? window.MD.fillMsg(body, ctx) : 'Your message will appear here…'}</div>
      </div>
    </window.Sheet>);
};

Object.assign(window, { msgCtx });
