import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getBestTime } from "@/lib/analytics";

export const runtime = "nodejs";

export const GET = handle(async () => {
  const user = await requireUser();
  return ok({ cells: await getBestTime(user.id) });
});
