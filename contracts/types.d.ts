// @hyper-tech/contracts — hand-written declarations for index.js (kept in step by test/contracts.test.mjs).
export type Platform = 'hyperwolf' | 'hemp' | 'stilo';
export type PersonKind = 'customer' | 'staff' | 'driver' | 'tenant' | 'service';
export type Role = 'viewer' | 'associate' | 'manager' | 'admin' | 'superadmin';
export type Classification = 'budtender' | 'driver' | 'manager' | 'loss_prevention' | 'support' | 'other';
export type ContestKind = 'spiff' | 'contest' | 'team_goal' | 'store_vs_store' | 'aov_goal';
export type ContestStatus = 'draft' | 'pending_approval' | 'active' | 'settled' | 'cancelled' | 'ended';
export type Metric = 'units' | 'net_cents' | 'gross_cents' | 'txn_count' | 'aov_cents';
export type PointsKind = 'earned' | 'adjusted' | 'recorded_paid' | 'redeemed' | 'expired';
export type TxnType = 'sale' | 'refund' | 'void';
export type MoneyBasis = 'ex_tax_net' | 'ex_tax_gross' | 'inc_tax';
export type VerificationStatus = 'Not Started' | 'In Progress' | 'Awaiting User' | 'In Review' | 'Approved' | 'Declined' | 'Resubmitted' | 'Abandoned' | 'Expired' | 'Kyc Expired';
export type VerificationChannel = 'hosted' | 'embedded' | 'pos' | 'import';
export type OrderStatus = 'pending' | 'confirmed' | 'packed' | 'out_for_delivery' | 'completed' | 'cancelled' | 'refunded';
export type TaskStatus = 'not_started' | 'unassigned' | 'in_progress' | 'completed' | 'cancelled';
export type TaskAssignmentMode = 'auto' | 'manual' | 'driver' | 'region';
export type FleetStatus = 'active' | 'inactive';
export type PromotionStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'ended' | 'inactive';
export type RuleType = 'cart' | 'product' | 'user' | 'bogo' | 'time' | 'payment';
export type ProductSource = 'blaze' | 'meadow' | 'treez' | 'first-party';
export type PosVendor = 'blaze' | 'meadow' | 'treez' | 'hwpos' | 'none';
export type LocationKind = 'receiving' | 'safe' | 'floor' | 'shelf' | 'display' | 'kit_box' | 'vehicle' | 'packing_bench' | 'lp_bench' | 'quarantine' | 'returns' | 'waste' | 'transfer_out';
export type ArrivalKind = 'new_sku' | 'restock' | 'new_batch';
export type MovementReason = 'receive' | 'put_away' | 'build' | 'refill' | 'restock' | 'dispatch' | 'return' | 'sale' | 'transfer' | 'handoff' | 'count_adjust' | 'quarantine' | 'waste' | 'sample' | 'correction';
export type PlanReason = 'sold' | 'new_arrival' | 'oldest_first' | 'partial_placement' | 'short_stock' | 'below_subregion_count' | 'not_in_template' | 'no_sales_counted' | 'capped' | 'mixed_batch' | 'reserved' | 'expiring' | 'held' | 'manual';
export type ChannelKind = 'asap' | 'scheduled' | 'register' | 'pickup' | 'express';
export type CountState = 'proposed' | 'recount_required' | 'awaiting_approval' | 'approved' | 'rejected';
export type LocationSide = 'foh' | 'boh';
export type RuleShape = 'hw.rule.v1';
export type RuleField = 'batch.batch_no' | 'batch.thc_pct' | 'batch.packaged_at' | 'batch.received_at' | 'batch.expires_at' | 'batch.age_days' | 'product.shell_id' | 'product.sku' | 'product.category_id' | 'product.brand' | 'cart.subtotal_cents' | 'cart.line_count' | 'customer.tier' | 'customer.segment_id' | 'order.channel' | 'order.store_id' | 'time.dow' | 'time.hour';
export type RuleOp = 'eq' | 'neq' | 'in' | 'not_in' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'before' | 'after' | 'older_than_days' | 'newer_than_days';
export type RuleThenKind = 'percent' | 'amount' | 'price' | 'bogo' | 'gift' | 'points';
export type RuleStatus = 'draft' | 'active' | 'paused' | 'ended';
export type RuleSource = 'ui' | 'agent';
export type RuleChannel = 'in_store' | 'pickup' | 'delivery';
export type RuleFieldType = 'number' | 'string' | 'date' | 'enum';
export type IdSource = 'blaze' | 'meadow' | 'treez' | 'weedmaps' | 'didit' | 'hwpos' | 'connecteam' | 'airtable' | 'hyperwolf' | 'metrc' | 'onfleet' | 'twilio' | 'sendgrid' | 'alpineiq' | 'hyperdrive';
export type FulfillmentStage = 'verify' | 'pack' | 'packing' | 'ready' | 'done' | 'canceled';
export type WeedmapsOrderStatus = 'DRAFT' | 'PENDING' | 'IN_PROGRESS' | 'READY_FOR_ATTAINMENT' | 'COMPLETE' | 'CANCELED_SELLER';
export type DriverDutyState = 'duty' | 'idle' | 'break' | 'meal' | 'oos' | 'offline' | 'on_route';
export type CalloffStatus = 'open' | 'covered';
export type RegionShiftStatus = 'on' | 'off';
export type TerminalKind = 'station' | 'mobile';
export type DrawerState = 'open' | 'closed';
export type CloseoutDestination = 'safe' | 'bank' | 'hand';
export type PaymentMethod = 'cash' | 'card' | 'split' | 'cod' | 'prepaid';
export type Lane = 'express' | 'scheduled';
export type CheckinState = 'waiting' | 'bound' | 'served' | 'left';
export type NotificationChannel = 'sms' | 'email' | 'push' | 'wallet';
export type PromoRelation = 'mirrors' | 'supersedes' | 'conflict';
export type BatchStage = 'incoming' | 'received' | 'labeling' | 'sealing' | 'shelf_ready' | 'merchandised' | 'approved' | 'quarantined' | 'recalled' | 'destroyed';
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type LiveFeedStatus = 'off' | 'pending' | 'slow' | 'live' | 'unreachable' | 'no-write-path';
export type AtHomeVisitStatus = 'requested' | 'confirmed' | 'en_route' | 'in_session' | 'completed' | 'canceled';
export type GeniusShiftStatus = 'available' | 'en_route' | 'in_session' | 'off';
export type DiscountKind = 'percent' | 'dollar' | 'bogo' | 'bundle' | 'gift' | 'tiered' | 'points';
export type CampaignStatus = 'sent' | 'sending' | 'scheduled' | 'queued' | 'draft' | 'paused';
export type FlowStatus = 'draft' | 'live' | 'paused' | 'archived';
export type AudienceStatus = 'draft' | 'live' | 'paused' | 'archived' | 'suggested';
export type PersonStatus = 'unverified' | 'active' | 'blocked' | 'deleted' | 'flagged';
export type ErrorCode = 'bad_request' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict' | 'unprocessable' | 'rate_limited' | 'internal' | 'not_built';
export type EventType = 'order.created' | 'order.completed' | 'order.refunded' | 'order.cancelled' | 'task.status_changed' | 'verification.decided' | 'points.earned' | 'points.redeemed' | 'promotion.consumed' | 'person.merged';
// 0.5.0 — Track 3 LP+HR migration (BUILD-PROGRAM-MASTER-PLAN-2026-09-16.md §4, Team 3b).
export type HrEmployeeStatus = 'active' | 'on_leave' | 'terminated';
export type HrAccountabilityBand = 'clean' | 'watch' | 'high_risk';
export type HrDocStatus = 'current' | 'expiring_soon' | 'expired' | 'missing';
export type IncidentType = 'customer_complaint' | 'change_not_returned' | 'inventory_confirmation_failure' | 'wrong_order_items' | 'inappropriate_behavior' | 'over_under_charged' | 'poor_customer_service' | 'time_task_not_started_promptly' | 'time_area_task_late_start' | 'time_hq_task_late_start' | 'time_left_region_on_break' | 'time_idle_during_orders' | 'time_personal_errands' | 'time_extended_break' | 'used_promo_code' | 'late_delivery' | 'late_or_no_show';
export type IncidentIssueCategory = 'communication' | 'response_time' | 'professionalism' | 'accuracy' | 'timeliness' | 'other';
export type Severity = 'low' | 'medium' | 'high';
export type IncidentStatus = 'open' | 'escalated' | 'in_progress' | 'pending' | 'response_received' | 'resolved' | 'closed';
export type CallOffType = 'absent' | 'late' | 'no_call_no_show' | 'sick';
export type CallOffReason = 'sick' | 'flu_symptoms' | 'personal' | 'family_emergency' | 'car_trouble' | 'injury' | 'appointment' | 'other';
export type HrCallOffStatus = 'pending_review' | 'unexcused' | 'doctors_note_received' | 'pending' | 'excused' | 'covered';
export type WriteUpLevel = 'first_warning' | 'second_warning' | 'final_warning' | 'termination';
export type WriteUpLadder = 'attendance' | 'accuracy';
export type WriteUpStatus = 'pending' | 'acknowledged' | 'in_progress' | 'closed' | 'archived' | 'rescinded';
export type WriteUpAiDraftStatus = 'not_drafted' | 'drafting' | 'drafted' | 'failed' | 'manually_edited';
export type CloserReportMode = 'delivery' | 'retail';
export type CloserReportDiscrepancyType = 'cash_short' | 'cash_over' | 'cc_mismatch' | 'payment_type_swap' | 'cash_and_cc' | 'unverified_return' | 'lp_blaze_review';
export type CloserReportOverUnder = 'over' | 'under';
export type CashExpectedSource = 'receipt' | 'pos' | 'typed';
export type LpBlazeStatus = 'pending' | 'match' | 'mismatch';
export type CloserReportResolutionStatus = 'submit_for_review' | 'unresolved' | 'in_process_of_resolving' | 'resolved' | 'manual_follow_up_required' | 'audited_verified' | 'pending_driver_response' | 'unverified_returns' | 'closed_duplicate_archived' | 'closed_corrected_no_discrepancy';
export type LpDisposition = 'explained' | 'process_fix' | 'true_loss';
export type ManagerDecision = 'approve_write_up' | 'dismiss_coaching';
export type PiiClass = 'restricted' | 'internal' | 'normal';

export interface ExternalId { source: IdSource; id: string }
export interface Money { cents: number; currency: 'USD'; basis: MoneyBasis }
export interface Store { id: string; name: string; platform: Platform; tz: string; pos: PosVendor; active: boolean; region_id?: string | null; external_ids?: ExternalId[] }
export interface Person { id: string; kind: PersonKind; display_name: string; role?: Role | null; classification?: Classification | null; store_id?: string | null; email?: string | null; phone?: string | null; external_ids?: ExternalId[]; verified?: boolean | null; created_at?: string | null }
export interface Product { id: string; platform: Platform; source: ProductSource; name: string; sku?: string | null; brand?: string | null; category?: string | null; price: Money; sale_price?: Money | null; quantity_on_hand?: number | null; external_ids?: ExternalId[] }
export interface OrderLine { product_id: string; name: string; brand?: string | null; category?: string | null; quantity: number; unit_price: Money; line_gross: Money; discount: Money }
export interface Order { id: string; platform: Platform; store_id: string; status: OrderStatus; txn_type: TxnType; ref_order_id?: string | null; customer_id?: string | null; associate_id?: string | null; created_at: string; completed_at?: string | null; subtotal: Money; discount: Money; tax?: Money | null; total: Money; lines?: OrderLine[]; external_ids?: ExternalId[] }
export interface Location { id: string; kind: LocationKind; name: string; address?: string | null; store_id?: string | null; region_id?: string | null; parent_id?: string | null; active?: boolean; capacity?: number | null }
/** One Metrc package a batch is split across. The batch is the unit of control; the tag is compliance. */
export interface MetrcPackage { tag: string; quantity?: number | null; packaged_at?: string | null }
export interface Batch { id: string; product_id: string; sku?: string | null; batch_no: string; /** deprecated 0.4.3: first tag; write metrc_packages */ metrc_tag?: string | null; metrc_packages?: MetrcPackage[]; packaged_at?: string | null; expires_at?: string | null; received_at: string; thc_pct?: number | null; unit_cost?: Money | null; quantity: number; location_id?: string | null; external_ids?: ExternalId[] }
export interface Movement { id: string; at: string; reason: MovementReason; product_id: string; batch_id: string; quantity: number; from_location_id?: string | null; to_location_id: string; tag_ids?: string[]; actor_id?: string | null; ref?: string | null; note?: string | null }
export interface ReceivedItem { id: string; received_at: string; kind: ArrivalKind; product_id: string; batch_id: string; quantity: number; location_id?: string | null; included_in?: string[]; reason?: PlanReason | null; premium?: boolean }
export interface PlanLine { product_id: string; batch_id: string; from_location_id?: string | null; to_location_id: string; sold: number; need: number; cap: number; give: number; reasons: PlanReason[]; mixed_batch?: boolean; note?: string | null; picked_by?: string | null; picked_at?: string | null; packed_by?: string | null; packed_at?: string | null; verified_by?: string | null; verified_at?: string | null; overridden_by?: string | null }
export interface ShellLocationBinding { shell_id: string; store_id?: string | null; side: LocationSide; location_id: string; updated_at?: string | null; updated_by?: string | null }
export interface Plan { id: string; kind: 'build' | 'refill' | 'restock' | 'handoff'; business_day: string; generated_at: string; channel: ChannelKind; store_id?: string | null; lines: PlanLine[]; skipped?: PlanLine[]; warnings?: string[]; inputs?: Record<string, unknown> | null; planned_by?: string | null; engine_version?: string | null; approved_by?: string | null; approved_at?: string | null }
export interface Standing { person: Person; metric: Metric; value: number; rank: number; tied?: boolean; earned?: Money | null; progress?: number | null }
export interface Contest { id: string; name: string; kind: ContestKind; status: ContestStatus; metric: Metric; audience: Classification[]; store_ids: string[]; starts_at?: string | null; ends_at?: string | null; prize?: Money | null }
export interface PointsEntry { id: string; person_id: string; kind: PointsKind; amount: Money; at: string; contest_id?: string | null; note?: string | null }
export interface VerificationSession { id: string; session_number?: number | null; status: VerificationStatus; channel: VerificationChannel; person_id?: string | null; reasons?: string[]; created_at: string; completed_at?: string | null; external_ids?: ExternalId[] }
export interface Task { id: string; order_id?: string | null; fleet_id?: string | null; status: TaskStatus; assignment_mode: TaskAssignmentMode; region_id?: string | null; created_at: string; total?: Money | null }
export interface Fleet { id: string; person_id: string; status: FleetStatus; verification_status: 'pending' | 'verified'; on_duty?: boolean; region_id?: string | null }
export interface Promotion { id: string; platform: Platform; name: string; codes?: string[]; status: PromotionStatus; rule_types: RuleType[]; starts_at?: string | null; ends_at?: string | null; usage_limit?: number | null; stackable?: boolean; rule?: PromotionRule | null }
export interface RuleCondition { field: RuleField; op: RuleOp; value: unknown }
export interface RuleNode { field?: RuleField; op?: RuleOp; value?: unknown; all?: RuleNode[]; any?: RuleNode[]; not?: RuleNode[] }
export interface RuleGroup { all: RuleNode[]; any: RuleNode[]; not: RuleNode[] }
export interface PromotionRule {
  shape: RuleShape; id: string; name: string; status: RuleStatus; priority: number; stackable: boolean;
  window: { starts_at: string; ends_at: string | null };
  scope: { store_ids: string[]; channels: RuleChannel[] };
  if: RuleGroup;
  then: { kind: RuleThenKind; value: unknown; applies_to: 'matched_lines' | 'cart'; cap_cents: number | null; max_per_order: number | null };
  meta: { author: string; source: RuleSource; prompt: string | null; version: number };
}
export interface AirtableSourceRef { base: string; table: string; record_id: string }
export interface HrDocFlag { doc_type: string; status: HrDocStatus; expires_at?: string | null }
export interface HrEmployee { source_ref: AirtableSourceRef; person_id?: string | null; entity_id: string; store_id?: string | null; display_name: string; email?: string | null; phone?: string | null; status: HrEmployeeStatus; title?: string[]; location?: string | null; reports_to?: string | null; tenure_label?: string | null; accountability_band?: HrAccountabilityBand | null; total_incidents?: number | null; writeup_count?: number | null; doc_flags?: HrDocFlag[]; separation_date?: string | null; separation_note?: string | null; created_at?: string | null }
export interface HrEmployeeRestricted { source_ref: AirtableSourceRef; person_id: string; entity_id?: string | null; ssn?: string | null; dl_number?: string | null; passport_number?: string | null; home_address?: string | null; emergency_contact_name?: string | null; emergency_contact_phone?: string | null; emergency_contact_relationship?: string | null; bank_account_last4?: string | null }
export interface Incident { source_ref: AirtableSourceRef; entity_id: string; store_id?: string | null; employee_person_id: string; number?: number | null; type: IncidentType; issue_category?: IncidentIssueCategory | null; severity: Severity; description: string; date_of_incident?: string | null; status: IncidentStatus; source?: string | null; escalate_to_writeup?: boolean | null; customer_name?: string | null; order_number?: string | null; is_driver_involved?: boolean | null; submitter_email?: string | null; subject_role?: string | null; attachments_count?: number | null; dismissed?: boolean | null; dismissed_at?: string | null; dismissed_by?: string | null; created_at?: string | null }
export interface WriteUp { source_ref: AirtableSourceRef; entity_id: string; employee_person_id: string; ladder: WriteUpLadder; level: WriteUpLevel; severity_recommendation?: WriteUpLevel | null; status: WriteUpStatus; ai_draft_status?: WriteUpAiDraftStatus | null; window_days: 90; dismissed: boolean; counts_toward_ladder: boolean; approved_by?: string | null; approved_at?: string | null; sent_at?: string | null; issued_at?: string | null; date_of_incident?: string | null; policy_violated?: string | null; description?: string | null; corrective_action?: string | null; linked_incident_id?: string | null; linked_calloff_ids?: string[]; emp_acknowledged?: boolean | null; ack_at?: string | null; email_sent?: boolean | null; ct_sent?: boolean | null; dismissed_at?: string | null; dismissed_by?: string | null; created_at?: string | null }
export interface CallOff { source_ref: AirtableSourceRef; entity_id: string; employee_person_id: string; type: CallOffType; reason?: CallOffReason | null; date: string; shift_start_time?: string | null; expected_arrival_time?: string | null; minutes_late?: number | null; notes?: string | null; doctors_note_attachment_present?: boolean | null; status: HrCallOffStatus; submitted_by?: string | null; team?: string | null; writeup_id?: string | null; dismissed?: boolean | null; dismissed_at?: string | null; dismissed_by?: string | null; created_at?: string | null }
export interface CloserReportCash { expected?: { amount?: Money | null; source?: CashExpectedSource | null } | null; counted_total?: Money | null; cash_total_calc?: Money | null; float_amount?: Money | null; safe_drop_amount?: Money | null; cash_dropped?: Money | null; deposit_variance?: Money | null; over_under?: CloserReportOverUnder | null }
export interface CloserReportCards { blaze_count?: number | null; blaze_total?: Money | null; lp_count?: number | null; lp_total?: Money | null; lp_status?: LpBlazeStatus | null; lp_audited?: boolean | null }
export interface CloserReportDiscrepancy { has_discrepancy?: boolean | null; type?: CloserReportDiscrepancyType | null; suspicious_bills?: boolean | null; damaged_inventory?: boolean | null; missing_accessories?: boolean | null; broken_hardware?: boolean | null; payment_discrepancy?: boolean | null }
export interface CloserReport { source_ref: AirtableSourceRef; entity_id: string; store_id?: string | null; mode: CloserReportMode; driver_person_id?: string | null; auditor_person_id?: string | null; region?: string | null; register?: string | null; shift_date: string; created_at?: string | null; cash?: CloserReportCash | null; cards?: CloserReportCards | null; discrepancy?: CloserReportDiscrepancy | null; severity?: Severity | null; status: CloserReportResolutionStatus; eos_incident_id?: string | null; response_deadline?: string | null; driver_response?: string | null; driver_response_at?: string | null; manager_decision?: ManagerDecision | null; manager_decision_by?: string | null; manager_decision_at?: string | null; lp_disposition?: LpDisposition | null; lp_disposition_by?: string | null; lp_disposition_at?: string | null; lp_owner?: string | null; amount_recovered?: Money | null; final_loss?: Money | null; pattern_flag?: boolean | null }
export interface LossLedgerEntry { source_ref: AirtableSourceRef; entity_id: string; person_id: string; store_id?: string | null; closer_report_id?: string | null; shift_date: string; final_loss: Money; amount_recovered: Money; net_loss: Money; reason_code?: CloserReportDiscrepancyType | null; disposition?: LpDisposition | null; window?: { lifetime?: Money | null; mtd?: Money | null; ytd?: Money | null } | null; high_risk?: boolean | null; recorded_at?: string | null }
export interface ContractError { error: { code: ErrorCode; message: string; details?: unknown } }
export interface ContractEvent<T = Record<string, unknown>> { event_id: string; type: EventType; contract: string; at: string; source: string; data: T }
export interface Validation { ok: boolean; errors: string[] }

export const VERSION: string;
export const HEADER: string;
export const ENUMS: Record<string, { values: string[]; source: string }>;
export const SCHEMAS: Record<string, unknown>;
export function enumValues(name: string): string[];
export function isEnum(name: string, value: unknown): boolean;
export function roleFrom(input: string | { role?: string; userRoles?: string[]; roles?: string[]; isSuperAdmin?: boolean } | null | undefined): Role;
export function roleAtLeast(role: unknown, need: Role): boolean;
export function isObjectId(s: unknown): boolean;
export function isUuidHex(s: unknown): boolean;
export function isSlug(s: unknown): boolean;
export function externalId(source: IdSource, id: string | number): ExternalId;
export function formatExternalId(x: ExternalId): string;
export function parseExternalId(s: string): ExternalId | null;
export function isCents(n: unknown): boolean;
export function assertCents(n: unknown, what?: string): number;
export function centsFromDollars(d: number | string): number;
export function dollarsFromCents(c: number): number;
export function money(cents: number, basis: MoneyBasis, currency?: 'USD'): Money;
export function isIsoUtc(s: unknown): boolean;
export function isBareDate(s: unknown): boolean;
export function isoNow(): string;
export function isoFromEpoch(n: number): string;
export function epochMsFromIso(s: string): number;
export function toIso(v: Date | number | string): string;
export function error(code: ErrorCode, message?: string, details?: unknown): ContractError;
export function httpStatus(code: ErrorCode): number;
export function errorFromLegacy(status: number, body: unknown): ContractError;
export function event<T>(type: EventType, data: T, opts?: { event_id?: string; at?: string; source?: string }): ContractEvent<T>;
export function canonicalJson(v: unknown): string;
export function signingPreimage(unixTs: number | string, body: unknown): string;
export function randomHex(bytes: number): string;
export function validate(schema: string | object, value: unknown): Validation;
export const RULE_FIELD_TYPE: Record<RuleField, RuleFieldType>;
export const RULE_LIMITS: { max_depth: number; max_nodes: number; max_group_items: number; max_bytes: number; max_list: number; max_string: number };
export const RULE_OPS_BY_TYPE: Record<RuleFieldType, RuleOp[]>;
export function validatePromotionRule(rule: unknown): Validation;
export const PII_CLASS: Record<string, PiiClass>;
