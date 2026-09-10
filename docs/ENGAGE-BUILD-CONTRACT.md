# Engage build contract — for the four sibling backend agents

Source of truth: `docs/ENGAGE-PLAN-2026-09-10.md` §2–§4, §7 and `docs/ENGAGE-PROMPT-PROMO-SPEC.md`. This contract fixes every name, signature and table so the four of you can import each other's not-yet-written code and land in the same place. Deviating from a name/signature here requires updating this file first, in the same commit, with a one-line reason.

Scope: plan §8 Phases 1–3 (identity join, ledger, consent, trait catalog, rewards, audiences, documents/links, messages/policy, journeys). Promotions persistence (§8 Phase 4) is **out of scope** — `engage_promotions` is reserved (schema only, nothing reads or writes it yet).

Package: `wmdemo/engage/` (new). One module owns each table it creates. Every public function begins `ensure_schema()` (idempotent, per shells.py convention — NOT called once at import). Every multi-statement write goes through `with _lock, _dbshare.reuse_connection(atomic=True) as con:` (shells.py pattern, `_dbshare.py:175-242`) so the mutation and its audit row commit or roll back together. `_lock` is a module-level `threading.Lock()`, one per engage submodule that writes (mirrors `shells.py`/`ledger.py`).

---

## 1. Schema — `wmdemo/engage/schema.py`

One `SCHEMA_SQL` string, `CREATE TABLE IF NOT EXISTS` + inline `CREATE INDEX IF NOT EXISTS`, executed by `con.executescript(SCHEMA_SQL)` inside `ensure_schema()`. Additive columns later use the PRAGMA-guard pattern (`schema.py:539-547` in incentives), never bare `ALTER TABLE` and never `except OperationalError`.

**Conventions (match the estate, do not invent new ones):** money in cents (`*_cents INTEGER`) — points are plain `INTEGER` counts, not cents; timestamps `TEXT NOT NULL`, ISO UTC, written via `time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())`; JSON columns `TEXT`, suffixed `_json`, written via `json.dumps(..., sort_keys=True)`; every write-producing table that plan §7 requires an actor for carries `actor TEXT NOT NULL`; idempotency is a `UNIQUE` partial index `WHERE idempotency_key IS NOT NULL`, written via `INSERT OR IGNORE` then `SELECT ... WHERE idempotency_key=?` on a `rowcount == 0` conflict (rewards.py `record_paid`, `rewards.py:190-210`) — never SELECT-then-INSERT.

### 1.1 Two naming departures from the plan text — read before coding

- Plan §3 names a bare `events` table. **`wmdemo/store.py:88` already owns a table called `events`** (diagnostics: `kind auth|api|sync|webhook|order|reconcile`, `level ok|warn|error|alert`, `message`). A second `CREATE TABLE events` would either collide or silently repurpose that table. The domain-event stream below is named **`engage_domain_events`** instead. Do not use `events`.
- Plan §3 names a `promotions` table. **`wmdemo/store.py` already owns `internal_promos`** (`kind, amount, target, channels` — a different, narrower shape than plan's richer draft object). The plan's richer object is reserved below as **`engage_promotions`**, unwired, Phase 4. Do not touch `internal_promos` from this package.

### 1.2 Additive columns on `hw_identities` (owned by `store.py` — coordinate, don't just push)

`hw_identities` already has `dob` (`store.py:186-199`) — do not re-add it. Add only:

```sql
-- guarded ALTER, one per column, PRAGMA table_info(hw_identities) check first
ALTER TABLE hw_identities ADD COLUMN email_hash TEXT;
ALTER TABLE hw_identities ADD COLUMN favorite_store_id TEXT;
ALTER TABLE hw_identities ADD COLUMN timezone TEXT;
ALTER TABLE hw_identities ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE hw_identities ADD COLUMN external_ids_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE hw_identities ADD COLUMN created_source TEXT;
```

No plaintext `email` column — email is never stored, only its hash. `phone_e164` stays as-is (plaintext, owned by store.py, tier-1 match key); do not hash it — the match ladder needs exact plaintext comparison and changing that column is out of scope and would break `identity_match.py`.

### 1.3 Full DDL

```sql
-- Consent (append-only, hash-chained; consent.py is the only writer, INSERT only)
CREATE TABLE IF NOT EXISTS consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL,
  channel TEXT NOT NULL,            -- sms|email|push|wallet
  state TEXT NOT NULL,              -- granted|revoked|pending
  source TEXT NOT NULL,             -- pos|web|sms_reply|csr|import
  legal_text_sha TEXT, ip TEXT, ua TEXT, message_id INTEGER,
  prev_hash TEXT, row_hash TEXT NOT NULL, actor TEXT NOT NULL, at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_consents_customer ON consents(customer_id, channel, at);
CREATE TABLE IF NOT EXISTS suppressions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, channel TEXT NOT NULL,
  reason TEXT NOT NULL,             -- bounce|complaint|stop|manual
  actor TEXT, at TEXT NOT NULL,
  UNIQUE(customer_id, channel)      -- upsert: one live suppression per channel
);

-- Loyalty
CREATE TABLE IF NOT EXISTS loy_programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'points',
  earn_rules_json TEXT NOT NULL DEFAULT '[]', expiry_policy_json TEXT NOT NULL DEFAULT '{}',
  tier_policy_json TEXT NOT NULL DEFAULT '{}', active INTEGER NOT NULL DEFAULT 1,
  actor TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS loy_tiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, program_id INTEGER NOT NULL,
  name TEXT NOT NULL,               -- bronze|silver|gold|platinum (LoyaltyTier)
  entry_rule_json TEXT NOT NULL, maintain_rule_json TEXT NOT NULL,
  grace_days INTEGER NOT NULL DEFAULT 0, benefits_json TEXT NOT NULL DEFAULT '[]',
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_loy_tiers_program ON loy_tiers(program_id, sort);
CREATE TABLE IF NOT EXISTS loy_tier_memberships (
  customer_id INTEGER PRIMARY KEY,  -- one CURRENT tier row per customer; history via loy_ledger/engage_domain_events
  tier_id INTEGER NOT NULL,
  state TEXT NOT NULL,              -- earning|qualifying|maintaining|grace|degrading
  since TEXT NOT NULL, evaluated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS loy_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL,
  delta INTEGER NOT NULL,           -- points, signed
  currency TEXT NOT NULL DEFAULT 'points', reason TEXT NOT NULL,
  state TEXT NOT NULL,              -- pending|active|spent|expired|canceled
  source_type TEXT NOT NULL,        -- pos_sale|contract_order|redeem|adjust|refund|expire
  source_ref TEXT, store_id TEXT, channel TEXT, expires_at TEXT,
  created_at TEXT NOT NULL, actor TEXT NOT NULL, idempotency_key TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_loy_ledger_idem ON loy_ledger(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loy_ledger_customer ON loy_ledger(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_loy_ledger_expiry ON loy_ledger(state, expires_at);
CREATE TABLE IF NOT EXISTS loy_wallet (
  customer_id INTEGER PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,   -- cache; loy_ledger SUM is truth
  pending INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, reconciled_at TEXT
);
CREATE TABLE IF NOT EXISTS loy_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT, program_id INTEGER NOT NULL, name TEXT NOT NULL,
  kind TEXT NOT NULL,               -- pct|amount|free_product|bonus_points|perk
  value_json TEXT NOT NULL, cost_points INTEGER NOT NULL,
  eligibility_rule_json TEXT NOT NULL DEFAULT '{}', stores_json TEXT NOT NULL DEFAULT '[]',
  channels_json TEXT NOT NULL DEFAULT '[]',
  stock INTEGER, per_customer_cap INTEGER, window_days INTEGER,
  active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0, actor TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_loy_rewards_program ON loy_rewards(program_id, active);
CREATE TABLE IF NOT EXISTS loy_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, reward_id INTEGER NOT NULL, customer_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,              -- issued|applied|expired|refunded
  store_id TEXT, channel TEXT, order_ref TEXT,
  ledger_id INTEGER,                -- the loy_ledger row this redemption debited
  idempotency_key TEXT, issued_at TEXT NOT NULL, applied_at TEXT, expires_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_loy_redemptions_idem ON loy_redemptions(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loy_redemptions_customer ON loy_redemptions(customer_id, state);
CREATE TABLE IF NOT EXISTS referral_programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  referrer_reward_json TEXT NOT NULL, referee_reward_json TEXT NOT NULL,
  qualify_rule_json TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT, program_id INTEGER NOT NULL, code TEXT NOT NULL UNIQUE,
  referrer_id INTEGER NOT NULL, referee_id INTEGER,
  state TEXT NOT NULL,              -- pending|qualified|rewarded|void
  risk_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, qualified_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

-- Audiences
CREATE TABLE IF NOT EXISTS audiences (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, rule_json TEXT NOT NULL,
  mode TEXT NOT NULL,               -- dynamic|static
  size INTEGER, size_at TEXT, refresh_s INTEGER, created_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audience_members (
  audience_id INTEGER NOT NULL, customer_id INTEGER NOT NULL, computed_at TEXT NOT NULL,
  PRIMARY KEY (audience_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_audience_members_customer ON audience_members(customer_id);

-- Documents / landing pages / links
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,               -- email|landing|section
  name TEXT NOT NULL,
  doc_json TEXT NOT NULL,           -- {blocks:[{type,props,children}], theme, merge_tags_required}
  version INTEGER NOT NULL DEFAULT 1, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS landing_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, document_id INTEGER NOT NULL, slug TEXT NOT NULL UNIQUE,
  gate_enabled INTEGER NOT NULL DEFAULT 0,   -- plan R4: default off
  gate_min_age INTEGER NOT NULL DEFAULT 21, gate_states_json TEXT NOT NULL DEFAULT '[]',
  footer_policy TEXT, status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

-- Messages / journeys
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, journey_id INTEGER, node_id INTEGER,
  campaign_name TEXT NOT NULL,
  channel TEXT NOT NULL,            -- sms|email|push|wallet
  template_doc_id INTEGER, sms_body_template TEXT, audience_id INTEGER,
  schedule_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',  -- draft|scheduled|queued|sending|sent|paused
  created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_journey ON messages(journey_id, node_id);
CREATE TABLE IF NOT EXISTS message_sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT, message_id INTEGER NOT NULL, customer_id INTEGER NOT NULL,
  channel TEXT NOT NULL, provider TEXT, provider_id TEXT,
  state TEXT NOT NULL,   -- queued|held|blocked|sent|delivered|failed|opened|clicked|converted
  verdicts_json TEXT NOT NULL DEFAULT '[]',
  hold_until TEXT, sent_at TEXT, delivered_at TEXT, idempotency_key TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_message_sends_idem ON message_sends(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_sends_message ON message_sends(message_id, state);
CREATE INDEX IF NOT EXISTS idx_message_sends_customer ON message_sends(customer_id);
CREATE TABLE IF NOT EXISTS links (
  token TEXT PRIMARY KEY,           -- 10-char random, plan §7
  send_id INTEGER,                  -- message_sends.id
  landing_page_id INTEGER NOT NULL, customer_id INTEGER, expires_at TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0, first_click_at TEXT, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_links_send ON links(send_id);
CREATE TABLE IF NOT EXISTS journeys (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft|live|paused|archived
  trigger_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS journey_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, journey_id INTEGER NOT NULL,
  kind TEXT NOT NULL,               -- trigger|wait|branch|message|loyalty|exit
  props_json TEXT NOT NULL DEFAULT '{}', x REAL, y REAL
);
CREATE INDEX IF NOT EXISTS idx_journey_nodes_journey ON journey_nodes(journey_id);
CREATE TABLE IF NOT EXISTS journey_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT, journey_id INTEGER NOT NULL,
  from_node INTEGER NOT NULL, to_node INTEGER NOT NULL, label TEXT
);
CREATE INDEX IF NOT EXISTS idx_journey_edges_journey ON journey_edges(journey_id, from_node);
CREATE TABLE IF NOT EXISTS journey_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, journey_id INTEGER NOT NULL,
  node_id INTEGER,
  state TEXT NOT NULL,              -- active|waiting|exited|errored
  wake_at TEXT, entered_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(customer_id, journey_id)   -- one concurrent enrollment per customer per journey
);
CREATE INDEX IF NOT EXISTS idx_journey_runs_wake ON journey_runs(state, wake_at);

-- Traits and derived parameters
CREATE TABLE IF NOT EXISTS customer_traits (
  customer_id INTEGER PRIMARY KEY, lifetime_orders INTEGER NOT NULL DEFAULT 0,
  lifetime_spend_cents INTEGER NOT NULL DEFAULT 0, last_order_at TEXT,
  order_freq_median_days REAL,
  freq_drop_ratio REAL,             -- the "ordering less often" trigger
  aov_cents INTEGER, favorite_store_id TEXT, favorite_category TEXT, favorite_brand TEXT,
  points INTEGER NOT NULL DEFAULT 0, tier TEXT,
  consent_sms TEXT, consent_email TEXT, consent_push TEXT, consent_wallet TEXT,
  days_to_birthday INTEGER, referral_count INTEGER NOT NULL DEFAULT 0, churn_risk TEXT,
  computed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS derived_parameters (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
  source_field TEXT NOT NULL, expression TEXT NOT NULL,
  type TEXT NOT NULL,               -- number|string|bool|date
  created_by TEXT NOT NULL, created_at TEXT NOT NULL
);

-- Events
CREATE TABLE IF NOT EXISTS engage_domain_events (   -- analytics/journey-trigger stream (plan §3 "events", renamed, §1.1)
  id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL,
  customer_id INTEGER, store_id TEXT, channel TEXT, ref TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}', at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_engage_domain_events_type ON engage_domain_events(type, at);
CREATE INDEX IF NOT EXISTS idx_engage_domain_events_customer ON engage_domain_events(customer_id, at);
CREATE TABLE IF NOT EXISTS engage_events (          -- operator-write audit, shell_events shape
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, kind TEXT NOT NULL, entity_id TEXT,
  actor TEXT NOT NULL, before_json TEXT, after_json TEXT, detail TEXT
);
CREATE INDEX IF NOT EXISTS idx_engage_events_kind ON engage_events(kind, ts);

-- Reserved, Phase 4, unwired (§1.1)
CREATE TABLE IF NOT EXISTS engage_promotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, code TEXT,
  status TEXT NOT NULL DEFAULT 'draft', rule_json TEXT NOT NULL, action_json TEXT NOT NULL,
  stores_json TEXT NOT NULL DEFAULT '[]', channels_json TEXT NOT NULL DEFAULT '[]',
  stackable INTEGER NOT NULL DEFAULT 0, priority INTEGER NOT NULL DEFAULT 0,
  usage_limit INTEGER, per_customer_limit INTEGER, starts_at TEXT, ends_at TEXT,
  audience_id INTEGER, prompt TEXT, interpretation_json TEXT, actor TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
```

Channel scope value everywhere above (`channel` columns, `channels_json` contents): `in_store|delivery|pickup|web` (plan §2/§4). This is **not yet** a contracts/index.js enum — it is not `NotificationChannel` (that's sms/email/push/wallet, the *send* channel). Validate locally against a Python tuple in `engage/rules.py` (`REDEMPTION_CHANNELS`); flag adding a `RedemptionChannel` enum to `contracts/index.js` as a compat-doc gap (§6 of the plan), do not block on it.

---

## 2. Module split — file, owner responsibility, exported signatures

Every function takes `actor: str` explicitly where it writes (no implicit `OPERATOR_EMAIL` fallback — follow `shells_api.py`'s newer convention, not `incentives/serve.py`'s older one). Manager gate: `is_manager(actor)` = `wmdemo.incentives.contests.is_manager(actor)` (the estate's one source of truth — shells_api.py already reuses it this way). A small shared `engage/errors.py` (not one of the eleven assignments below, write it once, first) defines `EngageError(msg, code)`, `NotFound(EngageError)`, `Conflict(EngageError)`, `InsufficientBalance(EngageError)` — same shape as `shells.py`'s `ShellError`/`NotFound`/`Conflict`; `engage/api.py` maps them to 4xx exactly like `shells_api.py:_error_status`.

### `engage/identity.py`
```python
def resolve_customer(sale_or_order: dict, actor: str) -> int | None
    # Builds identity_match.subject(...) from whatever the sale/order carries
    # (phone, first/last/dob if present, wm_id), fetches candidates the same
    # way checkin.bind already does, calls identity_match.match(subject,
    # candidates), returns identity_match.answer(verdict)["id"] or None.
    # Never invents a candidate; "no_match"/"undetermined"/"ambiguous" -> None.
def attach_external_id(customer_id: int, source: str, id_: str, actor: str) -> bool
    # source validated against contracts IdSource values. Read-modify-write
    # hw_identities.external_ids_json: replace existing entry for that source,
    # else append. Runs inside _lock + reuse_connection(atomic=True).
```

### `engage/ledger.py`
```python
def earn(customer_id, delta, reason, source_type, source_ref, store_id, channel,
          actor, idempotency_key, expires_at=None) -> dict         # {ledger_id, replayed, balance}
def redeem(customer_id, delta, reason, source_type, source_ref, store_id, channel,
            actor, idempotency_key) -> dict                         # delta negated internally; raises InsufficientBalance
def adjust(customer_id, delta, reason, actor, idempotency_key, source_ref=None) -> dict
def refund(ledger_id, actor, idempotency_key) -> dict               # writes a paired opposite-sign entry, never mutates the original row
def balance(customer_id) -> dict                                    # {balance, pending, expiring: [...], history: [...]}
def expire_sweep(now=None, actor="system") -> dict                  # {swept, customer_count}, FIFO by expires_at, hourly trigger
def reconcile(customer_id=None, actor="system") -> dict             # recomputes loy_wallet.balance = SUM(loy_ledger.delta WHERE state='active'); all customers if None
```
All four writers: `INSERT OR IGNORE ... idempotency_key` into `loy_ledger`,
`rowcount==0` -> `SELECT` existing row, return `replayed: True`; else update
`loy_wallet` and insert `engage_events` in the same atomic block.

### `engage/consent.py`
```python
def record(customer_id, channel, state, source, actor, legal_text=None, ip=None, ua=None, message_id=None) -> dict
    # INSERT only. row_hash = sha256(prev_hash + customer_id + channel + state + at);
    # prev_hash = latest row_hash for (customer_id, channel) or "" (genesis).
def state(customer_id, channel) -> str                              # latest state, "unknown" if no row
def inbound_sms(from_phone: str, body: str, actor="sms_reply") -> dict
    # Parses STOP/HELP/START (case-insensitive, trimmed). STOP -> suppressions
    # upsert + consents record(state="revoked"). START -> consents record
    # (state="granted") + suppressions delete for sms. HELP -> no state change,
    # returns a help-text marker for msg_adapter to relay.
def inbound_email(payload: dict, kind: str, actor="email_webhook") -> dict
    # kind: "bounce"|"complaint". Always suppresses email; complaint also
    # revokes consent.
def suppressed(customer_id, channel) -> bool
```

### `engage/rules.py`
```python
TRAIT_CATALOG: dict[str, dict]   # local_path -> {type, source: customer|order|cart|product|time|store, production_alias}
ALIASES: dict[str, str]          # local_path -> production promotion-engine attribute name
    # cart_total, days_since_last_purchase, purchase_count, loyalty_tier,
    # upcoming_birthday, category_id, product_brand, ... (plan §2)
REDEMPTION_CHANNELS = ("in_store", "delivery", "pickup", "web")
def validate(rule: dict, kind: str) -> list[str]
    # kind: "audience"|"earn"|"reward"|"promotion"|"journey_branch". Walks
    # {path, op, value} / $and / $or; every path must resolve in TRAIT_CATALOG
    # (or derived_parameters); every op in {$gte,$gt,$lte,$lt,$eq,$ne,$in,$nin,
    # $within_days}. Returns [] when valid, else a list of error codes
    # (never raises — callers decide 400 vs inline UI error).
def evaluate(rule: dict, subject_context: dict) -> bool
    # Pure. No DB access, no SQL generation — reads subject_context only.
def register_derived_parameter(name, source_field, expression, type_, actor) -> dict
    # Inserts into derived_parameters; re-validates every rule referencing it
    # is not required here (traits.py picks it up on next compute).
```

### `engage/traits.py`
```python
def compute_for_customer(customer_id, now=None) -> dict             # writes customer_traits row, returns it
def compute_order_frequency_drop(customer_id, now=None) -> float | None
    # ratio of most-recent inter-order gap to median historical gap; None
    # with < 3 orders.
def nightly_sweep(now=None, actor="system") -> dict                 # {computed, errors}; every customer with >=1 order
def on_event(event_type: str, customer_id: int, payload: dict) -> None
    # incremental recompute hook, called from api.py after order.completed,
    # points.earned/redeemed, consent.changed, tier.changed
```

### `engage/rewards.py`
```python
def usable(customer_id, store_id, channel) -> list[dict]
    # loy_rewards WHERE active AND channel in channels_json AND store in
    # stores_json (or empty=all), rules.evaluate(eligibility_rule_json,...),
    # cost_points <= balance, per_customer_cap not exceeded, stock != 0.
def redeem(reward_id, customer_id, store_id, channel, order_ref, actor, idempotency_key) -> dict
    # Atomic: decrement loy_rewards.stock (if not null, floor 0, else 409),
    # ledger.redeem(...), loy_redemptions INSERT OR IGNORE on idempotency_key,
    # all inside one reuse_connection(atomic=True) block.
def refund(redemption_id, actor, idempotency_key) -> dict
    # Atomic: ledger.refund(redemption's ledger_id, ...), restore stock,
    # loy_redemptions.state = "refunded".
```

### `engage/documents.py`
```python
BLOCK_TYPES = ("heading","text","image","button","divider","spacer","columns",
               "product_card","reward_card","points_balance","legal_footer","gate")  # <= 12, plan §2
def render(doc: dict, ctx: dict, mode: str) -> str      # mode: "email"|"landing"; table HTML for email, responsive HTML for landing
def merge_tags(doc: dict) -> list[str]                  # scans doc_json for {{tag}} tokens
def validate_doc(doc: dict) -> list[str]                # unknown block type, or a merge tag not resolvable in ctx
```

### `engage/links.py`
```python
def mint(send_id, landing_page_id, customer_id, ttl_days=30, actor="system") -> str
    # 10-char random token (plan §7), single-recipient, links row INSERT.
def resolve(token: str) -> dict | None                  # {landing_page_id, customer_id, expired: bool}
def register_click(token: str, method: str) -> None
    # method == "HEAD" -> no-op (plan §7: HEAD ignored for clicks).
    # method == "GET"  -> clicks += 1; first_click_at set only if NULL.
```

### `engage/policy.py`
```python
def check(message: dict, customer: dict) -> list[dict]
    # Ordered verdict chain, each a row {step, result: allow|hold|block, why}:
    # identity -> suppression -> consent -> gate/geo -> frequency_cap (4/7d,
    # 20/30d per channel) -> quiet_hours (8am-8pm recipient local, HOLD not
    # block) -> content_policy (SMS body template only; no cannabis words,
    # price, imagery) -> provider. Every step runs and is recorded even after
    # a block (plan §2: "verdicts are rows; nothing is silent").
def verdict_allows_send(verdicts: list[dict]) -> bool    # False if any step is "block"; "hold" -> caller sets message_sends.hold_until
```
Persist the return of `check()` verbatim into `message_sends.verdicts_json`.

### `engage/msg_adapter.py`
```python
class Adapter:
    def send(self, message: dict, send_ctx: dict) -> dict     # {provider_id, status}
    def status(self, provider_id: str) -> dict
    def inbound(self, payload: dict) -> dict                  # signature-verified before this is called
class NullAdapter(Adapter):
    # Records into message_sends as state="sent", provider="null",
    # provider_id="null:<uuid>" instead of calling out. Default when no
    # provider key configured — same posture as llm_adapter.NoModel, but
    # msg_adapter always has a usable adapter (Null), it never raises.
def get_adapter(channel: str) -> Adapter
    # channel "sms" -> Twilio-compatible REST via urllib if TWILIO_* env set,
    # else NullAdapter. channel "email" -> SendGrid v3 if SENDGRID_* env set,
    # else NullAdapter. Same env-gated shape as llm_adapter.provider().
```

### `engage/api.py`
Every route below: `handler(handler_obj, path_segments, body_or_q, actor) ->
(status_code, response_dict)`. `engage/serve.py` catches `EngageError` subclasses
and maps to status; unhandled exceptions -> 500 (never silently 200).

| Method | Path | Body | Response | Status | Gate |
|---|---|---|---|---|---|
| GET | `/api/engage/customers` | `?query&audience&store` | `[{id, name, phone, tier, balance}]` | 200 | write-token N/A (GET) |
| POST | `/api/engage/customers/<id>` | `{edit\|merge\|tags}` | updated record | 200/404 | write-token |
| GET | `/api/engage/customers/<id>` | — | `{identity, external_ids, consent, wallet, tier, rewards_usable:{here,delivery,in_store}, orders, audiences, messages, referrals}` | 200/404 | — |
| POST | `/api/engage/consent` | `{customer_id, channel, state, source, legal_text}` | consent row | 200/400 | write-token |
| POST | `/api/engage/inbound/sms` | provider webhook payload | `{}` | 200/401 | signature check, not write-token |
| POST | `/api/engage/inbound/email` | provider webhook payload | `{}` | 200/401 | signature check |
| POST | `/api/engage/points/earn` | `{customer_id, delta, reason, source_ref, store_id, channel, idempotency_key}` | `{ledger_id, balance}` | 200/400/409 | write-token |
| POST | `/api/engage/points/redeem` | same shape | `{ledger_id, balance}` | 200/400/409/422(insufficient) | write-token |
| POST | `/api/engage/points/adjust` | same shape | `{ledger_id, balance}` | 200/400/403 | write-token + manager |
| GET | `/api/engage/points/<customer_id>` | — | `{balance, expiring, history}` | 200/404 | — |
| GET/POST | `/api/engage/loyalty/programs` \| `/tiers` \| `/rewards` | reward/tier/program fields | row(s) | 200/400/403 | write-token; POST manager |
| GET | `/api/engage/loyalty/rewards/usable` | `?customer_id&store_id&channel` | `[reward...]` | 200 | — (register + web call this) |
| POST | `/api/engage/loyalty/redeem` | `{reward_id, customer_id, store_id, channel, order_ref, idempotency_key}` | `{redemption_id, code}` | 200/409/422 | write-token |
| POST | `/api/engage/loyalty/redeem/refund` | `{redemption_id, idempotency_key}` | `{redemption_id}` | 200/404/409 | write-token |
| GET/POST | `/api/engage/audiences` | `{name, rule, mode}` | audience row | 200/400 | write-token |
| POST | `/api/engage/audiences/preview` | `{rule}` | `{size, sample[5], rationale}` | 200/400 | — (read-only eval) |
| POST | `/api/engage/audiences/from-prompt` | `{prompt}` | `{rule, sentence, size}` | 200/400/501(no model) | write-token; `llm_adapter`, rule always `rules.validate`d, never raw SQL |
| GET/POST | `/api/engage/documents` | `{kind, name, doc}` | document row | 200/400 | write-token |
| POST | `/api/engage/documents/<id>/render` | `{customer_id?}` | `{html}` | 200/404 | — |
| GET/POST | `/api/engage/landing-pages` | landing_page fields | row | 200/400 | write-token |
| GET/HEAD | `/l/<token>` | — | rendered HTML (GET) / headers only (HEAD) | 200/404/410(expired) | **public, no write-token, rate-limited** |
| GET/POST | `/api/engage/messages` | message fields | row | 200/400 | write-token |
| POST | `/api/engage/messages/<id>/check` | — | `{consent_coverage, holds, blocks}` | 200/404 | — |
| POST | `/api/engage/messages/<id>/test-send` | `{to}` | `{provider_id, status}` | 200/404 | write-token |
| POST | `/api/engage/messages/<id>/send` | `{idempotency_key}` | `{queued: n}` | 200/403/404 | write-token + manager |
| GET/POST | `/api/engage/journeys` | journey fields | row | 200/400 | write-token |
| POST | `/api/engage/journeys/<id>/activate` \| `/pause` | — | `{status}` | 200/403/404 | write-token + manager |
| GET | `/api/engage/journeys/<id>/report` | — | counts per node | 200/404 | — |
| POST | `/api/engage/parameters` | `{name, source_field, expression, type}` | derived_parameters row | 200/400/403 | write-token + manager |
| POST | `/api/engage/import/alpine` | `{kind, dry_run}` | run-report shape (see §4) | 200/400 | write-token |
| GET | `/api/engage/insights` | `?range` | 4 numbers + 1 list per section | 200 | — |

`/api/promos/*` (from-prompt, internal, eligible) stay owned by `promos.py`, not
`engage/api.py` — out of scope here (§1.1).

### `engage/serve.py`
```python
def handle_get(handler, path, q) -> bool
def handle_post(handler, path, body) -> bool
```
Registered exactly like `shells_api.py`: import `from . import engage_serve` (or
`from .engage import serve as engage_serve`) near `server.py:90-95`; add
**two** `elif` branches to `_dispatch_GET`/`_dispatch_POST` (`server.py:2223`,
`server.py:3646` are the shells/incentives precedent lines) — one
`self.path.startswith("/api/engage")`, one `self.path.startswith("/l/")` (the
public route; must sit above the write-token gate check, which only runs inside
`_dispatch_POST` and therefore already never touches GET/HEAD).

**`do_HEAD` does not exist in `server.py` today** (`grep -n "def do_HEAD"` — zero
hits). It must be added: a `do_HEAD` method that calls the same dispatch as
`do_GET` for `/l/<token>` only, with `links.register_click(token, "HEAD")`
short-circuiting to a no-op and no body written. This is a `server.py` core
change, not a module-internal one — call it out in the PR, one line, one place.

---

## 3. Events emitted into `engage_domain_events` (`type`, key `payload_json` fields)

| type | emitted by | payload keys |
|---|---|---|
| `order.completed` | api.py (POST /api/pos/sale or /api/contracts/orders hook) | `order_id, total_cents, store_id, channel` |
| `cart.abandoned` | (not built this phase; reserved) | `cart_id, total_cents` |
| `points.earned` | `ledger.earn` | `ledger_id, delta, reason, source_ref` |
| `points.redeemed` | `ledger.redeem`, `rewards.redeem` | `ledger_id, delta, reward_id?` |
| `tier.changed` | traits.py tier evaluation | `from_tier, to_tier` |
| `consent.changed` | `consent.record`, `inbound_sms`, `inbound_email` | `channel, state, source` |
| `message.sent` | `msg_adapter` post-send, via `api.py` | `send_id, message_id, channel, provider` |
| `message.clicked` | `links.register_click` (GET only) | `token, send_id` |
| `referral.qualified` | (not built this phase; reserved) | `referral_id, referrer_id, referee_id` |

Every operator-initiated write (not customer/system events above) additionally
gets one `engage_events` row: `_event(con, kind, entity_id, actor, before, after,
detail)`, same shape and same-transaction insert as `shells.py:_event`
(`shells.py:133-144, 196-203`).

---

## 4. Fixture rules — no exceptions

- **No PII in any fixture, ever.** Phones: never store a raw digit string as a
  fixture value — either omit, or run it through the *real* writer
  (`identity.resolve_customer` / `store.upsert_identity`) which already stores
  `phone_e164` the way production would; do not hand-craft a phone column value.
  Emails: only `email_hash` exists as a column — never write a plaintext email
  anywhere, including in test bodies, logs, or probe assertions.
- **Synthetic customers only.** Every seeded identity must be producible by a
  real code path (`demo_seed_identities.py`'s own rule, `demo_seed_identities.py`
  header comment: "IT WRITES NOTHING BY HAND... a seeded row that no production
  code path could produce is a lie that passes QA and fails in production").
  Apply the same discipline to engage fixtures: seed through
  `identity.resolve_customer`, `ledger.earn`, `consent.record`, never direct
  `INSERT`.
- **Hash namespacing.** If a probe needs a stable "known" hash to look up a
  synthetic customer, prefix it (`synthetic:<sha256>`) so it can never collide
  with or be mistaken for a real `gov_id_hash` — same non-comparable-namespace
  discipline as `doc:`/`url:` in `verify.py`.
- **Real store ids only.** Use `wmdemo.incentives.stores.ids(active_only=True)`
  (the auto-expanding registry — `stores.py:279`), which seeds from the same
  five slugs `associates.STORES` already uses: `elsinore, west-la, long-beach,
  corona, riverside`. Never invent a store id (no `"store-1"`, no `"demo-store"`).
- **No PRNG numbers presented as real.** Where a number can't yet be computed
  from real rows (e.g. `insights` before any real sends exist), the API returns
  `null`/`0` with a `"not_enough_data"` flag — never a random plausible-looking
  number ("honest zero over fabricated number", plan §0).

---

## 5. Per-module probes — `qa/engage_<module>_probe.py`

Follow `qa/shells_probe.py`'s convention: claim a scratch DB via
`qa/_dbsafe.claim_scratch()` before importing `wmdemo`, drive the module by
direct function call (not HTTP) except `engage_api_probe.py` which drives HTTP
via `qa/_wm_base.py` (mirrors the HTTP-style probes). Print `PASS <ID> <detail>`
/ `FAIL <ID> <detail>` lines, IDs `EN-<letter><n>`, `main()` returns pass/fail
count, `sys.exit(main())`. Add every new probe file's basename to `SUITES` in
`qa/battery.py:177`, and add an `EN-x` section to `docs/SCOREBOARD.md` in the
existing table format.

| Probe | Must prove |
|---|---|
| `engage_identity_probe.py` | `resolve_customer` never invents a candidate (undetermined/ambiguous -> None); `attach_external_id` dedupes by source (second call for same source replaces, doesn't duplicate); a sale with no matchable signal returns None, not a guess |
| `engage_ledger_probe.py` | same `idempotency_key` replayed twice produces one ledger row and identical returned balance (`replayed: True` on 2nd); `redeem` past balance raises `InsufficientBalance`, writes nothing; `expire_sweep` is FIFO (oldest `expires_at` swept first) and idempotent (running twice sweeps nothing new the 2nd time); `reconcile` recomputed balance equals `SUM(delta WHERE state='active')` exactly |
| `engage_consent_probe.py` | row_hash chain unbroken across N inserts for one (customer,channel) (`row[i].prev_hash == row[i-1].row_hash`); no UPDATE/DELETE statement anywhere in `consent.py` (grep the module source in the probe itself); `inbound_sms("STOP")` suppresses + revokes in one call; `START` after `STOP` un-suppresses |
| `engage_rules_probe.py` | `validate` rejects a path not in `TRAIT_CATALOG`/`derived_parameters`; `evaluate` never touches a DB connection (pass a plain dict, assert no `sqlite3` import triggered — or inspect via `inspect.signature`/no side effects); every `ALIASES` value is a string (importable by a JS drift test later) |
| `engage_traits_probe.py` | `compute_order_frequency_drop` returns `None` for <3 orders, a ratio >1 for a customer whose gap widened; `nightly_sweep` touches every customer with >=1 order and none with zero; `on_event` incremental update matches a full `compute_for_customer` recompute (no drift) |
| `engage_rewards_probe.py` | `usable` excludes a reward whose `cost_points` exceeds balance; `redeem` is atomic — kill the process (or raise) mid-transaction via a monkeypatch and assert stock/ledger/redemption are all-or-nothing (table hash before == table hash after on the injected failure); double-redeem with same `idempotency_key` returns the same `redemption_id` |
| `engage_documents_probe.py` | `render` output contains no unresolved `{{tag}}`; a doc using a 13th/unknown block type fails `validate_doc`; email-mode output is table-based HTML (assert `<table` present), landing-mode is not required to be |
| `engage_links_probe.py` | HEAD does not increment `clicks`; two GETs increment `clicks` to 2 but `first_click_at` unchanged after the first; `resolve` on an expired token reports `expired: True` and `register_click` is a no-op on it |
| `engage_policy_probe.py` | a customer with no consent row for the channel yields a `block` verdict at the `consent` step, and every later step still runs and is recorded; quiet-hours violation yields `hold`, not `block`; 5th SMS in 7 days is `block` (4/7d cap) |
| `engage_msg_adapter_probe.py` | with no provider env vars set, `get_adapter("sms")`/`get_adapter("email")` both return `NullAdapter`, and `NullAdapter.send` writes a `message_sends` row with `provider="null"` rather than raising or making any network call (assert via `urllib`/`socket` monkeypatch that nothing was opened) |
| `engage_api_probe.py` | every route in the §2 table returns the documented status for both a valid and an invalid call; POST with no `x-hw-write-token` in `WM_DEMO_PUBLIC` mode returns 403 for every `/api/engage/*` write route; a manager-gated route (`points/adjust`, `loyalty/rewards` POST, `messages/send`, `journeys/activate`) returns 403 for a non-manager actor and succeeds for one `contests.is_manager` accepts |

---

## 6. Security checklist — plan §7, mapped to concrete checks

| §7 requirement | Concrete check (who enforces, what proves it) |
|---|---|
| Auth on every write (token now) | `server.py`'s existing `_dispatch_POST` write-token gate already covers `/api/engage/*` — `engage/serve.py` adds no bypass; `engage_api_probe.py` asserts 403 with no/bad token |
| Manager-only: ledger adjust, reward config, sends, journey activation | `engage/api.py` calls `contests.is_manager(actor)` before those four route groups, same as `shells_api.py:_is_manager` |
| Idempotency keys on every money/points write | `loy_ledger`, `loy_redemptions`, `message_sends` each carry a partial-UNIQUE `idempotency_key` index; `engage_ledger_probe.py`/`engage_rewards_probe.py` prove replay-safety |
| Append-only consent, hash chain | `consent.py` contains only `INSERT` statements against `consents` (grep-enforced in `engage_consent_probe.py`); chain verified per (customer,channel) |
| PII at rest hashed where a hash suffices | no plaintext email column anywhere (`email_hash` only); `phone_e164` stays plaintext by design (match-ladder requirement, pre-existing, out of scope) — do not add a second plaintext PII column anywhere in `engage/` |
| Landing-page tokens: 10-char random, single-recipient, expiring | `links.mint` signature enforces `ttl_days`; token generation uses `secrets.token_urlsafe`-derived 10 chars, not `random`/`uuid4` truncated (cryptographic RNG) |
| HEAD ignored for clicks | `links.register_click(token, "HEAD")` no-ops; `do_HEAD` added to `server.py` specifically so HEAD requests reach that no-op instead of falling through to `do_GET`'s counting path |
| Inbound webhooks signature-checked | `engage/api.py`'s `/api/engage/inbound/sms` and `/inbound/email` verify the provider signature header (Twilio `X-Twilio-Signature`, SendGrid signed-webhook) **before** calling `consent.inbound_sms`/`inbound_email` — unsigned/invalid -> 401, no DB write; mirror `idv_webhooks.py`'s existing signature-check shape in this repo |
| Rate limits on public routes (`/l/`, inbound) | a simple fixed-window counter (in-process dict keyed by `(ip, path, window_start)`, no new table needed at this scale) in `engage/serve.py`'s `/l/` and inbound handlers; over-limit -> 429 |
| No raw SQL from prompts; rules validated against catalog | `audiences/from-prompt` and any future prompt-to-rule path: LLM output is JSON only, passed through `rules.validate()` before it is ever persisted or evaluated; a rule that fails validation is never saved, returned to the caller as `missing_parameters`/error codes instead |
| Provider keys only in `.env` | `msg_adapter.py` reads `os.environ` only, never a DB row, never logs a key value; `describe()`-style function (mirroring `llm_adapter.describe()`) may expose provider name/configured bool, never the key |
| Audit row on every operator write | every mutating `engage/*` function's atomic block includes an `engage_events` insert in the same transaction (§3) |

---

## 7. Before any push (owner ruling, plan §8, restated as a gate)

Do not push if any of these is true:
1. A demo tenant name (`Green Leaf Collective`, `Oaktown Dispensary`, `Harbor
   Cannabis Co.`) or the tenant switcher / `TENANT`/`TENANTS` / "Provision new
   tenant" affordance still exists anywhere touched by this build.
2. Any store id in code, fixtures, or seeded rows is not one of
   `stores.ids(active_only=True)` (currently `elsinore, west-la, long-beach,
   corona, riverside`, or whatever the registry has auto-expanded to at push
   time — re-read it, don't hardcode the list from this document).
3. Any customer row did not come from `hw_identities` via a real writer, any
   order/points number did not derive from `pos_sales`/contract orders/
   `loy_ledger`, or any product reference did not come from the real catalogue.
4. A screen or API response shows a number with no real data behind it instead
   of `null`/`0` + an honest "not enough data" flag.
5. `engage_promotions` has been wired to any route or UI — it is reserved,
   Phase 4, not this build.

Each module's adversarial refute (numbers, safety, blast radius) runs before
that module is marked done, per plan §8's per-phase gate — not deferred to the
end.
