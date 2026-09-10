# Product Shells, Formats and Naming — status

Updated 2026-09-10 (early morning). Phase 1 built, adversarially reviewed twice, fixed, and
pushed for team QA. Plan and API contract: `docs/SHELLS-PLAN-2026-09-09.md`. Derivation
report (what the owner approves): `docs/SHELLS-DERIVE-REPORT-2026-09-09.md`.

## What shipped

- **Formats library** (Catalog → Formats). Add, edit, retire and delete formats yourselves.
  A format is a category, subcategory, naming template, default weight/unit/pack, Weedmaps
  node hint and delivery box. The template's example name renders live as you type; a template
  that carries a numeric weight, a cannabinoid abbreviation or an unknown slot is refused
  where you would save it.
- **Rename / template edit ripples with a preview.** Every affected product is listed with its
  before and after name, all selected. Uncheck rows to hold them, or split any subset to
  another existing format or a new one created inline, in the same step. Apply stays disabled
  until every row is either applied or split.
- **Delete never orphans.** Deleting a format opens the reassign step: every shell on it needs
  a destination (one for all, or row by row across existing or new formats). Delete stays
  disabled, with the reason written beside it, until every row is covered. Manager only.
- **Shells library** (Catalog → Shells), grouped by brand: format, weight, pack, product count,
  the first three derived names, and an "unplaced" pill when the last derivation could not
  place some of that brand's products.
- **Intake types the strain, the name is derived.** Add Variation asks for the strain (or
  flavor / product name, by category), plus ratio, tier or type only when the format's template
  has that slot. The product name renders live under the field and cannot be typed. Numeric
  weights never appear in a name; Quarter / Half / Full Ounce do; packs carry `N-Pack`.
- **One naming rule set, two engines.** `wmdemo/shell_naming.py` (server) and
  `shared/hw-naming.js` (browser) pass the same 87-case fixture built from every example in the
  team's naming doc v0.8 plus the owner's vape list, and agree on 200 random inputs.
- **Derivation from the real catalogue.** Phase 1 (Hyperwolf + STIIIZY, West Coast Cure, Raw
  Garden, lolo, Quiet Kings, Claybourne Co., Papa's Herb, Heavy Hitters, Gramlin, Whoa):
  634 products in scope, 611 placed into 74 shells, 23 unplaced with a stated reason each
  (13 ambiguous site subcategories at Whoa, 9 skus absent from the live-menu pull, 1 refused
  name). Product names on the site are **not** rewritten in Phase 1; the derived names sit
  beside the current ones in the report for approval.
- **Load hyperwolf.com catalogue** (inside Derive shells): the deployed instance carries only
  the demo catalogue, so a manager loads the committed 1,498-row hyperwolf.com harvest first
  (dry run, then Apply), then derives. Operator flags on existing products (discontinued,
  duplicate, manual unpublish) survive a reload.

## Verified

- `qa/shells_probe.py` and `qa/shells_naming_probe.py` on scratch databases (counts in
  `docs/SCOREBOARD.md`, SH rows), `test/hw-naming.test.mjs` (JS twin, same fixture),
  `test/global-collisions.test.mjs`; no new failure in the POS test suite (the 13 failing files
  were failing before this work and reference nothing here).
- Live in the browser against the review server: bad template refused; rename of a 24-product
  format with two rows split to a new format; delete gate held until every row had a
  destination; a Raw Garden shell created from the form landed on the right brand key; a
  variation typed as "apple tartz #6" reached the catalogue as
  "Apple Tartz #6 Live Resin Sauce All-In-One".
- Three adversarial lenses, then a second safety pass on the fixes. Everything they confirmed
  was fixed the same night and has a probe check that failed before and passes after: two
  self-reassign holes that could orphan rows; non-atomic apply/delete (nested commits and an
  implicit commit from schema initialisation); a new-format split that could overwrite an
  existing format; actor sent as a display name; doubled "Half Ounce Half Ounce"; "(Clearance)"
  and "Gummy Bite" leaking into names; a 7-pack classed as a single; vape ratios dropped;
  a sku with `#` unreachable; 500s on malformed bodies.
- Register screen untouched (byte-identical to HEAD). `/api/state` unchanged in shape and size.

## Team QA on Render

1. Open https://hyperwolf-wm-demo.onrender.com/Hyperwolf%20POS.html → Catalog.
2. Paste the write token into the badge once (a manager account, e.g. the floor manager).
3. Catalog → Shells → **Derive shells** → **Load hyperwolf.com catalogue** (dry run shows the
   counts; Apply). Then pick the Phase 1 brands → dry run → Apply.
4. Review shells by brand; open a shell to see its products and derived names.
5. Catalog → Formats: add a format, rename one that has products (preview + split), delete one
   (reassign gate).
6. Catalog → Shells → a shell → Add variation: type a strain and watch the name derive.
7. Send notes as a list: the shell or format, what it reads, what it should read.

## Open (known)

- Phase 2 (after approval): apply derived names to the live product names, adopt every live
  variation for the remaining 76 brands, and reconcile with the Weedmaps brand feeds.
- `Premium Oil Vapes` derives to plain "Cartridge" ("shorter wins"); say if you want
  "Premium Oil Cartridge".
- Heavy Hitters edibles carry no weight in the source data; the shells say "weight not recorded".
- Actor is self-asserted in every write, like the rest of wm-demo; real authentication attaches
  at `contests.is_manager`.
- The catalogue importer's full-blob replace is a pre-existing exposure for `/api/catalog/import`
  and `/api/portable/import`; the carry-forward list added here covers the operator flags known
  today.

## Run it locally

```bash
cd /Users/jt/wm-demo && WM_DEMO_STATIC_DIR=/Users/jt/POS-Admin python3 -m wmdemo.server
```

Then http://127.0.0.1:8787/Hyperwolf%20POS.html → Catalog. The review server used for this
work runs on port 8798 against a copy of the database (`/tmp/shells-derive.sqlite3`);
`lsof -i :8798` finds it.
