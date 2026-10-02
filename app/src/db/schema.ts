import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`);

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["owner", "staff"] }).notNull().default("staff"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

export const sessions = sqliteTable("sessions", {
  // SHA-256 of the cookie token, so a leaked DB can't be replayed as sessions.
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nameFr: text("name_fr").notNull(),
  nameAr: text("name_ar").notNull().default(""),
  sort: integer("sort").notNull().default(0),
});

export const UNITS = ["piece", "kg", "box"] as const;
export type Unit = (typeof UNITS)[number];

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nameFr: text("name_fr").notNull(),
  nameAr: text("name_ar").notNull().default(""),
  categoryId: integer("category_id").references(() => categories.id),
  unit: text("unit", { enum: UNITS }).notNull().default("piece"),
  // Money is stored in centimes (1 DH = 100) to avoid float rounding.
  purchasePrice: integer("purchase_price"),
  salePrice: integer("sale_price"),
  // Names the factory uses on its delivery notes, e.g. ["Gt mangue"].
  aliases: text("aliases", { mode: "json" }).$type<string[]>().notNull().default([]),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sort: integer("sort").notNull().default(0),
  createdAt: createdAt(),
});

export const COUNT_TYPES = ["stock", "delivery"] as const;
export type CountType = (typeof COUNT_TYPES)[number];

export const counts = sqliteTable("counts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: COUNT_TYPES }).notNull(),
  // Business day the count belongs to (YYYY-MM-DD, shop local time).
  date: text("date").notNull(),
  status: text("status", { enum: ["submitted", "validated"] })
    .notNull()
    .default("submitted"),
  note: text("note").notNull().default(""),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id),
  validatedBy: integer("validated_by").references(() => users.id),
  validatedAt: text("validated_at"),
  createdAt: createdAt(),
});

export const countLines = sqliteTable(
  "count_lines",
  {
    countId: integer("count_id")
      .notNull()
      .references(() => counts.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    // Real, because products sold by weight are counted in kg.
    qty: real("qty").notNull(),
  },
  (t) => [primaryKey({ columns: [t.countId, t.productId] })],
);

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Count = typeof counts.$inferSelect;

export const deliveries = sqliteTable("deliveries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Factory's delivery note number, e.g. "BL00030715". One note can span several printed sheets.
  blNumber: text("bl_number").notNull().default(""),
  // Delivery date printed on the note (YYYY-MM-DD); matched with delivery counts of the same day.
  date: text("date").notNull(),
  // "Montant" printed at the bottom of the note, in centimes.
  declaredTotal: integer("declared_total"),
  status: text("status", { enum: ["draft", "checked"] }).notNull().default("draft"),
  // Amount the owner agrees to owe after checking (centimes). Feeds the factory account later.
  acceptedTotal: integer("accepted_total"),
  note: text("note").notNull().default(""),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id),
  checkedAt: text("checked_at"),
  createdAt: createdAt(),
});

export const deliveryLines = sqliteTable("delivery_lines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deliveryId: integer("delivery_id")
    .notNull()
    .references(() => deliveries.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  // Text exactly as printed by the factory.
  designation: text("designation").notNull(),
  productId: integer("product_id").references(() => products.id),
  qty: real("qty").notNull(),
  unitPrice: integer("unit_price").notNull(),
  // Line amount as printed (centimes); null = not entered, assumed qty × unit price.
  amount: integer("amount"),
});

export const deliveryPhotos = sqliteTable("delivery_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deliveryId: integer("delivery_id")
    .notNull()
    .references(() => deliveries.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  createdAt: createdAt(),
});

export type Delivery = typeof deliveries.$inferSelect;
export type DeliveryLine = typeof deliveryLines.$inferSelect;

export const expenseCategories = sqliteTable("expense_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nameFr: text("name_fr").notNull(),
  nameAr: text("name_ar").notNull().default(""),
  // false for money leaving the till that isn't a cost (owner withdrawal, salary advance already recorded).
  isExpense: integer("is_expense", { mode: "boolean" }).notNull().default(true),
  sort: integer("sort").notNull().default(0),
});

export const cashClosings = sqliteTable("cash_closings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Business day being closed (YYYY-MM-DD). One closing per day.
  date: text("date").notNull().unique(),
  // All money in centimes.
  openingFloat: integer("opening_float").notNull(),
  // Cash in the till at closing, before anything is taken out.
  cashCounted: integer("cash_counted").notNull(),
  // Card / TPE payments of the day.
  card: integer("card").notNull().default(0),
  note: text("note").notNull().default(""),
  status: text("status", { enum: ["submitted", "validated"] }).notNull().default("submitted"),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id),
  validatedBy: integer("validated_by").references(() => users.id),
  createdAt: createdAt(),
});

/** Money paid out of the till during the day (small purchases, owner withdrawal…). */
export const cashOutflows = sqliteTable(
  "cash_outflows",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    closingId: integer("closing_id")
      .notNull()
      .references(() => cashClosings.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    amount: integer("amount").notNull(),
    // Set by the owner when classifying; null = not classified yet.
    categoryId: integer("category_id").references(() => expenseCategories.id),
  },
  (t) => [index("cash_outflows_closing_idx").on(t.closingId)],
);

export type CashClosing = typeof cashClosings.$inferSelect;

/** Costs paid outside the till (bank transfer, owner's pocket…). Till payouts are cash_outflows. */
export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => expenseCategories.id),
  label: text("label").notNull(),
  amount: integer("amount").notNull(),
  note: text("note").notNull().default(""),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
});

export const employees = sqliteTable("employees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  monthlySalary: integer("monthly_salary").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

export const SALARY_KINDS = ["salary", "advance", "bonus"] as const;

export const salaryPayments = sqliteTable("salary_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  date: text("date").notNull(),
  // Salary month this payment counts toward (YYYY-MM); advances are deducted from it.
  month: text("month").notNull(),
  kind: text("kind", { enum: SALARY_KINDS }).notNull(),
  amount: integer("amount").notNull(),
  note: text("note").notNull().default(""),
  createdAt: createdAt(),
});

export const FACTORY_ENTRY_KINDS = ["opening", "payment", "credit"] as const;
export const PAYMENT_METHODS = ["cash", "transfer", "cheque", "other"] as const;

/**
 * Factory account movements other than delivery notes:
 * opening = debt before using the app (+), payment (−), credit = credit note / goodwill (−).
 */
export const factoryEntries = sqliteTable("factory_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  kind: text("kind", { enum: FACTORY_ENTRY_KINDS }).notNull(),
  amount: integer("amount").notNull(),
  method: text("method", { enum: PAYMENT_METHODS }),
  reference: text("reference").notNull().default(""),
  note: text("note").notNull().default(""),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
});

export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type Employee = typeof employees.$inferSelect;

export const POS_PAYMENTS = ["cash", "card"] as const;

export const posSales = sqliteTable(
  "pos_sales",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Generated on the tablet so a sale sent twice (flaky network, offline queue) is stored once.
    clientId: text("client_id").notNull().unique(),
    // Business day (YYYY-MM-DD, Morocco time) and exact time the sale was made on the tablet.
    date: text("date").notNull(),
    soldAt: text("sold_at").notNull(),
    cashierId: integer("cashier_id")
      .notNull()
      .references(() => users.id),
    total: integer("total").notNull(),
    payment: text("payment", { enum: POS_PAYMENTS }).notNull(),
    cashGiven: integer("cash_given"),
    status: text("status", { enum: ["completed", "voided"] }).notNull().default("completed"),
    voidedBy: integer("voided_by").references(() => users.id),
    voidReason: text("void_reason"),
    createdAt: createdAt(),
  },
  (t) => [index("pos_sales_date_idx").on(t.date)],
);

export const posSaleLines = sqliteTable(
  "pos_sale_lines",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleId: integer("sale_id")
      .notNull()
      .references(() => posSales.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    // Snapshot at sale time, so later catalog edits don't rewrite history.
    label: text("label").notNull(),
    qty: real("qty").notNull(),
    unitPrice: integer("unit_price").notNull(),
    total: integer("total").notNull(),
  },
  (t) => [index("pos_sale_lines_sale_idx").on(t.saleId)],
);

/** Small key/value store for shop settings (receipt header, footer…). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
