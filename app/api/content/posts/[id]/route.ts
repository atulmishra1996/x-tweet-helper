import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { enqueueScheduledPost } from "@/lib/queue";
import { NotFoundError } from "@/lib/errors";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function load(userId: number, id: number) {
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, id), eq(posts.userId, userId)))
    .limit(1);
  if (!post) throw new NotFoundError("Post not found");
  return post;
}

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return ok({ post: await load(user.id, Number(id)) });
});

const patchSchema = z.object({
  type: z.enum(["tweet", "thread"]).optional(),
  content: z.array(z.string()).optional(),
  topic: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["draft", "scheduled"]).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const postId = Number(id);
  await load(user.id, postId);
  const body = patchSchema.parse(await req.json());

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.type) patch.type = body.type;
  if (body.content) patch.content = body.content;
  if (body.topic !== undefined) patch.topic = body.topic;
  if (body.tags) patch.tags = body.tags;

  let scheduledAt: Date | null | undefined;
  if (body.scheduledAt !== undefined) {
    scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    patch.scheduledAt = scheduledAt;
    patch.status = scheduledAt ? "scheduled" : "draft";
  } else if (body.status) {
    patch.status = body.status;
  }

  const [updated] = await db.update(posts).set(patch).where(eq(posts.id, postId)).returning();

  if (updated.status === "scheduled" && updated.scheduledAt) {
    await enqueueScheduledPost(updated.id, updated.scheduledAt);
  }

  return ok({ post: updated });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await load(user.id, Number(id));
  await db.delete(posts).where(eq(posts.id, Number(id)));
  return ok({ ok: true });
});
