import { createServerFn } from '@tanstack/react-start';
import { requireMemberFn } from './membership';
import { resolveMembers } from './discord-members';
import {
  BAN_ACHIEVEMENTS,
  highestAchievement,
  type BanAchievement,
} from '../../../src/book-club-achievements';

export type ShameRow = {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string;
  banCount: number;
  achievementTitle: string | null;
};

export type TrophyTier = BanAchievement & {
  earned: boolean;
  holders: string[];
};

export type HallOfShame = {
  leaderboard: ShameRow[];
  trophies: TrophyTier[];
};

export const getHallOfShameFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<HallOfShame> => {
    await requireMemberFn();
    const { db } = await import('../../../src/db/index');
    const { bookClubBans } = await import('../../../src/db/schema');

    const counts = db
      .select()
      .from(bookClubBans)
      .all()
      .map((row) => ({
        userId: row.discordUserId,
        banCount: row.discordMessageIds.split(',').filter(Boolean).length,
      }))
      .sort((a, b) => b.banCount - a.banCount);

    const members = await resolveMembers(counts.map((entry) => entry.userId));

    const leaderboard: ShameRow[] = counts.map((entry, index) => {
      const member = members.get(entry.userId);
      return {
        rank: index + 1,
        userId: entry.userId,
        displayName: member?.displayName ?? 'Former member',
        avatarUrl: member?.avatarUrl ?? '',
        banCount: entry.banCount,
        achievementTitle: highestAchievement(entry.banCount)?.title ?? null,
      };
    });

    const trophies: TrophyTier[] = BAN_ACHIEVEMENTS.map((tier) => {
      const holders = counts
        .filter((entry) => entry.banCount >= tier.threshold)
        .map(
          (entry) => members.get(entry.userId)?.displayName ?? 'Former member'
        );
      return { ...tier, earned: holders.length > 0, holders };
    });

    return { leaderboard, trophies };
  }
);
