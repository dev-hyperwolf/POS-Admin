/* pos-provider/hwpos.js — HwposProvider, the PosProvider port over our own POS (wm-demo).
 *
 * Routes and row shapes below are read, read-only, from wm-demo/wmdemo/server.py and
 * wm-demo/wmdemo/{catalog,inventory}.py:
 *   - `GET /api/state` returns `"catalog": catalog.products()` and `"batches": catalog.batches()`
 *     (server.py:1633-1774) — the only BULK read surfaces for products/batches; there is no
 *     `GET /api/products` list route, only `GET /api/product/<sku>` for one row (server.py:3178-3212).
 *   - `catalog.batches()` rows: `{region, sku, batch_id, thc_pct, qty, received_at}` — sqlite
 *     columns, `received_at` epoch SECONDS as REAL (catalog.py:114-118, the `batches` table DDL).
 *   - `GET /api/inventory/locations` -> `inventory.locations(active_only=False)`, rows
 *     `{id, name, kind, region, active}` (inventory.py:172-176 `_loc_row`, route at server.py:2893-2913).
 *
 * THE HONEST PART: `listTerminals`, `listSales`, `createTransfer`, `acceptTransfer` and
 * `findMember` have no HTTP route to map onto today (confirmed by grepping
 * `server.py` for `/api/` route strings — no terminal, transfer, member, or raw-sales-list route
 * exists; `/api/pos/sale` is a POST that records ONE sale, not a query surface). Each throws
 * `PosError {code:'not_supported'}` rather than faking a response — see README.md's gaps list,
 * which this file's `capabilities()` also declares in machine-readable form.
 */
import { PosError } from './index.js';
import Contracts from '../contracts/index.js';

const KIND_MAP = { safe: 'safe', kit: 'kit_box', counter: 'floor' };

function mapLocationKind(raw) {
  if (Contracts.isEnum('LocationKind', raw)) return raw;
  return KIND_MAP[raw] || 'floor';
}

function notSupported(op) {
  return new PosError({
    code: 'not_supported',
    provider: 'hwpos',
    message: `${op} has no route in wm-demo today — see pos-provider/README.md gaps list`,
  });
}

/**
 * @param {{baseUrl: string, token: string, http?: typeof fetch, platform?: string}} opts
 */
export function HwposProvider({ baseUrl, token, http = fetch, platform = 'hyperwolf' } = {}) {
  if (!baseUrl) throw new TypeError('HwposProvider requires baseUrl');

  function buildUrl(path) {
    return new URL(path.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : baseUrl + '/').toString();
  }

  async function get(path) {
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    let res;
    try {
      res = await http(buildUrl(path), { method: 'GET', headers });
    } catch {
      throw new PosError({ code: 'internal', provider: 'hwpos', message: 'could not reach the wm-demo server' });
    }
    if (res.status === 404) {
      throw new PosError({ code: 'not_found', status: 404, provider: 'hwpos', message: `not found: ${path}` });
    }
    if (res.status < 200 || res.status >= 300) {
      throw new PosError({ code: 'internal', status: res.status, provider: 'hwpos', message: `wm-demo request failed with HTTP ${res.status}` });
    }
    try {
      return await res.json();
    } catch {
      throw new PosError({ code: 'internal', status: res.status, provider: 'hwpos', message: 'wm-demo returned a non-JSON body' });
    }
  }

  // catalog.py normalize_product shape: sku, name, category, price, weight{unit,value}, tags,
  // thc, wm_brand_id, sale_pct, sample. `brand_name` is carried on rows imported via
  // hyperdrive_row_to_product but is not guaranteed on every row — nullable here.
  function mapProduct(raw) {
    return {
      id: String(raw.sku),
      platform,
      source: 'first-party',
      name: raw.name || '',
      sku: raw.sku ?? null,
      brand: raw.brand_name ?? null,
      category: raw.category ?? null,
      price: Contracts.money(Contracts.centsFromDollars(raw.price ?? 0), 'inc_tax', 'USD'),
      quantity_on_hand: null, // stock lives in location_stock/batches, not on the product row
      external_ids: [Contracts.externalId('hwpos', raw.sku)],
    };
  }

  // catalog.batches() row: {region, sku, batch_id, thc_pct, qty, received_at (epoch seconds)}.
  function mapBatch(raw) {
    return {
      id: String(raw.batch_id),
      product_id: String(raw.sku),
      sku: raw.sku ?? null,
      batch_no: String(raw.batch_id),
      metrc_tag: null,
      packaged_at: null, // not tracked by wm-demo's batches table
      expires_at: null,
      received_at: Contracts.isoFromEpoch(raw.received_at),
      thc_pct: raw.thc_pct ?? null,
      unit_cost: null,
      quantity: Number(raw.qty ?? 0),
      location_id: null, // `region`, not an inventory_locations id — kept as an extra field below
      region: raw.region ?? null,
      external_ids: [Contracts.externalId('hwpos', raw.batch_id)],
    };
  }

  function mapLocation(raw) {
    return {
      id: String(raw.id),
      kind: mapLocationKind(raw.kind),
      name: raw.name || `Location ${raw.id}`,
      address: null,
      store_id: null,
      region_id: raw.region ?? null,
      parent_id: null,
      active: !!raw.active,
      external_ids: [Contracts.externalId('hwpos', raw.id)],
    };
  }

  return {
    name: 'hwpos',

    async listProducts(_opts = {}) {
      const state = await get('/api/state');
      return (state.catalog || []).map(mapProduct);
    },

    async getProduct(id) {
      if (!id) throw new PosError({ code: 'bad_request', provider: 'hwpos', message: 'getProduct requires an id' });
      const raw = await get(`/api/product/${encodeURIComponent(id)}`);
      return mapProduct(raw);
    },

    async listBatches({ productId } = {}) {
      const state = await get('/api/state');
      const rows = state.batches || [];
      return rows.filter((r) => !productId || String(r.sku) === String(productId)).map(mapBatch);
    },

    async listLocations(_opts = {}) {
      const rows = await get('/api/inventory/locations');
      return (Array.isArray(rows) ? rows : []).map(mapLocation);
    },

    async listTerminals() {
      throw notSupported('listTerminals');
    },

    async listSales() {
      throw notSupported('listSales');
    },

    async createTransfer() {
      throw notSupported('createTransfer');
    },

    async acceptTransfer() {
      throw notSupported('acceptTransfer');
    },

    async findMember() {
      throw notSupported('findMember');
    },

    capabilities() {
      return {
        name: 'hwpos',
        supports: {
          listProducts: true,
          getProduct: true,
          listBatches: true,
          listLocations: true,
          listTerminals: false,
          listSales: false,
          createTransfer: false,
          acceptTransfer: false,
          findMember: false,
        },
      };
    },
  };
}

export default HwposProvider;
