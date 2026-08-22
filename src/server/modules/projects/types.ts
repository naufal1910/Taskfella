import { AppError } from "@/server/http/errors";

export const PROJECT_TEMPLATES = ["personal", "simple", "blank"] as const;
export type ProjectTemplate = (typeof PROJECT_TEMPLATES)[number];

export const COLUMN_ROLES = [
  "queued",
  "planned",
  "active",
  "review",
  "completed",
  "neutral",
] as const;
export type ColumnRole = (typeof COLUMN_ROLES)[number];

export const WIP_MODES = ["none", "warn", "enforce"] as const;
export type WipMode = (typeof WIP_MODES)[number];

export const COMPLETED_GROUPINGS = ["list", "date"] as const;
export type CompletedGrouping = (typeof COMPLETED_GROUPINGS)[number];

export const PROJECT_STATUSES = ["active", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ColumnDraft {
  id?: string;
  name: string;
  role: ColumnRole;
  position: number;
  wipMode: WipMode;
  wipLimit: number | null;
  completedGrouping: CompletedGrouping;
}

export interface ProjectCreateInput {
  name: string;
  description?: string;
  template: ProjectTemplate;
  columns?: Array<Partial<ColumnDraft> & { name: string }>;
}

export interface ProjectPatchInput {
  name?: string;
  description?: string;
  expectedRevision?: number;
}

export const TEMPLATE_COLUMNS: Record<Exclude<ProjectTemplate, "blank">, ColumnDraft[]> = {
  personal: [
    {
      name: "Backlog",
      role: "queued",
      position: 0,
      wipMode: "none",
      wipLimit: null,
      completedGrouping: "list",
    },
    {
      name: "Today",
      role: "planned",
      position: 1,
      wipMode: "none",
      wipLimit: null,
      completedGrouping: "list",
    },
    {
      name: "In Progress",
      role: "active",
      position: 2,
      wipMode: "none",
      wipLimit: null,
      completedGrouping: "list",
    },
    {
      name: "Review",
      role: "review",
      position: 3,
      wipMode: "none",
      wipLimit: null,
      completedGrouping: "list",
    },
    {
      name: "Done",
      role: "completed",
      position: 4,
      wipMode: "none",
      wipLimit: null,
      completedGrouping: "list",
    },
  ],
  simple: [
    {
      name: "To Do",
      role: "queued",
      position: 0,
      wipMode: "none",
      wipLimit: null,
      completedGrouping: "list",
    },
    {
      name: "In Progress",
      role: "active",
      position: 1,
      wipMode: "none",
      wipLimit: null,
      completedGrouping: "list",
    },
    {
      name: "Done",
      role: "completed",
      position: 2,
      wipMode: "none",
      wipLimit: null,
      completedGrouping: "list",
    },
  ],
};

export const BLANK_COLUMNS: ColumnDraft[] = [
  {
    name: "In Progress",
    role: "active",
    position: 0,
    wipMode: "none",
    wipLimit: null,
    completedGrouping: "list",
  },
  {
    name: "Done",
    role: "completed",
    position: 1,
    wipMode: "none",
    wipLimit: null,
    completedGrouping: "list",
  },
];

export function normalizeProjectTemplate(value: unknown): ProjectTemplate {
  if (value === "personal" || value === "personal-project" || value === "Personal Project") {
    return "personal";
  }
  if (value === "simple" || value === "Simple") return "simple";
  if (value === "blank" || value === "Blank") return "blank";
  throw new AppError("INVALID_REQUEST");
}

export function normalizeProjectName(value: unknown): string {
  if (typeof value !== "string") throw new AppError("INVALID_REQUEST");
  const name = value.trim();
  if (name.length < 1 || name.length > 120) throw new AppError("INVALID_REQUEST");
  return name;
}

export function normalizeProjectDescription(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > 20_000) throw new AppError("INVALID_REQUEST");
  return value;
}

export function normalizeColumnName(value: unknown): string {
  if (typeof value !== "string") throw new AppError("INVALID_REQUEST");
  const name = value.trim();
  if (name.length < 1 || name.length > 80) throw new AppError("INVALID_REQUEST");
  return name;
}

export function normalizeSwimlaneName(value: unknown): string {
  if (typeof value !== "string") throw new AppError("INVALID_REQUEST");
  const name = value.trim();
  if (name.length < 1 || name.length > 80) throw new AppError("INVALID_REQUEST");
  return name;
}

export function normalizeLabelName(value: unknown): string {
  if (typeof value !== "string") throw new AppError("INVALID_REQUEST");
  const name = value.trim();
  if (name.length < 1 || name.length > 60) throw new AppError("INVALID_REQUEST");
  return name;
}

export function normalizeColor(value: unknown): string {
  if (value === undefined) return "#0F766E";
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new AppError("INVALID_REQUEST");
  }
  return value.toUpperCase();
}

export function normalizeRole(value: unknown, fallback: ColumnRole = "neutral"): ColumnRole {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !COLUMN_ROLES.includes(value as ColumnRole)) {
    throw new AppError("INVALID_REQUEST");
  }
  return value as ColumnRole;
}

export function normalizeWipMode(value: unknown, fallback: WipMode = "none"): WipMode {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !WIP_MODES.includes(value as WipMode)) {
    throw new AppError("INVALID_REQUEST");
  }
  return value as WipMode;
}

export function normalizeCompletedGrouping(
  value: unknown,
  fallback: CompletedGrouping = "list",
): CompletedGrouping {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !COMPLETED_GROUPINGS.includes(value as CompletedGrouping)) {
    throw new AppError("INVALID_REQUEST");
  }
  return value as CompletedGrouping;
}

export function normalizePosition(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new AppError("INVALID_REQUEST");
  }
  return value;
}

export function normalizeWipLimit(value: unknown, mode: WipMode): number | null {
  if (mode === "none") {
    if (value !== undefined && value !== null) throw new AppError("INVALID_REQUEST");
    return null;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 1_000_000) {
    throw new AppError("INVALID_REQUEST");
  }
  return value;
}

export function normalizedLabelName(name: string): string {
  return name.trim().normalize("NFKC").toLocaleLowerCase("en-US");
}

export function validateColumnDrafts(drafts: ColumnDraft[]): ColumnDraft[] {
  if (drafts.length < 2 || drafts.length > 100) throw new AppError("INVALID_REQUEST");
  const names = new Set<string>();
  const normalized = drafts.map((draft, index) => {
    const name = normalizeColumnName(draft.name);
    const nameKey = name.normalize("NFKC").toLocaleLowerCase("en-US");
    if (names.has(nameKey)) throw new AppError("INVALID_REQUEST");
    names.add(nameKey);
    const role = normalizeRole(draft.role);
    const wipMode = normalizeWipMode(draft.wipMode);
    const wipLimit = normalizeWipLimit(draft.wipLimit, wipMode);
    const completedGrouping = normalizeCompletedGrouping(draft.completedGrouping);
    return {
      ...draft,
      name,
      role,
      position: index,
      wipMode,
      wipLimit,
      completedGrouping,
    };
  });
  const activeCount = normalized.filter((column) => column.role === "active").length;
  const completedCount = normalized.filter((column) => column.role === "completed").length;
  if (activeCount !== 1 || completedCount < 1) {
    throw new AppError("BOARD_INVARIANT_VIOLATION");
  }
  return normalized;
}

export function completionMeaningChanges(from: ColumnRole, to: ColumnRole): boolean {
  return (from === "completed") !== (to === "completed");
}

export function requireCompletionConfirmation(
  from: ColumnRole,
  to: ColumnRole,
  confirmed: boolean | undefined,
): void {
  if (completionMeaningChanges(from, to) && confirmed !== true) {
    throw new AppError("WORKFLOW_CONFIRMATION_REQUIRED");
  }
}

export function validateWipSettings(mode: WipMode, limit: number | null): void {
  normalizeWipLimit(limit, mode);
}
