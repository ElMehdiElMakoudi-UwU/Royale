-- Hand-written: everything recorded so far belongs to the first shop, Ksar.
-- Tables with child rows get a new column rather than a rebuild, so they are never dropped.
CREATE TABLE `shops` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name_fr` text NOT NULL,
	`name_ar` text DEFAULT '' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `shops` (`id`, `name_fr`, `name_ar`, `sort`) VALUES (1, 'Ksar', 'القصر الكبير', 0), (2, 'Larache', 'العرائش', 1);--> statement-breakpoint
ALTER TABLE `users` ADD `shop_id` integer REFERENCES shops(id);--> statement-breakpoint
UPDATE `users` SET `shop_id` = 1 WHERE `role` = 'staff';--> statement-breakpoint
DROP INDEX `cash_closings_date_unique`;--> statement-breakpoint
ALTER TABLE `cash_closings` ADD `shop_id` integer NOT NULL DEFAULT 1 REFERENCES shops(id);--> statement-breakpoint
CREATE UNIQUE INDEX `cash_closings_shop_date_idx` ON `cash_closings` (`shop_id`,`date`);--> statement-breakpoint
ALTER TABLE `counts` ADD `shop_id` integer NOT NULL DEFAULT 1 REFERENCES shops(id);--> statement-breakpoint
ALTER TABLE `deliveries` ADD `shop_id` integer NOT NULL DEFAULT 1 REFERENCES shops(id);--> statement-breakpoint
ALTER TABLE `employees` ADD `shop_id` integer NOT NULL DEFAULT 1 REFERENCES shops(id);--> statement-breakpoint
ALTER TABLE `expenses` ADD `shop_id` integer NOT NULL DEFAULT 1 REFERENCES shops(id);--> statement-breakpoint
ALTER TABLE `factory_entries` ADD `shop_id` integer NOT NULL DEFAULT 1 REFERENCES shops(id);--> statement-breakpoint
ALTER TABLE `fixed_charges` ADD `shop_id` integer NOT NULL DEFAULT 1 REFERENCES shops(id);--> statement-breakpoint
ALTER TABLE `orders` ADD `shop_id` integer NOT NULL DEFAULT 1 REFERENCES shops(id);--> statement-breakpoint
ALTER TABLE `pos_sales` ADD `shop_id` integer NOT NULL DEFAULT 1 REFERENCES shops(id);--> statement-breakpoint
CREATE TABLE `__new_result_days` (
	`shop_id` integer NOT NULL,
	`date` text NOT NULL,
	`credit_royale` integer DEFAULT 0 NOT NULL,
	`morning` integer DEFAULT 0 NOT NULL,
	`evening` integer DEFAULT 0 NOT NULL,
	`expenses` integer DEFAULT 0 NOT NULL,
	`owner_expenses` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	PRIMARY KEY(`shop_id`, `date`),
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_result_days`("shop_id", "date", "credit_royale", "morning", "evening", "expenses", "owner_expenses", "note") SELECT 1, "date", "credit_royale", "morning", "evening", "expenses", "owner_expenses", "note" FROM `result_days`;--> statement-breakpoint
DROP TABLE `result_days`;--> statement-breakpoint
ALTER TABLE `__new_result_days` RENAME TO `result_days`;--> statement-breakpoint
CREATE TABLE `__new_result_period_starts` (
	`shop_id` integer NOT NULL,
	`date` text NOT NULL,
	PRIMARY KEY(`shop_id`, `date`),
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_result_period_starts`("shop_id", "date") SELECT 1, "date" FROM `result_period_starts`;--> statement-breakpoint
DROP TABLE `result_period_starts`;--> statement-breakpoint
ALTER TABLE `__new_result_period_starts` RENAME TO `result_period_starts`;--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`shop_id` integer NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`shop_id`, `key`),
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_settings`("shop_id", "key", "value") SELECT 1, "key", "value" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;
