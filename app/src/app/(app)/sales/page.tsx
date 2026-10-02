import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { dateLabel, label, money, qty } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { salesPeriods } from "@/lib/sales";

export default async function SalesPage() {
  await requireOwner();
  const { t, locale } = await getDict();
  const ts = t.sales;
  const tp = t.posCompare;
  const periods = salesPeriods();

  const totals = periods.reduce(
    (s, p) => ({ expected: s.expected + p.expected, declared: s.declared + p.declared, gap: s.gap + p.gap }),
    { expected: 0, declared: 0, gap: 0 },
  );
  const signed = (n: number) => `${n > 0 ? "+" : ""}${money(n)}`;

  return (
    <>
      <PageHeader title={ts.title} subtitle={ts.intro} />

      {periods.length === 0 ? (
        <p className="card p-8 text-center text-muted">{ts.none}</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card p-4">
              <div className="text-xs text-muted">{ts.expected}</div>
              <div className="tabular mt-1 text-2xl font-semibold text-cocoa">{money(totals.expected)}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-muted">{ts.declared}</div>
              <div className="tabular mt-1 text-2xl font-semibold text-cocoa">{money(totals.declared)}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-muted">{ts.gap} · {ts.gapHint}</div>
              <div className={`tabular mt-1 text-2xl font-semibold ${totals.gap < 0 ? "text-bad" : "text-ok"}`}>
                {signed(totals.gap)}
              </div>
            </div>
          </div>

          <ul className="space-y-3">
            {periods.map((p) => {
              const lastDay = p.days[p.days.length - 1];
              const warnings = [
                p.missingClosingDays.length > 0 && `${p.missingClosingDays.length} ${ts.missingClosings}`,
                p.missingPrices > 0 && `${p.missingPrices} ${ts.missingPrices}`,
                p.uncounted > 0 && `${p.uncounted} ${ts.uncounted}`,
                p.pendingDeliveries > 0 && `${p.pendingDeliveries} ${ts.pendingDeliveries}`,
                p.sold.some((s) => s.qty < 0) && ts.negative,
              ].filter(Boolean) as string[];
              return (
                <li key={p.toCountId} className="card overflow-hidden">
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-cream [&::-webkit-details-marker]:hidden">
                      <div className="min-w-40 flex-1">
                        <div className="font-medium">
                          {p.days.length === 1
                            ? dateLabel(p.from, locale)
                            : `${dateLabel(p.from, locale)} → ${dateLabel(lastDay, locale)}`}
                        </div>
                        <div className="text-xs text-muted">
                          {p.days.length} {p.days.length === 1 ? ts.day : ts.days}
                          {warnings.length > 0 && <span className="text-warn"> · ⚠ {warnings.length}</span>}
                        </div>
                      </div>
                      <div className="tabular grid grid-cols-3 gap-4 text-end text-sm">
                        <div>
                          <div className="text-xs text-muted">{ts.expected}</div>
                          {money(p.expected)}
                        </div>
                        <div>
                          <div className="text-xs text-muted">{ts.declared}</div>
                          {money(p.declared)}
                        </div>
                        <div>
                          <div className="text-xs text-muted">{ts.gap}</div>
                          <span className={`font-semibold ${p.gap < 0 ? "text-bad" : "text-ok"}`}>{signed(p.gap)}</span>
                        </div>
                      </div>
                    </summary>

                    <div className="border-t border-line px-4 py-3">
                      {p.recorded != null && (
                        <div className="tabular mb-3 grid grid-cols-2 gap-3 rounded-lg bg-cream p-3 text-sm">
                          <div>
                            <div className="text-xs text-muted">{tp.recorded}</div>
                            <span className="font-semibold">{money(p.recorded)}</span>
                          </div>
                          <div>
                            <div className="text-xs text-muted">{tp.stockLoss} · {tp.stockLossHint}</div>
                            <span className={`font-semibold ${p.expected - p.recorded > 0 ? "text-bad" : "text-ok"}`}>
                              {money(p.expected - p.recorded)}
                            </span>
                          </div>
                        </div>
                      )}
                      {warnings.length > 0 && (
                        <ul className="mb-3 space-y-1 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
                          {warnings.map((w) => (
                            <li key={w}>⚠ {w}</li>
                          ))}
                        </ul>
                      )}
                      <div className="mb-2 flex gap-3 text-xs">
                        <Link href={`/counts/${p.fromCountId}`} className="text-cocoa underline underline-offset-4">
                          {ts.openCount} {dateLabel(p.from, locale)}
                        </Link>
                        <Link href={`/counts/${p.toCountId}`} className="text-cocoa underline underline-offset-4">
                          {ts.openCount} {dateLabel(p.to, locale)}
                        </Link>
                      </div>
                      <table className="tabular w-full text-sm">
                        <thead>
                          <tr className="text-xs text-muted">
                            <th className="py-1.5 text-start font-medium">{ts.product}</th>
                            <th className="py-1.5 text-end font-medium">{ts.qty}</th>
                            {p.recorded != null && <th className="py-1.5 text-end font-medium">{tp.rung}</th>}
                            <th className="py-1.5 text-end font-medium">{ts.value}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {p.sold.map((s) => (
                            <tr key={s.product.id}>
                              <td className="py-1.5">{label(s.product, locale)}</td>
                              <td className={`py-1.5 text-end ${s.qty < 0 ? "font-semibold text-bad" : ""}`}>{qty(s.qty)}</td>
                              {s.rung != null && (
                                <td className={`py-1.5 text-end ${s.rung < s.qty ? "font-semibold text-bad" : "text-muted"}`}>{qty(s.rung)}</td>
                              )}
                              <td className="py-1.5 text-end">
                                {s.value == null ? <span className="text-warn">—</span> : money(s.value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
