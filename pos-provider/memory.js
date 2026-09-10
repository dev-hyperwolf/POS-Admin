/* pos-provider/memory.js — MemoryProvider, an in-process PosProvider for tests and fixtures.
 *
 * Fixtures are handed in ALREADY in the port's output shapes (contract Product/Batch/Location,
 * plus the port's own terminal/sale/transfer shapes) — this provider does no mapping, only
 * filtering, so it is the cheapest possible thing to compare a real provider's mapped output
 * against in the parity test.
 *
 * @typedef {Object} MemoryFixtures
 * @property {import('../contracts/index.js').Product[]} [products]
 * @property {import('../contracts/index.js').Batch[]} [batches]
 * @property {import('../contracts/index.js').Location[]} [locations]
 * @property {{terminal_id:string,name:string,region_id:?string,location_id:?string}[]} [terminals]
 * @property {object[]} [sales]
 * @property {import('../contracts/index.js').Person[]} [members]
 */
import { PosError } from './index.js';

/** @param {MemoryFixtures} fixtures */
export function MemoryProvider(fixtures = {}) {
  const products = [...(fixtures.products || [])];
  const batches = [...(fixtures.batches || [])];
  const locations = [...(fixtures.locations || [])];
  const terminals = [...(fixtures.terminals || [])];
  const sales = [...(fixtures.sales || [])];
  const members = [...(fixtures.members || [])];
  const transfers = new Map();
  let transferSeq = 1;

  return {
    name: 'memory',

    async listProducts({ storeId } = {}) {
      // storeId has no meaning in a flat fixture list — accepted for shape parity, unused.
      void storeId;
      return products;
    },

    async getProduct(id) {
      const found = products.find((p) => String(p.id) === String(id));
      if (!found) throw new PosError({ code: 'not_found', provider: 'memory', message: `no such product: ${id}` });
      return found;
    },

    async listBatches({ productId } = {}) {
      return productId ? batches.filter((b) => String(b.product_id) === String(productId)) : batches;
    },

    async listLocations({ storeId } = {}) {
      return storeId ? locations.filter((l) => String(l.store_id) === String(storeId)) : locations;
    },

    async listTerminals({ storeId } = {}) {
      void storeId; // fixtures carry no store_id on terminals today — accepted, unused
      return terminals;
    },

    async listSales({ since, until, terminalIds } = {}) {
      const sinceMs = since ? Date.parse(since) : -Infinity;
      const untilMs = until ? Date.parse(until) : Infinity;
      const terminalSet = Array.isArray(terminalIds) && terminalIds.length ? new Set(terminalIds.map(String)) : null;
      return sales.filter((s) => {
        const at = Date.parse(s.at);
        if (at < sinceMs || at > untilMs) return false;
        if (terminalSet && (!s.terminal_id || !terminalSet.has(String(s.terminal_id)))) return false;
        return true;
      });
    },

    async createTransfer({ from_location_id, to_location_id, lines } = {}) {
      if (!from_location_id || !to_location_id || !Array.isArray(lines) || !lines.length) {
        throw new PosError({ code: 'bad_request', provider: 'memory', message: 'createTransfer requires from_location_id, to_location_id and at least one line' });
      }
      const transfer_id = String(transferSeq++);
      transfers.set(transfer_id, { status: 'created', from_location_id, to_location_id, lines });
      return { transfer_id, status: 'created' };
    },

    async acceptTransfer(id) {
      const t = transfers.get(String(id));
      if (!t) throw new PosError({ code: 'not_found', provider: 'memory', message: `no such transfer: ${id}` });
      t.status = 'accepted';
      return { transfer_id: String(id), status: 'accepted' };
    },

    async findMember(query = {}) {
      const found = members.find(
        (m) =>
          (query.id && String(m.id) === String(query.id)) ||
          (query.email && m.email === query.email) ||
          (query.phone && m.phone === query.phone)
      );
      return found || null;
    },

    capabilities() {
      return {
        name: 'memory',
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

export default MemoryProvider;
