import "server-only";
import { label } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { groupProducts, listCategories, listProducts } from "@/lib/queries";
import type { FormGroup } from "./count-form";

/** Active products grouped by category, shaped for the count form (no prices sent to the client). */
export function formGroups(locale: Locale, noCategory: string): FormGroup[] {
  return groupProducts(listProducts(), listCategories()).map((g) => ({
    key: String(g.category?.id ?? "none"),
    label: g.category ? label(g.category, locale) : noCategory,
    products: g.products.map((p) => ({
      id: p.id,
      label: label(p, locale),
      // Show the other language underneath, so FR and AR speakers both recognise the product.
      alt: locale === "ar" ? p.nameFr : p.nameAr,
      unit: p.unit,
    })),
  }));
}
