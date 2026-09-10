#!/bin/zsh
# Push POS-Admin main to GitHub (auto-deploys GitHub Pages and, via sync-render.yml, Render).
# Prints what will go out first, then pushes. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "commits not yet on origin/main:"; git log --oneline origin/main..main | cat
git push origin main
echo "done: $(git rev-parse --short HEAD) is on origin/main"
