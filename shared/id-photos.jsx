/* ══ PHOTOS OF THE PHYSICAL ID / PASSPORT ═══════════════════════════════════
 *
 * The owner asked for this directly: "an image upload field where our staff can
 * include a photo or photos of the ID / passport."
 *
 * ONE COMPONENT, IN shared/, BECAUSE THERE ARE SEVERAL SCAN/CREATE MODALS.
 * pos/checkin.jsx has two (the check-in New-customer form and the party's
 * new-guest onboarding), and the customer screens have more. A second copy of
 * this control is a second place the storage sentence can go stale, and the
 * storage sentence is the compliance-critical part. Adopt `window.IdPhotoCapture`
 * — never fork it.
 *
 * ── THE RULES THIS FILE IS WRITTEN AGAINST ─────────────────────────────────
 *
 * 1. NOTHING IS EVER FABRICATED. No stock avatar, no sample licence, no
 *    placeholder tile that could be mistaken for a capture. Until today this
 *    very flow filled a missing scanned name with 'Jordan A. Vasquez' and
 *    '09/02/1988'; an invented IMAGE on a compliance artefact is that defect
 *    with a camera bolted on. Zero photos renders as a plain sentence saying
 *    zero photos.
 *
 * 2. "NO PHOTO TAKEN" AND "PHOTO TAKEN, PREVIEW FAILED" ARE DIFFERENT FACTS and
 *    get different faces. An absence is neutral and expected; a photo that is
 *    attached but cannot be drawn is an alarm, because the operator believes
 *    something is on file and cannot see what. They must never share a tile.
 *    There are three preview outcomes, not two — see `preview` below.
 *
 * 3. THE STORAGE CLAIM IS THE ONE SENTENCE THAT MUST NOT DRIFT. Nothing in this
 *    build uploads an image anywhere. `STORAGE.line` says exactly that, it is
 *    rendered unconditionally beside the control, and it is the single string
 *    to change on the day a real route exists. Overclaiming storage on a
 *    compliance artefact is worse than not having the feature at all.
 *
 * 4. A REFUSAL NAMES THE FILE AND THE ACTUAL VALUE. "Invalid file" makes the
 *    operator guess, at a counter, with people waiting. `accept()` is a pure
 *    function returning the sentence, so the refusal can be tested without
 *    rendering anything.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ──────────────────────────────────────────
 *
 * · NO UPLOAD, NO SERVER CALL, NO INVENTED ENDPOINT. There is no route for ID
 *   images in this estate. Inventing `POST /api/id-photos` so the UI could say
 *   "saved" would be the worst version of this feature. The client half is
 *   honest and complete; the server half is written up for the owner.
 * · NO CLIENT-SIDE DOWNSCALING / RE-ENCODING. Re-compressing a compliance
 *   artefact before anyone has specified what gets retained is a decision about
 *   evidence, not about bytes, and it is not this control's to make.
 * · NO OCR, NO FACE MATCH, NO "does this photo match the scan". The scanner
 *   answers identity; this attaches what the operator saw.
 * · NO EXIF STRIPPING. Same reason as downscaling — and stripping it silently
 *   would destroy the capture time, which is the one thing a regulator asks for.
 *
 * ── WHAT THE SERVER HALF STILL NEEDS (handed back, not invented) ───────────
 *
 * The client is complete and honest; the images do not leave the tab. Making
 * them persist is a set of decisions this control must NOT make for you:
 *
 *   1. A route. Something like PUT /api/customer/<id>/id-photo taking one image
 *      and returning a stable id. Attaching at CREATE time means the customer
 *      id does not exist yet, so either the create call carries the images or
 *      the client uploads first and posts references — that is your call, and
 *      it changes the shape of what this component hands back.
 *   2. WHERE the bytes live and for how long. A photograph of a government ID
 *      is regulated personal data. Retention period, encryption at rest, who
 *      may read it back, and what happens on a customer deletion request are
 *      policy, not implementation.
 *   3. An audit trail. Who attached it, from which terminal, at what time —
 *      the same three facts the scan already records (`by` / `where` /
 *      `scannedAt` on the document).
 *   4. A read path, so a photo attached today can be seen tomorrow. Until that
 *      exists, "attached" can only ever mean "in this tab".
 *
 * When 1–4 exist, `STORAGE` below is the single place this file changes, and
 * its `line` must change WITH its `mode` — the sentence is the contract.
 */
;(function () {
  const useP = window.useP;

  const KB = 1024;
  const MB = KB * KB;

  /* WHAT IS ACCEPTED, AND WHY THESE NUMBERS.
   *
   * maxFiles 4 — a passport is one page; a driving licence is two sides; a
   *   second document (a medical recommendation) is a third and fourth. Four
   *   covers every real counter case and bounds what one record holds in memory.
   * maxBytes 8 MB — an iPhone HEIC is ~2 MB and a full-resolution iPad JPEG
   *   ~3-5 MB, so 8 MB accepts every honest counter photo with headroom while
   *   refusing the 40 MB scan somebody drags in from a desktop folder.
   *
   * HEIC IS ON THE LIST BECAUSE iOS SHOOTS IT BY DEFAULT. Safari often reports
   * an EMPTY `file.type` for HEIC, so the extension is a legitimate second
   * reading — but only as a fallback, and an unreadable BOTH is refused rather
   * than waved through. Note the honest consequence, stated on screen: most
   * browsers cannot DRAW a HEIC, so it attaches and previews as unavailable.
   * That is outcome 2 of rule 2, not a failure. */
  const LIMITS = { maxFiles: 4, maxBytes: 8 * MB };

  const TYPES = [
    { mime: 'image/jpeg', ext: ['jpg', 'jpeg'], label: 'JPEG' },
    { mime: 'image/png', ext: ['png'], label: 'PNG' },
    { mime: 'image/heic', ext: ['heic'], label: 'HEIC' },
    { mime: 'image/heif', ext: ['heif'], label: 'HEIF' },
    { mime: 'image/webp', ext: ['webp'], label: 'WebP' },
  ];
  const TYPE_NAMES = 'JPEG, PNG, HEIC or WebP';
  /* FORMATS THAT ATTACH FINE AND THAT NO DESKTOP BROWSER CAN DRAW.
   *
   * Found by looking at the real thing rather than at jsdom, and it matters:
   * an iPhone shoots HEIC by default, so <img src="blob:…"> fires `error` on
   * the single most likely photo an operator will ever attach. Rendering that
   * in the red "would not load" face puts a false alarm on the normal path —
   * which is how operators learn to ignore the tile that IS an alarm. A format
   * this browser cannot render and a file that is broken are different facts,
   * and the difference is knowable: it is the format we already identified. */
  const UNDRAWABLE = ['HEIC', 'HEIF'];
  /* The `accept` attribute is a HINT to the file picker, never a check. Every
   * browser lets a determined user pick anything, and some hand back an empty
   * MIME type for a file that IS acceptable. `accept()` below is the check. */
  const ACCEPT_ATTR = TYPES.map((t) => t.mime).concat(TYPES.reduce((a, t) => a.concat(t.ext.map((e) => '.' + e)), [])).join(',');

  /* SIZES ARE PRINTED THE WAY A HUMAN READS THEM, and 0 is a special case: "0
   * bytes" is the whole point of the empty-file refusal and "0.0 KB" hides it. */
  function formatBytes(n) {
    if (!(n > 0)) return '0 bytes';
    if (n < KB) return n + ' bytes';
    if (n < MB) return (n / KB).toFixed(n < 10 * KB ? 1 : 0) + ' KB';
    return (n / MB).toFixed(1) + ' MB';
  }

  function extOf(name) {
    const m = /\.([A-Za-z0-9]+)$/.exec(String(name || ''));
    return m ? m[1].toLowerCase() : '';
  }

  /** The declared type if we recognise it, else the type the extension implies,
   *  else null. Null is a refusal, never a shrug that lets the file through. */
  function readType(file) {
    const mime = String(file && file.type || '').toLowerCase();
    const byMime = TYPES.find((t) => t.mime === mime);
    if (byMime) return byMime;
    // A declared type we do NOT recognise is an answer, and the answer is no.
    // Falling back to the extension here would let `report.pdf` renamed to
    // `id.jpg` past a check that had already read `application/pdf`.
    if (mime) return null;
    const ext = extOf(file && file.name);
    return TYPES.find((t) => t.ext.indexOf(ext) >= 0) || null;
  }

  /* THE WHOLE ADMISSION DECISION, PURE. No DOM, no React, no side effects — so
   * every refusal sentence is testable directly, and the component cannot
   * develop a second opinion. `existing` is the list already attached. */
  function accept(file, existing) {
    const have = (existing || []).length;
    if (!file) return { ok: false, reason: 'No file reached the browser. Nothing was attached.' };
    const name = String(file.name || 'that file');
    if (have >= LIMITS.maxFiles) {
      return { ok: false, reason: LIMITS.maxFiles + ' photos are already attached, which is the limit. Remove one before adding another.' };
    }
    const t = readType(file);
    if (!t) {
      const declared = String(file.type || '');
      return { ok: false, reason: declared
        ? name + ' is a ' + declared + ' file. Attach a photo — ' + TYPE_NAMES + '.'
        : name + ' has no readable image type — neither the file nor its name says what it is. Attach a photo — ' + TYPE_NAMES + '.' };
    }
    const size = Number(file.size) || 0;
    // EMPTY IS ITS OWN REFUSAL. A 0-byte file is a failed transfer, not a big
    // one, and "under the size limit" would let it through to sit on a record
    // as a photo nobody can ever open.
    if (size <= 0) {
      return { ok: false, reason: name + ' is empty — 0 bytes reached the browser. Nothing was attached.' };
    }
    if (size > LIMITS.maxBytes) {
      return { ok: false, reason: name + ' is ' + formatBytes(size) + '. The limit is ' + formatBytes(LIMITS.maxBytes) + ' per photo — re-take it at a lower resolution.' };
    }
    return { ok: true, type: t };
  }

  /* ── WHERE THESE IMAGES GO, STATED ONCE ───────────────────────────────────
   * Today: nowhere. They are Blob URLs in this tab. The control says so, in
   * full, every time it is on screen. When a real route lands, this object is
   * the one place that changes — and whoever changes it must change the words,
   * not just the mode. */
  const STORAGE = {
    mode: 'memory',
    short: 'In this browser only · not uploaded',
    line: 'Held in this browser tab only. Nothing is uploaded and nothing is filed against the customer — this build has no server route for ID images. Reloading or closing this page loses them.',
  };

  /* WHICH DOCUMENT A PHOTO WAS TAKEN ALONGSIDE.
   *
   * The hazard is concrete and this file exists downstream of it: scan Marcus
   * Webb, photograph Marcus's licence, press Re-scan, scan somebody else,
   * Create — and the new person's record carries Marcus's licence photos under
   * a green compliance tick. Deleting the photos on a re-scan is not the answer
   * either: a human deliberately captured them and nothing should silently
   * destroy evidence.
   *
   * So each photo is stamped with the document that was on screen when it was
   * added, and any photo whose stamp no longer matches SAYS SO, per photo, and
   * offers Remove. The operator decides; the screen refuses to hide the
   * question. */
  function docKeyOf(doc) {
    if (!doc) return null;
    return [doc.type || '', doc.num || '', doc.scannedAt || ''].join('|');
  }

  function docNote(photo, docKey) {
    const was = photo && photo.docKey || null;
    const now = docKey || null;
    if (was === now) return null;
    if (was && !now) return 'The document this photo was attached to has been discarded. Check it shows the ID now in hand, or remove it.';
    if (!was && now) return 'Attached before this document was scanned. Check it shows the same ID, or remove it.';
    return 'Attached alongside a different document than the one now scanned. Check it, or remove it.';
  }

  /* THE SAME FACT, SHORT ENOUGH TO SIT UNDER A 104px TILE.
   *
   * The full sentence used to be repeated verbatim under every thumbnail, and
   * with two photos in a 530px card that was ten lines of identical amber prose
   * — noise, which is the thing that stops warnings being read. The sentence is
   * now stated ONCE above the strip (naming which files it is about) and the
   * tile carries this flag, so the mapping from tile to warning is still visual
   * and nothing is said twice. Same four branches, same source of truth. */
  function docFlag(photo, docKey) {
    const was = photo && photo.docKey || null;
    const now = docKey || null;
    if (was === now) return null;
    if (was && !now) return 'Document discarded';
    if (!was && now) return 'Taken before this scan';
    return 'Different document';
  }

  /* Ids are for React keys and removal only — never shown, never stored as a
   * meaningful identifier. A counter plus the clock is enough and cannot
   * collide within a session. */
  let _seq = 0;

  /** Turn an accepted File into the record the caller holds.
   *  `preview` is THREE-VALUED on purpose:
   *    'ok'          — we have a URL and the browser drew it
   *    'unavailable' — attached, but this browser gave us no preview URL at all
   *    'failed'      — attached, we had a URL, and the image would not decode
   *  Rule 2 lives here: none of these is "no photo", and only one is fine. */
  function makePhoto(file, docKey) {
    let url = null;
    try {
      if (window.URL && typeof window.URL.createObjectURL === 'function') url = window.URL.createObjectURL(file);
    } catch (e) { url = null; }
    return {
      id: 'idp-' + (++_seq) + '-' + Date.now(),
      name: String(file.name || 'photo'),
      size: Number(file.size) || 0,
      type: String(file.type || '') || ('image/' + extOf(file.name)),
      addedAt: new Date().toISOString(),
      docKey: docKey || null,
      // WHICH FORMAT WE DECIDED IT WAS, kept so the tile can tell a browser
      // limitation from a broken file. See UNDRAWABLE.
      format: (readType(file) || { label: '' }).label,
      url,
      preview: url ? 'ok' : 'unavailable',
      // NOT A STORAGE FLAG WEARING A HOPEFUL NAME. It is false, it is written
      // by the one place that knows (STORAGE.mode), and nothing sets it true.
      stored: STORAGE.mode === 'memory' ? false : true,
      storage: STORAGE.mode,
    };
  }

  function releasePhoto(p) {
    try {
      if (p && p.url && window.URL && typeof window.URL.revokeObjectURL === 'function') window.URL.revokeObjectURL(p.url);
    } catch (e) { /* already gone */ }
  }

  window.HWIdPhotos = { LIMITS, TYPES, TYPE_NAMES, ACCEPT_ATTR, STORAGE,
    formatBytes, readType, accept, docKeyOf, docNote, docFlag, makePhoto, releasePhoto };

  /* ── THE CONTROL ──────────────────────────────────────────────────────────
   *
   * Controlled: the CALLER owns the list, exactly as it owns `nf.doc`. That is
   * what lets Create carry the photos onto the record without this component
   * knowing anything about customers.
   *
   *   photos   array of the records makePhoto returns (required, may be empty)
   *   onChange (nextArray) => void
   *   docKey   HWIdPhotos.docKeyOf(theDocumentOnScreen) — null when there is none
   *   compact  drop the explanatory line; the labels and the storage line stay
   *
   * WIDTH. The check-in modal is ~560px and already crowded, so the tiles are
   * 104px on a wrapping row: four fit on two rows, and the strip never forces
   * a horizontal scrollbar. jsdom cannot tell you that — it was looked at.
   */
  window.IdPhotoCapture = function IdPhotoCapture({ photos, onChange, docKey = null, compact = false, disabled = false }) {
    const P = useP();
    const list = photos || [];
    const fileRef = React.useRef(null);
    const camRef = React.useRef(null);
    // The refusals from the LAST attempt only. Keeping them forever turns the
    // card into a log; clearing them on the next successful add is what a human
    // expects from a message about what they just did.
    const [refused, setRefused] = React.useState([]);

    const set = (next) => { onChange && onChange(next); };

    const addFiles = (fileList) => {
      const incoming = Array.prototype.slice.call(fileList || []);
      if (!incoming.length) return;
      // ACCEPTANCE IS EVALUATED AGAINST THE RUNNING LIST, not the starting one,
      // so selecting six files at once refuses the fifth and sixth by the count
      // rule rather than accepting all six.
      let running = list.slice();
      const said = [];
      let added = 0;
      for (const f of incoming) {
        const v = accept(f, running);
        if (!v.ok) { said.push(v.reason); continue; }
        running = running.concat([makePhoto(f, docKey)]);
        added++;
      }
      setRefused(said);
      if (added) set(running);
    };

    const pick = (ref) => { if (ref.current) { ref.current.value = ''; ref.current.click(); } };

    const remove = (id) => {
      const gone = list.find((p) => p.id === id);
      /* REVOKE ONLY ON A DELIBERATE REMOVE.
       * Not on unmount, and not when the form resets after Create: the caller
       * hands the same photo objects to the customer record, and revoking there
       * would blank the thumbnails on the record it just created. The cost of
       * not revoking is at most four Blob URLs per session, released when the
       * tab closes. The cost of revoking too eagerly is an image that vanishes
       * from a compliance record with no explanation. */
      releasePhoto(gone);
      delete marked.current[id];
      set(list.filter((p) => p.id !== id));
    };

    /* TWO IMAGES CAN FAIL IN THE SAME TICK, AND BOTH HAVE TO BE RECORDED.
     *
     * This is a CONTROLLED component: `set` sends a whole array up, and both
     * calls in one tick compute it from the same stale `list` — so the second
     * overwrote the first and one photo stayed marked 'ok' behind a blank box.
     * That is precisely the failure this control exists to make visible, hiding
     * inside the control itself, and the front and back of one HEIC licence is
     * the case that produces it. Found by a browser; jsdom never fired two.
     *
     * A ref of what has been marked, re-applied on every write, so a second
     * call in the same tick carries the first one with it. */
    const marked = React.useRef({});
    const markPreview = (id, state) => {
      marked.current[id] = state;
      set(list.map((p) => (marked.current[p.id] ? Object.assign({}, p, { preview: marked.current[p.id] }) : p)));
    };

    const TILE = 104, TILE_H = 68;

    const tile = (p) => {
      const flag = docFlag(p, docKey);
      // A FORMAT THIS BROWSER CANNOT DRAW IS NOT A BROKEN FILE. Both arrive
      // here as preview 'failed' (the <img> fires `error` either way) and only
      // one of them is something to worry about — see UNDRAWABLE.
      const undrawable = p.preview !== 'ok' && UNDRAWABLE.indexOf(p.format) >= 0;
      const bad = p.preview === 'failed' && !undrawable;
      const warn = !bad && (p.preview !== 'ok' || !!flag);
      const edge = bad ? P.bad : warn ? P.warn : P.hairline2;
      return <div key={p.id} style={{ width: TILE, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ position: 'relative', width: TILE, height: TILE_H, borderRadius: P.r8,
          border: `1px solid ${edge}`, background: bad ? P.badSoft : warn ? P.warnSoft : P.surface3,
          overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {p.preview === 'ok' ?
            <img src={p.url} alt={p.name} onError={() => markPreview(p.id, 'failed')}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> :
            /* NOT AN EMPTY BOX AND NOT A PLACEHOLDER PICTURE. A file IS
               attached; what is missing is the ability to draw it, and the tile
               says which of the two ways that happened. */
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '0 5px', textAlign: 'center' }}>
              <Icon name={bad ? 'alert' : 'eye-off'} size={13} color={bad ? P.bad : P.warn} />
              <span style={{ fontSize: 10, lineHeight: 1.25, color: P.ink2, fontWeight: 600 }}>
                {bad ? 'Attached · would not load'
                  : undrawable ? 'Attached · no preview (' + p.format + ')'
                  : 'Attached · no preview'}
              </span>
            </span>}
          {!disabled &&
          <button type="button" onClick={() => remove(p.id)} title={'Remove ' + p.name} aria-label={'Remove ' + p.name}
            style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 99, cursor: 'pointer',
              border: `1px solid ${P.hairline2}`, background: P.surface, color: P.ink2,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            <Icon name="x" size={11} stroke={2.2} />
          </button>}
        </div>
        <div title={p.name} style={{ fontSize: 10, color: P.inkDim, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
        <div style={{ fontSize: 10, color: P.inkMute, fontFamily: P.fontMono }}>{formatBytes(p.size)}</div>
        {flag && <div style={{ fontSize: 10, color: P.warn, lineHeight: 1.3, fontWeight: 700 }}>{flag}</div>}
      </div>;
    };

    /* ONE SENTENCE PER DISTINCT WARNING, NAMING THE FILES IT IS ABOUT.
     * Two photos taken alongside a document that has since been discarded is
     * ONE fact about two files, not two facts — printing it twice is how a
     * warning becomes wallpaper. Grouped here, flagged on the tile. */
    const groups = [];
    for (const p of list) {
      const n = docNote(p, docKey);
      if (!n) continue;
      const g = groups.find((x) => x.note === n);
      if (g) g.names.push(p.name); else groups.push({ note: n, names: [p.name] });
    }

    return <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {/* THE TWO WAYS A PHOTO ARRIVES.
          "Take photo" carries `capture`, which a phone or tablet honours by
          opening the rear camera and a desktop browser ignores, falling back to
          the same picker. That degradation is honest because the button never
          claims a camera exists — and the counter runs on tablets, where it is
          the fast path. Nothing records WHICH control was used: a file input
          cannot tell a camera capture from a file on disk, and a `source:
          "camera"` field would be a provenance claim we cannot substantiate. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <PBtn variant="secondary" size="xs" icon="plus" disabled={disabled || list.length >= LIMITS.maxFiles} onClick={() => pick(fileRef)}>Add photo</PBtn>
        <PBtn variant="secondary" size="xs" icon="camera" disabled={disabled || list.length >= LIMITS.maxFiles} onClick={() => pick(camRef)}>Take photo</PBtn>
        <span style={{ fontSize: 11.5, color: P.inkMute }}>
          {list.length === 0 ? 'None attached' : list.length + ' of ' + LIMITS.maxFiles + ' attached'}
        </span>
      </div>
      <input ref={fileRef} type="file" accept={ACCEPT_ATTR} multiple data-hw-idphoto="file"
        onChange={(e) => addFiles(e.target.files)} style={{ display: 'none' }} />
      <input ref={camRef} type="file" accept={ACCEPT_ATTR} capture="environment" data-hw-idphoto="camera"
        onChange={(e) => addFiles(e.target.files)} style={{ display: 'none' }} />

      {list.length === 0 ?
        /* THE ABSENCE. Plain, neutral, and it says the two things the operator
           needs: nothing is here, and nothing is broken. No grey silhouette of
           a licence — a placeholder image on this card is exactly the invented
           artefact this flow has already been burned by. */
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 11px',
          background: P.surface2, border: `1px dashed ${P.hairline2}`, borderRadius: P.r10 }}>
          <Icon name="camera" size={14} color={P.inkMute} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>
            <b>No ID photos attached.</b> Nothing has been captured — this is not an error and it does not block creating the customer. A passport is one page; a licence needs the front and the back.
          </span>
        </div> :
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{list.map(tile)}</div>}

      {groups.map((g, i) =>
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '8px 11px',
          background: P.warnSoft, border: `1px solid ${P.warn}55`, borderRadius: P.r10 }}>
          <Icon name="alert" size={13} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
          <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>
            <b style={{ fontFamily: P.fontMono }}>{g.names.join(', ')}</b> — {g.note}
          </span>
        </div>)}

      {/* THE REFUSAL, IN FULL, NAMING THE FILE. Never "invalid file". */}
      {refused.length > 0 &&
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 11px',
        background: P.badSoft, border: `1px solid ${P.bad}55`, borderRadius: P.r10 }}>
        {refused.map((r, i) =>
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
            <Icon name="alert" size={13} color={P.bad} style={{ flex: '0 0 auto', marginTop: 1 }} />
            <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.4 }}>{r}</span>
          </div>)}
      </div>}

      {/* THE LIMITS, ON ONE LINE. This block is 257px tall with nothing in it,
          inside a modal that is already the tallest thing in the product, so
          every line here has to earn its height. The rules earn theirs: knowing
          them BEFORE the picker opens is what stops the refusal happening. */}
      {!compact &&
      <div style={{ fontSize: 11.5, color: P.inkMute, lineHeight: 1.4 }}>
        {TYPE_NAMES} · up to {formatBytes(LIMITS.maxBytes)} each · {LIMITS.maxFiles} maximum
      </div>}

      {/* THE HEIC CAVEAT, WHERE AND WHEN IT IS TRUE. It used to sit in the line
          above, permanently, explaining a thing that had not happened. It is
          only an explanation once there is something to explain — and then the
          operator is looking straight at the tile it is about. */}
      {list.some((p) => p.preview !== 'ok') &&
      <div style={{ fontSize: 11.5, color: P.inkMute, lineHeight: 1.4 }}>
        A photo above has no preview. The file is attached either way — {UNDRAWABLE.join(' and ')} are camera formats this browser cannot draw, which is a display limit and not a damaged file.
      </div>}

      {/* THE STORAGE CLAIM. Unconditional, and deliberately the plainest
          sentence on the card. If this ever stops being true, THIS is the line
          that has to change first. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '8px 11px',
        background: P.warnSoft, border: `1px solid ${P.warn}55`, borderRadius: P.r10 }}>
        <Icon name="alert" size={13} color={P.warn} style={{ flex: '0 0 auto', marginTop: 1 }} />
        <span style={{ fontSize: 11.5, color: P.ink2, lineHeight: 1.45 }}>{STORAGE.line}</span>
      </div>
    </div>;
  };
})();
