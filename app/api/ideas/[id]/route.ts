import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { ideas } from "@/lib/db/schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  text: z.string().optional(),
  status: z.enum(["inbox", "used", "archived"]).optional(),
  tags: z.array(z.string()).optional(),
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = patchSchema.parse(await req.json());
  const [updated] = await db
    .update(ideas)
    .set(body)
    .where(and(eq(ideas.id, Number(id)), eq(ideas.userId, user.id)))
    .returning();
  return ok({ idea: updated });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await db.delete(ideas).where(and(eq(ideas.id, Number(id)), eq(ideas.userId, user.id)));
  return ok({ ok: true });
});
