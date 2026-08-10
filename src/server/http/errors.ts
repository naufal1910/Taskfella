import { NextResponse } from "next/server";

export type AppErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_VERIFIED"
  | "TOKEN_INVALID"
  | "TOKEN_EXPIRED"
  | "TOKEN_ALREADY_USED"
  | "TOKEN_SUPERSEDED"
  | "EMAIL_DELIVERY_FAILED"
  | "DATABASE_UNAVAILABLE"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

const statusByCode: Record<AppErrorCode, number> = {
  INVALID_REQUEST: 400,
  INVALID_CREDENTIALS: 401,
  EMAIL_NOT_VERIFIED: 403,
  TOKEN_INVALID: 400,
  TOKEN_EXPIRED: 410,
  TOKEN_ALREADY_USED: 409,
  TOKEN_SUPERSEDED: 410,
  EMAIL_DELIVERY_FAILED: 503,
  DATABASE_UNAVAILABLE: 503,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

const messageByCode: Record<AppErrorCode, string> = {
  INVALID_REQUEST: "The request could not be processed.",
  INVALID_CREDENTIALS: "The email or password is incorrect.",
  EMAIL_NOT_VERIFIED: "Check your email to verify your address before signing in.",
  TOKEN_INVALID: "This link is invalid.",
  TOKEN_EXPIRED: "This link has expired. Request a new one.",
  TOKEN_ALREADY_USED: "This link has already been used.",
  TOKEN_SUPERSEDED: "This link has been replaced. Request a new one.",
  EMAIL_DELIVERY_FAILED: "We could not send that message. Try again later.",
  DATABASE_UNAVAILABLE: "The service is temporarily unable to reach its database.",
  NOT_FOUND: "The requested resource was not found.",
  CONFLICT: "The request conflicts with the current application state.",
  UNAUTHORIZED: "Authentication is required.",
  FORBIDDEN: "The request is not allowed.",
  RATE_LIMITED: "Too many requests. Try again later.",
  INTERNAL_ERROR: "An unexpected error occurred.",
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly publicMessage: string;
  readonly retryAfterSeconds?: number;

  constructor(
    code: AppErrorCode,
    message = messageByCode[code],
    options: { retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = statusByCode[code];
    this.publicMessage = message;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export function toAppError(error: unknown): AppError {
  return error instanceof AppError ? error : new AppError("INTERNAL_ERROR");
}

export function appErrorResponse(error: unknown, requestId: string): NextResponse {
  const appError = toAppError(error);

  return NextResponse.json(
    {
      error: {
        code: appError.code,
        message: appError.publicMessage,
      },
      requestId,
    },
    {
      status: appError.status,
      headers: {
        "cache-control": "no-store",
        "x-request-id": requestId,
        ...(appError.retryAfterSeconds
          ? { "retry-after": String(appError.retryAfterSeconds) }
          : {}),
      },
    },
  );
}
