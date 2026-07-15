import { createServerFn } from '@tanstack/react-start';
import { getCurrentVotingPeriod } from '../../../src/utils/week';
import { requireMemberFn } from './membership';

export const castVoteFn = createServerFn({ method: 'POST' })
  .validator((data: { submissionId: number }) => data)
  .handler(async ({ data }) => {
    const member = await requireMemberFn();
    const { upsertVote, getSubmissionById } = await import(
      '../../../src/db/book-club-picks'
    );
    const submission = getSubmissionById(data.submissionId);
    if (
      submission == null ||
      submission.expiredAt != null ||
      submission.discussedAt != null
    ) {
      throw new Error('That article is not open for voting.');
    }
    upsertVote({
      submissionId: data.submissionId,
      userId: member.userId,
      weekIdentifier: getCurrentVotingPeriod(),
    });
    return { ok: true as const };
  });
