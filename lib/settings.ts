import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { settings, type Settings } from "@/lib/db/schema";

/** Load settings for a user, creating defaults on first access. */
export async function getOrCreateSettings(userId: number): Promise<Settings> {
  const [existing] = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(settings).values({ userId }).returning();
  return created;
}
