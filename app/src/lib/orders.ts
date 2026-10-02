import "server-only";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Order } from "@/db/schema";
import { label } from "./format";
import type { Locale } from "./i18n";
import { groupProducts, listCategories, listProducts } from "./queries";

export function getOrder(id: number) {
  const order = db.select().from(schema.orders).where(eq(schema.orders.id, id)).get();
  if (!order) return null;
  const lines = db
    .select()
    .from(schema.orderLines)
    .where(eq(schema.orderLines.orderId, id))
    .orderBy(asc(schema.orderLines.position))
    .all();
  const payments = db
    .select()
    .from(schema.orderPayments)
    .where(eq(schema.orderPayments.orderId, id))
    .orderBy(asc(schema.orderPayments.date), asc(schema.orderPayments.id))
    .all();
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return { ...order, lines, payments, paid, due: order.total - paid };
}

/** Amount paid so far per order. */
export function paidByOrder(orderIds: number[]) {
  const paid = new Map<number, number>();
  if (orderIds.length === 0) return paid;
  for (const p of db.select().from(schema.orderPayments).where(inArray(schema.orderPayments.orderId, orderIds)).all()) {
    paid.set(p.orderId, (paid.get(p.orderId) ?? 0) + p.amount);
  }
  return paid;
}

/** Orders still to hand over (pending or ready), soonest first; `before` limits to pickups before that day. */
export function openOrders(before?: string): Order[] {
  return db
    .select()
    .from(schema.orders)
    .where(
      and(
        inArray(schema.orders.status, ["pending", "ready"]),
        before ? lt(schema.orders.pickupDate, before) : undefined,
      ),
    )
    .orderBy(asc(schema.orders.pickupDate), asc(schema.orders.pickupTime))
    .all();
}

/**
 * Order payments taken at the till per day, by method. They are in the till's cash and card
 * totals but not on the register, so the cash closing adds them to what the till should hold.
 */
export function orderPaymentsByDay(from: string, toExclusive: string) {
  const days = new Map<string, { cash: number; card: number; transfer: number }>();
  const rows = db
    .select()
    .from(schema.orderPayments)
    .where(and(gte(schema.orderPayments.date, from), lt(schema.orderPayments.date, toExclusive)))
    .all();
  for (const p of rows) {
    const d = days.get(p.date) ?? { cash: 0, card: 0, transfer: 0 };
    d[p.method] += p.amount;
    days.set(p.date, d);
  }
  return days;
}

/** Catalog products offered in the order form, priced at the sale price. */
export function orderProductOptions(locale: Locale, noCategory: string) {
  return groupProducts(listProducts(), listCategories()).flatMap((g) =>
    g.products.map((p) => ({
      id: p.id,
      label: label(p, locale),
      group: g.category ? label(g.category, locale) : noCategory,
      price: p.salePrice,
    })),
  );
}
