import Link from "next/link";
import { notFound } from "next/navigation";
import { CountForm } from "../count-form";
import { formGroups } from "../form-groups";
import { reopenCount, validateCount } from "../actions";
import { PageHeader, StatusChip, TypeChip } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { dateLabel, label, money, qty } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { getCount, groupProducts, listCategories, listProducts, salesEstimate, usersById } from "@/lib/queries";

export default async function CountPage({ params, searchParams }: PageProps<"/counts/[id]">) {
  const user = await requireUser();
  const { t, locale } = await getDict();
  const id = Number((await params).id);
  const count = Number.isInteger(id) ? getCount(id) : null;
  const isOwner = user.role === "owner";
  if (!count || (!isOwner && count.createdBy !== user.id)) notFound();

  const validated = count.status === "validated";
  const title = `${count.type === "delivery" ? t.counts.newDelivery : t.counts.newStock} — ${dateLabel(count.date, locale)}`;
  const back = { href: "/counts", label: t.counts.title };

  if (isOwner && !validated && (await searchParams).edit) {
    return (
      <>
        <PageHeader title={t.counts.editCount} subtitle={title} back={{ href: `/counts/${id}`, label: t.common.back }} />
        <CountForm
          t={{ counts: t.counts, common: t.common, units: t.units }}
          type={count.type}
          groups={formGroups(locale, t.products.noCategory)}
          canPickDate
          defaultDate={count.date}
          edit={{ id, note: count.note, values: Object.fromEntries(count.lines.map((l) => [l.productId, l.qty])) }}
        />
      </>
    );
  }

  // Order lines like the catalog (by category, then product order).
  const products = listProducts({ includeInactive: true });
  const order = new Map(
    groupProducts(products, listCategories())
      .flatMap((g) => g.products)
      .map((p, i) => [p.id, i]),
  );
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = [...count.lines].sort((a, b) => (order.get(a.productId) ?? 1e9) - (order.get(b.productId) ?? 1e9));

  const estimate = isOwner && count.type === "stock" ? salesEstimate(count) : null;
  const names = usersById();

  const rows = lines.map((l) => {
    const prev = estimate?.prevQty.get(l.productId);
    const delivered = estimate?.delivered.get(l.productId) ?? 0;
    const sold = prev != null ? Math.round((prev + delivered - l.qty) * 1000) / 1000 : undefined;
    return { line: l, product: byId.get(l.productId), prev, delivered, sold };
  });
  const purchaseTotal = rows.reduce((s, r) => s + (r.product?.purchasePrice ?? 0) * r.line.qty, 0);
  const soldTotal = rows.reduce((s, r) => s + (r.product?.salePrice ?? 0) * (r.sold ?? 0), 0);

  return (
    <>
      <PageHeader
        title={title}
        back={back}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <TypeChip type={count.type} t={t.counts} />
            <StatusChip validated={validated} t={t.counts} />
            <span>
              {t.common.by} {names.get(count.createdBy)}
            </span>
          </span>
        }
      >
        {isOwner && !validated && (
          <>
            <Link href={`/counts/${id}?edit=1`} className="btn-ghost">{t.common.edit}</Link>
            <form action={validateCount.bind(null, id)}>
              <button className="btn-primary">{t.counts.validate}</button>
            </form>
          </>
        )}
        {isOwner && validated && (
          <form action={reopenCount.bind(null, id)}>
            <button className="btn-ghost">{t.counts.reopen}</button>
          </form>
        )}
      </PageHeader>

      {count.note && (
        <p className="mb-4 rounded-xl bg-gold-soft px-4 py-3 text-sm text-cocoa">
          <span className="font-semibold">{t.counts.note} : </span>
          {count.note}
        </p>
      )}

      {isOwner && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="card p-4">
            <div className="text-xs text-muted">{t.counts.totalValue}</div>
            <div className="tabular mt-1 text-2xl font-semibold text-cocoa">
              {money(purchaseTotal)} <span className="text-sm font-normal text-muted">{t.common.dh}</span>
            </div>
          </div>
          {estimate && (
            <div className="card p-4">
              <div className="text-xs text-muted">{t.counts.soldValue}</div>
              <div className="tabular mt-1 text-2xl font-semibold text-cocoa">
                {money(soldTotal)} <span className="text-sm font-normal text-muted">{t.common.dh}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {isOwner && count.type === "stock" && (
        <p className="mb-4 text-xs text-muted">
          {estimate
            ? t.counts.salesHint.replace("{prev}", dateLabel(estimate.previous.date, locale))
            : t.counts.noPrevious}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="card p-8 text-center text-muted">{t.counts.empty}</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="tabular w-full text-sm">
            <thead>
              <tr className="border-b border-line text-start text-xs text-muted">
                <th className="px-4 py-2.5 text-start font-medium">{t.nav.products}</th>
                {estimate && <th className="px-3 py-2.5 text-end font-medium">{t.counts.previous}</th>}
                {estimate && <th className="px-3 py-2.5 text-end font-medium">+ {t.counts.delivery}</th>}
                <th className="px-3 py-2.5 text-end font-medium">{t.counts.qty}</th>
                {estimate && <th className="px-4 py-2.5 text-end font-medium">{t.counts.sold}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ line, product, prev, delivered, sold }) => (
                <tr key={line.productId}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{product ? label(product, locale) : t.counts.unknownProduct}</div>
                    {product && <div className="text-xs text-muted">{t.units[product.unit]}</div>}
                  </td>
                  {estimate && <td className="px-3 py-2.5 text-end text-muted">{prev != null ? qty(prev) : "—"}</td>}
                  {estimate && <td className="px-3 py-2.5 text-end text-muted">{delivered ? qty(delivered) : "—"}</td>}
                  <td className="px-3 py-2.5 text-end text-base font-semibold">{qty(line.qty)}</td>
                  {estimate && (
                    <td
                      className={`px-4 py-2.5 text-end font-semibold ${
                        sold == null ? "text-muted" : sold < 0 ? "text-bad" : "text-ok"
                      }`}
                    >
                      {sold != null ? qty(sold) : "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
