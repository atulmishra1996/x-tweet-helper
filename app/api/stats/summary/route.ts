import { and, desc, eq } from "drizzle-orm";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { posts, growthSnapshots } from "@/lib/db/schema";
import { getOverview, getStreak, engagementRate } from "@/lib/analytics";
import { getOrCreateSettings } from "@/lib/settings";

export const runtime = "nodejs";

export const GET = handle(async () => {
  const user = await requireUser();
  const [overview, streak, settings] = await Promise.all([
    getOverview(user.id, 7),
    getStreak(user.id),
    getOrCreateSettings(user.id),
  ]);

  const all = await db.select({ status: posts.status }).from(posts).where(eq(posts.userId, user.id));
  const counts = {
    draft: all.filter((p) => p.status === "draft").length,
    scheduled: all.filter((p) => p.status === "scheduled").length,
    posted: all.filter((p) => p.status === "posted").length,
  };

  const recent = await db
    .select()
    .from(posts)
    .where(and(eq(posts.userId, user.id), eq(posts.status, "posted")))
    .orderBy(desc(posts.postedAt))
    .limit(5);

  const [latestGrowth] = await db
    .select()
    .from(growthSnapshots)
    .where(eq(growthSnapshots.userId, user.id))
    .orderBy(desc(growthSnapshots.capturedOn))
    .limit(2);

  const prevGrowth = (
    await db
      .select()
      .from(growthSnapshots)
      .where(eq(growthSnapshots.userId, user.id))
      .orderBy(desc(growthSnapshots.capturedOn))
      .limit(2)
  )[1];

  return ok({
    overview,
    prevEngagementRate: engagementRate(overview.previous),
    streak,
    counts,
    goal: { daily: settings.dailyGoal, weekly: settings.weeklyGoal },
    followers: latestGrowth?.followers ?? null,
    followerDelta:
      latestGrowth?.followers != null && prevGrowth?.followers != null
        ? latestGrowth.followers - prevGrowth.followers
        : null,
    subscribers: latestGrowth?.xSubscribers ?? null,
    recent: recent.map((p) => ({ id: p.id, text: p.content[0], type: p.type, postedAt: p.postedAt })),
  });
});
