"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { Dict } from "@/lib/i18n/fr";
import { saveDelivery, uploadPhotos, type ExtractedLine } from "./actions";

export type ProductOption = { id: number; label: string; group: string; price: number | null };

type Row = { key: number; designation: string; productId: string; qty: string; unitPrice: string; amount: string };

type Props = {
  t: Dict["deliveries"] & { common: Dict["common"] };
  id: number;
  initial: {
    blNumber: string;
    date: string;
    declaredTotal: number | null;
    note: string;
    lines: ExtractedLine[];
  };
  products: ProductOption[];
  aiEnabled: boolean;
};

let nextKey = 1;
const dh = (c: number | null) => (c == null ? "" : (c / 100).toFixed(2));
const toRow = (l: ExtractedLine): Row => ({
  key: nextKey++,
  designation: l.designation,
  productId: l.productId == null ? "" : String(l.productId),
  qty: String(l.qty),
  unitPrice: dh(l.unitPrice),
  amount: dh(l.amount),
});
const emptyRow = (): Row => ({ key: nextKey++, designation: "", productId: "", qty: "", unitPrice: "", amount: "" });

/** "4,70" → 470 centimes; "" → null; garbage → NaN. */
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
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}
const fmt = (c: number) => (c / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Downscales a phone photo so uploads stay small and fast; text stays readable at 2000px. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
  } catch {
    return file;
  }
}

export function DeliveryEditor({ t, id, initial, products, aiEnabled }: Props) {
  const router = useRouter();
  const [blNumber, setBlNumber] = useState(initial.blNumber);
  const [date, setDate] = useState(initial.date);
  const [declaredTotal, setDeclaredTotal] = useState(dh(initial.declaredTotal));
  const [note, setNote] = useState(initial.note);
  const [rows, setRows] = useState<Row[]>(() =>
    initial.lines.length ? initial.lines.map(toRow) : [emptyRow()],
  );
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad" | "info"; text: string } | null>(null);
  const [duplicateId, setDuplicateId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const readRef = useRef(false);

  const byId = new Map(products.map((p) => [String(p.id), p]));
  const groups = [...new Set(products.map((p) => p.group))];

  const touch = () => setDirty(true);
  const update = (key: number, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    touch();
  };

  const parsed = rows.map((r) => ({
    row: r,
    qty: number(r.qty),
    unitPrice: centimes(r.unitPrice),
    amount: centimes(r.amount),
  }));
  const filled = parsed.filter((p) => p.row.designation.trim() || p.qty != null || p.unitPrice != null);
  const invalid =
    filled.some(
      (p) =>
        !p.row.designation.trim() ||
        p.qty == null ||
        Number.isNaN(p.qty) ||
        p.unitPrice == null ||
        Number.isNaN(p.unitPrice) ||
        Number.isNaN(p.amount),
    ) || Number.isNaN(centimes(declaredTotal));
  const sum = filled.reduce(
    (s, p) => s + (p.amount != null && !Number.isNaN(p.amount) ? p.amount : Math.round((p.qty ?? 0) * (p.unitPrice ?? 0))),
    0,
  );

  const save = () => {
    if (invalid) return;
    setMessage(null);
    setDuplicateId(null);
    startTransition(async () => {
      const res = await saveDelivery(id, {
        blNumber,
        date,
        declaredTotal: centimes(declaredTotal) as number | null,
        note,
        lines: filled.map((p) => ({
          designation: p.row.designation.trim(),
          productId: p.row.productId ? Number(p.row.productId) : null,
          qty: p.qty as number,
          unitPrice: p.unitPrice as number,
          amount: p.amount as number | null,
        })),
      });
      if (res.ok) {
        setDirty(false);
        router.push(`/deliveries/${id}`);
      } else if (res.error === "duplicate") {
        setDuplicateId(res.otherId ?? null);
        setMessage({ tone: "bad", text: t.duplicate });
      } else {
        setMessage({ tone: "bad", text: t.saveError });
      }
    });
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const read = readRef.current;
    setReading(read);
    setMessage(read ? { tone: "info", text: t.reading } : null);
    const form = new FormData();
    for (const f of Array.from(files)) form.append("photos", await shrink(f), "photo.jpg");
    if (read) form.set("read", "1");
    const res = await uploadPhotos(id, form);
    setReading(false);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
    if (!res.ok) {
      setMessage({ tone: "bad", text: t.saveError });
      return;
    }
    if (res.readError) {
      setMessage({ tone: "bad", text: res.readError === "noKey" ? t.readNoKey : t.readFailed });
      return;
    }
    const ex = res.extracted;
    if (!ex) {
      setMessage(null);
      return;
    }
    if (ex.blNumber && !blNumber) setBlNumber(ex.blNumber);
    if (ex.date) setDate(ex.date);
    if (ex.declaredTotal != null && !declaredTotal) setDeclaredTotal(dh(ex.declaredTotal));
    if (filled.length === 0 || confirm(t.replaceLines)) {
      setRows(ex.lines.length ? ex.lines.map(toRow) : [emptyRow()]);
    } else {
      setRows((rs) => [...rs.filter((r) => r.designation || r.qty || r.unitPrice), ...ex.lines.map(toRow)]);
    }
    touch();
    setMessage({ tone: "ok", text: `${ex.lines.length} ${t.readDone}` });
  };

  const pick = (read: boolean) => {
    readRef.current = read;
    fileRef.current?.click();
  };

  return (
    <div className="space-y-5">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />

      <div className="card flex flex-wrap items-center gap-3 p-4">
        {aiEnabled && (
          <button type="button" onClick={() => pick(true)} disabled={reading} className="btn-primary">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            {t.readPhotos}
          </button>
        )}
        <button type="button" onClick={() => pick(false)} disabled={reading} className="btn-ghost">
          + {t.addPhotos}
        </button>
        <p className="w-full text-xs text-muted">{aiEnabled ? t.readHint : t.readNoKey}</p>
      </div>

      {message && (
        <div
          className={`flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm ${
            message.tone === "ok" ? "bg-ok-soft text-ok" : message.tone === "bad" ? "bg-bad-soft text-bad" : "bg-gold-soft text-cocoa"
          }`}
        >
          {reading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
          <span>{message.text}</span>
          {duplicateId && (
            <Link href={`/deliveries/${duplicateId}`} className="font-semibold underline underline-offset-4">
              {t.openOther}
            </Link>
          )}
        </div>
      )}

      <div className="card grid gap-4 p-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="bl">{t.blNumber}</label>
          <input
            id="bl"
            dir="ltr"
            value={blNumber}
            onChange={(e) => (setBlNumber(e.target.value), touch())}
            placeholder="BL00030715"
            className="field font-mono uppercase"
          />
        </div>
        <div>
          <label className="label" htmlFor="date">{t.date}</label>
          <input id="date" type="date" value={date} onChange={(e) => (setDate(e.target.value), touch())} className="field" required />
        </div>
        <div>
          <label className="label" htmlFor="total">{t.declaredTotal} ({t.common.dh})</label>
          <input
            id="total"
            dir="ltr"
            inputMode="decimal"
            value={declaredTotal}
            onChange={(e) => (setDeclaredTotal(e.target.value), touch())}
            className={`field tabular ${Number.isNaN(centimes(declaredTotal)) ? "border-bad" : ""}`}
          />
          <p className="mt-1 text-xs text-muted">{t.declaredTotalHint}</p>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{t.lines}</h2>
        <ul className="space-y-2">
          {parsed.map(({ row: r, qty, unitPrice, amount }, i) => {
            const product = r.productId ? byId.get(r.productId) : undefined;
            const priceDiff = product?.price != null && unitPrice != null && !Number.isNaN(unitPrice) && unitPrice !== product.price;
            const computed = qty != null && unitPrice != null && !Number.isNaN(qty) && !Number.isNaN(unitPrice) ? Math.round(qty * unitPrice) : null;
            const mathError = amount != null && !Number.isNaN(amount) && computed != null && Math.abs(amount - computed) >= 1;
            return (
              <li key={r.key} className="card p-3">
                <div className="flex items-start gap-2">
                  <span className="tabular mt-2.5 w-5 shrink-0 text-xs text-muted">{i + 1}</span>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                    <input
                      dir="ltr"
                      value={r.designation}
                      onChange={(e) => update(r.key, { designation: e.target.value })}
                      placeholder={t.designation}
                      aria-label={t.designation}
                      className="field font-mono text-sm"
                    />
                    <select
                      value={r.productId}
                      onChange={(e) => update(r.key, { productId: e.target.value })}
                      aria-label={t.product}
                      className={`field text-sm ${!r.productId && r.designation ? "border-warn bg-warn-soft" : ""}`}
                    >
                      <option value="">{r.designation ? `⚠ ${t.unmatched}` : t.chooseProduct}</option>
                      {groups.map((g) => (
                        <optgroup key={g} label={g}>
                          {products
                            .filter((p) => p.group === g)
                            .map((p) => (
                              <option key={p.id} value={p.id}>{p.label}</option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => (setRows((rs) => rs.filter((x) => x.key !== r.key)), touch())}
                    className="mt-1.5 grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-bad-soft hover:text-bad"
                    aria-label={t.removeLine}
                    title={t.removeLine}
                  >
                    ×
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 ps-7 pe-10" dir="ltr">
                  <label className="text-xs text-muted">
                    {t.qty}
                    <input
                      inputMode="decimal"
                      value={r.qty}
                      onChange={(e) => update(r.key, { qty: e.target.value })}
                      className={`field tabular mt-1 py-2 ${qty != null && Number.isNaN(qty) ? "border-bad" : ""}`}
                    />
                  </label>
                  <label className="text-xs text-muted">
                    {t.unitPrice}
                    <input
                      inputMode="decimal"
                      value={r.unitPrice}
                      onChange={(e) => update(r.key, { unitPrice: e.target.value })}
                      className={`field tabular mt-1 py-2 ${priceDiff ? "border-bad bg-bad-soft text-bad" : ""}`}
                    />
                    {product && (
                      <span className={`mt-0.5 block ${priceDiff ? "font-semibold text-bad" : ""}`}>
                        {t.agreed}: {product.price == null ? "—" : fmt(product.price)}
                      </span>
                    )}
                  </label>
                  <label className="text-xs text-muted">
                    {t.amount}
                    <input
                      inputMode="decimal"
                      value={r.amount}
                      onChange={(e) => update(r.key, { amount: e.target.value })}
                      placeholder={computed != null ? fmt(computed) : ""}
                      className={`field tabular mt-1 py-2 ${mathError || (amount != null && Number.isNaN(amount)) ? "border-bad bg-bad-soft text-bad" : ""}`}
                    />
                    {mathError && computed != null && <span className="mt-0.5 block font-semibold text-bad">= {fmt(computed)}</span>}
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => (setRows((rs) => [...rs, emptyRow()]), touch())} className="btn-ghost mt-3">
          + {t.addLine}
        </button>
        <p className="mt-2 text-xs text-muted">{t.amountHint}</p>
      </section>

      <div>
        <label className="label" htmlFor="note">{t.note}</label>
        <textarea id="note" rows={2} value={note} onChange={(e) => (setNote(e.target.value), touch())} className="field" />
      </div>

      <div className="sticky bottom-20 z-10 md:bottom-4">
        <div className="card flex flex-wrap items-center gap-3 p-3 shadow-lg shadow-cocoa/10">
          <div className="tabular flex-1 text-sm">
            <span className="text-muted">{t.sumOfLines}: </span>
            <span className="text-lg font-semibold text-cocoa">{fmt(sum)}</span>
            {centimes(declaredTotal) != null && !Number.isNaN(centimes(declaredTotal)) && Math.abs(sum - centimes(declaredTotal)!) >= 1 && (
              <span className="ms-2 chip bg-bad-soft text-bad">≠ {fmt(centimes(declaredTotal)!)}</span>
            )}
            {dirty && <span className="ms-2 text-xs text-warn">{t.unsaved}</span>}
          </div>
          <Link href={`/deliveries/${id}`} className="btn-ghost">{t.common.cancel}</Link>
          <button type="button" onClick={save} disabled={pending || invalid || reading} className="btn-primary">
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}
