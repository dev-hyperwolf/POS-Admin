import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestMinMax } from '../index.js';

test('suggestMinMax: computes units/day and coverage-day-based min/max, with evidence', () => {
  const sales = [
    { product_id: 'prod-01', quantity: 4, at: '2026-09-01T00:00:00Z' },
    { product_id: 'prod-01', quantity: 6, at: '2026-09-02T00:00:00Z' },
    { product_id: 'prod-07', quantity: 20, at: '2026-09-01T00:00:00Z' },
  ];
  const suggestions = suggestMinMax({ sales, days: 5, current: [{ product_id: 'prod-01', min: 1, max: 4 }] });
  const p1 = suggestions.find((s) => s.product_id === 'prod-01');
  assert.equal(p1.units_per_day, 2); // (4+6)/5
  assert.equal(p1.suggested_min, 2); // ceil(2 * 1-day default coverage)
  assert.equal(p1.suggested_max, 10); // ceil(2 * 5-day default coverage)
  assert.equal(p1.current_min, 1);
  assert.equal(p1.current_max, 4);
  assert.equal(p1.evidence.units_sold, 10);
  assert.equal(p1.evidence.days, 5);

  const p7 = suggestions.find((s) => s.product_id === 'prod-07');
  assert.equal(p7.current_min, null, 'no current template entry -> null, not a guess');
  assert.equal(p7.current_max, null);
});

test('suggestMinMax: never applies anything -- it only returns data', () => {
  const before = { product_id: 'prod-01', min: 1, max: 4 };
  const current = [before];
  suggestMinMax({ sales: [{ product_id: 'prod-01', quantity: 10, at: '2026-09-01T00:00:00Z' }], days: 2, current });
  assert.deepEqual(current[0], before, 'the caller\'s template object is untouched');
});

test('suggestMinMax: a product with zero velocity suggests zero, not a fabricated floor', () => {
  const suggestions = suggestMinMax({ sales: [{ product_id: 'prod-09', quantity: 0, at: '2026-09-01T00:00:00Z' }], days: 3 });
  // zero-quantity sale rows still create a totals entry at 0
  const p9 = suggestions.find((s) => s.product_id === 'prod-09');
  assert.equal(p9.units_per_day, 0);
  assert.equal(p9.suggested_min, 0);
  assert.equal(p9.suggested_max, 0);
});

test('suggestMinMax: custom coverage windows change the suggestion, evidence records which window', () => {
  const sales = [{ product_id: 'prod-14', quantity: 30, at: '2026-09-01T00:00:00Z' }];
  const suggestions = suggestMinMax({ sales, days: 3, minCoverageDays: 2, maxCoverageDays: 7 });
  const p14 = suggestions.find((s) => s.product_id === 'prod-14');
  assert.equal(p14.units_per_day, 10);
  assert.equal(p14.suggested_min, 20);
  assert.equal(p14.suggested_max, 70);
  assert.equal(p14.evidence.min_coverage_days, 2);
  assert.equal(p14.evidence.max_coverage_days, 7);
});

test('suggestMinMax: rejects a non-positive lookback window', () => {
  assert.throws(() => suggestMinMax({ sales: [], days: 0 }), TypeError);
});
