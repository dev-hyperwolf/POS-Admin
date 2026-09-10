# Deployment Map — 12 Hyper-Tech Repos

## 1. Deploy Triggers & Mechanisms

| Repo | Branch / Trigger | Mechanism | Host/Target | Secrets Named | Evidence |
|------|---|---|---|---|---|
| distribution-backend | `development` push | docker compose up --build on self-hosted | /var/www/html/node-js/distribution-backend | none | .github/workflows/dev.yml:14-24 |
| hemp-backend | Security workflow success | appleboy/ssh-action; npm i; pm2 restart | api.direct.stage.hyperwolf.com | USERNAME, STAGE_SSH_KEY | .github/workflows/node.js.yml:11-20 |
| hemp-frontend-nextjs | `new-ui-design-development` push | appleboy/ssh-action; npm restart | thcs.in | USERNAME, PASSWORD | .github/workflows/node.js.yml:9-18 |
| hemp-retailer-admin (dev) | Security workflow success | appleboy/ssh-action; npm i; npm run build | thcs.in | USERNAME, PASSWORD | .github/workflows/dev.yml:13-23 |
| hemp-retailer-admin (stage) | Security workflow success | appleboy/ssh-action; npm i; npm run build from fullfillment-task-dev | 54.81.94.241 | STAGE_SSH_KEY | .github/workflows/stage.yml:12-22 |
| hyperdrive-backend | `development` push | appleboy/ssh-action; npm i; pm2 restart both processes | thcs.in | USERNAME, PASSWORD | .github/workflows/dev.yml:13-23 |
| hyperwolf-backend (node) | `hyperdrive-fleet` push | appleboy/ssh-action; npm i; pm2 restart | thcs.in | USERNAME, PASSWORD | .github/workflows/node.js.yml:11-21 |
| hyperwolf-backend (stage) | `feature-schedule-dynamic` push | appleboy/ssh-action; pm2 restart from /home/ubuntu/ | 18.235.246.3 | STAGE_SSH_RROT_KEY | .github/workflows/stage.yml:12-22 |
| hyperwolf-frontend-nextjs | `bug/delivery-slot` push | self-hosted runner (commented out, inactive) | not found | none | .github/workflows/deployment.yml:16-30 (commented) |
| hyperwolf-super-admin | Security workflow success | appleboy/ssh-action; npm i; npm run build | 54.81.94.241 | STAGE_SSH_KEY | .github/workflows/stage.yml:12-22 |
| promotion-backend | `feat/admin_promo` push | self-hosted; git pull; pm2 restart | /var/www/html/node-js/promotion-backend/ | none | .github/workflows/dev.yml:17-26 |
| promotion-engine | `free-product-and-calculation` push | self-hosted; git pull; pm2 restart | /var/www/html/node-js/promotion-engine/ | none | .github/workflows/dev.yml:17-26 |
| stilo-backend | `development` push (gated on Security success) | appleboy/ssh-action; npm i; pm2 restart | api.stage.stilosupply.com | USERNAME, STAGE_SSH_KEY | .github/workflows/stage.yml:14-24 |
| stilo-frontend-nextjs | `development` push | appleboy/ssh-action; npm i; npm run prod | thcs.in | USERNAME, PASSWORD | .github/workflows/dev.yml:12-22 |

**Observations:**
- No production workflows found (only dev/stage branches active).
- Hosts are hardcoded in workflows (no secret-based targets).
- Self-hosted runners (3 repos): no visible host address.
- thcs.in appears 4x (shared host likely); 54.81.94.241 appears 2x.
- AWS IP (18.235.246.3) used once (hyperwolf-backend stage).

---

## 2. External Services & Dependencies

| Service | Repos Using | Evidence | Owner Needs |
|---|---|---|---|
| **MongoDB** (self-hosted or Atlas) | all 12 repos | .env.example DATABASE_URL in each; conn1/2/3 patterns in distribution-backend, hyperwolf-backend, promotion-backend | Connection strings, backup/recovery access, admin credentials, URI audit for exposed passwords in logs |
| **Blaze POS/Retail API** | distribution-backend, hyperdrive-backend, hyperwolf-backend | BLAZE_BASE_URL, BLAZE_RETAIL_BASE_URL, BLAZE_API_KEY, BLAZE_API_KEY_TOKEN, BLAZE_RETAIL_AUTH_EMAIL/PASSWORD in .env.example; `common/util.js` calls | API key rotation, partner account access, webhook validation |
| **Firebase (FCM + Analytics)** | hyperdrive-backend, hemp-retailer-admin, hyperwolf-super-admin | firebaseAdmin.js, firebase-messaging-sw.js, Cloud Messaging listeners; hyperdrive-firebase-adminsdk.json (not in repo) | Service account JSON key (out-of-band provisioning), FCM topic access, Analytics property ID |
| **AWS S3** | distribution-backend, hyperdrive-backend, hemp-retailer-admin, hyperwolf-frontend-nextjs, stilo-backend, stilo-frontend-nextjs | AWS_ACCESS_KEY, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, S3 URLs hardcoded 4x in hemp-frontend, multer-s3 uploads | Access key rotation, bucket policy audit, public-read ACL review, cross-account access setup |
| **Google Maps / Places / Street View** | hyperdrive-backend, hyperwolf-super-admin, stilo-frontend-nextjs | GOOGLE_PLACES_KEY, GOOGLE_ANALYTICS_MANAGE_KEY, GOOGLE_ANALYTICS_KEY, Street View photos in driverAssignment | API key rotation, billing account, usage quotas |
| **Persona (Identity Verification)** | hemp-retailer-admin, stilo-frontend-nextjs | NEXT_PUBLIC_PERSONA_TEMPLATE_ID, NEXT_PUBLIC_PERSONA_ENVIRONMENT_ID in .env.example | Admin access, API key management, KYC flow setup |
| **Sentry** | hemp-backend, hyperwolf-backend, hyperwolf-super-admin (declared but some unused) | SENTRY_DSN, @sentry/* packages in some; hyperwolf-frontend-nextjs declares but never imports | DSN setup, project access, alert rules, error budget |
| **SendGrid** | distribution-backend, hemp-backend | common/sendGridFunction.js, SENDGRID env in .env.example (not always present) | API key management, email template access, bounce/compliance tracking |
| **HERE Maps** | hyperdrive-backend | driverAssignment/assignment/hereMapsLogic.js, HEREMAPS env referenced | API key, routing API quota, map hosting setup |
| **AWS DynamoDB** | hyperdrive-backend | @aws-sdk/client-dynamodb, FLEET_TABLE for live location history, IoT Core MQTT | Table access, read/write provisioning, backup/restore, stream configuration |
| **AWS IoT Core** | hyperdrive-backend | awsEvent/iotCore.js as separate PM2 process, hardcoded device-cert ID | MQTT endpoint, certificate/key provisioning (out-of-band), topic subscriptions |
| **Klaviyo** | hyperdrive-backend | password-reset profile creation, marketing profile; `common/util.js` integration | API key, list management, custom properties |
| **TextVolt** | hyperdrive-backend | delivery-failure SMS; `common/utils.js` integration | API credentials, phone number validation |
| **Reviews.io** | promotion-backend | REVIEWS_IO_APIKEY, REVIEWS_IO_STORE, REVIEWS_IO_URL; promotions sync | API key, store account access, sync frequency tuning |
| **Sequelize + MySQL** | stilo-backend | sequelize ^6.37.5 in package.json, second DB connection (details not in .env.example grep) | MySQL connection string, DB schema migration path |

---

## 3. Unknown / Not Found

- **Self-hosted runner hostnames**: distribution-backend, promotion-backend, promotion-engine use `self-hosted` label but no IP/hostname visible in workflows.
- **Stilo production deploys**: no production CI workflow found; only stage and security workflows.
- **Hyperwolf-frontend-nextjs prod**: deployment workflow present but entirely commented out (target host, NVM path, branch unknown).
- **Environment-specific S3 buckets**: hardcoded in some repos; whether dev/stage/prod use separate buckets is not determinable from workflow config alone.
- **MongoDB Atlas cluster names**: connection strings embedded in secrets, not visible in workflows.
- **Blaze webhook endpoints**: inbound webhook receiver not identified in workflows (likely part of backend listener code).

---

## Summary

**Active Deploy Hosts:** 4 unique (thcs.in, api.direct.stage.hyperwolf.com, api.stage.stilosupply.com, 54.81.94.241, 18.235.246.3)  
**External Services:** 14 distinct (MongoDB, Blaze, Firebase, AWS [S3, DynamoDB, IoT Core], Google Maps, Persona, Sentry, SendGrid, HERE, Klaviyo, TextVolt, Reviews.io, Sequelize)  
**SSH-based Deploys:** 10/12 (2 self-hosted)  
**PM2 Restarts:** 7 repos | **Docker:** 1 repo | **npm build:** 3 repos  
**Table 1 rows:** 14 | **Table 2 rows:** 14 | **Unknown items:** 5
