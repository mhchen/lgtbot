import { createServerFn } from '@tanstack/react-start';
import { requireMemberFn } from './membership';
import { resolveMembers } from './discord-members';

export type HaikuCard = {
  id: number;
  lines: string[];
  author: string;
  createdAt: number;
};

export const getHaikusFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<HaikuCard[]> => {
    await requireMemberFn();
    const { getRecentHaikus } = await import('../../../src/db/haiku');
    const rows = getRecentHaikus(60);
    const members = await resolveMembers(rows.map((row) => row.authorUserId));
    return rows.map((haiku) => ({
      id: haiku.id,
      lines: haiku.haikuText.split('\n'),
      author: members.get(haiku.authorUserId)?.displayName ?? 'Former member',
      createdAt: haiku.createdAt.getTime(),
    }));
  }
);
