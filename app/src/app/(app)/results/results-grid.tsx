"use client";

import { Fragment, useRef, useState, useTransition } from "react";
import { dateLabel, money } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n/fr";
import { totalsOf, type DateRange, type ResultDay } from "@/lib/results-calc";
import { saveResultDay, type DayInput } from "./actions";

const AMOUNT_COLUMNS = ["creditRoyale", "morning", "evening", "expenses", "ownerExpenses"] as const;
type AmountColumn = (typeof AMOUNT_COLUMNS)[number];
type Draft = Record<AmountColumn, string> & { note: string };
type Status = "saving" | "saved" | "error";

const toText = (c: number) => (c === 0 ? "" : String(c / 100).replace(".", ","));
/** "1 250,50" → 125050; "" → 0; garbage → NaN. */
function centimes(s: string) {
  const v = s.trim().replace(/\s/g, "").replace(",", ".");
  if (v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}

function toDraft(day: ResultDay | undefined): Draft {
  return {
    creditRoyale: toText(day?.creditRoyale ?? 0),
    morning: toText(day?.morning ?? 0),
    evening: toText(day?.evening ?? 0),
    expenses: toText(day?.expenses ?? 0),
    ownerExpenses: toText(day?.ownerExpenses ?? 0),
    note: day?.note ?? "",
  };
}

function toInput(draft: Draft): DayInput {
  return {
    creditRoyale: centimes(draft.creditRoyale),
    morning: centimes(draft.morning),
    evening: centimes(draft.evening),
    expenses: centimes(draft.expenses),
    ownerExpenses: centimes(draft.ownerExpenses),
    note: draft.note.trim(),
  };
}

const isValid = (input: DayInput) => AMOUNT_COLUMNS.every((c) => !Number.isNaN(input[c]));
/** Blank or malformed amounts count as zero, so totals stay readable while typing. */
const safe = (n: number) => (Number.isNaN(n) ? 0 : n);

export function ResultsGrid({
  t,
  locale,
  dates,
  periods,
  days,
}: {
  t: Dict["results"];
  locale: Locale;
  dates: string[];
  periods: DateRange[];
  days: ResultDay[];
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const byDate = new Map(days.map((d) => [d.date, d]));
    return Object.fromEntries(dates.map((date) => [date, toDraft(byDate.get(date))]));
  });
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [, startTransition] = useTransition();
  // What the server has for each day, so leaving a cell unchanged doesn't save again.
  const saved = useRef<Record<string, string>>(Object.fromEntries(dates.map((date) => [date, JSON.stringify(toInput(drafts[date]))])));

  const setStatus = (date: string, status: Status) => setStatuses((s) => ({ ...s, [date]: status }));

  const save = (date: string) => {
    const input = toInput(drafts[date]);
    if (!isValid(input)) {
      setStatus(date, "error");
      return;
    }
    const key = JSON.stringify(input);
    if (key === saved.current[date]) {
      // Back to what's stored after an invalid entry: clear the error.
      if (statuses[date] === "error") setStatus(date, "saved");
      return;
    }
    setStatus(date, "saving");
    startTransition(async () => {
      try {
        const res = await saveResultDay(date, input);
        if (!res.ok) throw new Error("rejected");
        saved.current[date] = key;
        setStatus(date, "saved");
      } catch {
        setStatus(date, "error");
      }
    });
  };

  const change = (date: string, column: keyof Draft, value: string) =>
    setDrafts((d) => ({ ...d, [date]: { ...d[date], [column]: value } }));

  const focusBelow = (date: string, column: string) => {
    const next = dates[dates.indexOf(date) + 1];
    if (next) document.querySelector<HTMLInputElement>(`[data-cell="${next}-${column}"]`)?.focus();
  };

  const totalsFor = (range: DateRange) =>
    totalsOf(
      dates
        .filter((date) => date >= range.from && date <= range.to)
        .map((date) => {
          const input = toInput(drafts[date]);
          return {
            date,
            note: "",
            creditRoyale: safe(input.creditRoyale),
            morning: safe(input.morning),
            evening: safe(input.evening),
            expenses: safe(input.expenses),
            ownerExpenses: safe(input.ownerExpenses),
          };
        }),
    );

  const headers: Record<AmountColumn, string> = {
    creditRoyale: t.creditRoyale,
    morning: t.morning,
    evening: t.evening,
    expenses: t.expenses,
    ownerExpenses: t.ownerPart,
  };

  return (
    <div className="card overflow-x-auto">
      <table className="tabular w-full min-w-[1040px] text-sm">
        <thead className="text-xs text-muted">
          <tr className="border-b border-line">
            <th className="sticky start-0 z-10 bg-paper px-3 py-2.5 text-start font-medium">{t.date}</th>
            <th className="px-1.5 py-2.5 text-end font-medium">{headers.creditRoyale}</th>
            <th className="px-1.5 py-2.5 text-end font-medium">{headers.morning}</th>
            <th className="px-1.5 py-2.5 text-end font-medium">{headers.evening}</th>
            <th className="px-2 py-2.5 text-end font-medium">{t.dayTotal}</th>
            <th className="px-1.5 py-2.5 text-end font-medium">{headers.expenses}</th>
            <th className="px-1.5 py-2.5 text-end font-medium">{headers.ownerExpenses}</th>
            <th className="px-2 py-2.5 text-end font-medium">{t.netCash}</th>
            <th className="px-1.5 py-2.5 text-start font-medium">{t.notes}</th>
          </tr>
        </thead>
        <tbody>
          {periods.map((period, index) => {
            const totals = totalsFor(period);
            return (
              <Fragment key={period.from}>
                {dates
                  .filter((date) => date >= period.from && date <= period.to)
                  .map((date) => {
                    const draft = drafts[date];
                    const input = toInput(draft);
                    const sales = safe(input.morning) + safe(input.evening);
                    const status = statuses[date];
                    const amountCell = (column: AmountColumn) => (
                      <td key={column} className="px-1.5 py-1">
                        <input
                          data-cell={`${date}-${column}`}
                          dir="ltr"
                          inputMode="decimal"
                          aria-label={`${headers[column]}, ${dateLabel(date, locale)}`}
                          value={draft[column]}
                          onChange={(e) => change(date, column, e.target.value)}
                          onBlur={() => save(date)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              focusBelow(date, column);
                            }
                          }}
                          className={`h-9 w-full min-w-20 rounded-lg border bg-paper px-2 text-end outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/25 ${
                            Number.isNaN(input[column]) ? "border-bad" : "border-line"
                          }`}
                        />
                      </td>
                    );
                    return (
                      <tr key={date} className="border-b border-line/60">
                        <td className="sticky start-0 z-10 whitespace-nowrap bg-paper px-3 py-1 capitalize">
                          {dateLabel(date, locale)}
                          <span className="ms-1.5 inline-block w-3 text-xs" role="status">
                            {status === "saving" && <span className="text-muted" title={t.saving}>…</span>}
                            {status === "saved" && <span className="text-ok" title={t.saved}>✓</span>}
                            {status === "error" && <span className="font-bold text-bad" title={t.saveError}>!</span>}
                          </span>
                        </td>
                        {amountCell("creditRoyale")}
                        {amountCell("morning")}
                        {amountCell("evening")}
                        <td className="whitespace-nowrap px-2 py-1 text-end font-medium">{sales > 0 ? money(sales) : ""}</td>
                        {amountCell("expenses")}
                        {amountCell("ownerExpenses")}
                        <td className="whitespace-nowrap px-2 py-1 text-end text-muted">
                          {sales > 0 || safe(input.expenses) > 0 ? money(sales - safe(input.expenses)) : ""}
                        </td>
                        <td className="px-1.5 py-1">
                          <input
                            data-cell={`${date}-note`}
                            aria-label={`${t.notes}, ${dateLabel(date, locale)}`}
                            value={draft.note}
                            title={draft.note}
                            maxLength={1000}
                            onChange={(e) => change(date, "note", e.target.value)}
                            onBlur={() => save(date)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                focusBelow(date, "note");
                              }
                            }}
                            className="h-9 w-full min-w-56 rounded-lg border border-line bg-paper px-2 outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/25"
                          />
                        </td>
                      </tr>
                    );
                  })}
                <tr className="border-b border-line bg-gold-soft/50 font-semibold text-cocoa">
                  <td className="sticky start-0 z-10 whitespace-nowrap bg-gold-soft px-3 py-2">
                    {t.period} {index + 1}
                  </td>
                  <td className="px-2 py-2 text-end">{money(totals.creditRoyale)}</td>
                  <td />
                  <td />
                  <td className="whitespace-nowrap px-2 py-2 text-end">{money(totals.sales)}</td>
                  <td className="px-2 py-2 text-end">{money(totals.expenses)}</td>
                  <td className="px-2 py-2 text-end">{money(totals.ownerExpenses)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-end">{money(totals.netCash)}</td>
                  <td />
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
