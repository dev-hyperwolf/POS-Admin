// ── Learn — Snaps: the seat's story player, the console's list ─────────────
// Route: #/learn (both seats). Design: explorations/Incentives - Concept D -
// Two Seats.html, tab "6 · Learn" (player + authoring stage). Plan:
// docs/INCENTIVES-PLAN-2026-09-07.md §3.7, §5. Contract:
// docs/BOUNTY-API-CONTRACT.md "Learn (snaps)".
//
// TWO EXPORTS. window.IncScreenLearn is the routed screen (list + story
// rail). window.IncSnapPlayer is the story player itself, exported so
// incentives/screen-learn-author.jsx can mount the exact same component for
// its "Preview as a budtender" button — the brief's one permitted extra
// global. Nothing else here leaks; the file is IIFE-wrapped.
//
// ROLE, NOT A PROP. incentives/app.jsx resolves a screen from ROUTES() and
// renders it as `<Screen {...ctx} />` with `ctx = { navigate, query, route,
// path }` only — isManager, session, previewing and the /me poll are NOT
// forwarded to the routed screen (read app.jsx's App() top to bottom: ctx is
// built once, before isManager is even computed). So this file derives
// `isManager` itself from `HWInc.session().role`, the same formula app.jsx
// uses for its own chrome — not a violation of "never re-derive role from a
// string", just the only signal actually available. One real consequence:
// app.jsx's "Preview as budtender" toggle is local React state that never
// reaches here, so a manager who is previewing still renders as a manager
// in this file (console list + overlay player) inside the SeatFrame's
// narrow, pointer-events:none column. That is a shell wiring gap in
// incentives/app.jsx, which this task does not touch — see the report.
//
// TOASTS MAY NO-OP. window.hdToast is only registered once <ToastHost/> has
// mounted (shared/hd-ui.jsx), and incentives/app.jsx never renders one. This
// file calls `window.hdToast?.(...)` defensively everywhere, same as
// engage/screen-loyalty.jsx already does — until app.jsx grows a ToastHost,
// the quiz-result toast is a silent no-op and the on-screen result card is
// the only place the outcome actually shows.
;(function () {
  const useP = window.useP;

  // ── small local helpers (IIFE-scoped, never leaked) ───────────────────────
  function initials(s) {
    if (!s) return '?';
    const parts = String(s).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  const BRAND_HUES = ['blue', 'violet', 'teal', 'green', 'pink'];
  function brandColor(P, brand) {
    const s = brand || '';
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return P.hue[BRAND_HUES[h % BRAND_HUES.length]];
  }
  function earnedLine(e) {
    if (!e) return null;
    if (e.unit === 'cents') return `${window.HWInc.fmt.cents(e.amount)} written to your ledger`;
    if (e.unit === 'points') return `${window.HWInc.fmt.number(e.amount)} points written to your ledger`;
    return `${window.HWInc.fmt.number(e.amount)} ${e.unit} written to your ledger`;
  }

  // ── data hooks ──────────────────────────────────────────────────────────
  // List: HWInc.usePoll already degrades to {ok:false, error:'no-live-seam'}
  // when hw-live.js is absent, so a screen never needs its own try/catch.
  function useSnaps(storeId, associateId) {
    const path = `/api/incentives/snaps?store_id=${encodeURIComponent(storeId || '')}&associate_id=${encodeURIComponent(associateId || '')}`;
    return window.HWInc.usePoll(path, { intervalMs: 20000 });
  }

  // Detail: a one-shot fetch per snapId, not a poll — a story you are reading
  // does not need to live-update mid-read the way a leaderboard does.
  function useSnapDetail(snapId) {
    const [state, setState] = React.useState({ loading: true, error: null, data: null });
    const aliveRef = React.useRef(true);
    const fetchIt = React.useCallback(() => {
      if (!snapId) return;
      setState((s) => ({ ...s, loading: true, error: null }));
      window.HWInc.get(`/api/incentives/snaps/${encodeURIComponent(snapId)}`).then((r) => {
        if (!aliveRef.current) return;
        if (!r.ok) { setState({ loading: false, error: r.error || `HTTP ${r.code}`, data: null }); return; }
        setState({ loading: false, error: null, data: r.body });
      });
    }, [snapId]);
    React.useEffect(() => { aliveRef.current = true; fetchIt(); return () => { aliveRef.current = false; }; }, [fetchIt]);
    return { ...state, refresh: fetchIt };
  }

  // ── the story rail — one circle per snap, accent ring while unread ───────
  function StoryRail({ snaps, onOpen }) {
    const P = useP();
    if (!snaps.length) return null;
    return (
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '2px 2px 8px' }}>
        {snaps.map((s) => {
          const unread = !s.viewed;
          return (
            <button key={s.id} type="button" onClick={() => onOpen(s.id)} title={s.title}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none',
                border: 'none', cursor: 'pointer', flex: '0 0 auto', width: 64, padding: 0, fontFamily: P.fontSans }}>
              <span style={{ width: 56, height: 56, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `2px solid ${unread ? P.accent : P.hairline2}`, padding: 3, flex: '0 0 auto' }}>
                <span style={{ width: '100%', height: '100%', borderRadius: 99, background: brandColor(P, s.brand),
                  color: P.railBright, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                  {initials(s.brand || s.title)}
                </span>
              </span>
              <span style={{ fontSize: 10.5, fontWeight: unread ? 700 : 500, color: unread ? P.ink : P.inkDim, textAlign: 'center',
                maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.brand || s.title}</span>
            </button>);
        })}
      </div>);
  }

  // ── one row in the list — viewed/completed/quiz pills, linked bounty chip ─
  function SnapListRow({ snap, navigate, onOpen }) {
    const P = useP();
    const unread = !snap.viewed;
    return (
      <div data-hw-i role="button" tabIndex={0} onClick={() => onOpen(snap.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(snap.id); } }}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: P.r12,
          background: P.surface, border: `1px solid ${P.hairline}`, cursor: 'pointer' }}>
        <span style={{ width: 38, height: 38, borderRadius: P.r10, background: brandColor(P, snap.brand), color: P.railBright,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: '0 0 auto' }}>
          {initials(snap.brand || snap.title)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: P.type.strong, fontWeight: 700, color: P.ink }}>{snap.title}</span>
            {unread && <Pill kind="accent" size="sm" dot>New</Pill>}
            {!unread && snap.completed && <Pill kind="good" size="sm">Completed</Pill>}
            {!unread && !snap.completed && <Pill kind="info" size="sm">In progress</Pill>}
            {snap.quiz && snap.quiz_passed === true && <Pill kind="good" size="sm" icon="award">Quiz passed</Pill>}
            {snap.quiz && snap.quiz_passed === false && <Pill kind="warn" size="sm">Quiz not passed</Pill>}
          </div>
          <div style={{ marginTop: 3, fontSize: P.type.meta, color: P.inkDim, fontFamily: P.fontMono, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {snap.brand && <span>{snap.brand}</span>}
            {snap.reward_summary && <span>· {snap.reward_summary}</span>}
          </div>
        </div>
        {snap.linked_contest_id && (
          <span onClick={(e) => { e.stopPropagation(); navigate(`#/contests/${snap.linked_contest_id}`); }} style={{ cursor: 'pointer' }}>
            <Pill kind="neutral" size="sm" icon="target">Linked bounty</Pill>
          </span>)}
        <Icon name="chevron-right" size={16} stroke={1.8} color={P.inkFaint} />
      </div>);
  }

  // ── THE STORY PLAYER ───────────────────────────────────────────────────
  // `mode`: 'seat' renders full-bleed (no scrim, the seat column is the
  // frame) — 'overlay' wraps in overlayScrim+overlayCard, centred, for the
  // console. `isManager` unlocks the answer_index the API only sends
  // managers (used to mark the correct choice once answered — never before,
  // and never for a budtender, who the API itself withholds it from) and the
  // per-snap view count header line — the list has no aggregate view-count
  // field (see the report), so it is shown here, once, from the same
  // GET /snaps/{id} call the player already makes to render at all, rather
  // than an extra fetch per row in the list (CLAUDE.md §4.8: no duplicate
  // fetches for data already in hand).
  window.IncSnapPlayer = function IncSnapPlayer({ snapId, onClose, mode = 'overlay', isManager, associateId, onSnapChanged, navigate }) {
    const P = useP();
    const detail = useSnapDetail(snapId);
    const snap = detail.data && detail.data.snap;
    const cards = (snap && snap.cards) || [];
    const quizIndices = React.useMemo(() => cards.map((c, i) => (c.type === 'quiz' ? i : null)).filter((i) => i != null), [cards]);
    const hasQuiz = quizIndices.length > 0;
    const totalSteps = cards.length + (hasQuiz ? 1 : 0);

    const [step, setStep] = React.useState(0);
    const [answers, setAnswers] = React.useState({});           // cardIndex -> chosen choice index
    const [quizResult, setQuizResult] = React.useState(null);   // null | 'pending' | {score,passed,earned} | {error}
    const openedRef = React.useRef(null);
    const completedRef = React.useRef(null);

    React.useEffect(() => { setStep(0); setAnswers({}); setQuizResult(null); openedRef.current = null; completedRef.current = null; }, [snapId]);

    // POST view {completed:false} once, the moment the snap has loaded.
    React.useEffect(() => {
      if (!snap || !associateId || openedRef.current === snap.id) return;
      openedRef.current = snap.id;
      window.HWInc.post(`/api/incentives/snaps/${snap.id}/view`, { associate_id: associateId, completed: false });
    }, [snap, associateId]);

    // POST view {completed:true} the first time the final step is reached —
    // the real last card when there is no quiz, the synthesized result step
    // when there is.
    React.useEffect(() => {
      if (!snap || !associateId || totalSteps === 0) return;
      if (step !== totalSteps - 1) return;
      if (completedRef.current === snap.id) return;
      completedRef.current = snap.id;
      window.HWInc.post(`/api/incentives/snaps/${snap.id}/view`, { associate_id: associateId, completed: true })
        .then(() => onSnapChanged && onSnapChanged());
    }, [step, snap, associateId, totalSteps, onSnapChanged]);

    const submitQuiz = React.useCallback((finalAnswers) => {
      if (!snap) return;
      setQuizResult('pending');
      const ordered = quizIndices.map((i) => finalAnswers[i]);
      window.HWInc.post(`/api/incentives/snaps/${snap.id}/quiz`, { associate_id: associateId, answers: ordered }).then((r) => {
        if (!r.ok) { setQuizResult({ error: r.error || `HTTP ${r.code}` }); return; }
        setQuizResult(r.body);
        window.hdToast?.({
          title: r.body.passed ? 'Quiz passed' : 'Quiz not passed',
          description: r.body.earned ? earnedLine(r.body.earned) : (r.body.passed ? 'Nice work.' : 'You can try again later.'),
          tone: r.body.passed ? 'ok' : 'warn',
        });
        onSnapChanged && onSnapChanged();
      });
    }, [snap, associateId, quizIndices, onSnapChanged]);

    // A quiz card's choice IS its forward action — picking an answer both
    // records it and advances, same as tapping the forward zone elsewhere.
    const choose = (cardIndex, choiceIndex) => {
      if (answers[cardIndex] != null) { setStep((s) => Math.min(s + 1, totalSteps - 1)); return; }
      const next = { ...answers, [cardIndex]: choiceIndex };
      setAnswers(next);
      if (quizIndices.every((i) => next[i] != null)) submitQuiz(next);
      setStep((s) => Math.min(s + 1, totalSteps - 1));
    };

    function goForward() {
      const cur = cards[step];
      if (cur && cur.type === 'quiz' && answers[step] == null) return; // must answer to pass a quiz card
      setStep((s) => Math.min(s + 1, totalSteps - 1));
    }
    function goBack() { setStep((s) => Math.max(s - 1, 0)); }

    // Arrow keys mirror tap-left/tap-right. Attached once; latest step/cards/
    // answers/totalSteps are read through a ref so the listener never goes
    // stale without re-subscribing every render.
    const liveRef = React.useRef();
    liveRef.current = { step, cards, answers, totalSteps };
    React.useEffect(() => {
      const onKey = (e) => {
        const s = liveRef.current;
        if (e.key === 'ArrowRight') {
          const cur = s.cards[s.step];
          if (cur && cur.type === 'quiz' && s.answers[s.step] == null) return;
          setStep((v) => Math.min(v + 1, s.totalSteps - 1));
        } else if (e.key === 'ArrowLeft') {
          setStep((v) => Math.max(v - 1, 0));
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, []);

    function handleAreaClick(e) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      if (x < rect.width / 3) goBack(); else goForward();
    }

    function renderCard(card, cardIndex) {
      if (card.type === 'image') {
        return (
          <div>
            {card.media_url
              ? <img src={card.media_url} alt="" style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: P.r10, display: 'block' }} />
              : <div style={{ height: 180, borderRadius: P.r10, background: P.surface3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: P.railInk }}>
                  <Icon name="story" size={22} stroke={1.6} />
                </div>}
            {(card.heading || card.body) && (
              <div style={{ marginTop: 14 }}>
                {card.heading && <div style={{ fontSize: 16, fontWeight: 700, color: P.railBright, marginBottom: 6 }}>{card.heading}</div>}
                {card.body && <div style={{ fontSize: 13, color: P.railInk, lineHeight: 1.5 }}>{card.body}</div>}
              </div>)}
          </div>);
      }
      if (card.type === 'text') {
        return (
          <div>
            {card.heading && <div style={{ fontSize: 17, fontWeight: 700, color: P.railBright, marginBottom: 8 }}>{card.heading}</div>}
            {card.body && <div style={{ fontSize: 13.5, color: P.railInk, lineHeight: 1.55 }}>{card.body}</div>}
          </div>);
      }
      if (card.type === 'video_url') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
            {card.heading && <div style={{ fontSize: 16, fontWeight: 700, color: P.railBright }}>{card.heading}</div>}
            <span style={{ width: 52, height: 52, borderRadius: 99, background: P.surface3, color: P.railBright, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="play" size={22} />
            </span>
            {card.media_url
              ? <a href={card.media_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                  style={{ color: P.accent, fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Watch the video<Icon name="external" size={12} />
                </a>
              : <div style={{ fontSize: 12, color: P.railInk }}>No video link on this card.</div>}
            <div style={{ fontSize: 10.5, color: P.railInk }}>Opens in a new tab — no embedded player.</div>
          </div>);
      }
      if (card.type === 'quiz') {
        const chosen = answers[cardIndex];
        return (
          <div>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: P.railBright, marginBottom: 12 }}>{card.question}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(card.choices || []).map((choice, i) => {
                const isChosen = chosen === i;
                const isCorrect = isManager && card.answer_index != null && card.answer_index === i;
                return (
                  <PBtn key={i} full size="xl" active={isChosen} disabled={chosen != null && !isChosen}
                    onClick={(e) => { e.stopPropagation(); choose(cardIndex, i); }}
                    style={chosen != null && isCorrect ? { boxShadow: `inset 0 0 0 1px ${P.good}` } : undefined}>
                    <span style={{ flex: 1, textAlign: 'left' }}>{choice}</span>
                    {chosen != null && isCorrect && <Pill kind="good" size="sm">correct</Pill>}
                  </PBtn>);
              })}
            </div>
          </div>);
      }
      return <div style={{ color: P.railInk, fontSize: 12 }}>Unsupported card type.</div>;
    }

    function renderResultStep() {
      if (quizResult == null || quizResult === 'pending') {
        return (
          <div style={{ textAlign: 'center' }}>
            <SkeletonRows rows={1} avatar={false} />
            <div style={{ marginTop: 10, fontSize: 12.5, color: P.railInk }}>Scoring your answers…</div>
          </div>);
      }
      if (quizResult.error) {
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <window.IncShared.NotConnected compact onRetry={() => submitQuiz(answers)} />
          </div>);
      }
      const passed = !!quizResult.passed;
      return (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 52, height: 52, borderRadius: 99, background: passed ? P.accent : P.surface3,
            color: passed ? P.accentInk : P.railInk, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="award" size={24} stroke={1.6} />
          </span>
          <div style={{ fontSize: 15.5, fontWeight: 700, color: P.railBright }}>
            {passed ? (quizResult.earned ? earnedLine(quizResult.earned) : 'Quiz passed') : `Scored ${Math.round((quizResult.score || 0) * 100)}% — not a pass`}
          </div>
          {passed && quizResult.earned && (
            <div style={{ fontSize: 11.5, color: P.railInk, maxWidth: 260 }}>
              Recorded just now against &#8220;{snap.title}&#8221;. It shows in My earnings as settled.
            </div>)}
          {!passed && <div style={{ fontSize: 11.5, color: P.railInk }}>You can try again later.</div>}
          {snap.linked_contest_id && (
            <PBtn variant="accent" size="lg" onClick={(e) => { e.stopPropagation(); navigate && navigate(`#/contests/${snap.linked_contest_id}`); }}>
              See the bounty
            </PBtn>)}
        </div>);
    }

    const backRow = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none',
          border: 'none', padding: 0, cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: P.inkMute, fontFamily: P.fontSans }}>
          <Icon name="arrow-left" size={13} stroke={2} />Learn
        </button>
        {isManager && snap && snap.views && (
          <span style={{ marginLeft: 'auto', fontSize: 10.5, fontFamily: P.fontMono, color: P.inkDim, fontVariantNumeric: 'tabular-nums' }}>
            {window.HWInc.fmt.number(snap.views.count)} views · {window.HWInc.fmt.number(snap.views.completed)} completed
          </span>)}
      </div>);

    let inner;
    if (detail.error) {
      inner = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {backRow}
          <Card padding={0}><window.IncShared.NotConnected onRetry={detail.refresh} /></Card>
        </div>);
    } else if (detail.loading || !snap) {
      inner = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {backRow}
          <Card elevation="raised" radius={P.r12} padding={20} style={{ background: P.rail, borderColor: 'transparent', minHeight: 360 }}>
            <SkeletonRows rows={3} avatar={false} />
          </Card>
        </div>);
    } else {
      const dots = (
        <div style={{ display: 'flex', gap: 4, padding: '10px 12px 0' }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= step ? P.accent : P.railHair }} />))}
        </div>);
      const meta = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
          <span style={{ width: 22, height: 22, borderRadius: 99, background: P.accent, color: P.accentInk, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flex: '0 0 auto' }}>{initials(snap.brand || snap.title)}</span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: P.railBright }}>{snap.brand || snap.title}</span>
          <span style={{ marginLeft: 'auto', fontSize: 10.5, fontFamily: P.fontMono, color: P.railInk, fontVariantNumeric: 'tabular-nums' }}>{step + 1} of {totalSteps}</span>
        </div>);
      inner = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {backRow}
          <Card elevation="raised" radius={P.r12} padding={0} onClick={handleAreaClick}
            style={{ background: P.rail, borderColor: 'transparent', overflow: 'hidden', cursor: 'pointer', userSelect: 'none',
              display: 'flex', flexDirection: 'column', minHeight: mode === 'seat' ? 'min(70vh, 620px)' : 480 }}>
            {dots}
            {meta}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 18px 22px' }}>
              {step < cards.length ? renderCard(cards[step], step) : renderResultStep()}
            </div>
          </Card>
        </div>);
    }

    if (mode === 'overlay') {
      return (
        <div style={window.overlayScrim(P, { padding: '40px 20px' })} onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
          <div style={{ ...window.overlayCard, width: 'min(380px, 94vw)' }}>{inner}</div>
        </div>);
    }
    return inner;
  };

  // ── THE ROUTED SCREEN — list of snaps, story rail up top ─────────────────
  window.IncScreenLearn = function IncScreenLearn({ navigate }) {
    const P = useP();
    const session = window.HWInc.session();
    const isManager = session.role === 'Floor Manager' || session.role === 'Admin';
    const snapsQ = useSnaps(session.storeId, session.id);
    const [openId, setOpenId] = React.useState(null);
    const snaps = (snapsQ.data && snapsQ.data.snaps) || [];

    const header = (
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="story" size={18} stroke={1.8} color={P.inkDim} />
            <h1 style={{ margin: 0, fontSize: isManager ? 21 : 18, fontWeight: 700, color: P.ink, letterSpacing: '-.01em' }}>Learn</h1>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: P.type.body, color: P.inkMute, maxWidth: 480, lineHeight: 1.5 }}>
            Short stories from the brands you sell. Pass a quiz and it settles straight to your ledger.
          </p>
        </div>
        {isManager && <PBtn variant="accent" size="sm" icon="plus" onClick={() => navigate('#/learn/new')}>New snap</PBtn>}
      </div>);

    let body;
    if (snapsQ.error) {
      body = <window.IncShared.NotConnected onRetry={snapsQ.refresh} />;
    } else if (snapsQ.loading) {
      body = <SkeletonRows rows={4} />;
    } else if (!snaps.length) {
      body = <EmptyState icon="story" title="Nothing to learn yet"
        body="Snaps from your brands will show up here — a short story, sometimes a quiz that pays." />;
    } else {
      body = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <StoryRail snaps={snaps} onOpen={setOpenId} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {snaps.map((s) => <SnapListRow key={s.id} snap={s} navigate={navigate} onOpen={setOpenId} />)}
          </div>
        </div>);
    }

    const listMarkup = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {header}
        {body}
      </div>);

    if (!isManager) {
      return openId
        ? <window.IncSnapPlayer snapId={openId} onClose={() => setOpenId(null)} mode="seat" isManager={false}
            associateId={session.id} onSnapChanged={snapsQ.refresh} navigate={navigate} />
        : listMarkup;
    }
    return (
      <React.Fragment>
        {listMarkup}
        {openId && (
          <window.IncSnapPlayer snapId={openId} onClose={() => setOpenId(null)} mode="overlay" isManager={true}
            associateId={session.id} onSnapChanged={snapsQ.refresh} navigate={navigate} />)}
      </React.Fragment>);
  };
})();
