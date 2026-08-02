# Hyperwolf — project map

`Hyperwolf.html` is the hub and the index of record. **Every live surface must be linked from it.**
If you add, rename or retire a file, update the hub in the same turn.

## Live apps (one HTML at the root, one folder of screens)

| App | Entry | Source |
|---|---|---|
| POS | `Hyperwolf POS.html` | `pos/` |
| Promotions Suite | `Promotions Suite.html` | `pweb/` (shell + screens) + `promo/` (data, atoms, builder) |
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
- `shared/app-rail.jsx` — **the one rail component** (`window.HWRail`). Every app renders
  `<window.HWRail active="<its id>" />`. No app defines its own rail markup.
- `shared/app-switcher.js` — floating cross-app launcher. Keep its list in sync with the hub.
- `shared/tour-steps.js` + `shared/tour.js` — the guided walkthroughs, keyed by filename.

Every app HTML loads, in order: react → babel → `pos/tokens` → `pos/icons` → `pos/atoms` → its own
folder → `shared/app-switcher.js`, `shared/tour-steps.js`, `shared/tour.js`.
`shared/app-nav.js` loads as plain JS before React; `shared/app-rail.jsx` right after `pos/atoms.jsx`.

## Supporting folders

- `explorations/` — "pick a direction" studies. Linked from the hub. Once a direction is chosen,
  fold it into the live app and delete the study.
- `exports/` — self-contained offline builds, one per app, named `<App> (standalone).html`.
  Auto-generated; never edited by hand; regenerate rather than patch.
- `uploads/` — the user's own files. Never delete or rewrite these.

## Rules

1. No orphan source files. If a `.jsx` isn't loaded by an HTML, either wire it up or delete it.
2. No duplicate exports. One standalone per app, in `exports/`, with that exact naming.
3. Don't scatter QA screenshots into the project — capture, read, discard.
4. New versions of a design go in as a toggle/tab inside the existing app, not as a new root file.
5. Every app renders the shared rail and appears in it. If you add an app, it goes in
   `shared/app-nav.js`, `shared/app-switcher.js` and the hub — all three, same turn.
