import { z } from "zod";
import { eq } from "drizzle-orm";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { settings as settingsTable, auditLog } from "@/lib/db/schema";
import { getOrCreateSettings } from "@/lib/settings";
import { getProviderStatuses } from "@/lib/config";
import { getConnectionStatus } from "@/lib/llm/google-local-proxy";
import { PROVIDERS } from "@/lib/llm/registry";

export const runtime = "nodejs";

export const GET = handle(async () => {
  const user = await requireUser();
  const settings = await getOrCreateSettings(user.id);
  const [providers, localProxy] = await Promise.all([
    getProviderStatuses(user.id),
    getConnectionStatus(),
  ]);
  return ok({ settings, providers, registry: PROVIDERS, localProxy });
});

const updateSchema = z.object({
  activeProvider: z.string().optional(),
  activeModel: z.string().optional(),
  featureOverrides: z.record(z.string(), z.object({ provider: z.string(), model: z.string() })).optional(),
  voicePrompt: z.string().optional(),
  metricSyncHours: z.number().int().min(1).max(168).optional(),
  dailyGoal: z.number().int().min(0).max(50).optional(),
  weeklyGoal: z.number().int().min(0).max(200).optional(),
});

export const PUT = handle(async (req: Request) => {
  const user = await requireUser();
  await getOrCreateSettings(user.id);
  const patch = updateSchema.parse(await req.json());

  const [updated] = await db
    .update(settingsTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(settingsTable.userId, user.id))
    .returning();

  if (patch.activeProvider || patch.activeModel) {
    await db.insert(auditLog).values({
      userId: user.id,
      action: "provider.switch",
      entity: "settings",
      metadata: { activeProvider: updated.activeProvider, activeModel: updated.activeModel },
    });
  }

  return ok({ settings: updated });
});
