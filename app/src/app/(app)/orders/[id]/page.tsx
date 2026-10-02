import Link from "next/link";
import { notFound } from "next/navigation";
import { addPayment, deleteOrder, deletePayment, setOrderStatus } from "../actions";
import { OrderStatusChip } from "../status-chip";
import { ConfirmButton } from "@/components/confirm-button";
import { OrderSlip } from "@/components/order-slip";
import { PrintButton } from "@/components/print-receipt";
import { PageHeader, SectionTitle } from "@/components/ui";
import { ORDER_PAYMENT_METHODS } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { dateLabel, money, qty, today } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import fr from "@/lib/i18n/fr";
import { getOrder } from "@/lib/orders";
import { usersById } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const user = await requireUser();
  const { t, locale } = await getDict();
  const to = t.orders;
  const id = Number((await params).id);
  const order = Number.isInteger(id) ? getOrder(id) : null;
  if (!order) notFound();

  const isOwner = user.role === "owner";
  const open = order.status === "pending" || order.status === "ready";
  const names = usersById();
  const settings = getSettings();
  const pickup = `${dateLabel(order.pickupDate, locale)}${order.pickupTime ? ` · ${order.pickupTime}` : ""}`;
  const deliveredMessage =
    order.due > 0 ? `${to.confirmDelivered}\n${to.dueOnDelivery.replace("{due}", money(order.due))}` : to.confirmDelivered;

  return (
    <>
      <PageHeader
        title={order.customerName}
        back={{ href: "/orders", label: to.title }}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <OrderStatusChip status={order.status} t={to} />
            <span>{to.occasions[order.occasion]}</span>
            <span>· N° {order.id}</span>
            <span>· {to.takenBy} {names.get(order.createdBy)}</span>
          </span>
        }
      >
        <PrintButton label={to.print}>
          <OrderSlip
            header={settings.receiptHeader}
            footer={settings.receiptFooter}
            data={{
              ref: String(order.id),
              customerName: order.customerName,
              customerPhone: order.customerPhone,
              // The slip is always printed in French, like receipts.
              occasion: fr.orders.occasions[order.occasion],
              pickup: `${new Date(`${order.pickupDate}T00:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}${order.pickupTime ? ` à ${order.pickupTime}` : ""}`,
              deliveryAddress: order.deliveryAddress,
              note: order.note,
              lines: order.lines,
              total: order.total,
              paid: order.paid,
            }}
          />
        </PrintButton>
        {open && <Link href={`/orders/${id}/edit`} className="btn-ghost">{t.common.edit}</Link>}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="card divide-y divide-line">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-muted">{to.pickupDate}</span>
              <span className="font-semibold text-cocoa">{pickup}</span>
            </div>
            {order.customerPhone && (
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-muted">{to.phone}</span>
                <a href={`tel:${order.customerPhone.replace(/\s/g, "")}`} dir="ltr" className="tabular font-medium underline underline-offset-4">
                  {order.customerPhone}
                </a>
              </div>
            )}
            {order.deliveryAddress && (
              <div className="flex items-start justify-between gap-3 px-4 py-3">
                <span className="shrink-0 text-sm text-muted">{to.deliveryAddress}</span>
                <span className="text-end font-medium">{order.deliveryAddress}</span>
              </div>
            )}
          </div>

          <section>
            <SectionTitle>{to.items}</SectionTitle>
            <ul className="card divide-y divide-line">
              {order.lines.map((l) => (
                <li key={l.id} className="tabular flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 font-medium">{l.label}</span>
                  <span className="text-muted" dir="ltr">{qty(l.qty)} × {money(l.unitPrice)}</span>
                  <span className="w-24 text-end font-semibold">{money(l.total)}</span>
                </li>
              ))}
              <li className="tabular flex justify-between bg-gold-soft/50 px-4 py-3">
                <span className="font-semibold text-cocoa">{to.total}</span>
                <span className="text-lg font-semibold text-cocoa">{money(order.total)} {t.common.dh}</span>
              </li>
            </ul>
          </section>

          {order.note && (
            <p className="whitespace-pre-wrap rounded-xl bg-gold-soft px-4 py-3 text-sm text-cocoa">
              <span className="font-semibold">{to.note} : </span>
              {order.note}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {order.status === "pending" && (
              <form action={setOrderStatus.bind(null, id, "ready")}>
                <button className="btn-ghost">✓ {to.markReady}</button>
              </form>
            )}
            {open && (
              <form action={setOrderStatus.bind(null, id, "delivered")}>
                <ConfirmButton message={deliveredMessage} className="btn-primary">{to.markDelivered}</ConfirmButton>
              </form>
            )}
            {isOwner && open && (
              <form action={setOrderStatus.bind(null, id, "cancelled")}>
                <ConfirmButton message={to.confirmCancel} className="btn-ghost text-bad">{to.cancel}</ConfirmButton>
              </form>
            )}
            {isOwner && !open && (
              <form action={setOrderStatus.bind(null, id, "pending")}>
                <button className="btn-ghost">{to.reopen}</button>
              </form>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-4">
            <div className="tabular space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">{to.total}</span>
                <span>{money(order.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">{to.paid}</span>
                <span>{money(order.paid)}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5 text-base font-semibold">
                <span>{to.due}</span>
                {order.due > 0 ? (
                  <span className="text-warn">{money(order.due)} {t.common.dh}</span>
                ) : (
                  <span className="text-ok">{to.paidInFull}</span>
                )}
              </div>
            </div>

            {order.payments.length > 0 && (
              <>
                <h2 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wider text-muted">{to.payments}</h2>
                <ul className="divide-y divide-line text-sm">
                  {order.payments.map((p) => (
                    <li key={p.id} className="tabular flex items-center gap-2 py-2">
                      <span className="flex-1">
                        {dateLabel(p.date, locale)}
                        <span className="block text-xs text-muted">
                          {to.methods[p.method]} · {names.get(p.createdBy)}
                        </span>
                      </span>
                      <span className="font-semibold">{money(p.amount)}</span>
                      {isOwner && (
                        <form action={deletePayment.bind(null, id)}>
                          <input type="hidden" name="paymentId" value={p.id} />
                          <ConfirmButton message={to.confirmDeletePayment} className="text-xs text-bad hover:underline">
                            {to.deletePayment}
                          </ConfirmButton>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {order.status !== "cancelled" && order.due > 0 && (
            <form action={addPayment.bind(null, id)} className="card space-y-3 p-4">
              <h2 className="font-semibold text-cocoa">{to.addPayment}</h2>
              <p className="text-xs text-muted">{to.paymentHint}</p>
              <div className="grid grid-cols-2 gap-3">
                <input
                  name="amount"
                  inputMode="decimal"
                  dir="ltr"
                  defaultValue={(order.due / 100).toFixed(2)}
                  aria-label={to.amount}
                  className="field tabular"
                  required
                />
                <select name="method" defaultValue="cash" className="field" aria-label={to.method}>
                  {ORDER_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{to.methods[m]}</option>
                  ))}
                </select>
              </div>
              {isOwner && <input name="date" type="date" defaultValue={today()} className="field" aria-label={to.date} />}
              <button className="btn-primary w-full">{to.addPayment}</button>
            </form>
          )}

          {isOwner && (
            <form action={deleteOrder.bind(null, id)}>
              <ConfirmButton message={to.confirmDelete} className="text-sm text-bad hover:underline">
                {to.delete}
              </ConfirmButton>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
