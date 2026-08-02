// ── Merge bridge — unify the rule/sentence model (today) with the ───────────
// surface/creative/publish model (4-day-old app). One promo object, two facets.
const PROMO = window.PROMO;

function brandName(id){ return (PROMO.BRANDS.find(b=>b.id===id)||{}).name || id; }

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
  const status = draft.status==='active' ? 'live' : 'draft';
  return {
    id: base.id || ('p'+Date.now()),
    name: draft.name || 'Untitled promotion',
    code: draft.code || '',
    campaign: base.campaign || 'weekly',
    status,
    discount: ruleToOffer(rule),
    audience: base.audience || 'all',
    regions: base.regions || 'all',
    stores: base.stores || 'all',
    schedule: base.schedule || { start:'2026-07-14' },
    stackable: base.stackable != null ? base.stackable : false,
    priority: base.priority || 3,
    cap: draft.totalLimit ? Number(draft.totalLimit) : (base.cap || null),
    rewards: base.rewards || { pointsMult:1, redeemable:false, wallet:0 },
    surfaces: base.surfaces || ['home_banner','shop_tile'],
    creative: base.creative || { headline: draft.name || 'New promotion', subhead: ruleSubhead(rule), cta:'Shop now', color:'#FFD100' },
    layout: base.layout,
    perf: base.perf,
    rule,
  };
}

// unified promo → MY builder draft
function mergedToDraft(promo){
  return {
    name: promo.name || '', code: promo.code || '', platform:'Hyperwolf',
    status: promo.status==='live' ? 'active' : 'draft',
    auto: !promo.code,
    schedule:true, publishNow:false, expiry: !!(promo.schedule && promo.schedule.end),
    publishDate:'Jul 14, 2026 9:00 AM', expiryDate:'Aug 14, 2026 9:00 AM',
    totalLimit: promo.cap ? String(promo.cap) : '', userLimit:'',
    rule: promo.rule ? JSON.parse(JSON.stringify(promo.rule)) : discountToRule(promo),
  };
}

// seed the unified dataset: rich creative/surfaces/perf + a derived rule
function seedMerged(){ return PROMO.seedPromos().map(p=>({ ...p, rule: p.rule || discountToRule(p) })); }

Object.assign(window, { MERGE:{ seedMerged, mergedToDraft, draftToMerged, ruleToOffer, discountToRule, ruleSubhead } });
