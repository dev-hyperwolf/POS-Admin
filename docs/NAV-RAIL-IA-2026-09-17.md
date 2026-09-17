# Nav Rail — Information Architecture (2026-09-17)

Design-only. No code in `shared/app-nav.js` or any screen changed by this doc. This is the
inventory, the problems, and the one grouping all four `explorations/Nav Rail - Concept
{A,B,C,D}.html` mockups implement identically. Read this before opening any of the four.

## 0. Method

Every destination below was found by reading, not guessing:
- `shared/app-nav.js` (the static rail item list + the D2 session chip)
- `pos/app.jsx` lines 1–124 (six `NAV.items.splice(...)` blocks that mutate the rail
  **at runtime, only inside `Hyperwolf POS.html`**)
- `Hyperwolf.html` (the app-switcher hub page — a second, independent list of apps)
- Every top-level `*.html` file and the screen files each one loads (`engage/app.jsx`,
  `pipeline/app.jsx`, `idv/app.jsx`, `incentives/app.jsx`, `logistics/*.jsx`,
  `delivery/dapp.jsx`, `athome/admin.jsx`, `athome/crm.jsx`, `mobile/app.jsx`,
  `rfid/app.jsx`, `forms-app/app.jsx`, `docs-app/app.jsx`, `terminals/*.jsx`)

## 1. Inventory — every destination today

**30 top-level destinations** answer to a staff member today (consumer-facing
`Hyperwolf Shop.html` and `Customer Account.html` are excluded — neither loads
`shared/app-nav.js`, confirming they are not part of this rail).

Of the 30: **21 are in the static list** (`shared/app-nav.js` lines 6–41), **6 more exist
only at runtime inside `Hyperwolf POS.html`** (spliced in by `pos/app.jsx`), and **2 are
built and linked from the app hub but have no rail entry anywhere** (Members CRM,
Weedmaps Integration Control Center).

| # | App → screen | Where it lives today | Internal depth | Primary role |
|---|---|---|---|---|
| 1 | Home | pos route `home` (app-nav.js:7) | 1 screen | budtender |
| 2 | Register | pos route `register` (app-nav.js:8) | 1 screen | budtender |
| 3 | Floor Restock | pos route, spliced after Register (app.jsx:105-122) | 1 screen | budtender |
| 4 | Orders | pos route `orders`, badge (app-nav.js:9) | 1 screen | budtender/dispatcher |
| 5 | Merch | pos route `merch` (app-nav.js:18) | 1 screen | store lead |
| 6 | Members | pos route `members` — **mock data only**, `pos/screen-stubs.jsx` | 1 screen | budtender |
| 7 | Identity & binding | pos route, spliced after Members (app.jsx:86-103) | 1 screen | LP/store lead |
| 8 | Members CRM | `Members CRM.html` → `athome/crm.jsx` — **no rail entry**, hub-only (`Hyperwolf.html:116`) | 1 screen | budtender/store lead |
| 9 | Verify | `Hyperwolf Verify.html` → `idv/app.jsx` | 8 routes (home, people, sessions, workflows, lists, integrate, usage, settings) | LP/compliance |
| 10 | Catalog | pos route `catalog` (app-nav.js:10) | 1 screen | inventory |
| 11 | Brands | pos route, spliced after Catalog (app.jsx:9-18) | 1 screen | inventory |
| 12 | Category map | pos route, spliced after Brands (app.jsx:33-51) | 1 screen | inventory |
| 13 | Pricing | pos route, spliced after Category map (app.jsx:53-70) | 1 screen (external service, localhost:8799) | inventory/owner |
| 14 | Publish gate | pos route, spliced after Brands (app.jsx:72-84) | 1 screen | inventory |
| 15 | Cities | pos route, spliced after Brands (app.jsx:20-31) | 1 screen | inventory |
| 16 | Batches | `METRC Batch Pipeline.html` → `pipeline/app.jsx` | 11 routes, **already grouped internally**: Overview / Operations / Finance / Compliance / System (`pipeline/app.jsx:5-28`) | inventory |
| 17 | RFID | `rfid/index.html` → `rfid/app.jsx` | 5 screens (counts, handheld, kits, system, tags) | inventory |
| 18 | Promos | `Promotions Suite.html` → `promo/*.jsx` | 2 screens (builder, analytics) | owner/marketing |
| 19 | Swap & Upsell | `Swap and Upsell Engine.html` | 1 screen | owner/marketing |
| 20 | Engage | `Hyperwolf Engage.html` → `engage/app.jsx` | **28 routes**, already grouped by URL prefix (audiences/campaigns/flows/loyalty/referrals/analytics ×9/settings) (`engage/app.jsx:241-256`) | owner/marketing |
| 21 | Delivery | `Hyperwolf Delivery.html` → `delivery/dapp.jsx` | 1 screen, delivery/pickup toggle | dispatcher |
| 22 | Dispatch | `Hyperdrive Logistics.html` → `logistics/lviews.jsx` | 3 views (board, map, lanes) | dispatcher |
| 23 | @ Home | `Shop at Home.html` → `athome/admin.jsx` | 4 screens: Appointments, Live map, Geniuses, Regions (`athome/admin.jsx:546-551`) | dispatcher |
| 24 | Drivers App | `Hyperwolf Driver App.html` → `mobile/app.jsx` | ~10 phone screens (activity, appointment, checkout, complete, discrepancy, home, misc, msg, profile, shop, task) | driver (phone, not desk) |
| 25 | Bounty | `Hyperwolf Bounty.html` → `incentives/app.jsx` | 9 routes (standings, contests, earnings, learn, data, goals, settings) | owner/HR, store lead reads |
| 26 | Forms | `Hyperwolf Forms.html` → `forms-app/app.jsx` | 2 screens (Form, Submissions) | HR/owner, cross-role fill |
| 27 | Docs | `Hyperwolf Docs.html` → `docs-app/app.jsx` | 3 screens (Pages, Search, Ask) | owner/dev only |
| 28 | Terminals | `POS Terminal Configuration.html` → `terminals/*.jsx` | 1 screen (canvas + drawer) | owner/IT |
| 29 | Settings | pos route `settings` (app-nav.js:42) | 1 screen | owner |
| 30 | Weedmaps Integration Control Center | `dashboard.html` — **no rail entry, no `app-nav.js`/`app-switcher.js` at all** | 1 screen | owner only |

**Known gaps, not destinations yet:** `explorations/HR Overview - Concept {A-D}.html` and
`explorations/LP Triage - Concept {A-D}.html` are real, reviewed design work for an HR
landing screen and an LP triage/case-decision screen — neither is wired to a route yet.
HR and LP are two of the seven roles this brief asks the rail to serve, and today **neither
has a single live destination**. The grouping below reserves a home for both so shipping
them later is a placement decision, not another re-org.

## 2. Usage assumptions by role

| Role | Lives in | Rarely/never opens |
|---|---|---|
| **Budtender** | Sell, Members (Members/Members CRM/Verify lookup only) | Catalog's back-office screens, Delivery, Marketing, People, Admin |
| **Store lead** | Sell (all), Members (all), Catalog (read + Category map), People→Bounty (own store) | Admin, Engage authoring, Publish gate (approves, doesn't author) |
| **Inventory** | Catalog (all), Batches, RFID | Sell's Register, Delivery, Marketing |
| **Delivery dispatcher** | Delivery (all) | Catalog, Marketing, People, Admin |
| **HR** *(no live destination yet)* | Would live in People, once built | everything else |
| **LP** *(no live destination yet)* | Verify today (Members category); LP Triage once built | Catalog authoring, Marketing, Admin |
| **Owner/admin** | Everything, plus Admin exclusively | — |

## 3. Problems with the current rail (cited)

1. **The rail's size and order depend on which page you're standing on.**
   `shared/app-nav.js:6-41` defines 21 items. `pos/app.jsx:9-124` runs six IIFEs that
   `NAV.items.splice(...)` six more items in **only when `Hyperwolf POS.html` loads them**
   (brands 9-18, cities 20-31, category-map 33-51, pricing 53-70, publish-gate 72-84,
   identity-binding 86-103, floor-restock 105-122). Anyone on `Hyperwolf Docs.html` sees
   a 21-item rail; the same person on `Hyperwolf POS.html` sees 27, in a different order,
   for the same account.

2. **The order is an accident of splice targets, not a design.** Each IIFE inserts
   "after whatever index X currently has" — `pos/app.jsx:15` finds `catalog` and inserts
   Brands after it; `pos/app.jsx:29` then finds `brands` and inserts Cities after *that*;
   `pos/app.jsx:47` finds `brands` again and inserts Category map, landing it *before*
   Cities even though Cities' own comment (`pos/app.jsx:20-21`) never mentions Category
   map. The resulting order (`catalog, brands, publish-gate, category-map, pricing,
   cities`) is not asserted anywhere as intentional — it is whatever six sequential
   `Array.splice` calls happened to produce.

3. **Two shipped apps have no rail entry at all.** `Members CRM.html` and `dashboard.html`
   are real, working screens, linked from the app hub (`Hyperwolf.html:116`, `:146`), but
   absent from `shared/app-nav.js`'s `ITEMS` (lines 6-41) and — for `dashboard.html` —
   absent even from `shared/app-switcher.js`. A user has no path to either except typing
   the filename.

4. **Duplicate icon, two different destinations.** `shared/app-nav.js:27` (Docs) and
   `:31` (Forms) both use `icon: 'note'`. In any collapsed/icon-only state — which every
   concept below needs for mobile and for the collapsed desktop rail — these two are
   visually identical.

5. **No principle for "sub-screen becomes a rail item."** POS's internal screens get
   promoted to six full top-level rail slots. Engage has 28 internal routes, already
   grouped by URL prefix (`engage/app.jsx:241-256`); METRC Batch Pipeline has 11, already
   grouped into its own five-category sidebar (`pipeline/app.jsx:5-28` — Overview /
   Operations / Finance / Compliance / System); Verify has 8; Bounty has 9. None of those
   get extra rail slots. Nothing in the code says why POS is different — it is simply
   the one app whose author had rail-mutation access (`pos/app.jsx`'s own comment at
   lines 4-8 says as much: "the rail renders `window.HW_NAV.items`... a POS-only screen
   registers itself by MUTATING that array").

6. **Grouping intent exists only as comments, never as UI.** `shared/app-nav.js` has real
   editorial grouping already — "physical-goods run" (lines 12-14), "people-adjacent"
   (20-21), "internal ops console" neighborhoods (23-26, 28-30), "identity-adjacent"
   (32-34) — but it is expressed purely in source comments next to a flat array. The
   rendered rail is one undifferentiated list of ~21-27 items with no headers, no
   collapsing, no visual grouping at all.

7. **No search, no recents, no favorites**, on a list that is already too long to scan —
   30 destinations, most staff need 3-6 of them.

8. **Naming.** `@ Home` (`shared/app-nav.js:38`) names nothing — it's the Shop-at-Home
   concierge console (`athome/admin.jsx`: Appointments/Live map/Geniuses/Regions) and
   reads like a typo, not a product name. `Members` (pos route, **mock data** per
   `pos/screen-stubs.jsx`'s own top comment) and `Members CRM` (real, newer, per the
   owner's 2026-09-10 decision that "Members CRM is the one member module") both
   plausibly answer "look up a customer," with nothing marking which is authoritative.
   `Docs` sounds like paperwork; it is actually the dev/audit console
   (`docs-app/app.jsx`) — easily confused with `Forms`, the actual paperwork runtime.

9. **The session chip is structurally outside the rail.** `shared/app-nav.js:73-147`
   self-mounts a `position:fixed` chip at `top:68px;right:16px` — correct that it had to
   (the file's own comment at lines 65-72 explains why: touching `pos/shell.jsx`'s TopBar
   was out of scope for that task) — but it means "who am I, which store" today lives in
   a completely separate DOM subtree from the rail, redrawn on a timer
   (`setInterval(render, 20000)`, line 143), rather than being part of one navigation
   surface. Worth fixing now that the rail itself is being redesigned.

## 4. The one grouping — used by all four concepts

**7 categories.** Every one of the 30 destinations above is placed in exactly one.

### Sell — the front counter (5)
Home · Register · Floor Restock · Orders · Merch

*Why together:* the one continuous, always-open loop for a person standing on the floor
during a shift — check someone in, ring them up, keep the shelves stocked, work the
order queue, refresh a seasonal display. No back-office step and no screen a budtender
doesn't already use today.

### Members — who is this person (4)
Members · Members CRM · Identity & binding · Verify

*Why together:* every screen in the current rail whose job is answering "who is this
customer" — the (mock) loyalty lookup, its real successor, binding a Weedmaps account to
a customer record, and the ID/liveness verification console. Consolidating these ends
problem #8 above: one category, one place to look, and the IA can label which of
Members/Members CRM is current without touching either file.

### Catalog — what's for sale (8)
Catalog · Brands · Category map · Pricing · Publish gate · Cities · Batches · RFID

*Why together:* one physical + data flow, already described as intentional in the
current file's own comments (`shared/app-nav.js:12-14`) — a batch gets approved, tagged
(RFID), priced and published (Pricing → Publish gate is a literal author → QA-gate
sequence), assigned to a served city, and only then shows up in Catalog/Brands/Category
map for the floor to sell. This is also the six POS-injected items from problem #1/#2 —
folding them into one named category, rather than six flat top-level slots, directly
fixes the "accident of splice order" problem, without requiring any change to
`pos/app.jsx`'s registration mechanism (each item still declares itself; only its
*presentation* groups it).

### Delivery — outside the four walls (4)
Delivery · Dispatch · @ Home · Drivers App

*Why together:* routing, driver assignment, and the concierge/appointment console are one
dispatcher's job across three different data sources today; the fourth is literally the
driver's own screen. Rename recommendation: `@ Home` → **Shop at Home** (the app's own
`<title>`, already correct — `Shop at Home.html:6`) so the label matches every other item
in this rail's naming convention (a name, not a symbol).

### Marketing — getting people back in (3)
Promos · Swap & Upsell · Engage

*Why together:* all three are demand-generation, owned by the same person (marketing/
owner), and distinct in *purpose* from Members even though both touch customer data —
Marketing asks "how do we reach this segment," Members asks "who is this one person."

### People — the team, not the customer (2)
Bounty · Forms

*Why together:* the only two current destinations about staff rather than customers —
incentive standings and the e-sign/paperwork runtime (onboarding, write-ups, etc. all
render through `forms-app/app.jsx`'s one `FormHost`). **Reserved, not renamed:** this is
where HR Overview lands once it ships (see §1's gap note) — the category name is chosen
now so that isn't a future re-org.

### Admin — configuration, owner-only (4)
Terminals · Settings · Docs · Weedmaps Integration Control Center

*Why together:* nobody touches these mid-shift. Terminals (hardware config), Settings,
Docs (the dev/audit console — flagged for a rename to **Dev Console** so it stops reading
as "paperwork"), and the Weedmaps Integration Control Center (`dashboard.html`, today
completely unreachable from any rail — this grouping is also its first-ever home).

---

Category order in the rail (top to bottom): **Sell, Members, Catalog, Delivery,
Marketing, People, Admin** — highest-frequency, most-roles-use-it first; Admin last
because only one role ever opens it.

## 5. Role-based visibility

A role never sees a category with zero destinations available to it, and a budtender
specifically **never sees**: Catalog's Brands/Category map/Pricing/Publish gate/Cities/
Batches/RFID, all of Delivery, all of Marketing, Bounty's contest-builder or Forms'
authoring view (fills forms, doesn't build them), or anything in Admin. Everything else
in this document's role table (§2) maps directly to which categories expand by default
for that person — a budtender's rail opens with Sell already expanded and every other
category collapsed; an owner's rail opens with all seven visible and none forced open.

## 6. Search, recent, favourites

All three live in one persistent zone **above** the seven categories, never inside one —
they cut across categories (search matches items in Catalog and People from the same
box; a recent item can be from any category; a favourite is a personal shortcut, not a
new destination). Concepts A/B/D show this as a fixed strip at the top of the rail;
Concept C promotes it to the primary interaction (⌘K palette) and keeps categories as
the fallback for someone who doesn't know the command yet.

## 7. Naming fixes (summary)

| Current | Fix | Reason |
|---|---|---|
| `@ Home` | Shop at Home | matches the app's own title; a symbol isn't a name |
| `Docs` | Dev Console | it's `docs-app`'s code/audit search, not paperwork — collides with Forms |
| `Members` (mock) shown equal to `Members CRM` (real) | label the CRM entry "Members" and the legacy pos-route "Members (legacy)" until it's retired | one is fixture data (`pos/screen-stubs.jsx`), the other is the owner's decided direction |
| Docs' and Forms' icon (`note`, `note`) | give Dev Console a distinct icon (e.g. `terminal` or `code`) | two destinations must not render identically in a collapsed rail |
