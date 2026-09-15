// ── Merge bridge — unify the rule/sentence model (today) with the ───────────
// surface/creative/publish model (4-day-old app). One promo object, two facets.
const PROMO = window.PROMO;

function brandName(id){ return (PROMO.BRANDS.find(b=>b.id===id)||{}).name || id; }

// Offer kinds with a real field shape the rule/condition/reward model has no
// slots for (points multiplier, tier breakpoints, a flat dollar amount, a
// bundle's descriptive structure -- see pweb/module.jsx's OFFERS/seedPromos
// and promo/builder-native.jsx). Before this fix EVERY promo, regardless of
// kind, round-tripped through discountToRule()/ruleToOffer() below on
// open+save, and ruleToOffer() can only produce 'percent' | 'bogo' | 'gift'
// -- so a points/tiered/dollar/bundle promo's real structure was destroyed
// the first time anyone opened and saved it in the Builder. These four kinds
// now bypass the rule bridge entirely: mergedToDraft() copies the promo's
// real `discount` object straight into draft.nativeOffer, and
// draftToMerged() writes draft.nativeOffer straight back as `discount`,
// untouched by ruleToOffer().
const NATIVE_OFFER_KINDS = ['points', 'tiered', 'dollar', 'bundle'];

// plain-English subhead from a rule (used as creative default)
function ruleSubhead(rule){
  const pl = window.ruleToPlain(rule);
  if(!pl || !rule.conditions || !rule.conditions.length || !rule.reward.id) return 'A new promotion.';
  return `When ${pl.subj} ${pl.cond}, we’ll ${pl.then}.`;
}

// OLD discount → MY rule (so existing promos open cleanly in the new builder)
function discountToRule(p){
  const d = p.discount || {};
  let entity, group, condId, values;
  if(d.kind==='bogo'){
    entity='bogo'; group='bogo_deals';
    condId = d.scope==='category' ? 'buy_any_cat' : 'buy_any_product';
    values = d.scope==='category' ? { x:2, category:d.items||[] } : { x:2, product:[] };
  } else if(d.scope==='category'){
    entity='product'; group='type_category'; condId='in_category'; values={ category:d.items||[] };
  } else if(d.scope==='brand'){
    entity='product'; group='type_category'; condId='belongs_to'; values={ category:[], brand:(d.items||[]).map(brandName) };
  } else {
    entity='cart'; group='total_items'; condId='spend_more'; values={ amount:d.min||1 };
  }
  let reward;
  if(d.kind==='gift') reward={ id:'free_product', values:{ product:[] } };
  else if(d.kind==='percent') reward={ id:'discount_self', values:{ pct:d.value||10, cap:(d.value||10)*2 } };
  else if(d.kind==='dollar') reward={ id:'discount_self', values:{ pct:15, cap:d.value||15 } };
  else if(d.kind==='bogo') reward={ id:'discount_self', values:{ pct:d.value||50, cap:25 } };
  else reward={ id:'discount_self', values:{ pct:d.value||15, cap:50 } };
  return { entity, group, conditions:[{ condId, values }], combiner:'AND', reward };
}

// MY rule → OLD offer/discount (so new promos render on the customer surfaces)
function ruleToOffer(rule){
  const r = rule.reward || {}; const c = (rule.conditions||[])[0]; const v = (c&&c.values)||{};
  let scope='cart', items=[], min=0;
  if(rule.entity==='product'){ scope='category'; items = (v.category&&v.category.length)?v.category:['selected items']; }
  else if(rule.entity==='cart'){ scope='cart'; min = v.amount||0; }
  else if(rule.entity==='bogo'){ if(v.category&&v.category.length){ scope='category'; items=v.category; } else scope='cart'; }
  else if(rule.entity==='user'){ scope='cart'; }
  let kind='percent', value=0, text;
  if(r.id==='free_product'){ kind='gift'; text='Free gift with purchase'; }
  else if(rule.entity==='bogo'){ kind='bogo'; value=r.values?.pct||50; }
  else { kind='percent'; value=r.values?.pct||0; }
  return { kind, value, scope, items, min, text };
}

// MY builder draft → unified promo (create or update)
function draftToMerged(draft, base){
  base = base || {};
  const rule = draft.rule;
  // draft.status is already a contract PromotionStatus value (promo/pshared.jsx
  // MetaFields' Status control only offers 'active'/'draft', but a promo
  // opened from the merged dataset can carry 'scheduled'/'paused'/'ended' --
  // see mergedToDraft() below). Both sides of this bridge use the same
  // vocabulary now, so no translation belongs here; the old ternary silently
  // downgraded every non-'active' status to 'draft' on save.
  const status = draft.status;
  // Native-kind promos (see NATIVE_OFFER_KINDS above) write their real
  // discount object straight back -- never through ruleToOffer(), which
  // cannot represent them and is exactly what was silently collapsing them.
  const discount = draft.nativeOffer ? JSON.parse(JSON.stringify(draft.nativeOffer)) : ruleToOffer(rule);
  const subhead = draft.nativeOffer ? PROMO.offerLabel({ discount }) : ruleSubhead(rule);
  return {
    id: base.id || ('p'+Date.now()),
    // Carried through, never set by this function -- `engage_id` is the
    // SERVER's own `engage_promotions.id`, stamped onto `base` only by
    // pweb/app.jsx's saveBuilder after a successful persist (or already
    // present when `base` itself came from `M.engageToMerged`, a promo
    // loaded from the server in the first place). Its presence is what
    // lets saveBuilder UPDATE the same row on a second save instead of
    // creating a duplicate.
    engage_id: base.engage_id,
    name: draft.name || 'Untitled promotion',
    code: draft.code || '',
    campaign: base.campaign || 'weekly',
    status,
    discount,
    audience: base.audience || 'all',
    regions: base.regions || 'all',
    stores: base.stores || 'all',
    schedule: base.schedule || { start:'2026-07-14' },
    stackable: base.stackable != null ? base.stackable : false,
    priority: base.priority || 3,
    cap: draft.totalLimit ? Number(draft.totalLimit) : (base.cap || null),
    rewards: base.rewards || { pointsMult:1, redeemable:false, wallet:0 },
    surfaces: base.surfaces || ['home_banner','shop_tile'],
    creative: base.creative || { headline: draft.name || 'New promotion', subhead, cta:'Shop now', color:'#FFD100' },
    layout: base.layout,
    perf: base.perf,
    // Keep a rule on every promo for screens that still read one (e.g. the
    // WM overlap/plain-sentence surfaces) -- but for native kinds this is
    // COSMETIC ONLY, derived from the real discount, never the other way
    // around. draftToMerged() above already wrote `discount` straight from
    // draft.nativeOffer, so re-deriving `rule` here can't lose anything.
    rule: draft.nativeOffer ? discountToRule({ discount }) : rule,
  };
}

// unified promo → MY builder draft
function mergedToDraft(promo){
  const kind = promo.discount && promo.discount.kind;
  const native = NATIVE_OFFER_KINDS.includes(kind);
  return {
    // promo/pdata.jsx's PLATFORMS (contract Platform, lower-case ids) is a
    // plain-JS global loaded before this file -- see Promotions Suite.html.
    // The merged/pweb dataset carries no per-promo platform field yet, so
    // default to the first contract platform rather than a hardcoded
    // Title-cased literal.
    name: promo.name || '', code: promo.code || '', platform: promo.platform || (window.PLATFORMS ? window.PLATFORMS[0] : 'hyperwolf'),
    status: promo.status,
    auto: !promo.code,
    schedule:true, publishNow:false, expiry: !!(promo.schedule && promo.schedule.end),
    publishDate:'Jul 14, 2026 9:00 AM', expiryDate:'Aug 14, 2026 9:00 AM',
    totalLimit: promo.cap ? String(promo.cap) : '', userLimit:'',
    nativeOffer: native ? JSON.parse(JSON.stringify(promo.discount)) : null,
    rule: native ? window.newRule() : (promo.rule ? JSON.parse(JSON.stringify(promo.rule)) : discountToRule(promo)),
  };
}

// seed the unified dataset: rich creative/surfaces/perf + a derived rule
function seedMerged(){ return PROMO.seedPromos().map(p=>({ ...p, rule: p.rule || discountToRule(p) })); }

// ── engage_promotions row (GET /api/promos/internal) → MY merged promo ─────
// The inverse of draftToMerged()'s own `discount` construction (via
// pweb/app.jsx's server-side adapter, `engage/api.py::_suite_action_from_
// discount`) -- NOT a full round-trip for every possible `action` shape:
// `action.scope` 'items'/'sku' (no native Suite equivalent -- its own
// "Applies to" control only offers cart/category/brand,
// promo/builder-native.jsx) folds into 'category' here, items carrying
// whatever the action itself named, so the promo is still visible and
// editable rather than dropped -- just not perfectly re-labelled. A tiered
// action entry with only `reward_cents` (no `percent`) has no honest
// percent to show in TierEditor's percent-only column and is DROPPED from
// the reverse-mapped `tiers` array rather than a fabricated percent guessed
// from reward/threshold -- "honest zero over fabricated number" applied to
// a promo round-trip, not just a number on a screen.
function engageDiscountFromAction(action){
  const a = action || {};
  const kindMap = { percent:'percent', amount:'dollar', bogo:'bogo', bundle:'bundle', gift:'gift', tiered:'tiered', points:'points' };
  const kind = kindMap[a.kind] || 'percent';
  let scope = a.scope === 'category' || a.scope === 'brand' || a.scope === 'cart' ? a.scope : 'category';
  let items = [];
  if(scope==='category') items = a.category ? (Array.isArray(a.category)?a.category:[a.category]) : (a.sku ? (Array.isArray(a.sku)?a.sku:[a.sku]) : []);
  else if(scope==='brand') items = a.brand ? (Array.isArray(a.brand)?a.brand:[a.brand]) : [];
  const min = a.min_cents ? a.min_cents/100 : undefined;
  if(kind==='dollar') return { kind, value:(a.value||0)/100, min, scope, items };
  if(kind==='points') return { kind, value: a.multiplier!=null ? a.multiplier : (a.value||0), scope, items };
  if(kind==='bundle') return { kind, text: a.description||'', scope, items };
  if(kind==='tiered') return { kind, scope, items,
    tiers:(a.value||[]).filter(t=>t && t.percent!=null).map(t=>({ min:(t.threshold_cents||0)/100, value:t.percent })) };
  return { kind, value:a.value||0, scope, items };  // percent | bogo | gift
}

function engageToMerged(row){
  const discount = engageDiscountFromAction(row.action);
  return {
    id: row.id, engage_id: row.id,
    name: row.name || 'Untitled promotion', code: row.code || '',
    campaign:'weekly', status: row.status, discount,
    audience: row.audience_id || 'all', regions:'all',
    stores: (row.stores && row.stores.length) ? row.stores : 'all',
    schedule: { start: row.starts_at || '2026-07-14', end: row.ends_at || undefined },
    stackable: !!row.stackable, priority: row.priority || 3,
    cap: row.usage_limit || null,
    rewards: { pointsMult:1, redeemable:false, wallet:0 },
    surfaces: ['home_banner','shop_tile'],
    creative: { headline: row.name || 'New promotion', subhead: PROMO.offerLabel ? PROMO.offerLabel({ discount }) : '', cta:'Shop now', color:'#FFD100' },
    rule: discountToRule({ discount }),
  };
}

// Merge server rows (by `engage_id`) into a local promo list -- a saved
// promotion replaces its own seeded/local copy in place (same position);
// one never yet persisted (`engage_id` on neither side) is untouched; a
// server row with no local match is prepended as new. Called once on
// Suite mount (pweb/app.jsx) against `HW_PROMOS_LIVE.listInternal()`'s
// result -- see that call site for why this is what makes a saved
// promotion survive a reload.
function mergeEngageRows(local, rows){
  const byEngageId = {};
  (rows||[]).forEach(r=>{ byEngageId[r.id] = engageToMerged(r); });
  const seen = new Set();
  const merged = local.map(p=>{
    if(p.engage_id!=null && byEngageId[p.engage_id]){ seen.add(p.engage_id); return byEngageId[p.engage_id]; }
    return p;
  });
  const fresh = (rows||[]).filter(r=>!seen.has(r.id)).map(engageToMerged);
  return [...fresh, ...merged];
}

Object.assign(window, { MERGE:{ seedMerged, mergedToDraft, draftToMerged, ruleToOffer, discountToRule, ruleSubhead, engageToMerged, mergeEngageRows } });
