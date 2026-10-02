import "server-only";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Category, Product } from "@/db/schema";

export function listCategories(): Category[] {
  return db.select().from(schema.categories).orderBy(asc(schema.categories.sort)).all();
}

export function listProducts({ includeInactive = false } = {}): Product[] {
  return db
    .select()
    .from(schema.products)
    .where(includeInactive ? undefined : eq(schema.products.active, true))
    .orderBy(asc(schema.products.sort), asc(schema.products.nameFr))
    .all();
}

export type ProductGroup = { category: Category | null; products: Product[] };

/** Products grouped by category, in category order; uncategorized last. */
export function groupProducts(products: Product[], categories: Category[]): ProductGroup[] {
  const groups: ProductGroup[] = categories.map((category) => ({
    category,
    products: products.filter((p) => p.categoryId === category.id),
  }));
  const known = new Set(categories.map((c) => c.id));
  groups.push({ category: null, products: products.filter((p) => p.categoryId == null || !known.has(p.categoryId)) });
  return groups.filter((g) => g.products.length > 0);
}

export function getCount(id: number) {
  const count = db.select().from(schema.counts).where(eq(schema.counts.id, id)).get();
  if (!count) return null;
  const lines = db.select().from(schema.countLines).where(eq(schema.countLines.countId, id)).all();
  return { ...count, lines };
}

function linesOf(countIds: number[]) {
  if (countIds.length === 0) return [];
  return db.select().from(schema.countLines).where(inArray(schema.countLines.countId, countIds)).all();
}

/**
 * Estimated sales for a stock count:
 *   sold = previous validated stock + validated deliveries since then − this stock
 * Deliveries dated from the previous stock count's day up to the day before this one
 * are included — stock is counted before the morning delivery is put away, so day D's
 * delivery is not yet in day D's stock count.
 */
export function salesEstimate(count: { id: number; date: string }) {
  const previous = db
    .select()
    .from(schema.counts)
    .where(
      and(
        eq(schema.counts.type, "stock"),
        eq(schema.counts.status, "validated"),
        lt(schema.counts.date, count.date),
      ),
    )
    .orderBy(desc(schema.counts.date), desc(schema.counts.id))
    .get();
  if (!previous) return null;

  const deliveries = db
    .select({ id: schema.counts.id })
    .from(schema.counts)
    .where(
      and(
        eq(schema.counts.type, "delivery"),
        eq(schema.counts.status, "validated"),
        gte(schema.counts.date, previous.date),
        lt(schema.counts.date, count.date),
      ),
    )
    .all();

  const prevQty = new Map(linesOf([previous.id]).map((l) => [l.productId, l.qty]));
  const delivered = new Map<number, number>();
  for (const l of linesOf(deliveries.map((d) => d.id))) {
    delivered.set(l.productId, (delivered.get(l.productId) ?? 0) + l.qty);
  }
  return { previous, deliveryCount: deliveries.length, prevQty, delivered };
}

export function usersById() {
  return new Map(
    db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).all().map((u) => [u.id, u.name]),
  );
}

/**
 * Quantities counted on delivery for a day (all delivery counts of that date summed),
 * or null when nobody counted that delivery.
 */
export function countedForDate(date: string) {
  const ids = db
    .select({ id: schema.counts.id })
    .from(schema.counts)
    .where(and(eq(schema.counts.type, "delivery"), eq(schema.counts.date, date)))
    .all()
    .map((c) => c.id);
  if (ids.length === 0) return null;
  const qty = new Map<number, number>();
  for (const l of linesOf(ids)) qty.set(l.productId, (qty.get(l.productId) ?? 0) + l.qty);
  return { qty, countIds: ids };
}

export function getDelivery(id: number) {
  const delivery = db.select().from(schema.deliveries).where(eq(schema.deliveries.id, id)).get();
  if (!delivery) return null;
  const lines = db
    .select()
    .from(schema.deliveryLines)
    .where(eq(schema.deliveryLines.deliveryId, id))
    .orderBy(asc(schema.deliveryLines.position))
    .all();
  const photos = db
    .select()
    .from(schema.deliveryPhotos)
    .where(eq(schema.deliveryPhotos.deliveryId, id))
    .orderBy(asc(schema.deliveryPhotos.id))
    .all();
  return { ...delivery, lines, photos };
}
