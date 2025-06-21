CREATE TABLE `goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`target_count` integer NOT NULL,
	`completion_count` integer DEFAULT 0 NOT NULL,
	`week_identifier` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `goals_user_week_idx` ON `goals` (`user_id`,`week_identifier`);--> statement-breakpoint
CREATE INDEX `goals_week_idx` ON `goals` (`week_identifier`);--> statement-breakpoint
CREATE INDEX `goals_active_idx` ON `goals` (`deleted_at`);--> statement-breakpoint
DROP INDEX `guild_idx`;--> statement-breakpoint
ALTER TABLE `kudos_reactions` DROP COLUMN `guild_id`;