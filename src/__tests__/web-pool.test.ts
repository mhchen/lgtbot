import { test, expect } from 'bun:test';
import { sortPoolByVotes } from '../../web/src/server/pool';

const sub = (id: number) => ({
  id,
  url: `https://x/${id}`,
  title: `t${id}`,
  submittedBy: 'u',
  submittedAt: new Date(0),
  discussedAt: null,
  expiredAt: null,
});

test('sortPoolByVotes orders by vote count desc and attaches counts', () => {
  const rows = sortPoolByVotes(
    [sub(1), sub(2), sub(3)],
    [
      { submissionId: 2, voteCount: 5 },
      { submissionId: 3, voteCount: 2 },
    ]
  );
  expect(rows.map((row) => row.id)).toEqual([2, 3, 1]);
  expect(rows.find((row) => row.id === 1)!.voteCount).toBe(0);
});
