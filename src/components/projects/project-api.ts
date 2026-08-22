export interface ProjectColumnData {
  id: string;
  projectId: string;
  name: string;
  role: "queued" | "planned" | "active" | "review" | "completed" | "neutral";
  position: number;
  wipMode: "none" | "warn" | "enforce";
  wipLimit: number | null;
  completedGrouping: "list" | "date";
}

export interface SwimlaneData {
  id: string;
  projectId: string;
  name: string;
  position: number;
}

export interface LabelData {
  id: string;
  projectId: string;
  name: string;
  normalizedName: string;
  color: string;
  position: number;
}

export interface ProjectData {
  id: string;
  accountId: string;
  name: string;
  description: string;
  status: "active" | "archived";
  position: number;
  revision: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  columnCount?: number;
  columns?: ProjectColumnData[];
  swimlanes?: SwimlaneData[];
  labels?: LabelData[];
  lifecycle?: Array<{ id: string; event: string; createdAt: string }>;
}

export function errorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string") return error.message;
  }
  return fallback;
}

function readCsrfCookie(): string | undefined {
  const prefix = "taskfella_csrf=";
  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!value) return undefined;
  try {
    return decodeURIComponent(value.slice(prefix.length));
  } catch {
    return undefined;
  }
}

export async function csrfToken(): Promise<string> {
  await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
  const token = readCsrfCookie();
  if (!token) throw new Error("csrf");
  return token;
}

export async function apiRequest<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (method !== "GET" && method !== "HEAD") {
    headers.set("content-type", "application/json");
    headers.set("x-csrf-token", await csrfToken());
  }
  const response = await fetch(input, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(errorMessage(payload, "We could not save that change."));
    (error as Error & { status?: number; code?: string }).status = response.status;
    (error as Error & { status?: number; code?: string }).code = (
      payload as { error?: { code?: string } }
    ).error?.code;
    throw error;
  }
  return payload as T;
}
