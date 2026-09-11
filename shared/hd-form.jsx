// ── shared/hd-form.jsx ── window.HDForm — one renderer for every generated form ─
//
// docs/migration/FORM-GENERATOR-PROPOSAL.md: a form is a saved FormDef (JSON),
// not a hand-built screen. This file turns a FormDef into a fillable screen, a
// printable sheet, or a pure validator — built from the existing atom set
// (pos/atoms.jsx: Field, Seg, Switch, Check, PBtn, Card, SectionHead;
// shared/hd-ui.jsx: Sheet, hdToast) so a generated form looks like a hand-built
// one. `compile`/`validate` have NO React dependency and run under plain
// `vm` + @babel/standalone in tests (see test/hd-form.test.mjs) — only `render`
// touches React, and only when actually called.
//
// FIELD SCHEMAS REUSE contracts/index.js's walker directly: `HWContracts.validate`
// already accepts either a schema NAME (looked up in SCHEMAS) or a bare schema
// OBJECT (`typeof schemaName === 'string' ? SCHEMAS[schemaName] : schemaName`),
// so an ad-hoc FormDef-derived schema needs no new export there — `compile()`
// below just builds objects in that same {type,$enum,pattern,minLength,...}
// shape and hands them straight to the walker.
//
// IIFE, ONE GLOBAL: window.HDForm. No other top-level name is declared, so this
// file cannot clobber (or be clobbered by) anything else on the page — the
// hazard test/global-collisions.test.mjs exists to catch.
;(function () {
  'use strict';

  var C = window.HWContracts || null;

  // ── show-when ───────────────────────────────────────────────────────────
  // Canonical shape: { field, equals: v } | { field, in: [...] } | { field, not_empty: true }.
  // Any other/unknown condition shape (e.g. the proposal's abridged
  // `{"role_gte":"manager"}` examples, which describe a role gate this v1
  // renderer does not implement) is treated as ALWAYS VISIBLE — failing open on
  // visibility, never on validation, since compile() already excludes any
  // field carrying a showWhen from the unconditional-required set regardless
  // of what the condition says.
  function evalShowWhen(cond, data) {
    if (!cond) return true;
    data = data || {};
    if (Object.prototype.hasOwnProperty.call(cond, 'equals')) return data[cond.field] === cond.equals;
    if (Object.prototype.hasOwnProperty.call(cond, 'in')) {
      return Array.isArray(cond.in) && cond.in.indexOf(data[cond.field]) !== -1;
    }
    if (cond.not_empty) {
      var v = data[cond.field];
      return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
    }
    return true;
  }

  // ── FormDef -> contracts-shaped schema ─────────────────────────────────
  function fieldSchema(f) {
    switch (f.type) {
      case 'text':
      case 'textarea':
        return { type: 'string', minLength: f.minLength, maxLength: f.maxLength, pattern: f.pattern, nullable: !f.required };
      case 'number':
        return { type: 'number', minimum: f.minimum, maximum: f.maximum, nullable: !f.required };
      // Dollars are what the user types; an integer number of CENTS is what is
      // stored and validated — never a Money{cents,currency,basis} object here,
      // that shape is for contracts.SCHEMAS.Money elsewhere in the estate.
      case 'money':
        return { type: 'integer', minimum: f.minimum != null ? f.minimum : 0, nullable: !f.required };
      case 'date':
        return { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', nullable: !f.required };
      case 'time':
        return { type: 'string', pattern: '^\\d{2}:\\d{2}(:\\d{2})?$', nullable: !f.required };
      case 'datetime':
        return { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$', nullable: !f.required };
      case 'select':
        return f.$enum ? { type: 'string', $enum: f.$enum, nullable: !f.required }
          : { type: 'string', enum: f.options || [], nullable: !f.required };
      case 'multiselect':
        return { type: 'array', items: f.$enum ? { type: 'string', $enum: f.$enum } : { type: 'string', enum: f.options || [] } };
      case 'boolean':
      case 'checkbox':
      case 'pin_required':
      case 'pin_stepup':
        return { type: 'boolean' };
      case 'person':
      case 'store':
      case 'photo':
      case 'signature':
        return { type: 'string', minLength: f.required ? 1 : 0, nullable: !f.required };
      case 'checklist':
        return { type: 'array', items: { type: 'string' } };
      case 'repeating_group':
        return { type: 'array', items: buildGroupItemSchema(f) };
      case 'computed':
        return { type: 'number', nullable: true };
      default:
        return { nullable: true };
    }
  }

  function buildGroupItemSchema(f) {
    var props = {}, req = [];
    (f.fields || []).forEach(function (sub) {
      props[sub.key] = fieldSchema(sub);
      if (sub.required && !sub.showWhen) req.push(sub.key);
    });
    return { type: 'object', additionalProperties: true, required: req, properties: props };
  }

  /** Sections OR a flat `fields` array — both are FormDef-legal (proposal §2). */
  function flattenFields(definition) {
    var out = [];
    if (definition && Array.isArray(definition.sections) && definition.sections.length) {
      definition.sections.forEach(function (sec) {
        (sec.fields || []).forEach(function (f) {
          out.push(Object.assign({}, f, { sectionId: sec.id, sectionTitle: sec.title, sectionShowWhen: sec.showWhen }));
        });
      });
    } else if (definition && Array.isArray(definition.fields)) {
      definition.fields.forEach(function (f) { out.push(f); });
    }
    return out;
  }

  /**
   * compile(definition) -> { fields, required, schema }
   * `required` and `schema.required` are the UNCONDITIONAL required set only:
   * a field carrying ANY showWhen is excluded, because whether it is actually
   * required depends on runtime data — validate() computes that per-submission.
   * A `repeating_group` and a `computed` field are never in this set (a group's
   * row-level requirements live in its own item schema; a computed field is
   * read-only, never user-required).
   */
  function compile(definition) {
    var flat = flattenFields(definition || {});
    var required = [];
    var properties = {};
    flat.forEach(function (f) {
      if (!f || f.type === 'section') return;
      properties[f.key] = fieldSchema(f);
      if (f.required && !f.showWhen && f.type !== 'computed' && f.type !== 'repeating_group') required.push(f.key);
    });
    return {
      fields: flat,
      required: required,
      schema: { type: 'object', required: required, additionalProperties: true, properties: properties },
    };
  }

  function isEmpty(v) {
    return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  }

  function checkField(f, v, path, fieldErrors) {
    if (isEmpty(v)) {
      if (f.required) fieldErrors[path] = (f.label || f.key) + ' is required';
      return;
    }
    if (f.type === 'money' && (!C || !C.isCents(v))) {
      fieldErrors[path] = (f.label || f.key) + ' must be a whole number of cents';
      return;
    }
    var schema = fieldSchema(f);
    if (C) {
      var res = C.validate(schema, v);
      if (!res.ok) fieldErrors[path] = res.errors[0];
    }
  }

  /**
   * validate(definition, data) -> { ok, errors, fieldErrors }
   * `fieldErrors` is `{ path: message }`, the same shape the backend's 400
   * `{error:{code,message,details:{fields:{path:message}}}}` carries, so a
   * server-side rejection and a client-side one render through one code path.
   * A field hidden by showWhen (given the CURRENT data) is skipped entirely —
   * not just excluded from "required", excluded from validation altogether,
   * since a hidden field cannot have been filled in through the UI.
   */
  function validate(definition, data) {
    data = data || {};
    var compiled = compile(definition);
    var fieldErrors = {};
    compiled.fields.forEach(function (f) {
      if (!f || f.type === 'section' || f.type === 'computed') return;
      if (!evalShowWhen(f.showWhen, data)) return;
      if (f.type === 'repeating_group') {
        var rows = Array.isArray(data[f.key]) ? data[f.key] : [];
        rows.forEach(function (row, i) {
          (f.fields || []).forEach(function (sub) {
            if (!evalShowWhen(sub.showWhen, row || {})) return;
            checkField(sub, row ? row[sub.key] : undefined, f.key + '[' + i + '].' + sub.key, fieldErrors);
          });
        });
        if (f.required && rows.length === 0) fieldErrors[f.key] = (f.label || f.key) + ' needs at least one row';
        return;
      }
      checkField(f, data[f.key], f.key, fieldErrors);
    });
    var errors = Object.keys(fieldErrors).map(function (k) { return k + ': ' + fieldErrors[k]; });
    return { ok: errors.length === 0, errors: errors, fieldErrors: fieldErrors };
  }

  // ── money display helpers (dollars typed, cents stored) ────────────────
  function dollarsToCents(str) {
    if (str === '' || str === null || str === undefined) return null;
    try { return C ? C.centsFromDollars(str) : Math.round(parseFloat(str) * 100); }
    catch (e) { return NaN; }
  }
  function centsToDollarsStr(c) { return (typeof c === 'number' && isFinite(c)) ? (c / 100).toFixed(2) : ''; }

  // ── computed fields — sum/product of listed keys ───────────────────────
  // f.computed = { op: 'sum'|'product', fields: ['key1','key2',...] }
  function computeValue(f, data) {
    var spec = f.computed;
    if (!spec || !Array.isArray(spec.fields)) return null;
    var nums = spec.fields.map(function (k) {
      var v = data[k];
      return typeof v === 'number' && isFinite(v) ? v : 0;
    });
    if (spec.op === 'product') return nums.reduce(function (a, b) { return a * b; }, 1);
    return nums.reduce(function (a, b) { return a + b; }, 0);
  }

  // ── draft autosave (localStorage, try/catch — a private tab must not throw) ─
  function draftKey(definition) { return 'hdform-draft-' + ((definition && (definition.slug || definition.id)) || 'unknown'); }
  function loadDraft(definition) {
    try {
      var raw = window.localStorage.getItem(draftKey(definition));
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function saveDraft(definition, data) {
    try { window.localStorage.setItem(draftKey(definition), JSON.stringify(data)); } catch (e) { /* private mode, quota, etc. */ }
  }
  function clearDraft(definition) {
    try { window.localStorage.removeItem(draftKey(definition)); } catch (e) {}
  }

  function defaultSubmit(definition, data, station) {
    var slug = definition.slug || definition.id;
    return fetch('/api/forms/' + encodeURIComponent(slug) + '/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: data, station_id: station || null }),
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (body) {
        return { ok: r.status >= 200 && r.status < 300, status: r.status, body: body };
      });
    }, function () {
      return { ok: false, status: 0, body: { error: { code: 'internal', message: 'network error' } } };
    });
  }

  // ════════════════════════ RENDERING (React, only reached when render() ════
  // ════════════════════════ is actually called — safe to load without React) ═
  function useP() {
    return window.useP ? window.useP() : {
      ink: '#15140f', inkDim: '#5c584c', inkMute: '#8a8578', bad: '#b3261e', good: '#1c7c34',
      surface: '#fff', surface2: '#f5f4ef', surface3: '#efede4', hairline2: '#e2ded2',
      field: '#fff', fieldBorder: '#d8d4c6', r8: 8, r10: 10, r12: 12, focusRing: 'none', info: '#1a5fb4',
      fontSans: 'inherit', fontMono: 'inherit', ctrlH: { xs: 28, sm: 32, md: 38, lg: 44, xl: 48 },
    };
  }

  function Row({ children }) {
    return React.createElement('div', { style: { marginBottom: 16 } }, children);
  }
  function LabelLine({ P, f }) {
    return React.createElement('div', { style: { fontSize: 12.5, fontWeight: 600, color: P.ink, marginBottom: 6, display: 'flex', gap: 4 } },
      f.label || f.key,
      f.required ? React.createElement('span', { style: { color: P.bad } }, '*') : null);
  }
  function ErrorLine({ P, msg }) {
    if (!msg) return null;
    return React.createElement('div', { style: { fontSize: 11.5, color: P.bad, marginTop: 5 } }, msg);
  }

  /** One field, dispatched by type. `path` is the data key (or `group[i].sub`). */
  function FieldRow({ f, value, error, disabled, onChange, opts }) {
    var P = useP();
    if (!evalShowWhen(f.showWhen, opts.data)) return null;
    if (f.type === 'section') return null;

    if (f.type === 'computed') {
      var cv = computeValue(f, opts.data);
      var display = f.$moneyLike || f.moneyLike ? centsToDollarsStr(cv) : cv;
      return React.createElement(Row, null,
        React.createElement(LabelLine, { P: P, f: f }),
        React.createElement('div', { style: { minHeight: 44, display: 'flex', alignItems: 'center', padding: '0 13px', background: P.surface3, borderRadius: P.r8, fontFamily: P.fontMono, color: P.inkDim } }, String(display == null ? '—' : display)));
    }

    if (f.type === 'text' || f.type === 'textarea') {
      var Comp = f.type === 'textarea' ? 'textarea' : 'input';
      return React.createElement(Row, null,
        React.createElement(LabelLine, { P: P, f: f }),
        React.createElement(Comp, {
          value: value == null ? '' : value, disabled: disabled,
          onChange: function (e) { onChange(e.target.value); },
          style: { width: '100%', minHeight: 44, padding: '10px 13px', borderRadius: P.r8, border: '1px solid ' + P.fieldBorder, background: P.field, color: P.ink, font: 'inherit', boxSizing: 'border-box' },
        }),
        React.createElement(ErrorLine, { P: P, msg: error }));
    }

    if (f.type === 'number') {
      return React.createElement(Row, null,
        React.createElement(LabelLine, { P: P, f: f }),
        React.createElement(window.Field, {
          value: value == null ? '' : String(value), disabled: disabled, size: 'lg', inputMode: 'numeric',
          onChange: function (e) { var n = e.target.value === '' ? null : Number(e.target.value); onChange(n); },
        }),
        React.createElement(ErrorLine, { P: P, msg: error }));
    }

    if (f.type === 'money') {
      return React.createElement(Row, null,
        React.createElement(LabelLine, { P: P, f: f }),
        React.createElement(window.Field, {
          value: value == null ? '' : centsToDollarsStr(value), disabled: disabled, size: 'lg', inputMode: 'decimal', icon: undefined,
          placeholder: '0.00',
          onChange: function (e) {
            var raw = e.target.value;
            if (raw === '') { onChange(null); return; }
            var c = dollarsToCents(raw);
            onChange(isNaN(c) ? raw : c);
          },
        }),
        React.createElement(ErrorLine, { P: P, msg: error }));
    }

    if (f.type === 'date' || f.type === 'time' || f.type === 'datetime') {
      var htmlType = f.type === 'datetime' ? 'datetime-local' : f.type;
      return React.createElement(Row, null,
        React.createElement(LabelLine, { P: P, f: f }),
        React.createElement('input', {
          type: htmlType, value: value == null ? '' : value, disabled: disabled,
          onChange: function (e) { onChange(e.target.value); },
          style: { minHeight: 44, padding: '0 13px', borderRadius: P.r8, border: '1px solid ' + P.fieldBorder, background: P.field, color: P.ink, font: 'inherit' },
        }),
        React.createElement(ErrorLine, { P: P, msg: error }));
    }

    if (f.type === 'select') {
      var opts_ = f.options || (f.$enum && C ? C.enumValues(f.$enum) : []);
      return React.createElement(Row, null,
        React.createElement(LabelLine, { P: P, f: f }),
        React.createElement(window.Seg, {
          value: value, full: true,
          options: opts_.map(function (o) { return { value: o, label: o }; }),
          onChange: disabled ? function () {} : onChange,
        }),
        React.createElement(ErrorLine, { P: P, msg: error }));
    }

    if (f.type === 'multiselect') {
      var mopts = f.options || (f.$enum && C ? C.enumValues(f.$enum) : []);
      var sel = Array.isArray(value) ? value : [];
      return React.createElement(Row, null,
        React.createElement(LabelLine, { P: P, f: f }),
        React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
          mopts.map(function (o) {
            var on = sel.indexOf(o) !== -1;
            return React.createElement('button', {
              key: o, type: 'button', disabled: disabled,
              onClick: function () { onChange(on ? sel.filter(function (x) { return x !== o; }) : sel.concat([o])); },
              style: { minHeight: 44, padding: '0 14px', borderRadius: 99, border: '1px solid ' + P.hairline2, background: on ? P.ink : P.surface, color: on ? P.surface : P.ink, cursor: 'pointer', font: 'inherit' },
            }, o);
          })),
        React.createElement(ErrorLine, { P: P, msg: error }));
    }

    if (f.type === 'boolean' || f.type === 'checkbox') {
      return React.createElement(Row, null,
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 } },
          React.createElement(window.Check, { on: !!value, onChange: disabled ? function () {} : onChange }),
          React.createElement('span', { style: { fontSize: 13.5, color: P.ink } }, f.label || f.key)),
        React.createElement(ErrorLine, { P: P, msg: error }));
    }

    if (f.type === 'person') {
      var people = opts.people || [];
      return React.createElement(Row, null,
        React.createElement(LabelLine, { P: P, f: f }),
        React.createElement('select', {
          value: value || '', disabled: disabled,
          onChange: function (e) { onChange(e.target.value || null); },
          style: { minHeight: 44, width: '100%', padding: '0 13px', borderRadius: P.r8, border: '1px solid ' + P.fieldBorder, background: P.field, color: P.ink, font: 'inherit' },
        },
        [React.createElement('option', { key: '', value: '' }, 'Select…')].concat(
          people.map(function (p) { return React.createElement('option', { key: p.id, value: p.id }, p.name || p.id); }))),
        React.createElement(ErrorLine, { P: P, msg: error }));
    }

    if (f.type === 'store') {
      var stores = (window.HW_STORES || []);
      return React.createElement(Row, null,
        React.createElement(LabelLine, { P: P, f: f }),
        React.createElement('select', {
          value: value || '', disabled: disabled,
          onChange: function (e) { onChange(e.target.value || null); },
          style: { minHeight: 44, width: '100%', padding: '0 13px', borderRadius: P.r8, border: '1px solid ' + P.fieldBorder, background: P.field, color: P.ink, font: 'inherit' },
        },
        [React.createElement('option', { key: '', value: '' }, 'Select…')].concat(
          stores.map(function (s) { return React.createElement('option', { key: s.id || s, value: s.id || s }, s.name || s.id || s); }))),
        React.createElement(ErrorLine, { P: P, msg: error }));
    }

    if (f.type === 'photo') {
      // File input -> a local object URL. Nothing is uploaded here; the string
      // stored is a placeholder good only for this tab's session, same
      // approach idv document capture uses before its own upload step.
      return React.createElement(Row, null,
        React.createElement(LabelLine, { P: P, f: f }),
        React.createElement('input', {
          type: 'file', accept: 'image/*', disabled: disabled,
          style: { minHeight: 44 },
          onChange: function (e) {
            var file = e.target.files && e.target.files[0];
            if (!file) { onChange(null); return; }
            onChange(URL.createObjectURL(file));
          },
        }),
        value ? React.createElement('img', { src: value, style: { display: 'block', marginTop: 8, maxWidth: 160, borderRadius: P.r8 } }) : null,
        React.createElement(ErrorLine, { P: P, msg: error }));
    }

    if (f.type === 'signature') {
      return React.createElement(SignaturePad, { P: P, f: f, value: value, disabled: disabled, error: error, onChange: onChange });
    }

    if (f.type === 'checklist') {
      var items = f.options || [];
      var checked = Array.isArray(value) ? value : [];
      return React.createElement(Row, null,
        React.createElement(LabelLine, { P: P, f: f }),
        items.map(function (it) {
          var on = checked.indexOf(it) !== -1;
          return React.createElement('div', { key: it, style: { display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 } },
            React.createElement(window.Check, {
              on: on, onChange: disabled ? function () {} : function () {
                onChange(on ? checked.filter(function (x) { return x !== it; }) : checked.concat([it]));
              },
            }),
            React.createElement('span', { style: { fontSize: 13.5, color: P.ink } }, it));
        }),
        React.createElement(ErrorLine, { P: P, msg: error }));
    }

    if (f.type === 'pin_required' || f.type === 'pin_stepup') {
      // No inline control — this is a submit-time gate. See FormView's PIN sheet.
      return null;
    }

    if (f.type === 'repeating_group') {
      var rows = Array.isArray(value) ? value : [];
      return React.createElement(Row, null,
        React.createElement(LabelLine, { P: P, f: f }),
        rows.map(function (row, i) {
          return React.createElement(window.Card, { key: i, density: 'compact', style: { marginBottom: 10 } },
            (f.fields || []).map(function (sub) {
              return React.createElement(FieldRow, {
                key: sub.key, f: sub, value: row[sub.key], disabled: disabled,
                error: opts.fieldErrors && opts.fieldErrors[f.key + '[' + i + '].' + sub.key],
                opts: Object.assign({}, opts, { data: row }),
                onChange: function (v) {
                  var next = rows.slice();
                  next[i] = Object.assign({}, row, { [sub.key]: v });
                  onChange(next);
                },
              });
            }),
            !disabled && React.createElement(window.PBtn, {
              variant: 'ghost', size: 'sm', icon: 'x',
              onClick: function () { onChange(rows.slice(0, i).concat(rows.slice(i + 1))); },
            }, 'Remove row'));
        }),
        !disabled && React.createElement(window.PBtn, {
          variant: 'secondary', size: 'sm', icon: 'plus',
          onClick: function () { onChange(rows.concat([{}])); },
        }, 'Add row'),
        React.createElement(ErrorLine, { P: P, msg: error }));
    }

    return null;
  }

  function SignaturePad({ P, f, value, disabled, error, onChange }) {
    var canvasRef = React.useRef(null);
    var drawing = React.useRef(false);
    React.useEffect(function () {
      var c = canvasRef.current;
      if (!c || !value) return;
      var ctx = c.getContext('2d');
      var img = new Image();
      img.onload = function () { ctx.drawImage(img, 0, 0); };
      img.src = value;
    }, []);
    function pos(e) {
      var c = canvasRef.current;
      var r = c.getBoundingClientRect();
      var t = e.touches && e.touches[0];
      return { x: (t ? t.clientX : e.clientX) - r.left, y: (t ? t.clientY : e.clientY) - r.top };
    }
    function start(e) { if (disabled) return; drawing.current = true; var p = pos(e); var ctx = canvasRef.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
    function move(e) {
      if (!drawing.current || disabled) return;
      var p = pos(e); var ctx = canvasRef.current.getContext('2d');
      ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = P.ink;
      ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    function end() {
      if (!drawing.current) return;
      drawing.current = false;
      onChange(canvasRef.current.toDataURL('image/png'));
    }
    function clear() {
      var c = canvasRef.current; var ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      onChange(null);
    }
    return React.createElement(Row, null,
      React.createElement(LabelLine, { P: P, f: f }),
      React.createElement('canvas', {
        ref: canvasRef, width: 340, height: 120,
        style: { border: '1px solid ' + P.fieldBorder, borderRadius: P.r8, touchAction: 'none', background: '#fff' },
        onMouseDown: start, onMouseMove: move, onMouseUp: end, onMouseLeave: end,
        onTouchStart: start, onTouchMove: move, onTouchEnd: end,
      }),
      !disabled && React.createElement(window.PBtn, { variant: 'ghost', size: 'sm', onClick: clear, style: { marginTop: 6 } }, 'Clear'),
      React.createElement(ErrorLine, { P: P, msg: error }));
  }

  /** Attribution / footer used in print mode and appended under review mode. */
  function AttributionFooter({ P, definition, data }) {
    var attr = definition.attribution || {};
    if (!attr.filledBy && !attr.reviewedBy && !attr.stationSignIn) return null;
    return React.createElement('div', { className: 'hdform-print-footer', style: { marginTop: 28, paddingTop: 14, borderTop: '1px solid ' + P.hairline2, fontSize: 12, color: P.inkDim, display: 'flex', gap: 32 } },
      attr.filledBy && React.createElement('div', null, 'Submitted by: ' + (data && data._submittedByName || '_______________________')),
      attr.reviewedBy && React.createElement('div', null, 'Reviewed by: ' + (data && data._reviewedByName || '_______________________')),
      attr.stationSignIn && React.createElement('div', null, 'Station: ' + (data && data._station || '_______________________')));
  }

  function PinSheet({ open, onCancel, onConfirm }) {
    var P = useP();
    var _s = React.useState(''), pin = _s[0], setPin = _s[1];
    return React.createElement(window.Sheet, { open: open, onClose: onCancel, side: 'bottom', width: 360 },
      React.createElement('div', { style: { padding: 20 } },
        React.createElement('div', { style: { fontWeight: 700, fontSize: 15, marginBottom: 10, color: P.ink } }, 'Enter PIN to submit'),
        React.createElement(window.Field, { value: pin, onChange: function (e) { setPin(e.target.value.replace(/\D/g, '')); }, size: 'lg', inputMode: 'numeric', placeholder: 'PIN' }),
        React.createElement('div', { style: { display: 'flex', gap: 10, marginTop: 14 } },
          React.createElement(window.PBtn, { variant: 'secondary', onClick: onCancel }, 'Cancel'),
          React.createElement(window.PBtn, { variant: 'primary', disabled: pin.length < 4, onClick: function () { onConfirm(pin); setPin(''); } }, 'Confirm'))));
  }

  function UnavailableState({ P, reason }) {
    return React.createElement('div', { style: { padding: 40, textAlign: 'center', color: P.inkMute } },
      React.createElement('div', { style: { fontSize: 14, fontWeight: 600, marginBottom: 6 } }, 'Forms not available on this server yet'),
      reason ? React.createElement('div', { style: { fontSize: 12.5 } }, reason) : null);
  }

  function FormView(opts) {
    var P = useP();
    var definition = opts.definition;
    var mode = opts.mode || 'fill';
    var compiled = React.useMemo(function () { return compile(definition); }, [definition]);
    var initial = React.useMemo(function () {
      return opts.initial || (mode === 'fill' ? loadDraft(definition) : null) || {};
    }, [definition]);
    var _d = React.useState(initial), data = _d[0], setData = _d[1];
    var _e = React.useState({}), fieldErrors = _e[0], setFieldErrors = _e[1];
    var _pin = React.useState(false), pinOpen = _pin[0], setPinOpen = _pin[1];
    var _busy = React.useState(false), busy = _busy[0], setBusy = _busy[1];

    React.useEffect(function () {
      if (mode === 'fill') saveDraft(definition, data);
    }, [data, mode]);

    function setField(key, v) {
      setData(function (prev) { return Object.assign({}, prev, { [key]: v }); });
    }

    function needsPin() {
      return compiled.fields.some(function (f) {
        return (f.type === 'pin_required' || f.type === 'pin_stepup') && evalShowWhen(f.showWhen, data);
      });
    }

    function doSubmit(pin) {
      var res = validate(definition, data);
      setFieldErrors(res.fieldErrors);
      if (!res.ok) { window.hdToast && window.hdToast({ title: 'Fix the highlighted fields', tone: 'warn' }); return; }
      var payload = pin ? Object.assign({}, data, { _pin: pin }) : data;
      var run = opts.onSubmit ? opts.onSubmit({ data: payload, station_id: opts.station }) : defaultSubmit(definition, payload, opts.station);
      setBusy(true);
      Promise.resolve(run).then(function (result) {
        setBusy(false);
        var ok = result === true || (result && result.ok);
        if (ok) {
          clearDraft(definition);
          window.hdToast && window.hdToast({ title: 'Submitted', tone: 'ok' });
        } else {
          var details = result && result.body && result.body.error && result.body.error.details && result.body.error.details.fields;
          if (details) setFieldErrors(details);
          window.hdToast && window.hdToast({ title: (result && result.body && result.body.error && result.body.error.message) || 'Submit failed', tone: 'blocked' });
        }
      }, function () { setBusy(false); window.hdToast && window.hdToast({ title: 'Submit failed', tone: 'blocked' }); });
    }

    function onSubmitClick() {
      var res = validate(definition, data);
      setFieldErrors(res.fieldErrors);
      if (!res.ok) { window.hdToast && window.hdToast({ title: 'Fix the highlighted fields', tone: 'warn' }); return; }
      if (needsPin()) { setPinOpen(true); return; }
      doSubmit(null);
    }

    var disabled = mode === 'review' || mode === 'print';
    var fieldOpts = Object.assign({}, opts, { data: data, fieldErrors: fieldErrors });

    if (mode === 'print') {
      var printFields = compiled.fields.filter(function (f) {
        var order = definition.print && definition.print.sections;
        return !order || !f.sectionId || order.indexOf(f.sectionId) !== -1;
      });
      return React.createElement('div', { className: 'hdform-print hdform-sheet' },
        React.createElement('style', null,
          '@media print { .hdform-no-print { display:none !important; } body { background:#fff; } }' +
          ' .hdform-sheet { font-family: inherit; max-width: 720px; margin: 0 auto; padding: 24px; }'),
        React.createElement('h2', null, definition.title || definition.id),
        printFields.map(function (f) {
          return React.createElement(FieldRow, { key: f.key || f.sectionId, f: f, value: data[f.key], error: null, disabled: true, opts: fieldOpts, onChange: function () {} });
        }),
        React.createElement(AttributionFooter, { P: P, definition: definition, data: data }));
    }

    return React.createElement('div', { className: 'hdform-fill' },
      compiled.fields.map(function (f) {
        return React.createElement(FieldRow, {
          key: f.key || f.sectionId, f: f, value: data[f.key], error: fieldErrors[f.key], disabled: disabled,
          opts: fieldOpts, onChange: function (v) { setField(f.key, v); },
        });
      }),
      mode === 'fill' && React.createElement('div', { className: 'hdform-no-print', style: { marginTop: 20 } },
        React.createElement(window.PBtn, { variant: 'primary', size: 'lg', busy: busy, onClick: onSubmitClick }, 'Submit')),
      React.createElement(PinSheet, { open: pinOpen, onCancel: function () { setPinOpen(false); }, onConfirm: function (pin) { setPinOpen(false); doSubmit(pin); } }));
  }

  function FormRoot(opts) {
    var P = useP();
    var _def = React.useState(opts.definition || null), definition = _def[0], setDefinition = _def[1];
    var _st = React.useState(opts.definition ? 'ready' : 'loading'), status = _st[0], setStatus = _st[1];
    var _reason = React.useState(''), reason = _reason[0], setReason = _reason[1];

    React.useEffect(function () {
      if (opts.definition || !opts.slug) return;
      fetch('/api/forms/' + encodeURIComponent(opts.slug)).then(function (r) {
        if (r.status === 404 || r.status === 501) { setStatus('unavailable'); return null; }
        if (!r.ok) { setStatus('unavailable'); setReason('HTTP ' + r.status); return null; }
        return r.json();
      }).then(function (body) {
        if (!body) return;
        setDefinition(body.definition || body);
        setStatus('ready');
      }).catch(function () { setStatus('unavailable'); setReason('network error'); });
    }, [opts.slug]);

    if (status === 'loading') return React.createElement('div', { style: { padding: 40, color: P.inkMute } }, 'Loading form…');
    if (status === 'unavailable' || !definition) return React.createElement(UnavailableState, { P: P, reason: reason });
    return React.createElement(FormView, Object.assign({}, opts, { definition: definition }));
  }

  function render(el, opts) {
    opts = opts || {};
    if (!window.React || !window.ReactDOM) { console.error('HDForm.render: React/ReactDOM must be loaded first'); return null; }
    var root = window.ReactDOM.createRoot(el);
    root.render(React.createElement(FormRoot, opts));
    return root;
  }

  window.HDForm = {
    render: render,
    validate: validate,
    compile: compile,
    // exposed for forms-app/app.jsx and tests — not part of the "public three"
    // but useful without re-deriving them.
    evalShowWhen: evalShowWhen,
    computeValue: computeValue,
    dollarsToCents: dollarsToCents,
    centsToDollarsStr: centsToDollarsStr,
  };
})();
