import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { lookupTweet } from "@/lib/x/client";
import { parseTweetIdFromUrl } from "@/lib/x/tweet-url";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";

const schema = z.object({ url: z.string().min(1) });

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { url } = schema.parse(await req.json());
  const tweetId = parseTweetIdFromUrl(url);
  if (!tweetId) {
    throw new AppError("VALIDATION_ERROR", "Invalid tweet URL. Paste an x.com or twitter.com status link.", 422);
  }
  const tweet = await lookupTweet(user, tweetId);
  return ok({ tweet });
});
