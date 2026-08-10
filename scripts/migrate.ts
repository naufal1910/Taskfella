import "dotenv/config";
import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "../src/server/db/client";

async function main(): Promise<void> {
  const { db, sql } = createDatabase();

  try {
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
    console.log("Taskfella database migrations applied.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(() => {
  console.error("Database migration failed. Check DATABASE_URL and PostgreSQL availability.");
  process.exitCode = 1;
});
