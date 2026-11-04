"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { login, logout, requireOwner } from "@/lib/auth";
import { getLocale, LOCALE_COOKIE } from "@/lib/i18n";
import { getShop } from "@/lib/shop";
import { SHOP_COOKIE } from "@/lib/shop-cookie";

export async function toggleLocale() {
  const next = (await getLocale()) === "ar" ? "fr" : "ar";
  (await cookies()).set(LOCALE_COOKIE, next, { path: "/", maxAge: 365 * 24 * 3600 });
}

/** Owner only: makes this the shop being worked in, then opens `to` (a page of this app). */
export async function switchShop(shopId: number, to: string) {
  await requireOwner();
  if (!getShop(shopId)) return;
  (await cookies()).set(SHOP_COOKIE, String(shopId), { path: "/", sameSite: "lax", maxAge: 365 * 24 * 3600 });
  redirect(/^\/(?!\/)/.test(to) ? to : "/");
}

export async function loginAction(_prev: { error: boolean }, form: FormData) {
  const ok = await login(String(form.get("username") ?? ""), String(form.get("password") ?? ""));
  if (!ok) return { error: true };
  redirect("/");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
