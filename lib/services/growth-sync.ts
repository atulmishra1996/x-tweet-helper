import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, growthSnapshots, type User } from "@/lib/db/schema";
import { getMe } from "@/lib/x/client";
import { scoped } from "@/lib/logger";

const log = scoped("growth-sync");

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Snapshot follower/following counts for a user (one row per day). */
export async function syncGrowthForUser(user: User): Promise<void> {
  if (!user.accessToken) return;
  const me = await getMe(user);
  await db
    .insert(growthSnapshots)
    .values({
      userId: user.id,
      capturedOn: today(),
      followers: me.followers,
      following: me.following,
      source: "sync",
    })
    .onConflictDoUpdate({
      target: [growthSnapshots.userId, growthSnapshots.capturedOn],
      set: { followers: me.followers, following: me.following },
    });
  log.info({ userId: user.id, followers: me.followers }, "Growth snapshot complete");
}

export async function syncAllGrowth(): Promise<void> {
  const allUsers = await db.select().from(users);
  for (const user of allUsers) {
    try {
      await syncGrowthForUser(user);
    } catch (err) {
      log.error({ err, userId: user.id }, "Growth sync failed for user");
    }
  }
}
