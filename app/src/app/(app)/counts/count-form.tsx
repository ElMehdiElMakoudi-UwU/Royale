"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { CountType, Unit } from "@/db/schema";
import type { Dict } from "@/lib/i18n/fr";
import { submitCount, updateCount } from "./actions";

export type FormGroup = {
  key: string;
  label: string;
  products: { id: number; label: string; alt: string; unit: Unit }[];
};

type Props = {
  t: Pick<Dict, "counts" | "common" | "units">;
  type: CountType;
  groups: FormGroup[];
  canPickDate: boolean;
  defaultDate: string;
  /** When set, the form edits this existing count instead of creating one. */
  edit?: { id: number; values: Record<number, number>; note: string };
};

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function parseQty(raw: string | undefined) {
  if (raw == null) return null;
  const s = raw.trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

export function CountForm({ t, type, groups, canPickDate, defaultDate, edit }: Props) {
  const router = useRouter();
  const draftKey = edit ? null : `count-draft:${type}`;
  const [values, setValues] = useState<Record<number, string>>(() =>
    edit ? Object.fromEntries(Object.entries(edit.values).map(([k, v]) => [k, String(v)])) : {},
  );
  const [note, setNote] = useState(edit?.note ?? "");
  const [date, setDate] = useState(defaultDate);
  const [query, setQuery] = useState("");
  const [onlyCounted, setOnlyCounted] = useState(false);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const loaded = useRef(false);

  // Restore an unsent draft (phone locked, page reloaded…).
  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as { values: Record<number, string>; note: string };
        if (Object.keys(draft.values ?? {}).length > 0 || draft.note) {
          // localStorage only exists after hydration, so this has to run in an effect.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setValues(draft.values ?? {});
          setNote(draft.note ?? "");
          setRestored(true);
        }
      }
    } catch {}
    loaded.current = true;
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || !loaded.current) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ values, note }));
    } catch {}
  }, [draftKey, values, note]);

  const countedIds = useMemo(
    () => Object.keys(values).filter((id) => parseQty(values[Number(id)]) != null).map(Number),
    [values],
  );
  const invalid = Object.values(values).some((v) => Number.isNaN(parseQty(v)));
  const total = groups.reduce((n, g) => n + g.products.length, 0);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return groups
      .map((g) => ({
        ...g,
        products: g.products.filter((p) => {
          if (onlyCounted && parseQty(values[p.id]) == null) return false;
          return !q || normalize(p.label).includes(q) || normalize(p.alt).includes(q);
        }),
      }))
      .filter((g) => g.products.length > 0);
  }, [groups, query, onlyCounted, values]);

  const set = (id: number, v: string) => setValues((prev) => ({ ...prev, [id]: v }));
  const step = (id: number, unit: Unit, delta: number) => {
    const current = parseQty(values[id]);
    const base = current == null || Number.isNaN(current) ? 0 : current;
    const inc = unit === "kg" ? 0.5 : 1;
    const next = Math.max(0, Math.round((base + delta * inc) * 1000) / 1000);
    set(id, String(next));
  };

  const clearDraft = () => {
    setValues({});
    setNote("");
    setRestored(false);
    if (draftKey) localStorage.removeItem(draftKey);
  };

  const submit = () => {
    if (invalid || pending) return;
    if (!edit && !confirm(t.counts.confirmSubmit)) return;
    setError(false);
    const lines = countedIds.map((productId) => ({ productId, qty: parseQty(values[productId]) as number }));
    startTransition(async () => {
      const input = { type, date, note, lines };
      const res = edit ? await updateCount(edit.id, input) : await submitCount(input);
      if (!res.ok) {
        setError(true);
        return;
      }
      if (draftKey) localStorage.removeItem(draftKey);
      router.push(canPickDate ? `/counts/${res.id}` : "/counts?sent=1");
    });
  };

  return (
    <div>
      {restored && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-gold-soft px-4 py-2.5 text-sm text-cocoa">
          <span>{t.counts.draftRestored}</span>
          <button onClick={clearDraft} className="font-semibold underline underline-offset-4">
            {t.counts.clearDraft}
          </button>
        </div>
      )}

      <div className="sticky top-14 z-10 -mx-4 mb-4 space-y-3 bg-cream/95 px-4 pb-3 pt-1 backdrop-blur">
        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.common.search}
            className="field"
          />
          {canPickDate && (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field w-auto shrink-0"
            />
          )}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          <button
            onClick={() => setOnlyCounted((v) => !v)}
            className={`chip shrink-0 py-1.5 ring-1 ${onlyCounted ? "bg-cocoa text-white ring-cocoa" : "bg-paper text-muted ring-line"}`}
          >
            {t.counts.onlyCounted}
          </button>
          {visible.map((g) => (
            <a
              key={g.key}
              href={`#g-${g.key}`}
              className="chip shrink-0 bg-paper py-1.5 text-muted ring-1 ring-line hover:text-cocoa"
            >
              {g.label}
            </a>
          ))}
        </div>
      </div>

      <p className="mb-4 text-xs text-muted">{t.counts.zeroHint}</p>

      <div className="space-y-6">
        {visible.map((g) => (
          <section key={g.key} id={`g-${g.key}`} className="scroll-mt-40">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{g.label}</h2>
            <ul className="card divide-y divide-line overflow-hidden">
              {g.products.map((p) => {
                const raw = values[p.id] ?? "";
                const parsed = parseQty(raw);
                const bad = Number.isNaN(parsed);
                return (
                  <li key={p.id} className={`flex items-center gap-3 px-3 py-2.5 ${parsed != null && !bad ? "bg-gold-soft/40" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{p.label}</div>
                      <div className="truncate text-xs text-muted">
                        {t.units[p.unit]}
                        {p.alt && ` · ${p.alt}`}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1" dir="ltr">
                      <button
                        type="button"
                        onClick={() => step(p.id, p.unit, -1)}
                        className="grid size-10 place-items-center rounded-lg border border-line bg-paper text-lg text-muted active:bg-cream"
                        aria-label="-"
                      >
                        −
                      </button>
                      <input
                        inputMode="decimal"
                        value={raw}
                        onChange={(e) => set(p.id, e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className={`tabular h-10 w-16 rounded-lg border bg-paper text-center text-lg font-semibold outline-none focus:ring-2 ${
                          bad ? "border-bad text-bad focus:ring-bad/25" : "border-line focus:border-gold focus:ring-gold/25"
                        }`}
                        aria-label={p.label}
                      />
                      <button
                        type="button"
                        onClick={() => step(p.id, p.unit, 1)}
                        className="grid size-10 place-items-center rounded-lg border border-line bg-paper text-lg text-muted active:bg-cream"
                        aria-label="+"
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-6">
        <label className="label" htmlFor="note">{t.counts.note}</label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.counts.notePlaceholder}
          rows={2}
          className="field"
        />
      </div>

      <div className="sticky bottom-20 z-10 mt-6 md:bottom-4">
        <div className="card flex items-center gap-3 p-3 shadow-lg shadow-cocoa/10">
          <div className="tabular flex-1 text-sm">
            <span className="text-lg font-semibold text-cocoa">{countedIds.length}</span>
            <span className="text-muted"> / {total} {t.counts.counted}</span>
          </div>
          {error && <span className="text-sm text-bad">{t.counts.saveError}</span>}
          <button onClick={submit} disabled={pending || invalid || countedIds.length === 0} className="btn-primary">
            {edit ? t.common.save : t.counts.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
