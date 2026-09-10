// ── Hyperwolf product naming engine — JS twin (`window.HW_NAMING`) ─────────
//
// One rule set, two implementations: this file and wm-demo/wmdemo/shell_naming.py.
// One fixture: wm-demo/qa/fixtures/shells/naming-cases.json, run against both by
// qa/shells_naming_probe.py (Python) and test/hw-naming.test.mjs (this file, under
// Node). See POS-Admin/docs/SHELLS-PLAN-2026-09-09.md §2 for the spec; every "§2"
// comment below points back at that section. Where the fixture and the plan text
// actually disagreed, the fixture won: the Pre-Rolls/Wellness template-ending
// guards were widened to match every format in formats-seed.json, and "of" stays
// lowercase inside a name while "a" is capitalised (the fixture's own two
// examples disagree with the doc's blanket "small words capitalised").
//
// Plain JS, no dependencies, loads before React (same convention as
// shared/hw-wait.js / shared/hw-z.js). IIFE: leaks exactly one global,
// window.HW_NAMING. Also usable from Node (module.exports) for the test —
// the `var window` hoists before this line ever runs, so referencing it on
// the right-hand side is never a ReferenceError even with no browser global.
var window = window || globalThis;
;(function () {
  var W = window;

  // ── §2 slots ───────────────────────────────────────────────────────────
  var SLOTS = {
    'name': 'strain / flavor / product name (required unless {name|type} falls back to {type})',
    'name|type': 'use {name} if given, else the strain {type} (Indica/Sativa/Hybrid)',
    'type': 'Indica | Sativa | Hybrid, title-cased',
    'ratio': 'optional, normalised to a:b or a:b:c with no spaces',
    'size': 'Flower only, from shell.weight: 7g->Quarter Ounce, 14g->Half Ounce, 28g->Full Ounce, 3.5g->\'\'',
    'count': 'from shell.pack (>=2 required) -> the bare number, template supplies \'-Pack\'',
    'tier': 'optional, accepts 2 / \'2\' / \'Tier 2\' / \'(Tier 2)\', renders \'(Tier N)\'',
    'infused': 'literal \'Infused\' when slots.infused is truthy, else \'\'',
    'sour': 'literal \'Sour\' when slots.sour is truthy, else \'\'',
  };
  var KNOWN_SLOTS = {};
  for (var _k in SLOTS) { if (SLOTS.hasOwnProperty(_k)) { KNOWN_SLOTS[_k] = true; } }

  var WARNING_CODES = {
    name_required: 'no usable {name}/{type} text was given',
    pack_count_required: '{count} used but shell.pack is missing or < 2',
    flower_size_unknown: '{size} used but shell.weight is not 3.5/7/14/28g',
    cannabinoid_in_name: 'THC/CBD/CBN/CBC/CBG appeared in the name text',
    weight_in_name: 'a numeric weight token appeared in the name text',
    template_unknown_slot: 'the template used a slot outside SLOTS',
    template_name_slot_missing: 'the template has neither {name} nor {name|type}',
    template_weight_token: 'the template\'s own literal text has a weight token',
    brand_in_name: 'the shell\'s brand name was found and stripped from the name text',
    format_word_in_name: 'the name text repeated the template\'s own trailing/leading format word(s)',
    trademark_stripped: 'a ™ or ® mark was removed',
    potency_word_in_name: '\'Extra Strength\' was removed',
    template_prerolls_ending: 'Pre-Rolls template must end in Pre-Roll/Infused Pre-Roll/Blunt/Infused Blunt/Hash Hole, or use {count}',
    template_edibles_ending: 'a gummy Edibles template must end in Gummies or Gummy Belts',
    template_wellness_ending: 'Wellness template must end in Tincture or a topical noun',
  };
  var REFUSAL_CODES = {
    name_required: 1, pack_count_required: 1, flower_size_unknown: 1,
    cannabinoid_in_name: 1, weight_in_name: 1,
    template_unknown_slot: 1, template_name_slot_missing: 1, template_weight_token: 1,
  };

  // ── §2 universal rules: regexes ────────────────────────────────────────
  var CANNABINOID_RE = /\b(THC|CBD|CBN|CBC|CBG)\b/i;
  var WEIGHT_UNIT_RE = /(?:^|[^A-Za-z0-9_])(\d+(?:\.\d+)?\s*(?:mg|ml|oz|grams?|g))(?![A-Za-z0-9_])/i;
  var WEIGHT_FRACTION_OZ_RE = /\b\d+\/\d+\s*oz\b/i;
  var WEIGHT_FRACTION_RE = /\b\d+\/\d+\b/;
  var TRADEMARK_RE = /[™®]/g;
  var POTENCY_RE = /\s*\bExtra\s+Strength\b\s*/gi;

  var COMPOUND_SUBS = [
    [/pre[\s-]?roll/gi, 'Pre-Roll'],
    [/all[\s-]?in[\s-]?one/gi, 'All-In-One'],
    [/roll[\s-]?on/gi, 'Roll-On'],
  ];

  var CROSS_CATEGORIES = { Flower: 1, 'Pre-Rolls': 1, Concentrates: 1, Vapes: 1 };
  var AMP_CATEGORIES = { Edibles: 1, Wellness: 1 };
  var CROSS_SEP_RE = /\s+(?:x|-|\/)\s+/i;
  var AMP_SEP_RE = /\s+(?:and|\/)\s+/i;

  var ROMAN_RE = /^(?=[MDCLXVI])M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;

  // See the file header: fixture wins over the doc's blanket claim.
  var SMALL_WORDS_LOWER = { of: 1 };

  // Strain/product abbreviations that stay ALL CAPS regardless of how an
  // operator typed them ("diamond og" -> "Diamond OG"). Checked BEFORE the
  // digit/internal-capital preservation rule below, so a lowercase-typed
  // "gg4"/"xj-13" is canonicalised too. THCa is deliberately NOT here
  // (2026-09-09 ruling): that is a cannabinoid abbreviation and belongs to
  // the refusal path (CANNABINOID_RE), not to casing.
  var ALL_CAPS_TOKENS = {
    OG: 1, GG4: 1, GMO: 1, GSC: 1, LA: 1, GDP: 1, SFV: 1, MAC: 1,
    'AK-47': 1, 'XJ-13': 1, NYC: 1, OGKB: 1, 'GG#4': 1,
  };

  // Flower size words a template's own {size} slot renders -- see
  // stripFlowerSizeDupe below. Longest phrase first.
  var FLOWER_SIZE_WORDS = ['Quarter Ounce', 'Half Ounce', 'Full Ounce', 'Ounce'];

  function collapseWs(s) { return String(s).replace(/\s+/g, ' ').trim(); }

  function hasWeightToken(s) {
    return WEIGHT_UNIT_RE.test(s) || WEIGHT_FRACTION_OZ_RE.test(s) || WEIGHT_FRACTION_RE.test(s);
  }
  function hasCannabinoid(s) { return CANNABINOID_RE.test(s); }

  function stripTrademark(s) {
    if (TRADEMARK_RE.test(s)) { return [collapseWs(s.replace(TRADEMARK_RE, '')), true]; }
    return [s, false];
  }
  function stripPotency(s) {
    if (POTENCY_RE.test(s)) { return [collapseWs(s.replace(POTENCY_RE, ' ')), true]; }
    return [s, false];
  }

  // §2 'brand name inside the name stripped with a warning' — full phrase
  // first, then (multi-word brand whose first word is ALL-CAPS, e.g. CAKE)
  // that first word alone.
  function stripBrand(s, brandName) {
    if (!brandName) { return [s, false]; }
    brandName = String(brandName).trim();
    if (!brandName) { return [s, false]; }
    var words = brandName.split(/\s+/);
    var candidates = [brandName];
    if (words.length > 1 && words[0] === words[0].toUpperCase() && /[A-Za-z]/.test(words[0])) {
      candidates.push(words[0]);
    }
    for (var i = 0; i < candidates.length; i++) {
      var cand = candidates[i];
      var re = new RegExp('(?:^|[^A-Za-z0-9_])(' + cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![A-Za-z0-9_])', 'i');
      if (re.test(s)) {
        var out = s.replace(re, function (whole, grp, offset) {
          // keep whatever non-word char preceded the match (space etc.), drop the brand word itself
          var pre = whole.slice(0, whole.length - grp.length);
          return pre;
        });
        return [collapseWs(out), true];
      }
    }
    return [s, false];
  }

  // §2 'Title Case with small words capitalised inside names'; preserve
  // tokens with an internal capital or a digit; roman numerals uppercased
  // even from lowercase input; hyphenated format words normalised first.
  function titleCase(s) {
    if (s === null || s === undefined) { return ''; }
    s = collapseWs(String(s));
    if (!s) { return ''; }
    for (var i = 0; i < COMPOUND_SUBS.length; i++) {
      s = s.replace(COMPOUND_SUBS[i][0], COMPOUND_SUBS[i][1]);
    }
    var tokens = s.split(' ');
    var out = [];
    for (var t = 0; t < tokens.length; t++) {
      var token = tokens[t];
      if (!token) { continue; }
      if (ALL_CAPS_TOKENS[token.toUpperCase()]) {
        out.push(token.toUpperCase());
      } else if (ROMAN_RE.test(token)) {
        out.push(token.toUpperCase());
      } else if (/[0-9]/.test(token)) {
        out.push(token);
      } else if (/[A-Z]/.test(token.slice(1))) {
        out.push(token);
      } else if (SMALL_WORDS_LOWER[token.toLowerCase()]) {
        out.push(token.toLowerCase());
      } else {
        out.push(token.charAt(0).toUpperCase() + token.slice(1).toLowerCase());
      }
    }
    return out.join(' ');
  }

  // §2: strip/collapse whitespace, refuse on a weight token or cannabinoid
  // abbreviation, strip ™/®, strip 'Extra Strength', strip the
  // brand name — everything category-independent. Cross/'&' handling needs
  // the category, so derive() does that around this call.
  function normaliseName(s, brandName) {
    var warnings = [];
    var text = collapseWs(s || '');
    if (!text) { return ['', ['name_required']]; }
    if (hasWeightToken(text)) { return ['', ['weight_in_name']]; }
    if (hasCannabinoid(text)) { return ['', ['cannabinoid_in_name']]; }
    var r;
    r = stripTrademark(text); text = r[0]; if (r[1]) { warnings.push('trademark_stripped'); }
    r = stripPotency(text); text = r[0]; if (r[1]) { warnings.push('potency_word_in_name'); }
    r = stripBrand(text, brandName); text = r[0]; if (r[1]) { warnings.push('brand_in_name'); }
    if (!text) { return ['', warnings.concat(['name_required'])]; }
    return [titleCase(text), warnings];
  }

  function hasRefusal(warnings) {
    for (var i = 0; i < warnings.length; i++) { if (REFUSAL_CODES[warnings[i]]) { return true; } }
    return false;
  }

  function splitJoin(category, brandName, raw) {
    var sides = null, joiner = null, m;
    if (CROSS_CATEGORIES[category]) {
      m = CROSS_SEP_RE.exec(raw);
      if (m) {
        var left = raw.slice(0, m.index), right = raw.slice(m.index + m[0].length);
        if (left.trim() && right.trim() && /[A-Za-z]/.test(left) && /[A-Za-z]/.test(right)) {
          sides = [left, right]; joiner = ' x ';
        }
      }
    } else if (AMP_CATEGORIES[category]) {
      m = AMP_SEP_RE.exec(raw);
      if (m) {
        var left2 = raw.slice(0, m.index), right2 = raw.slice(m.index + m[0].length);
        if (left2.trim() && right2.trim() && /[A-Za-z]/.test(left2) && /[A-Za-z]/.test(right2)) {
          sides = [left2, right2]; joiner = ' & ';
        }
      }
    }
    if (!sides) {
      var r = normaliseName(raw, brandName);
      return [r[0], r[1], hasRefusal(r[1])];
    }
    var l = normaliseName(sides[0], brandName);
    var rr = normaliseName(sides[1], brandName);
    var warnings = l[1].concat(rr[1]);
    if (hasRefusal(warnings)) { return ['', warnings, true]; }
    return [l[0] + joiner + rr[0], warnings, false];
  }

  function tierText(tier) {
    if (tier === null || tier === undefined || tier === '') { return ''; }
    var m = /\d+/.exec(String(tier));
    if (!m) { return ''; }
    return '(Tier ' + m[0] + ')';
  }

  function ratioText(ratio) {
    if (ratio === null || ratio === undefined) { return ''; }
    var s = String(ratio).trim();
    if (!s) { return ''; }
    return s.replace(/\s*:\s*/g, ':');
  }

  var FLOWER_SIZE_MAP = [[3.5, ''], [7, 'Quarter Ounce'], [14, 'Half Ounce'], [28, 'Full Ounce']];

  function sizeText(weight) {
    var w = Number(weight);
    if (!isFinite(w)) { return null; }
    for (var i = 0; i < FLOWER_SIZE_MAP.length; i++) {
      if (Math.abs(FLOWER_SIZE_MAP[i][0] - w) < 1e-9) { return FLOWER_SIZE_MAP[i][1]; }
    }
    return null;
  }

  // Split into [{kind:'literal',val:text}] / [{kind:'slot',val:name}], in order.
  function tokenizeTemplate(template) {
    var pieces = template.split(/(\{[^{}]*\})/);
    var tokens = [];
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      if (p === '') { continue; }
      if (p.charAt(0) === '{' && p.charAt(p.length - 1) === '}') {
        tokens.push({ kind: 'slot', val: p.slice(1, -1) });
      } else {
        tokens.push({ kind: 'literal', val: p });
      }
    }
    return tokens;
  }

  function templateIssues(tokens, template) {
    var issues = [];
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i].kind === 'slot' && !KNOWN_SLOTS[tokens[i].val]) { issues.push('template_unknown_slot'); }
    }
    var hasName = false;
    for (i = 0; i < tokens.length; i++) {
      if (tokens[i].kind === 'slot' && (tokens[i].val === 'name' || tokens[i].val === 'name|type')) { hasName = true; }
    }
    if (!hasName) { issues.push('template_name_slot_missing'); }
    var literalText = '';
    for (i = 0; i < tokens.length; i++) { if (tokens[i].kind === 'literal') { literalText += tokens[i].val; } }
    if (hasWeightToken(literalText)) { issues.push('template_weight_token'); }
    return issues;
  }

  function nameSlotIndex(tokens) {
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i].kind === 'slot' && (tokens[i].val === 'name' || tokens[i].val === 'name|type')) { return i; }
    }
    return -1;
  }

  function leadingTrailingLiteral(tokens, idx) {
    var leading = '';
    if (idx > 0 && tokens[idx - 1].kind === 'literal') { leading = tokens[idx - 1].val.trim(); }
    var trailing = '';
    for (var i = idx + 1; i < tokens.length; i++) { if (tokens[i].kind === 'literal') { trailing += tokens[i].val; } }
    return [leading, collapseWs(trailing)];
  }

  // §2 'if the slot text ends with the template's own format words, strip
  // them with warning format_word_in_name' — extended to a duplicated LEADING
  // word too ('Sour {name} ... Gummies'), since the fixture exercises both.
  function stripFormatWordDupe(nameText, leadingLiteral, trailingLiteral) {
    var hit = false;
    if (leadingLiteral) {
      var low = nameText.toLowerCase(), ll = leadingLiteral.toLowerCase();
      if (low === ll) { nameText = ''; hit = true; }
      else if (low.indexOf(ll + ' ') === 0) { nameText = nameText.slice(leadingLiteral.length).replace(/^\s+/, ''); hit = true; }
    }
    if (trailingLiteral) {
      var low2 = nameText.toLowerCase(), tl = trailingLiteral.toLowerCase();
      if (low2 === tl) { nameText = ''; hit = true; }
      else if (low2.length >= tl.length + 1 && low2.slice(-(tl.length + 1)) === ' ' + tl) {
        nameText = nameText.slice(0, nameText.length - trailingLiteral.length).replace(/\s+$/, '');
        hit = true;
      }
    }
    return [nameText, hit];
  }

  // §2 doubled-size fix: a {size} template's own slot renders 'Quarter/Half/
  // Full Ounce'; if the {name} text ALREADY ends in one of those words (a
  // live product literally named "... Half Ounce"), strip it here so the
  // slot's own rendering is the only copy that survives.
  function stripFlowerSizeDupe(nameText) {
    var low = nameText.toLowerCase();
    for (var i = 0; i < FLOWER_SIZE_WORDS.length; i++) {
      var word = FLOWER_SIZE_WORDS[i], wl = word.toLowerCase();
      if (low === wl) { return ['', true]; }
      if (low.length >= wl.length + 1 && low.slice(-(wl.length + 1)) === ' ' + wl) {
        return [nameText.slice(0, nameText.length - (word.length + 1)).replace(/\s+$/, ''), true];
      }
    }
    return [nameText, false];
  }

  function derive(template, slots, shell) {
    slots = slots || {};
    shell = shell || {};

    if (typeof template !== 'string' || !template) {
      return { name: null, warnings: ['template_name_slot_missing'] };
    }

    var tokens = tokenizeTemplate(template);
    var tmplIssues = templateIssues(tokens, template);
    if (tmplIssues.length) { return { name: null, warnings: tmplIssues }; }

    var idx = nameSlotIndex(tokens);
    var nameKind = tokens[idx].val;
    var lt = leadingTrailingLiteral(tokens, idx);
    var leadingLiteral = lt[0], trailingLiteral = lt[1];

    var category = shell.category;
    var brandName = shell.brand_name;
    var warnings = [];

    var nameText;
    var rawName = (typeof slots.name === 'string') ? slots.name.trim() : '';
    if (rawName) {
      var sj = splitJoin(category, brandName, rawName);
      if (sj[2]) {
        var refusal = sj[1].filter(function (c) { return REFUSAL_CODES[c]; });
        return { name: null, warnings: refusal };
      }
      nameText = sj[0];
      warnings = warnings.concat(sj[1]);
    } else if (nameKind === 'name|type') {
      var rawType = (typeof slots.type === 'string') ? slots.type.trim() : '';
      if (!rawType) { return { name: null, warnings: ['name_required'] }; }
      nameText = titleCase(rawType);
    } else {
      return { name: null, warnings: ['name_required'] };
    }

    var dupe = stripFormatWordDupe(nameText, leadingLiteral, trailingLiteral);
    nameText = dupe[0];
    if (dupe[1]) { warnings.push('format_word_in_name'); }

    var hasSizeSlot = false;
    for (var si = 0; si < tokens.length; si++) {
      if (tokens[si].kind === 'slot' && tokens[si].val === 'size') { hasSizeSlot = true; break; }
    }
    if (hasSizeSlot) {
      var sizeDupe = stripFlowerSizeDupe(nameText);
      nameText = sizeDupe[0];
      if (sizeDupe[1]) { warnings.push('format_word_in_name'); }
    }

    if (!nameText) { return { name: null, warnings: ['name_required'] }; }

    var rendered = {};
    for (var i = 0; i < tokens.length; i++) {
      var tok = tokens[i];
      if (tok.kind !== 'slot' || tok.val === 'name' || tok.val === 'name|type') { continue; }
      if (tok.val === 'type') {
        var rt = (typeof slots.type === 'string') ? slots.type.trim() : '';
        rendered[tok.val] = rt ? titleCase(rt) : '';
      } else if (tok.val === 'ratio') {
        rendered[tok.val] = ratioText(slots.ratio);
      } else if (tok.val === 'tier') {
        rendered[tok.val] = tierText(slots.tier);
      } else if (tok.val === 'count') {
        var pack = shell.pack;
        var packN = (pack === null || pack === undefined || pack === '') ? null : Number(pack);
        if (packN === null || !isFinite(packN) || packN < 2) {
          return { name: null, warnings: ['pack_count_required'] };
        }
        rendered[tok.val] = String(Math.trunc(packN));
      } else if (tok.val === 'size') {
        var size = sizeText(shell.weight);
        if (size === null) { return { name: null, warnings: ['flower_size_unknown'] }; }
        rendered[tok.val] = size;
      } else if (tok.val === 'infused') {
        rendered[tok.val] = slots.infused ? 'Infused' : '';
      } else if (tok.val === 'sour') {
        rendered[tok.val] = slots.sour ? 'Sour' : '';
      }
    }

    var out = [];
    for (i = 0; i < tokens.length; i++) {
      var t2 = tokens[i];
      if (t2.kind === 'literal') { out.push(t2.val); }
      else if (t2.val === 'name' || t2.val === 'name|type') { out.push(nameText); }
      else { out.push(rendered.hasOwnProperty(t2.val) ? rendered[t2.val] : ''); }
    }
    var final = collapseWs(out.join(''));
    if (!final) { return { name: null, warnings: ['name_required'] }; }
    return { name: final, warnings: warnings };
  }

  var PREROLL_ENDINGS = ['Infused Pre-Roll', 'Pre-Roll', 'Infused Blunt', 'Blunt', 'Hash Hole'];
  var EDIBLES_GUMMY_ENDINGS = ['Gummies', 'Gummy Belts'];
  var WELLNESS_ENDINGS = [
    'Tincture', 'Capsules', 'Roll-On', 'Balm', 'Lotion', 'Salve', 'Patch',
    'Bath Soak', 'Bath Bomb', 'Body Oil', 'Massage Oil',
  ];
  function endsWithAny(s, list) {
    for (var i = 0; i < list.length; i++) { if (s.slice(-list[i].length) === list[i]) { return true; } }
    return false;
  }

  // §2 'must contain {name} or {name|type}; only known slots; no numeric
  // weight token; no cannabinoid abbreviation; category-specific guards.'
  function validateTemplate(template, category) {
    if (typeof template !== 'string' || !template.trim()) { return ['template_name_slot_missing']; }
    var tokens = tokenizeTemplate(template);
    var issues = templateIssues(tokens, template);
    if (hasCannabinoid(template)) { issues.push('cannabinoid_in_name'); }
    var stripped = template.trim();
    if (category === 'Pre-Rolls') {
      if (template.indexOf('{count}') === -1 && !endsWithAny(stripped, PREROLL_ENDINGS)) { issues.push('template_prerolls_ending'); }
    } else if (category === 'Edibles') {
      if (template.toLowerCase().indexOf('gumm') !== -1 && !endsWithAny(stripped, EDIBLES_GUMMY_ENDINGS)) { issues.push('template_edibles_ending'); }
    } else if (category === 'Wellness') {
      if (!endsWithAny(stripped, WELLNESS_ENDINGS)) { issues.push('template_wellness_ending'); }
    }
    return issues;
  }

  W.HW_NAMING = {
    derive: derive,
    validateTemplate: validateTemplate,
    titleCase: titleCase,
    normaliseName: normaliseName,
    SLOTS: SLOTS,
    WARNING_CODES: WARNING_CODES,
  };
})();

if (typeof module !== 'undefined') { module.exports = window.HW_NAMING; }
