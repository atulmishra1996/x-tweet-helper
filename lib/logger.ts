import pino from "pino";
import { env } from "@/lib/env";

/**
 * Structured logger. In development we pretty-print; in production we emit JSON
 * lines suitable for log aggregation. Child loggers add scope (e.g. worker name).
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
      : undefined,
  redact: {
    paths: [
      "*.access_token",
      "*.refresh_token",
      "*.apiKey",
      "*.api_key",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[redacted]",
  },
});

export function scoped(scope: string) {
  return logger.child({ scope });
}
