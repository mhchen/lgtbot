import { createServerFn } from '@tanstack/react-start';
import { redirect } from '@tanstack/react-router';
import { LGT_GUILD_ID } from './discord';
import { useAppSession } from './session';

export const MEMBERSHIP_TTL_MS = 10 * 60 * 1000;

export type CacheEntry = { isMember: boolean; checkedAt: number };

export function isCacheFresh(entry: CacheEntry, now: number): boolean {
  return now - entry.checkedAt < MEMBERSHIP_TTL_MS;
}

const cache = new Map<string, CacheEntry>();

export async function isGuildMember(userId: string): Promise<boolean> {
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && isCacheFresh(cached, now)) return cached.isMember;

  const { REST } = await import('discord.js');
  const { Routes } = await import('discord-api-types/v10');
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

  let isMember: boolean;
  try {
    await rest.get(Routes.guildMember(LGT_GUILD_ID, userId));
    isMember = true;
  } catch {
    isMember = false;
  }
  cache.set(userId, { isMember, checkedAt: now });
  return isMember;
}

export const requireMemberFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await useAppSession();
    const userId = session.data.userId;
    if (userId == null) {
      throw redirect({ to: '/login' });
    }
    if (!(await isGuildMember(userId))) {
      await session.clear();
      throw redirect({ to: '/denied' });
    }
    return {
      userId,
      username: session.data.username,
      avatar: session.data.avatar,
    };
  }
);
