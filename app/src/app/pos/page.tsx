import { and, eq, sum } from "drizzle-orm";
import type { Metadata } from "next";
import { Register, type PosProduct } from "./register";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { label, today } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { groupProducts, listCategories, listProducts } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Royale — Vente" };

export default async function PosPage() {
  const user = await requireUser();
  const { t, locale } = await getDict();
  const groups = groupProducts(listProducts(), listCategories());

  const products: PosProduct[] = groups.flatMap((g) =>
    g.products.map((p) => ({
      id: p.id,
      label: label(p, locale),
      alt: locale === "ar" ? p.nameFr : p.nameAr,
      unit: p.unit,
      price: p.salePrice,
      category: String(g.category?.id ?? "none"),
    })),
  );
  const categories = groups.map((g) => ({
    key: String(g.category?.id ?? "none"),
    label: g.category ? label(g.category, locale) : t.products.noCategory,
  }));

  const todayTotal =
    Number(
      db
        .select({ total: sum(schema.posSales.total) })
        .from(schema.posSales)
        .where(and(eq(schema.posSales.date, today()), eq(schema.posSales.status, "completed")))
        .get()?.total ?? 0,
    ) || 0;

  const settings = getSettings();
  return (
    <Register
      t={{ ...t.pos, units: t.units }}
      products={products}
      categories={categories}
      cashier={user.name}
      todayTotal={todayTotal}
      receipt={{ header: settings.receiptHeader, footer: settings.receiptFooter, autoPrint: settings.autoPrint }}
    />
  );
}
