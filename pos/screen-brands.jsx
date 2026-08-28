// ── pos/screen-brands.jsx ── the Brands tab ────────────────────────────────
// OUR brand DB <-> WEEDMAPS' brand DB, and the mapping between them.
// Self-wrapping IIFE: it declares NOTHING at top level, so it cannot clobber
// another file's globals (see test/global-collisions.test.mjs). Its only export
// is window.BrandsScreen.
// Reads GET /api/brands, GET /api/brands/candidates, GET /api/brands/backfill.
// Writes through window.HW_LIVE.post (the one token-aware POST path).
// Degrades by NAMING the route that failed. A 404 never renders as "no brands":
// an empty list means "we looked and there are none", which is a claim nobody
// has made.
;(function () {
  'use strict';
  const useP = window.useP;

  // ── WHY THIS SCREEN EXISTS ────────────────────────────────────────────────
  //
  // Weedmaps serves products PER BRAND: brands/{id}/products. A brand we have
  // not mapped therefore has no feed at all, so none of its products ever enter
  // the candidate pool and every one of its SKUs is scored against nothing.
  // That is not a product-matching bug and it cannot be fixed in the product
  // matcher. Brand mapping is the PREREQUISITE for product mapping.
  //
  // THE THREE STATES THAT MUST NEVER RENDER THE SAME, and this screen is the
  // only place they are all visible at once:
  //   * never asked        we hold no product count for this WM brand
  //   * asked, and 0       the brand EXISTS on Weedmaps and its feed is empty
  //                        (Dr. Kerklaan, id 10245, meta.total 0). A binding to
  //                        it is CORRECT and still yields no candidates.
  //   * asked, and N       the only one of the three that is a working mapping
  // Collapsing the first two into "0" is how a mapping that can never produce a
  // match reads as a success.
  //
  // NAME MATCHING IS NOT DONE HERE AND WILL NOT BE. It belongs to
  // wmdemo/brands.py, reached through /api/brands/candidates. Weedmaps calls
  // Kiva "Kiva Confections"; PLUGPLAY carries the trademark sign INSIDE the
  // name string; bare "710" hits seven brands. A second matcher written in a
  // screen to make it look finished would eventually disagree with the first,
  // and the disagreement would surface as a brand silently rebinding itself.
  // The one thing this file does with names is FOLD them for equality, which is
  // how it joins our two brand lists and how it detects the 9 collisions -- and
  // a collision resolves to NOTHING, never to a winner.

  const TOK = { store: 'wmdemo/brands.py' };

  // ── fold ─────────────────────────────────────────────────────────────────
  // A mirror of wmdemo/server.py:_brand_fold. Equality and collision detection
  // ONLY -- it is not a matcher and it is allowed to be wrong in the direction
  // of saying "no".
  //
  // NFKD, never NFKC. NFKC turns "PLUGPLAY(TM)" into "PLUGPLAYTM", inventing
  // two letters that are in nobody's brand name, and "plugplaytm" then fails to
  // equal "plugplay". Strip the symbol; do not transliterate it.
  function fold(name) {
    let s = String(name == null ? '' : name).normalize('NFKD');
    s = s.replace(/\p{M}/gu, '');
    s = s.replace(/[™®©]/g, '');
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function base() {
    try { if (window.HW_LIVE && window.HW_LIVE.base) { return window.HW_LIVE.base; } } catch (e) {}
    return window.location.origin;
  }

  // Every GET answers the SAME shape, so a caller can never confuse "the route
  // is not there" with "the route said there is nothing".
  function getJSON(path) {
    const url = base() + path;
    return fetch(url, { credentials: 'omit', cache: 'no-store' }).then(function (res) {
      return res.text().then(function (txt) {
        let body = null, parsed = false;
        try { body = JSON.parse(txt); parsed = true; } catch (e) {}
        return { url: url, code: res.status, ok: res.ok, body: body, parsed: parsed,
          raw: txt.slice(0, 400) };
      });
    }).catch(function (e) {
      return { url: url, code: 0, ok: false, body: null, parsed: false,
        raw: '', netError: (e && e.message) || 'request failed' };
    });
  }

  function post(path, payload) {
    if (window.HW_LIVE && typeof window.HW_LIVE.post === 'function') {
      return window.HW_LIVE.post(path, payload);
    }
    return fetch(base() + path, {
      method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    }).then(function (res) {
      return res.json().then(function (j) {
        return { ok: res.ok, code: res.status, body: j,
          error: (j && (j.error || j.why)) || ('HTTP ' + res.status),
          hint: (j && j.hint) || null };
      }, function () {
        return { ok: res.ok, code: res.status, body: null,
          error: 'HTTP ' + res.status + ' (body was not JSON)', hint: null };
      });
    }).catch(function (e) {
      return { ok: false, code: 0, body: null,
        error: 'request failed: ' + ((e && e.message) || 'unknown'), hint: null };
    });
  }

  function n0(v) { return v == null ? null : Number(v); }

  // ── OUR side, local: shared/brands.js is this repo's one brand DB ─────────
  // It is included on purpose. The owner's question was "does our brand DB map
  // to theirs", and shared/brands.js IS our brand DB on every POS surface. Its
  // 16 rows carry NO wm_brand_id today -- which is the finding, not an omission
  // to paper over.
  function posBrands() {
    const out = [];
    try {
      const list = (window.HW_BRANDS && window.HW_BRANDS.list) || [];
      const prods = (window.HW && window.HW.PRODUCTS) || [];
      const bySku = {};
      prods.forEach(function (p) {
        const k = fold(p && p.brand);
        if (!k) { return; }
        (bySku[k] = bySku[k] || []).push(p.sku || p.id);
      });
      list.forEach(function (b) {
        const k = fold(b.name);
        out.push({ key: k, name: b.name, skus: bySku[k] || [],
          wm: b.wm || null, category: b.category });
      });
    } catch (e) {}
    return out;
  }

  // ── product-mapping counts, per brand ────────────────────────────────────
  // Read from the sibling seam that already fetched them. NEVER a second fetch,
  // and never a zero when the sibling is not there to ask: `null` means "we did
  // not get to look", and the cell says so.
  function mappedBySku() {
    try {
      const M = window.HW_MAPPING;
      if (!M || !Array.isArray(M.rows) || !M.rows.length) { return null; }
      const by = {};
      M.rows.forEach(function (r) { if (r && r.sku) { by[r.sku] = r; } });
      return by;
    } catch (e) { return null; }
  }

  // ── row assembly ─────────────────────────────────────────────────────────
  // Three inputs, one row per FOLDED brand key:
  //   stored    wmdemo/brands.py records (the human decisions) -- outrank all
  //   evidence  derived read-only from our product rows by server.py
  //   pos db    shared/brands.js
  // Where the store and the products disagree the store wins and both are shown,
  // because that disagreement is a real event: somebody approves a brand and
  // then imports a catalogue that says otherwise.
  function buildRows(data, mapBySku) {
    const rows = {};
    const collByFold = {};
    ((data && data.index_collisions) || []).forEach(function (c) { collByFold[c.folded] = c; });

    function slot(key) {
      if (!rows[key]) {
        rows[key] = { key: key, ourName: null, variants: [], from: {},
          stored: null, ev: null, skus: [], skuSource: null,
          wmId: null, wmName: null, wmCount: null, wmPulledAt: null,
          wmPullOk: undefined, wmPullError: null, state: null,
          confidence: null, tier: null, matchReason: null,
          runnerUp: null, candidates: null, nameTrap: null,
          claimConflict: null, why: null, collision: collByFold[key] || null };
      }
      return rows[key];
    }

    const stored = (data && Array.isArray(data.brands)) ? data.brands : null;
    if (stored) {
      stored.forEach(function (s) {
        const k = s.brand_key || fold(s.our_name);
        const r = slot(k);
        r.from.store = true;
        r.stored = s;
        r.ourName = s.our_name || r.ourName;
        r.state = s.state || null;
        r.wmId = n0(s.wm_brand_id);
        r.wmName = s.wm_name || null;
        r.wmCount = n0(s.wm_product_count);
        r.wmPulledAt = s.wm_pulled_at || null;
        r.wmPullOk = s.wm_pull_ok;
        r.wmPullError = s.wm_pull_error || null;
        r.confidence = s.confidence == null ? null : Number(s.confidence);
        r.tier = s.match_tier == null ? null : Number(s.match_tier);
        r.matchReason = s.match_reason || null;
        r.runnerUp = s.runner_up_id == null ? null
          : { id: s.runner_up_id, name: s.runner_up_name,
              confidence: s.runner_up_confidence };
        r.decidedBy = s.decided_by || null;
        r.reviewedBy = s.reviewed_by || null;
        r.manual = !!s.manual_override;
        if (s.sku_count != null) { r.storedSkuCount = Number(s.sku_count); }
      });
    }

    const ev = (data && data.evidence && data.evidence.brands) || [];
    ev.forEach(function (e) {
      const r = slot(e.brand_key);
      r.from.catalogue = true;
      r.ev = e;
      if (!r.ourName) { r.ourName = e.brand_name; }
      r.variants = (e.brand_name_variants || []).slice();
      r.skus = (e.skus || []).slice();
      r.skuSource = 'catalogue';
      r.evCount = e.product_count;
      r.why = e.why || null;
      r.nameTrap = e.name_trap || null;
      r.claimConflict = e.claim_conflict_with || null;
      // The store holds the human decision. Evidence only fills a gap.
      if (!r.from.store) {
        r.wmId = n0(e.wm_brand_id);
        r.wmName = e.wm_brand_name || null;
        r.state = 'evidence:' + e.evidence;
      } else if (r.wmId != null && n0(e.wm_brand_id) != null &&
                 r.wmId !== n0(e.wm_brand_id)) {
        r.storeVsProducts = { store: r.wmId, products: n0(e.wm_brand_id) };
      }
    });

    posBrands().forEach(function (b) {
      const r = slot(b.key);
      r.from.posdb = true;
      if (!r.ourName) { r.ourName = b.name; }
      r.posName = b.name;
      r.posSkus = b.skus;
      r.posWm = b.wm || null;
      if (!r.skus.length) { r.skus = b.skus.slice(); r.skuSource = 'posdb'; }
      // THE PARAMETER THE OWNER ASKED FOR. If shared/brands.js carries a `wm`
      // block on a row, it is honoured here — but only for the ID and the EXACT
      // WM NAME. The product count is deliberately NOT taken from it: a number
      // written into a source file is a claim about Weedmaps at the moment
      // somebody typed it, and rendering it as `wm_product_count` would make a
      // stale literal indistinguishable from a live pull. See the snippet in
      // the handoff for the shape.
      if (r.wmId == null && b.wm && b.wm.id != null) {
        r.wmId = Number(b.wm.id);
        r.wmName = b.wm.name || null;
        r.wmFromPosDb = true;
        r.state = 'mapped';
      }
      if (!r.state) { r.state = 'unmapped'; }
    });

    const list = Object.keys(rows).map(function (k) {
      const r = rows[k];
      r.skuCount = r.skus.length;
      if (mapBySku) {
        let m = 0, seen = 0;
        r.skus.forEach(function (sku) {
          const x = mapBySku[sku];
          if (x) { seen++; if (x.linked) { m++; } }
        });
        r.mapped = m;
        r.mapKnown = seen;
      } else {
        r.mapped = null;
        r.mapKnown = null;
      }
      r.blocking = !isMapped(r) ? r.skuCount : 0;
      return r;
    });

    // The operator's queue is "how many of our SKUs is this row blocking",
    // never alphabetical order.
    list.sort(function (a, b) {
      if (b.blocking !== a.blocking) { return b.blocking - a.blocking; }
      if (b.skuCount !== a.skuCount) { return b.skuCount - a.skuCount; }
      return String(a.ourName || '').localeCompare(String(b.ourName || ''));
    });
    return list;
  }

  function isMapped(r) { return r.wmId != null; }

  // The FIVE row states, each with its own next action. If two of these ever
  // render the same the screen has stopped being useful.
  function verdict(r) {
    if (r.collision) {
      return { kind: 'bad', label: 'fold collision',
        why: 'Two Weedmaps brands fold to this same key. Resolving it to either one would scope our SKUs to a stranger’s catalogue. A human sets the id here; the matcher must return nothing.' };
    }
    if (!isMapped(r)) {
      return { kind: 'bad', label: 'not mapped',
        why: 'Weedmaps serves products per brand, so with no wm_brand_id this brand has no feed. Its ' + r.skuCount + ' SKU' + (r.skuCount === 1 ? '' : 's') + ' can never enter the candidate pool — they are not unmatched, they are unreachable.' };
    }
    // ORDER MATTERS. A failed pull leaves wm_product_count null, so if
    // "never pulled" were tested first every auth expiry would render as
    // "we have not looked yet" — which is the exact conflation this screen
    // exists to prevent.
    if (r.wmPullOk === 0) {
      return { kind: 'warn', label: 'mapped · pull failed',
        why: 'The last read of this brand’s feed failed, so we hold no product count. An auth expiry looks exactly like an empty brand unless the error is shown: ' + (r.wmPullError || 'no error text was recorded') };
    }
    if (r.wmCount == null) {
      return { kind: 'info', label: 'mapped · never pulled',
        why: 'Bound to a Weedmaps brand, but nobody has read its feed, so we do not know whether it carries any products. This is not the same as zero.' };
    }
    if (r.wmCount === 0) {
      return { kind: 'warn', label: 'mapped · 0 products',
        why: 'The binding is CORRECT and still yields nothing: this Weedmaps brand exists and its feed is empty. Brand-exists is not product-exists.' };
    }
    return { kind: 'good', label: 'mapped',
      why: 'Bound to a Weedmaps brand whose feed carries ' + r.wmCount + ' product' + (r.wmCount === 1 ? '' : 's') + '.' };
  }

  // ── the explainer ────────────────────────────────────────────────────────
  // Deliberately at the top and never collapsed. A developer who has never seen
  // this system has to be able to read the argument off the screen.
  function Explainer() {
    const P = useP();
    const box = (title, sub, tone) => (
      <div style={{ flex: '1 1 0', minWidth: 150, padding: '11px 13px',
        background: tone === 'them' ? P.infoSoft : tone === 'link' ? P.accentSoft : P.surface3,
        border: '1px solid ' + (tone === 'link' ? P.accentBorder : P.hairline2),
        borderRadius: P.r10 }}>
        <div style={{ fontSize: P.type.strong, fontWeight: 700, color: tone === 'link' ? P.accentText : P.ink }}>{title}</div>
        <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 3, lineHeight: 1.45 }}>{sub}</div>
      </div>);
    const arrow = (label) => (
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '0 2px' }}>
        <Icon name="arrow-right" size={16} stroke={2} color={P.inkMute} />
        <span style={{ fontSize: P.type.micro, color: P.inkMute, fontFamily: P.fontMono }}>{label}</span>
      </div>);
    return (
      <Card density="roomy" style={{ marginBottom: 18 }}>
        <Eyebrow>Two databases, one mapping</Eyebrow>
        <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink, margin: '8px 0 4px', letterSpacing: '-.01em' }}>
          Our brand DB and Weedmaps&rsquo; brand DB are not the same database.
        </div>
        <div style={{ fontSize: P.type.body, color: P.ink2, lineHeight: 1.6, maxWidth: 900 }}>
          Weedmaps serves a catalogue <strong>per brand</strong> &mdash; <code style={{ fontFamily: P.fontMono, fontSize: P.type.meta, background: P.surface3, padding: '1px 5px', borderRadius: P.r8 }}>brands/&#123;id&#125;/products</code>.
          {' '}A brand of ours with no <code style={{ fontFamily: P.fontMono, fontSize: P.type.meta, background: P.surface3, padding: '1px 5px', borderRadius: P.r8 }}>wm_brand_id</code> has
          {' '}<strong>no feed</strong>, so none of its products ever enter the candidate pool and every one of its SKUs is scored against nothing.
          {' '}Those SKUs are not <em>unmatched</em> &mdash; they are <em>unreachable</em>. Mapping the brand is what makes product sync possible at all.
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {box('Our brand DB', 'brand_key · our_name · our SKUs behind it', 'us')}
          {arrow('wm_brand_id')}
          {box('The mapping', 'one id, plus the exact WM name and its meta', 'link')}
          {arrow('is the key to')}
          {box('Weedmaps brand DB', '3,255 brands · each with its own product feed', 'them')}
          {arrow('per brand')}
          {box('Their products', 'the candidate pool our SKUs are scored against', 'them')}
        </div>
      </Card>);
  }

  // ── where every number on this screen came from ──────────────────────────
  function SourceBanner({ http, data, backfill, onBackfill, backfillState }) {
    const P = useP();
    const st = (data && data.store) || null;
    const idx = (data && data.wm_index) || null;
    const derived = data && data.source === 'derived_from_products';
    const line = (icon, kind, text) => (
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 0' }}>
        <span style={{ flex: '0 0 auto', marginTop: 1, color: kind === 'bad' ? P.bad : kind === 'warn' ? P.warn : kind === 'good' ? P.good : P.inkMute }}>
          <Icon name={icon} size={14} stroke={2} />
        </span>
        <span style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5 }}>{text}</span>
      </div>);
    return (
      <Card density="compact" style={{ marginBottom: 18, background: P.surface2 }}>
        <Eyebrow>Where these numbers come from</Eyebrow>
        <div style={{ marginTop: 6 }}>
          {line('link', http.ok ? 'good' : 'bad',
            <span><code style={{ fontFamily: P.fontMono }}>GET /api/brands</code> answered <strong>HTTP {http.code || 'no response'}</strong>{http.netError ? ' — ' + http.netError : ''}. Base <code style={{ fontFamily: P.fontMono }}>{base()}</code>.</span>)}
          {st && line('database', st.available && st.bound ? 'good' : 'warn',
            st.available && st.bound
              ? <span>Brand store <code style={{ fontFamily: P.fontMono }}>{TOK.store}</code> is bound (<code style={{ fontFamily: P.fontMono }}>{st.bound}</code>), so decisions are sticky.</span>
              : <span><strong>No stored brand list.</strong> <code style={{ fontFamily: P.fontMono }}>{TOK.store}</code> {st.available ? 'imports, but exposes none of the functions this route asks for' : 'is not importable'} &mdash; <span style={{ color: P.inkDim }}>{st.error || 'no detail given'}</span>. Nothing on this screen is sticky until it binds.</span>)}
          {derived && line('info', 'warn',
            <span>The rows below are <strong>derived read-only from our product rows</strong> (<code style={{ fontFamily: P.fontMono }}>source: derived_from_products</code>), not read from a brand table. They are true and they are not decisions.</span>)}
          {idx && line('package', idx.ok ? 'good' : 'bad',
            idx.ok
              ? <span>Weedmaps&rsquo; side: <strong>{idx.count.toLocaleString()}</strong> brands, every page of the partner index, from <code style={{ fontFamily: P.fontMono, fontSize: 10.5 }}>{idx.path}</code>.</span>
              : <span>The Weedmaps brand index did not load: {idx.error || 'no detail'}. Nothing below can name a WM brand.</span>)}
          {backfill && backfill.ok && backfill.body && line('check-circle', backfill.body.would_bind_count ? 'good' : 'info',
            <span>
              <strong>{backfill.body.would_bind_count}</strong> brand{backfill.body.would_bind_count === 1 ? '' : 's'} could be bound by <em>reading</em> rather than matching &mdash; every product under them already names the same <code style={{ fontFamily: P.fontMono }}>wm_brand_id</code>. {backfill.body.held_back_count} held back for a human. <span style={{ color: P.inkDim }}>(GET /api/brands/backfill is a preview and takes no apply flag &mdash; no query string can turn it into a write.)</span>
              {backfill.body.would_bind_count > 0 &&
                <span style={{ display: 'inline-block', marginLeft: 8, verticalAlign: 'middle' }}>
                  <PBtn size="xs" busy={backfillState === 'pending'} onClick={onBackfill}>
                    Bind those {backfill.body.would_bind_count}
                  </PBtn>
                </span>}
              {backfillState && backfillState !== 'pending' &&
                <span style={{ display: 'block', marginTop: 6, color: backfillState.ok ? P.good : P.bad }}>
                  POST /api/brands/backfill &#123;apply:true&#125; &mdash; HTTP {backfillState.code}. {backfillState.ok
                    ? 'Applied: ' + backfillState.bound + ' bound from product agreement, ' +
                      backfillState.held + ' held back for a person.'
                    : backfillState.error}
                </span>}
            </span>)}
          {data && data.products_with_no_brand_name && data.products_with_no_brand_name.length > 0 && line('alert', 'warn',
            <span><strong>{data.products_with_no_brand_name.length}</strong> of our products carry an <strong>empty</strong> <code style={{ fontFamily: P.fontMono }}>brand_name</code>. They belong to no brand row at all, so no brand mapping can ever reach them.</span>)}
        </div>
      </Card>);
  }

  // ── the WM meta cell: three states that must never look alike ────────────
  function WmMeta({ r }) {
    const P = useP();
    if (!isMapped(r)) {
      return <span style={{ fontSize: P.type.meta, color: P.inkMute }}>&mdash;</span>;
    }
    if (r.wmPullOk === 0) {
      return (
        <span title={r.wmPullError || 'the pull failed'} style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
          <Pill kind="warn" size="sm" icon="alert">pull failed</Pill>
          <span style={{ fontSize: P.type.micro, color: P.inkDim, maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.wmPullError || 'no error text'}</span>
        </span>);
    }
    if (r.wmCount == null) {
      return (
        <span title="Nobody has read this brand's Weedmaps feed. That is not the same as reading it and finding nothing.">
          <Pill kind="info" size="sm" icon="help">never pulled</Pill>
        </span>);
    }
    if (r.wmCount === 0) {
      return (
        <span title="This Weedmaps brand exists and its product feed is empty. The binding is correct and it will still never yield a candidate.">
          <Pill kind="warn" size="sm" icon="ban">0 products on WM</Pill>
        </span>);
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: P.fontMono, fontSize: P.type.numRow, fontWeight: 700, color: P.ink, fontVariantNumeric: 'tabular-nums' }}>{r.wmCount.toLocaleString()}</span>
        <span style={{ fontSize: P.type.micro, color: P.inkMute }}>on WM</span>
      </span>);
  }

  // ── the pair that is the whole argument for this screen ──────────────────
  // "n of our SKUs sit behind this brand" next to "m of them reached a WM
  // product". A brand row with 9 SKUs and 0 mapped is the brand layer failing
  // the product layer, and no other screen puts those two numbers together.
  function SkuPair({ r }) {
    const P = useP();
    const unreachable = !isMapped(r) && r.skuCount > 0;
    return (
      <div style={{ minWidth: 132 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontFamily: P.fontMono, fontSize: P.type.numRow, fontWeight: 700, color: P.ink, fontVariantNumeric: 'tabular-nums' }}>{r.skuCount}</span>
          <span style={{ fontSize: P.type.micro, color: P.inkMute }}>SKU{r.skuCount === 1 ? '' : 's'}</span>
          <span style={{ fontSize: P.type.micro, color: P.inkFaint }}>&middot;</span>
          {r.mapped == null
            ? <span style={{ fontSize: P.type.micro, color: P.inkMute }}>mapping not loaded</span>
            : <span style={{ fontSize: P.type.micro, color: r.mapped ? P.good : P.inkDim, fontWeight: 600 }}>{r.mapped} mapped</span>}
        </div>
        {r.mapped != null && r.skuCount > 0 &&
          <BarMeter value={r.mapped} max={r.skuCount} height={5}
            color={r.mapped === 0 ? (unreachable ? P.bad : P.inkFaint) : r.mapped === r.skuCount ? P.good : P.warn} />}
        {unreachable &&
          <div style={{ fontSize: P.type.micro, color: P.bad, marginTop: 3, lineHeight: 1.35 }}>
            unreachable &mdash; no brand feed to search
          </div>}
        {r.mapped == null && r.skuCount > 0 &&
          <div style={{ fontSize: P.type.micro, color: P.inkMute, marginTop: 3 }}>
            HW_MAPPING is not loaded, so this is unknown &mdash; not zero
          </div>}
      </div>);
  }

  // ── the manual picker ────────────────────────────────────────────────────
  // Search their 3,255, see the candidates WITH their scores INCLUDING the ones
  // that lost, pick one, and have it stick. An operator who cannot see why the
  // runner-up lost cannot disagree with the machine.
  function Picker({ row, onClose, onChanged }) {
    const P = useP();
    const [q, setQ] = React.useState(row.ourName || '');
    const [res, setRes] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const [pick, setPick] = React.useState(null);
    const [writeOut, setWriteOut] = React.useState(null);

    const search = React.useCallback(function (term) {
      setBusy(true); setRes(null);
      const p = '/api/brands/candidates?brand=' + encodeURIComponent(row.key) +
        '&q=' + encodeURIComponent(term || '') + '&limit=25';
      getJSON(p).then(function (r) { setRes(r); setBusy(false); });
    }, [row.key]);

    React.useEffect(function () { search(row.ourName || ''); }, [search, row.ourName]);

    function write(path, payload, label) {
      setWriteOut({ pending: label });
      post(path, payload).then(function (r) {
        setWriteOut({ done: true, label: label, r: r });
        if (r && r.ok) { onChanged(); }
      });
    }

    // ── THE RESPONSE CARRIES TWO DIFFERENT LISTS AND THEY ARE NOT THE SAME ──
    //
    // Verified against the live route, 2026-08-26:
    //   GET /api/brands/candidates?brand=kivaconfections&q=Kiva
    //     -> state "mapped", reason "exact", wm_brand_id 510, confidence 1.0,
    //        candidates []            <-- EMPTY, and the brand is matched
    //   GET /api/brands/candidates?brand=cann&q=High%20Rise
    //     -> candidates [Cann 1.0]    <-- the PROPOSAL for `cann`
    //        search.candidates [...]  <-- what "High Rise" actually scored
    //
    // `candidates` is the field the MATCHER's verdict was drawn from; when a
    // tier accepts a candidate outright the matcher withholds the padding and
    // that array is empty. Rendering it as the search result therefore prints
    // "nothing cleared the floor" over a brand that matched at 1.0000, and
    // prints Cann's proposal under the heading of a High Rise search. Both are
    // false and both look fine. The two lists are drawn separately, labelled
    // with what they are, and the search list comes from `search.candidates`.
    const body = res && res.body;
    const refused = res && res.code === 503;
    const proposal = body && (body.state || body.reason) ? body : null;
    const propCands = body && Array.isArray(body.candidates) ? body.candidates : null;
    const searchBlock = body && body.search && typeof body.search === 'object' ? body.search : null;
    const searchCands = searchBlock && Array.isArray(searchBlock.candidates) ? searchBlock.candidates
      : (!proposal && propCands ? propCands : null);
    const searchTerm = searchBlock ? searchBlock.query : (body && body.query) || q;

    // ── CAN ANY OF THESE BUTTONS ACTUALLY LAND ──────────────────────────────
    //
    // The live defect this answers, reproduced on a scratch DB 2026-08-27:
    //   GET  /api/brands/candidates?brand=cann
    //     -> wm_brand_id 11200, tier 1, 1.0000, "exact"   <-- CORRECT. WM
    //        brand 11200 really is named 'Cann'.
    //   POST /api/brands/approve {brand:'cann', wm_brand_id:11200}
    //     -> HTTP 409 "no brand 'cann' in the catalogue"   <-- ALSO CORRECT.
    //
    // Both halves are right and the screen still lied, because it drew a live
    // "Bind to Cann" button between them. The rows on this screen come from
    // THREE sources and only two of them can be bound: shared/brands.js is a
    // design roster of 16 names, while the bind precondition is the roster
    // wmdemo/brands.py derives FROM PRODUCTS. Nine of the sixteen -- Cann,
    // Kiva, Lowell Farms, Papa & Barkley, Connected, Select, Pax Labs, 710
    // Labs, Cookies -- carry no product in the catalogue today and every one
    // of them offered a working button.
    //
    // `bindable` is brands.bind_blocker(), the SAME check approve() makes, so
    // the picker cannot offer what the route will refuse. It is not recomputed
    // here: a second copy of that rule drifts, and the drift shows up as a
    // button that works on one screen and 409s on another.
    //
    // STRICTLY `=== false`. `null` means the question was not asked (a
    // free-text search binds nothing) and `undefined` means the server predates
    // the field. Neither is a refusal, and disabling on either would turn an
    // ABSENCE INTO A VERDICT -- which is the same mistake in the other
    // direction, and would lock an operator out of a bind that works.
    const cannotWrite = !!(body && body.bindable === false);
    const writeBlock = (body && body.bind_blocked) || null;

    // The matcher's OWN collision verdict for this brand, plus the one this
    // screen folds for whatever the operator just typed. Either is a refusal.
    const propCollision = body && Array.isArray(body.collision) && body.collision.length
      ? { folded: fold(body.our_name || row.ourName),
          names: body.collision.map(function (c) { return c.name; }),
          wm_brand_ids: body.collision.map(function (c) { return c.id; }) }
      : null;
    const foldOfQ = fold(q);
    const collisions = (body && body.index_collisions) || [];
    const hitCollision = collisions.filter(function (c) { return c.folded === foldOfQ; })
      .concat(propCollision && propCollision.folded !== foldOfQ ? [propCollision] : []);
    const traps = (body && body.name_traps) || null;

    // One renderer for both lists, so a loser can never be styled as a winner
    // in one place and not the other.
    function CandList({ list, label, note }) {
      const top = list.length ? (list[0].confidence != null ? list[0].confidence : list[0].score) : null;
      return (
        <div style={{ marginTop: 16 }}>
          <Eyebrow>{label}</Eyebrow>
          {note && <div style={{ fontSize: P.type.meta, color: P.inkDim, margin: '6px 0 10px', lineHeight: 1.5 }}>{note}</div>}
          {list.map(function (c, i) {
            const cid = c.id != null ? c.id : c.wm_brand_id;
            const cname = c.name || c.wm_name;
            const conf = c.confidence != null ? c.confidence : c.score;
            const chosen = pick && pick.id === cid;
            return (
              <div key={String(cid) + ':' + i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', marginBottom: 6,
                background: chosen ? P.accentSoft : i === 0 ? P.surface2 : 'transparent',
                border: '1px solid ' + (chosen ? P.accentBorder : P.hairline2), borderRadius: P.r10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: P.type.body, fontWeight: 600, color: P.ink, wordBreak: 'break-word' }}>{cname}</div>
                  <div style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.inkDim, marginTop: 2 }}>
                    wm_brand_id {cid}{c.exact ? ' · exact fold' : ''}{c.contained ? ' · contained' : ''}{c.reason ? ' · ' + c.reason : ''}
                  </div>
                </div>
                <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
                  <div style={{ fontFamily: P.fontMono, fontSize: P.type.numRow, fontWeight: 700, color: i === 0 ? P.ink : P.inkDim, fontVariantNumeric: 'tabular-nums' }}>
                    {conf == null ? 'not scored' : Number(conf).toFixed(4)}
                  </div>
                  <div style={{ fontSize: P.type.micro, color: P.inkMute }}>
                    {i === 0 ? 'top' : (top != null && conf != null ? 'lost by ' + (top - conf).toFixed(4) : 'lost')}
                  </div>
                </div>
                <PBtn size="xs" variant={chosen ? 'primary' : 'secondary'}
                  onClick={function () { setPick({ id: cid, name: cname }); }}>{chosen ? 'Picked' : 'Pick'}</PBtn>
              </div>);
          })}
        </div>);
    }

    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: P.scrim, zIndex: 60,
        display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}>
        <div onClick={function (e) { e.stopPropagation(); }} style={{ width: 'min(640px, 96vw)', background: P.surface,
          borderTopLeftRadius: P.r20, borderBottomLeftRadius: P.r20, display: 'flex', flexDirection: 'column',
          boxShadow: P.shadowLg, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid ' + P.hairline2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <Eyebrow>Map to a Weedmaps brand</Eyebrow>
              <div style={{ fontSize: P.type.h2, fontWeight: 700, color: P.ink, marginTop: 5, letterSpacing: '-.01em' }}>{row.ourName}</div>
              <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 4, fontFamily: P.fontMono }}>brand_key {row.key} &middot; {row.skuCount} of our SKUs behind it</div>
            </div>
            <IconBtn icon="x" label="Close" onClick={onClose} />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px 24px' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Field icon="search" placeholder="Search their 3,255 brands…" value={q}
                onChange={function (e) { setQ(e.target.value); }}
                onKeyDown={function (e) { if (e.key === 'Enter') { search(q); } }} />
              <PBtn variant="primary" busy={busy} onClick={function () { search(q); }}>Search</PBtn>
            </div>

            {hitCollision.length > 0 && hitCollision.map(function (c) { return (
              <Card key={c.folded} density="compact" style={{ marginTop: 14, background: P.badSoft, borderColor: P.bad }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Icon name="alert" size={15} stroke={2} color={P.bad} />
                  <span style={{ fontSize: P.type.strong, fontWeight: 700, color: P.bad }}>Fold collision &mdash; this resolves to nothing</span>
                </div>
                <div style={{ fontSize: P.type.meta, color: P.ink2, marginTop: 6, lineHeight: 1.5 }}>
                  Two different Weedmaps brands fold to <code style={{ fontFamily: P.fontMono }}>{c.folded}</code>. Both are shown; neither is proposed.
                  Picking one would scope our SKUs to a stranger&rsquo;s catalogue and then declare their products absent from it.
                  A human sets the id here.
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {c.names.map(function (nm, i) { return (
                    <div key={c.wm_brand_ids[i]} style={{ flex: '1 1 200px', padding: '9px 11px', background: P.surface, border: '1px solid ' + P.hairline2, borderRadius: P.r10 }}>
                      <div style={{ fontSize: P.type.body, fontWeight: 600, color: P.ink }}>{nm}</div>
                      <div style={{ fontFamily: P.fontMono, fontSize: P.type.meta, color: P.inkDim, marginTop: 2 }}>wm_brand_id {c.wm_brand_ids[i]}</div>
                      <PBtn size="xs" style={{ marginTop: 8 }} onClick={function () { setPick({ id: c.wm_brand_ids[i], name: nm, bySight: true }); }}>Choose this one</PBtn>
                    </div>); })}
                </div>
              </Card>); })}

            {busy && <div style={{ marginTop: 16 }}><SkeletonRows rows={4} avatar={false} /></div>}

            {!busy && refused &&
              <Card density="compact" style={{ marginTop: 14, background: P.warnSoft, borderColor: P.warn }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Icon name="ban" size={15} stroke={2} color={P.warn} />
                  <span style={{ fontSize: P.type.strong, fontWeight: 700, color: P.warn }}>The matcher is not here &mdash; and it did not pretend to be</span>
                </div>
                <div style={{ fontSize: P.type.meta, color: P.ink2, marginTop: 6, lineHeight: 1.55 }}>
                  <code style={{ fontFamily: P.fontMono }}>GET /api/brands/candidates</code> answered <strong>503</strong>: {body && body.error}.
                  {' '}Capability <code style={{ fontFamily: P.fontMono }}>{body && body.capability}</code>; it tried <code style={{ fontFamily: P.fontMono }}>{body && (body.tried || []).join(', ')}</code> in <code style={{ fontFamily: P.fontMono }}>{TOK.store}</code> and none is defined.
                </div>
                <div style={{ fontSize: P.type.meta, color: P.ink2, marginTop: 8, lineHeight: 1.55, padding: '8px 10px', background: P.surface, borderRadius: P.r8 }}>
                  <strong>candidates is null, not an empty list.</strong> {body && body.candidates_note}
                </div>
                {body && body.would_have &&
                  <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 8, lineHeight: 1.5 }}>What you lost: {body.would_have}</div>}
              </Card>}

            {!busy && !refused && res && !res.ok &&
              <ErrorState style={{ marginTop: 10 }} compact
                title={'GET /api/brands/candidates answered HTTP ' + (res.code || 'nothing')}
                body="That route is how this picker searches their 3,255 brands. It is not a report that Weedmaps has no such brand — no search ran."
                detail={res.netError || res.raw}
                onRetry={function () { search(q); }} />}

            {/* THE MATCHER'S VERDICT for this brand. Separate from the search
                below, and it renders even when `candidates` is empty — an
                accepted tier-1 match returns [] and that is not "nothing
                found". */}
            {!busy && proposal &&
              <Card density="compact" style={{ marginTop: 14, background: P.surface2 }}>
                <Eyebrow>What the matcher says about {proposal.our_name || row.ourName}</Eyebrow>
                {proposal.wm_brand_id != null
                  ? <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink }}>{proposal.wm_name}</div>
                      <div style={{ fontFamily: P.fontMono, fontSize: P.type.meta, color: P.inkDim, marginTop: 3 }}>
                        wm_brand_id {proposal.wm_brand_id} &middot; tier {proposal.tier == null ? '—' : proposal.tier} &middot; {proposal.confidence == null ? 'not scored' : Number(proposal.confidence).toFixed(4)} &middot; {proposal.reason}
                      </div>
                      {proposal.runner_up
                        ? <div style={{ fontSize: P.type.meta, color: P.ink2, marginTop: 6 }}>
                            chosen over <strong>{proposal.runner_up.name}</strong> (wm_brand_id {proposal.runner_up.id}) at {Number(proposal.runner_up.confidence).toFixed(4)} &mdash; a margin of {(Number(proposal.confidence) - Number(proposal.runner_up.confidence)).toFixed(4)}
                          </div>
                        : <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 6 }}>
                            No runner-up was returned: this tier accepted the candidate outright rather than choosing between two.
                          </div>}
                      <PBtn size="sm" style={{ marginTop: 10 }}
                        variant={pick && pick.id === proposal.wm_brand_id ? 'primary' : 'secondary'}
                        onClick={function () { setPick({ id: proposal.wm_brand_id, name: proposal.wm_name }); }}>
                        {pick && pick.id === proposal.wm_brand_id ? 'Picked' : 'Pick this'}
                      </PBtn>
                    </div>
                  : <div style={{ fontSize: P.type.meta, color: P.ink2, marginTop: 8, lineHeight: 1.55 }}>
                      The matcher proposes <strong>nothing</strong> for this brand &mdash; state <code style={{ fontFamily: P.fontMono }}>{proposal.state}</code>, reason <code style={{ fontFamily: P.fontMono }}>{proposal.reason}</code>.
                      That is a verdict, not a failure. Search their index below and set the id by hand.
                    </div>}
              </Card>}

            {/* THE MATCH IS RIGHT AND THE BIND STILL CANNOT HAPPEN. Rendered
                immediately under the verdict, because it is the verdict that
                makes the button look available. Saying it here rather than in
                the 409 is the whole fix: the operator learns it by reading,
                not by pressing something that cannot work. */}
            {!busy && cannotWrite &&
              <Card density="compact" style={{ marginTop: 14, background: P.warnSoft, borderColor: P.warn }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Icon name="ban" size={15} stroke={2} color={P.warn} />
                  <span style={{ fontSize: P.type.strong, fontWeight: 700, color: P.warn }}>
                    Nothing here can be bound to {row.ourName}
                  </span>
                </div>
                <div style={{ fontSize: P.type.meta, color: P.ink2, marginTop: 6, lineHeight: 1.55 }}>
                  {writeBlock ? writeBlock.reason
                    : 'wmdemo/brands.py reports this brand cannot be bound, without a reason.'}
                </div>
                {proposal && proposal.wm_brand_id != null &&
                  <div style={{ fontSize: P.type.meta, color: P.ink2, marginTop: 8, lineHeight: 1.55, padding: '8px 10px', background: P.surface, borderRadius: P.r8 }}>
                    <strong>The match above is not wrong.</strong> Weedmaps really does have
                    {' '}<strong>{proposal.wm_name}</strong> at <code style={{ fontFamily: P.fontMono }}>wm_brand_id {proposal.wm_brand_id}</code>,
                    {' '}and {proposal.confidence == null ? 'the matcher accepted it' : Number(proposal.confidence).toFixed(4) + ' is the score it earned'}.
                    {' '}What is missing is on <em>our</em> side, not theirs.
                  </div>}
                <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 8, lineHeight: 1.5 }}>
                  This name reaches the screen from <code style={{ fontFamily: P.fontMono }}>shared/brands.js</code>,
                  the POS design roster. The bind roster is derived from the brands that appear on products,
                  and those two sets are not the same.
                </div>
              </Card>}

            {/* The list the VERDICT above was drawn from. Empty is meaningful
                here and is never dressed up as a search result. */}
            {!busy && proposal && propCands && propCands.length > 0 &&
              <CandList list={propCands} label={'Candidates the verdict was drawn from'}
                note={'Every row the matcher weighed for ' + (proposal.our_name || row.ourName) + ', in its own order. The margin between the top two is the whole review: "we chose A at 0.79 over B at 0.69" can be disagreed with; "0.79" cannot.'} />}

            {!busy && proposal && propCands && propCands.length === 0 &&
              <div style={{ marginTop: 12, padding: '10px 12px', background: P.highlightSoft, borderRadius: P.r10, fontSize: P.type.meta, color: P.ink2, lineHeight: 1.55 }}>
                The matcher returned <strong>no candidate list</strong> for this brand &mdash; <code style={{ fontFamily: P.fontMono }}>candidates: []</code> alongside the verdict above.
                An empty list here does <em>not</em> mean nothing scored; it means the verdict did not need a field to choose from. Use the search to see what its index actually holds.
              </div>}

            {/* WHAT THE OPERATOR TYPED, scored over all 3,255. */}
            {!busy && searchCands && searchCands.length > 0 &&
              <CandList list={searchCands}
                label={'Searching their ' + ((body && body.index_size) || 3255).toLocaleString() + ' for "' + searchTerm + '"'}
                note={'Winners AND losers, so the margin is visible. ' + searchCands.length + ' returned.'} />}

            {!busy && searchCands && searchCands.length === 0 &&
              <EmptyState style={{ marginTop: 10 }} compact icon="search"
                title={'Nothing in their index scored for "' + searchTerm + '"'}
                body="A search ran over the whole Weedmaps brand index and no candidate cleared the confidence floor. That is a real answer and it is different from a failure." />}

            {traps && Object.keys(traps).length > 0 &&
              <Card density="compact" style={{ marginTop: 16, background: P.highlightSoft }}>
                <Eyebrow>Names that mis-map, carried from the catalogue&rsquo;s own field notes</Eyebrow>
                <div style={{ marginTop: 8 }}>
                  {Object.keys(traps).filter(function (k) { return /^\d+$/.test(k); }).map(function (k) { return (
                    <div key={k} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5 }}>
                      <span style={{ fontFamily: P.fontMono, color: P.inkMute, flex: '0 0 auto' }}>{k}</span>
                      <span>{traps[k]}</span>
                    </div>); })}
                </div>
              </Card>}
          </div>

          <div style={{ padding: '14px 22px', borderTop: '1px solid ' + P.hairline2, background: P.surface2 }}>
            {writeOut && writeOut.done &&
              <div style={{ marginBottom: 10, padding: '9px 11px', borderRadius: P.r8,
                background: writeOut.r && writeOut.r.ok ? P.goodSoft : P.badSoft,
                color: writeOut.r && writeOut.r.ok ? P.good : P.bad, fontSize: P.type.meta, lineHeight: 1.5 }}>
                <strong>{writeOut.label}</strong> &mdash; HTTP {writeOut.r ? writeOut.r.code : '?'}.
                {' '}{writeOut.r && writeOut.r.ok ? 'Recorded.' : (writeOut.r && writeOut.r.error) || 'no reason given'}
                {writeOut.r && writeOut.r.hint && <div style={{ color: P.ink2, marginTop: 4 }}>{writeOut.r.hint}</div>}
              </div>}
            {/* EVERY WRITE IN THIS FOOTER NEEDS THE SAME ROW, so all three are
                gated, not just the bind. `reject` is the reason it must be all
                three: measured on a scratch DB 2026-08-27, POST
                /api/brands/reject {brand:'cann'} answers HTTP 200 with
                result:null -- an UPDATE that matched no row. The renderer above
                keys its green "Recorded." banner off r.ok, so a decision that
                was never stored reads as one that was. A silent no-op reported
                as success is worse than the 409 that started this. */}
            {cannotWrite &&
              <div style={{ marginBottom: 10, fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5 }}>
                Bind, reject and undo all write to the same brand row, and there is no such row,
                so all three are held. <strong>Reject in particular would answer HTTP 200 having
                changed nothing</strong> &mdash; the one outcome this screen must never show as recorded.
              </div>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <PBtn variant="accent" disabled={!pick || cannotWrite} busy={!!(writeOut && writeOut.pending === 'approve')}
                onClick={function () { write('/api/brands/approve', { brand: row.key, wm_brand_id: pick.id, reviewer: 'admin@hyperwolf.com' }, 'approve'); }}>
                {cannotWrite ? 'Cannot bind — no product carries this brand'
                  : (pick ? 'Bind to ' + pick.name : 'Pick a brand to bind')}
              </PBtn>
              <PBtn disabled={cannotWrite}
                onClick={function () { write('/api/brands/reject', { brand: row.key, reviewer: 'admin@hyperwolf.com', reason: 'no_match' }, 'reject'); }}>
                None of these is my brand
              </PBtn>
              {isMapped(row) &&
                <PBtn variant="ghost" disabled={cannotWrite}
                  onClick={function () { write('/api/brands/unmap', { brand: row.key, reviewer: 'admin@hyperwolf.com', reason: 'manual' }, 'unmap'); }}>
                  Undo this binding
                </PBtn>}
              <div style={{ flex: 1 }} />
              <PBtn variant="ghost" onClick={onClose}>Close</PBtn>
            </div>
          </div>
        </div>
      </div>);
  }

  // ── the 9 fold collisions in their index ────────────────────────────────
  function Collisions({ list }) {
    const P = useP();
    if (!list || !list.length) { return null; }
    return (
      <Card density="roomy" style={{ marginTop: 22 }}>
        <SectionHead level={3} eyebrow="Never auto-resolved"
          title={list.length + ' names in their index collide'}
          subtitle="Two different Weedmaps brands whose names are the same once case and punctuation are folded away. Each must resolve to NOTHING and be shown to a person: picking the lower id, or the first one seen, is a coin flip wearing a confidence score." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))', gap: 10 }}>
          {list.map(function (c) { return (
            <div key={c.folded} style={{ padding: '11px 13px', border: '1px solid ' + P.hairline2, borderRadius: P.r10, background: P.surface2 }}>
              <div style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.inkMute, letterSpacing: '.06em' }}>folds to &ldquo;{c.folded}&rdquo;</div>
              {c.names.map(function (nm, i) { return (
                <div key={c.wm_brand_ids[i]} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', marginTop: 6 }}>
                  <span style={{ fontSize: P.type.body, fontWeight: 600, color: P.ink }}>{nm}</span>
                  <span style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.inkDim }}>{c.wm_brand_ids[i]}</span>
                </div>); })}
              <div style={{ marginTop: 8 }}><Pill kind="bad" size="sm" icon="ban">matcher returns nothing</Pill></div>
            </div>); })}
        </div>
      </Card>);
  }

  // ── the screen ───────────────────────────────────────────────────────────
  window.BrandsScreen = function BrandsScreen() {
    const P = useP();
    const [http, setHttp] = React.useState(null);
    const [backfill, setBackfill] = React.useState(null);
    const [tick, setTick] = React.useState(0);
    const [q, setQ] = React.useState('');
    const [only, setOnly] = React.useState('all');
    const [picking, setPicking] = React.useState(null);
    const [bfState, setBfState] = React.useState(null);

    React.useEffect(function () {
      let dead = false;
      setHttp(null);
      getJSON('/api/brands?products=1').then(function (r) { if (!dead) { setHttp(r); } });
      getJSON('/api/brands/backfill').then(function (r) { if (!dead) { setBackfill(r); } });
      return function () { dead = true; };
    }, [tick]);

    const data = http && http.parsed ? http.body : null;
    const mapBySku = React.useMemo(mappedBySku, [tick, http]);
    const rows = React.useMemo(function () { return buildRows(data, mapBySku); }, [data, mapBySku]);

    const shown = rows.filter(function (r) {
      if (only === 'unmapped' && isMapped(r)) { return false; }
      if (only === 'mapped' && !isMapped(r)) { return false; }
      if (only === 'trap' && !(r.wmCount === 0 || r.wmPullOk === 0 || r.collision ||
        r.nameTrap || r.claimConflict || r.storeVsProducts)) { return false; }
      if (!q) { return true; }
      const t = q.toLowerCase();
      return String(r.ourName || '').toLowerCase().indexOf(t) > -1 ||
             String(r.wmName || '').toLowerCase().indexOf(t) > -1 ||
             String(r.wmId || '').indexOf(t) > -1;
    });

    const tally = rows.reduce(function (a, r) {
      a.total++;
      if (isMapped(r)) { a.mapped++; } else { a.unmapped++; a.blocked += r.skuCount; }
      // `pulled` is counted separately from `empty` on purpose. Without it a
      // screen where NOBODY has read a single Weedmaps feed shows "0 empty
      // brands", which reads as "we checked and none are empty" — the exact
      // conflation of "never asked" with "asked and got zero" that this tab
      // exists to break.
      if (isMapped(r) && r.wmCount != null) { a.pulled++; if (r.wmCount === 0) { a.empty++; } }
      a.skus += r.skuCount;
      // ONLY mapped brands, because the tile is labelled "our SKUs on mapped
      // brands". Summing every row would fold the unreachable SKUs into the
      // denominator and quietly turn "0 of 109 behind mapped brands" into a
      // different, softer claim about the whole catalogue.
      if (r.mapped != null && isMapped(r)) { a.linked += r.mapped; a.known += r.skuCount; }
      return a;
    }, { total: 0, mapped: 0, unmapped: 0, empty: 0, pulled: 0, blocked: 0, skus: 0, linked: 0, known: 0 });

    const idxCount = data && data.wm_index && data.wm_index.ok ? data.wm_index.count : null;

    const columns = [
      { label: 'Our brand', key: 'ourName', width: '25%', render: function (r) {
        return (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: P.type.strong, fontWeight: 600, color: P.ink }}>{r.ourName}</div>
            <div style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.inkMute, marginTop: 2 }}>{r.key}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
              {r.from.store && <Pill kind="dark" size="sm">stored</Pill>}
              {r.from.catalogue && <Pill kind="neutral" size="sm">catalogue</Pill>}
              {r.from.posdb && <Pill kind="neutral" size="sm">POS brand DB</Pill>}
            </div>
            {r.variants && r.variants.length > 0 &&
              <div style={{ fontSize: P.type.micro, color: P.warn, marginTop: 4 }}>
                our catalogue also spells this {r.variants.join(', ')}
              </div>}
          </div>);
      } },
      { label: 'State', width: '13%', render: function (r) {
        const v = verdict(r);
        return <span title={v.why}><Pill kind={v.kind} size="sm" dot>{v.label}</Pill></span>;
      } },
      { label: 'Weedmaps brand', width: '25%', render: function (r) {
        if (r.collision) {
          return (
            <div>
              <div style={{ fontSize: P.type.meta, color: P.bad, fontWeight: 600 }}>refuses to guess</div>
              {r.collision.names.map(function (nm, i) { return (
                <div key={r.collision.wm_brand_ids[i]} style={{ fontSize: P.type.micro, color: P.ink2, marginTop: 2 }}>
                  <span style={{ fontFamily: P.fontMono, color: P.inkMute }}>{r.collision.wm_brand_ids[i]}</span> {nm}
                </div>); })}
            </div>);
        }
        if (!isMapped(r)) {
          // A brand with 0 SKUs behind it is NOT blocking anything today, and
          // saying "its 0 SKUs can never enter the candidate pool" would dress
          // a dormant row up as an outage. Two different sentences.
          return (
            <div style={{ fontSize: P.type.meta, color: P.inkDim, lineHeight: 1.45, maxWidth: 300 }}>
              <span style={{ color: r.skuCount ? P.bad : P.inkDim, fontWeight: 600 }}>No wm_brand_id.</span>{' '}
              {r.skuCount
                ? <span>Weedmaps serves products per brand, so this brand has no feed and its {r.skuCount} SKU{r.skuCount === 1 ? '' : 's'} can never enter the candidate pool.</span>
                : <span>Nothing is stranded behind it yet — no product in this catalogue names this brand. Map it before one does.</span>}
            </div>);
        }
        return (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: P.type.body, fontWeight: 600, color: P.ink, wordBreak: 'break-word' }}>{r.wmName || <span style={{ color: P.bad }}>id not in the index</span>}</div>
            <div style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.inkDim, marginTop: 2 }}>wm_brand_id {r.wmId}</div>
            {r.confidence != null &&
              <div style={{ fontSize: P.type.micro, color: P.inkMute, marginTop: 3 }}>
                tier {r.tier} &middot; {Number(r.confidence).toFixed(4)}
                {r.runnerUp ? ' · over ' + r.runnerUp.name + ' at ' + Number(r.runnerUp.confidence).toFixed(4) : ''}
              </div>}
            {r.wmFromPosDb &&
              <div style={{ fontSize: P.type.micro, color: P.inkMute, marginTop: 3, lineHeight: 1.4 }}>
                id from shared/brands.js, not from the API &mdash; nothing has pulled this brand&rsquo;s feed
              </div>}
            {r.nameTrap && <div style={{ fontSize: P.type.micro, color: P.warn, marginTop: 4, lineHeight: 1.4 }}>{r.nameTrap}</div>}
            {r.storeVsProducts &&
              <div style={{ fontSize: P.type.micro, color: P.bad, marginTop: 4, lineHeight: 1.4 }}>
                the store says {r.storeVsProducts.store}, our product rows say {r.storeVsProducts.products}
              </div>}
            {r.claimConflict && r.claimConflict.length > 0 &&
              <div style={{ fontSize: P.type.micro, color: P.bad, marginTop: 4, lineHeight: 1.4 }}>
                also claimed by {r.claimConflict.join(', ')} &mdash; at most one is right
              </div>}
          </div>);
      } },
      { label: 'Their feed', width: '13%', render: function (r) { return <WmMeta r={r} />; } },
      { label: 'Our SKUs → mapped', width: '16%', render: function (r) { return <SkuPair r={r} />; } },
      { label: '', width: 96, align: 'right', render: function (r) {
        // NOT `accent`. One accent per view (POS-Admin/CLAUDE.md design rule 1),
        // and it is spent on the single binding action inside the picker.
        return <PBtn size="xs" variant={isMapped(r) ? 'ghost' : 'secondary'} onClick={function () { setPicking(r); }}>{isMapped(r) ? 'Review' : 'Map'}</PBtn>;
      } }
    ];

    return (
      <div>
        <SectionHead level={1} eyebrow="Our brand DB ↔ Weedmaps brand DB"
          title="Brands"
          subtitle="The layer upstream of product mapping. Every product Weedmaps holds is reached through its brand, so a brand we have not mapped is a brand whose products we can never match."
          action={<PBtn icon="refresh" onClick={function () { setTick(tick + 1); }}>Reload</PBtn>} />

        <Explainer />

        {http && <SourceBanner http={http} data={data} backfill={backfill}
          backfillState={bfState}
          onBackfill={function () {
            // apply MUST be explicit — the route's default is a dry run, and a
            // button that silently relied on that default would be one edit
            // away from writing when it claimed to preview.
            setBfState('pending');
            post('/api/brands/backfill', { apply: true }).then(function (r) {
              // The server's OWN counts, not a sentence of ours about them.
              const rb = r.body || {};
              setBfState({ ok: r.ok, code: r.code, error: r.error,
                bound: rb.would_bind_count, held: rb.held_back_count });
              if (r.ok) { setTick(function (t) { return t + 1; }); }
            });
          }} />}

        {!http && <div style={{ marginBottom: 18 }}><SkeletonRows rows={3} /></div>}

        {http && !http.ok &&
          <ErrorState
            title={'GET /api/brands answered HTTP ' + (http.code || 'nothing at all')}
            body={'This deployment does not serve the brand routes. That is not a report that we have no brands — nothing looked. The rows below are our own brand DB (shared/brands.js) with every Weedmaps column blank, which is exactly what an unmapped estate looks like.'}
            detail={http.netError || http.raw || http.url}
            onRetry={function () { setTick(tick + 1); }}
            style={{ background: P.badSoft, borderRadius: P.r12, marginBottom: 18 }} />}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))', gap: 12, marginBottom: 18 }}>
          <KPI label="Our brands" value={tally.total} sublabel={(tally.mapped) + ' mapped · ' + tally.unmapped + ' not'} icon="database" />
          <KPI label="SKUs behind unmapped brands" value={tally.blocked}
            sublabel={tally.blocked ? 'unreachable by the matcher'
              : tally.unmapped ? 'the ' + tally.unmapped + ' unmapped brands hold no SKUs here'
              : 'every brand is mapped'}
            icon="ban" />
          <KPI label="Their brand index" value={idxCount == null ? '—' : idxCount.toLocaleString()}
            sublabel={idxCount == null ? 'index did not load' : 'brands, every page'} icon="package" />
          <KPI label="Mapped · 0 products" value={tally.pulled ? tally.empty : '—'}
            sublabel={tally.pulled
              ? 'of ' + tally.pulled + ' feed' + (tally.pulled === 1 ? '' : 's') + ' actually read'
              : 'no brand feed has been read successfully — not the same as zero'}
            icon="alert" />
          <KPI label="Our SKUs on mapped brands" value={tally.known ? tally.linked + ' / ' + tally.known : '—'}
            sublabel={tally.known ? 'reached a WM product' : 'product mapping not loaded'} icon="link" />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', maxWidth: 380 }}>
            <Field icon="search" placeholder="Filter our brands, their names, or a wm_brand_id…" value={q} onChange={function (e) { setQ(e.target.value); }} />
          </div>
          <Tabs value={only} onChange={setOnly} options={[
            { value: 'all', label: 'All ' + rows.length },
            { value: 'unmapped', label: 'Not mapped ' + tally.unmapped },
            { value: 'mapped', label: 'Mapped ' + tally.mapped },
            { value: 'trap', label: 'Needs a person' }
          ]} />
        </div>

        {rows.length === 0
          ? <EmptyState icon="database" title="No brand rows to show"
              body={data
                ? 'The API answered and had nothing to group: ' + ((data.products_with_no_brand_name || []).length) + ' of our products carry an empty brand_name, so no brand can be derived from them. This is not “no brands exist” — it is “our products do not say”.'
                : 'Neither the API nor shared/brands.js gave us a brand list.'} />
          : <DataTable columns={columns} rows={shown} rowKey={function (r) { return r.key; }} stickyHead />}

        {shown.length === 0 && rows.length > 0 &&
          <div style={{ marginTop: -1 }}>
            <EmptyState compact icon="filter" title="No brand matches this filter"
              body={rows.length + ' brand rows are loaded; none of them matches what you typed.'} />
          </div>}

        <Collisions list={(data && data.index_collisions) || []} />

        {data && data.products_with_no_brand_name && data.products_with_no_brand_name.length > 0 &&
          <Card density="roomy" style={{ marginTop: 22 }}>
            <SectionHead level={3} eyebrow="Below the brand layer"
              title={data.products_with_no_brand_name.length + ' of our products name no brand at all'}
              subtitle="These carry an empty brand_name, so they sit under no brand row and no brand mapping can ever reach them. They are a third failure, one level below an unmapped brand." />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {data.products_with_no_brand_name.slice(0, 60).map(function (s) {
                return <span key={s} style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.ink2, padding: '3px 7px', background: P.surface3, borderRadius: P.r8 }}>{s}</span>;
              })}
              {data.products_with_no_brand_name.length > 60 &&
                <span style={{ fontSize: P.type.micro, color: P.inkMute, alignSelf: 'center' }}>+{data.products_with_no_brand_name.length - 60} more</span>}
            </div>
          </Card>}

        {picking && <Picker row={picking} onClose={function () { setPicking(null); }}
          onChanged={function () { setTick(tick + 1); }} />}
      </div>);
  };
})();
