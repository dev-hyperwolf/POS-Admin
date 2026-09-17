# Live admin audit — Hyperwolf admin + Blaze — 2026-09-17

READ-ONLY. No state changed: no saves, deletes, sends, syncs, or exports triggered; no
credentials entered; no screenshots taken except where noted. All navigation was via menu/tab
links or direct URL. Two admin surfaces audited via Claude in Chrome (logged in as the session's
existing Chrome identity — Jake Telo on Hyperwolf admin, "(DO NOT TOUCH) Admin User" on Blaze):

- **Hyperwolf admin**: `https://admin.hyperwolf.com/hyperwolf/*` — vendor-built React/MUI admin.
- **Blaze**: two apps — `https://retail.blaze.me/*` (store-level POS/ops admin) and
  `https://app.blaze.me/settings/*` (company/shop-level settings admin).

Cross-references: `/Users/jt/POS-Admin/docs/ADMIN-GAP-LIST-2026-09-17.md` (repo-census gap list,
this doc supplies the *live* operator-visible side of that comparison), `/Users/jt/POS-Admin/pos/app.jsx`
(routes: home, register, orders, catalog, brands, category-map, pricing, publish-gate, cities,
members, identity-binding, merch, floor-restock, settings — no tax/region/promotions screen files
exist), `/Users/jt/wm-demo/wmdemo/server.py` (`/api/*` route census, ~150 endpoints).

---

## 1. Hyperwolf admin — navigation tree

```
Manage Website
  Cannabinoids | Manage Main Strains | Categories | Static Pages | Authors | Blog
Products
  Products | Product Traits | Brands | Distributors | Disclaimer
Employees                    /hyperwolf/manage-employess
Members                      /hyperwolf/members
Orders                       /hyperwolf/orders
Driver/Breaks                /hyperwolf/driver  (tabs: Drivers | Breaks | Approvals)
Promotions
  Membership | Common Promotions
Settings
  Roles and Permissions | Manage Platforms | Hyperdrive Setting | Payment Setting |
  Scheduled Time Slots | Shop Timing | Centralized Banner Management | Product Carousels |
  Credit Card Fee Settings
Inventory Distribution
  Manage Boxes (/hyperwolf/boxes) | Distribution Config (href embeds what looks like an auth
  token — not opened, see §5) | Aging and Promotional Products (/hyperwolf/aging-discounted-products,
  tabs: Aging Products | Promotional Products) | Regions (/regions — note: no /hyperwolf/ prefix,
  a different route namespace than every sibling item) | Kit Template (/hyperwolf/kit-template) |
  Distribution Management (/hyperwolf/distribution-management) | Kit Refill Logs
  (/hyperwolf/refill-logs) | Driver Kit Verification (/hyperwolf/driver-kit-verification)
Loss Prevention
  Closure Forms (/hyperwolf/closure-forms) | Discrepancy Management (/hyperwolf/discrepancy-management) |
  Discrepancy Approvals (/hyperwolf/discrepancy-approvals) | Waste Inventory (/hyperwolf/waste-inventory)
```
No Tax menu item anywhere in this tree — confirms the repo census finding independently, from
the live operator's side rather than from code.

### Per-screen notes (Hyperwolf admin)

| Screen | Purpose | Columns / fields | Buttons | Filters |
|---|---|---|---|---|
| Orders (`/hyperwolf/orders`) | All orders, store-wide | Order #, Member, Email/Phone, Address, Payment Option, Driver Name, Order Type, Order Scheduled Date/Time, Status | Apply, Close (date picker) | Search, Date Range |
| Members (`/hyperwolf/members`) | Customer directory | Full Name, Email, Phone, Status, Notes, Member Type, Joined Date | (list only, no add button seen) | metrics cards: Total/Active/Inactive Members |
| Employees (`/hyperwolf/manage-employess`) | Staff directory | Name, Email, Phone, Created Date, Actions | Add Employee | — |
| Driver/Breaks (`/hyperwolf/driver`) | Driver roster + break/approval tabs | Driver ID, Driver Name, Transportation, Region, Created Date, Created By, Status, **Terminal** (Blaze terminal name), Actions | Import, Export As .CSV, Add Driver | Transportation, Regions, Created By, Status |
| Regions (`/regions`) | Delivery region CRUD | Region, Created At, Status, Actions (tabs: Sub Regions / Regions) | Add Region, Bulk Unassign Driver | — |
| Manage Boxes (`/hyperwolf/boxes`) | Distribution box catalog | Name, Description, No. of Products, Actions | Create Box | — |
| Aging/Promotional Products | Aging + promo product lists | (tabbed; column set not fully loaded — filters only: Box, Category, Brands) | Clear All | Box, Category, Brands |
| Kit Template | Distribution & Refill kit templates (two tabs, same schema) | Template ID, Region, Sub Regions, Boxes, Min Products Per Region, Max Products Per Region, Creation Date, Actions | Create Template | Box Type, Region |
| Distribution Management | Distribution runs | Distribution Date, Kit Value, Total No Of Unique Products, Total Product Quantities, Status, Actions | Distribute | All Time (date) |
| Kit Refill Logs | Refill history | Refill Date, Kit Value, Refill Qty, Actions | Refill Kit, Activity Logs | All Time (date) |
| Driver Kit Verification | Kit scan/verification queue | ID Type, Overall Status, Date Of Creation, Verified Kit Status — sample rows: `R-0003 Refill / Pending / 0/510`, `R-0001 Refill / Completed / 0/852`, `D-0001 Distribution / Completed / 0/11430` | SCANNING (mode toggle) | Distribution Type, Overall Status, All Time |
| Closure Forms (`/hyperwolf/closure-forms`) | **Register/shift close-out overview** — the direct Cash Drawer equivalent | Date, Open Forms, Closed Forms, Pending Forms, Total Revenue | — | Revenue Min/Max, Date, All Time |
| Discrepancy Management | Inventory discrepancy intake | (form-only load; filter: Discrepancy Type) | — | Discrepancy Type |
| Discrepancy Approvals | Approve/reject flagged discrepancies | Product Name/SKU, Sub Category, Brand, Weight, Batch, Scanned Qty, Discrepancy Type, Status | — | Discrepancy Type, Categories, Brands |
| Waste Inventory | Waste/shrink log | Product Name/SKU, Brand, Batch, Sub Category, Qty Waste, Date Marked, Discrepancy, Discrepancy Type | — | Discrepancy Type, Categories, Brands |

---

## 2. Blaze — navigation tree

**retail.blaze.me** (store-level):
```
Home | Insights (/insights, "Dashboards") | Broadcasts (/scheduled-broadcast/list)
POINT OF SALE: POS (/pos) | Dispatch (/dispatch) | Delivery (/delivery)
Transactions (/transactions)
Cash Drawer (/cashdrawer)
Loyalty/Marketing: Company Promotions (/company-promotions) | Promotions (/promotions) |
  Storewide Sales (/storewideSales) | CFD Manager (/cfdManager)
Inventory: Inventory Reconciliation | Cycle Counts | Inventory Transfers (/inventory/transfers) |
  Products (/inventory) | Manage Categories (/inventory/manage-categories) | Print Labels |
  Metrc Batches | Import Batches (/inventory/import-export)
Compliance: Metrc Packages/Sales/Items/Strains/Category, Available Metrc Tags, Metrc Retail
  Deliveries, Compliance Difference, Compliance Task Manager, Pending Transactions, Compliance
  Transfers, Compliance Sync Jobs, Compliance Issues
Purchase Order: Active PO (/inventory/po/) | Archive PO
Brands (/brands)
MEMBERSHIPS: Members (/members) | Online Customers (/customers) | Vendors (/vendors) |
  Physicians (/physicians) | Caregivers (/caregivers)
COMPANY MANAGEMENT: Employees — All Employees (/employees) | Time Cards (/timecards) |
  Invite Employee (/inviteemployees) | Data Export (/reports, labeled "Data Export" — this is
  the Reports module) | Global Settings | Support (/support)
```
**app.blaze.me/settings** (company/shop-level, separate app reached via "Global Settings"):
```
BLAZE Apps | Current Shop Settings (/settings/shop) | Manage Employees | Company Settings
  (/settings/company) | Data Export | Integration Settings | Plugin Options
```
No **Tax** page found in either app under any guessed route (`/settings/tax`, `/settings/taxes`
both silently redirected to the Blaze login screen — a dead/unauthorized route, not a working
page — while the session's own session stayed valid on retry). No dedicated **Regions/delivery
zone** management screen found in Blaze either — `/dispatch` is an order queue with no zone
editor. This matches the repo census's finding of vendor-owned Region/KML config; it now also
matches Blaze's *live* surface: **neither Blaze nor our own admin exposes region/zone editing —
only the Hyperwolf vendor admin does** (`/regions` above).

### Per-screen notes (Blaze) — the named priority modules

| Screen | Purpose | Columns / fields | Buttons | Filters |
|---|---|---|---|---|
| **Cash Drawer** (`/cashdrawer`) | Per-terminal register session log — the direct "Registers/Shifts/Cash drops" equivalent | Date, Terminal, Status, Total Sales, Expected Cash, Actual Cash, **Paid In**, **Paid Out** | Change (terminal), Start Drawer | Assigned Terminal, Search, page size (10/25/50/100) |
| **Inventory Transfers** (`/inventory/transfers`) | Cross-store transfer log (tabs: Pending / History) | Transfer Number, Order Number, Last Modified, Created By, Changed By, Status, From Shop, To Shop, From Inventory, To Inventory | Create Transfer, Legacy Transfer, Reset Inventory, Generate Manifest | (tabs only) |
| **Promotions** (`/promotions`, V2 engine) | Store-level promo rules, 177 active/inactive rows seen | Version, Promo Name, Auto Apply, Priority, Discount Type, Discount Amount, Code, Status, Promotion Type, Available (redemption cap) | Add Promotion | (none visible — list only) |
| **Company Promotions** (`/company-promotions`) | Company-wide promo rules (parallel to store-level) | (page loaded empty for this shop — no rows, no columns rendered) | — | — |
| **Members** (`/members`) | Customer/loyalty directory, **196,853 total records** | First Name, Last Name, Phone Number, Email, License #, Member Group, Joined Date, Status | Select Action, Add Member | search term, sort |
| **Reports** (`/reports`, labeled "Data Export") | Report generation hub | Categories: Overview, Manager, Sales, Inventory, Marketing, Compliance, Real-Time. Named reports seen: All Sales Report, Cancelation and Void Report, Delivery Sales Report, Employee Activity Report, Employee By Sales By Product Report, Export Product Batch, Inventory Product History Report, Profit Loss Report, Total Sales Detail Report, Total Sales Report | Refresh Generated Section | Date range (Today/Yesterday/Last 7 Days/Month-to-date/Custom) |
| **Employees** (`/employees`) | Staff + RBAC roster, 49 of 60 shown, 270 "clocked in" (estate-wide, all companies) | ID, First Name, Last Name, Role Name, Email, Assigned Terminal, Status, Last Clocked In. Roles observed: Admin, Support Agent, Support Level 2, Inventory Manager, **Loss Prevention Closer**, Delivery Driver | Add Employee | — |
| **Shop Information** (`app.blaze.me/settings/shop`) | Per-shop config — this is where Tax *should* live and doesn't; instead it's ~70 operational toggles | Notable fields: Cash Round Off Type, Purchase Floor Option/Amount, Recreational/Medicinal age limits, **Enforce Cash Drawers for Sales**, **Enforce Blind Cash Drawer Counts** (hides expected $ from budtenders), **Enable Auto Cash Drawers** (carries prior day's expected forward), **Restricted views** (budtenders/drivers see only their own drawers/transactions/members when enabled — currently Disabled), Terminal Sales Allocation, Draft Order Timeout, Queue Management (Delivery/Walkin/Special, each `Enabled` + `ByTerminal`) | Edit | — |
| **Company Information** (`app.blaze.me/settings/company`) | Company-level identity + dispatch defaults | Company Name/Website/Email/Phone/Address, Dispatch Configuration: Auto Accept Member/Incoming Orders/Employee, **Auto Assign based on Regions** (Incoming + Regular, both Enabled), Auto Assign Drivers, Auto Pack | Edit | — |

---

## 3. Coverage table (MISSING rows only — full table cross-references ADMIN-GAP-LIST-2026-09-17.md §A)

| Admin screen | Blaze equivalent | OUR status | Notes |
|---|---|---|---|
| Hyperwolf `/regions` (Region CRUD, Sub Regions tab, Bulk Unassign Driver) | None — Blaze has no region/zone editor anywhere in retail or settings app | **MISSING** — `wmdemo/catalog.py:97` `regions` table is a lookup, no CRUD screen, no `/api/region` write endpoints (grep shows `/api/region`, `/api/region-menu` are read/list only) | Confirms census; now confirmed live on both source admins too |
| Blaze Cash Drawer's **Paid In / Paid Out** fields | N/A (Blaze-only) | **MISSING** — `pos/drawer.jsx` + `pos/store.jsx:48-61` compute counted/expected/variance and a float target, but have no paid-in/paid-out concept at all | New field-level gap the repo census didn't have visibility into (no Blaze screen was read for it before this audit) |
| Hyperwolf Closure Forms (Open/Closed/Pending Forms counts, revenue-range filter) | Blaze Cash Drawer (per-terminal, no aggregate "forms" concept) | **PARTIAL** — `pos/drawer.jsx` has no server persistence (per ADMIN-GAP-LIST) and no aggregate open/closed/pending rollup across terminals | — |
| Blaze `/reports` (7 categories, 10+ named report types) | N/A (Blaze-owned) | **MISSING** — no `/api/report*` route in wm-demo's ~150 `/api/*` endpoints; no reporting screen in `pos/app.jsx`'s route list | Reports is a completely unaddressed module — not on the top-15 build list in ADMIN-GAP-LIST §C at all |
| Blaze Promotions (`/promotions`, V2: priority, auto-apply, discount type/amount, code, redemption cap) | N/A — our own Hyperdrive Promotions Module is IF/THEN rule-based, different shape | **PARTIAL** — wm-demo has `/api/promos/*` (9 endpoints: consume, eligible, internal, link, pull, registry, rules) so promotions ARE server-modeled, but no screen in `pos/app.jsx`'s route list surfaces promo management (no `screen-promo*.jsx` file exists in `pos/`) | Backend ahead of UI here — opposite of the Tax/Region/Drawer gaps |
| Hyperwolf Loss Prevention (Discrepancy Approvals + Waste Inventory, with Weight/Batch/Scanned Qty fields) | N/A (Blaze's own compliance module is Metrc-focused, not shrink/waste) | **MISSING** — no matching screen or `/api/` route family in wm-demo (closest is `/api/reconcile`, `/api/reconcile/strays`, unrelated to waste/discrepancy) | — |
| Blaze Members (196,853 rows, License # column) | Hyperwolf `/hyperwolf/members` (Full Name/Email/Phone/Status/Notes/Member Type/Joined) | **PARTIAL** — wm-demo has `/api/identity/member(s)`, `/api/customer/*` but no License # field seen in any grep of `pos/*.jsx` member screens | — |
| Tax (both admins) | Neither Hyperwolf nor Blaze exposes a Tax screen | **MISSING**, unchanged from ADMIN-GAP-LIST §A row 1 — this audit adds live confirmation that operators themselves have no Tax UI on either system; tax is evidently configured somewhere neither admin surfaces (possibly Metrc-side or a Blaze support-only config) | Escalate/ask: if operators can't see it, where does tax actually get set? Worth a direct question to JT rather than inferring further |

---

## 4. For the PM — ≤12 bullets

1. **Security observation, not a request to act**: dozens of internal Blaze nav links (Inventory Reconciliation, Cycle Counts, Inventory Transfers, Print Labels, all Metrc/Compliance links, Create/Archive PO, Reconcile) carry what Chrome's own tooling flagged as an embedded auth/session token directly in the `href` — not just a page ID. That's a referrer-leak / browser-history exposure pattern. Observed and redacted by tooling, not extracted or read. Worth a security-side conversation with Blaze, not an internal fix.
2. Blaze **Members** screen shows 196,853 customer rows with name, phone, email, and government ID/med-license number in plaintext, no masking, on the very first page load — no drill-in required. Same for the Blaze home dashboard's live "Member Queue," which lists full customer names next to wait times with zero clicks. Standard for an internal ops tool, but worth knowing the blast radius if that session is ever shared.
3. **Tax has no operator-visible screen anywhere** — not in Hyperwolf admin, not in either Blaze app. This was inferred from code in the repo census; this audit confirms it live. Recommend asking JT directly where tax actually gets configured today, rather than continuing to infer.
4. **Neither Blaze nor Hyperwolf's vendor admin has a delivery-zone/region map or KML editor** — Hyperwolf's own `/regions` screen is a flat CRUD (name/status/actions, plus a "Bulk Unassign Driver" action) with no geometry field visible on the list view. If KML exists at all, it's not reachable from either admin's UI.
5. Blaze's Cash Drawer has **Paid In / Paid Out** as first-class columns alongside Expected/Actual Cash — our `pos/drawer.jsx` has no equivalent concept at all. This is a real field gap the repo census (code-only) couldn't have caught, since it required seeing Blaze's live screen.
6. Blaze's Reports module (`/reports`, 7 categories, 10+ named reports: Profit Loss, Employee Activity, Cancelation and Void, etc.) has **zero footprint** in wm-demo or POS-Admin — not on the ADMIN-GAP-LIST top-15 build list at all. This is the single biggest blind spot the repo census missed, because reports don't show up as a "model" the way tax/region/drawer do.
7. Blaze's Shop Settings expose several cash-drawer *policy* toggles our own drawer.jsx has no analog for: **Enforce Blind Cash Drawer Counts** (hides the expected total from the budtender doing the count — a real anti-fraud control), **Enforce Cash Drawers for Sales** (blocks POS sales without an open drawer), and **Restricted views** (role-scoped visibility to only your own drawer/transactions/members). None of these policy concepts exist in our drawer model yet.
8. Hyperwolf's Driver/Breaks screen has a **Terminal** column tying each driver to a Blaze terminal name directly — this is a live, working cross-system join point (Hyperwolf driver ↔ Blaze terminal) that neither system's own docs called out; useful prior art for whatever adapter eventually reads Blaze's closing-receipt data (ADMIN-GAP-LIST item #11).
9. Promotions is actually **backend-ahead-of-UI** on our side, the reverse of every other gap: wm-demo has 9 live `/api/promos/*` endpoints but `pos/app.jsx`'s route list has no promotions screen at all. Blaze's own Promotions screen (177 rows: priority, auto-apply, discount type/amount, code, redemption caps) is a good reference shape for that missing UI.
10. Hyperwolf's Inventory Distribution tree (Manage Boxes → Kit Template → Distribution Management → Kit Refill Logs → Driver Kit Verification) maps almost exactly to the "Region → Kit (per driver) → Boxes" shape already decided for the Shells module rework — worth reusing this vendor screen's field set (Min/Max Products Per Region, Kit Value, Verified Kit Status counts like `0/852`) as a starting spec rather than designing from scratch.
11. One dead/inconsistent route noticed in passing: Hyperwolf's Regions menu item resolves to `/regions` (no `/hyperwolf/` prefix), unlike every sibling menu item — either a routing bug or a separate legacy mount point. Not investigated further (out of scope for a read-only census), flagging in case it explains any "region page won't load" reports.
12. Budget note: `/settings/tax` and `/settings/taxes` guesses on app.blaze.me both silently dropped the session to a login screen rather than 404ing normally — that's a slightly unusual failure mode (successful re-nav to a known-good page afterward confirmed the session itself was never actually lost). Not pursued further since guessing more Tax-shaped URLs risked more of the same and the module doesn't appear to exist as a standalone page regardless.

---

## Gaps / not completed this session

- Blaze **Insights** (`/insights`, "Dashboards"), **Broadcasts**, **Compliance** submenu (10+ Metrc-specific screens), **CFD Manager**, **Storewide Sales**, and the full **Integration Settings / Plugin Options** pages on app.blaze.me were found in the nav tree but not opened — stopped short of the ~60-page-read budget with the named-priority modules (Tax, Regions, Cash Drawer, Inventory Transfers, Promotions, Members, Reports) covered first, per the task's explicit priority list.
- Hyperwolf's Promotions submenu (Membership, Common Promotions) and most of Settings (Roles and Permissions, Hyperdrive Setting, Payment Setting, Scheduled Time Slots, Shop Timing, Banner/Carousel management, Credit Card Fee Settings) were enumerated in the nav tree but not opened for field-level detail — lower priority than the named Blaze modules per the task.
- Did not attempt to find Tax by any means other than direct URL guesses and nav enumeration (no support-ticket search, no API inspection) — if Tax truly has no admin UI, the smallest-build recommendation in ADMIN-GAP-LIST (`tax_rates` table + CRUD screen) stands unchallenged and may in fact be *ahead* of what operators can do today.
