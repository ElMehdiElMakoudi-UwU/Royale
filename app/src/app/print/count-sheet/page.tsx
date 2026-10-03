import Link from "next/link";
import { requireUser } from "@/lib/auth";
import ar from "@/lib/i18n/ar";
import fr from "@/lib/i18n/fr";
import { groupProducts, listCategories, listProducts } from "@/lib/queries";
import { PrintButton } from "./print-button";

export const metadata = { title: "Feuille de comptage" };

// Blank rows at the end for products missing from the catalog.
const EXTRA_ROWS = 4;

/** Both languages side by side, so every staff member can read the printed sheet. */
const both = (a: string, b: string) => (
  <>
    {a} <span dir="rtl" lang="ar">{b}</span>
  </>
);

/** A4 sheet listing every active product, filled by hand (stock + arrived) and typed in later. */
export default async function CountSheetPage() {
  const user = await requireUser();
  const groups = groupProducts(listProducts(), listCategories());
  // Row numbers run across categories so a line is easy to point at.
  let row = 0;

  return (
    <div className="count-sheet mx-auto max-w-[210mm] bg-paper p-6 print:p-0" dir="ltr">
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link href={user.role === "owner" ? "/counts" : "/"} className="btn-ghost">
          ← {fr.common.back}
        </Link>
        <PrintButton label={`${fr.counts.sheetPrint} · ${ar.counts.sheetPrint}`} />
      </div>

      <header className="mb-3">
        <h1 className="flex items-baseline justify-between text-xl font-bold">
          <span>{fr.counts.sheetTitle}</span>
          <span dir="rtl" lang="ar">{ar.counts.sheetTitle}</span>
        </h1>
        <div className="mt-3 flex gap-6 text-sm">
          <div className="flex flex-1 items-end gap-2">
            {both(fr.common.date, ar.common.date)} :
            <span className="flex-1 border-b border-dotted border-black" />
          </div>
          <div className="flex flex-1 items-end gap-2">
            {both(fr.counts.sheetName, ar.counts.sheetName)} :
            <span className="flex-1 border-b border-dotted border-black" />
          </div>
        </div>
        <p className="mt-2 text-xs">{fr.counts.sheetHint}</p>
        <p className="text-xs" dir="rtl" lang="ar">{ar.counts.sheetHint}</p>
      </header>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="[&>th]:border [&>th]:border-black [&>th]:bg-gray-100 [&>th]:px-2 [&>th]:py-1">
            <th className="w-[7%]">#</th>
            <th className="text-start">{both(fr.counts.sheetProduct, ar.counts.sheetProduct)}</th>
            <th className="w-[13%]">{both(fr.counts.sheetUnit, ar.counts.sheetUnit)}</th>
            <th className="w-[16%]">{both(fr.counts.stock, ar.counts.stock)}</th>
            <th className="w-[16%]">{both(fr.counts.sheetArrived, ar.counts.sheetArrived)}</th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.category?.id ?? "none"}>
            <tr className="sheet-row">
              <td colSpan={5} className="border border-black bg-gray-50 px-2 py-1 text-xs font-bold uppercase tracking-wide">
                {g.category
                  ? both(g.category.nameFr, g.category.nameAr)
                  : both(fr.products.noCategory, ar.products.noCategory)}
              </td>
            </tr>
            {g.products.map((p) => (
              <tr key={p.id} className="sheet-row [&>td]:h-[9mm] [&>td]:border [&>td]:border-black [&>td]:px-2">
                <td className="tabular text-center text-xs">{++row}</td>
                <td>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{p.nameFr}</span>
                    {p.nameAr && <span dir="rtl" lang="ar">{p.nameAr}</span>}
                  </div>
                </td>
                <td className="text-center text-xs">{fr.units[p.unit]} / {ar.units[p.unit]}</td>
                <td />
                <td />
              </tr>
            ))}
          </tbody>
        ))}
        <tbody>
          {Array.from({ length: EXTRA_ROWS }, (_, i) => (
            <tr key={i} className="sheet-row [&>td]:h-[9mm] [&>td]:border [&>td]:border-black">
              <td /><td /><td /><td /><td />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
