"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { hashPassword, requireOwner, revokeSessions } from "@/lib/auth";
import { formId } from "@/lib/form";
import { getShop } from "@/lib/shop";

export type UserFormState = { error?: "required" | "invalid" | "usernameTaken"; ok?: number };

const MIN_PASSWORD = 6;

export async function createUser(_prev: UserFormState, form: FormData): Promise<UserFormState> {
  await requireOwner();
  const name = String(form.get("name") ?? "").trim();
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const role = form.get("role") === "owner" ? "owner" : "staff";
  const shopId = role === "staff" ? formId(form, "shopId") : null;

  if (!name || !username || !password) return { error: "required" };
  if (!/^[a-z0-9._-]{2,32}$/.test(username) || password.length < MIN_PASSWORD) return { error: "invalid" };
  if (role === "staff" && (!shopId || !getShop(shopId))) return { error: "required" };
  if (db.select().from(schema.users).where(eq(schema.users.username, username)).get()) {
    return { error: "usernameTaken" };
  }

  db.insert(schema.users).values({ name, username, role, shopId, passwordHash: await hashPassword(password) }).run();
  revalidatePath("/users");
  return { ok: Date.now() };
}

export async function resetPassword(userId: number, _prev: UserFormState, form: FormData): Promise<UserFormState> {
  await requireOwner();
  const password = String(form.get("password") ?? "");
  if (password.length < MIN_PASSWORD) return { error: "invalid" };
  db.update(schema.users).set({ passwordHash: await hashPassword(password) }).where(eq(schema.users.id, userId)).run();
  revokeSessions(userId);
  return { ok: Date.now() };
}

/** Moves a staff member to another shop. */
export async function setUserShop(userId: number, form: FormData) {
  await requireOwner();
  const shopId = formId(form, "shopId");
  if (!shopId || !getShop(shopId)) return;
  db.update(schema.users).set({ shopId }).where(and(eq(schema.users.id, userId), eq(schema.users.role, "staff"))).run();
  revalidatePath("/users");
}

export async function setActive(userId: number, active: boolean) {
  const owner = await requireOwner();
  if (userId === owner.id) return;
  db.update(schema.users).set({ active }).where(eq(schema.users.id, userId)).run();
  if (!active) revokeSessions(userId);
  revalidatePath("/users");
}
