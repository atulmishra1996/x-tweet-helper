import { logger } from "@/lib/logger";
import { env } from "@/lib/env";

/**
 * Single choke-point for error reporting. Currently logs via Pino. To enable
 * Sentry, install @sentry/nextjs, set SENTRY_DSN, and forward here — no other
 * code needs to change.
 */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  logger.error({ err, ...context }, "captured exception");
  if (env.SENTRY_DSN) {
    // Placeholder: forward to Sentry once the SDK is installed.
    // import("@sentry/nextjs").then((S) => S.captureException(err));
  }
}
