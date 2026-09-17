#!/bin/bash
# Creates two isolated git worktrees for the ChatGPT/Codex takeover so its work never touches the
# main checkouts (which other sessions share and which Render deploys from). Safe to re-run.
# Nothing is pushed, nothing on `main` is changed. Review = `git -C <repo> log main..codex/handoff`.
set -euo pipefail
make_wt() {
  local repo="$1" wt="$2" branch="codex/handoff"
  if [ -d "$wt/.git" ] || [ -f "$wt/.git" ]; then echo "exists: $wt"; return; fi
  if git -C "$repo" show-ref --verify --quiet "refs/heads/$branch"; then
    git -C "$repo" worktree add "$wt" "$branch"
  else
    git -C "$repo" worktree add -b "$branch" "$wt" main
  fi
  echo "created: $wt on $branch (from main @ $(git -C "$repo" rev-parse --short main))"
}
make_wt /Users/jt/wm-demo   /Users/jt/codex-work/wm-demo
make_wt /Users/jt/POS-Admin /Users/jt/codex-work/POS-Admin
# Node deps for the TypeScript kit and the front-end tests live in node_modules (not in git).
[ -d /Users/jt/codex-work/wm-demo/platform/node_modules ] || (cd /Users/jt/codex-work/wm-demo/platform && npm ci --silent) || true
[ -d /Users/jt/codex-work/wm-demo/infra/node_modules ]    || (cd /Users/jt/codex-work/wm-demo/infra && npm ci --silent) || true
[ -d /Users/jt/codex-work/POS-Admin/node_modules ]        || (cd /Users/jt/codex-work/POS-Admin && npm ci --silent) || true
echo
echo "Start Codex in the work area:"
echo "  cd /Users/jt/codex-work && codex"
echo "then paste the brief: /Users/jt/POS-Admin/docs/HANDOFF-TO-CODEX-2026-09-17.md"
