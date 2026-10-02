import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { dataDir, db, schema } from "@/db";
import { getUser } from "@/lib/auth";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Serves a delivery-note photo to the owner only. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/photos/deliveries/[id]">) {
  const user = await getUser();
  if (user?.role !== "owner") return new Response("Forbidden", { status: 403 });

  const id = Number((await ctx.params).id);
  const photo = Number.isInteger(id)
    ? db.select().from(schema.deliveryPhotos).where(eq(schema.deliveryPhotos.id, id)).get()
    : undefined;
  if (!photo) return new Response("Not found", { status: 404 });

  const file = path.join(dataDir, "uploads", "deliveries", String(photo.deliveryId), photo.filename);
  if (!fs.existsSync(file)) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(file), {
    headers: {
      "Content-Type": TYPES[path.extname(file).slice(1)] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
