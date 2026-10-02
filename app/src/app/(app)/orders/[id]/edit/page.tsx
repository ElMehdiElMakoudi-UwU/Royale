import { notFound, redirect } from "next/navigation";
import { OrderForm } from "../../order-form";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getOrder, orderProductOptions } from "@/lib/orders";

export default async function EditOrderPage({ params }: PageProps<"/orders/[id]/edit">) {
  await requireUser();
  const { t, locale } = await getDict();
  const id = Number((await params).id);
  const order = Number.isInteger(id) ? getOrder(id) : null;
  if (!order) notFound();
  if (order.status === "delivered" || order.status === "cancelled") redirect(`/orders/${id}`);

  return (
    <>
      <PageHeader title={t.orders.edit} subtitle={order.customerName} back={{ href: `/orders/${id}`, label: t.common.back }} />
      <OrderForm
        t={{ ...t.orders, common: t.common }}
        products={orderProductOptions(locale, t.products.noCategory)}
        editId={id}
        initial={{
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          occasion: order.occasion,
          pickupDate: order.pickupDate,
          pickupTime: order.pickupTime,
          deliveryAddress: order.deliveryAddress,
          note: order.note,
          lines: order.lines.map((l) => ({ productId: l.productId, label: l.label, qty: l.qty, unitPrice: l.unitPrice })),
        }}
      />
    </>
  );
}
