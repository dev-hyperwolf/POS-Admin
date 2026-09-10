// ── docs-app/app.jsx ── Hyperwolf Docs shell ────────────────────────────────
// Skeleton copied from incentives/app.jsx / idv's app shell: HWRail (shared
// left rail, active id 'docs'), ThemeProvider + ScreenBoundary backstop, one
// ReactDOM.createRoot mount at the bottom. This file owns the app's own
// three-screen sub-nav (Pages / Search / Ask) and mounts nothing else — every
// network call goes through window.HWDocs (docs-app/docs-client.jsx).
//
// Leaks nothing: the whole file is one IIFE, so top-level consts here never
// collide with another script on this page (test/global-collisions.test.mjs).
;(function () {
  const useP = window.useP;
  const HD = window.HD;
  // Same backstop reasoning as incentives/app.jsx: every region below is safe
  // to CONTAIN (a failed screen just shows an ErrorState), so ScreenBoundary
  // everywhere, with a no-op fallback if error-boundary.jsx somehow didn't load.
  const BFrame = window.ScreenBoundary || function BFrame(p) { return p.children; };

  // ── a small markdown renderer, just for this app ─────────────────────────
  // Headings, paragraphs, bullet/numbered lists, fenced code, inline code,
  // bold, links and tables (rendered as <pre>, per spec) — nothing fancier.
  // citationMap, when given, turns a bare "[n]" into a link to that
  // citation's GitHub URL (used by the Ask screen); Pages/Search markdown has
  // no citationMap and "[n]"-shaped text (rare in docs) just renders as text.
  const INLINE_RE = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|\[\d+\])/g;

  function renderInline(text, keyBase, citationMap, P) {
    const parts = String(text == null ? '' : text).split(INLINE_RE);
    const out = [];
    parts.forEach((part, i) => {
      if (!part) return;
      const k = keyBase + '-' + i;
      let m;
      if ((m = /^`([^`]+)`$/.exec(part))) {
        out.push(<code key={k} style={{ fontFamily: P.fontMono, fontSize: '.92em', background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: 4, padding: '1px 5px' }}>{m[1]}</code>);
      } else if ((m = /^\*\*([^*]+)\*\*$/.exec(part))) {
        out.push(<strong key={k}>{m[1]}</strong>);
      } else if ((m = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part))) {
        out.push(<a key={k} href={m[2]} target="_blank" rel="noreferrer" style={{ color: P.accentText }}>{m[1]}</a>);
      } else if ((m = /^\[(\d+)\]$/.exec(part)) && citationMap && citationMap[m[1]]) {
        const c = citationMap[m[1]];
        out.push(
          <a key={k} href={c.url} target="_blank" rel="noreferrer" title={`${c.repo} ${c.path}:${c.start}-${c.end}`}
            style={{ color: P.accentText, fontWeight: 700, fontFamily: P.fontMono, fontSize: '.9em', whiteSpace: 'nowrap' }}>[{m[1]}]</a>);
      } else {
        out.push(part);
      }
    });
    return out;
  }

  function renderMarkdown(md, P, citationMap) {
    const lines = String(md == null ? '' : md).replace(/\r\n/g, '\n').split('\n');
    const blocks = [];
    let i = 0, key = 0;
    const nextKey = () => 'md' + (key++);
    const pStyle = { margin: '0 0 12px', lineHeight: 1.6, fontSize: P.type.body, color: P.ink2 };
    const listStyle = { margin: '0 0 12px', paddingLeft: 22, lineHeight: 1.6, fontSize: P.type.body, color: P.ink2 };
    const preStyle = { margin: '0 0 12px', padding: '11px 13px', background: P.surface3, border: `1px solid ${P.hairline2}`, borderRadius: P.r10, fontFamily: P.fontMono, fontSize: 12, lineHeight: 1.55, overflow: 'auto', color: P.ink2, whiteSpace: 'pre' };
    const headingStyle = (level) => ({ margin: level <= 2 ? '20px 0 10px' : '16px 0 8px', fontWeight: P.weight.emph, color: P.ink, fontSize: [0, 22, 19, 16.5, 14.5, 13.5, 13][level] || 14 });
    const isBlockStart = (l) => /^\s*$/.test(l) || /^```/.test(l) || /^(#{1,6})\s+/.test(l) || /^\s*[-*]\s+/.test(l) || /^\s*\d+\.\s+/.test(l) || /^\s*\|.*\|\s*$/.test(l);

    while (i < lines.length) {
      const line = lines[i];
      if (/^\s*$/.test(line)) { i++; continue; }

      const fence = /^```(\w*)\s*$/.exec(line);
      if (fence) {
        const codeLines = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) { codeLines.push(lines[i]); i++; }
        i++;
        blocks.push(<pre key={nextKey()} style={preStyle}><code>{codeLines.join('\n')}</code></pre>);
        continue;
      }

      if (/^\s*\|.*\|\s*$/.test(line) && lines[i + 1] && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
        const tableLines = [line];
        i++;
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { tableLines.push(lines[i]); i++; }
        blocks.push(<pre key={nextKey()} style={preStyle}>{tableLines.join('\n')}</pre>);
        continue;
      }

      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        const level = h[1].length;
        const Tag = 'h' + Math.min(level, 6);
        blocks.push(React.createElement(Tag, { key: nextKey(), style: headingStyle(level) }, renderInline(h[2], nextKey(), citationMap, P)));
        i++;
        continue;
      }

      if (/^\s*[-*]\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; }
        blocks.push(<ul key={nextKey()} style={listStyle}>{items.map((it, idx) => <li key={idx}>{renderInline(it, nextKey(), citationMap, P)}</li>)}</ul>);
        continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; }
        blocks.push(<ol key={nextKey()} style={listStyle}>{items.map((it, idx) => <li key={idx}>{renderInline(it, nextKey(), citationMap, P)}</li>)}</ol>);
        continue;
      }

      const paraLines = [line];
      i++;
      while (i < lines.length && !isBlockStart(lines[i])) { paraLines.push(lines[i]); i++; }
      blocks.push(<p key={nextKey()}style={pStyle}>{renderInline(paraLines.join(' '), nextKey(), citationMap, P)}</p>);
    }
    return blocks;
  }

  // ── hash routing for Pages: #page=<repo>:<path> ──────────────────────────
  function pageHash(repo, path) { return '#page=' + encodeURIComponent(repo) + ':' + encodeURIComponent(path); }
  function parsePageHash(hash) {
    const m = /^#page=([^:]*):(.*)$/.exec(hash || '');
    if (!m) return null;
    return { repo: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) };
  }

  // ── the write-token gate — shown whenever any request comes back 403 ─────
  function TokenGate({ onSaved }) {
    const P = useP();
    const [value, setValue] = React.useState('');
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: P.space.x6 }}>
        <window.Card style={{ maxWidth: 420, width: '100%', padding: P.space.x6, display: 'flex', flexDirection: 'column', gap: P.space.x4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="lock" size={20} color={P.accentText} />
            <div style={{ fontSize: P.type.title, fontWeight: P.weight.emph, color: P.ink }}>Docs is private to the dev team</div>
          </div>
          <div style={{ color: P.inkDim, fontSize: P.type.body, lineHeight: 1.5 }}>Paste the write token to continue.</div>
          <window.Field placeholder="Write token" value={value} mono
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) { window.HWDocs.setToken(value.trim()); onSaved(); } }} />
          <window.PBtn variant="primary" disabled={!value.trim()} onClick={() => { window.HWDocs.setToken(value.trim()); onSaved(); }}>Save &amp; retry</window.PBtn>
        </window.Card>
      </div>);
  }

  // ── header strip: index status + re-index ────────────────────────────────
  function HeaderStrip({ status, onReindex, reindexing }) {
    const P = useP();
    const idx = status && status.index;
    const reindex = status && status.reindex;
    const running = reindexing || (reindex && reindex.running);
    const repoTitle = idx && idx.per_repo
      ? Object.keys(idx.per_repo).map((r) => `${r}: ${idx.per_repo[r]}`).join('\n')
      : '';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: P.space.x4, padding: '11px 18px', borderBottom: `1px solid ${P.hairline}`, background: P.surface, flex: '0 0 auto' }}>
        <Icon name="note" size={19} color={P.accentText} />
        <div style={{ fontSize: P.type.title, fontWeight: P.weight.emph, color: P.ink }}>Docs</div>
        <div style={{ flex: 1 }} />
        {!idx && !status ? <window.Skeleton lines={1} w={220} /> : idx ? (
          <div title={repoTitle} style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: P.type.meta, color: P.inkDim, fontFamily: P.fontMono }}>
            <span>{HD.formatNumber ? HD.formatNumber(idx.chunks) : idx.chunks} chunks</span>
            <span>·</span>
            <span>{Object.keys(idx.per_repo || {}).length} repos</span>
            <span>·</span>
            <span>built {idx.built_at ? HD.formatDateTime(idx.built_at) : '—'}</span>
          </div>
        ) : (
          <div style={{ fontSize: P.type.meta, color: P.warnText }}>Index not built yet</div>
        )}
        {running && <window.HDPill tone="info" label="Re-indexing…" />}
        <window.PBtn size="sm" variant="secondary" icon="refresh" busy={running} disabled={running} onClick={onReindex}>Re-index</window.PBtn>
      </div>);
  }

  // ── the app's own left sub-nav ────────────────────────────────────────────
  function SubNav({ tab, onTab }) {
    const P = useP();
    const ITEMS = [
      { id: 'pages', label: 'Pages', icon: 'note' },
      { id: 'search', label: 'Search', icon: 'search' },
      { id: 'ask', label: 'Ask', icon: 'chat' },
    ];
    return (
      <nav style={{ width: 168, flex: '0 0 168px', borderRight: `1px solid ${P.hairline}`, background: P.surface2, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {ITEMS.map((it) => {
          const a = it.id === tab;
          return (
            <button key={it.id} onClick={() => onTab(it.id)} style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', borderRadius: P.r8, border: 'none', cursor: 'pointer',
              background: a ? P.accentSoft : 'transparent', color: a ? P.accentText : P.ink2, fontWeight: a ? 700 : 500,
              fontSize: P.type.body, fontFamily: P.fontSans, textAlign: 'left' }}>
              <Icon name={it.icon} size={16} stroke={a ? 1.9 : 1.6} />{it.label}
            </button>);
        })}
      </nav>);
  }

  // ── Pages screen ──────────────────────────────────────────────────────────
  function PagesScreen({ initialSelection }) {
    const P = useP();
    const [list, setList] = React.useState({ loading: true, error: null, pages: [], reports: [] });
    const [selected, setSelected] = React.useState(initialSelection || null);
    const [doc, setDoc] = React.useState({ loading: false, error: null, data: null });

    const loadList = React.useCallback(() => {
      setList((s) => ({ ...s, loading: true, error: null }));
      window.HWDocs.pages().then(
        (r) => setList({ loading: false, error: null, pages: r.pages || [], reports: r.reports || [] }),
        (e) => setList({ loading: false, error: e, pages: [], reports: [] }));
    }, []);
    React.useEffect(() => { loadList(); }, [loadList]);

    const open = React.useCallback((item) => {
      setSelected(item);
      location.hash = pageHash(item.repo, item.path);
    }, []);

    React.useEffect(() => {
      if (!selected) return;
      setDoc({ loading: true, error: null, data: null });
      window.HWDocs.page(selected.repo, selected.path).then(
        (r) => setDoc({ loading: false, error: null, data: r }),
        (e) => setDoc({ loading: false, error: e, data: null }));
    }, [selected && selected.repo, selected && selected.path]);

    React.useEffect(() => {
      const onHash = () => {
        const p = parsePageHash(location.hash);
        if (p) setSelected(p);
      };
      window.addEventListener('hashchange', onHash);
      return () => window.removeEventListener('hashchange', onHash);
    }, []);

    const Row = ({ item }) => {
      const a = selected && selected.repo === item.repo && selected.path === item.path;
      return (
        <button onClick={() => item.present !== false && open(item)} disabled={item.present === false} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, width: '100%', textAlign: 'left',
          padding: '8px 10px', borderRadius: P.r8, border: 'none', cursor: item.present === false ? 'default' : 'pointer',
          background: a ? P.accentSoft : 'transparent', opacity: item.present === false ? .5 : 1 }}>
          <div style={{ fontSize: P.type.body, fontWeight: a ? 700 : 500, color: a ? P.accentText : P.ink }}>{item.title || item.path}</div>
          <div style={{ fontSize: P.type.micro, color: P.inkMute, fontFamily: P.fontMono }}>{item.repo} · {item.path}{item.present === false ? ' · missing' : ''}</div>
        </button>);
    };

    return (
      <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
        <div style={{ width: 300, flex: '0 0 300px', borderRight: `1px solid ${P.hairline}`, overflowY: 'auto', padding: 12 }}>
          {list.loading ? <window.SkeletonRows rows={6} avatar={false} /> : list.error ? (
            <window.ErrorState compact title="Couldn't load pages" body={list.error.error && list.error.error.message} onRetry={loadList} />
          ) : (
            <>
              <window.MicroLabel>Pages</window.MicroLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 16 }}>
                {list.pages.length ? list.pages.map((p) => <Row key={p.repo + '/' + p.path} item={p} />) : <div style={{ color: P.inkMute, fontSize: P.type.meta, padding: '4px 10px' }}>None yet.</div>}
              </div>
              <window.MicroLabel>Repo reports</window.MicroLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {list.reports.length ? list.reports.map((p) => <Row key={p.repo + '/' + p.path} item={p} />) : <div style={{ color: P.inkMute, fontSize: P.type.meta, padding: '4px 10px' }}>None yet.</div>}
              </div>
            </>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '20px 32px' }}>
          {!selected ? (
            <window.EmptyState icon="note" title="Pick a page" body="Select a page or repo report on the left to read it here." />
          ) : doc.loading ? (
            <window.SkeletonRows rows={8} avatar={false} />
          ) : doc.error ? (
            <window.ErrorState title="Couldn't load that page" body={doc.error.error && doc.error.error.message} onRetry={() => setSelected({ ...selected })} />
          ) : doc.data ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ fontSize: P.type.meta, color: P.inkMute, fontFamily: P.fontMono, flex: 1 }}>{doc.data.repo} · {doc.data.path}</div>
                {doc.data.url && <a href={doc.data.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: P.type.meta, color: P.accentText, fontWeight: 600, textDecoration: 'none' }}><Icon name="external" size={13} />View on GitHub</a>}
              </div>
              <div style={{ maxWidth: 760 }}>{renderMarkdown(doc.data.text, P)}</div>
            </div>
          ) : null}
        </div>
      </div>);
  }

  // ── Search screen ─────────────────────────────────────────────────────────
  function SearchScreen({ roots }) {
    const P = useP();
    const [q, setQ] = React.useState('');
    const [repo, setRepo] = React.useState('');
    const [state, setState] = React.useState({ loading: false, error: null, hits: null });

    const run = React.useCallback(() => {
      const query = q.trim();
      if (!query) return;
      setState({ loading: true, error: null, hits: null });
      window.HWDocs.search(query, { k: 20, repo: repo || undefined }).then(
        (r) => setState({ loading: false, error: null, hits: r.hits || [] }),
        (e) => setState({ loading: false, error: e, hits: null }));
    }, [q, repo]);

    return (
      <div style={{ padding: '20px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, maxWidth: 760 }}>
          <window.Field icon="search" placeholder="Search the docs and audit reports…" value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') run(); }} />
          <select value={repo} onChange={(e) => setRepo(e.target.value)} style={{ height: P.ctrlH.md, borderRadius: P.r8, border: `1px solid ${P.fieldBorder}`, background: P.field, color: P.ink, fontFamily: P.fontSans, fontSize: P.type.body, padding: '0 10px' }}>
            <option value="">All repos</option>
            {(roots || []).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <window.PBtn variant="primary" onClick={run} disabled={!q.trim()}>Search</window.PBtn>
        </div>
        {state.loading ? <window.SkeletonRows rows={5} avatar={false} /> : state.error ? (
          <window.ErrorState compact title="Search failed" body={state.error.error && state.error.error.message} onRetry={run} />
        ) : state.hits && state.hits.length === 0 ? (
          <window.EmptyState icon="search" title="No matches" body="Try a different query, or clear the repo filter." />
        ) : state.hits ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 900 }}>
            {state.hits.map((h) => (
              <window.Card key={h.id} density="compact" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: P.type.body, color: P.ink, flex: 1 }}>{h.title || h.path}</div>
                  <span style={{ fontFamily: P.fontMono, fontSize: P.type.micro, color: P.inkMute }}>score {Number(h.score).toFixed(2)}</span>
                </div>
                <div style={{ fontFamily: P.fontMono, fontSize: P.type.meta, color: P.inkMute }}>{h.repo} · {h.path}:{h.start}-{h.end}{h.kind ? ` · ${h.kind}` : ''}</div>
                <div style={{ fontSize: P.type.body, color: P.ink2, lineHeight: 1.5 }}>{h.snippet}</div>
                {h.url && <a href={h.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: P.type.meta, color: P.accentText, fontWeight: 600, textDecoration: 'none', alignSelf: 'flex-start' }}><Icon name="external" size={12} />View on GitHub</a>}
              </window.Card>))}
          </div>
        ) : null}
      </div>);
  }

  // ── Ask screen ────────────────────────────────────────────────────────────
  function modeBadgeText(mode, model) {
    if (mode === 'model' && model && model.model) return model.model;
    if (mode === 'none') return 'no answer available';
    const suffix = model && model.configured === false ? 'no model configured' : (model && model.model ? model.model : null);
    return suffix ? `${mode} · ${suffix}` : mode;
  }

  function AskScreen({ roots }) {
    const P = useP();
    const [repo, setRepo] = React.useState('');
    const [input, setInput] = React.useState('');
    const [turns, setTurns] = React.useState([]); // [{role, content, citations?, mode?, model?, error?}]
    const [sending, setSending] = React.useState(false);
    const endRef = React.useRef(null);

    React.useEffect(() => { endRef.current && endRef.current.scrollIntoView({ block: 'end' }); }, [turns.length, sending]);

    const send = React.useCallback(() => {
      const question = input.trim();
      if (!question || sending) return;
      const history = turns.slice(-8).map((t) => ({ role: t.role, content: t.content }));
      const next = turns.concat([{ role: 'user', content: question }]);
      setTurns(next);
      setInput('');
      setSending(true);
      window.HWDocs.chat(question, history, repo || undefined).then(
        (r) => { setSending(false); setTurns((s) => s.concat([{ role: 'assistant', content: r.answer, citations: r.citations || [], mode: r.mode, model: r.model }])); },
        (e) => { setSending(false); setTurns((s) => s.concat([{ role: 'assistant', content: '', error: e }])); });
    }, [input, sending, turns, repo]);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: `1px solid ${P.hairline}` }}>
          <div style={{ fontSize: P.type.meta, color: P.inkMute }}>Scope:</div>
          <select value={repo} onChange={(e) => setRepo(e.target.value)} style={{ height: P.ctrlH.sm, borderRadius: P.r8, border: `1px solid ${P.fieldBorder}`, background: P.field, color: P.ink, fontFamily: P.fontSans, fontSize: P.type.meta, padding: '0 8px' }}>
            <option value="">All repos</option>
            {(roots || []).map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {turns.length === 0 && <window.EmptyState icon="chat" title="Ask the docs" body="Ask a question about the audit, the contracts, or any repo — answers cite file:line." />}
          {turns.map((t, i) => {
            if (t.role === 'user') {
              return (
                <div key={i} style={{ alignSelf: 'flex-end', maxWidth: 560, background: P.accentSoft, color: P.ink, borderRadius: P.r12, padding: '10px 14px', fontSize: P.type.body }}>{t.content}</div>);
            }
            const citationMap = {};
            (t.citations || []).forEach((c) => { citationMap[c.n] = c; });
            return (
              <div key={i} style={{ alignSelf: 'flex-start', maxWidth: 700, width: '100%' }}>
                {t.error ? (
                  <window.ErrorState compact title="Couldn't get an answer" body={t.error.error && t.error.error.message} />
                ) : (
                  <window.Card density="compact" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>{renderMarkdown(t.content, P, citationMap)}</div>
                    {t.citations && t.citations.length > 0 && (
                      <div style={{ borderTop: `1px solid ${P.hairline}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <window.MicroLabel>Sources</window.MicroLabel>
                        {t.citations.map((c) => (
                          <a key={c.n} href={c.url} target="_blank" rel="noreferrer" style={{ display: 'flex', gap: 6, fontSize: P.type.meta, color: P.inkDim, textDecoration: 'none' }}>
                            <span style={{ fontFamily: P.fontMono, color: P.accentText, fontWeight: 700 }}>[{c.n}]</span>
                            <span>{c.repo} {c.path}:{c.start}-{c.end}{c.title ? ` — ${c.title}` : ''}</span>
                          </a>))}
                      </div>)}
                    <div><window.HDPill tone="neutral" icon={false} label={modeBadgeText(t.mode, t.model)} /></div>
                  </window.Card>
                )}
              </div>);
          })}
          {sending && <window.SkeletonRows rows={2} avatar={false} style={{ maxWidth: 700 }} />}
          <div ref={endRef} />
        </div>
        <div style={{ display: 'flex', gap: 10, padding: 16, borderTop: `1px solid ${P.hairline}` }}>
          <window.Field placeholder="Ask about a repo, the audit, or the contract…" value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <window.PBtn variant="primary" icon="send" onClick={send} disabled={!input.trim() || sending} busy={sending}>Ask</window.PBtn>
        </div>
      </div>);
  }

  // ── App ───────────────────────────────────────────────────────────────────
  function App() {
    const P = useP();
    const [gated, setGated] = React.useState(!window.HWDocs.hasToken());
    const [status, setStatus] = React.useState(null);
    const [statusError, setStatusError] = React.useState(null);
    const [reindexing, setReindexing] = React.useState(false);
    const initialHash = React.useMemo(() => parsePageHash(location.hash), []);
    const [tab, setTab] = React.useState(initialHash ? 'pages' : 'pages');
    const pollRef = React.useRef(null);

    const loadStatus = React.useCallback(() => {
      window.HWDocs.status().then(
        (r) => { setStatus(r); setStatusError(null); setGated(false); },
        (e) => { if (e && e.status === 403) { setGated(true); } else { setStatusError(e); } });
    }, []);

    React.useEffect(() => { if (!gated) loadStatus(); }, [gated, loadStatus]);

    const stopPoll = React.useCallback(() => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }, []);
    React.useEffect(() => () => stopPoll(), [stopPoll]);

    const onReindex = React.useCallback(() => {
      setReindexing(true);
      window.HWDocs.reindex().then(
        () => {
          stopPoll();
          pollRef.current = setInterval(() => {
            window.HWDocs.status().then((r) => {
              setStatus(r);
              if (!r.reindex || !r.reindex.running) { setReindexing(false); stopPoll(); }
            }, () => { setReindexing(false); stopPoll(); });
          }, 3000);
        },
        (e) => { setReindexing(false); if (e && e.status === 403) setGated(true); });
    }, [stopPoll]);

    const roots = (status && status.roots) || [];

    return (
      <div style={{ display: 'flex', height: '100%', background: P.bg, color: P.ink, fontFamily: P.fontSans }}>
        <BFrame name="The navigation rail"><window.HWRail active="docs" /></BFrame>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <BFrame name="The header strip"><HeaderStrip status={status} onReindex={onReindex} reindexing={reindexing} /></BFrame>
          <main style={{ flex: 1, minHeight: 0 }}>
            <BFrame name="Docs" onReset={loadStatus} resetLabel="Retry">
              {gated ? (
                <TokenGate onSaved={() => { setGated(false); loadStatus(); }} />
              ) : statusError ? (
                <window.ErrorState title="Couldn't reach Docs" body={statusError.error && statusError.error.message} onRetry={loadStatus} />
              ) : (
                <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
                  <SubNav tab={tab} onTab={setTab} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {tab === 'pages' && <PagesScreen initialSelection={initialHash} />}
                    {tab === 'search' && <SearchScreen roots={roots} />}
                    {tab === 'ask' && <AskScreen roots={roots} />}
                  </div>
                </div>
              )}
            </BFrame>
          </main>
        </div>
        {window.ToastHost ? <window.ToastHost /> : null}
      </div>);
  }

  window.DocsApp = App;
  // Backstop, same reasoning as incentives/app.jsx's: catches App itself and
  // ThemeProvider's children, so a throw in App's own body is a named panel
  // instead of a white screen.
  ReactDOM.createRoot(document.getElementById('root')).render(
    <ThemeProvider><BFrame name="Docs"><App /></BFrame></ThemeProvider>);
})();
