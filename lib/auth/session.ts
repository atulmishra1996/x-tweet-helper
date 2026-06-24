import { cookies } from "next/headers";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, type User } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { UnauthorizedError } from "@/lib/errors";

const COOKIE = "th_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function sign(userId: number): string {
  const payload = String(userId);
  const sig = createHmac("sha256", env.SESSION_SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

function verify(token: string): number | null {
  const idx = token.lastIndexOf(".");
  if (idx < 0) return null;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = createHmac("sha256", env.SESSION_SECRET).update(payload).digest("hex");
  if (!safeEqual(sig, expected)) return null;
  const id = Number(payload);
  return Number.isFinite(id) ? id : null;
}

export async function createSession(userId: number): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, sign(userId), {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/** Returns the current user or null (no throw). */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const userId = verify(token);
  if (userId == null) return null;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

/** Returns the current user or throws UnauthorizedError. Use in API routes. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
