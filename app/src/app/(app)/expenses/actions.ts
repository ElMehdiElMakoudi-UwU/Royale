"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireOwner } from "@/lib/auth";
import { formAmount, formDate, formId, formText } from "@/lib/form";

function revalidate() {
  revalidatePath("/expenses");
  revalidatePath("/report");
}

const categoryExists = (id: number) =>
  Boolean(db.select().from(schema.expenseCategories).where(eq(schema.expenseCategories.id, id)).get());

export async function addExpense(form: FormData) {
  const owner = await requireOwner();
  const date = formDate(form);
  const amount = formAmount(form);
  const categoryId = formId(form, "categoryId");
  const label = formText(form, "label", 200);
  if (!date || !amount || !categoryId || !label || !categoryExists(categoryId)) return;
  db.insert(schema.expenses).values({ date, amount, categoryId, label, createdBy: owner.id }).run();
  revalidate();
}

export async function deleteExpense(id: number) {
  await requireOwner();
  db.delete(schema.expenses).where(eq(schema.expenses.id, id)).run();
  revalidate();
}

/** Assigns a till payout to an expense category (or to "not an expense"). */
export async function classifyOutflow(outflowId: number, form: FormData) {
  await requireOwner();
  const raw = String(form.get("categoryId") ?? "");
  const categoryId = raw === "" ? null : formId(form, "categoryId");
  if (raw !== "" && (!categoryId || !categoryExists(categoryId))) return;
  db.update(schema.cashOutflows).set({ categoryId }).where(eq(schema.cashOutflows.id, outflowId)).run();
  revalidate();
}

export async function addCategory(form: FormData) {
  await requireOwner();
  const nameFr = formText(form, "nameFr", 100);
  if (!nameFr) return;
  const sort = db.select().from(schema.expenseCategories).all().length;
  db.insert(schema.expenseCategories).values({ nameFr, nameAr: formText(form, "nameAr", 100), sort }).run();
  revalidate();
}
