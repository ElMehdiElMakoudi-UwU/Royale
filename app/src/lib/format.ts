import type { Locale } from "./i18n";

type Named = { nameFr: string; nameAr: string };

/** Product/category label in the current language, falling back to French. */
export function label(item: Named, locale: Locale) {
  return locale === "ar" && item.nameAr ? item.nameAr : item.nameFr;
}

/** Centimes → "1 234,50" (always Latin digits so numbers read the same for everyone). */
export function money(centimes: number | null | undefined) {
  if (centimes == null) return "—";
  return (centimes / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** "12,50" or "12.5" → 1250 centimes; empty → null. */
export function parseMoney(input: FormDataEntryValue | null): number | null {
  const s = String(input ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) throw new Error("invalid");
  return Math.round(n * 100);
}

export function qty(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

/** Business date in Morocco (YYYY-MM-DD) of a moment; defaults to now. */
export function today(at: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(at);
}

export function dateLabel(iso: string, locale: Locale) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(
    locale === "ar" ? "ar-MA-u-nu-latn" : "fr-FR",
    { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" },
  );
}

/** "2026-10" → "octobre 2026" / "أكتوبر 2026". */
export function monthLabel(month: string, locale: Locale) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale === "ar" ? "ar-MA-u-nu-latn" : "fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
