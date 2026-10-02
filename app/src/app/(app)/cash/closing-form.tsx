"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Dict } from "@/lib/i18n/fr";
import { saveClosing, type ClosingInput } from "./actions";

type Props = {
  t: Dict["cash"] & { common: Dict["common"] };
  canPickDate: boolean;
  /** Existing closing being corrected by the owner. */
  editId?: number;
  initial: ClosingInput;
};

let nextKey = 1;
const dh = (c: number) => (c === 0 ? "" : (c / 100).toFixed(2));
const fmt = (c: number) => (c / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "1 250,50" → 125050; "" → 0; garbage → NaN. */
function centimes(s: string) {
  const v = s.trim().replace(/\s/g, "").replace(",", ".");
  if (v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}

function MoneyField({
  id,
  label,
  hint,
  value,
  onChange,
  large,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  large?: boolean;
}) {
  const bad = Number.isNaN(centimes(value));
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input
        id={id}
        dir="ltr"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0,00"
        className={`field tabular ${large ? "text-xl font-semibold" : ""} ${bad ? "border-bad" : ""}`}
      />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function ClosingForm({ t, canPickDate, editId, initial }: Props) {
  const router = useRouter();
  const [date, setDate] = useState(initial.date);
  const [openingFloat, setOpeningFloat] = useState(dh(initial.openingFloat));
  const [cashCounted, setCashCounted] = useState(dh(initial.cashCounted));
  const [card, setCard] = useState(dh(initial.card));
  const [note, setNote] = useState(initial.note);
  const [outflows, setOutflows] = useState(() =>
    initial.outflows.map((o) => ({ key: nextKey++, label: o.label, amount: dh(o.amount) })),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const out = outflows.map((o) => ({ ...o, cents: centimes(o.amount) }));
  const values = [centimes(openingFloat), centimes(cashCounted), centimes(card), ...out.map((o) => o.cents)];
  const invalid =
    values.some(Number.isNaN) ||
    cashCounted.trim() === "" ||
    out.some((o) => (o.label.trim() === "") !== (o.cents === 0));
  const revenue = invalid
    ? null
    : centimes(cashCounted) - centimes(openingFloat) + out.reduce((s, o) => s + o.cents, 0) + centimes(card);

  const submit = () => {
    if (invalid || pending) return;
    if (!editId && !confirm(t.confirmSubmit)) return;
    setError(null);
    startTransition(async () => {
      const res = await saveClosing(editId ?? null, {
        date,
        openingFloat: centimes(openingFloat),
        cashCounted: centimes(cashCounted),
        card: centimes(card),
        note,
        outflows: out.filter((o) => o.label.trim()).map((o) => ({ label: o.label.trim(), amount: o.cents })),
      });
      if (!res.ok) {
        setError(res.error === "exists" ? t.exists : t.error);
        return;
      }
      router.push(canPickDate ? `/cash/${res.id}` : "/cash?sent=1");
    });
  };

  return (
    <div className="max-w-2xl space-y-5">
      {canPickDate && (
        <div className="card p-4">
          <label className="label" htmlFor="date">{t.date}</label>
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field w-auto" />
        </div>
      )}

      <div className="card grid gap-4 p-4 sm:grid-cols-2">
        <MoneyField id="opening" label={`${t.openingFloat} (${t.common.dh})`} hint={t.openingFloatHint} value={openingFloat} onChange={setOpeningFloat} />
        <MoneyField id="card" label={`${t.card} (${t.common.dh})`} value={card} onChange={setCard} />
        <div className="sm:col-span-2">
          <MoneyField id="cash" label={`${t.cashCounted} (${t.common.dh})`} hint={t.cashCountedHint} value={cashCounted} onChange={setCashCounted} large />
        </div>
      </div>

      <section className="card p-4">
        <h2 className="font-semibold text-cocoa">{t.outflows}</h2>
        <p className="mb-3 text-xs text-muted">{t.outflowsHint}</p>
        <ul className="space-y-2">
          {out.map((o) => (
            <li key={o.key} className="flex gap-2">
              <input
                value={o.label}
                onChange={(e) => setOutflows((xs) => xs.map((x) => (x.key === o.key ? { ...x, label: e.target.value } : x)))}
                placeholder={t.outflowLabel}
                aria-label={t.outflowLabel}
                className="field min-w-0 flex-1"
              />
              <input
                dir="ltr"
                inputMode="decimal"
                value={o.amount}
                onChange={(e) => setOutflows((xs) => xs.map((x) => (x.key === o.key ? { ...x, amount: e.target.value } : x)))}
                placeholder="0,00"
                aria-label={t.outflowAmount}
                className={`field tabular w-28 ${Number.isNaN(o.cents) ? "border-bad" : ""}`}
              />
              <button
                type="button"
                onClick={() => setOutflows((xs) => xs.filter((x) => x.key !== o.key))}
                className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-bad-soft hover:text-bad"
                aria-label="×"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setOutflows((xs) => [...xs, { key: nextKey++, label: "", amount: "" }])}
          className="btn-ghost mt-3"
        >
          + {t.addOutflow}
        </button>
      </section>

      <div>
        <label className="label" htmlFor="note">{t.note}</label>
        <textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="field" />
      </div>

      <div className="sticky bottom-20 z-10 md:bottom-4">
        <div className="card flex flex-wrap items-center gap-3 p-3 shadow-lg shadow-cocoa/10">
          <div className="flex-1">
            <div className="text-xs text-muted">{t.revenue} · {t.revenueHint}</div>
            <div className="tabular text-xl font-semibold text-cocoa">
              {revenue == null ? "—" : fmt(revenue)} <span className="text-sm font-normal text-muted">{t.common.dh}</span>
            </div>
          </div>
          {error && <span className="text-sm text-bad">{error}</span>}
          {editId && <Link href={`/cash/${editId}`} className="btn-ghost">{t.common.cancel}</Link>}
          <button type="button" onClick={submit} disabled={invalid || pending} className="btn-primary">
            {editId ? t.common.save : t.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
