import { test, expect } from 'bun:test';
import { buildSessionData } from '../../web/src/server/session';

test('buildSessionData maps a Discord user to session fields', () => {
  const data = buildSessionData({ id: '42', username: 'noel', avatar: 'abc' });
  expect(data).toEqual({ userId: '42', username: 'noel', avatar: 'abc' });
});

test('buildSessionData tolerates a null avatar', () => {
  const data = buildSessionData({ id: '42', username: 'noel', avatar: null });
  expect(data.avatar).toBeNull();
});
