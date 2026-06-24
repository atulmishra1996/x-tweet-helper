import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    ANTIGRAVITY_PROXY_URL: undefined as string | undefined,
    ANTIGRAVITY_PROXY_ENABLED: false,
    GEMINI_CLI_PROXY_URL: undefined as string | undefined,
    GOOGLE_API_KEY: undefined as string | undefined,
    GEMINI_CLI_PROXY_ENABLED: false,
  },
}));

import { env } from "@/lib/env";
import {
  isAntigravityProxyEnabled,
  isGoogleLocalProxyEnabled,
  getLocalProxyMode,
  formatLocalProxyError,
} from "@/lib/llm/google-local-proxy";

describe("google-local-proxy", () => {
  beforeEach(() => {
    env.ANTIGRAVITY_PROXY_URL = undefined;
    env.ANTIGRAVITY_PROXY_ENABLED = false;
    env.GEMINI_CLI_PROXY_URL = undefined;
    env.GOOGLE_API_KEY = undefined;
    env.GEMINI_CLI_PROXY_ENABLED = false;
  });

  it("prefers antigravity over gemini-cli", () => {
    env.ANTIGRAVITY_PROXY_URL = "http://127.0.0.1:4000";
    env.GEMINI_CLI_PROXY_URL = "http://127.0.0.1:8317";
    expect(getLocalProxyMode()).toBe("antigravity");
    expect(isGoogleLocalProxyEnabled()).toBe(true);
  });

  it("is disabled without proxy URL", () => {
    expect(isGoogleLocalProxyEnabled()).toBe(false);
  });

  it("enables antigravity when URL set and no API key", () => {
    env.ANTIGRAVITY_PROXY_URL = "http://127.0.0.1:4000";
    expect(isAntigravityProxyEnabled()).toBe(true);
  });

  it("prefers API key when both set unless forced", () => {
    env.ANTIGRAVITY_PROXY_URL = "http://127.0.0.1:4000";
    env.GOOGLE_API_KEY = "AIza-test";
    expect(isAntigravityProxyEnabled()).toBe(false);
    env.ANTIGRAVITY_PROXY_ENABLED = true;
    expect(isAntigravityProxyEnabled()).toBe(true);
  });

  it("formats connection errors", () => {
    expect(formatLocalProxyError("fetch failed", "antigravity")).toContain("Antigravity");
    expect(formatLocalProxyError("403 PERMISSION_DENIED", "antigravity")).toContain("403");
  });
});
