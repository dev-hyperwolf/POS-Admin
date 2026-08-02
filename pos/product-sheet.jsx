// ── Product detail sheet (register) ─────────────────────────────────────────
// What a budtender needs while a customer is standing in front of them: what it
// is, what it does, what's actually on the shelf, and whether they can hand it
// over today. Deliberately NOT the catalog editor — nothing here is editable.
const useP = window.useP;

const EFFECTS_BY_STRAIN = { Indica: ['Relaxed', 'Sleepy', 'Calm', 'Body high'], Sativa: ['Energetic', 'Uplifted', 'Focused', 'Creative'], Hybrid: ['Balanced', 'Happy', 'Creative', 'Social'], CBD: ['Clear-headed', 'Calm', 'Low-key'] };
const TERP_LIST = [['Myrcene', 'Earthy · musky', '#8A5CD6'], ['Limonene', 'Citrus · zesty', '#D9A21C'], ['Caryophyllene', 'Peppery · spicy', '#D2483F'], ['Pinene', 'Pine · herbal', '#3DA35D'], ['Linalool', 'Floral · lavender', '#8E7BE0'], ['Terpinolene', 'Fruity · fresh', '#21A89B']];
const TASTE = ['Citrus', 'Pine', 'Berry', 'Diesel', 'Sweet cream', 'Earthy', 'Gassy', 'Vanilla'];

window.ProductSheet = function ProductSheet({ p, inCart, onAdd, onClose }) {
  const P = useP();
  const money = window.HW.fmt.money;
  const h = p.sku.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const effects = (EFFECTS_BY_STRAIN[p.strain] || EFFECTS_BY_STRAIN.Hybrid).slice(0, 3);
  const terps = [TERP_LIST[h % 6], TERP_LIST[(h + 2) % 6], TERP_LIST[(h + 4) % 6]];
  const tastes = [TASTE[h % 8], TASTE[(h + 3) % 8]];
  const cbd = h % 4 === 0 ? +(0.4 + h % 2).toFixed(1) : 0.1;
  const perGram = p.wt && /g$/.test(p.wt) ? p.price / (parseFloat(p.wt) || 1) : null;
  // Batches physically on the shelf for this SKU — FIFO, oldest sells first.
  const batchCount = 2 + h % 3;
  const batches = Array.from({ length: batchCount }).map((_, i) => {const bh = h + i * 97;
    return { id: 'B-' + p.sku.slice(0, 4) + '-' + (2400 + (h + i * 13) % 140),
      qty: Math.max(1, Math.round(p.qty / batchCount) + (bh % 7) - 3),
      thc: +(19 + bh % 110 / 10).toFixed(1), cbd: +(bh % 13 / 10).toFixed(1),
      exp: ['Jun 2', 'Jun 9', 'May 28', 'Jun 14'][bh % 4] + ', 2027',
      arrived: ['2 days ago', '1 week ago', '3 weeks ago', 'Today'][bh % 4],
      coa: bh % 9 === 0 ? 'Pending' : 'Passed' };});
  const active = batches[0];
  const lowStock = p.qty < 10;

  const Sec = ({ icon, title, right, children }) => <div style={{ border: `1px solid ${P.hairline}`, borderRadius: P.r12, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}>
      <Icon name={icon} size={13} stroke={1.9} color={P.ink2} />
      <span style={{ fontSize: 12, fontWeight: 700, color: P.ink, flex: 1 }}>{title}</span>{right}
    </div>
    <div style={{ padding: 12 }}>{children}</div>
  </div>;
  const Chip = ({ children, color }) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, background: (color || P.ink2) + '18', color: color || P.ink2, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</span>;

  return ReactDOM.createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 240, background: P.scrim, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '36px 20px', overflowY: 'auto', fontFamily: P.fontSans }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(720px,96vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }} data-tour="product-sheet">
        {/* Header — identity at a glance */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px', borderBottom: `1px solid ${P.hairline}` }}>
          <Thumb item={p} size={72} radius={12} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: P.inkMute, fontFamily: P.fontMono }}>{p.brand}</span>
              <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: window.HW.CAT_COLOR[p.cat] || P.ink2, background: (window.HW.CAT_COLOR[p.cat] || P.ink2) + '1f', borderRadius: 5, padding: '2px 7px' }}>{p.cat}</span>
              {p.strain && <StrainPill type={p.strain} thc={p.thc} />}
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, color: P.ink, letterSpacing: '-.015em', lineHeight: 1.2, marginTop: 3 }}>{p.name}</div>
            <div style={{ fontSize: 11, color: P.inkDim, fontFamily: P.fontMono, marginTop: 3 }}>{p.sku}{p.wt ? ' · ' + p.wt : ''}{perGram ? ' · ' + money(perGram) + '/g' : ''}</div>
          </div>
          <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
            {p.was && <div style={{ fontSize: 12, color: P.inkFaint, textDecoration: 'line-through', fontFamily: P.fontMono }}>{money(p.was)}</div>}
            <div style={{ fontSize: 26, fontWeight: 800, color: p.was ? P.bad : P.ink, fontFamily: P.fontMono, lineHeight: 1.1 }}>{money(p.price)}</div>
            {p.was && <div style={{ fontSize: 10.5, fontWeight: 800, color: P.bad }}>SAVE {money(p.was - p.price)}</div>}
          </div>
          <IconBtn icon="x" size={17} onClick={onClose} />
        </div>

        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxHeight: '60vh', overflowY: 'auto' }}>
          {/* Photos */}
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ flex: 1, height: 118, borderRadius: P.r12, overflow: 'hidden', border: `1px solid ${P.hairline2}`, background: `linear-gradient(140deg, hsl(${p.hue || 120} 34% ${P.mode === 'dark' ? 24 : 82}%), hsl(${((p.hue || 120) + 26) % 360} 30% ${P.mode === 'dark' ? 16 : 70}%))`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <Icon name={i === 0 ? 'package' : i === 1 ? 'leaf' : 'scan'} size={30} stroke={1.4} color={P.mode === 'dark' ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.85)'} />
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '6px 9px', background: 'linear-gradient(transparent, rgba(0,0,0,.5))', fontSize: 10, fontWeight: 700, color: '#fff' }}>{['Product', 'Macro', 'Label'][i]}</span>
            </div>)}
          </div>

          {/* What it is */}
          <Sec icon="leaf" title="About this product">
            <div style={{ fontSize: 12, color: P.ink2, lineHeight: 1.6, marginBottom: 11 }}>
              {p.name} from {p.brand} — a {(p.strain || 'hybrid').toLowerCase()} {p.cat.toLowerCase().replace(/s$/, '')} testing at {p.thc != null ? p.thc + '% THC' : 'lab-verified potency'}. Small-batch, lab-tested for potency and purity, and ready for the display case or the online menu.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div><div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 5 }}>Reported effects</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{effects.map((e) => <Chip key={e} color={P.good}>{e}</Chip>)}</div></div>
              <div><div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 5 }}>Tastes like</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{tastes.map((t) => <Chip key={t}>{t}</Chip>)}</div></div>
            </div>
          </Sec>

          {/* Potency + terps */}
          <Sec icon="lightning" title="Potency & terpenes">
            <div style={{ display: 'flex', gap: 9, marginBottom: 11 }}>
              {[['THC', (p.thc != null ? p.thc : '—') + '%', P.ink], ['CBD', cbd + '%', P.ink2]].map(([k, v, c]) =>
                <div key={k} style={{ flex: 1, padding: '9px 11px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
                  <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>{k}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: c, fontFamily: P.fontMono, marginTop: 1 }}>{v}</div>
                </div>)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {terps.map((t, i) => <div key={t[0]} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: t[2], flex: '0 0 auto' }} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 700, color: P.ink }}>{t[0]}</div><div style={{ fontSize: 10.5, color: P.inkMute }}>{t[1]}</div></div>
                <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: i === 0 ? P.mode === 'dark' ? P.accent : '#7A5A00' : P.inkMute, background: i === 0 ? P.accentSoft : P.surface3, borderRadius: 6, padding: '3px 8px' }}>{['Dominant', 'Secondary', 'Present'][i]}</span>
              </div>)}
            </div>
          </Sec>

          {/* Selling points */}
          <div style={{ gridColumn: '1/-1' }}>
            <Sec icon="star" title="Talking points" right={<span style={{ fontSize: 10.5, color: P.inkMute }}>for the counter</span>}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 9 }}>
                {[['Pairs well with', 'A ' + (p.cat === 'Flower' ? 'pre-roll cone or grinder' : p.cat === 'Vapes' ? '510 battery' : 'lower-dose companion'), 'link'],
                  ['Good for', effects[0].toLowerCase() + ' evenings · ' + (p.strain === 'Sativa' ? 'daytime use' : 'winding down'), 'user-check'],
                  [p.was ? 'On sale' : 'Value', p.was ? money(p.was - p.price) + ' off — ends Sunday' : perGram ? money(perGram) + ' per gram' : 'Everyday price', 'tag']].map(([k, v, ic]) =>
                  <div key={k} style={{ display: 'flex', gap: 9, padding: '10px 11px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
                    <Icon name={ic} size={14} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
                    <div><div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>{k}</div><div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45, marginTop: 1 }}>{v}</div></div>
                  </div>)}
              </div>
            </Sec>
          </div>
          {/* Availability — the thing that decides whether they can sell it */}
          <div style={{ gridColumn: '1/-1' }}>
            <Sec icon="package" title="On the shelf" right={<span style={{ fontSize: 11, fontWeight: 700, color: lowStock ? P.warn : P.good, fontFamily: P.fontMono }}>{p.qty} in stock</span>}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(104px,1fr))', gap: 9 }}>
                {[['Available now', p.qty + ' units', lowStock ? P.warn : P.good], ['Active batch', active.id, P.ink], ['THC on shelf', active.thc + '%', P.ink], ['Expires', active.exp, P.ink2]].map(([k, v, c]) =>
                  <div key={k} style={{ padding: '9px 11px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
                    <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>{k}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: c, fontFamily: P.fontMono, marginTop: 2 }}>{v}</div>
                  </div>)}
              </div>
              {lowStock && <div style={{ display: 'flex', gap: 7, marginTop: 10, padding: '8px 11px', background: P.warnSoft, borderRadius: P.r10, fontSize: 11.5, color: P.ink2 }}>
                <Icon name="shield" size={13} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />Low stock — check with a manager before promising more than {p.qty}.
              </div>}
            </Sec>
          </div>

          {/* Batches */}
          <div style={{ gridColumn: '1/-1' }}>
            <Sec icon="list" title="Batches available" right={<span style={{ fontSize: 10.5, color: P.inkMute, fontFamily: P.fontMono }}>FIFO · oldest sells first</span>}>
              <div style={{ border: `1px solid ${P.hairline}`, borderRadius: P.r10, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .6fr .6fr .6fr .9fr .7fr', gap: 10, padding: '7px 11px', background: P.surface2, fontSize: 8.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkMute }}>
                  <span>Batch</span><span style={{ textAlign: 'right' }}>Units</span><span style={{ textAlign: 'right' }}>THC</span><span style={{ textAlign: 'right' }}>CBD</span><span>Expires</span><span>COA</span>
                </div>
                {batches.map((b, i) => <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '1.1fr .6fr .6fr .6fr .9fr .7fr', gap: 10, alignItems: 'center', padding: '9px 11px', borderTop: `1px solid ${P.hairline}`, background: i === 0 ? P.accentSoft : 'transparent' }}>
                  <span style={{ fontFamily: P.fontMono, fontSize: 11, fontWeight: 700, color: P.ink }}>{b.id}{i === 0 && <span style={{ display: 'block', fontSize: 8.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: P.mode === 'dark' ? P.accent : '#7A5A00' }}>selling now</span>}</span>
                  <span style={{ textAlign: 'right', fontFamily: P.fontMono, fontSize: 11.5, color: P.ink2 }}>{b.qty}</span>
                  <span style={{ textAlign: 'right', fontFamily: P.fontMono, fontSize: 11.5, fontWeight: 600, color: P.ink }}>{b.thc}%</span>
                  <span style={{ textAlign: 'right', fontFamily: P.fontMono, fontSize: 11.5, color: P.inkDim }}>{b.cbd}%</span>
                  <span style={{ fontSize: 10.5, color: P.inkDim, fontFamily: P.fontMono }}>{b.exp}</span>
                  <span>{b.coa === 'Passed' ? <Pill kind="good" dot>Passed</Pill> : <Pill kind="warn" dot>Pending</Pill>}</span>
                </div>)}
              </div>
              <div style={{ fontSize: 10.5, color: P.inkMute, marginTop: 8, lineHeight: 1.45 }}>Potency varies per batch — quote the figure from the batch you actually hand over, not the product average.</div>
            </Sec>
          </div>

        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderTop: `1px solid ${P.hairline}`, background: P.surface2 }}>
          <span style={{ fontSize: 11.5, color: P.inkDim }}>{inCart ? inCart + ' already in this cart' : 'Not in the cart yet'}</span>
          <div style={{ flex: 1 }} />
          <PBtn variant="secondary" size="md" onClick={onClose}>Close</PBtn>
          <PBtn variant="accent" size="md" icon="plus" onClick={() => {onAdd && onAdd();onClose();}}>Add to cart · {money(p.price)}</PBtn>
        </div>
      </div>
    </div>, document.body);
};

Object.assign(window, {});
