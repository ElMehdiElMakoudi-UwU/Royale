import { count, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { PageHeader, StatusChip, TypeChip } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { dateLabel } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { usersById } from "@/lib/queries";

export default async function CountsPage({ searchParams }: PageProps<"/counts">) {
  const user = await requireUser();
  const { t, locale } = await getDict();
  const { sent } = await searchParams;
  const isOwner = user.role === "owner";

  const rows = db
    .select({
      id: schema.counts.id,
      type: schema.counts.type,
      date: schema.counts.date,
      status: schema.counts.status,
      createdBy: schema.counts.createdBy,
      lines: count(schema.countLines.productId),
    })
    .from(schema.counts)
    .leftJoin(schema.countLines, eq(schema.countLines.countId, schema.counts.id))
    // Staff only see their own counts.
    .where(isOwner ? undefined : eq(schema.counts.createdBy, user.id))
    .groupBy(schema.counts.id)
    .orderBy(desc(schema.counts.date), desc(schema.counts.id))
    .limit(100)
    .all();
  const names = usersById();

  return (
    <>
      <PageHeader title={t.counts.title}>
        <Link href="/print/count-sheet" className="btn-ghost">{t.counts.sheet}</Link>
        <Link href="/counts/new?type=delivery" className="btn-ghost">+ {t.counts.delivery}</Link>
        <Link href="/counts/new?type=stock" className="btn-primary">+ {t.counts.stock}</Link>
      </PageHeader>

      {sent && (
        <p className="mb-4 rounded-xl bg-ok-soft px-4 py-3 text-sm font-medium text-ok">{t.counts.sent}</p>
      )}

      {rows.length === 0 ? (
        <p className="card p-8 text-center text-muted">{t.home.nothing}</p>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/counts/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-cream">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{dateLabel(r.date, locale)}</span>
                    <TypeChip type={r.type} t={t.counts} />
                  </div>
                  <div className="tabular mt-0.5 text-xs text-muted">
                    {r.lines} {t.counts.lines} · {names.get(r.createdBy)}
                  </div>
                </div>
                <StatusChip validated={r.status === "validated"} t={t.counts} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
