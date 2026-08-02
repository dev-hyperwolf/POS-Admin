// ── Promotions module — data backbone ──────────────────────────────────────
// Encodes the COMPLETE if/then taxonomy from the current module (every screen),
// plus catalog data, sample promotions, and the full metric catalog.

// ── formatters ──────────────────────────────────────────────────────────────
const pfmt = {
  money:(n)=> n==null?'—':'$'+Number(n).toLocaleString('en-US',{maximumFractionDigits:0}),
  money2:(n)=> n==null?'—':'$'+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),
  k:(n)=> n==null?'—':(Math.abs(n)>=1000?'$'+(n/1000).toFixed(1).replace(/\.0$/,'')+'k':'$'+Math.round(n)),
  num:(n)=> n==null?'—':Number(n).toLocaleString('en-US'),
  pct:(n)=> n==null?'—':(n>0?'':'')+n+'%',
  x:(n)=> n==null?'—':n.toFixed(1)+'×',
};

// ── catalog (drawn from the real dropdowns) ─────────────────────────────────
const CATEGORIES = ['2x Points!!','5g-28g','Accessories','All-in-One Vapes','Baked Goods','Batteries','Budder / Badder','Budget Friendly Flower','Cartridges','Concentrates','CBD','Disposables','Drinks','Edibles','Flower','Gummies','Infused Pre-Rolls','Live Resin','Merch','Pre-Rolls','Sauce','Shatter','Tinctures','Topicals','Vapes'];
const BRANDS = ['1904','Alien Labs','Allswell','Almora Farm','Angeleno\'s Cult','Arcata Fire','Backpack Boyz','Cann','Claybourne','Connected','Dr. Norm\'s','Emerald Sky','Flav','Heavy Hitters','Jeeter','Kanha','Kiva','Papa & Barkley','Raw Garden','Stiiizy','Wyld'];
const PRODUCTS = [
  {n:'Gludaz Pre-Roll',p:13,c:'Pre-Rolls',b:'Backpack Boyz',thc:28,type:'Hybrid'},
  {n:'#freebritney Half Ounce Smalls',p:70,c:'Flower',b:'Arcata Fire',thc:22,type:'Indica'},
  {n:'#freebritney Smalls',p:20,c:'Flower',b:'Arcata Fire',thc:21,type:'Indica'},
  {n:'#lunchbreak Pre-Roll',p:5,c:'Pre-Rolls',b:'1904',thc:19,type:'Sativa'},
  {n:'#sheslapz Ready-To-Roll',p:18,c:'Infused Pre-Rolls',b:'Claybourne',thc:34,type:'Hybrid'},
  {n:'Blue Dream 3.5g',p:35,c:'Flower',b:'Almora Farm',thc:24,type:'Sativa'},
  {n:'Wedding Cake Live Resin',p:45,c:'Live Resin',b:'Raw Garden',thc:78,type:'Indica'},
  {n:'Kiva Camino Gummies',p:22,c:'Gummies',b:'Kiva',thc:5,type:'Hybrid'},
  {n:'Heavy Hitters Cart 1g',p:50,c:'Cartridges',b:'Heavy Hitters',thc:85,type:'Indica'},
  {n:'Jeeter Baby Cannons 5pk',p:32,c:'Infused Pre-Rolls',b:'Jeeter',thc:36,type:'Hybrid'},
  {n:'Cann Social Tonic 6pk',p:24,c:'Drinks',b:'Cann',thc:2,type:'Sativa'},
  {n:'Wyld Elderberry Gummies',p:20,c:'Gummies',b:'Wyld',thc:5,type:'Indica'},
  {n:'Raw Garden Refined Live Resin',p:40,c:'Live Resin',b:'Raw Garden',thc:80,type:'Sativa'},
  {n:'Stiiizy Pod 1g',p:48,c:'Vapes',b:'Stiiizy',thc:82,type:'Hybrid'},
  {n:'Papa & Barkley Balm',p:38,c:'Topicals',b:'Papa & Barkley',thc:0,type:'Hybrid'},
];
const MEMBER_GROUPS = ['Bronze','Silver','Gold','Platinum','Wolf Pack VIP'];
const PRODUCT_TYPES = ['Indica','Sativa','Hybrid'];
const PLATFORMS = ['Hyperwolf','Hemp','Stilo'];

// ── RULE TAXONOMY ───────────────────────────────────────────────────────────
// entity → group → condition. Every condition carries a `tmpl` (plain-language
// template with {slots}) + `params` (editable slots) + `hint` (what it does).
// param types: number, money, percent, category, brand, product, group, agerange, ptype
const ENTITIES = [
  {
    id:'user', label:'User', icon:'user', tone:'info',
    blurb:'Target shoppers by who they are, what they\'ve bought, or how loyal they are.',
    groups:[
      { id:'activity', label:'User Activity & Purchase History', icon:'clock',
        conditions:[
          { id:'not_purchased', label:'Has not purchased in the last N days', tmpl:'has not purchased in the last {days} days', hint:'Win back lapsed customers who have gone quiet.', params:[{key:'days',type:'number',unit:'days',def:30}] },
          { id:'purchased_brand', label:'Has purchased from X brand', tmpl:'has purchased from {brand} before', hint:'Reward buyers loyal to a specific brand.', params:[{key:'brand',type:'brand'}] },
        ]},
      { id:'loyalty', label:'Loyalty & Engagement', icon:'crown',
        conditions:[
          { id:'member_months', label:'Has been a member for more than X months', tmpl:'has been a member for more than {months} months', hint:'Thank long-standing members.', params:[{key:'months',type:'number',unit:'months',def:6}] },
          { id:'membership_group', label:'Is in a membership group', tmpl:'is in the {group} membership group', hint:'Target a specific loyalty tier.', params:[{key:'group',type:'group'}] },
        ]},
      { id:'demographics', label:'Demographics & Preferences', icon:'users',
        conditions:[
          { id:'age_range', label:'Is within an age range', tmpl:'is between {min} and {max} years old', hint:'Age-gate a promo, e.g. senior discounts.', params:[{key:'min',type:'number',unit:'yrs',def:55},{key:'max',type:'number',unit:'yrs',def:120}] },
        ]},
    ]},
  {
    id:'product', label:'Product', icon:'package', tone:'hybrid',
    blurb:'Target which items qualify — by category, brand, specific SKU, or potency.',
    groups:[
      { id:'type_category', label:'Product Type & Category', icon:'tag',
        conditions:[
          { id:'in_category', label:'Is in a selected category', tmpl:'is in {category}', hint:'Any product within the chosen categories.', params:[{key:'category',type:'category'}] },
          { id:'belongs_to', label:'Belongs to category & brand', tmpl:'belongs to {category} and {brand}', hint:'Narrow to category AND brand together.', params:[{key:'category',type:'category'},{key:'brand',type:'brand'}] },
          { id:'specific_product', label:'Is a specific product', tmpl:'is one of {product}', hint:'Hand-pick exact SKUs.', params:[{key:'product',type:'product'}] },
          { id:'thc_gte', label:'Has THC % ≥ N', tmpl:'has a THC % of {thc}% or higher', hint:'High-potency products only.', params:[{key:'thc',type:'number',unit:'%',def:25}] },
          { id:'thc_lte', label:'Has THC % ≤ N', tmpl:'has a THC % of {thc}% or lower', hint:'Low-potency / wellness products only.', params:[{key:'thc',type:'number',unit:'%',def:15}] },
          { id:'ptype', label:'Is a product type', tmpl:'is {ptype}', hint:'Indica, Sativa or Hybrid.', params:[{key:'ptype',type:'ptype'}] },
        ]},
    ]},
  {
    id:'cart', label:'Cart', icon:'cart', tone:'sativa',
    blurb:'Trigger on the whole basket — spend thresholds, item counts, upsell targets.',
    groups:[
      { id:'total_items', label:'Cart Total & Items', icon:'dollar',
        conditions:[
          { id:'spend_more', label:'Spends more than X', tmpl:'total is more than {amount}', hint:'Classic spend threshold.', params:[{key:'amount',type:'money',def:50}] },
          { id:'more_items', label:'Contains more than N items', tmpl:'contains more than {n} items', hint:'Reward bigger baskets.', params:[{key:'n',type:'number',unit:'items',def:3}] },
          { id:'only_specific', label:'Contains only specific products', tmpl:'contains only {product}', hint:'Cart is made up solely of chosen SKUs.', params:[{key:'product',type:'product'}] },
          { id:'not_include', label:'Does not include specific products', tmpl:'does not include {product}', hint:'Exclude certain SKUs from qualifying.', params:[{key:'product',type:'product'}] },
        ]},
      { id:'upsell', label:'Discount & Upselling Opportunities', icon:'trending-up',
        conditions:[
          { id:'atleast_cat', label:'Has at least N items from a category', tmpl:'has at least {n} items from {category}', hint:'Nudge shoppers to bundle a category.', params:[{key:'n',type:'number',unit:'items',def:2},{key:'category',type:'category'}] },
          { id:'atleast_qty', label:'Has at least X quantity of the same item', tmpl:'has at least {qty} of the same item', hint:'Volume deals on a single SKU.', params:[{key:'qty',type:'number',unit:'qty',def:3}] },
        ]},
    ]},
  {
    id:'bogo', label:'BOGO', icon:'gift', tone:'edibles',
    blurb:'Buy-one-get style deals across specific products or categories.',
    groups:[
      { id:'bogo_deals', label:'BOGO Deals', icon:'gift',
        conditions:[
          { id:'buy_each_product', label:'Buy each X of specific products', tmpl:'buys each {x} of {product}', hint:'Each listed product must hit the quantity.', params:[{key:'x',type:'number',unit:'ea',def:1},{key:'product',type:'product'}] },
          { id:'buy_any_product', label:'Buy any X from specific products', tmpl:'buys any {x} from {product}', hint:'Any mix from the product list.', params:[{key:'x',type:'number',unit:'any',def:2},{key:'product',type:'product'}] },
          { id:'buy_each_cat', label:'Buy each X from specific categories', tmpl:'buys each {x} from {category}', hint:'Each category must hit the quantity.', params:[{key:'x',type:'number',unit:'ea',def:1},{key:'category',type:'category'}] },
          { id:'buy_any_cat', label:'Buy any X from specific categories', tmpl:'buys any {x} from {category}', hint:'Any mix from the category list.', params:[{key:'x',type:'number',unit:'any',def:2},{key:'category',type:'category'}] },
        ]},
    ]},
];

// ── THEN — rewards ───────────────────────────────────────────────────────────
const REWARDS = [
  { id:'discount_self', label:'Discount the qualifying product', tmpl:'give {pct}% off (up to {cap}) on the product itself', icon:'percent', hint:'Markdown applied to the item that matched.', params:[{key:'pct',type:'percent',def:30},{key:'cap',type:'money',def:50}] },
  { id:'free_product', label:'Add a free product', tmpl:'add {product} to the cart for free', icon:'gift', hint:'Gift-with-purchase.', params:[{key:'product',type:'product'}] },
  { id:'discount_other', label:'Discount a different product', tmpl:'give {pct}% off (up to {cap}) on {product} in the cart', icon:'cart', hint:'Reward applied to a different SKU than the trigger.', params:[{key:'pct',type:'percent',def:20},{key:'cap',type:'money',def:25},{key:'product',type:'product'}] },
];

// helper: look up entity/group/condition/reward
const RULE = {
  entity:(id)=>ENTITIES.find(e=>e.id===id),
  group:(eid,gid)=>RULE.entity(eid)?.groups.find(g=>g.id===gid),
  cond:(eid,gid,cid)=>RULE.group(eid,gid)?.conditions.find(c=>c.id===cid),
  reward:(id)=>REWARDS.find(r=>r.id===id),
};

// default value for a param
function paramDefault(p){
  if(p.type==='category'||p.type==='brand'||p.type==='product'||p.type==='ptype') return [];
  if(p.type==='group') return null;
  return p.def ?? '';
}
// render a param value to text
function paramText(p, v){
  if(p.type==='money') return v===''||v==null?'$—':'$'+v;
  if(p.type==='percent') return v===''||v==null?'—%':v+'%';
  if(p.type==='category'||p.type==='brand'||p.type==='product'){
    if(!v||!v.length) return p.type==='category'?'category…':p.type==='brand'?'brand…':'product…';
    const names = v.map(x=> typeof x==='object'?x.n:x);
    if(names.length===1) return names[0];
    return names[0]+' +'+(names.length-1);
  }
  if(p.type==='ptype'){ if(!v||!v.length) return 'type…'; return v.join(' / '); }
  if(p.type==='group') return v||'group…';
  if(p.type==='number') return (v===''||v==null?'N':v)+(p.unit&&!['yrs','items','any','ea','qty'].includes(p.unit)?p.unit:'');
  return v??'—';
}

// build plain-language sentence for a rule (array of clauses)
function ruleToPlain(rule){
  // rule: { entity, group, conditions:[{condId, values}], combiner, reward:{id, values} }
  const e = RULE.entity(rule.entity); if(!e) return null;
  const subj = {user:'the customer',product:'the product',cart:'the cart',bogo:'the customer'}[rule.entity];
  const clauses = (rule.conditions||[]).map(c=>{
    const cd = RULE.cond(rule.entity, rule.group, c.condId); if(!cd) return '…';
    let s = cd.tmpl;
    cd.params.forEach(p=> s = s.replace('{'+p.key+'}', paramText(p, c.values?.[p.key])));
    return s;
  });
  let cond = clauses.join(rule.combiner==='OR'?' or ':' and ');
  const rw = RULE.reward(rule.reward?.id);
  let then = '';
  if(rw){ then = rw.tmpl; rw.params.forEach(p=> then = then.replace('{'+p.key+'}', paramText(p, rule.reward.values?.[p.key]))); }
  return { subj, cond, then, entity:e };
}

// ── SAMPLE PROMOTIONS with rich metrics ─────────────────────────────────────
const spark = (n,base,amp)=> Array.from({length:n},(_,i)=> Math.max(0, base + Math.sin(i/1.7)*amp + (i*amp/n) + (i%3)*amp*0.3));
const PROMOS = [
  { id:'p1', name:'Green Wednesday BOGO', code:'GREENWED', platform:'Hyperwolf', type:'BOGO', status:'active', auto:false,
    publish:'Jul 8, 2026', expiry:'Jul 31, 2026', desc:'Buy any 2 pre-rolls, get 30% off the pair.',
    rule:{ entity:'bogo', group:'bogo_deals', conditions:[{condId:'buy_any_product', values:{x:2, product:[{n:'Gludaz Pre-Roll',p:13},{n:'#lunchbreak Pre-Roll',p:5}]}}], combiner:'AND', reward:{id:'discount_self', values:{pct:30, cap:20}} },
    m:{ redemptions:1842, redemptionRate:34, limit:5000, uses:1842, uniqueCust:1610, revenue:48230, discountCost:12100, aovWith:41.2, aovBase:31.8, newCust:520, returning:1090, repeatRate:38, velocity:132, roi:3.99, margin:41, budget:60, series:spark(24,40,10) } },
  { id:'p2', name:'First-Timer 20% Off', code:'WELCOME20', platform:'Hyperwolf', type:'User', status:'active', auto:true,
    publish:'Jun 1, 2026', expiry:'—', desc:'20% off first order for brand-new customers.',
    rule:{ entity:'user', group:'activity', conditions:[{condId:'not_purchased', values:{days:9999}}], combiner:'AND', reward:{id:'discount_self', values:{pct:20, cap:30}} },
    m:{ redemptions:3120, redemptionRate:52, limit:null, uses:3120, uniqueCust:3120, revenue:96540, discountCost:24800, aovWith:34.1, aovBase:0, newCust:3120, returning:0, repeatRate:44, velocity:71, roi:3.89, margin:38, budget:null, series:spark(24,55,14) } },
  { id:'p3', name:'$50 Spend · Free Pre-Roll', code:'FREEROLL', platform:'Hyperwolf', type:'Cart', status:'active', auto:true,
    publish:'Jul 1, 2026', expiry:'Aug 1, 2026', desc:'Spend over $50, get a free house pre-roll.',
    rule:{ entity:'cart', group:'total_items', conditions:[{condId:'spend_more', values:{amount:50}}], combiner:'AND', reward:{id:'free_product', values:{product:[{n:'#lunchbreak Pre-Roll',p:5}]}} },
    m:{ redemptions:2405, redemptionRate:41, limit:8000, uses:2405, uniqueCust:2010, revenue:71200, discountCost:12025, aovWith:63.4, aovBase:47.1, newCust:410, returning:1600, repeatRate:51, velocity:98, roi:5.92, margin:47, budget:30, series:spark(24,60,12) } },
  { id:'p4', name:'Wolf Pack VIP · Double Down', code:'VIPX2', platform:'Hyperwolf', type:'User', status:'active', auto:true,
    publish:'May 15, 2026', expiry:'—', desc:'25% off for Wolf Pack VIP members.',
    rule:{ entity:'user', group:'loyalty', conditions:[{condId:'membership_group', values:{group:'Wolf Pack VIP'}}], combiner:'AND', reward:{id:'discount_self', values:{pct:25, cap:60}} },
    m:{ redemptions:940, redemptionRate:68, limit:null, uses:940, uniqueCust:610, revenue:52800, discountCost:11900, aovWith:86.5, aovBase:71.2, newCust:0, returning:610, repeatRate:72, velocity:22, roi:4.44, margin:44, budget:null, series:spark(24,20,5) } },
  { id:'p5', name:'Winback · 30 Days Away', code:'MISSYOU', platform:'Hyperwolf', type:'User', status:'active', auto:true,
    publish:'Jul 5, 2026', expiry:'Aug 5, 2026', desc:'Reactivate customers gone 30+ days with 15% off.',
    rule:{ entity:'user', group:'activity', conditions:[{condId:'not_purchased', values:{days:30}}], combiner:'AND', reward:{id:'discount_self', values:{pct:15, cap:25}} },
    m:{ redemptions:612, redemptionRate:19, limit:4000, uses:612, uniqueCust:612, revenue:19100, discountCost:2860, aovWith:31.2, aovBase:0, newCust:0, returning:612, repeatRate:29, velocity:29, roi:6.68, margin:52, budget:14, series:spark(24,18,6) } },
  { id:'p6', name:'High-THC Flower Flash', code:'LOUD25', platform:'Hyperwolf', type:'Product', status:'scheduled', auto:true,
    publish:'Jul 20, 2026', expiry:'Jul 22, 2026', desc:'25% off flower testing 25%+ THC, this weekend only.',
    rule:{ entity:'product', group:'type_category', conditions:[{condId:'thc_gte', values:{thc:25}},{condId:'in_category', values:{category:['Flower']}}], combiner:'AND', reward:{id:'discount_self', values:{pct:25, cap:40}} },
    m:{ redemptions:0, redemptionRate:0, limit:2000, uses:0, uniqueCust:0, revenue:0, discountCost:0, aovWith:0, aovBase:0, newCust:0, returning:0, repeatRate:0, velocity:0, roi:0, margin:0, budget:0, series:spark(24,0,0) } },
  { id:'p7', name:'Senior Appreciation', code:'SENIOR', platform:'Hyperwolf', type:'User', status:'active', auto:true,
    publish:'Jul 13, 2026', expiry:'—', desc:'10% off for customers 55 and older.',
    rule:{ entity:'user', group:'demographics', conditions:[{condId:'age_range', values:{min:55, max:120}}], combiner:'AND', reward:{id:'discount_self', values:{pct:10, cap:20}} },
    m:{ redemptions:388, redemptionRate:22, limit:null, uses:388, uniqueCust:301, revenue:11400, discountCost:1140, aovWith:38.4, aovBase:34.0, newCust:40, returning:261, repeatRate:47, velocity:12, roi:10.0, margin:58, budget:null, series:spark(24,10,4) } },
  { id:'p8', name:'Dr. Norm\'s Baked Goods 30%', code:'DRNORM30', platform:'Hyperwolf', type:'Product', status:'paused', auto:true,
    publish:'Jul 13, 2026', expiry:'Jul 15, 2026', desc:'30% off Dr. Norm\'s baked goods, up to $50.',
    rule:{ entity:'product', group:'type_category', conditions:[{condId:'belongs_to', values:{category:['Baked Goods'], brand:['Dr. Norm\'s']}}], combiner:'AND', reward:{id:'discount_self', values:{pct:30, cap:50}} },
    m:{ redemptions:274, redemptionRate:28, limit:1000, uses:274, uniqueCust:240, revenue:8200, discountCost:2460, aovWith:44.0, aovBase:39.5, newCust:30, returning:210, repeatRate:33, velocity:18, roi:3.33, margin:40, budget:27, series:spark(24,14,5) } },
  { id:'p9', name:'Stock up · 3+ Cartridges', code:'CART3', platform:'Hemp', type:'Cart', status:'ended', auto:true,
    publish:'Jun 1, 2026', expiry:'Jun 30, 2026', desc:'Buy 3+ cartridges, save 20%.',
    rule:{ entity:'cart', group:'upsell', conditions:[{condId:'atleast_cat', values:{n:3, category:['Cartridges']}}], combiner:'AND', reward:{id:'discount_self', values:{pct:20, cap:35}} },
    m:{ redemptions:1560, redemptionRate:37, limit:2000, uses:1560, uniqueCust:1290, revenue:58900, discountCost:11780, aovWith:92.0, aovBase:61.0, newCust:180, returning:1110, repeatRate:41, velocity:52, roi:5.00, margin:45, budget:78, series:spark(24,45,9) } },
];

// ── OVERVIEW TOTALS (roll-up across active promos) ──────────────────────────
const OVERVIEW = {
  activeCount:6, redemptions:11141, redemptionsDelta:12, revenue:369570, revenueDelta:18,
  discountCost:69065, discountDelta:9, roi:4.35, roiDelta:6, aovLift:22.4, newCust:4830,
  redeemingCust:8874, budgetUsed:54, series:spark(30,300,80),
  revSeries:spark(30,10000,3000),
};

// ── METRIC CATALOG — the 25+ metrics we should track ────────────────────────
// grouped, each with how it's derived. Used by dashboard + detail.
const METRIC_GROUPS = [
  { id:'usage', label:'Redemption & Usage', icon:'target', tone:'info', metrics:[
    { k:'redemptions', label:'Total redemptions', hint:'Count of orders where the promo applied.' },
    { k:'redemptionRate', label:'Redemption rate', hint:'Redemptions ÷ eligible impressions.', unit:'%' },
    { k:'usesRemaining', label:'Uses remaining', hint:'Usage limit minus redemptions.' },
    { k:'uniqueCust', label:'Unique customers', hint:'Distinct customers who redeemed.' },
    { k:'redemptionsPerCust', label:'Redemptions / customer', hint:'Avg times each customer used it.' },
    { k:'velocity', label:'Redemption velocity', hint:'Avg redemptions per day.', unit:'/day' },
    { k:'firstUseHrs', label:'Time to first redemption', hint:'Hours from launch to first use.', unit:'h' },
    { k:'conversion', label:'View→redeem conversion', hint:'Viewed the offer, then completed.', unit:'%' },
  ]},
  { id:'revenue', label:'Revenue Impact', icon:'dollar', tone:'good', metrics:[
    { k:'revenue', label:'Revenue driven', hint:'Attributed revenue on promo orders.', money:true },
    { k:'discountCost', label:'Discount cost', hint:'Total dollars discounted away.', money:true },
    { k:'roi', label:'Return on discount', hint:'Revenue driven ÷ discount cost.', unit:'×' },
    { k:'margin', label:'Margin after discount', hint:'Gross margin % once the promo is applied.', unit:'%' },
    { k:'avgDiscount', label:'Avg discount / order', hint:'Discount cost ÷ redemptions.', money:true },
    { k:'discountDepth', label:'Discount depth', hint:'Discount as % of order value.', unit:'%' },
    { k:'incremental', label:'Incremental revenue', hint:'Revenue above the no-promo baseline.', money:true },
    { k:'budgetUsed', label:'Budget consumed', hint:'Discount spend vs allocated budget.', unit:'%' },
  ]},
  { id:'customer', label:'Customer Behavior', icon:'users', tone:'sativa', metrics:[
    { k:'newVsReturn', label:'New vs returning', hint:'Split of first-time vs repeat buyers.' },
    { k:'newCust', label:'New customers acquired', hint:'First-ever orders on this promo.' },
    { k:'repeatRate', label:'Repeat purchase rate', hint:'% who bought again within 30 days.', unit:'%' },
    { k:'aovLift', label:'AOV lift', hint:'Promo AOV vs non-promo AOV.', unit:'%' },
    { k:'ltvImpact', label:'LTV impact', hint:'Change in 90-day value of redeemers.', money:true },
    { k:'reactivated', label:'Customers reactivated', hint:'Lapsed customers won back.' },
    { k:'abandonRate', label:'Promo cart abandon rate', hint:'Promo carts not checked out.', unit:'%' },
    { k:'multiUse', label:'Multi-redeem customers', hint:'Customers who redeemed 2+ times.' },
  ]},
  { id:'product', label:'Product Performance', icon:'package', tone:'hybrid', metrics:[
    { k:'unitsSold', label:'Units sold on promo', hint:'Total qualifying units moved.' },
    { k:'topSku', label:'Top SKU moved', hint:'Best-selling item under the promo.' },
    { k:'attachRate', label:'Attach rate', hint:'Extra items added alongside the promo item.', unit:'×' },
    { k:'categoryMix', label:'Category mix shift', hint:'Change in category share of sales.', unit:'%' },
    { k:'sellThrough', label:'Sell-through rate', hint:'Promoted inventory sold vs stocked.', unit:'%' },
    { k:'fullVsPromo', label:'Full-price vs promo', hint:'Share sold at full price alongside.', unit:'%' },
  ]},
];

// ── WEEDMAPS CHANNEL — sync layer across platforms ──────────────────────────
// Weedmaps is a publish CHANNEL, not a platform. Each promo can be pushed to WM;
// WM also has its own promos we must reconcile against ours.
const WM_LISTINGS = {
  pickup:   { id:'342170487', name:'Hyperwolf WeHo — Pickup',  kind:'Pickup',   policy:'store on-hand', desc:'Collected in store · no driver' },
  delivery: { id:'342170912', name:'Hyperwolf LA — Delivery',  kind:'Delivery', policy:'driver kits',   desc:'On-shift kits · zip-routed' },
};
// zip → region → drivers → which WM listing the region feeds
const WM_REGIONS = [
  { region:'West Hollywood', zips:['90069','90046','90048','90038'], drivers:[{n:'Andre',on:true,kit:22},{n:'Priya',on:true,kit:18}], listing:'delivery' },
  { region:'Long Beach',     zips:['90802','90803','90814'],         drivers:[{n:'Marcus',on:false,kit:16}],                        listing:'delivery' },
  { region:'Corona',         zips:['92879','92881','92882'],         drivers:[{n:'Dev',on:true,kit:20},{n:'Sam',on:false,kit:14}],  listing:'delivery' },
];
const WM_STORE = { name:'Hyperwolf WeHo', region:'West Hollywood', hours:'9a–9p' };
const WM_SYNC = { productsMapped:142, productsTotal:150, review:6, promosSynced:6, promosTotal:9, ordersToday:37, p50:214, p95:281, errors:0, lastReconcile:'2m ago', tokenDays:11.0, mapOnWrite:true, debounce:0.6, promoPoll:60, reconcileEvery:300 };
// per-promo Weedmaps sync state (keyed to PROMOS ids). state: synced|not_pushed|overlap|paused|ended
const PROMO_WM = {
  p1:{ state:'overlap',    wm_id:'wm_promo_915' },
  p2:{ state:'synced',     wm_id:'wm_promo_881' },
  p3:{ state:'synced',     wm_id:'wm_promo_902' },
  p4:{ state:'not_pushed', wm_id:null },
  p5:{ state:'synced',     wm_id:'wm_promo_838' },
  p6:{ state:'not_pushed', wm_id:null },
  p7:{ state:'synced',     wm_id:'wm_promo_861' },
  p8:{ state:'paused',     wm_id:'wm_promo_809' },
  p9:{ state:'ended',      wm_id:'wm_promo_803' },
};
// promos that live ONLY on Weedmaps — no internal counterpart controlling them.
const WM_ONLY_PROMOS = [
  { wm_id:'wm_promo_777', name:'420 Flash — Flower', amount:'$10 off Flower', apply:'auto', overlap:true, seenDays:2, redemptions:610 },
  { wm_id:'wm_promo_612', name:'WM Weekend Vape 15%', amount:'15% off Vapes', apply:'auto', overlap:false, seenDays:9, redemptions:284 },
];
// the WM → Hyperwolf → driver → customer order flow (auto unless a human is needed)
const WM_ORDER_FLOW = [
  { actor:'Weedmaps',  t:'Customer builds a cart',        d:'On the WM marketplace — Pickup or Delivery.' },
  { actor:'Weedmaps',  t:'Draft webhook (~5s)',            d:'WM posts the cart and waits for our answer.' },
  { actor:'Hyperwolf', t:'Resolve region',                 d:'Delivery: zip → region. Pickup: → the store.', key:true },
  { actor:'Hyperwolf', t:'Narrow to what we can fulfil',   d:'Delivery: on-shift driver kits. Pickup: store stock.', key:true },
  { actor:'Hyperwolf', t:'Reprice, hold stock, answer',    d:'Our response becomes the customer’s cart.' },
  { actor:'Weedmaps',  t:'Create webhook',                 d:'Customer checks out.' },
  { actor:'Hyperwolf', t:'Assign ONE driver / the store',  d:'Delivery: bind a region driver. Pickup: reserve at store.', key:true },
  { actor:'Driver',    t:'Fulfil & push status',           d:'En route → delivered, pushed back to WM.' },
];
// what the integration automates vs. escalates to a human
const WM_AUTOMATION = [
  { area:'Product mapping',  how:'Matched to WM catalog by name + brand + category, scored by ML.', auto:'High-confidence links push automatically.', human:'Low-confidence matches wait in a review queue.' },
  { area:'Customer identity',how:'WM customers merge into ours by device, phone & email fingerprint.', auto:'Clean matches merge silently.', human:'Fraud signals & ambiguous merges are flagged.' },
  { area:'Order routing',    how:'Zip → region → an on-shift driver, or → the store for Pickup.', auto:'Routed in the Draft window, no human.', human:'No-coverage zips & no-driver regions raise an alert.' },
  { area:'Promotions',       how:'Internal promos push to WM; WM promos pull back every 60s.', auto:'Exact matches link automatically.', human:'Overlaps & WM-only promos need a decision.' },
];

// every Weedmaps promotion + EVERY parameter WM exposes, plus its mapping to our promos.
// mapping.state: mapped (linked to an internal promo) | standalone (intentionally WM-only) | unmapped (needs a decision)
const WM_PROMOS = [
  { wm_id:'wm_promo_915', name:'Wax Wednesday — 30% Concentrate', promo_type:'percentage', discount_value:30, discount_unit:'%', display:'30% off', apply:'automatic', code:null,
    scope:'category', targets:['Concentrate'], excludes:[], min_spend:0, min_items:0, max_discount_cents:4000, stackable:false, priority:5,
    channel:'both', customer_segment:'all', new_customer_only:false, first_order_only:false,
    status:'live', start:'2026-06-01', end:null, recurrence:'every Wed', dayparts:'all day', usage_limit:null, per_customer_limit:null,
    redemptions:1842, revenue_cents:3840000, discount_cost_cents:840000, created_source:'Hyperwolf → WM', external_id:'hyperwolf:promo:WAXWED', wm_menu_ids:['342170487','342170912'], last_synced:'1m ago', created_at:'2026-05-30', updated_at:'2026-07-14',
    mapping:{ state:'mapped', internal:'Wax Wednesday', internal_id:'p_wax', confidence:1.0 } },
  { wm_id:'wm_promo_902', name:'Corona Grand Opening 25%', promo_type:'percentage', discount_value:25, discount_unit:'%', display:'25% off', apply:'automatic', code:null,
    scope:'storewide', targets:[], excludes:['Accessories'], min_spend:0, min_items:0, max_discount_cents:6000, stackable:false, priority:8,
    channel:'both', customer_segment:'all', new_customer_only:false, first_order_only:false,
    status:'live', start:'2026-07-06', end:'2026-07-20', recurrence:'none', dayparts:'all day', usage_limit:5000, per_customer_limit:1,
    redemptions:980, revenue_cents:2610000, discount_cost_cents:610000, created_source:'Hyperwolf → WM', external_id:'hyperwolf:promo:CORONA25', wm_menu_ids:['342170487'], last_synced:'3m ago', created_at:'2026-07-01', updated_at:'2026-07-08',
    mapping:{ state:'mapped', internal:'Corona Grand Opening', internal_id:'p_corona', confidence:1.0 } },
  { wm_id:'wm_promo_881', name:'Welcome — $20 Off First Order', promo_type:'fixed', discount_value:20, discount_unit:'$', display:'$20 off', apply:'code', code:'WELCOME20',
    scope:'storewide', targets:[], excludes:[], min_spend_cents:6000, min_items:0, max_discount_cents:2000, stackable:false, priority:10,
    channel:'both', customer_segment:'new', new_customer_only:true, first_order_only:true,
    status:'live', start:'2026-01-01', end:null, recurrence:'evergreen', dayparts:'all day', usage_limit:null, per_customer_limit:1,
    redemptions:3120, revenue_cents:9654000, discount_cost_cents:2480000, created_source:'Hyperwolf → WM', external_id:'hyperwolf:promo:WELCOME20', wm_menu_ids:['342170487','342170912'], last_synced:'just now', created_at:'2025-12-20', updated_at:'2026-06-02',
    mapping:{ state:'mapped', internal:'Welcome — $20 Off First Order', internal_id:'p_welcome', confidence:1.0 } },
  { wm_id:'wm_promo_519', name:'Stilo Supply — BOGO Carts', promo_type:'bogo', discount_value:50, discount_unit:'%', display:'B1G1 50% off', apply:'automatic', code:null,
    scope:'brand', targets:['Stilo Supply'], excludes:[], min_spend:0, min_items:2, max_discount_cents:2500, stackable:false, priority:6,
    channel:'both', customer_segment:'members', new_customer_only:false, first_order_only:false,
    status:'live', start:'2026-06-28', end:'2026-07-31', recurrence:'none', dayparts:'all day', usage_limit:null, per_customer_limit:2,
    redemptions:1204, revenue_cents:4180000, discount_cost_cents:990000, created_source:'Hyperwolf → WM', external_id:'hyperwolf:promo:STILOBOGO', wm_menu_ids:['342170487','342170912'], last_synced:'2m ago', created_at:'2026-06-25', updated_at:'2026-07-10',
    mapping:{ state:'mapped', internal:'Stilo Supply — BOGO Carts', internal_id:'p_stilo', confidence:0.94 } },
  { wm_id:'wm_promo_777', name:'420 Flash — Flower', promo_type:'fixed', discount_value:10, discount_unit:'$', display:'$10 off Flower', apply:'automatic', code:null,
    scope:'category', targets:['Flower'], excludes:[], min_spend:0, min_items:0, max_discount_cents:1000, stackable:true, priority:3,
    channel:'both', customer_segment:'all', new_customer_only:false, first_order_only:false,
    status:'live', start:'2026-07-15', end:'2026-07-20', recurrence:'none', dayparts:'4:20pm–7:00pm', usage_limit:null, per_customer_limit:null,
    redemptions:610, revenue_cents:1430000, discount_cost_cents:610000, created_source:'Weedmaps (native)', external_id:null, wm_menu_ids:['342170487','342170912'], last_synced:'5m ago', created_at:'2026-07-15', updated_at:'2026-07-15',
    mapping:{ state:'unmapped', internal:null, internal_id:null, confidence:0, overlap:true, overlap_with:'Wax Wednesday' } },
  { wm_id:'wm_promo_612', name:'WM Weekend Vape 15%', promo_type:'percentage', discount_value:15, discount_unit:'%', display:'15% off Vapes', apply:'automatic', code:null,
    scope:'category', targets:['Vape'], excludes:[], min_spend:0, min_items:0, max_discount_cents:3000, stackable:false, priority:4,
    channel:'delivery', customer_segment:'all', new_customer_only:false, first_order_only:false,
    status:'live', start:'2026-07-01', end:null, recurrence:'every Sat/Sun', dayparts:'all day', usage_limit:null, per_customer_limit:null,
    redemptions:284, revenue_cents:820000, discount_cost_cents:123000, created_source:'Weedmaps (native)', external_id:null, wm_menu_ids:['342170912'], last_synced:'8m ago', created_at:'2026-06-28', updated_at:'2026-07-05',
    mapping:{ state:'standalone', internal:null, internal_id:null, confidence:0, note:'Kept WM-only on purpose — Weedmaps-exclusive weekend deal.' } },
  { wm_id:'wm_promo_803', name:'Summer Kickoff $5', promo_type:'fixed', discount_value:5, discount_unit:'$', display:'$5 off', apply:'code', code:'SUMMER',
    scope:'storewide', targets:[], excludes:[], min_spend_cents:4000, min_items:0, max_discount_cents:500, stackable:false, priority:2,
    channel:'both', customer_segment:'all', new_customer_only:false, first_order_only:false,
    status:'ended', start:'2026-06-01', end:'2026-06-30', recurrence:'none', dayparts:'all day', usage_limit:3000, per_customer_limit:1,
    redemptions:1204, revenue_cents:3190000, discount_cost_cents:602000, created_source:'Hyperwolf → WM', external_id:'hyperwolf:promo:SUMMER', wm_menu_ids:['342170487'], last_synced:'1h ago', created_at:'2026-05-28', updated_at:'2026-07-01',
    mapping:{ state:'unmapped', internal:null, internal_id:null, confidence:0, note:'Ended on WM but the internal promo it mirrored was deleted — orphaned link.' } },
];

Object.assign(window, { pfmt, CATEGORIES, BRANDS, PRODUCTS, MEMBER_GROUPS, PRODUCT_TYPES, PLATFORMS,
  ENTITIES, REWARDS, RULE, paramDefault, paramText, ruleToPlain, PROMOS, OVERVIEW, METRIC_GROUPS,
  WM_LISTINGS, WM_REGIONS, WM_STORE, WM_SYNC, PROMO_WM, WM_ONLY_PROMOS, WM_PROMOS, WM_ORDER_FLOW, WM_AUTOMATION });
