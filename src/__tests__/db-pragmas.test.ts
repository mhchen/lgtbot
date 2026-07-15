import { test, expect, afterAll } from 'bun:test';
import { Database } from 'bun:sqlite';
import { applyConcurrencyPragmas } from '../db/index';
import { unlinkSync } from 'fs';

const path = '/tmp/lgtbot-pragma-test.db';

afterAll(() => {
  try {
    unlinkSync(path);
  } catch {
    // file may not exist
  }
});

test('applyConcurrencyPragmas enables WAL and a busy timeout', () => {
  const sqlite = new Database(path, { create: true });
  applyConcurrencyPragmas(sqlite);

  const journal = sqlite.query('PRAGMA journal_mode').get() as {
    journal_mode: string;
  };
  const timeout = sqlite.query('PRAGMA busy_timeout').get() as {
    timeout: number;
  };

  expect(journal.journal_mode).toBe('wal');
  expect(timeout.timeout).toBe(5000);
  sqlite.close();
});
