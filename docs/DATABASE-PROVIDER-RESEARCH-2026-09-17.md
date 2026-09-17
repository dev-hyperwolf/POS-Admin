# Database provider research — who runs the Postgres

Date: 2026-09-17. Scope: D6 (PLATFORM-AND-CUTOVER-PLAN-2026-09-16.md §8) decided **Postgres, not
Mongo**, and named **RDS Postgres Multi-AZ** as the specific choice. D5 decided **AWS for
production, Render for demo/stage**. This document does not revisit "Postgres vs Mongo" — it
answers the narrower question the owner asked: **which operator should run that Postgres**, given
everything already built (`/Users/jt/wm-demo/infra/lib/data-stack.ts` already provisions
`rds.DatabaseInstance`, Postgres 16.13, KMS CMK, private-isolated subnets, 35-day PITR, Multi-AZ
in prod, Secrets Manager rotation; `/Users/jt/wm-demo/platform` already runs Drizzle ORM against
`pg` in production and `@electric-sql/pglite` in tests via one `db()` factory keyed off
`DATABASE_URL` — see `platform/src/db.ts`).

All facts below carry a citation and a read-date. Where I could not verify something from a
primary source, I say so explicitly rather than guessing.

---

## One page, plain language, for the owner

**Pick: Amazon RDS for PostgreSQL, Multi-AZ — what's already being built.** Don't switch.

**Fallback: Aurora PostgreSQL (provisioned, or Serverless v2 for the reporting side)** — same
engine family, same VPC, same KMS key, same IAM/Secrets Manager wiring; moving to it later is a
snapshot-restore, not a rewrite, because the app only ever speaks the Postgres wire protocol
through a connection string.

**Three facts that decided it:**

1. **You've already paid the integration cost of RDS and nothing else.** The CDK data stack
   (`data-stack.ts`) is written against `rds.DatabaseInstance`, not an Aurora cluster or a
   third-party SaaS. Every other option means either rewriting that stack or adding a second
   vendor's IAM trust boundary, VPC peering, and billing relationship for a system whose stated
   engineering bench is thin (per `HANDOFF`/plan docs, no dedicated DBA).
2. **RDS has zero Postgres-fidelity gaps for this workload.** pgcrypto, pg_trgm, PostGIS, and
   logical replication (both directions — publisher *and* subscriber) are all supported on RDS
   for PostgreSQL ([AWS docs, pgAudit](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.PostgreSQL.CommonDBATasks.pgaudit.html),
   read 2026-09-17; [AWS docs, logical replication](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.FeatureSupport.LogicalReplication.html),
   read 2026-09-17). Everything the plan needs — the MongoDB strangler CDC feed, JSONB rule
   documents, RLS for entity/store scoping, tamper-evident audit tables — is native Postgres, and
   RDS runs unmodified upstream Postgres. **Aurora DSQL is the one option that flatly fails this
   test**: no foreign keys, no triggers, no views, no PL/pgSQL, no PostGIS, no pgcrypto, no
   pgvector, and only `REPEATABLE READ` (no `SERIALIZABLE`) — disqualifying for a POS/inventory
   OLTP core that needs FK integrity and PostGIS for delivery zones
   ([AWS docs, unsupported features](https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility-unsupported-features.html),
   read 2026-09-17).
3. **No AUP problem found, and there's a live existence proof at scale.** AWS's Acceptable Use
   Policy ([aws.amazon.com/aup/](https://aws.amazon.com/aup/), read 2026-09-17) contains no
   mention of cannabis, marijuana, or controlled substances — its prohibitions are illegal
   activity generically, rights violations, security violations, and spam/abuse. Dutchie, a
   direct cannabis-POS competitor processing "over $100 billion in cannabis transactions... on
   Amazon RDS" ([AWS Dutchie case material via search, read 2026-09-17] — I could not open a
   dedicated AWS case-study page for Dutchie directly; this claim comes from a search snippet
   describing Dutchie's own public materials, not a verified AWS-hosted case study, so treat the
   dollar figure as Dutchie's own claim, not AWS-confirmed) has run production POS workloads on
   AWS RDS for years without a reported suspension. I found **no** report anywhere of AWS
   suspending or terminating an account for being a state-legal cannabis business.

**What would change this answer:**
- If evening-peak bursts turn out far spikier than a fixed instance can absorb without manual
  resizing, move the **reporting/read side** to an Aurora read replica or Aurora Serverless v2 —
  not the OLTP writer. Aurora Serverless v2 now supports true scale-to-zero on an idle timer
  ([usage.ai, Aurora Serverless v2 guide](https://www.usage.ai/blogs/aws/rds/aurora-serverless-v2/),
  read 2026-09-17), which is irrelevant for an always-on POS writer but could suit a bursty
  reporting replica.
- If a future compliance requirement demands FedRAMP specifically (RDS doesn't publish a FedRAMP
  authorization the way Crunchy Bridge does), re-open this.
- If AWS's AUP is ever amended to name cannabis (it is not, as of this read), re-open D5 entirely,
  not just D6.
- Nothing found today reopens **D6 itself** — see the closing section.

---

## Comparison table

| | Security | Durability/PITR | Perf/scaling | Postgres fidelity | Ops | Lock-in | Cost shape | Cannabis AUP risk |
|---|---|---|---|---|---|---|---|---|
| **RDS Postgres (Multi-AZ)** | KMS CMK, IAM DB auth, pgAudit, private-isolated VPC, no public endpoint, AWS SOC2/ISO27001/PCI DSS cover RDS as an in-scope service | 35-day PITR (configured), cross-AZ standby, manual snapshot export you own | Vertical scaling, read replicas, RDS Proxy for pooling; fixed-capacity, no scale-to-zero | Full — unmodified upstream Postgres 16, all extensions, logical repl. both ways | AWS console/CDK, CloudWatch, managed minor-version patching, manual major-version upgrade window | Low — standard `pg_dump`/logical-replication exit path, same as any Postgres | Predictable: instance-hour + gp3 GB-month, no per-I/O metering | None found |
| **Aurora PostgreSQL (provisioned)** | Same KMS/IAM/pgAudit/VPC story as RDS | Same PITR mechanics, faster failover (~30s vs RDS Multi-AZ's ~60-120s), backtrack feature | Aurora storage auto-grows to 128TiB; read replicas up to 15; no scale-to-zero | Full — same extension set as RDS Postgres, historically slightly behind on exact version cadence | Same operational model as RDS, plus Aurora-specific I/O metering to watch | Low — still standard Postgres, same exit path | Less predictable: instance-hour + storage + **per-million-I/O-request charge** (or a flat I/O-Optimized rate) ([Aurora storage/IO pricing](https://www.usage.ai/blogs/aws/reserved-instances/rds/rds-vs-aurora-cost/), read 2026-09-17) | None found |
| **Aurora Serverless v2** | Same as Aurora provisioned | Same | Auto-scales 0.5–256+ ACU in seconds; scale-to-zero on idle | Full, same as Aurora provisioned | Less capacity planning; still Aurora I/O metering | Low | $0.12/ACU-hr standard, $0.156 I/O-Optimized; storage/IO as above ([usage.ai](https://www.usage.ai/blogs/aws/rds/aurora-serverless-v2/), read 2026-09-17) | None found |
| **Aurora DSQL** | KMS at rest (AES-256, CMK optional), IAM-token auth only (no passwords) ([AWS docs](https://docs.aws.amazon.com/aurora-dsql/latest/userguide/data-encryption.html), read 2026-09-17) | Multi-region active-active option, 99.999% multi-region SLA target | Scales to zero, DPU-based, active-active multi-region writes | **Disqualifying gaps**: no FKs, triggers, views, PL/pgSQL, PostGIS, pgcrypto, pgvector; `REPEATABLE READ` only, no `SERIALIZABLE` ([AWS docs](https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility-unsupported-features.html), read 2026-09-17) | New service, narrower tooling ecosystem | Unclear — different enough it isn't a drop-in swap back to RDS | $8/million DPU + $0.33/GB-mo storage, multi-region roughly doubles write DPU cost ([usage.ai DSQL pricing](https://www.usage.ai/blogs/aws/database-savings-plans/aurora/dsql-pricing/), read 2026-09-17) | Not evaluated — ruled out on fidelity before AUP mattered |
| **Neon** | AWS PrivateLink on Business/Enterprise ([Neon blog](https://neon.com/blog/aws-privatelink-for-neon-databases), read 2026-09-17); SOC2 Type 2 + HIPAA-eligible, but **only on the Scale plan** ($0.222/CU-hr) ([search-summarized from neon.com/pricing and related, read 2026-09-17]) | Extended PITR to 30 days on Scale plan | Autoscale 0.25–16 CU in seconds, scale-to-zero after idle (irrelevant for an always-open POS) | Logical replication in **and** out supported ([Neon docs](https://neon.com/docs/guides/logical-replication-guide), read 2026-09-17); extension list narrower than RDS since storage is disaggregated — not independently verified against pgcrypto/PostGIS specifically | Console/API-driven, less AWS-native tooling overlap (separate vendor account, separate billing, separate support relationship) | Medium — separate vendor, own migration/export tooling | $0.106–$0.222/CU-hr + $0.35/GB-mo storage + egress ([search-summarized, read 2026-09-17]) | Not found in the AUP text I could reach; full AUP not independently opened — see gap note |
| **Supabase** | PrivateLink on Team/Enterprise ($599+/mo floor) ([Supabase docs](https://supabase.com/docs/guides/platform/privatelink), read 2026-09-17); SOC2 Type 2 + ISO 27001 on Team; HIPAA needs a paid add-on + BAA on Team/Enterprise ([Supabase blog](https://supabase.com/blog/supabase-soc2-hipaa), read 2026-09-17) | Backup retention scales with plan (14-day PITR cited on Team) | Standard Postgres scaling; realtime layer adds its own logical-replication consumer (wal2json) that would compete with a CDC consumer for replication slots | Full core Postgres, but the product bundles Auth/Storage/Realtime you don't need and that consume replication resources | Adds an unused product surface to operate around | Medium — same underlying Postgres, but migrating off means untangling their Auth/RLS conventions if adopted | $25/mo Pro + usage; $599/mo Team floor for SOC2/ISO ([metacto.com summary](https://www.metacto.com/blogs/the-true-cost-of-supabase-a-comprehensive-guide-to-pricing-integration-and-maintenance), read 2026-09-17) | Not found in searches; full AUP not independently opened — see gap note |
| **Crunchy Bridge** | PrivateLink/VPC peering on AWS, GCP, Azure; pgAudit built-in; FedRAMP + SOC2 ([Crunchy docs](https://docs.crunchybridge.com/how-to/vpc), [Crunchy pricing](https://www.crunchydata.com/pricing), read 2026-09-17) | 10-day PITR via pgBackRest, daily base backup + continuous WAL streaming ([Crunchy Bridge backups doc](https://docs.crunchybridge.com/concepts/backups), read 2026-09-17) | Standard Postgres scaling, connection pooling included | Full — PostGIS, pgAudit, logical replication to external targets (Debezium-compatible) all confirmed ([Crunchy docs](https://docs.crunchybridge.com/how-to/logical-replication), read 2026-09-17) | Managed by Crunchy, cross-account trust boundary from AWS | **Elevated today**: Crunchy Data was acquired by Snowflake (closed 2025); "Snowflake Postgres" reached GA 2026-02-24; no sunset of Bridge announced, but the long-term roadmap for the standalone product is explicitly called uncertain by outside analysts ([Cloud Wars](https://cloudwars.com/cloud/snowflake-to-acquire-crunchy-data-to-power-agentic-ai-with-postgresql-integration/), [layerbase analysis](https://layerbase.com/blog/crunchy-bridge-alternative), read 2026-09-17) | From $10/mo + $0.10/GB-mo storage, pooling and backups included ([Crunchy pricing](https://www.crunchydata.com/pricing), read 2026-09-17) | Not found in searches; full AUP not independently opened |
| **Timescale / Tiger Cloud** | VPC peering + PrivateLink (AWS Transit Gateway variant) ([Tiger docs](https://docs.tigerdata.com/use-timescale/latest/security/vpc), read 2026-09-17); RLS/logical-replication specifics **not confirmed** in what I could read | Not independently verified beyond vendor marketing | Time-series/hypertable optimizations this workload doesn't need | Full core Postgres + PostGIS; renamed company (TigerData, June 2025) mid-pivot to AI/vector workloads, i.e. optimizing for a different use case than ours | Separate vendor, separate console | Medium | Performance tier from $30/mo, Scale from $36/mo ([g2/pricingsaas summary](https://pricingsaas.com/companies/timescale), read 2026-09-17) | Not found; not deeply checked — low priority given no workload fit |
| **PlanetScale for Postgres** | HA cluster (1 primary + 2 replicas) across AZs by default; specifics on CMK/PrivateLink not found in what I could read | Backups metered ($0.023/GB) — retention window not confirmed | NVMe-backed "Metal" tier; recently GA, still maturing | **RLS support is explicitly discouraged by PlanetScale itself** — their own blog argues against relying on it ([PlanetScale blog, "RLS sounds great until it isn't"](https://planetscale.com/blog/rls-sounds-great-until-it-isn%27t), read 2026-09-17); extension list appears curated (vectorscale, roaringbitmap called out specifically) rather than the full RDS/Aurora set — **PostGIS/pgcrypto/pg_trgm support not confirmed either way** | New product (GA in 2026), thin public operational track record | Unclear/new | $5–15/mo entry, metered storage/egress/backups on top ([costbench.com](https://costbench.com/software/database-as-service/planetscale/), read 2026-09-17) | Not evaluated — too many open verification gaps for a compliance-sensitive workload |
| **Self-managed on EC2** | Full control, full responsibility — every hardening item below becomes your own build, not a vendor's default | Your own pgBackRest/WAL-archiving setup; nothing free | Your own tuning, your own pooler (PgBouncer) | Full, unmodified upstream Postgres | **Ruled out**: no DBA on the team (per plan docs), and the estate's own history is "no automated backup," "one process," ad-hoc snapshots — adding self-managed HA/patching/backup engineering on top of that is negative return | N/A — you'd own the exit path, but at the cost of owning the entry path too | Roughly EC2 instance-hour + EBS, but real total cost of ownership including engineer time to build/maintain HA and backups is well documented as higher than it looks ([selfhost.dev](https://selfhost.dev/blog/aws-rds-vs-self-hosted-postgresql-cost-comparison/), read 2026-09-17: "self-hosted ~$332/mo infra but ~$832+/mo with engineering time included, vs ~$744/mo fully-managed RDS" — their own worked example, not independently re-derived here) | N/A |

---

## Per-vendor notes

### Amazon RDS for PostgreSQL — primary pick

- **Already built.** `data-stack.ts` creates `rds.DatabaseInstance` on Postgres 16.13, in
  `PRIVATE_ISOLATED` subnets, `publiclyAccessible: false`, storage encrypted with a dedicated KMS
  CMK, `backupRetention: Duration.days(35)` (which is also PITR window on RDS — any retention > 0
  gives point-in-time recovery for the whole window), `multiAz: config.isProd`, and single-user
  secret rotation every 30 days via the AWS-managed rotation Lambda. This is not a plan, it's
  already-written CDK.
- **pgAudit**: supported on all RDS Postgres versions via the `rds_pgaudit` role
  ([AWS docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.PostgreSQL.CommonDBATasks.pgaudit.html),
  read 2026-09-17).
- **IAM database authentication**: supported since 2018
  ([AWS what's-new](https://aws.amazon.com/about-aws/whats-new/2018/09/amazon-rds-postgresql-now-supports-iam-authentication),
  read 2026-09-17) — token-based, no long-lived DB passwords needed for app/service roles that
  can use it (note: IAM auth has its own connection-rate limits; not a replacement for the
  migration/admin role's Secrets-Manager-rotated password).
- **Logical replication**: supported as both source and target since PostgreSQL 10-class
  versions; suited for the MongoDB-strangler CDC period because you can subscribe to publications
  and keep it running without full-database downtime, though schema/DDL changes are not
  replicated automatically and need to be applied to the subscriber manually
  ([AWS docs](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.FeatureSupport.LogicalReplication.html),
  read 2026-09-17).
- **Connection pooling**: RDS Proxy is available as a managed pooler (per-writer/per-reader
  pooling, IAM-auth integration) as an alternative to running PgBouncer yourself
  ([AWS RDS Proxy discussion](https://repost.aws/questions/QUZqKvxX2RQVuxr1bxYxmzCg/rds-proxy-postgresql-max-connections),
  read 2026-09-17). Given `platform/src/db.ts` already pools via `pg.Pool` in-process, RDS Proxy
  is optional insurance against connection storms at evening peak, not a hard requirement day one.
- **Extensions**: pg_trgm, PostGIS, pgcrypto are all in RDS's supported-extensions list for
  Postgres 16 (standard AWS-maintained extension allowlist; the exact per-version list lives at
  AWS's own extensions page, which I could not scrape verbatim through the fetch tool today —
  flagged as a verification gap below, though these three specific extensions are long-standing
  RDS PostgreSQL staples and not in question).
- **Compliance**: RDS is one of the AWS services covered by AWS's SOC 1/2/3, ISO 27001, and PCI
  DSS attestations as part of AWS's overall compliance program (this is AWS's standing claim
  across the RDS service family; I did not re-verify a fresh SOC 2 report date for this document,
  which is itself normal — customers request the actual report under NDA via AWS Artifact rather
  than a public URL).
- **Pricing, illustrative** (see arithmetic section below) — sourced from a third-party pricing
  aggregator dated 2026-09-14 since AWS's own pricing pages did not render tabular rate data
  through the fetch tool today; treat as directional and verify with the AWS Pricing Calculator
  before budgeting ([bytebase dbcost](https://www.bytebase.com/dbcost/rds-pricing/), read
  2026-09-17).

### Aurora PostgreSQL (provisioned) — fallback

- Same security/VPC/KMS/IAM/pgAudit story as RDS — it's the same underlying compliance program
  and largely the same feature set, because Aurora Postgres is AWS's own fork with a
  redesigned storage layer, not a different vendor.
- **Meaningfully faster failover** than RDS Multi-AZ (Aurora's replicated storage layer typically
  fails over in under 30 seconds vs. RDS Multi-AZ's 60–120 seconds) and **backtrack** (rewind a
  cluster without a restore) — genuinely useful if a bad migration or bad batch write needs a fast
  undo. Not independently benchmarked here; this is Aurora's own stated design goal, consistent
  across multiple secondary sources reviewed 2026-09-17.
- **Cost is less predictable** than RDS because Aurora Standard storage bills **$0.20 per million
  I/O requests** on top of a $0.10/GB-month storage rate, vs. RDS's flat gp3 GB-month rate with no
  separate I/O metering ([usage.ai RDS vs Aurora](https://www.usage.ai/blogs/aws/reserved-instances/rds/rds-vs-aurora-cost/),
  read 2026-09-17). Aurora I/O-Optimized removes the per-request charge for a flatter but higher
  storage rate (~$0.225/GB-month) — worth revisiting only if a live Aurora bill shows I/O charges
  exceeding ~25% of spend.
- Migration path from RDS: snapshot-and-restore into an Aurora cluster, or a blue/green
  deployment — both are AWS-native, same VPC, same KMS key reusable, no new vendor relationship.
  This is why it's the fallback and not a third-place option: switching later costs a maintenance
  window, not a re-architecture.

### Aurora Serverless v2 — fallback for the reporting side only

- $0.12/ACU-hr (Aurora Standard) or $0.156/ACU-hr (I/O-Optimized); 1 ACU ≈ 2GB memory + proportional
  CPU/network; scales roughly 0–256+ ACU in seconds, and now supports true scale-to-zero on an
  idle timer ([usage.ai](https://www.usage.ai/blogs/aws/rds/aurora-serverless-v2/), read
  2026-09-17).
- Scale-to-zero is irrelevant for the OLTP writer (a multi-store POS is effectively always open
  somewhere), but could be a good fit for a **reporting replica or an ad-hoc analytics endpoint**
  that sits idle overnight and bursts during a report run — cheaper than sizing a fixed instance
  for a peak it hits twice a day.

### Aurora DSQL — ruled out for the OLTP core

- Missing: foreign keys, triggers, views, materialized views, stored procedures, PL/pgSQL,
  PostGIS, pgvector, pgcrypto; isolation is fixed at `REPEATABLE READ` (no `SERIALIZABLE`)
  ([AWS docs, unsupported features](https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility-unsupported-features.html);
  [devclass coverage](https://www.devclass.com/databases/2024/12/09/amazon-explains-absence-of-familiar-features-in-postgresql-compatible-aurora-dsql/1620084),
  both read 2026-09-17). The plan explicitly wants FK-backed typed core tables ("the 'duplicate
  line moves double' class of bug is impossible at the DB layer") and PostGIS for delivery zones
  (the D6 rationale in the platform plan, and the KML/geofencing work already live in Blaze
  region assignment) — DSQL cannot do either.
- Encryption at rest is solid (AES-256, optional CMK) and auth is IAM-token-only (no passwords),
  which is philosophically appealing, but it doesn't offset the missing relational integrity
  features for this specific schema.
- Interesting for a narrow future use (a globally-distributed, low-write-conflict subsystem with
  a simple schema) but not this database.

### Neon

- Real Postgres with a disaggregated storage layer (compute/storage split enables branching and
  scale-to-zero). Logical replication works both as source and target
  ([Neon docs](https://neon.com/docs/guides/logical-replication-guide), read 2026-09-17).
- AWS PrivateLink exists but is gated to Business/Enterprise tiers
  ([Neon blog](https://neon.com/blog/aws-privatelink-for-neon-databases), read 2026-09-17); SOC2
  Type 2 and HIPAA eligibility are gated to the Scale plan specifically, at $0.222/CU-hour, not
  the cheaper Launch tier (search-summarized from neon.com pricing coverage, read 2026-09-17 — I
  did not independently open neon.com/pricing directly to confirm the exact current tier
  boundaries; treat this as needing a final check before budgeting).
- Its headline feature — instant branching for dev/test — is genuinely useful for the
  strangler-migration differential-probe workflow already planned (byte-identical goldens/fixtures
  per ported module), but that's a **testing/staging** argument, not a reason to run production
  OLTP on it when AWS-native RDS is already free of that vendor relationship.
- Not chosen as fallback because it introduces a second cloud vendor, a second billing
  relationship, and a second support escalation path for no capability RDS/Aurora lack.

### Supabase

- Full Postgres core, but the product is bundled with Auth, Storage, and Realtime — none of which
  this project needs, since the TypeScript platform kit already owns its own auth (Google
  Workspace SSO/OIDC per the plan) and its own module system. Paying for and operating around an
  unused product surface is pure overhead here.
- Its Realtime feature runs on logical replication internally (wal2json-based)
  ([Supabase docs](https://supabase.com/docs/guides/platform/privatelink) and related, read
  2026-09-17) — if adopted, it would compete with any CDC consumer for replication slots, adding
  a coordination problem this project doesn't need to take on.
- PrivateLink and SOC2/ISO27001 are gated to the $599/month Team plan floor
  ([Supabase blog](https://supabase.com/blog/supabase-soc2-hipaa), read 2026-09-17) — that floor
  buys you compliance attestations you'd get for free as part of AWS's existing program under RDS.
- Not chosen.

### Crunchy Bridge

- The most complete "vendor Postgres" option evaluated: PrivateLink/VPC peering across AWS, GCP,
  Azure; pgAudit on by default; PostGIS supported; logical replication to external CDC consumers
  including Debezium confirmed by name ([Crunchy docs](https://docs.crunchybridge.com/how-to/logical-replication),
  read 2026-09-17); FedRAMP + SOC2 attestation claimed on their pricing page
  ([crunchydata.com/pricing](https://www.crunchydata.com/pricing), read 2026-09-17 — I did not
  independently verify the FedRAMP authorization level or sponsor agency).
- **The one real problem: Snowflake acquired Crunchy Data** (deal closed 2025), and "Snowflake
  Postgres" reached GA on 2026-02-24 as the strategic product going forward. No sunset of Crunchy
  Bridge has been announced and new signups are open as of this read, but outside analysts
  describe the long-term roadmap for the standalone product as "increasingly uncertain," oriented
  toward cloud consolidation into Snowflake's platform
  ([Cloud Wars](https://cloudwars.com/cloud/snowflake-to-acquire-crunchy-data-to-power-agentic-ai-with-postgresql-integration/),
  [layerbase](https://layerbase.com/blog/crunchy-bridge-alternative), both read 2026-09-17). For a
  multi-year production commitment, that's a real vendor-continuity risk that RDS/Aurora don't
  carry (AWS isn't going to sunset RDS).
- Would be the strongest **non-AWS-native fallback** if a future requirement specifically needed
  cross-cloud portability (GCP/Azure PrivateLink) or an explicit FedRAMP authorization RDS doesn't
  publish. Not needed today.

### Timescale / Tiger Cloud

- Renamed "TigerData" in June 2025, now pivoting toward AI/vector and time-series workloads
  ([Wikipedia TimescaleDB entry](https://en.wikipedia.org/wiki/TimescaleDB), read 2026-09-17) —
  optimizing for a different shape of problem than a multi-store POS's OLTP + audit-log workload.
  Hypertables/compression could be a genuine future win for the append-only audit tables
  specifically, but that's an optimization to revisit later, not a reason to host the whole
  database there.
- VPC peering and an AWS Transit Gateway-based PrivateLink variant exist
  ([Tiger docs](https://docs.tigerdata.com/use-timescale/latest/security/vpc), read 2026-09-17).
  I could not confirm RLS or bidirectional logical-replication specifics from what I was able to
  read — flagged as an open gap, not a claim either way.
- Not chosen; no workload-fit argument for it as the primary store.

### PlanetScale for Postgres

- Newest entrant (GA'd in 2026 after a private preview), architecturally distinct: a
  highly-available 3-node (1 primary + 2 replica) cluster by default, with an NVMe-backed "Metal"
  tier ([PlanetScale docs](https://planetscale.com/docs/postgres/postgres-architecture), read
  2026-09-17).
- **PlanetScale itself argues against relying on row-level security** in a blog post titled "RLS
  sounds great until it isn't"
  ([planetscale.com/blog/rls-sounds-great-until-it-isn't](https://planetscale.com/blog/rls-sounds-great-until-it-isn%27t),
  read 2026-09-17) — notable since the plan's D6 rationale specifically leans on RLS for
  entity/store scoping ("row-level security for entity and store scoping, so the IDOR class of
  bug stops being a per-route promise"). Extension support beyond a curated list (vectorscale,
  roaringbitmap called out by name in their changelog) is not confirmed for pg_trgm, PostGIS, or
  pgcrypto specifically.
- Given a compliance-sensitive workload with PII and cash/tax records, and a vendor that (a) is
  new enough to have a thin public operational track record and (b) publicly discourages the exact
  security mechanism this project's plan is built around, I did not pursue it further. Not chosen,
  not ruled in as a fallback.

### Self-managed on EC2 — ruled out

- Only worth doing if you need something RDS/Aurora can't give you (an unsupported extension,
  OS-level access, a custom deployment topology). Nothing in the requirements list — pgcrypto,
  pg_trgm, PostGIS, logical replication in and out — is unavailable on RDS. There is no capability
  gap to justify it.
- The estate's own documented history (no automated backup on the current Render/SQLite setup,
  ad-hoc snapshots, one shared write token, "no DBA") is itself the argument against taking on
  self-managed Postgres operations. A worked third-party comparison estimates self-hosted
  Postgres on EC2 at roughly $332/month in raw infrastructure but $832+/month once engineer time
  is priced in, against roughly $744/month for an equivalent fully-managed RDS instance
  ([selfhost.dev](https://selfhost.dev/blog/aws-rds-vs-self-hosted-postgresql-cost-comparison/),
  read 2026-09-17 — this is their worked example with their own assumptions, not independently
  re-derived here, but directionally consistent with every other source reviewed).

---

## Cost arithmetic — three sizes

**Caveat up front:** AWS's own pricing pages did not return tabular rate data through the fetch
tool used today (JS-rendered pricing tables). The per-instance figures below come from a
third-party aggregator dated 2026-09-14 ([bytebase dbcost](https://www.bytebase.com/dbcost/rds-pricing/),
read 2026-09-17) cross-checked against a second aggregator's numbers for internal consistency;
gp3 storage ($0.115/GB-month) and backup-storage-beyond-free-tier ($0.095/GB-month) come from a
third source ([usage.ai RDS pricing calculator guide](https://www.usage.ai/blogs/aws/reserved-instances/rds/pricing-calculator/),
read 2026-09-17). **Verify all of these against the AWS Pricing Calculator before budgeting** —
they are directional, not a quote.

Sizes below use the exact instance classes already chosen in `config.ts` for "today" (prod =
`db.m7g.large`), scaled up for 3x/10x.

| | Instance (Multi-AZ) | Instance cost/mo | Storage | Storage cost/mo | Total/mo (compute+storage) |
|---|---|---|---|---|---|
| **Today** (~10 stores, low-thousands orders/day) | `db.m7g.large`, 2 vCPU / 8GB, Multi-AZ | ~$123/mo single-AZ × 2 ≈ **$246** | 100GB gp3 (per `data-stack.ts` `allocatedStorage`) | 100 × $0.115 ≈ **$11.50** | **≈ $258/mo** |
| **3×** | `db.r6g.xlarge`, 4 vCPU / 32GB, Multi-AZ | ~$329/mo single-AZ × 2 ≈ **$658** | 300GB gp3 | 300 × $0.115 ≈ **$34.50** | **≈ $693/mo** |
| **10×** | `db.r6g.2xlarge`, 8 vCPU / 64GB, Multi-AZ, + 1 read replica for reporting | ~$656/mo single-AZ × 2 ≈ $1,312, + 1× `db.r6g.xlarge` replica ≈ $329 | 1,000GB gp3 | 1,000 × $0.115 ≈ **$115** | **≈ $1,756/mo** |

Backup storage stays free at every size shown here because the 35-day-retention free allowance
equals 100% of provisioned storage (per AWS's stated backup-storage policy — see the usage.ai
source above) and none of these sizes' backup footprint should exceed that 1:1 allowance under
normal churn; re-check this once real backup-set size is known post-migration.

**Aurora provisioned**, same instance classes, would look similar on the compute line (Aurora
instance-hour pricing is close to RDS's) but adds **$0.20 per million I/O requests** on top of a
**$0.10/GB-month** storage rate instead of RDS's flat gp3 rate
([usage.ai](https://www.usage.ai/blogs/aws/reserved-instances/rds/rds-vs-aurora-cost/), read
2026-09-17) — the I/O line item is workload-dependent and I did not attempt to estimate query
volume precisely enough to price it; this is exactly the "less predictable" cost shape called out
in the comparison table, and one more reason RDS is the calmer choice for a team that wants to
forecast a budget line without instrumenting query-per-second first.

---

## Cannabis-industry acceptable-use risk

- **AWS**: no mention of cannabis, marijuana, or controlled substances anywhere in the
  Acceptable Use Policy text I retrieved ([aws.amazon.com/aup/](https://aws.amazon.com/aup/), read
  2026-09-17). Prohibitions are illegal/fraudulent activity generically, rights violations,
  violence/terrorism, child exploitation, security violations, and spam. **Note the distinction**:
  Amazon Pay's own AUP does prohibit cannabis/CBD payment processing (search-summarized, read
  2026-09-17) — that is a different Amazon business unit (payments) with different regulatory
  exposure than AWS infrastructure hosting, and should not be conflated with AWS itself.
- **Existence proof**: Dutchie, a cannabis POS/retail platform, is publicly described as running
  production workloads on AWS RDS at scale (search-summarized claim from Dutchie's own public
  materials, read 2026-09-17 — I was not able to open a dedicated, independently-hosted AWS case
  study page confirming this from AWS's side specifically; treat the "$100B in transactions"
  figure as Dutchie's own claim).
- **Neon, Supabase, Crunchy Bridge, Tiger Cloud, PlanetScale**: none of these vendors' AUPs
  surfaced any cannabis-specific clause in searches conducted 2026-09-17. I was **not able to
  fully open and read each AUP document end-to-end** in this session (several resolved to
  marketing/summary pages rather than the raw legal text) — this is a genuine verification gap,
  not a clean bill of health. If any of these vendors is later chosen for anything (e.g., Neon for
  a dev/branching workflow), read that vendor's actual AUP text directly before signing up, per
  the hard rule against creating any account in this task.
- **Net finding**: no AUP risk identified for the AWS-native path (RDS/Aurora), which is also the
  path already decided and already built. No reason found to avoid AWS on cannabis-specific
  grounds.

---

## Security hardening checklist — for RDS Postgres Multi-AZ

Concrete, in addition to what `data-stack.ts` already does:

- [ ] **Parameter group**: create a custom DB parameter group (don't use the default) with
      `rds.pgaudit.log = 'ddl, role, write'` (start narrower than `'all'` to control log volume;
      widen if an audit finding demands it), `log_connections = 1`, `log_disconnections = 1`,
      `log_lock_waits = 1`, `log_min_duration_statement` set to a sane threshold for slow-query
      visibility (not 0 — that logs every statement including PII-bearing ones into CloudWatch).
- [ ] **pgAudit**: install the extension (`CREATE EXTENSION pgaudit`), grant `rds_pgaudit` to the
      role that needs to configure it, and route pgAudit output to CloudWatch Logs
      (`cloudwatchLogsExports: ['postgresql', 'upgrade']` is already set in `data-stack.ts` — the
      first entry captures pgAudit output once the extension is enabled).
- [ ] **Forced TLS**: set `rds.force_ssl = 1` in the parameter group so no client can connect
      without TLS, and pin the app's `pg` client to `sslmode=verify-full` against the RDS CA
      bundle, not `require` (which doesn't validate the certificate).
- [ ] **IAM database authentication**: enable `iam_database_authentication_enabled` on the
      instance and issue the `rds_iam` role to service accounts that support token auth (the
      migration/admin role and anything using the long-lived Secrets-Manager-rotated password
      should stay as-is; IAM auth is best suited to short-lived service connections, not the
      pooled application connection that `platform/src/db.ts`'s `pg.Pool` already holds open).
- [ ] **KMS CMK**: already done (`this.dataKey` in `data-stack.ts`) — confirm the key policy
      restricts `kms:Decrypt` to the specific task role(s) that need it, not `*` within the
      account, and that key rotation (`enableKeyRotation: true`, already set) stays on.
- [ ] **No public endpoint**: already done (`publiclyAccessible: false`, `PRIVATE_ISOLATED`
      subnets) — keep it that way; any future "just for debugging" public access request should
      go through a bastion/SSM Session Manager tunnel, not a security-group opening to 0.0.0.0/0.
- [ ] **Least-privilege roles per service**: don't let every module connect as `hwadmin`. Create
      one Postgres role per owning module (matching the "one schema per module" rule already in
      `POSTGRES-MIGRATION.md`), grant it only its own schema, and keep `hwadmin` for
      migrations/DDL only.
- [ ] **Separate migration role**: a distinct role (not the app's runtime role, not `hwadmin`)
      that can run `CREATE SCHEMA`/`ALTER TABLE`/DDL, used only by the migration tool/CI job, never
      held by the always-on application connection pool.
- [ ] **Row-level security where it earns its keep**: per the plan's own D6 rationale, RLS on
      tables scoped by entity/store (the IDOR-prevention use case) — but only where a policy is
      simpler than the equivalent `WHERE` clause discipline already enforced by the module loader;
      RLS adds a real debugging cost (a silently-filtered row looks like a missing row), so scope
      it to the tables where the blast radius of a missed `WHERE` clause is worst — cash/tax
      records and PII-bearing tables first.
- [ ] **PII columns**: confirm SSNs stay app-side encrypted (already the stated approach) rather
      than relying on `pgcrypto` alone for at-rest protection of that specific column — pgcrypto
      is fine for reversible field-level encryption where the app needs to decrypt, but the key
      management for that should live in the same Secrets Manager/KMS chain already built, not a
      hardcoded key.
- [ ] **Backup export you own**: `data-stack.ts` already provisions a KMS-encrypted, versioned,
      `BLOCK_ALL`-public-access S3 bucket for backups, with Object Lock in prod — confirm the
      application side (`tools/db_backup.py`'s eventual Postgres equivalent) actually writes there
      on a schedule, and that a restore has been drilled at least once before go-live (the plan's
      own Phase 1 exit proof already requires this).
- [ ] **Automated minor-version patching, manual major-version upgrades**:
      `autoMinorVersionUpgrade: true` is already set; major-version upgrades (16→17, etc.) should
      stay a deliberate, tested, scheduled event — never auto-applied.

---

## Does anything here reopen D6?

**No — plainly.** D6 chose Postgres over Mongo, and separately named RDS Multi-AZ as the specific
implementation, and both hold up under this research:

- Postgres-vs-Mongo was never in question in this document's scope, and nothing found here
  touches that comparison.
- Of the nine options compared, only two (Aurora provisioned and Aurora Serverless v2) are
  genuinely competitive alternatives to RDS for the OLTP core, and both are same-family,
  same-engine, same-VPC options that the existing CDK can migrate to later without a rewrite —
  this is a refinement inside D6, not a reversal of it.
- Aurora DSQL is disqualified outright by missing relational-integrity and extension features the
  schema needs.
- Every SaaS Postgres vendor evaluated (Neon, Supabase, Crunchy Bridge, Tiger Cloud, PlanetScale)
  would trade an already-built, already-integrated, zero-additional-vendor AWS-native setup for a
  second vendor relationship, for no capability this workload is missing. Crunchy Bridge is the
  strongest of these and even it carries fresh acquisition-related continuity risk.
- Self-managed EC2 is ruled out on operational-capacity grounds specific to this team, not on
  Postgres capability grounds.

**Recommendation stands: keep building on RDS Postgres Multi-AZ exactly as `data-stack.ts`
already has it.** Revisit only under the specific trigger conditions named in the one-page summary
above.

---

## Verification gaps (stated explicitly, per the task's hard rule)

- Exact current AWS RDS/Aurora on-demand hourly rates: not scraped verbatim from
  `aws.amazon.com` (JS-rendered pricing tables did not return tabular data to the fetch tool used
  today); relied on third-party aggregators dated 2026-09-14, cross-checked for internal
  consistency but **not** independently confirmed against AWS's authoritative rate card. Verify
  via the AWS Pricing Calculator before finalizing a budget.
- RDS's own SOC 2 report date/scope and PCI DSS attestation level for this specific service: not
  independently re-pulled from AWS Artifact in this session (that requires an authenticated AWS
  console session, out of scope for a research task that must not sign up for or log into
  anything).
- Full raw AUP legal text for Neon, Supabase, Crunchy Bridge, Tiger Cloud, and PlanetScale: not
  opened end-to-end in this session; searches surfaced summaries and marketing pages, not the
  full legal documents, for several of these. No cannabis-specific clause surfaced in any summary
  reviewed, but this is not the same as having read each document in full.
- PlanetScale for Postgres's underlying storage engine (whether it is upstream Postgres or a
  compatibility-layer fork) and its exact extension allowlist: not conclusively established from
  public sources read today.
- Tiger Cloud's row-level-security and bidirectional-logical-replication support specifics: not
  confirmed from what was accessible today.
- The Dutchie-on-AWS-RDS claim comes from search-summarized secondary sources describing Dutchie's
  own public materials, not a document independently opened and confirmed by this research pass.
