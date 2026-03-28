# Book club picks implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add article submission, voting, and automated weekly selection to the book club feature.

**Architecture:** Three new DB tables (submissions, votes, vote_messages) with a feature module following the existing pattern (src/book-club-picks.ts + src/db/book-club-picks.ts). Slash commands extend the existing `/lgt bookclub` group. Inline vote buttons on submission announcements. Cron-based scheduling for reminders and vote close.

**Tech Stack:** Bun, discord.js v14, Drizzle ORM + SQLite, node-cron, date-fns

**Spec:** `docs/superpowers/specs/2026-03-26-book-club-picks-design.md`

---

## File structure

### New files

- `src/book-club-picks.ts` — main feature module: command handlers, button interaction handlers, cron setup, URL normalization, title extraction
- `src/db/book-club-picks.ts` — database query functions (submissions CRUD, vote upsert, vote tallying, vote message tracking)
- `src/__tests__/book-club-picks.test.ts` — tests

### Modified files

- `src/db/schema.ts` — add 3 new tables: `bookClubSubmissions`, `bookClubVotes`, `bookClubVoteMessages`
- `src/db/index.ts` — add CREATE TABLE statements for test in-memory DB
- `src/commands.ts` — add new subcommands (submit, vote, pool, history) to the existing `bookclub` group
- `src/index.ts` — add interaction routing for `bookclub-*` custom IDs, register cron jobs, import new module

---

## Task 1: Install node-cron and add schema

**Files:**

- Modify: `package.json`
- Modify: `src/db/schema.ts`
- Modify: `src/db/index.ts`

- [ ] **Step 1: Install node-cron**

```bash
bun add node-cron
bun add -d @types/node-cron
```

- [ ] **Step 2: Add the three new tables to schema.ts**

Add these after the existing `goals` table in `src/db/schema.ts`:

```typescript
export const bookClubSubmissions = sqliteTable(
  'book_club_submissions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    url: text('url').notNull(),
    normalizedUrl: text('normalized_url').notNull(),
    title: text('title').notNull(),
    submittedBy: text('submitted_by').notNull(),
    submittedAt: integer('submitted_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(strftime('%s', 'now') * 1000)`),
    discussedAt: integer('discussed_at', { mode: 'timestamp_ms' }),
  },
  (table) => ({
    normalizedUrlIdx: index('bc_submissions_normalized_url_idx').on(
      table.normalizedUrl
    ),
    discussedAtIdx: index('bc_submissions_discussed_at_idx').on(
      table.discussedAt
    ),
  })
);

export const bookClubVotes = sqliteTable(
  'book_club_votes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    submissionId: integer('submission_id').notNull(),
    userId: text('user_id').notNull(),
    weekIdentifier: text('week_identifier').notNull(),
    votedAt: integer('voted_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(strftime('%s', 'now') * 1000)`),
  },
  (table) => ({
    userWeekUnique: uniqueIndex('bc_votes_user_week_unique_idx').on(
      table.userId,
      table.weekIdentifier
    ),
    submissionIdx: index('bc_votes_submission_idx').on(table.submissionId),
    weekIdx: index('bc_votes_week_idx').on(table.weekIdentifier),
  })
);

export const bookClubVoteMessages = sqliteTable(
  'book_club_vote_messages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    submissionId: integer('submission_id').notNull(),
    messageId: text('message_id').notNull(),
    channelId: text('channel_id').notNull(),
  },
  (table) => ({
    submissionIdx: index('bc_vote_messages_submission_idx').on(
      table.submissionId
    ),
  })
);
```

- [ ] **Step 3: Add CREATE TABLE statements for in-memory test DB**

Add these to the `sqlite.run(...)` block in `src/db/index.ts`, after the existing `goals` table:

```sql
CREATE TABLE IF NOT EXISTS book_club_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  title TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  submitted_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
  discussed_at INTEGER
);

CREATE INDEX IF NOT EXISTS bc_submissions_normalized_url_idx ON book_club_submissions(normalized_url);
CREATE INDEX IF NOT EXISTS bc_submissions_discussed_at_idx ON book_club_submissions(discussed_at);

CREATE TABLE IF NOT EXISTS book_club_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  week_identifier TEXT NOT NULL,
  voted_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS bc_votes_user_week_unique_idx ON book_club_votes(user_id, week_identifier);
CREATE INDEX IF NOT EXISTS bc_votes_submission_idx ON book_club_votes(submission_id);
CREATE INDEX IF NOT EXISTS bc_votes_week_idx ON book_club_votes(week_identifier);

CREATE TABLE IF NOT EXISTS book_club_vote_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  message_id TEXT NOT NULL,
  channel_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS bc_vote_messages_submission_idx ON book_club_vote_messages(submission_id);
```

- [ ] **Step 4: Generate migration**

```bash
bun run db:generate
```

- [ ] **Step 5: Verify typecheck passes**

```bash
bun run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add book club picks schema and install node-cron"
```

---

## Task 2: Database query functions

**Files:**

- Create: `src/db/book-club-picks.ts`
- Test: `src/__tests__/book-club-picks.test.ts`

- [ ] **Step 1: Write tests for URL normalization and DB queries**

Create `src/__tests__/book-club-picks.test.ts`. These tests cover the pure DB and utility layer before any Discord interactions.

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test src/__tests__/book-club-picks.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create `src/book-club-picks.ts` with normalizeUrl and selectWinner exports**

```typescript
import type { getActivePool } from './db/book-club-picks';

export function normalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.search = '';
  url.hash = '';

  // Lowercase hostname only, preserve path case
  const normalized = `${url.protocol}//${url.hostname.toLowerCase()}${url.pathname}`;

  // Strip trailing slash (but keep root "/")
  if (normalized.endsWith('/') && url.pathname !== '/') {
    return normalized.slice(0, -1);
  }

  return normalized;
}

export function selectWinner(
  pool: ReturnType<typeof getActivePool>,
  voteCounts: { submissionId: number; voteCount: number }[]
): { winner: (typeof pool)[number]; tiebreak: boolean; noVotes: boolean } {
  if (voteCounts.length === 0) {
    return {
      winner: pool[Math.floor(Math.random() * pool.length)],
      tiebreak: false,
      noVotes: true,
    };
  }

  const voteMap = new Map(voteCounts.map((v) => [v.submissionId, v.voteCount]));
  const maxVotes = Math.max(...voteCounts.map((v) => v.voteCount));
  const tied = pool.filter((sub) => (voteMap.get(sub.id) ?? 0) === maxVotes);

  if (tied.length > 1) {
    return {
      winner: tied[Math.floor(Math.random() * tied.length)],
      tiebreak: true,
      noVotes: false,
    };
  }

  return { winner: tied[0], tiebreak: false, noVotes: false };
}
```

- [ ] **Step 4: Create `src/db/book-club-picks.ts` with all query functions**

```typescript
import { db } from './index';
import {
  bookClubSubmissions,
  bookClubVotes,
  bookClubVoteMessages,
} from './schema';
import { eq, and, isNull, isNotNull, desc, sql } from 'drizzle-orm';

export function createSubmission(data: {
  url: string;
  normalizedUrl: string;
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

export function findByNormalizedUrl(normalizedUrl: string) {
  return (
    db
      .select()
      .from(bookClubSubmissions)
      .where(
        and(
          eq(bookClubSubmissions.normalizedUrl, normalizedUrl),
          isNull(bookClubSubmissions.discussedAt)
        )
      )
      .get() ?? null
  );
}

export function getDiscussedByNormalizedUrl(normalizedUrl: string) {
  return (
    db
      .select()
      .from(bookClubSubmissions)
      .where(
        and(
          eq(bookClubSubmissions.normalizedUrl, normalizedUrl),
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
bun test src/__tests__/book-club-picks.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Run typecheck**

```bash
bun run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/db/book-club-picks.ts src/book-club-picks.ts src/__tests__/book-club-picks.test.ts
git commit -m "Add book club picks DB queries, URL normalization, and tests"
```

---

## Task 3: Slash command definitions

**Files:**

- Modify: `src/commands.ts`
- Modify: `src/book-club-picks.ts`

- [ ] **Step 1: Add `getBookClubPicksCommands` to `src/book-club-picks.ts`**

Add this function to `src/book-club-picks.ts` (after the existing `normalizeUrl`):

```typescript
import { SlashCommandSubcommandBuilder } from 'discord.js';

export function getBookClubPicksCommands(): SlashCommandSubcommandBuilder[] {
  return [
    new SlashCommandSubcommandBuilder()
      .setName('submit')
      .setDescription('Submit a blog post for book club')
      .addStringOption((option) =>
        option
          .setName('url')
          .setDescription('URL of the blog post')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('title')
          .setDescription('Title of the article (auto-detected if omitted)')
          .setRequired(false)
      ),
    new SlashCommandSubcommandBuilder()
      .setName('vote')
      .setDescription('Vote for which article to discuss this week'),
    new SlashCommandSubcommandBuilder()
      .setName('pool')
      .setDescription('View all articles in the current pool'),
    new SlashCommandSubcommandBuilder()
      .setName('history')
      .setDescription('View recently discussed articles'),
  ];
}
```

- [ ] **Step 2: Wire into `src/commands.ts`**

Import `getBookClubPicksCommands` from `./book-club-picks` and add the subcommands to the existing `bookclub` group. The existing `getBookClubCommands()` returns a function that builds the group. Modify `src/commands.ts` so that after adding the `bans` subcommand via `getBookClubCommands()`, the picks subcommands are also added to the same group.

The cleanest approach: modify the `bookclub` group builder in `src/book-club-bans.ts` to accept additional subcommands, OR build the bookclub group directly in `commands.ts`.

Since the bookclub group is currently built in `book-club-bans.ts` and that pattern would be awkward to extend, build the group directly in `commands.ts`:

```typescript
import { getBookClubPicksCommands } from './book-club-picks';

// Replace the .addSubcommandGroup(getBookClubCommands()) with:
.addSubcommandGroup((group) => {
  group
    .setName('bookclub')
    .setDescription('Book club commands')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('bans')
        .setDescription('Display the book club ban leaderboard')
    );
  for (const subcommand of getBookClubPicksCommands()) {
    group.addSubcommand(subcommand);
  }
  return group;
})
```

Then remove the `getBookClubCommands` import from `./book-club-bans` (and its export from `book-club-bans.ts`) since the bans subcommand definition is now inline in `commands.ts`.

- [ ] **Step 3: Run typecheck**

```bash
bun run typecheck
```

- [ ] **Step 4: Run existing tests to verify nothing broke**

```bash
bun test
```

- [ ] **Step 5: Commit**

```bash
git add src/commands.ts src/book-club-picks.ts src/book-club-bans.ts
git commit -m "Register book club picks slash commands"
```

---

## Task 4: Submit command handler

**Files:**

- Modify: `src/book-club-picks.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Add title extraction helper to `src/book-club-picks.ts`**

```typescript
export async function fetchTitle(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const html = await response.text();
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function fallbackTitle(url: string): string {
  const parsed = new URL(url);
  return `${parsed.hostname}${parsed.pathname}`;
}
```

- [ ] **Step 2: Add `handleSubmitCommand` to `src/book-club-picks.ts`**

```typescript
import {
  ChatInputCommandInteraction,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from 'discord.js';
import { normalizeUrl, fetchTitle } from './book-club-picks'; // self-import for the utility
import {
  createSubmission,
  findByNormalizedUrl,
  getDiscussedByNormalizedUrl,
  trackVoteMessage,
} from './db/book-club-picks';

export async function handleSubmitCommand(
  interaction: ChatInputCommandInteraction
) {
  const rawUrl = interaction.options.getString('url', true);
  const userTitle = interaction.options.getString('title');

  // Validate URL
  try {
    new URL(rawUrl);
  } catch {
    await interaction.reply({
      content: "That doesn't look like a valid URL.",
      ephemeral: true,
    });
    return;
  }

  const normalized = normalizeUrl(rawUrl);

  // Check active pool duplicate
  const activeMatch = findByNormalizedUrl(normalized);
  if (activeMatch) {
    await interaction.reply({
      content: `This article is already in the pool, submitted by <@${activeMatch.submittedBy}>.`,
      ephemeral: true,
    });
    return;
  }

  // Check previously discussed
  const discussedMatch = getDiscussedByNormalizedUrl(normalized);
  if (discussedMatch) {
    const discussedDate = new Date(
      discussedMatch.discussedAt!
    ).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const confirmButton = new ButtonBuilder()
      .setCustomId(`bookclub-resubmit-confirm-${discussedMatch.id}`)
      .setLabel('Submit anyway')
      .setStyle(ButtonStyle.Primary);

    const cancelButton = new ButtonBuilder()
      .setCustomId('bookclub-resubmit-cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    await interaction.reply({
      content: `This article was discussed on ${discussedDate}. Submit anyway?`,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          confirmButton,
          cancelButton
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  // Resolve title
  await interaction.deferReply();
  const title =
    userTitle || (await fetchTitle(rawUrl)) || fallbackTitle(rawUrl);

  // Create submission
  const submission = createSubmission({
    url: rawUrl,
    normalizedUrl: normalized,
    title,
    submittedBy: interaction.user.id,
  });

  // Post public announcement with vote button
  const voteButton = new ButtonBuilder()
    .setCustomId(`bookclub-vote-btn-${submission.id}`)
    .setLabel('Vote for this')
    .setStyle(ButtonStyle.Primary);

  const message = await interaction.editReply({
    content: `<@${interaction.user.id}> submitted: **${title}** - ${rawUrl}`,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(voteButton),
    ],
  });

  // Track the message for button disabling later
  trackVoteMessage({
    submissionId: submission.id,
    messageId: message.id,
    channelId: interaction.channelId,
  });
}
```

- [ ] **Step 3: Add `handleBookclubPicksCommand` router to `src/book-club-picks.ts`**

```typescript
export async function handleBookclubPicksCommand(
  interaction: ChatInputCommandInteraction
) {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'submit':
      await handleSubmitCommand(interaction);
      break;
    // vote, pool, history added in later tasks
  }
}
```

- [ ] **Step 4: Wire into `src/index.ts` command routing**

In the `switch (group)` block for `'bookclub'`, update to route the new subcommands:

```typescript
case 'bookclub': {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'bans') {
    await handleBookclubCommand(interaction);
  } else {
    await handleBookclubPicksCommand(interaction);
  }
  break;
}
```

Import `handleBookclubPicksCommand` from `./book-club-picks`.

- [ ] **Step 5: Run typecheck**

```bash
bun run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add src/book-club-picks.ts src/index.ts
git commit -m "Add submit command handler with URL validation and title extraction"
```

---

## Task 5: Vote command and inline vote button handler

**Files:**

- Modify: `src/book-club-picks.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Add `handleVoteCommand` to `src/book-club-picks.ts`**

```typescript
import { StringSelectMenuBuilder, ButtonInteraction } from 'discord.js';
import {
  getActivePool,
  getUserVoteForWeek,
  getSubmissionById,
  upsertVote,
} from './db/book-club-picks';
import { getCurrentWeek } from './utils/week';

async function handleVoteCommand(interaction: ChatInputCommandInteraction) {
  const pool = getActivePool();

  if (pool.length === 0) {
    await interaction.reply({
      content:
        'The pool is empty. Use `/lgt bookclub submit` to add an article!',
      ephemeral: true,
    });
    return;
  }

  const weekIdentifier = getCurrentWeek();
  const existingVote = getUserVoteForWeek(interaction.user.id, weekIdentifier);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`bookclub-vote-select-${interaction.user.id}`)
    .setPlaceholder('Pick an article to vote for')
    .addOptions(
      pool.map((sub) => ({
        label:
          sub.title.length > 100
            ? sub.title.substring(0, 97) + '...'
            : sub.title,
        description:
          sub.url.length > 100 ? sub.url.substring(0, 97) + '...' : sub.url,
        value: sub.id.toString(),
        default: existingVote?.submissionId === sub.id,
      }))
    );

  await interaction.reply({
    content: 'Vote for an article to discuss this week:',
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu),
    ],
    ephemeral: true,
  });
}
```

- [ ] **Step 2: Add vote select menu handler**

```typescript
import { StringSelectMenuInteraction } from 'discord.js';

async function handleVoteSelectMenu(interaction: StringSelectMenuInteraction) {
  const submissionId = parseInt(interaction.values[0]);
  const weekIdentifier = getCurrentWeek();

  const existingVote = getUserVoteForWeek(interaction.user.id, weekIdentifier);
  const submission = getSubmissionById(submissionId);

  if (!submission) {
    await interaction.reply({
      content: 'That article no longer exists.',
      ephemeral: true,
    });
    return;
  }

  upsertVote({
    submissionId,
    userId: interaction.user.id,
    weekIdentifier,
  });

  if (existingVote && existingVote.submissionId !== submissionId) {
    const oldSubmission = getSubmissionById(existingVote.submissionId);
    await interaction.reply({
      content: `Vote changed from **${oldSubmission?.title ?? 'unknown'}** to **${submission.title}**`,
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: `Vote registered for **${submission.title}**!`,
      ephemeral: true,
    });
  }
}
```

- [ ] **Step 3: Add inline vote button handler**

```typescript
async function handleVoteButton(interaction: ButtonInteraction) {
  const submissionId = parseInt(
    interaction.customId.replace('bookclub-vote-btn-', '')
  );
  const weekIdentifier = getCurrentWeek();

  const submission = getSubmissionById(submissionId);
  if (!submission) {
    await interaction.reply({
      content: 'That article no longer exists.',
      ephemeral: true,
    });
    return;
  }

  const existingVote = getUserVoteForWeek(interaction.user.id, weekIdentifier);

  upsertVote({
    submissionId,
    userId: interaction.user.id,
    weekIdentifier,
  });

  if (existingVote && existingVote.submissionId !== submissionId) {
    const oldSubmission = getSubmissionById(existingVote.submissionId);
    await interaction.reply({
      content: `Vote changed from **${oldSubmission?.title ?? 'unknown'}** to **${submission.title}**`,
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: `Vote registered for **${submission.title}**!`,
      ephemeral: true,
    });
  }
}
```

- [ ] **Step 4: Add resubmit button handlers**

```typescript
async function handleResubmitConfirm(interaction: ButtonInteraction) {
  // The submission ID in the custom ID refers to the OLD discussed submission.
  // We re-derive URL/title from it since ephemeral interactions don't persist state.
  const oldSubmissionId = parseInt(
    interaction.customId.replace('bookclub-resubmit-confirm-', '')
  );

  const oldSubmission = getSubmissionById(oldSubmissionId);
  if (!oldSubmission) {
    await interaction.reply({
      content:
        'Could not find the original article. Please try submitting again.',
      ephemeral: true,
    });
    return;
  }

  // Check for active pool duplicate (someone may have submitted it in the meantime)
  const activeMatch = findByNormalizedUrl(oldSubmission.normalizedUrl);
  if (activeMatch) {
    await interaction.reply({
      content: `This article was already resubmitted by <@${activeMatch.submittedBy}>.`,
      ephemeral: true,
    });
    return;
  }

  // Dismiss the ephemeral confirm/cancel message
  await interaction.deferUpdate();

  const title = oldSubmission.title;

  const submission = createSubmission({
    url: oldSubmission.url,
    normalizedUrl: oldSubmission.normalizedUrl,
    title,
    submittedBy: interaction.user.id,
  });

  // Post public announcement via channel.send (not editReply, since the original was ephemeral)
  const voteButton = new ButtonBuilder()
    .setCustomId(`bookclub-vote-btn-${submission.id}`)
    .setLabel('Vote for this')
    .setStyle(ButtonStyle.Primary);

  const channel = interaction.channel;
  if (!channel) {
    logger.warn('No channel available for resubmit confirmation');
    return;
  }

  const message = await channel.send({
    content: `<@${interaction.user.id}> submitted: **${title}** - ${oldSubmission.url}`,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(voteButton),
    ],
  });

  trackVoteMessage({
    submissionId: submission.id,
    messageId: message.id,
    channelId: channel.id,
  });
}

async function handleResubmitCancel(interaction: ButtonInteraction) {
  await interaction.update({
    content: 'Submission cancelled.',
    components: [],
  });
}
```

- [ ] **Step 5: Create `handleBookClubPicksInteraction` and update command router**

```typescript
import type { Interaction } from 'discord.js';

export async function handleBookClubPicksInteraction(
  interaction: Exclude<Interaction, ChatInputCommandInteraction>
): Promise<boolean> {
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId.startsWith('bookclub-vote-select-')
  ) {
    await handleVoteSelectMenu(interaction);
    return true;
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('bookclub-vote-btn-')) {
      await handleVoteButton(interaction);
      return true;
    }
    if (interaction.customId.startsWith('bookclub-resubmit-confirm-')) {
      await handleResubmitConfirm(interaction);
      return true;
    }
    if (interaction.customId === 'bookclub-resubmit-cancel') {
      await handleResubmitCancel(interaction);
      return true;
    }
  }

  return false;
}
```

Also add `'vote'` case to the `handleBookclubPicksCommand` switch:

```typescript
case 'vote':
  await handleVoteCommand(interaction);
  break;
```

- [ ] **Step 6: Update `src/index.ts` interaction routing**

Replace the current non-command interaction handler with a general-purpose dispatcher:

```typescript
import { handleBookClubPicksInteraction } from './book-club-picks';

// In the interactionCreate handler, replace:
//   await handleGoalInteraction(interaction);
// With:
if (
  interaction.isModalSubmit() ||
  interaction.isStringSelectMenu() ||
  interaction.isButton()
) {
  const customId = interaction.customId;
  if (customId.startsWith('goal-')) {
    await handleGoalInteraction(interaction);
  } else if (customId.startsWith('bookclub-')) {
    await handleBookClubPicksInteraction(interaction);
  }
}
```

- [ ] **Step 7: Run typecheck**

```bash
bun run typecheck
```

- [ ] **Step 8: Run all tests**

```bash
bun test
```

- [ ] **Step 9: Commit**

```bash
git add src/book-club-picks.ts src/index.ts
git commit -m "Add vote command, inline vote buttons, and interaction routing"
```

---

## Task 6: Pool and history commands

**Files:**

- Modify: `src/book-club-picks.ts`

- [ ] **Step 1: Add `handlePoolCommand`**

```typescript
import { EmbedBuilder } from 'discord.js';
import { getActivePool, getVoteCountsForWeek } from './db/book-club-picks';

async function handlePoolCommand(interaction: ChatInputCommandInteraction) {
  const pool = getActivePool();

  if (pool.length === 0) {
    await interaction.reply(
      'The pool is empty. Use `/lgt bookclub submit` to add an article!'
    );
    return;
  }

  const weekIdentifier = getCurrentWeek();
  const voteCounts = getVoteCountsForWeek(weekIdentifier);
  const voteMap = new Map(voteCounts.map((v) => [v.submissionId, v.voteCount]));

  // Sort by vote count descending
  const sorted = [...pool].sort(
    (a, b) => (voteMap.get(b.id) ?? 0) - (voteMap.get(a.id) ?? 0)
  );

  const embed = new EmbedBuilder()
    .setTitle('Book club article pool')
    .setColor(0x0099ff)
    .setTimestamp()
    .addFields(
      sorted.map((sub) => ({
        name: `${sub.title} (${voteMap.get(sub.id) ?? 0} votes)`,
        value: `${sub.url}\nSubmitted by <@${sub.submittedBy}>`,
        inline: false,
      }))
    );

  await interaction.reply({ embeds: [embed] });
}
```

- [ ] **Step 2: Add `handleHistoryCommand`**

```typescript
import { getRecentlyDiscussed } from './db/book-club-picks';

async function handleHistoryCommand(interaction: ChatInputCommandInteraction) {
  const history = getRecentlyDiscussed(10);

  if (history.length === 0) {
    await interaction.reply('No articles have been discussed yet!');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Recently discussed articles')
    .setColor(0x00ff00)
    .setTimestamp()
    .addFields(
      history.map((sub) => {
        const date = new Date(sub.discussedAt!).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        return {
          name: sub.title,
          value: `${sub.url}\nDiscussed: ${date}`,
          inline: false,
        };
      })
    );

  await interaction.reply({ embeds: [embed] });
}
```

- [ ] **Step 3: Add cases to the command router**

In `handleBookclubPicksCommand`, add:

```typescript
case 'pool':
  await handlePoolCommand(interaction);
  break;
case 'history':
  await handleHistoryCommand(interaction);
  break;
```

- [ ] **Step 4: Run typecheck**

```bash
bun run typecheck
```

- [ ] **Step 5: Run all tests**

```bash
bun test
```

- [ ] **Step 6: Commit**

```bash
git add src/book-club-picks.ts
git commit -m "Add pool and history commands"
```

---

## Task 7: Cron jobs (reminder and vote close)

**Files:**

- Modify: `src/book-club-picks.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Add cron setup function to `src/book-club-picks.ts`**

```typescript
import cron from 'node-cron';
import { Client, TextChannel } from 'discord.js';
import { logger } from './logger';
import {
  getActivePool,
  getVoteCountsForWeek,
  markAsDiscussed,
  getVoteMessagesForSubmission,
} from './db/book-club-picks';

const BOOK_CLUB_CHANNEL_ID =
  process.env.LGT_BOOK_CLUB_CHANNEL_ID || '1320549426007375994';
const REMINDER_CRON = process.env.BOOKCLUB_REMINDER_CRON || '0 9 * * 1';
const CLOSE_CRON = process.env.BOOKCLUB_CLOSE_CRON || '0 9 * * 2';
const CRON_TIMEZONE = 'America/New_York';

export function registerBookClubPicksCron(client: Client) {
  // Monday reminder
  cron.schedule(
    REMINDER_CRON,
    async () => {
      try {
        const channel = (await client.channels.fetch(
          BOOK_CLUB_CHANNEL_ID
        )) as TextChannel;

        const pool = getActivePool();
        if (pool.length === 0) return;

        const weekIdentifier = getCurrentWeek();
        const voteCounts = getVoteCountsForWeek(weekIdentifier);
        const voteMap = new Map(
          voteCounts.map((v) => [v.submissionId, v.voteCount])
        );

        const sorted = [...pool].sort(
          (a, b) => (voteMap.get(b.id) ?? 0) - (voteMap.get(a.id) ?? 0)
        );

        const embed = new EmbedBuilder()
          .setTitle('Book club voting closes tomorrow morning!')
          .setColor(0xff9900)
          .addFields(
            sorted.map((sub) => ({
              name: `${sub.title} (${voteMap.get(sub.id) ?? 0} votes)`,
              value: sub.url,
              inline: false,
            }))
          )
          .setFooter({
            text: 'Use /lgt bookclub vote or click a vote button to cast yours!',
          });

        await channel.send({ embeds: [embed] });
        logger.info('Book club voting reminder sent');
      } catch (error) {
        logger.error(error, 'Failed to send book club voting reminder');
      }
    },
    { timezone: CRON_TIMEZONE }
  );

  // Tuesday close
  cron.schedule(
    CLOSE_CRON,
    async () => {
      try {
        const channel = (await client.channels.fetch(
          BOOK_CLUB_CHANNEL_ID
        )) as TextChannel;

        const pool = getActivePool();
        if (pool.length === 0) {
          await channel.send(
            'No articles were submitted for book club this week.'
          );
          return;
        }

        const weekIdentifier = getCurrentWeek();
        const voteCounts = getVoteCountsForWeek(weekIdentifier);
        const voteMap = new Map(
          voteCounts.map((v) => [v.submissionId, v.voteCount])
        );

        const { winner, tiebreak, noVotes } = selectWinner(pool, voteCounts);

        if (noVotes) {
          await channel.send(
            'Nobody voted this week, so the bot chose randomly.'
          );
        }

        // Fetch winner's vote messages before marking as discussed, then mark
        const voteMessages = getVoteMessagesForSubmission(winner.id);
        markAsDiscussed(winner.id);

        const embed = new EmbedBuilder()
          .setTitle("This week's book club article")
          .setColor(0x00ff00)
          .addFields(
            { name: 'Title', value: winner.title, inline: false },
            { name: 'URL', value: winner.url, inline: false },
            {
              name: 'Submitted by',
              value: `<@${winner.submittedBy}>`,
              inline: true,
            },
            {
              name: 'Votes',
              value: `${voteMap.get(winner.id) ?? 0}`,
              inline: true,
            }
          );

        if (tiebreak) {
          embed.setFooter({ text: 'Won by tiebreaker (random selection)' });
        }

        await channel.send({ embeds: [embed] });

        // Disable vote buttons on the winning submission's messages only
        // (rolled-over articles keep their buttons active per spec)
        for (const vm of voteMessages) {
          try {
            const msgChannel = (await client.channels.fetch(
              vm.channelId
            )) as TextChannel;
            const msg = await msgChannel.messages.fetch(vm.messageId);
            const disabledRows = msg.components.map((row) => {
              const newRow = ActionRowBuilder.from(row);
              newRow.components.forEach((c) =>
                (c as ButtonBuilder).setDisabled(true)
              );
              return newRow;
            });
            await msg.edit({ components: disabledRows });
          } catch (error) {
            logger.warn(
              error,
              `Failed to disable vote button on message ${vm.messageId}`
            );
          }
        }

        logger.info(
          `Book club voting closed. Winner: ${winner.title} (ID: ${winner.id})`
        );
      } catch (error) {
        logger.error(error, 'Failed to close book club voting');
      }
    },
    { timezone: CRON_TIMEZONE }
  );

  logger.info('Book club picks cron jobs registered');
}
```

- [ ] **Step 2: Register cron in `src/index.ts`**

In the `client.once('ready', ...)` callback, add:

```typescript
import { registerBookClubPicksCron } from './book-club-picks';

// After existing registrations:
registerBookClubPicksCron(client);
```

- [ ] **Step 3: Run typecheck**

```bash
bun run typecheck
```

- [ ] **Step 4: Run all tests**

```bash
bun test
```

- [ ] **Step 5: Commit**

```bash
git add src/book-club-picks.ts src/index.ts
git commit -m "Add cron jobs for Monday reminder and Tuesday vote close"
```

---

## Task 8: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full lint**

```bash
bun run lint
```

Fix any issues found.

- [ ] **Step 2: Run typecheck**

```bash
bun run typecheck
```

- [ ] **Step 3: Run all tests**

```bash
bun test
```

- [ ] **Step 4: Generate migration if not already done**

```bash
bun run db:generate
```

- [ ] **Step 5: Review the full diff**

```bash
git diff main --stat
```

Verify only expected files were changed: `src/book-club-picks.ts`, `src/db/book-club-picks.ts`, `src/__tests__/book-club-picks.test.ts`, `src/db/schema.ts`, `src/db/index.ts`, `src/commands.ts`, `src/index.ts`, `src/book-club-bans.ts`, `package.json`, lock file, and migration files.

- [ ] **Step 6: Lint fix if needed**

```bash
bun run lint:fix
```

- [ ] **Step 7: Final commit if lint fix produced changes**

```bash
git add -A
git commit -m "Fix lint issues"
```
