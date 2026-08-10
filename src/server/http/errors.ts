import { NextResponse } from "next/server";

export type AppErrorCode =
  "INVALID_REQUEST" | "DATABASE_UNAVAILABLE" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_ERROR";

const statusByCode: Record<AppErrorCode, number> = {
  INVALID_REQUEST: 400,
  DATABASE_UNAVAILABLE: 503,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

const messageByCode: Record<AppErrorCode, string> = {
  INVALID_REQUEST: "The request could not be processed.",
  DATABASE_UNAVAILABLE: "The service is temporarily unable to reach its database.",
  NOT_FOUND: "The requested resource was not found.",
  CONFLICT: "The request conflicts with the current application state.",
  INTERNAL_ERROR: "An unexpected error occurred.",
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly publicMessage: string;

  constructor(code: AppErrorCode, message = messageByCode[code]) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = statusByCode[code];
    this.publicMessage = message;
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
      },
    },
  );
}
