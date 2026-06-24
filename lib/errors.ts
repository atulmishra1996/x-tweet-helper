/** Application error types with stable codes for consistent API responses. */

export type ErrorCode =
  | "UNAUTHORIZED"
  | "PROVIDER_NOT_CONFIGURED"
  | "PROVIDER_ERROR"
  | "X_API_ERROR"
  | "X_RATE_LIMITED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "INTERNAL";

export class AppError extends Error {
  code: ErrorCode;
  status: number;
  details?: unknown;

  constructor(code: ErrorCode, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Not authenticated") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ProviderNotConfiguredError extends AppError {
  constructor(provider: string) {
    super("PROVIDER_NOT_CONFIGURED", `Provider "${provider}" is not configured. Add an API key in Settings.`, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super("NOT_FOUND", message, 404);
  }
}

export class RateLimitedError extends AppError {
  retryAfterSeconds?: number;
  constructor(message = "Rate limited by X API", retryAfterSeconds?: number) {
    super("X_RATE_LIMITED", message, 429);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
