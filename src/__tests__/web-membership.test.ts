import { test, expect } from 'bun:test';
import { isCacheFresh, MEMBERSHIP_TTL_MS } from '../../web/src/server/membership';

test('cache entry within the TTL is fresh', () => {
  const now = 1_000_000;
  expect(isCacheFresh({ isMember: true, checkedAt: now - 1000 }, now)).toBe(true);
});

test('cache entry past the TTL is stale', () => {
  const now = 1_000_000;
  const old = now - MEMBERSHIP_TTL_MS - 1;
  expect(isCacheFresh({ isMember: true, checkedAt: old }, now)).toBe(false);
});
