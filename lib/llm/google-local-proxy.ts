import { env } from "@/lib/env";
import { PROVIDERS, type ModelInfo } from "@/lib/llm/registry";

const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8_000;

/** Placeholder key for OpenAI-compatible local proxies (ignored server-side). */
export const LOCAL_PROXY_API_KEY = "local";

export type LocalProxyMode = "antigravity" | "gemini-cli";

let modelsCache: { models: ModelInfo[]; fetchedAt: number; mode: LocalProxyMode } | null = null;

function isTruthyFlag(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

/** Antigravity desktop app bridge (open-antigravity on port 4000). */
export function isAntigravityProxyEnabled(): boolean {
  const url = env.ANTIGRAVITY_PROXY_URL?.trim();
  if (!url) return false;
  if (env.GOOGLE_API_KEY?.trim() && !env.ANTIGRAVITY_PROXY_ENABLED) return false;
  return true;
}

/** Legacy Gemini CLI OAuth bridge (deprecated for individual Pro accounts). */
export function isGeminiCliProxyEnabled(): boolean {
  if (isAntigravityProxyEnabled()) return false;
  const url = env.GEMINI_CLI_PROXY_URL?.trim();
  if (!url) return false;
  if (env.GOOGLE_API_KEY?.trim() && !env.GEMINI_CLI_PROXY_ENABLED) return false;
  return true;
}

export function getLocalProxyMode(): LocalProxyMode | null {
  if (isAntigravityProxyEnabled()) return "antigravity";
  if (isGeminiCliProxyEnabled()) return "gemini-cli";
  return null;
}

export function isGoogleLocalProxyEnabled(): boolean {
  return getLocalProxyMode() != null;
}

export function getLocalProxyUrl(): string | null {
  const mode = getLocalProxyMode();
  if (mode === "antigravity") return env.ANTIGRAVITY_PROXY_URL!.replace(/\/$/, "");
  if (mode === "gemini-cli") return env.GEMINI_CLI_PROXY_URL!.replace(/\/$/, "");
  return null;
}

const ANTIGRAVITY_MODEL_LABELS: Record<string, string> = {
  "gemini-3.1-pro": "Gemini 3.1 Pro (High)",
  "gemini-3.1-pro-low": "Gemini 3.1 Pro (Low)",
  "gemini-3-flash": "Gemini 3 Flash",
};

function labelForModelId(id: string): string {
  if (ANTIGRAVITY_MODEL_LABELS[id]) return ANTIGRAVITY_MODEL_LABELS[id];
  const known = PROVIDERS.google.models.find((m) => m.id === id);
  if (known) return known.label;
  return id.replace(/^gemini-/, "Gemini ").replace(/-/g, " ");
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

function healthPath(mode: LocalProxyMode): string {
  return mode === "antigravity" ? "/health" : "/";
}

/** Health check for the active local proxy. */
export async function checkHealth(): Promise<boolean> {
  const mode = getLocalProxyMode();
  const base = getLocalProxyUrl();
  if (!mode || !base) return false;
  try {
    const res = await fetchWithTimeout(`${base}${healthPath(mode)}`);
    return res.ok;
  } catch {
    return false;
  }
}

interface OpenAIModelsResponse {
  data?: Array<{ id: string }>;
}

/** GET /v1/models with a short-lived cache. */
export async function listModels(force = false): Promise<ModelInfo[]> {
  const mode = getLocalProxyMode();
  const fallback = PROVIDERS.google.models;
  const base = getLocalProxyUrl();
  if (!mode || !base) return fallback;

  if (
    !force &&
    modelsCache &&
    modelsCache.mode === mode &&
    Date.now() - modelsCache.fetchedAt < CACHE_TTL_MS
  ) {
    return modelsCache.models;
  }

  try {
    const res = await fetchWithTimeout(`${base}/v1/models`);
    if (!res.ok) return modelsCache?.models ?? fallback;

    const body = (await res.json()) as OpenAIModelsResponse;
    const ids = (body.data ?? []).map((m) => m.id).filter(Boolean);
    if (ids.length === 0) return modelsCache?.models ?? fallback;

    const geminiIds =
      mode === "antigravity"
        ? ids.filter((id) => id.startsWith("gemini") || id.startsWith("MODEL_PLACEHOLDER_M"))
        : ids;

    const useIds = geminiIds.length > 0 ? geminiIds : ids;
    const models = useIds.map((id) => ({ id, label: labelForModelId(id) }));
    modelsCache = { models, fetchedAt: Date.now(), mode };
    return models;
  } catch {
    return modelsCache?.models ?? fallback;
  }
}

export interface LocalProxyConnectionStatus {
  enabled: boolean;
  mode: LocalProxyMode | null;
  proxyUrl: string | null;
  connected: boolean;
  models: ModelInfo[];
  error?: string;
}

export async function getConnectionStatus(): Promise<LocalProxyConnectionStatus> {
  const mode = getLocalProxyMode();
  const proxyUrl = getLocalProxyUrl();
  if (!mode || !proxyUrl) {
    return { enabled: false, mode: null, proxyUrl: null, connected: false, models: PROVIDERS.google.models };
  }

  const healthy = await checkHealth();
  if (!healthy) {
    return {
      enabled: true,
      mode,
      proxyUrl,
      connected: false,
      models: PROVIDERS.google.models,
      error: offlineMessage(mode),
    };
  }

  const models = await listModels();
  return { enabled: true, mode, proxyUrl, connected: true, models };
}

function offlineMessage(mode: LocalProxyMode): string {
  if (mode === "antigravity") {
    return "Antigravity proxy not reachable. Keep Antigravity IDE open with a workspace, then run `npm run antigravity:proxy`.";
  }
  return "Gemini CLI proxy not reachable. Run `npm run gemini:proxy` (deprecated for Pro accounts — use Antigravity instead).";
}

/** Map API-only model IDs to names the local Antigravity bridge accepts. */
export async function resolveLocalProxyModel(model: string): Promise<string> {
  const available = await listModels();
  const ids = new Set(available.map((m) => m.id));
  if (ids.has(model)) return model;

  const aliases: Record<string, string> = {
    "gemini-flash-latest": "gemini-3-flash",
    "gemini-3.5-flash": "gemini-3-flash",
    "gemini-3.1-pro-preview": "gemini-3.1-pro",
  };
  const mapped = aliases[model];
  if (mapped && ids.has(mapped)) return mapped;
  return available[0]?.id ?? "gemini-3-flash";
}

export function formatLocalProxyError(message: string, mode?: LocalProxyMode | null): string {
  const lower = message.toLowerCase();
  const active = mode ?? getLocalProxyMode();
  if (lower.includes("econnrefused") || lower.includes("fetch failed") || lower.includes("abort")) {
    return active ? offlineMessage(active) : offlineMessage("antigravity");
  }
  if (lower.includes("403") || lower.includes("permission_denied")) {
    return "Local proxy auth failed (403). Ensure Antigravity IDE is signed in, or fall back to GOOGLE_API_KEY.";
  }
  if (lower.includes("not found") || lower.includes("not_found")) {
    return "Local proxy endpoint not found. Restart the app after updating — Antigravity uses Chat Completions only.";
  }
  if (lower.includes("429") || lower.includes("resource_exhausted")) {
    return "Local proxy quota exceeded. Wait and retry, or use GOOGLE_API_KEY.";
  }
  return message;
}

// Back-compat aliases used during migration
export const GEMINI_CLI_PROXY_API_KEY = LOCAL_PROXY_API_KEY;
