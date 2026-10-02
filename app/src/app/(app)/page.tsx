import { and, count, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { StatusChip, TypeChip } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { dateLabel, money, today } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { usersById } from "@/lib/queries";
import { factoryAccount } from "@/lib/money";
import { salesPeriods } from "@/lib/sales";

function ActionCard({ href, title, hint, icon }: { href: string; title: string; hint: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="card group flex items-center gap-4 p-5 transition hover:border-gold hover:shadow-md hover:shadow-cocoa/5">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gold-soft text-cocoa">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-cocoa">{title}</span>
        <span className="block text-sm text-muted">{hint}</span>
      </span>
      <span className="text-muted transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5">→</span>
    </Link>
  );
}

const svg = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

export default async function HomePage() {
  const user = await requireUser();
  const { t, locale } = await getDict();
  const isOwner = user.role === "owner";

  const pending = isOwner
    ? db.select({ n: count() }).from(schema.counts).where(eq(schema.counts.status, "submitted")).get()!.n
    : 0;
  const missingPrices = isOwner
    ? db
        .select({ n: count() })
        .from(schema.products)
        .where(and(eq(schema.products.active, true), isNull(schema.products.purchasePrice)))
        .get()!.n
    : 0;
  const draftNotes = isOwner
    ? db.select({ n: count() }).from(schema.deliveries).where(eq(schema.deliveries.status, "draft")).get()!.n
    : 0;
  const lastPeriod = isOwner ? salesPeriods(1)[0] : undefined;
  const factoryBalance = isOwner ? factoryAccount().balance : 0;
  const recent = db
    .select()
    .from(schema.counts)
    .where(isOwner ? undefined : eq(schema.counts.createdBy, user.id))
    .orderBy(desc(schema.counts.date), desc(schema.counts.id))
    .limit(5)
    .all();
  const names = usersById();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted">{dateLabel(today(), locale)}</p>
        <h1 className="font-display text-3xl text-cocoa">
          {t.home.hello}, {user.name.split(" ")[0]}
        </h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ActionCard
          href="/pos"
          title={t.nav.pos}
          hint={t.home.sellHint}
          icon={svg(<><path d="M4 4h16v10H4z" /><path d="M8 18h8M12 14v4M7 8h4" /></>)}
        />
        <ActionCard
          href="/counts/new?type=delivery"
          title={t.home.newDeliveryCount}
          hint={t.home.newDeliveryCountHint}
          icon={svg(<><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>)}
        />
        <ActionCard
          href="/counts/new?type=stock"
          title={t.home.newStockCount}
          hint={t.home.newStockCountHint}
          icon={svg(<><path d="M4 8 12 4l8 4v8l-8 4-8-4z" /><path d="m4 8 8 4 8-4M12 12v8" /></>)}
        />
        <ActionCard
          href="/cash/new"
          title={t.cash.close}
          hint={t.cash.closeHint}
          icon={svg(<><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>)}
        />
      </div>

      {lastPeriod && (
        <Link href="/sales" className="card flex items-center justify-between gap-4 p-4 hover:border-gold">
          <div>
            <div className="text-sm text-muted">{t.sales.lastGap}</div>
            <div className="text-xs text-muted">
              {dateLabel(lastPeriod.from, locale)}
              {lastPeriod.days.length > 1 && ` → ${dateLabel(lastPeriod.days[lastPeriod.days.length - 1], locale)}`}
            </div>
          </div>
          <div className={`tabular text-2xl font-semibold ${lastPeriod.gap < 0 ? "text-bad" : "text-ok"}`}>
            {lastPeriod.gap > 0 ? "+" : ""}
            {money(lastPeriod.gap)} <span className="text-sm font-normal text-muted">{t.common.dh}</span>
          </div>
        </Link>
      )}

      {isOwner && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Link href="/counts" className="card p-4 hover:border-gold">
            <div className="tabular text-3xl font-semibold text-cocoa">{pending}</div>
            <div className="text-sm text-muted">{t.home.toValidate}</div>
          </Link>
          <Link href="/deliveries" className="card p-4 hover:border-gold">
            <div className="tabular text-3xl font-semibold text-cocoa">{draftNotes}</div>
            <div className="text-sm text-muted">{t.deliveries.toCheck}</div>
          </Link>
          <Link href="/factory" className="card p-4 hover:border-gold">
            <div className="tabular text-3xl font-semibold text-cocoa">{money(factoryBalance)}</div>
            <div className="text-sm text-muted">{t.factory.balance}</div>
          </Link>
          <Link href="/products" className="card p-4 hover:border-gold">
            <div className={`tabular text-3xl font-semibold ${missingPrices ? "text-warn" : "text-cocoa"}`}>{missingPrices}</div>
            <div className="text-sm text-muted">{t.home.missingPrices}</div>
          </Link>
        </div>
      )}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{t.home.recentCounts}</h2>
        {recent.length === 0 ? (
          <p className="card p-6 text-center text-sm text-muted">{t.home.nothing}</p>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {recent.map((c) => (
              <li key={c.id}>
                <Link href={`/counts/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-cream">
                  <span className="flex-1">
                    <span className="font-medium">{dateLabel(c.date, locale)}</span>{" "}
                    <span className="text-xs text-muted">· {names.get(c.createdBy)}</span>
                  </span>
                  <TypeChip type={c.type} t={t.counts} />
                  <StatusChip validated={c.status === "validated"} t={t.counts} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
