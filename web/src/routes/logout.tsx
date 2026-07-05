import { createFileRoute, redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { useAppSession } from '../server/session';

const doLogout = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await useAppSession();
  await session.clear();
  throw redirect({ to: '/' });
});

export const Route = createFileRoute('/logout')({
  beforeLoad: () => doLogout(),
});
