import postgres, { type Sql } from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getEnvironment } from "../config/env";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

interface DatabaseResources {
  sql: Sql;
  db: Database;
}

const globalForDatabase = globalThis as typeof globalThis & {
  taskfellaDatabase?: DatabaseResources;
};

// Drizzle records the SHA-256 of each applied migration in its ledger. This is
// the stable identity of the required Phase 0 migration, not a row count.
const PHASE_0_MIGRATION_HASH = "5cd233f4dc2ce97cb7296f67d605b941f7d905a3c9afd0520d281cc532caf8c9";

export function createDatabase(
  connectionString = getEnvironment().DATABASE_URL,
): DatabaseResources {
  const sql = postgres(connectionString, {
    max: getEnvironment().DB_POOL_MAX,
    connect_timeout: 5,
    idle_timeout: 20,
    prepare: false,
  });

  return { sql, db: drizzle(sql, { schema }) };
}

function getResources(): DatabaseResources {
  globalForDatabase.taskfellaDatabase ??= createDatabase();
  return globalForDatabase.taskfellaDatabase;
}

export function getDatabase(): Database {
  return getResources().db;
}

export function getSql(): Sql {
  return getResources().sql;
}

/**
 * Readiness requires a live PostgreSQL connection and the applied Phase 0
 * migration. A ledger table without the current migration row is not ready.
 */
export async function checkDatabaseReadiness(): Promise<boolean> {
  const result = await getSql()<{ migrations_ready: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM drizzle.__drizzle_migrations
      WHERE hash = ${PHASE_0_MIGRATION_HASH}
    ) AS migrations_ready
  `;

  return result[0]?.migrations_ready === true;
}

export async function closeDatabase(): Promise<void> {
  const resources = globalForDatabase.taskfellaDatabase;
  if (!resources) {
    return;
  }

  delete globalForDatabase.taskfellaDatabase;
  await resources.sql.end({ timeout: 5 });
}
