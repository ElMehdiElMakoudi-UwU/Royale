CREATE TABLE `cash_closings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`opening_float` integer NOT NULL,
	`cash_counted` integer NOT NULL,
	`card` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`created_by` integer NOT NULL,
	`validated_by` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`validated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cash_closings_date_unique` ON `cash_closings` (`date`);--> statement-breakpoint
CREATE TABLE `cash_outflows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`closing_id` integer NOT NULL,
	`label` text NOT NULL,
	`amount` integer NOT NULL,
	FOREIGN KEY (`closing_id`) REFERENCES `cash_closings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cash_outflows_closing_idx` ON `cash_outflows` (`closing_id`);