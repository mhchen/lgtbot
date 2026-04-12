import { describe, expect, test, beforeEach } from 'bun:test';
import { sql } from 'drizzle-orm';
import { subDays } from 'date-fns';
import { db } from '../db/index';
import {
  bookClubSubmissions,
  bookClubVotes,
  bookClubVoteMessages,
} from '../db/schema';
import {
  createSubmission,
  getActivePool,
  findActiveByUrl,
  findDiscussedByUrl,
  upsertVote,
  getUserVoteForWeek,
  markAsDiscussed,
  getRecentlyDiscussed,
  trackVoteMessage,
  getVoteMessagesForSubmission,
  getVoteCountsAllTime,
  expireStaleSubmissions,
} from '../db/book-club-picks';
import { normalizeUrl, selectWinner } from '../book-club-picks';
import { getCurrentVotingPeriod } from '../utils/week';

describe('normalizeUrl', () => {
  test('strips query parameters', () => {
    expect(normalizeUrl('https://example.com/article?utm_source=twitter')).toBe(
      'https://example.com/article'
    );
  });

  test('strips fragment', () => {
    expect(normalizeUrl('https://example.com/article#section-1')).toBe(
      'https://example.com/article'
    );
  });

  test('strips trailing slash', () => {
    expect(normalizeUrl('https://example.com/article/')).toBe(
      'https://example.com/article'
    );
  });

  test('lowercases hostname only', () => {
    expect(normalizeUrl('https://EXAMPLE.COM/Article-1')).toBe(
      'https://example.com/Article-1'
    );
  });

  test('handles all normalizations together', () => {
    expect(normalizeUrl('https://EXAMPLE.COM/Article-1/?ref=foo#heading')).toBe(
      'https://example.com/Article-1'
    );
  });

  test('preserves path case sensitivity', () => {
    expect(normalizeUrl('https://example.com/MyRepo/README')).toBe(
      'https://example.com/MyRepo/README'
    );
  });
});

describe('getCurrentVotingPeriod', () => {
  // April 2026 is EDT (UTC-4). Tuesday 2026-04-07 09:00 EDT = 13:00 UTC.
  test('right at Tue 9am ET rolls to the new period', () => {
    const nowUtc = new Date('2026-04-07T13:00:00Z');
    expect(getCurrentVotingPeriod(nowUtc)).toBe('2026-04-07');
  });

  test('one minute before Tue 9am ET still belongs to the previous period', () => {
    const nowUtc = new Date('2026-04-07T12:59:00Z');
    expect(getCurrentVotingPeriod(nowUtc)).toBe('2026-03-31');
  });

  test('mid-week defaults to the most recent Tuesday 9am ET', () => {
    // Wednesday 2026-04-08 12:00 EDT = 16:00 UTC
    const nowUtc = new Date('2026-04-08T16:00:00Z');
    expect(getCurrentVotingPeriod(nowUtc)).toBe('2026-04-07');
  });

  test('sunday still maps back to the prior Tuesday', () => {
    // Sunday 2026-04-12 10:00 EDT = 14:00 UTC
    const nowUtc = new Date('2026-04-12T14:00:00Z');
    expect(getCurrentVotingPeriod(nowUtc)).toBe('2026-04-07');
  });

  test('monday 11pm ET still belongs to the prior Tuesday', () => {
    // Monday 2026-04-13 23:59 EDT = Tuesday 2026-04-14 03:59 UTC
    const nowUtc = new Date('2026-04-14T03:59:00Z');
    expect(getCurrentVotingPeriod(nowUtc)).toBe('2026-04-07');
  });

  test('handles standard time (EST) correctly', () => {
    // Tuesday 2026-01-06 09:00 EST = 14:00 UTC
    const nowUtc = new Date('2026-01-06T14:00:00Z');
    expect(getCurrentVotingPeriod(nowUtc)).toBe('2026-01-06');
  });

  test('handles standard time boundary one minute early', () => {
    // Tuesday 2026-01-06 08:59 EST = 13:59 UTC → previous period
    const nowUtc = new Date('2026-01-06T13:59:00Z');
    expect(getCurrentVotingPeriod(nowUtc)).toBe('2025-12-30');
  });
});

describe('selectWinner', () => {
  const pool = [
    { id: 1, title: 'A' },
    { id: 2, title: 'B' },
    { id: 3, title: 'C' },
  ] as ReturnType<typeof getActivePool>;

  test('picks the article with the most votes', () => {
    const voteCounts = [
      { submissionId: 1, voteCount: 3 },
      { submissionId: 2, voteCount: 1 },
    ];
    const result = selectWinner(pool, voteCounts);
    expect(result.winner.id).toBe(1);
    expect(result.tiebreak).toBe(false);
    expect(result.noVotes).toBe(false);
  });

  test('returns noVotes when vote counts are empty', () => {
    const result = selectWinner(pool, []);
    expect(result.noVotes).toBe(true);
    expect(pool.map((p) => p.id)).toContain(result.winner.id);
  });

  test('marks tiebreak when top articles are tied', () => {
    const voteCounts = [
      { submissionId: 1, voteCount: 2 },
      { submissionId: 2, voteCount: 2 },
    ];
    const result = selectWinner(pool, voteCounts);
    expect(result.tiebreak).toBe(true);
    expect([1, 2]).toContain(result.winner.id);
  });
});

describe('book club picks DB', () => {
  beforeEach(() => {
    db.delete(bookClubVoteMessages).run();
    db.delete(bookClubVotes).run();
    db.delete(bookClubSubmissions).run();
  });

  test('creates a submission and retrieves it in active pool', () => {
    const submission = createSubmission({
      url: 'https://example.com/article',
      title: 'Great article',
      submittedBy: 'user1',
    });

    expect(submission.id).toBeDefined();

    const pool = getActivePool();
    expect(pool).toHaveLength(1);
    expect(pool[0].title).toBe('Great article');
  });

  test('findActiveByUrl finds active pool duplicates', () => {
    createSubmission({
      url: 'https://example.com/article',
      title: 'Great article',
      submittedBy: 'user1',
    });

    const found = findActiveByUrl('https://example.com/article');
    expect(found).not.toBeNull();
    expect(found!.title).toBe('Great article');
  });

  test('findActiveByUrl does not return discussed articles', () => {
    const submission = createSubmission({
      url: 'https://example.com/article',
      title: 'Great article',
      submittedBy: 'user1',
    });

    markAsDiscussed(submission.id);

    const found = findActiveByUrl('https://example.com/article');
    expect(found).toBeNull();
  });

  test('findDiscussedByUrl finds previously discussed articles', () => {
    const submission = createSubmission({
      url: 'https://example.com/article',
      title: 'Great article',
      submittedBy: 'user1',
    });

    markAsDiscussed(submission.id);

    const found = findDiscussedByUrl('https://example.com/article');
    expect(found).not.toBeNull();
    expect(found!.discussedAt).not.toBeNull();
  });

  test('upsertVote creates a new vote', () => {
    const submission = createSubmission({
      url: 'https://example.com/article',
      title: 'Great article',
      submittedBy: 'user1',
    });

    const result = upsertVote({
      submissionId: submission.id,
      userId: 'voter1',
      weekIdentifier: '2026-04-07',
    });

    expect(result.submissionId).toBe(submission.id);

    const vote = getUserVoteForWeek('voter1', '2026-04-07');
    expect(vote).not.toBeNull();
    expect(vote!.submissionId).toBe(submission.id);
  });

  test('upsertVote changes an existing vote', () => {
    const sub1 = createSubmission({
      url: 'https://example.com/article-1',
      title: 'Article 1',
      submittedBy: 'user1',
    });
    const sub2 = createSubmission({
      url: 'https://example.com/article-2',
      title: 'Article 2',
      submittedBy: 'user2',
    });

    upsertVote({
      submissionId: sub1.id,
      userId: 'voter1',
      weekIdentifier: '2026-04-07',
    });
    upsertVote({
      submissionId: sub2.id,
      userId: 'voter1',
      weekIdentifier: '2026-04-07',
    });

    const userVote = getUserVoteForWeek('voter1', '2026-04-07');
    expect(userVote).not.toBeNull();
    expect(userVote!.submissionId).toBe(sub2.id);
  });

  test('votes from different periods are independent', () => {
    const submission = createSubmission({
      url: 'https://example.com/article',
      title: 'Great article',
      submittedBy: 'user1',
    });

    upsertVote({
      submissionId: submission.id,
      userId: 'voter1',
      weekIdentifier: '2026-03-31',
    });
    upsertVote({
      submissionId: submission.id,
      userId: 'voter1',
      weekIdentifier: '2026-04-07',
    });

    const earlier = getUserVoteForWeek('voter1', '2026-03-31');
    const later = getUserVoteForWeek('voter1', '2026-04-07');
    expect(earlier).not.toBeNull();
    expect(later).not.toBeNull();
    expect(earlier!.id).not.toBe(later!.id);
  });

  test('markAsDiscussed removes article from active pool', () => {
    const submission = createSubmission({
      url: 'https://example.com/article',
      title: 'Great article',
      submittedBy: 'user1',
    });

    expect(getActivePool()).toHaveLength(1);

    markAsDiscussed(submission.id);

    expect(getActivePool()).toHaveLength(0);
  });

  test('getRecentlyDiscussed returns discussed articles sorted by date', () => {
    const sub1 = createSubmission({
      url: 'https://example.com/article-1',
      title: 'Article 1',
      submittedBy: 'user1',
    });
    const sub2 = createSubmission({
      url: 'https://example.com/article-2',
      title: 'Article 2',
      submittedBy: 'user2',
    });

    markAsDiscussed(sub1.id);
    markAsDiscussed(sub2.id);

    const history = getRecentlyDiscussed(10);
    expect(history).toHaveLength(2);
    // Most recent first
    expect(history[0].title).toBe('Article 2');
  });

  test('getVoteCountsAllTime sums votes across all periods', () => {
    const sub1 = createSubmission({
      url: 'https://example.com/a1',
      title: 'Article 1',
      submittedBy: 'user1',
    });
    const sub2 = createSubmission({
      url: 'https://example.com/a2',
      title: 'Article 2',
      submittedBy: 'user2',
    });

    upsertVote({
      submissionId: sub1.id,
      userId: 'v1',
      weekIdentifier: '2026-03-31',
    });
    upsertVote({
      submissionId: sub1.id,
      userId: 'v2',
      weekIdentifier: '2026-04-07',
    });
    upsertVote({
      submissionId: sub1.id,
      userId: 'v1',
      weekIdentifier: '2026-04-07',
    });
    upsertVote({
      submissionId: sub2.id,
      userId: 'v3',
      weekIdentifier: '2026-04-07',
    });

    const counts = getVoteCountsAllTime();
    const countMap = new Map(counts.map((c) => [c.submissionId, c.voteCount]));
    // sub1 gets v1@2026-03-31, v2@2026-04-07, v1@2026-04-07 — 3 distinct rows
    // sub2 gets v3@2026-04-07 — 1 row
    expect(countMap.get(sub1.id)).toBe(3);
    expect(countMap.get(sub2.id)).toBe(1);
  });

  test('getVoteCountsAllTime excludes discussed and expired submissions', () => {
    const active = createSubmission({
      url: 'https://example.com/active',
      title: 'Active',
      submittedBy: 'user1',
    });
    const discussed = createSubmission({
      url: 'https://example.com/discussed',
      title: 'Already discussed',
      submittedBy: 'user2',
    });
    const expired = createSubmission({
      url: 'https://example.com/expired',
      title: 'Stale',
      submittedBy: 'user3',
    });

    upsertVote({
      submissionId: active.id,
      userId: 'v1',
      weekIdentifier: '2026-04-07',
    });
    upsertVote({
      submissionId: discussed.id,
      userId: 'v2',
      weekIdentifier: '2026-04-07',
    });
    upsertVote({
      submissionId: expired.id,
      userId: 'v3',
      weekIdentifier: '2026-04-07',
    });

    markAsDiscussed(discussed.id);
    db.update(bookClubSubmissions)
      .set({ submittedAt: subDays(new Date(), 30) })
      .where(sql`id = ${expired.id}`)
      .run();
    db.update(bookClubVotes)
      .set({ votedAt: subDays(new Date(), 30) })
      .where(sql`submission_id = ${expired.id}`)
      .run();
    expireStaleSubmissions(subDays(new Date(), 14));

    const counts = getVoteCountsAllTime();
    const countMap = new Map(counts.map((c) => [c.submissionId, c.voteCount]));
    expect(countMap.get(active.id)).toBe(1);
    expect(countMap.get(discussed.id)).toBeUndefined();
    expect(countMap.get(expired.id)).toBeUndefined();
  });

  test('getActivePool excludes expired submissions', () => {
    const active = createSubmission({
      url: 'https://example.com/active',
      title: 'Active',
      submittedBy: 'user1',
    });
    const expired = createSubmission({
      url: 'https://example.com/expired',
      title: 'Expired',
      submittedBy: 'user2',
    });

    // Force this one's submittedAt far in the past and expire it.
    db.update(bookClubSubmissions)
      .set({ submittedAt: subDays(new Date(), 30) })
      .where(sql`id = ${expired.id}`)
      .run();
    expireStaleSubmissions(subDays(new Date(), 14));

    const pool = getActivePool();
    expect(pool).toHaveLength(1);
    expect(pool[0].id).toBe(active.id);
  });

  test('findActiveByUrl ignores expired submissions so they can be resubmitted', () => {
    const submission = createSubmission({
      url: 'https://example.com/article',
      title: 'Article',
      submittedBy: 'user1',
    });
    db.update(bookClubSubmissions)
      .set({ submittedAt: subDays(new Date(), 30) })
      .where(sql`id = ${submission.id}`)
      .run();
    expireStaleSubmissions(subDays(new Date(), 14));

    expect(findActiveByUrl('https://example.com/article')).toBeNull();
    // Also should NOT appear as "previously discussed" — it was never discussed.
    expect(findDiscussedByUrl('https://example.com/article')).toBeNull();
  });

  test('expireStaleSubmissions leaves fresh submissions alone', () => {
    const fresh = createSubmission({
      url: 'https://example.com/fresh',
      title: 'Fresh',
      submittedBy: 'user1',
    });

    const expired = expireStaleSubmissions(subDays(new Date(), 14));

    expect(expired).toHaveLength(0);
    expect(getActivePool().map((s) => s.id)).toContain(fresh.id);
  });

  test('expireStaleSubmissions leaves submissions with recent votes alone even if old', () => {
    const old = createSubmission({
      url: 'https://example.com/old',
      title: 'Old but loved',
      submittedBy: 'user1',
    });

    // Submitted long ago, but someone just voted for it yesterday.
    db.update(bookClubSubmissions)
      .set({ submittedAt: subDays(new Date(), 90) })
      .where(sql`id = ${old.id}`)
      .run();
    upsertVote({
      submissionId: old.id,
      userId: 'loyal-voter',
      weekIdentifier: '2026-04-07',
    });
    // Backdate the vote to 1 day ago (still within the 2-week window).
    db.update(bookClubVotes)
      .set({ votedAt: subDays(new Date(), 1) })
      .where(sql`submission_id = ${old.id}`)
      .run();

    const expired = expireStaleSubmissions(subDays(new Date(), 14));
    expect(expired).toHaveLength(0);
  });

  test('expireStaleSubmissions marks submissions whose last vote was long ago', () => {
    const stale = createSubmission({
      url: 'https://example.com/stale',
      title: 'Stale',
      submittedBy: 'user1',
    });

    upsertVote({
      submissionId: stale.id,
      userId: 'voter',
      weekIdentifier: '2026-03-17',
    });
    // Backdate both the submission and the vote well past the cutoff.
    db.update(bookClubSubmissions)
      .set({ submittedAt: subDays(new Date(), 30) })
      .where(sql`id = ${stale.id}`)
      .run();
    db.update(bookClubVotes)
      .set({ votedAt: subDays(new Date(), 21) })
      .where(sql`submission_id = ${stale.id}`)
      .run();

    const expired = expireStaleSubmissions(subDays(new Date(), 14));
    expect(expired).toHaveLength(1);
    expect(expired[0].id).toBe(stale.id);
    expect(getActivePool()).toHaveLength(0);
  });

  test('expireStaleSubmissions does not touch already-discussed submissions', () => {
    const winner = createSubmission({
      url: 'https://example.com/winner',
      title: 'Winner',
      submittedBy: 'user1',
    });
    markAsDiscussed(winner.id);
    db.update(bookClubSubmissions)
      .set({ submittedAt: subDays(new Date(), 30) })
      .where(sql`id = ${winner.id}`)
      .run();

    const expired = expireStaleSubmissions(subDays(new Date(), 14));
    expect(expired).toHaveLength(0);
  });

  test('trackVoteMessage and getVoteMessagesForSubmission', () => {
    const submission = createSubmission({
      url: 'https://example.com/article',
      title: 'Great article',
      submittedBy: 'user1',
    });

    trackVoteMessage({
      submissionId: submission.id,
      messageId: 'msg123',
      channelId: 'chan456',
    });

    const messages = getVoteMessagesForSubmission(submission.id);
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('msg123');
  });
});
