// ── pos/screen-city-listing.jsx ── the City → Weedmaps listing board ───────
// OUR REGIONS roll up to a CITY. A CITY holds exactly ONE Weedmaps listing.
// That listing has TWO ROOMS: express and scheduled.
// Self-wrapping IIFE: it declares NOTHING at top level, so it cannot clobber
// another file's globals (test/global-collisions.test.mjs). Its only export is
// window.CityListingScreen.
//
// Reads GET /api/cities. Nothing else. It is READ-ONLY on purpose — see
// "WHY THERE IS NO EDIT FORM" below.
;(function () {
  'use strict';
  const useP = window.useP;

  // ── WHY THIS SCREEN EXISTS ────────────────────────────────────────────────
  //
  // The estate had no CITY at all. `region_menus` mapped a REGION to a MENU,
  // and the owner's rule — one listing per city, our regions rolled up behind
  // it — could not be written down, let alone enforced. wmdemo/cities.py adds
  // the noun and puts every ruled-out state behind a PK/UNIQUE/CHECK. The API
  // shipped. No screen did. This is the screen.
  //
  // ── THE ONE THING THIS SCREEN MUST NEVER DO ──────────────────────────────
  //
  // wm_listing_id CANNOT BE VALIDATED. Not by this screen, not by any job we
  // could write, not ever: the Weedmaps partner API exposes MENUS, and there
  // is no listings endpoint to look a pin up in. A typo in a pin is invisible
  // to every check that exists. GET /api/cities says so in the payload itself
  // — `wm_listing_id_verifiable: false`, and `wm_listing_id_verified: false`
  // stamped on every single city row — precisely so a screen author cannot
  // accidentally imply confirmation.
  //
  // So: a present pin is rendered NEUTRAL. Never green, never a check mark,
  // never a "verified" pill. Green means "we checked and it is good", and we
  // did not check and cannot. The pin always carries its unverifiable marker,
  // in every state, forever. If a later edit makes a bound pin look healthier
  // than an absent one, that edit has reintroduced the defect.
  //
  // ── THE FIVE ROOM STATES, AND WHY THEY ARE FIVE ──────────────────────────
  //
  // Every one of these produces ABSENCE of a menu id except the last two, and
  // absence is what a UI renders by leaving a gap. Left alone they collapse
  // into one grey nothing that reads as "off", which is a claim nobody made:
  //
  //   1. absent          NO ROW EXISTS. Nobody ever created this room. The API
  //                      synthesises the slot and stamps `absent: true` so the
  //                      room cannot be invisible. A REAL row carries no
  //                      `absent` key at all — verified against the live route,
  //                      which is why the test below is `=== true` and not a
  //                      truthiness check on a field that is usually missing.
  //   2. unprovisioned   The row exists. We have never asked Weedmaps for it.
  //   3. requested       We asked. We are waiting. Still no menu id.
  //   4. live            Bound to a menu id AND switched on. Publishing.
  //   5. parked          Bound to a menu id and `active: false`. It still HOLDS
  //                      the id — UNIQUE(wm_menu_id) means nobody else can take
  //                      it — and it publishes NOTHING, because
  //                      menu_ids_for_city(active_only=True) drops it. Verified:
  //                      with corona/express active=0, menu_ids_for_city()
  //                      returned [] while the row still held 342170487.
  //
  // (1) and (2) are the pair this product keeps collapsing. "There is no room"
  // and "there is a room and we never asked for a menu" have different next
  // moves — create the row, versus go ask Weedmaps — and rendering both as an
  // empty cell is how a room nobody has ever thought about reads as a room
  // somebody decided to leave off.
  //
  // Two more states exist and are NOT counted among the five, because they are
  // not states of the room — they are states of a payload this screen does not
  // understand. They render as errors and are never folded into (1)–(5):
  //   * unknown_state   provision_state is not live/requested/unprovisioned
  //   * no_slot         the `rooms` object has no key for this room at all
  //
  // ── WHY THERE IS NO EDIT FORM ────────────────────────────────────────────
  //
  // POST /api/city, /api/city/room, /api/city/pin/clear and /api/city/room/
  // delete all exist and all write. This screen calls none of them. The reason
  // is specific rather than timid: the field an edit form would exist to set is
  // the ONE field in this estate that nothing can check afterwards. The API's
  // own write protocol — carried in the payload as `write_protocol` — is that
  // an OMITTED field keeps the stored value and an explicit null is REFUSED,
  // because a PATCH-shaped form posting only what it touched had already
  // nulled an operator's pin once. Shipping a form here without exercising
  // every one of those refusals against a live server would be shipping the
  // same defect back. The routes are named on screen, with the exact bodies,
  // so an operator is never stuck — they are just not fired from here yet.
  //
  // ── INVENT NO DATA ───────────────────────────────────────────────────────
  //
  // Everything on this screen comes from GET /api/cities. There is no listing
  // name, no listing URL, no menu contents, no stock, no "last synced" and no
  // health score, because no endpoint returns any of those for a city. A
  // fabricated one would be read off the screen and believed.

  const ROUTE = '/api/cities';

  function base() {
    try { if (window.HW_LIVE && window.HW_LIVE.base) { return window.HW_LIVE.base; } } catch (e) {}
    return window.location.origin;
  }

  // One shape for every read, so a caller can never confuse "the route is not
  // there" with "the route said there is nothing". The live deployment 404s
  // this path today — verified — and a 404 must never render as "no cities".
  function getJSON(path) {
    const url = base() + path;
    return fetch(url, { credentials: 'omit', cache: 'no-store' }).then(function (res) {
      return res.text().then(function (txt) {
        let body = null, parsed = false;
        try { body = JSON.parse(txt); parsed = true; } catch (e) {}
        return { url: url, code: res.status, ok: res.ok, body: body, parsed: parsed,
          raw: String(txt).slice(0, 400) };
      });
    }).catch(function (e) {
      return { url: url, code: 0, ok: false, body: null, parsed: false, raw: '',
        netError: (e && e.message) || 'request failed' };
    });
  }

  // ── THREE outcomes, never two ────────────────────────────────────────────
  //   undefined  nothing answered, or the answer had no `cities` key at all
  //   []         the route answered and holds no cities
  //   [rows]     real cities
  // The house pattern (screen-catalog.jsx batchRowsOf) applied to the one
  // question this screen is for.
  function cityRowsOf(body) {
    if (!body || typeof body !== 'object') { return undefined; }
    if (!Array.isArray(body.cities)) { return undefined; }
    return body.cities.filter(function (c) { return c && typeof c === 'object'; });
  }

  // Same three outcomes for the what-is-broken read. `unmapped` is deliberately
  // lists and not booleans on the server side; an EMPTY list there is a real
  // claim ("we computed this and found none") and a MISSING key is not.
  function gapListOf(body, key) {
    const u = body && body.unmapped;
    if (!u || typeof u !== 'object') { return undefined; }
    if (!Array.isArray(u[key])) { return undefined; }
    return u[key];
  }

  const ROOMS_FALLBACK = ['express', 'scheduled'];
  // The room names come from the payload. Hardcoding them would let a server
  // that grew a third room render as if it had two.
  function roomNamesOf(body) {
    const r = body && body.rooms;
    return Array.isArray(r) && r.length ? r.map(String) : ROOMS_FALLBACK;
  }

  // ── the state machine ────────────────────────────────────────────────────
  // ORDER MATTERS, exactly as it does in screen-brands.jsx's verdict(). The
  // `absent` test is FIRST because a synthesised slot also carries
  // provision_state 'unprovisioned' and active false — so testing
  // provision_state first would render "no row exists at all" as "there is a
  // room we never asked about", which is the conflation this file exists to
  // prevent. Verified against the live route: corona/scheduled comes back
  // {absent: true, provision_state: 'unprovisioned', active: false} while
  // west-la/scheduled — a REAL row — comes back with the same
  // provision_state, active TRUE, and no `absent` key whatsoever.
  function roomState(slot) {
    if (!slot || typeof slot !== 'object') { return 'no_slot'; }
    if (slot.absent === true) { return 'absent'; }
    const ps = slot.provision_state;
    if (ps === 'live') { return slot.active === true ? 'live' : 'parked'; }
    if (ps === 'requested') { return 'requested'; }
    if (ps === 'unprovisioned') { return 'unprovisioned'; }
    return 'unknown_state';
  }

  // Does this room push anything to Weedmaps right now? This mirrors
  // cities.menu_ids_for_city(active_only=True) — a menu id AND active — and
  // nothing else. Re-derived, not assumed: with the room's active flag off,
  // menu_ids_for_city returned [] while city_rooms still reported the id.
  function publishesNow(slot) {
    return !!(slot && slot.wm_menu_id != null && slot.active === true);
  }

  // The pin. THREE outcomes and not one of them is "verified".
  //   absent            no wm_listing_id at all
  //   unverifiable      a pin is stored and nothing can ever check it
  //   claims_verifiable the payload said verification is possible — which no
  //                     deployment has ever said, so it renders as a WARNING
  //                     that the contract changed, not as a green light.
  function pinState(city, verifiable) {
    const pin = city && city.wm_listing_id;
    if (pin == null || String(pin) === '') { return 'absent'; }
    return verifiable === true ? 'claims_verifiable' : 'unverifiable';
  }

  // `wm_listing_id_verifiable` missing is NOT the same as it being false, and
  // this is the one place a default is allowed — because the safe default and
  // the honest default agree. Returns the raw tri-state so the banner can say
  // which one it got.
  function verifiableFlag(body) {
    if (!body || typeof body !== 'object') { return undefined; }
    if (typeof body.wm_listing_id_verifiable !== 'boolean') { return undefined; }
    return body.wm_listing_id_verifiable;
  }

  function labelOf(c) {
    return (c && (c.label || c.city)) || '(unnamed city)';
  }

  // ── per-state copy ───────────────────────────────────────────────────────
  // `kind` is the Pill tone. NOTHING here is 'good' except a room that is
  // actually publishing, and nothing about a pin is ever 'good' at all.
  const ROOM_META = {
    absent: {
      kind: 'ghost', label: 'no room row',
      short: 'no row exists',
      why: 'This city has no row for this room at all. Nobody has ever created it. The API synthesises the slot and stamps absent: true so a room cannot be invisible — a real row carries no absent key.',
      next: 'Create it: POST /api/city/room {city, room}. That is a different move from asking Weedmaps for a menu.'
    },
    unprovisioned: {
      kind: 'info', label: 'row exists · never asked',
      short: 'never asked Weedmaps',
      why: 'The row exists and holds no menu id. We have never asked Weedmaps to provision this room. This is not the same as there being no room, and it is not the same as having asked.',
      next: 'Ask Weedmaps for the menu, then POST /api/city/room {city, room, wm_menu_id}.'
    },
    requested: {
      kind: 'warn', label: 'asked · waiting',
      short: 'asked, no id yet',
      why: 'We have asked Weedmaps for this room and hold no menu id yet. Nothing publishes here until an id arrives. The schema forbids this state from holding an id, so a "requested" room with a number in it cannot exist.',
      next: 'When the id lands: POST /api/city/room {city, room, wm_menu_id}. It moves to live in the same write.'
    },
    live: {
      kind: 'good', label: 'live',
      short: 'publishing',
      why: 'Bound to a menu id and switched on. This room is in menu_ids_for_city(active_only=True), so every kit and shift write in this city’s regions reconciles it.',
      next: null
    },
    parked: {
      kind: 'warn', label: 'bound · switched off',
      short: 'holds the id, publishes nothing',
      why: 'The row still holds its menu id and active is false, so menu_ids_for_city(active_only=True) drops it and it publishes nothing. It is NOT unprovisioned: the id is still claimed, and UNIQUE(wm_menu_id) means no other city can take it while this row holds it.',
      next: 'Switch it back on with POST /api/city/room {city, room, active: true}, or release the id with POST /api/city/room/delete.'
    },
    unknown_state: {
      kind: 'bad', label: 'unrecognised state',
      short: 'not one of the five',
      why: 'provision_state is not live, requested or unprovisioned. This screen refuses to guess which of the five states it meant — a guess here is how an unknown becomes an answer.',
      next: 'Read the row directly: GET /api/cities/{city}.'
    },
    no_slot: {
      kind: 'bad', label: 'room key missing',
      short: 'payload has no such room',
      why: 'The payload’s rooms object has no key for this room. The API emits BOTH rooms on every city, always, so this is a response this screen does not understand — it is not an empty room.',
      next: 'Read the row directly: GET /api/cities/{city}.'
    }
  };

  function metaOf(state) { return ROOM_META[state] || ROOM_META.unknown_state; }

  // ── the explainer ────────────────────────────────────────────────────────
  // Top of the page, never collapsed. Someone who has never seen this system
  // has to be able to read the owner's model off the screen.
  function Explainer() {
    const P = useP();
    const box = (title, sub, tone) => (
      <div style={{ flex: '1 1 0', minWidth: 148, padding: '11px 13px',
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
        <Eyebrow>One listing per city. Never two.</Eyebrow>
        <div style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink, margin: '8px 0 4px', letterSpacing: '-.01em' }}>
          Our regions roll up to a city. The city is what Weedmaps sees.
        </div>
        <div style={{ fontSize: P.type.body, color: P.ink2, lineHeight: 1.6, maxWidth: 940 }}>
          A <strong>region</strong> is ours &mdash; a stocking area with drivers and zips. A <strong>city</strong> is
          {' '}theirs: one Weedmaps listing, and one or more of our regions behind it. A city listing holds exactly
          {' '}<strong>two rooms</strong> &mdash; <code style={{ fontFamily: P.fontMono, fontSize: P.type.meta, background: P.surface3, padding: '1px 5px', borderRadius: P.r8 }}>express</code>
          {' '}and <code style={{ fontFamily: P.fontMono, fontSize: P.type.meta, background: P.surface3, padding: '1px 5px', borderRadius: P.r8 }}>scheduled</code> &mdash;
          {' '}each with its own menu id. Two listings for one city is not a rule somebody enforces here; it is a row that
          {' '}cannot be written, because the table is keyed <code style={{ fontFamily: P.fontMono, fontSize: P.type.meta }}>(city, room)</code>.
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {box('Our regions', 'zips · drivers · the stock that exists', 'us')}
          {arrow('roll up to')}
          {box('A city', 'one row · one pin · the thing they list', 'link')}
          {arrow('is listed as')}
          {box('One WM listing', 'wm_listing_id — operator-entered', 'them')}
          {arrow('holding')}
          {box('Two rooms', 'express + scheduled, one menu id each', 'them')}
        </div>
      </Card>);
  }

  // ── the pin, and the sentence that must always sit next to it ────────────
  function PinLine({ city, verifiable }) {
    const P = useP();
    const st = pinState(city, verifiable);
    const mono = { fontFamily: P.fontMono, fontSize: P.type.numRow, fontWeight: 700,
      color: P.ink, letterSpacing: '.01em' };

    if (st === 'absent') {
      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Pill kind="bad" size="sm" icon="ban">no pin</Pill>
            <span style={{ fontSize: P.type.meta, color: P.inkDim }}>
              <code style={{ fontFamily: P.fontMono }}>wm_listing_id</code> is null
            </span>
          </div>
          <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 5, lineHeight: 1.5 }}>
            Nothing points at a Weedmaps listing for this city. Its rooms may still hold menu ids &mdash; a menu and a
            {' '}listing are different objects &mdash; but the listing this city IS has not been recorded.
          </div>
        </div>);
    }

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
          <span style={mono}>{String(city.wm_listing_id)}</span>
          {/* NEUTRAL. Never good, never a check mark. See the header. */}
          <Pill kind={st === 'claims_verifiable' ? 'warn' : 'neutral'} size="sm" icon="help">
            {st === 'claims_verifiable' ? 'payload claims this is checkable' : 'cannot be verified'}
          </Pill>
        </div>
        <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 5, lineHeight: 1.5 }}>
          {st === 'claims_verifiable'
            ? <span><strong>The payload set <code style={{ fontFamily: P.fontMono }}>wm_listing_id_verifiable: true</code>.</strong> No deployment
              {' '}has ever said that and this screen has no check to run. Treat it as a contract change to investigate, not as confirmation.</span>
            : <span>Operator-entered, and <strong>unverifiable by design</strong>. The partner API exposes menus, not listings, so there is no
              {' '}call that can tell a correct pin from a typo. A wrong digit here is invisible to every check we can write.</span>}
        </div>
      </div>);
  }

  // ── one room slot ────────────────────────────────────────────────────────
  function RoomSlot({ room, slot }) {
    const P = useP();
    const state = roomState(slot);
    const m = metaOf(state);
    const pub = publishesNow(slot);
    const id = slot && slot.wm_menu_id != null ? String(slot.wm_menu_id) : null;

    return (
      <div data-hw-room={room} data-hw-room-state={state} style={{
        flex: '1 1 250px', minWidth: 0, padding: '12px 13px',
        background: state === 'live' ? P.surface2 : P.surface,
        border: '1px solid ' + (state === 'unknown_state' || state === 'no_slot' ? P.bad : P.hairline2),
        // A room with no row is drawn DASHED. The border is doing the same job
        // as the words: this is a slot, not a thing.
        borderStyle: state === 'absent' ? 'dashed' : 'solid',
        borderRadius: P.r10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: P.fontMono, fontSize: P.type.meta, fontWeight: 700,
            color: P.ink2, letterSpacing: '.04em', textTransform: 'uppercase' }}>{room}</span>
          <Pill kind={m.kind} size="sm">{m.label}</Pill>
        </div>

        <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
          {id
            ? <span style={{ fontFamily: P.fontMono, fontSize: P.type.numRow, fontWeight: 700, color: P.ink }}>{id}</span>
            : <span style={{ fontSize: P.type.meta, color: P.inkMute, fontStyle: 'italic' }}>no menu id &mdash; {m.short}</span>}
          {id && <span style={{ fontSize: P.type.micro, color: P.inkMute, fontFamily: P.fontMono }}>wm_menu_id</span>}
        </div>

        {/* The consequence line. Present in EVERY state, so "publishes nothing"
            is said out loud rather than inferred from a missing badge. */}
        <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name={pub ? 'zap' : 'ban'} size={12} stroke={2} color={pub ? P.good : P.inkMute} />
          <span style={{ fontSize: P.type.meta, fontWeight: 600, color: pub ? P.good : P.inkDim }}>
            {pub ? 'publishing now' : 'publishes nothing'}
          </span>
        </div>

        <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 7, lineHeight: 1.5 }}>{m.why}</div>
        {m.next &&
          <div style={{ fontSize: P.type.micro, color: P.inkMute, marginTop: 6, lineHeight: 1.5,
            fontFamily: P.fontMono }}>{m.next}</div>}
      </div>);
  }

  // ── one city ─────────────────────────────────────────────────────────────
  function CityCard({ city, roomNames, verifiable }) {
    const P = useP();
    const rooms = (city && city.rooms) || {};
    const regions = Array.isArray(city && city.regions) ? city.regions : undefined;
    const off = city && city.active === false;

    return (
      <Card density="roomy" data-hw-city={city.city} style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <Icon name="map-pin" size={16} stroke={1.9} color={P.inkMute} />
              <span style={{ fontSize: P.type.title, fontWeight: 700, color: P.ink, letterSpacing: '-.01em' }}>{labelOf(city)}</span>
              {off && <Pill kind="warn" size="sm" icon="alert">city switched off</Pill>}
            </div>
            <div style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.inkMute, marginTop: 3 }}>{city.city}</div>
          </div>
          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <div style={{ fontSize: P.type.micro, color: P.inkMute, letterSpacing: '.06em',
              textTransform: 'uppercase', fontWeight: 700, marginBottom: 5 }}>The pin</div>
            <PinLine city={city} verifiable={verifiable} />
          </div>
        </div>

        {off &&
          <div style={{ marginTop: 11, padding: '9px 11px', background: P.warnSoft,
            border: '1px solid ' + P.hairline2, borderRadius: P.r10,
            fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5 }}>
            <strong>&ldquo;Switched off&rdquo; does not mean &ldquo;not publishing&rdquo;.</strong> An inactive city is skipped by the
            {' '}broad heal, which walks <code style={{ fontFamily: P.fontMono }}>cities(active_only=True)</code> &mdash; but a write
            {' '}scoped to one of its regions still resolves through
            {' '}<code style={{ fontFamily: P.fontMono }}>city_of_region()</code> &rarr; <code style={{ fontFamily: P.fontMono }}>menu_ids_for_city()</code>,
            {' '}which does not filter on the city&rsquo;s own active flag. Re-derived on a scratch database: with this flag off,
            {' '}the region path still returned the room&rsquo;s menu id. The rooms below are the authority on what publishes.
          </div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 13, flexWrap: 'wrap' }}>
          {roomNames.map(function (r) {
            return <RoomSlot key={r} room={r} slot={rooms[r]} />;
          })}
        </div>

        <div style={{ marginTop: 12, paddingTop: 11, borderTop: '1px solid ' + P.hairline }}>
          <div style={{ fontSize: P.type.micro, color: P.inkMute, letterSpacing: '.06em',
            textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Our regions behind this listing</div>
          {regions === undefined
            ? <span style={{ fontSize: P.type.meta, color: P.bad }}>
                The payload carried no <code style={{ fontFamily: P.fontMono }}>regions</code> array for this city, so this screen does not know what rolls up here. That is not &ldquo;none&rdquo;.
              </span>
            : regions.length === 0
              ? <span style={{ fontSize: P.type.meta, color: P.warn }}>
                  <strong>No region rolls up to this city.</strong> Its listing has no stock behind it &mdash; there is no region to draw from, so a provisioned room here would publish an empty menu.
                </span>
              : <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {regions.map(function (r) { return <Pill key={r} kind="neutral" size="sm">{r}</Pill>; })}
                </div>}
        </div>
      </Card>);
  }

  // ── where every number came from ─────────────────────────────────────────
  function SourceBanner({ http, body, verifiable, roomNames }) {
    const P = useP();
    const line = (icon, kind, text) => (
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 0' }}>
        <span style={{ flex: '0 0 auto', marginTop: 1,
          color: kind === 'bad' ? P.bad : kind === 'warn' ? P.warn : kind === 'good' ? P.good : P.inkMute }}>
          <Icon name={icon} size={14} stroke={2} />
        </span>
        <span style={{ fontSize: P.type.meta, color: P.ink2, lineHeight: 1.5 }}>{text}</span>
      </div>);
    return (
      <Card density="compact" style={{ marginBottom: 18, background: P.surface2 }}>
        <Eyebrow>Where everything on this screen came from</Eyebrow>
        <div style={{ marginTop: 6 }}>
          {line('link', http.ok ? 'good' : 'bad',
            <span><code style={{ fontFamily: P.fontMono }}>GET {ROUTE}</code> answered <strong>HTTP {http.code || 'nothing at all'}</strong>
              {http.netError ? ' — ' + http.netError : ''}. Base <code style={{ fontFamily: P.fontMono }}>{base()}</code>.
              {' '}It is the only call this screen makes.</span>)}
          {line('help', verifiable === false ? 'good' : 'warn',
            verifiable === false
              ? <span>The payload states <code style={{ fontFamily: P.fontMono }}>wm_listing_id_verifiable: false</code>. Nothing here has confirmed a pin, and nothing ever can.</span>
              : verifiable === undefined
                ? <span><strong>The payload did not carry <code style={{ fontFamily: P.fontMono }}>wm_listing_id_verifiable</code>.</strong> This screen treats a missing flag as unverifiable, because the safe reading and the true one agree &mdash; but it is a missing field, not a stated one.</span>
                : <span><strong>The payload claims pins ARE verifiable.</strong> That has never been true of this API and this screen still has no check to run. Investigate the contract change.</span>)}
          {line('layers', 'info',
            <span>Rooms per city, from the payload: {roomNames.map(function (r, i) {
              return <span key={r}><code style={{ fontFamily: P.fontMono }}>{r}</code>{i < roomNames.length - 1 ? ', ' : ''}</span>; })}.
              {' '}{body && Array.isArray(body.rooms) ? '' : 'The payload named none, so the two documented rooms are assumed — a third room would not be visible here.'}</span>)}
          {line('lock', 'info',
            <span><strong>Read-only.</strong> This screen sends no writes. The write routes are
              {' '}<code style={{ fontFamily: P.fontMono }}>POST /api/city</code>, <code style={{ fontFamily: P.fontMono }}>/api/city/room</code>,
              {' '}<code style={{ fontFamily: P.fontMono }}>/api/city/pin/clear</code> and <code style={{ fontFamily: P.fontMono }}>/api/city/room/delete</code>
              {body && body.write_protocol
                ? <span>. Their protocol, as the payload states it: an omitted field <em>{String(body.write_protocol.omitted_field)}</em>; an explicit null is <em>{String(body.write_protocol.explicit_null)}</em>.</span>
                : <span>. The payload carried no <code style={{ fontFamily: P.fontMono }}>write_protocol</code>, so their exact merge rules are not shown here rather than guessed.</span>}</span>)}
        </div>
      </Card>);
  }

  // ── the what-is-broken read ──────────────────────────────────────────────
  // Printed as LISTS. The server deliberately returns lists and not booleans,
  // and a count would put an empty estate and a healthy estate on the same
  // line. A MISSING key renders differently from an empty one.
  const GAPS = [
    ['regions_without_city', 'Regions that roll up to no city',
      'These regions have stock and drivers and no listing to publish through. Nothing they hold reaches Weedmaps by the city path.'],
    ['regions_pointing_at_missing_city', 'Regions pointing at a city that does not exist',
      'The rollup names a city slug with no row. This resolves to nothing at write time and reports nothing.'],
    ['cities_without_pin', 'Cities with no listing id',
      'The city exists and nothing records which Weedmaps listing it is.'],
    ['cities_without_regions', 'Cities with no region behind them',
      'Nothing stocks these. A provisioned room here would publish an empty menu.'],
    ['rooms_unprovisioned', 'Rooms holding no menu id',
      'Read this one narrowly. It tests for a null menu id and nothing else, so it merges rooms that were never created with rooms that exist and were never asked for — and it MISSES a room that holds an id with active false, which publishes nothing and is not on this list. Re-derived on a scratch database: with corona/scheduled bound and switched off, menu_ids_for_city returned only the other room while this list named neither. The cards above are the authority; this is a summary.'],
    ['menus_not_claimed_by_any_city', 'Menus routed by region_menus that no city claims',
      'The pickup listing is here by design. So is a half-finished migration, which is why this is reported rather than assumed benign.']
  ];

  function GapPanel({ body }) {
    const P = useP();
    return (
      <Card density="roomy" style={{ marginTop: 20 }}>
        <SectionHead level={3} eyebrow="The what-is-broken read"
          title="Every gap this model can have, named"
          subtitle="From unmapped in the same payload. Each one is a list rather than a count, so an empty estate and a healthy estate cannot look the same." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 11, marginTop: 12 }}>
          {GAPS.map(function (g) {
            const key = g[0], title = g[1], why = g[2];
            const list = gapListOf(body, key);
            const missing = list === undefined;
            const clean = !missing && list.length === 0;
            return (
              <div key={key} data-hw-gap={key} style={{ padding: '11px 12px',
                background: missing ? P.badSoft : clean ? P.surface3 : P.warnSoft,
                border: '1px solid ' + (missing ? P.bad : P.hairline2), borderRadius: P.r10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>{title}</span>
                  {missing
                    ? <Pill kind="bad" size="sm" icon="help">not reported</Pill>
                    : clean
                      ? <Pill kind="good" size="sm" icon="check">none</Pill>
                      : <Pill kind="warn" size="sm">{list.length}</Pill>}
                </div>
                <div style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.inkMute, marginTop: 3 }}>{key}</div>
                <div style={{ marginTop: 8 }}>
                  {missing
                    ? <span style={{ fontSize: P.type.meta, color: P.bad, lineHeight: 1.5 }}>
                        The payload carried no <code style={{ fontFamily: P.fontMono }}>{key}</code> list. Nobody computed this. That is not &ldquo;none&rdquo;.
                      </span>
                    : clean
                      ? <span style={{ fontSize: P.type.meta, color: P.inkDim, lineHeight: 1.5 }}>
                          The server computed this list and it came back empty. This one is a real &ldquo;none&rdquo;.
                        </span>
                      : <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                          {list.map(function (v, i) {
                            return <span key={String(v) + i} style={{ fontFamily: P.fontMono, fontSize: P.type.meta,
                              background: P.surface, border: '1px solid ' + P.hairline2, color: P.ink2,
                              padding: '2px 7px', borderRadius: P.r999 }}>{String(v)}</span>;
                          })}
                        </div>}
                </div>
                <div style={{ fontSize: P.type.micro, color: P.inkMute, marginTop: 8, lineHeight: 1.5 }}>{why}</div>
              </div>);
          })}
        </div>
      </Card>);
  }

  // ── the legend ───────────────────────────────────────────────────────────
  // On screen and not only in the source, because the whole argument of this
  // board is that these five are five.
  const LEGEND_ORDER = ['absent', 'unprovisioned', 'requested', 'live', 'parked'];

  function Legend() {
    const P = useP();
    return (
      <Card density="roomy" style={{ marginTop: 20 }}>
        <SectionHead level={3} eyebrow="Five states, not two"
          title="What a room slot can be"
          subtitle="Four of these five produce no menu id. Rendered as an empty cell they collapse into one grey nothing that reads as “off” — a claim nobody made." />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10, marginTop: 12 }}>
          {LEGEND_ORDER.map(function (s) {
            const m = ROOM_META[s];
            return (
              <div key={s} style={{ padding: '10px 12px', background: P.surface3,
                border: '1px solid ' + P.hairline2, borderRadius: P.r10,
                borderStyle: s === 'absent' ? 'dashed' : 'solid' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <Pill kind={m.kind} size="sm">{m.label}</Pill>
                  <span style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.inkMute }}>{s}</span>
                </div>
                <div style={{ fontSize: P.type.meta, color: P.inkDim, marginTop: 6, lineHeight: 1.5 }}>{m.why}</div>
              </div>);
          })}
        </div>
      </Card>);
  }

  // ── the screen ───────────────────────────────────────────────────────────
  window.CityListingScreen = function CityListingScreen() {
    const P = useP();
    const [http, setHttp] = React.useState(null);
    const [tick, setTick] = React.useState(0);
    const [q, setQ] = React.useState('');

    React.useEffect(function () {
      let dead = false;
      setHttp(null);
      getJSON(ROUTE).then(function (r) { if (!dead) { setHttp(r); } });
      return function () { dead = true; };
    }, [tick]);

    const body = http && http.parsed ? http.body : null;
    const cities = cityRowsOf(body);
    const roomNames = roomNamesOf(body);
    const verifiable = verifiableFlag(body);

    // THREE outcomes carried all the way to the render, never flattened to a
    // list. `undefined` is "nobody answered" and it must not become [].
    const known = cities !== undefined;
    const rows = known ? cities : [];

    const shown = rows.filter(function (c) {
      if (!q) { return true; }
      const t = q.toLowerCase();
      const ids = roomNames.map(function (r) {
        const s = (c.rooms || {})[r];
        return s && s.wm_menu_id != null ? String(s.wm_menu_id) : '';
      }).join(' ');
      return String(c.city || '').toLowerCase().indexOf(t) > -1 ||
             String(c.label || '').toLowerCase().indexOf(t) > -1 ||
             String(c.wm_listing_id || '').toLowerCase().indexOf(t) > -1 ||
             (Array.isArray(c.regions) ? c.regions.join(' ').toLowerCase() : '').indexOf(t) > -1 ||
             ids.indexOf(t) > -1;
    });

    // Every tally is null when nothing answered. A zero would be a measurement
    // and no measurement was taken.
    const tally = known ? rows.reduce(function (a, c) {
      a.cities++;
      if (c.wm_listing_id != null && String(c.wm_listing_id) !== '') { a.pinned++; }
      if (c.active === false) { a.off++; }
      if (Array.isArray(c.regions)) { a.regions += c.regions.length; if (!c.regions.length) { a.noRegion++; } }
      roomNames.forEach(function (r) {
        const slot = (c.rooms || {})[r];
        const st = roomState(slot);
        a.slots++;
        a.byState[st] = (a.byState[st] || 0) + 1;
        if (publishesNow(slot)) { a.publishing++; }
      });
      return a;
    }, { cities: 0, pinned: 0, off: 0, regions: 0, noRegion: 0, slots: 0, publishing: 0, byState: {} }) : null;

    const dash = '—';

    return (
      <div>
        <SectionHead level={1} eyebrow="Our regions → their listing"
          title="Cities &amp; Weedmaps listings"
          subtitle="One listing per city, our regions rolled up behind it, two rooms per listing. This board is the only place that mapping is visible, and the only place its gaps are named."
          action={<PBtn icon="refresh" onClick={function () { setTick(tick + 1); }}>Reload</PBtn>} />

        <Explainer />

        <window.DevNote id="city-pin-unverifiable" tone="warn" defaultOpen
          title="A stored pin is not a checked pin, and never will be">
          <window.DevNoteP>
            <window.DevNoteMono>wm_listing_id</window.DevNoteMono> is typed in by a person and there is <strong>no call
            {' '}that can check it</strong>. The Weedmaps partner API exposes menus; there is no listings endpoint to look a
            {' '}pin up in. A transposed digit produces a city that looks completely configured on this screen and points at
            {' '}somebody else&rsquo;s listing, or at nothing, permanently.
          </window.DevNoteP>
          <window.DevNoteP>
            The payload says so itself &mdash; <window.DevNoteMono>wm_listing_id_verifiable: false</window.DevNoteMono> once at the
            {' '}top and <window.DevNoteMono>wm_listing_id_verified: false</window.DevNoteMono> stamped on every city row &mdash; so
            {' '}that a screen cannot imply confirmation by accident. That is why a filled-in pin renders <strong>neutral</strong> here
            {' '}and never green, and why there is no check mark anywhere near one. Green would mean &ldquo;we looked and it is
            {' '}right&rdquo;. Nobody looked. Nobody can.
          </window.DevNoteP>
          <window.DevNoteP>
            What you <em>can</em> conclude from a pin on this screen: a value is stored, and the schema guarantees no
            {' '}<em>other</em> city holds the same one. What you cannot conclude: that it is the right one, or that a
            {' '}listing with that id exists at all.
          </window.DevNoteP>
        </window.DevNote>

        <window.DevNote id="city-room-absent-vs-unasked" tone="warn"
          title="An empty room is four different facts">
          <window.DevNoteP>
            A room with no menu id can be any of four things, and they have four different next moves: <strong>no row exists</strong>
            {' '}(nobody ever created the room), <strong>the row exists and we never asked Weedmaps</strong>, <strong>we asked and are
            {' '}waiting</strong>, or <strong>it is bound and switched off</strong> &mdash; which still holds its menu id and still blocks
            {' '}every other city from claiming it.
          </window.DevNoteP>
          <window.DevNoteP>
            The first two are the pair that collapses. The API synthesises a missing room and stamps
            {' '}<window.DevNoteMono>absent: true</window.DevNoteMono> on it &mdash; and a REAL row carries no
            {' '}<window.DevNoteMono>absent</window.DevNoteMono> key at all, so the test here is
            {' '}<window.DevNoteMono>=== true</window.DevNoteMono> and it runs <em>before</em> anything reads
            {' '}<window.DevNoteMono>provision_state</window.DevNoteMono>. A synthesised slot carries
            {' '}<window.DevNoteMono>provision_state: 'unprovisioned'</window.DevNoteMono> too, so reading that field first would render
            {' '}&ldquo;this room does not exist&rdquo; as &ldquo;this room exists and we never asked&rdquo;.
          </window.DevNoteP>
          <window.DevNoteP>
            <strong>&ldquo;Publishing&rdquo; is a separate question from all five.</strong> A room publishes only when it holds a menu id
            {' '}<em>and</em> <window.DevNoteMono>active</window.DevNoteMono> is true &mdash; that is exactly what
            {' '}<window.DevNoteMono>menu_ids_for_city(active_only=True)</window.DevNoteMono> returns. So every slot on this board says
            {' '}whether it publishes, in words, in all five states.
          </window.DevNoteP>
        </window.DevNote>

        {!http && <div style={{ marginBottom: 18 }}><SkeletonRows rows={3} /></div>}

        {http && <SourceBanner http={http} body={body} verifiable={verifiable} roomNames={roomNames} />}

        {http && !http.ok &&
          <ErrorState
            title={'GET ' + ROUTE + ' answered HTTP ' + (http.code || 'nothing at all')}
            body={'Nothing answered on the city routes at this base. That is not a report that there are no cities: nothing looked. Every count below reads “not known” for exactly that reason, and none of them reads zero. The public demo host returns 404 on this path today, so an unmigrated deployment lands here too.'}
            detail={http.netError || http.raw || http.url}
            onRetry={function () { setTick(tick + 1); }}
            style={{ background: P.badSoft, borderRadius: P.r12, marginBottom: 18 }} />}

        {http && http.ok && !known &&
          <ErrorState
            title={'GET ' + ROUTE + ' answered HTTP ' + http.code + ' with no cities array'}
            body={'The route responded and the body carried no `cities` list this screen could read. That is a payload shape it does not understand — it is not an empty estate.'}
            detail={http.raw || http.url}
            onRetry={function () { setTick(tick + 1); }}
            style={{ background: P.badSoft, borderRadius: P.r12, marginBottom: 18 }} />}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(172px, 1fr))', gap: 12, marginBottom: 18 }}>
          <KPI label="Cities" value={tally ? tally.cities : dash} icon="map-pin"
            sublabel={tally
              ? (tally.off ? tally.off + ' switched off' : 'all active')
              : 'the route did not answer — not zero'} />
          <KPI label="Cities with a pin" value={tally ? tally.pinned + ' / ' + tally.cities : dash} icon="help"
            sublabel={tally
              ? 'none of them checkable, ever'
              : 'the route did not answer — not zero'} />
          <KPI label="Rooms publishing now" value={tally ? tally.publishing + ' / ' + tally.slots : dash} icon="zap"
            sublabel={tally
              ? 'a menu id AND active'
              : 'the route did not answer — not zero'} />
          {/* These two are counted APART on purpose. Summing them into one
              "rooms with no menu" tile is the collapse this screen exists to
              prevent, and it would be the easiest edit in the world to make. */}
          <KPI label="Rooms with no row" value={tally ? (tally.byState.absent || 0) : dash} icon="ban"
            sublabel={tally ? 'nobody ever created these' : 'the route did not answer — not zero'} />
          <KPI label="Rooms never asked for" value={tally ? (tally.byState.unprovisioned || 0) : dash} icon="help"
            sublabel={tally
              ? (tally.byState.requested || 0) + ' more asked and waiting'
              : 'the route did not answer — not zero'} />
          <KPI label="Regions rolled up" value={tally ? tally.regions : dash} icon="route"
            sublabel={tally
              ? (tally.noRegion ? tally.noRegion + ' cities have none behind them' : 'every city has at least one')
              : 'the route did not answer — not zero'} />
        </div>

        {known && rows.length > 0 &&
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 260px', maxWidth: 420 }}>
              <Field icon="search" placeholder="Filter by city, listing id, menu id or region…"
                value={q} onChange={function (e) { setQ(e.target.value); }} />
            </div>
            <span style={{ fontSize: P.type.meta, color: P.inkMute }}>
              {shown.length} of {rows.length}
            </span>
          </div>}

        {/* `http &&` is load-bearing, not defensive noise: on the first render
            http is null, and a cityRowsOf() that ever returned [] for "nobody
            answered" would reach this branch and read http.code off null,
            white-screening the app. A mutation test proved it does. */}
        {http && known && rows.length === 0 &&
          <EmptyState icon="map-pin" title="The route answered and holds no cities"
            body={'GET ' + ROUTE + ' returned HTTP ' + http.code + ' and an empty cities list. This IS a real “none”: the city tier exists and nothing has been put in it yet. Until a city exists, every region publishes through the legacy region → menu mapping instead.'} />}

        {shown.map(function (c) {
          return <CityCard key={c.city} city={c} roomNames={roomNames} verifiable={verifiable} />;
        })}

        {known && rows.length > 0 && shown.length === 0 &&
          <EmptyState compact icon="filter" title="No city matches this filter"
            body={rows.length + ' cities are loaded; none of them matches what you typed.'} />}

        {http && http.ok && body && <GapPanel body={body} />}

        <Legend />
      </div>);
  };

  // Exported for the state tests, which assert the branch order rather than
  // scraping it back out of rendered text. Attached to the screen function so
  // it cannot collide with anything on window.
  window.CityListingScreen.__states = {
    roomState: roomState, publishesNow: publishesNow, pinState: pinState,
    cityRowsOf: cityRowsOf, gapListOf: gapListOf, verifiableFlag: verifiableFlag,
    roomNamesOf: roomNamesOf
  };
})();
