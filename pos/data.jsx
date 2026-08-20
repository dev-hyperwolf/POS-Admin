// ── POS demo data ──────────────────────────────────────────────────────────
const CATS = ['Flower','Vapes','Pre-Rolls','Concentrates','Edibles','Wellness','Deals'];

// hue assigned per category for thumbnails
const CAT_HUE = { Flower:110, Vapes:215, 'Pre-Rolls':18, Concentrates:38, Edibles:330, Wellness:168, Deals:48 };

// Category color scheme (Hyperwolf-style, one accent per category). {dot, soft fg/bg}
const CAT_COLOR = {
  Flower:       '#3DA35D',
  Vapes:        '#2E7CF6',
  'Pre-Rolls':  '#E8643C',
  Concentrates: '#D99A1C',
  Edibles:      '#E1477C',
  Wellness:     '#21A89B',
  Deals:        '#FFD100',
  All:          '#6E6E66',
};

const B = window.HW_BRANDS.name;

function P_(name, sku, brand, strain, cat, thc, wt, price, was, qty, hue){
  // deterministic unit cost → profit margin (varies 28%–68% by sku)
  const h = sku.split('').reduce((a,ch)=>a+ch.charCodeAt(0),0);
  const marginPct = 0.28 + (h % 41)/100;            // 0.28 … 0.68
  const cost = Math.max(0.5, +(price*(1-marginPct)).toFixed(2));
  const margin = +((price-cost)/price).toFixed(3);  // 0..1
  return { id:sku, name, sku, brand, strain, cat, thc, wt, price, was:was||null, qty, cost, margin, hue:hue??CAT_HUE[cat]??90, active:qty>0 };
}

const PRODUCTS = [
  P_('Cake Crasher','H480PRO1',B.jeeter,'Indica','Pre-Rolls',28.6,'1g',15,20,37,16),
  P_('Blueberry Pancakes','F2Q4EN2C',B.lowell,'Hybrid','Flower',null,'1g',17,20,1,118),
  P_('CDS Product','212FFSAFA',B.cann,'Sativa','Wellness',12,'12g',12,null,50,168),
  P_('Product Willy','WIL20X9',B.connected,'Hybrid','Flower',20,'20g',24,26,106,120),
  P_('Doubleshot','DBL78MG',B.wyld,'Hybrid','Edibles',78,'10mg',20,null,84,330),
  P_('Fruit Punch All-In-One','FP94AIO',B.stiiizy,'Sativa','Vapes',94.2,'1g',28,null,36,215),
  P_('Cheetah Piss Pre-Roll','CHP1GPR',B.jeeter,'Sativa','Pre-Rolls',null,'1g',5,null,278,18),
  P_('Neutron Cookies Ounce Smalls','NCO28SM',B.lowell,'Indica','Flower',25.7,'28g',77,null,220,118),
  P_('Gooberz Ready-To-Roll','GBZ35RR',B.alien,'Hybrid','Flower',25.8,'3.5g',10,null,196,116),
  P_('Blast Radius Smalls','BRD35SM',B.connected,'Hybrid','Flower',27.8,'3.5g',1,13,459,112),
  P_('Blast Off Smalls','BOF35SM',B.connected,'Indica','Flower',28.0,'3.5g',13,null,231,114),
  P_('Space Ripper Ounce Smalls','SRO28SM',B.connected,'Indica','Flower',28.7,'28g',2,77,200,118),
  P_('First Class Funk Live Resin','FCF1LRS',B.raw,'Hybrid','Concentrates',72.2,'1g',22,23,40,38),
  P_('Thin Mint Sugar','TMS1SUG',B.labs710,'Hybrid','Concentrates',76.8,'1g',2,13,6,36),
  P_('Firewalker Sugar','FWK1SUG',B.labs710,'Sativa','Concentrates',75.9,'1g',5,13,35,40),
  P_('Bumble Bee Honey Joint','BBH2JNT',B.jeeter,'Hybrid','Pre-Rolls',null,'2g',32,34,215,20),
  P_('Lunar Drift Indica Drops','LDI4DRP',B.kiva,'Indica','Edibles',28.5,'4g',40,null,558,328),
  P_('Weed Kick THCa Joint 6th','BNJNJ0IK',B.papa,'Hybrid','Wellness',25,'4g',45,1000,161,168),
  P_('Bay Weeds Yo','984X9CJO',B.raw,'Sativa','Concentrates',null,null,28,null,40,38),
  P_('Candy Kush THCa Flower 8th','FFF81Q98',B.lowell,'Hybrid','Flower',null,'3.5g',35,null,72,110),
  P_('Ganja-12 Distillate','GNJ1123',B.heavy,'Hybrid','Vapes',88,'1g',38,null,52,215),
  P_('Archest Pre-Roll Pack','ARCH001',B.jeeter,'Indica','Pre-Rolls',null,'5x.5g',30,null,44,18),
  P_('Sour Tangie Live Badder','STG1BAD',B.raw,'Sativa','Concentrates',74.1,'1g',26,32,58,36),
  P_('Midnight Mint Gummies','MMG100E',B.kiva,'Indica','Edibles',null,'100mg',18,null,310,330),
];

// Members / customers
const MEMBERS = [
  { id:'m1', name:'Harshil Gupta', email:'harshil@yopmail.com', phone:'(951) 555-0142', group:'Walk-In', type:'AdultUse', delivery:'Pick-up', visits:1, points:0, wallet:0, member:true },
  { id:'m2', name:'Manisha Saini', email:'manisha@yopmail.com', phone:'(951) 555-0199', group:'Delivery', type:'MedicinalUser', delivery:'Pick-up', visits:2, points:340, wallet:12.50, member:true, second:true },
  { id:'m3', name:'Girish Sharma', email:'girish@yopmail.com', phone:'(951) 555-0177', group:'Walk-In', type:'AdultUse', delivery:'Pick-up', visits:5, points:1280, wallet:0, member:true },
  { id:'m4', name:'Dony Fernandez', email:'dony@yopmail.com', phone:'(951) 555-0163', group:'Delivery', type:'AdultUse', delivery:'Delivery', visits:3, points:210, wallet:0 },
  { id:'m5', name:'Joseph Levi', email:'joseph@yopmail.com', phone:'(951) 555-0188', group:'Walk-In', type:'MedicinalUser', delivery:'Pick-up', visits:8, points:2640, wallet:48.00, member:true },
];

// Check-in queue (people physically in store / waiting). guests[] are captured
// AT CHECK-IN and grouped under the primary — sale stays on primary, guests are referrals.
const CHECKINS = [
  { id:'c1', memberId:'m1', name:'Harshil Gupta', group:'Walk-In', type:'AdultUse', delivery:'Pick-up', wait:'0h 0m 58s', waitSec:58, claimedBy:'Manisha Saini', member:true, visit:1, guests:['Alex Romero'] },
  { id:'c2', memberId:'m2', name:'Manisha Saini', group:'Delivery', type:'MedicinalUser', delivery:'Pick-up', wait:'0h 0m 34s', waitSec:34, claimedBy:null, second:true, visit:2, guests:[] },
  { id:'c3', memberId:'m3', name:'Girish Sharma', group:'Walk-In', type:'AdultUse', delivery:'Pick-up', wait:'0h 2m 11s', waitSec:131, claimedBy:null, member:true, visit:5, guests:['Mia Tran','Sam Cole'] },
  { id:'c4', memberId:'m5', name:'Joseph Levi', group:'Walk-In', type:'MedicinalUser', delivery:'Pick-up', wait:'0h 4m 02s', waitSec:242, claimedBy:null, member:true, visit:8, guests:[] },
];

// Visit label — first / second / third, capped at “3rd visit”
function visitLabel(n){ n = n || 1; return n >= 3 ? '3rd visit' : n === 2 ? '2nd visit' : '1st visit'; }
function visitOrdinal(n){ n = n || 1; return n >= 3 ? 3 : n; } // 1|2|3 for color mapping

// Loyalty rewards the associate can redeem against a member's points
const REWARDS = [
  { id:'250off', label:'$2.50 off', short:'$2.50', cost:100, value:2.5, icon:'tag',  kind:'discount' },
  { id:'5off',   label:'$5 off',    short:'$5',    cost:200, value:5,   icon:'tag',  kind:'discount' },
  { id:'10off',  label:'$10 off',   short:'$10',   cost:400, value:10,  icon:'tag',  kind:'discount' },
  { id:'20off',  label:'$20 off',   short:'$20',   cost:800, value:20,  icon:'tag',  kind:'discount' },
  // Birthday is a membership perk, not a points redemption — no cost gate.
  { id:'bday',   label:'Birthday $20', short:'$20', cost:0, value:20,  icon:'gift', kind:'discount', bday:true },
];

// Waiting-room pool — people who can be grouped as guests under a check-in
const GUEST_POOL = ['Alex Romero','Priya Nair','Sam Cole','Jordan Vu','Mia Tran','Dev Anand','Lena Brooks'];

// Order board
function O_(num, name, total, source, channel, pay, badge, age, items, stage, strainHue){
  return { id:'ORD-'+num, num, name, total, source, channel, pay, badge, age, items, stage, hue:strainHue??200 };
}
const ORDERS = [
  O_('00224','Aaron Wells', 52.10,'Stilo','Store','Card','Member','0h 6m',3,'verify',12),
  O_('00223','Priya Nair', 28.00,'Web','Delivery','Prepaid','Prepaid','0h 14m',2,'verify',300),
  O_('00222','Dony Fernandez', 17.00,'Stilo','Store','Cash','Prepaid','2h 8m',1,'pack',40),
  O_('00221','Girish Sharma', 17.63,'Stilo','Store','Cash','Member','22h 34m',2,'pack',110),
  O_('00220','Lena Brooks', 64.25,'Web','Delivery','Card','Prepaid','0h 22m',4,'packing',215),
  O_('00219','Marcus Hill', 41.00,'Stilo','Store','Split',null,'1h 2m',3,'packing',168),
  O_('00218','Tara Schultz', 19.50,'Web','Delivery','Card','Member','3h 40m',1,'ready',330),
  O_('00217','Sam Oduya', 88.00,'Stilo','Store','Card','Member','4h 11m',5,'ready',36),
  O_('00216','Nina Patel', 33.20,'Web','Delivery','Prepaid','Prepaid','5h 02m',2,'done',18),
];

const STORE = { name:'Hyperwolf Lake Elsinore', id:'HW-00001-101', count:4 };

// Delivery regions + a driver roster (sampled — fleet is ~100 across regions)
const REGIONS = ['Lake Elsinore','Wildomar','Lakeland Vlg','Temescal','Murrieta'];
const DRIVERS = [
  { id:'d1', name:'Theo Reyes',    region:'Lake Elsinore', status:'on-route', stops:3, cap:6, eta:'12m' },
  { id:'d2', name:'Maya Cole',     region:'Wildomar',      status:'on-route', stops:5, cap:6, eta:'24m' },
  { id:'d3', name:'Dev Anand',     region:'Lakeland Vlg',  status:'idle',     stops:0, cap:6, eta:'—' },
  { id:'d4', name:'Sam Okoro',     region:'Temescal',      status:'on-route', stops:2, cap:5, eta:'31m' },
  { id:'d5', name:'Lena Brooks',   region:'Murrieta',      status:'idle',     stops:1, cap:6, eta:'8m' },
  { id:'d6', name:'Aaron Wells',   region:'Lake Elsinore', status:'offline',  stops:0, cap:6, eta:'—' },
];
const FLEET_TOTAL = 98;

// Delivery routing meta — keyed by order id. x/y are normalized 0–1 map coords.
const DELIVERY = {
  'ORD-00223': { addr:'2841 Mission Trail', zone:'Wildomar', dist:4.2, eta:18, driver:'Theo R.', x:.32, y:.40, win:'4:30–5:00' },
  'ORD-00220': { addr:'118 Diamond Dr',     zone:'Lake Elsinore', dist:2.1, eta:11, driver:'Theo R.', x:.54, y:.30, win:'4:45–5:15' },
  'ORD-00218': { addr:'905 Grand Ave',      zone:'Lakeland Vlg', dist:6.8, eta:26, driver:'Unassigned', x:.20, y:.66, win:'5:00–5:30' },
  'ORD-00216': { addr:'334 Riverside Dr',   zone:'Temescal',     dist:9.3, eta:34, driver:'Unassigned', x:.74, y:.58, win:'5:15–5:45' },
};

// Today's performance — store + logged-in associate
const STATS = {
  storeNetToday: 8420.55,
  storeOrdersToday: 142,
  associate: {
    name:'Manisha Saini',
    netToday: 1864.20,
    ordersToday: 23,
    aov: { day:81.05, week:76.40, month:79.20 },
    aovDelta: { day:6, week:-2, month:3 },
    goal: 90,            // AOV goal ($)
  },
};

// Customer's go-to category (deterministic per member)
function favCategory(m){
  if(!m) return null;
  const cats = ['Flower','Vapes','Pre-Rolls','Concentrates','Edibles','Wellness'];
  const seed = (m.name||'').length + (m.visits||1)*3 + (m.points||0);
  return cats[seed % cats.length];
}

// Personalized up-sell — ranks by the member's go-to category, what pairs with
// the current cart, on-sale items, then potency/stock. Each rec carries a reason.
function upsell(cartSkus, customer){
  cartSkus = cartSkus || [];
  const inCart = PRODUCTS.filter(p=>cartSkus.includes(p.sku));
  const cartCats = [...new Set(inCart.map(p=>p.cat))];
  const fav = favCategory(customer);
  const pairs = { Flower:'Pre-Rolls','Pre-Rolls':'Flower', Vapes:'Concentrates', Concentrates:'Vapes', Edibles:'Wellness', Wellness:'Edibles' };
  const wantPair = new Set(cartCats.map(c=>pairs[c]).filter(Boolean));
  const scored = PRODUCTS.filter(p=>!cartSkus.includes(p.sku) && p.qty>0).map(p=>{
    let score=0, reason='Popular with members';
    if(fav && p.cat===fav){ score+=6; reason='Usually buys '+fav; }
    if(wantPair.has(p.cat)){ score+=4; if(score<=4) reason='Pairs with '+cartCats[0]; }
    if(p.was){ score+=3; if(score<=3) reason='On sale now'; }
    if(p.thc!=null && p.thc>=75){ score+=1; }
    if(p.qty>180) score+=0.5;
    return { p, score, reason };
  }).sort((a,b)=> b.score-a.score || b.p.price-a.p.price);
  return scored.slice(0,6).map(s=>({ ...s.p, _reason:s.reason }));
}

// ── Weedmaps channel ───────────────────────────────────────────────────────
// WM is a publish channel over our catalog. Each product syncs to one or both
// WM listings (Pickup = store stock · Delivery = on-shift driver kits). external_id
// is the sacred contract that ties a WM menu item back to our SKU — it never churns.
const WM_LISTINGS = { pickup:{ id:'342170487', kind:'Pickup', policy:'store on-hand' }, delivery:{ id:'342170912', kind:'Delivery', policy:'driver kits' } };
// Per-SKU sync state overrides. Default (below) = synced to both listings.
// state: synced | pending (queued, not confirmed) | error (WM rejected) | unlisted (not pushed)
const WM_PRODUCT_SYNC = {
  '984X9CJO': { state:'error',    listings:['pickup'],              ext:'HW-984X9CJO', last:'4h ago',  issue:'Category “Concentrates” has no mapped Weedmaps taxonomy node — item hidden on WM until mapped.' },
  'TMS1SUG':  { state:'pending',  listings:['delivery'],            ext:'HW-TMS1SUG',  last:'—',       issue:'Queued in the last push — awaiting Weedmaps confirmation.' },
  'MMG100E':  { state:'unlisted', listings:[],                      ext:'HW-MMG100E',  last:'never',   issue:'Not published to Weedmaps. Push to make it available online.' },
  'FCF1LRS':  { state:'error',    listings:['pickup','delivery'],   ext:'HW-FCF1LRS',  last:'1h ago',  issue:'Price on WM ($22) is stale vs POS — last write was rejected (listing paused by retailer).' },
  'BRD35SM':  { state:'synced',   listings:['pickup','delivery'],   ext:'HW-BRD35SM',  last:'just now' },
};
PRODUCTS.forEach((p)=>{ p.wm = WM_PRODUCT_SYNC[p.sku] || { state:'synced', listings:['pickup','delivery'], ext:'HW-'+p.sku, last:['3m ago','12m ago','28m ago','1h ago'][p.sku.charCodeAt(0)%4] }; });

// WM order status the customer sees on weedmaps.com, mapped from OUR fulfillment stage.
// WM state machine: DRAFT → PENDING → IN_PROGRESS → READY_FOR_ATTAINMENT → COMPLETE
//                                              ↘ CANCELED_CUSTOMER / CANCELED_SELLER / FAILED
// DRAFT is the synchronous cart webhook — validated before it ever becomes an order here.
const WM_STATUS_MAP = {
  verify:  { wm:'PENDING',              label:'Pending',     cust:'Order received — being reviewed',  tone:'neutral' },
  pack:    { wm:'IN_PROGRESS',          label:'In progress', cust:'Store is preparing your order',    tone:'info' },
  packing: { wm:'IN_PROGRESS',          label:'In progress', cust:'Store is preparing your order',    tone:'info' },
  ready:   { wm:'READY_FOR_ATTAINMENT', label:'Ready',       cust:'Ready for pickup',                 tone:'good' },
  done:    { wm:'COMPLETE',             label:'Complete',    cust:'Order completed',                  tone:'neutral' },
  canceled:{ wm:'CANCELED_SELLER',      label:'Canceled',    cust:'Canceled by store',                tone:'bad' },
};
const WM_STATUS_ORDER = ['DRAFT','PENDING','IN_PROGRESS','READY_FOR_ATTAINMENT','COMPLETE'];

// WM-sourced orders. Treated as pickup orders (channel 'Store') unless delivery.
// Each is prepaid on WM and enters at 'verify' — WM lets carts through with fake
// name / phone / email / no ID, so verification is a hard gate before we prep.
const WM_NEW = [
  O_('00231','Jordan Meyer',   74.25,'Weedmaps','Store','Prepaid','Weedmaps','0h 3m', 3,'verify', 110),
  O_('00232','xXblaze420Xx',   42.00,'Weedmaps','Store','Prepaid','Weedmaps','0h 8m', 2,'verify', 215),
  O_('00233','Dana Whitfield', 58.50,'Weedmaps','Store','Prepaid','Weedmaps','0h 21m',2,'pack',   330),
  O_('00234','Sam Reyes',      31.00,'Weedmaps','Delivery','Prepaid','Weedmaps','0h 15m',1,'verify',18),
  O_('00235','Nina Alvarez',   46.00,'Weedmaps','Store','Prepaid','Weedmaps','1h 12m',2,'ready',  36),
  O_('00236','m.tran.94',     22.00,'Weedmaps','Store','Prepaid','Weedmaps','0h 5m', 1,'verify', 150),
  O_('00237','greenthumb_951',88.40,'Weedmaps','Store','Prepaid','Weedmaps','0h 9m', 4,'verify', 96),
];
ORDERS.unshift(...WM_NEW);

// Verification + fraud + identity-match signals for each WM order (keyed by order id).
// match: 'existing' (confident single match) | 'ambiguous' (2+ candidates) | 'new' (no match)
// checks: pass | partial | suspicious | missing | verified | unverified | valid | invalid
const WM_ORDER = {
  'ORD-00231': { wmId:'WM-88213', contact:{ name:'Jordan Meyer', phone:'(951) 555-0199', email:'jordanm@gmail.com', address:null }, matchOn:['phone','email'], wmStatus:'PENDING', risk:12, level:'low',
    match:'existing', matchId:'m2', matchConf:0.96,
    checks:{ id:'pass', name:'match', phone:'verified', email:'valid', address:'n/a' }, flags:[] },
  'ORD-00232': { wmId:'WM-88240', contact:{ name:'xXblaze420Xx', phone:'(000) 000-0000', email:'blaze420@mailinator.co', address:null }, matchOn:[], wmStatus:'PENDING', risk:81, level:'high',
    match:'new',
    // Nothing sent — the number on the order is junk, so the link would bounce.
    remoteId:{ status:'idle', link:'hyprwlf.co/id/B4x9', attempts:[] },
    checks:{ id:'missing', name:'suspicious', phone:'unverified', email:'invalid', address:'n/a' },
    flags:['Display name fails name heuristics','Email hard-bounced on send','No ID uploaded / age unverified','4th order in 1h from the same device fingerprint'] },
  'ORD-00233': { wmId:'WM-88301', contact:{ name:'Dana Whitfield', phone:'(951) 555-0177', email:'dana.w@yahoo.com', address:null }, matchOn:['name','phone'], wmStatus:'IN_PROGRESS', risk:38, level:'medium',
    match:'ambiguous', candidates:['m4','m2'], matchConf:0.62,
    checks:{ id:'pass', name:'partial', phone:'verified', email:'valid', address:'n/a' },
    flags:['Name + phone match two different customers'] },
  'ORD-00234': { wmId:'WM-88355', contact:{ name:'Sam Reyes', phone:'(714) 555-0148', email:'sreyes@outlook.com', address:'1442 W 5th St, Santa Ana, CA 92703' }, matchOn:[], wmStatus:'PENDING', risk:67, level:'high', delivery:true,
    match:'new',
    // Auto-sent the moment the order landed — waiting on them to finish.
    remoteId:{ status:'sent', sentAt:'4 min ago', by:'System', link:'hyprwlf.co/id/K3p8',
      attempts:[{ at:'4 min ago', by:'System · auto', status:'delivered', receipt:'carrier ack 1.1s' }] },
    checks:{ id:'pending', name:'match', phone:'unverified', email:'valid', address:'unverified' },
    flags:['Delivery to an address we can’t verify','Phone not SMS-verified — delivery orders require it'] },
  'ORD-00235': { wmId:'WM-88190', contact:{ name:'Nina Alvarez', phone:'(951) 555-0163', email:'nina.alvarez@gmail.com', address:null }, matchOn:['phone','email','id'], wmStatus:'READY_FOR_ATTAINMENT', risk:8, level:'low',
    match:'existing', matchId:'m3', matchConf:0.99, merged:true,
    checks:{ id:'pass', name:'match', phone:'verified', email:'valid', address:'n/a' }, flags:[] },
  'ORD-00236': { wmId:'WM-88402', contact:{ name:'m.tran.94', phone:'(951) 555-0121', email:'m.tran94@gmail.com', address:null }, matchOn:['name'], wmStatus:'PENDING', risk:24, level:'low',
    match:'existing', matchId:'m3', matchConf:0.71,
    checks:{ id:'pending', name:'partial', phone:'unverified', email:'valid', address:'n/a' },
    flags:['Name matches a guest in a party already checked in'] },
  'ORD-00237': { wmId:'WM-88418', contact:{ name:'greenthumb_951', phone:null, email:'greenthumb951@proton.me', address:null }, matchOn:[], wmStatus:'PENDING', risk:58, level:'medium',
    match:'new',
    remoteId:{ status:'opened', sentAt:'8 min ago', by:'Manisha Saini', link:'hyprwlf.co/id/T9w1',
      attempts:[{ at:'8 min ago', by:'Manisha Saini · manual', status:'delivered', receipt:'carrier ack 0.9s' }] },
    checks:{ id:'missing', name:'suspicious', phone:'missing', email:'valid', address:'n/a' },
    flags:['No phone on the order payload','Handle has never been bound to a customer'] },
};

// ── Order ↔ check-in binding ────────────────────────────────────────────────
// The rule the whole floor runs on: EVERY order is owned by exactly one
// check-in. Orders from an outside channel (Weedmaps, web) arrive as a handle,
// not a person, so we score them against the people in the room:
//   auto  ≥90 → bound silently, one tap to change
//   confirm 60-89 → bound but flagged, associate nods it through
//   none  <60 → no owner, sits in the Needs-match lane, CANNOT be packed
// Every manual bind writes the handle onto the customer, so the same handle
// matches at 100 next time — the lane shrinks as the store uses it.
const MATCH_WEIGHT = { handle:100, code:99, phone:92, email:88, name:64, cart:40, time:15 };
const SIGNAL_LABEL = { handle:'handle already merged', code:'pickup code read at door', phone:'phone exact',
  email:'e-mail exact', name:'name matches ID', cart:'cart matches a held order', time:'arrived within 30 min' };
const ORDER_BIND = {
  'ORD-00231': { state:'auto', conf:96, checkinId:'c2', signals:['phone','handle'] },
  'ORD-00235': { state:'auto', conf:99, checkinId:'c3', signals:['phone','email','handle'] },
  'ORD-00233': { state:'confirm', conf:62, checkinId:'c2', signals:['name','phone'],
    why:'Name and phone match two different customers — confirm which one before packing' },
  'ORD-00236': { state:'confirm', conf:71, checkinId:'c3', guest:'Mia Tran', signals:['name','time'],
    why:'Matches a guest in this party, not the primary — confirm so the limit and points are hers' },
  'ORD-00232': { state:'none', conf:18, signals:[], why:'Fake phone, handle never seen, e-mail hard-bounced',
    candidates:[{ checkinId:'c4', conf:52, signals:['time'] }, { checkinId:'c2', conf:14, signals:['time'] }] },
  'ORD-00237': { state:'none', conf:12, signals:[], why:'No phone on the payload and the handle is new to us',
    candidates:[{ checkinId:'c4', conf:38, signals:['time'] }] },
  'ORD-00234': { state:'none', conf:22, signals:[], why:'Delivery order — nobody in the room to match it to', candidates:[] },
};
// Orders on our own channels are already signed in as themselves.
function bindFor(o){ return ORDER_BIND[o.id] || { state:'auto', conf:100, self:true, signals:[] }; }

// ── Identity assurance records (see pos/verification.jsx for the model) ─────
// Events, not flags. Tier is derived: doc-on-file → +phone-confirmed → delivery.
const IDV = {
  m1: { doc: { type: 'CA DL', num: '••••4821', expires: '2029-04-11', scannedAt: 'Today 2:02 PM', by: 'Priya Nair', where: 'Front Counter 1', photo: true },
        phone: { value: '(951) 555-0142', smsVerified: false, sentAt: 'Today 2:03 PM' }, remoteId: null },
  m2: { doc: { type: 'CA DL', num: '••••9134', expires: '2028-08-02', scannedAt: 'Mar 14 · 4:41 PM', by: 'Marcus Hill', where: 'Front Counter 2', photo: true },
        phone: { value: '(951) 555-0199', smsVerified: false, sentAt: '2 min ago' }, remoteId: null },
  m3: { doc: { type: 'CA DL', num: '••••2207', expires: '2030-01-19', scannedAt: 'Jun 2 · 7:12 PM', by: 'Theo Reyes', where: 'door', photo: true },
        phone: { value: '(951) 555-0163', smsVerified: true, verifiedAt: 'Jun 2' }, remoteId: null },
  m4: { doc: null, phone: { value: '(951) 555-0177', smsVerified: true, verifiedAt: 'May 30' },
        remoteId: { status: 'passed', at: 'May 30' } },
  // Never walked in, no document anyone has held — the remote-check case.
  m5: { doc: null, phone: { value: '(951) 555-0188', smsVerified: false },
        remoteId: { status: 'sent', sentAt: 'Today 1:47 PM', by: 'Manisha Saini', link: 'hyprwlf.co/id/Q7m2',
          attempts: [{ at: 'Today 1:47 PM', by: 'Manisha Saini · manual', status: 'delivered', receipt: 'carrier ack 1.2s' }] } },
};

// ── Tax ── CA cannabis tax always presented in this order: local, state
// excise, state sales. One helper so every screen agrees.
const TAX_RATES = { local: 0.0222, excise: 0.15, sales: 0.06 };
function taxBreakdown(base) {
  const b = Math.max(0, +base || 0);
  const local = +(b * TAX_RATES.local).toFixed(2);
  const excise = +(b * TAX_RATES.excise).toFixed(2);
  const sales = +(b * TAX_RATES.sales).toFixed(2);
  const total = +(local + excise + sales).toFixed(2);
  return { local, excise, sales, total, rate: b > 0 ? total / b : 0,
    lines: [
      { k: 'Local cannabis tax (2.22%)', v: local },
      { k: 'State excise tax (15%)', v: excise },
      { k: 'State sales tax (6%)', v: sales }] };
}

const fmt = {
  money:(n)=> '$'+Number(n).toLocaleString('en-US',{ minimumFractionDigits:2, maximumFractionDigits:2 }),
  money0:(n)=> '$'+Number(n).toLocaleString('en-US'),
};

// ── Writes ─────────────────────────────────────────────────────────────────
// Every screen renders straight off MEMBERS / CHECKINS, so a "create" that only
// closed its modal was indistinguishable from a dead button: the operator got
// full positive feedback for a record that was never written. These are the one
// place a record is created or changed, and they notify subscribers so the
// table, the KPI rail and the waiting strip all move together.
const _hwSubs = new Set();
const _hwNotify = () => _hwSubs.forEach((fn) => { try { fn(); } catch {} });
let _hwSeq = 0;
const _hwId = (prefix) => prefix + Date.now().toString(36) + (++_hwSeq).toString(36);

function addMember(m) {
  const rec = {
    id: (m && m.id) || _hwId('m'),
    name: (m && m.name || '').trim() || 'Unnamed customer',
    email: m && m.email || '—', phone: m && m.phone || '—',
    group: m && m.group || 'Standard', type: m && m.type || 'AdultUse',
    delivery: m && m.delivery || 'Pick-up',
    visits: m && m.visits || 0, points: m && m.points || 0, wallet: +(m && m.wallet || 0),
    member: !!(m && m.member),
  };
  MEMBERS.unshift(rec);
  _hwNotify();
  return rec;
}

function updateMember(id, patch) {
  const m = MEMBERS.find((x) => x.id === id);
  if (!m || !patch) return null;
  ['name', 'phone', 'email', 'group', 'type'].forEach((k) => {
    if (patch[k] != null && String(patch[k]).trim()) m[k] = String(patch[k]).trim();
  });
  _hwNotify();
  return m;
}

// A credit is money. It either lands on the record or it is refused out loud —
// there is no third option where the manager is told it worked.
function creditWallet(id, amount, reason) {
  const m = MEMBERS.find((x) => x.id === id);
  const amt = Number(amount);
  if (!m || !isFinite(amt) || amt <= 0) return null;
  m.wallet = +(((+m.wallet || 0) + amt).toFixed(2));
  _hwNotify();
  return { member: m, amount: +amt.toFixed(2), reason: reason || 'Manual credit' };
}

// The check-in IS the record. An unknown customer becomes a real member first —
// a person waiting in the room who exists nowhere is not a check-in.
function addCheckIn(p) {
  const c = p && p.customer;
  if (!c) return null;
  let member = c.id && MEMBERS.find((x) => x.id === c.id);
  if (!member) member = addMember({ name: c.name, email: c.email, phone: c.phone, type: p.type || c.type, group: c.group, member: c.member });
  const rec = {
    id: _hwId('c'), memberId: member.id, name: member.name,
    group: member.group, type: p.type || member.type, delivery: p.delivery || 'Pick-up',
    wait: '0h 0m 00s', waitSec: 0, claimedBy: null, member: !!member.member,
    visit: (member.visits || 0) + 1, guests: (p.guests || []).slice(),
  };
  CHECKINS.push(rec);
  _hwNotify();
  return rec;
}

/**
 * Take a person off the waiting list — they left, or the check-in was a mistake.
 *
 * The ✕ on a check-in card had no handler at all, so the one control that means
 * "this person is not here any more" left them in the room for ever. This
 * REMOVES the check-in; it does not touch the customer record, because leaving
 * the queue is not the same as ceasing to exist.
 *
 * Returns the removed record, or null when the id is unknown — the caller can
 * then say so instead of reporting a removal that never happened.
 */
function removeCheckIn(id) {
  const i = CHECKINS.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const [rec] = CHECKINS.splice(i, 1);
  _hwNotify();
  return rec;
}

/**
 * Whether this customer's Weedmaps identity is linked to us.
 *
 * This used to be DERIVED from the id's last character, which meant "Unlink
 * Weedmaps identity" had nothing it could possibly write to: the answer was
 * recomputed from the id every render. The derivation stays as the seed value
 * so the demo still shows a mix, but once anyone sets it, the stored field wins.
 */
function wmLinked(m) {
  if (!m) return false;
  if (m.wm != null) return !!m.wm;
  return m.id.charCodeAt(m.id.length - 1) % 2 === 0;
}

function setWmLink(id, linked) {
  const m = MEMBERS.find((x) => x.id === id);
  if (!m) return null;
  m.wm = !!linked;
  _hwNotify();
  return m;
}

// Hand-off for "check in & start sale": the register reads this once on mount,
// so the sale opens on the person who just checked in rather than on whatever
// ticket the register happens to seed itself with.
// ── Order writes ───────────────────────────────────────────────────────────
//
// Same gap as MEMBERS, same symptom. Nothing could write to ORDERS either, so
// "Save changes" toasted "Order updated" and committed nothing, a completed sale
// printed a receipt naming an order id that was never created, and no control
// anywhere moved an order between fulfilment stages — a grep for `.stage =`
// found only the seed literals.
//
// The stages are the ones the queue and WM_STATUS_MAP already agree on. Keeping
// the order fixed here means a caller cannot skip 'pack' by passing a typo.
const STAGES = ['verify', 'pack', 'packing', 'ready', 'done'];

function orderById(id) { return ORDERS.find((o) => o.id === id) || null; }

/**
 * Create an order. Used by a completed sale, and by anything that needs a real
 * record rather than a receipt line that refers to nothing.
 */
function addOrder(o) {
  const num = String(Math.max(0, ...ORDERS.map((x) => parseInt(String(x.num || '').replace(/\D/g, ''), 10) || 0)) + 1).padStart(5, '0');
  const items = (o && o.items) || 0;
  const rec = {
    id: (o && o.id) || 'ORD-' + num,
    num: (o && o.num) || num,
    name: (o && o.name || '').trim() || 'Walk-in',
    total: +(+(o && o.total || 0)).toFixed(2),
    source: (o && o.source) || 'Stilo',
    channel: (o && o.channel) || 'Store',
    pay: (o && o.pay) || 'Cash',
    badge: (o && o.badge) || null,
    age: (o && o.age) || '0h 0m',
    items: typeof items === 'number' ? items : (items.length || 0),
    stage: STAGES.includes(o && o.stage) ? o.stage : 'verify',
    hue: (o && o.hue) != null ? o.hue : 200,
  };
  if (o && o.lines) rec.lines = o.lines.slice();
  ORDERS.unshift(rec);
  _hwNotify();
  return rec;
}

/** Patch an order in place. Returns the updated record, or null if unknown. */
function updateOrder(id, patch) {
  const o = orderById(id);
  if (!o) return null;
  Object.assign(o, patch || {});
  if (o.total != null) o.total = +(+o.total).toFixed(2);
  _hwNotify();
  return o;
}

/**
 * Move an order through fulfilment.
 *
 * Refuses an unknown stage rather than writing it: a typo'd stage silently
 * removes the order from every queue that filters on the known set, which looks
 * exactly like the order having been deleted.
 */
function setStage(id, stage) {
  if (!STAGES.includes(stage)) return null;
  return updateOrder(id, { stage });
}

/** The next stage in the pipeline, or null at the end. */
function nextStage(stage) {
  const i = STAGES.indexOf(stage);
  return i < 0 || i === STAGES.length - 1 ? null : STAGES[i + 1];
}

/* ── Substitution audit records ───────────────────────────────────────────────
 *
 * The engine's applyOrderSubstitution returns a SubstitutionRecord — who
 * changed what, on which order, in which van, what it did to the money, and
 * whether consent was given. THE RECORD IS THE POINT of a governed flow.
 *
 * Three attempts at the driver swap kept it in React component state, which
 * meant it existed until the driver left the stop. Reviewers found all three:
 * the panel showed "1 record", you navigated away and back, and it showed none.
 * A record that does not outlive the screen is not an audit trail.
 *
 * The id comes from the ENGINE. Attempt 3 minted ids from a component ref that
 * reset to 0 on unmount, so the same order+line produced the SAME id on a later
 * visit — duplicate audit rows for different events. Filing by the engine's own
 * id also makes this idempotent: committing the same substitution twice files
 * one record, not two.
 */
const SUBRECS = [];

/** File a record from the engine. Returns it, or null if it was already filed. */
function addSubRecord(rec) {
  if (!rec || !rec.id) return null;
  if (SUBRECS.some((r) => r.id === rec.id)) return null;   // idempotent by design
  SUBRECS.unshift(rec);
  _hwNotify();
  return rec;
}
/** Every record for one order, newest first. */
function subRecords(orderId) { return SUBRECS.filter((r) => r.orderId === orderId); }
function allSubRecords() { return SUBRECS.slice(); }

let _pendingSale = null;
function startSaleFor(customer, guests) { _pendingSale = customer ? { customer, guests: (guests || []).slice() } : null; }
function takePendingSale() { const p = _pendingSale; _pendingSale = null; return p; }

window.HW = { PRODUCTS, MEMBERS, CHECKINS, GUEST_POOL, ORDERS, CATS, CAT_COLOR, STORE, DELIVERY, REGIONS, DRIVERS, FLEET_TOTAL, STATS, REWARDS, upsell, favCategory, fmt, visitLabel, visitOrdinal,
  WM_LISTINGS, WM_PRODUCT_SYNC, WM_STATUS_MAP, WM_STATUS_ORDER, WM_ORDER, IDV, TAX_RATES, taxBreakdown,
  ORDER_BIND, bindFor, MATCH_WEIGHT, SIGNAL_LABEL,
  addMember, updateMember, creditWallet, addCheckIn, removeCheckIn, wmLinked, setWmLink, startSaleFor, takePendingSale,
  STAGES, addOrder, updateOrder, setStage, nextStage, orderById,
  addSubRecord, subRecords, allSubRecords,
  subscribe:(fn)=>{ _hwSubs.add(fn); return ()=> _hwSubs.delete(fn); },
  checkinById:(id)=> CHECKINS.find(c=>c.id===id) || null,
  memberById:(id)=> MEMBERS.find(m=>m.id===id) || null,
  catCount:(c)=> c==='Deals'? PRODUCTS.filter(p=>p.was).length : PRODUCTS.filter(p=>p.cat===c).length,
};

// Re-render on any write. Screens that read HW.MEMBERS / HW.CHECKINS must use
// this, or a record that really was created still looks like nothing happened.
window.useHW = function useHW() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => window.HW.subscribe(force), []);
  return window.HW;
};
