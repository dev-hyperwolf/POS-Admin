// ── Empty · Loading · Error ─────────────────────────────────────────────────
// The three states every list needs and almost none of them had. Rendering
// nothing when there is nothing is the single most visible "unfinished" tell in
// the product, so these are shared and deliberately plain: one icon, one line
// of plain language, one action. No illustrations, no apologies.
const useP = window.useP;

// EmptyState — "there is nothing here YET". Says why, and what to do next.
window.EmptyState = function EmptyState({ icon = 'shield', title, body, action, compact, style }) {
  const P = useP();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: compact ? '26px 18px' : '48px 24px', gap: 4, ...style }}>
      <span style={{ width: compact ? 38 : 48, height: compact ? 38 : 48, borderRadius: 99, background: P.surface3,
        color: P.inkMute, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <Icon name={icon} size={compact ? 18 : 22} stroke={1.6} />
      </span>
      <div style={{ fontSize: compact ? 13.5 : 16, fontWeight: 600, color: P.ink2, letterSpacing: '-.01em' }}>{title}</div>
      {body && <div style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.5, maxWidth: 380 }}>{body}</div>}
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>);

};

// Skeleton — a shape where content will be. `lines` for text, or w/h for a box.
// The shimmer keyframe (`shimmer`) already exists in every app's base CSS.
window.Skeleton = function Skeleton({ lines, w, h = 12, radius, gap = 8, style }) {
  const P = useP();
  const bar = (width, height, key) =>
  <span key={key} style={{ display: 'block', width: width, height: height, borderRadius: radius ?? 6,
    background: `linear-gradient(90deg, ${P.surface3} 25%, ${P.hairline2} 37%, ${P.surface3} 63%)`,
    backgroundSize: '400% 100%', animation: 'shimmer 1.4s ease infinite' }} />;
  if (lines) {
    return <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
      {Array.from({ length: lines }).map((_, i) => bar(i === lines - 1 ? '62%' : '100%', h, i))}
    </div>;
  }
  return <div style={style}>{bar(w || '100%', h)}</div>;
};

// SkeletonRows — the list-shaped default: avatar + two lines, N times.
window.SkeletonRows = function SkeletonRows({ rows = 3, avatar = true, style }) {
  const P = useP();
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
    {Array.from({ length: rows }).map((_, i) =>
    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px',
      background: P.surface, border: `1px solid ${P.hairline}`, borderRadius: P.r12 }}>
        {avatar && <window.Skeleton w={32} h={32} radius={99} />}
        <div style={{ flex: 1, minWidth: 0 }}><window.Skeleton lines={2} h={10} gap={6} /></div>
      </div>
    )}
  </div>;
};

// ErrorState — what failed, in plain words, and the way out. Never a raw stack.
window.ErrorState = function ErrorState({ title = 'That didn’t load', body, detail, onRetry, compact, style }) {
  const P = useP();
  const [showDetail, setShowDetail] = React.useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: compact ? '24px 18px' : '44px 24px', gap: 4, ...style }}>
      <span style={{ width: compact ? 38 : 48, height: compact ? 38 : 48, borderRadius: 99, background: P.badSoft,
        color: P.bad, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <Icon name="shield" size={compact ? 18 : 22} stroke={1.8} />
      </span>
      <div style={{ fontSize: compact ? 13.5 : 16, fontWeight: 600, color: P.ink, letterSpacing: '-.01em' }}>{title}</div>
      <div style={{ fontSize: 12.5, color: P.inkDim, lineHeight: 1.5, maxWidth: 380 }}>
        {body || 'The data didn’t come back. Nothing was changed — try again, and if it keeps failing tell an admin.'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        {onRetry && <window.PBtn variant="secondary" size="sm" icon="refresh" onClick={onRetry}>Try again</window.PBtn>}
        {detail && <window.PBtn variant="ghost" size="sm" onClick={() => setShowDetail((v) => !v)}>{showDetail ? 'Hide details' : 'Details'}</window.PBtn>}
      </div>
      {detail && showDetail &&
      <div style={{ marginTop: 10, maxWidth: 460, padding: '9px 11px', background: P.canvas2, borderRadius: P.r8,
        fontFamily: P.fontMono, fontSize: 11.5, color: P.inkDim, textAlign: 'left', lineHeight: 1.5, wordBreak: 'break-word' }}>{detail}</div>}
    </div>);

};

Object.assign(window, {});
