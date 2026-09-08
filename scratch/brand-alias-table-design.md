# Brand alias table — design, audit, and shipped result

**Status:** designed, audited, implemented, verified live. Shipped in `pos/pricing-shared.jsx`.
**Author:** follow-up pass, 2026-09-07.
**Closes:** `scratch/shell-pricing-aggregation-design.md` §1.7 and §11 ("Open item deliberately
NOT in this change").
**Evidence base:** the full live dataset — `GET https://hw-pricing-scraper.onrender.com/api/pricing/listings`,
29 pages at `limit=2000`, **56,938 rows**, fetched 2026-09-07. 780 distinct raw `brand` strings,
**706 distinct `normalizeBrand()` keys**. Every number below was measured against those rows by
loading the *real* `shared/brands.js`, `pos/data.jsx`, `pos/shell-store.jsx` and
`pos/pricing-shared.jsx` in a Node harness, and then re-measured **in the running app** in Chrome.
Nothing here is estimated.

---

## 0. One-paragraph summary

`normalizeBrand()` folded case and whitespace but nothing else, so the same real company written
two genuinely different ways — a former legal name, a "… Cannabis Co." long form, a corporate
"… Labs" suffix — produced two non-equal keys and silently lost every match between them. The fix
is a **7-entry explicit alias table consulted as the last step inside `normalizeBrand()` itself**,
mapping variant spellings to one canonical key per real company. Because it lives inside
`normalizeBrand()`, it applies to **both sides** — listing rows and shell brand strings — so
`groupKey()` (Pricing screen) and `shellIdentityKey()` (shell Market Pricing) both benefit with
zero call-site change and no second mechanism. Measured effect: **307 live rows across 5 brands
become reachable that were previously unreachable**, the 12 seeded shells' numbers are
**byte-identical**, the Pricing screen's group / multi-source / multi-competitor counts are
**byte-identical**, and the `raw` vs `rawgarden` trap is **not** triggered.

---

## 1. The two universes

### 1.1 This app's brand universe is exactly 16 strings

`shared/brands.js` is the single brand list and says so in its own header: *"There is no second
brand list."* `pos/data.jsx:19` reads it (`const B = window.HW_BRANDS.name`) and every `PRODUCTS`
row's `brand` field is one of those 16 display names. `pos/shell-store.jsx:60 seed()` copies
`first.brand` straight through, so `shell.brand` is always one of the same 16. `pipeline/*.jsx`
repeats a few of the same strings verbatim (`'Kiva Confections'`, `'Lowell Farms'`, `'Raw
Garden'`, `'Papa & Barkley'`) — same strings, no new ones. **There is no 17th brand string
anywhere in the app.**

### 1.2 Which of the 16 already matched, and which did not

Measured live, `normalizeBrand(appBrand)` against all 56,938 rows, **before** this change:

| # | App brand | `normalizeBrand()` | live rows | verdict |
|---|---|---|---|---|
| 1 | STIIIZY | `stiiizy` | 2,387 | exact match |
| 2 | Jeeter | `jeeter` | 1,121 | exact match |
| 3 | Camino | `camino` | 631 | exact match |
| 4 | Raw Garden | `rawgarden` | 186 | exact match |
| 5 | 710 Labs | `710labs` | 109 | exact match |
| 6 | Heavy Hitters | `heavyhitters` | 108 | exact match |
| 7 | Alien Labs | `alienlabs` | 82 | exact match |
| 8 | Papa & Barkley | `papa&barkley` | 71 | exact match |
| 9 | Wyld | `wyld` | 22 | exact match |
| 10 | **Connected** | `connected` | **2** | **partial — 118 more exist under other spellings** |
| 11 | **Kiva Confections** | `kivaconfections` | **0** | **missed — 152 exist under `kiva`** |
| 12 | **Lowell Farms** | `lowellfarms` | **0** | **missed — 3 exist under `lowellherbco.`** |
| 13 | **Pax Labs** | `paxlabs` | **0** | **missed — 32 exist under `pax` / `pax®`** |
| 14 | **Select** | `select` | **0** | **missed — 2 exist under `selectoil`** |
| 15 | Cann | `cann` | 0 | genuinely absent from the live data |
| 16 | Cookies | `cookies` | 0 | genuinely absent from the live data |

Rows 11–14 are new findings beyond the three §1.7 already named. Rows 15–16 are **not** spelling
problems and are excluded — see §4.

---

## 2. The shipped alias table

Added to `pos/pricing-shared.jsx` immediately above `normalizeBrand()`, exported on
`window.HW_PRICING.BRAND_ALIASES` so it is inspectable from the console.

```js
const BRAND_ALIASES = {
  'kivaconfections':      'kiva',
  'lowellherbco.':        'lowellfarms',
  'connectedcannabisco.': 'connected',
  'connectedcannabis':    'connected',
  'paxlabs':              'pax',
  'pax®':                 'pax',
  'selectoil':            'select'
};

function normalizeBrand(brand) {
  const b = String(brand || '').toLowerCase().trim().replace(/\s+/g, '');
  if (!b) { return null; }
  return BRAND_ALIASES[b] || b;
}
```

7 entries, 5 canonical families. Everything else — all 701 other live keys — is untouched.

---

## 3. Per-entry evidence

Confidence is stated per entry. Everything in this section is in the **"high confidence, shipped"**
bucket; §5 holds everything that did not clear that bar.

### 3.1 `kivaconfections` → `kiva` — HIGH CONFIDENCE

| | |
|---|---|
| live rows under `kiva` | **152**, across **21 distinct stores**, 5 sources |
| raw spellings | `Kiva` , `KIVA` |
| categories | 100% edibles (`Edibles` 123, `edibles` 28, `edible` 1) |
| live rows under `kivaconfections` | **0** |

Sample product names on the scraper side:

```
x18  KIVA - SOLVENTLESS CHOCOLATE - SEA SALT CARAMEL X TERRA BITES - 100MG
x16  KIVA - CBN CHOCOLATE - DARK CHOCOLATE MIDNIGHT MINT - 140MG
x16  KIVA - SOLVENTLESS CHOCOLATE - BLUEBERRIES X TERRA BITES - 100MG
x1   LOST FARM VANILLA LATTE ROSIN CHEW - 100 mg - 10 Pack
x1   LOST FARM WHITE PEACH CBG GUMMY - 100 mg - 10 Pack
```

**Why this is the same company, independently checkable:** "Kiva" is the trading name; "Kiva
Confections" is the full company name. The product lines named in the scraper rows are Kiva
Confections' own: **Terra Bites** (its chocolate-covered bite line) and **Lost Farm** (its
live-rosin gummy/chew line). Neither is a line any other company sells. Cross-check on this
app's side: `pos/data.jsx` carries `B.kiva` products including *"Midnight Mint Gummies"* at
100mg, and the live data has *"DARK CHOCOLATE MIDNIGHT MINT - 140MG"* under `kiva` — the same
named product family. Weight distribution is 100% milligram-dosed edibles on both sides, which is
what Kiva Confections actually sells.

### 3.2 `lowellherbco.` → `lowellfarms` — HIGH CONFIDENCE (but low volume)

| | |
|---|---|
| live rows under `lowellherbco.` | **3**, 1 store (`cornerstone_wellness`) |
| raw spelling | `Lowell Herb Co.` |
| categories | 100% `pre-rolls` |
| live rows under `lowellfarms` | **0** |

```
AFTERNOON DELIGHT 35S 10PK
MIND SAFARI 35S 10PK
DREAMWEAVER 35S 10PK
```

**Why this is the same company:** Lowell Farms, Inc. is the current name of the company that
traded as **Lowell Herb Co.** before the rename; the older name is still what several menus carry.
The three product names are Lowell's own **"35s"** line — its 0.35g pre-roll 10-packs — and
*Afternoon Delight*, *Mind Safari* and *Dreamweaver* are Lowell's own named blends for that line,
not strain names shared with other producers. `lowellherbco.` is the **only** key in the entire
706-key live universe containing the substring `lowell`, so there is no second Lowell to confuse
it with.

### 3.3 `connectedcannabisco.` → `connected` and `connectedcannabis` → `connected` — HIGH CONFIDENCE

| key | rows | stores | source | raw spelling |
|---|---|---|---|---|
| `connectedcannabisco.` | **115** | 47 | leafly | `Connected Cannabis Co.` |
| `connectedcannabis` | **3** | 1 | cornerstone_wellness | `Connected Cannabis` |
| `connected` *(already matched)* | **2** | 2 | catalyst_cannabis, maryalice_dispensary | `CONNECTED` |
| **total after alias** | **120** | **49** | | |

Sample product names, `connectedcannabisco.`:

```
x8  JUICI 3.5G          x7  Chrome 3.5G        x7  Toad Venom [I] - 3.5G Prepack
x4  Biscotti 3.5G       x4  Gushers 3.5G       x4  Bluephoria 3.5G
x3  Gascotti 3.5G       x2  Gelato 41 | Indoor Flower | 3.5g
x2  Connected - Silver Spoon - Flower 1g (BiG Sativa Flower Judge Kit 12 of 17)
```

`connectedcannabis` (Cornerstone): `GASCOTTI`, `BISCOTTI`, `SKYWALKER OG COLD CHAIN CART`.
`connected` (already matching): `CONNECTED - Flower - Permanent Marker - 3.5G`.

**Why this is the same company:** *Biscotti*, *Gushers*, *Gelato 41*, *Gascotti*, *Chrome*,
*Toad Venom*, *Permanent Marker* and *Bluephoria* are Connected Cannabis Co.'s own signature
genetics — they run through all three spellings, which is the strongest available evidence that
the three keys describe one catalogue. Two rows literally spell the brand inside the product name
(`Connected - Silver Spoon - …`, `Connected - Gascotti - …`). `SKYWALKER OG COLD CHAIN CART` names
**Cold Chain**, which is Connected's own cartridge line. Category profile is consistent across all
three: overwhelmingly flower, with a small vape tail.

### 3.4 `paxlabs` → `pax` and `pax®` → `pax` — HIGH CONFIDENCE

| key | rows | stores | source | raw spelling |
|---|---|---|---|---|
| `pax®` | **18** | 6 | leafly | `PAX®` |
| `pax` | **14** | 4 | catalyst, cornerstone, artist tree | `PAX` |
| `paxlabs` | 0 | — | — | — |
| **total after alias** | **32** | **10** | | |

```
pax   : Greenstone Era Go Battery · Black Era Go Battery · PAX FOUR Vaporizer Aurora Burst
        PAX 4 · CALIFORNIA ORANGE LIVE ROSIN WITH DIAMONDS POD · PINEAPPLE WHIP HIGH PURITY ALL IN ONE
pax®  : PAX Diamond Pod 1g Watermelon Z · PAX Diamond Pod 1g Durban Poison
        FORBIDDEN FRUIT - HIGH PURITY POD - 1 g · BLUE ZUSHI HIGH PURITY
```

**Why this is the same company:** PAX Labs, Inc. is the legal entity; the products are branded
**PAX**. The two live keys differ only by a registered-trademark symbol and list the identical
catalogue — **Era Go** batteries, **PAX 4** vaporizers, **High Purity** pods and **Live Rosin with
Diamonds** pods are all PAX's own hardware and pod lines. `pax®` → `pax` is a scraper-side merge
of two spellings of one word; `paxlabs` → `pax` is the corporate-suffix variant this app happens
to use. No unrelated company in the 706-key universe normalizes to `pax`.

### 3.5 `selectoil` → `select` — HIGH CONFIDENCE on identity, negligible practical value today

| | |
|---|---|
| live rows under `selectoil` | **2**, 1 store, source `leafly`, raw `Select Oil` |
| live rows under `select` | **0** |

```
Select | 2g BRIQ Legacy Series AIO | Super Boof
Select | 2g BRIQ Legacy Series AIO | Amnesia Haze
```

**Why this is the same company:** the brand (Curaleaf's) launched and still lists on some menus as
**Select Oil**; the product names themselves start with the current name, `Select | …`, and
**BRIQ** is Select's own all-in-one device line. This is as close to self-evident as the dataset
gets — the row's own product text names the canonical brand.

**Honesty note:** 2 rows at 1 store can never clear the `>= 2 distinct competitors` gate, so this
entry changes **no number on any screen today**. It is shipped because the identity is certain and
the entry costs one line; it earns its keep only if a second store starts listing Select.

---

## 4. Collision audit

This is the section that must not be skipped, so it is exhaustive.

### 4.1 No two app brands resolve to the same canonical

Checked mechanically over all 16 app brand strings after aliasing: the 16 map to 16 distinct
canonical keys. In particular:

- **`kiva` is claimed only by Kiva Confections.** This is the one that needed care: **Camino is a
  Kiva Confections sub-brand**, and `camino` is a live key with **631 rows** — 4× Kiva's own. But
  this app's brand database models **Camino as its own separate brand** (`shared/brands.js`
  `{ key:'camino', name:'Camino' }`, its own `posCats`), and the scraper does too — the 631 Camino
  rows never say "Kiva". **They are deliberately NOT merged.** Merging them would make the Kiva
  Confections shell and the Camino shell match the same 783 rows and report the same "market
  price" for a chocolate bar and a gummy. Verified after the change: `kiva` 152, `camino` 631,
  still separate.
- `pax`, `select`, `connected`, `lowellfarms` each have exactly one app-side claimant.

### 4.2 No canonical is itself an alias key (no chaining)

The lookup is single-pass and deliberately does not follow chains, because a chain would make the
canonical depend on evaluation order. Verified programmatically: of the 5 canonicals
(`kiva`, `lowellfarms`, `connected`, `pax`, `select`), **none appears on the left-hand side**. This
invariant is stated in the code comment; anyone adding an entry must re-check it.

### 4.3 Different real companies with similar-looking names — all excluded

This is the `raw` / `rawgarden` shape of trap. Every one found:

| live key | rows | what it really is | verdict |
|---|---|---|---|
| `raw` | **6** | **RAW rolling papers (HBI International).** Products: `Raw Cones 6 Pack`, `Raw Rolling Papers - Black (1 1/4)`, `Raw Classic 1 1/4 Rolling Papers`, `RAW \| Organic Hemp Papers 1 1/4`. Categories `MERCH` / `Accessory`. | **Never merged with `rawgarden`.** Different company, different industry. A prefix rule would have merged them. Verified after the change: `raw` still 6, `rawgarden` still 186. |
| `rawhempwick`, `rawrawcones` | 1 each | also RAW papers (`Hemp Wick [10ft]`, `Classic Cones 1 1/4 [6pk]`, both `Gear`) | excluded — and note a prefix rule would have swept these into `rawgarden` too |
| `sunsetconnectfulton5'erpreroll` | 1 | **Sunset Connect**, an unrelated producer sharing only the word "connect" | **excluded** from the Connected family |
| `cannabiotix` (593), `hicanna` (3), `urbancanna` (18), `solcanna` (1), and 36 other `*cann*` keys | — | unrelated companies whose names merely contain "cann" | excluded; see §4.5 |
| `papa'sherb` | 4 | unrelated to Papa & Barkley | excluded |
| `bearlabs`, `britelabs`, `pabstlabs`, `greendotlabs`, `madlabs`, `maddlabs`, `e10labs`, `dblabs`, `rosintechlabs`, `cultivationlabs` | 1–35 each | unrelated companies ending in "Labs" | excluded — the `…labs` suffix carries no identity |

### 4.4 The "brand field contains the product line" artifact class — excluded wholesale

A minority of source adapters write `<brand> <product line>` into the `brand` column. This produces
keys such as `stiiizybattery` (17), `heavyhittersgummies(rcs)` (6), `caminogummies` (15),
`wyldgummies` (11), `jeeterliquiddiamondallinone` (2), `alienlabsindoor` (1),
`rawgarden™livebadder` (6), `paxliverosinwithdiamondspod` (2),
`connectedcannabiscopreroll` (1). There are ~60 of them.

**All excluded from this table**, deliberately and as a class:

1. Absorbing them is a prefix rule wearing a disguise, and §4.3 shows the prefix rule is exactly
   what the data punishes (`rawhempwick` starts with `raw`, not `rawgarden`).
2. Each one is a different judgement call about where the brand ends and the product begins.
   Sixty judgement calls is not an auditable table.
3. Their volume is small (1–17 rows each) relative to the risk.

They remain a legitimate follow-up, but as **their own** piece of work with their own audit — the
same reason §1.7 kept this table out of the aggregation change.

### 4.5 Brands genuinely absent from the live data — excluded, and not a spelling problem

- **Cann** (`cann`). The app's Cann is the hemp-derived social-tonic beverage. Nothing in the live
  data is that company. The 40 live keys containing the substring `cann` were each read: they are
  `Cannabiotix`, `Mohave Cannabis Co.`, `Anthem Cannabis`, `Urban Canna`, `Hi Canna`, `Sol Canna`
  and so on — all unrelated companies whose names contain the word "cannabis" or "canna". **No
  alias exists to write.** The Cann shell's zero is honest and must stay zero.
- **Cookies** (`cookies`). **Zero** live keys contain the substring `cookie`. The brand is simply
  not in the tracked-store data. Same verdict.

Recording these two explicitly matters: without this note the next agent re-derives the same
search and reaches the same dead end.

---

## 5. Candidates found but deliberately NOT shipped

Nothing here is in the table. Each is recorded with why, so it is not re-discovered and re-dropped.

### 5.1 `rawgarden™` → `rawgarden` — high confidence, but out of scope by constraint

`rawgarden™` (8 rows, raw `Raw Garden™`) is unambiguously the same company as `rawgarden`
(186 rows) — the trademark symbol is the only difference. Design doc §1.7 already flagged it.

**Not shipped**, because the acceptance constraint for this change is that it must be *additive*:
it may not alter a match that already worked. Raw Garden already matches, and folding in 8 more
rows would move the Raw Garden shell's average, low and high. That is a legitimate improvement but
it is a **different, verifiable-in-its-own-right** change, and mixing it in would have made "no
other shell's numbers changed" untestable. Its `rawgarden™live*` siblings (16 more rows) fall under
§4.4 as well.

**Recommendation for a follow-up pass:** ship `rawgarden™` → `rawgarden` on its own, with a
before/after on the Raw Garden shell's three numbers.

### 5.2 Nothing is in a "plausible but needs a human" bucket

Every candidate that was examined either cleared the evidence bar in §3 or was excluded for a
stated, checkable reason in §4/§5.1. **There is no entry in this table that a reviewer is being
asked to take on trust.**

---

## 6. Design decisions, and why

### 6.1 Canonical resolution on BOTH sides, not an app→scraper lookup

The brief asked whether the table should be keyed by the app's brand string, or resolve both sides
to one canonical key. **Both sides, canonical.** Three reasons, in order of weight:

1. **Robustness against a third spelling — the deciding reason.** Connected already has *three*
   live spellings plus the app's. An `{ appBrand: scraperBrand }` map is 1:1 and can only point the
   app at one of them; the other two stay orphaned, and the two orphans still fail to match *each
   other* on the Pricing screen. A variant→canonical map handles N spellings with N−1 rows and a
   fourth spelling costs exactly one more line. This is not hypothetical: it is the shape of the
   largest entry in the table today.
2. **It is genuinely one mechanism.** Placed inside `normalizeBrand()`, `groupKey()` and
   `shellIdentityKey()` both inherit it with **zero call-site change**, as does the Pricing screen's
   Brand filter (`screen-pricing.jsx:456`) and the shell store list
   (`product-shell.jsx:295, 333, 385`). Building an app-keyed lookup would have meant a second
   mechanism at the shell call site and nothing at all for listing-vs-listing matching — which is
   where `pax®` vs `pax` and the three Connected spellings actually live.
3. **Neither side is authoritative.** The app's `Pax Labs` is not more correct than the scraper's
   `PAX`; they are two names for one company. A map with a privileged side encodes a claim the data
   does not support.

### 6.2 Canonical = the plain marketing name, never the longest form

`coreWords()` (`pricing-shared.jsx:107`) strips the **canonical key's characters** out of the
product name using a whitespace-flexible regex, so the brand's own words do not end up inside the
matching name-core. That makes the choice of canonical load-bearing rather than cosmetic:

- canonical `connected` → the regex matches the literal word *"Connected"* in
  `Connected - Silver Spoon - Flower 1g` and strips it. Correct.
- canonical `connectedcannabisco.` → the regex matches nothing in that text, and the word
  "Connected" stays in the name core, silently degrading `groupKey()`.

Same for `pax` (matches *"PAX Diamond Pod 1g"*) vs `paxlabs` (matches nothing), and `kiva`
(matches *"KIVA - SOLVENTLESS CHOCOLATE"*) vs `kivaconfections` (matches nothing). So the rule is:
**the canonical is the short marketing name that actually appears in listing text.** For
`lowellfarms` neither form appears in the product text (the three rows carry no brand words at
all), so the current company name was used.

A second, smaller benefit: no canonical contains a regex-special or exotic character. `pax®` is a
key, never a canonical.

### 6.3 Placed after the existing normalization, never instead of it

`normalizeBrand()` still does its lowercase / trim / whitespace-strip first, unchanged, and only
then consults the table. The 701 live keys not in the table behave exactly as before — verified,
not assumed (§7.3). The alias is a fallback for the residue that case-and-space folding cannot
reach, which is precisely the scope §1.7 defined.

### 6.4 `normalizeBrandSpaced()` is untouched

It is the human-readable form, used for labels (`screen-pricing.jsx:459`,
`product-shell.jsx:210, 301, 453`). Labels must show what a store actually wrote, not a matching
key. The Brand filter merges its *entries* by `normalizeBrand()` (so the three Connected spellings
now collapse into one filter row) while still labelling that row with a real spaced spelling —
which is the behaviour that dropdown's own comment at `:461-467` already describes.

---

## 7. Verification — measured, live, before and after

Two independent runs of the same assertions: a Node harness loading the real source files against
the 56,938-row snapshot, and the **running app in Chrome** (`http://127.0.0.1:8794`, a fresh port —
8790 was held by a stale server from a previous session, the known cache quirk). **Both produced
identical numbers.**

### 7.1 Brand-level reach — the change

| App brand | canonical | rows BEFORE | rows AFTER | delta |
|---|---|---|---|---|
| Kiva Confections | `kiva` | 0 | **152** | **+152** |
| Connected | `connected` | 2 | **120** | **+118** |
| Pax Labs | `pax` | 0 | **32** | **+32** |
| Lowell Farms | `lowellfarms` | 0 | **3** | **+3** |
| Select | `select` | 0 | **2** | **+2** |
| | | | | **+307 rows** |

Every other app brand: unchanged (STIIIZY 2,387 · Jeeter 1,121 · Camino 631 · Raw Garden 186 ·
710 Labs 109 · Heavy Hitters 108 · Alien Labs 82 · Papa & Barkley 71 · Wyld 22 · Cann 0 ·
Cookies 0).

### 7.2 The 12-shell table — byte-identical, and why that is the correct outcome

| # | Brand | cat | weight | rows | stores | prod | avg | low | high | state |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Jeeter | Pre-Rolls | 1g | 383 | 66 | 80 | $18.94 | $11.40 | $19.99 | aggregate |
| 2 | Lowell Farms | Flower | 1g | 0 | 0 | 0 | — | — | — | zero |
| 3 | Cann | Wellness | 12g | 0 | 0 | 0 | — | — | — | zero |
| 4 | Connected | Flower | 20g | 0 | 0 | 0 | — | — | — | zero |
| 5 | Wyld | Edibles | 10mg | 0 | 0 | 0 | — | — | — | zero |
| 6 | STIIIZY | Vapes | 1g | 812 | 86 | 81 | $29.74 | $16.10 | $45.00 | aggregate |
| 7 | Alien Labs | Flower | 3.5g | 39 | 17 | 23 | $58.02 | $27.32 | $69.00 | aggregate |
| 8 | Raw Garden | Concentrates | 1g | 46 | 16 | 30 | $24.80 | $13.99 | $35.00 | aggregate |
| 9 | 710 Labs | Concentrates | 1g | 2 | 1 | 2 | — | — | — | solo |
| 10 | Kiva Confections | Edibles | 4g | 0 | 0 | 0 | — | — | — | zero |
| 11 | Papa & Barkley | Wellness | 4g | 0 | 0 | 0 | — | — | — | zero |
| 12 | Heavy Hitters | Vapes | 1g | 17 | 11 | 13 | $52.85 | $20.00 | $82.00 | aggregate |

**Identical to §1.8, before and after.** The 6-aggregate / 1-solo / 5-zero split is preserved.

**This includes the three shells the alias was written for, and that needs saying plainly.** The
brand-string mismatch was real and is now fixed — but it was never the *only* thing blocking those
three shells. `shellIdentityKey()` requires brand **and** size **and** category. Measured weight ×
bucket distribution for the newly-reachable rows:

```
Kiva family      (152 rows) : 100mg/edibles 110 · 140mg/edibles 16 · 10mg/edibles 3 · 5mg/edibles 2
                              · 20pk/edibles 1 · no-weight 20        →  NO 4g rows at all
Connected family (120 rows) : 3.5g/flower 72 · 14g/flower 7 · 10g/flower 7 · 1g/vape 5
                              · 1g/flower 4 · 7g/flower 2 · no-weight 21  →  NO 20g rows at all
Lowell family    (3 rows)   : 10pk/preroll 3                          →  NO 1g flower rows at all
```

The seeded shells carry `Kiva Confections · Edibles · 4g`, `Connected · Flower · 20g` and
`Lowell Farms · Flower · 1g`. Those sizes **do not exist in the live data for those brands** —
`4g` and `20g` come from `pos/data.jsx`'s demo `wt` fields (`'4g'` on *Lunar Drift Indica Drops*,
`'20g'` on *Product Willy*), which are not real retail sizes for a chocolate bar or a flower jar.
So those three shells' zeros were **over-determined**: brand mismatch *and* size mismatch. This
change removes one of the two causes. **Their remaining zero is now honest** — it correctly says
"no tracked store lists Kiva Confections at 4g", which is true — where before it said zero for a
reason that was a bug.

### 7.3 End-to-end proof the alias reaches the shell matcher

Constructed shells at sizes these brands genuinely carry, run through the real
`shellIdentityKey()` + `listingMatchesShell()` + `computeAvgFullAcross()` + `computeExtremesAcross()`
in the running app:

| probe shell | key | rows BEFORE | rows AFTER | stores | avg | low–high |
|---|---|---|---|---|---|---|
| Connected · Flower · 3.5g | `connected` | **0** | **72** | 29 | **$61.42** | $35.00–$75.00 |
| Connected · Flower · 14g | `connected` | **0** | **7** | 4 | $126.00 | $88.20–$88.20 |
| Kiva Confections · Edibles · 100mg | `kiva` | **0** | **110** | 19 | — ¹ | — ¹ |
| Pax Labs · Vapes · 1g | `pax` | **0** | **5** | 2 | **$28.32** | $19.60–$28.64 |
| Lowell Farms · Pre-Rolls · 10ct | `lowellfarms` | **0** | **3** | 1 | — (solo) | — |
| Select · Vapes · 2g | `select` | **0** | **2** | 1 | — (solo) | — |
| *control:* Raw Garden · Concentrates · 1g | `rawgarden` | 46 | **46** | 16 | $24.80 | $13.99–$35.00 |
| *control:* Alien Labs · Flower · 3.5g | `alienlabs` | 39 | **39** | 17 | $58.02 | $27.32–$69.00 |

¹ The Kiva 100mg probe matches 110 rows across 19 stores but still reports no average or range.
That is **not** an alias defect and is unchanged behaviour: 123 of the 152 `kiva` rows carry
`price_tax_basis: 'inclusive'` with **no** researched `pre_tax_price`, and 27 carry
`'unknown'`. `comparableFullPrice()` and `effectivePreTax()` return `null` for those by design
rather than mixing tax-in and tax-out figures, so fewer than 2 competitors remain comparable and
the `>= 2` gate correctly withholds a number. The alias made 110 real listings *visible*; the tax
basis is a separate, pre-existing data gap on the scraper side.

### 7.4 Pricing screen — no regression, counts never went down

| metric | BEFORE | AFTER |
|---|---|---|
| total groups | 48,552 | **48,552** |
| multi-**source** groups | 96 | **96** |
| multi-**competitor** groups | 1,126 | **1,126** |
| Brand-filter entries | 706 | **703** |

The only movement is the Brand filter losing 3 rows, which is the intended merge and is arithmetic:
`connectedcannabisco.` and `connectedcannabis` fold into `connected` (−2), `pax®` folds into `pax`
(−1); `lowellherbco.`→`lowellfarms` and `selectoil`→`select` are renames of a single entry (0 each);
`kivaconfections` has no live rows so contributed no entry. **706 − 3 = 703.**

Per-family group census, before and after — **identical in every family**, so no group was split
and no group was wrongly merged:

```
family        rows   groups   multi-competitor groups
kiva          152    41       9      (unchanged)
connected     120    63       11     (unchanged)
pax            32    29       0      (unchanged)
lowellfarms     3     3       0      (unchanged)
select          2     2       0      (unchanged)
rawgarden     186   146       3      (unchanged)
raw             6     5       1      (unchanged)
camino        631    41       19     (unchanged)
```

### 7.5 No false merge

```
normalizeBrand('RAW')        -> 'raw'         ·  raw       :   6 rows  (unchanged)
normalizeBrand('Raw Garden') -> 'rawgarden'   ·  rawgarden : 186 rows  (unchanged)
                                                 camino    : 631 rows  (unchanged, NOT folded into kiva)
                                                 kiva      : 152 rows
```

### 7.6 Pre-existing behaviour preserved

- `shellIdentityKey({brand:'Pax Labs', cat:'Accessories', weight:'5ct'})` →
  `{brand:'pax', weight:'5pk', buckets:['other']}` — the `ct → pk` unit fold still applies (design
  doc V4).
- `weight: null` → `null`; `brand: ''` → `null` — both degrade states intact (V5).
- No new console errors in the running app.

---

## 8. Adding an entry later — the checklist

1. Confirm both keys exist in the live data and record **row count, store count and 3+ sample
   product names for each side**.
2. Prove same-company from something a human can check independently — a shared product **line**
   name, a documented former company name, the brand spelled inside the product text. String
   similarity alone is not evidence; §4.3 lists ten "…Labs" companies that are not each other.
3. Run the §4.1 check: does any other app brand already claim that canonical?
4. Run the §4.2 check: is the new canonical also a key? It must not be.
5. Search the live universe for a **different real company** with a similar name (the `raw` /
   `rawgarden` and `connect` / `Sunset Connect` shape). If genuinely ambiguous, **exclude and say
   so** rather than guess.
6. Pick the canonical by §6.2 — the short marketing name that appears in product text.
7. Re-run the §7.2 12-shell table and the §7.4 Pricing-screen counts. Anything that moves must be
   explained before the entry ships.
