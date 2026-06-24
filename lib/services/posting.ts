import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { posts, users, auditLog, type Post } from "@/lib/db/schema";
import { postTweet, postThread } from "@/lib/x/client";
import { recordPublished } from "@/lib/services/activity";
import { NotFoundError, AppError } from "@/lib/errors";
import { scoped } from "@/lib/logger";

const log = scoped("posting");

/**
 * Publish a draft/scheduled post to X. Used by both the "Post now" API route
 * and the scheduled-post worker, so behavior is identical either way.
 * Idempotent: a post already marked "posted" is returned untouched.
 */
export async function publishPost(userId: number, postId: number): Promise<Post> {
  const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post || post.userId !== userId) throw new NotFoundError("Post not found");
  if (post.status === "posted") return post;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new NotFoundError("User not found");

  await db.update(posts).set({ status: "posting", updatedAt: new Date() }).where(eq(posts.id, postId));

  try {
    const content = post.content.filter((t) => t.trim().length > 0);
    if (content.length === 0) throw new AppError("VALIDATION_ERROR", "Post has no content", 422);

    const tweetIds =
      post.type === "thread" || content.length > 1
        ? await postThread(user, content)
        : [(await postTweet(user, content[0])).id];

    const [updated] = await db
      .update(posts)
      .set({
        status: "posted",
        postedTweetIds: tweetIds,
        postedAt: new Date(),
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, postId))
      .returning();

    await recordPublished(userId, 1);
    await db.insert(auditLog).values({
      userId,
      action: "post.published",
      entity: `post:${postId}`,
      metadata: { tweetIds },
    });
    log.info({ postId, tweetIds }, "Post published");
    return updated;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to publish";
    await db
      .update(posts)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(posts.id, postId));
    log.error({ err, postId }, "Post publish failed");
    throw err;
  }
}

/** Publish a scheduled post by id (worker context — resolves owner itself). */
export async function publishScheduled(postId: number): Promise<void> {
  const [post] = await db.select({ userId: posts.userId }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post) {
    log.warn({ postId }, "Scheduled post no longer exists; skipping");
    return;
  }
  await publishPost(post.userId, postId);
}

/**
 * Publish all posts whose scheduled time has passed. Used by the cron endpoint
 * (serverless deployments) as an alternative to the pg-boss worker.
 */
export async function publishDuePosts(): Promise<number> {
  const due = await db
    .select({ id: posts.id, userId: posts.userId })
    .from(posts)
    .where(and(eq(posts.status, "scheduled"), lte(posts.scheduledAt, new Date())));
  let count = 0;
  for (const p of due) {
    try {
      await publishPost(p.userId, p.id);
      count += 1;
    } catch (err) {
      log.error({ err, postId: p.id }, "Due post publish failed");
    }
  }
  return count;
}
