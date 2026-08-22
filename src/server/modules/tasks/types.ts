import { AppError } from "@/server/http/errors";
import { normalizeColor, normalizeUuid } from "@/server/modules/projects/types";
import { normalizePlainText, sanitizeMarkdown } from "./markdown";

export const DUE_DATE_STATES = ["overdue", "today", "this-week", "no-date", "has-date"] as const;
export type DueDateState = (typeof DUE_DATE_STATES)[number];

export interface TaskCreateInput {
  title: unknown;
  description?: unknown;
  columnId?: unknown;
  swimlaneId?: unknown;
  labelIds?: unknown;
  color?: unknown;
  dueDate?: unknown;
  position?: unknown;
  warningConfirmed?: unknown;
}

export interface TaskPatchInput {
  title?: unknown;
  description?: unknown;
  columnId?: unknown;
  swimlaneId?: unknown;
  labelIds?: unknown;
  color?: unknown;
  dueDate?: unknown;
  position?: unknown;
  warningConfirmed?: unknown;
  expectedRevision?: unknown;
}

export interface TaskMoveInput {
  columnId: unknown;
  swimlaneId?: unknown;
  position?: unknown;
  warningConfirmed?: unknown;
}

export interface TaskListInput {
  search?: unknown;
  labelId?: unknown;
  color?: unknown;
  due?: unknown;
  columnId?: unknown;
  swimlaneId?: unknown;
  includeTrash?: unknown;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeTaskTitle(value: unknown): string {
  return normalizePlainText(value, 240);
}

export function normalizeTaskDescription(value: unknown): string {
  if (value === undefined) return "";
  return sanitizeMarkdown(value, 50_000);
}

export function normalizeTaskColor(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return normalizeColor(value);
}

export function normalizeDueDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) {
    throw new AppError("INVALID_REQUEST");
  }
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new AppError("INVALID_REQUEST");
  }
  return value;
}

export function normalizeTaskPosition(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 2_147_483_647) {
    throw new AppError("INVALID_REQUEST");
  }
  return value;
}

export function normalizeLabelIds(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 100) throw new AppError("INVALID_REQUEST");
  const ids = value.map((id) => normalizeUuid(id));
  if (new Set(ids).size !== ids.length) throw new AppError("INVALID_REQUEST");
  return ids;
}

export function normalizeTaskId(value: unknown): string {
  return normalizeUuid(value);
}

export function normalizeDueDateState(value: unknown): DueDateState | undefined {
  if (value === undefined || value === "" || value === "all") return undefined;
  if (typeof value !== "string" || !DUE_DATE_STATES.includes(value as DueDateState)) {
    throw new AppError("INVALID_REQUEST");
  }
  return value as DueDateState;
}

export function normalizeSearch(value: unknown): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string") throw new AppError("INVALID_REQUEST");
  const search = value.trim();
  if (search.length > 200) throw new AppError("INVALID_REQUEST");
  return search || undefined;
}

export function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new AppError("INVALID_REQUEST");
  return value;
}

export function normalizeOptionalUuid(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return normalizeUuid(value);
}

export function normalizeExpectedRevision(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new AppError("INVALID_REQUEST");
  }
  return value;
}
