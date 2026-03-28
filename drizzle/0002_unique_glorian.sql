CREATE TABLE `book_club_submissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`normalized_url` text NOT NULL,
	`title` text NOT NULL,
	`submitted_by` text NOT NULL,
	`submitted_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	`discussed_at` integer
);
--> statement-breakpoint
CREATE INDEX `bc_submissions_normalized_url_idx` ON `book_club_submissions` (`normalized_url`);--> statement-breakpoint
CREATE INDEX `bc_submissions_discussed_at_idx` ON `book_club_submissions` (`discussed_at`);--> statement-breakpoint
CREATE TABLE `book_club_vote_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` integer NOT NULL,
	`message_id` text NOT NULL,
	`channel_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `bc_vote_messages_submission_idx` ON `book_club_vote_messages` (`submission_id`);--> statement-breakpoint
CREATE TABLE `book_club_votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`submission_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`week_identifier` text NOT NULL,
	`voted_at` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bc_votes_user_week_unique_idx` ON `book_club_votes` (`user_id`,`week_identifier`);--> statement-breakpoint
CREATE INDEX `bc_votes_submission_idx` ON `book_club_votes` (`submission_id`);--> statement-breakpoint
CREATE INDEX `bc_votes_week_idx` ON `book_club_votes` (`week_identifier`);