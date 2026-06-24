import { describe, it, expect } from "vitest";
import { isProviderId, defaultModelFor, PROVIDERS, PROVIDER_IDS } from "@/lib/llm/registry";

describe("provider registry", () => {
  it("recognizes valid provider ids", () => {
    expect(isProviderId("openai")).toBe(true);
    expect(isProviderId("grok")).toBe(true);
    expect(isProviderId("nope")).toBe(false);
  });

  it("returns the first model as default", () => {
    for (const id of PROVIDER_IDS) {
      expect(defaultModelFor(id)).toBe(PROVIDERS[id].models[0].id);
    }
  });

  it("marks gemini params as unsupported", () => {
    expect(PROVIDERS.google.unsupportedParams).toContain("temperature");
  });

  it("configures grok with an OpenAI-compatible base URL", () => {
    expect(PROVIDERS.grok.baseURL).toContain("api.x.ai");
  });
});
