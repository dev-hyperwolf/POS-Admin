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


  function num(v) { return v == null ? '—' : Number(v).toLocaleString(); }

  // window.HW.CAT_COLOR (pos/data.jsx) is the one real Hyperwolf-brand
  // per-category accent palette — already used on the catalog, orders, and
  // product-sheet screens. This screen's own canonical names sometimes
  // spell the same category differently (`Pre Roll` vs that file's
  // `Pre-Rolls`, `Vape Pens` vs `Vapes`) — CAT_COLOR_ALIASES bridges the
  // two spellings rather than forking a second palette. `Drinks` and
  // `Accessories` have no entry there at all; those fall through to the
  // same neutral fallback every other CAT_COLOR call site already uses.
  const CAT_COLOR_ALIASES = { 'Pre Roll': 'Pre-Rolls', 'Vape Pens': 'Vapes' };
  function catColor(category) {
    const table = (window.HW && window.HW.CAT_COLOR) || {};
    return table[CAT_COLOR_ALIASES[category] || category] || null;
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
  function NodePicker({ tree, value, onPick, collisions, multi, selectedIds }) {
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
            const sel = multi
              ? !!(selectedIds && selectedIds.has(Number(n.id)))
              : (value != null && Number(value) === Number(n.id));
            return (
              <button key={String(n.id) + '-' + e.depth} type="button"
                data-hw-node={String(n.id)}
                data-hw-node-selected={sel ? '1' : '0'}
                onClick={function () { onPick(n.id); }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%', textAlign: 'left',
                  padding: e.depth ? '5px 10px 5px 26px' : '6px 10px',
                  background: sel ? P.accentSoft : 'transparent',
                  border: 0, borderBottom: '1px solid ' + P.hairline2,
                  cursor: 'pointer', font: 'inherit',
                  color: sel ? P.accentText : P.ink }}>
                {multi &&
                  <input type="checkbox" checked={sel} readOnly tabIndex={-1}
                    style={{ marginTop: 3, flexShrink: 0, pointerEvents: 'none' }} />}
                <span style={{ flex: 1, minWidth: 0 }}>
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
                </span>
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


  // ── bind / unbind / reassign / move / multi-bind: small modals wrapping
  // PreviewPanel ────────────────────────────────────────────────────────────
  // Each is a standalone gated write. Kept separate rather than one component
  // with a `kind` prop because each has a genuinely different preview shape
  // (move synthesizes its own swap sentence, never toGroups/fromGroups) and a
  // genuinely different write sequence (move is two POSTs, the rest are one)
  // — forcing them through one state machine is what tangled the original
  // reassign flow the first time.
  //
  // "REASSIGN" MEANS MOVE-TO-A-DIFFERENT-CATEGORY, NOT SWAP-THE-NODE. This
  // file's first guess was the opposite: `ReassignModal` picked a NEW
  // Weedmaps node for the SAME category (mirroring the old `saveReassign`,
  // which posted both calls with one unchanging `category`). The owner
  // corrected this directly — in a Kanban board, "reassign" reads as "move
  // this card elsewhere," the same thing dragging it to another column does.
  // `ReassignTargetPicker` (below) is now just a category chooser feeding
  // into `MoveCardModal` — the click path and the drag path share the exact
  // same two-call write (bind new category, unbind old one, same node).

  function BindReviewModal({ category, initialNodeId, allowPicker, tree, collisions, onClose, onSaved }) {
    const P = useP();
    const [node, setNode] = React.useState(initialNodeId != null ? initialNodeId : null);
    const [http, setHttp] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const [refusal, setRefusal] = React.useState(null);

    function previewPath() {
      return node == null ? null : ROUTE + '/preview?' + qs({ op: 'bind', category: category, node: node });
    }
    React.useEffect(function () {
      let live = true;
      setHttp(null); setRefusal(null);
      const path = previewPath();
      if (!path) { return function () { live = false; }; }
      getJSON(path).then(function (r) { if (live) { setHttp(r); } });
      return function () { live = false; };
    }, [category, node]);
    function fetchLivePreview() {
      const path = previewPath();
      if (!path) { return Promise.resolve(null); }
      return getJSON(path).then(function (r) { return (r && r.parsed && r.body && r.body.op) ? r.body : null; });
    }
    const pv = (http && http.parsed && http.body && http.body.op) ? http.body
      : (http && http.parsed && http.body && http.body.code)
        ? { op: 'bind', subject: category, products_affected: null, products_known: true,
            sentence: 'This cannot be previewed.', would_refuse: { code: http.body.code, error: http.body.error } }
        : null;

    function save(confirm) {
      setBusy(true); setRefusal(null);
      post(ROUTE + '/bind', { category: category, node: node, confirm_products: confirm }).then(function (r) {
        setBusy(false);
        const ref = refusalOf(r);
        if (ref) { setRefusal(ref); return; }
        onSaved(r.body && r.body.map);
      });
    }

    return (
      <Card density="roomy" data-hw-modal="bind" style={{ border: '1px solid ' + P.accentBorder }}>
        <SectionHead level={3} eyebrow={category} title="Add a Weedmaps category type"
          action={<PBtn icon="x" onClick={onClose}>Cancel</PBtn>} />
        {allowPicker !== false &&
          <div style={{ marginBottom: 12 }}>
            <NodePicker tree={tree} value={node} onPick={setNode} collisions={collisions} />
          </div>}
        {node != null &&
          <PreviewPanel pv={pv} http={http} busy={busy} refusal={refusal} onReview={fetchLivePreview}
            saveLabel="Confirm bind" onSave={save} onCancel={onClose} />}
      </Card>);
  }

  function UnbindReviewModal({ category, nodeId, tree, onClose, onSaved }) {
    const P = useP();
    const [http, setHttp] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const [refusal, setRefusal] = React.useState(null);
    function previewPath() { return ROUTE + '/preview?' + qs({ op: 'unbind', category: category, node: nodeId }); }
    React.useEffect(function () {
      let live = true;
      setHttp(null); setRefusal(null);
      getJSON(previewPath()).then(function (r) { if (live) { setHttp(r); } });
      return function () { live = false; };
    }, [category, nodeId]);
    function fetchLivePreview() {
      return getJSON(previewPath()).then(function (r) { return (r && r.parsed && r.body && r.body.op) ? r.body : null; });
    }
    const pv = (http && http.parsed && http.body && http.body.op) ? http.body
      : (http && http.parsed && http.body && http.body.code)
        ? { op: 'unbind', subject: category, products_affected: null, products_known: true,
            sentence: 'This cannot be previewed.', would_refuse: { code: http.body.code, error: http.body.error } }
        : null;
    function save(confirm) {
      setBusy(true); setRefusal(null);
      post(ROUTE + '/unbind', { category: category, node: nodeId, confirm_products: confirm }).then(function (r) {
        setBusy(false);
        const ref = refusalOf(r);
        if (ref) { setRefusal(ref); return; }
        onSaved(r.body && r.body.map);
      });
    }
    const byId = {}; (tree || []).forEach(function (n) { byId[n.id] = n; });
    const picked = byId[nodeId] || null;
    const parent = picked && picked.parent_id != null ? byId[picked.parent_id] : null;
    const chain = picked ? (parent ? [parent, picked] : [picked]) : null;
    return (
      <Card density="roomy" data-hw-modal="unbind" style={{ border: '1px solid ' + P.warn }}>
        <SectionHead level={3} eyebrow={category}
          title={<span>Remove {chain ? <WmPathChain nodes={chain} broken={!chain} nodeId={nodeId} /> : 'category type ' + nodeId}</span>}
          action={<PBtn icon="x" onClick={onClose}>Cancel</PBtn>} />
        <PreviewPanel pv={pv} http={http} busy={busy} refusal={refusal} onReview={fetchLivePreview}
          saveLabel="Confirm unbind" onSave={save} onCancel={onClose} />
      </Card>);
  }

  function UnbindAllModal({ category, count, onClose, onSaved }) {
    const P = useP();
    const [http, setHttp] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const [refusal, setRefusal] = React.useState(null);
    function previewPath() { return ROUTE + '/preview?' + qs({ op: 'unbind_all', category: category }); }
    React.useEffect(function () {
      let live = true;
      setHttp(null); setRefusal(null);
      getJSON(previewPath()).then(function (r) { if (live) { setHttp(r); } });
      return function () { live = false; };
    }, [category]);
    function fetchLivePreview() {
      return getJSON(previewPath()).then(function (r) { return (r && r.parsed && r.body && r.body.op) ? r.body : null; });
    }
    const pv = (http && http.parsed && http.body && http.body.op) ? http.body
      : (http && http.parsed && http.body && http.body.code)
        ? { op: 'unbind_all', subject: category, products_affected: null, products_known: true,
            sentence: 'This cannot be previewed.', would_refuse: { code: http.body.code, error: http.body.error } }
        : null;
    function save(confirm) {
      setBusy(true); setRefusal(null);
      post(ROUTE + '/unbind-all', { category: category, confirm_products: confirm }).then(function (r) {
        setBusy(false);
        const ref = refusalOf(r);
        if (ref) { setRefusal(ref); return; }
        onSaved(r.body && r.body.map);
      });
    }
    return (
      <Card density="roomy" data-hw-modal="unbind-all" style={{ border: '1px solid ' + P.warn }}>
        <SectionHead level={3} eyebrow={category} title={'Clear all ' + count + ' bindings'}
          action={<PBtn icon="x" onClick={onClose}>Cancel</PBtn>} />
        <PreviewPanel pv={pv} http={http} busy={busy} refusal={refusal} onReview={fetchLivePreview}
          saveLabel={'Confirm — remove all ' + count} onSave={save} onCancel={onClose} />
      </Card>);
  }

  // ── reassign = move this card to a different Kanban column ────────────────
  // Owner correction, 2026-09-04: "Reassign" reads as "move this card
  // elsewhere" in a Kanban board, not "swap which Weedmaps type this same
  // category points to" — the latter was this file's first guess and was
  // wrong. Reassign now shares MoveCardModal (below) with the drag gesture:
  // same node, a different owning category. This picker exists only because
  // a click has no drop target to imply one the way a drag does.
  function ReassignTargetPicker({ category, nodeId, categories, tree, onClose, onSaved, onRefresh }) {
    const P = useP();
    const [target, setTarget] = React.useState(null);
    if (target) {
      return <MoveCardModal fromCategory={category} toCategory={target} nodeId={nodeId} tree={tree}
        onClose={onClose} onSaved={onSaved} onRefresh={onRefresh} />;
    }
    const others = (categories || []).filter(function (c) { return c !== category; });
    return (
      <Card density="roomy" data-hw-modal="reassign-target" style={{ border: '1px solid ' + P.accentBorder }}>
        <SectionHead level={3} eyebrow={'Reassigning from ' + category} title="Move this card to a different category"
          action={<PBtn icon="x" onClick={onClose}>Cancel</PBtn>} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {others.map(function (c) {
            return (
              <button key={c} type="button" data-hw-reassign-target={c} onClick={function () { setTarget(c); }}
                style={{ textAlign: 'left', padding: '9px 11px', borderRadius: P.r10,
                  border: '1px solid ' + P.hairline2, background: P.surface, cursor: 'pointer',
                  font: 'inherit', fontSize: P.type.body, fontWeight: 600, color: P.ink }}>
                {c}
              </button>);
          })}
        </div>
      </Card>);
  }

  function MoveCardModal({ fromCategory, toCategory, nodeId, tree, onClose, onSaved, onRefresh }) {
    const P = useP();
    const [http, setHttp] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const [refusal, setRefusal] = React.useState(null);
    function previewPath() { return ROUTE + '/preview?' + qs({ op: 'bind', category: toCategory, node: nodeId }); }
    React.useEffect(function () {
      let live = true;
      setHttp(null); setRefusal(null);
      getJSON(previewPath()).then(function (r) { if (live) { setHttp(r); } });
      return function () { live = false; };
    }, [toCategory, nodeId]);
    function fetchLivePreview() {
      return getJSON(previewPath()).then(function (r) { return (r && r.parsed && r.body && r.body.op) ? r.body : null; });
    }
    const byId = {}; (tree || []).forEach(function (n) { byId[n.id] = n; });
    const picked = byId[nodeId] || null;
    const parent = picked && picked.parent_id != null ? byId[picked.parent_id] : null;
    const chain = picked ? (parent ? [parent, picked] : [picked]) : null;
    const rawPv = (http && http.parsed && http.body && http.body.op) ? http.body
      : (http && http.parsed && http.body && http.body.code)
        ? { op: 'bind', subject: toCategory, products_affected: null, products_known: true,
            would_refuse: { code: http.body.code, error: http.body.error } }
        : null;
    const pv = rawPv ? Object.assign({}, rawPv, {
      sentence: 'Moves ' + (chain ? chainText(chain) : 'category type ' + nodeId) + ' from ' + fromCategory + ' to ' + toCategory +
        '. Binding ' + toCategory + ' and unbinding ' + fromCategory + ' happen together — never a moment where neither category claims it.'
    }) : null;
    function save(confirm) {
      setBusy(true); setRefusal(null);
      post(ROUTE + '/bind', { category: toCategory, node: nodeId, confirm_products: confirm })
        .then(function (addResult) {
          const addRef = refusalOf(addResult);
          if (addRef) { setBusy(false); setRefusal(addRef); return; }
          return post(ROUTE + '/unbind', { category: fromCategory, node: nodeId, confirm_products: confirm })
            .then(function (removeResult) {
              setBusy(false);
              const removeRef = refusalOf(removeResult);
              if (removeRef) {
                setRefusal(Object.assign({}, removeRef, {
                  error: toCategory + ' now has it too, but removing it from ' + fromCategory + ' was refused: ' +
                    removeRef.error + ' Both categories currently claim it — remove it from ' + fromCategory + ' when you are ready.'
                }));
                // Refresh the data behind this modal without closing it, so
                // the refusal stays visible — same rule the drag-triggered
                // path and the click-triggered path both need.
                if (addResult.body && addResult.body.map && onRefresh) { onRefresh(addResult.body.map); }
                return;
              }
              onSaved(removeResult.body && removeResult.body.map);
            });
        });
    }
    return (
      <Card density="roomy" data-hw-modal="move-card" style={{ border: '1px solid ' + P.accentBorder }}>
        <SectionHead level={3} eyebrow={fromCategory + ' → ' + toCategory} title="Move this category type"
          action={<PBtn icon="x" onClick={onClose}>Cancel</PBtn>} />
        <PreviewPanel pv={pv} http={http} busy={busy} refusal={refusal} onReview={fetchLivePreview}
          saveLabel="Confirm move" onSave={save} onCancel={onClose} />
      </Card>);
  }

  // ── multi-bind: one category, several Weedmaps types, already chosen ──────
  // Adapted from the MultiNodeBindEditor this replaces: `nodeIds` is now a
  // PROP (the queue's checked cards, or MultiPickThenReviewModal's picker
  // below) instead of a Set this component owned and drove its own NodePicker
  // against. Same review/confirm/results shape, unchanged, because it was
  // already real and already tested tonight.
  function MultiBindReviewModal({ category, nodeIds, tree, onClose, onSaved }) {
    const P = useP();
    const [previews, setPreviews] = React.useState(null);
    const [phase, setPhase] = React.useState('idle');
    const [reviewed, setReviewed] = React.useState(null);
    const [staleNodes, setStaleNodes] = React.useState([]);
    const [checking, setChecking] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [unk, setUnk] = React.useState(false);
    const [results, setResults] = React.useState(null);
    const mono = { fontFamily: P.fontMono, fontSize: P.type.meta };
    const nodeList = nodeIds || [];
    const nodeKey = nodeList.join('|');

    function previewPathFor(nodeId) {
      return ROUTE + '/preview?' + qs({ op: 'bind', category: category, node: nodeId });
    }
    function fetchAll() {
      return Promise.all(nodeList.map(function (nodeId) {
        return getJSON(previewPathFor(nodeId)).then(function (r) { return { nodeId: nodeId, http: r }; });
      }));
    }
    React.useEffect(function () {
      let live = true;
      setPreviews(null); setPhase('idle'); setReviewed(null); setStaleNodes([]);
      setResults(null); setUnk(false);
      if (nodeList.length === 0) { return function () { live = false; }; }
      fetchAll().then(function (list) { if (live) { setPreviews(list); } });
      return function () { live = false; };
    }, [nodeKey, category]);
    function pvOf(entry) {
      const http = entry.http;
      if (http && http.parsed && http.body && http.body.op) { return http.body; }
      if (http && http.parsed && http.body && http.body.code) {
        return { op: 'bind', subject: category, products_affected: null, products_known: true,
          would_refuse: { code: http.body.code, error: http.body.error } };
      }
      return null;
    }
    const entries = (previews || []).map(function (e) { return Object.assign({}, e, { pv: pvOf(e) }); });
    const usable = entries.filter(function (e) { return e.pv && !e.pv.would_refuse; });
    const refused = entries.filter(function (e) { return e.pv && e.pv.would_refuse; });
    const anyUnknown = usable.some(function (e) { return e.pv.products_known === false; });
    const treeById = {};
    (tree || []).forEach(function (n) { treeById[n.id] = n; });
    function chainFor(nodeId) {
      const picked = treeById[nodeId] || null;
      if (!picked) { return null; }
      const parent = picked.parent_id != null ? treeById[picked.parent_id] : null;
      return parent ? [parent, picked] : [picked];
    }
    function doReview() {
      setChecking(true);
      fetchAll().then(function (fresh) {
        setChecking(false);
        setPreviews(fresh);
        const map = {};
        fresh.forEach(function (e) {
          const pv = pvOf(e);
          if (pv && !pv.would_refuse) { map[e.nodeId] = pv.products_affected; }
        });
        setReviewed(map);
        setStaleNodes([]);
        setPhase('reviewed');
      });
    }
    function doConfirm() {
      setChecking(true);
      fetchAll().then(function (fresh) {
        setChecking(false);
        const changed = [];
        fresh.forEach(function (e) {
          if (!reviewed || !Object.prototype.hasOwnProperty.call(reviewed, e.nodeId)) { return; }
          const pv = pvOf(e);
          const now = pv && !pv.would_refuse ? pv.products_affected : '__refused__';
          if (String(now) !== String(reviewed[e.nodeId])) { changed.push(e.nodeId); }
        });
        if (changed.length) {
          setPreviews(fresh);
          setStaleNodes(changed);
          setPhase('stale');
          return;
        }
        doSave();
      });
    }
    function doSave() {
      setBusy(true); setPhase('saving');
      const targets = Object.keys(reviewed || {});
      const out = {};
      let chain = Promise.resolve();
      targets.forEach(function (nodeIdStr) {
        chain = chain.then(function () {
          return post(ROUTE + '/bind', { category: category, node: Number(nodeIdStr), confirm_products: reviewed[nodeIdStr] })
            .then(function (r) {
              const ref = refusalOf(r);
              out[nodeIdStr] = { ok: !ref, refusal: ref, map: r && r.body && r.body.map };
            });
        });
      });
      chain.then(function () {
        setBusy(false); setResults(out); setPhase('done');
        let lastMap = null;
        for (let i = targets.length - 1; i >= 0; i--) {
          if (out[targets[i]] && out[targets[i]].map) { lastMap = out[targets[i]].map; break; }
        }
        onSaved(lastMap);
      });
    }

    return (
      <Card density="roomy" data-hw-modal="multi-bind" style={{ border: '1px solid ' + P.accentBorder }}>
        <SectionHead level={3} eyebrow={category}
          title={'Add ' + nodeList.length + ' category type' + (nodeList.length === 1 ? '' : 's') + ' at once'}
          action={<PBtn icon="x" onClick={onClose}>Close</PBtn>} />

        {!previews &&
          <div style={{ fontSize: P.type.meta, color: P.inkMute }}>
            Reading what this would change for each of the {nodeList.length} category types…
          </div>}

        {previews &&
          <div>
            {refused.length > 0 &&
              <div data-hw-multi-skipped="1" style={{ padding: '10px 12px', marginBottom: 10,
                background: P.warnSoft, border: '1px solid ' + P.warn, borderRadius: P.r10 }}>
                <div style={{ fontSize: P.type.meta, fontWeight: 700, color: P.ink }}>
                  {refused.length} of {nodeList.length} won&rsquo;t be included
                </div>
                {refused.map(function (e) {
                  return (
                    <div key={e.nodeId} style={{ fontSize: P.type.micro, color: P.ink2, marginTop: 4, lineHeight: 1.4 }}>
                      <code style={mono}>category type {e.nodeId}</code>: {e.pv.would_refuse.error}
                    </div>);
                })}
              </div>}

            {usable.length === 0 &&
              <div style={{ fontSize: P.type.meta, color: P.inkMute }}>
                None of these category types can be bound to {category} right now.
              </div>}

            {usable.length > 0 && phase === 'idle' &&
              <div>
                <div style={{ fontSize: P.type.meta, color: P.ink2, marginBottom: 8, lineHeight: 1.5 }}>
                  Will bind {category} to <strong>{usable.length}</strong> category type{usable.length === 1 ? '' : 's'}.
                </div>
                <PBtn icon="search" data-hw-multi-review="1" disabled={checking} onClick={doReview}>
                  {checking ? 'Reviewing…' : 'Review change'}
                </PBtn>
              </div>}

            {usable.length > 0 && phase === 'reviewed' &&
              <div>
                <div data-hw-multi-review-strip="1" style={{ padding: '10px 12px', background: P.surface3,
                  border: '1px solid ' + P.hairline2, borderRadius: P.r10 }}>
                  {usable.map(function (e) {
                    const chain = chainFor(e.nodeId);
                    return (
                      <div key={e.nodeId} style={{ display: 'flex', justifyContent: 'space-between',
                        gap: 8, fontSize: P.type.meta, color: P.ink2, padding: '3px 0' }}>
                        {chain ? <WmPathChain nodes={chain} broken={false} nodeId={e.nodeId} /> : <code style={mono}>category type {e.nodeId}</code>}
                        <span>
                          {reviewed[e.nodeId] == null ? 'unknown' :
                            num(reviewed[e.nodeId]) + ' product row' + (reviewed[e.nodeId] === 1 ? '' : 's')}
                        </span>
                      </div>);
                  })}
                </div>
                {anyUnknown &&
                  <label style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={unk} onChange={function (e) { setUnk(!!e.target.checked); }} />
                    <span style={{ fontSize: P.type.meta, color: P.ink }}>
                      I am saving without knowing how many products some of these affect.
                    </span>
                  </label>}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                  <PBtn variant="accent" icon="check" data-hw-multi-confirm="1"
                    disabled={busy || checking || (anyUnknown && !unk)} onClick={doConfirm}>
                    {checking ? 'Checking…' : 'Confirm — bind ' + usable.length}
                  </PBtn>
                  <PBtn icon="x" onClick={onClose}>Cancel</PBtn>
                </div>
              </div>}

            {usable.length > 0 && phase === 'stale' &&
              <div data-hw-multi-stale="1" style={{ padding: '10px 12px', background: P.warnSoft,
                border: '1px solid ' + P.warn, borderRadius: P.r10 }}>
                <div style={{ fontSize: P.type.meta, color: P.ink, lineHeight: 1.5 }}>
                  {staleNodes.length} category type{staleNodes.length === 1 ? '' : 's'} changed since you
                  reviewed — nothing was written. Review again before confirming.
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <PBtn variant="accent" icon="check" disabled>Confirm — bind {usable.length}</PBtn>
                  <PBtn icon="refresh" onClick={doReview}>Review again</PBtn>
                </div>
              </div>}

            {phase === 'saving' &&
              <div style={{ fontSize: P.type.meta, color: P.inkMute }}>Saving…</div>}

            {phase === 'done' && results &&
              <div data-hw-multi-done="1" style={{ marginTop: 4 }}>
                {Object.keys(results).map(function (nodeIdStr) {
                  const r = results[nodeIdStr];
                  const chain = chainFor(Number(nodeIdStr));
                  return (
                    <div key={nodeIdStr} style={{ padding: '8px 10px', marginBottom: 5,
                      borderRadius: P.r8, background: r.ok ? P.goodSoft : P.badSoft,
                      border: '1px solid ' + (r.ok ? P.hairline2 : P.bad) }}>
                      {chain ? <WmPathChain nodes={chain} broken={false} nodeId={Number(nodeIdStr)} /> : <code style={mono}>category type {nodeIdStr}</code>}{' '}
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

  // ── pick several, then hand off to the review modal above ─────────────────
  function MultiPickThenReviewModal({ category, tree, collisions, onClose, onSaved }) {
    const [nodes, setNodes] = React.useState(function () { return new Set(); });
    const [reviewing, setReviewing] = React.useState(false);
    if (reviewing) {
      return <MultiBindReviewModal category={category} nodeIds={Array.from(nodes)} tree={tree}
        onClose={onClose} onSaved={onSaved} />;
    }
    const P = useP();
    return (
      <Card density="roomy" data-hw-modal="multi-pick" style={{ border: '1px solid ' + P.accentBorder }}>
        <SectionHead level={3} eyebrow={category} title="Add several category types at once"
          subtitle="Pick as many as apply, then review them together."
          action={<PBtn icon="x" onClick={onClose}>Cancel</PBtn>} />
        <NodePicker tree={tree} collisions={collisions} multi selectedIds={nodes}
          onPick={function (id) {
            setNodes(function (s) {
              const n = new Set(s);
              const idNum = Number(id);
              if (n.has(idNum)) { n.delete(idNum); } else { n.add(idNum); }
              return n;
            });
          }} />
        {nodes.size > 0 &&
          <div style={{ marginTop: 12 }}>
            <PBtn variant="accent" icon="search" onClick={function () { setReviewing(true); }}>
              Review {nodes.size} category type{nodes.size === 1 ? '' : 's'}
            </PBtn>
          </div>}
      </Card>);
  }

  // ── a modal overlay: no side panel exists any more to anchor these in ─────
  function Modal({ children, onClose }) {
    const P = useP();
    return (
      <div data-hw-modal-scrim="1" onClick={function (e) { if (e.target === e.currentTarget) { onClose(); } }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,12,.42)', zIndex: P.z.scrim,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 20px 20px', overflowY: 'auto' }}>
        <div style={{ width: 'min(560px, 100%)', zIndex: P.z.modal, position: 'relative' }}>{children}</div>
      </div>);
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


  // ── the "needs a look" lane's three real sources ──────────────────────────
  // `resting` and `unconfirmed` are exactly bindingKind's own buckets — see
  // that function above, untouched. `collisionCards` is new: one card per
  // IGNORED node in a name collision, grouped by name the same way
  // NodePicker's own collByName already does (see NodePicker above) — the
  // KEPT id needs no card here, it is already reachable by ordinary name
  // match. Each ignored node's own category is not knowable up front (that
  // is the whole reason it collided), so its card carries no default target —
  // just an "Add to…" choice, resolved live once a category is picked.
  function buildQueue(rows, tree, collisions) {
    const resting = rows.filter(function (r) { return bindingKind(r) === 'resting'; });
    const unconfirmed = rows.filter(function (r) { return bindingKind(r) === 'unconfirmed'; });
    const byId = {};
    (tree || []).forEach(function (n) { byId[n.id] = n; });
    function chainFor(id) {
      const picked = byId[id] || null;
      if (!picked) { return null; }
      const parent = picked.parent_id != null ? byId[picked.parent_id] : null;
      return parent ? [parent, picked] : [picked];
    }
    const collByName = {};
    (collisions || []).forEach(function (c) {
      const k = String(c.name || '').toLowerCase();
      if (!k) { return; }
      if (!collByName[k]) { collByName[k] = { name: c.name, ignored: [] }; }
      collByName[k].ignored.push(c.ignored_id);
    });
    const collisionCards = [];
    Object.keys(collByName).forEach(function (k) {
      collByName[k].ignored.forEach(function (ignoredId) {
        collisionCards.push({ nodeId: ignoredId, name: collByName[k].name, chain: chainFor(ignoredId) });
      });
    });
    // ── every Weedmaps category type nobody has claimed ──────────────────
    // "Claimed" means referenced ANYWHERE this screen already accounts for:
    // a row's resolved wm_ids, an explicit binding, or either side of a name
    // collision (the kept id resolves by name match; the ignored id already
    // has its own card above). Everything left over is a real Weedmaps
    // category type that no Hyperwolf category currently reaches — not
    // fabricated, walked directly off the same tree the picker uses.
    const referenced = new Set();
    rows.forEach(function (r) {
      (r.wm_ids || []).forEach(function (id) { referenced.add(id); });
      (r.bindings || []).forEach(function (b) { referenced.add(b.node_id); });
    });
    (collisions || []).forEach(function (c) {
      referenced.add(c.kept_id); referenced.add(c.ignored_id);
    });
    const unassigned = (tree || [])
      .filter(function (n) { return !referenced.has(n.id); })
      .map(function (n) { return { nodeId: n.id, name: n.name, chain: chainFor(n.id) }; });
    return { resting: resting, unconfirmed: unconfirmed, collisionCards: collisionCards, unassigned: unassigned };
  }

  function QueueCard({ kind, label, subtitle, nodeId, chain, productCount, categories,
    selectMode, selected, onToggleSelect, onConfirm, onAddTo, draggable, isDragging, onDragStartCard, onDragEndCard }) {
    const P = useP();
    return (
      <div data-hw-queue-card={label} draggable={!!draggable}
        onDragStart={draggable ? function (e) { e.dataTransfer.effectAllowed = 'move'; onDragStartCard(); } : undefined}
        onDragEnd={draggable ? onDragEndCard : undefined}
        style={{ padding: '10px 12px', borderRadius: P.r10, border: '1px solid ' + P.hairline2,
          background: kind === 'resting' ? P.infoSoft : P.surface,
          opacity: isDragging ? 0.4 : 1, transform: isDragging ? 'scale(.98)' : 'none',
          display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        {selectMode && kind !== 'resting' &&
          <input type="checkbox" checked={!!selected} onChange={onToggleSelect}
            style={{ marginTop: 2, width: 14, height: 14, cursor: 'pointer' }} />}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Only `unconfirmed`/`resting` cards are named after one of OUR
                categories — `collision` and `unassigned` cards carry a
                Weedmaps node name with no category of their own yet, so
                neither gets a category dot. */}
            {kind !== 'collision' && kind !== 'unassigned' &&
              <span style={{ width: 8, height: 8, borderRadius: 2, flex: '0 0 auto', background: catColor(label) || P.neutral }} />}
            <span style={{ fontSize: P.type.body, fontWeight: 700, color: P.ink }}>{label}</span>
          </div>
          {chain && <div style={{ marginTop: 2 }}><WmPathChain nodes={chain} broken={false} nodeId={nodeId} /></div>}
          <div style={{ fontSize: P.type.micro, color: P.inkDim, marginTop: 3, lineHeight: 1.4 }}>
            {subtitle}{productCount != null ? ' · ' + num(productCount) + ' product row' + (productCount === 1 ? '' : 's') : ''}
          </div>
          {!selectMode && kind === 'unconfirmed' &&
            <PBtn size="xs" style={{ marginTop: 6 }} icon="check" onClick={onConfirm}>Confirm</PBtn>}
          {!selectMode && (kind === 'collision' || kind === 'unassigned') &&
            <select data-hw-queue-add-to={label} defaultValue="" onChange={function (e) {
                if (e.target.value) { onAddTo(e.target.value); e.target.value = ''; }
              }}
              style={{ marginTop: 6, fontSize: P.type.micro, padding: '4px 6px', borderRadius: P.r8,
                border: '1px solid ' + P.hairline3, background: P.surface, color: P.ink }}>
              <option value="" disabled>Add to…</option>
              {(categories || []).map(function (cat) { return <option key={cat} value={cat}>{cat}</option>; })}
            </select>}
        </div>
      </div>);
  }

  function QueueLane({ rows, tree, collisions, categories, selectMode, selected, onToggleSelect,
    onEnterSelectMode, onExitSelectMode, onOpenBind, draggingNodeId, onDragStartCard, onDragEndCard,
    onDragOverQueue, onDragLeaveQueue, onDropQueue }) {
    const P = useP();
    const q = buildQueue(rows, tree, collisions);
    const actionable = q.unconfirmed.length + q.collisionCards.length;
    return (
      <div data-hw-queue-lane="1" onDragOver={onDragOverQueue} onDragLeave={onDragLeaveQueue} onDrop={onDropQueue}
        style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column',
          background: P.surface2, border: '1px dashed ' + P.hairline3, borderRadius: P.r12, padding: 12,
          maxHeight: '78vh', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>Still unmapped</div>
          <Pill kind={actionable ? 'warn' : 'good'} size="sm">{actionable}</Pill>
        </div>
        {actionable > 0 &&
          <PBtn size="xs" variant={selectMode ? 'accent' : 'secondary'} style={{ marginBottom: 10, alignSelf: 'flex-start' }}
            onClick={selectMode ? onExitSelectMode : onEnterSelectMode}>
            {selectMode ? 'Done selecting (' + selected.size + ')' : 'Select multiple'}
          </PBtn>}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.unconfirmed.map(function (r) {
            const ids = r.wm_ids || [];
            const nodeId = ids[ids.length - 1];
            return <QueueCard key={'u-' + r.category} kind="unconfirmed" label={r.category}
              subtitle="auto-matched by name, unconfirmed" nodeId={nodeId} productCount={r.product_count}
              selectMode={selectMode} selected={selected.has(nodeId)} onToggleSelect={function () { onToggleSelect(nodeId); }}
              onConfirm={function () { onOpenBind(r.category, nodeId); }}
              draggable={!selectMode} isDragging={draggingNodeId === nodeId}
              onDragStartCard={function () { onDragStartCard(nodeId); }} onDragEndCard={onDragEndCard} />;
          })}
          {q.collisionCards.map(function (c) {
            return <QueueCard key={'c-' + c.nodeId} kind="collision" label={c.name}
              subtitle="shares this name with another category type" nodeId={c.nodeId} chain={c.chain}
              categories={categories}
              selectMode={selectMode} selected={selected.has(c.nodeId)} onToggleSelect={function () { onToggleSelect(c.nodeId); }}
              onAddTo={function (category) { onOpenBind(category, c.nodeId); }}
              draggable={!selectMode} isDragging={draggingNodeId === c.nodeId}
              onDragStartCard={function () { onDragStartCard(c.nodeId); }} onDragEndCard={onDragEndCard} />;
          })}
          {q.resting.map(function (r) {
            return <QueueCard key={'r-' + r.category} kind="resting" label={r.category}
              subtitle="no Weedmaps category type exists — allowed" />;
          })}
          {actionable === 0 && q.resting.length === 0 && q.unassigned.length === 0 &&
            <div style={{ fontSize: P.type.meta, color: P.inkMute, padding: '8px 0' }}>
              Nothing needs a look right now.
            </div>}
          {q.unassigned.length > 0 &&
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: P.type.meta, fontWeight: 700, color: P.ink2, padding: '6px 0',
                borderTop: '1px solid ' + P.hairline2 }}>
                {q.unassigned.length} Weedmaps category type{q.unassigned.length === 1 ? '' : 's'} not yet assigned to anything
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {q.unassigned.map(function (u) {
                  return <QueueCard key={'x-' + u.nodeId} kind="unassigned" label={u.name}
                    subtitle="not claimed by any Hyperwolf category" nodeId={u.nodeId} chain={u.chain}
                    categories={categories}
                    selectMode={selectMode} selected={selected.has(u.nodeId)} onToggleSelect={function () { onToggleSelect(u.nodeId); }}
                    onAddTo={function (category) { onOpenBind(category, u.nodeId); }}
                    draggable={!selectMode} isDragging={draggingNodeId === u.nodeId}
                    onDragStartCard={function () { onDragStartCard(u.nodeId); }} onDragEndCard={onDragEndCard} />;
                })}
              </div>
            </div>}
        </div>
      </div>);
  }

  function WmTypeCard({ category, binding, draggable, isDragging, onDragStartCard, onDragEndCard, onReassign, onUnbind }) {
    const P = useP();
    // Live per-binding count, on request (owner, 2026-09-04) — deliberately
    // NOT the category's own aggregate `product_count` (that counts every
    // product under the CATEGORY, not this one Weedmaps pick specifically).
    // The real number for "how many products ride on THIS pick" only exists
    // via a live call: `/preview?op=unbind` answers exactly that question
    // for a single (category, node) pair, because unbinding this one pick is
    // the operation whose product count this card is describing. Fetched
    // once per card, not batched — there are at most a few dozen bound
    // cards on screen at once, nothing like the 94-node tree size.
    const [count, setCount] = React.useState(undefined); // undefined = loading, null = unknown
    React.useEffect(function () {
      let live = true;
      setCount(undefined);
      getJSON(ROUTE + '/preview?' + qs({ op: 'unbind', category: category, node: binding.node_id }))
        .then(function (r) {
          if (!live) { return; }
          const body = r && r.parsed && r.body;
          setCount(body && body.op ? (body.products_known === false ? null : body.products_affected) : null);
        });
      return function () { live = false; };
    }, [category, binding.node_id]);
    const leaf = (binding.path && binding.path.length) ? [binding.path[binding.path.length - 1]] : [];
    return (
      <div data-hw-wm-card={binding.node_id} draggable={!!draggable}
        onDragStart={draggable ? function (e) { e.dataTransfer.effectAllowed = 'move'; onDragStartCard(); } : undefined}
        onDragEnd={draggable ? onDragEndCard : undefined}
        style={{ padding: '9px 11px', borderRadius: P.r10,
          border: '1px solid ' + (binding.broken ? P.bad : P.hairline2),
          background: binding.broken ? P.badSoft : P.surface,
          opacity: isDragging ? 0.4 : 1, transform: isDragging ? 'scale(.98)' : 'none',
          cursor: draggable ? 'grab' : 'default' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
          <WmPathChain nodes={leaf} broken={binding.broken} nodeId={binding.node_id} />
          <div style={{ display: 'flex', gap: 4, flex: '0 0 auto' }}>
            <button type="button" title="Reassign" onClick={onReassign}
              style={{ background: 'transparent', border: 0, cursor: 'pointer', color: P.inkMute, padding: 2 }}>
              <Icon name="swap" size={14} stroke={1.7} />
            </button>
            <button type="button" title="Unbind" onClick={onUnbind}
              style={{ background: 'transparent', border: 0, cursor: 'pointer', color: P.inkMute, padding: 2 }}>
              <Icon name="x" size={14} stroke={1.7} />
            </button>
          </div>
        </div>
        {!binding.broken &&
          <div data-hw-wm-card-count="1" style={{ fontSize: P.type.micro, color: P.inkMute, marginTop: 4 }}>
            {count === undefined ? 'reading…' : count == null ? 'unknown products' : num(count) + ' product' + (count === 1 ? '' : 's')}
          </div>}
        {binding.broken &&
          <div style={{ fontSize: P.type.micro, color: P.bad, marginTop: 4 }}>not in the tree any more</div>}
      </div>);
  }

  function EmptyWmNodeCard({ category, onAddAnyway }) {
    const P = useP();
    return (
      <div data-hw-empty-wm-node={category} style={{ padding: '10px 12px', borderRadius: P.r10,
        background: P.infoSoft, border: '1px solid ' + P.hairline2 }}>
        <div style={{ fontSize: P.type.meta, fontWeight: 600, color: P.ink }}>No Weedmaps category type</div>
        <div style={{ fontSize: P.type.micro, color: P.inkDim, marginTop: 3, lineHeight: 1.4 }}>
          Weedmaps has no category type named &ldquo;{category}&rdquo; — this is an allowed resting state, not a fault.
        </div>
        <button type="button" onClick={onAddAnyway}
          style={{ marginTop: 6, background: 'none', border: 0, padding: 0, cursor: 'pointer',
            font: 'inherit', fontSize: P.type.micro, color: P.info, fontWeight: 600 }}>
          Point it at a category type anyway
        </button>
      </div>);
  }

  function AutoResolvedCard({ category, wmPath, wmIds }) {
    const P = useP();
    return (
      <div data-hw-auto-resolved={category} style={{ padding: '9px 11px', borderRadius: P.r10,
        border: '1px solid ' + P.hairline2, background: P.surface2 }}>
        <div style={{ fontSize: P.type.body, fontWeight: 600, color: P.ink2 }}>
          {wmPath || 'category type ' + (wmIds || []).join(', ')}
        </div>
        <div style={{ fontSize: P.type.micro, color: P.inkDim, marginTop: 3 }}>auto-resolved by name match</div>
      </div>);
  }

  function CategoryColumn({ row, isDropTarget, onColumnDragOver, onColumnDragLeave, onColumnDrop,
    onOpenBind, onOpenMultiAdd, onOpenReassign, onOpenUnbind, onOpenUnbindAll,
    draggingNodeId, draggingFromCategory, onDragStartWmCard, onDragEndCard }) {
    const P = useP();
    const bindings = row.bindings || [];
    return (
      <div data-hw-column={row.category} onDragOver={onColumnDragOver} onDragLeave={onColumnDragLeave} onDrop={onColumnDrop}
        style={{ flex: '0 0 260px', display: 'flex', flexDirection: 'column',
          background: P.surface, border: '1px solid ' + (isDropTarget ? P.accentBorder : P.hairline2),
          borderRadius: P.r12, maxHeight: '78vh', overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', borderBottom: '2px solid ' + (catColor(row.category) || P.hairline) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, flex: '0 0 auto',
              background: catColor(row.category) || P.neutral }} />
            <span style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>{row.category}</span>
          </div>
          <div style={{ fontSize: P.type.micro, color: P.inkMute, marginTop: 2, marginLeft: 16 }}>
            {row.product_count == null ? 'unknown products' : num(row.product_count) + ' product' + (row.product_count === 1 ? '' : 's')}
          </div>
        </div>
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 }}>
          {bindings.length > 0 && bindings.map(function (b) {
            return <WmTypeCard key={b.node_id} category={row.category} binding={b}
              draggable isDragging={draggingNodeId === b.node_id && draggingFromCategory === row.category}
              onDragStartCard={function () { onDragStartWmCard(row.category, b.node_id); }}
              onDragEndCard={onDragEndCard}
              onReassign={function () { onOpenReassign(row.category, b.node_id); }}
              onUnbind={function () { onOpenUnbind(row.category, b.node_id); }} />;
          })}
          {bindings.length === 0 && row.state === 'NO_WM_NODE' &&
            <EmptyWmNodeCard category={row.category} onAddAnyway={function () { onOpenBind(row.category, null); }} />}
          {bindings.length === 0 && row.state !== 'NO_WM_NODE' && row.wm_ids && row.wm_ids.length > 0 &&
            <AutoResolvedCard category={row.category} wmPath={row.wm_path} wmIds={row.wm_ids} />}
        </div>
        <div style={{ padding: '8px 12px', borderTop: '1px solid ' + P.hairline, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <PBtn size="xs" icon="grid" onClick={function () { onOpenBind(row.category, null); }}>+ Add</PBtn>
          <PBtn size="xs" icon="grid" onClick={function () { onOpenMultiAdd(row.category); }}>+ Add several</PBtn>
          {bindings.length > 1 &&
            <PBtn size="xs" icon="x" onClick={function () { onOpenUnbindAll(row.category, bindings.length); }}>
              Clear all {bindings.length}
            </PBtn>}
        </div>
      </div>);
  }

  function StatLine({ rows, counts, queueCount }) {
    const P = useP();
    const totalBound = rows.reduce(function (a, r) { return a + (r.bindings || []).length; }, 0);
    const resting = rows.filter(function (r) { return r.state === 'NO_WM_NODE'; }).length;
    return (
      <div data-hw-stat-line="1" style={{ fontSize: P.type.meta, color: P.inkDim, marginBottom: 14, fontFamily: P.fontMono }}>
        {rows.length} categories · {totalBound} Weedmaps type{totalBound === 1 ? '' : 's'} bound · {num(counts.products)} products
        {' · '}{queueCount} needing a look · {resting} resting — no Weedmaps category type
      </div>);
  }

  // ── the board itself: drag state, modal state, everything else is real
  // GET data with no client-side re-derivation of anything the route already
  // decided (see the file's own header comment — that invariant did not move
  // just because the layout did) ──────────────────────────────────────────
  function CategoryBoard({ d, onSaved }) {
    const P = useP();
    const rows = (d && Array.isArray(d.rows)) ? d.rows : [];
    const tree = (d.wm_tree && d.wm_tree.tree) || [];
    const collisions = (d.wm_tree && d.wm_tree.collisions) || [];
    const c = d.counts || {};
    const categoryNames = rows.map(function (r) { return r.category; });

    const [modal, setModal] = React.useState(null);
    const [drag, setDrag] = React.useState(null);
    const [dropTargetCategory, setDropTargetCategory] = React.useState(null);
    const [dropTargetQueue, setDropTargetQueue] = React.useState(false);
    const [selectMode, setSelectMode] = React.useState(false);
    const [selectedQueueIds, setSelectedQueueIds] = React.useState(function () { return new Set(); });

    function closeModal() { setModal(null); }
    function saved(map) { closeModal(); onSaved(map); }

    function openBind(category, nodeId) { setModal({ type: 'bind', category: category, nodeId: nodeId }); }
    function openMultiAdd(category) { setModal({ type: 'multi-pick', category: category }); }
    function openReassign(category, fromNodeId) { setModal({ type: 'reassign', category: category, fromNodeId: fromNodeId }); }
    function openUnbind(category, nodeId) { setModal({ type: 'unbind', category: category, nodeId: nodeId }); }
    function openUnbindAll(category, count) { setModal({ type: 'unbind-all', category: category, count: count }); }
    function openMoveCard(fromCategory, toCategory, nodeId) {
      setModal({ type: 'move', fromCategory: fromCategory, toCategory: toCategory, nodeId: nodeId });
    }

    function onDragStartQueueCard(nodeId) { setDrag({ source: 'queue', nodeId: nodeId }); }
    function onDragStartWmCard(category, nodeId) { setDrag({ source: 'card', nodeId: nodeId, fromCategory: category }); }
    function onDragEndCard() { setDrag(null); setDropTargetCategory(null); setDropTargetQueue(false); }

    function onColumnDrop(category) {
      return function (e) {
        e.preventDefault();
        setDropTargetCategory(null);
        if (!drag) { return; }
        // Re-resolve against the CURRENT rows before acting — a reload
        // could have raced this drag, and a stale nodeId must not open a
        // modal for a binding that no longer exists.
        if (drag.source === 'card') {
          const stillExists = rows.some(function (r) {
            return r.category === drag.fromCategory && (r.bindings || []).some(function (b) { return b.node_id === drag.nodeId; });
          });
          if (!stillExists) { setDrag(null); return; }
          if (drag.fromCategory === category) { setDrag(null); return; }
          openMoveCard(drag.fromCategory, category, drag.nodeId);
        } else if (drag.source === 'queue') {
          openBind(category, drag.nodeId);
        }
        setDrag(null);
      };
    }
    function onQueueDrop(e) {
      e.preventDefault();
      setDropTargetQueue(false);
      // Dropping a bound card back into the queue is a no-op — nothing here
      // un-derives a real binding by dragging it away.
      setDrag(null);
    }
    function toggleQueueSelect(nodeId) {
      setSelectedQueueIds(function (s) {
        const n = new Set(s);
        if (n.has(nodeId)) { n.delete(nodeId); } else { n.add(nodeId); }
        return n;
      });
    }

    const queueCount = rows.filter(function (r) { return bindingKind(r) === 'unconfirmed'; }).length
      + (collisions || []).length;

    return (
      <div data-hw-board="1">
        <StatLine rows={rows} counts={c} queueCount={queueCount} />
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          <QueueLane rows={rows} tree={tree} collisions={collisions} categories={categoryNames}
            selectMode={selectMode} selected={selectedQueueIds}
            onToggleSelect={toggleQueueSelect}
            onEnterSelectMode={function () { setSelectMode(true); }}
            onExitSelectMode={function () { setSelectMode(false); setSelectedQueueIds(new Set()); }}
            onOpenBind={openBind}
            draggingNodeId={drag && drag.source === 'queue' ? drag.nodeId : null}
            onDragStartCard={onDragStartQueueCard} onDragEndCard={onDragEndCard}
            onDragOverQueue={function (e) { e.preventDefault(); setDropTargetQueue(true); }}
            onDragLeaveQueue={function () { setDropTargetQueue(false); }}
            onDropQueue={onQueueDrop} />
          {rows.map(function (row) {
            return <CategoryColumn key={row.category} row={row}
              isDropTarget={dropTargetCategory === row.category}
              onColumnDragOver={function (e) { e.preventDefault(); setDropTargetCategory(row.category); }}
              onColumnDragLeave={function () { setDropTargetCategory(null); }}
              onColumnDrop={onColumnDrop(row.category)}
              onOpenBind={openBind} onOpenMultiAdd={openMultiAdd}
              onOpenReassign={openReassign} onOpenUnbind={openUnbind} onOpenUnbindAll={openUnbindAll}
              draggingNodeId={drag ? drag.nodeId : null} draggingFromCategory={drag ? drag.fromCategory : null}
              onDragStartWmCard={onDragStartWmCard} onDragEndCard={onDragEndCard} />;
          })}
        </div>

        {selectMode && selectedQueueIds.size > 0 &&
          <div data-hw-bulk-bar="1" style={{ display: 'flex', alignItems: 'center', gap: 14,
            padding: '11px 16px', marginTop: 12, background: P.ink, borderRadius: P.r12, color: P.surface, flexWrap: 'wrap' }}>
            <span style={{ fontSize: P.type.meta, fontWeight: 600, fontFamily: P.fontMono }}>
              {selectedQueueIds.size} selected
            </span>
            <select data-hw-bulk-target="1" defaultValue="" onChange={function (e) {
                if (e.target.value) { setModal({ type: 'multi-bind-target', category: e.target.value, nodeIds: Array.from(selectedQueueIds) }); }
              }}
              style={{ fontSize: 12.5, padding: '5px 8px', borderRadius: 8 }}>
              <option value="" disabled>Bind to…</option>
              {categoryNames.map(function (cat) { return <option key={cat} value={cat}>{cat}</option>; })}
            </select>
          </div>}

        {modal && modal.type === 'bind' &&
          <Modal onClose={closeModal}>
            <BindReviewModal category={modal.category} initialNodeId={modal.nodeId}
              allowPicker={modal.nodeId == null} tree={tree} collisions={collisions}
              onClose={closeModal} onSaved={saved} />
          </Modal>}
        {modal && modal.type === 'unbind' &&
          <Modal onClose={closeModal}>
            <UnbindReviewModal category={modal.category} nodeId={modal.nodeId} tree={tree}
              onClose={closeModal} onSaved={saved} />
          </Modal>}
        {modal && modal.type === 'unbind-all' &&
          <Modal onClose={closeModal}>
            <UnbindAllModal category={modal.category} count={modal.count} onClose={closeModal} onSaved={saved} />
          </Modal>}
        {modal && modal.type === 'reassign' &&
          <Modal onClose={closeModal}>
            <ReassignTargetPicker category={modal.category} nodeId={modal.fromNodeId} categories={categoryNames} tree={tree}
              onClose={closeModal} onSaved={saved} onRefresh={onSaved} />
          </Modal>}
        {modal && modal.type === 'move' &&
          <Modal onClose={closeModal}>
            <MoveCardModal fromCategory={modal.fromCategory} toCategory={modal.toCategory} nodeId={modal.nodeId} tree={tree}
              onClose={closeModal} onSaved={saved} onRefresh={onSaved} />
          </Modal>}
        {modal && modal.type === 'multi-pick' &&
          <Modal onClose={closeModal}>
            <MultiPickThenReviewModal category={modal.category} tree={tree} collisions={collisions}
              onClose={closeModal} onSaved={saved} />
          </Modal>}
        {modal && modal.type === 'multi-bind-target' &&
          <Modal onClose={closeModal}>
            <MultiBindReviewModal category={modal.category} nodeIds={modal.nodeIds} tree={tree}
              onClose={closeModal} onSaved={function (map) { saved(map); setSelectMode(false); setSelectedQueueIds(new Set()); }} />
          </Modal>}
      </div>);
  }

  window.CategoryMapScreen = function CategoryMapScreen() {
    const P = useP();
    const [http, setHttp] = React.useState(null);
    const [tick, setTick] = React.useState(0);
    // THE MAP THE SERVER RETURNED WITH THE WRITE, not one this screen guessed.
    // Every write route answers with the whole recomputed map, so what the
    // board shows after a save is the server's answer, never an optimistic
    // local edit — unchanged from before the board replaced the table.
    const [fresh, setFresh] = React.useState(null);

    React.useEffect(function () {
      let live = true;
      setHttp(null); setFresh(null);
      getJSON(ROUTE).then(function (r) { if (live) { setHttp(r); } });
      return function () { live = false; };
    }, [tick]);

    const d = fresh || ((http && http.ok && http.parsed) ? http.body : null);
    const rows = (d && Array.isArray(d.rows)) ? d.rows : [];

    function onSaved(map) {
      if (map) { setFresh(map); } else { setTick(tick + 1); }
    }

    return (
      <div>
        <SectionHead level={1} eyebrow="Our categories ↔ Weedmaps' categories"
          title="Category map"
          subtitle="Every one of our nine canonical categories, one board column each, and every Weedmaps category type it binds to."
          action={<PBtn icon="refresh" onClick={function () { setTick(tick + 1); }}>Reload</PBtn>} />

        {!http && <div style={{ marginBottom: 18 }}><SkeletonRows rows={4} /></div>}

        {http && !http.ok &&
          <ErrorState
            title={'GET ' + ROUTE + ' answered HTTP ' + (http.code || 'nothing at all')}
            body={'This deployment does not serve the category map route, so NOTHING BELOW IS A REPORT ABOUT OUR CATEGORIES — nothing looked. An empty screen here means the route is missing, never that every category is fine. It is served by wmdemo/category_map.py through wmdemo/server.py.'}
            detail={http.netError || ((http.body && http.body.error) || http.raw) || http.url}
            onRetry={function () { setTick(tick + 1); }}
            style={{ background: P.badSoft, borderRadius: P.r12, marginBottom: 18 }} />}

        {d && rows.length === 0 &&
          <EmptyState icon="grid" title="The route answered and listed no categories"
            body="wmdemo/taxonomy.TOP_LEVEL is the list this screen renders. An empty list means that tuple is empty, which would itself be the defect — it does not mean the categories are fine." />}

        {d && rows.length > 0 && <CategoryBoard d={d} onSaved={onSaved} />}

        {d &&
          <div style={{ marginTop: 22 }}>
            <AliasEditor d={d} onSaved={onSaved} />
          </div>}

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
          title="What a bound card here does and does not tell you">
          <DevNoteP>
            A card under a category means our NAME matched a Weedmaps category type NAME (or was
            explicitly picked), and items will carry that category type&rsquo;s ids. It does not mean the
            category type is the RIGHT one. Weedmaps&rsquo; tree is not name-unique &mdash;
            {' '}<DevNoteMono>Diamonds</DevNoteMono> is two different category types, surfaced in the
            queue lane as a collision.
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
            Two kinds of write, both real: picking a Weedmaps category type for a category
            (<DevNoteMono>POST /api/taxonomy/categories/bind</DevNoteMono> and <DevNoteMono>/unbind</DevNoteMono>)
            and adding, repointing or removing a spelling (<DevNoteMono>/alias</DevNoteMono>). Both change
            what goes live on the owner&rsquo;s real Weedmaps listing, so both are gated on a live Review
            before Confirm can fire &mdash; the count is recomputed by the server at save time regardless,
            which is what stops a screen that has gone stale from confirming itself.
          </DevNoteP>
          <DevNoteP>
            Dragging a card between columns, or reassigning one to a different category type, is NOT a
            third write route &mdash; both are the existing <DevNoteMono>/bind</DevNoteMono> and
            {' '}<DevNoteMono>/unbind</DevNoteMono>, called back to back, ADD then REMOVE, never the other
            order. There is no server-side transaction across the two, so a failure of the second call
            leaves the category type bound to BOTH sides rather than to neither &mdash; surfaced on
            screen, not swallowed. A true one-write move would need a new server endpoint; this file
            cannot add one, so this is the closest equivalent reachable from here alone.
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
