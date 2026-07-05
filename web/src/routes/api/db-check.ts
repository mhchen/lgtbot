import { createFileRoute } from '@tanstack/react-router';
import { getActivePool } from '../../../../src/db/book-club-picks';

export const Route = createFileRoute('/api/db-check')({
  server: {
    handlers: {
      GET: () => {
        const pool = getActivePool();
        return Response.json({ poolSize: pool.length });
      },
    },
  },
});
