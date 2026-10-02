CREATE TABLE `pos_sale_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`label` text NOT NULL,
	`qty` real NOT NULL,
	`unit_price` integer NOT NULL,
	`total` integer NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `pos_sales`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pos_sale_lines_sale_idx` ON `pos_sale_lines` (`sale_id`);--> statement-breakpoint
CREATE TABLE `pos_sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` text NOT NULL,
	`date` text NOT NULL,
	`sold_at` text NOT NULL,
	`cashier_id` integer NOT NULL,
	`total` integer NOT NULL,
	`payment` text NOT NULL,
	`cash_given` integer,
	`status` text DEFAULT 'completed' NOT NULL,
	`voided_by` integer,
	`void_reason` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`cashier_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`voided_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pos_sales_client_id_unique` ON `pos_sales` (`client_id`);--> statement-breakpoint
CREATE INDEX `pos_sales_date_idx` ON `pos_sales` (`date`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
