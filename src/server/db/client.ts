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

// Drizzle records the SHA-256 of each applied migration in its ledger. Readiness
// is tied to the latest required migration, not to a row count or table probe.
export const REQUIRED_MIGRATION_HASH =
  "5776b8e47a198937b36f5d5084d3b8bf85135028b604ba643dcf001213d8fda3";

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
 * Readiness requires a live PostgreSQL connection and the applied latest
 * required migration. A ledger without that row is not ready.
 */
export async function checkDatabaseReadiness(): Promise<boolean> {
  const result = await getSql()<{ migrations_ready: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM drizzle.__drizzle_migrations
      WHERE hash = ${REQUIRED_MIGRATION_HASH}
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
