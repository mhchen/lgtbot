import { desc } from 'drizzle-orm';
import { db } from './index';
import { haikus } from './schema';

export function getRecentHaikus(limit = 60) {
  return db
    .select()
    .from(haikus)
    .orderBy(desc(haikus.createdAt))
    .limit(limit)
    .all();
}

export async function saveHaiku(data: {
  originalMessageId: string;
  haikuMessageId: string;
  channelId: string;
  originalText: string;
  haikuText: string;
  authorUserId: string;
}) {
  return db
    .insert(haikus)
    .values(data)
    .onConflictDoNothing({ target: haikus.originalMessageId })
    .returning();
}
