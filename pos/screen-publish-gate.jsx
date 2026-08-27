// ── pos/screen-publish-gate.jsx ── the Publish gate ────────────────────────
// WHICH OF OUR INVENTORY LOCATIONS DECIDE WHAT A WEEDMAPS MENU PUBLISHES.
// Self-wrapping IIFE: it declares NOTHING at top level, so it cannot clobber
// another file's globals (see test/global-collisions.test.mjs). Its only export
// is window.PublishGateScreen.
//
// Reads  GET /api/state                      (menu_plan, wmids)
//        GET /api/inventory/gate?menu=&channel=      × 3, one per channel
//        GET /api/inventory/gate/preview?menu=&channel=
//        GET /api/inventory/locations
// Writes through window.HW_LIVE.post (the one token-aware POST path):
//        /api/inventory/bind · /unbind · /gate/arm · /gate/disarm
//        /api/inventory/locations · /locations/update
//
// Degrades by NAMING the route that failed. A 404 never renders as "no
// locations": an absent route and an empty table are different facts, and the
// difference is the whole subject of this screen.
;(function () {
  'use strict';
  const useP = window.useP;

  // ── WHY THIS SCREEN EXISTS ────────────────────────────────────────────────
  //
  // BINDING IS CONFIGURATION. ARMING IS A DECISION. And the boolean the API
  // still carries lies about both, in both directions.
  //
  // Three conflations this screen exists to prevent, each verified over HTTP
  // against a copy of the production database:
  //
  //   1. `switch: true` on an UNBOUND channel means *nobody ever configured
  //      this* (switch_source 'default'). `switch: true` on an ENFORCED
  //      channel means *this is live* (switch_source 'declared'). Same
  //      boolean. A UI rendering the toggle alone shows an unconfigured
  //      channel as ON. There is deliberately NO toggle on this screen —
  //      window.Switch exists in pos/atoms.jsx and is banned here.
  //
  //   2. `state: "staged"` covers TWO situations that render identically on
  //      the state field alone: bound to an active location (ready to arm) and
  //      bound only to INACTIVE locations (arm refuses, forever, with code
  //      all_bindings_inactive). Only `active_bindings` separates them.
  //
  //   3. `blocked_no_stock` merges *nothing is bound to this channel* with
  //      *the bound locations hold no stock*. The operator's next move differs
  //      — bind a location vs. move stock — so this screen splits the bucket
  //      on the reason prefix, which IS in the data.
  //
  // THE ROUTING QUESTION IS NOT ANSWERED HERE. Which channel a menu actually
  // publishes through is engine._channel_for's answer, served as
  // `channel_for_mode`. A second copy of that mapping written in a screen file
  // would drift, and the drift would surface as a channel silently
  // re-labelling itself — the same sin pos/screen-brands.jsx refuses to commit
  // with brand names. When the field is null this screen says the question is
  // unanswered and names the route that could not answer it. It never guesses.

  // inventory.CHANNELS, in order. Not derived from a response: the screen must
  // render three cards even when a gate read fails, or a failed read would
  // look like a channel that does not exist.
  const CHANNELS = ['pickup', 'express', 'scheduled'];
  const KINDS = ['safe', 'kit', 'counter'];          // inventory.KINDS, exactly
  const ROW_CAP = 25;                                // per blocked group

  function base() {
    try { if (window.HW_LIVE && window.HW_LIVE.base) { return window.HW_LIVE.base; } } catch (e) {}
    return window.location.origin;
  }

  function canWrite() {
    try { return !!(window.HW_LIVE && typeof window.HW_LIVE.post === 'function'); } catch (e) { return false; }
  }

  // Every GET answers the SAME shape, so a caller can never confuse "the route
  // is not there" (code 404) with "the route said there is nothing" (200, []),
  // nor either of those with "we could not ask" (code 0).
  function getJSON(path) {
    const url = base() + path;
    return fetch(url, { credentials: 'omit', cache: 'no-store' }).then(function (res) {
      return res.text().then(function (txt) {
        let body = null, parsed = false;
        try { body = JSON.parse(txt); parsed = true; } catch (e) {}
        return { url: url, code: res.status, ok: res.ok, body: body, parsed: parsed,
          raw: txt.slice(0, 400), at: Date.now() };
      });
    }).catch(function (e) {
      return { url: url, code: 0, ok: false, body: null, parsed: false, raw: '',
        netError: (e && e.message) || 'request failed', at: Date.now() };
    });
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
      return res.json().then(function (j) {
        return { ok: res.ok, code: res.status, body: j, url: url,
          error: (j && (j.error || j.why)) || ('HTTP ' + res.status) };
      }, function () {
        return { ok: res.ok, code: res.status, body: null, url: url,
          error: 'HTTP ' + res.status + ' (body was not JSON)' };
      });
    }).catch(function (e) {
      return { ok: false, code: 0, body: null, url: url,
        error: 'request failed: ' + ((e && e.message) || 'unknown') };
    });
  }

  function hhmmss(ms) {
    if (!ms) { return '—'; }
    try { return new Date(ms).toLocaleTimeString(); } catch (e) { return String(ms); }
  }
  function stamp(sec) {
    if (sec == null) { return '—'; }
    try { return new Date(sec * 1000).toLocaleTimeString(); } catch (e) { return String(sec); }
  }
  function plural(n, one, many) { return n === 1 ? one : (many || one + 's'); }

  // ── situation(g) — the ONE function that decides what a card says ─────────
  //
  // ORDER MATTERS, the same rule as screen-brands.jsx:verdict. A later test
  // would mask an earlier lie: stale_declaration is tested FIRST because it is
  // the only situation in which `state` itself is actively misleading, and the
  // active/inactive split is tested before the plain staged case because they
  // are indistinguishable on `state`.
  //
  // Returns {kind, label, why, canArm, canEdit}. `why` is never optional. A
  // state that renders as a bare token with no sentence has told the operator
  // a word, not a fact.
  function situation(g) {
    const act = (g.active_bindings || []).length;
    const inact = (g.inactive_bindings || []).length;

    if (g.stale_declaration === true) {
      return { kind: 'bad', label: 'switch and state disagree', canArm: false, canEdit: true,
        why: 'The gate row for this channel says armed and no location is bound to it. `state` reads ' +
             (g.state || 'unbound') + ' and `switch` reads true; they contradict each other and this screen will not ' +
             'pick a winner for you. Binding a location forces the switch off and re-stages the channel — that is ' +
             'bind_channel’s deliberate behaviour for exactly this case. Disarm does the same without binding anything.' };
    }
    if (g.state === 'unbound' && !g.declared) {
      return { kind: 'neutral', label: 'not configured', canArm: false, canEdit: true,
        why: 'No location has ever been bound here and nobody has ever touched this channel’s switch. It reads ' +
             '`switch: true` — that is the compatibility default (`switch_source: default`), not somebody arming it. ' +
             'This channel publishes from catalog stock and the product price, exactly as every unconfigured menu does.' };
    }
    if (g.state === 'unbound' && g.declared) {
      return { kind: 'info', label: 'unbound · switch declared', canArm: false, canEdit: true,
        why: 'Somebody has set this channel’s switch (`switch_source: declared`, last by ' +
             (g.actor || 'an unrecorded actor') + ' at ' + stamp(g.updated_at) + ') and nothing is bound to it now. ' +
             'It is not enforcing anything. Bind a location to stage it.' };
    }
    if (g.state === 'staged' && act > 0) {
      return { kind: 'warn', label: 'staged — not live', canArm: true, canEdit: true,
        why: act + ' ' + plural(act, 'location') + ' bound, gate off. Publishing has not changed: this channel still ' +
             'ships from catalog stock at the product price. Nothing you bind here touches a live menu until you arm ' +
             'it — which is why you can build the mapping up over days.' };
    }
    if (g.state === 'staged' && act === 0) {
      return { kind: 'bad', label: 'staged — arm will refuse', canArm: false, canEdit: true,
        why: 'Bound only to inactive ' + plural(inact, 'location') + ': ' + (g.inactive_bindings || []).join(', ') +
             '. Arming would enforce a gate over zero stock, so POST /api/inventory/gate/arm refuses it with code ' +
             '`all_bindings_inactive` — and will refuse every time, until a location is reactivated or an active one ' +
             'is bound. Arm is disabled here because the server will not do it, not because this screen is being careful.' };
    }
    // ── ENFORCED, AND NOBODY EVER DECIDED IT ──────────────────────────────
    //
    // THE MIRROR OF THE FAIL-OPEN TRAP, AND THE SAME SIN.
    // Everywhere else this screen refuses to print `switch` without
    // `switch_source`, because true-from-the-default and true-from-a-person are
    // different facts. That split also exists on `state`, and it is easier to
    // miss: gate_status computes state from `enf`, and inventory._enforced()
    // returns TRUE for an ABSENT channel_gate row. set_channel_map() — the
    // primitive every seed, probe and legacy caller uses — writes no gate row
    // at all, and says so itself: "on a channel with no channel_gate row it
    // arms the gate on contact, as it always has".
    //
    // The result is a channel that is genuinely LIVE — locations_for() hands
    // the publish path its locations and publish_view decides price and
    // quantity for every sku — with declared:false, actor:null, updated_at:null.
    // Re-derived in-process against a scratch COPY of the production database
    // (never the repo file):
    //
    //   set_channel_map(<menu>, 'pickup', 'wf3-safe')
    //     -> state 'enforced', switch true, switch_source 'default',
    //        declared false, actor null, updated_at null
    //     -> locations_for(<menu>, 'pickup') == ['wf3-safe']   (the gate is ON)
    //
    // Rendered as the plain green "enforced — live", that card says "the gate
    // decides what publishes" and attributes the decision to nobody, on a
    // screen whose entire argument is that arming is a deliberate act. It is
    // `warn`, not `good` — not because enforcing is wrong, but because a live
    // decision with no one behind it is the thing an operator came here to see.
    if (g.state === 'enforced' && !g.declared) {
      return { kind: 'warn', label: 'enforced — nobody armed it', canArm: false, canEdit: false,
        why: 'The gate IS deciding what publishes here — ' + act + ' active ' + plural(act, 'location') + ': ' +
             (g.active_bindings || []).join(', ') + ' — and no operator ever armed it. There is no `channel_gate` row ' +
             'for this channel (`declared: false`, `switch_source: default`, no actor, no timestamp), and an absent ' +
             'row reads as enforced: the binding was written by `set_channel_map`, the primitive, which arms the gate ' +
             'on contact. This is not the same fact as a channel somebody decided to arm, and this screen will not ' +
             'print it as one. Disarm writes the row at `enforced: 0`, keeps every binding, and returns this channel ' +
             'to catalog stock at the product price — after which arming it is a decision with a name and a time on it.' };
    }
    if (g.state === 'enforced') {
      return { kind: 'good', label: 'enforced — live', canArm: false, canEdit: false,
        why: 'The gate decides what publishes on this channel. ' + act + ' active ' + plural(act, 'location') + ': ' +
             (g.active_bindings || []).join(', ') + '. While it is on, bind and unbind refuse with `channel_enforced`, ' +
             'and deactivating one of these locations refuses with `would_shrink_enforced_scope`. To change the ' +
             'mapping: disarm → bind → preview → arm.' };
    }
    // Not reachable against a gate_status this screen understands. Say so
    // rather than falling through to a friendly-looking default: an
    // unrecognised state is a claim nobody has made.
    return { kind: 'bad', label: 'state not recognised', canArm: false, canEdit: false,
      why: 'The gate returned state=' + JSON.stringify(g.state) + ', which this screen has no rendering for. It is ' +
           'not being treated as unbound, staged or enforced, because guessing which one would be a fabrication.' };
  }

  // ── armConsequence(g, s, channel) — what arming would ACTUALLY do ────────
  //
  // THIS EXISTS BECAUSE THE ROUTING BANNER PRINTED A FALSEHOOD.
  // The first cut said "Arming <channel> will succeed and change nothing about
  // what ships" on EVERY channel whose channel_for_mode !== channel — a pure
  // function of mode / channel_for_mode / channel that never consulted the
  // gate's own state. Two of the three cards carried it on first load and both
  // were wrong:
  //
  //   unbound   POST /api/inventory/gate/arm answers 409 code=`unbound`.
  //             The banner promised success directly above the line "Arm is
  //             not offered here: not configured."
  //   staged,   arm answers 409 `all_bindings_inactive` — "and will refuse
  //   0 active  every time" is what the panel two lines ABOVE the banner said.
  //             The screen contradicted itself inside one card.
  //   enforced  future tense about something already done.
  //
  // The ROUTING half of that banner ("this menu publishes through X") is
  // always true and stays. The ARMING half is a claim about a specific server
  // refusal, so it now comes from the same situation() the rest of the card
  // renders — one source, not two.
  //
  // Returns {tone, text} or null when this screen has no defensible claim.
  function armConsequence(g, s, channel) {
    const st = g.state;
    if (g.stale_declaration === true) {
      return { tone: 'bad', text: 'What arming would do here is NOT stated: ' +
        '`switch` and `state` contradict each other on this channel, and a prediction built on either one would be ' +
        'a guess.' };
    }
    if (st === 'enforced') {
      // Deliberately says nothing about WHICH channel publishes: the banner's
      // first sentence already carries that, and this function is called from
      // the no-channel-at-all branch too, where "not the channel" would be an
      // odd thing to say about a mode that maps to no channel.
      //
      // "already ARMED" is a claim about a person, so it may only be made when
      // `declared` says a person is on the row. On an undeclared enforced
      // channel the same sentence would credit an act nobody performed — the
      // identical mistake, one word smaller, that situation() splits above.
      return { tone: 'info', text: (g.declared
          ? 'It is already armed — past tense, not a plan. '
          : 'It is already enforcing, and nobody armed it — there is no gate row, and an absent row reads as ' +
            'enforced. ') +
        'The gate on ' + channel + ' is enforcing, and what it decides does not reach the listing this menu ' +
        'publishes. Disarming it would change nothing about what ships either.' };
    }
    if (st === 'unbound') {
      return { tone: 'warn', text: 'Arming ' + channel + ' is not available: with no location bound, ' +
        'POST /api/inventory/gate/arm answers HTTP 409 code `unbound` — there is nothing to enforce. Bind a ' +
        'location first; that stages it, and staging still changes nothing about what ships.' };
    }
    if (st === 'staged' && (g.active_bindings || []).length === 0) {
      return { tone: 'bad', text: 'Arming ' + channel + ' would REFUSE, not succeed: bound only to inactive ' +
        'locations, POST /api/inventory/gate/arm answers HTTP 409 `all_bindings_inactive` — every time.' };
    }
    if (s.canArm) {
      // THE LAST SURVIVING OVERCLAIM, AND IT WAS THE SAME ONE.
      // This branch used to read "Arming <channel> will succeed and change
      // nothing about what ships." The second half is true and stays. The
      // first half is a promise the server does not make, on the ONE state
      // where the screen still made it. Re-derived in-process on a scratch
      // copy of the production database:
      //
      //   bind_channel(<menu>, 'pickup', <active loc>)  -> state 'staged',
      //     active_bindings ['wf3-safe2']   (this branch, canArm true)
      //   arm_preview(...)['blocked'] == 31
      //   arm_channel(..., confirm_blocked=30)
      //     -> Refused code=confirm_mismatch -> HTTP 409
      //
      // arm_channel recomputes the preview at the instant of the press, so
      // "will succeed" is conditional on a number this screen cannot hold
      // still. Saying so is not timidity — the confirm guard is the feature
      // this screen is built around, and a banner promising a 200 teaches an
      // operator to read its 409 as a fault.
      const act = (g.active_bindings || []).length;
      return { tone: 'info', text: 'Arming ' + channel + ' changes nothing about what ships, and neither of the ' +
        'gate’s two structural refusals applies: ' + act + ' active ' + plural(act, 'location') + ' bound, so ' +
        'not `unbound` and not `all_bindings_inactive`. It is still not a promise of HTTP 200 — `arm_channel` ' +
        'recomputes the preview as you press Arm, and a confirmation that has gone stale in the meantime answers ' +
        'HTTP 409 `confirm_mismatch`. That refusal is the guard doing its job, not a fault.' };
    }
    return null;
  }

  function toneColor(P, kind) {
    return kind === 'good' ? P.good : kind === 'warn' ? P.warn : kind === 'bad' ? P.bad
         : kind === 'info' ? P.info : P.inkMute;
  }
  function toneSoft(P, kind) {
    return kind === 'good' ? P.goodSoft : kind === 'warn' ? P.warnSoft : kind === 'bad' ? P.badSoft
         : kind === 'info' ? P.infoSoft : P.neutralSoft;
  }

  // ── small shared bits ────────────────────────────────────────────────────
  function Code({ children }) {
    const P = useP();
    return <code style={{ fontFamily: P.fontMono, fontSize: P.type.meta, background: P.surface3,
      padding: '1px 5px', borderRadius: P.r8 }}>{children}</code>;
  }

  function Strip({ kind, children, style }) {
    const P = useP();
    return (
      <div style={Object.assign({
        border: '1px solid ' + toneColor(P, kind), background: toneSoft(P, kind),
        borderRadius: P.r10, padding: '10px 12px', fontSize: P.type.meta,
        color: P.ink2, lineHeight: 1.55
      }, style || {})}>{children}</div>);
  }

  // ── the explainer ────────────────────────────────────────────────────────
  // Top of the screen and never collapsed, the same rule screen-brands.jsx
  // follows. Somebody who has never seen this system has to be able to read
  // the argument off the screen.
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
        <Eyebrow>Configuration, and then a decision</Eyebrow>
        <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink, margin: '8px 0 4px', letterSpacing: '-.01em' }}>
          Binding is configuration. Arming is a decision.
        </div>
        <div style={{ fontSize: P.type.body, color: P.ink2, lineHeight: 1.6, maxWidth: 900 }}>
          A menu channel with nothing bound publishes from <strong>catalog stock at the product price</strong>. Binding an
          inventory location to it changes <em>nothing</em> about what ships &mdash; it only <strong>stages</strong> the
          mapping, which is why you can build one up over days. Only <strong>arming</strong> hands the decision to the gate,
          and arming is confirmed against a preview you have actually read.
          {' '}There are <strong>three states</strong> &mdash; <Code>unbound</Code>, <Code>staged</Code>, <Code>enforced</Code> &mdash;
          {' '}and the <Code>switch</Code> boolean tells you which one you are in <em>incorrectly in both directions</em>.
          {' '}This screen renders <Code>state</Code>. It has no toggle.
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {box('Our inventory locations', 'a safe, a driver’s kit, a counter — a real stock ledger', 'us')}
          {arrow('channel_map')}
          {box('The binding', 'one location ↔ one menu channel. Staged until armed.', 'link')}
          {arrow('when armed')}
          {box('One Weedmaps menu channel', 'pickup · express · scheduled', 'them')}
          {arrow('publishes')}
          {box('What actually ships', 'the gate decides price and quantity, or catalog does', 'them')}
        </div>
      </Card>);
  }

  // ── where every number on this screen came from ──────────────────────────
  function SourceBanner({ http, busy, onReload }) {
    const P = useP();
    const line = (icon, kind, text) => (
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 0' }}>
        <span style={{ flex: '0 0 auto', marginTop: 1, color: toneColor(P, kind) }}>
          <Icon name={icon} size={14} stroke={2} />
        </span>
        <span style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5 }}>{text}</span>
      </div>);
    const codeOf = (h) => h ? (h.code === 0 ? 'no response' : 'HTTP ' + h.code) : 'not called yet';
    const kindOf = (h) => !h ? 'neutral' : h.ok ? 'good' : 'bad';
    const gates = CHANNELS.map(function (c) { return (http.gate || {})[c]; }).filter(Boolean);
    const gateWorst = gates.length === 0 ? null
      : (gates.every(function (h) { return h.ok; }) ? 'good' : 'bad');
    return (
      <Card density="compact" style={{ marginBottom: 18, background: P.surface2 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <Eyebrow>Where these numbers come from</Eyebrow>
          <IconBtn icon="refresh" title="Re-read /api/state and all three gates" onClick={onReload} disabled={busy} />
        </div>
        <div style={{ marginTop: 6 }}>
          {line('link', kindOf(http.state),
            <span><Code>GET /api/state</Code> answered <strong>{codeOf(http.state)}</strong>
              {http.state && http.state.netError ? ' — ' + http.state.netError : ''}. Base <Code>{base()}</Code>.
              {' '}It is the source of the menu list and of each menu&rsquo;s <Code>mode</Code>.</span>)}
          {gates.length > 0 && line('shield', gateWorst,
            <span><Code>GET /api/inventory/gate?menu=&amp;channel=</Code>, called <strong>once per channel</strong>
              {' '}({gates.map(function (h) { return h.code === 0 ? 'no response' : h.code; }).join(' · ')}).
              {' '}Three single-channel reads rather than the all-channels form on purpose: the no-channel form
              {' '}returned HTTP 500 on builds before today, and three reads stay correct on the ones where it does not.</span>)}
          {line('vault', kindOf(http.locations),
            <span><Code>GET /api/inventory/locations</Code> answered <strong>{codeOf(http.locations)}</strong>.
              {http.locations && http.locations.code === 404
                ? <span> <strong>That route does not exist on this build.</strong> It is not an empty table &mdash; nothing
                    was asked and nothing answered. Bound locations below can only be rendered as raw ids.</span>
                : <span> It lists every location including inactive ones, which is what lets a channel bound only to an
                    inactive location be explained rather than just refused.</span>}</span>)}
          {http.preview && line('package', kindOf(http.preview),
            <span><Code>GET /api/inventory/gate/preview</Code> for <Code>{http.preview.channel}</Code> answered
              {' '}<strong>{codeOf(http.preview)}</strong> at <strong>{hhmmss(http.preview.at)}</strong>. A preview is held in
              {' '}this screen&rsquo;s memory only &mdash; never cached across a menu change &mdash; because the sku universe
              {' '}moves underneath it.</span>)}
          {!canWrite() && line('lock', 'warn',
            <span><Code>window.HW_LIVE</Code> exposes no write path on this page, so nothing here can be armed, bound or
              {' '}created. <strong>Reads still work</strong> and every number above is real.</span>)}
        </div>
      </Card>);
  }

  // ── the honest field strip ───────────────────────────────────────────────
  // `switch` is NEVER printed without `switch_source` in the same breath, and
  // bindings are always printed as active / inactive rather than as one total,
  // because that split is the only thing separating "ready to arm" from "arm
  // will refuse forever".
  function FieldStrip({ g }) {
    const P = useP();
    const sep = <span style={{ color: P.inkMute, padding: '0 8px' }}>·</span>;
    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ background: P.surface3, border: '1px solid ' + P.hairline2, borderRadius: P.r8,
          padding: '8px 11px', fontFamily: P.fontMono, fontSize: P.type.meta, color: P.ink2,
          overflowX: 'auto', whiteSpace: 'nowrap' }}>
          <span>state <strong style={{ color: P.ink }}>{String(g.state)}</strong></span>{sep}
          <span>switch <strong style={{ color: P.ink }}>{String(g.switch)}</strong> ({g.switch_source || 'unknown source'})</span>{sep}
          <span>bindings <strong style={{ color: P.ink }}>{(g.active_bindings || []).length}</strong> active / <strong style={{ color: P.ink }}>{(g.inactive_bindings || []).length}</strong> inactive</span>{sep}
          <span>set by {g.actor || '—'}, {stamp(g.updated_at)}</span>
        </div>
        <window.DevNote id="gate-switch-inversion" tone="warn" title="`switch: true` does not mean armed">
          <window.DevNoteP>
            Verified over HTTP on one channel of one menu, in this order: unbound &rarr;{' '}
            <window.DevNoteMono>{'{"switch": true, "switch_source": "default", "declared": false}'}</window.DevNoteMono>;
            {' '}after bind &rarr;{' '}
            <window.DevNoteMono>{'{"switch": false, "switch_source": "declared"}'}</window.DevNoteMono>;
            {' '}after arm &rarr;{' '}
            <window.DevNoteMono>{'{"switch": true, "switch_source": "declared"}'}</window.DevNoteMono>.
          </window.DevNoteP>
          <window.DevNoteP>
            So <window.DevNoteMono>switch: true</window.DevNoteMono> covers <strong>both</strong> &ldquo;nobody ever
            configured this&rdquo; <strong>and</strong> &ldquo;this is live&rdquo;, and a UI that rendered the toggle alone
            would show an unconfigured channel as ON &mdash; the opposite direction from the one people expect. Read{' '}
            <window.DevNoteMono>state</window.DevNoteMono>, or read <window.DevNoteMono>switch</window.DevNoteMono> with{' '}
            <window.DevNoteMono>switch_source</window.DevNoteMono> beside it, which is what the line above does. There is
            deliberately no toggle on this screen.
          </window.DevNoteP>
        </window.DevNote>
      </div>);
  }

  // ── the routing banner — four cases, and three of them are not "yes" ─────
  //
  // TWO CLAIMS, TWO SOURCES, AND THEY MUST NOT BE WELDED TOGETHER.
  // The routing claim ("this menu publishes through X") comes from
  // channel_for_mode and is true whatever the gate is doing. The arming claim
  // is a prediction about a specific 409 and comes from armConsequence(),
  // which reads this channel's actual state. The first cut computed the
  // second from the inputs of the first, and printed "arming will succeed"
  // over channels where arm returns 409. See armConsequence's block comment.
  function RoutingBanner({ g, s, channel, planMode }) {
    const P = useP();
    const cfm = g.channel_for_mode;
    const mode = g.mode;
    const cons = armConsequence(g, s, channel);

    if (cfm && cfm === channel) { return null; }   // silence is the positive case

    if (cfm && cfm !== channel) {
      // The strip takes the tone of the ARMING claim, not of the routing one:
      // "arm will refuse forever" is not an info-blue fact.
      return (
        <Strip kind={cons ? cons.tone : 'info'} style={{ marginTop: 10 }}>
          This menu publishes through <strong>{cfm}</strong> (mode <Code>{mode}</Code>), not through
          {' '}<strong>{channel}</strong>.
          {cons ? <span>{' '}{cons.text}</span>
                : <span>{' '}This screen is not predicting what arming <strong>{channel}</strong> would do &mdash;
                    its state is one it has no rendering for.</span>}
        </Strip>);
    }
    if (!cfm && mode) {
      return (
        <Strip kind={cons ? cons.tone : 'warn'} style={{ marginTop: 10 }}>
          The server says mode <Code>{mode}</Code> maps to <strong>no inventory channel at all</strong>, so nothing
          {' '}armed on this menu can reach a listing.
          {cons ? <span>{' '}{cons.text}</span> : null}
        </Strip>);
    }
    // mode === null AND channel_for_mode === null. Two very different reasons,
    // and the screen must not merge them: either this menu genuinely has no
    // plan, or the route cannot answer. /api/state is the tiebreaker.
    return (
      <Strip kind="bad" style={{ marginTop: 10 }}>
        <strong>This build cannot tell you which channel this menu publishes through.</strong>
        {' '}<Code>GET /api/inventory/gate</Code> returned <Code>mode: null</Code> and <Code>channel_for_mode: null</Code>.
        {planMode
          ? <span> That is <strong>not</strong> &ldquo;this menu has no mode&rdquo; &mdash; <Code>GET /api/state</Code> says
              this menu&rsquo;s mode is <strong>{planMode}</strong>. The gate route is failing to answer a question that
              has an answer. On builds before 2026-08-26 the cause was <Code>store.menu_state(menu)</Code> inside the gate
              GET branch: that function takes no arguments, and a bare <Code>except Exception</Code> two lines below
              swallowed the TypeError and wrote <Code>null</Code> into both fields.
              {' '}<strong>So the &ldquo;arming this changes nothing&rdquo; warning is unavailable here.</strong></span>
          : <span> <Code>GET /api/state</Code> has no mode for this menu either, so this may genuinely be a menu nothing
              is planned to. This screen cannot tell those two apart and is not going to pretend it can.</span>}
      </Strip>);
  }

  // ── the bound-locations block ────────────────────────────────────────────
  function BoundLocations({ g, channel, locIndex, locHttp, canEdit, busy, onBind, onUnbind, onDisarm }) {
    const P = useP();
    const [typed, setTyped] = React.useState('');
    const bindings = g.bindings || [];
    const activeSet = {};
    (g.active_bindings || []).forEach(function (id) { activeSet[id] = true; });
    const havePicker = !!(locHttp && locHttp.ok && Array.isArray(locHttp.body));
    const options = havePicker
      ? locHttp.body.filter(function (l) { return bindings.indexOf(l.id) < 0; })
      : [];

    return (
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: P.type.meta, fontWeight: 700, color: P.inkDim, textTransform: 'uppercase',
          letterSpacing: '.08em', marginBottom: 6 }}>Bound locations</div>

        {bindings.length === 0 &&
          <div style={{ fontSize: P.type.meta, color: P.inkMute, padding: '4px 0' }}>
            Nothing is bound to this channel.
          </div>}

        {bindings.map(function (id) {
          const known = locIndex[id] || null;
          const isActive = !!activeSet[id];
          return (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
              borderTop: '1px solid ' + P.hairline }}>
              <span style={{ fontFamily: P.fontMono, fontSize: P.type.body, color: P.ink }}>{id}</span>
              <Pill kind={isActive ? 'good' : 'bad'} size="sm">{isActive ? 'active' : 'inactive'}</Pill>
              {known
                ? <span style={{ fontSize: P.type.meta, color: P.inkDim }}>
                    {known.name} · {known.kind}{known.region ? ' · ' + known.region : ''}
                  </span>
                : <span style={{ fontSize: P.type.micro, color: P.inkMute, maxWidth: 420 }}>
                    id only — <Code>gate_status</Code> returns binding ids with no name, kind or region, and this screen
                    has not seen this id from the locations route.
                  </span>}
              {!isActive &&
                <span style={{ fontSize: P.type.micro, color: P.bad }}>
                  bound, and contributing no stock until it is reactivated.
                </span>}
              <span style={{ flex: 1 }} />
              <PBtn size="xs" disabled={!canEdit || busy || !canWrite()}
                title={canEdit ? 'POST /api/inventory/unbind' : 'unbind refuses with channel_enforced while this channel is live'}
                onClick={function () { onUnbind(id); }}>Unbind</PBtn>
            </div>);
        })}

        {/* THE EDIT CONTROLS. Disabled with the reason ON them when the channel
            is live, plus the affordance that actually unblocks it. An operator
            must not discover a refusal by hitting it — though the 409 handler
            still exists, for the case where state moved underneath. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px', minWidth: 200 }}>
            {havePicker
              ? <select value={typed} disabled={!canEdit || busy || !canWrite()}
                  onChange={function (e) { setTyped(e.target.value); }}
                  style={{ width: '100%', minHeight: 34, padding: '0 10px', background: P.field,
                    border: '1px solid ' + P.fieldBorder, borderRadius: P.r8, color: P.ink,
                    fontFamily: P.fontMono, fontSize: P.type.body }}>
                  <option value="">Bind a location…</option>
                  {options.map(function (l) {
                    return <option key={l.id} value={l.id}>
                      {l.id} — {l.name} ({l.kind}{l.active ? '' : ', inactive'})
                    </option>;
                  })}
                </select>
              : <Field size="sm" mono placeholder="location id" value={typed}
                  onChange={function (e) { setTyped(e.target.value); }}
                  disabled={!canEdit || busy || !canWrite()} />}
          </div>
          <PBtn size="sm" variant="primary" busy={busy}
            disabled={!canEdit || busy || !typed || !canWrite()}
            onClick={function () { onBind(typed); setTyped(''); }}>Bind</PBtn>
          {!canEdit &&
            <PBtn size="sm" busy={busy} disabled={busy || !canWrite()} onClick={onDisarm}>Disarm to edit</PBtn>}
        </div>

        {!canEdit &&
          <div style={{ fontSize: P.type.micro, color: P.inkDim, marginTop: 6 }}>
            <Code>bind</Code> and <Code>unbind</Code> refuse with <Code>channel_enforced</Code> while this channel is live.
            {' '}Editing a live channel is a four-step path: <strong>disarm &rarr; bind &rarr; preview &rarr; arm</strong>.
          </div>}
        {!havePicker && canEdit &&
          <div style={{ fontSize: P.type.micro, color: P.inkDim, marginTop: 6 }}>
            There is no picker because <Code>GET /api/inventory/locations</Code> answered
            {' '}<strong>{locHttp ? (locHttp.code === 0 ? 'no response' : 'HTTP ' + locHttp.code) : 'nothing yet'}</strong>.
            {' '}Type the id exactly; a wrong one refuses with <Code>unknown_location</Code>.
          </div>}
      </div>);
  }

  // ── the blocked-sku lists, split on the reason prefix ────────────────────
  // The API merges "nothing is bound here" and "the bound locations are empty"
  // into one bucket. The operator's next move differs, and the distinction IS
  // in the data — it is the token before the colon in `reason`.
  function BlockedGroup({ title, rows, kind, next }) {
    const P = useP();
    const [all, setAll] = React.useState(false);
    if (!rows.length) { return null; }
    const shown = all ? rows : rows.slice(0, ROW_CAP);
    return (
      <div style={{ marginTop: 10, border: '1px solid ' + P.hairline2, borderRadius: P.r10, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 11px',
          background: toneSoft(P, kind), borderBottom: '1px solid ' + P.hairline2 }}>
          <span style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>{title}</span>
          <span style={{ fontFamily: P.fontMono, fontSize: P.type.meta, color: toneColor(P, kind) }}>({rows.length})</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: P.type.meta, color: P.ink2 }}>next: <strong>{next}</strong></span>
        </div>
        <div style={{ padding: '4px 11px 8px' }}>
          {shown.map(function (r, i) {
            return (
              <div key={(r.sku || i) + ':' + i} title={r.reason || ''}
                style={{ display: 'flex', gap: 10, padding: '4px 0', borderTop: i ? '1px solid ' + P.hairline : 'none' }}>
                <span style={{ flex: '0 0 auto', fontFamily: P.fontMono, fontSize: P.type.meta, color: P.ink }}>{r.sku}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: P.type.micro, color: P.inkDim,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason}</span>
              </div>);
          })}
          {rows.length > ROW_CAP &&
            <div style={{ marginTop: 6 }}>
              <PBtn size="xs" onClick={function () { setAll(!all); }}>
                {all ? 'Show only ' + ROW_CAP : 'Showing ' + ROW_CAP + ' of ' + rows.length + ' — show all'}
              </PBtn>
            </div>}
        </div>
      </div>);
  }

  // ── the refusal panel ────────────────────────────────────────────────────
  // A 409 REPLACES the step it came from. It is never a toast and it never
  // auto-dismisses: it is dismissed by acting, or explicitly. The server's own
  // sentence is rendered verbatim — never rewritten, summarised or truncated.
  // It already names the numbers, the locations and the next call.
  //
  // AND ONE OF THESE REFUSALS IS NOT A FAULT.
  // `confirm_mismatch` is the confirm guard FIRING CORRECTLY: arm_channel
  // recomputes the preview at the instant of the press, and the number the
  // operator typed was measured against a screen that had already moved.
  // Nothing is broken, nothing was lost, and the operator did nothing wrong —
  // the guard just did the only thing it exists to do. Painting it in the same
  // alarm red as `unknown_location` is the identical error this screen refuses
  // on the fail-open band: an alarm on a mechanism that is working. Worse, the
  // panel's own body says "This is the guard working" while its header shouts
  // THE GATE REFUSED in red, so the panel contradicts itself the way the
  // routing banner used to contradict the card around it.
  //
  // So the tone is a function of the code, and `data-gate-refusal-tone` makes
  // that assertable. Every OTHER code stays red: they are states the operator
  // must change something to get out of.
  const REFUSAL_TONE = { confirm_mismatch: 'warn' };
  function RefusalPanel({ ref_, onDismiss, onRepreview, onScrollLocations }) {
    const P = useP();
    const code = ref_.code || 'refused';
    const tone = REFUSAL_TONE[code] || 'bad';
    const EYEBROW = {
      confirm_mismatch: 'The confirmation guard held'
    };
    const HEAD = {
      confirm_mismatch: 'The number you confirmed no longer matches.',
      all_bindings_inactive: 'This channel is bound only to inactive locations.',
      channel_enforced: 'This channel is live. Editing it is a four-step path.',
      would_shrink_enforced_scope: 'That location feeds a live channel.',
      unknown_location: 'No inventory location has that id.'
    };
    return (
      <div data-gate-refusal={code} data-gate-refusal-tone={tone}
        style={{ marginTop: 12, border: '1px solid ' + toneColor(P, tone), background: toneSoft(P, tone),
          borderRadius: P.r10, padding: '12px 13px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: P.type.meta, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase',
            color: toneColor(P, tone) }}>
            {EYEBROW[code] || 'The gate refused'}
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: P.fontMono, fontSize: P.type.meta, color: P.ink2 }}>
            HTTP {ref_.httpCode} · code {code}
          </span>
        </div>
        <div style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink, marginTop: 6 }}>
          {HEAD[code] || 'The server refused this, and told you why.'}
        </div>

        <div style={{ marginTop: 8, background: P.surface3, border: '1px solid ' + P.hairline2, borderRadius: P.r8,
          padding: '9px 11px', fontFamily: P.fontMono, fontSize: P.type.meta, color: P.ink2, lineHeight: 1.55,
          whiteSpace: 'pre-wrap' }}>{ref_.sentence}</div>

        {code === 'confirm_mismatch' &&
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.55 }}>
              This is the guard working. <Code>arm_channel</Code> recomputes the preview at the instant you press Arm, so
              the number you typed was measured against a screen that had already moved.
            </div>
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: '4px 14px',
              alignItems: 'baseline', fontSize: P.type.meta }}>
              <span style={{ color: P.inkDim }}>you confirmed</span>
              <span style={{ fontFamily: P.fontMono, fontWeight: 800, color: P.ink }}>{ref_.confirmed}</span>
              <span style={{ color: P.inkMute }}>typed at {hhmmss(ref_.typedAt)}</span>
              {ref_.corrected != null &&
                <React.Fragment>
                  <span style={{ color: P.inkDim }}>blocked now</span>
                  <span style={{ fontFamily: P.fontMono, fontWeight: 800, color: P.warn }}>{ref_.corrected}</span>
                  {/* THE LABEL IS LOAD-BEARING. `blocked` in the refusal body
                      and `blocked` re-read from a second GET are two different
                      measurements taken at two different instants. These two
                      labels must never be swapped without the source changing. */}
                  <span style={{ color: P.inkMute }}>
                    {ref_.correctedFrom === 'refusal'
                      ? 'from the refusal itself'
                      : 're-read from GET /api/inventory/gate/preview at ' + hhmmss(ref_.correctedAt)}
                  </span>
                </React.Fragment>}
            </div>
            {ref_.corrected == null &&
              <div style={{ fontSize: P.type.micro, color: P.inkDim, marginTop: 8 }}>
                The refusal body carried only the sentence and the code &mdash; no <Code>blocked</Code>, no
                {' '}<Code>preview</Code>. On such a build the route hand-builds <Code>{'{error, code}'}</Code> instead of
                {' '}calling <Code>Refused.as_dict()</Code>, which does carry them. Press <em>Re-read the preview</em>.
              </div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <PBtn size="sm" onClick={onRepreview}>Re-read the preview</PBtn>
              <PBtn size="sm" onClick={onDismiss}>Dismiss</PBtn>
            </div>
            <div style={{ fontSize: P.type.micro, color: P.inkDim, marginTop: 6 }}>
              To arm, type the new number. There is deliberately no <em>arm anyway</em> and no auto-retry with the
              corrected value &mdash; auto-retrying is precisely the behaviour this guard exists to forbid.
            </div>
          </div>}

        {code === 'all_bindings_inactive' &&
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.55 }}>
              Arm was already disabled for this reason. If you got here, a location was deactivated between this
              screen&rsquo;s last read and your press. Reactivate it below, or bind an active one.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <PBtn size="sm" onClick={onRepreview}>Re-read this channel</PBtn>
              <PBtn size="sm" onClick={onScrollLocations}>Go to locations</PBtn>
              <PBtn size="sm" onClick={onDismiss}>Dismiss</PBtn>
            </div>
          </div>}

        {code === 'channel_enforced' &&
          <div style={{ marginTop: 10 }}>
            <ol style={{ margin: '0 0 0 18px', padding: 0, fontSize: P.type.meta, color: P.ink2, lineHeight: 1.7 }}>
              <li><strong>Disarm</strong> — keeps every binding</li>
              <li>bind or unbind</li>
              <li>preview</li>
              <li>arm</li>
            </ol>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <PBtn size="sm" onClick={onDismiss}>Dismiss</PBtn>
            </div>
          </div>}

        {['confirm_mismatch', 'all_bindings_inactive', 'channel_enforced'].indexOf(code) < 0 &&
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <PBtn size="sm" onClick={onDismiss}>Dismiss</PBtn>
          </div>}
      </div>);
  }

  // ── the arm flow: preview, read, confirm ─────────────────────────────────
  function ArmFlow({ g, channel, preview, previewBusy, armBusy, onPreview, onArm }) {
    const P = useP();
    const [typed, setTyped] = React.useState('');

    React.useEffect(function () { setTyped(''); }, [preview && preview.at, channel]);

    if (!preview) {
      return (
        <div style={{ marginTop: 14 }}>
          <PBtn size="sm" variant="primary" busy={previewBusy} disabled={previewBusy}
            onClick={onPreview}>Preview what arming would do</PBtn>
          <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 7, maxWidth: 780, lineHeight: 1.55 }}>
            Arm is gated on a preview. You cannot arm a channel whose blocked list you have not seen &mdash; the server
            enforces this too, and this is the screen&rsquo;s half of it.
          </div>
        </div>);
    }

    const b = preview.body || {};
    const exam = b.skus_examined;
    const pub = b.publishable || [];
    const noPrice = b.blocked_no_price || [];
    const noStock = b.blocked_no_stock || [];
    const blocked = b.blocked;

    // The split the API does not make. Group on the token before the colon.
    const groups = { no_locations: [], no_stock: [], other: [] };
    noStock.forEach(function (r) {
      const pre = String((r && r.reason) || '').split(':')[0].trim();
      if (pre === 'no_locations') { groups.no_locations.push(r); }
      else if (pre === 'no_stock') { groups.no_stock.push(r); }
      else { groups.other.push(r); }
    });

    const typedInt = /^\d+$/.test(typed.trim()) ? parseInt(typed.trim(), 10) : null;
    const armable = typedInt != null && typedInt === blocked;

    return (
      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: P.type.meta, fontWeight: 700, color: P.inkDim, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            What arming would do
          </span>
          <span style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.inkMute }}>
            measured {hhmmss(preview.at)}
          </span>
          <span style={{ flex: 1 }} />
          <PBtn size="xs" busy={previewBusy} disabled={previewBusy} onClick={onPreview}>Re-read</PBtn>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', opacity: previewBusy ? 0.55 : 1 }}>
          <div style={{ flex: '1 1 160px' }}><KPI label="SKUs examined" value={exam}
            sublabel="the menu's whole sku universe, supplied by the route from catalog.products()" /></div>
          <div style={{ flex: '1 1 160px' }}><KPI label="Would publish" value={pub.length}
            sublabel="this channel can ship it" /></div>
          <div style={{ flex: '1 1 160px' }}><KPI label="Blocked · no price" value={noPrice.length}
            sublabel="an in-stock batch has no usable price" /></div>
          <div style={{ flex: '1 1 160px' }}><KPI label="Blocked · no stock" value={noStock.length}
            sublabel="no in-stock batch in the bound locations" /></div>
        </div>
        {previewBusy &&
          <div style={{ fontSize: P.type.micro, color: P.inkMute, marginTop: 5 }}>
            re-reading… the numbers above are the previous measurement, not zeroes.
          </div>}

        <div style={{ marginTop: 12, fontFamily: P.fontMono, fontSize: P.type.h2, fontWeight: 800, color: P.warn }}>
          {blocked} SKU{blocked === 1 ? '' : 's'} would stop publishing on this channel.
        </div>

        <window.DevNote id="gate-blocked-buckets" tone="warn" title="What `blocked` is a measurement of">
          <window.DevNoteP>
            <window.DevNoteMono>publishable + blocked === skus_examined</window.DevNoteMono>, always &mdash; every sku in
            the menu&rsquo;s universe lands in exactly one bucket. What it is <strong>not</strong> is a prediction about
            the menu.
          </window.DevNoteP>
          <window.DevNoteP>
            <window.DevNoteMono>blocked_no_price</window.DevNoteMono> blocks the sku on <strong>every</strong> mode,
            including a nominal storefront listing &mdash; it is a data error, go fix the batch.
            {' '}<window.DevNoteMono>blocked_no_stock</window.DevNoteMono> blocks only on a stock-truth mode
            ({'kits'}, {'pickup'}); a menu on mode <window.DevNoteMono>full</window.DevNoteMono> keeps publishing its
            nominal quantity. <window.DevNoteMono>inventory.py</window.DevNoteMono> cannot see the menu&rsquo;s mode and
            refuses to guess, and neither does this screen.
          </window.DevNoteP>
        </window.DevNote>

        <BlockedGroup kind="bad" title="Blocked · no price" rows={noPrice}
          next="fix the batch price" />
        <BlockedGroup kind="bad" title="Nothing is bound to this channel" rows={groups.no_locations}
          next="bind a location" />
        <BlockedGroup kind="warn" title="The bound locations hold no in-stock batch" rows={groups.no_stock}
          next="move stock into a bound location" />
        <BlockedGroup kind="bad" title="Reason not recognised" rows={groups.other}
          next="read the raw reason — this screen did not classify it" />

        {/* The uninteresting list, present anyway: "would publish 0" and "we
            did not look" must not read alike. */}
        {pub.length > 0 &&
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: 'pointer', fontSize: P.type.meta, color: P.inkDim }}>
              {pub.length} sku{pub.length === 1 ? '' : 's'} would publish — show the list
            </summary>
            <div style={{ marginTop: 8 }}>
              <DataTable dense
                columns={[
                  { key: 'sku', label: 'SKU', render: function (r) {
                    return <span style={{ fontFamily: P.fontMono }}>{r.sku}</span>; } },
                  { key: 'price_cents', label: 'price_cents', align: 'right' },
                  { key: 'qty', label: 'qty', align: 'right' },
                  { key: 'batch_id', label: 'batch_id', render: function (r) {
                    return <span style={{ fontFamily: P.fontMono, fontSize: P.type.micro }}>{r.batch_id}</span>; } }
                ]}
                rows={pub.slice(0, 200)} rowKey={function (r) { return r.sku; }} />
              {pub.length > 200 &&
                <div style={{ fontSize: P.type.micro, color: P.inkMute, marginTop: 5 }}>
                  showing the first 200 of {pub.length}.
                </div>}
            </div>
          </details>}

        {/* Step 3 — confirm and arm. The field is NEVER pre-filled. */}
        <div style={{ marginTop: 14, padding: '12px 13px', border: '1px solid ' + P.hairline2,
          background: P.surface2, borderRadius: P.r10 }}>
          <div style={{ fontSize: P.type.body, color: P.ink, fontWeight: 600 }}>
            Type the number of SKUs that will stop publishing:
            {' '}<span style={{ fontFamily: P.fontMono, fontWeight: 800 }}>{blocked}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 9, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 120 }}>
              <Field size="sm" mono placeholder="" value={typed} inputMode="numeric"
                onChange={function (e) { setTyped(e.target.value); }} />
            </div>
            <PBtn size="sm" variant="primary" busy={armBusy}
              disabled={!armable || armBusy || !canWrite()}
              title={armable ? 'POST /api/inventory/gate/arm' : 'the typed number must equal the blocked count above'}
              onClick={function () { onArm(typedInt); }}>Arm this channel</PBtn>
            {typed && !armable &&
              <span style={{ fontSize: P.type.micro, color: P.inkDim }}>
                {typedInt == null ? 'that is not a whole number' : 'that is not the number above'}
              </span>}
          </div>
          <window.DevNote id="gate-confirm-guard" tone="info" title="Why Arm asks you to type a number you can see">
            <window.DevNoteP>
              Two different guards, doing two different jobs. This screen refusing an unmatched number checks that
              <strong> you read the screen</strong>. The server recomputing the preview at the moment you press Arm checks
              that <strong>the screen was still true</strong> &mdash; inventory moves while a person reads.
            </window.DevNoteP>
            <window.DevNoteP>
              Verified: the sku universe on one scratch instance went from 10 to 11 in twenty minutes, with nobody
              touching the gate. The server&rsquo;s refusal is the one that matters and this screen cannot pre-empt it,
              which is why a <window.DevNoteMono>confirm_mismatch</window.DevNoteMono> is rendered here as a designed
              outcome rather than an error.
            </window.DevNoteP>
          </window.DevNote>
        </div>
      </div>);
  }

  // ── PublishingNow — THE BAND THAT STOPS FOUR STATES COLLAPSING INTO TWO ──
  //
  // engine.publish_decision() FAILS OPEN BY DESIGN (wmdemo/engine.py:314 says
  // so in capitals). An unconfigured channel and a genuinely empty one
  // therefore both produce ABSENCE — nothing blocked, nothing listed, nothing
  // to look at — and absence is not a state a screen can render by omission.
  // Four states have to be told apart at a glance, and this band is the one
  // axis all four sit on:
  //
  //   1. UNCONFIGURED — fails open, so THE PRODUCT IS PUBLISHING. This is the
  //      one most likely to attract a warning icon, and a warning icon here is
  //      exactly backwards: it would read as a problem at the moment the
  //      listing is live and selling. Rendered as a POSITIVE fact, in the good
  //      tone, naming the fail-open as the mechanism.
  //   2. STAGED — bound, not armed. Publishing is IDENTICAL to (1): that is
  //      the deliberate property that lets an operator build a mapping over
  //      days. So the band is the same, and the difference between (1) and (2)
  //      lives where it belongs — on the configuration axis, in the pill and
  //      the situation sentence above.
  //   3. ENFORCED + blocked_no_price — the gate is deciding, and some skus are
  //      dark because a batch has no usable price. Blocks on EVERY mode.
  //   4. ENFORCED + blocked_no_stock — dark because the bound locations hold
  //      no in-stock batch. Blocks only on a stock-truth mode.
  //
  // (3) and (4) were the pair this screen actually collapsed: an enforced card
  // rendered no per-sku measurement at all, so both read as one green
  // "enforced — live" and nothing said how many listings were dark or why.
  //
  // AND A FIFTH, WHICH IS (3)/(4) WITH NOBODY BEHIND IT. `state: enforced`
  // with `declared: false` is a live gate written by set_channel_map, which
  // leaves no channel_gate row — and an absent row reads as enforced. The band
  // is the same fact (the gate IS deciding) but the TITLE is not, so it carries
  // `data-gate-declared` and says "nobody armed it". See situation()'s branch.
  //
  // WHY THE PREVIEW IS NOT FETCHED FOR AN UNGATED CHANNEL.
  // GET /api/inventory/gate/preview answers what arming WOULD do. On an
  // unbound channel every sku comes back `no_locations:` — inventory.py has
  // nothing to look in. That is a statement about the GATE, not about stock,
  // and rendering it as "31 blocked" is precisely how an unconfigured channel
  // acquires a red badge at the instant the product is live and selling. So
  // it is not requested, and the band says why rather than leaving a gap.
  function PublishingNow({ g, s, channel, live, liveBusy, onMeasure }) {
    const P = useP();
    const enforced = g.state === 'enforced';

    // data-gate-band carries the TONE this band chose. It is the one thing on
    // this screen a test can hold the design gate to: "unconfigured must not
    // render as a problem" is a claim about colour, and a claim about colour
    // that lives only in a stylesheet cannot be asserted.
    // See POS-Admin/test/publish-gate-states.test.mjs.
    // An enforced gate nobody armed is still deciding, so the band's FACT does
    // not change — only who is answerable for it. The title carries that and
    // data-gate-declared makes it assertable.
    const undeclared = enforced && !g.declared;
    const DECIDING = undeclared ? 'the gate is deciding · nobody armed it' : 'the gate is deciding';

    const head = (tone, title, sub) => (
      <div data-gate-band={tone} data-gate-state={g.state} data-gate-declared={String(!!g.declared)}
        style={{ marginTop: 10, border: '1px solid ' + toneColor(P, tone), background: toneSoft(P, tone),
        borderRadius: P.r10, padding: '11px 13px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: toneColor(P, tone), display: 'flex' }}>
            <Icon name={tone === 'good' ? 'check-circle' : 'shield'} size={15} stroke={2} />
          </span>
          <span style={{ fontSize: P.type.meta, fontWeight: 800, letterSpacing: '.08em',
            textTransform: 'uppercase', color: toneColor(P, tone) }}>{title}</span>
        </div>
        <div style={{ marginTop: 6 }}>{sub}</div>
      </div>);

    if (!enforced) {
      // An unrecognised `state` gets no publishing claim at all. The green
      // band asserts a specific server behaviour (fail-open on an unarmed
      // channel); asserting it for a state this screen does not model would
      // be a fabrication dressed as reassurance, which is worse than a gap.
      if (['unbound', 'staged'].indexOf(g.state) < 0) {
        return head('bad', 'what is publishing: not stated',
          <span style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.55 }}>
            The gate returned <Code>state: {JSON.stringify(g.state)}</Code>, which this screen has no rendering for, so
            it is not claiming this channel is publishing and not claiming the gate is deciding. Read the raw fields
            below.
          </span>);
      }
      // stale_declaration is the one non-enforced state whose publishing
      // behaviour this screen will not assert: the row says armed, `state`
      // says otherwise, and locations_for() is the tiebreaker this screen has
      // not read. Say that instead of printing a reassuring green band.
      if (g.stale_declaration === true) {
        return head('bad', 'what is publishing: not stated',
          <span style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.55 }}>
            The gate row and <Code>state</Code> disagree on this channel, so this screen will not tell you whether the
            gate is deciding what publishes. Resolve the contradiction (bind, or disarm) and this band becomes an answer.
          </span>);
      }
      return head('good', 'publishing now · the gate is not deciding',
        <span style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.55 }}>
          <strong>Nothing is dark here because of the gate.</strong> <Code>publish_decision()</Code> fails open by
          design: with no <em>armed</em> binding it returns <Code>gate: unconfigured</Code> and hands back catalog stock
          at the product price, so this channel ships exactly what it shipped before the gate existed.
          {g.state === 'staged'
            ? <span> Binding {(g.bindings || []).length === 1 ? 'a location' : (g.bindings || []).length + ' locations'} did
                not change that &mdash; staging is configuration, and only arming hands over the decision.</span>
            : null}
          <div style={{ marginTop: 7, fontSize: P.type.micro, color: P.inkDim }}>
            A sku that is absent from this menu today is absent for a <em>catalog</em> reason, not a gate reason, and
            this screen deliberately does not measure that: <Code>GET /api/inventory/gate/preview</Code> answers what
            arming <em>would</em> do, and on an unbound channel every sku comes back <Code>no_locations</Code>.
            {' '}Rendering that as a blocked count would put a red badge on a channel that is live and selling.
          </div>
        </span>);
    }

    // ---- enforced. The gate IS deciding, and the two block reasons are
    // ---- different problems with different owners. Never one number.
    if (liveBusy && !live) {
      return head('info', DECIDING + ' · measuring',
        <div style={{ marginTop: 2 }}><SkeletonRows rows={1} avatar={false} /></div>);
    }
    if (!live) {
      return head('info', DECIDING + ' · not measured',
        <span style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.55 }}>
          This channel is armed, so <Code>publish_view()</Code> decides its price and quantity &mdash; but this screen
          has not read what it is currently blocking. <strong>That is an unread measurement, not a zero.</strong>
          <div style={{ marginTop: 8 }}>
            <PBtn size="xs" busy={liveBusy} disabled={liveBusy} onClick={onMeasure}>Measure what it is blocking</PBtn>
          </div>
        </span>);
    }
    if (!live.ok) {
      return head('bad', DECIDING + ' · could not measure',
        <span style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.55 }}>
          <Code>GET {live.url}</Code> answered <strong>{live.code === 0 ? 'no response' : 'HTTP ' + live.code}</strong>
          {live.netError ? ' — ' + live.netError : ''}. The gate is enforcing and this screen cannot say what it is
          blocking. <strong>Not zero &mdash; unknown.</strong>
          <div style={{ marginTop: 8 }}>
            <PBtn size="xs" busy={liveBusy} disabled={liveBusy} onClick={onMeasure}>Retry</PBtn>
          </div>
        </span>);
    }

    const b = live.body || {};
    const noPrice = b.blocked_no_price || [];
    const noStock = b.blocked_no_stock || [];
    const pub = (b.publishable || []).length;
    // The same split ArmFlow makes, on the token before the colon. On an
    // enforced channel `no_locations` should be impossible — it would mean
    // locations_for() and the gate row disagree — so it gets its own row
    // rather than being folded into "no stock" and quietly misattributed.
    const noLoc = noStock.filter(function (r) {
      return String((r && r.reason) || '').split(':')[0].trim() === 'no_locations'; });
    const trueNoStock = noStock.filter(function (r) { return noLoc.indexOf(r) < 0; });

    const counter = (tone, n, label, sub) => (
      <div style={{ flex: '1 1 150px', minWidth: 140, padding: '9px 11px', background: P.surface3,
        border: '1px solid ' + (n > 0 ? toneColor(P, tone) : P.hairline2), borderRadius: P.r8 }}>
        <div style={{ fontFamily: P.fontMono, fontSize: P.type.h2, fontWeight: 800,
          color: n > 0 ? toneColor(P, tone) : P.inkMute }}>{n}</div>
        <div style={{ fontSize: P.type.meta, fontWeight: 700, color: P.ink }}>{label}</div>
        <div style={{ fontSize: P.type.micro, color: P.inkDim, marginTop: 2, lineHeight: 1.4 }}>{sub}</div>
      </div>);

    return head('warn', undeclared ? DECIDING : 'the gate is deciding what publishes',
      <div>
        <div style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.55 }}>
          Measured {hhmmss(live.at)} over <Code>GET /api/inventory/gate/preview</Code>, {b.skus_examined} sku
          {b.skus_examined === 1 ? '' : 's'} examined.
          {' '}<strong>This is a live read of what the armed gate is blocking</strong> &mdash; it is not the arm
          confirmation, which is typed against its own explicit preview and never against this number.
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 9,
          opacity: liveBusy ? 0.55 : 1 }}>
          {counter('good', pub, 'publishing', 'the gate ships these')}
          {counter('bad', noPrice.length, 'dark · no price',
            'an in-stock batch has no usable price. Blocks on EVERY mode — a data error, fix the batch.')}
          {counter('warn', trueNoStock.length, 'dark · no stock',
            'no in-stock batch in the bound locations. Blocks on a stock-truth mode; mode full keeps its nominal qty.')}
          {noLoc.length > 0 && counter('bad', noLoc.length, 'dark · no locations',
            'reason says nothing is bound, on a channel reading enforced. Those two cannot both be true — read it.')}
        </div>
        <div style={{ marginTop: 4 }}>
          <BlockedGroup kind="bad" title="Dark right now · no price" rows={noPrice} next="fix the batch price" />
          <BlockedGroup kind="warn" title="Dark right now · no stock in the bound locations" rows={trueNoStock}
            next="move stock into a bound location, or disarm" />
          <BlockedGroup kind="bad" title="Dark right now · reason says nothing is bound" rows={noLoc}
            next="read the raw reason — enforced and no_locations contradict each other" />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <PBtn size="xs" busy={liveBusy} disabled={liveBusy} onClick={onMeasure}>Re-measure</PBtn>
          <span style={{ fontSize: P.type.micro, color: P.inkMute }}>
            {noPrice.length + trueNoStock.length + noLoc.length === 0
              ? 'zero dark — measured, not assumed.'
              : 'disarm returns every one of these to catalog stock at the product price.'}
          </span>
        </div>
      </div>);
  }

  // ── one channel card ─────────────────────────────────────────────────────
  function ChannelCard({ channel, gh, g, planMode, locIndex, locHttp, preview, previewBusy,
                        armBusy, busy, refusal, armed, live, liveBusy, onMeasure,
                        onPreview, onArm, onDisarm, onBind, onUnbind, onDismiss, onRepreview,
                        onScrollLocations, onReloadChannel }) {
    const P = useP();

    if (gh && !gh.ok) {
      // ONE channel failing must never blank the screen, and must never render
      // as "this channel does not exist".
      return (
        <Card density="roomy" style={{ marginBottom: 14 }}>
          <Eyebrow>{channel}</Eyebrow>
          <ErrorState compact style={{ marginTop: 8 }}
            title={'Could not read the ' + channel + ' gate'}
            body={'GET ' + gh.url + ' answered ' + (gh.code === 0 ? 'no response' : 'HTTP ' + gh.code) +
                  (gh.netError ? ' — ' + gh.netError : '') +
                  '. This card is not making a claim about the gate; it could not ask.'}
            onRetry={onReloadChannel} />
        </Card>);
      }
    if (!g) {
      return (
        <Card density="roomy" style={{ marginBottom: 14 }}>
          <Eyebrow>{channel}</Eyebrow>
          <div style={{ marginTop: 10 }}><SkeletonRows rows={2} avatar={false} /></div>
        </Card>);
    }

    const s = situation(g);
    return (
      <Card density="roomy" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: P.fontMono, fontSize: P.type.title, fontWeight: 700, color: P.ink }}>{channel}</span>
          <Pill kind={s.kind} size="sm">{s.label}</Pill>
          <span style={{ flex: 1 }} />
          {s.canEdit === false &&
            <PBtn size="sm" busy={busy} disabled={busy || !canWrite()} onClick={onDisarm}>Disarm</PBtn>}
        </div>

        <div style={{ fontSize: P.type.body, color: P.ink2, lineHeight: 1.6, marginTop: 7, maxWidth: 900 }}>{s.why}</div>

        {armed &&
          <Strip kind="good" style={{ marginTop: 10 }}>
            Armed. <Code>changed: {String(armed.changed)}</Code> &mdash;{' '}
            {armed.changed ? 'this channel was off and is now live'
                           : 'it was already enforced; nothing moved'}.
          </Strip>}

        <PublishingNow g={g} s={s} channel={channel} live={live} liveBusy={liveBusy}
          onMeasure={onMeasure} />

        <FieldStrip g={g} />
        <RoutingBanner g={g} s={s} channel={channel} planMode={planMode} />

        {channel === 'scheduled' &&
          <Strip kind="bad" style={{ marginTop: 10 }}>
            <strong><Code>scheduled</Code> is a fully bindable, previewable and armable channel that no menu mode maps to.</strong>
            {' '}Verified end to end over HTTP: bind &rarr; 200, preview &rarr; 200, arm with the right number &rarr; 200
            and <Code>state: &quot;enforced&quot;</Code>. Nothing refuses it, and nothing about what publishes changes.
            {' '}<Code>engine._channel_for</Code> returns <Code>pickup</Code> for modes <Code>full</Code>/<Code>pickup</Code>,
            {' '}<Code>express</Code> for <Code>kits</Code>, and <Code>None</Code> for everything else &mdash; no mode
            returns <Code>scheduled</Code>. The express/scheduled split is blocked on Weedmaps, not on this screen.
          </Strip>}

        <BoundLocations g={g} channel={channel} locIndex={locIndex} locHttp={locHttp}
          canEdit={s.canEdit} busy={busy} onBind={onBind} onUnbind={onUnbind} onDisarm={onDisarm} />

        {refusal
          ? <RefusalPanel ref_={refusal} onDismiss={onDismiss} onRepreview={onRepreview}
              onScrollLocations={onScrollLocations} />
          : s.canArm
            ? <ArmFlow g={g} channel={channel} preview={preview} previewBusy={previewBusy}
                armBusy={armBusy} onPreview={onPreview} onArm={onArm} />
            : s.canEdit === false
              ? <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 12, lineHeight: 1.55 }}>
                  <strong>Disarm keeps every binding.</strong> Publishing returns to catalog stock and the product price
                  &mdash; the behaviour of every unconfigured menu. Verified: disarm returns <Code>state: &quot;staged&quot;</Code>
                  {' '}with <Code>bindings</Code> intact.
                </div>
              : <div style={{ fontSize: P.type.meta, color: P.inkMute, marginTop: 12 }}>
                  Arm is not offered here: {s.label}.
                </div>}
      </Card>);
  }

  // ── inventory locations ──────────────────────────────────────────────────
  function LocationsCard({ locHttp, busy, onCreate, onUpdate, onReload, anchorRef }) {
    const P = useP();
    const [form, setForm] = React.useState({ id: '', name: '', kind: 'safe', region: '', active: true });
    const [err, setErr] = React.useState(null);
    const [editing, setEditing] = React.useState(null);
    const [open, setOpen] = React.useState(false);

    const rows = (locHttp && locHttp.ok && Array.isArray(locHttp.body)) ? locHttp.body : null;

    function submit() {
      setErr(null);
      onCreate(form).then(function (r) {
        if (r && r.ok) { setForm({ id: '', name: '', kind: 'safe', region: '', active: true }); setOpen(false); }
        else { setErr(r); }
      });
    }

    return (
      <div ref={anchorRef}>
        <Card density="roomy" style={{ marginBottom: 14 }}>
          <SectionHead eyebrow="The other half of the mapping" title="Inventory locations"
            subtitle="A safe, a driver's kit, or a counter — a real stock ledger. A channel binds to one or more of these."
            action={<div style={{ display: 'flex', gap: 8 }}>
              <IconBtn icon="refresh" title="Re-read GET /api/inventory/locations" onClick={onReload} disabled={busy} />
              <PBtn size="sm" disabled={!canWrite()} onClick={function () { setOpen(!open); }}>
                {open ? 'Cancel' : 'New location'}
              </PBtn>
            </div>} />

          <window.DevNote id="gate-locations-tables" tone="warn" title="This is not the pickup_locations table">
            <window.DevNoteP>
              <window.DevNoteMono>inventory_locations</window.DevNoteMono> and{' '}
              <window.DevNoteMono>pickup_locations</window.DevNoteMono> are two different tables, and their ids look
              alike &mdash; the canonical gate refusal names{' '}
              <window.DevNoteMono>corona-counter</window.DevNoteMono>, which is <em>also</em> a{' '}
              <window.DevNoteMono>pickup_locations</window.DevNoteMono> id in the seed.
            </window.DevNoteP>
            <window.DevNoteP>
              Nothing on this screen reads <window.DevNoteMono>pickup_locations</window.DevNoteMono>, deliberately.
              Creating an inventory location named after a counter does not connect it to that counter, and a screen that
              showed both would invite exactly that assumption &mdash; binding the gate to something other than what the
              operator thinks, silently.
            </window.DevNoteP>
          </window.DevNote>

          {!locHttp && <div style={{ marginTop: 10 }}><SkeletonRows rows={2} avatar={false} /></div>}

          {locHttp && !locHttp.ok &&
            <ErrorState compact style={{ marginTop: 10 }}
              title={locHttp.code === 404
                ? 'There is no read route for inventory locations on this build'
                : 'Could not read the inventory locations'}
              body={'GET ' + locHttp.url + ' answered ' +
                    (locHttp.code === 0 ? 'no response' : 'HTTP ' + locHttp.code) +
                    (locHttp.code === 404
                      ? '. inventory.locations() exists in wmdemo/inventory.py and is not wired to the HTTP layer on this build. This is an absent route, not an empty table — the two are different facts and this screen will not merge them. Bound locations above can only be rendered as raw ids until it lands.'
                      : '. Nothing below is a claim about the location table.')}
              onRetry={onReload} />}

          {rows && rows.length === 0 &&
            <EmptyState style={{ marginTop: 10 }} icon="vault"
              title="No inventory location has been created yet"
              body="The gate binds channels to inventory locations, and there are none. inventory_locations is empty on a fresh instance and nothing in demo_seed, catalog or server seeds it — this is an unconfigured system, not a broken screen."
              action={canWrite() ? <PBtn size="sm" variant="primary" onClick={function () { setOpen(true); }}>Create the first location</PBtn> : null} />}

          {rows && rows.length > 0 &&
            <div style={{ marginTop: 12 }}>
              <DataTable dense rowKey={function (r) { return r.id; }}
                columns={[
                  { key: 'id', label: 'id', render: function (r) {
                    return <span style={{ fontFamily: P.fontMono }}>{r.id}</span>; } },
                  { key: 'name', label: 'name' },
                  { key: 'kind', label: 'kind', render: function (r) {
                    return <Pill kind="neutral" size="sm">{r.kind}</Pill>; } },
                  { key: 'region', label: 'region', render: function (r) {
                    return r.region || <span style={{ color: P.inkMute }}>&mdash;</span>; } },
                  { key: 'active', label: 'active', render: function (r) {
                    return <Pill kind={r.active ? 'good' : 'bad'} size="sm">{r.active ? 'active' : 'inactive'}</Pill>; } },
                  { key: '_', label: '', align: 'right', render: function (r) {
                    return <PBtn size="xs" disabled={!canWrite()}
                      onClick={function () { setEditing(Object.assign({}, r)); }}>Edit</PBtn>; } }
                ]}
                rows={rows} />
            </div>}

          {editing &&
            <div style={{ marginTop: 12, padding: '12px 13px', border: '1px solid ' + P.hairline2,
              background: P.surface2, borderRadius: P.r10 }}>
              <div style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>
                Edit <span style={{ fontFamily: P.fontMono }}>{editing.id}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <Field size="sm" placeholder="name" value={editing.name || ''}
                    onChange={function (e) { setEditing(Object.assign({}, editing, { name: e.target.value })); }} />
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <Field size="sm" placeholder="region" value={editing.region || ''}
                    onChange={function (e) { setEditing(Object.assign({}, editing, { region: e.target.value })); }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: P.type.meta, color: P.ink2 }}>
                  <Check on={!!editing.active} onChange={function (v) { setEditing(Object.assign({}, editing, { active: v })); }} />
                  active
                </label>
                <PBtn size="sm" variant="primary" busy={busy} disabled={busy}
                  onClick={function () { onUpdate(editing).then(function () { setEditing(null); }); }}>Save</PBtn>
                <PBtn size="sm" onClick={function () { setEditing(null); }}>Cancel</PBtn>
              </div>
              <div style={{ fontSize: P.type.micro, color: P.inkDim, marginTop: 8 }}>
                <strong>kind is not editable</strong> &mdash; a safe that becomes a kit re-scopes every channel bound to it
                with nothing to notice. Current kind: <Code>{editing.kind}</Code>.
                {' '}Deactivating a location that feeds a live channel refuses with <Code>would_shrink_enforced_scope</Code>.
              </div>
            </div>}

          {open &&
            <div style={{ marginTop: 12, padding: '12px 13px', border: '1px solid ' + P.hairline2,
              background: P.surface2, borderRadius: P.r10 }}>
              <div style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>New inventory location</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: '1 1 170px' }}>
                  <Field size="sm" mono placeholder="id (e.g. corona-safe)" value={form.id}
                    onChange={function (e) { setForm(Object.assign({}, form, { id: e.target.value })); }} />
                </div>
                <div style={{ flex: '1 1 190px' }}>
                  <Field size="sm" placeholder="name" value={form.name}
                    onChange={function (e) { setForm(Object.assign({}, form, { name: e.target.value })); }} />
                </div>
                <Seg size="sm" value={form.kind}
                  onChange={function (v) { setForm(Object.assign({}, form, { kind: v })); }}
                  options={KINDS.map(function (k) { return { value: k, label: k }; })} />
                <div style={{ flex: '1 1 140px' }}>
                  <Field size="sm" placeholder="region (optional)" value={form.region}
                    onChange={function (e) { setForm(Object.assign({}, form, { region: e.target.value })); }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: P.type.meta, color: P.ink2 }}>
                  <Check on={!!form.active} onChange={function (v) { setForm(Object.assign({}, form, { active: v })); }} />
                  active
                </label>
                <PBtn size="sm" variant="primary" busy={busy}
                  disabled={busy || !form.id.trim() || !form.name.trim()} onClick={submit}>Create</PBtn>
              </div>
              <div style={{ fontSize: P.type.micro, color: P.inkDim, marginTop: 8 }}>
                <Code>kind</Code> is one of exactly <Code>safe</Code>, <Code>kit</Code>, <Code>counter</Code> &mdash; an
                unknown kind would be real in the table and invisible to every read filter, so the API refuses it and this
                form does not offer free text.
              </div>
              {err &&
                <div style={{ marginTop: 9, fontFamily: P.fontMono, fontSize: P.type.meta, color: P.bad,
                  whiteSpace: 'pre-wrap' }}>
                  HTTP {err.code}{err.body && err.body.code ? ' · ' + err.body.code : ''} — {(err.body && err.body.error) || err.error}
                  {err.body && err.body.code === 'exists' &&
                    <div style={{ marginTop: 6 }}>
                      <PBtn size="xs" onClick={function () {
                        const found = (rows || []).filter(function (r) { return r.id === form.id.trim(); })[0];
                        if (found) { setEditing(Object.assign({}, found)); setOpen(false); setErr(null); }
                      }}>Edit it instead</PBtn>
                      <span style={{ fontFamily: P.fontSans, color: P.inkDim, marginLeft: 8 }}>
                        create_location refuses to overwrite on purpose.
                      </span>
                    </div>}
                </div>}
            </div>}
        </Card>
      </div>);
  }

  // ── the screen ───────────────────────────────────────────────────────────
  window.PublishGateScreen = function PublishGateScreen() {
    const P = useP();
    const [http, setHttp] = React.useState({ state: null, gate: {}, locations: null, preview: null });
    const [plan, setPlan] = React.useState(null);        // menu_plan from /api/state
    const [wmids, setWmids] = React.useState(null);
    const [menu, setMenu] = React.useState(null);
    const [gate, setGate] = React.useState({});
    const [preview, setPreview] = React.useState(null);  // {channel, at, body} — component state ONLY
    // LIVE, and deliberately NOT the same object as `preview`.
    // `preview` is the operator's explicit arm preview: they pressed the
    // button, they read the list, they type its number back. `live` is this
    // screen measuring what an ALREADY-ARMED gate is blocking right now, so
    // that "enforced + no stock" and "enforced + no price" are two different
    // pictures instead of one green pill. Merging them would let an
    // auto-refreshed number become the thing a person confirms, which is the
    // one behaviour arm_channel's confirm guard exists to forbid.
    const [live, setLive] = React.useState({});          // {channel: {at,ok,code,body,url}}
    const [liveBusy, setLiveBusy] = React.useState({});  // {channel: bool}
    const [refusal, setRefusal] = React.useState(null);
    const [armed, setArmed] = React.useState(null);      // {channel, changed}
    const [busy, setBusy] = React.useState(false);
    const [previewBusy, setPreviewBusy] = React.useState(false);
    const [armBusy, setArmBusy] = React.useState(false);
    const locAnchor = React.useRef(null);

    // ---- reads ----------------------------------------------------------
    const loadState = React.useCallback(function () {
      return getJSON('/api/state').then(function (h) {
        setHttp(function (s) { return Object.assign({}, s, { state: h }); });
        const body = h.body || {};
        const mp = body.menu_plan || null;
        setPlan(mp);
        setWmids(body.wmids || null);
        setMenu(function (cur) {
          if (cur != null) { return cur; }
          const keys = mp ? Object.keys(mp) : [];
          const pref = body.wmids && body.wmids.delivery != null ? String(body.wmids.delivery) : null;
          if (pref && keys.indexOf(pref) >= 0) { return pref; }
          return keys.length ? keys[0] : null;
        });
        return h;
      });
    }, []);

    const loadLocations = React.useCallback(function () {
      return getJSON('/api/inventory/locations').then(function (h) {
        setHttp(function (s) { return Object.assign({}, s, { locations: h }); });
        return h;
      });
    }, []);

    const loadChannel = React.useCallback(function (m, ch) {
      if (m == null) { return Promise.resolve(null); }
      return getJSON('/api/inventory/gate?menu=' + encodeURIComponent(m) + '&channel=' + encodeURIComponent(ch))
        .then(function (h) {
          setHttp(function (s) {
            const g = Object.assign({}, s.gate); g[ch] = h;
            return Object.assign({}, s, { gate: g });
          });
          if (h.ok && h.body && !Array.isArray(h.body)) {
            setGate(function (s) { const n = Object.assign({}, s); n[ch] = h.body; return n; });
          } else {
            setGate(function (s) { const n = Object.assign({}, s); delete n[ch]; return n; });
          }
          return h;
        });
    }, []);

    const loadGates = React.useCallback(function (m) {
      return Promise.all(CHANNELS.map(function (ch) { return loadChannel(m, ch); }));
    }, [loadChannel]);

    React.useEffect(function () { loadState(); loadLocations(); }, [loadState, loadLocations]);

    // A menu change invalidates EVERY per-menu measurement. The preview above
    // all: its sku universe is catalog.products() and it moves, so a preview
    // carried across a navigation hands back a stale confirm and eats a 409.
    React.useEffect(function () {
      if (menu == null) { return; }
      setPreview(null); setRefusal(null); setArmed(null);
      setGate({}); setLive({}); setLiveBusy({});
      loadGates(menu);
    }, [menu, loadGates]);

    function reloadAll() {
      setBusy(true);
      setPreview(null); setRefusal(null); setArmed(null); setLive({});
      Promise.all([loadState(), loadLocations(), loadGates(menu)]).then(function () { setBusy(false); });
    }

    // ---- writes ---------------------------------------------------------
    function refuse(ch, where, r, extra) {
      setRefusal(Object.assign({
        channel: ch, where: where, httpCode: r.code,
        code: (r.body && r.body.code) || 'refused',
        sentence: (r.body && r.body.error) || r.error || ('HTTP ' + r.code),
        body: r.body || null
      }, extra || {}));
    }

    function applyGate(ch, body) {
      if (body && !Array.isArray(body)) {
        setGate(function (s) { const n = Object.assign({}, s); n[ch] = body; return n; });
        // Every caller of this (bind, unbind, arm, disarm) has just changed
        // what the gate decides, so the last measurement is now a claim about
        // a world that no longer exists. Drop it; the effect re-measures if
        // the channel is still enforced. Keeping it would leave a stale
        // "3 dark · no stock" under a channel that was disarmed a second ago.
        setLive(function (s) { const n = Object.assign({}, s); delete n[ch]; return n; });
      }
    }

    function doBind(ch, location) {
      setBusy(true); setRefusal(null); setArmed(null);
      return post('/api/inventory/bind', { menu: Number(menu), channel: ch, location: location })
        .then(function (r) {
          setBusy(false);
          if (r.ok) { applyGate(ch, r.body); setPreview(null); return r; }
          refuse(ch, 'bind', r);
          return r;
        });
    }

    function doUnbind(ch, location) {
      setBusy(true); setRefusal(null); setArmed(null);
      return post('/api/inventory/unbind', { menu: Number(menu), channel: ch, location: location })
        .then(function (r) {
          setBusy(false);
          if (r.ok) { applyGate(ch, r.body); setPreview(null); return r; }
          refuse(ch, 'unbind', r);
          return r;
        });
    }

    function doPreview(ch) {
      setPreviewBusy(true);
      return getJSON('/api/inventory/gate/preview?menu=' + encodeURIComponent(menu) +
                     '&channel=' + encodeURIComponent(ch))
        .then(function (h) {
          setPreviewBusy(false);
          setHttp(function (s) {
            return Object.assign({}, s, { preview: Object.assign({ channel: ch }, h) });
          });
          if (h.ok && h.body) { setPreview({ channel: ch, at: h.at, body: h.body }); }
          return h;
        });
    }

    // Only ever called for a channel reading state='enforced'. On an unbound
    // channel this route answers `no_locations` for every sku -- a fact about
    // the gate, not about stock -- and rendering it as a blocked count is how
    // an unconfigured channel (which is PUBLISHING, fail-open) would acquire a
    // red badge. See PublishingNow's block comment.
    const doMeasure = React.useCallback(function (m, ch) {
      if (m == null) { return Promise.resolve(null); }
      setLiveBusy(function (s) { const n = Object.assign({}, s); n[ch] = true; return n; });
      return getJSON('/api/inventory/gate/preview?menu=' + encodeURIComponent(m) +
                     '&channel=' + encodeURIComponent(ch))
        .then(function (h) {
          setLiveBusy(function (s) { const n = Object.assign({}, s); delete n[ch]; return n; });
          setLive(function (s) {
            const n = Object.assign({}, s); n[ch] = h; return n;
          });
          return h;
        });
    }, []);

    // A channel that IS enforced is measured without being asked. An enforced
    // gate with no measurement renders as absence, and absence is exactly what
    // must not stand in for "nothing is blocked" on this screen.
    React.useEffect(function () {
      if (menu == null) { return; }
      CHANNELS.forEach(function (ch) {
        const g = gate[ch];
        if (g && g.state === 'enforced' && !live[ch] && !liveBusy[ch]) {
          doMeasure(menu, ch);
        }
      });
    }, [menu, gate, live, liveBusy, doMeasure]);

    function doArm(ch, confirmed) {
      setArmBusy(true); setArmed(null);
      const typedAt = Date.now();
      return post('/api/inventory/gate/arm',
        { menu: Number(menu), channel: ch, confirm_blocked: confirmed })
        .then(function (r) {
          setArmBusy(false);
          if (r.ok) {
            applyGate(ch, r.body);
            setArmed({ channel: ch, changed: r.body && r.body.changed });
            setPreview(null); setRefusal(null);
            return r;
          }
          const code = (r.body && r.body.code) || 'refused';
          // PREFER the number the refusal itself carries — Refused.as_dict()
          // has it. When the route hand-builds {error, code} it does not, and
          // the panel says so and re-reads instead. The two are labelled
          // differently on purpose: they are measurements taken at different
          // instants and must never be presented as interchangeable.
          const fromBody = (r.body && typeof r.body.blocked === 'number') ? r.body.blocked : null;
          refuse(ch, 'arm', r, {
            confirmed: confirmed, typedAt: typedAt,
            corrected: fromBody, correctedFrom: fromBody != null ? 'refusal' : null,
            correctedAt: fromBody != null ? Date.now() : null
          });
          if (code === 'confirm_mismatch' && fromBody == null) {
            doPreview(ch).then(function (h) {
              if (h.ok && h.body && typeof h.body.blocked === 'number') {
                setRefusal(function (cur) {
                  if (!cur) { return cur; }
                  return Object.assign({}, cur, { corrected: h.body.blocked,
                    correctedFrom: 'reread', correctedAt: h.at });
                });
              }
            });
          }
          return r;
        });
    }

    function doDisarm(ch) {
      setBusy(true); setRefusal(null); setArmed(null);
      return post('/api/inventory/gate/disarm', { menu: Number(menu), channel: ch })
        .then(function (r) {
          setBusy(false);
          if (r.ok) { applyGate(ch, r.body); setPreview(null); return r; }
          refuse(ch, 'disarm', r);
          return r;
        });
    }

    function doCreateLocation(form) {
      setBusy(true);
      return post('/api/inventory/locations', {
        id: form.id.trim(), name: form.name.trim(), kind: form.kind,
        region: form.region.trim() || null, active: !!form.active
      }).then(function (r) {
        setBusy(false);
        if (r.ok) { loadLocations(); }
        return r;
      });
    }

    function doUpdateLocation(row) {
      setBusy(true); setRefusal(null);
      return post('/api/inventory/locations/update', {
        id: row.id, name: row.name, region: row.region || null, active: !!row.active
      }).then(function (r) {
        setBusy(false);
        if (r.ok) { loadLocations(); loadGates(menu); }
        else { refuse(null, 'update_location', r); }
        return r;
      });
    }

    // ---- degradation: /api/state is the floor ---------------------------
    const stateHttp = http.state;
    if (stateHttp && !stateHttp.ok) {
      return (
        <div style={{ maxWidth: 1180 }}>
          <Explainer />
          <ErrorState title="Could not read the menu list"
            body={'GET ' + stateHttp.url + ' answered ' +
                  (stateHttp.code === 0 ? 'no response' : 'HTTP ' + stateHttp.code) +
                  (stateHttp.netError ? ' — ' + stateHttp.netError : '') +
                  '. Without it this screen does not know which menus exist or what mode they run, so nothing below ' +
                  'would be a claim about the gate.'}
            onRetry={reloadAll} />
        </div>);
    }

    const menuKeys = plan ? Object.keys(plan) : [];
    const planRow = (plan && menu != null) ? plan[String(menu)] : null;
    const planMode = planRow ? planRow.mode : null;

    // index of everything this screen has SEEN about a location id
    const locIndex = {};
    if (http.locations && http.locations.ok && Array.isArray(http.locations.body)) {
      http.locations.body.forEach(function (l) { locIndex[l.id] = l; });
    }

    const allUnbound = CHANNELS.every(function (c) {
      return gate[c] && gate[c].state === 'unbound';
    }) && CHANNELS.every(function (c) { return !!gate[c]; });

    return (
      <div style={{ maxWidth: 1180 }}>
        <Explainer />
        <SourceBanner http={http} busy={busy} onReload={reloadAll} />

        {plan && menuKeys.length === 0 &&
          <Strip kind="warn" style={{ marginBottom: 16 }}>
            <Code>/api/state</Code> answered 200 and <Code>menu_plan</Code> is empty. No menu is planned to any region
            &mdash; that is a real answer, and it means there is nothing for a gate to publish through.
          </Strip>}

        {menuKeys.length > 0 &&
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: P.type.meta, fontWeight: 700, color: P.inkDim, textTransform: 'uppercase',
              letterSpacing: '.08em' }}>Menu</span>
            <Seg value={String(menu)} onChange={function (v) { setMenu(v); }}
              options={menuKeys.map(function (k) {
                const row = plan[k] || {};
                const who = wmids && String(wmids.delivery) === k ? 'delivery'
                          : wmids && String(wmids.menu) === k ? 'pickup' : null;
                return { value: k, label: k + (who ? ' · ' + who : '') + ' · mode ' + (row.mode || '—') };
              })} />
            {planRow && (planRow.regions || []).length > 0 &&
              <span style={{ fontSize: P.type.meta, color: P.inkDim }}>
                regions: <span style={{ fontFamily: P.fontMono }}>{planRow.regions.join(', ')}</span>
              </span>}
            {planRow && (planRow.mode_conflict || []).length > 0 &&
              <Pill kind="bad" size="sm">mode conflict: {planRow.mode_conflict.join(', ')}</Pill>}
          </div>}

        {allUnbound &&
          <Strip kind="info" style={{ marginBottom: 14 }}>
            <strong>Nothing is gated on this menu.</strong> All three channels read <Code>state: unbound</Code>, so this
            menu publishes from catalog stock and the product price today &mdash; that is the current behaviour, not a
            fault. Two of the three cards below print <Code>switch: true</Code>; that is the compatibility default, not
            an armed gate.
          </Strip>}

        {CHANNELS.map(function (ch, i) {
          const card = (
            <ChannelCard key={ch} channel={ch} gh={(http.gate || {})[ch]} g={gate[ch]} planMode={planMode}
              locIndex={locIndex} locHttp={http.locations}
              preview={preview && preview.channel === ch ? preview : null}
              previewBusy={previewBusy && (!preview || preview.channel === ch)}
              armBusy={armBusy} busy={busy}
              refusal={refusal && refusal.channel === ch ? refusal : null}
              armed={armed && armed.channel === ch ? armed : null}
              live={live[ch] || null} liveBusy={!!liveBusy[ch]}
              onMeasure={function () { doMeasure(menu, ch); }}
              onPreview={function () { doPreview(ch); }}
              onArm={function (n) { doArm(ch, n); }}
              onDisarm={function () { doDisarm(ch); }}
              onBind={function (id) { doBind(ch, id); }}
              onUnbind={function (id) { doUnbind(ch, id); }}
              onDismiss={function () { setRefusal(null); }}
              onRepreview={function () { doPreview(ch); }}
              onScrollLocations={function () {
                try { locAnchor.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
              }}
              onReloadChannel={function () { loadChannel(menu, ch); }} />);
          // 'scheduled' is separated from the two channels a mode can actually
          // reach. The rule is about engine._channel_for, not about this menu's
          // data, so the separator does not depend on channel_for_mode.
          if (ch !== 'scheduled') { return card; }
          return (
            <div key="scheduled-block">
              <div style={{ borderTop: '1px solid ' + P.hairline2, margin: '22px 0 12px' }} />
              <Eyebrow>Reachable, and wired to nothing</Eyebrow>
              <div style={{ height: 8 }} />
              {card}
            </div>);
        })}

        <LocationsCard locHttp={http.locations} busy={busy} anchorRef={locAnchor}
          onCreate={doCreateLocation} onUpdate={doUpdateLocation} onReload={loadLocations} />
      </div>);
  };
})();
