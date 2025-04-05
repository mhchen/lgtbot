import { drizzle } from 'drizzle-orm/bun-sqlite';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import path from 'path';
import * as schema from './schema';

const sqlite = new Database(
  path.join(import.meta.dir, '../../data/lgtbot.db'),
  {
    create: true,
  }
);

export const db = drizzle(sqlite, { schema });
export type { BunSQLiteDatabase as DbClient };
