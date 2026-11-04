import Link from "next/link";
import { switchShop } from "@/app/actions";
import { CompareTable, moneyRow, percent, sum, type CompareRow } from "@/components/compare-table";
import { ReportChart, type ChartSeries } from "@/components/report-chart";
import { MonthNav, PageHeader, SectionTitle } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { dateLabel, label, money, monthLabel, qty } from "@/lib/format";
import { getDict, type Locale } from "@/lib/i18n";
import { isMonth, nextMonth, prevMonth } from "@/lib/money";
import { monthDates } from "@/lib/results-calc";
import { latestReportMonth, shopReport, type ShopReport } from "@/lib/shop-report";
import { listShops } from "@/lib/shop";

/** Whole dirhams: the tiles are for reading at a glance, the tables keep the centimes. */
const dirhams = (centimes: number) => Math.round(centimes / 100).toLocaleString("fr-FR");
const rate = (part: number, whole: number) => (whole > 0 ? part / whole : null);

const signed = (n: number, digits = 1) =>
  `${n > 0 ? "+" : ""}${n.toLocaleString("fr-FR", { maximumFractionDigits: digits })}`;

/** Relative change; null when there's nothing to compare with. */
const change = (now: number, before: number) => (before !== 0 ? (now - before) / Math.abs(before) : null);

const localeTag = (locale: Locale) => (locale === "ar" ? "ar-MA-u-nu-latn" : "fr-FR");

function shortMonth(month: string, locale: Locale) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(localeTag(locale), { month: "short", timeZone: "UTC" });
}

/** Monday first, matching `weekdayAverages`. 1 January 2024 was a Monday. */
function weekdayNames(locale: Locale, style: "short" | "long") {
  return Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(localeTag(locale), { weekday: style, timeZone: "UTC" }),
  );
}

type Delta = { text: string; direction: "up" | "down" | "flat" };

function Tile({
  title,
  value,
  unit,
  negative,
  delta,
  upIsGood = true,
  breakdown,
}: {
  title: string;
  value: string;
  unit?: string;
  negative?: boolean;
  delta: Delta | null;
  upIsGood?: boolean;
  breakdown: { name: string; value: string }[];
}) {
  const good = delta && delta.direction !== "flat" && (delta.direction === "up") === upIsGood;
  const deltaColor = !delta || delta.direction === "flat" ? "text-muted" : good ? "text-ok" : "text-bad";
  return (
    <div className="card flex flex-col p-4">
      <div className="text-sm text-muted">{title}</div>
      <div className={`mt-1 text-3xl font-semibold ${negative ? "text-bad" : "text-cocoa"}`}>
        {value} {unit && <span className="text-sm font-normal text-muted">{unit}</span>}
      </div>
      <div className={`mt-1 text-sm font-medium ${deltaColor}`}>
        {delta ? (
          <>
            {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "="} {delta.text}
          </>
        ) : (
          <span className="text-muted">—</span>
        )}
      </div>
      <ul className="tabular mt-3 space-y-0.5 border-t border-line pt-2 text-xs text-muted">
        {breakdown.map((b) => (
          <li key={b.name} className="flex justify-between gap-3">
            <span>{b.name}</span>
            <span className="text-ink">{b.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const direction = (n: number): Delta["direction"] => (n > 0 ? "up" : n < 0 ? "down" : "flat");

/** Percent change for an amount, null without a comparable earlier figure. */
function percentDelta(now: number, before: number | null): Delta | null {
  const c = before == null ? null : change(now, before);
  return c == null ? null : { text: `${signed(c * 100)} %`, direction: direction(c) };
}

export default async function ShopReportPage({ searchParams }: PageProps<"/shop-report">) {
  await requireOwner();
  const { t, locale } = await getDict();
  const tr = t.shopReport;
  const sp = (await searchParams).month;
  const month = isMonth(sp) ? sp : latestReportMonth();

  const shops = listShops().map((shop, slot) => ({ shop, slot, name: label(shop, locale), data: shopReport(shop.id, month) }));
  const names = shops.map((s) => s.name);
  const pick = (f: (d: ShopReport) => number) => shops.map((s) => f(s.data));
  const each = (f: (d: ShopReport) => string) => shops.map((s) => f(s.data));
  const series = (f: (d: ShopReport) => (number | null)[]): ChartSeries[] =>
    shops.map((s) => ({ name: s.name, slot: s.slot, values: f(s.data) }));

  // Combined figures come from the totals: adding up each shop's rate would mean nothing.
  const sales = sum(pick((d) => d.totals.sales));
  const credit = sum(pick((d) => d.totals.creditRoyale));
  const gross = sum(pick((d) => d.totals.gross));
  const expenses = sum(pick((d) => d.totals.expenses));
  const final = sum(pick((d) => d.totals.final));
  const salesDays = sum(pick((d) => d.totals.salesDays));
  const entered = sum(pick((d) => d.entered));

  const hasPrevious = shops.some((s) => s.data.previous);
  const previous = (f: (p: NonNullable<ShopReport["previous"]>) => number) =>
    hasPrevious ? sum(shops.map((s) => (s.data.previous ? f(s.data.previous) : 0))) : null;
  const prevSales = previous((p) => p.sales);
  const prevGross = previous((p) => p.gross);

  const grossRate = rate(gross, sales);
  const prevGrossRate = prevSales != null && prevGross != null ? rate(prevGross, prevSales) : null;
  const marginDelta: Delta | null =
    grossRate != null && prevGrossRate != null
      ? {
          text: `${signed((grossRate - prevGrossRate) * 100)} ${tr.points}`,
          direction: direction(Math.round((grossRate - prevGrossRate) * 1000)),
        }
      : null;

  const shopChange = (d: ShopReport) => {
    const c = d.previous ? change(d.totals.sales, d.previous.sales) : null;
    return c == null ? "—" : `${signed(c * 100)} %`;
  };
  const dayCell = (day: ShopReport["best"]) => (day ? `${money(day.sales)} (${dateLabel(day.date, locale)})` : "—");

  const activityRows: CompareRow[] = [
    moneyRow(t.results.sales, pick((d) => d.totals.sales), true),
    { title: tr.salesChange, values: [...each(shopChange), prevSales == null || change(sales, prevSales) == null ? "—" : `${signed(change(sales, prevSales)! * 100)} %`] },
    { title: tr.salesShare, values: [...each((d) => percent(rate(d.totals.sales, sales))), sales > 0 ? percent(1) : "—"] },
    { title: t.results.salesPerDay, values: [...each((d) => money(d.results.salesPerDay)), salesDays > 0 ? money(Math.round(sales / salesDays)) : "—"] },
    { title: tr.morningShare, values: [...each((d) => percent(rate(d.morning, d.totals.sales))), percent(rate(sum(pick((d) => d.morning)), sales))] },
    { title: tr.eveningShare, values: [...each((d) => percent(rate(d.evening, d.totals.sales))), percent(rate(sum(pick((d) => d.evening)), sales))] },
    { title: tr.bestDay, values: [...each((d) => dayCell(d.best)), "—"] },
    { title: tr.worstDay, values: [...each((d) => dayCell(d.worst)), "—"] },
    { title: t.recap.daysEntered, values: [...each((d) => String(d.entered)), "—"] },
  ];

  const marginRows: CompareRow[] = [
    moneyRow(t.results.creditRoyale, pick((d) => d.totals.creditRoyale)),
    moneyRow(t.results.gross, pick((d) => d.totals.gross)),
    { title: tr.grossMargin, values: [...each((d) => percent(rate(d.totals.gross, d.totals.sales))), percent(grossRate)] },
    { title: t.results.actualMarkup, values: [...each((d) => percent(d.results.actualMarkup)), percent(credit > 0 ? (sales - credit) / credit : null)] },
    moneyRow(t.results.expenses, pick((d) => d.totals.expenses)),
    { title: tr.expensesRate, values: [...each((d) => percent(rate(d.totals.expenses, d.totals.sales))), percent(rate(expenses, sales))] },
    moneyRow(t.results.owner, pick((d) => d.totals.ownerExpenses)),
    moneyRow(t.results.final, pick((d) => d.totals.final), true),
    { title: tr.netMargin, values: [...each((d) => percent(rate(d.totals.final, d.totals.sales))), percent(rate(final, sales))] },
    moneyRow(t.results.resultWithFixed, pick((d) => d.results.resultWithFixed)),
    moneyRow(t.factory.balance, pick((d) => d.factoryBalance)),
  ];

  const usesRegister = shops.some((s) => s.data.register.tickets + s.data.register.voided > 0);
  const hasOrders = shops.some((s) => s.data.orders.count > 0);
  const registerTotal = sum(pick((d) => d.register.total));
  const tickets = sum(pick((d) => d.register.tickets));
  const cardTotal = sum(shops.map((s) => (s.data.register.cardShare ?? 0) * s.data.register.total));

  const activityExtraRows: CompareRow[] = [
    ...(usesRegister
      ? [
          moneyRow(tr.registerTotal, pick((d) => d.register.total)),
          { title: tr.tickets, values: [...each((d) => String(d.register.tickets)), String(tickets)] },
          { title: tr.averageTicket, values: [...each((d) => money(d.register.averageTicket)), tickets > 0 ? money(Math.round(registerTotal / tickets)) : "—"] },
          { title: tr.cardShare, values: [...each((d) => percent(d.register.cardShare)), percent(rate(cardTotal, registerTotal))] },
          { title: tr.voided, values: [...each((d) => String(d.register.voided)), String(sum(pick((d) => d.register.voided)))] },
        ]
      : []),
    ...(hasOrders
      ? [
          { title: tr.orders, values: [...each((d) => String(d.orders.count)), String(sum(pick((d) => d.orders.count)))] },
          moneyRow(tr.ordersValue, pick((d) => d.orders.value)),
          moneyRow(tr.ordersDue, pick((d) => d.orders.due)),
        ]
      : []),
  ];

  const dates = monthDates(month);
  const trendMonths = shops[0].data.trend.map((m) => m.month);
  const chartText = { dh: t.common.dh, tableLabel: tr.showFigures };

  const checks = shops.flatMap(({ shop, name, data }) => {
    const { missingDays, noCreditDays } = data.results.warnings;
    return [
      ...(data.entered === 0 ? [{ key: `${shop.id}-none`, shopId: shop.id, text: `${name} : ${tr.noDataShop}` }] : []),
      ...(missingDays.length > 0 ? [{ key: `${shop.id}-missing`, shopId: shop.id, text: `${name} : ${missingDays.length} ${t.recap.missingDays}` }] : []),
      ...(noCreditDays.length > 0 ? [{ key: `${shop.id}-credit`, shopId: shop.id, text: `${name} : ${noCreditDays.length} ${tr.noCreditDays}` }] : []),
      ...(data.results.warnings.ownerOverExpensesDays.length > 0
        ? [{ key: `${shop.id}-owner`, shopId: shop.id, text: `${name} : ${data.results.warnings.ownerOverExpensesDays.length} ${tr.ownerOverDays}` }]
        : []),
    ];
  });

  return (
    <>
      <PageHeader title={tr.title} subtitle={tr.source}>
        <MonthNav month={month} label={monthLabel(month, locale)} prev={prevMonth(month)} next={nextMonth(month)} />
      </PageHeader>

      <div className="space-y-8">
        {entered === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-muted">{tr.empty}</p>
            <Link href={`/results?month=${month}`} className="btn-ghost mt-3">
              {tr.enterResults}
            </Link>
          </div>
        ) : (
          <>
            <section>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Tile
                  title={t.results.sales}
                  value={dirhams(sales)}
                  unit={t.common.dh}
                  delta={percentDelta(sales, prevSales)}
                  breakdown={shops.map((s) => ({ name: s.name, value: dirhams(s.data.totals.sales) }))}
                />
                <Tile
                  title={t.results.final}
                  value={dirhams(final)}
                  unit={t.common.dh}
                  negative={final < 0}
                  delta={percentDelta(final, previous((p) => p.final))}
                  breakdown={shops.map((s) => ({ name: s.name, value: dirhams(s.data.totals.final) }))}
                />
                <Tile
                  title={tr.grossMargin}
                  value={percent(grossRate)}
                  delta={marginDelta}
                  breakdown={shops.map((s) => ({ name: s.name, value: percent(rate(s.data.totals.gross, s.data.totals.sales)) }))}
                />
                <Tile
                  title={t.results.expenses}
                  value={dirhams(expenses)}
                  unit={t.common.dh}
                  delta={percentDelta(expenses, previous((p) => p.expenses))}
                  upIsGood={false}
                  breakdown={shops.map((s) => ({ name: s.name, value: dirhams(s.data.totals.expenses) }))}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                {hasPrevious ? `${tr.comparedTo} ${monthLabel(prevMonth(month), locale)}.` : tr.noPrevious}
              </p>
            </section>

            {checks.length > 0 && (
              <section>
                <SectionTitle>{tr.checks}</SectionTitle>
                <ul className="space-y-2">
                  {checks.map((c) => (
                    <li key={c.key}>
                      <form action={switchShop.bind(null, c.shopId, `/results?month=${month}`)}>
                        <button className="w-full rounded-xl bg-warn-soft px-4 py-3 text-start text-sm text-warn">⚠ {c.text}</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <SectionTitle>{tr.evolution}</SectionTitle>
              <div className="space-y-3">
                <ReportChart
                  kind="line"
                  title={tr.dailySales}
                  labels={dates.map((d) => String(Number(d.slice(8))))}
                  titles={dates.map((d) => dateLabel(d, locale))}
                  series={series((d) => d.dailySales)}
                  {...chartText}
                />
                <div className="grid gap-3 lg:grid-cols-2">
                  <ReportChart
                    kind="bars"
                    title={tr.monthlySales}
                    hint={tr.partialMonth}
                    labels={trendMonths.map((m) => shortMonth(m, locale))}
                    titles={trendMonths.map((m) => monthLabel(m, locale))}
                    series={series((d) => d.trend.map((m) => m.sales))}
                    {...chartText}
                  />
                  <ReportChart
                    kind="bars"
                    title={tr.monthlyFinal}
                    hint={tr.partialMonth}
                    labels={trendMonths.map((m) => shortMonth(m, locale))}
                    titles={trendMonths.map((m) => monthLabel(m, locale))}
                    series={series((d) => d.trend.map((m) => m.final))}
                    {...chartText}
                  />
                </div>
                <ReportChart
                  kind="bars"
                  title={tr.weekdaySales}
                  hint={tr.weekdayHint}
                  labels={weekdayNames(locale, "short")}
                  titles={weekdayNames(locale, "long")}
                  series={series((d) => d.weekdayAverages)}
                  {...chartText}
                />
              </div>
            </section>

            <section>
              <SectionTitle>{tr.activity}</SectionTitle>
              <CompareTable shops={names} totalLabel={t.recap.total} rows={activityRows} />
            </section>

            <section>
              <SectionTitle>{tr.margins}</SectionTitle>
              <CompareTable shops={names} totalLabel={t.recap.total} rows={marginRows} />
            </section>
          </>
        )}

        {activityExtraRows.length > 0 ? (
          <section>
            <SectionTitle>{tr.registerAndOrders}</SectionTitle>
            <CompareTable shops={names} totalLabel={t.recap.total} rows={activityExtraRows} />
          </section>
        ) : (
          entered > 0 && <p className="text-xs text-muted">{tr.noRegister}</p>
        )}

        {usesRegister && (
          <section>
            <SectionTitle>{tr.topProducts}</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {shops.map(({ shop, name, data }) => (
                <div key={shop.id} className="card overflow-hidden">
                  <h3 className="border-b border-line px-4 py-2.5 font-semibold text-cocoa">{name}</h3>
                  {data.register.topProducts.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted">—</p>
                  ) : (
                    <ol className="tabular divide-y divide-line text-sm">
                      {data.register.topProducts.map((p) => (
                        <li key={p.product.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                          <span>
                            {label(p.product, locale)} <span className="text-xs text-muted">× {qty(p.qty)}</span>
                          </span>
                          <span className="font-medium">{money(p.total)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
