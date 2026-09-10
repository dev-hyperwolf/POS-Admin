import test from 'node:test';
import assert from 'node:assert/strict';
import { assertProvider, POS_PROVIDER_METHODS } from '../index.js';
import { BlazeProvider } from '../blaze.js';
import { HwposProvider } from '../hwpos.js';
import { MemoryProvider } from '../memory.js';
import { makeFakeHttp } from './helpers.mjs';

test('assertProvider accepts a complete provider and rejects an incomplete one', () => {
  const complete = {};
  for (const [m] of POS_PROVIDER_METHODS) complete[m] = () => {};
  assert.doesNotThrow(() => assertProvider(complete));

  const incomplete = { ...complete };
  delete incomplete.findMember;
  assert.throws(() => assertProvider(incomplete, 'incomplete'), /missing: findMember/);
});

test('assertProvider rejects non-objects', () => {
  assert.throws(() => assertProvider(null));
  assert.throws(() => assertProvider(42));
});

test('assertProvider passes for all three real providers', () => {
  const http = makeFakeHttp([]);
  const blaze = BlazeProvider({ baseUrl: 'https://api.blaze.me/api/v1', partnerKey: 'pk', authKey: 'ak', http });
  const hwpos = HwposProvider({ baseUrl: 'https://hwpos.example.com', token: 't', http });
  const memory = MemoryProvider({});
  assert.doesNotThrow(() => assertProvider(blaze, 'blaze'));
  assert.doesNotThrow(() => assertProvider(hwpos, 'hwpos'));
  assert.doesNotThrow(() => assertProvider(memory, 'memory'));
});
