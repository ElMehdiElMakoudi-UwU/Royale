import { switchShop } from "@/app/actions";
import { CompareTable, moneyRow, percent, sum, type CompareRow } from "@/components/compare-table";
import { MonthNav, PageHeader, SectionTitle } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { dateLabel, label, money, monthLabel, today } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { isMonth, monthOf, nextMonth, prevMonth } from "@/lib/money";
import { shopRecap } from "@/lib/recap";
import { listShops } from "@/lib/shop";

type Row = CompareRow;

export default async function RecapPage({ searchParams }: PageProps<"/recap">) {
  await requireOwner();
  const { t, locale } = await getDict();
  const tr = t.recap;
  const sp = (await searchParams).month;
  const month = isMonth(sp) ? sp : monthOf(today());

  const shops = listShops().map((shop) => ({ shop, name: label(shop, locale), data: shopRecap(shop.id, month) }));
  const names = shops.map((s) => s.name);
  const pick = (f: (d: (typeof shops)[number]["data"]) => number) => shops.map((s) => f(s.data));

  // Combined from the totals: adding up each shop's percentage would mean nothing.
  const allSales = sum(pick((d) => d.ledger.totals.sales));
  const allCredit = sum(pick((d) => d.ledger.totals.creditRoyale));

  const ledgerRows: Row[] = [
    moneyRow(t.results.sales, pick((d) => d.ledger.totals.sales)),
    moneyRow(t.results.creditRoyale, pick((d) => d.ledger.totals.creditRoyale)),
    moneyRow(t.results.gross, pick((d) => d.ledger.totals.gross)),
    moneyRow(t.results.expenses, pick((d) => d.ledger.totals.expenses)),
    moneyRow(t.results.final, pick((d) => d.ledger.totals.final), true),
    moneyRow(t.results.resultWithFixed, pick((d) => d.ledger.resultWithFixed)),
    moneyRow(t.results.salesPerDay, pick((d) => d.ledger.salesPerDay)),
    {
      title: t.results.actualMarkup,
      values: [
        ...shops.map((s) => percent(s.data.ledger.actualMarkup)),
        percent(allCredit > 0 ? (allSales - allCredit) / allCredit : null),
      ],
    },
    {
      title: tr.daysEntered,
      values: [...pick((d) => d.ledger.totals.salesDays).map(String), "—"],
    },
  ];

  const bilanRows: Row[] = [
    moneyRow(t.report.sales, pick((d) => d.bilan.sales)),
    moneyRow(t.report.purchases, pick((d) => d.bilan.purchases)),
    moneyRow(t.report.expenses, pick((d) => d.bilan.expenses)),
    moneyRow(t.report.salaries, pick((d) => d.bilan.salaries)),
    moneyRow(t.report.result, pick((d) => d.bilan.result), true),
  ];

  const factoryRows: Row[] = [
    moneyRow(t.factory.balance, pick((d) => d.factory.balance), true),
    moneyRow(tr.factoryDrafts, pick((d) => d.factory.draftTotal)),
  ];

  const registerTotal = sum(pick((d) => d.today.registerTotal));
  const ticketTotal = sum(pick((d) => d.today.tickets));

  return (
    <>
      <PageHeader title={tr.title} subtitle={dateLabel(today(), locale)}>
        <MonthNav month={month} label={monthLabel(month, locale)} prev={prevMonth(month)} next={nextMonth(month)} />
      </PageHeader>

      <div className="space-y-8">
        <section>
          <SectionTitle>{tr.today}</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map(({ shop, name, data }) => (
              <div key={shop.id} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-xl text-cocoa">{name}</h2>
                  <form action={switchShop.bind(null, shop.id, "/")}>
                    <button className="text-sm font-medium text-cocoa underline underline-offset-4">{tr.openShop}</button>
                  </form>
                </div>
                <div className="tabular mt-3 text-2xl font-semibold text-cocoa">
                  {money(data.today.registerTotal)} <span className="text-sm font-normal text-muted">{t.common.dh}</span>
                </div>
                <div className="text-xs text-muted">
                  {tr.registerSales} · {data.today.tickets} {tr.tickets}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
                  <span className="text-muted">{tr.closing}</span>
                  {data.today.closingRevenue == null ? (
                    <span className="chip bg-warn-soft text-warn">{tr.notClosed}</span>
                  ) : (
                    <span className="tabular font-semibold">{money(data.today.closingRevenue)}</span>
                  )}
                </div>
              </div>
            ))}
            <div className="card bg-gold-soft/50 p-4 sm:col-span-2 lg:col-span-1">
              <h2 className="font-display text-xl text-cocoa">{tr.total}</h2>
              <div className="tabular mt-3 text-2xl font-semibold text-cocoa">
                {money(registerTotal)} <span className="text-sm font-normal text-muted">{t.common.dh}</span>
              </div>
              <div className="text-xs text-muted">
                {tr.registerSales} · {ticketTotal} {tr.tickets}
              </div>
            </div>
          </div>
        </section>

        <section>
          <SectionTitle>{tr.ledger}</SectionTitle>
          <p className="mb-2 text-xs text-muted">{tr.ledgerHint}</p>
          <CompareTable shops={names} totalLabel={tr.total} rows={ledgerRows} />
        </section>

        <section>
          <SectionTitle>{tr.factory}</SectionTitle>
          <CompareTable shops={names} totalLabel={tr.total} rows={factoryRows} />
        </section>

        <section>
          <SectionTitle>{tr.todo}</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {shops.map(({ shop, name, data }) => {
              const items = [
                { n: data.todo.lateOrders, text: tr.lateOrders, to: "/orders", urgent: true },
                { n: data.todo.dueOrders, text: tr.ordersDue, to: "/orders" },
                { n: data.todo.counts, text: tr.countsToValidate, to: "/counts" },
                { n: data.todo.notes, text: tr.notesToCheck, to: "/deliveries" },
                { n: data.todo.closings, text: tr.closingsToValidate, to: "/cash" },
                { n: data.todo.outflows, text: tr.outflowsToClassify, to: `/expenses?month=${month}` },
                { n: data.todo.missingDays, text: tr.missingDays, to: `/results?month=${month}` },
              ].filter((i) => i.n > 0);
              return (
                <div key={shop.id} className="card overflow-hidden">
                  <h3 className="border-b border-line px-4 py-2.5 font-semibold text-cocoa">{name}</h3>
                  {items.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-ok">✓ {tr.nothingTodo}</p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {items.map((i) => (
                        <li key={i.text}>
                          {/* Opens the page on this shop, whichever one is selected now. */}
                          <form action={switchShop.bind(null, shop.id, i.to)}>
                            <button className="flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm hover:bg-cream">
                              <span className={`tabular w-6 text-end font-semibold ${i.urgent ? "text-bad" : "text-cocoa"}`}>{i.n}</span>
                              <span className="flex-1">{i.text}</span>
                              <span className="text-muted rtl:rotate-180">→</span>
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <SectionTitle>{tr.bilan}</SectionTitle>
          <p className="mb-2 text-xs text-muted">{tr.bilanHint}</p>
          <CompareTable shops={names} totalLabel={tr.total} rows={bilanRows} />
        </section>
      </div>
    </>
  );
}
