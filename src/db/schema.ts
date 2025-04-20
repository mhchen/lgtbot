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
