import { db } from './index';
import {
  bookClubSubmissions,
  bookClubVotes,
  bookClubVoteMessages,
} from './schema';
import { eq, and, isNull, isNotNull, desc, sql, inArray } from 'drizzle-orm';

export function createSubmission(data: {
  url: string;
  title: string;
  submittedBy: string;
}) {
  return db.insert(bookClubSubmissions).values(data).returning().get();
}

export function getActivePool() {
  return db
    .select()
    .from(bookClubSubmissions)
    .where(
      and(
        isNull(bookClubSubmissions.discussedAt),
        isNull(bookClubSubmissions.expiredAt)
      )
    )
    .orderBy(bookClubSubmissions.submittedAt)
    .all();
}

export function findActiveByUrl(url: string) {
  return (
    db
      .select()
      .from(bookClubSubmissions)
      .where(
        and(
          eq(bookClubSubmissions.url, url),
          isNull(bookClubSubmissions.discussedAt),
          isNull(bookClubSubmissions.expiredAt)
        )
      )
      .get() ?? null
  );
}

export function findDiscussedByUrl(url: string) {
  return (
    db
      .select()
      .from(bookClubSubmissions)
      .where(
        and(
          eq(bookClubSubmissions.url, url),
          isNotNull(bookClubSubmissions.discussedAt)
        )
      )
      .orderBy(desc(bookClubSubmissions.discussedAt))
      .get() ?? null
  );
}

export function getSubmissionById(id: number) {
  return (
    db
      .select()
      .from(bookClubSubmissions)
      .where(eq(bookClubSubmissions.id, id))
      .get() ?? null
  );
}

export function upsertVote(data: {
  submissionId: number;
  userId: string;
  weekIdentifier: string;
}) {
  return db
    .insert(bookClubVotes)
    .values({
      submissionId: data.submissionId,
      userId: data.userId,
      weekIdentifier: data.weekIdentifier,
    })
    .onConflictDoUpdate({
      target: [bookClubVotes.userId, bookClubVotes.weekIdentifier],
      set: {
        submissionId: data.submissionId,
        votedAt: sql`${Date.now()}`,
      },
    })
    .returning()
    .get();
}

export function getUserVoteForWeek(userId: string, weekIdentifier: string) {
  return (
    db
      .select()
      .from(bookClubVotes)
      .where(
        and(
          eq(bookClubVotes.userId, userId),
          eq(bookClubVotes.weekIdentifier, weekIdentifier)
        )
      )
      .get() ?? null
  );
}

export function getVoteCountsAllTime() {
  return db
    .select({
      submissionId: bookClubVotes.submissionId,
      voteCount: sql<number>`count(*)`.as('vote_count'),
    })
    .from(bookClubVotes)
    .innerJoin(
      bookClubSubmissions,
      eq(bookClubSubmissions.id, bookClubVotes.submissionId)
    )
    .where(
      and(
        isNull(bookClubSubmissions.discussedAt),
        isNull(bookClubSubmissions.expiredAt)
      )
    )
    .groupBy(bookClubVotes.submissionId)
    .all();
}

// Mark any non-discussed, non-expired submission stale if its most recent
// signal of interest (a vote, or the submission itself if never voted on)
// is older than the cutoff. Returns the rows that were expired.
export function expireStaleSubmissions(cutoff: Date) {
  const cutoffMs = cutoff.getTime();
  return db
    .update(bookClubSubmissions)
    .set({ expiredAt: sql`(strftime('%s', 'now') * 1000)` })
    .where(
      and(
        isNull(bookClubSubmissions.discussedAt),
        isNull(bookClubSubmissions.expiredAt),
        sql`${bookClubSubmissions.id} IN (
          SELECT s.id FROM ${bookClubSubmissions} s
          LEFT JOIN ${bookClubVotes} v ON v.submission_id = s.id
          GROUP BY s.id
          HAVING COALESCE(MAX(v.voted_at), s.submitted_at) <= ${cutoffMs}
        )`
      )
    )
    .returning()
    .all();
}

export function markAsDiscussed(submissionId: number) {
  return db
    .update(bookClubSubmissions)
    .set({ discussedAt: sql`${Date.now()}` })
    .where(eq(bookClubSubmissions.id, submissionId))
    .returning()
    .get();
}

export function getRecentlyDiscussed(limit: number) {
  return db
    .select()
    .from(bookClubSubmissions)
    .where(isNotNull(bookClubSubmissions.discussedAt))
    .orderBy(desc(bookClubSubmissions.discussedAt))
    .limit(limit)
    .all();
}

export function trackVoteMessage(data: {
  submissionId: number;
  messageId: string;
  channelId: string;
}) {
  return db.insert(bookClubVoteMessages).values(data).returning().get();
}

export function getVoteMessagesForSubmission(submissionId: number) {
  return db
    .select({
      messageId: bookClubVoteMessages.messageId,
      channelId: bookClubVoteMessages.channelId,
      submissionId: bookClubVoteMessages.submissionId,
    })
    .from(bookClubVoteMessages)
    .where(eq(bookClubVoteMessages.submissionId, submissionId))
    .all();
}

export function getVoteMessagesForSubmissions(submissionIds: number[]) {
  if (submissionIds.length === 0) return [];
  return db
    .select({
      messageId: bookClubVoteMessages.messageId,
      channelId: bookClubVoteMessages.channelId,
      submissionId: bookClubVoteMessages.submissionId,
    })
    .from(bookClubVoteMessages)
    .where(inArray(bookClubVoteMessages.submissionId, submissionIds))
    .all();
}
