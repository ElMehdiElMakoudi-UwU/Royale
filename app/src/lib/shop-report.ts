import "server-only";
import { and, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { today } from "./format";
import { factoryAccount, monthOf, nextMonth, prevMonth } from "./money";
import { paidByOrder } from "./orders";
import { listProducts } from "./queries";
import { monthResultsData } from "./results";
import { monthDates, totalsOf, type ResultDay } from "./results-calc";

const daySales = (d: ResultDay) => d.morning + d.evening;

/** The current month when it has ledger days, otherwise the latest earlier month that has some. */
export function latestReportMonth() {
  const current = monthOf(today());
  const latest = db
    .select({ date: schema.resultDays.date })
    .from(schema.resultDays)
    .where(lt(schema.resultDays.date, `${nextMonth(current)}-01`))
    .orderBy(desc(schema.resultDays.date))
    .limit(1)
    .get();
  return latest ? monthOf(latest.date) : current;
}

function registerFigures(shopId: number, month: string) {
  const from = `${month}-01`;
  const to = `${nextMonth(month)}-01`;
  const sales = db
    .select()
    .from(schema.posSales)
    .where(and(eq(schema.posSales.shopId, shopId), gte(schema.posSales.date, from), lt(schema.posSales.date, to)))
    .all();
  const completed = sales.filter((s) => s.status === "completed");
  const total = completed.reduce((s, r) => s + r.total, 0);
  const card = completed.filter((s) => s.payment === "card").reduce((s, r) => s + r.total, 0);

  const byProduct = new Map<number, { qty: number; total: number }>();
  if (completed.length > 0) {
    const lines = db
      .select()
      .from(schema.posSaleLines)
      .where(inArray(schema.posSaleLines.saleId, completed.map((s) => s.id)))
      .all();
    for (const l of lines) {
      const p = byProduct.get(l.productId) ?? { qty: 0, total: 0 };
      p.qty += l.qty;
      p.total += l.total;
      byProduct.set(l.productId, p);
    }
  }
  const products = new Map(listProducts({ includeInactive: true }).map((p) => [p.id, p]));
  const topProducts = [...byProduct]
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 5)
    .flatMap(([id, figures]) => {
      const product = products.get(id);
      return product ? [{ product, ...figures }] : [];
    });

  return {
    total,
    tickets: completed.length,
    voided: sales.length - completed.length,
    averageTicket: completed.length > 0 ? Math.round(total / completed.length) : null,
    cardShare: total > 0 ? card / total : null,
    topProducts,
  };
}

/** Orders collected in the month, by pickup day; cancelled ones don't count. */
function orderFigures(shopId: number, month: string) {
  const orders = db
    .select({ id: schema.orders.id, total: schema.orders.total, status: schema.orders.status })
    .from(schema.orders)
    .where(and(eq(schema.orders.shopId, shopId), gte(schema.orders.pickupDate, `${month}-01`), lte(schema.orders.pickupDate, `${month}-31`)))
    .all()
    .filter((o) => o.status !== "cancelled");
  const paid = paidByOrder(orders.map((o) => o.id));
  const value = orders.reduce((s, o) => s + o.total, 0);
  return {
    count: orders.length,
    value,
    due: orders.reduce((s, o) => s + Math.max(0, o.total - (paid.get(o.id) ?? 0)), 0),
  };
}

/**
 * One shop's KPIs for a month. Money figures come from the results ledger; register and order
 * figures are added on the side and stay empty for a shop that doesn't use them.
 *
 * `previous` covers the same days of the previous month (up to the day of the month last entered),
 * so a month in progress isn't compared with a whole month.
 */
export function shopReport(shopId: number, month: string, trendMonths = 6) {
  const { days, results } = monthResultsData(shopId, month);
  const lastEntered = days.at(-1)?.date ?? null;
  const cutoff = lastEntered?.slice(8);
  const previousDays = cutoff ? monthResultsData(shopId, prevMonth(month)).days.filter((d) => d.date.slice(8) <= cutoff) : [];

  const salesDays = days.filter((d) => daySales(d) > 0);
  const best = salesDays.reduce<ResultDay | null>((b, d) => (!b || daySales(d) > daySales(b) ? d : b), null);
  const worst = salesDays.reduce<ResultDay | null>((w, d) => (!w || daySales(d) < daySales(w) ? d : w), null);

  // Monday first.
  const weekdays = Array.from({ length: 7 }, () => ({ total: 0, days: 0 }));
  for (const d of salesDays) {
    const slot = weekdays[(new Date(`${d.date}T00:00:00Z`).getUTCDay() + 6) % 7];
    slot.total += daySales(d);
    slot.days++;
  }

  const byDate = new Map(days.map((d) => [d.date, d]));
  const months: string[] = [month];
  while (months.length < trendMonths) months.unshift(prevMonth(months[0]));

  return {
    entered: days.length,
    lastEntered,
    results,
    totals: results.totals,
    previous: previousDays.length > 0 ? totalsOf(previousDays) : null,
    morning: days.reduce((s, d) => s + d.morning, 0),
    evening: days.reduce((s, d) => s + d.evening, 0),
    best: best && { date: best.date, sales: daySales(best) },
    worst: worst && { date: worst.date, sales: daySales(worst) },
    weekdayAverages: weekdays.map((w) => (w.days > 0 ? Math.round(w.total / w.days) : null)),
    dailySales: monthDates(month).map((date) => {
      const d = byDate.get(date);
      return d && daySales(d) > 0 ? daySales(d) : null;
    }),
    trend: months.map((m) => {
      const monthDays = monthResultsData(shopId, m).days;
      const totals = monthDays.length > 0 ? totalsOf(monthDays) : null;
      return { month: m, sales: totals?.sales ?? null, final: totals?.final ?? null };
    }),
    factoryBalance: factoryAccount(shopId).balance,
    register: registerFigures(shopId, month),
    orders: orderFigures(shopId, month),
  };
}

export type ShopReport = ReturnType<typeof shopReport>;
