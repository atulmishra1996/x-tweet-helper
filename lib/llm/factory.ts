import { generateText, type LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { settings as settingsTable } from "@/lib/db/schema";
import { getApiKey } from "@/lib/config";
import {
  isGoogleLocalProxyEnabled,
  getLocalProxyUrl,
  LOCAL_PROXY_API_KEY,
  checkHealth,
  formatLocalProxyError,
  getLocalProxyMode,
  resolveLocalProxyModel,
} from "@/lib/llm/google-local-proxy";
import { PROVIDERS, defaultModelFor, isProviderId, type ProviderId } from "@/lib/llm/registry";
import { ProviderNotConfiguredError, AppError } from "@/lib/errors";
import { scoped } from "@/lib/logger";

const log = scoped("llm");

export type Feature = "tweet" | "blog" | "general";

export interface ModelSelection {
  provider: ProviderId;
  model: string;
}

/** Build an AI SDK LanguageModel for a provider+model using a resolved key. */
export function buildModel(provider: ProviderId, model: string, apiKey: string): LanguageModel {
  const cfg = PROVIDERS[provider];
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "google":
      if (isGoogleLocalProxyEnabled()) {
        const baseURL = `${getLocalProxyUrl()}/v1`;
        // Local proxies only implement OpenAI Chat Completions, not the Responses API.
        return createOpenAI({ apiKey: LOCAL_PROXY_API_KEY, baseURL }).chat(model);
      }
      return createGoogleGenerativeAI({ apiKey })(model);
    case "grok":
      // Grok is OpenAI-compatible via a custom base URL.
      return createOpenAI({ apiKey, baseURL: cfg.baseURL })(model);
    default:
      throw new AppError("PROVIDER_ERROR", `Unknown provider: ${provider}`, 500);
  }
}

/** Resolve which provider+model to use for a given feature, honoring overrides. */
export async function resolveSelection(userId: number, feature: Feature): Promise<ModelSelection> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId)).limit(1);

  const overrides = (row?.featureOverrides ?? {}) as Record<string, { provider: string; model: string }>;
  const override = feature !== "general" ? overrides[feature] : undefined;

  let provider = (override?.provider ?? row?.activeProvider ?? "openai") as string;
  let model = override?.model ?? row?.activeModel ?? "gpt-4.1";

  if (!isProviderId(provider)) {
    provider = "openai";
    model = defaultModelFor("openai");
  }
  return { provider: provider as ProviderId, model };
}

/** Strip params a provider rejects (e.g. Gemini 3.5: temperature/topP/topK). */
function sanitizeParams(provider: ProviderId, params: Record<string, unknown>): Record<string, unknown> {
  if (provider === "google" && isGoogleLocalProxyEnabled()) return params;
  const unsupported = PROVIDERS[provider].unsupportedParams ?? [];
  if (unsupported.length === 0) return params;
  const clone = { ...params };
  for (const key of unsupported) delete clone[key];
  return clone;
}

export interface GenerateOptions {
  userId: number;
  feature: Feature;
  system?: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GenerateResult {
  text: string;
  provider: ProviderId;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

/**
 * Unified content generation. Callers never know which provider is active —
 * they pass a feature + prompt and get text back.
 */
export async function generate(opts: GenerateOptions): Promise<GenerateResult> {
  let { provider, model } = await resolveSelection(opts.userId, opts.feature);

  const apiKey = await getApiKey(provider, opts.userId);
  if (!apiKey) throw new ProviderNotConfiguredError(provider);

  if (provider === "google" && isGoogleLocalProxyEnabled()) {
    const healthy = await checkHealth();
    if (!healthy) {
      const mode = getLocalProxyMode();
      throw new AppError(
        "PROVIDER_NOT_CONFIGURED",
        formatLocalProxyError("fetch failed", mode),
        503,
      );
    }
    model = await resolveLocalProxyModel(model);
    // Antigravity Pro models are much slower; Flash is better for quick tweet hooks.
    if (opts.feature === "tweet" && !model.includes("flash")) {
      model = "gemini-3-flash";
    }
  }

  const languageModel = buildModel(provider, model, apiKey);

  const baseParams = sanitizeParams(provider, {
    temperature: opts.temperature ?? 0.8,
    maxOutputTokens: opts.maxOutputTokens ?? 1200,
  });

  try {
    const result = await generateText({
      model: languageModel,
      system: opts.system,
      prompt: opts.prompt,
      ...baseParams,
    });
    return {
      text: result.text.trim(),
      provider,
      model,
      usage: {
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
      },
    };
  } catch (err) {
    log.error({ err, provider, model }, "LLM generation failed");
    const raw = err instanceof Error ? err.message : "LLM generation failed";
    const mode = getLocalProxyMode();
    const message =
      provider === "google" && isGoogleLocalProxyEnabled() ? formatLocalProxyError(raw, mode) : raw;
    throw new AppError("PROVIDER_ERROR", message, 502);
  }
}
