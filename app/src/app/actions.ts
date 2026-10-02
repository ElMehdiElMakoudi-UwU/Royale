"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { login, logout } from "@/lib/auth";
import { getLocale, LOCALE_COOKIE } from "@/lib/i18n";

export async function toggleLocale() {
  const next = (await getLocale()) === "ar" ? "fr" : "ar";
  (await cookies()).set(LOCALE_COOKIE, next, { path: "/", maxAge: 365 * 24 * 3600 });
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
