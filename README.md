# POS-Admin

POS and Admin Designs for Dev team to use as a guide.

## This repo mirrors a design-tool project

`POS-Admin` is a mirror of a Claude design-tool project — that project is upstream and is the
source of truth. Design work continues there against this same file set. Do not refactor,
rename, reformat, or "fix" anything here. The code is browser-compiled React (React + Babel
standalone from a CDN, JSX served as plain files) with no build step and no bundler. It is
intentionally not TypeScript. Edits belong upstream in the design tool — direct edits here will
be overwritten by the next sync.

- Project map & rules: `CLAUDE.md`
- Design-system spec & recreation brief for the two Hyperdrive consoles: `HANDOFF.md`
- Import/port status: `github.md`
- Hub / index of record: `Hyperwolf.html`

## Start here

Read `HANDOFF.md` end to end before writing code. Its first section, **What changed in this
drop**, lists the deltas since the previous export — read that even if you have seen this bundle
before. Then `pipeline/app.jsx` and `engage/app.jsx`, which hold the route tables, the shells and
the full screen inventory.

Four non-negotiables, spelled out in `HANDOFF.md`:

1. **Tokens only.** Every color resolves from `pos/tokens.jsx`. There are zero hard-coded hexes in
   any screen file; keep it that way in the implementation.
2. **The accent-text rule.** `#FFD100` fails contrast on white. Accent-colored *text or icons* use
   `accentBorder` in light mode and `accent` in dark. Accent as a *fill* is `accent` + `accentInk`.
3. **Mono for values.** Every number, ID, METRC tag, timestamp, currency, percent and SKU is
   JetBrains Mono with `tabular-nums`. Prose is Inter.
4. **Density.** `HANDOFF.md` gives exact heights for rows, buttons, inputs, chips and rail items.

The `.html` files are design references, not code to lift — open them in a browser to see them
run, then recreate the screens with the target codebase's real components and data layer. All
fixtures are synthetic and seeded; the generators document the row shape each screen expects.

## Hosting

Published with GitHub Pages from `main` / root. `.nojekyll` is present so Pages serves every
file verbatim. `index.html` redirects to the hub.
