import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { dateLabel, money } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { createDelivery } from "./actions";

export default async function DeliveriesPage() {
  await requireOwner();
  const { t, locale } = await getDict();

  const rows = db
    .select({
      id: schema.deliveries.id,
      blNumber: schema.deliveries.blNumber,
      date: schema.deliveries.date,
      status: schema.deliveries.status,
      declaredTotal: schema.deliveries.declaredTotal,
      acceptedTotal: schema.deliveries.acceptedTotal,
      sumOfLines: sql<number>`coalesce(sum(coalesce(${schema.deliveryLines.amount}, round(${schema.deliveryLines.qty} * ${schema.deliveryLines.unitPrice}))), 0)`,
      lines: sql<number>`count(${schema.deliveryLines.id})`,
    })
    .from(schema.deliveries)
    .leftJoin(schema.deliveryLines, eq(schema.deliveryLines.deliveryId, schema.deliveries.id))
    .groupBy(schema.deliveries.id)
    .orderBy(desc(schema.deliveries.date), desc(schema.deliveries.id))
    .limit(200)
    .all();

  return (
    <>
      <PageHeader title={t.deliveries.title}>
        <form action={createDelivery}>
          <button className="btn-primary">+ {t.deliveries.new}</button>
        </form>
      </PageHeader>

      {rows.length === 0 ? (
        <p className="card p-8 text-center text-muted">{t.home.nothing}</p>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {rows.map((r) => {
            const invoiced = r.declaredTotal ?? r.sumOfLines;
            const diff = r.acceptedTotal != null ? r.acceptedTotal - invoiced : null;
            return (
              <li key={r.id}>
                <Link href={`/deliveries/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-cream">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{dateLabel(r.date, locale)}</span>
                      <span className="font-mono text-xs text-muted" dir="ltr">{r.blNumber || "—"}</span>
                    </div>
                    <div className="tabular mt-0.5 text-xs text-muted">
                      {r.lines} {t.counts.lines} · {t.deliveries.invoiced} {money(invoiced)} {t.common.dh}
                      {diff != null && diff !== 0 && (
                        <span className="font-semibold text-bad"> · {money(diff)}</span>
                      )}
                    </div>
                  </div>
                  {r.status === "checked" ? (
                    <span className="chip bg-ok-soft text-ok">{t.deliveries.checked}</span>
                  ) : (
                    <span className="chip bg-warn-soft text-warn">{t.deliveries.draft}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
