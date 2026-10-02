import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/db";
import type { User } from "@/db/schema";

const COOKIE = "session";
const SESSION_DAYS = 30;

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export const hashPassword = (password: string) => bcrypt.hash(password, 10);

export async function login(username: string, password: string) {
  const user = db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.username, username.trim().toLowerCase()), eq(schema.users.active, true)))
    .get();
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return false;

  // Opportunistic cleanup of expired sessions.
  db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, Date.now())).run();

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  db.insert(schema.sessions).values({ id: sha256(token), userId: user.id, expiresAt }).run();

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    expires: new Date(expiresAt),
  });
  return true;
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token))).run();
  jar.delete(COOKIE);
}

export const getUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(
      and(
        eq(schema.sessions.id, sha256(token)),
        gt(schema.sessions.expiresAt, Date.now()),
        eq(schema.users.active, true),
      ),
    )
    .get();
  return row?.user ?? null;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireOwner() {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/");
  return user;
}

/** Ends every session of a user (after a password change or deactivation). */
export function revokeSessions(userId: number) {
  db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run();
}
