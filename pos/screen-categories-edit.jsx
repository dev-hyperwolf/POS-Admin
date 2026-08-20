// ── Category & Sub-Category editors — images, rich text, FAQs, meta, and the
//    SAME live Weedmaps mapping the board uses, inline where you edit.
//
// The mapping controls here are not a second implementation. They render the
// same rows, the same node picker and the same verdicts as
// pos/screen-categories.jsx, and they write through the same
// window.HW_TAXONOMY calls — so an editor and the board cannot disagree about
// what is mapped. When no API answered, everything mapping-shaped on this page
// says MOCK, because a label with no Weedmaps id cannot be published.
const useP = window.useP;
const { CatGlyph, NodeLine, NodePicker, WmPill, catColor, posCount, suggestFor, allowedRoots,
  verdictOf, writeState, UNMAPPED_TRUTH, plural, nameResolution, wmNameSet } = window;

const slug = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// AI copywriting via the in-prototype Claude bridge, with a graceful fallback
// so the button always produces something even offline.
async function aiGen(prompt, fallback) {
  try { if (window.claude && window.claude.complete) { const r = await window.claude.complete(prompt); const t = (r || '').trim().replace(/^["']+|["']+$/g, ''); if (t) return t; } } catch (e) {}
  return fallback || null;
}
function AiBtn({ onGen, label = 'Generate with AI' }) {
  const P = useP();const [busy, setBusy] = React.useState(false);
  return <button data-hw-i onClick={async () => { setBusy(true); try { await onGen(); } finally { setBusy(false); } }} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: P.ctrlH.xs, padding: '6px 12px', borderRadius: P.r999, border: `1px solid ${P.accentBorder}`, background: P.accentSoft, color: P.accentText, cursor: busy ? 'default' : 'pointer', fontFamily: P.fontSans, fontSize: P.type.body, fontWeight: 700, opacity: busy ? .7 : 1 }}><Icon name="lightning" size={13} stroke={2} />{busy ? 'Writing…' : label}</button>;
}

// shared field atoms
function Fld({ label, value, onChange, mono, placeholder, hint }) {
  const P = useP();
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
    <span style={{ fontSize: P.type.micro, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>{label}</span>
    <input value={value} placeholder={placeholder} onChange={onChange} style={{ minHeight: P.ctrlH.md, padding: '10px 12px', border: `1px solid ${P.fieldBorder || P.hairline2}`, borderRadius: P.r8, background: P.field || P.surface, fontSize: P.type.strong, fontWeight: 600, color: P.ink, fontFamily: mono ? P.fontMono : P.fontSans, outline: 'none', boxSizing: 'border-box' }} />
    {hint && <span style={{ fontSize: P.type.meta, color: P.inkMute, fontFamily: P.fontMono }}>{hint}</span>}
  </label>;
}

// lightweight rich-text field (represented toolbar + editable area — not a full WYSIWYG)
function RichText({ label, value, rows = 5, aiPrompt, aiFallback }) {
  const P = useP();
  const [text, setText] = React.useState(value || '');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { setText(value || ''); }, [value]);
  const gen = async () => { setBusy(true); const out = await aiGen(aiPrompt, aiFallback); setBusy(false); if (out) setText(out); };
  const btn = (ic, txt) => <button data-hw-i style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 28, height: 28, padding: '0 5px', background: 'transparent', border: 'none', borderRadius: P.r6, cursor: 'pointer', color: P.ink2, fontSize: P.type.strong, fontWeight: 700, fontFamily: txt ? P.fontSans : 'serif' }} onMouseEnter={(e) => e.currentTarget.style.background = P.surface3} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>{ic ? <Icon name={ic} size={15} stroke={1.9} /> : txt}</button>;
  const sep = <span style={{ width: 1, height: 16, background: P.hairline2, margin: '0 3px' }} />;
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1/-1' }}>
    <span style={{ fontSize: P.type.meta, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>{label}</span>
    <div style={{ border: `1px solid ${P.hairline2}`, borderRadius: P.r10, overflow: 'hidden', background: P.field || P.surface }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', padding: '5px 8px', borderBottom: `1px solid ${P.hairline}`, background: P.surface2 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: P.type.body, fontWeight: 600, color: P.ink2, padding: '0 8px', height: 28, borderRadius: P.r6 }}>Normal<Icon name="chevron-down" size={11} stroke={2.2} color={P.inkMute} /></span>
        {sep}{btn(null, 'B')}{btn(null, 'I')}{btn(null, 'U')}{btn(null, 'S')}{sep}{btn('note', null)}{btn('list', null)}{sep}{btn('link', null)}
        <span style={{ flex: 1 }} />
        {aiPrompt && <button data-hw-i onClick={gen} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: P.ctrlH.xs, padding: '5px 11px', borderRadius: P.r999, border: `1px solid ${P.accentBorder}`, background: P.accentSoft, color: P.accentText, cursor: busy ? 'default' : 'pointer', fontFamily: P.fontSans, fontSize: P.type.meta, fontWeight: 700, opacity: busy ? .7 : 1 }}><Icon name="lightning" size={12} stroke={2} />{busy ? 'Writing…' : 'Generate with AI'}</button>}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={rows} style={{ width: '100%', padding: '12px 13px', border: 'none', background: 'transparent', fontSize: P.type.strong, color: P.ink, fontFamily: P.fontSans, outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box', display: 'block' }} />
    </div>
  </label>;
}

function ImgSlot({ id, label, aspect = '1 / 1', note, grow }) {
  const P = useP();
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: grow ? '1 1 300px' : '0 0 auto', minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: P.type.body, fontWeight: 700, color: P.ink }}>{label}</span>
      {note && <span style={{ fontSize: P.type.meta, fontWeight: 500, color: P.inkMute, fontFamily: P.fontMono }}>{note}</span>}
    </div>
    <div style={{ position: 'relative', width: grow ? '100%' : 208, maxWidth: '100%', aspectRatio: aspect, borderRadius: P.r12, overflow: 'hidden', border: `1px solid ${P.hairline2}`, background: P.surface2 }}>
      <image-slot id={id} shape="rounded" placeholder={`Drop ${label.replace('*', '').toLowerCase()}`} style={{ width: '100%', height: '100%', display: 'block' }}></image-slot>
    </div>
  </div>;
}

function Sec({ title, sub, children, cols = 3, right }) {
  const P = useP();
  return <Card padding={0}><div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderBottom: `1px solid ${P.hairline}` }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink }}>{title}</div>{sub && <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 1 }}>{sub}</div>}</div>{right}</div><div style={{ padding: 18, display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: '14px 16px' }}>{children}</div></Card>;
}

function FaqList({ seed }) {
  const P = useP();
  const [faqs, setFaqs] = React.useState(seed || []);
  return <Card padding={0}>
    <div style={{ padding: '13px 18px', borderBottom: `1px solid ${P.hairline}` }}><div style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>FAQ's</div><div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 1 }}>Shown on the category page &amp; used for SEO rich results</div></div>
    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {faqs.map((f, i) => <div key={i} style={{ background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r12, padding: 14, position: 'relative' }}>
        <button data-hw-i onClick={() => setFaqs(faqs.filter((_, j) => j !== i))} aria-label="Remove this FAQ" style={{ position: 'absolute', top: 12, right: 12, background: 'transparent', border: 'none', cursor: 'pointer', color: P.bad, display: 'flex', padding: 4 }}><Icon name="trash" size={15} stroke={1.9} /></button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}><RichText label="Question" value={f.q} rows={2} /><RichText label="Answer" value={f.a} rows={3} /></div>
      </div>)}
      <button data-hw-i onClick={() => setFaqs([...faqs, { q: '', a: '' }])} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: P.ctrlH.md, padding: '9px 15px', background: 'transparent', border: `1.5px solid ${P.hairline3}`, borderRadius: P.r999, cursor: 'pointer', color: P.info, fontSize: P.type.body, fontWeight: 700, fontFamily: P.fontSans }}><Icon name="plus" size={15} stroke={2.2} />Add More</button>
    </div>
  </Card>;
}

// ── the one inline mapping control ──────────────────────────────────────────
// Same picker, same verdicts, same writes as the board. Manual first: the
// picker is one press away and does not need a suggestion to exist.
function InlineMap({ sub, nodes, live, onMockSet }) {
  const P = useP();
  const [pick, setPick] = React.useState(null);      // null | {replacing}
  const [arm, setArm] = React.useState(null);        // {kind, from, to}
  const [msg, setMsg] = React.useState(null);        // {text, ok}
  const [busy, setBusy] = React.useState(false);
  const W = writeState();
  const sug = suggestFor(sub, nodes);

  const run = (fn, what) => {
    setArm(null);setPick(null);setBusy(true);setMsg(null);
    return fn().then((r) => {
      setBusy(false);
      if (r && r.ok) { setMsg({ text: what + ' — accepted by the API.', ok: true }); }
      else {
        var e1 = (r && r.error) || 'no reason given';
        setMsg({ text: (/^request failed/.test(e1) ? 'Could not reach the API — ' : 'The API refused it: ') + e1 + '. Nothing changed.', ok: false });
      }
    }).catch((e) => {setBusy(false);setMsg({ text: 'The request failed: ' + (e && e.message ? e.message : 'unknown') + '. Nothing changed.', ok: false });});
  };
  const mock = (patch) => {setArm(null);setPick(null);onMockSet(sub.parent, sub.name, patch);setMsg({ text: 'MOCK only — that changed this screen and nothing else. There is no Weedmaps id behind a label, and no API to save it to.', ok: false });};
  const doMap = (n) => live ? run(() => window.HW_TAXONOMY.map(sub.id, n.id), 'Mapped ' + sub.id + ' → ' + n.path + ' #' + n.id)
    : mock({ targets: sub.targets.concat([{ nodeId: null, path: n.path, mock: true, known: true, retired: false, retiredAncestor: null, categoryIds: [] }]), skip: false });
  const doReplace = (from, to) => live ? run(() => window.HW_TAXONOMY.map(sub.id, to.id).then((r) => r && r.ok ? window.HW_TAXONOMY.unmap(sub.id, from.nodeId) : r), 'Re-pointed to ' + to.path + ' #' + to.id + ' and removed #' + from.nodeId)
    : mock({ targets: sub.targets.map((x) => x === from ? { nodeId: null, path: to.path, mock: true, known: true, retired: false, retiredAncestor: null, categoryIds: [] } : x) });
  const doUnmap = (t) => live ? run(() => window.HW_TAXONOMY.unmap(sub.id, t.nodeId), 'Un-mapped ' + (t.path || '#' + t.nodeId))
    : mock({ targets: sub.targets.filter((x) => x !== t) });

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
    {!W.ok && <div style={{ fontSize: P.type.meta, color: P.warn, lineHeight: 1.5 }}>{W.why}</div>}

    {sub.state === 'skipped' ? <div style={{ fontSize: P.type.meta, color: P.inkMute, lineHeight: 1.5 }}>
      <Pill kind="neutral" size="sm">SKIPPED — DECIDED</Pill>
      {sub.skipReason ? <div style={{ marginTop: 5, paddingLeft: 8, borderLeft: `2px solid ${P.hairline3}`, color: P.ink2 }}>“{sub.skipReason}” — {sub.skippedBy || 'unknown'}</div> :
        <div style={{ marginTop: 5, color: P.warn }}>No reason was recorded, so this is indistinguishable from an accident.</div>}
      <div style={{ marginTop: 5 }}>{live ? 'It cannot be mapped while it is skipped — the API refuses that. Un-skip first, which puts' : 'Mapping it means un-skipping it first, which puts'} it back on the work list as UNMAPPED.</div>
    </div> : sub.targets.length ? sub.targets.map((t, i) =>
      <NodeLine key={i} sub={sub} target={t} busy={busy}
        onReplace={() => {setArm(null);setPick({ replacing: t });}}
        onRemove={() => {setPick(null);setArm({ kind: 'unmap', from: t });}} />) :
      <div style={{ padding: '9px 11px', borderRadius: P.r8, background: P.badSoft, border: `1px solid ${P.bad}` }}>
        <Pill kind="bad" size="sm">UNMAPPED</Pill>
        <div style={{ fontSize: P.type.meta, color: P.bad, lineHeight: 1.45, marginTop: 4 }}>{UNMAPPED_TRUTH}</div>
      </div>}

    <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
      {sub.state === 'skipped' ?
        <PBtn size="sm" variant="secondary" icon="refresh" busy={busy}
          onClick={() => live ? run(() => window.HW_TAXONOMY.unskip(sub.id), 'Un-skipped ' + sub.id) : mock({ skip: false })}
          title="Un-skipping returns this row to UNMAPPED — back onto the work list">Un-skip</PBtn> : <>
        <PBtn size="sm" variant={sub.targets.length ? 'secondary' : 'accent'} icon="link" iconRight="chevron-down" busy={busy}
          onClick={() => {setArm(null);setPick(pick && !pick.replacing ? null : { replacing: null });}}>{sub.targets.length ? 'Add another node' : 'Map to Weedmaps'}</PBtn>
        {pick && <NodePicker nodes={nodes} mock={!live} sub={sub} replacing={pick.replacing} suggested={sug} anchor="left"
          onPick={(n) => pick.replacing ? setArm({ kind: 'replace', from: pick.replacing, to: n }) : doMap(n)}
          onClose={() => setPick(null)} />}
      </>}
    </div>

    {arm && <div style={{ padding: '11px 13px', borderRadius: P.r8, border: `1px solid ${P.hairline3}`, background: P.surface2, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ fontSize: P.type.meta, color: P.ink, lineHeight: 1.55 }}>
        {live ? 'This changes the live Weedmaps listing. ' : 'MOCK — nothing is saved anywhere. '}
        {arm.kind === 'replace' ? <>Two writes: <b style={{ fontFamily: P.fontMono }}>map → {arm.to.path} {arm.to.id == null ? '' : '#' + arm.to.id}</b>, then <b style={{ fontFamily: P.fontMono }}>remove {arm.from.path} {arm.from.nodeId == null ? '' : '#' + arm.from.nodeId}</b>. If the first is refused the second is not attempted, so the current mapping is never dropped on the way.</> :
          <>One write: <b style={{ fontFamily: P.fontMono }}>remove {arm.from.path} {arm.from.nodeId == null ? '' : '#' + arm.from.nodeId}</b>. {sub.targets.length > 1 ? 'It keeps ' + plural(sub.targets.length - 1, 'other node') + '.' : 'That leaves ' + sub.name + ' UNMAPPED, and ' + (sub.skuCount == null ? 'its products' : plural(sub.skuCount, 'product')) + ' then publish with no category at all.'}</>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <PBtn size="sm" variant={arm.kind === 'replace' ? 'accent' : 'danger'} icon="check" disabled={live && !W.ok}
          onClick={() => arm.kind === 'replace' ? doReplace(arm.from, arm.to) : doUnmap(arm.from)}>{arm.kind === 'replace' ? 'Replace it' : 'Unmap it'}</PBtn>
        <PBtn size="sm" variant="ghost" onClick={() => setArm(null)}>Cancel</PBtn>
      </div>
    </div>}

    {!arm && sub.targets.filter((t) => verdictOf(sub, t).kind === 'wrong').map((t) => sug[0] ?
      <div key={'fix' + t.nodeId} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderRadius: P.r8, border: `1px solid ${P.hairline2}`, background: P.surface2 }}>
        <span style={{ flex: 1, minWidth: 200, fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5 }}>Suggested correction: <b style={{ color: P.ink, fontFamily: P.fontMono }}>{sug[0].node.path} #{sug[0].node.id}</b>. Nothing is applied until you press, and you get one more confirmation after that.</span>
        <PBtn size="sm" variant="secondary" icon="swap" onClick={() => setArm({ kind: 'replace', from: t, to: sug[0].node })}>Repoint…</PBtn>
      </div> :
      <div key={'fix' + t.nodeId} style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5 }}>
        No node under {(allowedRoots(sub.parent) || []).join(' / ') || 'our root'} resembles “{sub.name}” closely enough to suggest one, so this screen suggests nothing rather than guessing. Press <b>Change</b> above and pick one.
      </div>)}

    {msg && <div style={{ fontSize: P.type.meta, fontFamily: P.fontMono, lineHeight: 1.45, color: msg.ok ? P.good : P.bad }}>{msg.text}</div>}
  </div>;
}

// ── Update Web Category ─────────────────────────────────────────────────────
window.CategoryEdit = function CategoryEdit({ cat, live, nodes, names, onBack, onOpenSub }) {
  const P = useP();
  const [d, setD] = React.useState(() => ({ name: cat.name, menu: cat.name, h1: `Buy Curated Cannabis ${cat.name} Online`, slug: slug(cat.name), metaT: `Buy ${cat.name} Online | Same-Day Delivery`, metaD: `Shop ${cat.name.toLowerCase()} online with Hyperwolf. Curated, lab-tested selection with same-day weed delivery across California.` }));
  const up = (patch) => setD((x) => ({ ...x, ...patch }));
  const unmapped = cat.subs.filter((s) => !s.targets.length && s.state !== 'skipped').length;
  const wrong = cat.subs.filter((s) => s.targets.some((t) => verdictOf(s, t).kind === 'wrong')).length;
  const res = live && names ? nameResolution(names, cat.name) : null;
  const counted = cat.subs.every((s) => s.skuCount != null);
  const n = counted ? cat.subs.reduce((a, s) => a + s.skuCount, 0) : posCount(cat.name);
  const genMeta = async () => {
    const t = await aiGen(`Write an SEO meta title, max 60 characters, for the cannabis category "${d.name}" for Hyperwolf — same-day California weed delivery. Return only the title.`, `Buy ${d.name} Online | Hyperwolf Same-Day Delivery`);
    const ds = await aiGen(`Write an SEO meta description, max 160 characters, for the cannabis category "${d.name}" for Hyperwolf — curated, lab-tested, same-day California weed delivery. Return only the description.`, `Shop ${d.name.toLowerCase()} online with Hyperwolf — a curated, lab-tested selection delivered same-day across California. Order in minutes.`);
    up({ ...(t ? { metaT: t } : {}), ...(ds ? { metaD: ds } : {}) });
  };

  return <div style={{ maxWidth: 1080, margin: '0 auto' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
      <button data-hw-i onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: P.ink, fontSize: P.type.h2, fontWeight: 800, letterSpacing: '-.02em', fontFamily: P.fontSans, padding: 0 }}><Icon name="chevron-left" size={20} stroke={2.2} />Update Web Category</button>
      <div style={{ flex: 1 }} />
      <Pill kind={live ? 'good' : 'warn'} size="sm">{live ? 'LIVE BOARD' : 'MOCK — NO API'}</Pill>
      <span style={{ fontSize: P.type.meta, color: P.inkMute, fontFamily: P.fontMono }}>{counted ? plural(n, 'product') : n.n == null ? n.why : plural(n.n, 'product')}</span>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card padding={18}><div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <ImgSlot id={`cat-${slug(cat.name)}-web`} label="Web Category Image" />
        <ImgSlot id={`cat-${slug(cat.name)}-banner`} label="Banner Image" note="1392×260" aspect="1392 / 260" grow />
      </div></Card>

      <Sec title="Category Info">
        <Fld label="Category Name*" value={d.name} onChange={(e) => up({ name: e.target.value })}
          hint={res ? (res.ok ? 'resolves against Weedmaps’ tree' : res.near.length ? 'Weedmaps spells it “' + res.near.join('”/“') + '” — this exact string does NOT resolve' : 'no Weedmaps category has this name — products publish uncategorised') : 'name resolution not checked — no live taxonomy'} />
        <Fld label="Category Menu Name" value={d.menu} onChange={(e) => up({ menu: e.target.value })} />
        <Fld label="Category Heading (H1)" value={d.h1} onChange={(e) => up({ h1: e.target.value })} />
        <Fld label="Web Category Slug" value={d.slug} onChange={(e) => up({ slug: e.target.value })} mono />
        <RichText label="Description*" value={`About ${d.name}: curated, lab-tested ${d.name.toLowerCase()} delivered same-day across our California zones. Hyperwolf runs a tighter menu so what you order was selected recently — not sitting in a warehouse aging out.`} aiPrompt={`Write a 2-3 sentence storefront description for the cannabis category "${d.name}" for Hyperwolf, a California same-day weed delivery brand. Confident, plain, no hype. Return only the text.`} aiFallback={`About ${d.name}: a curated, lab-tested selection delivered same-day across our California zones. We keep the menu tight, so what you order was chosen recently — not aged in a warehouse.`} />
      </Sec>

      {/* The mapping, inline, per sub-category — same picker as the board. */}
      <Card padding={0} style={{ overflow: 'visible' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 18px', borderBottom: `1px solid ${P.hairline}`, flexWrap: 'wrap' }}>
          <Pill kind="info" size="sm">WEEDMAPS</Pill>
          <span style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>Taxonomy mapping</span>
          {wrong > 0 && <Pill kind="bad" size="sm">{wrong} wrong root</Pill>}
          {unmapped > 0 && <Pill kind="bad" size="sm">{unmapped} unmapped</Pill>}
          {!wrong && !unmapped && <Pill kind="good" size="sm" dot>every sub-category has a node</Pill>}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: P.type.micro, color: P.inkMute }}>{allowedRoots(cat.name) ? 'belongs under ' + allowedRoots(cat.name).join(' / ') : 'no root rule — not root-checked'}</span>
        </div>
        <div style={{ padding: '6px 18px 14px' }}>
          <div style={{ fontSize: P.type.meta, color: P.inkDim, padding: '9px 0 4px', lineHeight: 1.5 }}>Products inherit their sub-category’s mapping. Open a sub-category to map it here, or use the board on the Categories screen — both write to the same place.</div>
          {cat.subs.map((s, i) => <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: `1px solid ${P.hairline}`, flexWrap: 'wrap' }}>
            <span style={{ flex: '1 1 200px', minWidth: 0, fontSize: P.type.body, fontWeight: 600, color: P.ink }}>{s.name}</span>
            <div style={{ flex: '2 1 300px', minWidth: 0 }}><WmPill sub={s} /></div>
            <PBtn size="xs" variant="secondary" icon="link" onClick={() => onOpenSub(s)}>Map…</PBtn>
          </div>)}
        </div>
      </Card>

      <FaqList seed={[
        { q: `What's the difference between the ${d.name.toLowerCase()} sub-categories?`, a: 'Each sub-category groups products by type, dose, or price tier so you can shop the way you actually think about it.' },
        { q: `How fast is ${d.name.toLowerCase()} delivery?`, a: 'Most orders arrive within 60–90 minutes across our core California zones — LA, Orange County, and the Inland Empire.' }]} />

      <Sec title="Meta Properties" cols={1} right={<AiBtn label="Generate with AI" onGen={genMeta} />}>
        <div><Fld label="Meta Title*" value={d.metaT} onChange={(e) => up({ metaT: e.target.value })} />
          <div style={{ fontSize: P.type.meta, color: P.inkMute, fontFamily: P.fontMono, marginTop: 5 }}>Character Count: {d.metaT.length} <span style={{ color: P.info }}>(Recommended Characters: 60)</span></div></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: P.type.micro, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>Meta Description*</span>
          <textarea value={d.metaD} onChange={(e) => up({ metaD: e.target.value })} rows={2} style={{ padding: '10px 12px', border: `1px solid ${P.hairline2}`, borderRadius: P.r8, background: P.field || P.surface, fontSize: P.type.body, color: P.ink, fontFamily: P.fontSans, outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }} />
          <span style={{ fontSize: P.type.meta, color: P.inkMute, fontFamily: P.fontMono }}>Character Count: {d.metaD.length} <span style={{ color: P.info }}>(Recommended Characters: 160)</span></span>
        </div>
      </Sec>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingBottom: 20 }}>
        <PBtn variant="accent" size="lg" icon="check" onClick={onBack}>Update</PBtn>
        <PBtn variant="secondary" size="lg" onClick={onBack}>Cancel</PBtn>
        <span style={{ fontSize: P.type.meta, color: P.inkMute, lineHeight: 1.5, flex: '1 1 260px' }}>
          The copy fields above are not wired to a route — there is no PUT for category content, so Update returns to the list and saves nothing. The mapping controls are the live part of this page.
        </span>
      </div>
    </div>
  </div>;
};

// ── Update Sub Category ─────────────────────────────────────────────────────
window.SubCategoryEdit = function SubCategoryEdit({ cat, sub, live, nodes, onBack, onMockSet }) {
  const P = useP();
  const [d, setD] = React.useState(() => ({ name: sub.name, menu: sub.name, h1: `Buy ${sub.name} Online`, slug: slug(sub.name), metaT: `Shop ${sub.name} Online | Same-Day Delivery`, metaD: `Shop ${sub.name.toLowerCase()} online with Hyperwolf. Curated selection with same-day weed delivery across California.` }));
  const up = (patch) => setD((x) => ({ ...x, ...patch }));
  const genMeta = async () => {
    const t = await aiGen(`Write an SEO meta title, max 60 characters, for the cannabis sub-category "${d.name}" for Hyperwolf — same-day California weed delivery. Return only the title.`, `Shop ${d.name} Online | Hyperwolf Same-Day Delivery`);
    const ds = await aiGen(`Write an SEO meta description, max 160 characters, for the cannabis sub-category "${d.name}" for Hyperwolf — curated, lab-tested, same-day California weed delivery. Return only the description.`, `Shop ${d.name.toLowerCase()} online with Hyperwolf — a curated, lab-tested selection delivered same-day across California.`);
    up({ ...(t ? { metaT: t } : {}), ...(ds ? { metaD: ds } : {}) });
  };

  return <div style={{ maxWidth: 1080, margin: '0 auto' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
      <button data-hw-i onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: P.ink, fontSize: P.type.h2, fontWeight: 800, letterSpacing: '-.02em', fontFamily: P.fontSans, padding: 0 }}><Icon name="chevron-left" size={20} stroke={2.2} />Update Sub Category</button>
      <div style={{ flex: 1 }} />
      <Pill kind={live ? 'good' : 'warn'} size="sm">{live ? 'LIVE BOARD' : 'MOCK — NO API'}</Pill>
      <span style={{ fontSize: P.type.meta, color: P.inkMute, fontFamily: P.fontMono }}>{sub.id || 'no id — mock row'}{sub.skuCount == null ? '' : ' · ' + plural(sub.skuCount, 'product')}</span>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* The mapping first: it is the only thing on this page that writes. */}
      <Card padding={0} style={{ overflow: 'visible' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 18px', borderBottom: `1px solid ${P.hairline}` }}>
          <Pill kind="info" size="sm">WEEDMAPS</Pill>
          <span style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>Taxonomy mapping</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: P.type.micro, color: P.inkMute }}>{allowedRoots(cat.name) ? 'belongs under ' + allowedRoots(cat.name).join(' / ') + ' on Weedmaps' : 'no root rule — not root-checked'}</span>
        </div>
        <div style={{ padding: 18, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: '0 0 auto' }}>
            <span style={{ width: 34, height: 34, borderRadius: P.r8, background: catColor(P, cat.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.surface }}><Icon name="grid" size={17} stroke={1.9} /></span>
            <div><div style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>{sub.name}</div><div style={{ fontSize: P.type.meta, color: P.inkMute }}>in {cat.name}</div></div>
          </div>
          <Icon name="arrow-right" size={18} color={P.inkFaint} style={{ alignSelf: 'center' }} />
          <div style={{ flex: '1 1 380px', minWidth: 260 }}>
            <InlineMap sub={sub} nodes={nodes} live={live} onMockSet={onMockSet} />
          </div>
        </div>
      </Card>

      <Card padding={18}><div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <ImgSlot id={`sub-${slug(cat.name)}-${slug(sub.name)}-img`} label="Category Image*" />
        <ImgSlot id={`sub-${slug(cat.name)}-${slug(sub.name)}-banner`} label="Banner Image" note="1392×260" aspect="1392 / 260" grow />
      </div></Card>

      <Sec title="Category Info">
        <Fld label="Category Name*" value={d.name} onChange={(e) => up({ name: e.target.value })} />
        <Fld label="Category Menu Name" value={d.menu} onChange={(e) => up({ menu: e.target.value })} />
        <Fld label="Category Heading (H1)" value={d.h1} onChange={(e) => up({ h1: e.target.value })} />
        <Fld label="Category Slug" value={d.slug} onChange={(e) => up({ slug: e.target.value })} mono />
        <RichText label="Description*" value={`Welcome to ${d.name}. Curated, lab-tested products delivered same-day across our California zones.`} aiPrompt={`Write a 2-3 sentence storefront description for the cannabis sub-category "${d.name}" for Hyperwolf, a California same-day weed delivery brand. Confident, plain, no hype. Return only the text.`} aiFallback={`Welcome to ${d.name} — a curated, lab-tested selection delivered same-day across our California zones.`} />
      </Sec>

      <FaqList seed={[{ q: `What is ${d.name}?`, a: `${d.name} groups products so you can shop faster. Everything here is lab-tested and delivered same-day.` }]} />

      <Sec title="Meta Properties" cols={2} right={<AiBtn label="Generate with AI" onGen={genMeta} />}>
        <div><Fld label="Meta Title*" value={d.metaT} onChange={(e) => up({ metaT: e.target.value })} />
          <div style={{ fontSize: P.type.meta, color: P.inkMute, fontFamily: P.fontMono, marginTop: 5 }}>Character Count: {d.metaT.length} <span style={{ color: P.info }}>(Recommended Characters: 60)</span></div></div>
        <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: P.type.micro, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>Meta Description*</span>
          <textarea value={d.metaD} onChange={(e) => up({ metaD: e.target.value })} rows={2} style={{ padding: '10px 12px', border: `1px solid ${P.hairline2}`, borderRadius: P.r8, background: P.field || P.surface, fontSize: P.type.body, color: P.ink, fontFamily: P.fontSans, outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }} />
          <span style={{ fontSize: P.type.meta, color: P.inkMute, fontFamily: P.fontMono }}>Character Count: {d.metaD.length} <span style={{ color: P.info }}>(Recommended Characters: 160)</span></span>
        </div>
      </Sec>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', paddingBottom: 20 }}>
        <PBtn variant="accent" size="lg" icon="check" onClick={onBack}>Update</PBtn>
        <PBtn variant="secondary" size="lg" onClick={onBack}>Cancel</PBtn>
        <span style={{ fontSize: P.type.meta, color: P.inkMute, lineHeight: 1.5, flex: '1 1 260px' }}>
          The copy fields above are not wired to a route. POST /api/taxonomy/sub-category creates and renames a sub-category, but this page does not call it yet — the mapping block at the top is the live part.
        </span>
      </div>
    </div>
  </div>;
};
