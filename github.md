repo: dev-hyperwolf/POS-Admin
branch: main

## Purpose

POS-Admin is the home for THIS project — the Hyperwolf design source of truth
(browser-compiled React, no build step). Claude Code commits it here, turns on
Pages for the share link, and later scaffolds the Node/React app from it.

## Last sync

date: 2026-08-03T01:05:00Z

### Updated in this project

- Repo hygiene for the GitHub Pages mirror: added `.nojekyll`, root `index.html` (redirects to
  the hub) and `README.md`.
- Color rule made lintable: categorical hues moved into `pos/tokens.jsx` (`P.hue.*`, both modes);
  `hueColor()`/`tone()` in `shared/hd-format.jsx` now resolve from tokens, and
  `pipeline/domain.jsx` extends that module instead of redefining `window.HD`. Zero color
  literals remain outside `pos/tokens.jsx` (excluding the pre-existing dark chrome in
  `shared/app-switcher.js` / `shared/tour.js`).
- `uidKind` / `uidShort` unified in `shared/hd-format.jsx` — Pipeline and Engage render UID chips
  identically; the pipeline HTML now loads `hd-format.jsx` before `domain.jsx`.
- New app: `Hyperwolf Engage.html` + `engage/` — 34 console surfaces ported from
  dev-hyperwolf/Engage `apps/web/app/console/**` (dashboard, customers, audiences + AI builder,
  flows, loyalty, referrals, wallet, campaigns/messages/templates/interactive, the 8-view
  analytics suite, integrations, audit, health, settings/cost/flags, onboarding).
- Extracted the shared Hyperdrive UI kit to `shared/hd-ui.jsx` (was `pipeline/ui.jsx`) and added
  `shared/hd-format.jsx` so non-pipeline apps get entities/tones/formatters without batch domain code.
- 25 new icons in `pos/icons.jsx` (workflow, gauge, plug, scroll, gamepad, coins, …).
- Engage registered in `shared/app-nav.js`, `shared/app-switcher.js`, `Hyperwolf.html`, `CLAUDE.md`.

### Previous sync — 2026-08-02T23:32:00Z

- Ported all 16 METRC batch-pipeline screens from hyperdrive-design `prototype/` onto
  `pos/tokens · icons · atoms` — no Tailwind, no hard-coded hexes, shared rail on every screen.
- Fixtures are verbatim ports of the seeded generators (`fake-data`, `fake-ops-data`,
  `fixtures/products`, `fixtures/buyer-analytics`), so rows match the source prototype.
- New app: `METRC Batch Pipeline.html` + `pipeline/`; wired into `shared/app-nav.js`,
  `shared/app-switcher.js`, `Hyperwolf.html` and `CLAUDE.md`.
- Cross-links: batch drawer → POS catalog / merge / labels, compliance holds ↔ inventory,
  product batches → AP, invoice → credit memo, inbox mapping → batch board.

## Source repos (read-only, ported FROM)

- dev-hyperwolf/hyperdrive-design — `prototype/`, the METRC batch-pipeline UI (Next + Tailwind)
  and 71 specs. `prototype/THEME.md` confirms Hyperdrive and Engage share one design language.

- dev-hyperwolf/Engage — loyalty / CRM / segmentation / messaging console (Next.js, `apps/web`).
- dev-hyperwolf/hyperdrive — POS/CRM/e-commerce API + db. Backend only; use for data shapes
  (`apps/api/src/routes/batches.ts`, `packages/db/migrations`, `perf-kit/node/metrc-eod-cron.ts`).

## Screen map

| Screen here | Built from |
|---|---|
| `METRC Batch Pipeline.html` shell (rail · module nav · topbar · ⌘K palette) | `prototype/app/(shell)/layout.tsx`, `components/shell/{sidebar,topbar}.tsx`, `prototype/THEME.md` |
| `pipeline/screen-batches.jsx` — batch pipeline board | `prototype/app/(shell)/batches/page.tsx`, `components/batches/filter-bar.tsx` |
| `pipeline/kanban.jsx` — board · column · card · detail drawer | `prototype/components/kanban/*` |
| `pipeline/domain.jsx` — statuses, transitions, SLA, archive, pipeline config (extends `shared/hd-format.jsx`) | `prototype/lib/{status,batch-sla,batch-archive,fake-pipeline-config}.ts` |
| `pipeline/data.jsx` — seeded fixtures | `prototype/lib/fake-data.ts`, `lib/fixtures/inbox-status.ts` |
| `shared/hd-ui.jsx` — status pill · stat tile · UID chip · filter chip · sheet · toast | `prototype/components/ui/*` |
| `shared/hd-format.jsx` — entities · hues · tones · UID + number formatting (shared by both apps) | `prototype/lib/format.ts`, `lib/status.ts` |
| `pipeline/screen-batches-extra.jsx` — archive + merge picker/wizard | `prototype/app/(shell)/batches/{archive,merge}/page.tsx`, `components/batches/merge-wizard.tsx` |
| `pipeline/screen-compliance.jsx` — compliance tabs, holds, lineage tree | `prototype/app/(shell)/compliance/**`, `components/compliance/lineage-tree.tsx` |
| `pipeline/screen-inbox.jsx` + `inbox-match.jsx` — invoice inbox, AI matches, helper | `prototype/app/(shell)/inbox/page.tsx`, `components/inbox/*`, `lib/invoice-mapping-store.ts` |
| `pipeline/screen-invoice.jsx` — 3-way match, unmapped UIDs, variance, evidence | `prototype/app/(shell)/invoices/[id]/page.tsx`, `components/invoice-detail/*` |
| `pipeline/screen-scan.jsx` — mobile floor intake | `prototype/app/scan/page.tsx`, `components/scan/*` |
| `pipeline/screen-inventory.jsx` — inventory + products grid | `prototype/app/(shell)/{inventory,products}/page.tsx` |
| `pipeline/screen-product-detail.jsx` — product detail + product shells | `prototype/app/(shell)/products/{[id],pricing-templates}/page.tsx` (renamed: pricing templates ARE product shells) |
| `pipeline/screen-finance.jsx` — AP, credits, new credit memo | `prototype/app/(shell)/{ap,credits,credits/new}/page.tsx`, `components/{ap,credits}/*` |
| `pipeline/screen-buyers.jsx` — buyer analytics | `prototype/app/(shell)/buyers/page.tsx`, `components/ui/sell-through-thermometer.tsx` |
| `pipeline/screen-vendors.jsx` — vendor scorecards + feature flags | `prototype/app/(shell)/{scorecards,settings/flags}/page.tsx`, `components/{scorecard,settings}/*` |
| `pipeline/screen-admin.jsx` — pipeline stage config + master catalog | `prototype/app/(shell)/admin/**` |
| `pipeline/data-ops.jsx` · `data-products.jsx` · `data-buyer.jsx` · `data-vendors.jsx` | `prototype/lib/fake-ops-data.ts`, `lib/fixtures/{products,buyer-analytics}.ts`, tail of `lib/fake-data.ts` |

### Engage (dev-hyperwolf/Engage @ main)

| Screen here | Built from |
|---|---|
| `Hyperwolf Engage.html` + `engage/app.jsx` — rail · 5-group module nav · tenant switcher · ⌘K palette | `apps/web/app/console/layout.tsx`, `components/console/{sidebar,topbar,command-palette}.tsx` |
| `engage/screen-home.jsx` — dashboard | `app/console/page.tsx` |
| `engage/screen-customers.jsx` — list + profile (PII reveal, unified balance, predictive) | `app/console/customers/{page,[id]/page}.tsx`, `_components/*` |
| `engage/screen-audiences.jsx` — list, detail, suggested, compare | `app/console/audiences/{page,[id],suggested,compare}` |
| `engage/screen-audience-builder.jsx` — AI builder, trait catalog, live preview | `app/console/audiences/new/audience-builder.tsx` + `_components/*` |
| `engage/screen-flows.jsx` — list, detail, new, templates | `app/console/flows/**` |
| `engage/screen-loyalty.jsx` — loyalty, program, referrals(+programs, fraud), wallet | `app/console/{loyalty,referrals,wallet}/**` |
| `engage/screen-campaigns.jsx` — campaigns, messages, templates, interactive | `app/console/{campaigns,messages,templates,interactive}/**` |
| `engage/charts.jsx` + `screen-analytics.jsx` + `screen-analytics2.jsx` — 8 analytics views | `app/console/analytics/**`, `components/charts/*`, `components/console/rfm-matrix.tsx` |
| `engage/screen-ops.jsx` — integrations(+detail), audit, health, settings, cost, flags, onboarding | `app/console/{integrations,audit,health,settings,onboarding}/**` |
| `engage/data.jsx` — seeded fixtures matching the server-action row shapes | `app/console/*/actions.ts` (types only — upstream reads Postgres) |
