/* pos-provider/index.js — the PosProvider port.
 *
 * Per docs/codebase-audit/distribution/BLAZE-DEPENDENCY-MAP.md §3: a single adapter boundary so
 * every module that touches a POS talks to this shape, never to Blaze or wm-demo directly. Two
 * providers exist today (`blaze.js`, `hwpos.js`), plus `memory.js` for tests and fixtures.
 * `ExternalId.source` is `'blaze'` for BlazeProvider-sourced ids and `'hwpos'` for HwposProvider/
 * MemoryProvider-sourced ids — both already reserved in contracts/index.js's `IdSource` enum
 * (BLAZE-DEPENDENCY-MAP.md §3, answering its own open question 2: no new enum value needed).
 *
 * Pure ESM, zero dependencies. Every provider is a plain object of async functions; there is no
 * base class to extend, only this shape to match. `assertProvider` is the runtime check that a
 * candidate object actually implements it, used by the parity test and available to any caller
 * that wants to fail fast on a misconfigured provider.
 *
 * WHAT THIS FILE DOES NOT DO: no network calls, no file reads, no contract validation of the
 * shapes providers return (that's each provider's own job, proven by the test suite) — this file
 * only documents and checks the SHAPE of the port itself.
 */

/**
 * @typedef {Object} PosError
 * @property {string} code - one of contracts' ErrorCode values, or 'not_supported' for a gap a
 *   provider is honestly declining to fake (see hwpos.js).
 * @property {number} [status] - the HTTP status behind this error, when there was one.
 * @property {string} provider - which provider threw this ('blaze' | 'hwpos' | 'memory').
 * @property {string} message - human-readable, and NEVER contains a key, token, or secret value.
 */

/** Thrown by every provider method on failure. Never carries a secret in any field. */
export class PosError extends Error {
  /**
   * @param {{code: string, status?: number, provider: string, message?: string}} opts
   */
  constructor({ code, status, provider, message }) {
    super(message || code);
    this.name = 'PosError';
    this.code = code;
    this.status = status;
    this.provider = provider;
  }
}

/**
 * The full list of methods a PosProvider must implement. Each entry is
 * `[methodName, arity]` — arity is documentary only (JS doesn't enforce it), used by
 * `assertProvider` purely to note the expected argument count in its error message.
 *
 * Method shapes (see README.md for the fuller narrative):
 *
 *   listProducts({storeId})                              -> Product[]              (contracts Product)
 *   getProduct(id)                                        -> Product
 *   listBatches({productId?})                             -> Batch[]               (contracts Batch)
 *   listLocations({storeId?})                             -> Location[]            (contracts Location)
 *   listTerminals({storeId?})                             -> {terminal_id, name, region_id|null, location_id|null}[]
 *   listSales({since, until, terminalIds?})               -> {order_id, at, channel, terminal_id,
 *                                                              lines:[{product_id, batch_id|null, quantity}]}[]
 *   createTransfer({from_location_id, to_location_id, lines}) -> {transfer_id, status}
 *   acceptTransfer(id)                                    -> {transfer_id, status}
 *   findMember(query)                                     -> Person|null           (contracts Person)
 *   capabilities()                                        -> {name, supports: {...}}
 */
export const POS_PROVIDER_METHODS = [
  ['listProducts', 1],
  ['getProduct', 1],
  ['listBatches', 1],
  ['listLocations', 1],
  ['listTerminals', 1],
  ['listSales', 1],
  ['createTransfer', 1],
  ['acceptTransfer', 1],
  ['findMember', 1],
  ['capabilities', 0],
];

/**
 * Throws if `obj` is missing any PosProvider method, or if a present one isn't a function.
 * Returns `obj` unchanged (so it can be used inline: `export default assertProvider({...})`).
 *
 * @param {object} obj
 * @param {string} [label] - name to use in the error message (defaults to obj.name or 'provider')
 * @returns {object}
 */
export function assertProvider(obj, label) {
  const name = label || (obj && obj.name) || 'provider';
  if (!obj || typeof obj !== 'object') {
    throw new TypeError(`${name} is not an object`);
  }
  const missing = [];
  for (const [method] of POS_PROVIDER_METHODS) {
    if (typeof obj[method] !== 'function') missing.push(method);
  }
  if (missing.length) {
    throw new TypeError(
      `${name} does not implement the PosProvider port — missing: ${missing.join(', ')}`
    );
  }
  return obj;
}

/**
 * Channel derivation shared by every provider that reads Blaze-shaped `orderTags`:
 * 'asap' tag -> 'asap' channel; 'pickup'/'express' tags -> that channel; anything else ->
 * 'scheduled'. Exported so BlazeProvider and its tests use exactly one rule.
 *
 * @param {string[]|undefined|null} orderTags
 * @returns {'asap'|'scheduled'|'pickup'|'express'}
 */
export function channelFromOrderTags(orderTags) {
  const tags = Array.isArray(orderTags) ? orderTags.map((t) => String(t).toLowerCase()) : [];
  if (tags.includes('asap')) return 'asap';
  if (tags.includes('pickup')) return 'pickup';
  if (tags.includes('express')) return 'express';
  return 'scheduled';
}
