
import { Database } from 'bun:sqlite';
import path from 'path';

export const db = new Database(
  path.join(import.meta.dir, '../data/lgtbot.db'),
  { create: true, strict: true }
);
