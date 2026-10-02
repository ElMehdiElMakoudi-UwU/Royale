"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { FACTORY_ENTRY_KINDS, PAYMENT_METHODS } from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { formAmount, formDate, formText } from "@/lib/form";

export async function addFactoryEntry(form: FormData) {
  const owner = await requireOwner();
  const kind = FACTORY_ENTRY_KINDS.find((k) => k === form.get("kind"));
  const method = PAYMENT_METHODS.find((m) => m === form.get("method")) ?? null;
  const date = formDate(form);
  const amount = formAmount(form);
  if (!kind || !date || !amount) return;
  db.insert(schema.factoryEntries)
    .values({
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
  await requireOwner();
  db.delete(schema.factoryEntries).where(eq(schema.factoryEntries.id, id)).run();
  revalidatePath("/factory");
  revalidatePath("/");
}
