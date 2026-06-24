import { db } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { recordPublished } from "@/lib/services/activity";

export interface ManualPostInput {
  text: string;
  type?: "tweet" | "thread";
}

/** Record tweets the user published directly on X (Open in X, mobile app, etc.). */
export async function logManualPosts(userId: number, items: ManualPostInput[]): Promise<number> {
  const now = new Date();
  let logged = 0;

  for (const item of items) {
    const lines = item.text
      .split(/\n\s*---\s*\n/)
      .map((t) => t.trim())
      .filter(Boolean);
    const content = lines.length > 0 ? lines : [item.text.trim()];
    if (content.length === 0 || !content[0]) continue;

    await db.insert(posts).values({
      userId,
      type: item.type ?? (content.length > 1 ? "thread" : "tweet"),
      content,
      status: "posted",
      postedAt: now,
      topic: "manual-x",
      postedTweetIds: [],
    });
    logged += 1;
  }

  if (logged > 0) await recordPublished(userId, logged);
  return logged;
}
