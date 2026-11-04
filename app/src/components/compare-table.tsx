import { money } from "@/lib/format";

export type CompareRow = {
  title: string;
  /** One value per shop, then the total. */
  values: string[];
  /** Raw amounts when a negative one should show in red. */
  amounts?: number[];
  strong?: boolean;
};

export const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);

export const percent = (rate: number | null) =>
  rate == null ? "—" : `${(rate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;

export function moneyRow(title: string, perShop: number[], strong = false): CompareRow {
  const amounts = [...perShop, sum(perShop)];
  return { title, values: amounts.map((a) => money(a)), amounts, strong };
}

/** A figure per row, a column per shop, and the total last. */
export function CompareTable({ shops, totalLabel, rows }: { shops: string[]; totalLabel: string; rows: CompareRow[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="tabular w-full min-w-[520px] text-sm">
        <thead className="text-xs text-muted">
          <tr className="border-b border-line">
            <th className="px-4 py-2.5 text-start font-medium" />
            {shops.map((s) => (
              <th key={s} className="px-3 py-2.5 text-end font-semibold text-cocoa">{s}</th>
            ))}
            <th className="px-4 py-2.5 text-end font-semibold text-cocoa">{totalLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.title} className={r.strong ? "bg-gold-soft/50 font-semibold" : ""}>
              <td className={`px-4 py-2.5 ${r.strong ? "text-cocoa" : ""}`}>{r.title}</td>
              {r.values.map((v, i) => {
                const negative = (r.amounts?.[i] ?? 0) < 0;
                const isTotal = i === r.values.length - 1;
                return (
                  <td
                    key={i}
                    className={`whitespace-nowrap py-2.5 text-end ${isTotal ? "px-4 font-semibold" : "px-3"} ${negative ? "text-bad" : ""}`}
                  >
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
