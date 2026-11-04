"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { FACTORY_ENTRY_KINDS, PAYMENT_METHODS } from "@/db/schema";
import { formAmount, formDate, formText } from "@/lib/form";
import { requireOwnerShop } from "@/lib/shop";

export async function addFactoryEntry(form: FormData) {
  const { owner, shop } = await requireOwnerShop();
  const kind = FACTORY_ENTRY_KINDS.find((k) => k === form.get("kind"));
  const method = PAYMENT_METHODS.find((m) => m === form.get("method")) ?? null;
  const date = formDate(form);
  const amount = formAmount(form);
  if (!kind || !date || !amount) return;
  db.insert(schema.factoryEntries)
    .values({
      shopId: shop.id,
      kind,
      date,
      amount,
      method: kind === "payment" ? method : null,
      reference: formText(form, "reference", 100),
      note: formText(form, "note"),
      createdBy: owner.id,
    })
    .run();
  revalidatePath("/factory");
  revalidatePath("/");
}

export async function deleteFactoryEntry(id: number) {
  const { shop } = await requireOwnerShop();
  db.delete(schema.factoryEntries).where(and(eq(schema.factoryEntries.id, id), eq(schema.factoryEntries.shopId, shop.id))).run();
  revalidatePath("/factory");
  revalidatePath("/");
}
