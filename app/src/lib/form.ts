import { parseMoney } from "./format";

/** Reads common form fields; returns null when a value is missing or malformed. */
export const formDate = (form: FormData, name = "date") => {
  const v = String(form.get(name) ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};
export const formMonth = (form: FormData, name = "month") => {
  const v = String(form.get(name) ?? "");
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null;
};
export const formText = (form: FormData, name: string, max = 500) => String(form.get(name) ?? "").trim().slice(0, max);
/** Positive amount in centimes, or null. */
export const formAmount = (form: FormData, name = "amount") => {
  try {
    const v = parseMoney(form.get(name));
    return v != null && v > 0 ? v : null;
  } catch {
    return null;
  }
};
export const formId = (form: FormData, name: string) => {
  const n = Number(form.get(name));
  return Number.isInteger(n) && n > 0 ? n : null;
};
