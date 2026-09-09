// ── Bounty builder — #/contests/new · the form, and the sentence it writes ──
// Design: explorations/Incentives - Concept D - Two Seats.html, tab "4 · Builder"
//         (layout, section order, copy) + explorations/Incentives - Concept C -
//         Campaigns.html, tab "4 · Builder" right rail (the self-rewriting sentence).
// Backend: POST /api/incentives/contests/preview (debounced, 400ms)
//          POST /api/incentives/contests           (save the draft)
//          POST /api/incentives/contests/{id}/submit (brand-funded → approval)
//          GET  /api/incentives/settings · /api/incentives/roster · /contests/{id}
//          Shapes: docs/BOUNTY-API-CONTRACT.md. Plan §3.4 (the model this form is).
//
// THE SENTENCE IS THE BACKEND'S, NOT THIS FILE'S. Every keystroke re-asks the
// server what this bounty says, because the sentence a manager reads has to be
// the one the scorer will actually run — a second sentence composed here would
// drift from it silently, and a manager who cannot read the sentence has not
// built the bounty they think they built (Concept C's argument, verbatim).
// When the backend is unreachable the rail says so; it never falls back to a
// locally-written sentence.
//
// ⚠️ WHY THE HIGHLIGHT IS A STRING MATCH. `POST /contests/preview` returns
// `sentence` as one flat string, so there is no marker saying which fragment
// answers which field. The accent spans are therefore located by matching the
// values THIS FORM actually set (brand names, categories, dollar amounts,
// thresholds) against the returned text — a display nicety that cannot mislead:
// a miss just leaves the fragment un-highlighted. What a manager must not miss
// — the fields still unanswered — is listed separately underneath, computed
// from the draft rather than guessed out of the prose. The clean fix is a
// contract change (sentence as fragments); it is in the report, not worked
// around silently.
//
// "WOULD HAVE COUNTED" IS HISTORY, NOT A FORECAST. `would_have_counted` scores
// this rule against the last seven days of ledger that already happened. It is
// labelled as history everywhere it appears, because a dry run a manager reads
// as a promise is how a brand ends up owed money nobody agreed to.
//
// ROUTING. app.jsx sends both '/contests/new' AND '#/contests/:id/edit' to
// this file (the '/:id/edit' regex is checked before the generic
// '/contests/*' → detail mapping). The draft id therefore comes from
// `props.path` on an edit route; the older '?id=' query form (`props.query`)
// still works as a fallback so a bookmarked or hand-typed link keeps working.
;(function () {
  const useP = window.useP;

  // DEFAULT_AUDIENCE — what a new draft's participants.classes is seeded
  // with, derived from the Classification enum's first value. The backend's
  // own default is the same value (see emptyDraft below for why the draft
  // sends it explicitly rather than leaving it to that default). Falls back
  // to the literal if contracts/index.js has not loaded on this page.
  const DEFAULT_AUDIENCE = window.HWContracts ? [window.HWContracts.enumValues('Classification')[0]] :
    (console.warn('screen-contest-builder: window.HWContracts not loaded — falling back to literal DEFAULT_AUDIENCE'),
      ['budtender']);

  const KINDS = [
    { value: 'spiff', label: 'Spiff', hint: 'Short window, a number to hit, the same reward for everyone who hits it.' },
    { value: 'contest', label: 'Ranked bounty', hint: 'Places, first to third. Can reset hourly for a power-hour shift.' },
    { value: 'team_goal', label: 'Team goal', hint: 'One cumulative number for the whole floor, split when it lands.' },
    { value: 'store_vs_store', label: 'Store vs store', hint: 'Places over stores. The winning store’s floor splits the prize.' },
    { value: 'aov_goal', label: 'AOV goal', hint: 'The absorbed average-order-value goal — a store default with per-person overrides.' },
  ];
  const METRICS = [
    { value: 'net_cents', label: 'Net $' }, { value: 'gross_cents', label: 'Gross $' },
    { value: 'units', label: 'Units' }, { value: 'txn_count', label: 'Orders' }, { value: 'aov_cents', label: 'AOV' },
  ];
  const RECURRENCES = [
    { value: 'none', label: 'Doesn’t repeat' }, { value: 'hourly', label: 'Hourly' },
    { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' },
  ];
  const SCOPES = [
    { value: 'all', label: 'Everyone at these stores' }, { value: 'list', label: 'Pick people' }, { value: 'teams', label: 'Teams' },
  ];
  const UNITS = [
    { value: 'cents', label: 'Dollars' }, { value: 'points', label: 'Points' }, { value: 'recognition', label: 'Recognition only' },
  ];
  const TIE_RULES = [
    { value: 'split', label: 'Split the place' }, { value: 'earliest', label: 'Whoever got there first' },
  ];
  // reward.type is not free — the backend refuses a shape that does not match
  // the kind (plan §3.4), so the form offers only what that kind can be.
  const REWARD_TYPES_FOR_KIND = {
    spiff: ['threshold', 'per_unit'],
    contest: ['places'],
    team_goal: ['team_threshold'],
    store_vs_store: ['places'],
    aov_goal: ['aov'],
  };
  const REWARD_TYPE_LABEL = { threshold: 'Threshold', per_unit: 'Per unit', places: 'Places',
    team_threshold: 'Team threshold', aov: 'AOV goal' };
  // The product taxonomy this estate already has: the P.cat keys in
  // pos/tokens.jsx, minus the three that are not product categories
  // (deals, premium, other). Said out loud in a caption on the field, because
  // a category list a manager cannot trace is a category list they will not
  // trust when a bounty scores nothing.
  const CATEGORY_KEYS = ['flower', 'vape', 'edibles', 'concentrate', 'tincture', 'preroll', 'wellness'];
  const CATEGORY_LABEL = { flower: 'Flower', vape: 'Vape', edibles: 'Edibles', concentrate: 'Concentrate',
    tincture: 'Tincture', preroll: 'Preroll', wellness: 'Wellness' };

  const toast = (t) => { if (window.hdToast) window.hdToast(t); };

  // ── date + money plumbing ───────────────────────────────────────────────
  // The contract's window_start/window_end are ISO-8601 UTC; <input
  // type="datetime-local"> speaks local wall clock. These two convert, and
  // nothing else in this file touches a Date.
  function isoToLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function localInputToIso(v) {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }

  // Money as its own component so the text a manager is mid-typing ("12.") is
  // never reformatted out from under them by the parent's re-render.
  function MoneyField({ value, onChange, placeholder, size = 'sm', style }) {
    const [text, setText] = React.useState(value == null ? '' : String(value / 100));
    return (
      <Field size={size} mono placeholder={placeholder || '$0.00'} value={text} style={style}
        inputMode="decimal"
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          const cleaned = v.replace(/[^0-9.]/g, '');
          if (cleaned.trim() === '') { onChange(null); return; }
          const n = parseFloat(cleaned);
          onChange(Number.isFinite(n) ? Math.round(n * 100) : null);
        }} />);
  }
  function NumField({ value, onChange, placeholder, suffix, size = 'sm', style }) {
    const [text, setText] = React.useState(value == null ? '' : String(value));
    return (
      <Field size={size} mono placeholder={placeholder} value={text} style={style} suffix={suffix}
        inputMode="numeric"
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          const cleaned = v.replace(/[^0-9.]/g, '');
          if (cleaned.trim() === '') { onChange(null); return; }
          const n = parseFloat(cleaned);
          onChange(Number.isFinite(n) ? n : null);
        }} />);
  }

  // ── small local pieces ──────────────────────────────────────────────────
  function CardHead({ icon, title, right, tone }) {
    const P = useP();
    const fg = tone === 'warn' ? P.warnText : tone === 'accent' ? P.accentText : P.inkDim;
    const bg = tone === 'warn' ? P.warnSoft : tone === 'accent' ? P.accentSoft : P.surface3;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: `1px solid ${P.hairline}` }}>
        {icon && (
          <span style={{ width: 28, height: 28, borderRadius: P.r8, background: bg, color: fg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
            <Icon name={icon} size={15} stroke={1.8} />
          </span>)}
        <span style={{ flex: 1, minWidth: 0, fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>{title}</span>
        {right}
      </div>);
  }
  function FLabel({ children, hint }) {
    const P = useP();
    return (
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontSize: P.type.meta, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: P.inkDim }}>{children}</span>
        {hint && <span style={{ display: 'block', marginTop: 3, fontSize: P.type.meta, color: P.inkMute, lineHeight: 1.5 }}>{hint}</span>}
      </div>);
  }
  // Seg has no wrap, and the kind/metric rows are five options wide, so every
  // Seg here sits in its own scroll box rather than pushing the page sideways.
  function SegRow({ children }) {
    return <div style={{ overflowX: 'auto', maxWidth: '100%', paddingBottom: 2 }}>{children}</div>;
  }
  function Hint({ children }) {
    const P = useP();
    return <div style={{ marginTop: 6, fontSize: P.type.meta, color: P.inkMute, lineHeight: 1.5 }}>{children}</div>;
  }
  // A selectable chip. Deliberately not a Pill: a Pill is a status, and this is
  // a control — Concept D's own note.
  function Chip({ on, onClick, children, muted, removable }) {
    const P = useP();
    return (
      <button data-hw-i type="button" onClick={onClick}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: P.ctrlH.xs, padding: '0 10px',
          fontSize: P.type.body, fontWeight: 600, fontFamily: P.fontSans, cursor: 'pointer',
          background: on ? P.accentSoft : P.surface, color: on ? P.accentText : muted ? P.inkMute : P.ink2,
          border: `1px solid ${on ? P.accentBorder : P.hairline2}`, borderRadius: P.r999,
          opacity: muted ? 0.6 : 1 }}>
        {children}{removable && <Icon name="x" size={12} stroke={2.2} />}
      </button>);
  }
  function Problem({ children }) {
    const P = useP();
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 8, fontSize: P.type.body, color: P.bad, lineHeight: 1.5 }}>
        <Icon name="alert" size={14} stroke={2} color={P.bad} style={{ marginTop: 1, flex: '0 0 auto' }} />
        <span>{children}</span>
      </div>);
  }

  // ── the draft ───────────────────────────────────────────────────────────
  function emptyDraft(storeId) {
    return {
      name: '', description: '', kind: 'spiff', metric: 'units',
      filter: { brands: [], categories: [], products: [], min_line_cents: 0 },
      store_ids: storeId ? [storeId] : [],
      // `classes` IS SENT EXPLICITLY, never left to the backend's default.
      // The default happens to be the same DEFAULT_AUDIENCE — that is what
      // keeps every bounty written before audiences existed meaning the
      // floor — but a builder whose summary sentence names an audience it
      // did not send is one release away from describing a bounty it did
      // not create. `.slice()` so each draft owns its own array instance.
      participants: { scope: 'all', classes: DEFAULT_AUDIENCE.slice(), associate_ids: [], teams: [] },
      window_start: '', window_end: '', tz: '', recurrence: 'none',
      reward: { type: 'threshold', unit: 'cents' },
      funding: { funded_by: 'store', brand: null, budget_cents: null, cap_per_person_cents: null },
      tie_rule: 'split',
    };
  }

  // Validation mirrors the backend's own refusals (contract: 400 with
  // {error}), so a manager is told here rather than after a round trip. It
  // never *replaces* the backend's answer — a 400 still surfaces as a toast.
  function validate(d) {
    const out = [];
    if (!d.name || !d.name.trim()) out.push({ at: 'name', msg: 'Give it a name — it is what a budtender sees on the board.' });
    if (d.window_start && d.window_end && new Date(d.window_end) <= new Date(d.window_start)) {
      out.push({ at: 'window', msg: 'The window has to end after it starts.' });
    }
    if (!d.window_start || !d.window_end) out.push({ at: 'window', msg: 'Set when it starts and when it ends.' });
    const allowed = REWARD_TYPES_FOR_KIND[d.kind] || [];
    if (allowed.indexOf(d.reward.type) === -1) {
      out.push({ at: 'reward', msg: `A ${(KINDS.find((k) => k.value === d.kind) || {}).label} pays ${allowed.map((t) => REWARD_TYPE_LABEL[t].toLowerCase()).join(' or ')}. Pick that shape, or change the kind.` });
    }
    if (d.reward.type === 'threshold' && (d.reward.threshold == null || d.reward.amount_cents == null)) {
      out.push({ at: 'reward', msg: 'A threshold reward needs both the number to hit and what hitting it pays.' });
    }
    if (d.reward.type === 'per_unit' && d.reward.amount_cents == null) {
      out.push({ at: 'reward', msg: 'A per-unit reward needs a rate per unit.' });
    }
    if (d.reward.type === 'places' && (!d.reward.places || d.reward.places.length === 0)) {
      out.push({ at: 'reward', msg: 'A places reward needs at least one place with an amount.' });
    }
    if (d.reward.type === 'team_threshold' && (d.reward.threshold == null || d.reward.amount_cents == null)) {
      out.push({ at: 'reward', msg: 'A team goal needs the number the team has to reach and what it pays.' });
    }
    if (d.reward.type === 'aov' && d.reward.goal_cents == null) {
      out.push({ at: 'reward', msg: 'An AOV goal needs the average order value to aim at.' });
    }
    if (!(d.participants.classes || []).length) {
      out.push({ at: 'who', msg: 'Pick at least one audience. A bounty open to nobody can never be won — the backend refuses it too.' });
    }
    if (d.participants.scope === 'list' && d.participants.associate_ids.length === 0) {
      out.push({ at: 'who', msg: 'Nobody is in it. Pick at least one person, or switch back to everyone.' });
    }
    if (d.participants.scope === 'teams' && !(d.participants.teams || []).some((t) => t.associate_ids.length > 0)) {
      out.push({ at: 'who', msg: 'No team has anyone in it. Add someone, or switch back to everyone.' });
    }
    if (d.funding.funded_by === 'brand' && !d.funding.brand) {
      out.push({ at: 'funding', msg: 'A brand-funded bounty needs the brand that funds it.' });
    }
    return out;
  }

  // Fragments of the sentence this form can claim to have answered. Only
  // values typed into the form — never a guess about the prose around them.
  function answeredFragments(d) {
    const f = window.HWInc.fmt;
    const out = [];
    (d.filter.brands || []).forEach((b) => out.push(b));
    (d.filter.categories || []).forEach((c) => out.push(CATEGORY_LABEL[c] || c));
    (d.filter.products || []).forEach((p) => out.push(p));
    if (d.name) out.push(d.name);
    if (d.funding.brand) out.push(d.funding.brand);
    if (d.reward.threshold != null) out.push(String(d.reward.threshold));
    if (d.reward.amount_cents != null) out.push(f.cents(d.reward.amount_cents));
    if (d.reward.cap_cents != null) out.push(f.cents(d.reward.cap_cents));
    if (d.reward.goal_cents != null) out.push(f.cents(d.reward.goal_cents));
    if (d.funding.budget_cents != null) out.push(f.cents(d.funding.budget_cents));
    if (d.funding.cap_per_person_cents != null) out.push(f.cents(d.funding.cap_per_person_cents));
    (d.reward.places || []).forEach((p) => { if (p.amount_cents != null) out.push(f.cents(p.amount_cents)); });
    return out;
  }
  const escapeRx = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Contract addenda (2026-09-08): POST /contests/preview now returns
  // `fragments: [{text, field, answered}]` in reading order, whose
  // concatenation is `sentence` — a real seam instead of the string-match
  // heuristic below. Answered fragments get the same accent treatment the
  // heuristic gave a matched value; an unanswered fragment is muted so the
  // manager sees exactly which piece of the sentence is still a placeholder.
  function FragmentSentence({ fragments }) {
    const P = useP();
    return (
      <span style={{ color: P.ink2 }}>
        {fragments.map((f, i) => (
          <span key={i} style={f.answered
            ? { background: P.accentSoft, color: P.accentText, borderRadius: P.r8, padding: '1px 5px', fontWeight: 600 }
            : { color: P.inkMute }}>{f.text}</span>))}
      </span>);
  }

  // Fallback only: used when the backend has not yet started returning
  // `fragments` for this preview response. Locates the values THIS FORM set
  // inside the flat `sentence` string by substring match — see the file
  // header's "WHY THE HIGHLIGHT IS A STRING MATCH" note.
  function SentenceText({ sentence, fragments }) {
    const P = useP();
    if (!sentence) return null;
    const uniq = Array.from(new Set(fragments.filter((x) => x && String(x).length >= 2)))
      .sort((a, b) => String(b).length - String(a).length);
    if (uniq.length === 0) return <span style={{ color: P.ink2 }}>{sentence}</span>;
    // A bare number like "10" also occurs inside "2026-09-10", so numeric
    // fragments are fenced with zero-width lookarounds. Lookbehind is not
    // universal (Safari < 16.4), so a build without it falls back to the plain
    // alternation rather than throwing — a stray highlight is a cosmetic miss,
    // an exception here would take the rail down.
    const alt = uniq.map((u) => (/^[\d.,$]+$/.test(String(u))
      ? '(?<![\\w-])' + escapeRx(u) + '(?![\\w-])' : escapeRx(u)));
    let rx;
    try { rx = new RegExp('(' + alt.join('|') + ')', 'g'); }
    catch (e) { rx = new RegExp('(' + uniq.map(escapeRx).join('|') + ')', 'g'); }
    const parts = String(sentence).split(rx);
    return (
      <span style={{ color: P.ink2 }}>
        {parts.map((part, i) => (uniq.indexOf(part) > -1 ? (
          <span key={i} style={{ background: P.accentSoft, color: P.accentText, borderRadius: P.r8,
            padding: '1px 5px', fontWeight: 600 }}>{part}</span>
        ) : <React.Fragment key={i}>{part}</React.Fragment>))}
      </span>);
  }

  // What is still unanswered, computed from the draft — the half of Concept C's
  // rail that a flat sentence string cannot give us.
  function stillToAnswer(d) {
    const out = [];
    if (!d.name || !d.name.trim()) out.push('a name');
    if (!d.window_start || !d.window_end) out.push('when it runs');
    if (!d.tz) out.push('a time zone');
    if ((d.store_ids || []).length === 0) out.push('which stores (empty means every store)');
    const r = d.reward;
    if (r.type === 'threshold' && (r.threshold == null || r.amount_cents == null)) out.push('the reward');
    if (r.type === 'per_unit' && r.amount_cents == null) out.push('the rate per unit');
    if (r.type === 'places' && (!r.places || !r.places.length)) out.push('the places');
    if (r.type === 'team_threshold' && (r.threshold == null || r.amount_cents == null)) out.push('the team goal and what it pays');
    if (r.type === 'aov' && r.goal_cents == null) out.push('the AOV to aim at');
    if (d.funding.funded_by === 'brand' && !d.funding.brand) out.push('which brand funds it');
    return out;
  }

  // ── the screen ──────────────────────────────────────────────────────────
  function Builder({ navigate, query, path, session, store }) {
    // A NEW BOUNTY STARTS AT THE STORE THE MANAGER IS LOOKING AT. On "All
    // stores" it starts with no store pre-picked rather than with an arbitrary
    // one — the store_ids picker below lists every store either way, and a
    // silently pre-selected store is how a bounty gets written for the wrong
    // one.
    const viewingAll = (store && store.id) === 'all';
    const homeStore = viewingAll ? null : ((store && store.id) || session.storeId);
    const P = useP();
    const S = window.IncShared;
    // `#/contests/:id/edit` is the real route (app.jsx); the older '?id='
    // query form is kept as a fallback for a bookmarked or hand-typed link.
    const pathMatch = /^\/contests\/([^/]+)\/edit$/.exec(path || '');
    const editId = (pathMatch && pathMatch[1]) || (query && query.get ? query.get('id') : null);

    const [draft, setDraft] = React.useState(() => emptyDraft(homeStore));
    const [loadingDraft, setLoadingDraft] = React.useState(!!editId);
    const [loadError, setLoadError] = React.useState(null);
    const [reloadTick, setReloadTick] = React.useState(0);
    const [settings, setSettings] = React.useState(null);
    const [roster, setRoster] = React.useState(null);
    const [preview, setPreview] = React.useState({ loading: false, error: null, incomplete: null, sentence: null, fragments: null, would: null });
    const [saving, setSaving] = React.useState(null); // 'draft' | 'submit'
    const [brandQuery, setBrandQuery] = React.useState('');
    const [productText, setProductText] = React.useState('');
    const [showProblems, setShowProblems] = React.useState(false);

    const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
    const setFilter = (patch) => setDraft((d) => ({ ...d, filter: { ...d.filter, ...patch } }));
    const setReward = (patch) => setDraft((d) => ({ ...d, reward: { ...d.reward, ...patch } }));
    const setFunding = (patch) => setDraft((d) => ({ ...d, funding: { ...d.funding, ...patch } }));
    const setParticipants = (patch) => setDraft((d) => ({ ...d, participants: { ...d.participants, ...patch } }));

    // Settings: the store list and each store's tz come from the backend, not
    // from a copy of the store table in this file.
    React.useEffect(() => {
      let alive = true;
      window.HWInc.get('/api/incentives/settings').then((r) => {
        if (!alive || !r.ok) return;
        setSettings(r.body);
        setDraft((d) => {
          if (d.tz) return d;
          const mine = (r.body.stores || []).find((s) => s.id === homeStore);
          const tie = r.body.tie_rule_default;
          return { ...d, tz: mine ? mine.tz : d.tz, tie_rule: tie || d.tie_rule };
        });
      });
      return () => { alive = false; };
    }, []);

    // Editing an existing draft (#/contests/new?id=…).
    React.useEffect(() => {
      if (!editId) return undefined;
      let alive = true;
      window.HWInc.get('/api/incentives/contests/' + encodeURIComponent(editId)).then((r) => {
        if (!alive) return;
        setLoadingDraft(false);
        if (!r.ok) { setLoadError((r.body && r.body.error) || r.error || ('HTTP ' + r.code)); return; }
        const c = r.body && r.body.contest;
        if (c) setDraft({ ...emptyDraft(homeStore), ...c, filter: { ...emptyDraft().filter, ...(c.filter || {}) },
          participants: { ...emptyDraft().participants, ...(c.participants || {}) },
          reward: { ...(c.reward || { type: 'threshold', unit: 'cents' }) },
          funding: { ...emptyDraft().funding, ...(c.funding || {}) } });
      });
      return () => { alive = false; };
    }, [editId, reloadTick]);

    // Roster, only when the form actually needs names.
    const needsRoster = draft.participants.scope !== 'all';
    React.useEffect(() => {
      if (!needsRoster || roster) return undefined;
      let alive = true;
      const q = homeStore ? '?store_id=' + encodeURIComponent(homeStore) : '';
      window.HWInc.get('/api/incentives/roster' + q).then((r) => {
        if (!alive) return;
        setRoster(r.ok && Array.isArray(r.body.roster) ? r.body.roster : []);
      });
      return () => { alive = false; };
    }, [needsRoster]);

    // The sentence, re-asked 400ms after the last keystroke. A `serial` guard
    // keeps a slow earlier answer from overwriting a fast later one.
    const serial = React.useRef(0);
    const draftKey = JSON.stringify(draft);
    React.useEffect(() => {
      const mine = ++serial.current;
      setPreview((p) => ({ ...p, loading: true }));
      const t = setTimeout(() => {
        window.HWInc.post('/api/incentives/contests/preview', draft).then((r) => {
          if (mine !== serial.current) return;
          if (!r.ok) {
            // A 400 that carries a sentence is an INCOMPLETE draft, not a
            // dead backend: the route wrote the sentence around the blanks and
            // named the first thing it cannot score. Only a response with no
            // sentence at all (network, 404, 5xx) means not connected.
            const b = r.body || {};
            if (b.sentence) {
              setPreview({ loading: false, error: null, incomplete: b.error || null, sentence: b.sentence,
                fragments: Array.isArray(b.fragments) ? b.fragments : null, would: null });
              return;
            }
            setPreview({ loading: false, error: b.error || r.error || ('HTTP ' + r.code), incomplete: null, sentence: null, fragments: null, would: null });
            return;
          }
          setPreview({ loading: false, error: null, incomplete: null, sentence: r.body.sentence || null,
            fragments: Array.isArray(r.body.fragments) ? r.body.fragments : null, would: r.body.would_have_counted || null });
        });
      }, 400);
      return () => clearTimeout(t);
    }, [draftKey]);

    const problems = validate(draft);
    const problemsAt = (at) => (showProblems ? problems.filter((p) => p.at === at) : []);

    async function save(mode) {
      if (problems.length > 0) {
        setShowProblems(true);
        toast({ title: 'Not saved yet', description: problems[0].msg, tone: 'warn' });
        return;
      }
      setSaving(mode);
      const body = { ...draft, actor: session.id };
      if (editId) body.id = editId;
      const r = await window.HWInc.post('/api/incentives/contests', body);
      if (!r.ok) {
        setSaving(null);
        toast({ title: 'That didn’t save', description: (r.body && r.body.error) || r.error || ('HTTP ' + r.code), tone: 'blocked' });
        return;
      }
      const id = (r.body && r.body.contest && r.body.contest.id) || editId;
      if (mode === 'submit' && id) {
        const s = await window.HWInc.post('/api/incentives/contests/' + encodeURIComponent(id) + '/submit', { actor: session.id });
        if (!s.ok) {
          setSaving(null);
          toast({ title: isBrandFunded ? 'Saved as a draft, but not submitted' : 'Saved as a draft, but not started',
            description: (s.body && s.body.error) || s.error || ('HTTP ' + s.code), tone: 'warn' });
          if (id) navigate('#/contests/' + id);
          return;
        }
      }
      setSaving(null);
      if (id) navigate('#/contests/' + id); else navigate('#/contests');
    }

    if (loadingDraft) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Skeleton lines={2} />
          <SkeletonRows rows={4} avatar={false} />
        </div>);
    }
    if (loadError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ErrorState title="That draft didn’t load" body="Bounty couldn’t read the draft you asked to edit." detail={loadError}
            onRetry={() => { setLoadError(null); setLoadingDraft(true); setReloadTick((t) => t + 1); }} />
          <div><PBtn size="sm" variant="secondary" icon="arrow-left" onClick={() => navigate('#/contests')}>Back to Bounties</PBtn></div>
        </div>);
    }

    const stores = (settings && settings.stores) || [];
    const brands = (window.HW_BRANDS && window.HW_BRANDS.names) || [];
    const brandMatches = brandQuery.trim()
      ? brands.filter((b) => b.toLowerCase().indexOf(brandQuery.trim().toLowerCase()) > -1).slice(0, 8)
      : [];
    const allowedRewards = REWARD_TYPES_FOR_KIND[draft.kind] || [];
    const isBrandFunded = draft.funding.funded_by === 'brand';

    const toggleIn = (arr, v) => (arr.indexOf(v) > -1 ? arr.filter((x) => x !== v) : arr.concat([v]));

    // ── left column: the form ─────────────────────────────────────────────
    const form = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <Card padding={0}>
          <CardHead icon="lightning" title="1 · Kind and metric" />
          <div style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <FLabel>Name</FLabel>
              <Field size="md" placeholder="What a budtender sees on the board" value={draft.name}
                onChange={(e) => set({ name: e.target.value })} />
              {problemsAt('name').map((p, i) => <Problem key={i}>{p.msg}</Problem>)}
            </div>
            <div>
              <FLabel>Kind</FLabel>
              <SegRow><Seg size="lg" value={draft.kind} options={KINDS.map((k) => ({ value: k.value, label: k.label }))}
                onChange={(v) => {
                  const next = (REWARD_TYPES_FOR_KIND[v] || ['threshold'])[0];
                  setDraft((d) => ({ ...d, kind: v, reward: { ...d.reward, type: next } }));
                }} /></SegRow>
              <Hint>{(KINDS.find((k) => k.value === draft.kind) || {}).hint}</Hint>
            </div>
            <div>
              <FLabel>Metric</FLabel>
              <SegRow><Seg size="lg" value={draft.metric} options={METRICS} onChange={(v) => set({ metric: v })} /></SegRow>
              <Hint>Net is gross minus discounts minus refunds of the same lines. Refunds are netted by transaction, not ignored.</Hint>
            </div>
          </div>
        </Card>

        <Card padding={0}>
          <CardHead icon="tag" title="2 · What counts" />
          <div style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <FLabel>Brands</FLabel>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {draft.filter.brands.map((b) => (
                  <Chip key={b} on removable onClick={() => setFilter({ brands: draft.filter.brands.filter((x) => x !== b) })}>{b}</Chip>))}
                {draft.filter.brands.length === 0 && (
                  <span style={{ fontSize: P.type.meta, fontFamily: P.fontMono, color: P.inkMute }}>none — every brand counts</span>)}
              </div>
              <Field size="sm" icon="search" placeholder="Find a brand" value={brandQuery}
                onChange={(e) => setBrandQuery(e.target.value)} />
              {brandMatches.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {brandMatches.map((b) => (
                    <Chip key={b} on={draft.filter.brands.indexOf(b) > -1}
                      onClick={() => { setFilter({ brands: toggleIn(draft.filter.brands, b) }); setBrandQuery(''); }}>{b}</Chip>))}
                </div>)}
              <Hint>Brand names come from shared/brands.js — the one brand list this estate has, so the filter and the POS catalog cannot disagree.</Hint>
            </div>
            <div>
              <FLabel>Categories</FLabel>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {CATEGORY_KEYS.map((c) => (
                  <Chip key={c} on={draft.filter.categories.indexOf(c) > -1}
                    onClick={() => setFilter({ categories: toggleIn(draft.filter.categories, c) })}>{CATEGORY_LABEL[c]}</Chip>))}
              </div>
              <Hint>These seven are the product taxonomy in pos/tokens.jsx (P.cat), minus deals, premium and other, which are not product categories. If your POS reports a category that is not here, the run report names it rather than merging it silently.</Hint>
            </div>
            <div>
              <FLabel>Products</FLabel>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {draft.filter.products.map((p) => (
                  <Chip key={p} on removable onClick={() => setFilter({ products: draft.filter.products.filter((x) => x !== p) })}>{p}</Chip>))}
                {draft.filter.products.length === 0 && (
                  <span style={{ fontSize: P.type.meta, fontFamily: P.fontMono, color: P.inkMute }}>none</span>)}
              </div>
              <Field size="sm" icon="package" placeholder="Type a product name and press Enter" value={productText}
                onChange={(e) => setProductText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && productText.trim()) {
                    e.preventDefault();
                    setFilter({ products: toggleIn(draft.filter.products, productText.trim()) });
                    setProductText('');
                  }
                }} />
            </div>
            <div>
              <FLabel>Minimum line value</FLabel>
              <MoneyField value={draft.filter.min_line_cents} onChange={(c) => setFilter({ min_line_cents: c == null ? 0 : c })}
                style={{ maxWidth: 180 }} />
              <Hint>Ignores penny lines and bag fees so they can’t pad a unit count.</Hint>
            </div>
          </div>
        </Card>

        <Card padding={0}>
          <CardHead icon="users" title="3 · Who’s in it" />
          <div style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <FLabel>Stores</FLabel>
              {stores.length === 0 ? (
                <div style={{ fontSize: P.type.body, color: P.inkMute }}>
                  The store list comes from the backend and hasn’t answered yet. Leave it empty and the bounty runs at every store.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {stores.map((s) => (
                    <Chip key={s.id} on={draft.store_ids.indexOf(s.id) > -1} muted={s.pos === 'none'}
                      onClick={() => set({ store_ids: toggleIn(draft.store_ids, s.id) })}>
                      {s.name}{s.pos === 'none' ? ' · no data source' : ''}
                    </Chip>))}
                </div>)}
              <Hint>No store selected means every store. A store with no data source is created into the bounty but will never score.</Hint>
            </div>
            <div>
              <FLabel>Audience</FLabel>
              {/* WHICH KIND OF PERSON THIS BOUNTY IS FOR. Drivers are not
                  sales people: a floor spiff that pays the delivery fleet
                  comes out of the floor's prize pool, and a driver bounty
                  that ranks budtenders is scored against a job they do not
                  do. The chips are a multi-select because "drivers and
                  managers" is a real bounty — a depot lead runs one every
                  month — and a single-select would make it two. */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(S.CLASS_ORDER || []).map((id) => {
                  const known = (settings && settings.classes) || [];
                  const hit = known.find((c) => c.id === id);
                  const on = (draft.participants.classes || []).indexOf(id) > -1;
                  return (
                    <Chip key={id} on={on} muted={hit ? hit.count === 0 : false}
                      // TOGGLED OFF `d`, NOT OFF `draft`. `setParticipants`
                      // takes an already-computed patch, so two chip clicks
                      // that land in one React batch both read the same stale
                      // draft and the second silently discards the first —
                      // "add drivers, drop budtenders" ends as an empty
                      // audience. Reading the previous state inside the
                      // updater is the only form that composes.
                      onClick={() => setDraft((d) => ({ ...d, participants: { ...d.participants, classes: toggleIn(d.participants.classes || [], id) } }))}>
                      {(hit && hit.label) || S.classLabel(id)}
                      {hit ? ` · ${hit.count}` : ''}
                    </Chip>);
                })}
              </div>
              <Hint>Only these people are ranked, and only they can be paid. A class with nobody in it is dimmed — classify people on the Data screen.</Hint>
            </div>
            <div>
              <FLabel>Participants</FLabel>
              <SegRow><Seg size="lg" value={draft.participants.scope} options={SCOPES} onChange={(v) => setParticipants({ scope: v })} /></SegRow>
              {draft.participants.scope === 'list' && (
                <div style={{ marginTop: 10 }}>
                  {roster == null ? <Skeleton lines={2} /> : roster.length === 0 ? (
                    <div style={{ fontSize: P.type.body, color: P.inkMute }}>No roster came back for this store, so there is nobody to pick.</div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {roster.map((p) => (
                        <Chip key={p.associate_id} on={draft.participants.associate_ids.indexOf(p.associate_id) > -1}
                          onClick={() => setParticipants({ associate_ids: toggleIn(draft.participants.associate_ids, p.associate_id) })}>
                          {p.name}
                        </Chip>))}
                    </div>)}
                </div>)}
              {draft.participants.scope === 'teams' && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(draft.participants.teams || []).map((t, ti) => (
                    <Card key={ti} padding={12} elevation="sunken">
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <Field size="sm" placeholder="Team name" value={t.name}
                          onChange={(e) => {
                            const teams = draft.participants.teams.slice();
                            teams[ti] = { ...t, name: e.target.value };
                            setParticipants({ teams });
                          }} />
                        <PBtn size="xs" variant="ghost" icon="trash"
                          onClick={() => setParticipants({ teams: draft.participants.teams.filter((_, i) => i !== ti) })}>Remove</PBtn>
                      </div>
                      {roster == null ? <Skeleton lines={1} /> : (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {roster.map((p) => (
                            <Chip key={p.associate_id} on={t.associate_ids.indexOf(p.associate_id) > -1}
                              onClick={() => {
                                const teams = draft.participants.teams.slice();
                                teams[ti] = { ...t, associate_ids: toggleIn(t.associate_ids, p.associate_id) };
                                setParticipants({ teams });
                              }}>{p.name}</Chip>))}
                        </div>)}
                    </Card>))}
                  <div>
                    <PBtn size="sm" variant="secondary" icon="plus"
                      onClick={() => setParticipants({ teams: (draft.participants.teams || []).concat([{ name: '', associate_ids: [] }]) })}>Add a team</PBtn>
                  </div>
                </div>)}
              {problemsAt('who').map((p, i) => <Problem key={i}>{p.msg}</Problem>)}
              <Hint>Someone hired mid-window is included from their first attributed sale.</Hint>
            </div>
          </div>
        </Card>

        <Card padding={0}>
          <CardHead icon="calendar" title="4 · When it runs" />
          <div style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
              <div>
                <FLabel>Starts</FLabel>
                <Field size="md" mono type="datetime-local" value={isoToLocalInput(draft.window_start)}
                  onChange={(e) => set({ window_start: localInputToIso(e.target.value) })} />
              </div>
              <div>
                <FLabel>Ends</FLabel>
                <Field size="md" mono type="datetime-local" value={isoToLocalInput(draft.window_end)}
                  onChange={(e) => set({ window_end: localInputToIso(e.target.value) })} />
              </div>
            </div>
            {problemsAt('window').map((p, i) => <Problem key={i}>{p.msg}</Problem>)}
            <div>
              <FLabel>Time zone</FLabel>
              <Field size="sm" mono placeholder="America/Los_Angeles" value={draft.tz}
                onChange={(e) => set({ tz: e.target.value })} style={{ maxWidth: 260 }} />
              <Hint>Every window comparison uses the store’s local day and hour, computed once when the sale is ingested. A sale at 23:40 on Sunday belongs to Sunday at this store, whatever UTC says.</Hint>
            </div>
            <div>
              <FLabel>Repeats</FLabel>
              <SegRow><Seg size="lg" value={draft.recurrence} options={RECURRENCES} onChange={(v) => set({ recurrence: v })} /></SegRow>
              <Hint>Hourly makes each hour its own round, with its own places and its own settlement. Rounds are cut on store-local hours, not UTC.</Hint>
            </div>
          </div>
        </Card>

        <Card padding={0}>
          <CardHead icon="coins" title="5 · Reward" />
          <div style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <FLabel>Reward shape</FLabel>
              <SegRow><Seg size="lg" value={draft.reward.type}
                options={allowedRewards.map((t) => ({ value: t, label: REWARD_TYPE_LABEL[t] }))}
                onChange={(v) => setReward({ type: v })} /></SegRow>
              <Hint>Only the shapes this kind can pay are offered — the backend refuses the others.</Hint>
            </div>

            {draft.reward.type === 'threshold' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div><FLabel>Threshold</FLabel>
                  <NumField value={draft.reward.threshold} onChange={(n) => setReward({ threshold: n })} placeholder="10" /></div>
                <div><FLabel>Amount per person</FLabel>
                  <MoneyField value={draft.reward.amount_cents} onChange={(c) => setReward({ amount_cents: c })} /></div>
              </div>)}

            {draft.reward.type === 'per_unit' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div><FLabel>Rate per unit</FLabel>
                  <MoneyField value={draft.reward.amount_cents} onChange={(c) => setReward({ amount_cents: c })} /></div>
                <div><FLabel>Cap per person</FLabel>
                  <MoneyField value={draft.reward.cap_cents} onChange={(c) => setReward({ cap_cents: c })} placeholder="no cap" /></div>
              </div>)}

            {draft.reward.type === 'team_threshold' && (
              <React.Fragment>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <div><FLabel>The team has to reach</FLabel>
                    <NumField value={draft.reward.threshold} onChange={(n) => setReward({ threshold: n })} placeholder="400" /></div>
                  <div><FLabel>And it pays</FLabel>
                    <MoneyField value={draft.reward.amount_cents} onChange={(c) => setReward({ amount_cents: c })} /></div>
                </div>
                <div>
                  <FLabel>Split</FLabel>
                  <SegRow><Seg size="md" value={draft.reward.split || 'equal'} onChange={(v) => setReward({ split: v })}
                    options={[{ value: 'equal', label: 'Equally' }, { value: 'by_share', label: 'By each person’s share' }]} /></SegRow>
                </div>
              </React.Fragment>)}

            {draft.reward.type === 'aov' && (
              <div style={{ maxWidth: 220 }}>
                <FLabel>Average order value to aim at</FLabel>
                <MoneyField value={draft.reward.goal_cents} onChange={(c) => setReward({ goal_cents: c })} />
              </div>)}

            {draft.reward.type === 'places' && (
              <div>
                <FLabel>Places</FLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(draft.reward.places || []).map((pl, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 46, fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: P.ink }}>
                        {pl.rank === 1 ? '1st' : pl.rank === 2 ? '2nd' : pl.rank === 3 ? '3rd' : pl.rank + 'th'}
                      </span>
                      <div style={{ width: 150 }}>
                        <MoneyField value={pl.amount_cents} onChange={(c) => {
                          const places = draft.reward.places.slice();
                          places[i] = { ...pl, amount_cents: c };
                          setReward({ places });
                        }} />
                      </div>
                      <span style={{ flex: 1, fontSize: P.type.meta, fontFamily: P.fontMono, color: P.inkDim }}>cents · tracked</span>
                      <PBtn size="xs" variant="ghost" icon="x"
                        onClick={() => setReward({ places: draft.reward.places.filter((_, x) => x !== i).map((q, x) => ({ ...q, rank: x + 1 })) })}>Remove</PBtn>
                    </div>))}
                </div>
                <div style={{ marginTop: 9 }}>
                  <PBtn size="xs" variant="secondary" icon="plus"
                    onClick={() => setReward({ places: (draft.reward.places || []).concat([{ rank: (draft.reward.places || []).length + 1, amount_cents: null }]) })}>Add a place</PBtn>
                </div>
              </div>)}

            {problemsAt('reward').map((p, i) => <Problem key={i}>{p.msg}</Problem>)}

            <div>
              <FLabel>Unit</FLabel>
              <SegRow><Seg size="lg" value={draft.reward.unit || 'cents'} options={UNITS} onChange={(v) => setReward({ unit: v })} /></SegRow>
              <Hint>Dollars are recorded in the ledger and shown in Earnings as an amount owed. <b>Nothing in this module moves money.</b> A payment is a bookkeeping marker a manager writes after paying by their own means.</Hint>
            </div>

            <div>
              <FLabel>If two people tie</FLabel>
              <SegRow><Seg size="lg" value={draft.tie_rule} options={TIE_RULES} onChange={(v) => set({ tie_rule: v })} /></SegRow>
              <Hint>Recorded even where a threshold cannot tie, so the rule never has to be invented later. Ranks stay 1, 1, 3.</Hint>
            </div>
          </div>
        </Card>

        <Card padding={0}>
          <CardHead icon="wallet" title="6 · Funding" />
          <div style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <FLabel>Funded by</FLabel>
              <SegRow><Seg size="lg" value={draft.funding.funded_by} onChange={(v) => setFunding({ funded_by: v, brand: v === 'store' ? null : draft.funding.brand })}
                options={[{ value: 'store', label: 'This store' }, { value: 'brand', label: 'A brand' }]} /></SegRow>
            </div>
            {isBrandFunded && (
              <div>
                <FLabel>Brand</FLabel>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {brands.map((b) => (
                    <Chip key={b} on={draft.funding.brand === b} onClick={() => setFunding({ brand: draft.funding.brand === b ? null : b })}>{b}</Chip>))}
                </div>
                {problemsAt('funding').map((p, i) => <Problem key={i}>{p.msg}</Problem>)}
              </div>)}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div><FLabel>Budget</FLabel>
                <MoneyField value={draft.funding.budget_cents} onChange={(c) => setFunding({ budget_cents: c })} placeholder="no budget" /></div>
              <div><FLabel>Cap per person</FLabel>
                <MoneyField value={draft.funding.cap_per_person_cents} onChange={(c) => setFunding({ cap_per_person_cents: c })} placeholder="no cap" /></div>
            </div>
            {isBrandFunded && (
              <div style={{ display: 'flex', gap: 9, padding: '10px 12px', background: P.warnSoft,
                border: `1px solid ${P.warn}`, borderRadius: P.r10, fontSize: P.type.body, color: P.ink2, lineHeight: 1.5 }}>
                <Icon name="alert" size={15} stroke={1.9} color={P.warnText} style={{ flex: '0 0 auto', marginTop: 1 }} />
                <span>A brand-funded bounty needs a manager at the store to approve it before it opens. Saving it puts it in the draft list; submitting it puts it in that manager’s inbox. Nothing scores until then.</span>
              </div>)}
          </div>
        </Card>
      </div>);

    // ── right rail: the sentence, then the history ────────────────────────
    const unanswered = stillToAnswer(draft);
    const would = preview.would;
    const wouldRounds = (would && Array.isArray(would.rounds)) ? would.rounds : [];
    let qualified = 0, participantsSeen = 0, wouldPay = 0, unTxns = 0, unCents = 0;
    wouldRounds.forEach((r) => {
      const st = Array.isArray(r.standings) ? r.standings : [];
      st.forEach((s) => { if ((s.earned_cents || 0) > 0) qualified += 1; wouldPay += (s.earned_cents || 0); });
      participantsSeen += st.length + (Array.isArray(r.not_yet) ? r.not_yet.length : 0);
      if (r.unattributed) { unTxns += r.unattributed.txns || 0; unCents += r.unattributed.cents || 0; }
    });

    const rail = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <Card padding={0}>
          <CardHead icon="scroll" tone="accent" title="This bounty, in a sentence"
            right={preview.loading ? <Pill kind="neutral" size="sm">rewriting</Pill> : null} />
          <div style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {preview.error ? (
              <S.NotConnected compact />
            ) : preview.fragments && preview.fragments.length ? (
              <p style={{ margin: 0, fontSize: P.type.title, lineHeight: 1.6 }}>
                <FragmentSentence fragments={preview.fragments} />
              </p>
            ) : preview.sentence ? (
              <p style={{ margin: 0, fontSize: P.type.title, lineHeight: 1.6 }}>
                <SentenceText sentence={preview.sentence} fragments={answeredFragments(draft)} />
              </p>
            ) : preview.loading ? <Skeleton lines={3} /> : (
              <p style={{ margin: 0, fontSize: P.type.body, color: P.inkMute }}>
                The sentence is written by the backend from the fields above — it appears as soon as there is something to say.
              </p>)}
            {unanswered.length > 0 && (
              <div style={{ fontSize: P.type.body, color: P.inkMute, lineHeight: 1.6 }}>
                Still to answer — {unanswered.join(' · ')}
              </div>)}
            <div style={{ fontSize: P.type.meta, color: P.inkMute, lineHeight: 1.5 }}>
              The highlighted fragments are the answers you typed, found in the sentence the scorer will use. Anything not highlighted is the backend’s own wording.
            </div>
          </div>
        </Card>

        <Card padding={0}>
          <CardHead icon="chart" tone="warn" title="What this would have counted" />
          <div style={{ padding: 15, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 9, padding: '10px 12px', background: P.warnSoft,
              border: `1px solid ${P.warn}`, borderRadius: P.r10, fontSize: P.type.body, color: P.ink2, lineHeight: 1.5 }}>
              <Icon name="alert" size={15} stroke={1.9} color={P.warnText} style={{ flex: '0 0 auto', marginTop: 1 }} />
              <span><b>The last 7 days of history, not a forecast.</b> This rule scored against sales that already happened. It is what it would have counted, not what it will.</span>
            </div>
            {preview.error ? (
              <div style={{ fontSize: P.type.body, color: P.inkMute }}>
                Needs the backend — the dry run is scored server-side against the real ledger, never estimated here.
              </div>
            ) : preview.incomplete ? (
              <div style={{ fontSize: P.type.body, color: P.inkMute }}>Not scorable yet — {preview.incomplete}.</div>
            ) : preview.loading && !would ? <Skeleton lines={3} /> : !would ? (
              <div style={{ fontSize: P.type.body, color: P.inkMute }}>Nothing to score yet — the dry run fills in as the rule takes shape.</div>
            ) : (
              <React.Fragment>
                {would.window && (
                  <div style={{ fontSize: P.type.meta, fontFamily: P.fontMono, color: P.inkDim }}>
                    {would.window.from} → {would.window.to}
                  </div>)}
                {[['Would have qualified', qualified + ' of ' + participantsSeen],
                  ['Would have counted as earned', window.HWInc.fmt.cents(wouldPay)],
                  ['Rounds scored', String(wouldRounds.length)],
                  ['Sales with no budtender', window.HWInc.fmt.number(unTxns) + ' · ' + window.HWInc.fmt.cents(unCents)]].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '7px 0', borderBottom: `1px solid ${P.hairline}` }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: P.type.body, color: P.inkDim }}>{k}</span>
                    <span style={{ fontFamily: P.fontMono, fontVariantNumeric: 'tabular-nums', fontSize: P.type.body, fontWeight: 600, color: P.ink }}>{v}</span>
                  </div>))}
                {wouldRounds.length === 0 && (
                  <div style={{ fontSize: P.type.body, color: P.inkMute }}>Nothing in the last seven days would have counted under this rule.</div>)}
              </React.Fragment>)}
          </div>
        </Card>

        <Card padding={15}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <PBtn size="lg" variant="accent" full={false} busy={saving === 'draft'} disabled={saving === 'submit'}
              style={{ flex: 1 }} onClick={() => save('draft')}>Save as a draft</PBtn>
            {isBrandFunded ? (
              <PBtn size="lg" variant="secondary" busy={saving === 'submit'} disabled={saving === 'draft'}
                onClick={() => save('submit')}>Submit for approval</PBtn>
            ) : (
              <PBtn size="lg" variant="secondary" busy={saving === 'submit'} disabled={saving === 'draft'}
                onClick={() => save('submit')}>Start</PBtn>)}
          </div>
          {showProblems && problems.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {problems.map((p, i) => <Problem key={i}>{p.msg}</Problem>)}
            </div>)}
          <Hint>{isBrandFunded
            ? 'Saving creates it as a draft. A brand-funded bounty is never active until a manager approves it.'
            : 'Saving creates it as a draft. Start moves a store-funded bounty straight to active — there is nobody else to approve it.'}</Hint>
        </Card>
      </div>);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <button onClick={() => navigate('#/contests')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', padding: 0, fontSize: P.type.meta, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '.06em', color: P.inkMute, cursor: 'pointer', fontFamily: P.fontSans }}>
              <Icon name="arrow-left" size={12} stroke={2} />Bounties
            </button>
            <h1 style={{ margin: '4px 0 0', fontSize: P.type.h1, fontWeight: 700, letterSpacing: '-.02em', color: P.ink }}>
              {editId ? 'Edit the draft' : 'New bounty'}
            </h1>
            <p style={{ margin: '6px 0 0', maxWidth: 640, fontSize: P.type.strong, color: P.inkMute, lineHeight: 1.5 }}>
              Answer down the left; the sentence on the right rewrites itself as you go. If you can’t read the sentence, you haven’t built the bounty you think you have.
            </p>
          </div>
          <Pill kind="neutral" size="sm" dot>{editId ? 'Draft' : 'Draft · not saved'}</Pill>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(300px,360px)', gap: 16, alignItems: 'start' }}>
          {form}
          {rail}
        </div>
      </div>);
  }

  // ── route entry ─────────────────────────────────────────────────────────
  window.IncScreenContestBuilder = function IncScreenContestBuilder(props) {
    const seat = !props.isManager || props.seat === 'seat';
    return (
      <div style={{ width: '100%' }}>
        {seat ? (
          <EmptyState icon="lock" title="Building a bounty is a manager’s job"
            body="You can see every bounty that includes you, and where you stand in it, on the bounty board. Ask a floor manager to start a new one." />
        ) : (
          <Builder navigate={props.navigate} query={props.query} path={props.path} session={props.session} store={props.store} />)}
      </div>);
  };
})();
