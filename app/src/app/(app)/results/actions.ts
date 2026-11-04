"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireOwner } from "@/lib/auth";
import { parseMoney } from "@/lib/format";
import { formDate, formMonth } from "@/lib/form";
import { saveMarkupPct } from "@/lib/results";

export type DayInput = {
  creditRoyale: number;
  morning: number;
  evening: number;
  expenses: number;
  ownerExpenses: number;
  note: string;
};

const MAX_AMOUNT = 100_000_000_00; // 100 million DH, in centimes.
const isAmount = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= MAX_AMOUNT;

/** Saves one day of the grid; a day emptied of everything is removed. */
export async function saveResultDay(date: string, input: DayInput): Promise<{ ok: boolean }> {
  await requireOwner();
  const { creditRoyale, morning, evening, expenses, ownerExpenses } = input;
  const amounts = [creditRoyale, morning, evening, expenses, ownerExpenses];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !amounts.every(isAmount) || typeof input.note !== "string") return { ok: false };
  const note = input.note.trim().slice(0, 1000);

  if (amounts.every((a) => a === 0) && !note) {
    db.delete(schema.resultDays).where(eq(schema.resultDays.date, date)).run();
  } else {
    const values = { creditRoyale, morning, evening, expenses, ownerExpenses, note };
    db.insert(schema.resultDays)
      .values({ date, ...values })
      .onConflictDoUpdate({ target: schema.resultDays.date, set: values })
      .run();
  }
  revalidatePath("/results");
  return { ok: true };
}

export async function addPeriodStart(form: FormData) {
  await requireOwner();
  const date = formDate(form);
  if (!date) return;
  db.insert(schema.resultPeriodStarts).values({ date }).onConflictDoNothing().run();
  revalidatePath("/results");
}

export async function removePeriodStart(date: string) {
  await requireOwner();
  db.delete(schema.resultPeriodStarts).where(eq(schema.resultPeriodStarts.date, date)).run();
  revalidatePath("/results");
}

/** Stores the charges on this month, so earlier months keep the figures they were compared with. */
export async function saveResultSettings(form: FormData) {
  await requireOwner();
  const month = formMonth(form);
  if (!month) return;

  const labels = form.getAll("label").map((v) => String(v).trim().slice(0, 100));
  const amounts = form.getAll("amount");
  let rows: { month: string; label: string; amount: number }[];
  try {
    rows = labels.flatMap((label, i) => (label ? [{ month, label, amount: parseMoney(amounts[i] ?? null) ?? 0 }] : []));
  } catch {
    return;
  }

  const markup = Number(String(form.get("markupPct") ?? "").trim().replace(",", "."));
  if (Number.isFinite(markup) && markup >= 0 && markup <= 1000) saveMarkupPct(markup);

  // A month with no rows would inherit from an earlier one, so an empty list changes nothing.
  if (rows.length > 0) {
    db.transaction((tx) => {
      tx.delete(schema.fixedCharges).where(eq(schema.fixedCharges.month, month)).run();
      tx.insert(schema.fixedCharges).values(rows).run();
    });
  }
  revalidatePath("/results");
}
