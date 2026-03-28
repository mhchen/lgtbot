DROP INDEX `bc_submissions_normalized_url_idx`;--> statement-breakpoint
CREATE INDEX `bc_submissions_url_idx` ON `book_club_submissions` (`url`);--> statement-breakpoint
ALTER TABLE `book_club_submissions` DROP COLUMN `normalized_url`;