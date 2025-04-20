CREATE TABLE `book_club_bans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`discord_user_id` text NOT NULL,
	`discord_message_ids` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kudos_reactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` text NOT NULL,
	`message_channel_id` text NOT NULL,
	`message_author_id` text NOT NULL,
	`reactor_id` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_reactor_unique_idx` ON `kudos_reactions` (`message_id`,`reactor_id`);--> statement-breakpoint
CREATE INDEX `message_author_idx` ON `kudos_reactions` (`message_author_id`);--> statement-breakpoint
CREATE INDEX `reactor_idx` ON `kudos_reactions` (`reactor_id`);--> statement-breakpoint
CREATE INDEX `message_idx` ON `kudos_reactions` (`message_id`);--> statement-breakpoint
CREATE INDEX `reactor_author_time_idx` ON `kudos_reactions` (`reactor_id`,`message_author_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `twitch_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`twitch_subscription_id` text NOT NULL
);
