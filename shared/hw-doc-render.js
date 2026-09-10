// ── Engage document renderer — JS twin (`window.HW_DOC`) ────────────────
//
// One rule set, two implementations: this file and
// wm-demo/wmdemo/engage/documents.py. One fixture:
// wm-demo/qa/fixtures/engage/doc-cases.json, run against both by
// wm-demo/qa/engage_documents_probe.py (Python) and
// test/hw-doc-render.test.mjs (this file, under Node) — the same "one
// fixture, two engines" pattern as shared/hw-naming.js +
// wm-demo/wmdemo/shell_naming.py. See
// wm-demo/../POS-Admin/docs/ENGAGE-BUILD-CONTRACT.md §2 "engage/documents.py"
// (binding signatures) and docs/ENGAGE-PLAN-2026-09-10.md §2 "One block
// builder" for the spec this file implements.
//
// Plain JS, no dependencies. IIFE: leaks exactly one global, window.HW_DOC.
// Also usable from Node (module.exports) for the test, same convention as
// shared/hw-naming.js — the `var window` hoists before this line ever runs.
var window = window || globalThis;
;(function () {
  var W = window;

  // ── §2 the twelve block types, exact order/spelling per the contract ──
  var BLOCK_TYPES = [
    'heading', 'text', 'image', 'button', 'divider', 'spacer', 'columns',
    'product_card', 'reward_card', 'points_balance', 'legal_footer', 'gate',
  ];
  var BLOCK_TYPE_SET = {};
  for (var _bt = 0; _bt < BLOCK_TYPES.length; _bt++) { BLOCK_TYPE_SET[BLOCK_TYPES[_bt]] = 1; }

  var ALLOWED_MERGE_TAGS = ['first_name', 'points_balance', 'reward_name', 'store_name', 'link'];
  var ALLOWED_MERGE_TAG_SET = {};
  for (var _mt = 0; _mt < ALLOWED_MERGE_TAGS.length; _mt++) { ALLOWED_MERGE_TAG_SET[ALLOWED_MERGE_TAGS[_mt]] = 1; }

  var MAX_NESTING = 2;
  var MAX_BLOCKS = 60;

  var REQUIRED_PROPS = {
    heading: ['text'], text: ['text'], image: ['src', 'alt'], button: ['label', 'href'],
    divider: [], spacer: [], columns: [],
    product_card: ['name', 'price'], reward_card: ['reward_name', 'cost_points'],
    points_balance: [], legal_footer: [], gate: [],
  };

  var URL_PROPS = {
    image: { src: 'image', link: 'link' },
    button: { href: 'link' },
    product_card: { image: 'image', link: 'link' },
  };

  var NESTABLE_TYPES = {};
  for (var _nt = 0; _nt < BLOCK_TYPES.length; _nt++) {
    var _t = BLOCK_TYPES[_nt];
    if (_t !== 'gate' && _t !== 'legal_footer') { NESTABLE_TYPES[_t] = 1; }
  }

  // The estate's own short-link host(s) — see documents.py's own comment.
  var SHORT_LINK_HOSTS = ['hyperwolf.com'];

  var THEME_DEFAULTS = {
    bg: '#ffffff', text: '#1a1a1a', muted: '#6b7280', accent: '#2563eb',
    font: 'Arial, Helvetica, sans-serif', radius: '6px', max_width: '600px',
  };
  var HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
  var FONT_RE = /^[A-Za-z0-9,\-\s]{1,120}$/;
  var PX_RE = /^\d{1,4}px$/;

  var MERGE_TAG_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  var MERGE_TAG_FULL_RE = /^\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}$/;

  // ── EngageError-compatible error, same shape as engage/errors.py's
  // EngageError(msg, code) so a future shared error layer can swap in. ──
  function EngageError(msg, code) {
    var e = new Error(msg);
    e.name = 'EngageError';
    e.code = code || null;
    return e;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function dedupe(arr) {
    var seen = {}, out = [];
    for (var i = 0; i < arr.length; i++) {
      if (!seen[arr[i]]) { seen[arr[i]] = 1; out.push(arr[i]); }
    }
    return out;
  }

  function theme(doc) {
    var t = {};
    for (var k in THEME_DEFAULTS) { if (THEME_DEFAULTS.hasOwnProperty(k)) { t[k] = THEME_DEFAULTS[k]; } }
    var given = (doc && typeof doc.theme === 'object' && doc.theme) ? doc.theme : null;
    if (given) {
      ['bg', 'text', 'muted', 'accent'].forEach(function (k) {
        var v = given[k];
        if (typeof v === 'string' && HEX_RE.test(v.trim())) { t[k] = v.trim(); }
      });
      if (typeof given.font === 'string' && FONT_RE.test(given.font.trim())) { t.font = given.font.trim(); }
      if (typeof given.radius === 'string' && PX_RE.test(given.radius.trim())) { t.radius = given.radius.trim(); }
      if (typeof given.max_width === 'string' && PX_RE.test(given.max_width.trim())) { t.max_width = given.max_width.trim(); }
    }
    return t;
  }

  function hostOf(url) {
    var m = /^https:\/\/([^/]+)/i.exec(url);
    return m ? m[1].toLowerCase() : '';
  }
  function hostAllowed(host) {
    host = (host || '').split(':')[0];
    if (!host) { return false; }
    for (var i = 0; i < SHORT_LINK_HOSTS.length; i++) {
      var allowed = SHORT_LINK_HOSTS[i];
      if (host === allowed || host.slice(-(allowed.length + 1)) === '.' + allowed) { return true; }
    }
    return false;
  }
  function safeUrl(raw, kind) {
    if (raw === null || raw === undefined) { return false; }
    var s = String(raw).trim(), low = s.toLowerCase();
    if (low.indexOf('javascript:') === 0 || low.indexOf('data:') === 0 || low.indexOf('vbscript:') === 0) { return false; }
    if (low.indexOf('https://') !== 0) { return false; }
    if (kind === 'image') { return true; }
    return hostAllowed(hostOf(s));
  }
  function safeUrlStatic(raw, kind) {
    if (raw === null || raw === undefined) { return false; }
    var s = String(raw).trim();
    var m = MERGE_TAG_FULL_RE.exec(s);
    if (m) { return !!ALLOWED_MERGE_TAG_SET[m[1]]; }
    return safeUrl(s, kind);
  }

  // ── merge tags ──────────────────────────────────────────────────────
  function mergeTags(doc) {
    if (!doc || typeof doc !== 'object') { return []; }
    var found = {};
    function walk(blocks) {
      if (!blocks) { return; }
      for (var i = 0; i < blocks.length; i++) {
        var b = blocks[i];
        if (!b || typeof b !== 'object') { continue; }
        var props = b.props;
        if (props && typeof props === 'object') {
          for (var k in props) {
            if (!props.hasOwnProperty(k)) { continue; }
            var v = props[k];
            if (typeof v === 'string') {
              var re = new RegExp(MERGE_TAG_RE.source, 'g'), m;
              while ((m = re.exec(v))) { found[m[1]] = 1; }
            }
          }
        }
        walk(b.children);
      }
    }
    walk(doc.blocks);
    return Object.keys(found).sort();
  }

  function rawSub(text, ctx) {
    if (text === null || text === undefined) { return ''; }
    var s = String(text);
    var re = new RegExp(MERGE_TAG_RE.source, 'g');
    return s.replace(re, function (whole, tag) {
      if (!(tag in ctx) || ctx[tag] === null || ctx[tag] === undefined) {
        throw EngageError('unresolved merge tag {{' + tag + '}}', 'merge_tag_missing');
      }
      return String(ctx[tag]);
    });
  }

  function sub(text, ctx) {
    if (text === null || text === undefined) { return ''; }
    var escaped = escapeHtml(String(text));
    var re = new RegExp(MERGE_TAG_RE.source, 'g');
    return escaped.replace(re, function (whole, tag) {
      if (!(tag in ctx) || ctx[tag] === null || ctx[tag] === undefined) {
        throw EngageError('unresolved merge tag {{' + tag + '}}', 'merge_tag_missing');
      }
      return escapeHtml(String(ctx[tag]));
    });
  }

  function subUrl(text, ctx, kind) {
    var raw = rawSub(text || '', ctx);
    if (!safeUrl(raw, kind)) { throw EngageError('unsafe url: ' + JSON.stringify(raw), 'unsafe_url'); }
    return escapeHtml(raw);
  }

  // ── validate_doc ────────────────────────────────────────────────────
  function validateBlock(block, depth, seenIds) {
    if (!block || typeof block !== 'object') { return ['invalid_block']; }
    var btype = block.type;
    if (!BLOCK_TYPE_SET[btype]) { return ['unknown_block_type']; }
    var codes = [];
    var bid = block.id;
    if (typeof bid !== 'string' || !bid || seenIds[bid]) {
      codes.push('invalid_block_id');
    } else {
      seenIds[bid] = 1;
    }
    var props = (block.props && typeof block.props === 'object') ? block.props : {};
    var req = REQUIRED_PROPS[btype] || [];
    for (var i = 0; i < req.length; i++) {
      var val = props[req[i]];
      if (val === undefined || val === null || val === '') { codes.push('missing_required_prop'); }
    }
    var urlProps = URL_PROPS[btype] || {};
    for (var propName in urlProps) {
      if (!urlProps.hasOwnProperty(propName)) { continue; }
      var v2 = props[propName];
      if (v2) {
        if (!safeUrlStatic(v2, urlProps[propName])) { codes.push('unsafe_url'); }
      }
    }
    var children = block.children;
    if (children && children.length) {
      if (btype !== 'columns') {
        codes.push('children_not_allowed');
      } else if (depth >= MAX_NESTING) {
        codes.push('max_nesting_exceeded');
      } else if (!Array.isArray(children)) {
        codes.push('invalid_children');
      } else {
        for (var c = 0; c < children.length; c++) {
          var child = children[c];
          if (child && typeof child === 'object' && !NESTABLE_TYPES[child.type]) {
            codes.push('children_not_allowed');
            continue;
          }
          codes = codes.concat(validateBlock(child, depth + 1, seenIds));
        }
      }
    }
    return codes;
  }

  function validateDoc(doc) {
    if (!doc || typeof doc !== 'object') { return ['invalid_doc']; }
    var codes = [];
    if (['email', 'landing', 'section'].indexOf(doc.kind) === -1) { codes.push('invalid_kind'); }
    var blocks = doc.blocks;
    if (!Array.isArray(blocks)) { codes.push('invalid_blocks'); blocks = []; }
    if (blocks.length > MAX_BLOCKS) { codes.push('max_blocks_exceeded'); }
    var seenIds = {};
    for (var i = 0; i < blocks.length; i++) { codes = codes.concat(validateBlock(blocks[i], 1, seenIds)); }
    var tags = mergeTags(doc), t;
    for (t = 0; t < tags.length; t++) {
      if (!ALLOWED_MERGE_TAG_SET[tags[t]]) { codes.push('unknown_merge_tag'); }
    }
    var required = doc.merge_tags_required || [];
    for (t = 0; t < required.length; t++) {
      if (!ALLOWED_MERGE_TAG_SET[required[t]]) { codes.push('unknown_merge_tag'); }
    }
    return dedupe(codes);
  }

  // ── per-block-type HTML renderers ──────────────────────────────────
  function rHeading(props, ctx, th) {
    var level = parseInt(props.level, 10);
    if (isNaN(level)) { level = 2; }
    level = Math.min(Math.max(level, 1), 3);
    var size = { 1: '28px', 2: '22px', 3: '18px' }[level];
    var align = props.align;
    if (['left', 'center', 'right'].indexOf(align) === -1) { align = 'left'; }
    var text = sub(props.text || '', ctx);
    return '<div style="font-family:' + th.font + ';font-size:' + size + ';font-weight:700;color:' + th.text +
      ';text-align:' + align + ';margin:0 0 12px;">' + text + '</div>';
  }

  function rText(props, ctx, th) {
    var align = props.align;
    if (['left', 'center', 'right'].indexOf(align) === -1) { align = 'left'; }
    var text = sub(props.text || '', ctx).replace(/\n/g, '<br>');
    return '<div style="font-family:' + th.font + ';font-size:14px;line-height:1.5;color:' + th.text +
      ';text-align:' + align + ';margin:0 0 12px;">' + text + '</div>';
  }

  function rImage(props, ctx, th) {
    var src = subUrl(props.src || '', ctx, 'image');
    var alt = sub(props.alt || '', ctx);
    var widthAttr = '';
    var width = props.width;
    if (typeof width === 'number' || (typeof width === 'string' && /^\d+$/.test(width.trim()))) {
      widthAttr = ' width="' + parseInt(width, 10) + '"';
    }
    var img = '<img src="' + src + '" alt="' + alt + '"' + widthAttr + ' style="max-width:100%;display:block;border:0;">';
    if (props.link) {
      var href = subUrl(props.link, ctx, 'link');
      img = '<a href="' + href + '">' + img + '</a>';
    }
    return '<div style="margin:0 0 12px;">' + img + '</div>';
  }

  function rButton(props, ctx, th) {
    var label = sub(props.label || '', ctx);
    var href = subUrl(props.href || '', ctx, 'link');
    return '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
      '<td style="border-radius:' + th.radius + ';background:' + th.accent + ';">' +
      '<a href="' + href + '" style="display:inline-block;padding:10px 20px;color:#ffffff;' +
      'text-decoration:none;font-family:' + th.font + ';font-size:14px;font-weight:600;">' + label + '</a>' +
      '</td></tr></table>';
  }

  function rDivider() {
    return '<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">';
  }

  function rSpacer(props) {
    var h = parseInt(props.height, 10);
    if (isNaN(h)) { h = 16; }
    h = Math.max(0, Math.min(h, 200));
    return '<div style="height:' + h + 'px;line-height:' + h + 'px;font-size:0;">&nbsp;</div>';
  }

  function rProductCard(props, ctx, th) {
    var name = sub(props.name || '', ctx);
    var price = sub(String(props.price === undefined ? '' : props.price), ctx);
    var imgHtml = '';
    if (props.image) {
      var src = subUrl(props.image, ctx, 'image');
      imgHtml = '<img src="' + src + '" alt="' + name + '" style="max-width:100%;display:block;border:0;margin:0 0 8px;">';
    }
    var body = imgHtml + '<div style="font-family:' + th.font + ';font-weight:600;color:' + th.text + ';">' + name + '</div>' +
      '<div style="color:' + th.muted + ';">' + price + '</div>';
    if (props.link) {
      var href = subUrl(props.link, ctx, 'link');
      body = '<a href="' + href + '" style="text-decoration:none;color:inherit;">' + body + '</a>';
    }
    return '<div style="border:1px solid #e5e7eb;border-radius:' + th.radius + ';padding:12px;margin:0 0 12px;">' + body + '</div>';
  }

  function rRewardCard(props, ctx, th) {
    var rewardName = sub(props.reward_name || '', ctx);
    var cost = sub(String(props.cost_points === undefined ? '' : props.cost_points), ctx);
    var descHtml = '';
    if (props.description) {
      descHtml = '<div style="color:' + th.muted + ';font-size:13px;margin-top:4px;">' + sub(props.description, ctx) + '</div>';
    }
    return '<div style="border:1px solid ' + th.accent + ';border-radius:' + th.radius + ';padding:12px;margin:0 0 12px;">' +
      '<div style="font-family:' + th.font + ';font-weight:600;color:' + th.text + ';">' + rewardName + '</div>' +
      '<div style="color:' + th.muted + ';">' + cost + ' pts</div>' + descHtml + '</div>';
  }

  function rPointsBalance(props, ctx, th) {
    var template = props.template || 'You have {{points_balance}} points';
    var text = sub(template, ctx);
    return '<div style="font-family:' + th.font + ';font-size:16px;font-weight:600;color:' + th.text +
      ';text-align:center;margin:0 0 12px;">' + text + '</div>';
  }

  function rGate(props, ctx, th) {
    var minAge = parseInt(props.min_age, 10);
    if (isNaN(minAge)) { minAge = 21; }
    var template = props.message || ('By continuing you confirm you are ' + minAge +
      ' years of age or older and a resident of a state where this offer is legal.');
    var text = sub(template, ctx);
    return '<div style="font-family:' + th.font + ';font-size:12px;color:' + th.muted + ';text-align:center;' +
      'margin:0 0 12px;padding:8px;border:1px solid #e5e7eb;border-radius:' + th.radius + ';">' + text + '</div>';
  }

  function rLegalFooter(props, ctx, th) {
    var storeName = ctx.store_name || 'us';
    var stopText = escapeHtml(ctx.stop_text || 'Reply STOP to unsubscribe, HELP for help.');
    var consentText = escapeHtml(ctx.consent_text ||
      ('You are receiving this because you opted in to messages from ' + storeName + '.'));
    var unsubHtml = '';
    if (ctx.unsubscribe_url) {
      var href = subUrl(ctx.unsubscribe_url, ctx, 'link');
      unsubHtml = ' <a href="' + href + '" style="color:' + th.muted + ';">Unsubscribe</a>';
    }
    return '<div style="font-family:' + th.font + ';font-size:11px;color:' + th.muted + ';text-align:center;' +
      'margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb;">' + stopText + ' ' + consentText + unsubHtml + '</div>';
  }

  function rColumns(block, ctx, mode, th) {
    var children = block.children || [];
    var groups = {}, order = [];
    for (var i = 0; i < children.length; i++) {
      var child = children[i], idx = 0;
      if (child && typeof child === 'object') {
        idx = (child.props && child.props.column !== undefined) ? parseInt(child.props.column, 10) : 0;
        if (isNaN(idx)) { idx = 0; }
      }
      if (!groups.hasOwnProperty(idx)) { groups[idx] = []; order.push(idx); }
      groups[idx].push(child);
    }
    order.sort(function (a, b) { return a - b; });
    if (!order.length) { return ''; }
    if (mode === 'email') {
      var widthPct = Math.max(1, Math.floor(100 / order.length));
      var cells = [];
      for (var o = 0; o < order.length; o++) {
        var inner = groups[order[o]].map(function (c) { return renderInner(c, ctx, mode, th); }).join('');
        cells.push('<td valign="top" style="padding:8px;width:' + widthPct + '%;">' + inner + '</td>');
      }
      return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' + cells.join('') + '</tr></table>';
    }
    var divs = [];
    for (var o2 = 0; o2 < order.length; o2++) {
      var inner2 = groups[order[o2]].map(function (c) { return renderInner(c, ctx, mode, th); }).join('');
      divs.push('<div class="hw-col">' + inner2 + '</div>');
    }
    return '<div class="hw-columns">' + divs.join('') + '</div>';
  }

  function renderInner(block, ctx, mode, th) {
    var btype = block.type;
    var props = block.props || {};
    switch (btype) {
      case 'heading': return rHeading(props, ctx, th);
      case 'text': return rText(props, ctx, th);
      case 'image': return rImage(props, ctx, th);
      case 'button': return rButton(props, ctx, th);
      case 'divider': return rDivider();
      case 'spacer': return rSpacer(props);
      case 'columns': return rColumns(block, ctx, mode, th);
      case 'product_card': return rProductCard(props, ctx, th);
      case 'reward_card': return rRewardCard(props, ctx, th);
      case 'points_balance': return rPointsBalance(props, ctx, th);
      case 'gate': return rGate(props, ctx, th);
      case 'legal_footer': return rLegalFooter(props, ctx, th);
      default: throw EngageError('unknown block type at render time: ' + JSON.stringify(btype), 'unknown_block_type');
    }
  }

  function wrapTop(inner, mode) {
    if (mode === 'email') { return '<tr><td style="padding:8px 24px;">' + inner + '</td></tr>'; }
    return '<div style="padding:8px 24px;">' + inner + '</div>';
  }

  function documentShell(body, th, mode) {
    if (mode === 'email') {
      return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
        'style="background:' + th.bg + ';font-family:' + th.font + ';"><tr><td align="center">' +
        '<table role="presentation" width="600" cellpadding="0" cellspacing="0" ' +
        'style="max-width:' + th.max_width + ';width:100%;background:' + th.bg + ';color:' + th.text + ';">' +
        body + '</table></td></tr></table>';
    }
    var style = '<style>body{margin:0;background:' + th.bg + ';font-family:' + th.font + ';color:' + th.text + ';}' +
      '.hw-doc{max-width:' + th.max_width + ';margin:0 auto;}' +
      '.hw-columns{display:flex;flex-wrap:wrap;gap:16px;}' +
      '.hw-col{flex:1 1 200px;min-width:0;}' +
      '@media (max-width:480px){.hw-columns{flex-direction:column;}}</style>';
    return style + '<div class="hw-doc">' + body + '</div>';
  }

  // ── public entry points ────────────────────────────────────────────
  function render(doc, ctx, mode) {
    if (mode !== 'email' && mode !== 'landing') {
      throw EngageError('unknown render mode: ' + JSON.stringify(mode), 'invalid_mode');
    }
    var issues = validateDoc(doc);
    if (issues.length) {
      throw EngageError('document failed validation: ' + issues.join(','), issues[0]);
    }
    ctx = ctx || {};
    var required = doc.merge_tags_required || [];
    var missing = required.filter(function (t) { return !(t in ctx) || ctx[t] === null || ctx[t] === undefined; });
    if (missing.length) {
      throw EngageError('missing required merge tag(s): ' + missing.join(','), 'merge_tag_missing');
    }

    var th = theme(doc);
    var gateEnabled = !!ctx.gate_enabled;
    var parts = [];
    var hasFooter = false;
    var blocks = doc.blocks || [];
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      if (block.type === 'gate' && !gateEnabled) { continue; }
      if (block.type === 'legal_footer') { hasFooter = true; }
      parts.push(wrapTop(renderInner(block, ctx, mode, th), mode));
    }
    if (mode === 'landing' && !hasFooter) {
      parts.push(wrapTop(rLegalFooter({}, ctx, th), mode));
    }
    return documentShell(parts.join(''), th, mode);
  }

  function textInner(block, ctx) {
    var btype = block.type;
    var props = block.props || {};
    if (btype === 'heading' || btype === 'text') { return rawSub(props.text || '', ctx); }
    if (btype === 'button') { return rawSub(props.label || '', ctx) + ': ' + rawSub(props.href || '', ctx); }
    if (btype === 'image') { return null; }
    if (btype === 'divider') { return '---'; }
    if (btype === 'spacer') { return ''; }
    if (btype === 'columns') {
      var lines = (block.children || []).filter(function (c) { return c && typeof c === 'object'; })
        .map(function (c) { return textInner(c, ctx); }).filter(function (l) { return l; });
      return lines.join('\n');
    }
    if (btype === 'product_card') {
      return rawSub(props.name || '', ctx) + ' - ' + rawSub(String(props.price === undefined ? '' : props.price), ctx);
    }
    if (btype === 'reward_card') {
      return rawSub(props.reward_name || '', ctx) + ' (' +
        rawSub(String(props.cost_points === undefined ? '' : props.cost_points), ctx) + ' pts)';
    }
    if (btype === 'points_balance') {
      var template = props.template || 'You have {{points_balance}} points';
      return rawSub(template, ctx);
    }
    if (btype === 'gate') {
      var minAge = props.min_age === undefined ? 21 : props.min_age;
      var tmpl = props.message || ('By continuing you confirm you are ' + minAge + ' years of age or older.');
      return rawSub(tmpl, ctx);
    }
    if (btype === 'legal_footer') { return textLegalFooter(ctx); }
    return '';
  }

  function textLegalFooter(ctx) {
    var storeName = ctx.store_name || 'us';
    var stopText = ctx.stop_text || 'Reply STOP to unsubscribe, HELP for help.';
    var consentText = ctx.consent_text || ('You are receiving this because you opted in to messages from ' + storeName + '.');
    return stopText + ' ' + consentText;
  }

  function renderText(doc, ctx) {
    var issues = validateDoc(doc);
    if (issues.length) {
      throw EngageError('document failed validation: ' + issues.join(','), issues[0]);
    }
    ctx = ctx || {};
    var required = doc.merge_tags_required || [];
    var missing = required.filter(function (t) { return !(t in ctx) || ctx[t] === null || ctx[t] === undefined; });
    if (missing.length) {
      throw EngageError('missing required merge tag(s): ' + missing.join(','), 'merge_tag_missing');
    }
    var gateEnabled = !!ctx.gate_enabled;
    var lines = [];
    var hasFooter = false;
    var blocks = doc.blocks || [];
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      if (block.type === 'gate' && !gateEnabled) { continue; }
      if (block.type === 'legal_footer') { hasFooter = true; }
      var line = textInner(block, ctx);
      if (line) { lines.push(line); }
    }
    if (!hasFooter) { lines.push(textLegalFooter(ctx)); }
    return lines.filter(function (l) { return l; }).join('\n');
  }

  W.HW_DOC = {
    BLOCK_TYPES: BLOCK_TYPES,
    ALLOWED_MERGE_TAGS: ALLOWED_MERGE_TAGS,
    validateDoc: validateDoc,
    validate: validateDoc,
    render: render,
    renderText: renderText,
    mergeTags: mergeTags,
  };
})();

if (typeof module !== 'undefined') { module.exports = window.HW_DOC; }
