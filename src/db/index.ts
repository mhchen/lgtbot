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
      guild_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      UNIQUE(message_id, reactor_id)
    );

    CREATE INDEX IF NOT EXISTS message_author_idx ON kudos_reactions(message_author_id);
    CREATE INDEX IF NOT EXISTS reactor_idx ON kudos_reactions(reactor_id);
    CREATE INDEX IF NOT EXISTS message_idx ON kudos_reactions(message_id);
    CREATE INDEX IF NOT EXISTS guild_idx ON kudos_reactions(guild_id);
    CREATE INDEX IF NOT EXISTS reactor_author_time_idx ON kudos_reactions(reactor_id, message_author_id, created_at);
  `);
}

export const db = drizzle(sqlite, { schema });
export type { BunSQLiteDatabase as DbClient };
