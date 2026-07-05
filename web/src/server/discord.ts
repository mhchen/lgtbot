import * as arctic from 'arctic';

export const LGT_GUILD_ID = '964903664265359430';
export const WEB_BASE_URL = process.env.WEB_BASE_URL!;
export const DISCORD_SCOPES = ['identify'];

export const discord = new arctic.Discord(
  process.env.DISCORD_CLIENT_ID!,
  process.env.DISCORD_CLIENT_SECRET!,
  `${WEB_BASE_URL}/auth/callback`,
);
