import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { syncGrowthForUser } from "@/lib/services/growth-sync";
import { getGrowthSeries } from "@/lib/growth";

export const runtime = "nodejs";

/** Manually trigger a follower snapshot now (in addition to the daily worker). */
export const POST = handle(async () => {
  const user = await requireUser();
  await syncGrowthForUser(user);
  return ok({ series: await getGrowthSeries(user.id) });
});
