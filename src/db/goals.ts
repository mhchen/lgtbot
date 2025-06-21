import { db } from './index';
import { goals } from './schema';
import { eq, and, isNull, sql, lt } from 'drizzle-orm';

export async function createGoal(data: {
  userId: string;
  title: string;
  targetCount: number;
  weekIdentifier: string;
}) {
  return db.insert(goals).values(data).returning();
}

export async function getUserGoals(userId: string, weekIdentifier: string) {
  return db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.userId, userId),
        eq(goals.weekIdentifier, weekIdentifier),
        isNull(goals.deletedAt)
      )
    )
    .orderBy(goals.createdAt);
}

export async function getGoalById(goalId: number) {
  return db
    .select()
    .from(goals)
    .where(and(eq(goals.id, goalId), isNull(goals.deletedAt)))
    .limit(1);
}

export async function getUserIncompleteGoals(
  userId: string,
  weekIdentifier: string
) {
  return db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.userId, userId),
        eq(goals.weekIdentifier, weekIdentifier),
        isNull(goals.deletedAt),
        lt(goals.completionCount, goals.targetCount)
      )
    )
    .orderBy(goals.createdAt);
}

export async function incrementGoalProgress(goalId: number) {
  return db
    .update(goals)
    .set({
      completionCount: sql`completion_count + 1`,
    })
    .where(and(eq(goals.id, goalId), isNull(goals.deletedAt)))
    .returning();
}

export async function getAllActiveGoals(weekIdentifier: string) {
  return db
    .select()
    .from(goals)
    .where(
      and(eq(goals.weekIdentifier, weekIdentifier), isNull(goals.deletedAt))
    )
    .orderBy(goals.userId, goals.createdAt);
}

export async function softDeleteGoal(goalId: number) {
  return db
    .update(goals)
    .set({ deletedAt: sql`${Date.now()}` })
    .where(eq(goals.id, goalId))
    .returning();
}
