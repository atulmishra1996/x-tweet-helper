import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { handle, ok, fail } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { providerKeys, auditLog } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { getProviderStatuses } from "@/lib/config";
import { isProviderId } from "@/lib/llm/registry";

export const runtime = "nodejs";

export const GET = handle(async () => {
  const user = await requireUser();
  return ok({ providers: await getProviderStatuses(user.id) });
});

const upsertSchema = z.object({
  providerId: z.string(),
  apiKey: z.string().min(8),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const { providerId, apiKey } = upsertSchema.parse(await req.json());
  if (!isProviderId(providerId)) return fail("VALIDATION_ERROR", "Unknown provider", 422);

  const encrypted = encrypt(apiKey);
  await db
    .insert(providerKeys)
    .values({ userId: user.id, providerId, apiKeyEncrypted: encrypted, enabled: true })
    .onConflictDoUpdate({
      target: [providerKeys.userId, providerKeys.providerId],
      set: { apiKeyEncrypted: encrypted, enabled: true, updatedAt: new Date() },
    });

  await db.insert(auditLog).values({
    userId: user.id,
    action: "provider.key.set",
    entity: providerId,
  });

  return ok({ providers: await getProviderStatuses(user.id) });
});

const deleteSchema = z.object({ providerId: z.string() });

export const DELETE = handle(async (req: Request) => {
  const user = await requireUser();
  const { providerId } = deleteSchema.parse(await req.json());

  await db
    .delete(providerKeys)
    .where(and(eq(providerKeys.userId, user.id), eq(providerKeys.providerId, providerId)));

  await db.insert(auditLog).values({
    userId: user.id,
    action: "provider.key.remove",
    entity: providerId,
  });

  return ok({ providers: await getProviderStatuses(user.id) });
});
