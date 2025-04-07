import { and, count, eq, gt, sql } from 'drizzle-orm';
import { db } from './index';
import { lgtKudosReactions } from './schema';
import type { UserKudosStats } from '../types/kudos';
import { KUDOS_LEVELS, POINTS } from '../types/kudos';
import { subDays } from 'date-fns';

export async function addKudosReaction({
  messageId,
  messageChannelId,
  messageAuthorId,
  reactorId,
}: {
  messageId: string;
  messageChannelId: string;
  messageAuthorId: string;
  reactorId: string;
}) {
  return db.insert(lgtKudosReactions).values({
    messageId,
    messageChannelId,
    messageAuthorId,
    reactorId,
  });
}

export async function removeKudosReaction({
  messageId,
  reactorId,
}: {
  messageId: string;
  reactorId: string;
}) {
  return db
    .delete(lgtKudosReactions)
    .where(
      and(
        eq(lgtKudosReactions.messageId, messageId),
        eq(lgtKudosReactions.reactorId, reactorId)
      )
    );
}

export async function getReactionCount({ messageId }: { messageId: string }) {
  const result = await db
    .select({ count: count() })
    .from(lgtKudosReactions)
    .where(eq(lgtKudosReactions.messageId, messageId));
  return result[0]?.count ?? 0;
}

// export async function getDailyReactionCount({
//   reactorId,
// }: {
//   reactorId: string;
// }) {
//   const oneDayAgo = subDays(new Date(), 1);
//   const result = await db
//     .select({ count: count() })
//     .from(lgtKudosReactions)
//     .where(
//       and(
//         eq(lgtKudosReactions.reactorId, reactorId),
//         gte(lgtKudosReactions.createdAt, oneDayAgo)
//       )
//     );
//   return result[0]?.count ?? 0;
// }

export async function getUserKudosStats({
  userId,
}: {
  userId: string;
}): Promise<UserKudosStats> {
  const result = await db
    .select({
      reactionsReceived: count(),
      uniqueMessages: sql<number>`COUNT(DISTINCT ${lgtKudosReactions.messageId})`,
      reactionsGiven: sql<number>`(
        SELECT COUNT(*) 
        FROM ${lgtKudosReactions} AS reactions_given 
        WHERE reactions_given.reactor_id = ${userId}
      )`,
      totalPoints: sql<number>`
        COUNT(DISTINCT ${lgtKudosReactions.messageId}) * ${POINTS.FIRST_REACTION} +
        (COUNT(*) - COUNT(DISTINCT ${lgtKudosReactions.messageId})) * ${POINTS.ADDITIONAL_REACTION} +
        (
          SELECT COUNT(*) 
          FROM ${lgtKudosReactions} AS reactions_given 
          WHERE reactions_given.reactor_id = ${userId}
        ) * ${POINTS.GIVING_REACTION}
      `,
    })
    .from(lgtKudosReactions)
    .where(eq(lgtKudosReactions.messageAuthorId, userId));

  const stats = result[0];
  const totalPoints = stats?.totalPoints ?? 0;
  const currentLevel =
    KUDOS_LEVELS.find(
      (l) =>
        totalPoints >= l.minPoints &&
        (!l.maxPoints || totalPoints <= l.maxPoints)
    ) ?? KUDOS_LEVELS[0];

  const nextLevel = KUDOS_LEVELS.find(
    (l) => l.level === currentLevel.level + 1
  );
  const pointsToNextLevel = nextLevel
    ? nextLevel.minPoints - totalPoints
    : null;

  return {
    userId,
    totalPoints,
    level: currentLevel,
    reactionsReceived: stats?.reactionsReceived ?? 0,
    reactionsGiven: stats?.reactionsGiven ?? 0,
    pointsToNextLevel,
  };
}

export async function getTopKudosUsers(limit = 10) {
  const userStatsCTE = db.$with('user_stats').as(
    db
      .select({
        userId: sql<string>`DISTINCT user_id`.as('user_id'),
      })
      .from(
        sql`(
          SELECT message_author_id as user_id FROM ${lgtKudosReactions}
          UNION
          SELECT reactor_id as user_id FROM ${lgtKudosReactions}
        ) all_users`
      )
  );

  const reactionStatsCTE = db.$with('reaction_stats').as(
    db
      .select({
        userId: sql<string>`user_stats.user_id`.as('user_id'),
        uniqueMessages: sql<number>`COUNT(DISTINCT CASE 
          WHEN ${lgtKudosReactions.messageAuthorId} = user_stats.user_id 
          THEN ${lgtKudosReactions.messageId} 
        END)`.as('unique_messages'),
        reactionsReceived: sql<number>`COUNT(CASE 
          WHEN ${lgtKudosReactions.messageAuthorId} = user_stats.user_id 
          THEN 1 
        END)`.as('reactions_received'),
        reactionsGiven: sql<number>`COUNT(CASE 
          WHEN ${lgtKudosReactions.reactorId} = user_stats.user_id 
          THEN 1 
        END)`.as('reactions_given'),
      })
      .from(userStatsCTE)
      .leftJoin(
        lgtKudosReactions,
        sql`${lgtKudosReactions.messageAuthorId} = user_stats.user_id OR 
            ${lgtKudosReactions.reactorId} = user_stats.user_id`
      )
      .groupBy(sql`user_stats.user_id`)
  );

  const userStats = await db
    .with(userStatsCTE, reactionStatsCTE)
    .select({
      userId: sql<string>`reaction_stats.user_id`.as('user_id'),
      uniqueMessages: sql<number>`reaction_stats.unique_messages`.as(
        'unique_messages'
      ),
      reactionsReceived: sql<number>`reaction_stats.reactions_received`.as(
        'reactions_received'
      ),
      reactionsGiven: sql<number>`reaction_stats.reactions_given`.as(
        'reactions_given'
      ),
      totalPoints: sql<number>`
        (reaction_stats.unique_messages * ${POINTS.FIRST_REACTION}) +
        ((reaction_stats.reactions_received - reaction_stats.unique_messages) * ${POINTS.ADDITIONAL_REACTION}) +
        (reaction_stats.reactions_given * ${POINTS.GIVING_REACTION})
      `.as('total_points'),
    })
    .from(reactionStatsCTE)
    .orderBy(sql`total_points DESC`)
    .limit(limit);

  return userStats.map((stats) => {
    const level =
      KUDOS_LEVELS.find(
        (level) =>
          stats.totalPoints >= level.minPoints &&
          (!level.maxPoints || stats.totalPoints <= level.maxPoints)
      ) ?? KUDOS_LEVELS[0];

    return {
      ...stats,
      level,
    };
  });
}

export async function getTopMessages({
  limit = 10,
  timeframe = '7 days',
}: {
  limit?: number;
  timeframe?: string;
} = {}) {
  const daysMatch = timeframe.match(/(\d+)\s*days?/);
  if (!daysMatch) {
    throw new Error('Invalid timeframe format. Expected format: "X days"');
  }
  const days = parseInt(daysMatch[1], 10);
  const cutoffDate = subDays(new Date(), days);

  return db
    .select({
      messageId: lgtKudosReactions.messageId,
      messageChannelId: lgtKudosReactions.messageChannelId,
      messageAuthorId: lgtKudosReactions.messageAuthorId,
      reactionCount: sql<number>`COUNT(*) AS reaction_count`,
    })
    .from(lgtKudosReactions)
    .where(gt(lgtKudosReactions.createdAt, cutoffDate))
    .groupBy(lgtKudosReactions.messageId)
    .orderBy(sql`reaction_count DESC`)
    .limit(limit);
}
