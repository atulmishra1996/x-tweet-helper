import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { postTweet } from "@/lib/x/client";
import { NotFoundError } from "@/lib/errors";

export const runtime = "nodejs";

const schema = z
  .object({
    text: z.string().min(1).max(280),
    replyToTweetId: z.string().optional(),
    quoteTweetId: z.string().optional(),
  })
  .refine((v) => !(v.replyToTweetId && v.quoteTweetId), {
    message: "Choose either a reply or a quote repost, not both.",
  });

export const POST = handle(async (req: Request) => {
  const sessionUser = await requireUser();
  const body = schema.parse(await req.json());

  const [user] = await db.select().from(users).where(eq(users.id, sessionUser.id)).limit(1);
  if (!user) throw new NotFoundError("User not found");

  const tweet = await postTweet(user, body.text.trim(), {
    replyToId: body.replyToTweetId,
    quoteTweetId: body.quoteTweetId,
  });

  return ok({ tweet });
});
