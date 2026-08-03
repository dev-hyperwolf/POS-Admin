// ── Generic Hyperdrive helpers for apps outside the pipeline ───────────────
// Entities · hues · tones · formatting. pipeline/domain.jsx supersets this
// with batch-specific domain logic; apps that only need the generic slice
// (Engage, etc.) load this file instead.
;(function () {
  const ENTITIES = [
    { id: 'thc', name: 'THC Flower Manufacturing', short: 'THC', hue: 'green' },
    { id: 'ccd', name: 'Circle City Distribution', short: 'CCD', hue: 'blue' },
    { id: 'ah', name: 'Alternate Health', short: 'AH', hue: 'violet' },
    { id: 'hwd', name: 'Hyperwolf Delivery', short: 'HWD', hue: 'teal' },
  ];

  const hueColor = (P, hue) => ({
    violet: P.mode === 'dark' ? '#B79CFF' : '#6D4AC8',
    teal: P.mode === 'dark' ? '#67D6C4' : '#0E7C6B',
    pink: P.mode === 'dark' ? '#F7A8C4' : '#B4306A',
    green: P.mode === 'dark' ? '#8FD68B' : '#2C7A34',
    blue: P.mode === 'dark' ? '#8FC2FF' : '#1F5FA8',
    neutral: P.inkMute,
  }[hue] || P.inkMute);

  function tone(P, t) {
    const d = P.mode === 'dark';
    switch (t) {
      case 'ok': return { fg: d ? '#8FD68B' : '#2C7A34', bg: d ? 'rgba(143,214,139,.14)' : 'rgba(44,122,52,.10)' };
      case 'warn': return { fg: d ? '#F3C969' : '#8A5B00', bg: d ? 'rgba(243,201,105,.14)' : 'rgba(138,91,0,.10)' };
      case 'blocked': return { fg: d ? '#F09A94' : '#A8332B', bg: d ? 'rgba(240,154,148,.14)' : 'rgba(168,51,43,.10)' };
      case 'info': return { fg: d ? '#8FC2FF' : '#1F5FA8', bg: d ? 'rgba(143,194,255,.14)' : 'rgba(31,95,168,.10)' };
      case 'brand': return { fg: d ? P.accent : P.accentBorder, bg: P.accentSoft };
      default: return { fg: P.ink2, bg: P.surface3 };
    }
  }

  const formatCurrency = (amount, opts) => {
    const showCents = opts?.showCents ?? true;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: showCents ? 2 : 0, maximumFractionDigits: showCents ? 2 : 0 }).format(amount);
  };
  const formatCents = (cents, opts) => formatCurrency((cents || 0) / 100, opts);
  const formatNumber = (n) => new Intl.NumberFormat('en-US').format(n);
  const formatPercent = (n, digits = 1) => `${(n * 100).toFixed(digits)}%`;
  const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatDateTime = (iso) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  function relativeTime(iso, now) {
    const n = now ?? (window.ENGAGE_DATA ? window.ENGAGE_DATA.NOW : Date.now());
    const diffMs = n - new Date(iso).getTime();
    const s = Math.abs(diffMs) / 1000;
    const future = diffMs < 0;
    const abs = (label) => (future ? `in ${label}` : `${label} ago`);
    if (s < 60) return abs(`${Math.floor(s)}s`);
    if (s < 3600) return abs(`${Math.floor(s / 60)}m`);
    if (s < 86400) return abs(`${Math.floor(s / 3600)}h`);
    if (s < 86400 * 30) return abs(`${Math.floor(s / 86400)}d`);
    if (s < 86400 * 365) return abs(`${Math.floor(s / 2592000)}mo`);
    return abs(`${Math.floor(s / 31536000)}y`);
  }

  const uidKind = () => 'huid';
  const uidShort = (v) => String(v).toUpperCase();

  window.HD = {
    ENTITIES, hueColor, tone,
    formatCurrency, formatCents, formatNumber, formatPercent, formatDate, formatDateTime, relativeTime,
    uidKind, uidShort,
  };
})();
