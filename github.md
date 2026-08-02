repo: dev-hyperwolf/POS-Admin
branch: main

## Purpose

POS-Admin is the home for THIS project — the Hyperwolf design source of truth
(browser-compiled React, no build step). Claude Code commits it here, turns on
Pages for the share link, and later scaffolds the Node/React app from it.

## Last sync

date: 2026-08-02T22:12:48Z

### Updated in this project

- Surveyed the METRC batch-pipeline prototype (`prototype/app`) — 16 screens to port.
- Surveyed `dev-hyperwolf/Engage` (`apps/web/app/console`) — 54 console pages to port.
- Nothing copied into this project yet; port order pending sign-off.

## Source repos (read-only, ported FROM)

- dev-hyperwolf/hyperdrive-design — `prototype/`, the METRC batch-pipeline UI (Next + Tailwind)
  and 71 specs. `prototype/THEME.md` confirms Hyperdrive and Engage share one design language.

- dev-hyperwolf/Engage — loyalty / CRM / segmentation / messaging console (Next.js, `apps/web`).
- dev-hyperwolf/hyperdrive — POS/CRM/e-commerce API + db. Backend only; use for data shapes
  (`apps/api/src/routes/batches.ts`, `packages/db/migrations`, `perf-kit/node/metrc-eod-cron.ts`).

## Screen map

| Screen here | Built from |
|---|---|
| _(none yet)_ | — |

### Planned

| Screen to build | Source |
|---|---|
| Batch pipeline (list · detail · merge · archive) | hyperdrive-design `prototype/app/(shell)/batches/**` |
| Compliance & holds | hyperdrive-design `prototype/app/(shell)/compliance/**` |
| Intake inbox · scan · admin pipeline | hyperdrive-design `prototype/app/(shell)/inbox`, `app/scan`, `admin/pipeline` |
| Invoices · credits · AP · buyers | hyperdrive-design `prototype/app/(shell)/{invoices,credits,ap,buyers}` |
| Engage: customers · audiences · flows | Engage `apps/web/app/console/{customers,audiences,flows}` |
| Engage: loyalty · referrals · campaigns | Engage `apps/web/app/console/{loyalty,referrals,campaigns}` |
| Engage: analytics | Engage `apps/web/app/console/analytics/**` |
