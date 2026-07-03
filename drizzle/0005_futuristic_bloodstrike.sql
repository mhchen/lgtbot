CREATE TABLE `haikus` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`original_message_id` text NOT NULL,
	`haiku_message_id` text NOT NULL,
	`original_text` text NOT NULL,
	`haiku_text` text NOT NULL,
	`author_user_id` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `haikus_author_idx` ON `haikus` (`author_user_id`);--> statement-breakpoint
CREATE INDEX `haikus_original_message_idx` ON `haikus` (`original_message_id`);