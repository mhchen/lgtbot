ALTER TABLE `book_club_submissions` ADD `expired_at` integer;--> statement-breakpoint
CREATE INDEX `bc_submissions_expired_at_idx` ON `book_club_submissions` (`expired_at`);