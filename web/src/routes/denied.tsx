import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/denied')({
  component: () => (
    <main className="notice">
      <p className="eyebrow">Access</p>
      <h1>Members only</h1>
      <p>You need to be in the LGT Discord server to use this portal.</p>
    </main>
  ),
});
