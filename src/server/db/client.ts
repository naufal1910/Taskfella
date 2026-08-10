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
 * Readiness requires both a live PostgreSQL connection and the migration ledger.
 * The ledger is the only database object created by Phase 0 migrations.
 */
export async function checkDatabaseReadiness(): Promise<boolean> {
  const result = await getSql()<{ migrations_ready: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'drizzle'
        AND table_name = '__drizzle_migrations'
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
