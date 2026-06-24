import { z } from "zod";

/**
 * Centralized, Zod-validated environment access.
 *
 * Required infra vars (DATABASE_URL, ENCRYPTION_KEY, SESSION_SECRET) fail fast
 * in production. In development we fall back to safe local defaults and warn,
 * so the app boots before you finish wiring credentials.
 *
 * Provider/X keys are intentionally optional here — they are feature-gated at
 * runtime via the config layer, so the app runs with any subset configured.
 */

const isProd = process.env.NODE_ENV === "production";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),

  // X OAuth
  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),
  X_CALLBACK_URL: z.string().url().default("http://localhost:3000/api/auth/x/callback"),

  // LLM providers (optional; feature-gated)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  /** Local open-antigravity bridge (Antigravity.app + subscription). */
  ANTIGRAVITY_PROXY_URL: z.string().url().optional(),
  /** When true, prefer Antigravity proxy over GOOGLE_API_KEY if both are set. */
  ANTIGRAVITY_PROXY_ENABLED: z.string().optional(),
  /** Legacy gemini-cli-api-wrapper URL (deprecated for individual Pro accounts). */
  GEMINI_CLI_PROXY_URL: z.string().url().optional(),
  GEMINI_CLI_PROXY_ENABLED: z.string().optional(),
  XAI_API_KEY: z.string().optional(),

  // Infra
  DATABASE_URL: z.string().min(1).optional(),
  ENCRYPTION_KEY: z.string().optional(),
  SESSION_SECRET: z.string().optional(),

  // Observability
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // Cron auth (Vercel cron / external scheduler)
  CRON_SECRET: z.string().optional(),
});

const DEV_DEFAULTS = {
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/twitter_helper",
  // 64 hex chars (32 bytes). Dev-only; production must supply its own.
  ENCRYPTION_KEY: "0".repeat(64),
  SESSION_SECRET: "dev-session-secret-change-me",
};

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;

  const missing: string[] = [];
  if (!env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!env.ENCRYPTION_KEY) missing.push("ENCRYPTION_KEY");
  if (!env.SESSION_SECRET) missing.push("SESSION_SECRET");

  if (missing.length > 0) {
    if (isProd) {
      throw new Error(`Missing required environment variables in production: ${missing.join(", ")}`);
    }
    // Dev fallback with a loud warning.
    // eslint-disable-next-line no-console
    console.warn(
      `[env] Using insecure development defaults for: ${missing.join(", ")}. ` +
        `Set these in .env.local before deploying.`,
    );
  }

  return {
    ...env,
    DATABASE_URL: env.DATABASE_URL ?? DEV_DEFAULTS.DATABASE_URL,
    ENCRYPTION_KEY: env.ENCRYPTION_KEY ?? DEV_DEFAULTS.ENCRYPTION_KEY,
    SESSION_SECRET: env.SESSION_SECRET ?? DEV_DEFAULTS.SESSION_SECRET,
    GEMINI_CLI_PROXY_ENABLED:
      env.GEMINI_CLI_PROXY_ENABLED === "true" || env.GEMINI_CLI_PROXY_ENABLED === "1",
    ANTIGRAVITY_PROXY_ENABLED:
      env.ANTIGRAVITY_PROXY_ENABLED === "true" || env.ANTIGRAVITY_PROXY_ENABLED === "1",
  };
}

export const env = load();
export type Env = typeof env;
