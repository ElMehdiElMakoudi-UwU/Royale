"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireOwner } from "@/lib/auth";
import { formAmount, formDate, formId, formText } from "@/lib/form";
import { requireOwnerShop } from "@/lib/shop";

function revalidate() {
  revalidatePath("/expenses");
  revalidatePath("/report");
}

const categoryExists = (id: number) =>
  Boolean(db.select().from(schema.expenseCategories).where(eq(schema.expenseCategories.id, id)).get());

export async function addExpense(form: FormData) {
  const { owner, shop } = await requireOwnerShop();
  const date = formDate(form);
  const amount = formAmount(form);
  const categoryId = formId(form, "categoryId");
  const label = formText(form, "label", 200);
  if (!date || !amount || !categoryId || !label || !categoryExists(categoryId)) return;
  db.insert(schema.expenses).values({ shopId: shop.id, date, amount, categoryId, label, createdBy: owner.id }).run();
  revalidate();
}

export async function deleteExpense(id: number) {
  const { shop } = await requireOwnerShop();
  db.delete(schema.expenses).where(and(eq(schema.expenses.id, id), eq(schema.expenses.shopId, shop.id))).run();
  revalidate();
}

/** Assigns a till payout to an expense category (or to "not an expense"). */
export async function classifyOutflow(outflowId: number, form: FormData) {
  const { shop } = await requireOwnerShop();
  const raw = String(form.get("categoryId") ?? "");
  const categoryId = raw === "" ? null : formId(form, "categoryId");
  if (raw !== "" && (!categoryId || !categoryExists(categoryId))) return;
  const outflow = db
    .select({ id: schema.cashOutflows.id })
    .from(schema.cashOutflows)
    .innerJoin(schema.cashClosings, eq(schema.cashClosings.id, schema.cashOutflows.closingId))
    .where(and(eq(schema.cashOutflows.id, outflowId), eq(schema.cashClosings.shopId, shop.id)))
    .get();
  if (!outflow) return;
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
