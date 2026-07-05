import { createServerFn } from '@tanstack/react-start';
import { requireMemberFn } from './membership';

export const getArchiveFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireMemberFn();
  const { getAllDiscussed } = await import('../../../src/db/book-club-picks');
  return getAllDiscussed();
});
