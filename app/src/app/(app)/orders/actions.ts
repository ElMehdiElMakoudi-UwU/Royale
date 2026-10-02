"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { OCCASIONS, ORDER_PAYMENT_METHODS, type OrderStatus } from "@/db/schema";
import { requireOwner, requireUser } from "@/lib/auth";
import { today } from "@/lib/format";
import { formAmount, formDate, formId } from "@/lib/form";
import { paidByOrder } from "@/lib/orders";
import { listProducts } from "@/lib/queries";

function revalidate(id?: number) {
  revalidatePath("/orders");
  revalidatePath("/");
  revalidatePath("/cash");
  revalidatePath("/report");
  if (id) revalidatePath(`/orders/${id}`);
}

const money = z.number().int().min(0).max(100_000_000);
const orderSchema = z.object({
  customerName: z.string().trim().min(1).max(100),
  customerPhone: z.string().trim().max(30),
  occasion: z.enum(OCCASIONS),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickupTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  deliveryAddress: z.string().trim().max(300),
  note: z.string().trim().max(2000),
  lines: z
    .array(
      z.object({
        productId: z.number().int().positive().nullable(),
        label: z.string().trim().min(1).max(200),
        qty: z.number().finite().positive().max(10000),
        unitPrice: money,
      }),
    )
    .min(1)
    .max(100),
  // Deposit taken when the order is first recorded.
  deposit: z.object({ amount: money, method: z.enum(ORDER_PAYMENT_METHODS) }).nullable(),
});
export type OrderInput = z.infer<typeof orderSchema>;
export type OrderResult = { ok: true; id: number } | { ok: false; error: "invalid" | "locked" };

/** Creates an order, or edits one that hasn't been handed over or cancelled yet. */
export async function saveOrder(id: number | null, input: OrderInput): Promise<OrderResult> {
  const user = await requireUser();
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { lines, deposit, ...data } = parsed.data;

  if (id != null) {
    const existing = db.select().from(schema.orders).where(eq(schema.orders.id, id)).get();
    if (!existing || existing.status === "delivered" || existing.status === "cancelled") return { ok: false, error: "locked" };
  }
  const products = new Set(listProducts({ includeInactive: true }).map((p) => p.id));
  if (lines.some((l) => l.productId != null && !products.has(l.productId))) return { ok: false, error: "invalid" };

  const rows = lines.map((l, i) => ({ ...l, position: i, total: Math.round(l.qty * l.unitPrice) }));
  const total = rows.reduce((s, l) => s + l.total, 0);
  if (deposit && deposit.amount > total) return { ok: false, error: "invalid" };
  // An edit can't bring the total below what the customer has already paid.
  if (id != null && total < (paidByOrder([id]).get(id) ?? 0)) return { ok: false, error: "invalid" };

  const savedId = db.transaction((tx) => {
    let orderId = id;
    if (orderId == null) {
      orderId = tx
        .insert(schema.orders)
        .values({ ...data, total, createdBy: user.id })
        .returning({ id: schema.orders.id })
        .get().id;
      if (deposit && deposit.amount > 0) {
        tx.insert(schema.orderPayments).values({ orderId, date: today(), ...deposit, createdBy: user.id }).run();
      }
    } else {
      tx.update(schema.orders).set({ ...data, total }).where(eq(schema.orders.id, orderId)).run();
      tx.delete(schema.orderLines).where(eq(schema.orderLines.orderId, orderId)).run();
    }
    tx.insert(schema.orderLines).values(rows.map((l) => ({ ...l, orderId: orderId! }))).run();
    return orderId;
  });

  revalidate(savedId);
  return { ok: true, id: savedId };
}

export async function addPayment(orderId: number, form: FormData) {
  const user = await requireUser();
  const amount = formAmount(form);
  const method = String(form.get("method") ?? "");
  // Staff record today's payments; the owner can enter one received on another day.
  const date = user.role === "owner" ? (formDate(form) ?? today()) : today();
  if (!amount || !(ORDER_PAYMENT_METHODS as readonly string[]).includes(method)) return;
  const order = db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).get();
  if (!order || order.status === "cancelled") return;
  db.insert(schema.orderPayments)
    .values({ orderId, date, amount, method: method as (typeof ORDER_PAYMENT_METHODS)[number], createdBy: user.id })
    .run();
  revalidate(orderId);
}

export async function deletePayment(orderId: number, form: FormData) {
  await requireOwner();
  const paymentId = formId(form, "paymentId");
  if (!paymentId) return;
  db.delete(schema.orderPayments).where(eq(schema.orderPayments.id, paymentId)).run();
  revalidate(orderId);
}

/** Staff move an order forward (ready, handed over); only the owner cancels or reopens. */
export async function setOrderStatus(orderId: number, status: OrderStatus) {
  const user = await requireUser();
  if (user.role !== "owner" && (status === "cancelled" || status === "pending")) return;
  db.update(schema.orders).set({ status }).where(eq(schema.orders.id, orderId)).run();
  revalidate(orderId);
}

export async function deleteOrder(orderId: number) {
  await requireOwner();
  db.delete(schema.orders).where(eq(schema.orders.id, orderId)).run();
  revalidate();
  redirect("/orders");
}
