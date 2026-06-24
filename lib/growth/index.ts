import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { growthSnapshots, auditLog } from "@/lib/db/schema";
import { getBestTime, getPerPost } from "@/lib/analytics";

export interface GrowthPoint {
  date: string;
  followers: number | null;
  xSubscribers: number | null;
  newsletterSubscribers: number | null;
}

export async function getGrowthSeries(userId: number): Promise<GrowthPoint[]> {
  const rows = await db
    .select()
    .from(growthSnapshots)
    .where(eq(growthSnapshots.userId, userId))
    .orderBy(asc(growthSnapshots.capturedOn));
  return rows.map((r) => ({
    date: r.capturedOn,
    followers: r.followers,
    xSubscribers: r.xSubscribers,
    newsletterSubscribers: r.newsletterSubscribers,
  }));
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface Recommendation {
  id: string;
  title: string;
  detail: string;
}

/** Data-driven suggestions derived from the user's own posting history. */
export async function getRecommendations(userId: number): Promise<Recommendation[]> {
  const [cells, perPost] = await Promise.all([getBestTime(userId), getPerPost(userId, 90)]);
  const recs: Recommendation[] = [];

  const best = [...cells].filter((c) => c.count >= 2).sort((a, b) => b.avgEngagement - a.avgEngagement)[0];
  if (best) {
    recs.push({
      id: "best-time",
      title: `Post on ${WEEKDAYS[best.weekday]} around ${best.hour}:00`,
      detail: `Your posts then average ${best.avgEngagement.toFixed(1)} interactions — your strongest slot.`,
    });
  }

  const threads = perPost.filter((p) => p.type === "thread");
  const singles = perPost.filter((p) => p.type === "tweet");
  if (threads.length >= 2 && singles.length >= 2) {
    const avg = (arr: typeof perPost) => arr.reduce((s, p) => s + p.engagementRate, 0) / arr.length;
    const tAvg = avg(threads);
    const sAvg = avg(singles);
    if (tAvg > sAvg * 1.15) {
      recs.push({
        id: "format-thread",
        title: "Threads are outperforming single tweets",
        detail: `Threads average ${tAvg.toFixed(1)}% engagement vs ${sAvg.toFixed(1)}% for singles. Lean into threads.`,
      });
    } else if (sAvg > tAvg * 1.15) {
      recs.push({
        id: "format-single",
        title: "Single tweets are winning right now",
        detail: `Singles average ${sAvg.toFixed(1)}% engagement vs ${tAvg.toFixed(1)}% for threads.`,
      });
    }
  }

  const top = [...perPost].sort((a, b) => b.engagementRate - a.engagementRate)[0];
  if (top && top.engagementRate > 0) {
    recs.push({
      id: "remix-winner",
      title: "Remix your top performer",
      detail: `"${top.text.slice(0, 80)}…" did well. Generate fresh variations in Tweet Studio.`,
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: "post-more",
      title: "Post consistently to unlock insights",
      detail: "Once you have a handful of posts with metrics, you'll get tailored recommendations here.",
    });
  }
  return recs;
}

export interface LatestRecap {
  generatedAt: string;
  impressions: number;
  engagementRate: number;
  postsPublished: number;
  followerDelta: number | null;
  topPost: { text: string; engagementRate: number } | null;
}

export async function getLatestRecap(userId: number): Promise<LatestRecap | null> {
  const rows = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.userId, userId))
    .orderBy(desc(auditLog.createdAt))
    .limit(100);
  const recap = rows.find((r) => r.action === "recap.weekly");
  return recap ? (recap.metadata as unknown as LatestRecap) : null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface ManualGrowthInput {
  followers?: number;
  xSubscribers?: number;
  xSubRevenueCents?: number;
  newsletterSubscribers?: number;
}

/** Log/overwrite today's manual growth figures (X subs, newsletter). */
export async function logManualGrowth(userId: number, input: ManualGrowthInput): Promise<void> {
  await db
    .insert(growthSnapshots)
    .values({
      userId,
      capturedOn: today(),
      followers: input.followers ?? null,
      xSubscribers: input.xSubscribers ?? null,
      xSubRevenueCents: input.xSubRevenueCents ?? null,
      newsletterSubscribers: input.newsletterSubscribers ?? null,
      source: "manual",
    })
    .onConflictDoUpdate({
      target: [growthSnapshots.userId, growthSnapshots.capturedOn],
      set: {
        ...(input.followers != null ? { followers: input.followers } : {}),
        ...(input.xSubscribers != null ? { xSubscribers: input.xSubscribers } : {}),
        ...(input.xSubRevenueCents != null ? { xSubRevenueCents: input.xSubRevenueCents } : {}),
        ...(input.newsletterSubscribers != null ? { newsletterSubscribers: input.newsletterSubscribers } : {}),
      },
    });
}
