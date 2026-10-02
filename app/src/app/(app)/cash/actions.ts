"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireOwner, requireUser } from "@/lib/auth";
import { today } from "@/lib/format";

const money = z.number().int().min(0).max(100_000_000);
const closingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  openingFloat: money,
  cashCounted: money,
  card: money,
  note: z.string().max(1000),
  outflows: z.array(z.object({ label: z.string().trim().min(1).max(200), amount: money })).max(50),
});
export type ClosingInput = z.infer<typeof closingSchema>;
export type ClosingResult = { ok: true; id: number } | { ok: false; error: "invalid" | "exists" | "locked" };

function revalidate(id?: number) {
  revalidatePath("/cash");
  revalidatePath("/sales");
  revalidatePath("/");
  if (id) revalidatePath(`/cash/${id}`);
}

/** Creates a closing, or (owner only) corrects one that isn't validated yet. */
export async function saveClosing(id: number | null, input: ClosingInput): Promise<ClosingResult> {
  const user = await requireUser();
  const parsed = closingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { outflows, ...data } = parsed.data;
  const isOwner = user.role === "owner";
  // Staff always close today's till; only the owner can enter another day.
  if (!isOwner) data.date = today();

  if (id != null) {
    if (!isOwner) return { ok: false, error: "locked" };
    const existing = db.select().from(schema.cashClosings).where(eq(schema.cashClosings.id, id)).get();
    if (!existing || existing.status === "validated") return { ok: false, error: "locked" };
  }
  const clash = db
    .select({ id: schema.cashClosings.id })
    .from(schema.cashClosings)
    .where(id == null ? eq(schema.cashClosings.date, data.date) : and(eq(schema.cashClosings.date, data.date), ne(schema.cashClosings.id, id)))
    .get();
  if (clash) return { ok: false, error: "exists" };

  const savedId = db.transaction((tx) => {
    let closingId = id;
    if (closingId == null) {
      closingId = tx
        .insert(schema.cashClosings)
        .values({ ...data, note: data.note.trim(), createdBy: user.id })
        .returning({ id: schema.cashClosings.id })
        .get().id;
    } else {
      tx.update(schema.cashClosings).set({ ...data, note: data.note.trim() }).where(eq(schema.cashClosings.id, closingId)).run();
      tx.delete(schema.cashOutflows).where(eq(schema.cashOutflows.closingId, closingId)).run();
    }
    if (outflows.length > 0) {
      tx.insert(schema.cashOutflows).values(outflows.map((o) => ({ ...o, closingId: closingId! }))).run();
    }
    return closingId;
  });

  revalidate(savedId);
  return { ok: true, id: savedId };
}

export async function validateClosing(id: number) {
  const owner = await requireOwner();
  db.update(schema.cashClosings)
    .set({ status: "validated", validatedBy: owner.id })
    .where(eq(schema.cashClosings.id, id))
    .run();
  revalidate(id);
}

export async function reopenClosing(id: number) {
  await requireOwner();
  db.update(schema.cashClosings).set({ status: "submitted", validatedBy: null }).where(eq(schema.cashClosings.id, id)).run();
  revalidate(id);
}
