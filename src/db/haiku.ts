import { db } from './index';
import { haikus } from './schema';

export async function saveHaiku(data: {
  originalMessageId: string;
  haikuMessageId: string;
  channelId: string;
  originalText: string;
  haikuText: string;
  authorUserId: string;
}) {
  return db.insert(haikus).values(data).returning();
}
