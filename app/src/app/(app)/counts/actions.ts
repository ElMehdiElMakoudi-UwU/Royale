"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { COUNT_TYPES } from "@/db/schema";
import { requireOwner, requireUser } from "@/lib/auth";
import { today } from "@/lib/format";

const linesSchema = z
  .array(z.object({ productId: z.number().int().positive(), qty: z.number().finite().min(0).max(100000) }))
  .max(1000);

const countSchema = z.object({
  type: z.enum(COUNT_TYPES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(1000),
  lines: linesSchema,
});

export type SaveResult = { ok: true; id: number } | { ok: false; error: string };

function checkProducts(productIds: number[]) {
  if (productIds.length === 0) return true;
  const found = db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(inArray(schema.products.id, productIds))
    .all();
  return found.length === new Set(productIds).size;
}

export async function submitCount(input: z.infer<typeof countSchema>): Promise<SaveResult> {
  const user = await requireUser();
  const parsed = countSchema.safeParse(input);
  if (!parsed.success || !checkProducts(parsed.data.lines.map((l) => l.productId))) {
    return { ok: false, error: "invalid" };
  }
  const { type, note, lines } = parsed.data;
  // Staff always count for today; only the owner can back-date a count.
  const date = user.role === "owner" ? parsed.data.date : today();

  const id = db.transaction((tx) => {
    const count = tx
      .insert(schema.counts)
      .values({ type, date, note: note.trim(), createdBy: user.id })
      .returning({ id: schema.counts.id })
      .get();
    if (lines.length > 0) {
      tx.insert(schema.countLines).values(lines.map((l) => ({ ...l, countId: count.id }))).run();
    }
    return count.id;
  });

  revalidatePath("/counts");
  revalidatePath("/");
  return { ok: true, id };
}

/** Owner correction of a count that hasn't been validated yet: replaces all its lines. */
export async function updateCount(id: number, input: z.infer<typeof countSchema>): Promise<SaveResult> {
  await requireOwner();
  const parsed = countSchema.safeParse(input);
  if (!parsed.success || !checkProducts(parsed.data.lines.map((l) => l.productId))) {
    return { ok: false, error: "invalid" };
  }
  const existing = db.select().from(schema.counts).where(eq(schema.counts.id, id)).get();
  if (!existing || existing.status === "validated") return { ok: false, error: "locked" };

  const { type, date, note, lines } = parsed.data;
  db.transaction((tx) => {
    tx.update(schema.counts).set({ type, date, note: note.trim() }).where(eq(schema.counts.id, id)).run();
    tx.delete(schema.countLines).where(eq(schema.countLines.countId, id)).run();
    if (lines.length > 0) {
      tx.insert(schema.countLines).values(lines.map((l) => ({ ...l, countId: id }))).run();
    }
  });

  revalidatePath("/counts");
  revalidatePath(`/counts/${id}`);
  return { ok: true, id };
}

export async function validateCount(id: number) {
  const owner = await requireOwner();
  db.update(schema.counts)
    .set({ status: "validated", validatedBy: owner.id, validatedAt: new Date().toISOString() })
    .where(and(eq(schema.counts.id, id), eq(schema.counts.status, "submitted")))
    .run();
  revalidatePath("/counts");
  revalidatePath(`/counts/${id}`);
  revalidatePath("/");
}

/** Lets the owner reopen a validated count to fix a mistake. */
export async function reopenCount(id: number) {
  await requireOwner();
  db.update(schema.counts)
    .set({ status: "submitted", validatedBy: null, validatedAt: null })
    .where(eq(schema.counts.id, id))
    .run();
  revalidatePath("/counts");
  revalidatePath(`/counts/${id}`);
  revalidatePath("/");
}
