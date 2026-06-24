import { z } from "zod";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getGrowthSeries, getRecommendations, getLatestRecap, logManualGrowth } from "@/lib/growth";

export const runtime = "nodejs";

export const GET = handle(async () => {
  const user = await requireUser();
  const [series, recommendations, recap] = await Promise.all([
    getGrowthSeries(user.id),
    getRecommendations(user.id),
    getLatestRecap(user.id),
  ]);
  return ok({ series, recommendations, recap });
});

const manualSchema = z.object({
  followers: z.number().int().nonnegative().optional(),
  xSubscribers: z.number().int().nonnegative().optional(),
  xSubRevenueCents: z.number().int().nonnegative().optional(),
  newsletterSubscribers: z.number().int().nonnegative().optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const input = manualSchema.parse(await req.json());
  await logManualGrowth(user.id, input);
  const series = await getGrowthSeries(user.id);
  return ok({ series });
});
