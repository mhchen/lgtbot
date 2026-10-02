import { and, eq, gt, lte, or } from 'drizzle-orm';
import { db } from './index';
import { expiringMessages } from './schema';

export type ExpiringMessage = typeof expiringMessages.$inferSelect;
export type DueCursor = Pick<ExpiringMessage, 'expiresAt' | 'messageId'>;

export function saveExpiringMessage(message: ExpiringMessage) {
  db.insert(expiringMessages).values(message).run();
}

export function getDueExpiringMessages(
  now: Date,
  after?: DueCursor,
  limit = 100
) {
  return db
    .select()
    .from(expiringMessages)
    .where(
      and(
        lte(expiringMessages.expiresAt, now),
        after
          ? or(
              gt(expiringMessages.expiresAt, after.expiresAt),
              and(
                eq(expiringMessages.expiresAt, after.expiresAt),
                gt(expiringMessages.messageId, after.messageId)
              )
            )
          : undefined
      )
    )
    .orderBy(expiringMessages.expiresAt, expiringMessages.messageId)
    .limit(limit)
    .all();
}

export function removeExpiringMessage(messageId: string) {
  db.delete(expiringMessages)
    .where(eq(expiringMessages.messageId, messageId))
    .run();
}
