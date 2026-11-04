import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export type ShopSettings = {
  /** Lines printed at the top of receipts (shop name, address, phone). */
  receiptHeader: string;
  receiptFooter: string;
  autoPrint: boolean;
};

const DEFAULTS: ShopSettings = {
  receiptHeader: "",
  receiptFooter: "Merci de votre visite !",
  autoPrint: true,
};

export function getSettings(shopId: number): ShopSettings {
  const rows = new Map(db.select().from(schema.settings).where(eq(schema.settings.shopId, shopId)).all().map((r) => [r.key, r.value]));
  return {
    receiptHeader: rows.get("receiptHeader") ?? DEFAULTS.receiptHeader,
    receiptFooter: rows.get("receiptFooter") ?? DEFAULTS.receiptFooter,
    autoPrint: (rows.get("autoPrint") ?? String(DEFAULTS.autoPrint)) === "true",
  };
}

export function saveSettings(shopId: number, values: ShopSettings) {
  db.transaction((tx) => {
    for (const [key, value] of Object.entries(values)) {
      tx.insert(schema.settings)
        .values({ shopId, key, value: String(value) })
        .onConflictDoUpdate({ target: [schema.settings.shopId, schema.settings.key], set: { value: String(value) } })
        .run();
    }
  });
}
