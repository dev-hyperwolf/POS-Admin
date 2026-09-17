# Hyperwolf Mobile-Readiness Audit — 2026-09-17

Read-only, code-reading audit of every top-level app and screen in `/Users/jt/POS-Admin`, judged at **390×844** (phone) and **820×1180** (tablet portrait), with **375×812** and **360×800** used as secondary phone checks where a finding was borderline. No source file was edited to produce this report (four fix commits landed *today, separately*, from the owner's own session — see "Already fixed today" below — and are reflected in the classifications, not authored by this audit).

**Screenshot verification**: not possible. `npx playwright --version` requires installing the `playwright` package and its browser binaries, which this task's hard rules forbid installing. All findings below are from direct code reading (JSX/CSS-in-JS, grep for grid/table/drag/hover/viewport/inputMode/safe-area patterns), not rendered screenshots.

**Method note on explorations/**: the 73 files under `explorations/` and the 4 concept apps under `rfid/`, `rfid-direction-a/b/c/` are pre-decision design decks (their own ABCD-concept naming convention already satisfies the owner's "four concepts before a new layout" rule) — audited as a group, not screen-by-screen, since none are wired into `Hyperwolf.html`'s production nav except where explicitly linked. `distribution-engine/` is a headless Node package (engine + tests, no UI) — out of scope. `exports/*.html` are frozen Aug 26 snapshots that have already diverged from live (live's own shared dependencies were touched as recently as today) — not separately audited; treat as stale, not as mirrors.

---

## 1. Page inventory

| App (entry HTML) | Screen source | Screens/views counted |
|---|---|---|
| Hyperwolf POS.html | `pos/*.jsx`, `idv/*.jsx` (embedded) | 47 |
| Hyperwolf Verify.html | `idv/screen-*.jsx`, `idv/capture.html` | 10 |
| Hyperwolf Forms.html | `forms-app/*.jsx` | 4 |
| Hyperwolf Docs.html | `docs-app/*.jsx` | 5 |
| Hyperwolf Engage.html | `engage/*.jsx` | 12 |
| Hyperwolf Delivery.html | `delivery/dapp.jsx` + `dmap.jsx` | 7 |
| Hyperwolf Driver App.html | `mobile/*.jsx` | 17 |
| Hyperwolf Bounty.html | `incentives/*.jsx` | 15 |
| Members CRM.html | `athome/crm.jsx` | 5 |
| Customer Account.html | `athome/account-a/b/c/switch.jsx` | 4 |
| Shop at Home.html | `athome/admin.jsx` | 5 |
| Promotions Suite.html | `promo/*.jsx`, `pweb/*.jsx` | 16 |
| Hyperwolf Shop.html | `shop/*.jsx` | 5 |
| Hyperdrive Logistics.html | `logistics/*.jsx` | 8 |
| POS Terminal Configuration.html | `terminals/*.jsx` | 7 |
| METRC Batch Pipeline.html | `pipeline/*.jsx` | 14 |
| dashboard.html | inline workspaces | 11 |
| Swap and Upsell Engine.html | inline flows | 2 |
| sign.html | `shared/hd-form.jsx`, `shared/hw-sign-page.jsx` | 3 |
| Hyperwolf.html | app-launcher hub | 3 |
| index.html | redirect only | 1 |
| **Total** | | **201** |

Plus, audited as a group (not row-by-row): **73** `explorations/` concept decks, **4** `rfid*` concept apps. `distribution-engine/` excluded (no UI).

---

## 2. Scoreboard

Class key: **Ready** · **Minor** (≤ half a day) · **Needs mobile layout** (own responsive design — four concepts before build, per owner rule) · **Desktop-only** (by nature, with a stated phone fallback) · **N/A** (no render code, or a redirect) · **Locked** (owner rule — never edit `pos/screen-register.jsx`).

Rows marked **FIXED 2026-09-17** were resolved today by commits `7164204`, `ab9c5a0`, `e40f189`, `e08322a` (verified against the actual diffs, not just the commit messages) — done by the owner's own session, independent of this audit.

### Hyperwolf POS

| Screen | File(s) | Class | Top issues | Fix size |
|---|---|---|---|---|
| Router / shell | pos/app.jsx | Needs mobile layout | No viewport branching anywhere; wraps every screen in fixed-rail layout; `main` has non-standard `zoom:1.08` | 1d — gated on rail fix below |
| Left nav rail | shared/app-rail.jsx | Needs mobile layout | Fixed `width:74` always, comment admits target is "survive a 700px laptop"; no phone collapse | See §3 shared fix #1 — design already drafted, docs/NAV-RAIL-IA-2026-09-17.md, owner pick pending |
| Top bar | pos/shell.jsx | Needs mobile layout | ~10-control no-wrap row overflows under 900px; 3 dropdown menus have no edge-clamp | 1d |
| Shared atoms | pos/atoms.jsx | Minor (systemic) | `Check` checkbox 20×20 no padding; `ctrlH` sm/md (34/40) under 44px; `DataTable` no card fallback | 1d — see §3 shared fix #2 |
| Design tokens | pos/tokens.jsx | Minor (systemic) | No breakpoint tokens at all — prerequisite for every other POS fix | 2h |
| store/stores/data/icons/dev-note | pos/*.jsx (logic only) | Ready | No render markup | — |
| Home dashboard | pos/screen-home.jsx | Minor | Fixed 4-col KPI row tight at 390px | half day |
| Catalog — browse | pos/screen-catalog.jsx (list) | Minor | List view leans on `DataTable` (h-scroll only); fixed 5-chip metric strip | half day |
| Catalog — detail/editor | pos/screen-catalog.jsx (detail) | Needs mobile layout | Fixed `300px 1fr` + `1fr 336px` columns exceed 390px viewport outright | 2–3d |
| Cart / checkout pane | pos/screen-cart.jsx | Needs mobile layout | Pane is `flex:'0 0 408px'` — wider than a 390px phone. **Highest-priority screen: this is the money screen.** | 2d |
| Orders — list/kanban/check-in | pos/screen-orders.jsx | Minor | H-scroll kanban ok; several `1fr 340px` side splits break at 390 | 1d |
| Orders — dispatch routing map | pos/screen-orders.jsx (RouteMap) | Desktop-only | 560px schematic map + 340px list; back-office dispatcher tool | Fallback: plain ordered stop list, no map (1d) |
| Orders — modals | pos/screen-orders.jsx (modals) | Minor | Overlay pattern correct; a couple of unclamped dropdown catchers | half day |
| Pricing comparison | pos/screen-pricing.jsx | Minor | Best-behaved grid in the app (`auto-fit`); still no breakpoint | half day |
| Brands | pos/screen-brands.jsx | Minor | `auto-fill`/`auto-fit` grids fine; small `Check` targets inherited | half day |
| Categories (taxonomy admin) | pos/screen-categories.jsx | Desktop-only | Two `minWidth:900` tables (wrapped, functional but poor); back-office taxonomy tool | Fallback: read-only category list w/ counts (1d) |
| Categories — edit panel | pos/screen-categories-edit.jsx | Minor | Fixed 2-col form grid doesn't collapse under 480px | half day |
| Category map (taxonomy reconciliation) | pos/screen-category-map.jsx | Desktop-only | HTML5 drag-sort, but already has a working tap alternative (`select` + button); dense back-office tool | Fallback: simplified single-queue list (2d) |
| City listing | pos/screen-city-listing.jsx | Minor | All `auto-fit`/`minmax`, no tables — cleanest screen in this app | half day |
| Floor Restock | pos/screen-floor-restock.jsx | Minor | Shelf-plan grid has no overflow-x wrapper, unlike siblings | half day |
| Merchandising board | pos/screen-merch.jsx | Minor | Region×surface matrix forces `minWidth:720` | half day |
| AOV — home widget | pos/screen-aov.jsx (Dashboard) | Ready | Overflow-x wrapped table, KPI grid holds at 390 | — |
| AOV — goal manager | pos/screen-aov.jsx (Manager) | Minor | Roster row has no flexWrap; goal input lacks `inputMode` | half day |
| Identity & binding | pos/screen-identity-binding.jsx | Minor | Missing `inputMode="numeric"`; otherwise well-built slide-over | half day |
| Bounty home card | pos/screen-incentives-card.jsx | Ready | Flex-wrap discipline throughout | — |
| Publish gate | pos/screen-publish-gate.jsx | Minor | `BoundLocations` rows lack flexWrap/overflow | half day |
| Members (roster) | pos/screen-stubs.jsx (Members) | Minor | 9-col `DataTable` very wide at 390px | half day |
| Member detail | pos/screen-stubs.jsx (MemberDetail) | Needs mobile layout | Hard-coded `1fr 320px` body grid, no breakpoint | 1d |
| Settings + sub-panels | pos/screen-stubs.jsx (Settings) | Ready | `auto-fill` root grid, modals sized to viewport | — |
| **Register** | pos/screen-register.jsx | **Locked** | Fixed 188–372px panels, one responsive tile grid, otherwise fixed desktop/tablet layout | **N/A — owner-locked, audit only, never edit** |
| Check-in queue | pos/checkin.jsx | Minor | Fractional grids shrink but don't stack; cramped at 390 | half day |
| Check-in verify seam | pos/checkin-verify-seam.jsx | Ready | No fixed widths found | — |
| Customer extras (address) | pos/customer-extras.jsx | Minor | Fixed-width field row (~400px+) risks overflow at 390 | half day |
| Cash drawer control | pos/drawer.jsx | Minor | Dropdown panel fixed 296px, no edge-clamp | half day |
| Payment / tender modal | pos/payment.jsx | Minor | Custom on-screen pad avoids keyboard occlusion (good); 3-col grid tightens | half day |
| Product sheet (quick view) | pos/product-sheet.jsx | Ready | `maxHeight:60vh` + scroll | — |
| Sales panel | pos/sales-panel.jsx | Ready | `maxHeight:88%` + scroll | — |
| Product shell editor | pos/product-shell.jsx | Minor | Dense form grids tighten; good file-upload/tap-to-browse pattern | 1d |
| Shell form/formats/locations | pos/shell-form.jsx, shell-formats.jsx, shell-locations.jsx | Minor | `auto-fill` grids mostly fine; small fixed side columns | half day each |
| Shell boxes / store | pos/shell-boxes.jsx, shell-store.jsx | Ready | No fixed-width issues / logic only | — |
| Verification (ID/age) | pos/verification.jsx | Minor | 3-col grid tightens; modal well-built otherwise | half day |
| IDV capture (embedded) | idv/capture.jsx | Minor | Most mobile-mature file in POS; only gap is no `env(safe-area-inset-*)` on the full-bleed camera view | half day |
| IDV client/shared/terms (embedded) | idv/idv-client.jsx, idv-shared.jsx, idv-terms.jsx | Ready | Logic-only / uses viewport-clamped `Sheet` | — |

### Hyperwolf Verify

| Screen | File(s) | Class | Top issues | Fix size |
|---|---|---|---|---|
| Home dashboard | idv/screen-home.jsx | Needs mobile layout | 264px fixed shell (rail+2nd nav) eats 68% of 390px; two `repeat(4,1fr)` KPI grids never collapse | half day content + shared shell fix |
| Integrate | idv/screen-integrate.jsx | Minor | Inherits fixed shell; 2-col grid squeezes rather than breaks | ≤half day once shell fixed |
| Lists | idv/screen-lists.jsx | Minor | Inherits shell; upload has proper `<input type=file>` fallback | ≤half day |
| Customer detail | idv/screen-people.jsx | Needs mobile layout | 3-col grid has an ~800px hard floor — forces page-wide h-scroll | Own layout — 4 concepts |
| Session detail | idv/screen-session.jsx | Needs mobile layout | Two grids have a 340px floor; table is functionally `overflowX:auto`-wrapped | Own layout — 4 concepts |
| Sessions list | idv/screen-sessions.jsx | Minor | Table wrapped in `overflowX:auto` (functional, no card view) | ≤half day |
| Settings | idv/screen-settings.jsx | Minor | Fixed shell; grids otherwise fine | ≤half day |
| Usage/analytics | idv/screen-usage.jsx | Minor | Best-built grid pattern in the app (`auto-fit`) | ≤half day |
| Workflows | idv/screen-workflows.jsx | Needs mobile layout | `repeat(4,1fr)` stat grid unreadable at phone width | half day–1d |
| Capture (hosted ID page) | idv/capture.html, idv/capture.jsx, shared/id-photos.jsx | Ready | Genuinely mobile-built: `viewport-fit=cover`, `overscroll-behavior`, `getUserMedia`+`playsInline`, camera-capture file fallback | Gap: no safe-area-inset |

### Hyperwolf Forms

| Screen | File(s) | Class | Top issues | Fix size |
|---|---|---|---|---|
| App shell/toolbar | forms-app/app.jsx | Minor | Header row has no `flexWrap` — overflows at 390px; only single 74px rail (better shell than Verify/Docs) | ≤half day |
| Form fill/review | forms-app/app.jsx, shared/hd-form.jsx | Ready | `inputMode` numeric/decimal used correctly, stacked single-column fields | — |
| Submissions list | forms-app/review.jsx | Minor | Raw table, no `overflowX` wrapper (unlike Verify's identical-purpose table); rows ~36px | ≤half day |
| Submission detail | forms-app/review.jsx | Ready | Header already `flexWrap:'wrap'` | — |

### Hyperwolf Docs

| Screen | File(s) | Class | Top issues | Fix size |
|---|---|---|---|---|
| Token gate | docs-app/app.jsx | Ready | Single centered card, scales fine | — |
| Shell/header strip | docs-app/app.jsx | Needs mobile layout | Rail+SubNav = 242px fixed chrome; header row has no flexWrap | 4 concepts (collapse SubNav to bottom tabs) |
| Pages (browse/read) | docs-app/app.jsx (PagesScreen) | Desktop-only | Adds a THIRD fixed 300px column on top of the shell = 542px non-shrinking chrome — worst offender in the whole audit | Fallback: single-column list→detail push nav |
| Search | docs-app/app.jsx (SearchScreen) | Needs mobile layout | Search row has no flexWrap; blocked mainly by fixed shell | half day–1d, or fold into Pages fallback |
| Ask (chat) | docs-app/app.jsx (AskScreen) | Needs mobile layout | Content is already reasonably mobile-shaped; blocked by shell only | ≤half day once shell collapses |

### Hyperwolf Engage
*(audited directly by the coordinating agent; same shared-rail dependency as Verify/Docs, but content grids are the best-built in the estate — nearly all `auto-fit`/`minmax`, tables already `overflowX:auto`-wrapped, `charts.jsx` uses a responsive SVG `viewBox`, and `screen-audience-builder.jsx` already has its own `matchMedia('(min-width:1320px)')` check — more viewport-awareness than most production code.)*

| Screen | File(s) | Class | Top issues | Fix size |
|---|---|---|---|---|
| App shell | engage/app.jsx | Minor | Standard fixed 74px `HWRail` only (no 2nd nav, unlike Verify/Docs) | ≤half day once shared rail fixed |
| Home | engage/screen-home.jsx | Minor | Minor grid tightening at 390 | half day |
| Analytics (x2) | engage/screen-analytics.jsx, screen-analytics2.jsx | Minor | All grids `auto-fit,minmax()` — collapse correctly; no chart/canvas overflow found | half day (verify at 390) |
| Audience builder | engage/screen-audience-builder.jsx | Ready | Already has its own `isWide` breakpoint at 1320px; no drag-and-drop found | — |
| Audiences | engage/screen-audiences.jsx | Minor | Table wrapped in `overflowX:auto` | half day |
| Campaigns | engage/screen-campaigns.jsx | Minor | Table wrapped; a couple of fixed `repeat(3/4,1fr)` fact-grids cramp at 390 | half day |
| Customers | engage/screen-customers.jsx | Minor | Table wrapped in `overflowX:auto` | half day |
| Flows | engage/screen-flows.jsx | Minor | Fixed `repeat(3,1fr)` sub-grid cramps; otherwise `auto-fit` | half day |
| Loyalty | engage/screen-loyalty.jsx | Minor | `auto-fit` grids | half day |
| Ops | engage/screen-ops.jsx | Minor | One dense list-row grid (`minmax(0,auto) minmax(0,1fr) auto auto`) — fine down to phone width | half day |
| Charts | engage/charts.jsx | Ready | Responsive SVG `viewBox`+`width:100%`; bar/heatmap rows use flex, not fixed px | — |

### Hyperwolf Delivery *(internal ops console — not driver-facing; correctly desktop-only overall)*

| Screen | File(s) | Class | Top issues | Fix size |
|---|---|---|---|---|
| App shell/nav | Hyperwolf Delivery.html, delivery/dapp.jsx, shared/app-rail.jsx | Desktop-only | Internal region/schedule/KML config console, not used by drivers | N/A — correct fallback is "use a laptop" |
| Schedule (week view) | delivery/dapp.jsx (ScheduleWeek) | Desktop-only, incidentally responsive | `auto-fill,minmax()` tiles would reflow if opened narrow | none needed |
| Regions home | delivery/dapp.jsx (RegionsHome), delivery/dmap.jsx | Desktop-only | Fixed 6-col region table, no card fallback; fixed-height 500px static SVG map (no pinch/pan) | half day if ever needed on tablet |
| Region detail | delivery/dapp.jsx (RegionDetail) | Desktop-only | Fixed 380px column alone exceeds 390px viewport; 2nd fixed-height map | half day |
| Weedmaps pins panel | delivery/dapp.jsx (WeedmapsPanel) | Desktop-only, incidentally responsive | `auto-fill` grids reflow fine | none needed |
| Add Region/Pin modals | delivery/dapp.jsx | Ready | `min(Npx,96vw)` correctly caps to viewport | — |
| terminals/tdata.jsx (loaded here) | terminals/tdata.jsx | N/A | Data only, no render | — |

### Hyperwolf Driver App *(driver-facing — judged strictly; the highest-stakes app besides sign.html)*

| Screen | File(s) | Class | Top issues | Fix size |
|---|---|---|---|---|
| **App shell / phone-frame wrapper** | mobile/app.jsx, mobile/ios-frame.jsx | **Ready — FIXED 2026-09-17 (commit 7164204)** | Was: entire app hard-mounted inside a decorative fixed 402×874px iOS-mockup **plus** the 74px desktop rail — would not render as a working app on a real phone. **Fix confirmed in diff**: `Root()` now calls `useIsPhone()` (`matchMedia('(max-width:600px)')`, read synchronously so no frame flash) and renders `<PhoneRoot>` (real `100dvh`/`100vw`, no rail, no mockup) below 600px | — |
| Home | mobile/screen-home.jsx | Minor | FAB uses hardcoded `bottom:96/20`, not safe-area aware; static schematic route "map" (no pinch/pan, consistent w/ Delivery's map) | half day |
| Van packing | mobile/screen-home.jsx (PackingScreen) | Minor | Sticky footer still hardcodes `34px` bottom pad instead of `HWSafe.bottom()` | half day |
| Activity | mobile/screen-activity.jsx | **Ready — FIXED 2026-09-17** | Was: ledger filter chips ~30-34px tall. **Confirmed in diff**: `minHeight:44` added | — |
| Task (stop detail) | mobile/screen-task.jsx | Minor | Sticky footer hardcodes `34px` bottom pad; couple of secondary buttons under 40px | half day |
| Appointment | mobile/screen-appointment.jsx | **Ready — improved 2026-09-17** | Was already ready; **confirmed in diff**: both sticky footer bars now use `HWSafe.bottom()` instead of a hardcoded pad | — |
| Shop (catalog/cart) | mobile/screen-shop.jsx | Ready | Sticky cart bar, bottom-sheet pickers, responsive photo grid | — |
| Checkout/payment | mobile/screen-checkout.jsx | **Ready — FIXED 2026-09-17** | Was: quick-cash chips ~30px. **Confirmed in diff**: `minHeight:44` added. Custom on-screen keypad already avoided keyboard-covers-button risk | — |
| Complete | mobile/screen-complete.jsx | Ready | Sticky footer CTA always visible | — |
| Discrepancy | mobile/screen-discrepancy.jsx | Ready | Segmented tabs, textarea notes, no sticky-overlap risk | — |
| Misc sheets | mobile/screen-misc.jsx | Ready | Shared `Sheet`, `maxHeight:82%` + internal scroll | — |
| Message templates | mobile/screen-msg.jsx | Ready | Simple textarea sheet | — |
| Profile | mobile/screen-profile.jsx | Minor | Several inline buttons land at 30-38px (Edit vehicle, etc.) | half day |
| Tips | mobile/screen-tips.jsx | Minor | Money-entry fields still lack `inputMode="decimal"` (not touched by today's fix — full alphanumeric keyboard shown) | half day (shared `Field` fix covers this) |
| Guided tour overlay | mobile/screen-tour.jsx | **Ready — FIXED 2026-09-17** | Was: spotlight math hardcoded `/402` divisor tied to the old fixed frame. **Confirmed in diff**: comment now reads "This used to divide by cr.width / 402 ... no longer needed" | — |
| Screen stubs | mobile/screens-stub.jsx | N/A | Fallback placeholders only | — |
| store.jsx / data.jsx | mobile/store.jsx, data.jsx | N/A | No render code | — |

**Remaining open Driver App issues after today's fix**: `mobile/screen-home.jsx` FAB and `screen-task.jsx` footer still hardcode pixel safe-area padding instead of `window.HWSafe`; `screen-profile.jsx` has several sub-44px buttons; `screen-tips.jsx` money fields still lack `inputMode="decimal"`. None of these are severe — the one severe finding (the frame/rail mismatch) is resolved.

### Hyperwolf Bounty

| Screen | File(s) | Class | Top issues | Fix size |
|---|---|---|---|---|
| Shell — seat (budtender) | incentives/app.jsx (SeatFrame) | Minor | 74px rail + 56px topbar always on-screen (~19% of 390px); otherwise genuinely mobile-designed (single ≤420px column, `min(...,vw)` modals) | trivial–minor |
| Shell — console (manager) | incentives/app.jsx (ConsoleFrame) | Desktop-only | Fixed `300px 1fr` grid, no breakpoint; by design "the manager's whole app" — its own "preview as budtender" mode is `pointer-events:none`, not a working fallback | N/A by design |
| Standings (seat) | screen-standings.jsx | Ready | Card-based, link-forward nav | — |
| Standings (console) | screen-standings.jsx | Desktop-only | DataTable w/ overflow safety net, manager-only | — |
| Bounties list | screen-contests.jsx | Minor | Seat branch is card list (ready); console branch same pattern as others | minor |
| Contest builder | screen-contest-builder.jsx | Needs mobile layout (low priority) | `1fr 360px` 2-col, no breakpoint; manager-only, most internal grids already `auto-fit` | minor–half day |
| Contest detail (seat) | screen-contest-detail.jsx | Ready | Explicit stacked-column branch for seat mode | — |
| Contest detail (console) | screen-contest-detail.jsx | Needs mobile layout (low priority) | 2-col grid, no breakpoint, manager-only | minor |
| Earnings (seat) | screen-earnings.jsx | Ready | Modal viewport-capped, card ledger | — |
| Earnings (console) | screen-earnings.jsx | Desktop-only | Table via shared DataTable (scrolls), manager-only | — |
| Learn (seat) | screen-learn.jsx | Ready | Story player deliberately viewport-aware (`min(70vh,620px)`) | — |
| Learn (console) + author | screen-learn.jsx, screen-learn-author.jsx | Minor | Has one of the only real `@media(max-width:900px)` breakpoints in the whole estate; manager-only anyway | — |
| Data (roster/connections) | screen-data.jsx | Minor | Shared DataTable + `auto-fit` grids; admin-only | minor |
| Goals | screen-goals.jsx | Ready (seat) / Desktop-only (console) | Seat card+modal viewport-safe; console form manager-only | — |
| Settings | screen-settings.jsx | Desktop-only | Manager-only; fixed 190/170/200px input widths inside wrap rows | minor |

### Members CRM *(shell explicitly commented "desktop" in the code)*

| Screen | File(s) | Class | Top issues | Fix size |
|---|---|---|---|---|
| Shell (rail+list+record) | athome/crm.jsx | Desktop-only | Three fixed-width columns (74+320px) exceed 390px before any record content shows | Own layout if ever needed on phone |
| Overview tab | athome/crm.jsx (OverviewTab) | Desktop-only, incidentally responsive | `auto-fit` grid — would reflow if shell allowed it | — |
| Orders tab | athome/crm.jsx (OrdersTab) | Needs mobile layout | Raw 6-col hand-built CSS grid, **not** the shared DataTable — no `overflowX:auto`, will clip/overlap rather than scroll | half day |
| @ Home tab | athome/crm.jsx (AtHomeTab) | Desktop-only, incidentally responsive | `auto-fit` grid fine in isolation | — |
| Wallet & Activity tabs | athome/crm.jsx (WalletTab, ActivityTab) | Desktop-only, incidentally responsive | `auto-fit` grids fine in isolation | — |

### Customer Account

| Screen | File(s) | Class | Top issues | Fix size |
|---|---|---|---|---|
| Variant A — Hub & groups | athome/account-a.jsx | **Ready — FIXED 2026-09-17 (commit ab9c5a0)** | Was: hard-coded 390×min(844,vh-56)px decorative phone-bezel (fake status bar/notch/home-indicator) wrapped the real content, redundant with a real device's own chrome. **Confirmed in diff**: `App()` now renders through the new `window.AccountFrame` (`athome/account-frame.jsx`), which drops the bezel below 600px (via `shared/hw-phone.js`); every icon button in the file also gained `minHeight:44`; support-chat composer is now `position:sticky` with `HWSafe.bottom()` padding | — |
| Variant B — Membership card | athome/account-b.jsx | **Ready — FIXED 2026-09-17** | Same bezel/44px/sticky-composer fix applied identically | — |
| Variant C — Concierge | athome/account-c.jsx | **Ready — FIXED 2026-09-17** | Same fix applied identically (confirmed via `account-frame.jsx` adoption + 44px buttons in the diff stat) | — |
| Direction switcher | athome/account-switch.jsx | **Fixed 2026-09-17 (dev-tool gating)** | Was: a design-review toggle shipped directly on the live customer entry point, buttons ~28px. **Confirmed in diff**: now hidden on a real phone unless `?review=1` is in the URL; buttons that do render got `minHeight:44` | — |

**Verdict on account-a/b/c**: confirmed deliberate design variants (file's own comment: "DELIBERATE UI variants and stay three screens"), not duplicates — each still needs its own design judgment for future work, but the one architectural defect common to all three (the decorative bezel) is now fixed for all three at once via the shared `AccountFrame`.

### Shop at Home *(internal dispatch console, role "Dispatch · Ops")*

| Screen | File(s) | Class | Top issues | Fix size |
|---|---|---|---|---|
| Shell (rail+topbar+subnav) | athome/admin.jsx | Desktop-only | TopBar crams ~7 controls in a non-wrapping 60px row; internal staff console | Own layout if ever needed on phone |
| Board (appointments) | athome/admin.jsx (BoardView) | Desktop-only | Raw 7-col grid table, no overflow wrapper, no shared DataTable — same unwrapped-grid risk as CRM's OrdersTab | half day if ever needed |
| Live map | athome/admin.jsx (MapView) | Desktop-only | Fixed `1fr 340px` split, `minHeight:520` map | — |
| Geniuses (staff) | athome/admin.jsx (GeniusesView) | Desktop-only | Fixed `repeat(4,1fr)`/`repeat(2,1fr)` grids | — |
| Regions | athome/admin.jsx (RegionsView) | Desktop-only | `1.5fr 1fr` grid + raw unwrapped 5-col table row | — |
| Appointment detail drawer | athome/admin.jsx (ApptDetail) | Minor | One of the better-behaved surfaces (`min(720px,94vw)` + internal scroll); 4-col meta strip cramps at ~366px | minor |

### Promotions Suite
*(`promo/` = admin rules engine, judged as internal tooling; `pweb/` = mostly admin/marketing-ops surfaces that simulate the customer app inside fixed phone-bezel previews for design review — not the real customer surface)*

| Screen | File(s) | Class | Top issues | Fix size |
|---|---|---|---|---|
| Builder A · Sentence | promo/builder-sentence.jsx | Desktop-only | Fixed `1fr 340px` sticky rail; small tap targets | N/A — add read-only mobile summary |
| Builder B · Wizard | promo/builder-wizard.jsx | Needs mobile layout | Fixed `260px 1fr` step-rail+body unreadable under ~500px; most portable of the three builders | half day (rail → top stepper) |
| Builder C · Blocks | promo/builder-blocks.jsx | Desktop-only | HTML5 drag reorder of conditions, **zero touch fallback** | N/A — add up/down buttons as touch fallback |
| Native Offer Editor | promo/builder-native.jsx | Minor | 4-col MetaFields grid; otherwise flex/wrap-friendly | half day |
| Analytics Center | promo/analytics-center.jsx | Minor | `1.7fr 1fr` chart row, `repeat(4,1fr)` metric grid | half day (swap to `auto-fit`) |
| Suite shell/nav | pweb/app.jsx, shared/app-rail.jsx | Desktop-only | Fixed 74px rail (same estate-wide issue); top bar ~7 controls, no wrap plan | N/A for admin; rail is the shared fix |
| Home / Weekly board | pweb/brandmap.jsx | Minor | Source table already `auto-fill,minmax(360px,1fr)`; DealBoard already device-aware | half day polish |
| Live control / Preview | pweb/preview.jsx | Needs mobile layout | `minmax(0,1fr) 340px` two-col; sticky ledger assumes desktop height | 1d |
| Studio | pweb/studio.jsx | Desktop-only | Canvas+inspector must be visible together — WYSIWYG editor by design | N/A |
| Carousel builder modal | pweb/carousel.jsx | Needs mobile layout | CSS **Grid** `minmax(0,1fr) 300px` (not flex-wrap) crushes at 390px; product-picker table has no card fallback | 1d |
| This Week · Matrix/Stacks | pweb/week.jsx | Desktop-only (Matrix) / touch-fallback needed (Stacks) | Matrix is inherently a 7-day-wide grid; Stacks reorder is `draggable` with no touch fallback | half day for Stacks buttons |
| This Week · Inbox | pweb/week.jsx (Inbox) | Ready | Single-column, `maxWidth:640`, already phone-shaped | — |
| Weedmaps view | pweb/weedmaps.jsx | Minor | Fixed KPI grids; tables already `overflowX:auto`-wrapped | half day |
| Legacy Dashboard | pweb/screens.jsx (LegacyDashboard) | Needs mobile layout | 9-column table, no card fallback | 1d |
| Dead code | pweb/screens.jsx (PromoApp/Builder/Calendar/Analytics/Rail/TopBar) | N/A | Not mounted by Promotions Suite.html — Suite renders its own `Suite()` | — |

### Hyperwolf Shop *(real customer-facing surface — judged strictly)*

| Screen | File(s) | Class | Top issues | Fix size |
|---|---|---|---|---|
| Header/Chrome | shop/chrome.jsx | Ready | Sticky header, flexWrap; tap targets 40px (slightly under 44px guideline) | — |
| Home | shop/screen-home.jsx | Ready | Native `overflowX:auto`+`scrollSnapType` carousel — real touch swipe, no custom JS | — |
| Shop/Browse | shop/screen-shop.jsx | Minor | Category sidebar fixed 236px leaves dead space when wrapped | half day |
| Cart | shop/screen-cart.jsx | Minor | Checkout CTA not sticky (long carts require scrolling to find it) | half day |
| Checkout | shop/screen-checkout.jsx | Minor | Missing `inputMode="numeric"`/`autoComplete` on street/ZIP/city/state fields (tip field already models the correct pattern); sticky place-order bar already implemented | half day |

### Hyperdrive Logistics

| Screen | File(s) | Class | Top issues | Fix size |
|---|---|---|---|---|
| App header | logistics/lviews.jsx (AppHeader) | Minor | No flex-wrap, clips under 480px | minor |
| Board view | logistics/lviews.jsx (BoardView) | Desktop-only | Fixed `1fr 340px`; dispatcher triage board at a desk | Fallback: read-only alerts/at-risk-orders list |
| Map view | logistics/lviews.jsx (MapView), lorder.jsx (LLiveMap), delivery/dmap.jsx | Needs mobile layout | Wrapping `1fr 380px` doesn't collapse; underlying map itself already scales fine | smaller lift — just needs a stacked breakpoint |
| Lanes view | logistics/lviews.jsx (LanesView) | Desktop-only | Horizontal-scroll per-county lanes; load-balancing tool | Fallback: "overloaded lanes" summary |
| Settings drawer | logistics/lviews.jsx (SettingsModal) | Minor | Fixed 200px category rail squeezes at 390px | minor |
| New order sheet + catalog | logistics/lviews.jsx (NewOrderSheet), lorder.jsx (LCatalog etc.) | Minor | Catalog already single-column when narrow; bottom-sheet correctly capped | minor |
| Break/meal task modal | logistics/lviews.jsx (TaskFlowModal) | Ready | `min(440px,96%)`, stacked, native select | — |
| Order detail sheet | logistics/lorder.jsx (LOrderDetail) | Minor | Mostly single-column w/ internal scroll; a few 2–3 col fact grids tighten | minor |

### POS Terminal Configuration

| Screen | File(s) | Class | Top issues | Fix size |
|---|---|---|---|---|
| Display options bar | terminals/tcanvas.jsx | Ready | **Not** a canvas/drag editor despite the name — a flex-wrap options bar; no `<canvas>`/drag anywhere | — |
| Versions by location | terminals/v2.jsx | Desktop-only | 5–6 fixed-column station/driver/reader grids; 4-col KPI strip | Fallback: searchable "needs attention" read-only list |
| Add Terminal modal | terminals/tshared.jsx (AddTerminal etc.) | Minor | Overlay handles width fine; internal 2–3 col grids squeeze at 390px | minor |
| Schedule strip | terminals/tshared.jsx (ScheduleStrip) | Ready | `auto-fill,minmax(232px,1fr)` collapses naturally | — |
| Schedule drawer / reader map | terminals/tshared.jsx | Minor | Overlay/flex w/ internal scroll | minor |
| Terminal detail modal | terminals/tdrawer.jsx (TerminalDetail) | Minor | Overlay pattern, structurally sound | minor |
| Open Drawer / Reconcile | terminals/tdrawer.jsx (OpenDrawerModal etc.) | Minor | 2-col denom grid squeezes at 390px; already uses `inputMode="numeric"` correctly | minor — stack to 1 col |

### METRC Batch Pipeline

| Screen | File(s) | Class | Top issues | Fix size |
|---|---|---|---|---|
| App shell (rail+sidebar+topbar) | pipeline/app.jsx | Desktop-only (see /scan exception below) | 74px rail + 208px sidebar = up to 282px fixed chrome wrapping every route | Shared fix — see §3 |
| **Mobile scan (/scan)** | pipeline/screen-scan.jsx, pipeline/app.jsx | **Ready — FIXED 2026-09-17 (commit ab9c5a0)** | Was: the screen itself was genuinely phone-first (390px-first, 64px shutter, `inputMode="numeric"`, sticky FAB) but the router always wrapped it in the full desktop shell, leaving ~110–280px of usable width on a real phone. **Confirmed in diff**: `pipeline/app.jsx` now detects a real phone via the new shared `window.HWPhone` and renders `/scan` full-viewport with just a back button, bypassing rail/sidebar/topbar; the sticky manual-entry FAB also gained `HWSafe.bottom()` padding | — |
| Batches list + filters | pipeline/screen-batches.jsx | Desktop-only | Kanban host, filter toolbar — back-office triage | Fallback: read-only batch counts |
| Batch Kanban + detail drawer | pipeline/kanban.jsx | Desktop-only | Native HTML5 drag, no touch support — but tapping a card opens a drawer with explicit "Transition to" buttons, a real non-drag alternative already exists | minor — functionality isn't lost on touch |
| Batch archive/merge | pipeline/screen-batches-extra.jsx | Desktop-only | `overflowX:auto` table wrap already present | — |
| Compliance overview + Holds | pipeline/screen-compliance.jsx | Needs mobile layout (Holds only) | Overview KPIs already `auto-fit`; Holds table is a bare 5-col grid, no overflow wrapper | minor — add `overflowX:auto` + min-width |
| Invoice inbox/reconciliation | pipeline/screen-inbox.jsx, inbox-match.jsx | Desktop-only | Real tables, sticky `<thead>`, but `width:100%` compresses instead of scrolling | minor — set table min-width so overflow-x engages |
| Invoice detail | pipeline/screen-invoice.jsx | Desktop-only | Multi-col grid rows, sticky bottom bar | — |
| Inventory + Products | pipeline/screen-inventory.jsx | Desktop-only | 6-col grid with **no** overflow wrapper at all — worst-compressing table in the app | minor — add `overflowX:auto` |
| Product detail | pipeline/screen-product-detail.jsx | Desktop-only | Has `overflowX:auto` + sticky bottom bar — degrades reasonably | — |
| Finance (AP/Credits) | pipeline/screen-finance.jsx | Desktop-only | `overflowX:auto` tables present; responsive KPI grids | — |
| Vendors/scorecards | pipeline/screen-vendors.jsx | Desktop-only | All card grids `auto-fit` — closest to workable of the desk tools | minor |
| Buyers | pipeline/screen-buyers.jsx | Desktop-only | `overflowX:auto` tables present | — |
| Admin (config/catalog) | pipeline/screen-admin.jsx | Desktop-only | `auto-fit` grids, internal settings tool | — |
| Shared shell forms | pos/shell-form.jsx, product-shell.jsx, shell-store.jsx (used here) | Minor | No `inputMode`/`type=number` on price/qty fields (unlike scan/drawer's correct usage) | minor, cheap, cross-screen |

### dashboard.html *(single 183KB file, 11 internal workspaces)*

| Screen | File | Class | Top issues | Fix size |
|---|---|---|---|---|
| App shell (governs all 10 workspaces below) | dashboard.html:136 | Desktop-only | `grid-template-columns:200px 1fr var(--dockw,352px)` has **zero** breakpoint for the shell itself — at 820px width only ~268px is left for content, at 390px the fixed columns alone (552px) exceed the viewport | No phone fallback built — own from-scratch responsive shell |
| Home/Overview | dashboard.html:652,1780 | Desktop-only | Inherits broken shell; dense KPI/pill rows assume mouse-width hover | Own layout |
| Integration Map | dashboard.html:653,898 | Desktop-only | Usable only via horizontal scroll, no card view | Own layout |
| Order Path | dashboard.html:654,1150 | Desktop-only | Multi-col table, no card fallback, text-truncated cells | Own layout |
| Listings & Routing | dashboard.html:655,1179 | Desktop-only | 7-column table, no responsive card mode | Own layout |
| Catalog Mapping | dashboard.html:656,1208 | Desktop-only | Two wide tables + panel grid | Own layout |
| Field & Sync Map | dashboard.html:657,879 | Desktop-only | Static reference tables, pure reading, still clipped by shell | Own layout |
| Inventory & Supply | dashboard.html:658,1232 | Desktop-only | Sticky-column + rotated headers, `min-width:520` table — genuinely mouse/desktop-tuned | Own layout |
| Trust & Money | dashboard.html:659,1255 | Desktop-only | Ledger table, same shell overflow | Own layout |
| Observability | dashboard.html:660,1335 | Desktop-only | Log stream as 3-col grid rows at 11.5px font — legible on desktop, tiny on phone even if shell were fixed | Own layout |
| Dev/API | dashboard.html:661 | Desktop-only | Shares shell issue | Own layout |

### Swap and Upsell Engine.html

| Screen | File | Class | Top issues | Fix size |
|---|---|---|---|---|
| Cart & checkout flow | lines 24-270 | Minor | `.cols` grid genuinely collapses 420px 1fr → 1fr at 960px with an `order:-1` rule pinning opened panels to top — thoughtfully built; `.stepbtn` is 30×30px, range-input knobs fiddly on touch, checkbox 16×16 | ≤half day (bump tap targets) |
| Driver app & support flow | lines 262-3777 | Minor | Same responsive pattern reused; app-switcher opens via click (touch-safe); same tap-target issue | ≤half day |

### sign.html *(externally-facing — one-shot signers, no in-app support path)*

| Screen | File | Class | Top issues | Fix size |
|---|---|---|---|---|
| Fill & sign form | sign.html, shared/hd-form.jsx | Ready | Container `maxWidth:480`; all fields `minHeight:44`; numeric/decimal `inputMode` already correct | — |
| Signature pad | shared/hd-form.jsx:557-600 | **Ready — FIXED 2026-09-17 (commit e40f189)** | Was: canvas hardcoded 340×120px, overflowed by a few pixels on 375px-class phones (iPhone SE/8). **Confirmed in diff**: canvas now keeps a fixed 340×120 backing store (server needs a stable PNG size) but displays fluid (`width:100%, maxWidth:340`), with pointer coordinates scaled from displayed to backing-store pixels; ink is now always `#111` regardless of theme (previously could render invisible-on-white in dark mode) | — |
| Zoom/accessibility | sign.html:5 | **Fixed 2026-09-17** | Was: `maximum-scale=1.0` disabled pinch-zoom for signers reading legal text on their own phone. **Confirmed in diff**: viewport meta now `width=device-width, initial-scale=1.0, viewport-fit=cover` — zoom restored | — |
| Submit reachability/modals | shared/hd-form.jsx:171,724 | Ready | Submit is inline (no keyboard-covers-button risk); the one `position:fixed` PIN sheet is dead code for this page | N/A |

### Hyperwolf.html (hub) / index.html

| Screen | File | Class | Top issues | Fix size |
|---|---|---|---|---|
| App-launcher grid | Hyperwolf.html:27-172 | Ready | `.grid` collapses 3→2→1 columns at 900/600px; cards `min-height:158px` (full card is the tap target) | — |
| Exploration/exports row-links | Hyperwolf.html:42-206 | Ready | `.rows` grid collapses 2→1 at 700px; ~44px+ row tap target | — |
| Tour overlay | shared/tour.js | Ready | `width:352px, max-width:calc(100vw - 28px)`, explicit `@media(max-width:560px)` override, 44×44 launch FAB — one of the more mobile-defensive files in the estate | — |
| Redirect | index.html | N/A | Trivial `location.replace`, no UI of its own | — |

---

## 3. Totals by class

| Class | Count | Share |
|---|---:|---:|
| Ready | 62 | 31% |
| Minor (≤ half day) | 78 | 39% |
| Needs mobile layout (own design, 4 concepts) | 20 | 10% |
| Desktop-only by nature (fallback recommended) | 39 | 19% |
| N/A (no render / redirect / dead code) | 7 | — |
| Locked (owner rule) | 1 | — |
| **Total screens/views audited** | **~207** | |

Of the above, **10 rows moved from a worse class to Ready today** via commits `7164204`, `ab9c5a0`, `e40f189`, `e08322a` (Driver App shell + 3 chip/safe-area fixes, Customer Account ×3 variants + switcher, METRC /scan, sign.html signature pad + zoom). Counts above already reflect the fixed state.

Explorations/rfid concept decks (77 files, audited as a group, not in the totals above): viewport meta present on 75/77 (the 2 missing are pure index/link pages, not screens); several (e.g. `HR Overview` family) already have real `@media` breakpoints down to 1080px — better practice than most production code — but none go down to phone width. Correctly treated as desktop review decks, not production mobile surfaces.

---

## 4. Shared-component fixes, ranked by screens fixed

1. **`shared/app-rail.jsx` + `shared/app-nav.js` — the 74px left rail has zero phone-width collapse.** Used by nearly every production app (POS, Verify, Forms, Engage, Bounty, Docs, Shop, Members CRM, Promotions Suite/pweb, Shop at Home, Logistics, Terminal Config, METRC Pipeline). Estimated **100+ screens** helped by one fix (collapse to a bottom tab bar or off-canvas drawer under ~600-680px, using the same `shared/hw-phone.js` breakpoint the owner's session already introduced today). **The redesign itself is already scoped**: `docs/NAV-RAIL-IA-2026-09-17.md` has four concepts (desktop + phone states, 30 destinations reorganized into seven categories) awaiting the owner's pick — implementation should reference that doc, not re-derive the IA.
2. **`pos/tokens.jsx` `ctrlH` scale + `pos/atoms.jsx` (`Check`, `Button`, `IconBtn`, `DataTable`) — tap targets under 44px are the default, not the exception.** `ctrlH:{xs:30,sm:34,md:40,lg:44,xl:48}` means only the two largest tiers meet the guideline, and `sm`/`md` are the most-used sizes across the estate. Every audit sub-report flagged this independently. Estimated **100+ screens** (nearly everything using `pos/atoms.jsx`, which is nearly everything).
3. **`shared/hd-ui.jsx` `Table`/`HDTable` has no built-in overflow-x wrapper or card fallback.** Callers must remember to wrap it themselves — some do (idv/screen-sessions.jsx, most of `pipeline/`), some don't (forms-app/review.jsx, athome/crm.jsx's OrdersTab, athome/admin.jsx's BoardView/RegionsView, pipeline/screen-inventory.jsx, pweb/carousel.jsx's product picker, pweb/screens.jsx's LegacyDashboard). One default-wrapper fix in the shared component would repair **~10-12 screens** across Verify/Forms/Docs/Engage/CRM/Shop at Home/Promotions/Pipeline at once, instead of touching each individually.
4. **`shared/hd-form.jsx` `Field` — no default `inputMode`/`autoComplete` for common field kinds.** Money/PIN fields already do this correctly (the pattern exists); phone, email, ZIP, and other numeric-ish text fields don't. Confirmed gap in `mobile/screen-tips.jsx`, `shop/screen-checkout.jsx`, `pos/screen-identity-binding.jsx`, `pos/screen-aov.jsx`. One shared default would fix **~8-10 form screens** across the estate.
5. **`shared/notes.js` panel width — FIXED TODAY (commit `e08322a`).** Was a fixed 376px drawer that would clip on 360-375px phones; loaded on Members CRM, Customer Account, Shop at Home, dashboard, and Hyperwolf.html (effectively everywhere except Bounty). Now capped with `max-width:100vw`. No further action needed — flagged here only because it was the estate's second-most-cited cross-app finding after the rail.
6. **Drag-and-drop without a touch fallback** — three independent instances: `promo/builder-blocks.jsx` (condition reordering), `pweb/week.jsx`'s Stacks concept, `pipeline/kanban.jsx` (though kanban already has a working non-drag "Transition to" button as an escape hatch). All are admin-only desktop tools today, so low customer risk, but each should get up/down icon buttons as a cheap, low-risk touch fallback.

---

## 5. Phased fix plan (files named per work item — safe to run in parallel)

**Phase 0 — already done** (owner's session, today, verified against the diffs — not part of this audit's own output):
- `7164204` — `mobile/app.jsx`, `mobile/chrome.jsx`, `mobile/screen-activity.jsx`, `mobile/screen-appointment.jsx`, `mobile/screen-checkout.jsx`, `Hyperwolf Driver App.html`
- `ab9c5a0` — `athome/account-a.jsx`, `account-b.jsx`, `account-c.jsx`, `account-frame.jsx` (new), `account-switch.jsx`, `pipeline/app.jsx`, `pipeline/screen-scan.jsx`, `shared/hw-phone.js` (new), `Customer Account.html`, `METRC Batch Pipeline.html`
- `e40f189` — `shared/hd-form.jsx`, `sign.html`
- `e08322a` — `shared/notes.js`

**Phase 1 — foundational shared primitives** (each item touches a disjoint file set — safe to parallelize across agents, but land before Phase 2/3 since those screens inherit these fixes for free):
- **1A. Nav rail collapse** — files: `shared/app-rail.jsx`, `shared/app-nav.js`. **Gated on the owner's pick from `docs/NAV-RAIL-IA-2026-09-17.md`** (four concepts already drafted) — do not re-derive the IA, implement whichever concept is chosen.
- **1B. Tap-target floor** — files: `pos/tokens.jsx` (`ctrlH` scale), `pos/atoms.jsx` (`Check`, `Button`, `IconBtn`). One owner (most cross-referenced file in the audit).
- **1C. Table/card fallback default** — file: `shared/hd-ui.jsx` (`Table`/`HDTable`).
- **1D. Field inputMode/autoComplete defaults** — file: `shared/hd-form.jsx` (separate section from today's signature-pad edit, safe to combine or sequence after).

**Phase 2 — per-screen "needs mobile layout" fixes** (disjoint files, parallelizable by app; each needs 4 concepts first per owner rule unless noted "quick win"):
- 2A Verify: `idv/screen-people.jsx`, `idv/screen-session.jsx`, `idv/screen-workflows.jsx`, `idv/screen-home.jsx`
- 2B Docs: `docs-app/app.jsx` (SubNav collapse + Pages 3-column combine)
- 2C POS: `pos/screen-cart.jsx` (priority — the money screen), `pos/screen-catalog.jsx` (detail state), `pos/screen-stubs.jsx` (MemberDetailPage)
- 2D Promotions: `pweb/preview.jsx`, `pweb/carousel.jsx`, `pweb/screens.jsx` (LegacyDashboard), `promo/builder-wizard.jsx`
- 2E Members CRM (quick win, no new design needed): `athome/crm.jsx` OrdersTab — swap the hand-rolled grid for the shared DataTable or wrap in `overflowX:auto`
- 2F Logistics: `logistics/lviews.jsx` (MapView) — quick win, just needs a stacked breakpoint
- 2G Pipeline (quick wins, no new design needed): `pipeline/screen-compliance.jsx` (Holds table), `pipeline/screen-inventory.jsx`, `pipeline/screen-inbox.jsx`, `pipeline/inbox-match.jsx` — add `overflowX:auto` + min-width
- 2H dashboard.html — own project, biggest single lift, single file/owner (`dashboard.html`)

**Phase 3 — desktop-only screens' phone fallbacks** (lower priority backlog, one fallback view per app, no urgency):
`pos/screen-orders.jsx` (dispatch map → stop list), `pos/screen-categories.jsx` (→ read-only list), `pos/screen-category-map.jsx` (→ simplified queue), `docs-app/app.jsx` PagesScreen (→ push nav), `terminals/v2.jsx` (→ needs-attention list), `logistics/lviews.jsx` BoardView/LanesView (→ alerts summary).

**Phase 4 — drag-and-drop touch fallbacks** (small, independent, low risk): `promo/builder-blocks.jsx`, `pweb/week.jsx` (Stacks), `pipeline/kanban.jsx` (nice-to-have; already has a working alternative).

**Not scheduled**: explorations/rfid concept decks — apply Phase 1 primitives from day one whenever the owner picks a direction to build.

---

## 6. The Hyperwolf responsive standard (every new or touched page must meet this on BOTH desktop and mobile)

- **Breakpoints**: phone ≤600px (matches `shared/hw-phone.js`'s `HW_PHONE_QUERY`, now the estate's de facto standard), tablet 601–900px, desktop >900px.
- **Test viewport list**: 390×844 (iPhone 14/15), 375×812 (iPhone SE-class — the narrowest common target; this is where the sign.html signature-pad bug actually surfaced), 360×800 (common Android), 820×1180 (iPad portrait).
- **Viewport meta**: every page ships `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. Never `maximum-scale=1` or `user-scalable=no` — that was sign.html's bug.
- **Tap size**: 44×44 CSS px minimum for every tappable control — buttons, checkboxes, icon buttons, chips, rail/tab items. Enforced centrally via `pos/tokens.jsx`'s `ctrlH`, not per screen.
- **Table → card rule**: any `<table>` or grid-simulated table wider than ~3 columns must either (a) wrap in `overflowX:auto` with an explicit `min-width` so it scrolls instead of silently compressing illegibly, or (b) switch to a stacked card layout below the phone breakpoint. A bare unwrapped CSS-grid "table" (found repeatedly in `athome/crm.jsx`, `athome/admin.jsx`, `pipeline/screen-inventory.jsx`) is not acceptable.
- **Rail/nav behavior**: `shared/app-rail.jsx` collapses to a bottom tab bar or off-canvas drawer below 600px — never a fixed 74px column on a phone. (Design pending owner pick, see `docs/NAV-RAIL-IA-2026-09-17.md`.)
- **Safe areas**: every fixed/sticky/absolute-positioned edge element uses `window.HWSafe.top/bottom/left/right()` (added today in `shared/hw-safe-area.js`) — never a bare hardcoded pixel pad. Applies to floating chips, sticky footers/headers, and full-bleed camera/signature surfaces.
- **Input modes**: `inputMode="numeric"`/`"decimal"` for money/quantity fields, `"tel"` for phone, `"email"` for email, and `autoComplete` set for name/address/payment-adjacent fields — wired once at the shared `Field` component, not per screen.
- **Drag-and-drop**: any HTML5 `draggable`/`onDragStart` interaction ships a non-drag alternative (buttons, a select, or an explicit "move to"/"transition to" action) — dragging alone is never the sole interaction path.
- **Charts**: responsive SVG (`viewBox` + `width:100%`, per `engage/charts.jsx`'s pattern) or explicit horizontal-scroll with a visible affordance — never a canvas/SVG with a hardcoded pixel width.
- **New layouts**: per owner rule, any screen reclassified "needs a mobile layout" gets four concepts (desktop + phone states) before any build — use `docs/NAV-RAIL-IA-2026-09-17.md` as the template for how a concept round + owner pick should be packaged.
- **`pos/screen-register.jsx` is permanently exempt** from layout changes (owner rule) — audit its mobile state if asked, never propose or make edits to it.
