/**
 * Provider registry — the single source of truth for which LLM providers and
 * models the app supports. Adding a provider/model is a data change here; no UI
 * or factory rewrites needed.
 */

export type ProviderId = "openai" | "anthropic" | "google" | "grok";

export interface ModelInfo {
  id: string;
  label: string;
}

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  /** Env var that holds this provider's API key (first resolution source). */
  envKey: string;
  /** OpenAI-compatible base URL override (Grok). */
  baseURL?: string;
  /** Parameters this provider/model family rejects; stripped before calls. */
  unsupportedParams?: string[];
  models: ModelInfo[];
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    envKey: "OPENAI_API_KEY",
    models: [
      { id: "gpt-4.1", label: "GPT-4.1" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
      { id: "gpt-4o", label: "GPT-4o" },
    ],
  },
  anthropic: {
    id: "anthropic",
    label: "Claude",
    envKey: "ANTHROPIC_API_KEY",
    models: [
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { id: "claude-3-7-sonnet-latest", label: "Claude 3.7 Sonnet" },
      { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
    ],
  },
  google: {
    id: "google",
    label: "Gemini",
    envKey: "GOOGLE_API_KEY",
    // Gemini 3.5 Flash does not support temperature/topP/topK.
    unsupportedParams: ["temperature", "topP", "topK"],
    models: [
      { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro (High)" },
      { id: "gemini-3-flash", label: "Gemini 3 Flash" },
      { id: "gemini-3.1-pro-low", label: "Gemini 3.1 Pro (Low)" },
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
      { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (API)" },
      { id: "gemini-flash-latest", label: "Gemini Flash (latest)" },
    ],
  },
  grok: {
    id: "grok",
    label: "Grok (xAI)",
    envKey: "XAI_API_KEY",
    baseURL: "https://api.x.ai/v1",
    models: [
      { id: "grok-4.3", label: "Grok 4.3" },
      { id: "grok-3", label: "Grok 3" },
    ],
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export function isProviderId(value: string): value is ProviderId {
  return value in PROVIDERS;
}

export function getProvider(id: ProviderId): ProviderConfig {
  return PROVIDERS[id];
}

export function defaultModelFor(id: ProviderId): string {
  return PROVIDERS[id].models[0].id;
}
