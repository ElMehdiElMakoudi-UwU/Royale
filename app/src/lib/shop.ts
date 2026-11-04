import "server-only";
import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db, schema } from "@/db";
import type { Shop } from "@/db/schema";
import { requireOwner, requireUser } from "./auth";
import { SHOP_COOKIE } from "./shop-cookie";

export const listShops = cache((): Shop[] => db.select().from(schema.shops).orderBy(asc(schema.shops.sort), asc(schema.shops.id)).all());

export const getShop = (id: number) => db.select().from(schema.shops).where(eq(schema.shops.id, id)).get();

/**
 * The shop being worked in: staff are tied to theirs, whatever the cookie says; the owner
 * picks one with the switcher in the header.
 */
const currentShop = cache(async (): Promise<Shop> => {
  const user = await requireUser();
  const shops = listShops();
  const id = user.role === "owner" ? Number((await cookies()).get(SHOP_COOKIE)?.value) : user.shopId;
  return shops.find((s) => s.id === id) ?? shops[0];
});

export async function requireShop() {
  const [user, shop] = await Promise.all([requireUser(), currentShop()]);
  return { user, shop };
}

export async function requireOwnerShop() {
  const [owner, shop] = await Promise.all([requireOwner(), currentShop()]);
  return { owner, shop };
}
