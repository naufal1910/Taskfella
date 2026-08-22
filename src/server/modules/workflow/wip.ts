import { and, eq, sql } from "drizzle-orm";
import { type Database } from "@/server/db/client";
import { columns, projects, type ProjectColumn } from "@/server/db/schema";
import { AppError } from "@/server/http/errors";
import { normalizeUuid, type WipMode, validateWipSettings } from "@/server/modules/projects/types";

export type WorkflowTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface WipEvaluation {
  mode: WipMode;
  limit: number | null;
  currentCount: number;
  allowed: boolean;
  warning: boolean;
}

/**
 * The policy is deliberately independent of task storage. Phase 3 task moves
 * pass an authoritative count query to assertColumnWip in the same transaction
 * that changes the task location.
 */
export function evaluateWip(
  mode: WipMode,
  limit: number | null,
  currentCount: number,
  warningConfirmed = false,
): WipEvaluation {
  validateWipSettings(mode, limit);
  if (!Number.isInteger(currentCount) || currentCount < 0) {
    throw new AppError("INVALID_REQUEST");
  }
  if (mode === "none" || limit === null || currentCount < limit) {
    return { mode, limit, currentCount, allowed: true, warning: false };
  }
  if (mode === "warn") {
    if (!warningConfirmed) {
      throw new AppError("WIP_CONFIRMATION_REQUIRED");
    }
    return { mode, limit, currentCount, allowed: true, warning: true };
  }
  throw new AppError("WIP_LIMIT_REACHED");
}

export type WipCountReader = (tx: WorkflowTransaction, columnId: string) => Promise<number>;
export type WipMutation<T> = (tx: WorkflowTransaction, evaluation: WipEvaluation) => Promise<T>;

export async function assertColumnWip<T>(
  db: Database,
  accountId: string,
  projectId: string,
  columnId: string,
  readCount: WipCountReader,
  mutate: WipMutation<T>,
  warningConfirmed = false,
): Promise<T> {
  const normalizedProjectId = normalizeUuid(projectId);
  const normalizedColumnId = normalizeUuid(columnId);
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`taskfella-workflow:${normalizedProjectId}`}))`,
    );
    const [project] = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, normalizedProjectId), eq(projects.accountId, accountId)))
      .for("update");
    if (!project) throw new AppError("NOT_FOUND");
    const [column] = await tx
      .select()
      .from(columns)
      .where(and(eq(columns.id, normalizedColumnId), eq(columns.projectId, normalizedProjectId)))
      .for("update");
    if (!column) throw new AppError("NOT_FOUND");
    const currentCount = await readCount(tx, normalizedColumnId);
    const evaluation = evaluateWip(
      column.wipMode as WipMode,
      column.wipLimit,
      currentCount,
      warningConfirmed,
    );
    return mutate(tx, evaluation);
  });
}

export function wipPayload(column: ProjectColumn, currentCount = 0) {
  const mode = column.wipMode as WipMode;
  const limit = column.wipLimit;
  validateWipSettings(mode, limit);
  return {
    mode,
    limit,
    currentCount,
    remaining: limit === null ? null : Math.max(0, limit - currentCount),
    atLimit: limit !== null && currentCount >= limit,
    enforceBlocked: mode === "enforce" && limit !== null && currentCount >= limit,
  };
}
