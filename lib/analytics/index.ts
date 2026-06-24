import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { posts, postMetrics, dailyActivity, type PostMetric } from "@/lib/db/schema";

export interface MetricTotals {
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  profileClicks: number;
  urlClicks: number;
  engagements: number;
}

const EMPTY: MetricTotals = {
  impressions: 0,
  likes: 0,
  retweets: 0,
  replies: 0,
  quotes: 0,
  bookmarks: 0,
  profileClicks: 0,
  urlClicks: 0,
  engagements: 0,
};

/** Latest metric snapshot per post id. */
async function latestByPost(postIds: number[]): Promise<Map<number, PostMetric>> {
  const map = new Map<number, PostMetric>();
  if (postIds.length === 0) return map;
  const rows = await db
    .select()
    .from(postMetrics)
    .where(inArray(postMetrics.postId, postIds))
    .orderBy(desc(postMetrics.capturedAt));
  for (const row of rows) {
    if (!map.has(row.postId)) map.set(row.postId, row); // first seen = latest due to ordering
  }
  return map;
}

function sumMetrics(metrics: PostMetric[]): MetricTotals {
  return metrics.reduce<MetricTotals>(
    (acc, m) => ({
      impressions: acc.impressions + (m.impressions ?? 0),
      likes: acc.likes + (m.likes ?? 0),
      retweets: acc.retweets + (m.retweets ?? 0),
      replies: acc.replies + (m.replies ?? 0),
      quotes: acc.quotes + (m.quotes ?? 0),
      bookmarks: acc.bookmarks + (m.bookmarks ?? 0),
      profileClicks: acc.profileClicks + (m.profileClicks ?? 0),
      urlClicks: acc.urlClicks + (m.urlClicks ?? 0),
      engagements: acc.engagements + (m.engagements ?? 0),
    }),
    { ...EMPTY },
  );
}

export function engagementRate(t: MetricTotals): number {
  const interactions = t.likes + t.retweets + t.replies + t.quotes;
  return t.impressions > 0 ? (interactions / t.impressions) * 100 : 0;
}

async function totalsForRange(userId: number, since: Date, until?: Date): Promise<{ totals: MetricTotals; postCount: number }> {
  const conditions = [eq(posts.userId, userId), eq(posts.status, "posted"), gte(posts.postedAt, since)];
  const postedPosts = await db
    .select({ id: posts.id, postedAt: posts.postedAt })
    .from(posts)
    .where(and(...conditions));
  const inWindow = until ? postedPosts.filter((p) => p.postedAt && p.postedAt < until) : postedPosts;
  const ids = inWindow.map((p) => p.id);
  const latest = await latestByPost(ids);
  return { totals: sumMetrics([...latest.values()]), postCount: ids.length };
}

export interface Overview {
  current: MetricTotals;
  previous: MetricTotals;
  engagementRate: number;
  postCount: number;
  days: number;
}

/** Headline metrics for the last `days`, with the prior period for trend. */
export async function getOverview(userId: number, days = 7): Promise<Overview> {
  const now = Date.now();
  const since = new Date(now - days * 86400_000);
  const prevSince = new Date(now - 2 * days * 86400_000);

  const current = await totalsForRange(userId, since);
  const previous = await totalsForRange(userId, prevSince, since);

  return {
    current: current.totals,
    previous: previous.totals,
    engagementRate: engagementRate(current.totals),
    postCount: current.postCount,
    days,
  };
}

export interface PerPostRow {
  postId: number;
  type: string;
  text: string;
  postedAt: Date | null;
  tweetId: string | null;
  metrics: MetricTotals;
  engagementRate: number;
}

export async function getPerPost(userId: number, days = 30): Promise<PerPostRow[]> {
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.userId, userId), eq(posts.status, "posted"), gte(posts.postedAt, since)))
    .orderBy(desc(posts.postedAt));
  const latest = await latestByPost(rows.map((r) => r.id));

  return rows.map((r) => {
    const m = latest.get(r.id);
    const metrics = m ? sumMetrics([m]) : { ...EMPTY };
    return {
      postId: r.id,
      type: r.type,
      text: r.content[0] ?? "",
      postedAt: r.postedAt,
      tweetId: r.postedTweetIds?.[0] ?? null,
      metrics,
      engagementRate: engagementRate(metrics),
    };
  });
}

export interface BestTimeCell {
  weekday: number; // 0=Sun
  hour: number;
  avgEngagement: number;
  count: number;
}

/** Average engagement by weekday/hour from the user's own posting history. */
export async function getBestTime(userId: number): Promise<BestTimeCell[]> {
  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.userId, userId), eq(posts.status, "posted")));
  const latest = await latestByPost(rows.map((r) => r.id));

  const buckets = new Map<string, { total: number; count: number; weekday: number; hour: number }>();
  for (const r of rows) {
    if (!r.postedAt) continue;
    const m = latest.get(r.id);
    if (!m) continue;
    const d = new Date(r.postedAt);
    const weekday = d.getDay();
    const hour = d.getHours();
    const interactions = (m.likes ?? 0) + (m.retweets ?? 0) + (m.replies ?? 0) + (m.quotes ?? 0);
    const key = `${weekday}-${hour}`;
    const cur = buckets.get(key) ?? { total: 0, count: 0, weekday, hour };
    cur.total += interactions;
    cur.count += 1;
    buckets.set(key, cur);
  }

  return [...buckets.values()].map((b) => ({
    weekday: b.weekday,
    hour: b.hour,
    avgEngagement: b.count ? b.total / b.count : 0,
    count: b.count,
  }));
}

/** Consecutive-day streak based on days with >=1 published post. */
export async function getStreak(userId: number): Promise<{ streak: number; last7: { day: string; count: number }[] }> {
  const rows = await db
    .select()
    .from(dailyActivity)
    .where(eq(dailyActivity.userId, userId))
    .orderBy(desc(dailyActivity.day));

  const active = new Set(rows.filter((r) => r.postsPublished > 0).map((r) => r.day));
  let streak = 0;
  const cursor = new Date();
  // Allow today to be incomplete: start counting from yesterday if today empty.
  if (!active.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
  while (active.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const last7: { day: string; count: number }[] = [];
  const byDay = new Map(rows.map((r) => [r.day, r.postsPublished]));
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    last7.push({ day: key, count: byDay.get(key) ?? 0 });
  }

  return { streak, last7 };
}
