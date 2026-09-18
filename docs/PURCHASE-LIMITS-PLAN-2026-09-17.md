# Purchase Limits Plan — legal daily limits in cart, checkout, admin, swaps, transfers and the register

Date: 2026-09-17. Author: research agent (read-only pass over law, vendors and code; no files other
than this one were created or changed). Status: **plan for owner decision** — nothing here is built.

How to read this: §0 is the one-page summary. §1 is the law with a citation on every line. §2 is
what the production code actually does today (file:line). §3 is the design for our platform. §4 is
the owner's questions and the list for counsel. Anything marked **UNVERIFIED** could not be pinned to
a primary source and must go to counsel before it is load-bearing.

---

## 0. Owner summary (one page, plain language)

**What the law says.** A licensed retailer may not sell one adult-use customer, in one day, more
than **28.5 g of non-concentrated cannabis, 8 g of cannabis concentrate (counting the concentrate
inside edibles, vapes and other products), and 6 immature plants**. A medical patient (18+, valid
physician's recommendation or county MMIC card) may buy up to **8 ounces (226.8 g) of dried flower
"or the plant conversion" and 12 immature plants**, and more than that only if their physician's
recommendation says a larger amount. The two sets of limits may not be combined. The retailer is
explicitly made responsible for working out how much concentrate is inside a manufactured product.
(4 CCR §15409, verified against the DCC's own July 2026 compilation, §1.1.)

**What the law does not say** — and what we must decide: what "a single day" is (calendar day or
24 hours), whether the count is per store, per licence or per person across all our licences, how
milligrams of THC in a gummy convert into grams of concentrate, whether medical patients have any
concentrate cap at all, and whether a same-day return gives allowance back. Every serious POS vendor
(Blaze, Treez, Dutchie) has picked a convention for these; none of them cites a DCC ruling. §1.4 and
§1.5 lay out the conventions and the conservative choice.

**What exists in code today.** The earlier audit was right about *our* two repos: nothing in
`POS-Admin` or `wm-demo` tracks a purchase limit (re-verified, §2.1). It was **wrong for the
production estate**: `stilo-backend` contains a complete, live purchase-limit feature (admin CRUD,
cart/POS checks, a per-day running total, and a storefront progress meter) — and it is **unsafe as
built**: it sorts products into the concentrate bucket by whether the category is *cannabis*, not
whether it is *concentrate*; its running total overwrites instead of adds; it counts one store only;
its day is UTC; the medical row can never match so medical is effectively unlimited; anyone 21 or
under is auto-tagged medical; and the order-placement path never re-checks (§2.2). The Hyperwolf
storefront has no limit code of its own because it sends every cart to Blaze, so today's real
protection is Blaze's "User Cannabis Limit" toggle plus Blaze product fields, which nobody has
confirmed are on and populated (§2.3). Separately, the Hyperwolf backend marks every new member's ID
*and* recommendation as `verified: true` at sign-up (§2.3, a compliance problem in its own right).

**What we build.** One server-side limits engine (a pure function over integer milligrams plus a
per-person daily ledger across every store, licence and channel), called at add-to-cart, checkout,
inside the placement transaction, on every admin edit, on every swap, on driver-to-driver transfer,
at the register tender, and at the door. Products carry an explicit compliance class and cannabis
amounts; a product with missing data cannot be sold (fail closed). Medical status is a server fact
derived from a verified, unexpired recommendation, stored with the minimum PII, encrypted, with
audited reveal. Legal values are versioned constants that staff cannot edit; only operational knobs
(warn-at %, hold TTL) are settings. No override can exceed the legal maximum — the only "override"
is the physician-documented larger amount, which itself is a legal path. (§3.)

**Decisions needed from you (§4):** six questions, each with four selectable options.

---

## 1. The law

Convention: each rule gives the primary source, its URL, the subsection, and at most one short quoted
phrase. LII (Cornell) mirrors of 4 CCR were cross-checked against the DCC's official compilation
"Medicinal & Adult Use Cannabis Regulations, July 2026" (regulations in effect as of 2026-07-01):
<https://cdn.cannabis.ca.gov/wp-content/uploads/sites/2/2026/08/dcc_regulations_20260701.pdf>.
Statutes were read on leginfo.legislature.ca.gov.

### 1.1 Adult-use daily limits (retailer obligation)

| Bucket | Limit per adult-use customer per "single day" | Source |
|---|---|---|
| Non-concentrated cannabis | **28.5 g** | 4 CCR §15409(a)(1) |
| Cannabis concentrate, "including cannabis concentrate contained in cannabis products" | **8 g** | 4 CCR §15409(a)(2) |
| Immature cannabis plants | **6** | 4 CCR §15409(a)(3) |

- 4 CCR §15409 — <https://www.law.cornell.edu/regulations/california/4-CCR-15409>; official text
  at pp. 104–105 of the July 2026 DCC compilation (identical wording). Authority: B&P §26013;
  reference B&P §26012, H&S §§11362.1, 11362.77. History: renumbered from 16 CCR §5409 on
  2021-07-14 (Register 2021, No. 29) "without regulatory effect"; no amendment since. **No 2024–2026
  change to the limit values** in either the LII mirror or the DCC July 2026 compilation.
- §15409(d): the adult-use and medical limits "shall not be combined" to exceed any limit.
- §15409(e): the retailer "shall be responsible for determining" the concentrate content of
  manufactured products it sells. This is the sentence that makes product data our problem.
- The personal possession mirror: H&S §11362.1(a)(1)–(3) — 28.5 g not-concentrated, 8 g
  concentrated "including as contained in cannabis products", six living plants —
  <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=11362.1>
  (Prop 64, amended SB 94 2017).
- **Definition of concentrate changed on 2026-01-01.** H&S §11006.5(b), as amended by AB 8
  (Stats. 2025, ch. 248, eff. 2026-01-01): from 2026-01-01 to 2028-01-01 "concentrated cannabis"
  means cannabis "that has undergone a process to concentrate one or more active cannabinoids" and
  expressly includes extracts, oils, **hash**, dab, shatter, rosin, wax and separated resin. From
  2028-01-01 the definition adds industrial hemp and excludes CBD isolate.
  <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=11006.5>.
  B&P §26001(j) points at H&S §11006.5 for "cannabis concentrate"
  (<https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=26001>;
  §26001 itself was last amended by SB 170, Stats. 2026 ch. 28, operative 2026-07-01 — counsel to
  confirm that amendment touched nothing limit-relevant; the fetched text of the definitions above
  is the post-SB 170 text). **Consequence:** kief/hash/bubble hash, which some vendors historically
  counted as flower, are concentrate as of 2026-01-01 (§1.4).

### 1.2 Medical daily limits, who qualifies, what we must verify

| Item | Rule | Source |
|---|---|---|
| Medical daily limit | **8 oz** "in the form of dried mature flowers or the plant conversion" + **12 immature plants**, per patient or per primary caregiver buying for that patient | 4 CCR §15409(b) |
| Physician exception | if the "valid physician's recommendation contains a different amount", the patient may buy "consistent with the patient's needs" as documented in it | 4 CCR §15409(c) |
| Possession mirror | 8 oz dried cannabis per qualified patient; 6 mature or 12 immature plants; only "dried mature processed flowers … or the plant conversion" count | H&S §11362.77(a),(d) — <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=11362.77> |
| Local may be higher | counties/cities "may retain or enact" guidelines allowing patients to exceed (a) | H&S §11362.77(c) |
| Who is a "customer" | 21+, or "18 years of age or older who possesses a physician's recommendation, or a primary caregiver" | B&P §26001(t) |
| Age gate, storefront | A-licensee may not sell to under-21; M-licensee may admit and sell to 18+ with valid ID and "either a valid county-issued identification card or a valid physician's recommendation"; at a dual A/M premises 21+ adults may also be present; DCC may set caregiver-verification rules | B&P §26140(a),(c) — <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=26140> |
| What the retailer must check | adult-use: age and identity via ID in (c); medical: "age, identity, and physician's recommendation"; acceptable ID = government-issued document with name, DOB, height, gender, photo (e.g. driver's licence), Armed Forces ID, or passport | 4 CCR §15404(a)–(c) — <https://www.law.cornell.edu/regulations/california/4-CCR-15404> |
| Recommendation must be compliant | since 2018-01-01 a qualified patient "must possess a physician's recommendation that complies with" B&P Art. 25 (§2525 et seq.); MMIC cards issued after that date must be supported by one | H&S §11362.712 — <https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=11362.712> |
| MMIC vs recommendation | "Medicinal cannabis patient" = a qualified patient (recommendation, no card) **or** a person holding a valid §11362.71 identification card; the card is voluntary and state-verifiable | 4 CCR §15000(rr); H&S §11362.7(f),(g); §11362.71(a),(f) |
| Primary caregiver | person designated by the patient who "has consistently assumed responsibility for the housing, health, or safety" of them; 18+ (parent exception); may serve multiple patients only in the same city/county; the limit in §15409(b) is per **patient** | H&S §11362.7(d); 4 CCR §15409(b) |
| Verification standard the DCC has actually written down | for **free** medicinal goods the retailer must (i) verify the physician's licence with the Medical Board / Osteopathic Board / Podiatric Board, (ii) keep a copy of the patient's government ID, (iii) keep a written certification of the verification (date, time, employee, board, method, person spoken to), and (B) re-verify **at least annually** while the recommendation is valid; (C) never if the recommendation has expired | 4 CCR §15411(b)(1)(A)–(C) (DCC compilation pp. 106–107); B&P §26071(a)(2) |

**Reading for our design (not a legal conclusion):** §15404(b) only says "confirm … physician's
recommendation"; the *procedure* in §15411(b)(1) is formally for free goods, but it is the only
DCC-written procedure for verifying a recommendation and is what a conservative operator applies to
every medical designation. Recommendation validity period is set by the physician (typically one
year); B&P §2525.x formalities (physician licence, attestation) — **UNVERIFIED** details, counsel.
Sales-tax exemption for MMIC holders (Rev. & Tax. Code §34011/§6414) is a separate topic already in
`wm-demo/wmdemo/tax.py` (`member_type` rates) and is **not** the same fact as "medical limits apply".

### 1.3 Which products count against which bucket

Primary sources only fix three buckets: non-concentrated cannabis (§15409(a)(1)), cannabis
concentrate "including cannabis concentrate contained in cannabis products" (§15409(a)(2),
H&S §11362.1(a)(2), H&S §11006.5), immature plants (§15409(a)(3), §15408). Nothing in statute or
regulation says how many grams of concentrate are "in" a 100 mg gummy. The DCC has published no
conversion table (searched cannabis.ca.gov and the July 2026 compilation: none). Everything in the
"how counted" column below that is not a bare weight of flower or extract is **vendor convention**,
marked as such.

| Product type | Bucket | How counted | Basis |
|---|---|---|---|
| Flower, shake, non-infused pre-rolls | non-concentrated | net cannabis weight in g | §15409(a)(1); Blaze and Treez both count "grams" (Treez: pre-roll "Contributes to non-concentrated limit") |
| Infused pre-rolls | **split** — flower g to 28.5 g **and** concentrate g to 8 g (our recommendation); Treez counts the whole item by "milligrams of THC (from both flower and concentrate)" against **concentrate**; Treez separately notes that once infused "the entire weight … is considered a concentrate" for their field entry | needs both `flower_mg` and `concentrate_mg` per SKU | §15409(a)(2) "contained in"; Treez CA compliance guide and CA purchase-limits article (vendor) |
| Vape cartridges, disposables, extracts, live resin, rosin, wax, shatter, **hash, kief** (post-2026-01-01) | concentrate | net extract weight in g (a 1 g cart = 1 g) | H&S §11006.5(b); Treez "grams of extract" |
| Edibles, beverages, tinctures, capsules/pills, orally-dissolving | concentrate | **convention:** total THC mg ÷ 1000 = concentrate g (a 100 mg package = 0.1 g; 80 packages = 8 g) | Treez: "milligrams of THC … contribute to concentrate limit"; Blaze requires "Total THC (mg)" and states California "doesn't use an equivalency calculation" — products count "according to the amount of cannabis or THC in the product" (vendor) |
| Topicals, transdermals | concentrate (conservative) | THC mg ÷ 1000 | Treez counts topicals; some operators exempt topicals — **UNVERIFIED**, counsel |
| Immature plants | plants | count; must be non-flowering, "shorter and narrower than 18 inches", from a licensed nursery | 4 CCR §15408(a)(1)–(2) |
| Seeds | **no daily-limit bucket found** in §15409 or H&S §11362.1 | not counted (record only) | absence of a rule — **UNVERIFIED**, counsel |
| Accessories, non-cannabis goods, CBD isolate (2028+) | none | not counted | §15407; H&S §11006.5(c)(2) |

**The per-package potency caps are product rules, not purchase-limit rules**, and belong in catalog
validation, not the limits engine: edibles ≤ 10 mg THC per serving and ≤ 100 mg per package; medical
orally-dissolving up to 500 mg (10 mg pieces, "FOR MEDICAL USE ONLY", medical-only sale); topicals and
concentrates ≤ 1,000 mg per package, medical-only up to 2,000 mg — 4 CCR §17304(a)–(d),
<https://www.law.cornell.edu/regulations/california/4-CCR-17304>. A 2,000 mg medical concentrate
package is (by the §1.4 convention) 2 g of the 8 g bucket, and it is illegal to sell to an adult-use
customer at all — the catalog must carry a `medical_only` flag, and the engine must refuse it for a
non-medical identity regardless of remaining allowance.

**Where the guidance is genuinely ambiguous (for counsel, §4.2):** (a) THC-mg-to-concentrate-gram
conversion has no primary source; (b) whether concentrate *net weight* or *THC content* is the
measure for manufactured products — §15409(e) says "amount of cannabis concentrates found in", which
reads as weight of extract, while every vendor uses THC mg because that is what the label carries;
(c) topicals; (d) medical concentrate cap — §15409(b) has **no concentrate line**, and Treez's guide
records that the regulator "hasn't clarified if patients have a concentrate limit or what it is";
(e) what "the plant conversion" in H&S §11362.77(d) means for a medical patient buying concentrate;
(f) whether kief was ever non-concentrated (Treez still lists it under non-concentrated; after AB 8
it is squarely concentrate).

### 1.4 What Blaze, Treez, Dutchie and Metrc actually do (vendor documentation, not law)

- **Blaze** (our current POS): limits are a company-level switch, Global Settings → Company Settings
  → Company Info → "User Cannabis Limit"; each product needs **Cannabis Type**, **Potency (Total THC
  mg and/or Total CBD mg)** and **Weight Per Unit**; a member's consumption appears under Members →
  Cannabis Limits tab, shown differently for Medical vs Recreational. Blaze's own California page:
  adult-use 28.5 g / 8 g / 6 plants; medical "8 ounces of dried cannabis, and 6 mature or 12
  immature" per day; "Physicians may recommend different amounts". No equivalency table is published.
  <https://support.blaze.me/hc/en-us/articles/retail-how-do-i-enable-purchase-limits>,
  <https://support.blaze.me/hc/en-us/articles/retail-purchase-limits-for-medical-and-recreational-cannabis-by-state>.
  Blaze member `consumerType` values seen in our code: `AdultUse`, `MedicinalThirdParty` (physician
  rec) — and Blaze also has `MedicinalState` (MMIC) (**UNVERIFIED** from public docs; observed in
  API usage only). Whether the toggle is **on** for Hyperwolf and whether products carry the three
  fields is unknown — owner action in §2.3.
- **Treez** (CA compliance guide, <https://support.treez.io/en/articles/9129328-treezsupport-california-cannabis-compliance-guide>;
  CA purchase limits, <https://support.treez.io/en/articles/9129364-california-purchase-limits>):
  flower/pre-roll/kief by grams → non-concentrated; cartridge/extract by grams of extract →
  concentrate; infused pre-roll, edibles, beverages, topicals, tinctures, pills by **mg THC** →
  concentrate; plants by count; medical 8 oz + 12 plants and "may purchase edibles with over 100
  milligrams"; no medical concentrate cap because the regulator never clarified one.
- **Dutchie**: California is a "hybrid purchase limit" state without flower-equivalency; products can
  be configured to count against multiple categories (search-result summary of
  <https://support.dutchie.com/hc/en-us/articles/29627962471443-Multicategory-flower-equivalencies-for-hybrid-purchase-limits-in-Dutchie-POS>;
  the article itself returned 403 — **secondary**).
- **Metrc (CCTT)**: records sales receipts with a customer type (consumer / patient / caregiver) and
  the delivery inventory ledger (DCC CannaConnect page, §1.6); it is a reporting system and does
  **not** reject a receipt for exceeding §15409 — **UNVERIFIED** as a Metrc-CA behaviour, but
  consistent with every vendor building their own enforcement. Alignment in §3.9.

### 1.5 "Per day", per whom, and what re-opens allowance

- **"A single day" is not defined.** 4 CCR §15000 defines "delivery employee" (s) and "medicinal
  cannabis patient" (rr) but not "day", "business day" or "calendar day"; B&P §26001 has no "day".
  The DCC's delivery record-keeping page uses "calendar day" for the CCTT ledger deadline. Vendors
  implement a calendar day in local time. **Decision:** store-local calendar day
  (America/Los_Angeles for every Hyperwolf licence) — Q1 in §4.1. Rolling-24h is stricter and is
  offered as an option.
- **Per retailer vs per person.** The obligation is on "a licensed retailer" not to sell more than X
  "to a single … customer in a single day" (§15409(a),(b)); the possession cap is on the person
  (H&S §11362.1). The regulation does not say "across all retailers", and no retailer can see
  another company's sales. **Within one company holding several licences** the conservative and
  defensible reading is that the same natural person's purchases at *any* of our licences and
  channels (storefront, delivery, pickup, Weedmaps) count together — that is what we can see and what
  an auditor comparing our own Metrc receipts across licences would see. Q2.
- **Multiple orders in one day** all count; delivery and in-store combine (same person, same day).
- **Returns / voids / swaps.** §15410 lets a retailer accept returns and forbids resale of returned
  goods (§15410(c)); it says nothing about allowance. A *void* before handover (order never left the
  premises / never tendered) plainly never was a sale. A completed sale later *returned* is
  ambiguous; conservative operators do not re-open allowance on the same day. A *swap* is a new
  basket: the outgoing item's amount is released **only** if it never left the customer's hands
  (kit swap at the door, pre-dispatch edit); otherwise the incoming item is checked against the
  full day. Q6 and §3.4.
- **Free goods and promos.** A licensee "shall not give away any amount of cannabis … as part of a
  business promotion" (B&P §26153(a)); retailers "shall not provide free cannabis goods to any
  person" except compassionate medicinal donations (4 CCR §15411(a),(b)). Compassionate donations
  (SB 34, B&P §26071; 4 CCR §15411(b)(4)) **count toward the medical daily limit** and possession
  limits, must be designated for donation in track-and-trace, receipted as donated, and cannot exceed
  H&S §11362.77 amounts (B&P §26071(a)(6)). Consequence for us: a "free" or $0.01 promo unit is
  still a sale of cannabis and counts; a true SB 34 donation counts and needs the §15411 paperwork.
  Trade samples between licensees (B&P §26153.1) never reach a customer.
- **Caregiver purchases** count against the *patient's* day; a caregiver with two patients has two
  ledgers and must name the patient on each order (§15409(b); H&S §11362.7(d)).

### 1.6 Delivery-specific rules

| Rule | Source |
|---|---|
| Vehicle may carry cannabis goods worth at most **$10,000** at any time, valued at "current retail price"; the older $5,000/$3,000 ordered-vs-unordered split was **removed** effective 2022-11-07 (Register 2022, No. 45) | 4 CCR §15418(a),(b), DCC compilation p. 111; history notes on LII <https://www.law.cornell.edu/regulations/california/4-CCR-15418> |
| Delivery inventory ledger before departure; updated after each delivery; entered into CCTT "by the end of each calendar day"; stop log; return to premises after 30 minutes with no requests | 4 CCR §15418(d),(e),(h); DCC CannaConnect page <https://www.cannabis.ca.gov/licensees/cannaconnect-compliance-hub/new-record-keeping-track-and-trace-requirements-for-deliveries/> |
| Retailer must have received the delivery request and given the employee the receipt **before arrival** at the address | 4 CCR §15418(f) |
| Delivery employee 21+; **before handing over goods must confirm the customer's identity and age per §15404** (i.e. inspect ID at the door) | 4 CCR §15415(b),(g) |
| Delivery request receipt contents: retailer name/licence, delivery employee first name + employee number, preparer, customer first name + retailer-assigned customer number, request date/time, address, description with "weight, volume, or any other accurate measure", total paid, and on completion the date/time and customer signature | 4 CCR §15420(a),(b) |
| Deliver only to a physical California address; not to K-12 schools, day care or youth centres; not to public land | 4 CCR §15416(a),(c),(e) |
| **Two deliveries to the same customer in one day**: no rule found prohibiting it; the daily limit is cumulative across both | absence — **UNVERIFIED** |
| Delivery manifest/ledger must exist in Metrc before departure (already covered in `docs/METRC-PROGRAM-PLAN-2026-09-17.md` §2) | 4 CCR §15418(d) |

### 1.7 Local rules — what to check, not researched here

Cities may be stricter than the state on hours, delivery, and patient allowances (H&S §11362.77(c)
lets locals allow *more* for patients; nothing lets locals allow more for adult use). For each
licence (storefront and delivery) check the local cannabis ordinance and the local permit conditions
for: (1) a lower daily limit or a per-transaction limit; (2) delivery hours and any "no delivery
after X" rule; (3) whether the city requires a local medical-verification step or its own patient
registry; (4) a customer-record-retention rule longer than the state's seven years; (5) any
"no sale to visibly intoxicated" or purchase-frequency rule; (6) whether the city allows 18–20
medical patients at a dual A/M premises. Hyperwolf's known premises to check: West Hollywood,
Long Beach, Corona, Lake Elsinore (per the intake pipeline), plus the delivery service areas.

### 1.8 Penalties and exposure (short)

The DCC first issues a notice to correct; for serious or recurring violations it may issue citations
with fines "up to $5,000 per violation (licensed person)", orders of abatement, licence suspension or
revocation, under the DCC Disciplinary Guidelines
(<https://www.cannabis.ca.gov/cannabis-laws/compliance-with-state-law>;
<https://www.cannabis.ca.gov/wp-content/uploads/sites/2/2021/10/DCC-Cannabis-Disciplinary-Guidelines-Sept.-2021.pdf>).
Grounds include violating any provision of Division 10 or its regulations (B&P §26030). An
over-limit sale is one violation *per sale*; a systematic defect (the Stilo one in §2.2) is many.
Records must be retained seven years (4 CCR §15037) — including the medical verification
certifications (B&P §26071(a)(7)) — so the ledger and the audit trail are themselves a compliance
record, not just an engine input.

---

## 2. What exists in code today (read-only; `grep -a`, quoted globs, `rg`)

Searched: all twelve `/Users/jt/hyper-tech/*` repos, `/Users/jt/POS-Admin`, `/Users/jt/wm-demo`
for `purchase limit`, `daily limit`, `legal limit`, `limit exceeded`, `max per day`, `28.5`,
`28.35`, `8 oz`, `concentrate limit`, `equivalen`, `medical`, `mmic`, `recommendation`,
`cannabisType`, `flowerWeight`, `weightSummary`, `possession`, `physician`. SVG path data and
lock files produced false positives on `28.5` and were excluded.

### 2.1 POS-Admin and wm-demo — confirmed absent (independently re-verified)

- No limit computation, no daily ledger, no bucket classification anywhere. Only comments:
  `/Users/jt/POS-Admin/pos/checkin.jsx:622-628` (why customer `type` must not default to Adult Use
  — "with different purchase limits and different tax") and
  `/Users/jt/POS-Admin/pos/screen-register.jsx:552-556` ("each guest's ticket keeps its own purchase
  limit") and `:1240`. The earlier audit's claim stands for these two repos.
- What *does* exist and is reusable:
  - `/Users/jt/wm-demo/wmdemo/store.py:186-203` — `hw_identities` already carries `phone_e164`,
    `name_dob_fp`, `gov_id_hash`, `verified_at/via/ref/expires_at`, `pos_customer_id`, `wm_ids`
    — the identity-resolution keys the ledger needs.
  - `/Users/jt/wm-demo/wmdemo/pos_sales.py:79-146` (`customer_id` additive column, indexed) and
    `pos_sale_lines.py:69-95` (per-line `sku`, `quantity REAL`, `batch_id`, `store_id`,
    `created_at`) — the sale rows the ledger can be derived from, **but no bucket/amount columns**.
  - `/Users/jt/wm-demo/wmdemo/tax.py:15-20,137-138` — the date-versioned (`effective_from/to`)
    rate pattern the legal constants table should copy; `member_type` (`recreational|medical|all`)
    already encodes medical status for tax.
  - `/Users/jt/wm-demo/idv-engine/pipeline/medical_rec.py` — reads a California physician's
    recommendation or state card into a `medical_recommendations[]` node (patient name, DOB,
    physician name, licence number, dates); `callback.py:309-316` maps it to a decision. This is the
    capture side of medical status; nothing consumes it for limits yet.
  - `/Users/jt/POS-Admin/shared/commerce-engine.js:1362-1377` — `blockers[]` / `canCheckout` on the
    totals object, consumed by `shop/screen-checkout.jsx:198,500-501`. This is the seam the limits
    engine plugs into without touching the register (§3.6).
- Product data gaps (§3.2): `catalog.py:50-59` seeds carry `weight {unit,value}` and `thc` only;
  `catalog.py:957-965` **overloads `weight` with THC mg for edibles** ("fall back to the THC" —
  `HW-CHOC-100` has weight `{mg,100}`), so `weight` cannot be read as net cannabis weight;
  `inventory.py:59-60` deliberately has "no mg column"; contracts `Product.json` has `category`
  and `quantity_on_hand` only, `Batch.json` has `thc_pct` only, `OrderLine.json`/`SaleLine.json`
  have no bucket or amount, `Person.json` has `classification` (free string) and `verified` (bool)
  with no medical fields.

### 2.2 stilo-backend — a live purchase-limit feature, defective (READ-ONLY; fixes go to TEAM-TODO)

Location: `/Users/jt/hyper-tech/stilo-backend` (commit a9f4407, 2026-09-09). Consumed by the Stilo
storefront (`stilo-frontend-nextjs`) and the retailer admin (`hemp-retailer-admin`).

**What exists**
- Model `models/CannabisLimit.js:3-12`: `{state, memberType, storeId, cannabisType, limit,
  customUomAbbrev, displayName}` — one number per (store, memberType, cannabisType).
- Admin CRUD `routes/admin/cannabisLimit-routes.js:6-16` → `controllers/admin/cannabisLimit-controller.js`,
  mounted at `/api/v1/cannabis/limit` (`startup/routes.js:82`). Admin UI
  `hemp-retailer-admin/src/components/settings/LimitManagement/AddLimit.jsx` (member type
  `AdultUse|Medicinal`, cannabis type `Concentrate|Non-concentrate`, "Concentrates" disabled for
  medical, `:118-119,:171`).
- Engine `common/utils.js`:
  - `calculateLimit` `:2950-2981` — sums `limit` per `cannabisType` for (storeId, memberType).
  - `categoriesType` `:3159-3178` — splits categories by `categoryType === "Cannabis"` vs anything
    else.
  - `prepareCartproductDetail` `:2822-2895` — sums today's orders for (memberId, **storeId**), day =
    `toISOString().slice(0,10)` (**UTC**), weight parsed from the product's `customWeight` string
    (`"3.5g"`, `"100mg"` → ÷1000), all categories summed into **one** `totalWeightForToday`.
  - `validateWeightLimits` `:2984-3049` — per cart item: `categoryType.cannabis.includes(categoryId)`
    → **concentrate** bucket, `nonCannabis` → **non-concentrate**; if any prior purchase today,
    `usedConcentrateWeight = totalWeight` (**assignment, not accumulation**); block only when
    `limit != 0`.
  - `orderDetailWeight` `:3055-3097` — read-only summary for order detail.
- Call sites: cart add `controllers/cart/cart-controllers.js:333-343` (returns HTTP 200 with the
  *previous* cart and a `message`), cart recompute `:395`; POS cart `controllers/POS/pos-controllers.js:302,399`;
  order session recompute `controllers/order/order-controllers.js:3052-3053` (only when quantities
  changed); **`createOrder` `:316-691` never calls it**; `updateOrder` has the check **commented
  out** `:772-774`. Storefront meter `stilo-frontend-nextjs/app/(_components)/common/concentrateProgress.jsx`
  rendered in cart drawer `:433`, checkout `:1003`, order page `:183`.

**Defects (each independently sufficient to sell over the limit)**
1. **Wrong classifier.** Bucket = "is this category cannabis?", not "is this concentrate?"
   (`utils.js:3008-3016`, `:3167`). Every cannabis category (flower included) lands in the
   *concentrate* bucket; the *non-concentrate* bucket holds non-cannabis categories. In
   `hyperwolf-backend/controllers/admin/category-controllers.js:1093` the Blaze `cannabisType` is
   collapsed to `"CONCENTRATE" ? "Cannabis" : "Non-Cannabis"`, so the type information needed is
   destroyed at import.
2. **Overwrite, not sum.** With any earlier purchase today, each item *replaces* the running total
   (`:3010,:3016`), so only the last cart line is compared to the limit.
3. **One store, UTC day.** `Order.find({ memberId, storeId })` `:2823`; day string is UTC
   (`:2828-2834`) — the legal day rolls at 4 pm/5 pm Pacific, and purchases at a sibling store are
   invisible.
4. **Weight is the wrong quantity.** `customWeight` is package weight/potency as typed
   (`"100mg"` edible → 0.1 g "cannabis"; a 3.5 g flower jar and a 3.5 g "infused" jar are the
   same). No concentrate grams, no THC mg, no plant count. Items with no parseable weight are
   silently `skippedItems` (`:2999-3002`) — **fail open**.
5. **Medical is unlimited by accident.** Admin writes `memberType: "Medicinal"`
   (`AddLimit.jsx:119`); members carry `"MedicinalUser"` (`models/Tax.js:20`,
   `member-controllers.js:77`); `calculateLimit` matches nothing → limit `0` → `limit != 0` guard
   → no block (`:3033,:3040`).
6. **Medical status is assigned by age.** `age <= 21 ? "MedicinalUser" : "AdultUse"`
   (`controllers/member/member-controllers.js:77,938,1004`; `agechecker-controllers.js:40`) — a
   21-year-old and anyone younger, with no recommendation, is medical.
7. **No check at placement.** `createOrder` does not call the engine; the only enforcement is the
   add-to-cart response, which a client can ignore.
8. **Limits editable through the shared API key.** `cannabisLimit-routes.js` has no role middleware;
   the only guard is the global `apiKeyMiddleware` (`middlewares/authMiddleware.js:15-24`) that
   every storefront client already carries.
9. **Physician table is unauthenticated the same way** (`routes/admin/physicians-routes.js`).

### 2.3 hyperwolf-backend / hyperwolf-frontend-nextjs / hyperdrive-backend / super-admin

- **No limit logic.** The storefront proxies the cart to Blaze:
  `hyperwolf-backend/controllers/blaze/user-cart-controllers.js:120-425` (`/store/cart/prepare`,
  `/updateCart`), `:600` (`submitCart`). Blaze's own enforcement (if enabled) is the only check;
  the backend does not surface a limit-specific error type, so any Blaze rejection is shown as a
  generic message. **Owner action:** confirm in Blaze Global Settings → Company Settings → Company
  Info that "User Cannabis Limit" is on, and run a product report for empty Cannabis Type / THC mg /
  Weight Per Unit.
- `TimeSlot.overallOrderLimit` (`models/TimeSlot.js:23`, `user-cart-controllers.js:747-816`) is a
  per-slot *order count* cap, not a cannabis limit.
- **Sign-up marks every member verified.** `controllers/blaze/user-auth-controllers.js:177-178`
  (and `:237,:260,:340`) PUTs `"identifications":[{"verified":true}], "recommendations":[{"verified":true}]`
  to Blaze for every new member. If Blaze's medical limit keys off `recommendations[].verified`,
  this is how an adult-use member could be treated as verified-medical. Counsel-relevant.
- **Medical designation by age.** `controllers/persona/personaController.js:265-320`
  (`/update/member/details`, `routes/persona/persona-routes.js:8`, no auth middleware on the route):
  if `age < 21`, sets `consumerType: "MedicinalThirdParty"` and a recommendation with
  `verified: true, verifyMethod: "MANUAL"` from user-supplied `recNo`, website and phone — no human
  verification step, no Medical Board check, expiry computed as issue date + 1 year.
- `user-auth-controllers.js:469` blocks under-21 `AdultUse` members at login (correct direction).
- Category import keeps a Blaze `cannabisType` on `models/Category.js:15` but collapses it (§2.2 #1).
- `hyperwolf-super-admin`, `hyperdrive-backend` (driver app backend), `distribution-backend`,
  `promotion-*`: no purchase-limit code; `distribution-backend`'s "DAILY_LIMIT" is a Blaze API
  request-rate counter (`blaze-syncing-controller.js:21`).

---

## 3. The design for our platform

Targets `wm-demo` (Python, SQLite now) and the later TypeScript/Postgres platform; the contracts in
`/Users/jt/POS-Admin/contracts` are the shared shape. Everything is server-side; the browser and
the driver phone only *display* what the server decided. Security and privacy notes are inline,
prefixed **S/P**.

### 3.1 Principles

1. **One engine, every path.** Add-to-cart, checkout start, placement (inside the transaction),
   admin order edit, support line edit, swap (customer, driver, support), driver-to-driver transfer,
   register tender, driver door confirmation. Any path that changes *what a person receives today*
   calls `limits.evaluate`. A path that cannot call it cannot change the basket.
2. **Integers only.** All amounts in **milligrams** (`int`), plants as `int`. 28.5 g is `28_500`;
   8 g is `8_000`; 8 oz is `226_796` mg (8 × 28.3495 g, rounded down — the legal text says "8
   ounces", so we store the ounce and derive mg with a fixed constant, never a float at runtime).
   Fractional-quantity lines (bulk by weight) round **up** to the next milligram.
3. **Fail closed on data.** A cannabis product with no compliance class or no amount is not sellable
   in any channel. A person whose identity cannot be resolved cannot receive cannabis.
4. **Legal values are constants with effective dates, not settings.** Staff edit only operational
   knobs. The engine refuses to run if today has no effective legal row (that is a deploy error, not
   a runtime choice).
5. **No override above the law.** The only mechanism that raises a person's allowance is a verified
   physician-documented amount (§15409(c)), which is data on the medical record, not a button.

### 3.2 Product data required per SKU (and per batch where it varies)

Add a `compliance` object to `contracts/schema/Product.json` (and an optional override on
`Batch.json` for amounts that vary by lot):

| Field | Type | Meaning | Required when |
|---|---|---|---|
| `compliance.bucket` | enum `non_concentrated \| concentrate \| infused_split \| immature_plant \| seed \| non_cannabis` | which bucket(s) a unit counts against | always |
| `compliance.non_concentrated_mg` | int ≥ 0 | net cannabis flower weight per unit, mg | bucket ∈ {non_concentrated, infused_split} |
| `compliance.concentrate_mg` | int ≥ 0 | grams of concentrate per unit, mg (extract net weight for vapes/dabs; derived per §3.3 for edibles) | bucket ∈ {concentrate, infused_split} |
| `compliance.thc_mg_per_package` | int ≥ 0 | label total THC per package | all cannabis products (also drives §17304 checks) |
| `compliance.plant_count` | int | plants per unit | immature_plant |
| `compliance.medical_only` | bool | §17304(b),(d) products | always (default false) |
| `compliance.source` | enum `label \| coa \| manufacturer \| manual` | provenance | always |
| `compliance.verified_by`, `verified_at` | actor id, timestamp | who classified it | always |
| `compliance.version` | int | bumps on any change; the ledger stores the version used | always |

`weight` in `catalog.py` stays what it is (display/engine payload) and is **never** read by the
limits engine — the edible fallback at `catalog.py:957-965` makes it unsafe. `taxonomy.py`
categories may seed a *suggested* bucket (Flower → non_concentrated, Vapes/Concentrates →
concentrate, Edibles/Tinctures/Topicals → concentrate-by-THC, Pre Roll → non_concentrated unless the
name says "infused"), but a suggestion is not a classification: it lands in a review queue and the
product stays unsellable until a human confirms. **Missing data policy:** fail closed (Q5 offers a
bounded warn window for the backfill only). A daily report lists cannabis SKUs with
`compliance.bucket IS NULL` and any sale line whose product was unclassified at sale time (must be
zero).

**S/P:** classification changes are audited (who, when, before/after); the ledger snapshots
`compliance.version` per line so a later re-classification cannot rewrite history.

### 3.3 Counting rules (the pure function)

`evaluate(basket, ledger_today, profile, policy, now) -> Result`

- Per line: `units = ceil(quantity)` for discrete, `ceil(quantity × unit_mg)` for bulk;
  `non_concentrated_mg += units × p.non_concentrated_mg`; `concentrate_mg += units × p.concentrate_mg`;
  `plants += units × p.plant_count`.
- Edibles/tinctures/topicals/capsules/beverages: `concentrate_mg = policy.edible_rule(thc_mg)`;
  default rule **`max(thc_mg, declared_concentrate_mg)`** (i.e. 1 mg THC ≡ 1 mg concentrate, or the
  manufacturer's declared extract weight if larger) — Q3 decides.
- Infused pre-roll: both buckets (`infused_split`).
- Medical profile: bucket `medical_total_mg` = non_concentrated + concentrate ("plant conversion",
  §1.3(e)) against `226_796` unless the recommendation record carries `stated_daily_mg`, in which
  case that value (never lower than the statutory 8 oz, and only if `rec.verified && !expired`).
  Medical concentrate cap: policy `medical_concentrate_cap` = `8_000 | none` (Q4).
  Plants: 12.
- Adult-use profile: `28_500 / 8_000 / 6`. Under-21 without a verified medical record: **no
  cannabis at all** (B&P §26140(a)).
- `Result = { buckets: [{bucket, used_mg, pending_mg, this_basket_mg, limit_mg, remaining_mg,
  pct}], blockers: [{code, bucket, over_by_mg, line_refs, message}], suggestions: [{line_ref,
  max_units_allowed}], profile_used, legal_version, policy_version, evaluated_at }`.
- Blocking is per bucket and exact at the boundary: `used + this > limit` blocks; `== limit` passes
  (28.5 g exactly is legal).
- `medical_only` product with non-medical profile → blocker `MEDICAL_ONLY_PRODUCT` regardless of
  remaining.
- The function is deterministic, has no I/O, and is the single thing the adversarial suite (§3.11)
  hammers. Port it 1:1 to TypeScript later; the test vectors are JSON fixtures shared by both.

### 3.4 The ledger and the day

`purchase_ledger` (one row per order line per bucket):
`id, identity_id, legal_day (YYYY-MM-DD, America/Los_Angeles), licence_id, store_id, channel
(web|pos|delivery|pickup|wm|phone), order_id, line_no, sku, compliance_version, bucket, amount_mg,
plant_count, state (reserved|committed|released|voided|returned), reserved_until, actor,
created_at, updated_at, reason`.

- **Reserve → commit → release.** At checkout start (and at register "start tender") the basket is
  *reserved* with a TTL equal to the cart hold TTL from `CART-AND-CHECKOUT-PLAN` §1.8; placement
  *commits* inside the same transaction that writes the order; abandonment *releases*. Pending
  reservations count against the day (a person cannot open two checkouts to double-spend).
- **Concurrency.** The identity-day row is the lock: SQLite `BEGIN IMMEDIATE` now, Postgres
  `SELECT … FOR UPDATE` on `(identity_id, legal_day)` later. Two devices placing at the same second
  serialise; the second re-evaluates against the first's commit.
- **Legal day boundary** = 00:00 America/Los_Angeles (Q1). DST days are 23 h or 25 h; `legal_day` is
  computed from the store-local wall clock, never from UTC arithmetic. A Scheduled delivery counts on
  the day it is **handed over**, not the day it was ordered (the reservation carries
  `legal_day = scheduled_date` and is re-evaluated at dispatch and at the door — a rec expiring
  before that date blocks the window).
- **Voids** (before handover) → `voided`, allowance returns. **Returns** (after a completed sale) →
  `returned`, allowance does **not** return by default (Q6). **Swaps**: the outgoing line is
  `released` only if the swap happens before handover (pre-dispatch edit, kit swap at the door
  before the customer takes possession); the incoming line is evaluated against the full day
  including everything still committed. **Driver-to-driver transfer** does not change the basket,
  but the transfer must re-run `evaluate` (the customer may have bought in-store since the order was
  placed) and re-reserve under the new ETA's `legal_day` if the day rolls.
- **Identity merges** (`identity_match.py`) re-key ledger rows to the surviving identity and
  re-evaluate any open reservation; a merge that produces an over-limit day raises an exception
  report, it does not silently pass.

**S/P:** the ledger stores `identity_id` only — no name, no ID number. Retention seven years
(§15037), append-only (state transitions are new rows or audited updates; no deletes). Read access
to per-person history is role-gated and logged (who looked at whose day).

### 3.5 Identity resolution and the guest / walk-in policy

- Resolution order: `member_id` (logged-in) → `gov_id_hash` (SHA-256 of normalised ID number +
  issuing jurisdiction, salted with a server secret) → `phone_e164` → `name_dob_fp`. All exist on
  `hw_identities` today (`store.py:186-199`). A match on ID hash or phone *binds* the session to
  that identity for the ledger even if the person is not logged in.
- **Web/Express/Scheduled guest:** may browse and hold a cart; cannot reserve or place until Verify
  has produced an identity (existing `idv/*` module; do not modify). This is also what §15404 and
  §15415(g) require before handover.
- **Walk-in at the register:** the ID scan at check-in (`pos/checkin.jsx`) yields `gov_id_hash`;
  the ticket binds to that identity; no anonymous cannabis sale (Q2/Q5 do not offer an anonymous
  option because §15404 already requires ID inspection). A manual ID-number entry by the budtender is
  allowed only with the physical card in hand and is flagged `resolution_path = manual`.
- **Caregiver:** a caregiver identity carries links to patient identities; each order names the
  patient; the ledger row is the **patient's**.
- **Evasion cases** (all in the test suite): same person, two phones; same phone, two names; guest
  then log-in mid-checkout (merge and re-evaluate); one household ordering under several names
  (not our problem legally unless the ID is the same — record, do not block); driver reading the
  wrong ID at the door (door re-check compares ID hash to the order's identity).

**S/P:** ID numbers are hashed at capture and the raw value is never stored in the ledger; the
IDV module's own encrypted store is the only place a document image lives.

### 3.6 Medical status

- **Record:** `medical_status { identity_id, kind (mmic|physician_rec), status
  (pending|verified|expired|revoked), issued_on, expires_on, stated_daily_mg (nullable),
  physician_licence_hash, verification { verified_by, verified_at, board_checked, method,
  reference }, next_reverify_on, document_ref (IDV store pointer) }`.
- **Establishing it:** capture via IDV (`medical_rec.py` produces the fields); a human verifier
  (role `compliance`) checks the physician's licence with the relevant board and records the
  §15411(b)(1)(A)(iii) certification fields; MMIC cards are checked against the state verification
  system. Status becomes `verified` only on that action. Annual re-verification task is generated
  automatically (`next_reverify_on`); a lapsed re-verification downgrades to `pending` (adult-use
  limits apply, and an 18–20 patient is blocked entirely).
- **Expiry:** the engine treats `expires_on < legal_day` as adult-use. A Scheduled order past the
  expiry date is blocked at reservation with a plain message.
- **Unlocking the higher limit:** automatic once `status = verified`; no button. The
  `stated_daily_mg` field may only be set by the verifier and only with the document reference; it
  is the §15409(c) path and is the *only* way a person's allowance exceeds the default.
- **Overrides:** there is no "override limit" permission. There is a `compliance` permission to
  (a) set/clear medical status, (b) release a stale reservation, (c) re-key identities. Each writes an
  audit row `{actor, action, target, reason (required, free text ≥ 10 chars), before, after}` and
  emits an event. A manager cannot raise a limit, cannot mark a product as smaller than its label,
  and cannot approve an over-limit sale.

**S/P:** PII minimised — store the physician licence as a hash plus the board reference, the
patient's name is already on the identity; the document image stays in the IDV store, encrypted at
rest, with an audited reveal (who viewed, when, why) rather than an inline display. Recommendation
numbers and MMIC numbers are stored encrypted (application-level key) because they are needed on the
§15411(b)(6) inventory record; they are never returned to the browser in full (last 4 only).

### 3.7 UX requirements (words only — any new screen gets four concepts, desktop and phone)

- **Cart (web, app):** a per-bucket progress meter — "Flower 14.0 g of 28.5 g", "Concentrate 2.3 g
  of 8 g", plants when relevant — coloured by the operational `warn_at_pct` (default 80 %). For a
  verified medical member the meter shows the medical allowance and says why. Meter data comes only
  from `evaluate`; the browser never computes it.
- **At the limit:** adding an item that would exceed is refused with the exact reason and the exact
  headroom: "That would be 9.3 g of concentrate today; the legal limit is 8 g. You can add up to 1
  more of this item." The item is not silently dropped; the customer chooses. Where an item pushes
  over, the engine's `suggestions` name the largest quantity that fits.
- **"Already bought today":** if the ledger has committed rows, the cart says so in plain words —
  "You bought 7 g of flower earlier today at Long Beach; 21.5 g remains" — store name only, no order
  details, and only to the authenticated identity that owns them.
- **Checkout / placement failure** (a concurrent purchase consumed the headroom): a typed blocker in
  the existing `blockers[]` shape (`commerce-engine.js:1362-1377`) with a "fix cart" action.
- **Register (no changes to `pos/screen-register.jsx` without the owner's explicit approval):** the
  integration seam is the totals object the register already consumes — `evaluate` results are
  merged into `blockers[]` / `canCheckout` by the data layer (`pos/data.jsx`), so an over-limit
  ticket shows the same red blocker row the register already shows for a lane-minimum shortfall,
  and "Tender" stays disabled. The per-bucket meter and the "bought today" facts live on the
  **check-in card** (`pos/checkin.jsx`, where customer type is already chosen) and on the Home card,
  not on the register. What the budtender sees at the register today: the blocker text and the
  disabled tender; nothing else changes until concepts are approved.
- **Admin / support order edit and swap panels:** every quantity or SKU change shows the post-change
  meter and refuses over-limit saves with the same message; the swap picker greys out replacements
  that would not fit and says why.
- **Driver app, at the door:** the task screen shows a green "Limits OK — checked 14:02" line after
  the door ID check binds the identity; if the door re-check fails (identity mismatch, or a purchase
  since dispatch pushed the day over), the driver sees "Do not hand over — call dispatch", the order
  moves to the swap/recovery flow (`SWAP-RECOVERY-FLOW-PLAN` §2), and the customer is offered the
  largest subset that fits.
- **Medical:** a member sees "Medical: verified until 2027-03-01" or "Medical: pending — adult-use
  limits apply until verified"; never the rec number in full.

### 3.8 Settings, API, data model, events, reports

**Settings**

| Kind | Key | Default | Editable by |
|---|---|---|---|
| Legal constant (versioned by `effective_from`, source citation stored with the row) | `adult.non_concentrated_mg` | 28 500 | nobody at runtime (migration + release sentinel) |
| Legal constant | `adult.concentrate_mg` | 8 000 | — |
| Legal constant | `adult.immature_plants` | 6 | — |
| Legal constant | `medical.total_mg` | 226 796 | — |
| Legal constant | `medical.immature_plants` | 12 | — |
| Legal constant | `adult.min_age`, `medical.min_age` | 21, 18 | — |
| Policy (owner decision, versioned, audited) | `day_boundary` | `calendar_local` | owner via Q1 |
| Policy | `scope` | `company_all_licences` | owner via Q2 |
| Policy | `edible_rule` | `max(thc_mg, declared_mg)` | owner via Q3 |
| Policy | `medical_concentrate_cap_mg` | 8 000 | owner via Q4 |
| Policy | `unclassified_product_mode` | `block` | owner via Q5 |
| Policy | `return_frees_allowance` | false | owner via Q6 |
| Operational | `warn_at_pct` | 80 | manager, audited |
| Operational | `reservation_ttl_s` | = cart hold TTL | manager, audited |
| Operational | `door_recheck_max_age_s` | 900 | manager, audited |

**API (server-side; every call authenticated; identity never taken from the client for evaluation)**

- `POST /api/limits/evaluate {basket, identity_ref|session, channel, store_id, for_day?}` → `Result`
- `POST /api/limits/reserve {order_draft_id}` → `{reservation_id, expires_at, Result}`
- `POST /api/limits/commit {order_id}` (called only inside placement/tender transaction code, not
  from a browser)
- `POST /api/limits/release {reservation_id | order_id, reason}`
- `POST /api/limits/void {order_id, reason}` / `POST /api/limits/return {order_id, lines, reason}`
- `GET /api/limits/today?identity=…` (role-gated; the storefront gets only its own identity's view)
- `GET /api/limits/policy` (read), `PUT /api/limits/settings` (operational keys only, audited)
- `POST /api/limits/medical/{identity}/verify`, `…/expire`, `…/set-stated-amount` (role `compliance`)
- Register and driver clients call `evaluate` through their existing data layers; the router that
  writes orders calls `reserve/commit` itself.

**Events** (on the realtime bus per `REALTIME-ARCHITECTURE-2026-09-17.md`): `limits.evaluated`,
`limits.blocked`, `limits.reserved`, `limits.committed`, `limits.released`, `limits.voided`,
`limits.returned`, `limits.medical_status_changed`, `limits.identity_rekeyed`,
`limits.product_unclassified_seen`, `limits.exception` (post-hoc over-limit found by reconciliation).

**Reports (audit-ready, exportable CSV, seven-year retention)**

1. Daily exceptions: any identity-day over any bucket after merges/reconciliation (target: zero).
2. Blocked attempts per channel/store (volume, top SKUs, repeat identities).
3. Sales of unclassified products (must be zero) and the classification review queue.
4. Medical register: verified patients, expiry within 30 days, annual re-verification due, with the
   §15411(b)(1)(A)(iii) certification fields.
5. Per-licence per-day totals by bucket, reconciled to Metrc sales receipts (§3.9).
6. Audit trail of settings and compliance actions.

### 3.9 Metrc alignment

The METRC plan (`docs/METRC-PROGRAM-PLAN-2026-09-17.md` §3) builds a day-ledger + pre-flight +
nightly submit. The limits ledger and the Metrc day-ledger should be **one table family keyed by
`order_id, line_no`**, so each Metrc sales receipt carries the same customer type we evaluated
(consumer / patient / caregiver) and the same package tags. Pre-flight adds a check: "no receipt in
tonight's batch belongs to an identity-day that is over limit" — if one is, it is a §3.8 exception,
never a silent submit. For delivery, the before-departure ledger (§15418(d)) is the natural place to
attach the reservation ids so an auditor can walk order → reservation → commit → Metrc receipt.
Metrc itself will not stop an over-limit sale (§1.4, unverified), so nothing in this design relies on
it.

### 3.10 Build order (small slices, each shippable and testable alone)

| Slice | Content | Done when |
|---|---|---|
| S0 | Legal constants table (versioned, cited); pure `evaluate` in `wmdemo/limits.py` with JSON fixtures; TypeScript port of fixtures runs green in `contracts` tests | 100 % of §3.11 vectors pass in both languages |
| S1 | `compliance` fields on Product/Batch contracts and `catalog.py`; classification review queue; unclassified report; backfill tool seeded from taxonomy suggestions | every cannabis SKU in the demo catalog classified by a human |
| S2 | `purchase_ledger` + reserve/commit/release with identity-day locking; identity merge hook | concurrent-placement test cannot double-spend |
| S3 | Shop cart/checkout: meter, block messages, `blockers[]` integration, placement-transaction commit | attack "two tabs, one identity" fails closed |
| S4 | Register seam via `pos/data.jsx` (blocker + disabled tender), check-in card meter; **no register JSX change** | budtender sees the block; register file untouched in the diff |
| S5 | Admin/support order edit, swap engine hook (`commerce-engine` replacement intent), driver-to-driver transfer hook | swap plan attack #2 now fails |
| S6 | Driver door re-check (identity bind → evaluate → hand-over gate) and the recovery path | door mismatch routes to swap flow |
| S7 | Medical status module: capture from IDV, verifier workflow, expiry, re-verify tasks, encrypted fields, audited reveal | 18–20 patient can buy only when verified; adult-use member cannot become medical without a verifier action |
| S8 | Reports, Metrc pre-flight exception, retention/export | auditor walk-through succeeds on a seeded day |
| S9 | Adversarial battery in CI; refuter pass (three lenses) | all §3.11 cases green, refuter findings closed |

### 3.11 Adversarial test cases (the battery S0–S9 must pass)

Boundary and arithmetic: exactly 28 500 mg passes, 28 501 blocks; 8 000 / 8 001; 6 / 7 plants;
80 × 100 mg edibles = 8 000 mg passes, 81 blocks; 3.5 g × 8 = 28 000 passes, plus one 1 g pre-roll
blocks; bulk 0.1 g × 285 lines; float inputs like 3.54 g (Weedmaps eighth, `mapping.py:45`) never
enter the engine (mg ints only); a 1 g infused pre-roll with 0.25 g concentrate counts 750 mg flower
+ 250 mg concentrate; medical stated amount below 8 oz is ignored (never lowers), above is applied
only when verified and unexpired.

Split purchases: same identity — web order 20 g at 10:00, register 8.5 g at 14:00 passes, 9 g
blocks; two stores; two channels; guest-then-login merge; two phones one ID hash; caregiver with two
patients; Weedmaps order ingested after a POS sale.

Time: 23:59:30 order committed on day D, 00:00:30 new order on D+1 passes (calendar policy) and
blocks (rolling policy); DST spring-forward day; server clock in UTC, store in LA; Scheduled order
placed D for delivery D+1 counts on D+1; rec expiring D+1 blocks that window.

State transitions: reservation expiry frees headroom; abandoned checkout does not hold allowance
forever; void before handover frees; return after sale does not (default); swap over limit blocks
and suggests the largest fit; transfer re-evaluates and catches an in-store purchase since dispatch;
identity merge that creates an over-limit day produces an exception, not a pass.

Data: unclassified SKU blocks everywhere (or warns only in the Q5 window and is reported);
`weight`-only edible is not read as 100 mg of flower; product re-classified after sale does not
rewrite the ledger; medical-only 2 000 mg concentrate refused to adult-use identity regardless of
headroom; under-21 with `pending` medical status buys nothing.

Security: client-supplied `identity_id`, `profile`, or `remaining` is ignored; `commit` cannot be
called from a browser session; settings endpoint rejects legal keys; every compliance action without
a reason is rejected; reveal of a rec number is logged; ledger rows cannot be deleted through any API.

---

## 4. Owner questions and the list for counsel

### 4.1 Questions (six; pick any that apply; the first option is the recommendation)

**Q1. What is "one day" for the limit?**
1. **Calendar day in California time (midnight to midnight).** Pros: matches how Metrc's daily
   ledger and every POS vendor count; simplest to explain to a customer ("resets at midnight").
   Cons: a person can buy 28.5 g at 11:50 pm and 28.5 g at 12:10 am.
2. Rolling 24 hours from each purchase. Pros: strictest reading of "single day"; closes the
   midnight gap. Cons: nobody else counts this way; customers cannot predict when they are clear;
   harder to reconcile with Metrc's day.
3. Calendar day, but with a two-hour "no double-dip" guard either side of midnight. Pros: closes
   the obvious gap. Cons: invented rule, hard to justify to an auditor either way.
4. Store business day (opening to closing) rather than midnight. Pros: matches staff intuition.
   Cons: delivery runs past closing; different stores close at different times; no legal basis.

**Q2. Whose purchases count together?**
1. **One person across every Hyperwolf licence, store and channel (web, delivery, pickup,
   register, Weedmaps).** Pros: the defensible reading; an auditor comparing our own Metrc receipts
   across licences sees one person; protects the company, not just one store. Cons: needs the
   identity join everywhere (already mostly built).
2. Per licence. Pros: literal reading of "a licensed retailer". Cons: the same person can buy the
   full limit at each of our stores and we knowingly enabled it.
3. Per store. Pros: simplest. Cons: same as 2, worse for delivery which serves many stores' areas.
4. Per channel (web separate from register). Pros: no integration work. Cons: not defensible.

**Q3. How do edibles, drinks, tinctures and topicals count toward the 8 g of concentrate?**
1. **Total THC milligrams count one-for-one as milligrams of concentrate (a 100 mg gummy = 0.1 g),
   or the manufacturer's declared extract weight if that is larger.** Pros: what Treez and Blaze
   do in practice; uses the label figure we always have; takes the stricter of the two numbers.
   Cons: no DCC rule says so; can be argued either way.
2. Declared extract weight only. Pros: closest to the literal text "amount of cannabis
   concentrates found in". Cons: manufacturers rarely declare it; missing data blocks the sale.
3. THC milligrams only. Pros: simple. Cons: ignores a declared heavier extract weight.
4. Whole net weight of the product. Pros: impossible to under-count. Cons: a 50 g chocolate bar
   would use 5 g of an 8 g allowance; commercially unworkable.

**Q4. Do medical patients get a concentrate cap?**
1. **Yes — 8 oz total of all cannabis, and concentrate also capped at 8 g unless the physician's
   recommendation states a larger amount.** Pros: covers the regulator's silence conservatively;
   the higher amount still exists for patients whose doctor wrote it. Cons: stricter than some
   competitors; some patients will ask why.
2. 8 oz total, no separate concentrate cap. Pros: literal §15409(b); matches Treez. Cons: a patient
   could buy 226 g of concentrate; an auditor may not agree.
3. 8 oz total with concentrate capped at 8 g, no exception. Pros: simplest. Cons: ignores
   §15409(c), which the law expressly grants.
4. Treat every patient as adult-use unless they hold a county MMIC card. Pros: fewest verification
   steps. Cons: physician recommendations are valid medical proof by law; we would be refusing
   lawful patients.

**Q5. What happens when a product has no compliance data?**
1. **It cannot be sold in any channel until classified.** Pros: the only way to be sure the count
   is right; forces the catalog clean-up once. Cons: a short disruption while the backlog is
   classified.
2. Blocked online, warning at the register for 30 days, then blocked everywhere. Pros: smoother
   go-live. Cons: 30 days of register sales that may be wrong.
3. Warn everywhere for 30 days, then block. Pros: least disruption. Cons: a month of unknown risk.
4. Count it by its category's default (flower/concentrate) and flag for review. Pros: no
   disruption. Cons: an "Edibles" default can under-count an infused pre-roll; the flag gets ignored.

**Q6. Do returns, voids and swaps give the allowance back the same day?**
1. **A void before the customer receives the goods gives it back; a return after a completed sale
   does not; a swap re-checks the whole day.** Pros: matches what the customer physically had;
   returned goods cannot be resold anyway. Cons: a customer returning a sealed item cannot re-buy the
   same day.
2. Neither voids nor returns give it back. Pros: strictest. Cons: punishes a customer whose order we
   cancelled.
3. Both give it back. Pros: friendliest. Cons: "buy, return, re-buy" defeats the limit on paper.
4. Returns give it back only with a manager's reason recorded. Pros: flexible. Cons: creates the
   very override the design forbids; audit exposure.

### 4.2 For counsel (confirm before the marked items become load-bearing)

1. The THC-mg → concentrate-g convention (Q3) and whether §15409(e) means extract weight or THC.
2. Whether medical patients have any concentrate cap and what "the plant conversion" means for
   concentrate purchases by a patient.
3. "Single day": calendar day (local) is acceptable; and whether purchases across our own licences
   must be aggregated or merely may be.
4. Topicals and seeds: inside or outside the buckets.
5. Kief/hash after AB 8 (H&S §11006.5(b), 2026-01-01): concentrate — and any product relabelling
   duty that follows.
6. The verification standard for physician recommendations at sale (is the §15411(b)(1) procedure
   the expected standard for all medical sales, or only for donations), what B&P §2525 et seq.
   requires the recommendation to contain, and caregiver verification under B&P §26140(c).
7. Whether a same-day return re-opens allowance (§15410 is silent).
8. Two deliveries to one customer in one day: any prohibition beyond the cumulative limit.
9. B&P §26001 as amended by SB 170 (operative 2026-07-01): confirm nothing limit-relevant changed.
10. Local ordinances for West Hollywood, Long Beach, Corona, Lake Elsinore and the delivery areas
    (§1.7 checklist).
11. Retention: seven years for the ledger and verification certifications (4 CCR §15037; B&P
    §26071(a)(7)) and any local longer period.
12. The two production defects with legal exposure today: Stilo's classifier/medical bugs (§2.2)
    and the Hyperwolf sign-up that marks every recommendation `verified: true` (§2.3) — whether any
    self-report or remediation is advisable.

---

## Appendix — sources read

Statutes (leginfo.legislature.ca.gov): H&S §§11006.5, 11362.1, 11362.7, 11362.71, 11362.712,
11362.77; B&P §§26001, 26071, 26140, 26153. Regulations (law.cornell.edu mirrors of 4 CCR, checked
against the DCC "Medicinal & Adult Use Cannabis Regulations, July 2026" PDF): §§15000, 15037, 15404,
15408, 15409, 15410, 15411, 15415, 15416, 15418, 15420, 17304. DCC pages: "Compliance with state law";
"Record-keeping/track-and-trace requirements for deliveries"; Disciplinary Guidelines (Sept. 2021).
Vendor: Blaze "How do I enable purchase limits", "Purchase limits … by state"; Treez "California
cannabis compliance guide", "California purchase limits"; Dutchie (search summaries only; article
403). Code: `/Users/jt/hyper-tech/{stilo-backend, hemp-retailer-admin, stilo-frontend-nextjs,
hyperwolf-backend, hyperwolf-frontend-nextjs, hyperdrive-backend, hyperwolf-super-admin,
distribution-backend, promotion-backend, promotion-engine, hemp-backend, hemp-frontend-nextjs}`,
`/Users/jt/POS-Admin` (`pos/`, `shop/`, `shared/commerce-engine.js`, `contracts/schema/*`,
`docs/{CART-AND-CHECKOUT, SWAP-RECOVERY-FLOW, DRIVER-ASSIGNMENT-MODEL, LOYALTY-INTEROP,
METRC-PROGRAM}-PLAN-2026-09-17.md`), `/Users/jt/wm-demo/wmdemo/{catalog, inventory, pos_sales,
pos_sale_lines, store, tax, identity_match}.py`, `/Users/jt/wm-demo/idv-engine/pipeline/medical_rec.py`.
