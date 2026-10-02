"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { UNITS, type Unit } from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { parseMoney } from "@/lib/format";

export type ProductFormState = { error?: "required" | "invalid" };

export async function saveProduct(
  id: number | null,
  _prev: ProductFormState,
  form: FormData,
): Promise<ProductFormState> {
  await requireOwner();

  const nameFr = String(form.get("nameFr") ?? "").trim();
  const nameAr = String(form.get("nameAr") ?? "").trim();
  const unit = String(form.get("unit")) as Unit;
  const categoryRaw = String(form.get("categoryId") ?? "");
  const categoryId = categoryRaw ? Number(categoryRaw) : null;
  const aliases = String(form.get("aliases") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const active = form.get("active") === "on";

  if (!nameFr) return { error: "required" };
  if (!UNITS.includes(unit) || (categoryId != null && !Number.isInteger(categoryId))) return { error: "invalid" };

  let purchasePrice: number | null;
  let salePrice: number | null;
  try {
    purchasePrice = parseMoney(form.get("purchasePrice"));
    salePrice = parseMoney(form.get("salePrice"));
  } catch {
    return { error: "invalid" };
  }

  const values = { nameFr, nameAr, unit, categoryId, aliases, active, purchasePrice, salePrice };
  if (id == null) {
    db.insert(schema.products).values(values).run();
  } else {
    db.update(schema.products).set(values).where(eq(schema.products.id, id)).run();
  }
  revalidatePath("/products");
  revalidatePath("/");
  redirect("/products");
}
