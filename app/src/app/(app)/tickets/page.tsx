import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { voidSale } from "@/app/pos/actions";
import { ReprintButton } from "@/components/print-receipt";
import { PageHeader, SectionTitle } from "@/components/ui";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { dateLabel, money, qty, today } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { addDays } from "@/lib/money";
import { usersById } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export default async function TicketsPage({ searchParams }: PageProps<"/tickets">) {
  const user = await requireUser();
  const { t, locale } = await getDict();
  const tt = t.tickets;
  const isOwner = user.role === "owner";
  const sp = (await searchParams).date;
  // Staff only see today's tickets, and only their own.
  const date = isOwner && typeof sp === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp) ? sp : today();

  const sales = db
    .select()
    .from(schema.posSales)
    .where(and(eq(schema.posSales.date, date), isOwner ? undefined : eq(schema.posSales.cashierId, user.id)))
    .orderBy(desc(schema.posSales.soldAt))
    .all();
  const lines = sales.length
    ? db.select().from(schema.posSaleLines).where(inArray(schema.posSaleLines.saleId, sales.map((s) => s.id))).all()
    : [];
  const products = new Map(db.select({ id: schema.products.id, unit: schema.products.unit }).from(schema.products).all().map((p) => [p.id, p.unit]));
  const names = usersById();
  const settings = getSettings();

  const completed = sales.filter((s) => s.status === "completed");
  const totalBy = (p: "cash" | "card") => completed.filter((s) => s.payment === p).reduce((a, s) => a + s.total, 0);
  const completedIds = new Set(completed.map((s) => s.id));
  const byProduct = new Map<string, { qty: number; total: number }>();
  for (const l of lines.filter((l) => completedIds.has(l.saleId))) {
    const cur = byProduct.get(l.label) ?? { qty: 0, total: 0 };
    byProduct.set(l.label, { qty: cur.qty + l.qty, total: cur.total + l.total });
  }
  const top = [...byProduct].sort((a, b) => b[1].total - a[1].total);

  return (
    <>
      <PageHeader title={tt.title}>
        {isOwner ? (
          <div className="flex items-center gap-1">
            <Link href={`?date=${addDays(date, -1)}`} className="btn-ghost size-11 px-0"><span className="rtl:rotate-180">‹</span></Link>
            <span className="min-w-32 text-center font-semibold text-cocoa">{dateLabel(date, locale)}</span>
            <Link href={`?date=${addDays(date, 1)}`} className="btn-ghost size-11 px-0"><span className="rtl:rotate-180">›</span></Link>
          </div>
        ) : (
          <Link href="/pos" className="btn-primary">{t.nav.pos}</Link>
        )}
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <div className="text-xs text-muted">{tt.totalDay}</div>
          <div className="tabular mt-1 text-2xl font-semibold text-cocoa">{money(totalBy("cash") + totalBy("card"))}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted">{tt.cash}</div>
          <div className="tabular mt-1 text-2xl font-semibold">{money(totalBy("cash"))}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted">{tt.card}</div>
          <div className="tabular mt-1 text-2xl font-semibold">{money(totalBy("card"))}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted">{tt.count}</div>
          <div className="tabular mt-1 text-2xl font-semibold">{completed.length}</div>
        </div>
      </div>

      {sales.length === 0 ? (
        <p className="card p-8 text-center text-muted">{tt.none}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <ul className="space-y-2">
            {sales.map((s) => {
              const mine = lines.filter((l) => l.saleId === s.id);
              const time = new Date(s.soldAt).toLocaleTimeString("fr-FR", { timeZone: "Africa/Casablanca", hour: "2-digit", minute: "2-digit" });
              const voided = s.status === "voided";
              return (
                <li key={s.id} className={`card overflow-hidden ${voided ? "opacity-60" : ""}`}>
                  <details>
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-cream [&::-webkit-details-marker]:hidden">
                      <span className="tabular w-12 text-sm text-muted">{time}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {mine.map((l) => l.label).join(", ")}
                      </span>
                      {voided && <span className="chip bg-bad-soft text-bad">{tt.voided}</span>}
                      <span className="chip bg-cream text-muted ring-1 ring-line">{s.payment === "cash" ? tt.cash : tt.card}</span>
                      <span className={`tabular w-20 text-end font-semibold ${voided ? "line-through" : ""}`}>{money(s.total)}</span>
                    </summary>
                    <div className="space-y-3 border-t border-line px-4 py-3">
                      <ul className="tabular space-y-1 text-sm">
                        {mine.map((l) => (
                          <li key={l.id} className="flex justify-between">
                            <span>
                              {qty(l.qty)} × {l.label}
                            </span>
                            <span>{money(l.total)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="text-xs text-muted">
                        N° {s.clientId.slice(0, 8).toUpperCase()} · {names.get(s.cashierId)}
                        {voided && ` · ${tt.voided} : ${s.voidReason}`}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <ReprintButton
                          label={tt.reprint}
                          header={settings.receiptHeader}
                          footer={settings.receiptFooter}
                          data={{
                            ref: s.clientId.slice(0, 8).toUpperCase(),
                            soldAt: s.soldAt,
                            cashier: names.get(s.cashierId) ?? "",
                            lines: mine.map((l) => ({ label: l.label, qty: l.qty, unit: products.get(l.productId) ?? "piece", unitPrice: l.unitPrice, total: l.total })),
                            total: s.total,
                            payment: s.payment,
                            cashGiven: s.cashGiven,
                            voided,
                          }}
                        />
                        {isOwner && !voided && (
                          <form action={voidSale.bind(null, s.id)} className="flex gap-2">
                            <input name="reason" required maxLength={200} placeholder={tt.voidReason} className="field h-9 w-48 py-1 text-sm" />
                            <button className="btn-ghost h-9 px-3 text-xs text-bad">{tt.void}</button>
                          </form>
                        )}
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>

          <section>
            <SectionTitle>{tt.topProducts}</SectionTitle>
            <ul className="card tabular divide-y divide-line text-sm">
              {top.map(([name, v]) => (
                <li key={name} className="flex justify-between gap-3 px-4 py-2">
                  <span className="min-w-0 truncate">
                    {qty(v.qty)} × {name}
                  </span>
                  <span>{money(v.total)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
