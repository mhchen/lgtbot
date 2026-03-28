import { db } from './index';
import {
  bookClubSubmissions,
  bookClubVotes,
  bookClubVoteMessages,
} from './schema';
import { eq, and, isNull, isNotNull, desc, sql } from 'drizzle-orm';

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
    .where(isNull(bookClubSubmissions.discussedAt))
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
          isNull(bookClubSubmissions.discussedAt)
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

export function getVotesForWeek(weekIdentifier: string) {
  return db
    .select()
    .from(bookClubVotes)
    .where(eq(bookClubVotes.weekIdentifier, weekIdentifier))
    .all();
}

export function getVoteCountsForWeek(weekIdentifier: string) {
  return db
    .select({
      submissionId: bookClubVotes.submissionId,
      voteCount: sql<number>`count(*)`.as('vote_count'),
    })
    .from(bookClubVotes)
    .where(eq(bookClubVotes.weekIdentifier, weekIdentifier))
    .groupBy(bookClubVotes.submissionId)
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
