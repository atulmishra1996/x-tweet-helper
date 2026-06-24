import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, growthSnapshots, auditLog, type User } from "@/lib/db/schema";
import { getOverview, getPerPost, getStreak } from "@/lib/analytics";
import { scoped } from "@/lib/logger";

const log = scoped("recap");

export interface WeeklyRecap {
  generatedAt: string;
  impressions: number;
  engagementRate: number;
  postsPublished: number;
  followerDelta: number | null;
  topPost: { text: string; engagementRate: number } | null;
}

export async function buildRecapForUser(user: User): Promise<WeeklyRecap> {
  const [overview, perPost, streak] = await Promise.all([
    getOverview(user.id, 7),
    getPerPost(user.id, 7),
    getStreak(user.id),
  ]);

  const snapshots = await db
    .select()
    .from(growthSnapshots)
    .where(eq(growthSnapshots.userId, user.id))
    .orderBy(desc(growthSnapshots.capturedOn))
    .limit(8);
  const latest = snapshots[0]?.followers ?? null;
  const weekAgo = snapshots[snapshots.length - 1]?.followers ?? null;
  const followerDelta = latest != null && weekAgo != null ? latest - weekAgo : null;

  const top = [...perPost].sort((a, b) => b.engagementRate - a.engagementRate)[0] ?? null;

  const recap: WeeklyRecap = {
    generatedAt: new Date().toISOString(),
    impressions: overview.current.impressions,
    engagementRate: overview.engagementRate,
    postsPublished: streak.last7.reduce((s, d) => s + d.count, 0),
    followerDelta,
    topPost: top ? { text: top.text, engagementRate: top.engagementRate } : null,
  };

  await db.insert(auditLog).values({
    userId: user.id,
    action: "recap.weekly",
    entity: "recap",
    metadata: recap as unknown as Record<string, unknown>,
  });

  return recap;
}

export async function buildAllRecaps(): Promise<void> {
  const allUsers = await db.select().from(users);
  for (const user of allUsers) {
    try {
      await buildRecapForUser(user);
    } catch (err) {
      log.error({ err, userId: user.id }, "Recap failed for user");
    }
  }
}
