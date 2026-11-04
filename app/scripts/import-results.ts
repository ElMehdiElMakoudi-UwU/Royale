/**
 * Imports results history from a JSON file into the results ledger. Days already in the
 * ledger are left untouched, so it's safe to re-run and never overwrites later corrections.
 *
 *   npm run import:results -- data/results-2026-10.json
 *
 * Amounts in the file are in DH:
 *   {
 *     "days": [{ "date": "2026-10-01", "creditRoyale": 7461, "morning": 1500, "evening": 4800,
 *                "expenses": 1100, "ownerExpenses": 0, "note": "..." }],
 *     "periodStarts": ["2026-10-10"],
 *     "fixedCharges": { "month": "2026-10", "items": [{ "label": "Salaire", "amount": 8000 }] }
 *   }
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { z } from "zod";
import * as schema from "../src/db/schema";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dh = z.number().min(0);
const File = z.object({
  days: z.array(
    z.object({
      date,
      creditRoyale: dh,
      morning: dh,
      evening: dh,
      expenses: dh,
      ownerExpenses: dh,
      note: z.string(),
    }),
  ),
  periodStarts: z.array(date).default([]),
  fixedCharges: z
    .object({
      month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      items: z.array(z.object({ label: z.string().min(1), amount: dh })).min(1),
    })
    .optional(),
});

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run import:results -- <file.json>");
  process.exit(1);
}
const data = File.parse(JSON.parse(fs.readFileSync(file, "utf8")));
const cents = (amount: number) => Math.round(amount * 100);

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const sqlite = new Database(path.join(dataDir, "royale.db"));
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

let imported = 0;
db.transaction((tx) => {
  for (const d of data.days) {
    const { changes } = tx
      .insert(schema.resultDays)
      .values({
        date: d.date,
        creditRoyale: cents(d.creditRoyale),
        morning: cents(d.morning),
        evening: cents(d.evening),
        expenses: cents(d.expenses),
        ownerExpenses: cents(d.ownerExpenses),
        note: d.note,
      })
      .onConflictDoNothing()
      .run();
    imported += changes;
  }
  for (const start of data.periodStarts) {
    tx.insert(schema.resultPeriodStarts).values({ date: start }).onConflictDoNothing().run();
  }
  if (data.fixedCharges) {
    const { month, items } = data.fixedCharges;
    const existing = tx.select().from(schema.fixedCharges).where(eq(schema.fixedCharges.month, month)).all();
    if (existing.length === 0) {
      tx.insert(schema.fixedCharges)
        .values(items.map((i) => ({ month, label: i.label, amount: cents(i.amount) })))
        .run();
    }
  }
});
console.log(`${imported} day(s) imported, ${data.days.length - imported} already present and left as they are.`);
sqlite.close();
