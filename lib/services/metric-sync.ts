import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, posts, postMetrics, type User } from "@/lib/db/schema";
import { lookupTweetMetrics } from "@/lib/x/client";
import { scoped } from "@/lib/logger";

const log = scoped("metric-sync");
const WINDOW_DAYS = 30; // X private metrics only available within 30 days

/**
 * Snapshot engagement metrics for a user's posts that are still within the
 * 30-day private-metrics window. Each run appends a timestamped row per post,
 * building the time-series our analytics read from.
 */
export async function syncMetricsForUser(user: User): Promise<number> {
  if (!user.accessToken) return 0;
  const since = new Date(Date.now() - WINDOW_DAYS * 86400_000);

  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.userId, user.id), eq(posts.status, "posted"), gte(posts.postedAt, since)));

  const tweetToPost = new Map<string, number>();
  for (const r of rows) {
    const firstId = r.postedTweetIds?.[0];
    if (firstId) tweetToPost.set(firstId, r.id);
  }
  const tweetIds = [...tweetToPost.keys()];
  if (tweetIds.length === 0) return 0;

  let inserted = 0;
  for (let i = 0; i < tweetIds.length; i += 100) {
    const batch = tweetIds.slice(i, i + 100);
    const metrics = await lookupTweetMetrics(user, batch);
    for (const m of metrics) {
      const postId = tweetToPost.get(m.tweetId);
      if (!postId) continue;
      await db.insert(postMetrics).values({
        postId,
        tweetId: m.tweetId,
        impressions: m.impressions,
        likes: m.likes,
        retweets: m.retweets,
        replies: m.replies,
        quotes: m.quotes,
        bookmarks: m.bookmarks,
        urlClicks: m.urlClicks,
        profileClicks: m.profileClicks,
        engagements: m.engagements,
      });
      inserted += 1;
    }
  }
  log.info({ userId: user.id, inserted }, "Metric snapshot complete");
  return inserted;
}

export async function syncAllMetrics(): Promise<void> {
  const allUsers = await db.select().from(users);
  for (const user of allUsers) {
    try {
      await syncMetricsForUser(user);
    } catch (err) {
      log.error({ err, userId: user.id }, "Metric sync failed for user");
    }
  }
}
