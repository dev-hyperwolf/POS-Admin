# Product Shells, Formats and the Naming Engine — plan + API contract

Approved rulings from the owner (2026-09-09), in order of authority:

1. **Naming doc v0.8 wins** (`Hyperwolf_Naming_Convention_v0_8_CLEAN.docx`, May 2026). Where the
   doc is silent or leaves a choice, **the shorter name wins**. Vapes (doc §5 "under review") take
   the owner's list: Live Resin Cartridge · Live Resin All-In-One · Refined Live Resin Cartridge ·
   Refined Live Resin All-In-One · Live Resin Sauce Cartridge · Live Resin Sauce All-In-One (and the
   same pattern for Cured Resin / Solventless Rosin / Liquid Diamonds / Premium Oil oils).
2. **Numeric weights never appear in a name** (no 1g, 3.5g, 100mg). Spelled-out flower sizes do:
   Quarter Ounce · Half Ounce · Full Ounce, per doc §3. Pre-roll packs carry the count as `N-Pack`.
3. **Phase 1 scope**: shells for the house brand **Hyperwolf** and the ten largest live-menu brands
   (STIIIZY, West Coast Cure, Raw Garden, lolo, Quiet Kings, Claybourne Co., Papa's Herb, Heavy
   Hitters, Gramlin, Whoa). Owner approves; Phase 2 adopts every live variation into its shell and
   rolls the engine across the remaining brands.
4. **Format edits ripple with a preview and a split**: every affected product is listed with its
   before/after name, all selected; any subset can be deselected or split to another new or
   existing format in the same step. Never all-or-nothing, never one-at-a-time.
5. **Format delete never orphans**: the delete button stays disabled until every shell and product
   on the format has a destination (all-to-one, or per-row split across new/existing formats).
6. `pos/screen-register.jsx` is never touched.

Source of the live menu: the production site API (`partner/products/shop`, Blaze-fed), pulled
2026-09-09 into `wm-demo/qa/fixtures/shells/live-menu-2026-09-09.json` — 1,486 unique products,
87 brands. Weedmaps cannot supply this (our two WM ids are unpublished test listings). The wm-demo
`products` table already holds the 2026-08-27 hyperwolf.com harvest (1,536 rows); Phase 1 derives
shells from **that table** so the POS catalog and the shells agree, and reports products the
derivation could not place instead of guessing.

## 1. Data model (wm-demo, SQLite, `wmdemo/shells.py`)

```
shell_formats
  id            TEXT PK        slug, e.g. 'live-resin-sauce-all-in-one'
  name          TEXT NOT NULL  display: 'Live Resin Sauce All-In-One'   UNIQUE(category, name)
  category      TEXT NOT NULL  POS key: Flower | Pre-Rolls | Vapes | Concentrates | Edibles | Wellness | Accessories
  subcategory   TEXT           POS shell subcategory (hw-live-taxonomy / HW_SHELL.TAX subs)
  template      TEXT NOT NULL  naming template, see §2 (e.g. '{name} Live Resin Sauce All-In-One')
  default_weight REAL          e.g. 1     (numeric; never rendered in a name)
  default_unit  TEXT           g | mg | ml | ea
  default_pack  INTEGER        1; pre-roll packs 3/5/10…; the template's {count} reads shell.pack
  wm_node       TEXT           Weedmaps node label hint (display only until HW_TAXONOMY binds it)
  kit_box       TEXT           delivery kit box default
  sort          INTEGER        order inside a category
  active        INTEGER        1; retired formats stay for history but cannot take new shells
  created_at, updated_at REAL; created_by, updated_by TEXT (self-asserted actor, like the rest of wm-demo)

shells
  id            TEXT PK        'SH-' + 4-digit sequence (server-assigned, stable)
  brand_key     TEXT NOT NULL  brands.brand_key (shared/brands.js) — brand never appears in a product name
  brand_name    TEXT NOT NULL
  format_id     TEXT NOT NULL  FK shell_formats.id
  weight        REAL, unit TEXT, pack INTEGER   (default from the format; a brand may override)
  kit_box       TEXT, wm_node TEXT             (default from the format)
  name          TEXT           derived: '<brand> · <format.name>' (+ ' · <weight><unit>' only when
                               the same brand has the same format at two weights — the shell name
                               is internal and MAY show weight; product names never do)
  active        INTEGER, created_at, updated_at, created_by, updated_by
  UNIQUE(brand_key, format_id, weight, unit, pack)

shell_products                 which catalogue product belongs to which shell
  sku           TEXT PK        products.sku
  shell_id      TEXT NOT NULL  FK shells.id
  variation     TEXT NOT NULL  JSON: {name, ratio, tier, type, infused, sour, effect} — the slots
  name_derived  TEXT NOT NULL  what the engine produced from the slots + format template
  name_override TEXT           set only by a manager; when set, products.name = override
  assigned_at, assigned_by, source TEXT ('derive' | 'intake' | 'manual')

shell_events                   audit: every create/rename/reassign/delete with actor, before/after
```

Phase 1 derivation writes `shells` and `shell_products` (with `name_derived`) but **does not
rewrite `products.name`**. The owner approves the shells first; Phase 2 applies names.

## 2. Naming engine (one rule set, two implementations, one fixture)

`wmdemo/shell_naming.py` (server) and `shared/hw-naming.js` (`window.HW_NAMING`, plain JS, IIFE)
implement the same pure function:

```
derive(template, slots, shell) -> {name, warnings[]}
  slots: {name, ratio?, tier?, type?, infused?, sour?, effect?}
  shell: {weight, unit, pack, category}
```

Template slots: `{name}` (strain / flavor / product name; required unless `{type}` is present),
`{type}` (Indica | Sativa | Hybrid, used when a pack has no strain), `{ratio}` (1:1, 2:1, 5:5:5),
`{size}` (flower only: 7g→Quarter Ounce, 14g→Half Ounce, 28g→Full Ounce, 3.5g→nothing),
`{count}` (shell.pack → 'N-Pack'), `{tier}` ('(Tier N)' at the end), `{infused}` (literal
'Infused' when the slot is true), `{sour}` ('Sour' leading, gummies). An unfilled optional slot
collapses with its surrounding whitespace.

Universal rules applied after substitution (doc §2): Title Case with small words capitalised
inside names; brand-internal capitalisation preserved (TYSON 2.0, CAKE, RAW, ProTab, HashTab,
XJ-13, GG4, King Louis XIII, 98' Octane); crosses ` x ` lowercase; multiple flavors ` & `;
ratios `a:b` with no spaces; `Pre-Roll`, `N-Pack`, `All-In-One`, `Roll-On` hyphenated; ™/® removed;
THC/CBD/CBN/CBC/CBG tokens rejected with a warning; any numeric weight token (`1g`, `3.5g`,
`100mg`, `30ml`, `1/2 oz`, `14g`) in the name or template rejected with a warning; brand name
inside the strain slot stripped with a warning. Doc §3–§8 patterns are the seeded templates
(§3 flower). `qa/fixtures/shells/naming-cases.json` carries every example in the doc plus the
owner's vape list; `qa/shells_naming_probe.py` runs Python, `test/hw-naming.test.mjs` runs JS
against the same file; both must pass on the same cases (parity).

Template validation (server, on every format create/update): must contain `{name}` or `{type}`;
only known slots; no numeric weight token; no cannabinoid abbreviation; category-specific
guards (Pre-Rolls templates must end in `Pre-Roll`, `Infused Pre-Roll` or `{count}`; Edibles
gummies end in `Gummies`/`Gummy Belts`; Wellness end in `Tincture` or a topical word).

## 3. Routes (wm-demo `server.py` → `wmdemo/shells_api.py`; write gate = `x-hw-write-token`
when `WM_DEMO_PUBLIC`, actor self-asserted in `actor` like the rest of wm-demo; manager-only
writes check `is_manager(actor)` the way Bounty does)

```
GET  /api/shells/formats                       -> {formats:[…], counts:{format_id:{shells,products}}}
POST /api/shells/formats                       {id?, name, category, subcategory, template, default_*, wm_node, kit_box, sort, actor}
                                               -> {format, warnings[]}  (400 on template validation, 409 on UNIQUE)
POST /api/shells/formats/preview               {id, patch:{…}}
                                               -> {affected:[{sku, shell_id, before, after}], shells:[…]}   (no write)
POST /api/shells/formats/apply                 {id, patch, apply:[sku…], split:[{skus:[…], to_format_id | new_format:{…}}], actor}
                                               -> {renamed:n, moved:n, unchanged:n}  every affected sku must be in apply or split → else 400 {missing:[sku…]}
POST /api/shells/formats/delete                {id, reassign:{all_to?: format_id | new_format, rows?:[{shell_id, to_format_id | new_format}]}, actor}
                                               -> {deleted:id, moved_shells:n, moved_products:n}   every shell on the format must be covered → else 400 {missing:[shell_id…]}
                                               manager-only
GET  /api/shells                               ?brand=&format=&category=   -> {shells:[{…, product_count, sample_names:[…3]}]}
GET  /api/shells/<id>                          -> {shell, format, products:[{sku, name, name_derived, name_override, variation, price, inventory}]}
POST /api/shells                               {brand_key, format_id, weight?, unit?, pack?, kit_box?, wm_node?, actor} -> {shell}
POST /api/shells/delete                        {id, reassign:{to_shell_id?} , actor}  products must be reassigned or the shell must be empty
POST /api/shells/<id>/variations               {slots:{name, ratio?, tier?, type?, infused?, sour?, effect?}, sku?, price, cost?, thc?, genetics?, actor}
                                               -> {product, name_derived, warnings[]}  creates the catalogue product via catalog.upsert_product with the derived name and links it
POST /api/shells/<id>/variations/<sku>         {slots?, name_override? (manager), price?, active?, actor} -> re-derives and rewrites products.name
POST /api/shells/name/preview                  {format_id | template, slots, shell?} -> {name, warnings[]}   (no write; the form calls this as the user types — 250 ms debounce)
POST /api/shells/derive                        {brands:[brand_key…], dry_run:true|false, actor}
                                               -> {created_formats:n, created_shells:[…], assigned:n, unplaced:[{sku, name, reason}], report_id}
GET  /api/shells/derive/<report_id>            -> the full report (stored as JSON in shell_events)
```

Every write appends a `shell_events` row. `/api/state` is **not** widened (poll cost); the shells
library fetches `/api/shells` on mount and after every write.

## 4. UI (POS-Admin, Catalog area; all files IIFE, globals declared in `test/global-collisions`)

- `pos/shell-store.jsx` — becomes a thin client over `/api/shells*` through `window.HW_LIVE`
  (`get`/`post`); keeps `useShells()`, `allShells()`, `shellOf(p)` (now by `shell_id`, no
  arbitrary fallback), formats from the server (`SHELL_FORMATS` removed).
- `pos/shell-formats.jsx` (new, `window.ShellFormatsModule`) — Catalog sub-nav "Formats": list by
  category with shell/product counts; add/edit sheet: name, category, subcategory, template with
  slot chips and a live example ("Blue Dream" → preview), default weight/unit/pack, WM node, kit
  box; **rename/template change → preview modal** (before/after per product, all checked, uncheck
  to hold, "Split selected to…" picker: existing format or new format inline; Apply disabled until
  every row is checked or split); **delete → reassign modal** (per-shell rows with destination
  picker, "Move all to…", Delete disabled until every row has a destination; manager gate).
- `pos/shell-form.jsx` — format picker reads the server library, "+ New format" opens the format
  sheet inline; the "Resulting shell name" line and a **"Example product name"** line
  (engine preview with the strain "Blue Dream").
- `pos/product-shell.jsx` — Add Variation step: the name field is labelled by the format's slot
  (Strain / Flavor / Product name / Type), optional ratio · tier · infused · sour chips shown only
  when the template has that slot; **the derived product name is rendered live** under the field
  from `HW_NAMING` and confirmed by `/api/shells/name/preview` before commit; the free-text name is
  never sent as the product name.
- `pos/shells.jsx` — library grouped by brand; each shell card: format, weight, pack, product
  count, three sample derived names, "unplaced" badge count per brand from the derive report;
  "Derive shells" action (dry run first, then apply) for the Phase 1 brand list.
- Catalog product page "Product shell · source of truth" row shows the real shell id and name.
- Register screen: untouched.

## 5. Verification floor

`qa/shells_probe.py` (schema, formats CRUD + validation, preview/apply/split, delete/reassign
refusals, variations derive, derive report invariant `products_in_scope == assigned + unplaced`),
`qa/shells_naming_probe.py` (every doc example), `test/hw-naming.test.mjs` (same fixture, JS),
`test/global-collisions.test.mjs` extended, `qa/battery.py` includes both probes, and a
SCOREBOARD row per probe. Three refuter lenses before "done": numbers (names), safety (gates,
orphan refusal), blast radius (catalog, register untouched, `/api/state` size unchanged).
