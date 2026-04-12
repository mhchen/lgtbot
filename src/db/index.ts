import { drizzle } from 'drizzle-orm/bun-sqlite';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import path from 'path';
import * as schema from './schema';

const sqlite =
  process.env.NODE_ENV === 'test'
    ? new Database(':memory:')
    : new Database(path.join(import.meta.dir, '../../data/lgtbot.db'), {
        create: true,
      });

if (process.env.NODE_ENV === 'test') {
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS book_club_bans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discord_user_id TEXT NOT NULL,
      discord_message_ids TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS twitch_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      twitch_subscription_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS kudos_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL,
      message_channel_id TEXT NOT NULL,
      message_author_id TEXT NOT NULL,
      reactor_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      UNIQUE(message_id, reactor_id)
    );

    CREATE INDEX IF NOT EXISTS message_author_idx ON kudos_reactions(message_author_id);
    CREATE INDEX IF NOT EXISTS reactor_idx ON kudos_reactions(reactor_id);
    CREATE INDEX IF NOT EXISTS message_idx ON kudos_reactions(message_id);
    CREATE INDEX IF NOT EXISTS reactor_author_time_idx ON kudos_reactions(reactor_id, message_author_id, created_at);

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      target_count INTEGER NOT NULL,
      completion_count INTEGER DEFAULT 0 NOT NULL,
      week_identifier TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
      deleted_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS goals_user_week_idx ON goals(user_id, week_identifier);
    CREATE INDEX IF NOT EXISTS goals_week_idx ON goals(week_identifier);
    CREATE INDEX IF NOT EXISTS goals_active_idx ON goals(deleted_at);

    CREATE TABLE IF NOT EXISTS book_club_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      submitted_by TEXT NOT NULL,
      submitted_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      discussed_at INTEGER,
      expired_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS bc_submissions_url_idx ON book_club_submissions(url);
    CREATE INDEX IF NOT EXISTS bc_submissions_discussed_at_idx ON book_club_submissions(discussed_at);
    CREATE INDEX IF NOT EXISTS bc_submissions_expired_at_idx ON book_club_submissions(expired_at);

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
  `);
}

export const db = drizzle(sqlite, { schema });
export type { BunSQLiteDatabase as DbClient };
