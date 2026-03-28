import { describe, expect, test, beforeEach } from 'bun:test';
import { db } from '../db/index';
import {
  bookClubSubmissions,
  bookClubVotes,
  bookClubVoteMessages,
} from '../db/schema';
import {
  createSubmission,
  getActivePool,
  findByNormalizedUrl,
  getDiscussedByNormalizedUrl,
  upsertVote,
  getVotesForWeek,
  getUserVoteForWeek,
  markAsDiscussed,
  getRecentlyDiscussed,
  trackVoteMessage,
  getVoteMessagesForSubmission,
  getVoteCountsForWeek,
} from '../db/book-club-picks';
import { normalizeUrl, selectWinner } from '../book-club-picks';

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
      normalizedUrl: 'https://example.com/article',
      title: 'Great article',
      submittedBy: 'user1',
    });

    expect(submission.id).toBeDefined();

    const pool = getActivePool();
    expect(pool).toHaveLength(1);
    expect(pool[0].title).toBe('Great article');
  });

  test('findByNormalizedUrl finds active pool duplicates', () => {
    createSubmission({
      url: 'https://example.com/article',
      normalizedUrl: 'https://example.com/article',
      title: 'Great article',
      submittedBy: 'user1',
    });

    const found = findByNormalizedUrl('https://example.com/article');
    expect(found).not.toBeNull();
    expect(found!.title).toBe('Great article');
  });

  test('findByNormalizedUrl does not return discussed articles', () => {
    const submission = createSubmission({
      url: 'https://example.com/article',
      normalizedUrl: 'https://example.com/article',
      title: 'Great article',
      submittedBy: 'user1',
    });

    markAsDiscussed(submission.id);

    const found = findByNormalizedUrl('https://example.com/article');
    expect(found).toBeNull();
  });

  test('getDiscussedByNormalizedUrl finds previously discussed articles', () => {
    const submission = createSubmission({
      url: 'https://example.com/article',
      normalizedUrl: 'https://example.com/article',
      title: 'Great article',
      submittedBy: 'user1',
    });

    markAsDiscussed(submission.id);

    const found = getDiscussedByNormalizedUrl('https://example.com/article');
    expect(found).not.toBeNull();
    expect(found!.discussedAt).not.toBeNull();
  });

  test('upsertVote creates a new vote', () => {
    const submission = createSubmission({
      url: 'https://example.com/article',
      normalizedUrl: 'https://example.com/article',
      title: 'Great article',
      submittedBy: 'user1',
    });

    const result = upsertVote({
      submissionId: submission.id,
      userId: 'voter1',
      weekIdentifier: '2026-W13',
    });

    expect(result.submissionId).toBe(submission.id);

    const votes = getVotesForWeek('2026-W13');
    expect(votes).toHaveLength(1);
  });

  test('upsertVote changes an existing vote', () => {
    const sub1 = createSubmission({
      url: 'https://example.com/article-1',
      normalizedUrl: 'https://example.com/article-1',
      title: 'Article 1',
      submittedBy: 'user1',
    });
    const sub2 = createSubmission({
      url: 'https://example.com/article-2',
      normalizedUrl: 'https://example.com/article-2',
      title: 'Article 2',
      submittedBy: 'user2',
    });

    upsertVote({
      submissionId: sub1.id,
      userId: 'voter1',
      weekIdentifier: '2026-W13',
    });
    upsertVote({
      submissionId: sub2.id,
      userId: 'voter1',
      weekIdentifier: '2026-W13',
    });

    const userVote = getUserVoteForWeek('voter1', '2026-W13');
    expect(userVote).not.toBeNull();
    expect(userVote!.submissionId).toBe(sub2.id);

    // Should still only be one vote total for this user/week
    const allVotes = getVotesForWeek('2026-W13');
    expect(allVotes).toHaveLength(1);
  });

  test('votes from different weeks are independent', () => {
    const submission = createSubmission({
      url: 'https://example.com/article',
      normalizedUrl: 'https://example.com/article',
      title: 'Great article',
      submittedBy: 'user1',
    });

    upsertVote({
      submissionId: submission.id,
      userId: 'voter1',
      weekIdentifier: '2026-W12',
    });
    upsertVote({
      submissionId: submission.id,
      userId: 'voter1',
      weekIdentifier: '2026-W13',
    });

    const w12 = getVotesForWeek('2026-W12');
    const w13 = getVotesForWeek('2026-W13');
    expect(w12).toHaveLength(1);
    expect(w13).toHaveLength(1);
  });

  test('markAsDiscussed removes article from active pool', () => {
    const submission = createSubmission({
      url: 'https://example.com/article',
      normalizedUrl: 'https://example.com/article',
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
      normalizedUrl: 'https://example.com/article-1',
      title: 'Article 1',
      submittedBy: 'user1',
    });
    const sub2 = createSubmission({
      url: 'https://example.com/article-2',
      normalizedUrl: 'https://example.com/article-2',
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

  test('getVoteCountsForWeek returns counts per submission', () => {
    const sub1 = createSubmission({
      url: 'https://example.com/a1',
      normalizedUrl: 'https://example.com/a1',
      title: 'Article 1',
      submittedBy: 'user1',
    });
    const sub2 = createSubmission({
      url: 'https://example.com/a2',
      normalizedUrl: 'https://example.com/a2',
      title: 'Article 2',
      submittedBy: 'user2',
    });

    upsertVote({
      submissionId: sub1.id,
      userId: 'v1',
      weekIdentifier: '2026-W13',
    });
    upsertVote({
      submissionId: sub1.id,
      userId: 'v2',
      weekIdentifier: '2026-W13',
    });
    upsertVote({
      submissionId: sub2.id,
      userId: 'v3',
      weekIdentifier: '2026-W13',
    });

    const counts = getVoteCountsForWeek('2026-W13');
    const countMap = new Map(counts.map((c) => [c.submissionId, c.voteCount]));
    expect(countMap.get(sub1.id)).toBe(2);
    expect(countMap.get(sub2.id)).toBe(1);
  });

  test('trackVoteMessage and getVoteMessagesForSubmission', () => {
    const submission = createSubmission({
      url: 'https://example.com/article',
      normalizedUrl: 'https://example.com/article',
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
