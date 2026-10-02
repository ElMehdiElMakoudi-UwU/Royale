import { inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteDelivery, deletePhoto, reopenDelivery, validateDelivery } from "../actions";
import { CopyBox } from "@/components/copy-box";
import { db, schema } from "@/db";
import { ConfirmButton } from "@/components/confirm-button";
import { PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { dateLabel, label, money, qty } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { countedForDate, getDelivery, listProducts } from "@/lib/queries";
import { claimMessage, reconcile } from "@/lib/reconcile";

function Stat({ title, value, hint, tone = "default" }: { title: string; value: string; hint?: string; tone?: "default" | "bad" | "ok" }) {
  const color = tone === "bad" ? "text-bad" : tone === "ok" ? "text-ok" : "text-cocoa";
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{title}</div>
      <div className={`tabular mt-1 text-2xl font-semibold ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export default async function DeliveryPage({ params }: PageProps<"/deliveries/[id]">) {
  await requireOwner();
  const { t, locale } = await getDict();
  const td = t.deliveries;
  const id = Number((await params).id);
  const delivery = Number.isInteger(id) ? getDelivery(id) : null;
  if (!delivery) notFound();

  const isDraft = delivery.status === "draft";
  const products = new Map(listProducts({ includeInactive: true }).map((p) => [p.id, p]));
  const counted = countedForDate(delivery.date);
  const countRows = counted
    ? db.select().from(schema.counts).where(inArray(schema.counts.id, counted.countIds)).all()
    : [];
  const r = reconcile(delivery.lines, delivery.declaredTotal, products, counted?.qty ?? null);
  const claim = claimMessage(r, delivery.blNumber, delivery.date);
  const difference = r.invoicedTotal - r.correctTotal;
  const productDiff = new Map(r.products.map((p) => [p.product.id, p]));

  return (
    <>
      <PageHeader
        title={delivery.blNumber || td.new}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>{dateLabel(delivery.date, locale)}</span>
            {isDraft ? (
              <span className="chip bg-warn-soft text-warn">{td.draft}</span>
            ) : (
              <span className="chip bg-ok-soft text-ok">{td.checked}</span>
            )}
          </span>
        }
        back={{ href: "/deliveries", label: td.title }}
      >
        {isDraft ? (
          <Link href={`/deliveries/${id}/edit`} className="btn-primary">{td.editLines}</Link>
        ) : (
          <form action={reopenDelivery.bind(null, id)}>
            <button className="btn-ghost">{td.reopen}</button>
          </form>
        )}
      </PageHeader>

      {delivery.lines.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-muted">{td.empty}</p>
          {isDraft && (
            <Link href={`/deliveries/${id}/edit`} className="btn-primary mt-4">{td.readPhotos}</Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat title={td.invoiced} value={`${money(r.invoicedTotal)} ${t.common.dh}`} />
            <Stat title={td.correct} value={`${money(r.correctTotal)} ${t.common.dh}`} hint={td.correctHint} />
            <Stat
              title={td.difference}
              value={`${difference > 0 ? "+" : ""}${money(difference)} ${t.common.dh}`}
              tone={difference === 0 ? "ok" : "bad"}
            />
          </div>

          {!r.hasCount && <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">{td.noCount}</p>}
          {countRows.length > 0 && (
            <p className="text-sm text-muted">
              {countRows.map((c) => (
                <Link key={c.id} href={`/counts/${c.id}`} className="me-3 font-medium text-cocoa underline underline-offset-4">
                  {td.countLink}
                </Link>
              ))}
              {countRows.some((c) => c.status !== "validated") && <span className="text-warn">{td.countNotValidated}</span>}
            </p>
          )}

          {r.issues === 0 ? (
            <p className="rounded-xl bg-ok-soft px-4 py-3 text-sm font-medium text-ok">✓ {td.noIssues}</p>
          ) : (
            <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">
              {r.issues} {td.issues}
              {r.totalMismatch && (
                <span className="tabular block font-normal">
                  {td.totalIssue} : {money(r.declaredTotal)} ≠ {money(r.sumOfLines)}
                </span>
              )}
            </p>
          )}

          <div className="card overflow-x-auto">
            <table className="tabular w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="px-4 py-2.5 text-start font-medium">{td.designation}</th>
                  <th className="px-3 py-2.5 text-end font-medium">{td.invoiced}</th>
                  {r.hasCount && <th className="px-3 py-2.5 text-end font-medium">{td.received}</th>}
                  <th className="px-3 py-2.5 text-end font-medium">{td.unitPrice}</th>
                  <th className="px-4 py-2.5 text-end font-medium">{td.amount}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {r.lines.map((l, i) => {
                  const pd = l.product ? productDiff.get(l.product.id) : undefined;
                  // Show the received quantity once per product, on its first line.
                  const firstOfProduct = l.product ? r.lines.findIndex((x) => x.product?.id === l.product!.id) === i : false;
                  const qtyBad = pd?.diff != null && pd.diff !== 0;
                  return (
                    <tr key={i} className={!l.product ? "bg-warn-soft/50" : ""}>
                      <td className="px-4 py-2.5">
                        <div className="font-mono text-xs" dir="ltr">{l.designation}</div>
                        <div className={`text-xs ${l.product ? "text-muted" : "font-semibold text-warn"}`}>
                          {l.product ? label(l.product, locale) : `⚠ ${td.unmatched}`}
                        </div>
                      </td>
                      <td className={`px-3 py-2.5 text-end ${qtyBad ? "font-semibold text-bad" : ""}`}>{qty(l.qty)}</td>
                      {r.hasCount && (
                        <td className={`px-3 py-2.5 text-end ${qtyBad ? "font-semibold text-bad" : "text-muted"}`}>
                          {firstOfProduct && pd?.counted != null ? qty(pd.counted) : l.product ? "" : "—"}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-end">
                        <div className={l.priceDiff != null ? "font-semibold text-bad" : ""}>{money(l.unitPrice)}</div>
                        {l.priceDiff != null && (
                          <div className="text-xs text-muted">{td.agreed} {money(l.agreedPrice)}</div>
                        )}
                        {l.product && l.agreedPrice == null && <div className="text-xs text-warn">{td.noAgreedPrice}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-end">
                        <div className={l.mathError ? "font-semibold text-bad" : ""}>{money(l.amount ?? l.computedAmount)}</div>
                        {l.mathError && <div className="text-xs text-muted">= {money(l.computedAmount)}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {r.notInvoiced.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{td.notInvoiced}</h2>
              <ul className="card divide-y divide-line">
                {r.notInvoiced.map((x) => (
                  <li key={x.product.id} className="tabular flex justify-between px-4 py-2.5 text-sm">
                    <span>{label(x.product, locale)}</span>
                    <span className="font-semibold text-warn">{qty(x.counted)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {claim && (
            <section>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">{td.claim}</h2>
              <p className="mb-2 text-xs text-muted">{td.claimHint}</p>
              <CopyBox text={claim} labels={{ copy: td.copy, copied: td.copied }} />
            </section>
          )}

          {isDraft ? (
            <form action={validateDelivery.bind(null, id)} className="card flex flex-wrap items-end gap-3 p-4">
              <div className="min-w-48 flex-1">
                <label className="label" htmlFor="acceptedTotal">{td.acceptedTotal} ({t.common.dh})</label>
                <input
                  id="acceptedTotal"
                  name="acceptedTotal"
                  dir="ltr"
                  inputMode="decimal"
                  defaultValue={(r.correctTotal / 100).toFixed(2)}
                  className="field tabular"
                  required
                />
                <p className="mt-1 text-xs text-muted">{td.acceptedHint}</p>
              </div>
              <button className="btn-primary">{td.validate}</button>
            </form>
          ) : (
            <Stat title={td.acceptedTotal} value={`${money(delivery.acceptedTotal)} ${t.common.dh}`} hint={td.acceptedHint} />
          )}
        </div>
      )}

      {delivery.photos.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{td.photos}</h2>
          <div className="flex flex-wrap gap-3">
            {delivery.photos.map((p) => (
              <div key={p.id} className="relative">
                <a href={`/photos/deliveries/${p.id}`} target="_blank">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked images */}
                  <img src={`/photos/deliveries/${p.id}`} alt="" className="h-40 rounded-lg border border-line object-cover" />
                </a>
                {isDraft && (
                  <form action={deletePhoto.bind(null, p.id)} className="absolute end-1 top-1">
                    <button
                      className="grid size-7 place-items-center rounded-full bg-paper/90 text-bad shadow"
                      title={td.deletePhoto}
                      aria-label={td.deletePhoto}
                    >
                      ×
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {delivery.note && (
        <p className="mt-6 rounded-xl bg-gold-soft px-4 py-3 text-sm text-cocoa">
          <span className="font-semibold">{td.note} : </span>
          {delivery.note}
        </p>
      )}

      {isDraft && (
        <form action={deleteDelivery.bind(null, id)} className="mt-10 border-t border-line pt-4">
          <ConfirmButton message={td.confirmDelete} className="text-sm font-medium text-bad hover:underline">
            {td.delete}
          </ConfirmButton>
        </form>
      )}
    </>
  );
}
