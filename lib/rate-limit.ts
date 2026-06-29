/**
 * Simple in-memory rate limiter.
 *
 * Good enough for a personal/single-user tool. Resets on server restart.
 * For stronger persistence across restarts/workers you can swap the
 * implementation for a small DB table later.
 */

const buckets = new Map<string, number[]>();

/**
 * Check whether the action is allowed under the given limit.
 *
 * @param key     Unique key, e.g. `ai:${userId}:tweet`
 * @param limit   Max number of allowed events in the window
 * @param windowMs Window size in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const cutoff = now - windowMs;

  let timestamps = buckets.get(key) ?? [];
  timestamps = timestamps.filter((t) => t > cutoff);

  if (timestamps.length >= limit) {
    // Oldest allowed request determines when the next slot opens
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((timestamps[0] + windowMs - now) / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  }

  timestamps.push(now);
  buckets.set(key, timestamps);

  // Opportunistic cleanup: keep map from growing forever
  if (buckets.size > 1000) {
    // crude cleanup of empty buckets (rare)
    for (const [k, v] of buckets) {
      if (v.length === 0) buckets.delete(k);
    }
  }

  return { allowed: true };
}

/** Convenience helpers for AI routes */
export const AI_LIMITS = {
  tweet: { limit: 10, windowMs: 60_000 }, // 10 generations per minute
  blog: { limit: 5, windowMs: 120_000 },  // blog is heavier: 5 per 2 minutes
} as const;

export function checkAiRateLimit(userId: number, feature: "tweet" | "blog") {
  const { limit, windowMs } = AI_LIMITS[feature];
  return checkRateLimit(`ai:${userId}:${feature}`, limit, windowMs);
}
