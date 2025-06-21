import {
  sqliteTable,
  integer,
  text,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const twitchSubscriptions = sqliteTable('twitch_subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  twitchSubscriptionId: text('twitch_subscription_id').notNull(),
});

export const bookClubBans = sqliteTable('book_club_bans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  discordUserId: text('discord_user_id').notNull(),
  discordMessageIds: text('discord_message_ids').notNull(),
});

export const kudosReactions = sqliteTable(
  'kudos_reactions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    messageId: text('message_id').notNull(),
    messageChannelId: text('message_channel_id').notNull(),
    messageAuthorId: text('message_author_id').notNull(),
    reactorId: text('reactor_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => {
    return {
      messageReactorUnique: uniqueIndex('message_reactor_unique_idx').on(
        table.messageId,
        table.reactorId
      ),
      messageAuthorIdx: index('message_author_idx').on(table.messageAuthorId),
      reactorIdx: index('reactor_idx').on(table.reactorId),
      messageIdx: index('message_idx').on(table.messageId),
      reactorAuthorTimeIdx: index('reactor_author_time_idx').on(
        table.reactorId,
        table.messageAuthorId,
        table.createdAt
      ),
    };
  }
);

export const goals = sqliteTable(
  'goals',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    targetCount: integer('target_count').notNull(),
    completionCount: integer('completion_count').notNull().default(0),
    weekIdentifier: text('week_identifier').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
  },
  (table) => ({
    userWeekIdx: index('goals_user_week_idx').on(
      table.userId,
      table.weekIdentifier
    ),
    weekIdx: index('goals_week_idx').on(table.weekIdentifier),
    activeIdx: index('goals_active_idx').on(table.deletedAt),
  })
);
