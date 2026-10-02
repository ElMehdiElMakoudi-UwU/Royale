import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { OrderStatusChip } from "./status-chip";
import { PageHeader, SectionTitle } from "@/components/ui";
import { db, schema } from "@/db";
import type { Order } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { dateLabel, money, today } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { addDays } from "@/lib/money";
import { openOrders, paidByOrder } from "@/lib/orders";

const VIEWS = ["open", "delivered", "cancelled"] as const;
type View = (typeof VIEWS)[number];

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  await requireUser();
  const { t, locale } = await getDict();
  const to = t.orders;
  const sp = (await searchParams).view;
  const view: View = VIEWS.includes(sp as View) ? (sp as View) : "open";

  const orders =
    view === "open"
      ? openOrders()
      : db.select().from(schema.orders).where(eq(schema.orders.status, view)).orderBy(desc(schema.orders.pickupDate)).limit(100).all();
  const paid = paidByOrder(orders.map((o) => o.id));
  const lines = orders.length
    ? db.select().from(schema.orderLines).where(inArray(schema.orderLines.orderId, orders.map((o) => o.id))).all()
    : [];
  const summary = new Map<number, string[]>();
  for (const l of lines) summary.set(l.orderId, [...(summary.get(l.orderId) ?? []), l.label]);

  // Open orders are grouped by pickup day so the kitchen sees what's due first.
  const day = today();
  const tomorrow = addDays(day, 1);
  const groupOf = (o: Order) =>
    view !== "open" ? "" : o.pickupDate < day ? to.late : o.pickupDate === day ? to.today : o.pickupDate === tomorrow ? to.tomorrow : dateLabel(o.pickupDate, locale);
  const groups: { title: string; late: boolean; orders: Order[] }[] = [];
  for (const o of orders) {
    const title = groupOf(o);
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.orders.push(o);
    else groups.push({ title, late: o.pickupDate < day, orders: [o] });
  }

  return (
    <>
      <PageHeader title={to.title}>
        <Link href="/orders/new" className="btn-primary">+ {to.new}</Link>
      </PageHeader>

      <div className="mb-5 flex gap-1">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={v === "open" ? "/orders" : `/orders?view=${v}`}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${view === v ? "bg-gold-soft text-cocoa" : "text-muted hover:text-cocoa"}`}
          >
            {to.views[v]}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="card p-8 text-center text-muted">{to.none}</p>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.title}>
              {g.title && (
                <SectionTitle>
                  <span className={g.late && view === "open" ? "text-bad" : ""}>{g.title}</span>
                </SectionTitle>
              )}
              <ul className="card divide-y divide-line overflow-hidden">
                {g.orders.map((o) => {
                  const due = o.total - (paid.get(o.id) ?? 0);
                  return (
                    <li key={o.id}>
                      <Link href={`/orders/${o.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-cream">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">
                            {o.customerName}
                            <span className="ms-2 text-xs font-normal text-muted">
                              {to.occasions[o.occasion]}
                              {view !== "open" && ` · ${dateLabel(o.pickupDate, locale)}`}
                              {o.pickupTime && ` · ${o.pickupTime}`}
                              {o.deliveryAddress && ` · ${to.delivery}`}
                            </span>
                          </div>
                          <div className="truncate text-xs text-muted">{summary.get(o.id)?.join(", ")}</div>
                        </div>
                        <div className="tabular text-end">
                          <div className="font-semibold text-cocoa">
                            {money(o.total)}
                            <span className="ms-1 text-xs font-normal text-muted">{t.common.dh}</span>
                          </div>
                          {due > 0 && o.status !== "cancelled" && (
                            <div className="text-xs text-warn">
                              {to.due} {money(due)}
                            </div>
                          )}
                        </div>
                        <OrderStatusChip status={o.status} t={to} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
