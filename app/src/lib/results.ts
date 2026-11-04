import "server-only";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { monthDates, monthResults } from "./results-calc";

const MARKUP_KEY = "resultMarkupPct";
const DEFAULT_MARKUP_PCT = 20;

export function getMarkupPct() {
  const row = db.select().from(schema.settings).where(eq(schema.settings.key, MARKUP_KEY)).get();
  const pct = row ? Number(row.value) : NaN;
  return Number.isFinite(pct) ? pct : DEFAULT_MARKUP_PCT;
}

export function saveMarkupPct(pct: number) {
  db.insert(schema.settings)
    .values({ key: MARKUP_KEY, value: String(pct) })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: String(pct) } })
    .run();
}

/** The month's charges, or those of the latest earlier month that has some. */
export function fixedChargesFor(month: string) {
  const latest = db
    .select({ month: schema.fixedCharges.month })
    .from(schema.fixedCharges)
    .where(lte(schema.fixedCharges.month, month))
    .orderBy(desc(schema.fixedCharges.month))
    .limit(1)
    .get();
  if (!latest) return [];
  return db.select().from(schema.fixedCharges).where(eq(schema.fixedCharges.month, latest.month)).orderBy(asc(schema.fixedCharges.id)).all();
}

export function monthResultsData(month: string) {
  const dates = monthDates(month);
  const inMonth = (column: Parameters<typeof gte>[0]) => and(gte(column, dates[0]), lte(column, dates[dates.length - 1]));
  const days = db.select().from(schema.resultDays).where(inMonth(schema.resultDays.date)).orderBy(asc(schema.resultDays.date)).all();
  const periodStarts = db
    .select()
    .from(schema.resultPeriodStarts)
    .where(inMonth(schema.resultPeriodStarts.date))
    .orderBy(asc(schema.resultPeriodStarts.date))
    .all()
    .map((s) => s.date);
  const charges = fixedChargesFor(month);
  const fixedTotal = charges.reduce((s, c) => s + c.amount, 0);
  const markupPct = getMarkupPct();
  return {
    days,
    periodStarts,
    charges,
    fixedTotal,
    markupPct,
    results: monthResults({ month, days, periodStarts, fixedTotal, markupPct }),
  };
}
