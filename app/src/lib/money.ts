import "server-only";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Delivery } from "@/db/schema";
import { closingRevenue, outflowTotals } from "./sales";

// ---------- dates ----------

const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
};
/** Monday of the week containing `iso`. */
export const weekStart = (iso: string) => addDays(iso, -((toDate(iso).getUTCDay() + 6) % 7));
export const monthOf = (iso: string) => iso.slice(0, 7);
export const nextMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};
export const prevMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
export const isMonth = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

// ---------- factory account ----------

export type FactoryWeek = {
  start: string;
  end: string; // Sunday
  opening: number;
  notes: Pick<Delivery, "id" | "blNumber" | "date" | "declaredTotal" | "acceptedTotal">[];
  notesTotal: number;
  /** Opening-balance entries recorded that week. */
  openingAdded: number;
  entries: (typeof schema.factoryEntries.$inferSelect)[];
  paid: number;
  closing: number;
};

const sign = (kind: "opening" | "payment" | "credit") => (kind === "opening" ? 1 : -1);

/**
 * Factory account by week (Monday → Sunday): what we owe goes up with each validated
 * delivery note (amount accepted after checking) and down with payments and credit notes.
 */
export function factoryAccount() {
  const notes = db
    .select({
      id: schema.deliveries.id,
      blNumber: schema.deliveries.blNumber,
      date: schema.deliveries.date,
      declaredTotal: schema.deliveries.declaredTotal,
      acceptedTotal: schema.deliveries.acceptedTotal,
    })
    .from(schema.deliveries)
    .where(eq(schema.deliveries.status, "checked"))
    .orderBy(asc(schema.deliveries.date))
    .all();
  const entries = db.select().from(schema.factoryEntries).orderBy(asc(schema.factoryEntries.date), asc(schema.factoryEntries.id)).all();
  const drafts = db.select().from(schema.deliveries).where(eq(schema.deliveries.status, "draft")).all();

  const dates = [...notes.map((n) => n.date), ...entries.map((e) => e.date)];
  const weeks: FactoryWeek[] = [];
  if (dates.length > 0) {
    const first = weekStart(dates.reduce((a, b) => (a < b ? a : b)));
    const last = weekStart(dates.reduce((a, b) => (a > b ? a : b)));
    let balance = 0;
    for (let start = first; start <= last; start = addDays(start, 7)) {
      const end = addDays(start, 6);
      const inWeek = (d: string) => d >= start && d <= end;
      const weekNotes = notes.filter((n) => inWeek(n.date));
      const weekEntries = entries.filter((e) => inWeek(e.date));
      const notesTotal = weekNotes.reduce((s, n) => s + (n.acceptedTotal ?? 0), 0);
      const openingAdded = weekEntries.filter((e) => e.kind === "opening").reduce((s, e) => s + e.amount, 0);
      const paid = weekEntries.filter((e) => e.kind !== "opening").reduce((s, e) => s + e.amount, 0);
      const opening = balance;
      balance = balance + openingAdded + notesTotal - paid;
      weeks.push({ start, end, opening, notes: weekNotes, notesTotal, openingAdded, entries: weekEntries, paid, closing: balance });
    }
  }
  const balance = entries.reduce((s, e) => s + sign(e.kind) * e.amount, 0) + notes.reduce((s, n) => s + (n.acceptedTotal ?? 0), 0);
  const draftTotal = drafts.reduce((s, d) => s + (d.declaredTotal ?? 0), 0);
  return { weeks: weeks.reverse(), balance, drafts: drafts.length, draftTotal };
}

// ---------- monthly figures ----------

const inMonth = (column: Parameters<typeof gte>[0], month: string) =>
  and(gte(column, `${month}-01`), lt(column, `${nextMonth(month)}-01`));

export function monthExpenses(month: string) {
  const categories = db.select().from(schema.expenseCategories).orderBy(asc(schema.expenseCategories.sort)).all();
  const expenses = db
    .select()
    .from(schema.expenses)
    .where(inMonth(schema.expenses.date, month))
    .orderBy(asc(schema.expenses.date), asc(schema.expenses.id))
    .all();
  const outflows = db
    .select({ outflow: schema.cashOutflows, date: schema.cashClosings.date })
    .from(schema.cashOutflows)
    .innerJoin(schema.cashClosings, eq(schema.cashClosings.id, schema.cashOutflows.closingId))
    .where(inMonth(schema.cashClosings.date, month))
    .orderBy(asc(schema.cashClosings.date))
    .all()
    .map((r) => ({ ...r.outflow, date: r.date }));

  const byCategory = new Map<number, number>();
  for (const e of expenses) byCategory.set(e.categoryId, (byCategory.get(e.categoryId) ?? 0) + e.amount);
  for (const o of outflows) if (o.categoryId != null) byCategory.set(o.categoryId, (byCategory.get(o.categoryId) ?? 0) + o.amount);

  const counted = new Set(categories.filter((c) => c.isExpense).map((c) => c.id));
  const total = [...byCategory].filter(([id]) => counted.has(id)).reduce((s, [, v]) => s + v, 0);
  const unclassified = outflows.filter((o) => o.categoryId == null);
  return {
    categories,
    expenses,
    outflows,
    byCategory,
    total,
    unclassified: unclassified.length,
    unclassifiedTotal: unclassified.reduce((s, o) => s + o.amount, 0),
  };
}

export function monthSalaries(month: string) {
  const employees = db.select().from(schema.employees).orderBy(asc(schema.employees.name)).all();
  const payments = db
    .select()
    .from(schema.salaryPayments)
    .where(eq(schema.salaryPayments.month, month))
    .orderBy(asc(schema.salaryPayments.date))
    .all();
  const rows = employees
    .map((e) => {
      const mine = payments.filter((p) => p.employeeId === e.id);
      const sum = (kind: string) => mine.filter((p) => p.kind === kind).reduce((s, p) => s + p.amount, 0);
      const advances = sum("advance");
      const salaryPaid = sum("salary");
      const bonus = sum("bonus");
      return {
        employee: e,
        payments: mine,
        advances,
        salaryPaid,
        bonus,
        remaining: e.monthlySalary - advances - salaryPaid,
      };
    })
    .filter((r) => r.employee.active || r.payments.length > 0);
  // Cost of the month = everything actually paid for that month.
  const total = payments.reduce((s, p) => s + p.amount, 0);
  return { rows, total };
}

/** Simple monthly result, based on money declared and money spent. */
export function monthResult(month: string) {
  const closings = db.select().from(schema.cashClosings).where(inMonth(schema.cashClosings.date, month)).all();
  const outflows = outflowTotals(closings.map((c) => c.id));
  const sales = closings.reduce((s, c) => s + closingRevenue(c, outflows.get(c.id) ?? 0), 0);

  const notes = db
    .select()
    .from(schema.deliveries)
    .where(and(eq(schema.deliveries.status, "checked"), inMonth(schema.deliveries.date, month)))
    .all();
  const purchases = notes.reduce((s, n) => s + (n.acceptedTotal ?? 0), 0);

  // Order payments by transfer never go through the till, so they aren't in the closings.
  const orderTransfers = db
    .select()
    .from(schema.orderPayments)
    .where(and(eq(schema.orderPayments.method, "transfer"), inMonth(schema.orderPayments.date, month)))
    .all()
    .reduce((s, p) => s + p.amount, 0);

  const expenses = monthExpenses(month);
  const salaries = monthSalaries(month);
  return {
    sales,
    orderTransfers,
    closingDays: closings.length,
    purchases,
    notes: notes.length,
    expenses,
    salaries,
    result: sales + orderTransfers - purchases - expenses.total - salaries.total,
  };
}
