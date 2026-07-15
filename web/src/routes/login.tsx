import { createFileRoute, redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import * as arctic from 'arctic';
import { discord, DISCORD_SCOPES } from '../server/discord';

const startLogin = createServerFn({ method: 'GET' }).handler(async () => {
  const state = arctic.generateState();
  const url = discord.createAuthorizationURL(state, null, DISCORD_SCOPES);
  setResponseHeader(
    'Set-Cookie',
    `oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${
      process.env.NODE_ENV === 'production' ? '; Secure' : ''
    }`
  );
  throw redirect({ href: url.toString() });
});

export const Route = createFileRoute('/login')({
  beforeLoad: () => startLogin(),
});
