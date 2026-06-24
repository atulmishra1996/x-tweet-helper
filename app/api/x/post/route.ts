import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { publishPost } from "@/lib/services/posting";

export const runtime = "nodejs";

const schema = z.object({ postId: z.number().int() });

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { postId } = schema.parse(await req.json());
  const post = await publishPost(user.id, postId);
  return ok({ post });
});
