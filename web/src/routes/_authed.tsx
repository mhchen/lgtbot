import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireMemberFn } from '../server/membership';

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const member = await requireMemberFn();
    return { member };
  },
  component: () => <Outlet />,
});
