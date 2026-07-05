import { createFileRoute, redirect } from '@tanstack/react-router';
import { getRequestHeader } from '@tanstack/react-start/server';
import { discord } from '../server/discord';
import {
  buildSessionData,
  useAppSession,
  type DiscordUser,
} from '../server/session';

function readCookie(name: string): string | null {
  const header = getRequestHeader('cookie');
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq !== -1 && part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
}

export const Route = createFileRoute('/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const storedState = readCookie('oauth_state');

        if (!code || !state || state !== storedState) {
          throw redirect({ to: '/login' });
        }

        const tokens = await discord.validateAuthorizationCode(code, null);
        const response = await fetch('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${tokens.accessToken()}` },
        });
        const user = (await response.json()) as DiscordUser;

        const session = await useAppSession();
        await session.update(buildSessionData(user));

        throw redirect({ to: '/' });
      },
    },
  },
});
