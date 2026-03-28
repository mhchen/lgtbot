# Book club picks

A module for collecting, voting on, and selecting blog post articles for the weekly Wednesday book club discussion.

## Problem

People submit article ideas in the book club Discord channel throughout the week, but they get buried in chat. There's no structured way to collect ideas or let the group decide what to read.

## Solution overview

A slash-command-driven submission and voting system. Articles are submitted to a persistent pool. Each week, members vote on which article to discuss. Voting closes Tuesday morning, and the winner is announced automatically. Unselected articles roll over to future weeks.

Key UX additions beyond basic slash commands:

- Each submission announcement includes a "Vote for this" button for low-friction inline voting
- A scheduled Monday morning reminder nudges people to vote before close

## Data model

Three new tables in `src/db/schema.ts`:

### `book_club_submissions`

| Column         | Type                             | Notes                                       |
| -------------- | -------------------------------- | ------------------------------------------- |
| id             | integer PK                       | auto-increment                              |
| url            | text, not null                   | original URL as submitted                   |
| normalized_url | text, not null                   | for dedup (see URL normalization)           |
| title          | text, not null                   | display title, user-provided or extracted   |
| submitted_by   | text, not null                   | Discord user ID                             |
| submitted_at   | integer (timestamp_ms), not null | defaults to current time                    |
| discussed_at   | integer (timestamp_ms), nullable | set when article wins. Null = still in pool |

Index on `normalized_url` for dedup lookups. Index on `discussed_at` for active pool queries.

### `book_club_votes`

| Column          | Type                             | Notes                                        |
| --------------- | -------------------------------- | -------------------------------------------- |
| id              | integer PK                       | auto-increment                               |
| submission_id   | integer, not null                | FK to book_club_submissions                  |
| user_id         | text, not null                   | Discord user ID                              |
| week_identifier | text, not null                   | e.g. "2026-W13", same format as goals module |
| voted_at        | integer (timestamp_ms), not null | last updated                                 |

Unique index on `(user_id, week_identifier)` so changing your vote is an upsert.

### `book_club_vote_messages`

| Column        | Type              | Notes                       |
| ------------- | ----------------- | --------------------------- |
| id            | integer PK        | auto-increment              |
| submission_id | integer, not null | FK to book_club_submissions |
| message_id    | text, not null    | Discord message ID          |
| channel_id    | text, not null    | Discord channel ID          |

Tracks which Discord messages have vote buttons so they can be disabled after close.

### Key behaviors

- When an article wins, `discussed_at` gets set. It stays in the DB for duplicate detection but drops out of the active pool.
- Votes reset weekly because they're keyed on `week_identifier`.
- Articles with `discussed_at = null` are the active pool and roll over automatically.

## Commands and interactions

All under the existing `/lgt bookclub` subcommand group, alongside the existing `bans` subcommand.

### `/lgt bookclub submit <url> [title]`

- `url` is required, `title` is optional
- Validate that `url` parses as a valid URL via `new URL()`. If invalid, reject ephemerally: "That doesn't look like a valid URL."
- If `title` is omitted, fetch the page and extract the `<title>` tag. Use a 5-second timeout. If fetch fails or no title found, fall back to the URL hostname + path as the display title.
- If the URL was previously discussed, reply ephemerally: "This article was discussed on [date]. Submit anyway?" with Confirm/Cancel buttons (custom IDs: `bookclub-resubmit-confirm-{submissionId}`, `bookclub-resubmit-cancel`)
- If the URL is already in the active pool, reject ephemerally: "This article is already in the pool, submitted by [name]"
- On success, post a public message: "[User] submitted: [title] - [url]" with a "Vote for this" button
- Store the message ID in `book_club_vote_messages`

### `/lgt bookclub vote`

- Ephemeral select menu of all active pool articles
- If the user has already voted this week, their current vote option has `default: true` set on the select menu option
- Selecting an article upserts their vote
- If this is a new vote: confirms ephemerally "Vote registered for [title]!"
- If this changes an existing vote: confirms ephemerally "Vote changed from [old title] to [new title]"

### `/lgt bookclub pool`

- Public embed showing all articles in the active pool
- Shows: title, URL, who submitted it, current week vote count
- Sorted by vote count descending

### `/lgt bookclub history`

- Public embed showing recently discussed articles (last 10)
- Shows: title, URL, date discussed

### Inline vote buttons

- "Vote for this" button on submission announcements uses same vote upsert logic
- Button custom ID: `bookclub-vote-btn-{submissionId}`
- If the user has no existing vote: reply ephemerally "Vote registered for [title]!"
- If the user already voted for a different article: reply ephemerally "Vote changed from [old title] to [new title]"
- After voting closes, bot edits tracked messages to disable buttons

### Scheduled events

Two cron jobs running in-process via `node-cron`:

- **Monday morning (default 9am ET):** reminder embed in the book club channel showing current pool with vote counts
- **Tuesday morning (default 9am ET):** close voting, tally votes, announce winner, set `discussed_at`, disable vote buttons

Cron schedules configurable via env vars `BOOKCLUB_REMINDER_CRON` and `BOOKCLUB_CLOSE_CRON`. All cron jobs run with `{ timezone: 'America/New_York' }` by default.

## Edge cases and rules

### Winner selection

- Tie: pick randomly among tied articles. Mention it was a tiebreaker.
- Zero votes: pick randomly from entire pool. Announce nobody voted.
- Empty pool: post a message saying there's nothing to discuss.

### URL normalization

For dedup comparison, normalize submitted URLs:

- Lowercase the hostname (leave path case-sensitive)
- Strip all query parameters
- Strip fragment/hash
- Strip trailing slash

Store both the original URL (for display) and the normalized URL (for dedup).

### Duplicate handling

- Active pool duplicate (same normalized URL, `discussed_at` is null): reject with ephemeral message identifying existing submission
- Previously discussed duplicate (`discussed_at` is set): soft-block with ephemeral confirmation showing when it was discussed. User can confirm to resubmit.

### Vote button lifecycle

- Buttons work from submission through Tuesday morning close
- After close, bot edits messages to disable buttons. Edit failures are logged and ignored.
- Buttons on rolled-over articles still work; clicking registers a vote for the current week.

### Submission limits

- No limit on submissions per person per week.
- Submitters cannot withdraw articles from the pool. Once submitted, an article stays until it wins or is displaced organically.

## Module structure

### New files

- `src/book-club-picks.ts` - main feature module (commands, button handlers, cron setup)
- `src/db/book-club-picks.ts` - database query functions

### Modified files

- `src/db/schema.ts` - add three new tables
- `src/commands.ts` - add new subcommands to existing `bookclub` group
- `src/index.ts` - register cron jobs, add command routing, add interaction handler

### Interaction routing

The current `index.ts` delegates all non-command interactions to `handleGoalInteraction`. This needs to become a general-purpose dispatcher that routes by custom ID prefix:

- `goal-*` -> `handleGoalInteraction` (existing)
- `bookclub-*` -> `handleBookClubPicksInteraction` (new, exported from `book-club-picks.ts`)

`handleBookClubPicksInteraction` handles:

- `bookclub-vote-btn-{submissionId}` - vote button clicks
- `bookclub-resubmit-confirm-{submissionId}` - resubmit confirmation
- `bookclub-resubmit-cancel` - resubmit cancellation

### New dependency

- `node-cron` for scheduling

## Environment variables

New variables (with defaults):

- `BOOKCLUB_REMINDER_CRON` - cron expression for Monday reminder (default: `0 9 * * 1` = Monday 9am)
- `BOOKCLUB_CLOSE_CRON` - cron expression for Tuesday close (default: `0 9 * * 2` = Tuesday 9am)
- `LGT_BOOK_CLUB_CHANNEL_ID` - already exists in the codebase, reused here
