#!/usr/bin/env bash
# tools/offload/run_queue.sh — run every queued brief through the Codex CLI.
#
# Usage:
#   tools/offload/run_queue.sh              run the whole queue, one brief at a time
#   tools/offload/run_queue.sh --dry-run     list the queue and exit; run nothing
#
# See tools/offload/README.md for the full contract (what Codex may/may not do,
# how results flow back). This script only drives the CLI and files the paper
# trail — it does not judge the work. That is the PM's job (refute + commit).
#
# HARD RULES enforced here:
#   - never touches any .env file
#   - never runs a git write command
#   - only reads/writes inside tools/offload/{queue,done,reports}
set -u -o pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUEUE_DIR="$HERE/queue"
DONE_DIR="$HERE/done"
REPORTS_DIR="$HERE/reports"
INDEX="$REPORTS_DIR/INDEX.md"
LOCK_DIR="$HERE/.run.lock"

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

INSTALL_LINE='Install Codex CLI first: npm i -g @openai/codex   (then: codex login   and verify with: codex --version)'

codex_missing() {
  ! command -v codex >/dev/null 2>&1
}

# ---------------------------------------------------------------------------
# Front-matter parsing. Briefs open with a fenced block:
#   ---
#   repo: /Users/jt/wm-demo
#   model_hint: gpt-5-codex
#   max_minutes: 20
#   files_allowed: qa/foo_probe.py qa/battery.py
#   verify_command: cd /Users/jt/wm-demo && python3 qa/foo_probe.py
#   ---
# Every field is a single line (no multi-line YAML) so plain grep/sed can
# read it without a YAML parser. See brief_template.md.
# ---------------------------------------------------------------------------
fm_get() {
  # fm_get <file> <key>
  local file="$1" key="$2"
  sed -n '/^---[[:space:]]*$/,/^---[[:space:]]*$/p' "$file" \
    | grep -m1 "^${key}:" \
    | sed "s/^${key}:[[:space:]]*//"
}

# ---------------------------------------------------------------------------
# The Codex invocation. Overridable wholesale via CODEX_CMD (the base command
# and flags only — this script always appends `--cd <repo>` and the model
# hint, then the brief text, itself, so quoting stays inside bash arrays and
# never round-trips through a shell string).
#
# Verified against a real, installed `codex exec --help` (codex-cli 0.154.0,
# 2026-09-17) — NOT a guess: there is no `--full-auto` flag on this version.
# The real non-interactive/no-prompting shape is:
#   codex exec --sandbox workspace-write --approve-for-me
# `-s/--sandbox workspace-write` lets Codex write inside the `--cd` root;
# `--approve-for-me` routes anything that would otherwise need an approval
# prompt (network access, escalated commands) through automatic review
# instead of blocking on stdin, which a headless queue can never answer.
# If a future Codex version renames these, re-check with `codex exec --help`
# and override the base command (everything except `--cd <repo>`/the model
# flag/the brief text, which this script always appends itself so quoting
# stays inside bash arrays):
#   CODEX_CMD='codex exec --sandbox workspace-write --approve-for-me' tools/offload/run_queue.sh
# ---------------------------------------------------------------------------
: "${CODEX_CMD:=codex exec --sandbox workspace-write --approve-for-me}"

mkdir -p "$REPORTS_DIR" "$DONE_DIR"
[ -f "$INDEX" ] || echo "# Offload queue — run index" > "$INDEX"

shopt -s nullglob
briefs=("$QUEUE_DIR"/[0-9][0-9]-*.md)
shopt -u nullglob

if [ "${#briefs[@]}" -eq 0 ]; then
  echo "Queue is empty (tools/offload/queue/ has no NN-*.md briefs)."
  if codex_missing; then
    echo "$INSTALL_LINE"
  fi
  exit 0
fi

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Offload queue (${#briefs[@]} brief(s)), in run order:"
  for b in "${briefs[@]}"; do
    name="$(basename "$b")"
    repo="$(fm_get "$b" repo)"
    max_minutes="$(fm_get "$b" max_minutes)"
    model_hint="$(fm_get "$b" model_hint)"
    printf '  %-40s repo=%-30s max_minutes=%-5s model_hint=%s\n' \
      "$name" "${repo:-<missing>}" "${max_minutes:-<missing>}" "${model_hint:-<none>}"
  done
  echo
  if codex_missing; then
    echo "codex CLI not found on PATH."
    echo "$INSTALL_LINE"
  else
    echo "codex CLI found: $(codex --version 2>&1)"
    echo "Base invocation: $CODEX_CMD --cd <repo> [-m <model_hint>] '<brief text>'"
  fi
  exit 0
fi

if codex_missing; then
  echo "codex CLI not found on PATH. Refusing to run the queue." >&2
  echo "$INSTALL_LINE" >&2
  exit 1
fi

# Single-flight lock — never run two queues at once. mkdir is atomic.
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Another run_queue.sh appears to be running (found $LOCK_DIR)." >&2
  echo "If that's stale (a prior run crashed), remove it and retry: rmdir '$LOCK_DIR'" >&2
  exit 1
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

read -r -a CODEX_BASE <<< "$CODEX_CMD"

overall_status=0

for b in "${briefs[@]}"; do
  name="$(basename "$b")"
  stem="${name%.md}"
  log="$REPORTS_DIR/${stem}.log"

  repo="$(fm_get "$b" repo)"
  max_minutes="$(fm_get "$b" max_minutes)"
  model_hint="$(fm_get "$b" model_hint)"

  if [ -z "$repo" ]; then
    echo "SKIP $name: no 'repo:' in front matter" | tee -a "$log" >&2
    printf -- '- %s | exit=SKIP (no repo in front matter) | 0s | %s\n' "$name" "$(date -u +%FT%TZ)" >> "$INDEX"
    overall_status=1
    continue
  fi
  if [ ! -d "$repo" ]; then
    echo "SKIP $name: repo '$repo' does not exist" | tee -a "$log" >&2
    printf -- '- %s | exit=SKIP (repo not found: %s) | 0s | %s\n' "$name" "$repo" "$(date -u +%FT%TZ)" >> "$INDEX"
    overall_status=1
    continue
  fi

  minutes="${max_minutes:-20}"
  case "$minutes" in
    ''|*[!0-9]*) minutes=20 ;;
  esac
  timeout_secs=$(( minutes * 60 ))

  brief_text="$(cat "$b")"

  cmd=("${CODEX_BASE[@]}")
  if [ -n "$model_hint" ]; then
    cmd+=(-m "$model_hint")
  fi
  cmd+=(--cd "$repo" "$brief_text")

  echo "=== $name -> repo=$repo max_minutes=$minutes ===" | tee "$log"
  start_ts=$(date +%s)

  # macOS has no `timeout`; alarm()+exec() survives the exec, so SIGALRM
  # still kills the codex process at the deadline even though perl's own
  # image is gone by then.
  perl -e 'alarm shift @ARGV; exec @ARGV or die "exec failed: $!"' \
    "$timeout_secs" "${cmd[@]}" >>"$log" 2>&1
  rc=$?

  end_ts=$(date +%s)
  duration=$(( end_ts - start_ts ))

  echo "=== $name exit=$rc duration=${duration}s ===" | tee -a "$log"
  printf -- '- %s | exit=%s | %ss | %s\n' "$name" "$rc" "$duration" "$(date -u +%FT%TZ)" >> "$INDEX"

  if [ "$rc" -eq 0 ]; then
    mv "$b" "$DONE_DIR/$name"
  else
    overall_status=1
    echo "LEFT IN QUEUE (exit $rc): $name — see $log" >&2
  fi
done

exit "$overall_status"
