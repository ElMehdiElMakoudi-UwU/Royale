import { addEmployee, addSalaryPayment, deleteSalaryPayment, setEmployeeActive, updateSalary } from "./actions";
import { ConfirmButton } from "@/components/confirm-button";
import { MonthNav, PageHeader } from "@/components/ui";
import { SALARY_KINDS } from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { dateLabel, money, monthLabel, today } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { isMonth, monthOf, monthSalaries, nextMonth, prevMonth } from "@/lib/money";

export default async function SalariesPage({ searchParams }: PageProps<"/salaries">) {
  await requireOwner();
  const { t, locale } = await getDict();
  const ts = t.salaries;
  const sp = (await searchParams).month;
  const month = isMonth(sp) ? sp : monthOf(today());
  const { rows, total } = monthSalaries(month);
  const active = rows.filter((r) => r.employee.active);

  return (
    <>
      <PageHeader title={ts.title}>
        <MonthNav month={month} label={monthLabel(month, locale)} prev={prevMonth(month)} next={nextMonth(month)} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="card p-5">
            <div className="text-sm text-muted">{ts.total}</div>
            <div className="tabular mt-1 text-3xl font-semibold text-cocoa">
              {money(total)} <span className="text-base font-normal text-muted">{t.common.dh}</span>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="card p-8 text-center text-muted">{ts.none}</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.employee.id} className={`card overflow-hidden ${r.employee.active ? "" : "opacity-60"}`}>
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-cream [&::-webkit-details-marker]:hidden">
                      <div className="min-w-32 flex-1">
                        <div className="font-medium">{r.employee.name}</div>
                        <div className="tabular text-xs text-muted">
                          {ts.salary} {money(r.employee.monthlySalary)}
                        </div>
                      </div>
                      <div className="tabular grid grid-cols-3 gap-4 text-end text-sm">
                        <div>
                          <div className="text-xs text-muted">{ts.advances}</div>
                          {money(r.advances)}
                        </div>
                        <div>
                          <div className="text-xs text-muted">{ts.paid}</div>
                          {money(r.salaryPaid)}
                        </div>
                        <div>
                          <div className="text-xs text-muted">{ts.remaining}</div>
                          <span className={`font-semibold ${r.remaining > 0 ? "text-warn" : r.remaining < 0 ? "text-bad" : "text-ok"}`}>
                            {money(r.remaining)}
                          </span>
                        </div>
                      </div>
                    </summary>
                    <div className="space-y-4 border-t border-line px-4 py-3">
                      {r.payments.length > 0 && (
                        <ul className="divide-y divide-line text-sm">
                          {r.payments.map((p) => (
                            <li key={p.id} className="tabular flex items-center gap-3 py-2">
                              <span className="flex-1">
                                {dateLabel(p.date, locale)} · {ts.kinds[p.kind]}
                                {p.note && <span className="text-muted"> · {p.note}</span>}
                              </span>
                              <span className="font-semibold">{money(p.amount)}</span>
                              <form action={deleteSalaryPayment.bind(null, p.id)}>
                                <ConfirmButton message={ts.confirmDelete} className="text-xs text-bad hover:underline">
                                  {ts.delete}
                                </ConfirmButton>
                              </form>
                            </li>
                          ))}
                        </ul>
                      )}
                      {r.bonus > 0 && (
                        <p className="tabular text-sm text-muted">
                          {ts.bonus} : {money(r.bonus)}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3">
                        <form action={updateSalary.bind(null, r.employee.id)} className="flex gap-2">
                          <input
                            name="monthlySalary"
                            inputMode="decimal"
                            dir="ltr"
                            defaultValue={(r.employee.monthlySalary / 100).toFixed(2)}
                            aria-label={ts.monthlySalary}
                            className="field tabular h-10 w-32 py-1"
                          />
                          <button className="btn-ghost h-10 px-3">{ts.edit}</button>
                        </form>
                        <form action={setEmployeeActive.bind(null, r.employee.id, !r.employee.active)}>
                          <button className={`text-sm ${r.employee.active ? "text-bad" : "text-ok"} hover:underline`}>
                            {r.employee.active ? ts.deactivate : ts.activate}
                          </button>
                        </form>
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          {active.length > 0 && (
            <form action={addSalaryPayment} className="card space-y-3 p-4">
              <h2 className="font-semibold text-cocoa">{ts.pay}</h2>
              <select name="employeeId" required defaultValue="" className="field" aria-label={ts.name}>
                <option value="" disabled>{ts.name}</option>
                {active.map((r) => (
                  <option key={r.employee.id} value={r.employee.id}>{r.employee.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <select name="kind" defaultValue="advance" className="field" aria-label={ts.kind}>
                  {SALARY_KINDS.map((k) => (
                    <option key={k} value={k}>{ts.kinds[k]}</option>
                  ))}
                </select>
                <input name="amount" inputMode="decimal" dir="ltr" placeholder={`${ts.amount} (${t.common.dh})`} className="field tabular" required />
                <label className="text-xs text-muted">
                  {ts.date}
                  <input name="date" type="date" defaultValue={today()} className="field mt-1" required />
                </label>
                <label className="text-xs text-muted">
                  {ts.forMonth}
                  <input name="month" type="month" defaultValue={month} className="field mt-1" required />
                </label>
              </div>
              <input name="note" placeholder={ts.note} className="field" maxLength={500} />
              <button className="btn-primary w-full">{ts.pay}</button>
            </form>
          )}

          <form action={addEmployee} className="card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-cocoa">{ts.addEmployee}</h2>
            <input name="name" placeholder={ts.name} className="field" required maxLength={100} />
            <input
              name="monthlySalary"
              inputMode="decimal"
              dir="ltr"
              placeholder={`${ts.monthlySalary} (${t.common.dh})`}
              className="field tabular"
              required
            />
            <button className="btn-ghost w-full">{ts.addEmployee}</button>
          </form>
        </div>
      </div>
    </>
  );
}
