// ── Product detail sheet (register) ─────────────────────────────────────────
// What a budtender needs while a customer is standing in front of them: what it
// is, what it does, what's actually on the shelf, and whether they can hand it
// over today. Deliberately NOT the catalog editor — nothing here is editable.
const useP = window.useP;

const EFFECTS_BY_STRAIN = { Indica: ['Relaxed', 'Sleepy', 'Calm', 'Body high'], Sativa: ['Energetic', 'Uplifted', 'Focused', 'Creative'], Hybrid: ['Balanced', 'Happy', 'Creative', 'Social'], CBD: ['Clear-headed', 'Calm', 'Low-key'] };
// TERP_LIST and TASTE were deleted with the hash that indexed them. They are
// not left here unused: a list of plausible terpenes sitting one line above a
// SKU hash is how this defect gets reintroduced by the next person who needs
// "something to show". A real profile arrives as a product field, not a table.

window.ProductSheet = function ProductSheet({ p, inCart, onAdd, onClose }) {
  const P = useP();
  const money = window.HW.fmt.money;
  // ══ THE BATCH TABLE WAS A CHARACTER SUM OF THE SKU ═════════════════════════
  //
  // 🔴 `h = sku.split('').reduce((a,c)=>a+c.charCodeAt(0),0)` produced, on the
  // sheet a budtender reads with a customer in front of them:
  //
  //     batchCount 2 + h % 3                       how many lots are on the shelf
  //     b.id       'B-' + sku.slice(0,4) + …       a lot number
  //     b.qty      qty/batchCount + (bh % 7) - 3   units in that lot
  //     b.thc      +(19 + bh % 110 / 10)           POTENCY, per lot
  //     b.cbd      +(bh % 13 / 10)                 potency, per lot
  //     b.exp      ['Jun 2','Jun 9',…][bh % 4]     an EXPIRY DATE
  //     b.coa      bh % 9 === 0 ? 'Pending' : 'Passed'   a LAB RESULT
  //     cbd        h % 4 === 0 ? … : 0.1           the sheet's CBD headline
  //     terps      TERP_LIST[h % 6] …              "Dominant: Myrcene"
  //     tastes     TASTE[h % 8] …
  //
  // Fabricated lot numbers, fabricated per-lot potency, a fabricated expiry and
  // a green "COA · Passed" pill — the exact class of claim (METRC ids, COA
  // links, potency values) this codebase has already deleted elsewhere, still
  // rendering here, under a caption instructing the operator to QUOTE IT:
  // "quote the figure from the batch you actually hand over".
  //
  // THERE ARE NO BATCHES. GET /api/state serves a `batches` key and it is an
  // EMPTY ARRAY — 0 rows, verified 2026-08-27 — and shared/hw-live.js never
  // attaches it to a product, so no SKU in this estate has ever been handed a
  // lot. pos/screen-catalog.jsx says the same thing in its own header. The
  // terpene profile went the same way on that screen ("TERP_INFO / TERP_RANK /
  // TerpRow went with the seed"); this is the copy that was missed.
  //
  // Nothing is substituted. `p.thc` is a real catalogue field and stays; every
  // per-lot figure is gone and the section says why.
  const effects = (EFFECTS_BY_STRAIN[p.strain] || EFFECTS_BY_STRAIN.Hybrid).slice(0, 3);
  const cbd = p.cbd != null ? p.cbd : null;
  const perGram = p.wt && /g$/.test(p.wt) ? p.price / (parseFloat(p.wt) || 1) : null;
  const lowStock = p.qty < 10;

  const Sec = ({ icon, title, right, children }) => <div style={{ border: `1px solid ${P.hairline}`, borderRadius: P.r12, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}>
      <Icon name={icon} size={13} stroke={1.9} color={P.ink2} />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: P.ink, flex: 1 }}>{title}</span>{right}
    </div>
    <div style={{ padding: 12 }}>{children}</div>
  </div>;
  const Chip = ({ children, color }) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, background: (color || P.ink2) + '18', color: color || P.ink2, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</span>;

  return ReactDOM.createPortal(
    <div onClick={onClose} style={{ ...window.overlayScrim(P, { z: 240, padding: '36px 20px' }), fontFamily: P.fontSans }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...window.overlayCard, width: 'min(720px,96vw)', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r16, boxShadow: P.shadowLg, overflow: 'hidden' }} data-tour="product-sheet">
        {/* Header — identity at a glance */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px', borderBottom: `1px solid ${P.hairline}` }}>
          <Thumb item={p} size={72} radius={12} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: P.inkMute, fontFamily: P.fontMono }}>{p.brand}</span>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: window.HW.CAT_COLOR[p.cat] || P.ink2, background: (window.HW.CAT_COLOR[p.cat] || P.ink2) + '1f', borderRadius: 5, padding: '2px 7px' }}>{p.cat}</span>
              {p.strain && <StrainPill type={p.strain} thc={p.thc} />}
            </div>
            <div style={{ fontSize: 21, fontWeight: 800, color: P.ink, letterSpacing: '-.015em', lineHeight: 1.2, marginTop: 3 }}>{p.name}</div>
            <div style={{ fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono, marginTop: 3 }}>{p.sku}{p.wt ? ' · ' + p.wt : ''}{perGram ? ' · ' + money(perGram) + '/g' : ''}</div>
          </div>
          <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
            {p.was && <div style={{ fontSize: 12.5, color: P.inkFaint, textDecoration: 'line-through', fontFamily: P.fontMono }}>{money(p.was)}</div>}
            <div style={{ fontSize: 30, fontWeight: 800, color: p.was ? P.bad : P.ink, fontFamily: P.fontMono, lineHeight: 1.1 }}>{money(p.price)}</div>
            {p.was && <div style={{ fontSize: 11.5, fontWeight: 800, color: P.bad }}>SAVE {money(p.was - p.price)}</div>}
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
            <div style={{ fontSize: 12.5, color: P.ink2, lineHeight: 1.6, marginBottom: 11 }}>
              {p.name} from {p.brand} — a {(p.strain || 'hybrid').toLowerCase()} {p.cat.toLowerCase().replace(/s$/, '')} testing at {p.thc != null ? p.thc + '% THC' : 'lab-verified potency'}. Small-batch, lab-tested for potency and purity, and ready for the display case or the online menu.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div><div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 5 }}>Reported effects</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{effects.map((e) => <Chip key={e} color={P.good}>{e}</Chip>)}</div></div>
              <div><div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute, marginBottom: 5 }}>Tastes like</div>
                <div style={{ fontSize: 11.5, color: P.inkMute }}>No tasting notes are recorded for this product.</div></div>
            </div>
          </Sec>

          {/* Potency + terps */}
          <Sec icon="lightning" title="Potency & terpenes">
            <div style={{ display: 'flex', gap: 9, marginBottom: 11 }}>
              {[['THC', p.thc != null ? p.thc + '%' : 'not recorded', p.thc != null ? P.ink : P.inkFaint],
                ['CBD', cbd != null ? cbd + '%' : 'not recorded', cbd != null ? P.ink2 : P.inkFaint]].map(([k, v, c]) =>
                <div key={k} style={{ flex: 1, padding: '9px 11px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>{k}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: c, fontFamily: P.fontMono, marginTop: 1 }}>{v}</div>
                </div>)}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11.5, color: P.inkMute, lineHeight: 1.5 }}>
              <Icon name="info" size={13} stroke={1.9} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
              <span>No terpene profile is recorded for this product. The three terpenes that used to sit here — one of them ranked top of the profile — were chosen from a fixed list by the character sum of the SKU, so they described the spelling of the SKU and not the product.</span>
            </div>
          </Sec>

          {/* Selling points */}
          <div style={{ gridColumn: '1/-1' }}>
            <Sec icon="star" title="Talking points" right={<span style={{ fontSize: 11.5, color: P.inkMute }}>for the counter</span>}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 9 }}>
                {[['Pairs well with', 'A ' + (p.cat === 'Flower' ? 'pre-roll cone or grinder' : p.cat === 'Vapes' ? '510 battery' : 'lower-dose companion'), 'link'],
                  ['Good for', effects[0].toLowerCase() + ' evenings · ' + (p.strain === 'Sativa' ? 'daytime use' : 'winding down'), 'user-check'],
                  [p.was ? 'On sale' : 'Value', p.was ? money(p.was - p.price) + ' off — ends Sunday' : perGram ? money(perGram) + ' per gram' : 'Everyday price', 'tag']].map(([k, v, ic]) =>
                  <div key={k} style={{ display: 'flex', gap: 9, padding: '10px 11px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
                    <Icon name={ic} size={14} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
                    <div><div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>{k}</div><div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45, marginTop: 1 }}>{v}</div></div>
                  </div>)}
              </div>
            </Sec>
          </div>
          {/* Availability — the thing that decides whether they can sell it */}
          <div style={{ gridColumn: '1/-1' }}>
            <Sec icon="package" title="On the shelf" right={<span style={{ fontSize: 11.5, fontWeight: 700, color: lowStock ? P.warn : P.good, fontFamily: P.fontMono }}>{p.qty} in stock</span>}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(104px,1fr))', gap: 9 }}>
                {[['Available now', p.qty + ' units', lowStock ? P.warn : P.good],
                  ['Active batch', 'not tracked', P.inkFaint],
                  ['THC on shelf', p.thc != null ? p.thc + '% (catalogue)' : 'not recorded', p.thc != null ? P.ink : P.inkFaint],
                  ['Expires', 'not tracked', P.inkFaint]].map(([k, v, c]) =>
                  <div key={k} style={{ padding: '9px 11px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>{k}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: c, fontFamily: P.fontMono, marginTop: 2 }}>{v}</div>
                  </div>)}
              </div>
              {lowStock && <div style={{ display: 'flex', gap: 7, marginTop: 10, padding: '8px 11px', background: P.warnSoft, borderRadius: P.r10, fontSize: 11.5, color: P.ink2 }}>
                <Icon name="shield" size={13} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />Low stock — check with a manager before promising more than {p.qty}.
              </div>}
            </Sec>
          </div>

          {/* ── Batches: THERE ARE NONE, AND THAT IS THE STATEMENT ────────── */}
          <div style={{ gridColumn: '1/-1' }}>
            <Sec icon="list" title="Batches available" right={<span style={{ fontSize: 11.5, color: P.inkMute, fontFamily: P.fontMono }}>0 lots held</span>}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '11px 12px', background: P.warnSoft, border: `1px solid ${P.hairline}`, borderRadius: P.r10 }}>
                <Icon name="alert" size={14} stroke={2} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
                <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.5 }}>
                  <b>No batch is tracked for this SKU.</b> This table used to list lot
                  numbers, per-lot units, per-lot THC and CBD, an expiry date and a
                  green <b>COA verdict</b> pill — all of it computed from the
                  character codes of the SKU, none of it read from anywhere.
                  <div style={{ marginTop: 6 }}>
                    Quote the potency on the package in your hand. Do not quote a figure
                    from this screen as a lot result: this build holds none.
                  </div>
                </div>
              </div>
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
