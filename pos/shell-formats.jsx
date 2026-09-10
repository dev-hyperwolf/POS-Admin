// ── Formats — the naming templates a shell picks from ──────────────────────
// Catalog sub-nav, beside Shells. A format owns the template a shell's
// products derive their name from (window.HW_NAMING.derive), plus the
// defaults (weight/unit/pack, WM node, kit box) a new shell inherits.
//
// Backend: wmdemo/shells_api.py, GET/POST /api/shells/formats*, through
// window.HW_LIVE (see shared/hw-live.js — get/post never reject, always
// {ok, code, body, error, hint}). docs/SHELLS-PLAN-2026-09-09.md §3-4 is the
// spec; rulings 4 (rename/template ripple → preview + split) and 5 (delete
// never orphans → reassign-first) are the owner's words, not a suggestion.
//
// Self-wrapped IIFE — leaks exactly one global, window.ShellFormatsModule.
;(function () {
  const useP = window.useP;
  const S = window.HW_SHELL;

  // ── session / actor ────────────────────────────────────────────────────
  // Same accessor every other POS write path uses (pos/screen-aov.jsx,
  // pos/screen-incentives-card.jsx) — there is no second "who is this" for
  // the POS layer, and inventing one here would be a second copy that can
  // drift from the till's own idea of who is signed in.
  //
  // actorName() sends the ASSOCIATE ID, not the display name — confirmed
  // live: wmdemo's contests.is_manager(actor) does associates.get(actor), a
  // lookup keyed by associate_id ('manisha-saini'), not by the display name
  // ('Manisha Saini'). incentives/*.jsx (the Bounty module this endpoint
  // explicitly copies its manager check from) sends `actor: session.id`
  // everywhere for exactly this reason — sending the name 403'd every
  // manager-only call under a real Floor Manager.
  function associate() {
    return (window.HW && window.HW.STATS && window.HW.STATS.associate) || {};
  }
  function actorName() {
    const a = associate();
    return a.id || a.name || 'POS';
  }
  function isManagerActor() {
    const a = associate();
    return window.HWContracts ? window.HWContracts.roleAtLeast(a.role, 'manager') : a.role === 'Floor Manager';
  }
  function live() { return window.HW_LIVE || null; }

  // ── template validation (client-side pre-check; the server is the real
  // gate and its own warnings always win on submit — this only stops an
  // obviously-broken template from ever reaching Save) ───────────────────
  const KNOWN_TOKEN_RE = /^\{(name|type|ratio|size|count|tier|infused|sour)(\|(name|type))?\}$/;
  const NUMERIC_WEIGHT_RE = /\b\d+(\.\d+)?\s*(g|mg|ml|oz)\b/i;
  const FRACTION_WEIGHT_RE = /\b\d+\/\d+\s*(oz|g)\b/i;
  const CANNABINOID_RE = /\b(THC|CBD|CBN|CBC|CBG)\b/i;
  const TOPICAL_WORDS = ['Topical', 'Balm', 'Salve', 'Lotion', 'Cream', 'Roll-On'];

  function validateTemplate(template, category, subcategory) {
    const t = (template || '').trim();
    const errors = [];
    if (!t) { errors.push('Template can’t be empty.'); return { valid: false, errors }; }
    const tokens = t.match(/\{[^}]*\}/g) || [];
    const hasNameOrType = tokens.some((tok) => tok === '{type}' || /^\{name(\|type)?\}$/.test(tok));
    if (!hasNameOrType) errors.push('Template must include {name} or {type}.');
    tokens.forEach((tok) => { if (!KNOWN_TOKEN_RE.test(tok)) errors.push('“' + tok + '” isn’t a known slot.'); });
    if (NUMERIC_WEIGHT_RE.test(t) || FRACTION_WEIGHT_RE.test(t)) errors.push('Numeric weights never appear in a name — remove it.');
    if (CANNABINOID_RE.test(t)) errors.push('Cannabinoid abbreviations (THC/CBD/CBN/CBC/CBG) aren’t allowed in a name.');
    if (category === 'Pre-Rolls' && !/(Pre-Roll|Infused Pre-Roll)\s*$/.test(t) && t.indexOf('{count}') === -1) {
      errors.push('Pre-Rolls templates must end in “Pre-Roll”, “Infused Pre-Roll”, or {count}.');
    }
    if (category === 'Edibles' && subcategory && /gumm/i.test(subcategory) && !/(Gummies|Gummy Belts)\s*$/i.test(t)) {
      errors.push('Gummies templates must end in “Gummies” or “Gummy Belts”.');
    }
    if (category === 'Wellness') {
      const endsTincture = /Tincture\s*$/.test(t);
      const endsTopical = TOPICAL_WORDS.some((w) => new RegExp(w + '\\s*$', 'i').test(t));
      if (!endsTincture && !endsTopical) errors.push('Wellness templates must end in “Tincture” or a topical word (Balm, Salve, Lotion, Cream, Roll-On, Topical).');
    }
    return { valid: errors.length === 0, errors };
  }

  const TEMPLATE_SLOTS = [
    { token: '{name}', hint: 'Strain, flavor or product name' },
    { token: '{name|type}', hint: 'Name if set, else Indica / Sativa / Hybrid' },
    { token: '{ratio}', hint: 'e.g. 2:1' },
    { token: '{size}', hint: 'Flower only — 7g/14g/28g → Quarter/Half/Full Ounce' },
    { token: '{count}', hint: 'Pack count → N-Pack' },
    { token: '{tier}', hint: '(Tier N) at the end' }
  ];

  // Render a template as mono text with its {slots} pulled out as chips —
  // the library row's "what does this actually produce" view.
  function TemplateChips({ template, size }) {
    const P = useP();
    const t = template || '';
    const parts = [];
    let last = 0, m;
    const re = /\{[^}]*\}/g;
    while ((m = re.exec(t))) {
      if (m.index > last) parts.push({ k: 'text', v: t.slice(last, m.index) });
      parts.push({ k: 'slot', v: m[0] });
      last = m.index + m[0].length;
    }
    if (last < t.length) parts.push({ k: 'text', v: t.slice(last) });
    const fs = size === 'sm' ? 10.5 : 11.5;
    return <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 3, fontFamily: P.fontMono, fontSize: fs }}>
      {parts.length === 0 && <span style={{ color: P.inkFaint }}>—</span>}
      {parts.map((p, i) => p.k === 'slot' ?
        <span key={i} style={{ display: 'inline-flex', padding: '1px 6px', borderRadius: 99, background: P.accentSoft, color: P.accentText, fontWeight: 700 }}>{p.v}</span> :
        <span key={i} style={{ color: P.ink2, whiteSpace: 'pre' }}>{p.v}</span>)}
    </span>;
  }

  // The live "Example" line — Blue Dream/Hybrid through window.HW_NAMING.
  // Never fakes a name: says plainly when the engine isn't loaded.
  function ExampleLine({ template, category, weight, unit, pack }) {
    const P = useP();
    const engine = window.HW_NAMING;
    if (!engine || typeof engine.derive !== 'function') {
      return <div style={{ fontSize: 11.5, color: P.inkMute, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="info" size={13} stroke={1.9} />Example: engine not loaded
      </div>;
    }
    const slots = { name: 'Blue Dream', type: 'Hybrid' };
    if ((template || '').indexOf('{ratio}') !== -1) slots.ratio = '2:1';
    let out, failed = null;
    try { out = engine.derive(template || '', slots, { weight: weight || null, unit: unit || null, pack: pack || null, category }); }
    catch (e) { failed = e && e.message ? e.message : String(e); }
    if (failed) return <div style={{ fontSize: 11.5, color: P.bad }}>Example: engine error — {failed}</div>;
    const name = out && out.name;
    const warnings = (out && out.warnings) || [];
    return <div>
      <div style={{ fontSize: 11.5, color: P.inkDim }}>Example &middot; <b style={{ color: P.ink, fontFamily: P.fontMono, fontWeight: 700 }}>{name || '—'}</b></div>
      {warnings.length > 0 && <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {warnings.map((w, i) => <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, color: P.warnText }}>
          <Icon name="alert" size={12} stroke={2} style={{ flex: '0 0 auto', marginTop: 1 }} />{w}
        </div>)}
      </div>}
    </div>;
  }

  // Template field + slot chips + example + inline validation, shared by the
  // format sheet and every inline "New format…" popup — one editor, not two.
  function TemplateEditor({ value, onChange, category, subcategory, weight, unit, pack, label }) {
    const P = useP();
    const ref = React.useRef(null);
    const v = validateTemplate(value, category, subcategory);
    function insertToken(tok) {
      const el = ref.current;
      const cur = value || '';
      if (!el) { onChange(cur + tok); return; }
      const start = el.selectionStart != null ? el.selectionStart : cur.length;
      const end = el.selectionEnd != null ? el.selectionEnd : cur.length;
      const next = cur.slice(0, start) + tok + cur.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        try { el.focus(); const pos = start + tok.length; el.setSelectionRange(pos, pos); } catch (e) { /* not focusable yet */ }
      });
    }
    return <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: P.inkMute }}>{label || 'Template *'}</span>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {TEMPLATE_SLOTS.map((s) => <button key={s.token} type="button" title={s.hint} onClick={() => insertToken(s.token)}
            style={{ padding: '3px 8px', borderRadius: 99, border: `1px solid ${P.hairline2}`, background: P.surface2, color: P.ink2, fontSize: 10.5, fontWeight: 700, fontFamily: P.fontMono, cursor: 'pointer' }}>{s.token}</button>)}
        </div>
      </div>
      <input ref={ref} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="{name} Live Resin Sauce All-In-One"
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: P.field, color: P.ink, fontFamily: P.fontMono, fontSize: 13, outline: 'none' }} />
      <div style={{ marginTop: 8 }}><ExampleLine template={value} category={category} weight={weight} unit={unit} pack={pack} /></div>
      {(value || '').trim() !== '' && !v.valid && <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {v.errors.map((e, i) => <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11.5, color: P.warnText }}>
          <Icon name="alert" size={13} stroke={1.9} style={{ flex: '0 0 auto', marginTop: 1 }} />{e}
        </div>)}
      </div>}
    </div>;
  }

  // Destination picker — existing format (same category first, then a
  // divider via <optgroup>, other categories after) or "+ New format…".
  // Used by both the rename/split flow and the delete/reassign flow, so a
  // destination always means the same thing wherever it's picked.
  function DestPicker({ formats, sameCategory, excludeId, value, extraOption, placeholder, disabled, onPick, onRequestNew }) {
    const P = useP();
    const list = formats || [];
    const same = list.filter((f) => f.id !== excludeId && f.category === sameCategory);
    const other = list.filter((f) => f.id !== excludeId && f.category !== sameCategory);
    return <div style={{ position: 'relative' }}>
      <select disabled={disabled} value={value || ''} onChange={(e) => {
        const v = e.target.value;
        if (v === '__new__') { onRequestNew(); return; }
        onPick(v || null);
      }} style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', padding: '8px 30px 8px 12px', border: `1px solid ${P.fieldBorder}`, borderRadius: P.r10, background: disabled ? P.disabledBg : P.field, fontSize: 12.5, fontWeight: 600, color: disabled ? P.disabledInk : P.ink, fontFamily: P.fontSans, outline: 'none', cursor: disabled ? 'not-allowed' : 'pointer' }}>
        <option value="" disabled={!!value}>{placeholder || 'Choose a destination…'}</option>
        {extraOption && <option value={extraOption.value}>{extraOption.label}</option>}
        {same.length > 0 && <optgroup label="This category">{same.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</optgroup>}
        {other.length > 0 && <optgroup label="Other categories">{other.map((f) => <option key={f.id} value={f.id}>{f.name + ' (' + f.category + ')'}</option>)}</optgroup>}
        <option value="__new__">+ New format…</option>
      </select>
      <Icon name="chevron-down" size={13} stroke={2.2} color={P.inkMute} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
    </div>;
  }

  // Compact inline "New format…" — name + template only. Everything else
  // (category, subcategory, size defaults, WM node, kit box) is inherited
  // from the format this split/reassign started from — a split-off product
  // line stays in its own category unless someone deliberately edits the
  // new format afterwards from the library.
  function NewFormatInline({ source, onCancel, onCreate }) {
    const P = useP();
    const [name, setName] = React.useState('');
    const [template, setTemplate] = React.useState('');
    const v = validateTemplate(template, source.category, source.subcategory);
    const canCreate = !!(name.trim() && v.valid);
    return <div onClick={onCancel} style={window.overlayScrim(P, { padding: '60px 20px' })}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(520px,94vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: P.ink, flex: 1 }}>New format</span>
          <IconBtn icon="x" size={16} label="Close" onClick={onCancel} />
        </div>
        <div style={{ fontSize: 11.5, color: P.inkMute, marginBottom: 14, lineHeight: 1.5 }}>
          Inherits category (<b style={{ color: P.ink2 }}>{source.category}</b>), subcategory, size defaults, WM node and kit box from <b style={{ color: P.ink2 }}>{source.name}</b> — change those later from this format's own edit sheet.
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 6 }}>Name *</div>
          <Field value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cured Resin Cartridge" />
        </div>
        <TemplateEditor value={template} onChange={setTemplate} category={source.category} subcategory={source.subcategory}
          weight={source.default_weight} unit={source.default_unit} pack={source.default_pack} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <PBtn variant="secondary" size="md" onClick={onCancel}>Cancel</PBtn>
          <PBtn variant="accent" size="md" icon="check" disabled={!canCreate} onClick={() => canCreate && onCreate({
            name: name.trim(), template: template.trim(), category: source.category, subcategory: source.subcategory,
            default_weight: source.default_weight, default_unit: source.default_unit, default_pack: source.default_pack,
            wm_node: source.wm_node, kit_box: source.kit_box, active: true
          })}>Create</PBtn>
        </div>
      </div>
    </div>;
  }

  // ── data: the formats library ───────────────────────────────────────────
  function useFormats() {
    const [state, setState] = React.useState({ loading: true, error: null, formats: null, counts: {} });
    const load = React.useCallback(() => {
      const L = live();
      if (!L) { setState({ loading: false, error: 'no-live-seam', formats: null, counts: {} }); return; }
      setState((s) => ({ ...s, loading: true }));
      L.get('/api/shells/formats').then((res) => {
        if (res.ok && res.body) setState({ loading: false, error: null, formats: res.body.formats || [], counts: res.body.counts || {} });
        else setState({ loading: false, error: (res.body && res.body.error) || res.error || ('HTTP ' + res.code), formats: null, counts: {} });
      });
    }, []);
    React.useEffect(() => { load(); }, [load]);
    return { ...state, refresh: load };
  }

  function blankFormatDraft() {
    const c = S.catDef('Flower');
    return { name: '', category: 'Flower', subcategory: c.subs[0], template: '', default_weight: '', default_unit: c.unit, default_pack: '1', wm_node: c.wm, kit_box: (S.BOXES[0] || ''), active: true };
  }
  function draftFromFormat(f) {
    return {
      name: f.name || '', category: f.category, subcategory: f.subcategory || '', template: f.template || '',
      default_weight: f.default_weight != null ? String(f.default_weight) : '', default_unit: f.default_unit || '',
      default_pack: f.default_pack != null ? String(f.default_pack) : '1', wm_node: f.wm_node || '', kit_box: f.kit_box || '',
      active: f.active !== 0 && f.active !== false
    };
  }

  // ══ ADD / EDIT SHEET ═══════════════════════════════════════════════════════
  // initialDraft lets a caller open this pre-set to a category/subcategory —
  // used by openNew() below (window.ShellFormatsModule.openNew, called from
  // pos/shell-form.jsx's "+ New format") so a format created from the shell
  // form starts in the same category the shell is being created in, instead
  // of always defaulting to Flower.
  function FormatSheet({ editing, formats, counts, initialDraft, onClose, onSaved, onNeedsPreview }) {
    const P = useP();
    const B = window.ShellFormBits;
    const [d, setD] = React.useState(() => editing ? draftFromFormat(editing) : (initialDraft || blankFormatDraft()));
    const s1 = (k, v) => setD((o) => ({ ...o, [k]: v }));
    const [busy, setBusy] = React.useState(false);
    const [serverError, setServerError] = React.useState(null);
    const cat = S.catDef(d.category);
    const v = validateTemplate(d.template, d.category, d.subcategory);
    const canSave = !!(d.name.trim() && d.category && d.subcategory && v.valid && !busy);
    const productsCount = editing ? ((counts[editing.id] || {}).products || 0) : 0;

    const pickCategory = (key) => {
      const c = S.catDef(key);
      setD((o) => ({ ...o, category: key, subcategory: c.subs[0], default_unit: c.unit, wm_node: c.wm }));
    };

    function buildPayload() {
      return {
        id: editing ? editing.id : undefined,
        name: d.name.trim(), category: d.category, subcategory: d.subcategory, template: d.template.trim(),
        default_weight: d.default_weight === '' ? null : parseFloat(d.default_weight),
        default_unit: d.default_unit, default_pack: d.default_pack === '' ? null : parseInt(d.default_pack, 10),
        wm_node: d.wm_node, kit_box: d.kit_box, active: !!d.active, actor: actorName()
      };
    }
    function diffPatch() {
      if (!editing) return null;
      const before = draftFromFormat(editing);
      const patch = {};
      Object.keys(d).forEach((k) => { if (String(d[k]) !== String(before[k])) patch[k] = d[k]; });
      if ('default_weight' in patch) patch.default_weight = patch.default_weight === '' ? null : parseFloat(patch.default_weight);
      if ('default_pack' in patch) patch.default_pack = patch.default_pack === '' ? null : parseInt(patch.default_pack, 10);
      return patch;
    }

    const save = () => {
      if (!canSave) return;
      setServerError(null);
      const patch = diffPatch();
      // Owner ruling 4: a name/template change on a format that already has
      // products never writes directly — it routes to preview + split first.
      const ripples = patch && ('name' in patch || 'template' in patch);
      if (editing && ripples && productsCount > 0) { onNeedsPreview(editing, patch); return; }
      setBusy(true);
      const L = live();
      if (!L) { setBusy(false); setServerError({ message: 'No live seam — nothing was saved.' }); return; }
      L.post('/api/shells/formats', buildPayload()).then((res) => {
        setBusy(false);
        if (res.ok && res.body) { onSaved(res.body.format || res.body, (res.body && res.body.warnings) || []); return; }
        if (res.code === 409) { setServerError({ message: 'A format with this name already exists in ' + d.category + '.' }); return; }
        if (res.code === 400) { setServerError({ message: (res.body && res.body.error) || res.error || 'Refused.', warnings: (res.body && res.body.warnings) || [] }); return; }
        setServerError({ message: res.error || ('HTTP ' + res.code) });
      });
    };

    return <div onClick={onClose} style={window.overlayScrim(P, { padding: '40px 20px' })}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(720px,96vw)', background: P.surface, borderRadius: P.r20, boxShadow: P.shadowLg, border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${P.hairline2}` }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>{editing ? 'Edit format' : 'New format'}</span>
          <div style={{ flex: 1 }} />
          <IconBtn icon="x" label="Close" onClick={onClose} />
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '72vh', overflowY: 'auto' }}>
          <B.Sec title="Identity" sub="Name, category and subcategory — how a shell picks this template.">
            <B.Lb>Name *</B.Lb>
            <Field value={d.name} onChange={(e) => s1('name', e.target.value)} placeholder="e.g. Live Resin Sauce All-In-One" />
            <div style={{ marginTop: 16 }}>
              <B.Lb>Category *</B.Lb>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))', gap: 8 }}>
                {S.TAX.map((c) => <B.Chip key={c.key} on={d.category === c.key} onClick={() => pickCategory(c.key)} style={{ justifyContent: 'flex-start', padding: '9px 12px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: window.HW.CAT_COLOR[c.key] || P.neutral }} />{c.name}
                </B.Chip>)}
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <B.Lb>Subcategory *</B.Lb>
              <B.Sel value={d.subcategory} onChange={(x) => s1('subcategory', x)} options={cat.subs} full />
            </div>
          </B.Sec>

          <B.Sec title="Naming template" sub="What a product in this format is called — built from slots, never a weight.">
            <TemplateEditor value={d.template} onChange={(x) => s1('template', x)} category={d.category} subcategory={d.subcategory}
              weight={parseFloat(d.default_weight) || null} unit={d.default_unit} pack={parseInt(d.default_pack, 10) || null} />
          </B.Sec>

          <B.Sec title="Defaults" sub="Inherited by every shell that picks this format, unless the shell overrides them.">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', gap: 12 }}>
              <div><B.Lb>Default weight</B.Lb><Field mono value={d.default_weight} placeholder="1" onChange={(e) => s1('default_weight', e.target.value.replace(/[^0-9.]/g, ''))} /></div>
              <div><B.Lb>Unit</B.Lb><B.Sel value={d.default_unit} onChange={(x) => s1('default_unit', x)} options={cat.units} full /></div>
              <div><B.Lb>Pack</B.Lb><Field mono value={d.default_pack} placeholder="1" onChange={(e) => s1('default_pack', e.target.value.replace(/[^0-9]/g, ''))} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
              <div><B.Lb hint="Weedmaps node label hint — display only until HW_TAXONOMY binds it.">WM node</B.Lb><Field value={d.wm_node} onChange={(e) => s1('wm_node', e.target.value)} /></div>
              <div><B.Lb hint="Which delivery kit box a shell in this format rides in by default.">Kit box</B.Lb><B.Sel value={d.kit_box} onChange={(x) => s1('kit_box', x)} options={S.BOXES} full /></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14, padding: '10px 12px', background: P.surface2, borderRadius: P.r10 }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: P.ink }}>Active</div>
                <div style={{ fontSize: 11, color: P.inkMute }}>Retired formats stay for history but can't take new shells.</div>
              </div>
              <window.Switch on={d.active} onChange={(v2) => s1('active', v2)} />
            </div>
          </B.Sec>

          {editing && productsCount > 0 && <B.Note tone="info">
            <b>{productsCount} product{productsCount === 1 ? '' : 's'}</b> use this format. Changing the name or template here opens a preview so you can review — and split — the ripple before anything is written.
          </B.Note>}

          {serverError && <div style={{ padding: '11px 13px', background: P.badSoft, border: `1px solid ${P.bad}33`, borderRadius: P.r10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: P.bad }}>{serverError.message}</div>
            {(serverError.warnings || []).length > 0 && <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {serverError.warnings.map((w, i) => <div key={i} style={{ fontSize: 11.5, color: P.warnText }}>&middot; {w}</div>)}
            </div>}
          </div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 18px', borderTop: `1px solid ${P.hairline2}` }}>
          <span style={{ fontSize: 11.5, color: P.inkMute }}>{editing ? (productsCount > 0 ? productsCount + ' product' + (productsCount === 1 ? '' : 's') + ' on this format' : 'No products on this format yet') : 'New naming template'}</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <PBtn variant="secondary" size="lg" onClick={onClose} disabled={busy}>Cancel</PBtn>
            <PBtn variant="accent" size="lg" icon="check" busy={busy} disabled={!canSave} onClick={save}>{editing ? 'Save changes' : 'Create format'}</PBtn>
          </div>
        </div>
      </div>
    </div>;
  }

  // ══ PREVIEW + SPLIT (rename / template-change ripple) ══════════════════════
  function PreviewModal({ format, patch, formats, onClose, onApplied }) {
    const P = useP();
    const [state, setState] = React.useState({ loading: true, error: null, affected: null, shellsById: {} });
    const [rows, setRows] = React.useState({});       // sku -> { checked, group }
    const [groups, setGroups] = React.useState([]);   // [{ gid, destLabel, destKind, to_format_id?, new_format?, skus }]
    const [selected, setSelected] = React.useState(() => new Set());
    const [newFormatOpen, setNewFormatOpen] = React.useState(false);
    const [applying, setApplying] = React.useState(false);
    const [applyError, setApplyError] = React.useState(null);
    const groupIdRef = React.useRef(0);

    React.useEffect(() => {
      const L = live();
      if (!L) { setState({ loading: false, error: 'no-live-seam', affected: null, shellsById: {} }); return; }
      L.post('/api/shells/formats/preview', { id: format.id, patch }).then((res) => {
        if (res.ok && res.body) {
          const affected = res.body.affected || [];
          const byShell = {};
          (res.body.shells || []).forEach((s) => { byShell[s.id] = s; });
          const init = {};
          affected.forEach((a) => { init[a.sku] = { checked: true, group: null }; });
          setRows(init);
          setState({ loading: false, error: null, affected, shellsById: byShell });
        } else {
          setState({ loading: false, error: (res.body && res.body.error) || res.error || ('HTTP ' + res.code), affected: null, shellsById: {} });
        }
      });
    }, [format.id]);

    const affected = state.affected || [];
    const bySku = React.useMemo(() => { const m = {}; affected.forEach((a) => { m[a.sku] = a; }); return m; }, [affected]);
    const mainRows = affected.filter((a) => rows[a.sku] && rows[a.sku].group === null);
    const applyCount = mainRows.filter((a) => rows[a.sku].checked).length;
    const heldSkus = mainRows.filter((a) => !rows[a.sku].checked).map((a) => a.sku);
    const splitCount = groups.reduce((n, g) => n + g.skus.length, 0);
    const canApply = !applying && affected.length > 0 && heldSkus.length === 0;

    function toggleChecked(sku) { setRows((o) => ({ ...o, [sku]: { ...o[sku], checked: !o[sku].checked } })); }
    function toggleSelect(sku) { setSelected((s) => { const n = new Set(s); if (n.has(sku)) n.delete(sku); else n.add(sku); return n; }); }
    function createSplitGroup(dest) {
      if (selected.size === 0) return;
      const skus = [...selected];
      const gid = ++groupIdRef.current;
      setGroups((gs) => [...gs, { gid, destLabel: dest.label, destKind: dest.kind, to_format_id: dest.to_format_id, new_format: dest.new_format, skus }]);
      setRows((o) => { const n = { ...o }; skus.forEach((sku) => { n[sku] = { ...n[sku], group: gid }; }); return n; });
      setSelected(new Set());
    }
    function dissolveGroup(gid) {
      setGroups((gs) => gs.filter((g) => g.gid !== gid));
      setRows((o) => { const n = { ...o }; Object.keys(n).forEach((sku) => { if (n[sku].group === gid) n[sku] = { checked: true, group: null }; }); return n; });
    }

    function apply() {
      if (!canApply) return;
      setApplying(true); setApplyError(null);
      const applySkus = mainRows.filter((a) => rows[a.sku].checked).map((a) => a.sku);
      const split = groups.map((g) => Object.assign({ skus: g.skus }, g.destKind === 'existing' ? { to_format_id: g.to_format_id } : { new_format: g.new_format }));
      const L = live();
      if (!L) { setApplying(false); setApplyError({ message: 'No live seam — nothing was applied.' }); return; }
      L.post('/api/shells/formats/apply', { id: format.id, patch, apply: applySkus, split, actor: actorName() }).then((res) => {
        setApplying(false);
        if (res.ok && res.body) { onApplied(res.body); return; }
        if (res.code === 400 && res.body && res.body.missing) { setApplyError({ message: 'Some products weren’t accounted for — nothing was written.', missing: res.body.missing }); return; }
        setApplyError({ message: (res.body && res.body.error) || res.error || ('HTTP ' + res.code) });
      });
    }

    return <div onClick={onClose} style={window.overlayScrim(P, { padding: '32px 20px' })}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(900px,97vw)', background: P.surface, borderRadius: P.r20, boxShadow: P.shadowLg, border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${P.hairline2}` }}>
          <Icon name="split" size={16} color={P.inkDim} />
          <span style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>Preview — {format.name}</span>
          <div style={{ flex: 1 }} />
          <IconBtn icon="x" label="Close" onClick={onClose} />
        </div>

        <div style={{ padding: 18, maxHeight: '68vh', overflowY: 'auto' }}>
          {state.loading && <window.SkeletonRows rows={4} avatar={false} />}
          {!state.loading && state.error && <window.ErrorState title="Preview didn’t load" detail={state.error} onRetry={onClose} />}
          {!state.loading && !state.error && affected.length === 0 && <window.EmptyState icon="check" title="No products are affected" body="Nothing on this format will change name — the edit will save directly." />}

          {!state.loading && !state.error && affected.length > 0 && <>
            <div style={{ fontSize: 12.5, color: P.inkDim, marginBottom: 12 }}>Every row is checked by default. Uncheck to hold a row out; select rows and choose a destination to split them off instead.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, color: P.inkMute, whiteSpace: 'nowrap' }}>{selected.size} selected</span>
              <div style={{ flex: 1, opacity: selected.size ? 1 : .5, pointerEvents: selected.size ? 'auto' : 'none' }}>
                <DestPicker formats={formats} sameCategory={format.category} excludeId={format.id} placeholder="Split selected to…"
                  disabled={selected.size === 0}
                  onPick={(id) => createSplitGroup({ kind: 'existing', to_format_id: id, label: (formats.find((f) => f.id === id) || {}).name || id })}
                  onRequestNew={() => setNewFormatOpen(true)} />
              </div>
            </div>

            <window.DataTable rowKey={(a) => a.sku} selectedKeys={selected} onRowClick={(a) => toggleSelect(a.sku)}
              columns={[
                { label: '', width: '36px', render: (a) => <Check on={!!rows[a.sku] && rows[a.sku].checked} onChange={() => toggleChecked(a.sku)} /> },
                { label: 'SKU', render: (a) => <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkDim }}>{a.sku}</span> },
                { label: 'Shell', render: (a) => { const sh = state.shellsById[a.shell_id]; return <span style={{ fontSize: 12.5, color: P.ink2 }}>{sh ? ((sh.brand_name || sh.brand || '') + ' · ' + (sh.name || sh.id)) : (a.shell_id || '—')}</span>; } },
                { label: 'Before', render: (a) => <span style={{ fontFamily: P.fontMono, fontSize: 12, color: P.inkFaint, textDecoration: 'line-through' }}>{a.before}</span> },
                { label: '', width: '24px', render: () => <Icon name="arrow-right" size={13} color={P.inkFaint} /> },
                { label: 'After', render: (a) => <span style={{ fontFamily: P.fontMono, fontSize: 12.5, fontWeight: 700, color: P.ink }}>{a.after}</span> }
              ]}
              rows={mainRows} />

            {groups.map((g) => <div key={g.gid} style={{ marginTop: 16, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}>
                <Icon name="split" size={14} color={P.inkDim} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink }}>Split &rarr; {g.destLabel}</span>
                <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{g.skus.length} product{g.skus.length === 1 ? '' : 's'}</span>
                <div style={{ flex: 1 }} />
                <IconBtn icon="x" size={13} title="Undo — move these back to Apply" label="Undo split" style={{ width: 26, height: 26 }} onClick={() => dissolveGroup(g.gid)} />
              </div>
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {g.skus.map((sku) => { const a = bySku[sku]; if (!a) return null; return <div key={sku} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                  <span style={{ fontFamily: P.fontMono, color: P.inkDim, minWidth: 100 }}>{sku}</span>
                  <span style={{ fontFamily: P.fontMono, color: P.inkFaint, textDecoration: 'line-through' }}>{a.before}</span>
                  <Icon name="arrow-right" size={11} color={P.inkFaint} />
                  <span style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink }}>{a.after}</span>
                </div>; })}
              </div>
            </div>)}

            {applyError && <div style={{ marginTop: 14, padding: '11px 13px', background: P.badSoft, border: `1px solid ${P.bad}33`, borderRadius: P.r10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: P.bad }}>{applyError.message}</div>
              {applyError.missing && <div style={{ marginTop: 4, fontSize: 11.5, color: P.warnText, fontFamily: P.fontMono }}>{applyError.missing.join(', ')}</div>}
            </div>}
          </>}
        </div>

        {!state.loading && !state.error && affected.length > 0 && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 18px', borderTop: `1px solid ${P.hairline2}` }}>
          <span style={{ fontSize: 12.5, color: heldSkus.length ? P.warnText : P.inkMute }}>
            Apply {applyCount} &middot; Split {splitCount} &middot; Held {heldSkus.length}
            {heldSkus.length > 0 && <> — {heldSkus.length === 1 ? '1 row is' : heldSkus.length + ' rows are'} held; check it or split it to continue.</>}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <PBtn variant="secondary" size="lg" onClick={onClose}>Cancel</PBtn>
            <PBtn variant="accent" size="lg" icon="check" busy={applying} disabled={!canApply}
              title={!canApply && heldSkus.length ? heldSkus.length + ' row' + (heldSkus.length > 1 ? 's' : '') + ' still held' : undefined}
              onClick={apply}>Apply</PBtn>
          </div>
        </div>}
      </div>
      {newFormatOpen && <NewFormatInline source={format} onCancel={() => setNewFormatOpen(false)}
        onCreate={(nf) => { createSplitGroup({ kind: 'new', new_format: nf, label: nf.name }); setNewFormatOpen(false); }} />}
    </div>;
  }

  // ══ DELETE → REASSIGN (owner ruling 5: never orphans) ══════════════════════
  function ReassignModal({ format, formats, onClose, onDeleted }) {
    const P = useP();
    const [state, setState] = React.useState({ loading: true, error: null, shells: null });
    const [dest, setDest] = React.useState({});          // shell_id -> { kind, to_format_id?, new_format?, label }
    const [newFormatTarget, setNewFormatTarget] = React.useState(null); // shell_id | 'ALL' | null
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState(null);          // { manager?, missing?, message? }

    React.useEffect(() => {
      const L = live();
      if (!L) { setState({ loading: false, error: 'no-live-seam', shells: null }); return; }
      L.get('/api/shells?format=' + encodeURIComponent(format.id)).then((res) => {
        if (res.ok && res.body) setState({ loading: false, error: null, shells: res.body.shells || [] });
        else setState({ loading: false, error: (res.body && res.body.error) || res.error || ('HTTP ' + res.code), shells: null });
      });
    }, [format.id]);

    const shells = state.shells || [];
    const setRowDest = (shellId, d) => setDest((o) => ({ ...o, [shellId]: d }));
    const applyMoveAll = (d) => setDest((o) => { const n = { ...o }; shells.forEach((s) => { n[s.id] = d; }); return n; });
    const missingRows = shells.filter((s) => !dest[s.id]);
    const canDelete = !busy && missingRows.length === 0;
    const reason = missingRows.length === 1 ? '1 shell still needs a destination' : (missingRows.length > 1 ? missingRows.length + ' shells still need a destination' : null);

    function confirm() {
      if (!canDelete) return;
      setBusy(true); setErr(null);
      const rows = shells.map((s) => {
        const d = dest[s.id];
        return d.kind === 'existing' ? { shell_id: s.id, to_format_id: d.to_format_id } : { shell_id: s.id, new_format: d.new_format };
      });
      const L = live();
      if (!L) { setBusy(false); setErr({ message: 'No live seam — nothing was deleted.' }); return; }
      L.post('/api/shells/formats/delete', { id: format.id, reassign: { rows }, actor: actorName() }).then((res) => {
        setBusy(false);
        if (res.ok && res.body) { onDeleted(res.body); return; }
        if (res.code === 403) { setErr({ manager: true }); return; }
        if (res.code === 400) { setErr({ missing: (res.body && res.body.missing) || [], message: (res.body && res.body.error) || res.error }); return; }
        setErr({ message: res.error || ('HTTP ' + res.code) });
      });
    }

    if (err && err.manager) {
      return <div onClick={onClose} style={window.overlayScrim(P, { padding: '60px 20px' })}>
        <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(480px,94vw)', background: P.surface, borderRadius: P.r16, boxShadow: P.shadowLg, border: `1px solid ${P.hairline2}`, padding: 4 }}>
          <window.ErrorState title="Manager only" body="Deleting a format is a manager-only action. Nothing was changed." onRetry={onClose} />
        </div>
      </div>;
    }

    return <div onClick={onClose} style={window.overlayScrim(P, { padding: '32px 20px' })}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(820px,97vw)', background: P.surface, borderRadius: P.r20, boxShadow: P.shadowLg, border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: `1px solid ${P.hairline2}` }}>
          <Icon name="trash" size={16} color={P.bad} />
          <span style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>Delete — {format.name}</span>
          <div style={{ flex: 1 }} />
          <IconBtn icon="x" label="Close" onClick={onClose} />
        </div>

        <div style={{ padding: 18, maxHeight: '68vh', overflowY: 'auto' }}>
          {!isManagerActor() && <div style={{ display: 'flex', gap: 9, padding: '10px 12px', background: P.warnSoft, borderRadius: P.r10, marginBottom: 14 }}>
            <Icon name="alert" size={14} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>Deleting a format is manager-only. Signed in as <b>{associate().name || actorName()}</b> — Confirm will be refused if this session isn't one.</div>
          </div>}

          {state.loading && <window.SkeletonRows rows={3} />}
          {!state.loading && state.error && <window.ErrorState title="Shells didn’t load" detail={state.error} onRetry={onClose} />}

          {!state.loading && !state.error && shells.length === 0 && <window.EmptyState icon="check" title="No shells on this format" body="Nothing to reassign — deleting is safe." />}

          {!state.loading && !state.error && shells.length > 0 && <>
            <div style={{ fontSize: 12.5, color: P.inkDim, marginBottom: 12 }}>Every shell needs a destination before Delete is enabled — pick one at a time or move them all at once.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '10px 12px', background: P.surface2, borderRadius: P.r10 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: P.inkDim, whiteSpace: 'nowrap' }}>Move all to&hellip;</span>
              <div style={{ flex: 1 }}>
                <DestPicker formats={formats} sameCategory={format.category} excludeId={format.id} placeholder="Choose a destination for every shell…"
                  onPick={(id) => applyMoveAll({ kind: 'existing', to_format_id: id, label: (formats.find((f) => f.id === id) || {}).name || id })}
                  onRequestNew={() => setNewFormatTarget('ALL')} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shells.map((s) => { const d = dest[s.id]; const has = !!d; return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', background: has ? P.surface : P.warnSoft, border: `1px solid ${has ? P.hairline : P.warn + '55'}`, borderRadius: P.r10 }}>
                  <span style={{ flex: '0 0 auto' }}>{has ? <Icon name="check-circle" size={16} color={P.good} /> : <Icon name="alert" size={16} color={P.warn} />}</span>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.brand_name || s.brand}</div>
                    <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 1 }}>{s.name || s.id} &middot; {s.product_count || 0} product{(s.product_count || 0) === 1 ? '' : 's'}</div>
                  </div>
                  <div style={{ flex: '1 1 240px', maxWidth: 300 }}>
                    <DestPicker formats={formats} sameCategory={format.category} excludeId={format.id}
                      value={d ? (d.kind === 'existing' ? d.to_format_id : ('new:' + s.id)) : ''}
                      extraOption={d && d.kind === 'new' ? { value: 'new:' + s.id, label: '+ ' + d.label + ' (new)' } : null}
                      placeholder="Choose a destination…"
                      onPick={(v) => v && setRowDest(s.id, { kind: 'existing', to_format_id: v, label: (formats.find((f) => f.id === v) || {}).name || v })}
                      onRequestNew={() => setNewFormatTarget(s.id)} />
                  </div>
                </div>); })}
            </div>
          </>}

          {err && !err.manager && <div style={{ marginTop: 14, padding: '11px 13px', background: P.badSoft, border: `1px solid ${P.bad}33`, borderRadius: P.r10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: P.bad }}>{err.message || 'That was refused.'}</div>
            {err.missing && err.missing.length > 0 && <div style={{ marginTop: 4, fontSize: 11.5, color: P.warnText, fontFamily: P.fontMono }}>Still missing: {err.missing.join(', ')}</div>}
          </div>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 18px', borderTop: `1px solid ${P.hairline2}` }}>
          <span style={{ fontSize: 12.5, color: reason ? P.warnText : P.inkMute }}>{reason || (shells.length > 0 ? 'Every shell has a destination.' : 'Nothing to reassign.')}</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <PBtn variant="secondary" size="lg" onClick={onClose} disabled={busy}>Cancel</PBtn>
            <PBtn variant="danger" size="lg" icon="trash" busy={busy} disabled={!canDelete} title={reason || undefined} onClick={confirm}>Delete format</PBtn>
          </div>
        </div>
      </div>
      {newFormatTarget != null && <NewFormatInline source={format} onCancel={() => setNewFormatTarget(null)}
        onCreate={(nf) => {
          if (newFormatTarget === 'ALL') applyMoveAll({ kind: 'new', new_format: nf, label: nf.name });
          else setRowDest(newFormatTarget, { kind: 'new', new_format: nf, label: nf.name });
          setNewFormatTarget(null);
        }} />}
    </div>;
  }

  // ══ LIBRARY ═══════════════════════════════════════════════════════════════
  function CategorySection({ cat, list, counts, onEdit, onDelete }) {
    const P = useP();
    const catInfo = S.catDef(cat);
    const columns = [
      { label: 'Format', render: (f) => <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{f.name}</div>
          <div style={{ fontSize: 11.5, color: P.inkMute, marginTop: 2 }}>{f.subcategory || '—'}</div>
        </div> },
      { label: 'Template', render: (f) => <TemplateChips template={f.template} size="sm" /> },
      { label: 'Default', render: (f) => <span style={{ fontFamily: P.fontMono, fontSize: 12.5, color: P.ink2 }}>
          {f.default_weight != null ? (f.default_weight + (f.default_unit || '')) : '—'}{f.default_pack ? ' · ' + f.default_pack + 'pk' : ''}
        </span> },
      { label: 'WM node', render: (f) => <span style={{ fontFamily: P.fontMono, fontSize: 11.5, color: P.inkDim }}>{f.wm_node || '—'}</span> },
      { label: 'Shells', align: 'right', render: (f) => <span style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink }}>{(counts[f.id] || {}).shells || 0}</span> },
      { label: 'Products', align: 'right', render: (f) => <span style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink }}>{(counts[f.id] || {}).products || 0}</span> },
      { label: 'Status', render: (f) => f.active ? <Pill kind="good" dot>Active</Pill> : <Pill kind="neutral" dot>Inactive</Pill> },
      { label: '', align: 'right', width: '80px', render: (f) => <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <IconBtn icon="pencil" size={14} label={'Edit ' + f.name} style={{ width: 30, height: 30 }} onClick={() => onEdit(f)} />
          <IconBtn icon="trash" size={14} label={'Delete ' + f.name} style={{ width: 30, height: 30 }} onClick={() => onDelete(f)} />
        </div> }
    ];
    return <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, marginBottom: 14, borderBottom: `1px solid ${P.hairline2}` }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: window.HW.CAT_COLOR[cat] || P.neutral }} />
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-.01em', color: P.ink }}>{catInfo.name}</h2>
        <span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>{list.length} format{list.length === 1 ? '' : 's'}</span>
      </div>
      <DataTable columns={columns} rows={list} rowKey={(f) => f.id} />
    </section>;
  }

  // ══ MODULE ════════════════════════════════════════════════════════════════
  window.ShellFormatsModule = function ShellFormatsModule() {
    const P = useP();
    const { loading, error, formats, counts, refresh } = useFormats();
    const [sheetFor, setSheetFor] = React.useState(undefined);   // undefined=closed, null=new, format=edit
    const [previewFor, setPreviewFor] = React.useState(null);    // { format, patch }
    const [deleteFor, setDeleteFor] = React.useState(null);      // format
    const [flash, setFlash] = React.useState(null);
    const flashTimer = React.useRef(null);
    React.useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);
    function showFlash(msg, tone) {
      setFlash({ msg, tone });
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlash(null), 4200);
    }

    const grouped = React.useMemo(() => {
      if (!formats) return [];
      const byCat = {};
      formats.forEach((f) => { (byCat[f.category] = byCat[f.category] || []).push(f); });
      const order = S.TAX.map((c) => c.key);
      return Object.keys(byCat)
        .sort((a, b) => ((order.indexOf(a) + 1) || 99) - ((order.indexOf(b) + 1) || 99) || a.localeCompare(b))
        .map((cat) => ({ cat, list: byCat[cat].slice().sort((a, b) => ((a.sort || 0) - (b.sort || 0)) || a.name.localeCompare(b.name)) }));
    }, [formats]);

    const totalShells = Object.values(counts || {}).reduce((n, c) => n + (c.shells || 0), 0);
    const totalProducts = Object.values(counts || {}).reduce((n, c) => n + (c.products || 0), 0);

    return <div>
      <SectionHead level={1} eyebrow="Master Catalog" title="Formats"
        subtitle={(formats ? formats.length : 0) + ' formats · ' + totalShells + ' shells · ' + totalProducts + ' products across the line'}
        action={<PBtn variant="accent" size="md" icon="plus" onClick={() => setSheetFor(null)}>Add Format</PBtn>} />

      {loading && <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {[0, 1].map((i) => <Card key={i} padding={0}>
          <div style={{ padding: '13px 16px', borderBottom: `1px solid ${P.hairline}` }}><window.Skeleton w={160} h={14} /></div>
          <div style={{ padding: 16 }}><window.SkeletonRows rows={3} avatar={false} /></div>
        </Card>)}
      </div>}

      {!loading && error && <Card padding={0}><window.ErrorState title="Formats didn’t load" body="The naming template list didn’t come back. Nothing was changed — try again, and if it keeps failing tell an admin." detail={error} onRetry={refresh} /></Card>}

      {!loading && !error && (!formats || formats.length === 0) && <Card padding={0}>
        <window.EmptyState icon="layout-template" title="No formats yet" body="A format is the naming template a shell picks from — create the first one before shells can derive product names."
          action={<PBtn variant="accent" icon="plus" onClick={() => setSheetFor(null)}>Add Format</PBtn>} />
      </Card>}

      {!loading && !error && formats && formats.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {grouped.map((g) => <CategorySection key={g.cat} cat={g.cat} list={g.list} counts={counts} onEdit={setSheetFor} onDelete={setDeleteFor} />)}
      </div>}

      {sheetFor !== undefined && <FormatSheet editing={sheetFor} formats={formats || []} counts={counts}
        onClose={() => setSheetFor(undefined)}
        onSaved={(fmt, warnings) => { setSheetFor(undefined); refresh(); showFlash(warnings && warnings.length ? ('Saved “' + fmt.name + '” with ' + warnings.length + ' warning' + (warnings.length > 1 ? 's' : '') + '.') : ('Saved “' + fmt.name + '”.')); }}
        onNeedsPreview={(fmt, patch) => { setSheetFor(undefined); setPreviewFor({ format: fmt, patch }); }} />}

      {previewFor && <PreviewModal format={previewFor.format} patch={previewFor.patch} formats={formats || []}
        onClose={() => setPreviewFor(null)}
        onApplied={(res) => { setPreviewFor(null); refresh(); showFlash('Renamed ' + (res.renamed || 0) + ' · moved ' + (res.moved || 0) + '.'); }} />}

      {deleteFor && <ReassignModal format={deleteFor} formats={formats || []}
        onClose={() => setDeleteFor(null)}
        onDeleted={(res) => { setDeleteFor(null); refresh(); showFlash('Deleted. ' + (res.moved_shells || 0) + ' shells and ' + (res.moved_products || 0) + ' products moved.'); }} />}

      {flash && <div style={{ position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', padding: '10px 16px', background: P.ink, color: P.surface, borderRadius: 99, fontSize: 12.5, fontWeight: 600, boxShadow: P.shadowLg, zIndex: P.z.toast, whiteSpace: 'nowrap', maxWidth: '86vw', overflow: 'hidden', textOverflow: 'ellipsis' }}>{flash.msg}</div>}
    </div>;
  };

  // ── openNew({ category, subcategory, onSaved }) ─────────────────────────
  // The "+ New format" hook pos/shell-form.jsx calls from the shell form's
  // format picker (plan §4: "'+ New format' opens the format sheet inline").
  // This module's own component (above) is only mounted on the Catalog →
  // Formats screen, but a shell can be created from other screens too — so
  // this mounts a ONE-OFF FormatSheet into its own detached root rather than
  // requiring ShellFormatsModule to already be on screen. onSaved(format) is
  // called after a real save so the caller (shell-form.jsx) can refresh its
  // format list and select the new one immediately, with no page reload.
  window.ShellFormatsModule.openNew = function openNew(opts) {
    opts = opts || {};
    const category = opts.category || 'Flower';
    const c = S.catDef(category);
    const initialDraft = Object.assign(blankFormatDraft(), {
      category, subcategory: opts.subcategory || c.subs[0],
      default_unit: c.unit, wm_node: c.wm
    });

    const host = document.createElement('div');
    host.setAttribute('data-hw-shell-format-standalone', '');
    document.body.appendChild(host);
    const root = ReactDOM.createRoot(host);
    function teardown() {
      try { root.unmount(); } catch (e) { /* already gone */ }
      host.remove();
    }
    root.render(<FormatSheet
      editing={null} formats={[]} counts={{}} initialDraft={initialDraft}
      onClose={teardown}
      onSaved={(fmt) => { teardown(); if (typeof opts.onSaved === 'function') opts.onSaved(fmt); }}
      // A brand-new format never ripples (editing is null, so FormatSheet's
      // own save() never routes here) — kept only so a future refactor of
      // FormatSheet can't silently swallow an unhandled call.
      onNeedsPreview={teardown}
    />);
  };
})();
