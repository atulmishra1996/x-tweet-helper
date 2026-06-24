import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { logManualPosts } from "@/lib/services/manual-post-log";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";

const schema = z
  .object({
    count: z.number().int().min(1).max(20).optional(),
    posts: z
      .array(
        z.object({
          text: z.string().min(1).max(4000),
          type: z.enum(["tweet", "thread"]).optional(),
        }),
      )
      .min(1)
      .max(20)
      .optional(),
  })
  .refine((v) => v.count != null || (v.posts != null && v.posts.length > 0), {
    message: "Provide count or posts",
  });

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = schema.parse(await req.json());

  const items = body.posts?.length
    ? body.posts
    : Array.from({ length: body.count! }, () => ({ text: "(Posted manually on X)" }));

  const logged = await logManualPosts(user.id, items);
  if (logged === 0) throw new AppError("VALIDATION_ERROR", "Nothing to log", 422);

  return ok({ logged });
});
