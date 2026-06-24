"use client";

/** Default timeout for API calls (ms). */
const DEFAULT_TIMEOUT_MS = 30_000;
/** Antigravity local bridge can take up to ~2 min per request. */
export const AI_TIMEOUT_MS = 180_000;

export async function apiFetch<T = unknown>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { timeoutMs: _, ...fetchInit } = init ?? {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(fetchInit.headers ?? {}),
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = json?.error?.message ?? `Request failed (${res.status})`;
      const err = new Error(message) as Error & { code?: string };
      err.code = json?.error?.code;
      throw err;
    }
    return json.data as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        timeoutMs >= AI_TIMEOUT_MS
          ? "AI request timed out. Keep Antigravity IDE open on your Mac and try Gemini 3 Flash."
          : "Request timed out. Check your connection to the Mac server.",
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Long-running fetch for LLM routes (Antigravity can be slow). */
export function apiFetchAI<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(url, { ...init, timeoutMs: AI_TIMEOUT_MS });
}
