// ── Studio — live board of every card, with real editing ────────────────────
const useP = window.useP;
const { useState, useMemo } = React;
const ST = window.PROMO;

const CARDS = [
{ id: 'home_hero', label: 'Home hero', device: 'both' },
{ id: 'weekly_deal', label: 'Weekly deal board', device: 'both' },
{ id: 'hero_deal', label: 'Hero + deal (hybrid)', device: 'both' },
{ id: 'home_takeover', label: 'Home takeover', device: 'both' },
{ id: 'home_banner', label: 'Home banner', device: 'both' },
{ id: 'category_banner', label: 'Category banner', device: 'both' },
{ id: 'shop_tile', label: 'Shop grid', device: 'both' },
{ id: 'brand_takeover', label: 'Brand page', device: 'both' },
{ id: 'cart', label: 'Cart drawer', device: 'mobile' },
{ id: 'loyalty', label: 'Rewards', device: 'mobile' }];

const cardMeta = (id) => CARDS.find((c) => c.id === id) || CARDS[0];

// where each surface appears in the shopper app — shown in the inspector
const SURFACE_USE = {
  home_hero: 'The big takeover at the top of the app home. One hero shows at a time; its inner tiles deep-link to filtered shops.',
  weekly_deal: 'One creative board that rolls every brand deal of the week into a single home feature, grouped by category.',
  hero_deal: 'Hybrid — one promo’s hero creative on top, the full weekly category board beneath it.',
  home_takeover: 'Full-screen interstitial shown on app open for a marquee promo.',
  home_banner: 'Slim banner in the home feed; up to 3 rotate as a carousel by priority.',
  category_banner: 'A banner inside specific category pages (Flower, Vape…), between product rows. Targeting set below.',
  shop_tile: 'A promo card mixed into the shop product grid — every matching promo gets its own tile, no cap. (A category banner is the full-width version pinned to one category page; a shop tile is a single card among products.)',
  brand_takeover: 'Themes the top of a brand’s page; one promo per brand.',
  cart: 'The applied-savings line and upsell inside the cart / checkout drawer.',
  loyalty: 'Lives in the Rewards / points hub; controls points multipliers and redemptions.' };

const fldSm = (P) => ({ width: '100%', padding: '8px 10px', borderRadius: P.r10, border: `1px solid ${P.fieldBorder}`, background: P.field, color: P.ink, fontSize: 12.5, fontFamily: P.fontSans, outline: 'none' });

// which shopper-app pages each surface renders on — chips under the descriptor
const SURFACE_WHERE = {
  home_hero: ['Home'], weekly_deal: ['Home'], hero_deal: ['Home'],
  home_takeover: ['App open'], home_banner: ['Home'],
  category_banner: ['Category pages'], shop_tile: ['Shop grid'],
  brand_takeover: ['Brand pages'], cart: ['Cart', 'Checkout'], loyalty: ['Rewards'] };

// Home hero vs Weekly deal board — both live on Home; clarify roles + conflict
const HERO_VS_BOARD = {
  home_hero: 'Home hero is the single big takeover at the very top of Home — one promo (with hand-picked deep-link tiles under it). The Weekly deal board is the auto-generated block below it that lists every staged brand deal by category.',
  weekly_deal: 'The Weekly deal board is the auto-generated block on Home that lists every staged brand deal by category. The Home hero is the single big takeover above it, showing one promo with hand-picked tiles.' };
const CONFLICT_NOTE = 'They don’t fight for a slot — the hero owns the top, the board sits below it. If the same promo is in both, a shopper sees it twice on Home (once as the hero, once as a board row). Keep the hero for your one headline deal and let the board carry the rest.';

// Deal-board configurator — brands grouped by category (mirrors the output),
// per-brand include toggle + offer, per-category select-all, and bulk actions.
function DealBoardConfig({ dealOn, setDealOn, toggleDeal, copy, setCopy, week, setWeek, showCopy }) {
  const P = useP();
  const BR = window.WEEKLY_BR || [];
  const CATS = (window.WEEKLY_CATS || []).filter((c) => BR.some((b) => b.cat === c));
  const CC = window.WEEKLY_CAT_COLOR || {};
  const allIds = BR.map((b) => b.id);
  const setMany = (ids, on) => setDealOn((prev) => {const n = new Set(prev);ids.forEach((id) => on ? n.add(id) : n.delete(id));return n;});
  const fld = fldSm(P);
  const lbl = { fontSize: 11.5, fontWeight: 600, color: P.inkMute, marginBottom: 4, fontFamily: P.fontMono, letterSpacing: '.04em', textTransform: 'uppercase' };
  return <div style={{ marginBottom: 16 }}>
    {showCopy && <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink2, marginBottom: 9 }}>Board copy</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div><div style={lbl}>Eyebrow</div><input value={copy.eyebrow} onChange={(e) => setCopy((c) => ({ ...c, eyebrow: e.target.value }))} style={fld} /></div>
        <div><div style={lbl}>Headline</div><input value={copy.headline} onChange={(e) => setCopy((c) => ({ ...c, headline: e.target.value }))} style={fld} /></div>
        <div><div style={lbl}>Subhead</div><input value={copy.subhead} placeholder={`${dealOn.size} brands · every category marked down`} onChange={(e) => setCopy((c) => ({ ...c, subhead: e.target.value }))} style={fld} /></div>
        <div><div style={lbl}>Week label</div><input value={week} onChange={(e) => setWeek(e.target.value)} style={fld} /></div>
      </div>
      <div style={{ height: 1, background: P.hairline, margin: '16px 0 0' }} />
    </div>}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, marginTop: showCopy ? 14 : 0 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink2 }}>Deal board contents</div>
      <span style={{ fontSize: 11.5, fontWeight: 700, fontFamily: P.fontMono, color: P.accentText }}>{dealOn.size} of {BR.length} staged</span>
    </div>
    <div style={{ fontSize: 11.5, color: P.inkDim, marginBottom: 10, lineHeight: 1.5 }}>Choose which brand promotions compose the board — grouped by the category they render into. The preview updates live.</div>
    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
      <button onClick={() => setMany(allIds, true)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: `1px solid ${P.hairline2}`, background: P.surface, color: P.ink, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans }}>Select all</button>
      <button onClick={() => setMany(allIds, false)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: `1px solid ${P.hairline2}`, background: P.surface, color: P.ink2, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans }}>Clear all</button>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {CATS.map((cat) => {
        const rows = BR.filter((b) => b.cat === cat);const ids = rows.map((b) => b.id);const cc = CC[cat] || P.ink;
        const onCount = rows.filter((b) => dealOn.has(b.id)).length;const allOn = onCount === rows.length;
        return <div key={cat} style={{ borderRadius: P.r12, border: `1px solid ${P.hairline2}`, borderLeft: `3px solid ${cc}`, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: cc, fontFamily: P.fontMono, flex: 1 }}>{cat.toUpperCase()}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, fontFamily: P.fontMono, color: P.inkFaint }}>{onCount}/{rows.length}</span>
            <button onClick={() => setMany(ids, !allOn)} style={{ padding: '2px 8px', borderRadius: 99, border: `1px solid ${P.hairline2}`, background: 'transparent', color: P.ink2, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans }}>{allOn ? 'None' : 'All'}</button>
          </div>
          {rows.map((b) => {const on = dealOn.has(b.id);const co = window.dayCallout && window.dayCallout(b.days, window.WM_TODAY_DOW);const lt = co && { today: { background: '#FDECEA', color: '#D2483F' }, soon: { background: '#FBF3D6', color: '#8A6200' }, past: { background: P.surface3, color: P.inkFaint }, range: { background: P.surface3, color: P.inkDim } }[co.tone];return <button key={b.id} onClick={() => toggleDeal(b.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 11px', border: 'none', borderTop: `1px solid ${P.hairline}`, background: on ? P.surface : P.surface3, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans, opacity: on ? 1 : .6 }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, flex: '0 0 auto', background: window.weeklyGrad ? window.weeklyGrad(b.hue, P.mode === 'dark') : `hsl(${b.hue} 55% 50%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', fontFamily: P.fontMono }}>{b.name[0]}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: P.ink, lineHeight: 1.2 }}>{b.name}</span>
            {co && <span style={{ fontSize: 10, fontWeight: 800, fontFamily: P.fontMono, letterSpacing: '.03em', padding: '2px 6px', borderRadius: 5, whiteSpace: 'nowrap', ...lt }}>{co.text}</span>}
            <span style={{ fontSize: 11.5, fontWeight: 800, fontFamily: P.fontMono, color: P.accentText, whiteSpace: 'nowrap' }}>{b.badge.replace(' OFF', '')}</span>
            <span style={{ width: 18, height: 18, borderRadius: 5, flex: '0 0 auto', border: `1.5px solid ${on ? P.ink : P.hairline3}`, background: on ? P.ink : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on && <Icon name="check" size={12} stroke={3} color={P.surface} />}</span>
          </button>;})}
        </div>;
      })}
    </div>
  </div>;
}

const CART_VARIANTS = [
'Classic drawer — items, applied promo, total',
'Summary-first — big total & savings up top',
'Progress to reward — spend-more bar',
'Coupon-forward — code field + applied chip',
'Line-item savings — was/now per item',
'Compact dense — tight list, accent total',
'Upsell — “frequently added” strip',
'Split totals — itemized summary card',
'Rewards-integrated — points earned callout',
'Express checkout — wallet + card buttons'];


// choose a representative promo for a given surface from the live set
function promoForSurface(promos, sid) {
  const live = promos.filter((p) => p.status === 'live' && (p.surfaces || []).includes(sid));
  return live[0] || promos.find((p) => (p.surfaces || []).includes(sid)) || promos[0];
}

// the shop page an inner card deep-links to — filtered to its promo's products
function HeroShop({ promo, device, onBack }) {
  const summ = ST.scopeSummary(promo);
  const list = summ.list && summ.list.length ? summ.list : [{ n: 'All qualifying items', b: 'Storewide', was: 0, now: 0 }];
  const accent = promo.creative && promo.creative.color || '#FFD100';
  const ink = accent === '#FFD100' ? '#1A1400' : '#fff';
  const badge = ST.offerBadge(promo);
  const desk = device === 'desktop';
  const head = <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: desk ? '14px 16px' : '8px 14px 12px' }}>
    <span onClick={onBack} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: '0 0 auto' }}><Icon name="chevron-left" size={15} color="#fff" /></span>
    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>{promo.name}</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,.55)', fontFamily: "'JetBrains Mono',monospace" }}>{summ.count != null ? summ.count + ' products' : 'storewide'} · filtered</div></div>
    <span style={{ padding: '3px 8px', borderRadius: 99, background: accent, color: ink, fontSize: 10, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace" }}>{badge}</span>
  </div>;
  const grid = <div style={{ padding: '0 14px 16px', display: 'grid', gridTemplateColumns: desk ? 'repeat(4,1fr)' : '1fr 1fr', gap: 9 }}>
    {list.map((pr, i) => <div key={i} style={{ borderRadius: 11, overflow: 'hidden', background: '#17170F' }}>
      <div style={{ height: 64, background: `repeating-linear-gradient(135deg,hsl(${i * 47 % 360} 34% 30%),hsl(${i * 47 % 360} 34% 30%) 7px,hsl(${i * 47 % 360} 34% 24%) 7px,hsl(${i * 47 % 360} 34% 24%) 14px)` }} />
      <div style={{ padding: '7px 9px' }}><div style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pr.n}</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)' }}>{pr.b}</div>{pr.was > 0 && <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, marginTop: 3 }}><span style={{ color: 'rgba(255,255,255,.4)', textDecoration: 'line-through', marginRight: 4 }}>${pr.was}</span><span style={{ color: accent === '#FFD100' ? '#FFD100' : '#6ee7a8' }}>${pr.now}</span></div>}</div>
    </div>)}
  </div>;
  if (desk) return <div style={{ width: 760, borderRadius: 14, overflow: 'hidden', background: '#0F0F0C', boxShadow: '0 24px 60px rgba(0,0,0,.28)' }}><div style={{ height: 30 }} />{head}{grid}</div>;
  return <div style={{ width: 300, borderRadius: 40, background: '#000', padding: 9, boxShadow: '0 30px 60px rgba(0,0,0,.3)' }}><div style={{ borderRadius: 32, overflow: 'hidden', background: '#0F0F0C', position: 'relative' }}><div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 86, height: 22, borderRadius: 20, background: '#000', zIndex: 5 }} /><div style={{ height: 40 }} />{head}{grid}</div></div>;
}

// hybrid surface — the hero's big creative treatment + the category deal board
function HeroDeal({ promo, device, list }) {
  const accent = promo.creative && promo.creative.color || '#C0392B';
  const ink = accent === '#FFD100' ? '#1A1400' : '#fff';
  const mobile = device === 'mobile';
  const banner = <div style={{ background: accent, color: ink, padding: mobile ? '16px 16px 20px' : '24px 26px 26px' }}>
    <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 99, background: ink, color: accent, fontSize: 10, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", marginBottom: 9 }}>{ST.offerBadge(promo)}</span>
    <div style={{ fontSize: mobile ? 22 : 32, fontWeight: 900, letterSpacing: '-.03em', lineHeight: 1 }}>{promo.creative.headline || promo.name}</div>
    <div style={{ fontSize: mobile ? 12 : 14, opacity: .85, marginTop: 8, maxWidth: 460 }}>{promo.creative.subhead || ''}</div>
  </div>;
  const body = <div style={{ background: '#0F0F0C' }}>{banner}<window.DealBoard list={list || window.WEEKLY_BR} weekLabel="Jul 6 – 12" device={mobile ? 'mobile' : 'desktop'} headless /></div>;
  if (mobile) return <div style={{ width: 300, borderRadius: 40, background: '#000', padding: 9, boxShadow: '0 30px 60px rgba(0,0,0,.3)' }}><div style={{ borderRadius: 32, overflow: 'hidden', background: '#0F0F0C', position: 'relative' }}><div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 86, height: 22, borderRadius: 20, background: '#000', zIndex: 5 }} /><div style={{ height: 38 }} />{body}</div></div>;
  return <div style={{ width: 620, borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.28)' }}>{body}</div>;
}

window.StudioView = function StudioView({ promos, setPromos, onOpen }) {
  const P = useP();
  const [device, setDevice] = useState('mobile');
  // per-surface which promo is being previewed (default: representative)
  const [promoBySurface, setPBS] = useState(() => {const m = {};CARDS.forEach((c) => {m[c.id] = promoForSurface(promos, c.id)?.id;});return m;});
  // board order + visibility (Studio layout config → drives what design ships)
  const [order, setOrder] = useState(CARDS.map((c) => c.id));
  const [hidden, setHidden] = useState(new Set());
  const [sel, setSel] = useState('home_hero'); // selected card surface
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [carousel, setCarousel] = useState(null);
  // hero inner child cards — each linked to a promotion (→ opens its filtered shop)
  const heroPool = promos.filter((p) => p.discount && p.discount.scope !== 'cart');
  const [heroCards, setHeroCards] = useState(() => {
    const pool = (heroPool.length ? heroPool : promos).slice(0, 4);
    const hues = [38, 120, 265, 210];
    return pool.map((p, i) => ({ id: 'hc' + i, promoId: p.id, label: p.name, tag: ST.offerBadge(p), hue: hues[i % 4] }));
  });
  const [shopCardId, setShopCardId] = useState(null);
  const [dealOn, setDealOn] = useState(() => new Set((window.WEEKLY_BR || []).map((b) => b.id)));
  const [dealCopy, setDealCopy] = useState({ eyebrow: 'HYPERWOLF', headline: 'THIS WEEK’S DEALS', subhead: '' });
  const [dealWeek, setDealWeek] = useState('Jul 6 – 12');
  // category-banner targeting: which category pages this banner appears on
  const [catAuto, setCatAuto] = useState(true);
  const [catTargets, setCatTargets] = useState(() => new Set(['Flower']));
  const toggleCatTarget = (c) => setCatTargets((prev) => {const n = new Set(prev);n.has(c) ? n.delete(c) : n.add(c);return n;});
  const toggleDeal = (id) => setDealOn((prev) => {const n = new Set(prev);n.has(id) ? n.delete(id) : n.add(id);return n;});
  const reorderHero = (from, to) => setHeroCards((prev) => {const a = prev.slice();const [m] = a.splice(from, 1);a.splice(to, 0, m);return a;});
  const patchHero = (id, patch) => setHeroCards((prev) => prev.map((hc) => hc.id === id ? { ...hc, ...patch } : hc));
  const addHero = () => setHeroCards((prev) => prev.length >= 6 ? prev : [...prev, { id: 'hc' + Date.now(), promoId: (promos[0] || {}).id, label: (promos[0] || {}).name || 'New card', tag: promos[0] ? ST.offerBadge(promos[0]) : '', hue: Math.floor(Math.random() * 360) }]);
  const removeHero = (id) => setHeroCards((prev) => prev.length <= 1 ? prev : prev.filter((hc) => hc.id !== id));

  const selPromoId = promoBySurface[sel];
  const selPromo = promos.find((p) => p.id === selPromoId) || promos[0];
  const selMeta = cardMeta(sel);
  const selDevice = selMeta.device === 'mobile' ? 'mobile' : device;

  // write helpers — real edits back to the promo record
  const patchCreative = (patch) => setPromos((prev) => prev.map((p) => p.id === selPromo.id ? { ...p, creative: { ...p.creative, ...patch } } : p));
  const patchLayout = (patch) => setPromos((prev) => prev.map((p) => p.id === selPromo.id ? { ...p, layout: { ...(p.layout || {}), ...patch } } : p));
  const lay = selPromo.layout || {};
  const rew = selPromo.rewards || {};
  const patchRewards = (patch) => setPromos((prev) => prev.map((p) => p.id === selPromo.id ? { ...p, rewards: { ...(p.rewards || {}), ...patch } } : p));
  const inp = { width: '100%', padding: '10px 12px', borderRadius: P.r10, border: `1px solid ${P.fieldBorder}`, background: P.field, color: P.ink, fontSize: 13.5, fontFamily: P.fontSans, outline: 'none' };

  const move = (sid, dir) => setOrder((prev) => {const a = prev.slice();const i = a.indexOf(sid);const j = i + dir;if (j < 0 || j >= a.length) return prev;[a[i], a[j]] = [a[j], a[i]];return a;});
  const toggleHide = (sid) => setHidden((prev) => {const n = new Set(prev);n.has(sid) ? n.delete(sid) : n.add(sid);return n;});

  const eligiblePromos = (() => {const m = promos.filter((p) => (p.surfaces || []).includes(sel));return m.length ? m : promos;})();

  const CardShell = ({ sid }) => {
    const meta = cardMeta(sid);const a = sid === sel;const isHidden = hidden.has(sid);
    const pid = promoBySurface[sid];const promo = promos.find((p) => p.id === pid) || promos[0];
    const dev = meta.device === 'mobile' ? 'mobile' : device;
    const dealList = (window.WEEKLY_BR || []).filter((b) => dealOn.has(b.id));
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: isHidden ? .45 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={() => setSel(sid)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 10px', borderRadius: P.r999, border: `1px solid ${a ? P.ink : P.hairline2}`, background: a ? P.ink : P.surface, color: a ? P.surface : P.ink2, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: promo?.creative?.color || P.accent }} />{meta.label}
        </button>
        {a && <Pill kind="accent">Editing</Pill>}
        {!isHidden && !a && <Pill kind="good" dot>Ships</Pill>}
        {isHidden && <Pill kind="neutral">Hidden</Pill>}
        {promo?.layout?.slider && <Pill kind="accent" icon="refresh">Slider</Pill>}
        <div style={{ flex: 1 }} />
        <IconBtn icon="chevron-up" size={14} title="Move up" style={{ width: 26, height: 26 }} onClick={() => move(sid, -1)} />
        <IconBtn icon="chevron-down" size={14} title="Move down" style={{ width: 26, height: 26 }} onClick={() => move(sid, 1)} />
        <IconBtn icon={isHidden ? 'eye-off' : 'eye'} size={14} title={isHidden ? 'Show' : 'Hide'} style={{ width: 26, height: 26 }} onClick={() => toggleHide(sid)} />
      </div>
      <div onClick={() => setSel(sid)} style={{ cursor: 'pointer', borderRadius: 20, padding: 6, background: a ? P.accentSoft : 'transparent', border: `2px solid ${a ? P.accentBorder : 'transparent'}`, transition: 'background .12s, border-color .12s', display: 'inline-block' }}>
        {sid === 'weekly_deal' ? dev === 'mobile' ? <window.DealBoard list={dealList} weekLabel={dealWeek} copy={dealCopy} device="mobile" /> : <div style={{ width: 620 }}><window.DealBoard list={dealList} weekLabel={dealWeek} copy={dealCopy} device="desktop" /></div> :
        sid === 'hero_deal' ? <HeroDeal promo={promo} device={dev} list={dealList} /> :
        sid === 'home_hero' && shopCardId ? (() => {const hc = heroCards.find((h) => h.id === shopCardId);const sp = promos.find((p) => p.id === (hc && hc.promoId)) || promo;return <HeroShop promo={sp} device={dev} onBack={() => setShopCardId(null)} />;})() :
        <ST.SurfaceRender promo={promo} surface={sid} device={dev} childCards={sid === 'home_hero' ? heroCards : undefined} onReorderChild={sid === 'home_hero' ? reorderHero : undefined} onCardClick={sid === 'home_hero' ? (card) => setShopCardId(card.id) : undefined} />}
      </div>
    </div>;
  };

  const Seg2 = ({ value, onChange, options }) => <div style={{ display: 'inline-flex', background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, padding: 2, gap: 2 }}>
    {options.map((o) => {const a = o.value === value;return <button key={o.value} onClick={() => onChange(o.value)} style={{ padding: '6px 11px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: P.fontSans, fontSize: 12.5, fontWeight: 600, background: a ? P.surface : 'transparent', color: a ? P.ink : P.inkDim, boxShadow: a ? P.shadowSm : 'none' }}>{o.label}</button>;})}
  </div>;

  const FldRow = ({ label, hint, children }) => <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: P.ink2 }}>{label}{hint && <span style={{ color: P.inkMute, fontWeight: 400 }}> · {hint}</span>}</div>{children}</div>;

  const MiniSwatch = ({ value, onChange, opts }) => <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    {opts.map((o) => {const auto = o === 'auto';const a = o === value || auto && !value;return <button key={o} onClick={() => onChange(auto ? null : o)} title={auto ? 'Auto (best contrast)' : o} style={{ minWidth: auto ? 48 : 30, height: 30, padding: 0, borderRadius: 8, cursor: 'pointer', background: auto ? P.surface : o, color: auto ? P.ink2 : 'transparent', fontSize: 10, fontWeight: 700, fontFamily: P.fontMono, border: a ? `2px solid ${P.ink}` : `1px solid ${P.hairline2}`, boxShadow: a ? `0 0 0 3px ${P.accentSoft}` : 'none' }}>{auto ? 'Auto' : ''}</button>;})}
  </div>;

  return <div style={{ maxWidth: 1320, margin: '0 auto' }}>
    <SectionHead level={1} eyebrow="Promotions · Studio" title="Card studio"
    subtitle="Every retail card, live from your promotions. Select one to edit its color, creative, and layout — changes save straight to the promo and ship to the site. One edit applies to both mobile & desktop."
    action={<Seg2 value={device} onChange={setDevice} options={[{ value: 'mobile', label: 'Mobile' }, { value: 'desktop', label: 'Desktop' }]} />} />

    {carouselOpen && <CarouselModal config={carousel} onClose={() => setCarouselOpen(false)} onSave={(c) => {setCarousel(c);setCarouselOpen(false);}} />}

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 24, alignItems: 'start' }}>
      {/* canvas */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 30, alignItems: 'flex-start', padding: '6px 0 40px' }}>
        {order.map((sid) => <CardShell key={sid} sid={sid} />)}
      </div>

      {/* inspector */}
      <div style={{ position: 'sticky', top: 0 }}>
        <Card padding={0}>
          <div style={{ padding: '15px 16px', borderBottom: `1px solid ${P.hairline2}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: selPromo.creative.color, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={cardMeta(sel).id === 'loyalty' ? 'star' : 'layout'} size={15} color={selPromo.creative.color === '#FFD100' ? '#1A1400' : '#fff'} /></span>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono }}>{cardMeta(sel).label}</div><div style={{ fontSize: 13.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selPromo.name}</div></div>
          </div>
          {SURFACE_USE[sel] && <div style={{ padding: '10px 16px 12px', background: P.surface2, borderBottom: `1px solid ${P.hairline}` }}>
            <div style={{ display: 'flex', gap: 8 }}><Icon name="eye" size={14} color={P.inkMute} style={{ marginTop: 1, flex: '0 0 auto' }} /><span style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.5 }}>{SURFACE_USE[sel]}</span></div>
            {SURFACE_WHERE[sel] && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, paddingLeft: 22, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: P.inkFaint, fontFamily: P.fontMono }}>SHOWS ON</span>
              {SURFACE_WHERE[sel].map((pg) => <span key={pg} style={{ padding: '2px 8px', borderRadius: 99, background: P.surface, border: `1px solid ${P.hairline2}`, fontSize: 11.5, fontWeight: 700, color: P.ink2 }}>{pg}</span>)}
            </div>}
            {HERO_VS_BOARD[sel] && <div style={{ marginTop: 10, padding: '9px 11px', borderRadius: P.r10, background: P.accentSoft, border: `1px solid ${P.accentBorder}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}><Icon name="grid" size={12} color={P.accentText} /><span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.08em', color: P.accentText, fontFamily: P.fontMono }}>HERO vs. DEAL BOARD</span></div>
              <div style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.55 }}>{HERO_VS_BOARD[sel]}</div>
              <div style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.55, marginTop: 7, paddingTop: 7, borderTop: `1px solid ${P.hairline}` }}><b style={{ color: P.ink2 }}>If they overlap:</b> {CONFLICT_NOTE}</div>
            </div>}
          </div>}

          <div style={{ padding: '16px', maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
            {/* which promo feeds this card */}
            <FldRow label="Promotion shown" hint="on this card">
              <select value={selPromoId} onChange={(e) => setPBS((prev) => ({ ...prev, [sel]: e.target.value }))} style={{ width: '100%', padding: '10px 12px', borderRadius: P.r10, border: `1px solid ${P.fieldBorder}`, background: P.field, color: P.ink, fontSize: 13.5, fontFamily: P.fontSans, outline: 'none' }}>
                {eligiblePromos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FldRow>
            {sel !== 'cart' && sel !== 'loyalty' && <div style={{ marginBottom: 16 }}>
              <button onClick={() => setCarouselOpen(true)} style={{ width: '100%', padding: '11px', borderRadius: P.r10, border: `1px solid ${P.ink}`, background: P.ink, color: P.surface, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Icon name="grid" size={15} />{carousel ? 'Edit product carousel' : 'Configure product carousel'}</button>
              {carousel && <div style={{ marginTop: 8, fontSize: 11.5, color: P.inkDim, fontFamily: P.fontMono }}>{carousel.name} · {(carousel.picked || []).length} products · {carousel.brands.length || 'all'} brands</div>}
            </div>}

            {(sel === 'weekly_deal' || sel === 'hero_deal') && <DealBoardConfig dealOn={dealOn} setDealOn={setDealOn} toggleDeal={toggleDeal} copy={dealCopy} setCopy={setDealCopy} week={dealWeek} setWeek={setDealWeek} showCopy={sel === 'weekly_deal'} />}

            {sel === 'category_banner' && <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink2, marginBottom: 4 }}>Shows on category pages</div>
              <div style={{ fontSize: 11.5, color: P.inkDim, marginBottom: 10, lineHeight: 1.5 }}>Which category pages this banner appears on. Auto uses the categories the promotion&rsquo;s products belong to — a promo spanning multiple brands/categories shows on each matching category page.</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}><Switch on={catAuto} onChange={setCatAuto} /><span style={{ fontSize: 12.5, color: P.inkDim }}>{catAuto ? 'Auto — from the promotion’s products' : 'Manual — pick categories below'}</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, opacity: catAuto ? .5 : 1, pointerEvents: catAuto ? 'none' : 'auto' }}>
                {(window.WEEKLY_CATS || []).map((c) => {const on = catTargets.has(c);const cc = (window.WEEKLY_CAT_COLOR || {})[c] || P.ink;return <button key={c} onClick={() => toggleCatTarget(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 99, cursor: 'pointer', fontFamily: P.fontSans, fontSize: 11.5, fontWeight: 600, border: `1px solid ${on ? cc : P.hairline2}`, background: on ? cc + '22' : 'transparent', color: on ? P.ink : P.ink2 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: cc }} />{c}</button>;})}
              </div>
            </div>}

            {sel === 'home_hero' && <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink2 }}>Inner cards</div>
                <span style={{ fontSize: 11.5, fontWeight: 700, fontFamily: P.fontMono, color: P.accentText }}>{heroCards.length} of 6 linked</span>
              </div>
              <div style={{ fontSize: 11.5, color: P.inkDim, marginBottom: 12, lineHeight: 1.5 }}>Each tile links to a promotion — tapping it on the hero opens that promo&rsquo;s filtered shop. Use the arrows to set display order.</div>
              <div style={{ borderRadius: P.r12, border: `1px solid ${P.hairline2}`, overflow: 'hidden' }}>
                {heroCards.map((hc, i) => <div key={hc.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderTop: i === 0 ? 'none' : `1px solid ${P.hairline}`, background: P.surface }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, flex: '0 0 auto', background: window.weeklyGrad ? window.weeklyGrad(hc.hue, P.mode === 'dark') : `hsl(${hc.hue} 55% 50%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', fontFamily: P.fontMono }}>{(hc.label || '?')[0]}</span>
                  <select value={hc.promoId || ''} onChange={(e) => {const p = promos.find((x) => x.id === e.target.value);patchHero(hc.id, { promoId: e.target.value, label: p ? p.name : hc.label, tag: p ? ST.offerBadge(p) : hc.tag });}} style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', color: P.ink, fontSize: 12.5, fontWeight: 700, fontFamily: P.fontSans, outline: 'none', cursor: 'pointer' }}>
                    {!hc.promoId && <option value="">Link a promotion…</option>}
                    {promos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <IconBtn icon="chevron-up" size={13} title="Up" style={{ width: 22, height: 22 }} onClick={() => i > 0 && reorderHero(i, i - 1)} />
                  <IconBtn icon="chevron-down" size={13} title="Down" style={{ width: 22, height: 22 }} onClick={() => i < heroCards.length - 1 && reorderHero(i, i + 1)} />
                  <IconBtn icon="trash" size={13} title="Remove" style={{ width: 22, height: 22 }} onClick={() => removeHero(hc.id)} />
                </div>)}
              </div>
              <button onClick={addHero} disabled={heroCards.length >= 6} style={{ width: '100%', marginTop: 8, padding: '8px 0', borderRadius: 8, border: `1px solid ${P.hairline2}`, background: P.surface, color: heroCards.length >= 6 ? P.inkMute : P.ink, fontSize: 11.5, fontWeight: 700, cursor: heroCards.length >= 6 ? 'default' : 'pointer', fontFamily: P.fontSans }}>+ Add inner card</button>
              <div style={{ marginTop: 9, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 11px', borderRadius: P.r10, background: P.surface2, border: `1px dashed ${P.hairline3}` }}><Icon name="link" size={13} color={P.inkMute} style={{ marginTop: 1 }} /><span style={{ fontSize: 11.5, color: P.inkDim, lineHeight: 1.5 }}>Tap a tile on the hero preview to see the exact <b style={{ color: P.ink }}>filtered shop</b> a shopper lands on.</span></div>
            </div>}

            {sel === 'cart' && <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: P.ink2, marginBottom: 9 }}>Cart / checkout layout <span style={{ color: P.inkMute, fontWeight: 400 }}>· 10 options</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {const on = (lay.cartVariant || 1) === n;return <button key={n} onClick={() => patchLayout({ cartVariant: n })} title={CART_VARIANTS[n - 1]} style={{ padding: '9px 0', borderRadius: 8, border: `1px solid ${on ? P.ink : P.hairline2}`, background: on ? P.ink : P.surface, color: on ? P.surface : P.ink2, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: P.fontMono }}>{n}</button>;})}
              </div>
              <div style={{ marginTop: 8, fontSize: 11.5, color: P.inkDim }}>{CART_VARIANTS[(lay.cartVariant || 1) - 1]}</div>
            </div>}

            <div style={{ height: 1, background: P.hairline, margin: '4px 0 16px' }} />
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono, marginBottom: 12 }}>Creative</div>
            <FldRow label="Theme color">
              <ST.ColorSwatch value={selPromo.creative.color} onChange={(c) => patchCreative({ color: c })} />
            </FldRow>
            <FldRow label="Headline">
              <input value={selPromo.creative.headline || ''} onChange={(e) => patchCreative({ headline: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: P.r10, border: `1px solid ${P.fieldBorder}`, background: P.field, color: P.ink, fontSize: 13.5, fontFamily: P.fontSans, outline: 'none' }} />
            </FldRow>
            <FldRow label="Subhead">
              <textarea value={selPromo.creative.subhead || ''} onChange={(e) => patchCreative({ subhead: e.target.value })} rows={2} style={{ width: '100%', resize: 'vertical', padding: '10px 12px', borderRadius: P.r10, border: `1px solid ${P.fieldBorder}`, background: P.field, color: P.ink, fontSize: 13.5, fontFamily: P.fontSans, lineHeight: 1.5, outline: 'none' }} />
            </FldRow>
            <FldRow label="Button label">
              <input value={selPromo.creative.cta || ''} onChange={(e) => patchCreative({ cta: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: P.r10, border: `1px solid ${P.fieldBorder}`, background: P.field, color: P.ink, fontSize: 13.5, fontFamily: P.fontSans, outline: 'none' }} />
            </FldRow>
            <FldRow label="Font color" hint="auto = best contrast on the theme"><MiniSwatch value={selPromo.creative.textColor} onChange={(c) => patchCreative({ textColor: c })} opts={['auto', '#FFFFFF', '#0F0F0C']} /></FldRow>
            <FldRow label="Button color" hint="auto = inverse of theme"><MiniSwatch value={selPromo.creative.btnColor} onChange={(c) => patchCreative({ btnColor: c })} opts={['auto', '#0F0F0C', '#FFFFFF', '#FFD100']} /></FldRow>
            <FldRow label="Image" hint="1200×675px · 16:9 · fills the card behind copy">
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, borderRadius: P.r10, border: `1px dashed ${P.hairline3}`, background: P.surface2, color: P.inkMute, fontSize: 12.5, fontFamily: P.fontMono, cursor: 'pointer' }}>
                <Icon name="box-add" size={16} />{selPromo.creative.image ? 'Replace image' : 'Upload PNG / JPG'}
                <input type="file" accept="image/*" onChange={(e) => {const f = e.target.files && e.target.files[0];if (f) patchCreative({ image: URL.createObjectURL(f) });}} style={{ display: 'none' }} />
              </label>
            </FldRow>

            <div style={{ height: 1, background: P.hairline, margin: '4px 0 16px' }} />
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono, marginBottom: 12 }}>Layout</div>

            <FldRow label="Button position">
              <Seg2 value={lay.ctaAlign || 'left'} onChange={(v) => patchLayout({ ctaAlign: v })} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]} />
            </FldRow>
            <FldRow label="Corner radius" hint={`${lay.radius != null ? lay.radius : 'default'}`}>
              <input type="range" min="0" max="28" step="2" value={lay.radius != null ? lay.radius : 20} onChange={(e) => patchLayout({ radius: Number(e.target.value) })} style={{ width: '100%', accentColor: P.accent }} />
            </FldRow>
            <FldRow label="Offer badge">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Switch on={lay.showBadge !== false} onChange={(v) => patchLayout({ showBadge: v })} /><span style={{ fontSize: 12.5, color: P.inkDim }}>{lay.showBadge === false ? 'Hidden' : 'Shown on card'}</span></div>
            </FldRow>
            <FldRow label="Display as slider" hint="rotate multiple promos in this slot">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Switch on={!!lay.slider} onChange={(v) => patchLayout({ slider: v })} /><span style={{ fontSize: 12.5, color: P.inkDim }}>{lay.slider ? 'Slider — swipes eligible promos' : 'Single card'}</span></div>
            </FldRow>

            {sel === 'loyalty' && <>
              <div style={{ height: 1, background: P.hairline, margin: '4px 0 16px' }} />
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: P.inkMute, fontFamily: P.fontMono, marginBottom: 6 }}>Points & rewards</div>
              <div style={{ fontSize: 11.5, color: P.inkDim, marginBottom: 12, lineHeight: 1.5 }}>This card lives in the app&rsquo;s <b style={{ color: P.ink }}>Rewards / points hub</b> — and can also be pinned to the home banner.</div>
              <FldRow label="Points multiplier" hint="× earned on this promo"><input type="number" value={rew.pointsMult || 1} onChange={(e) => patchRewards({ pointsMult: Number(e.target.value) || 1 })} style={inp} /></FldRow>
              <FldRow label="Bonus points" hint="flat, on redemption"><input type="number" value={rew.bonus || 0} onChange={(e) => patchRewards({ bonus: Number(e.target.value) || 0 })} style={inp} /></FldRow>
              <FldRow label="Points to unlock" hint="min balance to use"><input type="number" value={rew.threshold || 0} onChange={(e) => patchRewards({ threshold: Number(e.target.value) || 0 })} style={inp} /></FldRow>
              <FldRow label="Wallet credit" hint="$ added to wallet"><input type="number" value={rew.wallet || 0} onChange={(e) => patchRewards({ wallet: Number(e.target.value) || 0 })} style={inp} /></FldRow>
              <FldRow label="Redeemable with points"><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Switch on={!!rew.redeemable} onChange={(v) => patchRewards({ redeemable: v })} /><span style={{ fontSize: 12.5, color: P.inkDim }}>{rew.redeemable ? 'Yes' : 'No'}</span></div></FldRow>
            </>}

            <div style={{ height: 1, background: P.hairline, margin: '4px 0 14px' }} />
            <button onClick={() => onOpen(selPromo.id)} style={{ width: '100%', padding: '11px', borderRadius: P.r10, border: `1px solid ${P.hairline2}`, background: P.surface2, color: P.ink, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: P.fontSans, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="pencil" size={15} />Open full promotion
            </button>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 11px', borderRadius: P.r10, background: P.accentSoft, border: `1px solid ${P.accentBorder}` }}>
              <Icon name="check-circle" size={14} color={P.accentText} style={{ marginTop: 1 }} />
              <span style={{ fontSize: 11.5, color: P.accentText, lineHeight: 1.5 }}>Edits save live to <b>{selPromo.name}</b> — the same record the Live board and site read.</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>;
};