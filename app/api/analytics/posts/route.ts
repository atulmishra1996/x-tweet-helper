import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getPerPost } from "@/lib/analytics";

export const runtime = "nodejs";

export const GET = handle(async (req: Request) => {
  const user = await requireUser();
  const days = Number(new URL(req.url).searchParams.get("days") ?? "30");
  const rows = await getPerPost(user.id, Number.isFinite(days) ? days : 30);
  return ok({ posts: rows });
});
