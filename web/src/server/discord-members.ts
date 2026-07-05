import { LGT_GUILD_ID } from './discord';

export type ResolvedMember = {
  userId: string;
  displayName: string;
  avatarUrl: string;
};

type RawMember = {
  nick: string | null;
  avatar: string | null;
  user: {
    id: string;
    username: string;
    global_name: string | null;
    avatar: string | null;
  };
};

const MEMBERS_TTL_MS = 10 * 60 * 1000;

let cache: { byId: Map<string, ResolvedMember>; fetchedAt: number } | null =
  null;

function defaultAvatar(userId: string): string {
  const index = Number((BigInt(userId) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

function avatarUrl(member: RawMember): string {
  const { user } = member;
  if (member.avatar != null) {
    return `https://cdn.discordapp.com/guilds/${LGT_GUILD_ID}/users/${user.id}/avatars/${member.avatar}.png?size=64`;
  }
  if (user.avatar != null) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
  }
  return defaultAvatar(user.id);
}

function toResolved(member: RawMember): ResolvedMember {
  return {
    userId: member.user.id,
    displayName: member.nick ?? member.user.global_name ?? member.user.username,
    avatarUrl: avatarUrl(member),
  };
}

async function loadAllMembers(): Promise<Map<string, ResolvedMember>> {
  const now = Date.now();
  if (cache != null && now - cache.fetchedAt < MEMBERS_TTL_MS) {
    return cache.byId;
  }

  const { REST } = await import('discord.js');
  const { Routes } = await import('discord-api-types/v10');
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

  const raw = (await rest.get(Routes.guildMembers(LGT_GUILD_ID), {
    query: new URLSearchParams({ limit: '1000' }),
  })) as RawMember[];

  const byId = new Map<string, ResolvedMember>();
  for (const member of raw) {
    byId.set(member.user.id, toResolved(member));
  }
  cache = { byId, fetchedAt: now };
  return byId;
}

export async function resolveMembers(
  userIds: string[]
): Promise<Map<string, ResolvedMember>> {
  const all = await loadAllMembers();
  const result = new Map<string, ResolvedMember>();
  for (const userId of userIds) {
    result.set(
      userId,
      all.get(userId) ?? {
        userId,
        displayName: 'Former member',
        avatarUrl: defaultAvatar(userId),
      }
    );
  }
  return result;
}
