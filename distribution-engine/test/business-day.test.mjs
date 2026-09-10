import { test } from 'node:test';
import assert from 'node:assert/strict';
import { businessDay, businessDayStart } from '../index.js';

test('businessDay: midday Pacific is the calendar date you expect', () => {
  assert.equal(businessDay('2026-09-10T20:00:00Z'), '2026-09-10'); // 1pm PDT
});

test('businessDay: just before Pacific midnight is still the previous business day', () => {
  // 2026-09-10T06:59:00Z = 2026-09-09T23:59:00-07:00 (PDT)
  assert.equal(businessDay('2026-09-10T06:59:00Z'), '2026-09-09');
});

test('businessDay: right at Pacific midnight rolls to the next business day', () => {
  // 2026-09-10T07:00:00Z = 2026-09-10T00:00:00-07:00 (PDT)
  assert.equal(businessDay('2026-09-10T07:00:00Z'), '2026-09-10');
});

test('businessDay: fall-back DST transition (2026-11-01, PDT -> PST)', () => {
  // The clock falls back from 2:00 AM PDT to 1:00 AM PST at 09:00 UTC on 2026-11-01, so 1-2am
  // local happens twice that day. The point of this test is that a fixed +7h offset would
  // compute a different (wrong) calendar date on the two sides of that instant; the IANA tz
  // database Intl uses reports the same correct date, 2026-11-01, throughout.
  assert.equal(businessDay('2026-11-01T06:59:00Z'), '2026-10-31'); // 23:59 PDT Oct 31, just before local midnight
  assert.equal(businessDay('2026-11-01T07:30:00Z'), '2026-11-01'); // 00:30 PDT, pre-transition
  assert.equal(businessDay('2026-11-01T09:30:00Z'), '2026-11-01'); // 01:30 PST, post-transition -- same date
});

test('businessDay: spring-forward DST transition (2026-03-08, PST -> PDT)', () => {
  assert.equal(businessDay('2026-03-08T07:30:00Z'), '2026-03-07'); // 23:30 PST, pre-transition
  assert.equal(businessDay('2026-03-08T11:30:00Z'), '2026-03-08'); // 04:30 PDT, post-transition
});

test('businessDay: a different timezone changes the boundary independently', () => {
  assert.equal(businessDay('2026-09-10T02:00:00Z', 'America/New_York'), '2026-09-09');
  assert.equal(businessDay('2026-09-10T02:00:00Z', 'America/Los_Angeles'), '2026-09-09');
  assert.equal(businessDay('2026-09-10T05:00:00Z', 'America/New_York'), '2026-09-10');
});

test('businessDay: rejects an unparseable time rather than guessing', () => {
  assert.throws(() => businessDay('not-a-date'), TypeError);
});

test('businessDayStart: resolves to an instant that businessDay maps right back to the same day', () => {
  const start = businessDayStart('2026-09-10');
  assert.equal(businessDay(start), '2026-09-10');
  // and one minute earlier must be the previous business day
  const oneMinEarlier = new Date(Date.parse(start) - 60_000).toISOString();
  assert.equal(businessDay(oneMinEarlier), '2026-09-09');
});
