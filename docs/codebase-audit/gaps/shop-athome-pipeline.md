# Gap inventory — shop/ · athome/ · pipeline/ · rfid*/

Read against `docs/BUILD-AGAINST-THE-SOURCE.md` §3, `contracts/index.js` (v0.1.0 ENUMS/SCHEMAS),
and `docs/codebase-audit/CANONICAL-DATA-MODEL.md` §1.1 / §3.2. `grep -a` throughout; counts are
`grep -c`, not visual.

## 1. shop/ (storefront) — 2,955 lines, 6 files

**Enums.** No `status`/`stage` field on shop's own order/cart model at all — `pastOrders()`
(`shop/data.jsx:728-747`) carries no status. The one real status literal is
`shop/screen-checkout.jsx:239` `stage: 'verify'` filed into the legacy `HW.addOrder` shape shared
with `pos/screen-orders.jsx` — not in contract `OrderStatus` (pending/confirmed/packed/
out_for_delivery/completed/cancelled/refunded) and not a new enum either; it's a POS-internal
queue stage. `pay: 'Card'` (same line) has **NO CONTRACT ENUM YET → propose `PaymentMethod`:
[card, cash, ...]`** (nothing in `contracts/index.js` names a payment method at all).
Order id shapes (`o-usual`, `o-prev`) and cart line ids (`sl1`, `sl2`) are informal slugs, not
24-hex or `{source,id}` — acceptable as local-only ids since they never leave the browser today.

**Money.** Disciplined: `shop/data.jsx` (6 uses) and `shop/screen-cart.jsx` (7) route through
`window.HWCommerce`/`window.HWSwap` (the commerce-adapter), and `*Cents` fields dominate (74
occurrences across data.jsx/screen-cart.jsx/screen-checkout.jsx/screen-home.jsx). The one
legacy-shape boundary is `shop/screen-checkout.jsx:210-255` (6 `toFixed(2)` calls) converting
cents back to dollars ONLY to match `HW.addOrder`'s legacy dollar fields — commented as
deliberate, cents-first (line 218-219).

**Time.** `new Date()` / `daysAgo` only; no epoch fields, no bare-date misuse found.

**Ids.** `sku` used as the engine's `productId` by convention (`shop/data.jsx:871`), not wrapped.

**Store/person/brand names.** One hardcoded city: `shop/data.jsx:30` `city: 'Long Beach'`
(flagged in-repo as already a known data gap — `regionId: 'LA-01'` doesn't match
`window.DDATA.SUBREGIONS`).

**Second copies.** None found within shop/.

**Estimate: S.** Reason: already closest to the contract discipline BUILD-AGAINST-THE-SOURCE
describes; only needs `PaymentMethod`/queue-stage naming cleanup, not a money/time rewrite.

## 2. athome/ (Shop @ Home admin, Members CRM, Customer Account) — 2,884 lines, 6 files

**Enums — Member.** `MEMBERS[].tier` (`athome/crm.jsx:27-34`, 8 uses) = Gold/Silver/Bronze/'—';
`athome/admin.jsx:63-70` same 4 values again (7 uses) → **NO CONTRACT ENUM YET → propose
`MemberTier`: [bronze, silver, gold, platinum]** (contract has `PersonKind` and `Role` but no
tier vocabulary at all — CANONICAL-DATA-MODEL §1.1 also never names a tier field). `MEMBERS[].status`
(active/new/flagged) and `GENIUSES[].status` (in_session/en_route/available/off,
`athome/admin.jsx:24-28`) collide on the same field name across two different vocabularies in one
file — **NO CONTRACT ENUM YET → propose `MemberStatus`** and **`DriverDutyStatus`** (distinct from
contract `FleetStatus` active/inactive and `TaskAssignmentMode`, neither of which is duty state).
**Order status** (`athome/crm.jsx:50-55`, `athome/admin.jsx:63-70`): in_session/delivered/
completed/confirmed/en_route/requested/canceled — only `completed`/`cancelled`(sp) overlap
contract `OrderStatus`; `delivered`/`in_session`/`en_route`/`requested`/`confirmed` don't map
1:1 to pending/confirmed/packed/out_for_delivery/completed/cancelled/refunded (`confirmed`
matches; `delivered` should likely BE `completed`, `en_route`≈`out_for_delivery`, `requested`≈
`pending` — none renamed to the contract's actual spelling). **account-a/b/c**: identical `tier:
'Gold'` literal (`:13` each) and identical order-history statuses Delivered/Completed/Invited/
Joined (`:21-24`, `:65-67` each file) — capitalized, a THIRD vocabulary from the same concept.
**Store names**: `athome/admin.jsx` `REGIONS` (19 literal-name hits: Rancho Cucamonga, Riverside,
Corona, Temecula, Murrieta, Wildomar, `admin.jsx:15-20`) and `athome/crm.jsx` (9 hits) hardcode
what §3 calls the `stores` registry — none of these six names round-trips through a `Store`
contract object anywhere in athome/.

**Member vs canonical `Member` (§1.1) field disagreements** (`athome/crm.jsx:23-40` `REC`):
`id` vs `memberId`; `name` (one string) vs `firstName`/`lastName`; `addr` vs `deliveryAddress`;
`wallet` vs `walletAmount`; `region` (a city name) vs `retailerId`/`storeId`; `idVerified`/
`idType`/`idExpires` vs `licenseNumber`/`idImage`/`isVerified`/`verifyMethod`; `tier`/`points`/
`nextTier` have no canonical counterpart at all (canonical has no loyalty-tier field, and §3.5
notes there is "no ledger" for points anywhere in the estate except Bounty's `inc_points`, which
athome does not use); `since` is a display string ("Jun 12, 2024"), not `createdDate`.

**Order vs canonical `Order` (§3.2) field disagreements** (`athome/crm.jsx:44-49` `ORDERS`):
`id` vs `orderId`; `date` is a rendered string ("Jul 2", "Today · 2:00p") — not epoch, not ISO,
not a bare date, i.e. worse than either legacy convention; `items` is a bare count, not the
canonical `items[]`/`cartData` array; `total` is `null`-or-dollar-float, no `subTotal`/
`afterTaxDiscount`/`walletAmount` breakdown at all.

**Money.** Zero commerce-adapter/`HWCommerce`/`centsFromDollars` references anywhere in athome/
(6 files, 0 hits each). `money`/`money2` dollar-float formatters are **defined 4 separate times**
byte-identical: `athome/account-a.jsx:8-9`, `account-b.jsx:8-9`, `account-c.jsx:8-9`,
`athome/crm.jsx:7-8` (admin.jsx has only `money2`, `:10`). `CART_2041` in `admin.jsx:29-31` uses
bare `price: 55` dollars, no Cents field anywhere in the file.

**Time.** No ISO/epoch discipline; `TODAY = 'Wed · Jul 8'` (`admin.jsx:9`) is a rendered literal.

**Second copies — the big one.** `account-a.jsx`/`account-b.jsx`/`account-c.jsx` (636/646/626
lines) are three near-full copies of one Customer Account screen: `diff -q` confirms they differ,
but 25 top-level symbols are **defined identically in all three** — `App`, `AtHomeScreen`,
`OrdersScreen`, `OrderScreen`, `WalletScreen`, `PointsScreen`, `MembershipScreen`, `ProfileScreen`,
`SettingsScreen`, `SupportScreen`, `ReferralsScreen`, `FavesScreen`, `BookScreen`,
`AddressesScreen`, `HubScreen`, plus `TabBar`, `ScreenHead`, `TierBadge`, `Thumb`, `StrainTag`,
`Card2`, `Btn`, `Row`, `Group`, `money`, `money2`, `WALLET_LOG`, `TRACK`, `REFERRALS` (per-file
diff: a-vs-b 110 differing lines, b-vs-c 126). `account-switch.jsx` (38 lines) exists to toggle
between them, implying all three are live rather than superseded drafts.

**Estimate: L.** Reason: highest concentration of real gaps against the audit's own findings —
zero contract/money-adapter adoption across the whole directory, three duplicated screens (not a
two-line helper, a whole customer-facing app x3), a Member/Order shape that disagrees with
canonical on nearly every field name, and hardcoded store names feeding a live operator console.

## 3. pipeline/ (METRC Batch Pipeline) — 6,652 lines, 20 files

**Enums — batch/intake stage.** `pipeline/data.jsx` alone carries 55 `status:` literal object
fields; full vocabulary across the directory: `incoming, received, labeling, sealing,
quarantined, recalled, merchandised, shelf_ready, destroyed, review, approved, auto_posted` —
**NO CONTRACT ENUM YET → propose `BatchStage`: [incoming, received, labeling, sealing, sealed,
quarantined, recalled, shelf_ready, merchandised, destroyed]** (contracts/index.js has no
batch/intake concept at all — closest is `ContestStatus`, unrelated). A second, unrelated
vocabulary shares the same `status` key for AP/credit workflow: `pending, approved, disputed,
paid, overdue, due_this_week, cfo, review, applied, draft` (`pipeline/screen-finance.jsx:161-165,
234,334-424`; `pipeline/data-ops.jsx:157-160`) — **NO CONTRACT ENUM YET → propose
`ApInvoiceStatus`/`CreditMemoStatus`**.

**Ids — METRC.** `metrcPackageId: pad24()` (`pipeline/data.jsx:285`, `data-products.jsx:80,98-100`,
`screen-batches-extra.jsx:15,91,124,243,260`) is a bare string field, generated to LOOK like a
24-hex ObjectId (`pad24()`) but is actually a vendor id — the opposite of the contract's own
warning that "Production entities: 24-hex ObjectId… anything from a vendor is `{source, id}`."
Worse: contract `IdSource` enum (`blaze, meadow, treez, weedmaps, didit, hwpos, connecteam,
airtable, hyperwolf`) **has no `metrc` value at all**, so even wrapping it correctly today would
fail `isEnum('IdSource', 'metrc')` — the enum itself needs the addition before this can be fixed.

**Money — split convention, same domain.** Newer files are cents-disciplined: `data-buyer.jsx`
(28 `*Cents` fields), `data-products.jsx` (35), `screen-buyers.jsx` (39), `screen-product-detail.jsx`
(23). Older files are dollar-float with `.toFixed(2)`: `data.jsx` (14 `toFixed(2)` calls),
`data-ops.jsx` (8, e.g. `unitCost`/`total` at `data-ops.jsx:47`), `data-vendors.jsx` (3),
`screen-vendors.jsx` (1). Both conventions compute AP/vendor money for the same pipeline — a
`total` computed in `data-ops.jsx` and a `totalCents` computed in `data-buyer.jsx` are not
guaranteed to agree at a shared boundary (e.g. `screen-finance.jsx`, which itself mixes 10
`*Cents` fields with money read from both sources).

**Time.** Consistently `new Date(...).toISOString()` (e.g. `data.jsx:271,311,327` timeline
events) — no epoch, no bare-date misuse found; this directory is time-clean.

**Store/person/brand names.** No store-name literals in scope; one hardcoded brand/entity map,
`ENTITY_NAMES` (`pipeline/data-ops.jsx:38`: thc/ccd/ah/hwd → "The Highest Craft"/"Circle
City"/"Alternate Health"/"Hyperwolf Delivery") — single definition site, not yet duplicated, but
these are the same four entity slugs the incident-pipeline skill already treats as a routing
enum elsewhere in the estate; worth becoming one shared list rather than a second local copy.

**Second copies.** No duplicate top-level helper names found across the 20 files (money
formatting is inlined per-screen via `toLocaleString()` rather than a shared function — 6 call
sites, no shared formatter to duplicate).

**Estimate: M.** Reason: largest file count and the money-convention split is a live-correctness
risk (two authorities computing the same AP dollar figure), but the fix is contained (extend
`MoneyBasis`-style discipline to ~4 older files) plus two enum additions (`BatchStage`,
`IdSource: +metrc`) rather than a structural rewrite.

## 4. rfid*/ (rfid/ shipped + rfid-direction-a/b/c/ "studies") — 9,524 lines, 26 files

Per `rfid/NOTES.md`: `rfid/` is "the shipped module," built by grafting direction-a's data
layer with direction-c's handheld screens; **direction-a/b/c are explicitly "untouched" study
trees still living in the repo**, not deleted.

**Enums.** Reconciliation/device vocabulary — `status`/`state`: `ok`(12), `closed`(8),
`complete`(6), `approved`(4), `done`(4), `AVAILABLE`(3), `reconciled`(2), `collision`(2),
`wrong`/`short`/`excess`/`correct`(2 each), `submitted`/`rejected`/`ready`/`open`/`scanning`/
`running`/`online`(1 each) — **NO CONTRACT ENUM YET → propose `KitReconciliationState`:
[correct, short, excess, wrong, moved]** and **`DeviceStatus`: [online, offline, scanning]**;
none of this exists in `contracts/index.js` today (nearest is `ContestStatus`, unrelated domain).

**Money.** Minimal surface — `rfid-direction-b/screen-commission.jsx:220` routes through a
shared `HD.formatCurrency(...)` helper (good practice, but `HD` is a different, undocumented
helper module from `HWContracts`/`HWCommerce`); `qty * unitCost` stays dollar-float, uncented.

**Ids.** SKUs (`sku: 'PRE-1G-OGK'`, `rfid/data.jsx:43-46`) and EPCs are internal-only; no bare
vendor ids found in scope.

**Second copies — structural, not incidental.** All four trees define their own `KIT`, `SKUS`,
`DEVICES`, `BOXES`, `reconcileKit`, `mulberry32`, `mintEpc`, `buildMoves`, `groupMoves` — the
core reconciliation engine is independently present in `rfid/data.jsx` (103 top-level bindings),
`rfid-direction-a/data.jsx` (76), `rfid-direction-c/data.jsx` (53), and a differently-shaped
`rfid-direction-b/data.jsx` (28, uses `STATE_TONE`/`SCHEME` naming instead). `rfid/data.jsx` is
documented as a manual port of direction-a's engine, not a shared import — three independent
JS implementations of the same −62 dBm-gate reconciliation algorithm exist simultaneously.

**Estimate: L.** Reason: not a field-level fix — the gap is that three "study" trees
(rfid-direction-a/b/c, ~7,200 of the 9,524 lines) duplicate logic already superseded by the
shipped `rfid/`. The highest-value move is archival/deletion of the three study trees (a repo
decision, not a code contract fix), not bringing all four into enum/money compliance in place.

## Recommended order

1. **athome/** — customer-facing, canonical-model drift is worst here, and duplication is a
   full live screen ×3, not a helper.
2. **pipeline/** — the money-convention split is an active correctness risk in a financial
   (AP/credit) surface; contained fix (2 enum additions + ~4 files).
3. **shop/** — smallest lift; already follows the commerce-adapter pattern the audit wants.
4. **rfid*/** — resolve by archiving direction-a/b/c rather than patching four parallel
   implementations; needs an owner decision, not just an engineering pass.
