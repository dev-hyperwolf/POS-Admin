# Offload queue

A way to run mechanical, well-specified tasks on OpenAI's Codex CLI (your
ChatGPT account) when Anthropic usage is tight, instead of blocking on it.

**Flow:** a Claude PM session writes a self-contained brief per task ->
JT runs one script -> Codex executes each brief inside the target repo,
foreground, one at a time -> results come back as a log + a report file the
brief asked Codex to write -> a Claude PM session reads and refutes those
results before anything gets committed.

Nothing here commits to git. Nothing here is a substitute for review — it's
a way to get mechanical work done in parallel with a budget-limited
Anthropic session, not a way to skip having a Claude session look at the
result.

## Install (one-time, JT)

Codex CLI is installed and logged in on this Mac as of 2026-09-17
(`codex --version` → `codex-cli 0.154.0`). If you're setting this up on a
different machine, or it ever gets uninstalled:

```bash
npm i -g @openai/codex
codex login          # opens a browser, log in with the ChatGPT account
codex --version       # confirm it worked
```

`run_queue.sh --dry-run` always prints `codex --version` when it finds the
binary, so that's the fastest way to confirm this machine is still set up.

## How to run it

```bash
tools/offload/run_queue.sh              # run every brief in tools/offload/queue/, in order
tools/offload/run_queue.sh --dry-run    # list the queue, run nothing
```

- Refuses to run (prints the install line above) if `codex` isn't on PATH.
  `--dry-run` still lists the queue in that case — it just also tells you
  `codex` is missing, it doesn't hard-fail.
- Runs one brief at a time, in numeric order (`queue/01-*.md`,
  `queue/02-*.md`, ...). Never two at once — a lock directory
  (`tools/offload/.run.lock`) prevents a second concurrent invocation of
  this script from starting.
- Each brief gets a hard wall-clock cap (`max_minutes` in its front matter,
  default 20) enforced with `perl -e 'alarm N; exec @ARGV'` — macOS has no
  `timeout` binary, this is the standard workaround (`alarm()` survives
  `exec()`, so the timer still fires and kills the Codex process even
  though the Perl process image is gone by then).
- Captures Codex's stdout+stderr to `tools/offload/reports/NN-<name>.log`
  and appends one line to `tools/offload/reports/INDEX.md` (brief name,
  exit code, duration, timestamp) every time.
- On exit 0: moves the brief from `queue/` to `done/`. On any other exit
  (including a timeout kill): leaves it in `queue/` so it's obviously still
  outstanding, and the script's own exit code is non-zero so you notice.

### The Codex invocation, and what to do if it's wrong

Default:
```
codex exec --sandbox workspace-write --approve-for-me --cd "<repo>" "<brief text>"
```
Verified against a real, installed `codex exec --help` (codex-cli 0.154.0,
2026-09-17) — not guessed. There is **no** `--full-auto` flag on this
version (that's an older/other tool's flag name — don't use it here).
`-s/--sandbox workspace-write` lets Codex write inside the `--cd` root;
`--approve-for-me` routes anything that would otherwise pop an approval
prompt (network access, an escalated command) through automatic review
instead of blocking on stdin forever, which a headless queue can never
answer.

If a future Codex version renames these, re-check with `codex exec --help`
first, then override the whole base command (everything except `--cd
<repo>` and the brief text, which `run_queue.sh` always appends itself so
quoting stays inside bash arrays, never a shell string):
```bash
CODEX_CMD='codex exec --sandbox workspace-write --approve-for-me' tools/offload/run_queue.sh
```
`-m <model_hint>` is passed through from each brief's front matter if
present; drop it (or fix the flag name) here too if it ever errors.

### What `run_queue.sh` enforces vs. what the brief enforces

`run_queue.sh` only reads `repo`, `max_minutes`, and `model_hint` from a
brief's front matter, and only to build the Codex invocation and the
timeout. It does **not** sandbox Codex to `files_allowed`, and it does
**not** run `verify_command` itself — those two fields are contract
metadata for Codex (the brief's own text tells it to respect them) and for
the PM's refutation pass (an exact command to re-run, not a vague retest).
The actual safety boundary is: the brief's own "Hard rules" section, and a
human/Claude reading the diff before it's committed. Don't treat
`files_allowed` as a technical sandbox — it isn't one.

## What Codex may and may not do

These mirror the estate's standing rules (`CLAUDE.md`, `hyperwolf-standards`
skill) — a brief that contradicts these is a bad brief, not a license to
break them:

**Never:**
- Read, write, copy, move, or delete any `.env` file, anywhere, for any
  reason.
- Run a git command that writes (`add`, `commit`, `push`, `checkout -b`,
  `reset`, etc.). Read-only git (`status`, `diff`, `log`) is fine. The PM
  commits, always, after reviewing the diff.
- Run `pkill -f` or any broad/pattern-based process kill. If a brief needs
  a server running, it says so and expects Codex to track that one PID and
  kill only it.
- Treat `/Users/jt/hyper-tech/*` as anything but read-only reference
  material — those twelve repos are the dev team's, never edited from here.
- Touch a live/committed `.sqlite3` file. Every DB a brief's steps touch
  must be a scratch or fixture DB created for that task.
- Run anything past the brief's own `max_minutes` — if a step looks like
  it'll blow the cap, stop and report partial progress instead of letting
  it run long.

**Offload-safe (put these in the queue):**
- Probe/expectation rewrites where the premise went stale (a route got
  registered, a count changed) and the fix is "make the assertion match
  measured reality" — never "make reality look passing."
- Fixture/golden generation, mechanical field-count reconciliation,
  EXPECTED_CHECKS-style floor updates (raise-only, always measured first).
- Doc formatting / doc refreshes that transcribe facts already written
  somewhere else, cited line-for-line.
- Mechanical ports that follow an existing pattern 1:1 (a new form
  definition shaped exactly like eight already-shipped siblings), with a
  probe extending the same pattern.
- Credential-sweep-shaped probes (does this route/gate require a real
  header, not "should this gate exist").

**Claude-only (never put these in the queue):**
- Any security judgment call: whether a gap is acceptable, whether an
  auth/scope check is correctly designed, whether a documented exception is
  actually fine vs. a real hole.
- Refuter passes (adversarial QA on someone else's work) — Codex wrote the
  change or didn't, either way it isn't the one to mark its own homework.
- Anything touching authz/sessions logic itself, money arithmetic/rounding,
  or PII handling design (not the mechanical "does this field exist" check
  — the actual judgment of whether a design is safe).
- Commits, deploys, or anything that changes what's live.

## How results flow back

1. `run_queue.sh` moves a finished (exit 0) brief from `queue/` to `done/`
   and writes `reports/NN-<name>.log` (raw Codex stdout/stderr) plus one
   line in `reports/INDEX.md`.
2. Each brief also tells Codex to write its own `REPORT-NN-<slug>.md`
   *inside the target repo* (not under `tools/offload/`) next to the files
   it touched — see `brief_template.md`'s "Report format" section. That's
   the file a Claude PM session actually reads to refute the work: what
   changed, the exact verify command and its real output, anything it
   couldn't do and why.
3. A brief left in `queue/` (non-zero exit, or a timeout kill) did NOT
   finish — check `reports/NN-<name>.log` for why before re-running it.
4. Nothing is committed by any of this. The PM session reads the in-repo
   report(s) and the diff, decides whether it's correct, fixes or asks for
   a re-run if not, and commits.

## Files here

- `README.md` — this file.
- `run_queue.sh` — the driver script (see above).
- `brief_template.md` — the shape every brief follows: front matter (repo,
  model hint, max_minutes, files_allowed, verify_command) then goal / hard
  rules / steps / verify / report format.
- `queue/NN-*.md` — briefs waiting to run, in run order.
- `done/` — briefs that finished (exit 0), moved here automatically.
- `reports/NN-<name>.log` — raw output per run; `reports/INDEX.md` — one
  line per run (name, exit code, duration).
