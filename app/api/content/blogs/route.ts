import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { blogs } from "@/lib/db/schema";

export const runtime = "nodejs";

export const GET = handle(async () => {
  const user = await requireUser();
  const rows = await db
    .select()
    .from(blogs)
    .where(eq(blogs.userId, user.id))
    .orderBy(desc(blogs.updatedAt))
    .limit(200);
  return ok({ blogs: rows });
});

const createSchema = z.object({
  title: z.string().default("Untitled"),
  topic: z.string().optional(),
  audience: z.string().optional(),
  goal: z.string().optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = createSchema.parse(await req.json().catch(() => ({})));
  const [blog] = await db
    .insert(blogs)
    .values({ userId: user.id, title: body.title, topic: body.topic, audience: body.audience, goal: body.goal })
    .returning();
  return ok({ blog }, { status: 201 });
});
