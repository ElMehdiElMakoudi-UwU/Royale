"use server";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dataDir, db, schema } from "@/db";
import { aiEnabled, extractDeliveryNote } from "@/lib/extract";
import { parseMoney, today } from "@/lib/format";
import { listProducts } from "@/lib/queries";
import { matchProduct, normalizeName } from "@/lib/reconcile";
import { requireOwnerShop } from "@/lib/shop";

const photoDir = (deliveryId: number) => path.join(dataDir, "uploads", "deliveries", String(deliveryId));

function revalidate(id?: number) {
  revalidatePath("/deliveries");
  if (id) revalidatePath(`/deliveries/${id}`);
  revalidatePath("/");
}

export async function createDelivery() {
  const { owner, shop } = await requireOwnerShop();
  const row = db
    .insert(schema.deliveries)
    .values({ shopId: shop.id, date: today(), createdBy: owner.id })
    .returning({ id: schema.deliveries.id })
    .get();
  redirect(`/deliveries/${row.id}/edit`);
}

const saveSchema = z.object({
  blNumber: z.string().max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  declaredTotal: z.number().int().min(0).nullable(),
  note: z.string().max(1000),
  lines: z
    .array(
      z.object({
        designation: z.string().trim().min(1).max(200),
        productId: z.number().int().positive().nullable(),
        qty: z.number().finite().min(0).max(100000),
        unitPrice: z.number().int().min(0),
        amount: z.number().int().min(0).nullable(),
      }),
    )
    .max(300),
});
export type SaveDeliveryInput = z.infer<typeof saveSchema>;
export type SaveDeliveryResult = { ok: true } | { ok: false; error: "invalid" | "locked" | "duplicate"; otherId?: number };

export async function saveDelivery(id: number, input: SaveDeliveryInput): Promise<SaveDeliveryResult> {
  const { shop } = await requireOwnerShop();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const existing = db.select().from(schema.deliveries).where(and(eq(schema.deliveries.id, id), eq(schema.deliveries.shopId, shop.id))).get();
  if (!existing || existing.status !== "draft") return { ok: false, error: "locked" };

  const { lines, ...header } = parsed.data;
  const blNumber = header.blNumber.trim().toUpperCase();
  if (blNumber) {
    const other = db
      .select({ id: schema.deliveries.id })
      .from(schema.deliveries)
      .where(and(eq(schema.deliveries.shopId, shop.id), eq(schema.deliveries.blNumber, blNumber), ne(schema.deliveries.id, id)))
      .get();
    if (other) return { ok: false, error: "duplicate", otherId: other.id };
  }

  const products = new Map(listProducts({ includeInactive: true }).map((p) => [p.id, p]));
  if (lines.some((l) => l.productId != null && !products.has(l.productId))) return { ok: false, error: "invalid" };

  db.transaction((tx) => {
    tx.update(schema.deliveries)
      .set({ ...header, blNumber, note: header.note.trim() })
      .where(eq(schema.deliveries.id, id))
      .run();
    tx.delete(schema.deliveryLines).where(eq(schema.deliveryLines.deliveryId, id)).run();
    if (lines.length > 0) {
      tx.insert(schema.deliveryLines)
        .values(lines.map((l, position) => ({ ...l, deliveryId: id, position })))
        .run();
    }

    // Learn the factory's wording: next time this designation is matched automatically.
    for (const l of lines) {
      if (l.productId == null) continue;
      const p = products.get(l.productId)!;
      const key = normalizeName(l.designation);
      const known = [p.nameFr, ...p.aliases].some((n) => normalizeName(n) === key);
      if (!known) {
        p.aliases = [...p.aliases, l.designation.trim()];
        tx.update(schema.products).set({ aliases: p.aliases }).where(eq(schema.products.id, p.id)).run();
      }
    }
  });

  revalidate(id);
  revalidatePath("/products");
  return { ok: true };
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

export type ExtractedLine = SaveDeliveryInput["lines"][number];
export type UploadResult =
  | {
      ok: true;
      photos: { id: number }[];
      extracted?: { blNumber: string | null; date: string | null; declaredTotal: number | null; lines: ExtractedLine[] };
      readError?: "noKey" | "failed";
    }
  | { ok: false; error: "invalid" | "locked" };

/** Stores the photos of a delivery note and, when asked, reads them with Claude. */
export async function uploadPhotos(id: number, form: FormData): Promise<UploadResult> {
  const { shop } = await requireOwnerShop();
  const delivery = db.select().from(schema.deliveries).where(and(eq(schema.deliveries.id, id), eq(schema.deliveries.shopId, shop.id))).get();
  if (!delivery) return { ok: false, error: "invalid" };
  if (delivery.status !== "draft") return { ok: false, error: "locked" };

  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0 || files.length > 10 || files.some((f) => !IMAGE_TYPES.includes(f.type as ImageType))) {
    return { ok: false, error: "invalid" };
  }

  const dir = photoDir(id);
  fs.mkdirSync(dir, { recursive: true });
  const images: { data: Buffer; mediaType: ImageType }[] = [];
  const photos: { id: number }[] = [];
  for (const f of files) {
    const data = Buffer.from(await f.arrayBuffer());
    const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
    const filename = `${crypto.randomUUID()}.${ext}`;
    fs.writeFileSync(path.join(dir, filename), data);
    photos.push(
      db.insert(schema.deliveryPhotos).values({ deliveryId: id, filename }).returning({ id: schema.deliveryPhotos.id }).get(),
    );
    images.push({ data, mediaType: f.type as ImageType });
  }
  revalidate(id);

  if (form.get("read") !== "1") return { ok: true, photos };
  if (!aiEnabled()) return { ok: true, photos, readError: "noKey" };

  try {
    const note = await extractDeliveryNote(images);
    const products = listProducts({ includeInactive: true });
    const toCentimes = (dh: number | null) => (dh == null ? null : Math.round(dh * 100));
    return {
      ok: true,
      photos,
      extracted: {
        blNumber: note.bl_number,
        date: note.delivery_date && /^\d{4}-\d{2}-\d{2}$/.test(note.delivery_date) ? note.delivery_date : null,
        declaredTotal: toCentimes(note.total),
        lines: note.lines.map((l) => ({
          designation: l.designation,
          productId: matchProduct(l.designation, products)?.id ?? null,
          qty: l.qty,
          unitPrice: toCentimes(l.unit_price) ?? 0,
          amount: toCentimes(l.amount),
        })),
      },
    };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: true, photos, readError: "noKey" };
    console.error("Delivery note reading failed:", e);
    return { ok: true, photos, readError: "failed" };
  }
}

export async function deletePhoto(photoId: number) {
  const { shop } = await requireOwnerShop();
  const photo = db
    .select({ id: schema.deliveryPhotos.id, deliveryId: schema.deliveryPhotos.deliveryId, filename: schema.deliveryPhotos.filename })
    .from(schema.deliveryPhotos)
    .innerJoin(schema.deliveries, eq(schema.deliveries.id, schema.deliveryPhotos.deliveryId))
    .where(and(eq(schema.deliveryPhotos.id, photoId), eq(schema.deliveries.shopId, shop.id)))
    .get();
  if (!photo) return;
  fs.rmSync(path.join(photoDir(photo.deliveryId), photo.filename), { force: true });
  db.delete(schema.deliveryPhotos).where(eq(schema.deliveryPhotos.id, photoId)).run();
  revalidate(photo.deliveryId);
}

export async function validateDelivery(id: number, form: FormData) {
  const { shop } = await requireOwnerShop();
  let accepted: number | null;
  try {
    accepted = parseMoney(form.get("acceptedTotal"));
  } catch {
    return;
  }
  if (accepted == null) return;
  db.update(schema.deliveries)
    .set({ status: "checked", acceptedTotal: accepted, checkedAt: new Date().toISOString() })
    .where(and(eq(schema.deliveries.id, id), eq(schema.deliveries.shopId, shop.id), eq(schema.deliveries.status, "draft")))
    .run();
  revalidate(id);
}

export async function reopenDelivery(id: number) {
  const { shop } = await requireOwnerShop();
  db.update(schema.deliveries)
    .set({ status: "draft", acceptedTotal: null, checkedAt: null })
    .where(and(eq(schema.deliveries.id, id), eq(schema.deliveries.shopId, shop.id)))
    .run();
  revalidate(id);
}

export async function deleteDelivery(id: number) {
  const { shop } = await requireOwnerShop();
  const d = db.select().from(schema.deliveries).where(and(eq(schema.deliveries.id, id), eq(schema.deliveries.shopId, shop.id))).get();
  if (!d || d.status !== "draft") return;
  db.delete(schema.deliveries).where(eq(schema.deliveries.id, id)).run();
  fs.rmSync(photoDir(id), { recursive: true, force: true });
  revalidate();
  redirect("/deliveries");
}
