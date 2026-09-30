import test from 'node:test';
import assert from 'node:assert/strict';
import { readStaySearch } from '../src/utils/searchParams.js';
import { day } from '../src/data.js';

test('booking search restores dates and capacity from its shareable URL', () => {
  const query = new URLSearchParams({ start: day(3), end: day(7), guests: '2' });
  assert.deepEqual(readStaySearch(query), { start: day(3), end: day(7), count: 2 });
});
test('invalid, past, reversed dates and impossible guest counts are rejected', () => {
  for (const input of [
    { start: day(-1), end: day(2), guests: '2' },
    { start: day(4), end: day(2), guests: '2' },
    { start: day(2), end: day(4), guests: '0' },
    { start: day(2), end: day(4), guests: '2.5' },
    { start: '2030-02-30', end: '2030-03-05', guests: '2' },
    { start: 'not-a-date', end: day(4), guests: '2' },
  ])
    assert.equal(readStaySearch(new URLSearchParams(input)), null);
});
