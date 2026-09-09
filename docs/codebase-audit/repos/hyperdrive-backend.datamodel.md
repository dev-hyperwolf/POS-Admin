# hyperdrive-backend — Data Model Appendix

Repo: `/Users/jt/hyper-tech/hyperdrive-backend` @ `afa975b`. Source: `models/*.js` (28 files, read in full). All schemas use Mongoose; none pass `{timestamps: true}` — every model hand-rolls `createdDate`/`updatedDate` (or, in a few cases, no date fields at all). See the main report (`hyperdrive-backend.md`) §5 for the summary and cross-cutting analysis; this file is the full per-field detail.

---

## ActivityLogs
*File: `models/ActivityLogs.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| source | String | No | `''` | — | — |
| updatedBy | String | No | `''` | — (plain string, not an ObjectId ref) | — |
| newChanges | Mixed | No | — | — | — |
| previousChanges | Mixed | No | — | — | — |
| createdDate | Number | No | — (must be set by app code) | — | — |

- Indexes: none declared.
- Timestamps: no `timestamps:true`; `createdDate` is a bare `Number` with no default.
- Soft-delete: none.
- Money: none. No multi-tenancy key — a generic admin-side change-audit log, not scoped to a fleet or store.

---

## Admin
*File: `models/Admin.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| name | String | No | — | — | — |
| email | String | No | — | — | — |
| password | String | No | — | — | — |
| createdDate | Number | No | — | — | — |
| lastLogin | Number | No | — | — | — |
| isSuperAdmin | Boolean | No | `false` | — | — |

- Indexes: none declared (no unique index on `email`, despite it being the presumed login key).
- Timestamps: none; `createdDate`/`lastLogin` are raw Numbers, no defaults.
- Soft-delete: none.
- Money: none. No multi-tenancy key — Admin is estate-global, referenced (`ref: 'Admin'`) from more other models than any other collection. **`isSuperAdmin` is set but never read/enforced anywhere in the repo** (see main report §6/§14).

---

## Announcements
*File: `models/Announcements.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| announcement | String | No | — | — | — |
| createdBy | ObjectId | No | — | Admin | — |
| updatedBy | ObjectId | No | — | Admin | — |
| deletedBy | ObjectId | No | — | Admin | — |
| isActive | Boolean | No | `true` | — | — |
| createdDate | Date | No | `Date.now` | — | — |
| updatedDate | Date | No | `Date.now` | — | — |
| deletedAt | Date | No | — | — | — |

- Indexes: `{ isActive: 1 }`.
- Timestamps: manual `createdDate`/`updatedDate` (Date, defaulted).
- Soft-delete: `isActive` + `deletedAt` + `deletedBy` — convention #1 of at least four soft-delete conventions in this codebase.
- Money: none. No multi-tenancy key (global announcements); referenced from `Tasks.companyAnnoucementIds[]`.

---

## ApprovalNotifications
*File: `models/ApprovalNotifications.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| fleetId | ObjectId | No | — | Fleets | — |
| notificationObject | Object | No | — | — | — |
| notificationStatus | String | No | `'pending'` | — | pending, declined, approved |
| notificationType | String | No | — | — | — |
| notificationMessage | String | No | — | — | — |
| isAdminSpecific | Boolean | No | `false` | — | — |
| adminIds | [ObjectId] | No | — | Admin | — |
| updatedBy | ObjectId | No | — | Admin | — |
| createdDate | Date | No | `Date.now` | — | — |
| updatedDate | Date | No | `Date.now` | — | — |

- Indexes: `{fleetId:1}`, `{isAdminSpecific:1}`, `{notificationType:1}`, `{adminIds:1}` — four separate single-field indexes.
- Timestamps: manual Date fields.
- Soft-delete: none.
- Money: none. Multi-tenancy: `fleetId`.

---

## Break
*File: `models/Breaks.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| breakName | String | No (unique) | — | — | — |
| timezone | String | No | — | — | — |
| fromTime | String | No (unique) | — | — | — |
| toTime | String | No | — | — | — |
| duration | Number | No | — | — | — |
| sendBreakAt | String | No | — | — | — |
| status | String | No | `'active'` | — | inactive, active |
| createdBy | ObjectId | No | — | Admin | — |
| createdDate | Date | No | `Date.now` | — | — |
| updatedDate | Date | No | `Date.now` | — | — |

- Indexes: no explicit `.index()` calls, but `breakName`/`fromTime` field-level `unique:true` each create an implicit unique index (matches mechanical scan's "2 idx" via field-level `unique`, not `schema.index()`).
- Timestamps: manual.
- Soft-delete: none (`status` is an activation toggle, not a delete flag).
- Money: none. No multi-tenancy key — global break-type catalog, referenced by `FleetBreakLog.breakId` and `Tasks.breakId`.

---

## closeOut
*File: `models/Closeout.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| title | String | No | — | — | — |
| type | String | No | — | — | text, checkbox, photo, qr, number, prefix, boolean |
| createdBy | ObjectId | No | — | Admin | — |
| isActive | Boolean | No | `true` | — | — |
| isButton | Boolean | No | `true` | — | — |
| isPrefix | Boolean | No | `true` | — | — |
| isOptional | Boolean | No | `false` | — | — |
| isRequired | Boolean | No | `false` | — | — |
| keyboardType | String | No | — | — | — |
| createdDate | Date | No | `Date.now` | — | — |
| updatedDate | Date | No | `Date.now` | — | — |

- Indexes: `{ title: 1 }`.
- Timestamps: manual.
- Soft-delete: `isActive` only (no `deletedAt`).
- Money: none. No multi-tenancy — a checklist-field **template**, referenced per-answer by `FleetOffDutyCloseout.closeoutData.closeoutId`. See Relationships & Overlaps for the closeout-family duplication analysis.

---

## FailureReason
*File: `models/FailureReason.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| reason | String | No | — | — | — |
| createdBy | ObjectId | No | — | Admin | — |
| updatedBy | ObjectId | No | — | Admin | — |
| deletedBy | ObjectId | No | — | Admin | — |
| isActive | Boolean | No | `true` | — | — |
| createdDate | Date | No | `Date.now` | — | — |
| updatedDate | Date | No | `Date.now` | — | — |
| deletedAt | Date | No | — | — | — |

- Indexes: none declared.
- Timestamps: manual.
- Soft-delete: `isActive` + `deletedAt` + `deletedBy` (same convention as Announcements).
- Money: none. No multi-tenancy — global lookup, referenced by `Tasks.failureDetails.failureReasonId`.

---

## fleetAccessTokens
*File: `models/FleetAccessTokens.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| fleetId | ObjectId | No | — | Fleets | — |
| accessToken | String | No | — | — | — |
| isActive | Boolean | No | `true` | — | true, false |
| createdDate | Date | No | `Date.now` | — | — |
| updatedDate | Date | No | `Date.now` | — | — |

- Indexes: `{fleetId:1}`, `{accessToken:1}`.
- Timestamps: manual.
- Soft-delete: `isActive` toggle only.
- Money: none. Multi-tenancy: `fleetId`. File also exports `generateAccessToken()` — the **only `jwt.sign` call site in the entire repo**, 2-day expiry (line 21).

---

## fleetActivityLogs
*File: `models/FleetActivityLogs.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| fleetId | ObjectId | No | — | Fleets | — |
| sessionStartTime | Date | No | — | — | — |
| sessionEndTime | Date | No | — | — | — |
| sessionStatus | String | No | `'pending'` | — | pending, completed |
| sessionDuration | Number | No | `0` | — | — |
| isActive | Boolean | No | `true` | — | true, false |
| createdDate | Date | No | `Date.now` | — | — |
| updatedDate | Date | No | `Date.now` | — | — |

- Indexes: `{fleetId:1}`, `{sessionStartTime:1}`, `{sessionEndTime:1}`, `{sessionDuration:1}` — four separate single-field indexes (no compound), unusual since these fields are almost certainly always queried together (a fleet's sessions in a time range).
- Timestamps: manual.
- Soft-delete: none.
- Money: none. Multi-tenancy: `fleetId`. A duty-session clock-in/out log, not a generic activity log despite the name overlap with `ActivityLogs`.

---

## FleetBreakLog
*File: `models/FleetBreakLogs.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| fleetId | ObjectId | **Yes** | — | Fleets | — |
| breakId | ObjectId | **Yes** | — | Break | — |
| plannedStartTime | Date | No | — | — | — |
| plannedEndTime | Date | No | — | — | — |
| actualStartTime | Date | No | — | — | — |
| actualEndTime | Date | No | — | — | — |
| date | Date | No | — | — | — |
| utcActualStartTime | Date | No | — | — | — |
| utcActualEndTime | Date | No | — | — | — |
| createdDate | Date | No | `Date.now` | — | — |
| updatedDate | Date | No | `Date.now` | — | — |

- Indexes: one compound `{fleetId:1, breakId:1, date:1, utcActualStartTime:1, utcActualEndTime:1}`.
- Timestamps: manual.
- Soft-delete: none.
- Money: none. Multi-tenancy: `fleetId`. Also exports `breakLogCreateValidation` Joi middleware.

---

## FleetCloseout
*File: `models/FleetCloseout.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| closeoutObject | Object (untyped) | No | — | — | — |
| fleetId | ObjectId | No | — | Fleets | — |
| createdDate | Date | No | `Date.now` | — | — |
| updatedDate | Date | No | `Date.now` | — | — |

- Indexes: none.
- Timestamps: manual.
- Soft-delete: none.
- Money: **`closeoutObject` is where cash-count/credit-card-total closeout data actually lands (see Relationships & Overlaps) — completely untyped (`Object`), no schema enforcement on any dollar amount.** Multi-tenancy: `fleetId`.

---

## fleetDevices
*File: `models/FleetDevices.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| fleetId | ObjectId | No | — | Fleets | — |
| fcmToken | String | No | — | — | — |
| deviceType | String | No | — | — | android, ios |
| isActive | Boolean | No | `true` | — | true, false |
| appVersion | String | No | — | — | — |
| createdDate | Date | No | `Date.now` | — | — |
| updatedDate | Date | No | `Date.now` | — | — |

- Indexes: `{fleetId:1}`, `{fcmToken:1}`.
- Timestamps: manual.
- Soft-delete: `isActive` toggle only.
- Money: none. Multi-tenancy: `fleetId`.

---

## FleetOffDutyCloseout
*File: `models/FleetOffDutyCloseout.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| fleetId | ObjectId | No | — | Fleets | — |
| closeoutData | [Subdoc] | No | — | — | — |
| closeoutData.closeoutId | ObjectId | No | — | closeOut | — |
| closeoutData.value | String | No | — | — | — |
| createdDate | Date | No | `Date.now` | — | — |
| updatedDate | Date | No | `Date.now` | — | — |

- Indexes: `{fleetId:1}` and `{closeoutId:1}` — **the second index targets a field name (`closeoutId`) that does not exist at the top level of this schema** (it only exists nested inside `closeoutData` as `closeoutData.closeoutId`) — effectively a dead/no-op index.
- Timestamps: manual.
- Soft-delete: none.
- Money: `closeoutData.value` is a bare `String` — any dollar amount here is unvalidated free text.
- Multi-tenancy: `fleetId`.

---

## FleetOnDutyChecklists
*File: `models/FleetOnDutyChecklists.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| fleetId | ObjectId | No | — | Fleets | — |
| checklistId | ObjectId | No | — | OnDutyChecklists | — |
| value | String | No | — | — | — |
| createdDate | Date | No | `Date.now` | — | — |
| updatedDate | Date | No | `Date.now` | — | — |

- Indexes: `{fleetId:1}`, `{checklistId:1}` — both valid (unlike the off-duty variant above).
- Timestamps: manual.
- Soft-delete: none.
- Money: none. Multi-tenancy: `fleetId`.

---

## fleetTaskActivityLogs
*File: `models/FleetTaskActivityLogs.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| fleetId | ObjectId | No | — | Fleets | — |
| taskId | ObjectId | No | — | **Fleets (bug — should be Tasks)** | — |
| taskStatus | String | No | `'pending'` | — | in_progress, completed, cancelled |
| isActive | Boolean | No | `true` | — | true, false |
| createdDate | Date | No | `Date.now` | — | — |
| updatedDate | Date | No | `Date.now` | — | — |

- Indexes: `{fleetId:1}`, `{taskId:1}`.
- **Bug 1**: `taskId` is declared `ref: 'Fleets'` — almost certainly should be `ref: 'Tasks'` (copy-paste from the `fleetId` field above it). A `populate('taskId')` call resolves against the wrong collection.
- **Bug 2**: `taskStatus` defaults to `'pending'`, which is **not a member of its own enum** (`['in_progress','completed','cancelled']`) — a document created with the untouched default fails Mongoose enum validation on save.
- Timestamps: manual. Soft-delete: `isActive` only. Money: none. Multi-tenancy: `fleetId`.

---

## FleetTasks
*File: `models/FleetTasks.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| taskId | ObjectId | No | — | Tasks | — |
| fleetId | ObjectId | No | — | Fleets | — |
| taskStatus | String | No | — | — | not_started, in_progress, completed, cancelled |
| createdBy | ObjectId | No | — | Admin | — |
| updatedBy | ObjectId | No | — | Admin | — |
| createdDate | Date | No | `Date.now` | — | — |
| updatedDate | Date | No | `Date.now` | — | — |

- Indexes declared: `{fleetEmail:1}`, `{fleetPhone:1}` — **neither `fleetEmail` nor `fleetPhone` is a field on this schema** (they belong to `Fleets`) — looks like the `.index()` block was copy-pasted from `Fleets.js` without updating field names. Net effect: two dead indexes, and **no index on `fleetId` or `taskId`**, the fields this join collection is actually queried by.
- Timestamps: manual. Soft-delete: none. Money: none. Multi-tenancy: `fleetId` (present but unindexed).

---

## Fleets
*File: `models/Fleets.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| fleetName | String | No | — | — | — |
| fleetEmail | String | No (unique) | — | — | — |
| fleetPhone | String | No (unique) | — | — | — |
| fleetPassword | String | No | — | — | — |
| fleetImage | String | No | hardcoded S3 default-image URL | — | — |
| fleetTransportationTypeId | ObjectId | No | — | TransportationTypes | — |
| fleetVehicleDetails | Object | No | — | — | — |
| regionData.regionId | String | No | — | — | — |
| regionData.regionName | String | No | — | — | — |
| locationData.latitude | Number | No | `0.0` | — | — |
| locationData.longitude | Number | No | `0.0` | — | — |
| terminalData.terminalId | String | No | `''` | — | — |
| terminalData.terminalName | String | No | `''` | — | — |
| policyFile | String | No | — | — | — |
| idFile | String | No | — | — | — |
| fleetOtherInfo | Object | No | — | — | — |
| fleetVerificationStatus | String | No | `'pending'` | — | pending, verified |
| fleetStatus | String | No | `'active'` | — | inactive, active |
| fleetOnDutyStatus | Boolean | No | `false` | — | — |
| createdBy | ObjectId | No | — | Admin | — |
| isDeleted | Boolean | No | `false` | — | — |
| deletedBy | ObjectId | No | — | Admin | — |
| lastLocationData.latitude | Number | No | `0.0` | — | — |
| lastLocationData.longitude | Number | No | `0.0` | — | — |
| lastLoginDate | Date | No | — | — | — |
| lastFleetCheck | Date | No | — | — | — |
| createdDate | Date | No | `Date.now` | — | — |
| updatedDate | Date | No | `Date.now` | — | — |
| fleetDisplayId | Number (via `mongoose-sequence`) | No | auto-increment, `start_seq: 1000` | — | — |

- Indexes: `fleetEmail`/`fleetPhone` each carry field-level `unique:true`; plus one compound index `{fleetPhone:1, fleetEmail:1, regionId:1, fleetStatus:1, fleetOnDutyStatus:1, isDeleted:1}`. **That compound index references `regionId` as a top-level field, but the actual field is nested at `regionData.regionId`** — same "index points at a nonexistent path" bug pattern seen in `FleetOffDutyCloseout` and `FleetTasks`. A commented-out `{locationData: '2dsphere'}` geospatial index exists but is disabled.
- Timestamps: manual `createdDate`/`updatedDate`.
- Soft-delete: `isDeleted` + `deletedBy` — **no `deletedAt`** (unlike Announcements/FailureReason).
- Money: none directly on the schema — but this same file exports `fleetCloseoutFormValidation` (Joi), a large cash/credit-card closeout payload (`numberOf1Bills`, `numberOf2Bills`, `totalInLooseChange`, `cashTotal`, `numberOfCreditCardTransactions`, `creditCardTotal`, plus 12 QR-code string fields) with **no corresponding schema anywhere** — presumably persisted into `FleetCloseout.closeoutObject` (untyped `Object`).
- Multi-tenancy: `regionData.regionId`/`terminalData.terminalId` are denormalized **strings**, not ObjectId refs — no real relational link to a Region or Terminal document.

---

## HyperdriveResetRequest
*File: `models/HyperdriveResetRequest.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| fleetEmail | String | No | `''` | — | — |
| name | String | No | — | — | — |
| token | String | No | — | — | — |
| userData | Object | No | — | — | — |
| createdDate | Number | No | — | — | — |

- Indexes: none.
- Timestamps: none (`createdDate` raw Number, no default).
- Soft-delete: none.
- Money: none. No multi-tenancy key — identifies the fleet by raw `fleetEmail` string rather than `fleetId` ref, inconsistent with every other Fleet-scoped model. Also exports `resetPasswordValidation` Joi middleware (not currently wired to its route — see main report §6).

---

## Miscellaneous
*File: `models/Miscellaneous.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| uniqueId | String | No | — | — | — |
| data | Mixed | No | — | — | — |
| createdDate | Number | No | — | — | — |
| updatedDate | Number | No | — | — | — |

- Indexes: none. Timestamps: none. Soft-delete: none. Money: none. Multi-tenancy: none — a generic untyped key/value blob store (used, among other things, to cache the Blaze retail session token under `uniqueId: "blazeToken"`).

---

## HyperDriveNotification
*File: `models/Notifications.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| notificationObject | Object | No | — | — | — |
| notificationTitle | String | No | — | — | — |
| notificationType | String | No | — | — | — |
| notificationMessage | String | No | — | — | — |
| isActive | Boolean | No | `false` | — | — |
| isRead | Boolean | No | `false` | — | — |
| from | ObjectId | No | — | Admin | — |
| to | ObjectId | No | — | Fleets | — |
| createdDate | Date | No | `Date.now` | — | — |
| updatedDate | Date | No | `Date.now` | — | — |

- Indexes: none declared (no index on `to`, despite it being the obvious per-fleet inbox lookup key).
- Timestamps: manual. Soft-delete: none (`isActive` here means "visible," separate from `isRead`).
- Money: none. Multi-tenancy: `to` (Fleets) is the effective scoping field.

---

## onDutyChecklists
*File: `models/OnDutyChecklists.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| title | String | No | — | — | — |
| type | String | No | — | — | text, checkbox |
| createdBy | ObjectId | No | — | Admin | — |
| isActive | Boolean | No | `true` | — | — |
| isOptional | Boolean | No | `false` | — | — |
| createdDate | Date | No | `Date.now` | — | — |
| updatedDate | Date | No | `Date.now` | — | — |

- Indexes: `{title:1}`.
- Timestamps: manual. Soft-delete: `isActive` only.
- Money: none. No multi-tenancy — a global checklist-question template, referenced by `FleetOnDutyChecklists.checklistId`. Also exports `submitOnDutyChecklistValidation` Joi middleware.
- **Cross-repo note**: ~0.97 similar to `distribution-backend/models/OnDutyChecklists.js` — see main report §12. Only substantive difference is model registration style (`mongoose.model(...)` here vs. `global.dbConnections.conn3.model(...)` there).

---

## Order
*File: `models/Order.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| paymentId | String | No | `''` | — | — |
| cuid | String | No | — | — | — |
| orderId | String | No | `''` | — | — |
| onFleetTriggers | Array | No | `[]` | — | — |
| email | String | No | — | — | — |
| userData | Object | No | — | — | — |
| everFlow | Object | No | — | — | — |
| cartData | Object | No | — | — | — |
| metadata | Object | No | — | — | — |
| emailStatus | String | No | — | — | — |
| status | String | No | `'pending'` | — | — (no schema enum, though Joi validates pending/completed/cancelled at the API layer) |
| createdDate | Number | No | — | — | — |
| onFleetTaskId | String | No | — | — | — |
| updatedDate | Number | No | — | — | — |
| klaviyoProfileId | String | No | — | — | — |
| fleetId | ObjectId | No | — | Fleets | — |
| serviceTime | Number | No | — | — | — |
| expectedArrivalTime | Number | No | — | — | — |
| taskAssignmentMode | String | No | `''` | — | — |
| driverDetails | Object | No | `{}` | — | — |
| reviewStatus | Boolean | No | `false` | — | — |
| creditTransactionId | String | No | `''` | — | — |
| orderCancellationReason | Object | No | `{}` | — | — |

- **Bug**: `onFleetTriggers` is declared **twice** in the schema object literal (once bare `Array`, once as `{type: Array, default: []}`); the second silently overwrites the first — dead code from an unreviewed edit, not a functional bug.
- Indexes: `{cuid:1}`, `{orderId:1}`.
- Timestamps: none — `createdDate`/`updatedDate` are raw Numbers with no defaults (must be app-set), unlike almost every other Fleet-adjacent model.
- Soft-delete: none.
- Money: **no dedicated money field** — `cartData`/`metadata` are untyped Objects presumably holding line-item prices; no typed `total`/`subtotal` on Order itself (contrast with `Tasks`, which duplicates that concept as typed Numbers).
- Multi-tenancy: `fleetId` only — **no regionId/terminalId/storeId**, even though `Tasks` carries `regionId`, `dispatchRegionId`, and `terminalId`. **Order and Tasks have no ObjectId ref linking them in either direction** — only look-alike String fields (`Order.orderId`/`onFleetTaskId`, `Tasks.orderDetails`/`orderTag`/`orderType`) hint the relationship is stitched together in application code, not the schema.
- **Cross-repo note**: ~0.82 similar to `distribution-backend/models/Order.js` — diverged in both directions (this repo has `onFleetTriggers`/`klaviyoProfileId`; `distribution-backend` has an entire CanPay payment block and AlpineIQ loyalty fields this repo lacks). See main report §12.

---

## Region
*File: `models/Region.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| created | Date | No | `Date.now` | — | — |
| modified | Date | No | `Date.now` | — | — |
| deleted | Boolean | No | `false` | — | — |
| updated | Boolean | No | `false` | — | — |
| companyId | ObjectId | No | — | Company *(external — no local model)* | — |
| name | String | **Yes** | — | — | — |
| active | Boolean | No | `true` | — | — |
| latitude | Number | **Yes** | — | — | — |
| longitude | Number | **Yes** | — | — | — |
| regionDefault | Boolean | No | `false` | — | — |
| deliveryFee | Number | No | `0` | — | — |
| openAt | String ("HH:mm") | **Yes** | — | — | — |
| openAtNumeric | Number | **Yes** | — | — | — |
| closeAtNumeric | Number | **Yes** | — | — | — |
| closeAt | String ("HH:mm") | **Yes** | — | — | — |
| daysClose | [String] | No | `[]` | — | — |
| minOrderAmount | Number | No | `0` | — | — |
| freeDeliveryAfter | Number | No | `0` | — | — |
| zoneType | String | No | `'zipCode'` | — | zipCode, geoFence, customZone |
| fileZone | String | No | `null` | — | — |
| taxRuleId | ObjectId | No | — | TaxRule *(external)* | — |
| deliveryCharge | Number | No | `0` | — | — |
| kmlEdges | [Mixed] | No | `[]` | — | — |
| drivers | [ObjectId] | No | — | Driver *(external)* | — |
| terminals | [ObjectId] | No | — | Terminal *(external)* | — |
| shopName | String | No | `'--'` | — | — |
| shopId | ObjectId | No | `null` | Shop *(external)* | — |
| inventories | [ObjectId] | No | — | Inventory *(external)* | — |
| daysOperation | [String] | No | `null` | — | — |
| zipCodes | [String] | **Yes** (per-item) | — | — | — |
| kmlColor | String | No | `'#3e41ea'` | — | — |
| inventoryTerminalDriverResult | Mixed | No | `null` | — | — |
| allowedConsumerTypes | [String] | No | `[]` | — | — |

- Indexes: none declared.
- Schema options: `{collection: 'regions'}` — the **only** model in `models/` that doesn't use the otherwise-universal `{versionKey:false, minimize:false}` pattern.
- Timestamps: uses `created`/`modified` (not `createdDate`/`updatedDate` like every other model) — a distinct naming convention.
- Soft-delete: `deleted` Boolean — a fourth distinct soft-delete convention in this codebase.
- Money: `deliveryFee`, `deliveryCharge`, `minOrderAmount`, `freeDeliveryAfter` — all `Number`, default `0`, no cents-vs-dollars indicator. `deliveryFee` and `deliveryCharge` look like duplicate/competing fields for the same concept.
- Multi-tenancy: `companyId` — but `Company`, `TaxRule`, `Driver`, `Terminal`, `Shop`, `Inventory` are **all refs to models that do not exist anywhere in this repo's `models/` directory**. Nothing else in this repo's schema graph points at Region via `ref:`, and Region is confirmed (main report §5) to never actually be queried anywhere in this codebase — a structural island, likely carried over from a different service sharing the same database.

---

## ReturnToHQ
*File: `models/ReturnToHQ.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| returnToHqId | String | No | — | — | — |
| regionName | String | No | — | — | — |
| regionId | String | No | — | — | — |
| location | Object | No | `{}` | — | — |
| isEnabled | Boolean | No | `true` | — | — |
| taskTime | String | No | `''` | — | — |
| fleetId | ObjectId | No | — | Fleets | — |
| fleetDetails | Object | No | `{}` | — | — |
| createdDate | Number | No | `Date.now` | — | — |
| updatedDate | Number | No | `Date.now` | — | — |

- Indexes: none. Timestamps: `createdDate`/`updatedDate` typed `Number` but defaulted via `Date.now` — a third distinct date-field convention.
- Soft-delete: none (`isEnabled` is an availability toggle).
- Money: none. Multi-tenancy: `fleetId` + `regionId` (raw String, not a ref).
- Near-identical in shape to `StartTask` below — see Relationships & Overlaps.

---

## StartTask
*File: `models/StartTask.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| startTaskId | String | No | — | — | — |
| regionName | String | No | — | — | — |
| regionId | String | No | — | — | — |
| location | Object | No | `{}` | — | — |
| isEnabled | Boolean | No | `true` | — | — |
| fleetId | ObjectId | No | — | Fleets | — |
| fleetDetails | Object | No | `{}` | — | — |
| createdDate | Number | No | `Date.now` | — | — |
| updatedDate | Number | No | `Date.now` | — | — |

- Indexes: none. Timestamps: same Number+Date.now pattern as ReturnToHQ.
- Soft-delete: none. Money: none. Multi-tenancy: `fleetId` + `regionId` (raw String).
- **Structurally near-identical to `ReturnToHQ`** — same fields minus `taskTime`, differing only in the `*Id` field name. Candidate for consolidation into a single "FleetWaypointEvent" model with a `type` enum.

---

## Tasks
*File: `models/TasksModel.js`* (65 fields per mechanical scan — the largest model by far)

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| taskType | String | No | — | — | breakTask, returnToHeadquarterTask, startTask, deliveryTask, pickUpTask |
| taskTag | String | No | `'onTime'` | — | critical, onTime, delayed |
| taskAssignmentMode | String | No | — | — | auto, manual, driver, region |
| taskAssignmentPolicy | String | No | — | — | single, multiple, all |
| fleetId | ObjectId | No | — | Fleets | — |
| breakId | ObjectId | No | — | Break | — |
| failureDetails.failureReasonId | ObjectId | No | — | FailureReason | — |
| failureDetails.failureReasonNote | String | No | — | — | — |
| taskName | String | No | — | — | — |
| taskDescription | String | No | — | — | — |
| recipientDetails | Object | No | — | — | — |
| orderDetails | String | No | — | — | — |
| taskArchived | Boolean | No | `false` | — | — |
| address | Object | No | — | — | — |
| totalDiscount | Number | No | — | — | — |
| transactionNumber | String | No | — | — | — |
| serviceTime | Number | No | — | — | — |
| taskStartTime | Date | (typo `"require: true"` — no-op, not actually required) | — | — | — |
| taskEndTime | Date | No | — | — | — |
| amountReceived | Boolean | No | — | — | — |
| actualTaskStartTime | Date | No | — | — | — |
| actualTaskEndTime | Date | No | — | — | — |
| orderTag | String | No | `''` | — | — |
| driverAppRequirements | Object | No | — | — | — |
| attachments.customerSignatureUrl | String | No | — | — | — |
| attachments.photoUrl | [String] | No | — | — | — |
| attachments.barcode | String | No | — | — | — |
| attachments.addNotes | String | No | — | — | — |
| companyAnnoucementIds | [ObjectId] | No | — | Announcements | — |
| items | Array | No | — | — | — |
| isActive | Boolean | No | `true` | — | — |
| taskStatus | String | No | `'not_started'` | — | **none declared in schema** (see finding) |
| timezone | String | No | — | — | — |
| regionId | String | No | — | — | — |
| fromTime | String | No | — | — | — |
| toTime | String | No | — | — | — |
| duration | Number | No | — | — | — |
| fleetDuration | Number | No | — | — | — |
| sendBreakAt | String | No | — | — | — |
| subTotal | Number | No | — | — | — |
| total | Number | No | — | — | — |
| streetView | String | No | — | — | — |
| afterTaxDiscount | Number | No | — | — | — |
| startLocationName | String | No | — | — | — |
| totalTax | Number | No | — | — | — |
| taxResult | Object | No | — | — | — |
| orderType | String | No | `''` | — | — |
| slotDetails | Object | No | `{}` | — | — |
| splitPayment | Object | No | `{}` | — | — |
| paymentOption | String | No | `''` | — | — |
| creditCardFee | Number | No | `0` | — | — |
| expectedArrivalTime | Date | No | — | — | — |
| expectedArrival | Date | No | — | — | — |
| scheduleTime | Date | No | — | — | — |
| expectedDistance | Number | No | — | — | — |
| actualArrivalTime | Date | No | — | — | — |
| actualDistance | Number | No | — | — | — |
| terminalId | String | No | — | — | — |
| inventoryId | String | No | — | — | — |
| createdBy | ObjectId | No | — | Admin | — |
| updatedBy | ObjectId | No | — | Admin | — |
| dispatchRegionId | String | No | `''` | — | — |
| createdDate | Date | No | `Date.now` | — | — |
| updatedDate | Date | No | `Date.now` | — | — |
| taskOrderDistance | Number | No | `0` | — | — |
| isBreakTaskUpdated | Boolean | No | `false` | — | — |
| taskDisplayId | Number (via `mongoose-sequence`) | No | auto-increment, `start_seq: 1000` | — | — |

- Indexes: one compound `{fleetId:1, taskStatus:1, actualTaskStartTime:1, actualTaskEndTime:1}` — does not cover `taskType`, `createdDate`, or `isActive`/`taskArchived`, all filtered on elsewhere.
- Timestamps: manual `createdDate`/`updatedDate`.
- Soft-delete: `taskArchived` Boolean — a fifth distinct naming convention for the same concept, with **no `deletedBy`/`deletedAt`** at all.
- Money: `totalDiscount`, `subTotal`, `total`, `afterTaxDiscount`, `totalTax`, `creditCardFee` — all `Number` (float), no cents-scaling evidence, no comments.
- Multi-tenancy: `fleetId` (ref) + `regionId` + `dispatchRegionId` + `terminalId` (all three raw Strings, no refs) — the widest scoping surface of any model, with zero referential integrity on any location field, and two separately-named "region" fields whose relationship to each other isn't evident from the schema.
- **Finding — enum gap**: `taskStatus` has no `enum` in the schema even though `validTaskStatus = ["in_progress","completed","cancelled","unassigned","not_started"]` is defined in this same file and enforced by `taskUpdateStatusValidation` (Joi) at the API layer — the database itself accepts any string.
- **Is this a god object? Yes** — it merges at least six bounded contexts into one 65-field collection:
  - **Dispatch/assignment**: taskType, taskAssignmentMode, taskAssignmentPolicy, fleetId, dispatchRegionId, regionId, terminalId, inventoryId
  - **Timing**: taskStartTime/taskEndTime/actualTaskStartTime/actualTaskEndTime/expectedArrivalTime/expectedArrival/scheduleTime/actualArrivalTime, duration/fleetDuration/serviceTime, fromTime/toTime/sendBreakAt, timezone
  - **Location/routing**: address, startLocationName, streetView, expectedDistance/actualDistance/taskOrderDistance
  - **Financial (order-snapshot) data**: totalDiscount, subTotal, total, afterTaxDiscount, totalTax, taxResult, creditCardFee, splitPayment, paymentOption, orderType — the same conceptual data `Order` should own, duplicated here with no ref back to `Order`
  - **Customer/delivery-proof**: recipientDetails, orderDetails, transactionNumber, items, driverAppRequirements, attachments, orderTag, companyAnnoucementIds
  - **Failure/break handling**: failureDetails, breakId, isBreakTaskUpdated (a delivery task and a driver break are the same document type, distinguished only by `taskType`)
  - **Audit**: createdBy, updatedBy, createdDate, updatedDate, taskDisplayId, isActive, taskArchived

---

## TerminalProducts
*File: `models/TerminalProducts.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| productId | String | No (unique) | — | — | — |
| quantities | Array | No | — | — | — |
| active | Boolean | No | `true` | — | — |

- Indexes: `productId` field-level `unique:true` → 1 implicit index.
- Timestamps: none at all.
- Soft-delete: `active` toggle only.
- Money: none. **Multi-tenancy gap**: a model literally named `TerminalProducts` has **no `terminalId` field** — that scoping, if it exists, must live elsewhere.

---

## TransportationTypes
*File: `models/TransportationTypes.js`*

| Field | Type | Required | Default | Ref | Enum |
|---|---|---|---|---|---|
| name | String | No | — | — | — |
| isActive | Boolean | No | `false` | — | — |
| createdDate | Date | No | `Date.now` | — | — |
| updatedDate | Date | No | `Date.now` | — | — |

- Indexes: `{name:1}`. Timestamps: manual. Soft-delete: `isActive` toggle, defaults `false` (unusual — most other "active" flags default `true`).
- Money: none. No multi-tenancy — correctly a global lookup table (car/bike/etc.), referenced by `Fleets.fleetTransportationTypeId`.

---

## Relationships & Overlaps

### The 10 most central models

1. **Fleets** — referenced by 14 other model files; the true hub of the schema.
2. **Tasks** (`TasksModel.js`) — 65 fields, the dispatch/delivery core; referenced by `FleetTasks.taskId` (and, due to a bug, *not* by `FleetTaskActivityLogs.taskId`, which points at Fleets instead).
3. **Admin** — referenced from 10 files (every `createdBy`/`updatedBy`/`deletedBy`/`from`/`adminIds` audit field).
4. **Order** — the customer-facing order record; links to Fleets but not to Tasks.
5. **FleetTasks** — the join collection between Fleets and Tasks.
6. **Region** — 36 fields, clearly meant to be the store/territory concept, but structurally disconnected from the rest of this repo's schema graph.
7. **Announcements** — referenced by `Tasks.companyAnnoucementIds`.
8. **closeOut** — the checklist/cash-count template referenced by `FleetOffDutyCloseout`.
9. **Break** — referenced by both `FleetBreakLog` and `Tasks.breakId`.
10. **OnDutyChecklists** — referenced by `FleetOnDutyChecklists.checklistId`, the on-duty counterpart to closeOut.

### Relationship graph (grep'd `ref:` across all 28 files)

```
Tasks.fleetId                      -> Fleets._id
Tasks.breakId                      -> Break._id
Tasks.failureDetails.failureReasonId -> FailureReason._id
Tasks.companyAnnoucementIds[]      -> Announcements._id
Tasks.createdBy / updatedBy        -> Admin._id

FleetTasks.taskId                  -> Tasks._id
FleetTasks.fleetId                 -> Fleets._id
FleetTasks.createdBy / updatedBy   -> Admin._id

FleetTaskActivityLogs.fleetId      -> Fleets._id
FleetTaskActivityLogs.taskId       -> Fleets._id   (BUG: should be Tasks._id)

Order.fleetId                      -> Fleets._id
(no ref exists between Order and Tasks in either direction)

Fleets.fleetTransportationTypeId   -> TransportationTypes._id
Fleets.createdBy / deletedBy       -> Admin._id

FleetAccessTokens.fleetId          -> Fleets._id
FleetActivityLogs.fleetId          -> Fleets._id
FleetBreakLog.fleetId              -> Fleets._id
FleetBreakLog.breakId              -> Break._id
FleetCloseout.fleetId              -> Fleets._id
fleetDevices.fleetId               -> Fleets._id
FleetOffDutyCloseout.fleetId       -> Fleets._id
FleetOffDutyCloseout.closeoutData.closeoutId -> closeOut._id
FleetOnDutyChecklists.fleetId      -> Fleets._id
FleetOnDutyChecklists.checklistId  -> OnDutyChecklists._id
ReturnToHQ.fleetId                 -> Fleets._id
StartTask.fleetId                  -> Fleets._id

HyperDriveNotification.from        -> Admin._id
HyperDriveNotification.to          -> Fleets._id
ApprovalNotifications.fleetId      -> Fleets._id
ApprovalNotifications.adminIds[]   -> Admin._id
ApprovalNotifications.updatedBy    -> Admin._id

Announcements.createdBy/updatedBy/deletedBy -> Admin._id
Breaks.createdBy                   -> Admin._id
closeOut.createdBy                 -> Admin._id
FailureReason.createdBy/updatedBy/deletedBy -> Admin._id
onDutyChecklists.createdBy         -> Admin._id

Region.companyId    -> Company._id    (EXTERNAL — model not in this repo)
Region.taxRuleId    -> TaxRule._id    (EXTERNAL)
Region.drivers[]    -> Driver._id     (EXTERNAL)
Region.terminals[]  -> Terminal._id   (EXTERNAL)
Region.shopId       -> Shop._id       (EXTERNAL)
Region.inventories[]-> Inventory._id  (EXTERNAL)
```

### Duplicate / overlapping models

**Closeout family — `closeOut` vs. `FleetCloseout` vs. `FleetOffDutyCloseout`.** All three exist to record a driver's end-of-shift checklist/cash count, but they don't agree on a shape:
- `closeOut` (models/Closeout.js) is a **template**: `title`, `type` (enum text/checkbox/photo/qr/number/prefix/boolean), `isButton`/`isPrefix`/`isOptional`/`isRequired` — no `fleetId`, it's a master question list.
- `FleetCloseout` (models/FleetCloseout.js) is a **submission** storing the answer as one untyped `closeoutObject: Object` plus `fleetId` — it never references `closeOut` at all.
- `FleetOffDutyCloseout` (models/FleetOffDutyCloseout.js) is *also* a submission, but stores a properly-referenced array `closeoutData: [{closeoutId -> closeOut._id, value: String}]` plus `fleetId`.

These two submission models look like two competing implementations of the same feature that were never consolidated. Compounding this, `Fleets.js` exports a large `fleetCloseoutFormValidation` Joi schema (cash bill counts, `cashTotal`, `creditCardTotal`, 12+ QR-code fields) that maps to **neither** Closeout model's actual schema fields — this cash/credit-card money data presumably lands in `FleetCloseout.closeoutObject`, meaning the richest financial data in the whole estate has zero schema-level typing once it reaches Mongo.

**Activity-log family — `ActivityLogs` vs. `fleetActivityLogs` vs. `fleetTaskActivityLogs`.** Despite similar names, these are three genuinely different concerns, not duplicates: `ActivityLogs` is a generic admin-side change diff; `fleetActivityLogs` is a driver's on/off-duty session (clock-in/out); `fleetTaskActivityLogs` is per-task status changes (with the ref bug noted above). There is, however, a real duplication risk between `fleetActivityLogs`'s session timing and `Tasks`'s own `actualTaskStartTime`/`actualTaskEndTime`/`isBreakTaskUpdated` — both capture "when did work happen" with no schema-level link tying a session to the tasks performed during it.

**`ReturnToHQ` vs. `StartTask`** are near-identical: both carry `regionName`/`regionId` (raw String), `location` (Object), `isEnabled`, `fleetId` (ref Fleets), `fleetDetails` (Object), and Number-typed `createdDate`/`updatedDate` defaulted via `Date.now`. The only differences are `ReturnToHQ`'s extra `taskTime` field and each having its own `*Id` field. These could plausibly be a single "FleetWaypointEvent" model with a `type: 'start'|'return'` enum instead of two parallel collections.

### Cross-cutting findings

- **No model uses `{timestamps:true}`.** Every model hand-rolls date fields, with **at least three incompatible conventions**: `Date` type + `Date.now` default (most models); raw `Number` with **no** default (ActivityLogs, Admin, Miscellaneous, Order, HyperdriveResetRequest); raw `Number` **with** a `Date.now` default (ReturnToHQ, StartTask). Region alone uses `created`/`modified` instead of `createdDate`/`updatedDate`.
- **At least four soft-delete conventions** coexist: `isActive` + `deletedAt` + `deletedBy` (Announcements, FailureReason); `isDeleted` + `deletedBy`, no `deletedAt` (Fleets); `deleted` boolean alone (Region); `taskArchived` boolean alone (Tasks). Several models use a bare `isActive` toggle meaning "active/inactive," not "deleted" (Break, closeOut, FleetAccessTokens, FleetDevices, TerminalProducts, TransportationTypes, OnDutyChecklists).
- **Three separate ref-path bugs** found by cross-referencing `.index()` calls against actual schema fields: `FleetTasks` indexes `fleetEmail`/`fleetPhone` (don't exist on that schema); `FleetOffDutyCloseout` indexes `closeoutId` (only exists nested under `closeoutData`); `Fleets`' compound index references `regionId` (actually nested at `regionData.regionId`). All three indexes are effectively dead.
- **`FleetTaskActivityLogs.taskId`** is `ref: 'Fleets'` instead of `ref: 'Tasks'`.
- **`Tasks.taskStatus`** has no schema `enum` despite a `validTaskStatus` constant existing and being enforced by Joi at the API boundary.
- **Money is floating-point `Number` everywhere it's typed at all**, with no cents-vs-dollars indicator, and the richest money data in the estate (driver cash/credit-card closeout) isn't typed at all — stored as an untyped `Object`.
- **Order and Tasks have no schema-level relationship** despite being the two obvious halves of "a customer order becomes a driver task" — only look-alike String fields hint that application code stitches them together outside the schema.
- **`Region` is disconnected from the rest of the app's schema** — different schema-option style, different date-field convention, different soft-delete convention, and six `ref:` targets that don't exist anywhere in this `models/` directory — strong evidence this file was carried over from a different (storefront/admin) service sharing the same database, rather than authored as part of this backend.
