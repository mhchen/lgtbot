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
  `);
}

export const db = drizzle(sqlite, { schema });
export type { BunSQLiteDatabase as DbClient };
