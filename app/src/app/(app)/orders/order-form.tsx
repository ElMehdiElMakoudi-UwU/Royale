"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { OCCASIONS, ORDER_PAYMENT_METHODS } from "@/db/schema";
import type { Dict } from "@/lib/i18n/fr";
import { saveOrder, type OrderInput } from "./actions";

export type ProductOption = { id: number; label: string; group: string; price: number | null };

type Row = { key: number; productId: string; label: string; qty: string; unitPrice: string };
type Method = (typeof ORDER_PAYMENT_METHODS)[number];

type Props = {
  t: Dict["orders"] & { common: Dict["common"] };
  products: ProductOption[];
  /** Existing order being edited (no deposit field then: payments are added on the order page). */
  editId?: number;
  initial: Omit<OrderInput, "deposit">;
};

let nextKey = 1;
const dh = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2));
const fmt = (c: number) => (c / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "12,50" → 1250 centimes; "" → null; garbage → NaN. */
function centimes(s: string) {
  const v = s.trim().replace(/\s/g, "").replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}
function number(s: string) {
  const v = s.trim().replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : NaN;
}
const emptyRow = (): Row => ({ key: nextKey++, productId: "", label: "", qty: "1", unitPrice: "" });

export function OrderForm({ t, products, editId, initial }: Props) {
  const router = useRouter();
  const [customerName, setCustomerName] = useState(initial.customerName);
  const [customerPhone, setCustomerPhone] = useState(initial.customerPhone);
  const [occasion, setOccasion] = useState(initial.occasion);
  const [pickupDate, setPickupDate] = useState(initial.pickupDate);
  const [pickupTime, setPickupTime] = useState(initial.pickupTime ?? "");
  const [delivery, setDelivery] = useState(initial.deliveryAddress !== "");
  const [deliveryAddress, setDeliveryAddress] = useState(initial.deliveryAddress);
  const [note, setNote] = useState(initial.note);
  const [rows, setRows] = useState<Row[]>(() =>
    initial.lines.length
      ? initial.lines.map((l) => ({
          key: nextKey++,
          productId: l.productId == null ? "" : String(l.productId),
          label: l.label,
          qty: String(l.qty),
          unitPrice: dh(l.unitPrice),
        }))
      : [emptyRow()],
  );
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState<Method>("cash");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const byId = new Map(products.map((p) => [String(p.id), p]));
  const groups = [...new Set(products.map((p) => p.group))];
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const pickProduct = (r: Row, productId: string) => {
    const p = byId.get(productId);
    update(r.key, {
      productId,
      // Prefill from the catalog; the price stays editable for custom sizes or discounts.
      label: p ? p.label : r.productId ? "" : r.label,
      unitPrice: p?.price != null ? dh(p.price) : r.unitPrice,
    });
  };

  const parsed = rows.map((r) => ({ row: r, qty: number(r.qty), unitPrice: centimes(r.unitPrice) }));
  const filled = parsed.filter((p) => p.row.label.trim() || p.row.productId || p.unitPrice != null);
  const lineTotal = (p: (typeof parsed)[number]) =>
    p.qty != null && !Number.isNaN(p.qty) && p.unitPrice != null && !Number.isNaN(p.unitPrice) ? Math.round(p.qty * p.unitPrice) : null;
  const total = filled.reduce((s, p) => s + (lineTotal(p) ?? 0), 0);
  const depositCents = editId == null ? centimes(deposit) : null;
  const invalid =
    !customerName.trim() ||
    !pickupDate ||
    filled.length === 0 ||
    filled.some((p) => !p.row.label.trim() || lineTotal(p) == null) ||
    (delivery && !deliveryAddress.trim()) ||
    Number.isNaN(depositCents) ||
    (depositCents != null && depositCents > total);

  const save = () => {
    if (invalid) return;
    setError(false);
    startTransition(async () => {
      const res = await saveOrder(editId ?? null, {
        customerName,
        customerPhone,
        occasion,
        pickupDate,
        pickupTime: pickupTime || null,
        deliveryAddress: delivery ? deliveryAddress : "",
        note,
        lines: filled.map((p) => ({
          productId: p.row.productId ? Number(p.row.productId) : null,
          label: p.row.label.trim(),
          qty: p.qty as number,
          unitPrice: p.unitPrice as number,
        })),
        deposit: depositCents ? { amount: depositCents, method } : null,
      });
      if (res.ok) router.push(`/orders/${res.id}`);
      else setError(true);
    });
  };

  return (
    <div className="space-y-5">
      <div className="card grid gap-4 p-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="customerName">{t.customerName} *</label>
          <input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} maxLength={100} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="phone">{t.phone}</label>
          <input
            id="phone"
            type="tel"
            dir="ltr"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="06 00 00 00 00"
            maxLength={30}
            className="field tabular"
          />
        </div>
        <div>
          <label className="label" htmlFor="occasion">{t.occasion}</label>
          <select id="occasion" value={occasion} onChange={(e) => setOccasion(e.target.value as typeof occasion)} className="field">
            {OCCASIONS.map((o) => (
              <option key={o} value={o}>{t.occasions[o]}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div>
            <label className="label" htmlFor="pickupDate">{t.pickupDate} *</label>
            <input id="pickupDate" type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="pickupTime">{t.pickupTime}</label>
            <input id="pickupTime" type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="field" />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={delivery} onChange={(e) => setDelivery(e.target.checked)} className="size-4 accent-cocoa" />
            {t.delivery}
          </label>
          {delivery && (
            <input
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder={t.deliveryAddress}
              aria-label={t.deliveryAddress}
              maxLength={300}
              className={`field mt-2 ${!deliveryAddress.trim() ? "border-warn" : ""}`}
            />
          )}
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{t.items}</h2>
        <ul className="space-y-2">
          {parsed.map((p) => {
            const r = p.row;
            const lt = lineTotal(p);
            return (
              <li key={r.key} className="card p-3">
                <div className="flex items-start gap-2">
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    <select value={r.productId} onChange={(e) => pickProduct(r, e.target.value)} aria-label={t.items} className="field text-sm">
                      <option value="">{t.custom}</option>
                      {groups.map((g) => (
                        <optgroup key={g} label={g}>
                          {products
                            .filter((o) => o.group === g)
                            .map((o) => (
                              <option key={o.id} value={o.id}>{o.label}</option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                    <input
                      value={r.label}
                      onChange={(e) => update(r.key, { label: e.target.value })}
                      placeholder={t.itemLabel}
                      aria-label={t.itemLabel}
                      maxLength={200}
                      className="field text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    className="mt-1.5 grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-bad-soft hover:text-bad"
                    aria-label={t.removeItem}
                    title={t.removeItem}
                  >
                    ×
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 pe-10" dir="ltr">
                  <label className="text-xs text-muted">
                    {t.qty}
                    <input
                      inputMode="decimal"
                      value={r.qty}
                      onChange={(e) => update(r.key, { qty: e.target.value })}
                      className={`field tabular mt-1 py-2 ${Number.isNaN(p.qty) ? "border-bad" : ""}`}
                    />
                  </label>
                  <label className="text-xs text-muted">
                    {t.unitPrice}
                    <input
                      inputMode="decimal"
                      value={r.unitPrice}
                      onChange={(e) => update(r.key, { unitPrice: e.target.value })}
                      placeholder="0,00"
                      className={`field tabular mt-1 py-2 ${Number.isNaN(p.unitPrice) ? "border-bad" : ""}`}
                    />
                  </label>
                  <div className="text-xs text-muted">
                    {t.lineTotal}
                    <div className="tabular mt-1 py-2.5 text-base font-semibold text-ink">{lt == null ? "—" : fmt(lt)}</div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => setRows((rs) => [...rs, emptyRow()])} className="btn-ghost mt-3">
          + {t.addItem}
        </button>
      </section>

      <div>
        <label className="label" htmlFor="note">{t.note}</label>
        <textarea
          id="note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.notePlaceholder}
          maxLength={2000}
          className="field"
        />
      </div>

      {editId == null && (
        <div className="card grid gap-3 p-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="deposit">{t.deposit} ({t.common.dh})</label>
            <input
              id="deposit"
              dir="ltr"
              inputMode="decimal"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              placeholder="0,00"
              className={`field tabular ${Number.isNaN(depositCents) || (depositCents ?? 0) > total ? "border-bad" : ""}`}
            />
            <p className="mt-1 text-xs text-muted">{t.depositHint}</p>
          </div>
          <div>
            <span className="label">{t.method}</span>
            <div className="flex gap-2">
              {ORDER_PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`btn flex-1 border ${method === m ? "border-cocoa bg-cocoa text-white" : "border-line bg-paper"}`}
                >
                  {t.methods[m]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{t.saveError}</p>}

      <div className="sticky bottom-20 z-10 md:bottom-4">
        <div className="card flex flex-wrap items-center gap-3 p-3 shadow-lg shadow-cocoa/10">
          <div className="tabular flex-1 text-sm">
            <span className="text-muted">{t.total}: </span>
            <span className="text-lg font-semibold text-cocoa">{fmt(total)}</span>
            {depositCents != null && !Number.isNaN(depositCents) && depositCents > 0 && depositCents <= total && (
              <span className="ms-2 text-muted">
                · {t.due}: <span className="font-semibold text-ink">{fmt(total - depositCents)}</span>
              </span>
            )}
          </div>
          <Link href={editId ? `/orders/${editId}` : "/orders"} className="btn-ghost">{t.common.cancel}</Link>
          <button type="button" onClick={save} disabled={pending || invalid} className="btn-primary">
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}
