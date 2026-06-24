import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { enqueueScheduledPost } from "@/lib/queue";

export const runtime = "nodejs";

export const GET = handle(async (req: Request) => {
  const user = await requireUser();
  const status = new URL(req.url).searchParams.get("status");
  const where = status
    ? and(eq(posts.userId, user.id), eq(posts.status, status))
    : eq(posts.userId, user.id);
  const rows = await db.select().from(posts).where(where).orderBy(desc(posts.createdAt)).limit(200);
  return ok({ posts: rows });
});

const createSchema = z.object({
  type: z.enum(["tweet", "thread"]).default("tweet"),
  content: z.array(z.string()).min(1),
  topic: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["draft", "scheduled"]).default("draft"),
  scheduledAt: z.string().datetime().optional(),
  sourceIdeaId: z.number().int().optional(),
  sourceBlogId: z.number().int().optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = createSchema.parse(await req.json());

  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  const status = scheduledAt ? "scheduled" : body.status === "scheduled" ? "draft" : body.status;

  const [post] = await db
    .insert(posts)
    .values({
      userId: user.id,
      type: body.type,
      content: body.content,
      topic: body.topic,
      tags: body.tags ?? [],
      status,
      scheduledAt,
      sourceIdeaId: body.sourceIdeaId,
      sourceBlogId: body.sourceBlogId,
    })
    .returning();

  if (status === "scheduled" && scheduledAt) {
    await enqueueScheduledPost(post.id, scheduledAt);
  }

  return ok({ post }, { status: 201 });
});
