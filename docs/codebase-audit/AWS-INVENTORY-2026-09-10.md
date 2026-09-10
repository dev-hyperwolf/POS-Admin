# AWS inventory — account HyperWolf (913839484704), read 2026-09-10

Read-only, from the console and CloudShell as the root user, nothing changed. This is A1 step 1
of `OPERATING-PLAN-2026-09-10.md`. Everything lives in **us-east-1**; the other regions hold no
instances.

## IAM users (9)

| User | Permissions | Console | MFA | Access key | Last activity | Note |
|---|---|---|---|---|---|---|
| techindustan-hw | **AdministratorAccess** | yes | yes (2) | none | 2 days ago | the contractor's admin login |
| dev_access | **AdministratorAccess** | yes | **no** | none | 157 days ago | stale admin, no MFA — disable after A2 |
| backend | IoT, CloudWatch, DynamoDB, S3, Lambda full; inline `sts_full_access` | yes | yes | key **758 days old**, used 2 days ago | 2 days ago | an app credential used from a server; rotate in A6 |
| hyperwolf-s3-backups-prod | inline backups-bucket-access | no | — | key 462 days old, used 10 h ago | 10 h ago | the backup job's key (good: backups run) |
| hyperwolf-new-s3-bucket-access | AmazonS3FullAccess + inline website/stilo assets | no | — | key 129 days old, used 16 min ago | 16 min ago | storefront uploads |
| grafana-cloudwatch-readonly | (read-only) | no | — | key 14 days old, used 2 days ago | 2 days ago | someone set up Grafana two weeks ago |
| hyperwolf_s3_access | — | no | — | none | never | dead |
| ShortURLService | — | no | — | none | never | dead |
| Customer.Support | — | disabled | — | none | 940 days ago | dead |

No custom role carries AdministratorAccess. Identity Center is enabled (users not listed here).

## EC2 instances (14, all us-east-1)

| Name | State | Type | Public IP | Launched | Role |
|---|---|---|---|---|---|
| hyperwolf-main-backend-asg (×2) | running | c7a.large | 18.207.117.115, 44.200.56.178 | 2026-09-04 | **production API** behind the ALB; autoscaling group min 2 / desired 2 / max 6, template `hyperwolf-main-backend-production-template` |
| hyperwolf-backend-apps-production | running | c7a.xlarge | 34.236.60.155 | 2026-08-18 | production, other backends (which ones: A2) |
| hyperwolf-main-backend-production-template | running | c7a.large | 13.220.1.36 | 2026-09-04 | the template instance for the ASG |
| hyperwolf-frontend-apps-production | running | c7a.xlarge | 52.205.184.224 | 2026-08-18 | production storefronts / admin webs |
| hyperwolf-mongodb-production | running | m7a.large | 44.201.10.134 | 2026-08-13 | **the production database, self-hosted on EC2** (no RDS, no DocumentDB) |
| stilo-production | running | t3a.xlarge | 34.234.145.102 | 2025-12-05 | Stilo production (app and probably DB) |
| hyperwolf-hemp-stage | running | t3.large | 54.81.94.241 | 2026-02-02 | stage; matches the deploy map |
| hyperwolf-stage | stopped | t3.medium | 18.235.246.3 | 2026-06-08 | stage; matches the deploy map; stopped |
| hyperwolf-production (old) | stopped | c5a.xlarge | — | 2026-08-19 | replaced 2026-08-18/09-04 |
| hyperwolf-hemp-production (old) | stopped | t3a.xlarge | — | 2026-08-19 | replaced |
| Hyperdrive-production | stopped | t3a.medium | 52.206.19.59 | 2025-06-13 | stopped — where does hyperdrive run now? (A2) |
| stilo-prod-mongodb | stopped | t3a.medium | — | 2025-06-20 | stopped — Stilo's DB moved (A2) |
| hyperwolf-APP | stopped | t2.small | 54.81.147.110 | 2023-07-07 | old |

What this says: the developers re-platformed production between 13 August and 4 September 2026
(new Mongo host, new backend/frontend hosts, an autoscaling group with a load balancer). None of
it is in any repo. Deploys to the ASG must go through the launch template or a script on the
template instance; that is the deploy line A2 must produce.

## Other services

- **Load balancer**: `hyperwolf-main-backend-alb` (one ALB) in front of the ASG.
- **Database**: no RDS, no DocumentDB. MongoDB runs on `hyperwolf-mongodb-production`; backups go
  to `hyperwolf-s3-backups-prod` (the key was used 10 h ago). Ownership question A3 is therefore
  about this EC2 box and the backup bucket, not about Atlas — the owner already owns both.
- **Lambda**: `onFleetTaskLoads`, `exportOnfleetData`, `hyperwolf_upgrade_instance`,
  `hyperwolf_downgrade_instance` (instance resizing on a schedule?). No CodeDeploy, no
  CodePipeline, no ECR.
- **Route 53**: 25 hosted zones (hyperwolf.com/.io/.org/.us/.pro/.mx/.co/.info/.media/.biz/
  .delivery/.online/.tech/.ca/.stream/.studio, hyperwolves.com, hyperwolfdelivery.com,
  hyperwolfcannabis.com, hyperwolf-cannabis.com, orderhyperwolf.com, tryhyperwolf.com, hyw.app…).
- **S3**: hyperwolf-website-assets, hemp-website-assets, stilo-assets, hyperdrives3bucket,
  hyperdriver-signatures, hyperwolf-s3-backups-prod, hyperwolf-alpineiq-apis-data,
  hyperwolf-blazeai-apis-data, hyperwolf-lambda-dev, aws-glue-assets, two sagemaker buckets,
  shorturl-service deployment bucket, surfside-dataset-inbound.
- **Monitoring**: a `grafana-cloudwatch-readonly` key created 14 days ago — someone has started
  wiring Grafana to CloudWatch. Ask who and where the dashboard is.

## Cost, 1–10 September (unblended)

| Service | USD |
|---|---|
| EC2 compute | 200.94 |
| EC2 other (EBS, transfer) | 102.18 |
| VPC | 15.81 |
| Route 53 | 11.18 |
| Load balancing | 8.36 |
| S3 | 2.60 |
| IoT, Glue, Secrets Manager, API Gateway, DynamoDB, Lambda | < 1.20 each |

About $340 for ten days, roughly $1,000 a month.

## What to do with this (owner)

1. **Now, safe**: MFA on root; your own admin IAM user with MFA; billing alert.
2. **After A2 is written**: disable `dev_access` (admin, no MFA, idle five months); delete the
   three dead users; rotate the `backend` key (758 days) and the backups key (462 days).
3. **A2 for the developers is now specific**: how code reaches the ASG (launch template AMI or a
   pull on the template instance?), what runs on `backend-apps-production` and
   `frontend-apps-production`, where Hyperdrive and Stilo's DB run today, and who set up Grafana.
4. **Shell access (A1 step 3)**: try Session Manager on the running boxes first; the ASG
   instances are disposable, so key replacement there is a template edit, not a rescue volume.
