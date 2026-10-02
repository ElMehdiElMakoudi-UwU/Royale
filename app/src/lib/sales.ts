import "server-only";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CashClosing, Product } from "@/db/schema";

/** What the till says was sold that day: cash taken in + money paid out of the till + card. */
export function closingRevenue(c: Pick<CashClosing, "cashCounted" | "openingFloat" | "card">, outflows: number) {
  return c.cashCounted - c.openingFloat + outflows + c.card;
}

export function outflowTotals(closingIds: number[]) {
  const totals = new Map<number, number>();
  if (closingIds.length === 0) return totals;
  for (const o of db.select().from(schema.cashOutflows).where(inArray(schema.cashOutflows.closingId, closingIds)).all()) {
    totals.set(o.closingId, (totals.get(o.closingId) ?? 0) + o.amount);
  }
  return totals;
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export type SoldLine = {
  product: Product;
  qty: number;
  value: number | null;
  /** Quantity rung up on the register over the same days (null when the register wasn't used). */
  rung: number | null;
};

/** Register sales (non-voided) per day: totals by payment method. */
export function posByDay(from: string, toExclusive: string) {
  const rows = db
    .select()
    .from(schema.posSales)
    .where(and(eq(schema.posSales.status, "completed"), gte(schema.posSales.date, from), lt(schema.posSales.date, toExclusive)))
    .all();
  const days = new Map<string, { cash: number; card: number; count: number }>();
  for (const r of rows) {
    const d = days.get(r.date) ?? { cash: 0, card: 0, count: 0 };
    d[r.payment] += r.total;
    d.count++;
    days.set(r.date, d);
  }
  return { rows, days };
}

export type SalesPeriod = {
  /** Validated stock counts opening and closing the period. */
  fromCountId: number;
  toCountId: number;
  /** Sales days covered: from (inclusive) to (exclusive) — stock is counted each morning. */
  from: string;
  to: string;
  days: string[];
  sold: SoldLine[];
  /** Σ sold × sale price, for products that have one. */
  expected: number;
  /** Sold products without a sale price: expected is understated. */
  missingPrices: number;
  /** Products in the earlier count but not the later one (or vice-versa): not computed. */
  uncounted: number;
  /** Unvalidated delivery counts in the period, ignored in the estimate. */
  pendingDeliveries: number;
  declared: number;
  closings: number;
  missingClosingDays: string[];
  /** declared − expected: negative means money is missing. */
  gap: number;
  /** Total rung up on the register in the period; null when it wasn't used. */
  recorded: number | null;
};

/**
 * Splits time into periods between consecutive validated stock counts and, for each one, compares
 *   expected sales = (opening stock + validated deliveries − closing stock) × sale price
 * with the revenue declared in the cash closings of the same days.
 */
export function salesPeriods(limit = 60): SalesPeriod[] {
  const stockCounts = db
    .select()
    .from(schema.counts)
    .where(and(eq(schema.counts.type, "stock"), eq(schema.counts.status, "validated")))
    .orderBy(asc(schema.counts.date), asc(schema.counts.id))
    .all();
  // Keep the last count of each day.
  const byDay = new Map(stockCounts.map((c) => [c.date, c]));
  const stocks = [...byDay.values()].slice(-(limit + 1));
  if (stocks.length < 2) return [];

  const first = stocks[0].date;
  const last = stocks[stocks.length - 1].date;

  const deliveryCounts = db.select().from(schema.counts).where(eq(schema.counts.type, "delivery")).all()
    .filter((c) => c.date >= first && c.date < last);
  const countIds = [...stocks.map((c) => c.id), ...deliveryCounts.filter((c) => c.status === "validated").map((c) => c.id)];
  const lines = db.select().from(schema.countLines).where(inArray(schema.countLines.countId, countIds)).all();
  const linesByCount = new Map<number, Map<number, number>>();
  for (const l of lines) {
    if (!linesByCount.has(l.countId)) linesByCount.set(l.countId, new Map());
    linesByCount.get(l.countId)!.set(l.productId, l.qty);
  }

  const products = new Map(db.select().from(schema.products).all().map((p) => [p.id, p]));
  const closings = db.select().from(schema.cashClosings).all().filter((c) => c.date >= first && c.date < last);
  const outflows = outflowTotals(closings.map((c) => c.id));
  const pos = posByDay(first, last);
  const posLines = pos.rows.length
    ? db.select().from(schema.posSaleLines).where(inArray(schema.posSaleLines.saleId, pos.rows.map((r) => r.id))).all()
    : [];
  const posDate = new Map(pos.rows.map((r) => [r.id, r.date]));

  const periods: SalesPeriod[] = [];
  for (let i = 0; i < stocks.length - 1; i++) {
    const a = stocks[i];
    const b = stocks[i + 1];
    const inPeriod = (date: string) => date >= a.date && date < b.date;

    const delivered = new Map<number, number>();
    let pendingDeliveries = 0;
    for (const d of deliveryCounts.filter((d) => inPeriod(d.date))) {
      if (d.status !== "validated") {
        pendingDeliveries++;
        continue;
      }
      for (const [pid, q] of linesByCount.get(d.id) ?? []) delivered.set(pid, (delivered.get(pid) ?? 0) + q);
    }

    const periodPos = pos.rows.filter((r) => inPeriod(r.date));
    const usedPos = periodPos.length > 0;
    const rung = new Map<number, number>();
    for (const l of posLines) {
      if (inPeriod(posDate.get(l.saleId)!)) rung.set(l.productId, (rung.get(l.productId) ?? 0) + l.qty);
    }

    const open = linesByCount.get(a.id) ?? new Map<number, number>();
    const close = linesByCount.get(b.id) ?? new Map<number, number>();
    const sold: SoldLine[] = [];
    let uncounted = 0;
    let missingPrices = 0;
    let expected = 0;
    for (const pid of new Set([...open.keys(), ...close.keys()])) {
      const product = products.get(pid);
      if (!product) continue;
      if (!open.has(pid) || !close.has(pid)) {
        uncounted++;
        continue;
      }
      const qty = Math.round((open.get(pid)! + (delivered.get(pid) ?? 0) - close.get(pid)!) * 1000) / 1000;
      if (qty === 0) continue;
      const value = product.salePrice == null ? null : Math.round(qty * product.salePrice);
      if (value == null) missingPrices++;
      else expected += value;
      sold.push({ product, qty, value, rung: usedPos ? Math.round((rung.get(pid) ?? 0) * 1000) / 1000 : null });
    }
    sold.sort((x, y) => (y.value ?? 0) - (x.value ?? 0));

    const days: string[] = [];
    for (let d = a.date; d < b.date; d = addDays(d, 1)) days.push(d);
    const periodClosings = closings.filter((c) => inPeriod(c.date));
    const closedDays = new Set(periodClosings.map((c) => c.date));
    const declared = periodClosings.reduce((s, c) => s + closingRevenue(c, outflows.get(c.id) ?? 0), 0);

    periods.push({
      fromCountId: a.id,
      toCountId: b.id,
      from: a.date,
      to: b.date,
      days,
      sold,
      expected,
      missingPrices,
      uncounted,
      pendingDeliveries,
      declared,
      closings: periodClosings.length,
      missingClosingDays: days.filter((d) => !closedDays.has(d)),
      gap: declared - expected,
      recorded: usedPos ? periodPos.reduce((s, r) => s + r.total, 0) : null,
    });
  }
  return periods.reverse();
}
