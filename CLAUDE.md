# Hyperwolf — project map

`Hyperwolf.html` is the hub and the index of record. **Every live surface must be linked from it.**
If you add, rename or retire a file, update the hub in the same turn.

## Live apps (one HTML at the root, one folder of screens)

| App | Entry | Source |
|---|---|---|
| POS | `Hyperwolf POS.html` | `pos/` |
| METRC Batch Pipeline | `METRC Batch Pipeline.html` | `pipeline/` |
| Promotions Suite | `Promotions Suite.html` | `pweb/` (shell + screens) + `promo/` (data, atoms, builder) |
| Engage | `Hyperwolf Engage.html` | `engage/` |
| Shop @ Home | `Shop at Home.html` | `athome/admin.jsx` |
| Members CRM | `Members CRM.html` | `athome/crm.jsx` |
| Customer Account | `Customer Account.html` | `athome/account-a/b/c.jsx` + `account-switch.jsx` |
| Delivery | `Hyperwolf Delivery.html` | `delivery/` |
| Hyperdrive Logistics | `Hyperdrive Logistics.html` | `logistics/` |
| Driver App | `Hyperwolf Driver App.html` | `mobile/` |
| Terminal Configuration | `POS Terminal Configuration.html` | `terminals/` |
| Weedmaps Dev Console | `dashboard.html` | inline |

## Shared by everything

- `pos/tokens.jsx` — the theme (light + dark). The only place colors are defined.
- `pos/icons.jsx` — the icon set. Add cases here, never inline SVG in a screen.
- `pos/atoms.jsx` — Card, KPI, Pill, PBtn, Field, DataTable, StrainPill, etc.
- `shared/app-nav.js` — **the one nav list** every left rail renders (`window.HW_NAV`).
  Add an app here once and it appears in every app's rail.
- `shared/brands.js` — **the one brand (vendor) DB** (`window.HW_BRANDS`). POS catalog rows, POS
  shells, the pipeline vendor list and buyer analytics all read from it. Never write a brand name
  as a literal and never start a second list; vendors ARE brands.
- `shared/hd-ui.jsx` — Hyperdrive UI kit (status pill, stat tile, tables, sheet, toast) used by
  the pipeline and Engage. `shared/hd-format.jsx` is the generic entity/tone/format helper set.
- `shared/app-rail.jsx` — **the one rail component** (`window.HWRail`). Every app renders
  `<window.HWRail active="<its id>" />`. No app defines its own rail markup.
- `shared/states.jsx` — **EmptyState · Skeleton / SkeletonRows · ErrorState**. Every list uses these;
  never render nothing when there is nothing. `HDEmpty` is an alias of `EmptyState`.
- `shared/app-switcher.js` — floating cross-app launcher. Keep its list in sync with the hub.
- `shared/tour-steps.js` + `shared/tour.js` — the guided walkthroughs, keyed by filename.
- `shared/notes.js` — shared on-screen annotation layer (pins, threads, replies, resolve), synced
  to the team notes API. Plain JS; loads **last** on every entry HTML, after `tour.js`.

Every app HTML loads, in order: react → babel → `pos/tokens` → `pos/icons` → `pos/atoms` → its own
folder → `shared/app-switcher.js`, `shared/tour-steps.js`, `shared/tour.js`.
`shared/app-nav.js` loads as plain JS before React; `shared/app-rail.jsx` + `shared/states.jsx` right
after `pos/atoms.jsx`.

## Supporting folders

- `explorations/` — "pick a direction" studies. Linked from the hub. Once a direction is chosen,
  fold it into the live app and delete the study.
- `exports/` — self-contained offline builds, one per app, named `<App> (standalone).html`.
  Auto-generated; never edited by hand; regenerate rather than patch.
- `uploads/` — the user's own files. Never delete or rewrite these.

## Repo mirror (dev-hyperwolf/POS-Admin, GitHub Pages)

This project is mirrored 1:1 to a repo. Keep these four root files intact and current:
`README.md` (repo front page), `HANDOFF.md` (design-system spec + recreation brief for the two
Hyperdrive consoles), `index.html` (redirects to `Hyperwolf.html`), `.nojekyll` (stops Jekyll
mangling `{{ }}` in inline JSX). Never build a separate handoff/export folder — the whole project
IS the handoff.

## Design-system rules (from the UI audit)

1. **One accent per view.** Solid `accent` = the single most important action on screen. Selection is
   ink-filled, metadata is neutral, informational washes are `highlightSoft`. Loyalty keeps yellow.
2. **Never write a colour literal.** `P.accentText` is the only gold; `accentHover`/`accentActive`
   are the only hovers. Zero hex outside `pos/tokens.jsx`.
3. **Type comes from `P.type`** — micro 10 · meta 11.5 · body 12.5 · strong 13.5 · title 16 · h2 21 ·
   h1 30, plus numRow 15 / numTotal 21. Nothing below 10px, ever.
4. **Controls use `P.ctrlH`** (30/34/40/44/48) as `minHeight`. Anything a hand touches is 40+.
5. **A card has a border OR a shadow, never both.** `Card` takes `elevation` (flat/raised/sunken) and
   `density` (compact/default/roomy) — not a padding number.
6. **Radius by role:** 8 controls · 12 cards · 20 sheets · 999 pills. Inner elements go one step smaller.
7. **Focus is automatic** — `pos/tokens.jsx` injects the `:focus-visible` ring for every native
   interactive. Add `data-hw-i` only to non-button interactives (table rows, custom chips).

## Rules

1. No orphan source files. If a `.jsx` isn't loaded by an HTML, either wire it up or delete it.
2. No duplicate exports. One standalone per app, in `exports/`, with that exact naming.
3. Don't scatter QA screenshots into the project — capture, read, discard.
4. New versions of a design go in as a toggle/tab inside the existing app, not as a new root file.
5. Every app renders the shared rail and appears in it. If you add an app, it goes in
   `shared/app-nav.js`, `shared/app-switcher.js` and the hub — all three, same turn.
