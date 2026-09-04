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
// IT DOES NOT RE-DERIVE ANYTHING. Every id, every state, every count and every
// match key below is read off the route. The only things this file computes are
// which visual bucket a row is shown in — from the `state` the server already
// set — and which nodes in the picker share a name, from the collisions the
// route already reported.
//
// IT IS NO LONGER READ-ONLY, and the comment that used to sit here saying so
// was wrong for long enough to matter. Three writes: bind a category to a node,
// unbind it, and add / repoint / remove an accepted spelling. Every one of them
// goes through a preview whose product count must be echoed back, and every one
// of them can be REFUSED with a 409 that is a correct answer rather than a
// crash. See the `catmap-writes` note at the foot of the file.
//
// WHAT IT STILL DOES NOT DO: decide a publish policy for a category with no
// Weedmaps node. Not mapping something is an allowed resting state and needs no
// acknowledgement — the owner ruled it explicitly for `Deals`. There is no
// do-not-publish control and there must not be one.
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

  // WRITES. Same envelope as getJSON, for the same reason: a refusal (409), a
  // crash (500) and "we could not ask" (0) must stay three different things all
  // the way to the screen. The category editor's whole design rests on 409 ≠
  // 500 — a refusal is a CORRECT outcome and must never render as a breakage.
  function canWrite() {
    try { return !!(window.HW_LIVE && typeof window.HW_LIVE.post === 'function'); } catch (e) { return false; }
  }

  function post(path, payload) {
    const url = base() + path;
    if (canWrite()) {
      return Promise.resolve(window.HW_LIVE.post(path, payload)).then(function (r) {
        return Object.assign({ url: url }, r || {});
      });
    }
    return fetch(url, {
      method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    }).then(function (res) {
      return res.text().then(function (txt) {
        let body = null; try { body = JSON.parse(txt); } catch (e) {}
        return { ok: res.ok, code: res.status, body: body, url: url,
          raw: String(txt || '').slice(0, 400) };
      });
    }).catch(function (e) {
      return { ok: false, code: 0, body: null, url: url,
        netError: (e && e.message) || 'request failed' };
    });
  }

  function qs(params) {
    return Object.keys(params)
      .filter(function (k) { return params[k] != null && params[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
      .join('&');
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
      why: 'This name matches a real Weedmaps category type, so every product under it publishes carrying category_ids. Nothing to do.',
      fixable: null
    },
    // TONE CHANGED DELIBERATELY, 2026-08-27, on the owner's ruling: "if we
    // decide NOT to map deals, then that shouldnt be a problem and the system
    // should allow it." This used to be `bad` — a red row, forever, on a
    // category that is working exactly as decided. That is a nag about a
    // settled question, and a permanent alarm is an alarm nobody reads.
    //
    // WHAT DID NOT CHANGE, AND MUST NOT: the WORDS. It is still its own state
    // with its own label, and it still says an alias cannot fix it. Quieting
    // the colour is not the same as collapsing the state into "unmapped", and
    // the picker below makes that collapse EASIER to reach, not harder — an
    // operator who can now point any category at any node needs telling that
    // there is nothing correct to point this one at.
    NO_WM_NODE: {
      kind: 'info', icon: 'ban', label: 'NO WEEDMAPS CATEGORY TYPE',
      short: 'no category type to bind to — allowed',
      why: 'Weedmaps carries no category type with this name — not under a different parent, not under a different spelling, nowhere in its tree. Products under it publish with NO category at all, and Weedmaps accepts them anyway.',
      fixable: 'NOT FIXABLE, AND NOT A FAULT. An alias re-spells our side; the category type that is missing is on theirs. Unbound is an allowed resting state — nothing here is waiting on anybody. You can still point it at a category type with the picker, but Weedmaps has no right answer to point it at.'
    },
    // A PICK THAT HAS STOPPED MEANING ANYTHING. Somebody chose a Weedmaps node
    // and that node is no longer in the tree we resolve against. It is NOT
    // NO_WM_NODE (Weedmaps may well carry a node of this name) and it is NOT
    // RESOLVES. Its own state, because folding it into either one hides a
    // decision that has quietly stopped applying.
    BINDING_BROKEN: {
      kind: 'warn', icon: 'alert', label: 'BINDING BROKEN',
      short: 'the picked category type has left the tree',
      why: 'Someone bound this category to a specific Weedmaps category type, and that category type is not in the tree this deployment resolves against any more. Products under it publish with no category_ids — not because nothing was chosen, but because what was chosen is gone.',
      fixable: 'FIXABLE HERE: pick a category type again, or remove the binding to fall back to the name match.'
    },
    // A CATEGORY CAN BIND SEVERAL NODES NOW (2026-08-28), and this state only
    // exists because that is true: with at most one pick there was no OTHER
    // still-valid pick for a broken one to leave behind. It still publishes —
    // under whichever bound nodes still resolve — so it must read calmer than
    // BINDING BROKEN (nothing published at all is not what is happening) and
    // more urgent than resolves (a pick has genuinely stopped working).
    BINDING_PARTIAL: {
      kind: 'warn', icon: 'alert', label: 'PARTIALLY BROKEN',
      short: 'one of several picks has left the tree',
      why: 'This category is explicitly bound to more than one Weedmaps category type, and at least one of them is not in the tree this deployment resolves against any more. Products still publish under every pick that DOES resolve — the broken pick just contributes nothing until it is changed or removed.',
      fixable: 'FIXABLE HERE: open the bindings below, remove the pick that is no longer in the tree, or pick a replacement for it.'
    },
    UNUSED: {
      kind: 'neutral', icon: 'circle', label: 'unused',
      short: 'resolves, no products carry it',
      why: 'The name resolves to a real Weedmaps category type. No product in the catalog carries this category, so nothing has ever published through it. Not a fault — but not a proven mapping either, because nothing has exercised it.',
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

  // ── THE SECOND JOIN, which is not the one every other column shows ────────
  //
  // `wm_ids` answers the PUBLISH question: which node ids do we send with an
  // item. `match_key` answers the MATCH question: which single word does
  // mapping.eval_candidate() compare our category string against, BY IDENTITY,
  // before any scoring happens.
  //
  // They are DIFFERENT QUESTIONS WITH DIFFERENT ANSWERS. `Accessories`
  // publishes to [234, 9] and matches on `Gear`, because Weedmaps' Accessories
  // [9] is a child of the root Gear [234] and a WM product carries its whole
  // ancestor path -- so the ROOT is what decides its category. A screen that
  // renders only the first can show a row as `resolves`, in green, truthfully,
  // while every candidate for every SKU under it is thrown out before it is
  // ever compared. That was live for 804 of 1,529 SKUs (category_map.py says
  // so in its own comment) and this screen said RESOLVES for all of them.
  //
  // The route has carried `match_key`, `match_state`, `match_path`,
  // `match_differs` and `match_ambiguous` on every row, plus a whole top-level
  // `match` block, and until now NOTHING ON THIS SCREEN READ ANY OF IT. Built
  // server-side, never wired to the UI.
  //
  // IT GETS ITS OWN COLUMN, not a sub-line under the node and not a tooltip. A
  // fact that can contradict the green badge two columns to its left cannot be
  // rendered as a footnote to that badge.
  //
  // AND THE MATCH KEY IS NEVER PRESENTED AS A NAME WE COULD CHANGE. It is
  // Weedmaps' root node name, derived from cats.json; renaming our category on
  // screen would break the publish join and would not move the match key at
  // all. Display name and match key are two facts, and neither is allowed to
  // stand in for the other.
  const MATCH_STATES = {
    MATCHES: { kind: 'good', icon: 'check-circle', label: 'joins' },
    NO_MATCH_KEY: { kind: 'bad', icon: 'ban', label: 'NO MATCH KEY' },
    BROKEN_TREE: { kind: 'bad', icon: 'alert', label: 'BROKEN TREE' },
    UNKNOWN: { kind: 'warn', icon: 'help', label: 'unknown' }
  };

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
          Our category names are matched against Weedmaps&rsquo; category type <em>names</em>. That is the whole mechanism.
        </div>
        <div style={{ fontSize: P.type.body, color: P.ink2, lineHeight: 1.6, maxWidth: 940 }}>
          A product&rsquo;s raw category string is folded to one of our nine canonical names, and that name is looked
          up against Weedmaps&rsquo; own category type names &mdash; {code('resolve_categories().get(name.lower())')}.
          {' '}On a hit the item publishes bound to {code('[parent_id, id]')}.
          {' '}<strong>On a miss the field is simply left off and the item publishes anyway</strong> &mdash; live, with
          no category, and nothing errors. A rejection would be visible; this is not. That silence is what this screen ends.
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {box('A product’s raw category', '“Vapes” · “Pre-rolls” · “Gear” — whatever the row happens to say', 'us')}
          {arrow('_norm_category')}
          {box('Our canonical name', 'one of nine · every other spelling is an alias of one of them', 'us')}
          {arrow('name.lower()')}
          {box('The match', 'against Weedmaps’ category type NAMES — first category type wins a tie', 'link')}
          {arrow('binds')}
          {box('Weedmaps category type ids', 'category_ids on the menu item — the only thing that publishes', 'them')}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {['RESOLVES', 'NO_WM_NODE', 'UNUSED'].map(function (k) {
            const s = STATES[k];
            return (
              <div key={k} style={{ flex: '1 1 240px', minWidth: 220, padding: '10px 12px',
                background: P.surface2, border: '1px solid ' + (k === 'NO_WM_NODE' ? P.infoBorder || P.hairline2 : P.hairline2),
                borderRadius: P.r10 }}>
                <Pill kind={s.kind} size="sm" icon={s.icon}>{s.label}</Pill>
                <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 6, lineHeight: 1.45 }}>{s.why}</div>
                {/* The `fixable` sentence takes the STATE's own colour, not a
                    hardcoded red. NO WEEDMAPS NODE is a resting state and must
                    not shout; BINDING BROKEN is a real thing to fix and should. */}
                {s.fixable &&
                  <div style={{ fontSize: P.type.meta, color: s.kind === 'warn' ? P.warn : P.ink2, marginTop: 6, lineHeight: 1.45, fontWeight: 600 }}>{s.fixable}</div>}
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
              ? <span><strong>Weedmaps&rsquo; tree did not load:</strong> {tree.error}. Nothing below can name a category type id, and no row&rsquo;s state can be trusted.</span>
              : <span>Weedmaps&rsquo; side: <strong>{num(tree.nodes)}</strong> nodes collapsing to <strong>{num(tree.names)}</strong> distinct names, read from <code style={{ fontFamily: P.fontMono, fontSize: 10.5 }}>{tree.path}</code> &mdash; the verbatim capture of <code style={mono}>GET /categories</code> that seeds this repo. <strong>No live Weedmaps call is made to draw this screen.</strong></span>)}
          {cat && line('database', cat.error ? 'bad' : 'good',
            cat.error
              ? <span><strong>The catalog could not be read</strong> &mdash; {cat.error}. Every product count below is <code style={mono}>null</code>, which the rows render as &ldquo;unknown&rdquo;, never as zero.</span>
              : <span>Our side: <strong>{num(d && d.counts && d.counts.products)}</strong> product rows carrying <strong>{num(cat.spellings)}</strong> distinct category spellings between them.</span>)}
          {table && tree && !tree.error && table.available && table.nodes !== tree.nodes && line('alert', 'warn',
            <span>This deployment&rsquo;s own <code style={mono}>wm_nodes</code> table holds <strong>{num(table.nodes)}</strong> category types, not {num(tree.nodes)} &mdash; it was seeded from a shorter capture, and <code style={mono}>demo_seed</code> only re-seeds a table that is empty. <strong>This screen deliberately does not resolve against that table</strong>: doing so would report &ldquo;no Weedmaps category type&rdquo; for categories that resolve perfectly well, which is a worse lie than showing nothing.</span>)}
          {tree && tree.collisions && tree.collisions.length > 0 && line('alert', 'warn',
            <span><strong>{tree.collisions.length}</strong> Weedmaps category type name{tree.collisions.length === 1 ? ' is' : 's are'} used by more than one category type, so a match on {tree.collisions.length === 1 ? 'it' : 'them'} is decided by order rather than by intent: {tree.collisions.map(function (col) {
              return <span key={String(col.kept_id) + '-' + String(col.ignored_id)}><code style={mono}>{col.name}</code> keeps id {col.kept_id}, ignores {col.ignored_id}{' '}</span>;
            })}.{' '}
            {/* DERIVED, NEVER ASSERTED. This sentence used to be the literal
                string "None of our nine names is one of them today." — a claim
                about live data, hard-coded, that nothing recomputed and nothing
                could falsify. The day one of our nine collided it would have
                gone on reassuring the reader. It is now read off the rows the
                route just sent. */}
            {(function () {
              const ours = ((d && d.rows) || []).map(function (r) { return String(r.category || '').toLowerCase(); });
              const hits = tree.collisions.filter(function (col) {
                return ours.indexOf(String(col.name || '').toLowerCase()) >= 0;
              });
              if (!ours.length) { return <strong>Whether any of our own names is one of them cannot be said — no rows came back.</strong>; }
              if (!hits.length) { return <span>None of our own {ours.length} names is one of them in this payload.</span>; }
              return (
                <strong data-hw-collision-ours="1" style={{ color: P.bad }}>
                  {hits.length} of our own names {hits.length === 1 ? 'is' : 'are'} one of them
                  {' '}({hits.map(function (h) { return h.name; }).join(', ')}) &mdash; so which category type
                  {' '}{hits.length === 1 ? 'it binds' : 'they bind'} to was decided by order. Pick the
                  category type explicitly to settle it.
                </strong>);
            })()}</span>)}
        </div>
      </Card>);
  }

  // ── the defect, named ─────────────────────────────────────────────────────
  // This is the reason the screen was asked for, so it sits ABOVE the table and
  // is not collapsible. It renders nothing at all when there is nothing to say.
  function TheDefect({ d }) {
    const P = useP();
    const uncat = (d && d.uncategorised_skus) || [];
    // `rescued_by_alias` USED TO BE RENDERED HERE, inside this card, and that
    // was the bug the owner reported: a list where every row is green with a
    // tick, nested inside a panel whose border goes red the moment anything
    // else in it is broken, under an eyebrow reading "Products publishing to
    // Weedmaps with no category". Four FIXED things read as four broken ones.
    // It is its own panel now (TheRescued), with its own tone. The information
    // stays — the fix being recent is exactly why it is worth showing.
    if (!uncat.length) { return null; }
    const mono = { fontFamily: P.fontMono, fontSize: P.type.meta };

    // Grouped by the SPELLING that broke, because that is the unit a decision
    // gets made about — not the individual SKU.
    const byWhy = {};
    uncat.forEach(function (u) {
      const k = String(u.spelling) + '|' + String(u.why);
      if (!byWhy[k]) {
        byWhy[k] = { spelling: u.spelling, why: u.why, canonical: u.canonical,
          // TWO CAUSES, ONE SYMPTOM, AND ONLY ONE OF THEM IS A DEFECT.
          //
          //   unfoldable  — a spelling NOBODY chose to accept. A rogue import,
          //                 a typo, a shop rename. Fixable right here by adding
          //                 an alias, and until somebody does, those SKUs
          //                 publish with no category.
          //   no_wm_node  — one of OUR nine, spelt fine, and Weedmaps simply
          //                 has no node for it. `Deals`. Nothing on our side
          //                 changes that, and the owner has said it is allowed:
          //                 "if we decide NOT to map deals, then that shouldnt
          //                 be a problem". Rendering it in the same red as the
          //                 fixable kind is a permanent alarm about a settled
          //                 decision, and a permanent alarm is one nobody reads.
          //
          // `kind` comes from the route. The fallback exists for a payload
          // written before the field did, and it derives the same split from
          // the same fact rather than defaulting to the reassuring one.
          kind: u.kind || (u.canonical ? 'no_wm_node' : 'unfoldable'),
          skus: [] };
      }
      byWhy[k].skus.push(u.sku);
    });
    const all = Object.keys(byWhy).map(function (k) { return byWhy[k]; })
      .sort(function (a, b) { return b.skus.length - a.skus.length; });
    const groups = all.filter(function (g) { return g.kind !== 'no_wm_node'; });
    const resting = all.filter(function (g) { return g.kind === 'no_wm_node'; });
    const brokenSkus = groups.reduce(function (a, g) { return a + g.skus.length; }, 0);
    const restingSkus = resting.reduce(function (a, g) { return a + g.skus.length; }, 0);

    return (
      <Card density="roomy" data-hw-defect="1"
        data-hw-defect-tone={brokenSkus ? 'alarm' : 'calm'}
        style={{ marginBottom: 18,
          border: '1px solid ' + (brokenSkus ? P.bad : P.hairline2),
          background: brokenSkus ? P.badSoft : P.surface }}>
        <SectionHead level={3}
          eyebrow="Products publishing to Weedmaps with no category"
          title={brokenSkus
            ? brokenSkus + ' SKU' + (brokenSkus === 1 ? ' goes' : 's go') + ' live on Weedmaps with no category, and nobody chose that'
            : restingSkus
              ? 'No SKU publishes uncategorised by accident'
              : 'No SKU publishes uncategorised right now'}
          subtitle={brokenSkus
            ? 'engine.py:919 sets category_ids only on a hit. On a miss it leaves the field off and publishes the item anyway — so this does not error, does not retry, and is invisible from our side. Every spelling below can be fixed from this screen by adding an alias.'
            : 'Every category spelling in the catalog folds to a canonical name that resolves to a real Weedmaps category type, or to one we have deliberately left unbound.'} />
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
                  ? 'No alias can fix this. An alias changes how WE spell it; the category type that is missing is on WEEDMAPS. This needs a decision — does it publish uncategorised, or not publish at all?'
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
        {resting.length > 0 &&
          <div data-hw-resting-uncategorised="1" style={{ marginTop: groups.length ? 14 : 4,
            padding: '11px 13px', background: P.surface2,
            border: '1px solid ' + P.hairline2, borderRadius: P.r10 }}>
            <div style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink, marginBottom: 3 }}>
              {restingSkus} SKU{restingSkus === 1 ? '' : 's'} publish{restingSkus === 1 ? 'es' : ''} with no category because
              {' '}Weedmaps has no category type for {resting.length === 1 ? 'that category' : 'those categories'} — which is allowed
            </div>
            <div style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5, maxWidth: 900 }}>
              This is not the same defect as the rows above and is not counted with them. These spellings fold to
              one of our nine perfectly well; the category type that is missing is on Weedmaps&rsquo; side, so no alias and
              no picker can reach it. <strong>Nothing here is waiting on anybody.</strong>
            </div>
            {resting.map(function (g) {
              return (
                <div key={g.spelling + g.why} style={{ display: 'flex', gap: 10, alignItems: 'center',
                  flexWrap: 'wrap', marginTop: 8 }}>
                  <code style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink }}>{g.spelling}</code>
                  <Pill kind="info" size="sm" icon="ban">{g.skus.length} SKU{g.skus.length === 1 ? '' : 's'}</Pill>
                  <span style={{ fontSize: P.type.meta, color: P.inkDim }}>{g.why}. No alias can fix this.</span>
                  <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {g.skus.slice(0, 12).map(function (sk) {
                      return <span key={sk} style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.ink2, padding: '3px 7px', background: P.surface3, borderRadius: P.r8 }}>{sk}</span>;
                    })}
                    {g.skus.length > 12 &&
                      <span style={{ fontSize: P.type.micro, color: P.inkMute, alignSelf: 'center' }}>+{g.skus.length - 12} more</span>}
                  </span>
                </div>);
            })}
          </div>}
      </Card>);
  }

  // ── how many SKUs the matcher discards before it scores anything ─────────
  //
  // A REAL alarm, and deliberately a SEPARATE panel from the publish defect
  // above it. One is about what we send to Weedmaps; the other is about what
  // we can ever match back. A deployment can be perfectly healthy on the first
  // and shut out on the second, and every green badge in the table below says
  // nothing whatsoever about this one.
  function TheShutout({ d }) {
    const P = useP();
    const m = (d && d.match) || null;
    if (!m) { return null; }
    const mono = { fontFamily: P.fontMono, fontSize: P.type.meta };
    const out = m.skus_shutout;
    // NULL IS NOT ZERO, and zero is the single most reassuring thing this panel
    // could say. An unreadable catalogue or an underivable vocabulary arrives
    // as null and must render as UNKNOWN. Printing 0 there asserts "nothing is
    // shut out", which is the one claim it has no evidence for.
    const unknown = out == null;
    const bad = !unknown && out > 0;
    if (!bad && !unknown && !m.error) {
      return (
        <Card density="compact" data-hw-shutout="clear" style={{ marginBottom: 18, background: P.surface2 }}>
          <Eyebrow>The other join</Eyebrow>
          <div style={{ fontSize: P.type.meta, color: P.ink2, marginTop: 5, lineHeight: 1.5, maxWidth: 900 }}>
            Every catalogue spelling is also spelt the way the MATCHER joins on, so no SKU is excluded
            before scoring. That is a different question from the table below, which is about what we publish.
          </div>
        </Card>);
    }
    const shut = (m.spellings || []).filter(function (x) { return !x.joins; });
    return (
      <Card density="roomy" data-hw-shutout={unknown ? 'unknown' : 'bad'}
        style={{ marginBottom: 18, border: '1px solid ' + (unknown ? P.warn : P.bad),
          background: unknown ? P.surface2 : P.badSoft }}>
        <SectionHead level={3} eyebrow="Before any score is computed"
          title={unknown
            ? 'How many SKUs the matcher excludes is UNKNOWN — which is not none'
            : num(out) + ' of ' + num(m.skus) + ' SKUs are excluded before the matcher scores anything'}
          subtitle={unknown
            ? 'The catalogue or the match vocabulary could not be read. This panel will not print 0 here: 0 would say "nothing is shut out", and nothing has been looked at.'
            : 'mapping.eval_candidate() compares our category string against Weedmaps\u2019 ROOT category type name BY IDENTITY. A spelling that is not that exact word excludes every candidate for every SKU carrying it — permanently, whatever the thresholds or the feed do. A row can read `resolves` in the table below and still be counted here: that badge is about publishing, and this is not.'} />
        {m.error &&
          <div style={{ fontSize: P.type.meta, color: P.bad, marginBottom: 10, lineHeight: 1.5 }}>
            The match vocabulary could not be derived: {m.error}
          </div>}
        {shut.slice(0, 12).map(function (x) {
          return (
            <div key={x.spelling} data-hw-shutout-row={x.spelling}
              style={{ padding: '9px 12px', marginBottom: 6, background: P.surface,
                border: '1px solid ' + P.hairline2, borderRadius: P.r10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <code style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink }}>{x.spelling || '(empty string)'}</code>
                <Pill kind="bad" size="sm" icon="ban">{num(x.products)} SKU{x.products === 1 ? '' : 's'}</Pill>
                {x.canonical &&
                  <span style={{ fontSize: P.type.meta, color: P.inkDim }}>folds to <strong>{x.canonical}</strong></span>}
                {x.match_key &&
                  <span style={{ fontSize: P.type.meta, color: P.inkDim }}>matcher joins on <code style={mono}>{x.match_key}</code></span>}
              </div>
              {x.why &&
                <div style={{ fontSize: P.type.meta, color: P.ink2, marginTop: 5, lineHeight: 1.5 }}>{x.why}</div>}
            </div>);
        })}
        {shut.length > 12 &&
          <div style={{ fontSize: P.type.micro, color: P.inkMute }}>+{shut.length - 12} more spellings</div>}
      </Card>);
  }

  // ── what the alias layer already FIXED ───────────────────────────
  //
  // ITS OWN PANEL, AND THAT IS THE ENTIRE POINT OF THIS COMPONENT.
  //
  // This list used to live at the bottom of TheDefect, inside a card whose
  // border and background go red whenever anything ELSE in that card is
  // broken, under the eyebrow "Products publishing to Weedmaps with no
  // category". So four SKUs that are FIXED were framed as four that are
  // failing, and the owner read the panel exactly the way it was styled --
  // as an alarm. Every row inside it was already green with a tick, which is
  // the tell: a container contradicting its own contents.
  //
  // The rule this encodes: TONE IS AN ASSERTION. A red border says "somebody
  // must act". Nobody must act on any of this -- it is a record of a repair,
  // kept visible because the repair is recent and because the same shape
  // recurs the next time a spelling drifts. So it is calm, it says `fixed` in
  // its title rather than leaving the reader to infer it from tick marks, and
  // it never inherits a neighbour's alarm.
  function TheRescued({ d }) {
    const P = useP();
    const rescued = (d && d.rescued_by_alias) || [];
    if (!rescued.length) { return null; }
    const mono = { fontFamily: P.fontMono, fontSize: P.type.meta };
    const byRescue = {};
    rescued.forEach(function (r) {
      const k = String(r.spelling);
      if (!byRescue[k]) { byRescue[k] = { spelling: r.spelling, canonical: r.canonical, wm_ids: r.wm_ids, skus: [] }; }
      byRescue[k].skus.push(r.sku);
    });
    const rgroups = Object.keys(byRescue).map(function (k) { return byRescue[k]; })
      .sort(function (a, b) { return b.skus.length - a.skus.length; });
    return (
      <Card density="roomy" data-hw-rescued="1" data-hw-rescued-tone="calm"
        style={{ marginBottom: 18, border: '1px solid ' + P.hairline2, background: P.surface }}>
        <SectionHead level={3} eyebrow="Already fixed — nothing here is waiting on anybody"
          title={rescued.length + ' SKU' + (rescued.length === 1 ? '' : 's')
            + ' would publish with no category, and ' + (rescued.length === 1 ? 'does' : 'do')
            + ' not, because the alias layer catches ' + (rescued.length === 1 ? 'it' : 'them')}
          subtitle={'These raw spellings match no Weedmaps category type name on their own. The publish path folds them through _norm_category first, so they resolve. This is a record of a repair, not a task — it is shown because the fix is recent, and because the same shape recurs the next time a spelling drifts.'} />
        {rgroups.map(function (g) {
          return (
            <div key={g.spelling} data-hw-rescued-row={g.spelling}
              style={{ padding: '9px 12px', marginBottom: 6, background: P.goodSoft,
                border: '1px solid ' + P.hairline2, borderRadius: P.r10, display: 'flex', gap: 10,
                alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink }}>{g.spelling}</code>
              <Icon name="arrow-right" size={13} stroke={2} color={P.inkMute} />
              <span style={{ fontSize: P.type.meta, color: P.ink }}><strong>{g.canonical}</strong></span>
              <code style={{ fontFamily: P.fontMono, fontSize: P.type.meta, color: P.good }}>[{(g.wm_ids || []).join(', ')}]</code>
              <Pill kind="good" size="sm" icon="check">{g.skus.length} SKU{g.skus.length === 1 ? '' : 's'} fixed</Pill>
            </div>);
        })}
        <div style={{ fontSize: P.type.micro, color: P.inkMute, marginTop: 4, lineHeight: 1.5 }}>
          Removing one of these spellings from <code style={mono}>Accepted spellings</code> below would put
          {' '}{rescued.length === 1 ? 'this SKU' : 'these SKUs'} straight back to publishing uncategorised.
        </div>
      </Card>);
  }

  // ── one Weedmaps node's own path (parent > child), arrow-joined ───────────
  // Factored out of WmCell so a name-match path and each EXPLICIT pick's own
  // path render with the exact same look — the only thing that changes below
  // is how many of these chains sit next to each other, and what separates them.
  function WmPathChain({ nodes, broken, nodeId }) {
    const P = useP();
    if (broken || !nodes || !nodes.length) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: P.type.body, fontWeight: 700, color: P.bad }}>
            category type {nodeId} — not in the tree
          </span>
        </span>);
    }
    const last = nodes.length - 1;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        {nodes.map(function (n, i) {
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
      </span>);
  }

  // ── several picks, one line each ────────────────────────────────────────
  // Same treatment WmCell gives `r.bindings` (own chain + "(one of N)" /
  // "(broken pick)"), factored out so PreviewPanel can give a multi-pick
  // preview the identical grouped rendering rather than re-deriving it.
  function WmPickList({ groups }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {groups.map(function (g, i) {
          return (
            <div key={(g.nodeId != null ? String(g.nodeId) : 'x') + '-' + i}
              style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                opacity: g.broken ? 0.85 : 1 }}>
              <WmPathChain nodes={g.nodes} broken={g.broken} nodeId={g.nodeId} />
              {groups.length > 1 &&
                <span style={{ fontSize: P.type.micro, color: P.inkMute }}>
                  {g.broken ? '(broken pick)' : '(one of ' + groups.length + ')'}
                </span>}
            </div>);
        })}
      </div>);
  }

  // ── the Weedmaps side of one row ──────────────────────────────────────────
  //
  // MULTIPLE EXPLICIT PICKS RENDER AS SEPARATE CHAINS, NOT ONE LONGER CHAIN.
  // Before 2026-08-28 `wm_nodes` was always ONE node's own [parent_id, id]
  // pair, so arrow-joining the whole list was correct — it drew that one
  // node's real ancestry. A category can now hold several INDEPENDENT picks
  // (Flower bound to both Flower and Infused Flower), and arrow-joining
  // those would draw a hierarchy between two nodes that share none — Infused
  // Flower is not a child of Flower just because an operator bound both.
  // `r.bindings` (one entry per explicit pick, each with its OWN resolved
  // path) is what makes the distinction renderable; it is empty for a
  // name-match or unbound row, which is exactly when the old single-chain
  // rendering is still correct and is kept as the fallback.
  function WmCell({ r }) {
    const P = useP();
    if (!r.wm_ids || !r.wm_ids.length) {
      return (
        <div style={{ minWidth: 0 }}>
          {/* `info`, not `bad`. The words still say the category type does not
              exist — which is the fact — but nothing here is a fault or a
              task. See STATES.NO_WM_NODE for the ruling this implements. */}
          <Pill kind="info" size="sm" icon="ban">no category type exists</Pill>
          <div style={{ fontSize: P.type.micro, color: P.inkDim, marginTop: 4, lineHeight: 1.4 }}>
            not under another parent, not under another spelling
          </div>
        </div>);
    }
    const bindings = r.bindings || [];
    return (
      <div style={{ minWidth: 0 }}>
        {bindings.length
          ? <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {bindings.map(function (b, i) {
                return (
                  <div key={String(b.node_id) + '-' + i}
                    data-hw-bound-node={b.node_id}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                      opacity: b.broken ? 0.85 : 1 }}>
                    <WmPathChain nodes={b.path} broken={b.broken} nodeId={b.node_id} />
                    {bindings.length > 1 &&
                      <span style={{ fontSize: P.type.micro, color: P.inkMute }}>
                        {b.broken ? '(broken pick)' : '(one of ' + bindings.length + ')'}
                      </span>}
                  </div>);
              })}
            </div>
          : <WmPathChain nodes={r.wm_nodes} broken={false} nodeId={null} />}
        <div style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.inkMute, marginTop: 3 }}>
          category_ids [{r.wm_ids.join(', ')}]
        </div>
      </div>);
  }

  // ── the match column ──────────────────────────────────────────────────────
  function MatchCell({ r }) {
    const P = useP();
    const mono = { fontFamily: P.fontMono, fontSize: P.type.micro };
    // NO MATCH STATE AT ALL IS NOT A MATCH STATE. category_map.py sends null
    // for every match_* field when the derivation itself could not run, and a
    // default here would invent a verdict about the exact question this column
    // exists to answer. `UNKNOWN` is a state the route can send; absence is not
    // it, and the two must not render alike.
    if (r.match_state == null) {
      return (
        <div data-hw-match={r.category} data-hw-match-state="ABSENT" style={{ minWidth: 0 }}>
          <Pill kind="warn" size="sm" icon="help">not derived</Pill>
          <div style={{ fontSize: P.type.micro, color: P.inkDim, marginTop: 4, lineHeight: 1.4 }}>
            This payload carried no match key. That is not the same claim as &ldquo;it matches&rdquo;.
          </div>
        </div>);
    }
    const m = MATCH_STATES[r.match_state] || MATCH_STATES.UNKNOWN;
    return (
      <div data-hw-match={r.category} data-hw-match-state={r.match_state} style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {r.match_key
            ? <code style={{ fontFamily: P.fontMono, fontSize: P.type.body, fontWeight: 700, color: P.ink }}>{r.match_key}</code>
            : <span style={{ fontSize: P.type.meta, color: P.bad, fontWeight: 600 }}>no key</span>}
          <Pill kind={m.kind} size="sm" icon={m.icon}>{m.label}</Pill>
        </div>
        {/* THE REASON THE COLUMN EXISTS, said in words on the rows where the two
            facts disagree. A silent difference between the display name and the
            match key is precisely what let `Accessories` read green. */}
        {r.match_differs === true &&
          <div data-hw-match-differs="1" style={{ fontSize: P.type.micro, color: P.warn, marginTop: 4, lineHeight: 1.45 }}>
            Not the same word as <strong>{r.category}</strong>. We publish under{' '}
            <code style={mono}>{r.wm_path || 'no category type'}</code>; the matcher compares on{' '}
            <code style={mono}>{r.match_key}</code>, Weedmaps&rsquo; ROOT category type name.{' '}
            <strong>Renaming this category on screen would break the publish join and would not move the match key.</strong>
          </div>}
        {r.match_state === 'NO_MATCH_KEY' &&
          <div style={{ fontSize: P.type.micro, color: P.bad, marginTop: 4, lineHeight: 1.45 }}>
            Our name resolves to no Weedmaps category type, so no candidate can ever carry it. Every candidate
            for every SKU here is excluded before scoring &mdash; whatever the thresholds or the feed do.
          </div>}
        {r.match_state === 'BROKEN_TREE' &&
          <div style={{ fontSize: P.type.micro, color: P.bad, marginTop: 4, lineHeight: 1.45 }}>
            The name matched, but the walk up to a root never terminated. That is a broken capture on
            our side, not a fact about Weedmaps&rsquo; taxonomy.
          </div>}
        {(r.match_ambiguous || []).length > 0 &&
          <div data-hw-match-ambiguous="1" style={{ fontSize: P.type.micro, color: P.warn, marginTop: 4, lineHeight: 1.45 }}>
            {r.match_ambiguous.map(function (a) {
              return (
                <span key={String(a.kept_id) + '-' + String(a.ignored_id)}>
                  <code style={mono}>{a.name}</code> is more than one Weedmaps category type &mdash; kept [{a.kept_id}], ignored [{a.ignored_id}].{' '}
                </span>);
            })}
            Decided by order, not by intent.
          </div>}
        {r.match_path &&
          <div style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.inkMute, marginTop: 3 }}>{r.match_path}</div>}
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

  // ══════════════════════════════════════════════════════════════════════════
  // THE EDITOR. Picker, aliases, preview — the owner's three answers.
  // ══════════════════════════════════════════════════════════════════════════
  //
  // He asked for three things and refused a fourth by not asking for it:
  //
  //   1. A PICKER over Weedmaps' real tree. NOT an id field. Typing an id is
  //      how a category ends up bound to whatever node happens to carry that
  //      number, and the number is right there in the payload — a text box
  //      would be asking the operator for something the system already knows.
  //   2. ALIAS add and edit, so the next rogue spelling ("Vapes", "Pre-rolls",
  //      both real, both were publishing uncategorised) does not wait on a
  //      developer. A collision REFUSES and names what it hit.
  //   3. A PREVIEW before saving, and the save is gated on echoing back the
  //      number the preview showed — the publish gate's own shape, for the
  //      publish gate's own reason: a screen that has gone stale must not be
  //      able to confirm.
  //
  // AND THE FOURTH, WHICH IS NOT HERE ON PURPOSE: there is no "do not publish"
  // button. He was not asked for one and did not choose one, and his words were
  // "if we decide NOT to map deals, then that shouldnt be a problem and the
  // system should allow it". Unbound is the DEFAULT — you reach it by doing
  // nothing — and a control that made you declare it would turn "not a problem"
  // into a chore. Do not add one back.

  // ── the node picker ───────────────────────────────────────────────────────
  // Weedmaps' 94 nodes as their real two-level tree, filterable. Every entry is
  // a node that EXISTS in the same capture every id on this screen was resolved
  // against, so the picker and the map cannot disagree about what a node is.
  // ── the picker ────────────────────────────────────────────────────────────
  //
  // WEEDMAPS' TREE IS NOT NAME-UNIQUE, and a picker that pretends otherwise is
  // the exact defect that made a probe wrong about which node our shelf binds
  // to. `Diamonds` is TWO live nodes -- 423 (solvent BHO) and 428 (solventless
  // rosin) -- and 94 nodes collapse to 93 names because of it.
  //
  // engine.resolve_categories() keeps the FIRST node it sees and drops the
  // other. So one of those two ids is reachable by name match and the other is
  // reachable ONLY by an explicit pick made here. Rendering them as two
  // identical-looking rows -- same word, different number, nothing else --
  // leaves the person to pick by coin flip, which is the same coin flip the
  // engine already made, only now with a human's name on it.
  //
  // So: every node in a name collision is MARKED, on both sides, and each side
  // says which one it is. The slug is shown too, because it is the only field
  // that tells 423 and 428 apart at a glance. `collisions` comes from
  // wm_tree.collisions -- the same capture every id on this screen resolved
  // against, so the picker and the map cannot disagree about who won.
  function NodePicker({ tree, value, onPick, collisions }) {
    const P = useP();
    const [q, setQ] = React.useState('');
    const nodes = tree || [];
    const collByName = {};
    (collisions || []).forEach(function (c) {
      const k = String(c.name || '').toLowerCase();
      if (!k) { return; }
      if (!collByName[k]) { collByName[k] = { name: c.name, kept_id: c.kept_id, ignored: [] }; }
      collByName[k].ignored.push(c.ignored_id);
    });
    const collOf = function (n) { return collByName[String(n.name || '').toLowerCase()] || null; };
    const roots = nodes.filter(function (n) { return n.parent_id == null; });
    const kids = {};
    nodes.forEach(function (n) {
      if (n.parent_id == null) { return; }
      (kids[n.parent_id] = kids[n.parent_id] || []).push(n);
    });
    const needle = q.trim().toLowerCase();
    const hit = function (n) {
      if (!needle) { return true; }
      return String(n.name || '').toLowerCase().indexOf(needle) >= 0
        || String(n.slug || '').toLowerCase().indexOf(needle) >= 0
        || String(n.id) === needle;
    };
    const shown = [];
    // FULL DEPTH, NOT TWO LEVELS. This walked roots and then kids[r.id] and
    // stopped, so anything at depth 2 or deeper was never rendered and the filter
    // only narrowed an already-truncated list. Measured against the live 94-node
    // tree: 47 OF 94 NODES WERE UNREACHABLE. That included BOTH Diamonds --
    // 423 under Solvent under Concentrates, and 428 under Rosin under Solventless
    // under Concentrates, each at depth 3 -- so typing "diamonds" into the filter
    // returned nothing at all. Also unreachable: every child of Apparel, Bongs
    // and Dab Rigs, plus Rolling Papers, RSO and Tinctures.
    //
    // The collision between the two Diamonds is the reason the picker exists at
    // all: the name match cannot separate them, so PICKING is the only way to
    // bind the loser. A picker that cannot show either one cannot do the single
    // job it was built for.
    //
    // A whole branch is kept when the branch ITSELF matches, so filtering to a
    // parent still reveals what is under it; otherwise only matching descendants
    // survive, and an ancestor is carried along only when it has a surviving
    // child -- so no node is ever shown without the path that explains it.
    const walk = function (node, depth, ancestorHit) {
      const selfHit = hit(node);
      const children = kids[node.id] || [];
      const rows = [];
      children.forEach(function (c) {
        rows.push.apply(rows, walk(c, depth + 1, ancestorHit || selfHit));
      });
      if (selfHit || ancestorHit || rows.length) {
        return [{ node: node, depth: depth }].concat(rows);
      }
      return [];
    };
    roots.forEach(function (r) {
      shown.push.apply(shown, walk(r, 0, false));
    });
    // Orphans: a node whose parent is not in the capture. Shown rather than
    // dropped — a node we cannot place is still a node somebody may need, and
    // silently omitting it makes the picker quietly incomplete.
    nodes.forEach(function (n) {
      if (n.parent_id != null && !nodes.some(function (m) { return m.id === n.parent_id; }) && hit(n)) {
        shown.push({ node: n, depth: 1, orphan: true });
      }
    });
    return (
      <div data-hw-picker="1">
        <input value={q} onChange={function (e) { setQ(e.target.value); }}
          placeholder={'Filter ' + nodes.length + ' Weedmaps category types by name, slug or id'}
          data-hw-picker-filter="1"
          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px',
            fontSize: P.type.body, fontFamily: P.fontSans, color: P.ink,
            background: P.surface, border: '1px solid ' + P.hairline3,
            borderRadius: P.r8 }} />
        {/* overscrollBehavior CONTAIN, and it is not cosmetic. This list holds
            1,425px of nodes in a 260px box, INSIDE the page's own scroller. With
            the browser default ('auto') the wheel scrolls this list, then CHAINS
            to the page the instant it hits either end -- so the operator scrolls
            the list, overshoots, and the whole screen lurches under them. That is
            the "screen jumped around" the owner reported on 2026-08-28. */}
        <div style={{ maxHeight: 260, overflowY: 'auto', overscrollBehavior: 'contain',
          marginTop: 8,
          border: '1px solid ' + P.hairline2, borderRadius: P.r10,
          background: P.surface }}>
          {shown.length === 0 &&
            <div style={{ padding: '12px 10px', fontSize: P.type.meta, color: P.inkMute }}>
              No Weedmaps category type matches “{q}”. That is a statement about their tree, not about ours.
            </div>}
          {shown.map(function (e) {
            const n = e.node;
            const sel = value != null && Number(value) === Number(n.id);
            return (
              <button key={String(n.id) + '-' + e.depth} type="button"
                data-hw-node={String(n.id)}
                data-hw-node-selected={sel ? '1' : '0'}
                onClick={function () { onPick(n.id); }}
                style={{ display: 'block', width: '100%', textAlign: 'left',
                  padding: e.depth ? '5px 10px 5px 26px' : '6px 10px',
                  background: sel ? P.accentSoft : 'transparent',
                  border: 0, borderBottom: '1px solid ' + P.hairline2,
                  cursor: 'pointer', font: 'inherit',
                  color: sel ? P.accentText : P.ink }}>
                <span style={{ fontSize: P.type.body, fontWeight: e.depth ? 500 : 700 }}>{n.name}</span>
                <code style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.inkDim, marginLeft: 6 }}>[{n.id}]</code>
                {e.orphan &&
                  <span style={{ fontSize: P.type.micro, color: P.warn, marginLeft: 6 }}>parent {n.parent_id} is not in the capture</span>}
                {n.published === false &&
                  <span style={{ fontSize: P.type.micro, color: P.warn, marginLeft: 6 }}>not published on Weedmaps</span>}
                {(function () {
                  const col = collOf(n);
                  if (!col) { return null; }
                  const kept = Number(col.kept_id) === Number(n.id);
                  return (
                    <span data-hw-node-collision={String(n.id)}
                      data-hw-node-collision-side={kept ? 'kept' : 'ignored'}>
                      <span style={{ fontSize: P.type.micro, color: P.warn, marginLeft: 6, fontWeight: 700 }}>
                        SAME NAME AS {col.ignored.length + 1 > 2 ? (col.ignored.length + 1) + ' CATEGORY TYPES' : 'ANOTHER CATEGORY TYPE'}
                      </span>
                      <span style={{ display: 'block', fontSize: P.type.micro, color: P.inkDim, marginTop: 2, lineHeight: 1.45 }}>
                        {kept
                          ? 'The name match lands here by ORDER, not by intent — it keeps the first category type of this name and drops [' + col.ignored.join(', ') + '].'
                          : 'The name match NEVER reaches this category type — it keeps [' + col.kept_id + ']. Picking it here is the only way to bind it.'}
                        {n.slug ? ' Slug: ' + n.slug + '.' : ''}
                      </span>
                    </span>);
                })()}
              </button>);
          })}
        </div>
      </div>);
  }

  // ── the preview, and the review that gates the save ───────────────────────
  //
  // REDESIGNED 2026-09-01, on the owner's ask to lose "type the number back"
  // without losing the guarantee it existed for. THE GUARANTEE ITSELF DID NOT
  // MOVE: a stale preview must never be able to confirm itself. What moved is
  // WHO holds the number. Before: the operator retyped it, and a typo or a
  // stale memorized digit could still match a NEW, also-stale count by
  // coincidence. Now: this component re-fetches the count itself, once when
  // "Review" is clicked and once more when "Confirm" is clicked, and refuses
  // to save unless both reads agree. Retyping never verified freshness anyway
  // — it only verified the operator could read a number off the screen and
  // copy it a few inches. Re-asking the server does.
  //
  // THREE CONFIRMATION SHAPES, NOT TWO, and this is still the whole reason
  // this component exists rather than a bare "Confirm" button:
  //
  //   products_known === true   → Review locks in a live count; Confirm
  //                               re-checks it live one more time before
  //                               saving, and goes stale (not silent) if the
  //                               two reads disagree.
  //   products_known === false  → the catalog could not be read, so the count
  //                               is UNKNOWN. You confirm the UNKNOWN itself
  //                               (a checkbox that sends null). There is
  //                               deliberately NO way to type 0 here: an
  //                               absence and an unknown must not be able to
  //                               produce the same request. Unaffected by this
  //                               redesign — there is no number to go stale.
  //   would_refuse !== null     → no save control at all, and the reason is
  //                               printed. A button that discovers on submit
  //                               that it could never have worked is worse than
  //                               no button.
  //
  // `onReview` is the live re-ask: a caller-supplied () => Promise<preview |
  // null> that hits the SAME preview URL the caller's own mount effect used,
  // fresh. Every caller passes one (BindingEditor and AliasEditor each expose
  // their own previewPath()/fetchLivePreview() for exactly this). Falling back
  // to the already-loaded `pv` when it is missing keeps this component from
  // crashing if one ever does not, but that path can never detect staleness —
  // it is a safety net, not a supported configuration.
  //
  // `fromGroups`/`toGroups` are optional: an array of { nodes, broken, nodeId }
  // per DISTINCT pick, exactly the shape WmPickList/WmCell already use. Passed
  // only by callers that know a side can hold more than one independent pick
  // (BindingEditor's bind/unbind) -- AliasEditor never passes them, and
  // BindingEditor's reassign flow deliberately does not either (it builds its
  // own single old-> new swap string), which is correct there: an alias
  // remaps ONE category to ONE category type, and a reassign replaces ONE
  // pick, never several unrelated ones at once.
  //
  // Un-grouped (0 or 1 entries) falls back to the flat string too, on either
  // side independently -- that string is already an unambiguous single path
  // in that case, so there is nothing to separate and no reason to change how
  // it looks.
  function PreviewPanel({ pv, http, busy, onSave, onCancel, refusal, saveLabel, fromGroups, toGroups, onReview }) {
    const P = useP();
    // 'idle' -> 'reviewed' -> 'stale'. See the block comment above for why a
    // click replaced typing without weakening the guarantee it enforces.
    const [phase, setPhase] = React.useState('idle');
    const [reviewedCount, setReviewedCount] = React.useState(null);
    const [liveCount, setLiveCount] = React.useState(null);
    const [checking, setChecking] = React.useState(false);
    const [unk, setUnk] = React.useState(false);
    const mono = { fontFamily: P.fontMono, fontSize: P.type.meta };
    React.useEffect(function () {
      setPhase('idle'); setReviewedCount(null); setLiveCount(null); setChecking(false); setUnk(false);
    }, [pv && pv.op, pv && pv.subject, pv && String(pv.to_ids), pv && pv.products_affected]);

    if (http && !http.ok && !(http.body && http.body.code)) {
      return (
        <div data-hw-preview-error="1" style={{ padding: '10px 12px', background: P.badSoft,
          border: '1px solid ' + P.bad, borderRadius: P.r10, fontSize: P.type.meta, color: P.ink }}>
          The preview could not be read (HTTP {http.code || 'no response'}{http.netError ? ' — ' + http.netError : ''}).
          <strong> Nothing is saved and nothing is known.</strong> This is not “no change” — it is no answer.
        </div>);
    }
    if (!pv) { return <div style={{ fontSize: P.type.meta, color: P.inkMute }}>Reading what this would change…</div>; }

    const known = pv.products_known !== false;
    const refuse = pv.would_refuse;

    /** "Review": ask the live question fresh and lock the answer in. */
    function doReview() {
      setChecking(true);
      Promise.resolve(onReview ? onReview() : pv).then(function (fresh) {
        setChecking(false);
        const f = fresh || pv;
        setReviewedCount(f.products_affected);
        setPhase('reviewed');
      });
    }

    /** "Confirm": ask ONE more time before calling onSave at all. If the
     *  catalog moved since Review, this is where it shows — as a stale state
     *  that asks for one more click, never as a silent save of a number that
     *  stopped being true. The server's own recompute-at-write-time 409
     *  (confirm_mismatch, handled below via `refusal`) is still the backstop
     *  underneath this for the one race this check cannot close: the catalog
     *  moving again in the gap between this check succeeding and the POST
     *  actually landing. */
    function doConfirm() {
      setChecking(true);
      Promise.resolve(onReview ? onReview() : pv).then(function (fresh) {
        setChecking(false);
        const f = fresh || pv;
        const stillKnown = f.products_known !== false;
        if (stillKnown === known && f.products_affected === reviewedCount) {
          onSave(known ? reviewedCount : null);
        } else {
          setLiveCount(f.products_affected);
          setPhase('stale');
        }
      });
    }

    return (
      <div data-hw-preview={pv.op}>
        <div style={{ padding: '11px 13px', background: P.surface2,
          border: '1px solid ' + P.hairline2, borderRadius: P.r10 }}>
          <Eyebrow>What this would change, before it changes</Eyebrow>
          <div data-hw-preview-sentence="1"
            style={{ fontSize: P.type.body, color: P.ink, lineHeight: 1.55, marginTop: 6 }}>
            {pv.sentence}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: (fromGroups && fromGroups.length > 1)
              || (toGroups && toGroups.length > 1) ? 'flex-start' : 'center', flexWrap: 'wrap', marginTop: 9 }}>
            {fromGroups && fromGroups.length > 1
              ? <WmPickList groups={fromGroups} />
              : <code style={mono}>{pv.from_path || 'no category_ids'}</code>}
            <Icon name="arrow-right" size={13} stroke={2} color={P.inkMute}
              style={{ marginTop: (fromGroups && fromGroups.length > 1) ? 3 : 0 }} />
            {toGroups && toGroups.length > 1
              ? <WmPickList groups={toGroups} />
              : <code style={mono}>{pv.to_path || 'no category_ids'}</code>}
          </div>
        </div>

        {refuse &&
          <div data-hw-refusal={refuse.code}
            style={{ marginTop: 10, padding: '10px 12px', background: P.warnSoft,
              border: '1px solid ' + P.warn, borderRadius: P.r10 }}>
            <Pill kind="warn" size="sm" icon="ban">{refuse.code}</Pill>
            <div style={{ fontSize: P.type.meta, color: P.ink, marginTop: 6, lineHeight: 1.5 }}>{refuse.error}</div>
            <div style={{ fontSize: P.type.micro, color: P.inkDim, marginTop: 5 }}>
              This is a refusal, not a failure — the save is not offered because the server would decline it.
            </div>
          </div>}

        {!refuse && known &&
          <div style={{ marginTop: 10 }}>
            {phase === 'idle' &&
              <div>
                <PBtn icon="search" data-hw-review="1" disabled={busy || checking}
                  onClick={doReview}>
                  {checking ? 'Reviewing…' : 'Review change'}
                </PBtn>
                <div style={{ fontSize: P.type.micro, color: P.inkMute, marginTop: 8, lineHeight: 1.45 }}>
                  Nothing is written until you review the live count and confirm — the catalog moves while a
                  screen is open, so a stale review must not be able to confirm itself.
                </div>
              </div>}
            {phase === 'reviewed' &&
              <div>
                <div data-hw-review-strip="1" style={{ padding: '10px 12px', background: P.surface3,
                  border: '1px solid ' + P.hairline2, borderRadius: P.r10 }}>
                  <span style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5 }}>
                    <strong data-hw-reviewed-count="1" style={{ color: P.ink }}>{num(reviewedCount)}</strong>{' '}
                    product row{reviewedCount === 1 ? '' : 's'} reviewed just now.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                  <PBtn variant="accent" icon="check" data-hw-confirm="1" disabled={busy || checking}
                    onClick={doConfirm}>
                    {busy ? 'Saving…' : (checking ? 'Checking…' : (saveLabel || 'Confirm'))}
                  </PBtn>
                  <PBtn icon="x" onClick={onCancel}>Cancel</PBtn>
                </div>
              </div>}
            {phase === 'stale' &&
              <div data-hw-review-stale="1" style={{ padding: '10px 12px', background: P.warnSoft,
                border: '1px solid ' + P.warn, borderRadius: P.r10 }}>
                <div style={{ fontSize: P.type.meta, color: P.ink, lineHeight: 1.5 }}>
                  Count changed to <strong data-hw-live-count="1">{num(liveCount)}</strong> since you reviewed
                  {' '}— <strong>{num(reviewedCount)}</strong> is no longer current. Review again before confirming.
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <PBtn variant="accent" icon="check" disabled>{saveLabel || 'Confirm'}</PBtn>
                  <PBtn icon="refresh" data-hw-review-again="1" onClick={doReview}>Review again</PBtn>
                </div>
              </div>}
          </div>}

        {!refuse && !known &&
          <div data-hw-confirm-unknown="1" style={{ marginTop: 10, padding: '10px 12px',
            background: P.warnSoft, border: '1px solid ' + P.warn, borderRadius: P.r10 }}>
            <div style={{ fontSize: P.type.meta, color: P.ink, lineHeight: 1.5 }}>
              <strong>The catalog could not be read, so how many products this affects is UNKNOWN.</strong>{' '}
              That is not zero and not “nothing is affected”. There is no number to type here, and no way to
              type one: you can only confirm the unknown you were actually shown.
              {pv.catalog_error ? <span> ({pv.catalog_error})</span> : null}
            </div>
            <label style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={unk} data-hw-echo-unknown="1"
                onChange={function (e) { setUnk(!!e.target.checked); }} />
              <span style={{ fontSize: P.type.meta, color: P.ink }}>
                I am saving without knowing how many products this affects.
              </span>
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <PBtn variant="accent" icon="check" disabled={!unk || busy}
                onClick={function () { onSave(null); }}>
                {busy ? 'Saving…' : (saveLabel || 'Save')}
              </PBtn>
              <PBtn icon="x" onClick={onCancel}>Cancel</PBtn>
            </div>
          </div>}

        {refusal &&
          <div data-hw-server-refusal={refusal.code || 'error'}
            style={{ marginTop: 10, padding: '10px 12px',
              background: refusal.code ? P.warnSoft : P.badSoft,
              border: '1px solid ' + (refusal.code ? P.warn : P.bad), borderRadius: P.r10 }}>
            <Pill kind={refusal.code ? 'warn' : 'bad'} size="sm" icon="ban">
              {refusal.code ? ('refused · ' + refusal.code) : ('HTTP ' + (refusal.http || '?'))}
            </Pill>
            <div style={{ fontSize: P.type.meta, color: P.ink, marginTop: 6, lineHeight: 1.5 }}>{refusal.error}</div>
            {refusal.code === 'confirm_mismatch' &&
              <div style={{ fontSize: P.type.micro, color: P.inkDim, marginTop: 5 }}>
                The catalog changed while this screen was open. Nothing was written.
              </div>}
          </div>}
      </div>);
  }

  /** Turn a POST result into either null (saved) or a refusal the panel shows.
   *  409 IS NOT AN ERROR HERE. It is the server declining for a stated reason,
   *  and it carries a machine code plus a sentence written for a person. A 500
   *  and a dropped connection are different animals and keep their own shape. */
  function refusalOf(r) {
    if (!r || r.ok) { return null; }
    const b = r.body || {};
    if (r.code === 409 && b.code) { return { code: b.code, error: b.error, extra: b }; }
    return { code: null, http: r.code || 0,
      error: b.error || r.netError || r.raw || ('HTTP ' + (r.code || 0) + ' with no body') };
  }

  // ── binding editor: one category, one node, one confirmed save ────────────
  /** "Name [id] > Name [id]", the same flat shape the server's own from_path/
   *  to_path use — built client-side ONLY for the reassign swap line, where the
   *  server has no op that answers "what is the path of this ONE pick" (its
   *  from_path/to_path are a union across every current binding, which is the
   *  right answer for bind/unbind and the wrong one for "just this one"). */
  function chainText(nodes) {
    if (!nodes || !nodes.length) { return null; }
    return nodes.map(function (n) { return (n && n.name ? n.name : '?') + ' [' + (n ? n.id : '?') + ']'; }).join(' > ');
  }

  function BindingEditor({ row, tree, collisions, onSaved, onClose, initialNode }) {
    const P = useP();
    // `bindings` -- one entry per EXPLICIT pick, oldest first. Multiple picks
    // are the whole point of 2026-08-28's change: picking a category type here
    // ADDS to this list, it does not replace whatever was already in it.
    const bindings = row.bindings || [];
    const [node, setNode] = React.useState(initialNode != null ? initialNode : null); // the one being ADDED
    // 'bind' | 'unbind' | 'unbind_all' | 'reassign'. Starts on 'bind' even when
    // picks already exist -- adding another is the common case a re-open is for.
    const [mode, setMode] = React.useState('bind');
    const [unbindNode, setUnbindNode] = React.useState(null); // which pick 'unbind' targets
    const [reassignFrom, setReassignFrom] = React.useState(null); // which pick 'reassign' replaces
    const [http, setHttp] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const [refusal, setRefusal] = React.useState(null);

    // A NEW ROW, OR A FRESH PRESET FROM THE QUEUE, RESETS THE PICKER. Keyed on
    // the category STRING (not the row object, which gets a new identity on
    // every reload/save while staying the SAME category) so that a save which
    // deliberately keeps this editor open on the same category — see save()
    // below — does not get its in-progress node/mode clobbered out from under
    // it. `initialNode` lets the "Confirm" queue item (CategoryMapScreen) jump
    // straight to previewing the category type it already resolves to, rather
    // than making the operator re-pick something the screen already knows.
    React.useEffect(function () {
      setNode(initialNode != null ? initialNode : null);
      setMode('bind'); setUnbindNode(null); setReassignFrom(null);
      setHttp(null); setRefusal(null);
    }, [row.category, initialNode]);

    // ONE PLACE THAT KNOWS THE PREVIEW URL, used both by the mount/change
    // effect below AND by the Review/Confirm live re-check in PreviewPanel —
    // so those two can never drift into asking two different questions.
    // 'reassign' previews as the ADD half only (binding `node`): the route has
    // no op for "replace one pick with another" (see saveReassign for why),
    // so the live count this shows is "how many rows would carry the new
    // category type", which for a straight reassign is the same set of rows
    // currently carrying the old one.
    function previewPath() {
      if (mode === 'unbind_all') { return ROUTE + '/preview?' + qs({ op: 'unbind_all', category: row.category }); }
      if (mode === 'unbind') {
        return unbindNode == null ? null
          : ROUTE + '/preview?' + qs({ op: 'unbind', category: row.category, node: unbindNode });
      }
      return node == null ? null
        : ROUTE + '/preview?' + qs({ op: 'bind', category: row.category, node: node });
    }

    React.useEffect(function () {
      let live = true;
      setHttp(null); setRefusal(null);
      const path = previewPath();
      if (!path) { return function () { live = false; }; }
      getJSON(path).then(function (r) { if (live) { setHttp(r); } });
      return function () { live = false; };
    }, [row.category, node, mode, unbindNode]);

    /** Re-asks the SAME question, live, right now. This is what "Review" and
     *  "Confirm" call in PreviewPanel — never the number that happened to load
     *  when the picker last changed. */
    function fetchLivePreview() {
      const path = previewPath();
      if (!path) { return Promise.resolve(null); }
      return getJSON(path).then(function (r) {
        return (r && r.parsed && r.body && r.body.op) ? r.body : null;
      });
    }

    // A 409 on the PREVIEW is still a preview: the body is the refusal, and the
    // panel renders it as the reason a save is not offered.
    const pv = (http && http.parsed && http.body && http.body.op) ? http.body
      : (http && http.parsed && http.body && http.body.code)
        ? { op: mode, subject: row.category, products_affected: null, products_known: true,
            from_ids: row.wm_ids || [], to_ids: [], from_path: row.wm_path, to_path: null,
            sentence: 'This cannot be previewed.', would_refuse: { code: http.body.code, error: http.body.error } }
        : null;

    // ── grouped from/to for the preview caption, mirroring WmCell ──────────
    // The server's from_path/to_path are one arrow-joined STRING built from a
    // flat union of ids (wmdemo/category_edit.py `_path_of`), which is right
    // for one pick and wrong once a category holds several independent ones —
    // exactly the WmCell bug fixed on 2026-08-28, left as a known gap here.
    // `row.bindings` already gives every CURRENT pick its own resolved path
    // (`b.path`), the same shape WmPathChain/WmPickList expect; the only new
    // category type not already in that list is the one being added or
    // removed here, whose own [parent, child] chain we resolve from `tree`
    // (the same rule wmdemo/category_edit.py `_ids_for_node` applies
    // server-side). NOT used for 'reassign' — see the swap line below instead.
    const fromGroups = mode !== 'reassign' && bindings.length
      ? bindings.map(function (b) { return { nodes: b.path, broken: b.broken, nodeId: b.node_id }; })
      : null;
    const toGroups = (function () {
      if (mode === 'unbind_all') { return null; }
      if (mode === 'unbind') {
        if (unbindNode == null) { return null; }
        const remaining = bindings.filter(function (b) { return b.node_id !== unbindNode; });
        return remaining.map(function (b) { return { nodes: b.path, broken: b.broken, nodeId: b.node_id }; });
      }
      if (mode === 'bind') {
        if (node == null) { return null; }
        const byId = {};
        (tree || []).forEach(function (n) { byId[n.id] = n; });
        const picked = byId[node] || null;
        const parent = picked && picked.parent_id != null ? byId[picked.parent_id] : null;
        const ownChain = picked ? (parent ? [parent, picked] : [picked]) : null;
        const kept = bindings.filter(function (b) { return !b.broken; })
          .map(function (b) { return { nodes: b.path, broken: false, nodeId: b.node_id }; });
        return kept.concat([{ nodes: ownChain, broken: !ownChain, nodeId: node }]);
      }
      return null;
    })();

    // ── reassign: the ONE swap this preview describes, and nothing else ────
    // Built independently of fromGroups/toGroups on purpose: those show the
    // WHOLE set of current + prospective picks, which is correct for "add
    // another" but wrong for "replace this one" — a reassign of one pick on a
    // category with three others must not read as "now bound to all four".
    function ownChainFor(nodeId) {
      if (nodeId == null) { return null; }
      const byId = {};
      (tree || []).forEach(function (n) { byId[n.id] = n; });
      const picked = byId[nodeId] || null;
      if (!picked) { return null; }
      const parent = picked.parent_id != null ? byId[picked.parent_id] : null;
      return parent ? [parent, picked] : [picked];
    }
    const reassignOldBinding = mode === 'reassign' && reassignFrom != null
      ? bindings.filter(function (b) { return b.node_id === reassignFrom; })[0] || null
      : null;
    const reassignPv = (mode === 'reassign' && pv)
      ? Object.assign({}, pv, {
          sentence: 'Moves ' + row.category + ' from one Weedmaps category type to another. Removing the ' +
            'old pick and adding the new one happen together — never a moment where ' + row.category + ' holds neither.',
          from_path: chainText(reassignOldBinding && reassignOldBinding.path) || (row.wm_path || null),
          to_path: chainText(ownChainFor(node))
        })
      : pv;

    function save(confirm) {
      setBusy(true); setRefusal(null);
      const path = ROUTE + (mode === 'unbind_all' ? '/unbind-all'
        : mode === 'unbind' ? '/unbind' : '/bind');
      const payload = mode === 'unbind_all'
        ? { category: row.category, confirm_products: confirm }
        : mode === 'unbind'
          ? { category: row.category, node: unbindNode, confirm_products: confirm }
          : { category: row.category, node: node, confirm_products: confirm };
      post(path, payload).then(function (r) {
        setBusy(false);
        const ref = refusalOf(r);
        if (ref) { setRefusal(ref); return; }
        // STAY OPEN, RESET TO 'bind'. Closing after every save (the pre-multi-
        // bind behaviour) made adding a SECOND category type a two-click round
        // trip through "Bindings (N)" again; staying open with a cleared
        // picker is what makes "bind Flower to two category types" read as one
        // continuous task rather than two unrelated edits.
        setNode(null); setUnbindNode(null); setMode('bind');
        onSaved(r.body && r.body.map, row.category);
      });
    }

    // ── reassign: add the new pick, THEN remove the old one ────────────────
    //
    // ADAPTED FROM THE APPROVED MOCKUP ON PURPOSE, AND FLAGGED HERE BECAUSE OF
    // IT. The design calls for "remove old + add new happen together, never a
    // moment with neither" as ONE ATOMIC ACTION. This screen's backend
    // (wmdemo/category_map.py, category_edit.py — not part of this file and
    // not touched by this change) has no single route that does both in one
    // database transaction; it has `/bind` and `/unbind`, each its own write,
    // each its own confirm-count gate. A true single-transaction reassign
    // would need a new server endpoint, which is out of scope here.
    //
    // The closest faithful equivalent reachable from this file alone: ADD
    // first, REMOVE second, in that order and never the reverse. That
    // guarantees the one invariant the design actually cares about by name —
    // `row.category` is bound to at least one working category type at every
    // instant between the two writes, because for however long the second
    // request takes, it is bound to BOTH. What this does NOT give you is a
    // single write nothing can observe half-done; if the ADD succeeds and the
    // REMOVE is refused (a stale count, a dropped connection), the category is
    // left bound to both the old and the new category type — surfaced below,
    // never swallowed, because a silent partial reassign is exactly the kind
    // of state this screen exists to make visible. Both writes are gated on
    // the SAME reviewed count, since the design's own "Review" step already
    // captures the number of rows that move as a single fact from one screen.
    function saveReassign(confirm) {
      setBusy(true); setRefusal(null);
      post(ROUTE + '/bind', { category: row.category, node: node, confirm_products: confirm })
        .then(function (addResult) {
          const addRef = refusalOf(addResult);
          if (addRef) { setBusy(false); setRefusal(addRef); return; }
          return post(ROUTE + '/unbind', { category: row.category, node: reassignFrom, confirm_products: confirm })
            .then(function (removeResult) {
              setBusy(false);
              const removeRef = refusalOf(removeResult);
              if (removeRef) {
                setRefusal(Object.assign({}, removeRef, {
                  error: 'The new category type was added, but removing the old one was refused: ' +
                    removeRef.error + ' Both are currently bound to ' + row.category +
                    ' — remove the old one below when you are ready.'
                }));
                // Show the server's fresh map from the half that DID land, so
                // the screen reflects reality (both bound) rather than the
                // stale pre-write picture.
                if (addResult.body && addResult.body.map) { onSaved(addResult.body.map, row.category); }
                return;
              }
              setNode(null); setUnbindNode(null); setReassignFrom(null); setMode('bind');
              onSaved(removeResult.body && removeResult.body.map, row.category);
            });
        });
    }

    const s = st(row);
    // NO LONGER SCROLLED INTO VIEW, ON PURPOSE. Before 2026-08-28's split-view
    // rework, this editor rendered inline in a 4,886px table -- it could open
    // entirely below the fold (measured on the live build: trigger at y=1546 in
    // an 800px viewport), and scrollIntoView({block:'nearest'}) was the fix for
    // that. It worked exactly as written and was still wrong: this editor now
    // renders in the sticky right-hand panel (CategoryMapScreen, below), which
    // is always in view by construction -- there is no fold to be below and
    // nothing to scroll to. A scrollIntoView here would now fight the one
    // scroll position that matters, the operator's place in the table on the
    // left. See CategoryMapScreen for the panel that replaced the jump.
    const reassigning = mode === 'reassign';
    return (
      <Card density="roomy" data-hw-editor="binding"
        style={{ border: '1px solid ' + P.accentBorder }}>
        <SectionHead level={3} eyebrow={reassigning ? 'Reassigning ' + row.category : 'Weedmaps bindings'}
          title={reassigning ? row.category + '’s Weedmaps category type'
            : row.category + '’s Weedmaps category type' + (bindings.length === 1 ? '' : 's')}
          subtitle={reassigning
            ? (reassignOldBinding
                ? 'Moving off ' + (chainText(reassignOldBinding.path) || 'category type ' + reassignFrom) +
                  '. Pick the category type it should point to instead — this replaces that one pick, it does not add a second.'
                : 'Pick the category type this should point to instead.')
            : 'Currently: ' + (bindings.length
              ? bindings.length + ' explicit pick' + (bindings.length === 1 ? '' : 's') +
                ' — a category can bind more than one category type, and every one of them publishes'
              : row.binding_source === 'name_match'
                ? 'matched by name to ' + row.wm_path + ' — nobody picked this, the word simply hit a category type of the same name'
                : 'not bound to anything. Weedmaps has no category type named “' + row.category + '”, and that is an allowed resting state.')}
          action={<PBtn icon="x" onClick={reassigning ? function () { setMode('bind'); setReassignFrom(null); setNode(null); } : onClose}>
            {reassigning ? 'Cancel' : 'Close'}
          </PBtn>} />

        {!reassigning && row.binding_source === 'none' &&
          <div data-hw-resting="1" style={{ padding: '10px 12px', marginBottom: 12,
            background: P.infoSoft, border: '1px solid ' + P.hairline2, borderRadius: P.r10,
            fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5 }}>
            <strong>You do not have to bind this.</strong> Leaving it unbound is a legitimate resting state —
            products under it publish with no <code style={{ fontFamily: P.fontMono }}>category_ids</code> and
            Weedmaps accepts them. There is no decision to record and nothing is waiting on you.
          </div>}

        {/* EVERY CURRENT PICK, EACH WITH ITS OWN REASSIGN AND REMOVE CONTROLS.
            This is the list a second (or third) bind ADDS to, and the thing
            that makes "pick a category type" additive rather than destructive
            legible on screen. Hidden while reassigning ONE of them, so the
            operator's attention is on the swap and not on the other picks. */}
        {!reassigning && bindings.length > 0 &&
          <div data-hw-bindings-list="1" style={{ marginBottom: 12, display: 'flex',
            flexDirection: 'column', gap: 6 }}>
            {bindings.map(function (b) {
              const targeted = mode === 'unbind' && unbindNode === b.node_id;
              return (
                <div key={b.node_id} data-hw-binding-row={b.node_id}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 10, padding: '8px 10px', flexWrap: 'wrap',
                    background: targeted ? P.warnSoft : P.surface2,
                    border: '1px solid ' + (targeted ? P.warn : P.hairline2), borderRadius: P.r8 }}>
                  <div style={{ minWidth: 0 }}>
                    <WmPathChain nodes={b.path} broken={b.broken} nodeId={b.node_id} />
                    <div style={{ fontSize: P.type.micro, color: P.inkMute, marginTop: 2 }}>
                      picked by {b.actor || 'someone'}{b.at_iso ? ' on ' + b.at_iso : ''}
                      {b.broken ? ' — not in the tree any more' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <PBtn size="xs" icon="swap" data-hw-reassign-node={b.node_id}
                      onClick={function () { setMode('reassign'); setReassignFrom(b.node_id); setNode(null); }}>
                      Reassign
                    </PBtn>
                    <PBtn size="xs" icon="x" data-hw-remove-node={b.node_id}
                      onClick={function () { setMode('unbind'); setUnbindNode(b.node_id); }}>
                      Remove
                    </PBtn>
                  </div>
                </div>);
            })}
          </div>}

        {!reassigning &&
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <PBtn active={mode === 'bind'} data-hw-add-node="1"
              onClick={function () { setMode('bind'); }} icon="grid">
              {bindings.length ? 'Add another category type' : 'Pick a category type'}
            </PBtn>
            {bindings.length > 1 &&
              <PBtn active={mode === 'unbind_all'} data-hw-unbind-all="1"
                onClick={function () { setMode('unbind_all'); }} icon="x">
                Clear all {bindings.length} bindings
              </PBtn>}
          </div>}

        {(mode === 'bind' || reassigning) &&
          <div style={{ marginBottom: 12 }}>
            <NodePicker tree={tree} value={node} onPick={setNode} collisions={collisions} />
          </div>}

        {(mode === 'unbind_all' || (mode === 'unbind' && unbindNode != null)
          || (mode === 'bind' && node != null) || (reassigning && node != null)) &&
          <PreviewPanel pv={reassigning ? reassignPv : pv} http={http} busy={busy} refusal={refusal}
            fromGroups={reassigning ? null : fromGroups} toGroups={reassigning ? null : toGroups}
            onReview={fetchLivePreview}
            saveLabel={mode === 'unbind_all' ? 'Remove all bindings'
              : mode === 'unbind' ? 'Remove this binding'
              : reassigning ? 'Confirm move' : 'Add this category type'}
            onSave={reassigning ? saveReassign : save} onCancel={reassigning ? function () { setMode('bind'); setReassignFrom(null); setNode(null); } : onClose} />}

        {mode === 'bind' && node == null &&
          <div style={{ fontSize: P.type.meta, color: P.inkMute }}>
            Choose a category type above and this will show exactly what saving it would change.
          </div>}
      </Card>);
  }

  // ── bulk binding editor: several of OUR categories, one Weedmaps pick ─────
  //
  // THE OWNER'S ASK: binding one category to one Weedmaps category type at a
  // time — pick a row, "Bindings", pick a node, Review, Confirm — is correct
  // and stays exactly as it is above. It is also too slow to do nine times in
  // a row when several categories all belong on the same category type. This
  // is the ADDITIVE path: pick several rows' checkboxes in the table, pick
  // ONE category type here, and this component calls the SAME
  // `POST /bind` BindingEditor calls above, once per selected category — a
  // real loop over the real write, never a new write path. There is no bulk
  // route on the server (category_edit.py has `bind_category` for ONE
  // category, nothing else) and this file cannot add one, so N categories is
  // N real requests, same as BulkWmPublish on pos/screen-catalog.jsx accepts
  // for its own bulk action and for the same reason: a fabricated single
  // request standing in for nine real ones could not carry nine different
  // refusals if the catalog only let some of them through.
  //
  // THE SAFETY NET DOES NOT SHRINK FOR DOING SEVERAL AT ONCE. Every category
  // gets its OWN live preview (the same `GET /preview?op=bind` BindingEditor's
  // own effect calls) and its own `confirm_products`, recomputed fresh a
  // second time right before anything is written — the identical Review ->
  // Confirm shape PreviewPanel enforces for a single bind, just carrying a
  // list instead of one row. A category whose count moved between Review and
  // Confirm makes the WHOLE batch go stale rather than silently saving the
  // (n-1) categories that did not move and skipping the one that did —
  // "some of nine saved, quietly, because one was stale" is a worse failure
  // than asking for one more click.
  //
  // A category the preview REFUSES (already bound to this exact node —
  // `no_change` — or anything else `preview_bind` can say) is EXCLUDED before
  // Review ever fires, shown with its own reason, and never blocks the rest
  // of the batch — the same "surfaced, never swallowed" rule BindingEditor's
  // own reassign already keeps for a partial failure.
  function BulkBindEditor({ categories, tree, collisions, onClose, onSaved }) {
    const P = useP();
    const [node, setNode] = React.useState(null);
    const [previews, setPreviews] = React.useState(null); // null = not fetched yet for this node
    const [phase, setPhase] = React.useState('idle'); // idle -> reviewed -> stale -> saving -> done
    const [reviewed, setReviewed] = React.useState(null); // { category: count|null }
    const [staleCats, setStaleCats] = React.useState([]);
    const [checking, setChecking] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [unk, setUnk] = React.useState(false);
    const [results, setResults] = React.useState(null); // { category: { ok, refusal, map } }
    const mono = { fontFamily: P.fontMono, fontSize: P.type.meta };

    function previewPathFor(cat) {
      return ROUTE + '/preview?' + qs({ op: 'bind', category: cat, node: node });
    }

    function fetchAll() {
      return Promise.all(categories.map(function (cat) {
        return getJSON(previewPathFor(cat)).then(function (r) { return { category: cat, http: r }; });
      }));
    }

    // A NEW NODE PICK RESETS EVERYTHING BELOW IT — the same rule BindingEditor
    // applies to its own picker, and for the same reason: a stale preview for
    // the PREVIOUS pick must never be readable as a live answer for this one.
    React.useEffect(function () {
      let live = true;
      setPreviews(null); setPhase('idle'); setReviewed(null); setStaleCats([]);
      setResults(null); setUnk(false);
      if (node == null) { return function () { live = false; }; }
      fetchAll().then(function (list) { if (live) { setPreviews(list); } });
      return function () { live = false; };
    }, [node, categories.join('|')]);

    function pvOf(entry) {
      const http = entry.http;
      if (http && http.parsed && http.body && http.body.op) { return http.body; }
      if (http && http.parsed && http.body && http.body.code) {
        return { op: 'bind', subject: entry.category, products_affected: null, products_known: true,
          would_refuse: { code: http.body.code, error: http.body.error } };
      }
      return null;
    }

    const entries = (previews || []).map(function (e) { return Object.assign({}, e, { pv: pvOf(e) }); });
    const usable = entries.filter(function (e) { return e.pv && !e.pv.would_refuse; });
    const refused = entries.filter(function (e) { return e.pv && e.pv.would_refuse; });
    const anyUnknown = usable.some(function (e) { return e.pv.products_known === false; });

    function byId(list) { const m = {}; (list || []).forEach(function (n) { m[n.id] = n; }); return m; }
    function ownChainFor(nodeId) {
      if (nodeId == null) { return null; }
      const ids = byId(tree);
      const picked = ids[nodeId] || null;
      if (!picked) { return null; }
      const parent = picked.parent_id != null ? ids[picked.parent_id] : null;
      return parent ? [parent, picked] : [picked];
    }

    /** "Review": lock in a live count (or would_refuse) for every usable
     *  category. Mirrors PreviewPanel's doReview, done once per category. */
    function doReview() {
      setChecking(true);
      fetchAll().then(function (fresh) {
        setChecking(false);
        setPreviews(fresh);
        const map = {};
        fresh.forEach(function (e) {
          const pv = pvOf(e);
          if (pv && !pv.would_refuse) { map[e.category] = pv.products_affected; }
        });
        setReviewed(map);
        setStaleCats([]);
        setPhase('reviewed');
      });
    }

    /** "Confirm": re-ask every category ONE more time, live, before writing
     *  anything — PreviewPanel's own doConfirm guarantee, carried over a list
     *  instead of one row. Any category whose answer moved since Review sends
     *  the WHOLE batch stale; nothing is written until it is reviewed again. */
    function doConfirm() {
      setChecking(true);
      fetchAll().then(function (fresh) {
        setChecking(false);
        const changed = [];
        fresh.forEach(function (e) {
          if (!reviewed || !Object.prototype.hasOwnProperty.call(reviewed, e.category)) { return; }
          const pv = pvOf(e);
          const now = pv && !pv.would_refuse ? pv.products_affected : '__refused__';
          if (String(now) !== String(reviewed[e.category])) { changed.push(e.category); }
        });
        if (changed.length) {
          setPreviews(fresh);
          setStaleCats(changed);
          setPhase('stale');
          return;
        }
        doSave();
      });
    }

    /** The actual writes — the SAME `/bind` BindingEditor's own save() calls,
     *  once per category, one after another. Sequential, not parallel: easier
     *  to reason about against a single sqlite-backed demo server, and it
     *  means a screen reload mid-batch (onSaved below) always reflects a
     *  batch that is either fully done or in a state every response so far
     *  already told the operator about — never a half-applied Promise.all
     *  none of them could see. A refusal on one category does NOT stop the
     *  rest — see the file header comment: partial failure surfaced, not
     *  swallowed, and not allowed to strand the categories that would have
     *  gone through fine. */
    function doSave() {
      setBusy(true); setPhase('saving');
      const targets = Object.keys(reviewed || {});
      const out = {};
      let chain = Promise.resolve();
      targets.forEach(function (cat) {
        chain = chain.then(function () {
          return post(ROUTE + '/bind', { category: cat, node: node, confirm_products: reviewed[cat] })
            .then(function (r) {
              const ref = refusalOf(r);
              out[cat] = { ok: !ref, refusal: ref, map: r && r.body && r.body.map };
            });
        });
      });
      chain.then(function () {
        setBusy(false); setResults(out); setPhase('done');
        // THE SERVER'S OWN LAST ANSWER, not a locally-guessed merge of nine
        // recomputes — same rule the single-bind path follows (onSaved always
        // takes the map the write response carried, never one this file built).
        let lastMap = null;
        for (let i = targets.length - 1; i >= 0; i--) {
          if (out[targets[i]] && out[targets[i]].map) { lastMap = out[targets[i]].map; break; }
        }
        onSaved(lastMap);
      });
    }

    const pickedChain = ownChainFor(node);

    return (
      <Card density="roomy" data-hw-editor="bulk-bind" style={{ border: '1px solid ' + P.accentBorder }}>
        <SectionHead level={3} eyebrow={categories.length + ' categories selected'}
          title="Bind all of them to one Weedmaps category type"
          subtitle="Each one gets its own real bind and its own live review — this is the same write as picking one category at a time, just done back to back instead of nine separate trips through “Bindings”."
          action={<PBtn icon="x" onClick={onClose}>Close</PBtn>} />

        <div data-hw-bulk-editor-list="1" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {categories.map(function (cat) {
            return (
              <span key={cat} style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.ink2,
                padding: '3px 8px', background: P.surface2, border: '1px solid ' + P.hairline2, borderRadius: P.r8 }}>
                {cat}
              </span>);
          })}
        </div>

        <NodePicker tree={tree} value={node} onPick={function (id) { setNode(id); }} collisions={collisions} />

        {node != null && !previews &&
          <div style={{ marginTop: 12, fontSize: P.type.meta, color: P.inkMute }}>
            Reading what this would change for each of the {categories.length} categories…
          </div>}

        {node != null && previews &&
          <div style={{ marginTop: 14 }}>
            {refused.length > 0 &&
              <div data-hw-bulk-skipped="1" style={{ padding: '10px 12px', marginBottom: 10,
                background: P.warnSoft, border: '1px solid ' + P.warn, borderRadius: P.r10 }}>
                <div style={{ fontSize: P.type.meta, fontWeight: 700, color: P.ink }}>
                  {refused.length} of {categories.length} won&rsquo;t be included
                </div>
                {refused.map(function (e) {
                  return (
                    <div key={e.category} data-hw-bulk-skip-reason={e.category}
                      style={{ fontSize: P.type.micro, color: P.ink2, marginTop: 4, lineHeight: 1.4 }}>
                      <code style={mono}>{e.category}</code>: {e.pv.would_refuse.error}
                    </div>);
                })}
              </div>}

            {usable.length === 0 &&
              <div style={{ fontSize: P.type.meta, color: P.inkMute }}>
                None of the selected categories can be bound to this category type right now.
              </div>}

            {usable.length > 0 && phase === 'idle' &&
              <div>
                <div style={{ fontSize: P.type.meta, color: P.ink2, marginBottom: 8, lineHeight: 1.5 }}>
                  Will bind <strong data-hw-bulk-usable-count="1">{usable.length}</strong> categor{usable.length === 1 ? 'y' : 'ies'} to
                  {' '}{pickedChain ? <WmPathChain nodes={pickedChain} broken={false} nodeId={node} /> : <code style={mono}>category type {node}</code>}.
                </div>
                <PBtn icon="search" data-hw-bulk-review="1" disabled={checking} onClick={doReview}>
                  {checking ? 'Reviewing…' : 'Review change'}
                </PBtn>
              </div>}

            {usable.length > 0 && phase === 'reviewed' &&
              <div>
                <div data-hw-bulk-review-strip="1" style={{ padding: '10px 12px', background: P.surface3,
                  border: '1px solid ' + P.hairline2, borderRadius: P.r10 }}>
                  {usable.map(function (e) {
                    return (
                      <div key={e.category} style={{ display: 'flex', justifyContent: 'space-between',
                        gap: 8, fontSize: P.type.meta, color: P.ink2, padding: '3px 0' }}>
                        <code style={mono}>{e.category}</code>
                        <span>
                          {reviewed[e.category] == null ? 'unknown' :
                            num(reviewed[e.category]) + ' product row' + (reviewed[e.category] === 1 ? '' : 's')}
                        </span>
                      </div>);
                  })}
                </div>
                {anyUnknown &&
                  <label style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={unk} data-hw-bulk-echo-unknown="1"
                      onChange={function (e) { setUnk(!!e.target.checked); }} />
                    <span style={{ fontSize: P.type.meta, color: P.ink }}>
                      I am saving without knowing how many products some of these affect.
                    </span>
                  </label>}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                  <PBtn variant="accent" icon="check" data-hw-bulk-confirm="1"
                    disabled={busy || checking || (anyUnknown && !unk)} onClick={doConfirm}>
                    {checking ? 'Checking…' : 'Confirm — bind ' + usable.length}
                  </PBtn>
                  <PBtn icon="x" onClick={onClose}>Cancel</PBtn>
                </div>
              </div>}

            {usable.length > 0 && phase === 'stale' &&
              <div data-hw-bulk-stale="1" style={{ padding: '10px 12px', background: P.warnSoft,
                border: '1px solid ' + P.warn, borderRadius: P.r10 }}>
                <div style={{ fontSize: P.type.meta, color: P.ink, lineHeight: 1.5 }}>
                  {staleCats.length} categor{staleCats.length === 1 ? 'y' : 'ies'} changed since you
                  reviewed (<code style={mono}>{staleCats.join(', ')}</code>) — nothing was written.
                  Review again before confirming.
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <PBtn variant="accent" icon="check" disabled>Confirm — bind {usable.length}</PBtn>
                  <PBtn icon="refresh" data-hw-bulk-review-again="1" onClick={doReview}>Review again</PBtn>
                </div>
              </div>}

            {phase === 'saving' &&
              <div style={{ fontSize: P.type.meta, color: P.inkMute }}>Saving…</div>}

            {phase === 'done' && results &&
              <div data-hw-bulk-done="1" style={{ marginTop: 4 }}>
                {Object.keys(results).map(function (cat) {
                  const r = results[cat];
                  return (
                    <div key={cat} data-hw-bulk-result={cat} style={{ padding: '8px 10px', marginBottom: 5,
                      borderRadius: P.r8, background: r.ok ? P.goodSoft : P.badSoft,
                      border: '1px solid ' + (r.ok ? P.hairline2 : P.bad) }}>
                      <code style={mono}>{cat}</code>{' '}
                      {r.ok
                        ? <span style={{ color: P.good, fontWeight: 600 }}>bound</span>
                        : <span style={{ color: P.bad, fontWeight: 600 }}>refused — {r.refusal.error}</span>}
                    </div>);
                })}
                <PBtn icon="check" onClick={onClose} style={{ marginTop: 6 }}>Done</PBtn>
              </div>}
          </div>}
      </Card>);
  }

  // ── alias editor: add a spelling, repoint one, remove one ─────────────────
  //
  // A COLLISION REFUSES AND SAYS WHAT IT HIT. taxonomy._build_alias_index
  // already refuses AT IMPORT when one alias key would resolve to two different
  // canonical names, because a silent winner re-files an entire top-level
  // category. The route enforces the same rule; this panel shows the reason
  // BEFORE the save rather than after, using the preview's `would_refuse`.
  //
  // BUILT-IN ALIASES ARE NOT EDITABLE HERE and are not rendered as if they
  // were. They live in taxonomy.CATEGORY_ALIASES because live rows and live SKU
  // assignments on a persistent disk carry those spellings; changing one is a
  // code change with a migration behind it. An edit control on them would be a
  // control that asks the operator for a decision the system has already made.
  function AliasEditor({ d, onSaved }) {
    const P = useP();
    const ed = (d && d.editor) || {};
    const cats = ed.top_level || [];
    const rows = ed.alias_overrides || [];
    const [alias, setAlias] = React.useState('');
    const [cat, setCat] = React.useState(cats[0] || '');
    const [pending, setPending] = React.useState(null);   // {kind, alias, category, expect}
    const [http, setHttp] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const [refusal, setRefusal] = React.useState(null);
    const mono = { fontFamily: P.fontMono, fontSize: P.type.micro };

    function previewPath() {
      if (!pending) { return null; }
      return ROUTE + '/preview?' + (pending.kind === 'remove'
        ? qs({ op: 'alias_remove', alias: pending.alias })
        : qs({ op: 'alias', alias: pending.alias, category: pending.category }));
    }

    React.useEffect(function () {
      let live = true;
      setHttp(null); setRefusal(null);
      const path = previewPath();
      if (!path) { return function () { live = false; }; }
      getJSON(path).then(function (r) { if (live) { setHttp(r); } });
      return function () { live = false; };
    }, [pending && pending.kind, pending && pending.alias, pending && pending.category]);

    /** Same live re-ask as BindingEditor's — see PreviewPanel's Review/Confirm. */
    function fetchLivePreview() {
      const path = previewPath();
      if (!path) { return Promise.resolve(null); }
      return getJSON(path).then(function (r) {
        return (r && r.parsed && r.body && r.body.op) ? r.body : null;
      });
    }

    const pv = (http && http.parsed && http.body && http.body.op) ? http.body
      : (http && http.parsed && http.body && http.body.code)
        ? { op: 'alias', subject: pending && pending.alias, products_affected: null,
            products_known: true, from_ids: [], to_ids: [], sentence: 'This cannot be previewed.',
            would_refuse: { code: http.body.code, error: http.body.error } }
        : null;

    function save(confirm) {
      if (!pending) { return; }
      setBusy(true); setRefusal(null);
      const path = ROUTE + (pending.kind === 'remove' ? '/alias/delete'
        : pending.kind === 'repoint' ? '/alias/repoint' : '/alias');
      const payload = { alias: pending.alias, confirm_products: confirm };
      if (pending.kind !== 'remove') { payload.category = pending.category; }
      if (pending.kind === 'repoint') { payload.expect_current = pending.expect; }
      post(path, payload).then(function (r) {
        setBusy(false);
        const ref = refusalOf(r);
        if (ref) { setRefusal(ref); return; }
        setPending(null); setAlias('');
        onSaved(r.body && r.body.map);
      });
    }

    if (ed.error) {
      return (
        <Card density="roomy" style={{ marginBottom: 18, border: '1px solid ' + P.bad }}>
          <SectionHead level={3} eyebrow="Spellings"
            title="The alias editor’s own rows could not be read"
            subtitle={ed.error + ' — so this screen cannot tell you whether any operator alias exists. That is not the same as “none exist”.'} />
        </Card>);
    }

    return (
      <Card density="roomy" data-hw-editor="alias" style={{ marginBottom: 18 }}>
        <SectionHead level={3} eyebrow="Spellings we accept"
          title="Teach the system a spelling, without waiting for a developer"
          subtitle="“Vapes” and “Pre-rolls” were both real, both arrived from an import nobody controlled, and both published SKUs to Weedmaps with no category until someone edited code. This is that edit, made from here — and refused, by name, when it would collide." />

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 4 }}>
          <div style={{ flex: '1 1 220px', minWidth: 180 }}>
            <div style={{ fontSize: P.type.micro, color: P.inkDim, marginBottom: 4 }}>The spelling as it arrives</div>
            <input value={alias} data-hw-alias-input="1"
              onChange={function (e) { setAlias(e.target.value); }}
              placeholder="e.g. Pre-rollz"
              style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px',
                fontSize: P.type.body, fontFamily: P.fontMono, color: P.ink,
                background: P.surface, border: '1px solid ' + P.hairline3, borderRadius: P.r8 }} />
          </div>
          <div style={{ flex: '0 1 200px', minWidth: 160 }}>
            <div style={{ fontSize: P.type.micro, color: P.inkDim, marginBottom: 4 }}>folds to our category</div>
            <select value={cat} data-hw-alias-category="1"
              onChange={function (e) { setCat(e.target.value); }}
              style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px',
                fontSize: P.type.body, fontFamily: P.fontSans, color: P.ink,
                background: P.surface, border: '1px solid ' + P.hairline3, borderRadius: P.r8 }}>
              {cats.map(function (c) { return <option key={c} value={c}>{c}</option>; })}
            </select>
          </div>
          <PBtn icon="plus" data-hw-alias-add="1" disabled={!alias.trim()}
            onClick={function () { setPending({ kind: 'add', alias: alias.trim(), category: cat }); }}>
            See what this would do
          </PBtn>
        </div>
        <div style={{ fontSize: P.type.micro, color: P.inkMute, lineHeight: 1.45, marginBottom: 12 }}>
          Case and punctuation are removed before comparison, so “Pre-Roll”, “pre roll” and “PreRoll” are one
          spelling. Adding a tenth top-level category is not possible here — that is a code change, deliberately.
        </div>

        {pending &&
          <div style={{ marginBottom: 14 }}>
            <PreviewPanel pv={pv} http={http} busy={busy} refusal={refusal} onReview={fetchLivePreview}
              saveLabel={pending.kind === 'remove' ? 'Remove the alias'
                : pending.kind === 'repoint' ? 'Repoint it' : 'Add the alias'}
              onSave={save} onCancel={function () { setPending(null); }} />
          </div>}

        <div style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink, marginBottom: 6 }}>
          {rows.length ? rows.length + ' spelling' + (rows.length === 1 ? '' : 's') + ' added here'
            : 'No spelling has been added here yet'}
        </div>
        {rows.length === 0 &&
          <div style={{ fontSize: P.type.meta, color: P.inkDim, lineHeight: 1.5 }}>
            Every spelling this system accepts today comes from
            {' '}<code style={mono}>taxonomy.CATEGORY_ALIASES</code> — the code table, listed per category in
            the table below. Nothing has been added from this screen.
          </div>}
        {rows.map(function (r) {
          return (
            <div key={r.alias_key} data-hw-operator-alias={r.alias_key}
              style={{ padding: '9px 12px', marginBottom: 6,
                background: r.live ? P.surface2 : P.warnSoft,
                border: '1px solid ' + (r.live ? P.hairline2 : P.warn), borderRadius: P.r10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <code style={{ fontFamily: P.fontMono, fontWeight: 700, color: P.ink }}>{r.alias}</code>
                <Icon name="arrow-right" size={12} stroke={2} color={P.inkMute} />
                <strong style={{ fontSize: P.type.body, color: P.ink }}>{r.canonical}</strong>
                <Pill kind="neutral" size="sm">added here</Pill>
                <span style={{ fontSize: P.type.micro, color: P.inkMute }}>
                  by {r.actor}{r.at_iso ? ' · ' + r.at_iso : ''}
                </span>
                <span style={{ flex: 1 }} />
                <select value={r.canonical} data-hw-repoint={r.alias_key}
                  onChange={function (e) {
                    setPending({ kind: 'repoint', alias: r.alias, category: e.target.value, expect: r.canonical });
                  }}
                  style={{ padding: '4px 8px', fontSize: P.type.meta, color: P.ink,
                    background: P.surface, border: '1px solid ' + P.hairline3, borderRadius: P.r8 }}>
                  {cats.map(function (c) { return <option key={c} value={c}>{c}</option>; })}
                </select>
                <PBtn size="xs" icon="x" data-hw-alias-remove={r.alias_key}
                  onClick={function () { setPending({ kind: 'remove', alias: r.alias }); }}>Remove</PBtn>
              </div>
              {/* A ROW THAT HAS STOPPED APPLYING MUST SAY SO. If the code table
                  later grew the same spelling, the code entry wins and this row
                  is dead — and dead is exactly the state that renders as fine. */}
              {!r.live &&
                <div style={{ fontSize: P.type.meta, color: P.warn, marginTop: 6, lineHeight: 1.45, fontWeight: 600 }}>
                  {r.dead_reason === 'shadowed_by_code'
                    ? 'This row no longer does anything: the code table now folds this spelling to ' + r.shadowed_by + ', and the code table wins. Remove it, or change the code.'
                    : 'This row no longer does anything: it points at ' + r.canonical + ', which is not one of our top-level categories any more.'}
                </div>}
            </div>);
        })}
      </Card>);
  }

  // ── which of the three queue buckets a row belongs in ─────────────────────
  //
  // "CONFIRMED" MEANS A PERSON EXPLICITLY PICKED THE BINDING — not that the
  // category happens to resolve. 8 of our 9 canonical names resolve by
  // accidental name match today, which is the whole point of the alias layer;
  // a literal "hide anything that resolves" filter would leave this queue
  // almost always empty and would count a coincidence in spelling as a
  // decision nobody made. `binding_source` already carries exactly this
  // distinction (STATES/WmCell/BindingEditor all key off it the same way):
  // anything starting with 'explicit' is a person's pick, 'name_match' is
  // nobody's, and 'none' is Deals' own case — see below.
  //
  // `Deals` (no Weedmaps category type exists for it, anywhere) is its OWN
  // bucket, 'resting', keyed off `state` rather than `binding_source` so it
  // does not depend on that field being present at all (older payload shapes
  // and this file's own older test fixtures omit it). It is never counted as
  // unconfirmed and never hidden — folding it into "unmapped" is exactly the
  // mistake this file's own top-of-file comment warns against, and hiding it
  // would make the owner's "Deals doesn't publish, and that's fine" decision
  // look like something that quietly vanished rather than something settled.
  //
  // A row with NO `binding_source` at all (fixtures written before the field
  // existed) defaults to 'unconfirmed' rather than 'confirmed' — the safer
  // direction when the fact is simply unknown is to keep asking, not to
  // assume somebody already answered.
  function bindingKind(r) {
    if (r && r.state === 'NO_WM_NODE') { return 'resting'; }
    const src = (r && r.binding_source) || 'name_match';
    return src.indexOf('explicit') === 0 ? 'confirmed' : 'unconfirmed';
  }

  // ── the right panel's default view: a work queue, not an idle placeholder ─
  //
  // Replaces the old "No category selected" EmptyState. That placeholder sat
  // in the panel every time nothing was being edited, which on a 9-row screen
  // is most of the time — and said nothing about which of those 9 rows is
  // actually worth a look. This queue is that answer: every category resolving
  // only by accidental name match, grouped apart from the ones a person has
  // already confirmed on purpose, with Deals' own permanent line never mixed
  // into either.
  function NeedsLookQueue({ rows, onConfirm }) {
    const P = useP();
    const [showConfirmed, setShowConfirmed] = React.useState(false);
    const resting = rows.filter(function (r) { return bindingKind(r) === 'resting'; });
    const unconfirmed = rows.filter(function (r) { return bindingKind(r) === 'unconfirmed'; });
    const confirmed = rows.filter(function (r) { return bindingKind(r) === 'confirmed'; });

    function item(r, opts) {
      opts = opts || {};
      return (
        <div key={r.category} data-hw-queue-item={r.category}
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
            padding: '10px 12px', marginBottom: 8, borderRadius: P.r10,
            border: '1px solid ' + P.hairline2,
            background: opts.resting ? P.infoSoft : P.surface2,
            opacity: opts.dim ? 0.6 : 1 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>{r.category}</span>
              {opts.resting && <Pill kind="info" size="sm">not fixable</Pill>}
            </div>
            <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 3, lineHeight: 1.45 }}>{opts.why}</div>
          </div>
          {opts.confirmable &&
            <PBtn size="xs" data-hw-queue-confirm={r.category}
              onClick={function () { onConfirm(r.category); }}>
              Confirm
            </PBtn>}
        </div>);
    }

    function whyUnconfirmed(r) {
      const base = 'Resolving only because the word happens to match a Weedmaps category type of the ' +
        'same name — nobody has picked it on purpose.';
      if (r.product_count == null) { return base; }
      return base + ' ' + num(r.product_count) + ' product row' + (r.product_count === 1 ? '' : 's') + ' ride on that.';
    }

    return (
      <Card density="roomy" data-hw-queue="1">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>Needs a look</div>
          <span data-hw-queue-count="1">
            <Pill kind={unconfirmed.length ? 'warn' : 'good'} size="sm">
              {unconfirmed.length} unconfirmed
            </Pill>
          </span>
        </div>

        {resting.map(function (r) {
          return item(r, { resting: true,
            why: 'No Weedmaps category type exists, ever. Shown here so it is never mistaken for silently ' +
              'hidden — but there is nothing to confirm.' });
        })}

        {unconfirmed.length === 0 &&
          <div style={{ fontSize: P.type.meta, color: P.inkDim, padding: '2px 0 8px' }}>
            Every category with a Weedmaps category type has been confirmed by someone.
          </div>}
        {unconfirmed.map(function (r) {
          return item(r, { why: whyUnconfirmed(r), confirmable: true });
        })}

        {confirmed.length > 0 &&
          <div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid ' + P.hairline2 }}>
              <button type="button" data-hw-queue-toggle="1"
                onClick={function () { setShowConfirmed(!showConfirmed); }}
                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit',
                  color: P.info, fontWeight: 600, fontSize: P.type.meta,
                  display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name={showConfirmed ? 'chevron-down' : 'chevron-right'} size={13} stroke={2} />
                {confirmed.length} already confirmed — {showConfirmed ? 'hide' : 'show'}
              </button>
            </div>
            {showConfirmed &&
              <div data-hw-queue-settled="1" style={{ marginTop: 8 }}>
                {confirmed.map(function (r) {
                  const picker = (r.bindings && r.bindings[0] && r.bindings[0].actor) || null;
                  return item(r, { dim: true,
                    why: 'Confirmed' + (picker ? ' by ' + picker : '') + '.' });
                })}
              </div>}
          </div>}
      </Card>);
  }

  // ── two independent scroll regions, not one shared with the table ─────────
  //
  // THE BUG (owner-reported, 2026-09-03): reaching the bottom of the right
  // panel required scrolling the WHOLE PAGE, which drags the left-hand
  // table's scroll position along with it. The panel below is pinned with
  // `position:'sticky'` against <main>'s own scroller (pos/app.jsx) -- proven
  // behaviour here, see the split-view comment above -- but it had NO HEIGHT
  // LIMIT OF ITS OWN. Sticky only fixes WHERE an element's top edge sits; it
  // does nothing about how tall the element is allowed to be. Once the panel's
  // own content (every current binding, the 94-node picker, "Add another
  // category type", the preview) grew taller than the visible viewport, the
  // only way to reach the rest of it was to keep scrolling <main> -- the exact
  // scroller the table rides on, so the table moved too.
  //
  // THE FIX IS NOT A SECOND PAGE SCROLLBAR: it is bounding the panel to
  // whatever room is actually left below it in the viewport, right now, and
  // giving that box its own `overflowY:'auto'` so the panel scrolls inside
  // itself and <main> never has to move again once the panel is in view.
  //
  // THE BOUND IS MEASURED, NOT GUESSED. <main>'s own visible height depends on
  // the top bar (pos/shell.jsx TopBar), which has no fixed pixel height -- it
  // wraps store stats and reflows with content -- so a hardcoded
  // `calc(100vh - Npx)` would be a number this file made up. Reading the
  // panel's own `getBoundingClientRect().top` instead asks the one question
  // that actually matters: how much vertical space is left below THIS
  // element's current position, right now. `overscrollBehavior:'contain'` is
  // the same fix NodePicker already carries a few hundred lines up, for the
  // same reason: without it, scrolling this box to either end CHAINS into
  // <main> the instant it runs out of room, which is the "screen jumped
  // around" defect all over again, just moved one level in.
  function useStickyPanelMaxHeight(ref, ready) {
    const [maxHeight, setMaxHeight] = React.useState(null);
    // `ready` is deliberately a dependency, not just a mount-time read. The
    // panel sits behind `{d && ...}` (CategoryMapScreen, below) — it does not
    // exist in the DOM at all until the first GET resolves, so an effect that
    // only ran once on mount (`[]`) would capture `ref.current === null`
    // forever and never get a second chance once the panel actually appears.
    // `ready` flips from falsy to truthy exactly when that happens, which is
    // what re-runs this effect against a real node.
    React.useEffect(function () {
      const el = ref.current;
      if (!el) { return undefined; }
      const scroller = (typeof el.closest === 'function' && el.closest('main')) || null;
      const BOTTOM_GAP = 20;   // breathing room, echoes <main>'s own bottom padding intent
      const MIN_USABLE = 220;  // never shrink to something no control can fit inside
      function recompute() {
        if (!ref.current || typeof ref.current.getBoundingClientRect !== 'function') { return; }
        const top = ref.current.getBoundingClientRect().top;
        const vh = (typeof window !== 'undefined' && window.innerHeight) || 0;
        setMaxHeight(Math.max(MIN_USABLE, Math.floor(vh - top - BOTTOM_GAP)));
      }
      recompute();
      window.addEventListener('resize', recompute);
      if (scroller) { scroller.addEventListener('scroll', recompute, { passive: true }); }
      return function () {
        window.removeEventListener('resize', recompute);
        if (scroller) { scroller.removeEventListener('scroll', recompute); }
      };
    }, [ready]);
    return maxHeight;
  }

  window.CategoryMapScreen = function CategoryMapScreen() {
    const P = useP();
    const [http, setHttp] = React.useState(null);
    const [tick, setTick] = React.useState(0);
    const [open, setOpen] = React.useState({});
    const [editing, setEditing] = React.useState(null);
    // Set only by the "Needs a look" queue's Confirm action (below), so the
    // picker can jump straight to the category type a name-match row already
    // resolves to instead of making the operator re-pick something the screen
    // already knows. Cleared whenever the editor is opened any other way.
    const [initialNode, setInitialNode] = React.useState(null);
    // THE MAP THE SERVER RETURNED WITH THE WRITE, not one this screen guessed.
    // Every write route answers with the whole recomputed map, so the row an
    // operator sees after saving is the server's answer and never an optimistic
    // local edit — the shape that lets a UI show a binding the server declined.
    const [fresh, setFresh] = React.useState(null);

    // ── bulk select: several of OUR categories, one Weedmaps category type ──
    // Every write this screen makes (bind/unbind/alias) is one category at a
    // time; that has not changed and is not being replaced. This is a SECOND,
    // ADDITIVE path for the case the owner named as too slow today: pick N
    // categories here, pick ONE category type once in the panel, and this
    // screen calls the same `/bind` route once per category instead of making
    // the operator open "Bindings (N)" and re-pick the same node N times.
    // `sel` holds category NAMES (the same key `rowKey`/`bindingKind` already
    // use), never row objects, so a reload that gives every row a fresh
    // identity does not silently empty the selection out from under someone.
    const [sel, setSel] = React.useState(function () { return new Set(); });
    // Which right-panel view wins: a single row's "Bindings" editor, the bulk
    // editor, or (neither) the queue. Opening one closes the other two —
    // see the mutual resets below — so the panel is never asked to decide
    // between two live edits at once.
    const [bulkEditing, setBulkEditing] = React.useState(false);

    React.useEffect(function () {
      let live = true;
      setHttp(null); setFresh(null);
      getJSON(ROUTE).then(function (r) { if (live) { setHttp(r); } });
      return function () { live = false; };
    }, [tick]);

    const d = fresh || ((http && http.ok && http.parsed) ? http.body : null);
    const rows = (d && Array.isArray(d.rows)) ? d.rows : [];
    const c = (d && d.counts) || {};

    const allSel = rows.length > 0 && rows.every(function (r) { return sel.has(r.category); });
    const toggleAllSel = function () {
      setSel(allSel ? new Set() : new Set(rows.map(function (r) { return r.category; })));
    };
    const toggleSel = function (category) {
      setSel(function (s) {
        const n = new Set(s);
        if (n.has(category)) { n.delete(category); } else { n.add(category); }
        return n;
      });
    };

    // THE PANEL'S OWN SCROLL BOUND (fix for issue 1 — see
    // useStickyPanelMaxHeight above for why this is measured, not a guessed
    // pixel constant).
    const panelRef = React.useRef(null);
    const panelMaxHeight = useStickyPanelMaxHeight(panelRef, !!d);

    // NOT rendered as `columns[0].label` — DataTable's own header row is real
    // JSX in production, but this screen's OWN row-selection checkbox needs
    // no table-header real estate to make sense, and keeping "select all" as
    // a plain control above the table (with the bulk bar, below) means one
    // fewer thing wedged into a 30px header cell next to nothing. The row
    // checkboxes below are the multi-select affordance itself.
    const columns = [
      { label: '', width: '30px', align: 'center', render: function (r) {
          return (
            <input type="checkbox" checked={sel.has(r.category)}
              onChange={function () { toggleSel(r.category); }}
              onClick={function (e) { e.stopPropagation(); }}
              data-hw-select-row={r.category}
              style={{ width: 15, height: 15, cursor: 'pointer' }} />);
        } },
      { label: 'Our category', width: '19%', render: function (r) {
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
      { label: 'Weedmaps category type', width: '26%', render: function (r) {
        // Guarded, not assumed: category_map.py always sends `bindings` now,
        // but a stale cached payload (or a map object built by hand, as in
        // this screen's own test fixtures) may not carry it yet.
        const rBindings = r.bindings || [];
        return (
          <div style={{ minWidth: 0 }}>
            <WmCell r={r} />
            {/* WHO DECIDED, which is a different fact from WHETHER IT RESOLVES.
                A name match is nobody's decision — the word happened to hit a
                category type of the same name — and an operator about to
                change it should know which of the two they are looking at. */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
              <span data-hw-binding-source={r.binding_source || 'name_match'}
                style={{ fontSize: P.type.micro, color: P.inkMute }}>
                {/* A category can hold SEVERAL explicit picks (2026-08-28) —
                    rBindings is every one of them, oldest first. */}
                {r.binding_source === 'explicit'
                  ? (rBindings.length === 1
                      ? 'picked by ' + (rBindings[0].actor || 'someone')
                      : rBindings.length + ' explicit picks')
                  : r.binding_source === 'explicit_partial'
                    ? (rBindings.filter(function (b) { return b.broken; }).length
                        + ' of ' + rBindings.length + ' picks not in the tree')
                    : r.binding_source === 'explicit_missing_node'
                      ? (rBindings.length === 1
                          ? 'picked category type ' + (rBindings[0] ? rBindings[0].node_id : '?') + ' is not in the tree'
                          : 'all ' + rBindings.length + ' picked category types are not in the tree')
                      : r.binding_source === 'none'
                        ? 'nothing bound — allowed'
                        : 'matched by name, not chosen'}
              </span>
              <PBtn size="xs" icon="edit" data-hw-edit-binding={r.category}
                onClick={function () {
                  setEditing(editing === r.category ? null : r.category);
                  setInitialNode(null);
                  setBulkEditing(false);
                }}>
                {rBindings.length ? 'Bindings (' + rBindings.length + ')' : 'Pick a category type'}
              </PBtn>
            </div>
            {r.overrides_name_match &&
              <div style={{ fontSize: P.type.micro, color: P.warn, marginTop: 4, lineHeight: 1.4 }}>
                overrides the name match, which would bind [{(r.name_match_ids || []).join(', ')}]
              </div>}
          </div>);
      } },
      // THE MATCH JOIN, BETWEEN THE NODE AND THE SPELLINGS ON PURPOSE. It sits
      // next to the node it is constantly mistaken for, so the two facts are
      // read together rather than one standing in for the other.
      { label: 'Matcher joins on', width: '23%', render: function (r) {
        return <MatchCell r={r} />;
      } },
      { label: 'Accepted spellings', width: '20%', render: function (r) {
        return <AliasCell r={r} open={!!open[r.category]}
          onToggle={function () {
            setOpen(function (m) {
              const n = Object.assign({}, m);
              n[r.category] = !n[r.category];
              return n;
            });
          }} />;
      } },
      { label: 'Our products', width: '12%', align: 'right', render: function (r) {
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
          subtitle="Every one of our nine canonical categories, every spelling that folds into it, the Weedmaps category type it binds to with its ids, and how many of our products carry it."
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

        {/* SPLIT VIEW (2026-08-28), replacing the inline-in-the-table editor.
            The owner's words: "have to click on pick a node, then theres a
            bind button, to interface with the categories you have to scroll
            (quoted verbatim — the screen has since renamed "node" to
            "category type" in its own copy, this quote has not)
            to the top of the page." Both complaints traced to the same root
            cause -- the editor rendered in ONE fixed spot in this tree
            (originally right here, above TheDefect) no matter which row's
            button opened it, so scrollIntoView had to drag the whole page up
            to it every time. The fix is not a better scroll: it is not
            re-rendering the editor in the document flow at all. The table
            keeps its normal place on the left; the editor is a panel PINNED
            on the right for as long as this screen is open, and clicking a
            different row's "Bindings" swaps what the panel shows in place --
            `position:'sticky'` against <main>'s own scroll (pos/app.jsx),
            the exact mechanism DataTable's own `stickyHead` already uses on
            this page, so this is a second call site of a pattern already
            proven here, not a new one. No nested scroll container is
            introduced -- NodePicker's own comment already documents what
            overscroll-chaining inside a second scroller did the last time
            this screen grew one. */}
        {d &&
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))', gap: 12, marginBottom: 18 }}>
                <KPI label="Our categories" value={num(c.categories)}
                  sublabel={num(c.resolves) + ' resolve · ' + num(c.unused) + ' unused'} icon="grid" />
                {/* NOT "needs a decision". Nothing is pending on this number: an
                    unbound category is an allowed resting state and there is no
                    ceremony to complete. The old sublabel was a standing to-do for
                    a question that has already been answered. */}
                <KPI label="No Weedmaps category type" value={num(c.no_wm_node)}
                  sublabel={c.no_wm_node ? 'no category type to bind to — allowed, not a task' : 'every category has a category type'}
                  icon="ban" />
                {c.binding_broken
                  ? <KPI label="Bindings pointing nowhere" value={num(c.binding_broken)}
                      sublabel="a picked category type has left Weedmaps' tree" icon="alert" />
                  : null}
                <KPI label="SKUs publishing uncategorised" value={num(c.products_uncategorised)}
                  sublabel={c.products_uncategorised
                    ? 'live on Weedmaps with no category, silently'
                    : 'every spelling reaches a category type'}
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
              </div>

              <TheDefect d={d} />

              {/* THE MATCH JOIN, ABOVE THE TABLE. It is not a footnote to the table:
                  it can be the reason a table full of green badges is still wrong. */}
              <TheShutout d={d} />

              {/* CALM, AND NOT INSIDE THE DEFECT CARD. See TheRescued. */}
              <TheRescued d={d} />

              {rows.length === 0 &&
                <EmptyState icon="grid" title="The route answered and listed no categories"
                  body="wmdemo/taxonomy.TOP_LEVEL is the list this screen renders. An empty list means that tuple is empty, which would itself be the defect — it does not mean the categories are fine." />}

              {/* THE BULK BAR — same shape pos/screen-catalog.jsx already uses for
                  its own multi-select ("N selected", dark bar, a Clear button
                  pinned right): checkboxes on rows are a pattern this estate
                  already has, not a new one invented for this screen. It appears
                  only once something is selected and never crowds the table when
                  nobody has touched a checkbox. */}
              {sel.size > 0 &&
                <div data-hw-bulk-bar="1" style={{ display: 'flex', alignItems: 'center', gap: 14,
                  padding: '11px 16px', marginBottom: 12, background: P.ink, borderRadius: P.r12,
                  color: P.surface, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: P.type.meta, fontWeight: 600, fontFamily: P.fontMono }}>
                    {sel.size} selected
                  </span>
                  <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,.2)' }} />
                  <button type="button" data-hw-bulk-bind="1"
                    onClick={function () { setEditing(null); setInitialNode(null); setBulkEditing(true); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                      background: 'rgba(255,255,255,.08)', color: P.surface, border: 'none', borderRadius: 8,
                      fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans }}>
                    <Icon name="grid" size={13} stroke={2} />
                    Bind {sel.size} to one category type
                  </button>
                  <div style={{ flex: 1 }} />
                  <button type="button" data-hw-bulk-clear="1"
                    onClick={function () { setSel(new Set()); setBulkEditing(false); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                      background: 'transparent', color: P.surface, border: 'none', borderRadius: 8,
                      fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: P.fontSans, opacity: .75 }}>
                    Clear
                  </button>
                </div>}

              {rows.length > 0 &&
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 8,
                  fontSize: P.type.micro, color: P.inkDim, cursor: 'pointer' }}>
                  <input type="checkbox" checked={allSel} onChange={toggleAllSel}
                    data-hw-select-all="1" style={{ width: 14, height: 14, cursor: 'pointer' }} />
                  select all {rows.length} categories
                </label>}

              {rows.length > 0 &&
                <DataTable columns={columns} rows={rows} rowKey={function (r) { return r.category; }}
                  selectedKeys={sel} stickyHead />}

              <div style={{ marginTop: 22 }}>
                <AliasEditor d={d}
                  onSaved={function (map) { if (map) { setFresh(map); } else { setTick(tick + 1); } }} />
              </div>

              {(d.unfoldable || []).length > 0 &&
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
            </div>

            {/* THE PANEL. `top: 0` sticks it to <main>'s own padding edge --
                the same scroll container DataTable's stickyHead already
                sticks its header row against, so this is proven behaviour on
                this exact page, not a new assumption about the shell.
                `maxHeight` + `overflowY:'auto'` (issue 1's fix, see
                useStickyPanelMaxHeight above) give the panel ITS OWN scroll
                region, measured against the real viewport, so the operator
                can reach the bottom of a long binding editor or a long picker
                list without dragging the table's scroll position along with
                it. `overscrollBehavior:'contain'` stops this box from
                chaining into <main> once it runs out of room to scroll,
                same fix NodePicker already carries for the identical reason. */}
            <div ref={panelRef} data-hw-binding-panel="1"
              style={{ position: 'sticky', top: 0,
                maxHeight: panelMaxHeight || undefined, overflowY: 'auto',
                overscrollBehavior: 'contain' }}>
              {(function () {
                const r = editing ? rows.filter(function (x) { return x.category === editing; })[0] : null;
                if (r) {
                  return <BindingEditor row={r} tree={(d.wm_tree && d.wm_tree.tree) || []}
                    collisions={(d.wm_tree && d.wm_tree.collisions) || []}
                    initialNode={initialNode}
                    onClose={function () { setEditing(null); setInitialNode(null); }}
                    // STAYS OPEN ON SAVE, deliberately: a category can hold several
                    // explicit picks now, and closing after every one (the pre-multi-
                    // bind behaviour) turned "bind Flower to two category types" into
                    // two separate trips through "Bindings (N)". The editor resets its
                    // own picker/mode state after each save; only Close or picking a
                    // different row's "Bindings" button leaves this one.
                    onSaved={function (map) { if (map) { setFresh(map); } else { setTick(tick + 1); } }} />;
                }
                // BULK EDITOR: several selected categories, one Weedmaps category
                // type. Only shown when nothing is being edited one-at-a-time —
                // see setEditing/setBulkEditing above, which keep the two mutually
                // exclusive so the panel never has to arbitrate between them.
                if (bulkEditing && sel.size > 0) {
                  return <BulkBindEditor categories={Array.from(sel)}
                    tree={(d.wm_tree && d.wm_tree.tree) || []}
                    collisions={(d.wm_tree && d.wm_tree.collisions) || []}
                    onClose={function () { setBulkEditing(false); }}
                    onSaved={function (map) {
                      if (map) { setFresh(map); } else { setTick(tick + 1); }
                    }} />;
                }
                // EDITING SET BUT THE ROW IS GONE (a reload dropped it) reads the
                // same as NOTHING SELECTED. Neither state is an error -- there is
                // simply nothing here to bind right now. Both fall through to the
                // SAME queue rather than an inert "nothing selected" placeholder —
                // see NeedsLookQueue for why an idle right panel is a wasted panel.
                return (
                  <NeedsLookQueue rows={rows}
                    onConfirm={function (category) {
                      const target = rows.filter(function (x) { return x.category === category; })[0];
                      const ids = (target && target.wm_ids) || [];
                      setBulkEditing(false);
                      setEditing(category);
                      setInitialNode(ids.length ? ids[ids.length - 1] : null);
                    }} />);
              })()}
            </div>
          </div>}

        <DevNote id="catmap-what-green-means" tone="warn"
          title="What a green row here does and does not tell you">
          <DevNoteP>
            A <DevNoteMono>resolves</DevNoteMono> row means our category NAME matched a Weedmaps category
            type NAME, and items will carry that category type&rsquo;s ids. It does not mean the category
            type is the RIGHT one. The match is on a lowercased string, first category type wins a tie, and
            Weedmaps&rsquo; tree is not name-unique &mdash; <DevNoteMono>Diamonds</DevNoteMono> is two
            different category types.
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

        <DevNote id="catmap-writes"
          title="This screen writes now — what each write does, and the one control that is deliberately missing">
          <DevNoteP>
            Two writes, both real: picking a Weedmaps category type for a category
            (<DevNoteMono>POST /api/taxonomy/categories/bind</DevNoteMono>) and adding, repointing or
            removing a spelling (<DevNoteMono>/alias</DevNoteMono>). Both change what goes live on the
            owner&rsquo;s real Weedmaps listing, so both are gated on a live Review before Confirm can
            fire &mdash; the count is recomputed by the server at save time regardless, which is what
            stops a screen that has gone stale from confirming itself. It is the publish gate&rsquo;s own
            mechanism; only the operator-facing shape of it changed on 2026-09-01 (see PreviewPanel).
          </DevNoteP>
          <DevNoteP>
            Reassign (BindingEditor, 2026-09-01) is NOT a third write route &mdash; it is the existing
            <DevNoteMono>/bind</DevNoteMono> and <DevNoteMono>/unbind</DevNoteMono>, called back to back,
            ADD then REMOVE, never the other order. There is no server-side transaction across the two, so
            a failure of the second call leaves the category bound to BOTH the old and the new category
            type rather than to neither &mdash; surfaced on screen, not swallowed. A true one-write reassign
            would need a new server endpoint; this file cannot add one, so this is the closest equivalent
            reachable from here alone.
          </DevNoteP>
          <DevNoteP>
            A picked category type beats the name match on the publish path itself
            (<DevNoteMono>engine.build_item_payload</DevNoteMono> asks
            {' '}<DevNoteMono>category_edit.explicit_ids_for</DevNoteMono> first), and an added spelling
            folds through <DevNoteMono>taxonomy._norm_category</DevNoteMono> like any built-in alias.
            Neither is cosmetic. Both hooks are fail-open: a broken row costs the override, never a push.
          </DevNoteP>
          <DevNoteP>
            A collision REFUSES and names what it hit &mdash; it never overwrites.
            {' '}<DevNoteMono>taxonomy._build_alias_index</DevNoteMono> refuses at import when one alias
            key would resolve to two different canonical names, because a silent winner re-files an
            entire top-level category; the route enforces the same rule, and the preview shows the
            reason before you commit rather than after.
          </DevNoteP>
          <DevNoteP>
            THE MISSING CONTROL, ON PURPOSE: there is no &ldquo;do not publish&rdquo; button, no
            acknowledge, no decision to record for a category with no Weedmaps category type. The owner
            asked for a picker, aliases and a preview, and said &ldquo;if we decide NOT to map deals, then
            that shouldnt be a problem and the system should allow it&rdquo;. Unbound is the DEFAULT
            &mdash; you reach it by doing nothing &mdash; and a control that made you declare it would
            turn &ldquo;not a problem&rdquo; into a chore. Do not add one back.
          </DevNoteP>
        </DevNote>
      </div>);
  };
})();
