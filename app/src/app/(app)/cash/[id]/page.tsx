import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClosingForm } from "../closing-form";
import { reopenClosing, validateClosing } from "../actions";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { dateLabel, money } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { usersById } from "@/lib/queries";
import { addDays } from "@/lib/money";
import { orderPaymentsByDay } from "@/lib/orders";
import { closingRevenue, posByDay, salesPeriods } from "@/lib/sales";

export default async function ClosingPage({ params, searchParams }: PageProps<"/cash/[id]">) {
  const user = await requireUser();
  const { t, locale } = await getDict();
  const tc = t.cash;
  const id = Number((await params).id);
  const closing = Number.isInteger(id)
    ? db.select().from(schema.cashClosings).where(eq(schema.cashClosings.id, id)).get()
    : undefined;
  const isOwner = user.role === "owner";
  if (!closing || (!isOwner && closing.createdBy !== user.id)) notFound();

  const outflows = db.select().from(schema.cashOutflows).where(eq(schema.cashOutflows.closingId, id)).all();
  const outTotal = outflows.reduce((s, o) => s + o.amount, 0);
  const revenue = closingRevenue(closing, outTotal);
  const validated = closing.status === "validated";
  const title = `${tc.title} — ${dateLabel(closing.date, locale)}`;

  if (isOwner && !validated && (await searchParams).edit) {
    return (
      <>
        <PageHeader title={tc.edit} subtitle={title} back={{ href: `/cash/${id}`, label: t.common.back }} />
        <ClosingForm
          t={{ ...tc, common: t.common }}
          canPickDate
          editId={id}
          initial={{
            date: closing.date,
            openingFloat: closing.openingFloat,
            cashCounted: closing.cashCounted,
            card: closing.card,
            note: closing.note,
            outflows: outflows.map((o) => ({ label: o.label, amount: o.amount })),
          }}
        />
      </>
    );
  }

  const period = isOwner ? salesPeriods().find((p) => closing.date >= p.from && closing.date < p.to) : undefined;
  // When the register was used that day, the till should hold: float + cash sales + order payments − payouts.
  const pos = isOwner ? posByDay(closing.date, addDays(closing.date, 1)).days.get(closing.date) : undefined;
  const orderPaid = isOwner ? orderPaymentsByDay(closing.date, addDays(closing.date, 1)).get(closing.date) : undefined;
  const orderCash = orderPaid?.cash ?? 0;
  const expectedCard = (pos?.card ?? 0) + (orderPaid?.card ?? 0);
  const expectedCash = pos ? closing.openingFloat + pos.cash + orderCash - outTotal : null;

  const row = (label: string, value: number, sign = "") => (
    <div className="tabular flex justify-between px-4 py-2.5 text-sm">
      <span className="text-muted">{label}</span>
      <span>
        {sign}
        {money(value)}
      </span>
    </div>
  );

  return (
    <>
      <PageHeader
        title={title}
        back={{ href: "/cash", label: tc.title }}
        subtitle={
          <span className="inline-flex items-center gap-2">
            {validated ? (
              <span className="chip bg-ok-soft text-ok">{tc.validated}</span>
            ) : (
              <span className="chip bg-warn-soft text-warn">{tc.submitted}</span>
            )}
            <span>{t.common.by} {usersById().get(closing.createdBy)}</span>
          </span>
        }
      >
        {isOwner && !validated && (
          <>
            <Link href={`/cash/${id}?edit=1`} className="btn-ghost">{tc.edit}</Link>
            <form action={validateClosing.bind(null, id)}>
              <button className="btn-primary">{tc.validate}</button>
            </form>
          </>
        )}
        {isOwner && validated && (
          <form action={reopenClosing.bind(null, id)}>
            <button className="btn-ghost">{tc.reopen}</button>
          </form>
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card divide-y divide-line self-start">
          {row(tc.cashCounted, closing.cashCounted)}
          {row(tc.openingFloat, closing.openingFloat, "− ")}
          {outflows.map((o) => (
            <div key={o.id}>{row(`${tc.outflows} : ${o.label}`, o.amount, "+ ")}</div>
          ))}
          {row(tc.card, closing.card, "+ ")}
          <div className="tabular flex justify-between bg-gold-soft/50 px-4 py-3">
            <span className="font-semibold text-cocoa">{tc.revenue}</span>
            <span className="text-lg font-semibold text-cocoa">
              {money(revenue)} {t.common.dh}
            </span>
          </div>
        </div>

        {pos && expectedCash != null && (
          <div className="card self-start p-4 lg:col-start-2">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{t.nav.pos}</h2>
            <div className="tabular space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">{t.posCompare.posCash}</span>
                <span>{money(pos.cash)}</span>
              </div>
              {orderCash > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">{t.orders.fromOrders} ({t.orders.methods.cash})</span>
                  <span>{money(orderCash)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted">{tc.card}</span>
                <span className={expectedCard !== closing.card ? "font-semibold text-bad" : ""}>
                  {money(expectedCard)}
                  {expectedCard !== closing.card && <span className="text-xs font-normal text-muted"> ≠ {money(closing.card)}</span>}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">{t.posCompare.expectedCash}</span>
                <span>{money(expectedCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">{tc.cashCounted}</span>
                <span>{money(closing.cashCounted)}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
                <span>{t.posCompare.posGap}</span>
                <span className={closing.cashCounted - expectedCash < 0 ? "text-bad" : "text-ok"}>
                  {closing.cashCounted - expectedCash > 0 ? "+" : ""}
                  {money(closing.cashCounted - expectedCash)}
                </span>
              </div>
            </div>
          </div>
        )}

        {!pos && orderPaid && orderCash + orderPaid.card > 0 && (
          <div className="card self-start p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{t.orders.fromOrders}</h2>
            <div className="tabular space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">{t.orders.methods.cash}</span>
                <span>{money(orderCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">{t.orders.methods.card}</span>
                <span>{money(orderPaid.card)}</span>
              </div>
            </div>
            <Link href="/orders" className="mt-3 inline-block text-sm font-medium text-cocoa underline underline-offset-4">
              {t.nav.orders}
            </Link>
          </div>
        )}

        {isOwner && (
          <div className="card self-start p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{tc.period}</h2>
            {period ? (
              <>
                <p className="mb-3 text-sm text-muted">
                  {dateLabel(period.from, locale)} → {dateLabel(period.days[period.days.length - 1], locale)}
                </p>
                <div className="tabular space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">{t.sales.expected}</span>
                    <span>{money(period.expected)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">{t.sales.declared}</span>
                    <span>{money(period.declared)}</span>
                  </div>
                  <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
                    <span>{tc.gap}</span>
                    <span className={period.gap < 0 ? "text-bad" : "text-ok"}>
                      {period.gap > 0 ? "+" : ""}
                      {money(period.gap)}
                    </span>
                  </div>
                </div>
                <Link href="/sales" className="mt-3 inline-block text-sm font-medium text-cocoa underline underline-offset-4">
                  {tc.seeSales}
                </Link>
              </>
            ) : (
              <p className="text-sm text-muted">{tc.noPeriod}</p>
            )}
          </div>
        )}
      </div>

      {closing.note && (
        <p className="mt-6 rounded-xl bg-gold-soft px-4 py-3 text-sm text-cocoa">
          <span className="font-semibold">{tc.note} : </span>
          {closing.note}
        </p>
      )}
    </>
  );
}
