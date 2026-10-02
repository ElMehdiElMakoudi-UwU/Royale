import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { dateLabel, money } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { usersById } from "@/lib/queries";
import { closingRevenue, outflowTotals } from "@/lib/sales";

export default async function CashPage({ searchParams }: PageProps<"/cash">) {
  const user = await requireUser();
  const { t, locale } = await getDict();
  const { sent } = await searchParams;
  const isOwner = user.role === "owner";

  const rows = db
    .select()
    .from(schema.cashClosings)
    .where(isOwner ? undefined : eq(schema.cashClosings.createdBy, user.id))
    .orderBy(desc(schema.cashClosings.date))
    .limit(100)
    .all();
  const outflows = outflowTotals(rows.map((r) => r.id));
  const names = usersById();

  return (
    <>
      <PageHeader title={t.cash.title}>
        <Link href="/cash/new" className="btn-primary">+ {t.cash.close}</Link>
      </PageHeader>

      {sent && <p className="mb-4 rounded-xl bg-ok-soft px-4 py-3 text-sm font-medium text-ok">{t.cash.sent}</p>}

      {rows.length === 0 ? (
        <p className="card p-8 text-center text-muted">{t.home.nothing}</p>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/cash/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-cream">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{dateLabel(r.date, locale)}</div>
                  <div className="text-xs text-muted">{names.get(r.createdBy)}</div>
                </div>
                <div className="tabular text-end font-semibold text-cocoa">
                  {money(closingRevenue(r, outflows.get(r.id) ?? 0))}
                  <span className="ms-1 text-xs font-normal text-muted">{t.common.dh}</span>
                </div>
                {r.status === "validated" ? (
                  <span className="chip bg-ok-soft text-ok">{t.cash.validated}</span>
                ) : (
                  <span className="chip bg-warn-soft text-warn">{t.cash.submitted}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
