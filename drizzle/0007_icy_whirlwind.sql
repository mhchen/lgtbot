CREATE TABLE `expiring_messages` (
	`message_id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`author_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `expiring_messages_expires_at_idx` ON `expiring_messages` (`expires_at`);