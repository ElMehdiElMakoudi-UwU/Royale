CREATE TABLE `employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`monthly_salary` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expense_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name_fr` text NOT NULL,
	`name_ar` text DEFAULT '' NOT NULL,
	`is_expense` integer DEFAULT true NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`category_id` integer NOT NULL,
	`label` text NOT NULL,
	`amount` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `factory_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`method` text,
	`reference` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `salary_payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`date` text NOT NULL,
	`month` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `cash_outflows` ADD `category_id` integer REFERENCES expense_categories(id);--> statement-breakpoint
INSERT INTO `expense_categories` (`name_fr`, `name_ar`, `is_expense`, `sort`) VALUES
  ('Loyer', 'الكراء', 1, 0),
  ('Électricité & eau', 'الكهرباء والماء', 1, 1),
  ('Emballages & fournitures', 'التغليف واللوازم', 1, 2),
  ('Transport', 'النقل', 1, 3),
  ('Entretien & réparations', 'الصيانة والإصلاح', 1, 4),
  ('Téléphone & internet', 'الهاتف والإنترنت', 1, 5),
  ('Impôts & taxes', 'الضرائب والرسوم', 1, 6),
  ('Autre', 'أخرى', 1, 7),
  ('Pas une dépense (retrait, avance)', 'ليس مصروفا (سحب، تسبيق)', 0, 8);
