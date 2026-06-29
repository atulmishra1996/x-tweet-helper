import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, RateLimitError } from "@/lib/errors";
import { scoped } from "@/lib/logger";
import { captureException } from "@/lib/observability";

const log = scoped("api");

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function fail(code: string, message: string, status = 400, details?: unknown) {
  const headers: Record<string, string> = {};
  if (
    status === 429 &&
    details &&
    typeof details === "object" &&
    "retryAfter" in details &&
    typeof (details as any).retryAfter === "number"
  ) {
    headers["Retry-After"] = String((details as any).retryAfter);
  }
  return NextResponse.json({ error: { code, message, details } }, { status, headers });
}

/** Wrap a route handler with consistent error handling. */
export function handle<Args extends unknown[]>(fn: (...args: Args) => Promise<NextResponse>) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof RateLimitError) {
        return fail(err.code, err.message, err.status, { retryAfter: err.retryAfterSeconds });
      }
      if (err instanceof AppError) {
        if (err.status >= 500) log.error({ err }, err.message);
        return fail(err.code, err.message, err.status, err.details);
      }
      if (err instanceof ZodError) {
        return fail("VALIDATION_ERROR", "Invalid request", 422, err.flatten());
      }
      captureException(err, { scope: "api" });
      return fail("INTERNAL", "Something went wrong", 500);
    }
  };
}
