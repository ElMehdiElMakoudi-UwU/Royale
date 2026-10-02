import { ProductForm } from "../product-form";
import { PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { label } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { listCategories } from "@/lib/queries";

export default async function NewProductPage() {
  await requireOwner();
  const { t, locale } = await getDict();
  return (
    <>
      <PageHeader title={t.products.new} back={{ href: "/products", label: t.products.title }} />
      <ProductForm
        t={{ products: t.products, common: t.common, units: t.units, errors: t.errors }}
        categories={listCategories().map((c) => ({ id: c.id, label: label(c, locale) }))}
      />
    </>
  );
}
