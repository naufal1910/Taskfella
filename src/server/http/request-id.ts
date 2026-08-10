import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";
export const CORRELATION_ID_HEADER = "x-correlation-id";

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function getSafeHeaderValue(request: Request, name: string): string | undefined {
  const value = request.headers.get(name)?.trim();
  return value && SAFE_ID.test(value) ? value : undefined;
}

export interface RequestContext {
  requestId: string;
  correlationId: string;
}

export function createRequestId(): string {
  return randomUUID();
}

export function getRequestContext(request: Request): RequestContext {
  const requestId = getSafeHeaderValue(request, REQUEST_ID_HEADER) ?? createRequestId();
  const correlationId = getSafeHeaderValue(request, CORRELATION_ID_HEADER) ?? requestId;

  return { requestId, correlationId };
}

export function applyRequestContext(headers: Headers, context: RequestContext): void {
  headers.set(REQUEST_ID_HEADER, context.requestId);
  headers.set(CORRELATION_ID_HEADER, context.correlationId);
}
