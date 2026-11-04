import path from "node:path";
import type Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

/**
 * Opens the Drizzle connection and applies pending migrations.
 *
 * Foreign keys must be off meanwhile: a migration that rebuilds a table drops the old copy, and
 * with foreign keys on, SQLite empties it first, which cascades to child rows (count lines, sale
 * lines…). The pragma has no effect inside a transaction, so it can't live in the migration.
 */
export function openDb(sqlite: Database.Database) {
  sqlite.pragma("foreign_keys = OFF");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  const broken = sqlite.pragma("foreign_key_check") as unknown[];
  if (broken.length > 0) console.error("Foreign key violations after migrating:", broken);
  sqlite.pragma("foreign_keys = ON");
  return db;
}
