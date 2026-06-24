import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getOverview, engagementRate } from "@/lib/analytics";

export const runtime = "nodejs";

export const GET = handle(async (req: Request) => {
  const user = await requireUser();
  const days = Number(new URL(req.url).searchParams.get("days") ?? "7");
  const overview = await getOverview(user.id, Number.isFinite(days) ? days : 7);
  return ok({ overview, prevEngagementRate: engagementRate(overview.previous) });
});
