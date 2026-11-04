import { addPeriodStart, removePeriodStart, saveResultSettings } from "./actions";
import { ResultsGrid } from "./results-grid";
import { MonthNav, PageHeader, SectionTitle } from "@/components/ui";
import { dateLabel, money, monthLabel, today } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { isMonth, monthOf, nextMonth, prevMonth } from "@/lib/money";
import { monthResultsData } from "@/lib/results";
import { monthDates, monthPeriods } from "@/lib/results-calc";
import { requireOwnerShop } from "@/lib/shop";

function Line({ title, hint, value, sign }: { title: string; hint?: string; value: number; sign: "+" | "−" }) {
  return (
    <div className="tabular flex items-center justify-between gap-4 px-5 py-3">
      <span>
        <span className="font-medium">{title}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className={`whitespace-nowrap text-lg ${sign === "+" ? "text-ok" : "text-ink"}`}>
        {sign} {money(value)}
      </span>
    </div>
  );
}

function Subtotal({ title, value }: { title: string; value: number }) {
  return (
    <div className="tabular flex items-center justify-between gap-4 bg-cream/70 px-5 py-3">
      <span className="font-semibold text-cocoa">{title}</span>
      <span className={`text-lg font-semibold ${value < 0 ? "text-bad" : "text-cocoa"}`}>{money(value)}</span>
    </div>
  );
}

function Stat({ title, hint, value }: { title: string; hint?: string; value: string }) {
  return (
    <div className="tabular flex items-baseline justify-between gap-4 px-4 py-3 text-sm">
      <span>
        {title}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className="text-base font-semibold text-cocoa">{value}</span>
    </div>
  );
}

const signedClass = (n: number) => (n < 0 ? "text-bad" : "");

export default async function ResultsPage({ searchParams }: PageProps<"/results">) {
  const { shop } = await requireOwnerShop();
  const { t, locale } = await getDict();
  const tr = t.results;
  const sp = (await searchParams).month;
  const month = isMonth(sp) ? sp : monthOf(today());
  const { days, periodStarts, charges, fixedTotal, markupPct, results: r } = monthResultsData(shop.id, month);
  const dates = monthDates(month);
  const periods = monthPeriods(month, periodStarts);
  const dayList = (list: string[]) => list.map((d) => dateLabel(d, locale)).join(", ");
  const warnings = [
    { text: tr.warnMissing, list: r.warnings.missingDays },
    { text: tr.warnNoCredit, list: r.warnings.noCreditDays },
    { text: tr.warnOwnerOver, list: r.warnings.ownerOverExpensesDays },
  ].filter((w) => w.list.length > 0);

  return (
    <>
      <PageHeader title={tr.title} subtitle={tr.subtitle}>
        <MonthNav month={month} label={monthLabel(month, locale)} prev={prevMonth(month)} next={nextMonth(month)} />
      </PageHeader>

      <div className="space-y-6">
        {warnings.length > 0 && (
          <ul className="space-y-1 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
            {warnings.map((w) => (
              <li key={w.text}>
                ⚠ {w.text} : <span className="capitalize">{dayList(w.list)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
          <div className="card divide-y divide-line overflow-hidden">
            <Line title={tr.sales} value={r.totals.sales} sign="+" />
            <Line title={tr.creditRoyale} value={r.totals.creditRoyale} sign="−" />
            <Subtotal title={tr.gross} value={r.totals.gross} />
            <Line title={tr.expenses} value={r.totals.expenses} sign="−" />
            <Subtotal title={tr.net} value={r.totals.net} />
            <Line title={tr.owner} hint={tr.ownerHint} value={r.totals.ownerExpenses} sign="+" />
            <div className="tabular flex items-center justify-between gap-4 bg-gold-soft/60 px-5 py-4">
              <span className="text-lg font-semibold text-cocoa">{tr.final}</span>
              <span className={`text-2xl font-semibold ${r.totals.final < 0 ? "text-bad" : "text-ok"}`}>
                {money(r.totals.final)} <span className="text-sm font-normal text-muted">{t.common.dh}</span>
              </span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card divide-y divide-line">
              <Stat title={tr.salesPerDay} hint={`${r.totals.salesDays} ${tr.salesDays}`} value={money(r.salesPerDay)} />
              <Stat title={`${tr.estimated} (+${markupPct} %)`} value={money(r.estimatedSales)} />
              <Stat title={tr.estimateGap} value={money(r.estimateGap)} />
              <Stat
                title={tr.actualMarkup}
                value={r.actualMarkup == null ? "—" : `${(r.actualMarkup * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`}
              />
            </div>
            <div className="card divide-y divide-line">
              <div className="px-4 pt-3 pb-2 font-semibold text-cocoa">
                {tr.fixedTitle}
                <p className="mt-0.5 text-xs font-normal text-muted">{tr.fixedHint}</p>
              </div>
              <Stat title={tr.fixedCharged} value={money(r.fixedCharged)} />
              <Stat title={tr.shopExpenses} value={money(r.shopExpenses)} />
              <Stat title={tr.fixedGap} hint={tr.fixedGapHint} value={money(r.fixedGap)} />
              <Stat title={tr.resultWithFixed} value={money(r.resultWithFixed)} />
            </div>
          </div>
        </div>

        <section>
          <SectionTitle>{tr.periods}</SectionTitle>
          <div className="card overflow-x-auto">
            <table className="tabular w-full min-w-[760px] text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5 text-start font-medium">{tr.period}</th>
                  <th className="px-2 py-2.5 text-end font-medium">{tr.days}</th>
                  <th className="px-2 py-2.5 text-end font-medium">{tr.creditRoyale}</th>
                  <th className="px-2 py-2.5 text-end font-medium">{tr.salesShort}</th>
                  <th className="px-2 py-2.5 text-end font-medium">{tr.expenses}</th>
                  <th className="px-2 py-2.5 text-end font-medium">{tr.ownerPart}</th>
                  <th className="px-2 py-2.5 text-end font-medium">{tr.final}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{tr.withFixedShort}</th>
                </tr>
              </thead>
              <tbody>
                {r.periods.map((p) => (
                  <tr key={p.from} className="border-b border-line/60">
                    <td className="whitespace-nowrap px-4 py-2.5 capitalize">
                      {dateLabel(p.from, locale)} → {dateLabel(p.to, locale)}
                    </td>
                    <td className="px-2 py-2.5 text-end">{p.totals.salesDays}</td>
                    <td className="px-2 py-2.5 text-end">{money(p.totals.creditRoyale)}</td>
                    <td className="px-2 py-2.5 text-end">{money(p.totals.sales)}</td>
                    <td className="px-2 py-2.5 text-end">{money(p.totals.expenses)}</td>
                    <td className="px-2 py-2.5 text-end">{money(p.totals.ownerExpenses)}</td>
                    <td className={`px-2 py-2.5 text-end font-semibold ${signedClass(p.totals.final)}`}>{money(p.totals.final)}</td>
                    <td className={`px-4 py-2.5 text-end ${signedClass(p.resultWithFixed)}`}>{money(p.resultWithFixed)}</td>
                  </tr>
                ))}
                <tr className="bg-gold-soft/50 font-semibold text-cocoa">
                  <td className="px-4 py-2.5">{tr.total}</td>
                  <td className="px-2 py-2.5 text-end">{r.totals.salesDays}</td>
                  <td className="px-2 py-2.5 text-end">{money(r.totals.creditRoyale)}</td>
                  <td className="px-2 py-2.5 text-end">{money(r.totals.sales)}</td>
                  <td className="px-2 py-2.5 text-end">{money(r.totals.expenses)}</td>
                  <td className="px-2 py-2.5 text-end">{money(r.totals.ownerExpenses)}</td>
                  <td className={`px-2 py-2.5 text-end ${signedClass(r.totals.final)}`}>{money(r.totals.final)}</td>
                  <td className={`px-4 py-2.5 text-end ${signedClass(r.resultWithFixed)}`}>{money(r.resultWithFixed)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {periodStarts.map((start) => (
              <form key={start} action={removePeriodStart.bind(null, start)}>
                <button className="chip h-9 gap-1.5 bg-cream capitalize text-muted ring-1 ring-line hover:bg-bad-soft hover:text-bad" aria-label={`${tr.removeCut} ${dateLabel(start, locale)}`}>
                  {dateLabel(start, locale)} ×
                </button>
              </form>
            ))}
            <form action={addPeriodStart} className="ms-auto flex items-center gap-2">
              <label htmlFor="period-start" className="text-sm text-muted">{tr.newPeriod}</label>
              <input id="period-start" name="date" type="date" min={dates[1]} max={dates[dates.length - 1]} required className="field h-10 w-auto py-1 text-sm" />
              <button className="btn-ghost h-10">{tr.addPeriod}</button>
            </form>
          </div>
        </section>

        <section>
          <SectionTitle>{tr.gridTitle}</SectionTitle>
          <p className="mb-2 text-xs text-muted">{tr.gridHint}</p>
          {/* Keyed so the typed values reset when the month or the periods change. */}
          <ResultsGrid key={`${shop.id}|${month}|${periodStarts.join()}`} t={tr} locale={locale} dates={dates} periods={periods} days={days} />
        </section>

        <form key={`${shop.id}|${month}`} action={saveResultSettings} className="card max-w-xl space-y-3 p-4">
          <input type="hidden" name="month" value={month} />
          <h2 className="font-semibold text-cocoa">{tr.settingsTitle}</h2>
          <p className="text-xs text-muted">{tr.settingsHint}</p>
          <ul className="space-y-2">
            {[...charges, null, null].map((c, i) => (
              <li key={c?.id ?? `new-${i}`} className="flex gap-2">
                <input name="label" defaultValue={c?.label ?? ""} placeholder={tr.chargeLabel} aria-label={tr.chargeLabel} maxLength={100} className="field min-w-0 flex-1" />
                <input
                  name="amount"
                  dir="ltr"
                  inputMode="decimal"
                  defaultValue={c ? String(c.amount / 100).replace(".", ",") : ""}
                  placeholder="0,00"
                  aria-label={`${tr.chargeAmount} (${t.common.dh})`}
                  className="field tabular w-32"
                />
              </li>
            ))}
          </ul>
          <div className="tabular flex justify-between text-sm font-semibold text-cocoa">
            <span>{tr.total}</span>
            <span>{money(fixedTotal)}</span>
          </div>
          <div>
            <label className="label" htmlFor="markupPct">{tr.markup}</label>
            <input id="markupPct" name="markupPct" dir="ltr" inputMode="decimal" defaultValue={markupPct} className="field tabular w-32" />
          </div>
          <button className="btn-primary">{t.common.save}</button>
        </form>
      </div>
    </>
  );
}
