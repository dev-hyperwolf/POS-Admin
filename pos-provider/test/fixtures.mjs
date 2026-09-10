// test/fixtures.mjs — SYNTHETIC Blaze-shaped API responses, invented from the field names
// confirmed in the call sites cited by blaze.js's header comment. Marked synthetic wherever a
// field's presence (not just its value) was not directly confirmed at a call site.

export const rawBlazeProduct = {
  id: 9001,
  name: 'Synthetic Gummies 100mg',
  sku: 'SKU-9001',
  brand: 'Synthetic Brand Co',
  category: 'edible',
  price: 24.5, // SYNTHETIC: dollars, not confirmed cents-vs-dollars at any cited call site
  sellableQuantities: { no_region: 42 },
};

export const rawBlazeBatch = {
  id: 5001,
  created: 1735689600000, // 2025-01-01T00:00:00Z
  batchNo: 'B-5001',
  purchasedDate: '2024-12-20T00:00:00.000Z',
  sku: 'SKU-9001',
  expirationDate: '2025-06-01T00:00:00.000Z',
  active: true,
  quantity: 200,
  liveQuantity: 150,
  costPerUnit: 8.25,
};

// SYNTHETIC record shape — concept confirmed (§2 BLAZE-DEPENDENCY-MAP.md), field names guessed.
export const rawBlazeLocation = {
  id: 701,
  name: 'Corona Safe',
  address: '123 Warehouse Way',
  regionId: 12,
  active: true,
};

// terminal.regionId confirmed (common-controllers.js getBlazeTerminalRegionMap); inventoryId synthetic.
export const rawBlazeTerminal = {
  id: 301,
  name: 'Driver Terminal 1',
  regionId: 12,
  inventoryId: 701,
};

function rawBlazeTransaction({ id, status = 'completed', orderTags = ['asap'], sellerTerminalId = 301, created = 1735689600000, items = [{ productId: 9001, productBatchId: 5001, quantity: 2 }] }) {
  return {
    id,
    status,
    orderTags,
    sellerTerminalId,
    created,
    cart: { items },
  };
}
export { rawBlazeTransaction };

export const rawBlazeMember = {
  id: 4001,
  firstName: 'Synthetic',
  lastName: 'Member',
  email: 'synthetic.member@example.com',
  phone: '+15555550100',
};
