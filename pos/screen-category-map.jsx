// ── pos/screen-category-map.jsx ── OUR categories <-> WEEDMAPS' categories ──
//
// Self-wrapping IIFE: it declares NOTHING at top level, so it cannot clobber
// another file's globals (test/global-collisions.test.mjs — these pages have no
// module system and the last file loaded silently wins). Its only export is
// window.CategoryMapScreen.
//
// Reads ONE route: GET /api/taxonomy/categories (wmdemo/category_map.py).
// It writes nothing and has no write path to grow into by accident.
//
// ── WHY THIS SCREEN EXISTS ──────────────────────────────────────────────────
//
// The owner's words: "I dont see where I can visualize or map the categories
// between our system and weedmaps". He was right, and the reason is worth
// stating plainly because it is the defect this estate keeps producing — the
// answer was never COMPUTED, so there was nothing to render.
//
// pos/screen-categories.jsx does exist and it is good, but it answers a
// DIFFERENT question: the SUB-CATEGORY board ("Cold Cure Badder" -> WM node
// 425), mapped by hand, one row per shelf. That board assumes the top-level
// question is already settled. It is not settled, and the top level is what
// actually decides whether a SKU publishes with a category at all.
//
// ── THE ONE LINE THIS SCREEN IS ABOUT ───────────────────────────────────────
//
//     wmdemo/engine.py:862
//     cats = resolve_categories().get(str(_cat_key).lower(), [])
//
// That is a NAME LOOKUP against Weedmaps' own node names. Our nine canonical
// names either hit a WM node name or they do not. On a hit the item publishes
// with category_ids. On a miss, engine.py:919 simply LEAVES THE FIELD OFF and
// publishes the item anyway — live, on Weedmaps, with no category, and nothing
// errors. A rejection would be visible; this is not.
//
// ── THE THREE STATES THAT MUST NEVER RENDER ALIKE ───────────────────────────
//
//   RESOLVES     the canonical name matches a real WM node. Publishing works.
//
//   NO WM NODE   Weedmaps HAS NO SUCH NODE, anywhere in its 94. `Deals` is the
//                live one. THIS IS NOT "not yet mapped" AND MUST NOT LOOK LIKE
//                IT. An alias re-spells OUR side; the missing thing is on
//                THEIRS, so no alias, no mapping and no amount of work on this
//                screen can ever fix it. The only real answers are an owner
//                decision (Deals does not publish) or Weedmaps growing a node.
//                Rendered as "unmapped" it invites somebody to spend a morning
//                trying to map it and then conclude the tool is broken.
//
//   UNUSED       canonical, resolves fine, and no product carries it. Not a
//                defect — but not a success either, and folding it into
//                "mapped" inflates that number with rows that have never
//                published anything.
//
// There is a fourth the screen can be forced into: UNKNOWN USE — the route
// answered but could not read the catalog, so the count is `null`. Null is not
// zero. A zero there would silently turn every working category into UNUSED.
//
// ── WHAT IT DOES NOT DO ─────────────────────────────────────────────────────
//
// READ ONLY, deliberately. Nothing here posts. The two writes this screen could
// grow — editing an alias, and deciding a NO-WM-NODE category's publish policy
// — both change what goes live on the owner's real Weedmaps listing, and an
// alias edit in particular must be an EXPLICIT write with a NAMED REFUSAL when
// it would collide (taxonomy._build_alias_index already refuses a colliding
// alias at import, because a silent one re-files an entire top-level category).
//
// It also does not re-derive the match. Every id, every state and every count
// below is read off the route. The only thing this file computes is which
// visual bucket a row is shown in, from the `state` the server already set.
;(function () {
  'use strict';
  const useP = window.useP;

  const ROUTE = '/api/taxonomy/categories';

  function base() {
    try { if (window.HW_LIVE && window.HW_LIVE.base) { return window.HW_LIVE.base; } } catch (e) {}
    return window.location.origin;
  }

  // ONE shape for every outcome, so a caller can never confuse "the route is
  // not there" with "the route said there is nothing". Copied in spirit from
  // pos/screen-brands.jsx, which learned it the hard way: a 404 rendering as an
  // empty list reads as "all done".
  function getJSON(path) {
    const url = base() + path;
    return fetch(url, { credentials: 'omit', cache: 'no-store' }).then(function (res) {
      return res.text().then(function (txt) {
        let body = null, parsed = false;
        try { body = JSON.parse(txt); parsed = true; } catch (e) {}
        return { url: url, code: res.status, ok: res.ok, body: body,
          parsed: parsed, raw: String(txt || '').slice(0, 400) };
      });
    }).catch(function (e) {
      return { url: url, code: 0, ok: false, body: null, parsed: false, raw: '',
        netError: (e && e.message) || 'request failed' };
    });
  }

  // ── the four states, in ONE table ─────────────────────────────────────────
  // Every visual difference between them is decided here and nowhere else, so
  // two of them cannot drift into looking alike in one place while staying
  // distinct in another. `fixable` is the field that matters most: it is what
  // separates NO WEEDMAPS NODE from everything else on this screen.
  const STATES = {
    RESOLVES: {
      kind: 'good', icon: 'check-circle', label: 'resolves',
      short: 'publishes with these ids',
      why: 'This name matches a real Weedmaps node, so every product under it publishes carrying category_ids. Nothing to do.',
      fixable: null
    },
    NO_WM_NODE: {
      kind: 'bad', icon: 'ban', label: 'NO WEEDMAPS NODE',
      short: 'Weedmaps has no such node',
      why: 'Weedmaps carries no node with this name — not under a different parent, not under a different spelling, nowhere in its tree. Products under it publish with NO category at all, and Weedmaps accepts them anyway.',
      fixable: 'NOT FIXABLE HERE. An alias re-spells our side; the node that is missing is on theirs. This needs a decision — publish it uncategorised, or do not publish it — or Weedmaps has to grow a node.'
    },
    UNUSED: {
      kind: 'neutral', icon: 'circle', label: 'unused',
      short: 'resolves, no products carry it',
      why: 'The name resolves to a real Weedmaps node. No product in the catalog carries this category, so nothing has ever published through it. Not a fault — but not a proven mapping either, because nothing has exercised it.',
      fixable: null
    },
    UNKNOWN_USE: {
      kind: 'warn', icon: 'help', label: 'use unknown',
      short: 'resolves, catalog unreadable',
      why: 'The name resolves, but the catalog could not be read, so how many products carry it is UNKNOWN — which is not the same as none. Nothing on this row should be read as a product count.',
      fixable: null
    }
  };
  function st(row) { return STATES[row && row.state] || STATES.UNKNOWN_USE; }

  function num(v) { return v == null ? '—' : Number(v).toLocaleString(); }

  // ── the explainer ─────────────────────────────────────────────────────────
  // Top of the screen, never collapsed. A person who has never seen this system
  // has to be able to read the whole argument off the page.
  function Explainer() {
    const P = useP();
    const box = function (title, sub, tone) {
      return (
        <div style={{ flex: '1 1 0', minWidth: 150, padding: '11px 13px',
          background: tone === 'them' ? P.infoSoft : tone === 'link' ? P.accentSoft : P.surface3,
          border: '1px solid ' + (tone === 'link' ? P.accentBorder : P.hairline2),
          borderRadius: P.r10 }}>
          <div style={{ fontSize: P.type.strong, fontWeight: 700, color: tone === 'link' ? P.accentText : P.ink }}>{title}</div>
          <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 3, lineHeight: 1.45 }}>{sub}</div>
        </div>);
    };
    const arrow = function (label) {
      return (
        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '0 2px' }}>
          <Icon name="arrow-right" size={16} stroke={2} color={P.inkMute} />
          <span style={{ fontSize: P.type.micro, color: P.inkMute, fontFamily: P.fontMono }}>{label}</span>
        </div>);
    };
    const code = function (t) {
      return <code style={{ fontFamily: P.fontMono, fontSize: P.type.meta, background: P.surface3, padding: '1px 5px', borderRadius: P.r8 }}>{t}</code>;
    };
    return (
      <Card density="roomy" style={{ marginBottom: 18 }}>
        <Eyebrow>Two taxonomies, one name lookup</Eyebrow>
        <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink, margin: '8px 0 4px', letterSpacing: '-.01em' }}>
          Our category names are matched against Weedmaps&rsquo; node <em>names</em>. That is the whole mechanism.
        </div>
        <div style={{ fontSize: P.type.body, color: P.ink2, lineHeight: 1.6, maxWidth: 940 }}>
          A product&rsquo;s raw category string is folded to one of our nine canonical names, and that name is looked
          up against Weedmaps&rsquo; own node names &mdash; {code('resolve_categories().get(name.lower())')}.
          {' '}On a hit the item publishes bound to {code('[parent_id, id]')}.
          {' '}<strong>On a miss the field is simply left off and the item publishes anyway</strong> &mdash; live, with
          no category, and nothing errors. A rejection would be visible; this is not. That silence is what this screen ends.
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {box('A product’s raw category', '“Vapes” · “Pre-rolls” · “Gear” — whatever the row happens to say', 'us')}
          {arrow('_norm_category')}
          {box('Our canonical name', 'one of nine · every other spelling is an alias of one of them', 'us')}
          {arrow('name.lower()')}
          {box('The match', 'against Weedmaps’ node NAMES — first node wins a tie', 'link')}
          {arrow('binds')}
          {box('Weedmaps node ids', 'category_ids on the menu item — the only thing that publishes', 'them')}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {['RESOLVES', 'NO_WM_NODE', 'UNUSED'].map(function (k) {
            const s = STATES[k];
            return (
              <div key={k} style={{ flex: '1 1 240px', minWidth: 220, padding: '10px 12px',
                background: P.surface2, border: '1px solid ' + (k === 'NO_WM_NODE' ? P.bad : P.hairline2),
                borderRadius: P.r10 }}>
                <Pill kind={s.kind} size="sm" icon={s.icon}>{s.label}</Pill>
                <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 6, lineHeight: 1.45 }}>{s.why}</div>
                {s.fixable &&
                  <div style={{ fontSize: P.type.meta, color: P.bad, marginTop: 6, lineHeight: 1.45, fontWeight: 600 }}>{s.fixable}</div>}
              </div>);
          })}
        </div>
      </Card>);
  }

  // ── where every number on this screen came from ───────────────────────────
  function SourceBanner({ http, d }) {
    const P = useP();
    const tree = (d && d.wm_tree) || null;
    const cat = (d && d.catalog) || null;
    const table = (d && d.wm_node_table) || null;
    const mono = { fontFamily: P.fontMono };
    const line = function (icon, kind, text) {
      return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 0' }}>
          <span style={{ flex: '0 0 auto', marginTop: 1, color: kind === 'bad' ? P.bad : kind === 'warn' ? P.warn : kind === 'good' ? P.good : P.inkMute }}>
            <Icon name={icon} size={14} stroke={2} />
          </span>
          <span style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5 }}>{text}</span>
        </div>);
    };
    return (
      <Card density="compact" style={{ marginBottom: 18, background: P.surface2 }}>
        <Eyebrow>Where these numbers come from</Eyebrow>
        <div style={{ marginTop: 6 }}>
          {line('link', http.ok ? 'good' : 'bad',
            <span><code style={mono}>GET {ROUTE}</code> answered <strong>HTTP {http.code || 'no response'}</strong>{http.netError ? ' — ' + http.netError : ''}. Base <code style={mono}>{base()}</code>.</span>)}
          {tree && line('package', tree.error ? 'bad' : 'good',
            tree.error
              ? <span><strong>Weedmaps&rsquo; tree did not load:</strong> {tree.error}. Nothing below can name a node id, and no row&rsquo;s state can be trusted.</span>
              : <span>Weedmaps&rsquo; side: <strong>{num(tree.nodes)}</strong> nodes collapsing to <strong>{num(tree.names)}</strong> distinct names, read from <code style={{ fontFamily: P.fontMono, fontSize: 10.5 }}>{tree.path}</code> &mdash; the verbatim capture of <code style={mono}>GET /categories</code> that seeds this repo. <strong>No live Weedmaps call is made to draw this screen.</strong></span>)}
          {cat && line('database', cat.error ? 'bad' : 'good',
            cat.error
              ? <span><strong>The catalog could not be read</strong> &mdash; {cat.error}. Every product count below is <code style={mono}>null</code>, which the rows render as &ldquo;unknown&rdquo;, never as zero.</span>
              : <span>Our side: <strong>{num(d && d.counts && d.counts.products)}</strong> product rows carrying <strong>{num(cat.spellings)}</strong> distinct category spellings between them.</span>)}
          {table && tree && !tree.error && table.available && table.nodes !== tree.nodes && line('alert', 'warn',
            <span>This deployment&rsquo;s own <code style={mono}>wm_nodes</code> table holds <strong>{num(table.nodes)}</strong> nodes, not {num(tree.nodes)} &mdash; it was seeded from a shorter capture, and <code style={mono}>demo_seed</code> only re-seeds a table that is empty. <strong>This screen deliberately does not resolve against that table</strong>: doing so would report &ldquo;no Weedmaps node&rdquo; for categories that resolve perfectly well, which is a worse lie than showing nothing.</span>)}
          {tree && tree.collisions && tree.collisions.length > 0 && line('alert', 'warn',
            <span><strong>{tree.collisions.length}</strong> Weedmaps node name{tree.collisions.length === 1 ? ' is' : 's are'} used by more than one node, so a match on {tree.collisions.length === 1 ? 'it' : 'them'} is decided by order rather than by intent: {tree.collisions.map(function (col) {
              return <span key={String(col.kept_id) + '-' + String(col.ignored_id)}><code style={mono}>{col.name}</code> keeps id {col.kept_id}, ignores {col.ignored_id}{' '}</span>;
            })}. None of our nine names is one of them today.</span>)}
        </div>
      </Card>);
  }

  // ── the defect, named ─────────────────────────────────────────────────────
  // This is the reason the screen was asked for, so it sits ABOVE the table and
  // is not collapsible. It renders nothing at all when there is nothing to say.
  function TheDefect({ d }) {
    const P = useP();
    const uncat = (d && d.uncategorised_skus) || [];
    const rescued = (d && d.rescued_by_alias) || [];
    if (!uncat.length && !rescued.length) { return null; }
    const mono = { fontFamily: P.fontMono, fontSize: P.type.meta };

    // Grouped by the SPELLING that broke, because that is the unit a decision
    // gets made about — not the individual SKU.
    const byWhy = {};
    uncat.forEach(function (u) {
      const k = String(u.spelling) + '|' + String(u.why);
      if (!byWhy[k]) { byWhy[k] = { spelling: u.spelling, why: u.why, canonical: u.canonical, skus: [] }; }
      byWhy[k].skus.push(u.sku);
    });
    const groups = Object.keys(byWhy).map(function (k) { return byWhy[k]; })
      .sort(function (a, b) { return b.skus.length - a.skus.length; });

    const byRescue = {};
    rescued.forEach(function (r) {
      const k = String(r.spelling);
      if (!byRescue[k]) { byRescue[k] = { spelling: r.spelling, canonical: r.canonical, wm_ids: r.wm_ids, skus: [] }; }
      byRescue[k].skus.push(r.sku);
    });
    const rgroups = Object.keys(byRescue).map(function (k) { return byRescue[k]; })
      .sort(function (a, b) { return b.skus.length - a.skus.length; });

    return (
      <Card density="roomy" style={{ marginBottom: 18,
        border: '1px solid ' + (uncat.length ? P.bad : P.hairline2),
        background: uncat.length ? P.badSoft : P.surface }}>
        <SectionHead level={3}
          eyebrow="Products publishing to Weedmaps with no category"
          title={uncat.length
            ? uncat.length + ' SKU' + (uncat.length === 1 ? ' goes' : 's go') + ' live on Weedmaps with no category at all'
            : 'No SKU publishes uncategorised right now'}
          subtitle={uncat.length
            ? 'engine.py:919 sets category_ids only on a hit. On a miss it leaves the field off and publishes the item anyway — so this does not error, does not retry, and is invisible from our side.'
            : 'Every category spelling in the catalog folds to a canonical name that resolves to a real Weedmaps node.'} />
        {groups.map(function (g) {
          return (
            <div key={g.spelling + g.why} style={{ padding: '11px 13px', marginBottom: 8,
              background: P.surface, border: '1px solid ' + P.hairline2, borderRadius: P.r10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <code style={{ fontFamily: P.fontMono, fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>{g.spelling}</code>
                <Pill kind="bad" size="sm" icon="ban">{g.skus.length} SKU{g.skus.length === 1 ? '' : 's'}</Pill>
                {g.canonical &&
                  <span style={{ fontSize: P.type.meta, color: P.inkDim }}>folds to <strong>{g.canonical}</strong></span>}
              </div>
              <div style={{ fontSize: P.type.meta, color: P.ink2, marginTop: 6, lineHeight: 1.5 }}>{g.why}.</div>
              <div style={{ fontSize: P.type.meta, color: P.bad, marginTop: 5, lineHeight: 1.5, fontWeight: 600 }}>
                {g.canonical
                  ? 'No alias can fix this. An alias changes how WE spell it; the node that is missing is on WEEDMAPS. This needs a decision — does it publish uncategorised, or not publish at all?'
                  : 'No spelling we accept matches this string, so the product is not even filed under a category this system can reason about.'}
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                {g.skus.slice(0, 40).map(function (s) {
                  return <span key={s} style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.ink2, padding: '3px 7px', background: P.surface3, borderRadius: P.r8 }}>{s}</span>;
                })}
                {g.skus.length > 40 &&
                  <span style={{ fontSize: P.type.micro, color: P.inkMute, alignSelf: 'center' }}>+{g.skus.length - 40} more</span>}
              </div>
            </div>);
        })}
        {rgroups.length > 0 &&
          <div style={{ marginTop: groups.length ? 14 : 4 }}>
            <div style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink, marginBottom: 3 }}>
              {rescued.length} SKU{rescued.length === 1 ? ' was' : 's were'} in that same state and {rescued.length === 1 ? 'is' : 'are'} now fixed by the alias layer
            </div>
            <div style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5, marginBottom: 8, maxWidth: 900 }}>
              These raw spellings match no Weedmaps node name on their own. The publish path now folds them through
              {' '}<code style={mono}>_norm_category</code> first, so they resolve. Shown because the fix is recent, and
              because the same shape recurs the next time a spelling drifts.
            </div>
            {rgroups.map(function (g) {
              return (
                <div key={g.spelling} style={{ padding: '9px 12px', marginBottom: 6, background: P.goodSoft,
                  border: '1px solid ' + P.hairline2, borderRadius: P.r10, display: 'flex', gap: 10,
                  alignItems: 'center', flexWrap: 'wrap' }}>
                  <code style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink }}>{g.spelling}</code>
                  <Icon name="arrow-right" size={13} stroke={2} color={P.inkMute} />
                  <span style={{ fontSize: P.type.meta, color: P.ink }}><strong>{g.canonical}</strong></span>
                  <code style={{ fontFamily: P.fontMono, fontSize: P.type.meta, color: P.good }}>[{(g.wm_ids || []).join(', ')}]</code>
                  <Pill kind="good" size="sm" icon="check">{g.skus.length} SKU{g.skus.length === 1 ? '' : 's'}</Pill>
                </div>);
            })}
          </div>}
      </Card>);
  }

  // ── the Weedmaps side of one row ──────────────────────────────────────────
  function WmCell({ r }) {
    const P = useP();
    if (!r.wm_ids || !r.wm_ids.length) {
      return (
        <div style={{ minWidth: 0 }}>
          <Pill kind="bad" size="sm" icon="ban">no node exists</Pill>
          <div style={{ fontSize: P.type.micro, color: P.bad, marginTop: 4, lineHeight: 1.4 }}>
            not under another parent, not under another spelling
          </div>
        </div>);
    }
    const last = r.wm_nodes.length - 1;
    return (
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          {(r.wm_nodes || []).map(function (n, i) {
            return (
              <span key={String(n.id) + '-' + i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {i > 0 && <Icon name="arrow-right" size={11} stroke={2} color={P.inkMute} />}
                <span style={{ fontSize: P.type.body, fontWeight: i === last ? 700 : 500,
                  color: i === last ? P.ink : P.inkDim }}>
                  {n.name || <span style={{ color: P.bad }}>id not in the tree</span>}
                </span>
                <code style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.inkDim }}>[{n.id}]</code>
              </span>);
          })}
        </div>
        <div style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.inkMute, marginTop: 3 }}>
          category_ids [{r.wm_ids.join(', ')}]
        </div>
      </div>);
  }

  // ── the alias column ──────────────────────────────────────────────────────
  // Every spelling that folds into this category, and — for the ones a product
  // actually uses — whether the raw word would have resolved on its own.
  function AliasCell({ r, open, onToggle }) {
    const P = useP();
    const mono = { fontFamily: P.fontMono, fontSize: P.type.micro };
    const list = r.aliases || [];
    const used = list.filter(function (a) { return a.in_use; });
    const rescuers = list.filter(function (a) { return a.rescued_by_alias; });
    return (
      <div style={{ minWidth: 0 }}>
        <button onClick={onToggle} style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'transparent', border: 0, padding: 0, cursor: 'pointer', font: 'inherit',
          color: P.ink, textAlign: 'left' }}>
          <span style={{ fontSize: P.type.body, fontWeight: 600 }}>
            {r.alias_count} alias{r.alias_count === 1 ? '' : 'es'}
          </span>
          <span style={{ fontSize: P.type.micro, color: P.inkMute }}>{open ? 'hide' : 'show'}</span>
        </button>
        {rescuers.length > 0 &&
          <div style={{ marginTop: 4 }}>
            {rescuers.map(function (a) {
              return (
                <span key={a.alias} style={{ display: 'inline-flex', marginRight: 4, marginBottom: 3 }}>
                  <Pill kind="good" size="sm" icon="check">{a.spellings_in_use.join(', ') || a.alias}</Pill>
                </span>);
            })}
            <div style={{ fontSize: P.type.micro, color: P.inkDim, marginTop: 2, lineHeight: 1.4 }}>
              resolves only because of the alias
            </div>
          </div>}
        {!rescuers.length && used.length > 0 &&
          <div style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.inkDim, marginTop: 4 }}>
            in use: {used.map(function (a) { return a.spellings_in_use.join(', ') || a.alias; }).join(' · ')}
          </div>}
        {open &&
          <div style={{ marginTop: 8, padding: '8px 10px', background: P.surface2,
            border: '1px solid ' + P.hairline2, borderRadius: P.r10 }}>
            {list.map(function (a) {
              return (
                <div key={a.alias} style={{ display: 'flex', gap: 8, alignItems: 'baseline',
                  padding: '3px 0', flexWrap: 'wrap' }}>
                  <code style={{ fontFamily: P.fontMono, fontSize: P.type.micro,
                    color: a.is_canonical ? P.accentText : P.ink2,
                    fontWeight: a.is_canonical ? 700 : 400 }}>{a.alias}</code>
                  {a.is_canonical &&
                    <span style={{ fontSize: P.type.micro, color: P.inkMute }}>canonical</span>}
                  {/* THREE STATES, NOT TWO. `in_use` is null when the catalog
                      could not be read at all -- a different fact from "no
                      product carries this alias". Rendering null as "no product
                      uses it" made this screen falsify its own banner, which
                      promises above that counts render as unknown and NEVER as
                      zero. An operator judging whether an alias is load-bearing
                      would have been told nothing uses it, removed it, and sent
                      SKUs to Weedmaps with no category. */}
                  {a.in_use == null
                    ? <span style={{ fontSize: P.type.micro, color: P.inkMute, fontStyle: 'italic' }}>unknown — the catalog could not be read</span>
                    : a.in_use
                    ? <span style={{ fontSize: P.type.micro, color: P.ink2 }}>{num(a.products)} product{a.products === 1 ? '' : 's'}</span>
                    : <span style={{ fontSize: P.type.micro, color: P.inkMute }}>no product uses it</span>}
                  {a.rescued_by_alias &&
                    <span style={{ fontSize: P.type.micro, color: P.good, fontWeight: 600 }}>
                      would publish uncategorised without this alias
                    </span>}
                  {a.diverges &&
                    <span style={{ fontSize: P.type.micro, color: P.warn, lineHeight: 1.4 }}>
                      the literal word hits [{(a.own_ids || []).join(', ')}] on Weedmaps; folding it here publishes to [{(r.wm_ids || []).join(', ')}] instead
                      {a.in_use == null ? ' (whether any product uses it is unknown — the catalog could not be read)'
                        : a.in_use ? ' — and a product uses it' : ' (no product uses it today)'}
                    </span>}
                </div>);
            })}
            {(r.other_spellings_in_use || []).length > 0 &&
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid ' + P.hairline2,
                fontSize: P.type.micro, color: P.inkDim, lineHeight: 1.45 }}>
                also folded here by punctuation alone: {r.other_spellings_in_use.map(function (s) {
                  return <code key={s} style={{ ...mono, marginRight: 6 }}>{s}</code>;
                })}
              </div>}
          </div>}
      </div>);
  }

  window.CategoryMapScreen = function CategoryMapScreen() {
    const P = useP();
    const [http, setHttp] = React.useState(null);
    const [tick, setTick] = React.useState(0);
    const [open, setOpen] = React.useState({});

    React.useEffect(function () {
      let live = true;
      setHttp(null);
      getJSON(ROUTE).then(function (r) { if (live) { setHttp(r); } });
      return function () { live = false; };
    }, [tick]);

    const d = (http && http.ok && http.parsed) ? http.body : null;
    const rows = (d && Array.isArray(d.rows)) ? d.rows : [];
    const c = (d && d.counts) || {};

    const columns = [
      { label: 'Our category', width: '22%', render: function (r) {
        const s = st(r);
        // data-hw-cat / data-hw-cat-state are TEST HOOKS, and they are on the
        // cell rather than on the table row on purpose: DataTable owns the row
        // element, so an attribute placed there would depend on that atom's
        // internals. test/category-map-states.test.mjs reads these to assert
        // that the three states never render the same, which is a claim about
        // THIS file and must not become a claim about DataTable.
        return (
          <div style={{ minWidth: 0 }} data-hw-cat={r.category} data-hw-cat-state={r.state}>
            <div style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>{r.category}</div>
            <div style={{ marginTop: 4 }}>
              <Pill kind={s.kind} size="sm" icon={s.icon}>{s.label}</Pill>
            </div>
            {r.policy && r.policy.decision &&
              <div style={{ fontSize: P.type.micro, color: P.inkDim, marginTop: 4, lineHeight: 1.4 }}>
                owner decision: {r.policy.decision}{r.policy.decided_at ? ' · ' + r.policy.decided_at : ''}
              </div>}
          </div>);
      } },
      { label: 'Weedmaps node', width: '30%', render: function (r) { return <WmCell r={r} />; } },
      { label: 'Accepted spellings', width: '30%', render: function (r) {
        return <AliasCell r={r} open={!!open[r.category]}
          onToggle={function () {
            setOpen(function (m) {
              const n = Object.assign({}, m);
              n[r.category] = !n[r.category];
              return n;
            });
          }} />;
      } },
      { label: 'Our products', width: '18%', align: 'right', render: function (r) {
        if (r.product_count == null) {
          return (
            <span title="The catalog could not be read. This is not zero.">
              <Pill kind="warn" size="sm" icon="help">unknown</Pill>
            </span>);
        }
        return (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: P.fontMono, fontSize: P.type.numRow, fontWeight: 700,
              color: r.product_count ? P.ink : P.inkMute }}>{num(r.product_count)}</div>
            <div style={{ fontSize: P.type.micro, color: P.inkMute, marginTop: 2 }}>{st(r).short}</div>
          </div>);
      } }
    ];

    return (
      <div>
        <SectionHead level={1} eyebrow="Our categories ↔ Weedmaps' categories"
          title="Category map"
          subtitle="Every one of our nine canonical categories, every spelling that folds into it, the Weedmaps node it binds to with its ids, and how many of our products carry it."
          action={<PBtn icon="refresh" onClick={function () { setTick(tick + 1); }}>Reload</PBtn>} />

        <Explainer />

        {http && <SourceBanner http={http} d={d} />}

        {!http && <div style={{ marginBottom: 18 }}><SkeletonRows rows={4} /></div>}

        {http && !http.ok &&
          <ErrorState
            title={'GET ' + ROUTE + ' answered HTTP ' + (http.code || 'nothing at all')}
            body={'This deployment does not serve the category map route, so NOTHING BELOW IS A REPORT ABOUT OUR CATEGORIES — nothing looked. An empty screen here means the route is missing, never that every category is fine. It is served by wmdemo/category_map.py through wmdemo/server.py.'}
            detail={http.netError || ((http.body && http.body.error) || http.raw) || http.url}
            onRetry={function () { setTick(tick + 1); }}
            style={{ background: P.badSoft, borderRadius: P.r12, marginBottom: 18 }} />}

        {d &&
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))', gap: 12, marginBottom: 18 }}>
            <KPI label="Our categories" value={num(c.categories)}
              sublabel={num(c.resolves) + ' resolve · ' + num(c.unused) + ' unused'} icon="grid" />
            <KPI label="No Weedmaps node" value={num(c.no_wm_node)}
              sublabel={c.no_wm_node ? 'unfixable by mapping — needs a decision' : 'every category has a node'}
              icon="ban" />
            <KPI label="SKUs publishing uncategorised" value={num(c.products_uncategorised)}
              sublabel={c.products_uncategorised
                ? 'live on Weedmaps with no category, silently'
                : 'every spelling reaches a node'}
              icon="alert" />
            <KPI label="SKUs saved by the alias layer" value={num(c.products_rescued_by_alias)}
              sublabel={c.products_rescued_by_alias
                ? 'would publish uncategorised without it'
                : 'no spelling currently depends on an alias'}
              icon="check-circle" />
            <KPI label="Our products" value={num(c.products)}
              sublabel={c.spellings_unfoldable
                ? c.spellings_unfoldable + ' spelling(s) we refuse outright'
                : 'every spelling is accepted'}
              icon="package" />
          </div>}

        {d && <TheDefect d={d} />}

        {d && rows.length === 0 &&
          <EmptyState icon="grid" title="The route answered and listed no categories"
            body="wmdemo/taxonomy.TOP_LEVEL is the list this screen renders. An empty list means that tuple is empty, which would itself be the defect — it does not mean the categories are fine." />}

        {d && rows.length > 0 &&
          <DataTable columns={columns} rows={rows} rowKey={function (r) { return r.category; }} stickyHead />}

        {d && (d.unfoldable || []).length > 0 &&
          <Card density="roomy" style={{ marginTop: 22, border: '1px solid ' + P.bad }}>
            <SectionHead level={3} eyebrow="Below the category layer"
              title={d.unfoldable.length + ' category spelling' + (d.unfoldable.length === 1 ? '' : 's') + ' we refuse outright'}
              subtitle="No alias accepts these strings, so taxonomy._norm_category raises on them. The products carrying them are not merely unmapped — they are not filed under any category this system can reason about." />
            {d.unfoldable.map(function (u) {
              return (
                <div key={u.spelling} style={{ padding: '9px 12px', marginBottom: 6, background: P.surface2,
                  border: '1px solid ' + P.hairline2, borderRadius: P.r10 }}>
                  <code style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink }}>{u.spelling || '(empty string)'}</code>
                  <span style={{ fontSize: P.type.meta, color: P.inkDim, marginLeft: 8 }}>{num(u.products)} product{u.products === 1 ? '' : 's'}</span>
                </div>);
            })}
          </Card>}

        <DevNote id="catmap-what-green-means" tone="warn"
          title="What a green row here does and does not tell you">
          <DevNoteP>
            A <DevNoteMono>resolves</DevNoteMono> row means our category NAME matched a Weedmaps node
            NAME, and items will carry that node&rsquo;s ids. It does not mean the node is the RIGHT
            one. The match is on a lowercased string, first node wins a tie, and Weedmaps&rsquo; tree
            is not name-unique &mdash; <DevNoteMono>Diamonds</DevNoteMono> is two different nodes.
          </DevNoteP>
          <DevNoteP>
            It also says nothing about sub-categories. A product bound to
            {' '}<DevNoteMono>Flower [2]</DevNoteMono> is on the right shelf and no more specific than
            that. Choosing between Weedmaps&rsquo; Flower children is the sub-category board&rsquo;s
            job (Catalog &rarr; Categories), and it is a separate decision.
          </DevNoteP>
          <DevNoteP>
            The counts are product ROWS in this deployment&rsquo;s catalog, not Weedmaps listings. A
            category with products here still publishes nothing if the publish gate holds it.
          </DevNoteP>
        </DevNote>

        <DevNote id="catmap-read-only"
          title="This screen is read-only on purpose, and what a write would have to do">
          <DevNoteP>
            Nothing here posts. The two writes it could grow are an alias edit and a publish decision
            for a <DevNoteMono>NO WEEDMAPS NODE</DevNoteMono> category, and both change what goes live
            on the owner&rsquo;s real Weedmaps listing.
          </DevNoteP>
          <DevNoteP>
            An alias edit in particular must be an EXPLICIT write with a named refusal when it would
            collide. <DevNoteMono>taxonomy._build_alias_index</DevNoteMono> already refuses at import
            when one alias key would resolve to two different canonical names, because that silently
            re-files an entire top-level category. A UI that overwrote one quietly would reintroduce
            exactly that.
          </DevNoteP>
        </DevNote>
      </div>);
  };
})();
