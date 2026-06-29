import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyActivity } from "@/lib/db/schema";

// Accept the main db client OR a Drizzle transaction (they share the same query interface)
type Executor = any;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Increment today's published-post counter (used for streak/consistency). */
export async function recordPublished(
  userId: number,
  count = 1,
  executor: Executor = db,
): Promise<void> {
  await executor
    .insert(dailyActivity)
    .values({ userId, day: today(), postsPublished: count })
    .onConflictDoUpdate({
      target: [dailyActivity.userId, dailyActivity.day],
      set: { postsPublished: sql`${dailyActivity.postsPublished} + ${count}` },
    });
}

/** Add to today's words-written counter (blog progress). */
export async function recordWords(
  userId: number,
  words: number,
  executor: Executor = db,
): Promise<void> {
  if (words <= 0) return;
  await executor
    .insert(dailyActivity)
    .values({ userId, day: today(), wordsWritten: words })
    .onConflictDoUpdate({
      target: [dailyActivity.userId, dailyActivity.day],
      set: { wordsWritten: sql`${dailyActivity.wordsWritten} + ${words}` },
    });
}
