// ── Categories module — our categories + sub-categories, both editors, and the
//    Weedmaps taxonomy mapping, WIRED TO THE LIVE BOARD AND MAPPED BY HAND.
//
// THE POINT OF THIS SCREEN is that a person sits down and maps our categories
// onto Weedmaps' by hand. The matcher's suggestions are a convenience bolted
// onto that; they are never the only way in. Every row can be mapped, re-mapped
// and un-mapped from here, over the real ~84-node pickable tree, with the full
// path always shown — "Accessories" exists under Gear, "Diamonds" exists under
// two different Concentrates branches, and picking the wrong root is the exact
// bug already live on this instance.
//
// WHERE THE DATA COMES FROM. When shared/hw-live-taxonomy.js has an API to talk
// to, every row, node id, state and count here is read off GET /api/taxonomy
// through `window.HW_TAXONOMY`. There is no second copy of Weedmaps' taxonomy
// in this file any more — the hand-typed node LABELS that used to live here are
// kept only as the no-API fallback and are stamped MOCK wherever they appear,
// because a label carries no id and an id is the only thing that can publish.
//
// WHEN NOTHING ANSWERS (GitHub Pages, file://) the screen says so in the header,
// on every count and on every node pill. An absent API must never render as
// "nothing to map" — that reads as "all done", which is the opposite of true.
//
// THE FOUR THINGS THIS SCREEN EXISTS TO SHOW
//   1. what is mapped, to which real node, by full path;
//   2. what is UNMAPPED, and what that actually costs. It is not blocked:
//      wmdemo/engine.py:176 looks the category up and engine.py:195 only sets
//      `category_ids` on a hit, so on a miss the field is left off and the item
//      PUBLISHES UNCATEGORISED. Worse than a block — nothing errors, and from
//      our side it looks fine;
//   3. what is WRONG — a mapping whose Weedmaps root disagrees with our own
//      top-level category. Two of those are live right now. The screen offers
//      the correction and never applies it: re-pointing a live mapping changes
//      the owner's real Weedmaps listing, so it is his press, not ours;
//   4. which of OUR category NAMES do not resolve against Weedmaps' tree at
//      all. That is the failure nobody can currently see, and it is silent.
const useP = window.useP;

// The separator wmdemo/taxonomy.py:151 builds its paths with. Same spelling on
// both sides on purpose — an operator diffing this screen against the API
// should not be reading two spellings of one node.
const NODE_SEP = ' › ';
const rootOf = (path) => String(path == null ? '' : path).split(NODE_SEP)[0];
const leafOf = (path) => {const p = String(path == null ? '' : path).split(NODE_SEP);return p[p.length - 1];};
const segsOf = (path) => String(path == null ? '' : path).split(NODE_SEP).filter((s) => s && s !== '?');
const catKey = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const uniq = (a) => a.filter((v, i) => v != null && a.indexOf(v) === i);
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

// ── category accent ─────────────────────────────────────────────────────────
// pos/tokens.jsx is the only place a colour is defined (CLAUDE.md rule 2), so
// this maps a category NAME onto one of its `cat` tokens and nothing else.
const CAT_TOKEN = {
  'flower': 'flower', 'flowers': 'flower', 'vapes': 'vape', 'vape pens': 'vape', 'cartridges': 'vape',
  'concentrates': 'concentrate', 'prerolls': 'preroll', 'pre roll': 'preroll', 'pre rolls': 'preroll',
  'infused pre roll': 'preroll', 'edibles': 'edibles', 'drinks': 'edibles', 'wellness': 'wellness',
  'tinctures': 'tincture', 'topicals': 'wellness', 'deals': 'deals', 'accessories': 'other',
  'gear': 'other', 'cultivation': 'other' };
const catColor = (P, name) => P.cat[CAT_TOKEN[catKey(name)] || 'other'];

// ── the root rules ──────────────────────────────────────────────────────────
// Which Weedmaps ROOT a mapping under one of OUR top-level categories may
// legitimately land in. Hand-maintained ON PURPOSE, and deliberately partial:
// a category with no rule here is reported as NOT CHECKED, never as correct.
// Guessing an equivalence ("Vapes" ≟ "Vape Pens") is how a screen invents a
// verdict, and an invented verdict is worse than an absent one.
const ROOT_RULES = {
  'flower': ['Flower'],
  'flowers': ['Flower'],
  'vapes': ['Vape Pens'],
  'vape pens': ['Vape Pens'],
  'cartridges': ['Vape Pens'],
  'concentrates': ['Concentrates'],
  'prerolls': ['Pre Roll', 'Infused Pre Roll'],
  'pre roll': ['Pre Roll', 'Infused Pre Roll'],
  'pre rolls': ['Pre Roll', 'Infused Pre Roll'],
  'edibles': ['Edibles', 'Drinks'],
  'drinks': ['Drinks'],
  'wellness': ['Wellness'],
  'accessories': ['Gear'],
  'gear': ['Gear'],
  'cultivation': ['Cultivation'] };
const allowedRoots = (category) => ROOT_RULES[catKey(category)] || null;

// ── the no-API fallback ─────────────────────────────────────────────────────
// Hand-typed Weedmaps LABELS. No ids, so nothing here can publish. Kept only so
// the public demo has something to click; every use of it is stamped MOCK.
const MOCK_TAXONOMY = [
{ group: 'Flower', nodes: ['Big Buds', 'Ground', 'Infused Flower', 'Smalls'] },
{ group: 'Pre Roll', nodes: ['Blunts', 'Joints', 'Minis'] },
{ group: 'Infused Pre Roll', nodes: ['Infused Blunts', 'Infused Joints', 'Infused Minis'] },
{ group: 'Vape Pens', nodes: ['Batteries › Pull', 'Batteries › Push Button', 'Cartridge', 'Disposable', 'Pods'] },
{ group: 'Concentrates', nodes: ['Solvent › Badder', 'Solvent › Crumble', 'Solvent › Diamonds', 'Solvent › Sauce', 'Solvent › Shatter', 'Solvent › Sugar', 'Solventless › Ice Water Hash', 'Solventless › Kief', 'Solventless › Rosin'] },
{ group: 'Edibles', nodes: ['Baked Goods', 'Chocolates', 'Cooking', 'Gummies', 'Mints'] },
{ group: 'Drinks', nodes: ['Carbonated', 'Mix-ins', 'Non-carbonated'] },
{ group: 'Wellness', nodes: ['Therapeutics › Capsules', 'Therapeutics › Tinctures', 'Topicals › Balms', 'Topicals › Creams'] },
{ group: 'Gear', nodes: ['Accessories › Rolling Papers', 'Apparel › Shirts', 'Grinders', 'Pipes', 'Storage'] },
{ group: 'Cultivation', nodes: ['Clone', 'Seeds'] }];

// Node objects in the same shape the live picker gets, so ONE picker renders
// both. `id: null` is what makes a mock node unpublishable, and it is checked.
const MOCK_NODES = MOCK_TAXONOMY.flatMap((g) => g.nodes.map((n) => ({ id: null, path: g.group + NODE_SEP + n, mock: true })));

const T = (path) => ({ nodeId: null, path, mock: true, known: true, retired: false, retiredAncestor: null, categoryIds: [] });
const MS = (name, targets, skip) => ({ name, targets: targets || [], skip: !!skip });
const MOCK_SEED = [
{ name: 'Deals', subs: [MS('Hyper Deals', [], true), MS('Clearance', [], true)] },
{ name: 'Flower', subs: [
  MS('Sativa Flowers', [T('Flower › Ground')]), MS('Indica Flowers', [T('Flower › Ground')]),
  MS('Premium Flower', [T('Flower › Big Buds')]), MS('Smaller Bud Flower', [T('Flower › Smalls')]),
  MS('Infused Flower', [T('Flower › Infused Flower')]), MS('5g-28g', [])] },
{ name: 'Vapes', subs: [
  MS('Vapes', [T('Vape Pens › Cartridge')]), MS('Batteries', [T('Vape Pens › Batteries › Push Button')]),
  MS('All-In-One Vapes', [T('Vape Pens › Disposable')]), MS('Pod System Vapes', [T('Vape Pens › Pods')]),
  MS('Cured Resin Vapes', [])] },
{ name: 'Concentrates', subs: [
  MS('Solventless Rosin / Hash', [T('Concentrates › Solventless › Rosin'), T('Concentrates › Solventless › Ice Water Hash')]),
  MS('Sugar', [T('Concentrates › Solvent › Sugar')]), MS('Budder / Badder', [T('Concentrates › Solvent › Badder')]),
  MS('Diamonds / Sauce', [T('Concentrates › Solvent › Diamonds'), T('Concentrates › Solvent › Sauce')])] },
{ name: 'Prerolls', subs: [
  MS('Single Pre-Roll', [T('Pre Roll › Joints')]), MS('Single Infused Pre-Roll', [T('Infused Pre Roll › Infused Joints')]),
  MS('Infused Pre-Roll Pack', [T('Infused Pre Roll › Infused Minis')]), MS('Pre-Roll Pack', [T('Pre Roll › Minis')])] },
{ name: 'Edibles', subs: [
  MS('Gummies', [T('Edibles › Gummies')]), MS('High Dose Edibles', [T('Edibles › Gummies')]),
  MS('Ratio (CBN/CBD) Edibles', []), MS('Baked Goods', [T('Edibles › Baked Goods')]),
  MS('Drinks', [T('Drinks › Non-carbonated')])] },
{ name: 'Wellness', subs: [
  MS('Wellness', [T('Wellness › Topicals › Balms')]), MS('Tinctures', [T('Wellness › Therapeutics › Tinctures')]),
  MS('Topicals', [T('Wellness › Topicals › Creams')])] },
{ name: 'Accessories', subs: [MS('Accessories', [T('Gear › Accessories › Rolling Papers')])] }];

// POS catalog category behind each of ours, for the mock product counts only.
const POS_CAT = { flower: 'Flower', vapes: 'Vapes', concentrates: 'Concentrates', prerolls: 'Pre-Rolls', edibles: 'Edibles', wellness: 'Wellness', accessories: 'Wellness', deals: 'Deals' };
// Never returns a number it did not get. A 0 here would read as "no products",
// which is a different claim from "we could not count".
function posCount(name) {
  try {
    if (!window.HW || typeof window.HW.catCount !== 'function') { return { n: null, why: 'window.HW.catCount not loaded' }; }
    return { n: window.HW.catCount(POS_CAT[catKey(name)] || name), why: null };
  } catch (e) {return { n: null, why: 'catCount threw: ' + (e && e.message ? e.message : 'unknown') };}
}

// ── reading the live seam ───────────────────────────────────────────────────
function taxRead() {
  const X = window.HW_TAXONOMY;
  if (!X) { return { status: 'absent', board: null, nodes: [], coverage: null, base: null }; }
  return { status: X.status, board: X.board, nodes: X.nodes || [], coverage: X.coverage, base: X.base };
}
const taxSig = (t) => [t.status, t.board && t.board.generated_at, (t.nodes || []).length, t.board && (t.board.rows || []).length].join('|');
// The seam has no change event, and it only calls HW_LIVE.rerender() when it
// also downgrades a catalog row — so a screen that mounted first would sit on
// `pending` for ever. Poll the snapshot; re-render only when it actually moves.
// This is a local setState, not a second React root: shared/hw-live.js owns the
// only root on the page.
function useTax() {
  const [, bump] = React.useReducer((n) => n + 1, 0);
  const sig = React.useRef(taxSig(taxRead()));
  React.useEffect(() => {
    const tick = () => {const s = taxSig(taxRead());if (s !== sig.current) {sig.current = s;bump();}};
    const id = setInterval(tick, 600);
    return () => clearInterval(id);
  }, []);
  return taxRead();
}

function sourceLine(t) {
  const where = (t.base || '') + '/api/taxonomy';
  if (t.status === 'live') { return { live: true, head: 'LIVE', body: 'Every row, node id and count below is read from ' + where + '.' }; }
  if (t.status === 'absent') { return { live: false, head: 'MOCK', body: 'shared/hw-live-taxonomy.js is not loaded on this page, so there is no board to read. Everything below is a hand-typed list with no Weedmaps ids in it — it cannot publish, and it is NOT what the server holds.' }; }
  if (t.status === 'off') { return { live: false, head: 'MOCK', body: 'The taxonomy seam is switched off (?hwtax=off, or HW_TAXONOMY.disable() was run in this browser). Run HW_TAXONOMY.enable() to turn it back on. Everything below is hand-typed and carries no Weedmaps ids.' }; }
  if (t.status === 'pending') { return { live: false, head: 'ASKING', body: 'Waiting on ' + where + '. Until it answers, everything below is the hand-typed fallback — not the contract.' }; }
  if (t.status === 'slow') { return { live: false, head: 'SLOW', body: where + ' has not answered yet. The request was NOT aborted and will still land — a slow answer is not a dead server. Until it does, everything below is hand-typed.' }; }
  return { live: false, head: 'MOCK', body: 'No API answered at ' + where + '. That is expected on the public demo (GitHub Pages) and on file://. Everything below is a hand-typed list with no Weedmaps ids: it cannot publish and it is NOT what the server holds. This is not "nothing to map".' };
}

// ── the model both paths render ─────────────────────────────────────────────
// sub = { id, name, parent, live, state, targets[], skuCount, skip*, active }
function liveSubs(board) {
  return ((board && board.rows) || []).map((r) => ({
    id: r.id, name: r.name, parent: r.category, live: true,
    state: r.state, hasStale: !!r.has_stale, active: r.active !== false,
    skip: r.state === 'skipped', skipReason: r.skip_reason, skippedBy: r.skipped_by, skippedAt: r.skipped_at,
    skuCount: typeof r.sku_count === 'number' ? r.sku_count : null,
    categoryIds: r.category_ids || [],
    targets: (r.targets || []).map((t) => ({
      nodeId: t.wm_node_id, path: t.path || null, retired: !!t.retired,
      retiredAncestor: t.retired_ancestor == null ? null : t.retired_ancestor,
      known: t.known !== false, categoryIds: t.category_ids || [] })) }));
}
function mockSubs(seed) {
  return seed.flatMap((c) => c.subs.map((s) => ({
    id: null, name: s.name, parent: c.name, live: false,
    state: s.targets.length ? 'mapped' : s.skip ? 'skipped' : 'unmapped',
    hasStale: false, active: true, skip: !!s.skip, skipReason: s.skip ? 'Promo/pseudo category — deliberately never synced (mock).' : null,
    skippedBy: s.skip ? 'mock seed' : null, skippedAt: null,
    skuCount: null, categoryIds: [], targets: s.targets })));
}
function groupCats(subs) {
  const by = {}, order = [];
  subs.forEach((s) => {if (!by[s.parent]) {by[s.parent] = { id: catKey(s.parent), name: s.parent, subs: [] };order.push(by[s.parent]);}by[s.parent].subs.push(s);});
  return order.sort((a, b) => a.name.localeCompare(b.name));
}
const subStatus = (s) => s.state;

// ── the verdict on one mapping ──────────────────────────────────────────────
function verdictOf(sub, target) {
  if (target.mock) { return { kind: 'mock', word: 'MOCK LABEL', why: 'A hand-typed label with no Weedmaps id behind it. It cannot be published, and it is not what the server holds.' }; }
  if (!target.known) { return { kind: 'unknown', word: 'UNKNOWN NODE', why: 'We have never seen node #' + target.nodeId + '. It was never seeded, or it came from a truncated fetch of Weedmaps’ taxonomy.' }; }
  if (target.retired) {
    return { kind: 'retired', word: 'RETIRED NODE', why: target.retiredAncestor != null ?
      'This node is still live, but its PARENT (#' + target.retiredAncestor + ') was retired. We publish [parent, self], so the payload carries a dead id, Weedmaps drops the item, and this row still looks healthy.' :
      'Weedmaps retired this node. The mapping is intact and the products under it stopped appearing — nothing raised an error.' };
  }
  const root = rootOf(target.path);
  if (!target.path || root === '?') { return { kind: 'orphan', word: 'ROOT UNKNOWN', why: 'Weedmaps gave us this node without its parent, so this screen cannot say which top-level category it sits under and will not guess. Re-fetch the taxonomy before treating it as broken.' }; }
  const allow = allowedRoots(sub.parent);
  if (!allow) { return { kind: 'unchecked', word: 'ROOT NOT CHECKED', why: 'There is no root rule for our category “' + sub.parent + '”, so this screen will not claim this mapping is right OR wrong. Add it to ROOT_RULES in pos/screen-categories.jsx to have it checked.' }; }
  if (allow.indexOf(root) >= 0) { return { kind: 'ok', word: 'ROOT AGREES', why: null }; }
  return { kind: 'wrong', word: 'WRONG ROOT', why: 'Our “' + sub.parent + '” belongs under ' + allow.join(' or ') + ' on Weedmaps. This node sits under ' + root + '. Products under it publish into the wrong part of the menu, and nothing on either side reports it.' };
}
const VERDICT_ORDER = { wrong: 0, retired: 1, unknown: 2, orphan: 3, mock: 4, unchecked: 5, ok: 6 };
const worstVerdict = (sub) => sub.targets.map((t) => verdictOf(sub, t)).sort((a, b) => VERDICT_ORDER[a.kind] - VERDICT_ORDER[b.kind])[0] || null;
const isWrong = (s) => s.targets.some((t) => verdictOf(s, t).kind === 'wrong');
const isBroken = (s) => s.targets.some((t) => {const k = verdictOf(s, t).kind;return k === 'retired' || k === 'unknown';});

// ── suggesting a replacement (offered, never applied) ───────────────────────
const STOP = { the: 1, and: 1, of: 1, a: 1, for: 1 };
const toks = (s) => String(s == null ? '' : s).toLowerCase().split(/[^a-z0-9]+/)
  .filter((w) => w && !STOP[w]).map((w) => w.length > 3 && /s$/.test(w) ? w.slice(0, -1) : w);
function suggestFor(sub, nodes) {
  const allow = allowedRoots(sub.parent);
  if (!allow || !nodes.length) { return []; }
  const want = toks(sub.name);
  if (!want.length) { return []; }
  const have = {};
  sub.targets.forEach((t) => {if (t.nodeId != null) {have[t.nodeId] = 1;}});
  return nodes.filter((n) => n.id != null && !have[n.id] && allow.indexOf(rootOf(n.path)) >= 0).map((n) => {
    const leaf = toks(leafOf(n.path));
    const inter = leaf.filter((w) => want.indexOf(w) >= 0).length;
    const union = uniq(leaf.concat(want)).length;
    return { node: n, score: union ? inter / union : 0 };
  }).filter((x) => x.score >= 0.34).sort((a, b) => b.score - a.score).slice(0, 3);
}

// ── what unmapped actually costs ────────────────────────────────────────────
const UNMAPPED_TRUTH = 'Unmapped does NOT block the product. wmdemo/engine.py:176 looks our category name up in Weedmaps’ tree and engine.py:195 only sets category_ids when it finds one — on a miss the field is simply left off and the item PUBLISHES UNCATEGORISED. Nothing errors, nothing is queued, and from our side it looks fine.';

// ── does OUR category name resolve at all? ──────────────────────────────────
// engine.py:63-88 caches `{wm_category_name.lower(): [parent_id, id]}` over
// EVERY Weedmaps category, at every depth. engine.py:176 then does a plain
// dictionary get on `product["category"].lower()`. So the test is exact and it
// is a STRING test: no punctuation is stripped and nothing is singularised.
// "Vapes" misses ("Vape Pens"), "Pre-rolls" misses ("Pre Roll"), "Cartridges"
// misses ("Cartridge"). Every one of those publishes uncategorised in silence.
//
// Every path segment we hold IS a Weedmaps category name, so the name set is
// rebuilt from the paths rather than kept as a second list here.
function wmNameSet(nodes) {
  const out = {};
  nodes.forEach((n) => segsOf(n.path).forEach((s) => {out[s.toLowerCase()] = s;}));
  return out;
}
function nameResolution(names, ours) {
  const hit = names[String(ours || '').toLowerCase()];
  if (hit) { return { ok: true, hit: hit }; }
  const near = Object.keys(names).filter((k) => catKey(k) === catKey(ours)).map((k) => names[k]);
  return { ok: false, near: near };
}

// ── can we write? ───────────────────────────────────────────────────────────
function writeState() {
  const L = window.HW_LIVE;
  if (!L) { return { ok: false, why: 'shared/hw-live.js is not loaded, so there is no write path at all.' }; }
  if (L.writes === 'gated') { return { ok: false, why: 'This API is in read-only mode for this browser, so nothing here can be saved. The live-data pill (bottom-left) is where the write token goes.' }; }
  if (L.writes === 'rejected') { return { ok: false, why: 'The write token this browser holds was rejected by the API, so nothing here can be saved.' }; }
  return { ok: true, why: L.writes === 'writable' ? null : 'No write has been attempted yet, so whether this browser may write is unknown. The server’s own answer is printed on the row when you press.' };
}

// ── small pieces ────────────────────────────────────────────────────────────
function CatGlyph({ name, size = 34 }) {
  const P = useP();
  return <span style={{ width: size, height: size, borderRadius: P.r8, flex: '0 0 auto', background: catColor(P, name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * .42, fontWeight: 800, color: P.surface, fontFamily: P.fontMono }}>{String(name || '?')[0]}</span>;
}

const VERDICT_KIND = { ok: 'good', wrong: 'bad', retired: 'bad', unknown: 'bad', orphan: 'warn', unchecked: 'neutral', mock: 'warn' };

// One mapped node, with its full path, its verdict, and the two controls that
// change it. The path is never shortened to its leaf.
function NodeLine({ sub, target, onReplace, onRemove, busy }) {
  const P = useP();const v = verdictOf(sub, target);
  const bad = v.kind !== 'ok' && v.kind !== 'unchecked';
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 10px', borderRadius: P.r8, background: bad ? P.badSoft : P.surface2, border: `1px solid ${bad ? P.bad : P.hairline}` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Pill kind="info" size="sm">WM</Pill>
      <span style={{ flex: 1, minWidth: 140, fontSize: P.type.body, fontWeight: 600, color: P.ink, fontFamily: P.fontMono, wordBreak: 'break-word' }}>
        {target.path || 'node #' + target.nodeId + ' — no path'}
        <span style={{ color: P.inkMute }}>{target.nodeId == null ? '  (no id)' : '  #' + target.nodeId}</span>
      </span>
      <Pill kind={VERDICT_KIND[v.kind]} size="sm">{v.word}</Pill>
      {onReplace && <PBtn size="xs" variant="secondary" icon="swap" onClick={onReplace} disabled={busy}>Change</PBtn>}
      {onRemove && <PBtn size="xs" variant="ghost" icon="x" onClick={onRemove} disabled={busy}>Unmap</PBtn>}
    </div>
    {v.why && <div style={{ fontSize: P.type.meta, lineHeight: 1.45, color: bad ? P.bad : P.inkDim }}>{v.why}</div>}
  </div>;
}

// Read-only summary of a sub-category's mapping, used in the list views and by
// the editors. Never renders a green tick it did not compute.
function WmPill({ sub, compact }) {
  const P = useP();
  if (sub.state === 'skipped') { return <Pill kind="neutral" icon="eye-off">Skipped — decided</Pill>; }
  if (!sub.targets.length) { return <Pill kind="bad" icon="alert">Unmapped — publishes uncategorised</Pill>; }
  const worst = worstVerdict(sub);
  const shown = compact ? sub.targets.slice(0, 1) : sub.targets.slice(0, 3);
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
    {worst && worst.kind !== 'ok' && <Pill kind={VERDICT_KIND[worst.kind]} size="sm">{worst.word}</Pill>}
    {shown.map((t, i) => <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: P.type.meta, fontWeight: 600, color: P.ink2, background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r999, padding: '3px 9px', fontFamily: P.fontMono }}>
      {t.path || 'node #' + t.nodeId}<span style={{ color: P.inkMute }}>{t.nodeId == null ? 'no id' : '#' + t.nodeId}</span></span>)}
    {sub.targets.length > shown.length && <span style={{ fontSize: P.type.meta, fontWeight: 600, color: P.inkMute }}>+{sub.targets.length - shown.length}</span>}
  </span>;
}

// ── the node picker ─────────────────────────────────────────────────────────
// The manual path, and the thing that has to be good: ~84 real nodes in a real
// hierarchy. Grouped by Weedmaps ROOT, searchable on the whole path or on a
// node id, and always showing the full path.
function NodePicker({ nodes, mock, sub, replacing, onPick, onClose, anchor = 'right', suggested }) {
  const P = useP();
  const [q, setQ] = React.useState('');
  const allow = allowedRoots(sub && sub.parent);
  const [onlyAllowed, setOnlyAllowed] = React.useState(!!allow);
  const sug = {};(suggested || []).forEach((s) => {sug[s.node.id] = 1;});
  const held = {};(sub.targets || []).forEach((t) => {if (t.nodeId != null) {held[t.nodeId] = 1;}});
  const list = nodes.filter((n) => {
    if (onlyAllowed && allow && allow.indexOf(rootOf(n.path)) < 0) { return false; }
    return !q || String(n.path).toLowerCase().indexOf(q.toLowerCase()) >= 0 || String(n.id) === q.trim();
  });
  const groups = [];const byRoot = {};
  list.forEach((n) => {const r = rootOf(n.path);if (!byRoot[r]) {byRoot[r] = { root: r, nodes: [] };groups.push(byRoot[r]);}byRoot[r].nodes.push(n);});
  groups.forEach((g) => g.nodes.sort((a, b) => String(a.path).localeCompare(String(b.path))));

  return <>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', [anchor]: 0, width: 400, maxWidth: '92vw', maxHeight: 470, display: 'flex', flexDirection: 'column', background: P.surface, border: `1px solid ${P.hairline2}`, borderRadius: P.r12, boxShadow: P.shadowLg, zIndex: 91, overflow: 'hidden' }}>
      <div style={{ padding: 10, borderBottom: `1px solid ${P.hairline}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Pill kind={mock ? 'warn' : 'info'} size="sm">{mock ? 'MOCK LABELS' : 'WEEDMAPS'}</Pill>
          <span style={{ fontSize: P.type.meta, fontWeight: 700, color: P.ink }}>{mock ? 'no ids — cannot publish' : plural(nodes.length, 'live node')}</span>
          <span style={{ marginLeft: 'auto', fontSize: P.type.micro, color: P.inkMute, fontFamily: P.fontMono }}>{list.length} shown</span>
        </div>
        <div style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.45 }}>
          {replacing ? <>Replacing <b style={{ fontFamily: P.fontMono }}>{replacing.path} #{replacing.nodeId}</b> on <b>{sub.name}</b>. You will be shown the exact swap before anything is written.</> :
            <>Mapping <b>{sub.parent} › {sub.name}</b>. Picking a node writes it immediately and adds to what is already mapped — it removes nothing.</>}
        </div>
        <Field icon="search" placeholder="Search the full path, or type a node id…" value={q} onChange={(e) => setQ(e.target.value)} size="sm" />
        {allow && <button data-hw-i onClick={() => setOnlyAllowed((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: P.fontSans }}>
          <span style={{ width: 16, height: 16, borderRadius: 5, flex: '0 0 auto', border: `1.5px solid ${onlyAllowed ? P.ink : P.hairline3}`, background: onlyAllowed ? P.ink : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{onlyAllowed && <Icon name="check" size={11} stroke={3} color={P.surface} />}</span>
          <span style={{ fontSize: P.type.meta, color: P.ink2 }}>Only {allow.join(' / ')} — the roots our “{sub.parent}” belongs under</span>
        </button>}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 7 }}>
        {!groups.length && <div style={{ padding: 12, fontSize: P.type.body, color: P.ink2, lineHeight: 1.5 }}>
          {!nodes.length ? 'The API served no Weedmaps nodes at all, so there is nothing to pick — the taxonomy has never been seeded.' :
            'Nothing matches “' + q + '”' + (onlyAllowed && allow ? ' under ' + allow.join(' / ') + '. Untick the filter above to search every root.' : '.')}
        </div>}
        {groups.map((g) => <div key={g.root} style={{ marginBottom: 6 }}>
          <div style={{ padding: '6px 8px 4px', fontSize: P.type.micro, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: P.inkMute }}>{g.root === '?' ? '? — parent missing from Weedmaps’ feed' : g.root}</div>
          {g.nodes.map((n, i) => {
            const rest = String(n.path).split(NODE_SEP).slice(1);
            const on = n.id != null && held[n.id];
            return <button data-hw-i key={n.id == null ? 'm' + i : n.id} onClick={() => onPick(n)} disabled={on} title={on ? 'already mapped to this sub-category' : n.path} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', minHeight: P.ctrlH.sm, padding: '7px 8px', background: sug[n.id] ? P.accentSoft : 'transparent', border: 'none', borderRadius: P.r8, cursor: on ? 'not-allowed' : 'pointer', opacity: on ? .55 : 1, textAlign: 'left', fontFamily: P.fontSans }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: P.type.body, fontWeight: 600, color: P.ink }}>
                {rest.map((seg, j) => <span key={j}>{j ? <span style={{ color: P.inkFaint }}> › </span> : null}<span style={{ color: j === rest.length - 1 ? P.ink : P.inkDim, fontWeight: j === rest.length - 1 ? 600 : 500 }}>{seg}</span></span>)}
                {sug[n.id] ? <span style={{ marginLeft: 7, fontSize: P.type.micro, fontWeight: 800, color: P.accentText }}>SUGGESTED</span> : null}
                {on ? <span style={{ marginLeft: 7, fontSize: P.type.micro, fontWeight: 800, color: P.inkMute }}>ALREADY MAPPED</span> : null}
              </span>
              <span style={{ fontSize: P.type.micro, color: P.inkMute, fontFamily: P.fontMono, flex: '0 0 auto' }}>{n.id == null ? 'no id' : '#' + n.id}</span>
            </button>;})}
        </div>)}
      </div>
      {mock && <div style={{ padding: '9px 11px', borderTop: `1px solid ${P.hairline}`, background: P.warnSoft, fontSize: P.type.meta, color: P.warn, lineHeight: 1.45 }}>
        No API answered, so these are labels typed into this file — they carry no Weedmaps id. Picking one changes this screen and nothing else.
      </div>}
    </div>
  </>;
}

Object.assign(window, { NODE_SEP, rootOf, leafOf, segsOf, catKey, catColor, ROOT_RULES, allowedRoots,
  MOCK_TAXONOMY, MOCK_NODES, MOCK_SEED, POS_CAT, posCount, taxRead, useTax, sourceLine, liveSubs, mockSubs,
  groupCats, subStatus, verdictOf, worstVerdict, isWrong, isBroken, suggestFor, UNMAPPED_TRUTH, wmNameSet,
  nameResolution, writeState, CatGlyph, NodeLine, WmPill, NodePicker, VERDICT_KIND, plural });

// ── screen ──────────────────────────────────────────────────────────────────
window.CategoriesScreen = function CategoriesScreen({ onBack }) {
  const P = useP();
  const tax = useTax();
  const src = sourceLine(tax);
  const [tab, setTab] = React.useState('mapping');
  const [q, setQ] = React.useState('');
  const [editCat, setEditCat] = React.useState(null);
  const [editSub, setEditSub] = React.useState(null);
  const [focus, setFocus] = React.useState(null);
  const [mock, setMock] = React.useState(MOCK_SEED);

  // One local patch for the mock path. The live path never mutates local state:
  // it POSTs and re-reads the board, so this screen can never disagree with the
  // server about what is mapped.
  const setMockSub = (parent, name, patch) => setMock((cs) => cs.map((c) => c.name !== parent ? c : { ...c, subs: c.subs.map((s) => s.name === name ? { ...s, ...patch } : s) }));

  const subs = src.live ? liveSubs(tax.board) : mockSubs(mock);
  const cats = groupCats(subs);
  const nodes = src.live ? tax.nodes : MOCK_NODES;

  if (editCat) {
    const c = cats.find((x) => x.name === editCat);
    if (c) { return <window.CategoryEdit cat={c} live={src.live} nodes={nodes} names={wmNameSet(nodes)} onBack={() => setEditCat(null)} onOpenSub={(s) => {setEditCat(null);setEditSub(s.parent + '::' + s.name);}} />; }
  }
  if (editSub) {
    const s = subs.find((x) => x.parent + '::' + x.name === editSub);
    const c = s && cats.find((x) => x.name === s.parent);
    if (s && c) { return <window.SubCategoryEdit cat={c} sub={s} live={src.live} nodes={nodes} onBack={() => setEditSub(null)} onMockSet={setMockSub} />; }
  }

  const mapped = subs.filter((s) => s.targets.length > 0);
  const unmapped = subs.filter((s) => s.state === 'unmapped');
  const skipped = subs.filter((s) => s.state === 'skipped');
  const stale = subs.filter((s) => s.state === 'stale' || s.hasStale || isBroken(s));
  const wrong = subs.filter(isWrong);
  const cov = (src.live && tax.coverage) || null;

  const fc = cats.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.subs.some((s) => s.name.toLowerCase().includes(q.toLowerCase())));
  const fs = subs.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.parent.toLowerCase().includes(q.toLowerCase()));
  const th = (t, r) => <th style={{ textAlign: r ? 'right' : 'left', padding: '10px 16px', fontSize: P.type.micro, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: P.inkDim, borderBottom: `1px solid ${P.hairline2}`, whiteSpace: 'nowrap' }}>{t}</th>;
  const jump = (s) => {setFocus(s.parent + '::' + s.name);setTab('mapping');};

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <button data-hw-i onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', border: 'none', cursor: 'pointer', color: P.ink2, fontSize: P.type.strong, fontWeight: 600, fontFamily: P.fontSans, padding: 0 }}><Icon name="chevron-left" size={17} stroke={2.2} />Back to catalog</button>
      </div>

      <SectionHead level={1} eyebrow="Master Catalog" title="Categories"
      subtitle={`${cats.length} categories · ${subs.length} sub-categories · ${src.live ? 'live from the taxonomy API' : 'mock — no API answered'}`}
      action={<div style={{ display: 'flex', gap: 9 }}>
        <PBtn variant="secondary" icon="refresh" size="md" onClick={() => window.HW_TAXONOMY && window.HW_TAXONOMY.refresh()} disabled={!window.HW_TAXONOMY}>Refresh board</PBtn>
        <PBtn variant="accent" icon="plus" size="md">Add Category</PBtn>
      </div>} />

      <SourceBanner src={src} tax={tax} />
      {cov && <CoverageCard cov={cov} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '14px 0 16px', flexWrap: 'wrap' }}>
        <Seg value={tab} onChange={setTab} size="lg" options={[
          { value: 'mapping', label: 'Weedmaps mapping' },
          { value: 'categories', label: 'Categories' },
          { value: 'subcategories', label: 'Sub Categories' }]} />
        <div style={{ flex: 1 }} />
        <div style={{ width: 280 }}><Field icon="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} size="md" /></div>
      </div>

      <ProblemStrip wrong={wrong} unmapped={unmapped} stale={stale} mapped={mapped} skipped={skipped} live={src.live} onJump={jump} />

      {tab === 'mapping' ?
      <MappingBoard cats={cats} nodes={nodes} live={src.live} tax={tax} focus={focus} setFocus={setFocus} onMockSet={setMockSub} onEditSub={(s) => setEditSub(s.parent + '::' + s.name)} /> :
      <Card padding={0} style={{ overflow: 'visible' }}>
        <div style={{ overflowX: 'auto' }}>
          {tab === 'categories' ?
          <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: P.type.strong }}>
            <thead><tr style={{ background: P.surface2 }}>{th('Category')}{th('Sub-categories')}{th('Weedmaps')}{th('Products', true)}{th('Active')}{th('', true)}</tr></thead>
            <tbody>
              {fc.map((c) => {
                const cu = c.subs.filter((s) => s.state === 'unmapped').length;
                const cw = c.subs.filter(isWrong).length;
                const cm = c.subs.filter((s) => s.targets.length > 0).length;
                const counted = c.subs.every((s) => s.skuCount != null);
                const n = counted ? c.subs.reduce((a, s) => a + s.skuCount, 0) : posCount(c.name);
                const inactive = c.subs.filter((s) => !s.active).length;
                return <tr key={c.name} style={{ borderTop: `1px solid ${P.hairline}` }}>
                  <td style={{ padding: '12px 16px' }}><button data-hw-i onClick={() => setEditCat(c.name)} style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: P.fontSans }}><CatGlyph name={c.name} /><span style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>{c.name}</span></button></td>
                  <td style={{ padding: '12px 16px', maxWidth: 300 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {c.subs.slice(0, 3).map((s) => <span key={s.name} style={{ fontSize: P.type.meta, fontWeight: 600, color: P.ink2, background: P.surface3, borderRadius: P.r6, padding: '3px 8px' }}>{s.name}</span>)}
                      {c.subs.length > 3 && <span style={{ fontSize: P.type.meta, fontWeight: 600, color: P.inkMute, padding: '3px 4px' }}>+{c.subs.length - 3}</span>}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {cw > 0 && <Pill kind="bad" size="sm">{cw} wrong root</Pill>}
                      {cu > 0 && <Pill kind="bad" size="sm">{cu} unmapped</Pill>}
                      {cm > 0 && cu === 0 && cw === 0 && <Pill kind="good" size="sm" dot>{cm} mapped</Pill>}
                      {cm === 0 && cu === 0 && cw === 0 && <Pill kind="neutral" size="sm">all skipped</Pill>}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: P.fontMono, fontWeight: 600, color: P.ink2 }}>
                    {counted ? n : n.n == null ? <span style={{ fontSize: P.type.micro, color: P.warn, fontFamily: P.fontSans }}>{n.why}</span> : n.n}
                  </td>
                  <td style={{ padding: '12px 16px' }}>{inactive ? <Pill kind="warn" size="sm">{c.subs.length - inactive} of {c.subs.length}</Pill> : <Pill kind="good" size="sm" dot>{c.subs.length}</Pill>}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <IconBtn icon="pencil" size={15} label={'Edit ' + c.name} style={{ width: 32, height: 32 }} onClick={() => setEditCat(c.name)} />
                  </td>
                </tr>;})}
            </tbody>
          </table> :
          <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: P.type.strong }}>
            <thead><tr style={{ background: P.surface2 }}>{th('Sub-category')}{th('Parent category')}{th('Weedmaps node')}{th('Products', true)}{th('', true)}</tr></thead>
            <tbody>
              {fs.map((r, i) =>
              <tr key={i} style={{ borderTop: `1px solid ${P.hairline}` }}>
                <td style={{ padding: '11px 16px' }}>
                  <button data-hw-i onClick={() => setEditSub(r.parent + '::' + r.name)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: P.ink, fontSize: P.type.strong, fontWeight: 700, fontFamily: P.fontSans, padding: 0, textAlign: 'left' }}>{r.name}</button>
                  {r.id && <div style={{ fontSize: P.type.micro, color: P.inkFaint, fontFamily: P.fontMono }}>{r.id}</div>}
                </td>
                <td style={{ padding: '11px 16px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: P.type.body, color: P.ink2 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: catColor(P, r.parent) }} />{r.parent}</span></td>
                <td style={{ padding: '11px 16px' }}><WmPill sub={r} /></td>
                <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: P.fontMono, fontWeight: 600, color: P.ink2 }}>{r.skuCount == null ? <span style={{ fontSize: P.type.micro, color: P.warn, fontFamily: P.fontSans }}>no API</span> : r.skuCount}</td>
                <td style={{ padding: '11px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <PBtn size="xs" variant="secondary" icon="link" onClick={() => jump(r)}>Map</PBtn>
                  <IconBtn icon="pencil" size={15} label={'Edit ' + r.name} style={{ width: 32, height: 32 }} onClick={() => setEditSub(r.parent + '::' + r.name)} />
                </td>
              </tr>)}
            </tbody>
          </table>}
        </div>
      </Card>}
    </div>);
};

// ── where the numbers came from ─────────────────────────────────────────────
function SourceBanner({ src, tax }) {
  const P = useP();
  const kind = src.live ? 'good' : src.head === 'ASKING' || src.head === 'SLOW' ? 'info' : 'warn';
  const col = { good: P.good, info: P.info, warn: P.warn }[kind];
  const bg = { good: P.goodSoft, info: P.infoSoft, warn: P.warnSoft }[kind];
  return <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 15px', background: bg, borderRadius: P.r12 }}>
    <Icon name={src.live ? 'check-circle' : 'alert'} size={16} stroke={2} color={col} style={{ flex: '0 0 auto', marginTop: 1 }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: P.type.micro, fontWeight: 800, letterSpacing: '.08em', color: col, marginRight: 8 }}>{src.head}</span>
      <span style={{ fontSize: P.type.body, color: P.ink2, lineHeight: 1.5 }}>{src.body}</span>
      {src.live && tax.board && <span style={{ fontSize: P.type.micro, color: P.inkMute, fontFamily: P.fontMono, marginLeft: 8 }}>generated {new Date(tax.board.generated_at * 1000).toLocaleTimeString()}</span>}
    </div>
  </div>;
}

// ── the number that decides whether any of this worked ──────────────────────
function CoverageCard({ cov }) {
  const P = useP();
  const blocked = cov.blocked || 0;
  const others = Object.keys(cov.by_status || {}).filter((k) => k !== 'ok');
  return <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '13px 16px', borderRadius: P.r12, border: `1px solid ${blocked ? P.bad : P.good}`, background: blocked ? P.badSoft : P.goodSoft }}>
    <div>
      <div style={{ fontSize: P.type.h2, fontWeight: 800, fontFamily: P.fontMono, color: blocked ? P.bad : P.good }}>{cov.publishable} of {cov.products}</div>
      <div style={{ fontSize: P.type.meta, fontWeight: 700, color: blocked ? P.bad : P.good }}>products carry a Weedmaps category</div>
    </div>
    <div style={{ flex: 1, minWidth: 240, fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5 }}>
      {blocked} do not: {others.map((k) => cov.by_status[k] + ' ' + k.replace(/_/g, ' ')).join(' · ')}. {UNMAPPED_TRUTH}
    </div>
  </div>;
}

// ── what is wrong right now ─────────────────────────────────────────────────
function ProblemStrip({ wrong, unmapped, stale, mapped, skipped, live, onJump }) {
  const P = useP();
  const Stat = ({ n, label, c, sub }) => <div style={{ flex: '1 1 150px', background: P.surface2, border: `1px solid ${P.hairline}`, borderRadius: P.r12, padding: '11px 14px' }}>
    <div style={{ fontSize: P.type.h2, fontWeight: 800, color: c, fontFamily: P.fontMono }}>{n}</div>
    <div style={{ fontSize: P.type.meta, color: P.inkDim, fontWeight: 600 }}>{label}</div>
    {sub && <div style={{ fontSize: P.type.micro, color: P.inkMute, marginTop: 2 }}>{sub}</div>}
  </div>;
  const Group = ({ icon, title, kind, rows, body }) => rows.length ? <Card padding={0} style={{ marginBottom: 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderBottom: `1px solid ${P.hairline}`, background: kind === 'bad' ? P.badSoft : P.warnSoft }}>
      <Icon name={icon} size={15} stroke={2} color={kind === 'bad' ? P.bad : P.warn} />
      <span style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>{title}</span>
      <Pill kind={kind} size="sm">{rows.length}</Pill>
    </div>
    <div style={{ padding: '11px 16px 14px' }}>
      <div style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5, marginBottom: 10 }}>{body}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {rows.map((s) => <button data-hw-i key={s.parent + s.name} onClick={() => onJump(s)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: P.ctrlH.xs, fontSize: P.type.body, fontWeight: 600, color: P.ink, background: P.surface, border: `1px solid ${kind === 'bad' ? P.bad : P.warn}`, borderRadius: P.r999, padding: '5px 12px', cursor: 'pointer', fontFamily: P.fontSans }}>
          <span style={{ width: 6, height: 6, borderRadius: 2, background: catColor(P, s.parent) }} />{s.parent} › {s.name}
          <Icon name="arrow-right" size={12} stroke={2.2} color={P.inkMute} /></button>)}
      </div>
    </div>
  </Card> : null;

  return <div style={{ marginBottom: 16 }}>
    <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
      {/* Wrong-root and dead-node rows ARE mapped rows, so they are named here
          as a subset. Drawn as peers, the four numbers sum to more than there
          are rows and an operator counting them finds one that is not there. */}
      <Stat n={mapped.length} label="Mapped" c={P.good}
        sub={!live ? 'MOCK — labels, no ids' : (wrong.length + stale.length) ? 'of which ' + (wrong.length + stale.length) + ' are wrong or dead, below' : 'real Weedmaps node ids'} />
      <Stat n={wrong.length} label="Wrong root" c={wrong.length ? P.bad : P.inkMute} sub="our category vs theirs" />
      <Stat n={unmapped.length} label="Unmapped" c={unmapped.length ? P.bad : P.inkMute} sub="publishes uncategorised" />
      <Stat n={stale.length} label="Dead node" c={stale.length ? P.bad : P.inkMute} sub="mapping intact, node gone" />
      <Stat n={skipped.length} label="Skipped" c={P.inkMute} sub="decided — not work" />
    </div>
    <Group icon="alert" kind="bad" title="Mapped to the wrong part of Weedmaps" rows={wrong}
      body={'These publish today, into a Weedmaps root that disagrees with our own top-level category. Nothing on either side reports it — the row looks healthy and the products land in the wrong menu section. This screen offers the correction and does not apply it: re-pointing a live mapping changes what sits on the real Weedmaps listing.'} />
    <Group icon="alert" kind="bad" title="Unmapped — not blocked, which is worse" rows={unmapped} body={UNMAPPED_TRUTH} />
    <Group icon="shield" kind="bad" title="Mapped to a node Weedmaps no longer serves" rows={stale}
      body={'The mapping is intact and the node underneath it is retired or unknown, so the products stopped appearing and nothing raised an error. Re-syncing does not fix it.'} />
  </div>;
}

// ── the board — this is where a human maps things by hand ───────────────────
function MappingBoard({ cats, nodes, live, tax, focus, setFocus, onMockSet, onEditSub }) {
  const P = useP();
  const [pick, setPick] = React.useState(null);   // {key, replacing}
  const [act, setAct] = React.useState({});       // key -> {busy, msg, ok}
  const [arm, setArm] = React.useState(null);     // {key, kind, from, to}
  const W = writeState();
  const keyOf = (s) => s.parent + '::' + s.name;
  const note = (k, msg, ok) => setAct((a) => ({ ...a, [k]: { busy: false, msg: msg, ok: ok } }));

  const run = (s, fn, what) => {
    const k = keyOf(s);
    setArm(null);
    setAct((a) => ({ ...a, [k]: { busy: true, msg: null, ok: false } }));
    return fn().then((r) => {
      if (r && r.ok) { note(k, what + ' — accepted. The board below is re-read from the API, not from this screen.', true); }
      else {
        // A refusal and an unreachable server are different events and must not
        // share a sentence: one is the contract explaining itself, the other is
        // no contract at all. hw-live.js prefixes transport failures.
        var e1 = (r && r.error) || 'no reason given';
        note(k, (/^request failed/.test(e1) ? 'Could not reach the API — ' : 'The API refused it: ') + e1 + '. Nothing changed.', false);
      }
    }).catch((e) => note(k, 'The request failed: ' + (e && e.message ? e.message : 'unknown') + '. Nothing changed.', false));
  };
  const mockNote = (s) => note(keyOf(s), 'MOCK only — that changed this screen and nothing else. There is no Weedmaps id behind a label, and no API to save it to.', false);

  const doMap = (s, node) => {
    setPick(null);
    if (!live) { onMockSet(s.parent, s.name, { targets: s.targets.concat([T(node.path)]), skip: false }); mockNote(s); return; }
    run(s, () => window.HW_TAXONOMY.map(s.id, node.id), 'Mapped ' + s.id + ' → ' + node.path + ' #' + node.id);
  };
  const doReplace = (s, from, to) => {
    setPick(null);
    if (!live) { onMockSet(s.parent, s.name, { targets: s.targets.map((x) => x === from ? T(to.path) : x) }); mockNote(s); return; }
    run(s, () => window.HW_TAXONOMY.map(s.id, to.id).then((r) => r && r.ok ? window.HW_TAXONOMY.unmap(s.id, from.nodeId) : r),
      'Re-pointed ' + s.id + ' to ' + to.path + ' #' + to.id + ' and removed #' + from.nodeId);
  };
  const doUnmap = (s, t) => {
    if (!live) { onMockSet(s.parent, s.name, { targets: s.targets.filter((x) => x !== t) }); mockNote(s); return; }
    run(s, () => window.HW_TAXONOMY.unmap(s.id, t.nodeId), 'Un-mapped ' + (t.path || '#' + t.nodeId));
  };
  const doSkip = (s, reason) => {
    if (!live) { onMockSet(s.parent, s.name, { skip: true, targets: [] }); mockNote(s); return; }
    run(s, () => window.HW_TAXONOMY.skip(s.id, reason), 'Recorded the decision that ' + s.id + ' never syncs');
  };
  const doUnskip = (s) => {
    if (!live) { onMockSet(s.parent, s.name, { skip: false }); mockNote(s); return; }
    run(s, () => window.HW_TAXONOMY.unskip(s.id), 'Un-skipped ' + s.id);
  };

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    {!W.ok && <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 15px', background: P.warnSoft, borderRadius: P.r12 }}>
      <Icon name="lock" size={15} stroke={2} color={P.warn} />
      <span style={{ fontSize: P.type.body, color: P.ink2, lineHeight: 1.5 }}>{W.why}</span>
    </div>}

    <NameCheckCard live={live} tax={tax} cats={cats} nodes={nodes} />

    {cats.map((c) => <Card key={c.name} padding={0} style={{ overflow: 'visible' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px', borderBottom: `1px solid ${P.hairline}`, flexWrap: 'wrap' }}>
        <CatGlyph name={c.name} size={28} />
        <span style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>{c.name}</span>
        <span style={{ fontSize: P.type.meta, color: P.inkMute, fontFamily: P.fontMono }}>{c.subs.length} sub-categor{c.subs.length === 1 ? 'y' : 'ies'}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: P.type.micro, color: P.inkMute }}>{allowedRoots(c.name) ? 'belongs under ' + allowedRoots(c.name).join(' / ') + ' on Weedmaps' : 'no root rule — mappings here are not root-checked'}</span>
      </div>
      <div>
        {c.subs.map((s, i) => {
          const k = keyOf(s);
          const a = act[k] || {};
          const sug = suggestFor(s, nodes);
          const openFor = pick && pick.key === k ? pick : focus === k ? { key: k, replacing: null } : null;
          const wrongTargets = s.targets.filter((t) => verdictOf(s, t).kind === 'wrong');
          const armed = arm && arm.key === k ? arm : null;
          return <div key={s.name} style={{ padding: '12px 16px', borderTop: i ? `1px solid ${P.hairline}` : 'none', background: focus === k ? P.highlightSoft : 'transparent' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 210px', minWidth: 0, paddingTop: 3 }}>
                <button data-hw-i onClick={() => onEditSub(s)} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: P.fontSans, fontSize: P.type.body, fontWeight: 700, color: P.ink, textAlign: 'left' }}>{s.name}</button>
                <div style={{ fontSize: P.type.micro, color: P.inkFaint, fontFamily: P.fontMono }}>{s.id || 'no id — mock row'}{s.skuCount == null ? '' : ' · ' + plural(s.skuCount, 'product')}</div>
              </div>
              <div style={{ flex: '1 1 280px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {s.state === 'skipped' ?
                  <div style={{ fontSize: P.type.meta, color: P.inkMute, lineHeight: 1.45 }}>
                    <Pill kind="neutral" size="sm">SKIPPED — DECIDED</Pill>
                    {s.skipReason ? <div style={{ marginTop: 5, paddingLeft: 8, borderLeft: `2px solid ${P.hairline3}`, color: P.ink2 }}>“{s.skipReason}” — {s.skippedBy || 'unknown'}</div> :
                      <div style={{ marginTop: 5, color: P.warn }}>No reason was recorded. An unexplained skip is indistinguishable from an accident six months from now.</div>}
                    <div style={{ marginTop: 5 }}>A decision, not work: {s.skuCount == null ? 'its products are' : plural(s.skuCount, 'product') + ' here are'} deliberately not on Weedmaps. {live ? 'It cannot be mapped while it is skipped — the API refuses that — so ' : 'Mapping it means first '}<b>Un-skip</b>{live ? ' first, which puts' : 'ping it, which puts'} it back on the work list as UNMAPPED.</div>
                  </div> :
                s.targets.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {s.targets.map((t, j) => <NodeLine key={j} sub={s} target={t} busy={a.busy}
                      onReplace={() => {setFocus(null);setArm(null);setPick({ key: k, replacing: t });}}
                      onRemove={() => {setFocus(null);setPick(null);setArm({ key: k, kind: 'unmap', from: t });}} />)}
                  </div> :
                  <div style={{ padding: '8px 10px', borderRadius: P.r8, background: P.badSoft, border: `1px solid ${P.bad}` }}>
                    <Pill kind="bad" size="sm">UNMAPPED</Pill>
                    <div style={{ fontSize: P.type.meta, color: P.bad, lineHeight: 1.45, marginTop: 4 }}>{UNMAPPED_TRUTH}</div>
                  </div>}
              </div>
              <div style={{ position: 'relative', flex: '0 0 auto', display: 'flex', gap: 6 }}>
                {s.state === 'skipped' ?
                  <PBtn size="sm" variant="secondary" icon="refresh" busy={a.busy} onClick={() => doUnskip(s)}
                    title="Un-skipping returns this row to UNMAPPED — back onto the work list">Un-skip</PBtn> : <>
                  <PBtn size="sm" variant={s.targets.length ? 'secondary' : 'accent'} icon="link" iconRight="chevron-down" busy={a.busy}
                    onClick={() => {setFocus(null);setArm(null);setPick(openFor && !openFor.replacing ? null : { key: k, replacing: null });}}>{s.targets.length ? 'Add node' : 'Map to Weedmaps'}</PBtn>
                  {!s.targets.length && <PBtn size="sm" variant="ghost" icon="eye-off" busy={a.busy}
                    onClick={() => {setPick(null);setFocus(null);setArm({ key: k, kind: 'skip', reason: '' });}}>Skip…</PBtn>}
                  {openFor && <NodePicker nodes={nodes} mock={!live} sub={s} replacing={openFor.replacing} suggested={sug}
                    onPick={(n) => openFor.replacing ? setArm({ key: k, kind: 'replace', from: openFor.replacing, to: n }) : doMap(s, n)}
                    onClose={() => {setPick(null);setFocus(null);}} />}
                </>}
              </div>
            </div>

            {/* Every change to an EXISTING mapping states what it replaces or
                removes, and what that does to the products, before it runs. */}
            {armed && armed.kind === 'skip' && <div style={{ marginTop: 9, padding: '11px 13px', borderRadius: P.r8, border: `1px solid ${P.hairline3}`, background: P.surface2, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ fontSize: P.type.meta, color: P.ink, lineHeight: 1.55 }}>
                Recording a decision that <b>{s.name}</b> never syncs to Weedmaps. The reason is the entire difference between SKIPPED and UNMAPPED — the API refuses a blank one, and an unexplained skip is indistinguishable from an accident six months from now.
              </div>
              <input value={armed.reason} onChange={(e) => setArm({ key: k, kind: 'skip', reason: e.target.value })}
                placeholder="Why does this sub-category never sync?"
                style={{ minHeight: P.ctrlH.sm, padding: '8px 11px', border: `1px solid ${P.fieldBorder || P.hairline2}`, borderRadius: P.r8, background: P.field || P.surface, fontSize: P.type.body, color: P.ink, fontFamily: P.fontSans, outline: 'none' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <PBtn size="sm" variant="secondary" icon="check" disabled={!String(armed.reason).trim() || (live && !W.ok)} onClick={() => doSkip(s, String(armed.reason).trim())}>Record it</PBtn>
                <PBtn size="sm" variant="ghost" onClick={() => setArm(null)}>Cancel</PBtn>
              </div>
            </div>}

            {armed && armed.kind !== 'skip' && <div style={{ marginTop: 9, padding: '11px 13px', borderRadius: P.r8, border: `1px solid ${P.hairline3}`, background: P.surface2, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ fontSize: P.type.meta, color: P.ink, lineHeight: 1.55 }}>
                {armed.kind === 'replace' ? <>
                  {live ? 'This changes the live Weedmaps listing. ' : 'MOCK — nothing is saved anywhere. '}Two writes, in this order:
                  {' '}<b style={{ fontFamily: P.fontMono }}>map {s.id || s.name} → {armed.to.path} {armed.to.id == null ? '' : '#' + armed.to.id}</b>, then
                  {' '}<b style={{ fontFamily: P.fontMono }}>remove {armed.from.path} {armed.from.nodeId == null ? '' : '#' + armed.from.nodeId}</b>.
                  {s.skuCount == null ? '' : ' It moves ' + plural(s.skuCount, 'product') + '.'}
                  {' '}If the first write is refused the second is not attempted, so the current mapping is never dropped on the way.
                </> : <>
                  {live ? 'This changes the live Weedmaps listing. ' : 'MOCK — nothing is saved anywhere. '}One write:
                  {' '}<b style={{ fontFamily: P.fontMono }}>remove {armed.from.path} {armed.from.nodeId == null ? '' : '#' + armed.from.nodeId}</b> from <b>{s.name}</b>.
                  {' '}{s.targets.length > 1 ? 'It keeps ' + plural(s.targets.length - 1, 'other node') + '.' :
                    'That leaves this sub-category UNMAPPED, and ' + (s.skuCount == null ? 'its products' : plural(s.skuCount, 'product')) + ' then publish with no category on them — silently, per engine.py:195.'}
                </>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <PBtn size="sm" variant={armed.kind === 'replace' ? 'accent' : 'danger'} icon="check" disabled={live && !W.ok}
                  onClick={() => armed.kind === 'replace' ? doReplace(s, armed.from, armed.to) : doUnmap(s, armed.from)}>
                  {armed.kind === 'replace' ? 'Replace it' : 'Unmap it'}</PBtn>
                <PBtn size="sm" variant="ghost" onClick={() => setArm(null)}>Cancel</PBtn>
              </div>
            </div>}

            {/* The offered correction for a wrong root. Never auto-applied. */}
            {!armed && wrongTargets.map((t) => {
              const best = sug[0];
              return <div key={'fix' + t.nodeId} style={{ marginTop: 9, padding: '10px 12px', borderRadius: P.r8, border: `1px solid ${P.hairline2}`, background: P.surface2 }}>
                {!best ? <div style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5 }}>
                  No node under {(allowedRoots(s.parent) || []).join(' / ') || 'our root'} resembles “{s.name}” closely enough for this screen to suggest one, so it suggests nothing rather than guessing. Press <b>Change</b> on the mapping above and pick one.
                </div> : <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ flex: 1, minWidth: 200, fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5 }}>
                    Suggested correction for <b>{t.path}</b>: <b style={{ color: P.ink, fontFamily: P.fontMono }}>{best.node.path} #{best.node.id}</b>. Nothing is applied until you press, and you get one more confirmation after that.
                  </span>
                  <PBtn size="sm" variant="secondary" icon="swap" onClick={() => {setPick(null);setFocus(null);setArm({ key: k, kind: 'replace', from: t, to: best.node });}}>Repoint…</PBtn>
                </div>}
              </div>;})}

            {a.msg && <div style={{ marginTop: 8, fontSize: P.type.meta, fontFamily: P.fontMono, lineHeight: 1.45, color: a.ok ? P.good : P.bad }}>{a.msg}</div>}
          </div>;})}
      </div>
    </Card>)}

    <ShutoutCard live={live} tax={tax} cats={cats} nodes={nodes} />
  </div>;
}

// ── does our own name resolve? ──────────────────────────────────────────────
// The silent one. engine.py:176 resolves by LOWERCASED NAME against Weedmaps'
// whole tree; a miss omits category_ids and the item publishes uncategorised.
function NameCheckCard({ live, tax, cats, nodes }) {
  const P = useP();
  const names = wmNameSet(nodes);
  const shop = window.HW_SHOP_CATEGORIES;   // the hyperwolf.com tree, when it lands
  const rows = cats.map((c) => ({ name: c.name, res: nameResolution(names, c.name), subs: c.subs.length }));
  const miss = rows.filter((r) => !r.res.ok);
  // Two of OUR categories aiming at the same Weedmaps root is a duplicate we
  // can prove from the rules, and it is how "Vapes" and "Vape Pens" both exist.
  const byRoot = {};
  cats.forEach((c) => {const a = allowedRoots(c.name);if (a) {const k = a.join('+');(byRoot[k] = byRoot[k] || []).push(c.name);}});
  const dupes = Object.keys(byRoot).filter((k) => byRoot[k].length > 1).map((k) => ({ root: k, names: byRoot[k] }));

  if (!live || !Object.keys(names).length) {
    return <Card padding={0}><div style={{ padding: '13px 16px', fontSize: P.type.body, color: P.ink2, lineHeight: 1.5 }}>
      <b>Our category NAME vs Weedmaps’ tree — not checked.</b> {live ? 'The API served no Weedmaps nodes at all, so the taxonomy has never been seeded and there are no names to check against.' : 'No API answered, so the only Weedmaps names on this page are hand-typed labels. Checking our names against our own guesses would prove nothing, so this check is not run rather than run on mock data.'} It is not claiming our names resolve.
    </div></Card>;
  }
  return <Card padding={0}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderBottom: `1px solid ${P.hairline}`, background: miss.length ? P.badSoft : P.surface2 }}>
      <Icon name="alert" size={15} stroke={2} color={miss.length ? P.bad : P.inkMute} />
      <span style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>Our category NAME vs Weedmaps’ tree</span>
      {miss.length ? <Pill kind="bad" size="sm">{miss.length} do not resolve</Pill> : <Pill kind="good" size="sm" dot>all {rows.length} resolve</Pill>}
    </div>
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.55 }}>
        This is a separate failure from an unmapped sub-category, and it is the one nobody can see. wmdemo/engine.py:63-88 caches every Weedmaps category by its <b>lowercased name</b>; engine.py:176 then does a plain lookup on our product’s category string. It is an exact string test — no punctuation is stripped and nothing is singularised — and a miss publishes the item <b>with no category at all</b>.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {rows.map((r) => <span key={r.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: P.type.body, fontWeight: 600, color: r.res.ok ? P.ink2 : P.bad, background: r.res.ok ? P.surface2 : P.badSoft, border: `1px solid ${r.res.ok ? P.hairline2 : P.bad}`, borderRadius: P.r999, padding: '5px 12px', fontFamily: P.fontMono }}>
          {r.name}
          <span style={{ fontSize: P.type.micro, fontWeight: 700 }}>{r.res.ok ? 'resolves' : r.res.near.length ? 'no — WM spells it “' + r.res.near.join('”/“') + '”' : 'no such Weedmaps category'}</span>
        </span>)}
      </div>
      {dupes.length > 0 && <div style={{ fontSize: P.type.meta, color: P.warn, lineHeight: 1.55 }}>
        {dupes.map((d) => d.names.join(' and ') + ' are two of our categories aiming at the same Weedmaps root (' + d.root.replace(/\+/g, ' / ') + ')').join('. ')}. One of them is redundant, and which one survives is a decision about the storefront, not a mechanic this screen should make.
      </div>}
      <div style={{ fontSize: P.type.micro, color: P.inkMute, lineHeight: 1.5 }}>
        {shop ? 'Checked against the hyperwolf.com category tree in window.HW_SHOP_CATEGORIES.' :
          'The authoritative hyperwolf.com category tree is not loaded on this page (window.HW_SHOP_CATEGORIES is undefined), so the names checked above are the ones the taxonomy board itself uses — not necessarily the ones the storefront shows. Nothing here is invented to fill that gap.'}
      </div>
    </div>
  </Card>;
}

// ── the exact set the matcher compares on ───────────────────────────────────
// GET /api/mapping/known-categories (wmdemo/server.py:572) serves
// `sorted(set(CATEGORY_MAP.values()))` — the EXACT strings mapping.py:221 tests
// `wm_cat != our_cat` against. Until that route existed this screen tested
// against Weedmaps' root NAMES, which are a superset, and had to print a caveat
// saying so. It does not any more: the real set is fetched and the comparison
// is the same one the matcher makes.
//
// A plain GET, the way hw-live-taxonomy.js reads /api/taxonomy — writes go
// through HW_LIVE.post, reads do not. It never aborts and it never invents a
// list: if the route does not answer, the card falls back to the roots-superset
// check AND says out loud that it is the weaker one. A silent downgrade from an
// exact check to an approximate one is how a screen starts lying.
function useKnownCategories(base, live) {
  const [st, setSt] = React.useState({ status: 'idle', list: null, source: null, err: null });
  React.useEffect(() => {
    if (!live || base == null) { setSt({ status: 'idle', list: null, source: null, err: null }); return; }
    let dead = false;
    setSt({ status: 'pending', list: null, source: null, err: null });
    fetch(base + '/api/mapping/known-categories', { credentials: 'omit', cache: 'no-store' })
      .then((r) => {if (!r.ok) {throw new Error('HTTP ' + r.status);}return r.json();})
      .then((j) => {
        if (dead) { return; }
        // A payload with no categories array is not this route answering.
        if (!j || !Array.isArray(j.categories)) { throw new Error('no `categories` array in the response'); }
        setSt({ status: 'live', list: j.categories, source: j.source || null, err: null });
      })
      .catch((e) => {if (!dead) {setSt({ status: 'error', list: null, source: null, err: e && e.message ? e.message : 'unknown' });}});
    return () => {dead = true;};
  }, [base, live]);
  return st;
}

// ── the category_shutout trap ───────────────────────────────────────────────
// mapping.py:220 drops every Weedmaps candidate whose category does not EQUAL
// ours, before any scoring happens. A shutout is therefore NOT "Weedmaps does
// not carry this product" — we never compared. Conflating the two emails a
// brand asking them to create a product Weedmaps already sells.
function ShutoutCard({ live, tax, cats, nodes }) {
  const P = useP();
  const known = useKnownCategories(tax.base, live);
  if (!live) { return null; }
  const exact = known.status === 'live' && known.list;
  // EXACT when the route answered: mapping.py:221 is `wm_cat != our_cat`, a
  // case-sensitive string compare, so this is one too — no lowercasing and no
  // punctuation stripped, because the matcher does neither.
  const against = exact ? known.list : uniq(nodes.map((n) => rootOf(n.path))).filter((r) => r && r !== '?');
  const cov = tax.coverage || {};
  const ours = uniq(cats.map((c) => c.name).concat((cov.blocked_skus || []).map((b) => b.category)));
  // AN EMPTY COMPARISON SET IS NOT A VERDICT. Without the exact route the
  // fallback compares against node paths — and when the taxonomy has never been
  // seeded there are none, at which point `indexOf < 0` is true for every name
  // and the card would report ALL of them shut out. "Flower is definitely shut
  // out" is a false claim that costs a person an afternoon. So with nothing to
  // compare against, the check is NOT RUN and says so.
  const canCheck = against.length > 0;
  const shut = canCheck ? ours.filter((n) => against.indexOf(n) < 0) : [];
  return <Card padding={0}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 16px', borderBottom: `1px solid ${P.hairline}`, background: shut.length ? P.warnSoft : P.surface2 }}>
      <Icon name="ban" size={15} stroke={2} color={shut.length ? P.warn : P.inkMute} />
      <span style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>Category shutout — the matcher never even compares</span>
      {!canCheck ? <Pill kind="neutral" size="sm">not checked</Pill> : shut.length ? <Pill kind="warn" size="sm">{shut.length}</Pill> : <Pill kind="neutral" size="sm">none found</Pill>}
      {/* Only ONE of these ever shows, and never alongside "not checked" —
          calling a check APPROXIMATE when no check ran is its own small lie. */}
      {exact ? <Pill kind="good" size="sm" dot>EXACT</Pill> : known.status === 'pending' ? <Pill kind="neutral" size="sm">asking…</Pill> : canCheck ? <Pill kind="warn" size="sm">APPROXIMATE</Pill> : null}
    </div>
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.55 }}>
        wmdemo/mapping.py:220 excludes every Weedmaps candidate whose category does not <b>equal</b> ours, before a single score is computed. A shutout is <b>not</b> evidence that Weedmaps does not carry the product — we never compared. It is a mapping defect on <b>our</b> side, and it must never be turned into a request to a brand to create a product Weedmaps already sells.
      </div>
      {shut.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {shut.map((n) => <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: P.type.body, fontWeight: 600, color: P.ink, background: P.surface, border: `1px solid ${P.warn}`, borderRadius: P.r999, padding: '5px 12px', fontFamily: P.fontMono }}>{n}</span>)}
      </div>}
      {exact ?
      <div style={{ fontSize: P.type.meta, color: P.inkDim, lineHeight: 1.55 }}>
        {shut.length === 0 ? 'Every category string in use is one of the ' + against.length + ' the matcher compares on (' + against.join(', ') + ').' :
          (shut.length === 1 ? 'That category string is not one of the ' : 'Those ' + shut.length + ' category strings are not among the ') + against.length + ' the matcher compares on (' + against.join(', ') + '), so nothing under ' + (shut.length === 1 ? 'it' : 'them') + ' can ever match — every candidate is excluded before it is compared.'}
        {' '}That list is <span style={{ fontFamily: P.fontMono }}>CATEGORY_MAP</span>’s own values, read live from <span style={{ fontFamily: P.fontMono }}>{(tax.base || '') + '/api/mapping/known-categories'}</span>{known.source ? ' (' + known.source + ')' : ''} — the same strings <span style={{ fontFamily: P.fontMono }}>mapping.py:221</span> tests, compared the same case-sensitive way. This is the exact check, not an approximation of it.
      </div> :
      <div style={{ fontSize: P.type.meta, color: P.warn, lineHeight: 1.55 }}>
        <b>{canCheck ? 'Approximate check.' : 'Not checked.'}</b> {known.status === 'pending' ? 'Waiting on ' : 'Could not read '}<span style={{ fontFamily: P.fontMono }}>{(tax.base || '') + '/api/mapping/known-categories'}</span>{known.status === 'error' ? ' (' + known.err + ')' : ''}, which serves the exact set the matcher compares on.
        {canCheck ?
          <span> Until it answers, the check above runs against Weedmaps’ own {against.length} root names, which are a <b>superset</b>: a name that is <i>not</i> a root is definitely shut out; a name that <i>is</i> a root may still be. {shut.length ? 'The ' + plural(shut.length, 'name') + ' above ' + (shut.length === 1 ? 'is' : 'are') + ' therefore certain; there may be more.' : 'So this card is not claiming there are none.'}</span> :
          <span> The weaker fallback — Weedmaps’ own root names — is not available either: this board holds no node paths at all, so there is nothing to compare our category strings against. <b>No shutout check has been run</b>, and the empty list above is not a claim that there are none.</span>}
      </div>}
    </div>
  </Card>;
}
