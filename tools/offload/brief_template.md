---
repo: /absolute/path/to/repo
model_hint: gpt-5-codex
max_minutes: 20
files_allowed: path/to/file_one.py path/to/file_two.py
verify_command: cd /absolute/path/to/repo && python3 path/to/probe_or_test.py
---

<!--
  Front matter is metadata for the human/PM side, not enforced by
  run_queue.sh beyond repo/max_minutes/model_hint (see tools/offload/README.md
  "What run_queue.sh enforces vs what the brief enforces"). files_allowed and
  verify_command exist so:
    - Codex knows the boundary and can self-check before finishing
    - the PM's refuter pass has an exact command to re-run, not a vague retest

  Everything below the front matter is the actual prompt text handed to
  Codex verbatim (`codex exec ... "$(cat this-file)"`). Write it as if the
  reader has never seen this repo before: they haven't.
-->

# Goal

One or two sentences. What does the repo look like when this is done —
not the steps, the end state.

# Hard rules

- Never read, write, copy, move, or delete any `.env` file, anywhere.
- No git commands that write (`add`, `commit`, `push`, `checkout -b`, etc.) —
  the PM commits after reviewing your diff. Read-only git (`status`, `diff`,
  `log`) is fine.
- Touch only the files listed in `files_allowed` above, plus new files your
  steps explicitly say to create. If you find you need to touch something
  else to finish, stop and say so in your report instead of doing it.
- `/Users/jt/hyper-tech/*` is read-only reference material if you need to
  consult it — never edit anything under it.
- Never run `pkill -f` or any broad process kill. If you start a server for
  testing, note its PID and stop only that PID.
- Any database you touch must be a scratch/fixture DB you create for this
  task, never a live `.sqlite3` file already in the repo.
- Foreground runs only, with the time cap in `max_minutes` above. If a step
  looks like it will exceed that, stop and report what's done instead of
  letting it run past the cap.
- Never lower a check count, an EXPECTED_CHECKS floor, or weaken an
  assertion to make something pass. If a real count differs from a stale
  expectation, raise the expectation to match reality and say so — never
  the reverse.

# Steps

1. Exact, ordered, stranger-runnable steps. Name real files and real line
   numbers where you already know them. Say what to read first.
2. ...

# Verify

The exact command(s) to run to prove the work is done (mirror
`verify_command` above) and what output counts as success. Be specific:
"prints `42/42 PASS`", not "tests pass."

# Report format

Write your findings to `<repo>/<some path>/REPORT-<brief-name>.md` (or
append to stdout if the brief says so) covering:
- what you changed, file by file
- the exact verify command you ran and its actual output
- anything the steps asked for that you could NOT do, and why
- anything you touched that wasn't in `files_allowed`, and why (should be
  empty — flag it loudly if it isn't)
