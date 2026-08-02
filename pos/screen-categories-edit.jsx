// ── Category & Sub-Category editors — images, rich text, FAQs, meta, and the
//    inline Weedmaps taxonomy mapping (Option A: map right where you edit).
const useP = window.useP;
const { CatGlyph, WmPill, WmMultiPicker, catCount, catColor } = window;

const slug = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// AI copywriting via the in-prototype Claude bridge, with a graceful fallback
// so the button always produces something even offline.
async function aiGen(prompt, fallback) {
  try { if (window.claude && window.claude.complete) { const r = await window.claude.complete(prompt); const t = (r || '').trim().replace(/^["']+|["']+$/g, ''); if (t) return t; } } catch (e) {}
  return fallback || null;
}
function AiBtn({ onGen, label = 'Generate with AI' }) {
  const P = useP();const [busy, setBusy] = React.useState(false);
  return <button onClick={async () => { setBusy(true); try { await onGen(); } finally { setBusy(false); } }} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 99, border: `1px solid ${P.accentBorder}`, background: P.accentSoft, color: P.mode === 'dark' ? P.accent : '#7A5A00', cursor: busy ? 'default' : 'pointer', fontFamily: P.fontSans, fontSize: 12, fontWeight: 700, opacity: busy ? .7 : 1 }}><Icon name="lightning" size={13} stroke={2} />{busy ? 'Writing…' : label}</button>;
}

// shared field atoms
function Fld({ label, value, onChange, mono, placeholder, hint }) {
  const P = useP();
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
    <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>{label}</span>
    <input value={value} placeholder={placeholder} onChange={onChange} style={{ padding: '10px 12px', border: `1px solid ${P.fieldBorder || P.hairline2}`, borderRadius: P.r10, background: P.field || P.surface, fontSize: 13, fontWeight: 600, color: P.ink, fontFamily: mono ? P.fontMono : P.fontSans, outline: 'none', boxSizing: 'border-box' }} />
    {hint && <span style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>{hint}</span>}
  </label>;
}

// lightweight rich-text field (represented toolbar + editable area — not a full WYSIWYG)
// Pass aiPrompt to show a “Generate with AI” button that fills the field.
function RichText({ label, value, rows = 5, aiPrompt, aiFallback }) {
  const P = useP();
  const [text, setText] = React.useState(value || '');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { setText(value || ''); }, [value]);
  const gen = async () => { setBusy(true); const out = await aiGen(aiPrompt, aiFallback); setBusy(false); if (out) setText(out); };
  const btn = (ic, txt) => <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, height: 28, padding: '0 5px', background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', color: P.ink2, fontSize: 14, fontWeight: 700, fontFamily: txt ? P.fontSans : 'serif' }} onMouseEnter={(e) => e.currentTarget.style.background = P.surface3} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>{ic ? <Icon name={ic} size={15} stroke={1.9} /> : txt}</button>;
  const sep = <span style={{ width: 1, height: 16, background: P.hairline2, margin: '0 3px' }} />;
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1/-1' }}>
    <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>{label}</span>
    <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r10, overflow: 'hidden', background: P.field || P.surface }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', padding: '5px 8px', borderBottom: `1px solid ${P.hairline}`, background: P.surface2 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: P.ink2, padding: '0 8px', height: 28, borderRadius: 6 }}>Normal<Icon name="chevron-down" size={11} stroke={2.2} color={P.inkMute} /></span>
        {sep}{btn(null, 'B')}{btn(null, 'I')}{btn(null, 'U')}{btn(null, 'S')}{sep}{btn('note', null)}{btn('list', null)}{sep}{btn('link', null)}
        <span style={{ flex: 1 }} />
        {aiPrompt && <button onClick={gen} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 99, border: `1px solid ${P.accentBorder}`, background: P.accentSoft, color: P.mode === 'dark' ? P.accent : '#7A5A00', cursor: busy ? 'default' : 'pointer', fontFamily: P.fontSans, fontSize: 11.5, fontWeight: 700, opacity: busy ? .7 : 1 }}><Icon name="lightning" size={12} stroke={2} />{busy ? 'Writing…' : 'Generate with AI'}</button>}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={rows} style={{ width: '100%', padding: '12px 13px', border: 'none', background: 'transparent', fontSize: 13.5, color: P.ink, fontFamily: P.fontSans, outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box', display: 'block' }} />
    </div>
  </label>;
}

function ImgSlot({ id, label, aspect = '1 / 1', note, grow }) {
  const P = useP();
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: grow ? '1 1 300px' : '0 0 auto', minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>{label}</span>
      {note && <span style={{ fontSize: 10.5, fontWeight: 500, color: P.inkMute, fontFamily: P.fontMono }}>{note}</span>}
    </div>
    <div style={{ position: 'relative', width: grow ? '100%' : 208, maxWidth: '100%', aspectRatio: aspect, borderRadius: P.r12, overflow: 'hidden', border: `1px solid ${P.hairline2}`, background: P.surface2 }}>
      <image-slot id={id} shape="rounded" placeholder={`Drop ${label.replace('*', '').toLowerCase()}`} style={{ width: '100%', height: '100%', display: 'block' }}></image-slot>
    </div>
  </div>;
}

function Sec({ title, sub, children, cols = 3, right }) {
  const P = useP();
  return <Card padding={0}><div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderBottom: `1px solid ${P.hairline}` }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 15, fontWeight: 700, color: P.ink }}>{title}</div>{sub && <div style={{ fontSize: 11.5, color: P.inkDim, marginTop: 1 }}>{sub}</div>}</div>{right}</div><div style={{ padding: 18, display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: '14px 16px' }}>{children}</div></Card>;
}

function FaqList({ seed }) {
  const P = useP();
  const [faqs, setFaqs] = React.useState(seed || []);
  return <Card padding={0}>
    <div style={{ padding: '13px 18px', borderBottom: `1px solid ${P.hairline}` }}><div style={{ fontSize: 14, fontWeight: 700, color: P.ink }}>FAQ's</div><div style={{ fontSize: 11, color: P.inkDim, marginTop: 1 }}>Shown on the category page &amp; used for SEO rich results</div></div>
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {faqs.map((f, i) => <div key={i} style={{ background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r12, padding: 14, position: 'relative' }}>
        <button onClick={() => setFaqs(faqs.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', cursor: 'pointer', color: P.bad, display: 'flex', padding: 4 }}><Icon name="trash" size={15} stroke={1.9} /></button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><RichText label="Question" value={f.q} rows={2} /><RichText label="Answer" value={f.a} rows={3} /></div>
      </div>)}
      <button onClick={() => setFaqs([...faqs, { q: '', a: '' }])} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', background: 'transparent', border: `1.5px solid ${P.hairline3}`, borderRadius: 99, cursor: 'pointer', color: P.info, fontSize: 12.5, fontWeight: 700, fontFamily: P.fontSans }}><Icon name="plus" size={15} stroke={2.2} />Add More</button>
    </div>
  </Card>;
}

// inline Weedmaps mapping control for a single sub-category (Option A)
function InlineWmMap({ sub, onChange, onSkip }) {
  const P = useP();const [open, setOpen] = React.useState(false);
  return <div style={{ position: 'relative' }}>
    <button onClick={() => setOpen((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: P.r10, border: `1px solid ${sub.wm.length ? P.hairline2 : sub.skip ? P.hairline2 : P.warn}`, background: sub.wm.length || sub.skip ? P.surface : P.warnSoft, cursor: 'pointer', fontFamily: P.fontSans }}>
      {sub.wm.length ? <WmPill sub={sub} /> : sub.skip ? <span style={{ fontSize: 12, fontWeight: 700, color: P.inkMute }}>Not synced</span> : <span style={{ fontSize: 12, fontWeight: 700, color: P.warn }}>Map to Weedmaps</span>}
      <Icon name="chevron-down" size={13} stroke={2.2} color={P.inkMute} />
    </button>
    {open && <WmMultiPicker value={sub.wm} skip={sub.skip} anchor="left" onChange={(wm) => onChange(wm)} onSkip={(sk) => onSkip(sk)} onClose={() => setOpen(false)} />}
  </div>;
}

// ── Update Web Category ─────────────────────────────────────────────────────
window.CategoryEdit = function CategoryEdit({ cat, onBack, onSave, onSetSub }) {
  const P = useP();
  const [d, setD] = React.useState(() => ({ name: cat.name, status: cat.status, menu: cat.name, h1: `Buy Curated Cannabis ${cat.name} Online`, slug: slug(cat.name), metaT: `Buy ${cat.name} Online | Same-Day Delivery`, metaD: `Shop ${cat.name.toLowerCase()} online with Hyperwolf. Curated, lab-tested selection with same-day weed delivery across California.` }));
  const up = (patch) => setD((x) => ({ ...x, ...patch }));
  const unmapped = cat.subs.filter((s) => !s.wm.length && !s.skip).length;
  const genMeta = async () => {
    const t = await aiGen(`Write an SEO meta title, max 60 characters, for the cannabis category "${d.name}" for Hyperwolf — same-day California weed delivery. Return only the title.`, `Buy ${d.name} Online | Hyperwolf Same-Day Delivery`);
    const ds = await aiGen(`Write an SEO meta description, max 160 characters, for the cannabis category "${d.name}" for Hyperwolf — curated, lab-tested, same-day California weed delivery. Return only the description.`, `Shop ${d.name.toLowerCase()} online with Hyperwolf — a curated, lab-tested selection delivered same-day across California. Order in minutes.`);
    up({ ...(t ? { metaT: t } : {}), ...(ds ? { metaD: ds } : {}) });
  };

  return <div style={{ maxWidth: 1080, margin: '0 auto' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
      <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: P.ink, fontSize: 19, fontWeight: 800, letterSpacing: '-.02em', fontFamily: P.fontSans, padding: 0 }}><Icon name="chevron-left" size={20} stroke={2.2} />Update Web Category</button>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>Status</span>
      <Seg value={d.status} onChange={(v) => up({ status: v })} size="md" options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} />
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card padding={18}><div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <ImgSlot id={`cat-${cat.id}-web`} label="Web Category Image" />
        <ImgSlot id={`cat-${cat.id}-banner`} label="Banner Image" note="1392×260" aspect="1392 / 260" grow />
      </div></Card>

      <Sec title="Category Info">
        <Fld label="Category Name*" value={d.name} onChange={(e) => up({ name: e.target.value })} />
        <Fld label="Category Menu Name" value={d.menu} onChange={(e) => up({ menu: e.target.value })} />
        <Fld label="Category Heading (H1)" value={d.h1} onChange={(e) => up({ h1: e.target.value })} />
        <Fld label="Web Category Slug" value={d.slug} onChange={(e) => up({ slug: e.target.value })} mono />
        <RichText label="Description*" value={`About ${d.name}: curated, lab-tested ${d.name.toLowerCase()} delivered same-day across our California zones. Hyperwolf runs a tighter menu so what you order was selected recently — not sitting in a warehouse aging out.`} aiPrompt={`Write a 2-3 sentence storefront description for the cannabis category "${d.name}" for Hyperwolf, a California same-day weed delivery brand. Confident, plain, no hype. Return only the text.`} aiFallback={`About ${d.name}: a curated, lab-tested selection delivered same-day across our California zones. We keep the menu tight, so what you order was chosen recently — not aged in a warehouse.`} />
        <RichText label="Bottom Text" value={`${d.name}, Curated for Real Customers (Fast, Free Delivery)\n\nHyperwolf doesn't stock every product on the market, and that's the point. Our menu is built around a curated selection that turns over quickly.`} rows={4} aiPrompt={`Write a short SEO bottom paragraph (2-3 sentences) for the "${d.name}" cannabis category page for Hyperwolf same-day California delivery. Return only the text.`} aiFallback={`${d.name}, curated for people who actually care. Fast, free delivery across LA, Orange County and the Inland Empire — every product lab-tested, every batch hand-picked.`} />
      </Sec>

      {/* Inline Weedmaps mapping per sub-category (Option A) */}
      <Card padding={0}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 18px', borderBottom: `1px solid ${P.hairline}` }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '2px 8px', borderRadius: 99 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: '#fff' }} />Weedmaps</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: P.ink }}>Taxonomy mapping</span>
          {unmapped > 0 ? <span style={{ fontSize: 11.5, fontWeight: 700, color: P.warn }}>· {unmapped} unmapped</span> : <span style={{ fontSize: 11.5, fontWeight: 700, color: P.good }}>· all set</span>}
        </div>
        <div style={{ padding: '6px 18px 12px' }}>
          <div style={{ fontSize: 11.5, color: P.inkDim, padding: '8px 0 4px', lineHeight: 1.5 }}>Each sub-category maps to one or more Weedmaps taxonomy nodes. Products inherit their sub-category’s mapping.</div>
          {cat.subs.map((s, i) => <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${P.hairline}` }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: P.ink }}>{s.name}</span>
            <InlineWmMap sub={s} onChange={(wm) => onSetSub(cat.id, s.name, { wm, skip: wm.length ? false : s.skip })} onSkip={(skip) => onSetSub(cat.id, s.name, { skip, wm: skip ? [] : s.wm })} />
          </div>)}
        </div>
      </Card>

      <FaqList seed={[
        { q: `What's the difference between the ${d.name.toLowerCase()} sub-categories?`, a: 'Each sub-category groups products by type, dose, or price tier so you can shop the way you actually think about it.' },
        { q: `How fast is ${d.name.toLowerCase()} delivery?`, a: 'Most orders arrive within 60–90 minutes across our core California zones — LA, Orange County, and the Inland Empire.' }]} />

      <Sec title="Meta Properties" cols={1} right={<AiBtn label="Generate with AI" onGen={genMeta} />}>
        <div><Fld label="Meta Title*" value={d.metaT} onChange={(e) => up({ metaT: e.target.value })} />
          <div style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 5 }}>Character Count: {d.metaT.length} <span style={{ color: P.info }}>(Recommended Characters: 60)</span></div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>Meta Description*</span>
          <textarea value={d.metaD} onChange={(e) => up({ metaD: e.target.value })} rows={2} style={{ padding: '10px 12px', border: `1px solid ${P.hairline2}`, borderRadius: P.r10, background: P.field || P.surface, fontSize: 12.5, color: P.ink, fontFamily: P.fontSans, outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }} />
          <span style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>Character Count: {d.metaD.length} <span style={{ color: P.info }}>(Recommended Characters: 160)</span></span>
        </div>
      </Sec>

      <div style={{ display: 'flex', gap: 10, paddingBottom: 20 }}>
        <PBtn variant="accent" size="lg" icon="check" onClick={() => onSave({ ...cat, name: d.name, status: d.status })}>Update</PBtn>
        <PBtn variant="danger" size="lg" icon="trash">Delete</PBtn>
        <PBtn variant="secondary" size="lg" onClick={onBack}>Cancel</PBtn>
      </div>
    </div>
  </div>;
};

// ── Update Sub Category ─────────────────────────────────────────────────────
window.SubCategoryEdit = function SubCategoryEdit({ cat, sub, onBack, onSetSub }) {
  const P = useP();
  const [d, setD] = React.useState(() => ({ name: sub.name, status: 'Active', menu: sub.name, h1: `Buy ${sub.name} Online`, slug: slug(sub.name), metaT: `Shop ${sub.name} Online | Same-Day Delivery`, metaD: `Shop ${sub.name.toLowerCase()} online with Hyperwolf. Curated selection with same-day weed delivery across California.`, by: 'Manisha Saini' }));
  const up = (patch) => setD((x) => ({ ...x, ...patch }));
  const genMeta = async () => {
    const t = await aiGen(`Write an SEO meta title, max 60 characters, for the cannabis sub-category "${d.name}" for Hyperwolf — same-day California weed delivery. Return only the title.`, `Shop ${d.name} Online | Hyperwolf Same-Day Delivery`);
    const ds = await aiGen(`Write an SEO meta description, max 160 characters, for the cannabis sub-category "${d.name}" for Hyperwolf — curated, lab-tested, same-day California weed delivery. Return only the description.`, `Shop ${d.name.toLowerCase()} online with Hyperwolf — a curated, lab-tested selection delivered same-day across California.`);
    up({ ...(t ? { metaT: t } : {}), ...(ds ? { metaD: ds } : {}) });
  };

  return <div style={{ maxWidth: 1080, margin: '0 auto' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
      <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: P.ink, fontSize: 19, fontWeight: 800, letterSpacing: '-.02em', fontFamily: P.fontSans, padding: 0 }}><Icon name="chevron-left" size={20} stroke={2.2} />Update Sub Category</button>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: P.inkMute }}>Status</span>
      <Seg value={d.status} onChange={(v) => up({ status: v })} size="md" options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} />
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card padding={18}><div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <ImgSlot id={`sub-${cat.id}-${slug(sub.name)}-img`} label="Category Image*" />
        <ImgSlot id={`sub-${cat.id}-${slug(sub.name)}-banner`} label="Banner Image" note="1392×260" aspect="1392 / 260" grow />
      </div></Card>

      {/* Inline Weedmaps mapping for THIS sub-category (Option A) */}
      <Card padding={0}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 18px', borderBottom: `1px solid ${P.hairline}` }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: '#fff', background: '#1F5FC0', padding: '2px 8px', borderRadius: 99 }}><span style={{ width: 6, height: 6, borderRadius: 2, background: '#fff' }} />Weedmaps</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: P.ink }}>Taxonomy mapping</span>
        </div>
        <div style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: catColor(cat.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Icon name="grid" size={17} stroke={1.9} /></span>
            <div><div style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>{sub.name}</div><div style={{ fontSize: 11, color: P.inkMute }}>in {cat.name}</div></div>
          </div>
          <Icon name="arrow-right" size={18} color={P.inkFaint} />
          <InlineWmMap sub={sub} onChange={(wm) => onSetSub(cat.id, sub.name, { wm, skip: wm.length ? false : sub.skip })} onSkip={(skip) => onSetSub(cat.id, sub.name, { skip, wm: skip ? [] : sub.wm })} />
          <div style={{ flex: 1, minWidth: 200, fontSize: 11.5, color: P.inkDim, lineHeight: 1.5 }}>
            {sub.wm.length ? <>Products in <b style={{ color: P.ink2 }}>{sub.name}</b> publish to {sub.wm.length} Weedmaps node{sub.wm.length > 1 ? 's' : ''}. Many-to-one is supported.</> : sub.skip ? 'Intentionally not synced to Weedmaps.' : <span style={{ color: P.warn, fontWeight: 600 }}>Unmapped — products here are hidden on Weedmaps until you pick a node.</span>}
          </div>
        </div>
      </Card>

      <Sec title="Category Info">
        <Fld label="Category Name*" value={d.name} onChange={(e) => up({ name: e.target.value })} />
        <Fld label="Category Menu Name" value={d.menu} onChange={(e) => up({ menu: e.target.value })} />
        <Fld label="Category Heading (H1)" value={d.h1} onChange={(e) => up({ h1: e.target.value })} />
        <Fld label="Category Slug" value={d.slug} onChange={(e) => up({ slug: e.target.value })} mono />
        <RichText label="Description*" value={`Welcome to ${d.name}. Curated, lab-tested products delivered same-day across our California zones.`} aiPrompt={`Write a 2-3 sentence storefront description for the cannabis sub-category "${d.name}" for Hyperwolf, a California same-day weed delivery brand. Confident, plain, no hype. Return only the text.`} aiFallback={`Welcome to ${d.name} — a curated, lab-tested selection delivered same-day across our California zones. Hand-picked, fast-moving, and chosen for people who actually care what they smoke.`} />
        <RichText label="Instructions*" value={`How to choose within ${d.name}: start with what you already like, then match tier and format. If you're unsure, our budtenders can help in chat.`} rows={3} aiPrompt={`Write 2-3 sentences of “how to choose” guidance for shoppers browsing the cannabis sub-category "${d.name}" on Hyperwolf. Helpful, plain. Return only the text.`} aiFallback={`Choosing within ${d.name}: start with what you already enjoy, then match potency and format to the occasion. Not sure? Our budtenders can point you the right way in chat.`} />
        <RichText label="Bottom Text" value="" rows={4} aiPrompt={`Write a short SEO bottom paragraph (2-3 sentences) for the "${d.name}" cannabis sub-category page for Hyperwolf same-day California delivery. Return only the text.`} aiFallback={`${d.name} at Hyperwolf — curated, lab-tested, and delivered same-day across LA, Orange County and the Inland Empire. Free delivery, no membership games.`} />
      </Sec>

      <FaqList seed={[{ q: `What is ${d.name}?`, a: `${d.name} groups products so you can shop faster. Everything here is lab-tested and delivered same-day.` }]} />

      <Sec title="Sub Category Info" cols={1}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>Sub Categories</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 11, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, minHeight: 48 }}>
            {cat.subs.map((s) => <span key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: s.name === sub.name ? P.ink : P.ink2, background: s.name === sub.name ? P.accentSoft : P.surface2, border: `1px solid ${s.name === sub.name ? P.accentBorder : P.hairline2}`, borderRadius: 99, padding: '5px 10px' }}>{s.name}<Icon name="x" size={12} stroke={2.4} color={P.inkMute} /></span>)}
            <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, color: P.inkMute, padding: '5px 6px' }}>Categories…</span>
          </div>
        </div>
      </Sec>

      <Sec title="Meta Properties" cols={2} right={<AiBtn label="Generate with AI" onGen={genMeta} />}>
        <div><Fld label="Meta Title*" value={d.metaT} onChange={(e) => up({ metaT: e.target.value })} />
          <div style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono, marginTop: 5 }}>Character Count: {d.metaT.length} <span style={{ color: P.info }}>(Recommended Characters: 60)</span></div></div>
        <Fld label="Created By" value={d.by} onChange={(e) => up({ by: e.target.value })} />
        <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>Meta Description*</span>
          <textarea value={d.metaD} onChange={(e) => up({ metaD: e.target.value })} rows={2} style={{ padding: '10px 12px', border: `1px solid ${P.hairline2}`, borderRadius: P.r10, background: P.field || P.surface, fontSize: 12.5, color: P.ink, fontFamily: P.fontSans, outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }} />
          <span style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>Character Count: {d.metaD.length} <span style={{ color: P.info }}>(Recommended Characters: 160)</span></span>
        </div>
      </Sec>

      <div style={{ display: 'flex', gap: 10, paddingBottom: 20 }}>
        <PBtn variant="accent" size="lg" icon="check" onClick={onBack}>Update</PBtn>
        <PBtn variant="danger" size="lg" icon="trash">Delete</PBtn>
        <PBtn variant="secondary" size="lg" onClick={onBack}>Cancel</PBtn>
      </div>
    </div>
  </div>;
};
