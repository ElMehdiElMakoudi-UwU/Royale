"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { POS_PAYMENTS } from "@/db/schema";
import { today } from "@/lib/format";
import { getShop, requireOwnerShop, requireShop } from "@/lib/shop";

const saleSchema = z.object({
  // The shop the register was open on. Missing on sales queued offline before shops existed.
  shopId: z.number().int().positive().optional(),
  clientId: z.string().regex(/^[a-zA-Z0-9-]{8,64}$/),
  soldAt: z.string().datetime(),
  payment: z.enum(POS_PAYMENTS),
  cashGiven: z.number().int().min(0).nullable(),
  lines: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        label: z.string().min(1).max(200),
        qty: z.number().finite().positive().max(10000),
        unitPrice: z.number().int().min(0).max(10_000_000),
      }),
    )
    .min(1)
    .max(200),
});
export type SaleInput = z.infer<typeof saleSchema>;
export type SaleResult = { ok: true; id: number } | { ok: false; error: "invalid" };

/**
 * Stores a sale made on the register. Idempotent on clientId: the tablet may resend a sale
 * it queued while offline, or retry after a timeout that actually succeeded.
 */
export async function recordSale(input: SaleInput): Promise<SaleResult> {
  const { user, shop } = await requireShop();
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const sale = parsed.data;

  const existing = db.select({ id: schema.posSales.id }).from(schema.posSales).where(eq(schema.posSales.clientId, sale.clientId)).get();
  if (existing) return { ok: true, id: existing.id };

  const ids = [...new Set(sale.lines.map((l) => l.productId))];
  const found = db.select({ id: schema.products.id }).from(schema.products).where(inArray(schema.products.id, ids)).all();
  if (found.length !== ids.length) return { ok: false, error: "invalid" };

  // Staff always sell for their shop. The owner may have switched shop since this sale was queued.
  const shopId = user.role === "owner" && sale.shopId && getShop(sale.shopId) ? sale.shopId : shop.id;

  const lines = sale.lines.map((l) => ({ ...l, total: Math.round(l.qty * l.unitPrice) }));
  const total = lines.reduce((s, l) => s + l.total, 0);
  const soldAt = new Date(sale.soldAt);
  // A sale queued offline keeps the day it was really made.
  const date = today(soldAt.getTime() > Date.now() ? new Date() : soldAt);

  const id = db.transaction((tx) => {
    const row = tx
      .insert(schema.posSales)
      .values({
        shopId,
        clientId: sale.clientId,
        date,
        soldAt: soldAt.toISOString(),
        cashierId: user.id,
        total,
        payment: sale.payment,
        cashGiven: sale.payment === "cash" ? sale.cashGiven : null,
      })
      .returning({ id: schema.posSales.id })
      .get();
    tx.insert(schema.posSaleLines).values(lines.map((l) => ({ ...l, saleId: row.id }))).run();
    return row.id;
  });

  revalidatePath("/tickets");
  return { ok: true, id };
}

export async function voidSale(id: number, form: FormData) {
  const { owner, shop } = await requireOwnerShop();
  const reason = String(form.get("reason") ?? "").trim().slice(0, 200);
  if (!reason) return;
  db.update(schema.posSales)
    .set({ status: "voided", voidedBy: owner.id, voidReason: reason })
    .where(and(eq(schema.posSales.id, id), eq(schema.posSales.shopId, shop.id), eq(schema.posSales.status, "completed")))
    .run();
  revalidatePath("/tickets");
  revalidatePath("/sales");
  revalidatePath("/cash");
}
