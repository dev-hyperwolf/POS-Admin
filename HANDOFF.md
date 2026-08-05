# Handoff: Hyperdrive — METRC Batch Pipeline + Engage

## What changed in this drop

If you built against the previous export, these are the deltas. Everything else is unchanged.

0. **Selection is ink, never accent — a rule, not a one-off.** A UI audit found the cool
   `canvas`/`canvas2` ramp (item 3 below) had leaked into ordinary content chrome in the pipeline
   app — table heads, icon plates, hover states, filter bars, notes panels, sticky footers, ~62
   call sites across 15 files — and that several single-select tab/chip groups (Inbox's view
   toggle and status filter, inventory's location filter and sort chips, buyer analytics' time
   horizon and store/category filters, three Engage Analytics window/sort/model toggles, Engage's
   ops actor filter, and the shared `MultiSelectFilter` dropdown used everywhere) were filling the
   *selected* option solid accent yellow instead of ink. Both are fixed at the source now:
   `canvas`/`canvas2` render only the true workspace backdrop (root wrapper, sidebar, kanban
   lanes); every tab/chip/filter's active state is `background: P.ink, color: P.surface` (or the
   outline equivalent). If you're porting a screen and see accent used for anything other than
   the one primary action per view or the loyalty brand color, that's the bug this fixed — replace
   it with ink, don't re-introduce it. `HDTable`'s cell padding was also tightened 1px to match
   `DataTable`'s dense mode. One remaining structural item, not yet done: `HDTable`
   (`shared/hd-ui.jsx`) and `DataTable` (`pos/atoms.jsx`) are still two separate table
   implementations — ~28 call sites use HDTable's raw `<thead>/<tbody>` slot API rather than
   DataTable's `columns`/`rows` props, so unifying them is a deliberate follow-up, not a drive-by.
1. **One brand DB.** `shared/brands.js` (`window.HW_BRANDS`, 16 vendors) is now the only place a
   brand/vendor name is written. POS catalog rows, POS product shells, the pipeline vendor list,
   vendor scorecards and buyer analytics all read from it. **Vendors ARE brands** — do not model
   them as two entities, and never write a brand name as a literal.
2. **"Pricing templates" is now "product shells"** everywhere: route `#/products/shells`,
   `ScreenProductShells`, `PRODUCT_SHELLS`, `productShellId`, `retailFromShell`. A shell owns
   brand, SKU and barcode for a whole SKU family; the product name is the deliberate exception
   and is editable per product.
3. **Cool workspace ramp added to the token file** — `canvas` / `canvas2` (both modes, additive).
   Dense data surfaces (the kanban board page, sidebar, insets) sit on the cool ramp so white
   cards separate properly; the rest of the platform stays on warm `bg`. Board color now comes
   from stage hue, not from yellow — **accent means selection or drop-target only.**
4. **POS product page: the Compliance & traceability tile block is gone.** COA status, earliest
   expiration and supplier license are no longer summary tiles — COA lives per batch in the batch
   table, and `Supplier / vendor` moved up to Product information as a locked field read from the
   brand record. The section is now **Batches & traceability** and holds only the batch list.
5. **Batch card figures are labelled.** The card footer reads
   `206 units × $37.40 ea = $7,704` with a tooltip spelling out unit cost vs total batch value.
   Do not ship a bare `206 × $37.40`.
6. **Batch board header is one white card**, not four floating pieces: a caption row
   (`Currently shown` + live dot + `v{n} · {n} stages`) over an aligned row of
   Entity / Batches / Units / Value / Configure with hairline dividers.
7. **Rail order changed** — `@ Home` sits directly above the Driver App, `Terminals` directly
   below `Members`, and `Engage` is last. `shared/app-nav.js` is the source of truth.
8. **Points ladder** is `$2.50/100 · $5/200 · $10/400 · $20/800` plus a `perk`-marked
   Birthday $20, consistent across register, payment modal and mobile checkout.

## Overview

Two operator consoles for Hyperwolf's Hyperdrive platform, designed as browser prototypes:

1. **METRC Batch Pipeline** — cannabis inbound: invoice intake (OCR + AI line matching), 3-way match, batch lifecycle from receipt to approved-for-sale, compliance holds, inventory/product catalog, AP + credit memos, buyer analytics, vendor scorecards.
2. **Engage** — customer engagement: unified customer profiles, audience segmentation (natural-language → DSL), campaigns, lifecycle flows, loyalty, referrals, wallet passes, and an analytics suite.

Both are recreations of existing Next.js/React source (`hyperdrive-design/prototype` and the Engage monorepo `apps/web/app/console`) re-expressed in Hyperwolf's shared design language, so the same visual system runs across POS, Delivery, Promotions and these two.

## About the design files

**The files in this repo are design references created in HTML.** They are prototypes that show intended look, layout, copy and behavior — not production code to lift.

Each app is a single HTML entry point that loads React 18 + Babel-standalone from a CDN and a set of `.jsx` files as `<script type="text/babel">`. There is no build step, no bundler, no router library, no data layer — routing is `location.hash`, and all data comes from seeded in-file generators.

**The task is to recreate these designs in the target codebase's existing environment** (the real Next.js app, its component library, its server actions / data layer), following that codebase's established patterns. Where the real codebase already has a component that matches (a table, a sheet, a status pill), use it — don't port the prototype's version.

To view a prototype: open the `.html` file directly in a browser (no server needed). Both use `localStorage` for theme (`hw-pos-theme`).

### Counting screens

The route tables below list **16 pipeline routes and 34 Engage routes — 50 in total**. The bundle
defines ~60 `window.Screen*` components because some routes are composed of more than one
component (list + detail + sub-view often live in one file and register separately, e.g.
`ScreenIntegrations` / `ScreenIntegrationDetail`). Build against the **route tables** — they are
the contract. The component split is an artifact of how the prototypes were assembled.

### Color rule (lintable)

Every color resolves from `pos/tokens.jsx`. `hueColor()` and `tone()` in
`shared/hd-format.jsx` read `P.hue[…]` and the `good/warn/bad/info/neutral` token pairs;
`pipeline/domain.jsx` re-exports them rather than redefining. There are no color literals
in any screen, data, or helper file — only in `pos/tokens.jsx` (and the pre-existing dark chrome
of `shared/app-switcher.js` / `shared/tour.js`, which are not part of the two consoles).

## Fidelity

**High-fidelity.** Final colors, typography, spacing, density, states and copy. Every color comes from the shared token file — there is not a single hard-coded hex in any screen file. Recreate pixel-for-pixel using the target codebase's libraries.

Two exceptions to treat as lofi:
- **Charts** are hand-rolled inline SVG (`engage/charts.jsx`, the `LineChart` in `pipeline/screen-vendors.jsx`). Use the codebase's real chart library; match the visual weight (2px stroke, 12% area fill, mono axis labels, no gridlines beyond three horizontal rules).
- **Product imagery** is a generated gradient tile (`Thumb`). Real product photography replaces it.

---

## Design tokens

Source of truth: `pos/tokens.jsx`. Two complete modes. **Light is the default.** Every screen reads tokens via `useP()`; nothing is hard-coded.

### Light mode

| Token | Value | Use |
|---|---|---|
| `bg` | `#F4F2EC` | app background (warm paper) |
| `bg2` | `#EEEBE2` | recessed background |
| `surface` | `#FFFFFF` | cards, sheets, popovers |
| `surface2` | `#FAF9F5` | nested card / table zebra |
| `surface3` | `#F1EFE9` | chips, wells, avatar plates |
| `canvas` | `#EDEFF3` | cool workspace ramp — dense board/table pages |
| `canvas2` | `#E1E6EC` | cool ramp, recessed (column wells, insets) |
| `rail` | `#13130F` | left nav rail (near-black warm) |
| `railInk` | `rgba(255,255,255,.72)` | rail label |
| `railBright` | `#FFFFFF` | rail active label |
| `railHover` | `rgba(255,255,255,.06)` | rail hover |
| `railActive` | `rgba(255,209,0,.14)` | rail active plate |
| `railHair` | `rgba(255,255,255,.08)` | rail dividers |
| `scrim` | `rgba(20,18,12,.42)` | modal/sheet backdrop |
| `ink` | `#0F0F0C` | primary text |
| `ink2` | `#2A2A26` | secondary text |
| `inkDim` | `rgba(15,15,12,.60)` | body/supporting |
| `inkMute` | `rgba(15,15,12,.42)` | labels, metadata |
| `inkFaint` | `rgba(15,15,12,.22)` | disabled |
| `hairline` | `rgba(15,15,12,.08)` | row dividers |
| `hairline2` | `rgba(15,15,12,.14)` | card borders |
| `hairline3` | `rgba(15,15,12,.24)` | emphasis borders |
| `accent` | `#FFD100` | Hyperwolf yellow — the only brand accent |
| `accentInk` | `#1A1400` | text on accent |
| `accentSoft` | `#FFF4B8` | accent tint fill |
| `accentBorder` | `#F2C200` | accent border; also accent-colored **text** in light mode |
| `good` / `goodSoft` | `#1F8A4F` / `#E2F2E8` | ok |
| `warn` / `warnSoft` | `#C07A12` / `#FBEFD6` | warn |
| `bad` / `badSoft` | `#C0392B` / `#F8E2DF` | blocked / error |
| `info` / `infoSoft` | `#2C5BB8` / `#E3ECFA` | info |
| `neutral` / `neutralSoft` | `#6E6E66` / `#ECEAE2` | neutral |
| `indica` / `sativa` / `hybrid` | `#7E55C9` / `#D98316` / `#3F9E72` | strain type |
| `field` / `fieldBorder` | `#FFFFFF` / `rgba(15,15,12,.18)` | inputs |
| `shadowSm` | `0 1px 0 rgba(15,15,12,.04), 0 1px 2px rgba(15,15,12,.05)` | resting card |
| `shadowMd` | `0 1px 0 rgba(15,15,12,.04), 0 6px 18px rgba(15,15,12,.07)` | popover |
| `shadowLg` | `0 1px 0 rgba(15,15,12,.04), 0 18px 44px rgba(15,15,12,.14)` | sheet / modal |

### Dark mode

| Token | Value |
|---|---|
| `bg` / `bg2` | `#0D0D0A` / `#0A0A07` |
| `surface` / `surface2` / `surface3` | `#1A1A14` / `#211F18` / `#28261D` |
| `rail` | `#070705` |
| `railInk` / `railBright` | `rgba(245,243,236,.66)` / `#FBFAF4` |
| `railHover` / `railActive` / `railHair` | `rgba(255,255,255,.05)` / `rgba(255,209,0,.14)` / `rgba(255,255,255,.07)` |
| `scrim` | `rgba(0,0,0,.62)` |
| `ink` / `ink2` | `#F5F3EA` / `#D9D6CA` |
| `inkDim` / `inkMute` / `inkFaint` | `rgba(245,243,234,.60)` / `.40` / `.22` |
| `hairline` / `hairline2` / `hairline3` | `rgba(245,243,234,.09)` / `.15` / `.26` |
| `accent` / `accentInk` | `#FFD100` / `#1A1400` |
| `accentSoft` / `accentBorder` | `rgba(255,209,0,.15)` / `rgba(255,209,0,.40)` |
| `good` / `warn` / `bad` / `info` / `neutral` | `#46C07E` / `#E0A53A` / `#E8675B` / `#6A99EC` / `#9A968B` (soft = same hue at 15–16% alpha) |
| `indica` / `sativa` / `hybrid` | `#A789E0` / `#E5A24E` / `#5DBE93` |
| `field` / `fieldBorder` | `#15150F` / `rgba(245,243,234,.22)` |
| `shadowSm/Md/Lg` | `0 1px 0 rgba(0,0,0,.30)` + `0 1px 2px rgba(0,0,0,.40)` / `0 8px 22px rgba(0,0,0,.45)` / `0 22px 50px rgba(0,0,0,.62)` |

**Accent-text rule (important):** `#FFD100` fails contrast on white. Any accent-colored *text or icon* uses `P.mode === 'dark' ? P.accent : P.accentBorder`. Accent as a *fill* (buttons, active plates) is `P.accent` in both modes with `accentInk` text.

### Category accents (mode-independent)

`flower #3F9E72` · `vape #3F73D6` · `edibles #E0477C` · `concentrate #C2841D` · `tincture #8A5CD6` · `preroll #D45A3C` · `wellness #2FA59B` · `deals #FFD100` · `premium #9A7B3A` · `other #7E7E74`

### Radii

`r6 6` · `r8 8` · `r10 10` · `r12 12` · `r14 14` · `r16 16` · `r20 20` · `r24 24` · `r999 999`

Cards use `r12`/`r14`; inputs and buttons `r10`; chips and pills `999`; icon plates `r8`/`r9`.

### Typography

- **Sans:** `"Inter", -apple-system, system-ui, sans-serif` — all UI text.
- **Mono:** `"JetBrains Mono", "SF Mono", ui-monospace, monospace` — **every** number, ID, METRC tag, timestamp, currency, percentage, SKU, and code token. This is a load-bearing rule of the aesthetic: if it's a value, it's mono; if it's prose, it's sans.

Scale in use:

| Role | Size / weight / treatment |
|---|---|
| Page title | 26–30px / 700 / `letter-spacing:-.02em`; Engage page titles are also `text-transform:uppercase` |
| Section heading (card header) | 14–15px / 600 |
| Body | 13px / 400 / `line-height:1.5` |
| Supporting / description | 12px / 400 / `inkMute` |
| Micro-label (the `MicroLabel` atom) | 10–11px / 600 / uppercase / `letter-spacing:.06em` / `inkMute` |
| Table header | 11px / 600 / uppercase / `letter-spacing:.06em` / `inkMute` |
| Table cell | 13px; numerics mono with `font-variant-numeric: tabular-nums` |
| Big metric (StatTile / KPI) | 22–30px / 500–600 / mono / tabular-nums / `line-height:1` |
| Chip / pill label | 11–12px |

### Spacing

4px base. Screen padding `20px` (pipeline) / `24px` (Engage). Card padding `16` or `20`. Grid/flex `gap` of `8` (tight groups), `12` (card grids), `16`–`20` (page sections). Table cells `padding: 9px 20px` to `12px 20px`.

### Density

Table rows ~40px; list rows ~44px; buttons 28 (xs) / 32 (sm) / 38 (md); inputs 32 (sm) / 40 (md); rail items 36px; chips 22–28px. Touch targets on the mobile scan screen are ≥56px.

---

## Shared component kit

Recreate these once in the target codebase; every screen composes them.

### `pos/atoms.jsx`
`Card` (surface + `hairline2` border + `r14` + `shadowSm`, `padding` prop) · `PBtn` (variants `accent` / `secondary` / `ghost` / `danger`; sizes `xs`/`sm`/`md`; `icon` prop; `full`) · `IconBtn` · `Field` (with optional leading `icon`, sizes `sm`/`md`) · `Check` (custom checkbox) · `Tabs` (underline) · `MicroLabel` · `Thumb` (gradient product tile, `hue` prop) · `Sheet` (right-side drawer, `width` prop, scrim + `shadowLg`) · `KPI` · `StrainPill`.

### `shared/hd-ui.jsx`
`HDPill` (status pill; `tone` = ok/warn/blocked/info/brand/neutral, `size` sm/md, optional leading dot-icon) · `StatTile` (icon plate + label + big mono value + sub; `hue` prop) · `HDTable` / `TH` / `TR` / `TD` (TH: uppercase micro; TD: `align`, `mono` props; TR: optional `onClick` row-link with hover) · `UidChip` (mono ID chip with copy affordance; `kind` = metrc/invoice/order) · `FilterChip` · `Spark` (inline sparkline) · `hdToast` (bottom-right toast; `title`, `description`, `tone`).

### `shared/hd-format.jsx`
`tone(P, name)` → `{fg, bg}` for a semantic tone · `hueColor(P, hue)` · `formatCurrency` · `formatNumber` · `formatPercent` · `formatDate` · `relativeTime` · `ENTITIES` (the four business entities with `id`, `short`, `hue`).

### `shared/app-rail.jsx` + `app-nav.js`
One left rail, one nav list, rendered by every app: 74px collapsed icon rail (the cross-app switcher) + a 200px labelled section list. Active item = `railActive` plate + `railBright` label.

### `pos/icons.jsx`
Single `<Icon name size stroke color />` component, ~150 line-drawn 24×24 glyphs at `stroke-linecap:round`. No inline SVG anywhere else. In the real codebase, map these names onto its icon set rather than porting the paths.

---

## App 1 — METRC Batch Pipeline

Entry: `METRC Batch Pipeline.html` · screens: `pipeline/`

Shell: left rail (Overview / Operations / Finance / Vendors / Admin sections) + a top bar with breadcrumb, command search ("Ask anything", ⌘K), an entity switcher (THC / CCD / AH / HWD, each with a hue dot), a theme toggle, and an avatar.

| Route | File | Purpose |
|---|---|---|
| `#/batches` | `screen-batches.jsx` | Kanban board, 7 lifecycle columns, batch cards with age-pressure border, detail drawer |
| `#/batches/archive` | `screen-batches-extra.jsx` | Archived batches, filters, restore |
| `#/batches/merge` | `screen-batches-extra.jsx` | Merge-eligibility picker + 4-step wizard |
| `#/compliance` | `screen-compliance.jsx` | METRC sync · documents · recalls · audit tabs |
| `#/compliance/holds` | `screen-compliance.jsx` | Active holds + package lineage tree |
| `#/inbox` | `screen-inbox.jsx` + `inbox-match.jsx` | Invoice inbox, auto-post rate, needs-you queue, AI line matching |
| `#/invoices/:id` | `screen-invoice.jsx` | 3-way match, unmapped METRC UID resolver, variance table, evidence |
| `#/scan` | `screen-scan.jsx` | Floor intake on a phone — large targets, glove mode |
| `#/inventory` | `screen-inventory.jsx` | On-hand by package, hold state, location |
| `#/products` | `screen-inventory.jsx` | Product wrapper grid |
| `#/products/:id` | `screen-product-detail.jsx` | Wrapper detail, batch table with per-lot margin, unmapped-batch attach sheet |
| `#/products/shells` | `screen-product-detail.jsx` | Product shells — SKU-family pricing, edit → review-diff → commit |
| `#/ap` | `screen-finance.jsx` | Aging buckets, invoice list, payment drawer |
| `#/credits` | `screen-finance.jsx` | Credit memos, reason taxonomy, status |
| `#/credits/new` | `screen-finance.jsx` | Compose a memo against an invoice, per-brand line selection |
| `#/buyers` | `screen-buyers.jsx` | Sell-through, margin, stockout thermometer, brand mix |
| `#/scorecards` | `screen-vendors.jsx` | Vendor list + metrics + 12-month cost trend + anomalies |
| `#/admin/pipeline` · `#/admin/catalog` | `screen-admin.jsx` | Stage configuration; master catalog |
| `#/settings/flags` | `screen-vendors.jsx` | Runtime config flags with reason-required edit modal |

### Key screen: batch board (`#/batches`)

Full-height horizontal-scroll board owning the remaining viewport height (no page scroll). Seven fixed 300px columns with `gap:12`; each column is a flex-column with its own `overflow-y:auto` list so cards never compress. Column header: uppercase micro-label + mono count + a 3px hue bar.

Header: one white card (`surface`, `r12`, `hairline2`, `shadowSm`, min-width 380). A caption strip on `surface2` carries `Currently shown` + a green live dot + `v{version} · {n} stages`; beneath it a single row of Entity (hue dot + select) / Batches / Units / Value (with an info affordance) / a `Configure` secondary button, divided by `hairline`. Do not scatter these as separate right-aligned blocks — they wrap badly and lose their shared baseline.

Batch card: `surface`, `r12`, `hairline2` border, `padding:12`, `gap:8`. Top row is a `UidChip` for the METRC package + an entity dot. Then product name (13px `ink`), then brand · category (11px `inkMute`). Footer row is the labelled cost line — `{qty} units × {unitCost} ea = {total}` in mono, units/ea/× /= in `inkMute` so the numbers carry — with a tooltip reading "{qty} units at {unitCost} wholesale cost each — {total} total batch value". **Age pressure** re-colors the left border: under `batch.age_warn_hours` → `hairline2`; over → `warn` at 40% alpha; over `batch.age_blocked_hours` → `bad`. Cards are draggable between columns; dropping fires a toast and writes an audit line.

Detail drawer (`Sheet`, 520px): header with package UID, status pill, entity; sections for COA + lab results, lineage, hold state, cost/margin, activity timeline. Footer actions: Approve for sale (accent), Place hold, Merge, Print labels.

### Key screen: invoice detail (`#/invoices/:id`)

Two-column `minmax(0,1fr) 360px`, collapsing to one below 1180px. Header: vendor mark, invoice number (26px mono), status pills (match state, OCR confidence, received date, manifest UID). Then a large mono total with subtotal/tax beneath. If UIDs are unmapped, a `bad`-toned banner blocks auto-post and an "Unmapped manifest UIDs" card lists each with a resolve control. Right column: manifest summary, vendor card, activity. Sticky bottom action bar: Open credit memo · Request corrected invoice · Escalate to CFO · **Accept & post** (accent).

---

## App 2 — Engage

Entry: `Hyperwolf Engage.html` · screens: `engage/`

Same shell; rail sections are Reach / Engage / Understand / Operate. Page titles are uppercase 28–30px/700.

| Route | File | Purpose |
|---|---|---|
| `#/` | `screen-home.jsx` | Console dashboard — sends, revenue attribution, live activity |
| `#/customers` · `#/customers/:id` | `screen-customers.jsx` | List with predictive scores; profile with audited PII reveal, unified balance, timeline |
| `#/audiences` | `screen-audiences.jsx` | Saved audiences, size, refresh state |
| `#/audiences/new` | `screen-audience-builder.jsx` | Natural-language → validated DSL, trait catalog, live count preview |
| `#/audiences/:id` · `/compare` · `/suggested` | `screen-audiences.jsx` | Detail, overlap comparison, nightly-clustered suggestions |
| `#/flows` · `/:id` · `/:id/runs` · `/new` · `/templates` | `screen-flows.jsx` | Lifecycle automations — list, canvas composer, run history, templates |
| `#/loyalty` · `#/loyalty/:id` | `screen-loyalty.jsx` | Liability rollup, tiers, rewards, top wallets |
| `#/referrals` · `/programs` · `/fraud` | `screen-loyalty.jsx` | Referral programs and fraud review queue |
| `#/wallet` | `screen-loyalty.jsx` | Apple/Google pass design + push updates |
| `#/campaigns` · `#/messages` · `#/templates` · `#/interactive` | `screen-campaigns.jsx` | Campaign list, per-send policy chain, template library, games |
| `#/analytics/*` (8 views) | `screen-analytics.jsx`, `screen-analytics2.jsx` | Overview, engagement, revenue, cohorts, funnels, deliverability, usage, exports |
| `#/integrations` · `/:id` | `screen-ops.jsx` | Connectors, per-resource circuit breakers, mapping confidence |
| `#/audit` · `#/health` | `screen-ops.jsx` | Event firehose; provider/pipeline/model/compliance checks |
| `#/settings` · `/cost` · `/flags` · `#/onboarding` | `screen-ops.jsx` | Tenant settings, spend caps, feature flags, 5-step setup |

### Key screen: audience builder (`#/audiences/new`)

Two columns: form (flexible) + 320px trait catalog, collapsing to a single column below ~1100px where the form comes first. The prompt field takes plain English ("customers who bought concentrates twice in 60 days but haven't opened an SMS in 30"); on submit it renders the compiled DSL in a mono block with syntax tinting, a validation strip, and a live matching-count preview that animates to its value. The trait catalog is a searchable, grouped list; clicking a trait inserts it.

### Key screen: message policy chain (`#/messages`)

Every send row expands to show the 7-rule compliance chain evaluated in order — consent, age gate, quiet hours (customer-local), frequency cap, suppression list, jurisdiction, content review — each as a pass/hold/fail `HDPill` with the evaluated value beside it. A hold shows the release time rather than a failure.

---

## Interactions & behavior

- **Navigation** — `location.hash`; each app has one `navigate(hash)` helper threaded to screens. In the real app these become real routes.
- **Drag** — batch cards between board columns (HTML5 drag events). Drop → optimistic move + toast + audit line.
- **Sheets** — slide in from the right over a `scrim`; close on backdrop click or Esc.
- **Modals** — centered over `scrim`; destructive/irreversible actions (product-shell commit, flag change) require a review step or a typed reason before the confirm button enables.
- **Toasts** — bottom-right, auto-dismiss ~4s, tone-colored left edge.
- **Row links** — whole table rows are clickable where the row has one obvious destination; hover raises the row to `surface2`.
- **Sorting** — click a column header to sort; second click flips direction; the active header shows an arrow, inactive show a dimmed sort glyph.
- **Filters** — chip rows; active chips take `accentSoft` fill + `accentBorder`; an "Active" summary row lets you clear each.
- **Transitions** — 120–160ms ease for hover/toggle; no entrance animations on data.
- **Empty states** — centered icon (24px, `inkMute`) + one sentence; never a blank panel.
- **Loading** — not designed; use the codebase's skeleton pattern, matching row heights above.
- **Responsive** — designed for ≥1280px. Two-column layouts collapse to one at 1100–1200px via the `.hd-2col` / `.hd-prod` / `.hd-split` / `.eg-2col` rules in each HTML's `<style>`. The scan screen is phone-first.

## State

Prototype state is all local `React.useState`. In the real app:

- **Server state** — batches, invoices, products, customers, audiences, campaigns, sends, flags. Fetch through the codebase's existing data layer; the prototype's seeded generators (`pipeline/data*.jsx`, `engage/data.jsx`) document the exact row shapes each screen expects.
- **UI state** — filter/sort/tab selections, drawer + modal open state, board drag state, builder draft, wizard step, form drafts.
- **Persisted** — theme mode in `localStorage` under `hw-pos-theme`.
- **Derived** — margin %, sell-through, days-of-supply, stock health, aging buckets, audience overlap, liability. Formulas live in `pipeline/data-buyer.jsx` and `pipeline/domain.jsx`; port them as pure functions and unit-test them.

## Assets

None external. Icons are the inline set in `pos/icons.jsx`; product images are generated gradient placeholders; no fonts are bundled (Inter + JetBrains Mono are expected from the host page). All fixture data is synthetic, generated from fixed seeds — no real customer, vendor, or METRC data is in this repo.

## Files

```
METRC Batch Pipeline.html        entry — loads React, tokens, atoms, rail, pipeline/*
Hyperwolf Engage.html            entry — same, loads engage/*
pos/tokens.jsx                   THE theme — both modes, all tokens
pos/icons.jsx                    the icon set
pos/atoms.jsx                    Card, PBtn, Field, Sheet, Tabs, Thumb, …
shared/hd-ui.jsx                 HDPill, StatTile, HDTable/TH/TR/TD, UidChip, Spark, toast
shared/hd-format.jsx             tone(), hueColor(), uid*, formatters, ENTITIES
shared/app-nav.js                the one nav list
shared/brands.js                 THE brand (vendor) DB — one list, every surface
shared/app-rail.jsx              the one rail component
shared/app-switcher.js           cross-app launcher
shared/tour-steps.js · tour.js   guided walkthroughs, keyed by filename
pipeline/                        21 files — app.jsx (router+shell), data*.jsx (fixtures),
                                 domain.jsx, kanban.jsx, inbox-match.jsx, screen-*.jsx
engage/                          13 files — app.jsx, data.jsx, charts.jsx, screen-*.jsx
```

The repo also contains Hyperwolf's other consoles (POS, Delivery, Promotions, Logistics, Driver
App, Shop @ Home, Members CRM, Terminals) — same tokens, same rail. They are context, not part of
this handoff. `Hyperwolf.html` is the hub that links all of them.

Note on load order: `shared/hd-format.jsx` must load **before** `pipeline/domain.jsx` — domain
extends the shared `window.HD` rather than replacing it.

Start with `app.jsx` in either folder: it holds the route table, the shell, and the list of every screen component.
