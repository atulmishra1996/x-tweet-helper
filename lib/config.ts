import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { providerKeys } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { isGoogleLocalProxyEnabled, LOCAL_PROXY_API_KEY } from "@/lib/llm/google-local-proxy";
import { PROVIDERS, PROVIDER_IDS, type ProviderId } from "@/lib/llm/registry";

/**
 * Config & secrets layer.
 *
 * API keys resolve in layers:
 *   1. Environment variable (machine / secret store) — highest priority.
 *   2. Encrypted key stored in the DB (entered via Settings UI).
 *
 * `getApiKey` returns null when a provider is not configured anywhere, which
 * the UI/factory use to surface a clear "provider not configured" state.
 */

function envKeyFor(providerId: ProviderId): string | null {
  const name = PROVIDERS[providerId].envKey;
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : null;
}

export async function getApiKey(providerId: ProviderId, userId?: number): Promise<string | null> {
  if (providerId === "google" && isGoogleLocalProxyEnabled()) {
    return LOCAL_PROXY_API_KEY;
  }

  const fromEnv = envKeyFor(providerId);
  if (fromEnv) return fromEnv;

  if (userId == null) return null;

  const [row] = await db
    .select()
    .from(providerKeys)
    .where(and(eq(providerKeys.userId, userId), eq(providerKeys.providerId, providerId)))
    .limit(1);

  if (!row || !row.enabled) return null;
  try {
    return decrypt(row.apiKeyEncrypted);
  } catch {
    return null;
  }
}

export interface ProviderStatus {
  id: ProviderId;
  label: string;
  configured: boolean;
  /** Where the key came from, if any. */
  source: "env" | "db" | "local-proxy" | null;
}

/** Returns configured/enabled status for every provider (for the Settings UI). */
export async function getProviderStatuses(userId?: number): Promise<ProviderStatus[]> {
  const dbKeys = userId != null
    ? await db.select().from(providerKeys).where(eq(providerKeys.userId, userId))
    : [];
  const dbByProvider = new Map(dbKeys.map((k) => [k.providerId, k]));

  return PROVIDER_IDS.map((id) => {
    if (id === "google" && isGoogleLocalProxyEnabled()) {
      return { id, label: PROVIDERS[id].label, configured: true, source: "local-proxy" as const };
    }
    if (envKeyFor(id)) {
      return { id, label: PROVIDERS[id].label, configured: true, source: "env" as const };
    }
    const dbRow = dbByProvider.get(id);
    if (dbRow && dbRow.enabled) {
      return { id, label: PROVIDERS[id].label, configured: true, source: "db" as const };
    }
    return { id, label: PROVIDERS[id].label, configured: false, source: null };
  });
}

export async function configuredProviderIds(userId?: number): Promise<ProviderId[]> {
  const statuses = await getProviderStatuses(userId);
  return statuses.filter((s) => s.configured).map((s) => s.id);
}
