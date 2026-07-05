import { createServerFn } from '@tanstack/react-start';
import { requireMemberFn } from './membership';
import { resolveMembers } from './discord-members';

export type KudosRow = {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string;
  levelNumber: number;
  levelName: string;
  totalPoints: number;
};

export const getKudosLeaderboardFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<KudosRow[]> => {
    await requireMemberFn();
    const { getTopKudosUsers } = await import('../../../src/db/kudos');
    const top = await getTopKudosUsers(10);
    const members = await resolveMembers(top.map((entry) => entry.userId));
    return top.map((entry, index) => {
      const member = members.get(entry.userId);
      return {
        rank: index + 1,
        userId: entry.userId,
        displayName: member?.displayName ?? 'Former member',
        avatarUrl: member?.avatarUrl ?? '',
        levelNumber: entry.level.level,
        levelName: entry.level.name,
        totalPoints: entry.totalPoints,
      };
    });
  }
);
