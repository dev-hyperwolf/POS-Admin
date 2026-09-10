/* pos-provider/blaze.js — BlazeProvider, the PosProvider port over the live Blaze Partner API.
 *
 * Endpoints and shapes below are read, read-only, from:
 *   - distribution-backend/controllers/common-controllers.js:60-215 (transactions fetch —
 *     pagination by skip/limit=100, dedupe by id, `status==='completed'`, `orderTags` asap filter,
 *     terminal→region map) and :640-840 (products + batches → ProductBatch fields).
 *   - distribution-backend/controllers/blaze/blaze-syncing-controller.js:240-520 (makeApiRequest —
 *     429 retry honouring retry-after; transferInventory create+accept, 2-step protocol).
 *   - wm-demo/wmdemo/incentives/blaze_client.py:60-300 (auth header names: `partner_key` +
 *     `Authorization`, no Bearer prefix; pagination guard posture).
 *
 * Every raw Blaze field name below (batchNo, purchasedDate, liveQuantity, sellerTerminalId, …) is
 * cited from one of those three files. Anything not confirmed there (product money units, member
 * search paths, inventories/terminals record shape) is a SYNTHETIC, clearly-marked best guess —
 * this file's own tests mark their fixtures synthetic too. No key or token value is ever logged,
 * thrown, or otherwise surfaced by this file — env var NAMES only, and only in comments.
 *
 * Env vars this provider expects its caller to supply as constructor options (never read from
 * process.env directly, so tests never touch real env): BLAZE_BASE_URL, BLAZE_PARTNER_KEY (the
 * `partner_key` header), BLAZE_AUTH_KEY_<STORE> (the `Authorization` header, per-store).
 */
import { PosError, channelFromOrderTags } from './index.js';
import Contracts from '../contracts/index.js';

const PAGE_LIMIT = 100;
const MAX_429_RETRIES = 5;
const DEFAULT_RETRY_AFTER_SECONDS = 1;

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusToErrorCode(status) {
  if (status === 400) return 'bad_request';
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 422) return 'unprocessable';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'internal';
  return 'internal';
}

/** M/D/YYYY — Blaze's own date format for `/transactions` (confirmed: `formatBlazeTransactionDate`
 * in common-controllers.js, `moment(ts).format("MM/DD/YYYY")`; reproduced without moment here). */
function toBlazeDate(isoOrDate) {
  const d = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
}

function toIsoOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  try {
    return Contracts.toIso(v);
  } catch {
    return null;
  }
}

/**
 * @param {{baseUrl: string, partnerKey: string, authKey: string, http?: typeof fetch,
 *   now?: () => number, sleep?: (ms: number) => Promise<void>, platform?: string,
 *   currentEmployeeId?: string}} opts
 */
export function BlazeProvider({
  baseUrl,
  partnerKey,
  authKey,
  http = fetch,
  now = Date.now,
  sleep = defaultSleep,
  platform = 'hyperwolf',
  currentEmployeeId,
} = {}) {
  if (!baseUrl) throw new TypeError('BlazeProvider requires baseUrl');
  if (!partnerKey) throw new TypeError('BlazeProvider requires partnerKey');
  if (!authKey) throw new TypeError('BlazeProvider requires authKey');

  function buildUrl(path, query) {
    const url = new URL(path.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  async function request(path, { method = 'GET', query, body } = {}) {
    const url = buildUrl(path, query);
    const headers = { partner_key: partnerKey, Authorization: authKey, Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let attempt = 0;
    for (;;) {
      let res;
      try {
        res = await http(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
      } catch (networkErr) {
        // Never include the caught error's message verbatim if it could echo back a header/URL
        // carrying a key — it can't (fetch network errors don't), but keep the message generic.
        throw new PosError({ code: 'internal', provider: 'blaze', message: 'could not reach Blaze' });
      }

      if (res.status === 429) {
        if (attempt >= MAX_429_RETRIES) {
          throw new PosError({ code: 'rate_limited', status: 429, provider: 'blaze', message: 'Blaze rate limit exceeded max retries' });
        }
        const retryAfterHeader = res.headers && typeof res.headers.get === 'function' ? res.headers.get('retry-after') : null;
        const parsedRetryAfter = retryAfterHeader === null ? NaN : Number(retryAfterHeader);
        const retryAfterSeconds = Number.isFinite(parsedRetryAfter) && parsedRetryAfter >= 0 ? parsedRetryAfter : DEFAULT_RETRY_AFTER_SECONDS;
        await sleep(retryAfterSeconds * 1000);
        attempt++;
        continue;
      }

      if (res.status < 200 || res.status >= 300) {
        throw new PosError({
          code: statusToErrorCode(res.status),
          status: res.status,
          provider: 'blaze',
          message: `Blaze request failed with HTTP ${res.status}`,
        });
      }

      if (res.status === 204) return null;
      try {
        return await res.json();
      } catch {
        throw new PosError({ code: 'internal', status: res.status, provider: 'blaze', message: 'Blaze returned a non-JSON body' });
      }
    }
  }

  function envelopeRows(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.values)) return parsed.values;
    if (parsed && Array.isArray(parsed.data)) return parsed.data;
    return [];
  }

  // SYNTHETIC: product money field. No confirmed cents-vs-dollars evidence in the cited call
  // sites (they read priceBreaks/assignedPrice off our OWN ProductBatch mirror, not Blaze's raw
  // product payload) — treated as a dollar amount, the common shape for a retail catalog API.
  function mapProduct(raw) {
    const priceDollars = raw.price ?? raw.retailPrice ?? 0;
    return {
      id: String(raw.id),
      platform,
      source: 'blaze',
      name: raw.name || raw.productName || '',
      sku: raw.sku ?? null,
      brand: raw.brand ?? raw.brandName ?? null,
      category: raw.category ?? null,
      price: Contracts.money(Contracts.centsFromDollars(priceDollars), 'inc_tax', 'USD'),
      quantity_on_hand: raw.sellableQuantities?.no_region ?? raw.quantity ?? null,
      external_ids: [Contracts.externalId('blaze', raw.id)],
    };
  }

  // Confirmed fields: id, created, batchNo, purchasedDate, sku, expirationDate, active,
  // batchQRAsset.publicURL, quantity, liveQuantity, costPerUnit (common-controllers.js:750-810).
  function mapBatch(raw, productId) {
    return {
      id: String(raw.id),
      product_id: String(productId),
      sku: raw.sku ?? null,
      batch_no: String(raw.batchNo ?? raw.id),
      metrc_tag: raw.metrcTag ?? null,
      packaged_at: toIsoOrNull(raw.purchasedDate),
      expires_at: toIsoOrNull(raw.expirationDate),
      received_at: toIsoOrNull(raw.created) || Contracts.isoFromEpoch(now()),
      thc_pct: null, // not present on this endpoint per BLAZE-DEPENDENCY-MAP.md §2 (open question)
      unit_cost:
        raw.costPerUnit === undefined || raw.costPerUnit === null
          ? null
          : Contracts.money(Contracts.centsFromDollars(raw.costPerUnit), 'ex_tax_net', 'USD'),
      quantity: Number(raw.liveQuantity ?? raw.quantity ?? 0),
      location_id: null, // storage location is not tracked by Blaze — OWNER-NOTES.md 2026-09-10
      external_ids: [Contracts.externalId('blaze', raw.id)],
    };
  }

  // SYNTHETIC record shape (§2 of BLAZE-DEPENDENCY-MAP.md names the concept — "inventories" — but
  // no field-level shape was read at a call site). Modelled as {id, name, address, regionId, active}.
  function mapLocation(raw) {
    return {
      id: String(raw.id),
      kind: 'safe',
      name: raw.name || `Blaze inventory ${raw.id}`,
      address: raw.address ?? null,
      store_id: null,
      region_id: raw.regionId != null ? String(raw.regionId) : null,
      parent_id: null,
      active: raw.active !== false,
      external_ids: [Contracts.externalId('blaze', raw.id)],
    };
  }

  // Confirmed field: terminal.regionId (common-controllers.js:87-95, getBlazeTerminalRegionMap).
  // `inventoryId` (location) is SYNTHETIC — no call site read it off a terminal record directly.
  function mapTerminal(raw) {
    return {
      terminal_id: String(raw.id),
      name: raw.name || `Terminal ${raw.id}`,
      region_id: raw.regionId != null ? String(raw.regionId) : null,
      location_id: raw.inventoryId != null ? String(raw.inventoryId) : null,
    };
  }

  // Confirmed: id, status, orderTags, sellerTerminalId, created/completedTime/endTime,
  // cart.items[].productId/quantity (common-controllers.js:73-100). `productBatchId` on a cart
  // item is SYNTHETIC — no call site reads a batch id off a transaction line.
  function mapSale(raw) {
    const at =
      toIsoOrNull(raw.created) || toIsoOrNull(raw.completedTime) || toIsoOrNull(raw.endTime) || Contracts.isoFromEpoch(now());
    const items = raw.cart?.items ?? [];
    return {
      order_id: String(raw.id),
      at,
      channel: channelFromOrderTags(raw.orderTags),
      terminal_id: raw.sellerTerminalId != null ? String(raw.sellerTerminalId) : null,
      lines: items.map((it) => ({
        product_id: String(it.productId),
        batch_id: it.productBatchId != null ? String(it.productBatchId) : null,
        quantity: Number(it.quantity) || 0,
      })),
    };
  }

  // SYNTHETIC endpoint paths for member search (BLAZE-DEPENDENCY-MAP.md §1d cites
  // `/partner/members/search/phone` from hyperdrive-backend; email/id are inferred siblings).
  function mapMember(raw) {
    const name = [raw.firstName, raw.lastName].filter(Boolean).join(' ').trim();
    return {
      id: String(raw.id),
      kind: 'customer',
      display_name: name || raw.email || raw.phone || `Member ${raw.id}`,
      email: raw.email ?? null,
      phone: raw.phone ?? null,
      external_ids: [Contracts.externalId('blaze', raw.id)],
    };
  }

  return {
    name: 'blaze',

    async listProducts({ storeId } = {}) {
      const parsed = await request('/partner/store/inventory/products', { query: { storeId } });
      return envelopeRows(parsed).map(mapProduct);
    },

    async getProduct(id) {
      if (!id) throw new PosError({ code: 'bad_request', provider: 'blaze', message: 'getProduct requires an id' });
      const parsed = await request(`/partner/products/${encodeURIComponent(id)}`);
      return mapProduct(parsed);
    },

    async listBatches({ productId } = {}) {
      if (!productId) {
        throw new PosError({ code: 'bad_request', provider: 'blaze', message: 'listBatches requires productId (the confirmed Blaze endpoint takes no other filter)' });
      }
      const parsed = await request('/partner/store/batches', { query: { productId } });
      return envelopeRows(parsed).map((raw) => mapBatch(raw, productId));
    },

    async listLocations({ storeId } = {}) {
      const parsed = await request('/partner/store/inventory/inventories', { query: { storeId } });
      return envelopeRows(parsed).map(mapLocation);
    },

    async listTerminals({ storeId } = {}) {
      const parsed = await request('/partner/store/inventory/terminals', { query: { storeId } });
      return envelopeRows(parsed).map(mapTerminal);
    },

    async listSales({ since, until, terminalIds } = {}) {
      if (!since || !until) {
        throw new PosError({ code: 'bad_request', provider: 'blaze', message: 'listSales requires since and until' });
      }
      const startDate = toBlazeDate(since);
      const endDate = toBlazeDate(until);
      const byId = new Map();
      let skip = 0;
      for (;;) {
        const parsed = await request('/partner/transactions', {
          query: { startDate, endDate, skip, limit: PAGE_LIMIT },
        });
        const rows = envelopeRows(parsed);
        for (const row of rows) {
          const id = row?.id;
          if (id !== undefined && id !== null) byId.set(String(id), row);
        }
        if (rows.length < PAGE_LIMIT) break;
        skip += PAGE_LIMIT;
      }
      const terminalSet = Array.isArray(terminalIds) && terminalIds.length ? new Set(terminalIds.map(String)) : null;
      const out = [];
      for (const raw of byId.values()) {
        if (String(raw?.status || '').toLowerCase() !== 'completed') continue;
        const sale = mapSale(raw);
        if (terminalSet && (!sale.terminal_id || !terminalSet.has(sale.terminal_id))) continue;
        out.push(sale);
      }
      return out;
    },

    async createTransfer({ from_location_id, to_location_id, lines } = {}) {
      if (!from_location_id || !to_location_id || !Array.isArray(lines) || !lines.length) {
        throw new PosError({ code: 'bad_request', provider: 'blaze', message: 'createTransfer requires from_location_id, to_location_id and at least one line' });
      }
      const body = {
        fromInventoryId: from_location_id,
        toInventoryId: to_location_id,
        transferLogs: lines.map((l) => ({
          productId: l.product_id,
          fromBatchId: l.batch_id,
          transferAmount: l.quantity,
          toInventoryId: to_location_id,
        })),
        currentEmployeeId,
      };
      const resp = await request('/partner/store/batches/transferInventory', { method: 'POST', body });
      const id = resp?.id;
      if (!id) throw new PosError({ code: 'internal', provider: 'blaze', message: 'Blaze transferInventory response carried no id' });
      return { transfer_id: String(id), status: 'created' };
    },

    async acceptTransfer(id) {
      if (!id) throw new PosError({ code: 'bad_request', provider: 'blaze', message: 'acceptTransfer requires an id' });
      await request(`/partner/store/batches/transferInventory/${encodeURIComponent(id)}/accept`, {
        method: 'POST',
        body: { currentEmployeeId },
      });
      return { transfer_id: String(id), status: 'accepted' };
    },

    async findMember(query = {}) {
      let path;
      let params;
      if (query.id) {
        path = `/partner/members/${encodeURIComponent(query.id)}`;
        params = undefined;
      } else if (query.email) {
        path = '/partner/members/search/email';
        params = { email: query.email };
      } else if (query.phone) {
        path = '/partner/members/search/phone';
        params = { phone: query.phone };
      } else {
        throw new PosError({ code: 'bad_request', provider: 'blaze', message: 'findMember requires id, email or phone' });
      }
      try {
        const parsed = await request(path, { query: params });
        const row = Array.isArray(parsed) ? parsed[0] : Array.isArray(parsed?.values) ? parsed.values[0] : parsed;
        if (!row || row.id === undefined) return null;
        return mapMember(row);
      } catch (e) {
        if (e instanceof PosError && e.code === 'not_found') return null;
        throw e;
      }
    },

    capabilities() {
      return {
        name: 'blaze',
        supports: {
          listProducts: true,
          getProduct: true,
          listBatches: true,
          listLocations: true,
          listTerminals: true,
          listSales: true,
          createTransfer: true,
          acceptTransfer: true,
          findMember: true,
        },
      };
    },
  };
}

export default BlazeProvider;
