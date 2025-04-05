-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `twitch_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`username` text NOT NULL,
	`twitch_subscription_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `book_club_bans` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`discord_user_id` text NOT NULL,
	`discord_message_ids` text NOT NULL
);

*/