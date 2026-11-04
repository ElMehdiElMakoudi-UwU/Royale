CREATE TABLE `fixed_charges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`month` text NOT NULL,
	`label` text NOT NULL,
	`amount` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fixed_charges_month_idx` ON `fixed_charges` (`month`);--> statement-breakpoint
CREATE TABLE `result_days` (
	`date` text PRIMARY KEY NOT NULL,
	`credit_royale` integer DEFAULT 0 NOT NULL,
	`morning` integer DEFAULT 0 NOT NULL,
	`evening` integer DEFAULT 0 NOT NULL,
	`expenses` integer DEFAULT 0 NOT NULL,
	`owner_expenses` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `result_period_starts` (
	`date` text PRIMARY KEY NOT NULL
);
