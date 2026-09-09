# Hyperwolf codebase audit — status

Updated 2026-09-09. Phases 1 and 2 are complete and **stopped, waiting on the owner**. No file
under `/Users/jt/hyper-tech` (the twelve Hyper-Tech-inc clones) has been modified. Nothing has
been pushed anywhere.

## Where it stands

**Overall grade 29 / 100** across twelve repos (19 to 37). Read
[`codebase-audit/THE-GRADE.md`](codebase-audit/THE-GRADE.md) first; the index is
[`codebase-audit/README.md`](codebase-audit/README.md).

## What was done

- Cloned all twelve repos fresh to `/Users/jt/hyper-tech/<repo>` and pinned each to its HEAD SHA
  (recorded in `codebase-audit/metrics/<repo>.md`). Every repo has exactly one commit, dated
  8–9 September, by one author: there is no history to mine.
- Built a repeatable mechanical pass, `tools/hw_audit_metrics.py` (stdlib Python), producing per-repo
  metrics, cross-repo exact/near duplicates, a fork-distance table and a concept matrix.
- Dispatched twelve discovery agents against one shared prompt (`codebase-audit/DISCOVERY-PROMPT.md`)
  and one digest of our own estate's contract surface. Every claim in the reports carries a
  `path:line`; each agent corrected the mechanical pass where it was wrong and said so.
- Synthesised the architecture map, the canonical data model as it is, the consolidation and
  platform-services plan, and the grade with its rubric and arithmetic.

## What was verified, and how

- Report files exist and are within their line caps; grep over all reports for secret-value
  patterns found one Firebase web API key that had been copied into a report — redacted in place;
  no other value appears anywhere in `docs/codebase-audit/`.
- `npm audit --package-lock-only` on the four repos that have a lockfile (no install, no scripts):
  80 / 51 / 29 / 14 advisories. The other eight cannot be audited without an install because they
  gitignore their lockfile.
- Fork distance measured with `difflib` on same-basename files (`metrics/fork-distance.md`), not
  inferred from the reports.
- The Firebase service-account key in `hyperwolf-backend` was confirmed by counting the
  `BEGIN PRIVATE KEY` marker line, never by reading the value.
- Not verified: anything live. No production host was called, no database was opened, no test
  suite in the twelve repos was run (there is none to run). Deployment branch/host mismatches are
  reported as open questions in each repo's §19, not as facts.

## Waiting on you

1. **Rotate the three committed service-account keys** (`hyperwolf-backend/hyperdrive-firebase-adminsdk.json`,
   `hemp-backend/staticDB/fcmtoken.json`, `stilo-backend/staticDB/fcmtoken.json`), the Google Maps
   key in `hyperwolf-backend/controllers/google-controllers.js:23`, and the LedgerGreen webhook
   literal at `ledgergreen-controllers.js:10`. Your call, today.
2. Read `THE-GRADE.md`; say go for Phase 3 (contracts package + adapters in our estate — touches
   nothing in Hyper-Tech) and/or for the quick fixes in the Hyper-Tech repos (touches them; needs
   your decision on who has write access).
3. The five decisions in `CONSOLIDATION-AND-PLATFORM-SERVICES.md` §6, asked one at a time.

## Run it

```bash
cd /Users/jt/POS-Admin && python3 tools/hw_audit_metrics.py /Users/jt/hyper-tech docs/codebase-audit/metrics
```

Re-runs the mechanical pass over every clone (about 70 s). Add a repo name at the end to run one.
