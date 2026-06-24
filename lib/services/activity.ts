import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyActivity } from "@/lib/db/schema";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Increment today's published-post counter (used for streak/consistency). */
export async function recordPublished(userId: number, count = 1): Promise<void> {
  await db
    .insert(dailyActivity)
    .values({ userId, day: today(), postsPublished: count })
    .onConflictDoUpdate({
      target: [dailyActivity.userId, dailyActivity.day],
      set: { postsPublished: sql`${dailyActivity.postsPublished} + ${count}` },
    });
}

/** Add to today's words-written counter (blog progress). */
export async function recordWords(userId: number, words: number): Promise<void> {
  if (words <= 0) return;
  await db
    .insert(dailyActivity)
    .values({ userId, day: today(), wordsWritten: words })
    .onConflictDoUpdate({
      target: [dailyActivity.userId, dailyActivity.day],
      set: { wordsWritten: sql`${dailyActivity.wordsWritten} + ${words}` },
    });
}
