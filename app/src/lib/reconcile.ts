import type { Product } from "@/db/schema";

/** Lowercase, no accents, single spaces — so "Gt  Pistacha" matches "gt pistacha". */
export function normalizeName(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Finds the catalog product a factory designation refers to (by alias first, then name). */
export function matchProduct(designation: string, products: Product[]): Product | null {
  const key = normalizeName(designation);
  if (!key) return null;
  return (
    products.find((p) => p.aliases.some((a) => normalizeName(a) === key)) ??
    products.find((p) => normalizeName(p.nameFr) === key) ??
    null
  );
}

export type ReconLineInput = {
  designation: string;
  productId: number | null;
  qty: number;
  unitPrice: number;
  amount: number | null;
};

export type ReconLine = ReconLineInput & {
  product: Product | null;
  /** Agreed purchase price from the catalog (centimes), if known. */
  agreedPrice: number | null;
  priceDiff: number | null;
  /** qty × unit price ≠ printed amount. */
  mathError: boolean;
  computedAmount: number;
};

export type ReconProduct = {
  product: Product;
  invoiced: number;
  counted: number | null;
  diff: number | null;
};

export type Reconciliation = {
  lines: ReconLine[];
  /** Per product: invoiced vs counted quantities (only when a delivery count exists). */
  products: ReconProduct[];
  /** Counted on delivery but not on the note. */
  notInvoiced: { product: Product; counted: number }[];
  hasCount: boolean;
  sumOfLines: number;
  declaredTotal: number | null;
  totalMismatch: boolean;
  invoicedTotal: number;
  /** What the shop should owe: counted quantities × agreed prices. */
  correctTotal: number;
  issues: number;
};

const round = (n: number) => Math.round(n * 1000) / 1000;

export function reconcile(
  input: ReconLineInput[],
  declaredTotal: number | null,
  products: Map<number, Product>,
  counted: Map<number, number> | null,
): Reconciliation {
  const lines: ReconLine[] = input.map((l) => {
    const product = l.productId != null ? (products.get(l.productId) ?? null) : null;
    const agreedPrice = product?.purchasePrice ?? null;
    const computedAmount = Math.round(l.qty * l.unitPrice);
    return {
      ...l,
      product,
      agreedPrice,
      priceDiff: agreedPrice != null && agreedPrice !== l.unitPrice ? l.unitPrice - agreedPrice : null,
      mathError: l.amount != null && Math.abs(l.amount - computedAmount) >= 1,
      computedAmount,
    };
  });

  const invoicedQty = new Map<number, number>();
  for (const l of lines) {
    if (l.product) invoicedQty.set(l.product.id, (invoicedQty.get(l.product.id) ?? 0) + l.qty);
  }

  const reconProducts: ReconProduct[] = [...invoicedQty].map(([id, invoiced]) => {
    const c = counted ? (counted.get(id) ?? 0) : null;
    return { product: products.get(id)!, invoiced, counted: c, diff: c == null ? null : round(c - invoiced) };
  });

  const notInvoiced = counted
    ? [...counted]
        .filter(([id, qty]) => qty > 0 && !invoicedQty.has(id) && products.has(id))
        .map(([id, qty]) => ({ product: products.get(id)!, counted: qty }))
    : [];

  const sumOfLines = lines.reduce((s, l) => s + (l.amount ?? l.computedAmount), 0);
  const totalMismatch = declaredTotal != null && Math.abs(declaredTotal - sumOfLines) >= 1;

  // Correct amount: for each product on the note, the quantity actually received (if counted)
  // at the agreed price (or the invoiced price when the catalog has none).
  // Lines that couldn't be matched to a product are kept as printed.
  let correctTotal = 0;
  const seen = new Set<number>();
  for (const l of lines) {
    if (!l.product) {
      correctTotal += l.amount ?? l.computedAmount;
      continue;
    }
    if (seen.has(l.product.id)) continue;
    seen.add(l.product.id);
    const sameProduct = lines.filter((x) => x.product?.id === l.product!.id);
    const qty = counted ? (counted.get(l.product.id) ?? 0) : invoicedQty.get(l.product.id)!;
    // Several lines for one product: use the lowest price charged when no agreed price exists.
    const price = l.agreedPrice ?? Math.min(...sameProduct.map((x) => x.unitPrice));
    correctTotal += Math.round(qty * price);
  }

  const issues =
    lines.filter((l) => !l.product || l.priceDiff != null || l.mathError).length +
    reconProducts.filter((p) => p.diff != null && p.diff !== 0).length +
    notInvoiced.length +
    (totalMismatch ? 1 : 0);

  return {
    lines,
    products: reconProducts,
    notInvoiced,
    hasCount: counted != null,
    sumOfLines,
    declaredTotal,
    totalMismatch,
    invoicedTotal: declaredTotal ?? sumOfLines,
    correctTotal,
    issues,
  };
}

const dh = (c: number) =>
  (c / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n = (q: number) => q.toLocaleString("fr-FR", { maximumFractionDigits: 3 });

/** Ready-to-send message (in French, the factory's language) listing what to correct. */
export function claimMessage(r: Reconciliation, blNumber: string, date: string) {
  const [y, m, d] = date.split("-");
  const out: string[] = [];
  const designationOf = (productId: number) =>
    r.lines.find((l) => l.product?.id === productId)?.designation ?? "";

  for (const p of r.products) {
    if (p.diff == null || p.diff === 0) continue;
    out.push(`- ${designationOf(p.product.id)} : facturé ${n(p.invoiced)}, reçu ${n(p.counted!)}`);
  }
  for (const l of r.lines) {
    if (l.priceDiff != null) {
      out.push(`- ${l.designation} : P.U. facturé ${dh(l.unitPrice)} au lieu de ${dh(l.agreedPrice!)}`);
    }
    if (l.mathError) {
      out.push(`- ${l.designation} : montant ${dh(l.amount!)} au lieu de ${dh(l.computedAmount)} (${n(l.qty)} × ${dh(l.unitPrice)})`);
    }
  }
  for (const x of r.notInvoiced) {
    out.push(`- ${x.product.aliases[0] ?? x.product.nameFr} : reçu ${n(x.counted)}, non facturé`);
  }
  if (r.totalMismatch) {
    out.push(`- Total du bon ${dh(r.declaredTotal!)} ≠ somme des lignes ${dh(r.sumOfLines)}`);
  }
  if (out.length === 0) return "";

  return [
    `Bonjour, concernant le bon ${blNumber || "de livraison"} du ${d}/${m}/${y} :`,
    ...out,
    "",
    `Montant facturé : ${dh(r.invoicedTotal)} DH`,
    `Montant correct : ${dh(r.correctTotal)} DH`,
    "Merci de corriger.",
  ].join("\n");
}
