# Operating plan — owner and Claude build, developers verify and deploy

Draft for the owner, 2026-09-10. Nothing here is agreed with the developers yet. It follows the
audit (`THE-GRADE.md`), the team to-do (`TEAM-TODO.md`, tracked live in the Hyperwolf Fix Waves
board) and the deploy map (`DEPLOY-MAP-FROM-REPOS.md`).

## The decision

The owner and Claude write the fixes and the new modules. The developers review, test, deploy and
operate. The developers keep production knowledge until it is written down and the owner holds
every account; after that their role is QA and release.

## What is true today (from the repos and the owner)

- No production deploy exists in any repo. Production is deployed by hand by the developers.
- Four repos deploy their stage builds to `thcs.in`, a host the company does not own.
- Deploys fire from feature-branch names: `development`, `hyperdrive-fleet`,
  `feature-schedule-dynamic`, `feat/admin_promo`, `free-product-and-calculation`,
  `new-ui-design-development`, `bug/delivery-slot`, `fullfillment-task-dev`. A push to one of
  those deploys. Our branches never use those names.
- The owner is GitHub org owner of Hyper-Tech-inc and pays for hosting and domains. Database
  ownership sits with the developers. Server root access sits with the developers.
- There is no monitoring, no staging the company owns, no lockfiles, no CI that blocks a broken
  build. The only place a change is tested today is production.

## Phase A — ownership and sight (before any fix)

| # | What | Who | Done when |
|---|---|---|---|
| A1 | Root access on every server in the company's cloud account, via the cloud console (no developer needed) | owner | owner can SSH to each host and list the pm2 processes |
| A2 | Written deploy line per backend: host, path, branch, command, rollback — and one rehearsed rollback on a harmless change | developers | the line exists and the rehearsal is logged |
| A3 | Database ownership: Atlas org transfer, or a migration to the company's own cluster with a planned cutover | developers (transfer) or owner + Claude (migration) | owner is org owner; developers are members |
| A4 | Staging off `thcs.in`: one company-owned box (or Render service) per backend family | owner + Claude, developers move DNS | every stage workflow points at a company host |
| A5 | Monitoring: health endpoint per backend, memory/CPU/disk, log shipping, alerts to the owner's phone | Claude builds, developers install | an induced restart pages the owner within a minute |
| A6 | Rotate every committed secret (to-do 0.1–0.3) once A1 is done, so the new values land on hosts the owner controls | owner | old values rejected |

## Phase B — fix waves 1–3, on branches

- Claude works in `/Users/jt/hyper-tech/<repo>` on a branch named `fix/<wave>.<item>-<slug>`.
- One pull request per to-do item: the change, the proof command from the tracker, the rollback.
- Developers review within two working days, deploy to staging, run the proof, then deploy to
  production in the quiet window (owner's call; 1.6 and 2.9 only with a before/after probe).
- Owner watches the monitor for ten minutes after each production deploy.
- Status and notes go on the Hyperwolf Fix Waves board; nothing is "done" until the proof passed
  in production and the row says Complete with a name on it.

## Phase C — platform (waves 4–5) and new modules

Same mechanics, larger pull requests, each preceded by a written design the developers have read.
New modules keep being built in our estate first (as Bounty, Verify and Docs were) and lifted in
behind the contracts package.

## Phase D — the operations agent (owner decision 2026-09-10: step by step, each step needs the
owner's explicit approval before the next is switched on; step 4 is the ceiling — no root)

1. **See**: A5 above.
2. **Runbooks**: scripted responses to recurring failures (out-of-memory restart, failed-health
   rollback, full disk), triggered by the monitor, rehearsed by hand first.
3. **Diagnose**: an agent that wakes on an alert, reads logs and code, names the cause and the
   fix, messages the owner. Read-only credentials.
4. **Act**: the agent may run the runbooks unattended and open a fix as a pull request; deploying
   it stays a human tap. Root-level improvisation on production is not on the ladder.

## What the developers are asked for, in this order

1. A2: the deploy line per backend and one rehearsed rollback — within a week.
2. A3: database ownership transfer — within two weeks.
3. Help moving stage hosts off `thcs.in` (A4).
4. Then: review and deploy pull requests; run the proofs; keep the board current.

## What the owner does first

1. A1: get root on the servers through the cloud console.
2. Send the request list above with dates.
3. Say when Verify testing is done so the waiting production fixes can be pushed.
