import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

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
