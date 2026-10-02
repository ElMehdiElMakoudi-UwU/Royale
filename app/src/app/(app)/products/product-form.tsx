"use client";

import Link from "next/link";
import { useActionState } from "react";
import { UNITS, type Product } from "@/db/schema";
import type { Dict } from "@/lib/i18n/fr";
import { saveProduct } from "./actions";

const price = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2));

export function ProductForm({
  t,
  product,
  categories,
}: {
  t: Pick<Dict, "products" | "common" | "units" | "errors">;
  product?: Product;
  categories: { id: number; label: string }[];
}) {
  const [state, action, pending] = useActionState(saveProduct.bind(null, product?.id ?? null), {});

  return (
    <form action={action} className="card max-w-2xl space-y-5 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="nameFr">{t.products.nameFr} *</label>
          <input id="nameFr" name="nameFr" defaultValue={product?.nameFr} className="field" required />
        </div>
        <div>
          <label className="label" htmlFor="nameAr">{t.products.nameAr}</label>
          <input id="nameAr" name="nameAr" dir="rtl" defaultValue={product?.nameAr} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="categoryId">{t.products.category}</label>
          <select id="categoryId" name="categoryId" defaultValue={product?.categoryId ?? ""} className="field">
            <option value="">{t.products.noCategory}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="unit">{t.products.unit}</label>
          <select id="unit" name="unit" defaultValue={product?.unit ?? "piece"} className="field">
            {UNITS.map((u) => (
              <option key={u} value={u}>{t.units[u]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="purchasePrice">{t.products.purchasePrice} ({t.common.dh})</label>
          <input
            id="purchasePrice"
            name="purchasePrice"
            inputMode="decimal"
            dir="ltr"
            defaultValue={price(product?.purchasePrice)}
            className="field tabular"
          />
        </div>
        <div>
          <label className="label" htmlFor="salePrice">{t.products.salePrice} ({t.common.dh})</label>
          <input
            id="salePrice"
            name="salePrice"
            inputMode="decimal"
            dir="ltr"
            defaultValue={price(product?.salePrice)}
            className="field tabular"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="aliases">{t.products.aliases}</label>
        <textarea
          id="aliases"
          name="aliases"
          dir="ltr"
          rows={3}
          defaultValue={product?.aliases.join("\n")}
          className="field font-mono text-sm"
        />
        <p className="mt-1 text-xs text-muted">{t.products.aliasesHint}</p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={product?.active ?? true} className="size-4 accent-cocoa" />
        {t.common.active}
      </label>

      {state.error && (
        <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{t.errors[state.error]}</p>
      )}

      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{t.common.save}</button>
        <Link href="/products" className="btn-ghost">{t.common.cancel}</Link>
      </div>
    </form>
  );
}
