# Product Shells — Phase 1 Derivation Report (2026-09-09, re-derived after the defect-fix pass)

Spec: `SHELLS-PLAN-2026-09-09.md` (rulings 1-6), run against a **copy** of the live wm-demo DB
(`/tmp/shells-derive.sqlite3`, freshly re-`cp`'d from `/Users/jt/wm-demo/wmdemo.sqlite3`
immediately before this pass — the repo's own DB file was never opened for writing). Formats
seeded from `qa/fixtures/shells/formats-seed.json` (82 formats; Vapes templates now carry
`{ratio}` and a `merch_suffix` list was added — see below), then `wmdemo.shells.derive()` run
twice (dry, then real) against the Phase 1 brand list: Hyperwolf, STIIIZY, West Coast Cure, Raw
Garden, lolo, Quiet Kings, Claybourne Co., Papa's Herb, Heavy Hitters, Gramlin, Whoa.

**This supersedes the 2026-09-09 subcategory-fallback report.** That pass placed the 62 products
a bare-strain-name second classification pass could newly reach, but shipped with five real
naming/classification defects, confirmed against THIS SAME derive run before the fix (the
`SYN-*`/real-sku examples below all reproduce with the pre-fix code):

1. **Doubled flower-size words.** A `{size}` template's own slot renders "Half Ounce"/"Quarter
   Ounce"/"Full Ounce", but a site name that already spelled the size out doubled it:
   `lolo`'s `Purple Thai Half Ounce Smalls` derived as `Purple Thai Half Ounce **Half Ounce**
   Smalls`; Claybourne's `Kush Mints Ounce Smalls` as `Kush Mints Ounce **Full Ounce** Smalls`.
2. **Pack tokens lost to a trailing descriptor.** Papa's Herb's `Gusherz 7-Pack Pre-Roll` landed
   on the single-unit `Pre-Roll` format (matching the literal trailing word) instead of `Pre-Roll
   Pack`, minting its own one-off shell instead of joining the other six 7-count pre-rolls.
3. **The fallback pass used the site name verbatim.** West Coast Cure's clearance-tagged
   `Rolls Choice Pre-Roll (Clearance)` derived as `Rolls Choice Pre-Roll (Clearance) **Pre-Roll**`
   (merchandising text baked into the name, format word doubled); Whoa's `Strawberry Lemonade
   Gummy Bite` derived as `Strawberry Lemonade **Gummy Bite** Gummies` (an off-label site word
   never stripped).
4. **Vapes templates carried no `{ratio}` slot** — STIIIZY's `Juicy Melon 1:1 All-In-One` derived
   as `Juicy Melon All-In-One`, silently dropping the ratio.
5. **Casing**: `Diamond Og`, `Banana Mac` instead of `Diamond OG`, `Banana MAC` — no ALL-CAPS
   token list in either naming engine.

All five are fixed in both `wmdemo/shell_naming.py` and `shared/hw-naming.js` (naming engine) and
`wmdemo/shells.py` (classifier / fallback pass), covered by 3 new shared naming-engine fixture
cases (`qa/fixtures/shells/naming-cases.json`, run by both `qa/shells_naming_probe.py` and
`test/hw-naming.test.mjs`) and 12 new `qa/shells_probe.py` checks (SH-64..69) that reproduce each
defect against a real or synthetic sku and assert the corrected output. **This report's numbers
are the real re-run, not a projection** — see "What actually changed" below for the honest diff
against the prior report.

## Totals

| | dry run | real run |
|---|---|---|
| in_scope (Phase 1 brand products in the catalog) | 634 | 634 |
| assigned | 611 | 611 |
| — of which via the regex pass | 550 | 550 |
| — of which via the subcategory-fallback second pass | 61 | 61 |
| unplaced | 23 | 23 |
| shells created | (dry: 74 would-create) | 74 |
| invariant `in_scope == assigned + unplaced` | True (634 = 611 + 23) | True (634 = 611 + 23) |

Dry run and real run agree exactly on scope, assignment, and the unplaced list — the real run only
differs by actually writing `shells` + `shell_products` rows and leaving a `shell_events` row per
write. **`products.name` was not touched by either run** (Phase 1 rule, plan §1) — every
`name_derived` value was written to `shell_products` only, including every fallback-placed row.

Total linked `shell_products` rows after the real run: 612 (611 successfully named + 1
`name_refused` row recorded with an empty `name_derived`, the same pre-existing sample sku as
every prior pass, reported below as unplaced).

## What actually changed vs. the prior (buggy) report

The **unplaced set is byte-for-byte identical** — same 23 skus, same reasons, in both passes. None
of the five defects above changed *whether* a product placed, only *what name it produced* once
placed (defects 1, 3, 4, 5) or *which shell it landed on* (defect 2). Two numbers moved, both
explained by the same single reclassification:

- **Regex-pass assignments: 549 → 550; fallback-pass assignments: 62 → 61.** Claybourne's
  `Strawberry Cough Infused 2-Pack (Clearance)` (sku `H6ABPRO4`) used to reach the fallback pass
  only because the regex pass's `infused \d+[- ]?(pack|pk)$` pattern is end-anchored and the
  trailing `" (Clearance)"` defeated it. The pack-first classification fix (defect 2's fix) tries
  pack-shaped patterns **unanchored** whenever a real pack token exists anywhere in the name, so
  the regex pass now matches this sku directly — one fewer fallback placement, one more regex
  placement, same total (611).
- **Shells created: 75 → 74.** Papa's Herb's misclassified `Gusherz 7-Pack Pre-Roll` no longer
  mints its own one-off `Pre-Roll` shell at weight 7g/pack 7 — it now joins the SAME `Pre-Roll
  Pack` shell (weight 7g, pack 7) the other six 7-count pre-rolls already share (5 → 6 products on
  that shell). One real shell disappears; nothing else changes shell count.

Every other number — `in_scope`, `assigned`, `unplaced`, and every unplaced sku's reason — is
identical to the prior report, because the defects were purely about naming quality and one
misrouted classification, not about whether a product could be placed at all.

## The subcategory fallback (how the second pass works, unchanged from the prior report)

`_classify_fallback()` in `wmdemo/shells.py` runs ONLY when the regex pass (`_classify()`) has
already failed for a product. It:

1. Looks the product up **by sku** in `qa/fixtures/shells/live-menu-2026-09-09.json` (loaded once,
   cached by sku). If the sku is not in that fixture, the product stays unplaced with reason
   `no_format_match`.
2. Otherwise reads the product's site `subs` (subcategory) and looks it up in
   `formats-seed.json`'s `subcategory_fallback` table, e.g. `"Premium Oil Vapes": "Cartridge"`,
   `"Gummies": "Gummies"`, `"Single Pre-Roll": "Pre-Roll"`.
3. **(New, this pass)** Before using the site name as the `{name}` slot, it now strips (a) a
   merchandising suffix — `"(Clearance)"`, `"Clearance"`, `"(Sale)"`, `"- Sale"`, `"(Closeout)"`,
   `"Closeout"`, end-anchored, from `formats-seed.json`'s new `merch_suffix` list — and (b) a
   trailing occurrence of the DESTINATION format's own `match` words, tried **unanchored** (so
   `"Gummy Bite"` matches the `Gummies` format's `gumm(y|ies)$` pattern even though the site text
   continues past it). `"Gusherz Pre-Roll (Clearance)"` on `Pre-Roll` → `"Gusherz"` (the template's
   own literal `" Pre-Roll"` supplies the one surviving copy); `"Strawberry Lemonade Gummy Bite"`
   on `Gummies` → `"Strawberry Lemonade"`.
4. If the subcategory maps to the sentinel `"ambiguous"`, the product stays unplaced with reason
   `subcategory_ambiguous`.
5. **Regex-gap guard, unchanged:** a Vapes product whose own cleaned name already contains
   `disposable`/`all-in-one`/`pod`/`cart(ridge)` is refused from the fallback (reason `regex_gap`)
   rather than silently placed — that shape should have matched the regex pass on its own.

## Per-brand shells and products

**Phase 1 shell total: 74 shells, 612 linked `shell_products` rows** (611 successfully named + 1
`name_refused`). Rows marked **(fallback: ‹site subcategory›)** were placed by the second pass.

## Hyperwolf — 6 shells, 31 products

| Format | Weight · Unit · Pack | Product count | Example derived names vs. current site names |
|---|---|---|---|
| Flower | 1g · pack 1 | 1 | `Staff Sample - Flower 1g` -> `(refused)` |
| Flower | 3.5g · pack 1 | 18 | `Hyperwolf House Blend Mystery Jar - 3.5g` -> `House Blend Mystery Jar`<br>`Inferno Runtz` — unchanged<br>`Strawberry Haze` — unchanged |
| Flower | 14g · pack 1 | 5 | `Blueberry Dutch Treat Half Ounce` — unchanged<br>`Bubblegum Orchata Half Ounce` — unchanged<br>`Sweet Tooth Half Ounce` — unchanged |
| Pre-Roll | 0.5g · pack 1 | 1 | `Staff Sample - Pre Roll 0.5g` -> `Staff Sample Pre-Roll` |
| All-In-One | 0.5g · pack 1 | 1 | `Staff Sample - Vape 0.5g` -> `Staff Sample All-In-One` |
| Accessory | 1ea · pack 1 | 5 | `Small Glass Marble Pipe` — unchanged<br>`Medium Glass Pipe (Assorted Colors)` — unchanged<br>`Large Glass Pipe (Assorted Colors)` — unchanged |

## STIIIZY — 16 shells, 126 products

| Format | Weight · Unit · Pack | Product count | Example derived names vs. current site names |
|---|---|---|---|
| Infused Pre-Roll | 1g · pack 1 | 16 | `Skywalker OG Infused Pre-roll` -> `Skywalker OG Infused Pre-Roll`<br>`Cereal Milk Infused Pre-Roll` — unchanged<br>`Blue Dream Infused Pre-Roll` — unchanged |
| Pre-Roll Pack | 2.5g · pack 5 | 1 | `Orange Sunset 5-Pack` — unchanged |
| Infused Pre-Roll Pack | 2.5g · pack 5 | 11 | `Watermelon Z Infused 5-Pack` — unchanged<br>`Sour Diesel Infused 5-Pack` — unchanged<br>`King Louis XIII Infused 5-Pack` — unchanged |
| All-In-One | 0.5g · pack 1 | 1 | `Juicy Melon 1:1 All-In-One` — unchanged **(fixed: used to derive as `Juicy Melon All-In-One`, dropping the ratio — see defect 4)** |
| All-In-One | 1g · pack 1 | 21 | `Skywalker OG All-In-One` — unchanged<br>`Super Lemon Haze All-In-One` — unchanged<br>`White Raspberry All-In-One` — unchanged |
| Pod | 0.5g · pack 1 | 1 | `Mango 1:1 Pod` — unchanged |
| Pod | 1g · pack 1 | 16 | `Pineapple Express Full Gram Pod` — unchanged<br>`Pink Acai Full Gram Pod` — unchanged<br>`Blue Burst Full Gram Pod` — unchanged |
| Battery | 1ea · pack 1 | 1 | `Black Pro Battery` — unchanged |
| Live Resin | 1g · pack 1 | 1 | `Rainbow Mintz Curated Live Resin` — unchanged |
| Live Resin Diamonds | 1g · pack 1 | 13 | `Diamond Og Live Resin Diamonds` -> `Diamond OG Live Resin Diamonds`<br>`Papaya Punch Live Resin Diamonds` — unchanged<br>`Acai Berry Live Resin Diamonds` — unchanged |
| Live Resin Sauce | 1g · pack 1 | 12 | `Banana Mac Live Resin Sauce` -> `Banana MAC Live Resin Sauce`<br>`Space Cake Live Resin Sauce` — unchanged<br>`Truffle Sundae Live Resin Sauce` — unchanged |
| Live Rosin | 1g · pack 1 | 10 | `Biscotti Gelato Live Rosin Jam` -> `Biscotti Gelato Live Rosin`<br>`Kush Cake Live Rosin Jam` -> `Kush Cake Live Rosin`<br>`Diamond Berry Live Rosin Jam` -> `Diamond Berry Live Rosin` |
| Live Rosin Badder | 1g · pack 1 | 1 | `French Toast Live Rosin Badder` — unchanged |
| Gummies | 100mg · pack 10 | 16 | `Pink Lemonade Star Gummies` — unchanged<br>`Pink Lemonade Gummies` — unchanged<br>`Midnight Berry 2:1 Gummies` — unchanged |
| Gummies | 109mg · pack 10 | 1 | `Watermelon Wave Gummies` — unchanged |
| Sour Gummies | 100mg · pack 10 | 4 | `Sour Strawberry Gummies` — unchanged<br>`Sour Lemon Lime Gummies` — unchanged<br>`Sour Apple Gummies` — unchanged |

## West Coast Cure — 9 shells, 81 products (11 via subcategory fallback)

| Format | Weight · Unit · Pack | Product count | Example derived names vs. current site names |
|---|---|---|---|
| Pre-Roll | 1g · pack 1 | 13 (3 fallback) | `Rolls Choice Pre-Roll (Clearance)` -> `Rolls Choice Pre-Roll`  **(fallback: Single Pre-Roll — fixed: used to derive as `Rolls Choice Pre-Roll (Clearance) Pre-Roll`, see defect 3)**<br>`Milk & Cookies Pre-Roll (Clearance)` -> `Milk & Cookies Pre-Roll`  **(fallback: Single Pre-Roll)**<br>`GMO Pre-Roll (Clearance)` -> `GMO Pre-Roll`  **(fallback: Single Pre-Roll)** |
| Infused Pre-Roll | 1.2g · pack 1 | 6 | `Blue Dream Infused Pre-Roll` — unchanged<br>`Trainwreck Infused Pre-Roll` — unchanged<br>`God's Gift Infused Pre-Roll` — unchanged |
| Infused Pre-Roll Pack | 3.25g · pack 5 | 4 | `Blue Dream Infused 5-Pack` — unchanged<br>`Colombian Gold Infused 5-Pack` — unchanged<br>`Trainwreck Infused 5-Pack` — unchanged |
| Cartridge | 1g · pack 1 | 8 (8 fallback) | `Cereal Milk` -> `Cereal Milk Cartridge`  **(fallback: Premium Oil Vapes)**<br>`Dragon Lychee` -> `Dragon Lychee Cartridge`  **(fallback: Premium Oil Vapes)**<br>`Granddaddy Purple` -> `Granddaddy Purple Cartridge`  **(fallback: Premium Oil Vapes)** |
| All-In-One | 1g · pack 1 | 14 | `Cereal Milk All-In-One` — unchanged<br>`Blackberry Kush All-In-One` — unchanged<br>`Guava Nectar All-In-One` — unchanged |
| Live Resin All-In-One | 1g · pack 1 | 4 | `Strawberry n' Sugar Live Resin All-In-One` -> `Strawberry N' Sugar Live Resin All-In-One`<br>`Rainbow Gelato Live Resin All-In-One` — unchanged<br>`Guavamelon Live Resin All-In-One` — unchanged |
| Live Resin Badder | 1g · pack 1 | 9 | `Papaya Juice Live Resin Badder` — unchanged<br>`Goji OG Live Resin Badder` — unchanged<br>`Honey Wine Live Resin Badder` — unchanged |
| Live Resin Sugar | 1g · pack 1 | 11 | `Lemon Cherry Gelato Live Resin Sugar` — unchanged<br>`Pink Cookies Live Resin Sugar` — unchanged<br>`Ultra Jack Live Resin Sugar` — unchanged |
| Live Resin Diamonds | 1g · pack 1 | 12 | `Berry Crepes Diamonds` -> `Berry Crepes Live Resin Diamonds`<br>`Mango Haze Live Resin Diamonds` — unchanged<br>`White Fire Bomb Live Resin Diamonds` — unchanged |

## Raw Garden — 8 shells, 62 products

| Format | Weight · Unit · Pack | Product count | Example derived names vs. current site names |
|---|---|---|---|
| Live Resin Cartridge | 1g · pack 1 | 8 | `Virgin Purps Live Resin Cart` -> `Virgin Purps Live Resin Cartridge`<br>`Secret Fire Live Resin Cart` -> `Secret Fire Live Resin Cartridge`<br>`OG Kush Live Resin Cart` -> `OG Kush Live Resin Cartridge` |
| Live Resin All-In-One | 1g · pack 1 | 7 | `Yuzu Blossom Live Resin All-In-One` — unchanged<br>`OG Haze Live Resin All-In-One` — unchanged<br>`Kiwi Dream Live Resin All-In-One` — unchanged |
| Live Resin Sauce All-In-One | 1g · pack 1 | 4 | `Abracadabra Sauce All-In-One` -> `Abracadabra Live Resin Sauce All-In-One`<br>`Apple Tartz #6 Sauce All-In-One` -> `Apple Tartz #6 Live Resin Sauce All-In-One`<br>`OG Squeeze Sauce All-In-One` -> `OG Squeeze Live Resin Sauce All-In-One` |
| Live Resin | 1g · pack 1 | 10 | `Wubba OG Live Resin` — unchanged<br>`GovernMint Oasis Live Resin` — unchanged<br>`OG Squeeze Live Resin` — unchanged |
| Live Resin Badder | 1g · pack 1 | 7 | `Super  Lemon Biscotti Live Badder` -> `Super Lemon Biscotti Live Resin Badder`<br>`Strawberry Rosé Badder` -> `Strawberry Rosé Live Resin Badder`<br>`Sweet Leeroy Live Badder` -> `Sweet Leeroy Live Resin Badder` |
| Live Resin Diamonds | 1g · pack 1 | 11 | `Fresh Water Taffy Diamonds` -> `Fresh Water Taffy Live Resin Diamonds`<br>`Gelato Slushy Diamonds` -> `Gelato Slushy Live Resin Diamonds`<br>`Vision OG Diamonds` -> `Vision OG Live Resin Diamonds` |
| Live Resin Sauce | 1g · pack 1 | 9 | `Slim Reaper Live Sauce` -> `Slim Reaper Live Resin Sauce`<br>`Green Crack Live Sauce` -> `Green Crack Live Resin Sauce`<br>`Slymer Live Sauce` -> `Slymer Live Resin Sauce` |
| Live Rosin | 1g · pack 1 | 6 | `Garlic Juice Live Rosin` — unchanged<br>`OG Squeeze Live Rosin` — unchanged<br>`Headband Live Rosin` — unchanged |

## lolo — 5 shells, 69 products

| Format | Weight · Unit · Pack | Product count | Example derived names vs. current site names |
|---|---|---|---|
| Smalls | 3.5g · pack 1 | 15 | `lolo Lemon Smalls` -> `Lemon Smalls`<br>`lolo Kush Smalls` -> `Kush Smalls`<br>`Blueberry Gelato Smalls` — unchanged |
| Smalls | 14g · pack 1 | 7 | `Purple Thai Half Ounce Smalls` — unchanged **(fixed: used to derive as `Purple Thai Half Ounce Half Ounce Smalls`, see defect 1)**<br>`lolo Kush Half Ounce Smalls` -> `Kush Half Ounce Smalls`<br>`lolo Lemon Half Ounce Smalls` -> `Lemon Half Ounce Smalls` |
| Pre-Roll | 1g · pack 1 | 27 | `lolo Lemon Pre-Roll` -> `Lemon Pre-Roll`<br>`Kosher Tangie Pre-Roll` — unchanged<br>`Chemdawg Pre-Roll` — unchanged |
| Infused Pre-Roll | 1g · pack 1 | 9 | `Sour Diesel Infused Pre-Roll` — unchanged<br>`KmintZ Infused Pre-Roll` — unchanged<br>`OG Chem Infused Pre-Roll` — unchanged |
| Infused Pre-Roll Pack | 1.5g · pack 3 | 11 | `Orange Creamsicle Infused 3-pack` -> `Orange Creamsicle Infused 3-Pack`<br>`Keef Sweat Infused 3-pack` -> `Keef Sweat Infused 3-Pack`<br>`Kushberries Infused 3-Pack` — unchanged |

## Quiet Kings — 6 shells, 63 products

| Format | Weight · Unit · Pack | Product count | Example derived names vs. current site names |
|---|---|---|---|
| Flower | 3.5g · pack 1 | 15 | `Peanut Butter Breath` — unchanged<br>`Cheetah Piss` — unchanged<br>`Watermelon Z` — unchanged |
| Flower | 14g · pack 1 | 9 | `Durban Gushers Half Ounce` — unchanged<br>`Blueberry Half Ounce` — unchanged<br>`White Runtz Half Ounce` — unchanged |
| Pre-Roll | 1g · pack 1 | 19 | `Dosi Crasher Pre-Roll` — unchanged<br>`Glitter Bomb Pre-Roll` — unchanged<br>`Apple Fritter Pre-Roll` — unchanged |
| Pre-Roll Pack | 2.5g · pack 5 | 4 | `La Bomba 5-Pack` -> `LA Bomba 5-Pack`<br>`Biscotti Kush Mintz 5-Pack` — unchanged<br>`Super Boof 5-Pack` — unchanged |
| Pre-Roll Pack | 7g · pack 14 | 10 | `Tangie 14-Pack` — unchanged<br>`London Jealousy 14-Pack` — unchanged<br>`Blue Dot 14-Pack` — unchanged |
| Pre-Roll Pack | 14g · pack 28 | 6 | `Orange OG 28-Pack` — unchanged<br>`Rainbow Sherbet 28-Pack` — unchanged<br>`Platinum Purple Kush 28-Pack` — unchanged |

## Claybourne Co. — 8 shells, 44 products

| Format | Weight · Unit · Pack | Product count | Example derived names vs. current site names |
|---|---|---|---|
| Flower | 3.5g · pack 1 | 2 | `Kush Mints` — unchanged<br>`Spritzer` — unchanged |
| Smalls | 28g · pack 1 | 2 | `Kush Mints Ounce Smalls` -> `Kush Mints Full Ounce Smalls` **(fixed: used to derive as `Kush Mints Ounce Full Ounce Smalls`, see defect 1)**<br>`Lemon Granita Ounce Smalls` -> `Lemon Granita Full Ounce Smalls` |
| Pre-Roll | 1g · pack 1 | 7 | `Grape Gasolina Pre-Roll` — unchanged<br>`Black Triangle OG Pre-Roll` — unchanged<br>`Kush Mints Pre-Roll` — unchanged |
| Pre-Roll Pack | 3g · pack 6 | 3 | `Thrill and Chill Variety 6-Pack` -> `Thrill And Chill Variety 6-Pack`<br>`Fast Lane Variety 6-Pack` — unchanged<br>`Bake Sale Variety 6-Pack` — unchanged |
| Infused Pre-Roll Pack | 1g · pack 2 | 10 | `Strawberry Cough Infused 2-Pack (Clearance)` -> `Strawberry Cough Infused 2-Pack` **(placed via the regex pass now, not the fallback — see "What actually changed")**<br>`Watermelon Z Infused 2-Pack` — unchanged<br>`King Louis OG Infused 2-Pack` — unchanged |
| Infused Pre-Roll Pack | 2.5g · pack 5 | 7 | `Banana OG Frosted Infused 0.5g 5-Pack` -> `Banana OG Frosted Infused 5-Pack`<br>`King Louis OG Infused 5-Pack` — unchanged<br>`Strawberry Cough Frosted Infused 5-Pack` — unchanged |
| Infused Blunt | 1.5g · pack 1 | 6 | `Lemon Lime Kush Infused Blunt` — unchanged<br>`Lemon Cherry Gelato Infused Blunt` — unchanged<br>`Mango Machine Infused Blunt` — unchanged |
| All-In-One | 1g · pack 1 | 7 | `Grape Gasolina All-In-One` — unchanged<br>`Wedding Cake All-In-One` — unchanged<br>`Durban Poison All-In-One` — unchanged |

Claybourne's previously-fallback-placed clearance case (`H6ABPRO4`) is placed by the **regex**
pass in this report — see "What actually changed" above; it is not in the "8 shells" count as a
fallback row any more, and Claybourne's fallback total is correspondingly 0 (down from 1).

## Papa's Herb — 5 shells, 48 products (12 via subcategory fallback)

| Format | Weight · Unit · Pack | Product count | Example derived names vs. current site names |
|---|---|---|---|
| Pre-Roll | 1g · pack 1 | 15 | `Donny Burger Pre-roll` -> `Donny Burger Pre-Roll`<br>`Maui Wowie Pre-roll` -> `Maui Wowie Pre-Roll`<br>`Gusherz Pre-Roll` — unchanged |
| Pre-Roll Pack | 7g · pack 7 | 6 | `Gusherz 7-Pack Pre-Roll` -> `Gusherz 7-Pack` **(fixed: used to land on a one-off `Pre-Roll` shell as `Gusherz Pre-Roll`, dropping the pack entirely — see defect 2. Now correctly joins the other five 7-count pre-rolls on this shell.)**<br>`GMO Cookies 7-Pack` — unchanged<br>`Fire OG 7-Pack` — unchanged |
| Cartridge | 1g · pack 1 | 13 (12 fallback) | `Lemon Cherry Gelato` -> `Lemon Cherry Gelato Cartridge`  **(fallback: Premium Oil Vapes)**<br>`Wedding Cake` -> `Wedding Cake Cartridge`  **(fallback: Premium Oil Vapes)**<br>`Skywalker OG` -> `Skywalker OG Cartridge`  **(fallback: Premium Oil Vapes)** |
| All-In-One | 1g · pack 1 | 8 | `Watermelon Z All-In-One` — unchanged<br>`Super Lemon Haze All-In-One` — unchanged<br>`Lemon Cherry Gelato All-In-One` — unchanged |
| Live Resin All-In-One | 1.25g · pack 1 | 6 | `Tropicana Cherry Live Resin All-In-One` — unchanged<br>`Northern Lights Live Resin All-In-One` — unchanged<br>`Maui Wowie Live Resin All-In-One` — unchanged |

Papa's Herb went from **6** shells (prior report, including the misclassified one-off `Pre-Roll`
shell at weight 7g/pack 7) to **5** — the pack-first classification fix (defect 2) merged the
misclassified `Gusherz 7-Pack Pre-Roll` onto the SAME `Pre-Roll Pack` shell its five siblings
already occupy, rather than minting a separate shell for it. Its 12 Cartridge fallback placements
are unchanged from the prior report and still land on the SAME shell the regex pass created for
`Jack Herer Cartridge` — the plan's own shell-key rule (`brand_key, format_id, weight, unit,
pack`) reuses it rather than minting a second one.

## Heavy Hitters — 3 shells, 31 products (17 via subcategory fallback)

| Format | Weight · Unit · Pack | Product count | Example derived names vs. current site names |
|---|---|---|---|
| Cartridge | 1g · pack 1 | 17 (17 fallback) | `Jack Herer` -> `Jack Herer Cartridge`  **(fallback: Premium Oil Vapes)**<br>`God's Gift` -> `God's Gift Cartridge`  **(fallback: Premium Oil Vapes)**<br>`Pineapple Trainwreck` -> `Pineapple Trainwreck Cartridge`  **(fallback: Premium Oil Vapes)** |
| Gummies | 0g · pack 10 | 11 | `Blueberry Blitz Ultra Gummy` -> `Blueberry Blitz Ultra Gummies`<br>`Cloudberry 1:1 Sugar Free Gummies` -> `Cloudberry Sugar Free 1:1 Gummies`<br>`Green Crack 2:1 Gummies` — unchanged |
| Sour Gummies | 0g · pack 10 | 3 | `Sour Cherry Fast-Acting Gummies` — unchanged<br>`Sour Peach Fast-Acting Gummies` — unchanged<br>`Sour Watermelon Fast-Acting Gummies` — unchanged |

Unchanged from the prior report: its entire Vapes line (17 bare strain names) is still placed
entirely by the fallback pass, one shell.

## Gramlin — 6 shells, 37 products (9 via subcategory fallback)

| Format | Weight · Unit · Pack | Product count | Example derived names vs. current site names |
|---|---|---|---|
| Flower | 3.5g · pack 1 | 4 | `Shady Sugar` — unchanged<br>`Presidential Runtz` — unchanged<br>`LCG BX` — unchanged |
| Flower | 14g · pack 1 | 2 | `Pink Certz x Shady Apples Half Ounce` — unchanged<br>`LCG BX Half Ounce` — unchanged |
| Pre-Roll Pack | 3.5g · pack 5 | 4 | `Citrus Blast 5-Pack` — unchanged<br>`Pink Whip 5-Pack` — unchanged<br>`Sunset Mojito 5-Pack` — unchanged |
| Infused Pre-Roll Pack | 3.5g · pack 5 | 9 | `Pineapple Express Infused 5-pack` -> `Pineapple Express Infused 5-Pack`<br>`Sour Apple Pie Infused 5-pack` -> `Sour Apple Pie Infused 5-Pack`<br>`Strawberry Banana infused 5-Pack` -> `Strawberry Banana Infused 5-Pack` |
| Cartridge | 1g · pack 1 | 9 (9 fallback) | `Blueberry Waffles` -> `Blueberry Waffles Cartridge`  **(fallback: Premium Oil Vapes)**<br>`Sour Apple Pie` -> `Sour Apple Pie Cartridge`  **(fallback: Premium Oil Vapes)**<br>`Strawberry Cough` -> `Strawberry Cough Cartridge`  **(fallback: Premium Oil Vapes)** |
| All-In-One | 1g · pack 1 | 9 | `Watermelon Lemonade All-In-One` — unchanged<br>`Pink Acai All-In-One` — unchanged<br>`Blueberry Waffles All-In-One` — unchanged |

Unchanged from the prior report.

## Whoa — 2 shells, 20 products (12 via subcategory fallback)

| Format | Weight · Unit · Pack | Product count | Example derived names vs. current site names |
|---|---|---|---|
| All-In-One | 1g · pack 1 | 8 | `Peach Plumeria All-In-One` — unchanged<br>`Pink Rozay All-In-One` — unchanged<br>`Tangie Dream All-In-One` — unchanged |
| Gummies | 100mg · pack 10 | 12 (12 fallback) | `Strawberry Lemonade Gummy Bite` -> `Strawberry Lemonade Gummies`  **(fallback: Gummies — fixed: used to derive as `Strawberry Lemonade Gummy Bite Gummies`, see defect 3)**<br>`Tangerine Gummy Bite` -> `Tangerine Gummies`  **(fallback: Gummies)**<br>`Pink Lemonade Gummy Bite` -> `Pink Lemonade Gummies`  **(fallback: Gummies)** |

Every one of Whoa's 12 Gummies fallback placements is now clean (no `Gummy Bite`/`CBN Bite`
leftover in the derived name) — this is the flagship example of defect 3's fix. Whoa's other 13
originally-unplaced products (its rosin-pack/rosin-gummy shapes and the two CBN-ratio gummies)
remain genuinely unplaced below, unchanged from the prior report.

## Unplaced products — full list (23, identical to the prior report)

Every Phase 1 brand product the derivation still could not place, with the honest reason. This
list is **byte-for-byte the same 23 skus, same reasons** as the prior (buggy) report — the fixes
in this pass changed naming quality and one misclassification, never whether a product could be
placed. 13 are `subcategory_ambiguous`, 9 are `no_format_match`, 1 is `name_refused`.

### `subcategory_ambiguous` (13) — all Whoa, all Edibles

| SKU | Current name | Site subcategory |
|---|---|---|
| H2A3PRO3 | Grape 1:1:1 CBN Gummy Bite | Ratio (CBN/CBD) Edibles |
| H2EDPRO5 | Blueberry Pear 1:1 Gummy CBN Bite | Ratio (CBN/CBD) Edibles |
| H0E7PRO1 | Watermelon Lemonade Rosin 10-Pack | Solventless Rosin / Hash Edibles |
| H33APRO4 | Peach Mango Rosin 10-Pack | Solventless Rosin / Hash Edibles |
| H442PRO2 | Sour Lemon Drop Rosin 10-Pack | Solventless Rosin / Hash Edibles |
| H5BDPRO4 | Sour Lemon Drop Rosin Gummy Bite | Solventless Rosin / Hash Edibles |
| H77BPRO3 | Peach Mango Rosin Gummy Bite | Solventless Rosin / Hash Edibles |
| H8F1PRO4 | Blue Baja Rosin Gummy Bite | Solventless Rosin / Hash Edibles |
| H93FPRO4 | Watermelon Lemonade Rosin Gummy Bite | Solventless Rosin / Hash Edibles |
| HA0CPRO3 | Blue Baja Rosin 10-Pack | Solventless Rosin / Hash Edibles |
| HACCPRO2 | Tiki Punch Rosin Gummy Bite | Solventless Rosin / Hash Edibles |
| HBE2PRO2 | Tiki Punch Rosin 10-Pack | Solventless Rosin / Hash Edibles |
| HE34PRO6 | Pineapple Habanero Rosin 10-Pack | Solventless Rosin / Hash Edibles |

`"Solventless Rosin / Hash Edibles"` covers both a gummy shape (`... Gummy Bite`) and a non-gummy
pack shape (`... 10-Pack`) under one site subcategory, and `"Ratio (CBN/CBD) Edibles"` likewise
covers products that are still fundamentally gummies but carry a cannabinoid ratio the naming
engine's `cannabinoid_in_name` rule would refuse if it reached the strain slot unmodified. Neither
collapses to a single format without inventing a new one (or two) that the owner has not
reviewed — left unplaced on purpose rather than guessed at.

### `no_format_match` (9) — sku not in the live-menu fixture

| SKU | Brand | Current name |
|---|---|---|
| 333 | Hyperwolf | Dev & Waffles Melted Diamonds |
| HW-SAMPLE-03 | Hyperwolf | Staff Sample - Edible 10mg |
| QA-SAMPLE-MTDBRNIY | Hyperwolf | Hyperwolf QA Sample Punch Gummies 100mg 10pk |
| H420PRO2 | Hyperwolf | Coffin Candy Liquid Diamonds |
| HB03PRO2 | Hyperwolf | Cereal Milk Liquid Diamonds |
| H44FPRO6 | Heavy Hitters | Panama Red |
| H24FPRO2 | Papa's Herb | Watermelon Z |
| H967PRO1 | Papa's Herb | RNTZ |
| H3BBPRO1 | West Coast Cure | Birthday Cake |

Three of these (`333`, `HW-SAMPLE-03`, `QA-SAMPLE-MTDBRNIY`) are staff/QA sample skus that were
never real site listings. The other six are real-looking skus simply not present in this
`live-menu-2026-09-09.json` pull — stays `no_format_match` rather than guessing, per spec.

### `name_refused` (1) — pre-existing, unrelated to this pass

| SKU | Brand | Current name | Detail |
|---|---|---|---|
| HW-SAMPLE-01 | Hyperwolf | Staff Sample - Flower 1g | `flower_size_unknown` — a staff sample at a non-standard 1g flower weight; the naming engine's refusal is working as designed (plan §2: only 3.5/7/14/28g have a defined `{size}` token). |

## Verification

`qa/shells_probe.py`: **100/100 PASS** (was 61/61 before this pass; SH-57..SH-77e added —
self_reassign refusals on all three write paths, atomicity repros for `format_apply`/
`format_delete` under an injected mid-transaction failure PLUS the refuter's own literal repro
(a valid rename + a split to an invalid new_format returns 400 and leaves the DB completely
untouched), the sku URL-encoding round-trip, pack-first classification, the two fallback
merch-suffix/off-label-word cases, two-weight symmetric renaming, the seeded Vapes `{ratio}`
templates + the operator-edit-survives-reseed guarantee, and 400-not-500 on malformed input).
`qa/shells_naming_probe.py`: **177/177 PASS** (was 174/174; 3 new shared fixture
cases — doubled flower-size word, Vapes `{ratio}`, the ALL-CAPS token list). `test/hw-naming.test.mjs`
(the JS twin, same fixture): **5/5 PASS**. `qa/battery.py`'s `EXPECTED_CHECKS["shells_probe"]`
raised 61 → 100 and `["shells_naming_probe"]` raised 174 → 177; `TOTAL_CHECK_FLOOR` raised
2624 → 2666; `docs/SCOREBOARD.md` carries updated SH rows.

## Server

The port-8798 review server (`wmdemo.server`, `WM_DEMO_DB=/tmp/shells-derive.sqlite3`,
`WM_DEMO_STATIC_DIR=/Users/jt/POS-Admin`) was restarted against the freshly re-derived copy DB
after the fix pass. Live-verified against the running server, not just the probe: the phantom
empty shell `SH-0076` (zero products, a leftover from earlier interactive testing) was deleted via
`POST /api/shells/delete`; a `name_override` write with the manager actor's ASSOCIATE ID
(`ashley-g`) succeeded (200) while the SAME write with the display name (`"Ashley G"`) was refused
403 `name_override is manager-only` — confirming `pos/shell-store.jsx`'s `actor()` fix (sending the
id, matching `pos/shell-formats.jsx`'s `actorName()`) is what the server's `is_manager()` gate
actually needs. `GET /api/shells` reports the new shell count (74, down from 75 — see "What
actually changed").
