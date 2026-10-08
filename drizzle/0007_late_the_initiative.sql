CREATE TABLE `book_club_pick_subscribers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`subscribed_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bc_pick_subscribers_user_unique_idx` ON `book_club_pick_subscribers` (`user_id`);