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

export interface ExternalId { source: IdSource; id: string }
export interface Money { cents: number; currency: 'USD'; basis: MoneyBasis }
export interface Store { id: string; name: string; platform: Platform; tz: string; pos: PosVendor; active: boolean; region_id?: string | null; external_ids?: ExternalId[] }
export interface Person { id: string; kind: PersonKind; display_name: string; role?: Role | null; classification?: Classification | null; store_id?: string | null; email?: string | null; phone?: string | null; external_ids?: ExternalId[]; verified?: boolean | null; created_at?: string | null }
export interface Product { id: string; platform: Platform; source: ProductSource; name: string; sku?: string | null; brand?: string | null; category?: string | null; price: Money; sale_price?: Money | null; quantity_on_hand?: number | null; external_ids?: ExternalId[] }
export interface OrderLine { product_id: string; name: string; brand?: string | null; category?: string | null; quantity: number; unit_price: Money; line_gross: Money; discount: Money }
export interface Order { id: string; platform: Platform; store_id: string; status: OrderStatus; txn_type: TxnType; ref_order_id?: string | null; customer_id?: string | null; associate_id?: string | null; created_at: string; completed_at?: string | null; subtotal: Money; discount: Money; tax?: Money | null; total: Money; lines?: OrderLine[]; external_ids?: ExternalId[] }
export interface Location { id: string; kind: LocationKind; name: string; address?: string | null; store_id?: string | null; region_id?: string | null; parent_id?: string | null; active?: boolean; capacity?: number | null }
export interface Batch { id: string; product_id: string; sku?: string | null; batch_no: string; metrc_tag?: string | null; packaged_at?: string | null; expires_at?: string | null; received_at: string; thc_pct?: number | null; unit_cost?: Money | null; quantity: number; location_id?: string | null; external_ids?: ExternalId[] }
export interface Movement { id: string; at: string; reason: MovementReason; product_id: string; batch_id: string; quantity: number; from_location_id?: string | null; to_location_id: string; tag_ids?: string[]; actor_id?: string | null; ref?: string | null; note?: string | null }
export interface ReceivedItem { id: string; received_at: string; kind: ArrivalKind; product_id: string; batch_id: string; quantity: number; location_id?: string | null; included_in?: string[]; reason?: PlanReason | null; premium?: boolean }
export interface PlanLine { product_id: string; batch_id: string; from_location_id?: string | null; to_location_id: string; sold: number; need: number; cap: number; give: number; reasons: PlanReason[]; mixed_batch?: boolean; note?: string | null; picked_by?: string | null; picked_at?: string | null; packed_by?: string | null; packed_at?: string | null; verified_by?: string | null; verified_at?: string | null; overridden_by?: string | null }
export interface Plan { id: string; kind: 'build' | 'refill' | 'restock' | 'handoff'; business_day: string; generated_at: string; channel: ChannelKind; store_id?: string | null; lines: PlanLine[]; skipped?: PlanLine[]; warnings?: string[]; inputs?: Record<string, unknown> | null; planned_by?: string | null; engine_version?: string | null; approved_by?: string | null; approved_at?: string | null }
export interface Standing { person: Person; metric: Metric; value: number; rank: number; tied?: boolean; earned?: Money | null; progress?: number | null }
export interface Contest { id: string; name: string; kind: ContestKind; status: ContestStatus; metric: Metric; audience: Classification[]; store_ids: string[]; starts_at?: string | null; ends_at?: string | null; prize?: Money | null }
export interface PointsEntry { id: string; person_id: string; kind: PointsKind; amount: Money; at: string; contest_id?: string | null; note?: string | null }
export interface VerificationSession { id: string; session_number?: number | null; status: VerificationStatus; channel: VerificationChannel; person_id?: string | null; reasons?: string[]; created_at: string; completed_at?: string | null; external_ids?: ExternalId[] }
export interface Task { id: string; order_id?: string | null; fleet_id?: string | null; status: TaskStatus; assignment_mode: TaskAssignmentMode; region_id?: string | null; created_at: string; total?: Money | null }
export interface Fleet { id: string; person_id: string; status: FleetStatus; verification_status: 'pending' | 'verified'; on_duty?: boolean; region_id?: string | null }
export interface Promotion { id: string; platform: Platform; name: string; codes?: string[]; status: PromotionStatus; rule_types: RuleType[]; starts_at?: string | null; ends_at?: string | null; usage_limit?: number | null; stackable?: boolean }
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
