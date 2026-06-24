import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { ideas } from "@/lib/db/schema";

export const runtime = "nodejs";

export const GET = handle(async (req: Request) => {
  const user = await requireUser();
  const status = new URL(req.url).searchParams.get("status") ?? "inbox";
  const rows = await db
    .select()
    .from(ideas)
    .where(and(eq(ideas.userId, user.id), eq(ideas.status, status)))
    .orderBy(desc(ideas.createdAt))
    .limit(200);
  return ok({ ideas: rows });
});

const createSchema = z.object({
  text: z.string().min(1),
  tags: z.array(z.string()).optional(),
  sourceUrl: z.string().url().optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = createSchema.parse(await req.json());
  const [idea] = await db
    .insert(ideas)
    .values({ userId: user.id, text: body.text, tags: body.tags ?? [], sourceUrl: body.sourceUrl })
    .returning();
  return ok({ idea }, { status: 201 });
});
