import { notFound, redirect } from "next/navigation";
import { DeliveryEditor, type ProductOption } from "../../delivery-editor";
import { PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { aiEnabled } from "@/lib/extract";
import { label } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { getDelivery, groupProducts, listCategories, listProducts } from "@/lib/queries";

export default async function EditDeliveryPage({ params }: PageProps<"/deliveries/[id]/edit">) {
  await requireOwner();
  const { t, locale } = await getDict();
  const id = Number((await params).id);
  const delivery = Number.isInteger(id) ? getDelivery(id) : null;
  if (!delivery) notFound();
  if (delivery.status !== "draft") redirect(`/deliveries/${id}`);

  const products: ProductOption[] = groupProducts(listProducts(), listCategories()).flatMap((g) =>
    g.products.map((p) => ({
      id: p.id,
      label: label(p, locale),
      group: g.category ? label(g.category, locale) : t.products.noCategory,
      price: p.purchasePrice,
    })),
  );

  return (
    <>
      <PageHeader
        title={delivery.blNumber || t.deliveries.new}
        back={{ href: `/deliveries/${id}`, label: t.common.back }}
      />
      {delivery.photos.length > 0 && (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {delivery.photos.map((p) => (
            <a key={p.id} href={`/photos/deliveries/${p.id}`} target="_blank" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked images */}
              <img src={`/photos/deliveries/${p.id}`} alt="" className="h-28 rounded-lg border border-line object-cover" />
            </a>
          ))}
        </div>
      )}
      <DeliveryEditor
        t={{ ...t.deliveries, common: t.common }}
        id={id}
        initial={{
          blNumber: delivery.blNumber,
          date: delivery.date,
          declaredTotal: delivery.declaredTotal,
          note: delivery.note,
          lines: delivery.lines.map((l) => ({
            designation: l.designation,
            productId: l.productId,
            qty: l.qty,
            unitPrice: l.unitPrice,
            amount: l.amount,
          })),
        }}
        products={products}
        aiEnabled={aiEnabled()}
      />
    </>
  );
}
