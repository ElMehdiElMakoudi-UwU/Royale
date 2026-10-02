import { addCategory, addExpense, classifyOutflow, deleteExpense } from "./actions";
import { ConfirmButton } from "@/components/confirm-button";
import { MonthNav, PageHeader, SectionTitle } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { dateLabel, label, money, monthLabel, today } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { isMonth, monthExpenses, monthOf, nextMonth, prevMonth } from "@/lib/money";

export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  await requireOwner();
  const { t, locale } = await getDict();
  const te = t.expenses;
  const sp = (await searchParams).month;
  const month = isMonth(sp) ? sp : monthOf(today());
  const data = monthExpenses(month);
  const catName = new Map(data.categories.map((c) => [c.id, label(c, locale)]));
  const notExpense = new Set(data.categories.filter((c) => !c.isExpense).map((c) => c.id));
  const defaultDate = monthOf(today()) === month ? today() : `${month}-01`;

  const rows = [
    ...data.expenses.map((e) => ({ key: `e${e.id}`, id: e.id, date: e.date, categoryId: e.categoryId, label: e.label, amount: e.amount, till: false })),
    ...data.outflows
      .filter((o) => o.categoryId != null)
      .map((o) => ({ key: `o${o.id}`, id: o.id, date: o.date, categoryId: o.categoryId!, label: o.label, amount: o.amount, till: true })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const categoryOptions = data.categories.map((c) => (
    <option key={c.id} value={c.id}>{label(c, locale)}</option>
  ));

  return (
    <>
      <PageHeader title={te.title}>
        <MonthNav month={month} label={monthLabel(month, locale)} prev={prevMonth(month)} next={nextMonth(month)} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <div className="card p-5">
            <div className="text-sm text-muted">{te.total}</div>
            <div className="tabular mt-1 text-3xl font-semibold text-cocoa">
              {money(data.total)} <span className="text-base font-normal text-muted">{t.common.dh}</span>
            </div>
            {data.byCategory.size > 0 && (
              <ul className="tabular mt-4 space-y-1.5 text-sm">
                {data.categories
                  .filter((c) => data.byCategory.has(c.id))
                  .map((c) => (
                    <li key={c.id} className={`flex justify-between ${c.isExpense ? "" : "text-muted"}`}>
                      <span>
                        {label(c, locale)}
                        {!c.isExpense && <span className="text-xs"> ({te.notExpense})</span>}
                      </span>
                      <span>{money(data.byCategory.get(c.id))}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          {data.unclassified > 0 && (
            <section className="card border-warn p-4">
              <h2 className="font-semibold text-warn">
                {te.tillOutflows} {te.toClassify} ({data.unclassified})
              </h2>
              <p className="mb-3 text-xs text-muted">{te.toClassifyHint}</p>
              <ul className="divide-y divide-line">
                {data.outflows
                  .filter((o) => o.categoryId == null)
                  .map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                      <span className="min-w-32 flex-1">
                        <span className="font-medium">{o.label}</span>
                        <span className="block text-xs text-muted">{dateLabel(o.date, locale)}</span>
                      </span>
                      <span className="tabular font-semibold">{money(o.amount)}</span>
                      <form action={classifyOutflow.bind(null, o.id)} className="flex gap-2">
                        <select name="categoryId" required defaultValue="" className="field h-10 w-48 py-1 text-sm" aria-label={te.category}>
                          <option value="" disabled>{te.classify}</option>
                          {categoryOptions}
                        </select>
                        <button className="btn-primary h-10 px-3">✓</button>
                      </form>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          <section>
            <SectionTitle>{te.list}</SectionTitle>
            {rows.length === 0 ? (
              <p className="card p-6 text-center text-sm text-muted">{t.home.nothing}</p>
            ) : (
              <ul className="card divide-y divide-line">
                {rows.map((r) => (
                  <li key={r.key} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${notExpense.has(r.categoryId) ? "opacity-60" : ""}`}>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{r.label}</span>
                      <span className="block text-xs text-muted">
                        {dateLabel(r.date, locale)} · {catName.get(r.categoryId)}
                        {r.till && ` · ${te.fromTill}`}
                      </span>
                    </span>
                    <span className="tabular font-semibold">{money(r.amount)}</span>
                    {r.till ? (
                      <form action={classifyOutflow.bind(null, r.id)}>
                        <input type="hidden" name="categoryId" value="" />
                        <button className="text-xs text-muted hover:underline" title={te.classify}>↺</button>
                      </form>
                    ) : (
                      <form action={deleteExpense.bind(null, r.id)}>
                        <ConfirmButton message={te.confirmDelete} className="text-xs text-bad hover:underline">
                          {te.delete}
                        </ConfirmButton>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <form action={addExpense} className="card space-y-3 p-4">
            <h2 className="font-semibold text-cocoa">{te.add}</h2>
            <p className="text-xs text-muted">{te.addHint}</p>
            <input name="label" placeholder={te.label} className="field" required maxLength={200} />
            <select name="categoryId" required defaultValue="" className="field" aria-label={te.category}>
              <option value="" disabled>{te.category}</option>
              {categoryOptions}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input name="date" type="date" defaultValue={defaultDate} className="field" aria-label={te.date} required />
              <input name="amount" inputMode="decimal" dir="ltr" placeholder={`${te.amount} (${t.common.dh})`} className="field tabular" required />
            </div>
            <button className="btn-primary w-full">{te.add}</button>
          </form>

          <form action={addCategory} className="card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-cocoa">{te.newCategory}</h2>
            <input name="nameFr" placeholder={t.products.nameFr} className="field" required maxLength={100} />
            <input name="nameAr" dir="rtl" placeholder={t.products.nameAr} className="field" maxLength={100} />
            <button className="btn-ghost w-full">{te.addCategory}</button>
          </form>
        </div>
      </div>
    </>
  );
}
