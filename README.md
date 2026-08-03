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

## Hosting

Published with GitHub Pages from `main` / root. `.nojekyll` is present so Pages serves every
file verbatim. `index.html` redirects to the hub.
