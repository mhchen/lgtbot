import { useSession } from '@tanstack/react-start/server';

export type SessionData = {
  userId?: string;
  username?: string;
  avatar?: string | null;
};

export type DiscordUser = {
  id: string;
  username: string;
  avatar: string | null;
};

export function buildSessionData(user: DiscordUser): SessionData {
  return { userId: user.id, username: user.username, avatar: user.avatar };
}

export function useAppSession() {
  return useSession<SessionData>({
    name: 'lgt-portal-session',
    password: process.env.SESSION_SECRET!,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: true,
    },
  });
}
