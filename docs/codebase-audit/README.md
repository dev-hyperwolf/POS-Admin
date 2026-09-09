# Hyper-Tech codebase audit — index

Read in this order.

1. `THE-GRADE.md` — the score (29/100), the rubric, quick fixes ranked by points per hour, the
   twelve biggest issues with blast radius, and the owner's asks answered.
2. `ARCHITECTURE-MAP.md` — what the twelve repos are, who talks to whom, which repo is canonical
   for each concept, where one concept exists in several shapes.
3. `CANONICAL-DATA-MODEL.md` — the data model as it actually is, concept by concept, and what the
   Phase 3 contract package must define.
4. `CONSOLIDATION-AND-PLATFORM-SERVICES.md` — preconditions, shared packages, the eight platform
   services, the merge order with risk, and the decisions that are the owner's.
5. `our-estate-contract-surface.md` — Bounty and Verify's ids, enums, money, time, routes and the
   ten things most likely to collide with a Mongo backend.
6. `repos/<repo>.md` — one report per repo, 19 sections, every claim with `path:line`;
   `repos/<repo>.datamodel.md` — every schema, every field.
7. `metrics/` — mechanical counts from `tools/hw_audit_metrics.py`; `CROSS-REPO-DUPLICATES.md`,
   `fork-distance.md`, `concept-matrix.md`.

To audit a new repo: `gh repo clone Hyper-Tech-inc/<name> /Users/jt/hyper-tech/<name>`, run
`python3 tools/hw_audit_metrics.py /Users/jt/hyper-tech docs/codebase-audit/metrics <name>`,
dispatch `DISCOVERY-PROMPT.md` with REPO and SHA filled in, then fold the result into the four
synthesis documents above.
