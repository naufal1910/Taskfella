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
  | "OAUTH_NOT_CONFIGURED"
  | "OAUTH_STATE_INVALID"
  | "OAUTH_PROVIDER_ERROR"
  | "OAUTH_CANCELLED"
  | "IDENTITY_CONFLICT"
  | "IDENTITY_ALREADY_LINKED"
  | "ACCOUNT_LINK_REQUIRED"
  | "OAUTH_SESSION_INVALID"
  | "BOARD_INVARIANT_VIOLATION"
  | "WORKFLOW_CONFIRMATION_REQUIRED"
  | "WIP_LIMIT_REACHED"
  | "WIP_CONFIRMATION_REQUIRED"
  | "COLUMN_NOT_EMPTY"
  | "PROJECT_NOT_ARCHIVED"
  | "PERMANENT_DELETE_CONFIRMATION_REQUIRED"
  | "CONCURRENT_UPDATE"
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
  OAUTH_NOT_CONFIGURED: 503,
  OAUTH_STATE_INVALID: 400,
  OAUTH_PROVIDER_ERROR: 502,
  OAUTH_CANCELLED: 400,
  IDENTITY_CONFLICT: 409,
  IDENTITY_ALREADY_LINKED: 409,
  ACCOUNT_LINK_REQUIRED: 409,
  OAUTH_SESSION_INVALID: 401,
  BOARD_INVARIANT_VIOLATION: 409,
  WORKFLOW_CONFIRMATION_REQUIRED: 409,
  WIP_LIMIT_REACHED: 409,
  WIP_CONFIRMATION_REQUIRED: 409,
  COLUMN_NOT_EMPTY: 409,
  PROJECT_NOT_ARCHIVED: 409,
  PERMANENT_DELETE_CONFIRMATION_REQUIRED: 409,
  CONCURRENT_UPDATE: 409,
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
  OAUTH_NOT_CONFIGURED: "Google sign-in is not configured for this environment.",
  OAUTH_STATE_INVALID: "The Google sign-in request is invalid or has expired. Try again.",
  OAUTH_PROVIDER_ERROR: "Google sign-in could not be completed. Try again.",
  OAUTH_CANCELLED: "Google sign-in was cancelled. You can try again.",
  IDENTITY_CONFLICT: "That Google identity is already linked to another account.",
  IDENTITY_ALREADY_LINKED: "That Google identity is already linked to this account.",
  ACCOUNT_LINK_REQUIRED: "Sign in with your existing method, then link Google from your account.",
  OAUTH_SESSION_INVALID: "Your account session expired. Sign in and try again.",
  BOARD_INVARIANT_VIOLATION: "Keep exactly one active column and at least one completed column.",
  WORKFLOW_CONFIRMATION_REQUIRED:
    "This change can change what completed means for existing work. Confirm it before saving.",
  WIP_LIMIT_REACHED: "That column has reached its enforced WIP limit.",
  WIP_CONFIRMATION_REQUIRED: "That move would exceed the column WIP limit. Confirm to continue.",
  COLUMN_NOT_EMPTY: "Only empty columns can be deleted.",
  PROJECT_NOT_ARCHIVED: "The project is not archived.",
  PERMANENT_DELETE_CONFIRMATION_REQUIRED:
    "Permanent deletion requires typing the project name exactly.",
  CONCURRENT_UPDATE: "This workflow changed elsewhere. Reload and try again.",
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
