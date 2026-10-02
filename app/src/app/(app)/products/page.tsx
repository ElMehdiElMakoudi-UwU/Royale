import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { label, money } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { groupProducts, listCategories, listProducts } from "@/lib/queries";

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  await requireOwner();
  const { t, locale } = await getDict();
  const sp = await searchParams;
  const q = normalize(String(sp.q ?? "").trim());
  const showInactive = sp.inactive === "1";

  const all = listProducts({ includeInactive: showInactive });
  const products = q
    ? all.filter((p) => [p.nameFr, p.nameAr, ...p.aliases].some((s) => normalize(s).includes(q)))
    : all;
  const groups = groupProducts(products, listCategories());

  return (
    <>
      <PageHeader title={t.products.title} subtitle={`${all.length} ${t.products.count}`}>
        <Link href="/products/new" className="btn-primary">+ {t.products.new}</Link>
      </PageHeader>

      <form className="mb-5 flex flex-wrap items-center gap-3">
        <input name="q" type="search" defaultValue={sp.q ?? ""} placeholder={t.common.search} className="field max-w-sm" />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="inactive" value="1" defaultChecked={showInactive} className="size-4 accent-cocoa" />
          {t.products.showInactive}
        </label>
        <button className="btn-ghost">{t.common.search.replace("…", "")}</button>
      </form>

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.category?.id ?? "none"}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              {g.category ? label(g.category, locale) : t.products.noCategory}
            </h2>
            <div className="card overflow-x-auto">
              <table className="tabular w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-muted">
                    <th className="px-4 py-2 text-start font-medium">{t.products.nameFr}</th>
                    <th className="hidden px-3 py-2 text-start font-medium md:table-cell">{t.products.aliases}</th>
                    <th className="px-3 py-2 text-end font-medium">{t.products.purchasePrice}</th>
                    <th className="px-3 py-2 text-end font-medium">{t.products.salePrice}</th>
                    <th className="hidden px-4 py-2 text-end font-medium sm:table-cell">{t.products.margin}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {g.products.map((p) => {
                    const margin =
                      p.purchasePrice != null && p.salePrice ? (p.salePrice - p.purchasePrice) / p.salePrice : null;
                    return (
                      <tr key={p.id} className={`hover:bg-cream ${p.active ? "" : "opacity-50"}`}>
                        <td className="px-4 py-2.5">
                          <Link href={`/products/${p.id}`} className="block">
                            <div className="font-medium">{label(p, locale)}</div>
                            <div className="text-xs text-muted">
                              {t.units[p.unit]}
                              {locale === "fr" && p.nameAr && <span dir="rtl"> · {p.nameAr}</span>}
                              {locale === "ar" && <span dir="ltr"> · {p.nameFr}</span>}
                            </div>
                          </Link>
                        </td>
                        <td className="hidden px-3 py-2.5 text-xs text-muted md:table-cell" dir="ltr">
                          {p.aliases.join(", ")}
                        </td>
                        <td className="px-3 py-2.5 text-end">
                          {p.purchasePrice == null ? (
                            <span className="chip bg-warn-soft text-warn">{t.products.missingPrice}</span>
                          ) : (
                            money(p.purchasePrice)
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-end">{money(p.salePrice)}</td>
                        <td className="hidden px-4 py-2.5 text-end text-muted sm:table-cell">
                          {margin == null ? "—" : `${Math.round(margin * 100)} %`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
