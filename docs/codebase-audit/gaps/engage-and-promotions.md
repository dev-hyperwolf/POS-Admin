# Engage & Promotions Suite — contract-gap inventory

Scope: `engage/` (13 files), `pweb/` (10), `promo/` (8), `promo-explore/` (2) — 33 files, 10,074 lines.
Read against `contracts/index.js` (ENUMS/SCHEMAS) and
`docs/codebase-audit/repos/promotion-backend.datamodel.md` §Promotion. All are static/demo
React screens (`window.X` globals, no build step) — no server calls, so every gap below is a
future-integration risk, not a live bug.

## 1. Enum literals vs contract

**Promotion `status`** — Suite vocabulary is `draft/scheduled/live/paused/ended` (5 values):
`pweb/module.jsx` (`grep -c "status:'" ` → 13), `pweb/screens.jsx` (2, plus the tab list
`pweb/screens.jsx:115-119`), `promo/pdata.jsx` (9, values `active/paused/scheduled/ended`).
Contract `PromotionStatus` = `['active','inactive']` only (`contracts/index.js:83`). **Disagreement,
not drift**: production's own `Promotion.status` enum (`promotion-backend/models/Promotion.js`,
cited in the datamodel doc) is also just `active/inactive` — so neither the Suite nor the
contract has `draft/scheduled/paused/ended`, but the Suite is the one place all five live day to
day. NO CONTRACT ENUM YET → propose `PromotionStatus` widened to
`['draft','scheduled','active','paused','ended','inactive']` or a separate derived
`PromotionLifecycleStatus` for UI display.

**Rule/promo `type`** — `promo/pdata.jsx:45-196` `entity` field uses `user|product|cart|bogo`
(no `time`, no `payment`); `pweb/merge.jsx:32-62` (`rule.entity`) and `promo/builder-native.jsx`
(`offer.scope`) use the same 4-value subset. Contract `RuleType` = `['cart','product','user',
'bogo','time','payment']` (`contracts/index.js:85`) — Suite never exercises the last two, so
`time`- and `payment`-based rules (production's actual `models/Rule.js` `rule_type` enum,
matching contract exactly) have **no UI path at all**. Also Title-cased duplicates exist:
`promo/pdata.jsx` sample rows carry `type:'User'|'Product'|'BOGO'` (grep: 4 hits) alongside the
lowercase `entity` field — two vocabularies for the same concept in the same file.

**Platform** — `promo/pdata.jsx:37 const PLATFORMS = ['Hyperwolf','Hemp','Stilo']` (Title Case) vs
contract `Platform` = `['hyperwolf','hemp','stilo']` (`contracts/index.js:37`). Same 3 values,
wrong case — a direct string compare against the contract would always fail. NO CONTRACT ENUM
YET for the display-label form; propose contract adds a `Platform.labels` map instead of screens
inventing their own.

**Role** — `engage/data.jsx:24,27,28 role: 'Admin' | 'Marketer'` (2 tenants Admin, 1 Marketer).
Contract `Role` = `['viewer','associate','manager','admin','superadmin']` (`contracts/index.js:41`).
Neither value nor case matches, and `Marketer` doesn't exist in the contract at all. This is
Engage's multi-tenant "TENANT" concept (`engage/data.jsx:24-28`, fictional tenants "Green Leaf
Collective", "Oaktown Dispensary", "Harbor Cannabis Co.") — it models a SaaS-per-tenant shape
that has no equivalent in the contract's single-estate `Platform`/`Store` model at all. This is
the biggest structural disagreement in the group: Engage isn't just missing enum mappings, its
whole tenancy concept sits outside the contract's object model.

**Notification channel** — `engage/data.jsx` `channel: 'sms'`(5) `'email'`(3) `'wallet'`(2)
`'push'`(2). NO CONTRACT ENUM YET → propose `NotificationChannel: ['sms','email','push','wallet']`.

**Generic `status`/`kind` sprawl** — `engage/data.jsx` alone has 12 distinct `status:` string
values (`live/active/connected/draft/sent/paused/sending/scheduled/pending/migrating/ended/
automatic`) and 12 distinct `kind:` values (`wait/spin_wheel/pos/message/channel/warehouse/
trigger/scratch_card/quiz/marketplace/crm/condition`) spread across campaigns, flows, and
integrations with no per-entity enum boundary — none map to a contract enum today.

## 2. Money

Zero use of `shared/hd-format.jsx` (`window.HD`) or `contracts` `money()`/`centsFromDollars()`
outside `engage/`. Three independent dollar formatters exist:
- `shared/hd-format.jsx` → `window.HD.formatCents/formatCurrency/formatNumber/formatPercent` —
  used only inside `engage/` (`screen-campaigns.jsx`, `screen-analytics2.jsx`, etc., 20+ call
  sites).
- `pweb/module.jsx:7-9` — local `money`, `money1`, `kd`, all operating on raw dollar `Number`,
  exported via `Object.assign(window, {PROMO:{...money, kd...}})` and consumed by
  `screens.jsx`, `studio.jsx`, `preview.jsx`, `app.jsx`, `merge.jsx` (grep -c `toLocaleString|
  toFixed` in `module.jsx` → 4).
- `promo/pdata.jsx:6-12` — local `pfmt` object (`money`, `money2`, `k`, `num`, `pct`, `x`),
  exported on `window.pfmt`, consumed by `promo/pshared.jsx` and `promo/analytics-center.jsx`
  (grep -c → 5 in pdata.jsx, 1 in pshared.jsx).

All discount/price values throughout `promo/`, `pweb/` (`was:60,now:42`, `pct:30,cap:20`, etc.)
are plain floats in dollars — never cents, never a `Money{cents,currency,basis}` object. Every
`price`/`was`/`now`/`pr` field in `promo/pdata.jsx`, `pweb/module.jsx`, `pweb/carousel.jsx`,
`pweb/brandmap.jsx` is a bare dollar number.

## 3. Time

No ISO-8601 timestamps anywhere in scope; no `toIso()`/epoch conversions from `contracts`.
Patterns found:
- Bare `YYYY-MM-DD` schedule strings: `pweb/screens.jsx:259-264` (`d.schedule.start/end` +
  separate `startTime`/`endTime` text fields), parsed by a local `pd()` in `pweb/module.jsx:11`
  (`s.split('-').map(Number)` → `new Date(y,m-1,d)` — local-timezone `Date`, not UTC).
  `pweb/preview.jsx:29-31` reuses `PV.pd(...).getTime()` for schedule-window checks.
- Free-text publish/expiry strings in demo data: `promo/pdata.jsx:179,195` (`publish:'May 15,
  2026'`, `expiry:'Jul 15, 2026'`) — not machine-parseable at all.
- `engage/data.jsx:20 new Date('2026-04-20T15:30:00-07:00').getTime()` — one hardcoded
  `-07:00` offset literal standing in for "now"; no timezone abstraction.
- Id generation piggybacks on `Date.now()` as a fake time+id (see §4).
- Zero `America/Los_Angeles` (or any) timezone literal anywhere in the 4 directories, even
  though `Promotion.timezone` defaults to `America/Los_Angeles` in production
  (`promotion-backend.datamodel.md` §Promotion) — the Suite has no timezone concept at all.

## 4. Ids

No use of `contracts.externalId()` or an `external_ids[]` shape anywhere in the 33 files (0
matches for `external_ids`/`externalId(`). Specific patterns:
- **Bare vendor ids**: `promo/pdata.jsx:348-402` Weedmaps `listing:'342170487'` (5 rows, numeric
  string, no `{source:'weedmaps', id:...}` wrapper).
- **Fabricated ids via `Date.now()`**: `pweb/merge.jsx:78`, `pweb/screens.jsx:434,443`,
  `pweb/app.jsx:94` (`id:'p'+Date.now()`), `pweb/studio.jsx:188` (`id:'hc'+Date.now()`) — five
  call sites, same throwaway pattern, collides under rapid double-click (no uniqueness guard),
  and doesn't resemble the contract's 24-hex ObjectId or a real slug.
- Sample-data ids like `t-1`, `flow-001`, `sug-1` (`engage/data.jsx`) are plain display slugs,
  fine as local demo keys but never distinguished from a real backend id anywhere in the type
  shape — no `id` vs `external_ids` split exists in any of these screens' data model.

## 5. Store/person/brand names as literals

Real Hyperwolf store names hardcoded in demo data: `West Hollywood`, `Lake Elsinore`, `Corona`,
`Long Beach` — `engage/data.jsx:227-230`, `engage/screen-analytics2.jsx:142-145`,
`promo/pdata.jsx:264-268` (also `WM_STORE = {name:'Hyperwolf WeHo', region:'West Hollywood'}`),
`pweb/screens.jsx:154` (`STORES=['Stilo Supply · Long Beach', 'CHKN N WAFFLEZ · Corona', ...]`).
Brand names: `Stilo Supply`, `Pleasure Med`, `Wolf Pack VIP` (member tier, not a brand) hardcoded
in `pweb/module.jsx:17-22,116-123,572-601`, `pweb/brandmap.jsx:8-10`, `pweb/carousel.jsx:6` (a
29-brand literal array), `promo/pdata.jsx:17,35,178-196`. None of these read from a `stores`
registry or `Brand`/`Store` contract schema — every one is typed directly into the screen file,
exactly the pattern `BUILD-AGAINST-THE-SOURCE.md` §3 calls out as prohibited.

## 6. Second copies

- **Three money formatters** for the same job (§2): `shared/hd-format.jsx` `HD`, `pweb/module.jsx`
  `money/money1/kd`, `promo/pdata.jsx` `pfmt`. None delegates to another; `engage/` is the only
  directory using the shared one.
- **Two date parsers doing the same `YYYY-MM-DD` split**: `pweb/module.jsx:11 pd()` (used via
  `PROMO`/`PM`/`PV`/`ST` aliases across `screens.jsx`, `preview.jsx`, `studio.jsx`) has no
  counterpart in `promo/` — `promo/pdata.jsx` never parses its `publish`/`expiry` free-text
  dates at all (§3), so the same "schedule window" concept is implemented once correctly-ish in
  `pweb/` and not implemented in `promo/`.
- **Two rule/offer vocabularies for the same idea**: `pweb/merge.jsx` `ruleToOffer()`/
  `offerToRule()` bridges a 4-kind "native offer" shape (`percent|bogo|gift`, comment at
  `merge.jsx:12-19` admits `tiered/dollar/bundle/points` "silently collapse") to the
  `rule.entity` shape; `promo/pdata.jsx` and `promo/builder-native.jsx` each re-derive pieces of
  that same mapping independently (`builder-native.jsx:13-14` comment cites the identical
  collapse bug). Three files independently encode one lossy conversion table.
- **Ad-hoc id generator** repeated 5x instead of one helper (§4).

## 7. Effort estimate and order

| Group | Size | Estimate | Reason |
|---|---|---|---|
| `promo/` (8 files, `pdata.jsx` 411 lines is the taxonomy source of truth) | M | **Do first** | Single file (`pdata.jsx`) owns almost every enum/money/id gap for the group; fixing its `pfmt`, `entity` vocab, and `PLATFORMS` casing fixes 3 of 4 downstream files (`pshared.jsx`, `builder-*.jsx`, `analytics-center.jsx`) for free. |
| `pweb/` (10 files, `module.jsx` 620 lines is the shared kernel) | L | Second | Largest surface (2,796 lines), holds the `Date.now()` id pattern (5 sites), the `pd()`/schedule-window logic, and the second money formatter — but `module.jsx` is already a single choke point other files import through (`PROMO`/`PM`/`ST`/`PV`), so fixes concentrate well once started. |
| `engage/` (13 files, 3,749 lines) | L | Third | Biggest structural gap (tenant/Role model has no contract equivalent at all — §1) but is also the most self-contained: it already uses `shared/hd-format.jsx` correctly for money, so the remaining work is enum/role modeling, not a money/formatter rewrite. |
| `promo-explore/` (2 files, 370 lines) | S | Last | Pure static UI-direction mockups (hardcoded hex colors, day-of-week ints, no data fetching, no money/time/id logic at all) — nothing here reaches a contract boundary; only worth touching if one direction ships. |
