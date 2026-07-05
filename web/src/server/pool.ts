import { createServerFn } from '@tanstack/react-start';
import {
  getActivePool,
  getVoteCountsAllTime,
  getUserVoteForWeek,
} from '../../../src/db/book-club-picks';
import { getCurrentVotingPeriod } from '../../../src/utils/week';
import { requireMemberFn } from './membership';

type Submission = ReturnType<typeof getActivePool>[number];
export type PoolRow = Submission & { voteCount: number };

export function sortPoolByVotes(
  pool: Submission[],
  voteCounts: { submissionId: number; voteCount: number }[],
): PoolRow[] {
  const voteMap = new Map(voteCounts.map((vote) => [vote.submissionId, vote.voteCount]));
  return pool
    .map((submission) => ({ ...submission, voteCount: voteMap.get(submission.id) ?? 0 }))
    .sort((a, b) => b.voteCount - a.voteCount);
}

export const getPoolFn = createServerFn({ method: 'GET' }).handler(async () => {
  const member = await requireMemberFn();
  const rows = sortPoolByVotes(getActivePool(), getVoteCountsAllTime());
  const currentVote = getUserVoteForWeek(member.userId, getCurrentVotingPeriod());
  return { rows, currentVoteId: currentVote?.submissionId ?? null };
});
