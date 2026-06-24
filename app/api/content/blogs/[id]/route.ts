import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { blogs } from "@/lib/db/schema";
import { recordWords } from "@/lib/services/activity";
import { NotFoundError } from "@/lib/errors";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function load(userId: number, id: number) {
  const [blog] = await db
    .select()
    .from(blogs)
    .where(and(eq(blogs.id, id), eq(blogs.userId, userId)))
    .limit(1);
  if (!blog) throw new NotFoundError("Blog not found");
  return blog;
}

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  return ok({ blog: await load(user.id, Number(id)) });
});

const patchSchema = z.object({
  title: z.string().optional(),
  topic: z.string().optional(),
  audience: z.string().optional(),
  goal: z.string().optional(),
  outline: z.array(z.object({ heading: z.string(), notes: z.string().optional() })).optional(),
  contentMd: z.string().optional(),
  status: z.enum(["draft", "published"]).optional(),
  step: z.enum(["topic", "outline", "draft", "polish", "publish"]).optional(),
  publishedUrl: z.string().optional(),
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const blogId = Number(id);
  const existing = await load(user.id, blogId);
  const body = patchSchema.parse(await req.json());

  const [updated] = await db
    .update(blogs)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(blogs.id, blogId))
    .returning();

  // Track words written today when the draft grows.
  if (body.contentMd !== undefined) {
    const before = (existing.contentMd ?? "").split(/\s+/).filter(Boolean).length;
    const after = body.contentMd.split(/\s+/).filter(Boolean).length;
    if (after > before) await recordWords(user.id, after - before);
  }

  return ok({ blog: updated });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await load(user.id, Number(id));
  await db.delete(blogs).where(eq(blogs.id, Number(id)));
  return ok({ ok: true });
});
