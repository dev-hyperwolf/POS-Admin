// ── Product shells · editor modal + the one Add Product flow ───────────────
// A SHELL IS NOT A PRODUCT. It is the family template a product hangs off.
//
//   Shell     "Alpine · All-In-One Vape 1g"      ← brand, format, size, price,
//     ├─ Fruit Punch          SKU AL-AIO-FP   $38     traits, box, meta
//     ├─ Blue Dream           SKU AL-AIO-BD   $38   ← a VARIATION (a product)
//     └─ …up to ~50 more
//
// Ownership, so nothing is entered in two places:
//   SHELL      brand · format · category · subcategory · size · pack ·
//              delivery box · RETAIL + SALE PRICE · traits · meta · WM node
//   VARIATION  flavour or strain name · SKU · photo · description ·
//              display-sample flag · an OPTIONAL price override (rare)
//   BATCH      quantity · wholesale cost · barcode / RFID · THC · expiry · METRC
//
// The shell record itself lives in shell-store.jsx (window.HW_SHELL).
const useP = window.useP;
const SH = window.HW_SHELL;

function Lb({ children, hint, right }) {
  const P = useP();
  return <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>{children}</span>
    {hint && <span title={hint} style={{ display: 'inline-flex', cursor: 'help', color: P.inkFaint }}><Icon name="info" size={12} stroke={1.9} /></span>}
    {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
  </div>;
}
function Sel2({ value, onChange, options }) {
  const P = useP();
  return <div style={{ position: 'relative' }}>
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', padding: '9px 32px 9px 12px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: P.field, fontSize: 13.5, fontWeight: 600, color: P.ink, fontFamily: P.fontSans, minHeight: 38, outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
    <Icon name="chevron-down" size={14} stroke={2.2} color={P.inkMute} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
  </div>;
}
function Tag({ children, kind }) {
  const P = useP();
  const c = kind === 'good' ? P.good : kind === 'warn' ? P.warn : kind === 'ai' ? P.indica : P.info;
  const bg = kind === 'good' ? P.goodSoft : kind === 'warn' ? P.warnSoft : kind === 'ai' ? P.indica + '22' : P.infoSoft;
  return <span style={{ display: 'inline-flex', padding: '1px 7px', borderRadius: 99, background: bg, color: c, fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: P.fontMono, whiteSpace: 'nowrap' }}>{children}</span>;
}
// A mini switch that reads as a toggle, used for sample + price override.
function MiniSwitch({ on, onChange, color }) {
  const P = useP();
  return <button onClick={(e) => {e.stopPropagation();onChange(!on);}} style={{ width: 32, height: 18, borderRadius: 99, background: on ? color || P.accent : P.hairline3, padding: 2, display: 'flex', alignItems: 'center', border: 'none', cursor: 'pointer', transition: 'background .15s', flex: '0 0 auto' }}>
    <span style={{ width: 14, height: 14, borderRadius: 99, background: '#fff', transform: on ? 'translateX(14px)' : 'translateX(0)', transition: 'transform .18s', boxShadow: '0 1px 2px rgba(0,0,0,.3)' }} />
  </button>;
}

// ── Edit a shell — the same form the Shells module uses, in a modal ────────
window.ShellEditModal = function ShellEditModal({ p, shellId, onClose, onSave }) {
  const P = useP();
  const id = shellId || (p ? SH.shellOf(p).id : null);
  const shell = SH.shellById(id);
  if (!shell) return null;
  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 220, background: P.scrim, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 20px', overflowY: 'auto' }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(900px,96vw)', background: P.bg, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}`, background: P.surface }}>
        <Thumb item={shell.variations[0] ? shell.variations[0].thumb : { hue: shell.hue }} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>Product shell</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: P.ink, letterSpacing: '-.01em' }}>{shell.name}</div>
          <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 1 }}>{shell.id} · {shell.variations.length} variation{shell.variations.length === 1 ? '' : 's'} · {shell.stores} store{shell.stores > 1 ? 's' : ''}</div>
        </div>
        <IconBtn icon="x" size={16} onClick={onClose} />
      </div>
      <div style={{ padding: 20, maxHeight: '72vh', overflowY: 'auto' }}>
        <window.ShellForm editingId={shell.id} compact onCancel={onClose} onSaved={() => {onSave && onSave();onClose();}} />
      </div>
    </div>
  </div>;
};

// ── Add a product = add a VARIATION to a shell ─────────────────────────────
const FLOW_STEPS = [
{ k: 'shell', label: 'Choose shell' },
{ k: 'variation', label: 'Variation' },
{ k: 'batch', label: 'First batch' },
{ k: 'done', label: 'Done' }];

window.AddProductFlow = function AddProductFlow({ entry = 'catalog', lockShell, onClose, onDone }) {
  const P = useP();
  const money = window.HW.fmt.money0;
  const shells = SH.useShells();
  const [step, setStep] = React.useState(lockShell ? 1 : 0);
  const [q, setQ] = React.useState('');
  const [shellId, setShellId] = React.useState(lockShell || null);
  const [newShell, setNewShell] = React.useState(false); // inline "create shell first"
  const shell = shellId ? SH.shellById(shellId) : null;
  const [v, setV] = React.useState({ name: '', strain: 'Hybrid', sku: '', skuManual: false, override: false, price: '', desc: '', photo: '', sample: false, metaTitle: '', metaDesc: '', slug: '', keywords: '' });
  const [metaOpen, setMetaOpen] = React.useState(false);
  const [b, setB] = React.useState({ skip: false, qty: '', cost: '', code: '', metrc: '', exp: '', thc: '', cbd: '', total: '' });
  const s1 = (k, x) => setV((o) => ({ ...o, [k]: x }));
  const b1 = (k, x) => setB((o) => ({ ...o, [k]: x }));

  const hits = !q.trim() ? shells.slice(0, 5) : shells.filter((s) => (s.name + ' ' + s.brand + ' ' + s.cat + ' ' + s.sub).toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  const cur = FLOW_STEPS[step];

  // SKU is generated from the shell code + product initials, and stays editable
  // because it becomes external_id — the key Weedmaps recognises the product by.
  const autoSku = React.useMemo(() => {
    if (!shell) return '';
    const size = String(shell.weight).replace(/[^0-9]/g, '').slice(0, 3) || 'X';
    const init = v.name.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 3) || 'NEW';
    return SH.mono2(shell.brand) + '-' + size + '-' + init;
  }, [shell && shell.id, v.name]);
  const sku = v.skuManual ? v.sku : autoSku;

  // Storefront meta belongs to the PRODUCT, not the family — every variation
  // gets its own search listing. Drafted from the name, editable per field.
  const meta = React.useMemo(() => {
    const nm = v.name.trim() || 'New product';
    const br = shell ? shell.brand : '';
    return {
      title: v.metaTitle || `${nm} — ${br} | Hyperwolf`,
      desc: v.metaDesc || `Buy ${nm} by ${br} — ${shell ? shell.weight + ' ' + shell.cat.toLowerCase() : ''}, lab-tested with same-day delivery across Riverside and San Bernardino.`,
      slug: v.slug || SH.slugify(br + '-' + nm),
      keywords: v.keywords || [br.toLowerCase(), nm.toLowerCase(), shell ? shell.cat.toLowerCase() : '', String(v.strain).toLowerCase(), 'cannabis delivery'].filter(Boolean).join(', ') };
  }, [v.name, v.strain, v.metaTitle, v.metaDesc, v.slug, v.keywords, shell && shell.id]);

  // Seed the description from the AI drafter the moment a shell is chosen.
  React.useEffect(() => {
    if (shell && !v.desc) setV((o) => ({ ...o, desc: SH.aiDesc(shell, { name: o.name, strain: o.strain }), price: String(SH.effectivePrice(shell)) }));
  }, [shell && shell.id]);

  const canNext = cur.k === 'shell' ? !!shell :
  cur.k === 'variation' ? !!v.name.trim() && !!sku.trim() && (!v.override || v.price !== '') :
  cur.k === 'batch' ? b.skip || b.qty !== '' && b.cost !== '' : true;

  // WHAT IS STOPPING YOU, in words.
  //
  // The gate above is right; being SILENT about it was not. Continue had no
  // `disabled` attribute and only a faded opacity, so clicking it did nothing,
  // said nothing, and left no way to find out what was wrong. Driven headlessly,
  // five consecutive clicks moved the flow zero steps and raised zero errors —
  // which is precisely what "I don't even know what to do" feels like.
  const missing =
    cur.k === 'shell' ? (!shell ? 'Pick a shell to continue.' : null) :
    cur.k === 'variation' ? (
      !v.name.trim() ? 'Name the flavour to continue — e.g. “Fruit Punch”.' :
      !sku.trim() ? 'This variation needs a SKU.' :
      v.override && v.price === '' ? 'You overrode the price — enter one, or switch the override off.' : null) :
    cur.k === 'batch' ? (
      !b.skip && b.qty === '' ? 'Enter a quantity, or tick “create without stock”.' :
      !b.skip && b.cost === '' ? 'Enter a unit cost, or tick “create without stock”.' : null) :
    null;
  const effPrice = v.override && v.price !== '' ? parseFloat(v.price) || 0 : shell ? SH.effectivePrice(shell) : 0;
  const margin = effPrice && b.cost ? Math.round((1 - (parseFloat(b.cost) || 0) / (effPrice || 1)) * 100) : null;

  const commit = () => {
    if (!shell) return;
    SH.addVariation(shell.id, { sku, name: v.name.trim() || 'New Variation', price: effPrice, override: v.override,
      strain: v.strain === 'N/A' ? null : v.strain, active: !v.sample && !b.skip, qty: b.skip ? 0 : parseInt(b.qty || '0', 10) || 0,
      sample: v.sample, desc: v.desc, photo: v.photo, thumb: { hue: shell.hue },
      metaTitle: meta.title, metaDesc: meta.desc, slug: meta.slug, keywords: meta.keywords });
  };

  const Head = () => <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 20px', background: P.surface2, borderBottom: `1px solid ${P.hairline}`, overflowX: 'auto' }}>
    {FLOW_STEPS.map((s, i) => {const on = i === step, done = i < step;
      return <React.Fragment key={s.k}>
        {i > 0 && <span style={{ width: 16, height: 1.5, background: done || on ? P.accent : P.hairline2, flex: '0 0 auto' }} />}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
          <span style={{ width: 19, height: 19, borderRadius: 99, background: done ? P.good : on ? P.accent : P.surface3, color: done ? '#fff' : on ? P.accentInk : P.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, fontFamily: P.fontMono }}>{done ? <Icon name="check" size={11} stroke={3} color="#fff" /> : i + 1}</span>
          <span style={{ fontSize: 11.5, fontWeight: on ? 700 : 600, color: on ? P.ink : P.inkMute, whiteSpace: 'nowrap' }}>{s.label}</span>
        </span>
      </React.Fragment>;})}
  </div>;

  const ShellRecap = () => shell ? <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', background: P.goodSoft, borderRadius: P.r10 }}>
    <Thumb item={{ hue: shell.hue }} size={34} radius={8} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.good }}>Adding to shell</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shell.name}</div>
      <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{shell.id} · {SH.familyPath(shell)} · {shell.variations.length} existing variation{shell.variations.length === 1 ? '' : 's'}</div>
    </div>
    {!lockShell && <PBtn variant="ghost" size="xs" onClick={() => {setShellId(null);setStep(0);}}>Change</PBtn>}
  </div> : null;

  const readImg = (file) => {
    if (!file || !/^image\//.test(file.type)) return;
    const r = new FileReader();r.onload = () => s1('photo', r.result);r.readAsDataURL(file);
  };

  // ── inline "create the shell first" ──
  if (newShell) return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 220, background: P.scrim, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 20px', overflowY: 'auto' }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(900px,96vw)', background: P.bg, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}`, background: P.surface }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="box-add" size={16} stroke={2} /></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>New shell first</div><div style={{ fontSize: 11.5, color: P.inkDim }}>Define the family, then carry straight on to its first variation</div></div>
        <IconBtn icon="x" size={16} onClick={onClose} />
      </div>
      <div style={{ padding: 20, maxHeight: '74vh', overflowY: 'auto' }}>
        <window.ShellForm compact onCancel={() => setNewShell(false)} onSaved={(id) => {setNewShell(false);setShellId(id);setStep(1);}} />
      </div>
    </div>
  </div>;

  return <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 220, background: P.scrim, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '36px 20px', overflowY: 'auto' }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: cur.k === 'variation' ? 'min(940px,96vw)' : 'min(640px,96vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden', transition: 'width .2s' }} data-tour="add-product">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '15px 20px', borderBottom: `1px solid ${P.hairline}` }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: P.accent, color: P.accentInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="package" size={16} stroke={2} /></span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>New product</div><div style={{ fontSize: 11.5, color: P.inkDim }}>A product is a <b>variation</b> of a shell — pick the shell, then name the flavour</div></div>
        <IconBtn icon="x" size={16} onClick={onClose} />
      </div>
      <Head />
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 15, minHeight: 260 }}>

        {cur.k === 'shell' && <>
          <div style={{ display: 'flex', gap: 9, padding: '11px 13px', background: P.infoSoft, borderRadius: P.r10 }}>
            <Icon name="info" size={14} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Shells describe a <b>family</b> — “Alpine · All-In-One Vape 1g”. A flavour like <i>Fruit Punch</i> is a product hanging off it, and one shell can carry fifty. Pick the shell first and everything shared comes with it.</div>
          </div>
          <div><Lb>Find the shell</Lb><Field icon="search" placeholder="Brand, format, category or subcategory…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div style={{ border: `1px solid ${P.hairline}`, borderRadius: P.r10, overflow: 'hidden' }}>
            {hits.map((s, i) => <button key={s.id} onClick={() => {setShellId(s.id);setStep(1);}} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', borderTop: i ? `1px solid ${P.hairline}` : 'none', cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }} onMouseEnter={(e) => e.currentTarget.style.background = P.surface2} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <Thumb item={{ hue: s.hue }} size={34} radius={8} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                <div style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{s.id} · {SH.familyPath(s)} · {s.variations.length} variation{s.variations.length === 1 ? '' : 's'}</div>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: P.info, flex: '0 0 auto' }}>Add variation</span>
            </button>)}
            {hits.length === 0 && <div style={{ padding: 16, textAlign: 'center', fontSize: 12.5, color: P.inkMute }}>No shell matches “{q}”.</div>}
          </div>
          <button onClick={() => setNewShell(true)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px', background: P.surface2, border: `1px dashed ${P.hairline2}`, borderRadius: P.r10, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans, width: '100%' }}>
            <Icon name="plus" size={14} color={P.ink2} />
            <span style={{ flex: 1, fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>Genuinely new format or brand? <b>Create the shell here</b> — you’ll land straight back on this flow to add its first variation.</span>
            <Icon name="chevron-right" size={15} color={P.inkMute} />
          </button>
        </>}

        {cur.k === 'variation' && shell && <>
          <ShellRecap />
          {/* prefill meter */}
          <div title="How much of the new product is already filled in from the shell. The higher this is, the faster staff can add a variation." style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', background: P.goodSoft, border: `1px solid ${P.good}44`, borderRadius: P.r12 }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: P.good, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}><Icon name="check" size={18} stroke={2.4} color="#fff" /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {(() => {const inh = SH.sharedRows(shell).length + (shell.traits || []).length;const tot = inh + 5;
                return <>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{inh} of {tot} details pre-filled</div>
                  <div style={{ fontSize: 11.5, color: P.good, marginTop: 2 }}>Inherited from the shell — you only set what makes this product unique.</div>
                </>;})()}
            </div>
            <div style={{ width: 110, height: 8, borderRadius: 99, background: P.good + '33', overflow: 'hidden', flex: '0 0 auto' }}>
              {(() => {const inh = SH.sharedRows(shell).length + (shell.traits || []).length;
                return <div style={{ width: Math.round(inh / (inh + 5) * 100) + '%', height: '100%', background: P.good, borderRadius: 99 }} />;})()}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 16, alignItems: 'start' }}>
            {/* inherited (locked) */}
            <div style={{ border: `1px solid ${P.hairline}`, borderRadius: P.r12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                <Icon name="lock" size={14} stroke={1.9} color={P.inkMute} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>Inherited from shell</span>
              </div>
              <div style={{ fontSize: 11.5, color: P.inkMute, marginBottom: 13 }}>Locked to keep the family consistent.</div>
              {SH.sharedRows(shell).map((f, i) => <div key={i} style={{ marginBottom: 9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>{f.label}</span>{f.flag && <Tag>{f.flag}</Tag>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: 9 }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: P.ink2, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.value}</span>
                    {f.sub && <span style={{ display: 'block', fontSize: 10, color: P.inkMute, fontFamily: P.fontMono, marginTop: 1 }}>{f.sub}</span>}
                  </span>
                  <Icon name="lock" size={12} stroke={1.9} color={P.inkFaint} />
                </div>
              </div>)}
              {(shell.traits || []).length > 0 && <div style={{ marginTop: 12, paddingTop: 13, borderTop: `1px solid ${P.hairline}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>Product traits · carry across the line</span>
                  <span title="Pack count, servings, infusion — set on the shell, inherited by the whole line. Edit them on the shell, not per product." style={{ display: 'inline-flex', cursor: 'help', color: P.inkFaint }}><Icon name="info" size={12} /></span>
                </div>
                {shell.traits.map((t, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 11px', marginBottom: 7, background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: 9 }}>
                  <span style={{ fontSize: 12.5, color: P.inkDim }}>{t.label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink2, fontFamily: P.fontMono }}>{t.value}</span>
                </div>)}
              </div>}
            </div>

            {/* this variation (editable) */}
            <div style={{ border: `1px solid ${P.accentBorder}`, borderRadius: P.r12, padding: 16, boxShadow: `0 0 0 3px ${P.accentSoft}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                <Icon name="pencil" size={14} stroke={1.9} color={P.mode === 'dark' ? P.accent : '#7A5A00'} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>This variation</span>
              </div>
              <div style={{ fontSize: 11.5, color: P.inkMute, marginBottom: 13 }}>The only details that change per product.</div>

              <div style={{ marginBottom: 13 }}>
                <Lb>Product photo</Lb>
                <label onDrop={(e) => {e.preventDefault();readImg(e.dataTransfer.files && e.dataTransfer.files[0]);}} onDragOver={(e) => e.preventDefault()}
                  title="Drag an image in or click to browse. One image per variation, stored on the product record."
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, border: `1.5px dashed ${P.hairline3}`, borderRadius: 11, background: P.surface2, cursor: 'pointer', textAlign: 'center' }}>
                  <input type="file" accept="image/*" onChange={(e) => readImg(e.target.files && e.target.files[0])} style={{ display: 'none' }} />
                  {v.photo ?
                  <><img src={v.photo} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 10 }} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: P.mode === 'dark' ? P.accent : '#7A5A00' }}>Replace image</span></> :
                  <><span style={{ width: 42, height: 42, borderRadius: 10, background: P.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.inkMute }}><Icon name="camera" size={20} stroke={1.7} /></span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>Drag &amp; drop or click to upload</span>
                    <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>PNG or JPG · 1000 × 1000 px</span></>}
                </label>
              </div>

              <div style={{ marginBottom: 13 }}><Lb hint="The flavour or strain — this is what makes it a distinct product.">Product name *</Lb>
                <Field placeholder="e.g. Fruit Punch" value={v.name} onChange={(e) => s1('name', e.target.value)} /></div>

              <div style={{ marginBottom: 13 }}><Lb>Type</Lb>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['Indica', P.indica], ['Sativa', P.sativa], ['Hybrid', P.hybrid]].map(([t, c]) => {const on = v.strain === t;
                    return <button key={t} onClick={() => setV((o) => ({ ...o, strain: t, desc: SH.aiDesc(shell, { name: o.name, strain: t }) }))} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 10px', borderRadius: P.r999, border: `1px solid ${on ? P.accentBorder : P.hairline2}`, background: on ? P.accentSoft : P.surface, color: on ? P.ink : P.ink2, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>
                      <span style={{ width: 6, height: 6, borderRadius: 99, background: c }} />{t}</button>;})}
                  <Sel2 value={['Indica', 'Sativa', 'Hybrid'].includes(v.strain) ? 'More' : v.strain} onChange={(x) => x !== 'More' && s1('strain', x)} options={['More', 'CBD', 'N/A']} />
                </div>
              </div>

              <div style={{ marginBottom: 13 }}>
                <Lb right={<PBtn variant="soft" size="xs" icon="sparkle" onClick={() => s1('desc', SH.aiDesc(shell, v))}>Regenerate</PBtn>}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Description <Tag kind="ai">AI draft</Tag></span>
                </Lb>
                <textarea value={v.desc} onChange={(e) => s1('desc', e.target.value)} rows={3} placeholder="Tasting notes, effects — anything specific to this product…"
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 74, padding: '9px 12px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: P.field, color: P.ink, fontSize: 13.5, fontFamily: P.fontSans, lineHeight: 1.45, outline: 'none' }} />
                <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 5 }}>Pre-drafted by the AI product generator — edit freely or regenerate.</div>
              </div>

              <div style={{ marginBottom: 13 }}>
                <Lb hint="A variation's SKU becomes external_id — the key Weedmaps recognises it by. Changing it later makes WM treat it as a brand-new product."
                  right={<button onClick={() => setV((o) => ({ ...o, skuManual: !o.skuManual, sku: o.skuManual ? '' : autoSku }))} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: P.fontSans }}><Tag kind={v.skuManual ? 'warn' : 'good'}>{v.skuManual ? 'Manual · lock' : 'Auto-assigned · edit'}</Tag></button>}>SKU</Lb>
                {v.skuManual ?
                <Field mono value={v.sku} onChange={(e) => s1('sku', e.target.value.toUpperCase())} /> :
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, minHeight: 38 }}>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: P.ink2, fontFamily: P.fontMono }}>{autoSku || '—'}</span>
                  <Icon name="refresh" size={14} stroke={1.8} color={P.inkMute} />
                </div>}
                <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 5 }}>Generated from the shell code + product name. Get it right now — it is permanent on Weedmaps.</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 13px', marginBottom: 13, background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: 9 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>Display sample</div>
                  <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 2, lineHeight: 1.4 }}>Hidden from the menu &amp; not for sale — still tracked as a full product profile.</div>
                </div>
                <MiniSwitch on={v.sample} onChange={(x) => s1('sample', x)} color={P.warn} />
              </div>

              <div>
                <Lb right={<span onClick={() => s1('override', !v.override)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: v.override ? P.warn : P.inkMute }}>Override shell price</span>
                  <MiniSwitch on={v.override} onChange={(x) => s1('override', x)} color={P.warn} /></span>}>Price</Lb>
                {v.override ?
                <Field mono icon="dollar" placeholder="0.00" value={v.price} onChange={(e) => s1('price', e.target.value.replace(/[^0-9.]/g, ''))} /> :
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10, minHeight: 38 }}>
                  <span style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 7 }}>
                    {shell.sale ? <span style={{ fontSize: 11.5, color: P.inkFaint, textDecoration: 'line-through', fontFamily: P.fontMono }}>{money(shell.price)}</span> : null}
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: shell.sale ? P.bad : P.ink, fontFamily: P.fontMono }}>{money(SH.effectivePrice(shell))}</span>
                    {shell.sale ? <Tag kind="warn">On sale</Tag> : null}
                  </span>
                  <Icon name="lock" size={12} stroke={1.9} color={P.inkFaint} />
                </div>}
                <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 5 }}>{v.override ? 'Custom price for this variation only — the rest of the family is unaffected.' : `Inherits the shell price of ${money(SH.effectivePrice(shell))}${shell.sale ? ' (promo, retail ' + money(shell.price) + ')' : ''}. Rare to override.`}</div>
              </div>

              {/* Storefront meta — per product, never shared with the family */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${P.hairline}` }}>
                <Lb hint="Each variation is its own storefront page, so it gets its own title, description and slug. Nothing here is shared with the rest of the family."
                  right={<PBtn variant="ghost" size="xs" iconRight={metaOpen ? 'chevron-up' : 'chevron-down'} onClick={() => setMetaOpen(!metaOpen)}>{metaOpen ? 'Hide' : 'Edit'}</PBtn>}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Search &amp; storefront meta <Tag kind="good">Auto-drafted</Tag></span>
                </Lb>
                {!metaOpen ?
                <div style={{ padding: '11px 13px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
                  <div style={{ fontSize: 11.5, color: P.good, fontFamily: P.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>hyperwolf.com › shop › {meta.slug}</div>
                  <div style={{ fontSize: 13.5, color: '#1a0dab', fontWeight: 600, marginTop: 3, lineHeight: 1.3 }}>{meta.title}</div>
                  <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5, marginTop: 3 }}>{meta.desc}</div>
                </div> :
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  <div><Lb hint="Recommended 50–60 characters.">Meta title</Lb><Field value={meta.title} onChange={(e) => s1('metaTitle', e.target.value)} />
                    <div style={{ fontSize: 11.5, color: meta.title.length > 60 ? P.warn : P.inkMute, fontFamily: P.fontMono, marginTop: 4 }}>{meta.title.length} / 60</div></div>
                  <div><Lb hint="Recommended 150–160 characters.">Meta description</Lb>
                    <textarea value={meta.desc} onChange={(e) => s1('metaDesc', e.target.value)} rows={3} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: '9px 12px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: P.field, color: P.ink, fontSize: 13.5, fontFamily: P.fontSans, lineHeight: 1.45, outline: 'none' }} />
                    <div style={{ fontSize: 11.5, color: meta.desc.length > 160 ? P.warn : P.inkMute, fontFamily: P.fontMono, marginTop: 4 }}>{meta.desc.length} / 160</div></div>
                  <div><Lb>URL slug</Lb><Field mono value={meta.slug} onChange={(e) => s1('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} /></div>
                  <div><Lb>Keywords</Lb><Field value={meta.keywords} onChange={(e) => s1('keywords', e.target.value)} /></div>
                </div>}
              </div>
            </div>
          </div>
        </>}

        {cur.k === 'batch' && <>
          <ShellRecap />
          <div style={{ display: 'flex', gap: 9, padding: '11px 13px', background: P.infoSoft, borderRadius: P.r10 }}>
            <Icon name="info" size={14} color={P.info} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Stock never gets typed as a bare number — it arrives as a <b>batch</b>. The batch carries the quantity, what we paid, its own barcode / RFID and its potency. That is why THC is per batch and why cost is here rather than on the shell.</div>
          </div>
          <label onClick={() => b1('skip', !b.skip)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: b.skip ? P.surface3 : P.surface2, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, cursor: 'pointer' }}>
            <Check on={b.skip} onChange={(x) => b1('skip', x)} size={17} />
            <span style={{ fontSize: 12.5, color: P.ink2 }}>Create the variation without stock — receive a batch later</span>
          </label>
          {!b.skip && <div style={{ border: `1px solid ${P.hairline}`, borderRadius: P.r12, overflow: 'hidden' }}>
            <div style={{ padding: '9px 13px', background: P.surface2, borderBottom: `1px solid ${P.hairline}`, fontSize: 11.5, fontWeight: 700, color: P.ink }}>Receive first batch</div>
            <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Lb>Quantity received</Lb><Field mono placeholder="0" value={b.qty} onChange={(e) => b1('qty', e.target.value.replace(/[^0-9]/g, ''))} /></div>
              <div><Lb hint="What we paid per unit for this batch. Different batches of the same product routinely cost different amounts.">Wholesale cost / unit</Lb><Field mono placeholder="0.00" value={b.cost} onChange={(e) => b1('cost', e.target.value.replace(/[^0-9.]/g, ''))} /></div>
              <div><Lb hint="Generated per batch and printed on the label — barcode and RFID encode the same value.">Batch barcode / RFID</Lb><Field mono placeholder="Auto-generate on receive" value={b.code} onChange={(e) => b1('code', e.target.value)} /></div>
              <div><Lb>METRC tag</Lb><Field mono placeholder="1A4FF01…" value={b.metrc} onChange={(e) => b1('metrc', e.target.value)} /></div>
              <div style={{ gridColumn: '1/-1' }}><Lb>Expiry</Lb><Field mono placeholder="MM/DD/YYYY" value={b.exp} onChange={(e) => b1('exp', e.target.value)} /></div>
            </div>
            <div style={{ padding: '11px 14px', borderTop: `1px solid ${P.hairline}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
                <Icon name="lightning" size={13} color={P.ink2} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: P.ink }}>Potency</span>
                <span style={{ fontSize: 11.5, color: P.inkMute }}>· typed from the batch label on the packaging</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div><Lb>THC %</Lb><Field mono placeholder="0.0" value={b.thc} onChange={(e) => b1('thc', e.target.value.replace(/[^0-9.]/g, ''))} /></div>
                <div><Lb>CBD %</Lb><Field mono placeholder="0.0" value={b.cbd} onChange={(e) => b1('cbd', e.target.value.replace(/[^0-9.]/g, ''))} /></div>
                <div><Lb hint="Total cannabinoids as printed on the label, where the packaging states it.">Total cannabinoids %</Lb><Field mono placeholder="0.0" value={b.total} onChange={(e) => b1('total', e.target.value.replace(/[^0-9.]/g, ''))} /></div>
              </div>
            </div>
            {margin != null && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
              <span style={{ fontSize: 11.5, color: P.inkDim }}>Margin on this batch</span>
              <span style={{ marginLeft: 'auto', fontSize: 13.5, fontWeight: 800, fontFamily: P.fontMono, color: margin > 40 ? P.good : P.warn }}>{margin}%</span>
            </div>}
          </div>}
          <div style={{ display: 'flex', gap: 9, padding: '11px 13px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
            <Icon name="lightning" size={14} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Potency is <b>entered by hand from the batch label</b> on the packaging — we do not parse it out of a COA. Whoever receives the batch reads the printed figures and types them in, and the product’s low / high / avg recalculate across every in-stock batch.</div>
          </div>
        </>}

        {cur.k === 'done' && <div style={{ textAlign: 'center', padding: '14px 0' }}>
          <span style={{ width: 46, height: 46, borderRadius: 99, background: P.good, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={24} stroke={2.6} color="#fff" /></span>
          <div style={{ fontSize: 16.5, fontWeight: 800, color: P.ink, marginTop: 11 }}>{v.name || 'Variation'} added</div>
          <div style={{ fontSize: 12.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 3 }}>{sku || '—'} · {shell ? shell.name : ''}{effPrice ? ' · ' + money(effPrice) + (v.override ? ' (override)' : '') : ''}</div>
          <div style={{ marginTop: 16, textAlign: 'left', border: `1px solid ${P.hairline}`, borderRadius: P.r10, overflow: 'hidden' }}>
            {[['Variation created on ' + (shell ? shell.id : 'the shell'), 'good', v.override ? 'Brand, format, size and traits inherited. Retail price overridden for this variation only.' : 'Brand, format, size, price and traits all inherited — nothing re-entered.'],
            v.sample ? ['Marked as a display sample', 'warn', 'Kept off the sellable menu, still tracked as a full product profile.'] :
            b.skip ? ['No stock yet', 'neutral', 'It will not appear on any menu until a batch is received against it.'] :
            ['Batch received · ' + (b.qty || 0) + ' units', 'good', 'Quantity, wholesale cost and barcode recorded on the batch, not the product.'],
            ['Inherits the shell’s Weedmaps node', 'good', shell ? shell.wmNode + ' — already mapped, so it can sync without joining the review queue.' : 'Already mapped.'],
            ['Its own storefront listing', 'good', 'hyperwolf.com/shop/' + meta.slug + ' — title, description and keywords are written per product, not shared with the family.'],
            b.skip || !b.thc ? ['Potency not recorded yet', 'warn', 'Enter THC and cannabinoids from the batch label when the stock is received.'] : ['Potency recorded · ' + b.thc + '% THC', 'good', 'Typed from the batch label. Low / high / avg recalculate across in-stock batches.']].map(([t, tone, d], i) => {
              const c = tone === 'good' ? P.good : tone === 'warn' ? P.warn : P.inkMute;
              return <div key={t} style={{ display: 'flex', gap: 10, padding: '10px 12px', borderTop: i ? `1px solid ${P.hairline}` : 'none' }}>
                <Icon name={tone === 'good' ? 'check-circle' : tone === 'warn' ? 'clock' : 'package'} size={14} color={c} style={{ flex: '0 0 auto', marginTop: 1 }} />
                <div><div style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{t}</div><div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.45, marginTop: 1 }}>{d}</div></div>
              </div>;})}
          </div>
        </div>}
      </div>

      <div style={{ display: 'flex', gap: 9, padding: '14px 20px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
        {step > (lockShell ? 1 : 0) && cur.k !== 'done' && <PBtn variant="secondary" size="md" icon="chevron-left" onClick={() => setStep((s) => s - 1)}>Back</PBtn>}
        <div style={{ flex: 1 }} />
        {cur.k === 'done' ?
        <PBtn variant="accent" size="md" icon="check" onClick={() => {onDone && onDone(v);onClose();}}>Open the shell</PBtn> :
        <><PBtn variant="secondary" size="md" onClick={onClose}>Cancel</PBtn>
          {missing && <span style={{ fontSize: 11.5, color: P.warn, fontWeight: 600, marginRight: 4, textAlign: 'right', maxWidth: 300 }}>{missing}</span>}
          <PBtn variant="accent" size="md" iconRight="chevron-right" disabled={!canNext} onClick={() => {if (!canNext) return;if (FLOW_STEPS[step + 1] && FLOW_STEPS[step + 1].k === 'done') commit();setStep((s) => s + 1);}} style={{ opacity: canNext ? 1 : .5 }}>{FLOW_STEPS[step + 1] && FLOW_STEPS[step + 1].k === 'done' ? 'Create variation' : 'Continue'}</PBtn></>}
      </div>
    </div>
  </div>;
};

Object.assign(window, {});
