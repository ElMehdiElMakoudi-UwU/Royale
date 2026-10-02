import Link from "next/link";
import { MonthNav, PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { label, money, monthLabel, today } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { isMonth, monthOf, monthResult, nextMonth, prevMonth } from "@/lib/money";

function Line({ title, hint, value, sign, href }: { title: string; hint?: string; value: number; sign: "+" | "−"; href: string }) {
  return (
    <Link href={href} className="tabular flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-cream">
      <span>
        <span className="font-medium">{title}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className={`text-lg ${sign === "+" ? "text-ok" : "text-ink"}`}>
        {sign} {money(value)}
      </span>
    </Link>
  );
}

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  await requireOwner();
  const { t, locale } = await getDict();
  const tr = t.report;
  const sp = (await searchParams).month;
  const month = isMonth(sp) ? sp : monthOf(today());
  const r = monthResult(month);
  const expenseCats = r.expenses.categories.filter((c) => c.isExpense && r.expenses.byCategory.has(c.id));

  return (
    <>
      <PageHeader title={tr.title}>
        <MonthNav month={month} label={monthLabel(month, locale)} prev={prevMonth(month)} next={nextMonth(month)} />
      </PageHeader>

      <div className="max-w-2xl space-y-4">
        <div className="card divide-y divide-line overflow-hidden">
          <Line title={tr.sales} hint={`${r.closingDays} ${tr.days}`} value={r.sales} sign="+" href="/cash" />
          <Line title={tr.purchases} hint={`${r.notes} ${tr.notes}`} value={r.purchases} sign="−" href="/factory" />
          <Line title={tr.expenses} value={r.expenses.total} sign="−" href={`/expenses?month=${month}`} />
          {expenseCats.length > 0 && (
            <ul className="tabular space-y-1 bg-cream/60 px-5 py-2.5 text-sm text-muted">
              {expenseCats.map((c) => (
                <li key={c.id} className="flex justify-between ps-3">
                  <span>{label(c, locale)}</span>
                  <span>{money(r.expenses.byCategory.get(c.id))}</span>
                </li>
              ))}
            </ul>
          )}
          <Line title={tr.salaries} value={r.salaries.total} sign="−" href={`/salaries?month=${month}`} />
          <div className="tabular flex items-center justify-between bg-gold-soft/60 px-5 py-4">
            <span className="text-lg font-semibold text-cocoa">{tr.result}</span>
            <span className={`text-2xl font-semibold ${r.result < 0 ? "text-bad" : "text-ok"}`}>
              {money(r.result)} <span className="text-sm font-normal text-muted">{t.common.dh}</span>
            </span>
          </div>
        </div>

        {r.expenses.unclassified > 0 && (
          <Link href={`/expenses?month=${month}`} className="block rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
            ⚠ {r.expenses.unclassified} {tr.unclassified} ({money(r.expenses.unclassifiedTotal)} {t.common.dh})
          </Link>
        )}
        <p className="text-xs text-muted">{tr.hint}</p>
      </div>
    </>
  );
}
