import "server-only";
import { cookies } from "next/headers";
import ar from "./ar";
import fr, { type Dict } from "./fr";

export type Locale = "fr" | "ar";
export const LOCALE_COOKIE = "locale";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return value === "ar" ? "ar" : "fr";
}

export async function getDict(): Promise<{ t: Dict; locale: Locale }> {
  const locale = await getLocale();
  return { t: locale === "ar" ? ar : fr, locale };
}

export type { Dict };
