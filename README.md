# POS-Admin

POS and Admin Designs for Dev team to use as a guide.

## This repo mirrors a design-tool project

`POS-Admin` is a **mirror of a Claude design-tool project** — that project is
**upstream** and is the source of truth. Design work continues there against this
same file set. When there is a new design drop, the updated files are pulled into
this repo and pushed, keeping the exact same folder structure and filenames.

Do not refactor, rename, reformat, or "fix" anything here. The code is
browser-compiled React (React + Babel standalone loaded from a CDN, JSX served as
plain files) with **no build step and no bundler**. It is intentionally not
TypeScript. Edits belong upstream in the design tool, not directly in this repo —
direct edits here will be overwritten by the next sync.

- **Project map & rules:** see [`CLAUDE.md`](CLAUDE.md).
- **Import/port status (from `hyperdrive-design` and `Engage`):** see [`github.md`](github.md).
- **Hub / index of record:** `Hyperwolf.html` — every live surface links from it.

## Hosting

Published with GitHub Pages from `main` / root. `.nojekyll` is present so Pages
serves every file verbatim (the inline React in some HTML files contains `{{ }}`,
which Jekyll would otherwise try to parse).
