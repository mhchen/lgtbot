CREATE TABLE `lgt_kudos_reactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` text NOT NULL,
	`message_channel_id` text NOT NULL,
	`message_author_id` text NOT NULL,
	`reactor_id` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_reactor_unique_idx` ON `lgt_kudos_reactions` (`message_id`,`reactor_id`);--> statement-breakpoint
CREATE INDEX `message_author_idx` ON `lgt_kudos_reactions` (`message_author_id`);--> statement-breakpoint
CREATE INDEX `reactor_idx` ON `lgt_kudos_reactions` (`reactor_id`);--> statement-breakpoint
CREATE INDEX `message_idx` ON `lgt_kudos_reactions` (`message_id`);--> statement-breakpoint
CREATE INDEX `reactor_author_time_idx` ON `lgt_kudos_reactions` (`reactor_id`,`message_author_id`,`timestamp`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_twitch_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`twitch_subscription_id` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_twitch_subscriptions`("id", "username", "twitch_subscription_id") SELECT "id", "username", "twitch_subscription_id" FROM `twitch_subscriptions`;--> statement-breakpoint
DROP TABLE `twitch_subscriptions`;--> statement-breakpoint
ALTER TABLE `__new_twitch_subscriptions` RENAME TO `twitch_subscriptions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_book_club_bans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`discord_user_id` text NOT NULL,
	`discord_message_ids` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_book_club_bans`("id", "discord_user_id", "discord_message_ids") SELECT "id", "discord_user_id", "discord_message_ids" FROM `book_club_bans`;--> statement-breakpoint
DROP TABLE `book_club_bans`;--> statement-breakpoint
ALTER TABLE `__new_book_club_bans` RENAME TO `book_club_bans`;