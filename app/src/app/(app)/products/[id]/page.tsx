import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ProductForm } from "../product-form";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { label } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { listCategories } from "@/lib/queries";

export default async function EditProductPage({ params }: PageProps<"/products/[id]">) {
  await requireOwner();
  const { t, locale } = await getDict();
  const id = Number((await params).id);
  const product = Number.isInteger(id)
    ? db.select().from(schema.products).where(eq(schema.products.id, id)).get()
    : undefined;
  if (!product) notFound();

  return (
    <>
      <PageHeader title={label(product, locale)} back={{ href: "/products", label: t.products.title }} />
      <ProductForm
        t={{ products: t.products, common: t.common, units: t.units, errors: t.errors }}
        product={product}
        categories={listCategories().map((c) => ({ id: c.id, label: label(c, locale) }))}
      />
    </>
  );
}
