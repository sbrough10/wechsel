CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`pull_request_id` text NOT NULL,
	`member_id` text NOT NULL,
	`role` text NOT NULL,
	`assigned_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`pull_request_id`) REFERENCES `pull_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "assignments_role_valid" CHECK("assignments"."role" IN ('review', 'acceptance'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assignments_one_per_role` ON `assignments` (`pull_request_id`,`member_id`,`role`);--> statement-breakpoint
CREATE INDEX `assignments_by_pr` ON `assignments` (`pull_request_id`);--> statement-breakpoint
CREATE TABLE `completions` (
	`id` text PRIMARY KEY NOT NULL,
	`pull_request_id` text NOT NULL,
	`member_id` text NOT NULL,
	`role` text NOT NULL,
	`assignment_id` text,
	`completed_at` integer NOT NULL,
	FOREIGN KEY (`pull_request_id`) REFERENCES `pull_requests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "completions_role_valid" CHECK("completions"."role" IN ('review', 'acceptance'))
);
--> statement-breakpoint
CREATE INDEX `completions_by_member_role` ON `completions` (`member_id`,`role`);--> statement-breakpoint
CREATE INDEX `completions_by_pr` ON `completions` (`pull_request_id`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`name_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`removed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_name_key_unique` ON `members` (`name_key`);--> statement-breakpoint
CREATE TABLE `pull_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`owner` text NOT NULL,
	`repo` text NOT NULL,
	`number` integer NOT NULL,
	`note` text,
	`posted_by` text NOT NULL,
	`reviewers_required` integer DEFAULT 1 NOT NULL,
	`testers_required` integer DEFAULT 0 NOT NULL,
	`merged_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`posted_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pull_requests_reviewers_required_range" CHECK("pull_requests"."reviewers_required" BETWEEN 0 AND 10),
	CONSTRAINT "pull_requests_testers_required_range" CHECK("pull_requests"."testers_required" BETWEEN 0 AND 10)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pull_requests_live_url` ON `pull_requests` (`url`) WHERE "pull_requests"."deleted_at" IS NULL;