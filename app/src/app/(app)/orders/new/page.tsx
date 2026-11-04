import { OrderForm } from "../order-form";
import { PageHeader } from "@/components/ui";
import { today } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { orderProductOptions } from "@/lib/orders";
import { requireShop } from "@/lib/shop";

export default async function NewOrderPage() {
  await requireShop();
  const { t, locale } = await getDict();
  return (
    <>
      <PageHeader title={t.orders.new} back={{ href: "/orders", label: t.orders.title }} />
      <OrderForm
        t={{ ...t.orders, common: t.common }}
        products={orderProductOptions(locale, t.products.noCategory)}
        initial={{
          customerName: "",
          customerPhone: "",
          occasion: "birthday",
          pickupDate: today(),
          pickupTime: null,
          deliveryAddress: "",
          note: "",
          lines: [],
        }}
      />
    </>
  );
}
