/**
 * First-time setup: creates the owner account, categories and the starting product list.
 * Safe to re-run: it only fills empty tables.
 *
 *   OWNER_USERNAME=... OWNER_PASSWORD=... OWNER_NAME=... npm run seed
 */
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../src/db/schema";
import type { Unit } from "../src/db/schema";

const dataDir = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });
const sqlite = new Database(path.join(dataDir, "royale.db"));
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

const CATEGORIES = [
  { key: "vien", nameFr: "Viennoiserie", nameAr: "مخبوزات" },
  { key: "trompe", nameFr: "Trompe-l'œil", nameAr: "ترومبلوي" },
  { key: "indiv", nameFr: "Gâteaux individuels", nameAr: "حلويات فردية" },
  { key: "secs", nameFr: "Gâteaux secs & boîtes", nameAr: "حلويات جافة وعلب" },
  { key: "cakes", nameFr: "Cakes", nameAr: "كيك" },
  { key: "tartes", nameFr: "Tartes", nameAr: "طارط" },
  { key: "plateaux", nameFr: "Plateaux", nameAr: "صواني" },
  { key: "macarons", nameFr: "Macarons", nameAr: "ماكرون" },
  { key: "sale", nameFr: "Salé", nameAr: "مالح" },
] as const;

type Seed = {
  cat: (typeof CATEGORIES)[number]["key"];
  fr: string;
  ar: string;
  unit?: Unit;
  /** Purchase price in DH as read on the delivery note of 01/10/2026; null = unknown yet. */
  price: number | null;
  aliases?: string[];
};

// From delivery note BL00030715 (01/10/2026) and the stock notebook.
// Trompe-l'œil flavours are matched to the "Gt …" lines of the delivery note
// (same flavours, matching quantities); the owner should confirm.
const PRODUCTS: Seed[] = [
  { cat: "vien", fr: "Croissant amande", ar: "كرواسون باللوز", price: 5.5, aliases: ["croissant amande"] },
  { cat: "vien", fr: "Croissant Nutella", ar: "كرواسون بالنوتيلا", price: 4.7, aliases: ["croissant nutella"] },
  { cat: "vien", fr: "Croissant citron", ar: "كرواسون بالليمون", price: 4.7, aliases: ["croissant Citron"] },
  { cat: "vien", fr: "Croissant framboise", ar: "كرواسون بالفرامبواز", price: 4.7, aliases: ["croissant framboise"] },
  { cat: "vien", fr: "Pain suisse (petit)", ar: "بان سويس صغير", price: 3.7, aliases: ["pain suisse pt"] },
  { cat: "vien", fr: "Pain suisse pistache", ar: "بان سويس بالفستق", price: 6, aliases: ["Pain suice pistache"] },
  { cat: "vien", fr: "Chinois (petit)", ar: "شينوا صغير", price: 3.7, aliases: ["chenique pt"] },
  { cat: "vien", fr: "Sedra amande", ar: "سدرة باللوز", price: 6, aliases: ["sedra Amande"] },

  { cat: "trompe", fr: "Trompe-l'œil amande", ar: "ترومبلوي لوز", price: null },
  { cat: "trompe", fr: "Trompe-l'œil framboise", ar: "ترومبلوي فرامبواز", price: null },
  { cat: "trompe", fr: "Trompe-l'œil café", ar: "ترومبلوي قهوة", price: null },
  { cat: "trompe", fr: "Trompe-l'œil fraise", ar: "ترومبلوي فريز", price: null },
  { cat: "trompe", fr: "Trompe-l'œil pistache", ar: "ترومبلوي فستق", price: 26, aliases: ["Gt pistacha"] },
  { cat: "trompe", fr: "Trompe-l'œil cacahuète", ar: "ترومبلوي كاوكاو", price: null },
  { cat: "trompe", fr: "Trompe-l'œil citron", ar: "ترومبلوي ليمون", price: 22, aliases: ["Gt citrona"] },
  { cat: "trompe", fr: "Trompe-l'œil mangue", ar: "ترومبلوي مانغو", price: 22, aliases: ["Gt mangue"] },

  { cat: "indiv", fr: "Génoise", ar: "جنواز", price: 14, aliases: ["Gt genoi"] },
  { cat: "indiv", fr: "Nougatine", ar: "نوكاتين", price: 18, aliases: ["Gt nogatine"] },

  { cat: "secs", fr: "Sablé datte 500 g", ar: "صابلي بالتمر 500غ", unit: "box", price: 37.5, aliases: ["sable datte 500g"] },
  { cat: "secs", fr: "Ghriba 500 g", ar: "غريبة 500غ", unit: "box", price: 32.5, aliases: ["el ghribiya 500g"] },
  { cat: "secs", fr: "Maïzena 500 g", ar: "ميزينا 500غ", unit: "box", price: 37.5, aliases: ["Maizina 500 g"] },
  { cat: "secs", fr: "Briouate amande", ar: "بريوات باللوز", unit: "kg", price: 125, aliases: ["Briwat amande / kg"] },
  { cat: "secs", fr: "Bejmate", ar: "بشماط", unit: "box", price: null },
  { cat: "secs", fr: "Cookies citron", ar: "كوكيز بالليمون", unit: "box", price: null },

  { cat: "cakes", fr: "Cake vanille rond", ar: "كيك فانيلا مدور", price: 45, aliases: ["cake vanille mdawra"] },
  { cat: "cakes", fr: "Cake chocolat rond", ar: "كيك شوكولاتة مدور", price: 55, aliases: ["cake chocolat mdawra"] },
  { cat: "cakes", fr: "Cake américain", ar: "كيك أمريكي", price: null },

  { cat: "tartes", fr: "Tarte", ar: "طارط", unit: "kg", price: null },
  { cat: "tartes", fr: "Tarte glacée", ar: "طارط مثلجة", price: null },

  { cat: "plateaux", fr: "Plateau soirée 35 pièces", ar: "صينية سواريه 35 قطعة", price: null },
  { cat: "plateaux", fr: "Plateau soirée 48 pièces", ar: "صينية سواريه 48 قطعة", price: null },

  { cat: "macarons", fr: "Macaron grand", ar: "ماكرون كبير", price: 4, aliases: ["macaron grand"] },

  { cat: "sale", fr: "Salé sec 100 g", ar: "مالح جاف 100غ", unit: "box", price: 13, aliases: ["salee sec 100g"] },
];

async function main() {
  const userCount = db.select({ n: count() }).from(schema.users).get()!.n;
  if (userCount === 0) {
    const username = process.env.OWNER_USERNAME?.trim().toLowerCase();
    const password = process.env.OWNER_PASSWORD;
    if (!username || !password) {
      throw new Error("Set OWNER_USERNAME and OWNER_PASSWORD to create the owner account.");
    }
    db.insert(schema.users)
      .values({
        name: process.env.OWNER_NAME?.trim() || username,
        username,
        role: "owner",
        passwordHash: await bcrypt.hash(password, 10),
      })
      .run();
    console.log(`Owner account "${username}" created.`);
  }

  const catCount = db.select({ n: count() }).from(schema.categories).get()!.n;
  const productCount = db.select({ n: count() }).from(schema.products).get()!.n;
  if (catCount === 0 && productCount === 0) {
    db.transaction((tx) => {
      const ids = new Map<string, number>();
      CATEGORIES.forEach((c, i) => {
        const row = tx
          .insert(schema.categories)
          .values({ nameFr: c.nameFr, nameAr: c.nameAr, sort: i })
          .returning({ id: schema.categories.id })
          .get();
        ids.set(c.key, row.id);
      });
      PRODUCTS.forEach((p, i) => {
        tx.insert(schema.products)
          .values({
            nameFr: p.fr,
            nameAr: p.ar,
            categoryId: ids.get(p.cat)!,
            unit: p.unit ?? "piece",
            purchasePrice: p.price == null ? null : Math.round(p.price * 100),
            aliases: p.aliases ?? [],
            sort: i,
          })
          .run();
      });
    });
    console.log(`${CATEGORIES.length} categories and ${PRODUCTS.length} products created.`);
  } else {
    console.log("Catalog already present, skipped.");
  }
}

main().then(
  () => sqlite.close(),
  (e) => {
    console.error(e.message ?? e);
    process.exit(1);
  },
);
