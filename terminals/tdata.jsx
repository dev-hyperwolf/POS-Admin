// ── Terminal-config demo data ──────────────────────────────────────────────
// Two terminal CLASSES:
//   station — fixed to a store COMPUTER. Has a cash drawer, a fixed receipt
//             printer, and a fixed (static) card reader.
//   mobile  — a driver's PHONE in the field ("mobile terminal"). Cash-in-bag.
//
// MODEL (per ops): every delivery REGION has exactly ONE driver and ONE STATIC
// Credit Card Reader. The reader belongs to the region, not the driver — assign
// it once at setup and it stays. Assign a driver to the region and they use that
// region's reader. So: 1 region ⇄ 1 driver ⇄ 1 static reader.
// Card readers are therefore static to a station OR static to a region.

const STORE_T = { name: 'Hyperwolf Lake Elsinore', code: 'HW-00001-101' };

// ── Stations (this store) ───────────────────────────────────────────────────
// drawer.state: 'open' | 'closed'.  variance = counted - expected
const STATIONS = [
  { id:'ST1', kind:'station', name:'Front Counter 1', device:{ model:'iMac 24"', os:'macOS 14', tag:'LE-IMAC-01' },
    online:true, lastActive:'Active now', employee:'Priya Nair',
    printer:{ model:'Epson TM-m30', conn:'Network', ip:'192.168.4.21', ok:true },
    reader:{ model:'BBPOS WisePad 3', sn:'00201', ok:true },
    drawer:{ state:'open', float:300, expected:1240.50, counted:null, variance:null, since:'8:02 AM', cashier:'Priya Nair', cardSales:3120.75, cardCount:48, cashCount:22, splitCount:5, warrantyCount:1 } },
  { id:'ST2', kind:'station', name:'Front Counter 2', device:{ model:'iMac 24"', os:'macOS 14', tag:'LE-IMAC-02' },
    online:true, lastActive:'Active now', employee:'Marcus Hill',
    printer:{ model:'Epson TM-m30', conn:'Network', ip:'192.168.4.22', ok:true },
    reader:{ model:'BBPOS WisePad 3', sn:'00202', ok:true },
    drawer:{ state:'open', float:300, expected:980.00, counted:null, variance:null, since:'8:00 AM', cashier:'Marcus Hill', cardSales:2450.00, cardCount:39, cashCount:18, splitCount:3, warrantyCount:0 } },
  { id:'ST3', kind:'station', name:'Express Lane', device:{ model:'Mac mini', os:'macOS 14', tag:'LE-MINI-03' },
    online:true, lastActive:'Active now', employee:null,
    printer:{ model:'Epson TM-T88', conn:'Network', ip:'192.168.4.23', ok:false },
    reader:{ model:'BBPOS WisePad 3', sn:'00203', ok:true },
    drawer:{ state:'closed', float:300, expected:0, counted:300, variance:0, since:'Closed', cashier:null } },
  { id:'ST4', kind:'station', name:'Drive-Thru', device:{ model:'iMac 24"', os:'macOS 13', tag:'LE-IMAC-04' },
    online:false, lastActive:'2 days ago', employee:null,
    printer:{ model:'Epson TM-m30', conn:'Network', ip:'192.168.4.24', ok:true },
    reader:null,
    drawer:{ state:'closed', float:300, expected:0, counted:300, variance:0, since:'Closed', cashier:null } },
  { id:'ST5', kind:'station', name:'Manager Station', device:{ model:'MacBook Pro', os:'macOS 14', tag:'LE-MBP-05' },
    online:true, lastActive:'Active now', employee:'Manisha Saini',
    printer:{ model:'Epson TM-m30', conn:'USB', ip:null, ok:true },
    reader:{ model:'Stripe M2', sn:'00205', ok:true },
    drawer:{ state:'open', float:300, expected:512.00, counted:500.00, variance:-12.00, since:'9:14 AM', cashier:'Manisha Saini', cardSales:890.00, cardCount:12, cashCount:7, splitCount:2, warrantyCount:1 } },
];

// ── Delivery regions — one driver + one static reader each ──────────────────
// reader = the region's static Credit Card Reader (null = not yet assigned).
const RAW_REGIONS = [
  ['RC1','Temecula',      'Theo Reyes',   'BBPOS WisePad 3','00301','on-shift'],
  ['RC2','Lake Elsinore', 'Maya Cole',    'BBPOS WisePad 3','00302','on-shift'],
  ['RC3','Moreno Valley', 'Dev Anand',    'BBPOS WisePad 3','00303','on-shift'],
  ['RC4','Corona',        'Sam Okoro',    'Stripe M2',      '00304','on-shift'],
  ['RC5','Menifee',       'Lena Brooks',  'BBPOS WisePad 3','00305','on-shift'],
  ['RC6','Perris',        'Aaron Wells',  'Stripe M2',      '00306','offline'],
  ['RC7','Wildomar',      'Nina Patel',   'BBPOS WisePad 3','00307','on-shift'],
  ['RC8','Floater',       'Jordan Vu',    null,             null,   'on-shift'],
  ['RC9','Hemet',         'Priya Sharma', 'Stripe M2',      '00308','off'],
  ['SB1','Fontana',       'Carlos Diaz',  'BBPOS WisePad 3','00309','on-shift'],
  ['SB2','North Rancho',  'Ivy Chen',     'BBPOS WisePad 3','00310','on-shift'],
  ['SB3','San Dimas',     'Omar Haddad',  'Stripe M2',      '00311','on-shift'],
  ['SB4','Rialto',        'Grace Kim',    'BBPOS WisePad 3','00312','off'],
  ['SB5','Ontario',       'Luis Fuentes', 'Stripe M2',      '00313','on-shift'],
  ['SB6','Upland',        'Ruby Nash',    null,             null,   'on-shift'],
  ['LA1','Pomona',        'Kofi Mensah',  'BBPOS WisePad 3','00314','on-shift'],
  ['LA2','Claremont',     'Elena Ruiz',   'Stripe M2',      '00315','on-shift'],
  ['LA3','La Verne',      'Jack Boyd',    'BBPOS WisePad 3','00316','offline'],
  ['OC1','Yorba Linda',   'Tara Shah',    'Stripe M2',      '00317','on-shift'],
  ['OC2','Brea',          'Noah Klein',   'BBPOS WisePad 3','00318','on-shift'],
];
const PHONE_MODELS = ['iPhone 13','iPhone 14','iPhone 15','Pixel 7','Pixel 8','Galaxy S23','iPhone SE'];
const VEHICLES = ['Prius','Civic','Corolla','Leaf','Bolt','CR-V'];

const REGION_TERMINALS = RAW_REGIONS.map((r,i)=>{
  const [rid,name,driver,rmodel,rsn,status] = r;
  const online = status==='on-shift';
  const lastActive = status==='on-shift'?'Active now':status==='off'?(i%2?'3h ago':'Yesterday'):(i%2?'2 days ago':'5 days ago');
  const first = driver.split(' ')[0];
  return {
    id:rid, kind:'mobile', region:rid, regionCity:name, name:driver,
    device:{ model: PHONE_MODELS[i%PHONE_MODELS.length], os: PHONE_MODELS[i%PHONE_MODELS.length].startsWith('i')?'iOS 17':'Android 14', tag:'HW-'+first.toUpperCase()+'-'+String(i+1).padStart(2,'0') },
    vehicle: VEHICLES[i%VEHICLES.length],
    online, lastActive, employee:driver, status,
    reader: rmodel ? { model:rmodel, sn:rsn } : null,   // STATIC to the region
    bag:{ float:60, collected: status==='on-shift'? 40 + ((i*37)%520) : 0, stops: status==='on-shift'? (i%6) : 0,
          card: status==='on-shift'? 60 + ((i*53)%460) : 0, cardTxns: status==='on-shift'? (i%9)+2 : 0, cashTxns: status==='on-shift'? (i%5)+1 : 0,
          splitTxns: status==='on-shift'? (i%3) : 0, warrantyTxns: status==='on-shift'? (i%4===0?1:0) : 0 },
  };
});

const T_REGIONS = RAW_REGIONS.map(r=>({ id:r[0], name:r[1], driver:r[2], reader: r[3]?{model:r[3],sn:r[4]}:null }));
const T_REGION_BY_ID = Object.fromEntries(T_REGIONS.map(r=>[r.id, r]));

// ── Attention logic ─────────────────────────────────────────────────────────
function attentionFor(t){
  const out = [];
  if (t.kind === 'station'){
    if (!t.online) out.push({ level:'critical', label:'Station offline' });
    if (!t.reader) out.push({ level:'critical', label:'No card reader' });
    if (t.printer && !t.printer.ok) out.push({ level:'warn', label:'Printer offline' });
    if (t.drawer && t.drawer.variance != null && t.drawer.variance < 0) out.push({ level:'warn', label:'Drawer short '+window.HW.fmt.money(Math.abs(t.drawer.variance)) });
  } else {
    if (t.status === 'offline') out.push({ level:'critical', label:'Terminal offline' });
    if (!t.reader) out.push({ level:'warn', label:'No card reader' });
  }
  return out;
}

function regionName(rid){ const r = T_REGION_BY_ID[rid]; return r ? r.id+' '+r.name : rid; }

// Parent-region color coding (RC / SB / OC / LA) — used on badges everywhere.
const REGION_COLORS = { RC:'#3F73D6', SB:'#2FA59B', OC:'#D98316', LA:'#8A5CD6' };
function regionColor(rid){ return REGION_COLORS[(rid||'').slice(0,2)] || '#7E7E74'; }

// ── Schedule (synced from Connecteam) — Yesterday / Today / Tomorrow ─────────
// Who works which day, their hours, and (for drivers) the region they cover.
// Off-roster staff appear here as "Off" — they hold no region/terminal that day.
const ROSTER = [
  { name:'Manisha Saini', role:'manager' }, { name:'Priya Nair', role:'cashier' }, { name:'Marcus Hill', role:'cashier' },
  { name:'Sofia Reyes', role:'cashier' }, { name:'Theo Reyes', role:'driver' }, { name:'Maya Cole', role:'driver' },
  { name:'Dev Anand', role:'driver' }, { name:'Sam Okoro', role:'driver' }, { name:'Lena Brooks', role:'driver' },
  { name:'Nina Patel', role:'driver' }, { name:'Carlos Diaz', role:'driver' }, { name:'Ivy Chen', role:'driver' },
  { name:'Grace Kim', role:'driver' }, { name:'Jordan Vu', role:'driver' }, { name:'Ruby Nash', role:'driver' },
];
const SHIFT_TIMES = ['8:00a–4:00p','9:00a–5:00p','10:00a–6:00p','11:00a–7:00p','7:00a–3:00p'];
const STATION_NAMES = ['Front Counter 1','Front Counter 2','Express Lane','Manager Station'];
const REGION_IDS = RAW_REGIONS.map(r=>r[0]);
function scheduleFor(dayIdx){
  return ROSTER.map((p,i)=>{
    const off = (i + dayIdx*3) % 5 === 0;
    if(off) return { ...p, off:true };
    const time = SHIFT_TIMES[(i+dayIdx)%SHIFT_TIMES.length];
    return { ...p, off:false, time,
      region: p.role==='driver' ? REGION_IDS[(i*2+dayIdx*3)%REGION_IDS.length] : null,
      station: p.role!=='driver' ? STATION_NAMES[(i+dayIdx)%STATION_NAMES.length] : null };
  });
}
const SCHEDULE = { yesterday:scheduleFor(0), today:scheduleFor(1), tomorrow:scheduleFor(2) };
const DAY_META = { yesterday:{label:'Yesterday', date:'Mon Jul 13'}, today:{label:'Today', date:'Tue Jul 14'}, tomorrow:{label:'Tomorrow', date:'Wed Jul 15'} };

const FLEET = {
  stations: STATIONS.length,
  mobile: REGION_TERMINALS.length,
  mobileOnShift: REGION_TERMINALS.filter(d=>d.status==='on-shift').length,
  unassignedReaders: [...STATIONS, ...REGION_TERMINALS].filter(t=>!t.reader).length,
  needsAttention: [...STATIONS, ...REGION_TERMINALS].filter(t=>attentionFor(t).length).length,
  drawersOpen: STATIONS.filter(s=>s.drawer.state==='open').length,
};

// Spare readers available to assign
const READER_POOL = [
  { value:'wp-a', label:'BBPOS WisePad 3', sub:'SN 00401 · spare', model:'BBPOS WisePad 3', sn:'00401' },
  { value:'wp-b', label:'BBPOS WisePad 3', sub:'SN 00402 · spare', model:'BBPOS WisePad 3', sn:'00402' },
  { value:'m2-a', label:'Stripe M2',        sub:'SN 00403 · spare', model:'Stripe M2', sn:'00403' },
];

window.TDATA = {
  STORE_T, T_REGIONS, T_REGION_BY_ID, STATIONS, REGION_TERMINALS, FLEET, READER_POOL,
  attentionFor, regionName, regionColor, REGION_COLORS, PHONE_MODELS,
  ROSTER, SCHEDULE, DAY_META,
};
