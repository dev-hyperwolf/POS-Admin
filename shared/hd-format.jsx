// ── Generic Hyperdrive helpers for apps outside the pipeline ───────────────
// Entities · hues · tones · UID formatting · number/date formatting.
// Every color resolves from pos/tokens.jsx — no literals live here.
// pipeline/domain.jsx loads on top of this file and supersets it with
// batch-specific domain logic; it does not redefine anything below.
;(function () {
  const ENTITIES = [
    { id: 'thc', name: 'THC Flower Manufacturing', short: 'THC', hue: 'green' },
    { id: 'ccd', name: 'Circle City Distribution', short: 'CCD', hue: 'blue' },
    { id: 'ah', name: 'Alternate Health', short: 'AH', hue: 'violet' },
    { id: 'hwd', name: 'Hyperwolf Delivery', short: 'HWD', hue: 'teal' },
  ];

  // Categorical wayfinding hues (decorative only, never status).
  const hueColor = (P, hue) => (hue === 'accent' ? P.accent : (P.hue && P.hue[hue]) || P.inkMute);

  // tone → { fg, bg, pill } for pills, dots, column headers and card accents.
  function tone(P, t) {
    switch (t) {
      case 'ok': return { fg: P.good, bg: P.goodSoft, pill: 'good' };
      case 'warn': return { fg: P.warn, bg: P.warnSoft, pill: 'warn' };
      case 'blocked': return { fg: P.bad, bg: P.badSoft, pill: 'bad' };
      case 'info': return { fg: P.info, bg: P.infoSoft, pill: 'info' };
      case 'quarantine': return { fg: P.indica, bg: P.indica + (P.mode === 'dark' ? '28' : '1F'), pill: 'neutral' };
      case 'sealing': return { fg: P.cat.wellness, bg: P.cat.wellness + (P.mode === 'dark' ? '28' : '1F'), pill: 'neutral' };
      case 'archived': return { fg: P.neutral, bg: P.neutralSoft, pill: 'neutral' };
      case 'brand': return { fg: P.mode === 'dark' ? P.accent : P.accentBorder, bg: P.accentSoft, pill: 'accent' };
      default: return { fg: P.ink2, bg: P.neutralSoft, pill: 'neutral' };
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

  // METRC / HUID short forms — mid-ellipsis for METRC, last-4 for HUIDs.
  function uidKind(value) {
    const v = String(value);
    if (/^HWID-/i.test(v)) return 'huid';
    if (/^INV-/i.test(v)) return 'invoice';
    if (/^(ORD|SO)-/i.test(v)) return 'order';
    if (/^[0-9A-Fa-f]{24}$/.test(v)) return v.toUpperCase().startsWith('48') ? 'huid' : 'metrc';
    return v.toUpperCase().startsWith('1A') ? 'metrc' : 'huid';
  }
  function uidShort(value, kind) {
    const v = String(value);
    const k = kind || uidKind(v);
    if (/^HWID-/i.test(v)) return v.toUpperCase();
    if (k === 'invoice' || k === 'order') return v.toUpperCase();
    if (k === 'huid') return `HWID-${v.slice(-4).toUpperCase()}`;
    if (v.length >= 24) return `${v.slice(0, 9)}…${v.slice(-4).toUpperCase()}`;
    return v.toUpperCase();
  }

  window.HD = {
    ENTITIES, hueColor, tone,
    formatCurrency, formatCents, formatNumber, formatPercent, formatDate, formatDateTime, relativeTime,
    uidKind, uidShort,
  };
})();
